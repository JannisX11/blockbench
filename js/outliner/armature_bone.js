import { THREE } from "../../lib/libs";

export class ArmatureBone extends OutlinerElement {
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
		this.visibility = true;

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
	selectLow(highlight) {
		Outliner.selected.safePush(this);
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
		Project.elements.remove(this);
		delete OutlinerNode.uuids[this.uuid];
		if (undo) {
			elements.empty();
			Undo.finishEdit('Delete armature bone')
		}
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
	getWorldCenter(with_animation) {
		var pos = new THREE.Vector3();
		var q = Reusable.quat1.set(0, 0, 0, 1);
		if (this.parent instanceof OutlinerNode) {
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
		let copy = {
			isOpen: this.isOpen,
			uuid: this.uuid,
			type: this.type,
			name: this.name,
			children: this.children.map(c => c.uuid),
		};
		for (let key in ArmatureBone.properties) {
			ArmatureBone.properties[key].merge(copy, this);
		}
		return copy;
	}
	getUndoCopy() {
		let copy = {
			isOpen: this.isOpen,
			uuid: this.uuid,
			type: this.type,
			name: this.name,
			children: this.children.map(c => c.uuid),
		};
		for (let key in ArmatureBone.properties) {
			ArmatureBone.properties[key].merge(copy, this);
		}
		return copy;
	}
	getChildlessCopy(keep_uuid) {
		let base_bone = new ArmatureBone({name: this.name}, keep_uuid ? this.uuid : null);
		for (let key in ArmatureBone.properties) {
			ArmatureBone.properties[key].copy(this, base_bone)
		}
		base_bone.name = this.name;
		base_bone.origin.V3_set(this.origin);
		base_bone.rotation.V3_set(this.rotation);
		base_bone.locked = this.locked;
		base_bone.visibility = this.visibility;
		base_bone.export = this.export;
		base_bone.isOpen = this.isOpen;
		return base_bone;
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
	ArmatureBone.prototype.title = tl('data.armature_bone');
	ArmatureBone.prototype.type = 'armature_bone';
	ArmatureBone.prototype.icon = 'humerus';
	ArmatureBone.prototype.isParent = true;
	ArmatureBone.prototype.rotatable = true;
	ArmatureBone.prototype.name_regex = () => Format.bone_rig ? 'a-zA-Z0-9_' : false;
	ArmatureBone.prototype.buttons = [
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];
	ArmatureBone.prototype.needsUniqueName = () => Format.bone_rig;
	ArmatureBone.prototype.menu = new Menu([
		'add_armature_bone',
		...Outliner.control_menu_group,
		new MenuSeparator('settings'),
		'apply_animation_preset',
		new MenuSeparator('manage'),
		'rename',
		'delete'
	]);

OutlinerElement.registerType(ArmatureBone, 'armature_bone');

new Property(ArmatureBone, 'vector', 'origin', {default: [0, 0, 0]});
new Property(ArmatureBone, 'vector', 'rotation');

new NodePreviewController(ArmatureBone, {
	setup(element) {
		let object_3d = new THREE.Object3D();
		object_3d.rotation.order = 'ZYX';
		object_3d.uuid = element.uuid.toUpperCase();
		object_3d.name = element.name;
		object_3d.isArmatureBone = true;
		Project.nodes_3d[element.uuid] = object_3d;


		let length = 5;
		let mesh = new THREE.Mesh(
			new THREE.CapsuleGeometry(2, length, 1, 6),
			Canvas.solidMaterial
		);
		mesh.visible = element.visibility;
		mesh.no_export = true;
		object_3d.no_export = true;
		object_3d.add(mesh);

		object_3d.fix_position = new THREE.Vector3();
		object_3d.fix_rotation = new THREE.Euler();

		this.updateTransform(element);

		this.dispatchEvent('setup', {element});
	},
	updateTransform(element) {
		let bone = element.mesh;

		bone.rotation.order = 'ZYX';
		bone.rotation.setFromDegreeArray(element.rotation);
		bone.position.fromArray(element.origin);
		bone.scale.x = bone.scale.y = bone.scale.z = 1;

		if (element.parent instanceof OutlinerNode) {
			//bone.position.x -=  element.parent.origin[0];
			//bone.position.y -=  element.parent.origin[1];
			//bone.position.z -=  element.parent.origin[2];
			var parent_bone = element.parent.mesh;
			parent_bone.add(bone);
		} else {
			Project.model_3d.add(bone);
		}

		bone.fix_position = bone.position.clone();
		bone.fix_rotation = bone.rotation.clone();

		bone.updateMatrixWorld();

		this.dispatchEvent('update_transform', {element});
	}
})


export function getAllArmatureBones() {
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
			Undo.initEdit({outliner: true, elements: []});
			let add_to_node = Outliner.selected[0] || Group.first_selected;
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
			new_instance.init().select()
			Undo.finishEdit('Add armature bone', {outliner: true, elements: [new_instance]});
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

Object.assign(window, {
	ArmatureBone,
	getAllArmatureBones
})
