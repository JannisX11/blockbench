//Actions
function origin2geometry() {
	Undo.initEdit({cubes: selected})
	if (Blockbench.entity_mode) {
		if (!selected_group || selected_group.children.length === 0) return;
		var position = [0, 0, 0]
		selected_group.children.forEach(function(obj) {
			position[0] += obj.from[0] + obj.size(0)/2
			position[1] += obj.from[1] + obj.size(1)/2
			position[2] += obj.from[2] + obj.size(2)/2
		})
		position.forEach(function(p, pi) {
			position[pi] = p / selected_group.children.length
		})
		selected_group.origin = position

	} else if (selected.length > 1) {

		var center = [0, 0, 0]
		var i = 0;
		selected.forEach(function(obj) {
			i = 0;
			while (i < 3) {
				center[i] += obj.from[i]
				center[i] += obj.to[i]
				i++;
			}
		})
		i = 0;
		while (i < 3) {
			center[i] = center[i] / (selected.length * 2)
			i++;
		}
		selected.forEach(function(obj) {
			obj.origin = center.slice()
		})

	} else {

		var obj = selected[0]
		var element_size = obj.size()
		var element_center = new THREE.Vector3(
			(element_size[0]   / 2) + obj.from[0],
			(element_size[1]   / 2) + obj.from[1],
			(element_size[2]   / 2) + obj.from[2]
		)

		element_center.x -= obj.origin[0]
		element_center.y -= obj.origin[1]
		element_center.z -= obj.origin[2]

		if (obj.getMesh()) {
			element_center.applyEuler(obj.getMesh().rotation)
		}
		obj.origin[0] += element_center.x
		obj.origin[1] += element_center.y
		obj.origin[2] += element_center.z

		obj.to[0] = obj.origin[0] + element_size[0] / 2
		obj.to[1] = obj.origin[1] + element_size[1] / 2
		obj.to[2] = obj.origin[2] + element_size[2] / 2

		obj.from[0] = obj.origin[0] - element_size[0] / 2
		obj.from[1] = obj.origin[1] - element_size[1] / 2
		obj.from[2] = obj.origin[2] - element_size[2] / 2
	}
	Canvas.updatePositions()
	Undo.finishEdit('origin2geometry')
}
function isMovementGlobal() {
	if (selected.length === 0 || !settings.local_move.value) {
		return true;
	}


	if (!Blockbench.entity_mode) {
		if (selected.length > 1) {
			if (selected[0].rotation.equals([0,0,0])) return true;
			var i = 0;
			while (i < selected.length) {
				if (!selected[0].rotation.equals(selected[i].rotation)) {
					return true;
				}
				i++;
			}
		}
		return false;
	} else {
		if (selected[0] && selected[0].parent.type === 'group') {
			var ref_group = selected[0].parent
			var i = 0;
			while (i < selected.length) {
				var obj = selected[i]
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
	return (val < 32 && val > -16 || isCanvasRestricted() === false)
}
function isCanvasRestricted() {
	return (settings.restricted_canvas.value === true && Blockbench.entity_mode === false)
}
function limitToBox(val) {
	if (!isCanvasRestricted()) {
		return val;
	} else if (val > 32) {
		return 32;
	} else if (val < -16) {
		return -16;
	} else {
		return val;
	}
}
function moveIntoBox(list, value_before) {
	if (!list) list = elements
	if (list.length === 0) return;
	Undo.initEdit({cubes: selected, settings: {restricted_canvas: !!value_before}})

	list.forEach(function(s, i) {
		//Push elements into 3x3 block box
		[0, 1, 2].forEach(function(ax) {
			var overlap = s.to[ax] - 32
			if (overlap > 0) {
				//If positive site overlaps
				s.from[ax] -= overlap
				s.to[ax] -= overlap

				overlap = 16 + s.from[ax]
				if (overlap < 0) {
					s.from[ax] = -16
				}
			} else {
				overlap = s.from[ax] + 16
				if (overlap < 0) {
					s.from[ax] -= overlap
					s.to[ax] -= overlap

					if (s.to[ax] > 32) {
						s.to[ax] = 32
					}
				}
			}
		})
		Canvas.adaptObjectPosition(s)
	})
	updateSelection()
	Undo.finishEdit('restrict', {cubes: selected, settings: {restricted_canvas: true}})
}
//Movement
function moveCube(obj, val, axis) {
	//Obj = Direct  -  val = Total  -   Axis = Number
	val = limitToBox(val)
	val = limitToBox(val + obj.size(axis))
	var size = obj.size(axis)
	var difference = val - obj.to[axis]
	if (!Blockbench.entity_mode || !Blockbench.globalMovement) {
		obj.to[axis] = val
		obj.from[axis] = val - size
	}
	if (Blockbench.globalMovement) {
		if (!Blockbench.entity_mode) {
			obj.origin[axis] += difference
		} else {
			var m = new THREE.Vector3()
			m[getAxisLetter(axis)] = difference
			m.removeEuler(obj.getMesh().rotation)
			obj.from[0] += m.x;
			obj.from[1] += m.y;
			obj.from[2] += m.z;
			obj.to[0]	+= m.x;
			obj.to[1]	+= m.y;
			obj.to[2]	+= m.z;
		}
	}
	obj.mapAutoUV()
}

function scaleCube(obj, val, axis) {
	obj.to[axis] = limitToBox(val + obj.from[axis])
	obj.mapAutoUV()
}
function scaleCubeNegative(obj, val, axis) {
	obj.from[axis] = limitToBox(obj.to[axis] - val)
	obj.mapAutoUV()
}
//Rotate
function rotateSelected(axis, steps) {
	Undo.initEdit({cubes: selected});
	if (!steps) steps = 1
	var origin = [8, 8, 8]
	if (selected_group && Blockbench.entity_mode) {
		origin = selected_group.origin.slice()
	} else if (Blockbench.entity_mode) {
		origin = [0, 0, 0]
	} else {
		origin = selected[0].origin.slice()
	}
	selected.forEach(function(obj) {
		obj.roll(axis, steps, origin)
	})
	updateSelection()
	Undo.finishEdit('rotate')
}
//Mirror
function mirrorSelected(axis) {
	Undo.initEdit({cubes: selected})
	var center = 8
	if (selected_group && Blockbench.entity_mode) {
		center = selected_group.origin[axis]
	} else if (Blockbench.entity_mode) {
		center = 0
	}
	selected.forEach(function(obj) {
		obj.flip(axis, center, false)
		if (Blockbench.entity_mode && axis === 0) {
			obj.shade = !obj.shade
			Canvas.updateUV(obj)
		}
	})
	updateSelection()
	Undo.finishEdit('mirror')
}
//Scale
function scaleAll(save, size) {
	if (save === true) {
		hideDialog()
	}
	if (size === undefined) {
		size = $('#model_scale_label').val()
	}
	var origin = [8, 8, 8]
	if (Blockbench.entity_mode) {
		origin = [0, 0, 0]
	} else if (selected_group) {
		origin = selected_group.origin
	}
	var clip = false
	selected.forEach(function(obj) {
		obj.autouv = 0;
		origin.forEach(function(ogn, i) {
			if ($('#model_scale_'+getAxisLetter(i)+'_axis').is(':checked')) {

				obj.from[i] = (obj.before.from[i] - ogn) * size
				if (obj.from[i] + ogn > 32 || obj.from[i] + ogn < -16) clip = true
				obj.from[i] = limitToBox(obj.from[i] + ogn)

				obj.to[i] = (obj.before.to[i] - ogn) * size
				if (obj.to[i] + ogn > 32 || obj.to[i] + ogn < -16) clip = true
				obj.to[i] = limitToBox(obj.to[i] + ogn)

				obj.origin[i] = (obj.before.origin[i] - ogn) * size
				obj.origin[i] = obj.origin[i] + ogn
			} else {

				obj.from[i] = obj.before.from[i]
				obj.to[i] = obj.before.to[i]

				obj.origin[i] = obj.before.origin[i]

			}
		})
		if (save === true) {
			delete obj.before
		}
		if (Blockbench.entity_mode) {
			Canvas.updateUV(obj)
		}
	})
	if (clip && Blockbench.entity_mode === false) {
		$('#scaling_clipping_warning').text('Model clipping: Your model is too large for the canvas')
	} else {
		$('#scaling_clipping_warning').text('')
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
		obj.from = obj.before.from
		obj.to = obj.before.to
		obj.origin = obj.before.origin
		delete obj.before
	})
	Canvas.updatePositions()
	hideDialog()
}
//Center
function centerCubesAll(axis) {
	centerCubes(0, false)
	centerCubes(1, false)
	centerCubes(2, false)
	Canvas.updatePositions()
}
function centerCubes(axis, update) {
	var average = 0;
	selected.forEach(function(obj) {
		average += obj.from[axis]
		average += obj.to[axis]
	})
	average = average / (selected.length * 2)
	var difference = (Blockbench.entity_mode ? 0 : 8) - average

	selected.forEach(function(obj) {
		obj.from[axis] = limitToBox(obj.from[axis] 	+ difference);
		obj.to[axis] = 	 limitToBox(obj.to[axis] 	+ difference);
		obj.origin[axis] += difference;
	})

	if (update !== false) {
		Canvas.updatePositions()
	}
}
