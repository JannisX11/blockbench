class API {
	constructor() {
		this.elements = elements;
		this.textures = textures;
		this.isWeb = !isApp;
		this.version = appVersion;
		this.platform = 'web'
		this.selection = selected;
		this.flags = []
		this.drag_handlers = {}
		this.events = {}
		this.entity_mode = false
		if (isApp) {
			this.platform = process.platform
			switch (this.platform) {
				case 'win32': 	this.operating_system = 'Windows'; break;
				case 'darwin': 	this.operating_system = 'macOS'; break;
				default:		this.operating_system = 'Linux'; break;
			}
			if (this.platform.includes('win32') === true) osfs = '\\'
		}
	}
	edit(aspects, cb) {
		Undo.initEdit(aspects)
		cb()
		Undo.finishEdit()
	}
	reload() {
		localStorage.removeItem('backup_model')
		if (isApp) {
			preventClosing = false
			Blockbench.flags.push('allow_reload')
			currentwindow.reload()
		} else {
			location.reload()
		}
	}
	checkEntityMode() {
		return Blockbench.entity_mode;
	}
	registerEdit() {
		console.warn('Blockbench.registerEdit is outdated. Please use Undo.initEdit and Undo.finishEdit')
	}

	//Interface
	getIconNode(icon, color) {
		var jq;
		if (typeof icon === 'function') {
			icon = icon()
		}
		if (icon === undefined) {
			//Missing
			jq = $('<i class="material-icons icon">help_outline</i>')
		} else if (icon instanceof HTMLElement) {
			//Node
			jq = $(icon)
		} else if (icon.substr(0, 2) === 'fa') {
			//Font Awesome
			jq = $('<i class="icon fa fa_big ' + icon + '"></i>')
		} else if (icon.substr(0, 5) === 'icon-') {
			//Icomoon
			jq = $('<i class="' + icon + '"></i>')
		} else if (icon.substr(0, 14) === 'data:image/png') {
			//Data URL
			jq = $('<img class="icon" src="'+icon+'">')
		} else {
			//Material Icon
			jq = $('<i class="material-icons icon">' + icon + '</i>')
		}
		if (color) {
			if (color === 'x') {
				jq.addClass('color_x')
			} else if (color === 'y') {
				jq.addClass('color_y')
			} else if (color === 'z') {
				jq.addClass('color_z')
			} else if (typeof color === 'string') {
				jq.css('color', color)
			}
		}
		return jq.get(0)
	}
	showQuickMessage(message, time) {
		$('#quick_message_box').remove()
		var quick_message_box = $('<div id="quick_message_box" class="hidden"></div>') 
		$('body').append(quick_message_box)
		
		quick_message_box.text(tl(message))
		quick_message_box.fadeIn(100)
		setTimeout(function() {
			quick_message_box.fadeOut(100)
			setTimeout(function() {
				quick_message_box.remove()
			}, 100)
		}, time ? time : 1000)
	}
	showStatusMessage(message, time) {
		Blockbench.setStatusBarText(tl(message))
		setTimeout(function() {
			Blockbench.setStatusBarText()
		}, time ? time : 600)
	}
	setStatusBarText(text) {
		if (text) {
			Prop.file_name = text
		} else {
			Prop.file_name = Prop.file_name_alt||''
		}
	}
	setProgress(progress, time, bar) {
		setProgressBar(bar, progress||0, time)
	}
	showMessage(message, location) {
		if (location === 'status_bar') {
			Blockbench.showStatusMessage(message)
		} else if (location === 'center') {
			Blockbench.showQuickMessage(message)
		}
	}
	showMessageBox(options, cb) {

		if (options.confirm === undefined) options.confirm = 0
		if (options.cancel === undefined) options.cancel = 0
		if (!options.buttons) options.buttons = [tl('dialog.ok')]

		if (options.translateKey) {
			if (!options.title) options.title = tl('message.'+options.translateKey+'.title')
			if (!options.message) options.message = tl('message.'+options.translateKey+'.message')
		}

		var jq_dialog = $('<div class="dialog paddinged" style="width: auto;" id="message_box"><h2 class="dialog_handle">'+options.title+'</h2></div>')

		jq_dialog.append('<div class="dialog_bar" style="height: auto; min-height: 56px; margin-bottom: 16px;">'+
			options.message+'</div>'
		)
		if (options.icon) {
			jq_dialog.find('.dialog_bar').prepend($(Blockbench.getIconNode(options.icon)).addClass('message_box_icon'))
		}

		var buttons = []

		options.buttons.forEach(function(b, i) {
			var btn = $('<button type="button">'+b+'</button>')
			btn.click(function(e) {
				hideDialog()
				setTimeout(function() {
					jq_dialog.remove()
				},200)
				if (cb) {
					cb(i)
				}
			})
			buttons.push(btn)
		})
		jq_dialog.hide = function() {
			$(jq_dialog.find('button').get(options.cancel)).click()
		}
		buttons[options.confirm].addClass('confirm_btn')
		buttons[options.cancel].addClass('cancel_btn')
		jq_dialog.append($('<div class="dialog_bar button_bar"></div>').append(buttons))


		jq_dialog.addClass('draggable')
		jq_dialog.draggable({
			handle: ".dialog_handle"
		})
		var x = ($(window).width()-540)/2
		jq_dialog.css('left', x+'px')
		jq_dialog.css('position', 'absolute')

		$('#plugin_dialog_wrapper').append(jq_dialog)
		$('.dialog').hide(0)
		$('#blackout').fadeIn(100)
		jq_dialog.fadeIn(100)

		jq_dialog.css('top', limitNumber($(window).height()/2-jq_dialog.height()/2, 0, 100)+'px')
		if (options.width) {
			jq_dialog.css('width', options.width+'px')
		} else {
			jq_dialog.css('width', limitNumber(options.buttons.length*170+44, 380, 894)+'px')
		}
		open_dialog = 'message_box'
		open_interface = 'message_box'
		return jq_dialog
	}
	textPrompt(title, value, callback) {
		showDialog('text_input')
		$('#text_input h2').text(tl(title))
		$('#text_input input#text_input_field').val(value).select()
		$('#text_input button.confirm_btn').off()
		$('#text_input button.confirm_btn').click(function() {
			var s = $('#text_input input#text_input_field').val()
			if (callback !== undefined) {
				callback(s)
			}
		})
	}
	addMenuEntry(name, icon, click) {
		var action = new Action({icon: icon, name: name, id: name, click: click})
		MenuBar.addAction(action, 'filter')
	}
	removeMenuEntry(name) {
		MenuBar.removeAction('filter.'+name)
	}
	openLink(link) {
		if (isApp) {
			shell.openExternal(link)
		} else {
			window.open(link)
		}
	}
	//IO
	import(options, cb) {
		if (typeof options !== 'object') {options = {}}
			//extensions
			//type
			//readtype
			//multiple
			//startpath
			//title
			//errorbox

		if (isApp) {
			var properties = []
			if (options.multiple) {
				properties.push('multiSelections')
			}
			if (options.extensions[0] === 'image/*') {
				options.type = 'Images'
				options.extensions = ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif']
			}

			electron.dialog.showOpenDialog(
				currentwindow,
				{
					title: options.title ? options.title : '',
					filters: [{
						name: options.type ? options.type : options.extensions[0],
						extensions: options.extensions
					}],
					properties: (properties.length && Blockbench.platform !== 'darwin')?properties:undefined,
					defaultPath: options.startpath
				},
			function (fileNames) {
				Blockbench.read(fileNames, options, cb)
			})
		} else {
			$('<input '+
				'type="file'+
				'" accept=".'+(options.extensions ? options.extensions.join(',.'): '')+
				'" multiple="'+(options.multiple === true)+
			'">').change(function(e) {
				var input = this;
				var results = [];
				var result_count = 0;
				var i = 0;
				while (i < input.files.length) {
					(function() {
						var file = input.files[i]
						var reader = new FileReader()
						reader.i = i
						reader.onloadend = function() {

							if (reader.result.byteLength) {
								var arr = new Uint8Array(reader.result)
								var targa_loader = new Targa()
								targa_loader.load(arr)
								var result = targa_loader.getDataURL()
							} else {
								var result = reader.result
							}
							results[this.i] = {
								name: file.name,
								path: file.name,
								content: result
							}
							result_count++;
							if (result_count === input.files.length) {
								cb(results)
							}
						}
						if (options.readtype === 'image') {
							if (pathToExtension(file.name) === 'tga') {
								reader.readAsArrayBuffer(file)
							} else {
								reader.readAsDataURL(file)
							}
						} else if (options.readtype === 'buffer') {
							reader.readAsArrayBuffer(file)
						} else /*text*/ {
							reader.readAsText(file)
						}
						i++;
					})()
				}
			}).click()
		}
	}
	read(paths, options, cb) {
		if (!isApp || paths == undefined) return false;

		var results = [];
		var result_count = 0;
		var i = 0;
		var errant;
		while (i < paths.length) {
			(function() {
				var this_i = i;
				var file = paths[i]

				if (options.readtype === 'image') {
					//
					var extension = pathToExtension(file)
					if (extension === 'tga') {
						var targa_loader = new Targa()
						targa_loader.open(file, () => {

							results[this_i] = {
								name: pathToName(file, true),
								path: file,
								content: targa_loader.getDataURL()
							}
						
							result_count++;
							if (result_count === paths.length) {
								cb(results)
							}
						})

					} else {
						results[this_i] = {
							name: pathToName(file, true),
							path: file
						}
						result_count++;
						if (result_count === paths.length) {
							cb(results)
						}
					}
				} else /*text*/ {
					fs.readFile(file, 'utf-8', function (err, data) {
						if (err) {
							console.log(err)
							if (!errant && options.errorbox !== false) {
								Blockbench.showMessageBox({
									translateKey: 'file_not_found',
									icon: 'error_outline'
								})
							}
							errant = true
							return;
						}
						if (data.charCodeAt(0) === 0xFEFF) {
							data = data.substr(1)
						}
						results[this_i] = {
							name: pathToName(file, true),
							path: file,
							content: data
						}
						result_count++;
						if (result_count === paths.length) {
							cb(results)
						}
					})
				}
			})()
			i++;
		}
	}
	export(options, cb) {
		if (!options) return;
		/*	
			type
			extensions
			name
			content
			startpath
			savetype
			project_file
			custom_writer
		*/
		if (Blockbench.isWeb) {
			var file_name = options.name + (options.extensions ? '.'+options.extensions[0] : '')
			var callback_used;
			if (options.custom_writer) {
				options.custom_writer(options.content, file_name)
				
			} else if (options.savetype === 'image') {

				var download = document.createElement('a');
				download.href = options.content
				download.download = file_name;
				if (Blockbench.browser === 'firefox') document.body.appendChild(download);
				download.click();
				if (Blockbench.browser === 'firefox') document.body.removeChild(download);

			} else if (options.savetype === 'zip') {
				saveAs(options.content, file_name)

			} else {
				var blob = new Blob([options.content], {type: "text/plain;charset=utf-8"});
				saveAs(blob, file_name, {autoBOM: true})
			}
			if (options.project_file) {
				Prop.project_saved = true;
				setProjectTitle(options.name)
			}
			if (!callback_used && typeof cb === 'function') {
				cb()
			}
		} else {
			electron.dialog.showSaveDialog(currentwindow, {
				filters: [ {
					name: options.type,
					extensions: options.extensions
				} ],
				defaultPath: (options.startpath && options.startpath !== 'Unknown')
					? options.startpath.replace(/\.\w+$/, '')
					: options.name
			}, function (file_path) {
				Blockbench.writeFile(file_path, options, cb)
			})
		}
	}
	writeFile(file_path, options, cb) {
		/*	
			content
			savetype
			project_file
			custom_writer
		*/
		if (!isApp || file_path === undefined) {
			return;
		}
		if (options.savetype === 'image' && typeof options.content === 'string') {
			if (options.content.substr(0, 10) === 'data:image') {
				options.content = nativeImage.createFromDataURL(options.content).toPNG()
			} else {
				options.content = nativeImage.createFromPath(options.content).toPNG()
			}
		} else if (options.savetype === 'zip') {
			var fileReader = new FileReader();
			fileReader.onload = function(event) {
			    var buffer = Buffer.from(new Uint8Array(this.result));
				fs.writeFileSync(file_path, buffer)
				if (cb) {
					cb(file_path)
				}
			};
			fileReader.readAsArrayBuffer(options.content);

		} else if (options.custom_writer) {
			options.custom_writer(options.content, file_path)
		} else {
			fs.writeFileSync(file_path, options.content)
			if (cb) {
				cb(file_path)
			}
		}
		if (options.project_file) {
			Prop.file_path = file_path
			Prop.project_saved = true;
			Project.name = pathToName(file_path, true)
			setProjectTitle(pathToName(file_path, false))
			addRecentProject({name: pathToName(file_path, Blockbench.entity_mode ? 'mobs_id' : true), path: Prop.file_path})
			Blockbench.showQuickMessage(tl('message.save_file', [Project.name]))
			if (Blockbench.hasFlag('close_after_saving')) {
				closeBlockbenchWindow()
			}
		}
	}
	//Flags
	addFlag(flag) {
		this.flags[flag] = true
	}
	removeFlag(flag) {
		delete this.flags[flag]
	}
	hasFlag(flag) {
		return this.flags[flag]
	}
	//Events
	dispatchEvent(event_name, data) {
		var list = this.events[event_name]
		if (!list) return;
		for (var i = 0; i < list.length; i++) {
			if (typeof list[i] === 'function') {
				list[i](data)
			}
		}
	}
	addListener(event_name, cb) {
		if (!this.events[event_name]) {
			this.events[event_name] = []
		}
		this.events[event_name].safePush(cb)
	}
	on(event_name, cb) {
		return Blockbench.addListener(event_name, cb) 
	}
	removeListener(event_name, cb) {
		if (!this.events[event_name]) return;
		this.events[event_name].remove(cb);
	}
	//File Drag
	addDragHandler(id, options, cb) {
		var entry = {
			cb: cb
		}
		if (options.extensions && options.extensions.length) {
			entry.extensions = options.extensions
		}
		if (options.addClass !== false) entry.addClass = true;
		if (options.propagate) entry.propagate = true;
		if (options.readtype) entry.readtype = options.readtype;
		if (options.errorbox) entry.errorbox = true;
		if (options.element) entry.element = options.element;

		this.drag_handlers[id] = entry
	}
	removeDragHandler(id) {
		delete this.drag_handlers[id]
	}
}
const Blockbench = new API()

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
	if (!parseInt(settings.fadeTime)) this.fadeTime = 200


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
		var jq_dialog = $(`<div class="dialog paddinged" style="width: auto;" id="${scope.id}"><h2 class="dialog_handle">${tl(scope.title)}</h2></div>`)
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
					var bar = $('<div class="dialog_bar"></div>')
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
						case 'text':
							var regex = /\[(.+)\]\((.+\..+)\)/g;
							var matches = data.text.match(regex)
							if (matches) {
								data.text = data.text.replace(regex, (m, label, url) => {
									return `<a href="${url}" class="open-in-browser">${label}</a>`
								})
							} else {
								data.text = tl(data.text)
							}
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
				var btn = $('<button type="button">'+b+'</button>')
				buttons.push(btn)
			})
			buttons[scope.confirmIndex||0].addClass('confirm_btn')
			buttons[scope.cancelIndex||1].addClass('cancel_btn')
			jq_dialog.append($('<div class="dialog_bar button_bar"></div>').append(buttons))



		} else if (this.singleButton) {

			jq_dialog.append('<div class="dialog_bar">' +
				'<button type="button" class="large cancel_btn confirm_btn"'+ (this.confirmEnabled ? '' : ' disabled') +'>'+tl('dialog.close')+'</button>' +
			'</div>')

		} else {

			jq_dialog.append(['<div class="dialog_bar">',
				'<button type="button" class="large confirm_btn"'+ (this.confirmEnabled ? '' : ' disabled') +'>'+tl('dialog.confirm')+'</button>',
				'<button type="button" class="large cancel_btn"'+ (this.cancelEnabled ? '' : ' disabled') +'>'+tl('dialog.cancel')+'</button>',
			'</div>'].join(''))

		}
		jq_dialog.append('<div id="dialog_close_button" onclick="$(\'.dialog#\'+open_dialog).find(\'.cancel_btn:not([disabled])\').click()"><i class="material-icons">clear</i></div>')
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
		$(this.object).find('.confirm_btn').click(confirmFn)
		$(this.object).find('.cancel_btn').click(() => {this.onCancel()})
		//Draggable
		if (this.draggable !== false) {
			jq_dialog.addClass('draggable')
			jq_dialog.draggable({
				handle: ".dialog_handle"
			})
			var x = ($(window).width()-540)/2
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
		jq_dialog.find('.open-in-browser').click((event) => {
			event.preventDefault();
			shell.openExternal(event.target.href);
			return true;
		});
		open_dialog = scope.id
		open_interface = scope
		Prop.active_panel = 'dialog'
		return this;
	}
}

document.ondragover = function(event) {
	event.preventDefault()
}
document.body.ondrop = function(event) {
	event.preventDefault()
	forDragHandlers(event, function(handler, el) {
		var fileNames = event.dataTransfer.files

		var input = this;
		var results = [];
		var result_count = 0;
		var i = 0;
		var errant;
		while (i < fileNames.length) {

			if (isApp) {

				if (handler.readtype === 'image') {
					var path = fileNames[i].path
					//
					results[i] = {
						name: pathToName(path, true),
						path: path
					}
					result_count++;
					if (result_count === fileNames.length) {
						handler.cb(results, event)
					}
				} else /*text*/ {
					(function() {
						var path = fileNames[i].path
						var this_i = i;
						var data;
						try {
							data = fs.readFileSync(path, 'utf-8')
						} catch (err) {
							console.log(err)
							if (!errant && handler.errorbox !== false) {
								Blockbench.showMessageBox({
									translateKey: 'file_not_found',
									icon: 'error_outline'
								})
							}
							errant = true
						}
						if (data) {
							results[this_i] = {
								name: pathToName(path, true),
								path: path,
								content: data
							}
							result_count++;
							if (result_count === fileNames.length) {
								handler.cb(results, event)
							}
						}
					})()
				}
			} else {

				(function() {
					var file = fileNames[i]
					var reader = new FileReader()
					reader.i = i
					reader.onloadend = function() {
						results[this.i] = {
							name: file.name,
							path: file.name,
							content: reader.result
						}
						result_count++;
						if (result_count === fileNames.length) {
							handler.cb(results, event)
						}
					}
					if (handler.readtype === 'image') {
						reader.readAsDataURL(file)
					} else /*text*/ {
						reader.readAsText(file)
					}
				})()
			}
			i++;
		}
	})
}
document.body.ondragenter = function(event) {
	event.preventDefault()
	forDragHandlers(event, function(handler, el) {
		//$(el).css('background-color', 'red')
	})
}
document.body.ondragleave = function(event) {
	event.preventDefault()
	forDragHandlers(event, function(handler, el) {
		//$(el).css('background-color', '')
	})
}

function forDragHandlers(event, cb) {
	if (event.dataTransfer == undefined) {
		return; 
	}
	for (var id in Blockbench.drag_handlers) {
		var handler = Blockbench.drag_handlers[id] 
		var el = undefined;

		if (!handler.element) {
			el = $('body').get(0)

		} else if ($(handler.element).get(0) === event.target) {
			el = event.target

		} else if (typeof handler.element === 'string' && $(event.target).is(handler.element)) {
			el = event.target

		} else if (typeof handler.element === 'function') {
			var result = handler.element()
			if (result === true) {
				el = $(event.target)
			} else if ($(result).length) {
				el = $(result).get(0)
			}
		} else if (handler.propagate) {
			var parent = $(handler.element)
			if (typeof handler.element === 'function' && !result) {
				parent = $(handler.element())
			}
			if (parent && parent.has(event.target).length) {
				el = parent
			}
		}
		if (el &&
			event.dataTransfer.files.length > 0 &&
			event.dataTransfer.files[0].name &&
			handler.extensions.includes( pathToExtension(event.dataTransfer.files[0].name) )
		) {
			cb(handler, el)
		}
	}

}

