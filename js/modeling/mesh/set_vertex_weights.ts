import { Armature } from "../../outliner/armature";
import { ArmatureBone } from "../../outliner/armature_bone";


new Action('set_vertex_weights', {
	icon: 'weight',
	condition: {modes: ['edit'], method: () => (Mesh.selected[0]?.getArmature() && Mesh.selected[0].getSelectedVertices().length)},
	click() {
		let mesh = Mesh.selected[0];
		let selected_vertices = mesh.getSelectedVertices();
		let armature = mesh.getArmature() as Armature;
		let available_bones: ArmatureBone[] = armature.getAllBones();
		let bone_options = {};
		for (let bone of available_bones) {
			bone_options[bone.uuid] = bone.name;
		}
		let affected_bones = available_bones.filter(bone => {
			return selected_vertices.find(vkey => bone.vertex_weights[vkey]);
		});

		// Todo: translations. Add way to configure multiple bones
		new Dialog('set_vertex_weights', {
			title: 'action.set_vertex_weights',
			form: {
				bone: {type: 'select', label: 'data.armature_bone', value: available_bones[0].name, options: bone_options},
				weight: {type: 'number', label: 'dialog.set_vertex_weights.weight', value: 1, min: 0, max: 1},
				overwrite: {type: 'checkbox', label: 'dialog.set_vertex_weights.overwrite', value: true}
			},
			onConfirm(result) {
				let target_bone = available_bones.find(b => b.uuid == result.bone);
				affected_bones.safePush(target_bone);
				Undo.initEdit({elements: affected_bones});
				if (result.overwrite) {
					for (let bone of affected_bones) {
						if (bone.uuid == result.bone) continue;
						for (let vkey of selected_vertices) {
							delete bone.vertex_weights[vkey];
						}
					}
				}
				for (let vkey of selected_vertices) {
					target_bone.vertex_weights[vkey] = result.weight;
				}
				Undo.finishEdit('Set vertex weights');
				updateSelection();
			}
		}).show();
	}
})