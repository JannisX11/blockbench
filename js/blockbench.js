var osfs = '/'
var selected = [];
var prev_side = 'north';
var uv_clipboard;
var outliner, texturelist;
var pe_list_data = []
var open_dialog = false;
var open_interface = false;
var tex_version = 1;
var pe_list;
const Pressing = {
	shift: false,
	ctrl: false,
	alt: false,
}
var main_uv;
var Prop = {
	active_panel	: 'preview',
	wireframe	  	: false,
	file_path	  	: '',
	file_name	  	: '',
	added_models 	: 0,
	recording		: null,
	project_saved 	: true,
	fps				: 0,
	zoom			: 100,
	progress		: 0,
	session 		: false,
	connections 	: 0,
	facing		 	: 'north'
}
const Project = {
	name			: '',
	parent			: '',
	geometry_name	: '',
	description	   	: '',
	_box_uv 		: false,
	get box_uv() {return Project._box_uv},
	set box_uv(v) {
		if (Project._box_uv != v) {
			Project._box_uv = v;
			switchBoxUV(v);
		}
	},
	get texture_width() {return Project._texture_width},
	get texture_height() {return Project._texture_height},
	set texture_width(n) {
		n = parseInt(n)||16
		Vue.nextTick(updateProjectResolution)
		Project._texture_width = n;
	},
	set texture_height(n) {
		n = parseInt(n)||16
		Vue.nextTick(updateProjectResolution)
		Project._texture_height = n;
	},
	_texture_width	: 16,
	_texture_height	: 16,
	ambientocclusion: true,
	front_gui_light: false,
	get optional_box_uv() {
		return Format.optional_box_uv;
	}
}
const mouse_pos = {x:0,y:0}
const sort_collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

$.ajaxSetup({ cache: false });

function onVueSetup(func) {
	if (!onVueSetup.funcs) {
		onVueSetup.funcs = []
	}
	onVueSetup.funcs.push(func)
}
function canvasGridSize(shift, ctrl) {
	if (!shift && !ctrl) {
		return 16 / limitNumber(settings.edit_size.value, 1, 512)
	} else if (ctrl && shift) {
		var basic = 16 / limitNumber(settings.edit_size.value, 1, 512)
		var control = 16 / limitNumber(settings.ctrl_size.value, 1, 4096)
		var shift = 16 / limitNumber(settings.shift_size.value, 1, 4096)
		control = basic / control
		return shift / control
	} else if (ctrl) {
		return 16 / limitNumber(settings.ctrl_size.value, 1, 4096)
	} else {
		return 16 / limitNumber(settings.shift_size.value, 1, 4096)
	}
}
function updateNslideValues() {

	if (selected.length) {
		BarItems.slider_pos_x.update()
		BarItems.slider_pos_y.update()
		BarItems.slider_pos_z.update()

		BarItems.slider_size_x.update()
		BarItems.slider_size_y.update()
		BarItems.slider_size_z.update()

		BarItems.slider_inflate.update()
	}
	if (selected.length || (Format.bone_rig && Group.selected)) {
		BarItems.slider_origin_x.update()
		BarItems.slider_origin_y.update()
		BarItems.slider_origin_z.update()

		BarItems.slider_rotation_x.update()
		BarItems.slider_rotation_y.update()
		BarItems.slider_rotation_z.update()
		if (Format.bone_rig) {
			BarItems.bone_reset_toggle.setIcon(Group.selected && Group.selected.reset ? 'check_box' : 'check_box_outline_blank')
		} else {
			BarItems.rescale_toggle.setIcon(selected[0].rescale ? 'check_box' : 'check_box_outline_blank')
		}
	}
	if (Modes.animate && Group.selected) {
		//BarItems.slider_ik_chain_length.update();
		//BarItems.ik_enabled.setIcon(Group.selected.ik_enabled ? 'check_box' : 'check_box_outline_blank')
	}
}
function setProjectResolution(width, height, modify_uv) {
	if (Project.texture_width / width != Project.texture_width / height) {
		modify_uv = false;
	}

	Undo.initEdit({uv_mode: true, elements: Cube.all, uv_only: true})

	let old_res = {
		x: Project.texture_width,
		y: Project.texture_height
	}
	Project.texture_width = width;
	Project.texture_height = height;


	if (modify_uv) {
		var multiplier = [
			Project.texture_width/old_res.x,
			Project.texture_height/old_res.y
		]
		function shiftCube(cube, axis) {
			if (Project.box_uv) {
				obj.uv_offset[axis] *= multiplier[axis];
			} else {
				for (var face in cube.faces) {
					var uv = cube.faces[face];
					uv[axis] *= multiplier[axis];
					uv[axis+2] *= multiplier[axis];
				}
			}
		}
		if (old_res.x != Project.texture_width && Math.areMultiples(old_res.x, Project.texture_width)) {
			Cube.all.forEach(cube => shiftCube(cube, 0));
		}
		if (old_res.y != Project.texture_height &&  Math.areMultiples(old_res.x, Project.texture_width)) {
			Cube.all.forEach(cube => shiftCube(cube, 1));
		}
	}
	Undo.finishEdit('Changed project resolution')
	Canvas.updateAllUVs()
	if (selected.length) {
		main_uv.loadData()
	}
}
function updateProjectResolution() {
	$('#project_resolution_status').text(`${Project.texture_width} ⨉ ${Project.texture_height}`);
}

//Selections
function updateSelection() {
	elements.forEach(obj => {
		if (selected.includes(obj) && !obj.selected) {
			obj.selectLow()
		} else if (!selected.includes(obj) && obj.selected) {
			obj.unselect()
		}
	})

	Cube.all.forEach(cube => {
		if (cube.visibility) {
			var mesh = cube.mesh
			if (mesh && mesh.outline) {
				mesh.outline.visible = cube.selected
			}
		}
	})
	for (var i = Cube.selected.length-1; i >= 0; i--) {
		if (!selected.includes(Cube.selected[i])) {
			Cube.selected.splice(i, 1)
		}
	}
	if (Cube.selected.length) {
		$('.selection_only').css('visibility', 'visible')
	} else {
		if (Format.bone_rig && Group.selected) {
			$('.selection_only').css('visibility', 'hidden')
			$('.selection_only#element').css('visibility', 'visible')
		} else {
			$('.selection_only').css('visibility', 'hidden')
			if (Locator.selected.length) {
				$('.selection_only#element').css('visibility', 'visible')
			}
		}
		if (Format.single_texture && Modes.paint) {
			$('.selection_only#uv').css('visibility', 'visible')
		}
	}
	if (Cube.selected.length || (Format.single_texture && Modes.paint)) {
		main_uv.jquery.size.find('.uv_mapping_overlay').remove()
		main_uv.loadData()
	}
	if (Modes.animate) {
		updateKeyframeSelection();
	}

	BarItems.cube_counter.update();
	updateNslideValues();
	Blockbench.globalMovement = isMovementGlobal();
	updateCubeHighlights();
	Canvas.updateOrigin();
	Transformer.updateSelection();
	Transformer.update();
	previews.forEach(preview => {
		preview.updateAnnotations();
	})

	BARS.updateConditions();
	delete TickUpdates.selection;
	Blockbench.dispatchEvent('update_selection');
}
function selectAll() {
	if (Modes.animate) {
		selectAllKeyframes()
	} else if (Modes.edit || Modes.paint) {
		if (selected.length < elements.length) {
			elements.forEach(obj => {
				obj.selectLow()
			})
			updateSelection()
		} else {
			unselectAll()
		}
	}
	Blockbench.dispatchEvent('select_all')
}
function unselectAll() {
	selected.forEachReverse(obj => obj.unselect())
	if (Group.selected) Group.selected.unselect()
	Group.all.forEach(function(s) {
		s.selected = false
	})
	updateSelection()
}
function createSelection() {
	if ($('#selgen_new').is(':checked')) {
		selected.length = 0
	}
	if (Group.selected) {
		Group.selected.unselect()
	}
	var name_seg = $('#selgen_name').val().toUpperCase()
	var tex_seg = $('#selgen_texture').val().toLowerCase()
	var rdm = $('#selgen_random').val()/100

	var array = elements
	if ($('#selgen_group').is(':checked') && Group.selected) {
		array = Group.selected.children
	}

	array.forEach(function(obj) {
		if (obj.name.toUpperCase().includes(name_seg) === false) return;
		if (obj instanceof Cube && tex_seg && !Format.single_texture) {
			var has_tex = false;
			for (var key in obj.faces) {
				var tex = obj.faces[key].getTexture();
				if (tex && tex.name.includes(tex_seg)) {
					has_tex = true
				}
			}
			if (!has_tex) return;
		}
		if (Math.random() > rdm) return;
		selected.push(obj)
	})
	updateSelection()
	if (selected.length) {
		selected[0].showInOutliner()
	}
	hideDialog()
}
//Modes
class Mode extends KeybindItem {
	constructor(data) {
		super(data)
		this.id = data.id;
		this.name = data.name || tl('mode.'+this.id);
		this.selected = false
		this.default_tool = data.default_tool;
		this.center_windows = data.center_windows||['preview'];
		this.selectCubes = data.selectCubes !== false
		this.hide_toolbars = data.hide_toolbars
		this.condition = data.condition;
		this.onSelect = data.onSelect;
		this.onUnselect = data.onUnselect;
		Modes.options[this.id] = this;
	}
	select() {
		var scope = this;
		if (Modes.selected) {
			delete Modes[Modes.selected.id];
			Modes.previous_id = Modes.selected.id;
		}
		if (typeof Modes.selected.onUnselect === 'function') {
			Modes.selected.onUnselect()
		}
		if (Modes.selected.selected) {
			Modes.selected.selected = false
		}
		this.selected = true;
		Modes.id = this.id
		Modes.selected = this;
		Modes[Modes.selected.id] = true;

		document.body.setAttribute('mode', this.id);

		$('#center > #preview').toggle(this.center_windows.includes('preview'));
		$('#center > #timeline').toggle(this.center_windows.includes('timeline'));
		$('#center > #start_screen').toggle(this.center_windows.includes('start_screen'));

		if (this.hide_toolbars) {
			$('#main_toolbar .toolbar_wrapper').css('visibility', 'hidden')
		} else {
			$('#main_toolbar .toolbar_wrapper').css('visibility', 'visible')
		}

		if (typeof this.onSelect === 'function') {
			this.onSelect()
		}

		updateInterface()
		Canvas.updateRenderSides()
		if (BarItems[this.default_tool]) {
			BarItems[this.default_tool].select()
		} else {
			BarItems.move_tool.select()
		}
		updateSelection()
	}
	trigger() {
		if (Condition(this.condition)) {
			this.select()
		}
	}
}
const Modes = {
	id: 'edit',
	selected: false,
	options: {},
};
onVueSetup(function() {
	Modes.vue = new Vue({
		el: '#mode_selector',
		data: {
			options: Modes.options
		}
	})
});
BARS.defineActions(function() {
	new Mode({
		id: 'start',
		category: 'navigate',
		center_windows: ['start_screen'],
		hide_toolbars: true,
		onSelect: function () {
		},
		onUnselect: function () {
		}
	})
	new Mode({
		id: 'edit',
		default_tool: 'move_tool',
		category: 'navigate',
		condition: () => Format,
		keybind: new Keybind({key: 49})
	})
	new Mode({
		id: 'paint',
		default_tool: 'brush_tool',
		category: 'navigate',
		condition: () => Format,
		keybind: new Keybind({key: 50}),
		onSelect: () => {
			if (Modes.previous_id == 'animate') {
				Animator.preview();
			}
			Cube.all.forEach(cube => {
				Canvas.buildGridBox(cube)
			})
			$('#main_colorpicker').spectrum('set', ColorPanel.vue._data.main_color);
			BarItems.slider_color_h.update();
			BarItems.slider_color_s.update();
			BarItems.slider_color_v.update();

		},
		onUnselect: () => {
			Cube.all.forEach(cube => {
				Canvas.buildGridBox(cube)
			})
		},
	})
	new Mode({
		id: 'display',
		selectCubes: false,
		default_tool: 'move_tool',
		category: 'navigate',
		keybind: new Keybind({key: 51}),
		condition: () => Format.display_mode,
		onSelect: () => {
			enterDisplaySettings()
		},
		onUnselect: () => {
			exitDisplaySettings()
		},
	})
	new Mode({
		id: 'animate',
		default_tool: 'move_tool',
		category: 'navigate',
		center_windows: ['preview', 'timeline'],
		keybind: new Keybind({key: 52}),
		condition: () => Format.animation_mode,
		onSelect: () => {
			Animator.join()
		},
		onUnselect: () => {
			Animator.leave()
		}
	})
	//Update to 3.2.0
	if (Modes.options.animate.keybind.key == 51) {
		Modes.options.animate.keybind.set({key: 52})
	}
})
//Backup
setInterval(function() {
	if (Outliner.root.length || textures.length) {
		try {
			var model = Codecs.project.compile();
			localStorage.setItem('backup_model', model)
		} catch (err) {
			console.log('Unable to create backup. ', err)
		}
	}
}, 1e3*30)
//Misc
const TickUpdates = {
	Run() {
		if (TickUpdates.outliner) {
			delete TickUpdates.outliner;
			loadOutlinerDraggable()
		}
		if (TickUpdates.selection) {
			delete TickUpdates.selection;
			updateSelection()
		}
		if (TickUpdates.main_uv) {
			delete TickUpdates.main_uv;
			main_uv.loadData()
		}
		if (TickUpdates.texture_list) {
			delete TickUpdates.texture_list;
			loadTextureDraggable();
		}
		if (TickUpdates.keyframes) {
			delete TickUpdates.keyframes;
			Vue.nextTick(Timeline.update)
		}
		if (TickUpdates.keyframe_selection) {
			delete TickUpdates.keyframe_selection;
			Vue.nextTick(updateKeyframeSelection)
		}
		if (TickUpdates.keybind_conflicts) {
			delete TickUpdates.keybind_conflicts;
			updateKeybindConflicts();
		}
	}
}

const FormatWizard = {
	start() {
		var dialog_1 = new Dialog({
			id: 'format_wizard_1',
			title: 'format_wizard.title',
			width: 540,
			form: {
				question: {type: 'text', text: 'Which platform do you want to create a model for?'},
				platform: {label: 'dialog.radio', type: 'radio', options: {
					'mcj': 'Minecraft: Java Edition',
					'mcbe': 'Minecraft: Bedrock Edition',
					'obj': 'Game Engine'
				}},
			},
			onConfirm: function(formResult1) {
				if (formResult1.platform == 'obj') {

					FormatWizard.result('free');

				} else if (formResult1.platform == 'mcbe') {
					var types = {
						block: 'format_wizard.type.block',
						item: 'format_wizard.type.item',
						entity: 'format_wizard.type.entity',
					}
				} else {
					var types = {
						block: 'format_wizard.type.block',
						item: 'format_wizard.type.item',
						entity: 'format_wizard.type.entity',
						armor: 'format_wizard.type.armor',
					}
				}
				var dialog_2 = new Dialog({
					id: 'format_wizard_2',
					title: 'format_wizard.title',
					width: 540,
					form: {
						question: {type: 'text', text: 'What type of model do you want to edit?'},
						type: {label: 'dialog.radio', type: 'radio', options: types},
					},
					onConfirm: function(formResult2) {
						if (formResult1.platform == 'mcj' && (formResult2.type == 'entity' || formResult2.type == 'armor')) {

							var dialog_3 = new Dialog({
								id: 'format_wizard_3',
								title: 'format_wizard.title',
								width: 540,
								form: {
									question: {type: 'text', text: 'What do you want to create the model for?'},
									product: {label: 'dialog.radio', type: 'radio', options: {
										vanilla: '',
										optifine: '',
										modded: '',
									}},
								},
								onConfirm: function(formResult3) {
									switch (formResult3.product) {
										case 'vanilla':
											FormatWizard.result(''); break;
										case 'optifine':
											FormatWizard.result(formResult2.type == 'armor' ? 'java_armor' : 'optifine_entity'); break;
										case 'modded': default:
											FormatWizard.result('modded_entity'); break;
									}
								}
							}).show();
						} else if (formResult1.platform == 'mcj') {
							FormatWizard.result('java_block');
						} else {
							switch (formResult2.type) {
								case 'block':
									FormatWizard.result('not_supported_yet'); break;
								case 'item':
									FormatWizard.result('not_supported_yet'); break;
								default:
									FormatWizard.result('bedrock'); break;
							}
						}
					}
				}).show();
			}
		}).show();
	},
	result(result) {

	}
}

const entityMode = {
	hardcodes: {"geometry.chicken":{"body":{"rotation":[90,0,0]}},"geometry.llama":{"chest1":{"rotation":[0,90,0]},"chest2":{"rotation":[0,90,0]},"body":{"rotation":[90,0,0]}},"geometry.cow":{"body":{"rotation":[90,0,0]}},"geometry.sheep.sheared":{"body":{"rotation":[90,0,0]}},"geometry.sheep":{"body":{"rotation":[90,0,0]}},"geometry.phantom":{"body":{"rotation":[0,0,0]},"wing0":{"rotation":[0,0,5.7]},"wingtip0":{"rotation":[0,0,5.7]},"wing1":{"rotation":[0,0,-5.7]},"wingtip1":{"rotation":[0,0,-5.7]},"head":{"rotation":[11.5,0,0]},"tail":{"rotation":[0,0,0]},"tailtip":{"rotation":[0,0,0]}},"geometry.pig":{"body":{"rotation":[90,0,0]}},"geometry.ocelot":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.cat":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.turtle":{"eggbelly":{"rotation":[90,0,0]},"body":{"rotation":[90,0,0]}},"geometry.villager.witch":{"hat2":{"rotation":[-3,0,1.5]},"hat3":{"rotation":[-6,0,3]},"hat4":{"rotation":[-12,0,6]}},"geometry.pufferfish.mid":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.pufferfish.large":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.tropicalfish_a":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}},"geometry.tropicalfish_b":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}}},
}
