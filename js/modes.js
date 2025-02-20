class Mode extends KeybindItem {
	constructor(id, data) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data)
		this.id = id;
		this.name = data.name || tl('mode.'+this.id);
		this.icon = data.icon || 'video_label';
		this.selected = false

		this.default_tool = data.default_tool;
		this.selectElements = data.selectElements !== false
		this.hidden_node_types = data.hidden_node_types instanceof Array ? data.hidden_node_types.slice() : [];

		this.hide_toolbars = data.hide_toolbars
		this.hide_sidebars = data.hide_sidebars
		this.hide_status_bar = data.hide_status_bar

		this.condition = data.condition;
		this.onSelect = data.onSelect;
		this.onUnselect = data.onUnselect;

		Modes.options[this.id] = this;

		if (data.component) {
			let node = document.createElement('div');
			let mount = document.createElement('div');
			node.id = 'mode_screen_' + this.id;
			node.appendChild(mount);
			document.getElementById('center').appendChild(node);

			this.vue = new Vue(data.component)
			this.vue.$mount(mount);
		}
	}
	select() {
		if (Modes.selected) {
			Modes.selected.unselect();
		}
		this.selected = true;
		Mode.selected = this;
		Modes.selected = this;
		Modes[Modes.selected.id] = true;
		if (Project) Project.mode = this.id;

		document.body.setAttribute('mode', this.id);

		if (MenuBar.mode_switcher_button) {
			let icon = Blockbench.getIconNode(this.icon);
			MenuBar.mode_switcher_button.firstChild.replaceWith(icon);
			MenuBar.mode_switcher_button.classList.remove('hidden');
		}

		$('#main_toolbar .toolbar_wrapper').css('visibility', this.hide_toolbars ? 'hidden' : 'visible');
		$('#status_bar').css('display', this.hide_status_bar ? 'none' : 'flex');

		Outliner.vue.options.hidden_types.replace(this.hidden_node_types);

		if (typeof this.onSelect === 'function') {
			this.onSelect()
		}
		updatePanelSelector();
		ReferenceImage.updateAll();

		if (Interface.Panels[Prop.active_panel] && !Condition(Interface.Panels[Prop.active_panel].condition)) {
			Prop.active_panel = 'preview';
		}
		
		UVEditor.beforeMoving();
		if (!Blockbench.isMobile) {
			for (let id in Panels) {
				let old_pos_data = Panels[id].position_data;
				Panels[id].position_data = Interface.getModeData().panels[id];
				if (!Panels[id].position_data) {
					Panels[id].position_data = Interface.getModeData().panels[id] = JSON.parse(JSON.stringify(old_pos_data))
				}
				Panels[id].updateSlot();
			}
			updateSidebarOrder();
		}

		Canvas.updateRenderSides()
		if (this.tool && BarItems[this.tool] && Condition(BarItems[this.tool])) {
			BarItems[this.tool].select();
		} else if (BarItems[this.default_tool]) {
			if (!BarItems[this.default_tool].selected) BarItems[this.default_tool].select();
		} else {
			if (!BarItems.move_tool.selected) BarItems.move_tool.select();
		}
		TickUpdates.interface = true;
		TickUpdates.selection = true;
		Blockbench.dispatchEvent('select_mode', {mode: this})
	}
	unselect() {
		delete Modes[this.id];
		Modes.previous_id = this.id;
		if (typeof this.onUnselect === 'function') {
			Blockbench.dispatchEvent('unselect_mode', {mode: this})
			this.onUnselect()
		}
		this.selected = false;
		Mode.selected = Modes.selected = 0;
	}
	trigger() {
		if (Condition(this.condition)) {
			this.select()
		}
	}
	delete() {
		if (Mode.selected == this) {
			Modes.options.edit.select();
		}
		delete Modes.options[this.id];
	}
}
const Modes = {
	get id() {
		return Mode.selected ? Mode.selected.id : ''
	},
	selected: false,
	options: {},
	mobileModeMenu(button, event) {
		let entries = [];
		for (let id in Modes.options) {
			let mode = Modes.options[id];
			let entry = {
				id,
				icon: mode.icon || 'mode',
				name: mode.name,
				condition: mode.condition,
				click: () => {
					mode.select();
				},
			};
			entries.push(entry);
		}
		let menu = new Menu(entries).open(button);
		return menu;
	}
};
onVueSetup(function() {
	if (!Blockbench.isMobile) {
		Modes.vue = new Vue({
			el: '#mode_selector',
			data: {
				options: Modes.options
			},
			methods: {
				showModes() {
					let count = 0;
					for (let key in this.options) {
						if (Condition(this.options[key].condition)) count++;
					}
					return count > 1;
				},
				Condition
			}
		})
	} else {
		document.getElementById('mode_selector').remove();
	}
});
BARS.defineActions(function() {
	new Mode('edit', {
		icon: 'deployed_code',
		default_tool: 'move_tool',
		category: 'navigate',
		condition: () => Format && Format.edit_mode,
		onSelect: () => {
			Outliner.elements.forEach(cube => {
				if (cube.preview_controller.updatePixelGrid) cube.preview_controller.updatePixelGrid(cube);
			})
		},
		onUnselect: () => {
			if (Undo) Undo.closeAmendEditMenu();
			Outliner.elements.forEach(cube => {
				if (cube.preview_controller.updatePixelGrid) cube.preview_controller.updatePixelGrid(cube);
			})
		}
	})
	new Mode('paint', {
		icon: 'fa-paint-brush',
		default_tool: 'brush_tool',
		category: 'navigate',
		condition: () => Format && Format.paint_mode,
		onSelect: () => {
			if (Modes.previous_id == 'animate') {
				Animator.preview();
			}
			Outliner.elements.forEach(cube => {
				if (cube.preview_controller.updatePixelGrid) cube.preview_controller.updatePixelGrid(cube);
			})
			$('#main_colorpicker').spectrum('set', ColorPanel.vue._data.main_color);
			if (StateMemory.color_picker_rgb) {
				BarItems.slider_color_red.update();
				BarItems.slider_color_green.update();
				BarItems.slider_color_blue.update();
			} else {
				BarItems.slider_color_h.update();
				BarItems.slider_color_s.update();
				BarItems.slider_color_v.update();
			}

			Panels.uv.handle.firstChild.textContent = tl('mode.paint');

			let fill_mode = BarItems.fill_mode.value;
			if (!Condition(BarItems.fill_mode.options[fill_mode].condition)) {
				for (let key in BarItems.fill_mode.options) {
					if (Condition(BarItems.fill_mode.options[key].condition)) {
						BarItems.fill_mode.set(key);
						break;
					}
				}
			}

			UVEditor.vue.setMode('paint');
			three_grid.visible = false;
		},
		onUnselect: () => {
			Canvas.updateAllBones()
			Outliner.elements.forEach(cube => {
				if (cube.preview_controller.updatePixelGrid) cube.preview_controller.updatePixelGrid(cube);
			})
			Panels.uv.handle.firstChild.textContent = tl('panel.uv');
			UVEditor.vue.setMode('uv');
			three_grid.visible = true;
		},
	})
	new Mode('pose', {
		icon: 'emoji_people',
		default_tool: 'rotate_tool',
		category: 'navigate',
		condition: () => Format && Format.pose_mode,
	})
	new Mode('display', {
		icon: 'tune',
		selectElements: false,
		default_tool: 'move_tool',
		category: 'navigate',
		condition: () => Format.display_mode,
		onSelect: () => {
			enterDisplaySettings()
		},
		onUnselect: () => {
			exitDisplaySettings()
		},
	})
	new Mode('animate', {
		icon: 'movie',
		default_tool: 'move_tool',
		category: 'navigate',
		hidden_node_types: ['cube', 'mesh', 'texture_mesh'],
		condition: () => Format.animation_mode,
		onSelect: () => {
			Animator.join()
		},
		onUnselect: () => {
			Animator.leave()
		}
	})
})