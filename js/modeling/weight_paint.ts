import { Blockbench } from '../api';
import { THREE } from '../lib/libs';
import { Armature } from '../outliner/armature';
import { ArmatureBone } from '../outliner/armature_bone';
import { Preview } from '../preview/preview';

type CanvasClickData =
	| { event: MouseEvent }
	| {
			event: MouseEvent;
			element: OutlinerElement;
			face: string;
			intersects: Array<THREE.Intersection<THREE.Mesh>>;
	  };

let brush_outline: HTMLElement;
function updateBrushOutline(event: PointerEvent) {
	if (!brush_outline) return;
	let preview = Preview.selected as Preview;
	let preview_offset = $(preview.canvas).offset();
	let click_pos = [event.clientX - preview_offset.left, event.clientY - preview_offset.top];
	preview.node.append(brush_outline);
	brush_outline.style.left = click_pos[0] + 'px';
	brush_outline.style.top = click_pos[1] + 'px';
}

let screen_space_vertex_positions: null | Record<string, { x: number; y: number }> = null;
const raycaster = new THREE.Raycaster();
function updateScreenSpaceVertexPositions(mesh: Mesh) {
	if (screen_space_vertex_positions) return screen_space_vertex_positions;

	const depth_check = (BarItems.weight_brush_xray as Toggle).value == false;
	let vec = new THREE.Vector3();
	raycaster.ray.origin.setFromMatrixPosition(Preview.selected.camera.matrixWorld);
	let raycasts = 0;

	screen_space_vertex_positions = {};

	for (let vkey in mesh.vertices) {
		let pos = mesh.mesh.localToWorld(vec.fromArray(mesh.vertices[vkey]));

		if (depth_check) {
			raycaster.ray.direction.copy(pos).sub(raycaster.ray.origin);
			const z_distance = raycaster.ray.direction.length();
			raycaster.ray.direction.normalize();
			let intersection = raycaster.intersectObject(mesh.mesh, false)[0];
			raycasts++;
			if (intersection && intersection.distance < z_distance - 0.001) {
				continue;
			}
		}
		let screen_pos = Preview.selected.vectorToScreenPosition(pos.clone());
		screen_space_vertex_positions[vkey] = screen_pos;
	}
	return screen_space_vertex_positions;
}
Blockbench.on('update_camera_position', () => {
	screen_space_vertex_positions = null;
});

new Tool('weight_brush', {
	icon: 'stylus_highlighter',
	category: 'tools',
	cursor: 'crosshair',
	toolbar: 'weight_brush',
	// @ts-ignore
	transformerMode: 'hidden',
	selectElements: false,
	modes: ['edit'],
	condition: { modes: ['edit'], method: () => Armature.all.length },

	onCanvasClick(data: CanvasClickData) {
		if ('element' in data == false) return;
		let preview = Preview.selected as Preview;
		let preview_offset = $(preview.canvas).offset();
		let armature_bone = ArmatureBone.selected[0] as ArmatureBone;
		let other_bones = armature_bone.getArmature().getAllBones() as ArmatureBone[];
		other_bones.remove(armature_bone);
		if (!armature_bone) {
			return Blockbench.showQuickMessage('Select an armature bone first!');
		}
		if (data.element instanceof Mesh == false) {
			return;
		}
		if (!data.element.getArmature()) {
			return Blockbench.showQuickMessage('This mesh is not attached to an armature!');
		}

		let undo_tracked = [armature_bone];
		Undo.initEdit({ elements: undo_tracked });

		let last_click_pos = [0, 0];
		const draw = (event: MouseEvent, data?: CanvasClickData | false) => {
			let radius = (BarItems.slider_weight_brush_size as NumSlider).get();
			let click_pos = [
				event.clientX - preview_offset.left,
				event.clientY - preview_offset.top,
			];
			let subtract = event.ctrlOrCmd || Pressing.overrides.ctrl;
			if (
				Math.pow(last_click_pos[0] - click_pos[0], 2) +
					Math.pow(last_click_pos[1] - click_pos[1], 2) <
				30
			) {
				return;
			}
			last_click_pos = click_pos;

			data = data ?? preview.raycast(event);
			if (!data || 'element' in data == false) return;
			let mesh = data.element;
			if (mesh instanceof Mesh == false) return;
			let vec = new THREE.Vector2();

			updateScreenSpaceVertexPositions(mesh);

			for (let vkey in mesh.vertices) {
				let screen_pos = screen_space_vertex_positions[vkey];
				if (!screen_pos) continue;
				let distance = vec
					.set(screen_pos.x - click_pos[0], screen_pos.y - click_pos[1])
					.length();
				let base_radius = 0.2;
				let falloff = (1 - distance / radius) * (1 + base_radius);
				let influence = Math.hermiteBlend(Math.clamp(falloff, 0, 1));
				let value = armature_bone.vertex_weights[vkey] ?? 0;

				if (event.shiftKey || Pressing.overrides.shift) {
					influence /= 8;
				}
				if (subtract) {
					value = value * (1 - influence);
				} else {
					value = value + (1 - value) * influence;
				}

				// Reduce weight on other bones
				for (let bone of other_bones) {
					if (bone.vertex_weights[vkey] && !subtract) {
						bone.vertex_weights[vkey] = Math.clamp(
							bone.vertex_weights[vkey] - influence,
							0,
							1
						);
						if (Undo.current_save && !undo_tracked.includes(bone)) {
							Undo.current_save.addElements([bone]);
							undo_tracked.push(bone);
						}
					}
				}

				if (value < 0.04) {
					delete armature_bone.vertex_weights[vkey];
				} else {
					armature_bone.vertex_weights[vkey] = value;
				}
			}
			// @ts-ignore
			Mesh.preview_controller.updateGeometry(mesh);
		};
		const stop = (event: MouseEvent) => {
			document.removeEventListener('pointermove', draw);
			document.removeEventListener('pointerup', stop);

			Undo.finishEdit('Paint vertex weights');
		};
		document.addEventListener('pointermove', draw);
		document.addEventListener('pointerup', stop);
		draw(data.event, data);
	},
	onSelect() {
		Canvas.updateView({ elements: Mesh.all, element_aspects: { faces: true } });
		(BarItems.slider_weight_brush_size as NumSlider).update();
		Interface.addSuggestedModifierKey('ctrl', 'modifier_actions.subtract');
		Interface.addSuggestedModifierKey('shift', 'modifier_actions.reduced_intensity');
		// @ts-ignore
		ArmatureBone.preview_controller.material.wireframe =
			ArmatureBone.preview_controller.material_selected.wireframe = true;

		brush_outline = Interface.createElement('div', { id: 'weight_brush_outline' });
		document.addEventListener('pointermove', updateBrushOutline);
	},
	onUnselect() {
		setTimeout(() => {
			Canvas.updateView({ elements: Mesh.all, element_aspects: { faces: true } });
		}, 0);
		Interface.removeSuggestedModifierKey('ctrl', 'modifier_actions.subtract');
		Interface.removeSuggestedModifierKey('shift', 'modifier_actions.reduced_intensity');
		// @ts-ignore
		ArmatureBone.preview_controller.material.wireframe =
			ArmatureBone.preview_controller.material_selected.wireframe = false;

		if (brush_outline) brush_outline.remove();
		document.removeEventListener('pointermove', updateBrushOutline);
	},
});
let slider = new NumSlider('slider_weight_brush_size', {
	condition: () => Toolbox?.selected?.id == 'weight_brush',
	tool_setting: 'weight_brush_size',
	category: 'edit',
	settings: {
		min: 1,
		max: 1024,
		interval: 1,
		default: 50,
	},
});
slider.on('change', (data: { number: number }) => {
	if (brush_outline) {
		brush_outline.style.setProperty('--radius', data.number.toString());
	}
});
new Toggle('weight_brush_xray', {
	icon: 'disabled_visible',
	category: 'edit',
	condition: () => Toolbox?.selected?.id == 'weight_brush',
});

const vertex_weight_view_modes = ['vertex_weight', 'weighted_bone_colors'];
function updateWeightPreview() {
	if (
		Toolbox.selected.id == 'weight_brush' ||
		vertex_weight_view_modes.includes(Project.view_mode)
	) {
		Canvas.updateView({
			elements: Mesh.all.filter(mesh => mesh.getArmature()),
			element_aspects: { geometry: true },
		});
		if (Modes.animate) Animator.preview();
	}
}
Blockbench.on('update_selection', updateWeightPreview);
