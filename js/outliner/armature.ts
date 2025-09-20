import { Blockbench } from "../api";
import { THREE, Vue } from "../lib/libs";
import { ArmatureBone } from "./armature_bone";

interface ArmatureOptions {
	name?: string
	export?: boolean
	locked?: boolean
	visibility?: boolean
}

export class Armature extends OutlinerElement {
	children: ArmatureBone[]
	isOpen: boolean
	visibility: boolean
	origin: ArrayVector3

	static preview_controller: NodePreviewController

	constructor(data?: ArmatureOptions, uuid?: UUID) {
		super(data, uuid);

		for (let key in Armature.properties) {
			Armature.properties[key].reset(this);
		}

		this.name = 'armature'
		this.children = [];
		this.selected = false;
		this.locked = false;
		this.export = true;
		this.parent = 'root';
		this.isOpen = false;
		this.visibility = true;
		this.origin = [0, 0, 0];

		if (typeof data === 'object') {
			this.extend(data)
		} else if (typeof data === 'string') {
			this.name = data
		}
	}
	extend(object: ArmatureOptions) {
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
			// @ts-ignore
			this.constructor.preview_controller.setup(this);
		}
		return this;
	}
	markAsSelected(descendants: boolean = false) {
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
	getSaveCopy() {
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
	getChildlessCopy(keep_uuid?: boolean) {
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
	forEachChild(cb: ((element: OutlinerElement) => void), type?: typeof OutlinerNode, forSelf?: boolean) {
		let i = 0
		if (forSelf) {
			cb(this)
		}
		while (i < this.children.length) {
			if (!type || (type instanceof Array ? type.find(t2 => this.children[i] instanceof t2) : this.children[i] instanceof type)) {
				// @ts-ignore
				cb(this.children[i])
			}
			if (this.children[i].forEachChild) {
				this.children[i].forEachChild(cb, type)
			}
			i++;
		}
	}
	getAllBones(): ArmatureBone[] {
		let bones = [];
		function addBones(array: ArmatureBone[]) {
			for (let item of array) {
				if (item instanceof ArmatureBone == false) continue;
				bones.push(item);
				addBones(item.children);
			}
		}
		addBones(this.children);
		return bones;
	}
	calculateVertexDeformation(mesh: Mesh): Record<string, ArrayVector3> {
		const _matrix4 = new THREE.Matrix4();
		const _basePosition = new THREE.Vector3();
		const _vector3 = new THREE.Vector3();
		const target = new THREE.Vector3();

		let armature_matrix_inverse = new THREE.Matrix4().copy(this.scene_object.parent.matrixWorld).invert();
		let bind_matrix = new THREE.Matrix4().copy(armature_matrix_inverse);
		bind_matrix.multiply(mesh.mesh.matrixWorld);
		let bind_matrix_inverse = bind_matrix.clone().invert();
		let bones = this.getAllBones();
		let vertex_offsets = {};

		for (let vkey in mesh.vertices) {

			_basePosition.fromArray(mesh.vertices[vkey]);
			_basePosition.applyMatrix4(bind_matrix);
	
			target.set(0, 0, 0);

			let affecting_bones = bones.filter(bone => bone.vertex_weights[vkey]);
			if (affecting_bones.length > 4) {
				affecting_bones.sort((a, b) => a.vertex_weights[vkey] - b.vertex_weights[vkey]).slice(0, 4);
			}
			// Normalize weights
			// The sum of all weights shold be 1, otherwise vertices are not influenced by bones equally and start drifting towards the mesh origin
			let weights = [];
			for ( let i = 0; i < 4; i ++ ) {
				const weight = affecting_bones[i]?.vertex_weights[vkey] ?? 0;
				weights.push(weight);
			}
			let weight_vector = new THREE.Vector4().fromArray(weights);
			const scale = 1.0 / weight_vector.manhattanLength();
			if ( scale !== Infinity ) {
				weight_vector.multiplyScalar( scale );
				weights = weight_vector.toArray();

				for ( let i = 0; i < 4; i ++ ) {
					const weight = weights[i];
					if ( weight !== 0 && affecting_bones[i] ) {
						_matrix4.multiplyMatrices( armature_matrix_inverse, affecting_bones[i].scene_object.matrixWorld );
						_matrix4.multiply( (affecting_bones[i].scene_object as any).inverse_bind_matrix );
						target.addScaledVector( _vector3.copy( _basePosition ).applyMatrix4( _matrix4 ), weight );
					}		
				}

			} else {
				// fallback
				//weight_vector.set( 1, 0, 0, 0 ); 
				target.copy(_basePosition)
			}

			target.applyMatrix4( bind_matrix_inverse );
			vertex_offsets[vkey] = target.toArray().V3_subtract(mesh.vertices[vkey]);
		}
		return vertex_offsets;
	}
	static behavior = {
		unique_name: false,
		movable: false,
		rotatable: false,
		parent: true,
		child_types: ['armature_bone', 'mesh'],
		hide_in_screenshot: true,
	}
	
	public title = tl('data.armature');
	public type = 'armature';
	public icon = 'accessibility';
	public name_regex = () => Format.bone_rig ? 'a-zA-Z0-9_' : false;
	public buttons = [
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];
	public menu = new Menu([
		'add_armature_bone',
		...Outliner.control_menu_group,
		new MenuSeparator('settings'),
		new MenuSeparator('manage'),
		'rename',
		'delete'
	]);
	
	static all: Armature[]
	static selected: Armature[]
}

OutlinerElement.registerType(Armature, 'armature');

new NodePreviewController(Armature, {
	setup(element: Armature) {
		let object_3d = new THREE.Object3D() as {isElement: boolean, no_export: boolean} & THREE.Object3D;
		object_3d.rotation.order = 'ZYX';
		object_3d.uuid = element.uuid.toUpperCase();
		object_3d.name = element.name;
		object_3d.isElement = true;
		Project.nodes_3d[element.uuid] = object_3d;

		object_3d.no_export = true;

		this.updateTransform(element);

		this.dispatchEvent('setup', {element});
	},
	updateTransform(element: Armature) {
		let mesh = element.mesh;

		if (Format.bone_rig && element.parent instanceof OutlinerNode && element.parent.scene_object) {
			element.parent.scene_object.add(mesh);
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
		condition: () => Modes.edit && Project.format?.armature_rig,
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

			if (add_to_node instanceof Mesh) {
				add_to_node.addTo(armature);
			}

			let bone = new ArmatureBone();
			bone.addTo(armature).init();

			// @ts-ignore
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
