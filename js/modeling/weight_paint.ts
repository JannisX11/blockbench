import { Blockbench } from '../api';
import { THREE } from '../lib/libs';
import { Armature } from '../outliner/armature';
import { ArmatureBone } from '../outliner/armature_bone';
import { Preview } from '../preview/preview';
import { symmetrizeArmature } from './mirror_modeling';

type CanvasClickData = {event: MouseEvent} | {
	event: MouseEvent
	element: OutlinerElement
	face: string
	intersects: Array<THREE.Intersection>
}

let brush_outline: HTMLElement;
function updateBrushOutline(event: PointerEvent) {
	if (!brush_outline || Toolbox.selected.id != 'weight_brush') return;
	let preview = Preview.selected as Preview;
	let preview_offset = $(preview.canvas).offset();
	let click_pos = [
		event.clientX - preview_offset.left,
		event.clientY - preview_offset.top,
	]
	preview.node.append(brush_outline);
	brush_outline.style.left = click_pos[0] + 'px';
	brush_outline.style.top = click_pos[1] + 'px';
	brush_outline.style.display = (event.altKey || Pressing.overrides.alt) ? 'none' : 'block'
}
Blockbench.on('update_pressed_modifier_keys', (arg) => {
	updateBrushOutline(arg.event);
});


let screen_space_vertex_positions: null | Record<string, {x:number, y:number}> = null;
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
			raycaster.ray.direction.copy(pos).sub(raycaster.ray.origin)
			const z_distance = raycaster.ray.direction.length();
			raycaster.ray.direction.normalize();
			let intersection = raycaster.intersectObject(mesh.mesh, false)[0];
			raycasts++;
			if (intersection && intersection.distance < z_distance-0.001) {
				continue;
			}
		}
		let screen_pos = Preview.selected.vectorToScreenPosition(pos.clone());
		screen_space_vertex_positions[vkey] = screen_pos;
	}
	return screen_space_vertex_positions;
}
Blockbench.on('update_camera_position', () => {
	screen_space_vertex_positions = null
})

new Tool('weight_brush', {
	icon: 'stylus_highlighter',
	category: 'tools',
	cursor: 'crosshair',
	toolbar: 'weight_brush',
	// @ts-ignore
	transformerMode: 'hidden',
	selectElements: false,
	modes: ['edit'],
	condition: {modes: ['edit'], method: () => Armature.all.length},
	
	onCanvasClick(data: CanvasClickData) {
		let element = 'element' in data && data.element;
		if (element instanceof ArmatureBone) {
			return element.select(data.event);
		}
		if (data.event.altKey || Pressing.overrides.alt) return;
		let preview = Preview.selected as Preview;
		let preview_offset = $(preview.canvas).offset();
		let armature_bone = ArmatureBone.selected[0] as ArmatureBone | undefined;
		if (!armature_bone) {
			return Blockbench.showQuickMessage('Select an armature bone first!');
		}
		let armature = armature_bone.getArmature();
		let all_bones = armature.getAllBones() as ArmatureBone[];
		let other_bones = all_bones.slice();
		other_bones.remove(armature_bone);
		if (!element) {
			element = armature.children.find(el => el instanceof Mesh);
		}
		if (element instanceof Mesh == false) {
			return;
		}
		if (!element.getArmature()) {
			return Blockbench.showQuickMessage('This mesh is not attached to an armature!');
		}

		let undo_tracked = all_bones;
		Undo.initEdit({elements: undo_tracked, mirror_modeling: false});
		
		let last_click_pos = [0, 0];
		const draw = (event: MouseEvent, data?: CanvasClickData|false) => {
			let radius = size_slider.get();
			let click_pos = [
				event.clientX - preview_offset.left,
				event.clientY - preview_offset.top,
			];
			let subtract = event.ctrlOrCmd || Pressing.overrides.ctrl;
			if (Math.pow(last_click_pos[0]-click_pos[0], 2) + Math.pow(last_click_pos[1]-click_pos[1], 2) < 30) {
				return;
			}
			last_click_pos = click_pos;

			data = data ?? preview.raycast(event);
			let mesh = element;
			if (mesh instanceof Mesh == false) return;
			let vec = new THREE.Vector2();
			let limit = limit_slider.get() / 100;
			let base_radius = 0.2;
			let target_average_x = 0;
			let affected_vkeys = new Set<string>();

			updateScreenSpaceVertexPositions(mesh);

			for (let vkey in mesh.vertices) {
				let screen_pos = screen_space_vertex_positions[vkey];
				if (!screen_pos) continue;
				let distance = vec.set(screen_pos.x - click_pos[0], screen_pos.y - click_pos[1]).length();
				let falloff = (1-(distance / radius)) * (1 + base_radius);
				let influence = Math.hermiteBlend(Math.clamp(falloff, 0, 1));
				let value = armature_bone.vertex_weights[vkey] ?? 0;
				if (influence <= 0) continue;
				
				if (event.shiftKey || Pressing.overrides.shift) {
					influence /= 8;
				}
				if (subtract) {
					value = value * (1-influence);
				} else {
					value = value + (limit-value) * influence;
				}

				// Reduce weight on other bones
				if (blend_mode_select.value == 'set') {
					for (let bone of other_bones) {
						if (bone.vertex_weights[vkey] && !subtract) {
							let lower_limit = Math.min(Math.max(0, 1-limit), bone.vertex_weights[vkey]);
							bone.vertex_weights[vkey] = Math.clamp(bone.vertex_weights[vkey] - influence, lower_limit, 1);
						}
					}
				}

				if (value < 0.04) {
					delete armature_bone.vertex_weights[vkey];
				} else {
					armature_bone.vertex_weights[vkey] = value
				}
				target_average_x += mesh.vertices[vkey][0];
				affected_vkeys.add(vkey);
			}
			symmetrizeArmature(armature, mesh, affected_vkeys);
			// @ts-ignore
			Mesh.preview_controller.updateGeometry(mesh);
		}
		const stop = (event: MouseEvent) => {
			document.removeEventListener('pointermove', draw);
			document.removeEventListener('pointerup', stop);

			Undo.finishEdit('Paint vertex weights');
		}
		document.addEventListener('pointermove', draw);
		document.addEventListener('pointerup', stop);
		draw(data.event, data);

	},
	onSelect() {
		Canvas.updateView({elements: [...Mesh.all, ...ArmatureBone.all], element_aspects: {faces: true}});
		size_slider.update();
		limit_slider.update();
		Interface.addSuggestedModifierKey('ctrl', 'modifier_actions.subtract');
		Interface.addSuggestedModifierKey('shift', 'modifier_actions.reduced_intensity');
		Interface.addSuggestedModifierKey('alt', 'modifier_actions.select_bone');

		brush_outline = brush_outline ?? Interface.createElement('div', {id: 'weight_brush_outline'});
		document.addEventListener('pointermove', updateBrushOutline);
	},
	onUnselect() {
		setTimeout(() => {
			Canvas.updateView({elements: [...Mesh.all, ...ArmatureBone.all], element_aspects: {faces: true}});
		}, 0);
		Interface.removeSuggestedModifierKey('ctrl', 'modifier_actions.subtract');
		Interface.removeSuggestedModifierKey('shift', 'modifier_actions.reduced_intensity');
		Interface.removeSuggestedModifierKey('alt', 'modifier_actions.select_bone');

		if (brush_outline) brush_outline.remove()
		document.removeEventListener('pointermove', updateBrushOutline);
	}
})
let size_slider = new NumSlider('slider_weight_brush_size', {
	condition: () => Toolbox?.selected?.id == 'weight_brush',
	tool_setting: 'weight_brush_size',
	category: 'edit',
	settings: {
		min: 1, max: 1024, interval: 1, default: 50,
	}
})
size_slider.on('change', (data: {number: number}) => {
	if (brush_outline) {
		brush_outline.style.setProperty('--radius', data.number.toString());
	}
})
let limit_slider = new NumSlider('slider_weight_brush_limit', {
	condition: () => Toolbox?.selected?.id == 'weight_brush',
	tool_setting: 'slider_weight_brush_limit',
	category: 'edit',
	
	settings: {
		min: 1, max: 100, interval: 1, default: 100, show_bar: true,
	}
})
new Toggle('weight_brush_xray', {
	icon: 'disabled_visible',
	category: 'edit',
	condition: () => Toolbox?.selected?.id == 'weight_brush',
})
let blend_mode_select = new BarSelect('weight_brush_blend_mode', {
	category: 'edit',
	options: {
		set: 'action.weight_brush_blend_mode.set',
		add: 'action.weight_brush_blend_mode.add',
	}
})

const vertex_weight_view_modes = ['vertex_weight', 'weighted_bone_colors'];
function updateWeightPreview() {
	if (Toolbox.selected.id == 'weight_brush' || 
		vertex_weight_view_modes.includes(Project.view_mode)
	) {
		Canvas.updateView({elements: Mesh.all.filter(mesh => mesh.getArmature()), element_aspects: {geometry: true}});
		if (Modes.animate) Animator.preview();
	}
}
Blockbench.on('update_selection', updateWeightPreview);
