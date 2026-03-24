/// <reference types="./blockbench"/>
type ArrayVector4 = [number, number, number, number]
type ArrayVector3 = [number, number, number]
type ArrayVector2 = [number, number]
declare interface OutlinerNodeParentTraits {
	children: OutlinerNode[]
	openUp(): void
	isOpen: boolean
}

/**
 * @deprecated Use {@link Outliner.elements} instead
 */
declare const elements: OutlinerNode[]


/**
 * @private
 */
type ElementTypeConstructor = {
	new (...args: any[]): OutlinerElement;
	init?(): void;
	behavior: any;
	properties: Record<string, Property<any>>
	selected: OutlinerElement[]
};


interface LocatorOptions {
	name: string
	from: ArrayVector3
}
declare class Locator extends OutlinerElement {
	constructor(options: Partial<LocatorOptions>, uuid?: string)
	name: string

	extend(options: Partial<LocatorOptions>): void
	flip(axis: number, center: number): this
	getWorldCenter(): THREE.Vector3

	static all: Locator[]
	static selected: Locator[]
}

interface NullObjectOptions {
	name?: string
	position?: ArrayVector3
	ik_target?: string
	lock_ik_target_rotation?: boolean
}
declare class NullObject extends OutlinerElement {
	constructor(options: Partial<NullObjectOptions>, uuid?: string)
	position: ArrayVector3
	ik_target: string
	lock_ik_target_rotation: boolean

	extend(options: Partial<NullObjectOptions>): void
	flip(axis: number, center: number): this
	getWorldCenter(): THREE.Vector3

	static all: NullObject[]
	static selected: NullObject[]
}

interface TextureMeshOptions {
	name?: string
	texture_name?: string
	origin?: ArrayVector3
	local_pivot?: ArrayVector3
	rotation?: ArrayVector3
	scale?: ArrayVector3
}
declare class TextureMesh extends OutlinerElement {
	constructor(options: Partial<TextureMeshOptions>, uuid?: string)
	texture_name: string
	local_pivot: ArrayVector3
	scale: ArrayVector3

	extend(options: Partial<TextureMeshOptions>): void
	flip(axis: number, center: number): this
	getWorldCenter(): THREE.Vector3
	moveVector(offset: ArrayVector3 | THREE.Vector3, axis: number, update?: boolean): void

	static all: TextureMesh[]
	static selected: TextureMesh[]
}

/**
 * Toggle in the outliner
 */
interface OutlinerToggle {
	id: string
	title: string
	icon: IconString
	icon_off?: IconString
	icon_alt?: IconString
	condition?: ConditionResolvable
	/**
	 * If true, the toggle will only be visible when "Toggle More Options" is enabled
	 */
	advanced_option?: boolean
	/**
	 * Override the visibility and still show the toggle under certain conditions, even if more options are disabled
	 */
	visibilityException?: (node: OutlinerNode) => boolean
	/**
	 * It's complicated, check the source code
	 */
	getState?: (node: OutlinerNode) => boolean | 'alt'
}

declare namespace Outliner {
	let root: OutlinerNode[]
	const ROOT: 'root'
	const elements: OutlinerElement[]
	const selected: OutlinerElement[]
	const nodes: OutlinerNode[]
	let control_menu_group: MenuItem[]
	const buttons: {
		autouv: OutlinerToggle
		export: OutlinerToggle
		locked: OutlinerToggle
		mirror_uv: OutlinerToggle
		shade: OutlinerToggle
		visibility: OutlinerToggle
		[id: string]: OutlinerToggle
	};

	interface OutlinerDisplayRule {
		/**
		 * ID of the rule
		 */
		id: string
		/**
		 * A test function to determine if the node should be hidden by the rule
		 * @param node Outliner node (or element) to test
		 */
		test: (node: OutlinerNode) => boolean
	}
	function isNodeDisplayed(node: OutlinerNode): boolean
	/**
	 * A list of rules regarding which nodes are displayed in the outliner. If any rule returns false, the node is not displayed
	 */
	const node_display_rules: OutlinerDisplayRule[]
	/**
	 * Update which nodes are displayed in the outliner
	 */
	function updateNodeDisplayRules(): void

	function toJSON(): []
	function loadJSON(array: [], add_to_project?: boolean): void;
}



declare function compileGroups(undo: boolean, lut?: { [index: number]: number }): any[]

declare function parseGroups(array: any[], import_reference?: Group, startIndex?: number): void
