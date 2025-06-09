/// <reference path="./blockbench.d.ts"/>

interface FormatPage {
	component?: Vue.Component
	content?: (
		| {
				type: 'image' | 'h2' | 'h3' | 'h4' | 'text' | 'label' | 'image' | ''
				text?: string
				source?: string
				width?: number
				height?: number
		  }
		| string
	)[]
	button_text?: string
}
interface CubeSizeLimiter {
	/**
	 * Test whether the cube with the optionally provided values violates the size restrictions
	 */
	test: (
		cube: Cube,
		values?: { from: ArrayVector3; to: ArrayVector3; inflate: number }
	) => boolean
	/**
	 * Move the cube back into the restructions
	 */
	move(cube: Cube, values?: { from: ArrayVector3; to: ArrayVector3; inflate: number }): void
	/**
	 * Clamp the cube to fit into the restrictions. When an axis and direction is provided, clamp the element on that side to prevent wandering.
	 */
	clamp: (
		cube: Cube,
		values?: { from: ArrayVector3; to: ArrayVector3; inflate: number },
		axis?: number,
		direction?: boolean | null
	) => void
	/**
	 * Set to true to tell Blockbench to check and adjust the cube limit after rotating a cube
	 */
	rotation_affected?: boolean
	/**
	 * Optionally set the coordinate limits of cubes in local space
	 */
	coordinate_limits?: [number, number]
}

interface FormatOptions {
	id: string
	icon: string
	name?: string
	description?: string
	category?: string
	target?: string | string[]
	confidential?: boolean
	condition?: ConditionResolvable
	show_on_start_screen?: boolean
	format_page?: FormatPage
	onFormatPage?(): void
	onStart?(): void
	onSetup?(project: ModelProject, newModel?: boolean): void
	convertTo?(): void

	/**
	 * Enables Box UV on cubes by default
	 */
	box_uv: boolean
	/**
	 * If true, box UV is optional and can be toggled on the project or per cube
	 */
	optional_box_uv: boolean
	/**
	 * If true, only one texture can be assigned to the model at a time, instead of textures being assigned per face
	 */
	single_texture: boolean
	/**
	 * If true, a single texture is used as default, but textures can still be assigned to faces
	 */
	single_texture_default: boolean
	/**
	 * If true, textures can be assigned per group instead of per face
	 */
	per_group_texture: boolean
	/**
	 * If true, UV size (the size of the texture in UV space) will be defined per texture and not per project
	 */
	per_texture_uv_size: boolean
	/**
	 * Enable a model identifier field in the project settings. Default is true
	 */
	model_identifier: boolean
	/**
	 * If true, the file name of a project will be editable in the project settings
	 */
	legacy_editable_file_name: boolean
	/**
	 * If true, enables a field in the project settings to set a parent model ID
	 */
	parent_model_id: boolean
	/**
	 * Adds a toggle in the project settings to enable project wide vertex color ambient occlusion
	 */
	vertex_color_ambient_occlusion: boolean
	/**
	 * Enable flipbook animated textures
	 */
	animated_textures: boolean
	/**
	 * Enable groups to work as bones and rig the model
	 */
	bone_rig: boolean
	/**
	 * Align the grid center with the model origin, instead of the grid corner
	 */
	centered_grid: boolean
	/**
	 * Add the ability to rotate cubes
	 */
	rotate_cubes: boolean
	/**
	 * Add the ability to stretch cubes. Stretch scales cubes from the center without affecting UV
	 */
	stretch_cubes: boolean
	/**
	 * If true, cube sizes are limited to integer values
	 */
	integer_size: boolean
	/**
	 * Enable mesh elements
	 */
	meshes: boolean
	/**
	 * Enable texture meshes
	 */
	texture_meshes: boolean
	/**
	 * Enable locators
	 */
	locators: boolean
	/**
	 * Enforces a rotation limit for cubes of up to 45 degrees in either direction and one axis at a time
	 */
	rotation_limit: boolean
	/**
	 * Forces cube rotations to snap to 22.5 degree increments
	 */
	rotation_snap: boolean
	/**
	 * Allows cube UVs to be rotated
	 */
	uv_rotation: boolean
	/**
	 * Enables Minecraft Java block/item model specific cube face features (tint and export)
	 */
	java_face_properties: boolean
	/**
	 * Allows assigning one texture to be used as a texture for particles related to the model
	 */
	select_texture_for_particles: boolean
	/**
	 * Enable mcmeta files for animated texture files
	 */
	texture_mcmeta: boolean
	/**
	 * Enables an option to set an expression for bone bindings
	 */
	bone_binding_expression: boolean
	/**
	 * If true, animations will be saved into files
	 */
	animation_files: boolean
	/**
	 * Enables a folder path per texture that can be set in the texture properties window
	 */
	texture_folder: boolean
	/**
	 * Enables the 2D image editor
	 */
	image_editor: boolean
	/**
	 * Enables edit mode. Default is true
	 */
	edit_mode: boolean
	/**
	 * Enables paint mode. Default is true
	 */
	paint_mode: boolean
	/**
	 * Enables display mode
	 */
	display_mode: boolean
	/**
	 * Emaböes animation mode
	 */
	animation_mode: boolean
	/**
	 * Enables pose mode
	 */
	pose_mode: boolean
	/**
	 * Enables animation controllers
	 */
	animation_controllers: boolean
	/**
	 * If true, cube sizes will not be floored to calculate UV sizes with box UV. This can result in UVs not aligning with pixel edges
	 */
	box_uv_float_size: boolean
	/**
	 * Enables properties for Minecraft Java block/item models related to block shading (shading option and light emission value)
	 */
	java_cube_shading_properties: boolean
	/**
	 * Enables cullfaces, the ability on faces in Minecraft block models to set a direction, that, if covered by another block, will cause the face to unrender
	 */
	cullfaces: boolean
	/**
	 * A set of characters that is allowed in node names (names of elements and groups that can be referenced externally, this does not apply to cubes or meshes)
	 */
	node_name_regex: string
	/**
	 * Set the default render sides for textures
	 */
	render_sides: 'front' | 'double' | 'back' | (() => 'front' | 'double' | 'back')

	/**
	 * Options to limit the size of cubes
	 */
	cube_size_limiter?: CubeSizeLimiter

	codec?: Codec
	onActivation?(): void
	onDeactivation?(): void
}
interface ModelFormat extends FormatOptions {}

declare class ModelFormat extends Deletable implements FormatOptions {
	constructor(id: string, options: Partial<FormatOptions>)
	constructor(options: Partial<FormatOptions>)

	id: string
	icon: string
	name: string
	description: string
	category: string
	target: string | string[]
	confidential: boolean
	condition?: ConditionResolvable
	show_on_start_screen: boolean
	format_page?: FormatPage
	onFormatPage?(): void
	onStart?(): void
	onSetup?(): void

	codec?: Codec

	cube_size_limiter?: CubeSizeLimiter
	/**
	 * Selects the format
	 */
	select(): void
	/**
	 * Creates a new model using the format. Returns false if the user clicks cancel in the 'Unsaved Changes' dialog, returns true when successful.
	 */
	new(): boolean
	/**
	 * Convert project to this format
	 */
	convertTo(): void
}

/**
 * The current format
 */
declare const Format: ModelFormat
declare const Formats: {
	[id: string]: ModelFormat
}

interface ModelLoaderOptions {
	id?: string
	icon: string
	name?: string
	description?: string
	category?: string
	target?: string | string[]
	confidential?: boolean
	condition?: ConditionResolvable
	format_page?: FormatPage
	onFormatPage?(): void
	onStart?(): void
}

declare class ModelLoader extends Deletable {
	constructor(id: string, options: ModelLoaderOptions)
	constructor(options: ModelLoaderOptions)

	id: string
	icon: string
	name: string
	description: string
	category: string
	target: string | string[]
	confidential: boolean
	condition?: ConditionResolvable
	show_on_start_screen: boolean
	format_page?: FormatPage
	onFormatPage?(): void
	onStart?(): void
}
