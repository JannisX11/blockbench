import { PointerTarget } from "../../interface/pointer_target";

export class KnifeToolContext {
	/**
	 * Click
	 * Create point
	 * Snap point to face or edge
	 * Connect points with lines
	 * Press something to apply
	 * 
	 * Iterate over faces
	 * Remove former face, refill section between old edges and new edges
	 */
	constructor(mesh) {
		this.mesh = mesh;
		this.mesh_3d = mesh.mesh;
		this.points = [];
		this.hover_point = null;

		this.points_geo = new THREE.BufferGeometry();
		let points_material = new THREE.PointsMaterial({size: 9, sizeAttenuation: false, vertexColors: true});
		this.points_mesh = new THREE.Points(this.points_geo, points_material);
		this.points_mesh.renderOrder = 100;
		//points_material.depthTest = false
		this.lines_mesh = new THREE.Line(this.points_geo, Canvas.outlineMaterial);
		this.points_mesh.frustumCulled = false;
		this.lines_mesh.frustumCulled = false;

		this.mesh_3d.add(this.points_mesh);
		this.mesh_3d.add(this.lines_mesh);

		this.unselect_listener = Blockbench.on('unselect_project', context => {
			if (this == KnifeToolContext.current) {
				this.remove();
			}
		})
	}
	showToast() {
		this.toast = Blockbench.showToastNotification({
			text: tl('message.knife_tool.confirm', [Keybinds.extra.confirm.keybind.label]),
			icon: BarItems.knife_tool.icon,
			click: () => {
				this.apply();
			}
		});
	}
	hover(data) {
		if (data.element != this.mesh || !data) {
			if (this.hover_point) {
				this.hover_point = null;
				this.updatePreviewGeometry();
			}
			return;
		}

		let point = {
			position: new THREE.Vector3().copy(data.intersects[0].point),
			type: data.type == 'element' ? 'face' : data.type,
			attached_vertex: data.vertex,
			attached_line: data.vertices,
			snapped: false,
			fkey: data.face
		}
		data.element.mesh.worldToLocal(point.position);
		// Snapping
		if (data.type == 'vertex') {
			point.position.fromArray(this.mesh.vertices[data.vertex]);
			point.snapped = true;
		} else if (data.type == 'line') {
			// https://gamedev.stackexchange.com/questions/72528/how-can-i-project-a-3d-point-onto-a-3d-line
			let point_a = Reusable.vec1.fromArray(this.mesh.vertices[data.vertices[0]]);
			let point_b = Reusable.vec2.fromArray(this.mesh.vertices[data.vertices[1]]);
			let a_b = new THREE.Vector3().copy(point_b).sub(point_a);
			let a_p = new THREE.Vector3().copy(point.position).sub(point_a);
			let subline_len = a_p.dot(a_b) / a_b.dot(a_b);
			if (data.event.shiftKey || Pressing.overrides.shift) {
				subline_len = Math.round(subline_len * 4) / 4;
			}
			point.position.copy(point_a).addScaledVector(a_b, subline_len);
			point.snapped = true;
		}
		// Snap to existing points?
		let pos = this.mesh_3d.localToWorld(Reusable.vec1.copy(point.position));
		let threshold = Preview.selected.calculateControlScale(pos) * 0.6;
		let matching_point = this.points.find(other => {
			return point.position.distanceTo(other.position) < threshold && !other.reuse_of;
		})
		if (matching_point) {
			point.position.copy(matching_point.position);
			point.reuse_of = matching_point;
		} else if (data.event && (data.event.ctrlOrCmd || Pressing.overrides.shift) && point.fkey) {
			let face = this.mesh.faces[point.fkey];
			let uv = face.localToUV(point.position);
			let factor = (data.event.shiftKey || Pressing.overrides.shift) ? 4 : 1;
			uv[0] = Math.round(uv[0] * factor) / factor;
			uv[1] = Math.round(uv[1] * factor) / factor;
			let target = face.UVToLocal(uv);
			point.position.copy(target);
		} else if (data.event && (data.event.shiftKey || Pressing.overrides.shift) && point.fkey) {
			let face = this.mesh.faces[point.fkey];
			point.position.fromArray(face.getCenter());
		}
		if (this.points.length && point.position.distanceToSquared(this.points.last().position) < 0.001) return;

		this.hover_point = point;
		this.updatePreviewGeometry();
	}
	updatePreviewGeometry() {
		let point_positions = [];
		let point_colors = [];
		let displayed_points = this.points.slice();
		if (this.hover_point) displayed_points.push(this.hover_point);
		for (let point of displayed_points) {
			point_positions.push(point.position.x, point.position.y, point.position.z);
			if (point.snapped) {
				point_colors.push(0.1, 0.9, 0.12);
			} else {
				point_colors.push(0.2, 0.4, 0.98);
			}
		}
		this.points_geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(point_positions), 3));
		this.points_geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(point_colors), 3));
		return this;
	}
	addPoint(data) {
		if (!this.hover_point) this.hover(data);
		if (!this.hover_point) return;

		let last_point = this.points.last();
		if (last_point && this.hover_point) {
			let this_point = this.hover_point;
			let isSupported = (point_1, point_2) => {
				if (point_1.type == 'face' && point_2.type == 'face') {
					return point_1.fkey == point_2.fkey;
				}
				if (point_1.type == 'face' && point_2.type == 'line') {
					let face = this.mesh.faces[point_1.fkey];
					return (face && face.vertices.includes(point_2.attached_line[0]) && face.vertices.includes(point_2.attached_line[1]));
				}
				if (point_1.type == 'face' && point_2.type == 'vertex') {
					let face = this.mesh.faces[point_1.fkey];
					return (face && face.vertices.includes(point_2.attached_vertex));
				}
				if (point_1.type != 'face' && point_2.type != 'face' && (point_1.type != point_2.type || point_1 == last_point)) {
					let pointInFace = (point, vertices) => {
						if (point.type == 'line') {
							return vertices.includes(point.attached_line[0]) && vertices.includes(point.attached_line[1]);
						} else {
							return vertices.includes(point.attached_vertex)
						}
					}
					for (let fkey in this.mesh.faces) {
						let vertices = this.mesh.faces[fkey]?.vertices;
						if (pointInFace(point_1, vertices) && pointInFace(point_2, vertices)) {
							return true;
						}
					}
				}
			}
			if (!isSupported(last_point, this_point) && !isSupported(this_point, last_point)) {
				Blockbench.showQuickMessage('message.knife_tool.skipped_face', 2200);
			}
		}

		this.points.push(this.hover_point);
		this.hover_point = null;

		if (this.points.length == 1) this.showToast();
	}
	apply() {
		if (!this.mesh || !this.points.length || !Mesh.all.includes(this.mesh)) {
			this.cancel();
			return;
		}
		function intersectLinesIgnoreTouching(p1, p2, p3, p4) {
			let s1 = [ p2[0] - p1[0],   p2[1] - p1[1] ];
			let s2 = [ p4[0] - p3[0],   p4[1] - p3[1] ];
			let s = (-s1[1] * (p1[0] - p3[0]) + s1[0] * (p1[1] - p3[1])) / (-s2[0] * s1[1] + s1[0] * s2[1]);
			let t = ( s2[0] * (p1[1] - p3[1]) - s2[1] * (p1[0] - p3[0])) / (-s2[0] * s1[1] + s1[0] * s2[1]);
			return (s > 0.00001 && s < 0.99999 && t > 0.00001 && t < 0.99999);
		}
		function lineIntersectsTriangle(l1, l2, v1, v2, v3) {
			if (l1.equals(l2)) return false;
			let tri = [v1, v2, v3];
			let l1_in_tri = tri.find(corner => corner.equals(l1));
			let l2_in_tri = tri.find(corner => corner.equals(l2));
			if (l1_in_tri && l2_in_tri) {
				// Line is identical with tri edge
				return false;
			}/* else if (l1_in_tri) {
				// Nudge away from triangle center
				l1 = [
					Math.lerp(l1[0], (v1[0] + v2[0] + v3[0]) / 3, -0.001),
					Math.lerp(l1[1], (v1[1] + v2[1] + v3[1]) / 3, -0.001)
				]
			} else if (l2_in_tri) {
				// Nudge away from triangle center
				l2 = [
					Math.lerp(l2[0], (v1[0] + v2[0] + v3[0]) / 3, -0.001),
					Math.lerp(l2[1], (v1[1] + v2[1] + v3[1]) / 3, -0.001)
				]
			}*/
			return intersectLinesIgnoreTouching(l1, l2, v1, v2)
				|| intersectLinesIgnoreTouching(l1, l2, v2, v3)
				|| intersectLinesIgnoreTouching(l1, l2, v3, v1)
				|| pointInTriangle(l1.map((v, i) => Math.lerp(v, l2[i], 0.5)), v1, v2, v3)
		}

		Undo.initEdit({elements: [this.mesh]});

		let {mesh} = this;
		let all_new_fkeys = [];
		let all_new_vkeys = [];
		let all_new_edges = [];
		let old_face_normal = new THREE.Vector3();
		for (let fkey in mesh.faces) {
			let face = mesh.faces[fkey];

			let all_points = this.points.map(point => {
				if (point.fkey == fkey) return point;
				if (face.vertices.includes(point.attached_vertex)) return point;
				if (point.attached_line && point.attached_line.allAre(vkey => face.vertices.includes(vkey))) return point;
			})
			let included_points = all_points.filter(point => point);
			let new_vertex_points = included_points.filter(point => point.attached_vertex);
			if (included_points.length == 0 || (new_vertex_points.length == 1 && included_points.length == 1)) {
				continue;
			}

			let uv_data = {};
			let face_sorted_vertices = face.getSortedVertices();
			old_face_normal.fromArray(face.getNormal(true));
			delete mesh.faces[fkey];
			for (let vkey of face_sorted_vertices) {
				uv_data[vkey] = face.uv[vkey];
			}

			// Add new points as vertices
			included_points.forEach(point => {
				if (!point.vkey) {
					if (point.attached_vertex) {
						point.vkey = point.attached_vertex;
					} else if (point.reuse_of) {
						point.vkey = point.reuse_of.vkey;
					} else {
						point.vkey = mesh.addVertices(point.position.toArray())[0];
						all_new_vkeys.push(point.vkey);
					}
				}
				if (!uv_data[point.vkey]) {
					uv_data[point.vkey] = face.localToUV(point.position);
				}
			})
			let all_planned_edges = [];
			for (let i = 1; i < all_points.length; i++) {
				let point_a = all_points[i-1];
				let point_b = all_points[i];
				if (point_a && point_b) {
					all_planned_edges.push([point_a.vkey, point_b.vkey]);
				}
			}
			all_new_edges.push(...all_planned_edges);
			let mid_points = included_points.filter(point => point.type == 'face');
			let perimeter_points = included_points.filter(point => point.type != 'face');
			let mid_edges = all_planned_edges.filter(([vkey1, vkey2]) => {
				return !perimeter_points.includes(vkey1) || !perimeter_points.includes(vkey2)
			});
			let generated_edges = [];
			// Track how often each edge is connected, each edge should only be connected to 2 faces
			let edge_face_connections = {};

			let perimeter_vertices = [];
			let perimeter_edges = [];
			let covered_perimeter_edges = {};
			let created_face_edgings = [];

			// Get perimeter edges
			for (let i = 0; i < face_sorted_vertices.length; i++) {
				let vkey1 = face_sorted_vertices[i];
				perimeter_vertices.push(vkey1);
				let regular_next = face_sorted_vertices[i+1] || face_sorted_vertices[0];
				let regular_edge = [vkey1, regular_next];
				let on_edge_points = perimeter_points.filter(point => point.type == 'line' && sameMeshEdge(point.attached_line, regular_edge));
				if (on_edge_points.length) {
					let vkey1_vector = new THREE.Vector3().fromArray(mesh.vertices[vkey1]);
					on_edge_points.sort((a, b) => b.position.distanceToSquared(vkey1_vector) - a.position.distanceToSquared(vkey1_vector));
					perimeter_vertices.push(...on_edge_points.map(point => point.vkey));
				}
			}
			for (let i = 0; i < perimeter_vertices.length; i++) {
				perimeter_edges.push([perimeter_vertices[i], perimeter_vertices[i+1] || perimeter_vertices[0]]);
			}

			function getEdgeKey(edge) {
				return edge.slice().sort().join('.');
			}

			// Utility to check for points in faces
			let plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
				old_face_normal,
				Reusable.vec3.fromArray(mesh.vertices[face.vertices[0]])
			)
			let projection_rot = cameraTargetToRotation([0, 0, 0], old_face_normal.toArray());
			let projection_euler = new THREE.Euler(Math.degToRad(projection_rot[1] - 90), Math.degToRad(projection_rot[0] + 180), 0);
			function getFlatPos(vkey) {
				let coplanar_pos = plane.projectPoint(Reusable.vec4.fromArray(mesh.vertices[vkey]), Reusable.vec5);
				coplanar_pos.applyEuler(projection_euler);
				return [coplanar_pos.x, coplanar_pos.z];
			}
			function verticesToEdges(vertices) {
				return vertices.map((a, i) => ([a, vertices[i+1] || vertices[0]]));
			}
			function thingsInTri(...vertices) {
				let flat_positions = vertices.map(getFlatPos);
				for (let point of mid_points) {
					if (vertices.includes(point.vkey)) continue;
					let flat_point = getFlatPos(point.vkey);
					if (pointInTriangle(flat_point, ...flat_positions)) {
						return true;
					}
				}
				for (let edge of mid_edges.concat(generated_edges)) {
					if (sameMeshEdge(edge, vertices.slice(0, 2)) || sameMeshEdge(edge, vertices.slice(1, 3)) || sameMeshEdge(edge, [vertices[2], vertices[0]])) continue;
					let edge_a = getFlatPos(edge[0]);
					let edge_b = getFlatPos(edge[1]);
					if (lineIntersectsTriangle(edge_a, edge_b, ...flat_positions)) {
						return true;
					}
				}
				return false;
			}
			function getCornerAngle(vertices, index) {
				let vkey_a = vertices[index - 1] || vertices.last();
				let vkey_b = vertices[index];
				let vkey_c = vertices[index+1] || vertices[0];
				let vec_a = Reusable.vec1.fromArray(mesh.vertices[vkey_a]);
				let vec_b = Reusable.vec2.fromArray(mesh.vertices[vkey_b]);
				let vec_c = Reusable.vec3.fromArray(mesh.vertices[vkey_c]);
				let angle = vec_a.sub(vec_b).angleTo(vec_c.sub(vec_b));
				return Math.radToDeg(angle);
			}

			function tryMakeQuad(vkey1, vkey2, vkey3, vkey4) {
				if (!vkey1 || !vkey2 || !vkey3 || !vkey4) return;
				let vertices = [vkey1, vkey2, vkey3, vkey4];
				let face = new MeshFace(mesh, {vertices});
				if (face.isConcave()) return;
				let sorted_vertices = face.getSortedVertices();
				// Diagonals
				let diagonal_1 = [sorted_vertices[0], sorted_vertices[2]];
				let diagonal_2 = [sorted_vertices[1], sorted_vertices[3]];
				if (mid_edges.find(edge => sameMeshEdge(edge, diagonal_1) || sameMeshEdge(edge, diagonal_2))) {
					return;
				}
				// Occupied edges
				let edges = verticesToEdges(sorted_vertices);
				let occupied_edge = edges.find(edge => {
					let edge_key = getEdgeKey(edge);
					if (covered_perimeter_edges[edge_key]) return true;
					if (edge_face_connections[edge_key] >= 2) return true;
				})
				if (occupied_edge) return;
				// Face exists
				if (created_face_edgings.find(edging => {
					return edging.allAre(vkey => sorted_vertices.includes(vkey))
				})) {return;}
				// Conflicts
				if (thingsInTri(sorted_vertices[0], sorted_vertices[1], sorted_vertices[2])) return;
				if (thingsInTri(sorted_vertices[0], sorted_vertices[2], sorted_vertices[3])) return;
				if (thingsInTri(sorted_vertices[0], sorted_vertices[1], sorted_vertices[3])) return;
				if (thingsInTri(sorted_vertices[1], sorted_vertices[2], sorted_vertices[3])) return;
				// Corner angles
				for (let i = 0; i < sorted_vertices.length; i++) {
					let angle = getCornerAngle(sorted_vertices, i);
					if (angle < 1 || angle > 178) return;
				}
				return face;
			}
			function tryMakeTri(vkey1, vkey2, vkey3) {
				if (!vkey1 || !vkey2 || !vkey3) return;
				let vertices = [vkey1, vkey2, vkey3];
				// Face exists
				if (created_face_edgings.find(edging => {
					return vertices.allAre(vkey => edging.includes(vkey))
				})) {return;}
				// Conflicts
				if (thingsInTri(vkey1, vkey2, vkey3)) return;
				// Occupied edges
				let edges = verticesToEdges(vertices);
				let occupied_edge = edges.find(edge => {
					let edge_key = getEdgeKey(edge);
					if (covered_perimeter_edges[edge_key]) return true;
					if (edge_face_connections[edge_key] >= 2) return true;
				})
				if (occupied_edge) return;
				// Corner angles
				for (let i = 0; i < vertices.length; i++) {
					let angle = getCornerAngle(vertices, i);
					if (angle < 2 || angle > 178) return;
				}
				let face = new MeshFace(mesh, {vertices});
				return face;
			}
			function initFace(new_face) {
				if (face.getAngleTo(new_face) > 90) {
					new_face.invert();
				}
				for (let vkey of new_face.vertices) {
					new_face.uv[vkey] = uv_data[vkey] ? uv_data[vkey].slice() : [0, 0];
				}
				new_face.texture = face.texture;

				created_face_edgings.push(new_face.vertices);

				let edges = new_face.getEdges();
				for (let edge of edges) {
					if (
						!mid_edges.find(e2 => sameMeshEdge(edge, e2)) &&
						!perimeter_edges.find(e2 => sameMeshEdge(edge, e2)) &&
						!generated_edges.find(e2 => sameMeshEdge(edge, e2))
					) {
						generated_edges.push(edge);
					}
					let edge_key = getEdgeKey(edge);
					if (!edge_face_connections[edge_key]) edge_face_connections[edge_key] = 0;
					edge_face_connections[edge_key] += 1;
				}
				let fkey = mesh.addFaces(new_face)[0];
				all_new_fkeys.push(fkey);
				return fkey;
			}

			// Add faces from perimeter inwards
			for (let edge of perimeter_edges) {
				let edge_center = Reusable.vec2.fromArray(mesh.vertices[edge[0]].slice().V3_add(mesh.vertices[edge[1]])).divideScalar(2);
				let sortByDistance = (a, b) => {
					let a_vector = Reusable.vec5.fromArray(mesh.vertices[typeof a == 'string' ? a : a.vkey]);
					let b_vector = Reusable.vec6.fromArray(mesh.vertices[typeof b == 'string' ? b : a.vkey]);
					return a_vector.distanceToSquared(edge_center) - b_vector.distanceToSquared(edge_center);
				}
				let nearest_points = [
					...mid_points.map(point => point.vkey).sort(sortByDistance),
					...perimeter_vertices.filter(v => !edge.includes(v)).sort(sortByDistance)
				];
				let new_face = tryMakeQuad(edge[0], edge[1], nearest_points[0], nearest_points[1])
							|| tryMakeQuad(edge[0], edge[1], nearest_points[0], nearest_points[2])
							|| tryMakeQuad(edge[0], edge[1], nearest_points[1], nearest_points[2])
							|| tryMakeQuad(edge[0], edge[1], nearest_points[0], nearest_points[3])
							|| tryMakeQuad(edge[0], edge[1], nearest_points[1], nearest_points[3])
							|| tryMakeQuad(edge[0], edge[1], nearest_points[2], nearest_points[3]);
				let i = 0;
				while (!new_face && nearest_points[i]) {
					new_face = tryMakeTri(edge[0], edge[1], nearest_points[i])
					i++;
				}
				if (new_face) {
					initFace(new_face);

					// Mark edges as occupied
					covered_perimeter_edges[getEdgeKey(edge)] = true;
					// Count faces per mid edge
					let sorted_vertices = new_face.getSortedVertices();
					for (let i = 0; i < sorted_vertices.length; i++) {
						let edge1 = [sorted_vertices[i], sorted_vertices[i+1] || sorted_vertices[0]];
						if (sameMeshEdge(edge1, edge)) continue

						for (let edge2 of perimeter_edges) {
							if (sameMeshEdge(edge1, edge2)) {
								covered_perimeter_edges[getEdgeKey(edge1)] = true;
							}
						}
					}
				}
			}
			// Add missing faces between inner edges
			for (let edge of mid_edges) {
				let edge_key = getEdgeKey(edge);
				let limiter = 0;
				while (edge_face_connections[edge_key] != 2 && limiter < 5) {
					let edge_center = Reusable.vec2.fromArray(mesh.vertices[edge[0]].slice().V3_add(mesh.vertices[edge[1]])).divideScalar(2);
					let sortByDistance = (a, b) => {
						let a_vector = Reusable.vec5.fromArray(mesh.vertices[typeof a == 'string' ? a : a.vkey]);
						let b_vector = Reusable.vec6.fromArray(mesh.vertices[typeof b == 'string' ? b : a.vkey]);
						return a_vector.distanceToSquared(edge_center) - b_vector.distanceToSquared(edge_center);
					}
					let nearest_vertices = mid_points.map(point => point.vkey).filter(v => !edge.includes(v)).concat(perimeter_vertices);
					nearest_vertices.sort(sortByDistance);
					
					let new_face = tryMakeQuad(edge[0], edge[1], nearest_vertices[0], nearest_vertices[1])
								|| tryMakeQuad(edge[0], edge[1], nearest_vertices[0], nearest_vertices[2])
								|| tryMakeQuad(edge[0], edge[1], nearest_vertices[1], nearest_vertices[2])
								|| tryMakeQuad(edge[0], edge[1], nearest_vertices[0], nearest_vertices[3])
								|| tryMakeQuad(edge[0], edge[1], nearest_vertices[1], nearest_vertices[3])
								|| tryMakeQuad(edge[0], edge[1], nearest_vertices[2], nearest_vertices[3]);
					let i = 0;
					while (!new_face && nearest_vertices[i]) {
						new_face = tryMakeTri(edge[0], edge[1], nearest_vertices[i])
						i++;
					}
					if (new_face) {
						initFace(new_face);
	
						let edges = new_face.getEdges();
						for (let edge1 of edges) {
							let edge1_key = getEdgeKey(edge1);
							let is_mid_edge = mid_edges.find(e => sameMeshEdge(e, edge1));

							if (edge1_key != edge_key && !is_mid_edge && !perimeter_edges.find(e => sameMeshEdge(e, edge1))) {
								mid_edges.push(edge1);
							}
						}
					} else {
						//console.error('Knife tool: Failed to find face for edge', edge, nearest_vertices);
						break;
					}
					limiter++;
				}
			}
		}
		let selected_faces = all_new_fkeys.filter(fkey => mesh.faces[fkey].vertices.allAre(vkey => all_new_vkeys.includes(vkey)));
		mesh.getSelectedFaces(true).replace(selected_faces);
		mesh.getSelectedVertices(true).replace(all_new_vkeys);
		mesh.getSelectedEdges(true).replace(all_new_edges);
		Canvas.updateView({elements: [mesh], element_aspects: {geometry: true, uv: true, faces: true}, selection: true});
		Undo.finishEdit('Use knife tool');
		this.remove();
	}
	cancel() {
		this.remove();
	}
	remove() {
		if (this.mesh_3d) {
			this.mesh_3d.remove(this.points_mesh);
			this.mesh_3d.remove(this.lines_mesh);
		}
		delete this.mesh;
		delete this.mesh_3d;
		if (this.toast) this.toast.delete();
		this.unselect_listener.delete();
		KnifeToolContext.current = null;
	}
	static current = null;
}
export class KnifeToolCubeContext {
	constructor(cube) {
		this.cube = cube;
		this.face;
		this.first_point_set = false;
		this.valid_position = false;
		this.axis = 0;
		this.face_axis = 0;
		this.first_point = new THREE.Vector3();
		this.offset = 0;
		this.preview_mesh = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			new THREE.MeshBasicMaterial({color: Canvas.outlineMaterial.color}),
		)
		this.cross_mesh = new THREE.Mesh(
			new THREE.PlaneGeometry(1, 1),
			new THREE.MeshBasicMaterial({
				map: KnifeToolCubeContext.map,
				alphaTest: 0.1,
				side: THREE.DoubleSide,
				color: Canvas.outlineMaterial.color
			}),
		);

		this.unselect_listener = Blockbench.on('unselect_project', context => {
			if (this == KnifeToolContext.current) {
				this.remove();
			}
		})
		KnifeToolContext.current = this;
	}
	get mesh_3d() {
		return this.cube.mesh;
	}
	get axis_letter() {
		return getAxisLetter(this.axis);
	}
	hover(data) {
		if (!data || data.element instanceof Cube == false) {
			if (this.cross_mesh.parent) {
				this.cross_mesh.parent.remove(this.cross_mesh);
			}
			return;
		}
		let intersect = data.intersects[0];
		if (!this.first_point_set) {
			this.cube = data.element;
			this.face = data.face;
			this.first_point.copy(intersect.point);
			this.mesh_3d.worldToLocal(this.first_point);

			this.face_axis = KnifeToolCubeContext.face_axis[this.face];
			let off_axes = [0, 1, 2].filter(a1 => a1 != this.face_axis);
			let snap = canvasGridSize(data.event?.shiftKey || Pressing.overrides.shift, data.event?.ctrlOrCmd || Pressing.overrides.ctrl);
			let modified_from = this.cube.from.slice().V3_subtract(this.cube.inflate);

			this.first_point[getAxisLetter(off_axes[0])] = Math.round((this.first_point[getAxisLetter(off_axes[0])] - modified_from[off_axes[0]]) / snap) * snap + modified_from[off_axes[0]];
			this.first_point[getAxisLetter(off_axes[1])] = Math.round((this.first_point[getAxisLetter(off_axes[1])] - modified_from[off_axes[1]]) / snap) * snap + modified_from[off_axes[1]];

		} else if (this.cube) {
			this.mesh_3d.add(this.preview_mesh);
			this.face_axis = KnifeToolCubeContext.face_axis[this.face];
			let off_axes = [0, 1, 2].filter(a1 => a1 != this.face_axis);

			let second_point = intersect.point;
			this.mesh_3d.worldToLocal(second_point);
			let val_1 = this.first_point[getAxisLetter(off_axes[0])] - second_point[getAxisLetter(off_axes[0])];
			let val_2 = this.first_point[getAxisLetter(off_axes[1])] - second_point[getAxisLetter(off_axes[1])];
			let direction = Math.abs(val_1) > Math.abs(val_2);
			switch (this.face_axis) {
				case 0: this.axis = direction ? 2 : 1; break;
				case 1: this.axis = direction ? 2 : 0; break;
				case 2: this.axis = direction ? 1 : 0; break;
			}
			this.offset = this.first_point[this.axis_letter];
		}
		this.updatePreview();
	}
	updatePreview() {
		let pos = this.mesh_3d.localToWorld(new THREE.Vector3().copy(this.first_point));
		let size = Preview.selected.calculateControlScale(pos) / 8;
		if (!this.first_point_set) {
			this.mesh_3d.add(this.cross_mesh);
			this.cross_mesh.position.copy(this.first_point);
			let face_axis = KnifeToolCubeContext.face_axis[this.face];
			let face_direction = ['north', 'west', 'down'].includes(this.face) ? -1 : 1;
			this.cross_mesh.position[getAxisLetter(face_axis)] += face_direction * size;
			switch (face_axis) {
				case 0: this.cross_mesh.rotation.set(0, Math.PI/2, 0); break;
				case 1: this.cross_mesh.rotation.set(Math.PI/2, 0, 0); break;
				case 2: this.cross_mesh.rotation.set(0, 0, 0); break;
			}
	
			this.cross_mesh.scale.set(size * 16, size * 16, size * 16);
		} else {
			if (this.cross_mesh.parent) {
				this.cross_mesh.parent.remove(this.cross_mesh);
			}
			this.mesh_3d.add(this.preview_mesh);
			this.preview_mesh.position.set(
				Math.lerp(this.cube.from[0] - this.cube.origin[0], this.cube.to[0] - this.cube.origin[0], 0.5),
				Math.lerp(this.cube.from[1] - this.cube.origin[1], this.cube.to[1] - this.cube.origin[1], 0.5),
				Math.lerp(this.cube.from[2] - this.cube.origin[2], this.cube.to[2] - this.cube.origin[2], 0.5),
			)
			this.preview_mesh.position[this.axis_letter] = this.offset;
	
			let pos = THREE.fastWorldPosition(this.preview_mesh);
			let size = Preview.selected.calculateControlScale(pos) / 8;
			this.preview_mesh.scale.set(...this.cube.size().map(v => v + this.cube.inflate * 2 + size));
			this.preview_mesh.scale[this.axis_letter] = size;
		}
	}
	addPoint(data) {
		if (!data?.element) return;
		if (!this.first_point_set) {
			this.first_point_set = true;
		} else {
			this.apply();
		}
	}
	apply() {
		if (!this.cube || !Cube.all.includes(this.cube) || !this.first_point_set) {
			this.cancel();
			return;
		}
		let elements = [this.cube];
		Undo.initEdit({elements});

		if (this.cube.box_uv && Format.optional_box_uv) {
			this.cube.box_uv = false;
		}
		let duplicate = splitCube(this.cube, this.axis, this.offset);
		Outliner.selected.safePush(duplicate);
		elements.safePush(duplicate);

		Canvas.updateView({elements, element_aspects: {geometry: true, uv: true}, selection: true});
		Undo.finishEdit('Use knife tool');
		this.remove();
	}
	cancel() {
		this.remove();
	}
	remove() {
		if (this.cross_mesh.parent) {
			this.cross_mesh.parent.remove(this.cross_mesh);
		}
		if (this.preview_mesh.parent) {
			this.preview_mesh.parent.remove(this.preview_mesh);
		}
		delete this.cube;
		delete this.cross_mesh;
		delete this.precross_meshview_mesh;
		this.unselect_listener.delete();
		KnifeToolContext.current = null;
	}
	static face_axis = {
		north: 2,
		south: 2,
		up: 1,
		down: 1,
		east: 0,
		west: 0
	}
	static map = new THREE.TextureLoader().load('assets/crosshair.png');
}
KnifeToolCubeContext.map.magFilter = KnifeToolCubeContext.map.minFilter = THREE.NearestFilter;

BARS.defineActions(() => {
	
	new Tool('knife_tool', {
		icon: 'surgical',
		transformerMode: 'hidden',
		category: 'tools',
		selectElements: true,
		cursor: 'crosshair',
		raycast_options: {
			edges: true,
			vertices: true,
		},
		modes: ['edit'],
		condition: () => Modes.edit,
		onCanvasMouseMove(data) {
			if (Mesh.selected[0]) {
				if (!KnifeToolContext.current && Mesh.selected.length == 1) {
					KnifeToolContext.current = new KnifeToolContext(Mesh.selected[0]);
				}
			} else if (Cube.all[0]) {
				if (!KnifeToolContext.current) {
					KnifeToolContext.current = new KnifeToolCubeContext();
				}
			}
			if (KnifeToolContext.current) {
				KnifeToolContext.current.hover(data);
			}
		},
		onCanvasClick(data) {
			if (!data || !data.type) return;
			if (data.event instanceof TouchEvent) {
				// Stop controls on mobile
				PointerTarget.requestTarget(PointerTarget.types.gizmo_transform);
				function onTouchEnd() {
					PointerTarget.endTarget();
					document.removeEventListener('touchend', onTouchEnd);
				}
				document.addEventListener('touchend', onTouchEnd);
			}
			if (!KnifeToolContext.current) {
				if (data.element instanceof Mesh) {
					if (!KnifeToolContext.current && Mesh.selected.length == 1) {
						KnifeToolContext.current = new KnifeToolContext(data.element);
					}
					if (KnifeToolContext.current) {
						KnifeToolContext.current.hover(data);
					}
				} else if (data.element instanceof Cube) {
					if (!KnifeToolContext.current) {
						KnifeToolContext.current = new KnifeToolCubeContext(data.element);
					}
				}
				if (data.event instanceof TouchEvent) return;
			}
			let context = KnifeToolContext.current;
			if (context) {
				context.addPoint(data);
			}
		},
		onSelect() {
			Interface.addSuggestedModifierKey('shift', 'modifier_actions.snap_to_center');
			Interface.addSuggestedModifierKey('ctrl', 'modifier_actions.snap_to_pixels');
		},
		onUnselect() {
			Interface.removeSuggestedModifierKey('shift', 'modifier_actions.snap_to_center');
			Interface.removeSuggestedModifierKey('ctrl', 'modifier_actions.snap_to_pixels');
			if (KnifeToolContext.current) {
				KnifeToolContext.current.apply();
			}
		}
	})
})

export function splitCube(cube, axis, offset_value) {
	let duplicate = cube.duplicate();

	let modified_from = cube.from.slice().V3_subtract(cube.inflate);
	let modified_to = cube.to.slice().V3_subtract(cube.inflate);
	let offset = offset_value + cube.origin[axis];
	let offset_lerp = Math.getLerp(modified_from[axis], modified_to[axis], offset);

	cube.to[axis] = offset - cube.inflate;
	duplicate.from[axis] = offset + cube.inflate;

	function modifyUV(face, index, inverted) {
		index = (index - (face.rotation/90) + 8) % 4;
		let index_opposite = (index+2)%4;
		if (inverted) {
			face.uv[index] = Math.lerp(face.uv[index], face.uv[index_opposite], offset_lerp);
		} else {
			face.uv[index] = Math.lerp(face.uv[index_opposite], face.uv[index], offset_lerp);
		}
	}
	switch (axis) {
		case 0: {
			modifyUV(cube.faces.north, 0);
			modifyUV(cube.faces.south, 2);
			modifyUV(cube.faces.up, 2);
			modifyUV(cube.faces.down, 2);

			modifyUV(duplicate.faces.north, 2, true);
			modifyUV(duplicate.faces.south, 0, true);
			modifyUV(duplicate.faces.up, 0, true);
			modifyUV(duplicate.faces.down, 0, true);
			break;
		}
		case 1: {
			modifyUV(cube.faces.north, 1);
			modifyUV(cube.faces.south, 1);
			modifyUV(cube.faces.east, 1);
			modifyUV(cube.faces.west, 1);

			modifyUV(duplicate.faces.north, 3, true);
			modifyUV(duplicate.faces.south, 3, true);
			modifyUV(duplicate.faces.east, 3, true);
			modifyUV(duplicate.faces.west, 3, true);
			break;
		}
		case 2: {
			modifyUV(cube.faces.east, 0);
			modifyUV(cube.faces.west, 2);
			modifyUV(cube.faces.up, 3);
			modifyUV(cube.faces.down, 1);

			modifyUV(duplicate.faces.east, 2, true);
			modifyUV(duplicate.faces.west, 0, true);
			modifyUV(duplicate.faces.up, 1, true);
			modifyUV(duplicate.faces.down, 3, true);
			break;
		}
	}
	return duplicate;
}

const global = {
	KnifeToolContext,
	KnifeToolCubeContext,
}
Object.assign(window, global);
