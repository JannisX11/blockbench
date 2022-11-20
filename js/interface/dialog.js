(function() {

function buildForm(dialog) {
	let dialog_content = $(dialog.object).find('.dialog_content')
	for (let form_id in dialog.form) {
		let data = dialog.form[form_id]
		form_id = form_id.replace(/"/g, '');
		if (data === '_') {
			dialog_content.append('<hr />')
			
		} else {
			let bar = $(`<div class="dialog_bar form_bar form_bar_${form_id}"></div>`)
			let label;
			if (data.label) {
				label = Interface.createElement('label', {class: 'name_space_left', for: form_id}, tl(data.label)+(data.nocolon?'':':'))
				bar.append(label);
				if (!data.full_width) {
					dialog.max_label_width = Math.max(getStringWidth(label.textContent), dialog.max_label_width)
				}
			}
			if (data.full_width) {
				bar.addClass('full_width_dialog_bar');
				dialog.uses_wide_inputs = true;
			}
			if (data.description) {
				bar.attr('title', tl(data.description))
			}
			let input_element;
			if (['checkbox', 'buttons', 'color', 'info'].includes(data.type) == false) {
				dialog.uses_wide_inputs = true;
			}

			switch (data.type) {
				default:
					input_element = Object.assign(document.createElement('input'), {
						type: 'text',
						className: 'dark_bordered half focusable_input',
						id: form_id,
						value: data.value||'',
						placeholder: data.placeholder||'',
						oninput() {
							dialog.updateFormValues()
						}
					});
					bar.append(input_element)

					if (data.list) {
						let list_id = `${dialog.id}_${form_id}_list`;
						input_element.setAttribute('list', list_id);
						let list = $(`<datalist id="${list_id}"></datalist>`);
						for (let value of data.list) {
							let node = document.createElement('option');
							node.value = value;
							list.append(node);
						}
						bar.append(list);
					}
					if (data.type == 'password') {
						bar.append(`<div class="password_toggle">
								<i class="fas fa-eye-slash"></i>
							</div>`)
						input_element.type = 'password';
						let hidden = true;
						let this_bar = bar;
						let this_input_element = input_element;
						this_bar.find('.password_toggle').on('click', e => {
							hidden = !hidden;
							this_input_element.attributes.type.value = hidden ? 'password' : 'text';
							this_bar.find('.password_toggle i')[0].className = hidden ? 'fas fa-eye-slash' : 'fas fa-eye';
						})
					}
					break;
				case 'textarea':
					input_element = Object.assign(document.createElement('textarea'), {
						className: 'focusable_input',
						id: form_id,
						value: data.value||'',
						placeholder: data.placeholder||'',
						oninput() {
							dialog.updateFormValues()
						}
					});
					input_element.style.height = (data.height || 150) + 'px';
					bar.append(input_element)
					break;


				case 'select':
					let select_input = new Interface.CustomElements.SelectInput(form_id, {
						options: data.options,
						value: data.value || data.default,
						onChange() {
							dialog.updateFormValues();
						}
					});
					data.select_input = select_input;
					bar.append(select_input.node)
					break;


				case 'radio':
					let el = $(`<div class="half form_part_radio" id="${form_id}"></div>`)
					for (let key in data.options) {
						let name = tl(data.options[key])
						el.append(`<div class="form_bar_radio">
							<input type="radio" class="focusable_input" name="${form_id}_radio" id="${key}" ${(data.default || data.value) === key ? 'selected' : ''}>
							<label for="${key}">${name}</label>
						</div>`)
						input_element = el.find(`input#${key}`);
						input_element.on('change', () => {
							dialog.updateFormValues()
						})
					}
					bar.append(el)
					break;


				case 'info':
					data.text = marked(tl(data.text))
					bar.append(`<p>${data.text}</p>`)
					bar.addClass('small_text')
					break;


				case 'buttons':
					let list = document.createElement('div');
					list.className = 'dialog_form_buttons';
					data.buttons.forEach((button_text, index) => {
						let button = document.createElement('a');
						button.innerText = tl(button_text);
						button.addEventListener('click', e => {
							data.click(index, e);
						})
						list.append(button);
					})
					bar.append(list);
					break;


				case 'number':
					input_element = $(`<input class="dark_bordered half focusable_input" type="number" id="${form_id}"
						value="${parseFloat(data.value)||0}" min="${data.min}" max="${data.max}" step="${data.step||1}">`)
					bar.append(input_element)
					input_element.on('change', () => {
						dialog.updateFormValues()
					})
					break;


				case 'range':
					input_element = $(`<input class="half focusable_input" type="range" id="${form_id}"
						value="${parseFloat(data.value)||0}" min="${data.min}" max="${data.max}" step="${data.step||1}">`)
					bar.append(input_element)
					let display = Interface.createElement('span', {class: 'range_input_label'}, (data.value||0).toString())
					bar.append(display);
					input_element.on('input', () => {
						let result = dialog.getFormResult();
						display.textContent = trimFloatNumber(result[form_id]);
					})
					input_element.on('change', () => {
						dialog.updateFormValues();
					})
					break;


				case 'vector':
					let group = $(`<div class="dialog_vector_group half"></div>`)
					bar.append(group)
					for (let i = 0; i < (data.dimensions || 3); i++) {
						input_element = $(`<input class="dark_bordered focusable_input" type="number" id="${form_id}_${i}"
							value="${data.value ? parseFloat(data.value[i]): 0}" step="${data.step||1}" min="${data.min}" max="${data.max}">`)
						group.append(input_element)
						input_element.on('input', () => {
							dialog.updateFormValues()
						})
					}
					break;


				case 'color':
					if (!data.colorpicker) {
						data.colorpicker = new ColorPicker({
							id: 'cp_'+form_id,
							name: tl(data.label),
							label: false,
							private: true,
							value: data.value
						})
					}
					data.colorpicker.onChange = function() {
						dialog.updateFormValues()
					};
					bar.append(data.colorpicker.getNode())
					break;


				case 'checkbox':
					input_element = $(`<input type="checkbox" class="focusable_input" id="${form_id}"${data.value ? ' checked' : ''}>`)
					bar.append(input_element)
					input_element.on('change', () => {
						dialog.updateFormValues()
					})
					break;


				case 'file':
				case 'folder':
				case 'save':
					if (data.type == 'folder' && !isApp) break;

					let input = $(`<input class="dark_bordered half" class="focusable_input" type="text" id="${form_id}" disabled>`);
					input[0].value = data.value || '';
					let input_wrapper = $('<div class="input_wrapper"></div>');
					input_wrapper.append(input);
					bar.append(input_wrapper);
					bar.addClass('form_bar_file');

					switch (data.type) {
						case 'file': 	input_wrapper.append('<i class="material-icons">insert_drive_file</i>'); break;
						case 'folder':	input_wrapper.append('<i class="material-icons">folder</i>'); break;
						case 'save':	input_wrapper.append('<i class="material-icons">save</i>'); break;
					}
					let remove_button = $('<div class="tool" style="float: none; vertical-align: top;"><i class="material-icons">clear</i></div>');
					bar.append(remove_button);
					remove_button.on('click', e => {
						e.stopPropagation();
						data.value = '';
						input.val('');
					})

					input_wrapper.on('click', e => {
						function fileCB(files) {
							data.value = files[0].path;
							data.content = files[0].content;
							input.val(data.value);
							dialog.updateFormValues()
						}
						switch (data.type) {
							case 'file':
								Blockbench.import({
									resource_id: data.resource_id,
									extensions: data.extensions,
									type: data.filetype,
									startpath: data.value,
									readtype: data.readtype
								}, fileCB);
								break;
							case 'folder':
								let path = Blockbench.pickDirectory({
									startpath: data.value,
								})
								if (path) fileCB([{path}]);
								break;
							case 'save':
								Blockbench.export({
									resource_id: data.resource_id,
									extensions: data.extensions,
									type: data.filetype,
									startpath: data.value,
									custom_writer: () => {},
								}, fileCB);
								break;
						}
					})

			}
			if (data.readonly) {
				bar.find('input').attr('readonly', 'readonly').removeClass('focusable_input')
			}
			if (data.description) {
				let icon = document.createElement('i');
				icon.className = 'fa fa-question dialog_form_description';
				icon.onclick = function() {
					Blockbench.showQuickMessage(data.description, 3600);
				}
				bar.append(icon);
			}
			dialog_content.append(bar)
			data.bar = bar;
		}
	}
	dialog.updateFormValues(true)
}
function buildLines(dialog) {
	let dialog_content = $(dialog.object).find('.dialog_content')
	dialog.lines.forEach(l => {
		if (typeof l === 'object' && (l.label || l.widget)) {

			let bar = $('<div class="dialog_bar"></div>')
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
			dialog_content.append(bar)
		} else {
			dialog_content.append(l)
		}
	})
}
function buildComponent(dialog) {
	let dialog_content = $(dialog.object).find('.dialog_content')
	let mount = $(`<div />`).appendTo(dialog_content)
	dialog.component.name = 'dialog-content'
	dialog.content_vue = new Vue(dialog.component).$mount(mount.get(0));
}
function getStringWidth(string, size) {
	let node = Interface.createElement('label', {style: 'position: absolute; visibility: hidden;'}, string);
	if (size && size !== 16) {
		node.style.fontSize = size + 'pt';
	}
	document.body.append(node);
	let width = node.clientWidth;
	node.remove();
	return width + 1;
};

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
		this.id = options.id
		this.title = options.title || options.name;
		
		this.lines = options.lines
		this.form = options.form
		this.component = options.component
		this.part_order = options.part_order || (options.form_first ? ['form', 'lines', 'component'] : ['lines', 'form', 'component'])

		this.sidebar = options.sidebar ? new DialogSidebar(options.sidebar, this) : null;
		this.title_menu = options.title_menu || null;

		this.width = options.width
		this.draggable = options.draggable
		this.darken = options.darken !== false
		this.cancel_on_click_outside = options.cancel_on_click_outside !== false
		this.singleButton = options.singleButton
		this.buttons = options.buttons instanceof Array ? options.buttons : (options.singleButton ? ['dialog.close'] : ['dialog.confirm', 'dialog.cancel'])
		this.form_first = options.form_first;
		this.confirmIndex = options.confirmIndex||0;
		this.cancelIndex = options.cancelIndex !== undefined ? options.cancelIndex : this.buttons.length-1;
	
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
		let form_result = this.getFormResult();
		for (let form_id in this.form) {
			let data = this.form[form_id];
			if (typeof data == 'object' && data.bar) {
				let show = Condition(data.condition, form_result);
				data.bar.toggle(show);
			}
		}
		if (!initial && typeof this.onFormChange == 'function') {
			this.onFormChange(form_result)
		}
		return form_result;
	}
	setFormValues(values) {
		for (let form_id in this.form) {
			let data = this.form[form_id];
			if (values[form_id] != undefined && typeof data == 'object' && data.bar) {
				let value = values[form_id];
				switch (data.type) {
					default:
						data.bar.find('input').val(value);
						break;
					case 'info':
						break;
					case 'textarea':
						data.bar.find('textarea').val(value);
						break;
					case 'select':
						data.select_input.set(value);
						break;
					case 'radio':
						data.bar.find('.form_part_radio input#'+value).prop('checked', value);
						break;
					case 'number': case 'range':
						data.bar.find('input').val(value);
						break;
					case 'vector':
						for (let i = 0; i < (data.dimensions || 3); i++) {
							data.bar.find(`input#${form_id}_${i}`).val(value[i])
						}
						break;
					case 'color':
						data.colorpicker.set(value);
						break;
					case 'checkbox':
						data.bar.find('input').prop('checked', value);
						break;
					case 'file':
						if (isApp) {
							data.value = value;
						} else {
							data.content = value;
						}
						data.bar.find('input').val(value);
						break;
				}
			}
		}
		this.updateFormValues();
	}
	getFormResult() {
		let result = {}
		if (this.form) {
			for (let form_id in this.form) {
				let data = this.form[form_id]
				if (typeof data === 'object') {
					switch (data.type) {
						default:
							result[form_id] = data.bar.find('input#'+form_id).val()
							break;
						case 'info':
							break;
						case 'textarea':
							result[form_id] = data.bar.find('textarea#'+form_id).val()
							break;
						case 'select':
							result[form_id] = data.bar.find('bb-select#'+form_id).attr('value');
							break;
						case 'radio':
							result[form_id] = data.bar.find('.form_part_radio#'+form_id+' input:checked').attr('id')
							break;
						case 'number':
							result[form_id] = Math.clamp(parseFloat(data.bar.find('input#'+form_id).val())||0, data.min, data.max)
							break;
						case 'range':
							result[form_id] = Math.clamp(parseFloat(data.bar.find('input#'+form_id).val())||0, data.min, data.max)
							break;
						case 'vector':
							result[form_id] = [];
							for (let i = 0; i < (data.dimensions || 3); i++) {
								let num = Math.clamp(parseFloat(data.bar.find(`input#${form_id}_${i}`).val())||0, data.min, data.max)
								result[form_id].push(num)
							}
							break;
						case 'color':
							result[form_id] = data.colorpicker.get();
							break;
						case 'checkbox':
							result[form_id] = data.bar.find('input#'+form_id).is(':checked')
							break;
						case 'file':
							result[form_id] = isApp ? data.value : data.content;
							break;
					}
				}
			}
		}
		return result;
	}
	close(button, event) {
		if (button == this.confirmIndex && typeof this.onConfirm == 'function') {
			let formResult = this.getFormResult();
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
		this.max_label_width = 0;
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
			if (part == 'form' && this.form) buildForm(this);
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

		if (this.buttons.length) {

			let buttons = []
			this.buttons.forEach((b, i) => {
				let btn = $('<button type="button">'+tl(b)+'</button> ')
				buttons.push(btn)
				btn.on('click', (event) => {
					this.close(i, event);
				})
			})
			buttons[this.confirmIndex] && buttons[this.confirmIndex].addClass('confirm_btn')
			buttons[this.cancelIndex] && buttons[this.cancelIndex].addClass('cancel_btn')
			let button_bar = $('<div class="dialog_bar button_bar"></div>');

			buttons.forEach((button, i) => {
				if (i) button_bar.append('&nbsp;')
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
		if (window.open_interface && typeof open_interface.hide == 'function') {
			open_interface.hide();
		}
		$('.dialog').hide();

		if (!this.object) {
			this.build();
		}

		let jq_dialog = $(this.object);

		$('#dialog_wrapper').append(jq_dialog);
		$('#blackout').show().toggleClass('darken', this.darken);

		jq_dialog.show().css('display', 'flex');
		jq_dialog.css('top', limitNumber(window.innerHeight/2-jq_dialog.height()/2, 0, 100)+'px');
		if (this.width) {
			jq_dialog.css('width', this.width+'px');
		}
		if (this.draggable !== false) {
			let x = Math.clamp((window.innerWidth-this.object.clientWidth)/2, 0, 2000)
			jq_dialog.css('left', x+'px')
		}
		if (!Blockbench.isTouch) {
			let first_focus = jq_dialog.find('.focusable_input').first();
			if (first_focus) first_focus.trigger('focus');
		}

		open_dialog = this.id;
		open_interface = this;
		Dialog.open = this;
		Prop.active_panel = 'dialog';

		if (typeof this.onOpen == 'function') {
			this.onOpen();
		}

		return this;
	}
	hide() {
		$('#blackout').hide().toggleClass('darken', true);
		$(this.object).hide();
		open_dialog = false;
		open_interface = false;
		Dialog.open = null;
		Prop.active_panel = undefined;
		$(this.object).detach();
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

})()


// Legacy Dialogs
function showDialog(dialog) {
	var obj = $('.dialog#'+dialog)
	$('.dialog').hide()
	if (open_menu) {
		open_menu.hide()
	}
	$('#blackout').show()
	obj.show()
	open_dialog = dialog
	open_interface = {
		confirm() {
			$('dialog#'+open_dialog).find('.confirm_btn:not([disabled])').trigger('click');
		},
		cancel() {
			$('dialog#'+open_dialog).find('.cancel_btn:not([disabled])').trigger('click');
		}
	}
	Prop.active_panel = 'dialog'
	//Draggable
	if (obj.hasClass('draggable')) {
		obj.draggable({
			handle: ".dialog_handle",
			containment: '#page_wrapper'
		})
		var x = (window.innerWidth-obj.outerWidth()) / 2;
		obj.css('left', x+'px')
		obj.css('max-height', (window.innerHeight-128)+'px')
	}
}
function hideDialog() {
	$('#blackout').hide()
	$('.dialog').hide()
	open_dialog = false;
	open_interface = false;
	Prop.active_panel = undefined
}

