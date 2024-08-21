(function() {

function buildForm(dialog) {
	let dialog_content = $(dialog.object).find('.dialog_content')
	for (let form_id in dialog.form) {
		let data = dialog.form[form_id]
		form_id = form_id.replace(/"/g, '');
		if (data === '_') {
			dialog_content.append('<hr />')
			
		} else {
			let bar = $(`<div class="dialog_bar bar form_bar form_bar_${form_id}"></div>`)
			let label;
			if (typeof data.label == 'string') {
				label = Interface.createElement('label', {class: 'name_space_left', for: form_id}, tl(data.label)+((data.nocolon || !data.label)?'':':'))
				bar.append(label);
				if (!data.full_width && data.condition !== false) {
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
						bar.append(`<div class="password_toggle form_input_tool tool">
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
					if (data.share_text && data.value) {
						let text = data.value.toString();
						let is_url = text.startsWith('https://');

						let copy_button = Interface.createElement('div', {class: 'form_input_tool tool', title: tl('dialog.copy_to_clipboard')}, Blockbench.getIconNode('content_paste'));
						copy_button.addEventListener('click', e => {
							if (isApp || navigator.clipboard) {
								Clipbench.setText(text);
								Blockbench.showQuickMessage('dialog.copied_to_clipboard');
								input_element.focus();
								document.execCommand('selectAll');

							} else if (is_url) {
								Blockbench.showMessageBox({
									title: 'dialog.share_model.title',
									message: `[${text}](${text})`,
								})
							}
						});
						bar.append(copy_button);

						if (is_url) {
							let open_button = Interface.createElement('div', {class: 'form_input_tool tool', title: tl('dialog.open_url')}, Blockbench.getIconNode('open_in_browser'));
							open_button.addEventListener('click', e => {
								Blockbench.openLink(text);
							});
							bar.append(open_button);
						}
						if (navigator.share) {
							let share_button = Interface.createElement('div', {class: 'form_input_tool tool', title: tl('generic.share')}, Blockbench.getIconNode('share'));
							share_button.addEventListener('click', e => {
								navigator.share({
									label: data.label ? tl(data.label) : 'Share',
									[is_url ? 'url' : 'text']: text
								});
							});
							bar.append(share_button);
						}
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
						onInput() {
							dialog.updateFormValues();
						}
					});
					data.select_input = select_input;
					bar.append(select_input.node)
					break;


				case 'inline_select':
					let options = [];
					let val = data.value || data.default;
					let i = 0;
					let wrapper;
					for (let key in data.options) {
						let is_selected = val ? key == val : i == 0;
						let text = data.options[key].name || data.options[key];
						let node = Interface.createElement('li', {class: is_selected ? 'selected' : '', key: key}, tl(text));
						node.onclick = event => {
							options.forEach(li => {
								li.classList.toggle('selected', li == node);
							})
							dialog.updateFormValues();
						}
						options.push(node);
						i++;
					}
					wrapper = Interface.createElement('ul', {class: 'form_inline_select'}, options);
					bar.append(wrapper)
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
					data.text = pureMarked(tl(data.text))
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
					let numeric_input = new Interface.CustomElements.NumericInput(form_id, {
						value: data.value,
						min: data.min, max: data.max, step: data.step,
						onChange() {
							dialog.updateFormValues()
						}
					});
					bar.append(numeric_input.node)
					break;


				case 'range':
					input_element = $(`<input class="half focusable_input" type="range" id="${form_id}"
						value="${parseFloat(data.value)||0}" min="${data.min}" max="${data.max}" step="${data.step||1}">`)
					bar.append(input_element)

					if (!data.editable_range_label) {
						let display = Interface.createElement('span', {class: 'range_input_label'}, (data.value||0).toString())
						bar.append(display);
						input_element.on('input', () => {
							let result = dialog.getFormResult();
							display.textContent = trimFloatNumber(result[form_id]);
						})
					} else {
						bar.addClass('slider_input_combo');
						let numeric_input = new Interface.CustomElements.NumericInput(form_id + '_number', {
							value: data.value ?? 0,
							min: data.min, max: data.max, step: data.step,
							onChange() {
								input_element.val(numeric_input.value);
								dialog.updateFormValues();
							}
						});
						bar.append(numeric_input.node);
						input_element.on('input', () => {
							let result = parseFloat(input_element.val());
							numeric_input.value = result;
						})
					}
					input_element.on('input', () => {
						dialog.updateFormValues();
					})
					break;


				case 'vector':
					let group = $(`<div class="dialog_vector_group half"></div>`)
					bar.append(group)
					for (let i = 0; i < (data.dimensions || 3); i++) {
						let numeric_input = new Interface.CustomElements.NumericInput(form_id + '_' + i, {
							value: data.value ? data.value[i] : 0,
							min: data.min, max: data.max, step: data.step,
							onChange() {
								dialog.updateFormValues()
							}
						});
						group.append(numeric_input.node)
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

					let input = $(`<input class="dark_bordered half" class="focusable_input" type="text" id="${form_id}" style="pointer-events: none;" disabled>`);
					input[0].value = settings.streamer_mode.value ? `[${tl('generic.redacted')}]` : data.value || '';
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
						delete data.content;
						delete data.file;
						input.val('');
					})

					input_wrapper.on('click', e => {
						function fileCB(files) {
							data.value = files[0].path;
							data.content = files[0].content;
							data.file = files[0];
							input.val(settings.streamer_mode.value ? `[${tl('generic.redacted')}]` : data.value);
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
								}, path => {
									data.value = path;
									input.val(settings.streamer_mode.value ? `[${tl('generic.redacted')}]` : data.value);
									dialog.updateFormValues()
								});
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
			if (data.toggle_enabled) {
				let toggle = Interface.createElement('input', {
					type: 'checkbox',
					class: 'focusable_input form_input_toggle',
					id: form_id + '_toggle',
				})
				toggle.checked = data.toggle_default != false;
				bar.append(toggle);
				bar.toggleClass('form_toggle_disabled', !toggle.checked);
				toggle.addEventListener('input', () => {
					dialog.updateFormValues();
					bar.toggleClass('form_toggle_disabled', !toggle.checked);
				});
				data.input_toggle = toggle;
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
		this.id = id;
		this.title = options.title || options.name;
		
		this.lines = options.lines
		this.form = options.form
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
	setFormValues(values, update = true) {
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
					case 'inline_select':
						data.bar.find('li').each((i, el) => {
							el.classList.toggle('selected', el.getAttribute('key') == value);
						})
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
						delete data.file;
						if (data.return_as == 'file' && typeof value == 'object') {
							data.file = value;
							data.value = data.file.name;
						} else if (isApp) {
							data.value = value;
						} else {
							data.content = value;
						}
						data.bar.find('input').val(settings.streamer_mode.value ? `[${tl('generic.redacted')}]` : data.value);
						break;
				}
			}
		}
		if (update) this.updateFormValues();
	}
	setFormToggles(values, update = true) {
		for (let form_id in this.form) {
			let data = this.form[form_id];
			if (values[form_id] != undefined && typeof data == 'object' && data.input_toggle && data.bar) {
				data.input_toggle.checked = values[form_id];
				data.bar.toggleClass('form_toggle_disabled', !data.input_toggle.checked);
			}
		}
		if (update) this.updateFormValues();
	}
	getFormResult() {
		let result = {}
		if (this.form) {
			for (let form_id in this.form) {
				let data = this.form[form_id];
				if (data && data.input_toggle && data.input_toggle.checked == false) continue;

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
						case 'inline_select':
							result[form_id] = data.bar.find('li.selected')[0]?.getAttribute('key') || '';
							break;
						case 'radio':
							result[form_id] = data.bar.find('.form_part_radio#'+form_id+' input:checked').attr('id')
							break;
						case 'number':
							result[form_id] = Math.clamp(parseFloat(data.bar.find('input#'+form_id).val())||0, data.min, data.max)
							if (data.force_step && data.step) {
								result[form_id] = Math.round(result[form_id] / data.step) * data.step;
							}
							break;
						case 'range':
							if (data.editable_range_label) {
								result[form_id] = Math.clamp(parseFloat(data.bar.find('input#'+form_id+'_number').val())||0, data.min, data.max);
							} else {
								result[form_id] = Math.clamp(parseFloat(data.bar.find('input#'+form_id).val())||0, data.min, data.max);
							}
							if (data.force_step && data.step) {
								result[form_id] = Math.round(result[form_id] / data.step) * data.step;
							}
							break;
						case 'vector':
							result[form_id] = [];
							for (let i = 0; i < (data.dimensions || 3); i++) {
								let num = Math.clamp(parseFloat(data.bar.find(`input#${form_id}_${i}`).val())||0, data.min, data.max)
								if (data.force_step && data.step) {
									num = Math.round(num / data.step) * data.step;
								}
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
							if (data.return_as == 'file') {
								result[form_id] = data.file;
							} else {
								result[form_id] = isApp ? data.value : data.content;
							}
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

})()

// Legacy Dialog
function showDialog() {
	console.warn('"showDialog" is no longer supported!')
}
function hideDialog() {
	console.warn('"hideDialog" is no longer supported!')
}

