var Format = 0;
const Formats = {};

//Formats
class ModelFormat {
	constructor(id, data) {
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
		this.show_in_new_list = true;
		this.can_convert_to = true;
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
		Format = Project.format = this;
		if (typeof this.onActivation == 'function') {
			Format.onActivation()
		}
		Canvas.buildGrid()
		if (Format.centered_grid) {
			scene.position.set(0, 0, 0);
			Canvas.ground_plane.position.x = Canvas.ground_plane.position.z = 8;
			PreviewModel.getActiveModels().forEach(model => {
				model.model_3d.position.x = model.model_3d.position.z = 0;
			})
		} else {
			scene.position.set(-8, -8, -8);
			Canvas.ground_plane.position.x = Canvas.ground_plane.position.z = 0;
			PreviewModel.getActiveModels().forEach(model => {
				model.model_3d.position.x = model.model_3d.position.z = 8;
			})
		}
		Preview.all.forEach(preview => {
			if (preview.isOrtho && typeof preview.angle == 'number') {
				preview.loadAnglePreset(DefaultCameraPresets[preview.angle+1])
			}
		})
		if (Mode.selected && !Condition(Mode.selected.condition)) {
			(this.pose_mode ? Modes.options.paint : Modes.options.edit).select();
		}
		Interface.Panels.animations.inside_vue._data.animation_files_enabled = this.animation_files;
		Interface.status_bar.vue.Format = this;
		Modes.vue.$forceUpdate()
		updateInterfacePanels()
		Canvas.updateShading();
		Canvas.updateRenderSides()
		Blockbench.dispatchEvent('select_format', {format: this, project: Project});
		return this;
	}
	new() {
		if (newProject(this)) {
			BarItems.project_window.click();
			return true;
		}
	}
	convertTo() {

		Undo.history.empty();
		Undo.index = 0;
		Project.export_path = '';

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
			if (!Project.geometry_name && Project.name) {
				Project.geometry_name = Project.name;
			}
		}
		if (Format.bone_rig) {
			Group.all.forEach(group => {
				group.createUniqueName();
			})
		}

		if (!Format.single_texture && old_format.single_texture && Texture.all.length) {
			let texture = Texture.getDefault();
			Outliner.elements.filter(el => el.applyTexture).forEach(el => {
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
					var axis = (cube.rotation_axis && getAxisNumber(cube.rotation_axis)) || 0;
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
		if (this.codec && this.codec.format == this) delete this.codec.format;
		Blockbench.dispatchEvent('delete_format', {format: this});
	}
}

new Property(ModelFormat, 'boolean', 'box_uv');
new Property(ModelFormat, 'boolean', 'optional_box_uv');
new Property(ModelFormat, 'boolean', 'single_texture');
new Property(ModelFormat, 'boolean', 'model_identifier', {default: true});
new Property(ModelFormat, 'boolean', 'parent_model_id');
new Property(ModelFormat, 'boolean', 'vertex_color_ambient_occlusion');
new Property(ModelFormat, 'boolean', 'animated_textures');
new Property(ModelFormat, 'boolean', 'bone_rig');
new Property(ModelFormat, 'boolean', 'centered_grid');
new Property(ModelFormat, 'boolean', 'rotate_cubes');
new Property(ModelFormat, 'boolean', 'integer_size');
new Property(ModelFormat, 'boolean', 'meshes');
new Property(ModelFormat, 'boolean', 'texture_meshes');
new Property(ModelFormat, 'boolean', 'locators');
new Property(ModelFormat, 'boolean', 'rotation_limit');
new Property(ModelFormat, 'boolean', 'rotation_snap');
new Property(ModelFormat, 'boolean', 'uv_rotation');
new Property(ModelFormat, 'boolean', 'java_face_properties');
new Property(ModelFormat, 'boolean', 'select_texture_for_particles');
new Property(ModelFormat, 'boolean', 'texture_mcmeta');
new Property(ModelFormat, 'boolean', 'bone_binding_expression');
new Property(ModelFormat, 'boolean', 'animation_files');
new Property(ModelFormat, 'boolean', 'image_editor');
new Property(ModelFormat, 'boolean', 'edit_mode', {default: true});
new Property(ModelFormat, 'boolean', 'paint_mode', {default: true});
new Property(ModelFormat, 'boolean', 'pose_mode');
new Property(ModelFormat, 'boolean', 'display_mode');
new Property(ModelFormat, 'boolean', 'animation_mode');
new Property(ModelFormat, 'boolean', 'texture_folder');
