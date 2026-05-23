/// <reference types="./blockbench"/>
/**
 * A global namespace containing various functionality for Blockbench's 2D and 3D paint tools and texture editor
 */
declare namespace Painter {
	const currentPixel: ArrayVector2
	const brushChanges: boolean
	let current: any
	const selection: any
	const mirror_painting: boolean
	const lock_alpha: boolean
	const erase_mode: boolean
	const default_brush_presets: any[]
	let screen_space_brush_cursor: HTMLElement

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
	function getBlendModeCompositeOperation(blend_mode?: string): string
	function getCanvasToolPixelCoords(uv_point: {x: number, y: number}, texture: Texture): ArrayVector2
	function getCanvas(texture: Texture): HTMLCanvasElement
	function copyCanvas(original_canvas: HTMLCanvasElement): HTMLCanvasElement
	function scanCanvas(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		cb: ((px: number, py: number, color: [r: number, g: number, b: number, a: number]) => [number, number, number, number] | void)
	): void
	function getPixelColor(ctx: CanvasRenderingContext2D, x: number, y: number): tinycolor
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

	declare interface BarItemRegistry {
		paint_secondary_color: KeybindItem
		pan_tool: Tool
		brush_tool: Tool
		copy_brush: Tool
		fill_tool: Tool
		eraser: Tool
		color_picker: Tool
		draw_shape_tool: Tool
		gradient_tool: Tool
		move_layer_tool: Tool
		brush_shape: BarSelect
		draw_shape_type: BarSelect
		blend_mode: BarSelect
		fill_mode: BarSelect
		copy_brush_mode: BarSelect
		selection_tool_operation_mode: BarSelect
		expand_texture_selection: Action
		mirror_painting: Toggle
		color_erase_mode: Toggle
		lock_alpha: Toggle
		painting_grid: Toggle
		image_tiled_view: Toggle
		image_onion_skin_view: Toggle
		slider_brush_size: NumSlider
		slider_brush_softness: NumSlider
		slider_brush_opacity: NumSlider
		pixel_perfect_drawing: Toggle
		slider_color_select_threshold: NumSlider
	}