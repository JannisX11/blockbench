import { Armature } from '../../outliner/armature';
import { ArmatureBone } from '../../outliner/armature_bone';
import { sameMeshEdge } from './util';
import { THREE } from '../../lib/libs';
import { pointInPolygon } from '../../util/util';
import { Blockbench } from '../../api';

interface BoneInfo {
	bone: ArmatureBone;
	name: string;
	tail_offset: THREE.Vector3;
	start: THREE.Vector3;
	end: THREE.Vector3;
	line: THREE.Line3;
	_distance?: number;
	_distance_on_line?: number;
	_amount?: number;
	_is_inside?: boolean;
	_weight?: number;
}
interface EdgeLoop {
	loop: MeshEdge[];
	plane: THREE.Plane;
	plane_quaternion: THREE.Quaternion;
	polygon: ArrayVector2[];
	vkeys: string[];
}

function calculateWeights(mesh: Mesh, armature: Armature) {
	let armature_bones = armature.getAllBones();
	Undo.initEdit({ elements: [mesh, ...armature_bones] });
	mesh.preview_controller.updateTransform(mesh);

	if (armature) {
		mesh.sortAllFaceVertices();
		let bone_infos: BoneInfo[] = armature_bones.map(bone => {
			let tail_offset = new THREE.Vector3();
			let tail_bone = bone.children[0];
			if (tail_bone) {
				tail_offset.fromArray(tail_bone.position);
			} else {
				tail_offset.y = bone.length;
			}

			let start = bone.getWorldCenter();
			let end = bone.mesh.localToWorld(tail_offset);
			let data: BoneInfo = {
				bone,
				name: bone.name,
				tail_offset,
				start,
				end,
				line: new THREE.Line3(start, end),
			};
			return data;
		});

		// Analyze geometry
		const vertex_edge_loops: Record<string, EdgeLoop[]> = {};

		for (let vkey in mesh.vertices) {
			if (!vertex_edge_loops[vkey]) vertex_edge_loops[vkey] = [];
			if (vertex_edge_loops[vkey].length >= 4) continue;

			getEdgeLoops(mesh, vkey).forEach(loop => {
				let coplanar_vertices = [
					loop[0][0],
					loop[Math.floor(loop.length * 0.33)][0],
					loop[Math.floor(loop.length * 0.66)][0],
				];
				let coplanar_points = coplanar_vertices.map(vkey =>
					new THREE.Vector3().fromArray(mesh.vertices[vkey])
				);
				let plane = new THREE.Plane().setFromCoplanarPoints(
					coplanar_points[0],
					coplanar_points[1],
					coplanar_points[2]
				);
				let plane_quaternion = new THREE.Quaternion().setFromUnitVectors(
					plane.normal,
					new THREE.Vector3(0, 1, 0)
				);

				let polygon: ArrayVector2[] = [];
				let vkeys: string[] = [];
				loop.forEach((edge: MeshEdge) => {
					let vkey2 = edge[0];
					let point = new THREE.Vector3().fromArray(mesh.vertices[vkey2]);
					plane.projectPoint(point, point);
					point.applyQuaternion(plane_quaternion);
					polygon.push([point.x, point.z]);
					vkeys.push(vkey2);
				});

				let edge_loop = { loop, plane_quaternion, vkeys, polygon, plane };

				for (let vkey2 of vkeys) {
					if (!vertex_edge_loops[vkey2]?.length) {
						vertex_edge_loops[vkey2] = [edge_loop];
					} else {
						let match = vertex_edge_loops[vkey2].find(edge_loop2 => {
							return (
								edge_loop2.vkeys.length == edge_loop.vkeys.length &&
								edge_loop2.vkeys.allAre(vkey3 => edge_loop.vkeys.includes(vkey3))
							);
						});
						if (!match) vertex_edge_loops[vkey2].push(edge_loop);
					}
				}
			});
		}

		// Calculate base vertex weights
		const vertex_main_bone: Record<string, BoneInfo> = {};
		for (let vkey in mesh.vertices) {
			let global_pos = new THREE.Vector3().fromArray(mesh.vertices[vkey]);
			let edge_loops = vertex_edge_loops[vkey];

			let shortest_edge_loop = edge_loops.findHighest(loop => -loop.vkeys.length);

			for (let bone_info of bone_infos) {
				bone_info._is_inside =
					shortest_edge_loop && isBoneInsideLoops(edge_loops, bone_info) != false;

				let closest_point = bone_info.line.closestPointToPoint(
					global_pos,
					true,
					new THREE.Vector3()
				);
				bone_info._distance = closest_point.distanceTo(global_pos);
				bone_info.line.closestPointToPoint(global_pos, false, closest_point);
				bone_info._distance_on_line = closest_point.distanceTo(global_pos);
			}

			let inside_bones = bone_infos.filter(bone_infos => bone_infos._is_inside);

			let bone_matches = inside_bones.filter(
				bone_info => bone_info._distance < bone_info._distance_on_line * 1.2
			);
			if (!bone_matches.length) {
				bone_matches = inside_bones.filter(
					bone_info => bone_info._distance < bone_info._distance_on_line * 2
				);
			}
			let full_match_bones = bone_matches.filter(
				bone_info => bone_info._distance < bone_info._distance_on_line * 2
			);
			if (full_match_bones.length) {
				let closest_bone = full_match_bones.findHighest(bone => -bone._distance);
				vertex_main_bone[vkey] = closest_bone;

				closest_bone.bone.vertex_weights[vkey] = 1;
			} else {
				bone_matches.sort((a, b) => a._distance - b._distance);
				bone_matches = bone_matches.slice(0, 3);
				vertex_main_bone[vkey] = bone_matches[0];
				let amount_sum = 0;
				for (let match of bone_matches) {
					match._amount = Math.min(
						Math.max(match._distance_on_line, 0.04) / match._distance,
						1
					);
					amount_sum += match._amount;
				}
				for (let match of bone_matches) {
					match.bone.vertex_weights[vkey] = match._amount / amount_sum;
				}
			}
		}
		// Add smoothing
		for (let vkey in mesh.vertices) {
			let closest_vertices = [];
			for (let loop of vertex_edge_loops[vkey]) {
				let index = loop.vkeys.indexOf(vkey);
				closest_vertices.safePush(loop.vkeys.atWrapped(index + 1));
				closest_vertices.safePush(loop.vkeys.atWrapped(index - 1));
			}
			if (!vertex_main_bone[vkey]) {
				let bones = [];
				for (let vkey2 of closest_vertices) {
					let bone = vertex_main_bone[vkey2];
					if (bone) {
						bones.safePush(bone);
						bone._weight = 0;
					}
				}
				if (bones.length == 1) {
					bones[0].bone.vertex_weights[vkey] = 1;
					vertex_main_bone[vkey] = bones[0];
					continue;
				}

				// Share between bones
				let vertex_position = new THREE.Vector3().fromArray(mesh.vertices[vkey]);
				let weight_sum = 0;
				let weighted_vertices = closest_vertices.map(vkey2 => {
					let distance = Reusable.vec1
						.fromArray(mesh.vertices[vkey2])
						.distanceTo(vertex_position);
					weight_sum += 1 / distance;
					return {
						distance,
						bone: vertex_main_bone[vkey2],
						vkey: vkey2,
						weight: 1 / distance,
					};
				});
				for (let weighted of weighted_vertices) {
					if (!weighted.bone) continue;
					weighted.bone._weight += weighted.weight;
				}
				for (let bone of bones) {
					bone.bone.vertex_weights[vkey] = 1;
				}
			}
		}
	}

	Undo.finishEdit('Attach armature to mesh');
	Canvas.updateView({ elements: Mesh.selected, element_aspects: { geometry: true } });
}
function isBoneInsideLoops(edge_loops: EdgeLoop[], bone_info: BoneInfo): THREE.Vector3 | false {
	for (let loop of edge_loops) {
		let projected_point = loop.plane.intersectLine(bone_info.line, new THREE.Vector3());
		if (!projected_point) continue;
		projected_point.applyQuaternion(loop.plane_quaternion);
		let point = [projected_point.x, projected_point.z];
		if (pointInPolygon(point, loop.polygon)) {
			return projected_point;
		}
	}
	return false;
}
function getEdgeLoops(mesh: Mesh, start_vkey: string) {
	let vertices: string[] = [];
	let edges: MeshEdge[] = [];

	let processed_faces = [];

	function checkFace(face: MeshFace, side_vertices: MeshEdge) {
		processed_faces.push(face);
		let sorted_vertices = face.vertices.slice();

		let side_index_diff =
			sorted_vertices.indexOf(side_vertices[0]) - sorted_vertices.indexOf(side_vertices[1]);
		if (side_index_diff == -1 || side_index_diff > 2) side_vertices.reverse();

		let opposite_vertices = sorted_vertices.filter(vkey => !side_vertices.includes(vkey));
		let opposite_index_diff =
			sorted_vertices.indexOf(opposite_vertices[0]) -
			sorted_vertices.indexOf(opposite_vertices[1]);
		if (opposite_index_diff == 1 || opposite_index_diff < -2) opposite_vertices.reverse();

		vertices.safePush(...side_vertices);
		edges.push(side_vertices);

		// Find next (and previous) face
		function doNextFace(index: number) {
			for (let fkey in mesh.faces) {
				let ref_face = mesh.faces[fkey];
				if (ref_face.vertices.length < 3 || processed_faces.includes(ref_face)) continue;

				let sorted_vertices = ref_face.vertices.slice();
				let vertices = ref_face.vertices.filter(
					vkey => vkey == side_vertices[index] || vkey == opposite_vertices[index]
				);

				if (vertices.length >= 2) {
					let second_vertex = sorted_vertices.find((vkey, i) => {
						return (
							vkey !== side_vertices[index] &&
							vkey !== opposite_vertices[index] &&
							(sorted_vertices.length == 3 ||
								Math.abs(sorted_vertices.indexOf(side_vertices[index]) - i) !== 2)
						);
					});
					checkFace(ref_face, [side_vertices[index], second_vertex]);
					break;
				}
			}
		}
		doNextFace(0);
		doNextFace(1);
	}
	let start_edges = [];
	for (let fkey in mesh.faces) {
		let face = mesh.faces[fkey];
		if (face.vertices.includes(start_vkey) == false) continue;
		for (let edge of face.getEdges()) {
			if (edge.includes(start_vkey) && !start_edges.find(e2 => sameMeshEdge(e2.edge, edge))) {
				start_edges.push({ edge, face });
			}
		}
	}

	let loops: MeshEdge[][] = [];
	start_edges.forEach(({ edge, face }) => {
		edges = [];
		checkFace(face, edge);
		if (edges.length > 1) loops.push(edges);
	});
	return loops;
}

BARS.defineActions(() => {
	new Action('calculate_vertex_weights', {
		icon: 'accessibility',
		condition: () => Mesh.selected[0]?.getArmature(),
		click(e) {
			let mesh = Mesh.selected[0];
			calculateWeights(mesh, mesh.getArmature());
		},
	});
});
