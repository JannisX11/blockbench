// [Popout] Pop panels/preview viewports out into standalone Electron windows.
//
// Approach: the child window reuses the same index.html + dist/bundle.js (the
// full bundle, no trimmed-down entry -- Panel/Preview instances are created as
// top-level side effects of the various feature modules, so a subset cannot be
// carved out at module granularity). SoloMode is detected via the
// --popout-kind=/--popout-target= arguments passed through additionalArguments;
// once boot_loader.js has finished the full startup flow, a one-time visual trim
// runs: hide the main UI and mount only the target Panel container / Preview
// onto #popout_content. For cross-window communication see
// js/io/popout_sync_hub.ts (direct MessagePort link, not relayed through ipcMain).
import { Blockbench } from "../api";
import { ipcRenderer, currentwindow, process } from "../native_apis";
import { panelPopoutDetachHistory } from "./panels";
import { stopPopoutSync, requestFollowMainWindowMode, registerPanelStateSync } from "../io/popout_sync_hub";
import { Plugins } from "../plugin_loader";

export type PopoutKind = 'panel' | 'preview';

/** SoloMode parameters parsed from process.argv; null in non-popout windows */
export const SoloMode: {kind: PopoutKind, targetId: string} | null = (() => {
	if (!isApp) return null;
	let kind_arg = process.argv.find(a => a.startsWith('--popout-kind='));
	let target_arg = process.argv.find(a => a.startsWith('--popout-target='));
	if (!kind_arg || !target_arg) return null;
	return {
		kind: kind_arg.split('=')[1] as PopoutKind,
		targetId: target_arg.split('=')[1],
	};
})();

/** [Popout] In a popout window, the Electron BrowserWindow.id of the main window that created it */
const popout_owner_win_id: number | null = (() => {
	if (!isApp || !SoloMode) return null;
	let arg = process.argv.find(a => a.startsWith('--popout-owner-window-id='));
	if (!arg) return null;
	return parseInt(arg.split('=')[1]);
})();

/**
 * Called at the end of boot_loader.js's full startup flow. If the current
 * window is a popout window, perform the visual trim + mount the target content
 * (the data-sync MessagePort is pushed proactively by the main process; the
 * popout_sync_hub.ts module already registered its receive listener at module
 * load time); otherwise this is the main window, so register the popout-closed
 * recovery listener.
 */
export function initPopoutMode(): void {
	if (!isApp) return;
	console.log('[popout] initPopoutMode: SoloMode=' + JSON.stringify(SoloMode) + ' argv=' + JSON.stringify(process.argv.filter(a => a.startsWith('--popout'))));

	// [Popout] At this point setupInterface()/setupPanels() have finished (the
	// boot_loader.js call order is: setupInterface() first, initPopoutMode()
	// after), so the Panels dictionary is populated and we can safely scan every
	// panel's popout_config.syncState and register subscriptions. Both the main
	// window and popout windows must register -- each side needs to broadcast to
	// the other when its local state changes.
	registerPanelStateSync();

	if (SoloMode) {
		// [Popout] Inside a popout window, write any mount-time exception to a
		// visible overlay, to avoid a "blank flash" that leaves no way to
		// diagnose (the popout window may not get a chance to open its own devtools).
		try {
			applySoloWindowMode();
		} catch (err) {
			showPopoutError('applySoloWindowMode threw: ' + (err && err.stack || err));
			console.error('[popout] applySoloWindowMode failed', err);
		}
	} else {
		// Main window: listen for child-window close events and pull the
		// panel/preview viewport back to its original place.
		ipcRenderer.on('popout-closed', (event, data) => {
			handlePopoutClosed(data);
		});
		// [Popout] Only restore the last popout windows when "opening an existing
		// project file", not on a new blank project.
		// [Popout] (#7.1) Per user request: after closing, only remember the
		// position, do not auto-restore. When the user manually clicks the "pop
		// out" button, pop out again using the remembered position. So the
		// restoreOpenPopouts() auto-restore call is commented out. Geometry memory
		// (savePopoutGeometry/getPopoutGeometry) still works; on a manual popout
		// requestPopout reads the last remembered bounds.
		// let restored = false;
		// Blockbench.addListener('load_project', () => {
		// 	if (restored) return;
		// 	restored = true;
		// 	restoreOpenPopouts();
		// });
	}
}

/** [Popout] Show a prominent error message inside the popout window (instead of leaving it blank) */
function showPopoutError(message: string) {
	document.body.classList.add('solo-panel-mode');
	let content = document.getElementById('popout_content');
	if (!content) return;
	content.innerHTML = '';
	let box = document.createElement('div');
	box.style.cssText = 'padding:16px;color:var(--color-text);font:13px/1.5 monospace;white-space:pre-wrap;overflow:auto;';
	box.textContent = '[Popout] ' + message;
	content.append(box);
}

function applySoloWindowMode() {
	console.log('[popout] applySoloWindowMode start, kind=' + SoloMode.kind + ' target=' + SoloMode.targetId);
	document.body.classList.add('solo-panel-mode');
	setupPopoutTitleBar();

	if (SoloMode.kind == 'panel') {
		applyPanelPopoutContent(SoloMode.targetId);
	} else if (SoloMode.kind == 'preview') {
		applyPreviewPopoutContent(SoloMode.targetId);
	}
	console.log('[popout] applySoloWindowMode done');
}

function applyPanelPopoutContent(panel_id: string) {
	let panel = Panels[panel_id];
	if (!panel) {
		// [Popout] A plugin-registered panel may not be in place yet:
		// loadInstalledPlugins() in boot_loader.js is async, and initPopoutMode()
		// runs synchronously right after it without waiting for it to finish. The
		// main window is unaffected (it does not hard-depend on plugin loading
		// being complete before use), but a popout window is a new process that
		// re-runs the whole boot_loader.js; if the target panel is registered by a
		// plugin, it may not have run yet at this point. Reuse the shared Promise
		// that boot_loader.js stored in Plugins.install_promise, wait for it, and
		// retry once (we cannot re-call loadInstalledPlugins() -- it is not
		// idempotent and would re-run the plugin install/load side effects). If it
		// is still not found, it is a genuine config error / missing plugin.
		let wait = Plugins.install_promise;
		if (wait) {
			wait.then(() => {
				let retried = Panels[panel_id];
				if (retried) {
					registerPanelStateSync();
					mountPanelPopoutContent(retried, panel_id);
				} else {
					showPopoutError(`Panel "${panel_id}" not found. Registered panels: ${Object.keys(Panels).join(', ')}`);
				}
			});
		} else {
			showPopoutError(`Panel "${panel_id}" not found. Registered panels: ${Object.keys(Panels).join(', ')}`);
		}
		return;
	}
	mountPanelPopoutContent(panel, panel_id);
}

function mountPanelPopoutContent(panel: any, panel_id: string) {
	console.log('[popout] mounting panel "' + panel_id + '" -> #popout_content');
	let content = document.getElementById('popout_content');
	content.append(panel.container);
	panel.container.classList.remove('hidden');
	// [Popout] Mark as popped out: from now on this window's
	// updateInterface()/updateSidebarOrder() will no longer drag this container
	// back to the (hidden) sidebar, keeping it visible inside #popout_content.
	panel.popout_active = true;
	// moveTo('hidden') calls remove() on the node on the main-window side; re-add it here
	if (!panel.node.isConnected) {
		panel.container.append(panel.node);
	}
	panel.node.classList.remove('floating');

	document.getElementById('popout_title_bar_text').textContent = panel.name;

	let info = {width: window.innerWidth, height: window.innerHeight};
	panel.popout_config?.onPopoutReady?.(panel, info);

	window.addEventListener('resize', () => {
		panel.popout_config?.onPopoutResize?.(panel, window.innerWidth, window.innerHeight);
	});
}

function applyPreviewPopoutContent(index_str: string) {
	// The actual implementation is in applyPreviewPopoutMount() in
	// js/preview/preview.js, because it needs access to Preview.split_screen's
	// private state; here we only forward, to avoid popout.ts taking a reverse
	// dependency on preview.js and creating a circular import.
	Blockbench.dispatchEvent('popout_mount_preview', {index: parseInt(index_str)});
}

function setupPopoutTitleBar() {
	document.getElementById('popout_controls_button_minimize').addEventListener('click', () => {
		currentwindow.minimize();
	});
	// [Popout] The maximize button was removed from the HTML (#7.4); no longer bound.
	document.getElementById('popout_controls_button_close').addEventListener('click', () => {
		if (popout_owner_win_id != null) stopPopoutSync(popout_owner_win_id);
		currentwindow.close();
	});
	// [Popout] The maximize/unmaximize body class toggle is also removed (button deleted).

	let pin_button = document.getElementById('popout_pin_button');
	pin_button.addEventListener('click', () => {
		let next_state = !currentwindow.isAlwaysOnTop();
		currentwindow.setAlwaysOnTop(next_state);
		pin_button.classList.toggle('active', next_state);
	});

	// [Popout] Mode switcher button (#7.5). Clicking opens a menu:
	//  - Each mode entry: switches only **this window's** mode, without affecting
	//    the main window (independent mode).
	//  - "Follow Main Window": proactively queries the main window for its current
	//    mode and switches to it (requestFollowMainWindowMode).
	let mode_switcher = document.getElementById('popout_mode_switcher');
	mode_switcher.addEventListener('click', (event) => {
		let entries: any[] = [];
		for (let id in Modes.options) {
			let mode = Modes.options[id];
			entries.push({
				id,
				icon: mode.icon || 'mode',
				name: mode.name,
				condition: mode.condition,
				click: () => { mode.select(); },
			});
		}
		entries.push('_');  // separator
		entries.push({
			id: 'follow_main_window',
			icon: 'link',
			name: tl('menu.popout.follow_main_window') || 'Follow Main Window',
			click: () => { requestFollowMainWindowMode(); },
		});
		new Menu(entries).open(mode_switcher);
	});
}

function handlePopoutClosed(data: {kind: PopoutKind, targetId: string, bounds?: {x: number, y: number, width: number, height: number}, popoutWindowId?: number}) {
	if (data.bounds) {
		savePopoutGeometry(data.kind, data.targetId, data.bounds);
	}
	// [Popout] User manually closes the popout window -> remove it from the "to
	// restore" set so it is not auto-popped on next launch.
	// (When the whole app quits, the main window is already destroyed and this
	//  popout-closed will not be delivered, so the open state is preserved --
	//  those are exactly the windows to restore on next launch.)
	setPopoutOpenState(data.kind, data.targetId, false);
	if (data.popoutWindowId != null) {
		stopPopoutSync(data.popoutWindowId);
	}
	if (data.kind == 'panel') {
		recoverPanel(data.targetId);
	} else if (data.kind == 'preview') {
		Blockbench.dispatchEvent('popout_recover_preview', {index: parseInt(data.targetId)});
	}
}

function recoverPanel(panel_id: string) {
	let panel = Panels[panel_id];
	if (!panel) return;
	// [Popout] Clear the popout flag (on the main window this Panel instance is
	// usually already false, defensive reset) so it re-participates in the main
	// interface layout.
	panel.popout_active = false;
	panel.popout_config?.onPopoutClose?.(panel);
	panel.moveTo(panel.previous_slot || 'left_bar');

	let host_id = panelPopoutDetachHistory.get(panel_id);
	if (host_id && Panels[host_id]) {
		Panels[host_id].attachPanel(panel);
	}
	panelPopoutDetachHistory.delete(panel_id);
	// Also pull back any sub-panels that were attached to this panel and
	// detached along with it.
	for (let [id, host] of [...panelPopoutDetachHistory.entries()]) {
		if (host == panel_id && Panels[id]) {
			panel.attachPanel(Panels[id]);
			panelPopoutDetachHistory.delete(id);
		}
	}
}

/** [Popout] Popout window geometry persistence: panelId/preview_<index> -> {x,y,width,height} */
export function savePopoutGeometry(kind: PopoutKind, targetId: string, bounds: {x: number, y: number, width: number, height: number}) {
	StateMemory.init('panel_popout_geometry', 'object');
	let key = `${kind}:${targetId}`;
	let all = StateMemory.get('panel_popout_geometry') as Record<string, any>;
	all[key] = bounds;
	StateMemory.save('panel_popout_geometry');
}
export function getPopoutGeometry(kind: PopoutKind, targetId: string): {x?: number, y?: number, width: number, height: number} | null {
	StateMemory.init('panel_popout_geometry', 'object');
	let all = StateMemory.get('panel_popout_geometry') as Record<string, any>;
	let entry = all[`${kind}:${targetId}`];
	if (!entry) return null;
	return {x: entry.x, y: entry.y, width: entry.width, height: entry.height};
}

/**
 * [Popout] Records the set of panels/preview viewports currently "in popout
 * state" (key = `${kind}:${targetId}`), used to restore them on next launch.
 * Stored separately from geometry data: geometry updates on window resize/move,
 * this one is only added/removed on popout/recover.
 */
function setPopoutOpenState(kind: PopoutKind, targetId: string, open: boolean) {
	StateMemory.init('open_popouts', 'object');
	let all = StateMemory.get('open_popouts') as Record<string, boolean>;
	let key = `${kind}:${targetId}`;
	if (open) all[key] = true; else delete all[key];
	StateMemory.save('open_popouts');
}

/**
 * [Popout] After startup completes (main window only), re-pop the panels/preview
 * viewports that were still popped out at last exit, relying on persisted
 * geometry data to land them back in their original positions. The main
 * process's popout-request handler dedupes (focuses existing), so repeated calls
 * are safe.
 */
function restoreOpenPopouts() {
	StateMemory.init('open_popouts', 'object');
	let all = StateMemory.get('open_popouts') as Record<string, boolean>;
	for (let key in all) {
		if (!all[key]) continue;
		let sep = key.indexOf(':');
		if (sep == -1) continue;
		let kind = key.slice(0, sep) as PopoutKind;
		let targetId = key.slice(sep + 1);
		// Panel: must currently exist and be poppable; preview viewport: left to
		// the trigger side to decide. Use the default size; internally
		// requestPopout prefers the remembered geometry (including x/y).
		if (kind == 'panel') {
			let panel = Panels[targetId];
			if (!panel || !panel.canPopout()) continue;
			panel.requestPanelPopout();
		} else if (kind == 'preview') {
			requestPopout('preview', targetId, [480, 480]);
		}
	}
}

/**
 * [Popout] Generic trigger: request a popout from the main process, carrying the
 * last remembered window size and position (if any). The data-sync MessagePort
 * is pushed proactively by the main process when it creates the popout window,
 * so no explicit connection needs to be established here (see the header comment
 * in js/io/popout_sync_hub.ts).
 */
export function requestPopout(kind: PopoutKind, targetId: string, default_size: [number, number]) {
	let remembered = getPopoutGeometry(kind, targetId);
	let width = remembered?.width ?? default_size[0];
	let height = remembered?.height ?? default_size[1];
	let x = remembered?.x;
	let y = remembered?.y;
	setPopoutOpenState(kind, targetId, true);
	ipcRenderer.send('popout-request', {kind, targetId, width, height, x, y});
}

const global = {
	SoloMode,
	initPopoutMode,
	requestPopout,
	getPopoutGeometry,
};
declare global {
	const SoloMode: typeof global.SoloMode
	const initPopoutMode: typeof global.initPopoutMode
	const requestPopout: typeof global.requestPopout
	const getPopoutGeometry: typeof global.getPopoutGeometry
}
Object.assign(window, global);
