import blender from '../../keymaps/blender.bbkeymap';
import cinema4d from '../../keymaps/cinema4d.bbkeymap';
import maya from '../../keymaps/maya.bbkeymap';
import { PointerTarget } from './pointer_target';


/**
 * Keybindings and keyboard inputs
 * @module
 */

const KeymapPresets = {
	blender,
	cinema4d,
	maya,
}
export const isMac = window.SystemInfo?.platform == 'darwin' || navigator.userAgent.includes('Mac OS');


/**
 * Stores and handles things related to keybinds
 */
export const Keybinds = {
	actions: [] as (KeybindItem | BarItem)[],
	stored: {} as Record<string, KeybindKeys>,
	extra: {} as Record<string, KeybindItem>,
	structure: {} as any,
	recording: false as Keybind | false,
	/**
	 * Reference to the keybindings dialog if it has been initialized
	 */
	dialog: null as null | Dialog,
	/**
	 * Save all keybindings to local storage
	 */
	save() {
		localStorage.setItem('keybindings', JSON.stringify(Keybinds.stored))
	},
	/**
	 * Load an included keymap by ID
	 * @param id
	 * @param from_start_screen
	 */
	loadKeymap(id: string, from_start_screen?: boolean): void | true {
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
				if ('sub_keybinds' in item && item.sub_keybinds) {
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
	},
	/**
	 * Check if two KeybindItems are mutually exclusive, so only one can be available at the time. This is only the case if they each have a ConditionResolvable that is structured to support this
	 */
	noOverlap(k1: KeybindItem, k2: KeybindItem): boolean {
		return Condition.mutuallyExclusive(k1.condition, k2.condition);
	}
}
if (localStorage.getItem('keybindings')) {
	try {
		Keybinds.stored = JSON.parse(localStorage.getItem('keybindings'));
	} catch (err) {
		console.error(err);
	}
}

export interface KeybindKeys {
	/**
	 * Main key, can be a numeric keycode or a lower case character
	 */
	key?: number | string
	ctrl?: boolean
	shift?: boolean
	alt?: boolean
	meta?: boolean
	variations?: Record<string, VariationModifier>
}
type VariationModifier =
	| 'always'
	| 'ctrl'
	| 'shift'
	| 'alt'
	| 'meta'
	| 'unless_ctrl'
	| 'unless_shift'
	| 'unless_alt'


/**
 * A customizable keybind
 */
export class Keybind {
	key: number 	= -1;
	ctrl: boolean 	= false;
	shift: boolean 	= false;
	alt: boolean 	= false;
	meta: boolean 	= false;
	label: string = '';
	conflict: boolean = false;
	variations?: Record<string, VariationModifier>
	action?: string
	sub_id?: string

	/**
	 * Create a keybind
	 * @param {object} keys Set up the default keys that need to be pressed
	 * @param {number|string} keys.key Main key. Check keycode.info to find out the numeric value, or simply use letters for letter keys
	 * @param {boolean} keys.ctrl Control key. On MacOS this automatically works for Cmd
	 * @param {boolean} keys.shift Shift key
	 * @param {boolean} keys.alt Alt key
	 * @param {boolean} keys.meta Meta key
	 */
	constructor(keys?: KeybindKeys | null, variations?: Record<string, VariationModifier>) {
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
	set(keys: KeybindKeys, default_keybind?: Keybind): this {
		if (!keys || typeof keys !== 'object') return this;
		this.key = typeof keys.key == 'number' ? keys.key : -1;
		if (this.ctrl 	!== null) this.ctrl = (keys.ctrl === null) ? null : (keys.ctrl 	== true);
		if (this.shift 	!== null) this.shift= (keys.shift=== null) ? null : (keys.shift == true);
		if (this.alt 	!== null) this.alt 	= (keys.alt  === null) ? null : (keys.alt 	== true);
		if (this.meta 	!== null) this.meta = (keys.meta === null) ? null : (keys.meta 	== true);
		if (default_keybind) {
			if (default_keybind.ctrl 	== null) this.ctrl = null;
			if (default_keybind.shift 	== null) this.shift = null;
			if (default_keybind.alt 	== null) this.alt = null;
			if (default_keybind.meta 	== null) this.meta = null;
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
	/**
	 * Unassign the assigned key
	 */
	clear(): this {
		this.set({
			key: -1,
			ctrl: false,
			shift: false,
			alt: false,
			meta: false
		}).save();
		return this;
	}
	/**
	 * Save any changes to local storage
	 * @param save Save all keybinding changes to local storage. Set to false if updating multiple at once
	 */
	save(save?: boolean): this {
		if (this.action) {
			let obj: KeybindKeys = {
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

			let action = BarItems[this.action];
			if (action instanceof Action) {
				action.updateKeybindingLabel();
			}
		}
		return this;
	}
	/**
	 * Assign an action to the keybind
	 * @param id ID of the action
	 * @param sub_id sub keybind ID
	 */
	setAction(id: string, sub_id?: string): this | undefined {
		let action: KeybindItem = BarItems[id];
		if (!action) {
			action = Keybinds.extra[id];
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
	/**
	 * Get display text showing the keybind
	 * @param formatted If true, the return string will include HTML formatting
	 */
	getText(formatted?: boolean): string {
		if (this.key < 0) return '';
		let modifiers = []

		if (this.ctrl) 	modifiers.push(tl('keys.ctrl'))	
		if (this.ctrl === null) 	modifiers.push(`[${tl('keys.ctrl')}]`)
		if (this.shift) modifiers.push(tl('keys.shift'))	
		if (this.shift === null) modifiers.push(`[${tl('keys.shift')}]`)
		if (this.alt) 	modifiers.push(tl(isMac ? 'keys.option' : 'keys.alt'))	
		if (this.alt === null) 	modifiers.push(`[${tl(isMac ? 'keys.option' : 'keys.alt')}]`)
		if (this.meta) 	modifiers.push(tl('keys.meta'))	
		if (this.meta === null) 	modifiers.push(`[${tl('keys.meta')}]`)

		let char = this.getCode()
		let char_tl = tl('keys.'+char, [], capitalizeFirstLetter(char));
		modifiers.push(char_tl);

		if (formatted) {
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
	/**
	 * Get the name of the bound key
	 */
	getCode(key?: number): string {
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
	/**
	 * Check if a key is assigned
	 */
	hasKey(): boolean {
		return this.key >= 0;
	}
	setConflict() {
		if (!this.conflict) {
			this.conflict = true;
			let action: KeybindItem = BarItems[this.action];
			if (!action) {
				action = Keybinds.extra[this.action];
			}
			if (action && Keybinds.structure[action.category]) {
				Keybinds.structure[action.category].conflict = true;
			}
		}
		return this;
	}
	/**
	 * Test if the keybind would be triggered by the event
	 */
	isTriggered(event: KeyboardEvent | PointerEvent | WheelEvent, input_type?: 'pointer_slide' | string): boolean {
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
		if (this.key == 1001 && event instanceof WheelEvent) return true;
		if (this.key >= 1010 && this.key < 1018 && input_type == 'pointer_slide') {
			if ((this.key == 1010 || this.key == 1011) && event.which == 1) return true;
			if ((this.key == 1012 || this.key == 1013) && event.which == 3) return true;
		}
		return false;
	}
	/**
	 * Test which variation would be triggered by the event. Returns the ID of the variation if triggered
	 * @param event The event to test
	 * @param variation The variation to test againts
	 */
	additionalModifierTriggered(event: KeyboardEvent | PointerEvent, variation?: string): string | boolean | undefined {
		if (!this.variations) return;
		for (let option in this.variations) {
			if (variation && option != variation) continue;
			let key = this.variations[option];
			if (
				(key == 'always') ||
				(key == 'ctrl' && (event.ctrlOrCmd || Pressing.overrides.ctrl)) ||
				(key == 'shift' && (event.shiftKey || Pressing.overrides.shift)) ||
				(key == 'alt' && (event.altKey || Pressing.overrides.alt)) ||
				(key == 'meta' && event.metaKey) ||
				(key == 'unless_ctrl' && !(event.ctrlOrCmd || Pressing.overrides.ctrl)) ||
				(key == 'unless_shift' && !(event.shiftKey || Pressing.overrides.shift)) ||
				(key == 'unless_alt' && !(event.altKey || Pressing.overrides.alt))
			) {
				return variation ? true : option;
			}
		}
	}
	/**
	 * Open a UI to let the user record a new key combination
	 */
	record(): this {
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
		let overlay = $(ui);
		let top = limitNumber(window.innerHeight/2 - 200, 30, 800)
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
	/**
	 * Stop recording a new key combination
	 */
	stopRecording(): this {
		Keybinds.recording = false;
		document.getElementById('overlay_message_box')?.remove();
		return this;
	}
	/**
	 * Returns the label of the keybinding
	 */
	toString(): string {
		return this.label
	}
}


const overlap_exempt = [1,2,3,1001];
export function updateKeybindConflicts() {
	for (let key in Keybinds.structure) {
		Keybinds.structure[key].conflict = false;
	}
	Keybinds.actions.forEach((action, i) => {
		action.keybind.conflict = false;
	})
	Keybinds.actions.forEach((action, i) => {
		let keybind = action.keybind;
		if (keybind.hasKey()) {
			while (i < Keybinds.actions.length-1) {
				i++;
				let keybind2 = Keybinds.actions[i].keybind;
				if (keybind2.hasKey()
				 && keybind.key   === keybind2.key
				 && keybind.ctrl  === keybind2.ctrl
				 && keybind.shift === keybind2.shift
				 && keybind.alt   === keybind2.alt
				 && keybind.meta  === keybind2.meta
				 && overlap_exempt.includes(keybind.key) == false // avoid conflict between click to select, click to drag camera etc.
				 && !Keybinds.noOverlap(action, Keybinds.actions[i])
				) {
					keybind.setConflict();
					keybind2.setConflict();
				}
			}
		}
	})
	if (Keybinds.dialog && Keybinds.dialog.sidebar.node) {
		let node = Keybinds.dialog.sidebar.node;
		for (let key in Keybinds.structure) {
			if (Keybinds.dialog.sidebar.pages[key]) {
				let page = node.querySelector(`.dialog_sidebar_pages li[page="${key}"]`)
				page.classList.toggle('error', Keybinds.structure[key].conflict);
			}
		}
	}
}

function isSwapToolsEnabled(event?: KeyboardEvent | PointerEvent) {
	let keybind = BarItems.swap_tools.sub_keybinds.hold.keybind;
	if (keybind.key == 18 || keybind.alt) {
		return event ? event.altKey : Pressing.alt;
	} else if (keybind.key == 17 || keybind.ctrl) {
		return event ? event.ctrlKey : Pressing.ctrl;
	} else if (keybind.key == 16 || keybind.shift) {
		return event ? event.shiftKey : Pressing.shift;
	}
}
function isSwapToolsHoldKey(key: number) {
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

window.addEventListener('blur', (event: KeyboardEvent) => {
	let release = { bubbles: true, clientX: mouse_pos.x, clientY: mouse_pos.y };
	document.dispatchEvent(new PointerEvent('pointerup', release));
	document.dispatchEvent(new MouseEvent('mouseup', release));

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
			let orig = Toolbox.selected as Tool;
			let alt = BarItems[Toolbox.selected.alt_tool] as Tool;
			if (alt && Condition(alt.condition) && (Modes.paint || BarItems.swap_tools.keybind.key == 18)) {
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

export function getFocusedTextInput(): HTMLElement | undefined {
	let element = document.activeElement;
	if (
		element.nodeName == 'TEXTAREA' ||
		(element.nodeName == 'INPUT' && ['number', 'text'].includes((element as HTMLInputElement).type))
		|| 'isContentEditable' in element && element.isContentEditable
	) {
		return element as HTMLElement;
	}
}

addEventListeners(document, 'keydown mousedown', function(event: KeyboardEvent) {
	if (Keybinds.recording || event.which < 4) return;
	//Shift

	
	let modifiers_changed = Pressing.shift != event.shiftKey || Pressing.alt != event.altKey || Pressing.ctrl != event.ctrlKey;
	let before = modifiers_changed && {shift: Pressing.shift, alt: Pressing.alt, ctrl: Pressing.ctrl};
	Pressing.shift = event.shiftKey;
	Pressing.alt = event.altKey;
	Pressing.ctrl = event.ctrlKey;
	if (modifiers_changed) {
		Blockbench.dispatchEvent('update_pressed_modifier_keys', {before, now: Pressing, event: event});
	}

	let used = false;
	let used_for_input_action = false;
	let input_focus = getFocusedTextInput();

	// Fix #1427
	if (event.code == 'PageUp' || event.code == 'PageDown') {
		event.preventDefault();
	}

	if (input_focus) {
		//User Editing Anything

		//Tab
		if (event.which == 9 && !Dialog.open && !document.querySelector('.capture_tab_key:focus-within')) {
			let all_visible_inputs = [];
			let all_inputs = document.querySelectorAll('.tab_target:not(.prism-editor-component), .prism-editor-component.tab_target > .prism-editor-wrapper > pre[contenteditable="plaintext-only"]');
			all_inputs.forEach((input: HTMLElement) => {
				if (input.isConnected && input.offsetParent && $(input).is(':visible')) {
					all_visible_inputs.push(input);
				}
			})
			let index = all_visible_inputs.indexOf(input_focus) + (event.shiftKey ? -1 : 1);
			if (index >= all_visible_inputs.length) index = 0;
			if (index < 0) index = all_visible_inputs.length-1;
			let next = $(all_visible_inputs[index])

			if (next.length) {
				stopRenameOutliner();

				if (next.hasClass('cube_name')) {
					let uuid = next.parent().parent().attr('id');
					let target = OutlinerNode.uuids[uuid];
					if (target) {
						setTimeout(() => {
							target.select({} as any, true)
							target.rename();
						}, 50)
					}

				} else if (next.hasClass('nslide')) {
					let n_action = next.attr('n-action');
					let slider = BarItems[n_action] || UVEditor.sliders[n_action.replace('uv_slider_', '')];
					if (slider) {
						setTimeout(() => slider.startInput(event), 50);
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
			if (Keybinds.extra.confirm.keybind.isTriggered(event)) {
				stopRenameOutliner()
				return;
			} else if (Keybinds.extra.cancel.keybind.isTriggered(event)) {
				stopRenameOutliner(false)
				return;
			}
		}
		if ($('input#chat_input:focus').length && Project.EditSession) {
			if (Keybinds.extra.confirm.keybind.isTriggered(event)) {
				Interface.Panels.chat.inside_vue.sendMessage();
				return;
			}
		}
		if (Keybinds.extra.confirm.keybind.isTriggered(event) || Keybinds.extra.cancel.keybind.isTriggered(event)) {
			$(document).trigger('click')
		}
		used_for_input_action = !event.ctrlKey && !event.metaKey;
		if ('zyxcva'.includes(event.key) || (event.keyCode >= 37 && event.keyCode <= 40)) used_for_input_action = true;

		if ($('pre.prism-editor__code:focus').length && used_for_input_action) return;
	}
	let captured = false;
	let results = Blockbench.dispatchEvent('press_key', {
		input_in_focus: input_focus,
		event: event,
		capture() {
			captured = true;
		}
	})
	if (results instanceof Array && results.includes(true)) used = true;
	if (captured) {
		event.preventDefault();
		return;
	}

	//Hardcoded Keys
	if (isSwapToolsHoldKey(event.which) && Toolbox.selected.alt_tool && !Toolbox.original && !open_interface) {
		//Alt Tool
		let orig = Toolbox.selected as Tool;
		let alt = BarItems[Toolbox.selected.alt_tool] as Tool;
		if (alt && Condition(alt) && (Modes.paint || BarItems.swap_tools.keybind.key == 18)) {
			event.preventDefault();
			alt.select()
			Toolbox.original = orig
		}
	} else if (Keybinds.extra.cancel.keybind.isTriggered(event) && PointerTarget.active == PointerTarget.types.gizmo_transform) {
		Transformer.cancelMovement(event, false);
		updateSelection();

	} else if (KnifeToolContext.current) {
		if (Keybinds.extra.cancel.keybind.isTriggered(event)) {
			KnifeToolContext.current.cancel();
		} else if (Keybinds.extra.confirm.keybind.isTriggered(event)) {
			KnifeToolContext.current.apply();
		}
	}
	//Keybinds
	if (!input_focus || !used_for_input_action) {
		Keybinds.actions.forEach((action) => {
			if (!Dialog.open || (action instanceof Action && action.work_in_dialog)) {
				// Condition for actions is not checked here because tools can be triggered from different modes under certain circumstances, which switches the mode
				if (action.keybind && 'trigger' in action && typeof action.trigger === 'function' && action.keybind.isTriggered(event)) {
					if (action.trigger(event)) used = true
				}
				if ('sub_keybinds' in action && Condition(action.condition)) {
					for (let sub_id in action.sub_keybinds) {
						let sub = action.sub_keybinds[sub_id];
						if (sub.keybind.isTriggered(event)) {
							let value_before = action instanceof BarSelect && action.value;
							sub.trigger(event)
							used = true;
							if (action instanceof BarSelect && value_before != action.value) break;
						}
					}
				}
			}
		})
		if (!used && !Dialog.open) {
			for (let tool of Tool.all) {
				if (tool.keybind && typeof tool.trigger === 'function' && tool.keybind.isTriggered(event)) {
					if (tool.switchModeAndSelect()) break;
				}
			}
		}
	}
	// Menu
	if (open_menu) {
		used = open_menu.keyNavigate(event)||used

	// Dialog
	} else if (Dialog.open) {
		let dialog = Dialog.open;
		for (let id in (dialog.keyboard_actions || {})) {
			let action = dialog.keyboard_actions[id];
			if (Condition(action.condition, dialog) && action.keybind.isTriggered(event)) {
				action.run.call(dialog, event);
			}
		}
		if ($('textarea:focus').length === 0) {
			if (Keybinds.extra.confirm.keybind.isTriggered(event)) {
				if (input_focus) {
					input_focus.blur();
				}
				Dialog.open.confirm(event);
				used = true
			} else if (Keybinds.extra.cancel.keybind.isTriggered(event)) {
				Dialog.open.cancel(event);
				used = true
			}
		}
	} else if (open_interface && typeof open_interface == 'object' && open_interface.hide) {
		if (Keybinds.extra.confirm.keybind.isTriggered(event)) {
			open_interface.confirm(event)
			used = true
		} else if (Keybinds.extra.cancel.keybind.isTriggered(event)) {
			open_interface.hide(event)
			used = true
		}
	} else if (ReferenceImageMode.active) {
		if (Keybinds.extra.confirm.keybind.isTriggered(event) || Keybinds.extra.cancel.keybind.isTriggered(event)) {
			ReferenceImageMode.deactivate();
			used = true;
		}
	} else if (Project && Undo.amend_edit_menu && !input_focus && (Keybinds.extra.confirm.keybind.isTriggered(event) || Keybinds.extra.cancel.keybind.isTriggered(event))) {
		Undo.closeAmendEditMenu();

	} else if (UVEditor.vue.texture_selection_polygon.length && Keybinds.extra.cancel.keybind.isTriggered(event)) {
		UVEditor.vue.texture_selection_polygon.empty();

	} else if (Prop.active_panel == 'uv' && Modes.paint && Texture.selected && Texture.selected.selection.is_custom) {
		if (Keybinds.extra.cancel.keybind.isTriggered(event)) {
			SharedActions.run('unselect_all', event);
			used = true;
		}
	} else if (UVEditor.texture && UVEditor.vue.isTransformingLayer() && UVEditor.texture.layers?.length && event.which >= 37 && event.which <= 40) {
		let delta = [0, 0];
		let step = (event.shiftKey || Pressing.overrides.shift) ? 16 : (event.ctrlOrCmd || Pressing.overrides.ctrl) ? 4 : 1;
		switch (event.which) {
			case 37: delta[0] -= step; break;//<
			case 38: delta[1] -= step; break;//UP
			case 39: delta[0] += step; break;//>
			case 40: delta[1] += step; break;//DOWN
		}
		let texture = UVEditor.texture;
		let layers = texture.layers.filter(layer => layer instanceof TextureLayer && layer.selected);
		Undo.initEdit({layers});
		for (let layer of layers) {
			layer.offset[0] += delta[0];
			layer.offset[1] += delta[1];
		}
		Undo.finishEdit('Move layer')
		texture.updateLayerChanges();
		UVEditor.vue.$forceUpdate();
									
		event.preventDefault();

	} else if (Modes.paint && TextureLayer.selected && TextureLayer.selected.in_limbo) {
		if (Keybinds.extra.confirm.keybind.isTriggered(event)) {
			TextureLayer.selected.resolveLimbo(false);
			used = true;
		}
	}
	if (ActionControl.open) {
		used = ActionControl.handleKeys(event) || used
	}
	if (used) {
		event.preventDefault()
	}
})
document.addEventListener('wheel', (event) => {
	if (getFocusedTextInput()) return;
	let used = false;
	Keybinds.actions.forEach(function(action) {
		if (
			action.keybind &&
			(!Dialog.open || (action instanceof Action && action.work_in_dialog)) &&
			'trigger' in action &&
			typeof action.trigger === 'function' &&
			action.keybind.isTriggered(event)
		) {
			if (action.trigger(event)) {
				used = true
			}
		}
	})
	if (used) {
		event.stopPropagation()
	}

}, true)

document.addEventListener('keyup', (event: KeyboardEvent) => {
	if (Pressing.alt && ActionControl.open) {
		ActionControl.vue.$forceUpdate()
	}
	// Firefox-specific fix for suppressing the menu bar
	if(event.which == 18) {
		event.preventDefault();
	}
	if (isSwapToolsHoldKey(event.which) && Toolbox.original && Toolbox.original.alt_tool) {
		Toolbox.original.select()
		delete Toolbox.original;
	}
	let changed = Pressing.shift || Pressing.alt || Pressing.ctrl;
	let before = changed && {shift: Pressing.shift, alt: Pressing.alt, ctrl: Pressing.ctrl};
	Pressing.shift = event.shiftKey;
	Pressing.alt = event.altKey;
	Pressing.ctrl = event.ctrlKey;
	if (changed) {
		Blockbench.dispatchEvent('update_pressed_modifier_keys', {before, now: Pressing, event: event});
	}
});

document.addEventListener('pointerdown', (e1: PointerEvent) => {
	let sliders: NumSlider[] = Keybinds.actions.filter(slider => {
		if (slider instanceof NumSlider == false) return false;
		if (!Condition(slider.condition)) return false;
		return slider.keybind.isTriggered(e1, 'pointer_slide');
	}) as NumSlider[];
	if (sliders.length) {
		let success = PointerTarget.requestTarget(PointerTarget.types.global_drag_slider);
		if (!success) return;

		for (let slider of sliders) {
			slider.startGlobalDrag(e1);
		}
	}
}, {capture: true})



const global = {
	Keybind,
	Keybinds,
	KeymapPresets,
	updateKeybindConflicts,
	getFocusedTextInput
};
declare global {
	type Keybind = import('./keyboard').Keybind
	const Keybind: typeof global.Keybind
	const Keybinds: typeof global.Keybinds
	const KeymapPresets: typeof global.KeymapPresets
	const updateKeybindConflicts: typeof global.updateKeybindConflicts
	const getFocusedTextInput: typeof global.getFocusedTextInput
}
Object.assign(window, global);
