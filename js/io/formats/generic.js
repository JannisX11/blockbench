
new ModelFormat({
	id: 'free',
	icon: 'icon-format_free',
	category: 'low_poly',
	target: ['Blender', 'Unity', 'Unreal Engine', 'Sketchfab'],
	format_page: {
		content: [
			{type: 'h3', text: tl('mode.start.format.informations')},
			{text: `* ${tl('format.free.info.meshes')}
					* ${tl('format.free.info.limitation')}`.replace(/\t+/g, '')
			},
			{type: 'h3', text: tl('mode.start.format.resources')},
			{text: `* [Low-Poly Modeling Tutorial](https://www.youtube.com/watch?v=WbyCbA1c8BM)`}
		]
	},
	meshes: true,
	rotate_cubes: true,
	bone_rig: true,
	centered_grid: true,
	optional_box_uv: true,
	uv_rotation: true,
	animation_mode: true,
	animated_textures: true,
	locators: true,
})

new ModelFormat('image', {
	icon: 'image',
	category: 'low_poly',
	show_on_start_screen: false,
	show_in_new_list: false,
	can_convert_to: false,
	model_identifier: false,
	animated_textures: true,
	edit_mode: false,
	new() {
		return newProject(this);
	}
})
