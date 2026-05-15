import blender from '../../keymaps/blender.bbkeymap';
import cinema4d from '../../keymaps/cinema4d.bbkeymap';
import maya from '../../keymaps/maya.bbkeymap';
import { dragHelper } from '../util/drag_helper';
import { preventContextMenu } from './menu';
import { PointerTarget } from './pointer_target';
import { BARS } from './toolbars';

const KeymapPresets = {
	blender,
	cinema4d,
	maya,
}
export const isMac = window.SystemInfo?.platform == 'darwin' || navigator.userAgent.includes('Mac OS');

export const Keybinds = {
	actions: [],
	stored: {},
	extra: {},
	structure: {},
	save() {
		localStorage.setItem('keybindings', JSON.stringify(Keybinds.stored))
	}
}
if (localStorage.getItem('keybindings')) {
	try {
		Keybinds.stored = JSON.parse(localStorage.getItem('keybindings'));
	} catch (err) {
		console.error(err);
	}
}

export class Keybind {
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
			if (isMac) {
				if (keys.ctrl && !keys.meta) {
					keys.meta = true;
					keys.ctrl = undefined;
				}
				if (keys.key == 46) {
					keys.key = 8;
				}
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
		var action = BarItems[id];
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
		if (this.alt) 	modifiers.push(tl(isMac ? 'keys.option' : 'keys.alt'))	
		if (this.alt === null) 	modifiers.push(`[${tl(isMac ? 'keys.option' : 'keys.alt')}]`)
		if (this.meta) 	modifiers.push(tl('keys.meta'))	
		if (this.meta === null) 	modifiers.push(`[${tl('keys.meta')}]`)

		var char = this.getCode()
		var char_tl = tl('keys.'+char, [], capitalizeFirstLetter(char));
		modifiers.push(char_tl);

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
			case  20: return 'caps';
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
			case  91: return 'meta';
			case 1001: return 'mousewheel';
			case 1010: return 'slide_lmb_horizontal';
			case 1011: return 'slide_lmb_vertical';
			case 1012: return 'slide_rmb_horizontal';
			case 1013: return 'slide_rmb_vertical';

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
	isTriggered(event, input_type) {
		let modifiers_used = new Set();
		if (this.variations) {
			for (let option in this.variations) {
				modifiers_used.add(this.variations[option].replace('unless_', ''));
			}
		}
		if ( !(this.ctrl 	=== (event.ctrlKey 	|| Pressing.overrides.ctrl) || this.ctrl === null	|| modifiers_used.has('ctrl') 	) ) return false;
		if ( !(this.shift	=== (event.shiftKey || Pressing.overrides.shift)|| this.shift === null	|| modifiers_used.has('shift')	) ) return false;
		if ( !(this.alt		=== (event.altKey 	|| Pressing.overrides.alt) 	|| this.alt === null	|| modifiers_used.has('alt') 	) ) return false;
		if ( !(this.meta	===  event.metaKey								|| this.meta === null	|| modifiers_used.has('ctrl') 	) ) return false;

		if (this.key == event.which) return true;
		if (this.key == 1001 && event instanceof MouseEvent) return true;
		if (this.key >= 1010 && this.key < 1018 && input_type == 'pointer_slide') {
			if ((this.key == 1010 || this.key == 1011) && event.which == 1) return true;
			if ((this.key == 1012 || this.key == 1013) && event.which == 3) return true;
		}
		return false;
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
		let scope = this;
		Keybinds.recording = this;

		let button_cancel = Interface.createElement('button', { '@click'() {
			scope.stopRecording();
		}}, tl('dialog.cancel'));
		let button_empty = Interface.createElement('button', {'@click'() {
			scope.clear().stopRecording();
		}}, tl('keybindings.clear'));

		let key_list = Interface.createElement('div', {id: 'keybind_record_key_list', class: 'keybindslot'});
		key_list.innerHTML = this.getText(true);

		let ui = Interface.createElement('div', {id: 'overlay_message_box'}, [
			Interface.createElement('div', {}, [
				Interface.createElement('h3', {}, [
					Blockbench.getIconNode('keyboard'), tl('keybindings.recording')
				]),
				Interface.createElement('p', {}, tl('keybindings.press')),
				key_list,
				button_cancel, ' ', button_empty,
			])
		]);

		if (BarItems[this.action] instanceof NumSlider) {
			let slide_options = {
				'slide_lmb_horizontal': 1010,
				'slide_lmb_vertical': 1011,
				'slide_rmb_horizontal': 1012,
				'slide_rmb_vertical': 1013,
			};
			function setGesture(event, key) {
				clearListeners();

				scope.key = slide_options[key];
				scope.ctrl 	= event.ctrlKey;
				scope.shift = event.shiftKey;
				scope.alt 	= event.altKey;
				scope.meta 	= event.metaKey;

				scope.label = scope.getText();
				scope.save(true);
				Blockbench.showQuickMessage(scope.label);

				scope.stopRecording();
			}
			let list = Interface.createElement('div', {
				class: 'mouse_gesture_keybind_menu'
			}, [
				Interface.createElement('h3', {}, 'Mouse Gesture'),
				Interface.createElement('div', {}, [
					Interface.createElement('label', {}, 'Left click'),
					Interface.createElement('div',
						{
							title: tl('keys.slide_lmb_horizontal'),
							class: 'mouse_gesture_option',
							'@click': (event) => setGesture(event, 'slide_lmb_horizontal')
						},
						Blockbench.getIconNode('arrow_range')
					),
					Interface.createElement('div',
						{
							title: tl('keys.slide_lmb_vertical'),
							class: 'mouse_gesture_option',
							'@click': (event) => setGesture(event, 'slide_lmb_vertical')
						},
						Blockbench.getIconNode('height')
					),
				]),
				Interface.createElement('div', {}, [
					Interface.createElement('label', {}, 'Right click'),
					Interface.createElement('div',
						{
							title: tl('keys.slide_rmb_horizontal'),
							class: 'mouse_gesture_option',
							'@click': (event) => setGesture(event, 'slide_rmb_horizontal')
						},
						Blockbench.getIconNode('arrow_range')
					),
					Interface.createElement('div',
						{
							title: tl('keys.slide_rmb_vertical'),
							class: 'mouse_gesture_option',
							'@click': (event) => setGesture(event, 'slide_rmb_vertical')
						},
						Blockbench.getIconNode('height')
					),
				]),
			]);
			button_cancel.parentElement.append(list);

		}

		document.getElementById('dialog_wrapper').append(ui);
		var overlay = $(ui);
		var top = limitNumber(window.innerHeight/2 - 200, 30, 800)
		overlay.find('> div').css('margin-top', top+'px');

		function clearListeners() {
			
			document.removeEventListener('keyup', onActivate)
			document.removeEventListener('keydown', onActivateDown)
			overlay.off('mousedown', onActivate)
			overlay.off('wheel', onActivate)
			overlay.off('keydown keypress keyup click click dblclick mouseup mousewheel', preventDefault)
			removeEventListeners(document, 'keydown mousedown', onUpdate);
		}

		function onActivate(event) {
			if (event.originalEvent) event = event.originalEvent;

			clearListeners();

			if (event instanceof KeyboardEvent == false && event.target) {
				if (event.target.tagName === 'BUTTON' || event.target.classList.contains('mouse_gesture_option')) return;
			}

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
		function onUpdate(event) {
			let modifiers = [];
			if (event.ctrlKey) 	modifiers.push(tl('keys.ctrl'))	
			if (event.shiftKey)	modifiers.push(tl('keys.shift'))	
			if (event.altKey) 	modifiers.push(tl(isMac ? 'keys.option' : 'keys.alt'))	
			if (event.metaKey) 	modifiers.push(tl('keys.meta'))	

			modifiers.forEach((text, i) => {
				let type = i !== modifiers.length-1
						? text.match(/\[\w+\]/) ? 'optional' : 'modifier'
						: 'key'
				modifiers[i] = `<span class="${type}">${text}</span>`;
			})
			key_list.innerHTML = modifiers.join(`<span class="punctuation"> + </span>`);
		}
		addEventListeners(document, 'keydown mousedown', onUpdate);

		document.addEventListener('keyup', onActivate)
		document.addEventListener('keydown', onActivateDown)
		overlay.on('mousedown', onActivate)
		overlay.on('wheel', onActivate)

		overlay.on('keydown keypress keyup click click dblclick mouseup mousewheel', preventDefault)
		return this;
	}
	stopRecording() {
		Keybinds.recording = false;
		document.getElementById('overlay_message_box')?.remove();
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
			keybind.save(false);
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
const overlap_exempt = [1,2,3,1001];
export function updateKeybindConflicts() {
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
				 && overlap_exempt.includes(keybind.key) == false // avoid conflict between click to select, click to drag camera etc.
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

function isSwapToolsEnabled(event) {
	let keybind = BarItems.swap_tools.sub_keybinds.hold.keybind;
	if (keybind.key == 18 || keybind.alt) {
		return event ? event.altKey : Pressing.alt;
	} else if (keybind.key == 17 || keybind.ctrl) {
		return event ? event.ctrlKey : Pressing.ctrl;
	} else if (keybind.key == 16 || keybind.shift) {
		return event ? event.shiftKey : Pressing.shift;
	}
}
function isSwapToolsHoldKey(key) {
	let keybind = BarItems.swap_tools.sub_keybinds.hold.keybind;
	if (key == keybind.key) return true;
	if (keybind.alt) {
		return key == 18;
	} else if (keybind.ctrl) {
		return key == 17;
	} else if (keybind.shift) {
		return key == 16;
	}
}

window.addEventListener('blur', event => {
	if (isSwapToolsEnabled()) {
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
		if (isSwapToolsEnabled(event) && Toolbox.selected.alt_tool && !Toolbox.original && !open_interface) {
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

export function getFocusedTextInput() {
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
		Blockbench.dispatchEvent('update_pressed_modifier_keys', {before, now: Pressing, event: e});
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
			var index = all_visible_inputs.indexOf(input_focus) + (e.shiftKey ? -1 : 1);
			if (index >= all_visible_inputs.length) index = 0;
			if (index < 0) index = all_visible_inputs.length-1;
			var next = $(all_visible_inputs[index])

			if (next.length) {
				stopRenameOutliner();

				if (next.hasClass('cube_name')) {
					let uuid = next.parent().parent().attr('id');
					var target = OutlinerNode.uuids[uuid];
					if (target) {
						setTimeout(() => {
							target.select({}, true).rename();
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
	if (isSwapToolsHoldKey(e.which) && Toolbox.selected.alt_tool && !Toolbox.original && !open_interface) {
		//Alt Tool
		var orig = Toolbox.selected;
		var alt = BarItems[Toolbox.selected.alt_tool]
		if (alt && Condition(alt) && (Modes.paint || BarItems.swap_tools.keybind.key == 18)) {
			e.preventDefault();
			alt.select()
			Toolbox.original = orig
		}
	} else if (Keybinds.extra.cancel.keybind.isTriggered(e) && PointerTarget.active == PointerTarget.types.gizmo_transform) {
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
		// TODO: Use to transform layer
		switch (e.which) {
			case 37: Painter.selection.x -= 1; break;//<
			case 38: Painter.selection.y -= 1; break;//UP
			case 39: Painter.selection.x += 1; break;//>
			case 40: Painter.selection.y += 1; break;//DOWN
		}
		Painter.selection.x = Math.clamp(Painter.selection.x, 1-Painter.selection.canvas.width,  UVEditor.texture.width -1)
		Painter.selection.y = Math.clamp(Painter.selection.y, 1-Painter.selection.canvas.height, UVEditor.texture.height-1)
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
	if (isSwapToolsHoldKey(e.which) && Toolbox.original && Toolbox.original.alt_tool) {
		Toolbox.original.select()
		delete Toolbox.original;
	}
	let changed = Pressing.shift || Pressing.alt || Pressing.ctrl;
	let before = changed && {shift: Pressing.shift, alt: Pressing.alt, ctrl: Pressing.ctrl};
	Pressing.shift = e.shiftKey;
	Pressing.alt = e.altKey;
	Pressing.ctrl = e.ctrlKey;
	if (changed) {
		Blockbench.dispatchEvent('update_pressed_modifier_keys', {before, now: Pressing, event: e});
	}
})

document.addEventListener('pointerdown', (e1) => {

	let sliders = Keybinds.actions.filter(slider => {
		if (slider instanceof NumSlider == false) return false;
		if (!Condition(slider.condition)) return false;
		return slider.keybind.isTriggered(e1, 'pointer_slide');
	});
	if (sliders.length) {
		let success = PointerTarget.requestTarget(PointerTarget.types.global_drag_slider);
		if (!success) return;
		dragHelper(e1, {
			onStart(context) {
				for (let slider of sliders) {
					if (typeof slider.onBefore === 'function') {
						slider.onBefore();
					}
					slider.sliding = true;
					slider.pre = 0;
					slider.sliding_start_pos = 0;
				}
			},
			onMove(context) {
				for (let slider of sliders) {
					let orientation = slider.keybind.key == 1010 || slider.keybind.key ==  1012;
					let distance = orientation ? context.delta.x : context.delta.y;
					let factor = (orientation ? 2.4 : 2.6) * (slider.settings?.gesture_speed ?? 1);
					slider.slide(distance * factor, e1);
				}
			},
			onEnd(context) {
				Blockbench.setStatusBarText();
				if (context.distance > 1) preventContextMenu();
				for (let slider of sliders) {
					delete slider.sliding;
					if (typeof slider.onAfter === 'function') {
						slider.onAfter(slider.value - slider.last_value)
					}
				}
			}
		})
	}
}, {capture: true})


Object.assign(window, {
	Keybind,
	KeymapPresets,
	updateKeybindConflicts,
	getFocusedTextInput
});
