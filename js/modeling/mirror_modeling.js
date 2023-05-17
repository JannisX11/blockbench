(function() {

	function isCentered(element) {
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
	}
	function createClone(original) {
		// Create or update clone
		var center = Format.centered_grid ? 0 : 8;
		let mirror_element = cached_mirror_elements[original.uuid]?.counterpart;

		if (mirror_element) {
			mirror_element.extend(original);

		} else {
			let add_to = 'root';
			// todo: figure out add to
			mirror_element = new original.constructor(original).addTo(add_to).init();
		}
		mirror_element.flip(0, center);

		let {preview_controller} = mirror_element;
		preview_controller.updateTransform(mirror_element);
		preview_controller.updateGeometry(mirror_element);
		preview_controller.updateFaces(mirror_element);
		preview_controller.updateUV(mirror_element);
	}
	function createLocalSymmetry(mesh) {
		// Create or update clone
		let edit_side = Math.sign(Transformer.position.x) || 1;
		let deleted_vertices = [];
		let deleted_vertex_positions = {};
		for (let vkey in mesh.vertices) {
			if (mesh.vertices[vkey][0] && mesh.vertices[vkey][0] * edit_side < 0) {
				deleted_vertex_positions[vkey] = mesh.vertices[vkey];
				delete mesh.vertices[vkey];
				deleted_vertices.push(vkey);
			}
		}
		let added_vertices = [];
		let vertex_counterpart = {};
		for (let vkey in mesh.vertices) {
			let vertex = mesh.vertices[vkey];
			if (mesh.vertices[vkey][0] == 0) {
				// On Edge
				vertex_counterpart[vkey] = vkey;
			} else {
				let vkey2 = mesh.addVertices([-vertex[0], vertex[1], vertex[2]])[0];
				added_vertices.push(vkey2);
				vertex_counterpart[vkey] = vkey2;
			}
		}

		for (let fkey in mesh.faces) {
			let face = mesh.faces[fkey];
			let deleted_face_vertices = face.vertices.filter(vkey => deleted_vertices.includes(vkey));
			if (deleted_face_vertices.length == face.vertices.length) {
				delete mesh.faces[fkey];

			} else if (deleted_face_vertices.length) {
				// face across zero line
				//let kept_face_keys = face.vertices.filter(vkey => mesh.vertices[vkey] != 0 && !deleted_face_vertices.includes(vkey));
				let new_counterparts = face.vertices.filter(vkey => !deleted_vertices.includes(vkey)).map(vkey => vertex_counterpart[vkey]);
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
						face.vertices.splice(i, 1, counterpart);
						face.uv[counterpart] = face.uv[vkey];
						delete face.uv[vkey];
					}
				})

			} else if (deleted_face_vertices.length == 0) {
				// Recreate face as mirrored
				let new_face = new MeshFace(mesh, face);
				face.vertices.forEach((vkey, i) => {
					new_face.vertices.splice(i, 1, vertex_counterpart[vkey]);
					delete new_face.uv[vkey];
					new_face.uv[vertex_counterpart[vkey]] = face.uv[vkey];
				})
				new_face.invert();
				let [face_key] = mesh.addFaces(new_face);
			}

		}
		let {preview_controller} = mesh;
		preview_controller.updateGeometry(mesh);
		preview_controller.updateFaces(mesh);
		preview_controller.updateUV(mesh);
	}

	let cached_mirror_elements = {};
	Blockbench.on('init_edit', ({aspects}) => {
		if (!BarItems.mirror_modeling.value) return;
		if (!aspects.elements) return;

		cached_mirror_elements = {};

		aspects.elements.forEach((element) => {
			if ((element instanceof Cube || element instanceof Mesh) && element.allow_mirror_modeling) {
				let is_centered = isCentered(element);

				cached_mirror_elements[element.uuid] = {is_centered};
				if (!is_centered) {
					cached_mirror_elements[element.uuid].counterpart = Painter.getMirrorElement(element, [1, 0, 0]);
				}
			}
		})

		setTimeout(() => {cached_mirror_elements = {}}, 10_000);
	})
	Blockbench.on('finish_edit', ({aspects}) => {
		if (!BarItems.mirror_modeling.value) return;
		if (!aspects.elements) return;
		let last_save = Undo.current_save;

		aspects.elements.forEach((element) => {
			if ((element instanceof Cube || element instanceof Mesh) && element.allow_mirror_modeling) {
				let is_centered = isCentered(element);

				if (is_centered && element instanceof Mesh) {
					// Complete other side of mesh
					createLocalSymmetry(element);
				}
				if (!is_centered) {
					// Construct clone at other side of model
					createClone(element);
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
				Cube.selected.concat(Mesh.selected).forEach(element => {
					element.allow_mirror_modeling = value;
				})
			}
		})
		Blockbench.on('update_selection', () => {
			if (!Condition(allow_toggle.condition)) return;
			let disabled = Cube.selected.find(el => el.allow_mirror_modeling == false) || Mesh.selected.find(el => el.allow_mirror_modeling == false);
			if (allow_toggle.value != !disabled) {
				allow_toggle.value = !disabled;
				allow_toggle.updateEnabledState();
			}
		})
	})

})()