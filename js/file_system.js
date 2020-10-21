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
			var properties = []
			if (options.multiple) {
				properties.push('multiSelections')
			}
			if (options.extensions[0] === 'image/*') {
				options.type = 'Images'
				options.extensions = ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif']
			}
			if (!options.startpath && options.resource_id) {
				options.startpath = StateMemory.dialog_paths[options.resource_id]
			}

			ElecDialogs.showOpenDialog(
				currentwindow,
				{
					title: options.title ? options.title : '',
					dontAddToRecent: true,
					filters: [{
						name: options.type ? options.type : options.extensions[0],
						extensions: options.extensions
					}],
					properties: (properties.length && Blockbench.platform !== 'darwin')?properties:undefined,
					defaultPath: settings.streamer_mode.value
						? app.getPath('desktop')
						: options.startpath
				},
			function (fileNames) {
				if (!fileNames) return;
				if (options.resource_id) {
					StateMemory.dialog_paths[options.resource_id] = PathModule.dirname(fileNames[0])
					StateMemory.save('dialog_paths')
				}
				Blockbench.read(fileNames, options, cb)
			})
		} else {
			$('<input '+
				'type="file'+
				'" accept=".'+(options.extensions ? options.extensions.join(',.'): '')+
				'" multiple="'+(options.multiple === true)+
			'">').change(function(e) {
				var input = this;
				var results = [];
				var result_count = 0;
				var i = 0;
				Blockbench.read(input.files, options, cb)
			}).click()
		}
	},
	read(files, options, cb) {
		if (files == undefined) return false;
		if (typeof files == 'string') files = [files];

		var results = [];
		var result_count = 0;
		var i = 0;
		var errant;
		if (isApp) {
			while (i < files.length) {
				(function() {
					var this_i = i;
					var file = files[i]
					let readtype = options.readtype;
					if (typeof readtype == 'function') {
						readtype = readtype(file);
					} else if (readtype != 'buffer' && readtype != 'binary') {
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
								path: file
							}
							result_count++;
							if (result_count === files.length) {
								cb(results)
							}
						}
					} else /*text*/ {
						var load = function (data) {
							if ((readtype != 'buffer' && readtype != 'binary') && data.charCodeAt(0) === 0xFEFF) {
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
						var read_files;
						try {
							read_files = fs.readFileSync(file, readtype == 'text' ? 'utf8' : undefined);
						} catch(err) {
							console.log(err)
							if (!errant && options.errorbox !== false) {
								Blockbench.showMessageBox({
									translateKey: 'file_not_found',
									icon: 'error_outline'
								})
							}
							errant = true;
							return;
						} finally {
							load(read_files);
						}
					}
				})()
				i++;
			}
		} else {
			while (i < files.length) {
				(function() {
					var file = files[i]
					var reader = new FileReader()
					reader.i = i
					reader.onloadend = function() {

						if (reader.result.byteLength && pathToExtension(file.name) === 'tga') {
							var arr = new Uint8Array(reader.result)
							var targa_loader = new Targa()
							targa_loader.load(arr)
							var result = targa_loader.getDataURL()
						} else {
							var result = reader.result
						}
						results[this.i] = {
							name: file.name,
							path: file.name,
							content: result
						}
						result_count++;
						if (result_count === files.length) {
							cb(results)
						}
					}
					let readtype = options.readtype;
					if (typeof readtype == 'function') {
						readtype = readtype(file.name);
					}
					if (readtype === 'image') {
						if (pathToExtension(file.name) === 'tga') {
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
			var file_name = options.name + (options.extensions ? '.'+options.extensions[0] : '')
			if (options.custom_writer) {
				options.custom_writer(options.content, file_name)
				
			} else if (options.savetype === 'image') {

				var download = document.createElement('a');
				download.href = options.content
				download.download = file_name;
				if (Blockbench.browser === 'firefox') document.body.appendChild(download);
				download.click();
				if (Blockbench.browser === 'firefox') document.body.removeChild(download);

			} else if (options.savetype === 'zip' || options.savetype === 'buffer' || options.savetype === 'binary') {
				saveAs(options.content, file_name)

			} else {
				var blob = new Blob([options.content], {type: "text/plain;charset=utf-8"});
				saveAs(blob, file_name, {autoBOM: true})
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
			ElecDialogs.showSaveDialog(currentwindow, {
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
			}, function (file_path) {
				if (!file_path) return;
				if (options.resource_id) {
					StateMemory.dialog_paths[options.resource_id] = PathModule.dirname(file_path)
					StateMemory.save('dialog_paths')
				}
				var extension = pathToExtension(file_path);
				if (!extension && options.extensions && options.extensions[0]) {
					file_path += '.'+options.extensions[0]
				}
				Blockbench.writeFile(file_path, options, cb)
			})
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
				options.content = nativeImage.createFromDataURL(options.content).toPNG()
			} else {
				options.content = options.content.replace(/\?\d+$/, '');
				options.content = nativeImage.createFromPath(options.content).toPNG()
			}
		}
		if (options.savetype === 'zip') {
			var fileReader = new FileReader();
			fileReader.onload = function(event) {
				var buffer = Buffer.from(new Uint8Array(this.result));
				fs.writeFileSync(file_path, buffer)
				if (cb) {
					cb(file_path)
				}
			};
			fileReader.readAsArrayBuffer(options.content);
		} else if (options.custom_writer) {
			options.custom_writer(options.content, file_path)

		} else {
			//text or binary
			fs.writeFileSync(file_path, options.content)
			if (cb) {
				cb(file_path)
			}
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
		if (options.addClass !== false) entry.addClass = true;
		if (options.propagate) entry.propagate = true;
		if (options.readtype) entry.readtype = options.readtype;
		if (options.errorbox) entry.errorbox = true;
		if (options.element) entry.element = options.element;

		this.drag_handlers[id] = entry
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
	forDragHandlers(event, function(handler, el) {
		var fileNames = event.dataTransfer.files

		var input = this;
		var results = [];
		var result_count = 0;
		var i = 0;
		var errant;
		var paths = []
		if (isApp) {
			for (var file of fileNames) {
				paths.push(file.path)
			}
		} else {
			paths = fileNames
		}
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
