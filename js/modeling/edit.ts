import { Mode } from '../modes'

BARS.defineActions(function () {
	new Mode('edit', {
		icon: 'deployed_code',
		default_tool: 'move_tool',
		category: 'navigate',
		condition: () => Format && Format.edit_mode,
		onSelect: () => {
			Outliner.elements.forEach(cube => {
				// @ts-ignore
				if (cube.preview_controller.updatePixelGrid)
					cube.preview_controller.updatePixelGrid(cube)
			})
		},
		onUnselect: () => {
			if (Undo) Undo.closeAmendEditMenu()
			Outliner.elements.forEach(cube => {
				// @ts-ignore
				if (cube.preview_controller.updatePixelGrid)
					cube.preview_controller.updatePixelGrid(cube)
			})
		},
	})
})
