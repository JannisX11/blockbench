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
			switchAutoUV(v);
		}
	},
	texture_width	: 16,
	texture_height	: 16,
	ambientocclusion: true,
	get optional_box_uv() {
		return Format.optional_box_uv;
	}
}
const mouse_pos = {x:0,y:0}
const sort_collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

$.ajaxSetup({ cache: false });


function initializeApp() {
	//Browser Detection
	Blockbench.browser = 'electron'
	if (isApp === false) {
		if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
			Blockbench.browser = 'firefox'
		} else if (!!window.chrome && !!window.chrome.webstore) {
			Blockbench.browser = 'chrome'
		} else if ((!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0) {
			Blockbench.browser = 'opera'
		} else if (/constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification))) {
			Blockbench.browser = 'safari'
		} else if (!!document.documentMode) {
			Blockbench.browser = 'internet_explorer'
		} else if (!!window.StyleMedia) {
			Blockbench.browser = 'edge'
		}
		if (navigator.appVersion.indexOf("Win") != -1) 	OSName = 'Windows';
		if (navigator.appVersion.indexOf("Mac") != -1) 	OSName = 'MacOS';
		if (navigator.appVersion.indexOf("Linux") != -1)OSName = 'Linux';
		if (['edge', 'internet_explorer'].includes(Blockbench.browser)) {
			alert(capitalizeFirstLetter(Blockbench.browser)+' does not support Blockbench')
		}
		$('.local_only').remove()
	} else {
		$('.web_only').remove()
	}
	if (localStorage.getItem('welcomed_version') != appVersion) {
		Blockbench.addFlag('after_update')
		localStorage.setItem('welcomed_version', appVersion)
	}
	BARS.setupActions()
	BARS.setupToolbars()
	BARS.setupVue()
	MenuBar.setup()

	//Misc
	translateUI()
	console.log('Blockbench ' + appVersion + (isApp
		? (' Desktop (' + Blockbench.operating_system +')')
		: (' Web ('+capitalizeFirstLetter(Blockbench.browser)+')')
	))
	var startups = parseInt(localStorage.getItem('startups')||0);
	localStorage.setItem('startups', startups+1);


	if (isApp) {
		updateRecentProjects()
	}
	
	setInterval(function() {
		Prop.fps = framespersecond;
		framespersecond = 0;
	}, 1000)

	main_uv = new UVEditor('main_uv', false, true)
	main_uv.setToMainSlot()

	onVueSetup.funcs.forEach((func) => {
		if (typeof func === 'function') {
			func()
		}
	})

//JQuery UI
	$('#cubes_list').droppable({
		greedy: true,
		accept: 'div.outliner_object',
		tolerance: 'pointer',
		hoverClass: 'drag_hover',
		drop: function(event, ui) {
			var item = Outliner.root.findRecursive('uuid', $(ui.draggable).parent().attr('id'))
			dropOutlinerObjects(item, undefined, event)
		}
	})
	$('#cubes_list').contextmenu(function(event) {
		event.stopPropagation();
		event.preventDefault();
		Interface.Panels.outliner.menu.show(event)
	})
	$('#texture_list').contextmenu(function(event) {
		Interface.Panels.textures.menu.show(event)
	})

	setupInterface()
	setupDragHandlers()
	Modes.options.start.select()
	Blockbench.setup_successful = true

}
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
}
function setProjectResolution(width, height, modify_uv) {
	let old_res = {
		x: Project.texture_width,
		y: Project.texture_height
	}
	Project.texture_width = width;
	Project.texture_height = height;

	if (Project.texture_width / old_res.x != Project.texture_width / old_res.y) {
		modify_uv = false;
	}

	if (modify_uv) {
		var multiplier = [
			Project.texture_width/entityMode.old_res.x,
			Project.texture_height/entityMode.old_res.y
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

	Canvas.updateAllUVs()
	if (selected.length) {
		main_uv.loadData()
	}
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
		main_uv.jquery.size.find('.uv_mapping_overlay').remove()
		main_uv.loadData()
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
	}
	if (Modes.animate) {
		if (Animator.selected && Group.selected) {
			Animator.selected.getBoneAnimator().select()
		}
		updateKeyframeSelection()
	}

	BarItems.cube_counter.update()
	updateNslideValues()
	Blockbench.globalMovement = isMovementGlobal()

	Canvas.updateOrigin()
	Transformer.updateSelection()
	Transformer.update()

	BARS.updateConditions()
	delete TickUpdates.selection;
	Blockbench.dispatchEvent('update_selection')
}
function selectAll() {
	if (selected.length < elements.length) {
		elements.forEach(obj => {
			obj.selectLow()
		})
		updateSelection()
	} else {
		unselectAll()
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
	var rdm = $('#selgen_random').val()/100

	var array = elements
	if ($('#selgen_group').is(':checked') && Group.selected) {
		array = Group.selected.children
	}

	array.forEach(function(s) {
		if (s.name.toUpperCase().includes(name_seg) === false) return;
		if (Math.random() > rdm) return;
		selected.push(s)
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
			Cube.all.forEach(cube => {
				Canvas.buildGridBox(cube)
			})
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
		keybind: new Keybind({key: 51}),
		condition: () => Format.animation_mode,
		onSelect: () => {
			Animator.join()
		},
		onUnselect: () => {
			Animator.leave()
		}
	})
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
	}
}
const Clipbench = {
	elements: [],
	copy(event, cut) {
		var p = Prop.active_panel
		var text = window.getSelection()+'';
		if (text) {
			Clipbench.setText(text)

		} else if (open_dialog == 'uv_dialog') {
			uv_dialog.copy(event)

		} else if (display_mode) {
			DisplayMode.copy()

		} else if (Animator.open) {
			if (Timeline.selected.length) {
				Clipbench.setKeyframes(Timeline.selected)
			}
		} else if (p == 'uv' || p == 'preview') {
			main_uv.copy(event)
			
		} else if (p == 'textures' && isApp) {
			if (textures.selected) {
				Clipbench.setTexture(textures.selected)
			}
		} else if (p == 'outliner') {
			Clipbench.setElements()
			Clipbench.setGroup()
			if (Group.selected) {
				Clipbench.setGroup(Group.selected)
			} else {
				Clipbench.setElements(selected)
			}
			if (cut) {
				BarItems.delete.trigger()
			}
		}
	},
	paste(event) {
		var p = Prop.active_panel
		if (open_dialog == 'uv_dialog') {
			uv_dialog.paste(event)
		} else if (display_mode) {
			DisplayMode.paste()
		} else if (Animator.open) {
			//
			if (isApp) {
				var raw = clipboard.readHTML()
				try {
					var data = JSON.parse(raw)
					if (data.type === 'keyframes' && data.content) {
						Clipbench.keyframes = data.content
					}
				} catch (err) {}
			}
			if (Clipbench.keyframes && Clipbench.keyframes.length) {

				if (!Animator.selected) return;
				var bone = Animator.selected.getBoneAnimator()
				if (bone) {
					var keyframes = [];
					Undo.initEdit({keyframes, keep_saved: true});
					Clipbench.keyframes.forEach(function(data, i) {
						var base_kf = new Keyframe(data);
						base_kf.time = Timeline.second + data.time_offset;
						bone.pushKeyframe(base_kf);
						keyframes.push(base_kf);
						base_kf.select(i ? {ctrlKey: true} : null)
					})
					Animator.preview()
					Vue.nextTick(Timeline.update);
					Undo.finishEdit('paste keyframes');
				}
			}
		} else if (p == 'uv' || p == 'preview') {
			main_uv.paste(event)
		} else if (p == 'textures' && isApp) {
			var img = clipboard.readImage()
			if (img) {
				var dataUrl = img.toDataURL()
				var texture = new Texture({name: 'pasted', folder: 'block' }).fromDataURL(dataUrl).fillParticle().add(true)
				setTimeout(function() {
					texture.openMenu()
				},40)
			}
		} else if (p == 'outliner') {
			
			Undo.initEdit({outliner: true, elements: [], selection: true});
			//Group
			var target = 'root'
			if (Group.selected) {
				target = Group.selected
				Group.selected.isOpen = true
			} else if (selected[0]) {
				target = selected[0]
			}
			selected.length = 0
			if (isApp) {
				var raw = clipboard.readHTML()
				try {
					var data = JSON.parse(raw)
					if (data.type === 'elements' && data.content) {
						Clipbench.group = undefined;
						Clipbench.elements = data.content;
					} else if (data.type === 'group' && data.content) {
						Clipbench.group = data.content;
						Clipbench.elements = [];
					}
				} catch (err) {}
			}
			if (Clipbench.group) {
				function iterate(obj, parent) {
					if (obj.children) {
						var copy = new Group(obj).addTo(parent).init()
						if (Format.bone_rig) {
							copy.createUniqueName();
						}
						if (obj.children && obj.children.length) {
							obj.children.forEach((child) => {
								iterate(child, copy)
							})
						}
					} else {
						var el = NonGroup.fromSave(obj).addTo(parent).selectLow();
						Canvas.adaptObjectPosition(el);
					}
				}
				iterate(Clipbench.group, target)
				updateSelection()

			} else if (Clipbench.elements && Clipbench.elements.length) {
				Clipbench.elements.forEach(function(obj) {
					NonGroup.fromSave(obj).addTo(target).selectLow()
				})
				updateSelection()
			}
			Undo.finishEdit('paste', {outliner: true, elements: selected, selection: true});
		}
	},
	setTexture(texture) {
		//Sets the raw image of the texture
		if (!isApp) return;

		if (texture.mode === 'bitmap') {
			var img = nativeImage.createFromDataURL(texture.source)
		} else {
			var img = nativeImage.createFromPath(texture.source.split('?')[0])
		}
		clipboard.writeImage(img)
	},
	setGroup(group) {
		if (!group) {
			Clipbench.group = undefined
			return;
		}
		Clipbench.group = group.getSaveCopy()
		if (isApp) {
			clipboard.writeHTML(JSON.stringify({type: 'group', content: Clipbench.group}))
		}
	},
	setElements(arr) {
		if (!arr) {
			Clipbench.elements = []
			return;
		}
		arr.forEach(function(obj) {
			Clipbench.elements.push(obj.getSaveCopy())
		})
		if (isApp) {
			clipboard.writeHTML(JSON.stringify({type: 'elements', content: Clipbench.elements}))
		}
	},
	setKeyframes(keyframes) {
		Clipbench.keyframes = []
		if (!keyframes || keyframes.length === 0) {
			return;
		}
		var first = keyframes[0];
		keyframes.forEach(function(kf) {
			if (kf.time < first.time) {
				first = kf
			}
		})
		keyframes.forEach(function(kf) {
			Clipbench.keyframes.push({
				channel: kf.channel,
				x: kf.x,
				y: kf.y,
				z: kf.z,
				w: kf.w,
				isQuaternion: kf.isQuaternion,
				time_offset: kf.time - first.time,
			})
		})
		if (isApp) {
			clipboard.writeHTML(JSON.stringify({type: 'keyframes', content: Clipbench.keyframes}))
		}
	},
	setText(text) {
		if (isApp) {
			clipboard.writeText(text)
		} else {
			document.execCommand('copy')
		}
	}
}

const entityMode = {
	hardcodes: {"geometry.chicken":{"body":{"rotation":[90,0,0]}},"geometry.llama":{"chest1":{"rotation":[0,90,0]},"chest2":{"rotation":[0,90,0]},"body":{"rotation":[90,0,0]}},"geometry.cow":{"body":{"rotation":[90,0,0]}},"geometry.sheep.sheared":{"body":{"rotation":[90,0,0]}},"geometry.sheep":{"body":{"rotation":[90,0,0]}},"geometry.phantom":{"body":{"rotation":[0,0,0]},"wing0":{"rotation":[0,0,5.7]},"wingtip0":{"rotation":[0,0,5.7]},"wing1":{"rotation":[0,0,-5.7]},"wingtip1":{"rotation":[0,0,-5.7]},"head":{"rotation":[11.5,0,0]},"tail":{"rotation":[0,0,0]},"tailtip":{"rotation":[0,0,0]}},"geometry.pig":{"body":{"rotation":[90,0,0]}},"geometry.ocelot":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.cat":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.turtle":{"eggbelly":{"rotation":[90,0,0]},"body":{"rotation":[90,0,0]}},"geometry.villager.witch":{"hat2":{"rotation":[-3,0,1.5]},"hat3":{"rotation":[-6,0,3]},"hat4":{"rotation":[-12,0,6]}},"geometry.pufferfish.mid":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.pufferfish.large":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.tropicalfish_a":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}},"geometry.tropicalfish_b":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}}},
}
