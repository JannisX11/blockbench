/// <reference path="./blockbench.d.ts"/>

declare namespace Blockbench {
	/**
	 * The resource identifier group, used to allow the file dialog (open and save) to remember where it was last used
	 */
	type ResourceID =
		| string
		| 'texture'
		| 'minecraft_skin'
		| 'dev_plugin'
		| 'animation'
		| 'animation_particle'
		| 'animation_audio'
		| 'theme'
		| 'model'
		| 'gltf'
		| 'obj'
		| 'preview_background'
		| 'screenshot'
		| 'palette'

	interface FileResult {
		name: string
		path: string
		content: string | ArrayBuffer
	}
	type ReadType = 'buffer' | 'binary' | 'text' | 'image'
	interface ReadOptions {
		readtype?: ReadType | ((file: string) => ReadType)
		errorbox?: boolean
	}
	/**
	 * Reads the content from the specified files. Desktop app only.
	 */
	export function read(
		files: string[],
		options?: ReadOptions,
		callback?: (files: FileResult[]) => void
	): void
	/**
	 * Reads the content from the specified files. Desktop app only.
	 */
	export function readFile(
		files: string[],
		options?: ReadOptions,
		callback?: (files: FileResult[]) => void
	): void

	type WriteType = 'buffer' | 'text' | 'zip' | 'image'
	interface WriteOptions {
		content?: string | ArrayBuffer
		savetype?: WriteType | ((file: string) => WriteType)
		custom_writer?: (content: string | ArrayBuffer, file_path: string) => void
	}
	/**
	 * Writes a file to the file system. Desktop app only.
	 */
	export function writeFile(
		file_path: string,
		options: WriteOptions,
		callback?: (file_path: string) => void
	): void

	interface PickDirOptions {
		/**Location where the file dialog starts off
		 */
		startpath?: string
		/** The resource identifier group, used to allow the file dialog (open and save) to remember where it was last used
		 */
		resource_id?: ResourceID
		/** Window title for the file picker
		 */
		title?: string
	}
	/**
	 * Pick a directory. Desktop app only.
	 */
	export function pickDirectory(options: PickDirOptions): string | undefined

	interface ImportOptions extends ReadOptions {
		/** Name of the file type
		 */
		type: string
		/** File Extensions
		 */
		extensions: string[]
		/** Allow selection of multiple elements
		 */
		multiple?: boolean
		/** File picker start path
		 */
		startpath?: string
		/** The resource identifier group, used to allow the file dialog (open and save) to remember where it was last used
		 */
		resource_id?: ResourceID
		/** Title of the file picker window
		 */
		title?: string
		/**
		 */
	}
	// @ts-ignore
	function _import(options: ImportOptions, callback?: (files: FileResult[]) => void): any
	export { _import as import }

	interface ExportOptions extends WriteOptions {
		/**
		 * Name of the file type
		 */
		type: string
		/**
		 * File extensions
		 */
		extensions: string[]
		/**
		 * Suggested file name
		 */
		name?: string
		/**
		 * Location where the file dialog starts
		 */
		startpath?: string
		/**
		 * The resource identifier group, used to allow the file dialog (open and save) to remember where it was last used
		 */
		resource_id?: string
	}
	function _export(options: ExportOptions, callback?: (file_path: string) => void): any
	export { _export as export }

	/**
	 * Adds a drag handler that handles dragging and dropping files into Blockbench
	 */
	interface DragHandlerOptions extends ReadOptions {
		/**
		 * Allowed file extensions
		 */
		extensions: string[] | (() => string[])
		/**
		 * Whether or not to enable the drag handler
		 */
		condition?: ConditionResolvable
		/**
		 * Drop target element
		 */
		element?: string | HTMLElement | (() => string | HTMLElement)
		/**
		 * If true, the drop will work on all child elements of the specified element
		 */
		propagate?: boolean
	}
	export function addDragHandler(
		id: string,
		options: DragHandlerOptions,
		callback?: () => void
	): Deletable
	export function removeDragHandler(id: string): void
}
