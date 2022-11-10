class Mode extends KeybindItem {
	constructor(id, data) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data)
		this.id = id;
		this.name = data.name || tl('mode.'+this.id);
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

		$('#main_toolbar .toolbar_wrapper').css('visibility', this.hide_toolbars ? 'hidden' : 'visible');
		$('#status_bar').css('display', this.hide_status_bar ? 'none' : 'flex');

		Outliner.vue.options.hidden_types.replace(this.hidden_node_types);

		if (typeof this.onSelect === 'function') {
			this.onSelect()
		}
		if (Blockbench.isMobile) {
			Interface.PanelSelectorVue.$forceUpdate();
			let bottom_panel = Interface.getBottomPanel();
			if (bottom_panel && !Condition(bottom_panel.display_condition)) {
				Interface.PanelSelectorVue.select(null);
			}
		}

		if (Interface.Panels[Prop.active_panel] && !Condition(Interface.Panels[Prop.active_panel].condition)) {
			Prop.active_panel = 'preview';
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
};
onVueSetup(function() {
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
});
BARS.defineActions(function() {
	new Mode('edit', {
		default_tool: 'move_tool',
		category: 'navigate',
		condition: () => Format && Format.edit_mode,
		onUnselect: () => {
			if (Undo) Undo.closeAmendEditMenu();
		}
	})
	new Mode('paint', {
		default_tool: 'brush_tool',
		category: 'navigate',
		condition: () => Format && Format.paint_mode,
		onSelect: () => {
			if (Modes.previous_id == 'animate') {
				Animator.preview();
			}
			Outliner.elements.forEach(cube => {
				if (cube.preview_controller.updatePaintingGrid) cube.preview_controller.updatePaintingGrid(cube);
			})
			$('#main_colorpicker').spectrum('set', ColorPanel.vue._data.main_color);
			BarItems.slider_color_h.update();
			BarItems.slider_color_s.update();
			BarItems.slider_color_v.update();

			Panels.uv.handle.firstChild.textContent = tl('mode.paint');

			if (Format.image_editor) {
				let old_color_slot = Panels.color.slot;
				Panels.color.position_data = Interface.data.panels.color_2d;
				if (Panels.color.slot !== old_color_slot) Panels.color.moveTo(Panels.color.slot);
			}
			Panels.uv.position_data = Interface.data.panels.paint;
			if (Panels.uv.slot !== Interface.data.panels.uv.slot) Panels.uv.moveTo(Panels.uv.slot);
			UVEditor.vue.setMode('paint');
			three_grid.visible = false;
		},
		onUnselect: () => {
			Canvas.updateAllBones()
			Outliner.elements.forEach(cube => {
				if (cube.preview_controller.updatePaintingGrid) cube.preview_controller.updatePaintingGrid(cube);
			})
			Panels.uv.handle.firstChild.textContent = tl('panel.uv');
			Panels.uv.position_data = Interface.data.panels.uv;
			if (Panels.uv.slot !== Interface.data.panels.paint.slot) Panels.uv.moveTo(Panels.uv.slot);
			if (Panels.color.position_data == Interface.data.panels.color_2d) {
				let old_color_slot = Panels.color.slot;
				Panels.color.position_data = Interface.data.panels.color;
				if (Panels.color.slot !== old_color_slot) Panels.color.moveTo(Panels.color.slot);
			}
			UVEditor.vue.setMode('uv');
			three_grid.visible = true;
		},
	})
	new Mode('pose', {
		default_tool: 'rotate_tool',
		category: 'navigate',
		condition: () => Format && Format.pose_mode,
	})
	new Mode('display', {
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