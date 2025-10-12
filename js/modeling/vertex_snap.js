import { Canvas } from "../preview/canvas";
import { autoFixMeshEdit } from "./mesh_editing";

export const Vertexsnap = {
	step1: true,
	vertex_gizmos: new THREE.Object3D(),
	line: new THREE.Line(new THREE.BufferGeometry(), Canvas.outlineMaterial),
	elements_with_vertex_gizmos: [],
	hovering: false,
	addVertices: function(element) {
		if (Vertexsnap.elements_with_vertex_gizmos.includes(element)) return;
		if (element.visibility === false) return;
		let {mesh} = element;

		$('#preview').get(0).removeEventListener("mousemove", Vertexsnap.hoverCanvas)
		$('#preview').get(0).addEventListener("mousemove", Vertexsnap.hoverCanvas)

		if (!mesh.vertex_points) {
			mesh.updateMatrixWorld()
			let vectors = [];

			if (mesh.geometry) {
				let positions = mesh.geometry.attributes.position.array;

				// If this is a spline, we need to merge the path geo into 
				// positions, so we can snap to the start or end of the spline.
				if (element instanceof SplineMesh) {
					let mesh_position = positions.slice();			
					let path_positions = mesh.pathLine.geometry.attributes.position.array;

					positions = new Float32Array(mesh_position.length + path_positions.length);
					positions.set(mesh_position);
					positions.set(path_positions, mesh_position.length);
				} else if (positions.length && (positions.length % 3) == 0) {
					for (let i = 0; i < positions.length; i += 3) {
						let vec = [positions[i], positions[i+1], positions[i+2]];
						if (!vectors.find(vec2 => vec.equals(vec2))) {
							vectors.push(vec);
						}
					}
				}
			}
			vectors.push([0, 0, 0]);
			
			let points = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial().copy(Canvas.meshVertexMaterial));
			points.element_uuid = element.uuid;
			points.vertices = vectors;
			let vector_positions = [];
			vectors.forEach(vector => vector_positions.push(...vector));
			let vector_colors = [];
			vectors.forEach(vector => vector_colors.push(gizmo_colors.grid.r, gizmo_colors.grid.g, gizmo_colors.grid.b));
			points.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vector_positions), 3));
			points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(vector_colors), 3));
			points.material.transparent = true;
			mesh.vertex_points = points;
			if (mesh.outline) {
				mesh.outline.add(points);
			} else {
				mesh.add(points);
			}
		}
		mesh.vertex_points.visible = true;
		mesh.vertex_points.renderOrder = 900;
		
		Vertexsnap.elements_with_vertex_gizmos.push(element)
	},
	clearVertexGizmos: function() {
		Project.model_3d.remove(Vertexsnap.line);
		Vertexsnap.elements_with_vertex_gizmos.forEach(element => {
			if (element.mesh && element.mesh.vertex_points) {
				element.mesh.vertex_points.visible = false;
				if (element instanceof Mesh == false) {
					element.mesh.vertex_points.parent.remove(element.mesh.vertex_points);
					delete element.mesh.vertex_points;
				}
			}
			
		})
		Vertexsnap.elements_with_vertex_gizmos.empty();
		$('#preview').get(0).removeEventListener("mousemove", Vertexsnap.hoverCanvas)
	},
	hoverCanvas: function(event) {
		let data = Canvas.raycast(event)

		if (Vertexsnap.hovering) {
			Project.model_3d.remove(Vertexsnap.line);
			Vertexsnap.elements_with_vertex_gizmos.forEach(el => {
				let points = el.mesh.vertex_points;
				let colors = [];
				for (let i = 0; i < points.geometry.attributes.position.count; i++) {
					let color;
					if (data && data.element == el && data.type == 'vertex' && data.vertex_index == i) {
						color = gizmo_colors.outline;
					} else {
						color = gizmo_colors.grid;
					}
					colors.push(color.r, color.g, color.b);
				}
				points.material.depthTest = !(data.element == el);
				points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
			})
		}
		if (!data || data.type !== 'vertex') {
			Blockbench.setStatusBarText()
			return;
		}
		Vertexsnap.hovering = true

		if (Vertexsnap.step1 === false) {
			let {line} = Vertexsnap;
			let {geometry} = line;

			let vertex_pos = Vertexsnap.getGlobalVertexPos(data.element, data.vertex);
			geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...Vertexsnap.vertex_pos.toArray(), ...vertex_pos.toArray()]), 3));

			line.renderOrder = 900
			Project.model_3d.add(Vertexsnap.line);
			Vertexsnap.line.position.copy(scene.position).multiplyScalar(-1);
			//Measure
			var diff = new THREE.Vector3().copy(Vertexsnap.vertex_pos);
			diff.sub(vertex_pos);
			Blockbench.setStatusBarText(tl('status_bar.vertex_distance', [trimFloatNumber(diff.length())] ));
		}
	},
	select: function() {
		Vertexsnap.clearVertexGizmos()
		Outliner.selected.forEach(function(element) {
			Vertexsnap.addVertices(element)
		})
		for (let group of Group.multi_selected) {
			Vertexsnap.addVertices(group);
		}
		if (Outliner.selected.length) {
			$('#preview').css('cursor', (Vertexsnap.step1 ? 'copy' : 'alias'))
		}
	},
	canvasClick: function(data) {
		if (!data) return;
		if (data.type !== 'vertex' && ['locator', 'null_object'].includes(data.element?.type) == false) return;

		if (Vertexsnap.step1) {
			Vertexsnap.step1 = false
			Vertexsnap.vertex_pos = Vertexsnap.getGlobalVertexPos(data.element, data.vertex);
			Vertexsnap.vertex_index = data.vertex_index;
			Vertexsnap.move_origin = data.vertex instanceof Array ? data.vertex.allEqual(0) : false;
			Vertexsnap.elements = Outliner.selected.slice();
			Vertexsnap.groups = Group.multi_selected;
			if (data.element instanceof Mesh && BarItems.selection_mode.value == 'vertex') {
				let vertices = data.element.getSelectedVertices(true);
				vertices.safePush(data.vertex);
			}
			Vertexsnap.selected_vertices = JSON.parse(JSON.stringify(Project.mesh_selection));
			Vertexsnap.clearVertexGizmos()
			$('#preview').css('cursor', (Vertexsnap.step1 ? 'copy' : 'alias'))

		} else {
			Vertexsnap.snap(data)
			$('#preview').css('cursor', (Vertexsnap.step1 ? 'copy' : 'alias'))
		}
		Blockbench.setStatusBarText()
	},
	getGlobalVertexPos(element, vertex) {
		let vector = new THREE.Vector3();
		if (vertex instanceof Array) {
			vector.fromArray(vertex);
		} else if (typeof vertex == 'string') {
			vector.fromArray(element.vertices[vertex]);
		}
		element.mesh.localToWorld(vector);
		return vector;
	},
	snap: function(data, options = 0, amended) {
		Undo.initEdit({elements: Vertexsnap.elements, outliner: !!Vertexsnap.groups.length}, amended);

		let mode = BarItems.vertex_snap_mode.get();

		function ignoreVectorAxes(vector) {
			if (options.ignore_axis?.x) vector.x = 0;
			if (options.ignore_axis?.y) vector.y = 0;
			if (options.ignore_axis?.z) vector.z = 0;
		}

		if (Vertexsnap.move_origin) {
			if (Vertexsnap.groups.length) {
				for (let group of Vertexsnap.groups) {
					let vec = Vertexsnap.getGlobalVertexPos(data.element, data.vertex);

					if (Format.bone_rig && group.parent instanceof Group && group.mesh.parent) {
						group.mesh.parent.worldToLocal(vec);
					}
					let vec_array = vec.toArray()
					vec_array.V3_add(group.parent.origin);
					group.transferOrigin(vec_array);
				}

			} else {
				Vertexsnap.elements.forEach(function(element) {
					let vec = Vertexsnap.getGlobalVertexPos(data.element, data.vertex);

					if (Format.bone_rig && element.parent instanceof Group && element.mesh.parent) {
						element.mesh.parent.worldToLocal(vec);
					}
					vec.sub(Canvas.scene.position);
					let vec_array = vec.toArray()
					vec_array.V3_add(element.parent.origin);
					element.transferOrigin(vec_array)
				})
			}
		} else {

			let global_target_pos = Vertexsnap.getGlobalVertexPos(data.element, data.vertex);
			let global_delta = new THREE.Vector3().copy(global_target_pos).sub(Vertexsnap.vertex_pos)

			if (mode === 'scale' && !Format.integer_size && Vertexsnap.elements[0] instanceof Cube) {
				//Scale

				var m;
				switch (Vertexsnap.vertex_index) {
					case 0: m=[ 1,1,1 ]; break;
					case 1: m=[ 1,1,0 ]; break;
					case 2: m=[ 1,0,1 ]; break;
					case 3: m=[ 1,0,0 ]; break;
					case 4: m=[ 0,1,0 ]; break;
					case 5: m=[ 0,1,1 ]; break;
					case 6: m=[ 0,0,0 ]; break;
					case 7: m=[ 0,0,1 ]; break;
				}

				Vertexsnap.elements.forEach(function(obj) {
					if (obj instanceof Cube == false) return;
					var q = obj.mesh.getWorldQuaternion(new THREE.Quaternion()).invert()
					var local_offset = new THREE.Vector3().copy(global_delta).applyQuaternion(q)
					ignoreVectorAxes(local_offset);

					for (let i=0; i<3; i++) {
						if (m[i] === 1) {
							obj.to[i] = obj.to[i] + local_offset.getComponent(i);
						} else {
							obj.from[i] = obj.from[i] + local_offset.getComponent(i);
						}
					}
					if (Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
						Format.cube_size_limiter.clamp(obj)
					}
					if (obj.box_uv && obj.visibility) {
						obj.preview_controller.updateUV(obj)
					}
				})
			} else if (mode === 'move') {
				Vertexsnap.elements.forEach(function(obj) {
					var local_offset = new THREE.Vector3().copy(global_delta)

					if (obj instanceof Mesh && Vertexsnap.selected_vertices && Vertexsnap.selected_vertices[obj.uuid]) {
						let vertices = Vertexsnap.selected_vertices[obj.uuid].vertices;
						var q = obj.mesh.getWorldQuaternion(Reusable.quat1).invert();
						local_offset.applyQuaternion(q);
						ignoreVectorAxes(local_offset);
						let local_offset_array = local_offset.toArray();
						vertices.forEach(vkey => {
							if (obj.vertices[vkey]) obj.vertices[vkey].V3_add(local_offset_array);
						})

					} else {
						if (Format.bone_rig && obj.parent instanceof Group) {
							var q = obj.mesh.parent.getWorldQuaternion(Reusable.quat1).invert();
							local_offset.applyQuaternion(q);
						}
						if (obj instanceof Cube && Format.rotate_cubes) {
							obj.origin.V3_add(local_offset);
						}
						ignoreVectorAxes(local_offset);
						if (obj.moveVector) {
							var in_box = obj.moveVector(local_offset.toArray());
							if (!in_box && Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
								Blockbench.showMessageBox({translateKey: 'canvas_limit_error'})
							}
						} else if (obj.position) {
							obj.position.V3_add(local_offset.toArray());
						}
					}
				})
			} else if (mode == 'rotate') {
				Vertexsnap.elements.forEach((obj) => {
					let local_start = obj.mesh.worldToLocal(new THREE.Vector3().copy(Vertexsnap.vertex_pos));
					let local_target = obj.mesh.worldToLocal(new THREE.Vector3().copy(global_target_pos));

					ignoreVectorAxes(local_start);
					ignoreVectorAxes(local_target);

					if (options.align != 'direction' || !amended) {
						let target_distance = local_target.length();
						let longest_axis = 'x';
						if ('xyz'.includes(options.align)) {
							longest_axis = options.align;
						} else {
							if (local_start.y > local_start.x) longest_axis = 'y';
							if (local_start.z > local_start.y) longest_axis = 'z';
						}

						let off_axes = ['x', 'y', 'z'].filter(l => l != longest_axis);
						local_start[longest_axis] = Math.sqrt(target_distance**2 - local_start[off_axes[0]]**2 - local_start[off_axes[1]]**2);
					}
					local_start.normalize();
					local_target.normalize();
					let rot_diff = new THREE.Quaternion().setFromUnitVectors(local_start, local_target);
					
					obj.mesh.quaternion.multiply(rot_diff);
					let modified_rotation = obj.mesh.rotation.toArray().slice(0, 3).map(Math.radToDeg);
					obj.extend({rotation: modified_rotation});
				})
			}
		}

		Vertexsnap.clearVertexGizmos()
		let update_options = {
			elements: Vertexsnap.elements,
			element_aspects: {transform: true, geometry: true},
			selection: true
		};
		if (Vertexsnap.groups.length) {
			update_options.elements = [...update_options.elements];
			for (let group of Vertexsnap.groups) {
				Vertexsnap.groups.forEachChild(child => {
					update_options.elements.safePush(child);
				}, OutlinerElement);
			}
			update_options.groups = Vertexsnap.groups;
			update_options.group_aspects = {transform: true};
		}
		Canvas.updateView(update_options);
		Undo.finishEdit('Use vertex snap');
		if (Mesh.selected[0]) {
			let vertices = Vertexsnap.selected_vertices?.[Mesh.selected[0].uuid]?.vertices;
			autoFixMeshEdit(vertices);
		}
		Vertexsnap.step1 = true;
		
		if (!amended) {
			Undo.amendEdit({
				align: {type: 'select', condition: mode == 'rotate', label: 'edit.vertex_snap.align', options: {
					longest: 'edit.vertex_snap.align.longest',
					direction: 'edit.vertex_snap.align.direction',
					x: tl('edit.vertex_snap.align.align_axis', 'X'),
					y: tl('edit.vertex_snap.align.align_axis', 'Y'),
					z: tl('edit.vertex_snap.align.align_axis', 'Z'),
				}},
				ignore_axis: {type: 'inline_multi_select', label: tl('edit.vertex_snap.ignore_axis', ''),  options: {x: 'X', y: 'Y', z: 'Z'}, value: {x: false, y: false, z: false}},
			}, form => {
				Vertexsnap.snap(data, form, true);
			})
		}
	}
}

Object.assign(window, {
	Vertexsnap,
});
