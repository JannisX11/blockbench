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


		files.forEach(file => {
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
			texture.add(false);
		})

		UVEditor.vue.updateTexture()
		let last = Texture.all.last();
		Project.name = last.name || 'image';
		if (last) {
			last.load_callback = () => {
				delete last.load_callback;
				last.select();
				if (resolution instanceof Array) {
					Project.texture_width = resolution[0];
					Project.texture_height = resolution[1];
				} else {
					Project.texture_height = last.display_height;
					Project.texture_width = last.width;
				}
				if (isApp) updateRecentProjectThumbnail();
			}
		}

		if (isApp) loadDataFromModelMemory();
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
	show_on_start_screen: false,
	show_in_new_list: true,
	can_convert_to: false,
	model_identifier: false,
	single_texture: true,
	animated_textures: true,
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