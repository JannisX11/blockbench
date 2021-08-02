class MeshFace {
	constructor(mesh, data, uuid) {
		this.mesh = mesh;
		this.uuid = uuid || guid();
		//this.vertices = [];
		//this.normal = [0, 1, 0];
		this.texture = false;
		this.uv = {};
		for (var key in MeshFace.properties) {
			MeshFace.properties[key].reset(this);
		}
		this.extend(data);
	}
	extend(data) {
		for (var key in MeshFace.properties) {
			MeshFace.properties[key].merge(this, data)
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
}
new Property(MeshFace, 'array', 'vertices', {default: 0});
new Property(MeshFace, 'vector', 'normal', {default: 0});


class Mesh extends OutlinerElement {
	constructor(data, uuid) {
		super(data, uuid)

		this.vertices = {};
		this.faces = {};

		if (!data.vertices) {
			this.addVertices([16, 16, 16], [16, 16, 0], [16, 0, 16], [16, 0, 0], [0, 16, 16], [0, 16, 0], [0, 0, 16], [0, 0, 0]);
			let vertex_keys = Object.keys(this.vertices);
			this.addFaces(new MeshFace( this, {vertices: [vertex_keys[0], vertex_keys[1], vertex_keys[2], vertex_keys[3]]} ));	// East
			//this.addFaces(new MeshFace( this, {vertices: [vertex_keys[4], vertex_keys[5], vertex_keys[6], vertex_keys[7]]} ));	// West
			//this.addFaces(new MeshFace( this, {vertices: [vertex_keys[0], vertex_keys[1], vertex_keys[4], vertex_keys[5]]} ));	// Up
			//this.addFaces(new MeshFace( this, {vertices: [vertex_keys[2], vertex_keys[3], vertex_keys[6], vertex_keys[7]]} ));	// Down
			//this.addFaces(new MeshFace( this, {vertices: [vertex_keys[0], vertex_keys[2], vertex_keys[4], vertex_keys[6]]} ));	// South
			//this.addFaces(new MeshFace( this, {vertices: [vertex_keys[1], vertex_keys[3], vertex_keys[5], vertex_keys[7]]} ));	// North
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
	getWorldCenter() {
		var m = this.mesh;
		var pos = new THREE.Vector3()

		let vertice_list = this.vertice_list;
		vertice_list.forEach(vector => {
			pos.x += vector[0];
			pos.y += vector[1];
			pos.z += vector[2];
		})
		pos.x /= vertice_list.length;
		pos.y /= vertice_list.length;
		pos.z /= vertice_list.length;

		if (m) {
			var r = m.getWorldQuaternion(new THREE.Quaternion())
			pos.applyQuaternion(r)
			pos.add(THREE.fastWorldPosition(m, new THREE.Vector3()))
		}
		return pos;
	}
	addVertices(...vectors) {
		vectors.forEach(vector => {
			let key;
			while (!key || this.vertices[key]) {
				key = bbuid(4);
			}
			this.vertices[key] = [...vector];
		})
	}
	addFaces(...faces) {
		faces.forEach(face => {
			let key;
			while (!key || this.faces[key]) {
				key = bbuid(8);
			}
			this.faces[key] = face;
		})
	}
	extend(object) {
		for (var key in Mesh.properties) {
			Mesh.properties[key].merge(this, object)
		}
		if (typeof object.vertices == 'object') {
			for (let key in object.vertices) {
				this.vertices[key] = object.vertices[key];
			}
		}
		if (typeof object.faces == 'object') {
			for (let key in object.faces) {
				if (this.faces[key]) {
					this.faces[key].extend(object.faces[key])
				} else {
					this.faces[key] = new Face(this, object.faces[key]);
				}
			}
		}
		this.sanitizeName();
		return this;
	}
	get mesh() {
		return Project.nodes_3d[this.uuid];
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
		el.uuid = this.uuid
		return el;
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
				}},
				{icon: 'clear', name: 'menu.cube.texture.transparent', click: function(cube) {
					cube.forSelected(function(obj) {
						obj.applyTexture(null, true)
					}, 'texture transparent')
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
		var mesh = new THREE.Mesh(new THREE.BufferGeometry(1, 1, 1), emptyMaterials[0]);
		Project.nodes_3d[element.uuid] = mesh;
		mesh.name = element.uuid;
		mesh.type = element.type;
		mesh.isElement = true;

		mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(24).fill(1), 1));

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
		let material = new THREE.PointsMaterial({size: 5, sizeAttenuation: false, vertexColors: true});
		let points = new THREE.Points(new THREE.BufferGeometry(), material);
		points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(24).fill(1), 3));
		mesh.vertex_points = points;
		outline.add(points);

		// Update
		this.updateTransform(element);
		this.updateGeometry(element);
		this.updateFaces(element);
		mesh.visible = element.visibility;
		if (Prop.view_mode === 'textured') {
			this.updateUV(element);
		}
	},
	updateGeometry(element) {
		
		let {mesh} = element;
		let position_array = [];
		let position_indices = [];
		let indices = [];
		let outline_positions = [];

		for (let key in element.vertices) {
			let vector = element.vertices[key];
			position_indices.push(key);
			position_array.push(...vector);
		}

		for (let key in element.faces) {
			let face = element.faces[key];
			
			// Test if point "check" is on the other side of the line between "base1" and "base2", compared to "top"
			function test(base1, base2, top, check) {
				base1 = new THREE.Vector3().fromArray(base1);
				base2 = new THREE.Vector3().fromArray(base2);
				top = new THREE.Vector3().fromArray(top);
				check = new THREE.Vector3().fromArray(check);

				// Construct a plane with coplanar points "base1" and "base2" with a normal towards "top"
				let normal = new THREE.Vector3();
				new THREE.Line3(base1, base2).closestPointToPoint(top, false, normal);
				normal.sub(top);
				let plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, base2);
				let distance = plane.distanceToPoint(check);
				return distance > 0;
			}



			if (face.vertices.length == 3) {
				// Tri
				face.vertices.forEach((key, i) => {
					let index = position_indices.indexOf(key);
					indices.push(index);
				})

				// Outline
				face.vertices.forEach((key, i) => {
					outline_positions.push(...element.vertices[key]);
					if (i && i < face.vertices.length-1) outline_positions.push(...element.vertices[key]);
				})

			} else if (face.vertices.length == 4) {

				let sorted_vertices = face.vertices;

				// Quad
				indices.push(position_indices.indexOf(sorted_vertices[0]));
				indices.push(position_indices.indexOf(sorted_vertices[1]));
				indices.push(position_indices.indexOf(sorted_vertices[2]));

				if (test(element.vertices[face.vertices[1]], element.vertices[face.vertices[2]], element.vertices[face.vertices[0]], element.vertices[face.vertices[3]])) {
					sorted_vertices = [face.vertices[2], face.vertices[0], face.vertices[1], face.vertices[3]];

				} else if (test(element.vertices[face.vertices[0]], element.vertices[face.vertices[1]], element.vertices[face.vertices[2]], element.vertices[face.vertices[3]])) {
					sorted_vertices = [face.vertices[0], face.vertices[2], face.vertices[1], face.vertices[3]];

				} else {
					face.vertices.replace([face.vertices[0], face.vertices[1], face.vertices[2], face.vertices[3]]);
				}

				indices.push(position_indices.indexOf(sorted_vertices[0]));
				indices.push(position_indices.indexOf(sorted_vertices[2]));
				indices.push(position_indices.indexOf(sorted_vertices[3]));

				// Outline
				sorted_vertices.forEach((key, i) => {
					outline_positions.push(...element.vertices[key]);
					if (i != 0) outline_positions.push(...element.vertices[key]);
				})
				outline_positions.push(...element.vertices[sorted_vertices[0]]);
			}
		}

		mesh.vertex_points.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(position_array), 3));
		
		mesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(position_array), 3));
		mesh.geometry.setIndex(indices);

		mesh.outline.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(outline_positions), 3));

		mesh.geometry.computeBoundingBox();
		mesh.geometry.computeBoundingSphere();
	},
	updateFaces(element) {
		let {mesh} = element;
		let {geometry} = mesh;

		

		/*
		if (!geometry.all_faces) geometry.all_faces = geometry.groups.slice();
		geometry.groups.empty();

		geometry.all_faces.forEach(face => {
			let bb_face = element.faces[Canvas.face_order[face.materialIndex]];

			if (bb_face && bb_face.texture === null && geometry.groups.includes(face)) {
				geometry.groups.remove(face);
			} else
			if (bb_face && bb_face.texture !== null && !geometry.groups.includes(face)) {
				geometry.groups.push(face);
			}
		})
		if (geometry.groups.length == 0) {
			// Keep down face if no faces enabled
			geometry.groups.push(geometry.all_faces[6], geometry.all_faces[7]);
		}



		if (Prop.view_mode === 'solid') {
			mesh.material = Canvas.solidMaterial
		
		} else if (Prop.view_mode === 'wireframe') {
			mesh.material = Canvas.wireframeMaterial

		} else if (Format.single_texture && Texture.all.length >= 2 && Texture.all.find(t => t.render_mode == 'layered')) {
			mesh.material = Canvas.getLayeredMaterial();

		} else if (Format.single_texture) {
			let tex = Texture.getDefault();
			mesh.material = tex ? tex.getMaterial() : emptyMaterials[element.color];

		} else {
			var materials = []
			Canvas.face_order.forEach(function(face) {

				if (cube.faces[face].texture === null) {
					materials.push(Canvas.transparentMaterial)

				} else {
					var tex = cube.faces[face].getTexture()
					if (tex && tex.uuid) {
						materials.push(Project.materials[tex.uuid])
					} else {
						materials.push(emptyMaterials[cube.color])
					}
				}
			})
			if (materials.allEqual(materials[0])) materials = materials[0];
			mesh.material = materials
		}*/
	},
	updateUV(cube, animation = true) {
		if (Prop.view_mode !== 'textured') return;
		var mesh = cube.mesh
		if (mesh === undefined || !mesh.geometry) return;
		return;

	
		var stretch = 1
		var frame = 0

		Canvas.face_order.forEach((face, fIndex) => {

			if (cube.faces[face].texture == null) return;

			stretch = 1;
			frame = 0;
			let tex = cube.faces[face].getTexture();
			if (tex instanceof Texture && tex.frameCount !== 1) {
				stretch = tex.frameCount
				if (animation === true && tex.currentFrame) {
					frame = tex.currentFrame
				}
			}
			Canvas.updateUVFace(mesh.geometry.attributes.uv, fIndex, cube.faces[face], frame, stretch)
		})

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
				color = gizmo_colors.wire;
			}
			colors.push(color.r, color.g, color.b);
		}
		
		mesh.vertex_points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
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
				main_uv.loadData()
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
})