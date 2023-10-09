var scene,
	main_preview, MediaPreview,
	Sun, lights,
	Transformer,
	display_area, display_base;
var framespersecond = 0;
var display_mode = false;
const three_grid = new THREE.Object3D();
const rot_origin = new THREE.Object3D();
var gizmo_colors = {
	r: new THREE.Color(),
	g: new THREE.Color(),
	b: new THREE.Color(),
	grid: new THREE.Color(),
	solid: new THREE.Color(),
	outline: new THREE.Color(),
	gizmo_hover: new THREE.Color()
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
		locked_angle: 'top',
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
		locked_angle: 'bottom',
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
		locked_angle: 'south',
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
		locked_angle: 'north',
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
		locked_angle: 'east',
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
		locked_angle: 'west',
		default: true
	},
	{
		name: 'camera_angle.common_isometric_right',
		id: 'isometric_right',
		projection: 'orthographic',
		position: [-64, 64*0.8165+8, -64],
		target: [0, 8, 0],
		zoom: 0.5,
		default: true
	},
	{
		name: 'camera_angle.common_isometric_left',
		id: 'isometric_left',
		projection: 'orthographic',
		position: [64, 64*0.8165+8, -64],
		target: [0, 8, 0],
		zoom: 0.5,
		default: true
	},
	{
		name: 'camera_angle.true_isometric_right',
		id: 'isometric_right',
		projection: 'orthographic',
		position: [-64, 64+8, -64],
		target: [0, 8, 0],
		zoom: 0.5,
		default: true
	},
	{
		name: 'camera_angle.true_isometric_left',
		id: 'isometric_left',
		projection: 'orthographic',
		position: [64, 64+8, -64],
		target: [0, 8, 0],
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
		let menu = $(`
			<div class="preview_menu">
				<div class="tool preview_fullscreen_button quad_view_only"><i class="material-icons">fullscreen</i></div>
				<div class="tool preview_view_mode_menu one_is_enough"><i class="material-icons">image</i></div>
				<div class="shading_placeholder"></div>
				<div class="tool preview_main_menu"><i class="material-icons">menu</i></div>
			</div>`)[0];
		/*menu.querySelector('.preview_reference_menu').onclick = (event) => {
			BarItems.edit_reference_images.trigger();
		}*/
		menu.querySelector('.preview_main_menu').onclick = (event) => {
			this.menu.open(menu, this);
		}
		menu.querySelector('.preview_fullscreen_button').onclick = (event) => {
			this.fullscreen();
		}
		menu.querySelector('.preview_view_mode_menu').onclick = (event) => {
			BarItems.view_mode.open(event);
		}
		BarItem.prototype.addLabel(false, {
			name: tl('menu.preview.maximize'),
			node: menu.querySelector('.preview_fullscreen_button')
		})
		BarItem.prototype.addLabel(false, {
			name: tl('action.view_mode'),
			node: menu.querySelector('.preview_view_mode_menu')
		})
		/*BarItem.prototype.addLabel(false, {
			name: tl('action.edit_reference_images'),
			node: menu.querySelector('.preview_reference_menu')
		})*/
		BarItem.prototype.addLabel(false, {
			name: tl('data.preview'),
			node: menu.querySelector('.preview_main_menu')
		})
		this.node.appendChild(menu)
		//Cameras
		this.offscreen = !!options.offscreen;
		this.isOrtho = false;
		this.angle = null;
		this.camPers = new THREE.PerspectiveCamera(settings.fov.value, 16 / 9, settings.camera_near_plane.value||1, 30000);
		this.camOrtho = new THREE.OrthographicCamera(-600,  600, -400, 400, -200, 20000);
		this.camOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: false, a: 'y'}]
		this.camOrtho.axis = null
		this.camOrtho.zoom = 0.5
		this.camPers.preview = this.camOrtho.preview = this;
		for (var i = 4; i <= 6; i++) {
			this.camPers.layers.enable(i);
		}
		this.side_view_target = new THREE.Vector3();

		//Controls
		this.controls = new THREE.OrbitControls(this.camPers, this);
		this.controls.minDistance = 1;
		this.controls.maxDistance = 3960;
		this.controls.enableKeys = false;
		this.controls.zoomSpeed = 1.5;
		this.controls.onUpdate(() => {
			if (this.angle != null) {
				if (this.camOrtho.axis != 'x') this.side_view_target.x = this.controls.target.x;
				if (this.camOrtho.axis != 'y') this.side_view_target.y = this.controls.target.y;
				if (this.camOrtho.axis != 'z') this.side_view_target.z = this.controls.target.z;
			}
		})

		//Annotations
		this.annotations = {};
		this.updateAnnotations = function() {
			for (var key in scope.annotations) {
				var tag = scope.annotations[key];
				if (tag.object.visible) {
					var pos = tag.object.toScreenPosition(scope.camera, scope.canvas);
					tag.node.style.setProperty('left', pos.x+'px');
					tag.node.style.setProperty('top', pos.y+'px');
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

		this.default_angle = DefaultCameraPresets[0];

		this.camPers.position.fromArray(this.default_angle.position);
		this.controls.target.fromArray(this.default_angle.target);

		if (!Blockbench.isMobile && !this.offscreen) {
			this.orbit_gizmo = new OrbitGizmo(this);
			this.node.append(this.orbit_gizmo.node);
		}

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
			let error_element = document.querySelector('#loading_error_detail')
			error_element.innerHTML = `Error creating WebGL context. Try to update your graphics drivers.`

			if (isApp) {
				window.restartWithoutHardwareAcceleration = function() {

					ipcRenderer.send('edit-launch-setting', {key: 'hardware_acceleration', value: false});
					settings.hardware_acceleration = false;
					Settings.saveLocalStorages();

					electron.app.relaunch()
					electron.app.quit()
				}
				error_element.innerHTML = error_element.innerHTML +
					'\nAlternatively, try to <a href onclick="restartWithoutHardwareAcceleration()">Restart without Hardware Acceleration.</a>'
				
				var {BrowserWindow} = require('@electron/remote');
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

		this.selection = {
			box: $('<div id="selection_box" class="selection_rectangle"></div>'),
			frustum: new THREE.Frustum()
		}

		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		addEventListeners(this.canvas, 'mousedown touchstart', 	event => { this.click(event)}, { passive: false })
		addEventListeners(this.canvas, 'mousemove touchmove', 	event => {
			if (!this.static_rclick) return;
			convertTouchEvent(event);
			let threshold = 7;
			if (!this.event_start || !Math.epsilon(this.event_start[0], event.clientX, threshold) || !Math.epsilon(this.event_start[1], event.clientY, threshold)) {
				this.static_rclick = false;
			}
		}, false)
		addEventListeners(this.canvas, 'mousemove', 			event => { this.mousemove(event)}, false)
		addEventListeners(this.canvas, 'mouseup touchend',		event => { this.mouseup(event)}, false)
		addEventListeners(this.canvas, 'dblclick', 				event => { if (settings.double_click_switch_tools.value) Toolbox.toggleTransforms(event); }, false)
		addEventListeners(this.canvas, 'mouseenter touchstart', event => { this.occupyTransformer(event)}, false)
		addEventListeners(this.canvas, 'mouseenter',			event => { this.controls.hasMoved = true}, false)

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
		Outliner.elements.forEach(element => {
			if (element.mesh && element.mesh.geometry && element.visibility && !element.locked) {
				objects.push(element.mesh);
				if (Modes.edit && element.selected) {
					if (element.mesh.vertex_points && element.mesh.vertex_points.visible) {
						objects.push(element.mesh.vertex_points);
					}
					if (element instanceof Mesh && element.mesh.outline.visible && BarItems.selection_mode.value == 'edge') {
						objects.push(element.mesh.outline);
					}
				}
			} else if (element instanceof Locator) {
				objects.push(element.mesh.sprite);
			}
		})
		if (Group.selected && Group.selected.mesh.vertex_points) {
			objects.push(Group.selected.mesh.vertex_points);
		}
		if (Animator.open && settings.motion_trails.value && Group.selected) {
			Animator.motion_trail.children.forEach(object => {
				if (object.isKeyframe === true) {
					objects.push(object)
				}
			})
		}
		var intersects = this.raycaster.intersectObjects( objects );
		if (intersects.length == 0) return false;

		let mesh_gizmo = intersects.find(intersect => intersect.object.type == 'Points' || intersect.object.type == 'LineSegments');
		let intersect = mesh_gizmo || intersects[0];
		let intersect_object = intersect.object;

		if (intersect_object.isElement) {
			let element, face;
			while (true) {
				element = OutlinerNode.uuids[intersect_object.name];
				if (element instanceof Cube) {
					face = intersect_object.geometry.faces[Math.floor(intersects[0].faceIndex / 2)];
				} else if (element instanceof Mesh) {
					let index = intersects[0].faceIndex;
					for (let key in element.faces) {
						let {vertices} = element.faces[key];
						if (vertices.length < 3) continue;

						if (index == 0 || (index == 1 && vertices.length == 4)) {
							face = key;
							break; 
						}
						if (vertices.length == 3) index -= 1;
						if (vertices.length == 4) index -= 2;
					}
				}

				if (Modes.paint && (Toolbox.selected.id == 'color_picker' || (Painter.lock_alpha && Settings.get('paint_through_transparency')))) {
					let texture = element.faces[face].getTexture();
					if (texture) {
						let [x, y] = Painter.getCanvasToolPixelCoords(intersects[0].uv, texture);
						let ctx = Painter.getCanvas(texture).getContext('2d');
						let color = Painter.getPixelColor(ctx, x, y);
						if (color.getAlpha() < 0.004) {
							intersects.shift();
							while (intersects.length && !intersects[0].object.isElement) {
								intersects.shift();
							}
							if (!intersects[0]) return false;
							intersect_object = intersects[0].object;

							continue;
						}
					}
				}
				break;
			}

			return {
				type: 'element',
				event,
				intersects,
				face,
				element
			}
		} else if (intersect_object.isKeyframe) {
			let uuid = intersect_object.keyframeUUIDs[intersect.index];
			let keyframe = Timeline.keyframes.find(kf => kf.uuid == uuid);
			return {
				event,
				type: 'keyframe',
				intersects,
				keyframe: keyframe
			}
		} else if (intersect_object.type == 'Points') {
			var element = OutlinerNode.uuids[intersect_object.element_uuid];
			let vertex = element instanceof Mesh
				? Object.keys(element.vertices)[intersect.index]
				: intersect_object.vertices[intersect.index];
			return {
				event,
				type: 'vertex',
				element,
				intersects,
				intersect,
				vertex,
				vertex_index: intersect.index,
			}
		} else if (intersect_object.type == 'LineSegments') {
			var element = OutlinerNode.uuids[intersect_object.parent.name];
			let vertices = intersect_object.vertex_order.slice(intersect.index, intersect.index+2);
			return {
				event,
				type: 'line',
				element,
				intersects,
				intersect,
				vertices
			}
		}
	}
	render() {
		this.controls.update()
		this.renderer.render(
			scene,
			this.camera
		)
	}
	//Camera
	get camera() {
		return this.isOrtho ? this.camOrtho : this.camPers;
	}
	setProjectionMode(ortho, toggle) {

		let position = this.camera.position;
		this.isOrtho = !!ortho;
		this.resize()
		this.controls.object = this.camera;
		this.camera.position.copy(position);
		if (toggle) {
			let perspective_distance = this.camPers.position.distanceTo(this.controls.target);
			let factor = 0.64 * devicePixelRatio * this.camPers.getFocalLength();
			if (this.isOrtho) {
				this.camera.zoom = factor / perspective_distance;
			} else {
				let target_distance = factor / this.camOrtho.zoom;
				let cam_offset = new THREE.Vector3().copy(this.camPers.position).sub(this.controls.target);
				cam_offset.multiplyScalar(target_distance / perspective_distance);
				this.camPers.position.copy(cam_offset).add(this.controls.target);
			}
		}
		if (!this.offscreen) {
			this.setLockedAngle();
			this.controls.updateSceneScale();
		}
		if (this == Preview.selected) {
			this.occupyTransformer();
		}
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
		if (typeof angle === 'string' && this.isOrtho) {

			this.angle = angle
			this.controls.enableRotate = false;

			switch (angle) {
				case 'top':
				this.camOrtho.axis = 'y'
				this.camOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: false, a: 'z'}]
				break;
				case 'bottom':
				this.camOrtho.axis = 'y'
				this.camOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: true, a: 'z'}]
				break;
				case 'south':
				this.camOrtho.axis = 'z'
				this.camOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: true, a: 'y'}]
				break;
				case 'north':
				this.camOrtho.axis = 'z'
				this.camOrtho.backgroundHandle = [{n: true, a: 'x'}, {n: true, a: 'y'}]
				break;
				case 'east':
				this.camOrtho.axis = 'x'
				this.camOrtho.backgroundHandle = [{n: true, a: 'z'}, {n: true, a: 'y'}]
				break;
				case 'west':
				this.camOrtho.axis = 'x'
				this.camOrtho.backgroundHandle = [{n: false, a: 'z'}, {n: true, a: 'y'}]
				break;
			}

			var layer = getAxisNumber(this.camOrtho.axis)+1;
			this.camOrtho.layers.set(0);
			this.camOrtho.layers.enable(layer);
			for (var i = 1; i <= 3; i++) {
				if (i != layer) {
					this.camOrtho.layers.enable(i+3);
				}
			}
			if (this.camOrtho.axis != 'x') {
				this.controls.target.x = this.camOrtho.position.x = this.side_view_target.x;
			}
			if (this.camOrtho.axis != 'y') {
				this.controls.target.y = this.camOrtho.position.y = this.side_view_target.y;
			}
			if (this.camOrtho.axis != 'z') {
				this.controls.target.z = this.camOrtho.position.z = this.side_view_target.z;
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
		}

		Transformer.update();
		ReferenceImage.updateAll();
		return this;
	}
	setDefaultAnglePreset(preset) {
		this.default_angle = preset;
		this.loadAnglePreset(preset);
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
		if (this.isOrtho && preset.zoom && !preset.locked_angle) {
			this.camera.zoom = preset.zoom;
			this.camera.updateProjectionMatrix()
		}
		if (!this.isOrtho) {
			if (typeof preset.focal_length == 'number') {
				// Only used for display mode and similar presets
				this.camera.setFocalLength(preset.focal_length);
			} else {
				this.setFOV(Settings.get('fov'));
			}
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
		let rotation_mode = 'target';

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
				divider1: '_',
				rotation_mode: {label: 'dialog.save_angle.rotation_mode', type: 'inline_select', value: rotation_mode, options: {
					target: 'dialog.save_angle.target',
					rotation: 'dialog.save_angle.rotation'
				}},
				position: {label: 'dialog.save_angle.position', type: 'vector', dimensions: 3, value: position},
				target: {label: 'dialog.save_angle.target', type: 'vector', dimensions: 3, value: target, condition: ({rotation_mode}) => rotation_mode == 'target'},
				rotation: {label: 'dialog.save_angle.rotation', type: 'vector', dimensions: 2, condition: ({rotation_mode}) => rotation_mode == 'rotation'},
				zoom: {label: 'dialog.save_angle.zoom', type: 'number', value: 1, condition: result => (result.projection == 'orthographic')},
			},
			onFormChange(form) {
				if (form.rotation_mode !== rotation_mode) {
					rotation_mode = form.rotation_mode;
					if (form.rotation_mode == 'rotation') {
						this.setFormValues({rotation: cameraTargetToRotation(form.position, form.target).map(trimFloatNumber)});
					} else {
						this.setFormValues({target: cameraRotationToTarget(form.position, form.rotation).map(trimFloatNumber)});
					}
				}
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
		if (open_menu) open_menu.hide();
		unselectInterface(event);
		convertTouchEvent(event);
		Preview.selected = this;
		this.static_rclick = event.which === 3 || event.type == 'touchstart';
		if (this.static_rclick) {
			this.event_start = [event.clientX, event.clientY];
		}
		if (event.type == 'touchstart') {
			this.rclick_cooldown = setTimeout(() => {
				this.rclick_cooldown = true;
			}, 420)
			Transformer.dispatchPointerHover(event);
		}
		if (Transformer.hoverAxis !== null) return;
		let is_canvas_click = Keybinds.extra.preview_select.keybind.isTriggered(event) || event.which === 0;

		var data = is_canvas_click && this.raycast(event);
		if (data) {
			this.selection.click_target = data;

			function unselectOtherNodes() {
				if (Group.selected) Group.selected.unselect();
				Outliner.elements.forEach(el => {
					if (el !== data.element) Outliner.selected.remove(el);
				})
			}

			let select_mode = BarItems.selection_mode.value
			if (!Condition(BarItems.selection_mode.condition)) {
				select_mode = 'object';
			}

			if (Toolbox.selected.selectElements && Modes.selected.selectElements && data.type === 'element') {
				if (Toolbox.selected.selectFace && data.face) {
					if (data.element instanceof Mesh && select_mode == 'face' && (event.ctrlOrCmd || Pressing.overrides.ctrl || event.shiftKey || Pressing.overrides.shift)) {
						UVEditor.vue.selected_faces.safePush(data.face)
					} else {
						UVEditor.setFace(data.face, false);
					}
				}
				Blockbench.dispatchEvent('canvas_select', data)
				if (Modes.paint) {
					event = 0;
				}
				if (data.element.parent.type === 'group' && (!data.element instanceof Mesh || select_mode == 'object') && (
					(Animator.open && !data.element.constructor.animator) ||
					event.shiftKey || Pressing.overrides.shift ||
					(!Format.rotate_cubes && Format.bone_rig && ['rotate_tool', 'pivot_tool'].includes(Toolbox.selected.id))
				)) {
					if (data.element.parent.selected && (event.shiftKey || Pressing.overrides.shift)) {
						let super_parent = data.element.parent;
						while (super_parent.parent instanceof Group && super_parent.selected) {
							super_parent = super_parent.parent;
						}
						super_parent.select().showInOutliner();
					} else {
						data.element.parent.select().showInOutliner();
					}

				} else if (!Animator.open) {

					if (data.element instanceof Mesh && select_mode == 'face') {
						if (!data.element.selected) data.element.select(event);

						if (!(event.ctrlOrCmd || Pressing.overrides.ctrl || event.shiftKey || Pressing.overrides.shift)) {
							unselectOtherNodes()
						}

						let mesh = data.element;
						let selected_vertices = mesh.getSelectedVertices(true);
						let selected_edges = mesh.getSelectedEdges(true);
						let selected_faces = mesh.getSelectedFaces(true);

						if (event.altKey || Pressing.overrides.alt) {
							
							let start_face = mesh.faces[data.face];
							if (!start_face) return;
							let processed_faces = [];
							function selectFace(face, index) {
								if (processed_faces.includes(face)) return;
								processed_faces.push(face);
								if (start_face.vertices.length == 4 && face.vertices.length != 4) return;
								let next = face.getAdjacentFace(index);
								if (next) selectFace(next.face, next.index+2);

							}

							let face_test = start_face.getAdjacentFace(1);
							let index = (face_test && face_test.face.isSelected(face_test.key)) ? 2 : 1;
							selectFace(start_face, index);
							if (start_face.vertices.length == 4) {
								processed_faces.remove(start_face);
								selectFace(start_face, (index+2) % 4);
							}

							if (!(event.ctrlOrCmd || Pressing.overrides.ctrl || event.shiftKey || Pressing.overrides.shift)) {
								selected_vertices.empty();
								selected_edges.empty();
								selected_faces.empty();
								UVEditor.vue.selected_faces.empty();
							}

							processed_faces.forEach(face => {
								selected_vertices.safePush(...face.vertices);
								let fkey = face.getFaceKey();
								UVEditor.vue.selected_faces.push(fkey);
								selected_faces.push(fkey);
							});
						} else {
							let face_vkeys = data.element.faces[data.face].vertices;
							
							if (event.ctrlOrCmd || Pressing.overrides.ctrl || event.shiftKey || Pressing.overrides.shift) {
								if (selected_faces.includes(data.face)) {
									let selected_faces = data.element.getSelectedFaces();
									let vkeys_to_remove = face_vkeys.filter(vkey => {
										return !selected_faces.find(fkey => {
											return fkey !== data.face && data.element.faces[fkey].vertices.includes(vkey)
										})
									})
									if (vkeys_to_remove.length == 0) vkeys_to_remove.push(face_vkeys[0]);
									selected_vertices.remove(...vkeys_to_remove);
									UVEditor.vue.selected_faces.remove(data.face);
									selected_faces.remove(data.face);
								} else {
									selected_vertices.safePush(...face_vkeys);
									UVEditor.vue.selected_faces.safePush(data.face);
									selected_faces.safePush(data.face);
								}
							} else {
								selected_edges.empty();
								selected_vertices.replace(face_vkeys);
								UVEditor.vue.selected_faces.replace([data.face]);
								selected_faces.replace([data.face]);
							}
						}

					} else if (data.element instanceof Mesh && select_mode == 'cluster') {
						if (!data.element.selected) data.element.select(event);

						if (!(event.ctrlOrCmd || Pressing.overrides.ctrl || event.shiftKey || Pressing.overrides.shift)) {
							unselectOtherNodes()
						}

						let mesh = data.element;
						let selected_vertices = mesh.getSelectedVertices(true);
						let selected_edges = mesh.getSelectedEdges(true);
						let selected_faces = mesh.getSelectedFaces(true);

						if (!(event.ctrlOrCmd || Pressing.overrides.ctrl || event.shiftKey || Pressing.overrides.shift)) {
							selected_vertices.empty();
							selected_edges.empty();
							selected_faces.empty();
							UVEditor.vue.selected_faces.empty();
						}
							
						let start_face = mesh.faces[data.face];
						if (!start_face) return;
						function selectFace(face, fkey) {
							if (selected_faces.includes(fkey)) return;
							
							selected_faces.push(fkey);
							UVEditor.vue.selected_faces.push(fkey);
							selected_vertices.safePush(...face.vertices);

							for (let fkey2 in mesh.faces) {
								let face2 = mesh.faces[fkey2];
								if (face.vertices.find(vkey => face2.vertices.includes(vkey))) {
									selectFace(face2, fkey2);
								}
							}
						}
						selectFace(start_face, data.face);

					} else if (data.element instanceof Mesh && ['edge', 'vertex'].includes(select_mode)) {
						data.element.select()
					} else {
						data.element.select(event)
					}
					updateSelection();
				} else {
					data.element.select(event);
				}
			} else if (Animator.open && data.type == 'keyframe') {
				if (data.keyframe instanceof Keyframe) {
					data.keyframe.select(event).callPlayhead();
					updateSelection();
				}

			} else if (data.type == 'vertex' && Toolbox.selected.id !== 'vertex_snap_tool') {

				let list = data.element.getSelectedVertices(true);
				let edges = data.element.getSelectedEdges(true);
				let faces = data.element.getSelectedEdges(true);

				if (event.ctrlOrCmd || Pressing.overrides.ctrl || event.shiftKey || Pressing.overrides.shift) {
					list.toggle(data.vertex);
				} else {
					unselectOtherNodes();
					list.replace([data.vertex]);
					edges.empty();
					faces.empty();
				}
				updateSelection();
			} else if (data.type == 'line') {

				let vertices = data.element.getSelectedVertices(true);
				let edges = data.element.getSelectedEdges(true);
				let faces = data.element.getSelectedEdges(true);

				if (event.ctrlOrCmd || Pressing.overrides.ctrl || event.shiftKey || Pressing.overrides.shift) {
					let index = edges.findIndex(edge => sameMeshEdge(edge, data.vertices))
					if (index >= 0) {
						vertices.remove(...data.vertices);
						edges.splice(index, 1);
					} else {
						edges.push(data.vertices);
						vertices.safePush(...data.vertices);
					}
				} else {
					faces.empty();
					edges.splice(0, Infinity, data.vertices);
					vertices.replace(data.vertices);
					unselectOtherNodes();
				}
				if (event.altKey || Pressing.overrides.alt) {
					
					let mesh = data.element;
					let start_face;
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						if (face.vertices.length < 3) continue;
						let vertices = face.vertices.filter(vkey => data.vertices.includes(vkey))
						if (vertices.length >= 2) {
							start_face = face;
							break;
						}
					}
					if (!start_face) return;
					let processed_faces = [start_face];

					function splitFace(face, side_vertices) {
						processed_faces.push(face);
						let sorted_vertices = face.getSortedVertices();
	
						let side_index_diff = sorted_vertices.indexOf(side_vertices[0]) - sorted_vertices.indexOf(side_vertices[1]);
						if (side_index_diff == -1 || side_index_diff > 2) side_vertices.reverse();

						let opposite_vertices = sorted_vertices.filter(vkey => !side_vertices.includes(vkey));
						let opposite_index_diff = sorted_vertices.indexOf(opposite_vertices[0]) - sorted_vertices.indexOf(opposite_vertices[1]);
						if (opposite_index_diff == 1 || opposite_index_diff < -2) opposite_vertices.reverse();

						vertices.safePush(...side_vertices);
						edges.push(side_vertices);

						// Find next (and previous) face
						function doNextFace(index) {
							for (let fkey in mesh.faces) {
								let ref_face = mesh.faces[fkey];
								if (ref_face.vertices.length < 3 || processed_faces.includes(ref_face)) continue;
	
								let sorted_vertices = ref_face.getSortedVertices();
								let vertices = ref_face.vertices.filter(vkey => vkey == side_vertices[index] || vkey == opposite_vertices[index]);
	
								if (vertices.length >= 2) {
									let second_vertex = sorted_vertices.find((vkey, i) => {
										return vkey !== side_vertices[index]
											&& vkey !== opposite_vertices[index]
											&& (sorted_vertices.length == 3 || Math.abs(sorted_vertices.indexOf(side_vertices[index]) - i) !== 2);
									})
									splitFace(ref_face, [side_vertices[index], second_vertex]);
									break;
								}
							}
						}
						doNextFace(0)
						doNextFace(1);
					}
					splitFace(start_face, data.vertices);
				}
				updateSelection();
			}
			if (typeof Toolbox.selected.onCanvasClick === 'function') {
				Toolbox.selected.onCanvasClick(data)
				Blockbench.dispatchEvent('canvas_click', data)
			}
			return true;
		}
		if (is_canvas_click && typeof Toolbox.selected.onCanvasClick === 'function') {
			Toolbox.selected.onCanvasClick({event})
		}

		if (Keybinds.extra.preview_area_select.keybind.isTriggered(event)) {
			this.startSelRect(event)
		} else {
			return false;
		}
	}
	mousemove(event) {
		if (Settings.get('highlight_cubes') || Toolbox.selected.brush?.size) {
			var data = this.raycast(event);
			updateCubeHighlights(data && data.element);

			if (Toolbox.selected.brush?.size && Settings.get('brush_cursor_3d')) {
				if (!data) {
					scene.remove(Canvas.brush_outline);
					return;
				}
				if (!data.element.faces) return;
				let face = data.element.faces[data.face];
				let texture = face.getTexture();
				if (!texture) {
					scene.remove(Canvas.brush_outline);
					return;
				}
				scene.add(Canvas.brush_outline);

				let intersect = data.intersects[0];
				let world_quaternion = intersect.object.getWorldQuaternion(Reusable.quat1)
				let world_normal = Reusable.vec1.copy(intersect.face.normal).applyQuaternion(world_quaternion);

				// UV
				let uv_factor_x = Project.texture_width / texture.width;
				let uv_factor_y = Project.texture_height / texture.display_height;
				let offset = 0;
				let x = intersect.uv.x * texture.width;
				let y = (1-intersect.uv.y) * texture.height;
				if (Condition(Toolbox.selected.brush.floor_coordinates)) {
					offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0 : 0.5;
					x = Math.round(x + offset) - offset;
					y = Math.round(y + offset) - offset;
				}
				// Position
				let brush_coord = face.UVToLocal([x * uv_factor_x, y * uv_factor_y]);
				let brush_coord_difference_x = face.UVToLocal([(x+1) * uv_factor_x, y * uv_factor_y]);
				let brush_coord_difference_y = face.UVToLocal([x * uv_factor_x, (y+1) * uv_factor_y]);
				brush_coord_difference_x.sub(brush_coord);
				brush_coord_difference_y.sub(brush_coord);
				intersect.object.localToWorld(brush_coord);
				if (!Format.centered_grid) {
					brush_coord.x += 8;
					brush_coord.y += 8;
					brush_coord.z += 8;
				}
				Canvas.brush_outline.position.copy(brush_coord);

				// z fighting
				let z_fight_offset = Preview.selected.calculateControlScale(brush_coord) / 8;
				Canvas.brush_outline.position.addScaledVector(world_normal, z_fight_offset);

				//size
				let radius_x = BarItems.slider_brush_size.get() * (1+z_fight_offset) * brush_coord_difference_x.length();
				let radius_y = BarItems.slider_brush_size.get() * (1+z_fight_offset) * brush_coord_difference_y.length();
				Canvas.brush_outline.scale.set(radius_x, radius_y, radius_x);

				let uv = Canvas.brush_outline.geometry.attributes.uv;
				if (BarItems.brush_shape.value == 'square') {
					let view_factor = z_fight_offset * 20;
					uv.array[0] = uv.array[4] = (1 - (1 / radius_x * view_factor)) / 32;
					uv.array[5] = uv.array[7] = (1 - (1 / radius_y * view_factor)) / 32;
					uv.array[2] = uv.array[6] = (31 + (1 / radius_x * view_factor)) / 32;
					uv.array[1] = uv.array[3] = (31 + (1 / radius_y * view_factor)) / 32;
					uv.needsUpdate = true;

				} else if (uv.array[0] != 0) {
					uv.array[0] = uv.array[4] = uv.array[5] = uv.array[7] = 0;
					uv.array[2] = uv.array[6] = uv.array[1] = uv.array[3] = 1;
					uv.needsUpdate = true;
				}

				// rotation
				Canvas.brush_outline.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), intersect.face.normal);

				Canvas.brush_outline.rotation.z = 0;
				let inverse = Reusable.quat2.copy(Canvas.brush_outline.quaternion).invert();
				brush_coord_difference_y.applyQuaternion(inverse);
				let rotation = Math.atan2(brush_coord_difference_y.x, -brush_coord_difference_y.y);
				Canvas.brush_outline.rotation.z = rotation;
				
				Canvas.brush_outline.quaternion.premultiply(world_quaternion);
			}
		}
	}
	mouseup(event) {
		this.showContextMenu(event);
		if (settings.canvas_unselect.value &&
			(event.which === 1 || event.which === 3 || event instanceof TouchEvent) &&
			!this.controls.hasMoved &&
			!this.selection.activated &&
			!Transformer.dragging &&
			!this.selection.click_target
		) {
			unselectAll();
		}
		delete this.selection.click_target;
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
	showContextMenu(event) {
		Prop.active_panel = 'preview';
		if (this.static_rclick && (event.which === 3 || (event.type == 'touchend' && this.rclick_cooldown == true))) {
			var data = this.raycast(event)
			if (data) this.selection.click_target = data;
			if (Toolbox.selected.selectElements && Modes.selected.selectElements && data && data.element && !Modes.animate) {
				data.element.showContextMenu(event);

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
	occupyTransformer(event) {
		if (this.offscreen || Transformer.dragging) return this;

		Transformer.camera = this.isOrtho ? this.camOrtho : this.camPers
		Transformer.orbit_controls = this.controls
		Transformer.setCanvas(this.canvas)
		main_preview.controls.updateSceneScale()
		if (event && event.type == 'touchstart') {
			Transformer.simulateMouseDown(event);
		}
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
		if (this.sr_move_f) return;
		var scope = this;
		if (Modes.edit) {
			this.sr_move_f = function(event) { scope.moveSelRect(event)}
			this.sr_stop_f = function(event) { scope.stopSelRect(event)}
			addEventListeners(document, 'mousemove touchmove', 	this.sr_move_f)
			addEventListeners(document, 'mouseup touchend', 	this.sr_stop_f)
		}

		this.selection.start_x = event.offsetX+0
		this.selection.start_y = event.offsetY+0
		this.selection.client_x = event.clientX+0
		this.selection.client_y = event.clientY+0

		if (Modes.edit && event.type !== 'touchstart') {
			$(this.node).append(this.selection.box)
			this.selection.activated = false;
			this.selection.old_selected = Outliner.selected.slice();
			this.selection.old_mesh_selection = JSON.parse(JSON.stringify(Project.mesh_selection));

			this.moveSelRect(event)
		}

	}
	moveSelRect(event) {
		var scope = this;
		convertTouchEvent(event);

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
		
		let vector = new THREE.Vector3();
		let rect_start = [c.ax, c.ay];
		let rect_end = [c.bx, c.by];
		let extend_selection = (event.shiftKey || Pressing.overrides.shift) ||
				((event.ctrlOrCmd || Pressing.overrides.ctrl) && !Keybinds.extra.preview_area_select.keybind.ctrl)
		let selection_mode = BarItems.selection_mode.value;

		let widthHalf = 0.5 * scope.canvas.width / window.devicePixelRatio;
		let heightHalf = 0.5 * scope.canvas.height / window.devicePixelRatio;

		function projectPoint(vector) {
			vector.project(scope.camera);
			return [
				 ( vector.x * widthHalf ) + widthHalf,
				-( vector.y * heightHalf ) + heightHalf
			]
		}

		const isForeground_raycaster = new THREE.Raycaster();
		isForeground_raycaster.near = Number.EPSILON; // to avoid self-intersecting 
		function isForeground(parentElement, selectionTarget){
			if(Project.view_mode === 'wireframe'){
				// if View Mode is set to wireframe, all elements are visible.
				// So it makes sense to make them all selectable!
				// Also mirrors what happens in Blender. 
				return true;
			}
			let center = null;
			let position = null;
			let origin = parentElement.origin;
			if(selectionTarget.mesh){
				// selectionTarget is a Mesh or a MeshFace
				center = selectionTarget.getCenter(true);
			} else {
				// selectionTarget is a vertex position
				center = selectionTarget;
			}
			position = [center[0]+origin[0], center[1]+origin[1], center[2]+origin[2]];
			let rc_origin = new THREE.Vector3(position[0], position[1], position[2]);
			let rc_direction = new THREE.Vector3(Preview.selected.camera.position.x, Preview.selected.camera.position.y, Preview.selected.camera.position.z);
			rc_direction = rc_direction.sub(rc_origin);
			rc_direction.normalize();
			isForeground_raycaster.set(rc_origin, rc_direction);
			let intersects = isForeground_raycaster.intersectObjects(Outliner.elements.map( el => el.mesh));
			return (intersects.length == 0);
		}

		unselectAll()
		Outliner.elements.forEach((element) => {
			let isSelected;
			if (extend_selection && scope.selection.old_selected.includes(element) && (element instanceof Mesh == false || selection_mode == 'object')) {
				isSelected = true

			} else if (element.visibility) {
				if (element.mesh && element.resizable) {
					let {mesh} = element;
					
					if (element instanceof Mesh && (selection_mode == 'object' || scope.selection.old_selected.includes(element))) {

						let mesh_selection;
						if (selection_mode != 'object') {
							isSelected = true;
							if (!Project.mesh_selection[element.uuid]) {
								mesh_selection = Project.mesh_selection[element.uuid] = {vertices: [], edges: [], faces: []};
							} else {
								mesh_selection = Project.mesh_selection[element.uuid];
							}
							if (!extend_selection) mesh_selection.vertices.empty();
						}

						let vertex_points = {};
						let is_on_screen = false;
						for (let vkey in element.vertices) {
							let point = projectPoint( mesh.localToWorld(vector.fromArray(element.vertices[vkey])) );
							vertex_points[vkey] = point;
							if (point[0] >= 0 && point[0] <= scope.width && point[1] >= 0 && point[1] <= scope.height) {
								is_on_screen = true;
							}
						}
						if (extend_selection && this.selection.old_mesh_selection[element.uuid]) {
							mesh_selection.vertices.safePush(...this.selection.old_mesh_selection[element.uuid].vertices);
							mesh_selection.edges.safePush(...this.selection.old_mesh_selection[element.uuid].edges);
							mesh_selection.faces.safePush(...this.selection.old_mesh_selection[element.uuid].faces);
						}
						if (!is_on_screen) {
						} else if (selection_mode == 'vertex') {
							for (let vkey in element.vertices) {
								let point = vertex_points[vkey];
								if (!mesh_selection.vertices.includes(vkey) && pointInRectangle(point, rect_start, rect_end) && isForeground(element, element.vertices[vkey])) {
									mesh_selection.vertices.push(vkey);
								}
							}

						} else if (selection_mode == 'edge') {
							for (let fkey in element.faces) {
								let face = element.faces[fkey];
								let vertices = face.getSortedVertices();
								for (let i = 0; i < vertices.length; i++) {
									let vkey = vertices[i];
									let vkey2 = vertices[i+1]||vertices[0];
									let p1 = vertex_points[vkey];
									let p2 = vertex_points[vkey2];
									if (lineIntersectsReactangle(p1, p2, rect_start, rect_end)) {
										mesh_selection.vertices.safePush(vkey, vkey2);
										let edge = [vkey, vkey2];
										if (!mesh_selection.edges.find(edge2 => sameMeshEdge(edge, edge2)) && (isForeground(element, element.vertices[vkey]) && isForeground(element, element.vertices[vkey2]))) {
											mesh_selection.edges.push(edge);
										}
									}
								}
							}
	
						} else {
							for (let fkey in element.faces) {
								let face = element.faces[fkey];
								if(!isForeground(element, face)){
									continue;
								}
								let vertices = face.getSortedVertices();
								let face_intersects;
								for (let i = 0; i < vertices.length; i++) {
									let vkey = vertices[i];
									let vkey2 = vertices[i+1]||vertices[0];
									let p1 = vertex_points[vkey];
									let p2 = vertex_points[vkey2];
									if (lineIntersectsReactangle(p1, p2, rect_start, rect_end)) {
										face_intersects = true;
										break;
									}
								}
								if (selection_mode == 'object') {
									if (face_intersects && isForeground(element, element)) {
										isSelected = true;
										break;
									}
								} else {
									if (face_intersects) {
										mesh_selection.vertices.safePush(...face.vertices);
										mesh_selection.faces.safePush(fkey);
										UVEditor.vue.selected_faces.safePush(fkey);
									} else {
										mesh_selection.faces.remove(fkey);
										UVEditor.vue.selected_faces.remove(fkey);
									}
								}
							}
						}

					} else if (element instanceof Cube && (selection_mode == 'object' || !Format.meshes || !scope.selection.old_selected.find(el => el instanceof Mesh))) {
						var adjustedFrom = element.from.slice();
						var adjustedTo = element.to.slice();
						adjustFromAndToForInflateAndStretch(adjustedFrom, adjustedTo, element);

						let vertices = [
							[adjustedFrom[0] , adjustedFrom[1] , adjustedFrom[2] ],
							[adjustedFrom[0] , adjustedFrom[1] , adjustedTo[2]   ],
							[adjustedFrom[0] , adjustedTo[1]   , adjustedTo[2]   ],
							[adjustedFrom[0] , adjustedTo[1]   , adjustedFrom[2] ],
							[adjustedTo[0]   , adjustedFrom[1] , adjustedFrom[2] ],
							[adjustedTo[0]   , adjustedFrom[1] , adjustedTo[2]   ],
							[adjustedTo[0]   , adjustedTo[1]   , adjustedTo[2]   ],
							[adjustedTo[0]   , adjustedTo[1]   , adjustedFrom[2] ],
						].map(coords => {
							coords.V3_subtract(element.origin);
							vector.fromArray(coords);
							mesh.localToWorld(vector);
							return projectPoint(vector);
						})
						let is_on_screen = vertices.find(vertex => {
							return (vertex[0] >= 0 && vertex[0] <= scope.width
								 && vertex[1] >= 0 && vertex[1] <= scope.height);
						})
						isSelected = is_on_screen && (
							   lineIntersectsReactangle(vertices[0], vertices[1], rect_start, rect_end)
							|| lineIntersectsReactangle(vertices[1], vertices[2], rect_start, rect_end)
							|| lineIntersectsReactangle(vertices[2], vertices[3], rect_start, rect_end)
							|| lineIntersectsReactangle(vertices[3], vertices[0], rect_start, rect_end)

							|| lineIntersectsReactangle(vertices[4], vertices[5], rect_start, rect_end)
							|| lineIntersectsReactangle(vertices[5], vertices[6], rect_start, rect_end)
							|| lineIntersectsReactangle(vertices[6], vertices[7], rect_start, rect_end)
							|| lineIntersectsReactangle(vertices[7], vertices[4], rect_start, rect_end)

							|| lineIntersectsReactangle(vertices[0], vertices[4], rect_start, rect_end)
							|| lineIntersectsReactangle(vertices[1], vertices[5], rect_start, rect_end)
							|| lineIntersectsReactangle(vertices[2], vertices[6], rect_start, rect_end)
							|| lineIntersectsReactangle(vertices[3], vertices[7], rect_start, rect_end)
						);
					}

				} else if (element.mesh) {
					
					element.mesh.getWorldPosition(vector);
					isSelected = pointInRectangle(projectPoint(vector), rect_start, rect_end);
				}
			}
			if (isSelected) {
				element.selectLow();
			}
		})
		TickUpdates.selection = true;
	}
	stopSelRect(event) {
		removeEventListeners(document, 'mousemove touchmove', this.sr_move_f);
		removeEventListeners(document, 'mouseup touchend',	this.sr_stop_f);
		delete this.sr_move_f;
		delete this.sr_stop_f;
		this.selection.box.detach()
		this.selection.activated = false;
	}
	// Background
	loadBackground() {
		console.warn('Preview.loadBackground() is no longer supported')
	}
	updateBackground() {
		console.warn('Preview.updateBackground() is no longer supported')
	}
	//Misc
	screenshot(options, cb) {
		return Screencam.screenshotPreview(this, options, cb);
	}
	fullscreen() {
		if (Preview.selected) {
			Preview.selected.controls.stopMovement()
		}
		Preview.selected = this;
		Preview.split_screen.enabled = false;
		$('#preview > .split_screen_wrapper, #preview > .single_canvas_wrapper').remove()

		var wrapper = Interface.createElement('div', {class: 'single_canvas_wrapper'});
		wrapper.append(this.node)
		$('#preview').append(wrapper)

		this.node.querySelectorAll('.one_is_enough').forEach(child => {
			child.style.display = 'block';
		})
		this.node.querySelectorAll('.quad_view_only').forEach(child => {
			child.style.display = 'none';
		})
		
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
		if (Preview.split_screen.enabled) {
			this.fullscreen()
		} else {
			Preview.split_screen.setMode(Preview.split_screen.before);
		}
	}
	delete() {
		this.renderer.dispose();
		this.renderer.forceContextLoss()
		this.canvas.remove();
		this.node.remove();
		Blockbench.removeDragHandler('preview_'+this.id)
		if (Preview.selected == this) {
			Preview.selected = Preview.all.find(preview => preview.canvas.isConnected);
		}
		Preview.all.remove(this);
	}
}
	Preview.prototype.menu = new Menu([
		'screenshot_model',
		{
			icon: 'icon-player',
			name: 'settings.display_skin',
			condition: () => ((display_mode && displayReferenceObjects.active.id === 'player') || Project.bedrock_animation_mode == 'attachable_third'),
			click: function() {
			
				changeDisplaySkin()
			}
		},
		'preview_checkerboard',
		new MenuSeparator('reference_images'),
		'add_reference_image',
		'reference_image_from_clipboard',
		'toggle_all_reference_images',
		'edit_reference_images',
		'preview_scene',
		new MenuSeparator('controls'),
		'focus_on_selection',
		{icon: 'add_a_photo', name: 'menu.preview.save_angle', condition(preview) {return !ReferenceImageMode.active && !Modes.display}, click(preview) {
			preview.newAnglePreset()
		}},
		{id: 'angle', icon: 'videocam', name: 'menu.preview.angle', condition(preview) {return !ReferenceImageMode.active && !Modes.display}, children: function(preview) {
			var children = [
			]
			let presets = localStorage.getItem('camera_presets')
			presets = (presets && autoParseJSON(presets, false)) || [];
			let all_presets = [
				DefaultCameraPresets[0], '_',
				...DefaultCameraPresets.slice(1, 7), '_',
				...DefaultCameraPresets.slice(7, 11), '_',
				...DefaultCameraPresets.slice(11).filter(preset => Condition(preset.condition)), '_',
				...presets
			];

			all_presets.forEach(preset => {
				if (typeof preset == 'string') {
					children.push('_'); return;
				}
				let icon = typeof preset.locked_angle ? 'videocam' : (preset.locked_angle == preview.angle ? 'radio_button_checked' : 'radio_button_unchecked'); 
				children.push({
					name: preset.name,
					color: preset.color,
					id: preset.name,
					preset,
					icon,
					click: () => {
						preview.loadAnglePreset(preset)
					},
					children: !preset.default && [
						{icon: 'edit', name: 'menu.preview.angle.edit', click() {
							editCameraPreset(preset, presets);
						}},
						{icon: 'delete', name: 'generic.delete', click() {
							presets.remove(preset);
							localStorage.setItem('camera_presets', JSON.stringify(presets));
						}}
					]
				})
			})

			return children;
		}},
		{icon: (preview) => (preview.isOrtho ? 'check_box' : 'check_box_outline_blank'), name: 'menu.preview.orthographic', click: function(preview) {
			preview.setProjectionMode(!preview.isOrtho, true);
		}},
		new MenuSeparator('interface'),
		'split_screen',
		{icon: 'fullscreen', name: 'menu.preview.maximize', condition: function(preview) {return Preview.split_screen.enabled && !ReferenceImageMode.active && !Modes.display}, click: function(preview) {
			preview.fullscreen();
		}}
	])

Preview.all = [];
Preview.split_screen = {
	enabled: false,
	mode: 'single',
	before: null,

	previews: [],
	lazyLoadPreview(index, camera_preset) {
		let preview = Preview.split_screen.previews[index];
		if (!preview) {
			if (index == 0) {
				preview = main_preview;
			} else {
				preview = new Preview({id: `split_screen_${index}`});
			}
			if (camera_preset) {
				preview.setDefaultAnglePreset(camera_preset);
			}
			Preview.split_screen.previews[index] = preview;
		}
		return preview;
	},

	/**
	 * 
	 * @param {'single'|'double_horizontal'|'double_vertical'|'quad'|'triple_left'|'triple_right'|'triple_top'|'triple_bottom'} mode 
	 * @returns 
	 */
	setMode(mode = 'single') {
		Preview.split_screen.mode = mode;
		if (mode == 'single') {
			Preview.split_screen.enabled = false;
			Interface.preview.setAttribute('split_screen_mode', null);
			Preview.selected.fullscreen();
			updateInterface()
			ReferenceImage.updateAll();
			return;
		}
		Preview.split_screen.enabled = true;

		$('#preview .single_canvas_wrapper').remove();
		$('#preview .split_screen_wrapper').remove();

		let previews;
		if (mode.startsWith('double')) {
			previews = [
				Preview.split_screen.lazyLoadPreview(0),
				Preview.split_screen.lazyLoadPreview(1, DefaultCameraPresets[5]),
			];

		} else if (mode.startsWith('triple')) {
			previews = [
				Preview.split_screen.lazyLoadPreview(0),
				Preview.split_screen.lazyLoadPreview(1, DefaultCameraPresets[3]),
				Preview.split_screen.lazyLoadPreview(2, DefaultCameraPresets[5]),
			];

		} else if (mode == 'quad') {
			previews = [
				Preview.split_screen.lazyLoadPreview(1, DefaultCameraPresets[1]),
				Preview.split_screen.lazyLoadPreview(0),
				Preview.split_screen.lazyLoadPreview(2, DefaultCameraPresets[3]),
				Preview.split_screen.lazyLoadPreview(3, DefaultCameraPresets[5]),
			];
		}
		previews.forEach((preview, i) => {
			let wrapper = Interface.createElement('div', {class: `split_screen_wrapper split_screen_wrapper_${i}`}, preview.node);
			wrapper.style.gridArea = `preview_${i}`
			Interface.preview.append(wrapper);

			preview.node.querySelectorAll('.quad_view_only').forEach(child => {
				child.style.display = 'block';
			})
			if (preview !== main_preview) {
				preview.node.querySelectorAll('.one_is_enough').forEach(child => {
					child.style.display = 'none';
				})
			}
		})
		Interface.preview.setAttribute('split_screen_mode', mode);
	
		updateInterface()
		ReferenceImage.updateAll();
	},
	updateSize() {
		Interface.preview.style.setProperty('--split-x', Math.roundTo(Interface.data.quad_view_x, 2) + '%');
		Interface.preview.style.setProperty('--split-y', Math.roundTo(Interface.data.quad_view_y, 2) + '%');
	}
}

Blockbench.on('update_camera_position', e => {
	let scale = Preview.selected.calculateControlScale(Transformer.position) || 0.8;
	Preview.all.forEach(preview => {
		if (preview.canvas.isConnected) {
			preview.raycaster.params.Points.threshold = scale * 0.8;
			preview.raycaster.params.Line.threshold = scale * 0.42;
		}
	})
})

function editCameraPreset(preset, presets) {
	let {name, projection, position, target, zoom} = preset;
	let rotation_mode = 'target';

	let dialog = new Dialog({
		id: 'edit_angle',
		title: 'menu.preview.angle.edit',
		form: {
			name: {label: 'generic.name', value: name},
			projection: {label: 'dialog.save_angle.projection', type: 'select', value: projection, options: {
				unset: 'generic.unset',
				perspective: 'dialog.save_angle.projection.perspective',
				orthographic: 'dialog.save_angle.projection.orthographic'
			}},
			divider1: '_',
			rotation_mode: {label: 'dialog.save_angle.rotation_mode', type: 'inline_select', value: rotation_mode, options: {
				target: 'dialog.save_angle.target',
				rotation: 'dialog.save_angle.rotation'
			}},
			position: {label: 'dialog.save_angle.position', type: 'vector', dimensions: 3, value: position},
			target: {label: 'dialog.save_angle.target', type: 'vector', dimensions: 3, value: target, condition: ({rotation_mode}) => rotation_mode == 'target'},
			rotation: {label: 'dialog.save_angle.rotation', type: 'vector', dimensions: 2, condition: ({rotation_mode}) => rotation_mode == 'rotation'},
			zoom: {label: 'dialog.save_angle.zoom', type: 'number', value: zoom||1, condition: result => (result.projection == 'orthographic')},
		},
		onFormChange(form) {
			if (form.rotation_mode !== rotation_mode) {
				rotation_mode = form.rotation_mode;
				if (form.rotation_mode == 'rotation') {
					this.setFormValues({rotation: cameraTargetToRotation(form.position, form.target)});
				} else {
					this.setFormValues({target: cameraRotationToTarget(form.position, form.rotation)});
				}
			}
		},
		onConfirm: function(result) {

			if (!result.name) return;

			preset.name = result.name;
			preset.projection = result.projection;
			preset.position = result.position;
			preset.target = result.rotation_mode == 'rotation'
					? cameraRotationToTarget(result.position, result.rotation)
					: result.target;
			if (result.projection == 'orthographic') preset.zoom = result.zoom;

			localStorage.setItem('camera_presets', JSON.stringify(presets))
			dialog.hide()
		}
	})
	dialog.show();
}


class OrbitGizmo {
	constructor(preview, options = {}) {
		let scope = this;
		this.preview = preview;
		this.node = document.createElement('div');
		this.node.classList.add('orbit_gizmo');

		let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		this.node.append(svg);
		this.lines = {
			x: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
			y: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
			z: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
		}
		for (let axis in this.lines) {
			this.lines[axis].setAttribute('axis', axis);
			svg.append(this.lines[axis]);
		}

		this.sides = {
			top: {opposite: 'bottom', axis: 'y', sign: 1, label: 'Y'},
			bottom: {opposite: 'top', axis: 'y', sign: -1},
			east: {opposite: 'west', axis: 'x', sign: 1, label: 'X'},
			west: {opposite: 'east', axis: 'x', sign: -1},
			south: {opposite: 'north', axis: 'z', sign: 1, label: 'Z'},
			north: {opposite: 'south', axis: 'z', sign: -1},
		}
		for (let key in this.sides) {
			let side = this.sides[key];
			side.node = document.createElement('div');
			side.node.classList.add('orbit_gizmo_side');
			side.node.setAttribute('axis', side.axis);
			side.node.title = tl(`direction.${key}`);
			if (side.label) side.node.innerText = side.label;

			side.node.addEventListener('click', e => {
				if (!this.preview.controls.enabled) return;
				let preset_key = key == this.preview.angle ? side.opposite : key;
				let preset = DefaultCameraPresets.find(p => p.id == preset_key);
				this.preview.loadAnglePreset(preset);
			})
			this.node.append(side.node);
		}

		// Interact
		addEventListeners(this.node, 'mousedown touchstart', e1 => {
			if ((!scope.preview.controls.enableRotate && scope.preview.angle == null) || !scope.preview.controls.enabled || (scope.preview.force_locked_angle && scope.preview.locked_angle !== null)) return;
			convertTouchEvent(e1);
			let last_event = e1;
			let move_calls = 0;

			let started = false;
			function start() {
				started = true;
				scope.node.classList.add('mouse_active');
				if (!e1.touches && last_event == e1 && scope.node.requestPointerLock) scope.node.requestPointerLock();
				if (scope.preview.angle != null) {
					scope.preview.setProjectionMode(false, true);
				}
			}

			function move(e2) {
				convertTouchEvent(e2);
				if (!started && Math.pow(e2.clientX - e1.clientX, 2) + Math.pow(e2.clientY - e1.clientY, 2) > 12) {
					start()
				}
				if (started) {
					let limit = move_calls <= 2 ? 1 : 32;
					scope.preview.controls.rotateLeft((e1.touches ? (e2.clientX - last_event.clientX) : Math.clamp(e2.movementX, -limit, limit)) / 40);
					scope.preview.controls.rotateUp((e1.touches ? (e2.clientY - last_event.clientY) : Math.clamp(e2.movementY, -limit, limit)) / 40);
					last_event = e2;
					move_calls++;
				}
			}
			function off(e2) {
				if (document.exitPointerLock) document.exitPointerLock()
				removeEventListeners(document, 'mousemove touchmove', move);
				removeEventListeners(document, 'mouseup touchend', off);
				scope.node.classList.remove('mouse_active');
			}
			addEventListeners(document, 'mouseup touchend', off);
			addEventListeners(document, 'mousemove touchmove', move);
		})
		this.node.addEventListener('dblclick', e => {
			if (e.target != this.node) return;
			this.preview.setProjectionMode(!this.preview.isOrtho, true);
		})

		this.preview.controls.onUpdate(e => this.update(e));

		this.update();
	}
	update() {
		let background = 'background';
		let x = this.preview.controls.getPolarAngle();
		let y = this.preview.controls.getAzimuthalAngle();
		let mid = 40;
		let rad = 28;
		let scale = 0.16;
		let offset = {
			x: [Math.cos(y), Math.cos(x)*Math.sin(y), Math.sin(y)],
			y: [0, -Math.sin(x), Math.cos(x)],
			z: [-Math.sin(y), Math.cos(x)*Math.cos(y), Math.cos(y)],
		}

		for (let key in this.sides) {
			let side = this.sides[key];
			let vec = offset[side.axis];
			side.node.style.left = `${mid + side.sign * rad * vec[0]}px`;
			side.node.style.top = `${mid + side.sign * rad * vec[1]}px`;
			side.node.style.setProperty('transform', `scale(${1 + scale * side.sign * vec[2]})`);
			side.node.classList.toggle(background, vec[2] * side.sign < 0);
		}

		for (let axis in this.lines) {
			let vec = offset[axis];
			this.lines[axis].setAttribute('d', `M${mid} ${mid} L${mid + rad*vec[0]} ${mid + rad*vec[1]}`)
		}
	}
	hide() {
		this.node.style.display = 'none';
	}
	unhide() {
		this.node.style.display = 'block';
	}
}


window.addEventListener("gamepadconnected", function(event) {
	if (event.gamepad.id.includes('SpaceMouse') || event.gamepad.id.includes('SpaceNavigator') || event.gamepad.id.includes('3Dconnexion')) {

		let interval = setInterval(() => {
			let gamepad = navigator.getGamepads()[event.gamepad.index];
			let preview = Preview.selected;
			if (!document.hasFocus() || !preview || !gamepad || !gamepad.axes || gamepad.axes.allEqual(0) || gamepad.axes.find(v => isNaN(v)) != undefined) return;

			let offset = new THREE.Vector3(
				gamepad.axes[0],
				-gamepad.axes[2],
				gamepad.axes[1],
			)
			offset.multiplyScalar(3);
			offset.applyQuaternion(preview.camera.quaternion);

			preview.controls.target.add(offset);
			preview.camera.position.add(offset);

			let camera_diff = new THREE.Vector3().copy(preview.controls.target).sub(preview.camera.position);
			let axes = [
				gamepad.axes[3] / -40,
				gamepad.axes[5] / -40,
			];
			camera_diff.applyAxisAngle(THREE.NormalY, axes[1]);
			let tilt_axis = new THREE.Vector3().copy(camera_diff).normalize();
			tilt_axis.applyAxisAngle(THREE.NormalY, Math.PI/2);
			tilt_axis.y = 0;
			camera_diff.applyAxisAngle(tilt_axis, axes[0]);

			preview.controls.target.copy(camera_diff).add(preview.camera.position);

			main_preview.controls.updateSceneScale();

		}, 16)

		window.addEventListener("gamepadconnected", function(event2) {
			if (event2.gamepad.id == event.gamepad.id && event2.gamepad.index == event.gamepad.index) {
				clearInterval(interval);
			}
		})
	}
});


//Init/Update
function initCanvas() {
	
	//Objects
	scene = Canvas.scene = new THREE.Scene();
	display_area = new THREE.Object3D();
	display_base = new THREE.Object3D();

	display_area.add(display_base)

	scene.name = 'scene'
	display_base.name = 'display_base'
	display_area.name = 'display_area'

	Canvas.outlines = new THREE.Object3D();
	Canvas.outlines.name = 'outline_group'
	scene.add(Canvas.outlines)
	Canvas.gizmos.push(Canvas.outlines)

	canvas_scenes = {
		/*monitor: new ReferenceImage({
			condition: () => Modes.display && display_slot == 'gui',
			name: tl('display.reference.monitor')
		}).addAsBuiltIn(),*/

		inventory_nine: new ReferenceImage({
			condition: () => Modes.display && displayReferenceObjects.active?.id == 'inventory_nine',
			name: tl('display.reference.inventory_nine'),
			source: './assets/inventory_nine.png',
			position: [0, 0],
			size: [528, 528],
			attached_side: 'south',
			layer: 'blueprint'
		}).addAsBuiltIn(),

		inventory_full: new ReferenceImage({
			condition: () => Modes.display && displayReferenceObjects.active?.id == 'inventory_full',
			name: tl('display.reference.inventory_full'),
			source: './assets/inventory_full.png',
			position: [0, -215.6],
			size: [1390, 1310],
			attached_side: 'south',
			layer: 'blueprint'
		}).addAsBuiltIn(),

		hud: new ReferenceImage({
			condition: () => Modes.display && displayReferenceObjects.active?.id == 'hud',
			name: tl('display.reference.hud'),
			source: './assets/hud.png',
			position: [-112, -70],
			size: [1695, 308],
			attached_side: 'south',
			layer: 'blueprint'
		}).addAsBuiltIn(),
	}

	MediaPreview = new Preview({id: 'media', offscreen: true});
	Screencam.NoAAPreview = new Preview({id: 'no_aa_media', offscreen: true, antialias: false});

	main_preview = new Preview({id: 'main'}).fullscreen()

	//TransformControls
	Transformer = new THREE.TransformControls(main_preview.camPers, main_preview.canvas)
	Transformer.setSize(0.5)
	scene.add(Transformer)
	Canvas.gizmos.push(Transformer);
	main_preview.occupyTransformer()


	Canvas.setup();
	CustomTheme.updateColors();
	resizeWindow();
}
function animate() {
	requestAnimationFrame( animate );
	if (!settings.background_rendering.value && !document.hasFocus() && !document.querySelector('#preview:hover')) return;
	TickUpdates.Run();

	if (Animator.open) {
		if (Timeline.playing) {
			Timeline.loop();
		} else if (AnimationController.selected) {
			AnimationController.selected.updatePreview();
		}
	}
	if (Preview.selected) {
		WinterskyScene.updateFacingRotation(Preview.selected.camera);
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
	Blockbench.dispatchEvent('render_frame');
}

function updateShading() {
	Canvas.updateLayeredTextures();
	scene.remove(lights)
	Sun.intensity = settings.brightness.value/50;
	if (settings.shading.value === true) {
		Sun.intensity *= 0.5;
		let parent = scene;
		parent.add(lights);
		lights.position.copy(parent.position).multiplyScalar(-1);
	}
	Texture.all.forEach(tex => {
		let material = tex.getMaterial();
		material.uniforms.SHADE.value = settings.shading.value;
		material.uniforms.LIGHTCOLOR.value.copy(Canvas.global_light_color).multiplyScalar(settings.brightness.value / 50);
		material.uniforms.LIGHTSIDE.value = Canvas.global_light_side;
	})
	Canvas.emptyMaterials.forEach(material => {
		material.uniforms.SHADE.value = settings.shading.value;
		material.uniforms.BRIGHTNESS.value = settings.brightness.value / 50;
	})
	Canvas.solidMaterial.uniforms.SHADE.value = settings.shading.value;
	Canvas.solidMaterial.uniforms.BRIGHTNESS.value = settings.brightness.value / 50;
	Canvas.uvHelperMaterial.uniforms.SHADE.value = settings.shading.value;
	Canvas.normalHelperMaterial.uniforms.SHADE.value = settings.shading.value;
	Blockbench.dispatchEvent('update_scene_shading');
}
function updateCubeHighlights(hover_cube, force_off) {
	Outliner.elements.forEach(element => {
		if (element.visibility && element.mesh.geometry && element.preview_controller.updateHighlight) {
			element.preview_controller.updateHighlight(element, hover_cube, force_off);
		}
	})
}

BARS.defineActions(function() {
	new BarSelect('view_mode', {
		category: 'view',
		keybind: new Keybind({key: 'z'}),
		condition: () => Project && Toolbox && Toolbox.selected && (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.length > 1),
		value: 'textured',
		icon_mode: true,
		options: {
			textured: {name: true, icon: 'image', condition: () => (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('textured'))},
			solid: {name: true, icon: 'fas.fa-square', condition: () => (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('solid'))},
			wireframe: {name: true, icon: 'far.fa-square', condition: () => (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('wireframe'))},
			uv: {name: true, icon: 'padding', condition: () => (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('uv'))},
			normal: {name: true, icon: 'fa-square-caret-up', condition: () => ((!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('normal')) && Mesh.all.length)},
		},
		onChange() {
			Project.view_mode = this.value;
			Canvas.updateAllFaces();
			if (Modes.id === 'animate') {
				Animator.preview();
			}
			Preview.all.forEach(preview => {
				if (!preview.offscreen) {
					let icon = Blockbench.getIconNode(this.options[this.value].icon);
					let icon_node = preview.node.querySelector('.preview_view_mode_menu > i');
					if (icon_node) icon_node.replaceWith(icon);
				}
			})
			//Blockbench.showQuickMessage(tl('action.view_mode') + ': ' + tl('action.view_mode.' + this.value));
		}
	})
	new Toggle('preview_checkerboard', {
		icon: 'fas.fa-chess-board',
		category: 'view',
		linked_setting: 'preview_checkerboard',
		keybind: new Keybind({key: 't'})
	})
	new Toggle('uv_checkerboard', {
		icon: 'fas.fa-chess-board',
		category: 'view',
		linked_setting: 'uv_checkerboard'
	})
	new Toggle('toggle_shading', {
		name: tl('settings.shading'),
		description: tl('settings.shading.desc'),
		icon: 'wb_sunny',
		category: 'view',
		linked_setting: 'shading'
	})
	Preview.all.forEach(preview => {
		if (preview.offscreen) return;
		let node = BarItems.toggle_shading.getNode(true);
		node.classList.add('one_is_enough')
		preview.node.querySelector('.preview_menu .shading_placeholder').replaceWith(node);
	})
	new Toggle('toggle_all_grids', {
		name: tl('settings.grids'),
		description: tl('settings.grids.desc'),
		icon: 'grid',
		category: 'view',
		linked_setting: 'grids',
		condition: () => !Modes.paint
	})
	new Toggle('toggle_ground_plane', {
		name: tl('settings.ground_plane'),
		description: tl('settings.ground_plane.desc'),
		icon: 'icon-format_free',
		category: 'view',
		linked_setting: 'ground_plane'
	})
	new Toggle('toggle_motion_trails', {
		name: tl('settings.motion_trails'),
		description: tl('settings.motion_trails.desc'),
		icon: 'gesture',
		category: 'view',
		linked_setting: 'motion_trails',
		condition: {modes: ['animate']}
	})

	function getRotatedIcon(key, angle) {
		let icon_node = Blockbench.getIconNode(key);
		icon_node.style.transform = `rotate(${angle}deg)`;
		return icon_node;
	}
	new BarSelect('split_screen', {
		icon: 'grid_view',
		category: 'view',
		condition: () => !Modes.display && !Format.image_editor,
		value: 'single',
		icon_mode: true,
		options: {
			single: {name: true, icon: 'video_label'},
			double_horizontal: {name: true, icon: 'splitscreen'},
			double_vertical: {name: true, icon: getRotatedIcon('splitscreen', 90)},
			quad: {name: true, icon: 'grid_view', condition: !Blockbench.isMobile},
			triple_left: {name: true, icon: 'space_dashboard', condition: !Blockbench.isMobile},
			triple_right: {name: true, icon: getRotatedIcon('space_dashboard', 180), condition: !Blockbench.isMobile},
			triple_top: {name: true, icon: getRotatedIcon('space_dashboard', 90), condition: !Blockbench.isMobile},
			triple_bottom: {name: true, icon: getRotatedIcon('space_dashboard', 270), condition: !Blockbench.isMobile},
		},
		onChange() {
			Preview.split_screen.setMode(this.value);
		}
	})
	new Action('focus_on_selection', {
		icon: 'center_focus_weak',
		category: 'view',
		condition: () => !Format.image_editor,
		keybind: new Keybind({shift: null}),
		click(event = 0) {
			if (!Project) return;
			if (Prop.active_panel == 'uv') {
				UVEditor.focusOnSelection()

			} else {
				let preview = Preview.selected;
				if (!preview.controls.enabled) return;
				let center = new THREE.Vector3();
				if (!Modes.display) {
					center.fromArray(getSelectionCenter());
					center.add(scene.position);
				} else {
					Transformer.getWorldPosition(center)
				}

				let difference = new THREE.Vector3().copy(preview.controls.target).sub(center);
				difference.divideScalar(6)

				let i = 0;
				let interval = setInterval(() => {
					preview.controls.target.sub(difference);

					if (!event.shiftKey || preview.angle != null) {
						preview.camera.position.sub(difference);
					}
					i++;
					if (i == 6) clearInterval(interval);

				}, 16.66)
			}
		}
	})

	new Action('toggle_camera_projection', {
		icon: 'switch_video',
		category: 'view',
		condition: _ => (!ReferenceImageMode.active || !Modes.display),
		keybind: new Keybind({key: 101}),
		click: function () {
			Preview.selected.setProjectionMode(!Preview.selected.isOrtho, true);
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
			Preview.selected.loadAnglePreset(DefaultCameraPresets[0])
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
			Preview.selected.loadAnglePreset(DefaultCameraPresets[1])
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
			Preview.selected.loadAnglePreset(DefaultCameraPresets[2])
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
			Preview.selected.loadAnglePreset(DefaultCameraPresets[3])
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
			Preview.selected.loadAnglePreset(DefaultCameraPresets[4])
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
			Preview.selected.loadAnglePreset(DefaultCameraPresets[5])
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
			Preview.selected.loadAnglePreset(DefaultCameraPresets[6])
		}
	})
})
