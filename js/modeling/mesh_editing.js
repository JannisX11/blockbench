function sameMeshEdge(edge_a, edge_b) {
	return edge_a.equals(edge_b) || (edge_a[0] == edge_b[1] && edge_a[1] == edge_b[0])
}

const ProportionalEdit = {
	vertex_weights: {},
	calculateWeights(mesh) {
		if (!BarItems.proportional_editing.value) return;
	
		let selected_vertices = mesh.getSelectedVertices();
		let {range, falloff, selection} = ProportionalEdit.config;
		let linear_distance = selection == 'linear';
		
		let all_mesh_connections;
		if (!linear_distance) {
			all_mesh_connections = {};
			for (let fkey in mesh.faces) {
				let face = mesh.faces[fkey];
				face.getEdges().forEach(edge => {
					if (!all_mesh_connections[edge[0]]) {
						all_mesh_connections[edge[0]] = [edge[1]];
					} else {
						all_mesh_connections[edge[0]].safePush(edge[1]);
					}
					if (!all_mesh_connections[edge[1]]) {
						all_mesh_connections[edge[1]] = [edge[0]];
					} else {
						all_mesh_connections[edge[1]].safePush(edge[0]);
					}
				})
			}
		}

		ProportionalEdit.vertex_weights[mesh.uuid] = {};
	
		for (let vkey in mesh.vertices) {
			if (selected_vertices.includes(vkey)) continue;
	
			let distance = Infinity;
			if (linear_distance) {
				// Linear Distance
				selected_vertices.forEach(vkey2 => {
					let pos1 = mesh.vertices[vkey];
					let pos2 = mesh.vertices[vkey2];
					let distance_square = Math.pow(pos1[0] - pos2[0], 2) + Math.pow(pos1[1] - pos2[1], 2) + Math.pow(pos1[2] - pos2[2], 2);
					if (distance_square < distance) {
						distance = distance_square;
					}
				})
				distance = Math.sqrt(distance);
			} else {
				// Connection Distance
				let found_match_depth = 0;
				let scanned = [];
				let frontier = [vkey];
	
				depth_crawler:
				for (let depth = 1; depth <= range; depth++) {
					let new_frontier = [];
					for (let vkey1 of frontier) {
						let connections = all_mesh_connections[vkey1]?.filter(vkey2 => !scanned.includes(vkey2));
						if (!connections || connections.length == 0) continue;
						scanned.push(...connections);
						new_frontier.push(...connections);
					}
					for (let vkey2 of new_frontier) {
						if (selected_vertices.includes(vkey2)) {
							found_match_depth = depth;
							break depth_crawler;
						}
					}
					frontier = new_frontier;
				}
				if (found_match_depth) {
					distance = found_match_depth;
				}
			}
			if (distance > range) continue;
	
			let blend = 1 - (distance / (linear_distance ? range : range+1));
			switch (falloff) {
				case 'hermite_spline': blend = Math.hermiteBlend(blend); break;
				case 'constant': blend = 1; break;
			}
			ProportionalEdit.vertex_weights[mesh.uuid][vkey] = blend;
		}
	},
	editVertices(mesh, per_vertex) {
		if (!BarItems.proportional_editing.value) return;

		let selected_vertices = mesh.getSelectedVertices();
		for (let vkey in mesh.vertices) {
			if (selected_vertices.includes(vkey)) continue;
	
			let blend = ProportionalEdit.vertex_weights[mesh.uuid][vkey];
			per_vertex(vkey, blend);
		}
	}
}

class KnifeToolContext {
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
class KnifeToolCubeContext {
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

		} else {
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
		let duplicate = this.cube.duplicate();
		Outliner.selected.safePush(duplicate);
		elements.safePush(duplicate);
		let modified_from = this.cube.from.slice().V3_subtract(this.cube.inflate);
		let modified_to = this.cube.to.slice().V3_subtract(this.cube.inflate);
		let offset = this.offset + this.cube.origin[this.axis];
		let offset_lerp = Math.getLerp(modified_from[this.axis], modified_to[this.axis], offset);

		this.cube.to[this.axis] = offset - this.cube.inflate;
		duplicate.from[this.axis] = offset + this.cube.inflate;

		function modifyUV(face, index, inverted) {
			index = (index - (face.rotation/90) + 8) % 4;
			let index_opposite = (index+2)%4;
			if (inverted) {
				face.uv[index] = Math.lerp(face.uv[index], face.uv[index_opposite], offset_lerp);
			} else {
				face.uv[index] = Math.lerp(face.uv[index_opposite], face.uv[index], offset_lerp);
			}
		}
		switch (this.axis) {
			case 0: {
				modifyUV(this.cube.faces.north, 0);
				modifyUV(this.cube.faces.south, 2);
				modifyUV(this.cube.faces.up, 2);
				modifyUV(this.cube.faces.down, 2);

				modifyUV(duplicate.faces.north, 2, true);
				modifyUV(duplicate.faces.south, 0, true);
				modifyUV(duplicate.faces.up, 0, true);
				modifyUV(duplicate.faces.down, 0, true);
				break;
			}
			case 1: {
				modifyUV(this.cube.faces.north, 1);
				modifyUV(this.cube.faces.south, 1);
				modifyUV(this.cube.faces.east, 1);
				modifyUV(this.cube.faces.west, 1);

				modifyUV(duplicate.faces.north, 3, true);
				modifyUV(duplicate.faces.south, 3, true);
				modifyUV(duplicate.faces.east, 3, true);
				modifyUV(duplicate.faces.west, 3, true);
				break;
			}
			case 2: {
				modifyUV(this.cube.faces.east, 0);
				modifyUV(this.cube.faces.west, 2);
				modifyUV(this.cube.faces.up, 3);
				modifyUV(this.cube.faces.down, 1);

				modifyUV(duplicate.faces.east, 2, true);
				modifyUV(duplicate.faces.west, 0, true);
				modifyUV(duplicate.faces.up, 1, true);
				modifyUV(duplicate.faces.down, 3, true);
				break;
			}
		}

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

async function autoFixMeshEdit() {
	let meshes = Mesh.selected;
	if (!meshes.length || !Modes.edit || BarItems.selection_mode.value == 'object') return;

	// Merge Vertices
	let overlaps = {};
	let e = 0.004;
	meshes.forEach(mesh => {
		let mesh_overlaps = {};
		let vertices = mesh.getSelectedVertices();
		for (let vkey of vertices) {
			let vertex = mesh.vertices[vkey];
			let matches = [];
			for (let vkey2 in mesh.vertices) {
				if (vkey2 == vkey || mesh_overlaps[vkey2]) continue;
				let vertex2 = mesh.vertices[vkey2];
				let same_spot = Math.epsilon(vertex[0], vertex2[0], e) && Math.epsilon(vertex[1], vertex2[1], e) && Math.epsilon(vertex[2], vertex2[2], e);
				if (same_spot) {
					matches.push(vkey2);
				}
			}
			if (matches.length) {
				mesh_overlaps[vkey] = matches;
			}
		}
		if (Object.keys(mesh_overlaps).length) overlaps[mesh.uuid] = mesh_overlaps;
	})
	if (Object.keys(overlaps).length) {
		await new Promise(resolve => {Blockbench.showMessageBox({
			title: 'message.auto_fix_mesh_edit.title',
			message: 'message.auto_fix_mesh_edit.overlapping_vertices',
			commands: {
				merge: {text: 'message.auto_fix_mesh_edit.merge_vertices', description: '('+tl('dialog.recommended_option')+')'},
				revert: 'message.auto_fix_mesh_edit.revert'
			},
			buttons: ['dialog.ignore']
		}, result => {
			if (result == 'revert') {
				Undo.undo();
			} else if (result == 'merge') {

				let meshes = Mesh.selected.filter(m => overlaps[m.uuid]);
				Undo.initEdit({ elements: meshes });
				let merge_counter = 0;
				let cluster_counter = 0;
				for (let mesh_id in overlaps) {
					let mesh = Mesh.selected.find(m => m.uuid == mesh_id);
					let selected_vertices = mesh.getSelectedVertices(true);
					for (let first_vertex in overlaps[mesh_id]) {
						let other_vertices = overlaps[mesh_id][first_vertex];
						cluster_counter++;

						for (let vkey of other_vertices) {
							for (let fkey in mesh.faces) {
								let face = mesh.faces[fkey];
								let index = face.vertices.indexOf(vkey);
								if (index === -1) continue;

								if (face.vertices.includes(first_vertex)) {
									face.vertices.remove(vkey);
									delete face.uv[vkey];
									if (face.vertices.length < 2) {
										delete mesh.faces[fkey];
									} else if (face.vertices.length == 2) {
										// Find face that overlaps the remaining edge
										for (let fkey2 in mesh.faces) {
											let face2 = mesh.faces[fkey2];
											if (face2.vertices.length >= 3 && face2.vertices.includes(face.vertices[0]) && face2.vertices.includes(face.vertices[1])) {
												delete mesh.faces[fkey];
											}
										}
									}
								} else {
									let uv = face.uv[vkey];
									face.vertices.splice(index, 1, first_vertex);
									face.uv[first_vertex] = uv;
									delete face.uv[vkey];
								}
							}
							delete mesh.vertices[vkey];
							selected_vertices.remove(vkey);
							merge_counter++;
						}
					}
				}
				Undo.finishEdit('Auto-merge vertices')
				Canvas.updateView({elements: meshes, element_aspects: {geometry: true, uv: true, faces: true}, selection: true});
				Blockbench.showQuickMessage(tl('message.merged_vertices', [merge_counter, cluster_counter]), 2000);
			}
			resolve();
		})})
	}

	// Concave quads
	let concave_faces = {};
	meshes.forEach(mesh => {
		let selected_faces = mesh.getSelectedFaces();
		let selected_vertices = mesh.getSelectedVertices();
		let concave_faces_mesh = [];
		for (let fkey in mesh.faces) {
			let face = mesh.faces[fkey];
			if (face.vertices.length != 4) continue;
			// Check if face is selected or touches selection
			if (!selected_faces.includes(fkey) && !face.vertices.find(vkey => selected_vertices.includes(vkey))) continue;
			//let vertices = face.getSortedVertices().map(vkey => mesh.vertices[vkey]);
			let concave = face.isConcave();
			if (concave != false) {
				concave_faces_mesh.push([fkey, concave]);
			}
		}
		if (concave_faces_mesh.length) concave_faces[mesh.uuid] = concave_faces_mesh;
	})
	
	if (Object.keys(concave_faces).length) {
		await new Promise(resolve => {Blockbench.showMessageBox({
			title: 'message.auto_fix_mesh_edit.title',
			message: 'message.auto_fix_mesh_edit.concave_quads',
			commands: {
				split: {text: 'message.auto_fix_mesh_edit.split_quads', description: '('+tl('dialog.recommended_option')+')'},
				revert: 'message.auto_fix_mesh_edit.revert'
			},
			buttons: ['dialog.ignore']
		}, result => {
			if (result == 'revert') {
				Undo.undo();
			} else if (result == 'split') {

				let meshes = Mesh.selected.filter(m => concave_faces[m.uuid]);
				Undo.initEdit({ elements: meshes });
				for (let mesh of meshes) {
					let selected_faces = mesh.getSelectedFaces(true);
					for (let [fkey, concave_vkey] of concave_faces[mesh.uuid]) {
						let face = mesh.faces[fkey];

						// Find the edge that needs to be connected
						let sorted_vertices = face.getSortedVertices();
						let edges = [
							[sorted_vertices[0], sorted_vertices[1]],
							[sorted_vertices[0], sorted_vertices[2]],
							[sorted_vertices[0], sorted_vertices[3]],
							[sorted_vertices[1], sorted_vertices[2]],
							[sorted_vertices[1], sorted_vertices[3]],
							[sorted_vertices[2], sorted_vertices[3]],
						]
						edges = edges.filter(edge => {
							for (let fkey2 in mesh.faces) {
								if (fkey2 == fkey) continue;
								let face2 = mesh.faces[fkey2];
								if (face2.vertices.includes(edge[0]) && face2.vertices.includes(edge[1])) {
									return false;
								}
							}
							return true;
						})
						let off_corners = edges.find(edge => !edge.includes(concave_vkey))
						if (!off_corners) {
							// not sure if this always works, but its only required in special cases (if the quad edge that should be split is already connected to another face).
							let concave_index = sorted_vertices.indexOf(concave_vkey);
							off_corners = (concave_index%2) ? [sorted_vertices[1], sorted_vertices[3]] : [sorted_vertices[0], sorted_vertices[2]];
						}

						let new_face = new MeshFace(mesh, face);
						new_face.vertices.remove(off_corners[0]);
						delete new_face.uv[off_corners[0]];

						face.vertices.remove(off_corners[1]);
						delete face.uv[off_corners[1]];

						let [face_key] = mesh.addFaces(new_face);
						selected_faces.safePush(face_key);
						if (face.getAngleTo(new_face) > 90) {
							new_face.invert();
						}
					}

				}
				Undo.finishEdit('Auto-fix concave quads');
				Canvas.updateView({elements: meshes, element_aspects: {geometry: true, uv: true, faces: true}, selection: true});
			}
			resolve();
		})})
	}
}

function cleanupOverlappingMeshFaces(mesh) {
	for (let fkey in mesh.faces) {
		let face = mesh.faces[fkey];
		if (face.vertices.length < 2) {
			delete mesh.faces[fkey];
		} else {
			for (let fkey2 in mesh.faces) {
				let face2 = mesh.faces[fkey2];
				if (fkey == fkey2 || !face2) continue;
				let overlaps = face.vertices.allAre(vkey => face2.vertices.includes(vkey));
				if (overlaps) {
					delete mesh.faces[fkey];
				}
			}
		}
	}
}

SharedActions.add('delete', {
	condition: () => Modes.edit && Prop.active_panel == 'preview' && Mesh.selected[0] && Project.mesh_selection[Mesh.selected[0].uuid],
	run() {
		let meshes = Mesh.selected.slice();
		let keep_vertices = BarItems.delete.keybind.additionalModifierTriggered(event, 'keep_vertices');
		Undo.initEdit({elements: meshes, outliner: true, selection: true})

		Mesh.selected.forEach(mesh => {
			let selected_vertices = mesh.getSelectedVertices();
			let selected_edges = mesh.getSelectedEdges();
			let selected_faces = mesh.getSelectedFaces();

			if ((BarItems.selection_mode.value == 'face' || BarItems.selection_mode.value == 'cluster') && selected_faces.length < Object.keys(mesh.faces).length) {
				let affected_vertices = [];
				let affected_edges = [];
				selected_faces.forEach(fkey => {
					let face = mesh.faces[fkey];
					affected_vertices.safePush(...face.vertices);
					if (keep_vertices) {
						affected_edges.push(...face.getEdges());
					}
					delete mesh.faces[fkey];
				})
				if (keep_vertices) {
					edges: for (let edge of affected_edges) {
						for (let fkey in mesh.faces) {
							let vertices = mesh.faces[fkey].vertices;
							if (vertices.includes(edge[0]) && vertices.includes(edge[1])) {
								continue edges;
							}
						}
						mesh.addFaces(new MeshFace(mesh, {vertices: edge}));
					}
				} else {
					affected_vertices.forEach(vertex_key => {
						let used = false;
						for (let key in mesh.faces) {
							let face = mesh.faces[key];
							if (face.vertices.includes(vertex_key)) used = true;
						}
						if (!used) {
							delete mesh.vertices[vertex_key];
						}
					})
				}
			} else if (BarItems.selection_mode.value == 'edge') {
				for (let key in mesh.faces) {
					let face = mesh.faces[key];
					let sorted_vertices = face.getSortedVertices();
					let has_edge = sorted_vertices.find((vkey_a, i) => {
						let vkey_b = sorted_vertices[i+1] || sorted_vertices[0];
						let edge = [vkey_a, vkey_b];
						return selected_edges.find(edge2 => sameMeshEdge(edge, edge2))
					})
					if (has_edge) {
						delete mesh.faces[key];
					}
				}
				selected_edges.forEachReverse(edge => {
					edge.forEach(vkey => {
						let used = false;
						for (let key in mesh.faces) {
							let face = mesh.faces[key];
							if (face.vertices.includes(vkey)) used = true;
						}
						if (!used && !keep_vertices) {
							delete mesh.vertices[vkey];
							selected_vertices.remove(vkey);
							selected_edges.remove(edge);
						}
					})
				})

			} else if (BarItems.selection_mode.value == 'vertex' && selected_vertices.length < Object.keys(mesh.vertices).length) {
				selected_vertices.forEach(vkey => {
					for (let key in mesh.faces) {
						let face = mesh.faces[key];
						if (!face.vertices.includes(vkey)) continue;
						if (face.vertices.length > 2) {
							let initial_normal;
							if (face.vertices.length == 4) {
								initial_normal = face.getNormal();
							}
							face.vertices.remove(vkey);
							delete face.uv[vkey];
							
							if (face.vertices.length == 3 && face.getAngleTo(initial_normal) > 90) {
								face.invert();
							}
							if (face.vertices.length == 2) {
								for (let fkey2 in mesh.faces) {
									if (fkey2 != key && !face.vertices.find(vkey => !mesh.faces[fkey2].vertices.includes(vkey))) {
										delete mesh.faces[key];
										break;
									}
								}
							}
						} else {
							delete mesh.faces[key];
						}
					}
					delete mesh.vertices[vkey];
				})
			} else {
				meshes.remove(mesh);
				mesh.remove(false);
			}
		})

		Undo.finishEdit('Delete mesh part')
		Canvas.updateView({elements: meshes, selection: true, element_aspects: {geometry: true, faces: true, uv: meshes.length > 0}})
	}
})
SharedActions.add('select_all', {
	condition: () => Modes.edit && Mesh.selected.length && Mesh.selected.length === Outliner.selected.length && BarItems.selection_mode.value !== 'object',
	priority: 1,
	run() {
		let selection_mode = BarItems.selection_mode.value;
		if (selection_mode == 'vertex') {
			let unselect = Mesh.selected[0].getSelectedVertices().length == Object.keys(Mesh.selected[0].vertices).length;
			Mesh.selected.forEach(mesh => {
				if (unselect) {
					mesh.getSelectedVertices(true).empty();
				} else {
					mesh.getSelectedVertices(true).replace(Object.keys(mesh.vertices));
				}
			})
		} else if (selection_mode == 'edge') {
			let unselect = Mesh.selected[0].getSelectedVertices().length == Object.keys(Mesh.selected[0].vertices).length;
			Mesh.selected.forEach(mesh => {
				if (unselect) {
					mesh.getSelectedVertices(true).empty();
					mesh.getSelectedEdges(true).empty();
				} else {
					mesh.getSelectedVertices(true).replace(Object.keys(mesh.vertices));
					let edges = mesh.getSelectedEdges(true);
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						let f_vertices = face.getSortedVertices();
						f_vertices.forEach((vkey_a, i) => {
							let edge = [vkey_a, (f_vertices[i+1] || f_vertices[0])];
							if (edges.find(edge2 => sameMeshEdge(edge2, edge))) return;
							edges.push(edge);
						})
					}
				}
			})
		} else {
			let unselect = Mesh.selected[0].getSelectedFaces().length == Object.keys(Mesh.selected[0].faces).length;
			Mesh.selected.forEach(mesh => {
				if (unselect) {
					delete Project.mesh_selection[mesh.uuid];
				} else {
					mesh.getSelectedVertices(true).replace(Object.keys(mesh.vertices));
					mesh.getSelectedFaces(true).replace(Object.keys(mesh.faces));
				}
			})
		}
		updateSelection();
	}
})
SharedActions.add('unselect_all', {
	condition: () => Modes.edit && Mesh.selected.length && Mesh.selected.length === Outliner.selected.length && BarItems.selection_mode.value !== 'object',
	priority: 1,
	run() {
		Mesh.selected.forEach(mesh => {
			delete Project.mesh_selection[mesh.uuid];
		})
		updateSelection();
	}
})
SharedActions.add('invert_selection', {
	condition: () => Modes.edit && Mesh.selected.length && Mesh.selected.length === Outliner.selected.length && BarItems.selection_mode.value !== 'object',
	priority: 1,
	run() {
		let selection_mode = BarItems.selection_mode.value;
		if (selection_mode == 'vertex') {
			Mesh.selected.forEach(mesh => {
				let selected = mesh.getSelectedVertices();
				let now_selected = Object.keys(mesh.vertices).filter(vkey => !selected.includes(vkey));
				mesh.getSelectedVertices(true).replace(now_selected);
			})
		} else if (selection_mode == 'edge') {
			Mesh.selected.forEach(mesh => {
				let old_edges = mesh.getSelectedEdges().slice();
				let vertices = mesh.getSelectedVertices(true).empty();
				let edges = mesh.getSelectedEdges(true).empty();
				
				for (let fkey in mesh.faces) {
					let face = mesh.faces[fkey];
					let f_vertices = face.getSortedVertices();
					f_vertices.forEach((vkey_a, i) => {
						let edge = [vkey_a, (f_vertices[i+1] || f_vertices[0])];
						if (!old_edges.find(edge2 => sameMeshEdge(edge2, edge))) {
							edges.push(edge);
							vertices.safePush(edge[0], edge[1]);
						}
					})
				}
			})
		} else {
			Mesh.selected.forEach(mesh => {
				let old_faces = mesh.getSelectedFaces().slice();
				let vertices = mesh.getSelectedVertices(true).empty();
				let faces = mesh.getSelectedFaces(true).empty();
				
				for (let fkey in mesh.faces) {
					if (!old_faces.includes(fkey)) {
						let face = mesh.faces[fkey];
						faces.push(fkey);
						vertices.safePush(...face.vertices);
					}
				}
			})
		}
		updateSelection();
	}
})

BARS.defineActions(function() {
	let add_mesh_dialog = new Dialog({
		id: 'add_primitive',
		title: 'action.add_mesh',
		form: {
			shape: {label: 'dialog.add_primitive.shape', type: 'select', options: {
				cuboid: 'dialog.add_primitive.shape.cube',
				beveled_cuboid: 'dialog.add_primitive.shape.beveled_cuboid',
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
			align_edges: {label: 'dialog.add_primitive.align_edges', type: 'checkbox', value: true, condition: ({shape}) => !['cuboid', 'beveled_cuboid', 'pyramid', 'plane'].includes(shape)},
			height: {label: 'dialog.add_primitive.height', type: 'number', value: 8, condition: ({shape}) => ['cylinder', 'cone', 'cuboid', 'beveled_cuboid', 'pyramid', 'tube'].includes(shape)},
			sides: {label: 'dialog.add_primitive.sides', type: 'number', value: 12, min: 3, max: 48, condition: ({shape}) => ['cylinder', 'cone', 'circle', 'torus', 'sphere', 'tube'].includes(shape)},
			minor_diameter: {label: 'dialog.add_primitive.minor_diameter', type: 'number', value: 4, condition: ({shape}) => ['torus', 'tube'].includes(shape)},
			minor_sides: {label: 'dialog.add_primitive.minor_sides', type: 'number', value: 8, min: 2, max: 32, condition: ({shape}) => ['torus'].includes(shape)},
			edge_size: {label: 'dialog.add_primitive.edge_size', type: 'number', value: 2, condition: ({shape}) => ['beveled_cuboid'].includes(shape)},
		},
		onConfirm(result) {
			let original_selection_group = Group.first_selected && Group.first_selected.uuid;
			let iteration = 0;
			function runEdit(amended, result) {
				let elements = [];
				if (original_selection_group && !Group.first_selected) {
					let group_to_select = Group.all.find(g => g.uuid == original_selection_group);
					if (group_to_select) {
						Group.first_selected = group_to_select;
					}
				}
				Undo.initEdit({elements, selection: true}, amended);
				let mesh = new Mesh({
					name: result.shape,
					vertices: {}
				});
				let group = getCurrentGroup();
				if (group) {
					mesh.addTo(group);
					if (settings.inherit_parent_color.value) mesh.color = group.color;
				}
				let diameter_factor = result.align_edges ? 1 / Math.cos(Math.PI/result.sides) : 1;
				let off_ang = result.align_edges ? 0.5 : 0;

				if (result.shape == 'circle') {
					let vertex_keys = mesh.addVertices([0, 0, 0]);
					let [m] = vertex_keys;

					for (let i = 0; i < result.sides; i++) {
						let x = Math.sin(((i+off_ang) / result.sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
						let z = Math.cos(((i+off_ang) / result.sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
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
						let x = Math.sin(((i+off_ang) / result.sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
						let z = Math.cos(((i+off_ang) / result.sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
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
						let x = Math.sin(((i+off_ang) / result.sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
						let z = Math.cos(((i+off_ang) / result.sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
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

					let outer_r = result.diameter/2 * diameter_factor;
					let inner_r = (outer_r - result.minor_diameter/2) * diameter_factor;
					for (let i = 0; i < result.sides; i++) {
						let x = Math.sin(((i+off_ang) / result.sides) * Math.PI * 2);
						let z = Math.cos(((i+off_ang) / result.sides) * Math.PI * 2);
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
						let circle_x = Math.sin(((i+off_ang) / result.sides) * Math.PI * 2);
						let circle_z = Math.cos(((i+off_ang) / result.sides) * Math.PI * 2);

						let vertices = [];
						for (let j = 0; j < result.minor_sides; j++) {
							let slice_x = Math.sin((j / result.minor_sides) * Math.PI * 2) * result.minor_diameter/2*diameter_factor;
							let x = circle_x * (result.diameter/2*diameter_factor + slice_x)
							let y = Math.cos((j / result.minor_sides) * Math.PI * 2) * result.minor_diameter/2*diameter_factor;
							let z = circle_z * (result.diameter/2*diameter_factor + slice_x)
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
						let circle_x = Math.sin(((i+off_ang) / result.sides) * Math.PI * 2);
						let circle_z = Math.cos(((i+off_ang) / result.sides) * Math.PI * 2);

						let vertices = [];
						for (let j = 1; j < (sides/2); j++) {

							let slice_x = Math.sin((j / sides) * Math.PI * 2) * result.diameter/2 * diameter_factor;
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
				if (result.shape == 'cuboid') {
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
				if (result.shape == 'beveled_cuboid') {
					let s = result.edge_size;
					let rs = result.diameter/2 - s;
					let r = result.diameter/2;
					let h = result.height;
					let hs = result.height - s;

					let up = mesh.addVertices(
						[rs, h, rs],	// 0
						[rs, h, -rs],	// 1
						[-rs, h, rs],	// 2
						[-rs, h, -rs],	// 3
					)
					let down = mesh.addVertices(
						[rs, 0, rs],	// 4
						[rs, 0, -rs],	// 5
						[-rs, 0, rs],	// 6
						[-rs, 0, -rs],	// 7
					)
					let west = mesh.addVertices(
						[-r, s, rs],	// 8
						[-r, hs, rs],	// 9
						[-r, s, -rs],	// 10
						[-r, hs, -rs],	// 11
					)
					let east = mesh.addVertices(
						[r, s, rs],		// 12
						[r, hs, rs],	// 13
						[r, s, -rs],	// 14
						[r, hs, -rs],	// 15
					)
					let north = mesh.addVertices(
						[rs, s, -r],	// 16
						[rs, hs, -r],	// 17
						[-rs, s, -r],	// 18
						[-rs, hs, -r],	// 19
					)
					let south = mesh.addVertices(
						[rs, s, r],		// 20
						[rs, hs, r],	// 21
						[-rs, s, r],	// 22
						[-rs, hs, r]	// 23
					)
					mesh.addFaces(
						new MeshFace( mesh, {vertices: [ east[1], east[0], east[3], east[2] ]} ), // East
						new MeshFace( mesh, {vertices: [ west[0], west[1], west[3], west[2] ]} ), // West
						new MeshFace( mesh, {vertices: [ up[0], up[1], up[3], up[2] ]} ), // Up
						new MeshFace( mesh, {vertices: [ down[1], down[0], down[3], down[2] ]} ), // Down
						new MeshFace( mesh, {vertices: [ south[0], south[1], south[3], south[2] ]} ), // South
						new MeshFace( mesh, {vertices: [ north[1], north[0], north[3], north[2] ]} ), // North
					);
					mesh.addFaces(
						new MeshFace( mesh, {vertices: [up[1], up[0], east[1], east[3]]} ), // E Up
						new MeshFace( mesh, {vertices: [up[2], up[3], west[1], west[3]]} ), // W Up
						new MeshFace( mesh, {vertices: [up[0], up[2], south[1], south[3]]} ), // S Up
						new MeshFace( mesh, {vertices: [up[3], up[1], north[1], north[3]]} ), // N Up
						new MeshFace( mesh, {vertices: [down[0], down[1], east[0], east[2]]} ), // E Down
						new MeshFace( mesh, {vertices: [down[3], down[2], west[0], west[2]]} ), // W Down
						new MeshFace( mesh, {vertices: [down[2], down[0], south[0], south[2]]} ), // S Down
						new MeshFace( mesh, {vertices: [down[1], down[3], north[0], north[2]]} ), // N Down

						new MeshFace( mesh, {vertices: [north[0], north[1], east[2], east[3]]} ), // NE
						new MeshFace( mesh, {vertices: [south[1], south[0], east[0], east[1]]} ), // SE
						new MeshFace( mesh, {vertices: [north[3], north[2], west[2], west[3]]} ), // NW
						new MeshFace( mesh, {vertices: [south[2], south[3], west[0], west[1]]} )  // SW
					);
					mesh.addFaces(
						new MeshFace( mesh, {vertices: [down[0], east[0], south[0]]} ), // Down1
						new MeshFace( mesh, {vertices: [down[2], south[2], west[0]]} ), // Down2
						new MeshFace( mesh, {vertices: [down[1], north[0], east[2]]} ), // Down3
						new MeshFace( mesh, {vertices: [down[3], west[2], north[2]]} ), // Down4
						new MeshFace( mesh, {vertices: [up[0], south[1], east[1]]} ), // Up1
						new MeshFace( mesh, {vertices: [up[2], west[1], south[3]]} ), // Up2
						new MeshFace( mesh, {vertices: [up[1], east[3], north[1]]} ), // Up3
						new MeshFace( mesh, {vertices: [up[3], north[3], west[3]]} )  // Up4
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
				unselectAllElements()
				mesh.select()
				UVEditor.setAutoSize(null, true, Object.keys(mesh.faces));
				Undo.finishEdit('Add primitive');
				Blockbench.dispatchEvent( 'add_mesh', {object: mesh} )
				iteration++;

				Vue.nextTick(function() {
					if (settings.create_rename.value && iteration == 1) {
						mesh.rename()
					}
				})
			}
			runEdit(false, result);

			Undo.amendEdit({
				diameter: {label: 'dialog.add_primitive.diameter', type: 'num_slider', value: result.diameter, interval_type: 'position'},
				height: {label: 'dialog.add_primitive.height', type: 'num_slider', value: result.height, condition: ['cylinder', 'cone', 'cuboid', 'beveled_cuboid', 'pyramid', 'tube'].includes(result.shape), interval_type: 'position'},
				sides: {label: 'dialog.add_primitive.sides', type: 'num_slider', value: result.sides, min: 3, max: 48, condition: ['cylinder', 'cone', 'circle', 'torus', 'sphere', 'tube'].includes(result.shape)},
				minor_diameter: {label: 'dialog.add_primitive.minor_diameter', type: 'num_slider', value: result.minor_diameter, condition: ['torus', 'tube'].includes(result.shape), interval_type: 'position'},
				minor_sides: {label: 'dialog.add_primitive.minor_sides', type: 'num_slider', value: result.minor_sides, min: 2, max: 32, condition: ['torus'].includes(result.shape)},
				edge_size: {label: 'dialog.add_primitive.edge_size', type: 'num_slider', value: result.edge_size, condition: ['beveled_cuboid'].includes(result.shape)},
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
	let previous_selection_mode = 'object';
	new BarSelect('selection_mode', {
		options: {
			object: {name: true, icon: 'far.fa-gem'},
			cluster: {name: true, icon: 'link'},
			face: {name: true, icon: 'far.fa-square'},
			edge: {name: true, icon: 'pen_size_3'},
			vertex: {name: true, icon: 'fiber_manual_record'},
		},
		icon_mode: true,
		condition: () => Modes.edit && Mesh.hasAny() && Toolbox.selected.id != 'knife_tool',
		onChange({value}) {
			if (value == 'cluster') value = 'face';
			if (value === previous_selection_mode) return;
			if (value === 'object') {
				Mesh.selected.forEach(mesh => {
					delete Project.mesh_selection[mesh.uuid];
				})
			} else if (value === 'face') {
				Mesh.selected.forEach(mesh => {
					let selected_faces = mesh.getSelectedFaces(true);
					selected_faces.empty();
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						if (face.isSelected(fkey)) {
							selected_faces.safePush(fkey);
						}
					}
				})
			}
			if ((value == 'face' || value == 'cluster') && ['edge', 'vertex'].includes(previous_selection_mode)) {
				Mesh.selected.forEach(mesh => {
					let vertices = mesh.getSelectedVertices();
					let faces = mesh.getSelectedFaces(true);
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						if (face.vertices.allAre(vkey => vertices.includes(vkey))) {
							faces.safePush(fkey);
						}
					}
				})
			}
			if (value == 'edge') {
				Mesh.selected.forEach(mesh => {
					let edges = mesh.getSelectedEdges(true);
					edges.empty();
				})
			}
			if (value == 'edge' && ['face', 'cluster'].includes(previous_selection_mode)) {
				Mesh.selected.forEach(mesh => {
					let edges = mesh.getSelectedEdges(true);
					let faces = mesh.getSelectedFaces(true);
					faces.forEach(fkey => {
						let face = mesh.faces[fkey];
						let vertices = face.getSortedVertices();
						vertices.forEach((vkey_a, i) => {
							let edge = [vkey_a, (vertices[i+1] || vertices[0])];
							if (!edges.find(edge2 => sameMeshEdge(edge2, edge))) {
								edges.push(edge);
							}
						})
					})
					faces.empty();
				})
			}
			if (value == 'edge' && ['vertex', 'cluster'].includes(previous_selection_mode)) {
				Mesh.selected.forEach(mesh => {
					let edges = mesh.getSelectedEdges(true);
					let vertices = mesh.getSelectedVertices();
					if (!vertices.length) return;
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						let f_vertices = face.getSortedVertices();
						f_vertices.forEach((vkey_a, i) => {
							let edge = [vkey_a, (f_vertices[i+1] || f_vertices[0])];
							if (!vertices.includes(edge[0]) || !vertices.includes(edge[1])) return;
							if (edges.find(edge2 => sameMeshEdge(edge2, edge))) return;
							edges.push(edge);
						})
					}
				})
			}
			if (value == 'vertex' && ['face', 'cluster'].includes(previous_selection_mode)) {
				Mesh.selected.forEach(mesh => {
					let faces = mesh.getSelectedFaces(true);
					faces.empty();
				})
			}
			if (value == 'vertex' && ['edge', 'cluster'].includes(previous_selection_mode)) {
				Mesh.selected.forEach(mesh => {
					let edges = mesh.getSelectedEdges(true);
					edges.empty();
				})
			}
			updateSelection();
			previous_selection_mode = value;
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
		condition: () => Modes.edit && Mesh.hasAny(),
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
			if (!data) return;
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
			}
			let context = KnifeToolContext.current;
			context.addPoint(data);
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
	new BarSelect('select_seam', {
		options: {
			auto: true,
			divide: true,
			join: true,
		},
		condition: () => Modes.edit && Mesh.hasAny(),
		onChange({value}) {
			if (value == 'auto') value = null;
			Undo.initEdit({elements: Mesh.selected});
			Mesh.selected.forEach(mesh => {
				let selected_edges = mesh.getSelectedEdges();
				selected_edges.forEach(edge => {
					mesh.setSeam(edge, value);
				})
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
				let selected_vertices = mesh.getSelectedVertices();
				let selected_faces = mesh.getSelectedFaces(true);
				selected_faces.empty();
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
						if (match_strength == face.vertices.length) {
							delete mesh.faces[key];
						}
					}
					// Split face
					if (
						reference_face &&
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
							selected_faces.push(face_key);


							if (reference_face.getAngleTo(new_face) > 90) {
								new_face.invert();
							}
						}

					} else {
						
						let new_face = new MeshFace(mesh, {
							vertices: selected_vertices,
							texture: reference_face?.texture,
						} );
						let [face_key] = mesh.addFaces(new_face);
						selected_faces.push(face_key);
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
						selected_faces.push(face_key);

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
			Undo.initEdit({elements: Cube.selected, outliner: true});

			let new_meshes = [];
			Cube.selected.forEach(cube => {
				
				let mesh = new Mesh({
					name: cube.name,
					color: cube.color,
					origin: cube.origin,
					rotation: cube.rotation,
					vertices: []
				})
				let rotation_euler = new THREE.Euler(0, 0, 0, 'ZYX').fromArray(cube.rotation.map(Math.degToRad));
				rotation_euler.reorder('XYZ');
				mesh.rotation.V3_set(rotation_euler.toArray().map(r => Math.roundTo(Math.radToDeg(r), 4)));

				var adjustedFrom = cube.from.slice();
				var adjustedTo = cube.to.slice();
				adjustFromAndToForInflateAndStretch(adjustedFrom, adjustedTo, cube);
				for (let i = 0; i < adjustedFrom.length; i++) {
					adjustedFrom[i] -= cube.origin[i];
					adjustedTo[i] -= cube.origin[i]
				}
				let vertex_keys = [
					mesh.addVertices([adjustedTo[0],	adjustedTo[1], 		adjustedTo[2]   ])[0],
					mesh.addVertices([adjustedTo[0],	adjustedTo[1], 		adjustedFrom[2] ])[0],
					mesh.addVertices([adjustedTo[0],	adjustedFrom[1], 	adjustedTo[2]   ])[0],
					mesh.addVertices([adjustedTo[0],	adjustedFrom[1], 	adjustedFrom[2] ])[0],
					mesh.addVertices([adjustedFrom[0],	adjustedTo[1], 		adjustedTo[2]   ])[0],
					mesh.addVertices([adjustedFrom[0],	adjustedTo[1], 		adjustedFrom[2] ])[0],
					mesh.addVertices([adjustedFrom[0],	adjustedFrom[1], 	adjustedTo[2]   ])[0],
					mesh.addVertices([adjustedFrom[0],	adjustedFrom[1], 	adjustedFrom[2] ])[0],
				];

				let unused_vkeys = vertex_keys.slice();
				function addFace(direction, vertices) {
					let cube_face = cube.faces[direction];
					if (cube_face.texture === null) return;
					let uv_points = [
						[cube_face.uv[0], cube_face.uv[1]],
						[cube_face.uv[2], cube_face.uv[1]],
						[cube_face.uv[2], cube_face.uv[3]],
						[cube_face.uv[0], cube_face.uv[3]]
					];
					let rotation = cube_face.rotation || 0;
					while (rotation > 0) {
						rotation -= 90;
						uv_points.splice(0, 0, uv_points.pop());
					}
					let uv = {
						[vertices[0]]: uv_points[1],
						[vertices[1]]: uv_points[0],
						[vertices[2]]: uv_points[2],
						[vertices[3]]: uv_points[3],
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
				selected.push(mesh);
				cube.remove();
			})
			updateSelection();
			Undo.finishEdit('Convert cubes to meshes', {elements: new_meshes, outliner: true});
		}
	})
	new Action('apply_mesh_rotation', {
		icon: 'published_with_changes',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected.length)},
		click() {
			let vec = new THREE.Vector3();
			Undo.initEdit({elements: Mesh.selected});
			Mesh.selected.forEach(mesh => {
				let rotation = mesh.mesh.rotation;
				for (let vkey in mesh.vertices) {
					vec.fromArray(mesh.vertices[vkey]);
					vec.applyEuler(rotation);
					mesh.vertices[vkey].V3_set(vec.x, vec.y, vec.z);
				}
				mesh.rotation.V3_set(0, 0, 0);
			})
			Undo.finishEdit('Apply mesh rotation')
			Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, transform: true}, selection: true})
		}
	})
	new Action('invert_face', {
		icon: 'flip_to_back',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedFaces().length)},
		click() {
			Undo.initEdit({elements: Mesh.selected});
			Mesh.selected.forEach(mesh => {
				for (let fkey in mesh.faces) {
					let face = mesh.faces[fkey];
					if (face.isSelected(fkey)) {
						face.invert();
					}
				}
			})
			Undo.finishEdit('Invert mesh faces');
			Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}});
		}
	})
	new Action('switch_face_crease', {
		icon: 'signal_cellular_off',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedFaces().find(fkey => Mesh.selected[0].faces[fkey].vertices.length == 4))},
		click() {
			Undo.initEdit({elements: Mesh.selected});
			Mesh.selected.forEach(mesh => {
				for (let fkey in mesh.faces) {
					let face = mesh.faces[fkey];
					if (face.vertices.length == 4 && face.isSelected(fkey)) {
						let new_vertices = face.getSortedVertices().slice();
						new_vertices.push(new_vertices.shift());
						face.vertices.replace(new_vertices);
					}
				}
			})
			Undo.finishEdit('Switch mesh face crease');
			Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}});
		}
	})
	new Action('extrude_mesh_selection', {
		icon: 'upload',
		category: 'edit',
		keybind: new Keybind({key: 'e', shift: true}),
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length)},
		click() {
			function runEdit(amended, extend = 1, direction_mode, even_extend) {
				Undo.initEdit({elements: Mesh.selected, selection: true}, amended);

				Mesh.selected.forEach(mesh => {
					let original_vertices = mesh.getSelectedVertices().slice();
					let selected_edges = mesh.getSelectedEdges(true);
					let selected_face_keys = mesh.getSelectedFaces();
					let new_vertices;
					let new_face_keys = [];
					if (original_vertices.length && (BarItems.selection_mode.value == 'vertex' || BarItems.selection_mode.value == 'edge')) {
						selected_face_keys.empty();
					}
					let selected_faces = selected_face_keys.map(fkey => mesh.faces[fkey]);
					let combined_direction;

					selected_faces.forEach(face => {
						original_vertices.safePush(...face.vertices);
					})
					selected_edges.forEach(edge => {
						original_vertices.safePush(...edge);
					})

					if (original_vertices.length >= 3 && !selected_faces.length) {
						let [a, b, c] = original_vertices.slice(0, 3).map(vkey => mesh.vertices[vkey].slice());
						let normal = new THREE.Vector3().fromArray(a.V3_subtract(c));
						normal.cross(new THREE.Vector3().fromArray(b.V3_subtract(c))).normalize();

						let face;
						for (let fkey in mesh.faces) {
							let face2 = mesh.faces[fkey];
							let face_selected_vertices = face2.vertices.filter(vkey => original_vertices.includes(vkey));
							if (face_selected_vertices.length >= 2 && face_selected_vertices.length < face2.vertices.length && face2.vertices.length > 2) {
								face = face2;
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
					if (direction_mode == 'average' && selected_faces.length) {
						combined_direction = [0, 0, 0];
						for (let face of selected_faces) {
							let normal = face.getNormal(true);
							combined_direction.V3_add(normal);
						}
						combined_direction.V3_divide(selected_faces.length);
					}

					new_vertices = mesh.addVertices(...original_vertices.map(key => {
						let vector = mesh.vertices[key].slice();
						let direction;
						let count = 0;
						switch (direction_mode) {
							case 'average': direction = combined_direction; break;
							case 'y+': direction = [0, 1, 0]; break;
							case 'y-': direction = [0, -1, 0]; break;
							case 'x+': direction = [1, 0, 0]; break;
							case 'x-': direction = [-1, 0, 0]; break;
							case 'z+': direction = [0, 0, 1]; break;
							case 'z-': direction = [0, 0, -1]; break;
						}
						if (!direction) {
							let directions = [];
							selected_faces.forEach(face => {
								if (face.vertices.includes(key)) {
									count++;
									let face_normal = face.getNormal(true);
									directions.push(face_normal);
									if (!direction) {
										direction = face_normal
									} else {
										direction.V3_add(face_normal);
									}
								}
							})
							if (count > 1) {
								let magnitude = Math.sqrt(direction[0]**2 + direction[1]**2 + direction[2]**2);
								direction.V3_divide(magnitude);
								if (even_extend) {
									let a = new THREE.Vector3().fromArray(directions[0]);
									let b = new THREE.Vector3().fromArray(directions[1]);
									let angle = a.angleTo(b);
									direction.V3_divide(Math.cos(angle));
								}
							}
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
								let difference = new THREE.Vector3();
								let signs_done = [];
								match.vertices.forEach(vkey => {
									let sign = original_vertices.includes(vkey) ? 1 : -1;
									difference.x += mesh.vertices[vkey][0] * sign;
									difference.y += mesh.vertices[vkey][1] * sign;
									difference.z += mesh.vertices[vkey][2] * sign;
									signs_done.push(sign);
								})
								direction = difference.normalize().toArray();

							} else if (match) {
								// perpendicular edge, currently unused
								direction = match.getNormal(true);
							} else {
								direction = [0, 1, 0];
							}
						}

						vector.V3_add(direction.map(v => v * extend));
						return vector;
					}))
					Project.mesh_selection[mesh.uuid].vertices.replace(new_vertices);

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

					// Create Faces for extruded edges
					let new_faces = [];
					selected_edges.forEach(edge => {
						let face, sorted_vertices;
						for (let fkey in mesh.faces) {
							let face2 = mesh.faces[fkey];
							let vertices = face2.vertices;
							if (vertices.includes(edge[0]) && vertices.includes(edge[1])) {
								face = face2;
								sorted_vertices = vertices;
								break;
							}
						}
						if (sorted_vertices[0] == edge[0] && sorted_vertices[1] != edge[1]) {
							edge.reverse();
						}
						let [a, b] = edge.map(vkey => new_vertices[original_vertices.indexOf(vkey)]);
						let [c, d] = edge;
						let new_face = new MeshFace(mesh, face).extend({
							vertices: [a, b, c, d]
						});
						if (new_face.getAngleTo(face) > 90) {
							new_face.invert();
						}
						let [face_key] = mesh.addFaces(new_face);
						new_face_keys.push(face_key);
						new_faces.push(new_face);
						remaining_vertices.remove(a);
						remaining_vertices.remove(b);
					})

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

					// Update edge selection
					selected_edges.forEach(edge => {
						edge.forEach((vkey, i) => {
							edge[i] = new_vertices[original_vertices.indexOf(vkey)];
						});
					})

					UVEditor.setAutoSize(null, true, new_face_keys);
				})
				Undo.finishEdit('Extrude mesh selection');
				Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true});
			}
			runEdit();

			Undo.amendEdit({
				extend: {type: 'num_slider', value: 1, label: 'edit.extrude_mesh_selection.extend', interval_type: 'position'},
				direction_mode: {type: 'select', label: 'edit.extrude_mesh_selection.direction', options: {
					outwards: 'edit.extrude_mesh_selection.direction.outwards',
					average: 'edit.extrude_mesh_selection.direction.average',
					'y+': 'Y+',
					'y-': 'Y-',
					'x+': 'X+',
					'x-': 'X-',
					'z+': 'Z+',
					'z-': 'Z-',
				}},
				even_extend: {type: 'checkbox', value: false, label: 'edit.extrude_mesh_selection.even_extend'},
			}, form => {
				runEdit(true, form.extend, form.direction_mode, form.even_extend);
			})
		}
	})
	new Action('solidify_mesh_selection', {
		icon: 'bottom_panel_open',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes'], method: () => (Mesh.selected[0] && Mesh.selected[0].getSelectedFaces().length)},
		click() {
			function runEdit(amended, extend = 1) {
				Undo.initEdit({elements: Mesh.selected, selection: true}, amended);

				Mesh.selected.forEach(mesh => {
					let original_vertices = [];
					let new_vertices;
					let new_face_keys = [];
					let selected_face_keys = mesh.getSelectedFaces(true);
					let selected_faces = selected_face_keys.map(fkey => mesh.faces[fkey]);
					let combined_direction;

					selected_faces.forEach(face => {
						original_vertices.safePush(...face.vertices);
					})

					// Calculate direction
					if (original_vertices.length >= 3 && !selected_faces.length) {
						let [a, b, c] = original_vertices.slice(0, 3).map(vkey => mesh.vertices[vkey].slice());
						let normal = new THREE.Vector3().fromArray(a.V3_subtract(c));
						normal.cross(new THREE.Vector3().fromArray(b.V3_subtract(c))).normalize();

						let face;
						for (let fkey in mesh.faces) {
							let face2 = mesh.faces[fkey];
							let face_selected_vertices = face2.vertices.filter(vkey => original_vertices.includes(vkey));
							if (face_selected_vertices.length >= 2 && face_selected_vertices.length < face2.vertices.length && face2.vertices.length > 2) {
								face = face2;
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
								let difference = new THREE.Vector3();
								let signs_done = [];
								match.vertices.forEach(vkey => {
									let sign = original_vertices.includes(vkey) ? 1 : -1;
									difference.x += mesh.vertices[vkey][0] * sign;
									difference.y += mesh.vertices[vkey][1] * sign;
									difference.z += mesh.vertices[vkey][2] * sign;
									signs_done.push(sign);
								})
								direction = difference.normalize().toArray();

							} else if (match) {
								// perpendicular edge, currently unused
								direction = match.getNormal(true);
							} else {
								direction = [0, 1, 0];
							}
						}

						vector.V3_add(direction.map(v => v * extend));
						return vector;
					}))
					Project.mesh_selection[mesh.uuid].vertices.replace(new_vertices);

					// Duplicate faces
					selected_faces.forEach(face => {
						// Copy face and invert
						let face_copy = new MeshFace(mesh, face);
						let [new_face_key] = mesh.addFaces(face_copy);
						selected_face_keys.push(new_face_key);
						face_copy.invert();

						// Move original face to new spot
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
							selected_face_keys.push(face_key);
							new_face_keys.push(face_key);
							remaining_vertices.remove(a);
							remaining_vertices.remove(b);
						})

						if (vertices.length == 2) delete mesh.faces[selected_face_keys[face_index]];
					})

					UVEditor.setAutoSize(null, true, new_face_keys);
				})
				Undo.finishEdit('Solidify mesh selection');
				Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true});
			}
			runEdit();

			Undo.amendEdit({
				thickness: {type: 'num_slider', value: 1, label: 'edit.solidify_mesh_selection.thickness', interval_type: 'position'},
			}, form => {
				runEdit(true, form.thickness);
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
					let original_vertices = mesh.getSelectedVertices();
					if (original_vertices.length < 3) return;
					original_vertices = original_vertices.slice();
					let new_vertices;
					let selected_face_keys = mesh.getSelectedFaces();
					let selected_faces = selected_face_keys.map(fkey => mesh.faces[fkey]);
					let modified_face_keys = selected_face_keys.slice();
	
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
	
					Project.mesh_selection[mesh.uuid].vertices.replace(new_vertices);
	
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

							let new_face_vertices = [
								b,
								a,
								original_vertices[new_vertices.indexOf(a)],
								original_vertices[new_vertices.indexOf(b)],
							];
							let new_face_uv = {
								[a]: face.uv[a],
								[b]: face.uv[b],
								[new_face_vertices[2]]: face.uv[a],
								[new_face_vertices[3]]: face.uv[b],
							};
							let new_face = new MeshFace(mesh, mesh.faces[selected_face_keys[face_index]]).extend({
								vertices: new_face_vertices,
								uv: new_face_uv
							});
							let [fkey] = mesh.addFaces(new_face);
							modified_face_keys.push(fkey);
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
					UVEditor.setAutoSize(null, true, modified_face_keys);

				})
				Undo.finishEdit('Extrude mesh selection')
				Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
			}
			runEdit();

			Undo.amendEdit({
				offset: {type: 'num_slider', value: 50, label: 'edit.loop_cut.offset', min: 0, max: 100, interval_type: 'position'},
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
			let selected_face, selected_face_key;
			let saved_direction = 0;
			Mesh.selected.forEach(mesh => {
				if (!selected_face) {
					selected_face_key = mesh.getSelectedFaces()[0];
					selected_face = mesh.faces[selected_face_key];
				}
			})
			function getLength(direction = 0) {
				selected_face = Mesh.selected.last().faces[selected_face_key];
				if (selected_face) {
					let vertices = selected_face.getSortedVertices();
					let pos1 = Mesh.selected[0].vertices[vertices[(0 + direction) % selected_face.vertices.length]];
					let pos2 = Mesh.selected[0].vertices[vertices[(1 + direction) % selected_face.vertices.length]];
					return Math.sqrt(Math.pow(pos2[0] - pos1[0], 2) + Math.pow(pos2[1] - pos1[1], 2) + Math.pow(pos2[2] - pos1[2], 2));
				} else {
					let vertices = Mesh.selected[0].getSelectedVertices();
					let pos1 = Mesh.selected[0].vertices[vertices[0]];
					let pos2 = Mesh.selected[0].vertices[vertices[1]];
					return Math.sqrt(Math.pow(pos2[0] - pos1[0], 2) + Math.pow(pos2[1] - pos1[1], 2) + Math.pow(pos2[2] - pos1[2], 2));
				}
			}
			let length = getLength();

			function runEdit(amended, offset, direction = 0, cuts = 1) {
				Undo.initEdit({elements: Mesh.selected, selection: true}, amended);
				if (offset == undefined) offset = length / (cuts+1);
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
					let center_vertices_map = {};

					function getCenterVertex(vertices, ratio) {
						let edge_key = vertices.slice().sort().join('.');
						let existing_key = center_vertices_map[edge_key];
						if (existing_key) return existing_key;

						let vector = mesh.vertices[vertices[0]].map((v, i) => Math.lerp(v, mesh.vertices[vertices[1]][i], ratio))
						let [vkey] = mesh.addVertices(vector);
						center_vertices_map[edge_key] = vkey;
						return vkey;
					}

					function splitFace(face, side_vertices, double_side, cut_no) {
						processed_faces.push(face);
						let sorted_vertices = face.getSortedVertices();

						let side_index_diff = sorted_vertices.indexOf(side_vertices[0]) - sorted_vertices.indexOf(side_vertices[1]);
						if (side_index_diff == -1 || side_index_diff > 2) side_vertices.reverse();

						if (face.vertices.length == 4) {

							let opposite_vertices = sorted_vertices.filter(vkey => !side_vertices.includes(vkey));
							let opposite_index_diff = sorted_vertices.indexOf(opposite_vertices[0]) - sorted_vertices.indexOf(opposite_vertices[1]);
							if (opposite_index_diff == 1 || opposite_index_diff < -2) opposite_vertices.reverse();

							let ratio = offset/length;
							if (cuts > 1) {
								ratio = 1 - (1 / (cuts + 1 - cut_no) * ratio * 2);
							}
							let center_vertices = [
								getCenterVertex(side_vertices, ratio),
								getCenterVertex(opposite_vertices, ratio)
							]

							let c1_uv_coords = [
								Math.lerp(face.uv[side_vertices[0]][0], face.uv[side_vertices[1]][0], ratio),
								Math.lerp(face.uv[side_vertices[0]][1], face.uv[side_vertices[1]][1], ratio),
							];
							let c2_uv_coords = [
								Math.lerp(face.uv[opposite_vertices[0]][0], face.uv[opposite_vertices[1]][0], ratio),
								Math.lerp(face.uv[opposite_vertices[0]][1], face.uv[opposite_vertices[1]][1], ratio),
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

							// Multiple loop cuts
							if (cut_no+1 < cuts) {
								splitFace(face, [center_vertices[0], side_vertices[0]], double_side, cut_no+1);
							}

							if (cut_no != 0) return;
							// Find next (and previous) face
							for (let fkey in mesh.faces) {
								let ref_face = mesh.faces[fkey];
								if (ref_face.vertices.length < 3 || processed_faces.includes(ref_face)) continue;
								let vertices = ref_face.vertices.filter(vkey => opposite_vertices.includes(vkey))
								if (vertices.length >= 2) {
									splitFace(ref_face, opposite_vertices, ref_face.vertices.length == 4, 0);
									break;
								}
							}

							if (double_side) {
								for (let fkey in mesh.faces) {
									let ref_face = mesh.faces[fkey];
									if (ref_face.vertices.length < 3 || processed_faces.includes(ref_face)) continue;
									let vertices = ref_face.vertices.filter(vkey => side_vertices.includes(vkey))
									if (vertices.length >= 2) {
										let ref_sorted_vertices = ref_face.getSortedVertices();
										let ref_opposite_vertices = ref_sorted_vertices.filter(vkey => !side_vertices.includes(vkey));
										
										if (ref_opposite_vertices.length == 2) {
											splitFace(ref_face, ref_opposite_vertices, ref_face.vertices.length == 4, 0);
											break;
										} else if (ref_opposite_vertices.length == 1) {
											splitFace(ref_face, side_vertices, false, 0);
											break;
										}
									}
								}
							}

						} else if (face.vertices.length == 3) {
							if (direction > 2) {
								// Split tri from edge to edge

								let opposed_vertex = sorted_vertices.find(vkey => !side_vertices.includes(vkey));
								let opposite_vertices = [opposed_vertex, side_vertices[direction % side_vertices.length]];

								let opposite_index_diff = sorted_vertices.indexOf(opposite_vertices[0]) - sorted_vertices.indexOf(opposite_vertices[1]);
								if (opposite_index_diff == 1 || opposite_index_diff < -2) opposite_vertices.reverse();

								let ratio = offset/length;
								if (cuts > 1) {
									ratio = 1 - (1 / (cuts + 1 - cut_no) * ratio * 2);
								}
								let center_vertices = [
									getCenterVertex(side_vertices, ratio),
									getCenterVertex(opposite_vertices, ratio)
								]

								let c1_uv_coords = [
									Math.lerp(face.uv[side_vertices[0]][0], face.uv[side_vertices[1]][0], ratio),
									Math.lerp(face.uv[side_vertices[0]][1], face.uv[side_vertices[1]][1], ratio),
								];
								let c2_uv_coords = [
									Math.lerp(face.uv[opposite_vertices[0]][0], face.uv[opposite_vertices[1]][0], ratio),
									Math.lerp(face.uv[opposite_vertices[0]][1], face.uv[opposite_vertices[1]][1], ratio),
								];

								let other_quad_vertex = side_vertices.find(vkey => !opposite_vertices.includes(vkey));
								let other_tri_vertex = side_vertices.find(vkey => opposite_vertices.includes(vkey));
								let new_face = new MeshFace(mesh, face).extend({
									vertices: [other_tri_vertex, center_vertices[0], center_vertices[1]],
									uv: {
										[other_tri_vertex]: face.uv[other_tri_vertex],
										[center_vertices[0]]: c1_uv_coords,
										[center_vertices[1]]: c2_uv_coords,
									}
								})
								if (new_face.getAngleTo(face) > 90) {
									new_face.invert();
								}
								face.extend({
									vertices: [opposed_vertex, center_vertices[0], center_vertices[1], other_quad_vertex],
									uv: {
										[opposed_vertex]: face.uv[opposed_vertex],
										[center_vertices[0]]: c1_uv_coords,
										[center_vertices[1]]: c2_uv_coords,
										[other_quad_vertex]: face.uv[other_quad_vertex],
									}
								})
								if (face.getAngleTo(new_face) > 90) {
									face.invert();
								}
								mesh.addFaces(new_face);

								// Multiple loop cuts
								if (cut_no+1 < cuts) {
									splitFace(face, [center_vertices[0], other_quad_vertex], double_side, cut_no+1);
								}

								if (cut_no != 0) return;
								// Find next (and previous) face
								for (let fkey in mesh.faces) {
									let ref_face = mesh.faces[fkey];
									if (ref_face.vertices.length < 3 || processed_faces.includes(ref_face)) continue;
									let vertices = ref_face.vertices.filter(vkey => opposite_vertices.includes(vkey))
									if (vertices.length >= 2) {
										splitFace(ref_face, opposite_vertices, ref_face.vertices.length == 4, 0);
										break;
									}
								}

								if (double_side) {
									for (let fkey in mesh.faces) {
										let ref_face = mesh.faces[fkey];
										if (ref_face.vertices.length < 3 || processed_faces.includes(ref_face)) continue;
										let vertices = ref_face.vertices.filter(vkey => side_vertices.includes(vkey))
										if (vertices.length >= 2) {
											let ref_sorted_vertices = ref_face.getSortedVertices();
											let ref_opposite_vertices = ref_sorted_vertices.filter(vkey => !side_vertices.includes(vkey));
											
											if (ref_opposite_vertices.length == 2) {
												splitFace(ref_face, ref_opposite_vertices, ref_face.vertices.length == 4, 0);
												break;
											}
										}
									}
								}
							} else {
								let opposite_vertex = sorted_vertices.find(vkey => !side_vertices.includes(vkey));

								let ratio = offset/length;
								if (cuts > 1) {
									ratio = 1 - (1 / (cuts + 1 - cut_no) * ratio * 2);
								}
								let center_vertex = getCenterVertex(side_vertices, ratio);

								let c1_uv_coords = [
									Math.lerp(face.uv[side_vertices[0]][0], face.uv[side_vertices[1]][0], ratio),
									Math.lerp(face.uv[side_vertices[0]][1], face.uv[side_vertices[1]][1], ratio),
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
								if (direction % 3 == 2) {
									new_face.invert();
									face.invert();
								}
								mesh.addFaces(new_face);
							}
						} else if (face.vertices.length == 2) {

							let ratio = offset/length;
							if (cuts > 1) {
								ratio = 1 - (1 / (cuts + 1 - cut_no) * ratio * 2);
							}
							let center_vertex = getCenterVertex(side_vertices, ratio);

							let c1_uv_coords = [
								Math.lerp(face.uv[side_vertices[0]][0], face.uv[side_vertices[1]][0], ratio),
								Math.lerp(face.uv[side_vertices[0]][1], face.uv[side_vertices[1]][1], ratio),
							];

							let new_face = new MeshFace(mesh, face).extend({
								vertices: [side_vertices[1], center_vertex],
								uv: {
									[side_vertices[1]]: face.uv[side_vertices[1]],
									[center_vertex]: c1_uv_coords,
								}
							})
							face.extend({
								vertices: [center_vertex, side_vertices[0]],
								uv: {
									[center_vertex]: c1_uv_coords,
									[side_vertices[0]]: face.uv[side_vertices[0]],
								}
							})
							mesh.addFaces(new_face);

							// Multiple loop cuts
							if (cut_no+1 < cuts) {
								splitFace(face, [center_vertex, side_vertices[0]], double_side, cut_no+1);
							}
						}
					}

					let start_vertices = start_face.getSortedVertices().filter((vkey, i) => selected_vertices.includes(vkey));
					let start_edge = [start_vertices[direction % start_vertices.length], start_vertices[(direction+1) % start_vertices.length]];
					if (start_edge.length == 1) start_edge.splice(0, 0, start_vertices[0]);

					splitFace(start_face, start_edge, start_face.vertices.length == 4 || direction > 2, 0);

					selected_vertices.empty();
					for (let key in center_vertices_map) {
						selected_vertices.safePush(center_vertices_map[key]);
					}
				})
				Undo.finishEdit('Create loop cut')
				Canvas.updateView({elements: Mesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
			}

			runEdit();

			Undo.amendEdit({
				direction: {type: 'num_slider', value: 0, label: 'edit.loop_cut.direction', condition: !!selected_face, min: 0},
				cuts: {type: 'num_slider', value: 1, label: 'edit.loop_cut.cuts', min: 0, max: 16},
				offset: {type: 'num_slider', value: length/2, label: 'edit.loop_cut.offset', min: 0, /*max: length,*/ interval_type: 'position'},
				unit: {type: 'inline_select', label: 'edit.loop_cut.unit', options: {size: 'edit.loop_cut.unit.size_units', percent: 'edit.loop_cut.unit.percent'}},
			}, (form, form_options) => {
				let direction = form.direction || 0;
				length = getLength(direction);
				let offset = form.offset;
				if (form.unit == 'percent') {
					offset = (offset/100) * length;
				}
				offset = Math.clamp(offset, 0, length);

				if (saved_direction !== direction) {
					offset = length/2;
					form_options.setValues({offset}, false);
					saved_direction = direction;
				}
				
				runEdit(true, offset, direction, form.cuts);
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
				let edges = mesh.getSelectedEdges(true);
				let selected_vertices = mesh.getSelectedVertices(true);
				for (let edge of edges) {
					let adjacent_faces = [];
					let adjacent_fkeys = [];
					for (let fkey in mesh.faces) {
						let face = mesh.faces[fkey];
						if (!face.vertices.includes(edge[0]) || !face.vertices.includes(edge[1])) continue;
						
						let vertices = face.getSortedVertices();
						let index_a = vertices.indexOf(edge[0]), index_b = vertices.indexOf(edge[1]);
						if (vertices.length < 4 || (Math.abs(index_a - index_b) != 2)) {
							adjacent_faces.push(face);
							adjacent_fkeys.push(fkey);
						}
					}
					// Connect adjacent faces
					let keep_faces = adjacent_fkeys.length >= 2;
					if (keep_faces) {
						let face_a = mesh.faces[adjacent_fkeys[0]],
							face_b = mesh.faces[adjacent_fkeys[1]];
						let vertices_from_a = face_a.vertices.filter(vkey => edge.indexOf(vkey) == -1);
						
						delete mesh.faces[adjacent_fkeys[0]];
						adjacent_fkeys.remove(adjacent_fkeys[0]);

						face_b.vertices.safePush(...vertices_from_a);
						vertices_from_a.forEach((vkey, i) => {
							face_b.uv[vkey] = face_a.uv[vkey] ? face_a.uv[vkey].slice() : [0, 0];
						})
						// Ensure face has no more than 4 vertices
						edge.forEach(edge_vkey => {
							if (face_b.vertices.length > 4) {
								face_b.vertices.remove(edge_vkey);
								delete face_b.uv[edge_vkey];
							}
						})
						// Make sure orientation stays the same
						if (face_b.getAngleTo(face_a) > 90) {
							face_b.invert();
						}
					}
					
					// Remove all other faces and lines
					adjacent_fkeys.forEach((fkey, i) => {
						let face = mesh.faces[fkey];
						if (face && (i > 1 || !keep_faces)) {
							delete mesh.faces[fkey];
						}
					})
				}
				// Remove leftover vertices
				let vertices_used = [];
				for (let edge of edges) {
					vertices_used.safePush(...edge);
				}
				for (let vkey of vertices_used) {
					let used = false;
					for (let fkey in mesh.faces) {
						if (mesh.faces[fkey].vertices.includes(vkey)) {
							used = true;
							break;
						}
					}
					if (!used) {
						delete mesh.vertices[vkey];
					}
				}
				selected_vertices.empty();
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
			cleanupOverlappingMeshFaces(mesh);
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
			Undo.initEdit({elements, outliner: true});
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
				let mesh_selection = Project.mesh_selection[mesh.uuid];

				let copy = new Mesh(mesh);
				elements.push(copy);

				for (let fkey in mesh.faces) {
					let face = mesh.faces[fkey];
					if (face.isSelected(fkey)) {
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
				delete Project.mesh_selection[mesh.uuid];
				Project.mesh_selection[copy.uuid] = mesh_selection;
				mesh.preview_controller.updateGeometry(mesh);
				selected[selected.indexOf(mesh)] = copy;
			})
			Undo.finishEdit('Merge meshes');
			updateSelection();
			Canvas.updateView({elements, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
	let import_obj_dialog;
	new Action('import_obj', {
		icon: 'fa-gem',
		category: 'file',
		condition: {modes: ['edit'], method: () => (Format.meshes)},
		click: function () {
			function importOBJ(result) {
				let mtl_materials = {};
				if (result.mtl) {
					let mtl_lines = result.mtl.content.split(/[\r\n]+/);
					let current_material;
					for (let line of mtl_lines) {
						let args = line.split(/\s+/).filter(arg => typeof arg !== 'undefined' && arg !== '');
						let cmd = args.shift();
						switch (cmd) {
							case 'newmtl': {
								current_material = mtl_materials[args[0]] = {};
								break;
							}
							case 'map_Kd': {
								let texture_name = args[0];
								let texture_path = isApp ? PathModule.join(result.mtl.path, '..', texture_name) : '';
								let texture = new Texture().fromPath(texture_path).add();
								current_material.texture = texture;
							}
						}
					}
				}
				
				let {content} = result.obj;
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
				let current_texture;

				Undo.initEdit({outliner: true, elements: meshes, selection: true});

				lines.forEach(line => {

					if (line.substr(0, 1) == '#' || !line) return;

					let args = line.split(/\s+/).filter(arg => typeof arg !== 'undefined' && arg !== '');
					let cmd = args.shift();

					if (['o', 'g'].includes(cmd) || (cmd == 'v' && !mesh)) {
						mesh = new Mesh({
							name: ['o', 'g'].includes(cmd) ? args[0] : 'unknown',
							vertices: {}
						})
						vertex_keys = {};
						meshes.push(mesh);
					}
					if (cmd == 'v') {
						vertices.push(toVector(args, 3).map(v => v * result.scale));
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
						args.forEach((triplet, i) => {
							if (i >= 4) return;
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
							uv,
							texture: current_texture
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
					if (cmd == 'usemtl') {
						current_texture = mtl_materials[args[0]]?.texture;
					}
				})
				meshes.forEach(mesh => {
					mesh.init();
				})

				Undo.finishEdit('Import OBJ');
			}
			if (!import_obj_dialog) {
				import_obj_dialog = new Dialog('import_obj', {
					title: 'action.import_obj',
					form: {
						obj: {type: 'file', label: 'dialog.import_obj.obj', return_as: 'file', extensions: ['obj'], resource_id: 'obj', filetype: 'OBJ Wavefront Model'},
						mtl: {type: 'file', label: 'dialog.import_obj.mtl', return_as: 'file', extensions: ['mtl'], resource_id: 'obj', filetype: 'OBJ Material File'},
						scale: {type: 'number', label: 'dialog.import_obj.scale', value: 16},
					},
					onConfirm(result) {
						importOBJ(result);
					}
				})
			}
			import_obj_dialog.show();
		}
	})

	new NumSlider('proportional_editing_range', {
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes']},
		get() {
			return ProportionalEdit.config.range
		},
		change(modify) {
			ProportionalEdit.config.range = modify(ProportionalEdit.config.range);
		},
		onAfter() {
			BarItems.proportional_editing.side_menu.save();
		}
	})
	new Toggle('proportional_editing', {
		icon: 'wifi_tethering',
		category: 'edit',
		condition: {modes: ['edit'], features: ['meshes']},
		tool_config: new ToolConfig('proportional_editing_options', {
			title: 'action.proportional_editing',
			width: 400,
			form: {
				enabled: {type: 'checkbox', label: 'menu.mirror_painting.enabled', value: false},
				range: {type: 'number', label: 'dialog.proportional_editing.range', value: 8},
				falloff: {type: 'select', label: 'dialog.proportional_editing.falloff', value: 'linear', options: {
					linear: 'dialog.proportional_editing.falloff.linear',
					hermite_spline: 'dialog.proportional_editing.falloff.hermite_spline',
					constant: 'dialog.proportional_editing.falloff.constant',
				}},
				selection: {type: 'select', label: 'dialog.proportional_editing.selection', value: 'linear', options: {
					linear: 'dialog.proportional_editing.selection.linear',
					connections: 'dialog.proportional_editing.selection.connections',
					//path: 'Connection Path',
				}},
			},
			onOpen() {
				this.setFormValues({enabled: BarItems.proportional_editing.value});
			},
			onFormChange(formResult) {
				if (BarItems.proportional_editing.value != formResult.enabled) {
					BarItems.proportional_editing.trigger();
				}
				BarItems.proportional_editing_range.update();
			}
		})
	})
	ProportionalEdit.config = BarItems.proportional_editing.tool_config.options;
})
