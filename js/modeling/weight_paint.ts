import { THREE } from '../../lib/libs';
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
	new Tool('weight_brush', {
		icon: 'stylus_highlighter',
		category: 'tools',
		cursor: 'crosshair',
		// @ts-ignore
		transformerMode: 'hidden',
		selectElements: false,
		modes: ['edit'],
		condition: {modes: ['edit'], method: () => Armature.all.length},
		
		onCanvasClick(data: CanvasClickData) {
			if ('element' in data == false) return;
			let preview = Preview.selected as Preview;
			let preview_offset = $(preview.canvas).offset();
			let armature_bone: ArmatureBone = ArmatureBone.selected[0];
			if (!armature_bone) {
				return Blockbench.showQuickMessage('Select an armature bone first!');
			}
			if (data.element instanceof Mesh == false) {
				return Blockbench.showQuickMessage('Select an armature bone first!');
			}
			if (!data.element.getArmature()) {
				return Blockbench.showQuickMessage('This mesh is not attached to an armature!');
			}

			Undo.initEdit({elements: [armature_bone]});
			
			const draw = (event: MouseEvent, data?: CanvasClickData|false) => {
				data = data ?? preview.raycast(event);
				if (!data || 'element' in data == false) return;
				let click_pos = [
					event.clientX - preview_offset.left,
					event.clientY - preview_offset.top,
				]
				let mesh = data.element as Mesh;
				let vec = new THREE.Vector3();
				let vec2 = new THREE.Vector2();
				for (let vkey in mesh.vertices) {
					let pos = mesh.mesh.localToWorld(vec.fromArray(mesh.vertices[vkey]));
					let screen_pos = preview.vectorToScreenPosition(pos.clone());
					let distance = vec2.set(screen_pos.x - click_pos[0], screen_pos.y - click_pos[1]).length();
					let influence = Math.hermiteBlend(Math.clamp(1-(distance / 50), 0, 1));
					let value = armature_bone.vertex_weights[vkey] ?? 0;
	
					if (event.ctrlOrCmd) {
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
			Interface.addSuggestedModifierKey('ctrl', 'modifier_actions.subtract');
		},
		onUnselect() {
			Canvas.updateView({elements: Mesh.all, element_aspects: {faces: true}});
			Interface.removeSuggestedModifierKey('ctrl', 'modifier_actions.subtract');
		}
	})
})

Blockbench.on('update_selection', (data) => {
	if (Toolbox.selected.id == 'weight_brush') {
		Canvas.updateView({elements: Mesh.all.filter(mesh => mesh.getArmature()), element_aspects: {geometry: true}});
	}
})
