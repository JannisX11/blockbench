var scene,
	main_preview, MediaPreview,
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
const DefaultCameraPresets = [
	{
		name: 'menu.preview.angle.initial',
		id: 'initial',
		projection: 'perspective',
		position: [-40, 32, -40],
		target: [0, 8, 0],
		default: true
	},
	{
		name: 'direction.top',
		id: 'top',
		projection: 'orthographic',
		color: 'y',
		position: [0, 64, 0],
		target: [0, 0, 0],
		zoom: 0.5,
		locked_angle: 0,
		default: true
	},
	{
		name: 'direction.bottom',
		id: 'bottom',
		projection: 'orthographic',
		color: 'y',
		position: [0, -64, 0],
		target: [0, 0, 0],
		zoom: 0.5,
		locked_angle: 1,
		default: true
	},
	{
		name: 'direction.south',
		id: 'south',
		projection: 'orthographic',
		color: 'z',
		position: [0, 0, 64],
		target: [0, 0, 0],
		zoom: 0.5,
		locked_angle: 2,
		default: true
	},
	{
		name: 'direction.north',
		id: 'north',
		projection: 'orthographic',
		color: 'z',
		position: [0, 0, -64],
		target: [0, 0, 0],
		zoom: 0.5,
		locked_angle: 3,
		default: true
	},
	{
		name: 'direction.east',
		id: 'east',
		projection: 'orthographic',
		color: 'x',
		position: [64, 0, 0],
		target: [0, 0, 0],
		zoom: 0.5,
		locked_angle: 4,
		default: true
	},
	{
		name: 'direction.west',
		id: 'west',
		projection: 'orthographic',
		color: 'x',
		position: [-64, 0, 0],
		target: [0, 0, 0],
		zoom: 0.5,
		locked_angle: 5,
		default: true
	},
	{
		name: 'camera_angle.isometric_right',
		id: 'isometric_right',
		projection: 'orthographic',
		position: [-64, 64*0.8165, -64],
		target: [0, 0, 0],
		zoom: 0.5,
		default: true
	},
	{
		name: 'camera_angle.isometric_left',
		id: 'isometric_left',
		projection: 'orthographic',
		position: [64, 64*0.8165, -64],
		target: [0, 0, 0],
		zoom: 0.5,
		default: true
	}
]

class Preview {
	constructor(options = 0) {
		var scope = this;
		if (options && options.id) {
			this.id = options.id
		}
		//Node
		this.canvas = document.createElement('canvas')
		this.canvas.preview = this;
		this.height = 0;
		this.width = 0;
		this.node = document.createElement('div')
		this.node.className = 'preview';
		this.node.appendChild(this.canvas);
		let menu = $(`<div class="tool preview_menu"> <i class="material-icons">more_vert</i> </div>`)[0]
			menu.onclick = (event) => {
				this.menu.open(menu, this)
			}
		BarItem.prototype.addLabel(false, {
			name: tl('data.preview'),
			node: menu
		})
		this.node.appendChild(menu)
		//Cameras
		this.isOrtho = false
		this.angle = null;
		this.camPers = new THREE.PerspectiveCamera(settings.fov.value, 16 / 9, 1, 30000)
		this.camOrtho = new THREE.OrthographicCamera(-600,  600, -400, 400, -200, 20000);
		this.camOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: false, a: 'y'}]
		this.camOrtho.axis = null
		this.camOrtho.zoom = 0.5
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

		this.camPers.position.fromArray(DefaultCameraPresets[0].position)
		this.controls.target.fromArray(DefaultCameraPresets[0].target);

		//Keybinds
		this.controls.mouseButtons.ZOOM = undefined;

		//Renderer
		try {
			this.renderer = new THREE.WebGLRenderer({
				canvas: this.canvas,
				antialias: typeof options.antialias == 'boolean' ? options.antialias : Settings.get('antialiasing'),
				alpha: true,
				preserveDrawingBuffer: true
			});
		} catch (err) {
			document.querySelector('#loading_error_detail').innerHTML = 'Error creating WebGL context. Try to update your graphics drivers.';
			if (isApp) {
				var {BrowserWindow} = require('electron').remote
				new BrowserWindow({
					icon:'icon.ico',
					backgroundColor: '#ffffff',
					title: 'Blockbench GPU Information',
					webPreferences: {
						webgl: true,
						webSecurity: true,
						nodeIntegration: true
					}
				}).loadURL('chrome://gpu')
			}
			throw err;
		}
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
		addEventListeners(this.canvas, 'mouseup touchend',		function(event) { scope.mouseup(event)}, false)
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
		Preview.all.push(this);
	}
	//Render
	resize(width, height) {
		if (this.canvas.isConnected && this !== MediaPreview) {
			this.height = this.node.parentElement.clientHeight;
			this.width  = this.node.parentElement.clientWidth;
		} else if (height && width) {
			this.height = height;
			this.width = width;
		} else {
			return this;
		}

		if (this.isOrtho === false) {
			this.camPers.aspect = this.width / this.height
			this.camPers.updateProjectionMatrix();
		} else {
			this.camOrtho.right = this.width / 80
			this.camOrtho.left = this.camOrtho.right*-1
			this.camOrtho.top = this.height / 80
			this.camOrtho.bottom = this.camOrtho.top*-1
			this.camOrtho.updateProjectionMatrix();
		}
		this.renderer.setSize(this.width, this.height);

		if (this.canvas.isConnected) {
			this.renderer.setPixelRatio(window.devicePixelRatio);
			this.updateBackground()
			if (Transformer) {
				Transformer.update()
			}
		}
		return this;
	}
	raycast(event) {
		convertTouchEvent(event);
		var canvas_offset = $(this.canvas).offset()
		this.mouse.x = ((event.clientX - canvas_offset.left) / this.width) * 2 - 1;
		this.mouse.y = - ((event.clientY - canvas_offset.top) / this.height) * 2 + 1;
		this.raycaster.setFromCamera( this.mouse, this.camera );

		var objects = []
		Cube.all.forEach(cube => {
			if (cube.visibility && !cube.locked) {
				objects.push(cube.mesh);
			}
		})
		if (Vertexsnap.vertexes.children.length) {
			Vertexsnap.vertexes.children.forEach(function(s) {
				if (s.isVertex === true) {
					objects.push(s)
				}
			})
		}
		if (Animator.open && settings.motion_trails.value && Group.selected) {
			Animator.motion_trail.children.forEach(object => {
				if (object.isKeyframe === true) {
					objects.push(object)
				}
			})
		}
		var intersects = this.raycaster.intersectObjects( objects );
		if (intersects.length > 0) {
			if (intersects.length > 1 && Toolbox.selected.id == 'vertex_snap_tool') {
				var intersect;
				for (var sct of intersects) {
					if (sct.object.isVertex) {
						intersect = sct.object;
						break;
					}
				}
				if (!intersect) intersect = intersects[0].object;
			} else {
				var intersect = intersects[0].object
			}
			if (intersect.isElement) {
				this.controls.hasMoved = true
				var obj = OutlinerElement.uuids[intersects[0].object.name]
				let face = Canvas.face_order[intersects[0].face.materialIndex];

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
			} else if (intersect.isKeyframe) {
				let keyframe = Timeline.keyframes.find(kf => kf.uuid == intersect.keyframeUUID);
				return {
					event: event,
					type: 'keyframe',
					intersects: intersects,
					keyframe: keyframe
				}
			}
		} else {
			return false;
		}
	}
	render() {
		this.controls.update()
		this.renderer.render(
			display_mode
				? display_scene
				: scene,
			this.camera
		)
	}
	//Camera
	get camera() {
		return this.isOrtho ? this.camOrtho : this.camPers;
	}
	setProjectionMode(ortho) {

		let position = this.camera.position;
		this.isOrtho = !!ortho;
		this.resize()
		this.controls.object = this.camera;
		this.camera.position.copy(position);
		if (this.isOrtho) {
			this.camera.zoom = 0.5;
			this.camOrtho.updateProjectionMatrix()
		}
		this.setLockedAngle()
		this.controls.updateSceneScale();
		return this;
	}
	setFOV(fov) {
		this.camPers.fov = fov;
		this.camPers.updateProjectionMatrix();
	}
	setNormalCamera() {
		//Deprecated
		this.setProjectionMode(false)
		return this;
	}
	setLockedAngle(angle) {
		if (typeof angle === 'number' && this.isOrtho) {

			this.angle = angle
			this.controls.enableRotate = false;

			switch (angle) {
				case 0:
				this.camOrtho.axis = 'y'
				this.camOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: false, a: 'z'}]
				break;
				case 1:
				this.camOrtho.axis = 'y'
				this.camOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: true, a: 'z'}]
				break;
				case 2:
				this.camOrtho.axis = 'z'
				this.camOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: true, a: 'y'}]
				break;
				case 3:
				this.camOrtho.axis = 'z'
				this.camOrtho.backgroundHandle = [{n: true, a: 'x'}, {n: true, a: 'y'}]
				break;
				case 4:
				this.camOrtho.axis = 'x'
				this.camOrtho.backgroundHandle = [{n: true, a: 'z'}, {n: true, a: 'y'}]
				break;
				case 5:
				this.camOrtho.axis = 'x'
				this.camOrtho.backgroundHandle = [{n: false, a: 'z'}, {n: true, a: 'y'}]
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

		} else {

			this.angle = null;
			this.camOrtho.axis = null
			this.camOrtho.layers.set(0);
			this.camOrtho.layers.enable(4);
			this.camOrtho.layers.enable(5);
			this.camOrtho.layers.enable(6);
			this.resize()
			this.controls.enableRotate = true;
			this.loadBackground()
		}

		Transformer.update();
		this.loadBackground()
		return this;
	}
	loadAnglePreset(preset) {
		if (!preset) return;
		this.camera.position.fromArray(preset.position);
		if (preset.target) {
			this.controls.target.fromArray(preset.target);
		} else if (preset.rotation) {
			
			this.controls.target.set(0, 0, 16).applyEuler(new THREE.Euler(
				Math.degToRad(preset.rotation[0]),
				Math.degToRad(preset.rotation[1]),
				Math.degToRad(preset.rotation[2]),
				'ZYX'
			));
			this.controls.target.add(this.camera.position);
		}
		if (preset.projection !== 'unset') {
			this.setProjectionMode(preset.projection == 'orthographic')
		}
		if (this.isOrtho && preset.zoom) {
			this.camera.zoom = preset.zoom;
			this.camera.updateProjectionMatrix()
		}
		if (!this.isOrtho) {
			this.camera.setFocalLength(preset.focal_length||45);
		}
		this.setLockedAngle(preset.locked_angle)
		return this;
	}
	newAnglePreset() {
		let scope = this;
		let position = scope.camera.position.toArray();
		let target = scope.controls.target.toArray();
		position.forEach((v, i) => {
			position[i] = Math.round(v*100)/100
		})
		target.forEach((v, i) => {
			target[i] = Math.round(v*100)/100
		})

		let dialog = new Dialog({
			id: 'save_angle',
			title: 'menu.preview.save_angle',
			width: 540,
			form: {
				name: {label: 'generic.name'},
				projection: {label: 'dialog.save_angle.projection', type: 'select', default: 'unset', options: {
					unset: 'generic.unset',
					perspective: 'dialog.save_angle.projection.perspective',
					orthographic: 'dialog.save_angle.projection.orthographic'
				}},
				position: {label: 'dialog.save_angle.position', type: 'vector', dimensions: 3, value: position},
				target: {label: 'dialog.save_angle.target', type: 'vector', dimensions: 3, value: target},
			},
			onConfirm: function(formResult) {

				if (!formResult.name) return;

				let preset = {
					name: formResult.name,
					projection: formResult.projection,
					position: formResult.position,
					target: formResult.target,
				}
				if (this.isOrtho) preset.zoom = this.camOrtho.zoom;

				let presets = localStorage.getItem('camera_presets');
				try {
					presets = JSON.parse(presets)||[]
				} catch (err) {
					presets = [];
				}
				presets.push(preset);
				localStorage.setItem('camera_presets', JSON.stringify(presets))

				dialog.hide()
			}
		})
		dialog.show()
		return this;
	}
	//Orientation
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
		Preview.selected = this;
		if (Transformer.hoverAxis !== null || (!Keybinds.extra.preview_select.keybind.isTriggered(event) && event.which !== 0)) return;

		var data = this.raycast(event);
		if (data) {
			//this.static_rclick = false
			if (data.cube && data.cube.locked) {
				$('#preview').css('cursor', 'not-allowed')
				function resetCursor() {
					$('#preview').css('cursor', (Toolbox.selected.cursor ? Toolbox.selected.cursor : 'default'))
					removeEventListeners(document, 'mouseup touchend', resetCursor, false)
				}
				addEventListeners(document, 'mouseup touchend', resetCursor, false)

			} else if (Toolbox.selected.selectCubes && Modes.selected.selectCubes && data.type === 'cube') {
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
			} else if (Animator.open && data.type == 'keyframe') {
				if (data.keyframe instanceof Keyframe) {
					data.keyframe.select(event).callPlayhead();
					updateSelection();
				}
			}
			if (typeof Toolbox.selected.onCanvasClick === 'function') {
				Toolbox.selected.onCanvasClick(data)
				Blockbench.dispatchEvent('canvas_click', data)
			}
			return true;
		}
		if (typeof Toolbox.selected.onCanvasClick === 'function') {
			Toolbox.selected.onCanvasClick(0)
		}

		if (this.angle !== null && this.camOrtho.axis || this.movingBackground) {
			this.startSelRect(event)
		} else {
			return false;
		}
	}
	mousemove(event) {
		if (Settings.get('highlight_cubes')) {
			var data = this.raycast(event);
			updateCubeHighlights(data && data.cube);
		}
	}
	mouseup(event) {
		this.showContextMenu(event);
		if (this.controls.hasMoved === false && settings.canvas_unselect.value) {
			unselectAll();
		}
		return this;
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
		if (this == MediaPreview || Transformer.dragging) return this;

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
			if (Toolbox.selected.selectCubes && Modes.selected.selectCubes && data && data.cube && !Modes.animate) {
				data.cube.showContextMenu(event);

			} else if (data.type == 'keyframe') {
				data.keyframe.showContextMenu(event);

			} else {
				this.menu.open(event, this)
			}
		}
		clearTimeout(this.rclick_cooldown);
		delete this.rclick_cooldown;
		return this;
	}
	calculateControlScale(position) {
		if (this.isOrtho) {
			return 0.35 / this.camera.zoom;
		} else {
			var scaleVector = new THREE.Vector3();
			var scale = scaleVector.subVectors(position, this.camera.position).length() / 4;
			scale *= this.camera.fov / this.height;
			return scale;
		}

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
		if (!Modes.edit || event.type == 'touchstart') return;

		$(this.node).append(this.selection.box)
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
		TickUpdates.selection = true;
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
		} else if (this.angle !== null) {
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
			this.background.imgtag.src = this.background.image.replace(/#/g, '%23');
			$(this.canvas).css('background-image', `url("${this.background.image.replace(/\\/g, '/').replace(/#/g, '%23')}")`)
		} else {
			$(this.canvas).css('background-image', 'none')
		}
		this.updateBackground()
		return this;
	}
	updateBackground() {
		if (!this.background) return;
		var bg = this.background
		var zoom = (this.angle !== null && bg.lock === true) ? this.camOrtho.zoom : 1
		var pos_x = 0;
		var pos_y = 0;
		if (this.angle !== null && bg.lock !== false) {
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
		Settings.saveLocalStorages()
		return this;
	}
	restoreBackground() {
		this.loadBackground()
		if (this.background && this.background.defaults) {
			this.background.image = this.background.defaults.image || false;
			this.background.size = this.background.defaults.size || 1000
			this.background.x = this.background.defaults.x || 0
			this.background.y = this.background.defaults.y || 0
		}
		this.loadBackground()
		Settings.saveLocalStorages()
		return this;
	}
	startMovingBackground() {
		if (this.movingBackground) {
			this.stopMovingBackground()
		}
		this.movingBackground = true;
		this.controls.enabled_before = this.controls.enabled
		this.controls.enabled = false

		if (settings.dialog_drag_background.value) {
			Blockbench.showMessageBox({
				translateKey: 'drag_background',
				icon: 'open_with',
				buttons: ['dialog.ok', 'dialog.dontshowagain'],
				confirm: 0,
				cancel: 0,
			}, function(r) {
				if (r === 1) {
					settings.dialog_drag_background.value = false
					Settings.save()
				}
			})
		}
	}
	stopMovingBackground() {
		this.movingBackground = false;
		this.controls.enabled = this.controls.enabled_before
		delete this.controls.enabled_before
		Settings.saveLocalStorages()
		return this;
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
				Settings.saveLocalStorages()
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

			if (options.crop == false && !options.width && !options.height) {
				var dataUrl = scope.canvas.toDataURL()
				Screencam.returnScreenshot(dataUrl, cb)
				return;
			}
			
			if (options.crop !== false && !(display_mode && display_slot === 'gui') && !options.width && !options.height) {
				let frame = new CanvasFrame(scope.canvas);
				frame.autoCrop()
				Screencam.returnScreenshot(frame.canvas.toDataURL(), cb)
				return;
			}

			var dataUrl = scope.canvas.toDataURL()
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
		Preview.selected = this;
		quad_previews.enabled = false;
		$('#preview').empty()

		var wrapper = $('<div class="single_canvas_wrapper"></div>')
		wrapper.append(this.node)
		$('#preview').append(wrapper)
		
		Preview.all.forEach(function(prev) {
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
		'screenshot_model',
		{icon: 'icon-player', name: 'settings.display_skin', condition: () => (display_mode && displayReferenceObjects.active.id === 'player'), click: function() {
			changeDisplaySkin()
		}},
		'preview_checkerboard',
		{icon: 'wallpaper', name: 'menu.preview.background', children(preview) {
			var has_background = !!preview.background.image
			return [
				{icon: 'folder', name: 'menu.preview.background.load', click: function(preview) {
					Blockbench.import({
						resource_id: 'preview_background',
						extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif'],
						type: 'Image',
						readtype: 'image'
					}, function(files) {
						if (files) {
							preview.background.image = isApp ? files[0].path : files[0].content
							preview.loadBackground()
							Settings.saveLocalStorages()
						}
					}, 'image', false)
				}},
				{icon: 'fa-clipboard', name: 'menu.preview.background.clipboard', condition: isApp, click: function(preview) {
					var image = clipboard.readImage().toDataURL();
					if (image.length > 32) {
						preview.background.image = image;
						preview.loadBackground();
						Settings.saveLocalStorages()
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
					condition: (has_background && preview.background.lock !== null && preview.angle !== null),
					icon: preview.background.lock?'check_box':'check_box_outline_blank', 
					click: function(preview) {
					preview.background.lock = !preview.background.lock
					preview.updateBackground()
				}},
				{icon: 'clear', name: 'generic.remove', condition: has_background, click: function(preview) {
					preview.clearBackground()
				}},
				{icon: 'restore', name: 'generic.restore', condition: (preview) => (preview.background && preview.background.defaults.image), click: function(preview) {
					// ToDo: condition, save local storage, name and icon
					preview.restoreBackground()
				}}
			]
		}},
		'_',
		'focus_on_selection',
		{icon: 'add_a_photo', name: 'menu.preview.save_angle', condition(preview) {return !preview.movingBackground && !Modes.display}, click(preview) {
			preview.newAnglePreset()
		}},
		{icon: 'videocam', name: 'menu.preview.angle', condition(preview) {return !preview.movingBackground && !Modes.display}, children: function(preview) {
			var children = [
			]
			let presets = localStorage.getItem('camera_presets')
			presets = (presets && JSON.parse(presets)) || [];
			let all_presets = [...DefaultCameraPresets, ...presets];

			all_presets.forEach(preset => {
				let icon = typeof preset.locked_angle !== 'number' ? 'videocam' : (preset.locked_angle == preview.angle ? 'radio_button_checked' : 'radio_button_unchecked'); 
				children.push({
					name: preset.name,
					color: preset.color,
					id: preset.name,
					icon,
					click: preset.default ? () => {
						preview.loadAnglePreset(preset)
					} : null,
					children: !preset.default && [
						{icon: 'check_circle', name: 'menu.preview.angle.load', click() {
							preview.loadAnglePreset(preset)
						}},
						{icon: 'delete', name: 'generic.delete', click() {
							presets.remove(preset)
							localStorage.setItem('camera_presets', JSON.stringify(presets))
						}}
					]
				})
			})

			return children;
		}},
		{icon: (preview) => (preview.isOrtho ? 'check_box' : 'check_box_outline_blank'), name: 'menu.preview.orthographic', click: function(preview) {
			preview.setProjectionMode(!preview.isOrtho);
		}},
		'_',
		{icon: 'widgets', name: 'menu.preview.quadview', condition: function(preview) {return !quad_previews.enabled && !preview.movingBackground && !Modes.display && !Animator.open}, click: function() {
			openQuadView()
		}},
		{icon: 'web_asset', name: 'menu.preview.maximize', condition: function(preview) {return quad_previews.enabled && !preview.movingBackground && !Modes.display}, click: function(preview) {
			preview.fullscreen()
		}},
		{icon: 'cancel', color: 'x', name: 'menu.preview.stop_drag', condition: function(preview) {return preview.movingBackground;}, click: function(preview) {
			preview.stopMovingBackground()
		}}
	])

Preview.all = [];

function openQuadView() {
	quad_previews.enabled = true;

	$('#preview').empty()
	
	var wrapper1 = $('<div class="quad_canvas_wrapper qcw_x qcw_y"></div>')
	wrapper1.append(quad_previews.one.node)
	$('#preview').append(wrapper1)
	
	var wrapper2 = $('<div class="quad_canvas_wrapper qcw_y"></div>')
	wrapper2.append(quad_previews.two.node)
	$('#preview').append(wrapper2)
	
	var wrapper3 = $('<div class="quad_canvas_wrapper qcw_x"></div>')
	wrapper3.append(quad_previews.three.node)
	$('#preview').append(wrapper3)
	
	var wrapper4 = $('<div class="quad_canvas_wrapper"></div>')
	wrapper4.append(quad_previews.four.node)
	$('#preview').append(wrapper4)
	
	updateInterface()
}


const Screencam = {
	recording_timelapse: false,
	fullScreen(options, cb) {
		setTimeout(function() {
			currentwindow.capturePage().then(function(screenshot) {
				var dataUrl = screenshot.toDataURL()

				if (!(options && options.width && options.height)) {
					Screencam.returnScreenshot(dataUrl, cb)
					return;
				}

				dataUrl = dataUrl.replace('data:image/png;base64,','')
				Jimp.read(Buffer.from(dataUrl, 'base64')).then(function(image) { 

					image.contain(options.width, options.height)

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
					if (is_gif) {
						Blockbench.export({
							resource_id: 'screenshot',
							extensions: ['gif'],
							type: tl('data.image'),
							savetype: 'binary',
							content: Buffer(dataUrl.split(',')[1], 'base64')
						})
					} else {
						Blockbench.export({
							resource_id: 'screenshot',
							extensions: ['png'],
							type: tl('data.image'),
							savetype: 'image',
							content: dataUrl
						})
					}
				} else if (result === 2) {
					clipboard.writeImage(screenshot)
				}
			})
		} else {
			new Dialog({
				title: tl('message.screenshot.right_click'), 
				id: 'screenie', 
				width: 500,
				lines: ['<img src="'+dataUrl+'" width="452px" class="allow_default_menu"></img>'],
				draggable: true,
				singleButton: true
			}).show()
		}
	},
	cleanCanvas(options, cb) {
		quad_previews.current.screenshot(options, cb)
	},
	createGif(options, cb) {
		if (typeof options !== 'object') options = {}
		if (!options.length_mode) options.length_mode = 'seconds';
		if (!options.length) options.length = 1;

		var preview = quad_previews.current;
		var animation = Animation.selected;
		var interval = options.fps ? (1000/options.fps) : 100;
		var frames = 0;
		const gif = new GIF({
			repeat: options.repeat,
			quality: options.quality,
			background: {r: 30, g: 0, b: 255},
			transparent: 0x1e01ff,
		});

		if (options.turnspeed) {
			preview.controls.autoRotate = true;
			preview.controls.autoRotateSpeed = options.turnspeed;
			preview.controls.autoRotateProgress = 0;
		} else if (options.length_mode == 'turntable') {
			options.length_mode = 'seconds'
		}

		if (options.play && animation) {
			Timeline.time = 0;
			Timeline.start()
			if (!animation.length) options.length_mode = 'seconds';
		} else if (options.length_mode == 'animation') {
			options.length_mode = 'seconds'
		}

		if (!options.silent) {
			Blockbench.setStatusBarText(tl('status_bar.recording_gif'));
			gif.on('progress', Blockbench.setProgress);
		}

		function getProgress() {
			switch (options.length_mode) {
				case 'seconds': return interval*frames/(options.length*1000); break;
				case 'frames': return frames/options.length; break;
				case 'turntable': return Math.abs(preview.controls.autoRotateProgress) / (2*Math.PI); break;
				case 'animation': return Timeline.time / (animation.length-(interval/1000)); break;
			}
		}

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
			Blockbench.setProgress(getProgress());
			if (getProgress() >= 1) {
				endRecording()
				return;
			}

		}, interval)

		function endRecording() {
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
		}

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
	
	//Objects
	scene = new THREE.Scene();
	display_scene = new THREE.Scene();
	display_area = new THREE.Object3D();
	display_base = new THREE.Object3D();

	display_scene.add(display_area)
	display_area.add(display_base)

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
		this.defaults = Object.assign({}, this);
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

	MediaPreview = new Preview({id: 'media'})

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
	Sun.intensity = 0.5

	lights = new THREE.Object3D()
	lights.name = 'lights'
	
	lights.top = new THREE.DirectionalLight();
	lights.top.name = 'light_top'
	lights.top.position.set(0, 100, 0)
	lights.add(lights.top);
	
	lights.top.intensity = 0.41
	
	lights.bottom = new THREE.DirectionalLight();
	lights.bottom.name = 'light_bottom'
	lights.bottom.position.set(0, -100, 0)
	lights.add(lights.bottom);
	
	lights.bottom.intensity = -0.02

	lights.north = new THREE.DirectionalLight();
	lights.north.name = 'light_north'
	lights.north.position.set(0, 0, -100)
	lights.add(lights.north);

	lights.south = new THREE.DirectionalLight();
	lights.south.name = 'light_south'
	lights.south.position.set(0, 0, 100)
	lights.add(lights.south);

	lights.north.intensity = lights.south.intensity = 0.3

	lights.west = new THREE.DirectionalLight();
	lights.west.name = 'light_west'
	lights.west.position.set(-100, 0, 0)
	lights.add(lights.west);

	lights.east = new THREE.DirectionalLight();
	lights.east.name = 'light_east'
	lights.east.position.set(100, 0, 0)
	lights.add(lights.east);

	lights.west.intensity = lights.east.intensity = 0.1

	updateShading()

	quad_previews = {
		get current() {return Preview.selected},
		set current(p) {Preview.selected = p},

		one: new Preview({id: 'one'}).loadAnglePreset(DefaultCameraPresets[1]),
		two: main_preview,
		three: new Preview({id: 'three'}).loadAnglePreset(DefaultCameraPresets[3]),
		four: new Preview({id: 'four'}).loadAnglePreset(DefaultCameraPresets[5]),
		get current() {
			return Preview.selected;
		}
	}

	//emptyMaterial
	var img = new Image()
	img.src = 'assets/missing.png'
	var tex = new THREE.Texture(img)
	img.tex = tex;
	img.tex.magFilter = THREE.NearestFilter
	img.tex.minFilter = THREE.NearestFilter
	img.tex.wrapS = img.tex.wrapT = THREE.RepeatWrapping;
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
	rot_origin.no_export = true;

	setupGrid = true;
	
	resizeWindow()
}
function animate() {
	requestAnimationFrame( animate );
	TickUpdates.Run()
	if (quad_previews.current) {
		Wintersky.updateFacingRotation(quad_previews.current.camera);
	}
	Preview.all.forEach(function(prev) {
		if (prev.canvas.isConnected) {
			prev.render()
		}
	})
	framespersecond++;
	if (display_mode === true && ground_animation === true && !Transformer.hoverAxis) {
		DisplayMode.groundAnimation()
	}
}

function updateShading() {
	Canvas.updateLayeredTextures();
	scene.remove(lights)
	display_scene.remove(lights)
	Sun.intensity = settings.brightness.value/50;
	if (settings.shading.value === true) {
		Sun.intensity *= 0.5;
		let parent = display_mode ? display_scene : scene;
		parent.add(lights);
		lights.position.copy(parent.position).multiplyScalar(-1);
	}
}
function updateCubeHighlights(hover_cube, force_off) {
	Cube.all.forEach(cube => {
		if (cube.visibility) {
			var mesh = cube.mesh;
			mesh.geometry.faces.forEach(face => {
				var b_before = face.color.b;
				if (
					Settings.get('highlight_cubes') &&
					((hover_cube == cube && !Transformer.dragging) || cube.selected) &&
					Modes.edit &&
					!force_off
				) {
					face.color.setRGB(1.25, 1.28, 1.3);
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
	if (settings.base_grid.value) {
		var length = Format.centered_grid
			? (settings.full_grid.value ? 24 : 8)
			: 16
		setupAxisLine(new THREE.Vector3( 0, 0.001, 0), length, 'x')
		setupAxisLine(new THREE.Vector3( 0, 0.001, 0), length, 'z')

	}

	var side_grid = new THREE.Object3D()

	if (settings.full_grid.value === true) {
		//Grid
		let size = settings.large_grid_size.value*16;
		var grid = new THREE.GridHelper(size, size/canvasGridSize(), gizmo_colors.grid)
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
			north_mark.position.set(0,0, -3 - size/2)
		} else {
			north_mark.position.set(8, 0, 5 - size/2)
		}
		north_mark.rotation.x = Math.PI / -2
		three_grid.add(north_mark)

	} else {
		if (settings.large_grid.value === true) {
			//Grid
			let size = settings.large_grid_size.value
			var grid = new THREE.GridHelper(size*16, size, gizmo_colors.grid)
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
	three_grid.add(Canvas.side_grids.x)
	Canvas.side_grids.x.name = 'side_grid_x'
	Canvas.side_grids.x.visible = !Modes.display;
	Canvas.side_grids.x.rotation.z = Math.PI/2;
	Canvas.side_grids.x.position.y = Format.centered_grid ? 8 : 0;
	Canvas.side_grids.z.position.z = 0
	Canvas.side_grids.x.children.forEach(el => {
		el.layers.set(1)
	});

	three_grid.add(Canvas.side_grids.z)
	Canvas.side_grids.z.name = 'side_grid_z'
	Canvas.side_grids.z.visible = !Modes.display;
	Canvas.side_grids.z.rotation.z = Math.PI/2;
	Canvas.side_grids.z.rotation.y = Math.PI/2
	Canvas.side_grids.z.position.y = Format.centered_grid ? 8 : 0;
	Canvas.side_grids.z.position.z = 0
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
	new Action('preview_checkerboard', {
		name: tl('settings.preview_checkerboard'),
		description: tl('settings.preview_checkerboard.desc'),
		category: 'view',
		linked_setting: 'preview_checkerboard',
		keybind: new Keybind({key: 84}),
		click: function () {
			this.toggleLinkedSetting()
		}
	})
	new Action('uv_checkerboard', {
		name: tl('settings.uv_checkerboard'),
		description: tl('settings.uv_checkerboard.desc'),
		category: 'view',
		linked_setting: 'uv_checkerboard',
		click: function () {
			this.toggleLinkedSetting()
		}
	})
	new Action('toggle_shading', {
		name: tl('settings.shading'),
		description: tl('settings.shading.desc'),
		category: 'view',
		linked_setting: 'shading',
		click: function () {
			this.toggleLinkedSetting()
		}
	})
	new Action('toggle_motion_trails', {
		name: tl('settings.motion_trails'),
		description: tl('settings.motion_trails.desc'),
		category: 'view',
		linked_setting: 'motion_trails',
		click: function () {
			this.toggleLinkedSetting()
		}
	})

	new Action('screenshot_model', {
		icon: 'fa-cubes',
		category: 'view',
		keybind: new Keybind({key: 80, ctrl: true}),
		click: function () {Preview.selected.screenshot()}
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
					length_mode: {label: 'dialog.create_gif.length_mode', type: 'select', default: 'seconds', options: {
						seconds: 'dialog.create_gif.length_mode.seconds',
						frames: 'dialog.create_gif.length_mode.frames',
						animation: 'dialog.create_gif.length_mode.animation',
						turntable: 'dialog.create_gif.length_mode.turntable',
					}},
					length: {label: 'dialog.create_gif.length', type: 'number', value: 10, step: 0.25},
					fps: 	{label: 'dialog.create_gif.fps', type: 'number', value: 10},
					quality:{label: 'dialog.create_gif.compression', type: 'number', value: 20, min: 1, max: 80},
					turn:	{label: 'dialog.create_gif.turn', type: 'number', value: 0, min: -10, max: 10},
					play: 	{label: 'dialog.create_gif.play', type: 'checkbox', condition: Animator.open},
				},
				onConfirm: function(formData) {
					Screencam.createGif({
						length_mode: formData.length_mode,
						length: limitNumber(formData.length, 0.1, 24000),
						fps: limitNumber(formData.fps, 0.5, 30),
						quality: limitNumber(formData.quality, 0, 30),
						play: formData.play,
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
	new Action('focus_on_selection', {
		icon: 'center_focus_weak',
		category: 'view',
		condition: () => !Modes.display,
		keybind: new Keybind({key: 191}),
		click: function () {
			let center = getSelectionCenter();
			if (!Format.centered_grid) center.V3_subtract(8, 8, 8)
			quad_previews.current.controls.target.fromArray(center);
		}
	})

	new Action('toggle_camera_projection', {
		icon: 'switch_video',
		category: 'view',
		condition: _ => (!preview.movingBackground || !Modes.display),
		keybind: new Keybind({key: 101}),
		click: function () {
			quad_previews.current.setProjectionMode(!quad_previews.current.isOrtho);
		}
	})
	new Action('camera_initial', {
		name: tl('action.load_camera_angle', tl('menu.preview.angle.initial')),
		description: tl('action.load_camera_angle.desc', tl('menu.preview.angle.initial')),
		icon: 'videocam',
		color: 'y',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 97}),
		click: function () {
			quad_previews.current.loadAnglePreset(DefaultCameraPresets[0])
		}
	})
	new Action('camera_top', {
		name: tl('action.load_camera_angle', tl('direction.top')),
		description: tl('action.load_camera_angle.desc', tl('direction.top')),
		icon: 'videocam',
		color: 'y',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 104}),
		click: function () {
			quad_previews.current.loadAnglePreset(DefaultCameraPresets[1])
		}
	})
	new Action('camera_bottom', {
		name: tl('action.load_camera_angle', tl('direction.bottom')),
		description: tl('action.load_camera_angle.desc', tl('direction.bottom')),
		icon: 'videocam',
		color: 'y',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 98}),
		click: function () {
			quad_previews.current.loadAnglePreset(DefaultCameraPresets[2])
		}
	})
	new Action('camera_south', {
		name: tl('action.load_camera_angle', tl('direction.south')),
		description: tl('action.load_camera_angle.desc', tl('direction.south')),
		icon: 'videocam',
		color: 'z',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 100}),
		click: function () {
			quad_previews.current.loadAnglePreset(DefaultCameraPresets[3])
		}
	})
	new Action('camera_north', {
		name: tl('action.load_camera_angle', tl('direction.north')),
		description: tl('action.load_camera_angle.desc', tl('direction.north')),
		icon: 'videocam',
		color: 'z',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 102}),
		click: function () {
			quad_previews.current.loadAnglePreset(DefaultCameraPresets[4])
		}
	})
	new Action('camera_east', {
		name: tl('action.load_camera_angle', tl('direction.east')),
		description: tl('action.load_camera_angle.desc', tl('direction.east')),
		icon: 'videocam',
		color: 'x',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 103}),
		click: function () {
			quad_previews.current.loadAnglePreset(DefaultCameraPresets[5])
		}
	})
	new Action('camera_west', {
		name: tl('action.load_camera_angle', tl('direction.west')),
		description: tl('action.load_camera_angle.desc', tl('direction.west')),
		icon: 'videocam',
		color: 'x',
		category: 'view',
		condition: _ => !Modes.display,
		keybind: new Keybind({key: 105}),
		click: function () {
			quad_previews.current.loadAnglePreset(DefaultCameraPresets[6])
		}
	})
})
