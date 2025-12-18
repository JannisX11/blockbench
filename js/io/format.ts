import { Vue } from "../lib/libs";
import { Blockbench } from "../api";
import { setProjectTitle } from "../interface/interface";
import { settings, Settings } from "../interface/settings";
import { TickUpdates } from "../misc";
import { Mode, Modes } from "../modes";
import { Group } from "../outliner/group";
import { Canvas } from "../preview/canvas";
import { DefaultCameraPresets } from "../preview/preview";
import { Property } from "../util/property";
import { SplineMesh } from "../outliner/spline_mesh";

export interface FormatPage {
	component?: Vue.Component
	content?: (
		| {
				type?: 'image' | 'h2' | 'h3' | 'h4' | 'text' | 'label' | 'image' | ''
				text?: string
				source?: string
				width?: number
				height?: number
		  }
		| string
	)[]
	button_text?: string
}
export interface CubeSizeLimiter {
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

/**
 * The current format
 */
declare const Format: ModelFormat

export const Formats: Record<string, ModelFormat> = {};

Object.defineProperty(window, 'Format', {
	get() {
		return Blockbench.Format;
	}
})

//Formats
export interface FormatFeatures {
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
	 * Enable armatures to rig meshes
	 */
	armature_rig: boolean
	/**
	 * Align the grid center with the model origin, instead of the grid corner
	 */
	centered_grid: boolean
	/**
	 * Specify how large in pixels a block is. Defaults to 16.
	 */
	block_size: number
	/**
	 * Which direction of the model is facing forward
	 */
	forward_direction: '-z' | '+z' | '-x' | '+x'
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
	 * Enable spline elements
	 */
	splines: boolean
	/**
	 * Enable texture meshes
	 */
	texture_meshes: boolean
	/**
	 * Enable billboard elements
	 */
	billboards: boolean
	/**
	 * Enable locators
	 */
	locators: boolean
	/**
	 * Enable PBR texture materials yay
	 */
	pbr: boolean
	/**
	 * Enforces a rotation limit for cubes of up to 45 degrees in either direction and one axis at a time
	 */
	rotation_limit: boolean
	/**
	 * Forces cube rotations to snap to 22.5 degree increments
	 */
	rotation_snap: boolean
	/**
	 * Rotation euler order for outliner nodes
	 */
	euler_order: 'XYZ' | 'ZYX'
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
	 * Change how animations can be grouped
	 */
	animation_grouping: 'by_file' | 'custom' | 'disabled'
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
	 * If true, interpolation between keyframes in looping animations will wrap around
	 */
	animation_loop_wrapping: boolean
	/**
	 * If true, use quaternion lerping to interpolate between rotation keyframes
	 */
	quaternion_interpolation: boolean
	/**
	 * Toggle quaternion interpolation per node / animator
	 */
	per_animator_rotation_interpolation: boolean
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
}
export type FormatOptions = FormatFeatures & {
	id: string
	icon: string
	name?: string
	description?: string
	category?: string
	target?: string | string[]
	confidential?: boolean
	condition?: ConditionResolvable
	show_on_start_screen?: boolean
	can_convert_to?: boolean
	format_page?: FormatPage
	onFormatPage?(): void
	onStart?(): void
	onSetup?(project: ModelProject, newModel?: boolean): void
	convertTo?(): void
	new?(): boolean

	codec?: Codec
	onActivation?(): void
	onDeactivation?(): void
}
export interface ModelFormat extends FormatOptions {}

export class ModelFormat implements FormatOptions {
	id: string
	icon: string
	name: string
	description: string
	category: string
	target: string | string[]
	confidential: boolean
	condition: ConditionResolvable
	show_on_start_screen: boolean
	show_in_new_list: boolean
	can_convert_to: boolean
	plugin: string
	format_page?: FormatPage
	onFormatPage?(): void
	onStart?(): void
	onSetup?(project: ModelProject, newModel?: boolean): void
	


	cube_size_limiter?: CubeSizeLimiter

	codec?: Codec
	onActivation?(): void
	onDeactivation?(): void

	static properties: Record<string, Property<any>>
	public type = 'format';

	constructor(id: string, data: Partial<FormatOptions>) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		Formats[id] = this;
		this.id = id;
		this.name = data.name || tl('format.'+this.id);
		this.description = data.description || tl('format.'+this.id+'.desc');
		if (this.description == 'format.'+this.id+'.desc') this.description = '';
		this.category = data.category || 'other';
		this.target = data.target;
		this.show_on_start_screen = true;
		this.confidential = false;
		this.can_convert_to = true;

		for (let id in ModelFormat.properties) {
			ModelFormat.properties[id].reset(this);
		}
		this.render_sides = data.render_sides;
		this.cube_size_limiter = data.cube_size_limiter;

		this.codec = data.codec;
		this.onSetup = data.onSetup;
		this.onFormatPage = data.onFormatPage;
		this.onActivation = data.onActivation;
		this.onDeactivation = data.onDeactivation;
		this.format_page = data.format_page;
		Merge.string(this, data, 'icon');
		Merge.boolean(this, data, 'show_on_start_screen');
		Merge.boolean(this, data, 'show_in_new_list');
		Merge.boolean(this, data, 'can_convert_to');
		Merge.boolean(this, data, 'confidential');

		if (data.new) this.new = data.new;

		if (data.rotation_limit && data.rotation_snap === undefined) {
			data.rotation_snap = true;
		}
		for (let id in ModelFormat.properties) {
			ModelFormat.properties[id].merge(this, data);
		}
		if (!data.animation_files && !data.animation_grouping) {
			this.animation_grouping = 'custom';
		}
		if (this.format_page && this.format_page.component) {
			Vue.component(`format_page_${this.id}`, this.format_page.component)
		}
		Blockbench.dispatchEvent('construct_format', {format: this});
	}
	select() {
		if (Format && typeof Format.onDeactivation == 'function') {
			Format.onDeactivation()
		}
		// @ts-ignore Incompatible internal and external types
		Blockbench.Format = Blockbench.Project.format = this;
		Canvas.buildGrid()
		if (Format.centered_grid) {
			scene.position.set(0, 0, 0);
			Canvas.ground_plane.position.x = Canvas.ground_plane.position.z = Format.block_size/2;
		} else {
			scene.position.set(-Format.block_size/2, 0, -Format.block_size/2);
			Canvas.ground_plane.position.x = Canvas.ground_plane.position.z = 0;
		}
		let ground_plane_scale = Format.block_size / 16;
		Canvas.ground_plane.scale.set(ground_plane_scale, ground_plane_scale, ground_plane_scale);

		PreviewModel.getActiveModels().forEach(model => {
			model.update();
		})
		Settings.updateSettingsInProfiles();
		Preview.all.forEach(preview => {
			if (preview.isOrtho && typeof preview.angle == 'number') {
				// @ts-ignore Incompatible internal and external types
				preview.loadAnglePreset(DefaultCameraPresets[preview.angle+1] as AnglePreset)
			}
		})
		if (Mode.selected && !Condition(Mode.selected.condition)) {
			(this.pose_mode ? Modes.options.paint : Modes.options.edit).select();
		}
		Interface.Panels.animations.inside_vue.$data.animation_files = this.animation_files;
		Interface.Panels.animations.inside_vue.$data.group_animations_by_file = this.animation_grouping == 'by_file';
		// @ts-ignore
		Interface.status_bar.vue.Format = this;
		UVEditor.vue.cube_uv_rotation = this.uv_rotation;
		
		if (typeof this.onActivation == 'function') {
			Format.onActivation()
		}
		if (Modes.vue) Modes.vue.$forceUpdate();
		TickUpdates.interface = true;
		Canvas.updateShading();
		Canvas.updateRenderSides()
		Blockbench.dispatchEvent('select_format', {format: this, project: Project});
		return this;
	}
	new(): boolean {
		// @ts-ignore Conflicting internal and external types
		if (newProject(this)) {
			(BarItems.project_window as Action).click();
			return true;
		}
		return false;
	}
	convertTo() {

		Undo.history.empty();
		Undo.index = 0;
		Project.export_path = '';
		Project.unhandled_root_fields = {};

		var old_format = Blockbench.Format as ModelFormat;
		this.select();
		Modes.options.edit.select()

		// Box UV
		if (!this.optional_box_uv) {
			Project.box_uv = this.box_uv;
			Cube.all.forEach(cube => {
				cube.setUVMode(this.box_uv);
			})
		}

		if (!this.per_texture_uv_size && old_format.per_texture_uv_size) {
			let tex = Texture.getDefault();
			if (tex) {
				Project.texture_width = tex.uv_width;
				Project.texture_height = tex.uv_height;
			}
		}
		if (this.per_texture_uv_size && !old_format.per_texture_uv_size) {
			Texture.all.forEach(tex => {
				tex.uv_width = Project.texture_width;
				tex.uv_height = Project.texture_height;
			})
		}

		//Bone Rig
		if (!this.bone_rig && old_format.bone_rig) {
			Group.all.forEach(group => {
				group.rotation.V3_set(0, 0, 0);
			})
		}
		if (this.bone_rig && !old_format.bone_rig) {
			var loose_stuff = []
			Outliner.root.forEach(el => {
				if (el instanceof Group == false) {
					loose_stuff.push(el)
				}
			})
			if (loose_stuff.length) {
				var root_group = new Group().init().addTo()
				loose_stuff.forEach(el => {
					el.addTo(root_group)
				})
			}
			// @ts-ignore
			if (!Project.geometry_name && Project.name) {
				// @ts-ignore
				Project.geometry_name = Project.name;
			}
		}
		if (this.bone_rig) {
			Group.all.forEach(group => {
				group.createUniqueName();
			})
		}
		if (this.centered_grid != old_format.centered_grid) {
			let offset = this.centered_grid ? -8 : 8;
			Cube.all.forEach(cube => {
				for (let axis of [0, 2]) {
					cube.from[axis] += offset;
					cube.to[axis] += offset;
					cube.origin[axis] += offset;
				}
			})
			Group.all.forEach(group => {
				group.origin[0] += offset;
				group.origin[2] += offset;
			})
		}

		if (!this.single_texture && old_format.single_texture && Texture.all.length) {
			let texture = Texture.getDefault();
			Outliner.elements.filter((el: OutlinerElement) => 'applyTexture' in el).forEach(el => {
				// @ts-ignore
				el.applyTexture(texture, true)
			})
		}

		// Outliner names
		Group.all.forEach(group => group.sanitizeName());
		Outliner.elements.forEach(group => group.sanitizeName());

		//Rotate Cubes
		if (!this.rotate_cubes && old_format.rotate_cubes) {
			Cube.all.forEach(cube => {
				cube.rotation.V3_set(0, 0, 0)
			})
		}

		//Meshes
		if (!this.meshes && old_format.meshes) {
			Mesh.all.slice().forEach(mesh => {
				mesh.remove()
			})
		}

		//Splines
		if (!this.splines && old_format.splines) {
			SplineMesh.all.slice().forEach(spline => {
				spline.remove()
			})
		}

		//Locators
		if (!this.locators && old_format.locators) {
			Locator.all.slice().forEach(locator => {
				locator.remove()
			})
		}

		//Texture Meshes
		if (!this.texture_meshes && old_format.texture_meshes) {
			TextureMesh.all.slice().forEach(tm => {
				tm.remove()
			})
		}

		//Billboards
		if (!this.billboards && old_format.billboards) {
			// @ts-ignore
			Billboard.all.slice().forEach(b => {
				b.remove()
			})
		}

		//Canvas Limit
		if (this.cube_size_limiter && !old_format.cube_size_limiter && !settings.deactivate_size_limit.value) {
			Cube.all.forEach(cube => {
				this.cube_size_limiter.move(cube);
			})
			Cube.all.forEach(cube => {
				this.cube_size_limiter.clamp(cube);
			})
		}

		//Rotation Limit
		if (this.rotation_limit && !old_format.rotation_limit && this.rotate_cubes) {
			Cube.all.forEach(cube => {
				if (!cube.rotation.allEqual(0)) {
					var axis = (getAxisNumber(cube.rotationAxis())) || 0;
					var cube_rotation = this.rotation_snap ? Math.round(cube.rotation[axis]/22.5)*22.5 : cube.rotation[axis];
					var angle = limitNumber( cube_rotation, -45, 45 );
					cube.rotation.V3_set(0, 0, 0)
					cube.rotation[axis] = angle;
				}
			})
		}

		//Animation Mode
		if (!this.animation_mode && old_format.animation_mode) {
			Animator.animations.length = 0;
		}

		Project.saved = false;
		setProjectTitle();

		Blockbench.dispatchEvent('convert_format', {format: this, old_format})

		if (typeof this.onSetup == 'function') {
			this.onSetup(Project)
		}

		Canvas.updateAllPositions()
		Canvas.updateAllBones()
		Canvas.updateAllFaces()
		updateSelection()
	}
	delete() {
		delete Formats[this.id];
		// @ts-ignore
		if (this.codec && this.codec.format == this) delete this.codec.format;
		Blockbench.dispatchEvent('delete_format', {format: this});
	}
}

new Property(ModelFormat, 'string', 'node_name_regex');
new Property(ModelFormat, 'boolean', 'box_uv');
new Property(ModelFormat, 'boolean', 'optional_box_uv');
new Property(ModelFormat, 'boolean', 'box_uv_float_size');
new Property(ModelFormat, 'boolean', 'single_texture');
new Property(ModelFormat, 'boolean', 'single_texture_default');
new Property(ModelFormat, 'boolean', 'per_group_texture');
new Property(ModelFormat, 'boolean', 'per_texture_uv_size');
new Property(ModelFormat, 'boolean', 'model_identifier', {default: true});
new Property(ModelFormat, 'boolean', 'legacy_editable_file_name');
new Property(ModelFormat, 'boolean', 'parent_model_id');
new Property(ModelFormat, 'boolean', 'vertex_color_ambient_occlusion');
new Property(ModelFormat, 'boolean', 'animated_textures');
new Property(ModelFormat, 'boolean', 'bone_rig');
new Property(ModelFormat, 'boolean', 'armature_rig');
new Property(ModelFormat, 'boolean', 'centered_grid');
new Property(ModelFormat, 'number', 'block_size', {default: 16});
new Property(ModelFormat, 'enum', 'forward_direction', {default: '-z', values: ['-z', '+z', '-x', '+x']});
new Property(ModelFormat, 'boolean', 'rotate_cubes');
new Property(ModelFormat, 'boolean', 'stretch_cubes');
new Property(ModelFormat, 'boolean', 'integer_size');
new Property(ModelFormat, 'boolean', 'meshes');
new Property(ModelFormat, 'boolean', 'splines');
new Property(ModelFormat, 'boolean', 'texture_meshes');
new Property(ModelFormat, 'boolean', 'billboards');
new Property(ModelFormat, 'boolean', 'locators');
new Property(ModelFormat, 'boolean', 'rotation_limit');
new Property(ModelFormat, 'boolean', 'rotation_snap');
new Property(ModelFormat, 'boolean', 'uv_rotation');
new Property(ModelFormat, 'boolean', 'java_cube_shading_properties');
new Property(ModelFormat, 'boolean', 'java_face_properties');
new Property(ModelFormat, 'boolean', 'cullfaces');
new Property(ModelFormat, 'boolean', 'select_texture_for_particles');
new Property(ModelFormat, 'boolean', 'texture_mcmeta');
new Property(ModelFormat, 'boolean', 'bone_binding_expression');
new Property(ModelFormat, 'boolean', 'animation_files');
new Property(ModelFormat, 'enum', 'animation_grouping', {default: 'by_file', values: ['by_file', 'custom', 'disabled']});
new Property(ModelFormat, 'boolean', 'animation_controllers');
new Property(ModelFormat, 'boolean', 'animation_loop_wrapping');
new Property(ModelFormat, 'boolean', 'quaternion_interpolation');
new Property(ModelFormat, 'boolean', 'per_animator_rotation_interpolation');
new Property(ModelFormat, 'boolean', 'image_editor');
new Property(ModelFormat, 'boolean', 'edit_mode', {default: true});
new Property(ModelFormat, 'boolean', 'paint_mode', {default: true});
new Property(ModelFormat, 'boolean', 'pose_mode');
new Property(ModelFormat, 'boolean', 'display_mode');
new Property(ModelFormat, 'boolean', 'animation_mode');
new Property(ModelFormat, 'boolean', 'texture_folder');
new Property(ModelFormat, 'boolean', 'pbr');
new Property(ModelFormat, 'enum', 'euler_order', {default: 'ZYX'});


Object.assign(window, {
	ModelFormat,
	Formats
});
