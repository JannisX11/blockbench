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
		let pos = Reusable.vec1.fromArray(this.local_pivot);

		if (m) {
			let r = m.getWorldQuaternion(Reusable.quat1);
			pos.applyQuaternion(r);
			pos.add(THREE.fastWorldPosition(m, Reusable.vec2));
		}
		return pos;
	}
	moveVector(arr, axis, update = true) {
		if (typeof arr == 'number') {
			var n = arr;
			arr = [0, 0, 0];
			arr[axis||0] = n;
		} else if (arr instanceof THREE.Vector3) {
			arr = arr.toArray();
		}
		arr.forEach((val, i) => {
			this.origin[i] += val;
		})
		if (update) {
			this.preview_controller.updateTransform(this);
		}
		TickUpdates.selection = true;
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
		copy.type = this.type;
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
		...Outliner.control_menu_group,
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
new Property(TextureMesh, 'boolean', 'locked');

OutlinerElement.registerType(TextureMesh, 'texture_mesh');

new NodePreviewController(TextureMesh, {
	setup(element) {

		var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), Canvas.emptyMaterials[0]);
		Project.nodes_3d[element.uuid] = mesh;
		mesh.name = element.uuid;
		mesh.type = element.type;
		mesh.isElement = true;
		mesh.rotation.order = 'ZYX';

		mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(4), 1));

		// Outline
		let outline = new THREE.LineSegments(new THREE.BufferGeometry(), Canvas.outlineMaterial);
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
		this.updateFaces(element);
		mesh.visible = element.visibility;

		this.dispatchEvent('setup', {element});
	},
	updateGeometry(element, texture = Texture.getDefault()) {
		
		let {mesh} = element;
		let position_array = [];
		let indices = [];
		let outline_positions = [];
		let uvs = [1, 1, 1, 0, 0, 0, 0, 1,   1, 1, 1, 0, 0, 0, 0, 1];
		let normals = [];
		let colors = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
		function addNormal(x, y, z) {
			normals.push(x, y, z);
			normals.push(x, y, z);
			normals.push(x, y, z);
			normals.push(x, y, z);
		}

		let corners = [
			[-Project.texture_width, 0, 0],
			[-Project.texture_width, 0, Project.texture_height],
			[0, 0, Project.texture_height],
			[0, 0, 0],
		]
		corners.push(...corners.map(corner => {
			return [corner[0], -1, corner[2]]
		}))

		corners.forEach(corner => {
			position_array.push(...corner);
		})

		indices.push(0, 1, 2, 0, 2, 3);
		indices.push(4+0, 4+2, 4+1, 4+0, 4+3, 4+2);

		addNormal(0, 1, 0);
		addNormal(0, -1, 0);
		outline_positions.push(
			...corners[0], ...corners[1],
			...corners[1], ...corners[2],
			...corners[2], ...corners[3],
			...corners[3], ...corners[0],

			...corners[4], ...corners[5],
			...corners[5], ...corners[6],
			...corners[6], ...corners[7],
			...corners[7], ...corners[4],

			...corners[0], ...corners[4+0],
			...corners[1], ...corners[4+1],
			...corners[2], ...corners[4+2],
			...corners[3], ...corners[4+3]
		)

		if (texture && texture.width) {
			let canvas = document.createElement('canvas');
			let ctx = canvas.getContext('2d');
			canvas.width = texture.width;
			canvas.height = texture.height;
			ctx.drawImage(texture.img, 0, 0);

			function addFace(sx, sy, ex, ey, dir) {

				let s = position_array.length / 3;
				position_array.push(-sx * Project.texture_width / texture.width, 0, sy * Project.texture_height / texture.height);
				position_array.push(-sx * Project.texture_width / texture.width, -1, sy * Project.texture_height / texture.height);
				position_array.push(-ex * Project.texture_width / texture.width, -1, ey * Project.texture_height / texture.height);
				position_array.push(-ex * Project.texture_width / texture.width, 0, ey * Project.texture_height / texture.height);

				if (dir == 1) {
					indices.push(s+0, s+1, s+2, s+0, s+2, s+3);
				} else {
					indices.push(s+0, s+2, s+1, s+0, s+3, s+2);
				}

				if (sx == ex) {
					sx += 0.1 * -dir;
					ex += 0.4 * -dir;
					sy += 0.1;
					ey -= 0.1;
					addNormal(-dir, 0, 0);
				}
				if (sy == ey) {
					sy += 0.1 * dir;
					ey += 0.4 * dir;
					sx += 0.1;
					ex -= 0.1;
					addNormal(0, 0, -dir);
				}
				uvs.push(
					ex / canvas.width, 1 - (sy / canvas.height),
					ex / canvas.width, 1 - (ey / canvas.height),
					sx / canvas.width, 1 - (ey / canvas.height),
					sx / canvas.width, 1 - (sy / canvas.height),
				)
				colors.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);

			}

			let result = ctx.getImageData(0, 0, canvas.width, canvas.height);
			let matrix_1 = [];
			for (let i = 0; i < result.data.length; i += 4) {
				matrix_1.push(result.data[i+3] > 140 ? 1 : 0);
			}
			let matrix_2 = matrix_1.slice();

			for (var y = 0; y < canvas.height; y++) {
				for (var x = 0; x <= canvas.width; x++) {
					let px0 = x == 0 ? 0 : matrix_1[y * canvas.width + x - 1];
					let px1 = x == canvas.width ? 0 : matrix_1[y * canvas.width + x];
					if (!px0 !== !px1) {
						addFace(x, y, x, y+1, px0 ? 1 : -1);
					}
				}
			}

			for (var x = 0; x < canvas.width; x++) {
				for (var y = 0; y <= canvas.height; y++) {
					let px0 = y == 0 ? 0 : matrix_2[(y-1) * canvas.width + x];
					let px1 = y == canvas.height ? 0 : matrix_2[y * canvas.width + x];
					if (!px0 !== !px1) {
						addFace(x, y, x+1, y, px0 ? -1 : 1);
					}
				}
			}
		}


		position_array.forEach((n, i) => {
			let axis = i % 3;
			position_array[i] = n * element.scale[axis] + element.local_pivot[axis];
		})
		outline_positions.forEach((n, i) => {
			let axis = i % 3;
			outline_positions[i] = n * element.scale[axis] + element.local_pivot[axis];
		})
		
		mesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(position_array), 3));
		mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(mesh.geometry.attributes.position.count), 1));
		mesh.geometry.setIndex(indices);
		mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
		mesh.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
		mesh.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
		mesh.geometry.attributes.color.needsUpdate = true;
		mesh.geometry.attributes.normal.needsUpdate = true;

		mesh.outline.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(outline_positions), 3));

		mesh.geometry.computeBoundingBox();
		mesh.geometry.computeBoundingSphere();

		this.dispatchEvent('update_geometry', {element});
	},
	updateFaces(element) {
		let {mesh} = element;

		if (Project.view_mode === 'solid') {
			mesh.material = Canvas.solidMaterial
		
		} else if (Project.view_mode === 'wireframe') {
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

		this.dispatchEvent('update_faces', {element});
	},
	updateTransform(element) {
		let {mesh} = element;
		NodePreviewController.prototype.updateTransform(element);
		mesh.scale.set(1, 1, 1);

		this.dispatchEvent('update_transform', {element});
	}
})

BARS.defineActions(function() {
	new Action({
		id: 'add_texture_mesh',
		icon: 'fa-puzzle-piece',
		category: 'edit',
		condition: () => (Modes.edit && Format.texture_meshes),
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
