// [Popout] Incremental diff-patch sync system (#7.3+7.6).
//
// Fundamentally fixes flicker + undo breakage: no longer clear-and-rebuild, but match
// existing elements/groups/textures/animations by UUID and only update changed props
// (from/to/rotation/scale/name/faces, etc.); init() new ones, remove() deleted ones.
//
// Phased implementation:
// Phase 1 (MVP): transform-only edits -- only change position/rotation/scale/from/to,
//               not structure (no add/remove of element/group/texture/animation). This
//               covers the most common drag/rotate/scale edits and removes flicker.
// Phase 2: structural edits (add/remove element/group/texture/animation) + outliner reorder.
// Phase 3: Undo.history sync -- wrap remote edits as local UndoSystem entries so Ctrl+Z works in the main window.

import { Canvas } from '../preview/canvas';
// [Popout] Undo / settings / OutlinerNode are runtime globals (see js/undo.js,
// js/outliner/abstract/outliner_node.ts); like Project/Codecs/ProjectData in
// popout_sync.ts, use them directly as globals rather than importing (importing would
// OutlinerNode.uuids[uuid] is the global index for looking up element/group instances by UUID.
declare const Undo: any;
declare const settings: any;
declare const UndoSystem: any;
declare const OutlinerNode: any;
declare const UVEditor: any;

// ---- Phase 1: Transform-only diff ----

interface TransformDiff {
	elementChanges: Map<string, Partial<any>>  // uuid -> changed props
	groupChanges: Map<string, Partial<any>>
	// Structural change flag: if add/remove is detected, fall back to full sync
	structuralChange: boolean
}

/**
 * Compute the transform diff between the current project and the last snapshot (Phase 1: transform only, no structural changes).
 * If a structural change is detected (different element/group/texture/animation counts, or mismatched UUID sets),
 * return structuralChange=true and the caller falls back to a full replaceProjectContentInPlace.
 */
export function computeTransformDiff(current_snapshot: any, last_snapshot: any | null): TransformDiff | null {
	if (!last_snapshot) return null;  // first sync, must be full

	let diff: TransformDiff = {
		elementChanges: new Map(),
		groupChanges: new Map(),
		structuralChange: false
	};

	// Check structural change: element/group/texture/animation counts
	let cur_elements = current_snapshot.elements || [];
	let last_elements = last_snapshot.elements || [];
	let cur_groups = current_snapshot.groups || [];
	let last_groups = last_snapshot.groups || [];
	let cur_textures = current_snapshot.textures || [];
	let last_textures = last_snapshot.textures || [];
	let cur_animations = current_snapshot.animations || [];
	let last_animations = last_snapshot.animations || [];

	if (cur_elements.length != last_elements.length ||
		cur_groups.length != last_groups.length ||
		cur_textures.length != last_textures.length ||
		cur_animations.length != last_animations.length) {
		diff.structuralChange = true;
		return diff;
	}

	// UUID set match check (simplified: checking elements + groups is enough to detect structural change)
	let cur_el_uuids = new Set(cur_elements.map((e: any) => e.uuid));
	let last_el_uuids = new Set(last_elements.map((e: any) => e.uuid));
	if (cur_el_uuids.size != last_el_uuids.size ||
		![...cur_el_uuids].every(u => last_el_uuids.has(u))) {
		diff.structuralChange = true;
		return diff;
	}

	let cur_gr_uuids = new Set(cur_groups.map((g: any) => g.uuid));
	let last_gr_uuids = new Set(last_groups.map((g: any) => g.uuid));
	if (cur_gr_uuids.size != last_gr_uuids.size ||
		![...cur_gr_uuids].every(u => last_gr_uuids.has(u))) {
		diff.structuralChange = true;
		return diff;
	}

	// Structure unchanged, compare transform props: from/to/rotation/origin/name
	let last_el_map = new Map(last_elements.map((e: any) => [e.uuid, e]));
	for (let cur_el of cur_elements) {
		let last_el = last_el_map.get(cur_el.uuid);
		if (!last_el) continue;  // should not happen (UUID sets already matched)
		let changed: any = {};
		let has_change = false;
		// Compare key transform props (arrays/objects compared via JSON serialization for simplicity; can be optimized for production)
		for (let prop of ['from', 'to', 'origin', 'rotation', 'inflate', 'name', 'visibility', 'locked']) {
			if (JSON.stringify(cur_el[prop]) !== JSON.stringify(last_el[prop])) {
				changed[prop] = cur_el[prop];
				has_change = true;
			}
		}
		// faces changes (texture/UV edits) are also "non-structural" edits, include them in the transform diff
		if ((cur_el as any).faces && (last_el as any).faces && JSON.stringify((cur_el as any).faces) !== JSON.stringify((last_el as any).faces)) {
			changed.faces = (cur_el as any).faces;
			has_change = true;
		}
		if (has_change) diff.elementChanges.set(cur_el.uuid, changed);
	}

	// groups: compare name/origin/rotation
	let last_gr_map = new Map(last_groups.map((g: any) => [g.uuid, g]));
	for (let cur_gr of cur_groups) {
		let last_gr = last_gr_map.get(cur_gr.uuid);
		if (!last_gr) continue;
		let changed: any = {};
		let has_change = false;
		for (let prop of ['name', 'origin', 'rotation', 'visibility', 'locked']) {
			if (JSON.stringify(cur_gr[prop]) !== JSON.stringify(last_gr[prop])) {
				changed[prop] = cur_gr[prop];
				has_change = true;
			}
		}
		if (has_change) diff.groupChanges.set(cur_gr.uuid, changed);
	}

	return diff;
}

/**
 * Apply the transform diff: find existing instances in Outliner.elements/Group.all by UUID
 * and update their props directly (Object.assign), without clearing or rebuilding. Three.js nodes are updated in place, no flicker.
 *
 * [Popout] (#7.2) Undo sync: record the state before and after applying the remote diff, push it to the local Undo.history,
 * so Ctrl+Z in the main window can undo edits made in the child window. Only record changed elements/groups to avoid oversized entries.
 */
export function applyTransformDiff(diff: TransformDiff, createUndoEntry: boolean = true) {
	if (diff.structuralChange) {
		throw new Error('[applyTransformDiff] structural change detected, should fallback to full sync');
	}

	// [Popout] (#7.2) Undo: collect changed elements/groups into aspects.
	// **Key**: UndoSystem.save.fromState() expects aspects.elements/groups to be **instances**
	// (it calls obj.uuid / obj.getUndoCopy / group.getChildlessCopy), not UUID strings.
	// Must resolve instances by UUID first.
	let changed_element_instances = Array.from(diff.elementChanges.keys())
		.map(uuid => (OutlinerNode as any).uuids[uuid])
		.filter(Boolean);
	let changed_group_instances = Array.from(diff.groupChanges.keys())
		.map(uuid => (OutlinerNode as any).uuids[uuid])
		.filter(Boolean);
	let aspects: any = {};
	if (changed_element_instances.length > 0) aspects.elements = changed_element_instances;
	if (changed_group_instances.length > 0) aspects.groups = changed_group_instances;

	let before_save: any = null;
	if (createUndoEntry && (aspects.elements || aspects.groups)) {
		// snapshot before applying (before)
		before_save = new UndoSystem.save(aspects);
	}

	// [Popout] (#15) Decide exactly which aspects to refresh based on changed props, only updating the changed element,
	// no longer blindly calling updateAll* (which iterates every element in the scene and lags noticeably during high-frequency UV edits).
	//   from/to/origin/rotation/inflate -> transform + geometry
	//   faces                           -> faces + uv (UV editing changes exactly faces.uv)
	//   visibility                      -> visibility
	//   name/locked                     -> no 3D refresh needed
	let el_aspects = {transform: false, geometry: false, faces: false, uv: false, visibility: false, painting_grid: false};
	let faces_changed = false;

	// elements: write props in place first, accumulating the aspects that need refreshing
	for (let [uuid, props] of diff.elementChanges) {
		let el = (OutlinerNode as any).uuids[uuid];
		if (!el) continue;  // should not happen
		Object.assign(el, props);
		if ('from' in props || 'to' in props || 'origin' in props || 'rotation' in props || 'inflate' in props) {
			el_aspects.transform = true;
			el_aspects.geometry = true;
		}
		if ('faces' in props) {
			el_aspects.faces = true;
			el_aspects.uv = true;
			faces_changed = true;
		}
		if ('visibility' in props) {
			el_aspects.visibility = true;
		}
	}

	// groups: transform changes update their mesh in place via adaptObjectPosition
	for (let [uuid, props] of diff.groupChanges) {
		let gr = (OutlinerNode as any).uuids[uuid];
		if (!gr) continue;
		Object.assign(gr, props);
		if (gr.mesh) {
			Canvas.adaptObjectPosition(gr);
		}
	}

	// [Popout] (#15) Do a targeted updateView only for changed elements, avoiding a full-scene refresh.
	if (changed_element_instances.length > 0 &&
		(el_aspects.transform || el_aspects.geometry || el_aspects.faces || el_aspects.uv || el_aspects.visibility)) {
		Canvas.updateView({
			elements: changed_element_instances,
			element_aspects: el_aspects,
		} as any);
	}
	if (changed_group_instances.length > 0) {
		Canvas.updateAllBones(changed_group_instances);
	}

	// [Popout] (#15) Refresh the UV editor panel on faces/UV changes, otherwise the popout window's UV view
	// stays on stale data ("feels broken"). Only refresh when the UV panel exists and is initialized.
	if (faces_changed && typeof UVEditor != 'undefined' && (UVEditor as any).vue) {
		(UVEditor as any).loadData();
	}

	// [Popout] (#7.2) Undo: snapshot after applying (post), push to history
	if (createUndoEntry && before_save && (aspects.elements || aspects.groups)) {
		let post_save = new UndoSystem.save(aspects);
		let entry = {
			before: before_save,
			post: post_save,
			action: 'Remote Edit',  // the name the user sees in the undo list
			type: 'edit',
			time: Date.now()
		};
		if (Undo.history.length > Undo.index) {
			Undo.history.length = Undo.index;
		}
		Undo.history.push(entry);
		if (Undo.history.length > (settings as any).undo_limit.value) {
			Undo.history.shift();
		}
		Undo.index = Undo.history.length;
	}
}
