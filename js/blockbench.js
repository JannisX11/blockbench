var osfs = '/'
var File, i;
const elements = [];
const TreeElements = [];
const textures = [];
var selected = [];
var prev_side = 'north';
var uv_clipboard;
var outliner, texturelist;
var pe_list_data = []
var open_dialog = false;
var open_interface = false;
var tex_version = 1;
var pe_list;
var holding_shift = false;
var main_uv;
const Prop = {
	active_panel:   'preview',
	wireframe:	  false,
	file_path:	  '',
	file_name:	  '',
	added_models: 0,
	project_saved:  true,
	fps:			0,
	zoom:		   100,
	progress:	   0,
	facing:		 'north'
}
const Project = {
	name			: '',
	parent			: '',
	description	   	: '',
	texture_width	: 16,
	texture_height	: 16,
	ambientocclusion: true,
	get geometry_name() {
		return this.parent;
	},
	set geometry_name(n) {
		this.parent = n;
	},
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
	if (localStorage.getItem('donated') == 'true') {
		$('#donation_hint').remove()
	}

	if (isApp) {
		updateRecentProjects()
	}
	
	setInterval(function() {
		Prop.fps = framespersecond;
		framespersecond = 0;
	}, 1000)
	Blockbench.entity_mode = false

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
			var item = TreeElements.findRecursive('uuid', $(ui.draggable).parent().attr('id'))
			dropOutlinerObjects(item, undefined, event)
		}
	})
	$('#cubes_list').contextmenu(function(event) {
		Interface.Panels.outliner.menu.show(event)
	})
	$('#texture_list').contextmenu(function(event) {
		Interface.Panels.textures.menu.show(event)
	})
	$(window).on( "unload", saveLocalStorages)

	setupInterface()
	setupDragHandlers()
	Modes.options.edit.select()
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
		return 16 / limitNumber(settings.edit_size.value, 1, 1024)
	} else if (ctrl && shift) {
		var basic = 16 / limitNumber(settings.edit_size.value, 1, 1024)
		var control = 16 / limitNumber(settings.ctrl_size.value, 1, 1024)
		var shift = 16 / limitNumber(settings.shift_size.value, 1, 1024)
		control = basic / control
		return shift / control
	} else if (ctrl) {
		return 16 / limitNumber(settings.ctrl_size.value, 1, 1024)
	} else {
		return 16 / limitNumber(settings.shift_size.value, 1, 1024)
	}
}

function updateNslideValues() {
	//if (!selected.length && (!Blockbench.entity_mode || !selected_group)) return;

	if (selected.length) {
		BarItems.slider_pos_x.update()
		BarItems.slider_pos_y.update()
		BarItems.slider_pos_z.update()

		BarItems.slider_size_x.update()
		BarItems.slider_size_y.update()
		BarItems.slider_size_z.update()

		BarItems.slider_inflate.update()
	}
	if (selected.length || (Blockbench.entity_mode && selected_group)) {
		BarItems.slider_origin_x.update()
		BarItems.slider_origin_y.update()
		BarItems.slider_origin_z.update()

		BarItems.slider_rotation_x.update()
		BarItems.slider_rotation_y.update()
		BarItems.slider_rotation_z.update()
		if (Blockbench.entity_mode) {
			BarItems.bone_reset_toggle.setIcon(selected_group && selected_group.reset ? 'check_box' : 'check_box_outline_blank')
		} else {
			BarItems.rescale_toggle.setIcon(selected[0].rescale ? 'check_box' : 'check_box_outline_blank')
		}
	}
}

//Selections
function updateSelection() {
	//Clear
	if (rot_origin.parent) {
		rot_origin.parent.remove(rot_origin)
	}
	Transformer.detach()
	Transformer.hoverAxis = null;
	if (display_mode) {
		DisplayMode.centerTransformer()
	}

	elements.forEach(function(obj) {
		var is_in_selection = selected.includes(obj)
		if (is_in_selection !== obj.selected) {
			obj.selected = is_in_selection
		}
		if (obj.selected === true) {
			if (Toolbox.selected.transformerMode !== 'hidden' && obj.visibility === true && (Toolbox.selected.transformerMode !== 'rotate' || !Blockbench.entity_mode)) {
				Transformer.attach(obj.mesh)
			}
		}
		if (obj.visibility) {
			var mesh = obj.mesh
			if (mesh && mesh.outline) {
				mesh.outline.visible = obj.selected
			}
		}
	})

	//Interface
	if (selected.length > 0) {
		$('.selection_only').css('visibility', 'visible')
		main_uv.jquery.size.find('.uv_mapping_overlay').remove()
		main_uv.loadData()
	} else {
		$('.selection_only').css('visibility', 'hidden')
	}
	BarItems.cube_counter.update()
	updateNslideValues()
	//Misc
	Blockbench.globalMovement = isMovementGlobal()
	centerTransformer()
	if (Blockbench.entity_mode) {
		if (selected_group) {
			$('.selection_only#options').css('visibility', 'visible')
			if (settings.origin_size.value > 0 && selected_group.visibility) {
				selected_group.mesh.add(rot_origin)
			}
			if (Toolbox.selected.transformerMode === 'rotate') {
				Transformer.attach(selected_group.mesh)
			}
		} else {
			$('.selection_only#options').css('visibility', 'hidden')
		}
		if (Animator.open && Animator.selected && selected_group) {
			Animator.selected.getBoneAnimator().select()
		}
		if (Animator.open) {
			updateKeyframeSelection()
		}
	} else {
		//Origin Helper
		if (selected.length === 1 && selected[0].visibility) {
			let mesh = selected[0].mesh
			if (mesh) {
				mesh.add(rot_origin)
			}
		} else if (selected.length > 0) {
			var origin = null;
			var first_visible = null;
			var i = 0;
			while (i < selected.length) {
				if (selected[i].visibility) {

					if (first_visible === null) {
						first_visible = selected[i]
					}
					if (origin === null) {
						origin = selected[i].origin
					} else if (!origin.equals(selected[i].origin)) {
						origin = false;
						i = Infinity;
					}
				}
				i++;
			}
			if (first_visible && typeof origin === 'object') {
				let mesh = first_visible.mesh
				if (mesh) {
					mesh.add(rot_origin)
				}
			} 
		}
	}
	Transformer.update()
	BARS.updateConditions()
	Blockbench.dispatchEvent('update_selection')
}
function selectAll() {
	if (selected.length < elements.length) {
		selected.length = 0
		var i = 0; 
		while (elements.length > i) {
			selected.push(elements[i])
			i++;
		}
	} else {
		selected.length = 0
		if (selected_group) selected_group.unselect()
	}
	updateSelection()
	Blockbench.dispatchEvent('select_all')
}
function unselectAll() {
	selected.length = 0
	if (selected_group) selected_group.unselect()
	getAllOutlinerGroups().forEach(function(s) {
		s.selected = false
	})
	updateSelection()
}
function invertSelection() {
	elements.forEach(function(s) {
		if (selected.includes(s)) {
			selected.splice(selected.indexOf(s), 1)
		} else {
			selected.push(s)
		}
	})
	if (selected_group) selected_group.unselect()
	updateSelection()
	Blockbench.dispatchEvent('invert_selection')
}
function createSelection() {
	if ($('#selgen_new').is(':checked')) {
		selected.length = 0
	}
	if (selected_group) {
		selected_group.unselect()
	}
	var name_seg = $('#selgen_name').val().toUpperCase()
	var rdm = $('#selgen_random').val()/100

	var array = elements
	if ($('#selgen_group').is(':checked') && selected_group) {
		array = selected_group.children
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
		this.selectCubes = data.selectCubes !== false
		this.condition = data.condition;
		this.onSelect = data.onSelect;
		this.onUnselect = data.onUnselect;
		this.category = data.category;
		Modes.options[this.id] = this;
	}
	select() {
		if (typeof Modes.selected.onUnselect === 'function') {
			Modes.selected.onUnselect()
		}
		if (Modes.selected.selected) {
			Modes.selected.selected = false
		}
		if (typeof this.onSelect === 'function') {
			this.onSelect()
		}
		this.selected = true;
		Modes.id = this.id
		Modes.selected = this;
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
		id: 'edit',
		default_tool: 'move_tool',
		keybind: new Keybind({key: 49})
	})
	new Mode({
		id: 'paint',
		default_tool: 'brush_tool',
		keybind: new Keybind({key: 50})
	})
	new Mode({
		id: 'display',
		selectCubes: false,
		default_tool: 'move_tool',
		keybind: new Keybind({key: 51}),
		condition: () => !Blockbench.entity_mode,
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
		keybind: new Keybind({key: 51}),
		condition: () => Blockbench.entity_mode,
		onSelect: () => {
			Animator.join()
		},
		onUnselect: () => {
			Animator.leave()
		}
	})
})
//Misc
const TickUpdates = {
	Run: function() {
		if (TickUpdates.outliner) {
			delete TickUpdates.outliner;
			loadOutlinerDraggable()
		}
		if (TickUpdates.selection) {
			delete TickUpdates.selection;
			updateSelection()
		}
	}
}
const Screencam = {
	fullScreen: function(options, cb) {
		setTimeout(function() {
			currentwindow.capturePage(function(screenshot) {
				var dataUrl = screenshot.toDataURL()
				dataUrl = dataUrl.replace('data:image/png;base64,','')
				Jimp.read(Buffer.from(dataUrl, 'base64')).then(function(image) { 

					if (options && options.width && options.height) {
						image.contain(options.width, options.height)
					}

					image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
						Screencam.returnScreenshot(dataUrl, cb)
					})
				});
			})
		}, 40)
	},
	returnScreenshot: function(dataUrl, cb) {
		if (cb) {
			cb(dataUrl)
		} else if (isApp) {
			var screenshot = nativeImage.createFromDataURL(dataUrl)
			var img = new Image()
			var is_gif = dataUrl.substr(5, 9) == 'image/gif'
			img.src = dataUrl

			var btns = [tl('dialog.cancel'), tl('dialog.save')]
			if (!is_gif) {
				btns.push(tl('message.screenshot.clipboard'))
			}
			Blockbench.showMessageBox({
				translateKey: 'screenshot',
				icon: img,
				buttons: btns,
				confirm: 1,
				cancel: 0
			}, function(result) {
				if (result === 1) {
					electron.dialog.showSaveDialog(currentwindow, {filters: [ {name: tl('data.image'), extensions: [is_gif ? 'gif' : 'png']} ]}, function (fileName) {
						if (fileName === undefined) {
							return;
						}
						//fs.writeFile(fileName, screenshot.toPNG(), function (err) {})
						fs.writeFile(fileName, Buffer(dataUrl.split(',')[1],'base64'), err => {})
					})
				} else if (result === 2) {
					clipboard.writeImage(screenshot)
				}
			})
		} else {
			new Dialog({
				title: tl('message.screenshot.right_click'), 
				id: 'screenie', 
				lines: ['<img src="'+dataUrl+'" width="600px" class="allow_default_menu"></img>'],
				draggable: true,
				singleButton: true
			}).show()
		}
	},
	cleanCanvas: function(options, cb) {
		quad_previews.current.screenshot(options, cb)
	},
	createGif: function(options, cb) {
		if (typeof options !== 'object') {
			options = {}
		}
		if (!options.length) {
			options.length = 1000
		}
		var interval = options.fps ? (1000/options.fps) : 100
		var gif = new GIF({
			repeat: options.repeat,
			quality: options.quality,
			transparent: 0x000000,
		})
		var frame_count = (options.length/interval)

		gif.on('finished', blob => {
			var reader = new FileReader()
			reader.onload = () => {
				if (!options.silent) {
					Blockbench.setProgress(0)
					Blockbench.setStatusBarText()
				}
				Screencam.returnScreenshot(reader.result, cb)
			}
			reader.readAsDataURL(blob)
		})
		if (!options.silent) {
			Blockbench.setStatusBarText(tl('status_bar.recording_gif'))
			gif.on('progress', Blockbench.setProgress)
		}
		var frames = 0;
		var loop = setInterval(() => {
			var img = new Image()
			img.src = quad_previews.current.canvas.toDataURL()
			img.onload = () => {
				gif.addFrame(img, {delay: interval})
			}
			Blockbench.setProgress(interval*frames/options.length)
			frames++;
		}, interval)

		setTimeout(() => {
			clearInterval(loop)
			if (!options.silent) {
				Blockbench.setStatusBarText(tl('status_bar.processing_gif'))
			}
			gif.render()
			if (Animator.open && Timeline.playing) {
				Timeline.pause()
			}
		}, options.length)
	}
}
const Clipbench = {
	cubes: [],
	copy: function(event, cut) {
		var p = Prop.active_panel
		if (open_dialog == 'uv_dialog') {
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
			Clipbench.setCubes()
			Clipbench.setGroup()
			if (selected_group) {
				Clipbench.setGroup(selected_group)
			} else {
				Clipbench.setCubes(selected)
			}
			if (cut) {
				deleteCubes()
			}
		}
	},
	paste: function(event) {
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
					Clipbench.keyframes.forEach(function(data) {
						var base_kf = new Keyframe(data)
						base_kf.time = Timeline.second + data.time_offset
						bone.pushKeyframe(base_kf)
					})
					Vue.nextTick(Timeline.update)
				}
			}
		} else if (p == 'uv' || p == 'preview') {
			main_uv.paste(event)
		} else if (p == 'textures' && isApp) {
			var img = clipboard.readImage()
			if (img) {
				var dataUrl = img.toDataURL()
				var texture = new Texture({name: 'pasted', folder: 'blocks' }).fromDataURL(dataUrl).add().fillParticle()
				setTimeout(function() {
					texture.openMenu()
				},40)
			}
		} else if (p == 'outliner') {
			
			Undo.initEdit({outliner: true, cubes: [], selection: true});
			//Group
			var target = 'root'
			if (selected_group) {
				target = selected_group
				selected_group.isOpen = true
			} else if (selected[0]) {
				target = selected[0]
			}
			selected.length = 0
			if (isApp) {
				var raw = clipboard.readHTML()
				try {
					var data = JSON.parse(raw)
					if (data.type === 'cubes' && data.content) {
						Clipbench.group = undefined
						Clipbench.cubes = data.content
					} else if (data.type === 'group' && data.content) {
						Clipbench.group = data.content
						Clipbench.cubes = []
					}
				} catch (err) {}
			}
			if (Clipbench.group) {
				function iterate(obj, parent) {
					if (obj.children) {
						var copy = new Group(obj)
						if (obj.children && obj.children.length) {
							obj.children.forEach((child) => {
								iterate(child, copy)
							})
						}
						copy.addTo(parent)
					} else {
						var copy = new Cube(obj)
						copy.addTo(parent).init()
						selected.push(elements[elements.length-1])
					}
				}
				iterate(Clipbench.group, target)
				updateSelection()

			} else if (Clipbench.cubes && Clipbench.cubes.length) {
				Clipbench.cubes.forEach(function(obj) {
					var copy = new Cube(obj)
					copy.addTo(target).init()
					selected.push(elements[elements.length-1])
				})
				updateSelection()
			}
			Undo.finishEdit('paste', {outliner: true, cubes: selected, selection: true});
		}
	},
	setTexture: function(texture) {
		//Sets the raw image of the texture
		if (!isApp) return;

		if (texture.mode === 'bitmap') {
			var img = nativeImage.createFromDataURL(texture.source)
		} else {
			var img = nativeImage.createFromPath(texture.source.split('?')[0])
		}
		clipboard.writeImage(img)
	},
	setGroup: function(group) {
		if (!group) {
			Clipbench.group = undefined
			return;
		}
		Clipbench.group = group.duplicate('cache')
		if (isApp) {
			clipboard.writeHTML(JSON.stringify({type: 'group', content: Clipbench.group}))
		}
	},
	setCubes: function(cubes) {
		if (!cubes) {
			Clipbench.cubes = []
			return;
		}
		cubes.forEach(function(obj) {
			var base_cube = new Cube(obj)
			Clipbench.cubes.push(base_cube)
		})
		if (isApp) {
			clipboard.writeHTML(JSON.stringify({type: 'cubes', content: Clipbench.cubes}))
		}
	},
	setKeyframes: function(keyframes) {
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
	}
}

const Vertexsnap = {
	step1: true,
	vertexes: new THREE.Object3D(),
	vertexed_cubes: [],
	hovering: false,
	addVertexes: function(cube) {
		if (Vertexsnap.vertexed_cubes.includes(cube)) return;
		if (cube.visibility === false) return;

		$('#preview').get(0).removeEventListener("mousemove", Vertexsnap.hoverCanvas)
		$('#preview').get(0).addEventListener("mousemove", Vertexsnap.hoverCanvas)

		var o_vertices = cube.mesh.geometry.vertices
		cube.mesh.updateMatrixWorld()
		o_vertices.forEach(function(v, id) {
			var outline_color = '0x'+app_colors.accent.hex.replace('#', '')
			//Each vertex needs it's own material for hovering
			var material = new THREE.MeshBasicMaterial({color: parseInt(outline_color)})
			var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
			var pos = mesh.position.copy(v)
			pos.applyMatrix4(cube.mesh.matrixWorld)
			pos.addScalar(8)
			mesh.rotation.copy(cube.mesh.rotation)
			mesh.cube = cube
			mesh.isVertex = true
			mesh.vertex_id = id
			Vertexsnap.vertexes.add(mesh)
		})
		Vertexsnap.vertexed_cubes.push(cube)
		Vertexsnap.updateVertexSize()
	},
	removeVertexes: function() {
		var i = Vertexsnap.vertexes.children.length
		while (i >= 0) {
			Vertexsnap.vertexes.remove(Vertexsnap.vertexes.children[i])
			i--;
		}
		Vertexsnap.vertexed_cubes = []
		$('#preview').get(0).removeEventListener("mousemove", Vertexsnap.hoverCanvas)
	},
	hoverCanvas: function(event) {
		if (Vertexsnap.hovering) {
			Vertexsnap.vertexes.children.forEach(function(v) {
				if (v.type === 'Line') {
					Vertexsnap.vertexes.remove(v)
				} else {
					v.material.color.set(parseInt('0x'+app_colors.accent.hex.replace('#', '')))
				}
			})
		}
		let data = Canvas.raycast()
		if (!data || !data.vertex) {
			Blockbench.setStatusBarText()
			return;
		}
		var vertex = data.vertex
		vertex.material.color.g = 1
		Vertexsnap.hovering = true

		if (Vertexsnap.step1 === false) {
			//Line
			var geometry = new THREE.Geometry();
			geometry.vertices.push(Vertexsnap.vertex_pos);
			geometry.vertices.push(vertex.position);
			var line = new THREE.Line(geometry, Vertexsnap.lineMaterial);
			line.renderOrder = 900
			Vertexsnap.vertexes.add(line)
			//Measure
			var diff = new THREE.Vector3().copy(Vertexsnap.vertex_pos)
			diff.sub(vertex.position)
			Blockbench.setStatusBarText(tl('status_bar.vertex_distance', [trimFloatNumber(diff.length())] ))
		}
	},
	select: function() {
		Vertexsnap.removeVertexes()
		selected.forEach(function(obj) {
			Vertexsnap.addVertexes(obj)
		})
		if (selected.length) {
			$('#preview').css('cursor', (Vertexsnap.step1 ? 'copy' : 'alias'))
		}
		Vertexsnap.lineMaterial = Canvas.outlineMaterial.clone()
		Vertexsnap.lineMaterial.depthTest = false
	},
	canvasClick: function(data) {
		if (!data.vertex) return;

		if (Vertexsnap.step1) {
			Vertexsnap.step1 = false
			Vertexsnap.vertex_pos = data.vertex.position
			Vertexsnap.vertex_id = data.vertex.vertex_id
			Vertexsnap.cubes = selected.slice()
			Vertexsnap.removeVertexes()
			$('#preview').css('cursor', (Vertexsnap.step1 ? 'copy' : 'alias'))
		} else {
			Vertexsnap.snap(data)
			$('#preview').css('cursor', (Vertexsnap.step1 ? 'copy' : 'alias'))
		}
		Blockbench.setStatusBarText()
	},
	snap: function(data) {
		Undo.initEdit({cubes: Vertexsnap.cubes})

		var pos = data.vertex.position
		pos.sub(Vertexsnap.vertex_pos)

		if (BarItems.vertex_snap_mode.get() === 'scale') {
			//Scale

			var m;
			switch (Vertexsnap.vertex_id) {
				case 0: m=[ 1,1,1 ]; break;
				case 1: m=[ 1,1,0 ]; break;
				case 2: m=[ 1,0,1 ]; break;
				case 3: m=[ 1,0,0 ]; break;
				case 4: m=[ 0,1,0 ]; break;
				case 5: m=[ 0,1,1 ]; break;
				case 6: m=[ 0,0,0 ]; break;
				case 7: m=[ 0,0,1 ]; break;
			}

			Vertexsnap.cubes.forEach(function(obj) {
				var q = obj.mesh.getWorldQuaternion(new THREE.Quaternion()).inverse()
				var cube_pos = new THREE.Vector3().copy(pos).applyQuaternion(q)

				for (i=0; i<3; i++) {
					if (m[i] === 1) {
						obj.to[i] += cube_pos.getComponent(i)
					} else {
						obj.from[i] += cube_pos.getComponent(i)
					}
				}
				if (Blockbench.entity_mode && obj.visibility) {
					Canvas.updateUV(obj)
				}
			})
		} else {
			Vertexsnap.cubes.forEach(function(obj) {
				var cube_pos = new THREE.Vector3().copy(pos)
				if (Blockbench.entity_mode === false) {
					obj.origin[0] += cube_pos.getComponent(0)
					obj.origin[1] += cube_pos.getComponent(1)
					obj.origin[2] += cube_pos.getComponent(2)
				} else {
					var q = obj.mesh.getWorldQuaternion(new THREE.Quaternion()).inverse()
					cube_pos.applyQuaternion(q)
				}
				obj.from[0] += cube_pos.getComponent(0)
				obj.from[1] += cube_pos.getComponent(1)
				obj.from[2] += cube_pos.getComponent(2)
				obj.to[0] += cube_pos.getComponent(0)
				obj.to[1] += cube_pos.getComponent(1)
				obj.to[2] += cube_pos.getComponent(2)
			})
		}

		Vertexsnap.removeVertexes()
		Canvas.updateAllPositions()
		Undo.finishEdit('vertex_snap')
		Vertexsnap.step1 = true
	},
	updateVertexSize: function() {
		Vertexsnap.vertexes.children.forEach(function(v,i) {
			var scaleVector = new THREE.Vector3();
			var scale = scaleVector.subVectors(v.position, Transformer.camera.position).length() / 500;
			scale = (Math.sqrt(scale) + scale/10) * 1.2
			v.scale.set(scale, scale, scale)
		})
	}
}
const entityMode = {
	state: false,
	old_res: {},
	hardcodes: {"geometry.chicken":{"body":{"rotation":[90,0,0]}},"geometry.llama":{"chest1":{"rotation":[0,90,0]},"chest2":{"rotation":[0,90,0]},"body":{"rotation":[90,0,0]}},"geometry.cow":{"body":{"rotation":[90,0,0]}},"geometry.sheep.sheared":{"body":{"rotation":[90,0,0]}},"geometry.sheep":{"body":{"rotation":[90,0,0]}},"geometry.phantom":{"body":{"rotation":[0,0,0]},"wing0":{"rotation":[0,0,5.7]},"wingtip0":{"rotation":[0,0,5.7]},"wing1":{"rotation":[0,0,-5.7]},"wingtip1":{"rotation":[0,0,-5.7]},"head":{"rotation":[11.5,0,0]},"tail":{"rotation":[0,0,0]},"tailtip":{"rotation":[0,0,0]}},"geometry.pig":{"body":{"rotation":[90,0,0]}},"geometry.ocelot":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.cat":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.turtle":{"eggbelly":{"rotation":[90,0,0]},"body":{"rotation":[90,0,0]}},"geometry.villager.witch":{"hat2":{"rotation":[-3,0,1.5]},"hat3":{"rotation":[-6,0,3]},"hat4":{"rotation":[-12,0,6]}},"geometry.pufferfish.mid":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.pufferfish.large":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.tropicalfish_a":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}},"geometry.tropicalfish_b":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}}},
	join: function() {
		if (display_mode) {
		   BarItems.move_tool.select() 
		}
		Blockbench.entity_mode = true
		$('body').addClass('entity_mode')
		$('label[for="project_parent"]').text(tl('dialog.project.geoname'))
		$('button#entity_mode_convert').text(tl('dialog.project.to_blockmodel'))
		//Rotation Menu
		if (textures.length > 1) {
			textures.splice(1)
		}
		if (textures.length) {
			var tex = textures[0]
			tex.particle = false
			if (tex.img.naturalWidth !== tex.img.naturalWidth && tex.error) {
				tex.error = false
			}
		}
		Canvas.updateRenderSides()

		//UI Changes
		$('.block_mode_only').hide()
		$('.entity_mode_only').show()
		Modes.options.edit.select()
		//UV
		//main_uv.buildDom(true).setToMainSlot().setFace('north')
		main_uv.autoGrid = true
		main_uv.setGrid()
		//Update
		buildGrid()
		Canvas.updateAllPositions()
		Canvas.updateAllFaces()
		Blockbench.dispatchEvent('join_entity_mode')
	},
	leave: function() {
		Blockbench.entity_mode = false
		$('body').removeClass('entity_mode')
		$('label[for="project_parent"]').text(tl('dialog.project.parent'))
		$('button#entity_mode_convert').text(tl('dialog.project.to_entitymodel'))
		//Rotation Menu
		$('input#cube_rotate').attr('min', '-67.5').attr('max', '67.5').attr('step', '22.5').removeClass('entity_mode')
		//UV
		//main_uv.buildDom(true).setToMainSlot()
		main_uv.autoGrid = false
		main_uv.showing_overlays = false
		main_uv.displayAllMappingOverlays()
		main_uv.setGrid()
		if (textures[0]) {
			textures[0].load()
		}
		//UI Changes
		$('.block_mode_only').show()
		$('.entity_mode_only').hide()
		Modes.options.edit.select()
		//Update
		if (textures.length) {
			textures[0].load()
		}
		Canvas.updateRenderSides()
		buildGrid()
		if (settings.restricted_canvas.value) moveIntoBox(elements, true)
		Canvas.updateAllPositions()
		Blockbench.dispatchEvent('leave_entity_mode')
	},
	convert: function() {
		Blockbench.showMessageBox({
			title: tl('message.convert_mode.title'),
			icon: 'warning',
			message: tl('message.convert_mode.message', [tl(Blockbench.entity_mode?'message.convert_mode.block':'message.convert_mode.entity')]),
			buttons: [tl('message.convert_mode.convert'), tl('dialog.cancel')],
			confirm: 0,
			cancel: 1
		}, function(result) {
			if (result === 0) {
				Undo.history.length = 0;
				Undo.index = 0;
				if (Blockbench.entity_mode) {
					entityMode.leave()
					elements.forEach(function(obj) {
						obj.autouv = 0
					})
				} else {
					entityMode.join()
				}
			}
		})
	},
	setResolution: function(x, y, lockUV) {
		if (!Blockbench.entity_mode) return;
		//lockUV > If true, keep the uv_offset numbers the same

		Project.texture_width = parseInt(Project.texture_width)
		Project.texture_height = parseInt(Project.texture_height)
		if (typeof entityMode.old_res.x !== 'number' || typeof entityMode.old_res.y !== 'number') {
			entityMode.old_res.x = Project.texture_width
			entityMode.old_res.y = Project.texture_height
		}

		Math.areMultiples = function(n1, n2) {
			return (
				(n1/n2)%1 === 0 ||
				(n2/n1)%1 === 0
			)
		}

		if (x && y) {
			entityMode.old_res.x = Project.texture_width
			entityMode.old_res.y = Project.texture_height
		}
		if (x) {Project.texture_width = x}
		if (y) {Project.texture_height = y}
		if (entityMode.old_res.x/entityMode.old_res.y !== Project.texture_width/Project.texture_height) {lockUV = true}

		if (!lockUV &&
			entityMode.old_res.x != Project.texture_width &&
			Math.areMultiples(entityMode.old_res.x, Project.texture_width)
		) {
			elements.forEach(function(obj) {
				obj.uv_offset[0] *= Project.texture_width/entityMode.old_res.x
			})
		}
		if (!lockUV &&
			entityMode.old_res.y != Project.texture_height && 
			Math.areMultiples(entityMode.old_res.x, Project.texture_width)
		) {
			elements.forEach(function(obj) {
				obj.uv_offset[1] *= Project.texture_height/entityMode.old_res.y
			})
		}

		entityMode.old_res.x = Project.texture_width
		entityMode.old_res.y = Project.texture_height
		Canvas.updateAllUVs()
		if (selected.length) {
			main_uv.loadData()
		}
	}
}
