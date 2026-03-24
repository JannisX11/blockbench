/**
 * Toolbars and related things
 */
/// <reference types="./blockbench"/>

declare global {
	export interface KeybindKeys {
		/**
		 * Main key, can be a numeric keycode or a lower case character
		 */
		key: number | string
		ctrl?: boolean
		shift?: boolean
		alt?: boolean
		meta?: boolean
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
	type ModifierKey = 'ctrl' | 'shift' | 'alt' | 'meta'
	/**
	 * A customizable keybind
	 */
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
		constructor(keys?: KeybindKeys | null, variations?: Record<string, VariationModifier>)
		key: number
		ctrl?: boolean
		shift?: boolean
		alt?: boolean
		variations?: {
			[key: string]: ModifierKey
		}
		label: string
		set(keys: KeybindKeys, default_keybind?: Keybind): this
		/**
		 * Unassign the assigned key
		 */
		clear(): this
		/**
		 * Save any changes to local storage
		 * @param save Save all keybinding changes to local storage. Set to fales if updating multiple at once
		 */
		save(save?: false): this
		/**
		 * Assign an action to the keybind
		 * @param id ID of the action
		 * @param sub_id sub keybind ID
		 */
		setAction(id: string, sub_id?: string): this | undefined
		/**
		 * Get display text showing the keybind
		 * @param formatted If true, the return string will include HTML formatting
		 */
		getText(formatted?: boolean): string
		/**
		 * Get the name of the bound key
		 */
		getCode(key?: string): string
		/**
		 * Check if a key is assigned
		 */
		hasKey(): boolean
		/**
		 * Test if the keybind would be triggered by the event
		 */
		isTriggered(event: Event): boolean
		/**
		 * Test which variation would be triggered by the event. Returns the ID of the variation if triggered
		 * @param event The event to test
		 */
		additionalModifierTriggered(event: Event): string | undefined
		/**
		 * Test if a variation would be triggered by the event
		 * @param event The event to test
		 * @param variation The variation to test againts
		 */
		additionalModifierTriggered(event: Event, variation: string): boolean
		/**
		 * Open a UI to let the user record a new key combination
		 */
		record(): this
		/**
		 * Stop recording a new key combination
		 */
		stopRecording(): this
		/**
		 * Returns the label of the keybinding
		 */
		toString(): string

		/**
		 * Load an included keymap by ID
		 * @param id
		 * @param from_start_screen
		 */
		static loadKeymap(id: string, from_start_screen?: boolean): void | true
		/**
		 * Check if two KeybindItems are mutually exclusive, so only one can be available at the time. This is only the case if they each have a ConditionResolvable that is structured to support this
		 */
		static no_overlap(k1: KeybindItem, k2: KeybindItem): boolean
	}


	class MenuSeparator {
		constructor(id?: string, label?: string)
		id: string
		menu_node: HTMLLIElement
		label?: string
		menu_node?: HTMLElement
	}

	interface ToolbarOptions {
		id?: string
		name?: string
		/**
		 * If true, the toolbar will display a label abovee
		 */
		label?: boolean
		condition?: ConditionResolvable
		/**
		 * If true, the toolbar will only take as much width as needed
		 */
		narrow?: boolean
		vertical?: boolean
		/**
		 * Default content of the toolbar. Separators are available, where _ = separator, + = spaces, # = line break
		 */
		children: ('_' | '+' | '#' | string | BarItem)[]
	}
	export class Toolbar {
		id: string
		name: string
		label: boolean
		label_node: HTMLElement
		condition: ConditionResolvable
		children: (BarItem | string)[]
		no_wrap: boolean
		narrow: boolean
		vertical: boolean
		default_children: (BarItem | string)[]
		/*private*/ positionLookup: any
		/*private*/ condition_cache: any
		/*private*/ previously_enabled: any
		/*private*/ postload: any
		/*private*/ menu: any
		node: HTMLElement
		constructor(id: string, data: ToolbarOptions)
		constructor(data: ToolbarOptions)
		build(data: any, force: any): this
		contextmenu(event: Event): void
		editMenu(): this
		add(action: any, position?: number): this
		remove(action: BarItem, update: boolean = false): this
		update(): this
		toPlace(place: any): this
		save(): this
		reset(): this
		condition(): boolean
	}
	export namespace BARS {
		const stored: {}
		const editing_bar: undefined | Toolbar
		const action_definers: (() => void)[]
		const condition: any
		function defineActions(definer: any): void
		function setupActions(): void
		function setupToolbars(): void
		function setupVue(): void
		function updateConditions(): void
		function updateToolToolbar(): void
	}
	/**
	 * A dialog-based interface to search and trigger actions and other things
	 */
	namespace ActionControl {
		const open: boolean
		const type: string
		const max_length: number
		function select(input?: string): void
		function show(input?: string): void
		function hide(): void
		function confirm(event: Event): void
		function cancel(): void
		function trigger(action: any, event: Event): void
		function click(action: any, event: Event): void
		function handleKeys(event: Event): boolean
	}
	/**
	 * Stores and handles keybinds
	 */
	namespace Keybinds {
		const actions: BarItem[]
		const stored: Record<string, { key: number; ctrl: boolean; shift: boolean }>
		const extra: Record<string, KeybindItem>
		const structure: any
		function save(): void
		function reset(): void
	}
	class _ToolToolbar extends Toolbar {
		selected: Tool
		original: any
	}
	const Toolbox: _ToolToolbar
}

export {}
