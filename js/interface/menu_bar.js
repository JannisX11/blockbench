class BarMenu extends Menu {
	constructor(id, structure, options = {}) {
		super(id, structure, options)
		var scope = this;
		MenuBar.menus[id] = this
		this.type = 'bar_menu'
		this.id = id
		this.children = [];
		this.condition = options.condition
		this.node = $('<ul class="contextMenu"></ul>')[0]
		this.node.style.minHeight = '8px';
		this.node.style.minWidth = '150px';
		this.name = tl(options.name || `menu.${id}`);
		this.label = Interface.createElement('li', {class: 'menu_bar_point'}, this.name);
		this.label.addEventListener('click', (event) => {
			if (open_menu === scope) {
				if (event instanceof PointerEvent == false) {
					scope.hide()
				}
			} else {
				scope.open()
			}
		})
		this.label.addEventListener('mouseenter', (event) => {
			if (MenuBar.open && MenuBar.open !== scope) {
				scope.open()
			}
		})
		this.structure = structure;
		this.highlight_action = null;
	}
	hide() {
		super.hide();
		$(this.label).removeClass('opened');
		MenuBar.open = undefined;
		this.highlight_action = null;
		this.label.classList.remove('highlighted');
		return this;
	}
	highlight(action) {
		this.highlight_action = action;
		this.label.classList.add('highlighted');
	}
}

const MenuBar = {
	menus: {},
	open: undefined,
	setup() {
		MenuBar.menues = MenuBar.menus;
		new BarMenu('file', [
			'project_window',
			'_',
			{name: 'menu.file.new', id: 'new', icon: 'insert_drive_file',
				children: function() {
					let arr = [];
					let redact = settings.streamer_mode.value;
					for (let key in Formats) {
						let format = Formats[key];
						if (!format.show_in_new_list) continue;
						arr.push({
							id: format.id,
							name: (redact && format.confidential) ? `[${tl('generic.redacted')}]` : format.name,
							icon: format.icon,
							description: format.description,
							click: (e) => {
								format.new()
							}
						})
					}
					arr.push('_');
					for (let key in ModelLoader.loaders) {
						let loader = ModelLoader.loaders[key];
						arr.push({
							id: loader.id,
							name: (redact && loader.confidential) ? `[${tl('generic.redacted')}]` : loader.name,
							icon: loader.icon,
							description: loader.description,
							click: (e) => {
								loader.new()
							}
						})
					}
					return arr;
				}
			},
			{name: 'menu.file.recent', id: 'recent', icon: 'history',
				condition() {return isApp && recent_projects.length},
				searchable: true,
				children() {
					var arr = []
					let redact = settings.streamer_mode.value;
					for (let p of recent_projects) {
						if (arr.length > 12) break;
						arr.push({
							name: redact ? `[${tl('generic.redacted')}]` : p.name,
							path: p.path,
							description: redact ? '' : p.path,
							icon: p.icon,
							click(c, event) {
								Blockbench.read([p.path], {}, files => {
									loadModelFile(files[0]);
								})
							}
						})
					}
					if (recent_projects.length > 12) {
						arr.push('_', {
							name: 'menu.file.recent.more',
							icon: 'read_more',
							always_show: true,
							click(c, event) {
								ActionControl.select('recent: ');
							}
						})
					}
					if (arr.length) {
						arr.push('_', {
							name: 'menu.file.recent.clear',
							icon: 'clear',
							always_show: true,
							click(c, event) {
								recent_projects.empty();
								updateRecentProjects();
							}
						})
					}
					return arr
				}
			},
			'open_model',
			'open_from_link',
			'new_window',
			'_',
			'save_project',
			'save_project_as',
			'convert_project',
			'close_project',
			'_',
			{name: 'menu.file.import', id: 'import', icon: 'insert_drive_file', condition: () => Format && !Format.pose_mode, children: [
				{
					id: 'import_open_project',
					name: 'menu.file.import.import_open_project',
					icon: 'input',
					condition: () => Project && ModelProject.all.length > 1,
					children() {
						let projects = [];
						ModelProject.all.forEach(project => {
							if (project == Project) return;
							projects.push({
								name: project.getDisplayName(),
								icon: project.format.icon,
								description: project.path,
								click() {
									let current_project = Project;
									project.select();
									let bbmodel = Codecs.project.compile();
									current_project.select();
									Codecs.project.merge(JSON.parse(bbmodel));
								}
							})
						})
						return projects;
					}
				},
				'import_project',
				'import_java_block_model',
				'import_optifine_part',
				'import_obj',
				'extrude_texture'
			]},
			{name: 'generic.export', id: 'export', icon: 'insert_drive_file', children: [
				'export_blockmodel',
				'export_bedrock',
				'export_entity',
				'export_class_entity',
				'export_optifine_full',
				'export_optifine_part',
				'export_minecraft_skin',
				'export_gltf',
				'export_obj',
				'export_fbx',
				'export_collada',
				'upload_sketchfab',
				'share_model',
			]},
			'export_over',
			'export_asset_archive',
			'_',
			{name: 'menu.file.preferences', id: 'preferences', icon: 'tune', children: [
				'settings_window',
				'keybindings_window',
				'theme_window',
			]},
			'plugins_window',
			'edit_session'
		])
		new BarMenu('edit', [
			'undo',
			'redo',
			'edit_history',
			'_',
			'add_cube',
			'add_mesh',
			'add_group',
			'add_locator',
			'add_null_object',
			'add_texture_mesh',
			'_',
			'duplicate',
			'rename',
			'find_replace',
			'unlock_everything',
			'delete',
			'_',
			{name: 'data.mesh', id: 'mesh', icon: 'fa-gem', children: [
				'extrude_mesh_selection',
				'inset_mesh_selection',
				'loop_cut',
				'create_face',
				'invert_face',
				'merge_vertices',
				'dissolve_edges',
				'split_mesh',
				'merge_meshes',
			]},
			'_',
			'select_window',
			'select_all',
			'unselect_all',
			'invert_selection'
		])
		new BarMenu('transform', [
			'scale',
			{name: 'menu.transform.rotate', id: 'rotate', icon: 'rotate_90_degrees_ccw', children: [
				'rotate_x_cw',
				'rotate_x_ccw',
				'rotate_y_cw',
				'rotate_y_ccw',
				'rotate_z_cw',
				'rotate_z_ccw'
			]},
			{name: 'menu.transform.flip', id: 'flip', icon: 'flip', children: [
				'flip_x',
				'flip_y',
				'flip_z'
			]},
			{name: 'menu.transform.center', id: 'center', icon: 'filter_center_focus', children: [
				'center_x',
				'center_y',
				'center_z',
				'center_lateral'
			]},
			{name: 'menu.transform.properties', id: 'properties', icon: 'navigate_next', children: [
				'toggle_visibility',
				'toggle_locked',
				'toggle_export',
				'toggle_autouv',
				'toggle_shade',
				'toggle_mirror_uv'
			]}

		], {
			condition: {modes: ['edit']}
		})

		new BarMenu('uv', UVEditor.menu.structure, {
			condition: {modes: ['edit']},
			onOpen() {
				setActivePanel('uv');
			}
		})

		new BarMenu('texture', [
			'adjust_brightness_contrast',
			'adjust_saturation_hue',
			'adjust_opacity',
			'invert_colors',
			'adjust_curves',
			'_',
			'flip_texture_x',
			'flip_texture_y',
			'rotate_texture_cw',
			'rotate_texture_ccw',
			'resize_texture'
		], {
			condition: {modes: ['paint']}
		})

		new BarMenu('animation', [
			'add_marker',
			'lock_motion_trail',
			'_',
			'select_effect_animator',
			'flip_animation',
			'bake_animation_into_model',
			'_',
			'load_animation_file',
			'save_all_animations',
			'export_animation_file'
		], {
			condition: {modes: ['animate']}
		})

		new BarMenu('keyframe', [
			'copy',
			'paste',
			'_',
			'add_keyframe',
			'keyframe_column_create',
			'select_all',
			'keyframe_column_select',
			'reverse_keyframes',
			{name: 'menu.animation.flip_keyframes', id: 'flip_keyframes', condition: () => Timeline.selected.length, icon: 'flip', children: [
				'flip_x',
				'flip_y',
				'flip_z'
			]},
			'keyframe_uniform',
			'reset_keyframe',
			'resolve_keyframe_expressions',
			'delete',
		], {
			condition: {modes: ['animate']}
		})

		new BarMenu('display', [
			'copy',
			'paste',
			'_',
			'add_display_preset',
			'apply_display_preset'
		], {
			condition: {modes: ['display']}
		})
		
		new BarMenu('tools', [
			{id: 'main_tools', icon: 'construction', name: 'Toolbox', condition: () => Project, children() {
				let tools = Toolbox.children.filter(tool => tool instanceof Tool && tool.condition !== false);
				tools.forEach(tool => {
					let old_condition = tool.condition;
					tool.condition = () => {
						tool.condition = old_condition;
						return true;
					}
				})
				let modes = Object.keys(Modes.options);
				tools.sort((a, b) => modes.indexOf(a.modes[0]) - modes.indexOf(b.modes[0]))
				let mode = tools[0].modes[0];
				for (let i = 0; i < tools.length; i++) {
					if (tools[i].modes[0] !== mode) {
						mode = tools[i].modes[0];
						tools.splice(i, 0, '_');
						i++;
					}
				}
				return tools;
			}},
			'swap_tools',
			'action_control',
			'_',
			'predicate_overrides',
			'convert_to_mesh',
			'auto_set_cullfaces',
			'remove_blank_faces',
		])
		MenuBar.menus.filter = MenuBar.menus.tools;

		new BarMenu('view', [
			'fullscreen',
			'_',
			'view_mode',
			'preview_scene',
			'toggle_shading',
			'toggle_motion_trails',
			'toggle_ground_plane',
			'preview_checkerboard',
			'painting_grid',
			'_',
			'toggle_sidebars',
			'toggle_quad_view',
			'hide_everything_except_selection',
			'focus_on_selection',
			{name: 'menu.view.screenshot', id: 'screenshot', icon: 'camera_alt', children: [
				'screenshot_model',
				'screenshot_app',
				'record_model_gif',
				'timelapse',
			]},
		])
		new BarMenu('help', [
			{name: 'menu.help.search_action', description: BarItems.action_control.description, keybind: BarItems.action_control.keybind, id: 'search_action', icon: 'search', click: ActionControl.select},
			'_',
			{name: 'menu.help.discord', id: 'discord', icon: 'fab.fa-discord', click: () => {
				Blockbench.openLink('http://discord.blockbench.net');
			}},
			{name: 'menu.help.quickstart', id: 'quickstart', icon: 'fas.fa-directions', click: () => {
				Blockbench.openLink('https://blockbench.net/quickstart/');
			}},
			{name: 'menu.help.wiki', id: 'wiki', icon: 'menu_book', click: () => {
				Blockbench.openLink('https://blockbench.net/wiki/');
			}},
			{name: 'menu.help.report_issue', id: 'report_issue', icon: 'bug_report', click: () => {
				Blockbench.openLink('https://github.com/JannisX11/blockbench/issues');
			}},
			'_',
			'open_backup_folder',
			'_',
			{name: 'menu.help.developer', id: 'developer', icon: 'fas.fa-wrench', children: [
				'reload_plugins',
				{name: 'menu.help.plugin_documentation', id: 'plugin_documentation', icon: 'fa-book', click: () => {
					Blockbench.openLink('https://www.blockbench.net/wiki/api/index');
				}},
				'open_dev_tools',
				{name: 'Error Log', condition: () => window.ErrorLog.length, icon: 'error', color: 'red', keybind: {toString: () => window.ErrorLog.length.toString()}, click() {
					let lines = window.ErrorLog.slice(0, 64).map((error) => {
						return Interface.createElement('p', {}, `${error.message}\n - In .${error.file.split(location.origin).join('')} : ${error.line}`);
					})
					new Dialog({
						id: 'error_log',
						title: 'Error Log',
						lines,
						singleButton: true
					}).show();
				}},
				{name: 'menu.help.developer.reset_storage', icon: 'fas.fa-hdd', click: () => {
					if (confirm(tl('menu.help.developer.reset_storage.confirm'))) {
						localStorage.clear()
						Blockbench.addFlag('no_localstorage_saving')
						console.log('Cleared Local Storage')
						window.location.reload(true)
					}
				}},
				{name: 'menu.help.developer.unlock_projects', id: 'unlock_projects', icon: 'vpn_key', condition: () => ModelProject.all.find(project => project.locked), click() {
					ModelProject.all.forEach(project => project.locked = false);
				}},
				{name: 'menu.help.developer.cache_reload', id: 'cache_reload', icon: 'cached', condition: !isApp, click: () => {
					if('caches' in window){
						caches.keys().then((names) => {
							names.forEach(async (name) => {
								await caches.delete(name)
							})
						})
					}
					window.location.reload(true)
				}},
				'reload',
			]},
			{name: 'menu.help.donate', id: 'donate', icon: 'fas.fa-hand-holding-usd', click: () => {
				Blockbench.openLink('https://blockbench.net/donate/');
			}},
			'about_window'
		])
		MenuBar.update()
	},
	update() {
		var bar = $('#menu_bar')
		bar.children().detach()
		this.keys = []
		for (var menu in MenuBar.menus) {
			if (MenuBar.menus.hasOwnProperty(menu)) {
				if (MenuBar.menus[menu].conditionMet()) {
					bar.append(MenuBar.menus[menu].label)
					this.keys.push(menu)
				}
			}
		}
	},
	addAction(action, path) {
		if (path) {
			path = path.split('.')
			var menu = MenuBar.menus[path.splice(0, 1)[0]]
			if (menu) {
				menu.addAction(action, path.join('.'))
			}
		}
	},
	removeAction(path) {
		if (path) {
			path = path.split('.')
			var menu = MenuBar.menus[path.splice(0, 1)[0]]
			if (menu) {
				menu.removeAction(path.join('.'))
			}
		}
	}
}
