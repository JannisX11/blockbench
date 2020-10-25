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
		Blockbench.dispatchEvent('reset_project');
		if (isApp) {
			updateRecentProjectThumbnail();
			BedrockEntityManager.reset();
		}
		if (Toolbox.selected.id !== 'move_tool') BarItems.move_tool.select();
	
		Screencam.stopTimelapse();
	
		Format = 0;
		for (var uuid in OutlinerElement.uuids) {
			delete OutlinerElement.uuids[uuid];
		}
		Outliner.elements.empty();
		Outliner.root.purge();
		Canvas.materials;
		selected.empty();
		Group.all.empty();
		Group.selected = undefined;
		Cube.all.empty();
		Cube.selected.empty();
		Locator.all.empty();
		Locator.selected.empty();
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

			form.box_uv = {label: 'dialog.project.box_uv', type: 'checkbox', value: Project.box_uv, condition: Format.optional_box_uv};
			form.texture_width = {
				label: 'dialog.project.width',
				type: 'number',
				value: Project.texture_width,
				min: 1
			};
			form.texture_height = {
				label: 'dialog.project.height',
				type: 'number',
				value: Project.texture_height,
				min: 1
			};

			var dialog = new Dialog({
				id: 'project',
				title: 'dialog.project.title',
				width: 500,
				form,
				onConfirm: function(formResult) {
					var save;
					if (Project.box_uv != formResult.box_uv ||
						Project.texture_width != formResult.texture_width ||
						Project.texture_height != formResult.texture_height
					) {
						if (!Project.box_uv && !formResult.box_uv
							&& (Project.texture_width != formResult.texture_width
							|| Project.texture_height != formResult.texture_height)
						) {
							save = Undo.initEdit({uv_only: true, elements: Cube.all, uv_mode: true})
							Cube.all.forEach(cube => {
								for (var key in cube.faces) {
									var uv = cube.faces[key].uv;
									uv[0] *= formResult.texture_width / Project.texture_width;
									uv[2] *= formResult.texture_width / Project.texture_width;
									uv[1] *= formResult.texture_height / Project.texture_height;
									uv[3] *= formResult.texture_height / Project.texture_height;
								}
							})
						} else {
							save = Undo.initEdit({uv_mode: true})
						}
						Project.texture_width = formResult.texture_width;
						Project.texture_height = formResult.texture_height;

						if (Format.optional_box_uv) Project.box_uv = formResult.box_uv;
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
					text: {type: 'info', text: 'dialog.convert_project.text'},
					format: {
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