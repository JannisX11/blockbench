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
			obj.setVisibility(!obj.display.visibility)
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
			obj.setExport(!obj.display.export)
			setUndo('Toggled element export')
		}
	},
	shading: {
		title: 'Shade',
		icon: ' fa fa-star',
		icon_off: ' fa fa-star-o',
		advanced_option: true,
		click: function(obj) {
			obj.setShading(!obj.shade)
			setUndo('Toggled shading')
		}
	},
	autouv: {
		title: 'Auto UV',
		icon: ' fa fa-magic',
		icon_off: ' fa fa-minus',
		advanced_option: true,
		click: function(obj) {
			obj.setAutoUV(!obj.display.autouv)
			setUndo('Removed auto UV')
		}
	},
}
var selected_group;

//Cubes
class Face {
	constructor() {
		this.uv = [0, 0, canvas_grid, canvas_grid]
	}
}
class OutlinerElement {
	constructor() {
		this.uuid = guid()
	}
	addTo(group) {
		//Remove
		var index = -1;

		//Resolve Group Argument
		if (group === undefined) {
			group = 'root'
		} else if (group !== 'root') {
			if (group.title === 'Cube') {
				if (group.display.parent === 'root') {
					index = TreeElements.indexOf(group)
					group = 'root'
				} else {
					index = group.display.parent.children.indexOf(group)
					group = group.display.parent
				}
			}
		}
		if (group != 'root' && group.title === 'Group') {
			var i = 0
			var level = group;
			while (i < 50) {
				if (level === 'root') {
					i = 50
				} else if (level === this) {
					return;
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
		if (this.display.parent !== 'root') {
			this.display.parent.openUp()
		} else {
			this.scrollOutlinerTo()
		}
	}
	scrollOutlinerTo() {
		/*
		var scroll_amount = $('#'+this.uuid).offset().top - 320
		console.log(scroll_amount)
		if (scroll_amount < c_height-280 && scroll_amount > -24) return;
		$('#cubes_list').animate({
        	scrollTop: scroll_amount
    	}, 200);*/
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
		currently_renaming = true
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
				return this.display.autouv
				break;
		}
		return true;
	}
}
class Cube extends OutlinerElement {
	constructor(name, shade) {
		super()
		var x1 = 0;
		var y1 = 0;
		var z1 = 0;
		var x2 = canvas_grid;
		var y2 = canvas_grid;
		var z2 = canvas_grid;
		if (!name) name = 'cube';
		if (!shade) shade = true;
		this.name = name;
		this.from = [x1, y1, z1];
		this.to = [x2, y2, z2];
		this.shade = shade;
		this.display = {
			visibility: true,
			isselected: true,
			autouv: settings.autouv.value,
			export: true,
			parent: 'root'
		}
		this.faces = {north: new Face(), east: new Face(), south: new Face(), west: new Face(), up: new Face(), down: new Face()}
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
		addToSelection(elements.indexOf(this), event, true)
	}
	selectLow() {
		var index = elements.indexOf(this)
		if (selected.includes(index) === false) {
			selected.push(index)
		}
	}
	extend(object) {
		if (object.name !== undefined) this.name = object.name
		if (object.shade !== undefined) this.shade = object.shade
		if (object.from) {
			if (object.from[0] !== undefined) this.from[0] = parseFloat(object.from[0])
			if (object.from[1] !== undefined) this.from[1] = parseFloat(object.from[1])
			if (object.from[2] !== undefined) this.from[2] = parseFloat(object.from[2])
		}
		if (object.to) {
			if (object.to[0] !== undefined) this.to[0] = parseFloat(object.to[0])
			if (object.to[1] !== undefined) this.to[1] = parseFloat(object.to[1])
			if (object.to[2] !== undefined) this.to[2] = parseFloat(object.to[2])
		}
		if (object.rotation) {
			if (this.rotation === undefined) this.rotation = {origin: [8,8,8], axis: 'x', angle: 0}
			if (object.rotation.axis !== undefined) this.rotation.axis = object.rotation.axis
			if (object.rotation.angle !== undefined) this.rotation.angle = object.rotation.angle
			if (object.rotation.rescale !== undefined) this.rotation.rescale = object.rotation.rescale
			if (object.rotation.origin) {
				if (object.rotation.origin[0] !== undefined) this.rotation.origin[0] = parseFloat(object.rotation.origin[0])
				if (object.rotation.origin[1] !== undefined) this.rotation.origin[1] = parseFloat(object.rotation.origin[1])
				if (object.rotation.origin[2] !== undefined) this.rotation.origin[2] = parseFloat(object.rotation.origin[2])
			}
		}
		if (object.faces) {
			for (var face in this.faces) {
				if (this.faces.hasOwnProperty(face) && object.faces.hasOwnProperty(face)) {
					if (object.faces[face].texture !== undefined) this.faces[face].texture = object.faces[face].texture
					if (object.faces[face].cullface !== undefined) this.faces[face].cullface = object.faces[face].cullface
					if (object.faces[face].rotation !== undefined) this.faces[face].rotation = object.faces[face].rotation
					if (object.faces[face].tintindex !== undefined) this.faces[face].tintindex = object.faces[face].tintindex
					if (object.faces[face].uv) {
						if (object.faces[face].uv[0] !== undefined) this.faces[face].uv[0] = parseFloat(object.faces[face].uv[0])
						if (object.faces[face].uv[1] !== undefined) this.faces[face].uv[1] = parseFloat(object.faces[face].uv[1])
						if (object.faces[face].uv[2] !== undefined) this.faces[face].uv[2] = parseFloat(object.faces[face].uv[2])
						if (object.faces[face].uv[3] !== undefined) this.faces[face].uv[3] = parseFloat(object.faces[face].uv[3])
					}
				}
			}
		}
		if (object.display) {
			if (object.display.autouv !== undefined) this.display.autouv = object.display.autouv
			if (object.display.export !== undefined) this.display.export = object.display.export
			if (object.display.visibility !== undefined) this.display.visibility = object.display.visibility
		}
		return this;
	}
	remove(update) {
		TreeElements.clearObjectRecursive(this)
		if (this.display.visibility) {
			scene.remove(this.display.mesh)
		}
		var s = elements.remove(this)
		if (s && selected.includes(s)) {
			selected.splice(selected.indexOf(s), 1)
		}
		delete this;
		if (update) {
			Canvas.updateIndexes()
		}
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
				if (selected.length > 1 && selected.includes(scope.index())) {
					renameCubes()
				} else {
					scope.rename()
				}
			}}
		])
	}
	duplicate() {
		selected.length = 0
		this.selectLow()
		duplicateCubes()
		elements[selected[0]].addTo(this)
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
		//
	}
	setAutoUV(val) {
		this.display.autouv = val !== false;
		//scaleCube(this, 0, 0)
		Canvas.updateSelectedFaces()
	}
}
	Cube.prototype.title = 'Cube'
	Cube.prototype.icon = 'fa fa-cube'
	Cube.prototype.isParent = false
	Cube.prototype.buttons = [
		OutlinerButtons.autouv,
		OutlinerButtons.shading,
		OutlinerButtons.export,
		OutlinerButtons.visibility,
		OutlinerButtons.remove
	]
class Group extends OutlinerElement {
	constructor(name) {
		super()
		if (name === undefined) {
			this.name = 'group'
		} else {
			this.name = name
		}
		this.children = []
		this.origin = [8, 8, 8]
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
		if (currently_renaming) return;
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
	}
	openUp() {
		this.isOpen = true
		this.updateElement()
		if (this.display.parent && this.display.parent !== 'root') {
			this.display.parent.openUp()
		} else {
			this.scrollOutlinerTo()
		}
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
	}
	renameChildren() {
		stopRenameCubes()
		textPrompt('Rename Elements', '', elements[selected[0]].name, renameCubeList)
	}
	showContextMenu(event) {
		var scope = this;
		new ContextMenu(event, [
			{icon: 'content_copy', name: 'Duplicate', click: function() {scope.duplicate();setUndo('Duplicated Group')}},
			{icon: 'sort_by_alpha', name: 'Sort', click: function() {scope.sortContent()}},
			{icon: 'fa-leaf', name: 'Resolve', click: function() {scope.resolve();setUndo('Resolved Group')}},
			{icon: 'text_format', name: 'Rename', click: function() {scope.rename()}},
			{icon: 'fa-align-left', name: 'Rename Content', click: function() {scope.renameChildren()}}
		])
	}
	sortContent() {
		if (this.children.length < 1) return;
		this.children.sort(function(a,b) {
			return sort_collator.compare(a.name, b.name)
		});
		setUndo('Sorted group')
	}
	duplicate() {
		var i = 0;
		function duplicateArray(g1, g2) {
			var array = g1.children
			i = 0;
			while (i < array.length) {
				if (array[i].title === 'Cube') {
					var dupl = new Cube().extend(array[i])
					dupl.addTo(g2)
					elements.push(dupl)
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
		base_group.addTo(this.display.parent)
		Canvas.updateAll()
		return base_group;
	}
	getChildlessCopy() {
		var base_group = new Group()
		base_group.name = this.name
		base_group.origin = this.origin
		base_group.shade = this.shade
		base_group.display.visibility = this.display.visibility
		base_group.display.export = this.display.export
		base_group.display.autouv = this.display.autouv
		return base_group;
	}
	forEachChild(func) {
		var i = 0
		while (i < this.children.length) {
			func(this.children[i])
			if (this.children[i].title === 'Group') {
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
		this.forEachChild(function(s) {
			s.shade = val !== false;
			s.updateElement()
		})
		this.shade = val !== false;
		this.updateElement()
	}
	setAutoUV(val) {
		this.forEachChild(function(s) {
			s.display.autouv = val !== false;
			s.updateElement()
		})
		this.display.autouv = val !== false;
		this.updateElement()
	}
}
	Group.prototype.title = 'Group'
	Group.prototype.icon = 'fa fa-folder'
	Group.prototype.isParent = true
	Group.prototype.buttons = [
		OutlinerButtons.autouv,
		OutlinerButtons.shading,
		OutlinerButtons.export,
		OutlinerButtons.visibility,
		OutlinerButtons.remove
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
	if (selected.length > 1 && selected.includes(item.index())) {
		var items = selected.Elements()
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
			if (array[i].title === 'Group')
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
function compileGroups(save_nonexported) {
	var result = []
	function iterate(array, save_array) {
		var i = 0;
		while (i < array.length) {
			if (array[i].title === 'Cube') {
				if (!save_nonexported || array[i].display.save_nonexported === true) {
					save_array.push(elements.indexOf(array[i]))
				}
			} else if (array[i].title === 'Group') {
				var obj = {
					name: array[i].name,
					origin: array[i].origin,
					isOpen: array[i].isOpen,
					display: $.extend(true, {}, array[i].display),
					children: []
				}
				delete obj.display.parent
				delete obj.display.isselected
				if (array[i].children.length > 0) {
					iterate(array[i].children, obj.children)
				}
				save_array.push(obj)
			}
			i++;
		}
	}
	iterate(TreeElements, result)
	return result;
}
function parseGroups(array) {
	function iterate(array, save_array, addGroup) {
		var i = 0;
		while (i < array.length) {
			if (typeof array[i] === 'number') {
				if (elements[array[i]]) {
					save_array.push(elements[array[i]])
					elements[array[i]].display.parent = addGroup
				}
			} else {
				var obj = new Group()
				obj.name = array[i].name
				obj.origin = array[i].origin
				obj.isOpen = array[i].isOpen
				obj.display.visibility = array[i].display.visibility
				obj.display.export = array[i].display.export
				obj.display.autouv = array[i].display.autouv
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
	TreeElements.length = 1
	TreeElements.splice(0, 1)
	iterate(array, TreeElements, 'root')
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
				return helper;
			},
			revert: 'invalid',
			appendTo: 'body',
			zIndex: 19
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
					if (target.title === 'Group') {
						target.forEachChild(function(s) {
							if (s.title === 'Group') return;
							sides.forEach(function(side) {
								s.faces[side].texture = '#'+id
							})
						})
					} else {
						var targets;
						if (selected.includes( target.index() )) {
							targets = selected.Elements()
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

function dropOutlinerObjects(item, target, event) {
	var items;
	if (item.title === 'Cube' && selected.includes( item.index() )) {
		items = selected.Elements()
	} else {
		items = [item]
	}
	items.forEach(function(item) {
		if (item && item !== target) {
			if (event.altKey) { 
				if (item.title === 'Cube') {
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
	if (selected_group) {
		base_cube.addTo(selected_group)
	} else {
		base_cube.addTo()
	}


	if (selected_group) selected_group.unselect()
	elements.push(base_cube)
	selected = [elements.length-1]
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
		elements[s].addTo(base_group)
		if (i === 0) {
			elements[s].display.isselected = false
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

function enterGroupOriginMode() {
	setOriginHelper({origin: selected_group.origin, axis: 'x', angle: 0})
	$('.ui#options').css('visibility', 'visible')
	$('.ui#options h3').text('Group Settings')
	$('div.nslide[n-action="origin_x"]:not(".editing")').text(trimFloatNumber(selected_group.origin[0]))
	$('div.nslide[n-action="origin_y"]:not(".editing")').text(trimFloatNumber(selected_group.origin[1]))
	$('div.nslide[n-action="origin_z"]:not(".editing")').text(trimFloatNumber(selected_group.origin[2]))
}


//Misc
function isMovementOnRotatedAxis() {
	if (settings.move_origin.value) {
		if (selected.length > 1) {
			if (elements[selected[0]].rotation === undefined) return false;
			var i = 0;
			var code = null;
			while (i < selected.length) {
				var new_code = getAxisRotationCode(elements[selected[i]].rotation)
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
//Actions
function duplicateCubes() {
	selected.forEach(function(s, i) {
		var old_group = elements[s].display.parent
		var base_cube = new Cube()
		base_cube.extend(elements[s])
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

		Canvas.addCube(elements.length-1)

		selected[i] = elements.length-1
	})
	setTool('translate')//( Also updates selection)
	setUndo('Duplicated cube'+pluralS(selected))
}
function origin2geometry() {
	selected.forEach(function(s) {
		if (elements[s].rotation == undefined) {
			elements[s].rotation = {origin:[8,8,8], axis: 'y', angle: 0}
		}
		elements[s].rotation.origin[0] = (elements[s].size(0) / 2) + elements[s].from[0]
		elements[s].rotation.origin[1] = (elements[s].size(1) / 2) + elements[s].from[1]
		elements[s].rotation.origin[2] = (elements[s].size(2) / 2) + elements[s].from[2]
	})
	Canvas.updatePositions()
	setUndo('Set origin to geometry')
}
var Rotation = {
	angleBefore: 0,
	load: function() {
		var s = selected[0]
		try {
			$('#cube_rotate').val(elements[s].rotation.angle)
			$('#cube_axis').val(elements[s].rotation.axis)
			var rescale = elements[s].rotation.rescale
			if (rescale === undefined) {
				rescale = false;
			}
			$('#cube_rescale').prop('checked', rescale);
		} catch (err) {
			$('#cube_rotate').val('0');
			$('#cube_axis').val('y');
			$('#cube_rescale').prop('checked', false);
		}
	},
	start: function() {
		Rotation.angleBefore = $('#cube_rotate').val();
	},
	slide: function() {
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
		selected.forEach(function(s) {
			if (elements[s].rotation == undefined) {
				elements[s].rotation = {origin:[8,8,8], axis: 'y', angle: 45}
			}
			elements[s].rotation.angle = angle;
			elements[s].rotation.axis = axis;
			if (rescale) {
				elements[s].rotation.rescale = true;
			} else {
				delete elements[s].rotation.rescale;
			}
		})
		Canvas.updatePositions()
	},
	save: function() {
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
	},
	set: function() {
		if (selected.length == 0) {return;}
		var angle = $('#cube_rotate').val()
		var axis = $('#cube_axis option:selected').attr('id')
		var rescale = $('#cube_rescale').is(':checked')
		selected.forEach(function(s) {
			if (elements[s].rotation == undefined) {
				elements[s].rotation = {origin:[8,8,8], axis: 'y', angle: 45}
			}
			elements[s].rotation.angle = parseFloat(angle);
			elements[s].rotation.axis = axis;
			if (rescale) {
				elements[s].rotation.rescale = true;
			} else {
				delete elements[s].rotation.rescale;
			}
		})
		Canvas.updatePositions()
	},
	forceAngle: function(angle) {
		angle = parseFloat(angle)
		var axis = $('#cube_axis option:selected').attr('id')
		selected.forEach(function(s) {
			if (elements[s].rotation == undefined) {
				elements[s].rotation = {origin:[8,8,8], axis: axis, angle: 45}
			}
			elements[s].rotation.angle = angle;
		})
	},
	remove: function() {
		if (selected.length == 0) {return;}
		selected.forEach(function(s) {
			if (elements[s].rotation !== undefined) {
				delete elements[s].rotation;
			}
		})
		Rotation.load()
		updateNslideValues()
		Canvas.updatePositions()
	}
}
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
		elements[s].remove()
	})
	Canvas.updateIndexes()
	setUndo('Removed cubes')
}
function toggleCubeProperty(thing, first_level) {
	if (selected.length === 0) return;
	var value;
	if (first_level) {
		value = !elements[selected[0]][thing]
		selected.forEach(function(s) {
			elements[s][thing] = value
		})
	} else {
		value = !elements[selected[0]].display[thing]
		selected.forEach(function(s) {
			elements[s].display[thing] = value
		})
		if (thing === 'visibility') {
			Canvas.updateAll()
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
		elements[selected[0]].rename()
	} else {
		textPrompt('Rename Elements', '', elements[selected[0]].name, renameCubeList)
	}
}
function stopRenameCubes() {
	if (currently_renaming) {
		$('.outliner_object input.renaming').attr('disabled', true).removeClass('renaming')
		$('body').focus()
		currently_renaming = false
	}
}
function sortOutliner() {
	if (TreeElements.length < 1) return;
	TreeElements.sort(function(a,b) {
		return sort_collator.compare(a.name, b.name)
	});
	setUndo('Sorted outliner')
}