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
			this.addVertices([2, 4, 2], [2, 4, -2], [2, 0, 2], [2, 0, -2], [-2, 4, 2], [-2, 4, -2], [-2, 0, 2], [-2, 0, -2]);
			let vertex_keys = Object.keys(this.vertices);
			this.addFaces(new MeshFace( this, {vertices: [vertex_keys[0], vertex_keys[2], vertex_keys[1], vertex_keys[3]]} ));	// East
			this.addFaces(new MeshFace( this, {vertices: [vertex_keys[4], vertex_keys[5], vertex_keys[6], vertex_keys[7]]} ));	// West
			this.addFaces(new MeshFace( this, {vertices: [vertex_keys[0], vertex_keys[1], vertex_keys[4], vertex_keys[5]]} ));	// Up
			this.addFaces(new MeshFace( this, {vertices: [vertex_keys[2], vertex_keys[6], vertex_keys[3], vertex_keys[7]]} ));	// Down
			this.addFaces(new MeshFace( this, {vertices: [vertex_keys[0], vertex_keys[4], vertex_keys[2], vertex_keys[6]]} ));	// South
			this.addFaces(new MeshFace( this, {vertices: [vertex_keys[1], vertex_keys[3], vertex_keys[5], vertex_keys[7]]} ));	// North

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
			if (object.vertices instanceof Array) {
				this.addVertices(...object.vertices);
			} else {
				for (let key in object.vertices) {
					if (!this.vertices[key]) this.vertices[key] = [];
					this.vertices[key].replace(object.vertices[key]);
				}
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

		el.vertices = {};
		for (let key in this.vertices) {
			el.vertices[key] = this.vertices[key].slice();
		}

		el.faces = {};
		for (let key in this.faces) {
			el.faces[key] = this.faces[key].getSaveCopy();
		}

		el.type = 'mesh';
		el.uuid = this.uuid
		return el;
	}
	setColor(index) {
		this.color = index;
		if (this.visibility) {
			this.preview_controller.updateFaces(this);
		}
	}
	flip(axis, center) {
		for (let key in this.vertices) {
			var offset = this.vertices[key][axis] - center;
			this.vertices[key][axis] = center - offset;
		}
		for (let key in this.faces) {
			this.faces[key].invert();
		}

		this.rotation.forEach((n, i) => {
			if (i != axis) this.rotation[i] = -n;
		})

		this.preview_controller.updateTransform(this);
		this.preview_controller.updateGeometry(this);
		return this;
	}
	resize(val, axis, negative, allow_negative, bidirectional) {
		let selected_vertices = Project.selected_vertices[this.uuid] || Object.keys(this.vertices);
		let range = [Infinity, -Infinity];
		selected_vertices.forEach(key => {
			range[0] = Math.min(range[0], this.oldVertices[key][axis]);
			range[1] = Math.max(range[1], this.oldVertices[key][axis]);
		})
		let center = bidirectional ? (range[0] + range[1]) / 2 : (negative ? range[1] : range[0]);
		let size = Math.abs(range[1] - range[0]);
		let scale = (size + val * (negative ? -1 : 1) * (bidirectional ? 2 : 1)) / size;
		if (isNaN(scale) || Math.abs(scale) == Infinity) scale = 1;
		if (scale < 0 && !allow_negative) scale = 0;
		
		selected_vertices.forEach(key => {
			this.vertices[key][axis] = (this.oldVertices[key][axis] - center) * scale + center;
		})
		this.preview_controller.updateGeometry(this);
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
	Mesh.prototype.resizable = true;
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
		let outline = new THREE.LineSegments(new THREE.BufferGeometry(), Canvas.meshOutlineMaterial);
		outline.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(240).fill(1), 3));
		outline.no_export = true;
		outline.name = element.uuid+'_outline';
		outline.visible = element.selected;
		outline.renderOrder = 2;
		outline.frustumCulled = false;
		mesh.outline = outline;
		mesh.add(outline);
		outline.vertex_order = [];

		// Vertex Points
		let points = new THREE.Points(new THREE.BufferGeometry(), Canvas.meshVertexMaterial);
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
		mesh.outline.vertex_order.empty();

		for (let key in element.vertices) {
			let vector = element.vertices[key];
			point_position_array.push(...vector);
		}

		for (let key in element.faces) {
			let face = element.faces[key];
			


			if (face.vertices.length == 2) {
				// Outline
				mesh.outline.vertex_order.push(face.vertices[0]);
				mesh.outline.vertex_order.push(face.vertices[1]);

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

					mesh.outline.vertex_order.push(key);
					if (i) {
						mesh.outline.vertex_order.push(key);
					}
				})
				mesh.outline.vertex_order.push(face.vertices[0]);

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
					mesh.outline.vertex_order.push(key);
					if (i != 0) mesh.outline.vertex_order.push(key);
				})
				mesh.outline.vertex_order.push(sorted_vertices[0]);
			}
		}

		mesh.outline.vertex_order.forEach(key => {
			outline_positions.push(...element.vertices[key]);
		})

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
		let line_colors = [];

		for (let key in element.vertices) {
			let color;
			if (Project.selected_vertices[element.uuid] && Project.selected_vertices[element.uuid].includes(key)) {
				color = gizmo_colors.outline;
			} else {
				color = gizmo_colors.grid;
			}
			colors.push(color.r, color.g, color.b);
		}

		mesh.outline.vertex_order.forEach(key => {
			let color;
			if (!Modes.edit || BarItems.selection_mode.value == 'object' || (Project.selected_vertices[element.uuid] && Project.selected_vertices[element.uuid].includes(key))) {
				color = gizmo_colors.outline;
			} else {
				color = gizmo_colors.grid;
			}
			line_colors.push(color.r, color.g, color.b);
		})
		
		mesh.vertex_points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
		mesh.outline.geometry.setAttribute('color', new THREE.Float32BufferAttribute(line_colors, 3));
		mesh.outline.geometry.needsUpdate = true
		mesh.vertex_points.visible = Mode.selected.id == 'edit' && BarItems.selection_mode.value == 'vertex';
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
			face: true,
			vertex: true,
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
		id: 'convert_to_mesh',
		icon: 'fa-gem',
		category: 'edit',
		condition: () => (Modes.edit && Format.meshes && Cube.selected.length),
		click() {
			Undo.initEdit({elements: Cube.selected});

			let new_meshes = [];
			Cube.selected.forEach(cube => {
				
				let mesh = new Mesh({
					name: cube.name,
					origin: cube.origin,
					rotation: cube.rotation,
					vertices: [
						[cube.to[0] - cube.origin[0],	cube.to[1] - cube.origin[1], 	cube.to[2] - cube.origin[2]],
						[cube.to[0] - cube.origin[0],	cube.to[1] - cube.origin[1], 	cube.from[2] - cube.origin[2]],
						[cube.to[0] - cube.origin[0],	cube.from[1] - cube.origin[1], 	cube.to[2] - cube.origin[2]],
						[cube.to[0] - cube.origin[0],	cube.from[1] - cube.origin[1], 	cube.from[2] - cube.origin[2]],
						[cube.from[0] - cube.origin[0],	cube.to[1] - cube.origin[1], 	cube.to[2] - cube.origin[2]],
						[cube.from[0] - cube.origin[0],	cube.to[1] - cube.origin[1], 	cube.from[2] - cube.origin[2]],
						[cube.from[0] - cube.origin[0],	cube.from[1] - cube.origin[1], 	cube.to[2] - cube.origin[2]],
						[cube.from[0] - cube.origin[0],	cube.from[1] - cube.origin[1], 	cube.from[2] - cube.origin[2]],
					],
				})

				let vertex_keys = Object.keys(mesh.vertices);
				function addFace(direction, vertices) {
					let cube_face = cube.faces[direction];
					let uv = {
						[vertices[0]]: [cube_face.uv[2], cube_face.uv[1]],
						[vertices[1]]: [cube_face.uv[0], cube_face.uv[1]],
						[vertices[2]]: [cube_face.uv[2], cube_face.uv[3]],
						[vertices[3]]: [cube_face.uv[0], cube_face.uv[3]],
					};
					mesh.addFaces(
						new MeshFace( mesh, {
							vertices,
							uv,
							texture: cube_face.texture,
						}
					));
				}
				addFace('east', [vertex_keys[1], vertex_keys[0], vertex_keys[3], vertex_keys[2]]);
				addFace('west', [vertex_keys[4], vertex_keys[5], vertex_keys[6], vertex_keys[7]]);
				addFace('up', [vertex_keys[1], vertex_keys[5], vertex_keys[0], vertex_keys[4]]); // 4 0 5 1
				addFace('down', [vertex_keys[2], vertex_keys[6], vertex_keys[3], vertex_keys[7]]);
				addFace('south', [vertex_keys[0], vertex_keys[4], vertex_keys[2], vertex_keys[6]]);
				addFace('north', [vertex_keys[5], vertex_keys[1], vertex_keys[7], vertex_keys[3]]);

				mesh.init().sortInBefore(cube);
				new_meshes.push(mesh);
				cube.remove();
			})
			Undo.finishEdit('Convert cubes to meshes', {elements: new_meshes});
		}
	})
	new Action({
		id: 'invert_face',
		icon: 'fas.fa-draw-polygon',
		category: 'edit',
		keybind: new Keybind({key: 'i', shift: true}),
		condition: () => (Modes.edit && Format.meshes),
		click() {
			Undo.initEdit({elements: Mesh.selected});
			Mesh.selected.forEach(mesh => {
				for (let key in mesh.faces) {
					let face = mesh.faces[key];
					if (face.isSelected()) {
						face.invert();
					}
				}
			})
			Undo.finishEdit('Invert mesh faces');
			Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}});
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
						let uv = face.uv[key];
						delete face.uv[key];
						face.uv[face.vertices[index]] = uv;
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
		id: 'merge_meshes',
		icon: 'upload',
		category: 'edit',
		condition: () => (Modes.edit && Format.meshes && Mesh.selected.length >= 2),
		click() {
			let elements = Mesh.selected
			Undo.initEdit({elements: Mesh.selected});
			let original = Mesh.selected[0];
			let vector = new THREE.Vector3();

			Mesh.selected.forEach(mesh => {
				if (mesh == original) return;

				let old_vertex_keys = Object.keys(mesh.vertices);
				let new_vertex_keys = original.addVertices(...mesh.vertice_list.map(arr => {
					vector.fromArray(arr);
					mesh.mesh.localToWorld(vector);
					original.mesh.worldToLocal(vector);
					return vector.toArray()
				}));

				for (let key in mesh.faces) {
					let old_face = mesh.faces[key];
					let new_face = new MeshFace(original, old_face);
					let uv = {};
					for (let vkey in old_face.uv) {
						let new_vkey = new_vertex_keys[old_vertex_keys.indexOf(vkey)]
						uv[new_vkey] = old_face.uv[vkey];
					}
					new_face.extend({
						vertices: old_face.vertices.map(v => new_vertex_keys[old_vertex_keys.indexOf(v)]),
						uv
					})
					original.addFaces(new_face)
				}

				mesh.remove();
				Mesh.selected.remove(mesh)
			})
			updateSelection();
			Undo.finishEdit('Merge meshes')
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
	new Action({
		id: 'add_primitive',
		icon: 'fa-shapes',
		category: 'edit',
		condition: () => (Modes.edit && Format.meshes),
		click() {

			let dialog = new Dialog({
				id: 'add_primitive',
				title: 'action.add_primitive',
				form: {
					shape: {label: 'dialog.add_primitive.shape', type: 'select', options: {
						circle: 'dialog.add_primitive.shape.circle',
						cylinder: 'dialog.add_primitive.shape.cylinder',
						tube: 'dialog.add_primitive.shape.tube',
						cone: 'dialog.add_primitive.shape.cone',
						torus: 'dialog.add_primitive.shape.torus',
						sphere: 'dialog.add_primitive.shape.sphere',
						cube: 'dialog.add_primitive.shape.cube',
						pyramid: 'dialog.add_primitive.shape.pyramid',
					}},
					diameter: {label: 'dialog.add_primitive.diameter', type: 'number', value: 16},
					height: {label: 'dialog.add_primitive.height', type: 'number', value: 8, condition: ({shape}) => ['cylinder', 'cone', 'cube', 'pyramid'].includes(shape)},
					sides: {label: 'dialog.add_primitive.sides', type: 'number', value: 16, condition: ({shape}) => ['cylinder', 'cone', 'circle', 'torus', 'sphere'].includes(shape)},
					minor_diameter: {label: 'dialog.add_primitive.minor_diameter', type: 'number', value: 4, condition: ({shape}) => ['torus'].includes(shape)},
					minor_sides: {label: 'dialog.add_primitive.minor_sides', type: 'number', value: 8, condition: ({shape}) => ['torus'].includes(shape)},
				},
				onConfirm(result) {
					let elements = [];
					Undo.initEdit({elements});
					let mesh = new Mesh({
						name: result.shape,
						vertices: {}
					});

					if (result.shape == 'circle') {
						let vertex_keys = mesh.addVertices([0, 0, 0]);
						let [m] = vertex_keys;

						for (let i = 0; i < result.sides; i++) {
							let x = Math.sin((i / result.sides) * Math.PI * 2) * result.diameter/2;
							let z = Math.cos((i / result.sides) * Math.PI * 2) * result.diameter/2;
							vertex_keys.push(...mesh.addVertices([x, 0, z]));
						}
						for (let i = 0; i < result.sides; i++) {
							let [a, b] = vertex_keys.slice(i+2, i+2 + 2);
							if (!b) {
								b = vertex_keys[2];
							}
							mesh.addFaces(new MeshFace( mesh, {vertices: [a, b, m]} ));
						}
					}
					if (result.shape == 'cone') {
						let vertex_keys = mesh.addVertices([0, 0, 0], [0, result.height, 0]);
						let [m0, m1] = vertex_keys;

						for (let i = 0; i < result.sides; i++) {
							let x = Math.sin((i / result.sides) * Math.PI * 2) * result.diameter/2;
							let z = Math.cos((i / result.sides) * Math.PI * 2) * result.diameter/2;
							vertex_keys.push(...mesh.addVertices([x, 0, z]));
						}
						for (let i = 0; i < result.sides; i++) {
							let [a, b] = vertex_keys.slice(i+2, i+2 + 2);
							if (!b) {
								b = vertex_keys[2];
							}
							mesh.addFaces(
								new MeshFace( mesh, {vertices: [b, a, m0]} ),
								new MeshFace( mesh, {vertices: [a, b, m1]} )
							);
						}
					}
					if (result.shape == 'cylinder') {
						let vertex_keys = mesh.addVertices([0, 0, 0], [0, result.height, 0]);
						let [m0, m1] = vertex_keys;

						for (let i = 0; i < result.sides; i++) {
							let x = Math.sin((i / result.sides) * Math.PI * 2) * result.diameter/2;
							let z = Math.cos((i / result.sides) * Math.PI * 2) * result.diameter/2;
							vertex_keys.push(...mesh.addVertices([x, 0, z], [x, result.height, z]));
						}
						for (let i = 0; i < result.sides; i++) {
							let [a, b, c, d] = vertex_keys.slice(2*i+2, 2*i+2 + 4);
							if (!c) {
								c = vertex_keys[2];
								d = vertex_keys[3];
							}
							mesh.addFaces(
								new MeshFace( mesh, {vertices: [c, a, m0]}),
								new MeshFace( mesh, {vertices: [a, c, d, b]} ),
								new MeshFace( mesh, {vertices: [b, d, m1]} )
							);
						}
					}
					if (result.shape == 'tube') {
						let vertex_keys = [];

						let outer_r = result.diameter/2;
						let inner_r = (result.diameter - result.minor_diameter)/2;
						for (let i = 0; i < result.sides; i++) {
							let x = Math.sin((i / result.sides) * Math.PI * 2);
							let z = Math.cos((i / result.sides) * Math.PI * 2);
							vertex_keys.push(...mesh.addVertices(
								[x * outer_r, 0, z * outer_r],
								[x * outer_r, result.height, z * outer_r],
								[x * inner_r, 0, z * inner_r],
								[x * inner_r, result.height, z * inner_r],
							));
						}
						for (let i = 0; i < result.sides; i++) {
							let [a1, b1, c1, d1, a2, b2, c2, d2] = vertex_keys.slice(4*i, 4*i + 8);
							if (!a2) {
								a2 = vertex_keys[0];
								b2 = vertex_keys[1];
								c2 = vertex_keys[2];
								d2 = vertex_keys[3];
							}
							if (a1 && b1 && c1 && d1 && a2 && b2 && c2 && d2) {
								mesh.addFaces(
									new MeshFace( mesh, {vertices: [a1, a2, b2, b1]} ),
									new MeshFace( mesh, {vertices: [d1, d2, c2, c1]} ),
									new MeshFace( mesh, {vertices: [c1, c2, a2, a1]} ),
									new MeshFace( mesh, {vertices: [b1, b2, d2, d1]} ),
								);
							}
						}
					}
					if (result.shape == 'torus') {
						let rings = [];

						for (let i = 0; i < result.sides; i++) {
							let circle_x = Math.sin((i / result.sides) * Math.PI * 2);
							let circle_z = Math.cos((i / result.sides) * Math.PI * 2);

							let vertices = [];
							for (let j = 0; j < result.minor_sides; j++) {
								let slice_x = Math.sin((j / result.minor_sides) * Math.PI * 2) * result.minor_diameter/2;
								let x = circle_x * (result.diameter/2 + slice_x)
								let y = Math.cos((j / result.minor_sides) * Math.PI * 2) * result.minor_diameter/2;
								let z = circle_z * (result.diameter/2 + slice_x)
								vertices.push(...mesh.addVertices([x, y, z]));
							}
							rings.push(vertices);

						}
						
						for (let i = 0; i < result.sides; i++) {
							let this_ring = rings[i];
							let next_ring = rings[i+1] || rings[0];
							for (let j = 0; j < result.minor_sides; j++) {
								mesh.addFaces(new MeshFace( mesh, {vertices: [
									this_ring[j+1] || this_ring[0],
									next_ring[j+1] || next_ring[0],
									this_ring[j],
									next_ring[j],
								]} ));
							}
						}
					}
					if (result.shape == 'sphere') {
						let rings = [];
						let sides = Math.round(result.sides/2)*2;
						let [bottom] = mesh.addVertices([0, -result.diameter/2, 0]);
						let [top] = mesh.addVertices([0, result.diameter/2, 0]);

						for (let i = 0; i < result.sides; i++) {
							let circle_x = Math.sin((i / result.sides) * Math.PI * 2);
							let circle_z = Math.cos((i / result.sides) * Math.PI * 2);

							let vertices = [];
							for (let j = 1; j < (sides/2); j++) {

								let slice_x = Math.sin((j / sides) * Math.PI * 2) * result.diameter/2;
								let x = circle_x * slice_x
								let y = Math.cos((j / sides) * Math.PI * 2) * result.diameter/2;
								let z = circle_z * slice_x
								vertices.push(...mesh.addVertices([x, y, z]));
							}
							rings.push(vertices);

						}
						
						for (let i = 0; i < result.sides; i++) {
							let this_ring = rings[i];
							let next_ring = rings[i+1] || rings[0];
							for (let j = 0; j < (sides/2); j++) {
								if (j == 0) {
									mesh.addFaces(new MeshFace( mesh, {vertices: [
										this_ring[j],
										next_ring[j],
										top
									]} ));
								} else if (!this_ring[j]) {
									mesh.addFaces(new MeshFace( mesh, {vertices: [
										next_ring[j-1],
										this_ring[j-1],
										bottom
									]} ));
								} else {
									mesh.addFaces(new MeshFace( mesh, {vertices: [
										this_ring[j],
										next_ring[j],
										this_ring[j-1],
										next_ring[j-1],
									]} ));
								}
							}
						}
					}
					if (result.shape == 'cube') {
						let r = result.diameter/2;
						let h = result.height;
						mesh.addVertices([r, h, r], [r, h, -r], [r, 0, r], [r, 0, -r], [-r, h, r], [-r, h, -r], [-r, 0, r], [-r, 0, -r]);
						let vertex_keys = Object.keys(mesh.vertices);
						mesh.addFaces(
							new MeshFace( mesh, {vertices: [vertex_keys[0], vertex_keys[2], vertex_keys[1], vertex_keys[3]]} ), // East
							new MeshFace( mesh, {vertices: [vertex_keys[4], vertex_keys[5], vertex_keys[6], vertex_keys[7]]} ), // West
							new MeshFace( mesh, {vertices: [vertex_keys[0], vertex_keys[1], vertex_keys[4], vertex_keys[5]]} ), // Up
							new MeshFace( mesh, {vertices: [vertex_keys[2], vertex_keys[6], vertex_keys[3], vertex_keys[7]]} ), // Down
							new MeshFace( mesh, {vertices: [vertex_keys[0], vertex_keys[4], vertex_keys[2], vertex_keys[6]]} ), // South
							new MeshFace( mesh, {vertices: [vertex_keys[1], vertex_keys[3], vertex_keys[5], vertex_keys[7]]} ), // North
						);
					}
					if (result.shape == 'pyramid') {
						let r = result.diameter/2;
						let h = result.height;
						mesh.addVertices([0, h, 0], [r, 0, r], [r, 0, -r], [-r, 0, r], [-r, 0, -r]);
						let vertex_keys = Object.keys(mesh.vertices);
						mesh.addFaces(
							new MeshFace( mesh, {vertices: [vertex_keys[1], vertex_keys[3], vertex_keys[2], vertex_keys[4]]} ),	// Down
							new MeshFace( mesh, {vertices: [vertex_keys[1], vertex_keys[2], vertex_keys[0]]} ),	// east
							new MeshFace( mesh, {vertices: [vertex_keys[3], vertex_keys[1], vertex_keys[0]]} ),	// south
							new MeshFace( mesh, {vertices: [vertex_keys[2], vertex_keys[4], vertex_keys[0]]} ),	// north
							new MeshFace( mesh, {vertices: [vertex_keys[4], vertex_keys[3], vertex_keys[0]]} ),	// west
						);
					}
					elements.push(mesh);
					mesh.init()

					Undo.finishEdit('Add primitive');
				}
			}).show()
		}
	})
})