import { markerColors } from "../../marker_colors";

BARS.defineActions(function() {
	let add_mesh_dialog = new Dialog({
		id: 'add_primitive',
		title: 'action.add_mesh',
		form: {
			shape: {label: 'dialog.add_primitive.shape', type: 'select', options: {
				cuboid: 'dialog.add_primitive.shape.cube',
				beveled_cuboid: 'dialog.add_primitive.shape.beveled_cuboid',
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
			align_edges: {label: 'dialog.add_primitive.align_edges', type: 'checkbox', value: true, condition: ({shape}) => !['cuboid', 'beveled_cuboid', 'pyramid', 'plane'].includes(shape)},
			height: {label: 'dialog.add_primitive.height', type: 'number', value: 8, condition: ({shape}) => ['cylinder', 'cone', 'cuboid', 'beveled_cuboid', 'pyramid', 'tube'].includes(shape)},
			sides: {label: 'dialog.add_primitive.sides', type: 'number', value: 12, min: 3, max: 48, condition: ({shape}) => ['cylinder', 'cone', 'circle', 'torus', 'sphere', 'tube'].includes(shape)},
			minor_diameter: {label: 'dialog.add_primitive.minor_diameter', type: 'number', value: 4, condition: ({shape}) => ['torus', 'tube'].includes(shape)},
			minor_sides: {label: 'dialog.add_primitive.minor_sides', type: 'number', value: 8, min: 2, max: 32, condition: ({shape}) => ['torus'].includes(shape)},
			edge_size: {label: 'dialog.add_primitive.edge_size', type: 'number', value: 2, condition: ({shape}) => ['beveled_cuboid'].includes(shape)},
		},
		onConfirm(result) {
			let original_selection_group = Group.first_selected && Group.first_selected.uuid;
			let iteration = 0;
			const color = Math.floor(Math.random()*markerColors.length);
			let parent = getCurrentGroup() ?? Armature.selected[0];

			function runEdit(amended: boolean, result) {
				let elements = [];
				if (original_selection_group && !Group.first_selected) {
					let group_to_select = Group.all.find(g => g.uuid == original_selection_group);
					if (group_to_select) {
						Group.first_selected = group_to_select;
					}
				}
				Undo.initEdit({elements, selection: true, outliner: true}, amended);
				let mesh = new Mesh({
					name: result.shape,
					vertices: {},
					color
				});
				if (parent) {
					mesh.addTo(parent);
					if (settings.inherit_parent_color.value && 'color' in parent) {
						mesh.color = parent.color;
					}
				}
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
				if (result.shape == 'cuboid') {
					mesh.name = 'mesh';
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
				if (result.shape == 'beveled_cuboid') {
					let s = result.edge_size;
					let rs = result.diameter/2 - s;
					let r = result.diameter/2;
					let h = result.height;
					let hs = result.height - s;

					let up = mesh.addVertices(
						[rs, h, rs],	// 0
						[rs, h, -rs],	// 1
						[-rs, h, rs],	// 2
						[-rs, h, -rs],	// 3
					)
					let down = mesh.addVertices(
						[rs, 0, rs],	// 4
						[rs, 0, -rs],	// 5
						[-rs, 0, rs],	// 6
						[-rs, 0, -rs],	// 7
					)
					let west = mesh.addVertices(
						[-r, s, rs],	// 8
						[-r, hs, rs],	// 9
						[-r, s, -rs],	// 10
						[-r, hs, -rs],	// 11
					)
					let east = mesh.addVertices(
						[r, s, rs],		// 12
						[r, hs, rs],	// 13
						[r, s, -rs],	// 14
						[r, hs, -rs],	// 15
					)
					let north = mesh.addVertices(
						[rs, s, -r],	// 16
						[rs, hs, -r],	// 17
						[-rs, s, -r],	// 18
						[-rs, hs, -r],	// 19
					)
					let south = mesh.addVertices(
						[rs, s, r],		// 20
						[rs, hs, r],	// 21
						[-rs, s, r],	// 22
						[-rs, hs, r]	// 23
					)
					mesh.addFaces(
						new MeshFace( mesh, {vertices: [ east[1], east[0], east[3], east[2] ]} ), // East
						new MeshFace( mesh, {vertices: [ west[0], west[1], west[3], west[2] ]} ), // West
						new MeshFace( mesh, {vertices: [ up[0], up[1], up[3], up[2] ]} ), // Up
						new MeshFace( mesh, {vertices: [ down[1], down[0], down[3], down[2] ]} ), // Down
						new MeshFace( mesh, {vertices: [ south[0], south[1], south[3], south[2] ]} ), // South
						new MeshFace( mesh, {vertices: [ north[1], north[0], north[3], north[2] ]} ), // North
					);
					mesh.addFaces(
						new MeshFace( mesh, {vertices: [up[1], up[0], east[1], east[3]]} ), // E Up
						new MeshFace( mesh, {vertices: [up[2], up[3], west[1], west[3]]} ), // W Up
						new MeshFace( mesh, {vertices: [up[0], up[2], south[1], south[3]]} ), // S Up
						new MeshFace( mesh, {vertices: [up[3], up[1], north[1], north[3]]} ), // N Up
						new MeshFace( mesh, {vertices: [down[0], down[1], east[0], east[2]]} ), // E Down
						new MeshFace( mesh, {vertices: [down[3], down[2], west[0], west[2]]} ), // W Down
						new MeshFace( mesh, {vertices: [down[2], down[0], south[0], south[2]]} ), // S Down
						new MeshFace( mesh, {vertices: [down[1], down[3], north[0], north[2]]} ), // N Down

						new MeshFace( mesh, {vertices: [north[0], north[1], east[2], east[3]]} ), // NE
						new MeshFace( mesh, {vertices: [south[1], south[0], east[0], east[1]]} ), // SE
						new MeshFace( mesh, {vertices: [north[3], north[2], west[2], west[3]]} ), // NW
						new MeshFace( mesh, {vertices: [south[2], south[3], west[0], west[1]]} )  // SW
					);
					mesh.addFaces(
						new MeshFace( mesh, {vertices: [down[0], east[0], south[0]]} ), // Down1
						new MeshFace( mesh, {vertices: [down[2], south[2], west[0]]} ), // Down2
						new MeshFace( mesh, {vertices: [down[1], north[0], east[2]]} ), // Down3
						new MeshFace( mesh, {vertices: [down[3], west[2], north[2]]} ), // Down4
						new MeshFace( mesh, {vertices: [up[0], south[1], east[1]]} ), // Up1
						new MeshFace( mesh, {vertices: [up[2], west[1], south[3]]} ), // Up2
						new MeshFace( mesh, {vertices: [up[1], east[3], north[1]]} ), // Up3
						new MeshFace( mesh, {vertices: [up[3], north[3], west[3]]} )  // Up4
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
					if (parent && parent.origin) {
						var pos1 = parent.origin.slice()
						mesh.extend({
							origin: pos1.slice() as ArrayVector3
						})
					}
				}

				elements.push(mesh);
				mesh.init()
				unselectAllElements()
				mesh.select()
				UVEditor.setAutoSize(null, true, Object.keys(mesh.faces));
				Undo.finishEdit('Add primitive');
				Blockbench.dispatchEvent( 'add_mesh', {object: mesh} )
				iteration++;

				Vue.nextTick(function() {
					if (settings.create_rename.value && iteration == 1) {
						mesh.rename()
					}
				})
			}
			runEdit(false, result);

			Undo.amendEdit({
				diameter: {label: 'dialog.add_primitive.diameter', type: 'num_slider', value: result.diameter, interval_type: 'position'},
				height: {label: 'dialog.add_primitive.height', type: 'num_slider', value: result.height, condition: ['cylinder', 'cone', 'cuboid', 'beveled_cuboid', 'pyramid', 'tube'].includes(result.shape), interval_type: 'position'},
				sides: {label: 'dialog.add_primitive.sides', type: 'num_slider', value: result.sides, min: 3, max: 48, condition: ['cylinder', 'cone', 'circle', 'torus', 'sphere', 'tube'].includes(result.shape)},
				minor_diameter: {label: 'dialog.add_primitive.minor_diameter', type: 'num_slider', value: result.minor_diameter, condition: ['torus', 'tube'].includes(result.shape), interval_type: 'position'},
				minor_sides: {label: 'dialog.add_primitive.minor_sides', type: 'num_slider', value: result.minor_sides, min: 2, max: 32, condition: ['torus'].includes(result.shape)},
				edge_size: {label: 'dialog.add_primitive.edge_size', type: 'num_slider', value: result.edge_size, condition: ['beveled_cuboid'].includes(result.shape)},
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
});
