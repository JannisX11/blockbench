
function getRescalingFactor(angle) {
	switch (Math.abs(angle)) {
		case 0:
			return 1.4142
			break;
		case 22.5:
			return 1.0824
			break;
		case 67.5:
			return 1.0824
			break;
		case 45:
			return 1.4142
			break;
		default:
			return 1;
			break;
	}
}

const Reusable = {
	vec1: new THREE.Vector3(),
	vec2: new THREE.Vector3(),
	vec3: new THREE.Vector3(),
	vec4: new THREE.Vector3(),
	vec5: new THREE.Vector3(),
	vec6: new THREE.Vector3(),
	vec7: new THREE.Vector3(),
	vec8: new THREE.Vector3(),

	quat1: new THREE.Quaternion(),
	quat2: new THREE.Quaternion(),

	euler1: new THREE.Euler(),
	euler2: new THREE.Euler(),
}

const Canvas = {
	// Stores various colors for the 3D scene
	gizmo_colors,
	// Main Blockbench 3D scene
	scene,
	// Pivot marker
	pivot_marker: rot_origin,
	gizmos: [rot_origin],
	outlineMaterial: new THREE.LineBasicMaterial({
		linewidth: 2,
		transparent: true,
		color: gizmo_colors.outline
	}),
	meshOutlineMaterial: new THREE.LineBasicMaterial({
		linewidth: 2,
		//color: gizmo_colors.outline,
		vertexColors: true
	}),
	meshVertexMaterial: new THREE.PointsMaterial({size: 7, sizeAttenuation: false, vertexColors: true}),
	wireframeMaterial: new THREE.MeshBasicMaterial({
		wireframe: true
	}),
	solidMaterial: (function() {
		var vertShader = `
			attribute float highlight;

			uniform bool SHADE;

			varying float light;
			varying float lift;

			float AMBIENT = 0.1;
			float XFAC = -0.05;
			float ZFAC = 0.05;

			void main()
			{

				if (SHADE) {

					vec3 N = normalize( vec3( modelViewMatrix * vec4(normal, 0.0) ) );

					light = (0.2 + abs(N.z) * 0.8) * (1.0-AMBIENT) + N.x*N.x * XFAC + N.y*N.y * ZFAC + AMBIENT;

				} else {

					light = 1.0;

				}

				if (highlight == 2.0) {
					lift = 0.3;
				} else if (highlight == 1.0) {
					lift = 0.12;
				} else {
					lift = 0.0;
				}
				
				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
				gl_Position = projectionMatrix * mvPosition;
			}`
		var fragShader = `
			#ifdef GL_ES
			precision ${isApp ? 'highp' : 'mediump'} float;
			#endif

			uniform bool SHADE;
			uniform float BRIGHTNESS;
			uniform vec3 base;

			varying float light;
			varying float lift;

			void main(void)
			{

				gl_FragColor = vec4(lift + base * light * BRIGHTNESS, 1.0);

				if (lift > 0.1) {
					gl_FragColor.b = gl_FragColor.b * 1.16;
					gl_FragColor.g = gl_FragColor.g * 1.04;
				}
				if (lift > 0.2) {
					gl_FragColor.r = gl_FragColor.r * 0.6;
					gl_FragColor.g = gl_FragColor.g * 0.7;
				}

			}`

		return new THREE.ShaderMaterial({
			uniforms: {
				SHADE: {type: 'bool', value: settings.shading.value},
				BRIGHTNESS: {type: 'bool', value: settings.brightness.value / 50},
				base: {value: gizmo_colors.solid}
			},
			vertexShader: vertShader,
			fragmentShader: fragShader,
			side: THREE.DoubleSide
		});
	})(),
	normalHelperMaterial: (function() {
		var vertShader = `
			attribute float highlight;

			uniform bool SHADE;

			varying float light;
			varying float lift;

			float AMBIENT = 0.1;
			float XFAC = -0.05;
			float ZFAC = 0.05;

			void main()
			{

				if (SHADE) {

					vec3 N = normalize( vec3( modelViewMatrix * vec4(normal, 0.0) ) );
					light = (0.2 + abs(N.z) * 0.8) * (1.0-AMBIENT) + N.x*N.x * XFAC + N.y*N.y * ZFAC + AMBIENT;

				} else {

					light = 1.0;
				}
				

				if (highlight == 2.0) {
					lift = 0.3;
				} else if (highlight == 1.0) {
					lift = 0.12;
				} else {
					lift = 0.0;
				}
				
				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
				gl_Position = projectionMatrix * mvPosition;
			}`
		var fragShader = `
			#ifdef GL_ES
			precision ${isApp ? 'highp' : 'mediump'} float;
			#endif

			varying float light;
			varying float lift;

			void main(void)
			{
				if (gl_FrontFacing) {
					gl_FragColor = vec4(vec3(0.20, 0.68, 0.32) * light, 1.0);
				} else {
					gl_FragColor = vec4(vec3(0.76, 0.21, 0.20) * light, 1.0);
				}

				if (lift > 0.1) {
					gl_FragColor.r = gl_FragColor.r * 1.16;
					gl_FragColor.g = gl_FragColor.g * 1.16;
					gl_FragColor.b = gl_FragColor.b * 1.16;
				}
				if (lift > 0.2) {
					if (gl_FrontFacing) {
						gl_FragColor.r = gl_FragColor.r * 0.8;
						gl_FragColor.g = gl_FragColor.g * 0.9;
						gl_FragColor.b = gl_FragColor.g * 1.5;
					} else {
						gl_FragColor.r = gl_FragColor.r * 0.9;
						gl_FragColor.g = gl_FragColor.g * 2.0;
						gl_FragColor.b = gl_FragColor.g * 3.0;
					}
				}

			}`

		return new THREE.ShaderMaterial({
			uniforms: {
				SHADE: {type: 'bool', value: settings.shading.value}
			},
			vertexShader: vertShader,
			fragmentShader: fragShader,
			side: THREE.DoubleSide
		});
	})(),
	uvHelperMaterial: (function() {
		var img = new Image()
		img.src = 'assets/uv_preview.png'
		var tex = new THREE.Texture(img)
		img.tex = tex;
		img.tex.magFilter = THREE.NearestFilter
		img.tex.minFilter = THREE.NearestFilter
		img.tex.wrapS = img.tex.wrapT = THREE.RepeatWrapping;
		img.onload = function() {
			this.tex.needsUpdate = true;
		}
		var vertShader = `
			attribute float highlight;

			uniform bool SHADE;
			uniform float DENSITY;

			varying vec2 vUv;
			varying float light;
			varying float lift;

			float AMBIENT = 0.1;
			float XFAC = -0.05;
			float ZFAC = 0.05;

			void main()
			{

				if (SHADE) {

					vec3 N = normalize( vec3( modelViewMatrix * vec4(normal, 0.0) ) );

					light = (0.2 + abs(N.z) * 0.8) * (1.0-AMBIENT) + N.x*N.x * XFAC + N.y*N.y * ZFAC + AMBIENT;

				} else {

					light = 1.0;

				}

				if (highlight == 2.0) {
					lift = 0.3;
				} else if (highlight == 1.0) {
					lift = 0.12;
				} else {
					lift = 0.0;
				}
				
				vUv = uv;
				vUv.x = vUv.x * DENSITY;
				vUv.y = vUv.y * DENSITY;
				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
				gl_Position = projectionMatrix * mvPosition;
			}`
		var fragShader = `
			#ifdef GL_ES
			precision ${isApp ? 'highp' : 'mediump'} float;
			#endif

			uniform sampler2D map;

			uniform bool SHADE;

			varying vec2 vUv;
			varying float light;
			varying float lift;

			void main(void)
			{

				vec4 color = texture2D(map, vUv);
				
				if (color.a < 0.01) discard;

				gl_FragColor = vec4(lift + color.rgb * light, color.a);


				if (lift > 0.2) {
					gl_FragColor.r = gl_FragColor.r * 0.6;
					gl_FragColor.g = gl_FragColor.g * 0.7;
				}

			}`

		return new THREE.ShaderMaterial({
			uniforms: {
				map: {type: 't', value: tex},
				SHADE: {type: 'bool', value: settings.shading.value},
				DENSITY: {type: 'float', value: 4}
			},
			vertexShader: vertShader,
			fragmentShader: fragShader,
			side: THREE.DoubleSide,
		})
	})(),
	emptyMaterials: [],
	updateMarkerColorMaterials() {
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
		var vertShader = `
			attribute float highlight;

			uniform bool SHADE;

			varying vec2 vUv;
			varying float light;
			varying float lift;

			float AMBIENT = 0.5;
			float XFAC = -0.15;
			float ZFAC = 0.05;

			void main()
			{

				if (SHADE) {

					vec3 N = normalize( vec3( modelMatrix * vec4(normal, 0.0) ) );

					float yLight = (1.0+N.y) * 0.5;
					light = yLight * (1.0-AMBIENT) + N.x*N.x * XFAC + N.z*N.z * ZFAC + AMBIENT;

				} else {

					light = 1.0;

				}

				if (highlight == 2.0) {
					lift = 0.22;
				} else if (highlight == 1.0) {
					lift = 0.1;
				} else {
					lift = 0.0;
				}
				
				vUv = uv;
				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
				gl_Position = projectionMatrix * mvPosition;
			}`
		var fragShader = `
			#ifdef GL_ES
			precision ${isApp ? 'highp' : 'mediump'} float;
			#endif
			
			uniform sampler2D map;

			uniform bool SHADE;
			uniform float BRIGHTNESS;
			uniform vec3 base;

			varying vec2 vUv;
			varying float light;
			varying float lift;

			void main(void)
			{
				vec4 color = texture2D(map, vUv);

				gl_FragColor = vec4(lift + color.rgb * base * light * BRIGHTNESS, 1.0);

				if (lift > 0.2) {
					gl_FragColor.r = gl_FragColor.r * 0.6;
					gl_FragColor.g = gl_FragColor.g * 0.7;
				}

			}`

		
		markerColors.forEach(function(color, i) {
			if (Canvas.emptyMaterials[i]) return;
			Canvas.emptyMaterials[i] = new THREE.ShaderMaterial({
				uniforms: {
					map: {type: 't', value: tex},
					SHADE: {type: 'bool', value: settings.shading.value},
					BRIGHTNESS: {type: 'bool', value: settings.brightness.value / 50},
					base: {value: new THREE.Color().set(color.pastel)}
				},
				vertexShader: vertShader,
				fragmentShader: fragShader,
				side: THREE.DoubleSide,
			})
		})
	},
	transparentMaterial: new THREE.MeshBasicMaterial({visible: false, name: 'invisible'}),
	global_light_color: new THREE.Color(0xffffff),
	global_light_side: 0,

	gridMaterial: new THREE.LineBasicMaterial({color: gizmo_colors.grid}),
	buildGrid() {
		three_grid.children.length = 0;
		if (Canvas.side_grids) {
			Canvas.side_grids.x.children.length = 0;
			Canvas.side_grids.z.children.length = 0;
		}
		if (Modes.display) return;

		three_grid.name = 'grid_group'
		gizmo_colors.grid.set(parseInt('0x'+CustomTheme.data.colors.grid.replace('#', ''), 16));

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
			var grid = new THREE.GridHelper(size, size/canvasGridSize(), Canvas.gridMaterial);
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
				var grid = new THREE.GridHelper(size*16, size, Canvas.gridMaterial);
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
				var grid = new THREE.GridHelper(16, 16/canvasGridSize(), Canvas.gridMaterial);

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
			let size = Format.cube_size_limiter?.box_marker_size || [48, 48, 48];
			var geometry_box = new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(...size));

			var line_material = new THREE.LineBasicMaterial({color: gizmo_colors.grid});
			var large_box = new THREE.LineSegments( geometry_box, line_material);
			if (Format.centered_grid) {
				large_box.position.set(0,8,0)
			} else { 
				large_box.position.set(8,8,8)
			}
			large_box.name = 'grid'
			three_grid.add(large_box)
			three_grid.size_limit_box = large_box;
			if (Format.cube_size_limiter?.updateBoxMarker) Format.cube_size_limiter.updateBoxMarker();
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
	},
	updateShading,

	face_order: ['east', 'west', 'up', 'down', 'south', 'north'],
	temp_vectors: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],

	setup() {
		Canvas.updateMarkerColorMaterials();

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

		Canvas.updateShading()

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

		/*
		// Vertex gizmos
		var vertex_img = new Image();
		vertex_img.src = 'assets/vertex.png';
		vertex_img.tex = new THREE.Texture(vertex_img);
		vertex_img.tex.magFilter = THREE.NearestFilter;
		vertex_img.tex.minFilter = THREE.NearestFilter;
		vertex_img.onload = function() {
			this.tex.needsUpdate = true;
		}
		Canvas.meshVertexMaterial.map = vertex_img.tex;
		Canvas.meshVertexMaterial.transparent = true;
		*/

		//Rotation Pivot
		var helper1 = new THREE.AxesHelper(2)
		var helper2 = new THREE.AxesHelper(2)
		helper1.rotation.x = Math.PI / 1

		helper2.rotation.x = Math.PI / -1
		helper2.rotation.y = Math.PI / 1
		helper2.scale.y = -1

		Canvas.pivot_marker.add(helper1)
		Canvas.pivot_marker.add(helper2)

		Canvas.pivot_marker.name = 'pivot_marker';
		Canvas.pivot_marker.rotation.order = 'ZYX';
		Canvas.pivot_marker.base_scale = new THREE.Vector3(1, 1, 1);
		Canvas.pivot_marker.no_export = true;

		Canvas.groundPlaneMaterial = new THREE.MeshBasicMaterial({
			map: Canvas.emptyMaterials[0].uniforms.map.value,
			color: CustomTheme.data.colors.back,
			side: THREE.DoubleSide,
			alphaTest: 0.2
		})
		let size = 4096;
		Canvas.ground_plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), Canvas.groundPlaneMaterial);
		Canvas.ground_plane.rotation.x = Math.PI/2;
		Canvas.ground_plane.position.y = -0.025;
		Canvas.ground_plane.geometry.attributes.uv.set([0, 4096/16, 4096/16, 4096/16, 0, 0, 4096/16, 0]);
		Canvas.ground_plane.geometry.attributes.uv.needsUpdate = true;
		Canvas.ground_plane.visible = settings.ground_plane.value;
		scene.add(Canvas.ground_plane);
		Canvas.gizmos.push(Canvas.ground_plane);

		setupGrid = true;
	},
	//Misc
	raycast(event) {
		var preview = Canvas.getHoveredPreview()
		if (preview) {
			return preview.raycast(event)
		} else {
			return false
		}
	},
	getHoveredPreview() {
		var canvas = $('.preview canvas:hover').get(0);
		return canvas ? canvas.preview : Preview.selected;
	},
	withoutGizmos(cb) {

		function editVis(edit) {
			Canvas.gizmos.forEach(object => {
				edit(object);
			})
			edit(three_grid)
			edit(Canvas.side_grids.x)
			edit(Canvas.side_grids.z)
			Outliner.elements.forEach(element => {
				let {mesh} = element;
				if (element.selected && mesh.outline) edit(mesh.outline);
				if (mesh.grid_box) edit(mesh.grid_box);
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
		updateCubeHighlights(null, true);

		try {
			cb()
		} catch(err) {
			console.error(err)
		}

		editVis(obj => {
			obj.visible = obj.was_visible
			delete obj.was_visible
		})
		if (display_mode && ground_anim_before) {
			ground_animation = ground_anim_before
		}
		updateCubeHighlights();
	},

	/**
	 * 
	 * @param {object} options
	 * @param {array} options.elements Elements to update 
	 * @param {object} options.element_aspects 
	 * @param {boolean} options.element_aspects.transform Update the element transformation
	 * @param {boolean} options.element_aspects.geometry Update the element geometry
	 * @param {boolean} options.element_aspects.faces Update the element faces and texture
	 * @param {boolean} options.element_aspects.uv Update the element UV mapping
	 * @param {boolean} options.element_aspects.visibility Update the element visibility
	 * @param {boolean} options.element_aspects.painting_grid Update the painting grid
	 * @param {array} options.groups Groups to update 
	 * @param {object} options.group_aspects Which parts of the group to update
	 * @param {boolean} options.group_aspects.transform Update the group transformation and geometry
	 * @param {boolean} options.selection Update the selection
	 */
	updateView(options) {
		if (options.elements) {
			let aspects = options.element_aspects || {};
			options.elements.forEach(element => {
				let update_all = !options.element_aspects || (aspects.visibility && element.visibility && !element.mesh.visible);
				let controller = element.constructor.preview_controller
				
				if (aspects.transform || update_all) {
					controller.updateTransform(element);
				}
				if (aspects.geometry || update_all) {
					if (controller.updateGeometry) controller.updateGeometry(element);
				}
				if (aspects.faces || update_all) {
					if (controller.updateFaces) controller.updateFaces(element);
				}
				if ((aspects.uv || update_all)) {
					if (controller.updateUV) controller.updateUV(element);
				}
				if ((aspects.painting_grid || aspects.geometry || aspects.transform || update_all) && Modes.paint && settings.painting_grid.value) {
					if (controller.updatePaintingGrid) controller.updatePaintingGrid(element);
				}
				if (aspects.visibility || update_all) {
					if (controller.updateVisibility) controller.updateVisibility(element);
				}
			})
		}
		if (options.groups) {
			Canvas.updateAllBones(options.groups)
		}
		if (options.selection) {
			updateSelection();
		}
		Blockbench.dispatchEvent('update_view', options);
	},
	//Main updaters
	clear() {
		var objects = []
		scene.traverse(function(s) {
			if (s.isElement === true || s.isGroup === true) {
				objects.push(s)
			}
		})
		for (var uuid in Project.nodes_3d) {
			var mesh = Project.nodes_3d[uuid];
			objects.safePush(mesh);
		}
		objects.forEach(function(s) {
			if (s.parent) {
				s.parent.remove(s)
			}
			if (s.geometry) s.geometry.dispose()
			if (s.outline && s.outline.geometry) s.outline.geometry.dispose()
			delete Project.nodes_3d[s.name]
		})
	},
	updateAll() {
		updateNslideValues()
		Canvas.updateView({
			elements: Outliner.elements,
			groups: Group.all,
			selection: true,
		})
	},
	updateAllPositions(leave_selection) {
		updateNslideValues()
		Canvas.updateView({
			elements: Outliner.elements,
			element_aspects: {
				transform: true,
				geometry: true,
			}
		})
		if (leave_selection !== true) {
			updateSelection()
		}
	},
	updateVisibility() {
		Canvas.updateView({elements: Outliner.elements, element_aspects: {visibility: true}})
	},
	updateAllFaces(texture) {
		Outliner.elements.forEach(function(obj) {
			if (obj.faces || obj instanceof TextureMesh) {
				var used = true;
				if (texture && obj.faces && !Format.single_texture) {
				 	used = false;
					for (var face in obj.faces) {
						if (obj.faces[face].getTexture() == texture) {
				 			used = true;
						}
					}
				}
				if (used === true) {
					obj.preview_controller.updateFaces(obj);
					if (obj.preview_controller.updateUV) {
						obj.preview_controller.updateUV(obj);
					}
				}
			}
		})
	},
	updateAllUVs() {
		if (Project.view_mode !== 'textured') return;
		Canvas.updateView({elements: Outliner.elements, element_aspects: {uv: true}});
		return;
	},
	getRenderSide() {
		if (settings.render_sides.value == 'auto') {
			if (Format && Format.render_sides) {
				let value = typeof Format.render_sides == 'function' ? Format.render_sides() : Format.render_sides;
				if (value == 'front') return THREE.FrontSide;
				if (value == 'double') return THREE.DoubleSide;
				if (value == 'back') return THREE.BackSide;
			}
			return THREE.DoubleSide;
		} else if (settings.render_sides.value == 'front') {
			return THREE.FrontSide;
		} else {
			return THREE.DoubleSide;
		}
	},
	updateRenderSides() {
		var side = Canvas.getRenderSide();
		ModelProject.all.forEach(project => {
			project.textures.forEach(function(t) {
				var mat = project.materials[t.uuid]
				if (mat) {
					mat.side = side
				}
			})
		})
		if (Canvas.layered_material) {
			Canvas.layered_material.side = side;
		}
		if (Canvas.solidMaterial) {
			Canvas.solidMaterial.side = side;
		}
		Canvas.emptyMaterials.forEach(function(mat) {
			mat.side = side
		})
	},
	updatePositions(leave_selection) {
		updateNslideValues()
		var arr = selected.slice()
		if (Format.bone_rig && Group.selected) {
			Group.selected.forEachChild(obj => {
				if (obj instanceof OutlinerElement) {
					arr.safePush(obj)
				}
			})
			if (arr.length === selected.length) {
				Canvas.updateAllBones()
			}
		}
		Canvas.updateView({elements: arr, element_aspects: {transform: true, geometry: true}})
		if (leave_selection !== true) {
			TickUpdates.selection = true;
		}
	},
	updateSelectedFaces() {
		Cube.selected.forEach(function(obj) {
			if (obj.visibility == true) {
				obj.preview_controller.updateFaces(obj);
				obj.preview_controller.updateUV(obj);
			}
		})
	},
	updateUVs() {
		Outliner.selected.forEach(function(obj) {
			if (obj.preview_controller.updateUV) {
				obj.preview_controller.updateUV(obj);
			}
		})
	},
	outlineObjects(arr) {
		arr.forEach(function(obj) {
			if (!obj.visibility) return;
			var mesh = obj.mesh;
			if (!mesh || !mesh.geometry || !mesh.outline) return;

			var copy = mesh.outline.clone();
			copy.geometry = mesh.outline.geometry.clone();

			THREE.fastWorldPosition(mesh, copy.position);
			copy.position.sub(scene.position);
			copy.rotation.setFromQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
			mesh.getWorldScale(copy.scale);

			copy.name = obj.uuid+'_ghost_outline';
			Canvas.outlines.add(copy);
		})
	},
	updateAllBones(bones = Group.all) {
		if (Project) Project.model_3d.scale.set(1, 1, 1);
		bones.forEach((obj) => {
			let bone = obj.mesh
			if (bone && obj instanceof Group) {

				bone.rotation.order = 'ZYX';
				bone.rotation.setFromDegreeArray(obj.rotation);
				bone.position.fromArray(obj.origin);
				bone.scale.x = bone.scale.y = bone.scale.z = 1;

				if (obj.parent.type === 'group') {

					bone.position.x -=  obj.parent.origin[0];
					bone.position.y -=  obj.parent.origin[1];
					bone.position.z -=  obj.parent.origin[2];

					var parent_bone = obj.parent.mesh;
					parent_bone.add(bone);
				} else {
					Project.model_3d.add(bone);
				}

				bone.fix_position = bone.position.clone();
				bone.fix_rotation = bone.rotation.clone();
			}
		})
		if (bones == Group.all) {
			scene.updateMatrixWorld();
		} else {
			bones.forEach(bone => {
				bone.mesh.updateMatrixWorld();
			})
		}
	},
	updatePivotMarker() {
		if (Canvas.pivot_marker.parent) {
			Canvas.pivot_marker.parent.remove(Canvas.pivot_marker)
		}
		if (settings.origin_size.value > 0) {
			if (Group.selected && Format.bone_rig) {
				if (Group.selected.visibility) {
					Group.selected.mesh.add(Canvas.pivot_marker)
				}
			} else if ((Cube.selected.length && Format.rotate_cubes) || Mesh.selected.length) {
				let selected_elements = [...Cube.selected, ...Mesh.selected];
				if (selected_elements.length === 1) {
					let mesh = selected_elements[0].mesh
					if (mesh) {
						mesh.add(Canvas.pivot_marker)
					}
				} else {
					var origin = null;
					var first_visible = null;
					var i = 0;
					while (i < selected_elements.length) {
						if (selected_elements[i].visibility) {

							if (first_visible === null) {
								first_visible = selected_elements[i]
							}
							if (origin === null) {
								origin = selected_elements[i].origin
							} else if (!origin.equals(selected_elements[i].origin)) {
								origin = false;
								i = Infinity;
							}
						}
						i++;
					}
					if (first_visible && typeof origin === 'object') {
						let mesh = first_visible.mesh
						if (mesh) {
							mesh.add(Canvas.pivot_marker)
						}
					}
				}
			}
		}
		return !!Canvas.pivot_marker.parent;
	},
	adaptObjectPosition(object, mesh) {
		Canvas.updateView({
			elements: [object],
			element_aspects: {geometry: true, transform: true}
		})
	},
	adaptObjectFaceGeo(cube) {
		let {mesh} = cube;
		let {geometry} = mesh;
		if (!geometry.all_faces) geometry.all_faces = geometry.groups.slice();
		geometry.groups.empty()

		geometry.all_faces.forEach(face => {
			let bb_face = cube.faces[Canvas.face_order[face.materialIndex]];

			if (bb_face && bb_face.texture === null && geometry.groups.includes(face)) {
				geometry.groups.remove(face);
			} else
			if (bb_face && bb_face.texture !== null && !geometry.groups.includes(face)) {
				geometry.groups.push(face);
			}
		})
		if (geometry.groups.length == 0) {
			// Keep down face if no faces enabled
			geometry.groups.push(geometry.all_faces[6], geometry.all_faces[7]);
		}
	},
	getLayeredMaterial(layers) {
		if (Canvas.layered_material && !layers) return Canvas.layered_material;
		// https://codepen.io/Fyrestar/pen/YmpXYr
		var vertShader = `
			attribute float highlight;

			uniform bool SHADE;

			varying vec2 vUv;
			varying float light;
			varying float lift;

			float AMBIENT = 0.5;
			float XFAC = -0.15;
			float ZFAC = 0.05;

			void main()
			{

				if (SHADE) {

					vec3 N = normalize( vec3( modelMatrix * vec4(normal, 0.0) ) );


					float yLight = (1.0+N.y) * 0.5;
					light = yLight * (1.0-AMBIENT) + N.x*N.x * XFAC + N.z*N.z * ZFAC + AMBIENT;

				} else {

					light = 1.0;

				}

				if (highlight == 2.0) {
					lift = 0.22;
				} else if (highlight == 1.0) {
					lift = 0.1;
				} else {
					lift = 0.0;
				}
				
				vUv = uv;
				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
				gl_Position = projectionMatrix * mvPosition;
			}`
		var fragShader = `
			#ifdef GL_ES
			precision ${isApp ? 'highp' : 'mediump'} float;
			#endif

			uniform sampler2D t0;
			uniform sampler2D t1;
			uniform sampler2D t2;

			uniform bool SHADE;

			varying vec2 vUv;
			varying float light;
			varying float lift;

			void main(void)
			{
				vec4 Ca = texture2D(t0, vUv);
				vec4 Cb = texture2D(t1, vUv);
				vec4 Cc = texture2D(t2, vUv);
				
				vec3 ctemp = Ca.rgb * Ca.a + Cb.rgb * Cb.a * (1.0 - Ca.a);
				vec4 ctemp4 = vec4(ctemp, Ca.a + (1.0 - Ca.a) * Cb.a);

				vec3 c = ctemp4.rgb + Cc.rgb * Cc.a * (1.0 - ctemp4.a);
				gl_FragColor= vec4(lift + c * light, ctemp4.a + (1.0 - ctemp4.a) * Cc.a);

				if (lift > 0.2) {
					gl_FragColor.r = gl_FragColor.r * 0.6;
					gl_FragColor.g = gl_FragColor.g * 0.7;
				}
				
				if (gl_FragColor.a < 0.05) discard;
			}`

		var uniforms = {
			SHADE: {type: 'bool', value: settings.shading.value},
			t0: {type: 't', value: null},
			t1: {type: 't', value: null},
			t2: {type: 't', value: null}
		};
		let i = 0;
		if (layers instanceof Array == false) layers = Texture.all;
		layers.forEachReverse(texture => {
			if (texture.visible && i < 3) {
				uniforms[`t${i}`].value = texture.getMaterial().map;
				i++;
			}
		})

		var material_shh = new THREE.ShaderMaterial({
		  uniforms: uniforms,
		  vertexShader: vertShader,
		  fragmentShader: fragShader,
		  side: Canvas.getRenderSide(),
		  transparent: true
		});
		Canvas.layered_material = material_shh;
		return material_shh;
	},
	updateLayeredTextures() {
		delete Canvas.layered_material;
		if (Format.single_texture && Texture.all.length >= 2) {
			Canvas.updateAllFaces();
		}
	},
	adaptObjectFaces(cube, mesh) {
		if (!mesh) mesh = cube.mesh
		if (!mesh) return;

		Canvas.adaptObjectFaceGeo(cube);

		if (Project.view_mode === 'solid') {
			mesh.material = Canvas.solidMaterial
		
		} else if (Project.view_mode === 'wireframe') {
			mesh.material = Canvas.wireframeMaterial

		} else if (Format.single_texture && Texture.all.length >= 2 && Texture.all.find(t => t.render_mode == 'layered')) {
			mesh.material = Canvas.getLayeredMaterial();

		} else if (Format.single_texture) {
			let tex = Texture.getDefault();
			mesh.material = tex ? tex.getMaterial() : Canvas.emptyMaterials[cube.color];

		} else {
			var materials = []
			Canvas.face_order.forEach(function(face) {

				if (cube.faces[face].texture === null) {
					materials.push(Canvas.transparentMaterial)

				} else {
					var tex = cube.faces[face].getTexture()
					if (tex && tex.uuid) {
						materials.push(Project.materials[tex.uuid])
					} else {
						materials.push(Canvas.emptyMaterials[cube.color])
					}
				}
			})
			if (materials.allEqual(materials[0])) materials = materials[0];
			mesh.material = materials
		}
	},
	updateUV(cube, animation = true) {
		// Deprecated
		var mesh = cube.mesh
		if (mesh === undefined || !mesh.geometry) return;

		if (cube.box_uv) {

			var size = cube.size(undefined, true)
			
			var face_list = [   
				{face: 'east',	from: [0, size[2]],				   		size: [size[2],  size[1]]},
				{face: 'west',	from: [size[2] + size[0], size[2]],   	size: [size[2],  size[1]]},
				{face: 'up', 	from: [size[2]+size[0], size[2]],	 	size: [-size[0], -size[2]]},
				{face: 'down',	from: [size[2]+size[0]*2, 0],		 	size: [-size[0], size[2]]},
				{face: 'south',	from: [size[2]*2 + size[0], size[2]], 	size: [size[0],  size[1]]},
				{face: 'north',	from: [size[2], size[2]],			 	size: [size[0],  size[1]]},
			]

			if (cube.mirror_uv) {
				face_list.forEach(function(f) {
					f.from[0] += f.size[0]
					f.size[0] *= -1
				})
				//East+West
				
				var p = {}

				p.from = face_list[0].from.slice()
				p.size = face_list[0].size.slice()

				face_list[0].from = face_list[1].from.slice()
				face_list[0].size = face_list[1].size.slice()

				face_list[1].from = p.from.slice()
				face_list[1].size = p.size.slice()

			}
			face_list.forEach(function(f, fIndex) {

				if (cube.faces[f.face].texture === null) return;

				var uv= [
					f.from[0]			 +  cube.uv_offset[0],
					f.from[1]			 +  cube.uv_offset[1],
					f.from[0] + f.size[0] + cube.uv_offset[0],
					f.from[1] + f.size[1] + cube.uv_offset[1]
				]
				uv.forEach(function(s, si) {
					uv[si] *= 1
				})

				cube.faces[f.face].uv[0] = uv[0]
				cube.faces[f.face].uv[1] = uv[1]
				cube.faces[f.face].uv[2] = uv[2]
				cube.faces[f.face].uv[3] = uv[3]

				//Fight Bleeding
				for (var si = 0; si < 2; si++) {
					let margin = 1/64;
					if (uv[si] > uv[si+2]) {
						margin = -margin
					}
					uv[si] += margin
					uv[si+2] -= margin
				}

				stretch = 1;
				frame = 0;
				let tex = cube.faces[f.face].getTexture();
				if (tex instanceof Texture && tex.frameCount !== 1) {
					stretch = tex.frameCount
					if (animation === true && tex.currentFrame) {
						frame = tex.currentFrame
					}
				}

				Canvas.updateUVFace(mesh.geometry.attributes.uv, fIndex, {uv: uv}, frame, stretch)
			})

		} else {
		
			var stretch = 1
			var frame = 0

			Canvas.face_order.forEach((face, fIndex) => {

				if (cube.faces[face].texture === null) return;

				stretch = 1;
				frame = 0;
				let tex = cube.faces[face].getTexture();
				if (tex instanceof Texture && tex.frameCount !== 1) {
					stretch = tex.frameCount
					if (animation === true && tex.currentFrame) {
						frame = tex.currentFrame
					}
				}
				Canvas.updateUVFace(mesh.geometry.attributes.uv, fIndex, cube.faces[face], frame, stretch)
			})

		}
		mesh.geometry.attributes.uv.needsUpdate = true;
		return mesh.geometry
	},
	updateUVFace(vertex_uvs, index, face, frame = 0, stretch = 1) {
		stretch *= -1;
		var pw = Project.texture_width;
		var ph = Project.texture_height;
		var arr = [
			[face.uv[0]/pw, (face.uv[1]/ph)/stretch+1],
			[face.uv[2]/pw, (face.uv[1]/ph)/stretch+1],
			[face.uv[0]/pw, (face.uv[3]/ph)/stretch+1],
			[face.uv[2]/pw, (face.uv[3]/ph)/stretch+1],
		]
		if (frame > 0 && stretch !== -1) {
			//Animate
			var offset = (1/stretch) * frame
			arr[0][1] += offset
			arr[1][1] += offset
			arr[2][1] += offset
			arr[3][1] += offset
		}
		var rot = (face.rotation+0)
		while (rot > 0) {
			let a = arr[0];
			arr[0] = arr[2];
			arr[2] = arr[3];
			arr[3] = arr[1];
			arr[1] = a;
			rot = rot-90;
		}
		vertex_uvs.array.set(arr[0], index*8 + 0);  //0,1
		vertex_uvs.array.set(arr[1], index*8 + 2);  //1,1
		vertex_uvs.array.set(arr[2], index*8 + 4);  //0,0
		vertex_uvs.array.set(arr[3], index*8 + 6);  //1,0
	},
	updatePaintingGrid() {
		Outliner.elements.forEach(element => {
			if (element.preview_controller.updatePaintingGrid) {
				element.preview_controller.updatePaintingGrid(element);
			}
		})
	},

	getModelSize() {
		var visible_box = new THREE.Box3()
		Canvas.withoutGizmos(() => {
			Outliner.elements.forEach(element => {
				if (element.export != false && element.mesh && element.mesh.geometry) {
					visible_box.expandByObject(element.mesh);
				}
			})
		})
	
		var offset = new THREE.Vector3(8,8,8);
		visible_box.max.add(offset);
		visible_box.min.add(offset);
	
		// Width
		var radius = Math.max(
			visible_box.max.x,
			visible_box.max.z,
			-visible_box.min.x,
			-visible_box.min.z
		)
		if (Math.abs(radius) === Infinity) {
			radius = 0
		}
		let width = radius*2
		let height = Math.abs(visible_box.max.y - visible_box.min.y)
		if (height === Infinity) height = 0;
		
		return [width, height]
	}
}
var buildGrid = Canvas.buildGrid;
