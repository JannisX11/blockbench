import { Blockbench } from "../api";
import { translateUI } from "../languages";
import { currentwindow } from "../native_apis";
import { isTouchEvent } from "../util/util";
import { CustomElements } from "./custom_elements";
import { CustomMenuItem } from "./menu";
import { ResizeLine, setupResizeLines } from "./resize_lines";
import "./status_bar"

interface UIData {
	left_bar_width: number
	right_bar_width: number
	quad_view_x: number
	quad_view_y: number
	timeline_head: number
	start_screen_width: number
	modes?: Record<string, Partial<UIData>>
}
type ModifierKey = 'ctrl' | 'shift' | 'alt';

export const Interface = {
	default_data: {
		left_bar_width: 366,
		right_bar_width: 314,
		quad_view_x: 50,
		quad_view_y: 50,
		timeline_head: Blockbench.isMobile ? 140 : 196,
		start_screen_width: 1000,
		modes: {},
	} as UIData,
	data: null as UIData,

	get left_bar_width(): number {
		if (Prop.show_left_bar && Interface.getLeftPanels(false).length) { 
			return Interface.getModeData()?.left_bar_width ?? Interface.data.left_bar_width;
		}
		return 0;
	},
	get right_bar_width(): number {
		if (Prop.show_right_bar && Interface.getRightPanels(false).length) { 
			return Interface.getModeData()?.right_bar_width ?? Interface.data.right_bar_width;
		}
		return 0;
	},
	get top_panel_height(): number {
		return 1;
	},
	get bottom_panel_height(): number {
		return 1;
	},
	getTopPanel(): Panel|undefined {
		for (let key in Panels) {
			let panel = Panels[key];
			if (panel.slot == 'top' && Condition(panel.condition)) {
				return panel;
			}
		}
	},
	getBottomPanel(): Panel|undefined {
		for (let key in Panels) {
			let panel = Panels[key];
			if (panel.slot == 'bottom' && Condition(panel.condition)) {
				return panel;
			}
		}
	},
	getLeftPanels(in_order = true): Panel[] {
		return Interface.calculateSidebarOrder('left_bar', in_order).map(p => this.Panels[p]);
	},
	getRightPanels(in_order = true): Panel[] {
		return Interface.calculateSidebarOrder('right_bar', in_order).map(p => this.Panels[p]);
	},
	calculateSidebarOrder(bar: 'left_bar' | 'right_bar', in_order = true): string[] {
		let target_order = [];
		for (let panel_id in Interface.Panels) {
			let panel = Interface.Panels[panel_id];
			if (panel.slot != bar) continue;
			if (!Condition(panel.condition)) continue;
			if (panel.attached_to) continue;
			target_order.push(panel.id);
		}
		if (in_order) {
			target_order.sort((a, b) => {
				let a_i = Panels[a].position_data.sidebar_index;
				let b_i = Panels[b].position_data.sidebar_index;
				return (a_i ?? 0) - (b_i ?? 0);
			})
		}
		return target_order;
	},
	getUIMode(): string {
		let mode_id = Mode.selected && Mode.selected.id;
		if (!mode_id) mode_id = 'start';
		if (mode_id == 'paint' && Format.image_editor) mode_id = 'paint_2d';
		return mode_id;
	},
	getModeData(ui_mode?: string): Partial<UIData> {
		if (!ui_mode) ui_mode = Interface.getUIMode();
		if (ui_mode && ui_mode != 'start') {
			if (!Interface.data.modes[ui_mode]) {
				Interface.data.modes[ui_mode] = {};
			}
			let mode_data = Interface.data.modes[ui_mode];
			if (mode_data.left_bar_width == undefined) mode_data.left_bar_width = Interface.data.left_bar_width;
			if (mode_data.right_bar_width == undefined) mode_data.right_bar_width = Interface.data.right_bar_width;
			return mode_data;
		} else {
			return Interface.data;
		}
	},
	Resizers: ResizeLine.resizers as {
		left: ResizeLine
		right: ResizeLine
		quad_view_x: ResizeLine
		quad_view_y: ResizeLine
		top: ResizeLine
		bottom: ResizeLine
		timeline_head: ResizeLine
		start_screen_width: ResizeLine
		[id: string]: ResizeLine
	},
	CustomElements,
	Panels: {} as Record<string, Panel>,
	PanelSelectorVue: null as any,
	status_bar: {} as {
		menu: Menu
		vue: Vue
	},
	tab_bar: null as Vue,
	text_edit_menu: null as Menu,

	center_screen: null as HTMLElement,
	page_wrapper: null as HTMLElement,
	preview: null as HTMLElement,
	work_screen: null as HTMLElement,
	right_bar: null as HTMLElement,
	left_bar: null as HTMLElement,
	cursor_tooltip: null as HTMLDivElement | null,
	
	createElement<K extends keyof HTMLElementTagNameMap>(
		tag: K,
		attributes?: Record<string, any>,
		content?: string | HTMLElement | (string | HTMLElement)[]
	): HTMLElementTagNameMap[K] {
		let el = document.createElement(tag);
		for (let key in attributes) {
			let value = attributes[key];
			if (value === undefined) continue;
			if (key.startsWith('@')) {
				el.addEventListener(key.substring(1), value);
			} else {
				el.setAttribute(key, attributes[key]);
			}
		}
		if (typeof content == 'string') el.textContent = content;
		if (content instanceof Array) {
			content.forEach(node => el.append(node));
		}
		if (content instanceof HTMLElement) el.append(content);
		return el;
	},
	toggleSidebar(side: 'left' | 'right', status?: boolean) {
		status ??= !Prop[`show_${side}_bar`];
		Prop[`show_${side}_bar`] = !!status;
		resizeWindow();
	},

	addSuggestedModifierKey(key: ModifierKey, text: string) {
		Interface.status_bar.vue.$data.modifier_keys[key].safePush(text);
	},
	removeSuggestedModifierKey(key: ModifierKey, text: string) {
		Interface.status_bar.vue.$data.modifier_keys[key].remove(text);
	}
};


(function() {
	Interface.data = structuredClone(Interface.default_data);
	let interface_data = localStorage.getItem('interface_data');
	if (!interface_data) return;
	try {
		interface_data = JSON.parse(interface_data)
		$.extend(true, Interface.data, interface_data)
	} catch (err) {
		console.error(err);
	}
})()

//Misc
/**
 * Unselects and ends or closes a currently active process in the interface, such as an open menu, or a rename action
 */
export function unselectInterface(event: PointerEvent) {
	let target = event.target as HTMLElement;
	if (
		open_menu &&
		!target.classList.contains('contextMenu') && $('.contextMenu').find(target).length === 0 &&
		$('.menu_bar_point.opened:hover').length === 0 &&
		!document.getElementById('mobile_menu_bar')?.contains(target)
	) {
		Menu.closed_in_this_click = open_menu.id;
		open_menu.hide();

		function mouseUp(e: MouseEvent) {
			delete Menu.closed_in_this_click;
			document.removeEventListener('click', mouseUp);
		}
		document.addEventListener('click', mouseUp);
	}
	if (Dialog.open instanceof ConfigDialog && !Dialog.open.object.contains(target) && (!Menu.open || !Menu.open.node.contains(target))) {
		Dialog.open.close();
	}
	if (ActionControl.open && $('#action_selector').find(target).length === 0 && (!open_menu || open_menu instanceof BarMenu)) {
		ActionControl.hide();
	}
	if ($(target).is('input.cube_name:not([disabled])') === false && Blockbench.hasFlag('renaming')) {
		stopRenameOutliner()
	}
	if (ReferenceImageMode.active &&
		!(target?.closest('.reference_image')) &&
		!ReferenceImageMode.toolbar.node.contains(target) &&
		!ReferenceImage.selected?.toolbar.contains(target) &&
		!Dialog.open &&
		!open_menu
	) {
		ReferenceImageMode.deactivate();
	}
	Blockbench.dispatchEvent('unselect_interface', {event});
}
export function setupInterface() {

	translateUI()

	if (Blockbench.isMobile) document.body.classList.add('is_mobile');
	if (Blockbench.isLandscape) document.body.classList.add('is_landscape');
	if (Blockbench.isTouch) document.body.classList.add('is_touch');

	document.getElementById('title_bar_home_button').title = tl('projects.start_screen');

	document.getElementById('center').classList.toggle('checkerboard', settings.preview_checkerboard.value as boolean);
	document.body.classList.toggle('mobile_sidebar_left', settings.mobile_panel_side.value == 'left');

	setupResizeLines()
	setupPanels()
	
	if (Blockbench.isMobile) {
		setupMobilePanelSelector()
		Prop.show_right_bar = false;
		Prop.show_left_bar = false;
	} else {
		let panel_selector_bar = document.getElementById('panel_selector_bar');
		if (panel_selector_bar) panel_selector_bar.remove();
	}

	if (Blockbench.isMobile) {
		document.getElementById('preview').append(
			document.querySelector('.toolbar_wrapper.narrow.tools')
		);
	}

	//Tooltip Fix
	$(document).on('mouseenter', '.tool', function() {
		let tooltip = $(this).find('div.tooltip')
		if (!tooltip || typeof tooltip.offset() !== 'object') return;
		//Left
		if (tooltip.css('left') === '-4px') {
			tooltip.css('left', 'auto')
		}
		if (-tooltip.offset().left > 4) {
			tooltip.css('left', '-4px')
		}
		//Right
		if (tooltip.css('right') === '-4px') {
			tooltip.css('right', 'auto')
		}

		if ((tooltip.offset().left + tooltip.width()) - window.innerWidth > 4) {
			tooltip.css('right', '-4px')
		} else if ($(this).parent().css('position') == 'relative') {
			tooltip.css('right', '0')
		}
	})

	// Background color
	if (StateMemory.get('viewport_background_color')) {
		document.body.style.setProperty('--custom-preview-background', StateMemory.get('viewport_background_color'));
	}


	// iOS long-press contextmenu fix
	let isIOS =  ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(navigator.platform) ||
		(navigator.userAgent.includes("Mac") && "ontouchend" in document);
	if (isIOS && !isApp) {
		document.addEventListener('touchstart', (e1) => {
			if (e1.touches.length != 1) return;
			let pos1 = e1.touches[0];
			let start_time = Date.now();

			let onEnd = (e2) => {
				document.removeEventListener('touchend', onEnd);
				let pos2 = e2.changedTouches[0];
				let delta = Math.pow(pos1.clientX - pos2.clientX, 2) + Math.pow(pos1.clientY - pos2.clientY, 2);
				if (delta > 50) return;
				let time_passed = (Date.now() - start_time) / 1000;
				if (time_passed < 0.5) return;

				if (e1.target instanceof HTMLElement) {
					let event_data = Object.assign({}, e2);
					event_data.clientX = pos2.clientX;
					event_data.clientY = pos2.clientY;
					let new_event = new PointerEvent('contextmenu', event_data);

					let target = e1.target;
					for (let i = 0; i < 5; i++) {
						if (target instanceof HTMLElement == false) break;
						target.dispatchEvent(new_event);
						if (Menu.open) break;
						if (new_event.cancelBubble == true) break;
						target = target.parentNode as HTMLElement;
					}
				}
			};
			document.addEventListener('touchend', onEnd);
		});
	}


	// Click binds
	Interface.preview.addEventListener('click', e => setActivePanel(Format.image_editor ? 'uv' : 'preview'));
	
	Interface.work_screen.addEventListener('dblclick', event => {
		if (settings.double_click_select_reference.value == false) return;
		let reference = ReferenceImage.active.find(reference => reference.projectMouseCursor(event.clientX, event.clientY));
		if (!reference) return;
		if (document.querySelector('.preview > canvas:hover')) {
			if (Preview.selected.raycast(event)) return;
		} else if (document.querySelector('#preview:hover') && !Format.image_editor) {
			return;
		}
		reference.select();
	});

	$(Panels.timeline.node).mousedown((event) => {
		setActivePanel('timeline');
	})
	addEventListeners(document, 'mousedown touchstart', unselectInterface);

	window.addEventListener('resize', resizeWindow);
	window.addEventListener('orientationchange', () => {
		setTimeout(resizeWindow, 100)
	});

	setProjectTitle()

	Interface.text_edit_menu = new Menu([
		{
			id: 'copy',
			name: 'action.copy',
			icon: 'fa-copy',
			click() {
				document.execCommand('copy');
			}
		},
		{
			id: 'paste',
			name: 'action.paste',
			icon: 'fa-paste',
			click() {
				document.execCommand('paste');
			}
		}
	])

	document.oncontextmenu = function (event) {
		if (!$(event.target).hasClass('allow_default_menu') && (!Blockbench.isTouch || isTouchEvent(event) == false)) {
			let target = event.target as HTMLElement;
			if (target.nodeName === 'INPUT' && $(event.target).is(':focus')) {
				Interface.text_edit_menu.open(event, target);
			}
			return false;
		}
	}

	//Scrolling
	// @ts-ignore
	// TODO: Implement from scratch
	$('input[type="range"]').on('wheel', function (event: WheelEvent) {
		var obj = $(event.target)
		var factor = event.deltaY > 0 ? -1 : 1
		// @ts-ignore
		var val = parseFloat(obj.val()) + parseFloat(obj.attr('step')) * factor
		val = limitNumber(val, obj.attr('min'), obj.attr('max'))

		if (obj.attr('trigger_type')) {
			// @ts-ignore
			DisplayMode.scrollSlider(obj.attr('trigger_type'), val, obj)
			return;
		}

		obj.val(val)
		// eval(obj.attr('oninput'))
		// eval(obj.attr('onmouseup'))
	})

	//Mousemove
	document.addEventListener('pointermove', event => {
		mouse_pos.x = event.clientX;
		mouse_pos.y = event.clientY;

		if (Interface.cursor_tooltip?.textContent) {
			updateCursorTooltip(event);
		}
	})
	updateInterface()
}

function updateCursorTooltip(event?: PointerEvent) {
	let is_touch = event ? event.pointerType == 'touch' : Blockbench.isTouch;
	let offset_y = is_touch ? -72 : 0;
	Interface.cursor_tooltip.style.left = mouse_pos.x + 'px';
	Interface.cursor_tooltip.style.top = (mouse_pos.y + offset_y) + 'px';
}

export function updateInterface() {
	BARS.updateConditions()
	MenuBar.update()
	updatePanelSelector();
	resizeWindow()
	localStorage.setItem('interface_data', JSON.stringify(Interface.data))
	delete TickUpdates.interface;
}

/**
 * Update the size of everything in the UI after the window has been resized or other UI size changes have happeped
 * @param event 
 */
export function resizeWindow(event?: PointerEvent) {
	if (!Preview.all || (event && event.target && event.target !== window)) {
		return;
	}
	Blockbench.isLandscape = window.innerWidth > window.innerHeight;
	document.body.classList.toggle('is_landscape', Blockbench.isLandscape);
	if (Interface.data) {
		updateInterfacePanels()
	}
	Preview.all.forEach(function(prev) {
		if (prev.canvas.isConnected) {
			prev.resize()
			if (!settings.background_rendering.value && !document.hasFocus() && !document.querySelector('#preview:hover')) {
				prev.render();
			}
		}
	})
	ReferenceImage.active.forEach(ref => ref.updateTransform());
	Outliner.elements.forEach(element => {
		if (element.preview_controller.updateWindowSize) {
			element.preview_controller.updateWindowSize(element);
		}
	})
	if (Format.image_editor) {
		UVEditor.updateSize();
	}
	for (let dialog of Dialog.stack) {
		let object = dialog.object;
		let offset = object.getBoundingClientRect();
		if (object.clientWidth + offset.left > window.innerWidth) {
			object.style.left = Math.clamp(window.innerWidth-object.clientWidth, 0, 4e3) + 'px';
		}
		if (object.clientHeight + offset.top > window.innerHeight) {
			object.style.top = Math.clamp(window.innerHeight-object.clientHeight, 0, 4e3) + 'px';
		}
	}
	Blockbench.dispatchEvent('resize_window', {event});
}

/**
 * Update the UI with the title of the current project
 * @param title Title to display. Defaults to the title of the current project
 */
export function setProjectTitle(title?: string) {
	let window_title = 'Blockbench';
	if (title == undefined && Project.name) {
		title = Project.name
	}
	if (title) {
		if (Project) {
			Prop.file_name = Prop.file_name_alt = title
			if (!Project.name) {
				Project.name = title
			}
			if (Format.bone_rig) {
				title = title.replace(/^geometry\./,'').replace(/:[a-z0-9.]+/, '')
			}
		}
		window_title = title+' - Blockbench';
	} else {
		Prop.file_name = Prop.file_name_alt = ''
	}
	if (Project && !Project.saved) window_title = '● ' + window_title;
	document.title = window_title;
	if (!Blockbench.isMobile && !settings.native_window_frame.value) {
		document.getElementById('header_free_bar').innerText = window_title;
	}
}
//Zoom
type SetZoomMode = 'in' | 'out' | 'reset';
export function setZoomLevel(mode: SetZoomMode) {
	if (Prop.active_panel === 'uv') {
		let zoom = UVEditor.zoom
		switch (mode) {
			case 'in':	zoom *= 1.5;  break;
			case 'out':   zoom *= 0.66;  break;
			case 'reset': zoom = 1; break;
		}
		UVEditor.setZoom(zoom);
		if (mode == 'reset') {
			Project.uv_viewport.offset.V2_set(0, 0);
			UVEditor.loadViewportOffset();
		}

	} else if (Prop.active_panel == 'timeline') {
		
		let body = document.getElementById('timeline_body');
		let offsetX = Timeline.vue.$data.scroll_left + (body.clientWidth - Timeline.vue.$data.head_width) / 2;
		
		if (mode == 'reset') {
			let original_size = Timeline.vue.$data.size
			Timeline.vue.$data.size = 200;
			
			body.scrollLeft += (Timeline.vue.$data.size - original_size) * (offsetX / original_size)
		} else {
			let zoom = mode == 'in' ? 1.2 : 0.8;
			let original_size = Timeline.vue.$data.size
			let updated_size = limitNumber(Timeline.vue.$data.size * zoom, 10, 1000)
			Timeline.vue.$data.size = updated_size;
			
			body.scrollLeft += (updated_size - original_size) * (offsetX / original_size)
		}
	} else {
		switch (mode) {
			case 'in':	Preview.selected.controls.dollyIn(1.16);  break;
			case 'out': Preview.selected.controls.dollyOut(1.16);  break;
		}
	}
}

//UI Edit
export function setProgressBar(id: 'main' | string, val: number, time?: number) {
	if (!id || id === 'main') {
		Prop.progress = val;
	} else {
		$('#'+id+' > .progress_bar_inner').animate({width: val*488}, (time??0)-1);
	}
	if (isApp) {
		currentwindow.setProgressBar(val);
	}
}



export function openTouchKeyboardModifierMenu(node) {
	if (Menu.closed_in_this_click == 'mobile_keyboard') return;

	let modifiers = ['ctrl', 'shift', 'alt'];
	let menu = new Menu(
		'mobile_keyboard',
		[
			...modifiers.map(key => {
				let name = tl(`keys.${key}`);
				if (Interface.status_bar.vue.$data.modifier_keys[key].length) {
					name += ' (' + tl(Interface.status_bar.vue.$data.modifier_keys[key].last()) + ')';
				}
				return {
					name,
					icon: Pressing.overrides[key] ? 'check_box' : 'check_box_outline_blank',
					click() {
						Pressing.overrides[key] = !Pressing.overrides[key]
					}
				} as CustomMenuItem;
			}),
			'_',
			{
				name: 'menu.mobile_keyboard.disable_all',
				icon: 'clear_all',
				condition: () => {
					return [Pressing.overrides.ctrl, Pressing.overrides.shift, Pressing.overrides.alt].some(key => key);
				},
				click() {
					Pressing.overrides.ctrl = Pressing.overrides.shift = Pressing.overrides.alt = false;
				}
			},
		]
	);
	menu.open(node);
}


Blockbench.setCursorTooltip = function(text) {
	if (!Interface.cursor_tooltip) {
		Interface.cursor_tooltip = Interface.createElement('div', {id: 'cursor_tooltip'});
	}
	if (text) {
		Interface.cursor_tooltip.textContent = text;
		if (!Interface.cursor_tooltip.parentNode) {
			document.body.append(Interface.cursor_tooltip);
			updateCursorTooltip();
		}
	} else {
		Interface.cursor_tooltip.textContent = '';
		Interface.cursor_tooltip.remove();
	}
};
Blockbench.setProgress = function(progress, time = 0, bar) {
	setProgressBar(bar, progress ?? 0, time);
};

BARS.defineActions(function() {
	
	new Action('reset_layout', {
		icon: 'replay',
		category: 'blockbench',
		click: function () {
			Interface.data = $.extend(true, {}, Interface.default_data);

			for (let id in Panels) {
				let panel = Panels[id];
				panel.resetCustomLayout();
			}

			Prop.show_left_bar = true;
			Prop.show_right_bar = true;

			updateInterfacePanels();

			Blockbench.dispatchEvent('reset_layout', {});

			resizeWindow();
		}
	})
})


const global = {
	Interface,
	CustomElements,
	unselectInterface,
	setupInterface,
	updateInterface,
	resizeWindow,
	setProjectTitle,
	setZoomLevel,
	setProgressBar,
	openTouchKeyboardModifierMenu,
};
declare global {
	const Interface: typeof global.Interface
	const CustomElements: typeof global.CustomElements
	const unselectInterface: typeof global.unselectInterface
	const setupInterface: typeof global.setupInterface
	const updateInterface: typeof global.updateInterface
	const resizeWindow: typeof global.resizeWindow
	const setProjectTitle: typeof global.setProjectTitle
	const setZoomLevel: typeof global.setZoomLevel
	const setProgressBar: typeof global.setProgressBar
	const openTouchKeyboardModifierMenu: typeof global.openTouchKeyboardModifierMenu
}
Object.assign(window, global);
