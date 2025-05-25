(function() {

function buildForm(dialog) {
	dialog.form = new InputForm(dialog.form_config);
	let dialog_content = $(dialog.object).find('.dialog_content');
	dialog_content.append(dialog.form.node);
	dialog.max_label_width = Math.max(dialog.max_label_width, dialog.form.max_label_width);
	if (dialog.form.uses_wide_inputs) dialog.uses_wide_inputs = true;
	dialog.form.on('change', ({result}) => {
		if (dialog.onFormChange) dialog.onFormChange(result);
	})
}
function buildLines(dialog) {
	let dialog_content = $(dialog.object).find('.dialog_content')
	dialog.lines.forEach(l => {
		if (typeof l === 'object' && (l.label || l.widget)) {

			let bar = Interface.createElement('div', {class: 'dialog_bar'});
			if (l.label) {
				label = Interface.createElement('label', {class: 'name_space_left'}, tl(l.label)+(l.nocolon?'':':'))
				bar.append(label);
				dialog.max_label_width = Math.max(getStringWidth(label.textContent), dialog.max_label_width)
			}
			if (l.node) {
				bar.append(l.node)
			} else if (l.widget) {
				let widget = l.widget
				if (typeof l.widget === 'string') {
					widget = BarItems[l.widget]
				} else if (typeof l.widget === 'function') {
					widget = l.widget()
				}
				bar.append(widget.getNode())
				dialog.max_label_width = Math.max(getStringWidth(widget.name), dialog.max_label_width)
			}
			dialog.uses_wide_inputs = true;
			dialog_content.append(bar);
		} else {
			dialog_content.append(l);
		}
	})
}
function buildComponent(dialog) {
	let dialog_content = $(dialog.object).find('.dialog_content').get(0);
	let mount;
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

const toggle_sidebar = window.innerWidth < 640;
class DialogSidebar {
	constructor(options, dialog) {
		this.open = !toggle_sidebar;
		this.pages = options.pages || {};
		this.page = options.page || Object.keys(this.pages)[0];
		this.actions = options.actions || {};
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
			let li = document.createElement('li');
			let page = this.pages[key];
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
					action = BarItems[action];
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
	setPage(page) {
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

window.Dialog = class Dialog {
	constructor(id, options) {
		if (typeof id == 'object') {
			options = id;
			id = options.id;
		}
		this.id = id;
		this.title = options.title || options.name;
		
		this.lines = options.lines
		this.form_config = options.form
		this.component = options.component
		this.part_order = options.part_order || (options.form_first ? ['form', 'lines', 'component'] : ['lines', 'form', 'component'])

		this.sidebar = options.sidebar ? new DialogSidebar(options.sidebar, this) : null;
		this.title_menu = options.title_menu || null;
		if (options.progress_bar) {
			this.progress_bar = {
				setProgress: (progress) => {
					this.progress_bar.progress = progress;
					if (this.progress_bar.node) {
						this.progress_bar.node.style.setProperty('--progress', progress);
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
	
		this.object;
	}
	confirm(event) {
		this.close(this.confirmIndex, event);
	}
	cancel(event) {
		this.close(this.cancelIndex, event);
	}
	updateFormValues(initial) {
		return this.form.getResult(initial);
	}
	setFormValues(values, update = true) {
		this.form.setValues(values, update);
	}
	setFormToggles(values, update = true) {
		this.form.setToggles(values, update);
	}
	getFormResult() {
		return this.form?.getResult();
	}
	close(button, event) {
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
				this.title_menu.show(menu_button);
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
			)
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
			addEventListeners(resize_handle, 'mousedown touchstart', e1 => {
				convertTouchEvent(e1);
				resize_handle.classList.add('dragging');

				let start_position = [e1.clientX, e1.clientY];
				if (!this.width) this.width = this.object.clientWidth;
				let original_width = this.width;
				let original_left = parseFloat(this.object.style.left);
				let original_height = parseFloat(this.object.style.height) || this.object.clientHeight;


				let move = e2 => {
					convertTouchEvent(e2);
					
					if (this.resizable.includes('x')) {
						let x_offset = (e2.clientX - start_position[0]);
						this.width = original_width + x_offset * 2;
						this.object.style.width = this.width+'px';
						if (this.draggable !== false) {
							this.object.style.left = Math.clamp(original_left - (this.object.clientWidth - original_width) / 2, 0, window.innerWidth) + 'px';
						}
					}
					if (this.resizable.includes('y')) {
						let y_offset = (e2.clientY - start_position[1]);
						let height = Math.clamp(original_height + y_offset, 80, window.innerHeight);
						this.object.style.height = height+'px';
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
		this.resize_observer = new ResizeObserver(sanitizePosition).observe(this.object);

		if (typeof this.onBuild == 'function') {
			this.onBuild(this.object);
		}

		return this;
	}
	show() {
		// Hide previous
		if (window.open_interface && open_interface instanceof Dialog == false && typeof open_interface.hide == 'function') {
			open_interface.hide();
		}

		if (!this.object) {
			this.build();
		} else if (this.form) {
			this.form.updateValues(true);
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
		blackout.style.zIndex = 20 + Dialog.stack.length * 2;
		this.object.style.zIndex = 21 + Dialog.stack.length * 2;

		Prop._previous_active_panel = Prop.active_panel;
		Prop.active_panel = 'dialog';
		open_dialog = this.id;
		open_interface = this;
		Dialog.open = this;
		Dialog.stack.push(this);
	}
	hide() {
		$('#blackout').hide().toggleClass('darken', true);
		$(this.object).hide();
		open_dialog = false;
		open_interface = false;
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
	getFormBar(form_id) {
		var bar = $(this.object).find(`.form_bar_${form_id}`)
		if (bar.length) return bar;
	}
}
window.Dialog.stack = [];

window.ShapelessDialog = class ShapelessDialog extends Dialog {
	constructor(id, options) {
		super(id, options);

		if (options.build) this.build = options.build;
		if (options.onClose) this.onClose = options.onClose;
	}
	close(button, event) {
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
	show() {
		super.show()
		$(this.object).show();
	}
	build() {
		this.object = Interface.createElement('div', {id: this.id, class: 'shapeless_dialog'});

		if (this.component) {
			this.component.name = 'dialog-content';
			this.content_vue = new Vue(this.component).$mount(this.object, true);
		}
	}
	delete() {
		if (this.object) this.object.remove()
		this.object = null;
	}
}

window.MessageBox = class MessageBox extends Dialog {
	constructor(options, callback) {
		super(options.id, options);
		this.options = options;
		if (!options.buttons) this.buttons = ['dialog.ok'];
		this.cancelIndex = Math.min(this.buttons.length-1, this.cancelIndex);
		this.confirmIndex = Math.min(this.buttons.length-1, this.confirmIndex);
		this.callback = callback;
	}
	close(button, result, event) {
		if (this.callback) {
			let allow_close = this.callback(button, result, event);
			if (allow_close === false) return;
		}
		this.hide();
		this.delete();
	}
	build() {
		let options = this.options;

		let results;

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
			for (let id in options.commands) {
				let command = options.commands[id];
				if (!command || !Condition(command.condition)) continue;
				let text = tl(typeof command == 'string' ? command : command.text);
				let entry = Interface.createElement('li', {class: 'dialog_message_box_command'}, text);
				if (command.icon) {
					entry.prepend(Blockbench.getIconNode(command.icon));
				}
				if (command.description) {
					let label = Interface.createElement('label', {}, tl(command.description));
					entry.append(label);
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
				results[id] = !!checkbox.value;
				if (!checkbox || !Condition(checkbox.condition)) continue;

				let text = tl(typeof checkbox == 'string' ? checkbox : checkbox.text);
				let entry = Interface.createElement('li', {class: 'dialog_message_box_checkbox'}, [
					Interface.createElement('input', {type: 'checkbox', id: 'dialog_message_box_checkbox_'+id}),
					Interface.createElement('label', {for: 'dialog_message_box_checkbox_'+id, checked: !!checkbox.value}, text)
				])
				entry.firstElementChild.addEventListener('change', e => {
					results[id] = e.target.checked;
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
	}
	delete() {
		if (this.object) this.object.remove()
		this.object = null;
	}
}

window.ToolConfig = class ToolConfig extends Dialog {
	constructor(id, options) {
		super(id, options);

		this.options = {};
		let config_saved_data = localStorage.getItem(`tool_config.${this.id}`);
		try {
			config_saved_data = JSON.parse(config_saved_data);
			if (!config_saved_data) config_saved_data = {};
		} catch (err) {
			config_saved_data = {};
		}
		for (let key in options.form) {
			if (key == 'enabled' && BarItem.constructing instanceof Toggle) {
				this.options[key] = BarItem.constructing.value;
				continue;
			}
			this.options[key] = config_saved_data[key] ?? InputForm.getDefaultValue(options.form[key]);
		}
	}
	save() {
		localStorage.setItem(`tool_config.${this.id}`, JSON.stringify(this.options));
		return this;
	}
	changeOptions(options) {
		for (let key in options) {
			this.options[key] = options[key];
		}
		if (this.form) {
			this.form.setValues(options);
		}
		this.save();
		return this;
	}
	close(button, event) {
		this.save();
		this.hide();
	}
	show(anchor) {
		super.show()
		$('#blackout').hide();

		this.setFormValues(this.options, false);
		
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
		this.object.className = 'dialog tool_config';

		this.max_label_width = 140;
		this.uses_wide_inputs = false;

		let title_bar;
		if (this.title) {
			title_bar = Interface.createElement('div', {class: 'tool_config_title'}, tl(this.title));
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
			for (let key in result) {
				this.options[key] = result[key];
			}
			if (this.onFormChange) this.onFormChange(result);
		})

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

})()

// Legacy Dialog
function showDialog() {
	console.warn('"showDialog" is no longer supported!')
}
function hideDialog() {
	console.warn('"hideDialog" is no longer supported!')
}

