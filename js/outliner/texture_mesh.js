class TextureMesh extends OutlinerElement {
	constructor(data, uuid) {
		super(data, uuid)
		
		for (var key in TextureMesh.properties) {
			TextureMesh.properties[key].reset(this);
		}
		if (data && typeof data === 'object') {
			this.extend(data)
		}
	}
	get from() {
		return this.origin;
	}
	getWorldCenter() {
		let m = this.mesh;
		let pos = new THREE.Vector3().fromArray(this.local_pivot);

		if (m) {
			let r = m.getWorldQuaternion(new THREE.Quaternion());
			pos.applyQuaternion(r);
			pos.add(THREE.fastWorldPosition(m, new THREE.Vector3()));
		}
		return pos;
	}
	extend(object) {
		for (var key in TextureMesh.properties) {
			TextureMesh.properties[key].merge(this, object)
		}
		if (typeof object.vertices == 'object') {
			for (let key in object.vertices) {
				this.vertices[key] = object.vertices[key].slice();
			}
		}
		this.sanitizeName();
		return this;
	}
	getUndoCopy() {
		var copy = new TextureMesh(this)
		copy.uuid = this.uuid;
		delete copy.parent;
		return copy;
	}
	getSaveCopy() {
		var el = {}
		for (var key in TextureMesh.properties) {
			TextureMesh.properties[key].copy(this, el)
		}
		el.type = 'texture_mesh';
		el.uuid = this.uuid
		return el;
	}
}
	TextureMesh.prototype.title = tl('data.texture_mesh');
	TextureMesh.prototype.type = 'texture_mesh';
	TextureMesh.prototype.icon = 'fa fa-puzzle-piece';
	TextureMesh.prototype.movable = true;
	TextureMesh.prototype.scalable = true;
	TextureMesh.prototype.rotatable = true;
	TextureMesh.prototype.needsUniqueName = false;
	TextureMesh.prototype.menu = new Menu([
		'group_elements',
		'_',
		'copy',
		'paste',
		'duplicate',
		'_',
		'rename',
		{name: 'menu.texture_mesh.texture_name', icon: 'collections', condition: () => !Project.single_texture, click(context) {
			Blockbench.textPrompt('menu.texture_mesh.texture_name', context.texture_name, value => {
				Undo.initEdit({elements: TextureMesh.all}),
				TextureMesh.all.forEach(element => {
					element.texture_name = value;
				});
				Undo.finishEdit('Change texture mesh texture name')
			})
		}},
		'toggle_visibility',
		'delete'
	]);
	TextureMesh.prototype.buttons = [
		Outliner.buttons.export,
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];

new Property(TextureMesh, 'string', 'name', {default: 'texture_mesh'})
new Property(TextureMesh, 'string', 'texture_name')
new Property(TextureMesh, 'vector', 'origin');
new Property(TextureMesh, 'vector', 'local_pivot');
new Property(TextureMesh, 'vector', 'rotation');
new Property(TextureMesh, 'vector', 'scale', {default: [1, 1, 1]});
new Property(TextureMesh, 'boolean', 'visibility', {default: true});

OutlinerElement.registerType(TextureMesh, 'texture_mesh');

new NodePreviewController(TextureMesh, {
	setup(element) {

		var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), Canvas.emptyMaterials[0]); // BoxGeometry because BufferGeometry would render black, TODO: investigate
		Project.nodes_3d[element.uuid] = mesh;
		mesh.name = element.uuid;
		mesh.type = element.type;
		mesh.isElement = true;

		mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(24).fill(1), 1));

		// Outline
		let outline = new THREE.Line(new THREE.BufferGeometry(), Canvas.outlineMaterial);
		outline.no_export = true;
		outline.name = element.uuid+'_outline';
		outline.visible = element.selected;
		outline.renderOrder = 2;
		outline.frustumCulled = false;
		mesh.outline = outline;
		mesh.add(outline);

		// Update
		this.updateTransform(element);
		this.updateGeometry(element);
		mesh.visible = element.visibility;
	},
	updateGeometry(element) {
		
		let {mesh} = element;
		let position_array = [];
		let indices = [];
		let outline_positions = [];

		position_array.push(-Project.texture_width, 0, 0);
		position_array.push(-Project.texture_width, 0, Project.texture_height);
		position_array.push(0, 0, Project.texture_height);
		position_array.push(0, 0, 0);

		indices.push(0, 1, 2, 0, 2, 3);

		outline_positions.push(-Project.texture_width, 0, 0);
		outline_positions.push(-Project.texture_width, 0, Project.texture_height);
		outline_positions.push(-Project.texture_width, 0, Project.texture_height);
		outline_positions.push(0, 0, Project.texture_height);
		outline_positions.push(0, 0, Project.texture_height);
		outline_positions.push(0, 0, 0);
		outline_positions.push(0, 0, 0);
		outline_positions.push(-Project.texture_width, 0, 0);

		position_array.forEach((n, i) => {
			let axis = i % 3;
			position_array[i] = n * element.scale[axis] + element.local_pivot[axis];
		})
		outline_positions.forEach((n, i) => {
			let axis = i % 3;
			outline_positions[i] = n * element.scale[axis] + element.local_pivot[axis];
		})
		
		mesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(position_array), 3));
		mesh.geometry.setIndex(indices);

		mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 0, 0, 0, 0, 1]), 2)), 
		mesh.outline.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(outline_positions), 3));

		mesh.geometry.computeBoundingBox();
		mesh.geometry.computeBoundingSphere();
	},
	updateFaces(element) {
		let {mesh} = element;

		if (Prop.view_mode === 'solid') {
			mesh.material = Canvas.solidMaterial
		
		} else if (Prop.view_mode === 'wireframe') {
			mesh.material = Canvas.wireframeMaterial

		} else {
			var tex = Texture.getDefault();
			if (tex && tex.uuid) {
				mesh.material = Project.materials[tex.uuid]
			} else {
				mesh.material = Canvas.emptyMaterials[0]
			}
		}

		TextureMesh.preview_controller.updateGeometry(element);
	},
	updateTransform(element) {
		let {mesh} = element;
		NodePreviewController.prototype.updateTransform(element);
		mesh.scale.set(1, 1, 1);
	}
})

BARS.defineActions(function() {
	new Action({
		id: 'add_texture_mesh',
		icon: 'fa-puzzle-piece',
		category: 'edit',
		keybind: new Keybind({key: 'n', ctrl: true}),
		//condition: () => (Modes.edit && Format.texture_meshes),
		click: function () {
			
			Undo.initEdit({outliner: true, elements: [], selection: true});
			var base_texture_mesh = new TextureMesh().init()
			var group = getCurrentGroup();
			base_texture_mesh.addTo(group)

			if (Format.bone_rig) {
				if (group) {
					var pos1 = group.origin.slice()
					base_texture_mesh.extend({
						from:[ pos1[0]-0, pos1[1]-0, pos1[2]-0 ],
						to:[   pos1[0]+1, pos1[1]+1, pos1[2]+1 ],
						origin: pos1.slice()
					})
				}
			}

			if (Group.selected) Group.selected.unselect()
			base_texture_mesh.select()
			Undo.finishEdit('Add texture mesh', {outliner: true, elements: selected, selection: true});
			Blockbench.dispatchEvent( 'add_texture_mesh', {object: base_texture_mesh} )

			Vue.nextTick(function() {
				if (settings.create_rename.value) {
					base_texture_mesh.rename()
				}
			})
			return base_texture_mesh
		}
	})
})
