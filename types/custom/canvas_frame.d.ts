/**
 * Wrapper for HTML canvases to simplify loading and modifying images
 */
declare class CanvasFrame {
	readonly width: number
	readonly height: number
	canvas: HTMLCanvasElement
	ctx: CanvasRenderingContext2D

	constructor(a: HTMLCanvasElement)
	constructor(a: HTMLImageElement)
	constructor(a: number, b: number)

	createCanvas(width: number, height: number): void
	loadFromUrl(url: string): Promise<void>
	loadFromImage(img: HTMLImageElement): void
	/**
	 * Crop the image to only pixels that have an alpha value
	 */
	autoCrop(): void
}
