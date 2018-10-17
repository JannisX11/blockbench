var scene, main_preview, previews,
	Sun, lights,
	emptyMaterials, transparentMaterial, northMarkMaterial,
	outlines, setupGrid, wireframeMaterial,
	Transformer,
	canvas_scenes,
	display_scene, display_area, display_base;
var framespersecond = 0;
var display_mode = false;
var cubes = new THREE.Group();
var doRender = false;
var quad_previews = {};
var three_grid = new THREE.Object3D();
var rot_origin = new THREE.Object3D();
var status_bar_height = 25
var gizmo_colors = {
	r: new THREE.Color(0xfd3043),
	g: new THREE.Color(0x26ec45),
	b: new THREE.Color(0x2d5ee8)
}

class Preview {
	constructor(data) {
		var scope = this;
		if (data && data.id) {
			this.id = data.id
		}
		//Node
		this.canvas = document.createElement('canvas')
		this.canvas.preview = this;
		this.canvas.className = 'preview';
		this.height = 0;
		this.width = 0;
		//Cameras
		this.isOrtho = false
		this.camPers = new THREE.PerspectiveCamera(45, 16 / 9, 1, 3000)
		this.camOrtho = new THREE.OrthographicCamera(-600,  600, -400, 400, 1, 100)
		this.camOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: false, a: 'y'}]
		this.camOrtho.axis = null
		this.camPers.position.set(-20, 20, -20)
		this.camPers.preview = this.camOrtho.preview = this; 

		//Controls
		this.controls = new THREE.OrbitControls(this.camPers, this);
		this.controls.minDistance = 1;
		this.controls.maxDistance = 320;
		this.controls.target.set(0,-3,0);
		this.controls.enableKeys = false;

		//Keybinds
		this.controls.mouseButtons.ZOOM = undefined;

		//Renderer
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
			alpha: true,
			preserveDrawingBuffer: true
		});
		this.renderer.setClearColor( 0x000000, 0 )
		this.renderer.setSize(500, 400);

		this.loadBackground()

		this.selection = {
			box: $('<div id="selection_box"></div>') 
		}

		this.raycaster = new THREE.Raycaster()
		this.mouse = new THREE.Vector2();
		this.canvas.addEventListener('mousedown', 	function(event) { scope.click(event)}, false)
		this.canvas.addEventListener('mousemove', 	function(event) { scope.static_rclick = false}, false)
		this.canvas.addEventListener('contextmenu',	function(event) { scope.showContextMenu(event)}, false)
		this.canvas.addEventListener('dblclick', 	function() {Toolbox.toggleTransforms()}, false)
		this.canvas.addEventListener('touchstart', 	function() { scope.onTouchStart()}, false)
		this.canvas.addEventListener('mouseenter', 	function() { scope.occupyTransformer()}, false)

		Blockbench.addDragHandler('test'+Math.round(Math.random()*100), {
			extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif'],
			element: this.canvas,
			readtype: 'image',
		}, function(files) {
			if (isApp) {
				scope.background.image = files[0].path
			} else {
				scope.background.image = files[0].content
			}
			scope.loadBackground()
		})
		this.resize()

		previews.push(this)
	}
	//Render
	resize() {
		this.height = $(this.canvas).parent().height()
		this.width  = $(this.canvas).parent().width()

		if (this.isOrtho === false) {
			this.camPers.aspect = this.width / this.height
			this.camPers.updateProjectionMatrix();
			if (Transformer) {
				Transformer.update()
			}
		} else {
			this.camOrtho.right = this.width / 80
			this.camOrtho.left = this.camOrtho.right*-1
			this.camOrtho.top = this.height / 80
			this.camOrtho.bottom = this.camOrtho.top*-1
			this.camOrtho.updateProjectionMatrix();
		}
		this.renderer.setSize(this.width, this.height);
		this.updateBackground()
		return this;
	}
	raycast(event) {
		var canvas_offset = $(this.canvas).offset()
		this.mouse.x = ((mouse_pos.x - canvas_offset.left) / this.width) * 2 - 1;
		this.mouse.y = - ((mouse_pos.y - canvas_offset.top) / this.height) * 2 + 1;
		if (this.isOrtho === true) {
			this.raycaster.setFromCamera( this.mouse, this.camOrtho );
		} else {
			this.raycaster.setFromCamera( this.mouse, this.camPers );
		}
		var objects = []
		scene.children.forEach(function(s) {
			if (s.isElement === true) {
				objects.push(s)
			}
		})
		if (Vertexsnap.vertexes.children.length) {
			Vertexsnap.vertexes.children.forEach(function(s) {
				if (s.isVertex === true) {
					objects.push(s)
				}
			})
		}
		var intersects = this.raycaster.intersectObjects( objects );
		if (intersects.length > 0) {
			var intersect = intersects[0].object
			if (intersect.isElement) {
				this.controls.hasMoved = true
				var obj = TreeElements.findRecursive('uuid', intersects[0].object.name)
				switch(Math.floor( intersects[0].faceIndex / 2 )) {
					case 5: var face = 'north'; break;
					case 0: var face = 'east';  break;
					case 4: var face = 'south'; break;
					case 1: var face = 'west';  break;
					case 2: var face = 'up';	break;
					case 3: var face = 'down';  break;
					default:var face = 'north'; break;
				}
				return {
					event: event,
					type: 'cube',
					intersects: intersects,
					face: face,
					cube: obj
				}
			} else if (intersect.isVertex) {
				return {
					event: event,
					type: 'vertex',
					intersects: intersects,
					cube: intersect.cube,
					vertex: intersect
				}
			}
		} else {
			return false;
		}
	}
	render() {
		if (this.canvas.isConnected === false) return;
		this.controls.update()
		if (display_mode === false) {
			if (this.isOrtho === true) {
				this.renderer.render(scene, this.camOrtho)
			} else {
				this.renderer.render(scene, this.camPers)
			}
		} else {
			if (this.isOrtho === true) {
				this.renderer.render(display_scene, this.camOrtho)
			} else {
				this.renderer.render(display_scene, this.camPers)
			}
		}
	}
	//Camera
	setNormalCamera() {
		this.isOrtho = false;
		this.camOrtho.axis = null
		this.resize()
		this.controls.object = this.camPers;
		if (Transformer.camera == this.camOrtho) {
			Transformer.camera = this.camPers;
			Transformer.update();
			Transformer.updateVisibleAxes();
		}
		this.controls.enableRotate = true;
		this.controls.updateSceneScale();
		this.loadBackground()
	}
	setOrthographicCamera(angle) {
		this.isOrtho = true;
		this.angle = angle
		this.controls.object = this.camOrtho;
		if (Transformer.camera == this.camPers) {
			Transformer.camera = this.camOrtho;
		}
		this.controls.enableRotate = false;
		this.controls.target.set(0, 0, 0);

		//Angle
		//if (angle === undefined) return;
		var dist = 48
		switch (angle) {
			case 0:
			this.camOrtho.axis = 'y'
			this.camOrtho.position.set(0,dist,0)
			this.camOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: false, a: 'z'}]
			break;
			case 1:
			this.camOrtho.axis = 'y'
			this.camOrtho.position.set(0,-dist,0)
			this.camOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: true, a: 'z'}]
			break;
			case 2:
			this.camOrtho.axis = 'z'
			this.camOrtho.position.set(0,0,dist)
			this.camOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: true, a: 'y'}]
			break;
			case 3:
			this.camOrtho.axis = 'z'
			this.camOrtho.position.set(0,0,-dist)
			this.camOrtho.backgroundHandle = [{n: true, a: 'x'}, {n: true, a: 'y'}]
			break;
			case 4:
			this.camOrtho.axis = 'x'
			this.camOrtho.position.set(dist,0,0)
			this.camOrtho.backgroundHandle = [{n: true, a: 'z'}, {n: true, a: 'y'}]
			break;
			case 5:
			this.camOrtho.axis = 'x'
			this.camOrtho.position.set(-dist,0,0)
			this.camOrtho.backgroundHandle = [{n: false, a: 'z'}, {n: true, a: 'y'}]
			break;
			case undefined:
			this.camOrtho.axis = null
			angle = 1
			this.camOrtho.position.copy(this.camPers.position)
			this.controls.enableRotate = true;
			break;
		}
		this.loadBackground()

		Transformer.update();
		Transformer.updateVisibleAxes();
		this.resize()
		this.controls.updateSceneScale();
		return this;
	}
	resetCamera() {
		this.controls.target.set(0, -3, 0);
		this.camPers.position.set(-20, 20, -20)
		this.setCameraType('pers')
		return this;
	}
	getFacingDirection() {
		var vec = this.controls.object.getWorldDirection().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4).ceil()
		switch (vec.x+'_'+vec.z) {
			case '1_1':
				return 'south'
				break;
			case '0_0':
				return 'north'
				break;
			case '1_0':
				return 'east'
				break;
			case '0_1':
				return 'west'
				break;
		}
	}
	getFacingHeight() {
		var y = this.controls.object.getWorldDirection().y
		if (y > 0.5) {
			return 'up'
		} else if (y < -0.5) {
			return 'down';
		} else {
			return 'middle'
		}
	}
	//Controls
	click(event) {
		$(':focus').blur()
		this.static_rclick = event.button === 2
		quad_previews.current = this;
		if (Transformer.hoverAxis !== null || !Keybinds.extra.preview_select.keybind.isTriggered(event)) return;
		event.preventDefault()
		var data = false;
		if (!display_mode) {
			var data = this.raycast(event)
		}
		if (data) {
			this.static_rclick = false
			if (Toolbox.selected.select_cubes !== false && data.type === 'cube') {
				if (Toolbox.selected.selectFace) {
					main_uv.setFace(data.face)
				}
				Blockbench.dispatchEvent( 'canvas_select', data )
				addToSelection(data.cube, event)
			}
			if (typeof Toolbox.selected.onCanvasClick === 'function') {
				Toolbox.selected.onCanvasClick(data)
			}
			return true;
		} else if (this.isOrtho && this.camOrtho.axis || this.movingBackground) {
			this.startSelRect(event)
		} else {
			return false;
		}
	}
	raycastMouseCoords(x,y) {
		var scope = this;
		var canvas_offset = $(scope.canvas).offset()
		scope.mouse.x = ((x - canvas_offset.left) / scope.width) * 2 - 1;
		scope.mouse.y = - ((y - canvas_offset.top) / scope.height) * 2 + 1;
		scope.raycaster.setFromCamera( scope.mouse, scope.camOrtho );
		return scope.raycaster.ray.origin
	}
	onTouchStart( event ) {
		event.preventDefault();
		event.clientX = event.touches[0].clientX;
		event.clientY = event.touches[0].clientY;
		this.click(event)
	}
	occupyTransformer() {
		Transformer.camera = this.isOrtho ? this.camOrtho : this.camPers
		Transformer.orbit_controls = this.controls
		Transformer.setCanvas(this.canvas)
		Transformer.updateVisibleAxes();
		//Transformer.fadeInControls(5)
		main_preview.controls.updateSceneScale()
		if (quad_previews) {
			quad_previews.hovered = this;
		}
		return this;
	}
	showContextMenu(event) {
		if (this.static_rclick) {
			var data = this.raycast()
			if (data && data.cube) {
				data.cube.showContextMenu(event)
			} else {
				this.menu.open(event, this)
			}
		}
		return this;
	}
	//Selection Rectangle
	startSelRect(event) {
		var scope = this;
		if (!display_mode || this.movingBackground) {
			this.sr_move_f = function(event) { scope.moveSelRect(event)}
			this.sr_stop_f = function(event) { scope.stopSelRect(event)}
			this.canvas.addEventListener('mousemove', 	this.sr_move_f, false)
			document.addEventListener('mouseup', 	this.sr_stop_f, false)
		}

		this.selection.start_x = event.clientX+0
		this.selection.start_y = event.clientY+0

		if (this.movingBackground) {
			this.background.before = {
				x: this.background.x,
				y: this.background.y,
				size: this.background.size
			}
			return
		};
		if (display_mode) return;

		$(this.canvas).parent().append(this.selection.box)
		this.selection.activated = settings.canvas_unselect.value;
		this.selection.old_selected = selected.slice();

		var ray = this.raycastMouseCoords(event.clientX, event.clientY)

		this.selection.start_u = ray[this.getUVAxes().u]
		this.selection.start_v = ray[this.getUVAxes().v]

		this.moveSelRect(event)
	}
	moveSelRect(event) {
		var scope = this;

		if (this.movingBackground) {
			if (event.shiftKey) {
				this.background.size = limitNumber( this.background.before.size + (event.clientY - this.selection.start_y), 0, 10e3)
			} else {
				this.background.x = this.background.before.x + (event.clientX - this.selection.start_x)/this.camOrtho.zoom
				this.background.y = this.background.before.y + (event.clientY - this.selection.start_y)/this.camOrtho.zoom
			}
			this.updateBackground()
			return;
		}

		var uv_axes = this.getUVAxes()
		//Overlay
		var c = getRectangle(
			this.selection.start_x,
			this.selection.start_y,
			event.clientX,
			event.clientY
		)
		if (this.movingBackground) return;
		this.selection.box.css('left', c.ax+'px')
		this.selection.box.css('top',  c.ay+'px')

		this.selection.box.css('width', c.x+'px')
		this.selection.box.css('height',c.y+'px')

		if (c.x + c.y > 40) {
			this.selection.activated = true
		}

		//Select
		if (!this.selection.activated) return;

		var ray = this.raycastMouseCoords(event.clientX, event.clientY)

		var plane_rect = getRectangle(
			this.selection.start_u,
			this.selection.start_v,
			ray[uv_axes.u],
			ray[uv_axes.v]
		)
		selected.length = 0;
		elements.forEach(function(cube) {
			
			if ((event.shiftKey || event.ctrlKey) && scope.selection.old_selected.indexOf(cube) >= 0) {
				var isSelected = true
			} else {
				var mesh = cube.getMesh()
				var from = 	new THREE.Vector3().copy(mesh.geometry.vertices[6]).applyMatrix4(mesh.matrixWorld)
				var to = 	new THREE.Vector3().copy(mesh.geometry.vertices[0]).applyMatrix4(mesh.matrixWorld)
				var cube_rect = getRectangle(
					from[uv_axes.u],
					from[uv_axes.v],
					to[uv_axes.u],
					to[uv_axes.v]
					//cube.from[getAxisNumber(uv_axes.u)],
					//cube.from[getAxisNumber(uv_axes.v)],
					//cube.to[getAxisNumber(uv_axes.u)],
					//cube.to[getAxisNumber(uv_axes.v)]
				)
				var isSelected = doRectanglesOverlap(plane_rect, cube_rect)
			}
			if (isSelected) {
				selected.push(cube)
			}
		})
		updateSelection()
	}
	stopSelRect(event) {
		var scope = this;
		this.canvas.removeEventListener('mousemove', this.sr_move_f)
		document.removeEventListener('mouseup',	this.sr_stop_f)
		if (this.movingBackground) {
			delete this.background.before
			return
		};
		this.selection.box.detach()
		this.selection.activated = false;
	}
	getUVAxes() {
		switch (this.camOrtho.axis) {
			case 'x': return {u: 'z', v: 'y'}; break;
			case 'y': return {u: 'x', v: 'z'}; break;
			case 'z': return {u: 'x', v: 'y'}; break;
		}
	}

	//Backgrounds
	getBackground() {
		if (display_mode) {
			var id = displayReferenceObjects.active.id
			if (id == 'monitor' ||id == 'bow') {
				this.background = canvas_scenes.monitor
			} else if (['inventory_nine', 'inventory_full', 'hud'].includes(id)) {
				this.background = canvas_scenes[id]
			} else {
				this.background = canvas_scenes.normal
			}
		} else if (this.isOrtho) {
			this.background = canvas_scenes['ortho'+this.angle]
		} else if (true) {
			this.background = canvas_scenes.normal
		}
		return this.background
	}
	loadBackground() {
		this.getBackground()
		if (this.background && this.background.image) {
			$(this.canvas).css('background-image', 'url("'+this.background.image.split('\\').join('/')+'")')
		} else {
			$(this.canvas).css('background-image', 'none')
		}
		this.updateBackground()
		return this;
	}
	updateBackground() {
		if (!this.background) return;
		var bg = this.background
		var zoom = (this.isOrtho === true && bg.lock === true) ? this.camOrtho.zoom : 1
		var pos_x = 0;
		var pos_y = 0;
		if (this.isOrtho === true && bg.lock !== false) {
			pos_x = this.camOrtho.backgroundHandle[0].n === true ? 1 : -1
			pos_x *= this.controls.target[this.camOrtho.backgroundHandle[0].a] * zoom * 40
			pos_y = this.camOrtho.backgroundHandle[1].n === true ? 1 : -1
			pos_y *= this.controls.target[this.camOrtho.backgroundHandle[1].a] * zoom * 40
		}
		pos_x += (bg.x * zoom) + this.width/2 - ( bg.size * zoom) / 2
		pos_y += (bg.y * zoom) + this.height/2 -((bg.size / bg.ratio||1) * zoom) / 2

		$(this.canvas).css('background-position-x', pos_x + 'px')
		$(this.canvas).css('background-position-y', pos_y + 'px')
		$(this.canvas).css('background-size',  bg.size * zoom +'px')
		return this;
	}
	clearBackground() {
		this.loadBackground()
		this.background.image = false
		this.background.size = limitNumber(this.background.size, 100, 2400)
		this.background.x = limitNumber(this.background.x, 0, this.width-30)
		this.background.y = limitNumber(this.background.y, 0, this.height-30)
		this.loadBackground()
		return this;
	}
	startMovingBackground() {
		this.movingBackground = true;
		this.controls.enabled_before = this.controls.enabled
		this.controls.enabled = false
		Blockbench.showMessageBox({
			translateKey: 'drag_background',
			icon: 'open_with'
		})
	}
	stopMovingBackground() {
		this.movingBackground = false;
		this.controls.enabled = this.controls.enabled_before
		delete this.controls.enabled_before
	}
	//Misc
	screenshot(options, cb) {
		var scope = this;
		function editVis(cb) {
			cb(three_grid)
			cb(Transformer)
			cb(outlines)
			cb(rot_origin)
			selected.forEach(function(obj) {
				var m = obj.getMesh()
				if (m && m.outline) {
					cb(m.outline)
				}
			})
		}

		editVis(function(obj) {
			obj.was_visible = obj.visible
			obj.visible = false
		})

		setTimeout(function() {

			var dataUrl = scope.canvas.toDataURL()

			dataUrl = dataUrl.replace('data:image/png;base64,','')
			Jimp.read(Buffer.from(dataUrl, 'base64'), function() {}).then(function(image) { 
				
				image.autocrop([0, false])
				if (options && options.width && options.height) {
					image.contain(options.width, options.height)
				}

				image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
					Screencam.returnScreenshot(dataUrl, cb)
				})
			});
	
			editVis(function(obj) {
				obj.visible = obj.was_visible
				delete obj.was_visible
			})

		}, 40)
	}
	fullscreen() {
		quad_previews.current = this;
		quad_previews.enabled = false;
		$('#preview').empty()
		$('#preview').append(this.canvas)
		resizeWindow()
		return this;
	}
	toggleFullscreen() {
		if (quad_previews.enabled) {
			this.fullscreen()
		} else {
			openQuadView()
		}
	}
}
	Preview.prototype.menu = new Menu([
		{icon: 'photo_camera', name: 'menu.preview.screenshot', click: function(preview) {
			preview.screenshot()
		}},
		{icon: 'wallpaper', name: 'menu.preview.background', children: function(preview) {
			var has_background = !!main_preview.background.image
			return [
				{icon: 'folder', name: 'menu.preview.background.load', click: function(preview) {
					Blockbench.import({
						extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif'],
						type: 'Image',
						readtype: 'image'
					}, function(files) {
						if (files) {
							preview.background.image = isApp ? files[0].path : files[0].content
							preview.loadBackground()
						}
					}, 'image', false)
				}},
				{icon: 'photo_size_select_large', name: 'menu.preview.background.position', condition: has_background, click: function(preview) {
					preview.startMovingBackground()
				}},
				{
					name: 'menu.preview.background.lock',
					condition: has_background && preview.background.lock !== null,
					icon: preview.background.lock?'check_box':'check_box_outline_blank', 
					click: function(preview) {
					preview.background.lock = !preview.background.lock
					preview.updateBackground()
				}},
				{icon: 'clear', name: 'menu.preview.background.remove', condition: has_background, click: function(preview) {
					preview.clearBackground()
				}}
			]
		}},
		{icon: 'videocam', name: 'menu.preview.perspective', condition: function(preview) {return !preview.movingBackground && !display_mode}, children: function(preview) {
			function getBtn(angle, pers) {
				var condition = (pers && !preview.isOrtho)
							 || (!pers && angle === preview.angle && preview.isOrtho);
				return condition ? 'radio_button_checked' : 'radio_button_unchecked'
			}
			return [
				{icon: getBtn(0, true), name: 'menu.preview.perspective.normal', click: function(preview) {preview.setNormalCamera()}},
				{icon: getBtn(0), name: 'direction.top',	color: 'y', click: function(preview) {preview.setOrthographicCamera(0)}},
				{icon: getBtn(1), name: 'direction.bottom',	color: 'y', click: function(preview) {preview.setOrthographicCamera(1)}},
				{icon: getBtn(2), name: 'direction.south',	color: 'z', click: function(preview) {preview.setOrthographicCamera(2)}},
				{icon: getBtn(3), name: 'direction.north', 	color: 'z', click: function(preview) {preview.setOrthographicCamera(3)}},
				{icon: getBtn(4), name: 'direction.east', 	color: 'x', click: function(preview) {preview.setOrthographicCamera(4)}},
				{icon: getBtn(5), name: 'direction.west', 	color: 'x', click: function(preview) {preview.setOrthographicCamera(5)}}
			]
		}},
		{icon: 'widgets', name: 'menu.preview.quadview', condition: function(preview) {return !quad_previews.enabled && !preview.movingBackground && !display_mode}, click: function() {
			openQuadView()
		}},
		{icon: 'web_asset', name: 'menu.preview.fullview', condition: function(preview) {return quad_previews.enabled && !preview.movingBackground && !display_mode}, click: function(preview) {
			preview.fullscreen()
		}},
		{icon: 'cancel', color: 'x', name: 'menu.preview.stop_drag', condition: function(preview) {return preview.movingBackground;}, click: function(preview) {
			preview.stopMovingBackground()
		}}
	])


function openQuadView() {
	quad_previews.enabled = true;

	$('#preview').empty()
	
	var wrapper1 = $('<div class="quad_canvas_wrapper qcw_x qcw_y"></div>')
	wrapper1.append(quad_previews.one.canvas)
	$('#preview').append(wrapper1)
	
	var wrapper2 = $('<div class="quad_canvas_wrapper qcw_y"></div>')
	wrapper2.append(quad_previews.two.canvas)
	$('#preview').append(wrapper2)
	
	var wrapper3 = $('<div class="quad_canvas_wrapper qcw_x"></div>')
	wrapper3.append(quad_previews.three.canvas)
	$('#preview').append(wrapper3)
	
	var wrapper4 = $('<div class="quad_canvas_wrapper"></div>')
	wrapper4.append(quad_previews.four.canvas)
	$('#preview').append(wrapper4)
	
	updateInterface()
}


//Init/Update
function initCanvas() {

	wireframeMaterial = new THREE.LineBasicMaterial({color: 0x74c2ff})
	previews = []
	
	//Objects
	scene = new THREE.Scene();
	display_scene = new THREE.Scene();
	display_area = new THREE.Object3D();
	display_base = new THREE.Object3D();
	display_scene.add(display_area)
	display_area.add(display_base)
	display_base.add(scene)
	scene.position.set(-8,-8,-8)

	scene.add(Vertexsnap.vertexes)
	Vertexsnap.vertexes.name = 'vertex_handles'

	outlines = new THREE.Object3D();
	outlines.name = 'outline_group'
	scene.add(outlines)

	var DScene = function(data) {
		data = data||{}
		this.name = data.name ? tl(data.name) : ''
		this.image = data.image||false
		this.size = data.size||1000
		this.x = data.x||0
		this.y = data.y||0
		this.lock = data.lock||false
	}

	canvas_scenes = {
		normal: 			new DScene({name: 'menu.preview.perspective.normal', lock: null}),
		ortho0: 			new DScene({name: 'direction.top', lock: true}),
		ortho1: 			new DScene({name: 'direction.bottom', lock: true}),
		ortho2: 			new DScene({name: 'direction.south', lock: true}),
		ortho3: 			new DScene({name: 'direction.north', lock: true}),
		ortho4: 			new DScene({name: 'direction.east', lock: true}),
		ortho5: 			new DScene({name: 'direction.west', lock: true}),

		monitor: 			new DScene({name: 'display.reference.monitor' }),

		inventory_nine: 	new DScene({name: 'display.reference.inventory_nine', image: './assets/inventory_nine.png', x: 0, y: -525, size: 1051, lock: true}),
		inventory_full: 	new DScene({name: 'display.reference.inventory_full', image: './assets/inventory_full.png', x: 0, y: -1740, size: 2781, lock: true}),
		hud: 				new DScene({name: 'display.reference.hud', image: './assets/hud.png', x: -224, y: -447.5, size: 3391, lock: true}),
	}
	if (localStorage.getItem('canvas_scenes')) {
		var stored_canvas_scenes = undefined;
		try {
			stored_canvas_scenes = JSON.parse(localStorage.getItem('canvas_scenes'))
		} catch (err) {}

		if (stored_canvas_scenes) {
			for (var key in canvas_scenes) {
				if (stored_canvas_scenes.hasOwnProperty(key)) {

					let store = stored_canvas_scenes[key]
					let real = canvas_scenes[key]

					if (store.image	!== undefined) {real.image = store.image}
					if (store.size	!== undefined) {real.size = store.size}
					if (store.x		!== undefined) {real.x = store.x}
					if (store.y		!== undefined) {real.y = store.y}
					if (store.lock	!== undefined) {real.lock = store.lock}
				}
			}
		}
	}
	active_scene = canvas_scenes.normal

	main_preview = new Preview({id: 'main'}).fullscreen()

	//TransformControls
	Transformer = new THREE.TransformControls(main_preview.camPers, main_preview.canvas)
	Transformer.setSize(0.5)
	Transformer.setTranslationSnap(canvasGridSize())
	scene.add(Transformer)
	main_preview.occupyTransformer()

	//Light
	Sun = new THREE.AmbientLight( 0xffffff );
	Sun.name = 'sun'
	scene.add(Sun);

	lights = new THREE.Object3D()
	lights.name = 'lights'
	
	var light_top = new THREE.DirectionalLight( 0x777777 );
	light_top.position.set(8, 100, 8)
	lights.add(light_top);

	var light_west = new THREE.DirectionalLight( 0x222222 );
	light_west.position.set(-100, 8, 8)
	lights.add(light_west);

	var light_east = new THREE.DirectionalLight( 0x222222 );
	light_east.position.set(100, 8, 8)
	lights.add(light_east);

	var light_north = new THREE.DirectionalLight( 0x444444 );
	light_north.position.set(8, 8, -100)
	lights.add(light_north);

	var light_south = new THREE.DirectionalLight( 0x444444 );
	light_south.position.set(8, 8, 100)
	lights.add(light_south);

	setShading()

	quad_previews = {
		one: new Preview({id: 'one'}).setOrthographicCamera(0),
		two: main_preview,
		three: new Preview({id: 'three'}).setOrthographicCamera(2),
		four: new Preview({id: 'four'}).setOrthographicCamera(4),
		current: main_preview
	}

	//emptyMaterial
	var img = new Image()
	img.src = 'assets/missing.png'
	var tex = new THREE.Texture(img)
	img.tex = tex;
	img.tex.magFilter = THREE.NearestFilter
	img.tex.minFilter = THREE.NearestFilter
	img.onload = function() {
		this.tex.needsUpdate = true;
	}
	emptyMaterials = []
	cubeColors.forEach(function(s, i) {
		var thismaterial = new THREE.MeshLambertMaterial({color: 0xffffff, map: tex})

		thismaterial.color.set(s.hex)
		emptyMaterials.push(thismaterial)
	})
	
	//transparentMaterial
	transparentMaterial = new THREE.MeshBasicMaterial({visible:false});

	var img = new Image();
	img.src = 'assets/north.png';
	var tex = new THREE.Texture(img);
	img.tex = tex;
	img.tex.magFilter = THREE.NearestFilter;
	img.tex.minFilter = THREE.NearestFilter;
	img.onload = function() {
		this.tex.needsUpdate = true;
	}
	//northMarkMaterial = new THREE.MeshBasicMaterial({color: new THREE.Color(parseInt(grid_color, 16)), map: tex, transparent: true})
	northMarkMaterial = new THREE.MeshBasicMaterial({map: tex, transparent: true, side: THREE.DoubleSide})
	
	resizeWindow()
}
function animate() {
	requestAnimationFrame( animate );
	previews.forEach(function(prev) {
		prev.render()
	})
	framespersecond++;
	if (display_mode === true && ground_animation === true) {
		groundAnimation()
	}
}
function resizeWindow(event) {
	if (!previews || (event && event.target && event.target !== window)) {
		return;
	}

	previews.forEach(function(prev) {
		if (prev.canvas.isConnected) {
			prev.resize()
		}
	})
	if (Interface.data) {
		updateInterfacePanels()
	}
	if (!Toolbars || !Toolbars[Toolbox.selected.toolbar]) return;
	Toolbars[Toolbox.selected.toolbar].children.forEach(function(action) {
		if (action.type === 'numslider') {
			action.setWidth(40)
		}
	})
	if ($('div.tool_options .toolbar').length > 0) {
		var sliders = $('header .tool.nslide_tool').length
		var space = $(window).width() - $('div.tool_options .toolbar').offset().left - $('div.tool_options .toolbar').width()
		var width = limitNumber(37 + space / sliders, 40, 80)
		Toolbars[Toolbox.selected.toolbar].children.forEach(function(action) {
			if (action.type === 'numslider') {
				action.setWidth(width)
			}
		})
	}
}
$(window).resize(resizeWindow)

function setShading() {
	scene.remove(lights)
	display_scene.remove(lights)
	Sun.intensity = 1
	if (settings.shading.value === true) {
		Sun.intensity = 0.65
		if (display_mode) {
			display_scene.add(lights)
		} else {
			scene.add(lights)
		}
	}
}
//Helpers
function buildGrid() {
	three_grid.children.length = 0;
	if (display_mode === true && settings.display_grid.value === false) return;

	three_grid.name = 'grid_group'
	var size, step;
	var grid_color = new THREE.Color(parseInt('0x'+app_colors.grid.hex.replace('#', ''), 16))
	var line_material = new THREE.LineBasicMaterial({color: grid_color});
	var material;

	northMarkMaterial.color = grid_color


	if (settings.full_grid.value === true) {
		size = 24
		step = canvasGridSize();

		var geometry = new THREE.Geometry();
		
		for ( var i = - size; i <= size; i += step) {
			geometry.vertices.push(new THREE.Vector3( -size, 0, i))
			geometry.vertices.push(new THREE.Vector3( size, 0, i))
			geometry.vertices.push(new THREE.Vector3(i, 0, -size))
			geometry.vertices.push(new THREE.Vector3(i, 0, size))
		}
		var line = new THREE.Line( geometry, line_material, THREE.LinePieces);
		if (Blockbench.entity_mode === true) {
			line.position.set(0,0,0)
		} else { 
			line.position.set(8,0,8)
		}
		three_grid.add(line)
		line.name = 'grid'


		//Axis Helpers
		geometry = new THREE.Geometry();
		material = new THREE.LineBasicMaterial({color: gizmo_colors.r});
		geometry.vertices.push(new THREE.Vector3( -16, 0.001, -16))
		geometry.vertices.push(new THREE.Vector3( 32, 0.001, -16))
		x_axis = new THREE.Line( geometry, material, THREE.LinePieces);
		three_grid.add(x_axis)

		geometry = new THREE.Geometry();
		material = new THREE.LineBasicMaterial({color: gizmo_colors.b});
		geometry.vertices.push(new THREE.Vector3( -16, 0.001, -16))
		geometry.vertices.push(new THREE.Vector3( -16, 0.001, 32))
		z_axis = new THREE.Line( geometry, material, THREE.LinePieces);
		three_grid.add(z_axis)

		//North
		geometry = new THREE.PlaneGeometry(5, 5)
		var north_mark = new THREE.Mesh(geometry, northMarkMaterial)

		if (Blockbench.entity_mode === true) {
			north_mark.position.set(0,0,-27)
		} else {
			north_mark.position.set(8,0,-19)
		}
		north_mark.rotation.x = Math.PI / -2
		three_grid.add(north_mark)

	} else {
		if (settings.large_grid.value === true) {
			var geometry_big = new THREE.Geometry();
			size = 24
			step = 16;
			
			for ( var i = - size; i <= size; i += step) {
				geometry_big.vertices.push(new THREE.Vector3( -size, 0, i))
				geometry_big.vertices.push(new THREE.Vector3( size, 0, i))
				geometry_big.vertices.push(new THREE.Vector3(i, 0, -size))
				geometry_big.vertices.push(new THREE.Vector3(i, 0, size))
			}

			var line_big = new THREE.Line( geometry_big, line_material, THREE.LinePieces);
			if (Blockbench.entity_mode === true) {
				line_big.position.set(0,0,0)
			} else { 
				line_big.position.set(8,0,8)
			}
			line_big.name = 'grid'
			three_grid.add(line_big)

		}


		if (settings.base_grid.value === true) {
			size = 8
			step = canvasGridSize();

			var geometry = new THREE.Geometry();
			
			 for ( var i = - size; i <= size; i += step) {
				 geometry.vertices.push(new THREE.Vector3( -size, 0, i))
				 geometry.vertices.push(new THREE.Vector3( size, 0, i))
				 geometry.vertices.push(new THREE.Vector3(i, 0, -size))
				 geometry.vertices.push(new THREE.Vector3(i, 0, size))
			 }
			var line = new THREE.Line( geometry, line_material, THREE.LinePieces);
			if (Blockbench.entity_mode === true) {
				line.position.set(0,0,0)
			} else { 
				line.position.set(8,0,8)
			}
			three_grid.add(line)
			
			line.name = 'grid'

			//Axis Helpers
			geometry = new THREE.Geometry();
			material = new THREE.LineBasicMaterial({color: '#EE4040'});
			geometry.vertices.push(new THREE.Vector3( 0, 0.001, 0))
			geometry.vertices.push(new THREE.Vector3( (Blockbench.entity_mode ? 8 : 16), 0.001, 0))
			x_axis = new THREE.Line( geometry, material, THREE.LinePieces);
			three_grid.add(x_axis)

			geometry = new THREE.Geometry();
			material = new THREE.LineBasicMaterial({color: '#547CEA'});
			geometry.vertices.push(new THREE.Vector3( 0, 0.001, 0))
			geometry.vertices.push(new THREE.Vector3( 0, 0.001, (Blockbench.entity_mode ? 8 : 16)))
			z_axis = new THREE.Line( geometry, material, THREE.LinePieces);
			three_grid.add(z_axis)

			//North
			geometry = new THREE.PlaneGeometry(2.4, 2.4)
			var north_mark = new THREE.Mesh(geometry, northMarkMaterial)
			if (Blockbench.entity_mode === true) {
				north_mark.position.set(0,0,-9.5)
			} else {
				north_mark.position.set(8,0,-1.5)
			}
			north_mark.rotation.x = Math.PI / -2
			three_grid.add(north_mark)
		}
	}
	if (settings.large_box.value === true) {
		var geometry_box = new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(48, 48, 48));

		var large_box = new THREE.LineSegments( geometry_box, line_material);
		if (Blockbench.entity_mode === true) {
			large_box.position.set(0,8,0)
		} else { 
			large_box.position.set(8,8,8)
		}
		large_box.name = 'peter'
		three_grid.add(large_box)
	}
	scene.add(three_grid)

	//Origin

	if (setupGrid !== true) {
		var helper1 = new THREE.AxesHelper(2)
		var helper2 = new THREE.AxesHelper(2)
		helper1.rotation.x = Math.PI / 1

		helper2.rotation.x = Math.PI / -1
		helper2.rotation.y = Math.PI / 1
		helper2.scale.y = -1

		rot_origin.add(helper1)
		rot_origin.add(helper2)

		rot_origin.rotation.reorder('ZYX')

		setupGrid = true;
	}
}
function setOriginHelper(obj) {

	rot_origin.position.x = obj.origin[0]
	rot_origin.position.y = obj.origin[1]
	rot_origin.position.z = obj.origin[2]

	rot_origin.rotation.x = Math.degToRad( obj.rotation[0] )
	rot_origin.rotation.y = Math.degToRad( obj.rotation[1] )
	rot_origin.rotation.z = Math.degToRad( obj.rotation[2] )

	scene.add(rot_origin)
}
function centerTransformer(offset) {
	if (selected.length === 0) return;
	var first_obj


	//Getting Center

	var center = [0, 0, 0]
	var i = 0;
	selected.forEach(function(obj) {
		i = 0;
		while (i < 3) {
			center[i] += obj.from[i]
			center[i] += obj.to[i]
			i++;
		}
		if (!first_obj && obj.visibility) {
			first_obj = obj
		}
	})
	if (!first_obj) {
		return;
	}
	i = 0;
	while (i < 3) {
		center[i] = center[i] / (selected.length * 2)
		i++;
	}
	var vec = new THREE.Vector3(center[0], center[1], center[2])



	//Position + Rotation
	if (Blockbench.entity_mode === false) {

		//Blockmodel Mode

		Transformer.rotation.set(0, 0, 0)

		if (selected.length === 1 && first_obj.rotation !== undefined) {
			vec.x -= first_obj.origin[0]
			vec.y -= first_obj.origin[1]
			vec.z -= first_obj.origin[2]
			if (first_obj.getMesh()) {
				vec.applyEuler(first_obj.getMesh().rotation)
			}
			vec.x += first_obj.origin[0]
			vec.y += first_obj.origin[1]
			vec.z += first_obj.origin[2]
		}
		Transformer.position.copy(vec)

		if (first_obj.rotation !== undefined && Blockbench.globalMovement === false) {
			Transformer.rotation.x = Math.PI / (180 /first_obj.rotation[0])
			Transformer.rotation.y = Math.PI / (180 /first_obj.rotation[1])
			Transformer.rotation.z = Math.PI / (180 /first_obj.rotation[2])
		} 
	} else {

		//Entity Mode

		var group;
		if (selected_group) {
			var group = selected_group
		} else {
			var i = 0;
			while (i < selected.length) {
				if (typeof selected[i].parent === 'object' &&
					selected[i].parent.type === 'group'
				) {
					var group = selected[i].parent
					i = selected.length
				}
				i++;
			}
		}
		if (group) {
			vec.x -= group.origin[0]
			vec.y -= group.origin[1]
			vec.z -= group.origin[2]
			vec.applyEuler(first_obj.getMesh().rotation)
			vec.x += group.origin[0]
			vec.y += group.origin[1]
			vec.z += group.origin[2]
		}
		Transformer.position.copy(vec)
		if (Blockbench.globalMovement === false) {
			var rotation = 
			Transformer.rotation.copy(first_obj.getMesh().rotation)
		} else {
			Transformer.rotation.set(0, 0, 0)
		}
	}

	if (offset !== undefined) {
		Transformer.position.add(offset)
	}
}
//Display
function getRescalingFactor(angle) {
	switch (Math.abs(angle)) {
		case 0:
			return 1.4142
			break;
		case 22.5:
			return 1.127
			break;
		case 67.5:
			return 1.127
			break;
		case 45:
			return 1.4142
			break;
		default:
			return 1;
			break;
	}
}
function getUVArray(side, frame, stretch) {
	if (stretch === undefined) {
		stretch = -1
	} else {
		stretch = stretch*(-1)
	}
	var arr = [
		new THREE.Vector2(side.uv[0]/16, (side.uv[1]/16)/stretch+1),  //0,1
		new THREE.Vector2(side.uv[0]/16, (side.uv[3]/16)/stretch+1),  //0,0
		new THREE.Vector2(side.uv[2]/16, (side.uv[3]/16)/stretch+1),   //1,0
		new THREE.Vector2(side.uv[2]/16, (side.uv[1]/16)/stretch+1)  //1,1
	]
	if (frame > 0 && stretch !== -1) {
		//Animate
		var offset = (1/stretch) * frame
		arr[0].y += offset
		arr[1].y += offset
		arr[2].y += offset
		arr[3].y += offset
	}
	var rot = (side.rotation+0)
	while (rot > 0) {
		arr.push(arr.shift())
		rot = rot-90;
	}
	return arr;
}
class CanvasController {
	constructor() {
		this.materials = []
		this.meshes = []
		this.outlineMaterial = new THREE.LineBasicMaterial({linewidth: 2})
		this.face_order = ['east', 'west', 'up', 'down', 'south', 'north']
	}
	raycast(event) {
		var preview = Canvas.getCurrentPreview()
		if (preview) {
			return preview.raycast(event)
		} else {
			return false
		}
	}
	getCurrentPreview() {
		var canvas = $('canvas.preview:hover').get(0)
		if (canvas) return canvas.preview
	}
	clear() {
		var objects = []
		scene.children.forEach(function(s) {
			if (s.isElement === true || s.isGroup === true) {
				objects.push(s)
			}
		})
		objects.forEach(function(s) {
			scene.remove(s)
			if (s.geometry) s.geometry.dispose()
			if (s.outline && s.outline.geometry) s.outline.geometry.dispose()
			delete Canvas.meshes[s.name]
		})
	}
	updateAll() {
		updateNslideValues()
		Canvas.clear()
		elements.forEach(function(s) {
			if (s.visibility == true) {
				Canvas.addCube(s)
			}
		})
		updateSelection()
	}
	updateSelected(arr) {
		if (!arr) {
			arr = selected
		}
		arr.forEach(function(obj) {
			var mesh = obj.getMesh()
			if (mesh !== undefined) {
				scene.remove(mesh)
			}
			if (obj.visibility == true) {
				Canvas.addCube(obj)
			}
		})
		updateSelection()
	}
	updateIndexes() {
		var lut = []
		elements.forEach(function(s, i) {
			var obj = s.getMesh();
			if (obj !== undefined) {
				obj.name = s.uuid;
				lut.push(obj)
			}
		})
		scene.children.forEach(function(s, i) {
			if (s.isElement === true) {
				if (lut.indexOf(s) === -1) {
					scene.remove(s)
				}
			}
		})
		updateSelection()
	}
	addCube(s) {
		//This does NOT remove old cubes

		//Material
		if (Prop.wireframe === false) {
			var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
			Canvas.adaptObjectFaces(s, mesh)
		} else {
			var mesh = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), wireframeMaterial);
		}

		Canvas.adaptObjectPosition(s, mesh)
		mesh.name = s.uuid;
		mesh.type = 'cube';
		mesh.isElement = true;
		scene.add(mesh)
		Canvas.meshes[s.uuid] = mesh
		if (Prop.wireframe === false) {
			Canvas.updateUV(s)
		}
		Canvas.buildOutline(s)
	}
	adaptObjectPosition(obj, mesh, parent) {
		if (!mesh) mesh = obj.getMesh()

		function setSize(geo) {
			if (Blockbench.entity_mode && obj.inflate !== undefined) {
				var inflate = obj.inflate
				geo.from([ obj.from[0]-inflate, obj.from[1]-inflate, obj.from[2]-inflate ])
				geo.to(  [ obj.to[0]  +inflate, obj.to[1]  +inflate, obj.to[2]  +inflate ])
			} else {
				geo.from(obj.from)
				geo.to(obj.to)
			}
		}

		if (Prop.wireframe === true) {
			var proxy_box = new THREE.BoxGeometry(1, 1, 1)
			setSize(proxy_box)
			proxy_box.computeBoundingSphere()
			mesh.geometry = new THREE.EdgesGeometry(proxy_box)
			mesh.vertices = proxy_box.vertices
		} else {
			setSize(mesh.geometry)
			mesh.geometry.computeBoundingSphere()
		}
		mesh.scale.set(1, 1, 1)
		mesh.rotation.set(0, 0, 0)

		if (Blockbench.entity_mode) {
			mesh.position.set(0, 0, 0)
			mesh.rotation.reorder('YZX')
			if (obj.parent !== 'root' &&
				typeof obj.parent === 'object' &&
				obj.parent.rotation.join('_') !== '0_0_0'
			) {
				var origin = obj.parent.origin
				if (parent) {
					origin = [parent.position.x, parent.position.y, parent.position.z]
				}
				mesh.position.fromArray(origin)
				mesh.geometry.translate(-origin[0], -origin[1], -origin[2])

				obj.parent.rotation.forEach(function(n, i) {
					mesh.rotation[getAxisLetter(i)] = Math.PI / (180 / n) * (i == 2 ? -1 : 1)
				})

				if (parent) {
					mesh.rotation.set(
						mesh.rotation.x + parent.rotation.x,
						mesh.rotation.y + parent.rotation.y,
						mesh.rotation.z + parent.rotation.z
					)
				}
			}

		} else if (obj.rotation !== undefined) {

			mesh.rotation.reorder('XYZ')
			mesh.position.set(obj.origin[0], obj.origin[1], obj.origin[2])
			mesh.geometry.translate(-obj.origin[0], -obj.origin[1], -obj.origin[2])

			mesh.rotation.x = Math.PI / (180 /obj.rotation[0])
			mesh.rotation.y = Math.PI / (180 /obj.rotation[1])
			mesh.rotation.z = Math.PI / (180 /obj.rotation[2])

			if (obj.rescale === true) {

				var rescale = getRescalingFactor(obj.rotation.angle);
				mesh.scale.set(rescale, rescale, rescale)
				if (obj.rotationAxis()) {
					mesh.scale[obj.rotationAxis()] = 1
				}
			}
		} else {
			mesh.position.set(0, 0, 0)
		}
		Canvas.buildOutline(obj)
	}
	updatePositions(leave_selection) {
		updateNslideValues()
		var arr = selected.slice()
		if (Blockbench.entity_mode && selected_group) {
			selected_group.children.forEach(function(s) {
				if (s.type === 'cube') {
					if (!arr.includes(s)) {
						arr.push(s)
					}
				}
			})
		}
		arr.forEach(function(obj) {
			if (obj.visibility == true) {
				Canvas.adaptObjectPosition(obj)
			}
		})
		if (leave_selection !== true) {
			updateSelection()
		}
	}
	updateAllPositions(leave_selection) {
		updateNslideValues()
		elements.forEach(function(obj) {
			if (obj.visibility == true) {
				Canvas.adaptObjectPosition(obj)
			}
		})
		if (leave_selection !== true) {
			updateSelection()
		}
	}
	updateVisibility() {
		elements.forEach(function(s) {
			var mesh = s.getMesh()
			if (s.visibility == true) {
				if (!mesh) {
					Canvas.addCube(s)
				} else if (!scene.children.includes(mesh)) {
					scene.add(mesh)
					if (!Prop.wireframe) {
						Canvas.adaptObjectPosition(s, mesh)
						Canvas.adaptObjectFaces(s, mesh)
						Canvas.updateUV(s)
					}
				}
			} else {
				scene.remove(mesh)
			}
		})
		updateSelection()
	}
	updateRenderSides() {
		textures.forEach(function(t) {
			var mat = Canvas.materials[t.uuid]
			if (mat) {
				mat.side = display_mode || Blockbench.entity_mode ? 2 : 0
			}
		})
	}
	adaptObjectFaces(obj, mesh) {
		if (Prop.wireframe === true) return;
		if (!mesh) mesh = obj.getMesh()
		var materials = []

		this.face_order.forEach(function(face) {

			if (obj.faces.hasOwnProperty(face)) {

				var tex = getTextureById(obj.faces[face].texture)
				if (typeof tex !== 'object') {
					materials.push(emptyMaterials[obj.color])
				} else {
					materials.push(Canvas.materials[tex.uuid])
				}
			}
		})
		mesh.material = materials
	}
	updateSelectedFaces() {
		if (Prop.wireframe === true) return;
		selected.forEach(function(obj) {
			if (obj.visibility == true) {
				Canvas.adaptObjectFaces(obj)
				Canvas.updateUV(obj)
			}
		})
	}
	updateAllFaces(texture) {
		if (Prop.wireframe === true) return;
		elements.forEach(function(s, i) {
			if (s.visibility == true) {
				var used = true;
				if (texture) {
				 	used = false;
					for (var face in s.faces) {
						if (s.faces[face] && s.faces[face].texture === '#'+texture.id) {
				 			used = true;
						}
					}
				}
				if (used === true) {
					Canvas.adaptObjectFaces(s)
					Canvas.updateUV(s)
				}
			}
		})
	}
	updateUVs() {
		if (Prop.wireframe === true) return;
		selected.forEach(function(obj) {
			if (obj.visibility == true) {
				Canvas.updateUV(obj)
			}
		})
	}
	updateAllUVs() {
		if (Prop.wireframe === true) return;
		elements.forEach(function(obj) {
			if (obj.visibility == true) {
				Canvas.updateUV(obj)
			}
		})
	}
	updateUV(obj, animation, force_entity_mode) {
		if (Prop.wireframe === true) return;
		var mesh = obj.getMesh()
		if (mesh === undefined) return;
		mesh.geometry.faceVertexUvs[0] = [];

		if (Blockbench.entity_mode || force_entity_mode) {

			var size = obj.size(undefined, true)
			
			var face_list = [   
				{face: 'north', fIndex: 10,	from: [size[2], size[2]],			 	size: [size[0],  size[1]]},
				{face: 'east', fIndex: 0,	from: [0, size[2]],				   		size: [size[2],  size[1]]},
				{face: 'south', fIndex: 8,	from: [size[2]*2 + size[0], size[2]], 	size: [size[0],  size[1]]},
				{face: 'west', fIndex: 2,	from: [size[2] + size[0], size[2]],   	size: [size[2],  size[1]]},
				{face: 'up', fIndex: 4,		from: [size[2]+size[0], size[2]],	 	size: [-size[0], -size[2]]},
				{face: 'down', fIndex: 6,	from: [size[2]+size[0]*2, 0],		 	size: [-size[0], size[2]]}
			]
			var cube_mirror  = obj.shade === false

			if (cube_mirror) {
				face_list.forEach(function(f) {
					f.from[0] += f.size[0]
					f.size[0] *= -1
				})
				//East+West
				
				var p = {}

				p.from = face_list[1].from.slice()
				p.size = face_list[1].size.slice()

				face_list[1].from = face_list[3].from.slice()
				face_list[1].size = face_list[3].size.slice()

				face_list[3].from = p.from.slice()
				face_list[3].size = p.size.slice()

			}
			face_list.forEach(function(f) {

				f.from[0] /= Project.texture_width  / 16
				f.from[1] /= Project.texture_height / 16 
				f.size[0] /= Project.texture_width  / 16
				f.size[1] /= Project.texture_height / 16
				var data = {
					uv: [
						f.from[0]			 + Math.floor(obj.uv_offset[0]+0.0000001) / Project.texture_width  * 16,
						f.from[1]			 + Math.floor(obj.uv_offset[1]+0.0000001) / Project.texture_height * 16,
						f.from[0] + f.size[0] + Math.floor(obj.uv_offset[0]+0.0000001) / Project.texture_width  * 16,
						f.from[1] + f.size[1] + Math.floor(obj.uv_offset[1]+0.0000001) / Project.texture_height * 16
					]
				}
				data.uv.forEach(function(s, si) {
					data.uv[si] *= 1
				})

				obj.faces[f.face].uv[0] = data.uv[0]
				obj.faces[f.face].uv[1] = data.uv[1]
				obj.faces[f.face].uv[2] = data.uv[2]
				obj.faces[f.face].uv[3] = data.uv[3]

				var uvArray = getUVArray(data, 0)
				mesh.geometry.faceVertexUvs[0][f.fIndex] = [
					uvArray[0],
					uvArray[1],
					uvArray[3]
				];
				mesh.geometry.faceVertexUvs[0][f.fIndex+1] = [
					uvArray[1],
					uvArray[2],
					uvArray[3]
				];
			})

		} else {
		
			var obj = obj.faces
			var stretch = 1
			var frame = 0
			for (var face in obj) {
				if (obj.hasOwnProperty(face)) {
					var fIndex = 0;
					switch(face) {
						case 'north':   fIndex = 10;break;
						case 'east':	fIndex = 0;	break;
						case 'south':   fIndex = 8;	break;
						case 'west':	fIndex = 2;	break;
						case 'up':	  	fIndex = 4;	break;
						case 'down':	fIndex = 6;	break;
					}
					stretch = 1
					frame = 0
					if (obj[face].texture && obj[face].texture !== '$transparent') {
						var tex = getTextureById(obj[face].texture)
						if (typeof tex === 'object' && tex.constructor.name === 'Texture' && tex.frameCount) {
							stretch = tex.frameCount
							if (animation === true && tex.currentFrame) {
								frame = tex.currentFrame
							}
						}
					}
					var uvArray = getUVArray(obj[face], frame, stretch)
					mesh.geometry.faceVertexUvs[0][fIndex] = [
						uvArray[0],
						uvArray[1],
						uvArray[3]
					];
					mesh.geometry.faceVertexUvs[0][fIndex+1] = [
						uvArray[1],
						uvArray[2],
						uvArray[3]
					];
				}
			}

		}
		mesh.geometry.elementsNeedUpdate = true;
		return mesh.geometry
	}
	buildOutline(obj) {
		if (obj.visibility == false) return;
		var mesh = obj.getMesh()
		if (mesh === undefined) return;
		mesh.remove(mesh.outline)

		var geo = new THREE.EdgesGeometry(mesh.geometry);
		var wireframe = new THREE.LineSegments(geo, Canvas.outlineMaterial)
		wireframe.name = obj.uuid+'_outline'
		wireframe.visible = obj.selected
		mesh.outline = wireframe
		mesh.add(wireframe)
	}
	outlineObjects(arr) {
		arr.forEach(function(obj) {
			if (!obj.visibility) return;
			var mesh = obj.getMesh()
			if (mesh === undefined) return;

			var geo = new THREE.EdgesGeometry(mesh.geometry);
			var wireframe = new THREE.LineSegments(geo, Canvas.outlineMaterial)

			wireframe.position.copy(mesh.position)
			wireframe.rotation.copy(mesh.rotation)
			wireframe.scale.copy(mesh.scale)

			wireframe.name = obj.uuid+'_ghost_outline'
			outlines.add(wireframe)
		})
	}
}
var Canvas = new CanvasController()
