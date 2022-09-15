class Keybind {
	constructor(keys) {
		this.key 	= -1;
		this.ctrl 	= false;
		this.shift 	= false;
		this.alt 	= false;
		this.meta 	= false;
		this.label = '';
		this.conflict = false;
		if (keys) {
			if (isApp && Blockbench.platform == 'darwin' && keys.ctrl && !keys.meta) {
				keys.meta = true;
				keys.ctrl = undefined;
			}
			if (typeof keys.key == 'string') {
				keys.key = keys.key.toUpperCase().charCodeAt(0)
			}
			this.set(keys)
		}
	}
	set(keys, dflt) {
		if (!keys || typeof keys !== 'object') return this;
		this.key = keys.key
		if (this.ctrl 	!== null) this.ctrl = (keys.ctrl === null) ? null : (keys.ctrl 	== true);
		if (this.shift 	!== null) this.shift= (keys.shift=== null) ? null : (keys.shift == true);
		if (this.alt 	!== null) this.alt 	= (keys.alt  === null) ? null : (keys.alt 	== true);
		if (this.meta 	!== null) this.meta = (keys.meta === null) ? null : (keys.meta 	== true);
		if (dflt) {
			if (dflt.ctrl 	== null) this.ctrl = null;
			if (dflt.shift 	== null) this.shift = null;
			if (dflt.alt 	== null) this.alt = null;
			if (dflt.meta 	== null) this.meta = null;
		}
		this.label = this.getText()
		TickUpdates.keybind_conflicts = true;
		return this;
	}
	clear() {
		this.set({
			key: -1,
			ctrl: false,
			shift: false,
			alt: false,
			meta: false
		}).save();
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
				Keybinds.save();
				TickUpdates.keybind_conflicts = true;
			}

			if (BarItems[this.action] instanceof Action) {
				BarItems[this.action].updateKeybindingLabel()
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
				open: false,
				conflict: false,
			}
		}
		Keybinds.structure[action.category].actions.push(action)
		return this;
	}
	getText(colorized = false) {
		if (this.key < 0) return '';
		var modifiers = []

		if (this.ctrl) 	modifiers.push(tl('keys.ctrl'))	
		if (this.ctrl === null) 	modifiers.push(`[${tl('keys.ctrl')}]`)
		if (this.shift) modifiers.push(tl('keys.shift'))	
		if (this.shift === null) modifiers.push(`[${tl('keys.shift')}]`)
		if (this.alt) 	modifiers.push(tl('keys.alt'))	
		if (this.alt === null) 	modifiers.push(`[${tl('keys.alt')}]`)
		if (this.meta) 	modifiers.push(tl('keys.meta'))	
		if (this.meta === null) 	modifiers.push(`[${tl('keys.meta')}]`)

		var char = this.getCode()
		var char_tl = tl('keys.'+char)
		if (char_tl === ('keys.'+char)) {
			modifiers.push(capitalizeFirstLetter(char))
		} else {
			modifiers.push(char_tl)
		}
		if (colorized) {
			modifiers.forEach((text, i) => {
				let type = i !== modifiers.length-1
						 ? text.match(/\[\w+\]/) ? 'optional' : 'modifier'
						 : 'key'
				modifiers[i] = `<span class="${type}">${text}</span>`;
			})
			return modifiers.join(`<span class="punctuation"> + </span>`);

		} else {
			return modifiers.join(' + ');
		}
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
			case   1: return 'leftclick';
			case   2: return 'middleclick';
			case   3: return 'rightclick';
			case   9: return 'tab';
			case   8: return 'backspace';
			case  13: return 'enter';
			case  27: return 'escape';
			case  46: return 'delete';
			case  46: return 'caps';
			case  16: return 'shift';
			case  17: return 'control';
			case  18: return 'alt';
			case  32: return 'space';
			case  93: return 'menu';
			case  37: return 'left';
			case  38: return 'up';
			case  39: return 'right';
			case  40: return 'down';
			case  33: return 'pageup';
			case  34: return 'pagedown';
			case  35: return 'end';
			case  36: return 'pos1';
			case  44: return 'printscreen';
			case  19: return 'pause';
			case 1001: return 'mousewheel';

			case 187: return '+';
			case 188: return ',';
			case 190: return '.';
			case 189: return '-';
			case 191: return '#';
			default : return String.fromCharCode(key).toLowerCase();
		}
	}
	hasKey() {
		return this.key >= 0;
	}
	setConflict() {
		if (!this.conflict) {
			this.conflict = true;
			var action = BarItems[this.action];
			if (!action) {
				action = Keybinds.extra[this.action];
			}
			if (action && Keybinds.structure[action.category]) {
				Keybinds.structure[action.category].conflict = true;
			}
		}
		return this;
	}
	isTriggered(event) {
		return (
			(this.key 	=== event.which	|| (this.key == 1001 && event instanceof MouseEvent)) &&
			(this.ctrl 	=== (event.ctrlKey 	|| Pressing.overrides.ctrl) || this.ctrl === null 	) &&
			(this.shift === (event.shiftKey || Pressing.overrides.shift)|| this.shift === null	) &&
			(this.alt 	=== (event.altKey 	|| Pressing.overrides.alt) 	|| this.alt === null 	) &&
			(this.meta 	=== event.metaKey								|| this.meta === null 	)
		)
	}
	record() {
		var scope = this;
		Keybinds.recording = this;
		var overlay = $('#overlay_message_box').show()
		var top = limitNumber(window.innerHeight/2 - 200, 30, 800)
		overlay.find('> div').css('margin-top', top+'px')

		function onActivate(event) {
			if (event.originalEvent) event = event.originalEvent;

			document.removeEventListener('keyup', onActivate)
			document.removeEventListener('keydown', onActivateDown)
			overlay.off('mousedown', onActivate)
			overlay.off('mousewheel', onActivate)
			overlay.off('keydown keypress keyup click click dblclick mouseup mousewheel', preventDefault)
			if (event instanceof KeyboardEvent == false && event.target && event.target.tagName === 'BUTTON') return;

			if (event instanceof WheelEvent) {
				scope.key = 1001
			} else {
				scope.key = event.which
			}
			if (scope.ctrl 	!== null) scope.ctrl 	= event.ctrlKey
			if (scope.shift !== null) scope.shift 	= event.shiftKey
			if (scope.alt 	!== null) scope.alt 	= event.altKey
			if (scope.meta 	!== null) scope.meta 	= event.metaKey
			scope.label = scope.getText()
			scope.save(true)
			Blockbench.showQuickMessage(scope.label)

			scope.stopRecording()
		}
		function onActivateDown(event) {
			if (event.metaKey && event.which != 91) {
				onActivate(event)
			}
		}
		function preventDefault(event) {
			event.preventDefault();
		}

		document.addEventListener('keyup', onActivate)
		document.addEventListener('keydown', onActivateDown)
		overlay.on('mousedown', onActivate)
		overlay.on('mousewheel', onActivate)

		overlay.on('keydown keypress keyup click click dblclick mouseup mousewheel', preventDefault)
		return this;
	}
	stopRecording() {
		Keybinds.recording = false
		$('#overlay_message_box').hide().off('mousedown mousewheel')
		$('#keybind_input_box').off('keyup keydown')
		return this;
	}
	toString() {
		return this.label
	}
}
Keybinds.loadKeymap = function(id, from_start_screen = false) {
	let controls_only = from_start_screen && (id == 'default' || id == 'mouse');
	let answer = controls_only || confirm(tl('message.load_keymap'));
	if (!answer) return;
	let preset = KeymapPresets[id];


	if (!controls_only)
		Keybinds.actions.forEach(item => {
			if (!item.keybind) return;

			if (preset && preset.keys[item.id] !== undefined) {
				let keys = preset.keys[item.id]

				if (keys === null) {
					item.keybind.clear();
				} else if (keys) {
					if (isApp && Blockbench.platform == 'darwin' && keys.ctrl && !keys.meta) {
						keys.meta = true;
						keys.ctrl = undefined;
					}
					if (typeof keys.key == 'string') {
						keys.key = keys.key.toUpperCase().charCodeAt(0);
					}
					item.keybind.set(keys).save(false);
				}
			} else {
				if (item.default_keybind) {
					item.keybind.set(item.default_keybind);
				} else {
					item.keybind.clear();
				}
			}

			item.keybind.save(false);
		})

	if (id == 'mouse') {
		Keybinds.extra.preview_rotate.keybind.set({key: 2}).save(false);
		Keybinds.extra.preview_drag.keybind.set({key: 2, shift: true}).save(false);
		Keybinds.extra.preview_zoom.keybind.set({key: 2, ctrl: true}).save(false);
		Keybinds.extra.preview_area_select.keybind.set({key: 1}).save(false);
	}

	Keybinds.save();
	TickUpdates.keybind_conflicts = true;
	Blockbench.showQuickMessage('message.keymap_loaded', 1600);
	return true;
}
Keybinds.no_overlap = function(k1, k2) {
	return Condition.mutuallyExclusive(k1.condition, k2.condition);
}
function updateKeybindConflicts() {
	for (var key in Keybinds.structure) {
		Keybinds.structure[key].conflict = false;
	}
	Keybinds.actions.forEach((action, i) => {
		action.keybind.conflict = false;
	})
	Keybinds.actions.forEach((action, i) => {
		var keybind = action.keybind;
		if (keybind.hasKey()) {
			while (i < Keybinds.actions.length-1) {
				i++;
				var keybind2 = Keybinds.actions[i].keybind;
				if (keybind2.hasKey()
				 && keybind.key   === keybind2.key
				 && keybind.ctrl  === keybind2.ctrl
				 && keybind.shift === keybind2.shift
				 && keybind.alt   === keybind2.alt
				 && keybind.meta  === keybind2.meta
				 && !Keybinds.no_overlap(action, Keybinds.actions[i])
				) {
					keybind.setConflict();
					keybind2.setConflict();
				}
			}
		}
	})
	if (Keybinds.dialog && Keybinds.dialog.sidebar.node) {
		let node = Keybinds.dialog.sidebar.node;
		for (var key in Keybinds.structure) {
			if (Keybinds.dialog.sidebar.pages[key]) {
				let page = node.querySelector(`.dialog_sidebar_pages li[page="${key}"]`)
				page.classList.toggle('error', Keybinds.structure[key].conflict);
			}
		}
	}
}


BARS.defineActions(() => {
	
	new Action('keybindings_window', {
		name: tl('dialog.settings.keybinds') + '...',
		icon: 'keyboard',
		category: 'blockbench',
		click: function () {
			Keybinds.dialog.show();
			document.querySelector('dialog#keybindings .search_bar > input').focus();
		}
	})
	new Action('load_keymap', {
		icon: 'format_list_bulleted',
		category: 'blockbench',
		work_in_dialog: true,
		click(e) {
			new Menu(this.children).open(e.target);
		},
		children: [
			'import_keymap',
			'_',
			{icon: 'keyboard', id: 'default', description: 'action.load_keymap.default.desc', name: 'action.load_keymap.default', click() {Keybinds.loadKeymap('default')}},
			{icon: 'keyboard', id: 'mouse', description: 'action.load_keymap.mouse.desc', name: 'action.load_keymap.mouse', click() {Keybinds.loadKeymap('mouse')}},
			{icon: 'keyboard', id: 'blender', description: 'action.load_keymap.blender.desc', name: 'Blender', click() {Keybinds.loadKeymap('blender')}},
			{icon: 'keyboard', id: 'cinema4d', description: 'action.load_keymap.cinema4d.desc', name: 'Cinema 4D', click() {Keybinds.loadKeymap('cinema4d')}},
			{icon: 'keyboard', id: 'maya', description: 'action.load_keymap.maya.desc', name: 'Maya', click() {Keybinds.loadKeymap('maya')}}
		]
	})
	new Action('import_keymap', {
		icon: 'folder',
		category: 'blockbench',
		work_in_dialog: true,
		click() {
			Blockbench.import({
				resource_id: 'config',
				extensions: ['bbkeymap'],
				type: 'Blockbench Keymap'
			}, function(files) {
				let {keys} = JSON.parse(files[0].content);

				Keybinds.actions.forEach(keybind_item => {
					if (keys[keybind_item.id] === null) {
						keybind_item.keybind.clear();
					} else {
						keybind_item.keybind.set(keys[keybind_item.id]).save(false);
					}
				})
				Keybinds.save();
				TickUpdates.keybind_conflicts = true;
			})
		}
	})
	new Action('export_keymap', {
		icon: 'keyboard_hide',
		category: 'blockbench',
		work_in_dialog: true,
		click() {
			var keys = {}

			Keybinds.actions.forEach(item => {
				if (!Keybinds.stored[item.id]) return
				if (Keybinds.stored[item.id].key == -1) {
					keys[item.id] = null;
				} else {
					keys[item.id] = new oneLiner(Keybinds.stored[item.id])
				}
			})
			Blockbench.export({
				resource_id: 'config',
				type: 'Blockbench Keymap',
				extensions: ['bbkeymap'],
				content: compileJSON({keys})
			})
		}
	})
	BarItems.load_keymap.toElement('#keybinds_title_bar')
	BarItems.export_keymap.toElement('#keybinds_title_bar')
})

onVueSetup(function() {

	let sidebar_pages = {};
	for (let key in Keybinds.structure) {
		sidebar_pages[key] = Keybinds.structure[key].name;
	}

	Keybinds.dialog = new Dialog({
		id: 'keybindings',
		title: 'dialog.settings.keybinds',
		singleButton: true,
		width: 920,
		title_menu: new Menu([
			'settings_window',
			'keybindings_window',
			'theme_window',
			'about_window',
		]),
		sidebar: {
			pages: sidebar_pages,
			page: 'navigate',
			actions: [
				'load_keymap',
				'export_keymap',
			],
			onPageSwitch(page) {
				Keybinds.dialog.content_vue.open_category = page;
				Keybinds.dialog.content_vue.search_term = '';
			}
		},
		component: {
			data() {return {
				structure: Keybinds.structure,
				open_category: 'navigate',
				search_term: '',
			}},
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
			},
			computed: {
				list() {
					if (this.search_term) {
						var keywords = this.search_term.toLowerCase().replace(/_/g, ' ').split(' ');
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
						return actions;
					} else {
						return this.structure[this.open_category].actions;
					}
				},
				title() {
					if (this.search_term) {
						return tl('dialog.settings.search_results');
					} else {
						return this.structure[this.open_category].name;
					}
				}
			},
			template: `
				<div>
					<h2 class="i_b">{{ title }}</h2>

					<search-bar id="settings_search_bar" v-model="search_term"></search-bar>

					<ul id="keybindlist">
						<li v-for="action in list">
							<div v-bind:title="action.description">{{action.name}}</div>
							<div class="keybindslot" :class="{conflict: action.keybind && action.keybind.conflict}" @click.stop="record(action)" v-html="action.keybind ? action.keybind.getText(true) : ''"></div>
							<div class="tool" v-on:click="reset(action)" title="${tl('keybindings.reset')}">
								<i class="material-icons">replay</i>
							</div>
							<div class="tool" v-on:click="clear(action)" title="${tl('keybindings.clear')}">
								<i class="material-icons">clear</i>
							</div>
						</li>
					</ul>
				</div>`
		},
		onButton() {
			Settings.save();
		},
		onOpen() {
			updateKeybindConflicts();
		}
	})
})

window.addEventListener('blur', event => {
	if (Pressing.alt) {
		if (Toolbox.original && Toolbox.original.alt_tool) {
			Toolbox.original.select()
			delete Toolbox.original;
		}
	}
	Pressing.shift = false;
	Pressing.alt = false;
	Pressing.ctrl = false;
})

window.addEventListener('focus', event => {
	function click_func(event) {
		if (event.altKey && Toolbox.selected.alt_tool && !Toolbox.original && !open_interface) {
			var orig = Toolbox.selected;
			var alt = BarItems[Toolbox.selected.alt_tool];
			if (alt && Condition(alt) && (Modes.paint || BarItems.swap_tools.keybind.key == 18)) {
				alt.select()
				Toolbox.original = orig;
			}
		}
		remove_func();
	}
	let removed = false
	function remove_func() {
		if (removed) return;
		removed = true;
		removeEventListeners(window, 'keydown mousedown', click_func, true);
	}
	addEventListeners(window, 'keydown mousedown', click_func, true);
	setTimeout(remove_func, 100);
})

function getFocusedTextInput() {
	let element = document.activeElement;
	if (element.nodeName == 'TEXTAREA' || (element.nodeName == 'INPUT' && ['number', 'text'].includes(element.type)) || element.isContentEditable) {
		return element;
	}
}

addEventListeners(document, 'keydown mousedown', function(e) {
	if (Keybinds.recording || e.which < 4) return;
	//Shift
	Pressing.shift = e.shiftKey;
	Pressing.alt = e.altKey;
	Pressing.ctrl = e.ctrlKey;
	if (e.which === 16) {
		showShiftTooltip()
	}

	var used = false;
	var input_focus = getFocusedTextInput()

	// Fix #1427
	if (e.code == 'PageUp' || e.code == 'PageDown') {
		e.preventDefault();
	}

	if (input_focus) {
		//User Editing Anything

		//Tab
		if (e.which == 9 && !open_dialog) {
			let all_visible_inputs = [];
			var all_inputs = document.querySelectorAll('.tab_target:not(.prism-editor-wrapper), .prism-editor-wrapper.tab_target > pre[contenteditable="true"]')
			all_inputs.forEach(input => {
				if (input.isConnected && input.offsetParent && $(input).is(':visible')) {
					all_visible_inputs.push(input);
				}
			})
			var index = all_visible_inputs.indexOf(input_focus)+1;
			if (index >= all_visible_inputs.length) index = 0;
			var next = $(all_visible_inputs[index])

			if (next.length) {
				if (next.hasClass('cube_name')) {
					let uuid = next.parent().parent().attr('id');
					var target = OutlinerNode.uuids[uuid];
					if (target) {
						stopRenameOutliner();
						setTimeout(() => {
							target.select(e, true).rename();
						}, 50)
					}

				} else if (next.hasClass('nslide')) {
					setTimeout(() => {
						BarItems[next.attr('n-action')].startInput(e);
					}, 50)
				} else {
					event.preventDefault();
					next.trigger('focus').trigger('click');
					document.execCommand('selectAll')
				}
				return;
			}
		}
		if (Blockbench.hasFlag('renaming')) {
			if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
				stopRenameOutliner()
			} else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
				stopRenameOutliner(false)
			}
			return;
		}
		if ($('input#chat_input:focus').length && Project.EditSession) {
			if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
				Interface.Panels.chat.inside_vue.sendMessage();
				return;
			}
		}
		if ($('pre.prism-editor__code:focus').length) return;
		if (Keybinds.extra.confirm.keybind.isTriggered(e) || Keybinds.extra.cancel.keybind.isTriggered(e)) {
			$(document).trigger('click')
		}
	}
	let captured = false;
	let results = Blockbench.dispatchEvent('press_key', {
		input_in_focus: input_focus,
		event: e,
		capture() {
			captured = true;
		}
	})
	if (results instanceof Array && results.includes(true)) used = true;
	if (captured) {
		e.preventDefault();
		return;
	}

	//Hardcoded Keys
	if (e.which === 18 && Toolbox.selected.alt_tool && !Toolbox.original && !open_interface) {
		//Alt Tool
		var orig = Toolbox.selected;
		var alt = BarItems[Toolbox.selected.alt_tool]
		if (alt && Condition(alt) && (Modes.paint || BarItems.swap_tools.keybind.key == 18)) {
			e.preventDefault();
			alt.select()
			Toolbox.original = orig
		}
	} else if (Keybinds.extra.cancel.keybind.isTriggered(e) && (Transformer.dragging)) {
		Transformer.cancelMovement(e, false);
		updateSelection();
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
				open_interface.confirm(e);
				used = true
			} else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
				open_interface.cancel(e);
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
document.addEventListener('wheel', (e) => {
	if (getFocusedTextInput()) return;
	let used = false;
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
	if (used) {
		e.stopPropagation()
	}

}, true)

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
