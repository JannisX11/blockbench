new ModelFormat('image', {
	icon: 'image',
	show_on_start_screen: false,
	show_in_new_list: true,
	can_convert_to: false,
	model_identifier: false,
	single_texture: true,
	animated_textures: true,
	edit_mode: false,
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
	}
})
