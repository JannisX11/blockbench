interface CollectionOptions {
	children?: string[]
	name?: string
	export_codec?: string
	export_path?: string
	visibility?: boolean
}

/**
 * Collections are "selection presets" for a set of groups and elements in your project, independent from outliner hierarchy
 */
declare class Collection {
	constructor(data?: CollectionOptions, uuid?: string)

	selected: boolean
	/**
	 * List of direct children, referenced by UUIDs
	 */
	children: string[]
	name: string
	export_codec: string
	export_path: string
	visibility: boolean

	extend(data: CollectionOptions): this
	select(event?: Event): this
	clickSelect(event: Event): void
	/**
	 * Get all direct children
	 */
	getChildren(): OutlinerNode[]
	add(): this
	/**
	 * Adds the current outliner selection to this collection
	 */
	addSelection(): this
	/**
	 * Returns the visibility of the first contained node that supports visibility. Otherwise returns true.
	 */
	getVisibility(): boolean
	/**
	 * Get all children, including indirect ones
	 */
	getAllChildren(): any[]
	/**
	 * Toggle visibility of everything in the collection
	 * @param event If the alt key is pressed, the result is inverted and the visibility of everything but the collection will be toggled
	 */
	toggleVisibility(event: Event): void
	/**
	 * Opens the context menu
	 */
	showContextMenu(event: Event): this
	getUndoCopy(): {
		uuid: string
		index: number
		[key: string]: any
	}
	getSaveCopy(): {
		uuid: string
		[key: string]: any
	}
	/**
	 * Opens the properties dialog
	 */
	propertiesDialog(): void

	/**
	 * Get all collections
	 */
	static all: Collection[]
	/**
	 * Get selected collections
	 */
	static selected(): Collection[]
}
