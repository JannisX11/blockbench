export const Toolbars = {};

export class Toolbar {
	constructor(id, data) {
		if (!data) {
			data = id;
			id = data.id
		}
		this.id = id;
		this.name = data.name && tl(data.name);
		this.label = !!data.label;
		this.label_node = null;
		this.condition = data.condition;
		this.children = [];
		this.condition_cache = [];
		Toolbars[this.id] = this;

		// items the toolbar could not load on startup, most likely from plugins (stored as IDs)
		this.postload = null;
		// object storing initial position of actions
		// if a property with a given position is set, then this slot is occupied
		// and the associated object (action) can effectively be used with indexOf on children
		this.positionLookup = {};

		this.no_wrap = !!data.no_wrap
		this.vertical = !!data.vertical
		this.default_children = data.children ? data.children.slice() : [];
		this.previously_enabled = true;

		let toolbar_menu = Interface.createElement('div', {class: 'tool toolbar_menu'}, Interface.createElement('i', {class: 'material-icons'}, this.vertical ? 'more_horiz' : 'more_vert'))
		toolbar_menu.addEventListener('click', event => {
			this.contextmenu(event);
		})
		this.node = Interface.createElement('div', {class: 'toolbar', toolbar_id: this.id}, [
			toolbar_menu,
			Interface.createElement('div', {class: 'content'})
		])
		BarItem.prototype.addLabel(false, {
			name: tl('data.toolbar'),
			node: toolbar_menu
		})
		if (this.no_wrap && !this.vertical) {
			let toolbar_overflow_button = Interface.createElement('div', {
				class: 'tool toolbar_overflow_button',
				title: tl('menu.toolbar.overflow')
			}, Blockbench.getIconNode('expand_more'));
			toolbar_overflow_button.addEventListener('click', event => {

				let content = this.node.querySelector('.content');
				if (!content) return;
				let menu_items = [];
				for (let tool of content.childNodes) {
					if (tool.offsetTop) {
						let item = BarItems[tool.getAttribute('toolbar_item')];
						if (!item) continue;
						menu_items.push(item);
					}
				}
				new Menu('toolbar_overflow', menu_items, {class: 'toolbar_overflow_menu'}).show(toolbar_overflow_button);
			})
			toolbar_menu.after(toolbar_overflow_button);

			let updateOverflow = () => {
				if (!this.node.isConnected) return;
				if (Toolbar.open_overflow_popup) return;
				let show = this.node.querySelector('.content')?.lastElementChild?.offsetTop > 12;
				toolbar_overflow_button.style.display = show ? 'block' : 'none';
			}
			updateOverflow();
			new ResizeObserver(updateOverflow).observe(this.node);
			
		}
		if (data) {
			try {
				this.build(data);
			} catch (err) {
				console.error(`Error building toolbar "${this.id}":`, err);
				delete BARS.stored[this.id];
				this.build(data);
			}
		}
	}
	/**
	 * Builds the toolbar from data
	 * @param {object} data Data used to build the toolbar
	 * @param {boolean} force If true, customization data will be ignored. Used when resetting toolbar
	 */
	build(data, force) {
		var scope = this;
		//Items
		this.children.length = 0;
		var items = data.children
		if (!force && BARS.stored[this.id] && typeof BARS.stored[this.id] === 'object') {
			items = BARS.stored[this.id];
			if (data.children) {
				// Add new actions (newly added via bb update) to existing toolbars
				data.children.forEach((key, index) => {
					if (typeof key == 'string' && key.length > 1 && !items.includes(key) && !Keybinds.stored[key] && BARS.stored._known?.includes(key) == false && BarItems[key]) {
						// Figure out best index based on item before. Otherwise use index from original array
						let prev_index = items.indexOf(data.children[index-1]);
						if (prev_index != -1) index = prev_index+1;
						items.splice(index, 0, key);
					}
				})
			}
		}
		if (items && items instanceof Array) {
			var content = $(this.node).find('div.content')
			content.children().detach()
			for (var itemPosition = 0; itemPosition < items.length; itemPosition++) {
				let item = items[itemPosition];
				if (typeof item === 'string' && item.match(/^[_+#]/)) {
					let char = item.substring(0, 1);
					content.append(`<div class="toolbar_separator ${char == '_' ? 'border' : (char == '+' ? 'spacer' : 'linebreak')}"></div>`);
					this.children.push(char + guid().substring(0,8));
					this.positionLookup[itemPosition] = char;

					continue;
				}
				if (typeof item == 'string') {
					BARS.stored._known?.safePush(item);
					item = BarItems[item];
				}

				if (item) {
					item.pushToolbar(this);
					this.positionLookup[itemPosition] = item;
				} else {
					var postloadAction = [items[itemPosition], itemPosition];
					if (this.postload) {
						this.postload.push(postloadAction);
					} else {
						this.postload = [postloadAction];
					}
				}
			}
		}
		$(this.node).toggleClass('no_wrap', this.no_wrap)
		$(this.node).toggleClass('vertical', this.vertical)
		if (data.default_place) {
			this.toPlace(this.id)
		}
		this.condition_cache.empty();
		return this;
	}
	contextmenu(event) {
		var offset = $(this.node).find('.toolbar_menu').offset()
		if (offset) {
			event = {
				clientX: offset.left+7,
				clientY: offset.top+28,
			}
		}
		this.menu.open(event, this);
	}
	editMenu() {
		BARS.editing_bar = this;
		BARS.dialog.show();
		BARS.dialog.content_vue.currentBar = this.children;
		return this;
	}
	add(action, position) {
		if (action instanceof BarItem && this.children.includes(action)) return this;
		if (position === undefined) position = this.children.length
		if (typeof action === 'object' && action.uniqueNode && action.toolbars.length) {
			for (var i = action.toolbars.length-1; i >= 0; i--) {
				action.toolbars[i].remove(action)
			}
		}
		//Adding
		this.children.splice(position, 0, action)
		if (typeof action === 'object') {
			action.toolbars.safePush(this)
		}
		this.update().save();
		return this;
	}
	remove(action, update = true) {
		var i = this.children.length-1;
		while (i >= 0) {
			var item = this.children[i]
			if (item === action || item.id === action) {
				item.toolbars.remove(this)
				this.children.splice(i, 1)
				if (update != false) this.update(true).save();
				return this;
			}
			i--;
		}
		return this;
	}
	update(force) {
		var scope = this;

		let enabled = Condition(this.condition);
		if (enabled != this.previously_enabled) {
			this.node.style.display = enabled ? '' : 'none';
			if (this.label_node) {
				this.label_node.style.display = this.node.style.display;
			}
			this.previously_enabled = enabled;
		}
		if (!enabled && !force) return this;

		// check if some unkown actions are now known
		if (this.postload) {
			var idx = 0;
			while (idx < this.postload.length) {
				var postloadAction = this.postload[idx];
				var item = BarItems[postloadAction[0]];
				if (item) {
					var insertAfter = postloadAction[1];
					// while there isn't displayed element at insertAfter - 1, decrease to reach one or 0
					while (this.positionLookup[--insertAfter] === undefined && insertAfter >= 0) {}
					var itemIdx = insertAfter + 1;
					if (!this.children.includes(item)) {
						item.pushToolbar(this, itemIdx);
						this.positionLookup[itemIdx] = item;
					}
					this.postload.splice(idx, 1);
				} else {
					idx++;
				}
			}
			if (this.postload.length == 0) {
				this.postload = null; // array obj no longer needed
			}
		}

		let needsUpdate = force === true || scope.condition_cache.length !== scope.children.length;
		scope.condition_cache.length = scope.children.length;

		this.children.forEach(function(item, i) {
			let value = null;
			if (typeof item === 'object') {
				value = !!Condition(item.condition)
			}
			if (!needsUpdate && value !== scope.condition_cache[i]) {
				needsUpdate = true;
			}
			scope.condition_cache[i] = value;
		})
		if (!needsUpdate) return this;

		var content = $(this.node).find('.content')
		content.find('> .tool').detach()
		var separators = {
			border: content.find('> .toolbar_separator.border').detach().toArray(),
			spacer: content.find('> .toolbar_separator.spacer').detach().toArray(),
			linebreak: content.find('> .toolbar_separator.linebreak').detach().toArray(),
		}

		let has_content = false;
		this.children.forEach(function(item, i) {
			if (typeof item === 'string') {
				var last = content.find('> :last-child')
				let type = item[0] == '_' ? 'border' : (item[0] == '+' ? 'spacer' : 'linebreak');
				if ((last.length === 0 || last.hasClass('toolbar_separator') || i == scope.children.length-1) && type !== 'spacer') {
					return this;
				}
				let sep = separators[type].shift();
				if (sep) {
					content.append(sep);
				} else {
					let separator = document.createElement('div');
					separator.className = `toolbar_separator ${type}`;
					content.append(separator);
				}

			} else if (typeof item === 'object') {
				if (scope.condition_cache[i]) {
					content.append(item.getNode())
					item.toolbars.safePush(scope)
					has_content = true;
				} else {
					item.toolbars.remove(scope)
				}
			}
		})
		var last = content.find('> :last-child')
		if (last.length && last.hasClass('toolbar_separator') && !last.hasClass('spacer')) {
			last.remove()
		}
		if (this.label_node) {
			this.label_node.style.visibility = has_content ? '' : 'hidden';
		}
		return this;
	}
	toPlace(place) {
		if (!place) place = this.id
		$('div.toolbar_wrapper.'+place+' > .toolbar').detach()
		$('div.toolbar_wrapper.'+place).append(this.node)
		return this;
	}
	save() {
		var arr = []
		this.children.forEach(function(c) {
			if (typeof c === 'string') {
				arr.push(c)
			} else {
				arr.push(c.id)
			}
		})
		BARS.stored[this.id] = arr;
		let identical_to_default = this.default_children.length == arr.length && this.default_children.allAre((item, i) => {
			return arr[i] == item || (typeof arr[i] == 'string' && arr[i].startsWith(item));
		})
		if (identical_to_default) {
			delete BARS.stored[this.id];
		}
		// Temporary fix
		try {
			localStorage.setItem('toolbars', JSON.stringify(BARS.stored))
		} catch (err) {
			localStorage.removeItem('backup_model');
		}
		return this;
	}
	reset() {
		this.build({
			children: this.default_children,
			default_place: this.default_place
		}, true);
		this.update();
		this.save();
		return this;
	}
}
Toolbar.prototype.menu = new Menu([
		{name: 'menu.toolbar.edit', icon: 'edit', click: function(bar) {
			bar.editMenu()
		}},
		{name: 'menu.toolbar.reset', icon: 'refresh', click: function(bar) {
			bar.reset()
		}}
	])

export const BARS = {
	stored: {
		_known: []
	},
	editing_bar: undefined,
	action_definers: [],
	condition: Condition,
	defineActions(definer) {
		BARS.action_definers.push(definer)
	},
	setupActions() {
		//Extras
			new KeybindItem('preview_select', {
				category: 'navigate',
				keybind: new Keybind({key: Blockbench.isTouch ? 0 : 1},
					{multi_select: 'ctrl', group_select: 'shift', loop_select: 'alt'}
				),
				variations: {
					multi_select: {name: 'keybind.preview_select.multi_select'},
					group_select: {name: 'keybind.preview_select.group_select'},
					loop_select: {name: 'keybind.preview_select.loop_select'},
				}
			})
			new KeybindItem('preview_rotate', {
				category: 'navigate',
				keybind: new Keybind({key: 1})
			})
			new KeybindItem('preview_drag', {
				category: 'navigate',
				keybind: new Keybind({key: 3})
			})
			new KeybindItem('preview_zoom', {
				category: 'navigate',
				keybind: new Keybind({key: 1, shift: true})
			})
			new KeybindItem('preview_area_select', {
				category: 'navigate',
				keybind: new Keybind({key: 1, ctrl: true, shift: null})
			})

			new KeybindItem('confirm', {
				category: 'navigate',
				keybind: new Keybind({key: 13})
			})
			new KeybindItem('cancel', {
				category: 'navigate',
				keybind: new Keybind({key: 27})
			})

		//Tools
			new Tool('move_tool', {
				icon: 'icon-gizmo',
				category: 'tools',
				selectFace: true,
				transformerMode: 'translate',
				animation_channel: 'position',
				toolbar: Blockbench.isMobile ? 'element_position' : 'main_tools',
				alt_tool: 'resize_tool',
				modes: ['edit', 'display', 'animate', 'pose'],
				keybind: new Keybind({key: 'v'}),
			})
			new Tool('resize_tool', {
				icon: 'open_with',
				category: 'tools',
				selectFace: true,
				transformerMode: 'scale',
				animation_channel: 'scale',
				toolbar: Blockbench.isMobile ? 'element_size' : 'main_tools',
				alt_tool: 'move_tool',
				modes: ['edit', 'display', 'animate'],
				keybind: new Keybind({key: 's'}),
				onSelect() {
					if (Modes.edit) {
						if (Mesh.selected.length) {
							Interface.addSuggestedModifierKey('alt', 'modifier_actions.resize_one_side');
						} else {
							Interface.addSuggestedModifierKey('alt', 'modifier_actions.resize_both_sides');
						}
					}
				},
				onUnselect() {
					Interface.removeSuggestedModifierKey('alt', 'modifier_actions.resize_one_side');
					Interface.removeSuggestedModifierKey('alt', 'modifier_actions.resize_both_sides');
				}
			})
			new Tool('rotate_tool', {
				icon: 'sync',
				category: 'tools',
				selectFace: true,
				transformerMode: 'rotate',
				animation_channel: 'rotation',
				toolbar: Blockbench.isMobile ? 'element_rotation' : 'main_tools',
				alt_tool: 'pivot_tool',
				modes: ['edit', 'display', 'animate', 'pose'],
				keybind: new Keybind({key: 'r'})
			})
			new Tool('pivot_tool', {
				icon: 'gps_fixed',
				category: 'tools',
				selectFace: true,
				transformerMode: 'translate',
				toolbar: Blockbench.isMobile ? 'element_origin' : 'main_tools',
				alt_tool: 'rotate_tool',
				modes: ['edit', 'animate'],
				keybind: new Keybind({key: 'p'}),
			})
			new Tool('vertex_snap_tool', {
				icon: 'icon-vertexsnap',
				transformerMode: 'hidden',
				toolbar: 'vertex_snap',
				category: 'tools',
				selectElements: true,
				cursor: 'copy',
				modes: ['edit'],
				condition: {modes: ['edit']},
				keybind: new Keybind({key: 'x'}),
				onCanvasClick(data) {
					Vertexsnap.canvasClick(data)
				},
				onSelect: function() {
					Blockbench.addListener('update_selection', Vertexsnap.select)
					Vertexsnap.select()
				},
				onUnselect: function() {
					Vertexsnap.clearVertexGizmos()
					Vertexsnap.step1 = true
					Blockbench.removeListener('update_selection', Vertexsnap.select)
				}
			})
			new Action('swap_tools', {
				icon: 'swap_horiz',
				category: 'tools',
				condition: {modes: ['edit', 'paint', 'display'], project: true},
				keybind: new Keybind({key: 32}),
				click: function () {
					if (BarItems[Toolbox.selected.alt_tool] && Condition(BarItems[Toolbox.selected.alt_tool].condition)) {
						BarItems[Toolbox.selected.alt_tool].select()
					}
				}
			})
			new Tool('stretch_tool', {
				icon: 'expand',
				category: 'tools',
				condition: () => Format.stretch_cubes,
				selectFace: true,
				transformerMode: 'stretch',
				toolbar: 'main_tools',
				alt_tool: 'resize_tool',
				modes: ['edit'],
				keybind: new Keybind({key: 's', alt: true}),
			})
			new Action('randomize_marker_colors', {
				icon: 'fa-shuffle',
				category: 'edit',
				condition: {modes: ['edit' ], project: true},
				click: function() {
					let randomColor = function() { return Math.floor(Math.random() * markerColors.length)}
					let elements = Outliner.selected.filter(element => element.setColor)
					Undo.initEdit({outliner: true, elements: elements, selection: true})
					Group.all.forEach(group => {
						if (group.first_selected) {
							let lastColor = group.color
							// Ensure chosen group color is never the same as before
							do group.color = randomColor();
							while (group.color === lastColor)
						}
					})
					elements.forEach(element => {
						let lastColor = element.color
						// Ensure chosen element color is never the same as before
						do element.setColor(randomColor())
						while (element.color === lastColor)
					})
					Undo.finishEdit('Change marker color')
				}
			})

		//File
			new Action('new_window', {
				icon: 'open_in_new',
				category: 'file',
				condition: isApp,
				click: function () {
					ipcRenderer.send('new-window');
				}
			})
			new Action('open_model_folder', {
				icon: 'folder_open',
				category: 'file',
				condition: () => {return isApp && (Project.save_path || Project.export_path)},
				click: function () {
					showItemInFolder(Project.export_path || Project.save_path);
				}
			})
			new Action('reload', {
				icon: 'refresh',
				category: 'file',
				condition: isApp,
				click: function () {
					if (Blockbench.hasFlag('dev') || confirm(tl('message.close_warning.web'))) {
						Blockbench.reload()
					}
				}
			})

		//Edit Generic
			let find_replace_dialog = new Dialog({
				id: 'find_replace',
				title: 'action.find_replace',
				form: {
					target: {label: 'dialog.find_replace.target', type: 'select', options: {
						element_names: 'dialog.find_replace.target.element_names',
						group_names: 'dialog.find_replace.target.group_names',
						animation_names: 'dialog.find_replace.target.animation_names',
						keyframe_values: 'dialog.find_replace.target.keyframe_values',
					}},
					find: {label: 'dialog.find_replace.find', type: 'text'},
					replace: {label: 'dialog.find_replace.replace', type: 'text'},
					regex: {label: 'dialog.find_replace.regex', type: 'checkbox', value: false},
				},
				onFormChange() {

				},
				onConfirm(form) {
					if (!form.find) return;
					function replace(name) {
						if (form.regex) {
							let regex = new RegExp(form.find, 'g');
							return name.replace(regex, form.replace);
						} else {
							return name.split(form.find).join(form.replace);
						}
					}
					if (form.target == 'element_names') {
						let elements = (Outliner.selected.length ? Outliner.selected : Outliner.elements);
						Undo.initEdit({elements});
						elements.forEach(element => {
							element.name = replace(element.name);
							element.sanitizeName();
							if (Condition(element.getTypeBehavior('unique_name'))) {
								element.createUniqueName();
							}
						})
					}
					if (form.target == 'group_names') {
						let groups = Group.first_selected ? Group.all.filter(g => g.selected) : Group.all;
						Undo.initEdit({outliner: true});
						groups.forEach(group => {
							group.name = replace(group.name);
							group.sanitizeName();
							if (Condition(group.getTypeBehavior('unique_name'))) {
								group.createUniqueName();
							}
						})
					}
					if (form.target == 'animation_names') {
						let animations = Animation.all;
						Undo.initEdit({animations});
						animations.forEach(animation => {
							animation.name = replace(animation.name);
							animation.createUniqueName();
						})
					}
					if (form.target == 'keyframe_values') {
						let keyframes = [];
						if (Timeline.selected.length) {
							keyframes = Timeline.selected;
						} else if (Animation.selected) {
							for (let key in Animation.selected.animators) {
								keyframes.push(...Animation.selected.animators[key].keyframes);
							}
						}
						Undo.initEdit({keyframes});
						keyframes.forEach(keyframe => {
							keyframe.data_points.forEach(datapoint => {
								if (datapoint.x != undefined) datapoint.x = replace(datapoint.x.toString());
								if (datapoint.y != undefined) datapoint.y = replace(datapoint.y.toString());
								if (datapoint.z != undefined) datapoint.z = replace(datapoint.z.toString());

								if (datapoint.effect) datapoint.effect = replace(datapoint.effect);
								if (datapoint.locator) datapoint.locator = replace(datapoint.locator);
								if (datapoint.script) datapoint.script = replace(datapoint.script);
							})
						})
					}
					Undo.finishEdit('Find/replace')
				}
			})
			new Action('find_replace', {
				icon: 'find_replace',
				category: 'edit',
				click: function () {
					find_replace_dialog.show();
				}
			})


		//Settings
			new Action('open_dev_tools', {
				name: 'menu.help.developer.dev_tools',
				icon: 'fas.fa-tools',
				condition: isApp,
				work_in_dialog: true,
				keybind: new Keybind({ctrl: true, shift: true, key: 'i'}),
				click: () => {
					currentwindow.toggleDevTools();
				}
			})
			

		//View
			new Action('fullscreen', {
				icon: 'fullscreen',
				category: 'view',
				condition: isApp,
				work_in_dialog: true,
				keybind: new Keybind({key: 122}),
				click: function () {
					currentwindow.setFullScreen(!currentwindow.isFullScreen())
				}
			})
			new Action('zoom_in', {
				icon: 'zoom_in',
				category: 'view',
				work_in_dialog: true,
				click: function () {setZoomLevel('in')}
			})
			new Action('zoom_out', {
				icon: 'zoom_out',
				category: 'view',
				work_in_dialog: true,
				click: function () {setZoomLevel('out')}
			})
			new Action('zoom_reset', {
				icon: 'zoom_out_map',
				category: 'view',
				work_in_dialog: true,
				click: function () {setZoomLevel('reset')}
			})
			new Action('toggle_sidebars', {
				icon: 'view_array',
				category: 'view',
				condition: () => !Blockbench.isMobile && Mode.selected && !Mode.selected.hide_sidebars,
				keybind: new Keybind({key: 'b', ctrl: true}),
				click: function () {
					let status = !Prop.show_left_bar;
					Prop.show_left_bar = status;
					Prop.show_right_bar = status;
					resizeWindow();
				}
			})

		BARS.action_definers.forEach((definer) => {
			if (typeof definer === 'function') {
				definer()
			}
		})
	},
	setupToolbars() {
		//
		var stored = localStorage.getItem('toolbars')
		if (stored) {
			stored = JSON.parse(stored)
			if (typeof stored === 'object') {
				BARS.stored = stored;
				if (!BARS.stored._known) {
					BARS.stored._known = [];
				}
			}
		}

		Toolbars.tools = new Toolbar({
			id: 'tools',
			children: [
				'move_tool',
				'resize_tool',
				'rotate_tool',
				'pivot_tool',
				'vertex_snap_tool',
				'stretch_tool',
				'knife_tool',
				'seam_tool',
				'pan_tool',
				'brush_tool',
				'copy_brush',
				'fill_tool',
				'eraser',
				'color_picker',
				'draw_shape_tool',
				'gradient_tool',
				'selection_tool',
				'move_layer_tool',
			],
			no_wrap: true,
			vertical: Blockbench.isMobile == true,
			default_place: true
		})
		
		Toolbars.main_tools = new Toolbar({
			id: 'main_tools',
			no_wrap: true,
			children: [
				'transform_space',
				'rotation_space',
				'transform_pivot_space',
				'selection_mode',
				'animation_controller_preview_mode',
				'slider_animation_controller_speed',
				'bedrock_animation_mode',
				'lock_motion_trail',
				'extrude_mesh_selection',
				'inset_mesh_selection',
				'loop_cut',
				'create_face',
				'invert_face',
				'_',
				'mirror_modeling',
			]
		})

		// Element
		Toolbars.element_position = new Toolbar({
			id: 'element_position',
			name: 'panel.element.position',
			label: true,
			children: [
				'slider_pos_x',
				'slider_pos_y',
				'slider_pos_z'
			]
		})
		Toolbars.element_size = new Toolbar({
			id: 'element_size',
			name: 'panel.element.size',
			label: true,
			children: [
				'slider_size_x',
				'slider_size_y',
				'slider_size_z',
				'slider_inflate'
			]
		})
		Toolbars.element_stretch = new Toolbar({
			id: 'element_stretch',
			name: 'panel.element.stretch',
			label: true,
			condition: () => Format.stretch_cubes,
			children: [
				'slider_stretch_x',
				'slider_stretch_y',
				'slider_stretch_z',
				'toggle_stretch_linked'
			]
		})
		Toolbars.element_origin = new Toolbar({
			id: 'element_origin',
			name: 'panel.element.origin',
			label: true,
			children: [
				'slider_origin_x',
				'slider_origin_y',
				'slider_origin_z',
				'origin_to_geometry'
			]
		})
		Toolbars.element_rotation = new Toolbar({
			id: 'element_rotation',
			name: 'panel.element.rotation',
			label: true,
			children: [
				'slider_rotation_x',
				'slider_rotation_y',
				'slider_rotation_z',
				'rescale_toggle'
			]
		})
		Toolbars.element_spline_dimensions = new Toolbar({
			id: 'element_spline_dimensions',
			name: 'panel.element.spline_dimensions',
			label: true,
			children: [
				'slider_spline_resolution_u',
				'slider_spline_resolution_v'
			]
		})
		if (Blockbench.isMobile) {[	
				Toolbars.element_position,
				Toolbars.element_size,
				Toolbars.element_stretch,
				Toolbars.element_origin,
				Toolbars.element_rotation,
				Toolbars.element_spline_dimensions
			].forEach(toolbar => {
				for (let child of Toolbars.main_tools.children) {
					if (toolbar.children.includes(child)) return;
					toolbar.add(child);
				}
			})
		}
		Toolbars.brush = new Toolbar({
			id: 'brush',
			no_wrap: true,
			children: [
				'fill_mode',
				'copy_brush_mode',
				'draw_shape_type',
				'copy_paste_tool_mode',
				'selection_tool_operation_mode',
				'_',
				'slider_brush_size',
				'slider_brush_opacity',
				'slider_brush_softness',
				'slider_color_select_threshold',
				'_',
				'brush_shape',
				'blend_mode',
				'mirror_painting',
				'color_erase_mode',
				'lock_alpha',
				'painting_grid',
				'image_tiled_view',
				'image_onion_skin_view',
			]
		})
		Toolbars.vertex_snap = new Toolbar({
			id: 'vertex_snap',
			no_wrap: true,
			children: [
				'vertex_snap_mode',
				'selection_mode'
			]
		})
		Toolbars.seam_tool = new Toolbar({
			id: 'seam_tool',
			no_wrap: true,
			children: [
				'select_seam'
			]
		})

		window.Toolbox = Toolbars.tools;
		Toolbox.toggleTransforms = function() {
			if (Toolbox.selected.id === 'move_tool') {
				BarItems['resize_tool'].select();
			} else if (Toolbox.selected.id === 'resize_tool') {
				BarItems['move_tool'].select()
			}
		}
		BarItems.move_tool.select()
	},
	setupVue() {

		let sidebar_pages = {
			separators: tl('category.separators')
		};
		for (let key in BarItems) {
			let category = BarItems[key].category;
			if (!sidebar_pages[category]) {
				sidebar_pages[category] = tl(`category.${category}`);
			}
		}

		BARS.dialog = new Dialog({
			id: 'toolbar_edit',
			title: 'dialog.toolbar_edit.title',
			singleButton: true,
			width: 780,
			sidebar: {
				pages: sidebar_pages,
				page: 'separators',
				onPageSwitch(page) {
					BARS.dialog.content_vue.open_category = page;
					BARS.dialog.content_vue.search_term = '';
				}
			},
			component: {
				data: {
					items: BarItems,
					currentBar: [],
					search_term: '',
					open_category: 'separators',
					separators: [
						{
							icon: 'fa-grip-lines-vertical',
							name: tl('data.separator'),
							type: 'separator',
							separator_code: '_'
						},
						{
							icon: 'space_bar',
							name: tl('data.separator.spacer'),
							type: 'separator',
							separator_code: '+'
						},
						{
							icon: 'fa-paragraph',
							name: tl('data.separator.linebreak'),
							type: 'separator',
							separator_code: '#'
						}
					]
				},
				computed: {
					searchedBarItems() {
						var term = this.search_term.toLowerCase();
						var list = [];
						if (this.open_category == 'separators' || term) {
							if (term) {
								list = this.separators.filter(item => {
									return item.name.toLowerCase().includes(term)
								})
							} else {
								list = this.separators;
							}
						}
						for (var key in BarItems) {
							var item = BarItems[key];
							if (this.currentBar.includes(item)) continue;

							if (term) {
								if (
									item.name.toLowerCase().includes(term) ||
									item.id.toLowerCase().includes(term)
								) {
									list.push(item)
								}

							} else if (item.category == this.open_category) {
								list.push(item);
							}
						}
						return list;
					}
				},
				methods: {
					sort(event) {
						var item = this.currentBar.splice(event.oldIndex, 1)[0]
						this.currentBar.splice(event.newIndex, 0, item)
						this.update();
					},
					drop(event) {
						var scope = this;
						$('#bar_items_current .tooltip').css('display', '')
						setTimeout(() => {
							if ($('#bar_items_current:hover').length === 0) {
								var item = scope.currentBar.splice(event.newIndex, 1)[0];
								if (item instanceof BarItem) item.toolbars.remove(BARS.editing_bar);
								scope.update();
							}
						}, 30)
					},
					choose() {
						$('#bar_items_current .tooltip').css('display', 'none')
					},
					update() {
						BARS.editing_bar.update(true).save();
					},
					addItem(item) {
						if (item.type === 'separator') {
							item = item.separator_code;
						}
						BARS.editing_bar.add(item);
					},
					openContextMenu(item, event) {
						new Menu([
							{
								name: 'generic.remove',
								icon: 'clear',
								click: () => {
									this.currentBar.remove(item);
									if (item instanceof BarItem) item.toolbars.remove(BARS.editing_bar);
									this.update();
								}
							}
						]).open(event)
					},
					getSpacerTitle(char) {
						switch (char) {
							case '_': return this.separators[0].name;
							case '+': return this.separators[1].name;
							case '#': return this.separators[2].name;
						}
					},
					getIconNode: Blockbench.getIconNode,
					Condition,
					tl
				},
				template: `
					<div>
						<ul class="bar" id="bar_items_current" v-sortable="{onChoose: choose, onUpdate: sort, onEnd: drop, animation: 160 }">
							<li v-for="item in currentBar" v-bind:title="typeof item == 'string' ? getSpacerTitle(item[0]) : item.name" :key="item.id||item" @contextmenu="openContextMenu(item, $event)">
								<div v-if="typeof item === 'string'" class="toolbar_separator" :class="{border: item[0] == '_', spacer: item[0] == '+', linebreak: item[0] == '#'}"></div>
								<div v-else class="tool">
									<div class="tooltip">{{item.name + (Condition(item.condition) ? '' : ' (' + tl('dialog.toolbar_edit.hidden') + ')' )}}</div>
									<span class="icon_wrapper" v-bind:style="{opacity: Condition(item.condition) ? 1 : 0.4}" v-html="getIconNode(item.icon, item.color).outerHTML"></span>
								</div>
							</li> 
						</ul>
			
						<p class="small_text subtle" style="display: inline;">${tl('dialog.toolbar_edit.hidden_tools')}</p>
		
						<search-bar v-model="search_term"></search-bar>
			
						<ul class="list" id="bar_item_list">
							<li v-for="item in searchedBarItems" v-on:click="addItem(item)" :class="{separator_item: item.type == 'separator'}">
								<dynamic-icon :icon="item.icon" :color="item.color" />
								<div class="icon_wrapper add"><i class="material-icons">add</i></div>
								{{ item.name }}
							</li>
						</ul>
			
					</div>
				`
			}
		})
	},
	updateConditions() {
		var open_input = document.querySelector('input[type="text"]:focus, input[type="number"]:focus, div[contenteditable="true"]:focus');
		for (var key in Toolbars) {
			if (Toolbars.hasOwnProperty(key) &&
				(!open_input || $(Toolbars[key].node).has(open_input).length === 0)
			) {
				Toolbars[key].update()
			}
		}
	}
}

Object.assign(window, {
	Toolbar,
	BARS,
	Toolbars,
})
