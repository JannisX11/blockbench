//Actions
function origin2geometry() {

	if (Format.bone_rig && Group.selected) {
		Undo.initEdit({group: Group.selected})

		if (!Group.selected || Group.selected.children.length === 0) return;
		var position = [0, 0, 0]
		Group.selected.children.forEach(function(obj) {
			if (obj.type === 'cube') {
				position[0] += obj.from[0] + obj.size(0)/2
				position[1] += obj.from[1] + obj.size(1)/2
				position[2] += obj.from[2] + obj.size(2)/2
			}
		})
		position.forEach(function(p, pi) {
			position[pi] = p / Group.selected.children.length
		})
		Group.selected.origin.V3_set(position)

	} else if (Cube.selected) {
		Undo.initEdit({elements: Cube.selected})

		var center = getSelectionCenter();
		var original_center = center.slice();
		
		Cube.selected.forEach(cube => {
			if (Format.bone_rig && cube.parent instanceof Group) {
				var v = new THREE.Vector3().fromArray(original_center);
				cube.parent.mesh.worldToLocal(v);
				v.x += cube.parent.origin[0];
				v.y += cube.parent.origin[1];
				v.z += cube.parent.origin[2];
				center = v.toArray();
				cube.transferOrigin(center)
			} else {
				cube.transferOrigin(original_center)
			}
		})
	}
	Canvas.updateView({
		elements: Cube.selected,
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
	var center = [0, 0, 0]
	var i = 0;
	let items = (selected.length == 0 || all) ? elements : selected;
	items.forEach(obj => {
		if (obj.getWorldCenter) {
			var pos = obj.getWorldCenter();
			center[0] += pos.x
			center[1] += pos.y
			center[2] += pos.z
		}
	})
	if (items.length) {
		for (var i = 0; i < 3; i++) {
			center[i] = center[i] / items.length
		}
	}
	if (!Format.centered_grid) {
		center.V3_add(8, 8, 8)
	}
	return center;
}
function limitToBox(val, inflate) {
	if (typeof inflate != 'number') inflate = 0;
	if (!(Format.canvas_limit && !settings.deactivate_size_limit.value)) {
		return val;
	} else if (val + inflate > 32) {
		return 32 - inflate;
	} else if (val - inflate < -16) {
		return -16 + inflate;
	} else {
		return val;
	}
}
//Movement
function moveCubesRelative(difference, index, event) { //Multiple
	if (!quad_previews.current || !Cube.selected.length) {
		return;
	}
	var _has_groups = Format.bone_rig && Group.selected && Group.selected.matchesSelection() && Toolbox.selected.transformerMode == 'translate';

	Undo.initEdit({elements: Cube.selected, outliner: _has_groups})
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
	if (!Cube.selected.length) return;
	Undo.initEdit({elements: Cube.selected});
	if (!steps) steps = 1
	var origin = [8, 8, 8]
	if (Group.selected && Format.bone_rig) {
		origin = Group.selected.origin.slice()
	} else if (Format.centered_grid) {
		origin = [0, 0, 0]
	} else {
		origin = Cube.selected[0].origin.slice()
	}
	Cube.selected.forEach(function(obj) {
		obj.roll(axis, steps, origin)
	})
	updateSelection()
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

	} else if (Modes.edit && selected.length) {
		Undo.initEdit({elements: selected, outliner: Format.bone_rig})
		var center = Format.centered_grid ? 0 : 8;
		if (Format.bone_rig) {
			if (Group.selected && Group.selected.matchesSelection()) {
				function flipGroup(group) {
					if (group.type === 'group') {
						for (var i = 0; i < 3; i++) {
							if (i === axis) {
								group.origin[i] *= -1
							} else {
								group.rotation[i] *= -1
							}
						}
						if (axis == 0 && group.name.includes('right')) {
							group.name = group.name.replace(/right/g, 'left').replace(/2/, '');
						} else if (axis == 0 && group.name.includes('left')) {
							group.name = group.name.replace(/left/g, 'right').replace(/2/, '');
						}
					}
					Canvas.updateAllBones([group]);
				}
				flipGroup(Group.selected)
				Group.selected.forEachChild(flipGroup)
			}
		}
		selected.forEach(function(obj) {
			obj.flip(axis, center, false)
			if (Project.box_uv && obj instanceof Cube && axis === 0) {
				obj.shade = !obj.shade
				Canvas.updateUV(obj)
			}
		})
		updateSelection()
		Undo.finishEdit('Flip selection')
	}
}

const Vertexsnap = {
	step1: true,
	vertexes: new THREE.Object3D(),
	vertexed_cubes: [],
	hovering: false,
	createVertexGizmo(cube, vec, id) {
		//Each vertex needs it's own material for hovering
		let outline_color = '0x'+CustomTheme.data.colors.accent.replace('#', '')
		let material = new THREE.MeshBasicMaterial({color: parseInt(outline_color)})
		let geometry = id == 100 ? new THREE.SphereGeometry(1, 7, 7) : new THREE.BoxGeometry(1, 1, 1)
		let mesh = new THREE.Mesh(geometry, material)

		let pos = mesh.position.copy(vec)
		pos.applyMatrix4(cube.mesh.matrixWorld)
		if (!Format.centered_grid) {
			pos.addScalar(8)
		}
		mesh.rotation.copy(cube.mesh.rotation)
		if (id == 100) {
			mesh.rotation.y += Math.PI/4;
		}
		mesh.element = cube
		mesh.isVertex = true
		mesh.vertex_id = id
		mesh.material.transparent = true;
		mesh.renderOrder = 999;
		Vertexsnap.vertexes.add(mesh)
	},
	addVertices: function(cube) {
		if (Vertexsnap.vertexed_cubes.includes(cube)) return;
		if (cube.visibility === false) return;

		$('#preview').get(0).removeEventListener("mousemove", Vertexsnap.hoverCanvas)
		$('#preview').get(0).addEventListener("mousemove", Vertexsnap.hoverCanvas)

		var o_vertices = cube.mesh.geometry.vertices
		cube.mesh.updateMatrixWorld()
		/*
		o_vertices.forEach(function(v, id) {
			Vertexsnap.createVertexGizmo(cube, v, id)
		})
		Vertexsnap.createVertexGizmo(cube, new THREE.Vector3(), 100)
		*/
		Vertexsnap.vertexed_cubes.push(cube)
		Vertexsnap.updateVertexSize()
	},
	removeVertexes: function() {
		var i = Vertexsnap.vertexes.children.length
		while (i >= 0) {
			Vertexsnap.vertexes.remove(Vertexsnap.vertexes.children[i])
			i--;
		}
		Vertexsnap.vertexed_cubes = []
		$('#preview').get(0).removeEventListener("mousemove", Vertexsnap.hoverCanvas)
	},
	hoverCanvas: function(event) {
		if (Vertexsnap.hovering) {
			Vertexsnap.vertexes.children.forEach(function(v) {
				if (v.type === 'Line') {
					Vertexsnap.vertexes.remove(v)
				} else {
					v.material.color.set(parseInt('0x'+CustomTheme.data.colors.accent.replace('#', '')))
					v.material.depthTest = true;
				}
			})
		}
		let data = Canvas.raycast(event)
		if (!data || !data.vertex) {
			Blockbench.setStatusBarText()
			return;
		}
		var vertex = data.vertex
		vertex.material.color.g = 1
		Vertexsnap.hovering = true

		vertex.material.depthTest = false;

		if (Vertexsnap.step1 === false) {
			//Line
			var geometry = new THREE.Geometry();
			geometry.vertices.push(Vertexsnap.vertex_pos);
			geometry.vertices.push(vertex.position);
			var line = new THREE.Line(geometry, Vertexsnap.lineMaterial);
			line.renderOrder = 900
			Vertexsnap.vertexes.add(line)
			//Measure
			var diff = new THREE.Vector3().copy(Vertexsnap.vertex_pos)
			diff.sub(vertex.position)
			Blockbench.setStatusBarText(tl('status_bar.vertex_distance', [trimFloatNumber(diff.length())] ))
		}
	},
	select: function() {
		Vertexsnap.removeVertexes()
		Cube.selected.forEach(function(obj) {
			Vertexsnap.addVertices(obj)
		})
		if (Cube.selected.length) {
			$('#preview').css('cursor', (Vertexsnap.step1 ? 'copy' : 'alias'))
		}
		Vertexsnap.lineMaterial = Canvas.outlineMaterial.clone()
		Vertexsnap.lineMaterial.depthTest = false
	},
	canvasClick: function(data) {
		if (!data || !data.vertex) return;

		if (Vertexsnap.step1) {
			Vertexsnap.step1 = false
			Vertexsnap.vertex_pos = data.vertex.position
			Vertexsnap.vertex_id = data.vertex.vertex_id
			Vertexsnap.cubes = Cube.selected.slice()
			Vertexsnap.removeVertexes()
			$('#preview').css('cursor', (Vertexsnap.step1 ? 'copy' : 'alias'))

		} else {
			Vertexsnap.snap(data)
			$('#preview').css('cursor', (Vertexsnap.step1 ? 'copy' : 'alias'))
		}
		Blockbench.setStatusBarText()
	},
	snap: function(data) {
		Undo.initEdit({elements: Vertexsnap.cubes})

		let mode = BarItems.vertex_snap_mode.get()

		if (Vertexsnap.vertex_id === 100) {

			Vertexsnap.cubes.forEach(function(cube) {
				let vec = new THREE.Vector3().copy(data.vertex.position)

				if (Format.bone_rig && cube.parent instanceof Group && cube.mesh.parent) {
					cube.mesh.parent.worldToLocal(vec);
				}
				let vec_array = vec.toArray()
				vec_array.V3_add(cube.parent.origin);
				cube.transferOrigin(vec_array)
			})
		} else {

			var global_delta = data.vertex.position
			global_delta.sub(Vertexsnap.vertex_pos)

			if (mode === 'scale' && !Format.integer_size) {
				//Scale

				var m;
				switch (Vertexsnap.vertex_id) {
					case 0: m=[ 1,1,1 ]; break;
					case 1: m=[ 1,1,0 ]; break;
					case 2: m=[ 1,0,1 ]; break;
					case 3: m=[ 1,0,0 ]; break;
					case 4: m=[ 0,1,0 ]; break;
					case 5: m=[ 0,1,1 ]; break;
					case 6: m=[ 0,0,0 ]; break;
					case 7: m=[ 0,0,1 ]; break;
				}

				Vertexsnap.cubes.forEach(function(obj) {
					var q = obj.mesh.getWorldQuaternion(new THREE.Quaternion()).invert()
					var cube_pos = new THREE.Vector3().copy(global_delta).applyQuaternion(q)

					for (i=0; i<3; i++) {
						if (m[i] === 1) {
							obj.to[i] = limitToBox(obj.to[i] + cube_pos.getComponent(i), obj.inflate)
						} else {
							obj.from[i] = limitToBox(obj.from[i] + cube_pos.getComponent(i), -obj.inflate)
						}
					}
					if (Project.box_uv && obj.visibility) {
						Canvas.updateUV(obj)
					}
				})
			} else if (mode === 'move') {
				Vertexsnap.cubes.forEach(function(obj) {
					var cube_pos = new THREE.Vector3().copy(global_delta)

					if (Format.bone_rig && obj.parent instanceof Group && obj.mesh.parent) {
						var q = obj.mesh.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
						cube_pos.applyQuaternion(q);
					}
					if (Format.rotate_cubes) {
						obj.origin.V3_add(cube_pos);
					}
					var in_box = obj.moveVector(cube_pos.toArray());
					if (!in_box && Format.canvas_limit && !settings.deactivate_size_limit.value) {
						Blockbench.showMessageBox({translateKey: 'canvas_limit_error'})
					}
				})
			}

		}

		Vertexsnap.removeVertexes()
		Canvas.updateAllPositions()
		Undo.finishEdit('Use vertex snap')
		Vertexsnap.step1 = true
	},
	updateVertexSize: function() {
		if (!Preview.selected) return;
		Vertexsnap.vertexes.children.forEach(function(v,i) {
			let scale = Preview.selected.calculateControlScale(v.position) * 0.6;
			v.scale.set(scale, scale, scale);
		})
	}
}
Blockbench.on('update_camera_position resize_window', e => {
	if (Toolbox && Toolbox.selected.id == 'vertex_snap_tool') {
		Vertexsnap.updateVertexSize();
	}
})
//Scale
function scaleAll(save, size) {
	if (save === true) {
		hideDialog()
	}
	if (size === undefined) {
		size = $('#model_scale_label').val()
	}
	var origin = [
		parseFloat($('#scaling_origin_x').val())||0,
		parseFloat($('#scaling_origin_y').val())||0,
		parseFloat($('#scaling_origin_z').val())||0,
	]
	var overflow = [];
	selected.forEach(function(obj) {
		obj.autouv = 0;
		origin.forEach(function(ogn, i) {
			if ($('#model_scale_'+getAxisLetter(i)+'_axis').is(':checked')) {

				if (obj.from) {
					obj.from[i] = (obj.before.from[i] - obj.inflate - ogn) * size;
					if (obj.from[i] + ogn > 32 || obj.from[i] + ogn < -16) overflow.push(obj);
					obj.from[i] = limitToBox(obj.from[i] + obj.inflate + ogn, -obj.inflate);
				}

				if (obj.to) {
					obj.to[i] = (obj.before.to[i] + obj.inflate - ogn) * size;
					if (obj.to[i] + ogn > 32 || obj.to[i] + ogn < -16) overflow.push(obj);
					obj.to[i] = limitToBox(obj.to[i] - obj.inflate + ogn, obj.inflate);
					if (Format.integer_size) {
						obj.to[i] = obj.from[i] + Math.round(obj.to[i] - obj.from[i])
					}
				}

				if (obj.origin) {
					obj.origin[i] = (obj.before.origin[i] - ogn) * size;
					obj.origin[i] = obj.origin[i] + ogn;
				}
			} else {

				if (obj.from) obj.from[i] = obj.before.from[i];
				if (obj.to) obj.to[i] = obj.before.to[i];

				if (obj.origin) obj.origin[i] = obj.before.origin[i];

			}
		})
		if (save === true) {
			delete obj.before
		}
		if (Project.box_uv) {
			Canvas.updateUV(obj)
		}
	})
	if (Format.bone_rig && Group.selected) {
		Group.selected.forEachChild((g) => {
			g.origin[0] = g.old_origin[0] * size
			g.origin[1] = g.old_origin[1] * size
			g.origin[2] = g.old_origin[2] * size
			if (save === true) {
				delete g.old_origin
			}
		}, Group)
	}
	if (overflow.length && Format.canvas_limit && !settings.deactivate_size_limit.value) {
		scaleAll.overflow = overflow;
		$('#scaling_clipping_warning').text('Model clipping: Your model is too large for the canvas')
		$('#scale_overflow_btn').css('display', 'inline-block')
	} else {
		$('#scaling_clipping_warning').text('')
		$('#scale_overflow_btn').hide()
	}
	Canvas.updatePositions()
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
	selected.forEach(function(obj) {
		if (obj === undefined) return;
		if (obj.from) obj.from.V3_set(obj.before.from);
		if (obj.to) obj.to.V3_set(obj.before.to);
		if (obj.origin) obj.origin.V3_set(obj.before.origin);
		delete obj.before
		if (Project.box_uv) {
			Canvas.updateUV(obj)
		}
	})
	if (Format.bone_rig && Group.selected) {
		Group.selected.forEachChild((g) => {
			g.origin[0] = g.old_origin[0]
			g.origin[1] = g.old_origin[1]
			g.origin[2] = g.old_origin[2]
			delete g.old_origin
		}, Group)
	}
	Canvas.updatePositions()
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
function centerCubesAll(axis) {
	centerCubes(0, false)
	centerCubes(1, false)
	centerCubes(2, false)
	Canvas.updatePositions()
}
function centerCubes(axis, update) {
	if (!selected.length) return;
	var average = 0;
	selected.forEach(function(obj) {
		if (obj.movable) average += obj.from[axis]
		if (obj.resizable) average += obj.to[axis]
	})
	average = average / (selected.length * 2)
	var difference = (Format.centered_grid ? 0 : 8) - average

	selected.forEach(function(obj) {
		if (obj.movable) obj.from[axis] = limitToBox(obj.from[axis] + difference, obj.inflate);
		if (obj.resizable) obj.to[axis] =  limitToBox(obj.to[axis] 	+ difference, obj.inflate);
		if (obj.origin) obj.origin[axis] += difference;
	})

	if (update !== false) {
		Canvas.updatePositions()
	}
}

//Move
function moveElementsInSpace(difference, axis) {
	let space = Transformer.getTransformSpace()
	let group = Format.bone_rig && Group.selected && Group.selected.matchesSelection() && Group.selected;
	var group_m;

	if (group) {
		if (space === 0) {
			group_m = new THREE.Vector3();
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

	selected.forEach(el => {

		if (!group_m && el instanceof Mesh && Project.selected_vertices[el.uuid] && Project.selected_vertices[el.uuid].length > 0) {

			let quaternion = new THREE.Quaternion();

			Project.selected_vertices[el.uuid].forEach(key => {

				if (space == 2) {
					el.vertices[key][axis] += difference;

				} else {
					let m = new THREE.Vector3();
					m[getAxisLetter(axis)] = difference;
					m.applyQuaternion(el.mesh.getWorldQuaternion(quaternion).invert());
					el.vertices[key].V3_add(m.x, m.y, m.z);
				}

			})

		} else {
		
			if (space == 2 && !group_m) {
				if (el instanceof Locator) {
					let m = new THREE.Vector3();
					m[getAxisLetter(axis)] = difference;
					m.applyQuaternion(el.mesh.quaternion);
					el.from.V3_add(m.x, m.y, m.z);

				} else {
					if (el.movable) el.from[axis] += difference;
					if (el.resizable) el.to[axis] += difference;
				}
				
			} else if (space instanceof Group) {
				if (el.movable) el.from[axis] += difference;
				if (el.resizable) el.to[axis] += difference;
				if (el.rotatable && el instanceof Locator == false) el.origin[axis] += difference;
			} else {
				let move_origin = !!group;
				if (group_m) {
					var m = group_m
				} else {
					var m = new THREE.Vector3();
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
						if (el.mesh && el instanceof Locator == false) {
							el.mesh.getWorldQuaternion(rotation);
						} else if (el.parent instanceof Group) {
							el.parent.mesh.getWorldQuaternion(rotation);
						}
						m.applyQuaternion(rotation.invert());
					}
				}

				if (el.movable) el.from.V3_add(m.x, m.y, m.z);
				if (el.resizable) el.to.V3_add(m.x, m.y, m.z);
				if (move_origin) {
					if (el.rotatable && el instanceof Locator == false) el.origin.V3_add(m.x, m.y, m.z);
				}
			}
		}
		if (el instanceof Cube) {
			el.mapAutoUV()
		}
	})
	Canvas.updateView({elements: selected, element_aspects: {transform: true, geometry: true}})
}

//Rotate
function getRotationInterval(event) {
	if (Format.rotation_limit) {
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
			if (Format.rotation_limit) {
				//Limit To 1 Axis
				obj.rotation[(axis+1)%3] = 0
				obj.rotation[(axis+2)%3] = 0
				//Limit Angle
				obj_val = Math.round(obj_val/22.5)*22.5
				if (obj_val > 45 || obj_val < -45) {
	
					let f = obj_val > 45
					let can_roll = obj.roll(axis, f!=(axis==1) ? 1 : 3);
					if (can_roll) {
						obj_val = f ? -22.5 : 22.5;
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

			let old_order = mesh.rotation.order;
			mesh.rotation.reorder(axis == 0 ? 'ZYX' : (axis == 1 ? 'ZXY' : 'XYZ'))
			var obj_val = modify(Math.radToDeg(mesh.rotation[axis_letter]));
			obj_val = Math.trimDeg(obj_val)
			mesh.rotation[axis_letter] = Math.degToRad(obj_val);
			mesh.rotation.reorder(old_order);

			obj.rotation[0] = Math.radToDeg(mesh.rotation.x);
			obj.rotation[1] = Math.radToDeg(mesh.rotation.y);
			obj.rotation[2] = Math.radToDeg(mesh.rotation.z);

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

BARS.defineActions(function() {


	new BarSelect('transform_space', {
		condition: {modes: ['edit', 'animate'], tools: ['move_tool', 'pivot_tool']},
		category: 'transform',
		value: 'local',
		options: {
			global: true,
			bone: {condition: () => Format.bone_rig, name: true},
			local: true
		},
		onChange() {
			updateSelection();
		}
	})
	new BarSelect('rotation_space', {
		condition: {modes: ['edit', 'animate'], tools: ['rotate_tool']},
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
	let grid_locked_interval = function(event) {
		event = event||0;
		return canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl);
	}

	function moveOnAxis(modify, axis) {
		selected.forEach(function(obj, i) {
			if (obj.movable) {
				var val = modify(obj.from[axis])

				if (Format.canvas_limit && !settings.deactivate_size_limit.value) {
					var size = obj.resizable ? obj.size(axis) : 0;
					val = limitToBox(limitToBox(val, -obj.inflate) + size, obj.inflate) - size
				}

				//val -= obj.from[axis];
				var before = obj.from[axis];
				obj.from[axis] = val;
				if (obj.resizable) {
					obj.to[axis] += (val - before);
				}
				if (obj instanceof Cube) {
					obj.mapAutoUV()
				}
				obj.preview_controller.updateTransform(obj);
			}
		})
		TickUpdates.selection = true;
	}
	new NumSlider('slider_pos_x', {
		name: tl('action.slider_pos', ['X']),
		description: tl('action.slider_pos.desc', ['X']),
		color: 'x',
		category: 'transform',
		condition: () => (selected.length && Modes.edit),
		getInterval: grid_locked_interval,
		get: function() {
			return selected[0].from[0]
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
		getInterval: grid_locked_interval,
		get: function() {
			return selected[0].from[1]
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
		getInterval: grid_locked_interval,
		get: function() {
			return selected[0].from[2]
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


	function resizeOnAxis(modify, axis) {
		selected.forEach(function(obj, i) {
			if (obj.resizable) {
				obj.resize(modify, axis, false, true)
			}
		})
	}
	new NumSlider('slider_size_x', {
		name: tl('action.slider_size', ['X']),
		description: tl('action.slider_size.desc', ['X']),
		color: 'x',
		category: 'transform',
		condition: () => (Cube.selected.length && Modes.edit),
		getInterval: grid_locked_interval,
		get: function() {
			return Cube.selected[0].to[0] - Cube.selected[0].from[0]
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
		condition: () => (Cube.selected.length && Modes.edit),
		getInterval: grid_locked_interval,
		get: function() {
			return Cube.selected[0].to[1] - Cube.selected[0].from[1]
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
		condition: () => (Cube.selected.length && Modes.edit),
		getInterval: grid_locked_interval,
		get: function() {
			return Cube.selected[0].to[2] - Cube.selected[0].from[2]
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
	//Inflate
	new NumSlider('slider_inflate', {
		category: 'transform',
		condition: function() {return Cube.selected.length && Modes.edit},
		getInterval: grid_locked_interval,
		get: function() {
			return Cube.selected[0].inflate
		},
		change: function(modify) {
			Cube.selected.forEach(function(obj, i) {
				var v = modify(obj.inflate)
				if (Format.canvas_limit && !settings.deactivate_size_limit.value) {
					v = obj.from[0] - Math.clamp(obj.from[0]-v, -16, 32);
					v = obj.from[1] - Math.clamp(obj.from[1]-v, -16, 32);
					v = obj.from[2] - Math.clamp(obj.from[2]-v, -16, 32);
					v = Math.clamp(obj.to[0]+v, -16, 32) - obj.to[0];
					v = Math.clamp(obj.to[1]+v, -16, 32) - obj.to[1];
					v = Math.clamp(obj.to[2]+v, -16, 32) - obj.to[2];
				}
				obj.inflate = v
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
		condition: () => (Modes.edit && getRotationObject()),
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.rotation[0];
			}
			if (Format.rotate_cubes && Cube.selected[0]) {
				return Cube.selected[0].rotation[0];
			}
			if (Locator.selected[0]) {
				return Locator.selected[0].rotation[0];
			}
		},
		change: function(modify) {
			rotateOnAxis(modify, 0, true)
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({elements: Cube.selected, group: Group.selected})
		},
		onAfter: function() {
			Undo.finishEdit(getRotationObject() instanceof Group ? 'Rotate group' : 'Rotate elements');
		},
		getInterval: getRotationInterval
	})
	new NumSlider('slider_rotation_y', {
		name: tl('action.slider_rotation', ['Y']),
		description: tl('action.slider_rotation.desc', ['Y']),
		color: 'y',
		category: 'transform',
		condition: () => (Modes.edit && getRotationObject()),
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.rotation[1];
			}
			if (Format.rotate_cubes && Cube.selected[0]) {
				return Cube.selected[0].rotation[1];
			}
			if (Locator.selected[0]) {
				return Locator.selected[0].rotation[1];
			}
		},
		change: function(modify) {
			rotateOnAxis(modify, 1, true)
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({elements: selected, group: Group.selected})
		},
		onAfter: function() {
			Undo.finishEdit(getRotationObject() instanceof Group ? 'Rotate group' : 'Rotate elements');
		},
		getInterval: getRotationInterval
	})
	new NumSlider('slider_rotation_z', {
		name: tl('action.slider_rotation', ['Z']),
		description: tl('action.slider_rotation.desc', ['Z']),
		color: 'z',
		category: 'transform',
		condition: () => (Modes.edit && getRotationObject()),
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.rotation[2];
			}
			if (Format.rotate_cubes && Cube.selected[0]) {
				return Cube.selected[0].rotation[2];
			}
			if (Locator.selected[0]) {
				return Locator.selected[0].rotation[2];
			}
		},
		change: function(modify) {
			rotateOnAxis(modify, 2, true)
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({elements: selected, group: Group.selected})
		},
		onAfter: function() {
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

	//Origin
	function moveOriginOnAxis(modify, axis) {
		var rotation_object = getRotationObject()

		if (rotation_object instanceof Group) {
			var val = modify(rotation_object.origin[axis]);
			rotation_object.origin[axis] = val;
			Canvas.updateView({elements: Cube.selected, element_aspects: {transform: true, geometry: true}})
			if (Format.bone_rig) {
				Canvas.updateAllBones()
			}
		} else {
			rotation_object.forEach(function(obj, i) {
				var val = modify(obj.origin[axis]);
				obj.origin[axis] = val;
			})
			Canvas.updateView({elements: Cube.selected, element_aspects: {transform: true, geometry: true}})
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
		condition: () => (Modes.edit || Modes.animate) && getRotationObject() && (Group.selected || Outliner.selected.length > Locator.selected.length),
		getInterval: grid_locked_interval,
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.origin[0];
			}
			if (Format.rotate_cubes && Cube.selected[0]) {
				return Cube.selected[0].origin[0];
			}
		},
		change: function(modify) {
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
		condition: () => (Modes.edit || Modes.animate) && getRotationObject() && (Group.selected || Outliner.selected.length > Locator.selected.length),
		getInterval: grid_locked_interval,
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.origin[1];
			}
			if (Format.rotate_cubes && Cube.selected[0]) {
				return Cube.selected[0].origin[1];
			}
		},
		change: function(modify) {
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
		condition: () => (Modes.edit || Modes.animate) && getRotationObject() && (Group.selected || Outliner.selected.length > Locator.selected.length),
		getInterval: grid_locked_interval,
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.origin[2];
			}
			if (Format.rotate_cubes && Cube.selected[0]) {
				return Cube.selected[0].origin[2];
			}
		},
		change: function(modify) {
			moveOriginOnAxis(modify, 2)
		},
		onBefore: function() {
			Undo.initEdit({elements: selected, group: Group.selected})
		},
		onAfter: function() {
			Undo.finishEdit('Change pivot point')
		}
	})

	new Action('scale', {
		icon: 'settings_overscan',
		category: 'transform',
		condition: () => (Modes.edit && selected.length),
		click: function () {
			$('#model_scale_range, #model_scale_label').val(1)
			$('#scaling_clipping_warning').text('')

			Undo.initEdit({elements: selected, outliner: Format.bone_rig})

			selected.forEach(function(obj) {
				obj.before = {
					from: obj.from ? obj.from.slice() : undefined,
					to: obj.to ? obj.to.slice() : undefined,
					origin: obj.origin ? obj.origin.slice() : undefined
				}
			})
			if (Format.bone_rig && Group.selected) {
				Group.selected.forEachChild((g) => {
					g.old_origin = g.origin.slice();
				}, Group, true)
			}
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
		click: function () {
			rotateSelected(0, 1);
		}
	})
	new Action('rotate_x_ccw', {
		name: tl('action.rotate_ccw', 'X'),
		icon: 'rotate_left',
		color: 'x',
		category: 'transform',
		click: function () {
			rotateSelected(0, 3);
		}
	})
	new Action('rotate_y_cw', {
		name: tl('action.rotate_cw', 'Y'),
		icon: 'rotate_right',
		color: 'y',
		category: 'transform',
		click: function () {
			rotateSelected(1, 1);
		}
	})
	new Action('rotate_y_ccw', {
		name: tl('action.rotate_ccw', 'Y'),
		icon: 'rotate_left',
		color: 'y',
		category: 'transform',
		click: function () {
			rotateSelected(1, 3);
		}
	})
	new Action('rotate_z_cw', {
		name: tl('action.rotate_cw', 'Z'),
		icon: 'rotate_right',
		color: 'z',
		category: 'transform',
		click: function () {
			rotateSelected(2, 1);
		}
	})
	new Action('rotate_z_ccw', {
		name: tl('action.rotate_ccw', 'Z'),
		icon: 'rotate_left',
		color: 'z',
		category: 'transform',
		click: function () {
			rotateSelected(2, 3);
		}
	})

	new Action('flip_x', {
		name: tl('action.flip', 'X'),
		icon: 'icon-mirror_x',
		color: 'x',
		category: 'transform',
		click: function () {
			mirrorSelected(0);
		}
	})
	new Action('flip_y', {
		name: tl('action.flip', 'Y'),
		icon: 'icon-mirror_y',
		color: 'y',
		category: 'transform',
		click: function () {
			mirrorSelected(1);
		}
	})
	new Action('flip_z', {
		name: tl('action.flip', 'Z'),
		icon: 'icon-mirror_z',
		color: 'z',
		category: 'transform',
		click: function () {
			mirrorSelected(2);
		}
	})

	new Action('center_x', {
		name: tl('action.center', 'X'),
		icon: 'vertical_align_center',
		color: 'x',
		category: 'transform',
		click: function () {
			Undo.initEdit({elements: selected});
			centerCubes(0);
			Undo.finishEdit('Center selection on X axis')
		}
	})
	new Action('center_y', {
		name: tl('action.center', 'Y'),
		icon: 'vertical_align_center',
		color: 'y',
		category: 'transform',
		click: function () {
			Undo.initEdit({elements: selected});
			centerCubes(1);
			Undo.finishEdit('Center selection on Y axis')
		}
	})
	new Action('center_z', {
		name: tl('action.center', 'Z'),
		icon: 'vertical_align_center',
		color: 'z',
		category: 'transform',
		click: function () {
			Undo.initEdit({elements: selected});
			centerCubes(2);
			Undo.finishEdit('Center selection on Z axis')
		}
	})
	new Action('center_all', {
		icon: 'filter_center_focus',
		category: 'transform',
		click: function () {
			Undo.initEdit({elements: selected});
			centerCubesAll();
			Undo.finishEdit('Center selection')
		}
	})

	//Move Cube Keys
	new Action('move_up', {
		icon: 'arrow_upward',
		category: 'transform',
		condition: {modes: ['edit'], method: () => (!open_menu && selected.length)},
		keybind: new Keybind({key: 38, ctrl: null, shift: null}),
		click: function (e) {moveCubesRelative(-1, 2, e)}
	})
	new Action('move_down', {
		icon: 'arrow_downward',
		category: 'transform',
		condition: {modes: ['edit'], method: () => (!open_menu && selected.length)},
		keybind: new Keybind({key: 40, ctrl: null, shift: null}),
		click: function (e) {moveCubesRelative(1, 2, e)}
	})
	new Action('move_left', {
		icon: 'arrow_back',
		category: 'transform',
		condition: {modes: ['edit'], method: () => (!open_menu && selected.length)},
		keybind: new Keybind({key: 37, ctrl: null, shift: null}),
		click: function (e) {moveCubesRelative(-1, 0, e)}
	})
	new Action('move_right', {
		icon: 'arrow_forward',
		category: 'transform',
		condition: {modes: ['edit'], method: () => (!open_menu && selected.length)},
		keybind: new Keybind({key: 39, ctrl: null, shift: null}),
		click: function (e) {moveCubesRelative(1, 0, e)}
	})
	new Action('move_forth', {
		icon: 'keyboard_arrow_up',
		category: 'transform',
		condition: {modes: ['edit'], method: () => (!open_menu && selected.length)},
		keybind: new Keybind({key: 33, ctrl: null, shift: null}),
		click: function (e) {moveCubesRelative(-1, 1, e)}
	})
	new Action('move_back', {
		icon: 'keyboard_arrow_down',
		category: 'transform',
		condition: {modes: ['edit'], method: () => (!open_menu && selected.length)},
		keybind: new Keybind({key: 34, ctrl: null, shift: null}),
		click: function (e) {moveCubesRelative(1, 1, e)}
	})

	new Action('toggle_visibility', {
		icon: 'visibility',
		category: 'transform',
		click: function () {toggleCubeProperty('visibility')}
	})
	new Action('toggle_locked', {
		icon: 'fas.fa-lock',
		category: 'transform',
		click: function () {toggleCubeProperty('locked')}
	})
	new Action('toggle_export', {
		icon: 'save',
		category: 'transform',
		click: function () {toggleCubeProperty('export')}
	})
	new Action('toggle_autouv', {
		icon: 'fullscreen_exit',
		category: 'transform',
		condition: {modes: ['edit']},
		click: function () {toggleCubeProperty('autouv')}
	})
	new Action('toggle_shade', {
		icon: 'wb_sunny',
		category: 'transform',
		condition: () => !Project.box_uv && Modes.edit,
		click: function () {toggleCubeProperty('shade')}
	})
	new Action('toggle_mirror_uv', {
		icon: 'icon-mirror_x',
		category: 'transform',
		condition: () => Project.box_uv && (Modes.edit || Modes.paint),
		click: function () {toggleCubeProperty('shade')}
	})
	new Action('update_autouv', {
		icon: 'brightness_auto',
		category: 'transform',
		condition: () => !Project.box_uv && Modes.edit,
		click: function () {
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
		click: function () {origin2geometry()}
	})
	new Action('rescale_toggle', {
		icon: 'check_box_outline_blank',
		category: 'transform',
		condition: function() {return Format.rotation_limit && Cube.selected.length;},
		click: function () {
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
		click: function () {
			Undo.initEdit({group: Group.selected})
			Group.selected.reset = !Group.selected.reset
			updateNslideValues()
			Undo.finishEdit('Toggle bone reset')
		}
	})

	new Action('remove_blank_faces', {
		icon: 'cancel_presentation',
		category: 'filter',
		condition: () => !Format.box_uv,
		click: function () {
			Undo.initEdit({elements: Cube.selected})
			var arr = Cube.selected.slice()
			var empty_cubes = [];
			var cleared_total = 0;
			unselectAll()
			arr.forEach(cube => {
				var clear_count = 0;
				for (var face in cube.faces) {
					var face_tag = cube.faces[face];
					if (face_tag.texture == false) {
						face_tag.texture = null
						clear_count++;
						cleared_total++;
					}
				}
				if (clear_count == 6) {
					empty_cubes.push(cube);
				}
			})
			updateSelection();
			Blockbench.showQuickMessage(tl('message.removed_faces', [cleared_total]))
			if (empty_cubes.length) {
				Blockbench.showMessageBox({
					title: tl('message.cleared_blank_faces.title'),
					icon: 'rotate_right',
					message: tl('message.cleared_blank_faces.message', [empty_cubes.length]),
					buttons: ['generic.remove', 'dialog.cancel'],
					confirm: 0,
					cancel: 1,
				}, function(r) {
					empty_cubes.forEach(cube => {
						if (r == 0) {
							cube.remove();
						} else {
							for (var face in cube.faces) {
								cube.faces[face].texture = false;
							}
						}
					})
					updateSelection();
					Canvas.updateAllFaces();
					Undo.finishEdit('Remove blank faces');
				})
			} else {
				Canvas.updateAllFaces();
				Undo.finishEdit('Remove blank faces');
			}
		}
	})
})
