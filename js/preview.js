var scene, main_preview, previews,
	Sun, lights,
	emptyMaterials, northMarkMaterial,
	outlines, wireframeMaterial,
	Transformer,
	canvas_scenes,
	display_scene, display_area, display_base;
var framespersecond = 0;
var display_mode = false;
var doRender = false;
var quad_previews = {};
const three_grid = new THREE.Object3D();
const rot_origin = new THREE.Object3D();
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
		this.controls.zoomSpeed = 1.5

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
		this.canvas.addEventListener('mouseup',		function(event) { scope.showContextMenu(event)}, false)
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
		scene.traverse(function(s) {
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
		this.renderer.render(
			display_mode
				? display_scene
				: scene,
			this.isOrtho
				? this.camOrtho
				: this.camPers
		)
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
		this.setNormalCamera()
		return this;
	}
	getFacingDirection() {
		var vec = new THREE.Vector3()
		this.controls.object.getWorldDirection(vec)
		vec.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4).ceil()
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
		var y = this.controls.object.getWorldDirection(new THREE.Vector3()).y
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

		var data = this.raycast(event)
		if (data) {
			this.static_rclick = false
			if (Toolbox.selected.selectCubes && Modes.selected.selectCubes && data.type === 'cube') {
				if (Toolbox.selected.selectFace) {
					main_uv.setFace(data.face)
				}
				Blockbench.dispatchEvent( 'canvas_select', data )
				if (Animator.open || (Toolbox.selected.id === 'rotate_tool' && Blockbench.entity_mode)) {
					if (data.cube.parent.type === 'group') {
						data.cube.parent.select()
					}
				} else {
					data.cube.select(event)
				}
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
		if (this.static_rclick && event.which === 3) {
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
				var mesh = cube.mesh
				var from = 	new THREE.Vector3().copy(mesh.geometry.vertices[6]).applyMatrix4(mesh.matrixWorld)
				var to = 	new THREE.Vector3().copy(mesh.geometry.vertices[0]).applyMatrix4(mesh.matrixWorld)
				var cube_rect = getRectangle(
					from[uv_axes.u],
					from[uv_axes.v],
					to[uv_axes.u],
					to[uv_axes.v]
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
	backgroundPositionDialog() {
		var scope = this;
		var dialog = new Dialog({
			id: 'background_position',
			title: 'message.set_background_position.title',
			lines: [
				`<div class="dialog_bar">
					<input type="number" class="dark_bordered" value="${scope.background.x}" id="background_pos_x">
					<input type="number" class="dark_bordered" value="${scope.background.y}" id="background_pos_y">
					<input type="number" class="dark_bordered" value="${scope.background.size}" id="background_size">
				</div>`
			],
			onConfirm: function() {
				var coords = [
					parseFloat( $(dialog.object).find('#background_pos_x').val() ),
					parseFloat( $(dialog.object).find('#background_pos_y').val() ),
					parseFloat( $(dialog.object).find('#background_size').val() )
				]
				dialog.hide()
				if (!scope.background) return;
				
				if (!isNaN(coords[0])) { scope.background.x 	= coords[0] }
				if (!isNaN(coords[1])) { scope.background.y 	= coords[1] }
				if (!isNaN(coords[2])) { scope.background.size	= coords[2] }

				scope.updateBackground()
			}
		})
		dialog.show()
	}
	//Misc
	screenshot(options, cb) {
		var scope = this;
		function editVis(edit) {
			edit(three_grid)
			edit(Transformer)
			edit(outlines)
			edit(rot_origin)
			edit(Vertexsnap.vertexes)
			selected.forEach(function(obj) {
				var m = obj.mesh
				if (m && m.outline) {
					edit(m.outline)
				}
			})
		}

		editVis(obj => {
			obj.was_visible = obj.visible
			obj.visible = false
		})
		var ground_anim_before = ground_animation
		if (display_mode && ground_animation) {
			ground_animation = false
		}

		setTimeout(function() {

			var dataUrl = scope.canvas.toDataURL()

			dataUrl = dataUrl.replace('data:image/png;base64,','')
			Jimp.read(Buffer.from(dataUrl, 'base64')).then(function(image) { 
				
				image.autocrop([0, false])
				if (options && options.width && options.height) {
					image.contain(options.width, options.height)
				}

				image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
					Screencam.returnScreenshot(dataUrl, cb)
				})
			});
	
			editVis(obj => {
				obj.visible = obj.was_visible
				delete obj.was_visible
			})
			if (display_mode && ground_anim_before) {
				ground_animation = ground_anim_before
			}

		}, 40)
	}
	fullscreen() {
		quad_previews.current = this;
		quad_previews.enabled = false;
		$('#preview').empty()

		var wrapper = $('<div class="single_canvas_wrapper"></div>')
		wrapper.append(this.canvas)
		$('#preview').append(wrapper)
		
		previews.forEach(function(prev) {
			if (prev.canvas.isConnected) {
				prev.resize()
			}
		})
		if (Interface.data) {
			updateInterfacePanels()
		}
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
		{icon: 'icon-player', name: 'settings.display_skin', condition: () => (display_mode && displayReferenceObjects.active.id === 'player'), click: function() {
			changeDisplaySkin()
		}},
		{icon: 'wallpaper', name: 'menu.preview.background', children: function(preview) {
			var has_background = !!preview.background.image
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
				{icon: 'photo_size_select_large', name: 'menu.preview.background.set_position', condition: has_background, click: function(preview) {
					preview.backgroundPositionDialog()
				}},
				{
					name: 'menu.preview.background.lock',
					condition: (has_background && preview.background.lock !== null && preview.isOrtho),
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
		{icon: 'videocam', name: 'menu.preview.perspective', condition: function(preview) {return !preview.movingBackground && !display_mode && !Animator.open}, children: function(preview) {
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
		{icon: 'widgets', name: 'menu.preview.quadview', condition: function(preview) {return !quad_previews.enabled && !preview.movingBackground && !display_mode && !Animator.open}, click: function() {
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

	scene.name = 'scene'
	display_base.name = 'display_base'
	display_area.name = 'display_area'
	display_scene.name = 'display_scene'

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
		var thismaterial = new THREE.MeshLambertMaterial({
			color: 0xffffff,
			map: tex,
			side: display_mode || Blockbench.entity_mode ? 2 : 0
		})

		thismaterial.color.set(s.hex)
		emptyMaterials.push(thismaterial)
	})

	var img = new Image();
	img.src = 'assets/north.png';
	var tex = new THREE.Texture(img);
	img.tex = tex;
	img.tex.magFilter = THREE.NearestFilter;
	img.tex.minFilter = THREE.NearestFilter;
	img.onload = function() {
		this.tex.needsUpdate = true;
	}
	northMarkMaterial = new THREE.MeshBasicMaterial({
		map: tex,
		transparent: true,
		side: THREE.DoubleSide,
		alphaTest: 0.2
	})

	//Rotation Pivot
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
	
	resizeWindow()
}
function animate() {
	requestAnimationFrame( animate );
	previews.forEach(function(prev) {
		prev.render()
	})
	framespersecond++;
	if (display_mode === true && ground_animation === true && !Transformer.hoverAxis) {
		DisplayMode.groundAnimation()
	}
}

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
	gizmo_colors.grid = new THREE.Color(parseInt('0x'+app_colors.grid.hex.replace('#', ''), 16))
	var material;

	northMarkMaterial.color = gizmo_colors.grid

	function setupAxisLine(origin, length, axis) {
		var color = 'rgb'[getAxisNumber(axis)]
		var geometry = new THREE.Geometry();
		var material = new THREE.LineBasicMaterial({color: gizmo_colors[color]});

		var dest = new THREE.Vector3().copy(origin)
		dest[axis] += length
		geometry.vertices.push(origin)
		geometry.vertices.push(dest)

		var line = new THREE.Line( geometry, material);
		line.name = 'axis_line_'+axis;
		three_grid.add(line)
	}
	//Axis Lines
	if (settings.base_grid.value || settings.full_grid.value)
	if (Blockbench.entity_mode || !settings.full_grid.value) {
		var length = Blockbench.entity_mode
			? (settings.full_grid.value ? 24 : 8)
			: 16
		setupAxisLine(new THREE.Vector3( 0, 0.001, 0), length, 'x')
		setupAxisLine(new THREE.Vector3( 0, 0.001, 0), length, 'z')

	} else {
		setupAxisLine(new THREE.Vector3( -16, 0.001, -16), 48, 'x')
		setupAxisLine(new THREE.Vector3( -16, 0.001, -16), 48, 'z')
	}


	if (settings.full_grid.value === true) {
		//Grid
		var grid = new THREE.GridHelper(48, 48/canvasGridSize(), gizmo_colors.grid, gizmo_colors.grid)
		if (Blockbench.entity_mode === true) {
			grid.position.set(0,0,0)
		} else { 
			grid.position.set(8,0,8)
		}
		three_grid.add(grid)
		grid.name = 'grid'

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
			//Grid
			var grid = new THREE.GridHelper(48, 3, gizmo_colors.grid, gizmo_colors.grid)
			if (Blockbench.entity_mode === true) {
				grid.position.set(0,0,0)
			} else { 
				grid.position.set(8,0,8)
			}
			grid.name = 'grid'
			three_grid.add(grid)
		}

		if (settings.base_grid.value === true) {
			//Grid
			var grid = new THREE.GridHelper(16, 16/canvasGridSize(), gizmo_colors.grid, gizmo_colors.grid)

			if (Blockbench.entity_mode === true) {
				grid.position.set(0,0,0)
			} else { 
				grid.position.set(8,0,8)
			}
			grid.name = 'grid'
			three_grid.add(grid)

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

		var line_material = new THREE.LineBasicMaterial({color: gizmo_colors.grid});
		var large_box = new THREE.LineSegments( geometry_box, line_material);
		if (Blockbench.entity_mode === true) {
			large_box.position.set(0,8,0)
		} else { 
			large_box.position.set(8,8,8)
		}
		large_box.name = 'grid'
		three_grid.add(large_box)
	}
	scene.add(three_grid)
}
function centerTransformer(offset) {
	if (selected.length === 0) return;

	var rotate_tool = Toolbox.selected.transformerMode === 'rotate'

	if (Animator.open && selected_group) {
		var g_mesh = selected_group.mesh

		g_mesh.getWorldPosition(Transformer.position)
		Transformer.position.x += 8;
		Transformer.position.y += 8;
		Transformer.position.z += 8;
		Transformer.rotation.set(0, 0, 0)
		Transformer.update()

		//if (!rotate_tool) {
		//	var quat = new THREE.Quaternion()
		//	g_mesh.getWorldQuaternion(quat)
		//	Transformer.rotation.setFromQuaternion(quat, 'ZYX')
		//} else {
		//}
		return;
	}

	//Getting Center
	if (Blockbench.entity_mode) {
		Canvas.updateAllBones()
	}
	if (!rotate_tool) {
		var first_obj
		var center = [0, 0, 0]
		var i = 0;
		selected.forEach(function(obj) {
			var m = obj.mesh
			if (obj.visibility && m) {
				var pos = new THREE.Vector3(
					obj.from[0] + obj.size(0)/2,
					obj.from[1] + obj.size(1)/2,
					obj.from[2] + obj.size(2)/2
				)
				if (!Blockbench.entity_mode) {

					pos.x -= obj.origin[0]
					pos.y -= obj.origin[1]
					pos.z -= obj.origin[2]
					var r = m.getWorldQuaternion(new THREE.Quaternion())
					pos.applyQuaternion(r)
					pos.x += obj.origin[0]
					pos.y += obj.origin[1]
					pos.z += obj.origin[2]
				} else {
					var r = m.getWorldQuaternion(new THREE.Quaternion())
					pos.applyQuaternion(r)
					pos.add(m.getWorldPosition(new THREE.Vector3()))
					pos.x += 8
					pos.y += 8
					pos.z += 8
				}

				center[0] += pos.x
				center[1] += pos.y
				center[2] += pos.z

				if (!first_obj) {
					first_obj = obj
				}
			}
		})
		if (!first_obj) {
			return;
		}
		i = 0;
		while (i < 3) {
			center[i] = center[i] / selected.length
			i++;
		}
	} else {
		var first_obj = selected[0]
		var center = first_obj.origin
	}
	var vec = new THREE.Vector3(center[0], center[1], center[2])

	//Position + Rotation
	if (Blockbench.entity_mode === false) {

		//Blockmodel Mode
		Transformer.rotation.set(0, 0, 0)
		Transformer.position.copy(vec)

		var mesh = first_obj.mesh
		if (mesh && Blockbench.globalMovement === false && !rotate_tool) {
			Transformer.rotation.copy(mesh.rotation)
		}
	} else {
		//Entity Mode

		if (selected_group && rotate_tool) {
			var mesh = selected_group.mesh
			if (mesh) {
				mesh.getWorldPosition(Transformer.position)
			}
			Transformer.position.x += 8
			Transformer.position.y += 8
			Transformer.position.z += 8

			Transformer.rotation.set(0, 0, 0)
			return;
		}

		var group;
		if (selected_group) {
			group = selected_group
		} else {
			var i = 0;
			while (i < selected.length) {
				if (typeof selected[i].parent === 'object' &&
					selected[i].parent.type === 'group'
				) {
					group = selected[i].parent
					i = selected.length
				}
				i++;
			}
		}
		if (group) {
			vec.x -= group.origin[0]
			vec.y -= group.origin[1]
			vec.z -= group.origin[2]
			vec.applyEuler(first_obj.mesh.rotation)
			vec.x += group.origin[0]
			vec.y += group.origin[1]
			vec.z += group.origin[2]
		}
		Transformer.position.copy(vec)
		if (Blockbench.globalMovement === false && !rotate_tool) {
			var rotation = new THREE.Quaternion()
			first_obj.mesh.getWorldQuaternion(rotation)
			Transformer.rotation.setFromQuaternion( rotation )
		} else {
			Transformer.rotation.set(0, 0, 0)
		}
	}
	Transformer.update()
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
		this.materials = {}
		this.meshes = {}
		this.bones = {}
		this.outlineMaterial = new THREE.LineBasicMaterial({
			linewidth: 2,
			transparent: true
		})
		this.wireframeMaterial = new THREE.MeshBasicMaterial({
			color: 0x00FF00,
			wireframe: true
		});
		this.transparentMaterial = new THREE.MeshBasicMaterial({visible:false});
		this.face_order = ['east', 'west', 'up', 'down', 'south', 'north']
	}
	//Misc
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
	//Main updaters
	clear() {
		var objects = []
		scene.traverse(function(s) {
			if (s.isElement === true || s.isGroup === true) {
				objects.push(s)
			}
		})
		objects.forEach(function(s) {
			if (s.parent) {
				s.parent.remove(s)
			}
			if (s.geometry) s.geometry.dispose()
			if (s.outline && s.outline.geometry) s.outline.geometry.dispose()
			delete Canvas.meshes[s.name]
		})
	}
	updateAll() {
		updateNslideValues()
		Canvas.clear()
		Canvas.updateAllBones()
		elements.forEach(function(s) {
			if (s.visibility == true) {
				Canvas.addCube(s)
			}
		})
		updateSelection()
	}
	updateAllPositions(leave_selection) {
		updateNslideValues()
		elements.forEach(Canvas.adaptObjectPosition)
		if (leave_selection !== true) {
			updateSelection()
		}
	}
	updateVisibility() {
		elements.forEach(function(s) {
			var mesh = s.mesh
			if (s.visibility == true) {
				if (!mesh) {
					Canvas.addCube(s)
				} else if (!scene.children.includes(mesh)) {
					scene.add(mesh)
					Canvas.adaptObjectPosition(s, mesh)
					Canvas.adaptObjectFaces(s, mesh)
					if (!Prop.wireframe) {
						Canvas.updateUV(s)
					}
				}
			} else if (mesh && mesh.parent) {
				mesh.parent.remove(mesh)
			}
		})
		updateSelection()
	}
	updateAllFaces(texture) {
		elements.forEach(function(obj) {
			if (obj.visibility == true) {
				var used = true;
				if (texture) {
				 	used = false;
					for (var face in obj.faces) {
						if (obj.faces[face] && obj.faces[face].texture === '#'+texture.id) {
				 			used = true;
						}
					}
				}
				if (used === true) {
					Canvas.adaptObjectFaces(obj)
					if (!Prop.wireframe) {
						Canvas.updateUV(obj)
					}
				}
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
	updateRenderSides() {
		textures.forEach(function(t) {
			var mat = Canvas.materials[t.uuid]
			if (mat) {
				mat.side = (display_mode || Blockbench.entity_mode) ? 2 : 0
			}
		})
		emptyMaterials.forEach(function(mat) {
			mat.side = (display_mode || Blockbench.entity_mode) ? 2 : 0
		})
	}
	//Selection updaters
	updateSelected(arr) {
		if (!arr) {
			arr = selected
		}
		arr.forEach(function(obj) {
			var mesh = obj.mesh
			if (mesh !== undefined) {
				mesh.parent.remove(mesh)
			}
			if (obj.visibility == true) {
				Canvas.addCube(obj)
			}
		})
		updateSelection()
	}
	updatePositions(leave_selection) {
		updateNslideValues()
		var arr = selected.slice()
		if (Blockbench.entity_mode && selected_group) {
			selected_group.forEachChild(obj => {
				if (obj.type === 'cube') {
					arr.safePush(obj)
				}
			})
			if (arr.length === selected.length) {
				Canvas.updateAllBones()
			}
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
	updateSelectedFaces() {
		selected.forEach(function(obj) {
			if (obj.visibility == true) {
				Canvas.adaptObjectFaces(obj)
				if (!Prop.wireframe) {
					Canvas.updateUV(obj)
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
	outlineObjects(arr) {
		arr.forEach(function(obj) {
			if (!obj.visibility) return;
			var mesh = obj.mesh
			if (mesh === undefined) return;

			var line = Canvas.getOutlineMesh(mesh)

			mesh.getWorldPosition(line.position)
			line.position.sub(scene.position)
			line.rotation.setFromQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()))
			line.scale.copy(mesh.scale)

			line.name = obj.uuid+'_ghost_outline'
			outlines.add(line)
		})
	}
	updateAllBones() {

		getAllOutlinerGroups().forEach((obj) => {
			let mesh = obj.mesh
			if (obj.visibility && mesh) {

				mesh.rotation.reorder('ZYX')
				obj.rotation.forEach(function(n, i) {
					mesh.rotation[getAxisLetter(i)] = Math.PI / (180 / n) * (i == 2 ? -1 : 1)
				})
				mesh.position.fromArray(obj.origin)
				mesh.scale.x = mesh.scale.y = mesh.scale.z = 1

				if (obj.parent.type === 'group') {

					mesh.position.x -=  obj.parent.origin[0]
					mesh.position.y -=  obj.parent.origin[1]
					mesh.position.z -=  obj.parent.origin[2]

					var parent_mesh = obj.parent.mesh
					parent_mesh.add(mesh)
				} else {
					scene.add(mesh)
				}
				mesh.updateMatrixWorld()

				mesh.fix_position = mesh.position.clone()
				mesh.fix_rotation = mesh.rotation.clone()
			}
		})
	}
	//Object handlers
	addCube(obj) {
		//This does NOT remove old cubes
		var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
		Canvas.adaptObjectFaces(obj, mesh)

		Canvas.adaptObjectPosition(obj, mesh)
		mesh.name = obj.uuid;
		mesh.type = 'cube';
		mesh.isElement = true;
		//scene.add(mesh)
		Canvas.meshes[obj.uuid] = mesh
		if (Prop.wireframe === false) {
			Canvas.updateUV(obj)
		}
		Canvas.buildOutline(obj)
	}
	adaptObjectPosition(obj, mesh, parent) {
		if (!obj.visibility) return;
		
		if (!mesh || mesh > 0) mesh = obj.mesh

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

		setSize(mesh.geometry)
		mesh.geometry.computeBoundingSphere()

		mesh.scale.set(1, 1, 1)
		mesh.rotation.set(0, 0, 0)

		if (Blockbench.entity_mode) {
			mesh.position.set(0, 0, 0)
			mesh.rotation.reorder('YZX')
			if (obj.parent.type === 'group') {
				obj.parent.mesh.add(mesh)
				mesh.position.x -=  obj.parent.origin[0]
				mesh.position.y -=  obj.parent.origin[1]
				mesh.position.z -=  obj.parent.origin[2]
			} else {
				scene.add(mesh)
			}
		} else {
			if (obj.rotation !== undefined) {

				mesh.rotation.reorder('ZYX')
				mesh.position.set(obj.origin[0], obj.origin[1], obj.origin[2])
				mesh.geometry.translate(-obj.origin[0], -obj.origin[1], -obj.origin[2])

				mesh.rotation.x = Math.PI / (180 /obj.rotation[0])
				mesh.rotation.y = Math.PI / (180 /obj.rotation[1])
				mesh.rotation.z = Math.PI / (180 /obj.rotation[2])

				if (obj.rescale === true) {
					var axis = obj.rotationAxis()||'y'

					var rescale = getRescalingFactor(obj.rotation[getAxisNumber(axis)]);
					mesh.scale.set(rescale, rescale, rescale)
					mesh.scale[axis] = 1
				}
			} else {
				mesh.position.set(0, 0, 0)
			}
			scene.add(mesh)
		}
		Canvas.buildOutline(obj)
		mesh.updateMatrixWorld()
	}
	ascendElementPosition(el, elmesh) {
		function iterate(obj, mesh) {
			//Iterate inside (cube) > outside
			if (!mesh) {
				mesh = obj.mesh
			}
			if (obj.type === 'group') {
				mesh.rotation.reorder('ZYX')
				obj.rotation.forEach(function(n, i) {
					mesh.rotation[getAxisLetter(i)] = Math.PI / (180 / n) * (i == 2 ? -1 : 1)
				})
				mesh.updateMatrixWorld()
			}
			mesh.fix_rotation = mesh.rotation.clone()

			if (obj.type === 'group') {
				mesh.position.fromArray(obj.origin)
				mesh.scale.x = mesh.scale.y = mesh.scale.z = 1
			}

			if (typeof obj.parent === 'object') {

				mesh.position.x -=  obj.parent.origin[0]
				mesh.position.y -=  obj.parent.origin[1]
				mesh.position.z -=  obj.parent.origin[2]
			}
			mesh.fix_position = mesh.position.clone()

			if (typeof obj.parent === 'object') {
				var parent_mesh = iterate(obj.parent)
				parent_mesh.add(mesh)
			} else {
				scene.add(mesh)
			}
			return mesh
		}
		iterate(el, elmesh)
	}
	adaptObjectFaces(obj, mesh) {
		if (!mesh) mesh = obj.mesh
		if (!mesh) return;
		if (!Prop.wireframe) {
			var materials = []
			this.face_order.forEach(function(face) {

				if (obj.faces[face].texture === null) {
					materials.push(Canvas.transparentMaterial)

				} else {
					var tex = getTextureById(obj.faces[face].texture)
					if (typeof tex === 'object') {
						materials.push(Canvas.materials[tex.uuid])
					} else {
						materials.push(emptyMaterials[obj.color])
					}
				}
			})
			mesh.material = materials
		} else {
			mesh.material = Canvas.wireframeMaterial
		}
	}
	updateUV(obj, animation, force_entity_mode) {
		if (Prop.wireframe === true) return;
		var mesh = obj.mesh
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
				var uv= [
					f.from[0]			 +  obj.uv_offset[0] / Project.texture_width  * 16,
					f.from[1]			 +  obj.uv_offset[1] / Project.texture_height * 16,
					f.from[0] + f.size[0] + obj.uv_offset[0] / Project.texture_width  * 16,
					f.from[1] + f.size[1] + obj.uv_offset[1] / Project.texture_height * 16
				]
				uv.forEach(function(s, si) {
					uv[si] *= 1
				})

				obj.faces[f.face].uv[0] = uv[0]
				obj.faces[f.face].uv[1] = uv[1]
				obj.faces[f.face].uv[2] = uv[2]
				obj.faces[f.face].uv[3] = uv[3]

				var do_cl = Math.random()<0.001

				//Fight Bleeding
				for (var si = 0; si < 2; si++) {
					let margin = 16/(si?Project.texture_height:Project.texture_width)/16;
					if (uv[si] > uv[si+2]) {
						margin = -margin
					}
					uv[si] += margin
					uv[si+2] -= margin
				}

				Canvas.updateUVFace(mesh.geometry.faceVertexUvs[0], f.fIndex, {uv: uv}, 0)
			})

		} else {
		
			var obj = obj.faces
			var stretch = 1
			var frame = 0
			for (var face in obj) {
				if (obj.hasOwnProperty(face)) {
					stretch = 1
					frame = 0
					if (obj[face].texture && obj[face].texture !== null) {
						var tex = getTextureById(obj[face].texture)
						if (typeof tex === 'object' && tex.constructor.name === 'Texture' && tex.frameCount) {
							stretch = tex.frameCount
							if (animation === true && tex.currentFrame) {
								frame = tex.currentFrame
							}
						}
					}
					Canvas.updateUVFace(mesh.geometry.faceVertexUvs[0], Canvas.face_order.indexOf(face)*2, obj[face], frame, stretch)
				}
			}

		}
		mesh.geometry.elementsNeedUpdate = true;
		return mesh.geometry
	}
	updateUVFace(vertex_uvs, index, face, frame, stretch) {
		if (stretch === undefined) {
			stretch = -1
		} else {
			stretch = stretch*(-1)
		}
		if (!vertex_uvs[index]) vertex_uvs[index] = [];
		if (!vertex_uvs[index+1]) vertex_uvs[index+1] = [];
		var arr = [
			vertex_uvs[index][0],
			vertex_uvs[index][1],
			vertex_uvs[index+1][1],
			vertex_uvs[index+1][2],
		]
		for (var i = 0; i < 4; i++) {
			if (arr[i] === undefined) {
				arr[i] = new THREE.Vector2()
			}
		}
		
		arr[0].set(face.uv[0]/16, (face.uv[1]/16)/stretch+1),  //0,1
		arr[1].set(face.uv[0]/16, (face.uv[3]/16)/stretch+1),  //0,0
		arr[2].set(face.uv[2]/16, (face.uv[3]/16)/stretch+1),   //1,0
		arr[3].set(face.uv[2]/16, (face.uv[1]/16)/stretch+1)  //1,1

		if (frame > 0 && stretch !== -1) {
			//Animate
			var offset = (1/stretch) * frame
			arr[0].y += offset
			arr[1].y += offset
			arr[2].y += offset
			arr[3].y += offset
		}
		var rot = (face.rotation+0)
		while (rot > 0) {
			arr.push(arr.shift())
			rot = rot-90;
		}
		vertex_uvs[index] = [
			arr[0],
			arr[1],
			arr[3]
		];
		vertex_uvs[index+1] = [
			arr[1],
			arr[2],
			arr[3]
		];
	}
	//Outline
	getOutlineMesh(mesh) {
		var vs = mesh.geometry.vertices
		var geometry = new THREE.Geometry()
		geometry.vertices = [
			vs[2], vs[3],
			vs[6], vs[7],
			vs[2], vs[0],
			vs[1], vs[4],
			vs[5], vs[0],
			vs[5], vs[7],
			vs[6], vs[4],
			vs[1], vs[3]
		]
		return new THREE.Line(geometry, Canvas.outlineMaterial)
	}
	buildOutline(obj) {
		if (obj.visibility == false) return;
		var mesh = obj.mesh;
		if (mesh === undefined) return;

		if (mesh.outline) {
			mesh.outline.geometry.verticesNeedUpdate = true;
			return;
		}
		mesh.remove(mesh.outline);

		var line = Canvas.getOutlineMesh(mesh);
		line.name = obj.uuid+'_outline';
		line.visible = obj.selected;
		line.renderOrder = 2;
		line.frustumCulled = false;
		mesh.outline = line;
		mesh.add(line);
	}
}
const Canvas = new CanvasController()

BARS.defineActions(function() {
	new Action({
		id: 'toggle_wireframe',
		icon: 'border_clear',
		category: 'view',
		keybind: new Keybind({key: 90}),
		condition: () => Toolbox && Toolbox.selected && Toolbox.selected.allowWireframe,
		click: function () {
			Prop.wireframe = !Prop.wireframe
			Canvas.updateAll()
		}
	})

	new Action({
		id: 'screenshot_model',
		icon: 'fa-cubes',
		category: 'view',
		keybind: new Keybind({key: 80, ctrl: true}),
		click: function () {quad_previews.current.screenshot()}
	})
	new Action({
		id: 'record_model_gif',
		icon: 'local_movies',
		category: 'view',
		click: function () {
			var lines = [
				{label: 'dialog.create_gif.length', node: '<input class="dark_bordered half" type="number" value="10" step="0.25" id="gif_length">'},
				{label: 'dialog.create_gif.fps', node: '<input class="dark_bordered half" type="number" value="10" id="gif_fps">'},
				{label: 'dialog.create_gif.compression', node: '<input class="dark_bordered half" type="number" value="4" id="gif_quality">'},
			]
			if (Animator.open) {
				lines.push({label: 'dialog.create_gif.play', node: '<input type="checkbox" id="gif_play_animation">'})
			}
			var dialog = new Dialog({
				id: 'create_gif',
				title: tl('dialog.create_gif.title'),
				draggable: true,
				lines: lines,
				onConfirm: function() {
					var jq = $(dialog.object)
					var length = parseFloat( jq.find('#gif_length').val() )
					var fps = parseInt( jq.find('#gif_fps').val() )
					var quality = parseInt( jq.find('#gif_quality').val() )
					if (jq.find('#gif_play_animation').is(':checked')) {
						Timeline.start()
					}
					Screencam.createGif({
						length: limitNumber(length, 0.1, 240)*1000,
						fps: limitNumber(fps, 0.5, 30),
						quality: limitNumber(quality, 0, 30),
					}, Screencam.returnScreenshot)
					dialog.hide()
				}
			})
			dialog.show()
		}
	})
	new Action({
		id: 'screenshot_app',
		icon: 'icon-bb_interface',
		category: 'view',
		condition: isApp,
		click: function () {Screencam.fullScreen()}
	})
	new Action({
		id: 'toggle_quad_view',
		icon: 'widgets',
		category: 'view',
		keybind: new Keybind({key: 9}),
		click: function () {
			main_preview.toggleFullscreen()
		}
	})
	new Action({
		id: 'camera_reset',
		name: 'direction.top',
		description: 'direction.top',
		icon: 'videocam',
		category: 'view',
		keybind: new Keybind({key: 96}),
		click: function () {
			quad_previews.current.resetCamera()
		}
	})
	new Action({
		id: 'camera_normal',
		name: 'menu.preview.perspective.normal',
		description: 'menu.preview.perspective.normal',
		icon: 'videocam',
		category: 'view',
		keybind: new Keybind({key: 101}),
		click: function () {
			quad_previews.current.setNormalCamera()
		}
	})

	new Action({
		id: 'camera_top',
		name: 'direction.top',
		description: 'direction.top',
		icon: 'videocam',
		color: 'y',
		category: 'view',
		keybind: new Keybind({key: 104}),
		click: function () {
			quad_previews.current.setOrthographicCamera(0)
		}
	})
	new Action({
		id: 'camera_bottom',
		name: 'direction.bottom',
		description: 'direction.bottom',
		icon: 'videocam',
		color: 'y',
		category: 'view',
		keybind: new Keybind({key: 98}),
		click: function () {
			quad_previews.current.setOrthographicCamera(1)
		}
	})
	new Action({
		id: 'camera_south',
		name: 'direction.south',
		description: 'direction.south',
		icon: 'videocam',
		color: 'z',
		category: 'view',
		keybind: new Keybind({key: 100}),
		click: function () {
			quad_previews.current.setOrthographicCamera(2)
		}
	})
	new Action({
		id: 'camera_north',
		name: 'direction.north',
		description: 'direction.north',
		icon: 'videocam',
		color: 'z',
		category: 'view',
		keybind: new Keybind({key: 102}),
		click: function () {
			quad_previews.current.setOrthographicCamera(3)
		}
	})
	new Action({
		id: 'camera_east',
		name: 'direction.east',
		description: 'direction.east',
		icon: 'videocam',
		color: 'x',
		category: 'view',
		keybind: new Keybind({key: 103}),
		click: function () {
			quad_previews.current.setOrthographicCamera(4)
		}
	})
	new Action({
		id: 'camera_west',
		name: 'direction.west',
		description: 'direction.west',
		icon: 'videocam',
		color: 'x',
		category: 'view',
		keybind: new Keybind({key: 105}),
		click: function () {
			quad_previews.current.setOrthographicCamera(5)
		}
	})
})
