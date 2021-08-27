
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
const Canvas = {
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
		color: gizmo_colors.wire,
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

				if (highlight == 1.0) {
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
	transparentMaterial: new THREE.MeshBasicMaterial({visible: false, name: 'invisible'}),
	gridMaterial: new THREE.LineBasicMaterial({color: gizmo_colors.grid}),
	face_order: ['east', 'west', 'up', 'down', 'south', 'north'],
	temp_vectors: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
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
			edit(three_grid)
			edit(Canvas.side_grids.x)
			edit(Canvas.side_grids.z)
			edit(Transformer)
			edit(Canvas.outlines)
			edit(rot_origin)
			edit(Vertexsnap.vertexes)
			edit(Animator.motion_trail)
			Cube.selected.forEach(function(obj) {
				var m = obj.mesh;
				if (!m) return;
				if (m.outline) edit(m.outline);
			})
			Cube.all.forEach(function(obj) {
				var m = obj.mesh;
				if (!m) return;
				if (m.grid_box) edit(m.grid_box);
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
		if (settings.highlight_cubes.value) updateCubeHighlights();
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
	 * @param {boolean} options.group_aspects.geometry Update the group transformation and geometry
	 */
	updateView(options) {


		if (options.elements) {
			let aspects = options.element_aspects || {};
			options.elements.forEach(element => {
				let {mesh} = element;
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
				if ((aspects.uv || update_all) && Prop.view_mode === 'textured') {
					if (controller.updateUV) controller.updateUV(element);
				}
				if ((aspects.painting_grid || update_all) && Modes.paint && settings.painting_grid.value) {
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
		/*
		Cube.all.forEach(function(cube) {
			if (cube.visibility && !cube.mesh.visible) {
				cube.mesh.visible = true;
				Canvas.adaptObjectFaces(cube, cube.mesh)
				if (Prop.view_mode === 'textured') {
					Canvas.updateUV(cube);
				}
				if (Modes.paint && settings.painting_grid.value) {
					Canvas.buildGridBox(cube);
				}
			} else if (!cube.visibility) {
				cube.mesh.visible = false;
			}
		})
		TickUpdates.selection = true;
		*/
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
					if (Prop.view_mode === 'textured' && obj.preview_controller.updateUV) {
						obj.preview_controller.updateUV(obj);
					}
				}
			}
		})
	},
	updateAllUVs() {
		if (Prop.view_mode !== 'textured') return;
		Canvas.updateView({elements: Outliner.elements, element_aspects: {uv: true}});
		return;
	},
	getRenderSide() {
		if (settings.render_sides.value == 'auto') {
			var side = Format.id === 'java_block' ? THREE.FrontSide : THREE.DoubleSide;
			if (display_mode) {
				if (['thirdperson_righthand', 'thirdperson_lefthand', 'head'].includes(display_slot)) {
					side = THREE.DoubleSide;
				}
			}
			return side;
		} else if (settings.render_sides.value == 'front') {
			return THREE.FrontSide;
		} else {
			return THREE.DoubleSide;
		}
	},
	updateRenderSides() {
		var side = Canvas.getRenderSide();
		Texture.all.forEach(function(t) {
			var mat = Project.materials[t.uuid]
			if (mat) {
				mat.side = side
			}
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
				if (Prop.view_mode === 'textured') {
					obj.preview_controller.updateUV(obj);
				}
			}
		})
	},
	updateUVs() {
		if (Prop.view_mode !== 'textured') return;
		Cube.selected.forEach(function(obj) {
			if (obj.visibility == true) {
				obj.preview_controller.updateUV(obj);
			}
		})
	},
	outlineObjects(arr) {
		arr.forEach(function(obj) {
			if (!obj.visibility) return;
			var mesh = obj.mesh;
			if (!mesh || !mesh.geometry) return;

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

		bones.forEach((obj) => {
			let bone = obj.mesh
			if (bone) {

				bone.rotation.reorder('ZYX');
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
		if (rot_origin.parent) {
			rot_origin.parent.remove(rot_origin)
		}
		if (settings.origin_size.value > 0) {
			if (Group.selected && Format.bone_rig) {
				if (Group.selected.visibility) {
					Group.selected.mesh.add(rot_origin)
				}
			} else if (Cube.selected.length && Format.rotate_cubes) {
				if (Cube.selected.length === 1 && Cube.selected.length == 1) {
					let mesh = Cube.selected[0].mesh
					if (mesh) {
						mesh.add(rot_origin)
					}
				} else {
					var origin = null;
					var first_visible = null;
					var i = 0;
					while (i < Cube.selected.length) {
						if (Cube.selected[i].visibility) {

							if (first_visible === null) {
								first_visible = Cube.selected[i]
							}
							if (origin === null) {
								origin = Cube.selected[i].origin
							} else if (!origin.equals(Cube.selected[i].origin)) {
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
		}
		return !!rot_origin.parent;
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

				if (highlight == 1.0) {
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

		if (Prop.view_mode === 'solid') {
			mesh.material = Canvas.solidMaterial
		
		} else if (Prop.view_mode === 'wireframe') {
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
		if (Prop.view_mode !== 'textured') return;
		var mesh = cube.mesh
		if (mesh === undefined || !mesh.geometry) return;

		if (Project.box_uv) {

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

				if (cube.faces[f.face].texture == null) return;

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

				if (cube.faces[face].texture == null) return;

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
	buildGridBox(cube) {
		var mesh = cube.mesh;
		if (mesh === undefined) return;
		mesh.remove(mesh.grid_box);
		if (cube.visibility == false) return;

		if (!Modes.paint || !settings.painting_grid.value) return;

		var box = Canvas.getPaintingGrid(cube);

		box.name = cube.uuid+'_grid_box';
		box.renderOrder = 2;
		box.frustumCulled = false;
		mesh.grid_box = box;
		mesh.add(box);
	},
	getPaintingGrid(cube) {
		var from = cube.from.slice();
		var to = cube.to.slice();
		if (cube.inflate) {
			from[0] -= cube.inflate; from[1] -= cube.inflate; from[2] -= cube.inflate;
			  to[0] += cube.inflate;   to[1] += cube.inflate;   to[2] += cube.inflate;
		}

		var vertices = [];
		var epsilon = 0.0001
		function getVector2(arr, axis) {
			switch (axis) {
				case 0: return [arr[1], arr[2]]; break;
				case 1: return [arr[0], arr[2]]; break;
				case 2: return [arr[0], arr[1]]; break;
			}
		}
		function addVector(u, v, axis, w) {
			switch (axis) {
				case 0: vertices.push(w, u, v); break;
				case 1: vertices.push(u, w, v); break;
				case 2: vertices.push(u, v, w); break;
			}
		}

		function addFace(name, uv_offset, axis, side) {

			var start = getVector2(from, axis)
			var end = getVector2(to, axis)
			var face = cube.faces[name];
			var texture = face.getTexture();
			if (texture == null) return;

			var px_x = texture ? Project.texture_width / texture.width : 1;
			var px_y = texture ? Project.texture_height / texture.height : 1;
			var uv_size = [
				Math.abs(face.uv_size[0]),
				Math.abs(face.uv_size[1])
			]
			uv_offset = [
				uv_offset[0] == true
					? (face.uv_size[0] > 0 ? (px_x-face.uv[2]) : (	   face.uv[2]))
					: (face.uv_size[0] > 0 ? (     face.uv[0]) : (px_x-face.uv[0])),
				uv_offset[1] == true
					? (face.uv_size[1] > 0 ? (px_y-face.uv[3]) : (	   face.uv[3]))
					: (face.uv_size[1] > 0 ? (     face.uv[1]) : (px_y-face.uv[1]))
			]
			uv_offset[0] = uv_offset[0] % px_x;
			uv_offset[1] = uv_offset[1] % px_y;
			
			if ((face.rotation % 180 == 90) != (axis == 0)) {
				uv_size.reverse();
				uv_offset.reverse();
			}

			var w = side == 0 ? from[axis] : to[axis]

			//Columns
			var width = end[0]-start[0];
			var step = Math.abs( width / uv_size[0] );
			if (texture) step *= Project.texture_width / texture.width;
			if (step < epsilon) step = epsilon;

			for (var col = start[0] - uv_offset[0]; col <= end[0]; col += step) {
				if (col >= start[0]) {
					addVector(col, start[1], axis, w);
					addVector(col, end[1], axis, w);
				}
			}

			//lines
			var height = end[1]-start[1];
			var step = Math.abs( height / uv_size[1] );
			let tex_height = texture.frameCount ? (texture.height / texture.frameCount) : texture.height;
			if (texture) step *= Project.texture_height / tex_height;
			if (step < epsilon) step = epsilon;

			for (var line = start[1] - uv_offset[1]; line <= end[1]; line += step) {
				if (line >= start[1]) {
					addVector(start[0], line, axis, w);
					addVector(end[0], line, axis, w);
				}
			}
		}

		addFace('north', [true,  true],  2, 0);
		addFace('south', [false, true],  2, 1);
		addFace('west',  [false, true],  0, 0);
		addFace('east',  [true,  true],  0, 1);
		addFace('down',  [false, true],  1, 0);
		addFace('up',    [false, false], 1, 1);


		var geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );

		var lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color: gizmo_colors.grid}));
		lines.geometry.translate(-cube.origin[0], -cube.origin[1], -cube.origin[2]);
		lines.no_export = true;

		return lines;
	},
	updatePaintingGrid() {
		Cube.all.forEach(cube => {
			Canvas.buildGridBox(cube)
		})
	},

	getModelSize() {
		var visible_box = new THREE.Box3()
		Canvas.withoutGizmos(() => {
			Cube.all.forEach(cube => {
				if (cube.export && cube.mesh) {
					visible_box.expandByObject(cube.mesh);
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
