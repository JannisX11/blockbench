var Format = 0;
const Formats = {};
const ModelMeta = {
	save_path: '',
	export_path: '',
	animation_path: '',
	_name: '',
	get name() {return this._name},
	set name(name) {
		this._name = name;
		Project.name = this._name;
		setProjectTitle(this._name)
	},
	get saved() {return Prop.project_saved},
	set saved(s) {Prop.project_saved = !!s},
}

//Formats
class ModelFormat {
	constructor(data) {
		Formats[data.id] = this;
		this.id = data.id;
		this.name = data.name || tl('format.'+this.id);
		this.description = data.description || tl('format.'+this.id+'.desc');
		this.show_on_start_screen = true;

		this.box_uv = false;
		this.optional_box_uv = false;
		this.single_texture = false;
		this.bone_rig = false;
		this.centered_grid = false;
		this.rotate_cubes = false;
		this.integer_size = false;
		this.locators = false;
		this.canvas_limit = false;
		this.outliner_name_pattern = false;
		this.rotation_limit = false;
		this.uv_rotation = false;
		this.display_mode = false;
		this.animation_mode = false;

		this.codec = data.codec;
		this.onActivation = data.onActivation;
		this.onDeactivation = data.onDeactivation;
		Merge.string(this, data, 'icon');
		Merge.boolean(this, data, 'show_on_start_screen');
		
		Merge.boolean(this, data, 'box_uv');
		Merge.boolean(this, data, 'optional_box_uv');
		Merge.boolean(this, data, 'single_texture');
		Merge.boolean(this, data, 'bone_rig');
		Merge.boolean(this, data, 'centered_grid');
		Merge.boolean(this, data, 'rotate_cubes');
		Merge.boolean(this, data, 'integer_size');
		Merge.boolean(this, data, 'locators');
		Merge.boolean(this, data, 'canvas_limit');
		Merge.string(this, data, 'outliner_name_pattern');
		Merge.boolean(this, data, 'rotation_limit');
		Merge.boolean(this, data, 'uv_rotation');
		Merge.boolean(this, data, 'display_mode');
		Merge.boolean(this, data, 'animation_mode');
	}
	select(converting) {
		if (Format && typeof Format.onDeactivation == 'function') {
			Format.onDeactivation()
		}
		Format = this;
		if (typeof this.onActivation == 'function') {
			Format.onActivation()
		}
		if (!converting || !this.optional_box_uv) {
			Project.box_uv = Format.box_uv;
		}
		buildGrid()
		if (Format.centered_grid) {
			scene.position.set(0, 0, 0);
		} else {
			scene.position.set(-8, -8, -8);
		}
		var center = Format.centered_grid ? 8 : 0;
		previews.forEach(preview => {
			if (preview.isOrtho) {
				preview.setOrthographicCamera(preview.angle);
			}
			preview.camOrtho.position.y += center - preview.controls.target.y;
			preview.controls.target.set(0, center, 0);
		})
		updateSelection()
		Modes.vue.$forceUpdate()
		Canvas.updateRenderSides()
		return this;
	}
	new() {
		if (newProject(this)) {
			BarItems.project_window.click();
			return true;
		}
	}
	convertTo() {

		Undo.history.length = 0;
		Undo.index = 0;
		ModelMeta.export_path = '';
		ModelMeta.animation_path = '';

		var old_format = Format
		this.select(true)
		Modes.options.edit.select()
		//Single Texture
		if (Format.single_texture && !old_format.single_texture) {
			if (textures.length > 1) {
				textures.splice(1)
			}
			if (textures.length) {
				var tex = textures[0]
				tex.particle = false
				if (tex.img.naturalWidth !== tex.img.naturalWidth && tex.error) {
					tex.error = false
				}
			}
		}

		//Bone Rig
		if (!Format.bone_rig && old_format.bone_rig) {
			Group.all.forEach(group => {
				group.rotation = [0, 0, 0];
			})
		}
		if (Format.bone_rig && !old_format.bone_rig) {
			var loose_stuff = []
			Outliner.root.forEach(el => {
				if (el instanceof Group == false) {
					loose_stuff.push(el)
				}
			})
			if (loose_stuff.length) {
				var root_group = new Group().init().addTo()
				loose_stuff.forEach(el => {
					el.addTo(root_group)
				})
			}
			if (!Project.geometry_name && Project.name) {
				Project.geometry_name = Project.name;
			}
		}

		//Rotate Cubes
		if (!Format.rotate_cubes && old_format.rotate_cubes) {
			Cube.all.forEach(cube => {
				cube.rotation = [0, 0, 0];
			})
		}

		//Locators
		if (!Format.locators && old_format.locators) {
			Locator.all.slice().forEach(locator => {
				locator.remove()
			})
		}

		//Canvas Limit
		if (Format.canvas_limit && !old_format.canvas_limit && !settings.deactivate_size_limit.value) {

			Cube.all.forEach(function(s, i) {
				//Push elements into 3x3 block box
				[0, 1, 2].forEach(function(ax) {
					var overlap = s.to[ax] + s.inflate - 32
					if (overlap > 0) {
						//If positive site overlaps
						s.from[ax] -= overlap
						s.to[ax] -= overlap

						if (16 + s.from[ax] - s.inflate < 0) {
							s.from[ax] = -16 + s.inflate
						}
					} else {
						overlap = s.from[ax] - s.inflate + 16
						if (overlap < 0) {
							s.from[ax] -= overlap
							s.to[ax] -= overlap

							if (s.to[ax] + s.inflate > 32) {
								s.to[ax] = 32 - s.inflate
							}
						}
					}
				})
			})
		}

		//Rotation Limit
		if (Format.rotation_limit && !old_format.rotation_limit && Format.rotate_cubes) {
			Cube.all.forEach(cube => {
				if (!cube.rotation.allEqual(0)) {
					var axis = (cube.rotation_axis && getAxisNumber(cube.rotation_axis)) || 0;
					var angle = limitNumber( Math.round(cube.rotation[axis]/22.5)*22.5, -45, 45 );
					cube.rotation = [0, 0, 0];
					cube.rotation[axis] = angle;
				}
			})
		}

		//Animation Mode
		if (!Format.animation_mode && old_format.animation_mode) {
			Animator.animations.length = 0;
			ModelMeta.animation_path = '';
		}
		Canvas.updateAllPositions()
		Canvas.updateAllBones()
		Canvas.updateAllFaces()
		updateSelection()
		EditSession.initNewModel()
	}
}
const Codecs = {};
class Codec {
	constructor(id, data) {
		if (!data) data = 0;
		this.id = id;
		Codecs[id] = this;
		this.name = data.name || 'Unknown Format';
		Merge.function(this, data, 'load');
		Merge.function(this, data, 'compile');
		Merge.function(this, data, 'parse');
		Merge.function(this, data, 'write');
		Merge.function(this, data, 'overwrite');
		Merge.function(this, data, 'export');
		Merge.function(this, data, 'fileName');
		Merge.function(this, data, 'afterSave');
		Merge.function(this, data, 'afterDownload');
		Merge.string(this, data, 'extension');
		Merge.boolean(this, data, 'remember');
		this.export_action = data.export_action;
	}
	//Import
	load(model, file, add) {
		if (!this.parse) return false;
		if (!add) {
			newProject(this.format)
		}
		if (file.path && isApp && this.remember && !file.no_file ) {
			var name = pathToName(file.path, true);
			ModelMeta.name = pathToName(name, false);
			ModelMeta.export_path = file.path;
			addRecentProject({
				name,
				path: file.path,
				icon: Format.icon
			})
		}
		this.parse(model, file.path)
	}
	//parse(model, path)

	//Export
	compile() {
		return '';
	}
	export() {
		var scope = this;
		Blockbench.export({
			type: scope.name,
			extensions: [scope.extension],
			name: scope.fileName(),
			startpath: scope.startPath(),
			content: scope.compile(),
			custom_writer: isApp ? (a, b) => scope.write(a, b) : null,
		}, path => scope.afterDownload(path))
	}
	fileName() {
		return ModelMeta.name||Project.name||'model';
	}
	startPath() {
		return ModelMeta.export_path;
	}
	write(content, path) {
		var scope = this;
		if (fs.existsSync(path) && this.overwrite) {
			this.overwrite(content, path, path => scope.afterSave(path))
		} else {
			Blockbench.writeFile(path, {content}, path => scope.afterSave(path));
		}
	}
	//overwrite(content, path, cb)
	afterDownload(path) {
		if (this.remember) {
			Prop.project_saved = true;
		}
		Blockbench.showQuickMessage(tl('message.save_file', [path ? pathToName(path, true) : this.fileName()]));
	}
	afterSave(path) {
		var name = pathToName(path, true)
		if (Format.codec == this || this.id == 'project') {
			if (this.id == 'project') {
				ModelMeta.save_path = path;
			} else {
				ModelMeta.export_path = path;
			}
			ModelMeta.name = pathToName(path, false);
			Prop.project_saved = true;
		}
		if (this.remember) {
			addRecentProject({
				name,
				path: path,
				icon: this.id == 'project' ? 'icon-blockbench_file' : Format.icon
			});
		}
		Blockbench.showQuickMessage(tl('message.save_file', [name]));
	}
}

//New
function resetProject() {
	if (Toolbox.selected.id !== 'move_tool') BarItems.move_tool.select();
	Format = 0;
	elements.length = 0;
	Outliner.root.purge();
	Canvas.materials.length = 0;
	textures.length = 0;
	selected.length = 0;

	Screencam.stopTimelapse();

	Group.all.empty();
	Group.selected = undefined;
	Cube.all.empty();
	Cube.selected.empty();
	Locator.all.empty();
	Locator.selected.empty();

	Blockbench.display_settings = display = {};
	Project.name = Project.parent = Project.geometry_name = Project.description	 = '';
	Project.texture_width = Project.texture_height = 16;
	Project.ambientocclusion = true;
	Project.front_gui_light = false;
	ModelMeta.save_path = ModelMeta.export_path = ModelMeta.animation_path = ModelMeta.name = '';
	ModelMeta.saved = true;
	Prop.project_saved = true;
	Prop.added_models = 0;
	Canvas.updateAll();
	Outliner.vue.$forceUpdate();
	texturelist.$forceUpdate();
	Undo.history.length = 0;
	Undo.index = 0;
	Undo.current_save = null;
	Painter.current = {};
	Animator.animations.purge();
	Timeline.animators.purge();
	Animator.selected = undefined;
	$('#var_placeholder_area').val('');
}
function newProject(format, force) {
	if (force || showSaveDialog()) {
		resetProject();
		Modes.options.edit.select();
		if (format instanceof ModelFormat) {
			format.select();
		}
		Blockbench.dispatchEvent('new_project');
		return true;
	} else {
		return false;
	}
}

//Import
function setupDragHandlers() {
	Blockbench.addDragHandler(
		'model',
		{extensions: ['json', 'jem', 'jpm', 'java', 'bbmodel']},
		function(files) {
			loadModelFile(files[0])
		}
	)
	Blockbench.addDragHandler(
		'style',
		{extensions: ['bbstyle', 'bbtheme']},
		function(files) {
			CustomTheme.import(files[0]);
		}
	)
	Blockbench.addDragHandler(
		'plugin',
		{extensions: ['bbplugin', 'js']},
		function(files) {
			loadPluginFromFile(files[0])
		}
	)
	Blockbench.addDragHandler(
		'texture',
		{extensions: ['png', 'tga'], propagate: true, readtype: 'image'},
		function(files, event) {
			var texture_li = $(event.target).parents('li.texture')
			if (texture_li.length) {
				var tex = textures.findInArray('uuid', texture_li.attr('texid'))
				if (tex) {
					tex.fromFile(files[0])
					return;
				}
			}
			files.forEach(function(f) {
				new Texture().fromFile(f).add().fillParticle()
			})
		}
	)
}
function loadModelFile(file) {
	if (showSaveDialog()) {
		resetProject();
		
		var extension = pathToExtension(file.path);
 		if (extension == 'java') {
			Codecs.modded_entity.load(file.content, file)
		} else {
			var model = autoParseJSON(file.content);
			if (extension == 'bbmodel') {
				Codecs.project.load(model, file)

			} else if (extension == 'json') {
				if (model.parent || model.elements || model.textures) {
					Codecs.java_block.load(model, file)

				} else if (model.format_version && !compareVersions('1.12.0', model.format_version)) {
					Codecs.bedrock.load(model, file)
				} else if (
					model.format_version ||
					Object.keys(model).filter((s) => s.match(/^geometry\./)).length
				) {
					Codecs.bedrock_old.load(model, file)
				}
			} else if (extension == 'jem') {
				Codecs.optifine_entity.load(model, file)
			} else if (extension == 'jpm') {
				Codecs.optifine_part.load(model, file)
			}
		}
		EditSession.initNewModel()
	}
}
var Extruder = {
	drawImage: function(file) {
		Extruder.canvas = $('#extrusion_canvas').get(0)
		var ctx = extrusion_canvas.getContext('2d')

		setProgressBar('extrusion_bar', 0)
		$('#scan_tolerance').on('input', function() {
			$('#scan_tolerance_label').text($(this).val())
		})
		showDialog('image_extruder')

		Extruder.ext_img = new Image()
		Extruder.ext_img.src = isApp ? file.path : file.content
		Extruder.image_file = file
		Extruder.ext_img.style.imageRendering = 'pixelated'
		ctx.imageSmoothingEnabled = false;

		Extruder.ext_img.onload = function() {
			ctx.clearRect(0, 0, 256, 256);
			ctx.drawImage(Extruder.ext_img, 0, 0, 256, 256)
			Extruder.width = Extruder.ext_img.naturalWidth
			Extruder.height = Extruder.ext_img.naturalHeight

			if (Extruder.width > 128) return;

			var g = 256 / Extruder.width;
			var p = 0
			ctx.beginPath();

			for (var x = 0; x <= 256; x += g) {
				ctx.moveTo(0.5 + x + p, p);
				ctx.lineTo(0.5 + x + p, 256 + p);
			}
			for (var x = 0; x <= 256; x += g) {
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
		if (Extruder.width < Extruder.height) {
			Extruder.width = Extruder.height;
		}
		scale_i = 16 / Extruder.width;

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
						faces: {
							up:		{uv:[rect.x*scale_i, rect.y*scale_i, (rect.x2+1)*scale_i, (rect.y2+1)*scale_i], texture: texture},
							down:	{uv:[rect.x*scale_i, (rect.y2+1)*scale_i, (rect.x2+1)*scale_i, rect.y*scale_i], texture: texture},
							north:	{uv:[(rect.x2+1)*scale_i, rect.y*scale_i, rect.x*scale_i, (rect.y+1)*scale_i], texture: texture},
							south:	{uv:[rect.x*scale_i, rect.y2*scale_i, (rect.x2+1)*scale_i, (rect.y2+1)*scale_i], texture: texture},
							east:	{uv:[rect.x2*scale_i, rect.y*scale_i, (rect.x2+1)*scale_i, (rect.y2+1)*scale_i], texture: texture, rotation: 90},
							west:	{uv:[rect.x*scale_i, rect.y*scale_i, (rect.x+1)*scale_i, (rect.y2+1)*scale_i], texture: texture, rotation: 270}
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

		Undo.finishEdit('add extruded texture', {elements: selected, outliner: true, textures: [textures[textures.length-1]]})

		hideDialog()
	}
}
//Export
function uploadSketchfabModel() {
	if (elements.length === 0) {
		return;
	}
	var dialog = new Dialog({
		id: 'sketchfab_uploader',
		title: 'dialog.sketchfab_uploader.title',
		width: 540,
		form: {
			token: {label: 'dialog.sketchfab_uploader.token', value: settings.sketchfab_token.value},
			about_token: {type: 'text', text: tl('dialog.sketchfab_uploader.about_token', ['[sketchfab.com/settings/password](https://sketchfab.com/settings/password)'])},
			name: {label: 'dialog.sketchfab_uploader.name'},
			description: {label: 'dialog.sketchfab_uploader.description', type: 'textarea'},
			tags: {label: 'dialog.sketchfab_uploader.tags', placeholder: 'Tag1 Tag2'},
			draft: {label: 'dialog.sketchfab_uploader.draft', type: 'checkbox'},
			// isPublished (draft)
			// options.background.color = '#ffffff' (Background Color)
			// Category
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
			data.append('private', formResult.private)
			data.append('password', formResult.password)
			data.append('source', 'blockbench')

			settings.sketchfab_token.value = formResult.token

			var archive = new JSZip();
			var model_data = Codecs.obj.compile({all_files: true})
			archive.file('model.obj', model_data.obj)
			archive.file('model.mtl', model_data.mtl)
			for (var key in model_data.images) {
				var tex = model_data.images[key];
				if (tex) {
					archive.file(pathToName(tex.name) + '.png', tex.getBase64(), {base64: true});
				}
			}

			archive.generateAsync({type: 'blob'}).then(blob => {

				var file = new File([blob], 'model.zip', {type: 'application/x-zip-compressed'})
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
								`[${formResult.name} on Sketchfab](https://sketchfab.com/models/${response.uid})\n\n&nbsp;\n\n`+
								tl('message.sketchfab.setup_guide', '[Sketchfab Setup and Common Issues](https://blockbench.net/2020/01/22/sketchfab-setup-and-common-issues/)'),
							icon: 'icon-sketchfab',
						})
					},
					error: function(response) {
						Blockbench.showQuickMessage('message.sketchfab.error', 1500)
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
	var output = ''
	if (typeof options !== 'object') options = {}
	function newLine(tabs) {
		if (options.small === true) {return '';}
		var s = '\n'
		for (var i = 0; i < tabs; i++) {
			s += '\t'
		}
		return s;
	}
	function handleVar(o, tabs) {
		var out = ''
		if (typeof o === 'string') {
			//String
			out += '"' + o.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"'
		} else if (typeof o === 'boolean') {
			//Boolean
			out += (o ? 'true' : 'false')
		} else if (typeof o === 'number') {
			//Number
			o = (Math.round(o*100000)/100000).toString()
			out += o
		} else if (o === null || o === Infinity || o === -Infinity) {
			//Null
			out += 'null'
		} else if (typeof o === 'object' && o.constructor.name === 'Array') {
			//Array
			var has_content = false
			out += '['
			for (var i = 0; i < o.length; i++) {
				var compiled = handleVar(o[i], tabs+1)
				if (compiled) {
					var breaks = typeof o[i] === 'object'
					if (has_content) {out += ',' + (breaks || options.small?'':' ')}
					if (breaks) {out += newLine(tabs)}
					out += compiled
					has_content = true
				}
			}
			if (typeof o[o.length-1] === 'object') {out += newLine(tabs-1)}
			out += ']'
		} else if (typeof o === 'object') {
			//Object
			var breaks = o.constructor.name !== 'oneLiner';
			var has_content = false
			out += '{'
			for (var key in o) {
				if (o.hasOwnProperty(key)) {
					var compiled = handleVar(o[key], tabs+1)
					if (compiled) {
						if (has_content) {out += ',' + (breaks || options.small?'':' ')}
						if (breaks) {out += newLine(tabs)}
						out += '"' + key + '":' + (options.small === true ? '' : ' ')
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
	new ModelFormat({
		id: 'free',
		icon: 'icon-format_free',
		rotate_cubes: true,
		bone_rig: true,
		centered_grid: false,
		optional_box_uv: true,
		uv_rotation: true,
	})
	//Project
	new Action('project_window', {
		icon: 'featured_play_list',
		category: 'file',
		click: function () {

			var dialog = new Dialog({
				id: 'project',
				title: 'dialog.project.title',
				width: 540,
				form: {
					format: {type: 'text', label: 'data.format', text: Format.name||'unknown'},
					name: {label: 'dialog.project.name', value: Project.name},
					parent: {label: 'dialog.project.parent', value: Project.parent, condition: !Format.bone_rig},
					geometry_name: {label: 'dialog.project.geoname', value: Project.geometry_name, condition: Format.bone_rig},
					ambientocclusion: {label: 'dialog.project.ao', type: 'checkbox', value: Project.ambientocclusion, condition: Format.id == 'java_block'},
					box_uv: {label: 'dialog.project.box_uv', type: 'checkbox', value: Project.box_uv, condition: Format.optional_box_uv},
					texture_width: {
						label: 'dialog.project.width',
						type: 'number',
						value: Project.texture_width,
						min: 1
					},
					texture_height: {
						label: 'dialog.project.height',
						type: 'number',
						value: Project.texture_height,
						min: 1
					},
				},
				onConfirm: function(formResult) {
					var save;
					if (Project.box_uv != formResult.box_uv ||
						Project.texture_width != formResult.texture_width ||
						Project.texture_height != formResult.texture_height
					) {
						if (!Project.box_uv && !formResult.box_uv
							&& (Project.texture_width != formResult.texture_width
							|| Project.texture_height != formResult.texture_height)
						) {
							save = Undo.initEdit({uv_only: true, elements: Cube.all, uv_mode: true})
							Cube.all.forEach(cube => {
								for (var key in cube.faces) {
									var uv = cube.faces[key].uv;
									uv[0] *= formResult.texture_width / Project.texture_width;
									uv[2] *= formResult.texture_width / Project.texture_width;
									uv[1] *= formResult.texture_height / Project.texture_height;
									uv[3] *= formResult.texture_height / Project.texture_height;
								}
							})
						} else {
							save = Undo.initEdit({uv_mode: true})
						}
						Project.texture_width = formResult.texture_width;
						Project.texture_height = formResult.texture_height;

						if (Format.optional_box_uv) Project.box_uv = formResult.box_uv;
						Canvas.updateAllUVs()
						updateSelection()
					}

					Project.name = formResult.name;
					Project.parent = formResult.parent;
					Project.geometry_name = formResult.geometry_name;
					Project.ambientocclusion = formResult.ambientocclusion;

					if (save) {
						Undo.finishEdit('change global UV')
					}

					BARS.updateConditions()
					if (EditSession.active) {
						EditSession.sendAll('change_project_meta', JSON.stringify(Project));
					}
					dialog.hide()
				}
			})
			dialog.show()
		}
	})
	new Action('close_project', {
		icon: 'cancel_presentation',
		category: 'file',
		condition: () => (!EditSession.active || EditSession.hosting) && Format,
		click: function () {
			if (showSaveDialog()) {
				resetProject()
				Modes.options.start.select()
				Modes.vue.$forceUpdate()
				Blockbench.dispatchEvent('close_project');
			}
		}
	})
	new Action('convert_project', {
		icon: 'fas.fa-file-import',
		category: 'file',
		condition: () => (!EditSession.active || EditSession.hosting),
		click: function () {

			var options = {};
			for (var key in Formats) {
				if (key !== Format.id && key !== 'skin') {
					options[key] = Formats[key].name;
				}
			}

			var dialog = new Dialog({
				id: 'convert_project',
				title: 'dialog.convert_project.title',
				width: 540,
				form: {
					text: {type: 'text', text: 'dialog.convert_project.text'},
					format: {
						label: 'data.format',
						type: 'select',
						default: Format.id,
						options,
					},
				},
				onConfirm: function(formResult) {
					var format = Formats[formResult.format]
					if (format && format != Format) {
						format.convertTo()
					}
					dialog.hide()
				}
			})
			dialog.show()
		}
	})
	//Import
	new Action('open_model', {
		icon: 'assessment',
		category: 'file',
		keybind: new Keybind({key: 79, ctrl: true}),
		condition: () => (!EditSession.active || EditSession.hosting),
		click: function () {
			var startpath;
			if (isApp && recent_projects && recent_projects.length) {
				startpath = recent_projects[0].path;
				if (typeof startpath == 'string') {
					startpath = startpath.split(osfs);
					startpath.pop();
					startpath = startpath.join(osfs);
				}
			}
			Blockbench.import({
				extensions: ['json', 'jem', 'jpm', 'java', 'bbmodel'],
				type: 'Model',
				startpath
			}, function(files) {
				loadModelFile(files[0]);
			})
		}
	})
	new Action('add_model', {
		icon: 'assessment',
		category: 'file',
		condition: _ => (Format.id == 'java_block'),
		click: function () {
			Blockbench.import({
				extensions: ['json'],
				type: 'JSON Model',
				multiple: true,
			}, function(files) {
				files.forEach(file => {
					var model = autoParseJSON(file.content)
					Codecs.java_block.parse(model, file.path, true)
				})
			})
		}
	})
	new Action('extrude_texture', {
		icon: 'eject',
		category: 'file',
		condition: _ => !Project.box_uv,
		click: function () {
			Blockbench.import({
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
		keybind: new Keybind({key: 83, ctrl: true}),
		click: function () {
			if (isApp) {
				saveTextures()
				if (Format.codec && Format.codec.compile) {
					if (ModelMeta.export_path) {
						Format.codec.write(Format.codec.compile(), ModelMeta.export_path)
					} else if (ModelMeta.save_path) {
						Codecs.project.write(Codecs.project.compile(), ModelMeta.save_path);
					} else {
						Format.codec.export()
					}
				}
				if (Format.animation_mode) {
					if (ModelMeta.animation_path) {
						Blockbench.writeFile(ModelMeta.animation_path, {
							content: autoStringify(Animator.buildFile())
						})
					} else if (Animator.animations.length) {
						BarItems.export_animation_file.trigger()
					}
				}
			} else {
				saveTextures()
				if (Format.codec && Format.codec.compile) {
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
				archive.file((Project.name||'model')+'.json', content)
				textures.forEach(tex => {
					if (tex.mode === 'bitmap') {
						archive.file(pathToName(tex.name) + '.png', tex.source.replace('data:image/png;base64,', ''), {base64: true});
					}
				})
				archive.generateAsync({type: 'blob'}).then(content => {
					Blockbench.export({
						type: 'Zip Archive',
						extensions: ['zip'],
						name: 'assets',
						startpath: ModelMeta.export_path,
						content: content,
						savetype: 'zip'
					})
					Prop.project_saved = true;
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
})
