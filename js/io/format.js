var Format = 0;
const Formats = {};

//Formats
class ModelFormat {
	constructor(data) {
		Formats[data.id] = this;
		this.id = data.id;
		this.name = data.name || tl('format.'+this.id);
		this.description = data.description || tl('format.'+this.id+'.desc');
		this.show_on_start_screen = true;

		this.box_uv = false;
		this.optional_box_uv = false;
		this.single_texture = false;
		this.animated_textures = false;
		this.bone_rig = false;
		this.centered_grid = false;
		this.rotate_cubes = false;
		this.integer_size = false;
		this.meshes = false;
		this.texture_meshes = false;
		this.locators = false;
		this.canvas_limit = false;
		this.rotation_limit = false;
		this.uv_rotation = false;
		this.animation_files = false;
		this.display_mode = false;
		this.animation_mode = false;

		this.codec = data.codec;
		this.onActivation = data.onActivation;
		this.onDeactivation = data.onDeactivation;
		Merge.string(this, data, 'icon');
		Merge.boolean(this, data, 'show_on_start_screen');
		
		Merge.boolean(this, data, 'box_uv');
		Merge.boolean(this, data, 'optional_box_uv');
		Merge.boolean(this, data, 'single_texture');
		Merge.boolean(this, data, 'animated_textures');
		Merge.boolean(this, data, 'bone_rig');
		Merge.boolean(this, data, 'centered_grid');
		Merge.boolean(this, data, 'rotate_cubes');
		Merge.boolean(this, data, 'integer_size');
		Merge.boolean(this, data, 'meshes');
		Merge.boolean(this, data, 'texture_meshes');
		Merge.boolean(this, data, 'locators');
		Merge.boolean(this, data, 'canvas_limit');
		Merge.boolean(this, data, 'rotation_limit');
		Merge.boolean(this, data, 'uv_rotation');
		Merge.boolean(this, data, 'animation_files');
		Merge.boolean(this, data, 'display_mode');
		Merge.boolean(this, data, 'animation_mode');
	}
	select(converting) {
		if (Format && typeof Format.onDeactivation == 'function') {
			Format.onDeactivation()
		}
		Format = this;
		if (typeof this.onActivation == 'function') {
			Format.onActivation()
		}
		if (!converting || !this.optional_box_uv) {
			Project.box_uv = Format.box_uv;
		}
		buildGrid()
		if (Format.centered_grid) {
			scene.position.set(0, 0, 0);
		} else {
			scene.position.set(-8, -8, -8);
		}
		Preview.all.forEach(preview => {
			if (preview.isOrtho && typeof preview.angle == 'number') {
				preview.loadAnglePreset(DefaultCameraPresets[preview.angle+1])
			}
		})
		Interface.Panels.animations.inside_vue._data.animation_files_enabled = this.animation_files;
		// Todo: toggle animated textures in UV editor
		for (var key in ModelProject.properties) {
			if (Project[key] == undefined) {
				ModelProject.properties[key].reset(Project);
			}
		}
		updateSelection()
		Modes.vue.$forceUpdate()
		updateInterfacePanels()
		updateShading();
		Canvas.updateRenderSides()
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

		var old_format = Format
		this.select(true)
		Modes.options.edit.select()

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
			let texture = Textre.getDefault();
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
		if (Format.canvas_limit && !old_format.canvas_limit && !settings.deactivate_size_limit.value) {

			Cube.all.forEach(function(s, i) {
				//Push elements into 3x3 block box
				[0, 1, 2].forEach(function(ax) {
					var overlap = s.to[ax] + s.inflate - 32
					if (overlap > 0) {
						//If positive site overlaps
						s.from[ax] -= overlap
						s.to[ax] -= overlap

						if (16 + s.from[ax] - s.inflate < 0) {
							s.from[ax] = -16 + s.inflate
						}
					} else {
						overlap = s.from[ax] - s.inflate + 16
						if (overlap < 0) {
							s.from[ax] -= overlap
							s.to[ax] -= overlap

							if (s.to[ax] + s.inflate > 32) {
								s.to[ax] = 32 - s.inflate
							}
						}
					}
				})
			})
		}

		//Rotation Limit
		if (Format.rotation_limit && !old_format.rotation_limit && Format.rotate_cubes) {
			Cube.all.forEach(cube => {
				if (!cube.rotation.allEqual(0)) {
					var axis = (cube.rotation_axis && getAxisNumber(cube.rotation_axis)) || 0;
					var angle = limitNumber( Math.round(cube.rotation[axis]/22.5)*22.5, -45, 45 );
					cube.rotation.V3_set(0, 0, 0)
					cube.rotation[axis] = angle;
				}
			})
		}

		//Animation Mode
		if (!Format.animation_mode && old_format.animation_mode) {
			Animator.animations.length = 0;
		}
		Canvas.updateAllPositions()
		Canvas.updateAllBones()
		Canvas.updateAllFaces()
		updateSelection()
	}
	delete() {
		delete Formats[this.id];
		if (this.codec && this.codec.format == this) delete this.codec.format;
	}
}

new ModelFormat({
	id: 'free',
	icon: 'icon-format_free',
	meshes: true,
	rotate_cubes: true,
	bone_rig: true,
	centered_grid: true,
	optional_box_uv: true,
	uv_rotation: true,
	animation_mode: true
})
