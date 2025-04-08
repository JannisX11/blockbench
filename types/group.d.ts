interface GroupOptions {
	/**Group name */
	name: string
	/**Array of the group pivot point */
	origin: ArrayVector3
	/**Array of the group rotation */
	rotation: ArrayVector3
	/**If a bone, whether to reset the informations of inherited bones in bedrock edition. */
	reset: boolean
	/**Whether to shade the contents of the group */
	shade: boolean
	/**Whether the group is selected */
	selected: boolean
	/**Whether the group is visible */
	visibility: boolean
	/**Whether to export the entire group */
	export: boolean
	/**Auto UV setting for the children. Can be 0, 1 or 2. */
	autouv: 0 | 1 | 2
}

declare class Group extends OutlinerNode {
	constructor(options: Partial<GroupOptions> | string)
	/**
	 * Returns the first selected group.
	 * In the future this will return an array of selected groups instead.
	 * @deprecated Use {@link Group.multi_selected} instead!
	 */
	static selected: Group | undefined
	/**
	 * The first group in {@link Group.multi_selected}
	 */
	static first_selected: Group | undefined
	/**
	 * A list of directly selected groups.
	 * @Note This only includes directly selected groups, not groups that are selected because the parent is selected
	 */
	static multi_selected: Group[]
	/**
	 * All groups in the current project
	 */
	static all: Group[]
	static animator: BoneAnimator
	/**Check if any groups are in the project */
	static hasAny: () => boolean

	name: string
	children: OutlinerNode[]
	origin: ArrayVector3
	rotation: ArrayVector3
	reset: boolean
	shade: boolean
	selected: boolean
	visibility: boolean
	autouv: 0 | 1 | 2
	isOpen: boolean
	ik_enabled: boolean
	ik_chain_length: number
	texture?: string
	skin_original_origin?: ArrayVector3
	bedrock_binding?: string
	cem_animations?: any[]
	cem_attach?: boolean
	cem_scale?: number
	mesh: THREE.Mesh

	static preview_controller: NodePreviewController

	extend(options: Partial<GroupOptions>): this
	selectChildren(event: Event): this
	selectLow(highlight: boolean): this
	select(event?: any, isOutlinerClick?: boolean): this | void
	unselect(): this | void
	matchesSelection(): boolean
	/**
	 * Opens the group and all of its ancestor groups.
	 */
	openUp(): this
	/**
	 * Removes the group
	 * @param undo If true, an undo point will be created.
	 */
	remove(undo?: boolean): this
	/**
	 * Remove the group and leave all of its children in the parent array.
	 */
	resolve(): OutlinerNode[]
	/**
	 * Move the origin of a bone to a specific location without visually affecting the position of it's content.
	 */
	transferOrigin(origin: ArrayVector3): this
	/**
	 * Sort the content of the group alphabetically. This will automatically create an undo point.
	 */
	sortContent(): this
	/**
	 * Duplicate the group
	 */
	duplicate(): Group
	getSaveCopy(): any
	getChildlessCopy(): Group
	compile(undo: boolean): any
	forEachChild(callback: (any: OutlinerNode) => void, type?: any, for_self?: boolean): void
}
