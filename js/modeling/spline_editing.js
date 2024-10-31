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
    
	let previous_selection_mode = 'object';
	new BarSelect('spline_selection_mode', {
		options: {
			object: {name: true, icon: 'fas.fa-circle-nodes'},
			handles: {name: true, icon: 'fas.fa-bezier-curve'},
			tilt: {name: true, icon: 'fas.fa-compass-drafting'},
		},
		icon_mode: true,
		condition: () => Modes.edit && SplineMesh.hasAny(),
        onChange({value}) {
			if (value === previous_selection_mode) return;
			if (value === 'object') {
				SplineMesh.selected.forEach(spline => {
					delete Project.spline_selection[spline.uuid];
				})
			}

            // Hide/Show handle lines, didn't find a better way to do this
            // updateSelection() felt like a harder place to control this.
			SplineMesh.selected.forEach(spline => {
                spline.preview_controller.updateGeometry(spline);
			})
			updateSelection();
			previous_selection_mode = value;
        }
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
	}),
    new BarSelect('spline_handle_mode', {
		condition: () => Modes.edit && SplineMesh.hasAny() && BarItems.spline_selection_mode.value === "handles",
		category: 'transform',
		value: 'aligned',
		options: {
			aligned: true,
			mirrored: true,
			free: true,
		},
		onChange() {
            // Update handle line color, didn't find a simpler way to do this.
			SplineMesh.selected.forEach(spline => {
                spline.preview_controller.updateGeometry(spline);
			})
			updateSelection();
		}
	})
})