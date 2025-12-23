import { THREE } from '../lib/libs';
import OrbitControls from './OrbitControls';
import StateMemory from "../util/state_memory";
import { ConfigDialog } from '../interface/dialog';
import { toSnakeCase } from '../util/util';
import { electron, ipcRenderer } from '../native_apis';
import { Pressing } from '../misc';

window.scene = null;
window.main_preview = null;
window.MediaPreview = null;
window.Sun = null;
window.lights = null;
window.display_area = null;
window.display_base = null;

var framespersecond = 0;
const canvas_scenes = {};
export const three_grid = new THREE.Object3D();
export const gizmo_colors = {
	r: new THREE.Color(),
	g: new THREE.Color(),
	b: new THREE.Color(),
	grid: new THREE.Color(),
	solid: new THREE.Color(),
	outline: new THREE.Color(),
	gizmo_hover: new THREE.Color(),
	spline_handle_aligned: new THREE.Color(),
	spline_handle_mirrored: new THREE.Color(),
	spline_handle_free: new THREE.Color(),
	// used by spline sliders, to make it clear that they 
	// operate in a different space than the scene XYZ
	u: new THREE.Color(),
	v: new THREE.Color(),
	w: new THREE.Color(),
}
export const DefaultCameraPresets = [
	{
		name: 'menu.preview.angle.initial',
		id: 'initial',
		projection: 'perspective',
		get position() {
			let base;
			switch (Format.forward_direction) {
				case '+x': base = [40, 32, -40]; break;
				case '-x': base = [-40, 32, 40]; break;
				case '+z': base = [40, 32, 40]; break;
				case '-z': default: base = [-40, 32, -40]; break;
			}
			if (!Format) return base;
			return base.map(v => v * (Format.block_size / 16));
		},
		get target() {
			let block_size = Format.block_size ?? 16;
			return [0, block_size * 0.75, 0]
		},
		default: true
	},
	{
		name: 'direction.top',
		id: 'top',
		projection: 'orthographic',
		color: 'y',
		position: [0, 512, 0],
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
		position: [0, -512, 0],
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
		position: [0, 0, 512],
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
		position: [0, 0, -512],
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
		position: [512, 0, 0],
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
		position: [-512, 0, 0],
		target: [0, 0, 0],
		zoom: 0.5,
		locked_angle: 'west',
		default: true
	},
	{
		name: 'camera_angle.common_isometric_right',
		id: 'isometric_right',
		projection: 'orthographic',
		position: [-512, 512*0.8165+8, -512],
		target: [0, 8, 0],
		zoom: 0.5,
		default: true
	},
	{
		name: 'camera_angle.common_isometric_left',
		id: 'isometric_left',
		projection: 'orthographic',
		position: [512, 512*0.8165+8, -512],
		target: [0, 8, 0],
		zoom: 0.5,
		default: true
	},
	{
		name: 'camera_angle.true_isometric_right',
		id: 'true_isometric_right',
		projection: 'orthographic',
		position: [-512, 512+8, -512],
		target: [0, 8, 0],
		zoom: 0.5,
		default: true
	},
	{
		name: 'camera_angle.true_isometric_left',
		id: 'true_isometric_left',
		projection: 'orthographic',
		position: [512, 512+8, -512],
		target: [0, 8, 0],
		zoom: 0.5,
		default: true
	}
]

export class Preview {
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
				<div class="tool preview_view_options one_is_enough"><i class="material-icons">discover_tune</i></div>
				<div class="tool preview_main_menu"><i class="material-icons">menu</i></div>
			</div>`)[0];
		/*menu.querySelector('.preview_reference_menu').onclick = (event) => {
			BarItems.edit_reference_images.trigger();
		}*/
		menu.querySelector('.preview_main_menu').onclick = (event) => {
			this.menu.open(menu, this);
		}
		menu.querySelector('.preview_view_options').onclick = (event) => {
			ViewOptionsDialog.show(menu);
			let preview_rect = Interface.preview.getBoundingClientRect();
			ViewOptionsDialog.object.style.left = 'auto';
			ViewOptionsDialog.object.style.right = (window.innerWidth-preview_rect.right) + 'px';
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
			name: tl('dialog.preview_options.title'),
			node: menu.querySelector('.preview_view_options')
		})
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
		this.controls = new OrbitControls(this.camPers, this);
		this.controls.minDistance = 1;
		this.controls.maxDistance = 3960;
		this.controls.enableKeys = false;
		this.controls.zoomSpeed = settings.viewport_zoom_speed.value / 100 * 1.5;
		this.controls.rotateSpeed = settings.viewport_rotate_speed.value / 100;
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
			error_element.innerHTML = `Error creating WebGL context. Try to update your ${isApp ? 'graphics drivers' : 'web browser'}.`

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
				
				var {BrowserWindow} = electron;
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
		this.updateToneMapping();

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
		addEventListeners(this.canvas, 'mousemove touchmove',	event => { this.mousemove(event)}, false)
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
			if (window.Transformer) {
				Transformer.update()
			}
		}
		return this;
	}
	updateToneMapping() {
		switch (settings.tone_mapping.value) {
			case 'none': this.renderer.toneMapping = THREE.NoToneMapping; break;
			case 'linear': this.renderer.toneMapping = THREE.LinearToneMapping; break;
			case 'reinhard': this.renderer.toneMapping = THREE.ReinhardToneMapping; break;
			case 'cineon': this.renderer.toneMapping = THREE.CineonToneMapping; break;
			case 'aces_filmic': this.renderer.toneMapping = THREE.ACESFilmicToneMapping; break;
			case 'agx': this.renderer.toneMapping = THREE.AgXToneMapping; break;
			case 'neutral': this.renderer.toneMapping = THREE.NeutralToneMapping; break;
		}
	}
	raycast(event, options = Toolbox.selected.raycast_options) {
		if (!options) options = 0;
		convertTouchEvent(event);
		var canvas_offset = $(this.canvas).offset()
		this.mouse.x = ((event.clientX - canvas_offset.left) / this.width) * 2 - 1;
		this.mouse.y = - ((event.clientY - canvas_offset.top) / this.height) * 2 + 1;
		this.raycaster.setFromCamera( this.mouse, this.camera );

		var objects = []
		Outliner.elements.forEach(element => {
			if (element.visibility === false || element.locked === true || (element.mesh && element.mesh.visible == false)) return;
			if (element.mesh && element.mesh.geometry) {
				objects.push(element.mesh);
				if (Modes.edit && element.selected) {
					if (element.mesh.vertex_points && (element.mesh.vertex_points.visible || options.vertices)) {
						objects.push(element.mesh.vertex_points);
					}
					if (element instanceof Mesh && ((element.mesh.outline.visible && BarItems.selection_mode.value == 'edge') || options.edges)) {
						objects.push(element.mesh.outline);
					}
				} else if (element instanceof SplineMesh && element.render_mode !== "mesh") {
					objects.push(element.mesh.pathLine);
				}
			} else if (element instanceof Locator) {
				objects.push(element.mesh.sprite);
			} else if (element instanceof ArmatureBone) {
				if (Toolbox.selected.id == 'weight_brush' && !(event.altKey || Pressing.overrides.alt)) return;
				objects.push(element.mesh.children[0]);
			}
		})
		for (let group of Group.multi_selected) {
			if (group.mesh.vertex_points) objects.push(group.mesh.vertex_points);
		}
		if (Animator.open && settings.motion_trails.value && Group.first_selected) {
			Animator.motion_trail.children.forEach(object => {
				if (object.isKeyframe === true) {
					objects.push(object)
				}
			})
		}
		let intersects = this.raycaster.intersectObjects(objects, false);
		if (intersects.length == 0) return false;

		let depth_offset = Preview.selected.calculateControlScale(intersects[0].point);
		for (let intersect of intersects) {
			if (intersect.object.isLine) {
				intersect.distance -= depth_offset;
			} else if (intersect.object.isPoints) {
				intersect.distance -= depth_offset * 1.4;
			}
		}
		if (Toolbox.selected.id == 'vertex_snap_tool') {
			intersects.sort((a, b) => {
				if (a.object.isPoints != b.object.isPoints) return a.object.isPoints ? -100 : 100;
				return a.distance - b.distance;
			});
		} else {
			intersects.sort((a, b) => {
				if (a.object.renderOrder > 10 || b.object.renderOrder > 10) {
					return b.object.renderOrder - a.object.renderOrder;
				}
				return a.distance - b.distance;
			});
		}
		if ((settings.seethrough_outline.value && BarItems.selection_mode.value == 'edge')) {
			let all_intersects = intersects;
			intersects = intersects.filter(a => a.object.isLine);
			if (intersects.length == 0) intersects = all_intersects;
		}

		let intersect = intersects[0];
		let intersect_object = intersect.object;

		if (intersect_object.isElement) {
			let element, face;
			while (true) {
				element = OutlinerNode.uuids[intersect_object.name];
				if (element.getTypeBehavior('cube_faces')) {
					if (element.getTypeBehavior('select_faces')) {
						face = intersect_object.geometry.faces[Math.floor(intersects[0].faceIndex / 2)];
					} else {
						face = Object.keys(element.faces)[0];
					}
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
				} else if (element instanceof SplineMesh) {
					let index = intersects[0].faceIndex;
					for (let key in element.faces) {
						let {vertices} = element.faces[key];

						if (index == 0 || (index == 1 && vertices.length == 4)) {
							face = key;
							break; 
						}
						
						index -= 2;
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
			let vertices = [];
			if (!(element instanceof SplineMesh)) vertices = intersect_object.vertex_order.slice(intersect.index, intersect.index+2);
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
				zoom: {label: 'dialog.save_angle.zoom', type: 'number', value: Math.roundTo(scope.camOrtho.zoom || 1, 4), condition: result => scope.isOrtho},
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
				if (scope.isOrtho) preset.zoom = scope.camOrtho.zoom;

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
		let is_canvas_click = Keybinds.extra.preview_select.keybind.key == event.which || event.which === 0 || (Modes.paint && Keybinds.extra.paint_secondary_color.keybind.isTriggered(event));

		var data = is_canvas_click && this.raycast(event);
		if (data) {
			this.selection.click_target = data;

			let multi_select = Keybinds.extra.preview_select.keybind.additionalModifierTriggered(event, 'multi_select');
			let group_select = Keybinds.extra.preview_select.keybind.additionalModifierTriggered(event, 'group_select');
			let loop_select = Keybinds.extra.preview_select.keybind.additionalModifierTriggered(event, 'loop_select');

			if (Toolbox.selected.paintTool) {
				multi_select = group_select = loop_select = false;
			}

			function unselectOtherNodes() {
				Group.multi_selected.empty();
				Outliner.elements.forEach(el => {
					if (el !== data.element) Outliner.selected.remove(el);
				})
			}

			let select_mode = BarItems.selection_mode.value
			if (!Condition(BarItems.selection_mode.condition)) {
				select_mode = 'object';
			}
			if (select_mode != 'object') {
				multi_select = multi_select || group_select;
				group_select = false;
			}

			if (Toolbox.selected.selectElements && Modes.selected.selectElements && (data.type === 'element' || Toolbox.selected.id == 'knife_tool' || (data.type == 'line' && data.element instanceof SplineMesh))) {
				Undo.initSelection();
				if (Toolbox.selected.selectFace && data.face && data.element.type != 'mesh' && data.element.type != 'spline') {
					let face_selection = UVEditor.getSelectedFaces(data.element, true);
					if (data.element.selected && (multi_select || group_select)) {
						face_selection.safePush(data.face);
					} else {
						face_selection.replace([data.face]);
					}
				}
				Blockbench.dispatchEvent('canvas_select', data)
				if (Modes.paint && !(Toolbox.selected.id == 'fill_tool' && BarItems.fill_mode.value == 'selected_elements')) {
					event = 0;
				}
				if (data.element.parent instanceof OutlinerNode && (data.element instanceof Mesh == false || data.element instanceof SplineMesh == false || select_mode == 'object') && (
					(Animator.open && !data.element.constructor.animator) ||
					group_select ||
					(!Format.rotate_cubes && Format.bone_rig && ['rotate_tool', 'pivot_tool'].includes(Toolbox.selected.id))
				)) {
					let node_to_select = data.element.parent;
					if (data.element.parent.selected && (group_select)) {
						while (node_to_select.parent instanceof Group && node_to_select.selected) {
							node_to_select = node_to_select.parent;
						}
					}
					// Select clicked first so selected face is registered properly
					data.element.markAsSelected();

					if (multi_select) {
						node_to_select.multiSelect();
					} else {
						node_to_select.select(event);
					}
					if (settings.outliner_reveal_on_select.value) {
						node_to_select.showInOutliner();
					}

				} else if (!Animator.open) {

					if (data.element instanceof Mesh && select_mode == 'face') {
						if (!data.element.selected) data.element.select(event);

						if (!(multi_select || group_select)) {
							unselectOtherNodes()
						}

						let mesh = data.element;
						let selected_vertices = mesh.getSelectedVertices(true);
						let selected_edges = mesh.getSelectedEdges(true);
						let selected_faces = mesh.getSelectedFaces(true);

						if (loop_select) {
							
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

							if (!(multi_select || group_select)) {
								selected_vertices.empty();
								selected_edges.empty();
								selected_faces.empty();
							}

							processed_faces.forEach(face => {
								selected_vertices.safePush(...face.vertices);
								let fkey = face.getFaceKey();
								selected_faces.safePush(fkey);
							});
						} else {
							let face_vkeys = data.element.faces[data.face].vertices;
							
							if (multi_select || group_select) {
								if (selected_faces.includes(data.face)) {
									let selected_faces = data.element.getSelectedFaces();
									let vkeys_to_remove = face_vkeys.filter(vkey => {
										return !selected_faces.find(fkey => {
											return fkey !== data.face && data.element.faces[fkey].vertices.includes(vkey)
										})
									})
									if (vkeys_to_remove.length == 0) vkeys_to_remove.push(face_vkeys[0]);
									selected_vertices.remove(...vkeys_to_remove);
									selected_faces.remove(data.face);
								} else {
									selected_vertices.safePush(...face_vkeys);
									selected_faces.safePush(data.face);
								}
							} else {
								selected_edges.empty();
								selected_vertices.replace(face_vkeys);
								selected_faces.replace([data.face]);
							}
						}

					} else if (data.element instanceof Mesh && select_mode == 'cluster') {
						if (!data.element.selected) data.element.select(event);

						if (!(multi_select || group_select)) {
							unselectOtherNodes()
						}

						let mesh = data.element;
						let selected_vertices = mesh.getSelectedVertices(true);
						let selected_edges = mesh.getSelectedEdges(true);
						let selected_faces = mesh.getSelectedFaces(true);

						if (!(multi_select || group_select)) {
							selected_vertices.empty();
							selected_edges.empty();
							selected_faces.empty();
						}
							
						let start_face = mesh.faces[data.face];
						if (!start_face) return;
						function selectFace(face, fkey) {
							if (selected_faces.includes(fkey)) return;
							
							selected_faces.push(fkey);
							selected_vertices.safePush(...face.vertices);

							let faces = mesh.faces;
							for (let fkey2 in faces) {
								let face2 = faces[fkey2];
								if (face.vertices.find(vkey => face2.vertices.includes(vkey))) {
									selectFace(face2, fkey2);
								}
							}
						}
						selectFace(start_face, data.face);

					} else if (data.element instanceof Mesh && ['edge', 'vertex'].includes(select_mode)) {
						data.element.select()
					} else if (Toolbox.selected.id == 'fill_tool' && BarItems.fill_mode.value == 'selected_elements') {
						if (!data.element.selected) {
							data.element.select(event)
						}
					} else {
						data.element.select(event)
					}
					updateSelection();
				} else {
					data.element.select(event);
				}
				Undo.finishSelection('Select from viewport');

			} else if (Animator.open && data.type == 'keyframe') {
				if (data.keyframe instanceof Keyframe) {
					Undo.initSelection({timeline: true});
					data.keyframe.select(event).callPlayhead();
					updateSelection();
					Undo.finishSelection('Select keyframe');
				}

			} else if (data.type == 'vertex' && Toolbox.selected.id !== 'vertex_snap_tool') {
				Undo.initSelection();
				let list = data.element.getSelectedVertices(true);
				let edges;
				let faces;

				edges = data.element.getSelectedEdges(true);
				faces = data.element.getSelectedEdges(true);

				if (multi_select || group_select) {
					list.toggle(data.vertex);
				} else {
					unselectOtherNodes();
					list.replace([data.vertex]);

					edges.empty();
					faces.empty();
				}
				updateSelection();
				Undo.finishSelection('Select vertex');

			} else if (data.type == 'line') {

				Undo.initSelection();
				let vertices = data.element.getSelectedVertices(true);
				let edges = data.element.getSelectedEdges(true);
				let faces = data.element.getSelectedFaces(true);

				if (multi_select || group_select) {
					let index = edges.findIndex(edge => sameMeshEdge(edge, data.vertices))
					if (index >= 0) {
						vertices.remove(...data.vertices);
						edges.splice(index, 1);
					} else {
						edges.push(data.vertices);
						vertices.safePush(...data.vertices);
					}
				} else if (data.vertices) {
					faces.empty();
					edges.splice(0, Infinity, data.vertices);
					vertices.replace(data.vertices);
					unselectOtherNodes();
				}
				if (loop_select) {
					
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
				Undo.finishSelection('Select edge');
			}
			if (typeof Toolbox.selected.onCanvasClick === 'function') {
				Toolbox.selected.onCanvasClick(data)
				Blockbench.dispatchEvent('canvas_click', data)
			}

			if (Keybinds.extra.preview_area_select.keybind.isTriggered(event)) {
				this.startSelRect(event)
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
		let data = this.raycast(event);
		if (Settings.get('highlight_cubes')) {
			updateCubeHighlights(data && data.element);
		}

		brush_cursor:
		if (Toolbox.selected.brush?.size && Settings.get('brush_cursor_3d')) {
			if (!data) {
				scene.remove(Canvas.brush_outline);
				break brush_cursor;
			}
			if (!data.element.faces) break brush_cursor;
			if (data.element instanceof SplineMesh && data.element.render_mode !== "mesh") break brush_cursor;
			let face = data.element.faces[data.face];
			let texture = face.getTexture();
			if (!texture) {
				scene.remove(Canvas.brush_outline);
				break brush_cursor;
			}
			scene.add(Canvas.brush_outline);

			let intersect = data.intersects[0];
			let world_quaternion = intersect.object.getWorldQuaternion(Reusable.quat1)
			let world_normal = Reusable.vec1.copy(intersect.face.normal).applyQuaternion(world_quaternion);

			// UV
			let uv_factor_x = texture.getUVWidth() / texture.width;
			let uv_factor_y = texture.getUVHeight() / texture.display_height;
			let offset = 0;
			let x = intersect.uv.x * texture.width;
			let y = (1-intersect.uv.y) * texture.height;
			let truncated_x = x;
			let truncated_y = y;
			if (Condition(Toolbox.selected.brush.floor_coordinates)) {
				offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0 : 0.5;
				truncated_x = Math.round(x + offset) - offset;
				truncated_y = Math.round(y + offset) - offset;
			}
			if (texture.currentFrame) {
				y -= texture.display_height * texture.currentFrame;
				truncated_y -= texture.display_height * texture.currentFrame;
			}

			// Position
			let brush_matrix = face.texelToLocalMatrix([x * uv_factor_x, y * uv_factor_y], [uv_factor_x, uv_factor_y], [truncated_x * uv_factor_x, truncated_y * uv_factor_y]);
			let brush_coord = new THREE.Vector3().setFromMatrixPosition(brush_matrix);
			intersect.object.localToWorld(brush_coord);
			if (!Format.centered_grid) {
				brush_coord.x += 8;
				brush_coord.z += 8;
			}

			// Size
			let scale = new THREE.Vector3(BarItems.slider_brush_size.get(), BarItems.slider_brush_size.get(), 1);
			brush_matrix.scale(scale);

			brush_matrix.multiplyMatrices(intersect.object.matrixWorld, brush_matrix);

			// Z-fighting
			let z_fight_offset = Preview.selected.calculateControlScale(brush_coord) / 8;
			let camera_direction = Preview.selected.camera.getWorldDirection(Reusable.vec2);
			if (camera_direction.angleTo(world_normal) < Math.PI / 2) {
				world_normal.multiplyScalar(-1);
			}

			let z_offset = world_normal.clone().multiplyScalar(z_fight_offset);
			let matrix_offset = new THREE.Matrix4().makeTranslation(z_offset.x, z_offset.y, z_offset.z);
			brush_matrix.multiplyMatrices(matrix_offset, brush_matrix);

			// Since we're setting the brush matrix, we need to multiply in its parents matrix as well in case there are any.
			if (Canvas.brush_outline.parent) {
				brush_matrix.multiplyMatrices(Canvas.brush_outline.parent.matrixWorld.clone().invert(), brush_matrix);
			}
			Canvas.brush_outline.matrix = brush_matrix;
		}
		
		if (Toolbox.selected.onCanvasMouseMove) {
			if (!data) data = this.raycast(event);
			Toolbox.selected.onCanvasMouseMove(data);
		}
		if (Condition(BarItems.selection_mode.condition) && Mesh.hasAny() && data && data.element instanceof Mesh) {
			if (BarItems.selection_mode.value == 'edge' && data.type == 'line' && data.vertices) {
				let pos_1 = Reusable.vec1.fromArray(data.element.vertices[data.vertices[0]]);
				let pos_2 = Reusable.vec2.fromArray(data.element.vertices[data.vertices[1]]);
				data.element.mesh.localToWorld(pos_1);
				data.element.mesh.localToWorld(pos_2);

				let z_scalar = Preview.selected.calculateControlScale(pos_1) / 8;
				let z_offset = Preview.selected.camera.getWorldDirection(Reusable.vec3);
				z_offset.multiplyScalar(-z_scalar);
				pos_1.add(z_offset);
				pos_2.add(z_offset);

				let array = pos_1.toArray().concat(pos_2.toArray());
				Canvas.hover_helper_line.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(array), 3));
				Canvas.scene.add(Canvas.hover_helper_line);
			} else {
				if (Canvas.hover_helper_line.parent) Canvas.hover_helper_line.parent.remove(Canvas.hover_helper_line);
			}
			if (BarItems.selection_mode.value == 'vertex' && data.type == 'vertex') {
				let pos = Reusable.vec1.fromArray(data.element.vertices[data.vertex]);
				data.element.mesh.localToWorld(pos);

				let scale = Preview.selected.calculateControlScale(pos);
				let z_offset = Preview.selected.camera.getWorldDirection(Reusable.vec3);
				z_offset.multiplyScalar(-scale / 3);
				pos.add(z_offset);
				Canvas.hover_helper_vertex.position.copy(pos);

				Canvas.scene.add(Canvas.hover_helper_vertex);
			} else {
				if (Canvas.hover_helper_vertex.parent) Canvas.hover_helper_vertex.parent.remove(Canvas.hover_helper_vertex);
			}
		} else if (SplineMesh.hasAny() && data && data.element instanceof SplineMesh) { 
			// Highlight meshless splines
			if (data.type == 'line' && data.element.render_mode == "path") {
				let path = data.element.mesh.pathLine;
				let array = [];
				let pos_attr = path.geometry.getAttribute("position").array.slice();

				pos_attr.forEach((v, i) => {
					if ((i + 1) % 3 == 0) {
						let pos = [pos_attr[i - 2], pos_attr[i - 1], v].V3_toThree();
						data.element.mesh.localToWorld(pos);

						let z_scalar = Preview.selected.calculateControlScale(pos) / 8;
						let z_offset = Preview.selected.camera.getWorldDirection(Reusable.vec3);
						z_offset.multiplyScalar(-z_scalar);
						pos.add(z_offset);

						array.push(pos.x, pos.y, pos.z);
					}
				});

				Canvas.hover_helper_line.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(array), 3));
				Canvas.scene.add(Canvas.hover_helper_line);
			}
		} else {
			if (Canvas.hover_helper_line.parent) Canvas.hover_helper_line.parent.remove(Canvas.hover_helper_line);
			if (Canvas.hover_helper_vertex.parent) Canvas.hover_helper_vertex.parent.remove(Canvas.hover_helper_vertex);
		}
	}
	mouseup(event) {
		this.showContextMenu(event);
		if (settings.canvas_unselect.value &&
			(event.which === 1 || event.which === 3 || event instanceof TouchEvent) &&
			!this.controls.hasMoved &&
			!this.selection.activated &&
			!Transformer.was_clicked &&
			Toolbox.selected.selectElements != false &&
			!this.selection.click_target
		) {
			unselectAllElements();
		}
		delete this.selection.click_target;
		if (event instanceof TouchEvent) {
			Canvas.scene.remove(Canvas.brush_outline);
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
	vectorToScreenPosition(vector) {
		vector = vector.clone();
		let widthHalf = this.canvas.width / 2;
		let heightHalf = this.canvas.height / 2;

		vector.project(this.camera);
	
		vector.x = ( vector.x * widthHalf ) + widthHalf;
		vector.y = - ( vector.y * heightHalf ) + heightHalf;
		vector.divideScalar(window.devicePixelRatio);
	
		return { 
			x: vector.x,
			y: vector.y
		};
	}
	showContextMenu(event) {
		Prop.active_panel = 'preview';
		if (this.static_rclick && (event.which === 3 || (event.type == 'touchend' && this.rclick_cooldown == true))) {
			var data = this.raycast(event)
			if (data) this.selection.click_target = data;
			
			let click_result;
			if (typeof Toolbox.selected.onCanvasRightClick === 'function') {
				click_result = Toolbox.selected.onCanvasRightClick(data || {event});
			}
			if (click_result == false) {
			} else if (Toolbox.selected.selectElements && Modes.selected.selectElements && data && data.element && !Modes.animate) {
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
		if (Toolbox.selected.selectElements == false) return;
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
			this.selection.old_spline_selection = JSON.parse(JSON.stringify(Project.spline_selection));

			Undo.initSelection();
			this.moveSelRect(event);
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
		
		let rect_start = [c.ax, c.ay];
		let rect_end = [c.bx, c.by];
		let extend_selection = (event.shiftKey || Pressing.overrides.shift) ||
				((event.ctrlOrCmd || Pressing.overrides.ctrl) && !Keybinds.extra.preview_area_select.keybind.ctrl)
		let selection_mode = BarItems.selection_mode.value;
		let spline_selection_mode = BarItems.spline_selection_mode.value;

		let widthHalf = 0.5 * this.canvas.width / window.devicePixelRatio;
		let heightHalf = 0.5 * this.canvas.height / window.devicePixelRatio;

		function projectPoint(vector) {
			vector.project(scope.camera);
			return [
				 ( vector.x * widthHalf ) + widthHalf,
				-( vector.y * heightHalf ) + heightHalf
			]
		}

		unselectAllElements()
		Outliner.elements.forEach((element) => {
			let isSelected;
			let select_in_object_mode = (element instanceof Mesh == false || selection_mode == 'object') && (element instanceof SplineMesh == false || spline_selection_mode == "object");
			if (extend_selection && this.selection.old_selected.includes(element) && select_in_object_mode) {
				isSelected = true

			} else if (element.visibility != false && element.preview_controller?.viewportRectangleOverlap) {
				isSelected = element.preview_controller.viewportRectangleOverlap(element, {projectPoint, extend_selection, rect_start, rect_end, preview: this});
			}
			if (isSelected) {
				element.markAsSelected();
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
		Undo.finishSelection('Area select');
	}
	// Background
	loadBackground() {
		console.warn('Preview.loadBackground() is no longer supported')
	}
	updateBackground() {
		console.warn('Preview.updateBackground() is no longer supported')
	}
	//Misc
	copyView(preview) {
		this.setProjectionMode(preview.isOrtho);
		// Update camera
		this.controls.unlinked = preview.controls.unlinked;
		this.controls.target.copy(preview.controls.target);
		this.camera.position.copy(preview.camera.position);
		this.camera.quaternion.copy(preview.camera.quaternion);
		if (this.isOrtho) {
			this.camera.zoom = preview.camera.zoom;
			this.camera.top = preview.camera.top;
			this.camera.bottom = preview.camera.bottom;
			this.camera.right = preview.camera.right;
			this.camera.left = preview.camera.left;
			let ratio = this.width / this.height;
			let current_ratio = (this.camera.right - this.camera.left) / (this.camera.top - this.camera.bottom);
			this.camera.right *= ratio / current_ratio;
			this.camera.left *= ratio / current_ratio;
			this.camOrtho.updateProjectionMatrix();
		} else {
			this.setFOV(preview.camPers.fov);
		}
	}
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
	static selected = null;
}
	Preview.prototype.menu = new Menu([
		'screenshot_model',
		new MenuSeparator('references'),
		'add_reference_image',
		'reference_image_from_clipboard',
		'toggle_all_reference_images',
		'edit_reference_images',
		'preview_scene',
		{
			icon: 'icon-player',
			name: 'settings.display_skin',
			condition: () => ((Modes.display && displayReferenceObjects.active.id === 'player') || Project.bedrock_animation_mode == 'attachable_third'),
			click: function() {
			
				changeDisplaySkin()
			}
		},
		new MenuSeparator('controls'),
		'focus_on_selection',
		{icon: 'add_a_photo', name: 'menu.preview.save_angle', condition(preview) {return !ReferenceImageMode.active && !Modes.display}, click(preview) {
			preview.newAnglePreset()
		}},
		{id: 'angle', icon: 'videocam', name: 'menu.preview.angle', condition(preview) {return !ReferenceImageMode.active && !Modes.display}, children: function(preview) {
			let children = []
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
				let icon = typeof preset.locked_angle ? 'videocam' : (preset.locked_angle == preview.angle ? 'far.fa-dot-circle' : 'far.fa-circle'); 
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
	if (Blockbench.isTouch) scale *= 1.5;
	scale *= (settings.selection_tolerance.value / 10);
	Preview.all.forEach(preview => {
		if (preview.canvas.isConnected) {
			preview.raycaster.params.Points.threshold = scale * 0.8;
			preview.raycaster.params.Line.threshold = scale * 0.42;
		}
	})
})

StateMemory.init('viewport_background_color', 'string');
export const ViewOptionsDialog = new ConfigDialog('preview_view_options', {
	title: 'dialog.preview_options.title',
	width: 320,
	form: {
		background: {
			label: 'dialog.preview_options.background',
			type: 'select',
			options: {
				checkerboard: 'dialog.preview_options.background.checkerboard',
				solid: 'dialog.preview_options.background.solid',
				custom_color: 'dialog.preview_options.background.custom_color',
			}
		},
		custom_background_color: {
			type: 'color', label: 'dialog.preview_options.background.custom_color',
			condition: result => result.background == 'custom_color'
		},
		preview_scene: {
			label: 'action.preview_scene',
			type: 'select',
			options() {
				let result = {};
				for (let category in PreviewScene.menu_categories) {
					let options = PreviewScene.menu_categories[category];
					if (options._label) {
						let group_id = 'options_'+toSnakeCase(options._label);
						result[group_id] = new MenuSeparator(group_id, options._label);
					}
					for (let key in options) {
						if (key.startsWith('_')) continue;
						result[key] = options[key];
					}
				}
				return result;
			}
		},
		shading: { label: 'settings.shading', type: 'checkbox', style: 'toggle_switch' },
		grids: { label: 'settings.grids', type: 'checkbox', style: 'toggle_switch' },
		ground_plane: { label: 'settings.ground_plane', type: 'checkbox', style: 'toggle_switch' },
		pixel_grid: { label: 'settings.pixel_grid', condition: () => !Modes.paint, type: 'checkbox', style: 'toggle_switch' },
		painting_grid: { label: 'settings.painting_grid', condition: () => Modes.paint, type: 'checkbox', style: 'toggle_switch' },
		show_gizmos: { label: 'dialog.preview_options.show_gizmos', type: 'checkbox', style: 'toggle_switch', value: true },
	},
	onOpen() {
		let custom_color = StateMemory.get('viewport_background_color');
		this.form.setValues({
			background: custom_color ? 'custom_color' : (settings.preview_checkerboard.value ? 'checkerboard' : 'solid'),
			custom_background_color: custom_color,
			preview_scene: PreviewScene.active ? PreviewScene.active.id : 'none',
			shading: settings.shading.value,
			grids: settings.grids.value,
			ground_plane: settings.ground_plane.value,
			pixel_grid: settings.pixel_grid.value,
			painting_grid: settings.painting_grid.value,
			show_gizmos: Canvas.show_gizmos,
		});
	},
	onFormChange(result) {
		let preview_scene_id = PreviewScene.active ? PreviewScene.active.id : 'none';
		if (preview_scene_id != result.preview_scene) {
			if (result.preview_scene == 'none') {
				PreviewScene.active.unselect();
			} else {
				PreviewScene.scenes[result.preview_scene]?.select();
			}
		}
		if (result.background == 'checkerboard') {
			settings.preview_checkerboard.set(true);
		} else {
			settings.preview_checkerboard.set(false);
		}
		if (result.background == 'custom_color') {
			let hex = '#'+result.custom_background_color.toHex();
			document.body.style.setProperty('--custom-preview-background', hex);
			StateMemory.set('viewport_background_color', hex);
		} else {
			document.body.style.setProperty('--custom-preview-background', '');
			StateMemory.set('viewport_background_color', '');
		}
		if (settings.shading.value != result.shading) {
			settings.shading.set(result.shading);
		}
		if (settings.ground_plane.value != result.ground_plane) {
			settings.ground_plane.set(result.ground_plane);
		}
		if (settings.grids.value != result.grids) {
			settings.grids.set(result.grids);
		}
		if (settings.pixel_grid.value != result.pixel_grid) {
			settings.pixel_grid.set(result.pixel_grid);
		}
		if (settings.painting_grid.value != result.painting_grid) {
			settings.painting_grid.set(result.painting_grid);
		}
		if (Canvas.show_gizmos != result.show_gizmos) {
			Canvas.show_gizmos = result.show_gizmos;
			updateSelection();
		}
	}
});

export function editCameraPreset(preset, presets) {
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


export class OrbitGizmo {
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
				if (e.shiftKey) {
					let original_preset = preset;
					preset = structuredClone(preset);
					preset.position.V3_add(this.preview.camera.position);
					if (preset.position.allAre(v => Math.abs(v) < 1)) {
						preset.position = original_preset.position.slice();
					}
					delete preset.locked_angle;
				}
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
					Blockbench.dispatchEvent('update_camera_position', {preview: scope.preview})
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
	let is_space_mouse = event.gamepad.id.includes('SpaceMouse') || event.gamepad.id.includes('SpaceNavigator') || event.gamepad.id.includes('3Dconnexion');

	console.log('Gamepad Connected', event);

	let zoom_timer = 0;

	let interval = setInterval(() => {
		let gamepad = navigator.getGamepads()[event.gamepad.index];
		let preview = Preview.selected;
		if (!document.hasFocus() || !preview || !gamepad || !gamepad.axes || !gamepad.connected || gamepad.axes.allEqual(0) || gamepad.axes.find(v => isNaN(v)) != undefined) return;

		if (is_space_mouse) {
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
		} else {
			if (settings.gamepad_controls.value == false) return;
			
			let drift_threshold = 0.2;
			let axes = gamepad.axes.map(v => Math.abs(v) > drift_threshold ? v - drift_threshold * Math.sign(v) : 0);
			let camera_matrix = preview.camera.matrixWorld;
			let rotate_speed = settings.viewport_rotate_speed.value / 100;
			let zoom_speed = settings.viewport_zoom_speed.value / 100;

			if (axes[0]) preview.controls.rotateLeft(Math.signedPow(axes[0]) / 8 * rotate_speed);
			if (axes[1]) preview.controls.rotateUp(Math.signedPow(axes[1]) / 8 * rotate_speed);
			if (axes[2]) preview.controls.panLeft(Math.signedPow(axes[2]) * 1.5, camera_matrix);
			if (axes[3]) preview.controls.panUp(Math.signedPow(axes[3]) * 1.5, camera_matrix);

			let smooth_zoom = 1-Math.exp(-zoom_timer/10)
			if (gamepad.buttons[6]?.pressed) {
				preview.controls.dollyOut(1 + 0.03 * zoom_speed * smooth_zoom);
				zoom_timer++;
			} else if (gamepad.buttons[7]?.pressed) {
				preview.controls.dollyIn(1 + 0.03 * zoom_speed * smooth_zoom);
				zoom_timer++;
			} else {
				zoom_timer = 0;
			}
		}

	}, 16)

	window.addEventListener("gamepadconnected", function(event2) {
		if (event2.gamepad.id == event.gamepad.id && event2.gamepad.index == event.gamepad.index) {
			clearInterval(interval);
		}
	})
});

//Init/Update
export function initCanvas() {
	
	//Objects
	window.scene = Canvas.scene = new THREE.Scene();
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

		/*monitor: new ReferenceImage({
			condition: () => Modes.display && display_slot == 'gui',
			name: tl('display.reference.monitor')
		}).addAsBuiltIn(),*/

	canvas_scenes.inventory_nine = new ReferenceImage({
		condition: () => Modes.display && displayReferenceObjects.active?.id == 'inventory_nine',
		name: tl('display.reference.inventory_nine'),
		source: './assets/inventory_nine.png',
		position: [0, 0],
		size: [528, 528],
		attached_side: 'south',
		layer: 'background',
		is_blueprint: true
	}).addAsBuiltIn(),

	canvas_scenes.inventory_full = new ReferenceImage({
		condition: () => Modes.display && displayReferenceObjects.active?.id == 'inventory_full',
		name: tl('display.reference.inventory_full'),
		source: './assets/inventory_full.png',
		position: [0, -215.6],
		size: [1390, 1310],
		attached_side: 'south',
		layer: 'background',
		is_blueprint: true
	}).addAsBuiltIn(),

	canvas_scenes.hud = new ReferenceImage({
		condition: () => Modes.display && displayReferenceObjects.active?.id == 'hud',
		name: tl('display.reference.hud'),
		source: './assets/hud.png',
		position: [-112, -70],
		size: [1695, 308],
		attached_side: 'south',
		layer: 'background',
		is_blueprint: true
	}).addAsBuiltIn(),

	MediaPreview = new Preview({id: 'media', offscreen: true});
	Screencam.NoAAPreview = new Preview({id: 'no_aa_media', offscreen: true, antialias: false});

	main_preview = new Preview({id: 'main'}).fullscreen();

	//TransformControls
	window.Transformer = new THREE.TransformControls(main_preview.camPers, main_preview.canvas);
	window.SplineGizmos = new THREE.SplineGizmoController(main_preview.camPers, main_preview.canvas);
	Transformer.setSize(0.5);
	scene.add(Transformer);
	scene.add(SplineGizmos);
	Canvas.gizmos.push(Transformer);
	Canvas.gizmos.push(SplineGizmos);
	main_preview.occupyTransformer()


	Canvas.setup();
	CustomTheme.updateColors();
	resizeWindow();
}
let last_animation_timestamp = performance.now();
export function animate() {
	requestAnimationFrame( animate );
	if (!settings.background_rendering.value && !document.hasFocus() && !document.querySelector('#preview:hover')) return;
	if (performance.now() < last_animation_timestamp + 1000 / settings.fps_limit.value - 1) return;

	last_animation_timestamp = performance.now();

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
	if (Modes.display === true && Canvas.ground_animation === true && !Transformer.hoverAxis) {
		DisplayMode.groundAnimation()
	}
	Blockbench.dispatchEvent('render_frame');
}

export function updateShading() {
	Canvas.updateLayeredTextures();
	Canvas.scene.remove(lights);
	let settings_brightness = settings.brightness.value/50;
	Sun.intensity = settings_brightness;
	let view_mode = window.BarItems ? BarItems.view_mode?.value : 'textured';

	lights.add(Sun);
	if (view_mode == 'material') {

		let light = Canvas.material_light;
		if (!light) {
			Canvas.material_light = light = new THREE.DirectionalLight();
		}
		light.color.copy(Canvas.global_light_color);
		light.intensity = 0.7 * settings_brightness;

		Canvas.scene.add(light);
		switch (Canvas.global_light_side) {
			case 0: light.position.set(60, 100, 20); break;
			case 1: light.position.set(-10, 20, 100); break;
			case 2: light.position.set(10, 20, -100); break;
			case 3: light.position.set(100, 20, -10); break;
			case 4: light.position.set(-100, 20, 10); break;
			case 5: light.position.set(20, -100, 0); break;
		}

		scene.add(Sun);
		Sun.intensity *= 0.5;

		TextureGroup.all.forEach(tg => {
			if (tg.is_material) tg.updateMaterial();
		})

	} else {
		if (settings.shading.value === true) {
			Sun.intensity *= 0.5;
			let parent = scene;
			parent.add(lights);
			lights.position.copy(parent.position).multiplyScalar(-1);
		} else {
			Canvas.scene.add(Sun);
		}
		if (Canvas.material_light) {
			Canvas.scene.remove(Canvas.material_light);
		}
		Texture.all.forEach(tex => {
			let material = tex.getMaterial();
			if (!material.uniforms) return;
			material.uniforms.SHADE.value = settings.shading.value;
			material.uniforms.LIGHTCOLOR.value.copy(Canvas.global_light_color).multiplyScalar(settings.brightness.value / 50);
			material.uniforms.LIGHTSIDE.value = Canvas.global_light_side;
		})
		Canvas.emptyMaterials.forEach(material => {
			material.uniforms.SHADE.value = settings.shading.value;
			material.uniforms.BRIGHTNESS.value = settings.brightness.value / 50;
		})
		Canvas.coloredSolidMaterials.forEach(material => {
			material.uniforms.SHADE.value = settings.shading.value;
			material.uniforms.BRIGHTNESS.value = settings.brightness.value / 50;
		})
	}
	Canvas.monochromaticSolidMaterial.uniforms.SHADE.value = settings.shading.value;
	Canvas.monochromaticSolidMaterial.uniforms.BRIGHTNESS.value = settings.brightness.value / 50;
	Canvas.uvHelperMaterial.uniforms.SHADE.value = settings.shading.value;
	Canvas.normalHelperMaterial.uniforms.SHADE.value = settings.shading.value;
	Blockbench.dispatchEvent('update_scene_shading');
}
export function updateCubeHighlights(hover_cube, force_off) {
	Outliner.elements.forEach(element => {
		if (element.visibility && element.mesh.geometry && element.preview_controller.updateHighlight) {
			element.preview_controller.updateHighlight(element, hover_cube, force_off);
		}
	})
}

setInterval(function() {
	Prop.fps = framespersecond;
	framespersecond = 0;
}, 1000);

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
			colored_solid: {name: true, icon: 'fas.fa-square-plus', condition: () => (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('colored_solid'))},
			wireframe: {name: true, icon: 'far.fa-square', condition: () => (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('wireframe'))},
			uv: {name: true, icon: 'grid_guides', condition: () => (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('uv'))},
			normal: {name: true, icon: 'fa-square-caret-up', condition: () => ((!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('normal')))},
			vertex_weight: {name: true, icon: 'weight', condition: () => ArmatureBone.all.length && (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('vertex_weight'))},
			weighted_bone_colors: {name: true, icon: 'weight', condition: () => ArmatureBone.all.length && (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('weighted_bone_colors'))},
			material: {name: true, icon: 'pages', condition: () => ((!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('material')) && TextureGroup.all.find(tg => tg.is_material))},
		},
		onChange() {
			let previous_view_mode = Project.view_mode;
			Project.view_mode = this.value;
			Canvas.updateViewMode();
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
			if (Project.view_mode != previous_view_mode) {
				Blockbench.dispatchEvent('change_view_mode', {view_mode: Project.view_mode, previous_view_mode});
			}
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
	new Toggle('toggle_all_grids', {
		name: tl('settings.grids'),
		description: tl('settings.grids.desc'),
		icon: 'grid_on',
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
	new Toggle('pixel_grid', {
		icon: 'grid_on',
		category: 'view',
		condition: {modes: ['edit']},
		keybind: new Keybind({key: 'g'}),
		linked_setting: 'pixel_grid'
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
		keybind: new Keybind({}, {
			rotate_only: 'shift',
			zoom: 'ctrl'
		}),
		variations: {
			rotate_only: {name: 'action.focus_on_selection.rotate_only'},
			zoom: {name: 'action.focus_on_selection.zoom'}
		},
		click(event = 0) {
			if (!Project) return;
			let zoom = this.keybind.additionalModifierTriggered(event, 'zoom');
			if (Prop.active_panel == 'uv') {
				UVEditor.focusOnSelection(zoom)

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

				let zoom_offset;
				let difference = new THREE.Vector3().copy(preview.controls.target).sub(center);
				let cam_boom = center.clone().sub(preview.camera.position).add(difference);
				difference.divideScalar(6);

				if (zoom) {
					let bounds = Canvas.getSelectionBounds();
					let radius = Math.max(
						Math.abs(bounds.min.x-center.x), Math.abs(bounds.max.x-center.x),
						Math.abs(bounds.min.z-center.z), Math.abs(bounds.max.z-center.z),
					);
					let height = Math.max(Math.abs(bounds.min.y-center.y), Math.abs(bounds.max.y-center.y));
					if (Math.abs(height) != Infinity) {
						let focal_length = preview.camera.getFocalLength();
						let cam_distance = cam_boom.length();
						let target_distance = Math.max(radius, height) * (focal_length / 10);
						let zoom_factor = target_distance / cam_distance;
						zoom_offset = cam_boom.multiplyScalar((zoom_factor-1) / 6);
					}
				}

				let i = 0;
				let interval = setInterval(() => {
					preview.controls.target.sub(difference);

					if (this.keybind.additionalModifierTriggered(event) != 'rotate_only' || preview.angle != null) {
						preview.camera.position.sub(difference);
					}
					if (zoom_offset) {
						preview.camera.position.sub(zoom_offset);
					}
					Transformer.update();
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


Object.assign(window, {
	scene,
	Sun,
	display_area,
	display_base,
	three_grid,
	gizmo_colors,
	DefaultCameraPresets,
	Preview,
	ViewOptionsDialog,
	editCameraPreset,
	OrbitGizmo,
	initCanvas,
	updateShading,
	updateCubeHighlights,
});
