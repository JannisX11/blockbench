import { Vue } from "../../lib/libs";
import { Blockbench } from "../api";
import { setProjectTitle } from "../interface/interface";
import { Settings } from "../interface/settings";
import { Mode, Modes } from "../modes";
import { Group } from "../outliner/group";
import { Canvas } from "../preview/canvas";
import { DefaultCameraPresets } from "../preview/preview";
import { Property } from "../util/property";

export const Formats = {};

Object.defineProperty(window, 'Format', {
	get() {
		return Blockbench.Format;
	}
})

//Formats
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
	show_in_new_list?: boolean
	can_convert_to?: boolean
	plugin?: string
	format_page?: FormatPage
	onFormatPage?(): void
	onStart?(): void
	onSetup?(project: ModelProject, newModel?: boolean): void
	new?(): boolean
	convertTo?(): void

	/**
	 * Enables Box UV on cubes by default or something
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

	box_uv: boolean
	optional_box_uv: boolean
	single_texture: boolean
	single_texture_default: boolean
	per_group_texture: boolean
	per_texture_uv_size: boolean
	model_identifier: boolean
	legacy_editable_file_name: boolean
	parent_model_id: boolean
	vertex_color_ambient_occlusion: boolean
	animated_textures: boolean
	bone_rig: boolean
	centered_grid: boolean
	rotate_cubes: boolean
	stretch_cubes: boolean
	integer_size: boolean
	meshes: boolean
	texture_meshes: boolean
	locators: boolean
	rotation_limit: boolean
	rotation_snap: boolean
	uv_rotation: boolean
	java_face_properties: boolean
	select_texture_for_particles: boolean
	texture_mcmeta: boolean
	bone_binding_expression: boolean
	animation_files: boolean
	texture_folder: boolean
	image_editor: boolean
	edit_mode: boolean
	paint_mode: boolean
	display_mode: boolean
	animation_mode: boolean
	pose_mode: boolean
	animation_controllers: boolean
	box_uv_float_size: boolean
	java_cube_shading_properties: boolean
	cullfaces: boolean
	node_name_regex: string
	render_sides: 'front' | 'double' | 'back' | (() => 'front' | 'double' | 'back')

	cube_size_limiter?: CubeSizeLimiter

	codec?: Codec
	onActivation?(): void
	onDeactivation?(): void

	static properties: Record<string, Property>

	constructor(id, data: FormatOptions) {
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
		if (typeof this.onActivation == 'function') {
			Format.onActivation()
		}
		Canvas.buildGrid()
		if (Format.centered_grid) {
			scene.position.set(0, 0, 0);
			Canvas.ground_plane.position.x = Canvas.ground_plane.position.z = 8;
		} else {
			scene.position.set(-8, 0, -8);
			Canvas.ground_plane.position.x = Canvas.ground_plane.position.z = 0;
		}
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
		Interface.Panels.animations.inside_vue.$data.animation_files_enabled = this.animation_files;
		// @ts-ignore
		Interface.status_bar.vue.Format = this;
		UVEditor.vue.cube_uv_rotation = this.uv_rotation;
		if (Modes.vue) Modes.vue.$forceUpdate();
		updateInterfacePanels();
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

		var old_format = Format;
		this.select();
		Modes.options.edit.select()

		// Box UV
		if (!this.optional_box_uv) {
			Project.box_uv = this.box_uv;
			Cube.all.forEach(cube => {
				cube.setUVMode(this.box_uv);
			})
		}

		if (!Format.per_texture_uv_size && old_format.per_texture_uv_size) {
			let tex = Texture.getDefault();
			if (tex) {
				Project.texture_width = tex.uv_width;
				Project.texture_height = tex.uv_height;
			}
		}
		if (Format.per_texture_uv_size && !old_format.per_texture_uv_size) {
			Texture.all.forEach(tex => {
				tex.uv_width = Project.texture_width;
				tex.uv_height = Project.texture_height;
			})
		}

		//Bone Rig
		if (!Format.bone_rig && old_format.bone_rig) {
			Group.all.forEach(group => {
				group.rotation.V3_set(0, 0, 0);
			})
		}
		if (Format.bone_rig && !old_format.bone_rig) {
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
		if (Format.bone_rig) {
			Group.all.forEach(group => {
				group.createUniqueName();
			})
		}
		if (Format.centered_grid != old_format.centered_grid) {
			let offset = Format.centered_grid ? -8 : 8;
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

		if (!Format.single_texture && old_format.single_texture && Texture.all.length) {
			let texture = Texture.getDefault();
			Outliner.elements.filter((el: OutlinerElement) => 'applyTexture' in el).forEach(el => {
				// @ts-ignore
				el.applyTexture(texture, true)
			})
		}

		//Rotate Cubes
		if (!Format.rotate_cubes && old_format.rotate_cubes) {
			Cube.all.forEach(cube => {
				cube.rotation.V3_set(0, 0, 0)
			})
		}

		//Meshes
		if (!Format.meshes && old_format.meshes) {
			Mesh.all.slice().forEach(mesh => {
				mesh.remove()
			})
		}

		//Locators
		if (!Format.locators && old_format.locators) {
			Locator.all.slice().forEach(locator => {
				locator.remove()
			})
		}

		//Texture Meshes
		if (!Format.texture_meshes && old_format.texture_meshes) {
			TextureMesh.all.slice().forEach(tm => {
				tm.remove()
			})
		}

		//Canvas Limit
		if (Format.cube_size_limiter && !old_format.cube_size_limiter && !settings.deactivate_size_limit.value) {
			Cube.all.forEach(cube => {
				Format.cube_size_limiter.move(cube);
			})
			Cube.all.forEach(cube => {
				Format.cube_size_limiter.clamp(cube);
			})
		}

		//Rotation Limit
		if (Format.rotation_limit && !old_format.rotation_limit && Format.rotate_cubes) {
			Cube.all.forEach(cube => {
				if (!cube.rotation.allEqual(0)) {
					var axis = (getAxisNumber(cube.rotationAxis())) || 0;
					var cube_rotation = Format.rotation_snap ? Math.round(cube.rotation[axis]/22.5)*22.5 : cube.rotation[axis];
					var angle = limitNumber( cube_rotation, -45, 45 );
					cube.rotation.V3_set(0, 0, 0)
					cube.rotation[axis] = angle;
				}
			})
		}

		//Animation Mode
		if (!Format.animation_mode && old_format.animation_mode) {
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
new Property(ModelFormat, 'boolean', 'centered_grid');
new Property(ModelFormat, 'boolean', 'rotate_cubes');
new Property(ModelFormat, 'boolean', 'stretch_cubes');
new Property(ModelFormat, 'boolean', 'integer_size');
new Property(ModelFormat, 'boolean', 'meshes');
new Property(ModelFormat, 'boolean', 'texture_meshes');
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
new Property(ModelFormat, 'boolean', 'animation_controllers');
new Property(ModelFormat, 'boolean', 'image_editor');
new Property(ModelFormat, 'boolean', 'edit_mode', {default: true});
new Property(ModelFormat, 'boolean', 'paint_mode', {default: true});
new Property(ModelFormat, 'boolean', 'pose_mode');
new Property(ModelFormat, 'boolean', 'display_mode');
new Property(ModelFormat, 'boolean', 'animation_mode');
new Property(ModelFormat, 'boolean', 'texture_folder');
new Property(ModelFormat, 'boolean', 'pbr');


Object.assign(window, {
	ModelFormat,
	Formats
});
