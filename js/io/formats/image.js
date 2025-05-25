(function() {

let codec = new Codec('image', {
	name: tl('format.image'),
	extension: 'png',
	remember: true,
	load_filter: {
		type: 'image',
		extensions: ['png']
	},
	load(files, path, resolution) {
		if (files instanceof Array == false) files = [files];
		if (typeof path === 'object') {
			files = [path];
			path = path.path;
		}
		setupProject(Formats.image);

		if (path && isApp && !files[0].no_file ) {
			var name = pathToName(path, true);
			Project.name = pathToName(name, false);
			Project.export_path = path;

			addRecentProject({
				name,
				path: path,
				icon: Format.icon
			});
		}


		files.forEach((file, i) => {
			let texture;
			if (file.uuid) {
				texture = new Texture(file, file.uuid).load();
			} else if (typeof file == 'string') {
				if (file.startsWith('data:image/png')) {
					texture = new Texture({name: 'image'}).fromDataURL(file);
				} else {
					texture = new Texture().fromPath(file);
				}
			} else {
				texture = new Texture().fromFile(file);
			}
			texture.load_callback = () => {
				delete texture.load_callback;
				texture.select();
				texture.activateLayers(false);

				if (resolution instanceof Array && resolution[0] && resolution[1]) {
					texture.uv_width = resolution[0];
					texture.uv_height = resolution[1];
				} else {
					texture.uv_height = texture.display_height;
					texture.uv_width = texture.width;
				}

				if (i == files.length-1) {
					UVEditor.vue.updateTexture();
					let pixel_size_limit = Math.min(32 / UVEditor.getPixelSize(), 1);
					if (pixel_size_limit < 1) UVEditor.setZoom(pixel_size_limit)
					if (isApp) updateRecentProjectThumbnail();
					UVEditor.vue.centerView();
				}
			}
			texture.add(false);
		})

		let last = Texture.all.last();
		Project.name = pathToName(last?.name, false) || 'image';

		if (path && isApp && !files[0].no_file ) {
			loadDataFromModelMemory();
		}
	},
	afterSave() {
		if (!isApp || !Texture.all.length) return;
		let last = Texture.all.last();
		let {path, name} = last;

		Project.export_path = path;
		Project.name = pathToName(name, false);
		Project.saved = true;
		
		addRecentProject({
			name,
			path: path,
			icon: Format.icon
		});
		updateRecentProjectThumbnail();
	},
	export_options: {
		format: {type: 'select', label: 'codec.common.format', options: {
			png: 'PNG',
			jpeg: 'JPEG',
			webp: 'WebP',
		}},
		quality: {type: 'range', label: 'codec.image.quality', value: 1, min: 0, max: 1, step: 0.05, editable_range_label: true, condition: (result) => result?.format != 'png'}
	},
	compile(options) {
		options = Object.assign(this.getExportOptions(), options);
		let texture = Texture.getDefault();
		if (!texture) return;
		
		let encoding = 'image/'+(options.format??'png');
		let data_url = texture.canvas.toDataURL(encoding, options.quality);
		return data_url;
	},
	async export() {
		let options = await this.promptExportOptions();
		if (options === null) return;
		let content = this.compile();
		Blockbench.export({
			resource_id: 'image',
			type: 'Image',
			extensions: [this.getExportOptions().format],
			name: this.fileName(),
			savetype: 'image',
			content,
		}, path => this.afterDownload(path));
	},
	write(content, path) {
		Blockbench.writeFile(path, {content, savetype: 'image'}, path => this.afterSave(path));
	}
})
codec.parse = null;

Codecs.project.on('parsed', () => {
	if (Texture.all[0] && !Texture.selected) {
		Texture.all[0].select();
		UVEditor.vue.centerView();
	}
})

let format = new ModelFormat('image', {
	icon: 'image',
	category: 'general',
	show_on_start_screen: true,
	show_in_new_list: true,
	can_convert_to: false,
	model_identifier: false,
	single_texture: true,
	animated_textures: true,
	per_texture_uv_size: true,
	edit_mode: false,
	image_editor: true,
	format_page: {
		button_text: 'format.image.new',
		content: [
			{type: 'image', source: './assets/image_editor.png', width: 640},
			{text: tl('format.image.info.summary')},
		]
	},
	new() {
		newProject(this);
		let callback = () => {
			setTimeout(() => {
				Undo.history.empty();
				Undo.index = 0;
				UVEditor.vue.centerView();
			}, 1);
		};
		let size_presets = {
			'': 'Unset',
			'16x16': '16 x 16',
			'32x32': '32 x 32',
			'64x64': '64 x 64',
			'128x128': '128 x 128',
			'256x256': '256 x 256',
			'512x512': '512 x 512',
			'1920x1080': '1920 x 1080',
		};
		let previous_size_preset = '';
		let dialog = new Dialog({
			id: 'add_bitmap',
			title: tl('action.create_texture'),
			buttons: ['dialog.confirm'],
			form: {
				name: 		{label: 'generic.name', value: 'texture'},
				section2:    "_",

				size_preset:{label: 'dialog.create_texture.resolution', type: 'select', options: size_presets},
				resolution: {label: 'dialog.create_texture.resolution', type: 'vector', dimensions: 2, value: [16, 16], min: 1, max: 2048},
				color: 		{label: 'data.color', type: 'color', colorpicker: TextureGenerator.background_color, toggle_enabled: true, toggle_default: false},
			},
			onFormChange(result) {
				if (result.size_preset && result.size_preset != previous_size_preset) {
					let size = result.size_preset.split('x').map(v => parseInt(v));
					dialog.setFormValues({resolution: size}, false);
				}
				previous_size_preset = result.size_preset;
			},
			onConfirm: function(results) {
				results.type = 'blank';
				TextureGenerator.addBitmap(results, callback);
			}
		}).show();
	},
	onActivation() {
		Interface.preview.classList.add('image_mode');
		UVEditor.vue.hidden = false;
		Interface.preview.append(document.getElementById('UVEditor'));
		Panels.textures.handle.firstChild.textContent = tl('panel.textures.images');
	},
	onDeactivation() {
		Interface.preview.classList.remove('image_mode');
		Panels.uv.node.append(document.getElementById('UVEditor'));
		Panels.textures.handle.firstChild.textContent = tl('panel.textures');
	},
	codec
})
codec.format = format;

BARS.defineActions(function() {
	codec.export_action = new Action({
		id: 'export_image',
		icon: 'panorama',
		category: 'file',
		condition: () => Format == format && Texture.all.length,
		click: function () {
			codec.export();
		}
	})
})

})()