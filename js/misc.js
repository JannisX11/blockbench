var osfs = '/'
var uv_clipboard;
var pe_list_data = []
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

		if (Condition(BarItems.slider_face_tint)) {
			BarItems.slider_face_tint.update()
		}
	}
	if (Outliner.selected.length || (Format.bone_rig && Group.selected)) {
		BarItems.slider_origin_x.update()
		BarItems.slider_origin_y.update()
		BarItems.slider_origin_z.update()

		BarItems.slider_rotation_x.update()
		BarItems.slider_rotation_y.update()
		BarItems.slider_rotation_z.update()
		if (Format.bone_rig) {
			BarItems.bone_reset_toggle.setIcon(Group.selected && Group.selected.reset ? 'check_box' : 'check_box_outline_blank')
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
	Outliner.elements.forEach(obj => {
		if (selected.includes(obj) && !obj.selected && !obj.locked) {
			obj.selectLow()
		} else if ((!selected.includes(obj) || obj.locked) && obj.selected) {
			obj.unselect()
		}
		if (obj instanceof Mesh) {
			if (Project.selected_vertices[obj.uuid]) {
				Project.selected_vertices[obj.uuid].forEachReverse(vkey => {
					if (vkey in obj.vertices == false) {
						Project.selected_vertices[obj.uuid].remove(vkey);
					}
				})
			}
			if (Project.selected_vertices[obj.uuid] && (Project.selected_vertices[obj.uuid].length == 0 || !obj.selected)) {
				delete Project.selected_vertices[obj.uuid];
			}
		}
	})
	if (Modes.pose && !Group.selected && Outliner.selected[0] && Outliner.selected[0].parent instanceof Group) {
		Outliner.selected[0].parent.select();
	}
	if (Group.selected && Group.selected.locked) Group.selected.unselect()
	UVEditor.vue._computedWatchers.mappable_elements.run();

	Outliner.elements.forEach(element => {
		if (element.preview_controller.updateSelection) {
			element.preview_controller.updateSelection(element);
		}
	})
	for (var i = Outliner.selected.length-1; i >= 0; i--) {
		if (!selected.includes(Outliner.selected[i])) {
			Outliner.selected.splice(i, 1)
		}
	}
	if (Outliner.selected.length) {
		document.querySelectorAll('.selection_only').forEach(node => node.style.setProperty('visibility', 'visible'));
		if (Modes.edit && Toolbox.selected.id == 'resize_tool' && Format.meshes) {
			if (Mesh.selected.length) {
				Interface.removeSuggestedModifierKey('alt', 'modifier_actions.resize_both_sides');
				Interface.addSuggestedModifierKey('alt', 'modifier_actions.resize_one_side');
			} else {
				Interface.removeSuggestedModifierKey('alt', 'modifier_actions.resize_one_side');
				Interface.addSuggestedModifierKey('alt', 'modifier_actions.resize_both_sides');
			}
		}
	} else {
		if (Format.bone_rig && Group.selected) {
			document.querySelectorAll('.selection_only').forEach(node => node.style.setProperty('visibility', 'hidden'));
			document.querySelectorAll('.selection_only#panel_element').forEach(node => node.style.setProperty('visibility', 'visible'));
		} else {
			document.querySelectorAll('.selection_only').forEach(node => node.style.setProperty('visibility', 'hidden'));
			if (Outliner.selected.length) {
				document.querySelectorAll('.selection_only#panel_element').forEach(node => node.style.setProperty('visibility', 'visible'));
			}
		}
		if (Group.selected || (Outliner.selected[0] && Outliner.selected[0].constructor.animator)) {
			document.querySelectorAll('.selection_only#panel_bone').forEach(node => node.style.setProperty('visibility', 'visible'));
		}
		if (Modes.paint) {
			document.querySelectorAll('.selection_only#panel_uv').forEach(node => node.style.setProperty('visibility', 'visible'));
		}
	}
	if (UVEditor.vue.mode == 'face_properties' && Outliner.selected.length) {
		if (!Outliner.selected[0] || Outliner.selected[0].type !== 'cube' || Outliner.selected[0].box_uv) {
			UVEditor.vue.mode = 'uv';
		}
	}
	if (Outliner.selected.length || (Format.single_texture && Modes.paint)) {
		UVEditor.selected_faces.forEachReverse((fkey, i) => {
			if (!UVEditor.getMappableElements().find(el => el.faces[fkey])) {
				UVEditor.selected_faces.splice(i, 1);
			}
		})
		UVEditor.loadData()
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
		let selected_vertices = Mesh.selected[0].getSelectedVertices();
		Mesh.selected[0].forAllFaces((face) => {
			if (value == '') return;
			let vertices = face.getSortedVertices();
			vertices.forEach((vkey_a, i) => {
				let vkey_b = vertices[i+1] || vertices[0];
				if (selected_vertices.includes(vkey_a) && selected_vertices.includes(vkey_b)) {
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

	BARS.updateConditions();
	delete TickUpdates.selection;
	Blockbench.dispatchEvent('update_selection');
}
function selectAll() {
	if (Modes.animate) {
		selectAllKeyframes()
	} else if (Prop.active_panel == 'uv') {
		UVEditor.selectAll()

	} else if (Modes.edit && Mesh.selected.length && Mesh.selected.length === Outliner.selected.length && BarItems.selection_mode.value !== 'object') {
		let unselect = Mesh.selected[0].getSelectedVertices().length == Object.keys(Mesh.selected[0].vertices).length;
		Mesh.selected.forEach(mesh => {
			if (unselect) {
				delete Project.selected_vertices[mesh.uuid];
			} else {
				mesh.getSelectedVertices(true).replace(Object.keys(mesh.vertices));
			}
		})
		updateSelection();

	} else if (Modes.edit || Modes.paint) {
		let selectable_elements = Outliner.elements.filter(element => !element.locked);
		if (Outliner.selected.length < selectable_elements.length) {
			if (Outliner.root.length == 1 && !Outliner.root[0].locked) {
				Outliner.root[0].select();
			} else {
				selectable_elements.forEach(obj => {
					obj.selectLow()
				})
				TickUpdates.selection = true;
			}
		} else {
			unselectAll()
		}
	}
	Blockbench.dispatchEvent('select_all')
}
function unselectAll() {
	Project.selected_elements.forEachReverse(obj => obj.unselect())
	if (Group.selected) Group.selected.unselect()
	Group.all.forEach(function(s) {
		s.selected = false
	})
	for (let key in Project.selected_vertices) {
		delete Project.selected_vertices[key];
	}
	TickUpdates.selection = true;
}
//Backup
const AutoBackupModels = {};
setInterval(function() {
	if (Project && (Outliner.root.length || Project.textures.length)) {
		Validator.validate();
		try {
			var model = Codecs.project.compile({compressed: false, backup: true, raw: true});
			AutoBackupModels[Project.uuid] = model;
			localStorage.setItem('backup_model', JSON.stringify(AutoBackupModels));
		} catch (err) {
			console.error('Unable to create backup. ', err)
		}
	}
}, 1e3*30)
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
			if (TickUpdates.texture_list) {
				delete TickUpdates.texture_list;
				loadTextureDraggable();
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

const documentReady = new Promise((resolve, reject) => {
	$(document).ready(function() {
		resolve()
	})
});


const entityMode = {
	hardcodes: JSON.parse('{"geometry.chicken":{"body":{"rotation":[90,0,0]}},"geometry.llama":{"chest1":{"rotation":[0,90,0]},"chest2":{"rotation":[0,90,0]},"body":{"rotation":[90,0,0]}},"geometry.cow":{"body":{"rotation":[90,0,0]}},"geometry.sheep.sheared":{"body":{"rotation":[90,0,0]}},"geometry.sheep":{"body":{"rotation":[90,0,0]}},"geometry.phantom":{"body":{"rotation":[0,0,0]},"wing0":{"rotation":[0,0,5.7]},"wingtip0":{"rotation":[0,0,5.7]},"wing1":{"rotation":[0,0,-5.7]},"wingtip1":{"rotation":[0,0,-5.7]},"head":{"rotation":[11.5,0,0]},"tail":{"rotation":[0,0,0]},"tailtip":{"rotation":[0,0,0]}},"geometry.pig":{"body":{"rotation":[90,0,0]}},"geometry.ocelot":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.cat":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.turtle":{"eggbelly":{"rotation":[90,0,0]},"body":{"rotation":[90,0,0]}},"geometry.villager.witch":{"hat2":{"rotation":[-3,0,1.5]},"hat3":{"rotation":[-6,0,3]},"hat4":{"rotation":[-12,0,6]}},"geometry.pufferfish.mid":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.pufferfish.large":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.tropicalfish_a":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}},"geometry.tropicalfish_b":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}}}')
}
