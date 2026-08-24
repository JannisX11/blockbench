// [Popout] Cross-window data sync -- replace ModelProject content in place / lightweight selection sync.
//
// Ported from a verified spike (behemiron-blockbench-cross-window-sync):
// doing cross-window sync with Codecs.project.load() semantics ("build from scratch")
// causes ModelProject.all to pile up and Three.js resources to leak; instead we "replace
// existing ModelProject content in place", reusing each type's own remove() (the same path
//
// Scope (intentionally narrowed, matching the reference project): covers elements/groups/
// outliner/textures/animations + basic selection. Does not handle animation_controllers/
// collections/display/reference_images/export_options/history -- in the popout scenario these
// do not need real-time two-way sync (users typically do single-panel/preview-related work in a popout).
import { ModelProject } from './project';
import { Group } from '../outliner/types/group';
import { Outliner } from '../outliner/outliner';
import { Texture } from '../texturing/textures';
import { Animation } from '../animations/animation';
import { Canvas } from '../preview/canvas';
import { OutlinerElement } from '../outliner/abstract/outliner_element';
import { TickUpdates } from '../misc';

/**
 * Force a freshly Codecs.project.load()-ed project back to the stable uuid from the snapshot.
 * BB's load goes through setupProject() and generates a brand-new random uuid, not the one in the model,
 * so we must change it back immediately after load, otherwise later uuid-matched in-place sync never hits.
 *
 * **Key**: ModelProject's constructor creates an entry in the global ProjectData dictionary keyed by the current uuid
 * (model_3d: THREE.Object3D / nodes_3d: {}), and the getters for Project.model_3d/nodes_3d
 * are `ProjectData[this.uuid].model_3d`. Changing Project.uuid without migrating the
 * ProjectData key would make `scene.remove(this.model_3d)` in close()/unselect()
 * read undefined and throw. Here we rename the old key to the new key, fully preserving the bound THREE nodes.
 */
function rebindProjectUuid(stable_uuid: string) {
	if (!stable_uuid || !Project || Project.uuid === stable_uuid) return;
	const old_uuid = Project.uuid;
	Project.uuid = stable_uuid;
	if (ProjectData && Object.prototype.hasOwnProperty.call(ProjectData, old_uuid)) {
		ProjectData[stable_uuid] = ProjectData[old_uuid];
		delete ProjectData[old_uuid];
	}
}

/**
 * Replace target project content in place. target is matched by model.uuid against an existing
 * instance in ModelProject.all; if the target project does not exist yet (the popout window's first
 * snapshot), fall back to a full Codecs.project.load() from scratch and rebind the uuid to the snapshot's uuid,
 * so subsequent incremental syncs hit the in-place replacement path.
 */
export function replaceProjectContentInPlace(model: any): boolean {
	let target = ModelProject.all.find((p: any) => p.uuid === model.uuid);
	if (!target) {
		// [Popout] First sync: this window does not have the project yet -> build from scratch with the standard load.
		// load creates a new ModelProject and select()s it, then we align the uuid to the snapshot,
		// ensuring the next snapshot of the same project takes the in-place replacement branch below.
		Codecs.project.load(model, {path: '', no_file: true} as any);
		if (model.uuid) rebindProjectUuid(model.uuid);
		return true;
	}

	const previously_selected = Project;
	target.select();

	// ---- 1. Clear existing content ----
	Group.all.filter((g: any) => !(g.parent instanceof Group)).slice().forEach((g: any) => g.remove(false));
	Outliner.elements.filter((el: any) => !(el.parent instanceof Group)).slice().forEach((el: any) => el.remove(false));
	Texture.all.slice().forEach((tex: any) => tex.remove(true));
	Animation.all.slice().forEach((ani: any) => ani.remove(false, false));

	// ---- 2. Re-populate following the same logic as bbmodel.js parse() ----
	if (model.textures) {
		model.textures.forEach((tex: any) => {
			const tex_copy = new (Texture as any)(tex, tex.uuid).add(false);
			if (tex.source && tex.source.substr(0, 5) === 'data:') {
				tex_copy.fromDataURL(tex.source);
			}
		});
	}
	if (model.elements) {
		const default_texture = (Texture as any).getDefault();
		model.elements.forEach((template: any) => {
			const copy: any = (OutlinerElement as any).fromSave(template, true);
			for (const face in copy.faces) {
				if (!Project.format.single_texture && template.faces) {
					const texture = template.faces[face].texture !== null && Texture.all[template.faces[face].texture];
					if (texture) copy.faces[face].texture = texture.uuid;
				} else if (default_texture && copy.faces && copy.faces[face].texture !== null && !Project.format.single_texture_default) {
					copy.faces[face].texture = default_texture.uuid;
				}
			}
			copy.init();
		});
	}
	if (model.groups) {
		model.groups.forEach((template: any) => new (Group as any)(template, template.uuid).init());
	}
	if (model.outliner) {
		(Outliner as any).loadJSON(model.outliner);
	}
	if (model.animations) {
		model.animations.forEach((ani: any) => {
			const base_ani: any = new (Animation as any)();
			base_ani.uuid = ani.uuid;
			base_ani.extend(ani).add();
		});
	}

	(Canvas as any).updateAllBones();
	(Canvas as any).updateAllPositions();
	(Canvas as any).updateAllFaces();

	// ---- 3. Selection (lightweight) ----
	if (model.editor_state) {
		const state = model.editor_state;
		Project.selected_elements = [];
		(state.selected_elements || []).forEach((uuid: string) => {
			const el = Outliner.elements.find((el2: any) => el2.uuid === uuid);
			if (el) Project.selected_elements.push(el);
		});
		if (state.selected_groups) {
			Group.multi_selected = state.selected_groups
				.map((uuid: string) => Group.all.find((g: any) => g.uuid === uuid))
				.filter((g: any) => g instanceof Group);
		}
		// Only change the raw data Project.selected_elements/Group.multi_selected,
		// letting the next animate()'s TickUpdates.Run() trigger updateSelection(),
		// consistent with how BB's own "delete"/"duplicate" operations finalize selection changes.
		TickUpdates.selection = true;
	}

	// Restore the active project from before the call, so "applying sync" does not accidentally switch away from the tab the user is currently viewing.
	if (previously_selected && previously_selected !== target && ModelProject.all.includes(previously_selected)) {
		previously_selected.select();
	}

	return true;
}

/**
 * Lightweight selection sync: only change the Project.selected_elements / Group.multi_selected references +
 * trigger updateSelection() to finalize, without going through replaceProjectContentInPlace's "clear and reload".
 * If selection changes (clicking outliner nodes / picking in the 3D viewport) also went through a full reload, there would be visible flicker
 * and unnecessary overhead -- when both sides' project structure is unchanged, updating in place is enough.
 */
export function applySelectionOnly(elementUuids: string[], groupUuids: string[]): boolean {
	if (!Project) return false;
	Project.selected_elements = Outliner.elements.filter((el: any) => elementUuids.includes(el.uuid));
	Group.multi_selected = Group.all.filter((g: any) => groupUuids.includes(g.uuid));
	TickUpdates.selection = true;
	return true;
}
