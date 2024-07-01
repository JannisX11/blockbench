
class ArmatureBone extends OutlinerElement {
	constructor(data, uuid) {
		super(uuid)

		for (let key in ArmatureBone.properties) {
			ArmatureBone.properties[key].reset(this);
		}

		this.name = 'bone'
		this.children = []
		this.selected = false;
		this.locked = false;
		this.export = true;
		this.parent = 'root';
		this.isOpen = false;

		if (typeof data === 'object') {
			this.extend(data)
		} else if (typeof data === 'string') {
			this.name = data
		}
	}
	extend(object) {
		for (let key in ArmatureBone.properties) {
			ArmatureBone.properties[key].merge(this, object)
		}
		Merge.string(this, object, 'name')
		this.sanitizeName();
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
		Project.elements.push(this);
		if (!this.mesh || !this.mesh.parent) {
			this.constructor.preview_controller.setup(this);
		}
		Canvas.updateAllBones([this]);
		return this;
	}
	select(event, isOutlinerClick) {
		super.select(event, isOutlinerClick);
		if (Animator.open && Animation.selected) {
			Animation.selected.getBoneAnimator(this).select(true);
		}
		return this;
	}
	selectChildren(event) {
		let scope = this;
		if (Blockbench.hasFlag('renaming')) return;
		if (!event) event = {shiftKey: false}
		let firstChildSelected = false

		//Select This ArmatureBone
		Project.groups.forEach(function(s) {
			s.selected = false
		})
		this.selected = true
		Outliner.selected.push(this);

		scope.children.forEach(function(s) {
			s.selectLow();
		})
		updateSelection()
		return this;
	}
	selectLow(highlight) {
		Outliner.selected.push(this);
		if (highlight !== false) {
			this.selected = true
		}
		this.children.forEach(function(s) {
			s.selectLow(highlight)
		})
		TickUpdates.selection = true;
		return this;
	}
	matchesSelection() {
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
		let scope = this;
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
		let i = this.children.length-1
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
	resolve() {
		let array = this.children.slice();
		let index = this.getParentArray().indexOf(this)
		let all_elements = [];
		this.forEachChild(obj => {
			if (obj instanceof ArmatureBone == false) {
				all_elements.push(obj);
			}
		})

		Undo.initEdit({outliner: true, elements: all_elements})

		array.forEach((obj, i) => {
			obj.addTo(this.parent, index)
			
			if ((obj instanceof Cube && Format.rotate_cubes) || (obj instanceof OutlinerElement && obj.rotatable) || (obj instanceof ArmatureBone && Format.bone_rig)) {
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
				if (obj.rotatable || obj instanceof ArmatureBone) obj.origin.V3_add(diff);

				if (obj instanceof ArmatureBone) {
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
		if (this.locked) return this;
		if (ArmatureBone.selected != this) this.select(event);
		this.menu.open(event, this)
		return this;
	}
	transferOrigin(origin) {
		if (!this.mesh) return;
		let q = new THREE.Quaternion().copy(this.mesh.quaternion)
		let shift = new THREE.Vector3(
			this.origin[0] - origin[0],
			this.origin[1] - origin[1],
			this.origin[2] - origin[2],
		)
		let dq = new THREE.Vector3().copy(shift)
		dq.applyQuaternion(q)
		shift.sub(dq)
		shift.applyQuaternion(q.invert())
		this.origin.V3_set(origin);

		function iterateChild(obj) {
			if (obj instanceof ArmatureBone) {
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
		let copy = this.getChildlessCopy(false)
		delete copy.parent;
		if (Format.bone_rig) copy._original_name = this.name;
		Property.resetUniqueValues(ArmatureBone, copy);
		copy.sortInBefore(this, 1).init()
		if (Format.bone_rig) {
			copy.createUniqueName()
		}
		for (let child of this.children) {
			child.duplicate().addTo(copy)
		}
		copy.isOpen = true;
		Canvas.updatePositions();
		return copy;
	}
	getSaveCopy(project) {
		let base_group = this.getChildlessCopy(true);
		for (let child of this.children) {
			base_group.children.push(child.getSaveCopy(project));
		}
		delete base_group.parent;
		return base_group;
	}
	getChildlessCopy(keep_uuid) {
		let base_group = new ArmatureBone({name: this.name}, keep_uuid ? this.uuid : null);
		for (let key in ArmatureBone.properties) {
			ArmatureBone.properties[key].copy(this, base_group)
		}
		base_group.name = this.name;
		base_group.origin.V3_set(this.origin);
		base_group.rotation.V3_set(this.rotation);
		base_group.locked = this.locked;
		base_group.visibility = this.visibility;
		base_group.export = this.export;
		base_group.isOpen = this.isOpen;
		return base_group;
	}
	compile(undo) {
		let obj = {
			name: this.name
		}
		for (let key in ArmatureBone.properties) {
			ArmatureBone.properties[key].copy(this, obj)
		}
		if (this.shade == false) {
			obj.shade = false
		}
		if (undo) {
			obj.uuid = this.uuid;
			obj.export = this.export;
			obj.isOpen = this.isOpen === true;
			obj.locked = this.locked;
			obj.visibility = this.visibility;
		}
		
		if (this.rotation.allEqual(0)) {
			delete obj.rotation;
		}
		obj.children = []
		return obj;
	}
	forEachChild(cb, type, forSelf) {
		let i = 0
		if (forSelf) {
			cb(this)
		}
		while (i < this.children.length) {
			if (!type || (type instanceof Array ? type.find(t2 => this.children[i] instanceof t2) : this.children[i] instanceof type)) {
				cb(this.children[i])
			}
			if (this.children[i].type === 'armature_bone') {
				this.children[i].forEachChild(cb, type)
			}
			i++;
		}
	}
}
	ArmatureBone.prototype.title = tl('data.group');
	ArmatureBone.prototype.type = 'armature_bone';
	ArmatureBone.prototype.icon = 'humerus';
	ArmatureBone.prototype.isParent = true;
	ArmatureBone.prototype.rotatable = true;
	ArmatureBone.prototype.name_regex = () => Format.bone_rig ? 'a-zA-Z0-9_' : false;
	ArmatureBone.prototype.buttons = [
		Outliner.buttons.autouv,
		Outliner.buttons.shade,
		Outliner.buttons.export,
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];
	ArmatureBone.prototype.needsUniqueName = () => Format.bone_rig;
	ArmatureBone.prototype.menu = new Menu([
		...Outliner.control_menu_group,
		new MenuSeparator('settings'),
		'apply_animation_preset',
		new MenuSeparator('manage'),
		'resolve_group',
		'rename',
		'delete'
	]);

OutlinerElement.registerType(ArmatureBone, 'armature_bone');

new Property(ArmatureBone, 'vector', 'origin', {default() {
	return Format.centered_grid ? [0, 0, 0] : [8, 8, 8]
}});
new Property(ArmatureBone, 'vector', 'rotation');

new NodePreviewController(ArmatureBone, {
	setup(group) {
		let bone = new THREE.Object3D();
		bone.name = group.uuid;
		bone.isArmatureBone = true;
		Project.nodes_3d[group.uuid] = bone;

		this.dispatchEvent('update_transform', {group});
	},
	updateTransform(group) {
		Canvas.updateAllBones([group]);

		this.dispatchEvent('update_transform', {group});
	}
})


function getCurrentArmatureBone() {
	if (ArmatureBone.selected) {
		return ArmatureBone.selected
	} else if (selected.length) {
		let g1 = selected[0].parent;
		if (g1 instanceof ArmatureBone) {
			for (let obj of selected) {
				if (obj.parent !== g1) {
					return;
				}
			}
			return g1;
		}
	}
}
function getAllArmatureBones() {
	let ta = []
	function iterate(array) {
		for (let obj of array) {
			if (obj instanceof ArmatureBone) {
				ta.push(obj)
				iterate(obj.children)
			}
		}
	}
	iterate(Outliner.root)
	return ta;
}

BARS.defineActions(function() {
	new Action('add_armature_bone', {
		icon: 'humerus',
		category: 'edit',
		condition: () => Modes.edit,
		click: function () {
			Undo.initEdit({outliner: true});
			let add_to_node = ArmatureBone.selected[0] || Group.selected;
			if (!add_to_node && selected.length) {
				add_to_node = selected.last();
			}
			let new_instance = new ArmatureBone({
				origin: add_to_node ? add_to_node.origin : undefined
			})
			new_instance.addTo(add_to_node)
			new_instance.isOpen = true
		
			if (Format.bone_rig) {
				new_instance.createUniqueName()
			}
			if (add_to_node instanceof OutlinerElement && selected.length > 1) {
				selected.forEach(function(s, i) {
					s.addTo(new_instance)
				})
			}
			new_instance.init().select()
			Undo.finishEdit('Add group');
			Vue.nextTick(function() {
				updateSelection()
				if (settings.create_rename.value) {
					new_instance.rename()
				}
				new_instance.showInOutliner()
				Blockbench.dispatchEvent( 'add_armature_bone', {object: new_instance} )
			})
		}
	})
})
