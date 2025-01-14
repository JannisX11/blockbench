
class Keybind {
	/**
	 * Create a keybind
	 * @param {object} keys Set up the default keys that need to be pressed
	 * @param {number|string} keys.key Main key. Check keycode.info to find out the numeric value, or simply use letters for letter keys
	 * @param {boolean} keys.ctrl Control key. On MacOS this automatically works for Cmd
	 * @param {boolean} keys.shift Shift key
	 * @param {boolean} keys.alt Alt key
	 * @param {boolean} keys.meta Meta key
	 */
	constructor(keys, variations) {
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
		if (variations) {
			this.variations = {};
			for (let option in variations) {
				this.variations[option] = variations[option];
			}
		}
	}
	set(keys, dflt) {
		if (!keys || typeof keys !== 'object') return this;
		this.key = typeof keys.key == 'number' ? keys.key : -1;
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
		if (keys.variations && this.variations) {
			for (let option in keys.variations) {
				this.variations[option] = keys.variations[option];
			}
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
			let obj = {
				key: this.key
			}
			if (this.ctrl)	 obj.ctrl = true
			if (this.shift)	 obj.shift = true
			if (this.alt)	 obj.alt = true
			if (this.meta)	 obj.meta = true

			if (this.variations && Object.keys(this.variations)) {
				obj.variations = {};
				for (let option in this.variations) {
					obj.variations[option] = this.variations[option];
				}
			}

			let key = this.sub_id ? (this.action + '.' + this.sub_id) : this.action;
			Keybinds.stored[key] = obj
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
	setAction(id, sub_id) {
		var action = BarItems[id]
		if (!action) {
			action = Keybinds.extra[id]
		}
		if (!action) {
			return;
		}
		this.action = id;
		this.sub_id = sub_id;

		if (!Keybinds.structure[action.category]) {
			Keybinds.structure[action.category] = {
				actions: [],
				id: action.category,
				name: tl('category.'+action.category),
				open: false,
				conflict: false,
			}
		}
		Keybinds.structure[action.category].actions.safePush(action)
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

			case 106: return tl('keys.numpad', ['*']);
			case 107: return tl('keys.numpad', ['+']);
			case 108: return tl('keys.numpad', ['+']);
			case 109: return tl('keys.numpad', ['-']);
			case 110: return tl('keys.numpad', [',']);
			case 111: return tl('keys.numpad', ['/']);

			case 188: return ',';
			case 190: return '.';
			case 189: return '-';
			case 191: return '/';
			case 219: return '[';
			case 221: return ']';
			case 186: return ';';
			case 222: return "'";
			case 220: return '\\';
			case 187: return '=';
			case 226: return '\\';
			case 192: return '`';
			//case 187: return '+';
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
		let modifiers_used = new Set();
		if (this.variations) {
			for (let option in this.variations) {
				modifiers_used.add(this.variations[option].replace('unless_', ''));
			}
		}
		return (
			(this.key 	=== event.which	|| (this.key == 1001 && event instanceof MouseEvent)) &&
			(this.ctrl 	=== (event.ctrlKey 	|| Pressing.overrides.ctrl) || this.ctrl === null	|| modifiers_used.has('ctrl') 	) &&
			(this.shift === (event.shiftKey || Pressing.overrides.shift)|| this.shift === null	|| modifiers_used.has('shift')	) &&
			(this.alt 	=== (event.altKey 	|| Pressing.overrides.alt) 	|| this.alt === null	|| modifiers_used.has('alt') 	) &&
			(this.meta 	=== event.metaKey								|| this.meta === null	|| modifiers_used.has('ctrl') 	)
		)
	}
	additionalModifierTriggered(event, variation) {
		if (!this.variations) return;
		for (let option in this.variations) {
			if (variation && option != variation) continue;
			let key = this.variations[option];
			if (
				(key == 'always') ||
				(key == 'ctrl' && (event.ctrlOrCmd || Pressing.overrides.ctrl)) ||
				(key == 'shift' && (event.shiftKey || Pressing.overrides.shift)) ||
				(key == 'alt' && (event.altKey || Pressing.overrides.alt)) ||
				(key == 'meta' && (event.metaKey || Pressing.overrides.meta)) ||
				(key == 'unless_ctrl' && !(event.ctrlOrCmd || Pressing.overrides.ctrl)) ||
				(key == 'unless_shift' && !(event.shiftKey || Pressing.overrides.shift)) ||
				(key == 'unless_alt' && !(event.altKey || Pressing.overrides.alt))
			) {
				return variation ? true : option;
			}
		}
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
			overlay.off('wheel', onActivate)
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
		let mac_modifiers = ['Alt', 'Shift', 'Control', 'Meta'];
		function onActivateDown(event) {
			if (event.metaKey && !mac_modifiers.includes(event.key)) {
				onActivate(event)
			}
		}
		function preventDefault(event) {
			event.preventDefault();
		}

		document.addEventListener('keyup', onActivate)
		document.addEventListener('keydown', onActivateDown)
		overlay.on('mousedown', onActivate)
		overlay.on('wheel', onActivate)

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
	let preset = KeymapPresets[id] || {keys: {}};

	if (!controls_only) {
		function applyKeybinding(keys, keybind, default_keybind) {
			if (keys) {
				if (keys === null) {
					keybind.clear();
				} else if (keys) {
					if (isApp && Blockbench.platform == 'darwin' && keys.ctrl && !keys.meta) {
						keys.meta = true;
						keys.ctrl = undefined;
					}
					if (typeof keys.key == 'string') {
						keys.key = keys.key.toUpperCase().charCodeAt(0);
					}
					keybind.set(keys).save(false);
				}
			} else {
				if (default_keybind) {
					keybind.set(default_keybind);
				} else {
					keybind.clear();
				}
			}
		}
		Keybinds.actions.forEach(item => {
			if (!item.keybind) return;

			applyKeybinding(preset.keys[item.id], item.keybind, item.default_keybind);
			if (item.sub_keybinds) {
				for (let key in item.sub_keybinds) {
					applyKeybinding(
						preset.keys[item.id + '.' + key],
						item.sub_keybinds[key].keybind,
						item.sub_keybinds[key].default_keybind
					);
				}
			}

			item.keybind.save(false);
		})
	}

	if (id == 'mouse') {
		Keybinds.extra.preview_rotate.keybind.set({key: 2}).save(false);
		Keybinds.extra.preview_drag.keybind.set({key: 2, shift: true}).save(false);
		Keybinds.extra.preview_zoom.keybind.set({key: 2, ctrl: true}).save(false);
		Keybinds.extra.preview_area_select.keybind.set({key: 1}).save(false);
		Keybinds.extra.paint_secondary_color.keybind.set({key: 3}).save(false);
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
		width: 800,
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
			data() {
				return {
				structure: Keybinds.structure,
				open_category: 'navigate',
				search_term: '',
				modifier_options: {
					'': '-',
					always: tl('modifier_actions.always'),
					ctrl: tl(Blockbench.platform == 'darwin' ? 'keys.meta' : 'keys.ctrl'),
					shift: tl('keys.shift'),
					alt: tl('keys.alt'),
					unless_ctrl: tl('modifier_actions.unless', tl(Blockbench.platform == 'darwin' ? 'keys.meta' : 'keys.ctrl')),
					unless_shift: tl('modifier_actions.unless', tl('keys.shift')),
					unless_alt: tl('modifier_actions.unless', tl('keys.alt')),
				} 
			}},
			methods: {
				record(item, sub_id) {
					if (sub_id) {
						item.sub_keybinds[sub_id].keybind.record();

					} else {
						if (!item.keybind) item.keybind = new Keybind();
						item.keybind.record();
					}
				},
				reset(item, sub_id) {
					if (sub_id) {
						let sub_keybind = item.sub_keybinds[sub_id];
						if (sub_keybind.default_keybind) {
							sub_keybind.keybind.set(sub_keybind.default_keybind);
						} else {
							sub_keybind.keybind.clear();
						}
						sub_keybind.keybind.save(true);

					} else if (item.keybind) {
						if (item.default_keybind) {
							item.keybind.set(item.default_keybind);
						} else {
							item.keybind.clear();
						}
						item.keybind.save(true);
					}
				},
				clear(item, sub_id) {
					if (sub_id) {
						item.sub_keybinds[sub_id].keybind.clear().save(true);

					} else if (item.keybind) {
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
				},
				hasSubKeybinds(item) {
					return item.sub_keybinds && typeof item.sub_keybinds === 'object' && Object.keys(item.sub_keybinds).length > 0;
				},
				hasVariationConflict(keybind, variation_key) {
					return keybind[keybind.variations[variation_key]];
				},
				getVariationText(action, variation) {
					return tl(action.variations?.[variation]?.name, null, variation);
				},
				getVariationDescription(action, variation) {
					return action.variations?.[variation]?.description ? tl(action.variations[variation].description, null, '') : '';
				},
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
										!missmatch &&
										!action.name.toLowerCase().includes(word) &&
										!action.id.toLowerCase().includes(word) &&
										!action.keybind.label.toLowerCase().includes(word) 
									) {
										missmatch = true;
									}
									if (missmatch && action.sub_keybinds) {
										for (let key in action.sub_keybinds) {
											if (action.sub_keybinds[key].name.toLowerCase().includes(word)) {
												missmatch = false;
											}
										}
									}
									if (missmatch) break;
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
							<div class="keybind_line">
								<div :title="action.description"><span>{{action.name}}</span><span class="keybind_guide_line" /></div>
								<div class="keybindslot" :class="{conflict: action.keybind && action.keybind.conflict}" @click.stop="record(action)" v-html="action.keybind ? action.keybind.getText(true) : ''"></div>

								<div class="tool" v-on:click="reset(action)" title="${tl('keybindings.reset')}"><i class="material-icons">replay</i></div>
								<div class="tool" v-on:click="clear(action)" title="${tl('keybindings.clear')}"><i class="material-icons">clear</i></div>
							</div>

							<ul class="keybind_item_variations" v-if="action.keybind.variations">
								<li v-for="(value, option_key) in action.keybind.variations">
									<label :title="getVariationDescription(action, option_key)">{{ getVariationText(action, option_key) }}</label>
									<select-input v-model="action.keybind.variations[option_key]" @input="action.keybind.save(true)" :options="modifier_options" />
									<i v-if="hasVariationConflict(action.keybind, option_key)" class="material-icons icon keybind_variation_conflict" title="${tl('keybindings.variation_conflict')}">warning</i>
								</li>
							</ul>

							<ul class="keybind_item_sub_keybinds" v-if="hasSubKeybinds(action)">
								<li v-for="(sub_keybind, sub_id) in action.sub_keybinds" class="keybind_line keybind_line__sub" :key="sub_id">
									<div><span>{{ sub_keybind.name }}</span><span class="keybind_guide_line" /></div>
									<div class="keybindslot"
										:class="{conflict: sub_keybind.keybind && sub_keybind.keybind.conflict}"
										@click.stop="record(action, sub_id)"
										v-html="sub_keybind.keybind ? sub_keybind.keybind.getText(true) : ''"
									></div>
		
									<div class="tool" v-on:click="reset(action, sub_id)" title="${tl('keybindings.reset')}"><i class="material-icons">replay</i></div>
									<div class="tool" v-on:click="clear(action, sub_id)" title="${tl('keybindings.clear')}"><i class="material-icons">clear</i></div>
								</li>
							</ul>
						</li>
					</ul>
				</div>`
		},
		onButton() {
			Keybinds.save();
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
	let changed = Pressing.shift || Pressing.alt || Pressing.ctrl;
	let before = changed && {shift: Pressing.shift, alt: Pressing.alt, ctrl: Pressing.ctrl};
	Pressing.shift = false;
	Pressing.alt = false;
	Pressing.ctrl = false;
	if (changed) {
		Blockbench.dispatchEvent('update_pressed_modifier_keys', {before, now: Pressing, event});
	}
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

	
	let modifiers_changed = Pressing.shift != e.shiftKey || Pressing.alt != e.altKey || Pressing.ctrl != e.ctrlKey;
	let before = modifiers_changed && {shift: Pressing.shift, alt: Pressing.alt, ctrl: Pressing.ctrl};
	Pressing.shift = e.shiftKey;
	Pressing.alt = e.altKey;
	Pressing.ctrl = e.ctrlKey;
	if (modifiers_changed) {
		Blockbench.dispatchEvent('update_pressed_modifier_keys', {before, now: Pressing, event});
	}

	if (e.which === 16) {
		showShiftTooltip()
	}

	let used = false;
	let used_for_input_action;
	let input_focus = getFocusedTextInput()

	// Fix #1427
	if (e.code == 'PageUp' || e.code == 'PageDown') {
		e.preventDefault();
	}

	if (input_focus) {
		//User Editing Anything

		//Tab
		if (e.which == 9 && !Dialog.open && !document.querySelector('.capture_tab_key:focus-within')) {
			let all_visible_inputs = [];
			var all_inputs = document.querySelectorAll('.tab_target:not(.prism-editor-component), .prism-editor-component.tab_target > .prism-editor-wrapper > pre[contenteditable="true"]')
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
					let n_action = next.attr('n-action');
					let slider = BarItems[n_action] || UVEditor.sliders[n_action.replace('uv_slider_', '')];
					if (slider) {
						setTimeout(() => slider.startInput(e), 50);
					}
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
				return;
			} else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
				stopRenameOutliner(false)
				return;
			}
		}
		if ($('input#chat_input:focus').length && Project.EditSession) {
			if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
				Interface.Panels.chat.inside_vue.sendMessage();
				return;
			}
		}
		if (Keybinds.extra.confirm.keybind.isTriggered(e) || Keybinds.extra.cancel.keybind.isTriggered(e)) {
			$(document).trigger('click')
		}
		used_for_input_action = !e.ctrlKey && !e.metaKey;
		if ('zyxcva'.includes(e.key) || (e.keyCode >= 37 && e.keyCode <= 40)) used_for_input_action = true;

		if ($('pre.prism-editor__code:focus').length && used_for_input_action) return;
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
	} else if (KnifeToolContext.current) {
		if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
			KnifeToolContext.current.cancel();
		} else if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
			KnifeToolContext.current.apply();
		}
	}
	//Keybinds
	if (!input_focus || !used_for_input_action) {
		Keybinds.actions.forEach(function(action) {
			if (!Dialog.open || action.work_in_dialog) {
				// Condition for actions is not checked here because tools can be triggered from different modes under certain circumstances, which switches the mode
				if (action.keybind && typeof action.trigger === 'function' && action.keybind.isTriggered(e)) {
					if (action.trigger(e)) used = true
				}
				if (action.sub_keybinds && Condition(action.condition)) {
					for (let sub_id in action.sub_keybinds) {
						let sub = action.sub_keybinds[sub_id];
						if (sub.keybind.isTriggered(e)) {
							let value_before = action.value;
							sub.trigger(e)
							used = true;
							if (action instanceof BarSelect && value_before != action.value) break;
						}
					}
				}
			}
		})
		if (!used && !Dialog.open) {
			for (let tool of Tool.all) {
				if (tool.keybind && typeof tool.trigger === 'function' && tool.keybind.isTriggered(e)) {
					if (tool.switchModeAndSelect(e)) break;
				}
			}
		}
	}
	// Menu
	if (open_menu) {
		used = open_menu.keyNavigate(e)||used

	// Dialog
	} else if (Dialog.open) {
		let dialog = Dialog.open;
		for (let id in (dialog.keyboard_actions || {})) {
			let action = dialog.keyboard_actions[id];
			if (Condition(action.condition, dialog) && action.keybind.isTriggered(e)) {
				action.run.call(dialog, e);
			}
		}
		if ($('textarea:focus').length === 0) {
			if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
				if (input_focus) {
					input_focus.blur();
				}
				Dialog.open.confirm(e);
				used = true
			} else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
				Dialog.open.cancel(e);
				used = true
			}
		}
	} else if (open_interface && typeof open_interface == 'object' && open_interface.hide) {
		if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
			open_interface.confirm(e)
			used = true
		} else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
			open_interface.hide(e)
			used = true
		}
	} else if (ReferenceImageMode.active) {
		if (Keybinds.extra.confirm.keybind.isTriggered(e) || Keybinds.extra.cancel.keybind.isTriggered(e)) {
			ReferenceImageMode.deactivate();
			used = true;
		}
	} else if (Project && Undo.amend_edit_menu && (Keybinds.extra.confirm.keybind.isTriggered(e) || Keybinds.extra.cancel.keybind.isTriggered(e))) {
		Undo.closeAmendEditMenu();

	} else if (UVEditor.vue.texture_selection_polygon.length && Keybinds.extra.cancel.keybind.isTriggered(e)) {
		UVEditor.vue.texture_selection_polygon.empty();

	} else if (Prop.active_panel == 'uv' && Modes.paint && Texture.selected && Texture.selected.selection.is_custom) {
		if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
			SharedActions.run('unselect_all', e);
			used = true;
		}
	} else if (Toolbox.selected.id == 'copy_paste_tool' && UVEditor.texture && Painter.selection.canvas && e.which >= 37 && e.which <= 40) {
		switch (e.which) {
			case 37: Painter.selection.x -= 1; break;//<
			case 38: Painter.selection.y -= 1; break;//UP
			case 39: Painter.selection.x += 1; break;//>
			case 40: Painter.selection.y += 1; break;//DOWN
		}
		Painter.selection.x = Math.clamp(Painter.selection.x, 1-Painter.selection.canvas.width,  UVEditor.texture.width -1)
		Painter.selection.y = Math.clamp(Painter.selection.y, 1-Painter.selection.canvas.height, UVEditor.texture.height-1)
		UVEditor.updatePastingOverlay();
		e.preventDefault();

	} else if (Modes.paint && TextureLayer.selected && TextureLayer.selected.in_limbo) {
		if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
			TextureLayer.selected.resolveLimbo(false);
			used = true;
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
			(!Dialog.open || action.work_in_dialog) &&
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
	// Firefox-specific fix for suppressing the menu bar
	if(e.which == 18) {
		e.preventDefault();
	}
	if (e.which === 18 && Toolbox.original && Toolbox.original.alt_tool) {
		Toolbox.original.select()
		delete Toolbox.original;
	}
	let changed = Pressing.shift || Pressing.alt || Pressing.ctrl;
	let before = changed && {shift: Pressing.shift, alt: Pressing.alt, ctrl: Pressing.ctrl};
	Pressing.shift = e.shiftKey;
	Pressing.alt = e.altKey;
	Pressing.ctrl = e.ctrlKey;
	if (changed) {
		Blockbench.dispatchEvent('update_pressed_modifier_keys', {before, now: Pressing, event});
	}
})
