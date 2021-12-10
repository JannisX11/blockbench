var open_menu = null;

function handleMenuOverflow(node) {
	node = node.get(0);
	if (!node) return;
	// Todo: mobile support
	node.addEventListener('wheel', e => {
		e.stopPropagation();
		let top = parseInt(node.style.top);
		let offset = top - $(node).offset().top;
		top = Math.clamp(
			top - e.deltaY,
			window.innerHeight - node.clientHeight + offset,
			offset + 26
		);
		node.style.top = `${top}px`;
	})
}
class Menu {
	constructor(id, structure) {
		if (!structure) structure = id;
		this.id = typeof id == 'string' ? id : '';
		this.children = [];
		this.node = $('<ul class="contextMenu"></ul>')[0]
		this.structure = structure
	}
	hover(node, event) {
		if (event) event.stopPropagation()
		$(open_menu.node).find('li.focused').removeClass('focused')
		$(open_menu.node).find('li.opened').removeClass('opened')
		var obj = $(node)
		obj.addClass('focused')
		obj.parents('li.parent').addClass('opened')

		if (obj.hasClass('parent')) {
			var childlist = obj.find('> ul.contextMenu.sub')

			var p_width = obj.outerWidth()
			childlist.css('left', p_width + 'px')
			var el_width = childlist.width()
			var offset = childlist.offset()
			var el_height = childlist.height()

			if (offset.left + el_width > window.innerWidth) {
				if (Blockbench.isMobile) {
					childlist.css('visibility', 'hidden');
					setTimeout(() => {
						childlist.css('left', 0);
						childlist.css('visibility', 'visible');
					}, 100);
				} else {
					childlist.css('left', -el_width + 'px')
				}
			}

			let window_height = window.innerHeight - 26;

			if (el_height > window_height) {
				childlist.css('margin-top', '0').css('top', '0')
				childlist.css('top', (-childlist.offset().top + 26) + 'px')
				handleMenuOverflow(childlist);

			} else if (offset.top + el_height > window_height) {
				childlist.css('margin-top', 26-childlist.height() + 'px')
				if (childlist.offset().top < 26) {
					childlist.offset({top: 26})
				}
			}
		}
	}
	keyNavigate(e) {
		var scope = this;
		var used;
		var obj = $(this.node)
		if (e.which >= 37 && e.which <= 40) {

			let is_menu_bar = scope.type === 'bar_menu' && e.which%2;
			if (obj.find('li.focused').length || is_menu_bar) {
				var old = obj.find('li.focused'), next;
				switch (e.which) {
					case 37: next = old.parent('ul').parent('li'); 					break;//<
					case 38: next = old.prevAll('li:not(.menu_separator)').first(); break;//UP
					case 39: next = old.find('ul li:first-child'); 					break;//>
					case 40: next = old.nextAll('li:not(.menu_separator)').first(); break;//DOWN
				}

				if (!next.length && e.which%2 == 0) {
					var siblings = old.siblings('li:not(.menu_separator)')
					if (e.which === 38) {
						next = siblings.last()
					} else {
						next = siblings.first()
					}
				}
				if (next && next.length) {
					old.removeClass('focused')
					scope.hover(next.get(0))
				} else if (is_menu_bar) {
					var index = MenuBar.keys.indexOf(scope.id)
					index += (e.which == 39 ? 1 : -1)
					if (index < 0) {
						index = MenuBar.keys.length-1
					} else if (index >= MenuBar.keys.length) {
						index = 0;
					}
					MenuBar.menus[MenuBar.keys[index]].open()
				}
			} else {
				obj.find('> li:first-child').addClass('focused')
			}
			used = true;
		} else if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
			obj.find('li.focused').click()
			if (scope) {
				scope.hide()
			}
			used = true;
		} else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
			scope.hide()
			used = true;
		}
		return used;
	}
	open(position, context) {

		if (position && position.changedTouches) {
			convertTouchEvent(position);
		}
		var scope = this;
		var ctxmenu = $(this.node)
		if (open_menu) {
			open_menu.hide()
		}
		$('body').append(ctxmenu)

		ctxmenu.children().detach()

		function createChildList(object, node) {

			if (typeof object.children == 'function') {
				var list = object.children(context)
			} else {
				var list = object.children
			}
			if (list.length) {
				node.addClass('parent')
					.find('ul.contextMenu.sub').detach()
				var childlist = $('<ul class="contextMenu sub"></ul>')
				node.append(childlist)
				list.forEach(function(s2, i) {
					getEntry(s2, childlist)
				})
				var last = childlist.children().last()
				if (last.length && last.hasClass('menu_separator')) {
					last.remove()
				}
				return childlist.children().length;
			}
			return 0;
		}

		function getEntry(s, parent) {

			var entry;
			if (s === '_') {
				entry = new MenuSeparator().menu_node
				var last = parent.children().last()
				if (last.length && !last.hasClass('menu_separator')) {
					parent.append(entry)
				}
				return;
			}
			if (typeof s == 'string' && BarItems[s]) {
				s = BarItems[s];
			}
			if (!Condition(s.condition, context)) return;

			if (s instanceof Action) {

				entry = $(s.menu_node)

				entry.removeClass('focused')
				entry.off('click')
				entry.off('mouseenter mousedown')
				entry.on('mouseenter mousedown', function(e) {
					if (this == e.target) {
						scope.hover(this, e)
					}
				})
				//Submenu
				if (typeof s.children == 'function' || typeof s.children == 'object') {
					createChildList(s, entry)
				} else {
					entry.on('click', (e) => {s.trigger(e)})
				}

				parent.append(entry)

			} else if (s instanceof BarSelect) {
				
				if (typeof s.icon === 'function') {
					var icon = Blockbench.getIconNode(s.icon(context), s.color)
				} else {
					var icon = Blockbench.getIconNode(s.icon, s.color)
				}
				entry = $(`<li title="${s.description ? tl(s.description) : ''}" menu_item="${s.id}"><span>${tl(s.name)}</span></li>`)
				entry.prepend(icon)

				//Submenu
				var children = [];
				for (var key in s.options) {

					let val = s.options[key];
					if (val) {
						(function() {
							var save_key = key;
							children.push({
								name: s.getNameFor(key),
								id: key,
								icon: val.icon || ((s.value == save_key) ? 'far.fa-dot-circle' : 'far.fa-circle'),
								condition: val.condition,
								click: (e) => {
									s.set(save_key);
									if (s.onChange) {
										s.onChange(s, e);
									}
								}
							})
						})()
					}
				}

				let child_count = createChildList({children}, entry)

				if (child_count !== 0 || typeof s.click === 'function') {
					parent.append(entry)
				}
				entry.mouseenter(function(e) {
					scope.hover(this, e)
				})

			} else if (typeof s === 'object') {
				
				let child_count;
				if (typeof s.icon === 'function') {
					var icon = Blockbench.getIconNode(s.icon(context), s.color)
				} else {
					var icon = Blockbench.getIconNode(s.icon, s.color)
				}
				entry = $(`<li title="${s.description ? tl(s.description) : ''}" menu_item="${s.id}"><span>${tl(s.name)}</span></li>`);
				entry.prepend(icon);
				if (s.keybind) {
					let label = document.createElement('label');
					label.classList.add('keybinding_label')
					label.innerText = s.keybind || '';
					entry.append(label);
				}
				if (typeof s.click === 'function') {
					entry.click(e => {
						if (e.target == entry.get(0)) {
							s.click(context, e)
						}
					})
				}
				//Submenu
				if (typeof s.children == 'function' || typeof s.children == 'object') {
					child_count = createChildList(s, entry)
				}
				if (child_count !== 0 || typeof s.click === 'function') {
					parent.append(entry)
				}
				entry.mouseenter(function(e) {
					scope.hover(this, e)
				})
			}
			//Highlight
			if (scope.highlight_action == s && entry) {
				let obj = entry;
				while (obj[0] && obj[0].nodeName == 'LI') {
					obj.addClass('highlighted');
					obj = obj.parent().parent();
				}
			}
		}

		scope.structure.forEach(function(s, i) {
			getEntry(s, ctxmenu)
		})
		var last = ctxmenu.children().last()
		if (last.length && last.hasClass('menu_separator')) {
			last.remove()
		}

		var el_width = ctxmenu.width()
		var el_height = ctxmenu.height()
		let window_height = window.innerHeight - 26;

		if (position && position.clientX !== undefined) {
			var offset_left = position.clientX
			var offset_top  = position.clientY+1

		} else if (position == document.body) {
			var offset_left = (document.body.clientWidth-el_width)/2
			var offset_top  = (document.body.clientHeight-el_height)/2

		} else if (position == 'mouse') {
			var offset_left = mouse_pos.x;
			var offset_top  = mouse_pos.y;

		} else {
			if (!position && scope.type === 'bar_menu') {
				position = scope.label
			} else if (position && position.parentElement.classList.contains('tool')) {
				position = position.parentElement;
			}
			var offset_left = $(position).offset().left;
			var offset_top  = $(position).offset().top + position.clientHeight;
		}

		if (offset_left > window.innerWidth - el_width) {
			offset_left -= el_width
			if (position && position.clientWidth) offset_left += position.clientWidth;
			if (offset_left < 0) offset_left = 0;
		}
		if (offset_top  > window_height - el_height ) {
			offset_top -= el_height;
			if (position instanceof HTMLElement) {
				offset_top -= position.clientHeight;
			}
		}
		offset_top = Math.clamp(offset_top, 26)

		ctxmenu.css('left', offset_left+'px')
		ctxmenu.css('top',  offset_top +'px')

		if (el_height > window_height) {
			handleMenuOverflow(ctxmenu);
		}

		$(scope.node).on('click', (ev) => {
			if (
				ev.target.className.includes('parent') ||
				(ev.target.parentNode && ev.target.parentNode.className.includes('parent'))
			) {} else {
				scope.hide()
			}
		})

		if (scope.type === 'bar_menu') {
			MenuBar.open = scope
			$(scope.label).addClass('opened')
		}
		open_menu = scope;
		return scope;
	}
	show(position) {
		return this.open(position);
	}
	hide() {
		$(this.node).find('li.highlighted').removeClass('highlighted');
		$(this.node).detach()
		open_menu = null;
		return this;
	}
	conditionMet() {
		return Condition(this.condition);
	}
	addAction(action, path) {

		if (path === undefined) path = ''
		var track = path.split('.')

		function traverse(arr, layer) {
			if (track.length === layer || track[layer] === '' || !isNaN(parseInt(track[layer]))) {
				var index = arr.length;
				if (track[layer] !== '' && track.length !== layer) {
					index = parseInt(track[layer])
				}
				arr.splice(index, 0, action)
			} else {
				for (var i = 0; i < arr.length; i++) {
					var item = arr[i]
					if (item.children && item.children.length > 0 && item.id === track[layer] && layer < 20) {
						traverse(item.children, layer+1)
						i = 1000
					}
				}
			}
		}
		traverse(this.structure, 0)
		if (action && action.menus) {
			action.menus.push({menu: this, path});
		}
	}
	removeAction(path) {
		var scope = this;
		if (path instanceof Action) {
			let action = path;
			this.structure.remove(action);
			this.structure.remove(action.id);
			action.menus.remove(this);
		}
		if (path === undefined) path = '';
		if (typeof path == 'string') path = path.split('.');

		function traverse(arr, layer) {
			if (!isNaN(parseInt(path[layer]))) {
				result = arr[parseInt(path[layer])]

			} else if (typeof path[layer] === 'string') {
				var i = arr.length-1;
				while (i >= 0) {
					var item = arr[i]
					if (item.id === path[layer] && layer < 20) {
						if (layer === path.length-1) {
							var action = arr.splice(i, 1)[0]
							if (action instanceof Action) {
								for (var i = action.menus.length-1; i >= 0; i--) {
									if (action.menus[i].menu == scope) {
										action.menus.splice(i, 1)
									}
								}
							}
						} else if (item.children) {
							traverse(item.children, layer+1)
						}
					}
					i--;
				}
			}
		}
		traverse(this.structure, 0)
	}
	deleteItem(rm_item) {
		var scope = this;

		function traverse(arr, layer) {
			arr.forEachReverse((item, i) => {
				if (item === rm_item || item === rm_item.id) {
					arr.splice(i, 1)
				} else if (item && item.children instanceof Array) {
					traverse(item.children)
				}
			})
		}
		traverse(this.structure, 0)
		rm_item.menus.remove(scope)
	}
}
class BarMenu extends Menu {
	constructor(id, structure, options = {}) {
		super()
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
		this.label = $(`<li class="menu_bar_point">${this.name}</li>`)[0]
		$(this.label).click(function() {
			if (open_menu === scope) {
				scope.hide()
			} else {
				scope.open()
			}
		})
		$(this.label).mouseenter(function() {
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
					var arr = [];
					let redact = settings.streamer_mode.value;
					for (var key in Formats) {
						(function() {
							var format = Formats[key];
							arr.push({
								id: format.id,
								name: (redact && format.confidential) ? `[${tl('generic.redacted')}]` : format.name,
								icon: format.icon,
								description: format.description,
								click: (e) => {
									format.new()
								}
							})
						})()
					}
					return arr;
				}
			},
			{name: 'menu.file.recent', id: 'recent', icon: 'history',
				condition() {return isApp && recent_projects.length},
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
							click(c, event) {
								ActionControl.select('recent: ');
							}
						})
					}
					if (arr.length) {
						arr.push('_', {
							name: 'menu.file.recent.clear',
							icon: 'clear',
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
			{name: 'menu.file.import', id: 'import', icon: 'insert_drive_file', children: [
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
				'center_all'
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
				let tools = Toolbox.children.filter(tool => tool instanceof Tool);
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
			'_',
			'convert_to_mesh',
			'remove_blank_faces',
		])
		MenuBar.menus.filter = MenuBar.menus.tools;

		new BarMenu('animation', [
			'copy',
			'paste',
			'select_all',
			'add_keyframe',
			'add_marker',
			'reverse_keyframes',
			{name: 'menu.animation.flip_keyframes', id: 'flip_keyframes', condition: () => Timeline.selected.length, icon: 'flip', children: [
				'flip_x',
				'flip_y',
				'flip_z'
			]},
			'flip_animation',
			'delete',
			'lock_motion_trail',
			'_',
			'select_effect_animator',
			'bake_animation_into_model',
			'_',
			'load_animation_file',
			'save_all_animations',
			'export_animation_file'
		], {
			condition: {modes: ['animate']}
		})


		new BarMenu('view', [
			'fullscreen',
			'_',
			'view_mode',
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
			{name: 'menu.help.quickstart', id: 'discord', icon: 'fas.fa-directions', click: () => {
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

