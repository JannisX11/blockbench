import { Blockbench } from '../api';
import { THREE } from '../lib/libs';
import { Armature } from '../outliner/armature';
import { ArmatureBone } from '../outliner/armature_bone';
import { Preview } from '../preview/preview';

type CanvasClickData = {event: MouseEvent} | {
	event: MouseEvent
	element: OutlinerElement
	face: string
	intersects: Array<THREE.Intersection<THREE.Mesh>>
}

BARS.defineActions(function defineWeightBrush() {
	let brush_outline: HTMLElement;
	function updateBrushOutline(event: PointerEvent) {
		if (!brush_outline) return;
		let preview = Preview.selected as Preview;
		let preview_offset = $(preview.canvas).offset();
		let click_pos = [
			event.clientX - preview_offset.left,
			event.clientY - preview_offset.top,
		]
		preview.node.append(brush_outline);
		brush_outline.style.left = click_pos[0] + 'px';
		brush_outline.style.top = click_pos[1] + 'px';
	}
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
			if ('element' in data == false) return;
			let preview = Preview.selected as Preview;
			let preview_offset = $(preview.canvas).offset();
			let armature_bone = ArmatureBone.selected[0] as ArmatureBone;
			if (!armature_bone) {
				return Blockbench.showQuickMessage('Select an armature bone first!');
			}
			if (data.element instanceof Mesh == false) {
				return;
			}
			if (!data.element.getArmature()) {
				return Blockbench.showQuickMessage('This mesh is not attached to an armature!');
			}

			// @ts-ignore
			Undo.initEdit({elements: [armature_bone]});

			const raycaster = new THREE.Raycaster();
			const depth_check = true;
			
			let last_click_pos = [0, 0];
			const draw = (event: MouseEvent, data?: CanvasClickData|false) => {
				let radius = (BarItems.slider_weight_brush_size as NumSlider).get();
				let click_pos = [
					event.clientX - preview_offset.left,
					event.clientY - preview_offset.top,
				];
				if (Math.pow(last_click_pos[0]-click_pos[0], 2) + Math.pow(last_click_pos[1]-click_pos[1], 2) < 30) {
					return;
				}
				last_click_pos = click_pos;

				data = data ?? preview.raycast(event);
				if (!data || 'element' in data == false) return;
				let mesh = data.element;
				if (mesh instanceof Mesh == false) return;
				let vec = new THREE.Vector3();
				let vec2 = new THREE.Vector2();
				raycaster.ray.origin.setFromMatrixPosition(preview.camera.matrixWorld);
				let raycasts = 0;
				
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
					let screen_pos = preview.vectorToScreenPosition(pos.clone());
					let distance = vec2.set(screen_pos.x - click_pos[0], screen_pos.y - click_pos[1]).length();
					let influence = Math.hermiteBlend(Math.clamp(1-(distance / radius), 0, 1));
					let value = armature_bone.vertex_weights[vkey] ?? 0;
					
					if (event.shiftKey || Pressing.overrides.shift) {
						influence /= 8;
					}
					if (event.ctrlOrCmd || Pressing.overrides.ctrl) {
						value = value * (1-influence);
					} else {
						value = value + (1-value) * influence;
					}
	
					if (value < 0.04) {
						delete armature_bone.vertex_weights[vkey];
					} else {
						armature_bone.vertex_weights[vkey] = value
					}
				}
				console.log(raycasts)
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
			Canvas.updateView({elements: Mesh.all, element_aspects: {faces: true}});
			(BarItems.slider_weight_brush_size as NumSlider).update();
			Interface.addSuggestedModifierKey('ctrl', 'modifier_actions.subtract');
			Interface.addSuggestedModifierKey('shift', 'modifier_actions.reduced_intensity');
			// @ts-ignore
			ArmatureBone.preview_controller.material.wireframe = ArmatureBone.preview_controller.material_selected.wireframe = true;

			brush_outline = Interface.createElement('div', {id: 'weight_brush_outline'});
			document.addEventListener('pointermove', updateBrushOutline);
		},
		onUnselect() {
			setTimeout(() => {
				Canvas.updateView({elements: Mesh.all, element_aspects: {faces: true}});
			}, 0);
			Interface.removeSuggestedModifierKey('ctrl', 'modifier_actions.subtract');
			Interface.removeSuggestedModifierKey('shift', 'modifier_actions.reduced_intensity');
			// @ts-ignore
			ArmatureBone.preview_controller.material.wireframe = ArmatureBone.preview_controller.material_selected.wireframe = false;

			if (brush_outline) brush_outline.remove()
			document.removeEventListener('pointermove', updateBrushOutline);
		}
	})
	let slider = new NumSlider('slider_weight_brush_size', {
		condition: () => Toolbox?.selected?.id == 'weight_brush',
		tool_setting: 'weight_brush_size',
		category: 'edit',
		settings: {
			min: 1, max: 1024, interval: 1, default: 50,
		}
	})
	slider.on('change', (data: {number: number}) => {
		if (brush_outline) {
			brush_outline.style.setProperty('--radius', data.number.toString());
		}
	})
})

Blockbench.on('update_selection', (data) => {
	if (Toolbox.selected.id == 'weight_brush') {
		Canvas.updateView({elements: Mesh.all.filter(mesh => mesh.getArmature()), element_aspects: {geometry: true}});
	}
})
