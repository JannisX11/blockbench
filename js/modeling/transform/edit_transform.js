import { TransformerModule } from "./transform_modules";
import { getPivotObjects, getRotationObjects, getSelectedMovingElements, moveElementsInSpace } from "../transform";

function displayDistance(number) {
	Blockbench.setCursorTooltip(trimFloatNumber(number));
}

export function getEditTransformSpace() {
	if (!selected.length && (!Group.first_selected || !Format.bone_rig)) return;

	let input_space;
	switch (Toolbox.selected.id) {
		case 'rotate_tool': input_space = BarItems.rotation_space.get(); break;
		case 'pivot_tool': input_space = BarItems.transform_pivot_space.get(); break;
		case 'move_tool': default: input_space = BarItems.transform_space.get(); break;
	}

	if (Toolbox.selected == BarItems.rotate_tool && Format.rotation_limit) return 2;

	if (input_space == 'local' && selected.length && selected[0].getTypeBehavior('rotatable') && (!Format.bone_rig || !Group.first_selected)) {
		let is_local = true;
		if (Format.bone_rig) {
			for (var el of selected) {
				if (el.parent !== selected[0].parent) {
					is_local = false;
					break;
				}
			}
		}
		if (is_local) {
			for (var el of selected) {
				if (el.rotation !== selected[0].rotation &&
				!(el.rotation instanceof Array && el.rotation.equals(selected[0].rotation))
				) {
					is_local = false;
					break;
				}
			}
		}
		if (is_local) return 2;
	}
	if (input_space === 'local' && Format.bone_rig && Group.first_selected) {
		// Group local Space
		return 2;
	}
	if (input_space === 'normal' && (Mesh.selected.length || SplineMesh.selected.length)) {
		// Local Space
		return 3;
	}
	if (input_space !== 'global' && Format.bone_rig) {
		// Bone Space
		if (Format.bone_rig && Group.first_selected && Group.first_selected.matchesSelection()) {
			if (Group.first_selected.parent instanceof Group) {
				return Group.first_selected.parent;
			} else {
				return 0;
			}
		}
		let bone = 0;
		if (Outliner.selected.length) {
			bone = Outliner.selected[0].parent;
		} else if (Group.first_selected && Group.first_selected.parent instanceof Group) {
			bone = Group.first_selected.parent;
		}
		for (var el of Outliner.selected) {
			if (el.parent !== bone) {
				bone = 0;
				break;
			}
		}
		return bone instanceof OutlinerNode ? bone : 0;
	}
	// Global Space
	return 0;
}

new TransformerModule('edit', {
	priority: 1,
	condition: () => Modes.id === 'edit' || Modes.id === 'pose' || Toolbox.selected.id == 'pivot_tool',
	updateGizmo() {
		if (Transformer.visible) {
			let rotation_tool = false;
			let rotation_object;
			switch (Toolbox.selected.id) {
				case 'rotate_tool': {
					rotation_tool = true;
					rotation_object = getRotationObjects();
					break;
				}
				case 'pivot_tool': {
					rotation_tool = true;
					rotation_object = getPivotObjects();
					break;
				}
				case 'move_tool': {
					if (Group.selected.length) rotation_object = Group.selected;
				}
			}
			if (rotation_object instanceof Array || (!rotation_object && !rotation_tool)) {
				let arr = rotation_object instanceof Array ? rotation_object : Outliner.selected;
				rotation_object = undefined;
				for (let obj of arr) {
					if (obj.visibility !== false) {
						rotation_object = obj;
						break;
					}
				}
			}
			if (!rotation_object) {
				Transformer.detach();
				return;
			}
			Transformer.rotation_object = rotation_object;
			
			//Center
			if (Toolbox.selected.id === 'rotate_tool' || Toolbox.selected.id === 'pivot_tool') {
				if ((rotation_object instanceof Mesh && Toolbox.selected.id === 'rotate_tool' &&
					Project.mesh_selection[rotation_object.uuid] && (
						Project.mesh_selection[rotation_object.uuid].vertices.length > 0 ||
						Project.mesh_selection[rotation_object.uuid].edges.length > 0 ||
						Project.mesh_selection[rotation_object.uuid].faces.length > 0
					)) || 
					(rotation_object instanceof SplineMesh && Toolbox.selected.id === 'rotate_tool' &&
					Project.spline_selection[rotation_object.uuid] && 
					Project.spline_selection[rotation_object.uuid].vertices.length > 0)
				) {
					Transformer.position.copy(rotation_object.getWorldCenter())
				} else if (rotation_object.mesh) {
					rotation_object.mesh.getWorldPosition(Transformer.position);
				} else {
					Transformer.position.copy(rotation_object.getWorldCenter());
				}
				Transformer.position.sub(scene.position);
			} else {
				var center = getSelectionCenter()
				Transformer.position.fromArray(center)
			}

			let space = getEditTransformSpace();
			//Rotation
			if (space >= 2 || Toolbox.selected.id == 'resize_tool' || Toolbox.selected.id == 'stretch_tool') {
				Transformer.rotation_ref = (Group.first_selected && Format.bone_rig) ? Group.first_selected.mesh : (selected[0] && selected[0].mesh);
				if (space === 3 && Mesh.selected[0]) {
					let rotation = Mesh.selected[0].getSelectionRotation();
					if (rotation && !Transformer.dragging) Transformer.rotation_selection.copy(rotation);
				}
				if (space === 3 && SplineMesh.selected[0]) {
					if (SplineMesh.selected[0].getSelectedHandles(true).length) {
						let handle = SplineMesh.selected[0].getSelectedHandles(true)[0];
						let euler_arr = SplineMesh.selected[0].getHandleEuler(handle).combined;

						let rotation = euler_arr.V3_toEuler();
						if (rotation && !Transformer.dragging) Transformer.rotation_selection.copy(rotation);
					}
				}
			
			} else if (space instanceof OutlinerNode && space.getTypeBehavior('parent')) {
				Transformer.rotation_ref = space.mesh;

			}
		} else if (Toolbox.selected.id == 'vertex_snap_tool' && (Outliner.selected.length || Group.first_selected)) {
			var center = getSelectionCenter()
			Transformer.position.fromArray(center)
		}
	},
	calculateOffset(context) {
		let {point, axis, angle, second_axis, event} = context;
		let tool_id = Toolbox.selected.id;

		if (tool_id === 'move_tool') {

			var snap_factor = canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl)
			return Math.round( point[axis] / snap_factor ) * snap_factor;
			
		} else if (tool_id === 'resize_tool') {
			if (second_axis) {
				if (axis == 'y') {axis = 'z';} else
				if (second_axis == 'y') {axis = 'y';} else
				if (second_axis == 'z') {axis = 'x';}
			}
			var snap_factor = canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl)
			let move_value = point[axis];
			if (axis == 'e') move_value = point.length() * Math.sign(point.y||point.x);
			move_value = Math.round( move_value / snap_factor ) * snap_factor;

			return move_value

		} else if (tool_id === 'stretch_tool') {
			if (second_axis) {
				if (axis == 'y') {axis = 'z';} else
				if (second_axis == 'y') {axis = 'y';} else
				if (second_axis == 'z') {axis = 'x';}
			}
			var snap_factor = canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl)
			let move_value = point[axis];
			if (axis == 'e') move_value = point.length() * Math.sign(point.y||point.x);
			move_value = Math.round( move_value / snap_factor ) * snap_factor;
			move_value *= context.direction * 1/8;

			return move_value;

		} else if (tool_id === 'rotate_tool') {
			var snap = getRotationInterval(event)
			angle = Math.round(angle / snap) * snap
			if (Math.abs(angle) > 300) angle = angle > 0 ? -snap : snap;
			return angle;

		} else if (tool_id === 'pivot_tool') {

			var snap_factor = canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl)
			return Math.round( point[axis] / snap_factor ) * snap_factor;
		}

	},
	onStart(context) {
		let tool_id = Toolbox.selected.id;
		if (tool_id === 'resize_tool' || tool_id === 'stretch_tool') {
			Outliner.selected.forEach(function(obj) {
				if (obj instanceof Mesh || obj instanceof SplineMesh) {
					obj.oldVertices = {};
					for (let key in obj.vertices) {
						obj.oldVertices[key] = obj.vertices[key].slice();
					}
				} else if (obj.getTypeBehavior('resizable')) {
					obj.temp_data.old_size = typeof obj.size == 'function' ? obj.size(context.axis_number) : obj.size.slice();
					if (obj.stretch) obj.temp_data.oldStretch = obj.stretch.slice();
					if (obj.uv_offset) obj.temp_data.oldUVOffset = obj.uv_offset.slice();
					if (obj.to && obj.to) obj.temp_data.oldCenter = obj.from.map((from, i) => (from + obj.to[i]) / 2);
				} else if (obj.size) {
					obj.temp_data.old_size = obj.size.slice();
				}
				if (obj.getTypeBehavior('stretchable')) {
					obj.temp_data.oldStretch = obj.stretch.slice();
				}
			})
		}
		var rotate_group = Format.bone_rig && Group.first_selected && (Toolbox.selected.transformerMode == 'rotate');

		if (tool_id == 'move_tool') {
			if (Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
				Cube.selected.forEach(function(obj) {
					if (Format.cube_size_limiter.test(obj)) {
						Format.cube_size_limiter.move(obj);
					}
				})
			}
			if (BarItems.proportional_editing.value) {
				Mesh.selected.forEach(mesh => {
					ProportionalEdit.calculateWeights(mesh);
				})
			}
		}

		if (rotate_group) {
			Undo.initEdit({groups: Group.multi_selected})
		} else {
			Undo.initEdit({elements: getSelectedMovingElements(), groups: Group.all.filter(g => g.selected)});
		}
	},
	onMove(context) {
		let {axis, axis_number, value, second_axis, second_axis_number} = context;
		let tool_id = Toolbox.selected.id;
		var difference = value - (this.previous_value||0)
		
		if (tool_id === 'move_tool') {
			var overlapping = false
			if (Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
				Cube.selected.forEach(function(obj) {
					let from = obj.from.slice();
					let to = obj.to.slice();
					from[axis_number] += difference;
					to[axis_number] += difference;
					overlapping = overlapping || Format.cube_size_limiter.test(obj, {from, to});
				})
			}
			if (!overlapping) {
				displayDistance(value);

				moveElementsInSpace(difference, axis_number)

				updateSelection()
			}

		} else if (tool_id === 'resize_tool') {

			Outliner.selected.forEach(function(obj, i) {
				if (obj.getTypeBehavior('resizable')) {
					let bidirectional = ((event.altKey || Pressing.overrides.alt) && BarItems.swap_tools.keybind.key != 18) !== Mesh.hasSelected();

					if (axis == 'e') {
						obj.resize(value, 0, false, null, true);
						obj.resize(value, 1, false, null, true);
						obj.resize(value, 2, false, null, true);

					} else if (!second_axis) {
						obj.resize(value, axis_number, context.direction == -1, null, bidirectional);

					} else {
						obj.resize(value, axis_number, false, null, true);
						obj.resize(value, second_axis_number, false, null, true);
					}
				}
			})
			displayDistance(value * context.direction);
			updateSelection()

		} else if (tool_id === 'stretch_tool') {
			
			Outliner.selected.forEach(function(obj, i) {
				if (obj.stretch && obj.temp_data.oldStretch) {
					if (axis == 'e') {
						obj.stretch[0] = obj.temp_data.oldStretch[0] + value;
						obj.stretch[1] = obj.temp_data.oldStretch[1] + value;
						obj.stretch[2] = obj.temp_data.oldStretch[2] + value;
					} else if (!second_axis) {
						obj.stretch[axis_number] = obj.temp_data.oldStretch[axis_number] + value;
					} else {
						obj.stretch[axis_number] = obj.temp_data.oldStretch[axis_number] + value;
						obj.stretch[second_axis_number] = obj.temp_data.oldStretch[second_axis_number] + value;
					}
				}
			})
			displayDistance(value);
			Canvas.updatePositions()
				
		} else if (tool_id === 'rotate_tool') {

			let angle = value;
			var difference = angle - this.previous_value
			if (axis_number == undefined) {
				axis_number = context.rotate_normal;
			}
			rotateOnAxis(n => (n + difference), axis_number)
			Canvas.updatePositions(true)
			Transformer.updateSelection()
			displayDistance(angle - this.initial_value);

		} else if (tool_id === 'pivot_tool') {

			var origin = Transformer.rotation_object.origin.slice()
			let transform_space = getEditTransformSpace();

			if (transform_space == 0) {
				let vec = new THREE.Vector3();
				var rotation = new THREE.Quaternion();
				vec[axis] = difference;
				Transformer.rotation_object.mesh.parent.getWorldQuaternion(rotation);
				vec.applyQuaternion(rotation.invert());
				origin.V3_add(vec.x, vec.y, vec.z);

			} else if (transform_space == 2) {
				let vec = new THREE.Vector3();
				var rotation = new THREE.Quaternion();
				rotation.copy(Transformer.rotation_object.mesh.quaternion);
				vec[axis] = difference;
				vec.applyQuaternion(rotation);
				origin.V3_add(vec.x, vec.y, vec.z);

			} else {
				origin[axis_number] += difference;
			}
			
			let elements_to_update = Outliner.selected.slice();
			if (Format.bone_rig && Group.first_selected) {
				for (let group of Group.multi_selected) {
					group.transferOrigin(origin);
					group.forEachChild(child => {
						if (child instanceof OutlinerElement) {
							elements_to_update.safePush(child);
						}
					})
				}
			} else {
				Outliner.selected.forEach(obj => {
					if (obj.transferOrigin) {
						obj.transferOrigin(origin);
					}
				})
			}
			displayDistance(value);
			Canvas.updateView({
				elements: elements_to_update,
				element_aspects: {geometry: true, transform: true},
				groups: Group.all,
				group_aspects: {transform: true},
				selection: true
			})
			if (Modes.animate) {
				Animator.preview();
			}
		}
	},
	onEnd(context) {
		let tool_id = Toolbox.selected.id;
		if (tool_id === 'resize_tool' || tool_id === 'stretch_tool') {
			//Scale and stretch
			Outliner.selected.forEach(function(obj) {
				delete obj.temp_data.old_size;
				delete obj.temp_data.oldStretch;
				delete obj.temp_data.oldCenter;
				delete obj.temp_data.oldUVOffset;
			})
			if (context.has_changed && context.keep_changes) {
				if (tool_id === 'resize_tool') {
					Undo.finishEdit('Resize')
				} else if (tool_id === 'stretch_tool') {
					Undo.finishEdit('Stretch')
				}
			}

		} else if (Transformer.axis !== null && context.has_changed && context.keep_changes) {

			if (tool_id == 'pivot_tool') {
				Undo.finishEdit('Move pivot')
			} else if (tool_id == 'rotate_tool') {
				afterRotateOnAxis();
				Undo.finishEdit('Rotate selection')
			} else {
				Undo.finishEdit('Move selection')
			}
		}
		autoFixMeshEdit()
		updateSelection()
	},
	onCancel(context) {
		Undo.cancelEdit(true);
	}
});

const global = {
	getEditTransformSpace
}
Object.assign(window, global);
