export const ModelScaler = {
	dialog: new Dialog({
		id: 'scale',
		title: 'dialog.scale.title',
		darken: false,
		buttons: ['dialog.scale.confirm', 'dialog.cancel'],
		form: {
			axis: {label: 'dialog.scale.axis', type: 'inline_multi_select', options: {x: 'X', y: 'Y', z: 'Z'}, value: {x: true, y: true, z: true}},
			origin: {label: 'data.origin', type: 'vector', dimensions: 3, value: [0, 0, 0]},
			pivot_options: {label: ' ', type: 'buttons', buttons: ['dialog.scale.element_pivot', 'dialog.scale.selection_center'], click(index) {
				ModelScaler.setPivot(['pivot', 'selection'][index]);
			}},
			scale: {type: 'range', min: 0, max: 4, step: 0.01, value: 1, full_width: true, editable_range_label: true},
			overflow_info: {
				condition: () => ModelScaler.overflow,
				type: 'info',
				text: 'dialog.scale.clipping'
			},
			select_overflow: {
				condition: () => ModelScaler.overflow,
				type: 'buttons',
				buttons: ['dialog.scale.select_overflow'],
				click() {
					ModelScaler.selectOverflow();
				}
			},
			box_uv_warning: {
				condition: (data) => data.scale !== 1 && Project.box_uv && Texture.all.length,
				type: 'info',
				text: 'dialog.scale.box_uv_warning'
			}
		},
		onFormChange() {
			ModelScaler.scaleAll();
		},
		onOpen() {
			Blockbench.once('open_bar_menu', () => {
				if (ModelScaler.dialog != Dialog.open) return;
				ModelScaler.dialog.cancel();
			});
			setTimeout(() => {
				this.object.style.top = Interface.page_wrapper.offsetTop+'px';
			}, 0);
		},
		onConfirm() {
			ModelScaler.scaleAll(true);
		},
		onCancel() {
			ModelScaler.cancel();
		}
	}),
	overflow: null,
	getScaleGroups() {
		if (!Format.bone_rig) return [];
		if (Group.first_selected) {
			return Group.all.filter(g => g.selected);
		} else if (Outliner.selected.length == Outliner.elements.length && Group.all.length) {
			return Group.all;
		}
		return [];
	},
	scaleAll(save, size) {
		let data = ModelScaler.dialog.getFormResult();
		if (size === undefined) size = data.scale;
		let {origin} = data;
		let overflow = [];
		let scale_groups = ModelScaler.getScaleGroups();
		
		Outliner.selected.forEach(function(obj) {
			obj.autouv = 0;
			origin.forEach(function(ogn, i) {
				if (data.axis[getAxisLetter(i)]) {

					if (obj.from) {
						obj.from[i] = (obj.before.from[i] - obj.inflate - ogn) * size;
						obj.from[i] = obj.from[i] + obj.inflate + ogn;
					}

					if (obj.to) {
						obj.to[i] = (obj.before.to[i] + obj.inflate - ogn) * size;
						obj.to[i] = obj.to[i] - obj.inflate + ogn;
						if (Format.integer_size) {
							obj.to[i] = obj.from[i] + Math.round(obj.to[i] - obj.from[i])
						}
					}

					if (obj.origin) {
						obj.origin[i] = (obj.before.origin[i] - ogn) * size;
						obj.origin[i] = obj.origin[i] + ogn;
					}

					if (obj instanceof Mesh) {
						for (let key in obj.vertices) {
							obj.vertices[key][i] = obj.before.vertices[key][i] * size;
						}
					}
				} else {

					if (obj.from) obj.from[i] = obj.before.from[i];
					if (obj.to) obj.to[i] = obj.before.to[i];

					if (obj.origin) obj.origin[i] = obj.before.origin[i];

					if (obj instanceof Mesh) {
						for (let key in obj.vertices) {
							obj.vertices[key][i] = obj.before.vertices[key][i];
						}
					}
				}
			})
			if (obj.getTypeBehavior('cube_size_limit') && Format.cube_size_limiter) {
				if (Format.cube_size_limiter.test(obj)) {
					overflow.push(obj);
				}
				if (!settings.deactivate_size_limit.value) {
					Format.cube_size_limiter.clamp(obj);
				}
			}
			if (save === true) {
				delete obj.before
			}
			if (obj.getTypeBehavior('cube_faces') && obj.box_uv) {
				obj.preview_controller.updateUV(obj);
			}
		})
		scale_groups.forEach((g) => {
			if (axis_enabled[0]) g.origin[0] = ((g.old_origin[0] - origin[0]) * size) + origin[0];
			if (axis_enabled[1]) g.origin[1] = ((g.old_origin[1] - origin[1]) * size) + origin[1];
			if (axis_enabled[2]) g.origin[2] = ((g.old_origin[2] - origin[2]) * size) + origin[2];
			if (save === true) {
				delete g.old_origin
			}
		}, Group)
		if (overflow.length && Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
			ModelScaler.overflow = overflow;
		} else {
			ModelScaler.overflow = null;
		}
		Canvas.updateView({
			elements: Outliner.selected,
			element_aspects: {geometry: true, transform: true},
			groups: scale_groups,
			group_aspects: {transform: true},
			selection: true
		})
		if (save === true) {
			Undo.finishEdit('Scale model')
		}
	},
	cancel() {
		Outliner.selected.forEach(function(obj) {
			if (obj === undefined) return;
			if (obj.from) obj.from.V3_set(obj.before.from);
			if (obj.to) obj.to.V3_set(obj.before.to);
			if (obj.origin) obj.origin.V3_set(obj.before.origin);
			if (obj instanceof Mesh) {
				for (let key in obj.vertices) {
					obj.vertices[key].V3_set(obj.before.vertices[key]);
				}
			}
			delete obj.before
			if (obj instanceof Cube && obj.box_uv) {
				obj.preview_controller.updateUV(obj)
			}
		})
		ModelScaler.getScaleGroups().forEach((g) => {
			g.origin[0] = g.old_origin[0]
			g.origin[1] = g.old_origin[1]
			g.origin[2] = g.old_origin[2]
			delete g.old_origin
		}, Group)
		Canvas.updateView({
			elements: Outliner.selected,
			element_aspects: {geometry: true, transform: true},
			groups: ModelScaler.getScaleGroups(),
			group_aspects: {transform: true},
			selection: true
		})
	},
	setPivot(mode) {
		let center;
		if (mode === 'selection') {
			center = getSelectionCenter()
		} else {
			center = Cube.selected[0]?.origin || Mesh.selected[0]?.origin;
		}
		if (center) {
			ModelScaler.dialog.setFormValues({origin: center});
		}
	},
	selectOverflow() {
		ModelScaler.cancel()
		ModelScaler.dialog.hide();

		Outliner.selected.empty();
		ModelScaler.overflow.forEach(obj => {
			obj.markAsSelected()
		})
		updateSelection();
	},
}

BARS.defineActions(function() {
	new Action('scale', {
		icon: 'settings_overscan',
		category: 'transform',
		condition: () => (Modes.edit && Outliner.elements.length),
		click() {
			if (Outliner.selected.length == 0) {
				Prop.active_panel = 'preview';
				BarItems.select_all.click();
			}

			Undo.initEdit({elements: Outliner.selected, outliner: Format.bone_rig});

			Outliner.selected.forEach((obj) => {
				obj.before = {
					from: obj.from ? obj.from.slice() : undefined,
					to: obj.to ? obj.to.slice() : undefined,
					origin: obj.origin ? obj.origin.slice() : undefined
				}
				if (obj instanceof Mesh) {
					obj.before.vertices = {};
					for (let key in obj.vertices) {
						obj.before.vertices[key] = obj.vertices[key].slice();
					}
				}
			})
			ModelScaler.getScaleGroups().forEach((g) => {
				g.old_origin = g.origin.slice();
			}, Group, true)
			
			ModelScaler.dialog.show();

			ModelScaler.overflow = null;
			let v = Format.centered_grid ? 0 : 8;
			let origin = Group.first_selected ? Group.first_selected.origin : [v, 0, v];
			ModelScaler.dialog.setFormValues({
				origin,
				scale: 1
			});

			ModelScaler.scaleAll(false, 1);
		}
	})
})
