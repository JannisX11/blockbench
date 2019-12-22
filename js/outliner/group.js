
class Group extends OutlinerElement {
	constructor(data) {
		super()
		this.name = Format.bone_rig ? 'bone' : 'group'
		this.children = []
		if (Format.centered_grid) {
			this.origin = [0, 0, 0];
		} else {
			this.origin = [8, 8, 8];
		}
		this.rotation = [0, 0, 0];
		this.reset = false;
		this.shade = true;
		this.selected = false;
		this.visibility = true;
		this.export = true;
		this.autouv = 0;
		this.parent = 'root';
		this.isOpen = false;
		this.ik_enabled = false;
		this.ik_chain_length = 0;

		if (typeof data === 'object') {
			this.extend(data)
		} else if (typeof data === 'string') {
			this.name = data
		}
	}
	extend(object) {
		Merge.string(this, object, 'name')
		this.sanitizeName();
		Merge.boolean(this, object, 'shade')
		Merge.boolean(this, object, 'mirror_uv')
		Merge.boolean(this, object, 'reset')
		if (object.origin) {
			Merge.number(this.origin, object.origin, 0)
			Merge.number(this.origin, object.origin, 1)
			Merge.number(this.origin, object.origin, 2)
		}
		if (object.rotation) {
			Merge.number(this.rotation, object.rotation, 0)
			Merge.number(this.rotation, object.rotation, 1)
			Merge.number(this.rotation, object.rotation, 2)
		}
		Merge.number(this, object, 'autouv')
		Merge.boolean(this, object, 'export')
		Merge.boolean(this, object, 'visibility')
		return this;
	}
	getMesh() {
		return this.mesh;
	}
	get mesh() {
		var bone = Canvas.bones[this.uuid]
		if (!bone) {
			bone = new THREE.Object3D()
			bone.name = this.name
			bone.isGroup = true
			Canvas.bones[this.uuid] = bone
		}
		return bone;
	}
	init() {
		super.init();
		if (typeof this.parent !== 'object') {
			this.addTo();
		}
		return this;
	}
	select(event) {
		var scope = this;
		if (Blockbench.hasFlag('renaming')) return this;
		if (!event) event = true
		var allSelected = Group.selected === this && selected.length && this.matchesSelection()

		//Clear Old Group
		if (Group.selected) Group.selected.unselect()
		if (event.shiftKey !== true && event.ctrlOrCmd !== true) {
			selected.length = 0
		}
		//Select This Group
		Group.all.forEach(function(s) {
			s.selected = false
		})
		this.selected = true
		Group.selected = this;

		//Select / Unselect Children
		if (allSelected && event.which === 1) {
			//Select Only Group, unselect Children
			selected.length = 0
		} else {
			scope.children.forEach(function(s) {
				s.selectLow()
			})
		}
		if (Animator.open) {
			if (Animator.selected) {
				Animator.selected.getBoneAnimator().select(true)
			}
		}
		updateSelection()
		return this;
	}
	selectChildren(event) {
		var scope = this;
		if (Blockbench.hasFlag('renaming')) return;
		if (!event) event = {shiftKey: false}
		var firstChildSelected = false

		//Clear Old Group
		if (Group.selected) Group.selected.unselect()
		selected.length = 0

		//Select This Group
		Group.all.forEach(function(s) {
			s.selected = false
		})
		this.selected = true
		Group.selected = this

		scope.children.forEach(function(s) {
			s.selectLow()
		})
		updateSelection()
		return this;
	}
	selectLow(highlight) {
		//Group.selected = this;
		//Only Select
		if (highlight !== false) {
			this.selected = true
		}
		this.children.forEach(function(s) {
			s.selectLow(highlight)
		})
		TickUpdates.selection = true;
		return this;
	}
	unselect() {
		if (this.selected === false) return;
		if (Animator.open && Animator.selected) {
			var ba = Animator.selected.animators[this.uuid];
			if (ba) {
				ba.selected = false
			}
		}
		Group.selected = undefined;
		this.selected = false
		TickUpdates.selection = true;
		return this;
	}
	matchesSelection() {
		var scope = this;
		var match = true;
		for (var i = 0; i < selected.length; i++) {
			if (!selected[i].isChildOf(scope, 20)) {
				return false
			}
		}
		this.forEachChild(obj => {
			if (!obj.selected) {
				match = false
			}
		})
		return match;
	}
	openUp() {
		this.isOpen = true
		this.updateElement()
		if (this.parent && this.parent !== 'root') {
			this.parent.openUp()
		}
		return this;
	}
	remove(undo) {
		var scope = this;
		if (undo) {
			var cubes = []
			this.forEachChild(function(element) {
				if (element.type !== 'group') {
					cubes.push(element)
				}
			})
			Undo.initEdit({elements: cubes, outliner: true, selection: true})
		}
		this.unselect()
		var i = this.children.length-1
		while (i >= 0) {
			this.children[i].remove(false)
			i--;
		}
		if (typeof this.parent === 'object') {
			this.parent.children.remove(this)
		} else {
			Outliner.root.remove(this)
		}
		Animator.animations.forEach(animation => {
			if (animation.animators && animation.animators[scope.uuid]) {
				delete animation.animators[scope.uuid];
			}
			if (animation.selected && Animator.open) {
				updateKeyframeSelection();
			}
		})
		TickUpdates.selection = true
		this.constructor.all.remove(this);
		if (undo) {
			cubes.length = 0
			Undo.finishEdit('removed_group')
		}
	}
	resolve() {
		var scope = this;
		var array = this.children.slice().reverse();

		array.forEach(function(s, i) {
			s.addTo(scope.parent)
		})
		TickUpdates.outliner = true;
		this.remove(false);
		return array;
	}
	showContextMenu(event) {
		Prop.active_panel = 'outliner'
		this.select(event)
		this.menu.open(event, this)
		return this;
	}
	transferOrigin(origin) {
		if (!this.mesh) return;
		var q = new THREE.Quaternion().copy(this.mesh.quaternion)
		var shift = new THREE.Vector3(
			this.origin[0] - origin[0],
			this.origin[1] - origin[1],
			this.origin[2] - origin[2],
		)
		var dq = new THREE.Vector3().copy(shift)
		dq.applyQuaternion(q)
		shift.sub(dq)
		shift.applyQuaternion(q.inverse())
		this.origin = origin.slice();

		function iterateChild(obj) {
			if (obj instanceof Group) {
				obj.origin[0] += shift.x;
				obj.origin[1] += shift.y;
				obj.origin[2] += shift.z;
				obj.children.forEach(child => iterateChild(child));

			} else {
				if (obj.movable) {
					obj.from[0] += shift.x;
					obj.from[1] += shift.y;
					obj.from[2] += shift.z;
				}
				if (obj.resizable) {
					obj.to[0] += shift.x;
					obj.to[1] += shift.y;
					obj.to[2] += shift.z;
				}
				if (obj.rotatable) {
					obj.origin[0] += shift.x;
					obj.origin[1] += shift.y;
					obj.origin[2] += shift.z;
				}
			}
		}
		this.children.forEach(child => iterateChild(child));

		Canvas.updatePositions()
		return this;
	}
	sortContent() {
		Undo.initEdit({outliner: true})
		if (this.children.length < 1) return;
		this.children.sort(function(a,b) {
			return sort_collator.compare(a.name, b.name)
		});
		Undo.finishEdit('sort')
		return this;
	}
	duplicate() {
		var copied_groups = [];
		var copy = this.getChildlessCopy()
		delete copy.parent;
		copied_groups.push(copy)
		copy.sortInBefore(this, 1).init()
		if (Format.bone_rig) {
			copy.createUniqueName()
		}
		for (var child of this.children) {
			child.duplicate().addTo(copy)
		}
		copy.isOpen = true;
		Canvas.updatePositions()
		TickUpdates.outliner = true;
		return copy;
	}
	getSaveCopy() {
		var scope = this;
		var base_group = this.getChildlessCopy();
		for (var child of this.children) {
			base_group.children.push(child.getSaveCopy());
		}
		delete base_group.parent;
		return base_group;
	}
	getChildlessCopy() {
		var base_group = new Group();
		base_group.name = this.name;
		base_group.origin = this.origin.slice();
		base_group.rotation = this.rotation.slice();
		base_group.shade = this.shade;
		base_group.reset = this.reset;
		base_group.visibility = this.visibility;
		base_group.export = this.export;
		base_group.autouv = this.autouv;
		return base_group;
	}
	compile(undo) {
		var obj = {
			name: this.name
		}
		if (this.shade == false) {
			obj.shade = false
		}
		if (undo) {
			obj.uuid = this.uuid;
			obj.export = this.export;
			obj.isOpen = this.isOpen === true;
			obj.visibility = this.visibility;
			obj.autouv = this.autouv;
		}
		obj.origin = this.origin.slice()
		
		if (this.rotation.join('_') !== '0_0_0') {
			obj.rotation = this.rotation.slice()
		}
		if (this.reset) {
			obj.reset = true
		}
		obj.children = []
		return obj;
	}
	forEachChild(cb, type, forSelf) {
		var i = 0
		if (forSelf) {
			cb(this)
		}
		while (i < this.children.length) {
			if (!type || this.children[i] instanceof type) {
				cb(this.children[i])
			}
			if (this.children[i].type === 'group') {
				this.children[i].forEachChild(cb, type)
			}
			i++;
		}
	}
	toggle(key, val) {
		if (val === undefined) {
			var val = !this[key]
		}
		var cubes = []
		this.forEachChild(obj => {
			cubes.push(obj)
		}, NonGroup)
		Undo.initEdit({outliner: true, elements: cubes})
		this.forEachChild(function(s) {
			s[key] = val
			s.updateElement()
		})
		this[key] = val;
		this.updateElement()
		if (key === 'visibility') {
			Canvas.updateVisibility()
		}
		Undo.finishEdit('toggle')
	}
	setAutoUV(val) {
		this.forEachChild(function(s) {
			s.autouv = val;
			s.updateElement()
		})
		this.autouv = val;
		this.updateElement()
	}
}
	Group.prototype.title = tl('data.group');
	Group.prototype.type = 'group';
	Group.prototype.icon = 'fa fa-folder';
	Group.prototype.isParent = true;
	Group.prototype.name_regex = () => Format.bone_rig ? 'a-zA-Z0-9_' : false;
	Group.prototype.buttons = [
		Outliner.buttons.remove,
		Outliner.buttons.visibility,
		Outliner.buttons.export,
		Outliner.buttons.shading,
		Outliner.buttons.autouv
	];
	Group.prototype.needsUniqueName = () => Format.bone_rig;
	Group.prototype.menu = new Menu([
		'copy',
		'paste',
		'duplicate',
		'_',
		'add_locator',
		/*
		{icon: 'content_copy', name: 'menu.group.duplicate', click: function(group) {
			var cubes_before = elements.length
			Undo.initEdit({outliner: true, elements: [], selection: true})
			group.duplicate().sortInBefore(this, 1).select()
			Undo.finishEdit('duplicate_group', {outliner: true, elements: elements.slice(cubes_before), selection: true})
		}},
		*/
		'rename',
		{icon: 'sort_by_alpha', name: 'menu.group.sort', click: function(group) {group.sortContent()}},
		{icon: 'fa-leaf', name: 'menu.group.resolve', click: function(group) {
			Undo.initEdit({outliner: true})
			group.resolve()
			Undo.finishEdit('group resolve')
		}},
	]);
	Group.selected;
	Group.all = [];

function getCurrentGroup() {
	if (Group.selected) {
		return Group.selected
	} else if (selected.length) {
		var g1 = selected[0].parent;
		if (g1 instanceof Group) {
			for (var obj of selected) {
				if (obj.parent !== g1) {
					return;
				}
			}
			return g1;
		}
	}
}
function getAllGroups() {
	var ta = []
	function iterate(array) {
		for (var obj of array) {
			if (obj instanceof Group) {
				ta.push(obj)
				iterate(obj.children)
			}
		}
	}
	iterate(Outliner.root)
	return ta;
}
function addGroup() {
	Undo.initEdit({outliner: true});
	var add_group = Group.selected
	if (!add_group && selected.length) {
		add_group = Cube.selected.last()
	}
	var base_group = new Group({
		origin: add_group ? add_group.origin : undefined
	})
	base_group.addTo(add_group)
	base_group.isOpen = true

	if (Format.bone_rig) {
		base_group.createUniqueName()
	}
	if (add_group instanceof NonGroup && selected.length > 1) {
		selected.forEach(function(s, i) {
			s.addTo(base_group)
		})
	}
	base_group.init().select()
	Undo.finishEdit('add_group');
	loadOutlinerDraggable()
	Vue.nextTick(function() {
		updateSelection()
		if (settings.create_rename.value) {
			base_group.rename()
		}
		base_group.showInOutliner()
		Blockbench.dispatchEvent( 'add_group', {object: base_group} )
	})
}
window.__defineGetter__('selected_group', () => {
	console.warn('selected_group is deprecated. Please use Group.selected instead.')
	return Group.selected
})

BARS.defineActions(function() {
	new Action({
		id: 'add_group',
		icon: 'create_new_folder',
		category: 'edit',
		condition: () => Modes.edit,
		keybind: new Keybind({key: 71, ctrl: true}),
		click: function () {
			addGroup();
		}
	})
	new Action({
		id: 'collapse_groups',
		icon: 'format_indent_decrease',
		category: 'edit',
		condition: () => Outliner.root.length > 0,
		click: function () {
			Group.all.forEach(function(g) {
				g.isOpen = false
				var name = g.name
				g.name = '_$X0v_'
				g.name = name
			})
		}
	})
})
