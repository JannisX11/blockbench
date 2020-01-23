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
		Group.selected.origin = position

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
	Canvas.updatePositions()
	Undo.finishEdit('origin to geometry')
}
function getSelectionCenter() {
	var center = [0, 0, 0]
	var i = 0;
	selected.forEach(obj => {
		var m = obj.mesh
		if (m) {

			var pos = obj.getWorldCenter()
			center[0] += pos.x
			center[1] += pos.y
			center[2] += pos.z
		} else if (!m && obj.from) {
			var pos = obj.getWorldCenter();
			center[0] += pos.x
			center[1] += pos.y
			center[2] += pos.z
		}
	})
	for (var i = 0; i < 3; i++) {
		center[i] = center[i] / selected.length
	}
	if (!Format.centered_grid) {
		center[0] += 8;
		center[1] += 8;
		center[2] += 8;
	}
	return center;
}
function isMovementGlobal() {
	if (selected.length === 0 || (!settings.local_move.value && Toolbox.selected.id !== 'resize_tool')) {
		return true;
	}
	if (Format.rotate_cubes) {
		if (Cube.selected.length > 1) {
			if (Cube.selected[0].rotation.equals([0,0,0])) return true;
			var i = 0;
			while (i < Cube.selected.length) {
				if (!Cube.selected[0].rotation.equals(Cube.selected[i].rotation)) {
					return true;
				}
				i++;
			}
		}
		return Format.bone_rig && Group.selected;
	}
	if (Format.bone_rig) {
		if (Cube.selected[0] && Cube.selected[0].parent.type === 'group') {
			var ref_group = Cube.selected[0].parent
			var i = 0;
			while (i < Cube.selected.length) {
				var obj = Cube.selected[i]
				if (
					obj.parent.type !== 'group' ||
					!obj.parent.rotation.equals(ref_group.rotation)
				) {
					return true;
				}
				i++;
			}
			return false
		}
		return true;
	}
}
//Canvas Restriction
function isInBox(val) {
	return !(Format.canvas_limit && !settings.deactivate_size_limit.value) || (val < 32 && val > -16)
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
    	difference *= canvasGridSize(event.shiftKey, event.ctrlOrCmd);
    }
    
	if (_has_groups && Blockbench.globalMovement) {
		Group.selected.forEachChild(g => {
			g.origin[axes[index]] += difference
		}, Group, true)

	}

    Cube.selected.forEach(cube => {
        cube.move(difference, axes[index], _has_groups||!Format.bone_rig)
    })
    Canvas.updatePositions()
	Undo.finishEdit('move')
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
	Undo.finishEdit('rotate')
}
//Mirror
function mirrorSelected(axis) {
	if (Modes.animate && Timeline.selected.length) {

		Undo.initEdit({keyframes: Timeline.selected})
		for (var kf of Timeline.selected) {
			kf.flip(axis)
		}
		Undo.finishEdit('flipped keyframes');
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
		Undo.finishEdit('mirror')
	}
}

const Vertexsnap = {
	step1: true,
	vertexes: new THREE.Object3D(),
	vertexed_cubes: [],
	hovering: false,
	addVertexes: function(cube) {
		if (Vertexsnap.vertexed_cubes.includes(cube)) return;
		if (cube.visibility === false) return;

		$('#preview').get(0).removeEventListener("mousemove", Vertexsnap.hoverCanvas)
		$('#preview').get(0).addEventListener("mousemove", Vertexsnap.hoverCanvas)

		var o_vertices = cube.mesh.geometry.vertices
		cube.mesh.updateMatrixWorld()
		o_vertices.forEach(function(v, id) {
			var outline_color = '0x'+CustomTheme.data.colors.accent.replace('#', '')
			//Each vertex needs it's own material for hovering
			var material = new THREE.MeshBasicMaterial({color: parseInt(outline_color)})
			var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
			var pos = mesh.position.copy(v)
			pos.applyMatrix4(cube.mesh.matrixWorld)
			if (!Format.centered_grid) {
				pos.addScalar(8)
			}
			mesh.rotation.copy(cube.mesh.rotation)
			mesh.cube = cube
			mesh.isVertex = true
			mesh.vertex_id = id
			Vertexsnap.vertexes.add(mesh)
		})
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
			Vertexsnap.addVertexes(obj)
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

		var global_delta = data.vertex.position
		global_delta.sub(Vertexsnap.vertex_pos)

		if (BarItems.vertex_snap_mode.get() === 'scale') {
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
				var q = obj.mesh.getWorldQuaternion(new THREE.Quaternion()).inverse()
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
		} else {
			Vertexsnap.cubes.forEach(function(obj) {
				var cube_pos = new THREE.Vector3().copy(global_delta)

				if (Format.bone_rig && obj.parent instanceof Group && obj.mesh.parent) {
					var q = obj.mesh.parent.getWorldQuaternion(new THREE.Quaternion()).inverse();
					cube_pos.applyQuaternion(q);
				}
				if (Format.rotate_cubes) {
					obj.origin[0] += cube_pos.getComponent(0);
					obj.origin[1] += cube_pos.getComponent(1);
					obj.origin[2] += cube_pos.getComponent(2);
				}
				var in_box = obj.moveVector(cube_pos.toArray());
				if (!in_box && Format.canvas_limit && !settings.deactivate_size_limit.value) {
					Blockbench.showMessageBox({translateKey: 'canvas_limit_error'})
				}
			})
		}

		Vertexsnap.removeVertexes()
		Canvas.updateAllPositions()
		Undo.finishEdit('vertex snap')
		Vertexsnap.step1 = true
	},
	updateVertexSize: function() {
		Vertexsnap.vertexes.children.forEach(function(v,i) {
			var scaleVector = new THREE.Vector3();
			var scale = scaleVector.subVectors(v.position, Transformer.camera.position).length() / 500;
			scale = (Math.sqrt(scale)/3 + scale/1.4) * 1.7
			if (Blockbench.isMobile) scale *= 4;
			v.scale.set(scale, scale, scale)
		})
	}
}
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
					obj.from[i] = (obj.before.from[i] - ogn) * size;
					if (obj.from[i] + ogn > 32 || obj.from[i] + ogn < -16) overflow.push(obj);
					obj.from[i] = limitToBox(obj.from[i] + ogn, -obj.inflate);
				}

				if (obj.to) {
					obj.to[i] = (obj.before.to[i] - ogn) * size;
					if (obj.to[i] + ogn > 32 || obj.to[i] + ogn < -16) overflow.push(obj);
					obj.to[i] = limitToBox(obj.to[i] + ogn, obj.inflate);
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
		Undo.finishEdit('scale')
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
		if (obj.from) obj.from = obj.before.from;
		if (obj.to) obj.to = obj.before.to;
		if (obj.origin) obj.origin = obj.before.origin;
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
function scaleAllSelectOverflow() {
	cancelScaleAll()
	selected.length = 0;
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
//Rotate
function getRotationInterval(event) {
	if (Format.rotation_limit) {
		return 22.5;
	} else if (event.shiftKey && event.ctrlOrCmd) {
		return 0.25;
	} else if (event.shiftKey) {
		return 45;
	} else if (event.ctrlOrCmd) {
		return 1;
	} else {
		return 5;
	}
}
function getRotationObject() {
	if (Format.bone_rig && Group.selected) return Group.selected;
	if (Format.rotate_cubes && Cube.selected.length) return Cube.selected;
}
function rotateOnAxis(modify, axis) {
	if (Format.bone_rig && Group.selected) {	
		if (!Group.selected) return;
		var value = modify(Group.selected.rotation[axis]);
		Group.selected.rotation[axis] = Math.trimDeg(value)
		Canvas.updateAllBones()
		return
	}
	if (!Format.rotate_cubes) return;
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
	var origin = Cube.selected[0].origin
	Cube.selected.forEach(function(obj, i) {
		if (!obj.rotation.allEqual(0)) {
			origin = obj.origin
		}
	})
	/*
	if (origin.allEqual(8)) {
		origin = getSelectionCenter()
		origin.forEach((n, ni) => {
			origin[ni] = Math.round(n*2)/2
		})
	}*/
	Cube.selected.forEach(function(obj, i) {
		if (obj.rotation.allEqual(0)) {
			obj.origin = origin.slice()
		}
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
				obj.roll(axis, f!=(axis==1) ? 1 : 3)
				obj_val = f ? -22.5 : 22.5;
			}
		} else {
			obj_val = Math.trimDeg(obj_val)
		}
		obj.rotation[axis] = obj_val
		obj.rotation_axis = axis_letter
	})
}

BARS.defineActions(function() {
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
					Canvas.adaptObjectPosition(obj);
				}
			}
		})
		TickUpdates.selection = true;
	}
	new NumSlider('slider_pos_x', {
		name: tl('action.slider_pos', ['X']),
		description: tl('action.slider_pos.desc', ['X']),
		color: 'x',
		condition: () => (selected.length && Modes.edit),
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
			Undo.finishEdit('move')
		}
	}) 
	new NumSlider('slider_pos_y', {
		name: tl('action.slider_pos', ['Y']),
		description: tl('action.slider_pos.desc', ['Y']),
		color: 'y',
		condition: () => (selected.length && Modes.edit),
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
			Undo.finishEdit('move')
		}
	}) 
	new NumSlider('slider_pos_z', {
		name: tl('action.slider_pos', ['Z']),
		description: tl('action.slider_pos.desc', ['Z']),
		color: 'z',
		condition: () => (selected.length && Modes.edit),
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
			Undo.finishEdit('move')
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
		condition: () => (Cube.selected.length && Modes.edit),
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
			Undo.finishEdit('resize')
		}
	})
	new NumSlider('slider_size_y', {
		name: tl('action.slider_size', ['Y']),
		description: tl('action.slider_size.desc', ['Y']),
		color: 'y',
		condition: () => (Cube.selected.length && Modes.edit),
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
			Undo.finishEdit('resize')
		}
	})
	new NumSlider('slider_size_z', {
		name: tl('action.slider_size', ['Z']),
		description: tl('action.slider_size.desc', ['Z']),
		color: 'z',
		condition: () => (Cube.selected.length && Modes.edit),
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
			Undo.finishEdit('resize')
		}
	})
	//Inflate
	new NumSlider('slider_inflate', {
		condition: function() {return Cube.selected.length && Modes.edit},
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
			Undo.finishEdit('inflate')
		}
	})

	//Rotation
	new NumSlider('slider_rotation_x', {
		name: tl('action.slider_rotation', ['X']),
		description: tl('action.slider_rotation.desc', ['X']),
		color: 'x',
		condition: () => (Modes.edit && getRotationObject()),
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.rotation[0];
			}
			if (Format.rotate_cubes && Cube.selected[0]) {
				return Cube.selected[0].rotation[0];
			}
		},
		change: function(modify) {
			rotateOnAxis(modify, 0)
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({elements: Cube.selected, group: Group.selected})
		},
		onAfter: function() {
			Undo.finishEdit('rotate')
		},
		getInterval: getRotationInterval
	})
	new NumSlider('slider_rotation_y', {
		name: tl('action.slider_rotation', ['Y']),
		description: tl('action.slider_rotation.desc', ['Y']),
		color: 'y',
		condition: () => (Modes.edit && getRotationObject()),
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.rotation[1];
			}
			if (Format.rotate_cubes && Cube.selected[0]) {
				return Cube.selected[0].rotation[1];
			}
		},
		change: function(modify) {
			rotateOnAxis(modify, 1)
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({elements: selected, group: Group.selected})
		},
		onAfter: function() {
			Undo.finishEdit('rotate')
		},
		getInterval: getRotationInterval
	})
	new NumSlider('slider_rotation_z', {
		name: tl('action.slider_rotation', ['Z']),
		description: tl('action.slider_rotation.desc', ['Z']),
		color: 'z',
		condition: () => (Modes.edit && getRotationObject()),
		get: function() {
			if (Format.bone_rig && Group.selected) {
				return Group.selected.rotation[2];
			}
			if (Format.rotate_cubes && Cube.selected[0]) {
				return Cube.selected[0].rotation[2];
			}
		},
		change: function(modify) {
			rotateOnAxis(modify, 2)
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({elements: selected, group: Group.selected})
		},
		onAfter: function() {
			Undo.finishEdit('rotate')
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
			Canvas.updatePositions()
			if (Format.bone_rig) {
				Canvas.updateAllBones()
			}
		} else {
			rotation_object.forEach(function(obj, i) {
				var val = modify(obj.origin[axis]);
				obj.origin[axis] = val;
			})
			Canvas.updatePositions()
		}
		if (Modes.animate) {
			Animator.preview();
		}
	}
	new NumSlider('slider_origin_x', {
		name: tl('action.slider_origin', ['X']),
		description: tl('action.slider_origin.desc', ['X']),
		color: 'x',
		condition: () => (Modes.edit || Modes.animate) && getRotationObject(),
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
			Undo.finishEdit('origin')
		}
	})
	new NumSlider('slider_origin_y', {
		name: tl('action.slider_origin', ['Y']),
		description: tl('action.slider_origin.desc', ['Y']),
		color: 'y',
		condition: () => (Modes.edit || Modes.animate) && getRotationObject(),
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
			Undo.finishEdit('origin')
		}
	})
	new NumSlider('slider_origin_z', {
		name: tl('action.slider_origin', ['Z']),
		description: tl('action.slider_origin.desc', ['Z']),
		color: 'z',
		condition: () => (Modes.edit || Modes.animate) && getRotationObject(),
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
			Undo.finishEdit('origin')
		}
	})

	new Action('scale', {
		icon: 'settings_overscan',
		category: 'transform',
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
			Undo.finishEdit('center')
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
			Undo.finishEdit('center')
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
			Undo.finishEdit('center')
		}
	})
	new Action('center_all', {
		icon: 'filter_center_focus',
		category: 'transform',
		click: function () {
			Undo.initEdit({elements: selected});
			centerCubesAll();
			Undo.finishEdit('center')
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
	new Action('toggle_export', {
		icon: 'save',
		category: 'transform',
		click: function () {toggleCubeProperty('export')}
	})
	new Action('toggle_autouv', {
		icon: 'fullscreen_exit',
		category: 'transform',
		click: function () {toggleCubeProperty('autouv')}
	})
	new Action('toggle_shade', {
		icon: 'wb_sunny',
		category: 'transform',
		condition: () => !Project.box_uv,
		click: function () {toggleCubeProperty('shade')}
	})
	new Action('toggle_mirror_uv', {
		icon: 'icon-mirror_x',
		category: 'transform',
		condition: () => Project.box_uv,
		click: function () {toggleCubeProperty('shade')}
	})
	new Action('update_autouv', {
		icon: 'brightness_auto',
		category: 'transform',
		condition: () => !Project.box_uv,
		click: function () {
			if (Cube.selected.length) {
				Undo.initEdit({elements: Cube.selected[0].forSelected(), selection: true})
				Cube.selected[0].forSelected(function(cube) {
					cube.mapAutoUV()
				})
				Undo.finishEdit('update_autouv')
			}
		}
	})
	new Action('origin_to_geometry', {
		icon: 'filter_center_focus',
		category: 'transform',
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
			Undo.finishEdit('rescale')
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
			Undo.finishEdit('bone_reset')
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
					buttons: ['generic.remove', 'dialog.cancel']
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
					Undo.finishEdit('remove blank faces');
				})
			} else {
				Canvas.updateAllFaces();
				Undo.finishEdit('remove blank faces');
			}
		}
	})
})
