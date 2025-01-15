class TextureLayer {
	constructor(data, texture = Texture.selected, uuid) {
		this.uuid = (uuid && isUUID(uuid)) ? uuid : guid();
		this.texture = texture;
		this.canvas = document.createElement('canvas');
		this.ctx = this.canvas.getContext('2d', {willReadFrequently: true});
		this.in_limbo = false;

		this.img = new Image();
		this.img.onload = () => {
			this.canvas.width = this.img.naturalWidth;
			this.canvas.height = this.img.naturalHeight;
			this.ctx.drawImage(this.img, 0, 0);
		}

		for (var key in TextureLayer.properties) {
			TextureLayer.properties[key].reset(this);
		}

		if (data) this.extend(data);
	}
	get width() {
		return this.canvas.width;
	}
	get height() {
		return this.canvas.height;
	}
	get scaled_width() {
		return this.canvas.width * this.scale[0];
	}
	get scaled_height() {
		return this.canvas.height * this.scale[1];
	}
	get size() {
		return [this.canvas.width, this.canvas.height];
	}
	get selected() {
		return this.texture.selected_layer == this;
	}
	extend(data) {
		for (var key in TextureLayer.properties) {
			TextureLayer.properties[key].merge(this, data)
		}
		if (data.image_data) {
			this.canvas.width = data.width || 16;
			this.canvas.height = data.height || 16;
			this.ctx.putImageData(data.image_data, 0, 0);

		} else if (data.data_url) {
			this.canvas.width = data.width || 16;
			this.canvas.height = data.height || 16;
			this.img.src = data.data_url;
		}
	}
	select() {
		this.texture.selected_layer = this;
		UVEditor.vue.layer = this;
		BarItems.layer_opacity.update();
		BarItems.layer_blend_mode.set(this.blend_mode);
	}
	clickSelect(event) {
		Undo.initSelection();
		this.select(event);
		Undo.finishSelection();
	}
	showContextMenu(event) {
		if (!this.selected) this.clickSelect(event);
		this.menu.open(event, this);
	}
	remove(undo) {
		if (undo) {
			Undo.initEdit({textures: [this.texture], bitmap: true});
		}
		let index = this.texture.layers.indexOf(this);
		this.texture.layers.splice(index, 1);
		if (this.texture.selected_layer == this) {
			let select_next = this.texture.layers[index-1] || this.texture.layers[index];
			if (select_next) select_next.select();
		}
		if (undo) {
			this.texture.updateChangesAfterEdit();
			Undo.finishEdit('Remove layer');
		}
	}
	getUndoCopy(image_data) {
		let copy = {};
		copy.texture = this.texture.uuid;
		copy.uuid = this.uuid;
		for (var key in TextureLayer.properties) {
			TextureLayer.properties[key].copy(this, copy);
		}
		copy.width = this.width;
		copy.height = this.height;
		if (image_data) {
			copy.image_data = this.ctx.getImageData(0, 0, this.width, this.height);
		}
		return copy;
	}
	getSaveCopy() {
		let copy = {};
		for (var key in TextureLayer.properties) {
			TextureLayer.properties[key].copy(this, copy);
		}
		delete copy.in_limbo;
		copy.width = this.width;
		copy.height = this.height;
		copy.data_url = this.canvas.toDataURL('image/png', 1);
		return copy;
	}
	setLimbo() {
		this.texture.layers.forEach(layer => layer.in_limbo = false);
		this.in_limbo = true;
	}
	resolveLimbo(keep_separate) {
		if (keep_separate) {
			if (this.scale[0] != 1 || this.scale[1] != 1) {
				
				let temp_canvas = this.canvas.cloneNode();
				let temp_canvas_ctx = temp_canvas.getContext('2d');
				temp_canvas_ctx.drawImage(this.canvas, 0, 0);
	
				Undo.initEdit({layers: [this], bitmap: true});
	
				this.canvas.width = Math.round(this.canvas.width * this.scale[0]);
				this.canvas.height = Math.round(this.canvas.height * this.scale[1]);
				this.ctx.imageSmoothingEnabled = false;
				this.ctx.drawImage(temp_canvas, 0, 0, this.canvas.width, this.canvas.height);
				this.scale.V2_set(1, 1);
	
				this.texture.updateLayerChanges(true);
				TextureLayer.selected.in_limbo = false;
				Undo.finishEdit('Place selection as layer');

			} else {
				TextureLayer.selected.in_limbo = false;
			}
		} else {
			if (this.texture.flags.has('temporary_layers') && this.texture.layers.length == 2) {
				Undo.initEdit({textures: [this.texture], bitmap: true});
				TextureLayer.selected.mergeDown(false);
				this.texture.layers_enabled = false;
				this.texture.selected_layer = null;
				this.texture.layers.empty();
				Undo.finishEdit('Disable layers on texture');
				UVEditor.vue.layer = null;
				updateInterfacePanels();
				BARS.updateConditions();
			} else {
				TextureLayer.selected.mergeDown(true);
			}
		}
		this.texture.flags.delete('temporary_layers');
		UVEditor.vue.$forceUpdate();
		Texture.selected.selection.clear();
		UVEditor.updateSelectionOutline();
		Interface.removeSuggestedModifierKey('alt', 'modifier_actions.drag_to_duplicate');
	}
	setSize(width, height) {
		this.canvas.width = width;
		this.canvas.height = height;
		return this;
	}
	toggleVisibility() {
		Undo.initEdit({layers: [this]});
		this.visible = !this.visible;
		this.texture.updateChangesAfterEdit();
		Undo.finishEdit('Toggle layer visibility');
		return this;
	}
	scrollTo() {
		let el = document.querySelector(`#layers_list > li[layer_id="${this.uuid}"]`);
		if (el) {
			el.scrollIntoView({behavior: 'smooth', block: 'nearest'});
		}
		return this;
	}
	addForEditing() {
		let i = this.texture.layers.indexOf(this.texture.selected_layer);
		if (i == -1) {
			this.texture.layers.push(this);
		} else {
			this.texture.layers.splice(i+1, 0, this);
		}
		this.select();
		Vue.nextTick(() => {
			this.scrollTo();
		});
		return this;
	}
	mergeDown(undo = true) {
		let down_layer = this.texture.layers[this.texture.layers.indexOf(this) - 1];
		if (!down_layer) {
			this.in_limbo = false;
			return;
		}

		if (undo) {
			Undo.initEdit({textures: [this.texture], bitmap: true});
		}
		down_layer.expandTo(this.offset, this.offset.slice().V2_add(this.width, this.height));
		down_layer.ctx.imageSmoothingEnabled = false;
		down_layer.ctx.filter = `opacity(${this.opacity / 100})`;
		down_layer.ctx.globalCompositeOperation = Painter.getBlendModeCompositeOperation(this.blend_mode);

		down_layer.ctx.drawImage(this.canvas, this.offset[0] - down_layer.offset[0], this.offset[1] - down_layer.offset[1], this.scaled_width, this.scaled_height);

		down_layer.ctx.filter = '';
		down_layer.ctx.globalCompositeOperation = 'source-over';

		let index = this.texture.layers.indexOf(this);
		this.texture.layers.splice(index, 1);
		if (this.texture.selected_layer == this) {
			let select_next = this.texture.layers[index-1] || this.texture.layers[index];
			if (select_next) select_next.select();
		}
		if (undo) {
			this.texture.updateChangesAfterEdit();
			Undo.finishEdit('Merge layers');
		}
	}
	expandTo(...points) {
		let min = this.offset.slice();
		let max = this.offset.slice().V2_add(this.width, this.height);
		points.forEach(point => {
			point = [
				Math.clamp(point[0], 0, this.texture.width),
				Math.clamp(point[1], 0, this.texture.height),
			]
			min[0] = Math.min(min[0], point[0]);
			min[1] = Math.min(min[1], point[1]);
			max[0] = Math.max(max[0], point[0]);
			max[1] = Math.max(max[1], point[1]);
		});
		if (min[0] < this.offset[0] || min[1] < this.offset[1] || max[0] > this.offset[0]+this.width || max[1] > this.offset[1]+this.height) {
			let copy_canvas = Painter.copyCanvas(this.canvas);
			this.canvas.width = max[0] - min[0];
			this.canvas.height = max[1] - min[1];
			this.ctx.drawImage(copy_canvas, this.offset[0] - min[0], this.offset[1] - min[1]);
			this.offset.replace(min);
		}
	}
	flip(axis = 0, undo) {
		let temp_canvas = this.canvas.cloneNode();
		let temp_canvas_ctx = temp_canvas.getContext('2d');
		temp_canvas_ctx.drawImage(this.canvas, 0, 0);

		if (undo) Undo.initEdit({layers: [this], bitmap: true});

		this.ctx.save();
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		if (axis == 0) {
			this.ctx.translate(this.canvas.width, 0);
			this.ctx.scale(-1, 1);
			this.ctx.drawImage(temp_canvas, this.canvas.width, 0, -this.canvas.width, this.canvas.height);
		} else {
			this.ctx.translate(0, this.canvas.height);
			this.ctx.scale(1, -1);
			this.ctx.drawImage(temp_canvas, 0, this.canvas.height, this.canvas.width, -this.canvas.height);
		}
		this.ctx.restore();

		if (undo) {
			Undo.finishEdit('Flip layer');
			this.texture.updateChangesAfterEdit();
		} else {
			this.texture.updateLayerChanges();
			this.texture.saved = false;
		}
	}
	rotate(angle = 90, undo) {
		let temp_canvas = this.canvas.cloneNode();
		let temp_canvas_ctx = temp_canvas.getContext('2d');
		temp_canvas_ctx.drawImage(this.canvas, 0, 0);

		if (undo) Undo.initEdit({layers: [this], bitmap: true});

		[this.canvas.width, this.canvas.height] = [this.canvas.height, this.canvas.width];
		this.ctx.save();
		this.ctx.translate(this.canvas.width/2,this.canvas.height/2);
		this.ctx.rotate(Math.degToRad(angle));
		this.ctx.drawImage(temp_canvas,-temp_canvas.width/2,-temp_canvas.height/2);
		this.ctx.restore();

		if (undo) {
			Undo.finishEdit('Rotate layer');
			this.texture.updateChangesAfterEdit();
		} else {
			this.texture.updateLayerChanges();
			this.texture.saved = false;
		}
		UVEditor.vue.$forceUpdate();
	}
	center() {
		this.offset[0] = Math.round(Math.max(0, this.texture.width  - this.width ) / 2);
		this.offset[1] = Math.round(Math.max(0, this.texture.height - this.height) / 2);
		this.texture.updateLayerChanges();
	}
	propertiesDialog() {
		let blend_mode_options = {};
		TextureLayer.properties.blend_mode.enum_values.forEach(mode => {
			blend_mode_options[mode] = `action.blend_mode.${mode}`
		});
		let dialog = new Dialog({
			id: 'layer_properties',
			title: `${this.name} (${this.width}x${this.height})`,
			form: {
				name: {label: 'generic.name', value: this.name},
				opacity: {label: 'Opacity', type: 'range', value: this.opacity},
				blend_mode: {label: 'action.blend_mode', type: 'select', value: this.blend_mode, options: blend_mode_options},
			},
			onConfirm: form_data => {
				dialog.hide().delete();
				if (
					form_data.name != this.name
					|| form_data.opacity != this.opacity
					|| form_data.blend_mode != this.blend_mode
				) {
					Undo.initEdit({layers: [this]});
					this.extend(form_data);
					this.texture.updateChangesAfterEdit();
					Blockbench.dispatchEvent('edit_layer_properties', {layer: this});
					Undo.finishEdit('Edit layer properties');
				}
			},
			onCancel() {
				dialog.hide().delete();
			}
		})
		dialog.show();
	}
}
TextureLayer.prototype.menu = new Menu([
	new MenuSeparator('settings'),
	'layer_blend_mode',
	new MenuSeparator('edit'),
	{id: 'transform', name: 'menu.transform', icon: 'transform', children: [
		'flip_texture_x',
		'flip_texture_y',
		'rotate_texture_cw',
		'rotate_texture_ccw',
	]},
	'crop_layer_to_selection',
	'layer_to_texture_size',
	'merge_layer_down',
	new MenuSeparator('copypaste'),
	'copy',
	'duplicate',
	'delete',
	new MenuSeparator('properties'),
	{
		icon: 'list',
		name: 'menu.texture.properties',
		click(layer) { layer.propertiesDialog()}
	}
	/**
	 * Merge
	 * Copy
	 * Duplicate
	 * Delete
	 */
])
new Property(TextureLayer, 'string', 'name', {default: 'layer'});
new Property(TextureLayer, 'vector2', 'offset');
new Property(TextureLayer, 'vector2', 'scale', {default: [1, 1]});
new Property(TextureLayer, 'number', 'opacity', {default: 100});
new Property(TextureLayer, 'boolean', 'visible', {default: true});
new Property(TextureLayer, 'enum', 'blend_mode', {default: 'default', values: ['default', 'set_opacity', 'color', 'multiply', 'add', 'screen', 'overlay', 'difference']});
new Property(TextureLayer, 'boolean', 'in_limbo', {default: false});

Object.defineProperty(TextureLayer, 'all', {
	get() {
		return Texture.selected?.layers_enabled ? Texture.selected.layers : [];
	}
})
Object.defineProperty(TextureLayer, 'selected', {
	get() {
		return Texture.selected?.selected_layer;
	}
})

SharedActions.add('delete', {
	subject: 'layer',
	condition: () => Prop.active_panel == 'layers' && Texture.selected?.selected_layer,
	run() {
		if (Texture.selected.layers.length >= 2) {
			Texture.selected?.selected_layer.remove(true);
		}
	}
})
SharedActions.add('delete', {
	subject: 'layer_priority',
	condition: () => Texture.selected?.selected_layer?.in_limbo,
	priority: 2,
	run() {
		if (Texture.selected.layers.length >= 2) {
			Texture.selected?.selected_layer.remove(true);
		}
		Texture.selected.selection.clear()
		UVEditor.updateSelectionOutline()
	}
})
SharedActions.add('duplicate', {
	subject: 'layer',
	condition: () => Prop.active_panel == 'layers' && Texture.selected?.selected_layer,
	run() {
		let texture = Texture.selected;
		let original = texture.getActiveLayer();
		let copy = original.getUndoCopy(true);
		copy.name += '-copy';
		Undo.initEdit({textures: [texture]});
		let layer = new TextureLayer(copy, texture);
		layer.addForEditing();
		Undo.finishEdit('Duplicate layer');
	}
})
SharedActions.add('copy', {
	subject: 'layer',
	condition: () => Prop.active_panel == 'layers' && TextureLayer.selected,
	run() {
		let layer = TextureLayer.selected;
		let copy = layer.getUndoCopy(true);
		Clipbench.layer = copy;
	}
})
SharedActions.add('paste', {
	subject: 'layer',
	condition: () => Prop.active_panel == 'layers' && Texture.selected && Clipbench.layer,
	run() {
		let texture = Texture.selected;
		Undo.initEdit({textures: [texture]});
		let layer = new TextureLayer(Clipbench.layer, texture);
		layer.addForEditing();
		Undo.finishEdit('Paste layer');
	}
})

BARS.defineActions(() => {
	new Action('create_empty_layer', {
		icon: 'new_window',
		category: 'layers',
		condition: () => Modes.paint && Texture.selected && Texture.selected.layers_enabled,
		click() {
			let texture = Texture.selected;
			Undo.initEdit({textures: [texture], bitmap: true});
			let layer = new TextureLayer({
				name: `layer #${texture.layers.length+1}`
			}, texture);
			layer.setSize(texture.width, texture.height);
			layer.addForEditing();
			Undo.finishEdit('Create empty layer');
			BARS.updateConditions();
		}
	})
	new Action('enable_texture_layers', {
		icon: 'library_add_check',
		category: 'layers',
		condition: () => Texture.selected && !Texture.selected.layers_enabled,
		click() {
			if (!Modes.paint) {
				Modes.options.paint.select();
			}
			let texture = Texture.selected;
			texture.activateLayers(true);
		}
	})
	new Action('disable_texture_layers', {
		icon: 'layers_clear',
		category: 'layers',
		condition: () => Texture.selected && Texture.selected.layers_enabled,
		click() {
			let texture = Texture.selected;
			Undo.initEdit({textures: [texture], bitmap: true});
			texture.layers_enabled = false;
			texture.selected_layer = null;
			texture.layers.empty();
			Undo.finishEdit('Disable layers on texture');
			UVEditor.vue.layer = null;
			updateInterfacePanels();
			BARS.updateConditions();
		}
	})
	new NumSlider('layer_opacity', {
		category: 'layers',
		condition: () => Modes.paint && Texture.selected && Texture.selected.layers_enabled && Texture.selected.getActiveLayer(),
		settings: {
			min: 0, max: 100, default: 100,
			show_bar: true
		},
		getInterval(event) {
			return 1;
		},
		get() {
			return Texture.selected.getActiveLayer().opacity;
		},
		change(modify) {
			let layer = Texture.selected.getActiveLayer();
			layer.opacity = Math.clamp(modify(layer.opacity), 0, 100);
			Texture.selected.updateLayerChanges();
		},
		onBefore() {
			Undo.initEdit({layers: [Texture.selected.getActiveLayer()]});
		},
		onAfter() {
			Undo.finishEdit('Change layer opacity');
			Texture.selected.updateChangesAfterEdit();
		}
	})
	let blend_mode_options = {};
	TextureLayer.properties.blend_mode.enum_values.forEach(mode => {
		blend_mode_options[mode] = `action.blend_mode.${mode}`;
	})
	new BarSelect('layer_blend_mode', {
		name: 'action.blend_mode',
		category: 'animation',
		condition: () => Modes.paint && TextureLayer.selected,
		options: blend_mode_options,
		onChange(sel) {
			let mode = sel.value;
			let layer = TextureLayer.selected;
			Undo.initEdit({layers: [layer]});
			layer.blend_mode = mode;
			layer.texture.updateChangesAfterEdit();
			Undo.finishEdit('Change layer blend mode');
		}
	})
	new Action('layer_to_texture_size', {
		icon: 'fit_screen',
		category: 'layers',
		condition: () => TextureLayer.selected,
		click() {
			let layer = TextureLayer.selected;
			Undo.initEdit({layers: [layer], bitmap: true});

			let copy = Painter.copyCanvas(layer.canvas);
			layer.canvas.width = layer.texture.width;
			layer.canvas.height = layer.texture.height;
			layer.ctx.drawImage(copy, layer.offset[0], layer.offset[1]);
			layer.offset.V2_set(0, 0);

			Undo.finishEdit('Expand layer to texture size');
			layer.texture.updateLayerChanges(true);
		}
	})
	new Action('merge_layer_down', {
		icon: 'fa-caret-square-down',
		category: 'layers',
		condition: () => TextureLayer.selected,
		click() {
			TextureLayer.selected.mergeDown(true);
		}
	})
	
	new Action('crop_layer_to_selection', {
		icon: 'crop',
		category: 'layers',
		condition: () => TextureLayer.selected,
		click() {
			let layer = TextureLayer.selected;
			let rect = layer.texture.selection.getBoundingRect();
			if (!rect.width || !rect.height) return;

			Undo.initEdit({layers: [layer], bitmap: true});

			let copy = Painter.copyCanvas(layer.canvas)
			layer.canvas.width = rect.width;
			layer.canvas.height = rect.height;
			layer.ctx.drawImage(copy, layer.offset[0]-rect.start_x, layer.offset[1]-rect.start_y);
			layer.offset.V2_set(rect.start_x, rect.start_y);

			layer.texture.updateChangesAfterEdit();

			Undo.finishEdit('Crop layer to selection');
		}
	})
})

Interface.definePanels(function() {
	Vue.component('texture-layer-icon', {
		props: {
			layer: TextureLayer
		},
		template: '<div class="layer_icon_wrapper"></div>',
		mounted() {
			this.$el.append(this.layer.canvas);
		}
	})
	function eventTargetToLayer(target, texture) {
		let target_node = target;
		let i = 0;
		while (target_node && target_node.classList && !target_node.classList.contains('texture_layer')) {
			if (i < 3 && target_node) {
				target_node = target_node.parentNode;
				i++;
			} else {
				return [];
			}
		}
		return [texture.layers.find(layer => layer.uuid == target_node.attributes.layer_id.value), target_node];
	}
	function getOrder(loc, obj) {
		if (!obj) {
			return;
		} else {
			if (loc <= 20) return -1;
			return 1;
		}
	}
	new Panel('layers', {
		icon: 'layers',
		growable: true,
		resizable: true,
		condition: () => Modes.paint && ((Texture.selected && Texture.selected.layers_enabled) || Format.image_editor),
		default_position: {
			slot: 'left_bar',
			float_position: [0, 0],
			float_size: [300, 300],
			height: 300
		},
		toolbars: [
			new Toolbar('layers', {
				children: [
					'create_empty_layer',
					'enable_texture_layers',
					'layer_opacity',
					'layer_blend_mode'
				]
			})
		],
		component: {
			name: 'panel-layers',
			data() { return {
				layers: [],
			}},
			methods: {
				openMenu(event) {
					Interface.Panels.layers.menu.show(event)
				},
				dragLayer(e1) {
					if (getFocusedTextInput()) return;
					if (e1.button == 1 || e1.button == 2) return;
					convertTouchEvent(e1);

					let texture = Texture.selected;
					if (!texture) return;
					let [layer] = eventTargetToLayer(e1.target, texture);
					if (!layer || layer.locked) return;

					let active = false;
					let helper;
					let timeout;
					let drop_target, drop_target_node, order;
					let last_event = e1;

					function move(e2) {
						convertTouchEvent(e2);
						let offset = [
							e2.clientX - e1.clientX,
							e2.clientY - e1.clientY,
						]
						if (!active) {
							let distance = Math.sqrt(Math.pow(offset[0], 2) + Math.pow(offset[1], 2))
							if (Blockbench.isTouch) {
								if (distance > 20 && timeout) {
									clearTimeout(timeout);
									timeout = null;
								} else {
									document.getElementById('layers_list').scrollTop += last_event.clientY - e2.clientY;
								}
							} else if (distance > 6) {
								active = true;
							}
						} else {
							if (e2) e2.preventDefault();
							
							if (Menu.open) Menu.open.hide();

							if (!helper) {
								helper = document.createElement('div');
								helper.id = 'animation_drag_helper';
								let icon = document.createElement('i');		icon.className = 'material-icons'; icon.innerText = 'image'; helper.append(icon);
								let span = document.createElement('span');	span.innerText = layer.name;	helper.append(span);
								document.body.append(helper);
							}
							helper.style.left = `${e2.clientX}px`;
							helper.style.top = `${e2.clientY}px`;

							// drag
							$('.drag_hover').removeClass('drag_hover');
							$('.texture_layer[order]').attr('order', null);

							let target = document.elementFromPoint(e2.clientX, e2.clientY);
							[drop_target, drop_target_node] = eventTargetToLayer(target, texture);
							if (drop_target) {
								var location = e2.clientY - $(drop_target_node).offset().top;
								order = getOrder(location, drop_target)
								drop_target_node.setAttribute('order', order)
								drop_target_node.classList.add('drag_hover');
							}
						}
						last_event = e2;
					}
					function off(e2) {
						if (helper) helper.remove();
						removeEventListeners(document, 'mousemove touchmove', move);
						removeEventListeners(document, 'mouseup touchend', off);
						$('.drag_hover').removeClass('drag_hover');
						$('.texture_layer[order]').attr('order', null);
						if (Blockbench.isTouch) clearTimeout(timeout);

						if (active && !open_menu) {
							convertTouchEvent(e2);
							let target = document.elementFromPoint(e2.clientX, e2.clientY);
							[target_layer] = eventTargetToLayer(target, texture);
							if (!target_layer || target_layer == layer ) return;

							let index = texture.layers.indexOf(target_layer);

							if (index == -1) return;
							if (texture.layers.indexOf(layer) < index) index--;
							if (order == -1) index++;
							if (texture.layers[index] == layer) return;
							
							Undo.initEdit({textures: [texture]});

							texture.layers.remove(layer);
							texture.layers.splice(index, 0, layer);

							texture.updateChangesAfterEdit();
							Undo.finishEdit('Reorder layers');
						}
					}

					if (Blockbench.isTouch) {
						timeout = setTimeout(() => {
							active = true;
							move(e1);
						}, 320)
					}

					addEventListeners(document, 'mousemove touchmove', move, {passive: false});
					addEventListeners(document, 'mouseup touchend', off, {passive: false});
				}
			},
			template: `
				<ul
					id="layers_list"
					class="list mobile_scrollbar"
					@contextmenu.stop.prevent="openMenu($event)"
					@mousedown="dragLayer($event)"
					@touchstart="dragLayer($event)"
				>
					<li
						v-for="layer in layers"
						:class="{ selected: layer.selected, in_limbo: layer.in_limbo }"
						:key="layer.uuid"
						:layer_id="layer.uuid"
						class="texture_layer"
						@click.stop="layer.clickSelect()"
						@dblclick.stop="layer.propertiesDialog()"
						@contextmenu.prevent.stop="layer.showContextMenu($event)"
					>
						<texture-layer-icon :layer="layer" />

						<label>
							{{ layer.name }}
						</label>

						<div class="in_list_button" @click.stop="layer.toggleVisibility()" @dblclick.stop>
							<i v-if="layer.visible" class="material-icons icon">visibility</i>
							<i v-else class="material-icons icon toggle_disabled">visibility_off</i>
						</div>
					</li>
				</ul>
			`
		},
		menu: new Menu([
			'create_empty_layer',
		])
	})
})
