class MeshFace {
	constructor(mesh, data) {
		this.mesh = mesh;
		this.texture = false;
		this.uv = {};
		for (var key in MeshFace.properties) {
			MeshFace.properties[key].reset(this);
		}
		if (data) this.extend(data);
	}
	extend(data) {
		for (let key in MeshFace.properties) {
			MeshFace.properties[key].merge(this, data)
		}
		this.vertices.forEach(key => {
			if (!this.uv[key]) this.uv[key] = [0, 0];
			if (data.uv && data.uv[key] instanceof Array) {
				this.uv[key].replace(data.uv[key]);
			}
		})
		for (let key in this.uv) {
			if (!this.vertices.includes(key)) {
				delete this.uv[key];
			}
		}

		if (data.texture === null) {
			this.texture = null;
		} else if (data.texture === false) {
			this.texture = false;
		} else if (Texture.all.includes(data.texture)) {
			this.texture = data.texture.uuid;
		} else if (typeof data.texture === 'string') {
			Merge.string(this, data, 'texture')
		}
		return this;
	}
	getSaveCopy() {
		var copy = {
			uv: this.uv
		};
		for (var key in MeshFace.properties) {
			if (this[key] != MeshFace.properties[key].default) MeshFace.properties[key].copy(this, copy);
		}
		var tex = this.getTexture()
		if (tex === null) {
			copy.texture = null;
		} else if (tex instanceof Texture) {
			copy.texture = Texture.all.indexOf(tex)
		}
		return copy;
	}
	getUndoCopy() {
		var copy = new MeshFace(this.mesh, this);
		delete copy.mesh;
		return copy;
	}
	reset() {
		for (var key in Mesh.properties) {
			Mesh.properties[key].reset(this);
		}
		this.texture = false;
		return this;
	}
	getTexture() {
		if (Format.single_texture) {
			return Texture.getDefault();
		}
		if (typeof this.texture === 'string') {
			return Texture.all.findInArray('uuid', this.texture)
		} else {
			return this.texture;
		}
	}
	getNormal(normalize) {
		if (this.vertices.length < 3) return [0, 0, 0];
		let a = [
			this.mesh.vertices[this.vertices[1]][0] - this.mesh.vertices[this.vertices[0]][0],
			this.mesh.vertices[this.vertices[1]][1] - this.mesh.vertices[this.vertices[0]][1],
			this.mesh.vertices[this.vertices[1]][2] - this.mesh.vertices[this.vertices[0]][2],
		]
		let b = [
			this.mesh.vertices[this.vertices[2]][0] - this.mesh.vertices[this.vertices[0]][0],
			this.mesh.vertices[this.vertices[2]][1] - this.mesh.vertices[this.vertices[0]][1],
			this.mesh.vertices[this.vertices[2]][2] - this.mesh.vertices[this.vertices[0]][2],
		]
		let direction = [
			a[1] * b[2] - a[2] * b[1],
			a[2] * b[0] - a[0] * b[2],
			a[0] * b[1] - a[1] * b[0],
		]
		if (normalize) {
			let length = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2]);
			return direction.map(dir => dir / length);
		} else {
			return direction
		}
	}
	invert() {
		if (this.vertices.length < 3) return this;
		[this.vertices[1], this.vertices[2]] = [this.vertices[2], this.vertices[1]];
	}
	isSelected() {
		let selected_vertices = Project.selected_vertices[this.mesh.uuid];
		return selected_vertices
			&& selected_vertices.length > 1
			&& !this.vertices.find(key => !selected_vertices.includes(key))
	}
	getSortedVertices() {
		if (this.vertices.length < 4) return this.vertices;

		// Test if point "check" is on the other side of the line between "base1" and "base2", compared to "top"
		function test(base1, base2, top, check) {
			base1 = Canvas.temp_vectors[0].fromArray(base1);
			base2 = Canvas.temp_vectors[1].fromArray(base2);
			top = Canvas.temp_vectors[2].fromArray(top);
			check = Canvas.temp_vectors[3].fromArray(check);

			// Construct a plane with coplanar points "base1" and "base2" with a normal towards "top"
			let normal = Canvas.temp_vectors[4];
			new THREE.Line3(base1, base2).closestPointToPoint(top, false, normal);
			normal.sub(top);
			let plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, base2);
			let distance = plane.distanceToPoint(check);
			return distance > 0;
		}
		let {mesh, vertices} = this;
				
		if (test(mesh.vertices[vertices[1]], mesh.vertices[vertices[2]], mesh.vertices[vertices[0]], mesh.vertices[vertices[3]])) {
			return [vertices[2], vertices[0], vertices[1], vertices[3]];

		} else if (test(mesh.vertices[vertices[0]], mesh.vertices[vertices[1]], mesh.vertices[vertices[2]], mesh.vertices[vertices[3]])) {
			return [vertices[0], vertices[2], vertices[1], vertices[3]];
		}
		return vertices;
	}
}
new Property(MeshFace, 'array', 'vertices', {default: 0});


class Mesh extends OutlinerElement {
	constructor(data, uuid) {
		super(data, uuid)

		this.vertices = {};
		this.faces = {};

		if (!data.vertices) {
			this.addVertices([16, 16, 16], [16, 16, 0], [16, 0, 16], [16, 0, 0], [0, 16, 16], [0, 16, 0], [0, 0, 16], [0, 0, 0]);
			let vertex_keys = Object.keys(this.vertices);
			this.addFaces(new MeshFace( this, {vertices: [vertex_keys[0], vertex_keys[2], vertex_keys[1], vertex_keys[3]]} ));	// East
			this.addFaces(new MeshFace( this, {vertices: [vertex_keys[4], vertex_keys[6], vertex_keys[5], vertex_keys[7]]} ));	// West
			this.addFaces(new MeshFace( this, {vertices: [vertex_keys[0], vertex_keys[4], vertex_keys[1], vertex_keys[5]]} ));	// Up
			this.addFaces(new MeshFace( this, {vertices: [vertex_keys[2], vertex_keys[3], vertex_keys[6], vertex_keys[7]]} ));	// Down
			this.addFaces(new MeshFace( this, {vertices: [vertex_keys[0], vertex_keys[2], vertex_keys[4], vertex_keys[6]]} ));	// South
			this.addFaces(new MeshFace( this, {vertices: [vertex_keys[1], vertex_keys[5], vertex_keys[3], vertex_keys[7]]} ));	// North

			for (let key in this.faces) {
				let face = this.faces[key];
				face.uv[face.vertices[0]] = [0, 0];
				face.uv[face.vertices[1]] = [0, 16];
				face.uv[face.vertices[2]] = [16, 0];
				face.uv[face.vertices[3]] = [16, 16];
			}
		}
		for (var key in Mesh.properties) {
			Mesh.properties[key].reset(this);
		}
		if (data && typeof data === 'object') {
			this.extend(data)
		}
	}
	get from() {
		return this.origin;
	}
	get vertice_list() {
		return Object.keys(this.vertices).map(key => this.vertices[key]);
	}
	getWorldCenter(ignore_selected_vertices) {
		let m = this.mesh;
		let pos = new THREE.Vector3()
		let vertice_count = 0;

		for (let key in this.vertices) {
			if (ignore_selected_vertices || !Project.selected_vertices[this.uuid] || (Project.selected_vertices[this.uuid] && Project.selected_vertices[this.uuid].includes(key))) {
				let vector = this.vertices[key];
				pos.x += vector[0];
				pos.y += vector[1];
				pos.z += vector[2];
				vertice_count++;
			}
		}
		pos.x /= vertice_count;
		pos.y /= vertice_count;
		pos.z /= vertice_count;

		if (m) {
			let r = m.getWorldQuaternion(new THREE.Quaternion());
			pos.applyQuaternion(r);
			pos.add(THREE.fastWorldPosition(m, new THREE.Vector3()));
		}
		return pos;
	}
	addVertices(...vectors) {
		return vectors.map(vector => {
			let key;
			while (!key || this.vertices[key]) {
				key = bbuid(4);
			}
			this.vertices[key] = [...vector];
			return key;
		})
	}
	addFaces(...faces) {
		return faces.map(face => {
			let key;
			while (!key || this.faces[key]) {
				key = bbuid(8);
			}
			this.faces[key] = face;
			return key;
		})
	}
	extend(object) {
		for (var key in Mesh.properties) {
			Mesh.properties[key].merge(this, object)
		}
		if (typeof object.vertices == 'object') {
			for (let key in this.vertices) {
				if (!object.vertices[key]) {
					delete this.vertices[key];
				}
			}
			for (let key in object.vertices) {
				if (!this.vertices[key]) this.vertices[key] = [];
				this.vertices[key].replace(object.vertices[key]);
			}
		}
		if (typeof object.faces == 'object') {
			for (let key in this.faces) {
				if (!object.faces[key]) {
					delete this.faces[key];
				}
			}
			for (let key in object.faces) {
				if (this.faces[key]) {
					this.faces[key].extend(object.faces[key])
				} else {
					this.faces[key] = new MeshFace(this, object.faces[key]);
				}
			}
		}
		this.sanitizeName();
		return this;
	}
	getUndoCopy() {
		var copy = new Mesh(this)
		copy.uuid = this.uuid;
		delete copy.parent;
		return copy;
	}
	getSaveCopy() {
		var el = {}
		for (var key in Mesh.properties) {
			Mesh.properties[key].copy(this, el)
		}
		el.type = 'mesh';
		el.uuid = this.uuid
		return el;
	}
	applyTexture(texture, faces) {
		var scope = this;
		if (faces === true) {
			var sides = Object.keys(this.faces);
		} else if (faces === undefined) {
			var sides = UVEditor.vue.selected_faces
		} else {
			var sides = faces
		}
		var value = false;
		if (texture) {
			value = texture.uuid
		}
		sides.forEach(function(side) {
			scope.faces[side].texture = value
		})
		if (Project.selected_elements.indexOf(this) === 0) {
			UVEditor.loadData()
		}
		if (Prop.view_mode === 'textured') {
			this.preview_controller.updateFaces(this);
			this.preview_controller.updateUV(this);
		}
	}
}
	Mesh.prototype.title = tl('data.mesh');
	Mesh.prototype.type = 'mesh';
	Mesh.prototype.icon = 'fa far fa-gem';
	Mesh.prototype.movable = true;
	Mesh.prototype.resizable = false;
	Mesh.prototype.rotatable = true;
	Mesh.prototype.needsUniqueName = false;
	Mesh.prototype.menu = new Menu([
		'group_elements',
		'_',
		'copy',
		'paste',
		'duplicate',
		'_',
		'rename',
		{name: 'menu.cube.color', icon: 'color_lens', children: [
			{icon: 'bubble_chart', color: markerColors[0].standard, name: 'cube.color.'+markerColors[0].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(0)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[1].standard, name: 'cube.color.'+markerColors[1].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(1)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[2].standard, name: 'cube.color.'+markerColors[2].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(2)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[3].standard, name: 'cube.color.'+markerColors[3].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(3)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[4].standard, name: 'cube.color.'+markerColors[4].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(4)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[5].standard, name: 'cube.color.'+markerColors[5].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(5)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[6].standard, name: 'cube.color.'+markerColors[6].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(6)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[7].standard, name: 'cube.color.'+markerColors[7].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(7)}, 'change color')}}
		]},
		{name: 'menu.cube.texture', icon: 'collections', condition: () => !Project.single_texture, children: function() {
			var arr = [
				{icon: 'crop_square', name: 'menu.cube.texture.blank', click: function(cube) {
					cube.forSelected(function(obj) {
						obj.applyTexture(false, true)
					}, 'texture blank')
				}}
			]
			Texture.all.forEach(function(t) {
				arr.push({
					name: t.name,
					icon: (t.mode === 'link' ? t.img : t.source),
					click: function(cube) {
						cube.forSelected(function(obj) {
							obj.applyTexture(t, true)
						}, 'apply texture')
					}
				})
			})
			return arr;
		}},
		'toggle_visibility',
		'delete'
	]);
	Mesh.prototype.buttons = [
		Outliner.buttons.export,
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];

new Property(Mesh, 'string', 'name', {default: 'mesh'})
new Property(Mesh, 'number', 'color', {default: Math.floor(Math.random()*8)});
new Property(Mesh, 'vector', 'origin');
new Property(Mesh, 'vector', 'rotation');
new Property(Mesh, 'boolean', 'visibility', {default: true});

OutlinerElement.registerType(Mesh, 'mesh');

new NodePreviewController(Mesh, {
	setup(element) {
		var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), Canvas.emptyMaterials[0]);
		Project.nodes_3d[element.uuid] = mesh;
		mesh.name = element.uuid;
		mesh.type = element.type;
		mesh.isElement = true;

		mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(24), 1));

		// Outline
		let outline = new THREE.LineSegments(new THREE.BufferGeometry(), Canvas.outlineMaterial);
		outline.no_export = true;
		outline.name = element.uuid+'_outline';
		outline.visible = element.selected;
		outline.renderOrder = 2;
		outline.frustumCulled = false;
		mesh.outline = outline;
		mesh.add(outline);

		// Vertex Points
		let material = new THREE.PointsMaterial({size: 7, sizeAttenuation: false, vertexColors: true});
		let points = new THREE.Points(new THREE.BufferGeometry(), material);
		points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(24).fill(1), 3));
		mesh.vertex_points = points;
		outline.add(points);

		// Update
		this.updateTransform(element);
		this.updateGeometry(element);
		this.updateFaces(element);
		this.updateUV(element);
		mesh.visible = element.visibility;
	},
	updateGeometry(element) {
		
		let {mesh} = element;
		let point_position_array = [];
		let position_array = [];
		let normal_array = [];
		let indices = [];
		let outline_positions = [];

		for (let key in element.vertices) {
			let vector = element.vertices[key];
			point_position_array.push(...vector);
		}

		for (let key in element.faces) {
			let face = element.faces[key];
			


			if (face.vertices.length == 2) {
				// Outline
				outline_positions.push(...element.vertices[face.vertices[0]]);
				outline_positions.push(...element.vertices[face.vertices[1]]);

			} else if (face.vertices.length == 3) {
				// Tri
				face.vertices.forEach((key, i) => {
					indices.push(position_array.length / 3);
					position_array.push(...element.vertices[key])
				})
				let normal = face.getNormal();
				normal_array.push(...normal, ...normal, ...normal);

				// Outline
				face.vertices.forEach((key, i) => {

					outline_positions.push(...element.vertices[key]);
					if (i) {
						outline_positions.push(...element.vertices[key]);
					}
				})
				outline_positions.push(...element.vertices[face.vertices[0]]);

			} else if (face.vertices.length == 4) {

				let index_offset = position_array.length / 3;
				let face_indices = {};
				face.vertices.forEach((key, i) => {
					position_array.push(...element.vertices[key])
					face_indices[key] = index_offset + i;
				})

				let normal = face.getNormal();
				normal_array.push(...normal, ...normal, ...normal, ...normal);

				let sorted_vertices = face.getSortedVertices();

				indices.push(index_offset + 0);
				indices.push(index_offset + 1);
				indices.push(index_offset + 2);
				indices.push(face_indices[sorted_vertices[0]]);
				indices.push(face_indices[sorted_vertices[2]]);
				indices.push(face_indices[sorted_vertices[3]]);
				

				// Outline
				sorted_vertices.forEach((key, i) => {
					outline_positions.push(...element.vertices[key]);
					if (i != 0) outline_positions.push(...element.vertices[key]);
				})
				outline_positions.push(...element.vertices[sorted_vertices[0]]);
			}
		}

		mesh.vertex_points.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(point_position_array), 3));
		
		mesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(position_array), 3));
		mesh.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normal_array), 3));
		mesh.geometry.setIndex(indices);

		mesh.outline.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(outline_positions), 3));

		mesh.geometry.computeVertexNormals();
		mesh.geometry.computeBoundingBox();
		mesh.geometry.computeBoundingSphere();
	},
	updateFaces(element) {
		let {mesh} = element;

		if (Prop.view_mode === 'solid') {
			mesh.material = Canvas.solidMaterial
		
		} else if (Prop.view_mode === 'wireframe') {
			mesh.material = Canvas.wireframeMaterial

		} else if (Format.single_texture && Texture.all.length >= 2 && Texture.all.find(t => t.render_mode == 'layered')) {
			mesh.material = Canvas.getLayeredMaterial();

		} else if (Format.single_texture) {
			let tex = Texture.getDefault();
			mesh.material = tex ? tex.getMaterial() : Canvas.emptyMaterials[element.color];

		} else {
			var materials = []
			for (let key in element.faces) {
				var tex = element.faces[key].getTexture()
				if (tex && tex.uuid) {
					materials.push(Project.materials[tex.uuid])
				} else {
					materials.push(Canvas.emptyMaterials[element.color])
				}
			}
			if (materials.allEqual(materials[0])) materials = materials[0];
			mesh.material = materials
		}
	},
	updateUV(element, animation = true) {
		var {mesh} = element;
		if (mesh === undefined || !mesh.geometry) return;
		let uv_array = [];

		for (let key in element.faces) {
			let face = element.faces[key];
			
			face.vertices.forEach((key, i) => {
				uv_array.push(
					  ((face.uv[key] ? face.uv[key][0] : 0) / Project.texture_width),
					1-((face.uv[key] ? face.uv[key][1] : 0) / Project.texture_height)
				)
			})
		}

		mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv_array), 2)), 
		mesh.geometry.attributes.uv.needsUpdate = true;

		return mesh.geometry;
	},
	updateSelection(element) {
		NodePreviewController.prototype.updateSelection(element);
		
		let mesh = element.mesh;
		let colors = [];

		for (let key in element.vertices) {
			let color;
			if (Project.selected_vertices[element.uuid] && Project.selected_vertices[element.uuid].includes(key)) {
				color = gizmo_colors.outline;
			} else {
				color = gizmo_colors.grid;
			}
			colors.push(color.r, color.g, color.b);
		}
		
		mesh.vertex_points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
		mesh.vertex_points.visible = Mode.selected.id == 'edit';
	}
})

BARS.defineActions(function() {
	new Action({
		id: 'add_mesh',
		icon: 'fa-gem',
		category: 'edit',
		keybind: new Keybind({key: 'n', ctrl: true}),
		condition: () => (Modes.edit && Format.meshes),
		click: function () {
			
			Undo.initEdit({outliner: true, elements: [], selection: true});
			var base_mesh = new Mesh({
				autouv: (settings.autouv.value ? 1 : 0)
			}).init()
			var group = getCurrentGroup();
			base_mesh.addTo(group)

			if (Texture.all.length && Format.single_texture) {
				for (var face in base_mesh.faces) {
					base_mesh.faces[face].texture = Texture.getDefault().uuid
				}
				UVEditor.loadData()
			}
			if (Format.bone_rig) {
				if (group) {
					var pos1 = group.origin.slice()
					base_mesh.extend({
						from:[ pos1[0]-0, pos1[1]-0, pos1[2]-0 ],
						to:[   pos1[0]+1, pos1[1]+1, pos1[2]+1 ],
						origin: pos1.slice()
					})
				}
			}

			if (Group.selected) Group.selected.unselect()
			base_mesh.select()
			Undo.finishEdit('Add mesh', {outliner: true, elements: selected, selection: true});
			Blockbench.dispatchEvent( 'add_mesh', {object: base_mesh} )

			Vue.nextTick(function() {
				if (settings.create_rename.value) {
					base_mesh.rename()
				}
			})
			return base_mesh
		}
	})
	new BarSelect('selection_mode', {
		options: {
			object: true,
			vertex: true,
			face: true,
		},
		condition: () => Format && Format.meshes,
		onChange: function(slider) {
			updateSelection();
		}
	})
	new Action({
		id: 'create_face',
		icon: 'fas.fa-draw-polygon',
		category: 'edit',
		keybind: new Keybind({key: 'f', shift: true}),
		condition: () => (Modes.edit && Format.meshes),
		click() {
			Undo.initEdit({elements: Mesh.selected});
			Mesh.selected.forEach(mesh => {
				let selected_vertices = Project.selected_vertices[mesh.uuid];
				if (selected_vertices && selected_vertices.length >= 2 && selected_vertices.length <= 4) {
					for (let key in mesh.faces) {
						let face = mesh.faces[key];
						if (face.isSelected()) {
							delete mesh.faces[key];
						}
					}
					let new_face = new MeshFace(mesh, {vertices: selected_vertices} );
					mesh.addFaces(new_face);

					// Correct direction
					if (selected_vertices.length > 2) {
						// find face with shared line to compare
						let fixed_via_face;
						for (let key in mesh.faces) {
							let face = mesh.faces[key];
							let common = face.vertices.filter(vertex_key => selected_vertices.includes(vertex_key))
							if (common.length == 2) {
								let old_vertices = face.getSortedVertices();
								let new_vertices = new_face.getSortedVertices();
								let index_diff = old_vertices.indexOf(common[0]) - old_vertices.indexOf(common[1]);
								let new_index_diff = new_vertices.indexOf(common[0]) - new_vertices.indexOf(common[1]);
								if (index_diff == 1 - face.vertices.length) index_diff = 1;
								if (new_index_diff == 1 - new_face.vertices.length) new_index_diff = 1;

								if (Math.abs(index_diff) == 1 && Math.abs(new_index_diff) == 1) {
									if (index_diff == new_index_diff) {
										new_face.invert();
									}
									fixed_via_face = true;
									break;
								}
							}
						}
						// If no face available, orient based on camera orientation
						if (!fixed_via_face) {
							let normal = new THREE.Vector3().fromArray(new_face.getNormal());
							normal.applyQuaternion(mesh.mesh.getWorldQuaternion(new THREE.Quaternion()))
							let cam_direction = Preview.selected.camera.getWorldDirection(new THREE.Vector3());
							let angle = normal.angleTo(cam_direction);
							if (angle < Math.PI/2) {
								new_face.invert();
							}
						}
					}
				}
			})
			Undo.finishEdit('Create mesh face')
			Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}})
		}
	})
	new Action({
		id: 'extrude_mesh_selection',
		icon: 'upload',
		category: 'edit',
		keybind: new Keybind({key: 'e', shift: true}),
		condition: () => (Modes.edit && Format.meshes),
		click() {
			Undo.initEdit({elements: Mesh.selected});
			Mesh.selected.forEach(mesh => {
				let original_vertices = Project.selected_vertices[mesh.uuid].slice();
				let new_vertices;
				let selected_faces = [];
				let selected_face_keys = [];
				for (let key in mesh.faces) {
					let face = mesh.faces[key]; 
					if (face.isSelected()) {
						selected_faces.push(face);
						selected_face_keys.push(key);
					}
				}
				let direction = selected_faces[0] && selected_faces[0].vertices.length > 2 && selected_faces[0].getNormal(true);
				if (!direction) direction = [0, 1, 0];

				new_vertices = mesh.addVertices(...original_vertices.map(key => {
					let vector = mesh.vertices[key].slice();
					vector.V3_add(direction);
					return vector;
				}))
				Project.selected_vertices[mesh.uuid].replace(new_vertices);

				// Move Faces
				selected_faces.forEach(face => {
					face.vertices.forEach((key, index) => {
						face.vertices[index] = new_vertices[original_vertices.indexOf(key)];
					})
				})

				// Create extra quads on sides
				let remaining_vertices = new_vertices.slice();
				selected_faces.forEach((face, face_index) => {
					let vertices = face.getSortedVertices();
					vertices.forEach((a, i) => {
						let b = vertices[i+1] || vertices[0];
						if (vertices.length == 2 && i) return; // Only create one quad when extruding line
						if (selected_faces.find(f => f != face && f.vertices.includes(a) && f.vertices.includes(b))) return;

						let new_face = new MeshFace(mesh, {
							vertices: [
								b,
								a,
								original_vertices[new_vertices.indexOf(a)],
								original_vertices[new_vertices.indexOf(b)],
							]
						});
						mesh.addFaces(new_face);
						remaining_vertices.remove(a);
						remaining_vertices.remove(b);
					})

					if (vertices.length == 2) delete mesh.faces[selected_face_keys[face_index]];
				})

				remaining_vertices.forEach(a => {
					let b = original_vertices[new_vertices.indexOf(a)]
					let new_face = new MeshFace(mesh, {
						vertices: [b, a]
					});
					mesh.addFaces(new_face);
				})

			})
			Undo.finishEdit('Extrude mesh selection')
			Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
	new Action({
		id: 'import_obj',
		icon: 'fa-gem',
		category: 'file',
		condition: () => (Modes.edit && Format.meshes),
		click: function () {

			
			Blockbench.import({
				resource_id: 'obj',
				extensions: ['obj'],
				name: 'OBJ Wavefront Model',
			}, function(files) {
				let {content} = files[0];
				let lines = content.split(/[\r\n]+/);

				function toVector(args, length) {
					return args.map(v => parseFloat(v));
				}

				let mesh;
				let vertex_keys = [];
				let vertex_textures = [];
				let vertex_normals = [];
				let meshes = [];
				let vector1 = new THREE.Vector3();
				let vector2 = new THREE.Vector3();

				Undo.initEdit({outliner: true, elements: meshes, selection: true});

				lines.forEach(line => {

					if (line.substr(0, 1) == '#' || !line) return;

					let args = line.split(' ');
					let cmd = args.shift();

					if (cmd == 'o') {
						mesh = new Mesh({
							name: args[0],
							vertices: {}
						})
						meshes.push(mesh);
					}
					if (cmd == 'v') {
						let keys = mesh.addVertices(toVector(args, 3));
						vertex_keys.push(keys[0]);
					}
					if (cmd == 'vt') {
						vertex_textures.push(toVector(args, 2))
					}
					if (cmd == 'vn') {
						vertex_normals.push(toVector(args, 3))
					}
					if (cmd == 'f') {
						let f = {
							vertices: [],
							vertex_textures: [],
							vertex_normals: [],
						}
						args.forEach(triplet => {
							let [v, vt, vn] = triplet.split('/').map(v => parseInt(v));
							f.vertices.push(vertex_keys[ v-1 ]);
							f.vertex_textures.push(vertex_textures[ vt-1 ]);
							f.vertex_normals.push(vertex_normals[ vn-1 ]);
						})
						
						let uv = {};
						f.vertex_textures.forEach((vt, i) => {
							let key = f.vertices[i];
							if (vt instanceof Array) {
								uv[key] = [
									vt[0] * Project.texture_width,
									(1-vt[1]) * Project.texture_width
								];
							} else {
								uv[key] = [0, 0];
							}
						})
						let face = new MeshFace(mesh, {
							vertices: f.vertices,
							uv
						})
						mesh.addFaces(face);

						if (f.vertex_normals.find(v => v)) {
	
							vector1.fromArray(face.getNormal());
							vector2.fromArray(f.vertex_normals[0]);
							let angle = vector1.angleTo(vector2);
							if (angle > Math.PI/2) {
								new_face.invert();
							}
						}
					}
				})
				meshes.forEach(mesh => {
					mesh.init();
				})

				Undo.finishEdit('Import OBJ');
			})
		}
	})
})