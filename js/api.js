const Blockbench = {
	isWeb: !isApp,
	isMobile: window.innerWidth <= 480,
	version: appVersion,
	platform: 'web',
	flags: [],
	drag_handlers: {},
	events: {},
	openTime: new Date(),
	get elements() {
		console.warn('Blockbench.elements is deprecated. Please use Outliner.elements instead.')
		return Outliner.elements
	},
	get selection() {
		console.warn('Blockbench.selection is deprecated. Please use Cube.selected or Outliner.selected instead.')
		return Cube.selected
	},
	get textures() {
		console.warn('Blockbench.textures is deprecated. Please just use textures instead.')
		return textures;
	},
	edit(aspects, cb) {
		Undo.initEdit(aspects)
		cb()
		Undo.finishEdit()
	},
	reload() {
		localStorage.removeItem('backup_model')
		if (isApp) {
			Blockbench.addFlag('allow_closing')
			Blockbench.addFlag('allow_reload')
			currentwindow.reload()
		} else {
			location.reload()
		}
	},
	registerEdit() {
		console.warn('Blockbench.registerEdit is outdated. Please use Undo.initEdit and Undo.finishEdit')
	},
	//Interface
	getIconNode(icon, color) {
		let node;
		if (typeof icon === 'function') {
			icon = icon()
		}
		if (icon === undefined) {
			//Missing
			node = document.createElement('i');
			node.classList.add('material-icons', 'icon');
			node.innerText = 'help_outline';
		} else if (icon instanceof HTMLElement) {
			//Node
			node = icon
		} else if (icon === null) {
			//Node
			node = document.createElement('i');
			node.classList.add('fa_big', 'icon');
			
		} else if (icon.substr(0, 2) === 'fa') {
			//Font Awesome
			node = document.createElement('i');
			node.classList.add('fa_big', 'icon');
			if (icon.substr(3, 1) === '.') {
				node.classList.add(icon.substr(0, 3), icon.substr(4));
			} else {
				node.classList.add('fa', icon);
			}
		} else if (icon.substr(0, 5) === 'icon-') {
			//Icomoon
			node = document.createElement('i');
			node.classList.add(icon, 'icon');
		} else if (icon.substr(0, 14) === 'data:image/png') {
			//Data URL
			node = document.createElement('img');
			node.classList.add('icon');
			node.src = icon;
		} else {
			//Material Icon
			node = document.createElement('i');
			node.classList.add('material-icons', 'icon');
			node.innerText = icon;
		}
		if (color) {
			if (color === 'x') {
				node.classList.add('color_x');
			} else if (color === 'y') {
				node.classList.add('color_y');
			} else if (color === 'z') {
				node.classList.add('color_z');
			} else if (typeof color === 'string') {
				node.style.color = color;
			}
		}
		return node
	},
	showQuickMessage(message, time) {
		$('#quick_message_box').remove()
		var quick_message_box = $('<div id="quick_message_box" class="hidden"></div>') 
		$('body').append(quick_message_box)
		
		quick_message_box.text(tl(message))
		quick_message_box.fadeIn(0)
		setTimeout(function() {
			quick_message_box.fadeOut(0)
			setTimeout(function() {
				quick_message_box.remove()
			}, 1)
		}, time ? time : 1000)
	},
	showCenterTip(message, time) {
		$('#center_tip').remove()
		var center_tip = $(`<div id="center_tip"><i class="material-icons">info</i>${tl(message)}</div>`) 
		$('#preview').append(center_tip)
		
		setTimeout(function() {
			center_tip.fadeOut(0)
			setTimeout(function() {
				center_tip.remove()
			}, 1)
		}, time ? time : 7500)
	},
	showStatusMessage(message, time) {
		Blockbench.setStatusBarText(tl(message))
		setTimeout(function() {
			Blockbench.setStatusBarText()
		}, time ? time : 800)
	},
	setStatusBarText(text) {
		if (text !== undefined) {
			Prop.file_name = text
		} else {
			Prop.file_name = Prop.file_name_alt||''
		}
	},
	setProgress(progress, time, bar) {
		setProgressBar(bar, progress||0, time)
	},
	showMessage(message, location) {
		if (location === 'status_bar') {
			Blockbench.showStatusMessage(message)
		} else if (location === 'center') {
			Blockbench.showQuickMessage(message)
		}
	},
	showMessageBox(options, cb) {

		if (options.confirm === undefined) options.confirm = 0
		if (options.cancel === undefined) options.cancel = 0
		if (!options.buttons) options.buttons = [tl('dialog.ok')]

		if (options.translateKey) {
			if (!options.title) options.title = tl('message.'+options.translateKey+'.title')
			if (!options.message) options.message = tl('message.'+options.translateKey+'.message')
		}

		var jq_dialog = $('<dialog class="dialog paddinged" style="width: auto;" id="message_box"><div class="dialog_handle">'+options.title+'</div></dialog>')

		jq_dialog.append('<div class="dialog_bar" style="height: auto; min-height: 56px; margin-bottom: 16px;">'+
			marked(tl(options.message))+'</div>'
		)
		if (options.icon) {
			jq_dialog.find('.dialog_bar').prepend($(Blockbench.getIconNode(options.icon)).addClass('message_box_icon'))
		}

		var buttons = []

		options.buttons.forEach(function(b, i) {
			var btn = $('<button type="button">'+tl(b)+'</button>')
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
		buttons.forEach(b => {
			b.after('&nbsp;')
		})


		jq_dialog.addClass('draggable')
		jq_dialog.draggable({
			handle: ".dialog_handle",
			containment: '#page_wrapper'
		})
		var x = ($(window).width()-540)/2
		jq_dialog.css('left', x+'px')
		jq_dialog.css('position', 'absolute')

		$('#plugin_dialog_wrapper').append(jq_dialog)
		$('.dialog').hide()
		$('#blackout').show()
		jq_dialog.show()

		jq_dialog.css('top', limitNumber($(window).height()/2-jq_dialog.height()/2 - 140, 0, 2000)+'px')
		if (options.width) {
			jq_dialog.css('width', options.width+'px')
		} else {
			jq_dialog.css('width', limitNumber(options.buttons.length*170+44, 380, 894)+'px')
		}
		open_dialog = 'message_box'
		open_interface = 'message_box'
		return jq_dialog
	},
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
	},
	addMenuEntry(name, icon, click) {
		var action = new Action(name, {icon: icon, name: name, click: click})
		MenuBar.addAction(action, 'filter')
	},
	removeMenuEntry(name) {
		MenuBar.removeAction('filter.'+name)
	},
	openLink(link) {
		if (isApp) {
			shell.openExternal(link)
		} else {
			window.open(link)
		}
	},
	notification(title, text, icon) {
		Notification.requestPermission().then(status => {
			if (status == 'granted') {
				let n = new Notification(title, {body: text, icon: icon||'favicon.png'})
				n.onclick = function() {
					if (isApp) {
						currentwindow.focus();
					} else {
						window.focus();
					}
				}
			}
		})
	},
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
			//resource_id

		if (isApp) {
			var properties = []
			if (options.multiple) {
				properties.push('multiSelections')
			}
			if (options.extensions[0] === 'image/*') {
				options.type = 'Images'
				options.extensions = ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif']
			}
			if (!options.startpath && options.resource_id) {
				options.startpath = StateMemory.dialog_paths[options.resource_id]
			}

			ElecDialogs.showOpenDialog(
				currentwindow,
				{
					title: options.title ? options.title : '',
					dontAddToRecent: true,
					filters: [{
						name: options.type ? options.type : options.extensions[0],
						extensions: options.extensions
					}],
					properties: (properties.length && Blockbench.platform !== 'darwin')?properties:undefined,
					defaultPath: settings.streamer_mode.value
						? app.getPath('desktop')
						: options.startpath
				},
			function (fileNames) {
				if (!fileNames) return;
				if (options.resource_id) {
					StateMemory.dialog_paths[options.resource_id] = PathModule.dirname(fileNames[0])
					StateMemory.save('dialog_paths')
				}
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
				Blockbench.read(input.files, options, cb)
			}).click()
		}
	},
	read(files, options, cb) {
		if (files == undefined) return false;
		if (typeof files == 'string') files = [files];

		var results = [];
		var result_count = 0;
		var i = 0;
		var errant;
		if (isApp) {
			while (i < files.length) {
				(function() {
					var this_i = i;
					var file = files[i]
					let readtype = options.readtype;
					if (typeof readtype == 'function') {
						readtype = readtype(file);
					}

					if (readtype === 'image') {
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
								if (result_count === files.length) {
									cb(results)
								}
							})

						} else {
							results[this_i] = {
								name: pathToName(file, true),
								path: file
							}
							result_count++;
							if (result_count === files.length) {
								cb(results)
							}
						}
					} else /*text*/ {
						var load = function (err, data) {
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
							if ((readtype != 'buffer' && readtype != 'binary') && data.charCodeAt(0) === 0xFEFF) {
								data = data.substr(1)
							}
							results[this_i] = {
								name: pathToName(file, true),
								path: file,
								content: data
							}
							result_count++;
							if (result_count === files.length) {
								cb(results)
							}
						}
						if (readtype === 'buffer' || readtype === 'binary') {
							fs.readFile(file, load);
						} else {
							fs.readFile(file, 'utf8', load);
						}
					}
				})()
				i++;
			}
		} else {
			while (i < files.length) {
				(function() {
					var file = files[i]
					var reader = new FileReader()
					reader.i = i
					reader.onloadend = function() {

						if (reader.result.byteLength && pathToExtension(file.name) === 'tga') {
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
						if (result_count === files.length) {
							cb(results)
						}
					}
					let readtype = options.readtype;
					if (typeof readtype == 'function') {
						readtype = readtype(file.name);
					}
					if (readtype === 'image') {
						if (pathToExtension(file.name) === 'tga') {
							reader.readAsArrayBuffer(file)
						} else {
							reader.readAsDataURL(file)
						}
					} else if (readtype === 'buffer' || readtype === 'binary') {
						reader.readAsArrayBuffer(file)
					} else /*text*/ {
						reader.readAsText(file)
					}
					i++;
				})()
			}
		}
	},
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
			resource_id
		*/
		if (Blockbench.isWeb) {
			var file_name = options.name + (options.extensions ? '.'+options.extensions[0] : '')
			if (options.custom_writer) {
				options.custom_writer(options.content, file_name)
				
			} else if (options.savetype === 'image') {

				var download = document.createElement('a');
				download.href = options.content
				download.download = file_name;
				if (Blockbench.browser === 'firefox') document.body.appendChild(download);
				download.click();
				if (Blockbench.browser === 'firefox') document.body.removeChild(download);

			} else if (options.savetype === 'zip' || options.savetype === 'buffer' || options.savetype === 'binary') {
				saveAs(options.content, file_name)

			} else {
				var blob = new Blob([options.content], {type: "text/plain;charset=utf-8"});
				saveAs(blob, file_name, {autoBOM: true})
			}
			if (typeof cb === 'function') {
				cb(file_name)
			}
		} else {
			if (!options.startpath && options.resource_id) {
				options.startpath = StateMemory.dialog_paths[options.resource_id]
				if (options.name) {
					options.startpath += osfs + options.name + (options.extensions ? '.'+options.extensions[0] : '');
				}
			}
			ElecDialogs.showSaveDialog(currentwindow, {
				dontAddToRecent: true,
				filters: [ {
					name: options.type,
					extensions: options.extensions
				} ],
				defaultPath: settings.streamer_mode.value
					? app.getPath('desktop')
					: ((options.startpath && options.startpath !== 'Unknown')
						? options.startpath.replace(/\.\w+$/, '')
						: options.name)
			}, function (file_path) {
				if (!file_path) return;
				if (options.resource_id) {
					StateMemory.dialog_paths[options.resource_id] = PathModule.dirname(file_path)
					StateMemory.save('dialog_paths')
				}
				var extension = pathToExtension(file_path);
				if (!extension && options.extensions && options.extensions[0]) {
					file_path += '.'+options.extensions[0]
				}
				Blockbench.writeFile(file_path, options, cb)
			})
		}
	},
	writeFile(file_path, options, cb) {
		/*	
			content
			savetype
			project_file
			custom_writer
		*/
		if (!isApp || !file_path) {
			return;
		}
		if (options.savetype === 'image' && typeof options.content === 'string') {
			if (options.content.substr(0, 10) === 'data:image') {
				options.content = nativeImage.createFromDataURL(options.content).toPNG()
			} else {
				options.content = options.content.replace(/\?\d+$/, '');
				options.content = nativeImage.createFromPath(options.content).toPNG()
			}
		}
		if (options.savetype === 'zip') {
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
			//text or binary
			fs.writeFileSync(file_path, options.content)
			if (cb) {
				cb(file_path)
			}
		}
	},
	//Flags
	addFlag(flag) {
		this.flags[flag] = true
	},
	removeFlag(flag) {
		delete this.flags[flag]
	},
	hasFlag(flag) {
		return this.flags[flag]
	},
	//Events
	dispatchEvent(event_name, data) {
		var list = this.events[event_name]
		if (!list) return;
		for (var i = 0; i < list.length; i++) {
			if (typeof list[i] === 'function') {
				list[i](data)
			}
		}
	},
	addListener(event_name, cb) {
		if (!this.events[event_name]) {
			this.events[event_name] = []
		}
		this.events[event_name].safePush(cb)
		return Blockbench;
	},
	on(event_name, cb) {
		return Blockbench.addListener(event_name, cb) 
	},
	removeListener(event_name, cb) {
		if (!this.events[event_name]) return;
		this.events[event_name].remove(cb);
	},
	//File Drag
	addDragHandler(id, options, cb) {
		var entry = {
			cb: cb,
			condition: options.condition
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
	},
	removeDragHandler(id) {
		delete this.drag_handlers[id]
	},
};

(function() {
	var last_welcome = localStorage.getItem('welcomed_version');
	if (!last_welcome || last_welcome.replace(/.\d+$/, '') != appVersion.replace(/.\d+$/, '')) {
		Blockbench.addFlag('after_update');
	}
	localStorage.setItem('welcomed_version', appVersion);
})();

if (isApp) {
	Blockbench.platform = process.platform;
	switch (Blockbench.platform) {
		case 'win32': 	Blockbench.operating_system = 'Windows'; break;
		case 'darwin': 	Blockbench.operating_system = 'macOS'; break;
		default:		Blockbench.operating_system = 'Linux'; break;
	}
	if (Blockbench.platform.includes('win32') === true) osfs = '\\';
}



const StateMemory = {
	init(key, type) {
		let saved = localStorage.getItem(`StateMemory.${key}`)
		if (typeof saved == 'string') {
			try {
				saved = JSON.parse(saved)
			} catch (err) {
				localStorage.clearItem(`StateMemory.${key}`)
			}
		}
		if ( saved !== null && (typeof saved == type || (type == 'array' && saved instanceof Array)) ) {
			StateMemory[key] = saved;
		} else {
			StateMemory[key] = (() => {switch (type) {
				case 'string': return ''; break;
				case 'number': return 0; break;
				case 'boolean': return false; break;
				case 'object': return {}; break;
				case 'array': return []; break;
			}})();
		}
	},
	save(key) {
		let serialized = JSON.stringify(StateMemory[key])
		localStorage.setItem(`StateMemory.${key}`, serialized)
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
		var paths = []
		if (isApp) {
			for (var file of fileNames) {
				paths.push(file.path)
			}
		} else {
			paths = fileNames
		}
		Blockbench.read(paths, handler, (content) => {
			handler.cb(content, event)
		})
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
	if (event.dataTransfer == undefined || event.dataTransfer.files.length == 0 || !event.dataTransfer.files[0].name) {
		return; 
	}
	for (var id in Blockbench.drag_handlers) {
		var handler = Blockbench.drag_handlers[id] 
		var el = undefined;
		if (!Condition(handler.condition)) {
			continue;
		}

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
		handler.extensions.includes( pathToExtension(event.dataTransfer.files[0].name).toLowerCase())
		var name = event.dataTransfer.files[0].name;
		if (el && handler.extensions.filter(ex => {
			return name.substr(-ex.length) == ex;
		}).length) {
			cb(handler, el)
			break;
		}
	}
}
