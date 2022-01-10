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
		let type_options = {
			template: 'dialog.create_texture.type.template'
		}
		if (!Project.box_uv) {
			type_options.color_map = 'dialog.create_texture.type.color_map';
		}
		type_options.blank = 'dialog.create_texture.type.blank';

		TextureGenerator.background_color.set('#00000000')
		var dialog = new Dialog({
			id: 'add_bitmap',
			title: tl('action.create_texture'),
			width: 480,
			form: {
				name: 		{label: 'generic.name', value: 'texture'},
				folder: 	{label: 'dialog.create_texture.folder', condition: Format.id == 'java_block'},
				type:	{label: 'dialog.create_texture.type', type: 'select', condition: Cube.all.length || Mesh.all.length, options: type_options},
				section2:    "_",

				resolution: {label: 'dialog.create_texture.pixel_density', description: 'dialog.create_texture.pixel_density.desc', type: 'select', value: 16, condition: (form) => (form.type == 'template'), options: {
					16: '16x',
					32: '32x',
					64: '64x',
					128: '128x',
					256: '256x',
					512: '512x',
				}},
				resolution_vec: {label: 'dialog.create_texture.resolution', type: 'vector', condition: (form) => (form.type == 'blank'), dimensions: 2, value: [16, 16], min: 16, max: 2048},
				color: 		{label: 'data.color', type: 'color', colorpicker: TextureGenerator.background_color},

				rearrange_uv:{label: 'dialog.create_texture.rearrange_uv', description: 'dialog.create_texture.rearrange_uv.desc', type: 'checkbox', value: true, condition: (form) => (form.type == 'template')},
				box_uv: 	{label: 'dialog.project.uv_mode.box_uv', type: 'checkbox', value: false, condition: (form) => (form.type == 'template' && !Project.box_uv)},
				compress: 	{label: 'dialog.create_texture.compress', description: 'dialog.create_texture.compress.desc', type: 'checkbox', value: true, condition: (form) => (form.type == 'template' && Project.box_uv && form.rearrange_uv)},
				power: 		{label: 'dialog.create_texture.power', description: 'dialog.create_texture.power.desc', type: 'checkbox', value: true, condition: (form) => (form.type !== 'blank' && (form.rearrange_uv || form.type == 'color_map'))},
				double_use: {label: 'dialog.create_texture.double_use', description: 'dialog.create_texture.double_use.desc', type: 'checkbox', value: true, condition: (form) => (form.type == 'template' && Project.box_uv && form.rearrange_uv)},
				combine_polys: {label: 'dialog.create_texture.combine_polys', description: 'dialog.create_texture.combine_polys.desc', type: 'checkbox', value: true, condition: (form) => (form.type == 'template' && form.rearrange_uv && Mesh.selected.length)},
				padding:	{label: 'dialog.create_texture.padding', description: 'dialog.create_texture.padding.desc', type: 'checkbox', value: false, condition: (form) => (form.type == 'template' && form.rearrange_uv)},

			},
			onFormChange(form) {
				if (form.type == 'template' && TextureGenerator.background_color.get().toHex8() === 'ffffffff') {
					TextureGenerator.background_color.set('#00000000')
				}
				if (form.type == 'blank' && TextureGenerator.background_color.get().toHex8() === '00000000') {
					TextureGenerator.background_color.set('#ffffffff')
				}
			},
			onConfirm: function(results) {
				results.particle = 'auto';
				if (results.type == 'blank') {
					results.resolution = results.resolution_vec;
				}
				dialog.hide()
				TextureGenerator.addBitmap(results)
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
			if (options.type == 'blank') {
				Undo.finishEdit('Create blank texture', {textures: [texture], selected_texture: true, bitmap: true})
			}
			return texture;
		}
		if (options.type == 'template') {
			if (Project.box_uv || options.box_uv) {
				if (Mesh.selected[0]) {
					Blockbench.showQuickMessage('message.box_uv_for_meshes', 1600);
				}
				TextureGenerator.generateTemplate(options, makeTexture);
			} else {
				TextureGenerator.generateFaceTemplate(options, makeTexture);
			}
		} else if (options.type == 'color_map') {
			TextureGenerator.generateColorMapTemplate(options, makeTexture);
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
		var new_resolution = [];
		var cubes = Format.single_texture ? Cube.all.slice() : Cube.selected.slice();

		Undo.initEdit({
			textures: [],
			elements: cubes,
			uv_only: true,
			selected_texture: true,
			uv_mode: true
		})

		var i = cubes.length-1
		while (i >= 0) {
			let obj = cubes[i]
			if (obj.visibility === true) {
				var template = new TextureGenerator.boxUVCubeTemplate(obj, min_size);
				if (options.double_use && Project.box_uv && Texture.all.length) {
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
		//Cancel if no cubes
		if (templates.length == 0) {
			Blockbench.showMessage('message.no_valid_elements', 'center')
			return;
		}
		templates.sort(function(a,b) {
			return b.template_size - a.template_size;
		})

		if (options.rearrange_uv) {

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
						for (var space = 0; space <= line; space++) {
							if (place(tpl, space, line)) return;
							if (space == line) continue;
							if (place(tpl, line, space)) return;
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
			
			var max_size = Math.max(extend_x, extend_y);
			if (options.power) {
				max_size = Math.getNextPower(max_size, 16);
			} else {
				max_size = Math.ceil(max_size/16)*16;
			}
			new_resolution = [max_size, max_size];
		} else {
			new_resolution = [Project.texture_width, Project.texture_height];
		}

		if (background_color.getAlpha() != 0) {
			background_color = background_color.toRgbString()
		}
		var canvas = document.createElement('canvas')
		canvas.width = new_resolution[0] * res_multiple;
		canvas.height = new_resolution[1] * res_multiple;
		var ctx = canvas.getContext('2d')
		ctx.imageSmoothingEnabled = false;

		
		//Drawing
		TextureGenerator.old_project_resolution = [Project.texture_width, Project.texture_height]
		let affected_elements = TextureGenerator.changeProjectResolution(new_resolution[0], new_resolution[1]);

		templates.forEach(function(t) {
			if (options.rearrange_uv) {
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
		if (options.box_uv && !Project.box_uv && Project.optional_box_uv) {
			Project.box_uv = true;
		}
		templates.forEach(function(t) {
			if (options.rearrange_uv) {
				t.obj.uv_offset[0] = t.posx;
				t.obj.uv_offset[1] = t.posy;

				if (t.duplicates) {
					t.duplicates.forEach(dupl => {
						if (dupl.obj !== t.obj) {
							dupl.obj.uv_offset[0] = t.posx;
							dupl.obj.uv_offset[1] = t.posy;
						}
					})
				}
			}
		})

		updateSelection()
		Undo.finishEdit('Create template', {
			textures: [texture],
			bitmap: true,
			elements: cubes.slice().safePush( ...affected_elements),
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

			if (face == 'west' && cube.size(0) == 0) continue;
			if (face == 'down' && cube.size(1) == 0) continue;
			if (face == 'south' && cube.size(2) == 0) continue;
			
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
		var new_resolution = [];

		let vec1 = new THREE.Vector3(),
			vec2 = new THREE.Vector3(),
			vec3 = new THREE.Vector3(),
			vec4 = new THREE.Vector3();

		var face_list = [];
		var element_list = (Format.single_texture ? Outliner.elements : Outliner.selected).filter(el => {
			return (el instanceof Cube || el instanceof Mesh) && el.visibility;
		});
		function faceRect(cube, face_key, tex, x, y) {
			this.cube = cube;
			if (options.rearrange_uv) {
				this.width  = Math.abs(x) * res_multiple;
				this.height = Math.abs(y) * res_multiple;
				this.width  = ((this.width  >= 0.01 && this.width  < 1) ? 1 : Math.round(this.width)) / res_multiple;
				this.height = ((this.height >= 0.01 && this.height < 1) ? 1 : Math.round(this.height)) / res_multiple;
			} else {
				this.posx = cube.faces[face_key].uv[0], cube.faces[face_key].uv[0+2];
				this.posy = cube.faces[face_key].uv[1], cube.faces[face_key].uv[1+2];
				this.width = cube.faces[face_key].uv[0+2] - cube.faces[face_key].uv[0];
				this.height = cube.faces[face_key].uv[1+2] - cube.faces[face_key].uv[1];
			}
			this.size = this.width * this.height;
			this.face_key = face_key;
			this.texture = tex
			this.face = cube.faces[face_key];
			face_list.push(this);
		}

		Undo.initEdit({
			textures: [],
			elements: element_list,
			uv_only: true,
			selected_texture: true,
			uv_mode: true
		})

		element_list.forEach(element => {
			if (element instanceof Cube) {
				for (var face_key in element.faces) {
					var face = element.faces[face_key];
					var tex = face.getTexture();
					if (tex !== null) {
						var x = 0;
						var y = 0;
						switch (face_key) {
							case 'north': x = element.size(0); y = element.size(1); break;
							case 'east':  x = element.size(2); y = element.size(1); break;
							case 'south': x = element.size(0); y = element.size(1); break;
							case 'west':  x = element.size(2); y = element.size(1); break;
							case 'up':	  x = element.size(0); y = element.size(2); break;
							case 'down':  x = element.size(0); y = element.size(2); break;
						}
						new faceRect(element, face_key, tex, x, y)
					}
				}
			} else {
				let mesh = element;
				let face_groups = [];
				for (let key in mesh.faces) {
					let face = mesh.faces[key];
					if (face.vertices.length < 3) continue;
					face_groups.push({
						type: 'face_group',
						mesh,
						faces: [face],
						keys: [0],
						normal: face.getNormal(true)
					})
				}
	
				if (options.combine_polys) {
					function tryToMergeFaceGroup(face_group) {
						if (!face_groups.includes(face_group)) return;
	
						let matches = face_groups.filter(group_b => {
							if (group_b == face_group) return false;
							if (face_group.faces.find(face => face.vertices.find(vkey => group_b.faces.find(face => face.vertices.includes(vkey)))) == undefined) return false;
							return face_group.normal.find((v, i) => !Math.epsilon(v, group_b.normal[i], 0.002)) == undefined;
						});
						matches.forEach(match => {
							face_group.faces.push(...match.faces);
							face_group.keys.push(...match.keys);
							face_groups.remove(match);
						})
					}
	
					face_groups.slice().forEach(tryToMergeFaceGroup);
				}
	
				face_groups.forEach(face_group => {
					// Project vertex coords onto plane
					let normal_vec = vec1.fromArray(face_group.normal);
					let plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
						normal_vec,
						vec2.fromArray(mesh.vertices[face_group.faces[0].vertices[0]])
					)
					let rot = cameraTargetToRotation([0, 0, 0], normal_vec.toArray());
					let e = new THREE.Euler(Math.degToRad(-rot[1] - 90), Math.degToRad(rot[0]), 0);
					let vertex_uvs = {};
					face_group.faces.forEach(face => {
						face.vertices.forEach(vkey => {
							if (!vertex_uvs[vkey]) {
								let coplanar_pos = plane.projectPoint(vec3.fromArray(mesh.vertices[vkey]), vec4);
								coplanar_pos.applyEuler(e);
								vertex_uvs[vkey] = [
									Math.roundTo(coplanar_pos.x, 4),
									Math.roundTo(coplanar_pos.z, 4),
								]
							}
						})
					})
					// Rotate UV to match corners
					let rotation_angles = {};
					let precise_rotation_angle = {};
					face_group.faces.forEach(face => {
						let vertices = face.getSortedVertices();
						vertices.forEach((vkey, i) => {
							let vkey2 = vertices[i+1] || vertices[0];
							let rot = Math.atan2(
								vertex_uvs[vkey2][0] - vertex_uvs[vkey][0],
								vertex_uvs[vkey2][1] - vertex_uvs[vkey][1],
							)
							let snap = 2;
							rot = (Math.radToDeg(rot) + 360) % 90;
							let rounded
							let last_difference = snap;
							for (let rounded_angle in precise_rotation_angle) {
								let precise = precise_rotation_angle[rounded_angle];
								if (Math.abs(rot - precise) < last_difference) {
									last_difference = Math.abs(rot - precise);
									rounded = rounded_angle;
								}
							}
							if (!rounded) rounded = Math.round(rot / snap) * snap;
							if (rotation_angles[rounded]) {
								rotation_angles[rounded]++;
							} else {
								rotation_angles[rounded] = 1;
								precise_rotation_angle[rounded] = rot;
							}
						})
					})
					let angles = Object.keys(rotation_angles).map(k => parseInt(k));
					angles.sort((a, b) => {
						let diff = rotation_angles[b] - rotation_angles[a];
						if (diff) {
							return diff;
						} else {
							return a < b ? -1 : 1;
						}
					})
					let angle = Math.degToRad(precise_rotation_angle[angles[0]]);
					let s = Math.sin(angle);
					let c = Math.cos(angle);
					for (let vkey in vertex_uvs) {
						let point = vertex_uvs[vkey].slice();
						vertex_uvs[vkey][0] = point[0] * c - point[1] * s;
						vertex_uvs[vkey][1] = point[0] * s + point[1] * c;
					}
	
	
					// Define UV bounding box
					let min_x = Infinity;
					let min_z = Infinity;
					for (let vkey in vertex_uvs) {
						min_x = Math.min(min_x, vertex_uvs[vkey][0]);
						min_z = Math.min(min_z, vertex_uvs[vkey][1]);
					}
					for (let vkey in vertex_uvs) {
						vertex_uvs[vkey][0] -= min_x;
						vertex_uvs[vkey][1] -= min_z;
					}
	
					// Round
					if (face_group.faces.length == 1 && face_group.faces[0].vertices.length == 4) {
						let sorted_vertices = face_group.faces[0].getSortedVertices();
						sorted_vertices.forEach((vkey, vi) => {
							let vkey2 = sorted_vertices[vi+1] || sorted_vertices[0];
							let vkey0 = sorted_vertices[vi-1] || sorted_vertices.last();
							let snap = 1;
	
							if (Math.epsilon(vertex_uvs[vkey][0], vertex_uvs[vkey2][0], 0.001)) {
								let min = vertex_uvs[vkey][0] > vertex_uvs[vkey0][0] ? 1 : 0;
								vertex_uvs[vkey][0] = vertex_uvs[vkey2][0] = Math.round(Math.max(min, vertex_uvs[vkey][0] * snap)) / snap;
							}
							if (Math.epsilon(vertex_uvs[vkey][1], vertex_uvs[vkey2][1], 0.001)) {
								let min = vertex_uvs[vkey][1] > vertex_uvs[vkey0][1] ? 1 : 0;
								vertex_uvs[vkey][1] = vertex_uvs[vkey2][1] = Math.round(Math.max(min, vertex_uvs[vkey][1] * snap)) / snap;
							}
						})
					}
	
	
					let max_x = -Infinity;
					let max_z = -Infinity;
					for (let vkey in vertex_uvs) {
						max_x = Math.max(max_x, vertex_uvs[vkey][0]);
						max_z = Math.max(max_z, vertex_uvs[vkey][1]);
					}
					face_group.posx = 0;
					face_group.posy = 0;
					face_group.vertex_uvs = vertex_uvs;
					face_group.width = max_x;
					face_group.height = max_z;
					face_group.size = max_x * max_z;

					let axis = [0, 1, 2].sort((a, b) => {
						return Math.abs(face_group.normal[b]) - Math.abs(face_group.normal[a]) - 0.0001
					})[0]
					if (axis == 0 && face_group.normal[0] >= 0) face_group.face_key = 'east';
					if (axis == 0 && face_group.normal[0] <= 0) face_group.face_key = 'west';
					if (axis == 1 && face_group.normal[1] >= 0) face_group.face_key = 'up';
					if (axis == 1 && face_group.normal[1] <= 0) face_group.face_key = 'down';
					if (axis == 2 && face_group.normal[2] >= 0) face_group.face_key = 'south';
					if (axis == 2 && face_group.normal[2] <= 0) face_group.face_key = 'north';
				})
				face_list.push(...face_groups);
			}
		})

		if (face_list.length == 0) {
			Blockbench.showMessage('message.no_valid_elements', 'center')
			return;
		}

		if (options.rearrange_uv) {

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
					//Scan for empty spot
					for (var line = 0; line < 2e3; line++) {
						for (var space = 0; space <= line; space++) {
							if (place(tpl, space, line)) return;
							if (space == line) continue;
							if (place(tpl, line, space)) return;
						}
					}
				})
			}
			
			var max_size = Math.max(extend_x, extend_y)
			if (options.power) {
				max_size = Math.getNextPower(max_size, 16);
			} else {
				max_size = Math.ceil(max_size/16)*16;
			}
			new_resolution = [max_size, max_size];
		} else {
			new_resolution = [Project.texture_width, Project.texture_height];
		}

		if (background_color.getAlpha() != 0) {
			background_color = background_color.toRgbString()
		}
		var canvas = document.createElement('canvas')
		canvas.width = new_resolution[0] * res_multiple;
		canvas.height = new_resolution[1] * res_multiple;
		var ctx = canvas.getContext('2d')
		ctx.imageSmoothingEnabled = false;


		function drawTemplateRectangle(border_color, color, coords) {
			if (typeof background_color === 'string') {
				border_color = background_color
				color = undefined
			}
			ctx.fillStyle = border_color
			ctx.fillRect(
				Math.floor(coords.x * res_multiple),
				Math.floor(coords.y * res_multiple),
				Math.ceil(coords.w * res_multiple),
				Math.ceil(coords.h * res_multiple)
			)
			if (coords.w*res_multiple > 2 && coords.h*res_multiple > 2 && color) {
				ctx.fillStyle = color
				ctx.fillRect(
					Math.floor(coords.x * res_multiple + 1),
					Math.floor(coords.y * res_multiple + 1),
					Math.ceil(coords.w * res_multiple - 2),
					Math.ceil(coords.h * res_multiple - 2)
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
			var pos = {
				x: ftemp.posx,
				y: ftemp.posy,
				w: Math.ceil(ftemp.width * res_multiple) / res_multiple,
				h: Math.ceil(ftemp.height * res_multiple) / res_multiple
			}
			var d = TextureGenerator.face_data[ftemp.face_key];
			var flip_rotation = false;
			if (!ftemp.texture ||
				ftemp.mesh ||
				!drawTexture(ftemp.face, pos)
			) {
				drawTemplateRectangle(d.c1, d.c2, pos)
			} else if (ftemp.cube) {
				flip_rotation = ftemp.face.rotation % 180 != 0;
			}

			if (options.rearrange_uv) {
				if (ftemp.cube) {
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
				} else {
					ftemp.faces.forEach(face => {
						face.vertices.forEach(vkey => {
							if (!face.uv[vkey]) face.uv[vkey] = [];
							face.uv[vkey][0] = ftemp.vertex_uvs[vkey][0] + ftemp.posx;
							face.uv[vkey][1] = ftemp.vertex_uvs[vkey][1] + ftemp.posy;
						})
					})
				}
			}
		})
		var dataUrl = canvas.toDataURL()
		var texture = cb(dataUrl)

		let affected_elements = TextureGenerator.changeProjectResolution(new_resolution[0], new_resolution[1]);

		if (texture) {
			element_list.forEach(function(element) {
				if (!Format.single_texture) {
					for (var key in element.faces) {
						if (element.faces[key].texture !== null) {
							element.faces[key].texture = texture.uuid;
						}
					}
					element.preview_controller.updateFaces(element);
					element.preview_controller.updateUV(element);
				}
				if (typeof element.autouv !== 'undefined') {
					element.autouv = 0;
				}
			})
		}
		updateSelection()
		Undo.finishEdit('Create template', {
			textures: [texture],
			bitmap: true,
			elements: [...element_list, ...affected_elements],
			selected_texture: true,
			uv_only: true,
			uv_mode: true
		})
	},
	generateColorMapTemplate(options, cb) {

		var background_color = options.color;
		var texture = options.texture;
		var new_resolution = [];

		var face_list = [];
		var element_list = (Format.single_texture ? Outliner.elements : Outliner.selected).filter(el => {
			return (el instanceof Cube || el instanceof Mesh) && el.visibility;
		});

		Undo.initEdit({
			textures: [],
			elements: element_list,
			uv_only: true,
			selected_texture: true,
			uv_mode: true
		})

		element_list.forEach(element => {
			for (let fkey in element.faces) {
				let face = element.faces[fkey];
				if (element instanceof Mesh && face.vertices.length <= 2) continue;
				if (element instanceof Cube && face.texture === null) continue;
				face_list.push({element, fkey, face});
			}
		})

		if (face_list.length == 0) {
			Blockbench.showMessage('message.no_valid_elements', 'center')
			return;
		}

		var max_size = Math.ceil(Math.sqrt(face_list.length));
		if (options.power) {
			max_size = Math.getNextPower(max_size, 16);
		} else {
			max_size = Math.ceil(max_size/16)*16;
		}
		new_resolution = [max_size, max_size];

		if (background_color.getAlpha() != 0) {
			background_color = background_color.toRgbString()
		}
		var canvas = document.createElement('canvas')
		canvas.width = new_resolution[0];
		canvas.height = new_resolution[1];
		var ctx = canvas.getContext('2d');
		ctx.fillStyle = typeof background_color == 'string' ? background_color : 'white';
		ctx.imageSmoothingEnabled = false;
		let texture_ctxs = {};

		//Drawing
		face_list.forEach(({face, fkey}, i) => {
			let x = i % max_size;
			let y = Math.floor(i / max_size);

			let texture;
			if (!Format.single_texture) {
				if (face.texture !== undefined && face.texture !== null) {
					texture = face.getTexture()
				}
			} else {
				texture = Texture.getDefault();
			}
			if (texture && texture.img) {
				if (!texture_ctxs[texture.uuid]) {
					texture_ctxs[texture.uuid] = new CanvasFrame(texture.img).ctx;
				}
				let color = Painter.getPixelColor(
					texture_ctxs[texture.uuid],
					Math.floor((face instanceof CubeFace ? face.uv : face.uv[face.vertices[0]])[0] / Project.texture_width * texture.width),
					Math.floor((face instanceof CubeFace ? face.uv : face.uv[face.vertices[0]])[1] / Project.texture_height * texture.height),
				);
				ctx.fillStyle = color ? color.toHexString() : 'white';
			} else {
				ctx.fillStyle = typeof background_color == 'string' ? background_color : 'white';
			}

			ctx.fillRect(x, y, 1, 1);

			if (face instanceof CubeFace) {
				face.uv = [x+0.25, y+0.25, x+0.75, y+0.75];
			} else if (face instanceof MeshFace) {
				let vertices = face.getSortedVertices();
				face.uv[vertices[0]] = [x+0.75, y+0.25];
				face.uv[vertices[1]] = [x+0.25, y+0.25];
				face.uv[vertices[2]] = [x+0.25, y+0.75];
				if (vertices[3]) face.uv[vertices[3]] = [x+0.75, y+0.75];
			}
		})
		var dataUrl = canvas.toDataURL()
		var texture = cb(dataUrl)

		let affected_elements = TextureGenerator.changeProjectResolution(new_resolution[0], new_resolution[1]);

		if (texture) {
			face_list.forEach(({face, fkey}, i) => {
				face.texture = texture.uuid;
			})
			element_list.forEach(function(element) {
				element.preview_controller.updateFaces(element);
				element.preview_controller.updateUV(element);
				if (typeof element.autouv !== 'undefined') {
					element.autouv = 0;
				}
			})
		}
		updateSelection()
		Undo.finishEdit('Create template', {
			textures: [texture],
			bitmap: true,
			elements: [...element_list, ...affected_elements],
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
		let changed_elements = [];

		if (!Project.box_uv && !Format.single_texture && (factor_x !== 1 || factor_y !== 1)) {
			changed_elements = Outliner.elements.filter(el => el.faces && !el.selected);
			Undo.current_save.addElements(changed_elements, {uv_only: true});

			changed_elements.forEach(element => {
				if (element instanceof Cube) {
					for (var key in element.faces) {
						let face = element.faces[key];
						if (face.texture) {
							face.uv[0] *= factor_x
							face.uv[1] *= factor_y;
							face.uv[2] *= factor_x;
							face.uv[3] *= factor_y;
						}
					}
				} else if (element instanceof Mesh) {
					for (var fkey in element.faces) {
						let face = element.faces[fkey];
						for (let vkey in face.uv) {
							face.uv[vkey][0] *= factor_x;
							face.uv[vkey][1] *= factor_y;
						}
					}
				}
				element.preview_controller.updateUV(element);
			})
		}
		return changed_elements;
	}
}