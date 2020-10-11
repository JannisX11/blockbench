class Mode extends KeybindItem {
	constructor(data) {
		super(data)
		this.id = data.id;
		this.name = data.name || tl('mode.'+this.id);
		this.selected = false
		this.default_tool = data.default_tool;
		this.center_windows = data.center_windows||['preview'];
		this.selectCubes = data.selectCubes !== false
		this.hide_toolbars = data.hide_toolbars
		this.condition = data.condition;
		this.onSelect = data.onSelect;
		this.onUnselect = data.onUnselect;
		Modes.options[this.id] = this;
	}
	select() {
		var scope = this;
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
		Modes.id = this.id
		Mode.selected = this;
		Modes.selected = this;
		Modes[Modes.selected.id] = true;

		document.body.setAttribute('mode', this.id);

		$('#center > #preview').toggle(this.center_windows.includes('preview'));
		$('#center > #timeline').toggle(this.center_windows.includes('timeline'));
		$('#center > #start_screen').toggle(this.center_windows.includes('start_screen'));

		if (this.hide_toolbars) {
			$('#main_toolbar .toolbar_wrapper').css('visibility', 'hidden')
		} else {
			$('#main_toolbar .toolbar_wrapper').css('visibility', 'visible')
		}

		if (typeof this.onSelect === 'function') {
			this.onSelect()
		}
		if (Blockbench.isMobile) {
			Interface.PanelSelectorVue.$forceUpdate();
			Interface.PanelSelectorVue.select(null);
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
}
const Modes = {
	id: 'edit',
	selected: false,
	options: {},
};
onVueSetup(function() {
	Modes.vue = new Vue({
		el: '#mode_selector',
		data: {
			options: Modes.options
		}
	})
});
BARS.defineActions(function() {
	new Mode({
		id: 'start',
		category: 'navigate',
		center_windows: ['start_screen'],
		hide_toolbars: true,
		onSelect: function () {
			if (Format && isApp) updateRecentProjectThumbnail()
		},
		onUnselect: function () {
		}
	})
	new Mode({
		id: 'edit',
		default_tool: 'move_tool',
		category: 'navigate',
		condition: () => Format,
		keybind: new Keybind({key: 49})
	})
	new Mode({
		id: 'paint',
		default_tool: 'brush_tool',
		category: 'navigate',
		condition: () => Format,
		keybind: new Keybind({key: 50}),
		onSelect: () => {
			if (Modes.previous_id == 'animate') {
				Animator.preview();
			}
			Cube.all.forEach(cube => {
				Canvas.buildGridBox(cube)
			})
			$('#main_colorpicker').spectrum('set', ColorPanel.vue._data.main_color);
			BarItems.slider_color_h.update();
			BarItems.slider_color_s.update();
			BarItems.slider_color_v.update();

			$('.UVEditor').find('#uv_size').hide()
			three_grid.visible = false;
		},
		onUnselect: () => {
			Cube.all.forEach(cube => {
				Canvas.buildGridBox(cube)
			})
			$('.UVEditor').find('#uv_size').show();
			three_grid.visible = true;
		},
	})
	new Mode({
		id: 'display',
		selectCubes: false,
		default_tool: 'move_tool',
		category: 'navigate',
		keybind: new Keybind({key: 51}),
		condition: () => Format.display_mode,
		onSelect: () => {
			enterDisplaySettings()
		},
		onUnselect: () => {
			exitDisplaySettings()
		},
	})
	new Mode({
		id: 'animate',
		default_tool: 'move_tool',
		category: 'navigate',
		center_windows: ['preview', 'timeline'],
		keybind: new Keybind({key: 52}),
		condition: () => Format.animation_mode,
		onSelect: () => {
			Animator.join()
		},
		onUnselect: () => {
			Animator.leave()
		}
	})
	//Update to 3.2.0
	if (Modes.options.animate.keybind.key == 51) {
		Modes.options.animate.keybind.set({key: 52})
	}
})