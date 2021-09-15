var scene,
	main_preview, MediaPreview,
	Sun, lights,
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
	solid: new THREE.Color(0xc1c1c1),
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
				<div class="tool preview_background_menu" hidden><img src="" width="36px"></div>
				<div class="tool preview_main_menu"><i class="material-icons">more_vert</i></div>
			</div>`)[0];
		menu.firstElementChild.onclick = (event) => {
			let M = new Menu(this.menu.structure.find(s => s.id == 'background').children(this));
			M.open(menu, this);
		}
		menu.lastElementChild.onclick = (event) => {
			this.menu.open(menu, this);
		}
		BarItem.prototype.addLabel(false, {
			name: tl('menu.preview.background'),
			node: menu.firstElementChild
		})
		BarItem.prototype.addLabel(false, {
			name: tl('data.preview'),
			node: menu.lastElementChild
		})
		this.node.appendChild(menu)
		//Cameras
		this.isOrtho = false
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

		this.camPers.position.fromArray(DefaultCameraPresets[0].position)
		this.controls.target.fromArray(DefaultCameraPresets[0].target);

		if (!Blockbench.isMobile) {
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
			box: $('<div id="selection_box" class="selection_rectangle"></div>'),
			frustum: new THREE.Frustum()
		}

		this.raycaster = new THREE.Raycaster();
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
		Outliner.elements.forEach(element => {
			if (element.mesh.geometry && element.visibility && !element.locked) {
				objects.push(element.mesh);
				if (Modes.edit && element.selected) {
					if (element.mesh.vertex_points && element.mesh.vertex_points.visible) {
						objects.push(element.mesh.vertex_points);
					}
					if (element instanceof Mesh && element.mesh.outline.visible && BarItems.selection_mode.value == 'line') {
						objects.push(element.mesh.outline);
					}
				}
			}
		})
		if (Vertexsnap.vertex_gizmos.children.length) {
			Vertexsnap.vertex_gizmos.children.forEach(function(s) {
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
			let mesh_gizmo = intersects.find(intersect => intersect.object.type == 'Points' || intersect.object.type == 'LineSegments');
			let intersect = mesh_gizmo || intersects[0];
			let intersect_object = intersect.object

			if (intersect_object.isElement) {
				var element = OutlinerNode.uuids[intersect_object.name]
				let face;
				if (element instanceof Cube) {
					face = Canvas.face_order[Math.floor(intersect.faceIndex / 2)];
				} else if (element instanceof Mesh) {
					let index = intersect.faceIndex;
					for (let key in element.faces) {
						let {vertices} = element.faces[key];

						if (index == 0 || (index == 1 && vertices.length == 4)) {
							face = key;
							break; 
						}
						if (vertices.length == 3) index -= 1;
						if (vertices.length == 4) index -= 2;
					}
				}

				return {
					type: 'element',
					event,
					intersects,
					face,
					element
				}
			} else if (intersect_object.type == 'Points') {
				var element = OutlinerNode.uuids[intersect_object.parent.parent.name];
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
			} else if (intersect_object.isVertex) {
				return {
					event,
					type: 'cube_vertex',
					intersects,
					element: intersect_object.element,
					vertex: intersect
				}
			} else if (intersect_object.isKeyframe) {
				let keyframe = Timeline.keyframes.find(kf => kf.uuid == intersect_object.keyframeUUID);
				return {
					event,
					type: 'keyframe',
					intersects,
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
		this.setLockedAngle();
		this.occupyTransformer();
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
			this.loadBackground();

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
		if (this.isOrtho && preset.zoom && !preset.locked_angle) {
			this.camera.zoom = preset.zoom;
			this.camera.updateProjectionMatrix()
		}
		if (!this.isOrtho) {
			// should be FOV and should be an option on saving
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
		if (open_menu) open_menu.hide();
		unselectInterface(event);
		convertTouchEvent(event);
		Preview.selected = this;
		this.static_rclick = event.which === 3 || event.type == 'touchstart';
		
		if (event.type == 'touchstart') {
			this.rclick_cooldown = setTimeout(() => {
				this.rclick_cooldown = true;
			}, 420)
			Transformer.dispatchPointerHover(event);
		}
		if (Transformer.hoverAxis !== null || (!Keybinds.extra.preview_select.keybind.isTriggered(event) && event.which !== 0)) return;

		var data = this.raycast(event);
		if (data) {
			this.selection.click_target = data;

			let select_mode = BarItems.selection_mode.value

			if (data.element && data.element.locked) {
				$('#preview').css('cursor', 'not-allowed')
				function resetCursor() {
					$('#preview').css('cursor', (Toolbox.selected.cursor ? Toolbox.selected.cursor : 'default'))
					removeEventListeners(document, 'mouseup touchend', resetCursor, false)
				}
				addEventListeners(document, 'mouseup touchend', resetCursor, false)

			} else if (Toolbox.selected.selectElements && Modes.selected.selectElements && data.type === 'element') {
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
				if (data.element.parent.type === 'group' && (
					Animator.open ||
					event.shiftKey || Pressing.overrides.shift ||
					(!Format.rotate_cubes && Format.bone_rig && ['rotate_tool', 'pivot_tool'].includes(Toolbox.selected.id))
				)) {
					data.element.parent.select().showInOutliner();

				} else if (!Animator.open) {

					if (data.element instanceof Mesh && select_mode == 'face') {
						if (!data.element.selected) data.element.select(event);

						let mesh = data.element;
						let selected_vertices = mesh.getSelectedVertices(true);

						if (event.altKey || Pressing.overrides.alt) {
							
							let mesh = data.element;
							let start_face = mesh.faces[data.face];
							if (!start_face) return;
							let processed_faces = [];
							function selectFace(face, index) {
								if (processed_faces.includes(face)) return;
								processed_faces.push(face);
								let next = face.getAdjacentFace(index);
								if (next) selectFace(next.face, next.index+2);

							}

							let face_test = start_face.getAdjacentFace(0);
							let index = (face_test && face_test.face.isSelected()) ? 1 : 0;
							selectFace(start_face, index);

							if (!(event.ctrlOrCmd || Pressing.overrides.ctrl || event.shiftKey || Pressing.overrides.shift)) {
								selected_vertices.empty();
								UVEditor.vue.selected_faces.empty();
							}

							processed_faces.forEach(face => {
								Project.selected_vertices[data.element.uuid].safePush(...face.vertices);
								let fkey = face.getFaceKey();
								UVEditor.vue.selected_faces.push(fkey);
							});
						} else {
							if (!(event.ctrlOrCmd || Pressing.overrides.ctrl || event.shiftKey || Pressing.overrides.shift)) {
								selected_vertices.empty();
								UVEditor.vue.selected_faces.empty();
							}
							Project.selected_vertices[data.element.uuid].safePush(...data.element.faces[data.face].vertices);
							UVEditor.vue.selected_faces.safePush(data.face);
						}

					} else {
						data.element.select(event)
					}
					updateSelection();
				}
			} else if (Animator.open && data.type == 'keyframe') {
				if (data.keyframe instanceof Keyframe) {
					data.keyframe.select(event).callPlayhead();
					updateSelection();
				}

			} else if (data.type == 'vertex') {

				if (!Project.selected_vertices[data.element.uuid]) {
					Project.selected_vertices[data.element.uuid] = [];
				}
				let list = Project.selected_vertices[data.element.uuid];

				if (event.ctrlOrCmd || Pressing.overrides.ctrl || event.shiftKey || Pressing.overrides.shift) {
					list.toggle(data.vertex);
				} else {
					list.replace([data.vertex]);
				}
				updateSelection();
			} else if (data.type == 'line') {

				if (!Project.selected_vertices[data.element.uuid]) {
					Project.selected_vertices[data.element.uuid] = [];
				}
				let list = Project.selected_vertices[data.element.uuid];

				if (event.ctrlOrCmd || Pressing.overrides.ctrl || event.shiftKey || Pressing.overrides.shift) {
					if (list.includes(data.vertices[0]) && list.includes(data.vertices[1])) {
						list.remove(...data.vertices);
					} else {
						list.remove(...data.vertices);
						list.push(...data.vertices);
					}
				} else {
					list.replace(data.vertices);
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

						list.safePush(...side_vertices);

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
		if (typeof Toolbox.selected.onCanvasClick === 'function') {
			Toolbox.selected.onCanvasClick({event})
		}

		if ((Keybinds.extra.preview_area_select.keybind.isTriggered(event)) || this.movingBackground) {
			this.startSelRect(event)
		} else {
			return false;
		}
	}
	mousemove(event) {
		if (Settings.get('highlight_cubes')) {
			var data = this.raycast(event);
			updateCubeHighlights(data && data.element);
		}
	}
	mouseup(event) {
		this.showContextMenu(event);
		if (settings.canvas_unselect.value && event.which != 2 && this.controls.hasMoved === false && !this.selection.activated && !Transformer.dragging && !this.selection.click_target) {
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
		this.selection.activated = false;
		this.selection.old_selected = Outliner.selected.slice();
		this.selection.old_vertices_selected = {};
		for (let uuid in Project.selected_vertices) {
			this.selection.old_vertices_selected[uuid] = Project.selected_vertices[uuid].slice();
		}

		this.moveSelRect(event)
	}
	moveSelRect(event) {
		var scope = this;

		if (this.movingBackground) {
			if (event.shiftKey || Pressing.overrides.shift) {
				this.background.size = limitNumber( this.background.before.size + (event.offsetY - this.selection.start_y), 0, 10e3)
			} else {
				this.background.x = this.background.before.x + (event.offsetX - this.selection.start_x);
				this.background.y = this.background.before.y + (event.offsetY - this.selection.start_y);
			}
			this.updateBackground()
			return;
		}

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
		let extend_selection = (event.shiftKey || event.ctrlOrCmd || Pressing.overrides.ctrl || Pressing.overrides.shift)
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

		unselectAll()
		Outliner.elements.forEach((element) => {
			let isSelected;
			if (extend_selection && scope.selection.old_selected.includes(element) && (element instanceof Mesh == false || selection_mode == 'object')) {
				isSelected = true

			} else if (element.visibility) {
				if (element.mesh && element.mesh.geometry) {
					let {mesh} = element;
					
					if (element instanceof Mesh && (selection_mode == 'object' || scope.selection.old_selected.includes(element))) {

						let selected_vertices;
						if (selection_mode != 'object') {
							isSelected = true;
							if (!Project.selected_vertices[element.uuid]) {
								selected_vertices = Project.selected_vertices[element.uuid] = [];
							} else {
								selected_vertices = Project.selected_vertices[element.uuid];
							}
							if (!extend_selection) selected_vertices.empty();
						}

						let vertex_points = {};
						for (let vkey in element.vertices) {
							let point = projectPoint( mesh.localToWorld(vector.fromArray(element.vertices[vkey])) );
							vertex_points[vkey] = point;
						}
						if (selection_mode == 'vertex') {
							for (let vkey in element.vertices) {
								let point = vertex_points[vkey];
								if (
									(extend_selection && this.selection.old_vertices_selected[element.uuid] && this.selection.old_vertices_selected[element.uuid].includes(vkey)) ||
									pointInRectangle(point, rect_start, rect_end)
								) {
									selected_vertices.safePush(vkey);
								}
							}

						} else if (selection_mode == 'line') {
							for (let fkey in element.faces) {
								let face = element.faces[fkey];
								let vertices = face.getSortedVertices();
								for (let i = 0; i < vertices.length; i++) {
									let vkey = vertices[i];
									let vkey2 = vertices[i+1]||vertices[0];
									let p1 = vertex_points[vkey];
									let p2 = vertex_points[vkey2];
									if (lineIntersectsReactangle(p1, p2, rect_start, rect_end)) {
										selected_vertices.safePush(vkey);
									}
								}
							}
	
						} else {
							for (let fkey in element.faces) {
								let face = element.faces[fkey];
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
								if (face_intersects && selection_mode == 'object') {
									if (face_intersects) {
										isSelected = true;
										break;
									}
								} else {
									if (face_intersects) {
										selected_vertices.safePush(...face.vertices);
										UVEditor.vue.selected_faces.safePush(fkey);
									} else {
										UVEditor.vue.selected_faces.remove(fkey);
									}
								}
							}
						}

					} else if (element instanceof Cube) {
						let vertices = [
							[element.from[0]	- element.inflate, element.from[1]	- element.inflate, element.from[2]	- element.inflate],
							[element.from[0]	- element.inflate, element.from[1]	- element.inflate, element.to[2]	+ element.inflate],
							[element.from[0]	- element.inflate, element.to[1]	+ element.inflate, element.to[2]	+ element.inflate],
							[element.from[0]	- element.inflate, element.to[1]	+ element.inflate, element.from[2]	- element.inflate],
							[element.to[0]		+ element.inflate, element.from[1]	- element.inflate, element.from[2]	- element.inflate],
							[element.to[0]		+ element.inflate, element.from[1]	- element.inflate, element.to[2]	+ element.inflate],
							[element.to[0]		+ element.inflate, element.to[1]	+ element.inflate, element.to[2]	+ element.inflate],
							[element.to[0]		+ element.inflate, element.to[1]	+ element.inflate, element.from[2]	- element.inflate],
						].map(coords => {
							coords.V3_subtract(element.origin);
							vector.fromArray(coords);
							mesh.localToWorld(vector);
							return projectPoint(vector);
						})
						isSelected = lineIntersectsReactangle(vertices[0], vertices[1], rect_start, rect_end)
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
		document.removeEventListener('mousemove', this.sr_move_f)
		document.removeEventListener('mouseup',	this.sr_stop_f)
		if (this.movingBackground) {
			delete this.background.before
			return
		};
		this.selection.box.detach()
		this.selection.activated = false;
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
			this.background = canvas_scenes['ortho_'+this.angle]
		} else {
			this.background = canvas_scenes.normal
		}
		return this.background
	}
	loadBackground() {
		this.getBackground()
		if (this.background && this.background.image) {
			let background_image = `url("${this.background.image.replace(/\\/g, '/').replace(/#/g, '%23')}")`;
			this.canvas.style.setProperty('background-image', background_image)
			this.node.querySelector('.preview_background_menu').style.setProperty('background-image', background_image);
			this.node.querySelector('.preview_background_menu').style.display = 'block';
		} else {
			this.canvas.style.setProperty('background-image', 'none')
			this.node.querySelector('.preview_background_menu').style.display = 'none';
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

		this.canvas.style.setProperty('background-position-x', pos_x + 'px')
		this.canvas.style.setProperty('background-position-y', pos_y + 'px')
		this.canvas.style.setProperty('background-size',  bg.size * zoom +'px')
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

		this.position_toast = Blockbench.showToastNotification({
			text: 'message.drag_background',
			icon: 'open_with',
			click: () => {
				this.stopMovingBackground();
				return true;
			}
		})
	}
	stopMovingBackground() {
		this.movingBackground = false;
		this.controls.enabled = this.controls.enabled_before
		delete this.controls.enabled_before
		if (this.position_toast) {
			this.position_toast.delete();
			delete this.position_toast;
		}
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
	delete() {
		this.renderer.dispose();
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
		{icon: 'icon-player', name: 'settings.display_skin', condition: () => (display_mode && displayReferenceObjects.active.id === 'player'), click: function() {
			changeDisplaySkin()
		}},
		'preview_checkerboard',
		{id: 'background', icon: 'wallpaper', name: 'menu.preview.background', children(preview) {
			var has_background = !!preview.background.image
			function applyBackground(image) {
				if (!preview.background.image) {
					preview.background.save_in_project = null;
				}
				preview.background.image = image;
				preview.loadBackground();
				Settings.saveLocalStorages();
				preview.startMovingBackground();
			}
			return [
				{icon: 'folder', name: 'menu.preview.background.load', click: function(preview) {
					Blockbench.import({
						resource_id: 'preview_background',
						extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif'],
						type: 'Image',
						readtype: 'image'
					}, function(files) {
						if (files) {
							applyBackground(isApp ? files[0].path : files[0].content);
						}
					}, 'image', false)
				}},
				{icon: 'fa-clipboard', name: 'menu.preview.background.clipboard', click: function(preview) {
					if (isApp) {
						var image = clipboard.readImage().toDataURL();
						if (image.length > 32) applyBackground(image);
					} else {
						navigator.clipboard.read().then(content => {
							if (content && content[0] && content[0].types.includes('image/png')) {
								content[0].getType('image/png').then(blob => {
									let url = URL.createObjectURL(blob);
									if (image.length > 32) applyBackground(url);
								})
							}
						})
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
		{id: 'angle', icon: 'videocam', name: 'menu.preview.angle', condition(preview) {return !preview.movingBackground && !Modes.display}, children: function(preview) {
			var children = [
			]
			let presets = localStorage.getItem('camera_presets')
			presets = (presets && autoParseJSON(presets, false)) || [];
			let all_presets = [...DefaultCameraPresets, ...presets];

			all_presets.forEach(preset => {
				let icon = typeof preset.locked_angle ? 'videocam' : (preset.locked_angle == preview.angle ? 'radio_button_checked' : 'radio_button_unchecked'); 
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
		'_',
		{icon: 'grid_view', name: 'menu.preview.quadview', condition: function(preview) {return !quad_previews.enabled && !preview.movingBackground && !Modes.display && !Animator.open}, click: function() {
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

Blockbench.on('update_camera_position', e => {
	let scale = Preview.selected.calculateControlScale(new THREE.Vector3(0, 0, 0));
	Preview.all.forEach(preview => {
		if (preview.canvas.isConnected) {
			preview.raycaster.params.Points.threshold = scale * 0.8;
			preview.raycaster.params.Line.threshold = scale * 0.42;
		}
	})
})

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

function editCameraPreset(preset, presets) {
	let {name, projection, position, target, zoom} = preset;
	
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
			position: {label: 'dialog.save_angle.position', type: 'vector', dimensions: 3, value: position},
			target: {label: 'dialog.save_angle.target', type: 'vector', dimensions: 3, value: target},
			zoom: {label: 'dialog.save_angle.zoom', type: 'number', value: zoom||1, condition: result => (result.projection == 'orthographic')},
		},
		onConfirm: function(result) {

			if (!result.name) return;

			preset.name = result.name;
			preset.projection = result.projection;
			preset.position = result.position;
			preset.target = result.target;
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
	async returnScreenshot(dataUrl, cb) {

		if (cb) {
			cb(dataUrl);
			return;
		}

		let img = new Image()
		let is_gif = dataUrl.substr(5, 9) == 'image/gif'
		img.src = dataUrl
		img.className = 'allow_default_menu checkerboard';
		await new Promise((resolve, reject) => {
			img.onload = resolve;
			img.onerror = reject;
		})

		let center = document.createElement('center');
		center.innerHTML = `<div>${img.naturalWidth} x ${img.naturalHeight}px, ${is_gif ? 'GIF' : 'PNG'}</div>`;
		center.appendChild(img);

		let buttons = [tl('dialog.save'), tl('dialog.cancel')]
		if (!is_gif) {
			buttons.splice(0, 0, tl('message.screenshot.clipboard'))
		}
		let dialog = new Dialog({
			title: 'message.screenshot.title', 
			id: 'screenshot',
			width: img.naturalWidth + 50,
			lines: [
				center
			],
			buttons,
			onButton(result) {

				if (result === 0 && buttons.length == 3) {
					if (navigator.clipboard && navigator.clipboard.write) {
						fetch(dataUrl).then(async data => {
							const blob = await data.blob();
							await navigator.clipboard.write([
								new ClipboardItem({
									[blob.type]: blob
								})
							]);
						})
					} else {
						Blockbench.showQuickMessage('message.screenshot.right_click');
						return false;
					}
				} else if (result === buttons.length-2) {
					Blockbench.export({
						resource_id: 'screenshot',
						extensions: [is_gif ? 'gif' : 'png'],
						type: tl('data.image'),
						savetype: is_gif ? 'binary' : 'image',
						name: Project.name.replace(/\.geo$/, ''),
						content: is_gif ? Buffer(dataUrl.split(',')[1], 'base64') : dataUrl,
					})
				}
			}
		})
		dialog.show();
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
			background: options.background ? options.background : {r: 30, g: 0, b: 255},
			transparent: options.background ? undefined : 0x1e01ff,
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

		let recording = true;
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
				endRecording(true)
				return;
			}

		}, interval)

		function endRecording(render) {
			recording = false;
			clearInterval(loop)
			if (render) {
				gif.render();
				if (!options.silent) {
					Blockbench.setStatusBarText(tl('status_bar.processing_gif'))
				}
			}
			if (Animator.open && Timeline.playing) {
				Timeline.pause();
			}
			if (options.turnspeed) {
				preview.controls.autoRotate = false;
			}
		}

		let toast = Blockbench.showToastNotification({
			text: 'message.recording_gif',
			icon: 'local_movies',
			click() {
				if (recording) {
					endRecording(false);
				} else {
					gif.abort();
				}
				Blockbench.setStatusBarText();
				Blockbench.setProgress(0);
				return true;
			}
		})

		gif.on('finished', blob => {
			var reader = new FileReader();
			reader.onload = () => {
				if (!options.silent) {
					Blockbench.setProgress();
					Blockbench.setStatusBarText();
				}
				Screencam.returnScreenshot(reader.result, cb);
			}
			reader.readAsDataURL(blob);
			toast.delete();
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

window.addEventListener("gamepadconnected", function(event) {
	if (event.gamepad.id.includes('SpaceMouse') || event.gamepad.id.includes('SpaceNavigator')) {

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

class PreviewBackground {
	constructor(data = {}) {
		this.name = data.name ? tl(data.name) : ''
		this._image = data.image||false
		this.size = data.size||1000
		this.x = data.x||0
		this.y = data.y||0
		this.lock = data.lock||false
		this.save_in_project = false;
		this.defaults = Object.assign({}, this);
		this.defaults.image = this.image;
		this.imgtag = new Image();
	}
	get image() {
		return this._image;
	}
	set image(path) {
		this._image = path;
		if (typeof this._image == 'string') {
			this.imgtag.src = this._image.replace(/#/g, '%23');
		}
	}
	getSaveCopy() {
		let dataUrl;

		if (isApp && this.image && this.image.substr(0, 5) != 'data:') {
			let canvas = document.createElement('canvas');
			canvas.width = this.imgtag.naturalWidth;
			canvas.height = this.imgtag.naturalHeight;
			let ctx = canvas.getContext('2d');
			ctx.drawImage(this.imgtag, 0, 0);
			dataUrl = canvas.toDataURL('image/png');
		}

		return {
			name: this.name,
			image: dataUrl || this.image,
			size: this.size,
			x: this.x,
			y: this.y,
			lock: this.lock
		}
	}
}

//Init/Update
function initCanvas() {
	
	//Objects
	scene = Canvas.scene = new THREE.Scene();
	display_scene = new THREE.Scene();
	display_area = new THREE.Object3D();
	display_base = new THREE.Object3D();

	display_scene.add(display_area)
	display_area.add(display_base)

	scene.name = 'scene'
	display_base.name = 'display_base'
	display_area.name = 'display_area'
	display_scene.name = 'display_scene'


	scene.add(Vertexsnap.vertex_gizmos)
	Vertexsnap.vertex_gizmos.name = 'vertex_handles'

	Canvas.outlines = new THREE.Object3D();
	Canvas.outlines.name = 'outline_group'
	scene.add(Canvas.outlines)


	canvas_scenes = {
		normal: 			new PreviewBackground({name: 'menu.preview.perspective.normal', lock: null}),
		ortho_top: 			new PreviewBackground({name: 'direction.top', lock: true}),
		ortho_bottom: 		new PreviewBackground({name: 'direction.bottom', lock: true}),
		ortho_south: 		new PreviewBackground({name: 'direction.south', lock: true}),
		ortho_north: 		new PreviewBackground({name: 'direction.north', lock: true}),
		ortho_east: 		new PreviewBackground({name: 'direction.east', lock: true}),
		ortho_west: 		new PreviewBackground({name: 'direction.west', lock: true}),

		monitor: 			new PreviewBackground({name: 'display.reference.monitor' }),

		inventory_nine: 	new PreviewBackground({name: 'display.reference.inventory_nine', image: './assets/inventory_nine.png', x: 0, y: -525, size: 1051, lock: true}),
		inventory_full: 	new PreviewBackground({name: 'display.reference.inventory_full', image: './assets/inventory_full.png', x: 0, y: -1740, size: 2781, lock: true}),
		hud: 				new PreviewBackground({name: 'display.reference.hud', image: './assets/hud.png', x: -224, y: -447.5, size: 3391, lock: true}),
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

					if (store.save_in_project) continue;
					if (store.save_in_project == null) {real.save_in_project = false}

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

	Canvas.setup();
	
	resizeWindow()
}
function animate() {
	requestAnimationFrame( animate );
	if (!settings.background_rendering.value && !document.hasFocus() && !document.querySelector('#preview:hover')) return;
	TickUpdates.Run();

	if (Animator.open && Timeline.playing) {
		Timeline.loop();
	}
	if (quad_previews.current) {
		WinterskyScene.updateFacingRotation(quad_previews.current.camera);
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
	display_scene.remove(lights)
	Sun.intensity = settings.brightness.value/50;
	if (settings.shading.value === true) {
		Sun.intensity *= 0.5;
		let parent = display_mode ? display_scene : scene;
		parent.add(lights);
		lights.position.copy(parent.position).multiplyScalar(-1);
	}
	Texture.all.forEach(tex => {
		let material = tex.getMaterial();
		material.uniforms.SHADE.value = settings.shading.value;
		material.uniforms.BRIGHTNESS.value = settings.brightness.value / 50;
	})
	Canvas.emptyMaterials.forEach(material => {
		material.uniforms.SHADE.value = settings.shading.value;
		material.uniforms.BRIGHTNESS.value = settings.brightness.value / 50;
	})
	Canvas.solidMaterial.uniforms.SHADE.value = settings.shading.value;
	Canvas.solidMaterial.uniforms.BRIGHTNESS.value = settings.brightness.value / 50;
	Canvas.normalHelperMaterial.uniforms.SHADE.value = settings.shading.value;
}
function updateCubeHighlights(hover_cube, force_off) {
	Outliner.elements.forEach(element => {
		if (element.visibility && element.mesh.geometry && element.preview_controller.updateHighlight) {
			element.preview_controller.updateHighlight(element, hover_cube, force_off);
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
		var material = new THREE.LineBasicMaterial({color: gizmo_colors[color]});
		var dest = new THREE.Vector3().copy(origin);
		dest[axis] += length;
		let points = [
			origin,
			dest
		];
		let geometry = new THREE.BufferGeometry().setFromPoints(points)
		

		//geometry.vertices.push(origin)
		//geometry.vertices.push(dest)

		var line = new THREE.Line(geometry, material);
		line.name = 'axis_line_'+axis;
		three_grid.add(line)
	}
	//Axis Lines
	if (settings.base_grid.value) {
		var length = Format.centered_grid
			? (settings.full_grid.value ? 24 : 8)
			: 16
		setupAxisLine(new THREE.Vector3( 0, 0.01, 0), length, 'x')
		setupAxisLine(new THREE.Vector3( 0, 0.01, 0), length, 'z')

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
	new BarSelect('view_mode', {
		category: 'view',
		keybind: new Keybind({key: 'z'}),
		condition: () => Project && Toolbox && Toolbox.selected && (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.length > 1),
		value: 'textured',
		options: {
			textured: {name: true, condition: () => (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('textured'))},
			solid: {name: true, condition: () => (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('solid'))},
			wireframe: {name: true, condition: () => (!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('wireframe'))},
			normal: {name: true, condition: () => ((!Toolbox.selected.allowed_view_modes || Toolbox.selected.allowed_view_modes.includes('normal')) && Mesh.all.length)},
		},
		onChange() {
			Project.view_mode = this.value;
			Canvas.updateAllFaces();
			if (Modes.id === 'animate') {
				Animator.preview();
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
	new Toggle('toggle_motion_trails', {
		name: tl('settings.motion_trails'),
		description: tl('settings.motion_trails.desc'),
		icon: 'gesture',
		category: 'view',
		linked_setting: 'motion_trails',
		condition: {modes: ['animate']}
	})

	new Action('screenshot_model', {
		icon: 'fa-cubes',
		category: 'view',
		keybind: new Keybind({key: 'p', ctrl: true}),
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
					color:  {label: 'dialog.create_gif.color', type: 'color', value: '#00000000'},
					turn:	{label: 'dialog.create_gif.turn', type: 'number', value: 0, min: -10, max: 10},
					play: 	{label: 'dialog.create_gif.play', type: 'checkbox', condition: Animator.open},
				},
				onConfirm: function(formData) {
					let background = formData.color.toHex8String() != '#00000000' ? formData.color.toHexString() : undefined;
					Screencam.createGif({
						length_mode: formData.length_mode,
						length: limitNumber(formData.length, 0.1, 24000),
						fps: limitNumber(formData.fps, 0.5, 30),
						quality: limitNumber(formData.quality, 0, 30),
						background,
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
		icon: 'grid_view',
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
		click: function () {
			if (Prop.active_panel == 'uv') {
				UVEditor.focusOnSelection()

			} else {
				let preview = quad_previews.current;
				let center = new THREE.Vector3().fromArray(getSelectionCenter());
				center.add(scene.position);

				let difference = new THREE.Vector3().copy(preview.controls.target).sub(center);
				difference.divideScalar(6)

				let i = 0;
				let interval = setInterval(() => {
					preview.controls.target.sub(difference);

					if (preview.angle != null) {
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
		condition: _ => (!preview.movingBackground || !Modes.display),
		keybind: new Keybind({key: 101}),
		click: function () {
			quad_previews.current.setProjectionMode(!quad_previews.current.isOrtho, true);
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
