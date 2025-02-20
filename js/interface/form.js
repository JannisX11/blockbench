class InputForm extends EventSystem {
	constructor(form_config, options = {}) {
		super();
		this.uuid = guid();
		this.form_config = form_config;
		this.form_data = {};
		this.node = Interface.createElement('div', {class: 'form'});
		this.max_label_width = 0;
		this.uses_wide_inputs = false;

		this.buildForm();
		this.updateValues(true);
	}
	buildForm() {
		let jq_node = $(this.node);
		let scope = this;
		for (let form_id in this.form_config) {
			let input_config = this.form_config[form_id];
			let data = this.form_data[form_id] = {};
			form_id = form_id.replace(/"/g, '');
			if (input_config === '_') {
				jq_node.append('<hr />')
				
			} else {
				let bar = $(`<div class="dialog_bar bar form_bar form_bar_${form_id}"></div>`)
				let label;
				if (typeof input_config.label == 'string') {
					label = Interface.createElement('label', {class: 'name_space_left', for: form_id}, tl(input_config.label)+((input_config.nocolon || !input_config.label)?'':':'))
					bar.append(label);
					if (!input_config.full_width && input_config.condition !== false) {
						this.max_label_width = Math.max(getStringWidth(label.textContent), this.max_label_width)
					}
				}
				if (input_config.full_width) {
					bar.addClass('full_width_dialog_bar');
					this.uses_wide_inputs = true;
				}
				if (input_config.description) {
					bar.attr('title', tl(input_config.description))
				}
				let input_element;
				if (['checkbox', 'buttons', 'color', 'info'].includes(input_config.type) == false) {
					this.uses_wide_inputs = true;
				}
	
				switch (input_config.type) {
					default:
						input_element = Object.assign(document.createElement('input'), {
							type: 'text',
							className: 'dark_bordered half focusable_input',
							id: form_id,
							value: input_config.value||'',
							placeholder: input_config.placeholder||'',
							oninput() {
								scope.updateValues()
							}
						});
						bar.append(input_element)
	
						if (input_config.list) {
							let list_id = `${this.uuid}_${form_id}_list`;
							input_element.setAttribute('list', list_id);
							let list = $(`<datalist id="${list_id}"></datalist>`);
							for (let value of input_config.list) {
								let node = document.createElement('option');
								node.value = value;
								list.append(node);
							}
							bar.append(list);
						}
						if (input_config.type == 'password') {
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
						if (input_config.share_text && input_config.value) {
							let text = input_config.value.toString();
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
										label: input_config.label ? tl(input_config.label) : 'Share',
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
							value: input_config.value||'',
							placeholder: input_config.placeholder||'',
							oninput() {
								scope.updateValues()
							}
						});
						input_element.style.height = (input_config.height || 150) + 'px';
						bar.append(input_element)
						break;
	
	
					case 'select':
						let select_input = new Interface.CustomElements.SelectInput(form_id, {
							options: input_config.options,
							value: input_config.value || input_config.default,
							onInput() {
								scope.updateValues();
							}
						});
						data.select_input = select_input;
						bar.append(select_input.node)
						break;
	
	
					case 'inline_select':
                        let options = [];
                        let val = input_config.value || input_config.default;
                        let i = 0;
                        let wrapper;
                        for (let key in input_config.options) {
                            let is_selected = val ? key == val : i == 0;
                            let text = input_config.options[key].name || input_config.options[key];
                            let node = Interface.createElement('li', {class: is_selected ? 'selected' : '', key: key}, tl(text));
                            node.onclick = event => {
                                options.forEach(li => {
                                    li.classList.toggle('selected', li == node);
                                })
                                scope.updateValues();
                            }
                            options.push(node);
                            i++;
                        }
                        wrapper = Interface.createElement('ul', {class: 'form_inline_select'}, options);
                        bar.append(wrapper)
                        break;
	
	
					case 'inline_multi_select': {
						let val = input_config.value || input_config.default;
						data.value = {};
						if (val) {
							for (let key in input_config.options) {
								data.value[key] = !!val[key];
							}
						}
						let i = 0;
						let options = [];
						let wrapper;
						for (let key in input_config.options) {
							let is_selected = val && val[key];
							let text = input_config.options[key].name || input_config.options[key];
							let node = Interface.createElement('li', {class: is_selected ? 'selected' : '', key: key}, tl(text));
							node.onclick = event => {
								data.value[key] = !data.value[key];
								node.classList.toggle('selected', data.value[key]);
								scope.updateValues();
							}
							options.push(node);
							i++;
						}
						wrapper = Interface.createElement('ul', {class: 'form_inline_select multi_select'}, options);
						bar.append(wrapper)
						break;
					}
	
					case 'radio':
						let el = $(`<div class="half form_part_radio" id="${form_id}"></div>`)
						for (let key in input_config.options) {
							let name = tl(input_config.options[key])
							el.append(`<div class="form_bar_radio">
								<input type="radio" class="focusable_input" name="${form_id}_radio" id="${key}" ${(input_config.default || input_config.value) === key ? 'selected' : ''}>
								<label for="${key}">${name}</label>
							</div>`)
							input_element = el.find(`input#${key}`);
							input_element.on('change', () => {
								scope.updateValues()
							})
						}
						bar.append(el)
						break;
	
	
					case 'info':
						data.text = pureMarked(tl(input_config.text))
						bar.append(`<p>${data.text}</p>`)
						bar.addClass('small_text')
						break;
	
	
					case 'buttons':
						let list = document.createElement('div');
						list.className = 'dialog_form_buttons';
						input_config.buttons.forEach((button_text, index) => {
							let button = document.createElement('a');
							button.innerText = tl(button_text);
							button.addEventListener('click', e => {
								input_config.click(index, e);
							})
							list.append(button);
						})
						bar.append(list);
						break;
	
	
					case 'number':
						let numeric_input = new Interface.CustomElements.NumericInput(form_id, {
							value: input_config.value,
							min: input_config.min, max: input_config.max, step: input_config.step,
							onChange() {
								scope.updateValues()
							}
						});
						bar.append(numeric_input.node)
						break;
	
	
					case 'range':
						input_element = $(`<input class="half focusable_input" type="range" id="${form_id}"
							value="${parseFloat(input_config.value)||0}" min="${input_config.min}" max="${input_config.max}" step="${input_config.step||1}">`)
						bar.append(input_element)
	
						if (!input_config.editable_range_label) {
							let display = Interface.createElement('span', {class: 'range_input_label'}, (input_config.value||0).toString())
							bar.append(display);
							input_element.on('input', () => {
								let result = this.getResult();
								display.textContent = trimFloatNumber(result[form_id]);
							})
						} else {
							bar.addClass('slider_input_combo');
							let numeric_input = new Interface.CustomElements.NumericInput(form_id + '_number', {
								value: input_config.value ?? 0,
								min: input_config.min, max: input_config.max, step: input_config.step,
								onChange() {
									input_element.val(numeric_input.value);
									scope.updateValues();
								}
							});
							bar.append(numeric_input.node);
							input_element.on('input', () => {
								let result = parseFloat(input_element.val());
								numeric_input.value = result;
							})
						}
						input_element.on('input', () => {
							scope.updateValues();
						})
						break;

					case 'num_slider':
						let getInterval = input_config.getInterval;
						if (input_config.interval_type == 'position') getInterval = getSpatialInterval;
						if (input_config.interval_type == 'rotation') getInterval = getRotationInterval;
						let slider = new NumSlider({
							id: 'form_slider_'+form_id,
							private: true,
							onChange: () => {
								scope.updateValues();
							},
							getInterval,
							settings: {
								default: input_config.value || 0,
								min: input_config.min,
								max: input_config.max,
								step: input_config.step||1,
							},
						});
						bar.append(slider.node);
						slider.update();
						data.slider = slider;
						break;
	
	
					case 'vector':
						let group = $(`<div class="dialog_vector_group half"></div>`)
						bar.append(group)
						let vector_inputs = [];
						let initial_value = input_config.value instanceof Array ? input_config.value.slice() : [1, 1, 1];
						function updateInputs(changed_input) {
							let i2 = -1;
							for (let vector_input_2 of vector_inputs) {
								i2++;
								if (vector_input_2 == changed_input) continue;
								let new_value = initial_value[i2] * (changed_input.value / initial_value[vector_inputs.indexOf(changed_input)]);
								new_value = Math.clamp(new_value, input_config.min, input_config.max)
								if (input_config.force_step && input_config.step) {
									new_value = Math.round(new_value / input_config.step) * input_config.step;
								}
								vector_input_2.value = new_value;
							}
						}
						for (let i = 0; i < (input_config.dimensions || 3); i++) {
							let numeric_input = new Interface.CustomElements.NumericInput(form_id + '_' + i, {
								value: input_config.value ? input_config.value[i] : 0,
								min: input_config.min, max: input_config.max, step: input_config.step,
								onChange() {
									if (data.linked_ratio) {
										updateInputs(numeric_input);
									}
									scope.updateValues();
								}
							});
							group.append(numeric_input.node)
							vector_inputs.push(numeric_input);
						}
						if (typeof input_config.linked_ratio == 'boolean') {
							data.linked_ratio = input_config.linked_ratio;
							let icon = Blockbench.getIconNode('link');
							let linked_ratio_toggle = Interface.createElement('div', {class: 'tool linked_ratio_toggle'}, icon);
							linked_ratio_toggle.addEventListener('click', event => {
								data.linked_ratio = !data.linked_ratio;
								if (data.linked_ratio) {
									initial_value = vector_inputs.map(v => v.value);
									// updateInputs(vector_inputs[0]);
									// scope.updateValues();
								}
								updateState();
							})
							function updateState() {
								icon.textContent = data.linked_ratio ? 'link' : 'link_off';
								linked_ratio_toggle.classList.toggle('enabled', data.linked_ratio);
							}
							updateState();
							group.append(linked_ratio_toggle)
						}
						break;
	
	
					case 'color':
						if (input_config.colorpicker) data.colorpicker = input_config.colorpicker;
						if (!data.colorpicker) {
							data.colorpicker = new ColorPicker({
								id: 'cp_'+form_id,
								name: tl(input_config.label),
								label: false,
								private: true,
								value: input_config.value
							})
						}
						data.colorpicker.onChange = function() {
							scope.updateValues()
						};
						bar.append(data.colorpicker.getNode())
						break;
	
	
					case 'checkbox':
						input_element = $(`<input type="checkbox" class="focusable_input" id="${form_id}"${input_config.value ? ' checked' : ''}>`)
						bar.append(input_element)
						input_element.on('change', () => {
							scope.updateValues()
						})
						break;
	
	
					case 'file':
					case 'folder':
					case 'save':
						if (input_config.type == 'folder' && !isApp) break;
						data.value = input_config.value;
	
						let input = $(`<input class="dark_bordered half" class="focusable_input" type="text" id="${form_id}" style="pointer-events: none;" disabled>`);
						input[0].value = settings.streamer_mode.value ? `[${tl('generic.redacted')}]` : data.value || '';
						let input_wrapper = $('<div class="input_wrapper"></div>');
						input_wrapper.append(input);
						bar.append(input_wrapper);
						bar.addClass('form_bar_file');
	
						switch (input_config.type) {
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
								scope.updateValues()
							}
							switch (input_config.type) {
								case 'file':
									Blockbench.import({
										resource_id: input_config.resource_id,
										extensions: input_config.extensions,
										type: input_config.filetype,
										startpath: data.value,
										readtype: input_config.readtype
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
										resource_id: input_config.resource_id,
										extensions: input_config.extensions,
										type: input_config.filetype,
										startpath: data.value,
										custom_writer: () => {},
									}, path => {
										data.value = path;
										input.val(settings.streamer_mode.value ? `[${tl('generic.redacted')}]` : data.value);
										scope.updateValues()
									});
									break;
							}
						})
	
				}
				if (input_config.readonly) {
					bar.find('input').attr('readonly', 'readonly').removeClass('focusable_input')
				}
				if (input_config.description) {
					let icon = document.createElement('i');
					icon.className = 'fa fa-question dialog_form_description';
					icon.onclick = function() {
						Blockbench.showQuickMessage(input_config.description, 3600);
					}
					bar.append(icon);
				}
				if (input_config.toggle_enabled) {
					let toggle = Interface.createElement('input', {
						type: 'checkbox',
						class: 'focusable_input form_input_toggle',
						id: form_id + '_toggle',
					})
					toggle.checked = input_config.toggle_default != false;
					bar.append(toggle);
					bar.toggleClass('form_toggle_disabled', !toggle.checked);
					toggle.addEventListener('input', () => {
						scope.updateValues();
						bar.toggleClass('form_toggle_disabled', !toggle.checked);
					});
					data.input_toggle = toggle;
				}
				jq_node.append(bar)
				data.bar = bar;
			}
		}
		this.node.style.setProperty('--max_label_width', this.max_label_width+'px');
	}
	updateValues(initial) {
		let form_result = this.getResult();
		for (let form_id in this.form_config) {
			let data = this.form_data[form_id];
			let input_config = this.form_config[form_id];
			if (typeof input_config == 'object' && data.bar) {
				let show = Condition(input_config.condition, form_result);
				data.bar.toggle(show);
			}
		}
		if (!initial) {
			this.dispatchEvent('change', {result: form_result});
		}
		return form_result;
	}
	setValues(values, update = true) {
		for (let form_id in this.form_config) {
			let data = this.form_data[form_id];
			let input_config = this.form_config[form_id];
			if (values[form_id] != undefined && typeof input_config == 'object' && data.bar) {
				let value = values[form_id];
				switch (input_config.type) {
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
					case 'inline_multi_select':
						for (let key in value) {
							if (data.value[key] !== undefined)  {
								data.value[key] = value[key];
							}
						}
						data.bar.find('li').each((i, el) => {
							el.classList.toggle('selected', !!data.value[el.getAttribute('key')]);
						})
						break;
					case 'radio':
						data.bar.find('.form_part_radio input#'+value).prop('checked', value);
						break;
					case 'number': case 'range':
						data.bar.find('input').val(value);
						break;
					case 'num_slider':
						data.slider.setValue(value);
						break;
					case 'vector':
						for (let i = 0; i < (input_config.dimensions || 3); i++) {
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
						if (input_config.return_as == 'file' && typeof value == 'object') {
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
		if (update) this.updateValues();
	}
	setToggles(values, update = true) {
		for (let form_id in this.form_config) {
			let input_config = this.form_config[form_id];
			let data = this.form_data[form_id];
			if (values[form_id] != undefined && typeof input_config == 'object' && data.input_toggle && data.bar) {
				data.input_toggle.checked = values[form_id];
				data.bar.toggleClass('form_toggle_disabled', !data.input_toggle.checked);
			}
		}
		if (update) this.updateValues();
	}
	getResult() {
		let result = {}
		for (let form_id in this.form_config) {
			let input_config = this.form_config[form_id];
			let data = this.form_data[form_id];
			if (data && data.input_toggle && data.input_toggle.checked == false) {
				result[form_id] = null;
				continue;
			}

			if (typeof input_config === 'object') {
				switch (input_config.type) {
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
					case 'inline_multi_select':
						result[form_id] = data.value;
						break;
					case 'radio':
						result[form_id] = data.bar.find('.form_part_radio#'+form_id+' input:checked').attr('id')
						break;
					case 'number':
						result[form_id] = Math.clamp(parseFloat(data.bar.find('input#'+form_id).val())||0, input_config.min, input_config.max)
						if (input_config.force_step && input_config.step) {
							result[form_id] = Math.round(result[form_id] / input_config.step) * input_config.step;
						}
						break;
					case 'range':
						if (input_config.editable_range_label) {
							result[form_id] = Math.clamp(parseFloat(data.bar.find('input#'+form_id+'_number').val())||0, input_config.min, input_config.max);
						} else {
							result[form_id] = Math.clamp(parseFloat(data.bar.find('input#'+form_id).val())||0, input_config.min, input_config.max);
						}
						if (input_config.force_step && input_config.step) {
							result[form_id] = Math.round(result[form_id] / input_config.step) * input_config.step;
						}
						break;
					case 'num_slider':
						result[form_id] = data.slider.get();
						break;
					case 'vector':
						result[form_id] = [];
						for (let i = 0; i < (input_config.dimensions || 3); i++) {
							let num = Math.clamp(parseFloat(data.bar.find(`input#${form_id}_${i}`).val())||0, input_config.min, input_config.max)
							if (input_config.force_step && input_config.step) {
								num = Math.round(num / input_config.step) * input_config.step;
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
						if (input_config.return_as == 'file') {
							result[form_id] = data.file;
						} else {
							result[form_id] = isApp ? data.value : data.content;
						}
						break;
				}
			}
		}
		return result;
	}
	static getDefaultValue(input_config) {
		let set_value = input_config.value ?? input_config.default;
		if (set_value) return set_value;
		switch (input_config.type) {
			case 'checkbox': return false;
			case 'text': case 'textarea': return '';
			case 'number': case 'range': case 'num_slider': return Math.clamp(0, input_config.min, input_config.max);
			case 'select': case 'inline_select': case 'radio': return Object.keys(input_config.options)[0] ?? '';
			case 'inline_multi_select': return {};
			case 'file': case 'folder': return '';
			case 'vector': return new Array(input_config.dimensions??3).fill(Math.clamp(0, input_config.min, input_config.max));
			case 'color': return '#ffffff';
			default: return '';
		}
	}
}