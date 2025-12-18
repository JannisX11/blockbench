import SolidMaterialVertShader from './../shaders/solid.vert.glsl'
import SolidMaterialFragShader from './../shaders/solid.frag.glsl'
import MarkerVertShader from './../shaders/marker.vert.glsl'
import MarkerFragShader from './../shaders/marker.frag.glsl'
import LayeredVertShader from './../shaders/layered.vert.glsl'
import LayeredFragShader from './../shaders/layered.frag.glsl'
import DirectionHelperVertShader from './../shaders/direction_helper.vert.glsl'
import DirectionHelperFragShader from './../shaders/direction_helper.frag.glsl'
import UVHelperVertShader from './../shaders/uv_helper.vert.glsl'
import UVHelperFragShader from './../shaders/uv_helper.frag.glsl'
import BrushOutlineVertShader from './../shaders/brush_outline.vert.glsl'
import BrushOutlineFragShader from './../shaders/brush_outline.frag.glsl'
import { prepareShader } from '../shaders/shader';
import { gizmo_colors } from './preview'

export const Reusable = {
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
	quat3: new THREE.Quaternion(),

	euler1: new THREE.Euler(),
	euler2: new THREE.Euler(),
	euler3: new THREE.Euler(),
}


export const Canvas = {
	// Stores various colors for the 3D scene
	gizmo_colors,
	// Main Blockbench 3D scene
	scene,
	// Pivot marker
	pivot_marker: new THREE.Object3D(),
	gizmos: [],
	show_gizmos: true,
	ground_animation: false,
	outlineMaterial: new THREE.LineBasicMaterial({
		linewidth: 2,
		depthTest: settings.seethrough_outline.value == false,
		transparent: true,
		color: gizmo_colors.outline
	}),
	splinePathLineMaterial: new THREE.LineBasicMaterial({
		linewidth: 4,
		vertexColors: true, 
		depthTest: settings.seethrough_outline.value == false,
		transparent: true,
	}),
	splinePathDashedLineMaterial: new THREE.LineDashedMaterial({
		linewidth: 4,
		vertexColors: true, 
		depthTest: settings.seethrough_outline.value == false,
		transparent: true, 
		dashSize: 0.75, 
		gapSize: 0.5
	}),
	meshOutlineMaterial: new THREE.LineBasicMaterial({
		linewidth: 2,
		depthTest: settings.seethrough_outline.value == false,
		transparent: true,
		//color: gizmo_colors.outline,
		vertexColors: true
	}),
	meshVertexMaterial: new THREE.PointsMaterial({size: 7, sizeAttenuation: false, vertexColors: true}),
	wireframeMaterial: new THREE.MeshBasicMaterial({
		wireframe: true
	}),
	monochromaticSolidMaterial: (function() {
		return new THREE.ShaderMaterial({
			uniforms: {
				SHADE: {type: 'bool', value: settings.shading.value},
				BRIGHTNESS: {type: 'bool', value: settings.brightness.value / 50},
				base: {value: gizmo_colors.solid}
			},
			vertexShader: prepareShader(SolidMaterialVertShader),
			fragmentShader: prepareShader(SolidMaterialFragShader),
			side: THREE.DoubleSide
		});
	})(),
	normalHelperMaterial: (function() {
		return new THREE.ShaderMaterial({
			uniforms: {
				SHADE: {type: 'bool', value: settings.shading.value}
			},
			vertexShader: prepareShader(DirectionHelperVertShader),
			fragmentShader: prepareShader(DirectionHelperFragShader),
			side: THREE.DoubleSide
		});
	})(),
	vertexWeightHelperMaterial: (function() {
		return new THREE.MeshLambertMaterial({
			color: 0xffffff,
			side: 2,
			vertexColors: true
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

		return new THREE.ShaderMaterial({
			uniforms: {
				map: {type: 't', value: tex},
				SHADE: {type: 'bool', value: settings.shading.value},
				DENSITY: {type: 'float', value: 4}
			},
			vertexShader: prepareShader(UVHelperVertShader),
			fragmentShader: prepareShader(UVHelperFragShader),
			side: THREE.DoubleSide,
		})
	})(),
	emptyMaterials: [],
	coloredSolidMaterials: [],
	getEmptyMaterial(index) {
		return Canvas.emptyMaterials[index % Canvas.emptyMaterials.length];
	},
	getSolidColorMaterial(index) {
		return Canvas.coloredSolidMaterials[index % Canvas.coloredSolidMaterials.length];
	},
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

		markerColors.forEach(function(color, i) {
			if (Canvas.emptyMaterials[i]) return;

			// Define uniforms that all marker colored shaders share
			let commonUniforms = {
				SHADE: {type: 'bool', value: settings.shading.value},
				BRIGHTNESS: {type: 'bool', value: settings.brightness.value / 50},
				base: {value: new THREE.Color().set(color.pastel)}
			}

			// Empty texture materials
			Canvas.emptyMaterials[i] = new THREE.ShaderMaterial({
				uniforms: {
					map: {type: 't', value: tex},
					...commonUniforms
				},
				vertexShader: prepareShader(MarkerVertShader),
				fragmentShader: prepareShader(MarkerFragShader),
				side: THREE.DoubleSide,
			})

			// Colored solid materials
			Canvas.coloredSolidMaterials[i] = new THREE.ShaderMaterial({
				uniforms: commonUniforms,
				vertexShader: prepareShader(SolidMaterialVertShader),
				fragmentShader: prepareShader(SolidMaterialFragShader),
				side: THREE.DoubleSide
			});
		})
	},
	transparentMaterial: new THREE.MeshBasicMaterial({visible: false, name: 'invisible'}),
	global_light_color: new THREE.Color(0xffffff),
	global_light_side: 0,

	hover_helper_line: (function() {
		let material = new THREE.LineBasicMaterial({color: 0xA4A5CA, linewidth: 2});
		let geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute( [0, 0, 0, 0, 0, 0], 3 ));
		let line = new THREE.LineSegments(geometry, material);
		return line;
	})(),
	hover_helper_vertex: (function() {
		let material = new THREE.PointsMaterial({size: 4, sizeAttenuation: false, color: 0x3e90ff})
		let geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute( [0, 0, 0], 3 ));
		return new THREE.Points(geometry, material);
	})(),

	onionSkinEarlierMaterial: new THREE.LineBasicMaterial({color: 0xa3363d}),
	onionSkinLaterMaterial: new THREE.LineBasicMaterial({color: 0x3995bf}),
	gridMaterial: new THREE.LineBasicMaterial({color: gizmo_colors.grid}),
	buildGrid() {
		three_grid.children.empty();
		if (Canvas.side_grids) {
			Canvas.side_grids.x.children.empty();
			Canvas.side_grids.z.children.empty();
		}
		if (!settings.grids.value) return;
		if (Modes.display) return;

		three_grid.name = 'grid_group'
		gizmo_colors.grid.set(parseInt('0x'+CustomTheme.data.colors.grid.replace('#', ''), 16));

		const block_size = Format.block_size ?? 16;

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
				? (settings.full_grid.value ? block_size*1.5 : block_size/2)
				: block_size
			setupAxisLine(new THREE.Vector3( 0, 0.01, 0), length, 'x')
			setupAxisLine(new THREE.Vector3( 0, 0.01, 0), length, 'z')

		}

		var side_grid = new THREE.Object3D()

		if (settings.full_grid.value === true) {
			//Grid
			let size = settings.large_grid_size.value*block_size;
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
			let north_size = 5 * (block_size/16);
			let geometry = new THREE.PlaneGeometry(north_size, north_size);
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
				var grid = new THREE.GridHelper(size*block_size, size, Canvas.gridMaterial);
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
				var grid = new THREE.GridHelper(block_size, block_size/canvasGridSize(), Canvas.gridMaterial);

				if (Format.centered_grid) {
					grid.position.set(0,0,0)
				} else { 
					grid.position.set(8,0,8)
				}
				grid.name = 'grid'
				three_grid.add(grid)
				side_grid.add(grid.clone())

				//North
				let north_size = 2.4 * (block_size/16);
				let geometry = new THREE.PlaneGeometry(north_size, north_size);
				var north_mark = new THREE.Mesh(geometry, Canvas.northMarkMaterial)
				if (Format.centered_grid) {
					north_mark.position.set(0,0,-0.6*north_size - block_size/2);
				} else {
					north_mark.position.set(8,0,-0.6*north_size);
				}
				north_mark.rotation.x = Math.PI / -2
				three_grid.add(north_mark)
			}
		}
		if (settings.large_box.value === true) {
			let size = Format.cube_size_limiter?.box_marker_size || [48, 48, 48];
			var geometry_box = new THREE.EdgesGeometry(new THREE.BoxGeometry(...size));

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
		Canvas.scene.add(Sun);
		Sun.intensity = 0.5

		lights = new THREE.Object3D()
		lights.name = 'lights'
		
		lights.top = new THREE.DirectionalLight();
		lights.top.name = 'light_top'
		lights.top.position.set(0, 100, 0)
		lights.add(lights.top);
		
		lights.top.intensity = 0.46
		
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

		let brush_outline_material = new THREE.ShaderMaterial({
			transparent: true,
			side: THREE.DoubleSide,
			alphaTest: 0.01,
			polygonOffset: true,
			polygonOffsetUnits: 1,
			polygonOffsetFactor: -1,
			extensions: { derivatives: true },

			uniforms: {
				color: { value: new THREE.Color() },
				width: { value: 2. },
				SHAPE: { value: 0 },
			},

			vertexShader: prepareShader(BrushOutlineVertShader),
			fragmentShader: prepareShader(BrushOutlineFragShader),
		})
		Canvas.brush_outline = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), brush_outline_material);
		Canvas.brush_outline.matrixAutoUpdate = false;
		Canvas.gizmos.push(Canvas.brush_outline);

		Canvas.gizmos.push(Canvas.hover_helper_line);
		Canvas.gizmos.push(Canvas.hover_helper_vertex);

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
			side: settings.ground_plane_double_side.value ? THREE.DoubleSide : THREE.FrontSide,
			alphaTest: 0.2
		})
		let size = 4096;
		Canvas.ground_plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), Canvas.groundPlaneMaterial);
		Canvas.ground_plane.rotation.x = -Math.PI/2;
		Canvas.ground_plane.position.y = -0.025;
		Canvas.ground_plane.geometry.attributes.uv.set([0, 4096/16, 4096/16, 4096/16, 0, 0, 4096/16, 0]);
		Canvas.ground_plane.geometry.attributes.uv.needsUpdate = true;
		Canvas.ground_plane.visible = settings.ground_plane.value;
		scene.add(Canvas.ground_plane);
		Canvas.gizmos.push(Canvas.ground_plane);
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
			if (Canvas.side_grids) edit(Canvas.side_grids.x)
			if (Canvas.side_grids) edit(Canvas.side_grids.z)
			Outliner.elements.forEach(element => {
				let {mesh} = element;
				if (element.selected && mesh.outline) edit(mesh.outline);
				if (mesh.grid_box) edit(mesh.grid_box);
				if (element instanceof Locator) edit(mesh.children[0]);
				if (element.getTypeBehavior('hide_in_screenshot')) edit(mesh);
			})
		}
		editVis(obj => {
			obj.was_visible = obj.visible
			obj.visible = false
		})
		var ground_anim_before = Canvas.ground_animation
		if (Modes.display && Canvas.ground_animation) {
			Canvas.ground_animation = false
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
		if (Modes.display && ground_anim_before) {
			Canvas.ground_animation = ground_anim_before
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
					if (controller.updatePixelGrid) controller.updatePixelGrid(element);
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
	updateViewMode() {
		this.updateAllFaces();
		this.updateShading();
		updateSelection();
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
			if (obj.preview_controller.updateFaces) {
				var used = true;
				if (texture && obj.faces && !Format.single_texture) {
				 	used = false;
					for (var face in obj.faces) {
						if (obj.faces[face].getTexture() == texture) {
				 			used = true;
							break;
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
	getRenderSide(texture) {
		if (texture instanceof Texture) {
			if (texture.render_sides == 'front') return THREE.FrontSide;
			if (texture.render_sides == 'double') return THREE.DoubleSide;
		}
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
		let side = Canvas.getRenderSide();
		ModelProject.all.forEach(project => {
			project.textures.forEach((tex) => {
				var mat = tex.getMaterial();
				if (!mat) return;
				mat.side = Canvas.getRenderSide(tex);
			})
		})
		if (Canvas.layered_material) {
			Canvas.layered_material.side = side;
		}
		if (Canvas.monochromaticSolidMaterial) {
			Canvas.monochromaticSolidMaterial.side = side;
		}
		Canvas.coloredSolidMaterials.forEach(function(mat) {
			mat.side = side
		})
		Canvas.emptyMaterials.forEach(function(mat) {
			mat.side = side
		})
	},
	updatePositions(leave_selection) {
		updateNslideValues()
		var arr = selected.slice()
		if (Format.bone_rig && Group.first_selected) {
			Canvas.updateAllBones();
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
			obj.preview_controller.updateTransform(obj);
		})
	},
	updatePivotMarker() {
		if (Canvas.pivot_marker.parent) {
			Canvas.pivot_marker.parent.remove(Canvas.pivot_marker)
		}
		if (settings.origin_size.value > 0 && Canvas.show_gizmos && !Modes.paint) {
			if (Group.first_selected && Format.bone_rig) {
				if (Group.first_selected.visibility) {
					Group.first_selected.mesh.add(Canvas.pivot_marker)
				}
			} else if ((Cube.selected.length && Format.rotate_cubes) || Mesh.selected.length || Locator.selected.length) {
				let selected_elements = [...Cube.selected, ...Mesh.selected, ...Locator.selected];
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
				uniforms[`t${i}`].value = texture.getOwnMaterial().map;
				i++;
			}
		})

		var material_shh = new THREE.ShaderMaterial({
			uniforms: uniforms,
			vertexShader: prepareShader(LayeredVertShader),
			fragmentShader: prepareShader(LayeredFragShader),
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
	updateUV(cube, animation = true) {
		// Deprecated
		return Cube.preview_controller.updateUV(cube, animation);
	},
	updatePixelGrid() {
		Outliner.elements.forEach(element => {
			if (element.preview_controller.updatePixelGrid) {
				element.preview_controller.updatePixelGrid(element);
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
	},
	getSelectionBounds() {
		let pivot_marker_parent = Canvas.pivot_marker.parent;
		let visible_box = new THREE.Box3();
		if (pivot_marker_parent) pivot_marker_parent.remove(Canvas.pivot_marker);
		Canvas.withoutGizmos(() => {
			Outliner.selected.forEach(element => {
				if (element.visibility && element.mesh && element.mesh.geometry) {
					visible_box.expandByObject(element.mesh);
				}
			})
		})
		if (pivot_marker_parent) pivot_marker_parent.add(Canvas.pivot_marker);
		return visible_box;
	}
}
Canvas.gizmos.push(Canvas.pivot_marker);

Object.assign(window, {
	Reusable,
	Canvas,
	buildGrid: Canvas.buildGrid
});
