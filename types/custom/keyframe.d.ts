/// <reference path="./blockbench.d.ts"/>

interface KeyframeDataPointData {
	[key: string]: any
}
declare class KeyframeDataPoint extends Object {
	static properties: Record<string, Property<any>>
	constructor(keyframe: _Keyframe)
	extend(data: KeyframeDataPointData): void
	getUndoCopy(): {
		[key: string]: any
	}
	[key: string]: any
}

interface KeyframeOptions {
	channel?: string
	data_points: {}[]
	time: number
	color?: number
	uniform?: boolean
	interpolation?: 'linear' | 'catmullrom' | 'bezier' | 'step' | string
	bezier_linked?: boolean
	bezier_left_time?: ArrayVector3
	bezier_left_value?: ArrayVector3
	bezier_right_time?: ArrayVector3
	bezier_right_value?: ArrayVector3
}
type axisLetter = 'x' | 'y' | 'z'

declare class _Keyframe {
	constructor(options: KeyframeOptions, uuid: any)
	static selected: _Keyframe[]
	data_points: KeyframeDataPoint[]
	animator: GeneralAnimator
	channel: string
	time: number
	uuid: string
	color: number
	uniform: boolean
	interpolation: 'linear' | 'catmullrom' | 'bezier' | 'step'
	cooldown?: boolean
	bezier_linked: boolean
	bezier_left_time: ArrayVector3
	bezier_right_time: ArrayVector3
	bezier_left_value: ArrayVector3
	bezier_right_value: ArrayVector3
	selected: boolean
	transform: boolean
	has_expressions: boolean

	extend(data: KeyframeOptions): this
	get(axis: axisLetter, data_point?: number): number | string
	calc(axis: axisLetter, data_point?: number): number
	set(axis: axisLetter, value: any, data_point?: number): this
	offset(axis: axisLetter, amount: any, data_point?: number): void
	flip(axis: axisLetter): this
	getLerp(other: _Keyframe, axis: axisLetter, amount: number, allow_expression?: boolean): number
	getCatmullromLerp(
		before_plus: _Keyframe,
		before: _Keyframe,
		after: _Keyframe,
		after_plus: _Keyframe,
		axis: axisLetter,
		alpha: number
	): number
	getArray(data_point?: number): (number | string)[]
	getFixed(
		data_point?: number,
		get_quaternion?: boolean
	): THREE.Vector3 | THREE.Euler | THREE.Quaternion
	getTimecodeString(): string
	compileBedrockKeyframe(): any
	replaceOthers(save: any): void
	select(event?: any): this
	callPlayhead(): this
	showContextMenu(event: Event): this
	remove(): void
	forSelected(callback: (keyframe: _Keyframe) => void, undo_tag: any): this[]
	getUndoCopy(save: any): {
		animator: any
		channel?: string | null
		data_points: KeyframeDataPoint[]
	}
}

declare function updateKeyframeSelection(): void
