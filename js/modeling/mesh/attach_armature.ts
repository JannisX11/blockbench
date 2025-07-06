import { Armature } from "../../outliner/armature";
import { ArmatureBone } from "../../outliner/armature_bone";
import { sameMeshEdge } from "./util";
import { THREE } from "../../lib/libs";

function setArmature(mesh: Mesh, armature?: Armature) {
	let armature_bones = armature.getAllBones();
	Undo.initEdit({elements: [mesh, ...armature_bones]});
	mesh.armature = armature ? armature.uuid : '';
	mesh.preview_controller.updateTransform(mesh);

	if (armature) {
		interface BoneInfo {
			bone: ArmatureBone,
			tail_offset: THREE.Vector3,
			start: THREE.Vector3,
			end: THREE.Vector3,
			line: THREE.Line3,
			_distance?: number
			_distance_on_line?: number
			_amount?: number
		}
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
				tail_offset,
				start,
				end,
				line: new THREE.Line3(start, end),
			};
			return data;
		})

		for (let vkey in mesh.vertices) {
			// Is the bone close to the vertex? But we don't really know the scale of the model
			// Is there a smooth transition between two bones?
			// Take surrounding vertices into account
			// Is there an edge loop around the bone that includes the vertex?
				// If yes, that's the main bone
				// If no, look for connected vertices that are
				// Use closest bone as a fallback
			// Add smoothing step
			let global_pos = new THREE.Vector3().fromArray(mesh.vertices[vkey]);
			for (let bone_info of bone_infos) {
				let closest_point = bone_info.line.closestPointToPoint(global_pos, true, new THREE.Vector3);
				bone_info._distance = closest_point.distanceTo(global_pos);
				bone_info.line.closestPointToPoint(global_pos, false, closest_point);
				bone_info._distance_on_line = closest_point.distanceTo(global_pos);
			}
			let bone_matches = bone_infos.filter(bone_info => bone_info._distance < bone_info._distance_on_line * 1.2);
			if (!bone_matches.length) {
				bone_matches = bone_infos.filter(bone_info => bone_info._distance < bone_info._distance_on_line * 2);
			}
			if (!bone_matches.length) {
				bone_matches = bone_infos.slice()
			}
			let full_match_bones = bone_matches.filter(bone_info => bone_info._distance < bone_info._distance_on_line * 2);
			if (full_match_bones.length) {
				for (let match of full_match_bones) {
					match.bone.vertex_weights[vkey] = 1/full_match_bones.length;
				}
			} else {
				bone_matches.sort((a, b) => a._distance - b._distance);
				bone_matches = bone_matches.slice(0, 3);
				let amount_sum = 0;
				for (let match of bone_matches) {
					match._amount = Math.min(Math.max(match._distance_on_line, 0.04) / match._distance, 1);
					amount_sum += match._amount;
				}
				for (let match of bone_matches) {
					match.bone.vertex_weights[vkey] = match._amount / amount_sum;
				}
			}
		}
	}

	Undo.finishEdit('Attach armature to mesh');
}

function getEdgeLoops(mesh: Mesh, start_vkey: string) {
	
	let vertices: string[] = [];
	let edges: MeshEdge[] = [];

	let processed_faces = [];

	function splitFace(face: MeshFace, side_vertices: MeshEdge) {
		processed_faces.push(face);
		let sorted_vertices = face.getSortedVertices();

		let side_index_diff = sorted_vertices.indexOf(side_vertices[0]) - sorted_vertices.indexOf(side_vertices[1]);
		if (side_index_diff == -1 || side_index_diff > 2) side_vertices.reverse();

		let opposite_vertices = sorted_vertices.filter(vkey => !side_vertices.includes(vkey));
		let opposite_index_diff = sorted_vertices.indexOf(opposite_vertices[0]) - sorted_vertices.indexOf(opposite_vertices[1]);
		if (opposite_index_diff == 1 || opposite_index_diff < -2) opposite_vertices.reverse();

		vertices.safePush(...side_vertices);
		edges.push(side_vertices);

		// Find next (and previous) face
		function doNextFace(index) {
			for (let fkey in mesh.faces) {
				let ref_face = mesh.faces[fkey];
				if (ref_face.vertices.length < 3 || processed_faces.includes(ref_face)) continue;

				let sorted_vertices = ref_face.getSortedVertices();
				let vertices = ref_face.vertices.filter(vkey => vkey == side_vertices[index] || vkey == opposite_vertices[index]);

				if (vertices.length >= 2) {
					let second_vertex = sorted_vertices.find((vkey, i) => {
						return vkey !== side_vertices[index]
							&& vkey !== opposite_vertices[index]
							&& (sorted_vertices.length == 3 || Math.abs(sorted_vertices.indexOf(side_vertices[index]) - i) !== 2);
					})
					splitFace(ref_face, [side_vertices[index], second_vertex]);
					break;
				}
			}
		}
		doNextFace(0)
		doNextFace(1);
	}
	let start_edges = [];
	for (let fkey in mesh.faces) {
		let face = mesh.faces[fkey];
		if (face.vertices.includes(start_vkey) == false) continue;
		for (let edge of face.getEdges()) {
			if (!start_edges.find(e2 => sameMeshEdge(e2, edge))) {
				start_edges.push({edge, face});
			}
		}
	}

	let loops = start_edges.map(({edge, face}) => {
		return splitFace(face, edge);
	});
	return loops;
}

BARS.defineActions(() => {
	
	new Action('attach_armature', {
		name: 'menu.mesh.attach_armature',
		icon: 'accessibility',
		condition: () => Armature.all.length && Mesh.selected.length,
		children() {
			let options = [
				{
					name: 'generic.none',
					icon: 'remove',
					click() {
						setArmature(Mesh.selected[0]);
					}
				}
			];
			for (let armature of Armature.all) {
				options.push({
					name: armature.name,
					icon: 'accessibility',
					click() {
						setArmature(Mesh.selected[0], armature as Armature);
					}
				})
			}
			return options;
		},
		click(e) {
			new Menu(this.children()).open(e.target as HTMLElement);
		}
	});
})