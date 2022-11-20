
class NullObject extends OutlinerElement {
	constructor(data, uuid) {
		super(data, uuid);

		for (var key in NullObject.properties) {
			NullObject.properties[key].reset(this);
		}

		if (data) {
			this.extend(data);
		}
	}
	get origin() {
		return this.position;
	}
	extend(object) {
		if (object.from) this.position.V3_set(object.from);
		for (var key in NullObject.properties) {
			NullObject.properties[key].merge(this, object)
		}
		this.sanitizeName();
		//Merge.boolean(this, object, 'export');
		return this;
	}
	getUndoCopy() {
		var copy = new NullObject(this)
		copy.uuid = this.uuid
		copy.type = this.type;
		delete copy.parent;
		return copy;
	}
	getSaveCopy() {
		let save = {};
		for (var key in NullObject.properties) {
			NullObject.properties[key].copy(this, save)
		}
		//save.export = this.export ? undefined : false;
		save.uuid = this.uuid;
		save.type = 'null_object';
		return save;
	}
	init() {
		if (this.parent instanceof Group == false) {
			this.addTo(Group.selected)
		}
		super.init();
		return this;
	}
	select(event, isOutlinerClick) {
		super.select(event, isOutlinerClick);
		if (Animator.open && Animation.selected) {
			Animation.selected.getBoneAnimator(this).select(true);
		}
		return this;
	}
	unselect(...args) {
		if (Animator.open && Timeline.selected_animator && Timeline.selected_animator.element == this) {
			Timeline.selected_animator.selected = false;
		}
		return super.unselect(...args);
	}
	flip(axis, center) {
		var offset = this.position[axis] - center
		this.position[axis] = center - offset;
		// Name
		if (axis == 0 && this.name.includes('right')) {
			this.name = this.name.replace(/right/g, 'left').replace(/2$/, '');
		} else if (axis == 0 && this.name.includes('left')) {
			this.name = this.name.replace(/left/g, 'right').replace(/2$/, '');
		}
		this.createUniqueName();
		return this;
	}
	getWorldCenter(with_animation) {
		var pos = Reusable.vec1.set(0, 0, 0);
		var q = Reusable.quat1.set(0, 0, 0, 1);
		if (this.parent instanceof Group) {
			THREE.fastWorldPosition(this.parent.mesh, pos);
			this.parent.mesh.getWorldQuaternion(q);
			var offset2 = Reusable.vec2.fromArray(this.parent.origin).applyQuaternion(q);
			pos.sub(offset2);
		}
		let offset;
		if (with_animation && Animation.selected) {
			offset = Reusable.vec3.copy(this.mesh.position);
			if (this.parent instanceof Group) {
				offset.x += this.parent.origin[0];
				offset.y += this.parent.origin[1];
				offset.z += this.parent.origin[2];
			}
		} else {
			offset = Reusable.vec3.fromArray(this.position);
		}
		offset.applyQuaternion(q);
		pos.add(offset);

		return pos;
	}
}
	NullObject.prototype.title = tl('data.null_object');
	NullObject.prototype.type = 'null_object';
	NullObject.prototype.icon = 'fa far fa-circle';
	//NullObject.prototype.name_regex = 'a-z0-9_'
	NullObject.prototype.movable = true;
	NullObject.prototype.visibility = true;
	NullObject.prototype.buttons = [
		//Outliner.buttons.export,
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];
	NullObject.prototype.needsUniqueName = true;
	NullObject.prototype.menu = new Menu([
			'set_ik_target',
			{
				id: 'lock_ik_target_rotation',
				name: 'menu.null_object.lock_ik_target_rotation',
				icon: null_object => null_object.lock_ik_target_rotation ? 'check_box' : 'check_box_outline_blank',
				click(clicked_null_object) {
					let value = !clicked_null_object.lock_ik_target_rotation;
					let affected = NullObject.selected.filter(null_object => null_object.lock_ik_target_rotation != value);
					Undo.initEdit({elements: affected});
					affected.forEach(null_object => {
						null_object.lock_ik_target_rotation = value;
					})
					Undo.finishEdit('Change null object lock ik target rotation option');
					if (Modes.animate) Animator.preview();
				}
			},
			'_',
			...Outliner.control_menu_group,
			'_',
			'rename',
			'delete'
		])
	
	new Property(NullObject, 'string', 'name', {default: 'null_object'})
	new Property(NullObject, 'vector', 'position')
	new Property(NullObject, 'string', 'ik_target', {condition: () => Format.animation_mode});
	new Property(NullObject, 'boolean', 'lock_ik_target_rotation')
	new Property(NullObject, 'boolean', 'visibility', {default: true});
	new Property(NullObject, 'boolean', 'locked');
	
	OutlinerElement.registerType(NullObject, 'null_object');

(function() {

	const map = new THREE.TextureLoader().load( 'assets/null_object.png' );
	map.magFilter = map.minFilter = THREE.NearestFilter;
	
	new NodePreviewController(NullObject, {
		setup(element) {
			let material = new THREE.SpriteMaterial({
				map,
				alphaTest: 0.1,
				sizeAttenuation: false
			});
			var mesh = new THREE.Sprite(material);
			Project.nodes_3d[element.uuid] = mesh;
			mesh.name = element.uuid;
			mesh.type = element.type;
			mesh.isElement = true;
			mesh.visible = element.visibility;
			mesh.rotation.order = 'ZYX';
			element.mesh.fix_position = new THREE.Vector3();
			this.updateTransform(element);
	
			this.dispatchEvent('setup', {element});
			this.dispatchEvent('update_selection', {element});
		},
		updateTransform(element) {
			NodePreviewController.prototype.updateTransform(element);

			element.mesh.fix_position.copy(element.mesh.position);

			this.updateWindowSize(element);

			this.dispatchEvent('update_transform', {element});
		},
		updateSelection(element) {
			let {mesh} = element;
	
			mesh.material.color.set(element.selected ? gizmo_colors.outline : CustomTheme.data.colors.text);
			mesh.material.depthTest = !element.selected;
			mesh.renderOrder = element.selected ? 100 : 0;
	
			this.dispatchEvent('update_selection', {element});
		},
		updateWindowSize(element) {
			let size = 17 / Preview.selected.height;
			element.mesh.scale.set(size, size, size);
		}
	})
	
})()

BARS.defineActions(function() {
	new Action('add_null_object', {
		icon: 'far.fa-circle',
		category: 'edit',
		condition: () => Format.animation_mode && Modes.edit,
		click: function () {
			var objs = []
			Undo.initEdit({elements: objs, outliner: true});
			var null_object = new NullObject().addTo(Group.selected||selected[0]).init();
			null_object.select().createUniqueName();
			objs.push(null_object);
			Undo.finishEdit('Add null object');
			Vue.nextTick(function() {
				if (settings.create_rename.value) {
					null_object.rename();
				}
			})
		}
	})
	
	new Action('set_ik_target', {
		icon: 'fa-paperclip',
		category: 'edit',
		condition() {
			let action = BarItems.set_ik_target;
			return NullObject.selected.length && action.children(action).length
		},
		searchable: true,
		children() {
			let nodes = [];
			iterate(NullObject.selected[0].getParentArray(), 0);

			function iterate(arr, level) {
				arr.forEach(node => {
					if (node instanceof Group) {
						if (level) nodes.push(node);
						iterate(node.children, level+1);
					}
					if (node instanceof Locator) {
						if (level) nodes.push(node);
					}
				})
			}
			return nodes.map(node => {
				return {
					name: node.name + (node.uuid == NullObject.selected[0].ik_target ? ' (✔)' : ''),
					icon: node instanceof Locator ? 'fa-anchor' : 'folder',
					color: markerColors[node.color % markerColors.length] && markerColors[node.color % markerColors.length].standard,
					click() {
						Undo.initEdit({elements: NullObject.selected});
						NullObject.selected.forEach(null_object => {
							null_object.ik_target = node.uuid;
						})
						Undo.finishEdit('Set IK target');
					}
				}
			})
		},
		click(event) {
			new Menu('set_ik_target', this.children(this), {searchable: true}).show(event.target, this);
		}
	})
})
