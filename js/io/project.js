class ModelProject {
	constructor(options = {}) {
		for (var key in ModelProject.properties) {
			ModelProject.properties[key].reset(this);
		}
		this.uuid = guid();
		this.selected = false;
		this.thumbnail = '';

		this._box_uv = false;
		this._texture_width = 16;
		this._texture_height = 16;

		this._name = '';
		this.saved = true;
		this.save_path = '';
		this.export_path = '';

		this.undo = new UndoSystem();
		if (isApp) this.BedrockEntityManager = new BedrockEntityManager(this);
		this.format = options.format instanceof ModelFormat ? options.format : Formats.free;
		this.mode = 'edit';
		this.EditSession = null;

		// Data
		this.elements = [];
		this.groups = [];
		this.selected_elements = [];
		this.selected_group = null;
		this.selected_vertices = {};
		this.selected_faces = [null];
		this.textures = [];
		this.selected_texture = null;
		this.outliner = [];
		this.animations = [];
		this.timeline_animators = [];
		this.display_settings = {};

		ModelProject.all.push(this);

		ProjectData[this.uuid] = {
			model_3d: new THREE.Object3D(),
			materials: {},
			nodes_3d: {}
		}
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
			setProjectTitle(this._name);
		}
	}
	get model_3d() {
		return ProjectData[this.uuid].model_3d;
	}
	get materials() {
		return ProjectData[this.uuid].materials;
	}
	get nodes_3d() {
		return ProjectData[this.uuid].nodes_3d;
	}
	reset() {
		return;
		//if (isApp) updateRecentProjectThumbnail();

		//Blockbench.dispatchEvent('reset_project');
		
		//if (isApp) BedrockEntityManager.reset();

		//if (Toolbox.selected.id !== 'move_tool') BarItems.move_tool.select();
	
		Screencam.stopTimelapse();
	
		//Format = 0;
		/*
		for (var uuid in OutlinerNode.uuids) {
			delete OutlinerNode.uuids[uuid];
		}
		Outliner.elements.empty();
		Outliner.root.purge();
		for (var key in Canvas.materials) {
			delete Canvas.materials[key];
		}
		for (var key in Project.nodes_3d) {
			delete Project.nodes_3d[key];
		}*/
		//selected.empty();
		//Group.all.empty();
		//Group.selected = undefined;
		//Cube.all.empty();
		//Cube.selected.empty();
		//Locator.all.empty();
		//Locator.selected.empty();
		//Texture.all.empty();
		//Texture.selected = undefined;
	
		//for (var key in ModelProject.properties) {
		//	ModelProject.properties[key].reset(this)
		//}
		//this.texture_width = this.texture_height = 16;
		//this.overrides = null;
	
		//Blockbench.display_settings = display = {};
		//Project.save_path = Project.export_path = Project.name = '';
		//Project.saved = true;
		Prop.added_models = 0;
		//Canvas.updateAll();
		//Outliner.vue.$forceUpdate();
		//Interface.Panels.textures.inside_vue.$forceUpdate();
		//Undo.history.empty();
		//Undo.index = 0;
		//Undo.current_save = null;
		//Painter.current = {};
		//Animator.animations.purge();
		//Timeline.animators.purge();
		//Animation.selected = undefined;
		//delete Animator.motion_trail_lock;
		//$('#var_placeholder_area').val('');
	}
	openSettings() {
		BarItems.project_window.click();
	}
	whenNextOpen(callback) {
		if (Project == this) {
			callback();
		} else {
			if (!this.on_next_upen) this.on_next_upen = [];
			this.on_next_upen.push(callback);
		}
	}
	select() {
		if (this.selected) return;
		if (Project) {
			Project.unselect()
		} else {
			Interface.tab_bar.new_tab.visible = false;
		}
		Project = this;
		Undo = this.undo;
		this.selected = true;
		this.format.select();

		// Setup Data
		OutlinerNode.uuids = {};
		this.elements.forEach(el => {
			OutlinerNode.uuids[el.uuid] = el;
		})
		this.groups.forEach(group => {
			OutlinerNode.uuids[group.uuid] = group;
		})
		Outliner.root = this.outliner;
		Interface.Panels.outliner.inside_vue.root = this.outliner;

		UVEditor.vue.elements = this.selected_elements;
		UVEditor.vue.all_elements = this.elements;
		UVEditor.vue.selected_vertices = this.selected_vertices;
		UVEditor.vue.selected_faces = this.selected_faces;
		UVEditor.vue.box_uv = this.box_uv;

		Interface.Panels.textures.inside_vue.textures = Texture.all;
		scene.add(this.model_3d);

		Interface.Panels.animations.inside_vue.animations = this.animations;
		Animation.selected = null;
		let selected_anim = this.animations.find(anim => anim.selected);
		if (selected_anim) selected_anim.select();
		Timeline.animators = this.timeline_animators;
		Timeline.vue.animators = this.timeline_animators;

		Interface.Panels.variable_placeholders.inside_vue.text = this.variable_placeholders.toString();

		Modes.options[this.mode].select();

		BarItems.lock_motion_trail.value = !!Project.motion_trail_lock;
		BarItems.lock_motion_trail.updateEnabledState();

		if (this.EditSession) {
			Interface.Panels.chat.inside_vue.chat_history = this.EditSession.chat_history;
			this.EditSession.catchUp();
		}

		Blockbench.dispatchEvent('select_project', {project: this});

		setProjectTitle(this.name);
		setStartScreen(!Project);
		updateInterface();
		updateProjectResolution();
		Vue.nextTick(() => {
			loadTextureDraggable();

			if (this.on_next_upen instanceof Array) {
				this.on_next_upen.forEach(callback => callback());
				delete this.on_next_upen;
			}
		})
	}
	unselect() {
		if (isApp) updateRecentProjectThumbnail();
		this.thumbnail = Preview.selected.canvas.toDataURL();

		this.selected = false;
		Painter.current = {};
		scene.remove(this.model_3d);
		OutlinerNode.uuids = {};
		Format = 0;
		Project = 0;
		Undo = 0;

		OutlinerNode.uuids = {};
		Outliner.root = [];

		Blockbench.dispatchEvent('unselect_project', {project: this});
	}
	async close(force) {

		if (force || showSaveDialog()) {
			if (isApp) await updateRecentProjectThumbnail();
	
			Blockbench.dispatchEvent('close_project');
			
			this.unselect();
			Texture.all.forEach(tex => tex.stopWatcher());

			ModelProject.all.remove(this);
			delete ProjectData[this.uuid];
			Project = 0;

			if (ModelProject.all.length) {
				ModelProject.all[0].select();
			} else {
				Interface.tab_bar.new_tab.visible = true;
				Interface.tab_bar.new_tab.select();
				setStartScreen(true);
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
	condition: {formats: ['java_block']
}});
new Property(ModelProject, 'string', 'geometry_name', {
	label: 'dialog.project.geoname',
	condition: () => Format.bone_rig
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
new Property(ModelProject, 'string', 'variable_placeholders', {
	exposed: false,
});
new Property(ModelProject, 'number', 'shadow_size', {
	label: 'dialog.project.shadow_size',
	condition: {formats: ['optifine_entity']}
});


ModelProject.all = [];


let Project = 0;// = new ModelProject();

let ProjectData = {};

function newProject(format) {
	if (typeof format == 'string' && Formats[format]) format = Formats[format];
	new ModelProject({format}).select();

	Modes.options.edit.select();
	Blockbench.dispatchEvent('new_project');
	return true;
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

			} else if (Project.box_uv) {
				element.uv_offset[axis] *= multiplier[axis];
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
	Undo.finishEdit('Changed project resolution')
	Canvas.updateAllUVs()
	if (selected.length) {
		UVEditor.loadData()
	}
}
function updateProjectResolution() {
	if (Interface.Panels.uv) {
		UVEditor.vue.project_resolution.replace([Project.texture_width, Project.texture_height]);
	}
	if (Texture.selected) {
		// Update animated textures
		Texture.selected.height++;
		Texture.selected.height--;
	}
}

function setStartScreen(state) {
	document.getElementById('start_screen').style.display = state ? 'block' : 'none';
	document.getElementById('work_screen').style.display = state ? 'none' : 'grid';
}

onVueSetup(() => {
	Interface.tab_bar = new Vue({
		el: '#tab_bar',
		data: {
			projects: ModelProject.all,
			drag_target_index: null,
			drag_position_index: null,
			close_tab_label: tl('projects.close_tab'),
			search_tabs_label: tl('generic.search'),
			new_tab: {
				name: tl('projects.new_tab'),
				saved: true,
				selected: true,
				uuid: guid(),
				visible: true,
				is_new_tab: true,
				close: () => {
					Interface.tab_bar.new_tab.visible = false;
				},
				select() {
					if (Project) {
						Project.unselect()
					}
					Project = 0;
					Interface.tab_bar.new_tab.selected = true;
					setProjectTitle(tl('projects.new_tab'));
				},
				openSettings() {}
			}
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
				this.new_tab.visible = true;
				this.new_tab.select();
				setStartScreen(true);
			},
			searchTabs() {
				ActionControl.select('tab:');
			},
			mouseDown(tab, e1) {
				convertTouchEvent(e1);
				e1.preventDefault();
				
				if (this.thumbnail) {
					this.thumbnail.remove();
					delete this.thumbnail;
				}
				if (e1.button == 1) return;
				
				let scope = this;
				let active = false;
				let timeout;
				let last_event = e1;

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

					if (active && !open_menu) {
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
				if (e1.button === 1) {
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
			}
		}
	})
})


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
					
					for (var key in ModelProject.properties) {
						ModelProject.properties[key].merge(Project, formResult);
					}

					if (save) {
						Undo.finishEdit('Change project UV settings')
					}

					Blockbench.dispatchEvent('update_project_settings', formResult);

					BARS.updateConditions()
					if (Project.EditSession) {
						Project.EditSession.sendAll('change_project_meta', JSON.stringify(Project));
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
	new Action('convert_project', {
		icon: 'fas.fa-file-import',
		category: 'file',
		condition: () => Project && (!Project.EditSession || Project.EditSession.hosting),
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