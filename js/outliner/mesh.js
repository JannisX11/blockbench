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
	get element() {
		return this.mesh;
	}
	extend(data) {
		super.extend(data);
		this.vertices.forEachReverse((key, i) => {
			if (typeof key != 'string' || !key.length) {
				this.vertices.splice(i, 1);
				delete this.uv[key];
				return;
			}
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
	getNormal(normalize, alt_tri) {
		let vertices = this.getSortedVertices();
		if (vertices.length < 3) return [0, 0, 0];
		let indices = [0, 1, 2];
		if (vertices.length == 4 && alt_tri) {
			indices = [0, 2, 3];
		}
		let base = this.mesh.vertices[vertices[indices[0]]];
		let a = this.mesh.vertices[vertices[indices[1]]].slice().V3_subtract(base);
		let b = this.mesh.vertices[vertices[indices[2]]].slice().V3_subtract(base);
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
		let texture = Format.per_texture_uv_size && this.getTexture();
		let min_x = texture ? texture.getUVWidth() : Project.texture_width,
			min_y = texture ? texture.getUVHeight() : Project.texture_height,
			max_x = 0,
			max_y = 0;
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
		let factor_x = texture ? (texture.width  / texture.getUVWidth()) : 1;
		let factor_y = texture ? (texture.display_height / texture.getUVHeight()) : 1;

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

				let inside = ( pointInsidePolygon(x+0.000001, y+0.000001)
							|| pointInsidePolygon(x+0.999999, y+0.000001)
							|| pointInsidePolygon(x+0.000001, y+0.999999)
							|| pointInsidePolygon(x+0.999999, y+0.999999));
				if (!inside) {
					let i = 0;
					let px_rect = [[x, y], [x+0.999999, y+0.999999]]
					for (let vkey of sorted_vertices) {
						if (!face.uv[vkey]) continue;
						let uv_a = [
							face.uv[vkey][0] * factor_x,
							face.uv[vkey][1] * factor_y,
						];
						if (pointInRectangle(uv_a, ...px_rect)) {
							inside = true; break;
						}
						let vkey_b = sorted_vertices[i+1] || sorted_vertices[0];
						if (!face.uv[vkey_b]) continue;
						let uv_b = [
							face.uv[vkey_b][0] * factor_x,
							face.uv[vkey_b][1] * factor_y,
						];
						if (lineIntersectsReactangle(uv_a, uv_b, ...px_rect)) {
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
	getUVIsland(max_depth = 4096) {
		let keys = [this.getFaceKey()];
		let epsilon = 0.2;
		function crawl(face, depth) {
			if (depth >= max_depth) return;
			for (let i = 0; i < face.vertices.length; i++) {
				let adjacent = face.getAdjacentFace(i);
				if (!adjacent) continue;
				if (keys.includes(adjacent.key)) continue;
				let uv_a1 = adjacent.face.uv[adjacent.edge[0]];
				let uv_a2 = face.uv[adjacent.edge[0]];
				if (!Math.epsilon(uv_a1[0], uv_a2[0], epsilon) || !Math.epsilon(uv_a1[1], uv_a2[1], epsilon)) continue;
				let uv_b1 = adjacent.face.uv[adjacent.edge[1]];
				let uv_b2 = face.uv[adjacent.edge[1]];
				if (!Math.epsilon(uv_b1[0], uv_b2[0], epsilon) || !Math.epsilon(uv_b1[1], uv_b2[1], epsilon)) continue;
				keys.push(adjacent.key);
				crawl(adjacent.face, depth+1);
			}
		}
		crawl(this, 0);
		return keys;
	}
	getAngleTo(other) {
		let a = new THREE.Vector3().fromArray(this.getNormal());
		let b = new THREE.Vector3().fromArray(other instanceof Array ? other : other.getNormal());
		return Math.radToDeg(a.angleTo(b));
	}
	invert() {
		if (this.vertices.length < 3) return this;
		[this.vertices[0], this.vertices[1]] = [this.vertices[1], this.vertices[0]];
	}
	isSelected(fkey) {
		return !!Project.mesh_selection[this.mesh.uuid] && Project.mesh_selection[this.mesh.uuid].faces.includes(fkey || this.getFaceKey());
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
	isConcave() {
		if (this.vertices.length < 4) return false;
		let {vec1, vec2, vec3, vec4} = Reusable;
		let normal_vec = vec1.fromArray(this.getNormal(true));
		let plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
			normal_vec,
			vec2.fromArray(this.mesh.vertices[this.vertices[0]])
		)
		let sorted_vertices = this.getSortedVertices();
		let rot = cameraTargetToRotation([0, 0, 0], normal_vec.toArray());
		let e = new THREE.Euler(Math.degToRad(rot[1] - 90), Math.degToRad(rot[0] + 180), 0);
		
		let flat_positions = sorted_vertices.map(vkey => {
			let coplanar_pos = plane.projectPoint(vec3.fromArray(this.mesh.vertices[vkey]), vec4);
			coplanar_pos.applyEuler(e);
			return [coplanar_pos.x, coplanar_pos.z];
		})
		let angles = [];
		for (let i = 0; i < sorted_vertices.length; i++) {
			let a = flat_positions[i];
			let b = flat_positions[(i+1) % 4];
			let direction = b.slice().V2_subtract(a);
			let angle = Math.atan2(direction[1], direction[0]);
			angles.push(angle);
		}
		for (let i = 0; i < sorted_vertices.length; i++) {
			let a = angles[i];
			let b = angles[(i+1) % 4];
			let difference = Math.trimRad(b - a);
			if (difference > 0) {
				return sorted_vertices[(i+1) % 4];
			}
		}
		return false;
	}
	getEdges() {
		let vertices = this.getSortedVertices();
		if (vertices.length == 2) {
			return vertices;
		} else if (vertices.length > 2) {
			return vertices.map((vkey1, i) => {
				let vkey2 = vertices[i+1] || vertices[0];
				return [vkey1, vkey2];
			})
		} else {
			return [];
		}
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
	texelToLocalMatrix(uv, truncate_factor = [1, 1], truncated_uv, vertices = this.getSortedVertices()) {
		let vert_a = vertices[0];
		let vert_b = vertices[1];
		let vert_c = vertices[2];

		// Use non-truncated uv coordinates to select the correct triangle of a face.
		if (vertices[3]) {
			let is_in_tri = pointInTriangle(uv, this.uv[vert_a], this.uv[vert_b], this.uv[vert_c]);

			if (!is_in_tri) {
				vert_a = vertices[0];
				vert_b = vertices[2];
				vert_c = vertices[3];
			}
		}
		let p0 = this.uv[vert_a];
		let p1 = this.uv[vert_b];
		let p2 = this.uv[vert_c];

		let vertexa = this.mesh.vertices[vert_a];
		let vertexb = this.mesh.vertices[vert_b];
		let vertexc = this.mesh.vertices[vert_c];

		uv = truncated_uv == null || truncated_uv[0] == null || truncated_uv[1] == null ? [...uv] : [...truncated_uv];

		function UVToLocal(uv) {
			let b0 = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
			let b1 = ((p1[0] - uv[0]) * (p2[1] - uv[1]) - (p2[0] - uv[0]) * (p1[1] - uv[1])) / b0;
			let b2 = ((p2[0] - uv[0]) * (p0[1] - uv[1]) - (p0[0] - uv[0]) * (p2[1] - uv[1])) / b0;
			let b3 = ((p0[0] - uv[0]) * (p1[1] - uv[1]) - (p1[0] - uv[0]) * (p0[1] - uv[1])) / b0;

			return new THREE.Vector3(
				vertexa[0] * b1 + vertexb[0] * b2 + vertexc[0] * b3,
				vertexa[1] * b1 + vertexb[1] * b2 + vertexc[1] * b3,
				vertexa[2] * b1 + vertexb[2] * b2 + vertexc[2] * b3
			)
		}

		let texel_pos = UVToLocal(uv);
		let texel_x_axis = UVToLocal([uv[0] + truncate_factor[0], uv[1]]);
		let texel_y_axis = UVToLocal([uv[0], uv[1] + truncate_factor[1]]);

		texel_x_axis.sub(texel_pos);
		texel_y_axis.sub(texel_pos);

		let matrix = new THREE.Matrix4();
		matrix.makeBasis(texel_x_axis, texel_y_axis, new THREE.Vector3(0, 0, 1));
		matrix.setPosition(texel_pos);
		return matrix;
	}
	UVToLocal(uv, vertices = this.getSortedVertices()) {
		let vert_a = vertices[0];
		let vert_b = vertices[1];
		let vert_c = vertices[2];

		if (vertices[3]) {
			let is_in_tri = pointInTriangle(uv, this.uv[vert_a], this.uv[vert_b], this.uv[vert_c]);

			if (!is_in_tri) {
				vert_a = vertices[0];
				vert_b = vertices[2];
				vert_c = vertices[3];
			}
		}
		let p0 = this.uv[vert_a];
		let p1 = this.uv[vert_b];
		let p2 = this.uv[vert_c];

		let vertexa = this.mesh.vertices[vert_a];
		let vertexb = this.mesh.vertices[vert_b];
		let vertexc = this.mesh.vertices[vert_c];

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
	localToUV(vector, vertices = this.vertices) {
		let va = new THREE.Vector3().fromArray(this.mesh.vertices[vertices[0]]);
		let vb = new THREE.Vector3().fromArray(this.mesh.vertices[vertices[1]]);
		let vc = new THREE.Vector3().fromArray(this.mesh.vertices[vertices[2]]);

		let uva = new THREE.Vector2().fromArray(this.uv[vertices[0]]);
		let uvb = new THREE.Vector2().fromArray(this.uv[vertices[1]]);
		let uvc = new THREE.Vector2().fromArray(this.uv[vertices[2]]);

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
new Property(MeshFace, 'array', 'vertices');


class Mesh extends OutlinerElement {
	constructor(data, uuid) {
		super(data, uuid)

		this._static = {
			properties: {
				vertices: {},
				faces: {},
				seams: {},
			}
		}
		Object.freeze(this._static);

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
	get vertices() {
		return this._static.properties.vertices;
	}
	get faces() {
		return this._static.properties.faces;
	}
	get seams() {
		return this._static.properties.seams;
	}
	set vertices(v) {
		this._static.properties.vertices = v;
	}
	set faces(v) {
		this._static.properties.faces = v;
	}
	set seams(v) {
		this._static.properties.seams = v;
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
	getWorldCenter(ignore_mesh_selection) {
		let m = this.mesh;
		let pos = new THREE.Vector3();
		let vertex_count = 0;

		for (let key in this.vertices) {
			if (ignore_mesh_selection || !Project.mesh_selection[this.uuid] || (Project.mesh_selection[this.uuid] && Project.mesh_selection[this.uuid].vertices.includes(key))) {
				let vector = this.vertices[key];
				pos.x += vector[0];
				pos.y += vector[1];
				pos.z += vector[2];
				vertex_count++;
			}
		}
		if (vertex_count) {
			pos.x /= vertex_count;
			pos.y /= vertex_count;
			pos.z /= vertex_count;
		}

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
		if (typeof object.seams == 'object') {
			this.seams = {};
			for (let key in object.seams) {
				this.seams[key] = object.seams[key];
			}
		}
		this.sanitizeName();
		return this;
	}
	getUndoCopy(aspects = {}) {
		let el = {};

		if (!aspects.uv_only) {
			for (var key in Mesh.properties) {
				Mesh.properties[key].copy(this, el)
			}
			if (Object.keys(this.seams).length) {
				el.seams = {};
				for (let key in this.seams) {
					el.seams[key] = this.seams[key];
				}
			}

			el.vertices = {};
			for (let key in this.vertices) {
				el.vertices[key] = this.vertices[key].slice();
			}
		}

		el.faces = {};
		for (let key in this.faces) {
			el.faces[key] = this.faces[key].getUndoCopy();
		}

		el.type = 'mesh';
		el.uuid = this.uuid
		return el;
	}
	getSaveCopy(project) {
		var el = {}
		for (var key in Mesh.properties) {
			Mesh.properties[key].copy(this, el)
		}
		if (Object.keys(this.seams).length) {
			el.seams = {};
			for (let key in this.seams) {
				el.seams[key] = this.seams[key];
			}
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
		if (make && !Project.mesh_selection[this.uuid]) Project.mesh_selection[this.uuid] = {vertices: [], edges: [], faces: []};
		return Project.mesh_selection[this.uuid]?.vertices || [];
	}
	getSelectedEdges(make) {
		if (make && !Project.mesh_selection[this.uuid]) Project.mesh_selection[this.uuid] = {vertices: [], edges: [], faces: []};
		return Project.mesh_selection[this.uuid]?.edges || [];
	}
	getSelectedFaces(make) {
		if (make && !Project.mesh_selection[this.uuid]) Project.mesh_selection[this.uuid] = {vertices: [], edges: [], faces: []};
		return Project.mesh_selection[this.uuid]?.faces || [];
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
	getSize(axis, selection_only) {
		if (selection_only) {
			let selected_vertices = Project.mesh_selection[this.uuid]?.vertices || Object.keys(this.vertices);
			if (!selected_vertices.length) return 0;
			let range = [Infinity, -Infinity];
			let {vec1, vec2} = Reusable;
			let rotation_inverted = new THREE.Euler().copy(Transformer.rotation_selection).invert();
			selected_vertices.forEach(key => {
				vec1.fromArray(this.vertices[key]).applyEuler(rotation_inverted);
				range[0] = Math.min(range[0], vec1.getComponent(axis));
				range[1] = Math.max(range[1], vec1.getComponent(axis));
			})
			return range[1] - range[0];
		} else {
			let range = [Infinity, -Infinity];
			for (let vkey in this.vertices) {
				range[0] = Math.min(range[0], this.vertices[vkey][axis]);
				range[1] = Math.max(range[1], this.vertices[vkey][axis]);
			}
			return range[1] - range[0];
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
		for (let vkey in this.vertices) {
			this.vertices[vkey][axis] *= -1;
		}
		for (let key in this.faces) {
			this.faces[key].invert();
		}

		this.origin[axis] *= -1;
		this.rotation.forEach((n, i) => {
			if (i != axis) this.rotation[i] = -n;
		})

		flipNameOnAxis(this, axis);

		this.preview_controller.updateTransform(this);

		this.preview_controller.updateGeometry(this);
		this.preview_controller.updateUV(this);
		return this;
	}
	flipSelection(axis, center) {
		let object_mode = BarItems.selection_mode.value == 'object' || !!Group.first_selected;
		let selected_vertices = this.getSelectedVertices();
		for (let vkey in this.vertices) {
			if (object_mode || selected_vertices.includes(vkey)) {
				this.vertices[vkey][axis] *= -1;
			}
		}
		for (let key in this.faces) {
			let face = this.faces[key];
			if (object_mode || face.isSelected(key) || face.vertices.allAre(vkey => selected_vertices.includes(vkey))) {
				face.invert();
			}
		}

		if (object_mode) {
			this.origin[axis] *= -1;
			this.rotation.forEach((n, i) => {
				if (i != axis) this.rotation[i] = -n;
			})
			this.preview_controller.updateTransform(this);

			flipNameOnAxis(this, axis);
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
		let source_vertices = typeof val == 'number' ? this.oldVertices : this.vertices;
		let selected_vertices = Project.mesh_selection[this.uuid]?.vertices || Object.keys(this.vertices);
		let range = [Infinity, -Infinity];
		let {vec1, vec2} = Reusable;
		let rotation_inverted = new THREE.Euler().copy(Transformer.rotation_selection).invert();
		selected_vertices.forEach(key => {
			vec1.fromArray(source_vertices[key]).applyEuler(rotation_inverted);
			range[0] = Math.min(range[0], vec1.getComponent(axis));
			range[1] = Math.max(range[1], vec1.getComponent(axis));
		})
		
		let center = bidirectional ? (range[0] + range[1]) / 2 : (negative ? range[1] : range[0]);
		let size = Math.abs(range[1] - range[0]);
		if (typeof val !== 'number') {
			val = val(size) - size;
			if (bidirectional) val /= 2;
		}
		let scale = (size + val * (negative ? -1 : 1) * (bidirectional ? 2 : 1)) / size;
		if (isNaN(scale) || Math.abs(scale) == Infinity) scale = 1;
		if (scale < 0 && !allow_negative) scale = 0;
		
		selected_vertices.forEach(key => {
			vec1.fromArray(source_vertices[key]).applyEuler(rotation_inverted);
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
		} else if (!faces) {
			var sides = this.getSelectedFaces()
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
	Mesh.prototype.icon = 'far.fa-gem';
	Mesh.prototype.movable = true;
	Mesh.prototype.resizable = true;
	Mesh.prototype.rotatable = true;
	Mesh.prototype.needsUniqueName = false;
	Mesh.prototype.menu = new Menu([
		new MenuSeparator('mesh_edit'),
		'extrude_mesh_selection',
		'inset_mesh_selection',
		'loop_cut',
		'create_face',
		'invert_face',
		'switch_face_crease',
		'merge_vertices',
		'dissolve_edges',
		'apply_mesh_rotation',
		new MenuSeparator('mesh_combination'),
		'split_mesh',
		'merge_meshes',
		...Outliner.control_menu_group,
		new MenuSeparator('settings'),
		'allow_element_mirror_modeling',
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
		"randomize_marker_colors",
		{name: 'menu.cube.texture', icon: 'collections', condition: () => !Format.single_texture, children() {
			var arr = [
				{icon: 'crop_square', name: Format.single_texture_default ? 'menu.cube.texture.default' : 'menu.cube.texture.blank', click(mesh) {
					let all_faces = BarItems.selection_mode.value != 'face' || Mesh.selected[0]?.getSelectedFaces().length == 0;
					mesh.forSelected((obj) => {
						obj.applyTexture(false, all_faces)
					}, 'texture blank')
				}}
			]
			let applied_texture;
			main_loop: for (let mesh of Mesh.selected) {
				face_loop: for (let fkey in mesh.faces) {
					let texture = mesh.faces[fkey].getTexture();
					if (texture) {
						if (!applied_texture) {
							applied_texture = texture;
						} else if (applied_texture != texture) {
							applied_texture = null;
							break main_loop;
							break face_loop;
						}
					}
				}
			}
			Texture.all.forEach((t) => {
				arr.push({
					name: t.name,
					icon: (t.mode === 'link' ? t.img : t.source),
					marked: t == applied_texture,
					click(mesh) {
						let all_faces = BarItems.selection_mode.value != 'face' || Mesh.selected[0]?.getSelectedFaces().length == 0;
						mesh.forSelected((obj) => {
							obj.applyTexture(t, all_faces)
						}, 'apply texture')
					}
				})
			})
			return arr;
		}},
		'element_render_order',
		new MenuSeparator('manage'),
		'rename',
		'toggle_visibility',
		'delete'
	]);
	Mesh.prototype.buttons = [
		Outliner.buttons.export,
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];

new Property(Mesh, 'string', 'name', {default: 'mesh'})
new Property(Mesh, 'number', 'color', {default: Math.floor(Math.random()*markerColors.length)});
new Property(Mesh, 'vector', 'origin');
new Property(Mesh, 'vector', 'rotation');
new Property(Mesh, 'boolean', 'export', {default: true});
new Property(Mesh, 'boolean', 'visibility', {default: true});
new Property(Mesh, 'boolean', 'locked');
new Property(Mesh, 'enum', 'render_order', {default: 'default', values: ['default', 'behind', 'in_front']});

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
		this.updateRenderOrder(element);
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
		let {vertices, faces} = element;

		for (let key in vertices) {
			let vector = vertices[key];
			point_position_array.push(...vector);
		}

		for (let key in faces) {
			let face = faces[key];

			if (face.vertices.length == 2) {
				// Outline
				mesh.outline.vertex_order.push(face.vertices[0]);
				mesh.outline.vertex_order.push(face.vertices[1]);

			} else if (face.vertices.length == 3) {
				// Tri
				face.vertices.forEach((key, i) => {
					indices.push(position_array.length / 3);
					position_array.push(...vertices[key])
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
				face.vertices.forEach((vkey, i) => {
					if (!vertices[vkey]) {
						throw new Error(`Face "${key}" in mesh "${element.name}" contains an invalid vertex key "${vkey}"`, face)
					}
					position_array.push(...vertices[vkey])
					face_indices[vkey] = index_offset + i;
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
			outline_positions.push(...vertices[key]);
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
		Mesh.preview_controller.updateHighlight(element);

		Mesh.preview_controller.updatePixelGrid(element);

		if (Project.view_mode == 'wireframe' && this.fixWireframe) {
			this.fixWireframe(element);
		}

		this.dispatchEvent('update_geometry', {element});
	},
	updateFaces(element) {
		let {mesh} = element;

		if (Project.view_mode === 'solid') {
			mesh.material = Canvas.monochromaticSolidMaterial
		
		} else if (Project.view_mode === 'colored_solid') {
			mesh.material = Canvas.coloredSolidMaterials[element.color]
		
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
			let faces = element.faces;
			var materials = []
			for (let key in faces) {
				if (faces[key].vertices.length < 3) continue;
				var tex = faces[key].getTexture()
				if (tex && tex.uuid) {
					materials.push(tex.getMaterial())
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

				for (let key in faces) {
					if (faces[key].vertices.length < 3) continue;
					let face = faces[key];
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
	updateUV(element) {
		let {mesh, faces} = element;
		if (mesh === undefined || !mesh.geometry) return;
		let uv_array = [];

		for (let key in faces) {
			let face = faces[key];
			if (face.vertices.length <= 2) continue;
			
			let stretch = 1;
			let frame = 0;
			let tex = face.getTexture();
			if (tex instanceof Texture && tex.frameCount > 1) {
				stretch = tex.frameCount
				frame = tex.currentFrame || 0;
			}
			let uv_size = (tex && Project.view_mode !== 'uv')
				? [tex.getUVWidth(), tex.getUVHeight()]
				: [Project.texture_width, Project.texture_height];

			let first_values;
			face.vertices.forEach((key, i) => {
				let u = (face.uv[key] ? face.uv[key][0] : 0) / uv_size[0];
				let v = (face.uv[key] ? face.uv[key][1] : 0) / uv_size[1];
				if (stretch > 1) {
					v = (v + frame) / stretch;
				}
				// Fix grainy visuals when UV all in one point
				if (!first_values) {
					first_values = [u, v];
				} else if (first_values[0] == u && first_values[1] == v) {
					i < 2 ? u += 0.00005 : v += 0.00005;
				} 
				uv_array.push(u, 1-v);
			})
		}

		mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv_array), 2)), 
		mesh.geometry.attributes.uv.needsUpdate = true;

		this.dispatchEvent('update_uv', {element});

		this.updatePixelGrid(element);

		return mesh.geometry;
	},
	updateSelection(element) {
		NodePreviewController.prototype.updateSelection.call(this, element);
	
		let mesh = element.mesh;
		let white = new THREE.Color(0xffffff);
		let join = new THREE.Color(0x16d606);
		let divide = new THREE.Color(0xff4400);
		let join_selected = new THREE.Color(0x6bffcb);
		let divide_selected = new THREE.Color(0xff8c69);
		let selected_vertices = element.getSelectedVertices();
		let selected_edges = element.getSelectedEdges();
		let selected_faces = element.getSelectedFaces();

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

		let face_outlines = {};
		let faces = element.faces;
		if (BarItems.selection_mode.value == 'face' || BarItems.selection_mode.value == 'cluster') {
			selected_faces.forEach(fkey => {
				let face = faces[fkey];
				face.vertices.forEach(vkey => {
					if (!face_outlines[vkey]) face_outlines[vkey] = new Set();
					face.vertices.forEach(vkey2 => {
						if (vkey2 != vkey) face_outlines[vkey].add(vkey2);
					})
				})
			})
		}
		let line_colors = [];
		mesh.outline.vertex_order.forEach((key, i) => {
			let key_b = Modes.edit && mesh.outline.vertex_order[i + ((i%2) ? -1 : 1) ];
			let color;
			let selected;
			if (!Modes.edit || BarItems.selection_mode.value == 'object') {
				color = gizmo_colors.outline;
			} else if (BarItems.selection_mode.value == 'edge' && selected_edges.find(edge => sameMeshEdge([key, key_b], edge))) {
				color = white;
				selected = true;
			} else if ((BarItems.selection_mode.value == 'face' || BarItems.selection_mode.value == 'cluster') && face_outlines[key] && face_outlines[key].has(key_b)) {
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
		
		mesh.vertex_points.visible = (Mode.selected.id == 'edit' && BarItems.selection_mode.value == 'vertex') || Toolbox.selected.id == 'knife_tool';

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
		let selection_mode = BarItems.selection_mode.value;
		let selected_faces = element.getSelectedFaces();
		
		if (!force_off && element.selected && Modes.edit) {
			let i = 0;
			let faces = element.faces;
			for (let fkey in faces) {
				let face = faces[fkey];
				if (face.vertices.length < 3) continue;
				if (selected_faces.indexOf(fkey) != -1 && (selection_mode == 'face' || selection_mode == 'cluster')) {
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
	updatePixelGrid(element) {
		var mesh = element.mesh;
		if (mesh === undefined) return;
		mesh.remove(mesh.grid_box);
		if (mesh.grid_box?.geometry) mesh.grid_box.geometry.dispose();
		if (element.visibility == false) return;

		let grid_enabled = (Modes.paint && settings.painting_grid.value) || (Modes.edit && settings.pixel_grid.value)
		if (!grid_enabled) return;

		var positions = [];

		for (let fkey in element.faces) {
			let face = element.faces[fkey];
			if (face.vertices.length <= 2) continue;
			let offset = face.getNormal(true).V3_multiply(0.01);
			let texture = face.getTexture();
			var psize_x = texture ? texture.getUVWidth() / texture.width : 1;
			var psize_y = texture ? texture.getUVHeight() / texture.display_height : 1;

			let vertices = face.getSortedVertices();
			let tris = vertices.length == 3 ? [vertices] : [vertices.slice(0, 3), [vertices[0], vertices[2], vertices[3]]];
			tris.forEach(tri_vertices => {
				let x_memory = {};
				let y_memory = {};
				
				tri_vertices.forEach((vkey1, i) => {
					let vkey2 = tri_vertices[i+1] || tri_vertices[0];
					let uv1 = face.uv[vkey1].slice();
					let uv2 = face.uv[vkey2].slice();
					let range_x = (uv1[0] > uv2[0]) ? [uv2[0], uv1[0]] : [uv1[0], uv2[0]];
					let range_y = (uv1[1] > uv2[1]) ? [uv2[1], uv1[1]] : [uv1[1], uv2[1]];

					for (let x = Math.ceil(range_x[0] / psize_x) * psize_x; x < range_x[1]; x += psize_x) {
						if (!x_memory[x]) x_memory[x] = [];
						let y = uv1[1] + (uv2[1] - uv1[1]) * Math.getLerp(uv1[0], uv2[0], x);
						x_memory[x].push(face.UVToLocal([x, y], tri_vertices).toArray().V3_add(offset));
					}
					for (let y = Math.ceil(range_y[0] / psize_y) * psize_y; y < range_y[1]; y += psize_y) {
						if (!y_memory[y]) y_memory[y] = [];
						let x = uv1[0] + (uv2[0] - uv1[0]) * Math.getLerp(uv1[1], uv2[1], y);
						y_memory[y].push(face.UVToLocal([x, y], tri_vertices).toArray().V3_add(offset));
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
			})
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
	},
	fixWireframe(element) {
		let geometry_orig = element.mesh.geometry;
		if (!geometry_orig) return;
		let geometry_clone = element.mesh.geometry.clone();
		element.mesh.geometry = geometry_clone;
		geometry_orig.dispose();
	}
})

Blockbench.dispatchEvent('change_view_mode', ({view_mode}) => {
	if (view_mode == 'wireframe') {
		for (let mesh of Mesh.selected) {
			Mesh.preview_controller.fixWireframe(mesh);
		}
	}
});
