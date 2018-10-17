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
		this.entity_mode = false
		if (isApp) {
			this.platform = require('os').platform()
			if (this.platform.includes('win32') === true) osfs = '\\'
		}
	}
	edit(aspects, cb) {
		Undo.initEdit(aspects)
		cb()
		Undo.finishEdit()
	}
	reload() {
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
		console.error('Blockbench.registerEdit is outdated. Please use Undo.initEdit and Undo.finishEdit')
	}

	//Interface
	getIconNode(icon, color) {
		var jq;
		if (typeof icon === 'function') {
			icon = icon()
		}
		if (icon === undefined) {
			jq = $('<i class="material-icons icon">help_outline</i>')
		} else if (icon instanceof HTMLElement) {
			jq = $(icon)
		} else if (icon.substr(0, 2) === 'fa') {
			jq = $('<i class="icon fa fa_big ' + icon + '"></i>')
		} else if (icon.substr(0, 5) === 'icon-') {
			jq = $('<i class="' + icon + '"></i>')
		} else if (icon.substr(0, 14) === 'data:image/png') {
			jq = $('<img class="icon" src="'+icon+'">')
		} else {
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
		var status_message = $('#status_message')
		var status_name	= $('#status_name')

		status_message.text(tl(message))

		status_name.hide(100)
		status_message.show(100)

		setTimeout(function() {
			status_message.hide(100)
			status_name.show(100)
		}, time ? time : 600)
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
			var btn = $('<button type="button" class="large">'+b+'</button>')
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
		jq_dialog.append($('<div class="dialog_bar"></div>').append(buttons))


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

		setTimeout(function() {
			$('.context_handler.ctx').removeClass('ctx')
		}, 64)
		open_dialog = 'message_box'
		open_interface = 'message_box'
		return jq_dialog
	}
	textPrompt(title, value, callback) {
		showDialog('text_input')
		$('#text_input h2').text(title)
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
		MenuBar.addAction({icon: icon, name: name, id: name, click: click}, 'filter')
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

			app.dialog.showOpenDialog(
				currentwindow,
				{
					title: options.title ? options.title : '',
					filters: [{
						name: options.type ? options.type : options.extensions[0],
						extensions: options.extensions
					}],
					properties: properties,
					defaultPath: options.startpath
				},
			function (fileNames) {
				if (fileNames == undefined) return;

				var results = [];
				var result_count = 0;
				var i = 0;
				var errant;
				while (i < fileNames.length) {
					(function() {
						var this_i = i;
						var file = fileNames[i]

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
									if (result_count === fileNames.length) {
										cb(results)
									}
								})

							} else {
								results[this_i] = {
									name: pathToName(file, true),
									path: file
								}
								result_count++;
								if (result_count === fileNames.length) {
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
								if (result_count === fileNames.length) {
									cb(results)
								}
							})
						}
					})()
					i++;
				}

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
						} else /*text*/ {
							reader.readAsText(file)
						}
						i++;
					})()
				}
			}).click()
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
			custom_writer
		*/
		if (Blockbench.isWeb) {
			var file_name = options.name + (options.extensions ? '.'+options.extensions[0] : '')
			if (options.savetype === 'image') {

				var download = document.createElement('a');
				download.href = file_name
				download.download = options.name;
				if (Blockbench.browser === 'firefox') document.body.appendChild(download);
				download.click();
				if (Blockbench.browser === 'firefox') document.body.removeChild(download);
			} else {
				var blob = new Blob([options.content], {type: "text/plain;charset=utf-8"});
				saveAs(blob, file_name, {autoBOM: true})
			}
			if (typeof cb === 'function') {
				cb()
			}
		} else {
			app.dialog.showSaveDialog(currentwindow, {
				filters: [ {
					name: options.type,
					extensions: options.extensions
				} ],
				defaultPath: options.startpath !== 'Unknown' ? options.startpath : options.name
			}, function (file_path) {
				if (file_path === undefined) {
					return;
				}
				if (options.savetype === 'image' && typeof options.content === 'string') {
					if (options.content.substr(0, 10) === 'data:image') {
						options.content = nativeImage.createFromDataURL(options.content).toPNG()
					} else {
						options.content = nativeImage.createFromPath(options.content).toPNG()
					}
				}
				if (options.custom_writer) {
					options.custom_writer(options.content, file_path)
				} else {
					fs.writeFile(file_path, options.content, function (err) {
						if (err) {
							console.log('Error exporting file: '+err)
							return;
						}
						if (cb) {
							cb(file_path)
						}
					})
				}
			})
		}
	}
	//Flags
	addFlag(flag) {
		if (!this.hasFlag(flag)) {
			this.flags.push(flag)
		}
	}
	removeFlag(flag) {

		this.flags.remove(flag)
	}
	hasFlag(flag) {

		return this.flags.includes(flag)
	}
	//Events
	dispatchEvent(event_name, event) {
		if (!this.listeners) {
			return;
		}
		var i = 0;
		while (i < this.listeners.length) {
			if (this.listeners[i].name === event_name) {
				this.listeners[i].callback(event)
			}
			i++;
		}
	}
	addListener(event_name, cb) {
		if (!this.listeners) {
			this.listeners = []
		}
		this.listeners.push({name: event_name, callback: cb})
	}
	removeListener(event_name, cb) {
		if (!this.listeners) {
			return;
		}
		var i = 0;
		while (i < this.listeners.length) {
			if (this.listeners[i].name === event_name && this.listeners[i].callback === cb) {
				this.listeners.splice(i, 1)
			}
			i++;
		}
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
var Blockbench = new API()

function Dialog(settings) {
	var scope = this;
	this.title = settings.title
	this.lines = settings.lines
	this.id = settings.id
	this.width = settings.width
	this.fadeTime = settings.fadeTime
	this.draggable = settings.draggable
	this.singleButton = settings.singleButton
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
		var jq_dialog = $('<div class="dialog paddinged" style="width: auto;" id="'+scope.id+'"><h2 class="dialog_handle">'+scope.title+'</h2></div>')
		scope.object = jq_dialog.get(0)
		var max_label_width = 0;
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
		if (max_label_width) {
			document.styleSheets[0].insertRule('.dialog#'+this.id+' .dialog_bar label {width: '+(max_label_width+14)+'px}')
		}
		if (this.singleButton) {
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
		$(this.object).find('.confirm_btn').click(this.onConfirm)
		$(this.object).find('.cancel_btn').click(this.onCancel)
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
		setTimeout(function() {
			$('.context_handler.ctx').removeClass('ctx')
		}, 64)
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
						fs.readFile(path, 'utf-8', function (err, data) {
							if (err) {
								console.log(err)
								if (!errant && handler.errorbox !== false) {
									Blockbench.showMessageBox({
										translateKey: 'file_not_found',
										icon: 'error_outline'
									})
								}
								errant = true
								return;
							}
							results[this_i] = {
								name: pathToName(path, true),
								path: path,
								content: data
							}
							result_count++;
							if (result_count === fileNames.length) {
								handler.cb(results, event)
							}
						})
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

