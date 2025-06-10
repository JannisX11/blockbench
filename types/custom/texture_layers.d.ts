/// <reference types="three" />

interface TextureLayerData {
	name?: string
	in_limbo?: boolean
	offset?: ArrayVector2
	scale?: ArrayVector2
	opacity?: number
	visible?: boolean
	blend_mode?: 'default' | 'set_opacity' | 'color' | 'multiply' | 'add' | 'screen' | 'difference'
	image_data?: ImageData
	data_url?: string
}

/**
 * Texture layers always belong to a texture and represent the layers of the texture. Each layer has its own HTML canvas and canvas context
 */
declare class TextureLayer {
	constructor(data: TextureLayerData, texture: Texture, uuid?: string)

	name: string
	uuid: UUID
	texture: Texture
	canvas: HTMLCanvasElement
	ctx: CanvasRenderingContext2D
	in_limbo: boolean
	img: HTMLImageElement
	/**
	 * Layer offset from the top left corner of the texture to the top left corner of the layer
	 */
	offset: ArrayVector2
	/**
	 * Layer scale. This is only used by the layer transform tool and should be applied and reset to 1x1 before doing further changes
	 */
	scale: ArrayVector2
	opacity: number
	visible: boolean
	blend_mode: 'default' | 'set_opacity' | 'color' | 'multiply' | 'add' | 'screen' | 'difference'

	extend(data: TextureLayerData): void
	/**
	 * Selects the layer
	 */
	select(): void
	showContextMenu(event: Event): void
	/**
	 * Remove the layer
	 * @param undo Create an undo point and update the texture
	 */
	remove(undo: boolean): void
	getUndoCopy(image_data: boolean): object
	getSaveCopy(): object
	/**
	 * Set the layer into a limbo state, where clicking Place or clicking next to the layer will place it on the layer below
	 */
	setLimbo(): void
	/**
	 * Resolves the limbo state by turning the limbo layer into a full layer, or merging it into the layer below
	 * @param keep_separate If true, the layer is kept as a separate layer
	 */
	resolveLimbo(keep_separate: boolean): void
	/**
	 * Set the layer size. This resizes the canvas, which discards the layer content
	 */
	setSize(width: number, height: number): void
	/**
	 * Toggle layer visibility. This creates an undo point
	 */
	toggleVisibility(): void
	/**
	 * Scroll the layer panel list to
	 */
	scrollTo(): void
	/**
	 * Add the layer to the associated texture above the previously selected layer, select this layer, and scroll the layer panel list to it
	 */
	addForEditing(): void
	/**
	 * Merge this texture onto the texture below
	 * @param undo Create an undo entry
	 */
	mergeDown(undo: boolean): void
	/**
	 * Expand the layer to include the listed pixels
	 * @param points
	 */
	expandTo(...points: ArrayVector2): void
	/**
	 * Flip the texture along an axis
	 * @param axis Flip axis, where 0 is X and 1 is Y
	 * @param undo Create an undo entry
	 */
	flip(axis: number, undo: boolean): void
	/**
	 * Rotate the layer around itself in 90 degree steps
	 * @param angle Angle in degrees
	 * @param undo Create an undo entry
	 */
	rotate(angle: number, undo: boolean): void
	/**
	 * Centers the layer on the texture
	 */
	center(): void
	/**
	 * Open the properties dialog
	 */
	propertiesDialog(): void

	/**
	 * Get all layers of the active texture
	 */
	static all: TextureLayer[]
	/**
	 * Get the selected layer
	 */
	static selected: TextureLayer
}
