/// <reference path="./blockbench.d.ts"/>
interface CustomMenuItem {
	name: string
	id: string
	icon: IconString
	color?: string
	description?: string
	/**
	 * Keybind or string to display in the menu, won't work as an actual keybinding by default
	 */
	keybind?: Keybind | string
	/**
	 * Adds a search bar to the menu or submenu
	 */
	searchable?: boolean
	children?: MenuItem[] | (() => MenuItem[])
	click?(context?: any, event?: Event): void
}
type MenuItem = CustomMenuItem | Action | BarSelect<string> | MenuSeparator | string
interface MenuOptions {
	onOpen?(position: MouseEvent | HTMLElement, context?: any): void
	onClose?(): void
	keep_open?: boolean
	searchable?: boolean
	class?: string
}
/**
 * Use the Menu class to create a context menu. Menus can contain custom entries and hierarchy, or existing actions and tools.
 */
declare class Menu extends Deletable {
	/**
	 * Creates a new context menu
	 */
	constructor(
		id: string,
		template: MenuItem[] | ((context?: any) => MenuItem[]),
		options?: MenuOptions
	)
	constructor(template: MenuItem[] | ((context?: any) => MenuItem[]), options?: MenuOptions)

	/**
	 * Opens the menu somewhere
	 * @param position Position where to open the menu. Can be a mouse event, or a node that the menu is spawned below.
	 * @param context Context for the click events inside the menu
	 */
	open(position: MouseEvent | HTMLElement, context?: any): this
	/**
	 * Closes the menu if it's open
	 */
	hide(): this
	/**
	 * Adds an action to the menu structure
	 * @param action Action to add
	 * @param path Path pointing to the location. Use the ID of each level of the menu, or index within a level, separated by a point. For example, `export.0` places the action at the top position of the Export submenu.
	 */
	addAction(action: Action, path?: string | number): void
	/**
	 *
	 * @param path Path pointing to the location. Use the ID of each level of the menu, or index within a level, or item ID, separated by a point. For example, `export.export_special_format` removes the action "Export Special Format" from the Export submenu.
	 */
	removeAction(path: string | Action): void
	structure: MenuItem[]
}

/**
 * Creates a new menu in the menu bar
 */
declare class BarMenu extends Menu {
	constructor(id: string, structure: MenuItem[], condition?: ConditionResolvable)
	type: 'bar_menu'
	id: string
	condition?: ConditionResolvable
	name: string
	structure: MenuItem[]
	/**
	 * Visually highlights an action within the menu, until the user opens the menu
	 */
	highlight(action: Action): void
}

declare namespace MenuBar {
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
