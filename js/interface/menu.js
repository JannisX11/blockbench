var open_menu;
class Menu {
	constructor(structure) {
		var scope = this;
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

			if (offset.left + el_width > $(window).width()) {
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

			let window_height = $(window).height() - 26;

			if (offset.top + el_height > window_height) {
				childlist.css('margin-top', 4-childlist.height() + 'px')
				if (childlist.offset().top < 26) {
					childlist.offset({top: 26})
				}
			}
			if (el_height > $(window).height()) {
				childlist.css('height', $(window).height()+'px').css('overflow-y', 'scroll')
			}
		}
	}
	keyNavigate(e) {
		var scope = this;
		var used;
		var obj = $(this.node)
		if (e.which >= 37 && e.which <= 40) {

			if (obj.find('li.focused').length) {
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
				} else if (scope.type === 'bar_menu' && e.which%2) {
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
					//entry[0].addEventListener('click', )
				}
				parent.append(entry)

			} else if (s instanceof BarSelect) {
				
				if (typeof s.icon === 'function') {
					var icon = Blockbench.getIconNode(s.icon(context), s.color)
				} else {
					var icon = Blockbench.getIconNode(s.icon, s.color)
				}
				entry = $(`<li title="${s.description||''}" menu_item="${s.id}"><span>${tl(s.name)}</span></li>`)
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
				entry = $(`<li title="${s.description||''}" menu_item="${s.id}"><span>${tl(s.name)}</span></li>`)
				entry.prepend(icon)
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
		let window_height = $(window).height() - 26;

		if (position && position.clientX !== undefined) {
			var offset_left = position.clientX
			var offset_top  = position.clientY+1

		} else if (position == document.body) {
			var offset_left = (document.body.clientWidth-el_width)/2
			var offset_top  = (document.body.clientHeight-el_height)/2

		} else {
			if (!position && scope.type === 'bar_menu') {
				position = scope.label
			} else if (position && position.parentElement.classList.contains('tool')) {
				position = position.parentElement;
			}
			var offset_left = $(position).offset().left;
			var offset_top  = $(position).offset().top + $(position).height();
		}

		if (offset_left > $(window).width() - el_width) {
			offset_left -= el_width
			if (position && position.clientWidth) offset_left += position.clientWidth;
		}
		if (offset_top  > window_height - el_height ) {
			offset_top -= el_height
		}
		offset_top = Math.clamp(offset_top, 26)

		ctxmenu.css('left', offset_left+'px')
		ctxmenu.css('top',  offset_top +'px')

		if (el_height > window_height) {
			ctxmenu.css('height', window_height+'px').css('overflow-y', 'scroll')
		}

		$(scope.node).filter(':not(.tx)').addClass('tx').click(function(ev) {
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
		$(this.node).detach()
		open_menu = undefined;
		return this;
	}
	conditionMet() {
		if (this.condition === undefined) {
			return true;
		} else if (typeof this.condition === 'function') {
			return this.condition()
		} else {
			return !!this.condition
		}
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
		if (path === undefined) path = ''
		path = path.split('.')

		function traverse(arr, layer) {
			var result;
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
	constructor(id, structure, condition) {
		super()
		var scope = this;
		MenuBar.menus[id] = this
		this.type = 'bar_menu'
		this.id = id
		this.children = [];
		this.condition = condition
		this.node = $('<ul class="contextMenu"></ul>')[0]
		this.label = $('<li class="menu_bar_point">'+tl('menu.'+id)+'</li>')[0]
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
		this.structure = structure
	}
	hide() {
		super.hide()
		$(this.label).removeClass('opened')
		MenuBar.open = undefined
		return this;
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
				condition: () => (!EditSession.active || EditSession.hosting),
				children: function() {
					var arr = [];
					for (var key in Formats) {
						(function() {
							var format = Formats[key];
							arr.push({
								id: format.id,
								name: format.name,
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
				condition: function() {return isApp && recent_projects.length && (!EditSession.active || EditSession.hosting)},
				children: function() {
					var arr = []
					let redact = settings.streamer_mode.value;
					recent_projects.forEach(function(p) {
						arr.push({
							name: redact ? `[${tl('generic.redacted')}]` : p.name,
							path: p.path,
							description: redact ? '' : p.path,
							icon: p.icon,
							click: function(c, event) {
								Blockbench.read([p.path], {}, files => {
									loadModelFile(files[0]);
								})
							}
						})
					})
					return arr
				}
			},
			'open_model',
			'_',
			'save_project',
			'save_project_as',
			'convert_project',
			'close_project',
			'_',
			{name: 'menu.file.import', id: 'import', icon: 'insert_drive_file', children: [
				'add_model',
				'import_optifine_part',
				'extrude_texture'
			]},
			{name: 'generic.export', id: 'export', icon: 'insert_drive_file', children: [
				'export_blockmodel',
				'export_bedrock',
				'export_entity',
				'export_class_entity',
				'export_optifine_full',
				'export_optifine_part',
				'export_obj',
				'export_gltf',
				'upload_sketchfab',
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
			'_',
			'add_cube',
			'add_group',
			'add_locator',
			'unlock_everything',
			'duplicate',
			'delete',
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
				'toggle_mirror_uv',
				'rename'
			]}

		], () => Modes.edit)

		new BarMenu('display', [
			'copy',
			'paste',
			'_',
			'add_display_preset',
			'apply_display_preset'
		], () => Modes.display)
		
		new BarMenu('filter', [
			'remove_blank_faces',
			/*
			plaster
			optimize
			sort by transparency
			entity / player model / shape generator
			*/

		])

		new BarMenu('animation', [
			'copy',
			'paste',
			'select_all',
			'add_keyframe',
			'add_marker',
			'reverse_keyframes',
			{name: 'menu.transform.flip', id: 'flip', condition: () => Timeline.selected.length, icon: 'flip', children: [
				'flip_x',
				'flip_y',
				'flip_z'
			]},
			'delete',
			'_',
			'select_effect_animator',
			'_',
			'load_animation_file',
			'save_all_animations',
		], () => Animator.open)


		new BarMenu('view', [
			'fullscreen',
			{name: 'menu.view.zoom', id: 'zoom', condition: isApp, icon: 'search', children: [
				'zoom_in',
				'zoom_out',
				'zoom_reset'
			]},
			'_',
			'toggle_shading',
			'toggle_motion_trails',
			'toggle_wireframe',
			'preview_checkerboard',
			'painting_grid',
			'toggle_quad_view',
			'focus_on_selection',
			{name: 'menu.view.screenshot', id: 'screenshot', icon: 'camera_alt', children: [
				'screenshot_model',
				'screenshot_app',
				'record_model_gif',
				'timelapse',
			]},
		])
		new BarMenu('help', [
			{name: 'menu.help.search_action', description: BarItems.action_control.description, id: 'search_action', icon: 'search', click: ActionControl.select},
			'_',
			{name: 'menu.help.discord', id: 'discord', icon: 'fab.fa-discord', click: () => {
				Blockbench.openLink('http://discord.blockbench.net');
			}},
			{name: 'menu.help.quickstart', id: 'discord', icon: 'fas.fa-directions', click: () => {
				Blockbench.openLink('https://blockbench.net/quickstart/');
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
					Blockbench.openLink('https://jannisx11.github.io/blockbench-docs/');
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
				{name: 'menu.help.developer.cache_reload', id: 'cache_reload', icon: 'cached', condition: !isApp, click: () => {
					window.location.reload(true)
				}},
				'reload',
			]},
			{name: 'menu.help.donate', id: 'donate', icon: 'fas.fa-hand-holding-usd', click: () => {
				Blockbench.openLink('https://blockbench.net/donate/');
			}},
			{name: 'menu.help.about', id: 'about', icon: 'info', click: () => {
				Settings.open({tab: 'credits'});
			}}
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
	getNode(data) {	
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

