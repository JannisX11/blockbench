import { Prop } from "../misc";
import { EventSystem } from "../util/event_system";
import { InputForm } from "./form";
import { Interface, openTouchKeyboardModifierMenu, resizeWindow, updateInterface } from "./interface";
import {Toolbar} from './toolbars'
import { Vue } from "../lib/libs";
import { Blockbench } from "../api";

interface PanelPositionData {
	slot: PanelSlot
	float_position: [number, number]
	float_size: [number, number]
	height: number
	folded: boolean
	attached_to?: string
	attached_index?: number
	open_tab?: string
	fixed_height: boolean
	sidebar_index: number
}

type PanelSlot = 'left_bar' | 'right_bar' | 'top' | 'bottom' | 'float' | 'hidden'

interface PanelOptions {
	id?: string
	name?: string
	icon: string
	optional?: boolean
	plugin?: string
	min_height?: number
	menu?: any
	/**
	 * If true, the panel can automatically become smaller or larger than its initial size in the sidebar
	 */
	growable?: boolean
	/**
	 * When true, the height of the panel can be adjusted in the sidebar
	 */
	resizable?: true
	selection_only?: boolean
	condition?: ConditionResolvable
	display_condition?: ConditionResolvable
	/**
	 * Adds a button to the panel that allows users to pop-out and expand the panel on click
	 */
	expand_button?: boolean
	toolbars?:
		| {
				[id: string]: Toolbar
		  }
		| Toolbar[]
	default_position?: Partial<PanelPositionData>
	mode_positions?: Record<string, Partial<PanelPositionData>>
	component?: Vue.Component
	form?: InputForm
	default_side?: 'right' | 'left'
	/**
	 * Identifier of another panel to insert this one above
	 */
	insert_before?: string
	/**
	 * Identifier of another panel to insert this one below
	 */
	insert_after?: string
	onResize?(): void
	onFold?(): void
}
type PanelEvent = 'drag' | 'fold' | 'change_zindex' | 'move_to' | 'moved_to' | 'update'

const DEFAULT_POSITION_DATA: PanelPositionData = {
	slot: 'left_bar',
	float_position: [0, 0],
	float_size: [300, 300],
	height: 300,
	folded: false,
	fixed_height: false,
	attached_to: '',
	attached_index: undefined,
	open_tab: undefined,
	sidebar_index: 0,
}

export class Panel extends EventSystem {
	type: 'panel'
	id: string
	name: string
	icon: string
	menu: Menu
	condition: ConditionResolvable
	display_condition: ConditionResolvable
	resizable?: boolean
	growable: boolean
	min_height?: number
	optional: boolean
	plugin?: string
	onResize: () => void
	onFold: () => void

	previous_slot: PanelSlot
	width: number
	height: number

	node: HTMLElement
	container: HTMLElement
	handle: HTMLElement
	tab_bar: HTMLElement
	form?: InputForm
	vue?: Vue
	inside_vue?: Vue
	toolbars: Toolbar[]
	sidebar_resize_handle: HTMLElement
	resize_handles?: HTMLElement
	/**
	 * Stores panel position data during the current session
	 */
	mode_position_data: Record<string, PanelPositionData>
	/**
	 * The default configuration of the panel as it was when constructed without user customization
	 */
	default_configuration: {
		default_position?: Partial<PanelPositionData>,
		mode_positions?: Record<string, Partial<PanelPositionData>>
}

	constructor(id: string | PanelOptions, data: PanelOptions) {
		super();
		if (!data && typeof id != 'string') data = id;
		let scope = this;
		this.type = 'panel';
		this.id = typeof id == 'string' ? id : data.id || 'new_panel';
		this.name = tl(data.name ? data.name : `panel.${this.id}`);
		this.icon = data.icon;
		this.menu = data.menu;
		this.condition = data.condition;
		this.display_condition = data.display_condition;
		this.previous_slot = 'left_bar';
		this.optional = data.optional ?? true;
		// @ts-ignore "Plugins" is loaded after so it cannot be imported
		this.plugin = data.plugin || (typeof Plugins != 'undefined' ? Plugins.currently_loading : '');

		this.growable = data.growable;
		this.resizable = data.resizable;
		this.min_height = data.min_height ?? 60;

		this.onResize = data.onResize;
		this.onFold = data.onFold;
		this.events = {};
		this.toolbars = [];

		this.default_configuration = {default_position: data.default_position, mode_positions: data.mode_positions};
		this.mode_position_data = {};

		this.handle = Interface.createElement('div', {class: 'panel_handle', panel_id: this.id}, Interface.createElement('span', {}, this.name));
		this.node = Interface.createElement('div', {class: 'panel', id: `panel_${this.id}`});
		this.tab_bar = Interface.createElement('div', {class: 'panel_tab_bar'}, [
			Interface.createElement('div', {class: 'panel_tab_list'}, this.handle)
		]);
		this.container = Interface.createElement('div', {class: 'panel_container', panel_id: this.id}, [this.tab_bar, this.node]);

		this.handle.addEventListener('mousedown', (event: MouseEvent) => {
			if (this.attached_to) {
				Panels[this.attached_to].selectTab(this);
			} else {
				this.selectTab();
			}
		});

		if (this.growable) {
			this.container.classList.add('grow');
			this.node.classList.add('grow');
		}
		
		// Toolbars
		let toolbars = data.toolbars instanceof Array ? data.toolbars : (data.toolbars ? Object.keys(data.toolbars) : []);

		for (let item of toolbars) {
			let toolbar = item instanceof Toolbar ? item : this.toolbars[item];
			if (toolbar instanceof Toolbar == false) continue;

			if (toolbar.label) {
				let label = Interface.createElement('p', {class: 'panel_toolbar_label'}, tl(toolbar.name));
				this.node.append(label);
				toolbar.label_node = label;
			}
			this.node.append(toolbar.node);
			this.toolbars.push(toolbar);
		}

		if (data.form) {
			this.form = data.form instanceof InputForm ? data.form : new InputForm(data.form);
			this.node.append(this.form.node),
			this.form.buildForm();
		}

		if (data.component) {
			
			let component_mount = Interface.createElement('div');
			this.node.append(component_mount);
			let onmounted = data.component.mounted;
			data.component.mounted = function() {
				Vue.nextTick(() => {

					let toolbar_wrappers = this.$el.querySelectorAll('.toolbar_wrapper');
					toolbar_wrappers.forEach((wrapper: HTMLElement) => {
						let id = wrapper.getAttribute('toolbar');
						let toolbar = scope.toolbars.find(toolbar => toolbar.id == id);
						if (toolbar) {
							wrapper.append(toolbar.node);
						}
					})

					if (typeof onmounted == 'function') {
						onmounted.call(this);
					}
					//updateInterfacePanels()
				})
			}
			this.vue = this.inside_vue = new Vue(data.component)
			this.vue.$mount(component_mount);
			this.vue.$el.classList.add('panel_vue_wrapper');
		}

		if (!Blockbench.isMobile) {
			if (data.expand_button) {
				let expand_button = Interface.createElement('div', {class: 'tool panel_control panel_expanding_button'}, Blockbench.getIconNode('fullscreen'))
				this.tab_bar.append(expand_button);
				expand_button.addEventListener('click', (e) => {
					if (this.slot == 'float') {
						this.moveTo(this.previous_slot);
					} else {
						this.moveTo('float');
						this.moveToFront();
					}
				})
			}

			let menu_button = Interface.createElement('div', {class: 'light_on_hover panel_menu_button'}, Blockbench.getIconNode('more_vert'))
			this.handle.append(menu_button);
			menu_button.addEventListener('click', (e) => {
				this.snap_menu.open(menu_button, this);
			})

			let fold_button = Interface.createElement('div', {class: 'tool panel_control panel_folding_button'}, Blockbench.getIconNode('expand_more'))
			this.tab_bar.append(fold_button);
			fold_button.addEventListener('click', (e) => {
				this.fold();
			})

			this.tab_bar.firstElementChild.addEventListener('dblclick', e => {
				this.fold();
			})

			if (this.resizable) {
				this.sidebar_resize_handle = Interface.createElement('div', {class: 'panel_sidebar_resize_handle'})
				this.container.append(this.sidebar_resize_handle);
				addEventListeners(this.sidebar_resize_handle, 'mousedown touchstart', (event: MouseEvent) => {
					let all_panels: Panel[] = this.slot == 'right_bar' ? Interface.getRightPanels() : Interface.getLeftPanels();
					let self_index = all_panels.indexOf(this);
					if (all_panels.length == 1 && all_panels[0].growable) {
						return makeSidebarFilled(all_panels);
					} else if (self_index == all_panels.length-2 && !all_panels.last().growable) {
						all_panels.last().resize(event);
					} else if (event.ctrlKey && all_panels[self_index+1]) {
						all_panels[self_index+1].resize(event);
					} else {
						this.resize(event);
					}
				});
			}

			let getHostPanelUnderCursor: (event: MouseEvent) => Panel | undefined = (event) => {
				for (let panel_id in Panels) {
					let panel: Panel = Panels[panel_id];
					if (panel != this && panel.container.isConnected) {
						let bounding_box = panel.tab_bar.getBoundingClientRect();
						if (
							Math.isBetween(event.clientX, bounding_box.left, bounding_box.right) &&
							Math.isBetween(event.clientY, bounding_box.top, bounding_box.bottom)
						) {
							return panel;
						}
					}
				}
			}

			let dragPanel =	(e1: MouseEvent, drag_container: boolean = false) => {
				if (e1.target instanceof HTMLElement && e1.target.classList.contains('panel_menu_button')) return;
				if (e1.which == 2 || e1.which == 3) return;
				convertTouchEvent(e1);
				let started = false;
				let position_before = this.slot == 'float'
					? this.position_data.float_position.slice()
					: [e1.clientX - e1.offsetX, e1.clientY - e1.offsetY - 55];
				let original_show_left_bar = Prop.show_left_bar;
				let original_show_right_bar = Prop.show_right_bar;

				let target_slot: PanelSlot | undefined;
				let target_panel: Panel | null;
				let target_before = false;
				let attach_to = false;
				let move_attached_panels = drag_container || e1.shiftKey || Pressing.overrides.shift;
				function updateTargetHighlight(event: MouseEvent) {
					$(`.panel_container[order], .panel_handle[order]`).attr('order', null);
					$(`.panel_container.attach_target`).removeClass('attach_target');

					if (attach_to && target_panel) {
						target_panel.container.classList.add('attach_target');
						let panel_container_offset = $(target_panel.container).offset()?.left ?? 0;
						let attached_panels = [target_panel].concat(target_panel.getAttachedPanels());
						let target_handle_panel = attached_panels.findLast(handle_panel => {
							return event.clientX + 20 > panel_container_offset + handle_panel.handle.offsetLeft + handle_panel.handle.clientWidth;
						}) ?? attached_panels[0];
						if (target_handle_panel) {
							target_handle_panel.handle.setAttribute('order', '1');
						}
					} else if (target_panel) {
						target_panel.container.setAttribute('order', (target_before ? -1 : 1).toString());
					}

					if (target_slot) {
						Interface.center_screen.setAttribute('snapside', target_slot);
					} else {
						Interface.center_screen.removeAttribute('snapside');
					}
					if ((target_slot == 'right_bar' && Interface.right_bar_width) || (target_slot == 'left_bar' && Interface.left_bar_width)) {
						Interface.center_screen.removeAttribute('snapside');
					}
					Interface.left_bar.classList.toggle('drop_target', target_slot == 'left_bar');
					Interface.right_bar.classList.toggle('drop_target', target_slot == 'right_bar');

					if (target_slot == 'left_bar' && !Prop.show_left_bar) Interface.toggleSidebar('left');
					if (target_slot == 'right_bar' && !Prop.show_right_bar) Interface.toggleSidebar('right');
					if (target_slot != 'left_bar' && Prop.show_left_bar && !original_show_left_bar) Interface.toggleSidebar('left');
					if (target_slot != 'right_bar' && Prop.show_right_bar && !original_show_right_bar) Interface.toggleSidebar('right');
				}

				let drag = e2 => {
					convertTouchEvent(e2);
					if (!started && (Math.pow(e2.clientX - e1.clientX, 2) + Math.pow(e2.clientY - e1.clientY, 2)) > 15) {
						started = true;
						let attached_panels = this.getAttachedPanels();
						if (attached_panels.length && !move_attached_panels) {
							let first = attached_panels.splice(0, 1)[0];
							first.moveTo(this.slot, this);
							for (let other of attached_panels) {
								first.attachPanel(other);
							}
						}
						if (this.slot !== 'float' || this.attached_to) {
							this.moveTo('float');
							this.moveToFront();
						}
						this.container.classList.add('dragging');

						Interface.addSuggestedModifierKey('ctrl', 'modifier_actions.move_panel_without_docking');
					}
					if (!started) return;
					
					this.position_data.float_position[0] = position_before[0] + e2.clientX - e1.clientX;
					this.position_data.float_position[1] = position_before[1] + e2.clientY - e1.clientY;

					let threshold = 40;
					let threshold_y = 64;
					let host_target_panel;
					target_slot = null; target_panel = null; target_before = false; attach_to = false;

					if (e2.ctrlOrCmd) {
					} else if (host_target_panel = getHostPanelUnderCursor(e2)) {
						target_panel = host_target_panel;
						attach_to = true;
						target_slot = undefined;

					} else if (e2.clientX < Math.max(Interface.left_bar_width, threshold)) {

						target_slot = 'left_bar';
						for (let child of Interface.left_bar.childNodes) {
							if (!child.clientHeight) continue;
							let y = $(child).offset()?.top;
							if (!y) continue;
							target_panel = Panels[child.getAttribute('panel_id')];
							if (e2.clientY < (y + child.clientHeight / 2)) {
								target_before = true;
								break;
							}
						}

					} else if (e2.clientX > document.body.clientWidth - Math.max(Interface.right_bar_width, threshold)) {
						
						target_slot = 'right_bar';
						for (let child of Interface.right_bar.childNodes) {
							if (!child.clientHeight) continue;
							let y = $(child).offset()?.top;
							if (!y) continue;
							target_panel = Panels[child.getAttribute('panel_id')];
							if (e2.clientY < (y + child.clientHeight / 2)) {
								target_before = true;
								break;
							}
						}

					} else if (
						e2.clientY < (Interface.work_screen.offsetTop + 30 + threshold_y) &&
						e2.clientX > Interface.left_bar_width && e2.clientX < (Interface.work_screen.clientWidth - Interface.right_bar_width)
					) {
						target_slot = 'top'

					} else if (
						e2.clientY > Interface.work_screen.offsetTop + Interface.work_screen.clientHeight - Interface.status_bar.vue.$el.clientHeight - threshold_y &&
						e2.clientX > Interface.left_bar_width && e2.clientX < (Interface.work_screen.clientWidth - Interface.right_bar_width)
					) {
						target_slot = 'bottom'

					}
					updateTargetHighlight(e2);
					this.update(true);
					this.dispatchEvent('drag', {event: e2, target_before, attach_to, target_panel, target_slot});
				}
				let stop = e2 => {
					convertTouchEvent(e2);
					this.container.classList.remove('dragging');
					Interface.center_screen.removeAttribute('snapside');
					$(`.panel_container[order], .panel_handle[order]`).attr('order', null);
					Interface.left_bar.classList.remove('drop_target');
					Interface.right_bar.classList.remove('drop_target');
					$(`.panel_container.attach_target`).removeClass('attach_target');
					
					Interface.removeSuggestedModifierKey('ctrl', 'modifier_actions.move_panel_without_docking');

					if (attach_to) {
						this.fixed_height = false;
						target_panel.attachPanel(this);
					} else if (target_slot) {
						this.fixed_height = false;
						this.moveTo(target_slot, target_panel, target_before)
					}

					if (this.slot != 'float') {
						this.position_data.float_position[0] = position_before[0];
						this.position_data.float_position[1] = position_before[1];
					}
					this.customizePosition();
					updateInterface();
					setTimeout(() => {
						this.update();
					}, 0);
					
					removeEventListeners(document, 'mousemove touchmove', drag);
					removeEventListeners(document, 'mouseup touchend', stop);
				}
				addEventListeners(document, 'mousemove touchmove', drag);
				addEventListeners(document, 'mouseup touchend', stop);
			};
			addEventListeners(this.handle, 'mousedown touchstart', dragPanel);
			addEventListeners(this.tab_bar, 'mousedown touchstart', (e1: MouseEvent) => {
				if (e1.target != this.tab_bar) return;
				dragPanel(e1, true);
			});

		} else {			

			let close_button = Interface.createElement('div', {class: 'tool panel_control'}, Blockbench.getIconNode('clear'))
			this.tab_bar.append(close_button);
			close_button.addEventListener('click', (e) => {
				Interface.PanelSelectorVue.select(null);
			})
			this.tab_bar.classList.add('single_tab');
			

			addEventListeners(this.handle as HTMLElement, 'mousedown touchstart', (e1: MouseEvent) => {
				convertTouchEvent(e1);
				let started = false;
				let height_before = this.position_data.height;
				let max = Blockbench.isLandscape ? window.innerWidth - 50 : Interface.work_screen.clientHeight;

				let drag = e2 => {
					convertTouchEvent(e2);
					let diff = Blockbench.isLandscape ? e1.clientX - e2.clientX : e1.clientY - e2.clientY;
					if (!started && Math.abs(diff) > 4) {
						started = true;
						if (this.folded) this.fold();
					}
					if (!started) return;
					
					let sign = (Blockbench.isLandscape && settings.mobile_panel_side.value == 'left') ? -1 : 1;
					this.position_data.height = Math.clamp(height_before + diff * sign, this.min_height, max);

					this.update(true);
					resizeWindow();

				}
				let stop = e2 => {
					convertTouchEvent(e2);

					this.update();
					
					removeEventListeners(document, 'mousemove touchmove', drag);
					removeEventListeners(document, 'mouseup touchend', stop);
				}
				addEventListeners(document, 'mousemove touchmove', drag);
				addEventListeners(document, 'mouseup touchend', stop);

			})
		}
		this.container.addEventListener('mousedown', event => {
			this.moveToFront();
		})
		this.node.addEventListener('mousedown', event => {
			setActivePanel(this.id);
		})
		this.handle.addEventListener('mousedown', event => {
			setActivePanel(this.id);
			this.moveToFront();
		})
		
		// Add to slot
		if (!Blockbench.isMobile && !this.attached_to) {
			let reference_panel = Panels[data.insert_before || data.insert_after];
			this.moveTo(this.position_data.slot, reference_panel, reference_panel && !data.insert_after);
		}

		if (this.folded) this.fold(true);

		Panels[this.id] = this;
	}
	isVisible() {
		return !this.folded && this.node.parentElement && this.node.parentElement.style.display !== 'none';
	}
	isInSidebar() {
		return this.slot === 'left_bar' || this.slot === 'right_bar';
	}
	get position_data(): PanelPositionData {
		const mode = Interface.getUIMode();
		if (!this.mode_position_data[mode]) {
			let default_config = this.default_configuration;
			let mode_data = Object.assign({}, DEFAULT_POSITION_DATA);
			if (default_config.default_position) Object.assign(mode_data, default_config.default_position);
			if (default_config.mode_positions?.[mode]) Object.assign(mode_data, default_config.mode_positions?.[mode]);
			if (StoredPanelData[this.id]?.[mode]) Object.assign(mode_data, StoredPanelData[this.id][mode]);

			this.mode_position_data[mode] = mode_data;
		}
		return this.mode_position_data[mode];

	}
	get slot() {
		return this.position_data.slot;
	}
	get folded() {
		return this.position_data.folded;
	}
	set folded(state) {
		this.position_data.folded = !!state;
	}
	get fixed_height() {
		return this.position_data.fixed_height;
	}
	set fixed_height(state) {
		this.position_data.fixed_height = !!state;
	}
	get attached_to() {
		let data = this.position_data.attached_to;
		return data;
	}
	set attached_to(id) {
		this.position_data.attached_to = id;
	}
	get attached_index() {
		return this.position_data.attached_index;
	}
	set attached_index(id: number) {
		this.position_data.attached_index = id;
	}
	get open_attached_panel(): Panel {
		return Panels[this.position_data.open_tab] ?? this;
	}
	set open_attached_panel(panel: Panel | undefined) {
		this.position_data.open_tab = (panel && panel != this) ? panel.id : undefined;
	}
	dispatchEvent(event_name: PanelEvent, data: any): void {
		super.dispatchEvent(event_name, data);
	}
	getAttachedPanels(): Panel[] {
		let panels: Panel[] = [];
		for (let id in Panels) {
			let panel = Panels[id] as Panel;
			if (panel.attached_to == this.id && Condition(panel) && panel != this) {
				panels.push(panel);
			}
		}
		panels.sort((a, b) => b.attached_index - a.attached_index);
		return panels;
	}
	/**
	 * Get the host panel if this panel is attached to another panel
	 */
	getHostPanel(): Panel|undefined {
		return Panels[this.attached_to];
	}
	/**
	 * Get the panel that acts as the container for this panel. If the panel is not attached to another panel, returns itself
	 */
	getContainerPanel(): Panel {
		return Panels[this.attached_to] || this;
	}
	attachPanel(panel: Panel, index?: number) {
		let old_host_panel = panel.getHostPanel();
		let panel_attached_panels = panel.getAttachedPanels();
		panel.customizePosition({
			attached_to: this.id,
			attached_index: index ?? panel.attached_index,
		})

		this.update();
		if (old_host_panel) {
			old_host_panel.update();
		}
		updateInterfacePanels()
		index = panel.attached_index + 1;
		for (let panel of panel_attached_panels) {
			index++;
			this.attachPanel(panel, index);
		}
	}
	selectTab(panel: Panel = this): this {
		if (this.open_attached_panel != panel) {
			this.open_attached_panel = panel;
			this.update();
		}
		return this;
	}
	customizePosition(data?: Partial<PanelPositionData>) {
		let mode = Interface.getUIMode();
		let mode_data = this.mode_position_data[mode];
		if (data) {
			Object.assign(mode_data, data);
		}
		if (!StoredPanelData[this.id]) StoredPanelData[this.id] = {};
		StoredPanelData[this.id][mode] = mode_data;
	}
	resetCustomLayout(): this {
		StoredPanelData[this.id] = {};
		for (let mode_id in this.mode_position_data) {
			delete this.mode_position_data[mode_id];
		}
		this.updateSlot();
		return this;
	}
	addToolbar(toolbar: Toolbar, position = this.toolbars.length): void {
		let nodes = [];
		if (toolbar.label) {
			let label = Interface.createElement('p', {class: 'panel_toolbar_label'}, tl(toolbar.name));
			nodes.push(label);
			toolbar.label_node = label;
		}
		nodes.push(toolbar.node);
		if (position == 0) {
			this.node.prepend(...nodes)
		} else if (typeof position == 'string') {
			let anchor = this.node.querySelector(`.toolbar[toolbar_id="${position}"]`);
			if (anchor) {
				anchor.after(...nodes);
			}
		} else {
			this.node.append(...nodes);
		}
		this.toolbars.splice(position, 0, toolbar);
	}
	fold(state = !this.folded): this {
		this.folded = !!state;
		let new_icon = Blockbench.getIconNode(state ? 'expand_less' : 'expand_more');
		$(this.tab_bar).find('> .panel_folding_button > .icon').replaceWith(new_icon);
		this.container.classList.toggle('folded', state);
		if (this.onFold) {
			this.onFold();
		}
		if (this.slot == 'top' || this.slot == 'bottom') {
			resizeWindow();
		}
		this.update();
		this.dispatchEvent('fold', {});
		return this;
	}
	resize(e1: MouseEvent | TouchEvent) {
		e1 = convertTouchEvent(e1);
		let height_before = this.container.clientHeight;
		let started = false;
		let direction = 1;
		if (this.container.classList.contains('bottommost_panel') && !this.container.classList.contains('topmost_panel')) {
			direction = -1;
		}

		let other_panels: Panel[] = this.slot == 'right_bar' ? Interface.getRightPanels() : Interface.getLeftPanels();

		e1.preventDefault();

		let drag = (e2: MouseEvent | TouchEvent) => {
			e2 = convertTouchEvent(e2);
			if (!started && (Math.pow(e2.clientX - e1.clientX, 2) + Math.pow(e2.clientY - e1.clientY, 2)) > 12) {
				started = true;
				this.sidebar_resize_handle.classList.add('dragging');
				makeSidebarFilled(other_panels, this);
			}
			if (!started) return;

			let change_amount = (e2.clientY - e1.clientY) * direction;
			let sidebar_gap = this.container.parentElement.clientHeight;
			for (let panel of other_panels) {
				sidebar_gap -= panel.container.clientHeight;
			}

			let height1 = this.position_data.height;
			this.position_data.fixed_height = true;
			this.position_data.height = Math.max(height_before + change_amount, this.min_height);
			this.update();
		}
		let stop = e2 => {
			convertTouchEvent(e2);
			
			removeEventListeners(document, 'mousemove touchmove', drag);
			removeEventListeners(document, 'mouseup touchend', stop);
			this.sidebar_resize_handle.classList.remove('dragging');
			makeSidebarFilled(other_panels, this);
		}
		addEventListeners(document, 'mousemove touchmove', drag);
		addEventListeners(document, 'mouseup touchend', stop);
	}
	setupFloatHandles(): this {
		let sides = [
			Interface.createElement('div', {class: 'panel_resize_side resize_top'}),
			Interface.createElement('div', {class: 'panel_resize_side resize_bottom'}),
			Interface.createElement('div', {class: 'panel_resize_side resize_left'}),
			Interface.createElement('div', {class: 'panel_resize_side resize_right'}),
		];
		let corners = [
			Interface.createElement('div', {class: 'panel_resize_corner resize_top_left'}),
			Interface.createElement('div', {class: 'panel_resize_corner resize_top_right'}),
			Interface.createElement('div', {class: 'panel_resize_corner resize_bottom_left'}),
			Interface.createElement('div', {class: 'panel_resize_corner resize_bottom_right'}),
		];
		let resize = (e1, direction_x, direction_y) => {
			let position_before = this.position_data.float_position.slice();
			let size_before = [this.width, this.height];
			let started = false;

			let drag = (e2: MouseEvent) => {
				convertTouchEvent(e2);
				if (!started && (Math.pow(e2.clientX - e1.clientX, 2) + Math.pow(e2.clientY - e1.clientY, 2)) > 12) {
					started = true;
				}
				if (!started) return;

				this.position_data.float_size[0] = size_before[0] + (e2.clientX - e1.clientX) * direction_x;
				this.position_data.float_size[1] = size_before[1] + (e2.clientY - e1.clientY) * direction_y;

				let min_height = this.min_height ?? 60;
				let panel = this.container.querySelector('.panel');
				if (panel && !panel.classList.contains('grow')) {
					min_height = Math.max(min_height, panel.clientHeight+this.tab_bar.clientHeight);
				}
				this.position_data.float_size[1] = Math.clamp(this.position_data.float_size[1], min_height, window.innerHeight);

				if (direction_x == -1) this.position_data.float_position[0] = position_before[0] - this.position_data.float_size[0] + size_before[0];
				if (direction_y == -1) this.position_data.float_position[1] = position_before[1] - this.position_data.float_size[1] + size_before[1];

				this.update();
			}
			let stop = e2 => {
				convertTouchEvent(e2);
				
				removeEventListeners(document, 'mousemove touchmove', drag);
				removeEventListeners(document, 'mouseup touchend', stop);
			}
			addEventListeners(document, 'mousemove touchmove', drag);
			addEventListeners(document, 'mouseup touchend', stop);
		}
		addEventListeners(sides[0], 'mousedown touchstart', (event) => resize(event, 0, -1));
		addEventListeners(sides[1], 'mousedown touchstart', (event) => resize(event, 0, 1));
		addEventListeners(sides[2], 'mousedown touchstart', (event) => resize(event, -1, 0));
		addEventListeners(sides[3], 'mousedown touchstart', (event) => resize(event, 1, 0));
		addEventListeners(corners[0], 'mousedown touchstart', (event) => resize(event, -1, -1));
		addEventListeners(corners[1], 'mousedown touchstart', (event) => resize(event, 1, -1));
		addEventListeners(corners[2], 'mousedown touchstart', (event) => resize(event, -1, 1));
		addEventListeners(corners[3], 'mousedown touchstart', (event) => resize(event, 1, 1));

		let handles = Interface.createElement('div', {class: 'panel_resize_handle_wrapper'}, [...sides, ...corners]);
		this.container.append(handles);
		this.resize_handles = handles;
		return this;
	}
	moveToFront(): this {
		if (this.slot == 'float' && Panel.floating_panel_z_order[0] !== this.id) {
			Panel.floating_panel_z_order.remove(this.id);
			Panel.floating_panel_z_order.splice(0, 0, this.id);
			let zindex = 18;
			Panel.floating_panel_z_order.forEach(id => {
				let panel = Panels[id];
				panel.container.style.zIndex = zindex.toString();
				panel.dispatchEvent('change_zindex', {zindex});
				zindex = Math.clamp(zindex-1, 14, 19);
			})
		}
		return this;
	}
	moveTo(slot: PanelSlot, ref_panel?: Panel, before = false): this {
		let position_data = this.position_data;
		if (slot == undefined) {
			slot = ref_panel.position_data.slot;
		}
		if (slot !== this.slot) {
			this.previous_slot = this.slot;
		}

		// Reset attachment
		this.position_data.attached_to = '';
		this.position_data.attached_index = 0;
		this.container.append(this.node);

		this.dispatchEvent('move_to', {slot, ref_panel, before, previous_slot: this.previous_slot});

		this.node.classList.remove('floating');

		if (slot == 'left_bar' || slot == 'right_bar') {
			document.getElementById(slot)!.append(this.container);
			if (ref_panel) {
				let panel_order = Interface.calculateSidebarOrder(slot);
				panel_order.remove(this.id);
				let sign = before ? -1 : 1;
				let sidebar_index = ref_panel.position_data.sidebar_index + sign;
				this.customizePosition({sidebar_index});
				for (let i = panel_order.indexOf(ref_panel.id) + sign; panel_order[i]; i += sign) {
					let panel = Panels[panel_order[i]];
					sidebar_index += sign;
					if ((sign == 1 && panel.position_data.sidebar_index < sidebar_index) || (sign == -1 && panel.position_data.sidebar_index > sidebar_index)) {
						panel.customizePosition({sidebar_index});
						console.log('Re-index', panel.id, sidebar_index);
					}
				}
			}
			updateSidebarOrder();

		} else if (slot == 'top') {
			let top_panel = Interface.getTopPanel();
			if (top_panel && top_panel !== this && !Condition.mutuallyExclusive(this.condition, top_panel.condition)) {
				top_panel.moveTo(top_panel.previous_slot);
			}
			document.getElementById('top_slot')!.append(this.container);

		} else if (slot == 'bottom') {
			let bottom_panel = Interface.getBottomPanel();
			if (bottom_panel && bottom_panel !== this && !Condition.mutuallyExclusive(this.condition, bottom_panel.condition)) {
				bottom_panel.moveTo(bottom_panel.previous_slot);
			}
			document.getElementById('bottom_slot')!.append(this.container);

		} else if (slot == 'float' && !Blockbench.isMobile) {
			Interface.work_screen.append(this.container);
			this.node.classList.add('floating');
			this.dispatchEvent('change_zindex', {zindex: 14});
			if (!this.resize_handles) {
				this.setupFloatHandles();
			}
		} else if (slot == 'hidden' && !Blockbench.isMobile) {
			this.node.remove();
		}
		if (slot !== 'float') {
			Panel.floating_panel_z_order.remove(this.id);
			this.node.style.zIndex = '';
			this.dispatchEvent('change_zindex', {zindex: null});
		}
		position_data.slot = slot;

		if (this.position_data && (this.previous_slot == 'right_bar' || this.previous_slot == 'left_bar')) {
			makeSidebarFilled(this.previous_slot, this);
		}
		
		this.updateSlot();
		if (Panels[this.id]) {
			this.dispatchEvent('moved_to', {slot, ref_panel, before, previous_slot: this.previous_slot});
		}
		return this;
	}
	updateSlot(): this {
		let slot = this.slot;

		this.container.classList.remove('floating');

		if (slot == 'left_bar' || slot == 'right_bar') {

			document.getElementById(slot)!.append(this.container);

		} else if (slot == 'top') {
			document.getElementById('top_slot')!.append(this.container);

		} else if (slot == 'bottom') {
			document.getElementById('bottom_slot')!.append(this.container);

		} else if (slot == 'float' && !Blockbench.isMobile) {
			Interface.work_screen.append(this.container);
			this.container.classList.add('floating');
			this.dispatchEvent('change_zindex', {zindex: 14});
			if (!this.resize_handles) {
				this.setupFloatHandles();
			}
		} else if (slot == 'hidden') {
			this.container.remove();
		}
		if (slot !== 'float') {
			Panel.floating_panel_z_order.remove(this.id);
			this.container.style.zIndex = '';
			this.dispatchEvent('change_zindex', {zindex: null});
		}
		if (this.folded != this.container.classList.contains('folded')) {
			this.folded = !!this.folded;
			let new_icon = Blockbench.getIconNode(this.folded ? 'expand_less' : 'expand_more');
			$(this.handle).find('> .panel_folding_button > .icon').replaceWith(new_icon);
			this.container.classList.toggle('folded', this.folded);
			if (this.onFold) {
				this.onFold();
			}
		}
		
		this.customizePosition();
		this.update();

		if (Panels[this.id]) {
			TickUpdates.interface = true;
		}
		return this;
	}
	update(dragging: boolean = false) {
		let show = BARS.condition(this.condition);
		if (!Blockbench.isMobile) {
			// Hide panel if its in host panel
			if (this.getHostPanel() && Condition(this.getHostPanel().condition)) show = false;
		}
		let {work_screen, center_screen} = Interface;
		let slot = this.slot;
		let is_sidebar = slot == 'left_bar' || slot == 'right_bar';
		if (show) {
			this.container.classList.remove('hidden');
			this.node.classList.remove('attached');
			if (slot == 'float') {
				if (!dragging && work_screen.clientWidth) {
					this.position_data.float_position[0] = Math.clamp(this.position_data.float_position[0], 0, work_screen.clientWidth - this.width);
					this.position_data.float_position[1] = Math.clamp(this.position_data.float_position[1], 0, work_screen.clientHeight - this.height);
					this.position_data.float_size[0] = Math.clamp(this.position_data.float_size[0], 200, work_screen.clientWidth - this.position_data.float_position[0]);
					this.position_data.float_size[1] = Math.clamp(this.position_data.float_size[1], 86, work_screen.clientHeight - this.position_data.float_position[1]);
				}
				this.container.style.left = this.position_data.float_position[0] + 'px';
				this.container.style.top = this.position_data.float_position[1] + 'px';
				this.width  = this.position_data.float_size[0];
				this.height = this.position_data.float_size[1];
				if (this.folded) this.height = this.tab_bar.clientHeight;
				this.container.style.width = this.width + 'px';
				this.container.style.height = this.height + 'px';
				this.container.classList.remove('bottommost_panel');
				this.container.classList.remove('topmost_panel');
			} else {
				this.container.style.width = this.container.style.left = this.container.style.top = null;
			}
			if (Blockbench.isMobile) {
				this.width = this.container.clientWidth;
			} else if (slot == 'left_bar') {
				this.width = Interface.left_bar_width;
			} else if (slot == 'right_bar') {
				this.width = Interface.right_bar_width;
			}
			if (slot == 'top' || slot == 'bottom') {

				if (Blockbench.isMobile && Blockbench.isLandscape) {
					this.height = center_screen.clientHeight;
					this.width = Math.clamp(this.position_data.height, 30, center_screen.clientWidth);
					if (this.folded) this.width = 72;
				} else {
					let opposite_panel = slot == 'top' ? Interface.getBottomPanel() : Interface.getTopPanel();
					this.height = Math.clamp(this.position_data.height, 30, center_screen.clientHeight - (opposite_panel ? opposite_panel.height : 0));
					if (this.folded) this.height = this.tab_bar.clientHeight;
					this.width = Interface.work_screen.clientWidth - Interface.left_bar_width - Interface.right_bar_width;
				}
				this.container.style.width = this.width + 'px';
				this.container.style.height = this.height + 'px';
			} else if (is_sidebar) {
				if (this.fixed_height) {
					//let other_panels = slot == 'left_bar' ? Interface.getLeftPanels() : Interface.getRightPanels();
					//let available_height = (slot == 'left_bar' ? Interface.left_bar : Interface.right_bar).clientHeight;
					//let min_height = other_panels.reduce((sum, panel) => (panel == this ? sum : (sum - panel.node.clientHeight)), available_height);
					this.height = Math.clamp(this.position_data.height, 30, Interface.work_screen.clientHeight);
					this.container.style.height = this.height + 'px';
					this.container.classList.add('fixed_height');
				} else {
					this.container.style.height = null;
				}
			}
			if (!this.fixed_height) this.container.classList.remove('fixed_height');

			if (this.sidebar_resize_handle) {
				this.sidebar_resize_handle.style.display = (is_sidebar) ? 'block' : 'none';
			}
			if ((slot == 'right_bar' && Interface.getRightPanels(true).last() == this) || (slot == 'left_bar' && Interface.getLeftPanels().last() == this)) {
				this.node.parentElement?.childNodes.forEach((n: HTMLElement) => n.classList.remove('bottommost_panel'));
				this.container.classList.add('bottommost_panel');
			}
			if ((slot == 'right_bar' && Interface.getRightPanels(true)[0] == this) || (slot == 'left_bar' && Interface.getLeftPanels()[0] == this)) {
				this.node.parentElement?.childNodes.forEach((n: HTMLElement) => n.classList.remove('topmost_panel'));
				this.container.classList.add('topmost_panel');
			}

			if (this.node.clientHeight == 0 && this.open_attached_panel != this && !this.container.style.getPropertyValue('--main-panel-height')) {
				// If panel acts as container but other panel is open, set main panel height the first time its opened to ensure tabs have the same height
				this.container.append(this.node);
				let height = this.node.clientHeight;
				if (height) this.container.style.setProperty('--main-panel-height', height + 'px');
				this.node.remove();

			} else if (this.node.clientHeight) {
				this.container.style.setProperty('--main-panel-height', this.node.clientHeight + 'px');
			}

			// Update child panels
			for (let panel of this.getAttachedPanels()) {
				panel.width = this.width;
				panel.height = this.height;
				if (panel.onResize) panel.onResize();
			}

			if (Panels[this.id] && this.onResize) this.onResize()
		} else {
			this.container.classList.add('hidden');
		}

		if (show && !this.attached_to && !Blockbench.isMobile) {
			// This is a host panel. Update the tabs and attached panels
			if (this.open_attached_panel && this.getAttachedPanels().includes(this.open_attached_panel) == false) {
				this.open_attached_panel = this;
			}
			let tabs: Panel[] = [this]
			tabs.safePush(...this.getAttachedPanels());
			this.tab_bar.firstElementChild.textContent = '';
			let tab_amount = 0;
			for (let panel of tabs) {
				this.tab_bar.firstElementChild.append(panel.handle);
				panel.handle.classList.toggle('selected', this.open_attached_panel == panel);
				tab_amount++;
			}
			
			if (this.id == 'uv') {
				this.id = 'uv'
			}
			let panel_is_appended = false;
			for (let panel_node of this.container.querySelectorAll('.panel')) {
				if (panel_node == this.open_attached_panel.node) {
					panel_is_appended = true;
				} else {
					panel_node.remove();
				}
			}
			if (!panel_is_appended) {
				this.container.append(this.open_attached_panel.node);
			}
			if (this.open_attached_panel != this) this.open_attached_panel.node.classList.add('attached');
			this.tab_bar.classList.toggle('single_tab', tab_amount <= 1);
		}

		this.dispatchEvent('update', {show});
		localStorage.setItem('interface_data', JSON.stringify(Interface.data))
		return this;
	}
	//Delete
	delete() {
		delete Panels[this.id];
		this.node.remove();
		this.container.remove();
		updateInterfacePanels();
	}
	static selected: Panel | undefined
	static floating_panel_z_order: string[] = []
}
export interface Panel {
	snap_menu: Menu
}
Panel.prototype.snap_menu = new Menu([
	{
		id: 'move_to',
		name: 'menu.panel.move_to',
		icon: 'drag_handle',
		condition: () => !Blockbench.isMobile,
		children: (panel: Panel) => ([
			{
				name: 'menu.panel.move_to.left_bar',
				icon: 'align_horizontal_left',
				marked: panel => panel.slot == 'left_bar' && !panel.attached_to,
				click: (panel) => {
					panel.fixed_height = false;
					panel.moveTo('left_bar');
				}
			},
			{
				name: 'menu.panel.move_to.right_bar',
				icon: 'align_horizontal_right',
				marked: panel => panel.slot == 'right_bar' && !panel.attached_to,
				click: (panel) => {
					panel.fixed_height = false;
					panel.moveTo('right_bar');
				}
			},
			{
				name: 'menu.panel.move_to.top',
				icon: 'align_vertical_top',
				marked: panel => panel.slot == 'top' && !panel.attached_to,
				click: (panel) => {
					panel.fixed_height = false;
					panel.moveTo('top');
				}
			},
			{
				name: 'menu.panel.move_to.bottom',
				icon: 'align_vertical_bottom',
				marked: panel => panel.slot == 'bottom' && !panel.attached_to,
				click: (panel) => {
					panel.fixed_height = false;
					panel.moveTo('bottom');
				}
			},
			{
				name: 'menu.panel.move_to.float',
				icon: 'web_asset',
				marked: panel => panel.slot == 'float' && !panel.attached_to,
				click: (panel) => {
					panel.fixed_height = false;
					panel.moveTo('float');
				}
			},
			'_',
			{
				name: 'menu.panel.move_to.hidden',
				icon: 'web_asset_off',
				marked: panel => panel.slot == 'hidden' && !panel.attached_to,
				condition: panel => (panel.optional && panel.slot != 'hidden'),
				click: (panel) => {
					panel.fixed_height = false;
					panel.moveTo('hidden');
				}
			}
		])
	},
	{
		id: 'move_to',
		name: 'menu.panel.attach_to',
		icon: 'fa-diagram-next',
		condition: () => !Blockbench.isMobile,
		children: (panel: Panel) => {
			let options: CustomMenuItem[] = [];
			for (let id in Panels) {
				let panel2: Panel = Panels[id];
				if (!Condition(panel2.condition) || panel2.attached_to || panel2.id == panel.attached_to || panel2 == panel) continue;
				options.push({
					id: panel2.id,
					name: panel2.name,
					icon: panel2.icon,
					click() {
						panel2.attachPanel(panel);
					}
				})
			}
			return options;
		}
	},
	{
		id: 'fold',
		name: 'menu.panel.fold',
		icon: (panel: Panel) => panel.getContainerPanel().folded == true,
		condition: (panel: Panel) => panel.getContainerPanel().slot != 'hidden' && !Blockbench.isMobile,
		click(panel: Panel) {
			panel.getContainerPanel().fold();
		}
	},
	{
		id: 'enable',
		name: 'menu.panel.enable',
		icon: (panel: Panel) => panel.slot != 'hidden',
		condition: (panel: Panel) => Blockbench.isMobile,
		click(panel: Panel) {
			panel.fixed_height = false;
			if (panel.slot == 'hidden') {
				panel.moveTo('bottom');
			} else {
				panel.moveTo('hidden');
			}
		}
	},
	{
		id: 'reset_size',
		name: 'menu.panel.reset_size',
		icon: 'lock_reset',
		condition: (panel: Panel) => panel.fixed_height,
		click(panel: Panel) {
			panel.fixed_height = false;
			panel.update();
		}
	}
])


export const Panels: Record<string, Panel> = {};
Interface.Panels = Panels;
Interface.panel_definers = []
Interface.definePanels = function(callback) {
	Interface.panel_definers.push(callback);
};

const StoredPanelData: Record<string, Record<string, PanelPositionData>> = {};
try {
	let data = JSON.parse(localStorage.getItem('panel_customization'));
	if (data && typeof data == 'object') {
		for (let panel_id in data) {
			StoredPanelData[panel_id] = data[panel_id];
		}
	}
} catch (err) {}

export function setupPanels() {
	Interface.panel_definers.forEach((definer) => {
		if (typeof definer === 'function') {
			definer()
		}
	})
	updateSidebarOrder();
}

export function makeSidebarFilled(target: Panel[] | 'left_bar' | 'right_bar', exclude_panel?: Panel) {
	if (!Project) return;
	let panels: Panel[];
	try {
		if (typeof target == 'string') {
			panels = target == 'right_bar' ? Interface.getRightPanels() : Interface.getLeftPanels();
		} else {
			panels = target;
		}
		if (exclude_panel) {
			panels = panels.slice();
			panels.remove(exclude_panel);
		}
		let flex_panel = panels.find(p => p.growable && !p.position_data.fixed_height);
		if (!flex_panel) {
			flex_panel = panels.find(p => p.growable && p.position_data.fixed_height);
			if (!flex_panel) return;
			flex_panel.position_data.fixed_height = false;
			flex_panel.update();
		}
	} catch (err) {
		console.error(err);
	}
}

export function updateInterfacePanels() {

	if (!Blockbench.isMobile) {
		Interface.left_bar.style.display = Prop.show_left_bar ? 'flex' : 'none';
		Interface.right_bar.style.display = Prop.show_right_bar ? 'flex' : 'none';
	}

	Interface.work_screen.style.setProperty(
		'grid-template-columns',
		Interface.left_bar_width+'px auto '+ Interface.right_bar_width +'px'
	)
	for (var key in Interface.Panels) {
		var panel: Panel = Panels[key];
		panel.update();
	}
	var left_width = Interface.left_bar.querySelector('.panel_container:not(.hidden)') ? Interface.left_bar_width : 0;
	var right_width = Interface.right_bar.querySelector('.panel_container:not(.hidden)') ? Interface.right_bar_width : 0;

	if (!left_width || !right_width) {
		Interface.work_screen.style.setProperty(
			'grid-template-columns',
			left_width+'px auto '+ right_width +'px'
		)
	}

	Interface.preview.style.visibility = Interface.preview.clientHeight > 80 ? 'visible' : 'hidden';

	let height = document.getElementById('center')!.clientHeight;
	height -= Interface.getBottomPanel()?.height || 0;
	height -= Interface.getTopPanel()?.height || 0;
	Interface.preview.style.height = height > 0 ? (height + 'px') : '';

	if (Preview.split_screen.enabled) {
		Preview.split_screen.updateSize()
	}
	for (var key in Interface.Resizers) {
		var resizer = Interface.Resizers[key]
		resizer.update()
	}
	updateSidebarOrder();
	localStorage.setItem('panel_customization', JSON.stringify(StoredPanelData));
}

export function updateSidebarOrder() {
	['left_bar', 'right_bar'].forEach(bar => {
		let bar_node = document.querySelector(`.sidebar#${bar}`);
		let current_panels = Array.from(bar_node.childNodes).map(panel_node => (panel_node as HTMLElement).getAttribute('panel_id')).filter(panel_id => {
			return Panels[panel_id] && Condition(Panels[panel_id].condition) && !Panels[panel_id].attached_to;
		});

		let target_order = Interface.calculateSidebarOrder(bar) as string[];
		let last_panel: Panel;
		let panel_count = 0;
		target_order.forEach((panel_id: string) => {
			let panel: Panel = Panels[panel_id];
			panel.container.classList.remove('bottommost_panel');
			panel.container.classList.remove('topmost_panel');
			if (!panel.attached_to && Condition(panel.condition)) {
				if (current_panels[panel_count] != panel_id) {
					if (panel.id == 'uv' && !Blockbench.isMobile) UVEditor.saveViewportOffset()
					bar_node.append(panel.container);
					if (panel.id == 'uv' && !Blockbench.isMobile) UVEditor.loadViewportOffset()
				}
				if (panel_count == 0) {
					panel.container.classList.add('topmost_panel');
				}
				panel_count++;
				last_panel = panel;
			} else {
				panel.container.remove();
			}
		});
		if (last_panel && panel_count > 1) {
			last_panel.container.classList.add('bottommost_panel');
		}
	})
}
export function updatePanelSelector() {
	if (!Blockbench.isMobile) return;

	Interface.PanelSelectorVue.$forceUpdate();
	let bottom_panel = Interface.getBottomPanel();
	if (bottom_panel && !Condition(bottom_panel.display_condition)) {
		Interface.PanelSelectorVue.select(null);
	}
}

export function setActivePanel(panel_id: string) {
	Prop.active_panel = panel_id;
	Panel.selected = Panels[panel_id];
}

export function setupMobilePanelSelector() {
	Interface.PanelSelectorVue = new Vue({
		el: '#panel_selector_bar',
		data: {
			all_panels: Interface.Panels,
			selected: null,
			modifiers: Pressing.overrides
		},
		computed: {
		},
		methods: {
			panels() {
				let arr = [];
				for (var id in this.all_panels) {
					let panel = this.all_panels[id];
					if (Condition(panel.condition) && Condition(panel.display_condition) && panel.slot != 'hidden') {
						arr.push(panel);
					}
				}
				return arr;
			},
			select(panel: Panel) {
				this.selected = panel && panel.id;
				for (let key in Panels) {
					let panel_b = Panels[key];
					if (panel_b.slot == 'bottom') {
						$(panel_b.container).detach();
						panel_b.position_data.slot = 'left_bar';
					}
				}
				if (panel) {
					panel.moveTo('bottom');
				} else {
					resizeWindow();
				}
			},
			openKeyboardMenu() {
				openTouchKeyboardModifierMenu(this.$refs.mobile_keyboard_menu);
			},
			Condition,
			getIconNode: Blockbench.getIconNode
		},
		template: `
			<div id="panel_selector_bar">
				<div class="panel_selector" :class="{selected: selected == null}" @click="select(null)">
					<div class="icon_wrapper"><i class="material-icons icon">3d_rotation</i></div>
				</div>
				<div class="panel_selector" :class="{selected: selected == panel.id}" v-for="panel in panels()" v-if="Condition(panel.condition)" @click="select(panel)">
					<div class="icon_wrapper" v-html="getIconNode(panel.icon).outerHTML"></div>
				</div>
				<div id="mobile_keyboard_menu" @click="openKeyboardMenu()" ref="mobile_keyboard_menu" :class="{enabled: modifiers.ctrl || modifiers.shift || modifiers.alt}">
					<i class="material-icons">keyboard</i>
				</div>
			</div>`
	})
}

Object.assign(window, {
	Panel,
	Panels,
	setupPanels,
	updateInterfacePanels,
	updateSidebarOrder,
	updatePanelSelector,
	setActivePanel,
	setupMobilePanelSelector,
});
