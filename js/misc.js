var osfs = '/'
var uv_clipboard;
var open_dialog = false;
var open_interface = false;
var tex_version = 1;
var pe_list;
const Pressing = {
	shift: false,
	ctrl: false,
	alt: false,
	overrides: {
		shift: false,
		ctrl: false,
		alt: false,
	}
}
var Prop = {
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

const mouse_pos = {x:0,y:0}
const sort_collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

function canvasGridSize(shift, ctrl) {
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
function updateNslideValues() {

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
		} else {
			BarItems.rescale_toggle.setIcon(Outliner.selected[0].rescale ? 'check_box' : 'check_box_outline_blank')
		}
	}
	if (Texture.all.length) {
		BarItems.animated_texture_frame.update();
	}
}

//Selections
function updateSelection(options = {}) {
	if (!Project) return;
	Project.elements.forEach(obj => {
		let included = Project.selected_elements.includes(obj);
		if (included && !obj.selected && !obj.locked) {
			obj.selectLow()
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
function unselectAllElements(exceptions) {
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
	TickUpdates.selection = true;
}
// Legacy functions
function selectAll() {
	SharedActions.run('select_all');
}
function unselectAll() {
	SharedActions.run('unselect_all');
}

//Backup
const AutoBackup = {
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
					color: 'var(--color-back)',
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

		let model = Codecs.project.compile({compressed: false, backup: true, raw: false});
		store.put({uuid: Project.uuid, data: model});
		
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
const TickUpdates = {
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

function factoryResetAndReload() {
	let lang_key = 'menu.help.developer.reset_storage.confirm';
	let result = window.confirm((window.tl && tl(lang_key) != lang_key) ? tl(lang_key) : 'Are you sure you want to reset Blockbench to factory settings? This will delete all custom settings, keybindings and installed plugins.');
	if (result) {
		localStorage.clear();
		Blockbench.addFlag('no_localstorage_saving');
		console.log('Cleared Local Storage');
		window.location.reload(true);
	}
}

function benchmarkCode(id, iterations, code) {
	if (!iterations) iterations = 1000;
	console.time(id);
	for (let i = 0; i < iterations; i++) {
		code();
	}
	console.timeEnd(id);
}

const documentReady = new Promise((resolve, reject) => {
	$(document).ready(function() {
		resolve()
	})
});


const entityMode = {
	hardcodes: JSON.parse('{"geometry.chicken":{"body":{"rotation":[90,0,0]}},"geometry.llama":{"chest1":{"rotation":[0,90,0]},"chest2":{"rotation":[0,90,0]},"body":{"rotation":[90,0,0]}},"geometry.cow":{"body":{"rotation":[90,0,0]}},"geometry.sheep.sheared":{"body":{"rotation":[90,0,0]}},"geometry.sheep":{"body":{"rotation":[90,0,0]}},"geometry.phantom":{"body":{"rotation":[0,0,0]},"wing0":{"rotation":[0,0,5.7]},"wingtip0":{"rotation":[0,0,5.7]},"wing1":{"rotation":[0,0,-5.7]},"wingtip1":{"rotation":[0,0,-5.7]},"head":{"rotation":[11.5,0,0]},"tail":{"rotation":[0,0,0]},"tailtip":{"rotation":[0,0,0]}},"geometry.pig":{"body":{"rotation":[90,0,0]}},"geometry.ocelot":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.cat":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.turtle":{"eggbelly":{"rotation":[90,0,0]},"body":{"rotation":[90,0,0]}},"geometry.villager.witch":{"hat2":{"rotation":[-3,0,1.5]},"hat3":{"rotation":[-6,0,3]},"hat4":{"rotation":[-12,0,6]}},"geometry.pufferfish.mid":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.pufferfish.large":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.tropicalfish_a":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}},"geometry.tropicalfish_b":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}}}')
}
