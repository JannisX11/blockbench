/// <reference path="./blockbench.d.ts"/>
interface ScreenshotOptions {
	crop?: boolean
	width?: number
	height?: number
}
interface RecordGIFOptions {
	fps: number
	format?: 'gif' | 'apng' | 'png_sequence'
	length_mode?: 'seconds' | 'frames' | 'turntable' | 'animation'
	length?: number
	pixelate?: number
	quality?: number
	background: string
	background_image?: string
	turnspeed?: string
	/** Start playing the selected animation when the animation starts */
	play?: boolean
	repeat?: any
	/** Disable all UI feedback about GIF recording */
	silent?: boolean
}
interface RecordTimelapseOptions {
	/** Destination oath */
	destination: string
	source: 'preview' | 'locked' | 'interface'
	/** Interval between frames in seconds */
	interval: number
}
type ScreenshotReturn = (dataURL: string) => void

/**
 * A global namespace handling screenshot and GIF recording utilities.
 */
declare namespace Screencam {
	/**
	 * Provided preview with anti aliasing disabled that can be used for screenshots
	 */
	const NoAAPreview: Preview
	/**
	 * Whether a timelapse is currently being recorded
	 */
	const recording_timelapse: boolean
	const gif_options_dialog: Dialog
	const gif_crop: { top: number; left: number; right: number; bottom: number }

	function screenshotPreview(
		preview: Preview,
		options: ScreenshotOptions,
		cb: ScreenshotReturn
	): void

	function fullScreen(options: ScreenshotOptions, cb: ScreenshotReturn): void

	function screenshot2DEditor(options: ScreenshotOptions, cb: ScreenshotReturn): void

	function returnScreenshot(dataUrl: any, cb: ScreenshotReturn, blob: any): void

	/**
	 * Runs callback in a clean canvas, where only the model is visible and the control gizmos are hidden
	 * @param options
	 * @param cb
	 */
	function cleanCanvas(options: any, cb: ScreenshotReturn): void

	function createGif(options: RecordGIFOptions, cb: ScreenshotReturn): void

	function recordTimelapse(options: RecordTimelapseOptions): void

	function stopTimelapse(): void
}
