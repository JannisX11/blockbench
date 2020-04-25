const Project = {
	name			: '',
	parent			: '',
	geometry_name	: '',
	description	   	: '',
	_box_uv 		: false,
	get box_uv() {return Project._box_uv},
	set box_uv(v) {
		if (Project._box_uv != v) {
			Project._box_uv = v;
			switchBoxUV(v);
		}
	},
	get texture_width() {return Project._texture_width},
	get texture_height() {return Project._texture_height},
	set texture_width(n) {
		n = parseInt(n)||16
		Vue.nextTick(updateProjectResolution)
		Project._texture_width = n;
	},
	set texture_height(n) {
		n = parseInt(n)||16
		Vue.nextTick(updateProjectResolution)
		Project._texture_height = n;
	},
	_texture_width	: 16,
	_texture_height	: 16,
	ambientocclusion: true,
	front_gui_light: false,
	visible_box: [1, 1, 0], /*width, height, y*/
	modded_entity_version: '1.15',
	get optional_box_uv() {
		return Format.optional_box_uv;
	}
}


//New
function resetProject() {
	Blockbench.dispatchEvent('reset_project');
	if (Toolbox.selected.id !== 'move_tool') BarItems.move_tool.select();
	Format = 0;
	elements.length = 0;
	Outliner.root.purge();
	Canvas.materials.length = 0;
	textures.length = 0;
	selected.length = 0;

	Screencam.stopTimelapse();

	Group.all.empty();
	Group.selected = undefined;
	Cube.all.empty();
	Cube.selected.empty();
	Locator.all.empty();
	Locator.selected.empty();

	Blockbench.display_settings = display = {};
	Project.name = Project.parent = Project.geometry_name = Project.description	 = '';
	Project.texture_width = Project.texture_height = 16;
	Project.ambientocclusion = true;
	Project.front_gui_light = false;
	Project.modded_entity_version = '1.15';
	Project.visible_box.splice(0, Infinity, ...[1, 1, 0])
	ModelMeta.save_path = ModelMeta.export_path = ModelMeta.animation_path = ModelMeta.name = '';
	ModelMeta.saved = true;
	Prop.project_saved = true;
	Prop.added_models = 0;
	Canvas.updateAll();
	Outliner.vue.$forceUpdate();
	texturelist.$forceUpdate();
	Undo.history.length = 0;
	Undo.index = 0;
	Undo.current_save = null;
	Painter.current = {};
	Animator.animations.purge();
	Timeline.animators.purge();
	Animator.selected = undefined;
	$('#var_placeholder_area').val('');
}
function newProject(format, force) {
	if (force || showSaveDialog()) {
		resetProject();
		Modes.options.edit.select();
		if (format instanceof ModelFormat) {
			format.select();
		}
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

			let modded_entity_options = {}
			for (var key in Codecs.modded_entity.templates) {
				if (Codecs.modded_entity.templates[key] instanceof Function == false) {
					modded_entity_options[key] = Codecs.modded_entity.templates[key].name;
				}
			}
			var dialog = new Dialog({
				id: 'project',
				title: 'dialog.project.title',
				width: 540,
				form: {
					format: {type: 'info', label: 'data.format', text: Format.name||'unknown'},
					name: {label: 'dialog.project.name', value: Project.name},

					parent: {label: 'dialog.project.parent', value: Project.parent, condition: !Format.bone_rig, list: ['paro', 'foo', 'bar']},
					geometry_name: {label: 'dialog.project.geoname', value: Project.geometry_name, condition: Format.bone_rig},
					modded_entity_version: {label: 'dialog.project.modded_entity_version', type: 'select', default: Project.modded_entity_version, options: modded_entity_options, condition: Format.id == 'modded_entity'},
					ambientocclusion: {label: 'dialog.project.ao', type: 'checkbox', value: Project.ambientocclusion, condition: Format.id == 'java_block'},

					box_uv: {label: 'dialog.project.box_uv', type: 'checkbox', value: Project.box_uv, condition: Format.optional_box_uv},
					texture_width: {
						label: 'dialog.project.width',
						type: 'number',
						value: Project.texture_width,
						min: 1
					},
					texture_height: {
						label: 'dialog.project.height',
						type: 'number',
						value: Project.texture_height,
						min: 1
					},
				},
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

					Project.name = formResult.name;
					Project.parent = formResult.parent;
					Project.geometry_name = formResult.geometry_name;
					Project.ambientocclusion = formResult.ambientocclusion;
					if (formResult.modded_entity_version) Project.modded_entity_version = formResult.modded_entity_version;

					if (save) {
						Undo.finishEdit('change global UV')
					}

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