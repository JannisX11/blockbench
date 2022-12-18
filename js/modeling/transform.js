//Actions
function origin2geometry() {

	if (Format.bone_rig && Group.selected) {
		Undo.initEdit({group: Group.selected})

		if (!Group.selected || Group.selected.children.length === 0) return;
		var position = new THREE.Vector3();
		let amount = 0;
		Group.selected.children.forEach(function(obj) {
			if (obj.getWorldCenter) {
				position.add(obj.getWorldCenter());
				amount++;
			}
		})
		position.divideScalar(amount);
		Group.selected.mesh.parent.worldToLocal(position);
		if (Group.selected.parent instanceof Group) {
			position.x += Group.selected.parent.origin[0];
			position.y += Group.selected.parent.origin[1];
			position.z += Group.selected.parent.origin[2];
		}
		Group.selected.transferOrigin(position.toArray());

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
		groups: Group.selected && [Group.selected],
		selection: true
	});
	Undo.finishEdit('Center pivot')
}
function getSelectionCenter(all = false) {
	if (Group.selected && selected.length == 0 && !all) {
		let vec = THREE.fastWorldPosition(Group.selected.mesh, new THREE.Vector3());
		return vec.toArray();
	}

	let max = [-Infinity, -Infinity, -Infinity];
	let min = [ Infinity,  Infinity,  Infinity];
	let elements = Outliner.selected.length ? Outliner.selected : Outliner.elements;
	elements.forEach(element => {
		if (element.getWorldCenter) {
			var pos = element.getWorldCenter();
			min[0] = Math.min(pos.x, min[0]);	max[0] = Math.max(pos.x, max[0]);
			min[1] = Math.min(pos.y, min[1]);	max[1] = Math.max(pos.y, max[1]);
			min[2] = Math.min(pos.z, min[2]);	max[2] = Math.max(pos.z, max[2]);
		}
	})
	let center = max.V3_add(min).V3_divide(2);
	
	if (!Format.centered_grid) {
		center.V3_add(8, 8, 8)
	}
	return center;
}
//Movement
function moveElementsRelative(difference, index, event) { //Multiple
	if (!quad_previews.current || !Outliner.selected.length) {
		return;
	}
	var _has_groups = Format.bone_rig && Group.selected && Group.selected.matchesSelection() && Toolbox.selected.transformerMode == 'translate';

	Undo.initEdit({elements: Outliner.selected, outliner: _has_groups})
	var axes = []
	// < >
	// PageUpDown
	// ^ v
	var facing = quad_previews.current.getFacingDirection()
	var height = quad_previews.current.getFacingHeight()
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

	moveElementsInSpace(difference, axes[index]);
	updateSelection();

	Undo.finishEdit('Move elements')
}
//Rotate
function rotateSelected(axis, steps) {
	let affected = [...Cube.selected, ...Mesh.selected];
	if (!affected.length) return;
	Undo.initEdit({elements: affected});
	if (!steps) steps = 1
	var origin = [8, 8, 8]
	if (Group.selected && Format.bone_rig) {
		origin = Group.selected.origin.slice()
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
function mirrorSelected(axis) {
	if (Modes.animate && Timeline.selected.length) {

		Undo.initEdit({keyframes: Timeline.selected})
		for (var kf of Timeline.selected) {
			kf.flip(axis)
		}
		Undo.finishEdit('Flipped keyframes');
		updateKeyframeSelection();
		Animator.preview();

	} else if (Modes.edit && (Outliner.selected.length || Group.selected)) {
		Undo.initEdit({elements: selected, outliner: Format.bone_rig || Group.selected, selection: true})
		var center = Format.centered_grid ? 0 : 8;
		if (Format.bone_rig) {
			let flip_pairs = {
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
			}
			if (Group.selected && Group.selected.matchesSelection()) {
				function flipGroup(group) {
					for (var i = 0; i < 3; i++) {
						if (i === axis) {
							group.origin[i] *= -1
						} else {
							group.rotation[i] *= -1
						}
					}
					function matchAndReplace(a, b) {
						if (group.name.includes(a)) {
							let name = group._original_name
										? group._original_name.replace(a, b)
										: group.name.replace(a, b).replace(/2/, '');
							if (!Group.all.find(g => g.name == name)) group.name = name;
							return true;
						}
					}
					let pairs = flip_pairs[axis];
					for (let a in pairs) {
						let b = pairs[a];
						if (matchAndReplace(a, b)) break;
						if (matchAndReplace(b, a)) break;
					}
					Canvas.updateAllBones([group]);
				}
				flipGroup(Group.selected)
				Group.selected.forEachChild(flipGroup, Group)
			}
		}
		selected.forEach(function(obj) {
			obj.flip(axis, center, false)
			if (obj instanceof Cube && obj.box_uv && axis === 0) {
				obj.mirror_uv = !obj.mirror_uv
				Canvas.updateUV(obj)
			}
		})
		updateSelection()
		Undo.finishEdit('Flip selection')
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
		if (Group.selected) {
			Vertexsnap.addVertices(Group.selected)
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
			Vertexsnap.group = Group.selected;
			if (data.element instanceof Mesh && BarItems.selection_mode.value == 'vertex') {
				if (!Project.selected_vertices[data.element.uuid]) {
					Project.selected_vertices[data.element.uuid] = [];
				}
				Project.selected_vertices[data.element.uuid].safePush(data.vertex);
			}
			Vertexsnap.selected_vertices = JSON.parse(JSON.stringify(Project.selected_vertices));
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
	snap: function(data) {
		Undo.initEdit({elements: Vertexsnap.elements, outliner: !!Vertexsnap.group});

		let mode = BarItems.vertex_snap_mode.get();

		if (Vertexsnap.move_origin) {
			if (Vertexsnap.group) {
				let vec = Vertexsnap.getGlobalVertexPos(data.element, data.vertex);

				if (Format.bone_rig && Vertexsnap.group.parent instanceof Group && Vertexsnap.group.mesh.parent) {
					Vertexsnap.group.mesh.parent.worldToLocal(vec);
				}
				let vec_array = vec.toArray()
				vec_array.V3_add(Vertexsnap.group.parent.origin);
				Vertexsnap.group.transferOrigin(vec_array)

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

			var global_delta = Vertexsnap.getGlobalVertexPos(data.element, data.vertex);
			global_delta.sub(Vertexsnap.vertex_pos)

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
					var cube_pos = new THREE.Vector3().copy(global_delta).applyQuaternion(q)

					for (i=0; i<3; i++) {
						if (m[i] === 1) {
							obj.to[i] = obj.to[i] + cube_pos.getComponent(i);
						} else {
							obj.from[i] = obj.from[i] + cube_pos.getComponent(i);
						}
					}
					if (Format.cube_size_limiter) {
						Format.cube_size_limiter.clamp(obj)
					}
					if (obj.box_uv && obj.visibility) {
						Canvas.updateUV(obj)
					}
				})
			} else if (mode === 'move') {
				Vertexsnap.elements.forEach(function(obj) {
					var cube_pos = new THREE.Vector3().copy(global_delta)

					if (obj instanceof Mesh && Vertexsnap.selected_vertices && Vertexsnap.selected_vertices[obj.uuid]) {
						let vertices = Vertexsnap.selected_vertices[obj.uuid];
						var q = obj.mesh.getWorldQuaternion(Reusable.quat1).invert();
						cube_pos.applyQuaternion(q);
						let cube_pos_array = cube_pos.toArray();
						vertices.forEach(vkey => {
							if (obj.vertices[vkey]) obj.vertices[vkey].V3_add(cube_pos_array);
						})

					} else {
						if (Format.bone_rig && obj.parent instanceof Group) {
							var q = obj.mesh.parent.getWorldQuaternion(Reusable.quat1).invert();
							cube_pos.applyQuaternion(q);
						}
						if (obj instanceof Cube && Format.rotate_cubes) {
							obj.origin.V3_add(cube_pos);
						}
						var in_box = obj.moveVector(cube_pos.toArray());
						if (!in_box && Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
							Blockbench.showMessageBox({translateKey: 'canvas_limit_error'})
						}
					}
				})
			}

		}

		Vertexsnap.clearVertexGizmos()
		let update_options = {
			elements: Vertexsnap.elements,
			element_aspects: {transform: true, geometry: true},
		};
		if (Vertexsnap.group) {
			update_options.elements = [...update_options.elements];
			Vertexsnap.group.forEachChild(child => {
				update_options.elements.safePush(child);
			}, OutlinerElement);
			update_options.groups = [Vertexsnap.group];
			update_options.group_aspects = {transform: true};
		}
		Canvas.updateView(update_options);
		Undo.finishEdit('Use vertex snap');
		Vertexsnap.step1 = true;
	}
}
//Scale
function getScaleAllGroups() {
	let groups = [];
	if (!Format.bone_rig) return groups;
	if (Group.selected) {
		Group.selected.forEachChild((g) => {
			groups.push(g);
		}, Group)
	} else if (Outliner.selected.length == Outliner.elements.length && Group.all.length) {
		groups = Group.all;
	}
	return groups;
}
function scaleAll(save, size) {
	if (save === true) {
		hideDialog()
	}
	if (size === undefined) {
		size = $('#model_scale_label').val()
	}
	let origin = [
		parseFloat($('#scaling_origin_x').val())||0,
		parseFloat($('#scaling_origin_y').val())||0,
		parseFloat($('#scaling_origin_z').val())||0,
	]
	let axis_enabled = [
		$('#model_scale_x_axis').is(':checked'),
		$('#model_scale_y_axis').is(':checked'),
		$('#model_scale_z_axis').is(':checked'),
	];
	let overflow = [];
	Outliner.selected.forEach(function(obj) {
		obj.autouv = 0;
		origin.forEach(function(ogn, i) {
			if (axis_enabled[i]) {

				if (obj.from) {
					obj.from[i] = (obj.before.from[i] - obj.inflate - ogn) * size;
					obj.from[i] = obj.from[i] + obj.inflate + ogn;
				}

				if (obj.to) {
					obj.to[i] = (obj.before.to[i] + obj.inflate - ogn) * size;
					obj.to[i] = obj.to[i] - obj.inflate + ogn;
					if (Format.integer_size) {
						obj.to[i] = obj.from[i] + Math.round(obj.to[i] - obj.from[i])
					}
				}

				if (obj.origin) {
					obj.origin[i] = (obj.before.origin[i] - ogn) * size;
					obj.origin[i] = obj.origin[i] + ogn;
				}

				if (obj instanceof Mesh) {
					for (let key in obj.vertices) {
						obj.vertices[key][i] = obj.before.vertices[key][i] * size;
					}
				}
			} else {

				if (obj.from) obj.from[i] = obj.before.from[i];
				if (obj.to) obj.to[i] = obj.before.to[i];

				if (obj.origin) obj.origin[i] = obj.before.origin[i];

				if (obj instanceof Mesh) {
					for (let key in obj.vertices) {
						obj.vertices[key][i] = obj.before.vertices[key][i];
					}
				}
			}
		})
		if (obj instanceof Cube && Format.cube_size_limiter) {
			if (Format.cube_size_limiter.test(obj)) {
				overflow.push(obj);
			}
			if (!settings.deactivate_size_limit.value) {
				Format.cube_size_limiter.clamp(obj);
			}
		}
		if (save === true) {
			delete obj.before
		}
		if (obj instanceof Cube && obj.box_uv) {
			Canvas.updateUV(obj)
		}
	})
	getScaleAllGroups().forEach((g) => {
		g.origin[0] = g.old_origin[0] * size
		g.origin[1] = g.old_origin[1] * size
		g.origin[2] = g.old_origin[2] * size
		if (save === true) {
			delete g.old_origin
		}
	}, Group)
	if (overflow.length && Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
		scaleAll.overflow = overflow;
		$('#scaling_clipping_warning').text('Model clipping: Your model is too large for the canvas')
		$('#scale_overflow_btn').css('display', 'inline-block')
	} else {
		$('#scaling_clipping_warning').text('')
		$('#scale_overflow_btn').hide()
	}
	Canvas.updateView({
		elements: Outliner.selected,
		element_aspects: {geometry: true, transform: true},
		groups: getScaleAllGroups(),
		group_aspects: {transform: true},
	})
	if (save === true) {
		Undo.finishEdit('Scale model')
	}
}
function modelScaleSync(label) {
	if (label) {
		var size = $('#model_scale_label').val()
		$('#model_scale_range').val(size)
	} else {
		var size = $('#model_scale_range').val()
		$('#model_scale_label').val(size)
	}
	scaleAll(false, size)
}
function cancelScaleAll() {
	Outliner.selected.forEach(function(obj) {
		if (obj === undefined) return;
		if (obj.from) obj.from.V3_set(obj.before.from);
		if (obj.to) obj.to.V3_set(obj.before.to);
		if (obj.origin) obj.origin.V3_set(obj.before.origin);
		if (obj instanceof Mesh) {
			for (let key in obj.vertices) {
				obj.vertices[key].V3_set(obj.before.vertices[key]);
			}
		}
		delete obj.before
		if (obj instanceof Cube && obj.box_uv) {
			Canvas.updateUV(obj)
		}
	})
	getScaleAllGroups().forEach((g) => {
		g.origin[0] = g.old_origin[0]
		g.origin[1] = g.old_origin[1]
		g.origin[2] = g.old_origin[2]
		delete g.old_origin
	}, Group)
	Canvas.updateView({
		elements: Outliner.selected,
		element_aspects: {geometry: true, transform: true},
		groups: getScaleAllGroups(),
		group_aspects: {transform: true},
	})
	hideDialog()
}
function setScaleAllPivot(mode) {
	if (mode === 'selection') {
		var center = getSelectionCenter()
	} else {
		var center = Cube.selected[0] && Cube.selected[0].origin;
	}
	if (center) {
		$('input#scaling_origin_x').val(center[0]);
		$('input#scaling_origin_y').val(center[1]);
		$('input#scaling_origin_z').val(center[2]);
	}
}
function scaleAllSelectOverflow() {
	cancelScaleAll()
	selected.empty();
	scaleAll.overflow.forEach(obj => {
		obj.selectLow()
	})
	updateSelection();
}
//Center
function centerElementsAll(axis) {
	centerElements(0, false);
	centerElements(2, false);
}
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
	let space = Transformer.getTransformSpace()
	let group = Format.bone_rig && Group.selected && Group.selected.matchesSelection() && Group.selected;
	var group_m;
	let quaternion = new THREE.Quaternion();
	let vector = new THREE.Vector3();

	if (group) {
		if (space === 0) {
			group_m = vector.set(0, 0, 0);
			group_m[getAxisLetter(axis)] = difference;

			var rotation = new THREE.Quaternion();
			group.mesh.parent.getWorldQuaternion(rotation);
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
		Canvas.updateAllBones([Group.selected]);
	}

	Outliner.selected.forEach(el => {

		if (!group_m && el instanceof Mesh && (el.getSelectedVertices().length > 0 || space >= 2)) {

			let selection_rotation = space == 3 && el.getSelectionRotation();
			let selected_vertices = el.getSelectedVertices();
			if (!selected_vertices.length) selected_vertices = Object.keys(el.vertices)
			selected_vertices.forEach(key => {

				if (space == 2) {
					el.vertices[key][axis] += difference;

				} else if (space == 3) {
					let m = vector.set(0, 0, 0);
					m[getAxisLetter(axis)] = difference;
					m.applyEuler(selection_rotation);
					el.vertices[key].V3_add(m.x, m.y, m.z);

				} else {
					let m = vector.set(0, 0, 0);
					m[getAxisLetter(axis)] = difference;
					m.applyQuaternion(el.mesh.getWorldQuaternion(quaternion).invert());
					el.vertices[key].V3_add(m.x, m.y, m.z);
				}

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
				let move_origin = !!group;
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
function getRotationObject() {
	if (Format.bone_rig && Group.selected) return Group.selected;
	let elements = Outliner.selected.filter(element => {
		return element.rotatable && (element instanceof Cube == false || Format.rotate_cubes);
	})
	if (elements.length) return elements;
}
function rotateOnAxis(modify, axis, slider) {
	var things = getRotationObject();
	if (!things) return;
	if (things instanceof Array == false) things = [things];
	/*
	if (Format.bone_rig && Group.selected) {	
		if (!Group.selected) return;
		let obj = Group.selected.mesh

		if (typeof space == 'object') {
			let normal = axis == 0 ? THREE.NormalX : (axis == 1 ? THREE.NormalY : THREE.NormalZ)
			let rotWorldMatrix = new THREE.Matrix4();
			rotWorldMatrix.makeRotationAxis(normal, Math.degToRad(modify(0)))
			rotWorldMatrix.multiply(obj.matrix)
			obj.matrix.copy(rotWorldMatrix)
			obj.setRotationFromMatrix(rotWorldMatrix)
			let e = obj.rotation;
			Group.selected.rotation[0] = Math.radToDeg(e.x);
			Group.selected.rotation[1] = Math.radToDeg(e.y);
			Group.selected.rotation[2] = Math.radToDeg(e.z);
			Canvas.updateAllBones()

		} else if (space == 0) {
			let normal = axis == 0 ? THREE.NormalX : (axis == 1 ? THREE.NormalY : THREE.NormalZ)
			let rotWorldMatrix = new THREE.Matrix4();
			rotWorldMatrix.makeRotationAxis(normal, Math.degToRad(modify(0)))
			rotWorldMatrix.multiply(obj.matrixWorld)

			let inverse = new THREE.Matrix4().copy(obj.parent.matrixWorld).invert()
			rotWorldMatrix.premultiply(inverse)

			obj.matrix.copy(rotWorldMatrix)
			obj.setRotationFromMatrix(rotWorldMatrix)
			let e = obj.rotation;
			Group.selected.rotation[0] = Math.radToDeg(e.x);
			Group.selected.rotation[1] = Math.radToDeg(e.y);
			Group.selected.rotation[2] = Math.radToDeg(e.z);
			Canvas.updateAllBones()

		} else {
			var value = modify(Group.selected.rotation[axis]);
			Group.selected.rotation[axis] = Math.trimDeg(value)
			Canvas.updateAllBones()
		}
		return;
	}
	*/
	//Warning
	if (Format.rotation_limit && settings.dialog_rotation_limit.value) {
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
					buttons: [tl('dialog.ok'), tl('dialog.dontshowagain')]
				}, function(r) {
					if (r === 1) {
						settings.dialog_rotation_limit.value = false
						Settings.save()
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
		
		if (!Group.selected && obj instanceof Mesh && Project.selected_vertices[obj.uuid] && Project.selected_vertices[obj.uuid].length > 0) {

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

			Project.selected_vertices[obj.uuid].forEach(key => {
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
	if (Format.cube_size_limiter && Format.cube_size_limiter.rotation_affected) {
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
			tools: ['move_tool', 'pivot_tool', 'resize_tool'],
			method: () => !(Toolbox && Toolbox.selected.id === 'resize_tool' && Mesh.all.length === 0)
		},
		category: 'transform',
		value: 'local',
		options: {
			global: true,
			bone: {condition: () => Format.bone_rig, name: true},
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
			bone: {condition: () => Format.bone_rig, name: true, name: 'action.transform_space.bone'},
			local: 'action.transform_space.local'
		},
		onChange() {
			updateSelection();
		}
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
		}
	})
	let slider_vector_pos = [BarItems.slider_pos_x, BarItems.slider_pos_y, BarItems.slider_pos_z];
	slider_vector_pos.forEach(slider => slider.slider_vector = slider_vector_pos);


	function resizeOnAxis(modify, axis) {
		selected.forEach(function(obj, i) {
			if (obj.resizable) {
				obj.resize(modify, axis, false, true)
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
		condition: () => (Outliner.selected[0] && (Outliner.selected[0].resizable || Outliner.selected[0].scalable) && Outliner.selected[0] instanceof Mesh == false && Modes.edit),
		getInterval: getSpatialInterval,
		get: function() {
			if (Outliner.selected[0].scalable) {
				return Outliner.selected[0].scale[0]
			} else if (Outliner.selected[0].resizable) {
				return Outliner.selected[0].to[0] - Outliner.selected[0].from[0]
			}
		},
		change: function(modify) {
			resizeOnAxis(modify, 0)
		},
		onBefore: function() {
			Undo.initEdit({elements: Cube.selected})
		},
		onAfter: function() {
			Undo.finishEdit('Change element size')
		}
	})
	new NumSlider('slider_size_y', {
		name: tl('action.slider_size', ['Y']),
		description: tl('action.slider_size.desc', ['Y']),
		color: 'y',
		category: 'transform',
		condition: () => (Outliner.selected[0] && (Outliner.selected[0].resizable || Outliner.selected[0].scalable) && Outliner.selected[0] instanceof Mesh == false && Modes.edit),
		getInterval: getSpatialInterval,
		get: function() {
			if (Outliner.selected[0].scalable) {
				return Outliner.selected[0].scale[1]
			} else if (Outliner.selected[0].resizable) {
				return Outliner.selected[0].to[1] - Outliner.selected[0].from[1]
			}
		},
		change: function(modify) {
			resizeOnAxis(modify, 1)
		},
		onBefore: function() {
			Undo.initEdit({elements: Cube.selected})
		},
		onAfter: function() {
			Undo.finishEdit('Change element size')
		}
	})
	new NumSlider('slider_size_z', {
		name: tl('action.slider_size', ['Z']),
		description: tl('action.slider_size.desc', ['Z']),
		color: 'z',
		category: 'transform',
		condition: () => (Outliner.selected[0] && (Outliner.selected[0].resizable || Outliner.selected[0].scalable)&& Outliner.selected[0] instanceof Mesh == false  && Modes.edit),
		getInterval: getSpatialInterval,
		get: function() {
			if (Outliner.selected[0].scalable) {
				return Outliner.selected[0].scale[2]
			} else if (Outliner.selected[0].resizable) {
				return Outliner.selected[0].to[2] - Outliner.selected[0].from[2]
			}
		},
		change: function(modify) {
			resizeOnAxis(modify, 2)
		},
		onBefore: function() {
			Undo.initEdit({elements: Cube.selected})
		},
		onAfter: function() {
			Undo.finishEdit('Change element size')
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
						if (Format.cube_size_limiter.test(obj, {inflate: v})) {
							obj.inflate = v;
						} else {
							let step = Math.sign(v - v_before) * 0.1;
							let steps = (v - v_before) / step;
							for (let i = 0; i < steps; i++) {
								if (Format.cube_size_limiter.test(obj, {inflate: v_before + i * (steps+1)})) {
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

	//Rotation
	new NumSlider('slider_rotation_x', {
		name: tl('action.slider_rotation', ['X']),
		description: tl('action.slider_rotation.desc', ['X']),
		color: 'x',
		category: 'transform',
		condition: () => ((Modes.edit || Modes.pose) && getRotationObject()),
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.rotation[0];
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
			Undo.initEdit({elements: Outliner.selected.filter(el => el.rotatable), group: Group.selected})
		},
		onAfter: function() {
			afterRotateOnAxis();
			Undo.finishEdit(getRotationObject() instanceof Group ? 'Rotate group' : 'Rotate elements');
		},
		getInterval: getRotationInterval
	})
	new NumSlider('slider_rotation_y', {
		name: tl('action.slider_rotation', ['Y']),
		description: tl('action.slider_rotation.desc', ['Y']),
		color: 'y',
		category: 'transform',
		condition: () => ((Modes.edit || Modes.pose) && getRotationObject()),
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.rotation[1];
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
			Undo.initEdit({elements: Outliner.selected.filter(el => el.rotatable), group: Group.selected})
		},
		onAfter: function() {
			afterRotateOnAxis();
			Undo.finishEdit(getRotationObject() instanceof Group ? 'Rotate group' : 'Rotate elements');
		},
		getInterval: getRotationInterval
	})
	new NumSlider('slider_rotation_z', {
		name: tl('action.slider_rotation', ['Z']),
		description: tl('action.slider_rotation.desc', ['Z']),
		color: 'z',
		category: 'transform',
		condition: () => ((Modes.edit || Modes.pose) && getRotationObject()),
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.rotation[2];
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
			Undo.initEdit({elements: Outliner.selected.filter(el => el.rotatable), group: Group.selected})
		},
		onAfter: function() {
			afterRotateOnAxis();
			Undo.finishEdit(getRotationObject() instanceof Group ? 'Rotate group' : 'Rotate elements');
		},
		getInterval: getRotationInterval
	})
	function rotateCondition() {
		return (Modes.edit && (
			(Format.bone_rig && Group.selected) ||
			(Format.rotate_cubes && Cube.selected.length)
		))
	}
	let slider_vector_rotation = [BarItems.slider_rotation_x, BarItems.slider_rotation_y, BarItems.slider_rotation_z];
	slider_vector_rotation.forEach(slider => slider.slider_vector = slider_vector_rotation);

	//Origin
	function moveOriginOnAxis(modify, axis) {
		var rotation_object = getRotationObject()

		if (rotation_object instanceof Group) {
			var val = modify(rotation_object.origin[axis]);
			rotation_object.origin[axis] = val;
			let elements_to_update = [];
			rotation_object.forEachChild(element => elements_to_update.push(element), OutlinerElement);
			Canvas.updateView({
				groups: [rotation_object],
				group_aspects: {transform: true},
				elements: elements_to_update,
				element_aspects: {transform: true},
				selection: true
			});
			if (Format.bone_rig) {
				Canvas.updateAllBones();
			}
		} else {
			rotation_object.forEach(function(obj, i) {
				var val = modify(obj.origin[axis]);
				obj.origin[axis] = val;
			})
			Canvas.updateView({elements: rotation_object, element_aspects: {transform: true, geometry: true}, selection: true})
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
		condition: () => (Modes.edit || Modes.animate || Modes.pose) && getRotationObject() && (Group.selected || Outliner.selected.length > Locator.selected.length),
		getInterval: getSpatialInterval,
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.origin[0];
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
			Undo.initEdit({elements: selected, group: Group.selected})
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
		condition: () => (Modes.edit || Modes.animate || Modes.pose) && getRotationObject() && (Group.selected || Outliner.selected.length > Locator.selected.length),
		getInterval: getSpatialInterval,
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.origin[1];
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
			Undo.initEdit({elements: selected, group: Group.selected})
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
		condition: () => (Modes.edit || Modes.animate || Modes.pose) && getRotationObject() && (Group.selected || Outliner.selected.length > Locator.selected.length),
		getInterval: getSpatialInterval,
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.origin[2];
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
			Undo.initEdit({elements: selected, group: Group.selected})
		},
		onAfter: function() {
			Undo.finishEdit('Change pivot point')
		}
	})
	let slider_vector_origin = [BarItems.slider_origin_x, BarItems.slider_origin_y, BarItems.slider_origin_z];
	slider_vector_origin.forEach(slider => slider.slider_vector = slider_vector_origin);

	new Action('scale', {
		icon: 'settings_overscan',
		category: 'transform',
		condition: () => (Modes.edit && Outliner.elements.length),
		click() {
			$('#model_scale_range, #model_scale_label').val(1)
			$('#scaling_clipping_warning').text('')

			if (Outliner.selected.length == 0) {
				Prop.active_panel = 'preview';
				selectAll();
			}

			Undo.initEdit({elements: Outliner.selected, outliner: Format.bone_rig});

			Outliner.selected.forEach(function(obj) {
				obj.before = {
					from: obj.from ? obj.from.slice() : undefined,
					to: obj.to ? obj.to.slice() : undefined,
					origin: obj.origin ? obj.origin.slice() : undefined
				}
				if (obj instanceof Mesh) {
					obj.before.vertices = {};
					for (let key in obj.vertices) {
						obj.before.vertices[key] = obj.vertices[key].slice();
					}
				}
			})
			getScaleAllGroups().forEach((g) => {
				g.old_origin = g.origin.slice();
			}, Group, true)
			showDialog('scaling')
			var v = Format.centered_grid ? 0 : 8;
			var origin = Group.selected ? Group.selected.origin : [v, 0, v];
			$('#scaling_origin_x').val(origin[0])
			$('#scaling_origin_y').val(origin[1])
			$('#scaling_origin_z').val(origin[2])
			scaleAll(false, 1)
		}
	})
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
			centerElements(0);
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
			centerElements(1);
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
			centerElements(2);
			Undo.finishEdit('Center selection on Z axis')
		}
	})
	new Action('center_lateral', {
		icon: 'filter_center_focus',
		category: 'transform',
		click() {
			Undo.initEdit({elements: Outliner.selected, outliner: true});
			centerElementsAll();
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

	new Action('toggle_visibility', {
		icon: 'visibility',
		category: 'transform',
		click() {toggleCubeProperty('visibility')}
	})
	new Action('toggle_locked', {
		icon: 'fas.fa-lock',
		category: 'transform',
		click() {toggleCubeProperty('locked')}
	})
	new Action('toggle_export', {
		icon: 'save',
		category: 'transform',
		click() {toggleCubeProperty('export')}
	})
	new Action('toggle_autouv', {
		icon: 'fullscreen_exit',
		category: 'transform',
		condition: {modes: ['edit']},
		click() {toggleCubeProperty('autouv')}
	})
	new Action('toggle_shade', {
		icon: 'wb_sunny',
		category: 'transform',
		condition: () => Format.java_face_properties && Modes.edit,
		click() {toggleCubeProperty('shade')}
	})
	new Action('toggle_mirror_uv', {
		icon: 'icon-mirror_x',
		category: 'transform',
		condition: () => (Modes.edit || Modes.paint) && UVEditor.isBoxUV(),
		click() {toggleCubeProperty('mirror_uv')}
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
	new Action('origin_to_geometry', {
		icon: 'filter_center_focus',
		category: 'transform',
		condition: {modes: ['edit', 'animate']},
		click() {origin2geometry()}
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
		condition: function() {return Format.bone_rig && Group.selected;},
		click() {
			Undo.initEdit({group: Group.selected})
			Group.selected.reset = !Group.selected.reset
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
			unselectAll()
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
		condition: () => Modes.edit && Format.java_face_properties,
		click() {
			if (!Cube.selected.length) {
				selectAll();
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

			Undo.finishEdit('Automatically set cullfaces')
		}
	})
})
