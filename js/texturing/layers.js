class TextureLayer {
	constructor(data, texture = Texture.selected, uuid) {
		this.uuid = (uuid && isUUID(uuid)) ? uuid : guid();
		this.texture = texture;
		this.canvas = document.createElement('canvas');
		this.ctx = this.canvas.getContext('2d');

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
		return this.canvas.width;
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
		BarItems.layer_opacity.update();
	}
	showContextMenu(event) {
		if (!this.selected) this.select();
		this.menu.open(event, this);
	}
	remove(undo) {
		if (undo) {
			Undo.initEdit({textures: [this.texture], bitmap: true});
		}
		this.texture.layers.remove(this);
		if (this.texture.selected_layer == this) this.texture.selected_layer = null;
		if (undo) {
			this.texture.updateLayerChanges(true);
			Undo.finishEdit('Remove layer');
		}
	}
	getUndoCopy(image_data) {
		let copy = {};
		copy.texture = this.texture.uuid;
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
		copy.width = this.width;
		copy.height = this.height;
		copy.data_url = this.canvas.toDataURL();
		return copy;
	}
	setSize(width, height) {
		this.canvas.width = width;
		this.canvas.height = height;
	}
	toggleVisibility() {
		Undo.initEdit({textures: [this.texture]});
		this.visible = !this.visible;
		this.texture.updateLayerChanges(true);
		Undo.finishEdit('Toggle layer visibility');
	}
	propertiesDialog() {
		let dialog = new Dialog({
			id: 'layer_properties',
			title: this.name,
			width: 660,
			form: {
				name: {label: 'generic.name', value: this.name},
				opacity: {label: 'Opacity', type: 'range', value: this.opacity},
			},
			onConfirm: form_data => {
				dialog.hide().delete();
				if (
					form_data.name != this.name
					|| form_data.opacity != this.opacity
				) {
					Undo.initEdit({layers: [this]});
					this.extend(form_data)
					Blockbench.dispatchEvent('edit_layer_properties', {layer: this})
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
new Property(TextureLayer, 'number', 'opacity', {default: 100});
new Property(TextureLayer, 'boolean', 'visible', {default: true});

Object.defineProperty(TextureLayer, 'all', {
	get() {
		Texture.selected?.layers_enabled ? Texture.selected.layers : [];
	}
})
Object.defineProperty(TextureLayer, 'selected', {
	get() {
		Texture.selected?.selected_layer;
	}
})

SharedActions.add('delete', {
	condition: () => Prop.active_panel == 'layers' && Texture.selected?.selected_layer,
	run() {
		if (Texture.selected.layers.length >= 2) {
			Texture.selected?.selected_layer.remove(true);
		}
	}
})
SharedActions.add('duplicate', {
	condition: () => Prop.active_panel == 'layers' && Texture.selected?.selected_layer,
	run() {
		let texture = Texture.selected;
		let original = texture.getActiveLayer();
		let copy = original.getUndoCopy(true);
		copy.name += '-copy';
		Undo.initEdit({textures: [texture]});
		let layer = new TextureLayer(copy, texture);
		texture.layers.push(layer);
		layer.select();
		Undo.finishEdit('Duplicate layer');
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
			texture.layers.push(layer);
			layer.select();
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
			Undo.initEdit({textures: [texture], bitmap: true});
			texture.layers_enabled = true;
			if (!texture.layers.length) {
				let layer = new TextureLayer({
				}, texture);
				let image_data = texture.ctx.getImageData(0, 0, texture.width, texture.height);
				layer.setSize(texture.width, texture.height);
				layer.ctx.putImageData(image_data, 0, 0);
				texture.layers.push(layer);
				layer.select();
			}
			Undo.finishEdit('Enable layers on texture');
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
			Texture.selected.updateLayerChanges(true);
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
			if (loc < 16) return -1;
			return 1;
		}
	}
	new Panel('layers', {
		icon: 'layers',
		growable: true,
		condition: () => Modes.paint && Texture.selected && Texture.selected.layers_enabled,
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

							texture.updateLayerChanges(true);
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
						:class="{ selected: layer.selected }"
						:key="layer.uuid"
						:layer_id="layer.uuid"
						class="texture_layer"
						@click.stop="layer.select()"
						@dblclick.stop="layer.propertiesDialog()"
						@contextmenu.prevent.stop="layer.showContextMenu($event)"
					>
						<texture-layer-icon :layer="layer" />

						<label>
							{{ layer.name }}
						</label>

						<div class="in_list_button" @click.stop="layer.toggleVisibility()">
							<i v-if="layer.visible" class="material-icons">visibility</i>
							<i v-else class="material-icons toggle_disabled">visibility_off</i>
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
