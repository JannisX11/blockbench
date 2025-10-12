import { currentwindow } from "./native_apis";

window.osfs = '/'
window.open_dialog = false;
window.open_interface = false;
window.Format = 0;
window.Project = 0;

export const Pressing = {
	shift: false,
	ctrl: false,
	alt: false,
	overrides: {
		shift: false,
		ctrl: false,
		alt: false,
	}
}
export const Prop = {
	_active_panel	: 'preview',
	get active_panel() {
		return Prop._active_panel
	},
	set active_panel(panel) {
		let last_panel = Prop._active_panel;
		if (last_panel != panel) {
			Prop._active_panel = panel;
			Blockbench.dispatchEvent('change_active_panel', {last_panel, panel})
		}
	},
	file_path	  	: '',
	file_name	  	: '',
	recording		: null,
	fps				: 0,
	progress		: 0,
	session 		: false,
	connections 	: 0,
	facing		 	: 'north',
	show_right_bar  : true,
	show_left_bar   : true,
}

export const mouse_pos = {x:0,y:0}
export const sort_collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

export function canvasGridSize(shift, ctrl) {
	if (!shift && !ctrl) {
		return 16 / Math.clamp(settings.edit_size.value, 1, 512)
	} else if (ctrl && shift) {
		return 16 / Math.clamp(settings.ctrl_shift_size.value, 1, 4096)
	} else if (ctrl) {
		return 16 / Math.clamp(settings.ctrl_size.value, 1, 4096)
	} else {
		return 16 / Math.clamp(settings.shift_size.value, 1, 4096)
	}
}
export function updateNslideValues() {

	if (Outliner.selected.length) {
		BarItems.slider_pos_x.update()
		BarItems.slider_pos_y.update()
		BarItems.slider_pos_z.update()

		if (Condition(BarItems.slider_size_x)) {
			BarItems.slider_size_x.update()
			BarItems.slider_size_y.update()
			BarItems.slider_size_z.update()
		}

		if (Condition(BarItems.slider_inflate)) {
			BarItems.slider_inflate.update()
		}

		if (Condition(BarItems.slider_stretch_x)) {
			BarItems.slider_stretch_x.update()
			BarItems.slider_stretch_y.update()
			BarItems.slider_stretch_z.update()
		}

		if (Condition(BarItems.slider_face_tint)) {
			BarItems.slider_face_tint.update()
		}

		if (Condition(BarItems.slider_spline_handle_tilt)) {
			BarItems.slider_spline_handle_tilt.update()
			BarItems.slider_spline_handle_size.update()
		}
	}
	if (Outliner.selected.length || (Format.bone_rig && Group.first_selected)) {
		BarItems.slider_origin_x.update()
		BarItems.slider_origin_y.update()
		BarItems.slider_origin_z.update()

		BarItems.slider_rotation_x.update()
		BarItems.slider_rotation_y.update()
		BarItems.slider_rotation_z.update()
		if (Format.bone_rig) {
			BarItems.bone_reset_toggle.setIcon(Group.first_selected && Group.first_selected.reset ? 'check_box' : 'check_box_outline_blank')
		}
	}
	if (Texture.all.length) {
		BarItems.animated_texture_frame.update();
	}
}

//Selections
export function updateSelection(options = {}) {
	if (!Project) return;
	Project.elements.forEach(obj => {
		let included = Project.selected_elements.includes(obj);
		if (included && !obj.selected && !obj.locked) {
			obj.markAsSelected()
		} else if ((!included || obj.locked) && obj.selected) {
			obj.unselect()
			if (UVEditor.selected_element_faces[obj.uuid]) {
				delete UVEditor.selected_element_faces[obj.uuid];
			}
		}
		if (obj instanceof Mesh && Project.mesh_selection[obj.uuid]) {
			if (!included) {
				delete Project.mesh_selection[obj.uuid];
			} else {
				Project.mesh_selection[obj.uuid].vertices.forEachReverse(vkey => {
					if (vkey in obj.vertices == false) {
						Project.mesh_selection[obj.uuid].vertices.remove(vkey);
					}
				})
				Project.mesh_selection[obj.uuid].edges.forEachReverse(edge => {
					if (!obj.vertices[edge[0]] || !obj.vertices[edge[1]]) {
						Project.mesh_selection[obj.uuid].edges.remove(edge);
					}
				})
				Project.mesh_selection[obj.uuid].faces.forEachReverse(fkey => {
					if (fkey in obj.faces == false) {
						Project.mesh_selection[obj.uuid].faces.remove(fkey);
					}
				})
			}
		}
		if (obj instanceof SplineMesh && Project.spline_selection[obj.uuid]) {
			if (!included) {
				delete Project.spline_selection[obj.uuid];
			} else {
				Project.spline_selection[obj.uuid].vertices.forEachReverse(vkey => {
					if (vkey in obj.vertices == false) {
						Project.spline_selection[obj.uuid].vertices.remove(vkey);
					}
				})
			}
		}
	})
	if (Modes.pose && !Group.first_selected && Outliner.selected[0] && Outliner.selected[0].parent instanceof Group) {
		Outliner.selected[0].parent.select();
	}
	for (let group of Group.multi_selected) {
		if (group.locked) group.unselect()
	}
	UVEditor.vue._computedWatchers.mappable_elements.run();

	Project.elements.forEach(element => {
		if (element.preview_controller.updateSelection) {
			element.preview_controller.updateSelection(element);
		}
	})
	for (var i = Outliner.selected.length-1; i >= 0; i--) {
		if (!Project.elements.includes(Outliner.selected[i])) {
			Outliner.selected.splice(i, 1)
		}
	}
	if (Format.meshes && Outliner.selected.length && Modes.edit && Toolbox.selected.id == 'resize_tool') {
		if (Mesh.selected.length) {
			Interface.removeSuggestedModifierKey('alt', 'modifier_actions.resize_both_sides');
			Interface.addSuggestedModifierKey('alt', 'modifier_actions.resize_one_side');
		} else {
			Interface.removeSuggestedModifierKey('alt', 'modifier_actions.resize_one_side');
			Interface.addSuggestedModifierKey('alt', 'modifier_actions.resize_both_sides');
		}
	}
	if (Format.splines && Outliner.selected.length && Modes.edit && BarItems.spline_selection_mode.value == "handles") {
		if (SplineMesh.selected.length) {
			Interface.addSuggestedModifierKey('shift', 'modifier_actions.spline_select_multiple_points');
		}
	}
	if (UVEditor.vue.mode == 'face_properties' && Outliner.selected.length) {
		if (!Outliner.selected[0] || Outliner.selected[0].type !== 'cube' || Outliner.selected[0].box_uv) {
			UVEditor.vue.mode = 'uv';
		}
	}
	if (Condition(Panels.uv.condition)) {
		UVEditor.loadData();
	}
	if (Modes.animate) {
		updateKeyframeSelection();
		if (Timeline.selected_animator && !Timeline.selected_animator.selected) {
			Timeline.selected_animator = null;
		}
	}

	BarItems.cube_counter.update();
	updateNslideValues();
	Interface.status_bar.vue.updateSelectionInfo();
	if (settings.highlight_cubes.value || (Mesh.all[0])) updateCubeHighlights();
	if (Toolbox.selected.id == 'seam_tool' && Mesh.selected[0]) {
		let value;
		let selected_edges = Mesh.selected[0].getSelectedEdges();
		Mesh.selected[0].forAllFaces((face) => {
			if (value == '') return;
			let vertices = face.getSortedVertices();
			vertices.forEach((vkey_a, i) => {
				let vkey_b = vertices[i+1] || vertices[0];
				if (selected_edges.find(edge => sameMeshEdge(edge, [vkey_a, vkey_b]))) {
					let seam = Mesh.selected[0].getSeam([vkey_a, vkey_b]) || 'auto';
					if (value == undefined) {
						value = seam;
					} else if (value !== seam) {
						value = '';
					}
				}
			})
		});
		BarItems.select_seam.set(value || 'auto');
	}
	if (Format.cube_size_limiter?.updateBoxMarker) Format.cube_size_limiter.updateBoxMarker();
	Canvas.updatePivotMarker();
	Transformer.updateSelection();
	Preview.all.forEach(preview => {
		preview.updateAnnotations();
	})
	if (Condition(BarItems.layer_opacity.condition)) BarItems.layer_opacity.update();
	if (Condition(BarItems.layer_blend_mode.condition)) BarItems.layer_blend_mode.set(TextureLayer.selected?.blend_mode);

	BARS.updateConditions();
	MenuBar.update()
	delete TickUpdates.selection;
	Blockbench.dispatchEvent('update_selection');
}
export function unselectAllElements(exceptions) {
	Project.selected_elements.forEachReverse(obj => {
		if (exceptions instanceof Array && exceptions.includes(obj)) return;
		obj.unselect()
	})
	for (let group of Group.multi_selected) {
		group.unselect();
	}
	Group.all.forEach(function(s) {
		s.selected = false
	})
	Group.multi_selected.empty();
	for (let key in Project.mesh_selection) {
		delete Project.mesh_selection[key];
	}
	if (Modes.animate && Timeline.selected_animator) {
		Timeline.selected_animator.selected = false;
		Timeline.selected_animator = null;
	}
	TickUpdates.selection = true;
}
// Legacy functions
export function selectAll() {
	SharedActions.run('select_all');
}
export function unselectAll() {
	SharedActions.run('unselect_all');
}

//Backup
export const AutoBackup = {
	/**
	 * IndexedDB Database
	 * @type {IDBDatabase}
	 */
	db: null,
	initialize() {
		let request = indexedDB.open('auto_backups', 1);
		request.onerror = function(e) {
			console.error('Failed to load backup database', e);
		}
		request.onblocked = function(e) {
			console.error('Another instance of Blockbench is opened, the backup database cannot be upgraded at the moment');
		}
		request.onupgradeneeded = function() {
			let db = request.result;
			let store = db.createObjectStore('projects', {keyPath: 'uuid'});

			// Legacy system
			let backup_models = localStorage.getItem('backup_model')
			if (backup_models) {
				let parsed_backup_models = JSON.parse(backup_models);
				for (let uuid in parsed_backup_models) {
					let model = JSON.stringify(parsed_backup_models[uuid]);
					store.put({uuid, data: model});
				}
				console.log(`Upgraded ${Object.keys(parsed_backup_models).length} project back-ups to indexedDB`);
			}
		}
		request.onsuccess = async function() {
			AutoBackup.db = request.result;
			
			// Start Screen Message
			let has_backups = await AutoBackup.hasBackups();
			if (has_backups && (!isApp || !currentwindow.webContents.second_instance)) {

				let section = addStartScreenSection('recover_backup', {
					graphic: {type: 'icon', icon: 'fa-archive'},
					insert_before: 'start_files',
					text: [
						{type: 'h3', text: tl('message.recover_backup.title')},
						{text: tl('message.recover_backup.message')},
						{type: 'button', text: tl('message.recover_backup.recover'), click: (e) => {
							AutoBackup.recoverAllBackups().then(() => {
								section.delete();
							});
						}},
						{type: 'button', text: tl('dialog.discard'), click: (e) => {
							AutoBackup.removeAllBackups();
							section.delete();
						}}
					]
				})
			}

			AutoBackup.backupProjectLoop(false);
		}
	},
	async backupOpenProject() {
		if (!Project) return;
		let transaction = AutoBackup.db.transaction('projects', 'readwrite');
		let store = transaction.objectStore('projects');

		let model = Codecs.project.compile({compressed: false, backup: true, raw: true});
		let model_json = JSON.stringify(model)
		store.put({uuid: Project.uuid, data: model_json});
		
		await new Promise((resolve) => {
			transaction.oncomplete = resolve;
		})
	},
	async hasBackups() {
		let transaction = AutoBackup.db.transaction('projects', 'readonly');
		let store = transaction.objectStore('projects');
		return await new Promise(resolve => {
			let request = store.count();
			request.onsuccess = function() {
				resolve(!!request.result);
			}
			request.onerror = function(e) {
				console.error(e);
				resolve(false);
			}
		})
	},
	recoverAllBackups() {
		return new Promise((resolve, reject) => {
			let transaction = AutoBackup.db.transaction('projects', 'readonly');
			let store = transaction.objectStore('projects');
			let request = store.getAll();
			request.onsuccess = async function() {
				let projects = request.result;
				for (let project of projects) {
					try {
						let parsed_content = JSON.parse(project.data);
						setupProject(Formats[parsed_content.meta.model_format] || Formats.free, project.uuid);
						Codecs.project.parse(parsed_content, 'backup.bbmodel');
						await new Promise(r => setTimeout(r, 40));
					} catch(err) {
						console.error(err);
					}
				}
				resolve();
			}
			request.onerror = function(e) {
				console.error(e);
				reject(e);
			}
		})
		/*var backup_models = localStorage.getItem('backup_model')
		let parsed_backup_models = JSON.parse(backup_models);
		for (let uuid in parsed_backup_models) {
			AutoBackupModels[uuid] = parsed_backup_models[uuid];

			let model = parsed_backup_models[uuid];
			setupProject(Formats[model.meta.model_format] || Formats.free, uuid);
			Codecs.project.parse(model, 'backup.bbmodel')
		}*/
	},
	async removeBackup(uuid) {
		let transaction = AutoBackup.db.transaction('projects', 'readwrite');
		let store = transaction.objectStore('projects');
		let request = store.delete(uuid);
		
		return await new Promise((resolve, reject) => {
			request.onsuccess = resolve;
			request.onerror = function(e) {
				reject();
			}
		});
	},
	async removeAllBackups() {
		let transaction = AutoBackup.db.transaction('projects', 'readwrite');
		let store = transaction.objectStore('projects');
		let request = store.clear();
		
		return await new Promise((resolve, reject) => {
			request.onsuccess = resolve;
			request.onerror = function(e) {
				console.error(e);
				reject();
			}
		});
	},
	loop_timeout: null,
	backupProjectLoop(run_save = true) {
		if (run_save && Project && (Outliner.root.length || Project.textures.length)) {
			try {
				AutoBackup.backupOpenProject();
			} catch (err) {
				console.error('Unable to create backup. ', err)
			}
		}
		let interval = settings.recovery_save_interval.value;
		if (interval != 0) {
			interval = Math.max(interval, 5);
			AutoBackup.loop_timeout = setTimeout(() => AutoBackup.backupProjectLoop(true), interval * 1000);
		}
	}
}


setInterval(function() {
	if (Project && (Outliner.root.length || Project.textures.length)) {
		Validator.validate();
	}
}, 1e3*30);
//Misc
export const TickUpdates = {
	Run() {
		try {
			if (TickUpdates.selection) {
				delete TickUpdates.selection;
				updateSelection()
			}
			if (TickUpdates.UVEditor) {
				delete TickUpdates.UVEditor;
				UVEditor.loadData()
			}
			if (TickUpdates.keyframe_selection) {
				delete TickUpdates.keyframe_selection;
				Vue.nextTick(updateKeyframeSelection)
			}
			if (TickUpdates.keybind_conflicts) {
				delete TickUpdates.keybind_conflicts;
				updateKeybindConflicts();
			}
			if (TickUpdates.interface) {
				delete TickUpdates.interface;
				updateInterface();
			}
		} catch (err) {
			console.error(err);
		}
	}
}

export function factoryResetAndReload() {
	let lang_key = 'menu.help.developer.reset_storage.confirm';
	let result = window.confirm((window.tl && tl(lang_key) != lang_key) ? tl(lang_key) : 'Are you sure you want to reset Blockbench to factory settings? This will delete all custom settings, keybindings and installed plugins.');
	if (result) {
		localStorage.clear();
		Blockbench.addFlag('no_localstorage_saving');
		console.log('Cleared Local Storage');
		window.location.reload(true);
	}
}

export function benchmarkCode(id, iterations, code) {
	if (!iterations) iterations = 1000;
	console.time(id);
	for (let i = 0; i < iterations; i++) {
		code();
	}
	console.timeEnd(id);
}

export const documentReady = new Promise((resolve, reject) => {
	$(document).ready(function() {
		resolve()
	})
});


Object.assign(window, {
	Pressing,
	Prop,
	mouse_pos,
	sort_collator,
	canvasGridSize,
	updateNslideValues,
	updateSelection,
	unselectAllElements,
	selectAll,
	unselectAll,
	AutoBackup,
	TickUpdates,
	factoryResetAndReload,
	benchmarkCode
})
