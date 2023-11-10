(function() {

let codec = new Codec('image', {
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
				texture = new Texture(file).load();
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
				}
			}
			texture.add(false);
		})

		let last = Texture.all.last();
		Project.name = last?.name || 'image';

		if (path && isApp && !files[0].no_file ) {
			loadDataFromModelMemory();

			addRecentProject({
				name,
				path: path,
				icon: Format.icon
			});
		}
	},
	afterSave() {
		if (!isApp || !Texture.all.length) return;
		let last = Texture.all.last();
		let {path, name} = last;

		Project.export_path = path;
		Project.name = name;
		Project.saved = true;
		
		addRecentProject({
			name,
			path: path,
			icon: Format.icon
		});
		updateRecentProjectThumbnail();
	}
})
codec.compile = null;
codec.parse = null;
codec.export = null;

new ModelFormat('image', {
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
	new() {
		if (newProject(this)) {
			TextureGenerator.addBitmapDialog();
			return true;
		}
	},
	onActivation() {
		Interface.preview.classList.add('image_mode');
		UVEditor.vue.hidden = false;
		Interface.preview.append(document.getElementById('UVEditor'))
	},
	onDeactivation() {
		Interface.preview.classList.remove('image_mode');
		Panels.uv.node.append(document.getElementById('UVEditor'))
	},
	codec
})

})()