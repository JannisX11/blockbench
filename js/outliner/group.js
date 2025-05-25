
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
		if (!this.mesh || !this.mesh.parent) {
			this.constructor.preview_controller.setup(this);
		}
		Canvas.updateAllBones([this]);
		return this;
	}
	select(event, is_outliner_click) {
		if (Blockbench.hasFlag('renaming') || this.locked) return this;
		if (!event) event = true
		var allSelected = Group.multi_selected.length == 1 && Group.first_selected === this && selected.length && this.matchesSelection();
		let previous_first_selected = Project.selected_elements[0];
		let multi_select = (event.ctrlOrCmd || Pressing.overrides.ctrl) && !Modes.animate;
		let shift_select = (event.shiftKey || Pressing.overrides.shift) && !Modes.animate;

		//Unselect others
		if (!multi_select && !shift_select) {
			unselectAllElements();
			Project.groups.forEach(function(s) {
				s.selected = false;
			})
		}

		if (event && shift_select && this.getParentArray().includes(Group.multi_selected.last()) && is_outliner_click) {
			let selecting;
			let last_selected = Group.multi_selected.last();
			this.getParentArray().forEach((s, i) => {
				let select_this = false;
				if (s === last_selected || s === this) {
					selecting = !selecting;
					select_this = true;
				} else if (selecting) {
					select_this = true;
				}
				if (select_this) {
					if (s instanceof Group) {
						s.multiSelect()
					} else if (!Outliner.selected.includes(s)) {
						s.selectLow()
					}
				}
			})
		} else {
			//Select This Group
			this.selected = true;
			Group.multi_selected.safePush(this);
		}

		//Select / Unselect Children
		if (allSelected && (event.which === 1 || event instanceof TouchEvent)) {
			//Select Only Group, unselect Children
			this.forEachChild(child => {
				child.unselect();
			});
		} else {
			// Fix for #2401
			if (previous_first_selected && previous_first_selected.isChildOf(this)) {
				selected.safePush(previous_first_selected);
			}
			this.children.forEach(function(s) {
				s.selectLow()
			})
		}
		if (Animator.open && Animation.selected) {
			Animation.selected.getBoneAnimator(this).select(true);
		}
		updateSelection()
		return this;
	}
	clickSelect(event, is_outliner_click) {
		if (Blockbench.hasFlag('renaming') || this.locked) return this;
		Undo.initSelection();
		this.select(event, is_outliner_click);
		Undo.finishSelection('Select group');
	}
	multiSelect() {
		if (this.locked) return this;
		this.selected = true;
		Group.multi_selected.safePush(this);
		this.children.forEach(function(s) {
			s.selectLow()
		})
		TickUpdates.selection = true;
		return this;
	}
	selectChildren(event) {
		console.warn('Group#selectChildren is deprecated');
	}
	selectLow(highlight) {
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
		if (Animator.open && Animation.selected) {
			var ba = Animation.selected.animators[this.uuid];
			if (ba) {
				ba.selected = false
			}
		}
		Group.multi_selected.remove(this);
		this.selected = false;
		TickUpdates.selection = true;
		return this;
	}
	matchesSelection() {
		if (Group.multi_selected.length != 1 || this != Group.first_selected) return false;
		let scope = this;
		let match = true;
		for (let i = 0; i < selected.length; i++) {
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
			let animations = [];
			Animator.animations.forEach(animation => {
				if (animation.animators && animation.animators[scope.uuid]) {
					animations.push(animation);
				}
			})
			Undo.initEdit({elements: elements, outliner: true, selection: true, animations})
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
				animation.removeAnimator(scope.uuid);
			}
			if (animation.selected && Animator.open) {
				updateKeyframeSelection();
			}
		})
		TickUpdates.selection = true;
		Project.groups.remove(this);
		delete OutlinerNode.uuids[this.uuid];
		if (undo) {
			elements.empty();
			Undo.finishEdit('Delete group')
		}
	}
	resolve(undo = true) {
		var array = this.children.slice();
		var index = this.getParentArray().indexOf(this)
		let all_elements = [];
		this.forEachChild(obj => {
			if (obj instanceof Group == false) {
				all_elements.push(obj);
			}
		})

		if (undo) Undo.initEdit({outliner: true, elements: all_elements})

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
		if (undo) Undo.finishEdit('Resolve group')
		return array;
	}
	showContextMenu(event) {
		if (this.locked) return this;
		if (!Group.multi_selected.includes(this)) this.select(event);
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
			obj.selected = Group.multi_selected.includes(this);
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
	Group.prototype.name_regex = () => Format.bone_rig ? (Format.node_name_regex ?? 'a-zA-Z0-9_') : false;
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
		new MenuSeparator('settings'),
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
		"randomize_marker_colors",
		{name: 'menu.cube.texture', icon: 'collections', condition: () => Format.per_group_texture, children(context) {
			function applyTexture(texture_value, undo_message) {
				let affected_groups = Group.all.filter(g => g.selected);
				Undo.initEdit({outliner: true});
				for (let group of affected_groups) {
					group.texture = texture_value;
				}
				Undo.finishEdit(undo_message);
				Canvas.updateAllFaces();
			}
			let arr = [
				{icon: 'crop_square', name: Format.single_texture_default ? 'menu.cube.texture.default' : 'menu.cube.texture.blank', click(group) {
					applyTexture('', 'Unassign texture from group');
				}}
			]
			Texture.all.forEach(t => {
				arr.push({
					name: t.name,
					icon: (t.mode === 'link' ? t.img : t.source),
					marked: t.uuid == context.texture,
					click(group) {
						applyTexture(t.uuid, 'Apply texture to group');
					}
				})
			})
			return arr;
		}},
		{icon: 'sort_by_alpha', name: 'menu.group.sort', condition: {modes: ['edit']}, click: function(group) {group.sortContent()}},
		'apply_animation_preset',
		'add_locator',
		new MenuSeparator('manage'),
		'resolve_group',
		'rename',
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
	Object.defineProperty(Group, 'multi_selected', {
		get() {
			return Project.selected_groups || []
		},
		set(arr) {
			if (arr instanceof Array == false) {
				console.warn('Not an array!')
			}
			Project.selected_groups.replace(arr)
		}
	})
	Object.defineProperty(Group, 'selected', {
		get() {
			console.warn('"Group.selected" will be an array in the future!');
			return Project.selected_groups?.[0]
		},
		set(group) {
			console.warn('"Group.selected" will be an array in the future!');
			if (group instanceof Group) {
				Project.selected_groups.replace([group]);
			} else {
				Project.selected_groups.empty();
			}
		}
	})
	Object.defineProperty(Group, 'first_selected', {
		get() {
			return Project.selected_groups?.[0]
		},
		set(group) {
			Project.selected_groups.replace([groups]);
		}
	})

new Property(Group, 'vector', 'origin', {default() {
	return Format.centered_grid ? [0, 0, 0] : [8, 8, 8]
}});
new Property(Group, 'vector', 'rotation');
new Property(Group, 'string', 'bedrock_binding', {condition: {formats: ['bedrock']}});
new Property(Group, 'array', 'cem_animations', {condition: {formats: ['optifine_entity']}});
new Property(Group, 'boolean', 'cem_attach', {condition: {formats: ['optifine_entity']}});
new Property(Group, 'number', 'cem_scale', {condition: {formats: ['optifine_entity']}});
new Property(Group, 'string', 'texture', {condition: {features: ['per_group_texture']}});
//new Property(Group, 'vector2', 'texture_size', {condition: {formats: ['optifine_entity']}});
new Property(Group, 'vector', 'skin_original_origin', {condition: {formats: ['skin']}});
new Property(Group, 'number', 'color');

new NodePreviewController(Group, {
	setup(group) {
		let bone = new THREE.Object3D();
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
	if (Group.first_selected) {
		return Group.first_selected
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
	console.warn('selected_group is deprecated. Please use Group.first_selected instead.')
	return Group.first_selected
})

BARS.defineActions(function() {
	new Action('add_group', {
		icon: 'create_new_folder',
		category: 'edit',
		condition: () => Modes.edit,
		keybind: new Keybind({key: 'g', ctrl: true}),
		click: function () {
			Undo.initEdit({outliner: true});
			var add_group = Group.first_selected
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
		condition: () => Modes.edit && (selected.length || Group.first_selected),
		keybind: new Keybind({key: 'g', ctrl: true, shift: true}),
		click: function () {
			Undo.initEdit({outliner: true});
			let add_group = Group.first_selected
			if (!add_group && Outliner.selected.length) {
				add_group = Outliner.selected.last()
			}
			let new_name = add_group?.name;
			let base_group = new Group({
				origin: add_group ? add_group.origin : undefined,
				name: ['cube', 'mesh'].includes(new_name) ? undefined : new_name
			})
			base_group.sortInBefore(add_group);
			base_group.isOpen = true
			base_group.init();
		
			if (Format.bone_rig) {
				base_group.createUniqueName()
			}
			if (add_group instanceof Group) {
				for (let group of Group.multi_selected) {
					group.addTo(base_group);
				}
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
		condition: () => Format.bone_binding_expression && Group.first_selected,
		click: function() {

			let dialog = new Dialog({
				id: 'edit_bedrock_binding',
				title: 'action.edit_bedrock_binding',
				component: {
					components: {VuePrismEditor},
					data: {
						binding: Group.first_selected.bedrock_binding,
					},
					methods: {
						showPresetMenu(event) {
							new Menu([
								{
									name: 'Item Slot',
									icon: 'build',
									click: () => {
										this.binding = 'q.item_slot_to_bone_name(c.item_slot)';
									}
								},
								{
									name: 'Right Hand',
									icon: 'build',
									click: () => {
										this.binding = '\'rightitem\'';
									}
								},
								{
									name: 'Left Hand',
									icon: 'build',
									click: () => {
										this.binding = '\'leftitem\'';
									}
								},
								{
									name: 'Body',
									icon: 'build',
									click: () => {
										this.binding = '\'body\'';
									}
								},
								{
									name: 'Head',
									icon: 'build',
									click: () => {
										this.binding = '\'head\'';
									}
								}
							]).show(event.target);
						},
						autocomplete(text, position) {
							let test = MolangAutocomplete.BedrockBindingContext.autocomplete(text, position);
							return test;
						}
					},
					template: 
						`<div class="dialog_bar">
							<vue-prism-editor class="molang_input" v-model="binding" language="molang" :autocomplete="autocomplete" :line-numbers="false" style="width: calc(100% - 36px); display: inline-block;" />
							<i class="tool material-icons" style="vertical-align: top; padding: 3px; float: none;" @click="showPresetMenu($event)">menu</i>
						</div>`
				},
				onConfirm: form_data => {
					dialog.hide().delete();
					let value = dialog.component.data.binding.replace(/\n/g, '');
					if (
						value != Group.first_selected.bedrock_binding
					) {
						Undo.initEdit({groups: Group.multi_selected});
						for (let group of Group.multi_selected) {
							group.bedrock_binding = value;
						}
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
		condition: {modes: ['edit'], method: () => Group.first_selected},
		click() {
			let all_elements = [];
			for (let group of Group.multi_selected) {
				group.forEachChild(obj => {
					if (obj instanceof Group == false) {
						all_elements.safePush(obj);
					}
				})
			}
			Undo.initEdit({outliner: true, elements: all_elements})
			for (let group of Group.multi_selected) {
				group.resolve(false);
			}
			Undo.finishEdit('Resolve group');
		}
	})
})

Interface.definePanels(function() {
	new Panel('bone', {
		icon: 'fas.fa-bone',
		condition: !Blockbench.isMobile && {modes: ['animate'], method: () => !AnimationController.selected},
		display_condition: () => Group.first_selected,
		default_position: {
			slot: 'right_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400
		},
		component: {
			template: `
				<div>
					<p class="panel_toolbar_label">${ tl('panel.element.origin') }</p>
					<div class="toolbar_wrapper bone_origin"></div>
				</div>
			`
		}
	})
})
