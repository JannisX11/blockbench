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
	getUVIsland() {
		let keys = [this.getFaceKey()];
		function crawl(face) {
			for (let i = 0; i < face.vertices.length; i++) {
				let adjacent = face.getAdjacentFace(i);
				if (!adjacent) continue;
				if (keys.includes(adjacent.key)) continue;
				let epsilon = 0.2;
				let uv_a1 = adjacent.face.uv[adjacent.edge[0]];
				let uv_a2 = face.uv[adjacent.edge[0]];
				if (!Math.epsilon(uv_a1[0], uv_a2[0], epsilon) || !Math.epsilon(uv_a1[1], uv_a2[1], epsilon)) continue;
				let uv_b1 = adjacent.face.uv[adjacent.edge[1]];
				let uv_b2 = face.uv[adjacent.edge[1]];
				if (!Math.epsilon(uv_b1[0], uv_b2[0], epsilon) || !Math.epsilon(uv_b1[1], uv_b2[1], epsilon)) continue;
				keys.push(adjacent.key);
				crawl(adjacent.face);
			}
		}
		crawl(this);
		return keys;
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
	get position() {
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
	getCenter(global) {
		let center = [0, 0, 0];
		let len = 0;
		for (let vkey in this.vertices) {
			center.V3_add(this.vertices[vkey]);
			len++;
		}
		center.V3_divide(len);
		if (global) {
			return this.mesh.localToWorld(Reusable.vec1.set(...center)).toArray();
		} else {
			return center;
		}
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
		points.element_uuid = element.uuid;
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
