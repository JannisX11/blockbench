class TextureLayer {
	constructor(data, texture = Texture.selected, uuid) {
		this.uuid = (uuid && isUUID(uuid)) ? uuid : guid();
		this.texture = texture;
		this.selected = false;
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
		this.texture.layers.forEach(layer => layer.selected = false);
		this.texture.selected_layer = this;
		this.selected = true;
	}
	showContextMenu(event) {
		if (!this.selected) this.select();
		this.menu.open(event, this);
	}
	remove() {
		this.texture.layers.remove(this);
		if (this.texture.selected_layer == this) this.texture.selected_layer = null;
	}
	getUndoCopy() {
		let copy = {};
		for (var key in TextureLayer.properties) {
			TextureLayer.properties[key].copy(this, copy);
		}
		copy.width = this.width;
		copy.height = this.height;
		copy.image_data = this.ctx.getImageData(0, 0, this.width, this.height);
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

	}
}
TextureLayer.prototype.menu = new Menu([
	new MenuSeparator('settings'),
	new MenuSeparator('copypaste'),
	'copy',
	'duplicate',
	'delete',
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


/**

TODO
List panel
Contxt menu
Handle creating layers
Undo integration


 */


/**

How do we combine layers

2D editor:
- Display separate canvases
- Refresh main canvas

3D view
- refresh main canvas


Layer flow: (min viable product)
Create template
texture has no layers
Enable texture layers
Select layer to paint on
paint







 */
BARS.defineActions(() => {
	new Action('create_empty_layer', {
		icon: 'add',
		category: 'layers',
		condition: () => Modes.paint && Texture.selected && Texture.selected.layers_enabled,
		click() {
			let texture = Texture.selected;
			let layer = new TextureLayer({
			}, texture);
			layer.setSize(texture.width, texture.height);
			texture.layers.push(layer);
			layer.select();
			BARS.updateConditions();
		}
	})
	new Action('enable_texture_layers', {
		icon: 'library_add_check',
		category: 'layers',
		condition: () => Modes.paint && Texture.selected && !Texture.selected.layers_enabled,
		click() {
			let texture = Texture.selected;
			texture.layers_enabled = true;
			if (!texture.layers.length) {
				let layer = new TextureLayer({
				}, texture);
				let image_data = texture.ctx.getImageData(0, 0, texture.width, texture.height);
				console.log(image_data);
				layer.setSize(texture.width, texture.height);
				layer.ctx.putImageData(image_data, 0, 0);
				texture.layers.push(layer);
				layer.select();
			}
			updateInterfacePanels();
			BARS.updateConditions();
		}
	})
	new NumSlider('layer_opacity', {
		category: 'layers',
		condition: () => Modes.paint && Texture.selected && Texture.selected.layers_enabled && Texture.selected.getDefaultLayer(),
		getInterval(event) {
			return 1;
		},
		get() {
			return Texture.selected.getDefaultLayer().opacity;
		},
		change(modify) {
			let layer = Texture.selected.getDefaultLayer();
			layer.opacity = Math.clamp(modify(layer.opacity), 0, 100);
		},
		onBefore() {
			Undo.initEdit({textures: [Texture.selected]});
		},
		onAfter() {
			Undo.finishEdit('Change layer opacity');
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
				}
			},
			template: `
				<ul
					id="layers_list"
					class="list mobile_scrollbar"
					@contextmenu.stop.prevent="openMenu($event)"
				>
					<li
						v-for="layer in layers"
						:class="{ selected: layer.selected }"
						:key="layer.uuid"
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
