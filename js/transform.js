//Actions
function duplicateCubes() {
	selected.forEach(function(obj, i) {
		var old_group = obj.display.parent
		var base_cube = new Cube()
		base_cube.extend(obj)
		base_cube.uuid = guid()

		//Numberation
		var number = base_cube.name.match(/[0-9]+$/)
		if (number) {
			number = parseInt(number[0])
			base_cube.name = base_cube.name.split(number).join(number+1)
		}

		//Rest
		base_cube.display.mesh = undefined;
		elements.push(base_cube)
		base_cube.addTo(old_group)

		Canvas.addCube(elements[elements.length-1])

		selected[i] = elements[elements.length-1]
	})
	Toolbox.set('translate')//( Also updates selection)
	setUndo('Duplicated cube'+pluralS(selected))
}
function origin2geometry() {
	selected.forEach(function(obj) {

		var element_size = obj.size()
		var element_center = new THREE.Vector3(
			(element_size[0]   / 2) + obj.from[0],
			(element_size[1]   / 2) + obj.from[1],
			(element_size[2]   / 2) + obj.from[2]
		)

		if (obj.rotation == undefined) {
			obj.rotation = {origin:[8,8,8], axis: 'y', angle: 0}
		}
		element_center.x -= obj.rotation.origin[0]
		element_center.y -= obj.rotation.origin[1]
		element_center.z -= obj.rotation.origin[2]

		if (obj.display.mesh) {
			element_center.applyEuler(obj.display.mesh.rotation)
		}
		obj.rotation.origin[0] += element_center.x
		obj.rotation.origin[1] += element_center.y
		obj.rotation.origin[2] += element_center.z

		obj.to[0] = obj.rotation.origin[0] + element_size[0] / 2
		obj.to[1] = obj.rotation.origin[1] + element_size[1] / 2
		obj.to[2] = obj.rotation.origin[2] + element_size[2] / 2

		obj.from[0] = obj.rotation.origin[0] - element_size[0] / 2
		obj.from[1] = obj.rotation.origin[1] - element_size[1] / 2
		obj.from[2] = obj.rotation.origin[2] - element_size[2] / 2
	})
	Canvas.updatePositions()
	setUndo('Set origin to geometry')
}
function inflateCubes(val) {
    if (selected.length === 0 ) return;
    if (val) {
        if (typeof val === 'string') {
            val = parseFloat(val)
        }
        val = limitNumber(val, -128, 128)
    } else {
        val = undefined
    }
    selected.forEach(function(s) {
        s.inflate = val
    })
    Canvas.updatePositions()
}
function showInflationDialog() {
    if (selected.length && selected[0]) {
        selected[0].inflateDialog()
    }
}
//Rotation
var Rotation = {
	angleBefore: 0,
    getDefaultOrigin: function(obj) {
        if (settings.center_origin.value) {
            return [8, 8, 8]
        } else {
            return [
                obj.from[0] + obj.size(0)/2,
                obj.from[1] + obj.size(1)/2,
                obj.from[2] + obj.size(2)/2,
            ]
        }
    },
	load: function() {
		$('.selection_only#options').css('visibility', 'visible')
		if (Blockbench.entity_mode === false) {
			var obj = selected[0]
			try {
				$('#cube_rotate').val(obj.rotation.angle)
				$('#cube_axis').val(obj.rotation.axis)
				var rescale = obj.rotation.rescale
				if (rescale === undefined) {
					rescale = false;
				}
				$('#cube_rescale').prop('checked', rescale);
			} catch (err) {
				$('#cube_rotate').val('0');
				$('#cube_axis').val('y');
				$('#cube_rescale').prop('checked', false);
			}
		} else {
			if (selected_group) {
				var axis = $('#cube_axis').val()
				$('#cube_rotate').val(selected_group.rotation[getAxisNumber(axis)])
				$('#cube_rescale').prop('checked', selected_group.reset);
			} else {
				$('#cube_rotate').val('0');
				$('#cube_rescale').prop('checked', false);
			}
		}
	},
	selectTool: function() {
		if (Blockbench.entity_mode) {
			Rotation.load()
		} else {
			Rotation.set()
		}
	},
	start: function() {
		Rotation.angleBefore = $('#cube_rotate').val();
	},
	slide: function() {
		if (Blockbench.entity_mode === false) {
			if (selected.length == 0) {return;}
			var angle = parseFloat($('#cube_rotate').val())
			var axis = $('#cube_axis option:selected').attr('id')
			var rescale = $('#cube_rescale').is(':checked')
			if (angle > 45) {
				$('#cube_rotate_dummy').css('border-left', '5px solid var(--color-accent)')
			} else if (angle < -45) {
				$('#cube_rotate_dummy').css('border-right', '5px solid var(--color-accent)')
			} else {
				$('#cube_rotate_dummy').css('border', 'none')
			}
			selected.forEach(function(obj) {
				if (obj.rotation == undefined) {
					obj.rotation = {origin:Rotation.getDefaultOrigin(obj), axis: 'y', angle: 45}
				}
				obj.rotation.angle = angle;
				obj.rotation.axis = axis;
				if (rescale) {
					obj.rotation.rescale = true;
				} else {
					delete obj.rotation.rescale;
				}
			})
			Canvas.updatePositions()
		} else {
			if (!selected_group) return;
			var angle = parseFloat($('#cube_rotate').val())
			var axis = getAxisNumber($('#cube_axis option:selected').attr('id'))
			selected_group.rotation[axis] = angle
			Canvas.updatePositions()
		}
	},
	save: function() {
		if (Blockbench.entity_mode === false) {
			$('#cube_rotate_dummy').css('border', 'none')
			if ($('#cube_rotate').val() !== Rotation.angleBefore) {
				var angle = $('#cube_rotate').val()
				var axis = $('#cube_axis option:selected').attr('id')
				if (angle === '67.5') {
					$('#cube_rotate').val('-22.5')
					this.forceAngle('-22.5')
					switch (axis) {
						case 'x':
							rotateSelectedX(1)
							break;
						case 'y':
							rotateSelectedY(3)
							break;
						case 'z':
							rotateSelectedZ(1)
							break;
					}
				} else if (angle === '-67.5') {
					$('#cube_rotate').val('22.5')
					this.forceAngle('22.5')
					switch (axis) {
						case 'x':
							rotateSelectedX(3)
							break;
						case 'y':
							rotateSelectedY(1)
							break;
						case 'z':
							rotateSelectedZ(3)
							break;
					}
				} else {
					setUndo('Changed rotation')
				}
			}
		} else {
			if ($('#cube_rotate').val() !== Rotation.angleBefore && selected_group) {
				setUndo('Changed rotation')
			}
		}
	},
	set: function() {
		if (Blockbench.entity_mode === false) {
			if (selected.length == 0) {return;}
			var angle = $('#cube_rotate').val()
			var axis = $('#cube_axis option:selected').attr('id')
			var rescale = $('#cube_rescale').is(':checked')
			selected.forEach(function(obj) {
				if (obj.rotation == undefined) {
					obj.rotation = {origin:Rotation.getDefaultOrigin(obj), axis: 'y', angle: 45}
				}
				obj.rotation.angle = parseFloat(angle);
				obj.rotation.axis = axis;
				if (rescale) {
					obj.rotation.rescale = true;
				} else {
					delete obj.rotation.rescale;
				}
			})
			Canvas.updatePositions()
		} else {
			var reset = $('#cube_rescale').is(':checked')
			if (selected_group) {
				selected_group.reset = reset
			}
		}
	},
	forceAngle: function(angle) {
		angle = parseFloat(angle)
		var axis = $('#cube_axis option:selected').attr('id')
		selected.forEach(function(obj) {
			if (obj.rotation == undefined) {
				obj.rotation = {origin:Rotation.getDefaultOrigin(obj), axis: axis, angle: 45}
			}
			obj.rotation.angle = angle;
		})
	},
	remove: function() {
		if (selected.length == 0) {return;}
		selected.forEach(function(obj) {
			if (obj.rotation !== undefined) {
				delete obj.rotation;
			}
		})
		Rotation.load()
		updateNslideValues()
		Canvas.updatePositions()
	},
	fn: function (argument) {
		if (Blockbench.entity_mode === false) {
			Rotation.remove()
		} else if (selected_group) {
			selected_group.boneRotationDialog()
		}
	}
}
function isMovementOnRotatedAxis() {
	if ((settings.move_origin.value || Toolbox.selected.id === 'scale') && !Blockbench.entity_mode) {
		if (selected.length > 1) {
			if (selected[0].rotation === undefined) return false;
			var i = 0;
			var code = null;
			while (i < selected.length) {
				var new_code = getAxisRotationCode(selected[i].rotation)
				if (code === null) {
					code = new_code
				} else {
					if (code !== new_code) return false;
				}
				i++;
			}
		}
		return true;
	} else {
		return false;
	}
}
function getAxisRotationCode(rotation) {
	if (rotation === undefined) {
		return 'none'
	} else {
		return rotation.axis + '_' + rotation.angle
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
function moveIntoBox(list) {
    if (!list) list = elements
    list.forEach(function(s, i) {
        //Push elements into 3x3 block box
        [0, 1, 2].forEach(function(ax) {
            var overlap = s.from[ax] + s.to[ax] - 32
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

                    if (s.from[ax] + s.to[ax] > 32) {
                        s.to[ax] = 32
                    }
                }
            }
        })
    })
    Canvas.updateAll()
    setUndo('Moved model into restriction')
}
//Movement
function moveCube(obj, val, axis) {
    //Obj = Direct  -  val = Total  -   Axis = Number
    val = limitToBox(val)
    val = limitToBox(val + obj.size(axis))
    var size = obj.size(axis)
    var difference = val - obj.to[axis]
    obj.to[axis] = val
    obj.from[axis] = val - size
    if (obj.rotation && movementAxis === false) {
        obj.rotation.origin[axis] += difference
    }
    obj.mapAutoUV()
}
function moveCubesRelative(difference, index) { //Multiple
    var axes = []
    // < >
    // PageUpDown
    // ^ v
    var facing = getFacingDirection()
    var height = getFacingHeight()
    switch (facing) {
        case 'north': axes = ['x', 'z', 'y']; break;
        case 'south': axes = ['x', 'z', 'y']; break;
        case 'west':  axes = ['z', 'x', 'y']; break;
        case 'east':  axes = ['z', 'x', 'y']; break;
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

    difference *= canvasGridSize();
    
    var action = 'pos_'+axes[index]
    selected.forEach(function(s) {
        executeNslide(action, s, difference)
    })
    Canvas.updatePositions()
    setUndo('Moved cube')
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
function rotateUVFace(number, iteration) {
    while (iteration > 0) {
        if (number == undefined) {
            number = 90
        } else {
            number += 90
            if (number == 360) {
                number = undefined
            }
        }
        iteration -= 1;
    }
    return number;
}
function rotateSelectedY(iteration, skipSave) {
    var origin = [8, 8, 8]
    if (selected_group) {
        origin = selected_group.origin.slice()
    } else if (selected[0].rotation != undefined) {
        origin = selected[0].rotation.origin.slice()
    }
    while (iteration > 0) {
        selected.forEach(function(cube) {
            //Coordinates
            var x = cube.from[2]
            cube.from[2] = cube.to[2]
            cube.to[2] = x
            cube.from = rotateCoordsY(cube.from, 1, origin)
            cube.to = rotateCoordsY(cube.to, 1, origin)
            if (cube.rotation) {
                cube.rotation.origin = rotateCoordsY(cube.rotation.origin, 1, origin)
            }
            //Fine Rotation
            if (cube.rotation !== undefined) {
                if (cube.rotation.axis === 'x') {
                    cube.rotation.axis = 'z'
                } else if (cube.rotation.axis != 'y') {
                    cube.rotation.axis = 'x'
                    cube.rotation.angle *= (-1)
                }
            }
            //Faces
            if (!Blockbench.entity_mode) {
                if (cube.faces.up.rotation == undefined) {
                    cube.faces.up.rotation = 90
                } else {
                    cube.faces.up.rotation += 90
                    if (cube.faces.up.rotation == 360) {
                        delete cube.faces.up.rotation
                    }
                }
                if (cube.faces.down.rotation == undefined) {
                    cube.faces.down.rotation = 270
                } else {
                    cube.faces.down.rotation -= 90
                    if (cube.faces.down.rotation == 0) {
                        delete cube.faces.down.rotation
                    }
                }
                var temp = cube.faces.north
                cube.faces.north = cube.faces.west
                cube.faces.west = cube.faces.south
                cube.faces.south = cube.faces.east
                cube.faces.east = temp
            }
        })
        iteration -= 1;
    }
    if (!skipSave) {
        Canvas.updatePositions()
        Canvas.updateSelectedFaces()
        setUndo('Rotated cubes')
    }
}
function rotateCoordsY(array, axis, origin) {
    if (origin === undefined) {
        origin = [8, 8, 8]
    }
    var a, b;
    array.forEach(function(s, i) {
        if (i == axis) {
            //
        } else {
            if (a == undefined) {
                a = s - origin[i]
                b = i
            } else {
                array[b] = s - origin[i]
                array[b] = origin[b] - array[b]
                array[i] = origin[i] + a;
            }
        }
    })
    return array
}
function rotateSelectedX(iteration, skipSave) {
    var origin = [8, 8, 8]
    if (selected_group) {
        origin = selected_group.origin.slice()
    } else if (selected[0].rotation != undefined) {
        origin = selected[0].rotation.origin.slice()
    }
    while (iteration > 0) {
        selected.forEach(function(cube) {
            //Coordinates
            var y = cube.from[2]
            cube.from[2] = cube.to[2]
            cube.to[2] = y
            cube.from = rotateCoordsX(cube.from, 1, origin)
            cube.to = rotateCoordsX(cube.to, 1, origin)
            if (cube.rotation) {
                cube.rotation.origin = rotateCoordsX(cube.rotation.origin, 1, origin)
            }
            //Fine Rotation
            if (cube.rotation !== undefined) {
                if (cube.rotation.axis === 'y') {
                    cube.rotation.axis = 'z'
                } else if (cube.rotation.axis != 'x') {
                    cube.rotation.axis = 'y'
                    cube.rotation.angle *= (-1)
                }
            }

            //UV
            if (!Blockbench.entity_mode) {
                cube.faces.west.rotation = rotateUVFace(cube.faces.west.rotation, 1)
                cube.faces.east.rotation = rotateUVFace(cube.faces.east.rotation, 3)
                cube.faces.north.rotation = rotateUVFace(cube.faces.north.rotation, 2)
                cube.faces.down.rotation = rotateUVFace(cube.faces.down.rotation, 2)

                var temp = cube.faces.north
                cube.faces.north = cube.faces.down
                cube.faces.down = cube.faces.south
                cube.faces.south = cube.faces.up
                cube.faces.up = temp
            }
        })
        iteration -= 1;
    }
    if (!skipSave) {
        Canvas.updatePositions()
        Canvas.updateSelectedFaces()
        setUndo('Rotated cubes')
    }
}
function rotateCoordsX(array, axis, origin) {
    if (origin === undefined) {
        origin = [8, 8, 8]
    }
    var new_array = [
        array[0],
        origin[1] - ( array[2] - origin[2] ),
        origin[2] + ( array[1] - origin[1] )
    ]
    return new_array
}
function rotateSelectedZ(iteration, skipSave) {
    if (iteration === 1) {
        rotateSelectedX(1)
        rotateSelectedY(1)
        rotateSelectedX(3)
    } else if (iteration === 3) {
        rotateSelectedX(1)
        rotateSelectedY(3)
        rotateSelectedX(3)
    } else if (iteration === 2) {
        rotateSelectedX(1)
        rotateSelectedY(2)
        rotateSelectedX(3)
    }
    if (!skipSave) {
        Canvas.updatePositions()
        Canvas.updateSelectedFaces()
        setUndo('Rotated cubes')
    }
}
//Mirror
function mirror(axis) {
    function mirrorUVX(uv) {
        return [uv[2], uv[1], uv[0], uv[3]]
    }
    function mirrorUVY(uv) {
        return [uv[0], uv[3], uv[2], uv[1]]
    }
    var center = 8
    if (selected_group) {
        center = selected_group.origin[axis]
    }
    selected.forEach(function(obj) {
        if (obj.rotation) {
            if (obj.rotation.axis !== axisIndex(axis)) {
                obj.rotation.angle *= -1
            }
        }
        var from = obj.from[axis]
        obj.from[axis] = center - (obj.to[axis] - center)
        obj.to[axis] = center - (from - center)
        if (obj.rotation) {
            obj.rotation.origin[axis] = center - (obj.rotation.origin[axis] - center)
        }
        //Faces
        var switchFaces;
        switch(axis) {
            case 0: switchFaces = ['west', 'east']; break;
            case 1: switchFaces = ['up', 'down']; break;
            case 2: switchFaces = ['south', 'north']; break;
        }
        var x = obj.faces[switchFaces[0]]
        obj.faces[switchFaces[0]] = obj.faces[switchFaces[1]]
        obj.faces[switchFaces[1]] = x
        //UV
        if (axis === 1) {
            obj.faces.north.uv = mirrorUVY(obj.faces.north.uv)
            obj.faces.south.uv = mirrorUVY(obj.faces.south.uv)
            obj.faces.east.uv = mirrorUVY(obj.faces.east.uv)
            obj.faces.west.uv = mirrorUVY(obj.faces.west.uv)
        } else {
            obj.faces.north.uv = mirrorUVX(obj.faces.north.uv)
            obj.faces.south.uv = mirrorUVX(obj.faces.south.uv)
            obj.faces.east.uv = mirrorUVX(obj.faces.east.uv)
            obj.faces.west.uv = mirrorUVX(obj.faces.west.uv)
        }
        if (axis === 0) {
            obj.faces.up.uv = mirrorUVX(obj.faces.up.uv)
            obj.faces.down.uv = mirrorUVX(obj.faces.down.uv)
        } else {
            obj.faces.up.uv = mirrorUVY(obj.faces.up.uv)
            obj.faces.down.uv = mirrorUVY(obj.faces.down.uv)
        }
    })
    Canvas.updatePositions()
    Canvas.updateSelectedFaces()
    setUndo('Mirrored cubes')
}
//Scale
function openScaleAll() {
    $('#model_scale_range').val(1)
    $('#model_scale_label').val(1)

    selected.forEach(function(obj) {
        obj.display.before = {from: [], to: [], origin: [8, 8, 8]}
        obj.display.before.from[0] = obj.from[0]
        obj.display.before.from[1] = obj.from[1]
        obj.display.before.from[2] = obj.from[2]

        obj.display.before.to[0] = obj.to[0]
        obj.display.before.to[1] = obj.to[1]
        obj.display.before.to[2] = obj.to[2]

        if (obj.rotation !== undefined ) {
            obj.display.before.origin[0] = obj.rotation.origin[0]
            obj.display.before.origin[1] = obj.rotation.origin[1]
            obj.display.before.origin[2] = obj.rotation.origin[2]
        }
    })
    showDialog('scaling')
}
function scaleAll(save, size) {
    if (save === true) {
        hideDialog()
    }
    if (size === undefined) {
        size = $('#model_scale_label').val()
    }
    origin = [8, 8, 8]
    if (Blockbench.entity_mode) {
        origin = [0, 0, 0]
    } else if (selected_group) {
        origin = selected_group.origin
    }
    var clip = false
    selected.forEach(function(obj) {
        obj.display.autouv = false;
        origin.forEach(function(ogn, i) {
            if ($('#model_scale_'+getAxisLetter(i)+'_axis').is(':checked')) {

                obj.from[i] = (obj.display.before.from[i] - ogn) * size
                if (obj.from[i] + ogn > 32 || obj.from[i] + ogn < -16) clip = true
                obj.from[i] = limitToBox(obj.from[i] + ogn)

                obj.to[i] = (obj.display.before.to[i] - ogn) * size
                if (obj.to[i] + ogn > 32 || obj.to[i] + ogn < -16) clip = true
                obj.to[i] = limitToBox(obj.to[i] + ogn)

                if (obj.rotation !== undefined) {
                    obj.rotation.origin[i] = (obj.display.before.origin[i] - ogn) * size
                    obj.rotation.origin[i] = obj.rotation.origin[i] + ogn
                }
            } else {

                obj.from[i] = obj.display.before.from[i]
                obj.to[i] = obj.display.before.to[i]

                if (obj.rotation !== undefined) {
                    obj.rotation.origin[i] = obj.display.before.origin[i]
                }

            }
        })
        if (save === true) {
            delete obj.display.before
        }
    })
    if (clip && Blockbench.entity_mode === false) {
        $('#scaling_clipping_warning').text('Model clipping: Your model is too large for the canvas')
    } else {
        $('#scaling_clipping_warning').text('')
    }
    Canvas.updatePositions()
    if (save === true) {
        setUndo('Scaled cubes')
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
        obj.from[0] = obj.display.before.from[0]
        obj.from[1] = obj.display.before.from[1]
        obj.from[2] = obj.display.before.from[2]

        obj.to[0] = obj.display.before.to[0]
        obj.to[1] = obj.display.before.to[1]
        obj.to[2] = obj.display.before.to[2]

        if (obj.rotation !== undefined ) {
            obj.rotation.origin[0] = obj.display.before.origin[0]
            obj.rotation.origin[1] = obj.display.before.origin[1]
            obj.rotation.origin[2] = obj.display.before.origin[2]
        }
        delete obj.display.before
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
    setUndo('Centered cubes')
}
function centerCubes(axis, update) {
    var average = 0;
    selected.forEach(function(obj) {
        average += obj.from[axis]
        average += obj.to[axis]
    })
    average = average / (selected.length * 2)
    var difference = 8 - average

    selected.forEach(function(s) {
        executeNslide('pos_'+getAxisLetter(axis), s, difference)
    })

    if (update !== false) {
        Canvas.updatePositions()
        setUndo('Centered cubes on '+getAxisLetter(axis))
    }
}

//Vertex Snap

