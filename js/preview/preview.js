var scene, main_preview, previews,
	Sun, lights,
	emptyMaterials,
	outlines,
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
	b: new THREE.Color(0x2d5ee8),
	grid: new THREE.Color(0x495061),
	wire: new THREE.Color(0x576f82),
	outline: new THREE.Color(0x3e90ff)
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
		this.camPers = new THREE.PerspectiveCamera(45, 16 / 9, 1, 30000)
		this.camOrtho = new THREE.OrthographicCamera(-600,  600, -400, 400, 0.5, 200);
		this.camOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: false, a: 'y'}]
		this.camOrtho.axis = null
		this.camOrtho.zoom = 0.4
		this.camPers.preview = this.camOrtho.preview = this;
		for (var i = 4; i <= 6; i++) {
			this.camPers.layers.enable(i);
		}

		//Controls
		this.controls = new THREE.OrbitControls(this.camPers, this);
		this.controls.minDistance = 1;
		this.controls.maxDistance = 3960;
		this.controls.enableKeys = false;
		this.controls.zoomSpeed = 1.5;

		//Annotations
		this.annotations = {};
		this.updateAnnotations = function() {
			for (var key in scope.annotations) {
				var tag = scope.annotations[key];
				if (tag.object.visible) {
					var pos = tag.object.toScreenPosition(scope.camera, scope.canvas);
					$(tag.node).css('left', pos.x+'px');
					$(tag.node).css('top', pos.y+'px');
				}
			}
		}
		this.controls.onUpdate(() => setTimeout(() => {
			scope.updateAnnotations();
		}, 6))
		this.addAnnotation = function(key, tag) {
			scope.annotations[key] = tag;
			$(tag.node).insertBefore(scope.canvas);
			scope.updateAnnotations();
		}
		this.removeAnnotation = function(key) {
			if (scope.annotations[key]) {
				$(scope.annotations[key].node).detach();
				delete scope.annotations[key];
			}
		}

		this.resetCamera(true)

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
			box: $('<div id="selection_box", class="selection_rectangle"></div>') 
		}

		this.raycaster = new THREE.Raycaster()
		this.mouse = new THREE.Vector2();
		addEventListeners(this.canvas, 'mousedown touchstart', 	function(event) { scope.click(event)}, { passive: false })
		addEventListeners(this.canvas, 'mousemove touchmove', 	function(event) { scope.static_rclick = false}, false)
		addEventListeners(this.canvas, 'mousemove', 			function(event) { scope.mousemove(event)}, false)
		addEventListeners(this.canvas, 'mouseup touchend',		function(event) { scope.showContextMenu(event)}, false)
		addEventListeners(this.canvas, 'dblclick', 				function(event) {Toolbox.toggleTransforms(event)}, false)
		addEventListeners(this.canvas, 'mouseenter touchstart', function(event) { scope.occupyTransformer(event)}, false)

		Blockbench.addDragHandler('preview_'+this.id, {
			extensions: ['jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif'],
			element: this.canvas,
			readtype: 'image',
		}, function(files) {
			if (!scope.background.imgtag) {
				scope.background.imgtag = new Image();
			}
			if (isApp) {
				scope.background.image = files[0].path
			} else {
				scope.background.image = files[0].content
			}
			scope.loadBackground()
		})

		previews.push(this)
	}
	//Render
	resize() {
		if (!this.canvas.isConnected) return;
		this.height = this.canvas.parentElement.clientHeight;
		this.width  = this.canvas.parentElement.clientWidth;

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
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.updateBackground()
		return this;
	}
	raycast(event) {
		convertTouchEvent(event);
		var canvas_offset = $(this.canvas).offset()
		this.mouse.x = ((event.clientX - canvas_offset.left) / this.width) * 2 - 1;
		this.mouse.y = - ((event.clientY - canvas_offset.top) / this.height) * 2 + 1;
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
				var obj = elements.findInArray('uuid', intersects[0].object.name)
				switch (Math.floor( intersects[0].faceIndex / 2 )) {
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
	get camera() {
		return this.isOrtho ? this.camOrtho : this.camPers;
	}
	setNormalCamera() {
		this.isOrtho = false;
		this.camOrtho.axis = null
		this.resize()
		this.controls.object = this.camPers;
		if (Transformer.camera == this.camOrtho) {
			Transformer.camera = this.camPers;
			Transformer.update();
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
		var dist = 64
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
			this.camOrtho.axis = null;
			angle = 1;
			this.camOrtho.position.copy(this.camPers.position);
			this.controls.enableRotate = true;
			break;
		}
		this.loadBackground();

		var layer = getAxisNumber(this.camOrtho.axis)+1;
		this.camOrtho.layers.set(0);
		this.camOrtho.layers.enable(layer);
		for (var i = 1; i <= 3; i++) {
			if (i != layer) {
				this.camOrtho.layers.enable(i+3);
			}
		}

		Transformer.update();
		this.resize()
		this.controls.updateSceneScale();
		return this;
	}
	resetCamera(init) {
		var dis = 40;
		this.controls.target.set(0, 8+scene.position.y, 0);
		this.camPers.position.set(-dis, dis*0.8, -dis)
		if (!init) {
			this.setNormalCamera()
		}
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
		event.preventDefault();
		$(':focus').blur();
		unselectInterface(event);
		convertTouchEvent(event);
		this.static_rclick = event.which === 3 || event.type == 'touchstart';
		if (event.type == 'touchstart') {
			this.rclick_cooldown = setTimeout(() => {
				this.rclick_cooldown = true;
			}, 420)
		}
		quad_previews.current = this;
		if (Transformer.hoverAxis !== null || (!Keybinds.extra.preview_select.keybind.isTriggered(event) && event.which !== 0)) return;

		var data = this.raycast(event);
		if (data) {
			//this.static_rclick = false
			if (Toolbox.selected.selectCubes && Modes.selected.selectCubes && data.type === 'cube') {
				if (Toolbox.selected.selectFace) {
					main_uv.setFace(data.face, false)
				}
				Blockbench.dispatchEvent('canvas_select', data)
				if (Modes.paint) {
					event = 0;
				}
				if (Format.bone_rig && (
					Animator.open ||
					(!Format.rotate_cubes  && ['rotate_tool', 'pivot_tool'].includes(Toolbox.selected.id)) ||
					event.shiftKey
				)) {
					if (data.cube.parent.type === 'group') {
						data.cube.parent.select().showInOutliner();
					}
				} else {
					data.cube.select(event)
				}
			}
			if (typeof Toolbox.selected.onCanvasClick === 'function') {
				Toolbox.selected.onCanvasClick(data)
			}
			return true;
		}
		if (typeof Toolbox.selected.onCanvasClick === 'function') {
			Toolbox.selected.onCanvasClick(0)
		}

		if (this.isOrtho && this.camOrtho.axis || this.movingBackground) {
			this.startSelRect(event)
		} else {
			return false;
		}
	}
	mousemove(event) {
		var data = this.raycast(event);
		if (Settings.get('highlight_cubes')) updateCubeHighlights(data && data.cube);
	}
	raycastMouseCoords(x,y) {
		var scope = this;
		var canvas_offset = $(scope.canvas).offset()
		scope.mouse.x = ((x - canvas_offset.left) / scope.width) * 2 - 1;
		scope.mouse.y = - ((y - canvas_offset.top) / scope.height) * 2 + 1;
		scope.raycaster.setFromCamera( scope.mouse, scope.camOrtho );
		return scope.raycaster.ray.origin
	}
	occupyTransformer(event) {
		Transformer.camera = this.isOrtho ? this.camOrtho : this.camPers
		Transformer.orbit_controls = this.controls
		Transformer.setCanvas(this.canvas)
		main_preview.controls.updateSceneScale()
		if (quad_previews) {
			quad_previews.hovered = this;
		}
		if (event && event.type == 'touchstart') {
			Transformer.simulateMouseDown(event);
		}
		return this;
	}
	showContextMenu(event, force) {
		Prop.active_panel = 'preview';
		if (this.static_rclick && (event.which === 3 || (event.type == 'touchend' && this.rclick_cooldown == true))) {
			var data = this.raycast(event)
			if (Toolbox.selected.selectCubes && Modes.selected.selectCubes && data && data.cube) {
				data.cube.showContextMenu(event)
			} else {
				this.menu.open(event, this)
			}
		}
		clearTimeout(this.rclick_cooldown);
		delete this.rclick_cooldown;
		return this;
	}
	//Selection Rectangle
	startSelRect(event) {
		var scope = this;
		if (Modes.edit || this.movingBackground) {
			this.sr_move_f = function(event) { scope.moveSelRect(event)}
			this.sr_stop_f = function(event) { scope.stopSelRect(event)}
			document.addEventListener('mousemove', 	this.sr_move_f, false)
			document.addEventListener('mouseup', 	this.sr_stop_f, false)
		}

		this.selection.start_x = event.offsetX+0
		this.selection.start_y = event.offsetY+0
		this.selection.client_x = event.clientX+0
		this.selection.client_y = event.clientY+0

		if (this.movingBackground) {
			this.background.before = {
				x: this.background.x,
				y: this.background.y,
				size: this.background.size
			}
			return
		};
		if (!Modes.edit) return;

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
				this.background.size = limitNumber( this.background.before.size + (event.offsetY - this.selection.start_y), 0, 10e3)
			} else {
				this.background.x = this.background.before.x + (event.offsetX - this.selection.start_x)/this.camOrtho.zoom
				this.background.y = this.background.before.y + (event.offsetY - this.selection.start_y)/this.camOrtho.zoom
			}
			this.updateBackground()
			return;
		}

		var uv_axes = this.getUVAxes()
		//Overlay
		var c = getRectangle(
			Math.clamp(this.selection.start_x, -2, this.width),
			Math.clamp(this.selection.start_y, -2, this.height),
			Math.clamp(this.selection.start_x + (event.clientX - this.selection.client_x), -2, this.width),
			Math.clamp(this.selection.start_y + (event.clientY - this.selection.client_y), -2, this.height),
		)
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
		unselectAll()
		elements.forEach(function(cube) {

			if ((event.shiftKey || event.ctrlOrCmd) && scope.selection.old_selected.indexOf(cube) >= 0) {
				var isSelected = true
			} else {
				if (cube instanceof Cube && cube.visibility && cube.mesh) {
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
				} else if (cube instanceof Locator && cube.parent instanceof Group && cube.parent.mesh) {
					var mesh = cube.parent.mesh;
					var pos = new THREE.Vector3().fromArray(cube.from).applyMatrix4(mesh.matrixWorld);
					var cube_rect = getRectangle(
						pos[uv_axes.u],
						pos[uv_axes.v],
						pos[uv_axes.u],
						pos[uv_axes.v]
					)
					var isSelected = doRectanglesOverlap(plane_rect, cube_rect)
				}
			}
			if (isSelected) {
				cube.selectLow()
			}
		})
		updateSelection()
	}
	stopSelRect(event) {
		var scope = this;
		document.removeEventListener('mousemove', this.sr_move_f)
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
		} else {
			this.background = canvas_scenes.normal
		}
		return this.background
	}
	loadBackground() {
		this.getBackground()
		if (this.background && this.background.image) {
			if (!this.background.imgtag) this.background.imgtag = new Image();
			this.background.imgtag.src = this.background.image;
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
		if (this.movingBackground) {
			this.stopMovingBackground()
		}
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
		if (this.movingBackground) {
			this.stopMovingBackground()
		}
		var dialog = new Dialog({
			id: 'background_position',
			title: tl('message.set_background_position.title'),
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
		if (!options) options = 0;

		Canvas.withoutGizmos(function() {

			scope.render()
			var dataUrl = scope.canvas.toDataURL()

			if (options.crop == false && !options.width && !options.height) {
				Screencam.returnScreenshot(dataUrl, cb)
			}

			dataUrl = dataUrl.replace('data:image/png;base64,','')
			Jimp.read(Buffer.from(dataUrl, 'base64')).then(function(image) { 
				
				if (display_mode && display_slot === 'gui' && options.crop !== false) {
					var zoom = display_preview.camOrtho.zoom * devicePixelRatio
					var resolution = 256 * zoom;

					var start_x = display_preview.width *devicePixelRatio/2 - display_preview.controls.target.x*zoom*40 - resolution/2;
					var start_y = display_preview.height*devicePixelRatio/2 + display_preview.controls.target.y*zoom*40 - resolution/2;
					
					image.crop(start_x, start_y, resolution, resolution)
				} else {
					if (options.crop !== false) {
						image.autocrop([0, false])
					}
					if (options && options.width && options.height) {
						image.contain(options.width, options.height)
					}
				}

				image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
					Screencam.returnScreenshot(dataUrl, cb)
				})
			});
		})

	}
	fullscreen() {
		if (quad_previews.current) {
			quad_previews.current.controls.stopMovement()
		}
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
		'toggle_checkerboard',
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
				{icon: 'fa-clipboard', name: 'menu.preview.background.clipboard', condition: isApp, click: function(preview) {
					var image = clipboard.readImage().toDataURL();
					if (image.length > 32) {
						preview.background.image = image;
						preview.loadBackground();
					}
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
		{icon: 'videocam', name: 'menu.preview.perspective', condition: function(preview) {return !preview.movingBackground && !Modes.display}, children: function(preview) {
			function getBtn(angle, pers) {
				var condition = (pers && !preview.isOrtho)
							 || (!pers && angle === preview.angle && preview.isOrtho);
				return condition ? 'radio_button_checked' : 'radio_button_unchecked'
			}
			return [
				{icon: getBtn(0, true), name: 'menu.preview.perspective.normal', click: function(preview) {preview.setNormalCamera()}},
				'camera_reset',
				{icon: getBtn(0), name: 'direction.top',	color: 'y', click: function(preview) {preview.setOrthographicCamera(0)}},
				{icon: getBtn(1), name: 'direction.bottom',	color: 'y', click: function(preview) {preview.setOrthographicCamera(1)}},
				{icon: getBtn(2), name: 'direction.south',	color: 'z', click: function(preview) {preview.setOrthographicCamera(2)}},
				{icon: getBtn(3), name: 'direction.north', 	color: 'z', click: function(preview) {preview.setOrthographicCamera(3)}},
				{icon: getBtn(4), name: 'direction.east', 	color: 'x', click: function(preview) {preview.setOrthographicCamera(4)}},
				{icon: getBtn(5), name: 'direction.west', 	color: 'x', click: function(preview) {preview.setOrthographicCamera(5)}}
			]
		}},
		{icon: 'widgets', name: 'menu.preview.quadview', condition: function(preview) {return !quad_previews.enabled && !preview.movingBackground && !Modes.display && !Animator.open}, click: function() {
			openQuadView()
		}},
		{icon: 'web_asset', name: 'menu.preview.fullview', condition: function(preview) {return quad_previews.enabled && !preview.movingBackground && !Modes.display}, click: function(preview) {
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


const Screencam = {
	recording_timelapse: false,
	fullScreen(options, cb) {
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
	returnScreenshot(dataUrl, cb) {
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
					Blockbench.export()
					ElecDialogs.showSaveDialog(currentwindow, {filters: [ {name: tl('data.image'), extensions: [is_gif ? 'gif' : 'png']} ]}, function (fileName) {
						if (fileName === undefined) {
							return;
						}
						fs.writeFile(fileName, Buffer(dataUrl.split(',')[1], 'base64'), err => {})
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
	cleanCanvas(options, cb) {
		quad_previews.current.screenshot(options, cb)
	},
	createGif(options, cb) {
		if (typeof options !== 'object') {
			options = {}
		}
		/*
		var images = [];
		var preview = quad_previews.current;
		var interval = setInterval(function() {

			var shot = preview.canvas.toDataURL()
			images.push(shot);

			if (images.length >= options.length/1000*options.fps) {
				clearInterval(interval);
				gifshot.createGIF({
					images,
					frameDuration: 10/options.fps,
					progressCallback: cl,
					text: 'BLOCKBENCH'
				}, obj => {
					Screencam.returnScreenshot(obj.image, cb);
				})
			}
		}, 1000/options.fps)
		//Does not support transparency
		*/
		
		if (!options.length) {
			options.length = 1000;
		}
		var preview = quad_previews.current;
		var interval = options.fps ? (1000/options.fps) : 100;
		var gif = new GIF({
			repeat: options.repeat,
			quality: options.quality,
			transparent: 0x000000,
		});
		var frame_count = (options.length/interval);

		if (options.turnspeed) {
			preview.controls.autoRotate = true;
			preview.controls.autoRotateSpeed = options.turnspeed;
		}

		if (!options.silent) {
			Blockbench.setStatusBarText(tl('status_bar.recording_gif'));
			gif.on('progress', Blockbench.setProgress);
		}

		var frames = 0;
		var loop = setInterval(() => {
			frames++;
			Canvas.withoutGizmos(function() {
				var img = new Image();
				preview.render();
				img.src = preview.canvas.toDataURL();
				img.onload = () => {
					gif.addFrame(img, {delay: interval});
				}
			})
			Blockbench.setProgress(interval*frames/options.length);
		}, interval)

		var endTimer = setTimeout(() => {
			gif.render();
			clearInterval(loop)
			if (!options.silent) {
				Blockbench.setStatusBarText(tl('status_bar.processing_gif'))
			}
			if (Animator.open && Timeline.playing) {
				Timeline.pause();
			}
			if (options.turnspeed) {
				preview.controls.autoRotate = false;
			}
		}, options.length)

		gif.on('finished', blob => {
			var reader = new FileReader();
			reader.onload = () => {
				if (!options.silent) {
					Blockbench.setProgress(0);
					Blockbench.setStatusBarText();
				}
				Screencam.returnScreenshot(reader.result, cb);
			}
			reader.readAsDataURL(blob);
		});
	},
	recordTimelapse(options) {
		if (!options.destination) return;

		function getFileName(num) {
			return `${Project.name||'model'}_${num.toDigitString(4)}.png`;
		}
		var index = 0;
		try {
			var list = fs.readdirSync(options.destination);
			while (list.includes(getFileName(index+1))) {
				index++;
			}
		} catch (err) {
			console.log('Unable to analyze past timelapse recording', err)
		}

		Prop.recording = true;
		BarItems.timelapse.setIcon('pause');
		Blockbench.showQuickMessage('message.timelapse_start');

		function saveImage(image) {
			var path = `${options.destination}${osfs}${getFileName(index)}`;
			fs.writeFile(path, image, (e, b) => {});
			
		}
		if (options.source === 'locked') {
			var view_pos = new THREE.Vector3().copy(quad_previews.current.camera.position);
			var view_tar = new THREE.Vector3().copy(quad_previews.current.controls.target);
		}
		Screencam.timelapse_loop = setInterval(function() {
			index++;

			if (!isApp || options.source === 'preview' || options.source === 'locked') {
				var scope = quad_previews.current;
				if (options.source === 'locked') {
					var old_pos = new THREE.Vector3().copy(scope.camera.position);
					var old_tar = new THREE.Vector3().copy(scope.controls.target);
					scope.camera.position.copy(view_pos);
					scope.controls.target.copy(view_tar);
				}

				Canvas.withoutGizmos(function() {

					scope.render();
					var dataUrl = scope.canvas.toDataURL();
					saveImage(nativeImage.createFromDataURL(dataUrl).toPNG());

					if (options.source === 'locked') {
						scope.camera.position.copy(old_pos);
						scope.controls.target.copy(old_tar);
					}

				})
			} else {
				currentwindow.capturePage((image) => {
					saveImage(image.toPNG());
				});
			}

		}, options.interval*1000);
	},
	stopTimelapse() {
		if (Prop.recording) {
			Prop.recording = false;
			clearInterval(Screencam.timelapse_loop);
			BarItems.timelapse.setIcon('timelapse');
			Blockbench.showQuickMessage('message.timelapse_stop');
		}
	}
}

//Init/Update
function initCanvas() {

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
	Sun.intensity = 0.44

	lights = new THREE.Object3D()
	lights.name = 'lights'
	
	var light_top = new THREE.DirectionalLight();
	light_top.name = 'light_top'
	light_top.position.set(8, 100, 8)
	lights.add(light_top);
	
	light_top.intensity = 0.66

	var light_north = new THREE.DirectionalLight();
	light_north.name = 'light_north'
	light_north.position.set(8, 8, -100)
	lights.add(light_north);

	var light_south = new THREE.DirectionalLight();
	light_south.name = 'light_south'
	light_south.position.set(8, 8, 100)
	lights.add(light_south);

	light_north.intensity = light_south.intensity = 0.44

	var light_west = new THREE.DirectionalLight();
	light_west.name = 'light_west'
	light_west.position.set(-100, 8, 8)
	lights.add(light_west);

	var light_east = new THREE.DirectionalLight();
	light_east.name = 'light_east'
	light_east.position.set(100, 8, 8)
	lights.add(light_east);

	light_west.intensity = light_east.intensity = 0.22

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
	markerColors.forEach(function(s, i) {
		var thismaterial = new THREE.MeshLambertMaterial({
			color: 0xffffff,
			vertexColors: THREE.FaceColors,
			map: tex
		})
		thismaterial.color.set(s.pastel)
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
	Canvas.northMarkMaterial = new THREE.MeshBasicMaterial({
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
	rot_origin.base_scale = new THREE.Vector3(1, 1, 1);

	setupGrid = true;
	
	resizeWindow()
}
function animate() {
	TickUpdates.Run()
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
	Sun.intensity = settings.brightness.value/100;
	if (settings.shading.value === true) {
		(display_mode ? display_scene : scene).add(lights)
	} else {
		Sun.intensity *= (1/0.6)
	}
}
function updateCubeHighlights(hover_cube, force_off) {
	Cube.all.forEach(cube => {
		if (cube.visibility) {
			var mesh = cube.mesh;
			mesh.geometry.faces.forEach(face => {
				var b_before = face.color.b;
				if (Settings.get('highlight_cubes') && (hover_cube == cube || cube.selected) && Modes.edit && !force_off) {
					face.color.setRGB(1.3, 1.32, 1.34);
				} else {
					face.color.setRGB(1, 1, 1);
				}
				if (face.color.b != b_before) {
					mesh.geometry.colorsNeedUpdate = true;
				}
			})
		}
	})
}
//Helpers
function buildGrid() {
	three_grid.children.length = 0;
	if (Canvas.side_grids) {
		Canvas.side_grids.x.children.length = 0;
		Canvas.side_grids.z.children.length = 0;
	}
	if (Modes.display && settings.display_grid.value === false) return;

	three_grid.name = 'grid_group'
	gizmo_colors.grid.set(parseInt('0x'+CustomTheme.data.colors.grid.replace('#', ''), 16));
	var material;

	Canvas.northMarkMaterial.color = gizmo_colors.grid

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
	if (Format.centered_grid || !settings.full_grid.value) {
		var length = Format.centered_grid
			? (settings.full_grid.value ? 24 : 8)
			: 16
		setupAxisLine(new THREE.Vector3( 0, 0.001, 0), length, 'x')
		setupAxisLine(new THREE.Vector3( 0, 0.001, 0), length, 'z')

	} else {
		setupAxisLine(new THREE.Vector3( -16, 0.001, -16), 48, 'x')
		setupAxisLine(new THREE.Vector3( -16, 0.001, -16), 48, 'z')
	}

	var side_grid = new THREE.Object3D()

	if (settings.full_grid.value === true) {
		//Grid
		var grid = new THREE.GridHelper(48, 48/canvasGridSize(), gizmo_colors.grid)
		if (Format.centered_grid) {
			grid.position.set(0,0,0)
		} else { 
			grid.position.set(8,0,8)
		}
		grid.name = 'grid'
		three_grid.add(grid)
		side_grid.add(grid.clone())

		//North
		geometry = new THREE.PlaneGeometry(5, 5)
		var north_mark = new THREE.Mesh(geometry, Canvas.northMarkMaterial)
		if (Format.centered_grid) {
			north_mark.position.set(0,0,-27)
		} else {
			north_mark.position.set(8,0,-19)
		}
		north_mark.rotation.x = Math.PI / -2
		three_grid.add(north_mark)

	} else {
		if (settings.large_grid.value === true) {
			//Grid
			var grid = new THREE.GridHelper(48, 3, gizmo_colors.grid)
			if (Format.centered_grid) {
				grid.position.set(0,0,0)
			} else { 
				grid.position.set(8,0,8)
			}
			grid.name = 'grid'
			three_grid.add(grid)
			side_grid.add(grid.clone())
		}

		if (settings.base_grid.value === true) {
			//Grid
			var grid = new THREE.GridHelper(16, 16/canvasGridSize(), gizmo_colors.grid)

			if (Format.centered_grid) {
				grid.position.set(0,0,0)
			} else { 
				grid.position.set(8,0,8)
			}
			grid.name = 'grid'
			three_grid.add(grid)
			side_grid.add(grid.clone())

			//North
			geometry = new THREE.PlaneGeometry(2.4, 2.4)
			var north_mark = new THREE.Mesh(geometry, Canvas.northMarkMaterial)
			if (Format.centered_grid) {
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
		if (Format.centered_grid) {
			large_box.position.set(0,8,0)
		} else { 
			large_box.position.set(8,8,8)
		}
		large_box.name = 'grid'
		three_grid.add(large_box)
	}
	scene.add(three_grid)

	Canvas.side_grids = {
		x: side_grid,
		z: side_grid.clone()
	}
	scene.add(Canvas.side_grids.x)
	Canvas.side_grids.x.name = 'side_grid_x'
	Canvas.side_grids.x.visible = !Modes.display;
	Canvas.side_grids.x.rotation.z = Math.PI/2;
	Canvas.side_grids.x.position.y = Format.centered_grid ? 8 : 0;
	Canvas.side_grids.x.children.forEach(el => {
		el.layers.set(1)
	});

	scene.add(Canvas.side_grids.z)
	Canvas.side_grids.z.name = 'side_grid_y'
	Canvas.side_grids.z.visible = !Modes.display;
	Canvas.side_grids.z.rotation.z = Math.PI/2;
	Canvas.side_grids.z.rotation.y = 1.6
	Canvas.side_grids.z.position.y = Format.centered_grid ? 8 : 0;
	Canvas.side_grids.z.children.forEach(el => {
		el.layers.set(3)
	});
}

BARS.defineActions(function() {
	new Action('toggle_wireframe', {
		icon: 'border_clear',
		category: 'view',
		keybind: new Keybind({key: 90}),
		condition: () => Toolbox && Toolbox.selected && Toolbox.selected.allowWireframe,
		click: function () {
			Prop.wireframe = !Prop.wireframe
			Canvas.updateAllFaces()
			if (Modes.id === 'animate') {
				Animator.preview()
			}
			Blockbench.showQuickMessage('message.wireframe.' + (Prop.wireframe ? 'enabled' : 'disabled'))
		}
	})
	new Action('toggle_checkerboard', {
		icon: 'fa-chess-board',
		category: 'view',
		keybind: new Keybind({key: 84}),
		click: function () {
			if (Prop.active_panel == 'uv') {
				var val = $('#uv_viewport').toggleClass('checkerboard').hasClass('checkerboard');
			} else {
				var val = $('#center').toggleClass('checkerboard').hasClass('checkerboard');
			}
			Blockbench.showQuickMessage('message.checkerboard.' + (val ? 'enabled' : 'disabled'))
		}
	})

	new Action('screenshot_model', {
		icon: 'fa-cubes',
		category: 'view',
		keybind: new Keybind({key: 80, ctrl: true}),
		click: function () {quad_previews.current.screenshot()}
	})
	new Action('record_model_gif', {
		icon: 'local_movies',
		category: 'view',
		click: function () {
			new Dialog({
				id: 'create_gif',
				title: tl('dialog.create_gif.title'),
				draggable: true,
				form: {
					length: {label: 'dialog.create_gif.length', type: 'number', value: 10, step: 0.25},
					fps: 	{label: 'dialog.create_gif.fps', type: 'number', value: 10},
					quality:{label: 'dialog.create_gif.compression', type: 'number', value: 20, min: 1, max: 80},
					turn:	{label: 'dialog.create_gif.turn', type: 'number', value: 0, min: -10, max: 10},
					play: 	{label: 'dialog.create_gif.play', type: 'checkbox', condition: Animator.open},
				},
				onConfirm: function(formData) {
					if (formData.play) {
						Timeline.start()
					}
					Screencam.createGif({
						length: limitNumber(formData.length, 0.1, 240)*1000,
						fps: limitNumber(formData.fps, 0.5, 30),
						quality: limitNumber(formData.quality, 0, 30),
						turnspeed: formData.turn,
					}, Screencam.returnScreenshot)
					this.hide()
				}
			}).show()
		}
	})
	new Action('timelapse', {
		icon: 'timelapse',
		category: 'view',
		condition: isApp,
		click: function () {
			if (!Prop.recording) {
				new Dialog({
					id: 'timelapse',
					title: tl('action.timelapse'),
					draggable: true,
					form: {
						interval: 	 {label: 'dialog.timelapse.interval', type: 'number', value: 10, step: 0.25},
						source: 	 {label: 'dialog.timelapse.source', type: 'select', value: 'preview', options: {
							preview: 'data.preview',
							locked: 'dialog.timelapse.source.locked',
							interface: 'dialog.timelapse.source.interface',
						}, condition: isApp},
						destination: {label: 'dialog.timelapse.destination', type: 'folder', value: ''},
					},
					onConfirm: function(formData) {
						Screencam.recordTimelapse(formData);
						this.hide()
					}
				}).show();
			} else {
				Screencam.stopTimelapse();
			}
		}
	})
	new Action('screenshot_app', {
		icon: 'icon-bb_interface',
		category: 'view',
		condition: isApp,
		click: function () {Screencam.fullScreen()}
	})
	new Action('toggle_quad_view', {
		icon: 'widgets',
		category: 'view',
		condition: () => !Modes.display,
		keybind: new Keybind({key: 9}),
		click: function () {
			main_preview.toggleFullscreen()
		}
	})
	new Action('camera_reset', {
		name: 'menu.preview.perspective.reset',
		description: 'menu.preview.perspective.reset',
		icon: 'videocam',
		category: 'view',
		keybind: new Keybind({key: 96}),
		click: function () {
			quad_previews.current.resetCamera()
		}
	})
	new Action('camera_normal', {
		name: 'menu.preview.perspective.normal',
		description: 'menu.preview.perspective.normal',
		icon: 'videocam',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 101}),
		click: function () {
			quad_previews.current.setNormalCamera()
		}
	})

	new Action('camera_top', {
		name: 'direction.top',
		description: 'direction.top',
		icon: 'videocam',
		color: 'y',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 104}),
		click: function () {
			quad_previews.current.setOrthographicCamera(0)
		}
	})
	new Action('camera_bottom', {
		name: 'direction.bottom',
		description: 'direction.bottom',
		icon: 'videocam',
		color: 'y',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 98}),
		click: function () {
			quad_previews.current.setOrthographicCamera(1)
		}
	})
	new Action('camera_south', {
		name: 'direction.south',
		description: 'direction.south',
		icon: 'videocam',
		color: 'z',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 100}),
		click: function () {
			quad_previews.current.setOrthographicCamera(2)
		}
	})
	new Action('camera_north', {
		name: 'direction.north',
		description: 'direction.north',
		icon: 'videocam',
		color: 'z',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 102}),
		click: function () {
			quad_previews.current.setOrthographicCamera(3)
		}
	})
	new Action('camera_east', {
		name: 'direction.east',
		description: 'direction.east',
		icon: 'videocam',
		color: 'x',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 103}),
		click: function () {
			quad_previews.current.setOrthographicCamera(4)
		}
	})
	new Action('camera_west', {
		name: 'direction.west',
		description: 'direction.west',
		icon: 'videocam',
		color: 'x',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 105}),
		click: function () {
			quad_previews.current.setOrthographicCamera(5)
		}
	})
})
