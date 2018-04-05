//Buttons
var OutlinerButtons = {
	remove: {
		title: 'Remove',
		icon: ' fa fa-times',
		icon_off: ' fa fa-times',
		advanced_option: false,
		click: function(obj) {
			obj.remove(true)
			setUndo('Removed element')
		}
	},
	visibility: {
		title: 'Visibility',
		icon: ' fa fa-eye',
		icon_off: ' fa fa-eye-slash',
		advanced_option: false,
		click: function(obj) {
			var state = !obj.display.visibility
			if (selected.length < 2 || !selected.includes(obj)) {
				obj.setVisibility(state)
			} else {
				selected.forEach(function(s, i) {
					s.setVisibility(state)
				})
			}
			Canvas.updateVisiblilty()
			setUndo('Changed visibility')
		}
	},
	export: {
		title: 'Export',
		icon: ' fa fa-camera',
		icon_off: ' fa fa-window-close-o',
		advanced_option: true,
		click: function(obj) {
			var state = !obj.display.export
			if (selected.length < 2 || !selected.includes(obj)) {
				obj.setExport(state)
			} else {
				selected.forEach(function(s, i) {
					s.setExport(state)
				})
			}
			setUndo('Toggled element export')
		}
	},
	shading: {
		title: 'Shade',
		icon: ' fa fa-star',
		icon_off: ' fa fa-star-o',
		advanced_option: true,
		click: function(obj) {
			var state = !obj.shade
			if (selected.length < 2 || !selected.includes(obj)) {
				obj.setShading(state)
			} else {
				selected.forEach(function(s, i) {
					s.setShading(state)
				})
			}
			setUndo('Toggled shading')
		}
	},
	autouv: {
		title: 'Auto UV',
		icon: ' fa fa-thumb-tack',
		icon_off: ' fa fa-times-circle-o',
		icon_alt: ' fa fa-magic',
		advanced_option: true,
		click: function(obj) {
			var state = obj.display.autouv+1
			if (state > 2) state = 0

			if (selected.length < 2 || !selected.includes(obj)) {
				obj.setAutoUV(state)
			} else {
				selected.forEach(function(s, i) {
					s.setAutoUV(state)
				})
			}
			setUndo('Removed auto UV')
		}
	},
}
var selected_group;

//Cubes
class Face {
	constructor() {
		this.uv = [0, 0, canvasGridSize(), canvasGridSize()]
	}
}
class OutlinerElement {
	constructor() {
		this.uuid = guid()
	}
	sortInBefore(element) {
		var index = -1;

		if (element.display.parent === 'root') {
			index = TreeElements.indexOf(element)
			var arr = TreeElements
			this.display.parent = 'root'
		} else {
			index = element.display.parent.children.indexOf(element)
			element = element.display.parent
			var arr = element.children
			this.display.parent = element
		}
		// element = parent group


		this.removeFromParent()

		//Adding
		if (index < 0)
			arr.push(this)
		else {
			arr.splice(index, 0, this)
		}

		//Loading
		loadOutlinerDraggable()
		return this;
	}
	addTo(group) {
		//Remove
		var index = -1;

		//Resolve Group Argument
		if (group === undefined) {
			group = 'root'
		} else if (group !== 'root') {
			if (group.type === 'cube') {
				if (group.display.parent === 'root') {
					index = TreeElements.indexOf(group)
					group = 'root'
				} else {
					index = group.display.parent.children.indexOf(group)
					group = group.display.parent
				}
			}
		}
		if (group != 'root' && group.type === 'group') {
			var i = 0
			var level = group;
			while (i < 50) {
				if (level === 'root') {
					i = 50
				} else if (level === this) {
					return this;
				} else {
					level = group.display.parent
				}
				i++;
			}
		}


		this.removeFromParent()

		//Get Array
		if (group === 'root') {
			var arr = TreeElements
			this.display.parent = 'root'
		} else {
			var arr = group.children
			this.display.parent = group
		}

		//Adding
		if (arr.includes(this)) return this;
		if (index < 0)
			arr.push(this)
		else {
			arr.splice(index, 0, this)
		}

		//Loading
		loadOutlinerDraggable()
		return this;
	}
	removeFromParent() {
		var scope = this;
		if (this.display.parent === 'root') {
			TreeElements.forEach(function(s, i) {
				if (s === scope) {
					TreeElements.splice(i, 1)
				}
			})
		} else if (typeof this.display.parent === 'object') {
			var childArray = this.display.parent.children
			childArray.forEach(function(s, i) {
				if (s === scope) {
					childArray.splice(i, 1)
				}
			})
		}
	}
	getParentArray() {
		if (this.display.parent === 'root') {
			return TreeElements
		} else if (typeof this.display.parent === 'object') {
			return this.display.parent.children
		}
	}
	showInOutliner() {
		var scope = this;
		if (this.display.parent !== 'root') {
			this.display.parent.openUp()
		}
        Vue.nextTick(function(){
			scope.scrollOutlinerTo()
        })
	}
	scrollOutlinerTo() {
		var el = $('#'+this.uuid)
		if (el.length === 0) return;

    	var el_pos = el.offset().top
    	if (el_pos > 300 && el_pos < $('#cubes_list').height() + 300) return;

    	var multiple = el_pos > 300 ? 0.8 : 0.2
		var scroll_amount = el.offset().top  + $('#cubes_list').scrollTop() - 320
		scroll_amount -= $('#cubes_list').height()*multiple - 15

		$('#cubes_list').animate({
        	scrollTop: scroll_amount
    	}, 200);
	}
	updateElement() {
		var scope = this
		var old_name = this.name
		scope.name = '_&/3%6-7A'
		Vue.nextTick(function() {
			scope.name = old_name
		})
	}
	rename() {
		var obj = $('#'+this.uuid+' > div.outliner_object > input.cube_name')
		obj.attr('disabled', false)
		obj.select()
		obj.focus()
		obj.addClass('renaming')
		Blockbench.addFlag('renaming')
		return this;
	}
	isIconEnabled(title) {
		switch (title) {
			case 'Visibility': 
				return this.display.visibility
				break;
			case 'Export': 
				return this.display.export
				break;
			case 'Shade': 
				return this.shade
				break;
			case 'Auto UV': 
				if (!this.display.autouv) {
					return false
				} else if (this.display.autouv === 1) {
					return true
				} else {
					return 'alt'
				}
				break;
		}
		return true;
	}
}
class Cube extends OutlinerElement {
	constructor(data) {
		super()
		let size = canvasGridSize();
		this.name = 'cube';
		this.from = [0, 0, 0];
		this.to = [size, size, size];
		this.shade = true;
		this.uv_offset = [0,0]
		this.display = {
			visibility: true,
			isselected: true,
			autouv: (settings.autouv.value ? 1 : 0),
			export: true,
			parent: 'root'
		}
		this.faces = {north: new Face(), east: new Face(), south: new Face(), west: new Face(), up: new Face(), down: new Face()}
		if (data && typeof data === 'object') {
			this.extend(data)
		}
	}
	init() {
		if (!elements.includes(this)) {
			elements.push(this)
		}
		if (!scene.children.includes(this)) {
			Canvas.addCube(this)
		}
		if (!this.display.parent) {
			this.addTo()
		}
		return this;
	}
	size(axis) {
		if (axis !== undefined) {
			return this.to[axis] - this.from[axis];
		} else {
			return [this.to[0] - this.from[0], this.to[1] - this.from[1], this.to[2] - this.from[2]]
		}
	}
	index() {
		return elements.indexOf(this)
	}
	select(event) {
		addToSelection(this, event, true)
	}
	selectLow() {
		if (selected.includes(this) === false) {
			selected.push(this)
		}
	}
	extend(object) {
		function mergeNumber(obj, source, index) {
			if (source[index] !== undefined) {
				var val = source[index]
				if (typeof val === 'number' && !isNaN(val)) {
					obj[index] = val
				} else {
					val = parseFloat(val)
					if (typeof val === 'number' && !isNaN(val)) {
						obj[index] = val
					}
				}
			}
		}
		function mergeString(obj, source, index) {
			if (source[index] !== undefined) {
				var val = source[index]
				if (typeof val === 'string') {
					obj[index] = val
				} else {
					obj[index] = val+''
				}
			}
		}
		function mergeBoolean(obj, source, index) {
			if (source[index] !== undefined) {
				obj[index] = source[index]
			}
		}
		mergeString(this, object, 'name')
		mergeBoolean(this, object, 'shade')
		mergeNumber(this, object, 'inflate')
		if (object.from) {
			mergeNumber(this.from, object.from, 0)
			mergeNumber(this.from, object.from, 1)
			mergeNumber(this.from, object.from, 2)
		}
		if (object.to) {
			mergeNumber(this.to, object.to, 0)
			mergeNumber(this.to, object.to, 1)
			mergeNumber(this.to, object.to, 2)
		}
		if (object.uv_offset) {
			mergeNumber(this.uv_offset, object.uv_offset, 0)
			mergeNumber(this.uv_offset, object.uv_offset, 1)
		}
		if (object.rotation) {
			if (this.rotation === undefined) this.rotation = {origin: [8,8,8], axis: 'x', angle: 0}
			mergeString(this.rotation, object.rotation, 'axis')
			mergeNumber(this.rotation, object.rotation, 'angle')
			mergeBoolean(this.rotation, object.rotation, 'rescale')
			if (object.rotation.origin) {
				mergeNumber(this.rotation.origin, object.rotation.origin, 0)
				mergeNumber(this.rotation.origin, object.rotation.origin, 1)
				mergeNumber(this.rotation.origin, object.rotation.origin, 2)
			}
		}
		if (object.faces) {
			for (var face in this.faces) {
				if (this.faces.hasOwnProperty(face) && object.faces.hasOwnProperty(face)) {
					mergeString(this.faces[face], object.faces[face], 'texture')
					mergeString(this.faces[face], object.faces[face], 'cullface')
					mergeNumber(this.faces[face], object.faces[face], 'rotation')
					mergeNumber(this.faces[face], object.faces[face], 'tintindex')
					if (object.faces[face].uv) {
						mergeNumber(this.faces[face].uv, object.faces[face].uv, 0)
						mergeNumber(this.faces[face].uv, object.faces[face].uv, 1)
						mergeNumber(this.faces[face].uv, object.faces[face].uv, 2)
						mergeNumber(this.faces[face].uv, object.faces[face].uv, 3)
					}
				}
			}
		}
		if (object.display) {
			mergeNumber(this.display, object.display, 'autouv')
			mergeBoolean(this.display, object.display, 'export')
			mergeBoolean(this.display, object.display, 'visibility')
		}
		return this;
	}
	remove(update) {
		TreeElements.clearObjectRecursive(this)
		if (this.display.visibility) {
			scene.remove(this.display.mesh)
		}
		if (selected.includes(this)) {
			selected.splice(selected.indexOf(this), 1)
		}
		elements.splice(this.index(), 1)
		if (update !== false) {
			updateSelection()
		}
		delete this;
	}
	showContextMenu(event) {
		var scope = this;
		new ContextMenu(event, [
			{icon: 'content_copy', name: 'Duplicate', click: function() {
				forOutlinerSelection(scope, function(item) {
					item.duplicate()
				})
				setUndo('Duplicated Cubes')
			}},
			{icon: 'text_format', name: 'Rename', click: function() {
				if (selected.length > 1 && selected.includes(scope)) {
					renameCubes()
				} else {
					scope.rename()
				}
			}},
			{icon: 'pages', name: 'Inflate...', condition: Blockbench.entity_mode, click: function() {
				scope.inflateDialog()
			}},
            {icon: 'collections', condition: (!Blockbench.entity_mode), name: 'Texture', children: function() {
                var arr = [
                    {icon: 'clear', name: 'Transparent', click: function(event) {
                    	scope.applyTexture(undefined, true)
                    	setUndo('Removed texture')
                    }},
                ]
                textures.forEach(function(t) {
                    arr.push({
                        name: t.name,
                        icon: t.img,
                        click: function(event) {
                        	scope.applyTexture(t, true)
                        	setUndo('Applied texture')
                        }
                    })
                })
                return arr;
            }}
		])
	}
	inflateDialog() {
		var scope = this;
		if (!selected.includes(scope)) {
			scope.select()
		}
		var before_val = scope.inflate
		var inflate_dialog = new Dialog({
			title: 'Inflate',
			draggable: true,
			lines: [
				'<div class="dialog_bar"><label class="inline_label">Inflate: </label>'+
				'<input type="number" class="dark_bordered inflate" min="0" max="64" step="0.5">'+
				'<div class="tool"><i class="material-icons">clear</i><div class="tooltip">Reset</div></div>'+
				'</div>'
			],
			id: 'inflate_dialog',
			fadeTime: 100,
			singleButton: true,
			onCancel: function() {
				inflate_dialog.hide()
				if (before_val !== scope.inflate) {
					setUndo('Inflated Cubes')
				}
			}
		}).show()
		$(inflate_dialog.object).find('input').val(this.inflate ? this.inflate : 0)
		$(inflate_dialog.object).find('input').change(function() {
			inflateCubes($(this).val())
		})
		$(inflate_dialog.object).find('div.tool').click(function() {
			inflateCubes()
		})
	}
	duplicate() {
		selected.length = 0
		this.selectLow()
		duplicateCubes()
		if (selected[0]) {
			selected[0].addTo(this)
		}
	}
	applyTexture(texture, faces) {
		var scope = this;
		if (faces === true || Blockbench.entity_mode) {
	        var sides = ['north', 'east', 'south', 'west', 'up', 'down']
	    } else if (faces === undefined) {
	        var sides = [main_uv.face]
	    } else {
	        var sides = faces
	    }
		var id = '$transparent'
		if (texture && texture.id !== undefined) {
			id = '#'+texture.id
		}
        sides.forEach(function(side) {
            scope.faces[side].texture = id
        })
	    if (this.display.isselected) {
	    	main_uv.loadData()
	    }
        if (!Prop.wireframe && scope.display.visibility == true) {
            Canvas.adaptObjectFaces(scope.display.mesh, scope, this.display.isselected)
            Canvas.updateUV(scope)
        }
	}
	mapAutoUV() {
		if (Blockbench.entity_mode) return;
		var scope = this
		if (scope.display.autouv === 2) {
			//Relative UV
			var all_faces = ['north', 'south', 'west', 'east', 'up', 'down']
			all_faces.forEach(function(side) {
		        var uv = scope.faces[side].uv.slice()
		        switch (side) {
		            case 'north':
		            uv = [
		                16 - scope.to[0],
		                16 - scope.to[1],
		                16 - scope.from[0],
		                16 - scope.from[1],
		            ];
		            break;
		            case 'south':
		            uv = [
		                scope.from[0],
		                16 - scope.to[1],
		                scope.to[0],
		                16 - scope.from[1],
		            ];
		            break;
		            case 'west':
		            uv = [
		                scope.from[2],
		                16 - scope.to[1],
		                scope.to[2],
		                16 - scope.from[1],
		            ];
		            break;
		            case 'east':
		            uv = [
		                16 - scope.to[2],
		                16 - scope.to[1],
		                16 - scope.from[2],
		                16 - scope.from[1],
		            ];
		            break;
		            case 'up':
		            uv = [
		                scope.from[0],
		                scope.from[2],
		                scope.to[0],
		                scope.to[2],
		            ];
		            break;
		            case 'down':
		            uv = [
		                scope.from[0],
		                16 - scope.to[2],
		                scope.to[0],
		                16 - scope.from[2],
		            ];
		            break;
		        }
		        uv.forEach(function(s, uvi) {
		            uv[uvi] = limitNumber(s, 0, 16)
		        })
		        scope.faces[side].uv = uv
		    })
        	Canvas.updateUV(scope)
		} else if (scope.display.autouv === 1) {

			function calcAutoUV(face, size) {
				var sx = scope.faces[face].uv[0]
				var sy = scope.faces[face].uv[1]
				var rot = scope.faces[face].rotation

				//Use Texture resolution
				var tex = getTextureById(scope.faces[face].texture)
				if (tex && tex.res && tex.res != 16) {
					size[0] *= 16 / tex.res
					size[1] *= 16 / tex.res
				}

				//Match To Rotation
				if (rot === 90 || rot === 270) {
				    size.reverse()
				}
				//Limit Input to 16
				size.forEach(function(s) {
				    if (s > 16) {
				        s = 16
				    }
				})
				//Calculate End Points
				var x = sx + size[0]
				var y = sy + size[1]
				//Prevent Over 16
				if (x > 16) {
				    sx = 16 - (x - sx)
				    x = 16
				}
				if (y > 16) {
				    sy = 16 - (y - sy)
				    y = 16
				}
				//Prevent Negative
				if (sx < 0) sx = 0
				if (sy < 0) sy = 0
				//Prevent Mirroring
				if (x < sx) x = sx
				if (y < sy) y = sy
				//Return
				return [sx, sy, x, y]
			}
			scope.faces.north.uv = calcAutoUV('north', [scope.size(0), scope.size(1)])
		    scope.faces.east.uv =  calcAutoUV('east',  [scope.size(2), scope.size(1)])
		    scope.faces.south.uv = calcAutoUV('south', [scope.size(0), scope.size(1)])
		    scope.faces.west.uv =  calcAutoUV('west',  [scope.size(2), scope.size(1)])
		    scope.faces.up.uv =    calcAutoUV('up',    [scope.size(0), scope.size(2)])
		    scope.faces.down.uv =  calcAutoUV('down',  [scope.size(0), scope.size(2)])

        	Canvas.updateUV(scope)
		} else {
			//
		}
	}
	setVisibility(val) {
		this.display.visibility = val !== false;
		//
	}
	setExport(val) {
		this.display.export = val !== false;
		//
	}
	setShading(val) {
		this.shade = val !== false;
		if (Blockbench.entity_mode) {
			Canvas.updateUV(this)
		}
	}
	setAutoUV(val) {
		this.display.autouv = val;
		this.mapAutoUV()
		Canvas.updateSelectedFaces()
	}
}
	Cube.prototype.title = 'Cube'
	Cube.prototype.type = 'cube'
	Cube.prototype.icon = 'fa fa-cube'
	Cube.prototype.isParent = false
	Cube.prototype.buttons = [
		OutlinerButtons.remove,
		OutlinerButtons.visibility,
		OutlinerButtons.export,
		OutlinerButtons.shading,
		OutlinerButtons.autouv
	]
class Group extends OutlinerElement {
	constructor(name) {
		super()
		if (name === undefined) {
			this.name = Blockbench.entity_mode ? 'bone' : 'group'
		} else {
			this.name = name
		}
		this.children = []
		if (Blockbench.entity_mode) {
			this.origin = [0, 4, 0]	
		} else {
			this.origin = [8, 8, 8]	
		}
		this.rotation = [0, 0, 0]
		this.reset = false
		this.shade = true
		this.display = {
			isselected: false,
			visibility: true,
			export: true,
			autouv: settings.autouv.value,
			parent: 'root'
		}
	}
	select(event) {
		var scope = this;
		if (Blockbench.hasFlag('renaming')) return;
		if (!event) event = {shiftKey: false}
		var firstChildSelected = (scope.children[0] && scope.children[0].display.isselected)

		//Clear Old Group
		if (selected_group) selected_group.unselect()
		if (event.shiftKey === false) {
			selected.length = 0
		}

		//Select This Group
		getAllOutlinerGroups().forEach(function(s) {
			s.display.isselected = false
		})
		this.display.isselected = true
		selected_group = this

		//Select / Unselect Children
		if (firstChildSelected) {
			//Select Only Group, unselect Children
			selected.length = 0
		} else {
			scope.children.forEach(function(s) {
				s.selectLow()
			})
		}
		updateSelection()
	}
	selectChildren(event) {
		var scope = this;
		if (Blockbench.hasFlag('renaming')) return;
		if (!event) event = {shiftKey: false}
		var firstChildSelected = false

		//Clear Old Group
		if (selected_group) selected_group.unselect()
		selected.length = 0

		//Select This Group
		getAllOutlinerGroups().forEach(function(s) {
			s.display.isselected = false
		})
		this.display.isselected = true
		selected_group = this

		scope.children.forEach(function(s) {
			s.selectLow()
		})
		updateSelection()
	}
	selectLow(highlight) {
		//Only Select
		if (highlight !== false) {
			this.display.isselected = true
		}
		this.children.forEach(function(s) {
			s.selectLow(highlight)
		})
	}
	unselect() {
		if (this.display.isselected === false) return;
		selected_group = undefined;
		this.display.isselected = false
		return this;
	}
	openUp() {
		this.isOpen = true
		this.updateElement()
		if (this.display.parent && this.display.parent !== 'root') {
			this.display.parent.openUp()
		}
		return this;
	}
	remove() {
		this.unselect()
		var i = this.children.length-1
		while (i >= 0) {
			this.children[i].remove()
			i--;
		}
		Canvas.updateIndexes()
		if (typeof this.display.parent === 'object') {
			this.display.parent.children.remove(this)
		} else {
			TreeElements.remove(this)
		}
	}
	index() {
		return -1;
	}
	resolve() {
		var scope = this;
		var array

		if (array == undefined) {
			array = this.children.slice(0)
		}
		if (array.constructor !== Array) {
			array = [array]
		} else {
			array.reverse()
		}
		array.forEach(function(s, i) {
			s.addTo(scope.display.parent)
		})
		TreeElements.clearObjectRecursive(this)
		selected_group = undefined
		delete this
		return array
	}
	renameChildren() {
		this.selectChildren()
		stopRenameCubes()
		textPrompt('Rename Elements', '', selected[0].name, renameCubeList)
	}
	showContextMenu(event) {
		var scope = this;
		new ContextMenu(event, [
			{icon: 'content_copy', name: 'Duplicate', click: function() {scope.duplicate();setUndo('Duplicated Group')}},
			{icon: 'sort_by_alpha', name: 'Sort', click: function() {scope.sortContent()}},
			{icon: 'fa-leaf', name: 'Resolve', click: function() {scope.resolve();setUndo('Resolved Group')}},
			{icon: 'text_format', name: 'Rename', click: function() {scope.rename()}},
			{icon: 'fa-align-left', name: 'Rename Content', click: function() {scope.renameChildren()}},
			{icon: 'rotate_90_degrees_ccw', name: 'Rotation...', condition: Blockbench.entity_mode, click: function() {scope.boneRotationDialog()}}
		])
	}
	boneRotationDialog() {
		this.select()
		var bone_rotation_dialog = new Dialog({
			title: 'Bone Rotation',
			draggable: true,
			lines: [
				'<div class="dialog_bar"><label class="inline_label">X: </label><input type="number" class="dark_bordered rotation_x" min="-180" max="180" step="0.5" oninput="selected_group.setBoneRotation(0, $(this))"></div>',
				'<div class="dialog_bar"><label class="inline_label">Y: </label><input type="number" class="dark_bordered rotation_y" min="-180" max="180" step="0.5" oninput="selected_group.setBoneRotation(1, $(this))"></div>',
				'<div class="dialog_bar"><label class="inline_label">Z: </label><input type="number" class="dark_bordered rotation_z" min="-180" max="180" step="0.5" oninput="selected_group.setBoneRotation(2, $(this))"></div>'
			],
			id: 'bone_rotation',
			fadeTime: 100,
			onCancel: function() {
				bone_rotation_dialog.hide()
			},
			singleButton: true
		}).show()
		$(bone_rotation_dialog.object).find('input.rotation_x').val(this.rotation[0])
		$(bone_rotation_dialog.object).find('input.rotation_y').val(this.rotation[1])
		$(bone_rotation_dialog.object).find('input.rotation_z').val(this.rotation[2])
	}
	setBoneRotation(axis, obj) {
		this.rotation[axis] = limitNumber(parseFloat(obj.val()), -180, 180)
		if (isNaN(this.rotation[axis])) this.rotation[axis] = 0
		Canvas.updatePositions()
	}
	sortContent() {
		if (this.children.length < 1) return;
		this.children.sort(function(a,b) {
			return sort_collator.compare(a.name, b.name)
		});
		setUndo('Sorted group')
	}
	duplicate(destination) {
		function duplicateArray(g1, g2) {
			var array = g1.children
			var i = 0;
			while (i < array.length) {
				if (array[i].type === 'cube') {
					var dupl = new Cube(array[i])
					dupl.addTo(g2)
					if (destination !== 'cache') {
						elements.push(dupl)
					}
				} else {
					var dupl = array[i].getChildlessCopy()
					duplicateArray(array[i], dupl)
					dupl.addTo(g2)
				}
				i++;
			}
		}
		var base_group = this.getChildlessCopy()
		duplicateArray(this, base_group)

		if (!destination) {
			base_group.addTo(this.display.parent)
			Canvas.updateAll()
		} else if (destination !== 'cache') {
			base_group.addTo(destination)
			Canvas.updateAll()
		}
		return base_group;
	}
	getChildlessCopy() {
		var base_group = new Group()
		base_group.name = this.name
		base_group.origin = this.origin.slice()
		base_group.rotation = this.rotation.slice()
		base_group.shade = this.shade
		base_group.reset = this.reset
		base_group.display.visibility = this.display.visibility
		base_group.display.export = this.display.export
		base_group.display.autouv = this.display.autouv
		return base_group;
	}
	forEachChild(func) {
		var i = 0
		while (i < this.children.length) {
			func(this.children[i])
			if (this.children[i].type === 'group') {
				this.children[i].forEachChild(func)
			}
			i++;
		}
	}
	setVisibility(val) {
		this.forEachChild(function(s) {
			s.display.visibility = val !== false;
			s.updateElement()
		})
		this.display.visibility = val !== false;
		this.updateElement()
		Canvas.updateVisiblilty()
	}
	setExport(val) {
		this.forEachChild(function(s) {
			s.display.export = val !== false;
			s.updateElement()
		})
		this.display.export = val !== false;
		this.updateElement()
	}
	setShading(val) {
		if (!Blockbench.entity_mode) {
			this.forEachChild(function(s) {
				s.shade = val !== false;
				s.updateElement()
			})
		}
		this.shade = val !== false;
		if (Blockbench.entity_mode) {
			this.forEachChild(function(s) {
				Canvas.updateUV(s)
			})
		}
		this.updateElement()
	}
	setAutoUV(val) {
		this.forEachChild(function(s) {
			s.display.autouv = val;
			s.updateElement()
		})
		this.display.autouv = val;
		this.updateElement()
	}
}
	Group.prototype.title = 'Group'
	Group.prototype.type = 'group'
	Group.prototype.icon = 'fa fa-folder'
	Group.prototype.isParent = true
	Group.prototype.buttons = [
		OutlinerButtons.remove,
		OutlinerButtons.visibility,
		OutlinerButtons.export,
		OutlinerButtons.shading,
		OutlinerButtons.autouv
	]
Array.prototype.clearObjectRecursive = function(obj) {
	var i = 0
	while (i < this.length) {
		if (this[i] === obj) {
			this.splice(this.indexOf(obj), 1)
		} else if (this[i].children && this[i].children.length > 0) {
			this[i].children.clearObjectRecursive(obj)
		}
		i++;
	}
}
Array.prototype.findRecursive = function(key1, val) {
	var i = 0
	while (i < this.length) {
		var tag = this[i][key1]
		if (tag === val) {
			return this[i];
		} else if (this[i].children && this[i].children.length > 0) {
			var inner = this[i].children.findRecursive(key1, val)
			if (inner !== undefined) {
				return inner;
			}
		}
		i++;
	}
	return undefined;
}

function forOutlinerSelection(item, cb) {
	if (selected.length > 1 && selected.includes(item)) {
		var items = selected
	} else {
		var items = [item]
	}
	items.forEach(function(item) {
		cb(item)
	})
}

function getAllOutlinerObjects() {
	var ta = []
	function iterate(array) {
		var i = 0;
		while (i < array.length) {
			ta.push(array[i])
			if (array[i].children && array[i].children.length > 0) {
				iterate(array[i].children)
			}
			i++;
		}
	}
	iterate(TreeElements)
	return ta;
}
function getAllOutlinerGroups() {
	var ta = []
	function iterate(array) {
		var i = 0;
		while (i < array.length) {
			if (array[i].type === 'group')
				ta.push(array[i])
				if (array[i].children && array[i].children.length > 0) {
					iterate(array[i].children)
				}
			i++;
		}
	}
	iterate(TreeElements)
	return ta;
}
function compileGroups(save_nonexported, lut) {
	var result = []
	function iterate(array, save_array) {
		var i = 0;
		while (i < array.length) {
			if (array[i].type === 'cube') {
				if (!save_nonexported || array[i].display.save_nonexported === true) {
					if (lut) {
						var index = lut[elements.indexOf(array[i])]
					} else {
						var index = elements.indexOf(array[i])
					}
					if (index >= 0) {
						save_array.push(index)
					}
				}
			} else if (array[i].type === 'group') {
				var obj = {
					name: array[i].name,
					isOpen: array[i].isOpen,
					shade: array[i].shade,
					display: $.extend(true, {}, array[i].display),
					children: []
				}
				if (lut === undefined || obj.display.export === true) {
					if (array[i].origin.join('_') !== '8_8_8') {
						obj.origin = array[i].origin
					}
					if (array[i].rotation.join('_') !== '0_0_0') {
						obj.rotation = array[i].rotation
					}
					if (array[i].reset) {
						obj.reset = true
					}
					if (lut) {
						delete obj.display.export
					}
					delete obj.display.parent
					delete obj.display.isselected
					delete obj.display.object
					if (array[i].children.length > 0) {
						iterate(array[i].children, obj.children)
					}
					save_array.push(obj)
				}
			}
			i++;
		}
	}
	iterate(TreeElements, result)
	return result;
}
function parseGroups(array, importGroup, startIndex) {
	function iterate(array, save_array, addGroup) {
		var i = 0;
		while (i < array.length) {
			if (typeof array[i] === 'number') {
				var obj = elements[array[i] + (startIndex ? startIndex : 0) ]
				if (obj && obj.type === 'cube') {
					obj.removeFromParent()
					save_array.push(obj)
					obj.display.parent = addGroup
					if (Blockbench.hasFlag('importing') && typeof addGroup === 'object') {
						if (addGroup.display.autouv !== undefined) {
							obj.display.autouv = addGroup.display.autouv
						}
						if (addGroup.display.visibility !== undefined) {
							obj.display.visibility = addGroup.display.visibility
						}
					}
				}
			} else {
				var obj = new Group()
				obj.name = array[i].name
				if (array[i].origin) {
					obj.origin = array[i].origin
				}
				if (array[i].rotation) {
					obj.rotation = array[i].rotation
				}
				if (array[i].reset) {
					obj.reset = true
				}
				obj.isOpen = array[i].isOpen
				obj.shade = array[i].shade
				if (array[i].display.visibility !== undefined) obj.display.visibility = array[i].display.visibility
				if (array[i].display.export 	!== undefined) obj.display.export = array[i].display.export
				if (array[i].display.autouv 	!== undefined) obj.display.autouv = array[i].display.autouv
				obj.children.length = 0
				obj.display.parent = addGroup
				if (array[i].children.length > 0) {
					iterate(array[i].children, obj.children, obj)
				}
				save_array.push(obj)
			}
			i++;
		}
	}
	if (importGroup && startIndex !== undefined) {
		iterate(array, importGroup.children, importGroup)
	} else {
		TreeElements.length = 1
		TreeElements.splice(0, 1)
		iterate(array, TreeElements, 'root')
	}
}
//Outliner
function toggleOutlinerOptions(force) {
	if (force === undefined) {
		force = !$('.ui#outliner').hasClass('more_options')
	}
	if (force) {
		$('.ui#outliner').addClass('more_options')
		$('#outliner_option_toggle i').text('dns')
	} else {
		$('.ui#outliner').removeClass('more_options')
		$('#outliner_option_toggle i').text('view_stream')
	}
}
function loadOutlinerDraggable() {
	Vue.nextTick(function() {
		$('div.outliner_object').draggable({
			delay: 120,
			revertDuration: 50,
			helper: function() {
				var item = TreeElements.findRecursive('uuid', $(this).attr('id'))
				var helper = $(this).clone()
				if (selected.length > 1) {
					helper.append('<div class="outliner_drag_number">'+selected.length+'</div>')
				}
				helper.on('mousewheel', function() {
					var delta = event.deltaY * 1 + $('#cubes_list').scrollTop()
					$('#cubes_list').animate({scrollTop: delta}, 10);
				})
				return helper;
			},
			revert: 'invalid',
			appendTo: 'body',
			zIndex: 19,
			drag: function(event, ui) {/*
				$('.drag_hover_insert_before').removeClass('drag_hover_insert_before')
				var tar = $('#cubes_list li .drag_hover.outliner_node')
				var element = TreeElements.findRecursive('uuid', tar.attr('id'))
				if (tar.length) {
					var y = event.clientY - tar.position().top
					if (y < 10) {
						tar.addClass('drag_hover_insert_before')
					} else if (element.type === 'cube') {
						tar.addClass('drag_hover_insert_before')
					}
				}

				//console.log(event)
				//console.log(dpos - epos.top)

				//console.log()
				*/
			}
		})
		$('li.outliner_node').droppable({
			greedy: true,
			accept: function(s) { 
				if (s.hasClass('outliner_object') || s.hasClass('texture')) { 
					return true;
				}
			},
			tolerance: 'pointer',
			hoverClass: 'drag_hover',
			drop: function(event, ui) {
				/*
				var dpos = event.clientY
				var epos = $(event.target).position()
				console.log(dpos - epos.top)
				*/

				$('.drag_hover').removeClass('drag_hover')
				var target = TreeElements.findRecursive('uuid', $(event.target).attr('id'))

				if ($(ui.draggable).hasClass('outliner_object')) {
					//Object
					var item = TreeElements.findRecursive('uuid', $(ui.draggable).parent().attr('id'))
					dropOutlinerObjects(item, target, event)

				} else if ($(ui.draggable).hasClass('texture')) {
					//Texture
					var id = $(ui.helper).attr('texid')
					var sides = ['north', 'east', 'south', 'west', 'up', 'down']
					if (target.type === 'group') {
						target.forEachChild(function(s) {
							if (s.type === 'group') return;
							sides.forEach(function(side) {
								s.faces[side].texture = '#'+id
							})
						})
					} else {
						var targets;
						if (selected.includes(target)) {
							targets = selected
						} else {
							targets = [target]
						}

						targets.forEach(function(target) {
							sides.forEach(function(side) {
								target.faces[side].texture = '#'+id
							})
						})
					}
					main_uv.loadData()
					Canvas.updateAllFaces()
				}
			}
		})
	})
}
function collapseAllGroups() {
	getAllOutlinerGroups().forEach(function(g) {
		g.isOpen = false
		var name = g.name
		g.name = '_$X0v_'
		g.name = name
	})
}

function dropOutlinerObjects(item, target, event) {
	var items;
	if (item.type === 'cube' && selected.includes( item )) {
		items = selected
	} else {
		items = [item]
	}
	items.forEach(function(item) {
		if (item && item !== target) {
			if (event.altKey) { 
				if (item.type === 'cube') {
					elements.push(new Cube().extend(item).addTo(target))
				} else {
					item.duplicate().addTo(target)
				}
			} else {
				item.addTo(target)
			}
		}
	})
	if (event.altKey) { 
		Canvas.updateAll()
	} else {
		setUndo('Duplicated cube')
	}
}

function addCube() {
	var base_cube = new Cube().addTo()
	var create_bone = (Blockbench.entity_mode && !selected_group && selected.length === 0)
	if (selected_group) {
		base_cube.addTo(selected_group)
	} else if (selected[0] !== undefined &&
		selected[0].display.parent !== 'root'
	) {
		base_cube.addTo(selected[0].display.parent)
	}

	if (textures.length && Blockbench.entity_mode) {
		var sides = ['north', 'east', 'south', 'west', 'up', 'down']
	    sides.forEach(function(side) {
	        base_cube.faces[side].texture = '#'+textures[0].id
	    })
	    main_uv.loadData()
	}
	if (Blockbench.entity_mode && selected_group) {
		var pos1 = selected_group.origin.slice()
		base_cube.extend({
			from:[ pos1[0]-0, pos1[1]-0, pos1[2]-0 ],
			to:[   pos1[0]+1, pos1[1]+1, pos1[2]+1 ]
		})
	}

	if (selected_group) selected_group.unselect()
	elements.push(base_cube)
	if (create_bone) {
		base_cube.addTo(new Group().addTo('root').openUp())
	}
	selected = [elements[elements.length-1]]
	Canvas.updateSelected()
	setUndo('Added cube')
	loadOutlinerDraggable()
	Vue.nextTick(function() {
		updateSelection()
		if (settings.create_rename.value) {
			renameCubes()
		}
	})
    Blockbench.dispatchEvent( 'add_cube', {object: base_cube} )
	return base_cube
}
function addGroup() {
	var base_group = new Group()
	selected.forEach(function(s, i) {
		s.addTo(base_group)
		if (i === 0) {
			s.display.isselected = false
		}
	})
	base_group.addTo(selected_group)
	base_group.isOpen = true
	base_group.select()
	setUndo('Added group')
	loadOutlinerDraggable()
	Vue.nextTick(function() {
		updateSelection()
		if (settings.create_rename.value) {
			base_group.rename()
		}
    	Blockbench.dispatchEvent( 'add_group', {object: base_group} )
	})
}

//Misc
function deleteCubes(array) {
	if (selected_group) {
		selected_group.remove()
		return;
	}
	if (array == undefined) {
		array = selected.slice(0)
	}
	if (array.constructor !== Array) {
		array = [array]
	} else {
		array.sort(function(a,b){return a - b}).reverse()
	}
	array.forEach(function(s) {
		s.remove()
	})
	Canvas.updateIndexes()
	setUndo('Removed cubes')
}
function toggleCubeProperty(thing, first_level) {
	if (selected.length === 0) return;
	var value;
	if (first_level) {
		value = !selected[0][thing]
		selected.forEach(function(s) {
			s[thing] = value
		})
	} else {
		value = !selected[0].display[thing]
		selected.forEach(function(s) {
			s.display[thing] = value
		})
		if (thing === 'visibility') {
			Canvas.updateVisiblilty()
		}
	}
	if (value) {
		showQuickMessage( capitalizeFirstLetter(thing) + ' Enabled')
	} else {
		showQuickMessage( capitalizeFirstLetter(thing) + ' Disabled')
	}
	setUndo('Toggled '+thing)
}
function renameCubes() {
	stopRenameCubes()
	if (selected_group) {
		selected_group.rename()
	} else if (selected.length === 0) {
		return;
	} else if (selected.length === 1) {
		selected[0].rename()
	} else {
		textPrompt('Rename Elements', '', selected[0].name, renameCubeList)
	}
}
function stopRenameCubes() {
	if (Blockbench.hasFlag('renaming')) {
		$('.outliner_object input.renaming').attr('disabled', true).removeClass('renaming')
		$('body').focus()
		Blockbench.removeFlag('renaming')
	}
}
function sortOutliner() {
	if (TreeElements.length < 1) return;
	TreeElements.sort(function(a,b) {
		return sort_collator.compare(a.name, b.name)
	});
	setUndo('Sorted outliner')
}