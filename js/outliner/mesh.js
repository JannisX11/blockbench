class MeshFace extends Face {
	constructor(mesh, data) {
		super(data);
		this.mesh = mesh;
		this.uv = {};
		this.texture = false;
		if (data) {
			this.extend(data);
		}
	}
	extend(data) {
		super.extend(data);
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
		return this;
	}
	getNormal(normalize) {
		let vertices = this.getSortedVertices();
		if (vertices.length < 3) return [0, 0, 0];
		let a = [
			this.mesh.vertices[vertices[1]][0] - this.mesh.vertices[vertices[0]][0],
			this.mesh.vertices[vertices[1]][1] - this.mesh.vertices[vertices[0]][1],
			this.mesh.vertices[vertices[1]][2] - this.mesh.vertices[vertices[0]][2],
		]
		let b = [
			this.mesh.vertices[vertices[2]][0] - this.mesh.vertices[vertices[0]][0],
			this.mesh.vertices[vertices[2]][1] - this.mesh.vertices[vertices[0]][1],
			this.mesh.vertices[vertices[2]][2] - this.mesh.vertices[vertices[0]][2],
		]
		let direction = [
			a[1] * b[2] - a[2] * b[1],
			a[2] * b[0] - a[0] * b[2],
			a[0] * b[1] - a[1] * b[0],
		]
		if (normalize) {
			let length = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2]);
			return direction.map(dir => dir / length || 0);
		} else {
			return direction
		}
	}
	getBoundingRect() {
		let min_x = Project.texture_width, min_y = Project.texture_height, max_x = 0, max_y = 0;
		this.vertices.forEach(vkey => {
			min_x = Math.min(min_x, this.uv[vkey][0]); max_x = Math.max(max_x, this.uv[vkey][0]);
			min_y = Math.min(min_y, this.uv[vkey][1]); max_y = Math.max(max_y, this.uv[vkey][1]);
		})
		return getRectangle(min_x, min_y, max_x, max_y);
	}
	getOccupationMatrix(texture_space = false, start_offset = [0, 0], matrix = {}) {
		let face = this;
		let rect = this.getBoundingRect();
		let texture = texture_space && this.getTexture();
		let sorted_vertices = this.getSortedVertices();
		let factor_x = texture ? (texture.width  / Project.texture_width) : 1;
		let factor_y = texture ? (texture.height / Project.texture_height) : 1;

		if (texture_space && texture) {
			rect.ax *= factor_x;
			rect.ay *= factor_y;
			rect.bx *= factor_x;
			rect.by *= factor_y;
		}
		function vSub(a, b) {
			return [a[0]-b[0], a[1]-b[1]];
		}
		function getSide(a, b) {
			let cosine_sign = a[0]*b[1] - a[1]*b[0];
			if (cosine_sign > 0) return 1;
			if (cosine_sign < 0) return -1;
		}
		function pointInsidePolygon(x, y) {
			let previous_side;
			let i = 0;
			for (let vkey of sorted_vertices) {
				let a = face.uv[vkey];
				let b = face.uv[sorted_vertices[i+1]] || face.uv[sorted_vertices[0]];
				if (factor_x !== 1 || factor_y !== 1) {
					a = a ? [a[0] * factor_x, a[1] * factor_y] : [0, 0];
					b = b ? [b[0] * factor_x, b[1] * factor_y] : [0, 0];
				}

				let affine_segment = vSub(b, a);
				let affine_point = vSub([x, y], a);
				let side = getSide(affine_segment, affine_point);
				if (!side) return false;
				if (!previous_side) previous_side = side;
				if (side !== previous_side) return false;
				i++;
			}
			return true;
		}
		for (let x = Math.floor(rect.ax); x < Math.ceil(rect.bx); x++) {
			for (let y = Math.floor(rect.ay); y < Math.ceil(rect.by); y++) {
				let matrix_x = x-start_offset[0];
				let matrix_y = y-start_offset[1];

				let inside = ( pointInsidePolygon(x+0.00001, y+0.00001)
							|| pointInsidePolygon(x+0.99999, y+0.00001)
							|| pointInsidePolygon(x+0.00001, y+0.99999)
							|| pointInsidePolygon(x+0.99999, y+0.99999));
				if (!inside) {
					let i = 0;
					let px_rect = [[x, y], [x+0.99999, y+0.99999]]
					for (let vkey of sorted_vertices) {
						let vkey_b = sorted_vertices[i+1] || sorted_vertices[0]
						if (pointInRectangle(face.uv[vkey], ...px_rect)) {
							inside = true; break;
						}
						if (lineIntersectsReactangle(face.uv[vkey], face.uv[vkey_b], ...px_rect)) {
							inside = true; break;
						}
						i++;
					}
				}
				if (inside) {
					if (!matrix[matrix_x]) matrix[matrix_x] = {};
					matrix[matrix_x][matrix_y] = true;
				}
			}
		}
		return matrix;
	}
	getAngleTo(other_face) {
		let a = new THREE.Vector3().fromArray(this.getNormal());
		let b = new THREE.Vector3().fromArray(other_face.getNormal());
		return Math.radToDeg(a.angleTo(b));
	}
	invert() {
		if (this.vertices.length < 3) return this;
		[this.vertices[0], this.vertices[1]] = [this.vertices[1], this.vertices[0]];
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
	getAdjacentFace(side_index = 0) {
		let vertices = this.getSortedVertices();
		side_index = side_index % this.vertices.length;
		let side_vertices = [
			vertices[side_index],
			vertices[side_index+1] || vertices[0]
		]
		for (let fkey in this.mesh.faces) {
			let face = this.mesh.faces[fkey];
			if (face === this) continue;
			if (face.vertices.includes(side_vertices[0]) && face.vertices.includes(side_vertices[1])) {
				let f_vertices = face.getSortedVertices();
				let index_a = f_vertices.indexOf(side_vertices[0]);
				let index_b = f_vertices.indexOf(side_vertices[1]);
				if (index_b - index_a == -1 || (index_b - index_a == f_vertices.length-1)) {
					return {
						face,
						key: fkey,
						index: index_b,
						edge: side_vertices
					}
				}
			}
		}
		return null;
	}
	getFaceKey() {
		for (let fkey in this.mesh.faces) {
			if (this.mesh.faces[fkey] == this) return fkey;
		}
	}
	UVToLocal(uv) {
		let p0 = this.uv[this.vertices[0]];
		let p1 = this.uv[this.vertices[1]];
		let p2 = this.uv[this.vertices[2]];

		let vertexa = this.mesh.vertices[this.vertices[0]];
		let vertexb = this.mesh.vertices[this.vertices[1]];
		let vertexc = this.mesh.vertices[this.vertices[2]];

		let b0 = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])
		let b1 = ((p1[0] - uv[0]) * (p2[1] - uv[1]) - (p2[0] - uv[0]) * (p1[1] - uv[1])) / b0
		let b2 = ((p2[0] - uv[0]) * (p0[1] - uv[1]) - (p0[0] - uv[0]) * (p2[1] - uv[1])) / b0
		let b3 = ((p0[0] - uv[0]) * (p1[1] - uv[1]) - (p1[0] - uv[0]) * (p0[1] - uv[1])) / b0

		let local_space = new THREE.Vector3(
			vertexa[0] * b1 + vertexb[0] * b2 + vertexc[0] * b3,
			vertexa[1] * b1 + vertexb[1] * b2 + vertexc[1] * b3,
			vertexa[2] * b1 + vertexb[2] * b2 + vertexc[2] * b3,
		)
		return local_space;	
	}
	localToUV(vector) {
		let va = new THREE.Vector3().fromArray(this.mesh.vertices[this.vertices[0]]);
		let vb = new THREE.Vector3().fromArray(this.mesh.vertices[this.vertices[1]]);
		let vc = new THREE.Vector3().fromArray(this.mesh.vertices[this.vertices[2]]);

		let uva = new THREE.Vector2().fromArray(this.uv[this.vertices[0]]);
		let uvb = new THREE.Vector2().fromArray(this.uv[this.vertices[1]]);
		let uvc = new THREE.Vector2().fromArray(this.uv[this.vertices[2]]);

		let uv = THREE.Triangle.getUV(vector, va, vb, vc, uva, uvb, uvc, new THREE.Vector2());
		return uv.toArray();
	}
	getCenter() {
		let center = [0, 0, 0];
		this.vertices.forEach(vkey => {
			let vertex = this.mesh.vertices[vkey];
			center.V3_add(vertex);
		})
		center.V3_divide(this.vertices.length);
		return center;
	}
}
new Property(MeshFace, 'array', 'vertices', {default: 0});


class Mesh extends OutlinerElement {
	constructor(data, uuid) {
		super(data, uuid)

		this.vertices = {};
		this.faces = {};
		this.seams = {};

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
	setSeam(edge, value) {
		let key = edge.slice(0, 2).sort().join('_');
		if (value) {
			this.seams[key] = value;
		} else {
			delete this.seams[key];
		}
	}
	getSeam(edge) {
		let key = edge.slice(0, 2).sort().join('_');
		return this.seams[key];
	}
	getWorldCenter(ignore_selected_vertices) {
		let m = this.mesh;
		let pos = Reusable.vec1.set(0, 0, 0);
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
			let r = m.getWorldQuaternion(Reusable.quat1);
			pos.applyQuaternion(r);
			pos.add(THREE.fastWorldPosition(m, Reusable.vec2));
		}
		return pos;
	}
	addVertices(...vectors) {
		return vectors.map(vector => {
			let key;
			while (!key || this.vertices[key]) {
				key = bbuid(4);
			}
			this.vertices[key] = [vector[0] || 0, vector[1] || 0, vector[2] || 0];
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
	getUndoCopy(aspects = {}) {
		var copy = new Mesh(this)
		if (aspects.uv_only) {
			copy = {
				faces: copy.faces,
			}
		}
		copy.uuid = this.uuid;
		copy.type = this.type;
		delete copy.parent;
		for (let fkey in copy.faces) {
			delete copy.faces[fkey].mesh;
		}
		return copy;
	}
	getSaveCopy(project) {
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
			el.faces[key] = this.faces[key].getSaveCopy(project);
		}

		el.type = 'mesh';
		el.uuid = this.uuid
		return el;
	}
	getSelectedVertices(make) {
		if (make && !Project.selected_vertices[this.uuid]) Project.selected_vertices[this.uuid] = [];
		return Project.selected_vertices[this.uuid] || [];
	}
	getSelectedFaces() {
		let faces = [];
		for (let key in this.faces) {
			if (this.faces[key].isSelected()) {
				faces.push(key);
			}
		}
		return faces;
	}
	getSelectionRotation() {
		if (Transformer.dragging) {
			return Transformer.rotation_selection;
		}
		let faces = this.getSelectedFaces().map(fkey => this.faces[fkey]);
		if (!faces[0]) {
			let selected_vertices = this.getSelectedVertices();
			this.forAllFaces((face) => {
				let weight = face.vertices.filter(vkey => selected_vertices.includes(vkey)).length;
				if (weight) {
					faces.push({face, weight});
				}
			})
			faces.sort((a, b) => b.weight-a.weight);
			faces = faces.map(f => f.face);
		}
		if (faces[0]) {
			let normal = faces[0].getNormal(true);
			let normal2 = faces[1] && faces[1].getNormal(true);

			if (normal2) {
				let object = new THREE.Object3D();
				object.up.set(...normal);
				object.lookAt(...normal2);
				return object.rotation;

			} else {
				var y = Math.atan2(normal[0], normal[2]);
				var x = Math.atan2(normal[1], Math.sqrt(Math.pow(normal[0], 2) + Math.pow(normal[2], 2)));
				return new THREE.Euler(-x, y, 0, 'YXZ');
			}
		}
		return new THREE.Euler();
	}
	forAllFaces(cb) {
		for (let fkey in this.faces) {
			cb(this.faces[fkey], fkey);
		}
	}
	transferOrigin(origin, update = true) {
		if (!this.mesh) return;
		var q = new THREE.Quaternion().copy(this.mesh.quaternion);
		var shift = new THREE.Vector3(
			this.origin[0] - origin[0],
			this.origin[1] - origin[1],
			this.origin[2] - origin[2],
		)
		shift.applyQuaternion(q.invert());
		shift = shift.toArray();
		
		for (let vkey in this.vertices) {
			this.vertices[vkey].V3_add(shift);
		}
		this.origin.V3_set(origin);

		this.preview_controller.updateTransform(this);
		this.preview_controller.updateGeometry(this);
		return this;
	}
	setColor(index) {
		this.color = index;
		if (this.visibility) {
			this.preview_controller.updateFaces(this);
		}
	}
	roll(axis, steps, origin_arg) {
		function rotateCoord(array, rotation_origin) {
			var a, b;
			array.forEach(function(s, i) {
				if (i == axis) {
					//
				} else {
					if (a == undefined) {
						a = s - rotation_origin[i]
						b = i
					} else {
						array[b] = s - rotation_origin[i]
						array[b] = rotation_origin[b] - array[b]
						array[i] = rotation_origin[i] + a;
					}
				}
			})
			return array
		}
		while (steps > 0) {
			steps--;
			for (let vkey in this.vertices) {
				rotateCoord(this.vertices[vkey], [0, 0, 0]);
			}
			if (origin_arg) {
				rotateCoord(this.origin, origin_arg)
			}
		}
		//Rotations
		var i = 0;
		var temp_rot = undefined;
		var temp_i = undefined;
		while (i < 3) {
			if (i !== axis) {
				if (temp_rot === undefined) {
					temp_rot = this.rotation[i]
					temp_i = i
				} else {
					this.rotation[temp_i] = -this.rotation[i]
					this.rotation[i] = temp_rot
				}
			}
			i++;
		}
		this.preview_controller.updateTransform(this);
		this.preview_controller.updateGeometry(this);
		return this;
	}
	flip(axis, center) {
		let object_mode = BarItems.selection_mode.value == 'object';
		let selected_vertices = this.getSelectedVertices();
		for (let vkey in this.vertices) {
			if (object_mode || selected_vertices.includes(vkey)) {
				this.vertices[vkey][axis] *= -1;
			}
		}
		for (let key in this.faces) {
			if (object_mode || this.faces[key].isSelected()) {
				this.faces[key].invert();
			}
		}

		if (object_mode) {
			this.origin[axis] *= -1;
			this.rotation.forEach((n, i) => {
				if (i != axis) this.rotation[i] = -n;
			})
			this.preview_controller.updateTransform(this);
		}

		this.preview_controller.updateGeometry(this);
		this.preview_controller.updateUV(this);
		return this;
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
	resize(val, axis, negative, allow_negative, bidirectional) {
		let selected_vertices = Project.selected_vertices[this.uuid] || Object.keys(this.vertices);
		let range = [Infinity, -Infinity];
		let {vec1, vec2} = Reusable;
		let rotation_inverted = new THREE.Euler().copy(Transformer.rotation_selection).invert();
		selected_vertices.forEach(key => {
			vec1.fromArray(this.oldVertices[key]).applyEuler(rotation_inverted);
			range[0] = Math.min(range[0], vec1.getComponent(axis));
			range[1] = Math.max(range[1], vec1.getComponent(axis));
		})
		
		let center = bidirectional ? (range[0] + range[1]) / 2 : (negative ? range[1] : range[0]);
		let size = Math.abs(range[1] - range[0]);
		let scale = (size + val * (negative ? -1 : 1) * (bidirectional ? 2 : 1)) / size;
		if (isNaN(scale) || Math.abs(scale) == Infinity) scale = 1;
		if (scale < 0 && !allow_negative) scale = 0;
		
		selected_vertices.forEach(key => {
			vec1.fromArray(this.oldVertices[key]).applyEuler(rotation_inverted);
			vec2.fromArray(this.vertices[key]).applyEuler(rotation_inverted);
			vec2.setComponent(axis, (vec1.getComponent(axis) - center) * scale + center);
			vec2.applyEuler(Transformer.rotation_selection);
			this.vertices[key].replace(vec2.toArray())
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
		this.preview_controller.updateFaces(this);
		this.preview_controller.updateUV(this);
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
		'extrude_mesh_selection',
		'inset_mesh_selection',
		'loop_cut',
		'create_face',
		'invert_face',
		'merge_vertices',
		'dissolve_edges',
		'_',
		'split_mesh',
		'merge_meshes',
		...Outliner.control_menu_group,
		'_',
		'rename',
		{name: 'menu.cube.color', icon: 'color_lens', children() {
			return markerColors.map((color, i) => {return {
				icon: 'bubble_chart',
				color: color.standard,
				name: color.name || 'cube.color.'+color.id,
				click(cube) {
					cube.forSelected(function(obj){
						obj.setColor(i)
					}, 'change color')
				}
			}})
		}},
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
new Property(Mesh, 'boolean', 'locked');

OutlinerElement.registerType(Mesh, 'mesh');

new NodePreviewController(Mesh, {
	setup(element) {
		var mesh = new THREE.Mesh(new THREE.BufferGeometry(1, 1, 1), Canvas.emptyMaterials[0]);
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

		this.dispatchEvent('setup', {element});
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

				let normal = face.getNormal(true);
				normal_array.push(...normal, ...normal, ...normal, ...normal);

				let sorted_vertices = face.getSortedVertices();

				indices.push(face_indices[sorted_vertices[0]]);
				indices.push(face_indices[sorted_vertices[1]]);
				indices.push(face_indices[sorted_vertices[2]]);
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

		mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(outline_positions.length/3).fill(mesh.geometry.attributes.highlight.array[0]), 1));

		mesh.geometry.computeBoundingBox();
		mesh.geometry.computeBoundingSphere();

		mesh.vertex_points.geometry.computeBoundingSphere();
		mesh.outline.geometry.computeBoundingSphere();
		updateCubeHighlights()

		if (Modes.paint) {
			Mesh.preview_controller.updatePaintingGrid(element);
		}

		this.dispatchEvent('update_geometry', {element});
	},
	updateFaces(element) {
		let {mesh} = element;

		if (Project.view_mode === 'solid') {
			mesh.material = Canvas.solidMaterial
		
		} else if (Project.view_mode === 'wireframe') {
			mesh.material = Canvas.wireframeMaterial
		
		} else if (Project.view_mode === 'normal') {
			mesh.material = Canvas.normalHelperMaterial
		
		} else if (Project.view_mode === 'uv') {
			mesh.material = Canvas.uvHelperMaterial

		} else if (Format.single_texture && Texture.all.length >= 2 && Texture.all.find(t => t.render_mode == 'layered')) {
			mesh.material = Canvas.getLayeredMaterial();

		} else if (Format.single_texture) {
			let tex = Texture.getDefault();
			mesh.material = tex ? tex.getMaterial() : Canvas.emptyMaterials[element.color];

		} else {
			var materials = []
			for (let key in element.faces) {
				if (element.faces[key].vertices.length < 3) continue;
				var tex = element.faces[key].getTexture()
				if (tex && tex.uuid) {
					materials.push(Project.materials[tex.uuid])
				} else {
					materials.push(Canvas.emptyMaterials[element.color])
				}
			}
			if (materials.allEqual(materials[0])) materials = materials[0];

			mesh.geometry.groups.empty();
			
			// Generate material groups
			if (materials instanceof Array) {
				let current_mat;
				let i = 0;
				let index = 0;
				let switch_index = 0;
				let reduced_materials = [];

				for (let key in element.faces) {
					if (element.faces[key].vertices.length < 3) continue;
					let face = element.faces[key];
					let material = materials[i];

					if (current_mat != material) {
						if (index) {
							mesh.geometry.addGroup(switch_index, index - switch_index, reduced_materials.length);
							reduced_materials.push(current_mat);
						}
						current_mat = material;
						switch_index = index;
					}

					i++;
					if (face.vertices.length == 3) index += 3;
					if (face.vertices.length == 4) index += 6;
				}
				mesh.geometry.addGroup(switch_index, index - switch_index, reduced_materials.length);
				reduced_materials.push(current_mat);

				materials = reduced_materials;
			}

			mesh.material = materials;
			if (!mesh.material) mesh.material = Canvas.transparentMaterial;
		}

		this.dispatchEvent('update_faces', {element});
	},
	updateUV(element, animation = true) {
		var {mesh} = element;
		if (mesh === undefined || !mesh.geometry) return;
		let uv_array = [];

		for (let key in element.faces) {
			let face = element.faces[key];
			if (face.vertices.length <= 2) continue;

			face.vertices.forEach((key, i) => {
				uv_array.push(
					  ((face.uv[key] ? face.uv[key][0] : 0) / Project.texture_width),
					1-((face.uv[key] ? face.uv[key][1] : 0) / Project.texture_height)
				)
			})
		}

		mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv_array), 2)), 
		mesh.geometry.attributes.uv.needsUpdate = true;

		this.dispatchEvent('update_uv', {element});

		return mesh.geometry;
	},
	updateSelection(element) {
		NodePreviewController.prototype.updateSelection(element);
	
		let mesh = element.mesh;
		let white = new THREE.Color(0xffffff);
		let join = new THREE.Color(0x16d606);
		let divide = new THREE.Color(0xff4400);
		let join_selected = new THREE.Color(0x6bffcb);
		let divide_selected = new THREE.Color(0xff8c69);
		let selected_vertices = element.getSelectedVertices();

		if (BarItems.selection_mode.value == 'vertex') {
			let colors = [];
			for (let key in element.vertices) {
				let color;
				if (selected_vertices.includes(key)) {
					color = white;
				} else {
					color = gizmo_colors.grid;
				}
				colors.push(color.r, color.g, color.b);
			}
			mesh.vertex_points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
			mesh.outline.geometry.needsUpdate = true;
		}

		let line_colors = [];
		mesh.outline.vertex_order.forEach((key, i) => {
			let key_b = Modes.edit && mesh.outline.vertex_order[i + ((i%2) ? -1 : 1) ];
			let color;
			let selected;
			if (!Modes.edit || BarItems.selection_mode.value == 'object') {
				color = gizmo_colors.outline;
			} else if (selected_vertices.includes(key) && selected_vertices.includes(key_b)) {
				color = white;
				selected = true;
			} else {
				color = gizmo_colors.grid;
			}
			if (Toolbox.selected.id === 'seam_tool') {
				let seam = element.getSeam([key, key_b]);
				if (selected) {
					if (seam == 'join') color = join_selected;
					if (seam == 'divide') color = divide_selected;
				} else {
					if (seam == 'join') color = join;
					if (seam == 'divide') color = divide;
				}
			}
			line_colors.push(color.r, color.g, color.b);
		})
		mesh.outline.geometry.setAttribute('color', new THREE.Float32BufferAttribute(line_colors, 3));
		mesh.outline.geometry.needsUpdate = true;
		
		mesh.vertex_points.visible = Mode.selected.id == 'edit' && BarItems.selection_mode.value == 'vertex';

		this.dispatchEvent('update_selection', {element});
	},
	updateHighlight(element, hover_cube, force_off) {
		var mesh = element.mesh;
		let highlighted = (
			Settings.get('highlight_cubes') &&
			((hover_cube == element && !Transformer.dragging) || element.selected) &&
			Modes.edit &&
			!force_off
		) ? 1 : 0;

		let array = new Array(mesh.geometry.attributes.highlight.count).fill(highlighted);
		
		if (!force_off && element.selected && Modes.edit) {
			let i = 0;
			for (let fkey in element.faces) {
				let face = element.faces[fkey];
				if (face.vertices.length < 3) continue;
				if (face.isSelected()) {
					for (let j = 0; j < face.vertices.length; j++) {
						array[i] = 2;
						i++;
					}
				} else {
					i += face.vertices.length;
				}
			}
		}

		mesh.geometry.attributes.highlight.array.set(array);
		mesh.geometry.attributes.highlight.needsUpdate = true;

		this.dispatchEvent('update_highlight', {element});
	},
	updatePaintingGrid(element) {
		var mesh = element.mesh;
		if (mesh === undefined) return;
		mesh.remove(mesh.grid_box);
		if (element.visibility == false) return;

		if (!Modes.paint || !settings.painting_grid.value) return;

		var positions = [];

		for (let fkey in element.faces) {
			let face = element.faces[fkey];
			if (face.vertices.length <= 2) continue;
			let offset = face.getNormal(true).V3_multiply(0.01);
			let x_memory = {};
			let y_memory = {};
			let texture = face.getTexture();
			var psize_x = texture ? Project.texture_width / texture.width : 1;
			var psize_y = texture ? Project.texture_height / texture.height : 1;
			let vertices = face.getSortedVertices();
			vertices.forEach((vkey1, i) => {
				let vkey2 = vertices[i+1] || vertices[0];
				let uv1 = face.uv[vkey1].slice();
				let uv2 = face.uv[vkey2].slice();
				let range_x = (uv1[0] > uv2[0]) ? [uv2[0], uv1[0]] : [uv1[0], uv2[0]];
				let range_y = (uv1[1] > uv2[1]) ? [uv2[1], uv1[1]] : [uv1[1], uv2[1]];

				for (let x = Math.ceil(range_x[0] / psize_x) * psize_x; x < range_x[1]; x += psize_x) {
					if (!x_memory[x]) x_memory[x] = [];
					let y = uv1[1] + (uv2[1] - uv1[1]) * Math.getLerp(uv1[0], uv2[0], x);
					x_memory[x].push(face.UVToLocal([x, y]).toArray().V3_add(offset));
				}
				for (let y = Math.ceil(range_y[0] / psize_y) * psize_y; y < range_y[1]; y += psize_y) {
					if (!y_memory[y]) y_memory[y] = [];
					let x = uv1[0] + (uv2[0] - uv1[0]) * Math.getLerp(uv1[1], uv2[1], y);
					y_memory[y].push(face.UVToLocal([x, y]).toArray().V3_add(offset));
				}
			})

			for (let key in x_memory) {
				let points = x_memory[key];
				if (points.length == 2) {
					positions.push(...points[0], ...points[1]);
				}
			}
			for (let key in y_memory) {
				let points = y_memory[key];
				if (points.length == 2) {
					positions.push(...points[0], ...points[1]);
				}
			}
		}

		var geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );

		let box = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color: gizmo_colors.grid}));
		box.no_export = true;

		box.name = element.uuid+'_grid_box';
		box.renderOrder = 2;
		box.frustumCulled = false;
		mesh.grid_box = box;
		mesh.add(box);

		this.dispatchEvent('update_painting_grid', {element});
	}
})

BARS.defineActions(function() {
	let add_mesh_dialog = new Dialog({
		id: 'add_primitive',
		title: 'action.add_mesh',
		form: {
			shape: {label: 'dialog.add_primitive.shape', type: 'select', options: {
				cube: 'dialog.add_primitive.shape.cube',
				pyramid: 'dialog.add_primitive.shape.pyramid',
				plane: 'dialog.add_primitive.shape.plane',
				circle: 'dialog.add_primitive.shape.circle',
				cylinder: 'dialog.add_primitive.shape.cylinder',
				tube: 'dialog.add_primitive.shape.tube',
				cone: 'dialog.add_primitive.shape.cone',
				sphere: 'dialog.add_primitive.shape.sphere',
				torus: 'dialog.add_primitive.shape.torus',
			}},
			diameter: {label: 'dialog.add_primitive.diameter', type: 'number', value: 16},
			height: {label: 'dialog.add_primitive.height', type: 'number', value: 8, condition: ({shape}) => ['cylinder', 'cone', 'cube', 'pyramid', 'tube'].includes(shape)},
			sides: {label: 'dialog.add_primitive.sides', type: 'number', value: 12, min: 3, max: 48, condition: ({shape}) => ['cylinder', 'cone', 'circle', 'torus', 'sphere', 'tube'].includes(shape)},
			minor_diameter: {label: 'dialog.add_primitive.minor_diameter', type: 'number', value: 4, condition: ({shape}) => ['torus', 'tube'].includes(shape)},
			minor_sides: {label: 'dialog.add_primitive.minor_sides', type: 'number', value: 8, min: 2, max: 32, condition: ({shape}) => ['torus'].includes(shape)},
		},
		onConfirm(result) {
			let original_selection_group = Group.selected && Group.selected.uuid;
			function runEdit(amended, result) {
				let elements = [];
				if (original_selection_group && !Group.selected) {
					let group_to_select = Group.all.find(g => g.uuid == original_selection_group);
					if (group_to_select) {
						Group.selected = group_to_select;
					}
				}
				Undo.initEdit({elements, selection: true}, amended);
				let mesh = new Mesh({
					name: result.shape,
					vertices: {}
				});
				var group = getCurrentGroup();
				mesh.addTo(group)

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
						if (!a) {
							b = vertex_keys[2];
							a = vertex_keys[1];
						} else if (!b) {
							b = vertex_keys[1];
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
					let inner_r = outer_r - result.minor_diameter;
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
				if (result.shape == 'plane') {
					let r = result.diameter/2;
					mesh.addVertices([r, 0, r], [r, 0, -r], [-r, 0, r], [-r, 0, -r]);
					let vertex_keys = Object.keys(mesh.vertices);
					mesh.addFaces(
						new MeshFace( mesh, {vertices: [vertex_keys[0], vertex_keys[1], vertex_keys[3], vertex_keys[2]]} )
					);
				}
				
				if (Texture.all.length && Format.single_texture) {
					for (var face in mesh.faces) {
						mesh.faces[face].texture = Texture.getDefault().uuid
					}
					UVEditor.loadData()
				}
				if (Format.bone_rig) {
					if (group) {
						var pos1 = group.origin.slice()
						mesh.extend({
							origin: pos1.slice()
						})
					}
				}

				elements.push(mesh);
				mesh.init()
				if (Group.selected) Group.selected.unselect()
				mesh.select()
				UVEditor.setAutoSize(null, true, Object.keys(mesh.faces));
				UVEditor.selected_faces.empty();
				Undo.finishEdit('Add primitive');
				Blockbench.dispatchEvent( 'add_mesh', {object: mesh} )

				Vue.nextTick(function() {
					if (settings.create_rename.value) {
						mesh.rename()
					}
				})
			}
			runEdit(false, result);

			Undo.amendEdit({
				diameter: {label: 'dialog.add_primitive.diameter', type: 'number', value: result.diameter},
				height: {label: 'dialog.add_primitive.height', type: 'number', value: result.height, condition: ['cylinder', 'cone', 'cube', 'pyramid', 'tube'].includes(result.shape)},
				sides: {label: 'dialog.add_primitive.sides', type: 'number', value: result.sides, min: 3, max: 48, condition: ['cylinder', 'cone', 'circle', 'torus', 'sphere', 'tube'].includes(result.shape)},
				minor_diameter: {label: 'dialog.add_primitive.minor_diameter', type: 'number', value: result.minor_diameter, condition: ['torus', 'tube'].includes(result.shape)},
				minor_sides: {label: 'dialog.add_primitive.minor_sides', type: 'number', value: result.minor_sides, min: 2, max: 32, condition: ['torus'].includes(result.shape)},
			}, form => {
				Object.assign(result, form);
				runEdit(true, result);
			})
		}
	})

	new Action('add_mesh', {
		icon: 'fa-gem',
		category: 'edit',
		condition: {modes: ['edit'], method: () => (Format.meshes)},
		click: function () {
			add_mesh_dialog.show();
		}
	})
	new BarSelect('selection_mode', {
		options: {
			object: {name: true, icon: 'far.fa-gem'},
			face: {name: true, icon: 'crop_portrait'},
			edge: {name: true, icon: 'fa-grip-lines-vertical'},
			vertex: {name: true, icon: 'fiber_manual_record'},
		},
		icon_mode: true,
		condition: () => Modes.edit && Mesh.all.length,
		onChange({value}) {
			if (value === 'object') {
				Mesh.selected.forEach(mesh => {
					delete Project.selected_vertices[mesh.uuid];
				})
			} else if (value === 'face') {
				UVEditor.vue.selected_faces.empty();
				Mesh.selected.forEach(mesh => {
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						if (face.isSelected()) {
							UVEditor.vue.selected_faces.safePush(fkey);
						}
					}
				})
			}
			updateSelection();
		}
	})
	
	let seam_timeout;
	new Tool('seam_tool', {
		icon: 'content_cut',
		transformerMode: 'hidden',
		toolbar: 'seam_tool',
		category: 'tools',
		selectElements: true,
		modes: ['edit'],
		condition: () => Modes.edit && Mesh.all.length,
		onCanvasClick(data) {
			if (!seam_timeout) {
				seam_timeout = setTimeout(() => {
					seam_timeout = null;
				}, 200)
			} else {
				clearTimeout(seam_timeout);
				seam_timeout = null;
				BarItems.select_seam.trigger();
			}
		},
		onSelect: function() {
			BarItems.selection_mode.set('edge');
			BarItems.view_mode.set('solid');
			BarItems.view_mode.onChange();
		},
		onUnselect: function() {
			BarItems.selection_mode.set('object');
			BarItems.view_mode.set('textured');
			BarItems.view_mode.onChange();
		}
	})
	new BarSelect('select_seam', {
		options: {
			auto: true,
			divide: true,
			join: true,
		},
		condition: () => Modes.edit && Mesh.all.length,
		onChange({value}) {
			if (value == 'auto') value = null;
			Undo.initEdit({elements: Mesh.selected});
			Mesh.selected.forEach(mesh => {
				let selected_vertices = mesh.getSelectedVertices();
				mesh.forAllFaces((face) => {
					let vertices = face.getSortedVertices();
					vertices.forEach((vkey_a, i) => {
						let vkey_b = vertices[i+1] || vertices[0];
						if (selected_vertices.includes(vkey_a) && selected_vertices.includes(vkey_b)) {
							mesh.setSeam([vkey_a, vkey_b], value);
						}
					})
				});
				Mesh.preview_controller.updateSelection(mesh);
			})
			Undo.finishEdit('Set mesh seam');
		}
	})
	new Action('create_face', {
		icon: 'fas.fa-draw-polygon',
		category: 'edit',
		keybind: new Keybind({key: 'f', shift: true}),
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length > 1)},
		click() {
			let vec1 = new THREE.Vector3(),
				vec2 = new THREE.Vector3(),
				vec3 = new THREE.Vector3(),
				vec4 = new THREE.Vector3();
			Undo.initEdit({elements: Mesh.selected});
			let faces_to_autouv = [];
			Mesh.selected.forEach(mesh => {
				UVEditor.selected_faces.empty();
				let selected_vertices = mesh.getSelectedVertices();
				if (selected_vertices.length >= 2 && selected_vertices.length <= 4) {
					let reference_face;
					let reference_face_strength = 0;
					for (let key in mesh.faces) {
						let face = mesh.faces[key];
						let match_strength = face.vertices.filter(vkey => selected_vertices.includes(vkey)).length;
						if (match_strength > reference_face_strength) {
							reference_face = face;
							reference_face_strength = match_strength;
						}
						if (face.isSelected()) {
							delete mesh.faces[key];
						}
					}
					// Split face
					if (
						(selected_vertices.length == 2 || selected_vertices.length == 3) &&
						reference_face.vertices.length == 4 &&
						reference_face.vertices.filter(vkey => selected_vertices.includes(vkey)).length == selected_vertices.length
					) {

						let sorted_vertices = reference_face.getSortedVertices();
						let unselected_vertices = sorted_vertices.filter(vkey => !selected_vertices.includes(vkey));

						let side_index_diff = Math.abs(sorted_vertices.indexOf(selected_vertices[0]) - sorted_vertices.indexOf(selected_vertices[1]));
						if (side_index_diff != 1 || selected_vertices.length == 3) {

							let new_face = new MeshFace(mesh, reference_face);
							
							new_face.vertices.remove(unselected_vertices[0]);
							delete new_face.uv[unselected_vertices[0]];

							let reference_corner_vertex = unselected_vertices[1]
								|| sorted_vertices[sorted_vertices.indexOf(unselected_vertices[0]) + 2]
								|| sorted_vertices[sorted_vertices.indexOf(unselected_vertices[0]) - 2];
							reference_face.vertices.remove(reference_corner_vertex);
							delete reference_face.uv[reference_corner_vertex];

							let [face_key] = mesh.addFaces(new_face);
							UVEditor.selected_faces.push(face_key);


							if (reference_face.getAngleTo(new_face) > 90) {
								new_face.invert();
							}
						}

					} else {
						
						let new_face = new MeshFace(mesh, {
							vertices: selected_vertices,
							texture: reference_face.texture,
						} );
						let [face_key] = mesh.addFaces(new_face);
						UVEditor.selected_faces.push(face_key);
						faces_to_autouv.push(face_key);

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
				} else if (selected_vertices.length > 4) {
					let reference_face;
					for (let key in mesh.faces) {
						let face = mesh.faces[key];
						if (!reference_face && face.vertices.find(vkey => selected_vertices.includes(vkey))) {
							reference_face = face;
						}
					}
					let vertices = selected_vertices.slice();
					let v1 = vec1.fromArray(mesh.vertices[vertices[1]].slice().V3_subtract(mesh.vertices[vertices[0]]));
					let v2 = vec2.fromArray(mesh.vertices[vertices[2]].slice().V3_subtract(mesh.vertices[vertices[0]]));
					let normal = v2.cross(v1);
					let plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
						normal,
						new THREE.Vector3().fromArray(mesh.vertices[vertices[0]])
					)
					let center = [0, 0];
					let vertex_uvs = {};
					vertices.forEach((vkey) => {
						let coplanar_pos = plane.projectPoint(vec3.fromArray(mesh.vertices[vkey]), vec4);
						let q = Reusable.quat1.setFromUnitVectors(normal, THREE.NormalY)
						coplanar_pos.applyQuaternion(q);
						vertex_uvs[vkey] = [
							Math.roundTo(coplanar_pos.x, 4),
							Math.roundTo(coplanar_pos.z, 4),
						]
						center[0] += vertex_uvs[vkey][0];
						center[1] += vertex_uvs[vkey][1];
					})
					center[0] /= vertices.length;
					center[1] /= vertices.length;

					vertices.forEach(vkey => {
						vertex_uvs[vkey][0] -= center[0];
						vertex_uvs[vkey][1] -= center[1];
						vertex_uvs[vkey][2] = Math.atan2(vertex_uvs[vkey][0], vertex_uvs[vkey][1]);
					})
					vertices.sort((a, b) => vertex_uvs[a][2] - vertex_uvs[b][2]);

					let start_index = 0;
					while (start_index < vertices.length) {
						let face_vertices = vertices.slice(start_index, start_index+4);
						vertices.push(face_vertices[0]);
						let new_face = new MeshFace(mesh, {vertices: face_vertices, texture: reference_face.texture});
						let [face_key] = mesh.addFaces(new_face);
						UVEditor.selected_faces.push(face_key);

						if (face_vertices.length < 4) break;
						start_index += 3;
					}
				}
			})
			UVEditor.setAutoSize(null, true, faces_to_autouv);
			Undo.finishEdit('Create mesh face')
			Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
	new Action('convert_to_mesh', {
		icon: 'fa-gem',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Cube.selected.length)},
		click() {
			Undo.initEdit({elements: Cube.selected});

			let new_meshes = [];
			Cube.selected.forEach(cube => {
				
				let mesh = new Mesh({
					name: cube.name,
					color: cube.color,
					origin: cube.origin,
					rotation: cube.rotation,
					vertices: [
						[cube.to[0] + cube.inflate - cube.origin[0],	cube.to[1] + cube.inflate - cube.origin[1], 	cube.to[2] + cube.inflate - cube.origin[2]],
						[cube.to[0] + cube.inflate - cube.origin[0],	cube.to[1] + cube.inflate - cube.origin[1], 	cube.from[2] - cube.inflate - cube.origin[2]],
						[cube.to[0] + cube.inflate - cube.origin[0],	cube.from[1] - cube.inflate - cube.origin[1], 	cube.to[2] + cube.inflate - cube.origin[2]],
						[cube.to[0] + cube.inflate - cube.origin[0],	cube.from[1] - cube.inflate - cube.origin[1], 	cube.from[2] - cube.inflate - cube.origin[2]],
						[cube.from[0] - cube.inflate - cube.origin[0],	cube.to[1] + cube.inflate - cube.origin[1], 	cube.to[2] + cube.inflate - cube.origin[2]],
						[cube.from[0] - cube.inflate - cube.origin[0],	cube.to[1] + cube.inflate - cube.origin[1], 	cube.from[2] - cube.inflate - cube.origin[2]],
						[cube.from[0] - cube.inflate - cube.origin[0],	cube.from[1] - cube.inflate - cube.origin[1], 	cube.to[2] + cube.inflate - cube.origin[2]],
						[cube.from[0] - cube.inflate - cube.origin[0],	cube.from[1] - cube.inflate - cube.origin[1], 	cube.from[2] - cube.inflate - cube.origin[2]],
					],
				})

				let vertex_keys = Object.keys(mesh.vertices);
				let unused_vkeys = vertex_keys.slice();
				function addFace(direction, vertices) {
					let cube_face = cube.faces[direction];
					if (cube_face.texture === null) return;
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
					vertices.forEach(vkey => unused_vkeys.remove(vkey));
				}
				addFace('east', [vertex_keys[1], vertex_keys[0], vertex_keys[3], vertex_keys[2]]);
				addFace('west', [vertex_keys[4], vertex_keys[5], vertex_keys[6], vertex_keys[7]]);
				addFace('up', [vertex_keys[1], vertex_keys[5], vertex_keys[0], vertex_keys[4]]); // 4 0 5 1
				addFace('down', [vertex_keys[2], vertex_keys[6], vertex_keys[3], vertex_keys[7]]);
				addFace('south', [vertex_keys[0], vertex_keys[4], vertex_keys[2], vertex_keys[6]]);
				addFace('north', [vertex_keys[5], vertex_keys[1], vertex_keys[7], vertex_keys[3]]);

				unused_vkeys.forEach(vkey => {
					delete mesh.vertices[vkey];
				})

				mesh.sortInBefore(cube).init();
				new_meshes.push(mesh);
				cube.remove();
			})
			Undo.finishEdit('Convert cubes to meshes', {elements: new_meshes});
		}
	})
	new Action('invert_face', {
		icon: 'flip_to_back',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedFaces().length)},
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
	new Action('extrude_mesh_selection', {
		icon: 'upload',
		category: 'edit',
		keybind: new Keybind({key: 'e', shift: true}),
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length)},
		click() {
			function runEdit(amended, extend = 1) {
				Undo.initEdit({elements: Mesh.selected, selection: true}, amended);

				Mesh.selected.forEach(mesh => {
					let original_vertices = Project.selected_vertices[mesh.uuid].slice();
					let new_vertices;
					let new_face_keys = [];
					let selected_faces = [];
					let selected_face_keys = [];
					let combined_direction;
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey]; 
						if (face.isSelected()) {
							selected_faces.push(face);
							selected_face_keys.push(fkey);
						}
					}

					if (original_vertices.length >= 3 && !selected_faces.length) {
						let [a, b, c] = original_vertices.slice(0, 3).map(vkey => mesh.vertices[vkey].slice());
						let normal = new THREE.Vector3().fromArray(a.V3_subtract(c));
						normal.cross(new THREE.Vector3().fromArray(b.V3_subtract(c))).normalize();

						let face;
						for (let fkey in mesh.faces) {
							if (mesh.faces[fkey].vertices.filter(vkey => original_vertices.includes(vkey)).length >= 2 && mesh.faces[fkey].vertices.length > 2) {
								face = mesh.faces[fkey];
								break;
							}
						}
						if (face) {
							let selected_corner = mesh.vertices[face.vertices.find(vkey => original_vertices.includes(vkey))];
							let opposite_corner = mesh.vertices[face.vertices.find(vkey => !original_vertices.includes(vkey))];
							let face_geo_dir = opposite_corner.slice().V3_subtract(selected_corner);
							if (Reusable.vec1.fromArray(face_geo_dir).angleTo(normal) < 1) {
								normal.negate();
							}
						}

						combined_direction = normal.toArray();
					}

					new_vertices = mesh.addVertices(...original_vertices.map(key => {
						let vector = mesh.vertices[key].slice();
						let direction;
						let count = 0;
						selected_faces.forEach(face => {
							if (face.vertices.includes(key)) {
								count++;
								if (!direction) {
									direction = face.getNormal(true);
								} else {
									direction.V3_add(face.getNormal(true));
								}
							}
						})
						if (count > 1) {
							direction.V3_divide(count);
						}
						if (!direction) {
							let match;
							let match_level = 0;
							let match_count = 0;
							for (let key in mesh.faces) {
								let face = mesh.faces[key]; 
								let matches = face.vertices.filter(vkey => original_vertices.includes(vkey));
								if (match_level < matches.length) {
									match_level = matches.length;
									match_count = 1;
									match = face;
								} else if (match_level === matches.length) {
									match_count++;
								}
								if (match_level == 3) break;
							}
							
							if (match_level < 3 && match_count > 2 && original_vertices.length > 2) {
								// If multiple faces connect to the line, there is no point in choosing one for the normal
								// Instead, construct the normal between the first 2 selected vertices
								direction = combined_direction;

							} else if (match) {
								direction = match.getNormal(true);
							}
						}

						vector.V3_add(direction.map(v => v * extend));
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

							let new_face = new MeshFace(mesh, mesh.faces[selected_face_keys[face_index]]).extend({
								vertices: [
									b,
									a,
									original_vertices[new_vertices.indexOf(a)],
									original_vertices[new_vertices.indexOf(b)],
								]
							});
							let [face_key] = mesh.addFaces(new_face);
							new_face_keys.push(face_key);
							remaining_vertices.remove(a);
							remaining_vertices.remove(b);
						})

						if (vertices.length == 2) delete mesh.faces[selected_face_keys[face_index]];
					})

					// Create Face between extruded line
					let line_vertices = remaining_vertices.slice();
					let covered_edges = [];
					let new_faces = [];
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						let sorted_vertices = face.getSortedVertices();
						let matched_vertices = sorted_vertices.filter(vkey => line_vertices.includes(new_vertices[original_vertices.indexOf(vkey)]));
						if (matched_vertices.length >= 2) {
							let already_handled_edge = covered_edges.find(edge => edge.includes(matched_vertices[0]) && edge.includes(matched_vertices[1]))
							if (already_handled_edge) {
								let handled_face = new_faces[covered_edges.indexOf(already_handled_edge)]
								if (handled_face) handled_face.invert();
								continue;
							}
							covered_edges.push(matched_vertices.slice(0, 2));

							if (sorted_vertices[0] == matched_vertices[0] && sorted_vertices[1] != matched_vertices[1]) {
								matched_vertices.reverse();
							}
							let [a, b] = matched_vertices.map(vkey => new_vertices[original_vertices.indexOf(vkey)]);
							let [c, d] = matched_vertices;
							let new_face = new MeshFace(mesh, face).extend({
								vertices: [a, b, c, d]
							});
							let [face_key] = mesh.addFaces(new_face);
							new_face_keys.push(face_key);
							new_faces.push(new_face);
							remaining_vertices.remove(a);
							remaining_vertices.remove(b);
						}
					}

					// Create line between points
					remaining_vertices.forEach(a => {
						let b = original_vertices[new_vertices.indexOf(a)]
						let b_in_face = false;
						mesh.forAllFaces(face => {
							if (face.vertices.includes(b)) b_in_face = true;
						})
						if (selected_faces.find(f => f.vertices.includes(a)) && !b_in_face) {
							// Remove line if in the middle of other faces
							delete mesh.vertices[b];
						} else {
							let new_face = new MeshFace(mesh, {
								vertices: [b, a]
							});
							mesh.addFaces(new_face);
						}
					})

					UVEditor.setAutoSize(null, true, new_face_keys);
				})
				Undo.finishEdit('Extrude mesh selection');
				Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true});
			}
			runEdit();

			Undo.amendEdit({
				extend: {type: 'number', value: 1, label: 'edit.extrude_mesh_selection.extend'},
			}, form => {
				runEdit(true, form.extend);
			})
		}
	})
	new Action('inset_mesh_selection', {
		icon: 'fa-compress-arrows-alt',
		category: 'edit',
		keybind: new Keybind({key: 'i', shift: true}),
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length >= 3)},
		click() {
			function runEdit(amended, offset = 50) {
				Undo.initEdit({elements: Mesh.selected, selection: true}, amended);
				Mesh.selected.forEach(mesh => {
					let original_vertices = Project.selected_vertices[mesh.uuid].slice();
					if (original_vertices.length < 3) return;
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
	
					new_vertices = mesh.addVertices(...original_vertices.map(vkey => {
						let vector = mesh.vertices[vkey].slice();
						affected_faces = selected_faces.filter(face => {
							return face.vertices.includes(vkey)
						})
						if (affected_faces.length == 0) return;
						let inset = [0, 0, 0];
						if (affected_faces.length == 3 || affected_faces.length == 1) {
							affected_faces.sort((a, b) => {
								let ax = 0;
								a.vertices.forEach(vkey => {
									ax += affected_faces.filter(face => face.vertices.includes(vkey)).length;
								})
								let bx = 0;
								b.vertices.forEach(vkey => {
									bx += affected_faces.filter(face => face.vertices.includes(vkey)).length;
								})
								return bx - ax;
							})
							affected_faces[0].vertices.forEach(vkey2 => {
								inset.V3_add(mesh.vertices[vkey2]);
							})
							inset.V3_divide(affected_faces[0].vertices.length);
							vector = vector.map((v, i) => Math.lerp(v, inset[i], offset/100));
						}
						if (affected_faces.length == 2) {
							let vkey2 = affected_faces[0].vertices.find(_vkey => _vkey != vkey && affected_faces[1].vertices.includes(_vkey));
							
							vector = vector.map((v, i) => Math.lerp(v, mesh.vertices[vkey2][i], offset/200));
						}
						return vector;
					}).filter(vec => vec instanceof Array))
					if (!new_vertices.length) return;
	
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
	
							let new_face = new MeshFace(mesh, mesh.faces[selected_face_keys[face_index]]).extend({
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
						let b = original_vertices[new_vertices.indexOf(a)];
						for (let fkey in mesh.faces) {
							let face = mesh.faces[fkey];
							if (face.vertices.includes(b)) {
								face.vertices.splice(face.vertices.indexOf(b), 1, a);
								face.uv[a] = face.uv[b];
								delete face.uv[b];
							}
						}
						delete mesh.vertices[b];
					})

				})
				Undo.finishEdit('Extrude mesh selection')
				Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
			}
			runEdit();

			Undo.amendEdit({
				offset: {type: 'number', value: 50, label: 'edit.loop_cut.offset', min: 0, max: 100},
			}, form => {
				runEdit(true, form.offset);
			})
		}
	})
	new Action('loop_cut', {
		icon: 'carpenter',
		category: 'edit',
		keybind: new Keybind({key: 'r', shift: true}),
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length > 1)},
		click() {
			function runEdit(amended, offset = 50, direction = 0) {
				Undo.initEdit({elements: Mesh.selected, selection: true}, amended);
				Mesh.selected.forEach(mesh => {
					let selected_vertices = mesh.getSelectedVertices();
					let start_face;
					let start_face_quality = 1;
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						if (face.vertices.length < 2) continue;
						let vertices = face.vertices.filter(vkey => selected_vertices.includes(vkey))
						if (vertices.length > start_face_quality) {
							start_face = face;
							start_face_quality = vertices.length;
						}
					}
					if (!start_face) return;
					let processed_faces = [start_face];
					let center_vertices = {};

					function getCenterVertex(vertices) {
						let existing_key = center_vertices[vertices[0]] || center_vertices[vertices[1]];
						if (existing_key) return existing_key;

						let vector = mesh.vertices[vertices[0]].map((v, i) => Math.lerp(v, mesh.vertices[vertices[1]][i], offset/100))
						let [vkey] = mesh.addVertices(vector);
						center_vertices[vertices[0]] = center_vertices[vertices[1]] = vkey;
						return vkey;
					}

					function splitFace(face, side_vertices, double_side) {
						processed_faces.push(face);
						let sorted_vertices = face.getSortedVertices();

						let side_index_diff = sorted_vertices.indexOf(side_vertices[0]) - sorted_vertices.indexOf(side_vertices[1]);
						if (side_index_diff == -1 || side_index_diff > 2) side_vertices.reverse();

						if (face.vertices.length == 4) {

							let opposite_vertices = sorted_vertices.filter(vkey => !side_vertices.includes(vkey));
							let opposite_index_diff = sorted_vertices.indexOf(opposite_vertices[0]) - sorted_vertices.indexOf(opposite_vertices[1]);
							if (opposite_index_diff == 1 || opposite_index_diff < -2) opposite_vertices.reverse();

							let center_vertices = [
								getCenterVertex(side_vertices),
								getCenterVertex(opposite_vertices)
							]

							let c1_uv_coords = [
								Math.lerp(face.uv[side_vertices[0]][0], face.uv[side_vertices[1]][0], offset/100),
								Math.lerp(face.uv[side_vertices[0]][1], face.uv[side_vertices[1]][1], offset/100),
							];
							let c2_uv_coords = [
								Math.lerp(face.uv[opposite_vertices[0]][0], face.uv[opposite_vertices[1]][0], offset/100),
								Math.lerp(face.uv[opposite_vertices[0]][1], face.uv[opposite_vertices[1]][1], offset/100),
							];

							let new_face = new MeshFace(mesh, face).extend({
								vertices: [side_vertices[1], center_vertices[0], center_vertices[1], opposite_vertices[1]],
								uv: {
									[side_vertices[1]]: face.uv[side_vertices[1]],
									[center_vertices[0]]: c1_uv_coords,
									[center_vertices[1]]: c2_uv_coords,
									[opposite_vertices[1]]: face.uv[opposite_vertices[1]],
								}
							})
							face.extend({
								vertices: [opposite_vertices[0], center_vertices[0], center_vertices[1], side_vertices[0]],
								uv: {
									[opposite_vertices[0]]: face.uv[opposite_vertices[0]],
									[center_vertices[0]]: c1_uv_coords,
									[center_vertices[1]]: c2_uv_coords,
									[side_vertices[0]]: face.uv[side_vertices[0]],
								}
							})
							mesh.addFaces(new_face);

							// Find next (and previous) face
							for (let fkey in mesh.faces) {
								let ref_face = mesh.faces[fkey];
								if (ref_face.vertices.length < 3 || processed_faces.includes(ref_face)) continue;
								let vertices = ref_face.vertices.filter(vkey => opposite_vertices.includes(vkey))
								if (vertices.length >= 2) {
									splitFace(ref_face, opposite_vertices);
									break;
								}
							}
							if (double_side) {
								for (let fkey in mesh.faces) {
									let ref_face = mesh.faces[fkey];
									if (ref_face.vertices.length < 3 || processed_faces.includes(ref_face)) continue;
									let vertices = ref_face.vertices.filter(vkey => side_vertices.includes(vkey))
									if (vertices.length >= 2) {
										splitFace(ref_face, side_vertices);
										break;
									}
								}
							}

						} else {
							let opposite_vertex = sorted_vertices.find(vkey => !side_vertices.includes(vkey));

							let center_vertex = getCenterVertex(side_vertices);

							let c1_uv_coords = [
								(face.uv[side_vertices[0]][0] + face.uv[side_vertices[1]][0]) / 2,
								(face.uv[side_vertices[0]][1] + face.uv[side_vertices[1]][1]) / 2,
							];

							let new_face = new MeshFace(mesh, face).extend({
								vertices: [side_vertices[1], center_vertex, opposite_vertex],
								uv: {
									[side_vertices[1]]: face.uv[side_vertices[1]],
									[center_vertex]: c1_uv_coords,
									[opposite_vertex]: face.uv[opposite_vertex],
								}
							})
							face.extend({
								vertices: [opposite_vertex, center_vertex, side_vertices[0]],
								uv: {
									[opposite_vertex]: face.uv[opposite_vertex],
									[center_vertex]: c1_uv_coords,
									[side_vertices[0]]: face.uv[side_vertices[0]],
								}
							})
							mesh.addFaces(new_face);
						}
					}

					let start_vertices = start_face.getSortedVertices().filter((vkey, i) => selected_vertices.includes(vkey));
					let start_offset = direction % start_vertices.length;
					let start_edge = start_vertices.slice(start_offset, start_offset+2);
					if (start_edge.length == 1) start_edge.splice(0, 0, start_vertices[0]);

					splitFace(start_face, start_edge, start_face.vertices.length == 4);

					selected_vertices.empty();
					for (let key in center_vertices) {
						selected_vertices.safePush(center_vertices[key]);
					}
				})
				Undo.finishEdit('Create loop cut')
				Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
			}

			let selected_face;
			Mesh.selected.forEach(mesh => {
				if (!selected_face) {
					selected_face = mesh.getSelectedFaces()[0];
				}
			})

			runEdit();

			Undo.amendEdit({
				direction: {type: 'number', value: 0, label: 'edit.loop_cut.direction', condition: !!selected_face, min: 0},
				//cuts: {type: 'number', value: 1, label: 'edit.loop_cut.cuts', min: 0, max: 16},
				offset: {type: 'number', value: 50, label: 'edit.loop_cut.offset', min: 0, max: 100},
			}, form => {
				runEdit(true, form.offset, form.direction);
			})
		}
	})
	new Action('dissolve_edges', {
		icon: 'border_vertical',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length > 1)},
		click() {
			Undo.initEdit({elements: Mesh.selected});
			Mesh.selected.forEach(mesh => {
				let selected_vertices = mesh.getSelectedVertices();
				let faces = Object.keys(mesh.faces);
				for (let fkey in mesh.faces) {
					let face = mesh.faces[fkey];
					let sorted_vertices = face.getSortedVertices();
					let side_vertices = faces.includes(fkey) && sorted_vertices.filter(vkey => selected_vertices.includes(vkey));
					if (side_vertices && side_vertices.length == 2) {
						if (side_vertices[0] == sorted_vertices[0] && side_vertices[1] == sorted_vertices.last()) {
							side_vertices.reverse();
						}
						let original_face_normal = face.getNormal(true);
						let index_difference = sorted_vertices.indexOf(side_vertices[1]) - sorted_vertices.indexOf(side_vertices[0]);
						if (index_difference == -1 || index_difference > 2) side_vertices.reverse();
						let other_face = face.getAdjacentFace(sorted_vertices.indexOf(side_vertices[0]));
						face.vertices.remove(...side_vertices);
						delete face.uv[side_vertices[0]];
						delete face.uv[side_vertices[1]];
						if (other_face) {
							let new_vertices = other_face.face.getSortedVertices().filter(vkey => !side_vertices.includes(vkey));
							face.vertices.push(...new_vertices);
							new_vertices.forEach(vkey => {
								face.uv[vkey] = other_face.face.uv[vkey];
							})
							delete mesh.faces[other_face.key];
						}
						faces.remove(fkey);
						if (Reusable.vec1.fromArray(face.getNormal(true)).angleTo(Reusable.vec2.fromArray(original_face_normal)) > Math.PI/2) {
							face.invert();
						}
						side_vertices.forEach(vkey => {
							let is_used;
							for (let fkey2 in mesh.faces) {
								if (mesh.faces[fkey2].vertices.includes(vkey)) {
									is_used = true;
									break;
								}
							}
							if (!is_used) {
								delete mesh.vertices[vkey];
								selected_vertices.remove(vkey);
							}
						})
					}
				}
			})
			Undo.finishEdit('Dissolve edges')
			Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
	function mergeVertices(by_distance, in_center) {
		let found = 0, result = 0;
		Undo.initEdit({elements: Mesh.selected});
		Mesh.selected.forEach(mesh => {
			let selected_vertices = mesh.getSelectedVertices();
			if (selected_vertices.length < 2) return;

			if (!by_distance) {
				let first_vertex = selected_vertices[0];
				if (in_center) {
					let center = [0, 0, 0];
					selected_vertices.forEach(vkey => {
						center.V3_add(mesh.vertices[vkey]);
					})
					center.V3_divide(selected_vertices.length);
					mesh.vertices[first_vertex].V3_set(center);

					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						let matches = selected_vertices.filter(vkey => face.vertices.includes(vkey));
						if (matches.length < 2) continue;
						let center = [0, 0];
						matches.forEach(vkey => {
							center[0] += face.uv[vkey][0];
							center[1] += face.uv[vkey][1];
						})
						center[0] /= matches.length;
						center[1] /= matches.length;
						matches.forEach(vkey => {
							face.uv[vkey][0] = center[0];
							face.uv[vkey][1] = center[1];
						})
					}
				}
				selected_vertices.forEach(vkey => {
					if (vkey == first_vertex) return;
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						let index = face.vertices.indexOf(vkey);
						if (index === -1) continue;

						if (face.vertices.includes(first_vertex)) {
							face.vertices.remove(vkey);
							delete face.uv[vkey];
							if (face.vertices.length < 2) {
								delete mesh.faces[fkey];
							}
						} else {
							let uv = face.uv[vkey];
							face.vertices.splice(index, 1, first_vertex);
							face.uv[first_vertex] = uv;
							delete face.uv[vkey];
						}
					}
					delete mesh.vertices[vkey];
				})
				selected_vertices.splice(1, selected_vertices.length);
				
			} else {

				let selected_vertices = mesh.getSelectedVertices().slice();
				if (selected_vertices.length < 2) return;
				let groups = {};
				let i = 0;
				while (selected_vertices[i]) {
					let vkey1 = selected_vertices[i];
					let j = i+1;
					while (selected_vertices[j]) {
						let vkey2 = selected_vertices[j];
						let vector1 = mesh.vertices[vkey1];
						let vector2 = mesh.vertices[vkey2];
						if (Math.sqrt(Math.pow(vector2[0] - vector1[0], 2) + Math.pow(vector2[1] - vector1[1], 2) + Math.pow(vector2[2] - vector1[2], 2)) < settings.vertex_merge_distance.value) {
							if (!groups[vkey1]) groups[vkey1] = [];
							groups[vkey1].push(vkey2);
						}
						j++;
					}
					if (groups[vkey1]) {
						groups[vkey1].forEach(vkey2 => {
							selected_vertices.remove(vkey2);
						})
					}
					i++;
				}

				let current_selected_vertices = mesh.getSelectedVertices();
				for (let first_vertex in groups) {
					let group = groups[first_vertex];
					if (in_center) {
						let group_all = [first_vertex, ...group];
						let center = [0, 0, 0];
						group_all.forEach(vkey => {
							center.V3_add(mesh.vertices[vkey]);
						})
						center.V3_divide(group_all.length);
						mesh.vertices[first_vertex].V3_set(center);

						for (let fkey in mesh.faces) {
							let face = mesh.faces[fkey];
							let matches = group_all.filter(vkey => face.vertices.includes(vkey));
							if (matches.length < 2) continue;
							let center = [0, 0];
							matches.forEach(vkey => {
								center[0] += face.uv[vkey][0];
								center[1] += face.uv[vkey][1];
							})
							center[0] /= matches.length;
							center[1] /= matches.length;
							matches.forEach(vkey => {
								face.uv[vkey][0] = center[0];
								face.uv[vkey][1] = center[1];
							})
						}
					}
					group.forEach(vkey => {
						for (let fkey in mesh.faces) {
							let face = mesh.faces[fkey];
							let index = face.vertices.indexOf(vkey);
							if (index === -1) continue;

							if (face.vertices.includes(first_vertex)) {
								face.vertices.remove(vkey);
								delete face.uv[vkey];
								if (face.vertices.length < 2) {
									delete mesh.faces[fkey];
								}
							} else {
								let uv = face.uv[vkey];
								face.vertices.splice(index, 1, first_vertex);
								face.uv[first_vertex] = uv;
								delete face.uv[vkey];
							}
						}
						found++;
						delete mesh.vertices[vkey];
						current_selected_vertices.remove(vkey);
					})
					found++;
					result++;
				}
			}
		})
		Undo.finishEdit('Merge vertices')
		Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		if (by_distance) {
			Blockbench.showQuickMessage(tl('message.merged_vertices', [found, result]), 2000);
		}
	}
	new Action('merge_vertices', {
		icon: 'close_fullscreen',
		category: 'edit',
		keybind: new Keybind({key: 'm', shift: true}),
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length > 1)},
		click() {
			new Menu(this.children).open('mouse');
		},
		children: [
			{
				id: 'merge_all',
				name: 'action.merge_vertices.merge_all',
				icon: 'north_east',
				click() {mergeVertices(false, false);}
			},
			{
				id: 'merge_all_in_center',
				name: 'action.merge_vertices.merge_all_in_center',
				icon: 'close_fullscreen',
				click() {mergeVertices(false, true);}
			},
			{
				id: 'merge_by_distance',
				name: 'action.merge_vertices.merge_by_distance',
				icon: 'expand_less',
				click() {mergeVertices(true, false);}
			},
			{
				id: 'merge_by_distance_in_center',
				name: 'action.merge_vertices.merge_by_distance_in_center',
				icon: 'unfold_less',
				click() {mergeVertices(true, true);}
			}
		]
	})
	new Action('merge_meshes', {
		icon: 'upload',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected.length >= 2)},
		click() {
			let elements = Mesh.selected.slice();
			Undo.initEdit({elements});
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
				elements.remove(mesh);
				Mesh.selected.remove(mesh)
			})
			updateSelection();
			Undo.finishEdit('Merge meshes')
			Canvas.updateView({elements, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
	new Action('split_mesh', {
		icon: 'call_split',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length)},
		click() {
			let elements = Mesh.selected.slice();
			Undo.initEdit({elements});

			Mesh.selected.forEach(mesh => {

				let selected_vertices = mesh.getSelectedVertices();

				let copy = new Mesh(mesh);
				elements.push(copy);

				for (let fkey in mesh.faces) {
					let face = mesh.faces[fkey];
					if (face.isSelected()) {
						delete mesh.faces[fkey];
					} else {
						delete copy.faces[fkey];
					}
				}

				selected_vertices.forEach(vkey => {
					let used = false;
					for (let key in mesh.faces) {
						let face = mesh.faces[key];
						if (face.vertices.includes(vkey)) used = true;
					}
					if (!used) {
						delete mesh.vertices[vkey];
					}
				})
				Object.keys(copy.vertices).filter(vkey => !selected_vertices.includes(vkey)).forEach(vkey => {
					let used = false;
					for (let key in copy.faces) {
						let face = copy.faces[key];
						if (face.vertices.includes(vkey)) used = true;
					}
					if (!used) {
						delete copy.vertices[vkey];
					}
				})

				copy.name += '_selection'
				copy.sortInBefore(mesh, 1).init();
				delete Project.selected_vertices[mesh.uuid];
				Project.selected_vertices[copy.uuid] = selected_vertices;
				mesh.preview_controller.updateGeometry(mesh);
				selected[selected.indexOf(mesh)] = copy;
			})
			Undo.finishEdit('Merge meshes');
			updateSelection();
			Canvas.updateView({elements, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
	new Action('import_obj', {
		icon: 'fa-gem',
		category: 'file',
		condition: {modes: ['edit'], method: () => (Format.meshes)},
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
				let vertices = [];
				let vertex_keys = {};
				let vertex_textures = [];
				let vertex_normals = [];
				let meshes = [];
				let vector1 = new THREE.Vector3();
				let vector2 = new THREE.Vector3();

				Undo.initEdit({outliner: true, elements: meshes, selection: true});

				lines.forEach(line => {

					if (line.substr(0, 1) == '#' || !line) return;

					let args = line.split(/\s+/).filter(arg => typeof arg !== 'undefined' && arg !== '');
					let cmd = args.shift();

					if (cmd == 'o' || cmd == 'g') {
						mesh = new Mesh({
							name: args[0],
							vertices: {}
						})
						vertex_keys = {};
						meshes.push(mesh);
					}
					if (cmd == 'v') {
						vertices.push(toVector(args, 3).map(v => v * 16));
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
							if (!vertex_keys[ v-1 ]) {
								vertex_keys[ v-1 ] = mesh.addVertices(vertices[v-1])[0];
							}
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
								face.invert();
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