/// <reference types="./blockbench"/>



/**
 * An Int Matrix holds an int (unsigned 8 bit) for each pixel in a matrix, via array. The override property can be used to set an override value for the entire area. This is used for texture selections.
 */
class IntMatrix {
	constructor(width: number, height: number)
	width: number
	height: number
	array: null | Int8Array
	/**
	 * The override can be set to true to indicate that the whole texture is selected, or false, which indicates that nothing is selected. Null indicates a custom selection
	 */
	override: boolean | null
	/**
	 * True if there is a custom selection
	 */
	readonly is_custom: boolean
	/**
	 * The array does not exist by default to save memory, this activates it.
	 */
	activate(): void
	/**
	 * Get the value at the specified pixel
	 * @param x X coordinate
	 * @param y Y coordinate
	 * @returns The value of the targeted pixel
	 */
	get(x: number, y: number): number | boolean
	/**
	 * Test whether painting is allowed at a specific pixel
	 * @param x X coordinate
	 * @param y Y coordinate
	 * @returns Boolean or value of the pixel
	 */
	allow(x: number, y: number): number | boolean
	/**
	 * Get the value at the specified pixel directly without override and bounds check
	 * @param x X coordinate
	 * @param y Y coordinate
	 * @returns
	 */
	getDirect(x: number, y: number): number
	/**
	 * Return the smallest possible rectangle that contains all of the selection
	 * @param respect_empty If true, if there is no selection, the bounding box will still cover the entire area
	 */
	getBoundingRect(respect_empty: boolean = false): Rectangle
	/**
	 * Checks whether a selection is present and contains selected pixels
	 */
	hasSelection(): boolean
	/**
	 * Set the value at a specified pixel
	 * @param {*} x X coordinate
	 * @param {*} y Y coordinate
	 * @param {number} value
	 */
	set(x: number, y: number, value: number): void
	/**
	 * If there was a selection, whether override or not, clear it
	 */
	clear(): void
	/**
	 * Change override mode
	 * @param {true|false|null} value
	 * @returns
	 */
	setOverride(value: boolean | null): void
	/**
	 * Change the size of the matrix. Unless using overrides, the selection gets lost.
	 * @param {number} width
	 * @param {number} height
	 * @returns {boolean} Whether the size had to be changed
	 */
	changeSize(width: number, height: number): void
	/**
	 * Run a method on each pixel, whether selected or not
	 * @param callback Function to run per pixel
	 */
	forEachPixel(callback: (x: number, y: number, value: number, index: number) => void): void
	/**
	 * Shift custom selections by a specified offset
	 * @param offset_x
	 * @param offset_y
	 */
	translate(offset_x: number, offset_y: number): void
	/**
	 * Return the selection simplified into non-overlapping boxes. Boxes are [x, y, width, height].
	 */
	toBoxes(): [number, number, number, number][]
	/**
	 * Mask the provided canvas using the selection
	 * @param ctx Canvas 2D context
	 * @param offset Position offset of the canvas, e. g. when using a layer
	 */
	maskCanvas(ctx: CanvasRenderingContext2D, offset: ArrayVector2): void
}

/**
 * Handles playback of animated textures
 */
namespace TextureAnimator {
	const isPlaying: boolean
	let start_timecode: number
	let frame_total: number

	function start(): void
	function stop(): void
	function toggle(): void
	function updateSpeed(): void
	function reset(): void
	function updateButton(): void
	function playAnimationFrame(anim_time?: number): void
	function update(animated_textures): void

	let editor_dialog: Dialog
}
const TextureGenerator: any
