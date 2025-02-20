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
			node.classList.add('material-icons', 'notranslate', 'icon');
			node.innerText = 'help_outline';
		} else if (icon instanceof HTMLElement) {
			//Node
			node = icon
		} else if (icon === true || icon === false) {
			//Boolean
			node = document.createElement('i');
			node.classList.add('material-icons', 'notranslate', 'icon');
			node.innerText = icon ? 'check_box' : 'check_box_outline_blank';

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
			node.classList.add('material-icons', 'notranslate', 'icon');
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
	showQuickMessage(message, time = 1000) {
		document.getElementById('quick_message_box')?.remove();
		let quick_message_box = Interface.createElement('div', {id: 'quick_message_box'}, tl(message));
		document.body.append(quick_message_box);

		setTimeout(function() {
			quick_message_box.remove()
		}, time);
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
	setCursorTooltip(text) {
		if (!Interface.cursor_tooltip) {
			Interface.cursor_tooltip = Interface.createElement('div', {id: 'cursor_tooltip'});
		}
		if (text) {
			Interface.cursor_tooltip.textContent = text;
			if (!Interface.cursor_tooltip.parentNode) {
				document.body.append(Interface.cursor_tooltip);
				Interface.cursor_tooltip.style.left = mouse_pos.x + 'px';
				Interface.cursor_tooltip.style.top = mouse_pos.y + 'px';
			}
		} else {
			Interface.cursor_tooltip.textContent = '';
			Interface.cursor_tooltip.remove();
		}
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
		return new MessageBox(options, cb).show();
	},
	/**
	 * 
	 * @param {*} title 
	 * @param {*} value 
	 * @param {*} callback 
	 * @param {object} options Options
	 * @param {string} options.info Info text
	 * @param {string} options.description Description for the text input
	 * @returns {Promise<string>} Input value
	 */
	async textPrompt(title, value, callback, options = 0) {
		if (typeof options == 'string') {
			options = {placeholder: options};
			console.warn('textPrompt: 4th argument is expected to be a string');
		}
		let answer = await new Promise((resolve) => {
			let form = {
				text: {full_width: true, placeholder: options.placeholder, value, description: options.description}
			};
			if (options.info) {
				form.description = {
					type: 'info',
					text: tl(options.info)
				}
			}
			new Dialog({
				id: 'text_input',
				title: title || 'dialog.input.title',
				form,
				onConfirm({text}) {
					if (callback) callback(text);
					resolve(text);
				},
				onOpen() {
					this.object.querySelector('input')?.focus();
				}
			}).show();
		});
		return answer;
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
		let results;
		if (list) {
			results = [];
			for (let i = 0; i < list.length; i++) {
				if (typeof list[i] === 'function') {
					let result = list[i](data);
					results.push(result);
				}
			}
		}
		if (Validator.triggers.includes(event_name)) {
			Validator.validate(event_name);
		}
		return results;
	},
	on(event_name, cb) {
		return EventSystem.prototype.on.call(this, event_name, cb);
	},
	once(event_name, cb) {
		return EventSystem.prototype.once.call(this, event_name, cb);
	},
	addListener(event_name, cb) {
		return EventSystem.prototype.addListener.call(this, event_name, cb);
	},
	removeListener(event_name, cb) {
		return EventSystem.prototype.removeListener.call(this, event_name, cb);
	},
	// Update
	onUpdateTo(version, callback) {
		if (LastVersion && compareVersions(version, LastVersion) && !Blockbench.isOlderThan(version)) {
			callback(LastVersion);
		}
	}
};

(function() {
	if (!LastVersion || LastVersion.replace(/.\d+$/, '') != appVersion.replace(/.\d+$/, '')) {
		Blockbench.addFlag('after_update');
	} else if (LastVersion != appVersion) {
		Blockbench.addFlag('after_patch_update');
	}
	try {
		let ui_mode = JSON.parse(localStorage.getItem('settings')).interface_mode.value;
		if (ui_mode == 'desktop') Blockbench.isMobile = false;
		if (ui_mode == 'mobile') Blockbench.isMobile = true;
	} catch (err) {}
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
	/**
	 * Initialize a memorized property
	 * @param {string} key 
	 * @param {'string'|'number'|'boolean'|'object'|'array'} type 
	 */
	init(key, type) {
		let saved = localStorage.getItem(`StateMemory.${key}`)
		if (typeof saved == 'string') {
			try {
				saved = JSON.parse(saved)
			} catch (err) {
				localStorage.removeItem(`StateMemory.${key}`);
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
	set(key, value) {
		if (StateMemory[key] instanceof Array) {
			StateMemory[key].replace(value);
		} else {
			StateMemory[key] = value;
		}
		StateMemory.save(key);
	},
	save(key) {
		let serialized = JSON.stringify(StateMemory[key])
		localStorage.setItem(`StateMemory.${key}`, serialized)
	}
}
