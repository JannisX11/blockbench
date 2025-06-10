/// <reference path="./blockbench.d.ts"/>

declare class AnimationItem {
	static all: _Animation[]
	static selected: _Animation | null
	getUndoCopy?(options?: any, save?: any): AnimationOptions
}

interface AnimationOptions {
	name?: string
	uuid?: string
	path?: string
	loop?: 'once' | 'hold' | 'loop'
	override?: boolean
	anim_time_update?: string
	blend_weight?: string
	length?: number
	snapping?: number
	animators?: any
}

interface AnimationUndoCopy {
	uuid: any
	name: any
	loop: any
	override: any
	anim_time_update: any
	blend_weight: any
	length: any
	snapping: any
	selected: any
}

/**
 *
 * ⚠️ This will not provide correct type information! ⚠️
 *
 * Use {@link Blockbench.Animation} instead for TypeScript support.
 *
 * Blockbench overwrites libdom's {@link Animation} type with its own `Animation` Class, but TypeScript doesn't include a way to overwrite UMD global types.
 * To get around this, we changed the name of this class type declaration to `_Animation` and use that in the type definitions.
 */
interface Animation {}

/**
 * ⚠️ THIS IS TYPE ONLY ⚠️
 *
 * **It does not exist** in Blockbench at Run-time. Use {@link Blockbench.Animation} instead.
 *
 * Blockbench overwrites libdom's {@link Animation} type with its own `Animation` Class, but TypeScript doesn't include a way to overwrite UMD global types.
 * To get around this, we changed the name of this class type declaration to `_Animation` and use that in the type definitions.
 *
 * @deprecated
 */
declare class _Animation extends AnimationItem {
	constructor(data?: AnimationOptions)
	extend(data?: AnimationOptions): this
	getUndoCopy(options?: {}, save?: any): AnimationUndoCopy
	/**
	 * Compiles the JSON tree of the animation for the Minecraft Bedrock Edition animation format.
	 */
	compileBedrockAnimation(): any
	save(): this | undefined
	select(): this | undefined
	setLength(length?: number): void
	createUniqueName(references: _Animation[]): any
	rename(): this
	togglePlayingState(state: any): any
	showContextMenu(event: any): this
	/**
	 * Returns (if necessary creates) the animator of a specific outliner node of this animation
	 */
	getBoneAnimator(node?: OutlinerNode): BoneAnimator
	/**
	 * Adds the animation to the current project and to the interface
	 * @param undo If true, the addition of the animation will be registered as an edit
	 */
	add(undo?: boolean): this
	remove(undo: boolean, remove_from_file?: boolean): this
	getMaxLength(): number
	setLoop(value: any, undo: any): void
	/**
	 * Calculate the snapping value that the animation should use, based on the time codes of the keyframes that it holds. Directly updates the value, but also returns it as a number (snaps per second)
	 */
	calculateSnappingFromKeyframes(): number
	/**
	 * Opens the properties dialog
	 */
	propertiesDialog(): void

	name: string
	uuid: string
	loop: 'once' | 'hold' | 'loop'
	override: boolean
	anim_time_update: string
	blend_weight: string
	length: number
	snapping: number
	loop_delay: string
	start_delay: string
	path: string
	playing: boolean
	saved: boolean
	time: number

	effects?: EffectAnimator

	markers: TimelineMarker[]
	animators: {
		[id: string]: GeneralAnimator
	}
	saved_name?: string
	selected: boolean
	type: string
	menu: Menu
	file_menu: Menu
}

interface MolangAutoCompletionItem {
	text: string
	label: string | undefined
	overlap: number
}

declare namespace Animator {
	const open: boolean
	const MolangParser: Molang
	const possible_channels: unknown[]
	const motion_trail: THREE.Object3D
	const motion_trail_lock: boolean
	const particle_effects: any
	const animations: _Animation[]
	const selected: _Animation | undefined
	function join(): void
	function leave(): void
	function showDefaultPose(no_matrix_update?: boolean): void
	function resetParticles(): void
	function showMotionTrail(target?: Group): void
	/**
	 * Updates the preview based on the current time
	 */
	function preview(in_loop?: boolean): void
	function loadParticleEmitter(path: string, content: string): void
	/**
	 * Import a Bedrock animation file
	 * @param file File any
	 * @param animation_filter List of names of animations to import
	 */
	function loadFile(file: any, animation_filter?: string[]): void
	function exportAnimationFile(path: string): void
	function resetLastValues(): void
	function autocompleteMolang(
		text: string,
		position: number,
		type: string
	): MolangAutoCompletionItem[]
}

interface AddChannelOptions {
	name?: string
	transform?: boolean
	mutable?: boolean
	max_data_points?: number
}
interface Channel {
	name: string
	transform: boolean
	mutable: boolean
	max_data_points: number
}
declare class GeneralAnimator {
	constructor(uuid: string | null, animation: _Animation, name: string)
	uuid: string
	keyframes: _Keyframe[]
	animation: _Animation
	expanded: boolean
	selected: boolean
	select(): this
	addToTimeline(): this
	addKeyframe(data: KeyframeOptions, uuid?: string): _Keyframe
	createKeyframe(): _Keyframe
	getOrMakeKeyframe(): { before: _Keyframe; result: _Keyframe }
	toggleMuted(channel: string): this
	scrollTo(): this

	static addChannel(channel: string, options: AddChannelOptions): void
	channels: {
		[channel: string]: Channel
	}
	muted: {
		[channel: string]: boolean | undefined
	};
	[channel: string]: any
}

declare class BoneAnimator extends GeneralAnimator {
	name: string
	uuid: string
	rotations: _Keyframe[]
	position: _Keyframe[]
	scale: _Keyframe[]
	getGroup(): Group
	fillValues(): void
	pushKeyframe(): void
	doRender(): boolean
	displayRotation(arr?: ArrayVector3 | ArrayVector4, multiplier?: number): void
	displayPosition(arr?: ArrayVector3, multiplier?: number): this
	displayScale(arr?: ArrayVector3, multiplier?: number): void
	interpolate(channel: string, allow_expression?: boolean, axis?: string): ArrayVector3 | false
	displayFrame(multiplier?: number): void
}
declare class NullObjectAnimator extends GeneralAnimator {
	name: string
	uuid: string
	rotations: _Keyframe[]
	position: _Keyframe[]
	scale: _Keyframe[]
	getElement(): NullObject
	doRender(): void
	displayIK(): void
	displayFrame(): void
}
declare class EffectAnimator extends GeneralAnimator {
	name: string
	uuid: string
	rotations: _Keyframe[]
	position: _Keyframe[]
	scale: _Keyframe[]
	pushKeyframe(keyframe: _Keyframe): this
	displayFrame(in_loop?: boolean): void
	startPreviousSounds(): void
}

declare class TimelineMarker {
	color: number
	time: number
}
