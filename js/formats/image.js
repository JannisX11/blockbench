import { applyPalette, quantize } from "../util/gif";

let codec = new Codec('image', {
	name: tl('format.image'),
	extension: 'png',
	remember: true,
	load_filter: {
		type: 'image',
		extensions: Texture.getAllExtensions
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
			tga: 'TGA',
			gif: 'GIF',
		}},
		alpha_channel: {type: 'checkbox', label: 'codec.image.alpha_channel', condition: (result) => result?.format == 'gif', value: true},
		animation_fps: {type: 'number', label: 'codec.image.animation_fps', condition: (result) => result?.format == 'gif', value: 7},
		quality: {type: 'range', label: 'codec.image.quality', value: 1, min: 0, max: 1, step: 0.05, editable_range_label: true, condition: (result) => result && ['jpeg', 'webp'].includes(result.format)}
	},
	async compile(options) {
		options = Object.assign(this.getExportOptions(), options);
		let texture = Texture.getDefault();
		if (!texture) return;

		if (options.format == 'gif') {
			let gif = GIFEnc.GIFEncoder();
			let has_transparency = options.alpha_channel ?? true;
			let i = 0;
			let format = 'rgb565';
			let prio_color_accuracy = false;
			let width = texture.width;
			let height = texture.display_height;
			let interval = 1000 / options.animation_fps;
			let {ctx} = texture;
			for (let frame = 0; frame < texture.frameCount; frame++) {
				let data = ctx.getImageData(0, frame * height, width, height).data;
				let palette = quantize(data, {has_transparency, prio_color_accuracy});
				let index;
				if (palette.length > 256) {
					// Built-in methods
					palette = GIFEnc.quantize(data, 256, {format, oneBitAlpha: true, clearAlphaThreshold: 127});
					index = GIFEnc.applyPalette(data, palette, format);
				} else {
					// Direct flicker-free color mapping
					index = applyPalette(data, palette, {has_transparency, prio_color_accuracy});
				}
				gif.writeFrame(index, width, height, { palette, delay: interval, transparent: has_transparency });
				i++;
				await new Promise(resolve => setTimeout(resolve, 0));
			}

			gif.finish();

			let buffer = gif.bytesView();
			let blob = new Blob([buffer], {type: 'image/gif'});
			var reader = new FileReader();
			return await new Promise((resolve, reject) => {
				reader.onload = () => resolve(reader.result);
				reader.onerror = reject;
				reader.readAsDataURL(blob);
			})

		} else if (Texture.file_formats[options.format]?.encode) {
			return await Texture.file_formats[options.format].encode(texture);

		} else {
			let encoding = 'image/'+(options.format??'png');
			let data_url = texture.canvas.toDataURL(encoding, options.quality);
			return data_url;
		}
	},
	async export() {
		let options = await this.promptExportOptions();
		if (options === null) return;
		let content = await this.compile();
		Blockbench.export({
			resource_id: 'image',
			type: 'Image',
			extensions: [this.getExportOptions().format],
			name: this.fileName(),
			savetype: typeof content == 'string' ? 'image' : 'binary',
			content,
		}, path => this.afterDownload(path));
	},
	write(content, path) {
		Blockbench.writeFile(path, {content, savetype: 'image'}, path => this.afterSave(path));
	}
})
codec.parse = null;

Codecs.project.on('parsed', () => {
	if (Format.id == 'image' && Texture.all[0] && !Texture.selected) {
		Texture.all[0].select();
		UVEditor.vue.centerView();
	}
})

let uv_editor_node;
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
		let format_options = {};
		for (let key in Texture.file_formats) {
			format_options[key] = Texture.file_formats[key].name;
		}

		let dialog = new Dialog({
			id: 'add_bitmap',
			title: tl('action.create_texture'),
			buttons: ['dialog.confirm'],
			form: {
				name: 		{label: 'generic.name', value: 'texture'},
				file_format: {label: 'menu.texture.file_format', type: 'select', value: 'png', options: format_options},
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
		uv_editor_node = uv_editor_node ?? Panels.uv.node.firstChild;
		Interface.preview.append(uv_editor_node);
		Panels.uv.update();
		Panels.textures.handle.firstChild.textContent = tl('panel.textures.images');
	},
	onDeactivation() {
		Interface.preview.classList.remove('image_mode');
		Panels.uv.node.append(uv_editor_node);
		Panels.textures.handle.firstChild.textContent = tl('panel.textures');
		setTimeout(() => {
			if (Condition(Panels.uv.condition)) Panels.uv.update()
		}, 0);
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
