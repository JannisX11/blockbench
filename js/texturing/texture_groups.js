
class TextureGroup {
	constructor(data, uuid) {
		this.uuid = uuid ?? guid();
		this.folded = false;
		for (let key in TextureGroup.properties) {
			TextureGroup.properties[key].reset(this);
		}
		if (data) this.extend(data);

		this._static = Object.freeze({
			properties: {
				material: null
			}
		})
	}
	extend(data) {
		for (let key in TextureGroup.properties) {
			TextureGroup.properties[key].merge(this, data)
		}
		return this;
	}
	add() {
		TextureGroup.all.push(this);
		if (this.is_material) {
			this.updateMaterial();
		}
		return this;
	}
	select() {
		let textures = this.getTextures();
		if (textures[0]) textures[0].select();
		for (let texture of textures) {
			if (!texture.selected) texture.multi_selected = true;
		}
		return this;
	}
	remove() {
		TextureGroup.all.remove(this);
	}
	showContextMenu(event) {
		Prop.active_panel = 'textures';
		TextureGroup.active_menu_group = this;
		this.menu.open(event, this);
	}
	rename() {
		Blockbench.textPrompt('generic.rename', this.name, (name) => {
			if (name && name !== this.name) {
				Undo.initEdit({texture_groups: [this]});
				this.name = name;
				Undo.finishEdit('Rename texture group');
			}
		})
		return this;
	}
	getTextures() {
		return Texture.all.filter(texture => texture.group == this.uuid);
	}
	getUndoCopy() {
		let copy = {
			uuid: this.uuid,
			index: TextureGroup.all.indexOf(this)
		};
		for (let key in TextureGroup.properties) {
			TextureGroup.properties[key].copy(this, copy)
		}
		return copy;
	}
	getSaveCopy() {
		let copy = {
			uuid: this.uuid
		};
		for (let key in TextureGroup.properties) {
			TextureGroup.properties[key].copy(this, copy)
		}
		return copy;
	}

	updateMaterial() {
		let material = this._static.properties.material;
		if (!material) {
			//let g = new THREE.PMREMGenerator(Preview.selected.renderer);
			//let pmrem_render_target = g.fromScene(Canvas.scene);
			// https://threejs.org/docs/index.html#api/en/materials/MeshStandardMaterial
			material = this._static.properties.material = new THREE.MeshStandardMaterial({
				//envMap: pmrem_render_target
			});
		}
		let textures = this.getTextures();
		let color_tex = textures.find(t => t.pbr_channel == 'color');
		let normal_tex = textures.find(t => t.pbr_channel == 'normal');
		let height_tex = textures.find(t => t.pbr_channel == 'height');
		let mer_tex = textures.find(t => t.pbr_channel == 'mer');
		if (color_tex) {
			material.map = color_tex.getOwnMaterial().map;
		}
		if (normal_tex) {
			material.normalMap = normal_tex.getOwnMaterial().map;
			material.bumpMap = null;

		} else if (height_tex) {
			material.bumpMap = height_tex.getOwnMaterial().map;
			material.normalMap = null;
		}
		if (mer_tex && mer_tex.img?.naturalWidth) {
			let image_data = mer_tex.canvas.getContext('2d').getImageData(0, 0, mer_tex.width, mer_tex.height);
			function generateMap(source_channel, target_channel, key) {
				let canvas = material[key]?.image ?? document.createElement('canvas');
				let ctx = canvas.getContext('2d');
				canvas.width = mer_tex.width;
				canvas.height = mer_tex.height;
				ctx.fillStyle = 'red';
				ctx.fillRect(0, 0, mer_tex.width, mer_tex.height);
				document.body.append(canvas)

				let image_data_new = ctx.getImageData(0, 0, mer_tex.width, mer_tex.height);
				for (let i = 0; i < image_data.data.length; i += 4) {
					image_data_new.data[i + target_channel] = image_data.data[i + source_channel];
				}
				ctx.putImageData(image_data_new, 0, 0);

				if (!material[key] || true) {
					material[key] = new THREE.Texture(canvas, THREE.UVMapping, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.NearestFilter, THREE.NearestFilter);
					material[key].needsUpdate = true;
				}
			}
			generateMap(0, 2, 'metalnessMap');
			generateMap(1, 0, 'emissiveMap');
			generateMap(2, 1, 'roughnessMap');
		}
		material.needsUpdate = true;
	}
	getMaterial() {
		if (!this._static.properties.material) {
			this.updateMaterial();
		}
		return this._static.properties.material;
	}
}
Object.defineProperty(TextureGroup, 'all', {
	get() {
		return Project.texture_groups || [];
	},
	set(arr) {
		Project.texture_groups.replace(arr);
	}
})
new Property(TextureGroup, 'string', 'name', {default: tl('data.texture_group')});
new Property(TextureGroup, 'boolean', 'is_material', {default: false});

TextureGroup.prototype.menu = new Menu('texture_group', [
	new MenuSeparator('manage'),
	'rename',
	{
		icon: 'fa-leaf',
		name: 'menu.texture_group.resolve',
		click(texture_group) {
			let textures = texture_group.getTextures();
			Undo.initEdit({textures, texture_groups: [texture_group]});
			texture_group.remove();
			textures.forEach(texture => {
				texture.group = '';
			})
			Undo.finishEdit('Resolve texture group', {textures, texture_groups: []});
		}
	},
], {
	onClose() {
		setTimeout(() => {
			TextureGroup.active_menu_group = null;
		}, 10);
	}
})
/**
ToDo:
- Auto-generate groups
- Grid view?
- Search
 */

SharedActions.add('rename', {
	condition: () => Prop.active_panel == 'textures' && TextureGroup.active_menu_group,
	run() {
		TextureGroup.active_menu_group.rename();
	}
})


BARS.defineActions(function() {
	new Action('create_texture_group', {
		icon: 'perm_media',
		category: 'textures',
		click() {
			let texture_group = new TextureGroup();
			texture_group.name = 'Texture Group ' + (TextureGroup.all.length+1);
			let textures_to_add = Texture.all.filter(tex => tex.selected || tex.multi_selected);
			Undo.initEdit({texture_groups: [], textures: textures_to_add});
			if (textures_to_add.length) {
				for (let texture of textures_to_add) {
					texture.group = texture_group.uuid;
				}
				let first = Texture.selected || textures_to_add[0];
				texture_group.name = first.name.replace(/\.\w+$/, '') + ' Group';
			}
			texture_group.add(false);
			Undo.finishEdit('Add texture group', {texture_groups: [texture_group], textures: textures_to_add});
		}
	})
});