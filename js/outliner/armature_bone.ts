import { Animation } from "../animations/animation";
import { Blockbench } from "../api";
import { THREE } from "../lib/libs";
import { flipNameOnAxis } from "../modeling/transform";
import { Armature } from "./armature";
import { Vue } from '../lib/libs'

interface ArmatureBoneOptions {
	name?: string
	export?: boolean
	locked?: boolean
	visibility?: boolean
	origin?: ArrayVector3
	rotation?: ArrayVector3
	vertex_weights?: Record<string, number>
	length?: number
	width?: number
	connected?: boolean
	color?: number
}


export class ArmatureBone extends OutlinerElement {
	children: ArmatureBone[]
	isOpen: boolean
	visibility: boolean
	origin: ArrayVector3
	rotation: ArrayVector3
	vertex_weights: Record<string, number>
	length: number
	width: number
	connected: boolean
	color: number
	old_size?: number
	

	static preview_controller: NodePreviewController

	constructor(data?: ArmatureBoneOptions, uuid?: UUID) {
		super(data, uuid);

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
		this.vertex_weights = {};
		this.color = Math.floor(Math.random()*markerColors.length);

		if (typeof data === 'object') {
			this.extend(data)
		} else if (typeof data === 'string') {
			this.name = data
		}
	}
	get position() {
		return this.origin;
	}
	extend(object: ArmatureBoneOptions) {
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
	getArmature(): Armature {
		let parent = this.parent;
		while (parent instanceof Armature == false && parent instanceof OutlinerNode) {
			parent = parent.parent;
		}
		return parent as Armature;
	}
	init(): this {
		super.init();
		if (!this.mesh || !this.mesh.parent) {
			this.preview_controller.setup(this);
		}
		Canvas.updateAllBones([this]);
		return this;
	}
	select(event?: Event, isOutlinerClick?: boolean): this {
		super.select(event, isOutlinerClick);
		if (Animator.open && Animation.selected) {
			Animation.selected.getBoneAnimator(this).select(true);
		}
		return this;
	}
	markAsSelected(descendants: boolean): this {
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
		this.isOpen = true;
		this.updateElement();
		if (this.parent && this.parent !== 'root') {
			this.parent.openUp();
		}
		return this;
	}
	transferOrigin(origin: ArrayVector3) {
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

		function iterateChild(obj: ArmatureBone) {
			if (obj instanceof ArmatureBone) {
				obj.origin.V3_add(shift);
				obj.children.forEach(child => iterateChild(child));
			}
		}
		this.children.forEach(child => iterateChild(child));

		Canvas.updatePositions()
		return this;
	}
	getWorldCenter(): THREE.Vector3 {
		let pos = new THREE.Vector3();
		this.mesh.localToWorld(pos);
		return pos;
	}
	flip(axis: number, center: number): this {
		var offset = this.position[axis] - center
		this.position[axis] = center - offset;
		this.rotation.forEach((n, i) => {
			if (i != axis) this.rotation[i] = -n;
		})
		// Name
		flipNameOnAxis(this, axis);

		this.createUniqueName();
		this.preview_controller.updateTransform(this);
		return this;
	}
	size(): ArrayVector3
	size(axis: axisLetter): number
	size(axis?: axisLetter): number | ArrayVector3 {
		if (typeof axis == 'number') {
			return axis == 1 ? this.length : this.width;
		}
		return [this.width, this.length, this.width];
	}
	getSize(axis) {
		return this.size(axis);
	}
	resize(move_value: number | ((input: number) => number), axis_number?: axisNumber, invert?: boolean) {
		if (axis_number == 1) {
			let previous_length = this.old_size ?? this.length;
			if (typeof move_value == 'function') {
				this.length = move_value(previous_length);
			} else {
				this.length = previous_length + move_value * (invert ? -1 : 1);
			}
		} else {
			let previous_width = this.old_size ?? this.width;
			if (typeof move_value == 'function') {
				this.width = move_value(previous_width);
			} else {
				this.width = previous_width + move_value * (invert ? -1 : 1);
			}
		}
		this.preview_controller.updateTransform(this);
	}
	setColor(index) {
		this.color = index;
		this.preview_controller.updateFaces(this);
		let armature = this.getArmature();
		// Update vertex colors
		Canvas.updateView({
			elements: Mesh.all.filter(mesh => armature && mesh.getArmature() == armature),
			element_aspects: {geometry: true}
		});
		return this;
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
	getChildlessCopy(keep_uuid: boolean = false) {
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
	forEachChild(cb: ((element: ArmatureBone) => void), type?: any, forSelf?: boolean) {
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
	static behavior = {
		unique_name: false,
		parent: true,
		movable: true,
		rotatable: true,
		resizable: true,
		child_types: ['armature_bone'],
		parent_types: ['armature_bone', 'armature'],
		select_children: 'self_first',
		hide_in_screenshot: true,
		marker_color: true,
	}
	static all: ArmatureBone[]
	static selected: ArmatureBone[]
	
	public title = tl('data.armature_bone');
	public type = 'armature_bone';
	public icon = 'humerus';
	public name_regex = () => Format.bone_rig ? 'a-zA-Z0-9_' : false;
	public buttons = [
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];
	public menu = new Menu([
		'add_armature_bone',
		...Outliner.control_menu_group,
		new MenuSeparator('settings'),
		'set_element_marker_color',
		"randomize_marker_colors",
		'apply_animation_preset',
		new MenuSeparator('manage'),
		'rename',
		'delete'
	]);
}
ArmatureBone.addBehaviorOverride({
	condition: {features: ['bone_rig']},
	behavior: {
		unique_name: true
	}
})

OutlinerElement.registerType(ArmatureBone, 'armature_bone');

new Property(ArmatureBone, 'vector', 'origin', {default: [0, 0, 0]});
new Property(ArmatureBone, 'vector', 'rotation');
new Property(ArmatureBone, 'number', 'length', {default: 8});
new Property(ArmatureBone, 'number', 'width', {default: 2});
new Property(ArmatureBone, 'boolean', 'connected', {
	default: true,
	inputs: {
		element_panel: {
			input: {label: 'armature_bone.connected', type: 'checkbox'},
			onChange() {
				let parents = [];
				ArmatureBone.selected.forEach(b => {
					if (b.parent instanceof ArmatureBone) parents.safePush(b.parent)
				});
				console.log(parents)
				Canvas.updateView({elements: parents, element_aspects: {transform: true}});
			}
		}
	}
});
new Property(ArmatureBone, 'number', 'color');
new Property(ArmatureBone, 'object', 'vertex_weights');

type FakeObjectType = {isElement: boolean, no_export: boolean, fix_position: THREE.Vector3, fix_rotation: THREE.Euler, inverse_bind_matrix: THREE.Matrix4};
type PreviewControllerType = (NodePreviewController & {material: THREE.MeshLambertMaterial, material_selected: THREE.MeshLambertMaterial});
new NodePreviewController(ArmatureBone, {
	material: new THREE.MeshLambertMaterial({
		color: 0xc8c9cb,
		depthTest: false,
		depthWrite: false,
		transparent: true,
		vertexColors: true,
	}),
	material_selected: new THREE.MeshLambertMaterial({
		color: 0xffffff,
		depthTest: false,
		depthWrite: false,
		transparent: true,
		vertexColors: true,
	}),
	setup(element: ArmatureBone) {
		let object_3d = new THREE.Bone() as FakeObjectType & THREE.Bone;
		object_3d.rotation.order = 'ZYX';
		object_3d.uuid = element.uuid.toUpperCase();
		object_3d.name = element.name;
		//object_3d.isElement = true;
		Project.nodes_3d[element.uuid] = object_3d;

		let geometry = new THREE.BufferGeometry();
		let r = 1, m = 0.2;
		let vertices = [
			0,0,0,r,m,r,-r,m,r,
			r,m,-r,  0,0,0, -r,m,-r,
			r,m,r,  0,0,0, r,m,-r,
			0,0,0,-r,m,r,-r,m,-r,
			r,m,r, 0,1,0, -r,m,r,
			0,1,0, r,m,-r,  -r,m,-r,
			0,1,0, r,m,r,  r,m,-r,
			-r,m,r, 0,1,0, -r,m,-r,
		];
		let normals = [
			0.0,-0.5,0.4,
			0.0,-0.5,-0.4,
			0.4,-0.5,0.0,
			-0.4,-0.5,0.0,
			0.0,0.2,0.6,
			0.0,0.2,-0.6,
			0.6,0.2,0.0,
			-0.6,0.2,0.0,
		];
		let normals_array = [];
		for (let i = 0; i < normals.length; i += 3) {
			for (let j = 0; j < 3; j++) {
				normals_array.push(normals[i], normals[i+1], normals[i+2]);
			}
		}
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals_array, 3));
		geometry.normalizeNormals();
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();
		let material = (ArmatureBone.preview_controller as PreviewControllerType).material;
		let mesh: ({no_export?: boolean, isElement?: true, type?: string} & THREE.Mesh) = new THREE.Mesh(geometry, material);
		mesh.renderOrder = 20;
		mesh.visible = element.visibility;
		mesh.no_export = true;
		mesh.name = element.uuid;
		mesh.type = element.type;
		mesh.isElement = true;
		object_3d.add(mesh);


		object_3d.no_export = true;
		object_3d.fix_position = new THREE.Vector3();
		object_3d.fix_rotation = new THREE.Euler();
		object_3d.inverse_bind_matrix = new THREE.Matrix4();

		this.updateTransform(element);
		this.updateFaces(element);
		this.updateSelection(element);

		this.dispatchEvent('setup', {element});
	},
	updateFaces(element: ArmatureBone) {
		let color_material = Canvas.coloredSolidMaterials[element.color % markerColors.length];
		let color_value = color_material.uniforms.base.value;
		let color_array = [];
		for (let i = 0; i < 24; i++) {
			color_array.push(color_value.r, color_value.g, color_value.b);
		}
		(element.mesh.children[0] as THREE.Mesh).geometry.setAttribute('color', new THREE.Float32BufferAttribute(color_array, 3));
	},
	updateTransform(element: ArmatureBone) {
		let bone = element.scene_object as FakeObjectType & THREE.Bone;

		bone.rotation.order = 'ZYX';
		// @ts-expect-error
		bone.rotation.setFromDegreeArray(element.rotation);
		bone.position.fromArray(element.origin);
		bone.scale.x = bone.scale.y = bone.scale.z = 1;

		if (element.parent instanceof OutlinerNode) {
			let parent_bone = element.parent.scene_object;
			parent_bone.add(bone);
			if (element.parent instanceof ArmatureBone) {
				ArmatureBone.preview_controller.updateTransform(element.parent);
			}
		} else if (bone.parent) {
			bone.parent.remove(bone);
		}

		let connected_children = element.children.filter(b => b.connected);
		if (connected_children.length >= 2) {
			let box = new THREE.Box3();
			for (let bone of connected_children) {
				box.expandByPoint(Reusable.vec1.fromArray(bone.position));
			}
			let tail_offset = box.getCenter(Reusable.vec1);
			bone.children[0].scale.y = Math.max(2, tail_offset.length());
			bone.children[0].quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), tail_offset.normalize());

		} else if (connected_children.length == 1) {
			let tail_offset = Reusable.vec1.fromArray(connected_children[0].position);
			bone.children[0].scale.y = tail_offset.length();
			bone.children[0].quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), tail_offset.normalize());

		} else {
			bone.children[0].rotation.set(0,0,0);
			bone.children[0].scale.x = element.width/2;
			bone.children[0].scale.z = element.width/2;
			bone.children[0].scale.y = element.length;
		}

		bone.fix_position.copy(bone.position);
		bone.fix_rotation.copy(bone.rotation);
		bone.inverse_bind_matrix.copy(bone.matrixWorld).invert();

		/*for (let child of element.children) {
			if (child.scene_object) this.updateTransform(child);
		}*/

		bone.updateMatrixWorld();

		this.dispatchEvent('update_transform', {element});
	},
	updateSelection(element: ArmatureBone) {
		let material = element.selected ? this.material_selected : this.material;
		let preview_mesh = element.scene_object.children[0] as THREE.Mesh;
		preview_mesh.material = material;
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
		keybind: new Keybind({key: 'e', shift: true}),
		condition: () => Modes.edit && (ArmatureBone.selected[0] || Armature.selected[0]),
		click: function () {
			Undo.initEdit({outliner: true, elements: []});
			let add_to_node = Outliner.selected[0] || Group.first_selected;
			if (!add_to_node && selected.length) {
				add_to_node = selected.last();
			}
			let new_instance = new ArmatureBone({
				origin: add_to_node instanceof ArmatureBone ? [0, add_to_node.length??8, 0] : undefined,
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
