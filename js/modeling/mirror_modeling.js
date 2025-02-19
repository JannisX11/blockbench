const MirrorModeling = {
	initial_transformer_position: 0,
	isCentered(element) {
		let center = Format.centered_grid ? 0 : 8;
		if (!element.to && Math.roundTo(element.origin[0], 3) != center) return false;
		if (Math.roundTo(element.rotation[1], 3) || Math.roundTo(element.rotation[2], 3)) return false;
		if (element instanceof Cube && !Math.epsilon(element.to[0], MirrorModeling.flipCoord(element.from[0]), 0.01)) return false;

		let checkParent = (parent) => {
			if (parent instanceof Group) {
				if (parent.origin[0] != center) return true;
				if (parent.rotation[1] || parent.rotation[2]) return true;
				return checkParent(parent.parent);
			}
		}
		if (checkParent(element.parent)) return false;
		return true;
	},
	createClone(original, undo_aspects) {
		// Create or update clone
		let options = BarItems.mirror_modeling.tool_config.options;
		let mirror_uv = options.mirror_uv;
		let center = Format.centered_grid ? 0 : 8;
		let mirror_element = MirrorModeling.cached_elements[original.uuid]?.counterpart;
		let element_before_snapshot;

		if (mirror_element == original) return;

		if (mirror_element) {
			element_before_snapshot = mirror_element.getUndoCopy(undo_aspects);
			mirror_element.extend(original);
			
			mirror_element.flip(0, center);

			mirror_element.extend({
				name: element_before_snapshot.name
			});
			if (!mirror_uv) {
				if (original instanceof Mesh) {
					for (let fkey in mirror_element.faces) {
						let face = mirror_element.faces[fkey];
						let face_before = element_before_snapshot.faces[fkey];
						if (face_before) {
							face.texture = face_before.texture;
							for (let vkey of face_before.vertices) {
								if (face.vertices.includes(vkey) && face_before.uv[vkey]) {
									face.uv[vkey] = face_before.uv[vkey].slice();
								}
							}
						}
					}
				} else {
					mirror_element.extend({
						faces: element_before_snapshot.faces,
						uv_offset: element_before_snapshot.uv_offset,
						mirror_uv: element_before_snapshot.mirror_uv,
						box_uv: element_before_snapshot.box_uv,
						autouv: element_before_snapshot.autouv
					});
				}
			}

			// Update hierarchy up
			function updateParent(child, child_b) {
				let parent = child.parent;
				let parent_b = child_b.parent;
				if (parent instanceof Group == false || parent_b instanceof Group == false || parent == parent_b) return;

				MirrorModeling.updateGroupCounterpart(parent_b, parent);

				updateParent(parent, parent_b);
			}
			updateParent(original, mirror_element);

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
					mirror_group.origin[0] = MirrorModeling.flipCoord(mirror_group.origin[0]);
					mirror_group.rotation[1] *= -1;
					mirror_group.rotation[2] *= -1;
					mirror_group.isOpen = parent.isOpen;

					let parent_list = mirror_group_parent instanceof Group ? mirror_group_parent.children : Outliner.root;
					let match = parent_list.find(node => {
						if (node instanceof Group == false) return false;
						if ((node.name == mirror_group.name || Condition(mirror_group.needsUniqueName)) && node.rotation.equals(mirror_group.rotation) && node.origin.equals(mirror_group.origin)) {
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
			mirror_element.flip(0, center);
		}

		MirrorModeling.insertElementIntoUndo(mirror_element, undo_aspects, element_before_snapshot);

		let {preview_controller} = mirror_element;
		preview_controller.updateTransform(mirror_element);
		preview_controller.updateGeometry(mirror_element);
		preview_controller.updateFaces(mirror_element);
		preview_controller.updateUV(mirror_element);
		preview_controller.updateVisibility(mirror_element);
		return mirror_element;
	},
	updateGroupCounterpart(group, original) {
		let keep_properties = {
			name: group.name
		};
		group.extend(original);
		group.extend(keep_properties);

		//flipNameOnAxis(group, 0, name => true, original.name);
		group.origin[0] = MirrorModeling.flipCoord(group.origin[0]);
		group.rotation[1] *= -1;
		group.rotation[2] *= -1;
	},
	getEditSide() {
		return Math.sign(Transformer.position.x || MirrorModeling.initial_transformer_position) || 1;
	},
	flipCoord(input) {
		if (Format.centered_grid) {
			return -input;
		} else {
			return 16 - input;
		}
	},
	discoverMeshPartConnections(mesh) {
		let data = {
			faces: {},
			vertices: {},
		}
		// Detect vertex counterparts
		for (let vkey in mesh.vertices) {
			if (data.vertices[vkey]) continue;
			let vector = Reusable.vec1.fromArray(mesh.vertices[vkey]);
			vector.x *= -1;
			for (let vkey2 in mesh.vertices) {
				//if (vkey == vkey2) continue;
				let distance = vector.distanceTo(Reusable.vec2.fromArray(mesh.vertices[vkey2]));
				if (distance < 0.001) {
					data.vertices[vkey] = vkey2;
					data.vertices[vkey2] = vkey;
					break;
				}
			}
		}
		// Detect face counterparts
		for (let fkey in mesh.faces) {
			if (data.faces[fkey]) continue;
			for (let fkey2 in mesh.faces) {
				if (fkey == fkey2) continue;
				let match = mesh.faces[fkey].vertices.allAre(vkey => {
					let other_vkey = data.vertices[vkey];
					if (!other_vkey) return false;
					return mesh.faces[fkey2].vertices.includes(other_vkey);
				})
				if (match) {
					data.faces[fkey] = fkey2;
					data.faces[fkey2] = fkey;
					break;
				}
			}
		}
		return data;
	},
	createLocalSymmetry(mesh, cached_data) {
		// Create or update clone
		let edit_side = MirrorModeling.getEditSide();
		let options = BarItems.mirror_modeling.tool_config.options;
		let mirror_uv = options.mirror_uv;
		let pre_part_connections = cached_data?.pre_part_connections;
		// Delete all vertices on the non-edit side
		let deleted_vertices = {};
		let deleted_vertices_by_position = {};
		function positionKey(position) {
			return position.map(p => Math.round(p*25)/25).join(',');
		}
		for (let vkey in mesh.vertices) {
			if (mesh.vertices[vkey][0] && Math.round(mesh.vertices[vkey][0] * edit_side * 50) < 0) {
				deleted_vertices[vkey] = mesh.vertices[vkey];
				delete mesh.vertices[vkey];
				deleted_vertices_by_position[positionKey(deleted_vertices[vkey])] = vkey;
			}
		}
		// Copy existing vertices back to the non-edit side
		let added_vertices = [];
		let vertex_counterpart = {};
		let center_vertices = [];
		for (let vkey in mesh.vertices) {
			let vertex = mesh.vertices[vkey];
			if (Math.abs(mesh.vertices[vkey][0]) < 0.02) {
				// On Edge
				vertex_counterpart[vkey] = vkey;
				center_vertices.push(vkey);
			} else {
				let position = [MirrorModeling.flipCoord(vertex[0]), vertex[1], vertex[2]];
				let vkey_new = deleted_vertices_by_position[positionKey(position)];
				if (vkey_new) {
					mesh.vertices[vkey_new] = position;
				} else {
					vkey_new = mesh.addVertices(position)[0];
				}
				added_vertices.push(vkey_new);
				vertex_counterpart[vkey] = vkey_new;
			}
		}

		// Delete faces temporarily if all their vertices have been removed
		let deleted_faces = {};
		for (let fkey in mesh.faces) {
			let face = mesh.faces[fkey];
			let deleted_face_vertices = face.vertices.filter(vkey => deleted_vertices[vkey] || center_vertices.includes(vkey));
			if (deleted_face_vertices.length == face.vertices.length && !face.vertices.allAre(vkey => center_vertices.includes(vkey))) {
				deleted_faces[fkey] = mesh.faces[fkey];
				delete mesh.faces[fkey];
			}
		}

		// Create mirrored faces
		let original_fkeys = Object.keys(mesh.faces);
		for (let fkey of original_fkeys) {
			let face = mesh.faces[fkey];
			let deleted_face_vertices = face.vertices.filter(vkey => deleted_vertices[vkey]);
			if (deleted_face_vertices.length && face.vertices.length != deleted_face_vertices.length*2 && face.vertices.filter(vkey => center_vertices.includes(vkey)).length + deleted_face_vertices.length*2 != face.vertices.length) {
				// cannot flip. restore vertices instead?
				deleted_face_vertices.forEach(vkey => {
					mesh.vertices[vkey] = deleted_vertices[vkey];
					//delete deleted_vertices[vkey];
				})

			} else if (deleted_face_vertices.length) {
				// face across zero line
				//let kept_face_keys = face.vertices.filter(vkey => mesh.vertices[vkey] != 0 && !deleted_face_vertices.includes(vkey));
				let new_counterparts = face.vertices.filter(vkey => !deleted_vertices[vkey]).map(vkey => vertex_counterpart[vkey]);
				face.vertices.forEach((vkey, i) => {
					if (deleted_face_vertices.includes(vkey)) {
						// Across
						//let kept_key = kept_face_keys[i%kept_face_keys.length];
						new_counterparts.sort((a, b) => {
							let a_distance = Math.pow(mesh.vertices[a][1] - deleted_vertices[vkey][1], 2) + Math.pow(mesh.vertices[a][2] - deleted_vertices[vkey][2], 2);
							let b_distance = Math.pow(mesh.vertices[b][1] - deleted_vertices[vkey][1], 2) + Math.pow(mesh.vertices[b][2] - deleted_vertices[vkey][2], 2);
							return b_distance - a_distance;
						})

						let counterpart = new_counterparts.pop();
						if (vkey != counterpart && counterpart) {
							face.vertices.splice(i, 1, counterpart);
							face.uv[counterpart] = face.uv[vkey].slice();
							delete face.uv[vkey];
						}
					}
				})

			} else if (deleted_face_vertices.length == 0 && face.vertices.find((vkey) => vkey != vertex_counterpart[vkey])) {
				// Recreate face as mirrored
				let new_face_key = pre_part_connections && pre_part_connections.faces[fkey];
				let original_face = deleted_faces[new_face_key];

				let new_face = new MeshFace(mesh, face);
				face.vertices.forEach((vkey, i) => {
					let new_vkey = vertex_counterpart[vkey];
					new_face.vertices.splice(i, 1, new_vkey);
					delete new_face.uv[vkey];
					if (mirror_uv || !original_face) {
						new_face.uv[new_vkey] = face.uv[vkey].slice();
					} else {
						// change
						let original_vkey = pre_part_connections.vertices[vkey];
						if (original_face.uv[original_vkey]) {
							new_face.uv[new_vkey] = original_face.uv[original_vkey].slice();
						}
					}
				})
				new_face.invert();
				if (new_face_key) {
					mesh.faces[new_face_key] = new_face;
				} else {
					[new_face_key] = mesh.addFaces(new_face);
				}
			}
		}
		let selected_vertices = mesh.getSelectedVertices(true);
		selected_vertices.replace(selected_vertices.filter(vkey => mesh.vertices[vkey]));
		let selected_edges = mesh.getSelectedEdges(true);
		selected_edges.replace(selected_edges.filter(edge => edge.allAre(vkey => mesh.vertices[vkey])));
		let selected_faces = mesh.getSelectedFaces(true);
		selected_faces.replace(selected_faces.filter(fkey => mesh.faces[fkey]));

		let {preview_controller} = mesh;
		preview_controller.updateGeometry(mesh);
		preview_controller.updateFaces(mesh);
		preview_controller.updateUV(mesh);
	},
	getMirrorElement(element) {
		let center = Format.centered_grid ? 0 : 8;
		let e = 0.01;
		let symmetry_axes = [0];
		let off_axes = [ 1, 2];
		function getElementParents(el) {
			let list = [];
			let subject = el;
			while (subject.parent instanceof Group) {
				subject = subject.parent;
				list.push(subject)
			}
			return list;
		}
		if (element instanceof Cube) {
			if (
				symmetry_axes.find((axis) => !Math.epsilon(element.from[axis]-center, center-element.to[axis], e)) == undefined &&
				off_axes.find(axis => element.rotation[axis]) == undefined &&
				getElementParents(element).allAre(group => off_axes.find(axis => group.rotation[axis]) == undefined)
			) {
				return element;
			} else {
				for (var element2 of Cube.all) {
					if (
						element2 != element &&
						Math.epsilon(element.inflate, element2.inflate, e) &&
						off_axes.find(axis => !Math.epsilon(element.from[axis], element2.from[axis], e)) == undefined &&
						off_axes.find(axis => !Math.epsilon(element.to[axis], element2.to[axis], e)) == undefined &&
						symmetry_axes.find(axis => !Math.epsilon(element.size(axis), element2.size(axis), e)) == undefined &&
						symmetry_axes.find(axis => !Math.epsilon(element.to[axis]-center, center-element2.from[axis], e)) == undefined &&
						symmetry_axes.find(axis => !Math.epsilon(element.rotation[axis], element2.rotation[axis], e)) == undefined
					) {
						return element2;
					}
				}
			}
			return false;
		} else if (element instanceof Mesh) {
			let ep = 0.5;
			let this_center = element.getCenter(true);
			if (
				symmetry_axes.find((axis) => !Math.epsilon(element.origin[axis], center, e)) == undefined &&
				symmetry_axes.find((axis) => !Math.epsilon(this_center[axis], center, ep)) == undefined &&
				off_axes.find(axis => element.rotation[axis]) == undefined
			) {
				return element;
			} else {
				for (var element2 of Mesh.all) {
					let other_center = element2.getCenter(true);
					if (Object.keys(element.vertices).length !== Object.keys(element2.vertices).length) continue;
					if (
						element2 != element &&
						symmetry_axes.find(axis => !Math.epsilon(element.origin[axis]-center, center-element2.origin[axis], e)) == undefined &&
						symmetry_axes.find(axis => !Math.epsilon(this_center[axis]-center, center-other_center[axis], ep)) == undefined &&
						off_axes.find(axis => !Math.epsilon(element.origin[axis], element2.origin[axis], e)) == undefined &&
						off_axes.find(axis => !Math.epsilon(this_center[axis], other_center[axis], ep)) == undefined
					) {
						return element2;
					}
				}
			}
			return false;
		}
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

	MirrorModeling.initial_transformer_position = Transformer.position.x;

	if (aspects.elements) {
		MirrorModeling.cached_elements = {};
		MirrorModeling.outliner_snapshot = aspects.outliner ? null : compileGroups(true);
		let edit_side = MirrorModeling.getEditSide();

		aspects.elements.forEach((element) => {
			if (element.allow_mirror_modeling) {
				let is_centered = MirrorModeling.isCentered(element);

				let data = MirrorModeling.cached_elements[element.uuid] = {is_centered};
				if (!is_centered) {
					data.is_copy = Math.sign(element.getWorldCenter().x) != edit_side;
					data.counterpart = MirrorModeling.getMirrorElement(element);
					if (!data.counterpart) data.is_copy = false;
				} else {
					data.is_copy = false;
					if (element instanceof Mesh) {
						data.pre_part_connections = MirrorModeling.discoverMeshPartConnections(element)
					}
				}
			}
		})
	} else if (aspects.group || aspects.outliner) {
		MirrorModeling.cached_elements = {};
		let edit_side = MirrorModeling.getEditSide();
		let selected_groups = aspects.outliner ? Group.all.filter(g => g.selected) : [aspects.group];

		// update undo
		if (!Undo.current_save.outliner) Undo.current_save.outliner = compileGroups(true);
		aspects.outliner = true;

		selected_groups.forEach(group => {
			if (group.origin[0] == (Format.centered_grid ? 0 : 8)) return;

			let mirror_group = Group.all.find(g => {
				if (
					Math.epsilon(group.origin[0], MirrorModeling.flipCoord(g.origin[0])) &&
					Math.epsilon(group.origin[1], g.origin[1]) &&
					Math.epsilon(group.origin[2], g.origin[2]) &&
					group.getDepth() == g.getDepth()
				) {
					return true;
				}
			})

			if (mirror_group) {
				MirrorModeling.cached_elements[group.uuid] = {
					counterpart: mirror_group
				}
			}
		})
	}
})
Blockbench.on('finish_edit', ({aspects}) => {
	if (!BarItems.mirror_modeling.value) return;

	if (aspects.elements) {
		aspects.elements = aspects.elements.slice();
		let static_elements_copy = aspects.elements.slice();
		static_elements_copy.forEach((element) => {
			let cached_data = MirrorModeling.cached_elements[element.uuid]
			if (element.allow_mirror_modeling && !element.locked) {
				let is_centered = MirrorModeling.isCentered(element);

				if (is_centered && element instanceof Mesh) {
					// Complete other side of mesh
					MirrorModeling.createLocalSymmetry(element, cached_data);
				}
				if (is_centered) {
					let mirror_element = cached_data?.counterpart;
					if (mirror_element && mirror_element.uuid != element.uuid) {
						MirrorModeling.insertElementIntoUndo(mirror_element, Undo.current_save.aspects, mirror_element.getUndoCopy());
						mirror_element.remove();
						aspects.elements.remove(mirror_element);
					}
				} else {
					// Construct clone at other side of model
					MirrorModeling.createClone(element, aspects);
				}
			}
		})
		if (aspects.group || aspects.outliner) {
			Canvas.updateAllBones();
		}
	} else if (aspects.group || aspects.outliner) {
		let selected_groups = aspects.outliner ? Group.all.filter(g => g.selected) : [aspects.group];

		selected_groups.forEach(group => {
			let mirror_group = MirrorModeling.cached_elements[group.uuid]?.counterpart;
			if (mirror_group) {
				MirrorModeling.updateGroupCounterpart(mirror_group, group);
			}
		})

		aspects.outliner = true;
		Canvas.updateAllBones();
	}
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
			Project.mirror_modeling_enabled = this.value;
			MirrorModeling.cached_elements = {};
			updateSelection();
		},
		tool_config: new ToolConfig('mirror_modeling_options', {
			title: 'action.mirror_modeling',
			form: {
				enabled: {type: 'checkbox', label: 'menu.mirror_painting.enabled', value: false},
				mirror_uv: {type: 'checkbox', label: 'menu.mirror_modeling.mirror_uv', value: true}
			},
			onOpen() {
				this.setFormValues({enabled: BarItems.mirror_modeling.value}, false);
			},
			onFormChange(formResult) {
				if (BarItems.mirror_modeling.value != formResult.enabled) {
					BarItems.mirror_modeling.trigger();
				}
			}
		})
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
	new Action('apply_mirror_modeling', {
		icon: 'align_horizontal_right',
		category: 'edit',
		condition: {modes: ['edit']},
		click() {
			let value_before = BarItems.mirror_modeling.value;
			BarItems.mirror_modeling.value = true;
			Undo.initEdit({elements: Outliner.selected, outliner: !!Group.first_selected});
			Undo.finishEdit('Applied mirror modeling');
			BarItems.mirror_modeling.value = value_before;
		}
	})
})
