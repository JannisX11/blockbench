/**
 * Module to scale the selected elements uniformly
 */
export namespace ModelScaler {
	let overflow: (null | OutlinerElement[]) = null;

	export const dialog = new Dialog({
		id: 'scale',
		title: 'dialog.scale.title',
		darken: false,
		buttons: ['dialog.scale.confirm', 'dialog.cancel'],
		form: {
			axis: {label: 'dialog.scale.axis', type: 'inline_multi_select', options: {x: 'X', y: 'Y', z: 'Z'}, value: {x: true, y: true, z: true}},
			origin: {label: 'data.origin', type: 'vector', dimensions: 3, value: [0, 0, 0]},
			pivot_options: {label: ' ', type: 'buttons', buttons: ['dialog.scale.element_pivot', 'dialog.scale.selection_center'], click: (index) => {
				setPivot(index ? 'selection' : 'pivot');
			}},
			scale: {type: 'range', min: 0, max: 4, step: 0.01, value: 1, full_width: true, editable_range_label: true},
			overflow_info: {
				condition: () => !!overflow,
				type: 'info',
				text: 'dialog.scale.clipping'
			},
			select_overflow: {
				condition: () => !!overflow,
				type: 'buttons',
				buttons: ['dialog.scale.select_overflow'],
				click() {
					selectOverflow();
				}
			},
			box_uv_warning: {
				condition: (data) => (data.scale !== 1 && Project.box_uv && Texture.all.length > 0),
				type: 'info',
				text: 'dialog.scale.box_uv_warning'
			}
		},
		onFormChange() {
			updateScale();
		},
		onOpen() {
			overflow = null;
			Blockbench.once('open_bar_menu', () => {
				if (dialog != Dialog.open) return;
				dialog.cancel();
			});
			setTimeout(() => {
				this.object.style.top = Interface.page_wrapper.offsetTop+'px';
			}, 0);
		},
		onConfirm() {
			updateScale(true);
		},
		onCancel() {
			cancel();
		}
	});
	export function openDialog(): void {
		if (Outliner.selected.length == 0) {
			setActivePanel('preview');
			(BarItems.select_all as Action).click();
		}
		let scale_groups: Group[] = getScaleGroups();

		Undo.initEdit({elements: Outliner.selected, outliner: Format.bone_rig, groups: scale_groups});

		Outliner.selected.forEach((obj) => {
			const before = {
				from: ('from' in obj && obj.from instanceof Array) ? obj.from.slice() : undefined,
				to: ('to' in obj && obj.to instanceof Array) ? obj.to.slice() : undefined,
				origin: ('origin' in obj && obj.origin instanceof Array) ? obj.origin.slice() : undefined,
				vertices: undefined as undefined | Record<string, any>
			};
			if (obj instanceof Mesh) {
				before.vertices = {};
				for (let key in obj.vertices) {
					before.vertices[key] = obj.vertices[key].slice();
				}
			}
			obj.temp_data.before = before;
		})
		scale_groups.forEach((g: Group) => {
			g.temp_data.old_origin = g.origin.slice();
		});
		
		dialog.show();

		let v = Format.centered_grid ? 0 : 8;
		let origin = Group.first_selected ? Group.first_selected.origin : [v, 0, v];
		dialog.setFormValues({
			origin,
			scale: 1
		});

		updateScale(false, 1);
	}

	export function getScaleGroups(): Group[] {
		if (!Format.bone_rig) return [];
		if (Group.first_selected) {
			return Group.all.filter(g => g.selected);
		} else if (Outliner.selected.length == Outliner.elements.length && Group.all.length) {
			return Group.all;
		}
		return [];
	}
	export function scaleElements(elements: OutlinerElement[], groups: Group[], size: number, origin: ArrayVector3, axis?: Record<'x'|'y'|'z', boolean>) {
		let overflow = [];
		elements.forEach(function(obj) {
			if (obj instanceof Cube) obj.autouv = 0;

			let inflate = obj instanceof Cube ? obj.inflate : 0;
			let before = obj.temp_data.before as {from: ArrayVector3, to: ArrayVector3, origin: ArrayVector3, vertices: Record<string, ArrayVector3>};
			if (!before) before = obj as any;

			origin.forEach(function(ogn, i) {
				if (!axis || axis[getAxisLetter(i)]) {

					if ('from' in obj) {
						obj.from[i] = (before.from[i] - inflate - ogn) * size;
						obj.from[i] = obj.from[i] + inflate + ogn;
					}

					if ('to' in obj && 'from' in obj) {
						obj.to[i] = (before.to[i] + inflate - ogn) * size;
						obj.to[i] = obj.to[i] - inflate + ogn;
						if (Format.integer_size) {
							obj.to[i] = obj.from[i] + Math.round(obj.to[i] - obj.from[i])
						}
					}

					if ('origin' in obj) {
						obj.origin[i] = (before.origin[i] - ogn) * size;
						obj.origin[i] = obj.origin[i] + ogn;
					}

					if (obj instanceof Mesh) {
						for (let key in obj.vertices) {
							obj.vertices[key][i] = before.vertices[key][i] * size;
						}
					}
				} else {

					if ('from' in obj) obj.from[i] = before.from[i];
					if ('to' in obj) obj.to[i] = before.to[i];

					if ('origin' in obj) obj.origin[i] = before.origin[i];

					if (obj instanceof Mesh) {
						for (let key in obj.vertices) {
							obj.vertices[key][i] = before.vertices[key][i];
						}
					}
				}
			})
			if (obj.getTypeBehavior('cube_size_limit') && Format.cube_size_limiter) {
				if (Format.cube_size_limiter.test(obj as Cube)) {
					overflow.push(obj);
				}
				if (!settings.deactivate_size_limit.value) {
					Format.cube_size_limiter.clamp(obj as Cube);
				}
			}
			if (false) {
				delete obj.temp_data.before;
			}
			if (obj.getTypeBehavior('cube_faces') && 'box_uv' in obj && obj.box_uv) {
				obj.preview_controller.updateUV(obj);
			}
		})
		groups.forEach((g) => {
			let old_origin = g.temp_data.old_origin ?? g.origin.slice();
			if (!axis || axis.x) g.origin[0] = ((old_origin[0] - origin[0]) * size) + origin[0];
			if (!axis || axis.y) g.origin[1] = ((old_origin[1] - origin[1]) * size) + origin[1];
			if (!axis || axis.z) g.origin[2] = ((old_origin[2] - origin[2]) * size) + origin[2];
			if (false) {
				delete g.temp_data.old_origin
			}
		}, Group)
		if (overflow.length && Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
			overflow = overflow;
		} else {
			overflow = null;
		}
		Canvas.updateView({
			elements,
			groups,
			element_aspects: {geometry: true, transform: true},
			group_aspects: {transform: true},
			selection: true
		})
	}
	function updateScale(save?: boolean, size?: number) {
		let data = dialog.getFormResult();
		if (size === undefined) size = data.scale as number;
		let {origin} = data;
		let scale_groups = getScaleGroups();
		
		scaleElements(Outliner.selected, scale_groups, size, origin as ArrayVector3);
		
		if (save === true) {
			Undo.finishEdit('Scale model')
		}
	}
	function cancel() {
		Outliner.selected.forEach(function(obj) {
			if (obj === undefined) return;
			let before = obj.temp_data.before;
			if ('from' in obj && obj.from instanceof Array) obj.from.V3_set(before.from);
			if ('to' in obj && obj.to instanceof Array) obj.to.V3_set(before.to);
			if ('origin' in obj && obj.origin instanceof Array) obj.origin.V3_set(before.origin);
			if (obj instanceof Mesh) {
				for (let key in obj.vertices) {
					obj.vertices[key].V3_set(before.vertices[key]);
				}
			}
			// @ts-ignore
			delete obj.temp_data.before;
			if (obj instanceof Cube && obj.box_uv) {
				obj.preview_controller.updateUV(obj)
			}
		})
		ModelScaler.getScaleGroups().forEach((g) => {
			g.origin[0] = g.temp_data.old_origin[0]
			g.origin[1] = g.temp_data.old_origin[1]
			g.origin[2] = g.temp_data.old_origin[2]
			delete g.temp_data.old_origin
		}, Group)
		Canvas.updateView({
			elements: Outliner.selected,
			element_aspects: {geometry: true, transform: true},
			groups: ModelScaler.getScaleGroups(),
			group_aspects: {transform: true},
			selection: true
		})
	}
	function setPivot(mode: 'pivot' | 'selection') {
		let center: ArrayVector3;
		if (mode === 'selection') {
			center = getSelectionCenter()
		} else {
			center = Cube.selected[0]?.origin || Mesh.selected[0]?.origin;
		}
		if (center) {
			ModelScaler.dialog.setFormValues({origin: center});
		}
	}
	function selectOverflow() {
		cancel()
		dialog.hide();

		Outliner.selected.empty();
		overflow.forEach(obj => {
			obj.markAsSelected()
		})
		updateSelection();
	}
}

BARS.defineActions(function() {
	new Action('scale', {
		icon: 'settings_overscan',
		category: 'transform',
		condition: () => (Modes.edit && Outliner.elements.length > 0),
		click() {
			ModelScaler.openDialog();
		}
	})
});

const global = {
	ModelScaler
}
declare global {
	const ModelScaler: typeof global.ModelScaler
}
Object.assign(window, global);
