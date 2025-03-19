//Import
function setupDragHandlers() {
	Blockbench.addDragHandler(
		'texture',
		{extensions: ['png', 'tga'], propagate: true, readtype: 'image', condition: () => !Dialog.open},
		function(files, event) {
			loadImages(files, event)
		}
	)
	Blockbench.addDragHandler(
		'texture_set',
		{extensions: ['texture_set.json'], propagate: true, readtype: 'image', condition: () => Format.pbr && !Dialog.open},
		function(files, event) {
			importTextureSet(files[0]);
		}
	)
	Blockbench.addDragHandler(
		'reference_image',
		{extensions: ReferenceImage.supported_extensions, propagate: true, readtype: 'image', condition: () => Project && !Dialog.open},
		function(files, event) {
			files.map(file => {
				return new ReferenceImage({
					source: file.content,
					name: file.name || 'Reference'
				}).addAsReference(true);
			}).last().select();
			ReferenceImageMode.activate();
		}
	)
	Blockbench.addDragHandler(
		'model',
		{extensions: Codec.getAllExtensions},
		function(files) {
			files.forEach(file => {
				loadModelFile(file);
			})
		}
	)
	Blockbench.addDragHandler(
		'style',
		{extensions: ['bbtheme']},
		function(files) {
			CustomTheme.import(files[0]);
		}
	)
	Blockbench.addDragHandler(
		'settings',
		{extensions: ['bbsettings']},
		function(files) {
			Settings.import(files[0]);
		}
	)
	Blockbench.addDragHandler(
		'plugin',
		{extensions: ['bbplugin', 'js']},
		function(files) {
			files.forEach(file => {
				new Plugin().loadFromFile(file, true);
			})
		}
	)
}

function loadModelFile(file) {
	
	let existing_tab = isApp && ModelProject.all.find(project => (
		project.save_path == file.path || project.export_path == file.path
	))

	let extension = pathToExtension(file.path);

	function loadIfCompatible(codec, type, content) {
		if (codec.load_filter && codec.load_filter.type == type) {
			if (codec.load_filter.extensions.includes(extension) && Condition(codec.load_filter.condition, content)) {
				if (existing_tab && !codec.multiple_per_file) {
					existing_tab.select();
				} else {
					codec.load(content, file);
				}
				return true;
			}
		}
	}

	// Image
	for (let id in Codecs) {
		let success = loadIfCompatible(Codecs[id], 'image', file.content);
		if (success) return;
	}
	// Text
	for (let id in Codecs) {
		let success = loadIfCompatible(Codecs[id], 'text', file.content);
		if (success) return;
	}
	// JSON
	let model = autoParseJSON(file.content);
	for (let id in Codecs) {
		let success = loadIfCompatible(Codecs[id], 'json', model);
		if (success) return;
	}
}

async function loadImages(files, event) {
	let options = {};
	let texture_li = event && $(event.target).parents('li.texture');
	let replace_texture;

	let img = new Image();
	await new Promise((resolve, reject) => {
		img.src = isApp ? files[0].path : files[0].content;
		img.onload = resolve;
		img.onerror = reject;
	})

	// Options
	if (event == undefined) {
		// When using "Open with > Blockbench", ensure these are listed first
		options.edit = null;
	}
	if (Project && texture_li && texture_li.length) {
		replace_texture = Texture.all.findInArray('uuid', texture_li.attr('texid'))
		if (replace_texture) {
			options.replace_texture = 'menu.texture.change';
		}
	}
	if (Project) {
		if (!Format.image_editor && Condition(Panels.textures.condition)) {
			options.texture = 'action.import_texture';
		}
		if (Modes.paint && document.querySelector('#UVEditor:hover') && Texture.selected) {
			options.layer = 'data.layer';
		}
	}
	options.edit = 'message.load_images.edit_image';
	if (Project) {
		options.reference_image = 'data.reference_image';
	}
	if (img.naturalHeight == img.naturalWidth && [64, 128].includes(img.naturalWidth)) {
		options.minecraft_skin = 'format.skin';
	}
	if (Project && Condition(Panels.textures.condition)) {
		if (Format.image_editor) {
			options.texture = 'message.load_images.add_image';
		} else {
			options.texture = 'action.import_texture';
		}
	}
	if (Project && (!Project.box_uv || Format.optional_box_uv)) {
		options.extrude_with_cubes = 'dialog.extrude.title';
	}

	function doLoadImages(method) {
		if (method == 'texture') {
			let new_textures = [];
			Undo.initEdit({textures: new_textures});
			files.forEach(function(f, i) {
				let tex = new Texture().fromFile(f).add(false, true).fillParticle();
				new_textures.push(tex);
				if (Format.image_editor && i == 0) {
					tex.select();
				}
			});
			Undo.finishEdit('Add texture');

		} else if (method == 'replace_texture') {
			replace_texture.fromFile(files[0])
			updateSelection();
			
		} else if (method == 'layer') {
			let texture = Texture.getDefault();
			let frame = new CanvasFrame(img);
			Undo.initEdit({textures: [texture], bitmap: true});
			if (!texture.layers_enabled) {
				texture.activateLayers(false);
			}
			let layer = new TextureLayer({name: files[0].name, offset: [0, 0]}, texture);
			let image_data = frame.ctx.getImageData(0, 0, frame.width, frame.height);
			layer.setSize(frame.width, frame.height);
			layer.ctx.putImageData(image_data, 0, 0);
			texture.layers.push(layer);
			layer.center();
			layer.select();
			layer.setLimbo();
			texture.updateLayerChanges(true);

			Undo.finishEdit('Add image as layer');
			updateInterfacePanels();
			BARS.updateConditions();
			BarItems.move_layer_tool.select();
			
		} else if (method == 'reference_image') {
			
			files.map(file => {
				return new ReferenceImage({
					source: file.content,
					name: file.name || 'Reference'
				}).addAsReference(true);
			}).last().select();
			ReferenceImageMode.activate();
			
		} else if (method == 'edit') {
			Codecs.image.load(files, files[0].path, [img.naturalWidth, img.naturalHeight]);
			
		} else if (method == 'minecraft_skin') {
			Formats.skin.setup_dialog.show();
			Formats.skin.setup_dialog.setFormValues({
				texture: files[0]
			})

		} else if (method == 'extrude_with_cubes') {
			Extruder.dialog.show();
			Extruder.drawImage(files[0]);
		}
	}

	let all_methods = Object.keys(options);
	if (all_methods.length == 1) {
		doLoadImages(all_methods[0]);

	} else if (all_methods.length) {
		let icons = {
			replace_texture: 'file_upload',
			texture: 'library_add',
			layer: 'new_window',
			reference_image: 'wallpaper',
			edit: 'draw',
			minecraft_skin: 'icon-player',
			extrude_with_cubes: 'eject',
		};
		let commands = {};
		for (let id in options) {
			commands[id] = {text: options[id], icon: icons[id]};
		}
		let title = tl('message.load_images.title');
		let message = `${files[0].name}`;
		if (files.length > 1) message += ` (${files.length})`;
		Blockbench.showMessageBox({
			id: 'load_images',
			commands,
			title, message,
			icon: img,
			buttons: ['dialog.cancel'],
		}, result => {
			doLoadImages(result);
		})
	}
}

//Extruder
const Extruder = {
	dialog: new Dialog({
		id: 'image_extruder',
		title: 'dialog.extrude.title',
		buttons: ['dialog.confirm', 'dialog.cancel'],
		part_order: ['form', 'lines'],
		form: {
			mode: {
				label: 'dialog.extrude.mode',
				type: 'select',
				options: {
					areas: 'dialog.extrude.mode.areas',
					lines: 'dialog.extrude.mode.lines',
					columns: 'dialog.extrude.mode.columns',
					pixels: 'dialog.extrude.mode.pixels'
				}
			},
			orientation: {
				label: 'dialog.extrude.orientation',
				type: 'select',
				options: {
					upright: 'dialog.extrude.orientation.upright',
					flat: 'dialog.extrude.orientation.flat',
				}
			},
			scan_tolerance: {
				label: 'dialog.extrude.opacity',
				type: 'range',
				min: 1, max: 255, value: 255, step: 1,
				editable_range_label: true
			}
		},
		lines: [
			`<canvas height="256" width="256" id="extrusion_canvas" class="checkerboard"></canvas>`
		],
		onConfirm(formResult) {
			Extruder.startConversion(formResult);
		}
	}),
	drawImage(file) {
		Extruder.canvas = $('#extrusion_canvas').get(0)
		var ctx = Extruder.canvas.getContext('2d')

		Extruder.ext_img = new Image()
		Extruder.ext_img.src = isApp ? file.path.replace(/#/g, '%23') : file.content
		Extruder.image_file = file
		Extruder.ext_img.style.imageRendering = 'pixelated'
		Extruder.canvas.style.imageRendering = 'pixelated'

		Extruder.ext_img.onload = function() {
			let ratio = Extruder.ext_img.naturalWidth / Extruder.ext_img.naturalHeight;
			Extruder.canvas.width = 256;
			Extruder.canvas.height = 256 / ratio;
			ctx.clearRect(0, 0, Extruder.canvas.width, Extruder.canvas.height);
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(Extruder.ext_img, 0, 0, Extruder.canvas.width, Extruder.canvas.height);
			Extruder.width = Extruder.ext_img.naturalWidth;
			Extruder.height = Extruder.ext_img.naturalHeight;

			if (Extruder.width > 128) return;

			var p = 0
			ctx.beginPath();

			for (var x = 0; x < Extruder.canvas.width; x += 256 / Extruder.width) {
				ctx.moveTo(0.5 + x + p, p);
				ctx.lineTo(0.5 + x + p, 256 + p);
			}
			for (var x = 0; x < Extruder.canvas.height; x += 256 / Extruder.width) {
				ctx.moveTo(p, 0.5 + x + p);
				ctx.lineTo(256 + p, 0.5 + x + p);
			}

			ctx.strokeStyle = CustomTheme.data.colors.grid;
			ctx.stroke();
		}
	},
	startConversion(formResult) {
		var scan_mode = formResult.mode;
		var pixel_opacity_tolerance = Math.round(formResult.scan_tolerance);

		//Undo
		Undo.initEdit({elements: selected, outliner: true, textures: []})
		var texture = new Texture().fromFile(Extruder.image_file).add(false).fillParticle()

		//var ext_x, ext_y;
		var ctx = Painter.getCanvas(texture).getContext('2d')

		var c = document.createElement('canvas')
		var ctx = c.getContext('2d');
		c.width = Extruder.ext_img.naturalWidth;
		c.height = Extruder.ext_img.naturalHeight;
		ctx.drawImage(Extruder.ext_img, 0, 0)
		var image_data = ctx.getImageData(0, 0, c.width, c.height).data

		var finished_pixels = {}
		var cube_nr = 0;
		var cube_name = texture.name.split('.')[0]
		selected.empty()

		//Scale Index
		var scale_i = 1;
		scale_i = 16 / Extruder.width;
		let uv_scale_x = Project.texture_width / Extruder.width;
		let uv_scale_y = Project.texture_height / Extruder.height;

		function isOpaquePixel(px_x, px_y) {
			var opacity = image_data[(px_x + ctx.canvas.width * px_y) * 4 + 3]
			return Math.isBetween(px_x, 0, Extruder.width-1)
				&& Math.isBetween(px_y, 0, Extruder.height-1)
				&& opacity >= pixel_opacity_tolerance;
		}
		function finishPixel(x, y) {
			if (finished_pixels[x] === undefined) {
				finished_pixels[x] = {}
			}
			finished_pixels[x][y] = true
		}
		function isPixelFinished(x, y) {
			return (finished_pixels[x] !== undefined && finished_pixels[x][y] === true)
		}

		//Scanning
		let ext_y = 0;
		while (ext_y < Extruder.height) {

			let ext_x = 0;
			while (ext_x < Extruder.width) {
				if (isPixelFinished(ext_x, ext_y) === false && isOpaquePixel(ext_x, ext_y) === true) {

					//Search From New Pixel
					var loop = true;
					var rect = {x: ext_x, y: ext_y, x2: ext_x, y2: ext_y}
					var safety_limit = 5000

					//Expanding Loop
					while (loop === true && safety_limit) {
						var y_check, x_check, canExpandX, canExpandY;
						//Expand X
						if (scan_mode === 'areas' || scan_mode === 'lines') {
							y_check = rect.y
							x_check = rect.x2 + 1
							canExpandX = true
							while (y_check <= rect.y2) {
								//Check If Row is Free
								if (isOpaquePixel(x_check, y_check) === false || isPixelFinished(x_check, y_check) === true) {
									canExpandX = false;
								}
								y_check += 1
							}
							if (canExpandX === true) {
								rect.x2 += 1
							}
						} else {
							canExpandX = false;
						}
						//Expand Y
						if (scan_mode === 'areas' || scan_mode === 'columns') {
							x_check = rect.x
							y_check = rect.y2 + 1
							canExpandY = true
							while (x_check <= rect.x2) {
								//Check If Row is Free
								if (isOpaquePixel(x_check, y_check) === false || isPixelFinished(x_check, y_check) === true) {
									canExpandY = false
								}
								x_check += 1
							}
							if (canExpandY === true) {
								rect.y2 += 1
							}
						} else {
							canExpandY = false;
						}
						//Conclusion
						if (canExpandX === false && canExpandY === false) {
							loop = false;
						}
						safety_limit--;
					}

					//Draw Rectangle
					var draw_x = rect.x
					var draw_y = rect.y
					while (draw_y <= rect.y2) {
						draw_x = rect.x
						while (draw_x <= rect.x2) {
							finishPixel(draw_x, draw_y)
							draw_x++;
						}
						draw_y++;
					}

					// Generate cube
					let from, to, faces;
					if (formResult.orientation == 'upright')  {
						from = [rect.x*scale_i, 16 - (rect.y2+1)*scale_i, 0];
						to = [(rect.x2+1)*scale_i, 16 - rect.y*scale_i, scale_i];
						faces = {
							south:	{uv: [rect.x*uv_scale_x, rect.y*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							north:	{uv: [(rect.x2+1)*uv_scale_x, rect.y*uv_scale_y, rect.x*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							up:		{uv: [rect.x*uv_scale_x, rect.y*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y+1)*uv_scale_y], texture: texture},
							down:	{uv: [rect.x*uv_scale_x, rect.y2*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							east:	{uv: [rect.x2*uv_scale_x, rect.y*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							west:	{uv: [rect.x*uv_scale_x, rect.y*uv_scale_y, (rect.x+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
						};
					} else {
						from = [rect.x*scale_i, 0, rect.y*scale_i];
						to = [(rect.x2+1)*scale_i, scale_i, (rect.y2+1)*scale_i];
						faces = {
							up:		{uv: [rect.x*uv_scale_x, rect.y*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							down:	{uv: [rect.x*uv_scale_x, (rect.y2+1)*uv_scale_y, (rect.x2+1)*uv_scale_x, rect.y*uv_scale_y], texture: texture},
							north:	{uv: [(rect.x2+1)*uv_scale_x, rect.y*uv_scale_y, rect.x*uv_scale_x, (rect.y+1)*uv_scale_y], texture: texture},
							south:	{uv: [rect.x*uv_scale_x, rect.y2*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							east:	{uv: [rect.x2*uv_scale_x, rect.y*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture, rotation: 90},
							west:	{uv: [rect.x*uv_scale_x, rect.y*uv_scale_y, (rect.x+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture, rotation: 270},
						};
					}
					var current_cube = new Cube({
						name: cube_name+'_'+cube_nr,
						autouv: 0, box_uv: false,
						from, to, faces
					}).init();
					selected.push(current_cube);
					cube_nr++;
				}

				ext_x++;
			}
			ext_y++;
		}

		var group = new Group(cube_name).init().addTo()
		selected.forEach(function(s) {
			s.addTo(group).init()
		})

		Undo.finishEdit('Add extruded texture', {elements: selected, outliner: true, textures: [Texture.all[Texture.all.length-1]]})
	}
}


BARS.defineActions(function() {
	//Import
	new Action('open_model', {
		icon: 'file_open',
		category: 'file',
		keybind: new Keybind({key: 'o', ctrl: true}),
		click: function () {
			var startpath;
			if (isApp && recent_projects && recent_projects.length) {
				let first_recent_project = recent_projects.find(p => !p.favorite) || recent_projects[0];
				startpath = first_recent_project.path;
				if (typeof startpath == 'string') {
					startpath = startpath.replace(/[\\\/][^\\\/]+$/, '');
				}
			}
			Blockbench.import({
				resource_id: 'model',
				extensions: Codec.getAllExtensions(),
				type: 'Model',
				readtype: file => {
					if (typeof file == 'string' && file.search(/\.png$/i) > 0) {
						return 'image'
					}},
				startpath,
				multiple: true
			}, function(files) {
				files.forEach(file => {
					loadModelFile(file);
				})
			})
		}
	})
	new Action('open_from_link', {
		icon: 'link',
		category: 'file',
		click() {
			Blockbench.textPrompt('action.open_from_link', '', link => {
				if (link.match(/https:\/\/blckbn.ch\//) || link.length == 4 || link.length == 6) {
					let code = link.replace(/\/$/, '').split('/').last();
					$.getJSON(`https://blckbn.ch/api/models/${code}`, (model) => {
						Codecs.project.load(model, {path: ''});
					}).fail(error => {
						Blockbench.showQuickMessage('message.invalid_link')
					})
				} else {
					$.getJSON(link, (model) => {
						Codecs.project.load(model, {path: ''});
					}).fail(error => {
						Blockbench.showQuickMessage('message.invalid_link')
					})
				}
			}, {placeholder: 'https://blckbn.ch/123abc'});
		}
	})
	new Action('extrude_texture', {
		icon: 'eject',
		category: 'file',
		condition: _ => (Project && (!Project.box_uv || Format.optional_box_uv)),
		click() {
			Blockbench.import({
				resource_id: 'texture',
				extensions: ['png'],
				type: 'PNG Texture',
				readtype: 'image'
			}, (files) => {
				if (files.length) {
					Extruder.dialog.show();
					Extruder.drawImage(files[0]);
				}
			})
		}
	})
	// Smart Save
	new Action('export_over', {
		icon: 'save',
		category: 'file',
		keybind: new Keybind({key: 's', ctrl: true}),
		condition: () => Project,
		click: async function(event) {
			if (isApp) {
				saveTextures()
				if (Format) {
					let export_codec = Format.codec;
					if (Project.save_path) {
						Codecs.project.write(Codecs.project.compile(), Project.save_path);
					}
					if (Project.export_path && export_codec?.compile) {
						if (export_codec.id != 'image') {
							export_codec.write(export_codec.compile(), Project.export_path)
						}

					} else if (export_codec?.export && !Project.save_path) {
						if (export_codec.id === 'project' || settings.dialog_save_codec.value == false) {
							export_codec.export();

						} else {
							await new Promise(resolve => Blockbench.showMessageBox({
								translateKey: 'save_codec_selector',
								icon: 'save',
								commands: {
									project: 'message.save_codec_selector.project_file',
									[export_codec.id]: export_codec.name || 'Default Format',
									both: 'message.save_codec_selector.both',
								},
								checkboxes: {
									dont_show_again: {value: false, text: 'dialog.dontshowagain'}
								},
								buttons: ['dialog.cancel']
							}, (codec, checkboxes = {}) => {
								if (codec == 'both') {
									Codecs.project.export();
									export_codec.export();
	
								} else if (codec) {
									Codecs[codec].export();
								}
								if (checkboxes.dont_show_again) {
									settings.dialog_save_codec.set(false);
								}
								resolve();
							}));
						}
					} else if (!Project.save_path) {
						if (Format.edit_mode) {
							Codecs.project.export();
						}
					}
				}
				if (Format.animation_mode && Format.animation_files && AnimationItem.all.length) {
					BarItems.save_all_animations.trigger();
				}
			} else {
				saveTextures()
				if (Format.codec && Format.codec.export) {
					Format.codec.export()
				}
				/*
				if (Format.codec && Format.codec.export) {

					let codec = await new Promise(resolve => Blockbench.showMessageBox({
						translateKey: 'save_codec_selector',
						icon: 'save',
						commands: {
							project: 'message.save_codec_selector.project_file',
							[export_codec.id]: export_codec.name || 'Default Format',
							both: 'message.save_codec_selector.both',
						},
						buttons: ['dialog.cancel']
					}, resolve));
					
					if (codec == 'both') {
						Codecs.project.export();
						export_codec.export();

					} else if (codec) {
						Codecs[codec].export();
					}

				} else if (Format.edit_mode) {
					Codecs.project.export();

				} else {
					Project.saved = false;
				}*/
			}
			Blockbench.dispatchEvent('quick_save_model', {});
		}
	})
	if (!isApp) {
		new Action('export_asset_archive', {
			icon: 'archive',
			category: 'file',
			condition: _ => Format && Format.codec,
			click: function() {
				var archive = new JSZip();
				var content = Format.codec.compile()
				var name = `${Format.codec.fileName()}.${Format.codec.extension}`
				archive.file(name, content)
				Texture.all.forEach(tex => {
					if (tex.mode === 'bitmap') {
						archive.file(pathToName(tex.name) + '.png', tex.source.replace('data:image/png;base64,', ''), {base64: true});
					}
				})
				archive.generateAsync({type: 'blob'}).then(content => {
					Blockbench.export({
						type: 'Zip Archive',
						extensions: ['zip'],
						name: 'assets',
						startpath: Project.export_path,
						content: content,
						savetype: 'zip'
					})
					Project.saved = true;
				})
			}
		})
	}

})
