class Keybind {
	constructor(keys) {
		this.key 	= -1;
		this.ctrl 	= false;
		this.shift 	= false;
		this.alt 	= false;
		this.meta 	= false;
		this.label = '';
		if (keys) {
			this.set(keys)
		}
	}
	set(keys) {
		if (!keys || typeof keys !== 'object') return this;
		this.key = keys.key
		if (this.ctrl 	!== null) this.ctrl 	= (keys.ctrl === null) ? null : (keys.ctrl 	== true);
		if (this.shift 	!== null) this.shift 	= (keys.shift=== null) ? null : (keys.shift == true);
		if (this.alt 	!== null) this.alt 		= (keys.alt  === null) ? null : (keys.alt 	== true);
		if (this.meta 	!== null) this.meta 	= (keys.meta === null) ? null : (keys.meta 	== true);
		this.label = this.getText()
		return this;
	}
	clear() {
		this.set({
			key: -1,
			ctrl: false,
			shift: false,
			alt: false,
			meta: false
		})
		return this;
	}
	save(save) {
		if (this.action) {
			var obj = {
				key: this.key
			}
			if (this.ctrl)	 obj.ctrl = true
			if (this.shift)	 obj.shift = true
			if (this.alt)	 obj.alt = true
			if (this.meta)	 obj.meta = true

			Keybinds.stored[this.action] = obj
			if (save !== false) {
				Keybinds.save()
			}
		}
		return this;
	}
	setAction(id) {
		var action = BarItems[id]
		if (!action) {
			action = Keybinds.extra[id]
		}
		if (!action) {
			return;
		}
		this.action = id
		if (!Keybinds.structure[action.category]) {
			Keybinds.structure[action.category] = {
				actions: [],
				id: action.category,
				name: tl('category.'+action.category),
				open: false
			}
		}
		Keybinds.structure[action.category].actions.push(action)
		return this;
	}
	getText() {
		var modifiers = []

		if (this.ctrl) 	modifiers.push(tl('keys.ctrl'))
		if (this.shift) modifiers.push(tl('keys.shift'))
		if (this.alt) 	modifiers.push(tl('keys.alt'))
		if (this.meta) 	modifiers.push(tl('keys.meta'))

		//if (this.ctrl === null) 	modifiers.push('[' + tl('keys.ctrl') 	+ ']')
		//if (this.shift === null)	modifiers.push('[' + tl('keys.shift') 	+ ']')
		//if (this.alt === null) 		modifiers.push('[' + tl('keys.alt')		+ ']')
		//if (this.meta === null) 	modifiers.push('[' + tl('keys.meta') 	+ ']')

		var char = this.getCode()//String.fromCharCode(this.code).toLowerCase()
		var char_tl = tl('keys.'+char)
		if (char_tl === ('keys.'+char)) {
			modifiers.push(capitalizeFirstLetter(char))
		} else {
			modifiers.push(char_tl)
		}
		//modifiers.push(capitalizeFirstLetter(String.fromCharCode(this.code)))
		return modifiers.join(' + ')
	}
	getCode(key) {
		if (!key) key = this.key;
		if (key < 0) {
			return ''
		} else if (key >= 112 && key <= 123) {
			return tl('keys.function', [key-111])
		} else if (key >= 96 && key <= 105) {
			return tl('keys.numpad', [key-96])
		}
		switch (key) {
			case   1: return 'leftclick'; break;
			case   2: return 'middleclick'; break;
			case   3: return 'rightclick'; break;
			case   9: return 'tab'; break;
			case   8: return 'backspace'; break;
			case  13: return 'enter'; break;
			case  27: return 'escape'; break;
			case  46: return 'delete'; break;
			case  46: return 'caps'; break;
			case  16: return 'shift'; break;
			case  17: return 'control'; break;
			case  18: return 'alt'; break;
			case  32: return 'space'; break;
			case  93: return 'menu'; break;
			case 187: return 'plus'; break;
			case 188: return 'comma'; break;
			case 190: return 'point'; break;
			case 189: return 'minus'; break;
			case 191: return 'cross'; break;
			case  37: return 'left'; break;
			case  38: return 'up'; break;
			case  39: return 'right'; break;
			case  40: return 'down'; break;
			case  33: return 'pageup'; break;
			case  34: return 'pagedown'; break;
			case  35: return 'end'; break;
			case  36: return 'pos1'; break;
			case  44: return 'printscreen'; break;
			case  19: return 'pause'; break;
			default : return String.fromCharCode(key).toLowerCase(); break;
		}
	}
	isTriggered(event) {
		return (
			this.key 	=== event.which &&
			(this.ctrl 	=== event.ctrlKey 	|| this.ctrl == null 	) &&
			(this.shift === event.shiftKey 	|| this.shift == null	) &&
			(this.alt 	=== event.altKey 	|| this.alt == null 	) &&
			(this.meta 	=== event.metaKey	|| this.meta == null 	)
		)
	}
	record() {
		var scope = this;
		Keybinds.recording = true;
		var overlay = $('<div id="overlay_message_box" contenteditable="true"></div>')
		$('body').append(overlay)
		overlay.focus()
		overlay.on('keyup mousedown', function(event) {
			overlay.off('keyup mousedown')
			scope.key 	= event.which
			if (scope.ctrl 	!== null) scope.ctrl 	= event.ctrlKey
			if (scope.shift !== null) scope.shift 	= event.shiftKey
			if (scope.alt 	!== null) scope.alt 	= event.altKey
			if (scope.meta 	!== null) scope.meta 	= event.metaKey
			scope.label = scope.getText()
			scope.save(true)
			Keybinds.recording = false
			overlay.detach().hide()
		}).on('keydown keypress keyup click click dblclick mouseup', function(event) {
			event.preventDefault()
		})
		return this;
	}
}

onVueSetup(function() {
	Keybinds.vue = new Vue({
		el: 'ul#keybindlist',
		data: {structure: Keybinds.structure},
		methods: {

		},
		methods: {
			record: function(item) {
				if (!item.keybind) {
					item.keybind = new Keybind()
				}
				item.keybind.record()
			},
			reset: function(item) {
				if (item.keybind) {
					if (item.default_keybind) {
						item.keybind.set(item.default_keybind);
					} else {
						item.keybind.clear();
					}
					item.keybind.save(true);
				}
			},
			clear: function(item) {
				if (item.keybind) {
					item.keybind.clear().save(true)
				}
			},
			toggleCategory: function(category) {
				if (!category.open) {
					for (var ct in Keybinds.structure) {
						Keybinds.structure[ct].open = false
					}
					
				}
				category.open = !category.open
			}
		}
	})
})

$(document).keydown(function(e) {
	if (Keybinds.recording) return;
	//Shift
	holding_shift = e.shiftKey;
	if (e.which === 16) {
		showShiftTooltip()
	}

	var used = false;
	var input_focus = $('input[type="text"]:focus, input[type="number"]:focus, div[contenteditable="true"]:focus, textarea:focus').length > 0

	if (input_focus) {
		//User Editing Anything
	    if (Blockbench.hasFlag('renaming')) {
	        if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
	            stopRenameCubes()
	        } else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
	            stopRenameCubes(false)
	        }
	        return;
	    }
		if (Keybinds.extra.confirm.keybind.isTriggered(e) || Keybinds.extra.cancel.keybind.isTriggered(e)) {
			$(document).click()
		}
	}
	//Hardcoded Keys
	if (e.ctrlKey === true && e.which == 73 && isApp) {
		electron.getCurrentWindow().toggleDevTools()
		used = true
	} else if (e.which === 18 && Toolbox.selected.alt_tool && !Toolbox.original) {
		//Alt Tool
		var orig = Toolbox.selected;
		var alt = BarItems[Toolbox.selected.alt_tool]
		if (alt && Condition(alt)) {
			alt.select()
			Toolbox.original = orig
		}
	} else if (Keybinds.extra.cancel.keybind.isTriggered(e) && (Transformer.dragging/* || ...*/)) {
		Undo.cancelEdit()
	}
	//Keybinds
	if (!input_focus) {
		Keybinds.actions.forEach(function(action) {
			if (
				action.keybind &&
				(!open_dialog || action.work_in_dialog) &&
				typeof action.trigger === 'function' &&
				action.keybind.isTriggered(e)
			) {
				if (action.trigger(e)) {
					used = true
				}
			}
		})
	}
	//Dialog
	if (open_dialog) {
		if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
			$('.dialog#'+open_dialog).find('.confirm_btn:not([disabled])').click()
			used = true
		} else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
			$('.dialog#'+open_dialog).find('.cancel_btn:not([disabled])').click()
			used = true
		}
	//Menu
	} else if (open_menu) {

		used = open_menu.keyNavigate(e)||used

	} else if (open_interface && typeof open_interface == 'object' && open_interface.hide) {
		if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
			open_interface.confirm(e)
			used = true
		} else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
			open_interface.hide(e)
			used = true
		}
	}
	if (ActionControl.open) {
		used = ActionControl.handleKeys(e) || used
	}
	if (used) {
		e.preventDefault()
	}
})

$(document).keyup(function(e) {
	holding_shift = false;
	if (e.which === 18 && Toolbox.original && Toolbox.original.alt_tool) {
		Toolbox.original.select()
		delete Toolbox.original;
	}
})
