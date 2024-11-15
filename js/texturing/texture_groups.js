
class TextureGroup {
	constructor(data, uuid) {
		this.uuid = uuid ?? guid();
		this.folded = false;
		this.material_config = new TextureGroupMaterialConfig(this);

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
		if (data.material_config) {
			this.material_config.extend(data.material_config);
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
			index: TextureGroup.all.indexOf(this),
			material_config: this.material_config.getUndoCopy()
		};
		for (let key in TextureGroup.properties) {
			TextureGroup.properties[key].copy(this, copy)
		}
		return copy;
	}
	getSaveCopy() {
		let copy = {
			uuid: this.uuid,
			material_config: this.material_config.getSaveCopy()
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
				alphaTest: 0.05,
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
			material.bumpScale = 0.4;
			material.normalMap = null;
			// Bump map scale
			let canvas = document.createElement('canvas');
			let ctx = canvas.getContext('2d');
			canvas.width = height_tex.width * 8;
			canvas.height = height_tex.height * 8;
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(height_tex.canvas, 0, 0, canvas.width, canvas.height);
			material.bumpMap.image = canvas;
			material.bumpMap.magFilter = THREE.LinearFilter;
			material.bumpMap.needsUpdate = true;
		}
		if (mer_tex && mer_tex.img?.naturalWidth) {
			let image_data = mer_tex.canvas.getContext('2d').getImageData(0, 0, mer_tex.width, mer_tex.height);
			let image_data_albedo = color_tex.canvas.getContext('2d').getImageData(0, 0, color_tex.width, color_tex.height);
			function generateMap(source_channel, target_channel, key) {
				let canvas = material[key]?.image ?? document.createElement('canvas');
				let ctx = canvas.getContext('2d');
				canvas.width = mer_tex.width;
				canvas.height = mer_tex.height;
				ctx.fillStyle = 'black';
				ctx.fillRect(0, 0, mer_tex.width, mer_tex.height);
				document.body.append(canvas)

				let image_data_new = ctx.getImageData(0, 0, mer_tex.width, mer_tex.height);
				for (let i = 0; i < image_data.data.length; i += 4) {
					if (target_channel == 0) {
						let value = image_data.data[i + source_channel] / 255;
						image_data_new.data[i + 0] = image_data_albedo.data[i + 0] * value;
						image_data_new.data[i + 1] = image_data_albedo.data[i + 1] * value;
						image_data_new.data[i + 2] = image_data_albedo.data[i + 2] * value;
					} else {
						image_data_new.data[i + target_channel] = image_data.data[i + source_channel];
						if (source_channel == 2 && image_data_new.data[i + target_channel] == 0) {
							//image_data_new.data[i + target_channel] = 255;
						}
					}
				}
				ctx.putImageData(image_data_new, 0, 0);

				if (!material[key] || true) {
					material[key] = new THREE.Texture(canvas, THREE.UVMapping, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.NearestFilter, THREE.NearestFilter);
					material[key].needsUpdate = true;
				}
				//material.map = material[key];
			}
			generateMap(0, 2, 'metalnessMap');
			generateMap(1, 0, 'emissiveMap');
			generateMap(2, 1, 'roughnessMap');
			material.emissive.set(0xffffff);
			material.emissiveIntensity = 30;
			material.metalness = 1;
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

Blockbench.on('edit_texture', ({texture}) => {
	if ((texture.pbr_channel == 'mer' || texture.pbr_channel == 'height') && texture.getGroup()?.is_material && BarItems.view_mode.value == 'material') {
		texture.getGroup().updateMaterial();
	}
})

class TextureGroupMaterialConfig {
	constructor(texture_group, data) {
		this.texture_group = texture_group;
		this.saved = true;
		for (let key in TextureGroupMaterialConfig.properties) {
			TextureGroupMaterialConfig.properties[key].reset(this);
		}

		if (data) this.extend(data);
	}
	extend(data) {
		for (let key in TextureGroupMaterialConfig.properties) {
			TextureGroupMaterialConfig.properties[key].merge(this, data)
		}
		return this;
	}
	getUndoCopy() {
		let copy = {};
		for (let key in TextureGroupMaterialConfig.properties) {
			TextureGroupMaterialConfig.properties[key].copy(this, copy)
		}
		return copy;
	}
	getSaveCopy() {
		let copy = {};
		for (let key in TextureGroupMaterialConfig.properties) {
			TextureGroupMaterialConfig.properties[key].copy(this, copy)
		}
		return copy;
	}
	compileForBedrock() {
		let texture_set = {};
		
		let textures = this.texture_group.getTextures();
		let color_tex = textures.find(t => t.pbr_channel == 'color');
		let normal_tex = textures.find(t => t.pbr_channel == 'normal');
		let height_tex = textures.find(t => t.pbr_channel == 'height');
		let mer_tex = textures.find(t => t.pbr_channel == 'mer');

		let getTextureName = texture => {
			return texture.name.replace(/\.\w{2,4}$/, '');
		}

		if (color_tex) {
			texture_set.color = getTextureName(color_tex);
		} else {
			texture_set.color = this.color_value.slice();
		}
		if (mer_tex) {
			texture_set.metalness_emissive_roughness = getTextureName(mer_tex);
		} else if (!this.mer_value.allEqual(0)) {
			texture_set.metalness_emissive_roughness = this.mer_value.slice();
		}
		if (normal_tex) {
			texture_set.normal = getTextureName(normal_tex);
		} else if (height_tex) {
			texture_set.heightmap = getTextureName(height_tex);
		}

		let file = {
			format_version: "1.16.100",
			"minecraft:texture_set": texture_set
		}
		return file;
	}
	getFilePath() {
		let main_texture = this.texture_group.getTextures().find(t => t.pbr_channel == 'color');
		if (!main_texture) return '';
		let path = main_texture.path.replace(/\.\w{2,4}$/, '') + '.texture_set.json';
		return path;
	}
	getFileName(extension = true) {
		return pathToName(this.getFilePath(), extension);
	}
	save() {
		let file = autoStringify(this.compileForBedrock());
		let path = this.getFilePath();
		if (!path) return;
		if (isApp) {
			fs.writeFileSync(path, file, {encoding: 'utf-8'});
			this.saved = true;
		} else {
			Blockbench.export({
				content: file,
				name: pathToName(path),
				type: 'text'
			})
		}
	}
	showContextMenu(event) {
		Prop.active_panel = 'textures';
		this.menu.open(event, this);
	}
	propertiesDialog() {
		new Dialog('material_config', {
			title: 'dialog.material_config.title',
			form: {
				color_value: {
					label: 'dialog.material_config.color_value',
					type: 'vector', dimensions: 4,
					min: 0, max: 255, step: 1, force_step: true,
					value: this.color_value.map(v => Math.clamp(v, 0, 255)),
				},
				mer_value: {
					label: 'dialog.material_config.mer_value',
					type: 'vector', dimensions: 3,
					min: 0, max: 255, step: 1, force_step: true,
					value: this.mer_value.map(v => Math.clamp(v, 0, 255)),
					//toggle_enabled: true, toggle_default: this.mer_value.allEqual(0),
				}
			},
			onConfirm: (result) => {
				Undo.initEdit({texture_groups: [this.texture_group]});
				this.color_value.replace(result.color_value);
				if (result.mer_value) {
					this.mer_value.replace(result.mer_value);
				} else {
					this.mer_value.V3_set(0, 0, 0);
				}
				this.saved = false;
				Undo.finishEdit('Change material config properties')
				this.texture_group.updateMaterial();
			}
		}).show();
	}
}
new Property(TextureGroupMaterialConfig, 'vector4', 'color_value');
new Property(TextureGroupMaterialConfig, 'vector', 'mer_value');
new Property(TextureGroupMaterialConfig, 'boolean', 'saved', {default: true});
TextureGroupMaterialConfig.prototype.menu = new Menu('texture_group_material_config', [
	new MenuSeparator('file'),
	{
		icon: 'folder',
		name: 'menu.texture.folder',
		condition: isApp,
		click(tgmc) {
			let path = tgmc.getFilePath();
			if (!isApp || !path) return;
			if (!fs.existsSync(path)) {
				Blockbench.showQuickMessage('texture.error.file')
				return;
			}
			showItemInFolder(path);
		}
	},
	{
		icon: 'save',
		name: 'menu.texture.save',
		condition: function(tgmc) {return !tgmc.saved},
		click(tgmc) {
			tgmc.save();
		}
	},
	new MenuSeparator('properties'),
	{
		icon: 'list',
		name: 'menu.texture.properties',
		click(tgmc) {
			tgmc.propertiesDialog();
		}
	},
], {
	onClose() {
		setTimeout(() => {
			TextureGroup.active_menu_group = null;
		}, 10);
	}
})

function importTextureSet(file) {
	let new_textures = [], new_texture_groups = [];
	Undo.initEdit({textures: new_textures, texture_groups: new_texture_groups});
	if (file.name.endsWith('texture_set.json')) {
		let texture_group = new TextureGroup({is_material: true});
		texture_group.name = file.name.replace('.texture_set.json', '');

		let content = fs.readFileSync(file.path, {encoding: 'utf-8'});
		let content_json = autoParseJSON(content);

		if (content_json && content_json['minecraft:texture_set']) {
			let channels = {
				color: 'color',
				normal: 'normal',
				heightmap: 'height',
				metalness_emissive_roughness: 'mer',
			};
			for (let key in channels) {
				let source = content_json['minecraft:texture_set'][key];
				if (typeof source == 'string' && !source.startsWith('#')) {
					let path = PathModule.resolve(file.path, '../' + source + '.png');
					Blockbench.read([path], {
						readtype: 'image',
					}, ([file2]) => {
						let t = new Texture({
							name: file2.name,
							pbr_channel: channels[key]
						}).fromFile(file2).add(false, true).fillParticle();
						new_textures.push(t);
						t.group = texture_group.uuid;
					})
				} else {
					let color_array = source;
					if (typeof source == 'string') {
						let color = tinycolor(source);
						color_array = [color._r, color._g, color._b, color._a * 255];
					}
					if (color_array instanceof Array) {
						if (key == 'color') {
							texture_group.material_config.color_value.replace(color_array);
							while (texture_group.material_config.color_value.length < 4) {
								texture_group.material_config.color_value.push(255);
							}
						} else if (key == 'metalness_emissive_roughness') {
							texture_group.material_config.mer_value.V3_set(color_array);
						}
					}
				}
			}
		}
		if (isApp) texture_group.material_config.saved = true;
		new_texture_groups.push(texture_group);
		texture_group.add(false);
	}
	Undo.finishEdit('Import texture set');
}

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