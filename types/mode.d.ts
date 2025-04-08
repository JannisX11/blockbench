/// <reference path="./blockbench.d.ts"/>

interface ModeOptions {
	id: string
	name: string
	icon?: string
	default_tool?: string
	selectElements?: boolean
	category?: string
	/**
	 * Hide certain types of nodes in the outliner, like cubes and meshes in animation mode
	 */
	hidden_node_types?: string[]
	hide_toolbars?: boolean
	hide_sidebars?: boolean
	hide_status_bar?: boolean
	condition?: ConditionResolvable
	component?: Vue.Component
	onSelect?(): void
	onUnselect?(): void
}
declare class Mode extends KeybindItem {
	constructor(id: string, options: ModeOptions)
	constructor(options: ModeOptions)
	id: string
	name: string

	/**Selects the mode */
	select(): void
	/**Unselects the mode */
	unselect(): void
	/**Activates the mode */
	trigger(): void

	onSelect?(): void

	onUnselect?(): void

	static selected: Mode
}

declare namespace Modes {
	const options: {
		[id: string]: Mode
		animate: Mode
		display: Mode
		edit: Mode
		paint: Mode
		pose: Mode
	}
	let selected: Mode | false | undefined

	let animate: boolean | undefined
	let display: boolean | undefined
	let edit: boolean | undefined
	let paint: boolean | undefined
	let pose: boolean | undefined
}
