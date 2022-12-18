BARS.defineActions(function() {
	let add_mesh_dialog = new Dialog({
		id: 'add_primitive',
		title: 'action.add_mesh',
		form: {
			shape: {label: 'dialog.add_primitive.shape', type: 'select', options: {
				cube: 'dialog.add_primitive.shape.cube',
				pyramid: 'dialog.add_primitive.shape.pyramid',
				plane: 'dialog.add_primitive.shape.plane',
				circle: 'dialog.add_primitive.shape.circle',
				cylinder: 'dialog.add_primitive.shape.cylinder',
				tube: 'dialog.add_primitive.shape.tube',
				cone: 'dialog.add_primitive.shape.cone',
				sphere: 'dialog.add_primitive.shape.sphere',
				torus: 'dialog.add_primitive.shape.torus',
			}},
			diameter: {label: 'dialog.add_primitive.diameter', type: 'number', value: 16},
			align_edges: {label: 'dialog.add_primitive.align_edges', type: 'checkbox', value: true, condition: ({shape}) => !['cube', 'pyramid', 'plane'].includes(shape)},
			height: {label: 'dialog.add_primitive.height', type: 'number', value: 8, condition: ({shape}) => ['cylinder', 'cone', 'cube', 'pyramid', 'tube'].includes(shape)},
			sides: {label: 'dialog.add_primitive.sides', type: 'number', value: 12, min: 3, max: 48, condition: ({shape}) => ['cylinder', 'cone', 'circle', 'torus', 'sphere', 'tube'].includes(shape)},
			minor_diameter: {label: 'dialog.add_primitive.minor_diameter', type: 'number', value: 4, condition: ({shape}) => ['torus', 'tube'].includes(shape)},
			minor_sides: {label: 'dialog.add_primitive.minor_sides', type: 'number', value: 8, min: 2, max: 32, condition: ({shape}) => ['torus'].includes(shape)},
		},
		onConfirm(result) {
			let original_selection_group = Group.selected && Group.selected.uuid;
			function runEdit(amended, result) {
				let elements = [];
				if (original_selection_group && !Group.selected) {
					let group_to_select = Group.all.find(g => g.uuid == original_selection_group);
					if (group_to_select) {
						Group.selected = group_to_select;
					}
				}
				Undo.initEdit({elements, selection: true}, amended);
				let mesh = new Mesh({
					name: result.shape,
					vertices: {}
				});
				var group = getCurrentGroup();
				mesh.addTo(group)
				let diameter_factor = result.align_edges ? 1 / Math.cos(Math.PI/result.sides) : 1;
				let off_ang = result.align_edges ? 0.5 : 0;

				if (result.shape == 'circle') {
					let vertex_keys = mesh.addVertices([0, 0, 0]);
					let [m] = vertex_keys;

					for (let i = 0; i < result.sides; i++) {
						let x = Math.sin(((i+off_ang) / result.sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
						let z = Math.cos(((i+off_ang) / result.sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
						vertex_keys.push(...mesh.addVertices([x, 0, z]));
					}
					for (let i = 0; i < result.sides; i++) {
						let [a, b] = vertex_keys.slice(i+2, i+2 + 2);
						if (!a) {
							b = vertex_keys[2];
							a = vertex_keys[1];
						} else if (!b) {
							b = vertex_keys[1];
						}
						mesh.addFaces(new MeshFace( mesh, {vertices: [a, b, m]} ));
					}
				}
				if (result.shape == 'cone') {
					let vertex_keys = mesh.addVertices([0, 0, 0], [0, result.height, 0]);
					let [m0, m1] = vertex_keys;

					for (let i = 0; i < result.sides; i++) {
						let x = Math.sin(((i+off_ang) / result.sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
						let z = Math.cos(((i+off_ang) / result.sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
						vertex_keys.push(...mesh.addVertices([x, 0, z]));
					}
					for (let i = 0; i < result.sides; i++) {
						let [a, b] = vertex_keys.slice(i+2, i+2 + 2);
						if (!b) {
							b = vertex_keys[2];
						}
						mesh.addFaces(
							new MeshFace( mesh, {vertices: [b, a, m0]} ),
							new MeshFace( mesh, {vertices: [a, b, m1]} )
						);
					}
				}
				if (result.shape == 'cylinder') {
					let vertex_keys = mesh.addVertices([0, 0, 0], [0, result.height, 0]);
					let [m0, m1] = vertex_keys;

					for (let i = 0; i < result.sides; i++) {
						let x = Math.sin(((i+off_ang) / result.sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
						let z = Math.cos(((i+off_ang) / result.sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
						vertex_keys.push(...mesh.addVertices([x, 0, z], [x, result.height, z]));
					}
					for (let i = 0; i < result.sides; i++) {
						let [a, b, c, d] = vertex_keys.slice(2*i+2, 2*i+2 + 4);
						if (!c) {
							c = vertex_keys[2];
							d = vertex_keys[3];
						}
						mesh.addFaces(
							new MeshFace( mesh, {vertices: [c, a, m0]}),
							new MeshFace( mesh, {vertices: [a, c, d, b]} ),
							new MeshFace( mesh, {vertices: [b, d, m1]} )
						);
					}
				}
				if (result.shape == 'tube') {
					let vertex_keys = [];

					let outer_r = result.diameter/2 * diameter_factor;
					let inner_r = (outer_r - result.minor_diameter/2) * diameter_factor;
					for (let i = 0; i < result.sides; i++) {
						let x = Math.sin(((i+off_ang) / result.sides) * Math.PI * 2);
						let z = Math.cos(((i+off_ang) / result.sides) * Math.PI * 2);
						vertex_keys.push(...mesh.addVertices(
							[x * outer_r, 0, z * outer_r],
							[x * outer_r, result.height, z * outer_r],
							[x * inner_r, 0, z * inner_r],
							[x * inner_r, result.height, z * inner_r],
						));
					}
					for (let i = 0; i < result.sides; i++) {
						let [a1, b1, c1, d1, a2, b2, c2, d2] = vertex_keys.slice(4*i, 4*i + 8);
						if (!a2) {
							a2 = vertex_keys[0];
							b2 = vertex_keys[1];
							c2 = vertex_keys[2];
							d2 = vertex_keys[3];
						}
						if (a1 && b1 && c1 && d1 && a2 && b2 && c2 && d2) {
							mesh.addFaces(
								new MeshFace( mesh, {vertices: [a1, a2, b2, b1]} ),
								new MeshFace( mesh, {vertices: [d1, d2, c2, c1]} ),
								new MeshFace( mesh, {vertices: [c1, c2, a2, a1]} ),
								new MeshFace( mesh, {vertices: [b1, b2, d2, d1]} ),
							);
						}
					}
				}
				if (result.shape == 'torus') {
					let rings = [];

					for (let i = 0; i < result.sides; i++) {
						let circle_x = Math.sin(((i+off_ang) / result.sides) * Math.PI * 2);
						let circle_z = Math.cos(((i+off_ang) / result.sides) * Math.PI * 2);

						let vertices = [];
						for (let j = 0; j < result.minor_sides; j++) {
							let slice_x = Math.sin((j / result.minor_sides) * Math.PI * 2) * result.minor_diameter/2*diameter_factor;
							let x = circle_x * (result.diameter/2*diameter_factor + slice_x)
							let y = Math.cos((j / result.minor_sides) * Math.PI * 2) * result.minor_diameter/2*diameter_factor;
							let z = circle_z * (result.diameter/2*diameter_factor + slice_x)
							vertices.push(...mesh.addVertices([x, y, z]));
						}
						rings.push(vertices);

					}
					
					for (let i = 0; i < result.sides; i++) {
						let this_ring = rings[i];
						let next_ring = rings[i+1] || rings[0];
						for (let j = 0; j < result.minor_sides; j++) {
							mesh.addFaces(new MeshFace( mesh, {vertices: [
								this_ring[j+1] || this_ring[0],
								next_ring[j+1] || next_ring[0],
								this_ring[j],
								next_ring[j],
							]} ));
						}
					}
				}
				if (result.shape == 'sphere') {
					let rings = [];
					let sides = Math.round(result.sides/2)*2;
					let [bottom] = mesh.addVertices([0, -result.diameter/2, 0]);
					let [top] = mesh.addVertices([0, result.diameter/2, 0]);

					for (let i = 0; i < result.sides; i++) {
						let circle_x = Math.sin(((i+off_ang) / result.sides) * Math.PI * 2);
						let circle_z = Math.cos(((i+off_ang) / result.sides) * Math.PI * 2);

						let vertices = [];
						for (let j = 1; j < (sides/2); j++) {

							let slice_x = Math.sin((j / sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
							let x = circle_x * slice_x
							let y = Math.cos((j / sides) * Math.PI * 2) * result.diameter/2;
							let z = circle_z * slice_x
							vertices.push(...mesh.addVertices([x, y, z]));
						}
						rings.push(vertices);

					}
					
					for (let i = 0; i < result.sides; i++) {
						let this_ring = rings[i];
						let next_ring = rings[i+1] || rings[0];
						for (let j = 0; j < (sides/2); j++) {
							if (j == 0) {
								mesh.addFaces(new MeshFace( mesh, {vertices: [
									this_ring[j],
									next_ring[j],
									top
								]} ));
							} else if (!this_ring[j]) {
								mesh.addFaces(new MeshFace( mesh, {vertices: [
									next_ring[j-1],
									this_ring[j-1],
									bottom
								]} ));
							} else {
								mesh.addFaces(new MeshFace( mesh, {vertices: [
									this_ring[j],
									next_ring[j],
									this_ring[j-1],
									next_ring[j-1],
								]} ));
							}
						}
					}
				}
				if (result.shape == 'cube') {
					let r = result.diameter/2;
					let h = result.height;
					mesh.addVertices([r, h, r], [r, h, -r], [r, 0, r], [r, 0, -r], [-r, h, r], [-r, h, -r], [-r, 0, r], [-r, 0, -r]);
					let vertex_keys = Object.keys(mesh.vertices);
					mesh.addFaces(
						new MeshFace( mesh, {vertices: [vertex_keys[0], vertex_keys[2], vertex_keys[1], vertex_keys[3]]} ), // East
						new MeshFace( mesh, {vertices: [vertex_keys[4], vertex_keys[5], vertex_keys[6], vertex_keys[7]]} ), // West
						new MeshFace( mesh, {vertices: [vertex_keys[0], vertex_keys[1], vertex_keys[4], vertex_keys[5]]} ), // Up
						new MeshFace( mesh, {vertices: [vertex_keys[2], vertex_keys[6], vertex_keys[3], vertex_keys[7]]} ), // Down
						new MeshFace( mesh, {vertices: [vertex_keys[0], vertex_keys[4], vertex_keys[2], vertex_keys[6]]} ), // South
						new MeshFace( mesh, {vertices: [vertex_keys[1], vertex_keys[3], vertex_keys[5], vertex_keys[7]]} ), // North
					);
				}
				if (result.shape == 'pyramid') {
					let r = result.diameter/2;
					let h = result.height;
					mesh.addVertices([0, h, 0], [r, 0, r], [r, 0, -r], [-r, 0, r], [-r, 0, -r]);
					let vertex_keys = Object.keys(mesh.vertices);
					mesh.addFaces(
						new MeshFace( mesh, {vertices: [vertex_keys[1], vertex_keys[3], vertex_keys[2], vertex_keys[4]]} ),	// Down
						new MeshFace( mesh, {vertices: [vertex_keys[1], vertex_keys[2], vertex_keys[0]]} ),	// east
						new MeshFace( mesh, {vertices: [vertex_keys[3], vertex_keys[1], vertex_keys[0]]} ),	// south
						new MeshFace( mesh, {vertices: [vertex_keys[2], vertex_keys[4], vertex_keys[0]]} ),	// north
						new MeshFace( mesh, {vertices: [vertex_keys[4], vertex_keys[3], vertex_keys[0]]} ),	// west
					);
				}
				if (result.shape == 'plane') {
					let r = result.diameter/2;
					mesh.addVertices([r, 0, r], [r, 0, -r], [-r, 0, r], [-r, 0, -r]);
					let vertex_keys = Object.keys(mesh.vertices);
					mesh.addFaces(
						new MeshFace( mesh, {vertices: [vertex_keys[0], vertex_keys[1], vertex_keys[3], vertex_keys[2]]} )
					);
				}
				
				if (Texture.all.length && Format.single_texture) {
					for (var face in mesh.faces) {
						mesh.faces[face].texture = Texture.getDefault().uuid
					}
					UVEditor.loadData()
				}
				if (Format.bone_rig) {
					if (group) {
						var pos1 = group.origin.slice()
						mesh.extend({
							origin: pos1.slice()
						})
					}
				}

				elements.push(mesh);
				mesh.init()
				if (Group.selected) Group.selected.unselect()
				mesh.select()
				UVEditor.setAutoSize(null, true, Object.keys(mesh.faces));
				UVEditor.selected_faces.empty();
				Undo.finishEdit('Add primitive');
				Blockbench.dispatchEvent( 'add_mesh', {object: mesh} )

				Vue.nextTick(function() {
					if (settings.create_rename.value) {
						mesh.rename()
					}
				})
			}
			runEdit(false, result);

			Undo.amendEdit({
				diameter: {label: 'dialog.add_primitive.diameter', type: 'number', value: result.diameter, interval_type: 'position'},
				height: {label: 'dialog.add_primitive.height', type: 'number', value: result.height, condition: ['cylinder', 'cone', 'cube', 'pyramid', 'tube'].includes(result.shape), interval_type: 'position'},
				sides: {label: 'dialog.add_primitive.sides', type: 'number', value: result.sides, min: 3, max: 48, condition: ['cylinder', 'cone', 'circle', 'torus', 'sphere', 'tube'].includes(result.shape)},
				minor_diameter: {label: 'dialog.add_primitive.minor_diameter', type: 'number', value: result.minor_diameter, condition: ['torus', 'tube'].includes(result.shape), interval_type: 'position'},
				minor_sides: {label: 'dialog.add_primitive.minor_sides', type: 'number', value: result.minor_sides, min: 2, max: 32, condition: ['torus'].includes(result.shape)},
			}, form => {
				Object.assign(result, form);
				runEdit(true, result);
			})
		}
	})

	new Action('add_mesh', {
		icon: 'fa-gem',
		category: 'edit',
		condition: {modes: ['edit'], method: () => (Format.meshes)},
		click: function () {
			add_mesh_dialog.show();
		}
	})
	new BarSelect('selection_mode', {
		options: {
			object: {name: true, icon: 'far.fa-gem'},
			face: {name: true, icon: 'crop_portrait'},
			edge: {name: true, icon: 'fa-grip-lines-vertical'},
			vertex: {name: true, icon: 'fiber_manual_record'},
		},
		icon_mode: true,
		condition: () => Modes.edit && Mesh.all.length,
		onChange({value}) {
			if (value === 'object') {
				Mesh.selected.forEach(mesh => {
					delete Project.selected_vertices[mesh.uuid];
				})
			} else if (value === 'face') {
				UVEditor.vue.selected_faces.empty();
				Mesh.selected.forEach(mesh => {
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						if (face.isSelected()) {
							UVEditor.vue.selected_faces.safePush(fkey);
						}
					}
				})
			}
			updateSelection();
		}
	})
	
	let seam_timeout;
	new Tool('seam_tool', {
		icon: 'content_cut',
		transformerMode: 'hidden',
		toolbar: 'seam_tool',
		category: 'tools',
		selectElements: true,
		modes: ['edit'],
		condition: () => Modes.edit && Mesh.all.length,
		onCanvasClick(data) {
			if (!seam_timeout) {
				seam_timeout = setTimeout(() => {
					seam_timeout = null;
				}, 200)
			} else {
				clearTimeout(seam_timeout);
				seam_timeout = null;
				BarItems.select_seam.trigger();
			}
		},
		onSelect: function() {
			BarItems.selection_mode.set('edge');
			BarItems.view_mode.set('solid');
			BarItems.view_mode.onChange();
		},
		onUnselect: function() {
			BarItems.selection_mode.set('object');
			BarItems.view_mode.set('textured');
			BarItems.view_mode.onChange();
		}
	})
	new BarSelect('select_seam', {
		options: {
			auto: true,
			divide: true,
			join: true,
		},
		condition: () => Modes.edit && Mesh.all.length,
		onChange({value}) {
			if (value == 'auto') value = null;
			Undo.initEdit({elements: Mesh.selected});
			Mesh.selected.forEach(mesh => {
				let selected_vertices = mesh.getSelectedVertices();
				mesh.forAllFaces((face) => {
					let vertices = face.getSortedVertices();
					vertices.forEach((vkey_a, i) => {
						let vkey_b = vertices[i+1] || vertices[0];
						if (selected_vertices.includes(vkey_a) && selected_vertices.includes(vkey_b)) {
							mesh.setSeam([vkey_a, vkey_b], value);
						}
					})
				});
				Mesh.preview_controller.updateSelection(mesh);
			})
			Undo.finishEdit('Set mesh seam');
		}
	})
	new Action('create_face', {
		icon: 'fas.fa-draw-polygon',
		category: 'edit',
		keybind: new Keybind({key: 'f', shift: true}),
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length > 1)},
		click() {
			let vec1 = new THREE.Vector3(),
				vec2 = new THREE.Vector3(),
				vec3 = new THREE.Vector3(),
				vec4 = new THREE.Vector3();
			Undo.initEdit({elements: Mesh.selected});
			let faces_to_autouv = [];
			Mesh.selected.forEach(mesh => {
				UVEditor.selected_faces.empty();
				let selected_vertices = mesh.getSelectedVertices();
				if (selected_vertices.length >= 2 && selected_vertices.length <= 4) {
					let reference_face;
					let reference_face_strength = 0;
					for (let key in mesh.faces) {
						let face = mesh.faces[key];
						let match_strength = face.vertices.filter(vkey => selected_vertices.includes(vkey)).length;
						if (match_strength > reference_face_strength) {
							reference_face = face;
							reference_face_strength = match_strength;
						}
						if (face.isSelected()) {
							delete mesh.faces[key];
						}
					}
					// Split face
					if (
						(selected_vertices.length == 2 || selected_vertices.length == 3) &&
						reference_face.vertices.length == 4 &&
						reference_face.vertices.filter(vkey => selected_vertices.includes(vkey)).length == selected_vertices.length
					) {

						let sorted_vertices = reference_face.getSortedVertices();
						let unselected_vertices = sorted_vertices.filter(vkey => !selected_vertices.includes(vkey));

						let side_index_diff = Math.abs(sorted_vertices.indexOf(selected_vertices[0]) - sorted_vertices.indexOf(selected_vertices[1]));
						if (side_index_diff != 1 || selected_vertices.length == 3) {

							let new_face = new MeshFace(mesh, reference_face);
							
							new_face.vertices.remove(unselected_vertices[0]);
							delete new_face.uv[unselected_vertices[0]];

							let reference_corner_vertex = unselected_vertices[1]
								|| sorted_vertices[sorted_vertices.indexOf(unselected_vertices[0]) + 2]
								|| sorted_vertices[sorted_vertices.indexOf(unselected_vertices[0]) - 2];
							reference_face.vertices.remove(reference_corner_vertex);
							delete reference_face.uv[reference_corner_vertex];

							let [face_key] = mesh.addFaces(new_face);
							UVEditor.selected_faces.push(face_key);


							if (reference_face.getAngleTo(new_face) > 90) {
								new_face.invert();
							}
						}

					} else {
						
						let new_face = new MeshFace(mesh, {
							vertices: selected_vertices,
							texture: reference_face.texture,
						} );
						let [face_key] = mesh.addFaces(new_face);
						UVEditor.selected_faces.push(face_key);
						faces_to_autouv.push(face_key);

						// Correct direction
						if (selected_vertices.length > 2) {
							// find face with shared line to compare
							let fixed_via_face;
							for (let key in mesh.faces) {
								let face = mesh.faces[key];
								let common = face.vertices.filter(vertex_key => selected_vertices.includes(vertex_key))
								if (common.length == 2) {
									let old_vertices = face.getSortedVertices();
									let new_vertices = new_face.getSortedVertices();
									let index_diff = old_vertices.indexOf(common[0]) - old_vertices.indexOf(common[1]);
									let new_index_diff = new_vertices.indexOf(common[0]) - new_vertices.indexOf(common[1]);
									if (index_diff == 1 - face.vertices.length) index_diff = 1;
									if (new_index_diff == 1 - new_face.vertices.length) new_index_diff = 1;

									if (Math.abs(index_diff) == 1 && Math.abs(new_index_diff) == 1) {
										if (index_diff == new_index_diff) {
											new_face.invert();
										}
										fixed_via_face = true;
										break;
									}
								}
							}
							// If no face available, orient based on camera orientation
							if (!fixed_via_face) {
								let normal = new THREE.Vector3().fromArray(new_face.getNormal());
								normal.applyQuaternion(mesh.mesh.getWorldQuaternion(new THREE.Quaternion()))
								let cam_direction = Preview.selected.camera.getWorldDirection(new THREE.Vector3());
								let angle = normal.angleTo(cam_direction);
								if (angle < Math.PI/2) {
									new_face.invert();
								}
							}
						}
					}
				} else if (selected_vertices.length > 4) {
					let reference_face;
					for (let key in mesh.faces) {
						let face = mesh.faces[key];
						if (!reference_face && face.vertices.find(vkey => selected_vertices.includes(vkey))) {
							reference_face = face;
						}
					}
					let vertices = selected_vertices.slice();
					let v1 = vec1.fromArray(mesh.vertices[vertices[1]].slice().V3_subtract(mesh.vertices[vertices[0]]));
					let v2 = vec2.fromArray(mesh.vertices[vertices[2]].slice().V3_subtract(mesh.vertices[vertices[0]]));
					let normal = v2.cross(v1);
					let plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
						normal,
						new THREE.Vector3().fromArray(mesh.vertices[vertices[0]])
					)
					let center = [0, 0];
					let vertex_uvs = {};
					vertices.forEach((vkey) => {
						let coplanar_pos = plane.projectPoint(vec3.fromArray(mesh.vertices[vkey]), vec4);
						let q = Reusable.quat1.setFromUnitVectors(normal, THREE.NormalY)
						coplanar_pos.applyQuaternion(q);
						vertex_uvs[vkey] = [
							Math.roundTo(coplanar_pos.x, 4),
							Math.roundTo(coplanar_pos.z, 4),
						]
						center[0] += vertex_uvs[vkey][0];
						center[1] += vertex_uvs[vkey][1];
					})
					center[0] /= vertices.length;
					center[1] /= vertices.length;

					vertices.forEach(vkey => {
						vertex_uvs[vkey][0] -= center[0];
						vertex_uvs[vkey][1] -= center[1];
						vertex_uvs[vkey][2] = Math.atan2(vertex_uvs[vkey][0], vertex_uvs[vkey][1]);
					})
					vertices.sort((a, b) => vertex_uvs[a][2] - vertex_uvs[b][2]);

					let start_index = 0;
					while (start_index < vertices.length) {
						let face_vertices = vertices.slice(start_index, start_index+4);
						vertices.push(face_vertices[0]);
						let new_face = new MeshFace(mesh, {vertices: face_vertices, texture: reference_face.texture});
						let [face_key] = mesh.addFaces(new_face);
						UVEditor.selected_faces.push(face_key);

						if (face_vertices.length < 4) break;
						start_index += 3;
					}
				}
			})
			UVEditor.setAutoSize(null, true, faces_to_autouv);
			Undo.finishEdit('Create mesh face')
			Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
	new Action('convert_to_mesh', {
		icon: 'fa-gem',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Cube.selected.length)},
		click() {
			Undo.initEdit({elements: Cube.selected});

			let new_meshes = [];
			Cube.selected.forEach(cube => {
				
				let mesh = new Mesh({
					name: cube.name,
					color: cube.color,
					origin: cube.origin,
					rotation: cube.rotation,
					vertices: [
						[cube.to[0] + cube.inflate - cube.origin[0],	cube.to[1] + cube.inflate - cube.origin[1], 	cube.to[2] + cube.inflate - cube.origin[2]],
						[cube.to[0] + cube.inflate - cube.origin[0],	cube.to[1] + cube.inflate - cube.origin[1], 	cube.from[2] - cube.inflate - cube.origin[2]],
						[cube.to[0] + cube.inflate - cube.origin[0],	cube.from[1] - cube.inflate - cube.origin[1], 	cube.to[2] + cube.inflate - cube.origin[2]],
						[cube.to[0] + cube.inflate - cube.origin[0],	cube.from[1] - cube.inflate - cube.origin[1], 	cube.from[2] - cube.inflate - cube.origin[2]],
						[cube.from[0] - cube.inflate - cube.origin[0],	cube.to[1] + cube.inflate - cube.origin[1], 	cube.to[2] + cube.inflate - cube.origin[2]],
						[cube.from[0] - cube.inflate - cube.origin[0],	cube.to[1] + cube.inflate - cube.origin[1], 	cube.from[2] - cube.inflate - cube.origin[2]],
						[cube.from[0] - cube.inflate - cube.origin[0],	cube.from[1] - cube.inflate - cube.origin[1], 	cube.to[2] + cube.inflate - cube.origin[2]],
						[cube.from[0] - cube.inflate - cube.origin[0],	cube.from[1] - cube.inflate - cube.origin[1], 	cube.from[2] - cube.inflate - cube.origin[2]],
					],
				})

				let vertex_keys = Object.keys(mesh.vertices);
				let unused_vkeys = vertex_keys.slice();
				function addFace(direction, vertices) {
					let cube_face = cube.faces[direction];
					if (cube_face.texture === null) return;
					let uv = {
						[vertices[0]]: [cube_face.uv[2], cube_face.uv[1]],
						[vertices[1]]: [cube_face.uv[0], cube_face.uv[1]],
						[vertices[2]]: [cube_face.uv[2], cube_face.uv[3]],
						[vertices[3]]: [cube_face.uv[0], cube_face.uv[3]],
					};
					mesh.addFaces(
						new MeshFace( mesh, {
							vertices,
							uv,
							texture: cube_face.texture,
						}
					));
					vertices.forEach(vkey => unused_vkeys.remove(vkey));
				}
				addFace('east', [vertex_keys[1], vertex_keys[0], vertex_keys[3], vertex_keys[2]]);
				addFace('west', [vertex_keys[4], vertex_keys[5], vertex_keys[6], vertex_keys[7]]);
				addFace('up', [vertex_keys[1], vertex_keys[5], vertex_keys[0], vertex_keys[4]]); // 4 0 5 1
				addFace('down', [vertex_keys[2], vertex_keys[6], vertex_keys[3], vertex_keys[7]]);
				addFace('south', [vertex_keys[0], vertex_keys[4], vertex_keys[2], vertex_keys[6]]);
				addFace('north', [vertex_keys[5], vertex_keys[1], vertex_keys[7], vertex_keys[3]]);

				unused_vkeys.forEach(vkey => {
					delete mesh.vertices[vkey];
				})

				mesh.sortInBefore(cube).init();
				new_meshes.push(mesh);
				selected.push(mesh);
				cube.remove();
			})
			updateSelection();
			Undo.finishEdit('Convert cubes to meshes', {elements: new_meshes});
		}
	})
	new Action('invert_face', {
		icon: 'flip_to_back',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedFaces().length)},
		click() {
			Undo.initEdit({elements: Mesh.selected});
			Mesh.selected.forEach(mesh => {
				for (let key in mesh.faces) {
					let face = mesh.faces[key];
					if (face.isSelected()) {
						face.invert();
					}
				}
			})
			Undo.finishEdit('Invert mesh faces');
			Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}});
		}
	})
	new Action('extrude_mesh_selection', {
		icon: 'upload',
		category: 'edit',
		keybind: new Keybind({key: 'e', shift: true}),
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length)},
		click() {
			function runEdit(amended, extend = 1) {
				Undo.initEdit({elements: Mesh.selected, selection: true}, amended);

				Mesh.selected.forEach(mesh => {
					let original_vertices = Project.selected_vertices[mesh.uuid].slice();
					let new_vertices;
					let new_face_keys = [];
					let selected_faces = [];
					let selected_face_keys = [];
					let combined_direction;
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey]; 
						if (face.isSelected()) {
							selected_faces.push(face);
							selected_face_keys.push(fkey);
						}
					}

					if (original_vertices.length >= 3 && !selected_faces.length) {
						let [a, b, c] = original_vertices.slice(0, 3).map(vkey => mesh.vertices[vkey].slice());
						let normal = new THREE.Vector3().fromArray(a.V3_subtract(c));
						normal.cross(new THREE.Vector3().fromArray(b.V3_subtract(c))).normalize();

						let face;
						for (let fkey in mesh.faces) {
							if (mesh.faces[fkey].vertices.filter(vkey => original_vertices.includes(vkey)).length >= 2 && mesh.faces[fkey].vertices.length > 2) {
								face = mesh.faces[fkey];
								break;
							}
						}
						if (face) {
							let selected_corner = mesh.vertices[face.vertices.find(vkey => original_vertices.includes(vkey))];
							let opposite_corner = mesh.vertices[face.vertices.find(vkey => !original_vertices.includes(vkey))];
							let face_geo_dir = opposite_corner.slice().V3_subtract(selected_corner);
							if (Reusable.vec1.fromArray(face_geo_dir).angleTo(normal) < 1) {
								normal.negate();
							}
						}

						combined_direction = normal.toArray();
					}

					new_vertices = mesh.addVertices(...original_vertices.map(key => {
						let vector = mesh.vertices[key].slice();
						let direction;
						let count = 0;
						selected_faces.forEach(face => {
							if (face.vertices.includes(key)) {
								count++;
								if (!direction) {
									direction = face.getNormal(true);
								} else {
									direction.V3_add(face.getNormal(true));
								}
							}
						})
						if (count > 1) {
							direction.V3_divide(count);
						}
						if (!direction) {
							let match;
							let match_level = 0;
							let match_count = 0;
							for (let key in mesh.faces) {
								let face = mesh.faces[key]; 
								let matches = face.vertices.filter(vkey => original_vertices.includes(vkey));
								if (match_level < matches.length) {
									match_level = matches.length;
									match_count = 1;
									match = face;
								} else if (match_level === matches.length) {
									match_count++;
								}
								if (match_level == 3) break;
							}
							
							if (match_level < 3 && match_count > 2 && original_vertices.length > 2) {
								// If multiple faces connect to the line, there is no point in choosing one for the normal
								// Instead, construct the normal between the first 2 selected vertices
								direction = combined_direction;

							} else if (match) {
								direction = match.getNormal(true);
							}
						}

						vector.V3_add(direction.map(v => v * extend));
						return vector;
					}))
					Project.selected_vertices[mesh.uuid].replace(new_vertices);

					// Move Faces
					selected_faces.forEach(face => {
						face.vertices.forEach((key, index) => {
							face.vertices[index] = new_vertices[original_vertices.indexOf(key)];
							let uv = face.uv[key];
							delete face.uv[key];
							face.uv[face.vertices[index]] = uv;
						})
					})

					// Create extra quads on sides
					let remaining_vertices = new_vertices.slice();
					selected_faces.forEach((face, face_index) => {
						let vertices = face.getSortedVertices();
						vertices.forEach((a, i) => {
							let b = vertices[i+1] || vertices[0];
							if (vertices.length == 2 && i) return; // Only create one quad when extruding line
							if (selected_faces.find(f => f != face && f.vertices.includes(a) && f.vertices.includes(b))) return;

							let new_face = new MeshFace(mesh, mesh.faces[selected_face_keys[face_index]]).extend({
								vertices: [
									b,
									a,
									original_vertices[new_vertices.indexOf(a)],
									original_vertices[new_vertices.indexOf(b)],
								]
							});
							let [face_key] = mesh.addFaces(new_face);
							new_face_keys.push(face_key);
							remaining_vertices.remove(a);
							remaining_vertices.remove(b);
						})

						if (vertices.length == 2) delete mesh.faces[selected_face_keys[face_index]];
					})

					// Create Face between extruded line
					let line_vertices = remaining_vertices.slice();
					let covered_edges = [];
					let new_faces = [];
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						let sorted_vertices = face.getSortedVertices();
						let matched_vertices = sorted_vertices.filter(vkey => line_vertices.includes(new_vertices[original_vertices.indexOf(vkey)]));
						if (matched_vertices.length >= 2) {
							let already_handled_edge = covered_edges.find(edge => edge.includes(matched_vertices[0]) && edge.includes(matched_vertices[1]))
							if (already_handled_edge) {
								let handled_face = new_faces[covered_edges.indexOf(already_handled_edge)]
								if (handled_face) handled_face.invert();
								continue;
							}
							covered_edges.push(matched_vertices.slice(0, 2));

							if (sorted_vertices[0] == matched_vertices[0] && sorted_vertices[1] != matched_vertices[1]) {
								matched_vertices.reverse();
							}
							let [a, b] = matched_vertices.map(vkey => new_vertices[original_vertices.indexOf(vkey)]);
							let [c, d] = matched_vertices;
							let new_face = new MeshFace(mesh, face).extend({
								vertices: [a, b, c, d]
							});
							let [face_key] = mesh.addFaces(new_face);
							new_face_keys.push(face_key);
							new_faces.push(new_face);
							remaining_vertices.remove(a);
							remaining_vertices.remove(b);
						}
					}

					// Create line between points
					remaining_vertices.forEach(a => {
						let b = original_vertices[new_vertices.indexOf(a)]
						let b_in_face = false;
						mesh.forAllFaces(face => {
							if (face.vertices.includes(b)) b_in_face = true;
						})
						if (selected_faces.find(f => f.vertices.includes(a)) && !b_in_face) {
							// Remove line if in the middle of other faces
							delete mesh.vertices[b];
						} else {
							let new_face = new MeshFace(mesh, {
								vertices: [b, a]
							});
							mesh.addFaces(new_face);
						}
					})

					UVEditor.setAutoSize(null, true, new_face_keys);
				})
				Undo.finishEdit('Extrude mesh selection');
				Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true});
			}
			runEdit();

			Undo.amendEdit({
				extend: {type: 'number', value: 1, label: 'edit.extrude_mesh_selection.extend', interval_type: 'position'},
			}, form => {
				runEdit(true, form.extend);
			})
		}
	})
	new Action('inset_mesh_selection', {
		icon: 'fa-compress-arrows-alt',
		category: 'edit',
		keybind: new Keybind({key: 'i', shift: true}),
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length >= 3)},
		click() {
			function runEdit(amended, offset = 50) {
				Undo.initEdit({elements: Mesh.selected, selection: true}, amended);
				Mesh.selected.forEach(mesh => {
					let original_vertices = Project.selected_vertices[mesh.uuid].slice();
					if (original_vertices.length < 3) return;
					let new_vertices;
					let selected_faces = [];
					let selected_face_keys = [];
					for (let key in mesh.faces) {
						let face = mesh.faces[key]; 
						if (face.isSelected()) {
							selected_faces.push(face);
							selected_face_keys.push(key);
						}
					}
	
					new_vertices = mesh.addVertices(...original_vertices.map(vkey => {
						let vector = mesh.vertices[vkey].slice();
						affected_faces = selected_faces.filter(face => {
							return face.vertices.includes(vkey)
						})
						if (affected_faces.length == 0) return;
						let inset = [0, 0, 0];
						if (affected_faces.length == 3 || affected_faces.length == 1) {
							affected_faces.sort((a, b) => {
								let ax = 0;
								a.vertices.forEach(vkey => {
									ax += affected_faces.filter(face => face.vertices.includes(vkey)).length;
								})
								let bx = 0;
								b.vertices.forEach(vkey => {
									bx += affected_faces.filter(face => face.vertices.includes(vkey)).length;
								})
								return bx - ax;
							})
							affected_faces[0].vertices.forEach(vkey2 => {
								inset.V3_add(mesh.vertices[vkey2]);
							})
							inset.V3_divide(affected_faces[0].vertices.length);
							vector = vector.map((v, i) => Math.lerp(v, inset[i], offset/100));
						}
						if (affected_faces.length == 2) {
							let vkey2 = affected_faces[0].vertices.find(_vkey => _vkey != vkey && affected_faces[1].vertices.includes(_vkey));
							
							vector = vector.map((v, i) => Math.lerp(v, mesh.vertices[vkey2][i], offset/200));
						}
						return vector;
					}).filter(vec => vec instanceof Array))
					if (!new_vertices.length) return;
	
					Project.selected_vertices[mesh.uuid].replace(new_vertices);
	
					// Move Faces
					selected_faces.forEach(face => {
						face.vertices.forEach((key, index) => {
							face.vertices[index] = new_vertices[original_vertices.indexOf(key)];
							let uv = face.uv[key];
							delete face.uv[key];
							face.uv[face.vertices[index]] = uv;
						})
					})
	
					// Create extra quads on sides
					let remaining_vertices = new_vertices.slice();
					selected_faces.forEach((face, face_index) => {
						let vertices = face.getSortedVertices();
						vertices.forEach((a, i) => {
							let b = vertices[i+1] || vertices[0];
							if (vertices.length == 2 && i) return; // Only create one quad when extruding line
							if (selected_faces.find(f => f != face && f.vertices.includes(a) && f.vertices.includes(b))) return;
	
							let new_face = new MeshFace(mesh, mesh.faces[selected_face_keys[face_index]]).extend({
								vertices: [
									b,
									a,
									original_vertices[new_vertices.indexOf(a)],
									original_vertices[new_vertices.indexOf(b)],
								]
							});
							mesh.addFaces(new_face);
							remaining_vertices.remove(a);
							remaining_vertices.remove(b);
						})
	
						if (vertices.length == 2) delete mesh.faces[selected_face_keys[face_index]];
					})
	
					remaining_vertices.forEach(a => {
						let b = original_vertices[new_vertices.indexOf(a)];
						for (let fkey in mesh.faces) {
							let face = mesh.faces[fkey];
							if (face.vertices.includes(b)) {
								face.vertices.splice(face.vertices.indexOf(b), 1, a);
								face.uv[a] = face.uv[b];
								delete face.uv[b];
							}
						}
						delete mesh.vertices[b];
					})

				})
				Undo.finishEdit('Extrude mesh selection')
				Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
			}
			runEdit();

			Undo.amendEdit({
				offset: {type: 'number', value: 50, label: 'edit.loop_cut.offset', min: 0, max: 100, interval_type: 'position'},
			}, form => {
				runEdit(true, form.offset);
			})
		}
	})
	new Action('loop_cut', {
		icon: 'carpenter',
		category: 'edit',
		keybind: new Keybind({key: 'r', shift: true}),
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length > 1)},
		click() {
			let selected_face;
			let saved_direction = 0;
			Mesh.selected.forEach(mesh => {
				if (!selected_face) {
					selected_face = mesh.faces[mesh.getSelectedFaces()[0]];
				}
			})
			function getLength(direction = 0) {
				if (selected_face) {
					let vertices = selected_face.getSortedVertices();
					let pos1 = Mesh.selected[0].vertices[vertices[(0 + direction) % selected_face.vertices.length]];
					let pos2 = Mesh.selected[0].vertices[vertices[(1 + direction) % selected_face.vertices.length]];
					return Math.sqrt(Math.pow(pos2[0] - pos1[0], 2) + Math.pow(pos2[1] - pos1[1], 2) + Math.pow(pos2[2] - pos1[2], 2));
				} else {
					let vertices = Mesh.selected[0].getSelectedVertices();
					let pos1 = Mesh.selected[0].vertices[vertices[0]];
					let pos2 = Mesh.selected[0].vertices[vertices[1]];
					return Math.sqrt(Math.pow(pos2[0] - pos1[0], 2) + Math.pow(pos2[1] - pos1[1], 2) + Math.pow(pos2[2] - pos1[2], 2));
				}
			}
			let length = getLength();

			function runEdit(amended, offset, direction = 0) {
				Undo.initEdit({elements: Mesh.selected, selection: true}, amended);
				if (offset == undefined) offset = Math.floor(length/2);
				Mesh.selected.forEach(mesh => {
					let selected_vertices = mesh.getSelectedVertices();
					let start_face;
					let start_face_quality = 1;
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						if (face.vertices.length < 2) continue;
						let vertices = face.vertices.filter(vkey => selected_vertices.includes(vkey))
						if (vertices.length > start_face_quality) {
							start_face = face;
							start_face_quality = vertices.length;
						}
					}
					if (!start_face) return;
					let processed_faces = [start_face];
					let center_vertices = {};

					function getCenterVertex(vertices) {
						let existing_key = center_vertices[vertices[0]] || center_vertices[vertices[1]];
						if (existing_key) return existing_key;

						let ratio = offset/length;
						let vector = mesh.vertices[vertices[0]].map((v, i) => Math.lerp(v, mesh.vertices[vertices[1]][i], ratio))
						let [vkey] = mesh.addVertices(vector);
						center_vertices[vertices[0]] = center_vertices[vertices[1]] = vkey;
						return vkey;
					}

					function splitFace(face, side_vertices, double_side) {
						processed_faces.push(face);
						let sorted_vertices = face.getSortedVertices();

						let side_index_diff = sorted_vertices.indexOf(side_vertices[0]) - sorted_vertices.indexOf(side_vertices[1]);
						if (side_index_diff == -1 || side_index_diff > 2) side_vertices.reverse();

						if (face.vertices.length == 4) {

							let opposite_vertices = sorted_vertices.filter(vkey => !side_vertices.includes(vkey));
							let opposite_index_diff = sorted_vertices.indexOf(opposite_vertices[0]) - sorted_vertices.indexOf(opposite_vertices[1]);
							if (opposite_index_diff == 1 || opposite_index_diff < -2) opposite_vertices.reverse();

							let center_vertices = [
								getCenterVertex(side_vertices),
								getCenterVertex(opposite_vertices)
							]

							let c1_uv_coords = [
								Math.lerp(face.uv[side_vertices[0]][0], face.uv[side_vertices[1]][0], offset/length),
								Math.lerp(face.uv[side_vertices[0]][1], face.uv[side_vertices[1]][1], offset/length),
							];
							let c2_uv_coords = [
								Math.lerp(face.uv[opposite_vertices[0]][0], face.uv[opposite_vertices[1]][0], offset/length),
								Math.lerp(face.uv[opposite_vertices[0]][1], face.uv[opposite_vertices[1]][1], offset/length),
							];

							let new_face = new MeshFace(mesh, face).extend({
								vertices: [side_vertices[1], center_vertices[0], center_vertices[1], opposite_vertices[1]],
								uv: {
									[side_vertices[1]]: face.uv[side_vertices[1]],
									[center_vertices[0]]: c1_uv_coords,
									[center_vertices[1]]: c2_uv_coords,
									[opposite_vertices[1]]: face.uv[opposite_vertices[1]],
								}
							})
							face.extend({
								vertices: [opposite_vertices[0], center_vertices[0], center_vertices[1], side_vertices[0]],
								uv: {
									[opposite_vertices[0]]: face.uv[opposite_vertices[0]],
									[center_vertices[0]]: c1_uv_coords,
									[center_vertices[1]]: c2_uv_coords,
									[side_vertices[0]]: face.uv[side_vertices[0]],
								}
							})
							mesh.addFaces(new_face);

							// Find next (and previous) face
							for (let fkey in mesh.faces) {
								let ref_face = mesh.faces[fkey];
								if (ref_face.vertices.length < 3 || processed_faces.includes(ref_face)) continue;
								let vertices = ref_face.vertices.filter(vkey => opposite_vertices.includes(vkey))
								if (vertices.length >= 2) {
									splitFace(ref_face, opposite_vertices, ref_face.vertices.length == 4);
									break;
								}
							}

							if (double_side) {
								for (let fkey in mesh.faces) {
									let ref_face = mesh.faces[fkey];
									if (ref_face.vertices.length < 3 || processed_faces.includes(ref_face)) continue;
									let vertices = ref_face.vertices.filter(vkey => side_vertices.includes(vkey))
									if (vertices.length >= 2) {
										let ref_sorted_vertices = ref_face.getSortedVertices();
										let ref_opposite_vertices = ref_sorted_vertices.filter(vkey => !side_vertices.includes(vkey));
										
										if(ref_opposite_vertices.length == 2)
										{
											splitFace(ref_face, ref_opposite_vertices, ref_face.vertices.length == 4);
											break;
										}
									}
								}
							}

						} else {
							let opposite_vertex = sorted_vertices.find(vkey => !side_vertices.includes(vkey));

							let center_vertex = getCenterVertex(side_vertices);

							let c1_uv_coords = [
								Math.lerp(face.uv[side_vertices[0]][0], face.uv[side_vertices[1]][0], offset/length),
								Math.lerp(face.uv[side_vertices[0]][1], face.uv[side_vertices[1]][1], offset/length),
							];

							let new_face = new MeshFace(mesh, face).extend({
								vertices: [side_vertices[1], center_vertex, opposite_vertex],
								uv: {
									[side_vertices[1]]: face.uv[side_vertices[1]],
									[center_vertex]: c1_uv_coords,
									[opposite_vertex]: face.uv[opposite_vertex],
								}
							})
							face.extend({
								vertices: [opposite_vertex, center_vertex, side_vertices[0]],
								uv: {
									[opposite_vertex]: face.uv[opposite_vertex],
									[center_vertex]: c1_uv_coords,
									[side_vertices[0]]: face.uv[side_vertices[0]],
								}
							})
							mesh.addFaces(new_face);
						}
					}

					let start_vertices = start_face.getSortedVertices().filter((vkey, i) => selected_vertices.includes(vkey));
					let start_edge = [start_vertices[direction % start_vertices.length], start_vertices[(direction+1) % start_vertices.length]];
					if (start_edge.length == 1) start_edge.splice(0, 0, start_vertices[0]);

					splitFace(start_face, start_edge, start_face.vertices.length == 4);

					selected_vertices.empty();
					for (let key in center_vertices) {
						selected_vertices.safePush(center_vertices[key]);
					}
				})
				Undo.finishEdit('Create loop cut')
				Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
			}

			runEdit();

			Undo.amendEdit({
				direction: {type: 'number', value: 0, label: 'edit.loop_cut.direction', condition: !!selected_face, min: 0},
				//cuts: {type: 'number', value: 1, label: 'edit.loop_cut.cuts', min: 0, max: 16},
				offset: {type: 'number', value: Math.floor(length/2), label: 'edit.loop_cut.offset', min: 0, max: length, interval_type: 'position'},
			}, (form, form_options) => {
				let direction = form.direction || 0;
				length = getLength(direction);

				form_options.offset.slider.settings.max = length;
				if(saved_direction !== direction)
				{
					form_options.offset.slider.value = Math.floor(length/2);
					form_options.offset.slider.update();
					saved_direction = direction;
				}

				if (form_options.direction) {
					form_options.direction.slider.value = direction % selected_face.vertices.length;
				}
				
				runEdit(true, form_options.offset.slider.value, form_options.direction ? form_options.direction.slider.value : 0);
			})
		}
	})
	new Action('dissolve_edges', {
		icon: 'border_vertical',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length > 1)},
		click() {
			Undo.initEdit({elements: Mesh.selected});
			Mesh.selected.forEach(mesh => {
				let selected_vertices = mesh.getSelectedVertices();
				let faces = Object.keys(mesh.faces);
				for (let fkey in mesh.faces) {
					let face = mesh.faces[fkey];
					let sorted_vertices = face.getSortedVertices();
					let side_vertices = faces.includes(fkey) && sorted_vertices.filter(vkey => selected_vertices.includes(vkey));
					if (side_vertices && side_vertices.length == 2) {
						if (side_vertices[0] == sorted_vertices[0] && side_vertices[1] == sorted_vertices.last()) {
							side_vertices.reverse();
						}
						let original_face_normal = face.getNormal(true);
						let index_difference = sorted_vertices.indexOf(side_vertices[1]) - sorted_vertices.indexOf(side_vertices[0]);
						if (index_difference == -1 || index_difference > 2) side_vertices.reverse();
						let other_face = face.getAdjacentFace(sorted_vertices.indexOf(side_vertices[0]));
						face.vertices.remove(...side_vertices);
						delete face.uv[side_vertices[0]];
						delete face.uv[side_vertices[1]];
						if (other_face) {
							let new_vertices = other_face.face.getSortedVertices().filter(vkey => !side_vertices.includes(vkey));
							face.vertices.push(...new_vertices);
							new_vertices.forEach(vkey => {
								face.uv[vkey] = other_face.face.uv[vkey];
							})
							delete mesh.faces[other_face.key];
						}
						faces.remove(fkey);
						if (Reusable.vec1.fromArray(face.getNormal(true)).angleTo(Reusable.vec2.fromArray(original_face_normal)) > Math.PI/2) {
							face.invert();
						}
						side_vertices.forEach(vkey => {
							let is_used;
							for (let fkey2 in mesh.faces) {
								if (mesh.faces[fkey2].vertices.includes(vkey)) {
									is_used = true;
									break;
								}
							}
							if (!is_used) {
								delete mesh.vertices[vkey];
								selected_vertices.remove(vkey);
							}
						})
					}
				}
			})
			Undo.finishEdit('Dissolve edges')
			Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
	function mergeVertices(by_distance, in_center) {
		let found = 0, result = 0;
		Undo.initEdit({elements: Mesh.selected});
		Mesh.selected.forEach(mesh => {
			let selected_vertices = mesh.getSelectedVertices();
			if (selected_vertices.length < 2) return;

			if (!by_distance) {
				let first_vertex = selected_vertices[0];
				if (in_center) {
					let center = [0, 0, 0];
					selected_vertices.forEach(vkey => {
						center.V3_add(mesh.vertices[vkey]);
					})
					center.V3_divide(selected_vertices.length);
					mesh.vertices[first_vertex].V3_set(center);

					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						let matches = selected_vertices.filter(vkey => face.vertices.includes(vkey));
						if (matches.length < 2) continue;
						let center = [0, 0];
						matches.forEach(vkey => {
							center[0] += face.uv[vkey][0];
							center[1] += face.uv[vkey][1];
						})
						center[0] /= matches.length;
						center[1] /= matches.length;
						matches.forEach(vkey => {
							face.uv[vkey][0] = center[0];
							face.uv[vkey][1] = center[1];
						})
					}
				}
				selected_vertices.forEach(vkey => {
					if (vkey == first_vertex) return;
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						let index = face.vertices.indexOf(vkey);
						if (index === -1) continue;

						if (face.vertices.includes(first_vertex)) {
							face.vertices.remove(vkey);
							delete face.uv[vkey];
							if (face.vertices.length < 2) {
								delete mesh.faces[fkey];
							}
						} else {
							let uv = face.uv[vkey];
							face.vertices.splice(index, 1, first_vertex);
							face.uv[first_vertex] = uv;
							delete face.uv[vkey];
						}
					}
					delete mesh.vertices[vkey];
				})
				selected_vertices.splice(1, selected_vertices.length);
				
			} else {

				let selected_vertices = mesh.getSelectedVertices().slice();
				if (selected_vertices.length < 2) return;
				let groups = {};
				let i = 0;
				while (selected_vertices[i]) {
					let vkey1 = selected_vertices[i];
					let j = i+1;
					while (selected_vertices[j]) {
						let vkey2 = selected_vertices[j];
						let vector1 = mesh.vertices[vkey1];
						let vector2 = mesh.vertices[vkey2];
						if (Math.sqrt(Math.pow(vector2[0] - vector1[0], 2) + Math.pow(vector2[1] - vector1[1], 2) + Math.pow(vector2[2] - vector1[2], 2)) < settings.vertex_merge_distance.value) {
							if (!groups[vkey1]) groups[vkey1] = [];
							groups[vkey1].push(vkey2);
						}
						j++;
					}
					if (groups[vkey1]) {
						groups[vkey1].forEach(vkey2 => {
							selected_vertices.remove(vkey2);
						})
					}
					i++;
				}

				let current_selected_vertices = mesh.getSelectedVertices();
				for (let first_vertex in groups) {
					let group = groups[first_vertex];
					if (in_center) {
						let group_all = [first_vertex, ...group];
						let center = [0, 0, 0];
						group_all.forEach(vkey => {
							center.V3_add(mesh.vertices[vkey]);
						})
						center.V3_divide(group_all.length);
						mesh.vertices[first_vertex].V3_set(center);

						for (let fkey in mesh.faces) {
							let face = mesh.faces[fkey];
							let matches = group_all.filter(vkey => face.vertices.includes(vkey));
							if (matches.length < 2) continue;
							let center = [0, 0];
							matches.forEach(vkey => {
								center[0] += face.uv[vkey][0];
								center[1] += face.uv[vkey][1];
							})
							center[0] /= matches.length;
							center[1] /= matches.length;
							matches.forEach(vkey => {
								face.uv[vkey][0] = center[0];
								face.uv[vkey][1] = center[1];
							})
						}
					}
					group.forEach(vkey => {
						for (let fkey in mesh.faces) {
							let face = mesh.faces[fkey];
							let index = face.vertices.indexOf(vkey);
							if (index === -1) continue;

							if (face.vertices.includes(first_vertex)) {
								face.vertices.remove(vkey);
								delete face.uv[vkey];
								if (face.vertices.length < 2) {
									delete mesh.faces[fkey];
								}
							} else {
								let uv = face.uv[vkey];
								face.vertices.splice(index, 1, first_vertex);
								face.uv[first_vertex] = uv;
								delete face.uv[vkey];
							}
						}
						found++;
						delete mesh.vertices[vkey];
						current_selected_vertices.remove(vkey);
					})
					found++;
					result++;
				}
			}
		})
		Undo.finishEdit('Merge vertices')
		Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		if (by_distance) {
			Blockbench.showQuickMessage(tl('message.merged_vertices', [found, result]), 2000);
		}
	}
	new Action('merge_vertices', {
		icon: 'close_fullscreen',
		category: 'edit',
		keybind: new Keybind({key: 'm', shift: true}),
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length > 1)},
		click() {
			new Menu(this.children).open('mouse');
		},
		children: [
			{
				id: 'merge_all',
				name: 'action.merge_vertices.merge_all',
				icon: 'north_east',
				click() {mergeVertices(false, false);}
			},
			{
				id: 'merge_all_in_center',
				name: 'action.merge_vertices.merge_all_in_center',
				icon: 'close_fullscreen',
				click() {mergeVertices(false, true);}
			},
			{
				id: 'merge_by_distance',
				name: 'action.merge_vertices.merge_by_distance',
				icon: 'expand_less',
				click() {mergeVertices(true, false);}
			},
			{
				id: 'merge_by_distance_in_center',
				name: 'action.merge_vertices.merge_by_distance_in_center',
				icon: 'unfold_less',
				click() {mergeVertices(true, true);}
			}
		]
	})
	new Action('merge_meshes', {
		icon: 'upload',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected.length >= 2)},
		click() {
			let elements = Mesh.selected.slice();
			Undo.initEdit({elements});
			let original = Mesh.selected[0];
			let vector = new THREE.Vector3();

			Mesh.selected.forEach(mesh => {
				if (mesh == original) return;

				let old_vertex_keys = Object.keys(mesh.vertices);
				let new_vertex_keys = original.addVertices(...mesh.vertice_list.map(arr => {
					vector.fromArray(arr);
					mesh.mesh.localToWorld(vector);
					original.mesh.worldToLocal(vector);
					return vector.toArray()
				}));

				for (let key in mesh.faces) {
					let old_face = mesh.faces[key];
					let new_face = new MeshFace(original, old_face);
					let uv = {};
					for (let vkey in old_face.uv) {
						let new_vkey = new_vertex_keys[old_vertex_keys.indexOf(vkey)]
						uv[new_vkey] = old_face.uv[vkey];
					}
					new_face.extend({
						vertices: old_face.vertices.map(v => new_vertex_keys[old_vertex_keys.indexOf(v)]),
						uv
					})
					original.addFaces(new_face)
				}

				mesh.remove();
				elements.remove(mesh);
				Mesh.selected.remove(mesh)
			})
			updateSelection();
			Undo.finishEdit('Merge meshes')
			Canvas.updateView({elements, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
	new Action('split_mesh', {
		icon: 'call_split',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length)},
		click() {
			let elements = Mesh.selected.slice();
			Undo.initEdit({elements});

			Mesh.selected.forEach(mesh => {

				let selected_vertices = mesh.getSelectedVertices();

				let copy = new Mesh(mesh);
				elements.push(copy);

				for (let fkey in mesh.faces) {
					let face = mesh.faces[fkey];
					if (face.isSelected()) {
						delete mesh.faces[fkey];
					} else {
						delete copy.faces[fkey];
					}
				}

				selected_vertices.forEach(vkey => {
					let used = false;
					for (let key in mesh.faces) {
						let face = mesh.faces[key];
						if (face.vertices.includes(vkey)) used = true;
					}
					if (!used) {
						delete mesh.vertices[vkey];
					}
				})
				Object.keys(copy.vertices).filter(vkey => !selected_vertices.includes(vkey)).forEach(vkey => {
					let used = false;
					for (let key in copy.faces) {
						let face = copy.faces[key];
						if (face.vertices.includes(vkey)) used = true;
					}
					if (!used) {
						delete copy.vertices[vkey];
					}
				})

				copy.name += '_selection'
				copy.sortInBefore(mesh, 1).init();
				delete Project.selected_vertices[mesh.uuid];
				Project.selected_vertices[copy.uuid] = selected_vertices;
				mesh.preview_controller.updateGeometry(mesh);
				selected[selected.indexOf(mesh)] = copy;
			})
			Undo.finishEdit('Merge meshes');
			updateSelection();
			Canvas.updateView({elements, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
	new Action('import_obj', {
		icon: 'fa-gem',
		category: 'file',
		condition: {modes: ['edit'], method: () => (Format.meshes)},
		click: function () {

			
			Blockbench.import({
				resource_id: 'obj',
				extensions: ['obj'],
				name: 'OBJ Wavefront Model',
			}, function(files) {
				let {content} = files[0];
				let lines = content.split(/[\r\n]+/);

				function toVector(args, length) {
					return args.map(v => parseFloat(v));
				}

				let mesh;
				let vertices = [];
				let vertex_keys = {};
				let vertex_textures = [];
				let vertex_normals = [];
				let meshes = [];
				let vector1 = new THREE.Vector3();
				let vector2 = new THREE.Vector3();

				Undo.initEdit({outliner: true, elements: meshes, selection: true});

				lines.forEach(line => {

					if (line.substr(0, 1) == '#' || !line) return;

					let args = line.split(/\s+/).filter(arg => typeof arg !== 'undefined' && arg !== '');
					let cmd = args.shift();

					if (cmd == 'o' || cmd == 'g') {
						mesh = new Mesh({
							name: args[0],
							vertices: {}
						})
						vertex_keys = {};
						meshes.push(mesh);
					}
					if (cmd == 'v') {
						vertices.push(toVector(args, 3).map(v => v * 16));
					}
					if (cmd == 'vt') {
						vertex_textures.push(toVector(args, 2))
					}
					if (cmd == 'vn') {
						vertex_normals.push(toVector(args, 3))
					}
					if (cmd == 'f') {
						let f = {
							vertices: [],
							vertex_textures: [],
							vertex_normals: [],
						}
						args.forEach(triplet => {
							let [v, vt, vn] = triplet.split('/').map(v => parseInt(v));
							if (!vertex_keys[ v-1 ]) {
								vertex_keys[ v-1 ] = mesh.addVertices(vertices[v-1])[0];
							}
							f.vertices.push(vertex_keys[ v-1 ]);
							f.vertex_textures.push(vertex_textures[ vt-1 ]);
							f.vertex_normals.push(vertex_normals[ vn-1 ]);
						})
						
						let uv = {};
						f.vertex_textures.forEach((vt, i) => {
							let key = f.vertices[i];
							if (vt instanceof Array) {
								uv[key] = [
									vt[0] * Project.texture_width,
									(1-vt[1]) * Project.texture_width
								];
							} else {
								uv[key] = [0, 0];
							}
						})
						let face = new MeshFace(mesh, {
							vertices: f.vertices,
							uv
						})
						mesh.addFaces(face);

						if (f.vertex_normals.find(v => v)) {
	
							vector1.fromArray(face.getNormal());
							vector2.fromArray(f.vertex_normals[0]);
							let angle = vector1.angleTo(vector2);
							if (angle > Math.PI/2) {
								face.invert();
							}
						}
					}
				})
				meshes.forEach(mesh => {
					mesh.init();
				})

				Undo.finishEdit('Import OBJ');
			})
		}
	})
})
