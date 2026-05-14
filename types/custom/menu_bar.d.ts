/// <reference types="./blockbench"/>


declare interface BarMenuOptions {
	name?: string
	icon?: IconString
	condition?: ConditionResolvable
}

/**
 * Creates a new menu in the menu bar
 */
declare class BarMenu extends Menu {
	constructor(id: string, structure: MenuItem[], options?: BarMenuOptions)
	type: 'bar_menu'
	id: string
	condition?: ConditionResolvable
	name: string
	label: HTMLElement
	structure: MenuItem[]
	/**
	 * Visually highlights an action within the menu, until the user opens the menu
	 */
	highlight(action: Action): void
}

declare namespace MenuBar {
	const mode_switcher_button: null | HTMLDivElement
	const menus: {
		file: Menu
		edit: Menu
		transform: Menu
		uv: Menu
		texture: Menu
		animation: Menu
		keyframe: Menu
		display: Menu
		tools: Menu
		view: Menu
		help: Menu
		[id: string]: Menu
	}
	const keys: string[]
	let open: Menu | null
	/**
	 * Add a new menu to the menu bar
	 * @param menu The BarMenu to add
	 * @param position Specify the position in the menu list where to add insert the menu. Can either be an index in the list of all menus, or the ID of the menu to insert right from.
	 */
	function addMenu(menu: BarMenu, position?: number | string): void
	/**
	 * Adds an action to the menu structure
	 * @param action Action to add
	 * @param path Path pointing to the location. Use the ID of each level of the menu, or index or group within a level, separated by a point. For example, `file.export.0` places the action at the top position of the Export submenu in the File menu.
	 */
	function addAction(action: Action, path?: string): void
	/**
	 *
	 * @param path Path pointing to the location. Use the ID of each level of the menu, or index or group within a level, or item ID, separated by a point. For example, `export.export_special_format` removes the action "Export Special Format" from the Export submenu.
	 */
	function removeAction(path: string): void
	/**
	 * Update the menu bar
	 */
	function update(): void
}
