
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
	get material() {
		return this._static.properties.material
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
		/**
		 * @link https://threejs.org/docs/index.html#api/en/materials/MeshStandardMaterial
		 * @type {THREE.MeshStandardMaterial}
		 */
		let material = this._static.properties.material;
		
		if (!material) {
			material = this._static.properties.material = new THREE.MeshStandardMaterial({
				envMapIntensity: 0.8,
				alphaTest: 0.05,
			});
		}

		if (PreviewScene.active) {
			const g = new THREE.PMREMGenerator(Preview.selected.renderer);
			material.envMap = g.fromScene(Canvas.scene, 0.0, 100, 1024).texture;
		}

		let textures = this.getTextures();
		let color_tex = textures.find(t => t.pbr_channel == 'color');
		let normal_tex = textures.find(t => t.pbr_channel == 'normal');
		let height_tex = textures.find(t => t.pbr_channel == 'height');
		let mer_tex = textures.find(t => t.pbr_channel == 'mer');

		// Albedo
		if (color_tex) {
			material.map = color_tex.getOwnMaterial().map;
			material.color.set('#ffffff');
			material.opacity = 1;
		} else {
			material.map = null;
			let c = this.material_config.color_value;
			material.color.set({r: c[0] / 255, g: c[1] / 255, b: c[2] / 255});
			material.opacity = c[4] / 255;
		}

		// Height
		if (normal_tex) {
			material.normalMap = normal_tex.getOwnMaterial().map;
			material.bumpMap = null;
			// Use DirectX normal maps for RenderDragon. Flips the "handedness" of the normal map.
			material.normalScale = Project.format.id.includes('bedrock') ? new THREE.Vector2(1, -1) : new THREE.Vector2(1, 1);
		} else if (height_tex) {
			material.bumpMap = height_tex.getOwnMaterial().map.clone();
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
		} else {
			material.normalMap = null;
			material.bumpMap = null;
		}

		// MER
		if (mer_tex && mer_tex.img?.naturalWidth && mer_tex.width) {
			let image_data = mer_tex.canvas.getContext('2d').getImageData(0, 0, mer_tex.width, mer_tex.height);

			const extractEmissiveChannel = () => {
				// The green channel is the emissive level.
				// Use it as an mask on the color texture to create the emissive map.
				const color_data = color_tex.canvas.getContext('2d').getImageData(0, 0, color_tex.width, color_tex.height);
				let emissive_data = new Uint8ClampedArray(color_data.data.length);
				for (let i = 0; i < image_data.data.length; i += 4) {
					if (image_data.data[i + 1] > 0) {
						emissive_data[i] = color_data.data[i];
						emissive_data[i + 1] = color_data.data[i + 1];
						emissive_data[i + 2] = color_data.data[i + 2];
						emissive_data[i + 3] = 255;
						continue;
					}

					emissive_data[i] = 0;
					emissive_data[i + 1] = 0;
					emissive_data[i + 2] = 0;
					emissive_data[i + 3] = 255;
				}

				return new ImageData(emissive_data, mer_tex.width, mer_tex.height);
			}

			const extractGrayscaleValue = (channel) => {
				let grayscale_data = new Uint8ClampedArray(image_data.data.length);
				for (let i = 0; i < image_data.data.length; i += 4) {
					grayscale_data[i + 0] = image_data.data[i + channel];
					grayscale_data[i + 1] = image_data.data[i + channel];
					grayscale_data[i + 2] = image_data.data[i + channel];
					grayscale_data[i + 3] = 255;
				}

				return new ImageData(grayscale_data, mer_tex.width, mer_tex.height);
			}

			function generateMap(source_channel, key) {
				let canvas = material[key]?.image;
				if (!canvas || key == 'emissiveMap') {
					canvas = document.createElement('canvas');
				}
				let ctx = canvas.getContext('2d');
				canvas.width = mer_tex.width;
				canvas.height = mer_tex.height;
				ctx.fillStyle = 'black';
				ctx.fillRect(0, 0, mer_tex.width, mer_tex.height);
				// document.body.append(canvas);

				ctx.putImageData(source_channel === 1 ? extractEmissiveChannel() : extractGrayscaleValue(source_channel), 0, 0);

				material[key] = new THREE.Texture(canvas, THREE.UVMapping, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.NearestFilter, THREE.NearestFilter);
				material[key].needsUpdate = true;
			}
			generateMap(0, 'metalnessMap');
			generateMap(1, 'emissiveMap');
			generateMap(2, 'roughnessMap');
			material.emissive.set(0xffffff);
			material.emissiveIntensity = 1;
			material.metalness = 1;
			material.roughness = 1;
		} else {
			material.metalnessMap = null;
			material.emissiveMap = material.map;
			material.roughnessMap = null;
			material.emissive.set(0xffffff);
			material.metalness = this.material_config.mer_value[0] / 255;
			material.emissiveIntensity = this.material_config.mer_value[1] / 255;
			material.roughness = this.material_config.mer_value[2] / 255;
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
	new MenuSeparator('create'),
	'generate_pbr_map',
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
			let texture_name = getTextureName(mer_tex);
			if (this.subsurface_value) {
				texture_set.metalness_emissive_roughness_subsurface = texture_name;
			} else {
				texture_set.metalness_emissive_roughness = texture_name;
			}
		} else if (this.subsurface_value) {
			texture_set.metalness_emissive_roughness_subsurface = [...this.mer_value, this.subsurface_value];
		} else if (!this.mer_value.allEqual(0)) {
			texture_set.metalness_emissive_roughness = this.mer_value.slice();
		}
		if (normal_tex) {
			texture_set.normal = getTextureName(normal_tex);
		} else if (height_tex) {
			texture_set.heightmap = getTextureName(height_tex);
		}

		let format_version = "1.16.100";
		if (texture_set.metalness_emissive_roughness_subsurface) {
			format_version = "1.21.30";
		}
		let file = {
			format_version,
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
		let texture_options = {};
		let texture_options_optional = {
			none: 'None',
		};
		let texture_options_custom = {
			uniform: 'Uniform...',
		};
		let textures = this.texture_group.getTextures();
		for (let texture of textures) {
			let opt = {
				name: texture.name,
				icon: texture.img,
			}
			texture_options_optional[texture.uuid] = texture_options[texture.uuid] = texture_options_custom[texture.uuid] = opt;
		}
		new Dialog('material_config', {
			title: 'dialog.material_config.title',
			form: {
				color: {
					type: 'select',
					label: 'menu.texture.pbr_channel.color',
					options: texture_options_custom,
					value: textures.find(tex => tex.pbr_channel == 'color')?.uuid ?? 'uniform',
				},
				color_value: {
					label: 'dialog.material_config.color_value',
					condition: form => form.color == 'uniform',
					type: 'color',
					value: {
						r: this.color_value[0],
						g: this.color_value[1],
						b: this.color_value[2],
						a: this.color_value[3] / 255
					}
				},
				'_mers': '_',
				mer: {
					type: 'select',
					label: 'dialog.material_config.mer',
					options: texture_options_custom,
					value: textures.find(tex => tex.pbr_channel == 'mer')?.uuid ?? 'uniform',
				},
				mer_value: {
					label: 'dialog.material_config.mer_value',
					condition: form => form.mer == 'uniform',
					type: 'vector', dimensions: 3,
					min: 0, max: 255, step: 1, force_step: true,
					value: this.mer_value.map(v => Math.clamp(v, 0, 255)),
				},
				subsurface: {
					type: 'checkbox',
					label: 'dialog.material_config.subsurface',
					description: 'dialog.material_config.subsurface_enabled.desc',
					condition: form => isUUID(form.mer),
					value: this.subsurface_value > 0,
				},
				subsurface_value: {
					label: 'dialog.material_config.subsurface',
					condition: form => form.mer == 'uniform',
					type: 'number',
					min: 0, max: 255, step: 1, force_step: true,
					value: Math.clamp(this.subsurface_value, 0, 255),
				},
				'_depth': '_',
				depth_type: {
					type: 'inline_select',
					label: 'dialog.material_config.depth_type',
					options: {
						height: 'menu.texture.pbr_channel.height',
						normal: 'menu.texture.pbr_channel.normal'
					},
					value: textures.find(tex => tex.pbr_channel == 'normal') ? 'normal' : 'height'
				},
				height: {
					type: 'select',
					label: 'menu.texture.pbr_channel.height',
					condition: form => form.depth_type == 'height',
					options: texture_options_optional,
					value: textures.find(tex => tex.pbr_channel == 'height')?.uuid ?? 'none',
				},
				normal: {
					type: 'select',
					label: 'menu.texture.pbr_channel.normal',
					condition: form => form.depth_type == 'normal',
					options: texture_options_optional,
					value: textures.find(tex => tex.pbr_channel == 'normal')?.uuid ?? 'none',
				},
			},
			onConfirm: (result) => {
				Undo.initEdit({texture_groups: [this.texture_group], textures});

				if (result.color == 'uniform') {
					let color = result.color_value.toRgb();
					let color_array = [color.r, color.g, color.b, Math.round(color.a * 255)];
					this.color_value.replace(color_array);
					for (let texture of textures) {
						if (texture.pbr_channel == 'color') texture.group = '';
					}
				} else {
					let target = textures.find(t => t.uuid == result.color);
					if (target) target.pbr_channel = 'color';
				}

				if (result.mer == 'uniform') {
					this.mer_value.replace(result.mer_value);
					for (let texture of textures) {
						if (texture.pbr_channel == 'mer') texture.group = '';
					}
					this.subsurface_value = result.subsurface_value;
				} else {
					this.mer_value.replace([0, 0, 0]);
					let target = textures.find(t => t.uuid == result.mer);
					if (target) target.pbr_channel = 'mer';
					this.subsurface_value = result.subsurface ? 1 : 0;
				}
				
				if (result.depth_type == 'normal') {
					textures.forEach(t => {
						if (t.pbr_channel == 'normal') t.pbr_channel = 'color';
					})
					let target = textures.find(t => t.uuid == result.normal);
					if (target) target.pbr_channel = 'normal';
				} else {
					textures.forEach(t => {
						if (t.pbr_channel == 'height') t.pbr_channel = 'color';
					})
					let target = textures.find(t => t.uuid == result.height);
					if (target) target.pbr_channel = 'height';
				}
				this.saved = false;
				Undo.finishEdit('Change material config properties')
				this.texture_group.updateMaterial();
			}
		}).show();
	}
}
new Property(TextureGroupMaterialConfig, 'vector4', 'color_value', {default: [255, 255, 255, 255]});
new Property(TextureGroupMaterialConfig, 'vector', 'mer_value');
new Property(TextureGroupMaterialConfig, 'number', 'subsurface_value');
new Property(TextureGroupMaterialConfig, 'boolean', 'saved', {default: true});
TextureGroupMaterialConfig.prototype.menu = new Menu('texture_group_material_config', [
	'generate_pbr_map',
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
		texture_group.name = file.name.replace('.texture_set.json', '.png material');

		let content = fs.readFileSync(file.path, {encoding: 'utf-8'});
		let content_json = autoParseJSON(content);

		if (content_json && content_json['minecraft:texture_set']) {
			let channels = {
				color: 'color',
				normal: 'normal',
				heightmap: 'height',
				metalness_emissive_roughness: 'mer',
				metalness_emissive_roughness_subsurface: 'mer',
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
					if (key == 'metalness_emissive_roughness_subsurface') {
						texture_group.material_config.subsurface_value = 1;
					}
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
						} else if (key == 'metalness_emissive_roughness_subsurface') {
							texture_group.material_config.mer_value.V3_set(color_array);
							texture_group.material_config.subsurface_value = Math.clamp(color_array[3] ?? 0, 0, 255);
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
function loadAdjacentTextureSet(texture) {
	let path = texture.path.replace(/\.png$/i, '.texture_set.json');
	if (fs.existsSync(path)) {
		Blockbench.read([path], {}, (files) => {
			importTextureSet(files[0])
		})
	}
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
	new Action('create_material', {
		icon: 'lightbulb_circle',
		category: 'textures',
		condition: () => (!Texture.selected || !Texture.selected.getGroup()?.is_material) && Format.pbr,
		click() {
			let texture = Texture.selected;
			let texture_group = new TextureGroup({is_material: true});
			texture_group.name = (texture?.name || 'New') + ' material';
			let textures_to_add = Texture.all.filter(tex => tex.selected || tex.multi_selected);
			Undo.initEdit({texture_groups: [], textures: textures_to_add});
			for (let texture of textures_to_add) {
				texture.group = texture_group.uuid;
				if (texture != Texture.selected) {
					if (texture.name.match(/height/i)) {
						texture.pbr_channel = 'height';
					} else if (texture.name.match(/[._-]normal/i)) {
						texture.pbr_channel = 'normal';
					} else if (texture.name.match(/[._-]mer[._-]/i)) {
						texture.pbr_channel = 'mer';
					}
				}
			}
			texture_group.add(false);
			Undo.finishEdit('Add material', {texture_groups: [texture_group], textures: textures_to_add});
		}
	})
	new Action('generate_pbr_map', {
		icon: 'texture_add',
		category: 'textures',
		condition: () => Texture.all[0] && Format.pbr,
		click() {
			let texture = Texture.selected ?? Texture.all[0];
			let texture_group = texture.getGroup();

			let canvas = document.createElement('canvas');
			let ctx = canvas.getContext('2d');
			canvas.width = texture.width;
			canvas.height = texture.height;
			let original_data = texture.canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
			let new_data = ctx.getImageData(0, 0, canvas.width, canvas.height);
			canvas.style.width = 256 + 'px';
			canvas.style.height = 256 + 'px';
			let original_image = new CanvasFrame(texture.canvas, true);
			original_image.canvas.style.width = 256 + 'px';
			original_image.canvas.style.height = 256 + 'px';

			function getPixelInput(result, r, g, b, a) {
				switch (result.method) {
					case 'value': {
						return ((r + g + b) / 3) * (a/255);
					}
					case 'brightness': {
						//http://www.w3.org/TR/AERT#color-contrast
						return (r * 299 + g * 587 + b * 114) / 1000;
					}
					case 'saturation':
					case 'hue': {
						r /= 255;
						g /= 255;
						b /= 255;
						let max = Math.max(r, g, b);
						let min = Math.min(r, g, b);
						if (max == min) {
							return 0;
						} else {
							let d = max - min;
							if (result.method == 'saturation') {
								let avg = (max + min) / 2;
								let s = avg > 0.5 ? d / (2 - max - min) : d / (max + min);
								return s * a;
							} else {
								switch (max) {
									case r:
									h = (g - b) / d + (g < b ? 6 : 0);
									break;
									case g:
									h = (b - r) / d + 2;
									break;
									case b:
									h = (r - g) / d + 4;
									break;
								}
								h /= 6;
								return h * a;
							}
						}
					}
					case 'red': return r * (a/255);
					case 'green': return g * (a/255);
					case 'blue': return b * (a/255);
				}
			}

			function updateCanvas(result) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				for (let i = 0; i < original_data.data.length; i+=4) {
					let source = [
						original_data.data[i+0],
						original_data.data[i+1],
						original_data.data[i+2],
						original_data.data[i+3],
					];
					let input = getPixelInput(result, ...source);
					let input_1 = Math.getLerp(result.in_range[0], result.in_range[1], input);
					if (result.invert) input_1 = 1-input_1;
					
					let output = Math.clamp(Math.lerp(result.out_range[0], result.out_range[1], input_1), 0, 255);

					new_data.data[i+0] = 0;
					new_data.data[i+1] = 0;
					new_data.data[i+2] = 0;
					new_data.data[i+3] = 255;

					switch (result.channel) {
						case 'height': {
							new_data.data[i+0] = output;
							new_data.data[i+1] = output;
							new_data.data[i+2] = output;
							break;
						}
						case 'metalness': {
							new_data.data[i+0] = output;
							break;
						}
						case 'emissive': {
							new_data.data[i+1] = output;
							break;
						}
						case 'roughness': {
							new_data.data[i+2] = output;
							break;
						}
					}
				}
				ctx.putImageData(new_data, 0, 0);
			}

			let preview = Interface.createElement('div', {style: 'display: flex; justify-content: space-between;'}, [original_image.canvas, canvas])
			new Dialog('generate_pbr_map', {
				title: 'action.generate_pbr_map',
				width: 564,
				lines: [preview],
				form: {
					channel: {
						type: 'select',
						label: 'PBR Channel',
						options: {
							//normal: 'menu.texture.pbr_channel.normal',
							height: 'menu.texture.pbr_channel.height',
							metalness: 'Metalness',
							emissive: 'Emissive',
							roughness: 'Roughness',
						}
					},
					method: {
						type: 'select',
						label: 'Source',
						options: {
							value: 'Value',
							brightness: 'Brightness',
							saturation: 'Saturation',
							hue: 'Hue',
							red: 'Red',
							green: 'Green',
							blue: 'Blue',
						}
					},
					in_range: {
						type: 'vector',
						label: 'Input Range',
						value: [0, 255],
						dimensions: 2, min: 0, max: 255
					},
					out_range: {
						type: 'vector',
						label: 'Output Range',
						value: [0, 255],
						dimensions: 2, min: 0, max: 255
					},
					invert: {type: 'checkbox', label: 'Invert', value: false},
				},
				onFormChange(result) {
					updateCanvas(result)
				},
				onConfirm(result) {
					updateCanvas(result);
					let textures = [];
					let pbr_channel;
					switch (result.channel) {
						case 'height': pbr_channel = result.channel; break;
						default: pbr_channel = 'mer'; break;
					}

					let existing_channel_texture = texture_group.getTextures().find(tex => tex.pbr_channel == pbr_channel);

					if (existing_channel_texture && pbr_channel == 'mer') {
						Undo.initEdit({textures: [existing_channel_texture], bitmap: true});
						if (!existing_channel_texture.layers_enabled) {
							existing_channel_texture.activateLayers(false);
						}
						let layer = new TextureLayer({
							name: result.channel,
							blend_mode: 'add'
						}, existing_channel_texture);
						let image_data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
						layer.setSize(canvas.width, canvas.height);
						layer.ctx.putImageData(image_data, 0, 0);
						layer.addForEditing();
						existing_channel_texture.updateLayerChanges(true);

					} else {
						Undo.initEdit({texture_groups: texture_group ? [texture_group] : null, textures});
						
						let main_texture = texture_group?.getTextures().find(t => t.pbr_channel == 'color');
						let name = main_texture ? main_texture.name : texture.name;
						name = name.replace('.', `_${pbr_channel}.`);

						let new_texture = new Texture({
							name,
							pbr_channel,
							group: texture_group?.uuid,
						}).fromDataURL(canvas.toDataURL()).add(false);
						textures.push(new_texture);

						if (texture_group.material_config) {
							texture_group.material_config.saved = false;
						}
					}

					setTimeout(() => {
						texture_group.updateMaterial();
					}, 50);
					Undo.finishEdit('Create PBR map');
					updateSelection();
				},
				onOpen() {
					updateCanvas(this.getFormResult());
				}
			}).show();
		}
	})
});
