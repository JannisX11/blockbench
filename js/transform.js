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
	if (selected.length === 0 || (!settings.local_move.value && Toolbox.selected.id !== 'resize_tool')) {
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
function moveCube(obj, val, axis, move_origin) {
	//Obj = Direct  -  val = Total  -   Axis = Number
	val = limitToBox(val)
	val = limitToBox(val + obj.size(axis))
	var size = obj.size(axis)
	var difference = val - obj.to[axis]

	//Move
	if (Blockbench.globalMovement && Blockbench.entity_mode && !move_origin) {
		var m = new THREE.Vector3()
		m[getAxisLetter(axis)] = difference

		var rotation = new THREE.Quaternion()
		obj.getMesh().getWorldQuaternion(rotation)
		m.applyQuaternion(rotation.inverse())

		obj.from[0] += m.x;
		obj.from[1] += m.y;
		obj.from[2] += m.z;
		obj.to[0]	+= m.x;
		obj.to[1]	+= m.y;
		obj.to[2]	+= m.z;

	} else {
		obj.to[axis] = val
		obj.from[axis] = val - size
	}
	//Origin
	if (Blockbench.globalMovement && !Blockbench.entity_mode) {
		obj.origin[axis] += difference
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
function moveCubesRelative(difference, index, event) { //Multiple
	if (!quad_previews.current || !selected.length) {
		return;
	}
	Undo.initEdit({cubes: selected})
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
    	difference *= canvasGridSize(event.shiftKey, event.ctrlKey);
    }
    
    selected.forEach(function(s) {
        moveCube(s, s.from[axes[index]]+difference, axes[index])
    })
    Canvas.updatePositions()
	Undo.finishEdit('move')
}
//Rotate
function rotateSelected(axis, steps) {
	if (!selected.length) return;
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
	if (!selected.length) return;
	Undo.initEdit({cubes: selected})
	var center = 8
	if (Blockbench.entity_mode) {
		center = 0
		if (selected_group && selected_group.matchesSelection()) {
			function flipGroup(group) {
				if (group.type === 'group') {
					for (var i = 0; i < 3; i++) {
						if (i === axis) {
							group.origin[i] *= -1
						} else {
							group.rotation[i] *= -1
						}
					}
				}
			}
			flipGroup(selected_group)
			selected_group.forEachChild(flipGroup)
		}
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
/*
Conditions:
Selection equals group cubes:
	all selected cubes have group as parent

*/
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
	if (Blockbench.entity_mode && selected_group) {
		selected_group.forEachChild((g) => {
			g.origin[0] = g.old_origin[0] * size
			g.origin[1] = g.old_origin[1] * size
			g.origin[2] = g.old_origin[2] * size
			if (save === true) {
				delete g.old_origin
			}
		}, 'group')
	}
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
	if (Blockbench.entity_mode && selected_group) {
		selected_group.forEachChild((g) => {
			g.origin[0] = g.old_origin[0]
			g.origin[1] = g.old_origin[1]
			g.origin[2] = g.old_origin[2]
			delete g.old_origin
		}, 'group')
	}
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
	if (!selected.length) return;
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

function getRotationInterval(event) {
	if (settings.limited_rotation.value && !Blockbench.entity_mode) {
		return 22.5;
	} else if (event.shiftKey && event.ctrlKey) {
		return 0.25;
	} else if (event.shiftKey) {
		return 45;
	} else if (event.ctrlKey) {
		return 1;
	} else {
		return 5;
	}
}
function rotateOnAxis(value, fixed, axis) {
	if (Blockbench.entity_mode) {	
		if (!selected_group) return;
		if (!fixed) {
			value = value + selected_group.rotation[axis]
		}
		value = Math.trimDeg(value)
		selected_group.rotation[axis] = value
		Canvas.updateAllBones()
		return;
	}
	//Warning
	if (settings.limited_rotation.value && settings.dialog_rotation_limit.value) {
		var i = 0;
		while (i < selected.length) {
			if (selected[i].rotation[(axis+1)%3] ||
				selected[i].rotation[(axis+2)%3]
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
						saveSettings()
					}
				})
				return;
				//Gotta stop the numslider here
			}
			i++;
		}
	}
	var axis_letter = getAxisLetter(axis)
	var origin = selected[0].origin
	selected.forEach(function(obj, i) {
		if (!obj.rotation.equals([0,0,0])) {
			origin = obj.origin
		}
	})
	selected.forEach(function(obj, i) {
		if (obj.rotation.equals([0,0,0])) {
			obj.origin = origin.slice()
		}
		var obj_val = value;
		if (!fixed) {
			obj_val += obj.rotation[axis]
		}

		obj_val = Math.trimDeg(obj_val)
		if (settings.limited_rotation.value) {
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
	function moveOnAxis(value, fixed, axis) {
		selected.forEach(function(obj, i) {
			var number = value
			if (fixed) {
				number -= obj.from[axis]
			}
			number = limitToBox(obj.to  [axis] + number) - obj.to  [axis];
			number = limitToBox(obj.from[axis] + number) - obj.from[axis];
			obj.from[axis] += number
			obj.to[axis] += number
			obj.mapAutoUV()
		})
		Canvas.updatePositions()
	}
	new NumSlider({
		id: 'slider_pos_x',
		condition: () => (selected.length && Modes.id === 'edit'),
		get: function() {
			return selected[0].from[0]
		},
		change: function(value, fixed) {
			moveOnAxis(value, fixed, 0)
		},
		onBefore: function() {
			Undo.initEdit({cubes: selected})
		},
		onAfter: function() {
			Undo.finishEdit('move')
		}
	}) 
	new NumSlider({
		id: 'slider_pos_y',
		condition: () => (selected.length && Modes.id === 'edit'),
		get: function() {
			return selected[0].from[1]
		},
		change: function(value, fixed) {
			moveOnAxis(value, fixed, 1)
		},
		onBefore: function() {
			Undo.initEdit({cubes: selected})
		},
		onAfter: function() {
			Undo.finishEdit('move')
		}
	}) 
	new NumSlider({
		id: 'slider_pos_z',
		condition: () => (selected.length && Modes.id === 'edit'),
		get: function() {
			return selected[0].from[2]
		},
		change: function(value, fixed) {
			moveOnAxis(value, fixed, 2)
		},
		onBefore: function() {
			Undo.initEdit({cubes: selected})
		},
		onAfter: function() {
			Undo.finishEdit('move')
		}
	})


	function scaleOnAxis(value, fixed, axis) {
		selected.forEach(function(obj, i) {
			var diff = value
			if (fixed) {
				diff -= obj.size(axis)
			}
			obj.to[axis] = limitToBox(obj.to[axis] + diff)
			obj.mapAutoUV()
		})
		Canvas.updatePositions()
		if (Blockbench.entity_mode) {
			Canvas.updateUVs()
		}
	}
	new NumSlider({
		id: 'slider_size_x',
		condition: () => (selected.length && Modes.id === 'edit'),
		get: function() {
			return selected[0].to[0] - selected[0].from[0]
		},
		change: function(value, fixed) {
			scaleOnAxis(value, fixed, 0)
		},
		onBefore: function() {
			Undo.initEdit({cubes: selected})
		},
		onAfter: function() {
			Undo.finishEdit('resize')
		}
	})
	new NumSlider({
		id: 'slider_size_y',
		condition: () => (selected.length && Modes.id === 'edit'),
		get: function() {
			return selected[0].to[1] - selected[0].from[1]
		},
		change: function(value, fixed) {
			scaleOnAxis(value, fixed, 1)
		},
		onBefore: function() {
			Undo.initEdit({cubes: selected})
		},
		onAfter: function() {
			Undo.finishEdit('resize')
		}
	})
	new NumSlider({
		id: 'slider_size_z',
		condition: () => (selected.length && Modes.id === 'edit'),
		get: function() {
			return selected[0].to[2] - selected[0].from[2]
		},
		change: function(value, fixed) {
			scaleOnAxis(value, fixed, 2)
		},
		onBefore: function() {
			Undo.initEdit({cubes: selected})
		},
		onAfter: function() {
			Undo.finishEdit('resize')
		}
	})
	//Inflage
	new NumSlider({
		id: 'slider_inflate',
		condition: function() {return Blockbench.entity_mode && selected.length && Modes.id === 'edit'},
		get: function() {
			return selected[0].inflate
		},
		change: function(value, fixed) {
			selected.forEach(function(obj, i) {
				var diff = value
				if (fixed) {
					diff -= obj.inflate
				}
				obj.inflate = obj.inflate + diff
			})
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({cubes: selected})
		},
		onAfter: function() {
			Undo.finishEdit('inflate')
		}
	})
	//Rotation
	new NumSlider({
		id: 'slider_rotation_x',
		condition: function() {return !!(Blockbench.entity_mode ? selected_group : selected.length) && Modes.id === 'edit'},
		get: function() {
			var obj = Blockbench.entity_mode ? selected_group : selected[0]
			return obj ? obj.rotation[0] : ''
		},
		change: function(value, fixed) {
			rotateOnAxis(value, fixed, 0)
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({cubes: selected, group: selected_group})
		},
		onAfter: function() {
			Undo.finishEdit('rotate')
		},
		getInterval: getRotationInterval
	})
	new NumSlider({
		id: 'slider_rotation_y',
		condition: function() {return !!(Blockbench.entity_mode ? selected_group : selected.length) && Modes.id === 'edit'},
		get: function() {
			var obj = Blockbench.entity_mode ? selected_group : selected[0]
			return obj ? obj.rotation[1] : ''
		},
		change: function(value, fixed) {
			rotateOnAxis(value, fixed, 1)
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({cubes: selected, group: selected_group})
		},
		onAfter: function() {
			Undo.finishEdit('rotate')
		},
		getInterval: getRotationInterval
	})
	new NumSlider({
		id: 'slider_rotation_z',
		condition: function() {return !!(Blockbench.entity_mode ? selected_group : selected.length) && Modes.id === 'edit'},
		get: function() {
			var obj = Blockbench.entity_mode ? selected_group : selected[0]
			return obj ? obj.rotation[2] : ''
		},
		change: function(value, fixed) {
			rotateOnAxis(value, fixed, 2)
			Canvas.updatePositions()
		},
		onBefore: function() {
			Undo.initEdit({cubes: selected, group: selected_group})
		},
		onAfter: function() {
			Undo.finishEdit('rotate')
		},
		getInterval: getRotationInterval
	})


	function moveOriginOnAxis(value, fixed, axis) {
		if (selected_group) {
			var diff = value
			if (fixed) {
				diff -= selected_group.origin[axis]
			}
			selected_group.origin[axis] += diff
			Canvas.updatePositions()
			return;
		}
		selected.forEach(function(obj, i) {
			var diff = value
			if (fixed) {
				diff -= obj.origin[axis]
			}
			obj.origin[axis] += diff
		})
		Canvas.updatePositions()
	}
	new NumSlider({
		id: 'slider_origin_x',
		condition: function() {return !!(Blockbench.entity_mode ? selected_group : selected.length) && Modes.id === 'edit'},
		get: function() {
			var obj = Blockbench.entity_mode ? selected_group : selected[0]
			return obj ? obj.origin[0] : ''
		},
		change: function(value, fixed) {
			moveOriginOnAxis(value, fixed, 0)
		},
		onBefore: function() {
			Undo.initEdit({cubes: selected, group: selected_group})
		},
		onAfter: function() {
			Undo.finishEdit('origin')
		}
	})
	new NumSlider({
		id: 'slider_origin_y',
		condition: function() {return !!(Blockbench.entity_mode ? selected_group : selected.length) && Modes.id === 'edit'},
		get: function() {
			var obj = Blockbench.entity_mode ? selected_group : selected[0]
			return obj ? obj.origin[1] : ''
		},
		change: function(value, fixed) {
			moveOriginOnAxis(value, fixed, 1)
		},
		onBefore: function() {
			Undo.initEdit({cubes: selected, group: selected_group})
		},
		onAfter: function() {
			Undo.finishEdit('origin')
		}
	})
	new NumSlider({
		id: 'slider_origin_z',
		condition: function() {return !!(Blockbench.entity_mode ? selected_group : selected.length) && Modes.id === 'edit'},
		get: function() {
			var obj = Blockbench.entity_mode ? selected_group : selected[0]
			return obj ? obj.origin[2] : ''
		},
		change: function(value, fixed) {
			moveOriginOnAxis(value, fixed, 2)
		},
		onBefore: function() {
			Undo.initEdit({cubes: selected, group: selected_group})
		},
		onAfter: function() {
			Undo.finishEdit('origin')
		}
	})

	new Action({
		id: 'scale',
		icon: 'settings_overscan',
		category: 'transform',
		click: function () {
			$('#model_scale_range, #model_scale_label').val(1)
			$('#scaling_clipping_warning').text('')

			Undo.initEdit({cubes: selected, outliner: Blockbench.entity_mode})

			selected.forEach(function(obj) {
				obj.before = {
					from: obj.from.slice(),
					to: obj.to.slice(),
					origin: obj.origin.slice()
				}
			})
			if (Blockbench.entity_mode && selected_group) {
				selected_group.forEachChild((g) => {
					g.old_origin = g.origin.slice();
				}, 'group', true)
			}
			showDialog('scaling')
		}
	})
	new Action({
		id: 'rotate_x_cw',
		icon: 'rotate_right',
		color: 'x',
		category: 'transform',
		click: function () {
			rotateSelected(0, 1);
		}
	})
	new Action({
		id: 'rotate_x_ccw',
		icon: 'rotate_left',
		color: 'x',
		category: 'transform',
		click: function () {
			rotateSelected(0, 3);
		}
	})
	new Action({
		id: 'rotate_y_cw',
		icon: 'rotate_right',
		color: 'y',
		category: 'transform',
		click: function () {
			rotateSelected(1, 1);
		}
	})
	new Action({
		id: 'rotate_y_ccw',
		icon: 'rotate_left',
		color: 'y',
		category: 'transform',
		click: function () {
			rotateSelected(1, 3);
		}
	})
	new Action({
		id: 'rotate_z_cw',
		icon: 'rotate_right',
		color: 'z',
		category: 'transform',
		click: function () {
			rotateSelected(2, 1);
		}
	})
	new Action({
		id: 'rotate_z_ccw',
		icon: 'rotate_left',
		color: 'z',
		category: 'transform',
		click: function () {
			rotateSelected(2, 3);
		}
	})

	new Action({
		id: 'flip_x',
		icon: 'icon-mirror_x',
		color: 'x',
		category: 'transform',
		click: function () {
			mirrorSelected(0);
		}
	})
	new Action({
		id: 'flip_y',
		icon: 'icon-mirror_y',
		color: 'y',
		category: 'transform',
		click: function () {
			mirrorSelected(1);
		}
	})
	new Action({
		id: 'flip_z',
		icon: 'icon-mirror_z',
		color: 'z',
		category: 'transform',
		click: function () {
			mirrorSelected(2);
		}
	})

	new Action({
		id: 'center_x',
		icon: 'vertical_align_center',
		color: 'x',
		category: 'transform',
		click: function () {
			Undo.initEdit({cubes: selected});
			centerCubes(0);
			Undo.finishEdit('center')
		}
	})
	new Action({
		id: 'center_y',
		icon: 'vertical_align_center',
		color: 'y',
		category: 'transform',
		click: function () {
			Undo.initEdit({cubes: selected});
			centerCubes(1);
			Undo.finishEdit('center')
		}
	})
	new Action({
		id: 'center_z',
		icon: 'vertical_align_center',
		color: 'z',
		category: 'transform',
		click: function () {
			Undo.initEdit({cubes: selected});
			centerCubes(2);
			Undo.finishEdit('center')
		}
	})
	new Action({
		id: 'center_all',
		icon: 'filter_center_focus',
		category: 'transform',
		click: function () {
			Undo.initEdit({cubes: selected});
			centerCubesAll();
			Undo.finishEdit('center')
		}
	})

	new Action({
		id: 'toggle_visibility',
		icon: 'visibility',
		category: 'transform',
		click: function () {toggleCubeProperty('visibility')}
	})
	new Action({
		id: 'toggle_export',
		icon: 'save',
		category: 'transform',
		click: function () {toggleCubeProperty('export')}
	})
	new Action({
		id: 'toggle_autouv',
		icon: 'fullscreen_exit',
		category: 'transform',
		click: function () {toggleCubeProperty('autouv')}
	})
	new Action({
		id: 'toggle_shade',
		icon: 'wb_sunny',
		category: 'transform',
		click: function () {toggleCubeProperty('shade')}
	})
	new Action({
		id: 'rename',
		icon: 'text_format',
		category: 'transform',
		keybind: new Keybind({key: 113}),
		click: function () {renameCubes()}
	})
	new Action({
		id: 'update_autouv',
		icon: 'brightness_auto',
		category: 'transform',
		condition: () => !Blockbench.entity_mode,
		click: function () {
			if (selected.length) {
				Undo.initEdit({cubes: selected[0].forSelected(), selection: true})
				selected[0].forSelected(function(cube) {
					cube.mapAutoUV()
				})
				Undo.finishEdit('update_autouv')
			}
		}
	})
	new Action({
		id: 'origin_to_geometry',
		icon: 'filter_center_focus',
		category: 'transform',
		click: function () {origin2geometry()}
	})
	new Action({
		id: 'rescale_toggle',
		icon: 'check_box_outline_blank',
		category: 'transform',
		condition: function() {return !Blockbench.entity_mode && selected.length;},
		click: function () {
			Undo.initEdit({cubes: selected})
			var value = !selected[0].rescale
			selected.forEach(function(cube) {
				cube.rescale = value
			})
			Canvas.updatePositions()
			updateNslideValues()
			Undo.finishEdit('rescale')
		}
	})
	new Action({
		id: 'bone_reset_toggle',
		icon: 'check_box_outline_blank',
		category: 'transform',
		condition: function() {return Blockbench.entity_mode && selected_group;},
		click: function () {
			Undo.initEdit({group: selected_group})
			selected_group.reset = !selected_group.reset
			updateNslideValues()
			Undo.finishEdit('bone_reset')
		}
	})
})
