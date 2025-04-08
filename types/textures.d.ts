/// <reference path="./blockbench.d.ts"/>

import type { FSWatcher } from 'fs'
import type { ShaderMaterial } from 'three'

declare global {
	interface TextureData {
		path?: string
		uuid?: string
		name?: string
		/**
		 * Relative path to the file's directory, used by some formats such as Java Block/Item
		 * */
		folder?: string
		namespace?: string
		/**
		 * Texture ID or key, used by some formats. By default this is a number that increases with every texture that is added
		 * */
		id?: string
		/**
		 * Whether the texture is used for the models particle system. Used by some formats such as Java Block/Item
		 * */
		particle?: boolean
		visible?: boolean
		render_mode?: 'default' | 'emissive' | 'additive' | 'layered' | string
		render_sides?: 'auto' | 'front' | 'double' | string
		pbr_channel?: 'color' | 'normal' | 'height' | 'mer'

		/**
		 * Texture animation frame time
		 * */
		frame_time?: number
		frame_order_type?: 'custom' | 'loop' | 'backwards' | 'back_and_forth'
		/**
		 * Custom frame order
		 * */
		frame_order?: string
		/**
		 * Interpolate between frames
		 * */
		frame_interpolate?: boolean
		/**
		 * Whether the texture is saved
		 */
		saved?: boolean
		/**
		 * Flag to indicate that the texture was manually resized, and on load it should not try to automatically adjust UV size
		 */
		keep_size?: boolean
		source?: string
		width?: number
		height?: number
		standalone?: boolean
		relative_path?: string
	}
	interface TextureEditOptions {
		/**
		 * Edit method. 'canvas' is default
		 */
		method?: 'canvas' | 'jimp'
		/**
		 * Name of the undo entry that is created
		 */
		edit_name?: string
		/**
		 * Whether to use the cached canvas/jimp instance
		 */
		use_cache?: boolean
		/**
		 * If true, no undo point is created. Default is false
		 */
		no_undo?: boolean
		/**
		 * If true, the texture is not updated visually
		 */
		no_update?: boolean
		no_undo_init?: boolean
		no_undo_finish?: boolean
	}

	/**
	 * A texture combines the functionality of material, texture, and image, in one. Textures can be linked to files on the local hard drive, or hold the information in RAM.
	 */
	class Texture {
		constructor(data?: TextureData, uuid?: string)
		readonly frameCount: number | undefined
		readonly display_height: number
		readonly ratio: number
		static selected?: Texture

		path?: string
		name: string
		/** Relative path to the file's directory, used by some formats such as Java Block/Item*/
		folder: string
		namespace: string
		/** Texture ID or key, used by some formats. By default this is a number that increases with every texture that is added */
		id: string
		/** Whether the texture is used for the models particle system. Used by some formats such as Java Block/Item */
		particle: boolean
		render_mode: 'default' | 'emissive' | 'additive' | 'layered' | string
		render_sides: 'auto' | 'front' | 'double' | string
		pbr_channel: 'color' | 'normal' | 'height' | 'mer'

		/** Texture animation frame time */
		frame_time: number
		frame_order_type: 'custom' | 'loop' | 'backwards' | 'back_and_forth'
		/** Custom frame order */
		frame_order: string
		/** Interpolate between frames */
		frame_interpolate: boolean

		/** HTML-style source of the texture's displayed data. Can be a path (desktop app only), or a base64 data URL */
		source: string
		selected?: boolean
		show_icon: boolean
		error: number
		/** Whether the texture is visible. Used for layered textures mode */
		visible: boolean

		width: number
		height: number
		uv_width: number
		uv_height: number
		currentFrame: number
		saved: boolean
		/**
		 * Whether the latest version of the texture is currently loaded from and linked to a file on disk, or held in memory as bitmap data
		 * @deprecated Use {@link Texture.internal} instead
		 */
		mode: never
		/**
		 * If true, the texture is loaded internally. If false, the texture is loaded directly from a file
		 */
		internal: boolean
		uuid: UUID

		/**
		 * Texture selection in paint mode
		 */
		selection: IntMatrix
		layers: TextureLayer[]
		layers_enabled: boolean
		/**
		 * The UUID of the project to sync the texture to
		 */
		sync_to_project: UUID | ''

		/**
		 * The texture's associated canvas. Since 4.9, this is the main source of truth for textures in internal mode.
		 */
		canvas: HTMLCanvasElement
		/**
		 * The 2D context of the texture's associated canvas.
		 */
		ctx: CanvasRenderingContext2D
		/**
		 * Texture image element
		 */
		img: HTMLImageElement

		relative_path?: string
		get material(): THREE.ShaderMaterial
		set material(value: THREE.ShaderMaterial)

		getErrorMessage(): string
		extend(data: TextureData): this

		/**
		 * Get the UV width of the texture if the format uses per texture UV size, otherwise get the project texture width
		 */
		getUVWidth(): number
		/**
		 * Get the UV height of the texture if the format uses per texture UV size, otherwise get the project texture height
		 */
		getUVHeight(): number
		getUndoCopy(bitmap?: boolean): any
		getSaveCopy(bitmap?: boolean): any
		/**
		 * Start listening for changes to the linked file. Desktop only
		 */
		startWatcher(): void
		/**
		 * Stop listening for changes to the linked file. Desktop only
		 */
		stopWatcher(): void
		/**
		 * Generate the Java Block/Item folder property from the file path
		 */
		generateFolder(): void
		/**
		 * Loads the texture from it's current source
		 * @param cb Callback function
		 */
		load(cb?: () => {}): this
		fromJavaLink(link: string, path_array: string[]): this
		fromFile(file: { name: string; content?: string; path: string }): this
		fromPath(path: string): this
		/**
		 * Loads file content **only**.
		 *
		 * Does not read `png.mcmeta`, or attempt to overwrite an existing texture in the project with the same name.
		 *
		 * Used internally when loading `.bbmodel` files
		 * @param path
		 */
		loadContentFromPath(path: string): this
		fromDataURL(data_url: string): this
		fromDefaultPack(): true | undefined
		/**
		 * Loads the default white error texture
		 * @param error_id Sets the error ID of the texture
		 */
		loadEmpty(error_id?: number): this

		updateSource(dataUrl: string): this
		updateMaterial(): this

		/**
		 * Opens a dialog to replace the texture with another file
		 * @param force If true, no warning appears of the texture has unsaved changes
		 */
		reopen(force: boolean): void
		/**
		 * Reloads the texture. Only works in the desktop app
		 */
		reloadTexture(): void
		/**
		 * Get the material that the texture displays. When previewing PBR, this will return the shared PBR material
		 */
		getMaterial(): THREE.ShaderMaterial | THREE.MeshStandardMaterial
		/**
		 * Get the texture's own material
		 */
		getOwnMaterial(): THREE.ShaderMaterial
		/**
		 * Selects the texture
		 * @param event Click event during selection
		 */
		select(event?: Event): this
		/**
		 * Adds texture to the textures list and initializes it
		 * @param undo If true, an undo point is created
		 */
		add(undo?: boolean): Texture
		/**
		 * Removes the texture
		 * @param no_update If true, the texture is silently removed. The interface is not updated, no undo point is created
		 */
		remove(no_update?: boolean): void
		toggleVisibility(): this
		enableParticle(): this
		/**
		 * Enables 'particle' on this texture if it is not enabled on any other texture
		 */
		fillParticle(): this
		/**
		 * Applies the texture to the selected elements
		 * @param all If true, the texture is applied to all faces of the elements. If 'blank', the texture is only applied to blank faces
		 */
		apply(all?: true | false | 'blank'): this
		/**
		 * Shows the texture file in the file explorer
		 */
		openFolder(): this
		/**
		 * Opens the texture in the configured image editor
		 */
		openEditor(): this
		showContextMenu(event: MouseEvent): void
		openMenu(): void
		resizeDialog(): this
		/**
		 * Scroll the texture list to this texture
		 */
		scrollTo(): void
		save(as?: any): this
		/**
		 * Returns the content of the texture as PNG as a base64 encoded string
		 */
		getBase64(): string
		/**
		 * Returns the content of the texture as PNG as a base64 encoded data URL
		 */
		getDataURL(): string
		/**
		 * Wrapper to do edits to the texture.
		 * @param callback
		 * @param options Editing options
		 */
		edit(
			callback?: (instance: HTMLCanvasElement | any) => void | HTMLCanvasElement,
			options?: TextureEditOptions
		): void
		menu: Menu
		/**
		 * Get the selected layer. If no layer is selected, returns the bottom layer
		 */
		getActiveLayer(): TextureLayer
		activateLayers(undo?: boolean): void
		/**
		 * Turns the texture selection into a layer
		 * @param undo Whether to create an undo entry
		 * @param clone When true, the selection is copied into the new layer and also left on the original layer
		 */
		selectionToLayer(undo?: boolean, clone?: boolean): void
		javaTextureLink(): string

		getMCMetaContent(): {
			animation?: {
				frametime: number
				width?: number
				height?: number
				interpolate?: boolean
				frames?: number[]
			}
		}
		getAnimationFrameIndices(): number[]

		exportEmissionMap(): void

		convertToInternal(data_url?: string): this
		/**
		 * Redraws the texture content from the layers
		 * @param update_data_url If true, the texture source gets updated as well. This is slower, but is necessary at the end of an edit. During an edit, to preview changes, this can be false
		 */
		updateLayerChanges(update_data_url?: boolean): void
		/**
		 * Update everything after a content edit to the texture or one of the layers. Updates the material, the layers, marks the texture as unsaved, syncs changes to other projects
		 */
		updateChangesAfterEdit(): void
		/**
		 * Update the attached img element with the content from the texture's canvas
		 */
		updateImageFromCanvas(): void
		/**
		 * If layers are enabled, returns the active layer, otherwise returns the texture. Either way, the 'canvas', 'ctx', and 'offset' properties can be used from the returned object
		 */
		getActiveCanvas(): Texture | TextureLayer
		/**
		 * When editing the same texture in different tabs (via Edit In Blockbench option), sync changes that were made to the texture to other projects
		 */
		syncToOtherProject(): this

		getUndoCopy(): Texture

		static all: Texture[]
		static getDefault(): Texture
	}
	/**
	 * Saves all textures
	 * @param lazy If true, the texture isn't saved if it doesn't have a local file to save to
	 */
	function saveTextures(lazy?: boolean): void
	/**
	 * Update the draggable/sortable functionality of the texture list
	 */
	function loadTextureDraggable(): void
	/**
	 * Unselect all textures
	 */
	function unselectTextures(): void

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
		getBoundingRect(respect_empty: boolean): Rectangle
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
		const interval: any
		function start(): void
		function stop(): void
		function toggle(): void
		function updateSpeed(): void
		function nextFrame(): void
		function reset(): void
		function updateButton(): void
	}
}
