import saveAs from 'file-saver'
import StateMemory from './util/state_memory'
import { pathToExtension } from './util/util';
import { app, currentwindow, electron, fs, ipcRenderer, webUtils } from './native_apis';

function isStreamerMode(): boolean {
	// @ts-ignore
	return window.settings.streamer_mode.value;
}

declare class Blockbench {
	static isTouch: boolean
	static showMessageBox(options: any): void
	static showQuickMessage(message: string): void
}

export namespace Filesystem {
	export type FileResult = {
		name: string
		path: string
		content?: string | ArrayBuffer
		browser_file?: File
	}

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

	// MARK: Import
	type ReadType = 'buffer' | 'binary' | 'text' | 'image' | 'none'
	interface ReadOptions {
		readtype?: ReadType | ((file: string) => ReadType)
		errorbox?: boolean
		/** File Extensions
		 */
		extensions?: string[]
	}
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
	/**
	 * Opens a file picker dialog to import one or multiple files into Blockbench
	 * @param options Import options
	 * @param callback Callback to run once the files are imported
	 * @returns 
	 */
	export function importFile(options: ImportOptions, callback?: (files: FileResult[]) => void) {
		if (isApp) {
			let properties = [];
			if (options.multiple) {
				properties.push('openFile', 'multiSelections')
			}
			if (options.extensions[0] === 'image/*') {
				options.type = 'Images'
				options.extensions = ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif']
			}
			if (!options.startpath && options.resource_id) {
				options.startpath = StateMemory.get('dialog_paths')[options.resource_id]
			}

			let fileNames = electron.dialog.showOpenDialogSync(
				currentwindow,
				{
					title: options.title ? options.title : '',
					filters: [{
						name: options.type ? options.type : options.extensions[0],
						extensions: options.extensions
					}],
					properties: properties.length ? properties.concat(['dontAddToRecent']) : ['dontAddToRecent'],
					defaultPath: isStreamerMode()
						? app.getPath('desktop')
						: options.startpath
				}
			)
			if (!fileNames) return;
			if (options.resource_id) {
				StateMemory.get('dialog_paths')[options.resource_id] = PathModule.dirname(fileNames[0])
				StateMemory.save('dialog_paths')
			}
			readFile(fileNames, options, callback)
		} else {
			let isIOS =  ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(navigator.platform) ||
				(navigator.userAgent.includes("Mac") && "ontouchend" in document);

			let element = Interface.createElement('input', {
				type: 'file',
				accept: '.'+(options.extensions ? options.extensions.join(',.'): ''),
				multiple: options.multiple === true ? 'true' : 'false',
				'@change'(event: Event) {
					readFile(this.files, options, callback);

				}
			}) as HTMLInputElement;
			
			if ((isIOS || Blockbench.isTouch) && options.extensions && options.extensions.length > 1) {
				let ext_options = {};
				options.extensions.forEach(extension => {
					ext_options[extension] = extension;
				})
				new Dialog({
					id: 'import_type',
					title: 'File Type',
					form: {
						extension: {label: 'File Type', type: 'select', options: ext_options}
					},
					onConfirm(formResult) {
						element.setAttribute('accept', '.'+formResult.extension);
						$(element).trigger('click');
					}
				}).show();
			} else {
				$(element).trigger('click');
			}
		}
	}

	
	// MARK: Read
	export function readFile(files: string[] | FileList, options: ReadOptions = {}, callback?: (files: FileResult[]) => void) {
		if (files == undefined) return false;
		if (typeof files == 'string') files = [files];

		let results: FileResult[] = [];
		let result_count = 0;
		let index = 0;
		let errant = false;
		let i = 0;
		if (isApp && files instanceof FileList == false) {
			if (options.readtype == 'none') {
				let results = files.map(file => {
					return {
						name: pathToName(file, true),
						path: file
					}
				})
				callback(results);
				return results;
			}
			while (index < files.length) {
				(function() {
					let this_i = index;
					let file = files[index]
					let readtype: ReadType;
					if (typeof options.readtype == 'function') {
						readtype = options.readtype(file);
					} else {
						readtype = options.readtype
					}
					let binary = (readtype === 'buffer' || readtype === 'binary');
					if (!readtype) {
						readtype = 'text';
					}

					if (readtype === 'image') {
						//
						let extension = pathToExtension(file)
						if (extension === 'tga') {
							let targa_loader = new Targa()
							targa_loader.open(file, () => {

								results[this_i] = {
									name: pathToName(file, true),
									path: file,
									content: targa_loader.getDataURL()
								}
							
								result_count++;
								if (result_count === files.length) {
									callback(results)
								}
							})

						} else {
							results[this_i] = {
								name: pathToName(file, true),
								path: file,
								content: file
							}
							result_count++;
							if (result_count === files.length) {
								callback(results)
							}
						}
					} else /*text*/ {
						let data;
						try {
							data = fs.readFileSync(file, readtype == 'text' ? 'utf8' : undefined);
						} catch(err) {
							console.error(err)
							if (!errant && options.errorbox !== false) {
								Blockbench.showMessageBox({
									translateKey: 'file_not_found',
									message: tl('message.file_not_found.message') + '\n\n```' + file.replace(/[`"<>]/g, '') + '```',
									icon: 'error_outline',
									width: 520
								})
							}
							errant = true;
							return;
						}
						if (binary) {
							let ab = new ArrayBuffer(data.length);
							let view = new Uint8Array(ab);
							for (let i = 0; i < data.length; ++i) {
								view[i] = data[i];
							}
							data = ab;
						}
						if (!binary && data.charCodeAt(0) === 0xFEFF) {
							data = data.substr(1)
						}
						results[this_i] = {
							name: pathToName(file, true),
							path: file,
							content: data
						}
						result_count++;
						if (result_count === files.length) {
							callback(results)
						}
					}
				})()
				index++;
			}
		} else {
			let i = 0;
			for (let file of (files as FileList)) {
				let reader = new FileReader()
				reader.onloadend = function() {
					let result;
					if (typeof reader.result != 'string' && reader.result.byteLength && pathToExtension(name) === 'tga') {
						let arr = new Uint8Array(reader.result)
						let targa_loader = new Targa()
						targa_loader.load(arr)
						result = targa_loader.getDataURL()
					} else {
						result = reader.result
					}
					results[i] = {
						name,
						path: name,
						content: result,
						browser_file: file
					}
					result_count++;
					if (result_count === files.length) {
						callback(results)
					}
				}
				let name = file.name;
				if (pathToExtension(name) === 'txt' && !(options && options.extensions instanceof Array && options.extensions.includes('txt'))) {
					name = name.replace(/\.txt$/i, '');
				}
				let readtype = options.readtype;
				if (typeof readtype == 'function') {
					readtype = readtype(name);
				}
				if (readtype === 'image') {
					if (pathToExtension(name) === 'tga') {
						reader.readAsArrayBuffer(file)
					} else {
						reader.readAsDataURL(file)
					}
				} else if (readtype === 'buffer' || readtype === 'binary') {
					reader.readAsArrayBuffer(file)
				} else /*text*/ {
					reader.readAsText(file)
				}
				i++;
			}
		}
	}
	export const read = readFile;

	

	
	// MARK: Pick Directory
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
	export function pickDirectory(options: PickDirOptions = {}): string | undefined {
		if (isApp) {

			if (!options.startpath && options.resource_id) {
				options.startpath = StateMemory.get('dialog_paths')[options.resource_id]
			}

			let dirNames = electron.dialog.showOpenDialogSync(currentwindow, {
				title: options.title ? options.title : '',
				properties: ['openDirectory', 'dontAddToRecent'],
				defaultPath: isStreamerMode()
					? app.getPath('desktop')
					: options.startpath
			})

			if (!dirNames) return null;

			if (options.resource_id) {
				StateMemory.get('dialog_paths')[options.resource_id] = PathModule.dirname(dirNames[0]);
				StateMemory.save('dialog_paths');
			}

			return dirNames[0];

		} else {

			console.warn('Picking directories is currently not supported in the web app');

		}
	}

	// MARK: Export
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
		 * Directory path where the file dialog opens
		 */
		startpath?: string
		/**
		 * The resource identifier group, used to allow the file dialog (open and save) to remember where it was last used
		 */
		resource_id?: string
	}
	/**
	 * Open a file save dialog to let the user pick a location and name to save a file. On the web app, this might save the file directoy into the downloads folder depending on browser settings.
	 * @param options Export options
	 * @param callback Callback to run once the file is saved
	 * @returns 
	 */
	export function exportFile(options: ExportOptions, callback?: (file_path: string) => void) {
		/*	
			type
			extensions
			name
			content
			startpath
			savetype
			project_file
			custom_writer
			resource_id
		*/
		if (!isApp) {
			let file_name = options.name || 'file';
			let extension = pathToExtension(file_name);
			if (options.extensions instanceof Array && !options.extensions.includes(extension) && options.extensions[0]) {
				file_name += '.' + options.extensions[0];
			}
			if (options.custom_writer) {
				options.custom_writer(options.content, file_name)
				
			} else {

				if (options.savetype === 'image') {
					saveAs(options.content, file_name, {})

				} else if (options.savetype === 'zip' || options.savetype === 'buffer' || options.savetype === 'binary') {
					let blob = options.content instanceof Blob
							 ? options.content
							 : new Blob([options.content], {type: "octet/stream"});
					saveAs(blob, file_name)

				} else {
					let type = 'text/plain;charset=utf-8';
					if (file_name.endsWith('json')) {
						type = 'application/json;charset=utf-8';
					} else if (file_name.endsWith('bbmodel')) {
						type = 'model/vnd.blockbench.bbmodel';
					}
					let blob = new Blob([options.content], {type});
					saveAs(blob, file_name, {autoBOM: true})
				}

			}
			if (typeof callback === 'function') {
				callback(file_name)
			}
		} else {
			if (!options.startpath && options.resource_id) {
				options.startpath = StateMemory.get('dialog_paths')[options.resource_id]
				if (options.name) {
					options.startpath += osfs + options.name + (options.extensions ? '.'+options.extensions[0] : '');
				}
			}
			let file_path = electron.dialog.showSaveDialogSync(currentwindow, {
				filters: [ {
					name: options.type,
					extensions: options.extensions
				} ],
				properties: ['dontAddToRecent'],
				defaultPath: isStreamerMode()
					? app.getPath('desktop')
					: ((options.startpath && options.startpath !== 'Unknown')
						? options.startpath.replace(/\.\w+$/, '')
						: options.name)
			})
			if (!file_path) return;
			if (options.resource_id) {
				StateMemory.get('dialog_paths')[options.resource_id] = PathModule.dirname(file_path)
				StateMemory.save('dialog_paths')
			}
			let extension = pathToExtension(file_path);
			if (options.extensions instanceof Array && !options.extensions.includes(extension) && options.extensions[0]) {
				file_path += '.'+options.extensions[0]
			}
			writeFile(file_path, options, callback)
		}
	}


	// MARK: Write
	type WriteType = 'text' | 'buffer' | 'binary' | 'zip' | 'image'
	interface WriteOptions {
		content?: string | ArrayBuffer | Blob
		savetype?: WriteType | ((file: string) => WriteType)
		custom_writer?: (content: string | ArrayBuffer | Blob, file_path: string, callback?: (file_path: string) => void) => void
	}
	/**
	 * Writes a file to the file system. Desktop app only.
	 */
	export function writeFile(
		file_path: string,
		options: WriteOptions,
		callback?: (file_path: string) => void
	) {
		if (!isApp || !file_path) {
			return;
		}
		if (options.savetype === 'image' && typeof options.content === 'string') {
			if (options.content.substr(0, 10) === 'data:image') {
				fs.writeFileSync(file_path, options.content.split(',')[1], {encoding: 'base64'})
				if (callback) callback(file_path)
			} else {
				let path = options.content.replace(/\?\d+$/, '');
				if (PathModule.relative(path, file_path)) {
					fs.copyFileSync(path, file_path);
				}
				if (callback) callback(file_path)
			}
			return;
		}
		if (options.custom_writer) {
			options.custom_writer(options.content, file_path, callback)

		} else if (options.savetype === 'zip') {
			let fileReader = new FileReader();
			fileReader.onload = function(event) {
				let buffer = Buffer.from(new Uint8Array(this.result as ArrayBuffer));
				fs.writeFileSync(file_path, buffer)
				if (callback) {
					callback(file_path)
				}
			};
			fileReader.readAsArrayBuffer(options.content as Blob);

		} else {
			//text or binary
			let content = options.content;
			if (content instanceof ArrayBuffer) {
				content = Buffer.from(content);
			}
			fs.writeFileSync(file_path, content as string)
			if (callback) {
				callback(file_path)
			}
		}
	}


	// MARK: Open
	export function showFileInFolder(path: string) {
		ipcRenderer.send('show-item-in-folder', path);
	}



	// MARK: Find
	interface FindFileOptions {
		recursive: boolean
		filter_regex: RegExp
		priority_regex?: RegExp
		json?: boolean
		read_file?: boolean
	}
	/**
	 * Find a file in a directory based on content within the file, optionally optimized via file name match
	 * @param {string[]} base_directories List of base directory paths to search in
	 */
	export function findFileFromContent(
		base_directories: string[],
		options: FindFileOptions,
		check_file: (path: string, content: string|object) => boolean
	) {
		let deprioritized_files = [];

		function checkFile(path) {
			try {
				let content: string;
				if (options.read_file !== false) content = fs.readFileSync(path, 'utf-8');
				
				return check_file(path, options.json ? autoParseJSON(content, false) : content);

			} catch (err) {
				console.error(err);
				return false;
			}
		}

		let searchFolder = (path: string) => {
			let files;
			try {
				files = fs.readdirSync(path, {withFileTypes: true});
			} catch (err) {
				files = [];
			}
			for (let dirent of files) {
				if (dirent.isDirectory()) continue;

				if (!options.filter_regex || options.filter_regex.exec(dirent.name)) {
					let new_path = path + osfs + dirent.name;
					if (!options.priority_regex || options.priority_regex.exec(dirent.name)) {
						// priority checking
						let result = checkFile(new_path);
						if (result) return result;
					} else {
						deprioritized_files.push(new_path);
					}
				}
			}
			if (options.recursive !== false) {
				for (let dirent of files) {
					if (!dirent.isDirectory()) continue;

					let result = searchFolder(path + osfs + dirent.name);
					if (result) return result;
				}
			}
		}
		for (let directory of base_directories) {
			let result = searchFolder(directory);
			if (result) return result;
		}

		for (let path of deprioritized_files) {
			let result = checkFile(path);
			if (result) return result;
		}
	}


	// MARK: Drag & Drop
	interface DragHandlerOptions {
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
		element?: string | HTMLElement | (() => string | HTMLElement | boolean)
		/**
		 * If true, the drop will work on all child elements of the specified element
		 */
		propagate?: boolean
		readtype?: ReadType
		/**
		 * Whether to display an error box when importing a dragged file fails
		 */
		errorbox?: boolean
	};
	export interface DragHandler extends DragHandlerOptions {
		cb: (files: FileResult[], event: DragEvent) => void
		delete: () => void
	};
	export const drag_handlers: Record<string, DragHandler> = {};
	/**
	 * Handle files being drag & dropped into Blockbench
	 * @param id ID of the handler
	 * @param options Options
	 * @param callback Callback when a file is dropped
	 * @returns 
	 */
	export function addDragHandler(id: string, options: DragHandlerOptions, callback?: (files: FileResult[], event: DragEvent) => void): DragHandler {
		let entry: DragHandler = {
			cb: callback,
			condition: options.condition,
			extensions: options.extensions,
			delete() {
				Filesystem.removeDragHandler(id);
			}
		}
		if (options.propagate) entry.propagate = true;
		if (options.readtype) entry.readtype = options.readtype;
		if (options.errorbox) entry.errorbox = true;
		if (options.element) entry.element = options.element;

		drag_handlers[id] = entry;
		return entry;
	}
	export function removeDragHandler(id: string) {
		delete drag_handlers[id];
	}

	document.ondragover = function(event) {
		event.preventDefault()
	}
	document.body.ondrop = function(event) {
		event.preventDefault()
		let text = event.dataTransfer.getData('text/plain');

		if (text && text.startsWith('https://blckbn.ch/')) {
			let code = text.replace(/\/$/, '').split('/').last();
			$.getJSON(`https://blckbn.ch/api/models/${code}`, (model) => {
				Codecs.project.load(model, {path: ''});
			}).fail(error => {
				Blockbench.showQuickMessage('message.invalid_link')
			})
		}

		forDragHandlers(event, function(handler, el) {
			let fileNames = event.dataTransfer.files

			let paths: string[] | FileList = [];
			if (isApp) {
				for (let file of fileNames) {
					if ('path' in file) {
						// @ts-ignore
						paths.push(file.path)
					} else if (isApp) {
						// @ts-ignore
						let path = webUtils.getPathForFile(file);
						paths.push(path);
					}
				}
			} else {
				paths = fileNames;
			}
			if (!paths.length) return;

			let read_options = {
				extensions: (typeof handler.extensions == 'function' ? handler.extensions : handler.extensions) as string[],
				readtype: handler.readtype,
				errorbox: handler.errorbox,
			}
			Filesystem.read(paths, read_options, (files) => {
				handler.cb(files, event)
			})
		})
	}
	document.body.ondragenter = function(event) {
		event.preventDefault()
		forDragHandlers(event, function(handler, el) {
			//$(el).css('background-color', 'red')
		})
	}
	document.body.ondragleave = function(event) {
		event.preventDefault()
		forDragHandlers(event, function(handler, el) {
			//$(el).css('background-color', '')
		})
	}

	function forDragHandlers(event: DragEvent, cb: (handler: Filesystem.DragHandler, el: HTMLElement) => void) {
		if (event.dataTransfer == undefined || event.dataTransfer.files.length == 0 || !event.dataTransfer.files[0].name) {
			return;
		}
		for (let id in Filesystem.drag_handlers) {
			let handler = Filesystem.drag_handlers[id] 
			let el = undefined;
			if (!Condition(handler.condition)) {
				continue;
			}

			if (!handler.element) {
				el = document.body;

			} else if (typeof handler.element === 'function') {
				let result = handler.element()
				if (result === true) {
					el = $(event.target)
				} else if ($(result as HTMLElement).length) {
					el = $(result as HTMLElement).get(0);
				}

			} else if ($(handler.element as HTMLElement).get(0) === event.target) {
				el = event.target

			} else if (typeof handler.element === 'string' && $(event.target).is(handler.element)) {
				el = event.target
			} else if (handler.propagate) {
				let parent = $(handler.element as HTMLElement)
				if (parent && parent.has(event.target as HTMLElement).length) {
					el = parent;
				}
			}
			let extensions = typeof handler.extensions == 'function' ? handler.extensions() : handler.extensions;
			extensions.includes( pathToExtension(event.dataTransfer.files[0].name).toLowerCase());
			let name = event.dataTransfer.files[0].name;
			if (el && extensions.filter(ex => {
				return name.substr(-ex.length) == ex;
			}).length) {
				cb(handler, el)
				break;
			}
		}
	}
}

Object.assign(window, {
	Filesystem
})
