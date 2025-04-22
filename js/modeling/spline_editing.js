BARS.defineActions(function() {
	new Action('add_spline', {
		icon: 'fa-bezier-curve',
		category: 'edit',
		condition: {modes: ['edit'], method: () => (Format.meshes)},
		click: function () {			
			Undo.initEdit({outliner: true, elements: [], selection: true});
			var spline = new SplineMesh({});
			let group = getCurrentGroup();
			if (group) {
				spline.addTo(group)
				if (settings.inherit_parent_color.value) spline.color = group.color;
			}

            elements.push(spline);
            spline.init()
            if (Group.selected) Group.selected.unselect()
                spline.select()
            Undo.finishEdit('Add spline');
            Blockbench.dispatchEvent( 'add_spline', {object: spline} )

            Vue.nextTick(function() {
                if (settings.create_rename.value) {
                    spline.rename()
                }
            })
		}
	})
    
	let previous_selection_mode = 'object';
	new BarSelect('spline_selection_mode', {
		options: {
			object: {name: true, icon: 'fas.fa-circle-nodes'},
			handles: {name: true, icon: 'fas.fa-bezier-curve'},
			tilt: {name: true, icon: 'fas.fa-compass-drafting'},
		},
		icon_mode: true,
		condition: () => SplineMesh.hasSelected() && Modes.edit,
        onChange({value}) {
			if (value === previous_selection_mode) return;
			switch (value) {
				case "object": {
					SplineMesh.selected.forEach(spline => {
						delete Project.spline_selection[spline.uuid];
					})
					Interface.removeSuggestedModifierKey('shift', 'modifier_actions.spline_select_multiple_points');
				}
				case "handles":
					Interface.addSuggestedModifierKey('shift', 'modifier_actions.spline_select_multiple_points');
				case "tilt":
					Interface.removeSuggestedModifierKey('shift', 'modifier_actions.spline_select_multiple_points');
			}

			Transformer.updateSelection();
			Transformer.setMode(Toolbox.selected.transformerMode);
			SplineGizmos.changeHandleMode(value);
			previous_selection_mode = value;
        }
	})
    new BarSelect('spline_handle_mode', {
		condition: () => Modes.edit && SplineMesh.hasSelected(),
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
		condition: {modes: ['edit'], features: ['splines'], method: () => {
			return (SplineMesh.selected[0] && SplineMesh.selected[0].getSelectedHandles().length)
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
						spline.addCurves([hKey, newHandles[0]]);
					} else { // If we're extruding at the front of the spline, we will need to re-order its arrays for everything to work properly
						// Move new handle at front of handles object
						let newHandles = spline.addHandles(newHandle);
						let hKey2 = `${newHandles[0]}`;
						let hData = {
							spline: spline.handles[hKey2].spline, 
							control1: spline.handles[hKey2].control1, 
							joint: spline.handles[hKey2].joint, 
							control2: spline.handles[hKey2].control2
						};

						delete spline.handles[hKey2];
						let hNewData = {};
						hNewData[hKey2] = new SplineHandle(hData.spline, {control1: hData.control1,joint: hData.joint,control2: hData.control2});

						spline.handles = {...hNewData, ...spline.handles};

						// Move new curve at front of curves object
						let newCurves = spline.addCurves([hKey2, hKey]);
						let cKey = `${newCurves[0]}`;
						let cData = {...spline.curves[cKey]};

						delete spline.curves[cKey];
						let cNewData = {};
						cNewData[cKey] = cData;

						spline.curves = {...cNewData, ...spline.curves};
					}
					console.log(isEnd);
				}

				function getCurveFromPoint(spline, vKey) {
					for (let cKey of Object.keys(spline.curves)) {
						if (spline.curves[cKey].start_ctrl == vKey || spline.curves[cKey].end_ctrl == vKey) {
							return cKey;
						}
					}
					console.error(`no curves contains point ${vKey}, this shouldn't happen. Especially if that point is "undefined"!`);
					return null;
				}

				SplineMesh.selected.forEach(spline => {
					let firstHandleKey = spline.getFirstHandle().key;
					let firstHandleControl = spline.getFirstHandle().data.control2;

					let lastHandleKey = spline.getLastHandle().key;
					let lastHandleControl = spline.getLastHandle().data.control1;

					if (spline.getSelectedHandles()[0] == lastHandleKey) {
						let cKey = getCurveFromPoint(spline, lastHandleControl);
						extrudeAlongSpline(spline, cKey, lastHandleKey, true);
					};
					if (spline.getSelectedHandles()[0] == firstHandleKey) {
						let cKey = getCurveFromPoint(spline, firstHandleControl);
						extrudeAlongSpline(spline, cKey, firstHandleKey);
					}
					
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
			updateSelection();
			Undo.finishEdit('Merge splines')
			Canvas.updateView({elements, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
	new Action('split_spline', {
		icon: 'call_split',
		category: 'edit',
		condition: {modes: ['edit'], features: ['splines'], method: () => (SplineMesh.selected[0] && SplineMesh.selected[0].getSelectedVertices().length)},
		click() {
			Undo.finishEdit('Merge splines');
			updateSelection();
			Canvas.updateView({elements, element_aspects: {geometry: true, uv: true, faces: true}, selection: true})
		}
	})
})