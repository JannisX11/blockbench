const LastVersion = localStorage.getItem('last_version') || localStorage.getItem('welcomed_version') || appVersion;

const Blockbench = {
	isWeb: !isApp,
	isMobile: (window.innerWidth <= 960 || window.innerHeight <= 500) && 'ontouchend' in document,
	isLandscape: window.innerWidth > window.innerHeight,
	isTouch: 'ontouchend' in document,
	get isPWA() {
		return navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
	},
	version: appVersion,
	platform: 'web',
	flags: [],
	drag_handlers: {},
	events: {},
	openTime: new Date(),
	edit(aspects, cb) {
		Undo.initEdit(aspects)
		cb()
		Undo.finishEdit()
	},
	reload() {
		if (isApp) {
			Blockbench.setProgress(0)
			Blockbench.addFlag('allow_closing')
			Blockbench.addFlag('allow_reload')
			currentwindow.reload()
		} else {
			location.reload()
		}
	},
	isNewerThan(version) {
		return compareVersions(Blockbench.version, version);
	},
	isOlderThan(version) {
		return compareVersions(version, Blockbench.version);
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
			
		} else if (icon.match(/^(fa[.-])|(fa[rsb]\.)/)) {
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
	/**
	 * 
	 * @param {object} options Options
	 * @param {string} options.text Text Message
	 * @param {string} [options.icon] Blockbench icon string
	 * @param {number} [options.expire] Expire time in miliseconds
	 * @param {string} [options.color] Background color, accepts any CSS color string
	 * @param {function} [options.click] Method to run on click. Return `true` to close toast
	 * 
	 */
	showToastNotification(options) {
		let notification = document.createElement('li');
		notification.className = 'toast_notification';
		if (options.icon) {
			let icon = Blockbench.getIconNode(options.icon);
			notification.append(icon);
		}
		let text = document.createElement('span');
		text.innerText = tl(options.text);
		notification.append(text);

		let close_button = document.createElement('div');
		close_button.innerHTML = '<i class="material-icons">clear</i>';
		close_button.className = 'toast_close_button';
		close_button.addEventListener('click', (event) => {
			notification.remove();
		})
		notification.append(close_button);

		if (options.color) {
			notification.style.backgroundColor = options.color;
		}
		if (typeof options.click == 'function') {
			notification.addEventListener('click', (event) => {
				if (event.target == close_button || event.target.parentElement == close_button) return;
				let result = options.click(event);
				if (result == true) {
					notification.remove();
				}
			})
			notification.style.cursor = 'pointer';
		}

		if (options.expire) {
			setTimeout(() => {
				notification.remove();
			}, options.expire);
		}

		document.getElementById('toast_notification_list').append(notification);

		function deletableToast(node) {
			this.delete = function() {
				node.remove();
			}
		}
		return new deletableToast(notification);
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
	showMessageBox(options = 0, cb) {

		if (options.confirm === undefined) options.confirm = 0
		if (options.cancel === undefined) options.cancel = (options.buttons && options.buttons.length) ? options.buttons.length-1 : 0;
		if (!options.buttons) options.buttons = [tl('dialog.ok')]

		if (options.translateKey) {
			if (!options.title) options.title = tl('message.'+options.translateKey+'.title')
			if (!options.message) options.message = tl('message.'+options.translateKey+'.message')
		}

		var jq_dialog = $(`
			<dialog class="dialog" style="width: auto;" id="message_box">
				<div class="dialog_handle"><div class="dialog_title">${tl(options.title)}</div></div>
				<div class="dialog_close_button" onclick="open_interface.cancel()"><i class="material-icons">clear</i></div>
			</dialog>`)

		jq_dialog.append('<div class="dialog_content"><div class="dialog_bar markdown" style="height: auto; min-height: 56px; margin-bottom: 16px;">'+
			marked(tl(options.message))+
			'</div></div>'
		)
		if (options.icon) {
			jq_dialog.find('.dialog_bar').prepend($(Blockbench.getIconNode(options.icon)).addClass('message_box_icon'))
		}

		function close(button) {
			hideDialog();
			setTimeout(function() {
				jq_dialog.remove();
			},200)
			if (cb) {
				cb(button);
			}
		}

		var buttons = []

		options.buttons.forEach(function(b, i) {
			var btn = $('<button type="button">'+tl(b)+'</button>')
			btn.click(function(e) {
				close(i);
			})
			buttons.push(btn);
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
		var x = (window.innerWidth-540)/2
		jq_dialog.css('left', x+'px')
		jq_dialog.css('position', 'absolute')

		$('#dialog_wrapper').append(jq_dialog)
		$('.dialog').hide()
		$('#blackout').show()
		jq_dialog.show()

		jq_dialog.css('top', limitNumber(window.innerHeight/2-jq_dialog.height()/2 - 140, 0, 2000)+'px')
		if (options.width) {
			jq_dialog.css('width', options.width+'px')
		} else {
			jq_dialog.css('width', limitNumber(options.buttons.length*170+44, 380, 894)+'px')
		}
		open_dialog = 'message_box'
		open_interface = {
			confirm() {
				close(options.confirm);
			},
			cancel() {
				close(options.cancel);
			}
		}
		return jq_dialog
	},
	async textPrompt(title, value, callback, placeholder = null) {
		showDialog('text_input')
		$('#text_input .dialog_handle .dialog_title').text(tl(title || 'dialog.input.title'))
		$('#text_input input#text_input_field').val(value).trigger('select').attr('placeholder', placeholder);
		$('#text_input button.confirm_btn').off()
		let text = await new Promise(resolve => {
			$('#text_input button.confirm_btn').on('click', function() {
				var s = $('#text_input input#text_input_field').val()
				resolve(s)
			})
		})
		if (callback !== undefined) {
			callback(text);
		}
		return text;
	},
	addMenuEntry(name, icon, click) {
		console.warn('Blockbench.addMenuEntry is deprecated. Please use Actions instead.')
		let id = name.replace(/\s/g, '').toLowerCase();
		var action = new Action(id, {icon: icon, name: name, click: click})
		MenuBar.addAction(action, 'tools')
	},
	removeMenuEntry(name) {
		let id = name.replace(/\s/g, '').toLowerCase();
		MenuBar.removeAction('tools.'+id);
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
	//CSS
	addCSS(css) {
		let style_node = document.createElement('style');
        style_node.type ='text/css';
        style_node.appendChild(document.createTextNode(css));
		document.getElementsByTagName('head')[0].appendChild(style_node);
		function deletableStyle(node) {
			this.delete = function() {
				node.remove();
			}
		}
		return new deletableStyle(style_node);
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
		let list = this.events[event_name];
		if (!list) return;
		let results = [];
		for (let i = 0; i < list.length; i++) {
			if (typeof list[i] === 'function') {
				let result = list[i](data);
				results.push(result);
			}
		}
		return results;
	},
	addListener(event_names, cb) {
		event_names.split(' ').forEach(event_name => {
			if (!this.events[event_name]) {
				this.events[event_name] = [];
			}
			this.events[event_name].safePush(cb);
		})
		return Blockbench;
	},
	on(event_name, cb) {
		return Blockbench.addListener(event_name, cb) 
	},
	removeListener(event_name, cb) {
		if (!this.events[event_name]) return;
		this.events[event_name].remove(cb);
	},
	onUpdateTo(version, callback) {
		if (LastVersion && compareVersions(version, LastVersion) && !Blockbench.isOlderThan(version)) {
			callback(LastVersion);
		}
	}
};

(function() {
	if (!LastVersion || LastVersion.replace(/.\d+$/, '') != appVersion.replace(/.\d+$/, '')) {
		Blockbench.addFlag('after_update');
	}
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
