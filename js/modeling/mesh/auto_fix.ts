
type MeshOverlaps = Record<string, string[]>

// this takes forever to complete on larger meshes, need to see how it can be optimized
export function gatherGeoOverlaps(meshes: Mesh[], vertexGatherer: (mesh: Mesh) => string[]): Record<string, MeshOverlaps>  {
	let overlaps: Record<string, MeshOverlaps> = {};
	let e = 0.004;
	meshes.forEach(mesh => {
		let mesh_overlaps: MeshOverlaps = {};
		let vertices = mesh.vertices;

		for (let vkey of vertexGatherer(mesh)) {
			let vertex = vertices[vkey];
			let matches = [];

			for (let vkey2 in vertices) {
				if (vkey2 == vkey || mesh_overlaps[vkey2]) continue;
				let vertex2 = vertices[vkey2];
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

	return overlaps;
}



export function mergeVerticesOverlaps(meshes: Mesh[], overlaps: Record<string, MeshOverlaps>) {
	let merge_counter = 0;
	let cluster_counter = 0;
	for (let mesh_id in overlaps) {
		let mesh = meshes.find(m => m.uuid == mesh_id);
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
	return [merge_counter, cluster_counter];
}

export async function autoFixMeshEdit(affected_vertices?: string[]) {
	let meshes = Mesh.selected;
	if (!meshes.length || !Modes.edit || (BarItems.selection_mode as BarSelect).value == 'object') return;

	// Merge Vertices
	let overlaps = gatherGeoOverlaps(meshes, (mesh) => affected_vertices instanceof Array ? affected_vertices : mesh.getSelectedVertices());

	if (Object.keys(overlaps).length) {
		await new Promise<void>(resolve => {Blockbench.showMessageBox({
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

				let results = mergeVerticesOverlaps(meshes, overlaps);

				Undo.finishEdit('Auto-merge vertices')
				Canvas.updateView({elements: meshes, element_aspects: {geometry: true, uv: true, faces: true}, selection: true});
				Blockbench.showQuickMessage(tl('message.merged_vertices', [results[0], results[1]]), 2000);
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
		await new Promise<void>(resolve => {Blockbench.showMessageBox({
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
