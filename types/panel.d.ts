/// <reference path="./blockbench.d.ts"/>

type PanelSlot = 'left_bar' | 'right_bar' | 'top' | 'bottom' | 'float' | 'hidden'

interface PanelOptions {
	id: string
	name: string
	icon: string
	menu?: any
	/**
	 * If true, the panel can automatically become smaller or larger than its initial size in the sidebar
	 */
	growable?: boolean
	/**
	 * When true, the height of the panel can be adjusted in the sidebar
	 */
	resizable?: true
	selection_only?: boolean
	condition?: ConditionResolvable
	display_condition?: ConditionResolvable
	/**
	 * Adds a button to the panel that allows users to pop-out and expand the panel on click
	 */
	expand_button: boolean
	toolbars?:
		| {
				[id: string]: Toolbar
		  }
		| Toolbar[]
	default_position?:
		| {
				slot: PanelSlot
				float_position: [number, number]
				float_size: [number, number]
				height: number
				folded: boolean
		  }
		| number
	component?: Vue.Component
	default_side: 'right' | 'left'
	/**
	 * Identifier of another panel to insert this one above
	 */
	insert_before?: string
	/**
	 * Identifier of another panel to insert this one below
	 */
	insert_after?: string
	onResize?(): void
	onFold?(): void
}
type PanelEvent = 'drag' | 'fold' | 'change_zindex' | 'move_to' | 'moved_to' | 'update'

/**
 * Panels are interface sections in Blockbench, that are always visible (in a specific format and mode), and can be added to the sidebars, above or below the 3D viewport, or used as free floating above the UI. Examples are the Outliner or the UV editor.
 */
declare class Panel {
	constructor(id: string, options: PanelOptions)
	constructor(options: PanelOptions)
	isVisible(): boolean
	isInSidebar(): boolean
	slot: PanelSlot
	folded: boolean
	inside_vue: Vue
	resizable: boolean
	fixed_height?: boolean
	condition?: ConditionResolvable

	fold(state?: boolean): this
	vue: Vue.Component
	menu: Menu
	/**
	 * If the panel is floating, move it up to the front
	 */
	moveToFront(): this
	moveTo(slot: PanelSlot, ref_panel?: Panel, before?: boolean): this
	update(dragging?: boolean): this
	dispatchEvent(event_name: PanelEvent, data?: any): void
	/**
	 * Add an event listener
	 */
	on(event_name: PanelEvent, callback: (data?: any) => void): void
	/**
	 * Adds a single-use event listener
	 */
	once(event_name: PanelEvent, callback: (data?: any) => void): void
	/**
	 * Removes an event listener
	 */
	removeListener(event_name: PanelEvent, callback: (data?: any) => void): void
	delete(): void
}

declare const Panels: {
	[id: string]: Panel
}

declare function updateInterfacePanels(): void
declare function setActivePanel(panel_id: string): void
