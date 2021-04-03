class ModelProject {
	constructor() {
		for (var key in ModelProject.properties) {
			ModelProject.properties[key].reset(this);
		}

		this._box_uv = false;
		this._texture_width = 16;
		this._texture_height = 16;
	}
	extend() {
		for (var key in ModelProject.properties) {
			ModelProject.properties[key].merge(this, object)
		}
	}
	get box_uv() {return Project._box_uv}
	set box_uv(v) {
		if (Project._box_uv != v) {
			Project._box_uv = v;
			switchBoxUV(v);
		}
	}
	get texture_width() {return this._texture_width}
	get texture_height() {return this._texture_height}
	set texture_width(n) {
		n = parseInt(n)||16
		Vue.nextTick(updateProjectResolution)
		this._texture_width = n;
	}
	set texture_height(n) {
		n = parseInt(n)||16
		Vue.nextTick(updateProjectResolution)
		this._texture_height = n;
	}
	get optional_box_uv() {
		return Format.optional_box_uv;
	}
	reset() {
		if (isApp) updateRecentProjectThumbnail();

		Blockbench.dispatchEvent('reset_project');
		
		if (isApp) BedrockEntityManager.reset();

		if (Toolbox.selected.id !== 'move_tool') BarItems.move_tool.select();
	
		Screencam.stopTimelapse();
	
		Format = 0;
		for (var uuid in OutlinerNode.uuids) {
			delete OutlinerNode.uuids[uuid];
		}
		Outliner.elements.empty();
		Outliner.root.purge();
		for (var key in Canvas.materials) {
			delete Canvas.materials[key];
		}
		for (var key in Canvas.bones) {
			delete Canvas.bones[key];
		}
		selected.empty();
		Group.all.empty();
		Group.selected = undefined;
		Cube.all.empty();
		Cube.selected.empty();
		Locator.all.empty();
		Locator.selected.empty();
		Texture.all.forEach(tex => tex.stopWatcher());
		Texture.all.empty();
		Texture.selected = undefined;
	
		for (var key in ModelProject.properties) {
			ModelProject.properties[key].reset(this)
		}
		this.texture_width = this.texture_height = 16;
		this.overrides = null;
	
		Blockbench.display_settings = display = {};
		ModelMeta.save_path = ModelMeta.export_path = ModelMeta.name = '';
		ModelMeta.saved = true;
		Prop.project_saved = true;
		Prop.added_models = 0;
		Canvas.updateAll();
		Outliner.vue.$forceUpdate();
		Interface.Panels.textures.inside_vue.$forceUpdate();
		Undo.history.empty();
		Undo.index = 0;
		Undo.current_save = null;
		Painter.current = {};
		Animator.animations.purge();
		Timeline.animators.purge();
		Animation.selected = undefined;
		delete Animator.motion_trail_lock;
		$('#var_placeholder_area').val('');
	}
}
new Property(ModelProject, 'string', 'name', {
	label: 'dialog.project.name'
});
new Property(ModelProject, 'string', 'parent', {
	label: 'dialog.project.parent',
	condition: {formats: ['java_block']
}});
new Property(ModelProject, 'string', 'geometry_name', {
	label: 'dialog.project.geoname',
	condition: () => Format.bone_rig
});
new Property(ModelProject, 'string', 'modded_entity_version', {
	label: 'dialog.project.modded_entity_version',
	default: '1.15',
	condition: {formats: ['modded_entity']},
	options() {
		let options = {}
		for (var key in Codecs.modded_entity.templates) {
			if (Codecs.modded_entity.templates[key] instanceof Function == false) {
				options[key] = Codecs.modded_entity.templates[key].name;
			}
		}
		return options;
	}
});
new Property(ModelProject, 'boolean', 'ambientocclusion', {
	label: 'dialog.project.ao',
	default: true,
	condition: {formats: ['java_block']}
});
new Property(ModelProject, 'boolean', 'front_gui_light', {
	exposed: false,
	condition: () => Format.display_mode});
new Property(ModelProject, 'vector', 'visible_box', {
	exposed: false,
	default: [1, 1, 0]
});
new Property(ModelProject, 'boolean', 'layered_textures', {
	label: 'dialog.project.layered_textures',
	description: 'dialog.project.layered_textures.desc',
	condition() {return Format.single_texture}
});


const Project = new ModelProject();


//New
function resetProject() {
	Project.reset()
}
function newProject(format, force) {
	if (force || showSaveDialog()) {
		if (Format) {
			Project.reset();
		}
		if (format instanceof ModelFormat) {
			format.select();
		}
		Modes.options.edit.select();
		Blockbench.dispatchEvent('new_project');
		return true;
	} else {
		return false;
	}
}

// Resolution
function setProjectResolution(width, height, modify_uv) {
	if (Project.texture_width / width != Project.texture_width / height) {
		modify_uv = false;
	}

	Undo.initEdit({uv_mode: true, elements: Cube.all, uv_only: true})

	let old_res = {
		x: Project.texture_width,
		y: Project.texture_height
	}
	Project.texture_width = width;
	Project.texture_height = height;


	if (modify_uv) {
		var multiplier = [
			Project.texture_width/old_res.x,
			Project.texture_height/old_res.y
		]
		function shiftCube(cube, axis) {
			if (Project.box_uv) {
				cube.uv_offset[axis] *= multiplier[axis];
			} else {
				for (var face in cube.faces) {
					var uv = cube.faces[face];
					uv[axis] *= multiplier[axis];
					uv[axis+2] *= multiplier[axis];
				}
			}
		}
		if (old_res.x != Project.texture_width && Math.areMultiples(old_res.x, Project.texture_width)) {
			Cube.all.forEach(cube => shiftCube(cube, 0));
		}
		if (old_res.y != Project.texture_height &&  Math.areMultiples(old_res.x, Project.texture_width)) {
			Cube.all.forEach(cube => shiftCube(cube, 1));
		}
	}
	Undo.finishEdit('Changed project resolution')
	Canvas.updateAllUVs()
	if (selected.length) {
		main_uv.loadData()
	}
}
function updateProjectResolution() {
	document.querySelector('#project_resolution_status').textContent = `${Project.texture_width} ⨉ ${Project.texture_height}`;
}


BARS.defineActions(function() {

	new Action('project_window', {
		icon: 'featured_play_list',
		category: 'file',
		condition: () => Format,
		click: function () {

			let form = {
				format: {type: 'info', label: 'data.format', text: Format.name||'unknown'}
			}
			
			for (var key in ModelProject.properties) {
				let property = ModelProject.properties[key];
				if (property.exposed == false || !Condition(property.condition)) continue;

				let entry = form[property.name] = {
					label: property.label,
					description: property.description,
					value: Project[property.name],
					type: property.type
				}
				if (property.type == 'boolean') entry.type = 'checkbox';
				if (property.type == 'string') entry.type = 'text';
				if (property.options) {
					entry.options = typeof property.options == 'function' ? property.options() : property.options;
					entry.type = 'select';
				}
			}

			form.uv_mode = {
				label: 'dialog.project.uv_mode',
				type: 'select',
				condition: Format.optional_box_uv,
				options: {
					face_uv: 'dialog.project.uv_mode.face_uv',
					box_uv: 'dialog.project.uv_mode.box_uv',
				},
				value: Project.box_uv ? 'box_uv' : 'face_uv',
			};

			form.texture_size = {
				label: 'dialog.project.texture_size',
				type: 'vector',
				dimensions: 2,
				value: [Project.texture_width, Project.texture_height],
				min: 1
			};

			var dialog = new Dialog({
				id: 'project',
				title: 'dialog.project.title',
				width: 500,
				form,
				onConfirm: function(formResult) {
					var save;
					let box_uv = formResult.uv_mode == 'box_uv';
					let texture_width = Math.clamp(formResult.texture_size[0], 1, Infinity);
					let texture_height = Math.clamp(formResult.texture_size[1], 1, Infinity);

					if (Project.box_uv != box_uv ||
						Project.texture_width != texture_width ||
						Project.texture_height != texture_height
					) {
						if (!Project.box_uv && !box_uv
							&& (Project.texture_width != texture_width
							|| Project.texture_height != texture_height)
						) {
							save = Undo.initEdit({uv_only: true, elements: Cube.all, uv_mode: true})
							Cube.all.forEach(cube => {
								for (var key in cube.faces) {
									var uv = cube.faces[key].uv;
									uv[0] *= texture_width / Project.texture_width;
									uv[2] *= texture_width / Project.texture_width;
									uv[1] *= texture_height / Project.texture_height;
									uv[3] *= texture_height / Project.texture_height;
								}
							})
						} else {
							save = Undo.initEdit({uv_mode: true})
						}
						Project.texture_width = texture_width;
						Project.texture_height = texture_height;

						if (Format.optional_box_uv) Project.box_uv = box_uv;
						Canvas.updateAllUVs()
						updateSelection()
					}

					if (Format.single_texture) {
						if (Project.layered_textures !== formResult.layered_textures && Texture.all.length >= 2) {
							Project.layered_textures = formResult.layered_textures;
							Texture.all.forEach((tex, i) => {
								tex.visible = i < 3
							})
							Interface.Panels.textures.inside_vue.$forceUpdate()
							Canvas.updateLayeredTextures();
						}
					}
					
					for (var key in ModelProject.properties) {
						ModelProject.properties[key].merge(Project, formResult);
					}

					if (save) {
						Undo.finishEdit('change global UV')
					}

					Blockbench.dispatchEvent('update_project_settings', formResult);

					BARS.updateConditions()
					if (EditSession.active) {
						EditSession.sendAll('change_project_meta', JSON.stringify(Project));
					}
					
					dialog.hide()
				}
			})
			dialog.show()
		}
	})
	new Action('close_project', {
		icon: 'cancel_presentation',
		category: 'file',
		condition: () => (!EditSession.active || EditSession.hosting) && Format,
		click: function () {
			if (showSaveDialog()) {
				resetProject()
				Modes.options.start.select()
				Modes.vue.$forceUpdate()
				Blockbench.dispatchEvent('close_project');
			}
		}
	})
	new Action('convert_project', {
		icon: 'fas.fa-file-import',
		category: 'file',
		condition: () => (!EditSession.active || EditSession.hosting),
		click: function () {

			var options = {};
			for (var key in Formats) {
				if (key !== Format.id && key !== 'skin') {
					options[key] = Formats[key].name;
				}
			}

			var dialog = new Dialog({
				id: 'convert_project',
				title: 'dialog.convert_project.title',
				width: 540,
				form: {
					text:    {type: 'info', text: 'dialog.convert_project.text'},
					current: {type: 'info', label: 'dialog.convert_project.current_format', text: Format.name || '-'},
					format:  {
						label: 'data.format',
						type: 'select',
						default: Format.id,
						options,
					},
				},
				onConfirm: function(formResult) {
					var format = Formats[formResult.format]
					if (format && format != Format) {
						format.convertTo()
					}
					dialog.hide()
				}
			})
			dialog.show()
		}
	})
})