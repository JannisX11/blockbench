/// <reference types="./blockbench"/>
declare const DisplayMode: {
	slots: string[]
	slot: DisplaySlot
	/**
	 * ID of the slot that is selected for editing
	 */
	display_slot: string
	display_area: any
	display_base: any
}

declare type DisplaySlotName =
	| 'firstperson_lefthand'
	| 'firstperson_righthand'
	| 'fixed'
	| 'ground'
	| 'gui'
	| 'head'
	| 'thirdperson_lefthand'
	| 'thirdperson_righthand'

interface DisplaySlotOptions {
	rotation?: ArrayVector3
	translation?: ArrayVector3
	scale?: ArrayVector3
	rotation_pivot?: ArrayVector3
	scale_pivot?: ArrayVector3
	mirror?: [boolean, boolean, boolean]
}

/**
 * Display Slots hold the transform values for a specific item slot in the Minecraft Java Edition "Display Mode" feature
 */
declare class DisplaySlot {
	constructor(id: string, data: DisplaySlotOptions)
	rotation: ArrayVector3
	translation: ArrayVector3
	scale: ArrayVector3
	rotation_pivot: ArrayVector3
	scale_pivot: ArrayVector3
	mirror: [boolean, boolean, boolean]
	/**
	 * Reset slot to default values
	 */
	default(): this
	extend(data: DisplaySlotOptions): this
	copy(): {
		rotation: ArrayVector3
		translation: ArrayVector3
		scale: ArrayVector3
		rotation_pivot: ArrayVector3
		scale_pivot: ArrayVector3
		mirror: [boolean, boolean, boolean]
	}
	/**
	 * Generate the values of the slot for export
	 */
	export():
		| {
				rotation: ArrayVector3
				translation: ArrayVector3
				scale: ArrayVector3
				rotation_pivot?: ArrayVector3
				scale_pivot?: ArrayVector3
		  }
		| undefined
	/**
	 * Visually update the UI with the data from this slot if selected
	 */
	update(): this
}

declare interface RefModelOptions {
	icon?: string
	models?: DisplayReferenceModel.Model[]
	condition?: ConditionResolvable
}

declare const displayReferenceObjects: {
	refmodels: {
		player: refModel<'player'>
		zombie: refModel<'zombie'>
		armor_stand: refModel<'armor_stand'>
		baby_zombie: refModel<'baby_zombie'>
		armor_stand_small: refModel<'armor_stand_small'>
		fox: refModel<'fox'>
		monitor: refModel<'monitor'>
		bow: refModel<'bow'>
		crossbow: refModel<'crossbow'>
		eating: refModel<'eating'>
		tooting: refModel<'tooting'>
		block: refModel<'block'>
		frame: refModel<'frame'>
		frame_invisible: refModel<'frame_invisible'>
		frame_top: refModel<'frame_top'>
		frame_top_invisible: refModel<'frame_top_invisible'>
		inventory_nine: refModel<'inventory_nine'>
		inventory_full: refModel<'inventory_full'>
		hud: refModel<'hud'>
	}
	active: refModel<keyof typeof displayReferenceObjects.refmodels> | ''
	/* Clears the active display model */
	clear(): void
	bar(buttons: any): void
	ref_indexes: Record<DisplaySlotName, number>
	slots: DisplaySlotName[]
}

declare class refModel<ID extends string> {
	constructor(id: ID, options?: RefModelOptions)
	id: ID
	name: string
	icon: string
	model: THREE.Mesh
	models: DisplayReferenceModel.Model[]
	condition?: ConditionResolvable
	initialized: boolean
	variant?: 'steve' | 'alex'
	pose_angles: Record<DisplaySlotName, number>
	buildModel(things: any, texture: string, texture_res?: ArrayVector2): this
	setModelVariant(variant: string): void
	load(index: any): void
	buildPlayer(slim?: boolean): void
	buildArmorStand(): void
	buildArmorStandSmall(): void
	buildFox(): void
	buildZombie(): void
	buildBabyZombie(): void
	buildMonitor(): void
	buildBlock(): void
	buildFrame(): void
	buildFrameInvisible(): void
	buildFrameTop(): void
	buildFrameTopInvisible(): void
	updateBasePosition(): void
}
