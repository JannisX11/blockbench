const elements = [];
const Outliner = {
	root: [],
	elements: elements,
	selected: selected,
	buttons: {
		remove: {
			id: 'remove',
			title: tl('generic.delete'),
			icon: ' fa fa-times',
			icon_off: ' fa fa-times',
			advanced_option: false,
			click: function(obj) {
				if (obj.type === 'group') {
					obj.remove(true);
					return;
				}
				Undo.initEdit({elements: obj.forSelected(), outliner: true, selection: true})
				obj.forSelected().slice().forEach(cube => {
					cube.remove();
				})
				updateSelection()
				Undo.finishEdit('remove', {elements: [], outliner: true, selection: true})
			}
		},
		visibility: {
			id: 'visibility',
			title: tl('switches.visibility'),
			icon: ' fa fa-eye',
			icon_off: ' fa fa-eye-slash',
			advanced_option: false,
			click: function(obj) {
				obj.toggle('visibility')
			}
		},
		export: {
			id: 'export',
			title: tl('switches.export'),
			icon: ' fa fa-camera',
			icon_off: ' far fa-window-close',
			advanced_option: true,
			click: function(obj) {
				obj.toggle('export')
			}
		},
		shading: {
			id: 'shading',
			get title() {return Project.box_uv ? tl('switches.mirror') : tl('switches.shading')},
			get icon() {return Project.box_uv ? 'fa fa-star' : 'fa fa-star'},
			get icon_off() {return Project.box_uv ? 'fas fa-star-half-alt' : 'far fa-star'},
			advanced_option: true,
			click: function(obj) {
				obj.toggle('shade')
				Canvas.updateUVs()
			}
		},
		autouv: {
			id: 'autouv',
			title: tl('switches.autouv'),
			icon: ' fa fa-thumbtack',
			icon_off: ' far fa-times-circle',
			icon_alt: ' fa fa-magic',
			advanced_option: true,
			click: function(obj) {
				var state = obj.autouv+1
				if (state > 2) state = 0

				obj.toggle('autouv', state)
			}
		}
	}
}
//Colors
var markerColors = [
	{pastel: "#A2EBFF", standard: "#58C0FF", name: 'light_blue'},
	{pastel: "#FFF899", standard: "#F3D81A", name: 'yellow'},
	{pastel: "#E8BD7B", standard: "#EC9218", name: 'orange'},
	{pastel: "#FFA7A4", standard: "#FA565D", name: 'red'},
	{pastel: "#C5A6E8", standard: "#B55AF8", name: 'purple'},
	{pastel: "#A6C8FF", standard: "#4D89FF", name: 'blue'},
	{pastel: "#7BFFA3", standard: "#00CE71", name: 'green'},
	{pastel: "#BDFFA6", standard: "#AFFF62", name: 'lime'}
]
class OutlinerElement {
	constructor(uuid) {
		this.uuid = uuid || guid()
	}
	init() {
		this.constructor.all.safePush(this);
		return this;
	}
	//Sorting
	sortInBefore(element, index_mod) {
		var index = -1;
		index_mod = index_mod || 0;

		if (element.parent === 'root') {
			index = Outliner.root.indexOf(element)
			var arr = Outliner.root
			this.parent = 'root'
		} else {
			index = element.parent.children.indexOf(element)
			element = element.parent
			var arr = element.children
			this.parent = element
		}
		this.removeFromParent()

		//Adding
		if (index < 0)
			arr.push(this)
		else {
			arr.splice(index+index_mod, 0, this)
		}

		TickUpdates.outliner = true;
		return this;
	}
	addTo(group) {
		//Remove
		var index = -1;

		//Resolve Group Argument
		if (group === undefined) {
			group = 'root'
		} else if (group !== 'root') {
			if (group.type !== 'group') {
				if (group.parent === 'root') {
					index = Outliner.root.indexOf(group)+1
					group = 'root'
				} else {
					index = group.parent.children.indexOf(group)+1
					group = group.parent
				}
			}
		}
		this.removeFromParent()

		//Get Array
		if (group === 'root') {
			var arr = Outliner.root
			this.parent = 'root'
		} else {
			var arr = group.children
			this.parent = group
		}

		//Adding
		if (arr.includes(this)) return this;
		if (index < 0)
			arr.push(this)
		else {
			arr.splice(index, 0, this)
		}

		//Loading
		TickUpdates.outliner = true;
		return this;
	}
	removeFromParent() {
		this.getParentArray().remove(this);
		return this;
	}
	getParentArray() {
		if (this.parent === 'root') {
			return Outliner.root
		} else if (typeof this.parent === 'object') {
			return this.parent.children
		}
	}
	//Outliner
	showInOutliner() {
		var scope = this;
		if (this.parent !== 'root') {
			this.parent.openUp()
		}
		Vue.nextTick(() => {
			var el = $('#'+scope.uuid)
			if (el.length === 0) return;
			var outliner_pos = $('#outliner').offset().top

			var el_pos = el.offset().top
			if (el_pos > outliner_pos && el_pos < $('#cubes_list').height() + outliner_pos) return;

			var multiple = el_pos > outliner_pos ? 0.8 : 0.2
			var scroll_amount = el.offset().top  + $('#cubes_list').scrollTop() - outliner_pos - 20
			scroll_amount -= $('#cubes_list').height()*multiple - 15

			$('#cubes_list').animate({
				scrollTop: scroll_amount
			}, 200);
		})
	}
	updateElement() {
		var scope = this;
		var old_name = this.name;
		scope.name = '_&/3%6-7A';
		scope.name = old_name;
		return this;
	}
	getDepth() {
		var d = 0;
		function it(p) {
			if (p.parent) {
				d++;
				return it(p.parent)
			} else {
				return d-1;
			}
		}
		return it(this)
	}
	remove() {
		this.constructor.all.remove(this);
		this.removeFromParent()
	}
	rename() {
		this.showInOutliner()
		var obj = $('#'+this.uuid+' > div.outliner_object > input.cube_name')
		obj.attr('disabled', false)
		obj.select()
		obj.focus()
		obj.addClass('renaming')
		Blockbench.addFlag('renaming')
		this.old_name = this.name
		return this;
	}
	saveName(save) {
		var scope = this;
		if (save !== false && scope.name.trim().length > 0 && scope.name != scope.old_name) {
			var name = scope.name.trim();
			scope.name = scope.old_name;
			if (scope.type === 'group') {
				Undo.initEdit({outliner: true})
			} else {
				Undo.initEdit({elements: [scope]})
			}
			scope.name = name
			scope.sanitizeName();
			delete scope.old_name
			if (Condition(scope.needsUniqueName)) {
				scope.createUniqueName()
			}
			Undo.finishEdit('rename')
		} else {
			scope.name = scope.old_name
			delete scope.old_name
		}
		return this;
	}
	sanitizeName() {
		var name_regex = typeof this.name_regex == 'function' ? this.name_regex(this) : this.name_regex;
		if (name_regex) {
			var regex = new RegExp(`[^${name_regex}]`, 'g');
			this.name = this.name.replace(regex, c => {
				if (c == '-' && '_'.search(regex) == -1) {
					return '_';
				}
				if (c.toLowerCase().search(regex) == -1) {
					return c.toLowerCase();
				}
				return '';
			});
		}
	}
	createUniqueName(arr) {
		if (!Condition(this.needsUniqueName)) return;
		var scope = this;
		var others = this.constructor.all.slice();
		if (arr && arr.length) {
			arr.forEach(g => {
				others.safePush(g)
			})
		}
		var name = this.name.replace(/\d+$/, '').replace(/\s+/g, '_');
		function check(n) {
			for (var i = 0; i < others.length; i++) {
				if (others[i] !== scope && others[i].name == n) return false;
			}
			return true;
		}
		if (check(this.name)) {
			return this.name;
		}
		for (var num = 2; num < 8e3; num++) {
			if (check(name+num)) {
				scope.name = name+num;
				return scope.name;
			}
		}
		return false;
	}
	isIconEnabled(btn) {
		switch (btn.id) {
			case 'visibility': 
				return this.visibility
				break;
			case 'export': 
				return this.export
				break;
			case 'shading': 
				return this.shade
				break;
			case 'autouv': 
				if (!this.autouv) {
					return false
				} else if (this.autouv === 1) {
					return true
				} else {
					return 'alt'
				}
				break;
		}
		return true;
	}
	isChildOf(group, max_levels) {
		function iterate(obj, level) {
			if (!obj || obj === 'root') {
				return false;
			} else if (obj === group) {
				return true;
			} else if (!max_levels || level < max_levels-1) {
				return iterate(obj.parent, level+1)
			}
			return false;
		}
		return iterate(this.parent, 0)
	}
	get mirror_uv() {
		return !this.shade;
	}
	set mirror_uv(val) {
		this.shade = !val;
	}
}
class NonGroup extends OutlinerElement {
	constructor(data, uuid) {
		super(uuid);
		this.parent = 'root';
		this.selected = false;
	}
	init() {
		super.init();
		elements.safePush(this);
	}
	remove() {
		super.remove()
		selected.remove(this);
		elements.remove(this);
		this.constructor.selected.remove(this);
		return this;
	}
	showContextMenu(event) {
		Prop.active_panel = 'outliner'
		if (!this.selected) {
			this.select()
		}
		this.menu.open(event, this)
		return this;
	}
	forSelected(fc, undo_tag) {
		if (this.constructor.selected.length <= 1 || !this.constructor.selected.includes(this)) {
			var edited = [this]
		} else {
			var edited = this.constructor.selected
		}
		if (typeof fc === 'function') {
			if (undo_tag) {
				Undo.initEdit({elements: edited})
			}
			for (var i = 0; i < edited.length; i++) {
				fc(edited[i])
			}
			if (undo_tag) {
				Undo.finishEdit(undo_tag)
			}
		}
		return edited;
	}
	toggle(key, val) {
		if (val === undefined) {
			var val = !this[key]
		}
		this.forSelected((cube) => {
			cube[key] = val
		}, 'toggle '+key)
		if (key === 'visibility') {
			Canvas.updateVisibility()
		}
		return this;
	}
	duplicate() {
		var copy = new this.constructor(this);
		//Numberation
		var number = copy.name.match(/[0-9]+$/)
		if (number) {
			number = parseInt(number[0])
			copy.name = copy.name.split(number).join(number+1)
		}
		//Rest
		copy.sortInBefore(this, 1).init()
		var index = selected.indexOf(this)
		if (index >= 0) {
			selected[index] = copy
		} else {
			selected.push(copy)
		}
		if (Condition(copy.needsUniqueName)) {
			copy.createUniqueName()
		}
		TickUpdates.outliner = true;
		TickUpdates.selection = true;
		return copy;
	}
	select(event, isOutlinerClick) {
		var scope = this;
		if (scope === undefined || Modes.animate) return false;
		//Shiftv
		var just_selected = []
		if (event && event.shiftKey === true && scope.getParentArray().includes(selected[selected.length-1]) && !Modes.paint && isOutlinerClick) {
			var starting_point;
			var last_selected = selected[selected.length-1]
			scope.getParentArray().forEach(function(s, i) {
				if (s === last_selected || s === scope) {
					if (starting_point) {
						starting_point = false
					} else {
						starting_point = true
					}
					if (s.type !== 'group') {
						if (!selected.includes(s)) {
							s.selectLow()
							just_selected.push(s)
						}
					} else {
						s.selectLow()
					}
				} else if (starting_point) {
					if (s.type !== 'group') {
						if (!selected.includes(s)) {
							s.selectLow()
							just_selected.push(s)
						}
					} else {
						s.selectLow()
					}
				}
			})

		//Control
		} else if (event && !Modes.paint && (event.ctrlOrCmd || event.shiftKey )) {
			if (selected.includes(scope)) {
				selected = selected.filter(function(e) {
					return e !== scope
				})
			} else {
				scope.selectLow()
				just_selected.push(scope)
			}

		//Normal
		} else {
			selected.forEachReverse(obj => obj.unselect())
			if (Group.selected) Group.selected.unselect()
			scope.selectLow()
			just_selected.push(scope)
			scope.showInOutliner()
		}
		if (Group.selected) {
			Group.selected.unselect()
		}
		Group.all.forEach(function(s) {
			s.selected = false;
		})
		Blockbench.dispatchEvent('added_to_selection', {added: just_selected})
		updateSelection()
		return this;
	}
	selectLow() {
		selected.safePush(this);
		this.constructor.selected.safePush(this)
		this.selected = true;
		TickUpdates.selection = true;
		return this;
	}
	unselect() {
		selected.remove(this);
		this.selected = false;
		this.constructor.selected.remove(this);
		TickUpdates.selection = true;
		return this;
	}
}
	NonGroup.prototype.isParent = false;
	NonGroup.fromSave = function(obj, keep_uuid) {
		switch (obj.type) {
			case 'locator':
				return new Locator(obj, keep_uuid ? obj.uuid : 0).init()
				break;
			case 'cube': default:
				return new Cube(obj, keep_uuid ? obj.uuid : 0).init()
				break;
		}
	}

Array.prototype.findRecursive = function(key1, val) {
	var i = 0
	while (i < this.length) {
		if (this[i][key1] === val) {
			return this[i];
		} else if (this[i].children && this[i].children.length > 0) {
			let inner = this[i].children.findRecursive(key1, val)
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
	iterate(Outliner.root)
	return ta;
}
function compileGroups(undo, lut) {
	var result = []
	function iterate(array, save_array) {
		var i = 0;
		for (var element of array) {
			if (element.type === 'group') {

				if (lut === undefined || element.export === true) {

					var obj = element.compile(undo)

					if (element.children.length > 0) {
						iterate(element.children, obj.children)
					}
					save_array.push(obj)
				}
			} else {
				if (undo) {
					save_array.push(element.uuid)
				} else {
					if (lut) {
						var index = lut[elements.indexOf(element)]
					} else {
						var index = elements.indexOf(element)
					}
					if (index >= 0) {
						save_array.push(index)
					}
				}
			}
			i++;
		}
	}
	iterate(Outliner.root, result)
	return result;
}
function parseGroups(array, importGroup, startIndex) {
	function iterate(array, save_array, addGroup) {
		var i = 0;
		while (i < array.length) {
			if (typeof array[i] === 'number' || typeof array[i] === 'string') {

				if (typeof array[i] === 'number') {
					var obj = elements[array[i] + (startIndex ? startIndex : 0) ]
				} else {
					var obj = elements.findRecursive('uuid', array[i])
				}
				if (obj) {
					obj.removeFromParent()
					save_array.push(obj)
					obj.parent = addGroup
					if (Blockbench.hasFlag('importing') && typeof addGroup === 'object') {
						if (obj instanceof Cube) {
							if (addGroup.autouv !== undefined) {
								obj.autouv = addGroup.autouv
								if (obj.autouv === true) obj.autouv = 1
								if (obj.autouv === false) obj.autouv = 0
							}
							if (addGroup.visibility !== undefined) {
								obj.visibility = addGroup.visibility
							}
						}
					}
				}
			} else {
				var obj = new Group(array[i])
				obj.parent = addGroup
				obj.isOpen = !!array[i].isOpen
				if (array[i].uuid) {
					obj.uuid = array[i].uuid
				}
				save_array.push(obj)
				obj.init()
				if (array[i].children && array[i].children.length > 0) {
					iterate(array[i].children, obj.children, obj)
				}
				if (array[i].content && array[i].content.length > 0) {
					iterate(array[i].content, obj.children, obj)
				}
			}
			i++;
		}
	}
	if (importGroup && startIndex !== undefined) {
		iterate(array, importGroup.children, importGroup)
	} else {
		Outliner.root.length = 1;
		Outliner.root.splice(0, 1);
		Group.all.empty();
		iterate(array, Outliner.root, 'root');
	}
}
//Outliner
function loadOutlinerDraggable() {
	if (Blockbench.isMobile) {
		return;
	}
	function getOrder(loc, obj) {
		if (!obj) {
			return;
		} else if (obj.type === 'group') {
			if (loc < 8) return -1;
			if (loc > 24) return 1;
		} else {
			if (loc < 16) return -1;
			return 1;
		}
		return 0;
	}
	Vue.nextTick(function() {
		$('li.outliner_node:not(.ui-droppable) > div.outliner_object').draggable({
			delay: 120,
			revertDuration: 50,
			helper: function() {
				var item = Outliner.root.findRecursive('uuid', $(this).attr('id'))
				var helper = $(this).clone()
				if (selected.length > 1) {
					helper.append('<div class="outliner_drag_number">'+selected.length+'</div>')
				}
				helper.addClass('')
				helper.on('mousewheel', function() {
					var delta = event.deltaY * 1 + $('#cubes_list').scrollTop()
					$('#cubes_list').animate({scrollTop: delta}, 10);
				})
				return helper;
			},
			revert: 'invalid',
			appendTo: 'body',
			zIndex: 19,
			cursorAt: {left: 5},
			drag: function(event, ui) {
				$('.outliner_node[order]').attr('order', null)
				if ($('#cubes_list.drag_hover').length === 0) {
					var tar = $('#cubes_list li .drag_hover.outliner_node').last()
					var element = Outliner.root.findRecursive('uuid', tar.attr('id'))
					if (element) {
						var location = event.clientY - tar.position().top
						var order = getOrder(location, element)
						tar.attr('order', order)
					}
				}
			}
		})
		$('li.outliner_node:not(.ui-droppable)').droppable({
			greedy: true,
			accept: function(s) { 
				if (s.hasClass('outliner_object') || s.hasClass('texture')) { 
					return true;
				}
			},
			tolerance: 'pointer',
			hoverClass: 'drag_hover',
			addClasses: false,
			drop: function(event, ui) {
				$('.outliner_node[order]').attr('order', null)
				var location = event.clientY - $(event.target).position().top
				$('.drag_hover').removeClass('drag_hover')
				var target = Outliner.root.findRecursive('uuid', $(event.target).attr('id'))

				if ($(ui.draggable).hasClass('outliner_object')) {
					//Object
					var item = Outliner.root.findRecursive('uuid', $(ui.draggable).parent().attr('id'))
					var order = getOrder(location, target)
					dropOutlinerObjects(item, target, event, order)

				} else if ($(ui.draggable).hasClass('texture')) {
					//Texture
					var uuid = $(ui.helper).attr('texid')
					var array = [];

					if (target.type === 'group') {
						target.forEachChild(function(cube) {
							array.push(cube)
						}, Cube)
					} else {
						array = selected.includes(target) ? selected : [target];
					}
					Undo.initEdit({elements: array, uv_only: true})
					array.forEach(function(cube) {
						for (var face in cube.faces) {
							cube.faces[face].texture = uuid
						}
					})
					Undo.finishEdit('drop texture')

					main_uv.loadData()
					Canvas.updateAllFaces()
				}
			}
		})
	})
}
function dropOutlinerObjects(item, target, event, order) {
	if (Format.bone_rig && item instanceof Group == false && target instanceof OutlinerElement == false) return;

	if (item.type === 'group' && target && target.parent) {
		var is_parent = false;
		function iterate(g) {
			if (!(is_parent = g === item) && g.parent.type === 'group') {
				iterate(g.parent)
			}
		}
		iterate(target)
		if (is_parent) return;
	}
	if (item instanceof NonGroup && selected.includes( item )) {
		var items = selected.slice();
	} else {
		var items = [item];
	}
	if (event.altKey) {
		Undo.initEdit({elements: [], outliner: true, selection: true})
		selected.length = 0
	} else {
		Undo.initEdit({outliner: true, selection: true})
		var updatePosRecursive = function(item) {
			if (item.type === 'cube') {
				Canvas.adaptObjectPosition(item)
			} else if (item.type === 'group' && item.children && item.children.length) {
				item.children.forEach(updatePosRecursive)
			}
		}
	}
	if (order) {
		var parent = target.parent
		if (!parent || parent === 'root') {
			parent = {children: Outliner.root};
		}
	}
	function place(obj) {
		if (!order) {
			obj.addTo(target)
		} else {
			obj.removeFromParent()
			var position = parent.children.indexOf(target)
			if (order === 1) position++;
			parent.children.splice(position, 0, obj)
			obj.parent = parent.type ? parent : 'root';
		}
	}
	items.forEach(function(item) {
		if (item && item !== target) {
			if (event.altKey) {
				if (item instanceof Group) {
					var dupl = item.duplicate()
					place(dupl)
					dupl.select()
				} else {
					var cube = item.duplicate()
					place(cube)
					selected.push(cube)
				}
			} else {
				place(item)
				if (Format.bone_rig) {
					updatePosRecursive(item)
				}
			}
		}
	})
	loadOutlinerDraggable()
	if (Format.bone_rig) {
		Canvas.updateAllBones()
	}
	if (event.altKey) {
		updateSelection()
		Undo.finishEdit('drag', {elements: selected, outliner: true, selection: true})
	} else {
		Undo.finishEdit('drag')
	}
}

//Misc
function renameOutliner(element) {
	stopRenameOutliner()

	if (Group.selected && !element && !EditSession.active) {
		Group.selected.rename()

	} else if (selected.length === 1 && !EditSession.active) {
		selected[0].rename()

	} else {

		if (Group.selected && !element) {
			Blockbench.textPrompt('generic.rename', Group.selected.name, function (name) {
				name = name.trim();
				if (name) {
					Undo.initEdit({group: Group.selected})
					Group.selected.name = name
					if (Format.bone_rig) {
						Group.selected.createUniqueName()
					}
					Undo.finishEdit('rename group')
				}
			})
		} else if (selected.length) {
			Blockbench.textPrompt('generic.rename', selected[0].name, function (name) {
				name = name.trim();
				if (name) {
					Undo.initEdit({elements: selected})
					selected.forEach(function(obj, i) {
						obj.name = name.replace(/%/g, obj.index).replace(/\$/g, i)
					})
					Undo.finishEdit('rename')
				}
			})
		}
	}
}
function stopRenameOutliner(save) {
	if (Blockbench.hasFlag('renaming')) {
		var uuid = $('.outliner_object input.renaming').parent().parent().attr('id')
		var element = Outliner.root.findRecursive('uuid', uuid)
		if (element) {
			element.saveName(save)
		}
		$('.outliner_object input.renaming').attr('disabled', true).removeClass('renaming')
		$('body').focus()
		if (window.getSelection) {
			window.getSelection().removeAllRanges()
		} else if (document.selection) {
			document.selection.empty()
		}
		Blockbench.removeFlag('renaming')
	}
}
function toggleCubeProperty(key) {
	if (!Cube.selected.length) return;
	var state = Cube.selected[0][key]
	if (typeof state === 'number') {
		state++;
		if (state === 3) {
			state = 0
		}
	} else {
		state = !state
	}
	Undo.initEdit({elements: Cube.selected})
	Cube.selected.forEach(cube => {
		cube[key] = state;
	})
	if (key === 'visibility') {
		Canvas.updateVisibility()
	}
	if (key === 'shade' && Project.box_uv) {
		Canvas.updateUVs()
	}
	Undo.finishEdit('toggle_prop')
}


onVueSetup(function() {
	Outliner.vue = new Vue({
		el: '#cubes_list',
		data: {
			option: {
				root: {
					name: 'Model',
					isParent: true,
					isOpen: true,
					selected: false,
					onOpened: function () {},
					select: function() {},
					children: Outliner.root
				}
			}
		}
	})
})

BARS.defineActions(function() {
	new Action('outliner_toggle', {
		icon: 'view_stream',
		category: 'edit',
		keybind: new Keybind({key: 115}),
		click: function () {
			
			var state = !$('.panel#outliner').hasClass('more_options')
			if (state) {
				$('.panel#outliner').addClass('more_options')
				BarItems.outliner_toggle.setIcon('dns')
			} else {
				$('.panel#outliner').removeClass('more_options')
				BarItems.outliner_toggle.setIcon('view_stream')
			}
		}
	})
	new BarText('cube_counter', {
		right: true,
		click: function() {

			var face_count = 0;
			if (Project.box_uv) {
				face_count = Cube.all.length*6;
			} else {
				Cube.all.forEach(cube => {
					for (var face in cube.faces) {
						if (cube.faces[face].texture !== null) face_count++;
					}
				})
			}
			var dialog = new Dialog({
				id: 'model_stats',
				title: 'dialog.model_stats.title',
				width: 300,
				singleButton: true,
				form: {
					cubes: {type: 'text', label: tl('dialog.model_stats.cubes'), text: ''+Cube.all.length },
					locators: {type: 'text', label: tl('dialog.model_stats.locators'), text: ''+Locator.all.length, condition: Format.locators },
					groups: {type: 'text', label: tl('dialog.model_stats.groups'), text: ''+Group.all.length },
					vertices: {type: 'text', label: tl('dialog.model_stats.vertices'), text: ''+Cube.all.length*8 },
					faces: {type: 'text', label: tl('dialog.model_stats.faces'), text: ''+face_count },
				}
			})
			dialog.show()

		},
		onUpdate: function() {
			if (Animator.open) {
				var sel = 0;
				if (Group.selected) {
					Group.selected.forEachChild(_ => sel++, Group, true)
				}
				this.set(sel+'/'+Group.all.length)
			} else {
				this.set(selected.length+'/'+elements.length)
			}
		}
	})

	new Action('sort_outliner', {
		icon: 'sort_by_alpha',
		category: 'edit',
		click: function () {
			Undo.initEdit({outliner: true});
			if (Outliner.root.length < 1) return;
			Outliner.root.sort(function(a,b) {
				return sort_collator.compare(a.name, b.name)
			});
			Undo.finishEdit('sort_outliner')
		}
	})
	new Action('local_move', {
		icon: 'check_box',
		category: 'edit',
		condition: () => Modes.edit,
		linked_setting: 'local_move',
		click: function () {
			BarItems.local_move.toggleLinkedSetting()
			updateSelection()
		}
	})
	new Action('element_colors', {
		icon: 'check_box',
		category: 'edit',
		linked_setting: 'outliner_colors',
		click: function () {
			BarItems.element_colors.toggleLinkedSetting()
			updateSelection()
		}
	})
	new Action('select_window', {
		icon: 'filter_list',
		category: 'edit',
		keybind: new Keybind({key: 70, ctrl: true}),
		condition: () => Modes.edit || Modes.paivnt,
		click: function () {
			showDialog('selection_creator')
			$('#selgen_name').focus()
		}
	})
	new Action('invert_selection', {
		icon: 'swap_vert',
		category: 'edit',
		keybind: new Keybind({key: 73, ctrl: true}),
		condition: () => Modes.edit || Modes.paint,
		click: function () {
			elements.forEach(function(s) {
				if (s.selected) {
					s.unselect()
				} else {
					s.selectLow()
				}
			})
			if (Group.selected) Group.selected.unselect()
			updateSelection()
			Blockbench.dispatchEvent('invert_selection')
		}
	})
	new Action('select_all', {
		icon: 'select_all',
		category: 'edit',
		condition: () => !Modes.display,
		keybind: new Keybind({key: 65, ctrl: true}),
		click: function () {selectAll()}
	})
})
