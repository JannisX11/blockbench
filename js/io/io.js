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

	// Text
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

	if (Project && texture_li && texture_li.length) {
		replace_texture = Texture.all.findInArray('uuid', texture_li.attr('texid'))
		if (replace_texture) {
			options.replace_texture = 'menu.texture.change';
		}
	}
	if (Project) {
		if (Condition(Panels.textures.condition)) {
			options.texture = 'action.import_texture';
		}
		options.background = 'menu.view.background';
	}
	options.edit = 'message.load_images.edit_image';
	if (img.naturalHeight == img.naturalWidth && [64, 128].includes(img.naturalWidth)) {
		options.minecraft_skin = 'format.skin';
	}
	if (Project && (!Project.box_uv || Format.optional_box_uv)) {
		options.extrude_with_cubes = 'dialog.extrude.title';
	}

	function doLoadImages(method) {
		if (method == 'texture') {
			files.forEach(function(f) {
				new Texture().fromFile(f).add().fillParticle()
			})

		} else if (method == 'replace_texture') {
			replace_texture.fromFile(files[0])
			updateSelection();
			
		} else if (method == 'background') {
			let preview = Preview.selected;
			let image = isApp ? files[0].path : files[0].content;
			if (isApp && preview.background.image && preview.background.image.replace(/\?\w+$/, '') == image) {
				image = image + '?' + Math.floor(Math.random() * 1000);
			}
			preview.background.image = image;
			preview.loadBackground();
			Settings.saveLocalStorages();
			preview.startMovingBackground();
			
		} else if (method == 'edit') {
			Codecs.image.load(files, files[0].path, [img.naturalWidth, img.naturalHeight]);
			
		} else if (method == 'minecraft_skin') {
			Formats.skin.setup_dialog.show();
			Formats.skin.setup_dialog.setFormValues({
				texture: isApp ? files[0].path : files[0].content
			})

		} else if (method == 'extrude_with_cubes') {
			showDialog('image_extruder');
			Extruder.drawImage(files[0]);
		}
	}

	let all_methods = Object.keys(options);
	if (all_methods.length == 1) {
		doLoadImages(all_methods[0]);

	} else if (all_methods.length) {
		let title = tl('message.load_images.title');
		let message = `${files[0].name}`;
		if (files.length > 1) message += ` (${files.length})`;
		Blockbench.showMessageBox({
			id: 'load_images',
			commands: options,
			title, message,
			icon: img,
			buttons: ['dialog.cancel'],
		}, result => {
			doLoadImages(result);
		})
	}
}

//Extruder
var Extruder = {
	drawImage: function(file) {
		Extruder.canvas = $('#extrusion_canvas').get(0)
		var ctx = Extruder.canvas.getContext('2d')

		setProgressBar('extrusion_bar', 0)
		$('#scan_tolerance').on('input', function() {
			$('#scan_tolerance_label').text($(this).val())
		})
		showDialog('image_extruder')

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

			ctx.strokeStyle = "black";
			ctx.stroke();
		}

		//Grid
	},
	startConversion: function() {
		var scan_mode = $('select#scan_mode option:selected').attr('id') /*areas, lines, columns, pixels*/
		var isNewProject = elements.length === 0;

		var pixel_opacity_tolerance = parseInt($('#scan_tolerance').val())


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
					var current_cube = new Cube({
						name: cube_name+'_'+cube_nr,
						autouv: 0,
						from: [rect.x*scale_i, 0, rect.y*scale_i],
						to: [(rect.x2+1)*scale_i, scale_i, (rect.y2+1)*scale_i],
						box_uv: false,
						faces: {
							up:		{uv:[rect.x*uv_scale_x, rect.y*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							down:	{uv:[rect.x*uv_scale_x, (rect.y2+1)*uv_scale_y, (rect.x2+1)*uv_scale_x, rect.y*uv_scale_y], texture: texture},
							north:	{uv:[(rect.x2+1)*uv_scale_x, rect.y*uv_scale_y, rect.x*uv_scale_x, (rect.y+1)*uv_scale_y], texture: texture},
							south:	{uv:[rect.x*uv_scale_x, rect.y2*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							east:	{uv:[rect.x2*uv_scale_x, rect.y*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture, rotation: 90},
							west:	{uv:[rect.x*uv_scale_x, rect.y*uv_scale_y, (rect.x+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture, rotation: 270},
						}
					}).init()
					selected.push(current_cube)
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

		hideDialog()
	}
}
//Export
function uploadSketchfabModel() {
	if (elements.length === 0 || !Format) {
		return;
	}
	let tag_suggestions = ['low-poly', 'pixel-art'];
	if (Format.id !== 'free') tag_suggestions.push('minecraft');
	if (Format.id === 'skin') tag_suggestions.push('skin');
	if (!Mesh.all.length) tag_suggestions.push('voxel');
	let clean_project_name = Project.name.toLowerCase().replace(/[_.-]+/g, '-').replace(/[^a-z0-9-]+/, '')
	if (Project.name) tag_suggestions.push(clean_project_name);
	if (clean_project_name.includes('-')) tag_suggestions.safePush(...clean_project_name.split('-').filter(s => s.length > 2 && s != 'geo').reverse());

	let categories = {
		"": "-",
		"animals-pets": "Animals & Pets",
		"architecture": "Architecture",
		"art-abstract": "Art & Abstract",
		"cars-vehicles": "Cars & Vehicles",
		"characters-creatures": "Characters & Creatures",
		"cultural-heritage-history": "Cultural Heritage & History",
		"electronics-gadgets": "Electronics & Gadgets",
		"fashion-style": "Fashion & Style",
		"food-drink": "Food & Drink",
		"furniture-home": "Furniture & Home",
		"music": "Music",
		"nature-plants": "Nature & Plants",
		"news-politics": "News & Politics",
		"people": "People",
		"places-travel": "Places & Travel",
		"science-technology": "Science & Technology",
		"sports-fitness": "Sports & Fitness",
		"weapons-military": "Weapons & Military",
	}

	var dialog = new Dialog({
		id: 'sketchfab_uploader',
		title: 'dialog.sketchfab_uploader.title',
		width: 640,
		form: {
			token: {label: 'dialog.sketchfab_uploader.token', value: settings.sketchfab_token.value, type: 'password'},
			about_token: {type: 'info', text: tl('dialog.sketchfab_uploader.about_token', ['[sketchfab.com/settings/password](https://sketchfab.com/settings/password)'])},
			name: {label: 'dialog.sketchfab_uploader.name', value: capitalizeFirstLetter(Project.name.replace(/\..+/, '').replace(/[_.-]/g, ' '))},
			description: {label: 'dialog.sketchfab_uploader.description', type: 'textarea'},
			category1: {label: 'dialog.sketchfab_uploader.category', type: 'select', options: categories, value: ''},
			category2: {label: 'dialog.sketchfab_uploader.category2', type: 'select', options: categories, value: ''},
			tags: {label: 'dialog.sketchfab_uploader.tags', placeholder: 'Tag1 Tag2'},
			tag_suggestions: {label: 'dialog.sketchfab_uploader.suggested_tags', type: 'buttons', buttons: tag_suggestions, click(index) {
				let {tags} = dialog.getFormResult();
				let new_tag = tag_suggestions[index];
				if (!tags.split(/\s/g).includes(new_tag)) {
					tags += ' ' + new_tag;
					dialog.setFormValues({tags});
				}
			}},
			animations: {label: 'dialog.sketchfab_uploader.animations', value: true, type: 'checkbox', condition: (Format.animation_mode && Animator.animations.length)},
			draft: {label: 'dialog.sketchfab_uploader.draft', type: 'checkbox', value: true},
			divider: '_',
			private: {label: 'dialog.sketchfab_uploader.private', type: 'checkbox'},
			password: {label: 'dialog.sketchfab_uploader.password'},
		},
		onConfirm: function(formResult) {

			if (formResult.token && !formResult.name) {
				Blockbench.showQuickMessage('message.sketchfab.name_or_token', 1800)
				return;
			}
			if (!formResult.tags.split(' ').includes('blockbench')) {
				formResult.tags += ' blockbench';
			}
			var data = new FormData()
			data.append('token', formResult.token)
			data.append('name', formResult.name)
			data.append('description', formResult.description)
			data.append('tags', formResult.tags)
			data.append('isPublished', !formResult.draft)
			//data.append('background', JSON.stringify({color: '#00ff00'}))
			data.append('private', formResult.private)
			data.append('password', formResult.password)
			data.append('source', 'blockbench')

			if (formResult.category1 || formResult.category2) {
				let selected_categories = [];
				if (formResult.category1) selected_categories.push(formResult.category1);
				if (formResult.category2) selected_categories.push(formResult.category2);
				data.append('categories', selected_categories);
			}

			settings.sketchfab_token.value = formResult.token

			Codecs.gltf.compile({animations: formResult.animations}).then(content => {

				var blob = new Blob([content], {type: "text/plain;charset=utf-8"});
				var file = new File([blob], 'model.gltf')

				data.append('modelFile', file)

				$.ajax({
					url: 'https://api.sketchfab.com/v3/models',
					data: data,
					cache: false,
					contentType: false,
					processData: false,
					type: 'POST',
					success: function(response) {
						Blockbench.showMessageBox({
							title: tl('message.sketchfab.success'),
							message:
								`[${formResult.name} on Sketchfab](https://sketchfab.com/models/${response.uid})`, //\n\n&nbsp;\n\n`+
							icon: 'icon-sketchfab',
						})
					},
					error: function(response) {
						Blockbench.showQuickMessage(tl('message.sketchfab.error') + `Error ${response.status}`, 1500)
						console.error(response);
					}
				})
			})

			dialog.hide()
		}
	})
	dialog.show()
}
//Json
function compileJSON(object, options) {
	if (typeof options !== 'object') options = {}
	function newLine(tabs) {
		if (options.small === true) {return '';}
		var s = '\n'
		for (var i = 0; i < tabs; i++) {
			s += '\t'
		}
		return s;
	}
	function escape(string) {
		return string.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n|\r\n/g, '\\n').replace(/\t/g, '\\t')
	}
	function handleVar(o, tabs, breaks = true) {
		var out = ''
		if (typeof o === 'string') {
			//String
			out += '"' + escape(o) + '"'
		} else if (typeof o === 'boolean') {
			//Boolean
			out += (o ? 'true' : 'false')
		} else if (o === null || o === Infinity || o === -Infinity) {
			//Null
			out += 'null'
		} else if (typeof o === 'number') {
			//Number
			o = (Math.round(o*100000)/100000).toString()
			out += o
		} else if (o instanceof Array) {
			//Array
			let has_content = false
			let multiline = !!o.find(item => typeof item === 'object');
			if (!multiline) {
				let length = 0;
				o.forEach(item => {
					length += typeof item === 'string' ? (item.length+4) : 3;
				});
				if (length > 140) multiline = true;
			}
			out += '['
			for (var i = 0; i < o.length; i++) {
				var compiled = handleVar(o[i], tabs+1)
				if (compiled) {
					if (has_content) {out += ',' + ((options.small || multiline) ? '' : ' ')}
					if (multiline) {out += newLine(tabs)}
					out += compiled
					has_content = true
				}
			}
			if (multiline) {out += newLine(tabs-1)}
			out += ']'
		} else if (typeof o === 'object') {
			//Object
			breaks = breaks && o.constructor.name !== 'oneLiner';
			var has_content = false
			out += '{'
			for (var key in o) {
				if (o.hasOwnProperty(key)) {
					var compiled = handleVar(o[key], tabs+1, breaks)
					if (compiled) {
						if (has_content) {out += ',' + (breaks || options.small?'':' ')}
						if (breaks) {out += newLine(tabs)}
						out += '"' + escape(key) + '":' + (options.small === true ? '' : ' ')
						out += compiled
						has_content = true
					}
				}
			}
			if (breaks && has_content) {out += newLine(tabs-1)}
			out += '}'
		}
		return out;
	}
	return handleVar(object, 1)
}
function autoParseJSON(data, feedback) {
	if (data.substr(0, 4) === '<lz>') {
		data = LZUTF8.decompress(data.substr(4), {inputEncoding: 'StorageBinaryString'})
	}
	if (data.charCodeAt(0) === 0xFEFF) {
		data = data.substr(1)
	}
	try {
		data = JSON.parse(data)
	} catch (err1) {
		data = data.replace(/\/\*[^(\*\/)]*\*\/|\/\/.*/g, '')
		try {
			data = JSON.parse(data)
		} catch (err) {
			if (feedback === false) return;
			function logErrantPart(whole, start, length) {
				var line = whole.substr(0, start).match(/\n/gm)
				line = line ? line.length+1 : 1
				var result = '';
				var lines = whole.substr(start, length).split(/\n/gm)
				lines.forEach((s, i) => {
					result += `#${line+i} ${s}\n`
				})
				console.log(result.substr(0, result.length-1) + ' <-- HERE')
			}
			console.error(err)
			var length = err.toString().split('at position ')[1]
			if (length) {
				length = parseInt(length)
				var start = limitNumber(length-20, 0, Infinity)

				logErrantPart(data, start, 1+length-start)
			} else if (err.toString().includes('Unexpected end of JSON input')) {

				logErrantPart(data, data.length-10, 10)
			}
			Blockbench.showMessageBox({
				translateKey: 'invalid_file',
				icon: 'error',
				message: tl('message.invalid_file.message', [err])
			})
			return;
		}
	}
	return data;
}


BARS.defineActions(function() {
	//Import
	new Action('open_model', {
		icon: 'assessment',
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
			}, 'https://blckbn.ch/123abc')
		}
	})
	new Action('extrude_texture', {
		icon: 'eject',
		category: 'file',
		condition: _ => (Project && (!Project.box_uv || Format.optional_box_uv)),
		click: function () {
			Blockbench.import({
				resource_id: 'texture',
				extensions: ['png'],
				type: 'PNG Texture',
				readtype: 'image'
			}, function(files) {
				if (files.length) {
					showDialog('image_extruder')
					Extruder.drawImage(files[0])
				}
			})
		}
	})
	//Export
	new Action('export_over', {
		icon: 'save',
		category: 'file',
		keybind: new Keybind({key: 's', ctrl: true}),
		click: function () {
			if (isApp) {
				saveTextures()
				if (Format) {
					if (Project.save_path) {
						Codecs.project.write(Codecs.project.compile(), Project.save_path);
					}
					if (Project.export_path && Format.codec && Format.codec.compile) {
						Format.codec.write(Format.codec.compile(), Project.export_path)
					} else if (Format.codec && Format.codec.export && !Project.save_path) {
						Format.codec.export()
					} else if (!Project.save_path) {
						Project.saved = true;
					}
				}
				if (Format.animation_mode && Format.animation_files && Animation.all.length) {
					BarItems.save_all_animations.trigger();
				}
			} else {
				saveTextures()
				if (Format.codec && Format.codec.export) {
					Format.codec.export()
				}
			}
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
	new Action('upload_sketchfab', {
		icon: 'icon-sketchfab',
		category: 'file',
		click: function(ev) {
			uploadSketchfabModel()
		}
	})


	new Action('share_model', {
		icon: 'share',
		condition: () => Outliner.elements.length,
		async click() {
			let thumbnail = await new Promise(resolve => {
				Preview.selected.screenshot({width: 640, height: 480}, resolve);
			});
			let image = new Image();
			image.src = thumbnail;
			image.width = 320;
			image.style.display = 'block';
			image.style.margin = 'auto';
			image.style.backgroundColor = 'var(--color-back)';

			var dialog = new Dialog({
				id: 'share_model',
				title: 'dialog.share_model.title',
				form: {
					name: {type: 'text', label: 'generic.name', value: Project.name},
					expire_time: {label: 'dialog.share_model.expire_time', type: 'select', default: '2d', options: {
						'10m': tl('dates.minutes', [10]),
						'1h': tl('dates.hour', [1]),
						'1d': tl('dates.day', [1]),
						'2d': tl('dates.days', [2]),
						'1w': tl('dates.week', [1]),
						'2w': tl('dates.weeks', [2]),
					}},
					info: {type: 'info', text: 'The model and thumbnail will be stored on the Blockbench servers for the duration specified above. [Learn more](https://blockbench.net/blockbench-model-sharing-service/)'},
					thumbnail: {type: 'checkbox', label: 'dialog.share_model.thumbnail', value: true},
				},
				lines: [image],
				part_order: ['form', 'lines'],
				onFormChange(form) {
					image.style.display = form.thumbnail ? 'block' : 'none';
				},
				buttons: ['generic.share', 'dialog.cancel'],
				onConfirm: function(formResult) {
		
					let name = formResult.name;
					let expire_time = formResult.expire_time;
					let model = Codecs.project.compile({compressed: false, absolute_paths: false});
					let data = {name, expire_time, model}
					if (formResult.thumbnail) data.thumbnail = thumbnail;

					$.ajax({
						url: 'https://blckbn.ch/api/model',
						data: JSON.stringify(data),
						cache: false,
						contentType: 'application/json; charset=utf-8',
						dataType: 'json',
						type: 'POST',
						success: function(response) {
							let link = `https://blckbn.ch/${response.id}`

							let link_dialog = new Dialog({
								id: 'share_model_link',
								title: 'dialog.share_model.title',
								form: {
									link: {type: 'text', value: link}
								},
								buttons: ['action.copy', 'dialog.close'],
								onConfirm() {
									link_dialog.hide();
									if (isApp || navigator.clipboard) {
										Clipbench.setText(link);
										Blockbench.showQuickMessage('dialog.share_model.copied_to_clipboard');
									} else {
										Blockbench.showMessageBox({
											title: 'dialog.share_model.title',
											message: `[${link}](${link})`,
										})
									}
								}
							}).show();

						},
						error: function(response) {
							Blockbench.showQuickMessage('dialog.share_model.failed', 1500)
							console.error(response);
						}
					})
		
					dialog.hide()
				}
			})
			dialog.show()
		}
	})



})
