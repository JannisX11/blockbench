SharedActions.add('delete', {
	condition: () => Modes.edit && Prop.active_panel == 'preview' && SplineMesh.selected[0] && Project.spline_selection[SplineMesh.selected[0].uuid],
	run() {
		let splines = SplineMesh.selected.slice();
		Undo.initEdit({elements: splines, outliner: true, selection: true})

		splines.forEach(spline => {
			let selectedHandles = spline.getSelectedHandles(true);
			
			// Actual deletion logic.
			if (BarItems.spline_selection_mode.value == "handles" && selectedHandles.length > 0) {
				for (let hKey in spline.handles) {
					let handle = spline.handles[hKey];
					let shouldDelete = selectedHandles.includes(hKey);
	
					if (shouldDelete) {
						delete spline.handles[hKey];
						selectedHandles.remove(hKey);
		
						delete spline.vertices[handle.control1];
						delete spline.vertices[handle.joint];
						delete spline.vertices[handle.control2];
					}
				}

				// Just ditch all curves...
				spline.curves = {};

				// ... and remake them with the new handle order.
				let hKeys = Object.keys(spline.handles);
				for (let i = 0; i < (hKeys.length - 1); i++) {
					spline.addCurves(new SplineCurve(spline, { start_handle: hKeys[i], end_handle: hKeys[i + 1] }));
				}
			}
			else {
				splines.remove(spline);
				spline.remove(false);
			}
		})

		Undo.finishEdit('Delete spline handle');
		Canvas.updateView({elements: splines, selection: true, element_aspects: {geometry: true, faces: true, uv: splines.length > 0}});
	}
})
SharedActions.add('select_all', {
	condition: () => Modes.edit && SplineMesh.selected.length && SplineMesh.selected.length === Outliner.selected.length && BarItems.spline_selection_mode.value !== 'object',
	priority: 1,
	run() {
		let selection_mode = BarItems.spline_selection_mode.value;
		if (selection_mode == 'handles') {
			let unselect = SplineMesh.selected[0].getSelectedVertices().length == Object.keys(SplineMesh.selected[0].vertices).length;
			SplineMesh.selected.forEach(spline => {
				if (unselect) {
					spline.getSelectedVertices(true).empty();
				} else {
					spline.getSelectedVertices(true).replace(Object.keys(spline.vertices));
				}
			})
		}
		updateSelection();
	}
})
SharedActions.add('unselect_all', {
	condition: () => Modes.edit && SplineMesh.selected.length && SplineMesh.selected.length === Outliner.selected.length && BarItems.spline_selection_mode.value !== 'object',
	priority: 1,
	run() {
		SplineMesh.selected.forEach(spline => {
			delete Project.spline_selection[spline.uuid];
		})
		updateSelection();
	}
})
SharedActions.add('invert_selection', {
	condition: () => Modes.edit && SplineMesh.selected.length && SplineMesh.selected.length === Outliner.selected.length && BarItems.spline_selection_mode.value !== 'object',
	priority: 1,
	run() {
		let selection_mode = BarItems.spline_selection_mode.value;
		if (selection_mode == 'handles') {
			SplineMesh.selected.forEach(spline => {
				let selected = spline.getSelectedVertices();
				let now_selected = Object.keys(spline.vertices).filter(vkey => !selected.includes(vkey));
				spline.getSelectedVertices(true).replace(now_selected);
			})
		}
		updateSelection();
	}
})

BARS.defineActions(function() {
	let add_spline_dialog = new Dialog({
		id: 'add_spline',
		title: 'action.add_spline',
		form: {
			shape: {label: 'dialog.add_spline.shape', type: 'select', options: {
				segment: 'dialog.add_spline.shape.segment',
				square: 'dialog.add_spline.shape.square',
				circle: 'dialog.add_spline.shape.circle',
			}},
			sides_radial: {label: 'dialog.add_spline.sides_radial', type: 'num_slider', value: 8, min: 3, max: 48, color: "u"},
			sides_tubular: {label: 'dialog.add_spline.sides_tubular', type: 'num_slider', value: 4, min: 1, max: 48, color: "v"},
			radius: {label: 'dialog.add_spline.radius', type: 'num_slider', value: 2, min: 1, max: 8, color: "w"},
			diameter: {label: 'dialog.add_spline.diameter', type: 'number', value: 16, min: 4, max: 64, condition: ({shape}) => ["circle"].includes(shape)},
			length: {label: 'dialog.add_spline.length', type: 'number', value: 16, min: 4, max: 64, condition: ({shape}) => ["segment", "square"].includes(shape)},
			width: {label: 'dialog.add_spline.width', type: 'number', value: 16, min: 4, max: 64, condition: ({shape}) => ["square"].includes(shape)},
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
				let spline = new SplineMesh({
					name: result.shape,
					vertices: {},
					handles: {},
					curves: {}
				});
				let group = getCurrentGroup();
				if (group) {
					spline.addTo(group);
					if (settings.inherit_parent_color.value) spline.color = group.color;
				}

				if (result.shape == "segment") {
					let length_fac = (result.length / 16);
					spline.addVertices(
						[length_fac * 11, 0, 0], [length_fac *  8, 0, 0], [length_fac *   5, 0, 0],
						[length_fac *  3, 0, 0], [0, 0, 0], [length_fac * -3, 0, 0],
						[length_fac * -5, 0, 0], [length_fac * -8, 0, 0], [length_fac * -11, 0, 0]
					);
					let vertex_keys = Object.keys(spline.vertices);

					spline.addHandles(new SplineHandle(spline, { control1: vertex_keys[0], joint: vertex_keys[1], control2: vertex_keys[2] }))
					spline.addHandles(new SplineHandle(spline, { control1: vertex_keys[3], joint: vertex_keys[4], control2: vertex_keys[5] }))
					spline.addHandles(new SplineHandle(spline, { control1: vertex_keys[6], joint: vertex_keys[7], control2: vertex_keys[8] }))
					let handle_keys = Object.keys(spline.handles);

					spline.addCurves(new SplineCurve(spline, { start_handle: handle_keys[0], end_handle: handle_keys[1] }));
					spline.addCurves(new SplineCurve(spline, { start_handle: handle_keys[1], end_handle: handle_keys[2] }));
				}
				if (result.shape == "square") {
					let width_fac = (result.width / 8);
					let length_fac = (result.length / 8);
					spline.addVertices(
						// Top Left
						[width_fac * 4, 0, length_fac * 1], 
						[width_fac * 4, 0, length_fac * 4], 
						[width_fac * 1, 0, length_fac * 4],

						// Top Right
						[width_fac * -1, 0, length_fac * 4], 
						[width_fac * -4, 0, length_fac * 4], 
						[width_fac * -4, 0, length_fac * 1],

						// Bottom Right
						[width_fac * -4, 0, length_fac * -1], 
						[width_fac * -4, 0, length_fac * -4], 
						[width_fac * -1, 0, length_fac * -4],

						// Bottom Left
						[width_fac * 1, 0, length_fac * -4], 
						[width_fac * 4, 0, length_fac * -4], 
						[width_fac * 4, 0, length_fac * -1]
					);
					let vertex_keys = Object.keys(spline.vertices);

					spline.addHandles(new SplineHandle(spline, { control1: vertex_keys[0], joint: vertex_keys[1], control2: vertex_keys[2] }))
					spline.addHandles(new SplineHandle(spline, { control1: vertex_keys[3], joint: vertex_keys[4], control2: vertex_keys[5] }))
					spline.addHandles(new SplineHandle(spline, { control1: vertex_keys[6], joint: vertex_keys[7], control2: vertex_keys[8] }))
					spline.addHandles(new SplineHandle(spline, { control1: vertex_keys[9], joint: vertex_keys[10], control2: vertex_keys[11] }))
					let handle_keys = Object.keys(spline.handles);

					spline.addCurves(new SplineCurve(spline, { start_handle: handle_keys[0], end_handle: handle_keys[1] }));
					spline.addCurves(new SplineCurve(spline, { start_handle: handle_keys[1], end_handle: handle_keys[2] }));
					spline.addCurves(new SplineCurve(spline, { start_handle: handle_keys[2], end_handle: handle_keys[3] }));

					spline.cyclic = true; // close circle

				}
				if (result.shape == "circle") {
					let diameter_fac = (result.diameter / 16);
					let ctrl_off = 4 * (Math.sqrt(2) - 1) / 3;
					spline.addVertices(
						// Left
						[diameter_fac * 8, 0, (-ctrl_off * diameter_fac * 8)], 
						[diameter_fac * 8, 0, 0], 
						[diameter_fac * 8, 0, (ctrl_off * diameter_fac * 8)],

						// Top
						[(ctrl_off * diameter_fac * 8), 0, diameter_fac * 8], 
						[0, 0, diameter_fac * 8], 
						[(-ctrl_off * diameter_fac * 8), 0, diameter_fac * 8],

						// Right
						[-diameter_fac * 8, 0, (ctrl_off * diameter_fac * 8)], 
						[-diameter_fac * 8, 0, 0], 
						[-diameter_fac * 8, 0, (-ctrl_off * diameter_fac * 8)],

						// Bottom
						[(-ctrl_off * diameter_fac * 8), 0, -diameter_fac * 8], 
						[0, 0, -diameter_fac * 8], 
						[(ctrl_off * diameter_fac * 8), 0, -diameter_fac * 8]
					);
					let vertex_keys = Object.keys(spline.vertices);

					spline.addHandles(new SplineHandle(spline, { control1: vertex_keys[0], joint: vertex_keys[1], control2: vertex_keys[2] }))
					spline.addHandles(new SplineHandle(spline, { control1: vertex_keys[3], joint: vertex_keys[4], control2: vertex_keys[5] }))
					spline.addHandles(new SplineHandle(spline, { control1: vertex_keys[6], joint: vertex_keys[7], control2: vertex_keys[8] }))
					spline.addHandles(new SplineHandle(spline, { control1: vertex_keys[9], joint: vertex_keys[10], control2: vertex_keys[11] }))
					let handle_keys = Object.keys(spline.handles);

					spline.addCurves(new SplineCurve(spline, { start_handle: handle_keys[0], end_handle: handle_keys[1] }));
					spline.addCurves(new SplineCurve(spline, { start_handle: handle_keys[1], end_handle: handle_keys[2] }));
					spline.addCurves(new SplineCurve(spline, { start_handle: handle_keys[2], end_handle: handle_keys[3] }));

					spline.cyclic = true; // close circle
				}

				spline.tubular_resolution = result.sides_tubular;
				spline.radial_resolution = result.sides_radial;
				spline.radius_multiplier = result.radius;
				
				if (Texture.all.length && Format.single_texture) {
					spline.texture = Texture.getDefault().uuid
					UVEditor.loadData()
				}
				if (Format.bone_rig) {
					if (group) {
						var pos1 = group.origin.slice()
						spline.extend({
							origin: pos1.slice()
						})
					}
				}

				elements.push(spline);
				spline.init()
				unselectAllElements()
				spline.select()
				Undo.finishEdit('Add spline');
				Blockbench.dispatchEvent( 'add_spline', {object: spline} )
				iteration++;

				Vue.nextTick(function() {
					if (settings.create_rename.value && iteration == 1) {
						spline.rename()
					}
				})
			}
			runEdit(false, result);

			Undo.amendEdit({
				sides_radial: {label: 'dialog.add_spline.sides_radial', type: 'num_slider', value: result.sides_radial, min: 3, max: 48, color: "u"},
				sides_tubular: {label: 'dialog.add_spline.sides_tubular', type: 'num_slider', value: result.sides_tubular, min: 1, max: 48, color: "v"},
				radius: {label: 'dialog.add_spline.radius', type: 'num_slider', value: result.radius, min: 1, max: 8, color: "w"},
				diameter: {label: 'dialog.add_spline.diameter', type: 'num_slider', value: result.diameter, min: 4, max: 64, interval_type: 'position', condition: ["circle"].includes(result.shape)},
				length: {label: 'dialog.add_spline.length', type: 'num_slider', value: result.length, min: 4, max: 64, interval_type: 'position', condition: ["segment", "square"].includes(result.shape)},
				width: {label: 'dialog.add_spline.length', type: 'num_slider', value: result.width, min: 4, max: 64, interval_type: 'position', condition: ["square"].includes(shape)},
			}, form => {
				Object.assign(result, form);
				runEdit(true, result);
			})
		}
	})
	new Action('add_spline', {
		icon: 'fa-bezier-curve',
		category: 'edit',
		condition: {modes: ['edit'], method: () => (Format.splines)},
		click: function () {
			add_spline_dialog.show();
		}
	})
    
	let previous_selection_mode = 'object';
	new BarSelect('spline_selection_mode', {
		options: {
			object: {name: true, icon: 'fas.fa-circle-nodes'},
			handles: {name: true, icon: 'fas.fa-bezier-curve'},
			// tilt: {name: true, icon: 'fas.fa-compass-drafting'},
		},
		icon_mode: true,
		condition: () => SplineMesh.selected.length && Modes.edit,
        onChange({value}) {
			if (value === previous_selection_mode) return;
			if (value === "object") {
				SplineMesh.selected.forEach(spline => {
					delete Project.spline_selection[spline.uuid];
				})
				Interface.removeSuggestedModifierKey('shift', 'modifier_actions.spline_select_multiple_points');
			} 
			else if (value === "handles") {
				Interface.addSuggestedModifierKey('shift', 'modifier_actions.spline_select_multiple_points');
			}
			// else if (value === "tilt") {
			// 	Interface.removeSuggestedModifierKey('shift', 'modifier_actions.spline_select_multiple_points');
			// }

			Transformer.updateSelection();
			Transformer.setMode(Toolbox.selected.transformerMode);
			SplineGizmos.changeHandleMode(value);
			previous_selection_mode = value;
        }
	})
    new BarSelect('spline_handle_mode', {
		condition: () => Modes.edit && SplineMesh.selected.length,
		category: 'transform',
		value: 'aligned',
		options: {
			aligned: true,
			mirrored: true,
			free: true,
		},
		onChange() {
			Transformer.updateSelection();
			Transformer.setMode(Toolbox.selected.transformerMode);
		}
	})
	new Action('extrude_spline_selection', {
		icon: 'upload',
		category: 'edit',
		keybind: new Keybind({key: 'e', shift: true}),
		condition: {modes: ['edit'], features: ['splines'], selected: {spline: true}, method: () => {
			let spline = SplineMesh.selected[0];
			let selectedHandles = spline.getSelectedHandles(true);
			let isFirstSelected = selectedHandles.includes(spline.getFirstHandle().key);
			let isLastSelected = selectedHandles.includes(spline.getLastHandle().key);
			return (spline && selectedHandles.length && (isFirstSelected || isLastSelected));
		}},
		click() {
			function runEdit(amended, extend = 1) {
				Undo.initEdit({elements: SplineMesh.selected, selection: true}, amended);

				function extrudeAlongSpline(spline, cKey, hKey, isEnd = false) {
					let { vec1, vec2, vec3, vec4, vec5 } = Reusable;
					let bézier = spline.getBézierForCurve(isEnd ? 1 : 0, cKey);
					let tangent = bézier.tangent.multiplyScalar(extend);

					// Point arrays
					let control1 = spline.vertices[spline.handles[hKey].control1];
					let joint = spline.vertices[spline.handles[hKey].joint];
					let control2 = spline.vertices[spline.handles[hKey].control2];

					// Base distance to be added to new handle points
					let c1Addition = [control1[0] - joint[0], control1[1] - joint[1], control1[2] - joint[2]]; // cancel out handle position for control1
					let c2Addition = [control2[0] - joint[0], control2[1] - joint[1], control2[2] - joint[2]]; // cancel out handle position for control2
					let addition = vec4.fromArray(isEnd ? c2Addition : c1Addition).multiplyScalar(2);

					// Extruded handle points
					let newControl1 = vec2.fromArray(control1).add(addition).add(tangent);
					let newjoint = vec1.fromArray(joint).add(addition).add(tangent);
					let newControl2 = vec3.fromArray(control2).add(addition).add(tangent);
					let newVerts = spline.addVertices(newControl1.toArray(), newjoint.toArray(), newControl2.toArray());

					spline.getSelectedVertices().replace(newVerts);

					// Create new handle, and add it with a corresponding curve based on if this is the start or end of our curve
					let newHandle = new SplineHandle(spline, {control1: newVerts[0], joint: newVerts[1], control2: newVerts[2]});
					if (isEnd) {
						let newHandles = spline.addHandles(newHandle);
						spline.addCurves(new SplineCurve(spline, { start_handle: hKey, end_handle: newHandles[0] }));
					} else { // If we're extruding at the front of the spline, we will need to re-order its arrays for everything to work properly
						// Move new handle at front of handles object
						let newHandles = spline.addHandles(newHandle);
						let hKey2 = `${newHandles[0]}`;
						let hData = {
							control1: spline.handles[hKey2].control1, 
							joint: spline.handles[hKey2].joint, 
							control2: spline.handles[hKey2].control2
						};

						delete spline.handles[hKey2];
						let hNewData = {};
						hNewData[hKey2] = new SplineHandle(spline, hData);

						spline.handles = {...hNewData, ...spline.handles};

						// Move new curve at front of curves object
						let newCurves = spline.addCurves(new SplineCurve(spline, { start_handle: hKey2, end_handle: hKey }));
						let cKey2 = `${newCurves[0]}`;
						let cData = {
							start: spline.curves[cKey2].start, 
							start_ctrl: spline.curves[cKey2].start_ctrl, 
							end_ctrl: spline.curves[cKey2].end_ctrl,
							end: spline.curves[cKey2].end
						};

						delete spline.curves[cKey2];
						let cNewData = {};
						cNewData[cKey2] = new SplineCurve(spline, cData);

						spline.curves = {...cNewData, ...spline.curves};
					}
				}

				SplineMesh.selected.forEach(spline => {
					let firstHandleKey = spline.getFirstHandle().key;
					let lastHandleKey = spline.getLastHandle().key;

					spline.getSelectedHandles(true).forEach(hKey => {
						if (hKey == lastHandleKey) {
							let cKey = spline.getCurvesOfHandle(lastHandleKey)[0];
							extrudeAlongSpline(spline, cKey, lastHandleKey, true);
						} 
						else if (hKey == firstHandleKey) {
							let cKey = spline.getCurvesOfHandle(firstHandleKey)[0];
							extrudeAlongSpline(spline, cKey, firstHandleKey);
						}

					})
					
				})

				Undo.finishEdit('Extrude mesh selection');
				Canvas.updateView({elements: SplineMesh.selected, element_aspects: {geometry: true, uv: true, faces: true}, selection: true});
			}
			runEdit();

			Undo.amendEdit({
				extend: {type: 'num_slider', value: 1, label: 'edit.extrude_spline_selection.extend', interval_type: 'position'},
			}, form => {
				runEdit(true, form.extend);
			})
		}
	})
	
	new Action('apply_spline_rotation', {
		icon: 'published_with_changes',
		category: 'edit',
		condition: {modes: ['edit'], features: ['splines'], method: () => (SplineMesh.selected.length)},
		click() { // Literally the same as this same Action from mesh_editing.js (Reusable excluded)
			let {vec1} = Reusable;
			Undo.finishEdit('Apply spline rotation');
			SplineMesh.selected.forEach(spline => {
				let rotation = spline.mesh.rotation;
				for (let vkey in spline.vertices) {
					vec1.fromArray(spline.vertices[vkey]);
					vec1.applyEuler(rotation);
					spline.vertices[vkey].V3_set(vec1.x, vec1.y, vec1.z);
				}
				spline.rotation.V3_set(0, 0, 0);
			})
			Canvas.updateView({elements: SplineMesh.selected, element_aspects: {geometry: true, transform: true}, selection: true});
		}
	})
	new Action('merge_splines', {
		icon: 'upload',
		category: 'edit',
		condition: {modes: ['edit'], features: ['splines'], method: () => (SplineMesh.selected.length >= 2)},
		click() {
			Undo.finishEdit('Merge splines');
			updateSelection();
			Canvas.updateView({elements, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
	// Could have an option to decide how many cuts we want later on
	new Action('divide_spline_curve', {
		icon: 'fas.fa-bezier-curve',
		category: 'edit',
		condition: {modes: ['edit'], features: ['splines'], method: () => {
			return SplineMesh.selected[0]?.getSelectedCurves(true).length;
		}},
		click() {
			function runEdit(ammended, factor = 50) {
				Undo.initEdit({elements: SplineMesh.selected}, ammended);
				
				let spline = SplineMesh.selected[0];
				let selectedCurves = spline.getSelectedCurves(true);
				let selectedPoints = spline.getSelectedVertices();
				let handleOrder = {};

				function createCurves(hKeys) {
					let newCurves = {};
					for (let i = 0; i < (hKeys.length - 1); i++) {
						let cKey = spline.addCurves(new SplineCurve(spline, { start_handle: hKeys[i], end_handle: hKeys[i + 1] }))[0];
						newCurves[cKey] = spline.curves[cKey];
						delete spline.curves[cKey];
					}
					return newCurves;
				}

				for (let hKey in spline.handles) {
					handleOrder[hKey] = spline.handles[hKey];

					selectedCurves.forEach(cKey => {
						let curve = spline.curves[cKey];
						let startHandle = curve.start_handle;

						if (startHandle == hKey) {
							let result = curve.split((factor / 100.0));

							spline.vertices[curve.start_ctrl] = result.start_ctrl;
							spline.vertices[curve.end_ctrl] = result.end_ctrl;

							let newVerts = spline.addVertices(result.middle_ctrl1, result.middle, result.middle_ctrl2);
							let newHandle = spline.addHandles(new SplineHandle(this, { control1: newVerts[0], joint: newVerts[1], control2: newVerts[2] }))[0];

							handleOrder[newHandle] = spline.handles[newHandle];
							selectedPoints.push(...newVerts);
						}
					})
				}

				spline.handles = handleOrder;
				spline.curves = createCurves(Object.keys(spline.handles));

				updateSelection();
				Undo.finishEdit('Divide spline curve');
				Canvas.updateView({elements, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
			}
			runEdit();

			Undo.amendEdit({
				extend: {type: 'num_slider', value: 50, min: 0, max: 100, label: 'edit.divide_spline_curve.position'},
			}, form => {
				runEdit(true, form.extend);
			})
		}
	})
	new Action('split_spline', {
		icon: 'call_split',
		category: 'edit',
		condition: {modes: ['edit'], features: ['splines'], method: () => {
			let spline = SplineMesh.selected[0];
			let selection = spline.getSelectedHandles(true);
			let isFirstSelected = selection.includes(spline.getFirstHandle().key);
			let isLastSelected = selection.includes(spline.getLastHandle().key);
			return (spline && selection.length === 1 && !isFirstSelected && !isLastSelected)
		}},
		click() {
			let elements = SplineMesh.selected.slice();
			Undo.initEdit({elements});

			let spline = SplineMesh.selected[0];
			let handle = spline.getSelectedHandles(true)[0];

			let handleKeys = Object.keys(spline.handles)
			let firstSplit = handleKeys.slice(0, handleKeys.indexOf(handle) + 1);
			let secondSplit = handleKeys.slice(handleKeys.indexOf(handle));

			function gatherVertices(hKey, obj) {
				let control1 = spline.handles[hKey].control1;
				let joint = spline.handles[hKey].joint;
				let control2 = spline.handles[hKey].control2;

				obj[control1] = spline.vertices[control1];
				obj[joint] = spline.vertices[joint];
				obj[control2] = spline.vertices[control2];
			}

			function createHandles(spline, vKeys) {
				for (let i = 0; i < vKeys.length; i += 3) {
					spline.addHandles(new SplineHandle(spline, { 
						control1: vKeys[i],
						joint: vKeys[i + 1],
						control2: vKeys[i + 2]
					}));
				}
			}

			function createCurves(spline, hKeys) {
				for (let i = 0; i < (hKeys.length - 1); i++) {
					spline.addCurves(new SplineCurve(spline, { start_handle: hKeys[i], end_handle: hKeys[i + 1] }));
				}
			}

			function createHalf(split) {
				let newspline = new SplineMesh(spline);
				newspline.vertices = {};
				newspline.handles = {};
				newspline.curves = {};
				
				let vertices = {};
				split.forEach(hKey => gatherVertices(hKey, vertices));

				for (let vKey in vertices) {
					newspline.addVertices(vertices[vKey]);
				}

				createHandles(newspline, Object.keys(newspline.vertices));
				createCurves(newspline, Object.keys(newspline.handles));

				elements.push(newspline);
				newspline.cyclic = false;
				newspline.init();
				return newspline;
			}

			let firstSpline = createHalf(firstSplit);
			let secondSpline = createHalf(secondSplit);

			let group = getCurrentGroup();
			if (group) {
				firstSpline.addTo(group);
				secondSpline.addTo(group);

				if (settings.inherit_parent_color.value) {
					firstSpline.color = group.color;
					secondSpline.color = group.color;
				}
			}

			firstSpline.name += '_first_half';
			secondSpline.name += '_second_half';
			unselectAllElements();
			firstSpline.select();

			delete Project.mesh_selection[spline.uuid];
			elements.remove(spline);
			spline.remove(false);

			Undo.finishEdit('Split spline');
			updateSelection();
			Canvas.updateView({elements, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
})