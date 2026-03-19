import { getEditTransformSpace } from "../modeling/transform/edit_transform";
import { TransformerModule } from "../modeling/transform/transform_modules";

function displayDistance(number) {
	Blockbench.setCursorTooltip(trimFloatNumber(number));
}

let transform_keyframes = [];

new TransformerModule('animation', {
	priority: 0,
	condition: () => Modes.animate,
	use_condition: () => Animation.selected && Animation.selected.getBoneAnimator(),
	updateGizmo() {
		let target_node = Group.first_selected || Outliner.selected[0];
		if (!target_node) return;
		Transformer.attach(target_node);

		if (target_node.getWorldCenter) {
			Transformer.position.copy(target_node.getWorldCenter(true));
		} else {
			target_node.scene_object.getWorldPosition(Transformer.position);
		}
		if (
			Project.bedrock_animation_mode == 'attachable_first' &&
			Math.epsilon(Preview.selected.camera.position.x, Preview.selected.controls.target.x, 1e-9) &&
			Preview.selected.camera.position.z == 0
		) {
			Transformer.position.set(0, 20, 24)
		}

		if (Toolbox.selected.id === 'rotate_tool' && BarItems.rotation_space.value === 'global') {
			delete Transformer.rotation_ref;

		} else if (Toolbox.selected.id === 'move_tool' && BarItems.transform_space.value === 'global') {
			delete Transformer.rotation_ref;

		} else if (Toolbox.selected.id === 'move_tool' && BarItems.transform_space.value === 'local') {
			Transformer.rotation_ref = target_node.mesh;

		} else if (Toolbox.selected.id == 'resize_tool' || (Toolbox.selected.id === 'rotate_tool' && BarItems.rotation_space.value !== 'global')) {
			Transformer.rotation_ref = target_node.mesh;

		} else {
			Transformer.rotation_ref = target_node.mesh.parent;
		}
	},
	calculateOffset(context) {
		let {point, axis, angle} = context;
		
		if (!Animation.selected) {
			Blockbench.showQuickMessage('message.no_animation_selected')
		}
		let value = 0;
		let tool_id = Toolbox.selected.id;

		if (tool_id === 'rotate_tool') {
			value = Math.trimDeg(angle)
			var round_num = getRotationInterval(event)
		} else {
			value = point[axis]
			if (axis == 'e') value = point.length() * Math.sign(point.y||point.x);
			var round_num = canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl)
			if (tool_id === 'resize_tool') {
				value *= context.direction * 0.1;
				round_num *= 0.1;
			}
		}
		value = Math.round(value/round_num)*round_num;
		return value;
	},
	onStart(context) {
		if (Timeline.playing) {
			Timeline.pause()
		}
		transform_keyframes = [];
		var animator = Animation.selected.getBoneAnimator();
		if (!animator) return;

		var {before, result, new_keyframe} = animator.getOrMakeKeyframe(Toolbox.selected.animation_channel);

		Undo.initEdit({keyframes: before ? [before] : []})
		result.select();
		transform_keyframes.push(result);
		if (new_keyframe) transform_keyframes.push(new_keyframe)
	},
	onMove(context) {
		let {point, axis, axis_number, value} = context;
		let tool_id = Toolbox.selected.id;

		var difference = value - (this.previous_value||0)
		if (tool_id === 'rotate_tool' && Math.abs(difference) > 120) {
			difference = 0;
		}

		let {mesh} = Group.first_selected || ((Outliner.selected[0] && Outliner.selected[0].constructor.animator) ? Outliner.selected[0] : undefined);

		let updateRotationKeyframeFromMesh = () => {
			let old_rotation = mesh.pre_rotation ?? mesh.fix_rotation;
			let rotation = mesh.rotation;
			if (transform_keyframes[0].animator.quaternion_interpolation) {
				let q = Reusable.quat1.setFromEuler(old_rotation);
				mesh.quaternion.premultiply(q.invert());
			} else {
				rotation.x -= old_rotation.x; rotation.y -= old_rotation.y; rotation.z -= old_rotation.z;
			}
			transform_keyframes[0].offset('x', Math.roundTo( Math.trimDeg( Math.radToDeg(rotation.x) - transform_keyframes[0].calc('x') ), 4));
			transform_keyframes[0].offset('y', Math.roundTo( Math.trimDeg( Math.radToDeg(rotation.y) - transform_keyframes[0].calc('y') ), 4));
			transform_keyframes[0].offset('z', Math.roundTo( Math.trimDeg( Math.radToDeg(rotation.z) - transform_keyframes[0].calc('z') ), 4));
		}

		if (tool_id === 'rotate_tool' && (BarItems.rotation_space.value === 'global' || Transformer.axis == 'E' || (Timeline.selected_animator?.rotation_global && getEditTransformSpace() == 2))) {

			let normal = Transformer.axis == 'E'
				? context.rotate_normal
				: axis_number == 0 ? THREE.NormalX : (axis_number == 1 ? THREE.NormalY : THREE.NormalZ);
			let rotWorldMatrix = new THREE.Matrix4();
			rotWorldMatrix.makeRotationAxis(normal, Math.degToRad(difference))
			rotWorldMatrix.multiply(mesh.matrixWorld)

			if (Timeline.selected_animator?.rotation_global !== true) {
				let inverse = new THREE.Matrix4().copy(mesh.parent.matrixWorld).invert()
				rotWorldMatrix.premultiply(inverse)
			}

			mesh.matrix.copy(rotWorldMatrix);
			mesh.setRotationFromMatrix(rotWorldMatrix);

			updateRotationKeyframeFromMesh();
		
		} else if (tool_id === 'rotate_tool' && getEditTransformSpace() == 2 && [0, 1, 2].find(axis => axis !== axis_number && transform_keyframes[0].get(getAxisLetter(axis))) !== undefined) {

			let old_order = mesh.rotation.order;
			mesh.rotation.reorder(axis_number == 0 ? 'ZYX' : (axis_number == 1 ? 'ZXY' : 'XYZ'))
			var obj_val = Math.trimDeg(Math.radToDeg(mesh.rotation[axis]) + difference);
			mesh.rotation[axis] = Math.degToRad(obj_val);
			mesh.rotation.reorder(old_order);

			updateRotationKeyframeFromMesh();

		} else if (tool_id === 'move_tool' && BarItems.transform_space.value === 'global') {

			let offset_vec = new THREE.Vector3();
			offset_vec[axis] = difference;

			var rotation = new THREE.Quaternion();
			mesh.parent.getWorldQuaternion(rotation);
			offset_vec.applyQuaternion(rotation.invert());

			transform_keyframes[0].offset('x', offset_vec.x);
			transform_keyframes[0].offset('y', offset_vec.y);
			transform_keyframes[0].offset('z', offset_vec.z);

		} else if (tool_id === 'move_tool' && BarItems.transform_space.value === 'local') {

			let offset_vec = new THREE.Vector3();
			offset_vec[axis] = difference;
			offset_vec.applyQuaternion(mesh.quaternion);

			transform_keyframes[0].offset('x', offset_vec.x);
			transform_keyframes[0].offset('y', offset_vec.y);
			transform_keyframes[0].offset('z', offset_vec.z);

		} else if (tool_id === 'resize_tool' && axis == 'e') {

			transform_keyframes[0].offset('x', difference);
			if (!transform_keyframes[0].uniform) {
				transform_keyframes[0].offset('y', difference);
				transform_keyframes[0].offset('z', difference);
			}

		} else {
			if (tool_id === 'resize_tool') {
				transform_keyframes[0].uniform = false;	
			}
			transform_keyframes[0].offset(axis, difference);
		}
		if (Keyframe.selected[0] != transform_keyframes[0] || Keyframe.selected.length > 1) {
			transform_keyframes[0].select();
		} else {
			Animator.showMotionTrail(null, true);
		}
			
		displayDistance(context.value - this.initial_value);

		Animator.preview()

	},
	onEnd(context) {
		if (transform_keyframes.length && context.keep_changes) {
			Undo.finishEdit('Change keyframe', {keyframes: transform_keyframes});
		}
	},
	onCancel(context) {
		Undo.cancelEdit(true);
	}
});
