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
    
	new BarSelect('selection_mode', {
		options: {
			object: {name: true, icon: 'far.fa-gem'},
			vertex: {name: true, icon: 'fas.fa-bezier-curve'},
		},
		icon_mode: true,
	})
	
	new Action('apply_spline_rotation', {
		icon: 'published_with_changes',
		category: 'edit',
		condition: {modes: ['edit'], features: ['splines'], method: () => (SplineMesh.selected.length)},
		click() {
			Undo.finishEdit('Apply spline rotation')
			Canvas.updateView({elements: SplineMesh.selected, element_aspects: {geometry: true, transform: true}, selection: true})
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