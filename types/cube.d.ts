/// <reference path="./blockbench.d.ts"/>
type CardinalDirection = 'north' | 'south' | 'east' | 'west' | 'up' | 'down'

interface ICubeOptions {
	name?: string
	autouv?: 0 | 1 | 2
	shade?: boolean
	mirror_uv?: boolean
	inflate?: number
	color?: number
	visibility?: boolean
	from?: ArrayVector3
	to?: ArrayVector3
	rotation?: ArrayVector3
	origin?: ArrayVector3
	box_uv?: boolean
	/**
	 * UV position for box UV mode
	 */
	uv_offset?: ArrayVector2
	faces?: Partial<Record<CardinalDirection, CubeFaceOptions>>
}

declare class Cube extends OutlinerElement {
	constructor(options: ICubeOptions, uuid?: string)
	name: string
	uuid: string
	color: any
	/**
	 * Auto UV setting, saved as an integer, where 0 means disabled, 1 means enabled, and 2 means relative auto UV (cube position affects UV)
	 */
	autouv: 0 | 1 | 2
	/**
	 * Enable or disable shading based on face normal
	 */
	shade: boolean
	/**
	 * UV mirror across the X axis when using Box UV
	 */
	mirror_uv: boolean
	/**
	 * Inflate adds an inflation value to all sides equally
	 */
	inflate: number
	/**
	 * Visibility of the cube in the viewport
	 */
	visibility: boolean
	from: ArrayVector3
	to: ArrayVector3
	rotation: ArrayVector3
	origin: ArrayVector3
	faces: {
		[fkey: string]: CubeFace
	}
	rescale?: boolean
	rotation_axis: 'x' | 'y' | 'z'
	/**
	 * UV position for box UV mode
	 */
	uv_offset: ArrayVector2
	mesh: THREE.Mesh & {
		outline: THREE.Mesh
		geometry: THREE.BufferGeometry & {
			faces: string[]
		}
	}

	extend(options: ICubeOptions): this
	/**
	 * Calculates and returns the size of a cube across a certain axis. If the axis argument is omitted, it returns all sizes as an array vector.
	 */
	size(axis?: number, floored?: boolean): number | ArrayVector3
	rotationAxis(): string
	getUndoCopy(aspects?: any): void
	getSaveCopy(project?: boolean): Cube
	/**
	 * Rotate the cube around axis in 90 degree steps
	 * @param axis Axis index
	 * @param steps Number of steps
	 * @param origin Rotation pivot
	 */
	roll(axis: number, steps: number, origin: ArrayVector3): void
	flip(axis: number, center: number, skipUV?: boolean): void
	/**
	 * Transfer the origin to a new position, while updating from and to to keep the same visual position.
	 */
	transferOrigin(origin: ArrayVector3, update?: boolean): void
	getWorldCenter(): THREE.Vector3
	getGlobalVertexPositions(): ArrayVector3[]
	setUVMode(box_uv: boolean): void
	setColor(color: number): void
	applyTexture(texture: Texture, faces: true | undefined | CubeFaceDirection[]): void
	mapAutoUV(): void
	moveVector(offset: ArrayVector3, axis: number, update?: boolean): void
	resize(
		value: number,
		axis: number,
		negative: boolean,
		allow_negative?: boolean,
		bidirectional?: boolean
	): void

	static all: Cube[]
	static selected: Cube[]
	/**Check if any elements of the type are in the project */
	static hasAny: () => boolean
	/**Check if any elements of the type are currently selected */
	static hasSelected: () => boolean
	preview_controller: NodePreviewController
	static preview_controller: NodePreviewController
}

interface FaceOptions {
	texture?: Texture
}
declare class Face {
	constructor()
	texture: UUID | false | undefined

	getTexture(): Texture | undefined
	/**
	 * Returns a 2D rectangle around the UV face
	 */
	getBoundingRect(): any
	reset(): void
	/**
	 * Returns a save copy of the face, ready for serialization. Set project to true to save for a bbmodel project file
	 */
	getSaveCopy(project?: boolean): any
	/**
	 * Get a copy for undo tracking
	 */
	getUndoCopy(): Face
}

type CubeFaceDirection = 'north' | 'south' | 'east' | 'west' | 'up' | 'down'
interface CubeFaceOptions extends FaceOptions {
	uv?: [number, number, number, number]
	rotation?: number
	tint?: number
	cullface?: CubeFaceDirection | ''
	material_name?: string
	enabled?: boolean
}
declare class CubeFace extends Face {
	constructor(direction: CubeFaceDirection, data: CubeFaceOptions, cube: Cube)
	cube: Cube
	direction: CubeFaceDirection
	uv: [number, number, number, number]
	uv_size: readonly [number, number]
	rotation: number
	tint: number
	cullface: CubeFaceDirection | ''
	material_name: string
	enabled: boolean

	extend(data: CubeFaceOptions): void
	getVertexIndices(): [number, number, number, number]
}
