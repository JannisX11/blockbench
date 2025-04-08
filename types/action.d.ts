/**
 * Registry of all toolbar items, such as actions, tools, etc.
 */
/// <reference path="./blockbench.d.ts"/>

import tinycolor from 'tinycolor2'

declare global {
	const BarItems: {
		[id: string]: BarItem
	}

	interface KeybindKeys {
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
		constructor(keys: KeybindKeys, variations?: Record<string, VariationModifier>)
		key: number
		ctrl?: boolean
		shift?: boolean
		alt?: boolean
		variations?: {
			[key: string]: { name: string; description?: string }
		}
		set(keys: KeybindKeys): this
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
	interface KeybindItemOptions {
		keybind?: Keybind
		variations?: {
			[key: string]: { name: string; description?: string }
		}
	}
	class KeybindItem extends Deletable {
		constructor(id: string, options: KeybindItemOptions)
		keybind: Keybind
		condition?: ConditionResolvable
		variations?: {
			[key: string]: { name: string; description?: string }
		}
	}

	class MenuSeparator {
		constructor(id?: string, label?: string)
	}
	type ActionEventName =
		| 'delete'
		| 'use'
		| 'used'
		| 'trigger'
		| 'get_node'
		| 'select'
		| 'change'
		| 'changed'
		| 'update'
		| 'open'
	interface BarItemOptions extends KeybindItemOptions {
		name?: string
		description?: string
		icon?: string
		condition?: ConditionResolvable
		category?: string
		keybind?: Keybind
	}
	/**
	 * Anything that can go into a toolbar, including actions, tools, toggles, widgets etc.
	 */
	class BarItem extends KeybindItem {
		constructor(id: string, options: BarItemOptions)
		id: string
		name: string
		description: string
		icon?: string
		category?: string

		node: HTMLElement
		nodes: HTMLElement[]
		conditionMet(): boolean
		/**
		 * Adds a label to the HTML element of the bar item
		 * @param in_bar Set to true to generate an in-bar label, as opposed to a regular on-hover label
		 * @param action Provide the action to generate the label. This defaults to self and is only needed in special cases
		 */
		addLabel(in_bar?: boolean, action?: any): void
		/**
		 * Gets a copy of the elements HTML node that is not yet in use.
		 */
		getNode(): HTMLElement
		/**
		 * Appends the bar item to a HTML element
		 */
		toElement(destination: HTMLElement): this
		pushToolbar(bar: any): void

		/**
		 * Adds an event listener to the item
		 * @param event_name The event type to listen for
		 * @param callback
		 */
		on(event_name: ActionEventName, callback: (data: object) => void): void
		/**
		 * Adds a single-use event listener to the item
		 * @param event_name The event type to listen for
		 * @param callback
		 */
		once(event_name: ActionEventName, callback: (data: object) => void): void
		/**
		 * Removes an event listener from the item
		 * @param event_name
		 * @param callback
		 */
		removeListener(event_name: ActionEventName, callback: (data: object) => void): void
		constructor(id: string, options: BarItemOptions)
		conditionMet(): boolean
		/**
		 * Adds a label to the HTML element of the bar item
		 * @param in_bar Set to true to generate an in-bar label, as opposed to a regular on-hover label
		 * @param action Provide the action to generate the label. This defaults to self and is only needed in special cases
		 */
		addLabel(in_bar?: boolean, action?: any): void
		/**
		 * Gets a copy of the elements HTML node that is not yet in use.
		 */
		getNode(): HTMLElement
		/**
		 * Appends the bar item to a HTML element
		 */
		toElement(destination: HTMLElement): this
		pushToolbar(bar: any): void

		dispatchEvent<T = EventName>(event: T, ...args: any[]): void
	}

	interface ActionOptions extends BarItemOptions {
		/**
		 * Function to run when user uses the action successfully
		 */
		click(event?: Event): void
		/**
		 * Icon color. Can be a CSS color string, or an axis letter to use an axis color.
		 */
		color?: string
		children?: any[]
		/**
		 * Show the full label in toolbars
		 */
		label?: boolean
		/**
		 * Provide a menu that belongs to the action, and gets displayed as a small arrow next to it in toolbars.
		 */
		side_menu?: Menu
		/**
		 * Provide a window with additional configutation related to the action
		 */
		tool_config?: ToolConfig
	}
	/**
	 * Actions can be triggered to run something, they can be added to menus, toolbars, assigned a keybinding, or run via Action Control
	 */
	class Action extends BarItem {
		constructor(id: string, options: ActionOptions)
		icon: string
		nodes: HTMLElement[]
		/**
		 * Provide a menu that belongs to the action, and gets displayed as a small arrow next to it in toolbars.
		 */
		side_menu?: Menu | ToolConfig
		/**
		 * Provide a window with additional configutation related to the action
		 */
		tool_config?: ToolConfig
		click: ActionOptions['click']

		condition?(): boolean
		/**
		 * Trigger to run or select the action. This is the equivalent of clicking or using a keybind to trigger it. Also checks if the condition is met.
		 */
		trigger(event?: Event): boolean
		updateKeybindingLabel(): this
		/**
		 * Change the name of the action
		 */
		setName(name: string): void
		/** Change the icon of the action */
		setIcon(icon: IconString): void
		toggleLinkedSetting(change: any): void
	}
	interface ToggleOptions extends Omit<ActionOptions, 'click'> {
		/**
		 * Default value of the toggle
		 */
		default?: boolean
		/**
		 * ID of a setting that the toggle is linked to
		 */
		linked_setting?: string
		/**
		 * Method that gets called when the user changes the value of the toggle
		 */
		onChange?(value: boolean): void
	}
	/**
	 * A toggle is a type of action that can be on or off. The state is not persistent between restarts by default.
	 */
	class Toggle extends Action {
		value: boolean
		constructor(id: string, options: ToggleOptions)
		/**
		 * Updates the state of the toggle in the UI
		 */
		updateEnabledState(): void
		/**
		 * ID of a setting that the toggle is linked to
		 */
		linked_setting?: string
		set(value: boolean): this
		setIcon(icon: IconString): void
	}

	type RGBAColor = { r: number; g: number; b: number; a: number }
	type ViewMode = 'textured' | 'solid' | 'wireframe' | 'uv' | 'normal'
	type PaintContext = {
		/**
		 * Brush color, set by the Blockbench color panel
		 */
		color: string
		/**
		 * Opacity, as set by the Opacity slider
		 */
		opacity: number
		/**
		 * 2D Canvas context of the texture that is being edited
		 */
		ctx: CanvasRenderingContext2D
		/**X Coordinate of the position of the brush stroke */
		x: number
		/**Y Coordinate of the position of the brush stroke */
		y: number
		/**
		 * Brush size, as set by the Brush Size slider
		 */
		size: number
		/**
		 * Brush softness, as set by the Brush Softness slider
		 */
		softness: number
		/**
		 * Blockbench texture that is being edited
		 */
		texture: Texture
		/**
		 * Javascript pointer event that the brush stroke originated from
		 */
		event: PointerEvent
	}
	interface BrushOptions {
		/**
		 * Enable the input for blend modes when this tool is selected
		 */
		blend_modes: boolean
		/**
		 * Enable the input for shapes when this tool is selected
		 */
		shapes: boolean
		/**
		 * Enable the input for brush size when this tool is selected
		 */
		size: boolean
		/**
		 * Enable the input for softness when this tool is selected
		 */
		softness: boolean
		/**
		 * Enable the input for opacity when this tool is selected
		 */
		opacity: boolean
		/**
		 * When the brush size is an even number, offset the snapping by half a pixel so that even size brush strokes can be correctly centered
		 */
		offset_even_radius: boolean
		/**
		 * Set whether the brush coordinates get floored to snap to the nearest pixel.
		 */
		floor_coordinates: boolean | (() => boolean)
		/**
		 * Function that runs per pixel when the brush is used. Mutually exclusive with draw().
		 * @param pixel_x Local X coordinate relative to the brush center
		 * @param pixel_y Local Y coordinate relative to the brush center
		 * @param pixel_color Current color of the pixel on the texture
		 * @param local_opacity Local opacity of the current pixel on the brush, between 0 and 1. Opacity falls of to the sides of the brush if the brush is set to smooth. Opacity from the Opacity slider is not factored in yet.
		 * @param PaintContext Additional context to the paint stroke
		 */
		changePixel(
			pixel_x: number,
			pixel_y: number,
			pixel_color: RGBAColor,
			local_opacity: number,
			PaintContext: PaintContext
		): RGBAColor
		/**
		 * Function that runs when a new brush stroke starts. Return false to cancel the brush stroke
		 * @param context
		 */
		onStrokeStart(context: {
			texture: Texture
			x: number
			y: number
			uv?: any
			event: PointerEvent
			raycast_data: RaycastResult
		}): boolean
		/**
		 * Function that runs when a new brush stroke starts. Return false to cancel the brush stroke
		 * @param context
		 */
		onStrokeMove(context: {
			texture: Texture
			x: number
			y: number
			uv?: any
			event: PointerEvent
			raycast_data: RaycastResult
		}): boolean
		/**
		 * Function that runs when a new brush stroke starts.
		 * @param context
		 */
		onStrokeEnd(context: {
			texture: Texture
			x: number
			y: number
			uv?: any
			raycast_data: RaycastResult
		}): void
		/**
		 * Alternative way to create a custom brush, mutually exclusive with the changePixel() function. Draw runs once every time the brush starts or moves, and also along the bath on lines.
		 * @param context
		 */
		draw(context: {
			ctx: CanvasRenderingContext2D
			x: number
			y: number
			size: number
			softness: number
			texture: Texture
			event: PointerEvent
		}): void
	}
	interface ToolOptions extends ActionOptions {
		selectFace?: boolean
		selectElements?: boolean
		transformerMode?: 'translate' | ''
		animation_channel?: string
		toolbar?: string
		alt_tool?: string
		modes?: string[]
		allowed_view_modes?: ViewMode
		paintTool?: boolean
		brush?: BrushOptions
	}
	interface WidgetOptions extends BarItemOptions {
		id?: string
	}
	/**
	 * A tool, such as move tool, vertex snap tool, or paint brush
	 */
	class Tool extends Action {
		constructor(id: string, options: ToolOptions)
		animation_channel: string
		select(): this | undefined
		trigger(event: Event): boolean
	}
	class Widget extends BarItem {
		constructor(id: string, options: WidgetOptions)
	}
	type NumSliderOptions = WidgetOptions & {
		private?: boolean
		settings?: {
			default?: number
			min?: number
			max?: number
			interval?: number
			step?: number
		}
		change?(value: (n: number) => number): void
		get?(): number
	}
	class NumSlider extends Widget {
		constructor(id: string, options: NumSliderOptions)
		startInput(event: Event): void
		setWidth(width: any): this
		getInterval(event: Event): number
		slide(clientX: any, event: Event): void
		input(): void
		stopInput(): void
		arrow(difference: any, event: Event): void
		trigger(event: Event): boolean
		setValue(value: number, trim?: any): this
		change(modify: (n: number) => number): void
		get(): number
		update(): void
	}
	class BarSlider extends Widget {
		constructor(id: string, options: NumSliderOptions)
		change(event: Event): void
		set(value: number): void
		get(): number
	}
	interface BarSelectOptions<T> extends WidgetOptions {
		value?: T
		options: Record<string, T>
	}
	class BarSelect<T> extends Widget {
		constructor(id: string, options: BarSelectOptions<T>)
		open(event: Event): void
		trigger(event: Event): boolean | undefined
		change(value: T, event: Event): this
		getNameFor(key: string): string
		set(key: string): this
		get(): string
		value: T
	}
	class BarText extends Widget {
		constructor(
			id: string,
			options: WidgetOptions & {
				text: string
			}
		)
		set(text: any): this
		update(): this
		trigger(event: Event): boolean
	}
	interface ColorPickerOptions extends WidgetOptions {
		value?: string
		palette?: boolean
		onChange?: (color: tinycolor.Instance) => void
	}
	class ColorPicker extends Widget {
		value: tinycolor.Instance
		jq: JQuery
		constructor(options: ColorPickerOptions)
		constructor(id: string, options: ColorPickerOptions)
		change(color: tinycolor.Instance): void
		hide(): void
		confirm(): void
		set(color: any): this
		get(): tinycolor.Instance
	}
	interface ToolbarOptions {
		id: string
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
	class Toolbar {
		constructor(id: string, data: ToolbarOptions)
		constructor(data: ToolbarOptions)
		build(data: any, force: any): this
		contextmenu(event: Event): void
		editMenu(): this
		add(action: any, position?: number): this
		remove(action: any): this
		update(): this
		toPlace(place: any): this
		save(): this
		reset(): this
		condition(): boolean
	}
	namespace BARS {
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
	}
	const Toolbox: _ToolToolbar
}
