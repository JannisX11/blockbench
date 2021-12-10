class Mode extends KeybindItem {
	constructor(id, data) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(data)
		this.id = id;
		this.name = data.name || tl('mode.'+this.id);
		this.selected = false

		this.default_tool = data.default_tool;
		this.selectElements = data.selectElements !== false
		this.hidden_node_types = data.hidden_node_types instanceof Array ? data.hidden_node_types.slice() : [];

		this.center_windows = data.center_windows||[];
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
			node.classList.add('center_window');
			node.appendChild(mount);
			document.getElementById('center').appendChild(node);

			this.vue = new Vue(data.component)
			this.vue.$mount(mount);

			this.center_windows.safePush(node.id);
		} else {
			this.center_windows.safePush('preview');
		}
	}
	select() {
		if (Modes.selected) {
			delete Modes[Modes.selected.id];
			Modes.previous_id = Modes.selected.id;
		}
		if (typeof Modes.selected.onUnselect === 'function') {
			Blockbench.dispatchEvent('unselect_mode', {mode: Modes.selected})
			Modes.selected.onUnselect()
		}
		if (Modes.selected.selected) {
			Modes.selected.selected = false
		}
		this.selected = true;
		Mode.selected = this;
		Modes.selected = this;
		Modes[Modes.selected.id] = true;
		if (Project) Project.mode = this.id;

		document.body.setAttribute('mode', this.id);

		$('#center > .center_window').each((i, obj) => {
			$(obj).toggle(this.center_windows.includes(obj.id));
		})

		$('#main_toolbar .toolbar_wrapper').css('visibility', this.hide_toolbars ? 'hidden' : 'visible');
		$('#status_bar').css('display', this.hide_status_bar ? 'none' : 'flex');

		Outliner.vue.options.hidden_types.replace(this.hidden_node_types);

		if (typeof this.onSelect === 'function') {
			this.onSelect()
		}
		if (Blockbench.isMobile) {
			Interface.PanelSelectorVue.$forceUpdate();
			Interface.PanelSelectorVue.select(null);
		}

		if (Interface.Panels[Prop.active_panel] && !Condition(Interface.Panels[Prop.active_panel].condition)) {
			Prop.active_panel = 'preview';
		}

		updateInterface()
		Canvas.updateRenderSides()
		if (BarItems[this.default_tool]) {
			BarItems[this.default_tool].select()
		} else {
			BarItems.move_tool.select()
		}
		TickUpdates.selection = true;
		Blockbench.dispatchEvent('select_mode', {mode: this})
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
		return Mode.selected ? Mode.selected.id : 'edit'
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
			Condition
		}
	})
});
BARS.defineActions(function() {
	new Mode('edit', {
		default_tool: 'move_tool',
		category: 'navigate',
		condition: () => Format && !Format.pose_mode,
		onUnselect: () => {
			if (Undo) Undo.closeAmendEditMenu();
		}
	})
	new Mode('paint', {
		default_tool: 'brush_tool',
		category: 'navigate',
		condition: () => Format,
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

			UVEditor.vue.setMode('paint');
			three_grid.visible = false;
		},
		onUnselect: () => {
			Canvas.updateAllBones()
			Outliner.elements.forEach(cube => {
				if (cube.preview_controller.updatePaintingGrid) cube.preview_controller.updatePaintingGrid(cube);
			})
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
		center_windows: ['preview', 'timeline'],
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