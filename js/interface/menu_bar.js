class BarMenu extends Menu {
	constructor(id, structure, options = {}) {
		super(id, structure, options)
		MenuBar.menus[id] = this
		this.type = 'bar_menu'
		this.id = id
		this.children = [];
		this.condition = options.condition
		this.node = document.createElement('ul');
		this.node.className = 'contextMenu menu_bar_menu';
		this.node.style.minHeight = '8px';
		this.node.style.minWidth = '150px';
		this.icon = options.icon;
		this.name = tl(options.name || `menu.${id}`);
		this.label = Interface.createElement('li', {class: 'menu_bar_point'}, this.name);
		this.label.addEventListener('click', (event) => {
			if (open_menu === this) {
				this.hide()
			} else {
				this.open()
			}
		})
		this.label.addEventListener('mouseenter', (event) => {
			if (MenuBar.open && MenuBar.open !== this) {
				this.open()
			}
		})
		this.structure = structure;
		this.highlight_action = null;
	}
	open(...args) {
		super.open(...args);
		Blockbench.dispatchEvent('open_bar_menu', {menu: this});
	}
	hide() {
		super.hide();
		$(this.label).removeClass('opened');
		MenuBar.open = undefined;
		this.highlight_action = null;
		this.label.classList.remove('highlighted');
		if (MenuBar.last_opened == this) document.getElementById('mobile_menu_bar')?.remove();
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
	last_opened: null,
	setup() {
		MenuBar.menues = MenuBar.menus;
		new BarMenu('file', [
			new MenuSeparator('file_options'),
			'project_window',
			new MenuSeparator('open'),
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
					arr.push(new MenuSeparator('loaders'));
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
			new MenuSeparator('project'),
			'save_project',
			'save_project_as',
			'save_project_incremental',
			'convert_project',
			'close_project',
			new MenuSeparator('import_export'),
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
			{name: 'generic.export', id: 'export', icon: 'insert_drive_file', condition: () => Project, children: [
				'export_blockmodel',
				'export_bedrock',
				'export_entity',
				'export_class_entity',
				'export_optifine_full',
				'export_optifine_part',
				'export_minecraft_skin',
				'export_image',
				'export_gltf',
				'export_obj',
				'export_fbx',
				'export_collada',
				'export_modded_animations',
				'upload_sketchfab',
				'share_model',
			]},
			'export_over',
			'export_asset_archive',
			new MenuSeparator('options'),
			{name: 'menu.file.preferences', id: 'preferences', icon: 'tune', children: [
				'settings_window',
				'keybindings_window',
				'theme_window',
				{
					id: 'profiles',
					name: 'data.settings_profile',
					icon: 'manage_accounts',
					condition: () => SettingsProfile.all.findIndex(p => p.condition.type == 'selectable') != -1,
					children: () => {
						let list = [
							{
								name: 'generic.none',
								icon: SettingsProfile.selected ? 'far.fa-circle' : 'far.fa-dot-circle',
								click: () => {
									SettingsProfile.unselect();
								}
							},
							'_'
						];
						SettingsProfile.all.forEach(profile => {
							if (profile.condition.type != 'selectable') return;
							list.push({
								name: profile.name,
								icon: profile.selected ? 'far.fa-dot-circle' : 'far.fa-circle',
								color: markerColors[profile.color].standard,
								click: () => {
									profile.select();
								}
							})
						})
						return list;
					}
				}
			]},
			'plugins_window',
			'edit_session'
		], {icon: 'draft'})
		new BarMenu('edit', [
			new MenuSeparator('undo'),
			'undo',
			'redo',
			'edit_history',
			new MenuSeparator('add_element'),
			'add_cube',
			'add_mesh',
			'add_group',
			'add_locator',
			'add_null_object',
			'add_texture_mesh',
			new MenuSeparator('modify_elements'),
			'duplicate',
			'rename',
			'find_replace',
			'unlock_everything',
			'delete',
			'apply_mirror_modeling',
			new MenuSeparator('mesh_specific'),
			new MenuSeparator('editing_mode'),
			'proportional_editing',
			'mirror_modeling',
			new MenuSeparator('selection'),
			'select_window',
			'select_all',
			'unselect_all',
			'invert_selection'
		], {icon: 'edit'})
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
			icon: 'open_with',
			condition: {modes: ['edit']},
		})
		new BarMenu('mesh', [
			new MenuSeparator('geometry'),
			'extrude_mesh_selection',
			'inset_mesh_selection',
			'loop_cut',
			'create_face',
			'invert_face',
			'switch_face_crease',
			'merge_vertices',
			'dissolve_edges',
			'solidify_mesh_selection',
			new MenuSeparator('element'),
			'apply_mesh_rotation',
			'split_mesh',
			'merge_meshes',
		], {icon: 'fa-gem', condition: {selected: {mesh: true}, modes: ['edit']}})

		new BarMenu('uv', UVEditor.menu.structure, {
			condition: {modes: ['edit']},
			icon: 'photo_size_select_large',
			onOpen() {
				setActivePanel('uv');
			}
		})

		new BarMenu('image', [
			new MenuSeparator('adjustment'),
			'adjust_brightness_contrast',
			'adjust_saturation_hue',
			'adjust_opacity',
			'invert_colors',
			'adjust_curves',
			new MenuSeparator('filters'),
			'limit_to_palette',
			'split_rgb_into_layers',
			'clear_unused_texture_space',
			new MenuSeparator('transform'),
			'flip_texture_x',
			'flip_texture_y',
			'rotate_texture_cw',
			'rotate_texture_ccw',
			'resize_texture',
			'crop_texture_to_selection'
		], {
			icon: 'image',
			condition: {modes: ['paint']}
		})

		new BarMenu('animation', [
			new MenuSeparator('edit_options'),
			'animation_onion_skin',
			'animation_onion_skin_selective',
			'toggle_motion_trails',
			'lock_motion_trail',
			new MenuSeparator('edit'),
			'add_marker',
			'select_effect_animator',
			'flip_animation',
			'optimize_animation',
			'retarget_animators',
			'bake_ik_animation',
			'bake_animation_into_model',
			'merge_animation',
			new MenuSeparator('file'),
			'load_animation_file',
			'save_all_animations',
			'export_animation_file'
		], {
			icon: 'movie',
			condition: {modes: ['animate']}
		})

		new BarMenu('keyframe', [
			new MenuSeparator('copypaste'),
			'copy',
			'paste',
			new MenuSeparator('edit'),
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
			icon: 'icon-keyframe',
			condition: {modes: ['animate']}
		})

		new BarMenu('timeline', Timeline.menu.structure, {
			name: 'panel.timeline',
			icon: 'timeline',
			condition: {modes: ['animate'], method: () => !AnimationController.selected},
			onOpen() {
				setActivePanel('timeline');
			}
		})

		new BarMenu('display', [
			new MenuSeparator('copypaste'),
			'copy',
			'paste',
			new MenuSeparator('presets'),
			'add_display_preset',
			'apply_display_preset'
		], {
			icon: 'tune',
			condition: {modes: ['display']}
		})
		
		new BarMenu('tools', [
			new MenuSeparator('overview'),
			{id: 'main_tools', icon: 'construction', name: 'menu.tools.main_tools', condition: () => Project, children() {
				let tools = Toolbox.children.filter(tool => tool instanceof Tool && tool.condition !== false);
				tools.forEach(tool => {
					let old_condition = tool.condition;
					tool.condition = () => {
						tool.condition = old_condition;
						return true;
					}
				})
				let modes = Object.keys(Modes.options);
				tools.sort((a, b) => {
					return (a.modes ? modes.indexOf(a.modes[0]) : -1) - (b.modes ? modes.indexOf(b.modes[0]) : -1);
				})
				let mode = tools[0].modes?.[0];
				for (let i = 0; i < tools.length; i++) {
					if (tools[i].modes?.[0] !== mode) {
						mode = tools[i].modes?.[0];
						tools.splice(i, 0, '_');
						i++;
					}
				}
				return tools;
			}},
			'swap_tools',
			'action_control',
			new MenuSeparator('tools'),
			'predicate_overrides',
			'convert_to_mesh',
			'auto_set_cullfaces',
			'remove_blank_faces',
		], {icon: 'handyman'})
		MenuBar.menus.filter = MenuBar.menus.tools;

		new BarMenu('view', [
			new MenuSeparator('window'),
			'fullscreen',
			new MenuSeparator('interface'),
			{
				id: 'panels',
				name: 'menu.view.panels',
				icon: 'web_asset',
				children() {
					let entries = [];
					for (let id in Panels) {
						let panel = Panels[id];
						if (!Condition(panel.condition)) continue;
						let menu_entry = {
							id,
							name: panel.name,
							icon: panel.icon,
							children: [
								{
									id: 'move_to',
									name: panel.slot == 'hidden' ? 'menu.panel.enable' : 'menu.panel.move_to',
									icon: 'drag_handle',
									context: panel,
									children: panel.snap_menu.structure
								},
								{
									id: 'fold',
									name: 'menu.panel.fold',
									icon: panel.folded == true,
									condition: panel.slot != 'hidden',
									click() {
										panel.fold();
									}
								}
							]
						}
						entries.push(menu_entry);
					}
					return entries;
				}
			},
			'toggle_sidebars',
			'split_screen',
			new MenuSeparator('viewport'),
			'view_mode',
			'toggle_shading',
			'toggle_all_grids',
			'toggle_ground_plane',
			'preview_checkerboard',
			'pixel_grid',
			'painting_grid',
			new MenuSeparator('references'),
			'bedrock_animation_mode',
			'preview_scene',
			'edit_reference_images',
			new MenuSeparator('model'),
			'hide_everything_except_selection',
			'focus_on_selection',
			{name: 'menu.view.screenshot', id: 'screenshot', icon: 'camera_alt', children: []},
			new MenuSeparator('media'),
			'screenshot_model',
			'screenshot_app',
			'advanced_screenshot',
			'record_model_gif',
			'timelapse',
		], {icon: 'visibility'})
		new BarMenu('help', [
			new MenuSeparator('search'),
			{name: 'menu.help.search_action', description: BarItems.action_control.description, keybind: BarItems.action_control.keybind, id: 'search_action', icon: 'search', click: ActionControl.select},
			new MenuSeparator('links'),
			{name: 'menu.help.quickstart', id: 'quickstart', icon: 'fas.fa-directions', click: () => {
				Blockbench.openLink('https://blockbench.net/quickstart/');
			}},
			{name: 'menu.help.discord', id: 'discord', icon: 'fab.fa-discord', condition: () => (!settings.classroom_mode.value), click: () => {
				Blockbench.openLink('http://discord.blockbench.net');
			}},
			{name: 'menu.help.wiki', id: 'wiki', icon: 'menu_book', click: () => {
				Blockbench.openLink('https://blockbench.net/wiki/');
			}},
			{name: 'menu.help.report_issue', id: 'report_issue', icon: 'bug_report', click: () => {
				Blockbench.openLink('https://github.com/JannisX11/blockbench/issues');
			}},
			new MenuSeparator('backups'),
			'view_backups',
			new MenuSeparator('about'),
			{name: 'menu.help.developer', id: 'developer', icon: 'fas.fa-wrench', children: [
				'reload_plugins',
				{name: 'menu.help.plugin_documentation', id: 'plugin_documentation', icon: 'fa-book', click: () => {
					Blockbench.openLink('https://www.blockbench.net/wiki/docs/plugin');
				}},
				'open_dev_tools',
				{name: 'Error Log', condition: () => window.ErrorLog.length, icon: 'error', color: 'red', keybind: {toString: () => window.ErrorLog.length.toString()}, click() {
					let lines = window.ErrorLog.slice(0, 64).map((error) => {
						return Interface.createElement('p', {style: 'word-break: break-word;'}, `${error.message}\n - In .${error.file.split(location.origin).join('')} : ${error.line}`);
					})
					new Dialog({
						id: 'error_log',
						title: 'Error Log',
						lines,
						singleButton: true
					}).show();
				}},
				{name: 'menu.help.developer.reset_storage', icon: 'fas.fa-hdd', click: () => {
					factoryResetAndReload();
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
			'reset_layout',
			'about_window'
		], {icon: 'help'})
		MenuBar.update();

		if (Blockbench.isMobile) {
			let header = document.querySelector('header');
			document.getElementById('menu_bar').remove();
			document.getElementById('header_free_bar').remove();
			document.getElementById('corner_logo').remove();

			let menu_button = Interface.createElement('div', {class: 'tool'}, Blockbench.getIconNode('menu'));
			menu_button.addEventListener('click', event => {
				MenuBar.openMobile(menu_button, event);
			})
			let search_button = Interface.createElement('div', {class: 'tool'}, Blockbench.getIconNode('search'));
			search_button.addEventListener('click', event => {
				ActionControl.select()
			})
			let undo_button = Interface.createElement('div', {class: 'tool'}, Blockbench.getIconNode('undo'));
			undo_button.addEventListener('click', event => {
				BarItems.undo.trigger()
			})
			let redo_button = Interface.createElement('div', {class: 'tool'}, Blockbench.getIconNode('redo'));
			redo_button.addEventListener('click', event => {
				BarItems.redo.trigger()
			})
			let mode_switcher = Interface.createElement('div', {class: 'tool hidden', style: 'margin-left: auto'}, Blockbench.getIconNode('settings'));
			mode_switcher.addEventListener('click', event => {
				Modes.mobileModeMenu(mode_switcher, event);
			})
			MenuBar.mode_switcher_button = mode_switcher;

			let home_button = document.getElementById('title_bar_home_button');
			let profile_button = document.getElementById('settings_profiles_header_menu');

			let buttons = [menu_button, search_button, profile_button, home_button, undo_button, redo_button,, mode_switcher];
			buttons.forEach(button => {
				header.append(button);
			})

			header.addEventListener('touchstart', e1 => {
				convertTouchEvent(e1);
				let opened, bar, initial;
				let onMove = e2 => {
					convertTouchEvent(e2);
					let y_diff = e2.clientY - e1.clientY;
					if (y_diff > 16) {
						if (!opened) {
							bar = MenuBar.openMobile(menu_button);
							opened = true;
							initial = y_diff;
						}
					}
					if (bar) {
						bar.style.marginTop = Math.clamp(y_diff - 50, -60, 0)+'px';
						for (let node of bar.childNodes) {
							if (!node.bbOpenMenu) continue;
							let offset_center = bar.offsetLeft + node.offsetLeft + node.clientWidth/2;
							if (Math.abs(offset_center - e2.clientX) < 21) {
								node.bbOpenMenu(e2);
								break;
							}
						}
					}
				}
				let onStop = e2 => {
					document.removeEventListener('touchmove', onMove);
					document.removeEventListener('touchend', onStop);
					if (bar) {
						bar.style.marginTop = '0';
						convertTouchEvent(e2);
						let y_diff = e2.clientY - e1.clientY;
						if (y_diff < initial && MenuBar.open) {
							MenuBar.open.hide()
						}
					}
				}
				document.addEventListener('touchmove', onMove);
				document.addEventListener('touchend', onStop);
			})
		}
	},
	openMobile(button, event) {
		if (document.getElementById('mobile_menu_bar')) {
			document.getElementById('mobile_menu_bar').remove();
			return;
		}
		let label = Interface.createElement('label', {});
		let bar = Interface.createElement('div', {id: 'mobile_menu_bar'}, label);
		let menu_button_nodes = [];
		let menu_position;
		let setSelected = (node, menu) => {
			menu_button_nodes.forEach(n => n.classList.remove('selected'))
			node.classList.add('selected');
			label.innerText = menu.name;
		}
		for (let id in MenuBar.menus) {
			let menu = MenuBar.menus[id];
			if (id == 'filter') continue;
			if (!Condition(menu.condition)) continue;

			let node = Interface.createElement('div', {class: 'tool'}, Blockbench.getIconNode(menu.icon));
			let openMenu = event => {
				if (MenuBar.last_opened == menu) return;
				MenuBar.last_opened = MenuBar.open = menu;
				menu.open(menu_position);
				setSelected(node, menu);
			}
			addEventListeners(node, 'pointerdown touchmove', openMenu);
			node.bbOpenMenu = openMenu;

			menu_button_nodes.push(node);
			bar.append(node);
			if (MenuBar.last_opened == menu || (!MenuBar.last_opened && id == 'file')) {
				setTimeout(() => {
					MenuBar.last_opened = menu;
					menu.open(menu_position);
					setSelected(node, menu);
				}, 1)
			}
		}
		document.body.append(bar);
		menu_position = {
			clientX: bar.offsetLeft + 7,
			clientY: bar.offsetTop + bar.clientHeight - 1
		}
		return bar;
	},
	update() {
		if (!Blockbench.isMobile) {
			let bar = $(document.getElementById('menu_bar'));
			bar.children().detach();
			this.keys = [];
			for (var menu in MenuBar.menus) {
				if (MenuBar.menus.hasOwnProperty(menu)) {
					if (MenuBar.menus[menu].conditionMet()) {
						bar.append(MenuBar.menus[menu].label)
						this.keys.push(menu);
					}
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
