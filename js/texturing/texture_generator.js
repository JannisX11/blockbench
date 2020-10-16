const TextureGenerator = {
	background_color: new ColorPicker({
		id: 'background_color',
		name: 'data.color',
		private: true,
	}),
	face_data: {
		up:		{c1: '#b4d4e1', c2: '#ecf8fd', place: t => {return {x: t.posx+t.z, 		y: t.posy, 		w: t.x, 	h: t.z}}},
		down:	{c1: '#536174', c2: '#6e788c', place: t => {return {x: t.posx+t.z+t.x, 	y: t.posy, 		w: t.x, 	h: t.z}}},
		east:	{c1: '#43e88d', c2: '#7BFFA3', place: t => {return {x: t.posx, 			y: t.posy+t.z, 	w: t.z, 	h: t.y}}},
		north:	{c1: '#5bbcf4', c2: '#7BD4FF', place: t => {return {x: t.posx+t.z, 		y: t.posy+t.z, 	w: t.x, 	h: t.y}}},
		west:	{c1: '#f48686', c2: '#FFA7A4', place: t => {return {x: t.posx+t.z+t.x, 	y: t.posy+t.z, 	w: t.z, 	h: t.y}}},
		south:	{c1: '#f8dd72', c2: '#FFF899', place: t => {return {x: t.posx+t.z+t.x+t.z,y: t.posy+t.z, 	w: t.x, 	h: t.y}}},
	},
	addBitmapDialog() {
		var dialog = new Dialog({
			id: 'add_bitmap',
			title: tl('action.create_texture'),
			width: 412,
			form: {
				name: 		{label: 'generic.name', value: 'texture'},
				folder: 	{label: 'dialog.create_texture.folder', condition: Format.id == 'java_block'},
				template:	{label: 'dialog.create_texture.template', type: 'checkbox', condition: Cube.all.length}
			},
			onConfirm: function(results) {
				results.particle = 'auto';
				dialog.hide()
				if (results.template) {
					var dialog2 = new Dialog({
						id: 'texture_template',
						title: tl('dialog.create_texture.template'),
						width: 412,
						form: {
							compress: 	{label: 'dialog.create_texture.compress', type: 'checkbox', value: true, condition: Project.box_uv},
							power: 		{label: 'dialog.create_texture.power', type: 'checkbox', value: true},
							double_use: {label: 'dialog.create_texture.double_use', type: 'checkbox', value: true, condition: Project.box_uv},
							box_uv: 	{label: 'dialog.project.box_uv', type: 'checkbox', value: false, condition: !Project.box_uv},
							padding:	{label: 'dialog.create_texture.padding', type: 'checkbox', value: false},
							color: 		{label: 'data.color', type: 'color', colorpicker: TextureGenerator.background_color},
							resolution: {label: 'dialog.create_texture.resolution', type: 'select', value: 16, options: {
								16: '16',
								32: '32',
								64: '64',
								128: '128',
								256: '256',
								512: '512',
							}},
						},
						onConfirm: function(results2) {
							$.extend(results, results2)
							TextureGenerator.addBitmap(results)
							dialog2.hide()
						}
					}).show()
					if (TextureGenerator.background_color.get().toHex8() === 'ffffffff') {
						TextureGenerator.background_color.set('#00000000')
					}
				} else {
					var dialog2 = new Dialog({
						id: 'texture_simple',
						title: tl('action.create_texture'),
						width: 400,
						form: {
							color: 		{label: 'data.color', type: 'color', colorpicker: TextureGenerator.background_color},
							resolution: {label: 'dialog.create_texture.resolution', type: 'vector', dimensions: 2, value: [16, 16], min: 16, max: 2048},
						},
						onConfirm: function(results2) {
							$.extend(results, results2)
							TextureGenerator.addBitmap(results)
							dialog2.hide()
						}
					}).show()
				}
			}
		}).show()
	},
	addBitmap(options, after) {
		if (typeof options !== 'object') {
			options = {}
		}
		if (!options.resolution || isNaN(options.resolution[0]) || isNaN(options.resolution[1])) {
			options.resolution = [16, 16]
		}
		if (options.color === undefined) {
			options.color = new tinycolor().toRgb()
		}
		if (Format.single_texture) {
			options.texture = Texture.getDefault()
		}
		var texture = new Texture({
			mode: 'bitmap',
			keep_size: true,
			name: options.name ? options.name : 'texture',
			folder: options.folder ? options.folder : 'block'
		})
		function makeTexture(dataUrl) {
			texture.fromDataURL(dataUrl).add(false).select()
			switch (options.particle) {
				case 'auto':
				texture.fillParticle();
				break;
				case true:
				texture.enableParticle();
				break;
			}
			if (typeof after === 'function') {
				after(texture)
			}
			if (!options.template) {
				Undo.finishEdit('create blank texture', {textures: [texture], selected_texture: true, bitmap: true})
			}
			return texture;
		}
		if (options.template === true) {
			Undo.initEdit({
				textures: [],
				elements: Format.single_texture ? Cube.all : Cube.selected,
				uv_only: true,
				selected_texture: true,
				uv_mode: true
			})
			if (Project.box_uv || options.box_uv) {
				TextureGenerator.generateTemplate(options, makeTexture)
			} else {
				TextureGenerator.generateFaceTemplate(options, makeTexture)
			}
		} else {
			Undo.initEdit({textures: [], selected_texture: true})
			TextureGenerator.generateBlank(options.resolution[1], options.resolution[0], options.color, makeTexture)
		}
	},
	generateBlank(height, width, color, cb) {
		var canvas = document.createElement('canvas')
		canvas.width = width;
		canvas.height = height;
		var ctx = canvas.getContext('2d')

		ctx.fillStyle = new tinycolor(color).toRgbString()
		ctx.fillRect(0, 0, width, height)

		cb(canvas.toDataURL())
	},
	//constructor
	boxUVCubeTemplate: function(obj, min_size) {
		this.x = obj.size(0, true) || min_size;
		this.y = obj.size(1, 'template') || min_size;
		this.z = obj.size(2, true) || min_size;
		this.posx = obj.uv_offset[0];
		this.posy = obj.uv_offset[1];
		this.obj = obj;
		this.template_size = (obj.size(2, true) + obj.size(1, 'template'))+ (obj.size(2, true) + obj.size(0, true))*2;

		this.height = this.z + this.y;
		this.width = 2* (this.x + this.z);
		return this;	
	},
	//BoxUV Template
	generateTemplate(options, cb) {
		var res = options.resolution;
		var background_color = options.color;
		var texture = options.texture;
		var min_size = (Project.box_uv || options.box_uv) ? 0 : 1;
		var res_multiple = res / 16
		var templates = [];
		var doubles = {};
		var extend_x = 0;
		var extend_y = 0;
		var avg_size = 0;
		var cubes = Format.single_texture ? Cube.all.slice() : Cube.selected.slice()

		var i = cubes.length-1
		while (i >= 0) {
			let obj = cubes[i]
			if (obj.visibility === true) {
				var template = new TextureGenerator.boxUVCubeTemplate(obj, min_size);
				if (options.double_use && (Project.box_uv || options.box_uv) && textures.length) {
					var double_key = [...obj.uv_offset, ...obj.size(undefined, true), ].join('_')
					if (doubles[double_key]) {
						// improve chances that original is not mirrored
						if (doubles[double_key][0].obj.mirror_uv && !obj.mirror_uv) {
							templates[templates.indexOf(doubles[double_key][0])] = template;
							doubles[double_key].splice(0, 0, template)
						} else {
							doubles[double_key].push(template)
						}
						doubles[double_key][0].duplicates = doubles[double_key];
						i--;
						continue;
					} else {
						doubles[double_key] = [template]
					}
				}
				templates.push(template)
				avg_size += templates[templates.length-1].template_size
			}
			i--;
		}
		templates.sort(function(a,b) {
			return b.template_size - a.template_size;
		})
		//Cancel if no cubes
		if (templates.length == 0) {
			Blockbench.showMessage('No valid cubes', 'center')
			return;
		}

		if (options.compress) {

			var fill_map = {}
			function occupy(x, y) {
				if (!fill_map[x]) fill_map[x] = {}
				fill_map[x][y] = true
			}
			function check(x, y) {
				return fill_map[x] && fill_map[x][y]
			}
			function forTemplatePixel(tpl, sx, sy, cb) {
				let w = tpl.width;
				let h = tpl.height;
				if (options.padding) {
					w++; h++;
				}
				for (var x = 0; x < w; x++) {		
					for (var y = 0; y < h; y++) {
						if (y >= tpl.z || (x >= tpl.z && x < (tpl.z + 2*tpl.x + (options.padding ? 1 : 0)))) {
							if (cb(sx+x, sy+y)) return;
						}
					}
				}
			}
			function place(tpl, x, y) {
				var works = true;
				forTemplatePixel(tpl, x, y, (tx, ty) => {
					if (check(tx, ty)) {
						works = false;
						return true;
					}
				})
				if (works) {
					forTemplatePixel(tpl, x, y, occupy)
					tpl.posx = x;
					tpl.posy = y;
					extend_x = Math.max(extend_x, x + tpl.width);
					extend_y = Math.max(extend_y, y + tpl.height);
					return true;
				}
			}
			templates.forEach(tpl => {
				var vert = extend_x > extend_y;
				//Scan for empty spot
				for (var line = 0; line < 2e3; line++) {	
					for (var x = 0; x <= line; x++) {
						if (place(tpl, x, line)) return;
					}
					for (var y = 0; y < line; y++) {
						if (place(tpl, line, y)) return;
					}
				}
			})
		} else {
			//OLD -------------------------------------------
			var lines = [[]]
			var line_length = Math.sqrt(cubes.length/2)
			avg_size /= templates.length
			var o = 0
			var i = 0
			var ox = 0
			templates.forEach(function(tpl) {
				if (ox >= line_length) {
					o = ox = 0
					i++
					lines[i] = []
				}
				lines[i][o] = tpl
				o++;
				ox += tpl.template_size/avg_size
			})

			lines.forEach(function(temps) {

				var x_pos = 0
				var y_pos = 0 //Y Position of current area relative to this bone
				var filled_x_pos = 0;
				var max_height = 0
				//Find the maximum height of the line
				temps.forEach(function(t) {
					max_height = Math.max(max_height, t.height + (options.padding ? 1 : 0))
				})
				//Place
				temps.forEach(function(t) {
					let w = t.width;
					let h = t.height;
					if (options.padding) {
						w++; h++;
					} 
					if (y_pos > 0 && (y_pos + h) <= max_height) {
						//same column
						t.posx = x_pos
						t.posy = y_pos + extend_y
						filled_x_pos = Math.max(filled_x_pos, x_pos + w)
						y_pos += h
					} else {
						//new column
						x_pos = filled_x_pos
						y_pos = h
						t.posx = x_pos
						t.posy = extend_y
						filled_x_pos = Math.max(filled_x_pos, x_pos + w)
					}
					//size of widest bone
					extend_x = Math.max(extend_x, filled_x_pos)
				})
				extend_y += max_height
			})
		}
		
		var max_size = Math.max(extend_x, extend_y)
		if (options.power) {
			max_size = Math.getNextPower(max_size, 16);
		} else {
			max_size = Math.ceil(max_size/16)*16;
		}

		if (background_color.getAlpha() != 0) {
			background_color = background_color.toRgbString()
		}
		var canvas = document.createElement('canvas')
		canvas.width = canvas.height = max_size*res_multiple;
		var ctx = canvas.getContext('2d')
		ctx.imageSmoothingEnabled = false;

		
		//Drawing
		TextureGenerator.old_project_resolution = [Project.texture_width, Project.texture_height]
		TextureGenerator.changeProjectResolution(max_size, max_size);

		templates.forEach(function(t) {
			t.obj.uv_offset[0] = t.posx;
			t.obj.uv_offset[1] = t.posy;

			//if true, dupes must be flipped
			let reverse_flip = t.obj.mirror_uv;
			t.obj.mirror_uv = false;

			if (t.duplicates) {
				t.duplicates.forEach(dupl => {
					if (dupl.obj !== t.obj) {
						dupl.obj.mirror_uv = dupl.obj.mirror_uv !== reverse_flip;
					}
				})
			}
			TextureGenerator.paintCubeBoxTemplate(t.obj, texture, canvas, t);
		})

		var dataUrl = canvas.toDataURL()
		var texture = cb(dataUrl)
		if (texture) {
			cubes.forEach(function(cube) {
				if (!Format.single_texture) {
					cube.applyTexture(texture, true);
				}
				cube.autouv = 0;
			})
		}
		if (options.box_uv && !Project.box_uv) {
			Project.box_uv = true;
		}
		updateSelection()
		Undo.finishEdit('create template', {
			textures: [texture],
			bitmap: true,
			elements: cubes,
			selected_texture: true,
			uv_only: true,
			uv_mode: true
		})
		// Warning
		if (cubes.find(cube => {
			let size = cube.size();
			return (size[0] > 0.001 && size[0] < 0.999) || (size[1] > 0.001 && size[1] < 0.999) || (size[2] > 0.001 && size[2] < 0.999)
		})) {
			Blockbench.showMessageBox({
				title: 'message.small_face_dimensions.title',
				message: tl('message.small_face_dimensions.message') + (Format.optional_box_uv ? '\n\n' + tl('message.small_face_dimensions.face_uv') : ''),
				icon: 'warning',
			})
		}
	},
	boxUVdrawTemplateRectangle(border_color, color, face, coords, texture, canvas) {
		if (typeof background_color === 'string') {
			border_color = background_color
			color = undefined
		}
		var res_multiple = canvas.width/Project.texture_width;
		var ctx = canvas.getContext('2d');
		ctx.fillStyle = border_color;
		ctx.fillRect(
			coords.x*res_multiple,
			coords.y*res_multiple,
			coords.w*res_multiple,
			coords.h*res_multiple
		)
		if (coords.w*res_multiple > 2 && coords.h*res_multiple > 2) {
			if (color == null) {
				ctx.clearRect(
					coords.x * res_multiple + 1,
					coords.y * res_multiple + 1,
					coords.w * res_multiple - 2,
					coords.h * res_multiple - 2
				)
			} else if (color) {
				ctx.fillStyle = color
				ctx.fillRect(
					coords.x * res_multiple + 1,
					coords.y * res_multiple + 1,
					coords.w * res_multiple - 2,
					coords.h * res_multiple - 2
				)
			}
		}
	},
	boxUVdrawTexture(face, coords, texture, canvas) {
		if (!Format.single_texture) {
			if (face.texture === undefined || face.texture === null) return false;
			texture = face.getTexture()
		}
		if (!texture || !texture.img) return false;

		var ctx = canvas.getContext('2d');
		var res_multiple = canvas.width/Project.texture_width;
		ctx.save()
		var uv = face.uv.slice();

		if (face.direction === 'up') {
			uv = [uv[2], uv[3], uv[0], uv[1]]
		} else if (face.direction === 'down') {
			uv = [uv[2], uv[1], uv[0], uv[3]]
		}

		var src = getRectangle(uv[0], uv[1], uv[2], uv[3])
		var flip = [
			uv[0] > uv[2] ? -1 : 1,
			uv[1] > uv[3] ? -1 : 1
		]
		if (flip[0] + flip[1] < 1) {
			ctx.scale(flip[0], flip[1])
		}
		if (face.rotation) {
			ctx.rotate(Math.degToRad(face.rotation))
			let rot = face.rotation

			if (rot <= 180) flip[1] *= -1;
			if (rot >= 180) flip[0] *= -1;
			
			while (rot > 0) {
				[coords.x, coords.y] = [coords.y, coords.x];
				[coords.w, coords.h] = [coords.h, coords.w];
				rot -= 90;
			}
		}
		ctx.drawImage(
			texture.img,
			src.ax/TextureGenerator.old_project_resolution[0] * texture.img.naturalWidth,
			src.ay/TextureGenerator.old_project_resolution[1] * texture.img.naturalHeight,
			src.x /TextureGenerator.old_project_resolution[0] * texture.img.naturalWidth,
			src.y /TextureGenerator.old_project_resolution[1] * texture.img.naturalHeight,
			coords.x*res_multiple*flip[0],
			coords.y*res_multiple*flip[1],
			coords.w*res_multiple*flip[0],
			coords.h*res_multiple*flip[1]
		)
		ctx.restore()
		return true;
	},
	paintCubeBoxTemplate(cube, texture, canvas, template, transparent) {

		if (!template) {
			template = new TextureGenerator.boxUVCubeTemplate(cube, Project.box_uv ? 0 : 1);
		}
		
		for (var face in TextureGenerator.face_data) {
			let d = TextureGenerator.face_data[face]
			
			if (!cube.faces[face].getTexture() ||
				!TextureGenerator.boxUVdrawTexture(cube.faces[face], d.place(template), texture, canvas)
			) {
				TextureGenerator.boxUVdrawTemplateRectangle(d.c1, transparent ? null : d.c2, cube.faces[face], d.place(template), texture, canvas)
			}
		}

		if (template && template.duplicates) {
			template.duplicates.forEach(t_2 => {
				t_2.obj.uv_offset[0] = cube.uv_offset[0];
				t_2.obj.uv_offset[1] = cube.uv_offset[1];
				if (t_2.obj !== cube) {
					t_2.obj.mirror_uv = t_2.obj.mirror_uv != cube.mirror_uv;
				}
			})
		}

		if (!Project.box_uv) {
			var size = cube.size(undefined, true);
			size.forEach((n, i) => {
				size[i] = n;
			})
			
			var face_list = [   
				{face: 'north', fIndex: 10,	from: [size[2], size[2]],			 	size: [size[0],  size[1]]},
				{face: 'east', fIndex: 0,	from: [0, size[2]],				   		size: [size[2],  size[1]]},
				{face: 'south', fIndex: 8,	from: [size[2]*2 + size[0], size[2]], 	size: [size[0],  size[1]]},
				{face: 'west', fIndex: 2,	from: [size[2] + size[0], size[2]],   	size: [size[2],  size[1]]},
				{face: 'up', fIndex: 4,		from: [size[2]+size[0], size[2]],	 	size: [-size[0], -size[2]]},
				{face: 'down', fIndex: 6,	from: [size[2]+size[0]*2, 0],		 	size: [-size[0], size[2]]}
			]
			face_list.forEach(function(f) {
				cube.faces[f.face].uv[0] = (f.from[0]		   + Math.floor(cube.uv_offset[0]+0.0000001)) / canvas.width  * Project.texture_width;
				cube.faces[f.face].uv[1] = (f.from[1]		   + Math.floor(cube.uv_offset[1]+0.0000001)) / canvas.height * Project.texture_height;
				cube.faces[f.face].uv[2] = (f.from[0]+f.size[0]+ Math.floor(cube.uv_offset[0]+0.0000001)) / canvas.width  * Project.texture_width;
				cube.faces[f.face].uv[3] = (f.from[1]+f.size[1]+ Math.floor(cube.uv_offset[1]+0.0000001)) / canvas.height * Project.texture_height;
				cube.faces[f.face].rotation = 0;
			})
		}
	},
	//Face Template
	generateFaceTemplate(options, cb) {

		var res_multiple = options.resolution / 16;
		var background_color = options.color;
		var texture = options.texture;

		var face_list = [];
		function faceRect(cube, face_key, tex, x, y) {
			this.cube = cube;
			this.width  = Math.abs(x);
			this.height = Math.abs(y);
			this.width  = (this.width  >= 0.01 && this.width  < 1) ? 1 : Math.round(this.width );
			this.height = (this.height >= 0.01 && this.height < 1) ? 1 : Math.round(this.height);
			this.size = this.width * this.height;
			this.face_key = face_key;
			this.texture = tex
			this.face = cube.faces[face_key];
			face_list.push(this);
		}

		var cube_array = (Format.single_texture ? Cube.all : Cube.selected).filter(cube => cube.visibility);
		cube_array.forEach(cube => {
			var fi = 0;
			for (var face_key in cube.faces) {
				var face = cube.faces[face_key];
				var tex = face.getTexture();
				if (tex !== null) {
					var x = 0;
					var y = 0;
					switch (face_key) {
						case 'north': x = cube.size(0); y = cube.size(1); break;
						case 'east':  x = cube.size(2); y = cube.size(1); break;
						case 'south': x = cube.size(0); y = cube.size(1); break;
						case 'west':  x = cube.size(2); y = cube.size(1); break;
						case 'up':	  x = cube.size(0); y = cube.size(2); break;
						case 'down':  x = cube.size(0); y = cube.size(2); break;
					}
					new faceRect(cube, face_key, tex, x, y)
				}
			}
		})

		if (face_list.length == 0) {
			Blockbench.showMessage('No valid cubes', 'center')
			return;
		}

		var extend_x = 0;
		var extend_y = 0;


		if (true) {

			face_list.sort(function(a,b) {
				return b.size - a.size;
			})

			var fill_map = {}
			function occupy(x, y) {
				if (!fill_map[x]) fill_map[x] = {}
				fill_map[x][y] = true
			}
			function check(x, y) {
				return fill_map[x] && fill_map[x][y]
			}
			function forTemplatePixel(tpl, sx, sy, cb) {
				let w = tpl.width;
				let h = tpl.height;
				if (options.padding) {
					w++; h++;
				}
				for (var x = 0; x < w; x++) {		
					for (var y = 0; y < h; y++) {
						if (cb(sx+x, sy+y)) return;
					}
				}
			}
			function place(tpl, x, y) {
				var works = true;
				forTemplatePixel(tpl, x, y, (tx, ty) => {
					if (check(tx, ty)) {
						works = false;
						return true;
					}
				})
				if (works) {
					forTemplatePixel(tpl, x, y, occupy)
					tpl.posx = x;
					tpl.posy = y;
					extend_x = Math.max(extend_x, x + tpl.width);
					extend_y = Math.max(extend_y, y + tpl.height);
					return true;
				}
			}
			face_list.forEach(tpl => {
				var vert = extend_x > extend_y;
				//Scan for empty spot
				for (var line = 0; line < 2e3; line++) {	
					for (var x = 0; x <= line; x++) {
						if (place(tpl, x, line)) return;
					}
					for (var y = 0; y < line; y++) {
						if (place(tpl, line, y)) return;
					}
				}
			})
		}
		
		var max_size = Math.max(extend_x*res_multiple, extend_y*res_multiple)
		if (options.power) {
			max_size = Math.getNextPower(max_size, 16);
		} else {
			max_size = Math.ceil(max_size/16)*16;
		}

		if (background_color.getAlpha() != 0) {
			background_color = background_color.toRgbString()
		}
		var canvas = document.createElement('canvas')
		canvas.width = canvas.height = max_size;
		var ctx = canvas.getContext('2d')
		ctx.imageSmoothingEnabled = false;

		
		function drawTemplateRectangle(border_color, color, face, coords) {
			if (typeof background_color === 'string') {
				border_color = background_color
				color = undefined
			}
			ctx.fillStyle = border_color
			ctx.fillRect(
				coords.x*res_multiple,
				coords.y*res_multiple,
				coords.w*res_multiple,
				coords.h*res_multiple
			)
			if (coords.w*res_multiple > 2 && coords.h*res_multiple > 2 && color) {
				ctx.fillStyle = color
				ctx.fillRect(
					coords.x * res_multiple + 1,
					coords.y * res_multiple + 1,
					coords.w * res_multiple - 2,
					coords.h * res_multiple - 2
				)
			}
		}
		function drawTexture(face, coords) {
			if (!Format.single_texture) {
				if (face.texture === undefined || face.texture === null) return false;
				texture = face.getTexture()
			} else {
				texture = Texture.getDefault();
			}
			if (!texture || !texture.img) return false;

			ctx.save()
			var uv = face.uv.slice();

			if (face.direction === 'up') {
				uv = [uv[2], uv[3], uv[0], uv[1]]
			} else if (face.direction === 'down') {
				uv = [uv[2], uv[1], uv[0], uv[3]]
			}

			var src = getRectangle(uv[0], uv[1], uv[2], uv[3])
			var flip = [
				uv[0] > uv[2] ? -1 : 1,
				uv[1] > uv[3] ? -1 : 1
			]
			if (flip[0] + flip[1] < 1) {
				ctx.scale(flip[0], flip[1])
			}
			if (face.rotation) {
				ctx.rotate(Math.degToRad(face.rotation))
				let rot = face.rotation

				if (rot <= 180) flip[1] *= -1;
				if (rot >= 180) flip[0] *= -1;
				
				while (rot > 0) {
					[coords.x, coords.y] = [coords.y, coords.x];
					[coords.w, coords.h] = [coords.h, coords.w];
					rot -= 90;
				}
			}
			ctx.drawImage(
				texture.img,
				src.ax/Project.texture_width * texture.img.naturalWidth,
				src.ay/Project.texture_height * texture.img.naturalHeight,
				src.x /Project.texture_width * texture.img.naturalWidth,
				src.y /Project.texture_height * texture.img.naturalHeight,
				coords.x*res_multiple*flip[0],
				coords.y*res_multiple*flip[1],
				coords.w*res_multiple*flip[0],
				coords.h*res_multiple*flip[1]
			)
			ctx.restore()
			return true;
		}

		//Drawing
		face_list.forEach(function(ftemp) {
			let cube = ftemp.cube
			var pos = {
				x: ftemp.posx,
				y: ftemp.posy,
				w: ftemp.width,
				h: ftemp.height
			}
			var d = TextureGenerator.face_data[ftemp.face_key];
			var flip_rotation = false	
			if (!ftemp.texture ||
				!drawTexture(ftemp.face, pos)
			) {
				drawTemplateRectangle(d.c1, d.c2, ftemp.face, pos)
			} else {
				flip_rotation = ftemp.face.rotation % 180 != 0;
			}
			ftemp.face.extend({
				rotation: 0,
				uv: flip_rotation ? [pos.y, pos.x] : [pos.x, pos.y]
			})
			ftemp.face.uv_size = flip_rotation ? [pos.h, pos.w] : [pos.w, pos.h];
			if (ftemp.face_key == 'up') {
				[ftemp.face.uv[2], ftemp.face.uv[0]] = [ftemp.face.uv[0], ftemp.face.uv[2]];
				[ftemp.face.uv[3], ftemp.face.uv[1]] = [ftemp.face.uv[1], ftemp.face.uv[3]];
			}
			if (ftemp.face_key == 'down') {
				[ftemp.face.uv[2], ftemp.face.uv[0]] = [ftemp.face.uv[0], ftemp.face.uv[2]];
			}
		})
		var dataUrl = canvas.toDataURL()
		var texture = cb(dataUrl)

		TextureGenerator.changeProjectResolution(max_size / res_multiple, max_size / res_multiple);

		if (texture) {
			cube_array.forEach(function(cube) {
				if (!Format.single_texture) {
					for (var key in cube.faces) {
						if (cube.faces[key].texture !== null) {
							cube.faces[key].texture = texture.uuid;
						}
					}
					Canvas.adaptObjectFaces(cube)
					Canvas.updateUV(cube)
				}
				cube.autouv = 0;
			})
		}
		updateSelection()
		Undo.finishEdit('create template', {
			textures: [texture],
			bitmap: true,
			elements: cube_array,
			selected_texture: true,
			uv_only: true,
			uv_mode: true
		})
	},
	//Misc
	changeProjectResolution(width, height) {
		let factor_x = width / Project.texture_width;
		let factor_y = height / Project.texture_height;
		Project.texture_width = width;
		Project.texture_height = height;

		if (!Project.box_uv && !Format.single_texture) {
			Cube.all.forEach(cube => {
				if (cube.selected) return;
				for (var key in cube.faces) {
					let face = cube.faces[key];
					if (face.texture) {
						face.uv[0] *= factor_x
						face.uv[1] *= factor_y;
						face.uv[2] *= factor_x;
						face.uv[3] *= factor_y;
					}
				}
				Canvas.updateUV(cube)
			})
		}
	}
}