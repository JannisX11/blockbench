import { Blockbench } from "../api"
import { Prop } from "../misc"
import { FormElementOptions, FormResultValue, InputForm, InputFormConfig } from "./form"
import { Vue } from './../lib/libs'
import { getStringWidth } from "../util/util"

interface ActionInterface {
	name: string
	description?: string
	icon: string
	color?: string
	click(event: Event): void
	condition?: ConditionResolvable
}
type DialogLineOptions = (
	| HTMLElement
	| {
			label?: string
			widget?: Widget | (() => Widget)
			nocolon?: boolean
			node?: HTMLElement
	  }
	| string
)

function buildForm(dialog: Dialog) {
	dialog.form = new InputForm(dialog.form_config);
	let dialog_content = $(dialog.object).find('.dialog_content');
	dialog_content.append(dialog.form.node);
	dialog.max_label_width = Math.max(dialog.max_label_width, dialog.form.max_label_width);
	if (dialog.form.uses_wide_inputs) dialog.uses_wide_inputs = true;
	dialog.form.on('change', ({result}) => {
		if (dialog.onFormChange) dialog.onFormChange(result);
	})
}
function buildLines(dialog: Dialog) {
	let dialog_content = dialog.object.querySelector('.dialog_content');
	dialog.lines.forEach(l => {
		if (typeof l === 'object' && ('label' in l || 'widget' in l)) {

			let bar = Interface.createElement('div', {class: 'dialog_bar'});
			if (l.label) {
				let label = Interface.createElement('label', {class: 'name_space_left'}, tl(l.label))
				bar.append(label);
				dialog.max_label_width = Math.max(getStringWidth(label.textContent), dialog.max_label_width)
			}
			if (l.node) {
				bar.append(l.node)
			} else if (l.widget) {
				let widget: Widget;
				if (typeof l.widget === 'string') {
					widget = BarItems[l.widget]
				} else if (typeof l.widget === 'function') {
					widget = l.widget()
				} else {
					widget = l.widget
				}
				bar.append(widget.getNode());
				dialog.max_label_width = Math.max(getStringWidth(widget.name), dialog.max_label_width)
			}
			dialog.uses_wide_inputs = true;
			dialog_content.append(bar);
		} else if (typeof l == 'string') {
			if (l.match(/^\s*</)) {
				let template = document.createElement('template');
				template.innerHTML = l;
				dialog_content.append(template.content);
				console.warn('Usage of HTML template string in dialog "lines" is deprecated');
			} else {
				dialog_content.append(document.createTextNode(l));
			}
		} else if (l instanceof HTMLElement) {
			dialog_content.append(l);
		}
	})
}
function buildComponent(dialog: Dialog) {
	let dialog_content = $(dialog.object).find('.dialog_content').get(0);
	let mount: HTMLElement;
	// mount_directly, if enabled, skips one layer of wrapper. Class "dialog_content" must be added the the root element of the vue component.
	if (dialog.component.mount_directly) {
		mount = dialog_content;
	} else {
		mount = Interface.createElement('div');
		dialog_content.append(mount);
	}
	dialog.component.name = 'dialog-content'
	dialog.content_vue = new Vue(dialog.component).$mount(mount);
}
function buildToolbars(dialog: Dialog) {
	let dialog_content = $(dialog.object).find('.dialog_content')
	for (let id in dialog.toolbars) {
		let toolbar = dialog.toolbars[id];
		dialog_content.append(toolbar.node);
	}
}

const toggle_sidebar = window.innerWidth < 640;
interface DialogSidebarOptions {
	pages?: {
		[key: string]: string | { label: string; icon: IconString; color?: string } | MenuSeparator
	}
	page?: string
	actions?: (Action | ActionInterface | string)[]
	onPageSwitch?(page: string): void
}
export class DialogSidebar {
	open: boolean
	pages: {
		[key: string]: string | { label: string; icon: IconString; color?: string } | MenuSeparator
	}
	page: string
	actions: (Action | ActionInterface | string)[]
	dialog: Dialog

	node: HTMLDivElement
	page_menu: Record<string, HTMLLIElement>
	onPageSwitch?(page: string): void

	constructor(options: DialogSidebarOptions, dialog: Dialog) {
		this.open = !toggle_sidebar;
		this.pages = options.pages || {};
		this.page = options.page || Object.keys(this.pages)[0];
		this.actions = options.actions || [];
		this.dialog = dialog;
		this.onPageSwitch = options.onPageSwitch || null;
	}
	build() {
		this.node = document.createElement('div');
		this.node.className = 'dialog_sidebar';

		let page_list = document.createElement('ul');
		page_list.className = 'dialog_sidebar_pages';
		this.node.append(page_list);
		this.page_menu = {};
		for (let key in this.pages) {
			let page = this.pages[key];
			if (page instanceof MenuSeparator) {
				let expander = Interface.createElement('span');
				// @ts-ignore I don't even know what typescript is thinking here
				let node = Interface.createElement('div', {class: 'dialog_sidebar_separator'}, page ? [page.label, expander] : expander);
				page_list.append(node);
				continue;
			}
			let li = document.createElement('li');
			if (typeof page == 'object' && page.icon) {
				li.append(Blockbench.getIconNode(page.icon, page.color));
			}
			li.append(typeof page == 'string' ? tl(page) : tl(page.label));
			li.setAttribute('page', key);
			if (this.page == key) li.classList.add('selected');
			this.page_menu[key] = li;
			li.addEventListener('click', event => {
				this.setPage(key);
				if (toggle_sidebar) this.toggle();
			})
			page_list.append(li);
		}

		if (this.actions.length) {
			let action_list = document.createElement('ul');
			action_list.className = 'dialog_sidebar_actions';
			this.node.append(action_list);
			this.actions.forEach(action => {
				if (typeof action == 'string') {
					action = BarItems[action] as Action;
				}
				let copy;
				if (action instanceof Action) {
					copy = action.menu_node.cloneNode(true);
					copy.addEventListener('click', event => {
						action.trigger(event);
					})
				} else {
					copy = document.createElement('li');
					copy.title = action.description ? tl(action.description) : '';
					let icon = Blockbench.getIconNode(action.icon, action.color);
					let span = document.createElement('span');
					span.textContent = tl(action.name);
					copy.append(icon);
					copy.append(span);
					copy.addEventListener('click', event => {
						action.click(event);
					})
				}
				action_list.append(copy);
			})
		}

		this.toggle(this.open);

		this.dialog.object.querySelector('div.dialog_wrapper').append(this.node);
		return this.node;
	}
	toggle(state = !this.open) {
		this.open = state;
		if (this.node.parentElement) {
			this.node.parentElement.classList.toggle('has_sidebar', this.open);
		}
	}
	setPage(page: string) {
		let allow;
		if (this.onPageSwitch) allow = this.onPageSwitch(page);
		if (allow === false) return;
		this.page = page;
		for (let key in this.page_menu) {
			let li = this.page_menu[key];
			li.classList.toggle('selected', key == this.page);
		}
	}
}


interface DialogOptions {
	title: string
	id?: string
	icon?: IconString
	width?: number
	/**
	 * Unless set to false, clicking on the darkened area outside of the dialog will cancel the dialog.
	 */
	cancel_on_click_outside?: boolean
	/**
	 * Default button to press to confirm the dialog. Defaults to the first button.
	 */
	confirmIndex?: number
	/**
	 * Default button to press to cancel the dialog. Defaults to the last button.
	 */
	cancelIndex?: number
	/**
	 * Function to execute when the dialog is opened
	 */
	onOpen?(): void
	/**
	 *  Function to execute when the user confirms the dialog
	 */
	onConfirm?(formResult: any, event: Event): void | boolean
	/**
	 * Function to execute when the user cancels the dialog
	 */
	onCancel?(event: Event): void | boolean
	/**
	 * Triggered when the user presses a specific button
	 */
	onButton?(button_index: number, event?: Event): void | boolean
	/**
	 * Triggered when the user attemps to close the dialog
	 */
	onClose?(button_index: number, event?: Event): void | boolean
	/**
	 * Runs when the dialog is resized
	 */
	onResize?(): void
	/**
	 * Runs when the dialog is built
	 */
	onBuild?(): void
	/**
	 * Function to run when anything in the form is changed
	 */
	onFormChange?(form_result: { [key: string]: FormResultValue }): void
	/**
	 * Array of HTML any strings for each line of content in the dialog.
	 */
	lines?: DialogLineOptions[]
	/**
	 * Creates a form in the dialog
	 */
	form?: InputFormConfig
	/**
	 * Vue component
	 */
	component?: Vue.Component
	/**
	 * Order that the different interface types appear in the dialog. Default is 'form', 'lines', 'component'.
	 */
	part_order?: string[]
	form_first?: boolean
	/**
	 * Creates a dialog sidebar
	 */
	sidebar?: DialogSidebarOptions
	toolbars?: Record<string, Toolbar>
	/**
	 * Menu in the handle bar
	 */
	title_menu?: Menu
	/**
	 * Display a progress bar in the dialog
	 */
	progress_bar?: {
		/**
		 * A progress value between 0 and 1
		 */
		progress?: number
	}
	/**
	 * If true, the dialog will only have one button to close it
	 */
	singleButton?: boolean
	/**
	 * List of buttons
	 */
	buttons?: string[]
	/**
	 * A list of keyboard shortcuts that only work inside the dialog
	 */
	keyboard_actions?: {
		[id: string]: {
			keybind: Keybind
			run: (event: KeyboardEvent) => void
			condition?: ConditionResolvable
		}
	}
	/**
	 * Select on which axes the dialog can be resized. None by default
	 */
	resizable?: 'x' | 'y' | 'xy' | boolean
	/**
	 * Set to false to stop the dialog from being dragged around
	 */
	draggable?: false
	/**
	 * Create a dark backdrop behind the dialog
	 */
	darken?: boolean
}
export class Dialog {
	id: string
	title: string
	object: HTMLElement
	content_vue: Vue | null
	progress_bar?: {
		/**
		 * The current progress
		 */
		progress?: number
		/**
		 * Set the progress displayed in the progress bar
		 * @param value A progress value between 0 and 1
		 */
		setProgress(value: number): void
		/**
		 * The progress bar HTML node
		 */
		node?: HTMLDivElement
	}

	confirmIndex: number
	cancelIndex: number

	
	lines?: DialogLineOptions[]
	form?: InputForm
	component?: Vue.Component
	part_order?: string[]
	form_first?: boolean
	sidebar?: DialogSidebar
	title_menu?: Menu
	singleButton?: boolean
	buttons?: string[]
	keyboard_actions?: {
		[id: string]: {
			keybind: Keybind
			run: (event: KeyboardEvent) => void
			condition?: ConditionResolvable
		}
	}
	resizable?: 'x' | 'y' | 'xy' | false

	configuration: DialogOptions
	toolbars: Record<string, Toolbar>
	form_config: InputFormConfig
	width: number
	draggable: boolean
	darken: boolean
	cancel_on_click_outside: boolean
	max_label_width?: number
	uses_wide_inputs?: boolean
	onConfirm?(formResult: any, event: Event): void | boolean
	onCancel?(event: Event): void | boolean
	onButton?(button_index: number, event?: Event): void | boolean
	onFormChange?(form_result: { [key: string]: FormResultValue }): void
	onOpen: () => void
	onBuild: (object: HTMLElement) => void
	onResize: () => void

	constructor(options: DialogOptions)
	constructor(id: string, options: DialogOptions)
	constructor(id: string | DialogOptions, options?: DialogOptions) {
		if (typeof id == 'object') {
			options = id;
			id = options.id;
		}
		this.id = id;
		this.title = options.title;
		
		this.lines = options.lines;
		this.toolbars = options.toolbars
		this.form_config = options.form
		this.component = options.component
		this.content_vue = null;
		this.part_order = options.part_order || (options.form_first ? ['form', 'lines', 'component'] : ['lines', 'form', 'component'])

		this.sidebar = options.sidebar ? new DialogSidebar(options.sidebar, this) : null;
		this.title_menu = options.title_menu || null;
		if (options.progress_bar) {
			this.progress_bar = {
				setProgress: (progress: number) => {
					this.progress_bar.progress = progress;
					if (this.progress_bar.node) {
						this.progress_bar.node.style.setProperty('--progress', progress.toString());
					}
				},
				progress: options.progress_bar.progress ?? 0,
				node: null
			}
		}

		this.width = options.width
		this.draggable = options.draggable
		this.resizable = options.resizable === true ? 'xy' : options.resizable;
		this.darken = options.darken !== false
		this.cancel_on_click_outside = options.cancel_on_click_outside !== false
		this.singleButton = options.singleButton
		this.buttons = options.buttons instanceof Array ? options.buttons : (options.singleButton ? ['dialog.close'] : ['dialog.confirm', 'dialog.cancel'])
		this.form_first = options.form_first;
		this.confirmIndex = options.confirmIndex||0;
		this.cancelIndex = options.cancelIndex !== undefined ? options.cancelIndex : this.buttons.length-1;
		this.keyboard_actions = options.keyboard_actions || {};
	
		this.onConfirm = options.onConfirm;
		this.onCancel = options.onCancel;
		this.onButton = options.onButton || options.onClose;
		this.onFormChange = options.onFormChange;
		this.onOpen = options.onOpen;
		this.onBuild = options.onBuild;
		this.onResize = options.onResize;
	
		this.object;
	}
	/**
	 * Triggers the confirm event of the dialog.
	 */
	confirm(event?: Event) {
		this.close(this.confirmIndex, event);
	}
	/**
	 * Triggers the cancel event of the dialog.
	 */
	cancel(event?: Event) {
		this.close(this.cancelIndex, event);
	}
	updateFormValues(initial?: boolean) {
		return this.form.getResult();
	}
	/**
	 * Set the values of the dialog form inputs
	 * @param values The values to set, by form input key
	 * @param update Whether to update the dialog (call onFormChange) after setting the values. Default is true. Set to false when called from onFormChange
	 */
	setFormValues(values: Record<string, FormResultValue>, update = true) {
		this.form.setValues(values, update);
	}
	/**
	 * Set whether the dialog form inputs are toggled on or off. See "toggle_enabled"
	 * @param values
	 * @param update Whether to update the dialog (call onFormChange) after setting the values. Default is true. Set to false when called from onFormChange
	 */
	setFormToggles(values: Record<string, boolean>, update = true) {
		this.form.setToggles(values, update);
	}
	getFormResult() {
		return this.form?.getResult();
	}
	close(button: number = this.cancelIndex, event?: Event) {
		if (button == this.confirmIndex && typeof this.onConfirm == 'function') {
			let formResult = this.getFormResult() ?? {};
			let result = this.onConfirm(formResult, event);
			if (result === false) return;
		}
		if (button == this.cancelIndex && typeof this.onCancel == 'function') {
			let result = this.onCancel(event);
			if (result === false) return;
		}
		if (typeof this.onButton == 'function') {
			let result = this.onButton(button, event);
			if (result === false) return;
		}
		this.hide();
	}
	build() {
		if (this.object) this.object.remove();
		this.object = document.createElement('dialog');
		this.object.className = 'dialog';
		this.object.id = this.id;

		let handle = document.createElement('div');
		handle.className = 'dialog_handle';
		this.object.append(handle);
		
		if (this.title_menu) {
			let menu_button = document.createElement('div');
			menu_button.className = 'dialog_menu_button';
			menu_button.append(Blockbench.getIconNode('expand_more'));
			menu_button.addEventListener('click', event => {
				this.title_menu.open(menu_button);
			})
			handle.append(menu_button);
		}

		let title = document.createElement('div');
		title.className = 'dialog_title';
		title.textContent = tl(this.title);
		handle.append(title);

		let jq_dialog = $(this.object);
		this.max_label_width = 140;
		this.uses_wide_inputs = false;

		let wrapper = document.createElement('div');
		wrapper.className = 'dialog_wrapper';

		let content = document.createElement('content');
		content.className = 'dialog_content';
		this.object.append(wrapper);
		

		if (this.sidebar) {
			if (window.innerWidth < 920) {
				let menu_button = document.createElement('div');
				menu_button.className = 'dialog_sidebar_menu_button';
				menu_button.append(Blockbench.getIconNode('menu'));
				menu_button.addEventListener('click', event => {
					this.sidebar.toggle();
				})
				handle.prepend(menu_button);
			}

			this.sidebar.build();
			wrapper.classList.toggle('has_sidebar', this.sidebar.open);
		}

		wrapper.append(content);

		this.part_order.forEach(part => {
			if (part == 'form' && this.form_config) buildForm(this);
			if (part == 'lines' && this.lines) buildLines(this);
			if (part == 'toolbars' && this.toolbars) buildToolbars(this);
			if (part == 'component' && this.component) buildComponent(this);
		})

		if (this.max_label_width) {
			let width = (this.width||540)
			let max_width = this.uses_wide_inputs
				? Math.clamp(this.max_label_width+9, 0, width/2)
				: Math.clamp(this.max_label_width+16, 0, width - 100);
			this.object.style.setProperty('--max_label_width', max_width + 'px');
		}

		if (this.progress_bar) {
			this.progress_bar.node = Interface.createElement('div', {class: 'progress_bar'},
				Interface.createElement('div', {class: 'progress_bar_inner'})
			) as HTMLDivElement;
			this.progress_bar.setProgress(this.progress_bar.progress);
			this.object.querySelector('content.dialog_content').append(this.progress_bar.node);
		}

		if (this.buttons.length) {

			let buttons = []
			this.buttons.forEach((b, i) => {
				let btn = Interface.createElement('button', {type: 'button'}, tl(b));
				buttons.push(btn);
				btn.addEventListener('click', (event) => {
					this.close(i, event);
				})
			})
			buttons[this.confirmIndex] && buttons[this.confirmIndex].classList.add('confirm_btn')
			buttons[this.cancelIndex] && buttons[this.cancelIndex].classList.add('cancel_btn')
			let button_bar = $('<div class="dialog_bar button_bar"></div>');

			buttons.forEach((button, i) => {
				button_bar.append(button)
			})

			wrapper.append(button_bar[0]);
		}

		let close_button = document.createElement('div');
		close_button.classList.add('dialog_close_button');
		close_button.innerHTML = '<i class="material-icons">clear</i>';
		jq_dialog.append(close_button);
		close_button.addEventListener('click', (e) => {
			this.cancel();
		})
		//Draggable
		if (this.draggable !== false) {
			jq_dialog.addClass('draggable')
			// @ts-ignore Draggable library doesn't have types
			jq_dialog.draggable({
				handle: ".dialog_handle",
				containment: '#page_wrapper'
			})
			jq_dialog.css('position', 'absolute')
		}
		if (this.resizable) {
			this.object.classList.add('resizable')
			let resize_handle = Interface.createElement('div', {class: 'dialog_resize_handle'});
			jq_dialog.append(resize_handle);
			if (this.resizable == 'x') {
				resize_handle.style.cursor = 'e-resize';
			} else if (this.resizable == 'y') {
				resize_handle.style.cursor = 's-resize';
			}
			addEventListeners(resize_handle, 'mousedown touchstart', (e1: PointerEvent) => {
				convertTouchEvent(e1);
				resize_handle.classList.add('dragging');

				let start_position = [e1.clientX, e1.clientY];
				if (!this.width) this.width = this.object.clientWidth;
				let original_width = this.width;
				let original_left = parseFloat(this.object.style.left);
				let original_height = parseFloat(this.object.style.height) || this.object.clientHeight;


				let move = (e2: PointerEvent) => {
					convertTouchEvent(e2);
					
					if (this.resizable && this.resizable.includes('x')) {
						let x_offset = (e2.clientX - start_position[0]);
						this.width = original_width + x_offset * 2;
						this.object.style.width = this.width+'px';
						if (this.draggable !== false) {
							this.object.style.left = Math.clamp(original_left - (this.object.clientWidth - original_width) / 2, 0, window.innerWidth) + 'px';
						}
					}
					if (this.resizable && this.resizable.includes('y')) {
						let y_offset = (e2.clientY - start_position[1]);
						let height = Math.clamp(original_height + y_offset, 80, window.innerHeight);
						this.object.style.height = height+'px';
					}
					if (typeof this.onResize == 'function') {
						this.onResize();
					}
				}
				let stop = e2 => {
					removeEventListeners(document, 'mousemove touchmove', move);
					removeEventListeners(document, 'mouseup touchend', stop);
					resize_handle.classList.remove('dragging');
				}
				addEventListeners(document, 'mousemove touchmove', move);
				addEventListeners(document, 'mouseup touchend', stop);
			})
		}
		let sanitizePosition = () => {
			if (this.object.clientHeight + this.object.offsetTop - 26 > Interface.page_wrapper.clientHeight) {
				this.object.style.top = Math.max(Interface.page_wrapper.clientHeight - this.object.clientHeight + 26, 26) + 'px';
			}
		}
		sanitizePosition();
		this.resize_observer = new ResizeObserver(sanitizePosition)
		this.resize_observer.observe(this.object);

		if (typeof this.onBuild == 'function') {
			this.onBuild(this.object);
		}

		return this;
	}
	private resize_observer: ResizeObserver

	show(anchor?: HTMLElement): this {
		// Hide previous
		// @ts-ignore Need to replace this variable still
		if (window.open_interface && open_interface instanceof Dialog == false && typeof open_interface.hide == 'function') {
			open_interface.hide();
		}

		if (!this.object) {
			this.build();
		} else if (this.form) {
			this.form.updateValues({cause: 'setup'});
		}

		let jq_dialog = $(this.object);

		document.getElementById('dialog_wrapper').append(this.object);
		
		if (this instanceof ShapelessDialog === false) {
			this.object.style.display = 'flex';
			this.object.style.top = limitNumber(window.innerHeight/2-this.object.clientHeight/2, 0, 100)+'px';
			if (this.width) {
				this.object.style.width = this.width+'px';
			}
			if (this.draggable !== false) {
				let x = Math.clamp((window.innerWidth-this.object.clientWidth)/2, 0, 2000)
				this.object.style.left = x+'px';
			}
		}

		if (!Blockbench.isTouch) {
			let first_focus = jq_dialog.find('.focusable_input').first();
			if (first_focus) first_focus.trigger('focus');
		}

		if (typeof this.onOpen == 'function') {
			this.onOpen();
		}

		this.focus();

		setTimeout(() => {
			this.object.style.setProperty('--dialog-height', this.object.clientHeight + 'px');
			this.object.style.setProperty('--dialog-width', this.object.clientWidth + 'px');
		}, 1);

		return this;
	}
	focus() {
		Dialog.stack.remove(this);
		let blackout = document.getElementById('blackout');
		blackout.style.display = 'block';
		blackout.classList.toggle('darken', this.darken);
		blackout.style.zIndex = (20 + Dialog.stack.length * 2).toString();
		this.object.style.zIndex = (21 + Dialog.stack.length * 2).toString();

		Prop._previous_active_panel = Prop.active_panel;
		Prop.active_panel = 'dialog';
		// @ts-ignore
		window.open_dialog = this.id;
		// @ts-ignore
		window.open_interface = this;
		Dialog.open = this;
		Dialog.stack.push(this);
	}
	hide() {
		$('#blackout').hide().toggleClass('darken', true);
		$(this.object).hide();
		// @ts-ignore
		window.open_dialog = false;
		// @ts-ignore
		window.open_interface = false;
		Dialog.open = null;
		Dialog.stack.remove(this);
		Prop.active_panel = Prop._previous_active_panel;
		$(this.object).detach();
		
		if (Dialog.stack.length) {
			Dialog.stack.last().focus();
		}

		return this;
	}
	delete() {
		$(this.object).remove()
		if (this.content_vue) {
			this.content_vue.$destroy();
			delete this.content_vue;
		}
	}
	getFormBar(form_id: string) {
		var bar = $(this.object).find(`.form_bar_${form_id}`)
		if (bar.length) return bar;
	}

	/**
	 * Currently opened dialog
	 */
	static open: Dialog | null = null;
	/**
	 * Stack of currently open dialogs, ordered by depth
	 */
	static stack: Dialog[] = [];
}

interface ShapelessDialogOptions {
	title: string
	/**
	 * Default button to press to confirm the dialog. Defaults to the first button.
	 */
	confirmIndex?: number
	/**
	 * Default button to press to cancel the dialog. Defaults to the last button.
	 */
	cancelIndex?: number
	/**
	 *  Function to execute when the user confirms the dialog
	 */
	onConfirm?(formResult: any): void
	/**
	 * Function to execute when the user cancels the dialog
	 */
	onCancel?(): void
	/**
	 * Triggered when the user presses a specific button
	 */
	onClose?(button_index: number, event?: Event): void
	/**
	 * Vue component
	 */
	component?: Vue.Component
	/**
	 * Unless set to false, clicking on the darkened area outside of the dialog will cancel the dialog.
	 */
	cancel_on_click_outside?: boolean
}
export class ShapelessDialog extends Dialog {
	onClose?: (event: Event) => void | boolean
	onConfirm?: (event: Event) => void | boolean
	constructor(id: string, options: ShapelessDialogOptions) {
		super(id, options);

		// @ts-ignore
		if (options.build) this.build = options.build;
		// @ts-ignore
		if (options.onClose) this.onClose = options.onClose;
	}
	close(button: number, event: Event) {
		if (button == this.confirmIndex && typeof this.onConfirm == 'function') {
			let result = this.onConfirm(event);
			if (result === false) return;
		}
		if (button == this.cancelIndex && typeof this.onCancel == 'function') {
			let result = this.onCancel(event);
			if (result === false) return;
		}
		if (typeof this.onClose == 'function') {
			let result = this.onClose(event);
			if (result === false) return;
		}
		this.hide();
	}
	show(): this {
		super.show()
		$(this.object).show();
		return this;
	}
	build(): this {
		this.object = Interface.createElement('div', {id: this.id, class: 'shapeless_dialog'});

		if (this.component) {
			this.component.name = 'dialog-content';
			this.content_vue = new Vue(this.component).$mount(this.object, true);
		}
		return this;
	}
	delete() {
		if (this.object) this.object.remove()
		this.object = null;
	}
}
type MessageBoxCommandOptions = string |  {
	text: string
	icon?: IconString
	condition?: ConditionResolvable
	description?: string
	category?: string
}
type MessageBoxCheckbox = string | {
	value?: boolean
	condition: ConditionResolvable
	text: string
}
export interface MessageBoxOptions {
	/**
	 * Index of the confirm button within the buttons array
	 */
	confirm?: number
	/**
	 * Index of the cancel button within the buttons array
	 */
	cancel?: number
	buttons?: string[]
	translateKey?: string
	title?: string
	message?: string
	icon?: IconString
	width?: number
	cancelIndex?: number
	confirmIndex?: number
	/**
	 * Display a list of actions to do in the dialog. When clicked, the message box closes with the string ID of the command as first argument.
	 */
	commands?: Record<string, MessageBoxCommandOptions>
	/**
	 * Adds checkboxes to the bottom of the message box
	 */
	checkboxes?: Record<string, MessageBoxCheckbox>
}
export class MessageBox extends Dialog {
	// @ts-ignore We should rewrite this to use a common internal DialogBase class
	declare configuration: MessageBoxOptions
	callback?: (button: number | string, result?: Record<string, boolean>, event?: Event) => void |boolean

	constructor(options: MessageBoxOptions, callback?: (button: number | string, result?: Record<string, boolean>, event?: Event) => void |boolean) {
		super('message_box', options as DialogOptions);
		this.configuration = options;
		if (!options.buttons) this.buttons = ['dialog.ok'];
		this.cancelIndex = Math.min(this.buttons.length-1, this.cancelIndex);
		this.confirmIndex = Math.min(this.buttons.length-1, this.confirmIndex);
		this.callback = callback;
	}
	// @ts-ignore
	close(button: number | string, result: Record<string, boolean>, event: Event) {
		if (this.callback) {
			let allow_close = this.callback(button, result, event);
			if (allow_close === false) return;
		}
		this.hide();
		this.delete();
	}
	build(): this {
		let options = this.configuration;

		let results: Record<string, boolean>;

		if (options.translateKey) {
			if (!options.title) options.title = tl('message.'+options.translateKey+'.title')
			if (!options.message) options.message = tl('message.'+options.translateKey+'.message')
		}
		let content = Interface.createElement('div', {class: 'dialog_content'});
		this.object = Interface.createElement('dialog', {class: 'dialog', style: 'width: auto;', id: 'message_box'}, [
			Interface.createElement('div', {class: 'dialog_handle'}, Interface.createElement('div', {class: 'dialog_title'}, tl(options.title))),
			Interface.createElement('div', {class: 'dialog_close_button', onclick: 'Dialog.open.cancel()'}, Blockbench.getIconNode('clear')),
			content
		]);
		let jq_dialog = $(this.object);

		if (options.message) {
			content.append($(`<div class="dialog_bar markdown" style="height: auto; margin-bottom: 10px;">`+
				pureMarked(tl(options.message))+
			'</div></div>')[0]);
		}
		if (options.icon) {
			let bar = jq_dialog.find('.dialog_bar');
			bar.prepend($(Blockbench.getIconNode(options.icon)).addClass('message_box_icon'));
			bar.append('<div style="clear:both;"></div>');
		}

		if (options.commands) {
			let list = Interface.createElement('ul');
			let category: string;
			for (let id in options.commands) {
				let command = options.commands[id];
				if (!command || (typeof command == 'object' && !Condition(command.condition))) continue;
				let text = tl(typeof command == 'string' ? command : command.text);
				if (typeof command == 'object' && command.category && command.category != category) {
					category = command.category;
					let label = Interface.createElement('li', {class: 'dialog_message_box_command_category'}, tl(category));
					list.append(label);
				}
				let entry = Interface.createElement('li', {class: 'dialog_message_box_command'}, text);
				if (typeof command == 'object') {
					if (command.icon) {
						entry.prepend(Blockbench.getIconNode(command.icon));
					}
					if (command.description) {
						let label = Interface.createElement('label', {}, tl(command.description));
						entry.append(label);
					}
				}
				entry.addEventListener('click', e => {
					this.close(id, results, e);
				})
				list.append(entry);
			}
			content.append(list);
		}

		if (options.checkboxes) {
			let list = Interface.createElement('ul', {class: 'dialog_message_box_checkboxes'});
			results = {};
			for (let id in options.checkboxes) {
				let checkbox = options.checkboxes[id];
				results[id] = false;
				if (typeof checkbox == 'object') {
					results[id] = !!checkbox.value;
					if (!Condition(checkbox.condition)) continue;
				}

				let text = tl(typeof checkbox == 'string' ? checkbox : checkbox.text);
				let entry = Interface.createElement('li', {class: 'dialog_message_box_checkbox'}, [
					Interface.createElement('input', {type: 'checkbox', id: 'dialog_message_box_checkbox_'+id}),
					Interface.createElement('label', {for: 'dialog_message_box_checkbox_'+id, checked: results[id]}, text)
				])
				entry.firstElementChild.addEventListener('change', e => {
					results[id] = (e.target as HTMLInputElement).checked;
				})
				list.append(entry);
			}
			content.append(list);
		}

		// Buttons
		if (this.buttons.length) {

			let buttons = []
			this.buttons.forEach((b, i) => {
				let btn = Interface.createElement('button', {type: 'button'}, tl(b));
				buttons.push(btn);
				btn.addEventListener('click', (event) => {
					this.close(i, results, event);
				})
			})
			buttons[this.confirmIndex] && buttons[this.confirmIndex].classList.add('confirm_btn')
			buttons[this.cancelIndex] && buttons[this.cancelIndex].classList.add('cancel_btn')
			let button_bar = $('<div class="dialog_bar button_bar"></div>');

			buttons.forEach((button, i) => {
				button_bar.append(button)
			})

			jq_dialog.append(button_bar[0]);
		}

		//Draggable
		if (this.draggable !== false) {
			jq_dialog.addClass('draggable')
			// @ts-ignore
			jq_dialog.draggable({
				handle: ".dialog_handle",
				containment: '#page_wrapper'
			})
			this.object.style.position = 'absolute';
		}

		let x = (window.innerWidth-540)/2
		this.object.style.left = x+'px';
		this.object.style.position = 'absolute';

		this.object.style.top = limitNumber(window.innerHeight/2-jq_dialog.height()/2 - 140, 0, 2000)+'px';
		if (options.width) {
			this.object.style.width = options.width+'px'
		} else {
			this.object.style.width = limitNumber((options.buttons ? options.buttons.length : 1) * 170+44, 380, 894)+'px';
		}
		return this;
	}
	delete() {
		if (this.object) this.object.remove()
		this.object = null;
	}
}
interface ConfigDialogOptions extends DialogOptions {

}
export class ConfigDialog extends Dialog {
	constructor(id: string, options: ConfigDialogOptions) {
		super(id, options);
	}
	show(anchor: HTMLElement) {
		super.show()
		$('#blackout').hide();
		
		if (anchor instanceof HTMLElement) {
			let anchor_position = $(anchor).offset();
			this.object.style.top = (anchor_position.top+anchor.offsetHeight) + 'px';
			this.object.style.left = Math.clamp(anchor_position.left - 30, 0, window.innerWidth-this.object.clientWidth - (this.title ? 0 : 30)) + 'px';
		}
		return this;
	}
	build() {
		if (this.object) this.object.remove();
		this.object = document.createElement('dialog');
		this.object.className = 'dialog config_dialog';

		this.max_label_width = 140;
		this.uses_wide_inputs = false;

		let title_bar;
		if (this.title) {
			title_bar = Interface.createElement('div', {class: 'config_dialog_title'}, tl(this.title));
			this.object.append(title_bar);
		}

		let wrapper = document.createElement('div');
		wrapper.className = 'dialog_wrapper';

		let content = document.createElement('content');
		content.className = 'dialog_content';
		this.object.append(wrapper);
		
		wrapper.append(content);

		this.form = new InputForm(this.form_config);
		content.append(this.form.node);
		this.max_label_width = Math.max(this.max_label_width, this.form.max_label_width);
		if (this.form.uses_wide_inputs) this.uses_wide_inputs = true;
		this.form.on('change', ({result}) => {
			if (this.configuration) {
				for (let key in result) {
					this.configuration[key] = result[key];
				}
			}
			if (this.onFormChange) this.onFormChange(result);
		})

		if (this.toolbars) {
			buildToolbars(this);
		}

		let close_button = document.createElement('div');
		close_button.classList.add('dialog_close_button');
		close_button.innerHTML = '<i class="material-icons">clear</i>';
		close_button.addEventListener('click', (e) => {
			this.cancel();
		})
		if (title_bar) {
			title_bar.append(close_button);
		} else {
			this.object.append(close_button);
		}

		if (typeof this.onBuild == 'function') {
			this.onBuild(this.object);
		}

		return this;
	}
	delete() {
		if (this.object) this.object.remove()
		this.object = null;
	}
}
export class ToolConfig extends ConfigDialog {
	declare options: {
		[key: string]: FormResultValue
	}
	constructor(id: string, options: ConfigDialogOptions) {
		super(id, options);

		this.options = {};
		let config_saved_data: Record<string, FormResultValue>;
		try {
			let stored = localStorage.getItem(`tool_config.${this.id}`);;
			config_saved_data = JSON.parse(stored);
			if (!config_saved_data) config_saved_data = {};
		} catch (err) {
			config_saved_data = {};
		}
		for (let key in options.form) {
			if (options.form[key] == '_') continue;
			if (key == 'enabled' && BarItem.constructing instanceof Toggle) {
				this.options[key] = BarItem.constructing.value;
				continue;
			}
			this.options[key] = config_saved_data[key] ?? InputForm.getDefaultValue(options.form[key]);
		}
	}
	/**
	 * Open the config menu
	 * @param anchor Optional element to anchor the menu to
	 */
	show(anchor?: HTMLElement): this {
		super.show(anchor);
		this.setFormValues(this.options, false);
		this.form.on('input', ({result, cause}) => {
			this.changeOptions(result)
		})
		return this;
	}
	/**
	 * Save any changes in local storage
	 */
	save() {
		localStorage.setItem(`tool_config.${this.id}`, JSON.stringify(this.options));
		return this;
	}
	/**
	 * Change and save a number of options in the config
	 * @param options Options to set
	 */
	changeOptions(options: Record<string, FormResultValue>): this {
		for (let key in options) {
			this.options[key] = options[key];
		}
		if (this.form) {
			this.form.setValues(options);
		}
		this.save();
		return this;
	}
	close() {
		this.save();
		this.hide();
	}
}


Object.assign(window, {
	DialogSidebar,
	Dialog,
	ShapelessDialog,
	MessageBox,
	ConfigDialog,
	ToolConfig,
});
