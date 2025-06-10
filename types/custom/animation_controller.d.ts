/// <reference path="./blockbench.d.ts"/>

type StateAnimationInput =
	| string
	| {
			[key: string]: string
	  }
	| {
			uuid: string
			key?: string
			animation?: string
			blend_value?: number
	  }
type StateAnimation = {
	uuid: string
	key: string
	animation: string
	blend_value: number
}

interface AnimationControllerStateOptions {
	name?: string
	animations?: StateAnimationInput[]
	transitions?: any[]
	sounds?: any[]
	particles?: any[]
	on_entry?: string
	on_exit?: string
	blend_transition?: number
	blend_via_shortest_path?: boolean
}

declare class AnimationControllerState {
	constructor(controller: AnimationController, options?: AnimationControllerStateOptions)
	controller: AnimationController
	uuid: string
	name: string
	fold: {
		animations: boolean
		particles: boolean
		sounds: boolean
		on_entry: boolean
		on_exit: boolean
		transitions: boolean
	}
	muted: {
		sound: boolean
		particle: boolean
	}
	playing_sounds: HTMLAudioElement[]
	animations: StateAnimation[]
	transitions: any[]
	sounds: any[]
	particles: any[]
	on_entry: string
	on_exit: string
	blend_transition: number
	blend_via_shortest_path: boolean

	extend(data: AnimationControllerStateOptions): void
	getUndoCopy(): any
	compileForBedrock(): any
	select(force?: boolean): void
	unselect(): void
	playEffects(): void
	scrollTo(): void
	rename(): void
	remove(undo?: boolean): void
	createUniqueName(): void

	addAnimation(animation?: _Animation): void
	addTransition(target_uuid?: string): void
	addParticle(options?: { effect: string }): void
	addSound(options?: { effect: string; file: string }): void
	openMenu(event: Event): void
	/**
	 * Returns the current animation time of the state in seconds
	 */
	getStateTime(): number
}

interface AnimationControllerOptions {
	name?: string
	uuid?: string
	path?: string
	initial_state?: string
}

/**
 * Animation Controllers are state machines used for Minecraft: Bedrock Edition models to control and blend between animations.
 */
declare class AnimationController extends AnimationItem {
	constructor(data?: AnimationControllerOptions)
	name: string
	path: string
	uuid: string
	playing: boolean
	saved: boolean
	selected: boolean
	saved_name: string
	states: AnimationControllerState[]
	initial_state: string
	selected_state: null | AnimationControllerState
	extend(data: AnimationControllerOptions): this
	getUndoCopy(): any
	compileForBedrock(): any
	save(): this | undefined
	select(): this | undefined
	createUniqueName(references: AnimationController[]): string | boolean
	rename(): this
	/**
	 * Adds the animation controller to the current project and to the interface
	 * @param undo If true, the addition of the animation controller will be registered as an edit
	 */
	add(undo?: boolean): this
	remove(undo?: boolean, remove_from_file?: boolean): this
	propertiesDialog(): void
	/**
	 * Updates the preview of the controller, including updating the animations and switching states if preview mode is set to play
	 */
	updatePreview(): void
	togglePlayingState(state?: boolean): boolean
	showContextMenu(event: Event | HTMLElement): void
}
