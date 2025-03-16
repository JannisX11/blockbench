//Actions
function getSelectionCenter(all = false) {
	if (Group.first_selected && Group.multi_selected.length == 1 && selected.length == 0 && !all) {
		let vec = THREE.fastWorldPosition(Group.first_selected.mesh, new THREE.Vector3());
		return vec.toArray();
	}

	let max = [-Infinity, -Infinity, -Infinity];
	let min = [ Infinity,  Infinity,  Infinity];
	let elements = Outliner.selected.length ? Outliner.selected : Outliner.elements;
	if (Group.first_selected) {
		elements = elements.concat(Group.multi_selected);
	}
	elements.forEach(element => {
		if (element.getWorldCenter) {
			var pos = element.getWorldCenter();
			min[0] = Math.min(pos.x, min[0]);	max[0] = Math.max(pos.x, max[0]);
			min[1] = Math.min(pos.y, min[1]);	max[1] = Math.max(pos.y, max[1]);
			min[2] = Math.min(pos.z, min[2]);	max[2] = Math.max(pos.z, max[2]);
		}
	})
	let center = (min[0] == Infinity) ? [0, 0, 0] : max.V3_add(min).V3_divide(2);
	
	if (!Format.centered_grid) {
		center.V3_add(8, 0, 8)
	}
	return center;
}
//Movement
function moveElementsRelative(difference, index, event) { //Multiple
	if (!Preview.selected || !Outliner.selected.length) {
		return;
	}
	var _has_groups = Format.bone_rig && Group.first_selected && Toolbox.selected.transformerMode == 'translate';

	Undo.initEdit({elements: Outliner.selected, outliner: _has_groups})
	var axes = []
	// < >
	// PageUpDown
	// ^ v
	var facing = Preview.selected.getFacingDirection()
	var height = Preview.selected.getFacingHeight()
	switch (facing) {
		case 'north': axes = [0, 2, 1]; break;
		case 'south': axes = [0, 2, 1]; break;
		case 'west':  axes = [2, 0, 1]; break;
		case 'east':  axes = [2, 0, 1]; break;
	}

	if (height !== 'middle') {
		if (index === 1) {
			index = 2
		} else if (index === 2) {
			index = 1
		}
	}
	if (facing === 'south' && (index === 0 || index === 1))  difference *= -1
	if (facing === 'west'  && index === 0)  difference *= -1
	if (facing === 'east'  && index === 1)  difference *= -1
	if (index === 2 && height !== 'down') difference *= -1
	if (index === 1 && height === 'up') difference *= -1

	if (event) {
		difference *= canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl);
	}

	if (BarItems.proportional_editing.value) {
		Mesh.selected.forEach(mesh => {
			ProportionalEdit.calculateWeights(mesh);
		})
	}

	moveElementsInSpace(difference, axes[index]);
	updateSelection();

	Undo.finishEdit('Move elements')
	autoFixMeshEdit()
}
//Rotate
function rotateSelected(axis, steps) {
	let affected = [...Cube.selected, ...Mesh.selected];
	if (!affected.length) return;
	Undo.initEdit({elements: affected});
	if (!steps) steps = 1
	var origin = [8, 8, 8]
	if (Group.first_selected && Format.bone_rig) {
		origin = Group.first_selected.origin.slice()
	} else if (Format.centered_grid) {
		origin = [0, 0, 0]
	} else {
		origin = affected[0].origin.slice()
	}
	affected.forEach(function(obj) {
		obj.roll(axis, steps, origin)
	})
	updateSelection();
	Undo.finishEdit('Rotate elements')
}
//Mirror
function flipNameOnAxis(node, axis, check, original_name) {
	const flip_pairs = {
		0: {
			right: 'left',
			Right: 'Left',
			RIGHT: 'LEFT',
		},
		1: {
			top: 'bottom',
			Top: 'Bottom',
			TOP: 'BOTTOM',
		},
		2: {
			back: 'front',
			rear: 'front',
			Back: 'Front',
			Rear: 'Front',
			BACK: 'FRONT',
			REAR: 'FRONT',
		}
	};
	function matchAndReplace(a, b) {
		if (node.name.includes(a)) {
			let name = original_name
						? original_name.replace(a, b)
						: node.name.replace(a, b).replace(/2/, '');
			if (!check || check(name)) node.name = name;
			return true;
		}
	}
	let pairs = flip_pairs[axis];
	Blockbench.dispatchEvent('flip_node_name', {pairs, node, axis, original_name});
	for (let a in pairs) {
		let b = pairs[a];
		if (matchAndReplace(a, b)) break;
		if (matchAndReplace(b, a)) break;
	}
}
function mirrorSelected(axis) {
	if (Modes.animate && Timeline.selected.length) {

		Undo.initEdit({keyframes: Timeline.selected})
		for (var kf of Timeline.selected) {
			kf.flip(axis)
		}
		Undo.finishEdit('Flipped keyframes');
		updateKeyframeSelection();
		Animator.preview();

	} else if (Modes.edit && (Outliner.selected.length || Group.first_selected)) {
		Undo.initEdit({elements: selected, outliner: Format.bone_rig || Group.first_selected, selection: true})
		let center = Format.centered_grid ? 0 : 8;
		if (Format.bone_rig) {
			for (let group of Group.multi_selected) {
				function flipGroup(group) {
					for (let i = 0; i < 3; i++) {
						if (i === axis) {
							group.origin[i] *= -1
						} else {
							group.rotation[i] *= -1
						}
					}
					flipNameOnAxis(group, axis, name => (!Group.all.find(g => g.name == name)), group._original_name);
					Canvas.updateAllBones([group]);
				}
				flipGroup(group);
				group.forEachChild(flipGroup, Group);
			}
		}
		selected.forEach(function(obj) {
			if (obj instanceof Mesh) {
				obj.flipSelection(axis, center, false);
			} else {
				obj.flip(axis, center, false);
			}
		})
		updateSelection()
		Undo.finishEdit('Flip selection')
		autoFixMeshEdit()
	}
}

const Vertexsnap = {
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
				for (let i = 0; i < positions.length; i += 3) {
					let vec = [positions[i], positions[i+1], positions[i+2]];
					if (!vectors.find(vec2 => vec.equals(vec2))) {
						vectors.push(vec);
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
		if (!data || data.type !== 'vertex') return;

		if (Vertexsnap.step1) {
			Vertexsnap.step1 = false
			Vertexsnap.vertex_pos = Vertexsnap.getGlobalVertexPos(data.element, data.vertex);
			Vertexsnap.vertex_index = data.vertex_index;
			Vertexsnap.move_origin = typeof data.vertex !== 'string' && data.vertex.allEqual(0);
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
		vector.fromArray(vertex instanceof Array ? vertex : element.vertices[vertex]);
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

					for (i=0; i<3; i++) {
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
						Canvas.updateUV(obj)
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
						var in_box = obj.moveVector(local_offset.toArray());
						if (!in_box && Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
							Blockbench.showMessageBox({translateKey: 'canvas_limit_error'})
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
		if (Vertexsnap.groups.lenght) {
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
		autoFixMeshEdit();
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

//Center
function centerElements(axis, update) {
	if (!Outliner.selected.length) return;
	let center = getSelectionCenter()[axis];
	var difference = (Format.centered_grid ? 0 : 8) - center

	Outliner.selected.forEach(function(obj) {
		if (obj.movable) obj.origin[axis] += difference;
		if (obj.from) obj.from[axis] = obj.from[axis] + difference;
		if (obj.to) obj.to[axis] = obj.to[axis] + difference;
		if (obj instanceof Cube && Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
			Format.cube_size_limiter.move(obj);
		}
	})
	Group.all.forEach(group => {
		if (!group.selected) return;
		group.origin[axis] += difference;
	})
	Canvas.updateView({
		elements: Outliner.selected,
		groups: Group.all.filter(g => g.selected),
		element_aspects: {transform: true},
		group_aspects: {transform: true},
		selection: true
	})
}

//Move
function moveElementsInSpace(difference, axis) {
	let space = Transformer.getTransformSpace();
	let groups;
	if (Format.bone_rig && Group.first_selected && (Group.multi_selected.length > 1 || Group.first_selected.matchesSelection())) {
		groups = Group.multi_selected;
	}
	var group_m;
	let quaternion = new THREE.Quaternion();
	let vector = new THREE.Vector3();

	if (groups) {
		for (let group of groups) {
			if (space === 0) {
				group_m = vector.set(0, 0, 0);
				group_m[getAxisLetter(axis)] = difference;

				let rotation = new THREE.Quaternion();
				groups[0].mesh.parent.getWorldQuaternion(rotation);
				group_m.applyQuaternion(rotation.invert());

				group.forEachChild(g => {
					g.origin.V3_add(group_m.x, group_m.y, group_m.z);
				}, Group, true)

			} else if (space === 2) {
				group_m = new THREE.Vector3();
				group_m[getAxisLetter(axis)] = difference;

				group_m.applyQuaternion(group.mesh.quaternion);

				group.forEachChild(g => {
					g.origin.V3_add(group_m.x, group_m.y, group_m.z);
				}, Group, true)

			} else {
				group.forEachChild(g => {
					g.origin[axis] += difference
				}, Group, true)
			}
		}
		Canvas.updateAllBones(Group.multi_selected);
	}

	Outliner.selected.forEach(el => {

		if (!group_m && el instanceof Mesh && (el.getSelectedVertices().length > 0 || space >= 2)) {

			let selection_rotation = space == 3 && el.getSelectionRotation();
			let selected_vertices = el.getSelectedVertices();
			if (!selected_vertices.length) selected_vertices = Object.keys(el.vertices);

			let difference_vec = [0, 0, 0];
			if (space == 2) {
				difference_vec[axis] += difference;

			} else if (space == 3) {
				let m = vector.set(0, 0, 0);
				m[getAxisLetter(axis)] = difference;
				m.applyEuler(selection_rotation);
				difference_vec.V3_set(m.x, m.y, m.z);

			} else if (space instanceof Group) {
				let m = vector.set(0, 0, 0);
				m[getAxisLetter(axis)] = difference;
				m.applyQuaternion(new THREE.Quaternion().copy(el.mesh.quaternion).invert());
				difference_vec.V3_set(m.x, m.y, m.z);

			} else {
				let m = vector.set(0, 0, 0);
				m[getAxisLetter(axis)] = difference;
				m.applyQuaternion(el.mesh.getWorldQuaternion(quaternion).invert());
				difference_vec.V3_set(m.x, m.y, m.z);
			}

			selected_vertices.forEach(vkey => {
				el.vertices[vkey].V3_add(difference_vec);
			})
			// mirror modeling: Snap to middle to connect
			if (
				BarItems.mirror_modeling.value &&
				difference_vec[0] &&
				selected_vertices.allAre(vkey => Math.epsilon(el.vertices[vkey][0], el.vertices[selected_vertices[0]][0], 0.02)) && // All vertices same X
				Math.sign(el.vertices[selected_vertices[0]][0]) != Math.sign(el.vertices[selected_vertices[0]][0] - difference_vec[0]) && // movement crossed center
				el.vertices[selected_vertices[0]][0] && (el.vertices[selected_vertices[0]][0] - difference_vec[0])
			) {
				selected_vertices.forEach(vkey => {
					el.vertices[vkey][0] = 0;
				})
			}

			ProportionalEdit.editVertices(el, (vkey, blend) => {
				el.vertices[vkey].V3_add(difference_vec[0] * blend, difference_vec[1] * blend, difference_vec[2] * blend);
			})

		} else {
		
			if (space == 2 && !group_m) {
				if (el.position) {
					let m = vector.set(0, 0, 0);
					m[getAxisLetter(axis)] = difference;
					m.applyQuaternion(el.mesh.quaternion);
					el.position.V3_add(m.x, m.y, m.z);

				} else if (el instanceof TextureMesh) {
					el.local_pivot[axis] += difference;

				} else {
					if (el.movable) el.from[axis] += difference;
					if (el.resizable && el.to) el.to[axis] += difference;
					
					if (el instanceof Cube && Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
						Format.cube_size_limiter.move(el);
					}
				}
				
			} else if (space instanceof Group) {
				if (el.movable && el.from instanceof Array) {
					el.from[axis] += difference;
				} else if (el.movable && el.position) {
					el.position[axis] += difference;
				}
				if (el.resizable && el.to instanceof Array) el.to[axis] += difference;
				if (el.rotatable && !el.position) el.origin[axis] += difference;
			} else {
				let move_origin = !!groups;
				if (group_m) {
					var m = group_m
				} else {
					var m = vector.set(0, 0, 0);
					m[getAxisLetter(axis)] = difference;
					
					let parent = el.parent;
					while (parent instanceof Group) {
						if (!parent.rotation.allEqual(0)) break;
						parent = parent.parent;
					}

					if (parent == 'root') {
						// If none of the parent groups are rotated, move origin.
						move_origin = true;
					} else {
						var rotation = new THREE.Quaternion();
						if (el.mesh && !el.position && el instanceof Mesh == false) {
							el.mesh.getWorldQuaternion(rotation);
						} else if (el.parent instanceof Group) {
							el.parent.mesh.getWorldQuaternion(rotation);
						}
						m.applyQuaternion(rotation.invert());
					}
				}

				if (el.from) {
					el.from.V3_add(m.x, m.y, m.z);
					if (el.to) el.to.V3_add(m.x, m.y, m.z);
				} else if (el instanceof Mesh && move_origin) {
					el.position.V3_add(m.x, m.y, m.z);
					
				} else if (el.position) {
					el.position.V3_add(m.x, m.y, m.z);
				} 
				if (move_origin) {
					if (el.rotatable && !el.position && el instanceof TextureMesh == false) el.origin.V3_add(m.x, m.y, m.z);
				}
			}
		}
		if (el instanceof Cube) {
			el.mapAutoUV()
		}
	})
	Canvas.updateView({
		elements: Outliner.selected,
		element_aspects: {transform: true, geometry: true},
		groups: Group.all.filter(g => g.selected),
		group_aspects: {transform: true}
	})
}

function getSpatialInterval(event = 0) {
	return canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl);
}
//Rotate
function getRotationInterval(event) {
	if (Format.rotation_snap) {
		return 22.5;
	} else if ((event.shiftKey || Pressing.overrides.shift) && (event.ctrlOrCmd || Pressing.overrides.ctrl)) {
		return 0.25;
	} else if (event.shiftKey || Pressing.overrides.shift) {
		return 22.5;
	} else if (event.ctrlOrCmd || Pressing.overrides.ctrl) {
		return 1;
	} else {
		return 2.5;
	}
}
function getRotationObjects() {
	if (Format.bone_rig && Group.first_selected) return Group.multi_selected;
	let elements = Outliner.selected.filter(element => {
		return element.rotatable && (element instanceof Cube == false || Format.rotate_cubes);
	})
	if (elements.length) return elements;
}
function rotateOnAxis(modify, axis, slider) {
	var things = getRotationObjects();
	if (!things) return;
	if (things instanceof Array == false) things = [things];
	//Warning
	if (Format.rotation_limit && settings.dialog_rotation_limit.value && !Dialog.open) {
		var i = 0;
		while (i < Cube.selected.length) {
			if (Cube.selected[i].rotation[(axis+1)%3] ||
				Cube.selected[i].rotation[(axis+2)%3]
			) {
				i = Infinity

				Blockbench.showMessageBox({
					title: tl('message.rotation_limit.title'),
					icon: 'rotate_right',
					message: tl('message.rotation_limit.message'),
					checkboxes: {
						dont_show_again: {value: false, text: 'dialog.dontshowagain'}
					}
				}, (button, checkboxes = {}) => {
					if (checkboxes.dont_show_again) {
						settings.dialog_rotation_limit.set(false);
					}
				})
				return;
				//Gotta stop the numslider here
			}
			i++;
		}
	}
	var axis_letter = getAxisLetter(axis)
	var origin = things[0].origin
	things.forEach(function(obj, i) {
		if (!obj.rotation.allEqual(0)) {
			origin = obj.origin
		}
	})

	let space = Transformer.getTransformSpace()
	if (axis instanceof THREE.Vector3) space = 0;
	things.forEach(obj => {
		let mesh = obj.mesh;
		if (obj instanceof Cube && !Format.bone_rig) {
			if (obj.origin.allEqual(0)) {
				obj.origin.V3_set(origin)
			}
		}
		
		if (!Group.first_selected && obj instanceof Mesh && Project.mesh_selection[obj.uuid] && Project.mesh_selection[obj.uuid].vertices.length > 0) {

			let normal = axis == 0 ? THREE.NormalX : (axis == 1 ? THREE.NormalY : THREE.NormalZ)
			let rotWorldMatrix = new THREE.Matrix4();
			rotWorldMatrix.makeRotationAxis(normal, Math.degToRad(modify(0)))
			if (space instanceof Group || space == 'root') {
				rotWorldMatrix.multiply(mesh.matrix);
			} else if (space == 0) {
				rotWorldMatrix.multiply(mesh.matrixWorld);
			}
			let q = new THREE.Quaternion().setFromRotationMatrix(rotWorldMatrix);
			if (space instanceof Group || space == 'root') {
				q.premultiply(mesh.quaternion.invert());
				mesh.quaternion.invert();
			} else if (space == 0) {
				let quat = mesh.getWorldQuaternion(new THREE.Quaternion()).invert();
				q.premultiply(quat);
			}

			let vector = new THREE.Vector3();
			let local_pivot = obj.mesh.worldToLocal(new THREE.Vector3().copy(Transformer.position))

			Project.mesh_selection[obj.uuid].vertices.forEach(key => {
				vector.fromArray(obj.vertices[key]);
				vector.sub(local_pivot);
				vector.applyQuaternion(q);
				vector.add(local_pivot);
				obj.vertices[key].V3_set(vector.x, vector.y, vector.z);
			})

		} else if (slider || (space == 2 && Format.rotation_limit)) {
			var obj_val = modify(obj.rotation[axis]);
			obj_val = Math.trimDeg(obj_val)
			if (Format.rotation_limit && obj instanceof Cube) {
				//Limit To 1 Axis
				obj.rotation[(axis+1)%3] = 0
				obj.rotation[(axis+2)%3] = 0
				//Limit Angle
				if (Format.rotation_snap) {
					obj_val = Math.round(obj_val/22.5)*22.5
				}
				if (obj_val > 45 || obj_val < -45) {
	
					let f = obj_val > 45
					let can_roll = obj.roll(axis, f!=(axis==1) ? 1 : 3);
					if (can_roll) {
						let roll_angle = Format.rotation_snap ? 22.5 : 90 - Math.abs(obj_val)
						obj_val = f ? -roll_angle : roll_angle;
					} else {
						obj_val = Math.clamp(obj_val, -45, 45);
					}
				}
			}
			obj.rotation[axis] = obj_val
			if (obj instanceof Cube) {
				obj.rotation_axis = axis_letter
			}
		} else if (space == 2) {
			if ([0, 1, 2].find(axis2 => axis2 !== axis && Math.abs(obj.rotation[axis2]) > 0.1) !== undefined) {
				let old_order = mesh.rotation.order;
				mesh.rotation.reorder(axis == 0 ? 'ZYX' : (axis == 1 ? 'ZXY' : 'XYZ'))
				var obj_val = modify(Math.radToDeg(mesh.rotation[axis_letter]));
				obj_val = Math.trimDeg(obj_val)
				mesh.rotation[axis_letter] = Math.degToRad(obj_val);
				mesh.rotation.reorder(old_order);
	
				obj.rotation[0] = Math.radToDeg(mesh.rotation.x);
				obj.rotation[1] = Math.radToDeg(mesh.rotation.y);
				obj.rotation[2] = Math.radToDeg(mesh.rotation.z);
			} else {
				var obj_val = modify(Math.radToDeg(mesh.rotation[axis_letter]));
				obj.rotation[axis] = Math.trimDeg(obj_val);
			}

		} else if (space instanceof Group) {
			let normal = axis == 0 ? THREE.NormalX : (axis == 1 ? THREE.NormalY : THREE.NormalZ)
			let rotWorldMatrix = new THREE.Matrix4();
			rotWorldMatrix.makeRotationAxis(normal, Math.degToRad(modify(0)))
			rotWorldMatrix.multiply(mesh.matrix)
			mesh.matrix.copy(rotWorldMatrix)
			mesh.setRotationFromMatrix(rotWorldMatrix)
			let e = mesh.rotation;
			obj.rotation[0] = Math.radToDeg(e.x);
			obj.rotation[1] = Math.radToDeg(e.y);
			obj.rotation[2] = Math.radToDeg(e.z);

		} else if (space == 0) {
			let normal = axis instanceof THREE.Vector3
				? axis
				: axis == 0 ? THREE.NormalX : (axis == 1 ? THREE.NormalY : THREE.NormalZ)
			let rotWorldMatrix = new THREE.Matrix4();
			rotWorldMatrix.makeRotationAxis(normal, Math.degToRad(modify(0)))
			rotWorldMatrix.multiply(mesh.matrixWorld)

			let inverse = new THREE.Matrix4().copy(mesh.parent.matrixWorld).invert()
			rotWorldMatrix.premultiply(inverse)

			mesh.matrix.copy(rotWorldMatrix)
			mesh.setRotationFromMatrix(rotWorldMatrix)
			let e = mesh.rotation;
			obj.rotation[0] = Math.radToDeg(e.x);
			obj.rotation[1] = Math.radToDeg(e.y);
			obj.rotation[2] = Math.radToDeg(e.z);
			
		}
		if (obj instanceof Group) {
			Canvas.updateView({groups: [obj]});
		}
	})
}
function afterRotateOnAxis() {
	if (Format.cube_size_limiter && Format.cube_size_limiter.rotation_affected && !settings.deactivate_size_limit.value) {
		Cube.all.forEach(cube => {
			Format.cube_size_limiter.move(cube);
			Format.cube_size_limiter.clamp(cube);
		})
		Canvas.updateView({elements: Cube.selected, element_aspects: {transform: true, geometry: true}})
	}
}

BARS.defineActions(function() {


	new BarSelect('transform_space', {
		condition: {
			modes: ['edit', 'animate'],
			tools: ['move_tool', 'resize_tool'],
			method: () => !(Toolbox && Toolbox.selected.id === 'resize_tool' && Mesh.all.length === 0)
		},
		category: 'transform',
		value: 'parent',
		options: {
			global: true,
			parent: true,
			local: true,
			normal: {condition: () => Mesh.selected.length, name: true}
		},
		onChange() {
			updateSelection();
		}
	})
	new BarSelect('rotation_space', {
		condition: {modes: ['edit', 'animate', 'pose'], tools: ['rotate_tool']},
		category: 'transform',
		value: 'local',
		options: {
			global: 'action.transform_space.global',
			parent: 'action.transform_space.parent',
			local: 'action.transform_space.local'
		},
		onChange() {
			updateSelection();
		}
	})
	new BarSelect('transform_pivot_space', {
		condition: {
			modes: ['edit', 'animate'],
			tools: ['pivot_tool']
		},
		category: 'transform',
		value: 'parent',
		options: {
			global: 'action.transform_space.global',
			parent: 'action.transform_space.parent',
			local: 'action.transform_space.local',
		},
		onChange() {
			updateSelection();
		}
	})
	new BarSelect('vertex_snap_mode', {
		options: {
			move: true,
			scale: {condition: () => !Format.integer_size, name: true},
			rotate: true
		},
		category: 'edit'
	})

	function moveOnAxis(modify, axis) {
		selected.forEach(function(obj, i) {
			if (obj instanceof Mesh && obj.getSelectedVertices().length) {

				let vertices = obj.getSelectedVertices();
				vertices.forEach(vkey => {
					obj.vertices[vkey][axis] = modify(obj.vertices[vkey][axis]);
				})
				obj.preview_controller.updateGeometry(obj);

			} else if (obj.movable) {
				let main_pos = obj.from || obj.position;
				var val = modify(main_pos[axis]);

				var before = main_pos[axis];
				main_pos[axis] = val;
				if (obj.to) {
					obj.to[axis] += (val - before);
				}
				if (obj instanceof Cube) {
					if (Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
						Format.cube_size_limiter.move(obj);
					}
					obj.mapAutoUV()
				}
				obj.preview_controller.updateTransform(obj);
				if (obj.preview_controller.updateGeometry) obj.preview_controller.updateGeometry(obj);
			}
		})
		TickUpdates.selection = true;
	}
	function getPos(axis) {
		let element = Outliner.selected[0];
		if (element instanceof Mesh && element.getSelectedVertices().length) {
			let vertices = element.getSelectedVertices();
			let sum = 0;
			vertices.forEach(vkey => sum += element.vertices[vkey][axis]);
			return sum / vertices.length;

		} else if (element.from) {
			return element.from[axis];
		} else {
			return element.origin[axis]
		}
	}
	new NumSlider('slider_pos_x', {
		name: tl('action.slider_pos', ['X']),
		description: tl('action.slider_pos.desc', ['X']),
		color: 'x',
		category: 'transform',
		condition: () => (selected.length && Modes.edit),
		getInterval: getSpatialInterval,
		get: function() {
			return getPos(0);
		},
		change: function(modify) {
			moveOnAxis(modify, 0)
		},
		onBefore: function() {
			Undo.initEdit({elements: selected})
		},
		onAfter: function() {
			Undo.finishEdit('Change element position')
			autoFixMeshEdit()
		}
	}) 
	new NumSlider('slider_pos_y', {
		name: tl('action.slider_pos', ['Y']),
		description: tl('action.slider_pos.desc', ['Y']),
		color: 'y',
		category: 'transform',
		condition: () => (selected.length && Modes.edit),
		getInterval: getSpatialInterval,
		get: function() {
			return getPos(1);
		},
		change: function(modify) {
			moveOnAxis(modify, 1)
		},
		onBefore: function() {
			Undo.initEdit({elements: selected})
		},
		onAfter: function() {
			Undo.finishEdit('Change element position')
			autoFixMeshEdit()
		}
	}) 
	new NumSlider('slider_pos_z', {
		name: tl('action.slider_pos', ['Z']),
		description: tl('action.slider_pos.desc', ['Z']),
		color: 'z',
		category: 'transform',
		condition: () => (selected.length && Modes.edit),
		getInterval: getSpatialInterval,
		get: function() {
			return getPos(2);
		},
		change: function(modify) {
			moveOnAxis(modify, 2)
		},
		onBefore: function() {
			Undo.initEdit({elements: selected})
		},
		onAfter: function() {
			Undo.finishEdit('Change element position')
			autoFixMeshEdit()
		}
	})
	let slider_vector_pos = [BarItems.slider_pos_x, BarItems.slider_pos_y, BarItems.slider_pos_z];
	slider_vector_pos.forEach(slider => slider.slider_vector = slider_vector_pos);


	function resizeOnAxis(modify, axis) {
		selected.forEach(function(obj, i) {
			if (obj.resizable) {
				obj.resize(modify, axis, false, true, obj instanceof Mesh)
			} else if (obj.scalable) {
				obj.scale[axis] = modify(obj.scale[axis]);
				obj.preview_controller.updateTransform(obj);
				if (obj.preview_controller.updateGeometry) obj.preview_controller.updateGeometry(obj);
			}
		})
	}
	new NumSlider('slider_size_x', {
		name: tl('action.slider_size', ['X']),
		description: tl('action.slider_size.desc', ['X']),
		color: 'x',
		category: 'transform',
		condition: () => (Outliner.selected[0] && (Outliner.selected[0].resizable || Outliner.selected[0].scalable) && Modes.edit),
		getInterval: getSpatialInterval,
		get: function() {
			if (Outliner.selected[0].scalable) {
				return Outliner.selected[0].scale[0]
			} else if (Outliner.selected[0].resizable) {
				return Outliner.selected[0].getSize(0, true);
			}
		},
		change: function(modify) {
			resizeOnAxis(modify, 0)
		},
		onBefore: function() {
			Undo.initEdit({elements: Outliner.selected.filter(el => el.resizable)});
		},
		onAfter: function() {
			Undo.finishEdit('Change element size')
			autoFixMeshEdit()
		}
	})
	new NumSlider('slider_size_y', {
		name: tl('action.slider_size', ['Y']),
		description: tl('action.slider_size.desc', ['Y']),
		color: 'y',
		category: 'transform',
		condition: () => (Outliner.selected[0] && (Outliner.selected[0].resizable || Outliner.selected[0].scalable) && Modes.edit),
		getInterval: getSpatialInterval,
		get: function() {
			if (Outliner.selected[0].scalable) {
				return Outliner.selected[0].scale[1]
			} else if (Outliner.selected[0].resizable) {
				return Outliner.selected[0].getSize(1, true);
			}
		},
		change: function(modify) {
			resizeOnAxis(modify, 1)
		},
		onBefore: function() {
			Undo.initEdit({elements: Outliner.selected.filter(el => el.resizable)});
		},
		onAfter: function() {
			Undo.finishEdit('Change element size')
			autoFixMeshEdit()
		}
	})
	new NumSlider('slider_size_z', {
		name: tl('action.slider_size', ['Z']),
		description: tl('action.slider_size.desc', ['Z']),
		color: 'z',
		category: 'transform',
		condition: () => (Outliner.selected[0] && (Outliner.selected[0].resizable || Outliner.selected[0].scalable) && Modes.edit),
		getInterval: getSpatialInterval,
		get: function() {
			if (Outliner.selected[0].scalable) {
				return Outliner.selected[0].scale[2]
			} else if (Outliner.selected[0].resizable) {
				return Outliner.selected[0].getSize(2, true);
			}
		},
		change: function(modify) {
			resizeOnAxis(modify, 2)
		},
		onBefore: function() {
			Undo.initEdit({elements: Outliner.selected.filter(el => el.resizable)});
		},
		onAfter: function() {
			Undo.finishEdit('Change element size')
			autoFixMeshEdit()
		}
	})
	let slider_vector_size = [BarItems.slider_size_x, BarItems.slider_size_y, BarItems.slider_size_z];
	slider_vector_size.forEach(slider => slider.slider_vector = slider_vector_size);
	//Inflate
	new NumSlider('slider_inflate', {
		category: 'transform',
		condition: function() {return Cube.selected.length && Modes.edit},
		getInterval: getSpatialInterval,
		get: function() {
			return Cube.selected[0].inflate
		},
		change: function(modify) {
			Cube.selected.forEach(function(obj, i) {
				let v_before = obj.inflate;
				var v = modify(obj.inflate);

				if (Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
					if (Format.cube_size_limiter.coordinate_limits) {
						let limits = Format.cube_size_limiter.coordinate_limits;
						v = obj.from[0] - Math.clamp(obj.from[0]-v, limits[0], limits[1]);
						v = obj.from[1] - Math.clamp(obj.from[1]-v, limits[0], limits[1]);
						v = obj.from[2] - Math.clamp(obj.from[2]-v, limits[0], limits[1]);
						v = Math.clamp(obj.to[0]+v, limits[0], limits[1]) - obj.to[0];
						v = Math.clamp(obj.to[1]+v, limits[0], limits[1]) - obj.to[1];
						v = Math.clamp(obj.to[2]+v, limits[0], limits[1]) - obj.to[2];

						obj.inflate = v;
					} else {
						if (Format.cube_size_limiter.test(obj, {inflate: v}) == false) {
							obj.inflate = v;
						} else {
							let step = Math.sign(v - v_before) * 0.1;
							let steps = (v - v_before) / step;
							for (let i = 0; i < steps; i++) {
								if (Format.cube_size_limiter.test(obj, {inflate: v_before + i * (steps+1)}) == false) {
									obj.inflate = v_before + i * steps;
									break;
								}
							}
						}
					}
				} else {
					obj.inflate = v;
				}
			})
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({elements: Cube.selected})
		},
		onAfter: function() {
			Undo.finishEdit('Inflate elements')
		}
	})

	//Stretch
	new NumSlider('slider_stretch_x', {
		name: tl('action.slider_stretch', ['X']),
		description: tl('action.slider_stretch.desc', ['X']),
		color: 'x',
		category: 'transform',
		condition: function() {return Format.stretch_cubes && Cube.selected.length && Modes.edit},
		getInterval: getSpatialInterval,
		get: function() {
			return Cube.selected[0].stretch[0]
		},
		change: function(modify) {
			Cube.selected.forEach(function(obj, i) {
				let v_before = obj.stretch[0];
				var v = modify(obj.stretch[0]);

				if (settings.stretch_linked.value === true) {
					obj.stretch.forEach(function (stretch, axis) {
						obj.stretch[axis] = v;
					});
				} else {
					obj.stretch[0] = v;
				}
			})
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({elements: Cube.selected})
		},
		onAfter: function() {
			Undo.finishEdit('Stretch elements')
		}
	})

	new NumSlider('slider_stretch_y', {
		name: tl('action.slider_stretch', ['Y']),
		description: tl('action.slider_stretch.desc', ['Y']),
		color: 'y',
		category: 'transform',
		condition: function() {return Format.stretch_cubes && Cube.selected.length && Modes.edit},
		getInterval: getSpatialInterval,
		get: function() {
			return Cube.selected[0].stretch[1]
		},
		change: function(modify) {
			Cube.selected.forEach(function(obj, i) {
				let v_before = obj.stretch[1];
				var v = modify(obj.stretch[1]);

				if (settings.stretch_linked.value === true) {
					obj.stretch.forEach(function (stretch, axis) {
						obj.stretch[axis] = v;
					});
				} else {
					obj.stretch[1] = v;
				}				
			})
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({elements: Cube.selected})
		},
		onAfter: function() {
			Undo.finishEdit('Stretch elements')
		}
	})

	new NumSlider('slider_stretch_z', {
		name: tl('action.slider_stretch', ['Z']),
		description: tl('action.slider_stretch.desc', ['Z']),
		color: 'z',
		category: 'transform',
		condition: function() {return Format.stretch_cubes && Cube.selected.length && Modes.edit},
		getInterval: getSpatialInterval,
		get: function() {
			return Cube.selected[0].stretch[2]
		},
		change: function(modify) {
			Cube.selected.forEach(function(obj, i) {
				let v_before = obj.stretch[2];
				var v = modify(obj.stretch[2]);

				if (settings.stretch_linked.value === true) {
					obj.stretch.forEach(function (stretch, axis) {
						obj.stretch[axis] = v;
					});
				} else {
					obj.stretch[2] = v;
				}
			})
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({elements: Cube.selected})
		},
		onAfter: function() {
			Undo.finishEdit('Stretch elements')
		}
	})

	let slider_vector_stretch = [BarItems.slider_stretch_x, BarItems.slider_stretch_y, BarItems.slider_stretch_z];
	slider_vector_stretch.forEach(slider => slider.slider_vector = slider_vector_stretch);

	//Rotation
	new NumSlider('slider_rotation_x', {
		name: tl('action.slider_rotation', ['X']),
		description: tl('action.slider_rotation.desc', ['X']),
		color: 'x',
		category: 'transform',
		condition: () => ((Modes.edit || Modes.pose) && getRotationObjects()),
		get: function() {
			if (Format.bone_rig && Group.first_selected) {
				return Group.first_selected.rotation[0];
			}
			let ref = Outliner.selected.find(el => {
				return el.rotatable && (Format.rotate_cubes || el instanceof Cube == false)
			})
			if (ref) return ref.rotation[0];
		},
		change: function(modify) {
			rotateOnAxis(modify, 0, true)
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({elements: Outliner.selected.filter(el => el.rotatable), groups: Group.multi_selected})
		},
		onAfter: function() {
			afterRotateOnAxis();
			Undo.finishEdit(getRotationObjects()?.find(el => el instanceof Group) ? 'Rotate group' : 'Rotate elements');
		},
		getInterval: getRotationInterval
	})
	new NumSlider('slider_rotation_y', {
		name: tl('action.slider_rotation', ['Y']),
		description: tl('action.slider_rotation.desc', ['Y']),
		color: 'y',
		category: 'transform',
		condition: () => ((Modes.edit || Modes.pose) && getRotationObjects()),
		get: function() {
			if (Format.bone_rig && Group.first_selected) {
				return Group.first_selected.rotation[1];
			}
			let ref = Outliner.selected.find(el => {
				return el.rotatable && (Format.rotate_cubes || el instanceof Cube == false)
			})
			if (ref) return ref.rotation[1];
		},
		change: function(modify) {
			rotateOnAxis(modify, 1, true)
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({elements: Outliner.selected.filter(el => el.rotatable), groups: Group.multi_selected})
		},
		onAfter: function() {
			afterRotateOnAxis();
			Undo.finishEdit(getRotationObjects()?.find(el => el instanceof Group) ? 'Rotate group' : 'Rotate elements');
		},
		getInterval: getRotationInterval
	})
	new NumSlider('slider_rotation_z', {
		name: tl('action.slider_rotation', ['Z']),
		description: tl('action.slider_rotation.desc', ['Z']),
		color: 'z',
		category: 'transform',
		condition: () => ((Modes.edit || Modes.pose) && getRotationObjects()),
		get: function() {
			if (Format.bone_rig && Group.first_selected) {
				return Group.first_selected.rotation[2];
			}
			let ref = Outliner.selected.find(el => {
				return el.rotatable && (Format.rotate_cubes || el instanceof Cube == false)
			})
			if (ref) return ref.rotation[2];
		},
		change: function(modify) {
			rotateOnAxis(modify, 2, true)
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({elements: Outliner.selected.filter(el => el.rotatable), groups: Group.multi_selected})
		},
		onAfter: function() {
			afterRotateOnAxis();
			Undo.finishEdit(getRotationObjects()?.find(el => el instanceof Group) ? 'Rotate group' : 'Rotate elements');
		},
		getInterval: getRotationInterval
	})
	let slider_vector_rotation = [BarItems.slider_rotation_x, BarItems.slider_rotation_y, BarItems.slider_rotation_z];
	slider_vector_rotation.forEach(slider => slider.slider_vector = slider_vector_rotation);

	//Origin
	function moveOriginOnAxis(modify, axis) {
		var rotation_objects = getRotationObjects()

		if (rotation_objects && rotation_objects[0] instanceof Group) {
			let elements_to_update = [];
			for (let group of rotation_objects) {
				let val = modify(group.origin[axis]);
				group.origin[axis] = val;
				group.forEachChild(element => elements_to_update.safePush(element), OutlinerElement);
			}
			Canvas.updateView({
				groups: rotation_objects,
				group_aspects: {transform: true},
				elements: elements_to_update,
				element_aspects: {transform: true},
				selection: true
			});
			if (Format.bone_rig) {
				Canvas.updateAllBones();
			}
		} else {
			rotation_objects.forEach(function(obj, i) {
				let val = modify(obj.origin[axis]);
				obj.origin[axis] = val;
			})
			Canvas.updateView({elements: rotation_objects, element_aspects: {transform: true, geometry: true}, selection: true})
		}
		if (Modes.animate) {
			Animator.preview();
		}
	}
	new NumSlider('slider_origin_x', {
		name: tl('action.slider_origin', ['X']),
		description: tl('action.slider_origin.desc', ['X']),
		color: 'x',
		category: 'transform',
		condition: () => (Modes.edit || Modes.animate || Modes.pose) && getRotationObjects() && (Group.first_selected || Outliner.selected.length > Locator.selected.length),
		getInterval: getSpatialInterval,
		get: function() {
			if (Format.bone_rig && Group.first_selected) {
				return Group.first_selected.origin[0];
			}
			let ref = Outliner.selected.find(el => {
				return el.rotatable && el.origin && (Format.rotate_cubes || el instanceof Cube == false)
			})
			if (ref) return ref.origin[0];
		},
		change: function(modify) {
			if (Modes.pose) return;
			moveOriginOnAxis(modify, 0)
		},
		onBefore: function() {
			Undo.initEdit({elements: selected, groups: Group.multi_selected})
		},
		onAfter: function() {
			Undo.finishEdit('Change pivot point')
		}
	})
	new NumSlider('slider_origin_y', {
		name: tl('action.slider_origin', ['Y']),
		description: tl('action.slider_origin.desc', ['Y']),
		color: 'y',
		category: 'transform',
		condition: () => (Modes.edit || Modes.animate || Modes.pose) && getRotationObjects() && (Group.first_selected || Outliner.selected.length > Locator.selected.length),
		getInterval: getSpatialInterval,
		get: function() {
			if (Format.bone_rig && Group.first_selected) {
				return Group.first_selected.origin[1];
			}
			let ref = Outliner.selected.find(el => {
				return el.rotatable && el.origin && (Format.rotate_cubes || el instanceof Cube == false)
			})
			if (ref) return ref.origin[1];
		},
		change: function(modify) {
			if (Modes.pose) return;
			moveOriginOnAxis(modify, 1)
		},
		onBefore: function() {
			Undo.initEdit({elements: selected, groups: Group.multi_selected})
		},
		onAfter: function() {
			Undo.finishEdit('Change pivot point')
		}
	})
	new NumSlider('slider_origin_z', {
		name: tl('action.slider_origin', ['Z']),
		description: tl('action.slider_origin.desc', ['Z']),
		color: 'z',
		category: 'transform',
		condition: () => (Modes.edit || Modes.animate || Modes.pose) && getRotationObjects() && (Group.first_selected || Outliner.selected.length > Locator.selected.length),
		getInterval: getSpatialInterval,
		get: function() {
			if (Format.bone_rig && Group.first_selected) {
				return Group.first_selected.origin[2];
			}
			let ref = Outliner.selected.find(el => {
				return el.rotatable && el.origin && (Format.rotate_cubes || el instanceof Cube == false)
			})
			if (ref) return ref.origin[2];
		},
		change: function(modify) {
			if (Modes.pose) return;
			moveOriginOnAxis(modify, 2)
		},
		onBefore: function() {
			Undo.initEdit({elements: selected, groups: Group.multi_selected})
		},
		onAfter: function() {
			Undo.finishEdit('Change pivot point')
		}
	})
	let slider_vector_origin = [BarItems.slider_origin_x, BarItems.slider_origin_y, BarItems.slider_origin_z];
	slider_vector_origin.forEach(slider => slider.slider_vector = slider_vector_origin);

	new Action('rotate_x_cw', {
		name: tl('action.rotate_cw', 'X'),
		icon: 'rotate_right',
		color: 'x',
		category: 'transform',
		click() {
			rotateSelected(0, 1);
		}
	})
	new Action('rotate_x_ccw', {
		name: tl('action.rotate_ccw', 'X'),
		icon: 'rotate_left',
		color: 'x',
		category: 'transform',
		click() {
			rotateSelected(0, 3);
		}
	})
	new Action('rotate_y_cw', {
		name: tl('action.rotate_cw', 'Y'),
		icon: 'rotate_right',
		color: 'y',
		category: 'transform',
		click() {
			rotateSelected(1, 1);
		}
	})
	new Action('rotate_y_ccw', {
		name: tl('action.rotate_ccw', 'Y'),
		icon: 'rotate_left',
		color: 'y',
		category: 'transform',
		click() {
			rotateSelected(1, 3);
		}
	})
	new Action('rotate_z_cw', {
		name: tl('action.rotate_cw', 'Z'),
		icon: 'rotate_right',
		color: 'z',
		category: 'transform',
		click() {
			rotateSelected(2, 1);
		}
	})
	new Action('rotate_z_ccw', {
		name: tl('action.rotate_ccw', 'Z'),
		icon: 'rotate_left',
		color: 'z',
		category: 'transform',
		click() {
			rotateSelected(2, 3);
		}
	})

	new Action('flip_x', {
		name: tl('action.flip', 'X'),
		icon: 'icon-mirror_x',
		color: 'x',
		category: 'transform',
		click() {
			mirrorSelected(0);
		}
	})
	new Action('flip_y', {
		name: tl('action.flip', 'Y'),
		icon: 'icon-mirror_y',
		color: 'y',
		category: 'transform',
		click() {
			mirrorSelected(1);
		}
	})
	new Action('flip_z', {
		name: tl('action.flip', 'Z'),
		icon: 'icon-mirror_z',
		color: 'z',
		category: 'transform',
		click() {
			mirrorSelected(2);
		}
	})

	new Action('center_x', {
		name: tl('action.center', 'X'),
		icon: 'vertical_align_center',
		color: 'x',
		category: 'transform',
		click() {
			Undo.initEdit({elements: Outliner.selected, outliner: true});
			centerElements(0, true);
			Undo.finishEdit('Center selection on X axis')
		}
	})
	new Action('center_y', {
		name: tl('action.center', 'Y'),
		icon: 'vertical_align_center',
		color: 'y',
		category: 'transform',
		click() {
			Undo.initEdit({elements: Outliner.selected, outliner: true});
			centerElements(1, true);
			Undo.finishEdit('Center selection on Y axis')
		}
	})
	new Action('center_z', {
		name: tl('action.center', 'Z'),
		icon: 'vertical_align_center',
		color: 'z',
		category: 'transform',
		click() {
			Undo.initEdit({elements: Outliner.selected, outliner: true});
			centerElements(2, true);
			Undo.finishEdit('Center selection on Z axis')
		}
	})
	new Action('center_lateral', {
		icon: 'filter_center_focus',
		category: 'transform',
		click() {
			Undo.initEdit({elements: Outliner.selected, outliner: true});
			centerElements(0, false);
			centerElements(2, true);
			Undo.finishEdit('Center selection')
		}
	})

	//Move Cube Keys
	new Action('move_up', {
		icon: 'arrow_upward',
		category: 'transform',
		condition: {modes: ['edit'], method: () => (!open_menu && selected.length)},
		keybind: new Keybind({key: 38, ctrl: null, shift: null}),
		click(e) {
			if (Prop.active_panel === 'uv') {
				UVEditor.moveSelection([0, -1], e)
			} else {
				moveElementsRelative(-1, 2, e)
			}
		}
	})
	new Action('move_down', {
		icon: 'arrow_downward',
		category: 'transform',
		condition: {modes: ['edit'], method: () => (!open_menu && selected.length)},
		keybind: new Keybind({key: 40, ctrl: null, shift: null}),
		click(e) {
			if (Prop.active_panel === 'uv') {
				UVEditor.moveSelection([0, 1], e)
			} else {
				moveElementsRelative(1, 2, e)
			}
		}
	})
	new Action('move_left', {
		icon: 'arrow_back',
		category: 'transform',
		condition: {modes: ['edit'], method: () => (!open_menu && selected.length)},
		keybind: new Keybind({key: 37, ctrl: null, shift: null}),
		click(e) {
			if (Prop.active_panel === 'uv') {
				UVEditor.moveSelection([-1, 0], e)
			} else {
				moveElementsRelative(-1, 0, e)
			}
		}
	})
	new Action('move_right', {
		icon: 'arrow_forward',
		category: 'transform',
		condition: {modes: ['edit'], method: () => (!open_menu && selected.length)},
		keybind: new Keybind({key: 39, ctrl: null, shift: null}),
		click(e) {
			if (Prop.active_panel === 'uv') {
				UVEditor.moveSelection([1, 0], e)
			} else {
				moveElementsRelative(1, 0, e)
			}
		}
	})
	new Action('move_forth', {
		icon: 'keyboard_arrow_up',
		category: 'transform',
		condition: {modes: ['edit'], method: () => (!open_menu && selected.length)},
		keybind: new Keybind({key: 33, ctrl: null, shift: null}),
		click(e) {moveElementsRelative(-1, 1, e)}
	})
	new Action('move_back', {
		icon: 'keyboard_arrow_down',
		category: 'transform',
		condition: {modes: ['edit'], method: () => (!open_menu && selected.length)},
		keybind: new Keybind({key: 34, ctrl: null, shift: null}),
		click(e) {moveElementsRelative(1, 1, e)}
	})

	new Toggle('toggle_visibility', {
		icon: 'visibility',
		category: 'transform',
		onChange() {toggleCubeProperty('visibility')}
	})
	new Toggle('toggle_locked', {
		icon: 'fas.fa-lock',
		category: 'transform',
		onChange() {toggleCubeProperty('locked')}
	})
	new Toggle('toggle_export', {
		icon: 'save',
		category: 'transform',
		onChange() {toggleCubeProperty('export')}
	})
	new Toggle('toggle_autouv', {
		icon: 'fullscreen_exit',
		category: 'transform',
		condition: {modes: ['edit']},
		onChange() {toggleCubeProperty('autouv')}
	})
	new Toggle('toggle_shade', {
		icon: 'wb_sunny',
		category: 'transform',
		condition: () => Format.java_cube_shading_properties && Modes.edit,
		onChange() {toggleCubeProperty('shade')}
	})
	new Toggle('toggle_mirror_uv', {
		icon: 'icon-mirror_x',
		category: 'transform',
		condition: () => (Modes.edit || Modes.paint) && UVEditor.isBoxUV(),
		onChange() {toggleCubeProperty('mirror_uv')}
	})
	function updateToggle(toggle, key) {
		if (!Condition(toggle.condition)) return;
		let first = Outliner.selected.find(element => element[key] != undefined);
		let value = first && first[key];
		toggle.value = !!value;
		toggle.updateEnabledState();
	}
	Blockbench.on('update_selection', () => {
		updateToggle(BarItems.toggle_visibility, 'visibility');
		updateToggle(BarItems.toggle_locked, 'locked');
		updateToggle(BarItems.toggle_export, 'export');
		updateToggle(BarItems.toggle_autouv, 'autouv');
		updateToggle(BarItems.toggle_shade, 'shade');
		updateToggle(BarItems.toggle_mirror_uv, 'mirror_uv');
	})
	new Action('update_autouv', {
		icon: 'brightness_auto',
		category: 'transform',
		condition: () => !Modes.edit && UVEditor.isFaceUV(),
		click() {
			if (Cube.selected.length) {
				Undo.initEdit({elements: Cube.selected[0].forSelected(), selection: true})
				Cube.selected[0].forSelected(function(cube) {
					cube.mapAutoUV()
				})
				Undo.finishEdit('Update auto UV')
			}
		}
	})
	new Toggle('toggle_stretch_linked', {
		icon: 'fas.fa-link',
		category: 'transform',
		linked_setting: 'stretch_linked',
		condition: () => Format.stretch_cubes && Cube.selected.length && Modes.edit
	})
	new Action('origin_to_geometry', {
		icon: 'filter_center_focus',
		category: 'transform',
		condition: {modes: ['edit', 'animate'], selected: {outliner: true}},
		click() {
			if (Format.bone_rig && Group.first_selected) {
				Undo.initEdit({groups: Group.multi_selected})

				for (let group of Group.multi_selected) {
					if (group.children.length === 0) continue;
					let position = new THREE.Vector3();
					let amount = 0;
					group.children.forEach(function(obj) {
						if (obj.getWorldCenter) {
							position.add(obj.getWorldCenter());
							amount++;
						}
					})
					position.divideScalar(amount);
					group.mesh.parent.worldToLocal(position);
					if (group.parent instanceof Group) {
						position.x += group.parent.origin[0];
						position.y += group.parent.origin[1];
						position.z += group.parent.origin[2];
					}
					group.transferOrigin(position.toArray());
				}

			} else if (Outliner.selected[0]) {
				Undo.initEdit({elements: Outliner.selected})

				var center = getSelectionCenter();
				var original_center = center.slice();
				
				Outliner.selected.forEach(element => {
					if (!element.transferOrigin) return;
					if (Format.bone_rig && element.parent instanceof Group) {
						var v = new THREE.Vector3().fromArray(original_center);
						element.parent.mesh.worldToLocal(v);
						v.x += element.parent.origin[0];
						v.y += element.parent.origin[1];
						v.z += element.parent.origin[2];
						center = v.toArray();
						element.transferOrigin(center)
					} else {
						element.transferOrigin(original_center)
					}
				})
			}
			Canvas.updateView({
				elements: Outliner.selected,
				element_aspects: {transform: true, geometry: true},
				groups: Group.multi_selected,
				selection: true
			});
			Undo.finishEdit('Center pivot');
		}
	})
	new Action('center_individual_pivots', {
		icon: 'center_focus_weak',
		category: 'transform',
		condition: {modes: ['edit', 'animate'], selected: {outliner: true}},
		click() {
			Undo.initEdit({outliner: true, elements: Outliner.selected})
			for (let group of Group.all) {
				if (!group.selected) continue;
				let position = new THREE.Vector3();
				let amount = 0;
				group.children.forEach((obj) => {
					if (obj.getWorldCenter) {
						position.add(obj.getWorldCenter());
						amount++;
					}
				})
				position.divideScalar(amount);
				group.mesh.parent.worldToLocal(position);
				if (group.parent instanceof Group) {
					position.x += group.parent.origin[0];
					position.y += group.parent.origin[1];
					position.z += group.parent.origin[2];
				}
				group.transferOrigin(position.toArray());

			}
			for (let element of Outliner.selected) {
				if (!element.getWorldCenter || !element.transferOrigin) continue;
				let center = element.getWorldCenter().toArray();
				let original_center = center.slice();
				
				if (Format.bone_rig && element.parent instanceof Group) {
					let v = new THREE.Vector3().fromArray(original_center);
					element.parent.mesh.worldToLocal(v);
					v.x += element.parent.origin[0];
					v.y += element.parent.origin[1];
					v.z += element.parent.origin[2];
					center = v.toArray();
					element.transferOrigin(center)
				} else {
					element.transferOrigin(original_center)
				}
			}
			Canvas.updateView({
				elements: Outliner.selected,
				element_aspects: {transform: true, geometry: true},
				groups: Group.multi_selected,
				selection: true
			});
			Undo.finishEdit('Center individual pivots');
		}
	})
	new Action('rescale_toggle', {
		icon: 'check_box_outline_blank',
		category: 'transform',
		condition: function() {return Format.rotation_limit && Cube.selected.length;},
		click() {
			Undo.initEdit({elements: Cube.selected})
			var value = !Cube.selected[0].rescale
			Cube.selected.forEach(function(cube) {
				cube.rescale = value
			})
			Canvas.updatePositions()
			updateNslideValues()
			Undo.finishEdit('Toggle cube rescale')
		}
	})
	new Action('bone_reset_toggle', {
		icon: 'check_box_outline_blank',
		category: 'transform',
		condition: function() {return Format.bone_rig && Group.first_selected;},
		click() {
			Undo.initEdit({groups: Group.multi_selected})
			for (let group of Group.multi_selected) {
				group.reset = !Group.first_selected.reset
			}
			updateNslideValues()
			Undo.finishEdit('Toggle bone reset')
		}
	})

	new Action('remove_blank_faces', {
		icon: 'cancel_presentation',
		condition: () => !Format.box_uv,
		click() {
			let elements = Outliner.selected.filter(el => el.faces);
			Undo.initEdit({elements})
			var arr = elements.slice()
			var empty_elements = [];
			var cleared_total = 0;
			unselectAllElements()
			arr.forEach(element => {
				var clear_count = 0;
				var original_face_count = Object.keys(element.faces).length
				for (var face in element.faces) {
					var face_tag = element.faces[face];
					if (face_tag.texture == false) {
						if (element instanceof Cube) {
							face_tag.texture = null;
						} else {
							delete element.faces[face];
						}
						clear_count++;
						cleared_total++;
					}
				}
				if (clear_count == original_face_count) {
					empty_elements.push(element);
				}
			})
			updateSelection();
			Blockbench.showQuickMessage(tl('message.removed_faces', [cleared_total]))
			if (empty_elements.length) {
				Blockbench.showMessageBox({
					title: tl('message.cleared_blank_faces.title'),
					icon: 'rotate_right',
					message: tl('message.cleared_blank_faces.message', [empty_elements.length]),
					buttons: ['generic.remove', 'dialog.cancel'],
					confirm: 0,
					cancel: 1,
				}, function(r) {
					empty_elements.forEach(element => {
						if (r == 0) {
							element.remove();
							elements.remove(element)
						} else {
							for (var face in element.faces) {
								element.faces[face].texture = false;
							}
						}
					})
					updateSelection();
					Canvas.updateView({elements, element_aspects: {geometry: true, faces: true, uv: true}})
					Undo.finishEdit('Remove blank faces');
				})
			} else {
				Canvas.updateView({elements, element_aspects: {geometry: true, faces: true, uv: true}})
				Undo.finishEdit('Remove blank faces');
			}
		}
	})
	new Action('auto_set_cullfaces', {
		icon: 'smart_button',
		condition: () => Modes.edit && Format.cullfaces,
		click() {
			if (!Cube.selected.length) {
				BarItems.select_all.click();
			}
			Undo.initEdit({elements: Cube.selected});
			
			Cube.selected.forEach(cube => {
				let vertices = cube.getGlobalVertexPositions();
				['east', 'up', 'south', 'west', 'down', 'north'].forEach((fkey, index) => {
					let axis = index % 3;
					let face = cube.faces[fkey];
					if (face.texture === null) return;
					let face_corners = face.getVertexIndices().map(vindex => vertices[vindex]);
					let offset = index < 3 ? [15.98, 32] : [-16, 0.02];

					let culled = face_corners.allAre(corner => {
						let off_axes = [0, 1, 2].filter(v => axis !== v);
						return (corner[axis] > offset[0] && corner[axis] < offset[1]
							&& corner[off_axes[0]] >= 0 && corner[off_axes[0]] <= 16
							&& corner[off_axes[1]] >= 0 && corner[off_axes[1]] <= 16
						);
					})
					face.cullface = culled ? fkey : '';
				});
			})

			updateSelection();
			Undo.finishEdit('Automatically set cullfaces');
		}
	})
})
