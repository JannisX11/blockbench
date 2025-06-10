/// <reference path="./blockbench.d.ts"/>
/**
 * A global namespace containing various functionality for Blockbench's 2D and 3D paint tools and texture editor
 */
declare namespace Painter {
	const currentPixel: ArrayVector2
	const brushChanges: boolean
	const current: any
	const selection: any
	const mirror_painting: boolean
	const lock_alpha: boolean
	const erase_mode: boolean
	const default_brush_presets: any[]

	function edit(
		texture: Texture,
		callback: (canvas: HTMLCanvasElement) => void,
		options: TextureEditOptions
	): void
	function setAlphaMatrix(texture: Texture, x: number, y: number, val: number): void
	function getAlphaMatrix(texture: Texture, x: number, y: number): number

	function combineColors(base: RGBAColor, added: RGBAColor, opacity: number): RGBAColor
	function blendColors(
		base: RGBAColor,
		added: RGBAColor,
		opacity: number,
		blend_mode: string
	): RGBAColor
	function getMirrorElement(element: OutlinerElement, symmetry_axes: number[]): void
	function updateNslideValues(): void
	function getBlendModeCompositeOperation(): string
	function getCanvas(texture: Texture): HTMLCanvasElement
	function scanCanvas(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		cb: () => void
	): void
	function getPixelColor(ctx: CanvasRenderingContext2D, x: number, y: number): void
	function modifyCanvasSection(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		cb: () => void
	): void
	function editCircle(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		r: number,
		softness: number,
		editPx: (RGBAColor: any, opacity: number, px: number, py: number) => RGBAColor
	): void
	function editSquare(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		r: number,
		softness: number,
		editPx: (RGBAColor: any, opacity: number, px: number, py: number) => RGBAColor
	): void
	function openBrushOptions(): void
	function loadBrushPreset(preset: any): void
}
