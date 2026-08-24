BARS.defineActions(function() {
	let seam_timeout;
	new Tool('seam_tool', {
		icon: 'content_cut',
		transformerMode: 'hidden',
		toolbar: 'seam_tool',
		category: 'tools',
		selectElements: true,
		modes: ['edit'],
		condition: () => Modes.edit && Mesh.hasAny(),
		onCanvasClick(data) {
			if (!seam_timeout) {
				seam_timeout = setTimeout(() => {
					seam_timeout = null;
				}, 200)
			} else {
				clearTimeout(seam_timeout);
				seam_timeout = null;
				(BarItems.select_seam as BarSelect).trigger(data?.event);
			}
		},
		onSelect: function() {
			(BarItems.selection_mode as BarSelect).set('edge');
			(BarItems.view_mode as BarSelect).set('solid');
			(BarItems.view_mode as BarSelect).onChange(BarItems.view_mode as BarSelect);
		},
		onUnselect: function() {
			(BarItems.selection_mode as BarSelect).set('object');
			(BarItems.view_mode as BarSelect).set('textured');
			(BarItems.view_mode as BarSelect).onChange(BarItems.view_mode as BarSelect);
		}
	})
	new BarSelect('select_seam', {
		options: {
			auto: true,
			divide: true,
			join: true,
		},
		condition: () => Modes.edit && Mesh.hasAny(),
		onChange({value}) {
			if (value == 'auto') value = null;
			Undo.initEdit({elements: Mesh.selected});
			Mesh.selected.forEach(mesh => {
				let selected_edges = mesh.getSelectedEdges();
				selected_edges.forEach(edge => {
					mesh.setSeam(edge, value);
				})
				Mesh.preview_controller.updateSelection(mesh);
			})
			Undo.finishEdit('Set mesh seam');
		}
	})
});
