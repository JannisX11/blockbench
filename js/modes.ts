import { Vue } from "./lib/libs"
import { Blockbench } from "./api"
import { Interface } from "./interface/interface"
import { MenuBar } from "./interface/menu_bar"
import { Panels, updatePanelSelector, updateSidebarOrder } from "./interface/panels"
import { Prop } from "./misc"
import { Outliner } from "./outliner/outliner"
import { ReferenceImage } from "./preview/reference_images"

interface ModeOptions {
	id?: string
	name?: string
	icon?: string
	default_tool?: string
	selectElements?: boolean
	category?: string
	/**
	 * Hide certain types of nodes in the outliner, like cubes and meshes in animation mode
	 */
	hidden_node_types?: string[]
	hide_toolbars?: boolean
	hide_sidebars?: boolean
	hide_status_bar?: boolean
	condition?: ConditionResolvable
	component?: Vue.Component
	onSelect?(): void
	onUnselect?(): void
}
export class Mode extends KeybindItem {
	id: string
	name: string
	icon: string
	selected: boolean
	tool: string
	default_tool?: string
	selectElements: boolean
	hidden_node_types: string[]
	hide_toolbars: boolean
	hide_sidebars: boolean
	hide_status_bar: boolean
	vue?: Vue

	onSelect?: () => void
	onUnselect?: () => void

	constructor(id: string, data: ModeOptions) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		// @ts-ignore
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
	/**Selects the mode */
	select() {
		if (Modes.selected instanceof Mode) {
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
				let panel = Panels[id];
				panel.updateSlot();

			}
			updateSidebarOrder();
		}

		Canvas.updateRenderSides()
		let selected_tool = BarItems[this.tool] instanceof Tool && BarItems[this.tool];
		let default_tool = BarItems[this.default_tool] instanceof Tool && BarItems[this.default_tool];
		if (selected_tool instanceof Tool && Condition(selected_tool.condition)) {
			selected_tool.select();
		} else if (default_tool instanceof Tool) {
			if (default_tool != Toolbox.selected) default_tool.select();
		} else {
			if (BarItems.move_tool != Toolbox.selected) (BarItems.move_tool as Tool).select();
		}
		updateInterface();
		updateSelection();
		Blockbench.dispatchEvent('select_mode', {mode: this})
	}
	/**Unselects the mode */
	unselect() {
		delete Modes[this.id];
		Modes.previous_id = this.id;
		if (typeof this.onUnselect === 'function') {
			Blockbench.dispatchEvent('unselect_mode', {mode: this})
			this.onUnselect()
		}
		this.selected = false;
		Mode.selected = Modes.selected = false;
	}
	/**Activates the mode */
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
	static selected = null;
}
export const Modes = {
	get id() {
		return Mode.selected ? Mode.selected.id : ''
	},
	vue: null as Vue | null,
	selected: false as boolean | Mode,
	previous_id: '',
	options: {} as Record<string, Mode>,
	animate: false,
	display: false,
	edit: false,
	paint: false,
	pose: false,
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

Object.assign(window, {
	Mode,
	Modes
});
