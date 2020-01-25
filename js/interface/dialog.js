function Dialog(settings) {
	var scope = this;
	this.title = settings.title
	this.lines = settings.lines
	this.form = settings.form
	this.id = settings.id
	this.width = settings.width
	this.fadeTime = settings.fadeTime
	this.draggable = settings.draggable
	this.singleButton = settings.singleButton
	this.buttons = settings.buttons
	this.fadeTime = settings.fadeTime||0;
	this.confirmIndex = settings.confirmIndex||0;
	this.cancelIndex = settings.cancelIndex !== undefined ? settings.cancelIndex : 1;


	this.hide = function() {
		$('#blackout').fadeOut(this.fadeTime)
		$(scope.object).fadeOut(this.fadeTime)
			.find('.tool').detach()
		open_dialog = false;
		open_interface = false;
		Prop.active_panel = undefined
		setTimeout(function() {
			$(scope.object).remove()
		},this.fadeTime)
	}

	this.confirmEnabled = settings.confirmEnabled === false ? false : true
	this.cancelEnabled = settings.cancelEnabled === false ? false : true
	this.onConfirm = settings.onConfirm ? settings.onConfirm : this.hide
	this.onCancel = settings.onCancel ? settings.onCancel : this.hide

	this.object;

	this.confirm = function() {
		$(this.object).find('.confirm_btn:not([disabled])').click()
	}
	this.cancel = function() {
		$(this.object).find('.cancel_btn:not([disabled])').click()
	}
	this.show = function() {
		var jq_dialog = $(`<dialog class="dialog paddinged" id="${scope.id}"><div class="dialog_handle">${tl(scope.title)}</div></dialog>`)
		scope.object = jq_dialog.get(0)
		var max_label_width = 0;
		if (scope.lines) {
			scope.lines.forEach(function(l) {
				if (typeof l === 'object' && (l.label || l.widget)) {

					var bar = $('<div class="dialog_bar"></div>')
					if (l.label) {
						bar.append('<label class="name_space_left">'+tl(l.label)+(l.nocolon?'':':')+'</label>')
						max_label_width = Math.max(getStringWidth(tl(l.label)), max_label_width)
					}
					if (l.node) {
						bar.append(l.node)
					} else if (l.widget) {
						var widget = l.widget
						if (typeof l.widget === 'string') {
							widget = BarItems[l.widget]
						} else if (typeof l.widget === 'function') {
							widget = l.widget()
						}
						bar.append(widget.getNode())
						max_label_width = Math.max(getStringWidth(widget.name), max_label_width)
					}
					jq_dialog.append(bar)
				} else {
					jq_dialog.append(l)
				}
			})
		}
		if (scope.form) {
			for (var form_id in scope.form) {
				var data = scope.form[form_id]
				if (data === '_') {
					jq_dialog.append('<hr />')
					
				} else if (data && Condition(data.condition)) {
					var bar = $(`<div class="dialog_bar form_bar_${form_id}"></div>`)
					if (data.label) {
						bar.append(`<label class="name_space_left" for="${form_id}">${tl(data.label)+(data.nocolon?'':':')}</label>`)
						max_label_width = Math.max(getStringWidth(tl(data.label)), max_label_width)
					}

					switch (data.type) {
						default:
							bar.append(`<input class="dark_bordered half" type="text" id="${form_id}" value="${data.value||''}" placeholder="${data.placeholder||''}">`)
							break;
						case 'textarea':
							bar.append(`<textarea style="height: ${data.height||150}px;" id="${form_id}"></textarea>`)
							break;
						case 'select':
							var el = $(`<div class="bar_select half"><select id="${form_id}"></select></div>`)
							var sel = el.find('select')
							for (var key in data.options) {
								var name = tl(data.options[key])
								sel.append(`<option id="${key}" ${data.default === key ? 'selected' : ''}>${name}</option>`)
							}
							bar.append(el)
							break;
						case 'radio':
							var el = $(`<div class="half form_part_radio" id="${form_id}"></div>`)
							for (var key in data.options) {
								var name = tl(data.options[key])
								el.append(`<div class="form_bar_radio">
									<input type="radio" name="${form_id}_radio" id="${key}" ${data.default === key ? 'selected' : ''}>
									<label for="${key}">${name}</label>
								</div>`)
							}
							bar.append(el)
							break;
						case 'text':
							data.text = marked(tl(data.text))
							bar.append(`<p>${data.text}</p>`)
							bar.addClass('small_text')
							break;
						case 'number':
							bar.append(`<input class="dark_bordered half" type="number" id="${form_id}" value="${data.value||0}" min="${data.min}" max="${data.max}" step="${data.step||1}">`)
							break;
						case 'color':
							if (!data.colorpicker) {
								data.colorpicker = new ColorPicker({
									id: 'cp_'+form_id,
									label: false,
									private: true
								})
							}
							bar.append(data.colorpicker.getNode())
							break;
						case 'checkbox':
							bar.append(`<input type="checkbox" id="${form_id}"${data.value ? ' checked' : ''}>`)
							break;
						case 'file':
						case 'folder':
						case 'save':
							if (data.type == 'folder' && !isApp) break;

							var input = $(`<input class="dark_bordered half" type="text" id="${form_id}" value="${data.value||''}" disabled>`);
							bar.append(input);
							bar.addClass('form_bar_file');

							switch (data.type) {
								case 'file': 	bar.append('<i class="material-icons">insert_drive_file</i>'); break;
								case 'folder':	bar.append('<i class="material-icons">folder</i>'); break;
								case 'save':	bar.append('<i class="material-icons">save</i>'); break;
							}
							let remove_button = $('<div class="tool" style="float: none; vertical-align: top;"><i class="material-icons">clear</i></div>');
							bar.append(remove_button);
							remove_button.on('click', e => {
								e.stopPropagation();
								data.value = '';
								input.val('');
							})

							bar.on('click', e => {
								cl(e.target);
								function fileCB(files) {
									data.value = files[0].path;
									input.val(data.value);
								}
								switch (data.type) {
									case 'file':
										Blockbench.import({
											extensions: data.extensions,
											type: data.filetype,
											startpath: data.value
										}, fileCB);
										break;
									case 'folder':
										ElecDialogs.showOpenDialog(currentwindow, {
											properties: ['openDirectory'],
											defaultPath: data.value
										}, function(filePaths) {
											if (filePaths) fileCB([{ path: filePaths[0] }]);
										})
										break;
									case 'save':
										Blockbench.export({
											extensions: data.extensions,
											type: data.filetype,
											startpath: data.value,
											custom_writer: () => {},
										}, fileCB);
										break;
								}
							})

						case 'folder':
					}
					if (data.readonly) {
						bar.find('input').attr('readonly', 'readonly')
					}
					jq_dialog.append(bar)
				}
			}
		}
		if (max_label_width) {
			document.styleSheets[0].insertRule('.dialog#'+this.id+' .dialog_bar label {width: '+(max_label_width+8)+'px}')
		}
		if (this.buttons) {


			var buttons = []

			scope.buttons.forEach(function(b, i) {
				var btn = $('<button type="button">'+tl(b)+'</button> ')
				buttons.push(btn)
			})
			buttons[scope.confirmIndex] && buttons[scope.confirmIndex].addClass('confirm_btn')
			buttons[scope.cancelIndex] && buttons[scope.cancelIndex].addClass('cancel_btn')
			jq_dialog.append($('<div class="dialog_bar button_bar"></div>').append(buttons))



		} else if (this.singleButton) {

			jq_dialog.append('<div class="dialog_bar">' +
				'<button type="button" class="cancel_btn confirm_btn"'+ (this.confirmEnabled ? '' : ' disabled') +'>'+tl('dialog.close')+'</button>' +
			'</div>')

		} else {

			jq_dialog.append(`<div class="dialog_bar">
				<button type="button" class="confirm_btn${this.confirmEnabled ? '' : ' disabled'}">${tl('dialog.confirm')}</button>&nbsp;
				<button type="button" class="cancel_btn${this.cancelEnabled ? '' : ' disabled'}">${tl('dialog.cancel')}</button>
			</div>`)

		}
		jq_dialog.append('<div class="dialog_close_button" onclick="$(\'.dialog#\'+open_dialog).find(\'.cancel_btn:not([disabled])\').click()"><i class="material-icons">clear</i></div>')
		var confirmFn = function(e) {

			var result = {}
			if (scope.form) {
				for (var form_id in scope.form) {
					var data = scope.form[form_id]
					if (typeof data === 'object') {
						switch (data.type) {
							default:
								result[form_id] = jq_dialog.find('input#'+form_id).val()
								break;
							case 'text':
								break;
							case 'textarea':
								result[form_id] = jq_dialog.find('textarea#'+form_id).val()
								break;
							case 'select':
								result[form_id] = jq_dialog.find('select#'+form_id+' > option:selected').attr('id')
								break;
							case 'radio':
								result[form_id] = jq_dialog.find('.form_part_radio#'+form_id+' input:checked').attr('id')
								break;
							case 'number':
								result[form_id] = Math.clamp(parseFloat(jq_dialog.find('input#'+form_id).val())||0, data.min, data.max)
								break;
							case 'color':
								result[form_id] = data.colorpicker.get();
								break;
							case 'checkbox':
								result[form_id] = jq_dialog.find('input#'+form_id).is(':checked')
								break;
						}
					}
				}
			}
			scope.onConfirm(result, e)
		}
		confirmFn.bind(this)
		if (this.confirmEnabled) $(this.object).find('.confirm_btn').click(confirmFn)
		if (this.cancelEnabled) $(this.object).find('.cancel_btn').click(() => {this.onCancel()})
		//Draggable
		if (this.draggable !== false) {
			jq_dialog.addClass('draggable')
			jq_dialog.draggable({
				handle: ".dialog_handle",
				containment: '#page_wrapper'
			})
			var x = Math.clamp(($(window).width()-540)/2, 0, 2000)
			jq_dialog.css('left', x+'px')
			jq_dialog.css('position', 'absolute')
		}
		$('#plugin_dialog_wrapper').append(jq_dialog)
		$('.dialog').hide(0)
		$('#blackout').fadeIn(scope.fadeTime)
		jq_dialog.fadeIn(scope.fadeTime)
		jq_dialog.css('top', limitNumber($(window).height()/2-jq_dialog.height()/2, 0, 100)+'px')
		if (this.width) {
			jq_dialog.css('width', this.width+'px')
		}
		open_dialog = scope.id
		open_interface = scope
		Prop.active_panel = 'dialog'
		return this;
	}
	this.getFormBar = function(form_id) {
		var bar = $(scope.object).find(`.form_bar_${form_id}`)
		if (bar) return bar;
	}
}
