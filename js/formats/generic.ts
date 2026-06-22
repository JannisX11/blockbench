new ModelFormat('free', {
	icon: 'icon-format_free',
	category: 'general',
	name: 'Generic Model',
	description: 'Cuboid-based JSON model for the Vintage Bench cleanup base.',
	target: ['Vintage Story JSON'],
	format_page: {
		content: [
			{type: 'h3', text: tl('mode.start.format.informations')},
			{text: 'Cuboid editing base for Vintage Bench. TODO: replace Blockbench project serialization with a proper Vintage Story shape JSON codec.'}
		]
	},
	rotate_cubes: true,
	bone_rig: true,
	centered_grid: true,
	optional_box_uv: true,
	per_texture_uv_size: true,
	per_texture_wrap_mode: true,
	uv_rotation: true,
	display_mode: true,
	animation_mode: true,
	per_animator_rotation_interpolation: true,
	animated_textures: true,
	locators: true,
})
