// [Popout] Transport layer for cross-window data sync: a bidirectional direct
// MessagePort link established through a MessageChannelMain broker, without
// relaying through ipcMain.
//
// Handshake (driven single-handedly by createPopoutWindow in the main process,
// electron/main.js; see the comments there): when a popout window is created,
// the main process generates a pair of ports via MessageChannelMain. port1 is
// posted to the main window immediately (carrying popoutWindowId), port2 is
// posted to the popout window after its did-finish-load (carrying
// ownerWindowId). Both sides listen for 'popout-provide-message-port' and take
// the port from event.ports[0] to communicate directly.
//
// A single main window can have multiple popout windows at once (several panels
// or preview viewports popped out separately); each connection is tracked
// independently in the connections Map, keyed by the other window's
// BrowserWindow.id.
//
// Broadcast payloads:
//   - Project snapshot (without bitmaps: across windows within the same process
//     runtime objects like Texture.img are shared, so re-encoding texture data
//     is unnecessary) — debounced 250ms after finish_edit
//   - Selection state — debounced 60ms after update_selection
//
// Echo prevention: the applying_remote flag suppresses the local
// finish_edit/update_selection listeners from broadcasting outward while a
// remote snapshot/selection is being applied, breaking the infinite loop of
// "apply remote -> trigger local event -> broadcast back -> other side applies
// -> ...". This is the primary mechanism; window_instance_id plus an
// incrementing seq serve as extra defense on top of the direct pipe (dropping
// echoes / out-of-order packets).
import { Blockbench } from "../api";
import { ipcRenderer, process } from "../native_apis";
import { replaceProjectContentInPlace, applySelectionOnly } from "./popout_sync";
import { computeTransformDiff, applyTransformDiff } from "./popout_sync_diff";
import { Panels } from "../interface/panels";

type SyncMessage =
	| {type: 'project', seq: number, from: string, model: any}
	| {type: 'selection', seq: number, from: string, elementUuids: string[], groupUuids: string[]}
	| {type: 'mode', seq: number, from: string, mode: string}
	| {type: 'query_mode', seq: number, from: string}
	| {type: 'mode_response', seq: number, from: string, mode: string}
	| {type: 'diff', seq: number, from: string, projectUuid: string, elementChanges: [string, any][], groupChanges: [string, any][]}
	// [Popout] Generic panel runtime state sync (see PanelOptions.popout.syncState
	// in panels.ts). panelId is the key in the Panels dictionary; state is the
	// return value of that panel's syncState.get().
	| {type: 'panel_state', seq: number, from: string, panelId: string, state: any};

interface Connection {
	port: MessagePort
	last_seen_seq: number
	// [Popout] (#7.3) Incremental diff: records the last broadcasted snapshot, used to compute this round's diff.
	last_broadcasted_snapshot?: any
}

// [Popout] Whether this window is a popout window (SoloMode). Determined directly
// from process.argv, to avoid a module-load-time circular dependency with
// popout.ts. Used to make the initial "broadcast on connect" one-directional:
// only the main window (non-popout) pushes its project to the popout window as
// initial content when the connection is established; the popout window's
// project is still empty at that point (splash screen), so it must not broadcast
// back and wipe the main window's project.
const is_popout_window = isApp && process.argv.some(a => a.startsWith('--popout-kind='));

const window_instance_id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let outgoing_seq = 0;
// [Popout] Currently applying a remote snapshot/selection. Local broadcasts are suppressed during this, to prevent echo loops.
let applying_remote = false;
// [Popout] otherWindowId -> Connection. A main window may connect to multiple
// popout windows at once; a popout window connects only to its main window.
// Both roles are expressed through the same Map.
const connections = new Map<number, Connection>();

function debounce<T extends (...args: any[]) => void>(fn: T, wait: number): T {
	let timer: any = null;
	return ((...args: any[]) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => { timer = null; fn(...args); }, wait);
	}) as T;
}

function broadcast(message: SyncMessage) {
	for (let {port} of connections.values()) {
		port.postMessage(message);
	}
}

function broadcastProject() {
	if (!Project || applying_remote || connections.size == 0) return;
	outgoing_seq++;
	// [Popout] No bitmaps — the two sides are separate processes on the same
	// machine, but share the same on-disk model state; what matters across
	// windows is the real-time nature of structure/selection/transform data.
	// Re-transmitting unchanged texture data only adds serialization and
	// transfer overhead after every finish_edit.
	let snapshot = Codecs.project.compile({editor_state: true, raw: true});
	// [Popout] compile does not output the project's own uuid (uuid is not an
	// exported Property of ModelProject). Attach it manually so the receiving
	// end's replaceProjectContentInPlace can find the target project to replace
	// in place by uuid (falling back to Codecs.project.load for the first-time
	// construction if not found).
	snapshot.uuid = Project.uuid;

	// [Popout] (#7.3) Incremental diff: each connection computes its diff
	// independently, preferring to send a diff message (transform edits), and
	// falling back to a full project message if a structural change is detected.
	// The first sync (last_broadcasted_snapshot=null) must be full.
	for (let conn of connections.values()) {
		let diff = computeTransformDiff(snapshot, conn.last_broadcasted_snapshot);
		if (diff && !diff.structuralChange && (diff.elementChanges.size > 0 || diff.groupChanges.size > 0)) {
			// Pure transform edit, send diff
			conn.port.postMessage({
				type: 'diff',
				seq: outgoing_seq,
				from: window_instance_id,
				projectUuid: Project.uuid,
				elementChanges: Array.from(diff.elementChanges.entries()),
				groupChanges: Array.from(diff.groupChanges.entries()),
			} as SyncMessage);
		} else {
			// First sync / structural change / no change -> send full (send even on no change, to keep it simple; future: could optimize)
			conn.port.postMessage({
				type: 'project',
				seq: outgoing_seq,
				from: window_instance_id,
				model: snapshot
			} as SyncMessage);
		}
		// Update the remembered snapshot (deep clone to avoid later mutations polluting it)
		conn.last_broadcasted_snapshot = JSON.parse(JSON.stringify(snapshot));
	}
}
const broadcastProjectDebounced = debounce(broadcastProject, 250);

function broadcastSelection() {
	if (!Project || applying_remote || connections.size == 0) return;
	outgoing_seq++;
	broadcast({
		type: 'selection',
		seq: outgoing_seq,
		from: window_instance_id,
		elementUuids: Project.selected_elements.map((el: any) => el.uuid),
		groupUuids: (Group.multi_selected || []).map((g: any) => g.uuid),
	});
}
const broadcastSelectionDebounced = debounce(broadcastSelection, 60);

// [Popout] Generic panel runtime state sync. Any Panel can opt in by declaring
// syncState({events, get, apply}) in its own popout config, without touching
// this file. Subscriptions are set up uniformly by registerPanelStateSync()
// (see below) after the Panels dictionary has been fully populated.
function broadcastPanelState(panel_id: string) {
	if (applying_remote || connections.size == 0) return;
	let panel = (Panels as any)[panel_id];
	let sync = panel?.popout_config?.syncState;
	if (!panel || !sync) return;
	outgoing_seq++;
	broadcast({
		type: 'panel_state',
		seq: outgoing_seq,
		from: window_instance_id,
		panelId: panel_id,
		state: sync.get(panel),
	});
}

/**
 * [Popout] Scans the Panels dictionary and registers event listeners for every
 * panel that declares popout_config.syncState. Must be called after
 * setupPanels() has run (Panels dictionary populated) — it cannot go in this
 * module's top-level `if (isApp)` block, which executes when boot_loader.js
 * imports it, before setupInterface()/setupPanels(), when Panels is still an
 * empty dictionary. Called by initPopoutMode() in js/interface/popout.ts (which
 * itself is only called by boot_loader.js after setupInterface()).
 *
 * Safe to call repeatedly: already-registered panel_ids are skipped, so
 * listeners are not attached twice. Panels registered by plugins may not yet
 * exist in the Panels dictionary on the first call, because
 * loadInstalledPlugins() is asynchronous — this function should be called again
 * after plugins finish loading, to pick up the late-arriving panels.
 */
const panel_state_sync_registered = new Set<string>();
export function registerPanelStateSync() {
	for (let panel_id in Panels) {
		if (panel_state_sync_registered.has(panel_id)) continue;
		let panel = (Panels as any)[panel_id];
		let sync = panel?.popout_config?.syncState;
		if (!sync) continue;
		panel_state_sync_registered.add(panel_id);
		let debounced = debounce(() => broadcastPanelState(panel_id), sync.debounce ?? 150);
		for (let event_name of sync.events) {
			Blockbench.addListener(event_name, debounced);
		}
	}
}

// [Popout] (#7.5) Mode (edit/paint/animate etc.) is now **independent**: the
// child window switching modes does not affect the main window, and vice versa.
// The two windows are separate processes, each maintaining its own global
// Mode.selected, so they are naturally independent. Only when the user actively
// clicks the "follow main window" button does the child window send a query_mode
// request; the main window replies with mode_response, and the child window
// switches to the main window's current mode on receipt.
// Exported for the "follow main window mode" button in popout.ts to call.
export function requestFollowMainWindowMode() {
	if (connections.size == 0) return;
	outgoing_seq++;
	broadcast({type: 'query_mode', seq: outgoing_seq, from: window_instance_id});
}

function handleIncoming(conn: Connection, msg: SyncMessage) {
	if (msg.from == window_instance_id) return; // Drop echo (a direct pipe should never produce this in theory, kept defensively)
	if (msg.seq <= conn.last_seen_seq) return; // Drop out-of-order/duplicate packets
	conn.last_seen_seq = msg.seq;

	// [Popout] Set applying_remote while applying, to suppress the local
	// finish_edit/update_selection listeners from broadcasting the "just-applied
	// remote change" back out as a local edit. Reset after 500ms: some of the
	// Vue/Three.js side effects triggered by replaceProjectContentInPlace land
	// asynchronously, and resetting too early could let an async callback
	// mistake it for a "new user edit" and broadcast an echo.
	applying_remote = true;
	try {
		if (msg.type == 'project') {
			replaceProjectContentInPlace(msg.model);
		} else if (msg.type == 'selection') {
			applySelectionOnly(msg.elementUuids, msg.groupUuids);
		} else if (msg.type == 'query_mode') {
			// [Popout] (#7.5) Received a "query current mode" request (usually the main window receiving a child window's follow request),
			// reply with a mode_response carrying our current mode. Not suppressed by applying_remote.
			if (Mode.selected) {
				outgoing_seq++;
				conn.port.postMessage({
					type: 'mode_response', seq: outgoing_seq, from: window_instance_id, mode: Mode.selected.id
				} as SyncMessage);
			}
		} else if (msg.type == 'mode_response') {
			// [Popout] (#7.5) Child window received the main window's mode reply, switch to it (this window only).
			let mode = (Modes.options as any)[msg.mode];
			if (mode && Mode.selected !== mode) mode.select();
		} else if (msg.type == 'mode') {
			// Compat with the legacy message type (should no longer be sent); apply to this window only.
			let mode = (Modes.options as any)[msg.mode];
			if (mode && Mode.selected !== mode) mode.select();
		} else if (msg.type == 'diff') {
			// [Popout] (#7.3) Incremental diff: only update changed props, no clear-and-rebuild, no flicker.
			applyTransformDiff({
				elementChanges: new Map(msg.elementChanges),
				groupChanges: new Map(msg.groupChanges),
				structuralChange: false
			});
		} else if (msg.type == 'panel_state') {
			// [Popout] The apply side of generic panel runtime-state sync. Safely skip when the panel
			// does not exist (e.g. the other window popped out a panel id not mounted here) or declares no syncState.
			let panel = (Panels as any)[msg.panelId];
			let sync = panel?.popout_config?.syncState;
			if (panel && sync) {
				sync.apply(panel, msg.state);
			}
		}
	} finally {
		setTimeout(() => { applying_remote = false; }, 500);
	}
}

// [Popout] The listener is registered unconditionally at module load, not waiting for any explicit
// call -- the port is pushed unilaterally by the main process (see electron/main.js createPopoutWindow);
// for the main window, port1 is sent synchronously at window creation, so the listener must be in place beforehand or it misses this message.
if (isApp) {
	ipcRenderer.on('popout-provide-message-port', (event, data: {popoutWindowId?: number, ownerWindowId?: number}) => {
		if (!event.ports || !event.ports[0]) return;
		let other_window_id = data?.popoutWindowId ?? data?.ownerWindowId;
		if (other_window_id == null) return;

		let port = event.ports[0];
		let conn: Connection = {port, last_seen_seq: 0};
		connections.set(other_window_id, conn);
		port.onmessage = (e) => handleIncoming(conn, e.data as SyncMessage);
		port.start();
		// [Popout] Once the connection is established, immediately push the current full project to the
		// other side as initial content, so the popout window is not empty on open (waiting for the next edit
		// to catch up). Only the main window (non-popout) does this: the popout's project is still the empty
		if (!is_popout_window) {
			broadcastProject();
			// [Popout] Likewise, push the main window's current panel runtime state (color/playhead/etc.)
			// as initial content to the new connection too, otherwise the popout window has to wait for the
			// next state-change event to catch up (e.g. a popped-out color picker stays default white until the user next changes color).
			for (let panel_id in Panels) {
				let panel = (Panels as any)[panel_id];
				let sync = panel?.popout_config?.syncState;
				if (!sync) continue;
				outgoing_seq++;
				conn.port.postMessage({
					type: 'panel_state',
					seq: outgoing_seq,
					from: window_instance_id,
					panelId: panel_id,
					state: sync.get(panel),
				} as SyncMessage);
			}
		}
	});

	Blockbench.addListener('finish_edit', broadcastProjectDebounced);
	Blockbench.addListener('update_selection', broadcastSelectionDebounced);
	// [Popout] undo()/redo() (js/undo.js) only dispatch 'undo'/'redo' and do not trigger
	// 'finish_edit'; the original broadcast path is bound entirely to finish_edit, so project
	// data changes from undo/redo were not broadcast to popout windows. Add listeners here reusing
	// the same debounced broadcast, without changing undo.js itself.
	Blockbench.addListener('undo', broadcastProjectDebounced);
	Blockbench.addListener('undo', broadcastSelectionDebounced);
	Blockbench.addListener('redo', broadcastProjectDebounced);
	Blockbench.addListener('redo', broadcastSelectionDebounced);
	// [Popout] (#7.5) No longer listen to select_mode for auto-broadcast -- mode is now independent; only the
	// "follow main window" button actively triggers requestFollowMainWindowMode().
}

/**
 * Close the sync connection with other_window_id (called when the other window has closed), releasing the MessagePort.
 */
export function stopPopoutSync(other_window_id: number) {
	let conn = connections.get(other_window_id);
	if (conn) {
		conn.port.close();
		connections.delete(other_window_id);
	}
}
