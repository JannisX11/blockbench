import { THREE } from "../../lib/libs";

export class Armature extends OutlinerElement {
	constructor(data, uuid) {
		super(data, uuid);

		for (let key in Armature.properties) {
			Armature.properties[key].reset(this);
		}

		this.name = 'armature'
		this.children = []
		this.selected = false;
		this.locked = false;
		this.export = true;
		this.parent = 'root';
		this.isOpen = false;
		this.visibility = true;
		this.origin = [0, 0, 0];
		this.rotation = [0, 0, 0];

		if (typeof data === 'object') {
			this.extend(data)
		} else if (typeof data === 'string') {
			this.name = data
		}
	}
	extend(object) {
		for (let key in Armature.properties) {
			Armature.properties[key].merge(this, object)
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
		if (!this.mesh || !this.mesh.parent) {
			this.constructor.preview_controller.setup(this);
		}
		return this;
	}
	markAsSelected(descendants) {
		Outliner.selected.safePush(this);
		this.selected = true;
		if (descendants) {
			this.children.forEach(child => child.markAsSelected(true));
		}
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
		let i = this.children.length-1
		while (i >= 0) {
			this.children[i].remove(false)
			i--;
		}
		TickUpdates.selection = true;
		Project.elements.remove(this);
		delete OutlinerNode.uuids[this.uuid];
		if (undo) {
			elements.empty();
			Undo.finishEdit('Delete armature')
		}
	}
	showContextMenu(event) {
		if (this.locked) return this;
		if (Armature.selected != this) this.select(event);
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
			if (obj instanceof Armature) {
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
		let pos = new THREE.Vector3();
		this.mesh.localToWorld(pos);
		return pos;
	}
	duplicate() {
		let copy = this.getChildlessCopy(false)
		delete copy.parent;
		if (Format.bone_rig) copy._original_name = this.name;
		Property.resetUniqueValues(Armature, copy);
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
		for (let key in Armature.properties) {
			Armature.properties[key].merge(copy, this);
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
		for (let key in Armature.properties) {
			Armature.properties[key].merge(copy, this);
		}
		return copy;
	}
	getChildlessCopy(keep_uuid) {
		let base_armature = new Armature({name: this.name}, keep_uuid ? this.uuid : null);
		for (let key in Armature.properties) {
			Armature.properties[key].copy(this, base_armature)
		}
		base_armature.name = this.name;
		base_armature.locked = this.locked;
		base_armature.visibility = this.visibility;
		base_armature.export = this.export;
		base_armature.isOpen = this.isOpen;
		return base_armature;
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
	getAllBones() {
		let bones = [];
		function addBones(array) {
			for (let item of array) {
				if (item instanceof ArmatureBone == false) continue;
				bones.push(item);
				addBones(item.children);
			}
		}
		addBones(this.children);
		return bones;
	}
	static behavior = {
		parent: true,
		child_types: ['armature_bone'],
		hide_in_screenshot: true,
	}
}
	Armature.prototype.title = tl('data.armature');
	Armature.prototype.type = 'armature';
	Armature.prototype.icon = 'accessibility';
	Armature.prototype.name_regex = () => Format.bone_rig ? 'a-zA-Z0-9_' : false;
	Armature.prototype.buttons = [
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];
	Armature.prototype.needsUniqueName = true;
	Armature.prototype.menu = new Menu([
		'add_armature_bone',
		...Outliner.control_menu_group,
		new MenuSeparator('settings'),
		new MenuSeparator('manage'),
		'rename',
		'delete'
	]);

OutlinerElement.registerType(Armature, 'armature');

new NodePreviewController(Armature, {
	setup(element) {
		let object_3d = new THREE.Object3D();
		object_3d.rotation.order = 'ZYX';
		object_3d.uuid = element.uuid.toUpperCase();
		object_3d.name = element.name;
		object_3d.isElement = true;
		Project.nodes_3d[element.uuid] = object_3d;

		object_3d.no_export = true;

		this.updateTransform(element);

		this.dispatchEvent('setup', {element});
	},
	updateTransform(element) {
		let mesh = element.mesh;

		if (Format.bone_rig) {
			if (element.parent instanceof Group) {
				element.parent.mesh.add(mesh);
				mesh.position.x -= element.parent.origin[0]
				mesh.position.y -= element.parent.origin[1]
				mesh.position.z -= element.parent.origin[2]
			} else if (mesh.parent !== Project.model_3d) {
				Project.model_3d.add(mesh)
			}
		} else if (mesh.parent !== Project.model_3d) {
			Project.model_3d.add(mesh)
		}

		mesh.updateMatrixWorld();

		this.dispatchEvent('update_transform', {element});
	}
})


BARS.defineActions(function() {
	new Action('add_armature', {
		icon: 'accessibility',
		category: 'edit',
		condition: () => Modes.edit,
		click: function () {
			Undo.initEdit({outliner: true, elements: []});
			let add_to_node = Outliner.selected[0] || Group.first_selected;
			if (!add_to_node && selected.length) {
				add_to_node = selected.last();
			}
			let armature = new Armature();
			armature.addTo(add_to_node);
			armature.isOpen = true;
			armature.createUniqueName();
			armature.init().select();

			let bone = new ArmatureBone()
			bone.addTo(add_to_node)

			Undo.finishEdit('Add armature', {outliner: true, elements: [armature, bone]});
			Vue.nextTick(function() {
				updateSelection()
				if (settings.create_rename.value) {
					armature.rename()
				}
				armature.showInOutliner()
				Blockbench.dispatchEvent( 'add_armature', {object: armature} )
			})
		}
	})
})

Object.assign(window, {
	Armature
})
