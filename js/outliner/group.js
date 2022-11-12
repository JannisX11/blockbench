
class Group extends OutlinerNode {
	constructor(data, uuid) {
		super(uuid)

		for (var key in Group.properties) {
			Group.properties[key].reset(this);
		}

		this.name = Format.bone_rig ? 'bone' : 'group'
		this.children = []
		this.reset = false;
		this.shade = true;
		this.mirror_uv = false;
		this.selected = false;
		this.locked = false;
		this.visibility = true;
		this.export = true;
		this.autouv = 0;
		this.parent = 'root';
		this.isOpen = false;

		if (typeof data === 'object') {
			this.extend(data)
		} else if (typeof data === 'string') {
			this.name = data
		}
	}
	extend(object) {
		for (var key in Group.properties) {
			Group.properties[key].merge(this, object)
		}
		Merge.string(this, object, 'name')
		this.sanitizeName();
		Merge.boolean(this, object, 'shade')
		Merge.boolean(this, object, 'mirror_uv')
		Merge.boolean(this, object, 'reset')
		/*
		if (object.origin) {
			Merge.number(this.origin, object.origin, 0)
			Merge.number(this.origin, object.origin, 1)
			Merge.number(this.origin, object.origin, 2)
		}
		if (object.rotation) {
			Merge.number(this.rotation, object.rotation, 0)
			Merge.number(this.rotation, object.rotation, 1)
			Merge.number(this.rotation, object.rotation, 2)
		}*/
		Merge.number(this, object, 'autouv')
		Merge.boolean(this, object, 'export')
		Merge.boolean(this, object, 'locked')
		Merge.boolean(this, object, 'visibility')
		return this;
	}
	getMesh() {
		return this.mesh;
	}
	init() {
		super.init();
		Project.groups.push(this);
		if (typeof this.parent !== 'object') {
			this.addTo();
		}
		if (!this.mesh || !this.mesh.parent) {
			this.constructor.preview_controller.setup(this);
		}
		Canvas.updateAllBones([this]);
		return this;
	}
	select(event, isOutlinerClick) {
		var scope = this;
		if (Blockbench.hasFlag('renaming') || this.locked) return this;
		if (!event) event = true
		if (isOutlinerClick && event.pointerType == 'touch') return;
		var allSelected = Group.selected === this && selected.length && this.matchesSelection()

		//Clear Old Group
		if (Group.selected) Group.selected.unselect()
		if ((event.shiftKey || Pressing.overrides.shift) !== true && (event.ctrlOrCmd || Pressing.overrides.ctrl) !== true) {
			selected.length = 0
		}
		//Select This Group
		Group.all.forEach(function(s) {
			s.selected = false
		})
		this.selected = true
		Group.selected = this;

		//Select / Unselect Children
		if (allSelected && (event.which === 1 || event instanceof TouchEvent)) {
			//Select Only Group, unselect Children
			selected.length = 0
		} else {
			scope.children.forEach(function(s) {
				s.selectLow()
			})
		}
		if (Animator.open && Animation.selected) {
			Animation.selected.getBoneAnimator(this).select(true);
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
		if (Animator.open && Animation.selected) {
			var ba = Animation.selected.animators[this.uuid];
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
			if (!selected[i].isChildOf(scope, 128)) {
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
		let elements = [];
		if (undo) {
			this.forEachChild(function(element) {
				if (element.type !== 'group') {
					elements.push(element)
				}
			})
			Undo.initEdit({elements: elements, outliner: true, selection: true})
		}
		this.unselect()
		super.remove();
		var i = this.children.length-1
		while (i >= 0) {
			this.children[i].remove(false)
			i--;
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
		delete OutlinerNode.uuids[this.uuid];
		if (undo) {
			elements.empty();
			Undo.finishEdit('Delete group')
		}
	}
	resolve() {
		var array = this.children.slice();
		var index = this.getParentArray().indexOf(this)
		let all_elements = [];
		this.forEachChild(obj => {
			if (obj instanceof Group == false) {
				all_elements.push(obj);
			}
		})

		Undo.initEdit({outliner: true, elements: all_elements})

		array.forEach((obj, i) => {
			obj.addTo(this.parent, index)
			
			if ((obj instanceof Cube && Format.rotate_cubes) || (obj instanceof OutlinerElement && obj.rotatable) || (obj instanceof Group && Format.bone_rig)) {
				let quat = new THREE.Quaternion().copy(obj.mesh.quaternion);
				quat.premultiply(obj.mesh.parent.quaternion);
				let e = new THREE.Euler().setFromQuaternion(quat, obj.mesh.rotation.order);
				obj.extend({
					rotation: [
						Math.roundTo(Math.radToDeg(e.x), 4),
						Math.roundTo(Math.radToDeg(e.y), 4),
						Math.roundTo(Math.radToDeg(e.z), 4),
					]
				})
			}
			if (obj.mesh) {
				let pos = new THREE.Vector3().copy(obj.mesh.position);
				pos.applyQuaternion(this.mesh.quaternion).sub(obj.mesh.position);
				let diff = pos.toArray();

				if (obj.from) obj.from.V3_add(diff);
				if (obj.to) obj.to.V3_add(diff);
				if (obj.rotatable || obj instanceof Group) obj.origin.V3_add(diff);

				if (obj instanceof Group) {
					obj.forEachChild(child => {
						if (child instanceof Mesh) {
							for (let vkey in child.vertices) {
								child.vertices[vkey].V3_add(diff);
							}
						}
						if (child instanceof Cube) child.from.V3_add(diff);
						if (child.to) child.to.V3_add(diff);
						if (child.origin) child.origin.V3_add(diff);
					})
				}
			}
		})
		Canvas.updateAllPositions();
		if (Format.bone_rig) {
			Canvas.updateAllBones();
		}
		this.remove(false);
		Undo.finishEdit('Resolve group')
		return array;
	}
	showContextMenu(event) {
		Prop.active_panel = 'outliner'
		if (this.locked) return this;
		if (Group.selected != this) this.select(event);
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
		shift.applyQuaternion(q.invert())
		this.origin.V3_set(origin);

		function iterateChild(obj) {
			if (obj instanceof Group) {
				obj.origin.V3_add(shift);
				obj.children.forEach(child => iterateChild(child));

			} else {
				if (obj.movable) {
					obj.origin.V3_add(shift);
				}
				if (obj.to) {
					obj.from.V3_add(shift);
					obj.to.V3_add(shift);
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
		Undo.finishEdit('Sort group content')
		return this;
	}
	duplicate() {
		var copy = this.getChildlessCopy(false)
		delete copy.parent;
		if (Format.bone_rig) copy._original_name = this.name;
		Property.resetUniqueValues(Group, copy);
		copy.sortInBefore(this, 1).init()
		if (Format.bone_rig) {
			copy.createUniqueName()
		}
		for (var child of this.children) {
			child.duplicate().addTo(copy)
		}
		copy.isOpen = true;
		Canvas.updatePositions();
		return copy;
	}
	getSaveCopy(project) {
		var base_group = this.getChildlessCopy(true);
		for (var child of this.children) {
			base_group.children.push(child.getSaveCopy(project));
		}
		delete base_group.parent;
		return base_group;
	}
	getChildlessCopy(keep_uuid) {
		var base_group = new Group({name: this.name}, keep_uuid ? this.uuid : null);
		for (var key in Group.properties) {
			Group.properties[key].copy(this, base_group)
		}
		base_group.name = this.name;
		base_group.origin.V3_set(this.origin);
		base_group.rotation.V3_set(this.rotation);
		base_group.shade = this.shade;
		base_group.mirror_uv = this.mirror_uv;
		base_group.reset = this.reset;
		base_group.locked = this.locked;
		base_group.visibility = this.visibility;
		base_group.export = this.export;
		base_group.autouv = this.autouv;
		base_group.isOpen = this.isOpen;
		return base_group;
	}
	compile(undo) {
		var obj = {
			name: this.name
		}
		for (var key in Group.properties) {
			Group.properties[key].copy(this, obj)
		}
		if (this.shade == false) {
			obj.shade = false
		}
		if (undo) {
			obj.uuid = this.uuid;
			obj.export = this.export;
			obj.mirror_uv = this.mirror_uv;
			obj.isOpen = this.isOpen === true;
			obj.locked = this.locked;
			obj.visibility = this.visibility;
			obj.autouv = this.autouv;
		}
		
		if (this.rotation.allEqual(0)) {
			delete obj.rotation;
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
			if (!type || (type instanceof Array ? type.find(t2 => this.children[i] instanceof t2) : this.children[i] instanceof type)) {
				cb(this.children[i])
			}
			if (this.children[i].type === 'group') {
				this.children[i].forEachChild(cb, type)
			}
			i++;
		}
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
	Group.prototype.icon = 'folder';
	Group.prototype.isParent = true;
	Group.prototype.rotatable = true;
	Group.prototype.name_regex = () => Format.bone_rig ? 'a-zA-Z0-9_' : false;
	Group.prototype.buttons = [
		Outliner.buttons.autouv,
		Outliner.buttons.mirror_uv,
		Outliner.buttons.shade,
		Outliner.buttons.export,
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];
	Group.prototype.needsUniqueName = () => Format.bone_rig;
	function setGroupColor(color) {
		let elements = Outliner.selected.filter(el => el.setColor)
		Undo.initEdit({outliner: true, elements: elements, selection: true})
		Group.all.forEach(group => {
			if (group.selected) {
				group.color = color;
			}
		})
		elements.forEach(el => {
			el.setColor(color);
		})
		Undo.finishEdit('Change group marker color')
	}
	Group.prototype.menu = new Menu([
		...Outliner.control_menu_group,
		'_',
		'add_locator',
		'_',
		'rename',
		'edit_bedrock_binding',
		{name: 'menu.cube.color', icon: 'color_lens', children() {
			return markerColors.map((color, i) => {return {
				icon: 'bubble_chart',
				color: color.standard,
				name: color.name || 'cube.color.'+color.id,
				click() {
					setGroupColor(i);
				}
			}})
		}},
		{icon: 'sort_by_alpha', name: 'menu.group.sort', condition: {modes: ['edit']}, click: function(group) {group.sortContent()}},
		'resolve_group',
		'delete'
	]);
	Object.defineProperty(Group, 'all', {
		get() {
			return Project.groups || [];
		},
		set(arr) {
			Project.groups.replace(arr);
		}
	})
	Object.defineProperty(Group, 'selected', {
		get() {
			return Project.selected_group
		},
		set(group) {
			Project.selected_group = group;
		}
	})

new Property(Group, 'vector', 'origin', {default() {
	return Format.centered_grid ? [0, 0, 0] : [8, 8, 8]
}});
new Property(Group, 'vector', 'rotation');
new Property(Group, 'string', 'bedrock_binding', {condition: {formats: ['bedrock']}});
new Property(Group, 'array', 'cem_animations', {condition: {formats: ['optifine_entity']}});
new Property(Group, 'boolean', 'cem_attach', {condition: {formats: ['optifine_entity']}});
new Property(Group, 'string', 'texture', {condition: {formats: ['optifine_entity']}});
new Property(Group, 'vector2', 'texture_size', {condition: {formats: ['optifine_entity']}});
new Property(Group, 'vector', 'skin_original_origin', {condition: {formats: ['skin']}});
new Property(Group, 'number', 'color');

new NodePreviewController(Group, {
	setup(group) {
		bone = new THREE.Object3D();
		bone.name = group.uuid;
		bone.isGroup = true;
		Project.nodes_3d[group.uuid] = bone;

		this.dispatchEvent('update_transform', {group});
	},
	updateTransform(group) {
		Canvas.updateAllBones([group]);

		this.dispatchEvent('update_transform', {group});
	}
})


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
window.__defineGetter__('selected_group', () => {
	console.warn('selected_group is deprecated. Please use Group.selected instead.')
	return Group.selected
})

BARS.defineActions(function() {
	new Action('add_group', {
		icon: 'create_new_folder',
		category: 'edit',
		condition: () => Modes.edit,
		keybind: new Keybind({key: 'g', ctrl: true}),
		click: function () {
			Undo.initEdit({outliner: true});
			var add_group = Group.selected
			if (!add_group && selected.length) {
				add_group = selected.last()
			}
			var base_group = new Group({
				origin: add_group ? add_group.origin : undefined
			})
			base_group.addTo(add_group)
			base_group.isOpen = true
		
			if (Format.bone_rig) {
				base_group.createUniqueName()
			}
			if (add_group instanceof OutlinerElement && selected.length > 1) {
				selected.forEach(function(s, i) {
					s.addTo(base_group)
				})
			}
			base_group.init().select()
			Undo.finishEdit('Add group');
			Vue.nextTick(function() {
				updateSelection()
				if (settings.create_rename.value) {
					base_group.rename()
				}
				base_group.showInOutliner()
				Blockbench.dispatchEvent( 'add_group', {object: base_group} )
			})
		}
	})
	new Action('group_elements', {
		icon: 'drive_folder_upload',
		category: 'edit',
		condition: () => Modes.edit && (selected.length || Group.selected),
		keybind: new Keybind({key: 'g', ctrl: true, shift: true}),
		click: function () {
			Undo.initEdit({outliner: true});
			var add_group = Group.selected
			if (!add_group && Outliner.selected.length) {
				add_group = Outliner.selected.last()
			}
			var base_group = new Group({
				origin: add_group ? add_group.origin : undefined
			})
			base_group.sortInBefore(add_group);
			base_group.isOpen = true
			base_group.init();
		
			if (Format.bone_rig) {
				base_group.createUniqueName()
			}
			if (add_group instanceof Group) {
				add_group.addTo(base_group);
			} else if (add_group instanceof OutlinerElement) {
				Outliner.selected.forEach(function(s, i) {
					s.addTo(base_group);
					s.preview_controller.updateTransform(s);
				})
			}
			base_group.select()
			Undo.finishEdit('Add group');
			Vue.nextTick(function() {
				updateSelection()
				if (settings.create_rename.value) {
					base_group.rename()
				}
				base_group.showInOutliner()
				Blockbench.dispatchEvent( 'group_elements', {object: base_group} )
			})
		}
	})
	new Action('collapse_groups', {
		icon: 'format_indent_decrease',
		category: 'edit',
		condition: () => Group.all.length > 0,
		click: function() {
			Group.all.forEach(function(g) {
				g.isOpen = false;
			})
		}
	})
	new Action('unfold_groups', {
		icon: 'format_indent_increase',
		category: 'edit',
		condition: () => Group.all.length > 0,
		click: function() {
			Group.all.forEach(function(g) {
				g.isOpen = true;
			})
		}
	})
	new Action('edit_bedrock_binding', {
		icon: 'fa-paperclip',
		category: 'edit',
		condition: () => Format.bone_binding_expression && Group.selected,
		click: function() {

			let dialog = new Dialog({
				id: 'edit_bedrock_binding',
				title: 'action.edit_bedrock_binding',
				component: {
					components: {VuePrismEditor},
					data: {
						binding: Group.selected.bedrock_binding,
					},
					methods: {
						showPresetMenu(event) {
							new Menu([
								{
									name: 'Item',
									icon: 'build',
									click: () => {
										this.binding = 'q.item_slot_to_bone_name(c.item_slot)';
									}
								}
							]).show(event.target);
						}
					},
					template: 
						`<div class="dialog_bar">
							<vue-prism-editor class="molang_input dark_bordered"  v-model="binding" language="molang" :line-numbers="false" style="width: calc(100% - 36px); display: inline-block;" />
							<i class="tool material-icons" style="vertical-align: top; padding: 3px; float: none;" @click="showPresetMenu($event)">menu</i>
						</div>`
				},
				onConfirm: form_data => {
					dialog.hide().delete();
					let value = dialog.component.data.binding.replace(/\n/g, '');
					if (
						value != Group.selected.bedrock_binding
					) {
						Undo.initEdit({group: Group.selected});
						Group.selected.bedrock_binding = value;
						Undo.finishEdit('Edit group binding');
					}
				},
				onCancel() {
					dialog.hide().delete();
				}
			}).show();
		}
	})
	new Action('resolve_group', {
		icon: 'fa-leaf',
		condition: {modes: ['edit'], method: () => Group.selected},
		click() {
			Group.selected.resolve();
		}
	})
})

Interface.definePanels(function() {
	new Panel('bone', {
		icon: 'fas.fa-bone',
		condition: !Blockbench.isMobile && {modes: ['animate']},
		display_condition: () => Group.selected,
		selection_only: true,
		default_position: {
			slot: 'right_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400
		},
		component: {
			template: `
				<div>
					<p>${ tl('panel.element.origin') }</p>
					<div class="toolbar_wrapper bone_origin"></div>
				</div>
			`
		}
	})
})
