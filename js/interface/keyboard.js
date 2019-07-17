class Keybind {
	constructor(keys, exact) {
		this.key 	= -1;
		this.ctrl 	= false;
		this.shift 	= false;
		this.alt 	= false;
		this.meta 	= false;
		this.label = '';
		if (keys) {
			if (!exact && Blockbench.platform && keys.ctrl && !keys.meta) {
				keys.meta = true;
				keys.ctrl = undefined;
			}
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

		var char = this.getCode()
		var char_tl = tl('keys.'+char)
		if (char_tl === ('keys.'+char)) {
			modifiers.push(capitalizeFirstLetter(char))
		} else {
			modifiers.push(char_tl)
		}
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
		} else if (key >= 4 && key <= 7) {
			return tl('keys.mouse', [key])
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
		Keybinds.recording = this;
		var overlay = $('#overlay_message_box').show()
		var input = overlay.find('#keybind_input_box')
		var top = limitNumber($(window).height()/2 - 200, 30, 800)
		overlay.find('> div').css('margin-top', top+'px')

		function onActivate(event) {

			if (event.target && event.target.tagName === 'BUTTON') return;

			scope.key 	= event.which
			if (scope.ctrl 	!== null) scope.ctrl 	= event.ctrlKey
			if (scope.shift !== null) scope.shift 	= event.shiftKey
			if (scope.alt 	!== null) scope.alt 	= event.altKey
			if (scope.meta 	!== null) scope.meta 	= event.metaKey
			scope.label = scope.getText()
			scope.save(true)
			Blockbench.showQuickMessage(scope.label)

			scope.stopRecording()
		}

		input.focus().on('keyup', onActivate)
			.on('keydown', event => {
				if (event.metaKey && event.which != 91) {
					onActivate(event)
				}
			})
		overlay.on('mousedown', onActivate)

		overlay.on('keydown keypress keyup click click dblclick mouseup', function(event) {
			event.preventDefault()
		})
		return this;
	}
	
	stopRecording() {
		var scope = this;
		Keybinds.recording = false
		$('#overlay_message_box').hide().off('mousedown')
		$('#keybind_input_box').off('keyup keydown')
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
			record(item) {
				if (!item.keybind) {
					item.keybind = new Keybind()
				}
				item.keybind.record()
			},
			reset(item) {
				if (item.keybind) {
					if (item.default_keybind) {
						item.keybind.set(item.default_keybind);
					} else {
						item.keybind.clear();
					}
					item.keybind.save(true);
				}
			},
			clear(item) {
				if (item.keybind) {
					item.keybind.clear().save(true)
				}
			},
			toggleCategory(category) {
				if (!category.open) {
					for (var ct in Keybinds.structure) {
						Keybinds.structure[ct].open = false
					}
					
				}
				category.open = !category.open
			}
		}
	})

	Keybinds.updateSearch = function() {
		var term = Keybinds.vue._data.search_term = $('input#keybind_search_bar').val().toLowerCase();
		var structure = Keybinds.structure;
		if (term) {
			var keywords = term.replace(/_/g, ' ').split(' ');


			var actions = [];
			for (var action of Keybinds.actions) {

				if (true) {;
					var missmatch = false;
					for (var word of keywords) {
						if (
							!action.name.toLowerCase().includes(word) &&
							!action.id.toLowerCase().includes(word) &&
							!action.keybind.label.toLowerCase().includes(word)
						) {
							missmatch = true;
						}
					}
					if (!missmatch) {
						actions.push(action)
					}
				}
			}
			structure.search_results.actions = actions
			structure.search_results.hidden = false;
			for (var key in structure) {
				structure[key].open = false
			}
			structure.search_results.open = true;
		} else {
			structure.search_results.hidden = true;
		}
	}
})

$(document).on('keydown mousedown', function(e) {
	if (Keybinds.recording || e.which < 4) return;
	//Shift
	Pressing.shift = e.shiftKey;
	Pressing.alt = e.altKey;
	Pressing.ctrl = e.ctrlKey;
	if (e.which === 16) {
		showShiftTooltip()
	}

	var used = false;
	var input_focus = $('input[type="text"]:focus, input[type="number"]:focus, div[contenteditable="true"]:focus, textarea:focus').length > 0

	if (input_focus) {
		//User Editing Anything
	    if (Blockbench.hasFlag('renaming')) {
	        if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
	            stopRenameOutliner()
	        } else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
	            stopRenameOutliner(false)
	        }
	        return;
	    }
	    if ($('input#chat_input:focus').length && EditSession.active) {
	    	if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
		    	Chat.send();
		    	return;
		    }
	    }
		if (Keybinds.extra.confirm.keybind.isTriggered(e) || Keybinds.extra.cancel.keybind.isTriggered(e)) {
			$(document).click()
		}
	}
	//Hardcoded Keys
	if (e.ctrlKey === true && e.shiftKey === true && e.which == 73 && isApp) {
		electron.getCurrentWindow().toggleDevTools()
		used = true
	} else if (e.which === 18 && Toolbox.selected.alt_tool && !Toolbox.original && !open_interface) {
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
		if ($('textarea:focus').length === 0) {
			if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
				$('.dialog#'+open_dialog).find('.confirm_btn:not([disabled])').click()
				used = true
			} else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
				$('.dialog#'+open_dialog).find('.cancel_btn:not([disabled])').click()
				used = true
			}
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
	if (Pressing.alt && ActionControl.open) {
		ActionControl.vue.$forceUpdate()
	}
	if (e.which === 18 && Toolbox.original && Toolbox.original.alt_tool) {
		Toolbox.original.select()
		delete Toolbox.original;
	}
	Pressing.shift = false;
	Pressing.alt = false;
	Pressing.ctrl = false;
})
