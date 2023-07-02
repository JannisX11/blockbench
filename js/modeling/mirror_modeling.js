const MirrorModeling = {
	isCentered(element) {
		if (element.origin[0] != 0) return false;
		if (element.rotation[1] || element.rotation[2]) return false;
		if (element instanceof Cube && !Math.epsilon(element.to[0], -element.from[0], 0.01)) return false;

		let checkParent = (parent) => {
			if (parent instanceof Group) {
				if (parent.origin[0] != 0) return true;
				if (parent.rotation[1] || parent.rotation[2]) return true;
				return checkParent(parent.parent);
			}
		}
		if (checkParent(element.parent)) return false;
		return true;
	},
	createClone(original, undo_aspects) {
		// Create or update clone
		var center = Format.centered_grid ? 0 : 8;
		let mirror_element = MirrorModeling.cached_elements[original.uuid]?.counterpart;
		let element_before_snapshot;

		if (mirror_element) {
			element_before_snapshot = mirror_element.getUndoCopy(undo_aspects);
			mirror_element.extend(original);

		} else {
			function getParentMirror(child) {
				let parent = child.parent;
				if (parent instanceof Group == false) return 'root';

				if (parent.origin[0] == center) {
					return parent;
				} else {
					let mirror_group_parent = getParentMirror(parent);
					let mirror_group = new Group(parent);

					flipNameOnAxis(mirror_group, 0, name => true, parent.name);
					mirror_group.origin[0] *= -1;
					mirror_group.rotation[1] *= -1;
					mirror_group.rotation[2] *= -1;
					mirror_group.isOpen = parent.isOpen;

					let parent_list = mirror_group_parent instanceof Group ? mirror_group_parent.children : Outliner.root;
					let match = parent_list.find(node => {
						if (node instanceof Group == false) return false;
						if (node.name == mirror_group.name && node.rotation.equals(mirror_group.rotation) && node.origin.equals(mirror_group.origin)) {
							return true;
						}
					})
					if (match) {
						return match;
					} else {
						mirror_group.createUniqueName();
						mirror_group.addTo(mirror_group_parent).init();
						return mirror_group;
					}
				}
			}
			let add_to = getParentMirror(original);
			mirror_element = new original.constructor(original).addTo(add_to).init();
		}
		mirror_element.flip(0, center);

		MirrorModeling.insertElementIntoUndo(mirror_element, undo_aspects, element_before_snapshot);

		let {preview_controller} = mirror_element;
		preview_controller.updateTransform(mirror_element);
		preview_controller.updateGeometry(mirror_element);
		preview_controller.updateFaces(mirror_element);
		preview_controller.updateUV(mirror_element);
	},
	createLocalSymmetry(mesh) {
		// Create or update clone
		let edit_side = Math.sign(Transformer.position.x) || 1;
		let deleted_vertices = [];
		let deleted_vertex_positions = {};
		let selected_vertices = mesh.getSelectedVertices(true);
		//let selected_vertices = mesh.getSelectedEdges(true);
		let selected_faces = mesh.getSelectedFaces(true);
		let deleted_vertices_by_position = {};
		function positionKey(position) {
			return position.map(p => Math.roundTo(p, 2)).join(',');
		}
		for (let vkey in mesh.vertices) {
			if (mesh.vertices[vkey][0] && mesh.vertices[vkey][0] * edit_side < 0) {
				deleted_vertex_positions[vkey] = mesh.vertices[vkey];
				delete mesh.vertices[vkey];
				deleted_vertices.push(vkey);
				deleted_vertices_by_position[positionKey(deleted_vertex_positions[vkey])] = vkey;
			}
		}
		let added_vertices = [];
		let vertex_counterpart = {};
		let replaced_vertices = {};
		for (let vkey in mesh.vertices) {
			let vertex = mesh.vertices[vkey];
			if (mesh.vertices[vkey][0] == 0) {
				// On Edge
				vertex_counterpart[vkey] = vkey;
			} else {
				let position = [-vertex[0], vertex[1], vertex[2]];
				let vkey_new = deleted_vertices_by_position[positionKey(position)];
				if (vkey_new) {
					mesh.vertices[vkey_new] = position;
				} else {
					vkey_new = mesh.addVertices(position)[0];
				}
				added_vertices.push(vkey_new);
				vertex_counterpart[vkey] = vkey_new;
				//deleted_vertices.remove(vkey_new);
			}
		}

		let deleted_faces = {};
		for (let fkey in mesh.faces) {
			let face = mesh.faces[fkey];
			let deleted_face_vertices = face.vertices.filter(vkey => deleted_vertices.includes(vkey));
			if (deleted_face_vertices.length == face.vertices.length) {
				deleted_faces[fkey] = mesh.faces[fkey];
				delete mesh.faces[fkey];
			}
		}

		for (let fkey in mesh.faces) {
			let face = mesh.faces[fkey];
			let deleted_face_vertices = face.vertices.filter(vkey => deleted_vertices.includes(vkey));
			if (deleted_face_vertices.length) {
				// face across zero line
				//let kept_face_keys = face.vertices.filter(vkey => mesh.vertices[vkey] != 0 && !deleted_face_vertices.includes(vkey));
				let new_counterparts = face.vertices.filter(vkey => !deleted_face_vertices.includes(vkey)).map(vkey => vertex_counterpart[vkey]);
				face.vertices.forEach((vkey, i) => {
					if (deleted_face_vertices.includes(vkey)) {
						// Across
						//let kept_key = kept_face_keys[i%kept_face_keys.length];
						new_counterparts.sort((a, b) => {
							let a_distance = Math.pow(mesh.vertices[a][1] - deleted_vertex_positions[vkey][1], 2) + Math.pow(mesh.vertices[a][2] - deleted_vertex_positions[vkey][2], 2);
							let b_distance = Math.pow(mesh.vertices[b][1] - deleted_vertex_positions[vkey][1], 2) + Math.pow(mesh.vertices[b][2] - deleted_vertex_positions[vkey][2], 2);
							return b_distance - a_distance;
						})

						let counterpart = new_counterparts.pop();
						if (vkey != counterpart) {
							face.vertices.splice(i, 1, counterpart);
							face.uv[counterpart] = face.uv[vkey];
							delete face.uv[vkey];
						}
					}
				})

			} else if (deleted_face_vertices.length == 0) {
				// Recreate face as mirrored
				let new_face_key;
				for (let key in deleted_faces) {
					let deleted_face = deleted_faces[key];
					if (face.vertices.allAre(vkey => deleted_face.vertices.includes(vertex_counterpart[vkey]))) {
						new_face_key = key;
						break;
					}
				}

				let new_face = new MeshFace(mesh, face);
				face.vertices.forEach((vkey, i) => {
					let new_vkey = vertex_counterpart[vkey];
					new_face.vertices.splice(i, 1, new_vkey);
					delete new_face.uv[vkey];
					new_face.uv[new_vkey] = face.uv[vkey];
				})
				new_face.invert();
				if (new_face_key) {
					mesh.faces[new_face_key] = new_face;
				} else {
					[new_face_key] = mesh.addFaces(new_face);
				}
			}

		}
		let {preview_controller} = mesh;
		preview_controller.updateGeometry(mesh);
		preview_controller.updateFaces(mesh);
		preview_controller.updateUV(mesh);
	},
	insertElementIntoUndo(element, undo_aspects, element_before_snapshot) {
		// pre
		if (element_before_snapshot) {
			if (!Undo.current_save.elements[element.uuid]) Undo.current_save.elements[element.uuid] = element_before_snapshot;
		} else {
			if (!Undo.current_save.outliner) Undo.current_save.outliner = MirrorModeling.outliner_snapshot;
		}

		// post
		if (!element_before_snapshot) undo_aspects.outliner = true;
		undo_aspects.elements.safePush(element);
	},
	cached_elements: {}
}

Blockbench.on('init_edit', ({aspects}) => {
	if (!BarItems.mirror_modeling.value) return;
	if (!aspects.elements) return;

	MirrorModeling.cached_elements = {};
	MirrorModeling.outliner_snapshot = aspects.outliner ? null : compileGroups(true);

	aspects.elements.forEach((element) => {
		if (element.allow_mirror_modeling) {
			let is_centered = MirrorModeling.isCentered(element);

			MirrorModeling.cached_elements[element.uuid] = {is_centered};
			if (!is_centered) {
				MirrorModeling.cached_elements[element.uuid].counterpart = Painter.getMirrorElement(element, [1, 0, 0]);
			}
		}
	})

	setTimeout(() => {MirrorModeling.cached_elements = {}}, 10_000);
})
Blockbench.on('finish_edit', ({aspects}) => {
	if (!BarItems.mirror_modeling.value) return;
	if (!aspects.elements) return;

	aspects.elements = aspects.elements.slice();
	let static_elements_copy = aspects.elements.slice();
	static_elements_copy.forEach((element) => {
		if (element.allow_mirror_modeling) {
			let is_centered = MirrorModeling.isCentered(element);

			if (is_centered && element instanceof Mesh) {
				// Complete other side of mesh
				MirrorModeling.createLocalSymmetry(element);
			}
			if (!is_centered) {
				// Construct clone at other side of model
				MirrorModeling.createClone(element, aspects);
			}
		}
	})
})

// Element property on cube and mesh
new Property(Cube, 'boolean', 'allow_mirror_modeling', {default: true});
new Property(Mesh, 'boolean', 'allow_mirror_modeling', {default: true});

BARS.defineActions(() => {
	
	new Toggle('mirror_modeling', {
		icon: 'align_horizontal_center',
		category: 'edit',
		condition: {modes: ['edit']},
		onChange() {
			updateSelection();
		}
	})
	let allow_toggle = new Toggle('allow_element_mirror_modeling', {
		icon: 'align_horizontal_center',
		category: 'edit',
		condition: {modes: ['edit'], selected: {element: true}, method: () => BarItems.mirror_modeling.value},
		onChange(value) {
			Outliner.selected.forEach(element => {
				if (!element.constructor.properties.allow_mirror_modeling) return;
				element.allow_mirror_modeling = value;
			})
		}
	})
	Blockbench.on('update_selection', () => {
		if (!Condition(allow_toggle.condition)) return;
		let disabled = Outliner.selected.find(el => el.allow_mirror_modeling === false);
		if (allow_toggle.value != !disabled) {
			allow_toggle.value = !disabled;
			allow_toggle.updateEnabledState();
		}
	})
})
