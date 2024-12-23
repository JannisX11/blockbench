class ModelProject {
	constructor(options = {}, uuid) {
		for (var key in ModelProject.properties) {
			ModelProject.properties[key].reset(this, true);
		}
		this.uuid = uuid || guid();
		this.selected = false;
		this.locked = false;
		this.thumbnail = '';

		this._static = Object.freeze({
			properties: {
				undo: new UndoSystem()
			}
		})

		this.box_uv = options.format ? options.format.box_uv : false;
		this._texture_width = 16;
		this._texture_height = 16;

		this._name = '';
		this._saved = true;

		this.save_path = '';
		this.export_path = '';
		this.export_options = {};
		this.added_models = 0;

		this.format = options.format instanceof ModelFormat ? options.format : Formats.free;
		this.mode = 'edit';
		this.tool = '';
		this.view_mode = 'textured';
		this.display_uv = settings.show_only_selected_uv.value ? 'selected_faces' :'selected_elements';
		this.exploded_view = false;
		this.mirror_modeling_enabled = false;
		this.previews = {};
		this.uv_viewport = {
			zoom: 1,
			offset: [0, 0]
		};
		this.EditSession = null;

		/*this.backgrounds = {
			normal: 		new ReferenceImage({name: 'menu.preview.perspective.normal', lock: null}),
			ortho_top: 		new ReferenceImage({name: 'direction.top', lock: true}),
			ortho_bottom: 	new ReferenceImage({name: 'direction.bottom', lock: true}),
			ortho_south: 	new ReferenceImage({name: 'direction.south', lock: true}),
			ortho_north: 	new ReferenceImage({name: 'direction.north', lock: true}),
			ortho_east: 	new ReferenceImage({name: 'direction.east', lock: true}),
			ortho_west: 	new ReferenceImage({name: 'direction.west', lock: true}),
		}*/
		this.reference_images = [];

		// Data
		this.elements = [];
		this.groups = [];
		this.selected_elements = [];
		this.selected_groups = [];
		this.mesh_selection = {};
		this.textures = [];
		this.selected_texture = null;
		this.texture_groups = [];
		this.outliner = [];
		this.collections = [];
		this.animations = [];
		this.animation_controllers = [];
		this.timeline_animators = [];
		this.display_settings = {};

		ModelProject.all.push(this);

		ProjectData[this.uuid] = {
			model_3d: new THREE.Object3D(),
			nodes_3d: {}
		}
	}
	extend() {
		for (var key in ModelProject.properties) {
			ModelProject.properties[key].merge(this, object)
		}
	}
	get texture_width() {return this._texture_width}
	get texture_height() {return this._texture_height}
	set texture_width(n) {
		n = parseInt(n)||16
		if (this.selected && n != this._texture_width) {
			Vue.nextTick(updateProjectResolution);
		}
		this._texture_width = n;
	}
	get optional_box_uv() {
		return Format.optional_box_uv;
	}
	set texture_height(n) {
		n = parseInt(n)||16
		if (this.selected && n != this._texture_height) {
			Vue.nextTick(updateProjectResolution);
		}
		this._texture_height = n;
	}
	get name() {
		return this._name;
	}
	set name(name) {
		this._name = name;
		if (Project == this) {
			setProjectTitle(name);
		}
	}
	get undo() {
		return this._static.properties.undo;
	}
	get saved() {
		return this._saved;
	}
	set saved(saved) {
		this._saved = saved;

		// Dispatch an event to allow other scripts to react to the change
		Blockbench.dispatchEvent('saved_state_changed', { 
			project: this, 
			saved: saved
		});
		if (Project == this) {
			setProjectTitle(this.name);
		}
	}
	get geometry_name() {
		return this.model_identifier;
	}
	set geometry_name(val) {
		this.model_identifier = val;
	}
	get model_3d() {
		return ProjectData[this.uuid].model_3d;
	}
	get nodes_3d() {
		return ProjectData[this.uuid].nodes_3d;
	}
	getDisplayName() {
		return this.name || this.model_identifier || this.format.name;
	}
	getProjectMemory() {
		if (!isApp) return;
		let path = this.export_path || this.save_path;
		let data = recent_projects.find(p => p.path == path);
		return data;
	}
	getUVWidth(texture = 0) {
		return (texture && Format.per_texture_uv_size) ? texture.uv_width : this.texture_width;
	}
	getUVHeight(texture = 0) {
		return (texture && Format.per_texture_uv_size) ? texture.uv_height : this.texture_height;
	}
	openSettings() {
		if (this.selected) BarItems.project_window.click();
	}
	whenNextOpen(callback) {
		if (Project == this) {
			callback();
		} else {
			if (!this.on_next_upen) this.on_next_upen = [];
			this.on_next_upen.push(callback);
		}
	}
	saveEditorState() {
		UVEditor.saveViewportOffset();
		
		Preview.all.forEach(preview => {
			this.previews[preview.id] = {
				position: preview.camera.position.toArray(),
				target: preview.controls.target.toArray(),
				orthographic: preview.isOrtho,
				zoom: preview.camOrtho.zoom,
				angle: preview.angle,
			}
		})

		Blockbench.dispatchEvent('save_editor_state', {project: this});
		return this;
	}
	loadEditorState() {
		Project = this;
		Undo = this.undo;
		this.selected = true;
		this.format.select();
		BarItems.view_mode.set(this.view_mode);

		// Setup Data
		OutlinerNode.uuids = {};
		this.elements.forEach(el => {
			OutlinerNode.uuids[el.uuid] = el;
		})
		this.groups.forEach(group => {
			OutlinerNode.uuids[group.uuid] = group;
		})
		Outliner.root = this.outliner;
		Panels.outliner.inside_vue.root = this.outliner;
		Panels.collections.inside_vue.collections = Collection.all;

		UVEditor.vue.elements = this.selected_elements;
		UVEditor.vue.all_elements = this.elements;
		UVEditor.vue.box_uv = this.box_uv;
		UVEditor.vue.display_uv = this.display_uv;
		BarItems.edit_mode_uv_overlay.value = this.display_uv == 'all_elements';
		BarItems.edit_mode_uv_overlay.updateEnabledState();

		Panels.textures.inside_vue.textures = Texture.all;
		Panels.textures.inside_vue.texture_groups = TextureGroup.all;
		Panels.layers.inside_vue.layers = Texture.selected ? Texture.selected.layers : [];
		scene.add(this.model_3d);

		Panels.animations.inside_vue.animations = this.animations;
		Panels.animations.inside_vue.animation_controllers = this.animation_controllers;
		Timeline.animators = Timeline.vue.animators = [];
		Animation.selected = null;
		AnimationController.selected = null;
		let selected_anim = this.animations.find(anim => anim.selected);
		if (selected_anim) selected_anim.select();
		Timeline.animators = Timeline.vue.animators = this.timeline_animators;

		Panels.variable_placeholders.inside_vue.text = this.variable_placeholders.toString();
		Panels.variable_placeholders.inside_vue.buttons.replace(this.variable_placeholder_buttons);

		Panels.skin_pose.inside_vue.pose = this.skin_pose;

		UVEditor.loadViewportOffset();

		if (settings.save_view_per_tab.value) {
			Preview.all.forEach(preview => {
				let data = this.previews[preview.id];
				if (data) {
					preview.camera.position.fromArray(data.position);
					preview.controls.target.fromArray(data.target);
					preview.setProjectionMode(data.orthographic);
					if (data.zoom) preview.camOrtho.zoom = data.zoom;
					if (data.angle) preview.setLockedAngle(data.angle);
				} else if (preview.default_angle !== undefined) {
					preview.loadAnglePreset(preview.default_angle);
				}
			})
		}

		Modes.options[this.mode].select();
		if (BarItems[this.tool] && Condition(BarItems[this.tool].condition)) {
			BarItems[this.tool].select();
		}

		BarItems.lock_motion_trail.set(!!Project.motion_trail_lock);

		BarItems.mirror_modeling.set(!!Project.mirror_modeling_enabled);

		Blockbench.dispatchEvent('load_editor_state', {project: this});
		return this;
	}
	select() {
		if (this === Project) return true;
		if (this.locked || Project.locked) return false;
		if (!ModelProject.all.includes(this)) return false;
		if (Project) {
			Project.unselect();
			Blockbench.addFlag('switching_project');
		} else {
			Interface.tab_bar.new_tab.visible = false;
		}

		this.loadEditorState();

		if (this.EditSession) {
			Interface.Panels.chat.inside_vue.chat_history = this.EditSession.chat_history;
			this.EditSession.catchUp();
		}

		Blockbench.dispatchEvent('select_project', {project: this});

		if (Preview.selected) Preview.selected.occupyTransformer();
		setProjectTitle(this.name);
		setStartScreen(!Project);
		updateInterface();
		ReferenceImage.updateAll();
		updateProjectResolution();
		Validator.validate();
		Vue.nextTick(() => {
			if (this.on_next_upen instanceof Array) {
				this.on_next_upen.forEach(callback => callback());
				delete this.on_next_upen;
			}
		})
		Blockbench.removeFlag('switching_project');
		return true;
	}
	showContextMenu(event) {
		if (!this.selected) {
			this.select()
		}
		this.menu.open(event, this);
		return this;
	}
	updateThumbnail() {
		if (!Format.image_editor) {
			this.thumbnail = Preview.selected.canvas.toDataURL();
		} else if (Texture.all.length) {
			this.thumbnail = Texture.getDefault()?.source;
		}
	}
	unselect(closing) {
		if (!closing) {
			this.updateThumbnail();
			this.saveEditorState();
		}
		
		Interface.tab_bar.last_opened_project = this.uuid;

		if (Format && typeof Format.onDeactivation == 'function') {
			Format.onDeactivation()
		}

		this.undo.closeAmendEditMenu();
		this.reference_images.forEach(reference => reference.detach());
		if (ReferenceImageMode.active) ReferenceImageMode.deactivate();
		if (TextureAnimator.isPlaying) TextureAnimator.stop();
		this.selected = false;
		Painter.current = {};
		Animator.MolangParser.context = {};
		scene.remove(this.model_3d);
		OutlinerNode.uuids = {};
		MirrorModeling.cached_elements = {};
		Format = 0;
		Project = 0;
		Undo = 0;
		if (Modes.selected) Modes.selected.unselect();
		Settings.updateSettingsInProfiles();

		OutlinerNode.uuids = {};
		Outliner.root = [];

		if (closing) {
			updateInterface();
		}

		Blockbench.dispatchEvent('unselect_project', {project: this});
	}
	closeOnQuit() {
		try {
			if (isApp) {
				updateRecentProjectData();
			}
			Blockbench.dispatchEvent('close_project', {on_quit: true});

		} catch (err) {
			console.error(err);
		}
		if (this.EditSession) {
			this.EditSession.quit();
		}
	}
	async close(force) {
		if (this.locked) return false;
		let last_selected = Project;
		try {
			let result = this.select();
			if (result === false) return false;
		} catch (err) {
			console.error(err);
		}

		async function saveWarning() {
			return await new Promise((resolve) => {
				if (isApp) {
					shell.beep();
				}
				Blockbench.showMessageBox({
					title: Project.getDisplayName(),
					message: tl('message.close_warning.message'),
					buttons: [tl('dialog.save'), tl('dialog.discard'), tl('dialog.cancel')],
					cancel_on_click_outside: false,
					width: 472,
				}, async (answer) => {
					if (answer === 0) {
						if (Project.save_path || Project.export_path) {
							BarItems.save_project.trigger();
						} else {
							await BarItems.export_over.click();
						}
						await new Promise(resolve => setTimeout(resolve, 4));
						resolve(Project.saved);
					} else if (answer == 1) {
						resolve(true);
					} else if (answer == 2) {
						resolve(false);
					}
				})
			});
		}

		if (force || Project.saved || await saveWarning()) {
			try {
				if (isApp) {
					updateRecentProjectData();
				}
				Blockbench.dispatchEvent('close_project');

			} catch (err) {
				console.error(err);
			}

			if (this.EditSession) {
				this.EditSession.quit();
			}
			
			this.unselect(true);
			Texture.all.forEach(tex => tex.stopWatcher());

			// Clear memory
			for (let uuid in ProjectData[this.uuid].nodes_3d) {
				let node_3d = ProjectData[this.uuid].nodes_3d[uuid];
				if (node_3d.parent) node_3d.parent.remove(node_3d);
				if (node_3d.geometry) node_3d.geometry.dispose();
				if (node_3d.outline && node_3d.outline.geometry) {
					node_3d.outline.geometry.dispose();
				}
			}

			let index = ModelProject.all.indexOf(this);
			ModelProject.all.remove(this);
			delete ProjectData[this.uuid];
			Project = 0;
			
			await AutoBackup.removeBackup(this.uuid);

			if (last_selected && last_selected !== this) {
				last_selected.select();
			} else if (last_selected == 0) {
				Interface.tab_bar.openNewTab();
			} else if (ModelProject.all.length) {
				ModelProject.all[Math.clamp(index, 0, ModelProject.all.length-1)].select();
			} else {
				Interface.tab_bar.new_tab.visible = true;
				Interface.tab_bar.new_tab.select();
				selectNoProject();
			}

			return true;
		} else {
			return false;
		}
	}
}
new Property(ModelProject, 'string', 'name', {
	label: 'dialog.project.name'
});
new Property(ModelProject, 'string', 'parent', {
	label: 'dialog.project.parent',
	condition: {features: ['parent_model_id']}
});
new Property(ModelProject, 'string', 'model_identifier', {
	label: 'dialog.project.geoname',
	condition: () => Format.model_identifier
});
new Property(ModelProject, 'string', 'modded_entity_entity_class', {
	label: 'dialog.project.modded_entity_entity_class',
	placeholder: 'Entity',
	condition: {formats: ['modded_entity']},
});
new Property(ModelProject, 'string', 'modded_entity_version', {
	label: 'dialog.project.modded_entity_version',
	default: '1.17',
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
new Property(ModelProject, 'string', 'credit', {
	label: 'dialog.project.credit',
	condition: () => Project.credit && Project.credit !== settings.credit.value
});
new Property(ModelProject, 'boolean', 'modded_entity_flip_y', {
	label: 'dialog.project.modded_entity_flip_y',
	default: true,
	condition: {formats: ['modded_entity']}
});
new Property(ModelProject, 'boolean', 'ambientocclusion', {
	label: 'dialog.project.ao',
	default: true,
	condition: {features: ['vertex_color_ambient_occlusion']}
});
new Property(ModelProject, 'boolean', 'front_gui_light', {
	exposed: false,
	condition: () => Format.display_mode
});
new Property(ModelProject, 'vector', 'visible_box', {
	exposed: false,
	default: [1, 1, 0]
});
new Property(ModelProject, 'string', 'variable_placeholders', {
	exposed: false,
});
new Property(ModelProject, 'array', 'variable_placeholder_buttons', {
	exposed: false,
});
new Property(ModelProject, 'number', 'shadow_size', {
	label: 'dialog.project.shadow_size',
	condition: {formats: ['optifine_entity']},
	default: 1
});
new Property(ModelProject, 'string', 'skin_model', {
	exposed: false,
	condition: {formats: ['skin']},
	default: 'steve'
});
new Property(ModelProject, 'string', 'skin_pose', {
	exposed: false,
	condition: {formats: ['skin']},
	default: 'none'
});
new Property(ModelProject, 'enum', 'bedrock_animation_mode', {
	exposed: false,
	values: ['entity', 'attachable_first'],
	condition: {formats: ['bedrock']},
	default: 'entity'
});
new Property(ModelProject, 'array', 'timeline_setups', {
	exposed: false,
	condition: () => Format.animation_mode,
});
new Property(ModelProject, 'object', 'unhandled_root_fields', {
	exposed: false
});


ModelProject.all = [];

let Project = 0;

let ProjectData = {};

ModelProject.prototype.menu = new Menu([
	new MenuSeparator('settings'),
	'project_window',
	new MenuSeparator('manage'),
	'open_model_folder',
	'duplicate_project',
	'convert_project',
	'close_project',
	new MenuSeparator('save'),
	'save_project',
	'save_project_as',
	'save_project_incremental',
	'export_over',
	'share_model',
	new MenuSeparator('overview'),
	'tab_overview',
])

// Setup ModelProject for loaded project
function setupProject(format, uuid) {
	if (typeof format == 'string' && Formats[format]) format = Formats[format];
	if (uuid && ModelProject.all.find(project => project.uuid == uuid)) uuid = null;
	new ModelProject({format}, uuid).select();

	if (format.edit_mode) {
		Modes.options.edit.select();
	} else if (format.paint_mode) {
		Modes.options.paint.select();
	} else if (format.animation_mode) {
		Modes.options.animate.select();
	}
	if (typeof Format.onSetup == 'function') {
		Format.onSetup(Project, false)
	}
	Blockbench.dispatchEvent('setup_project');
	return true;
}
// Setup brand new project
function newProject(format) {
	if (typeof format == 'string' && Formats[format]) format = Formats[format];
	new ModelProject({format}).select();

	if (format.edit_mode) {
		Modes.options.edit.select();
	} else if (format.paint_mode) {
		Modes.options.paint.select();
	}
	if (typeof Format.onSetup == 'function') {
		Format.onSetup(Project, true)
	}
	Blockbench.dispatchEvent('new_project');
	return true;
}
function selectNoProject() {
	setStartScreen(true);
	
	Project = 0;
	Undo = null;

	// Setup Data
	OutlinerNode.uuids = {};
	Outliner.root = [];
	Panels.outliner.inside_vue.root = [];
	Panels.collections.inside_vue.collections = [];

	UVEditor.vue.elements = [];
	UVEditor.vue.all_elements = [];

	Panels.textures.inside_vue.textures = [];
	Panels.textures.inside_vue.texture_groups = [];

	Panels.animations.inside_vue.animations = [];
	Panels.animations.inside_vue.animation_controllers = [];
	Timeline.animators = Timeline.vue.animators = [];
	Animation.selected = null;
	AnimationController.selected = null;
	Timeline.animators = Timeline.vue.animators = [];

	Panels.variable_placeholders.inside_vue.text = '';
	Panels.variable_placeholders.inside_vue.buttons.empty();

	Panels.skin_pose.inside_vue.pose = '';

	Blockbench.dispatchEvent('select_no_project', {});
}
function updateTabBarVisibility() {
	let hidden = Settings.get('hide_tab_bar') && Interface.tab_bar.tabs.length < 2;
	document.getElementById('tab_bar').style.display = hidden ? 'none' : 'flex';
	document.getElementById('title_bar_home_button').style.display = hidden ? 'block' : 'none';
}

// Resolution
function setProjectResolution(width, height, modify_uv) {
	if (Project.texture_width / width != Project.texture_width / height) {
		modify_uv = false;
	}

	let textures = Format.per_texture_uv_size ? Texture.all : undefined;

	Undo.initEdit({uv_mode: true, elements: Cube.all, uv_only: true, textures});

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
		function shiftElement(element, axis) {
			if (!element.faces) return;
			if (element instanceof Mesh) {

				for (let key in element.faces) {
					let face = element.faces[key];
					face.vertices.forEach(vertex_key => {
						if (face.uv[vertex_key]) {
							face.uv[vertex_key][axis] *= multiplier[axis];
						}
					})
				}

			} else if (element.box_uv) {
				element.uv_offset[axis] = Math.floor(element.uv_offset[axis] * multiplier[axis]);
			} else {
				for (let face in element.faces) {
					let {uv} = element.faces[face];
					uv[axis] *= multiplier[axis];
					uv[axis+2] *= multiplier[axis];
				}
			}
		}
		if (old_res.x != Project.texture_width && Math.areMultiples(old_res.x, Project.texture_width)) {
			Outliner.elements.forEach(element => shiftElement(element, 0));
		}
		if (old_res.y != Project.texture_height &&  Math.areMultiples(old_res.x, Project.texture_width)) {
			Outliner.elements.forEach(element => shiftElement(element, 1));
		}
	}
	textures && textures.forEach(tex => {
		tex.uv_width = Project.texture_width;
		tex.uv_height = Project.texture_height;
	});

	Undo.finishEdit('Changed project resolution')
	Canvas.updateAllUVs()
	if (selected.length) {
		UVEditor.loadData()
	}
}
function updateProjectResolution() {
	if (!Format.per_texture_uv_size) {
		if (Interface.Panels.uv) {
			UVEditor.vue.uv_resolution.replace([Project.texture_width, Project.texture_height]);
			UVEditor.vue.updateSize()
		}
		if (Texture.selected) {
			// Update animated textures
			Texture.selected.height++;
			Texture.selected.height--;
		}
	}
	Canvas.uvHelperMaterial.uniforms.DENSITY.value = Project.texture_width / 32;
	Blockbench.dispatchEvent('update_project_resolution', {project: Project});
}

function setStartScreen(state) {
	document.getElementById('start_screen').style.display = state ? 'block' : 'none';
	Interface.work_screen.style.display = state ? 'none' : 'grid';
}

onVueSetup(() => {
	const new_tab = {
		name: tl('projects.new_tab'),
		saved: true,
		selected: true,
		uuid: guid(),
		visible: true,
		is_new_tab: true,
		getDisplayName() {return this.name},
		close: () => {
			if (ModelProject.all.length) {
				Interface.tab_bar.new_tab.visible = false;
				let project = ModelProject.all.find(project => project.uuid == Interface.tab_bar.last_opened_project) ||
								ModelProject.all.last();
				if (project) project.select();
			} else {
				window.close();
			}
		},
		select() {
			if (Project) {
				Project.unselect()
			}
			Project = 0;
			Interface.tab_bar.new_tab.selected = true;
			setProjectTitle(ModelProject.all.length ? tl('projects.new_tab') : null);
			updateInterface();
		},
		openSettings() {}
	}
	Interface.tab_bar = new Vue({
		el: '#tab_bar',
		data: {
			projects: ModelProject.all,
			drag_target_index: null,
			drag_position_index: null,
			close_tab_label: tl('projects.close_tab'),
			search_tabs_label: tl('action.tab_overview'),
			last_opened_project: '',
			new_tab
		},
		computed: {
			tabs() {
				let tabs = this.projects.slice();
				if (this.new_tab.visible) {
					tabs.push(this.new_tab);
				}
				return tabs;
			}
		},
		methods: {
			openNewTab() {
				if (Project.locked) return;
				this.last_opened_project = Project.uuid;
				this.new_tab.visible = true;
				this.new_tab.select();
				selectNoProject();
			},
			tabOverview() {
				BarItems.tab_overview.trigger();
			},
			mouseDown(tab, e1) {
				convertTouchEvent(e1);
				e1.preventDefault();
				
				if (this.thumbnail) {
					this.thumbnail.remove();
					delete this.thumbnail;
				}
				if (e1.button == 1) {
					function off(e2) {
						removeEventListeners(document, 'mouseup', off);
						delete tab.middle_mouse_pressing;
					}
					tab.middle_mouse_pressing = true;
					addEventListeners(document, 'mouseup', off, {passive: false});
					return;
				}
				
				let scope = this;
				let active = false;
				let timeout;
				let last_event = e1;
				let outside_tab_bar = false;
				let drag_out_window_helper;

				let tab_node = e1.target;
				if (!tab_node.classList.contains('project_tab') || ModelProject.all.indexOf(tab) < 0) return;

				tab.select();

				let activate = () => {
					this.drag_target_index = ModelProject.all.indexOf(tab);
					this.drag_position_index = 0;
					if (open_menu) open_menu.hide();
					active = true;
				}

				function move(e2) {
					convertTouchEvent(e2);
					let offset = e2.clientX - e1.clientX;
					if (!active) {
						let distance = Math.abs(offset);
						if (Blockbench.isTouch) {
							if (distance > 14 && timeout) {
								clearTimeout(timeout);
								timeout = null;
							} else {
								document.getElementById('tab_bar').scrollLeft += last_event.clientX - e2.clientX;
							}
						} else if (distance > 5) {
							activate();
						}
					} else {
						if (e2) e2.preventDefault();
						
						tab_node.style.left = `${offset}px`;

						let index_offset = Math.trunc((e2.clientX - e1.clientX) / tab_node.clientWidth);
						scope.drag_position_index = scope.drag_target_index + index_offset;

						// Detach tab
						let outside_tab_bar_before = outside_tab_bar; 
						outside_tab_bar = isApp && Math.abs(e2.clientY - 42) > 60 || e2.clientX < 2 || e2.clientX > window.innerWidth;

						if (outside_tab_bar !== outside_tab_bar_before) {
							//setStartScreen(outside_tab_bar);
							if (!drag_out_window_helper) {
								drag_out_window_helper = Interface.createElement('div', {id: 'drag_out_window_helper'}, Interface.createElement('div', {}, tab.name));
							}
							if (outside_tab_bar) {
								document.body.append(drag_out_window_helper);
							} else {
								document.body.removeChild(drag_out_window_helper);
							}
							tab_node.style.visibility = outside_tab_bar ? 'hidden' : 'visible';
							ipcRenderer.send('dragging-tab', outside_tab_bar);

						}
						if (outside_tab_bar) {
							drag_out_window_helper.style.left = `${e2.clientX}px`;
							drag_out_window_helper.style.top = `${e2.clientY}px`;
						}
					}
					last_event = e2;
				}
				function off(e2) {
					let {drag_target_index} = scope;

					removeEventListeners(document, 'mousemove touchmove', move);
					removeEventListeners(document, 'mouseup touchend', off);
					tab_node.style.left = null;
					scope.drag_target_index = null;
					scope.drag_position_index = null;

					if (Blockbench.isTouch) clearTimeout(timeout);

					
					if (isApp && outside_tab_bar && !tab.EditSession) {
						let project = Codecs.project.compile({editor_state: true, history: true, uuids: true, bitmaps: true, raw: true})
						let pos = currentwindow.getPosition()
						project.detached_uuid = Project.uuid;
						project.detached_window_id = currentwindow.id;
						ipcRenderer.send('dragging-tab', false);
						ipcRenderer.send('new-window', JSON.stringify(project), JSON.stringify({
							offset: [
								pos[0] + e2.clientX,
								pos[1] + e2.clientY,
							]
						}));
						drag_out_window_helper.remove();
						tab_node.style.visibility = null;
						tab.detached = true;

					} else if (active && !open_menu) {
						convertTouchEvent(e2);
						let index_offset = Math.trunc((e2.clientX - e1.clientX) / tab_node.clientWidth);
						if (index_offset) {
							ModelProject.all.splice(drag_target_index, 1);
							ModelProject.all.splice(drag_target_index + index_offset, 0, tab);
						}
					}
				}

				if (Blockbench.isTouch) {
					timeout = setTimeout(() => {
						active = true;
						move(e1);
					}, 320)
				}

				addEventListeners(document, 'mousemove touchmove', move, {passive: false});
				addEventListeners(document, 'mouseup touchend', off, {passive: false});
			},
			selectProject(project, event) {
				if (!event.target.classList.contains('project_tab_close_button')) {
					project.select();
				}
			},
			mouseUp(tab, e1) {
				if (e1.button === 1 && tab.middle_mouse_pressing) {
					tab.close()
				}
			},
			mouseEnter(project, event) {
				if (project.thumbnail && !project.selected) {
					if (this.thumbnail_timeout) {
						clearTimeout(this.thumbnail_timeout);
						delete this.thumbnail_timeout;
					}
					if (!this.thumbnail) {
						this.thumbnail = new Image();
						document.body.append(this.thumbnail);
					}
					let img = this.thumbnail;
					img.src = project.thumbnail;
					img.attributes.width = '240px';
					img.className = 'project_thumbnail';
					if (project.format.image_editor) img.classList.add('pixelated');
					let offset = $(event.target).offset();
					img.style.left = (offset.left) + 'px';
					img.style.top = (offset.top + event.target.clientHeight+2) + 'px';
				}
			},
			mouseLeave() {
				if (this.thumbnail) {
					this.thumbnail_timeout = setTimeout(() => {
						if (this.thumbnail) this.thumbnail.remove();
						delete this.thumbnail;
						delete this.thumbnail_timeout;
					}, 80)
				}
			},
			mousewheelBar(event) {
				if (event.deltaY) {
					event.preventDefault();
					this.$refs.tab_bar_list.scrollLeft += event.deltaY;
				}
			}
		},
		watch: {
			tabs() {
				updateTabBarVisibility();
			}
		}
	})

	updateTabBarVisibility()
})


BARS.defineActions(function() {

	new Action('project_window', {
		icon: 'featured_play_list',
		category: 'file',
		condition: () => Format,
		click: function () {

			let form = {
				format: {type: 'info', label: 'data.format', text: Format.name||'unknown', description: Format.description}
			}
			
			for (var key in ModelProject.properties) {
				let property = ModelProject.properties[key];
				if (property.exposed === false || !Condition(property.condition)) continue;

				let entry = form[property.name] = {
					label: property.label,
					description: property.description,
					value: Project[property.name],
					placeholder: property.placeholder,
					type: property.type
				}
				if (property.type == 'boolean') entry.type = 'checkbox';
				if (property.type == 'string') entry.type = 'text';
				if (property.options) {
					entry.options = typeof property.options == 'function' ? property.options() : property.options;
					entry.type = 'select';
				}
			}

			if (form.name && (Project.save_path || Project.export_path || Format.image_editor) && !Format.legacy_editable_file_name) {
				delete form.name;
			}

			form.uv_mode = {
				label: 'dialog.project.default_uv_mode',
				description: 'dialog.project.default_uv_mode.description',
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
				linked_ratio: false,
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
						// Adjust UV Mapping if resolution changed
						if (!Project.box_uv && !box_uv && !Format.per_texture_uv_size &&
							(Project.texture_width != texture_width || Project.texture_height != texture_height)
						) {
							save = Undo.initEdit({elements: [...Cube.all, ...Mesh.all], uv_only: true, uv_mode: true})
							Cube.all.forEach(cube => {
								for (var key in cube.faces) {
									var uv = cube.faces[key].uv;
									uv[0] *= texture_width / Project.texture_width;
									uv[2] *= texture_width / Project.texture_width;
									uv[1] *= texture_height / Project.texture_height;
									uv[3] *= texture_height / Project.texture_height;
								}
							})
							Mesh.all.forEach(mesh => {
								for (var key in mesh.faces) {
									var uv = mesh.faces[key].uv;
									for (let vkey in uv) {
										uv[vkey][0] *= texture_width / Project.texture_width;
										uv[vkey][1] *= texture_height / Project.texture_height;
									}
								}
							})
						}
						// Convert UV mode per element
						if (Project.box_uv != box_uv &&
							((box_uv && !Cube.all.find(cube => cube.box_uv)) ||
							(!box_uv && !Cube.all.find(cube => !cube.box_uv)))
						) {
							if (!save) {
								save = Undo.initEdit({elements: Cube.all, uv_only: true, uv_mode: true})
							}
							Cube.all.forEach(cube => {
								cube.setUVMode(box_uv);
							})
						}
						if (!save) {
							save = Undo.initEdit({uv_mode: true})
						}
						Project.texture_width = texture_width;
						Project.texture_height = texture_height;

						if (Format.optional_box_uv) Project.box_uv = box_uv;
						Canvas.updateAllUVs()
						updateSelection()
					}
					
					for (var key in ModelProject.properties) {
						ModelProject.properties[key].merge(Project, formResult);
					}
					Project.name = Project.name.trim();
					Project.model_identifier = Project.model_identifier.trim();

					if (save) {
						Undo.finishEdit('Change project UV settings')
					}

					Blockbench.dispatchEvent('update_project_settings', formResult);

					BARS.updateConditions()
					if (Project.EditSession) {
						let metadata = {
							texture_width: Project.texture_width,
							texture_height: Project.texture_height,
							box_uv: Project.box_uv
						};
						for (let key in ModelProject.properties) {
							ModelProject.properties[key].copy(Project, metadata);
						}
						Project.EditSession.sendAll('change_project_meta', JSON.stringify(metadata));
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
		keybind: new Keybind({key: 'w', ctrl: true}),
		condition: () => Project,
		click: function () {
			Project.close();
		}
	})
	new Action('duplicate_project', {
		icon: 'file_copy',
		category: 'file',
		condition: () => Project && (!Project.EditSession || Project.EditSession.hosting),
		click: function () {
			let selected_texture_uuid = Texture.selected?.uuid
			let model = Codecs.project.compile({raw: true});
			setupProject(Format)
			Codecs.project.parse(model);

			function copyfyName(name) {
				if (!name) return name;
				let index = name.lastIndexOf('.');
				if (index == -1) return name;
				let main = name.substring(0, index);
				let ext = name.substring(index);
				return main + ' - Copy' + ext;
			}
			Project.name = copyfyName(Project.name);

			Texture.all.find(t => t.uuid == selected_texture_uuid)?.select();
		}
	})
	new Action('convert_project', {
		icon: 'fas.fa-file-import',
		category: 'file',
		condition: () => Project && (!Project.EditSession || Project.EditSession.hosting),
		click: function () {

			var options = {};
			for (var key in Formats) {
				let format = Formats[key]
				if (key !== Format.id && format.can_convert_to) {
					options[key] = format.name;
				}
			}

			var dialog = new Dialog({
				id: 'convert_project',
				title: 'dialog.convert_project.title',
				width: 540,
				form: {
					text1:		{type: 'info', text: 'dialog.convert_project.text1'},
					text2:		{type: 'info', text: 'dialog.convert_project.text2'},
					text3:		{type: 'info', text: 'dialog.convert_project.text3'},
					current: 	{type: 'info', label: 'dialog.convert_project.current_format', text: Format.name || '-'},
					format:  	{
						label: 'data.format',
						type: 'select',
						options,
					},
					create_copy: {type: 'checkbox', label: 'dialog.convert_project.create_copy', value: true}
				},
				onConfirm: function(formResult) {
					var format = Formats[formResult.format]
					if (!format || format == Format) return;
					
					if (formResult.create_copy) {
						let selected_texture_uuid = Texture.selected?.uuid
						let model = Codecs.project.compile({raw: true});
						setupProject(Format)
						Codecs.project.parse(model);
						if (Project.name) Project.name += ' - Converted';
						Texture.all.find(t => t.uuid == selected_texture_uuid)?.select();
					}
					
					format.convertTo()
				}
			})
			dialog.show()
		}
	})
	new Action('switch_tabs', {
		icon: 'swap_horiz',
		category: 'file',
		keybind: new Keybind({key: 9, ctrl: true}, {reverse_order: 'shift'}),
		variations: {
			reverse_order: {name: 'action.switch_tabs.reverse_order'}
		},
		condition: () => ModelProject.all.length > 1,
		click(event) {
			let index = ModelProject.all.indexOf(Project);
			let target;
			if (this.keybind.additionalModifierTriggered(event) == 'reverse_order') {
				target = ModelProject.all[index-1] || ModelProject.all.last();
			} else {
				target = ModelProject.all[index+1] || ModelProject.all[0];
			}
			if (target) target.select();
		}
	})
	new Action('tab_overview', {
		icon: 'view_module',
		category: 'file',
		condition: () => ModelProject.all.length,
		click(event) {
			if (Project) Project.updateThumbnail();

			let dialog = new ShapelessDialog('tab_overview', {
				component: {
					data() {return {
						search_term: '',
						projects: ModelProject.all
					}},
					methods: {
						select(project) {
							Dialog.open.confirm();
							project.select();
						},
						isPixelArt(project) {
							return project.format.image_editor && project.textures[0]?.height < 190;
						}
					},
					computed: {
						filtered_projects() {
							if (!this.search_term) return this.projects;
							let term = this.search_term.toLowerCase();
							return this.projects.filter(project => {
								return project.name.toLowerCase().includes(term) || project.model_identifier?.toLowerCase().includes(term);
							})
						}
					},
					template: `
						<div id="tab_overview">
							<div id="tab_overview_search">
								<search-bar id="tab_overview_search_bar" v-model="search_term"></search-bar>
							</div>
							<ul id="tab_overview_grid">
								<li v-for="project in filtered_projects" @mousedown="select(project)" :class="{pixel_art: isPixelArt(project)}">
									<img :src="project.thumbnail" :style="{visibility: project.thumbnail ? 'unset' : 'hidden'}">
									{{ project.name }}
								</li>
							</ul>
						</div>
					`
				},
				onConfirm() {
					let projects = this.content_vue.filtered_projects;
					if (this.content_vue.search_term) {
						projects[0].select();
					}
				}
			}).show();
			Vue.nextTick(() => {
				document.querySelector('#tab_overview_search input')?.focus()
			})
		}
	})
})
