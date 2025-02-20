Object.assign(Blockbench, {
	import(options, cb) {
		if (typeof options !== 'object') {options = {}}
			//extensions
			//type
			//readtype
			//multiple
			//startpath
			//title
			//errorbox
			//resource_id

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
				options.startpath = StateMemory.dialog_paths[options.resource_id]
			}

			let fileNames = electron.dialog.showOpenDialogSync(
				currentwindow,
				{
					title: options.title ? options.title : '',
					dontAddToRecent: true,
					filters: [{
						name: options.type ? options.type : options.extensions[0],
						extensions: options.extensions
					}],
					properties: properties.length ? properties : undefined,
					defaultPath: settings.streamer_mode.value
						? app.getPath('desktop')
						: options.startpath
				}
			)
			if (!fileNames) return;
			if (options.resource_id) {
				StateMemory.dialog_paths[options.resource_id] = PathModule.dirname(fileNames[0])
				StateMemory.save('dialog_paths')
			}
			Blockbench.read(fileNames, options, cb)
		} else {
			let isIOS =  ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(navigator.platform) ||
				(navigator.userAgent.includes("Mac") && "ontouchend" in document);
			
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
						$('<input '+
							'type="file'+
							'" accept=".'+formResult.extension+
							'" multiple="'+(options.multiple === true)+
						'">').on('change', function(e) {
							Blockbench.read(this.files, options, cb)
						}).trigger('click');
					}
				}).show();
			} else {
				$('<input '+
					'type="file'+
					'" accept=".'+(options.extensions ? options.extensions.join(',.'): '')+
					'" multiple="'+(options.multiple === true)+
				'">').on('change', function(e) {
					Blockbench.read(this.files, options, cb)
				}).trigger('click');
			}
		}
	},
	pickDirectory(options) {
		if (typeof options !== 'object') {options = {}}
		/**
		 	resource_id
			startpath
			title
		 */

		if (isApp) {

			if (!options.startpath && options.resource_id) {
				options.startpath = StateMemory.dialog_paths[options.resource_id]
			}

			let dirNames = electron.dialog.showOpenDialogSync(currentwindow, {
				title: options.title ? options.title : '',
				dontAddToRecent: true,
				properties: ['openDirectory'],
				defaultPath: settings.streamer_mode.value
					? app.getPath('desktop')
					: options.startpath
			})

			if (!dirNames) return null;

			if (options.resource_id) {
				StateMemory.dialog_paths[options.resource_id] = PathModule.dirname(dirNames[0]);
				StateMemory.save('dialog_paths');
			}

			return dirNames[0];

		} else {

			console.warn('Picking directories is currently not supported in the web app');

		}
	},
	read(files, options, cb) {
		if (files == undefined) return false;
		if (typeof files == 'string') files = [files];

		var results = [];
		var result_count = 0;
		var index = 0;
		var errant;
		var i = 0;
		if (isApp) {
			if (options.readtype == 'none') {
				let results = files.map(file => {
					return {
						name: pathToName(file, true),
						path: file
					}
				})
				cb(results);
				return results;
			}
			while (index < files.length) {
				(function() {
					var this_i = index;
					var file = files[index]
					let readtype = options.readtype;
					if (typeof readtype == 'function') {
						readtype = readtype(file);
					}
					var binary = (readtype === 'buffer' || readtype === 'binary');
					if (!readtype) {
						readtype = 'text';
					}

					if (readtype === 'image') {
						//
						var extension = pathToExtension(file)
						if (extension === 'tga') {
							var targa_loader = new Targa()
							targa_loader.open(file, () => {

								results[this_i] = {
									name: pathToName(file, true),
									path: file,
									content: targa_loader.getDataURL()
								}
							
								result_count++;
								if (result_count === files.length) {
									cb(results)
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
								cb(results)
							}
						}
					} else /*text*/ {
						var data;
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
							var ab = new ArrayBuffer(data.length);
							var view = new Uint8Array(ab);
							for (var i = 0; i < data.length; ++i) {
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
							cb(results)
						}
					}
				})()
				index++;
			}
		} else {
			while (i < files.length) {
				(function() {
					var file = files[i]
					var reader = new FileReader()
					reader.i = i;
					reader.onloadend = function() {

						if (reader.result.byteLength && pathToExtension(name) === 'tga') {
							var arr = new Uint8Array(reader.result)
							var targa_loader = new Targa()
							targa_loader.load(arr)
							var result = targa_loader.getDataURL()
						} else {
							var result = reader.result
						}
						results[this.i] = {
							name,
							path: name,
							content: result,
							browser_file: file
						}
						result_count++;
						if (result_count === files.length) {
							cb(results)
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
				})()
			}
		}
	},
	readFile(...args) {
		return Blockbench.read(...args);
	},
	export(options, cb) {
		if (!options) return;
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
		if (Blockbench.isWeb) {
			var file_name = options.name || 'file';
			var extension = pathToExtension(file_name);
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
							 : new Blob(options.content, {type: "octet/stream"});
					saveAs(blob, file_name)

				} else {
					let type = 'text/plain;charset=utf-8';
					if (file_name.endsWith('json')) {
						type = 'application/json;charset=utf-8';
					} else if (file_name.endsWith('bbmodel')) {
						type = 'model/vnd.blockbench.bbmodel';
					}
					var blob = new Blob([options.content], {type});
					saveAs(blob, file_name, {autoBOM: true})
				}

			}
			if (typeof cb === 'function') {
				cb(file_name)
			}
		} else {
			if (!options.startpath && options.resource_id) {
				options.startpath = StateMemory.dialog_paths[options.resource_id]
				if (options.name) {
					options.startpath += osfs + options.name + (options.extensions ? '.'+options.extensions[0] : '');
				}
			}
			let file_path = electron.dialog.showSaveDialogSync(currentwindow, {
				dontAddToRecent: true,
				filters: [ {
					name: options.type,
					extensions: options.extensions
				} ],
				defaultPath: settings.streamer_mode.value
					? app.getPath('desktop')
					: ((options.startpath && options.startpath !== 'Unknown')
						? options.startpath.replace(/\.\w+$/, '')
						: options.name)
			})
			if (!file_path) return;
			if (options.resource_id) {
				StateMemory.dialog_paths[options.resource_id] = PathModule.dirname(file_path)
				StateMemory.save('dialog_paths')
			}
			var extension = pathToExtension(file_path);
			if (options.extensions instanceof Array && !options.extensions.includes(extension) && options.extensions[0]) {
				file_path += '.'+options.extensions[0]
			}
			Blockbench.writeFile(file_path, options, cb)
		}
	},
	writeFile(file_path, options, cb) {
		/*	
			content
			savetype
			project_file
			custom_writer
		*/
		if (!isApp || !file_path) {
			return;
		}
		if (options.savetype === 'image' && typeof options.content === 'string') {
			if (options.content.substr(0, 10) === 'data:image') {
				fs.writeFileSync(file_path, options.content.split(',')[1], {encoding: 'base64'})
				if (cb) cb(file_path)
			} else {
				let path = options.content.replace(/\?\d+$/, '');
				if (PathModule.relative(path, file_path)) {
					fs.copyFileSync(path, file_path);
				}
				if (cb) cb(file_path)
			}
			return;
		}
		if (options.custom_writer) {
			options.custom_writer(options.content, file_path, cb)

		} else if (options.savetype === 'zip') {
			var fileReader = new FileReader();
			fileReader.onload = function(event) {
				var buffer = Buffer.from(new Uint8Array(this.result));
				fs.writeFileSync(file_path, buffer)
				if (cb) {
					cb(file_path)
				}
			};
			fileReader.readAsArrayBuffer(options.content);

		} else {
			//text or binary
			let content = options.content;
			if (content instanceof ArrayBuffer) {
				content = Buffer.from(content);
			}
			fs.writeFileSync(file_path, content)
			if (cb) {
				cb(file_path)
			}
		}
	},
	//Find
	/**
	 * @callback checkFileCallback
	 * @param {{name: string, path: string, content: (string|object)}} x - test
	 */
	/**
	 * Find a file in a directory based on content within the file, optionally optimized via file name match
	 * @param {string[]} base_directories List of base directory paths to search in
	 * @param {{recursive: boolean, filter_regex: RegExp, priority_regex: RegExp, json: boolean}} options 
	 * @param {checkFileCallback} check_file 
	 */
	findFileFromContent(base_directories, options, check_file) {
		let deprioritized_files = [];

		function checkFile(path) {
			try {
				let content;
				if (options.read_file !== false) content = fs.readFileSync(path, 'utf-8');
				
				return check_file(path, options.json ? autoParseJSON(content, false) : content);

			} catch (err) {
				console.error(err);
				return false;
			}
		}

		let searchFolder = (path) => {
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
	},
	//File Drag
	addDragHandler(id, options, cb) {
		var entry = {
			cb: cb,
			condition: options.condition
		}
		if (options.extensions) {
			entry.extensions = options.extensions
		}
		if (options.propagate) entry.propagate = true;
		if (options.readtype) entry.readtype = options.readtype;
		if (options.errorbox) entry.errorbox = true;
		if (options.element) entry.element = options.element;

		entry.delete = () => {
			Blockbench.removeDragHandler(id);
		}

		this.drag_handlers[id] = entry
		return entry;
	},
	removeDragHandler(id) {
		delete this.drag_handlers[id]
	},
});


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

		let paths = [];
		if (isApp) {
			for (let file of fileNames) {
				if (file.path) {
					paths.push(file.path)
				} else if (isApp) {
					let path = webUtils.getPathForFile(file);
					paths.push(path);
				}
			}
		} else {
			paths = fileNames
		}
		if (!paths.length) return;

		Blockbench.read(paths, handler, (content) => {
			handler.cb(content, event)
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

function forDragHandlers(event, cb) {
	if (event.dataTransfer == undefined || event.dataTransfer.files.length == 0 || !event.dataTransfer.files[0].name) {
		return; 
	}
	for (var id in Blockbench.drag_handlers) {
		var handler = Blockbench.drag_handlers[id] 
		var el = undefined;
		if (!Condition(handler.condition)) {
			continue;
		}

		if (!handler.element) {
			el = $('body').get(0)

		} else if ($(handler.element).get(0) === event.target) {
			el = event.target

		} else if (typeof handler.element === 'string' && $(event.target).is(handler.element)) {
			el = event.target

		} else if (typeof handler.element === 'function') {
			var result = handler.element()
			if (result === true) {
				el = $(event.target)
			} else if ($(result).length) {
				el = $(result).get(0)
			}
		} else if (handler.propagate) {
			var parent = $(handler.element)
			if (typeof handler.element === 'function' && !result) {
				parent = $(handler.element())
			}
			if (parent && parent.has(event.target).length) {
				el = parent
			}
		}
		let extensions = typeof handler.extensions == 'function' ? handler.extensions() : handler.extensions;
		extensions.includes( pathToExtension(event.dataTransfer.files[0].name).toLowerCase());
		var name = event.dataTransfer.files[0].name;
		if (el && extensions.filter(ex => {
			return name.substr(-ex.length) == ex;
		}).length) {
			cb(handler, el)
			break;
		}
	}
}
