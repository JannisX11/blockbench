
new ModelFormat({
	id: 'free',
	icon: 'icon-format_free',
	category: 'general',
	target: ['Godot', 'Unity', 'Unreal Engine', 'Sketchfab', 'Blender', tl('format.free.info.3d_printing')],
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
	per_texture_uv_size: true,
	uv_rotation: true,
	animation_mode: true,
	animated_textures: true,
	locators: true,
	pbr: true,
})
