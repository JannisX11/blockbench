class BBPainter {
	constructor() {
		this.color = 0x0000ffff
		this.currentPixel = [-1, -1]
		this.brushChanges = false
		this.current = {/*texture, image*/}
		this.background_color = new ColorPicker({
			id: 'background_color',
			label: true,
			private: true,
		})
	}
	edit(texture, cb, options) {
		if (!options.noUndo) {
			Undo.initEdit({textures: [texture], bitmap: true})
		}
		if (options.use_cache &&
			texture === Painter.current.texture &&
			typeof Painter.current.image === 'object'
		) {
			cb(Painter.current.image)
			Painter.current.image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
				texture.source = dataUrl
				texture.updateMaterial()
				main_uv.loadData()
				if (open_dialog === 'uv_dialog') {
					for (var editor in uv_dialog.editors) {
						if (uv_dialog.editors.hasOwnProperty(editor)) {
							uv_dialog.editors[editor].loadData()
						}
					}
				}
				if (!options.noUndo) {
					Undo.finishEdit('edit_texture')
				}
			})
		} else {
			Painter.current.texture = texture
			Jimp.read(Buffer.from(texture.source.replace('data:image/png;base64,', ''), 'base64')).then(function(image) {
				cb(image)
				Painter.current.image = image
				image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
					texture.source = dataUrl
					texture.updateMaterial()
					main_uv.loadData()
					if (!options.noUndo) {
						Undo.finishEdit('edit_texture')
					}
				})
			})
		}
	}
	startBrushCanvas(data, event) {
		Painter.current.x = Painter.current.y = 0
		var texture = getTextureById(data.cube.faces[data.face].texture)
		if (!texture) {
			Blockbench.showQuickMessage('message.untextured')
		}
		if (texture) {
			var x = Math.floor( data.intersects[0].uv.x * texture.img.naturalWidth )
			var y = Math.floor( (1-data.intersects[0].uv.y) * texture.img.naturalHeight )
			Painter.startBrush(texture, x, y, data.cube.faces[data.face].uv, event)
		}
		if (event.altKey === false && texture) {
			document.addEventListener('mousemove', Painter.moveBrushCanvas, false );
			document.addEventListener('mouseup', Painter.stopBrushCanvas, false );
		}
	}
	moveBrushCanvas(force) {
		var data = Canvas.raycast()
		if (data) {
			var texture = getTextureById(data.cube.faces[data.face].texture)
			if (texture) {
				var x, y, new_face;
				var end_x = x = Math.floor( data.intersects[0].uv.x * texture.img.naturalWidth )
				var end_y = y = Math.floor( (1-data.intersects[0].uv.y) * texture.img.naturalHeight )
				if (x === Painter.current.x && y === Painter.current.y) {
					//return
				}
				if (Painter.current.face !== data.face || Painter.current.cube !== data.cube) {
					Painter.current.x = x
					Painter.current.y = y
					Painter.current.face = data.face
					Painter.current.cube = data.cube
					new_face = true
				}
				var diff = {
					x: x - (Painter.current.x||x),
					y: y - (Painter.current.y||y),
				}
				var length = Math.sqrt(diff.x*diff.x + diff.y*diff.y)
				if (new_face && !length) {
					length = 1
				}
				var i = 0;
				while (i < length) {
					x = end_x - diff.x / length * i
					y = end_y - diff.y / length * i
					Painter.useBrush(texture, x, y, data.cube.faces[data.face].uv)
					i++;
				}
				Painter.current.x = end_x
				Painter.current.y = end_y
			}
		}
	}
	stopBrushCanvas() {
		document.removeEventListener( 'mousemove', Painter.moveBrushCanvas, false );
		document.removeEventListener( 'mouseup', Painter.stopBrushCanvas, false );
		Painter.stopBrush()
	}
	startBrush(texture, x, y, uvTag, event) {
		if (event.altKey === false) {
			Undo.initEdit({textures: [texture], bitmap: true})
			Painter.brushChanges = false
			Painter.useBrush(texture, x, y, uvTag)
			Painter.current.x = x;
			Painter.current.y = y;
		} else {
			Painter.colorPicker(texture, x, y)
		}
	}
	colorPicker(texture, x, y) {
		function getPxColor(image) {
			var c = image.getPixelColor(x,y)
			c = tinycolor(Jimp.intToRGBA(c))
			BarItems.brush_color.set(c)
		}
		if (texture.mode == 'bitmap') {
			Jimp.read(Buffer.from(texture.source.replace('data:image/png;base64,', ''), 'base64')).then(getPxColor)
		} else {
			Jimp.read(texture.source).then(getPxColor)
		}
	}
	useBrush(texture, x, y, uvTag) {
		if ((Painter.currentPixel[0] !== x || Painter.currentPixel[1] !== y)) {
			Painter.currentPixel = [x, y]
			Painter.brushChanges = true

			texture.edit(function(image) {
				var color = BarItems.brush_color.get().toRgb()
				var size = BarItems.slider_brush_size.get();
				var softness = BarItems.slider_brush_softness.get()/100;
				var b_opacity = BarItems.slider_brush_opacity.get()/100;
				var brush_mode = BarItems.brush_mode.get()

				if (uvTag) {
					Painter.editing_area = [
						uvTag[0] / 16 * texture.img.naturalWidth,
						uvTag[1] / 16 * texture.img.naturalHeight,
						uvTag[2] / 16 * texture.img.naturalWidth,
						uvTag[3] / 16 * texture.img.naturalHeight
					]
				} else {
					Painter.editing_area = [0, 0, texture.red, texture.red]
				}

				if (Painter.editing_area[0] > Painter.editing_area[2]) {
					var sw = Painter.editing_area[2]
					Painter.editing_area[2] = Painter.editing_area[0]
					Painter.editing_area[0] = sw
				}
				if (Painter.editing_area[1] > Painter.editing_area[3]) {
					var sw = Painter.editing_area[3]
					Painter.editing_area[3] = Painter.editing_area[1]
					Painter.editing_area[1] = sw
				}

				if (brush_mode === 'brush') {
					Painter.editCircle(image, x, y, size, softness, function(pxcolor, opacity) {
						var result_color = Painter.combineColors(pxcolor, color, opacity*b_opacity);
						return result_color;
					})
				} else if (brush_mode === 'noise') {
					Painter.editCircle(image, x, y, size, softness, function(pxcolor, opacity) {
						var result_color = Painter.combineColors(pxcolor, color, opacity*b_opacity*Math.random());
						return result_color;
					})
				} else if (brush_mode === 'eraser') {
					Painter.editCircle(image, x, y, size, softness, function(pxcolor, opacity) {
						return {r: pxcolor.r, g: pxcolor.g, b: pxcolor.b, a: pxcolor.a*(1-b_opacity*opacity)};
					})
				} else if (brush_mode === 'fill') {
					Painter.editFace(image, x, y, function(pxcolor) {
						return Painter.combineColors(pxcolor, color, 1)
					})
				}
				Painter.editing_area = undefined
			}, {noUndo: true, use_cache: true})
		}
	}
	stopBrush() {
		if (Painter.brushChanges) {
			Undo.finishEdit('paint')
			Painter.brushChanges = false
		}
		Painter.currentPixel = [-1, -1]
	}
	combineColors(base, added, opacity) {
		if (typeof base === 'number') base = Jimp.intToRGBA(base)
		if (typeof added === 'number') added = Jimp.intToRGBA(added)

		var original_a = added.a
		added.a = (added.a)*opacity

		var mix = {};
		mix.a = limitNumber(1 - (1 - added.a) * (1 - base.a), 0, 1); // alpha
		mix.r = Math.round((added.r * added.a / mix.a) + (base.r * base.a * (1 - added.a) / mix.a)); // red
		mix.g = Math.round((added.g * added.a / mix.a) + (base.g * base.a * (1 - added.a) / mix.a)); // green
		mix.b = Math.round((added.b * added.a / mix.a) + (base.b * base.a * (1 - added.a) / mix.a)); // blue

		added.a = original_a
		return mix;
	}
	drawRectangle(image, color, rect) {
		var color = Jimp.intToRGBA(color)
		image.scan(rect.x, rect.y, rect.w, rect.h, function (x, y, idx) {
			this.bitmap.data[idx + 0] = color.r
			this.bitmap.data[idx + 1] = color.g
			this.bitmap.data[idx + 2] = color.b
			this.bitmap.data[idx + 3] = color.a
		});
	}
	editFace(image, x, y, editPx) {
		var x = Math.floor(Painter.editing_area[0]-0.5)
		var y = Math.floor(Painter.editing_area[1]-0.5)
		var width  = Math.floor(Painter.editing_area[2]+1.5) - Math.floor(Painter.editing_area[0])
		var height = Math.floor(Painter.editing_area[3]+1.5) - Math.floor(Painter.editing_area[1])
		image.scan(x, y, width, height, function (px, py, idx) {

			if (px >= this.bitmap.width ||
				px < 0 ||
				py >= this.bitmap.height ||
				py < 0
			) {
				return;
			}
			if (
				typeof Painter.editing_area === 'object' &&
				(
					px+0.2 < Painter.editing_area[0] ||
					py+0.2 < Painter.editing_area[1] ||
					px+0.2 >= Painter.editing_area[2] ||
					py+0.2 >= Painter.editing_area[3] 
				)
			) {
				return;
			}

			var result_color = editPx({
				r:this.bitmap.data[idx+0],
				g:this.bitmap.data[idx+1],
				b:this.bitmap.data[idx+2],
				a:this.bitmap.data[idx+3]/255
			})
			this.bitmap.data[idx+0] = result_color.r
			this.bitmap.data[idx+1] = result_color.g
			this.bitmap.data[idx+2] = result_color.b
			this.bitmap.data[idx+3] = result_color.a*255

		});
	}
	editCircle(image, x, y, r, s, editPx) {
		r = Math.round(r)

		image.scan(x-r-1, y-r-1, 2*r+3, 2*r+3, function (px, py, idx) {
			if (px >= this.bitmap.width ||
				px < 0 ||
				py >= this.bitmap.height ||
				py < 0
			) {
				return;
			}
			if (
				settings.paint_side_restrict.value &&
				Painter.editing_area && 
				typeof Painter.editing_area === 'object' &&
				(
					px+0.2 < Painter.editing_area[0] ||
					py+0.2 < Painter.editing_area[1] ||
					px+0.2 >= Painter.editing_area[2] ||
					py+0.2 >= Painter.editing_area[3] 
				)
			) {
				return;
			}

			px -= x;
			py -= y;

			var distance = Math.sqrt(px*px + py*py)
			if (s*r != 0) {
				var pos_on_gradient = (distance-(1-s)*r) / (s*r)
			} else {
				var pos_on_gradient = Math.floor(distance/r)
			}

			var opacity = limitNumber(1-pos_on_gradient, 0, 1)

			if (opacity > 0) {
				var result_color = editPx({
					r:this.bitmap.data[idx+0],
					g:this.bitmap.data[idx+1],
					b:this.bitmap.data[idx+2],
					a:this.bitmap.data[idx+3]/255
				}, opacity)
				this.bitmap.data[idx+0] = result_color.r
				this.bitmap.data[idx+1] = result_color.g
				this.bitmap.data[idx+2] = result_color.b
				this.bitmap.data[idx+3] = result_color.a*255
			}
		});
	}
	drawRotatedRectangle(image, color, rect, cx, cy, angle) {
		var color = Jimp.intToRGBA(color)
		var sin = Math.sin(-Math.degToRad(angle))
		var cos = Math.cos(-Math.degToRad(angle))
		function rotatePoint(px, py) {
			px -= cx
			py -= cy
			return {
				x: (px * cos - py * sin) + cx,
				y: (px * sin + py * cos) + cy
			}
		}
		image.scan(0, 0, 48, 48, function (px, py, idx) {
			var rotated = rotatePoint(px, py)
			if (
				rotated.x > rect.x-1 && rotated.x < rect.x + rect.w+2 &&
				rotated.y > rect.y-1 && rotated.y < rect.y + rect.h+2 
			) {
				var opacity = 	limitNumber(rect.x - rotated.x, 0, 1) +
								limitNumber(rotated.x - (rect.x + rect.w), 0, 1) +
								limitNumber(rect.y - rotated.y, 0, 1) +
								limitNumber(rotated.y - (rect.y + rect.h), 0, 1)

				opacity = 1-limitNumber(opacity*1.61, 0, 1)
				if (this.bitmap.data[idx + 3]) {
					opacity = 1
				}

				this.bitmap.data[idx + 0] = color.r
				this.bitmap.data[idx + 1] = color.g
				this.bitmap.data[idx + 2] = color.b
				this.bitmap.data[idx + 3] = color.a*opacity
			}
		})
	}
	addBitmapDialog() {
		var lines = []

		lines.push({label: 'dialog.create_texture.name', node: '<input class="dark_bordered half" type="text" id="bitmap_name">'})
		lines.push({label: 'dialog.create_texture.folder', node: '<input class="dark_bordered half" type="text" id="bitmap_folder">'})
		if (elements.length > 0) {
			lines.push({label: 'dialog.create_texture.template', node: '<input type="checkbox" id="bitmap_doTemplate">'})
		}
		lines.push({widget: Painter.background_color})
		lines.push({label: 'dialog.create_texture.resolution', node: '<input class="dark_bordered" style="width:72px" type="number" id="bitmap_resolution">'})


		var dialog = new Dialog({
			id: 'add_bitmap',
			title: tl('dialog.create_texture.title'),
			draggable: true,
			lines: lines,
			onConfirm: function() {
				Painter.addBitmapFromDialog()
				dialog.hide()
			}
		})
		dialog.show()
		$('.dialog#add_bitmap input#bitmap_doTemplate').click(function() {
			if (Painter.background_color.get().toHex8() === 'ffffffff') {
				Painter.background_color.set('#00000000')
			}
		})
	}
	testSetup() {
		Painter.addBitmap()
		main_uv.setFace('up')
		addCube().extend({to:[16,1,16]})
		elements[0].faces.up.uv = [0,0,16,16]
		textures[0].apply()
		Canvas.updateSelected()
		updateSelection()
	}
	addBitmapFromDialog() {
		var color = Painter.background_color.get()

		Painter.addBitmap({
			res: limitNumber(parseInt($('.dialog#add_bitmap input#bitmap_resolution').val()), 1, 2048),
			color: color,
			name: $('.dialog#add_bitmap input#bitmap_name').val(),
			folder: $('.dialog#add_bitmap input#bitmap_folder').val(),
			particle: 'auto',
			entity_template: $('.dialog#add_bitmap input#bitmap_doTemplate').is(':checked')
		})
	}
	addBitmap(options, after) {
		if (typeof options !== 'object') {
			options = {}
		}
		if (isNaN(options.res) || !options.res) {
			options.res = 16
		}
		if (options.color === undefined) {
			options.color = new tinycolor().toRgb()
		}
		var texture = new Texture({
			mode: 'bitmap',
			keep_size: true,
			res: options.res,
			name: options.name ? options.name : 'texture',
			folder: options.folder ? options.folder : 'blocks'
		}).add()
		function makeTexture(dataUrl) {
			texture.fromDataURL(dataUrl)
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
			return texture;
		}
		if (options.entity_template === true) {
			Painter.generateTemplate(options.res, options.color, makeTexture)
		} else {
			Painter.generateBlank(options.res, options.res, options.color, makeTexture)
		}
	}
	generateBlank(height, width, color, cb) {
		new Jimp(height, width, color.toInteger(), function(err, image) {
			image.getBase64("image/png", function(a, dataUrl){
				cb(dataUrl)
			})
		})
	}
	generateTemplate(res, background_color, cb) {
		function cubeTempl(obj) {
			this.x = obj.size(0, true)
			this.y = obj.size(1, true)
			this.z = obj.size(2, true)
			this.obj = obj

			this.height = this.z + this.y
			this.width = 2* (this.x + this.z)
			return this;
		}

		var res_multiple = (res ? res : 16) / 16
		var bone_temps = []
		var max_x_pos = 0
		var line_y_pos = 0;
		var valid_cubes = 0;

		var lines = [[]]
		var line_length = Math.sqrt(elements.length/2)
		var o = 0

		var cubes = Blockbench.entity_mode ? elements.slice() : selected.slice()
		var avg_size = 0;

		var i = cubes.length-1
		while (i >= 0) {
			let obj = cubes[i]
			if (obj.visibility === false) {
				cubes.splice(i,1)
			} else {
				obj.template_size = (obj.size(2, true) + obj.size(1, true)) + (obj.size(2, true) + obj.size(0, true))*2
				//obj.template_size = (obj.size(2, true) + obj.size(0, true))
				avg_size += obj.template_size
			}
			i--;
		}
		avg_size /= cubes.length
		cubes.sort(function(a,b) {
			return b.template_size - a.template_size
		})

		i = 0
		var ox = 0
		cubes.forEach(function(obj) {			
			if (ox >= line_length) {
				o = 0
				ox = 0
				i++
				lines[i] = []
			}
			lines[i][o] = obj
			o++;
			ox += obj.template_size/avg_size
		})

		lines.forEach(function(b) {

			//Data
			var temps = []
			b.forEach(function(s, si) {
				if (s.type === 'cube') {
					temps.push(new cubeTempl(s))
					valid_cubes++;
				}
			})
			//Defaults
			//Find the maximum height of the line
			var max_height = 0
			temps.forEach(function(t) {
				max_height = Math.max(max_height, t.height)
			})
			var x_pos = 0
			var y_pos = 0 //Y Position of current area relative to this bone
			var filled_x_pos = 0;
			//Algorithm
			temps.forEach(function(t) {
				if (y_pos > 0 && (y_pos + t.height) <= max_height) {
					//same column
					t.posx = x_pos
					t.posy = y_pos + line_y_pos
					filled_x_pos = Math.max(filled_x_pos, x_pos+t.width)
					y_pos += t.height
				} else {
					//new column
					x_pos = filled_x_pos
					y_pos = t.height
					t.posx = x_pos
					t.posy = line_y_pos
					filled_x_pos = Math.max(filled_x_pos, x_pos+t.width)
				}
				//size of widest bone
				max_x_pos = Math.max(max_x_pos, filled_x_pos)
			})
			line_y_pos += max_height
			bone_temps.push(temps)
		})
		//Cancel if no cubes
		if (valid_cubes == 0) {
			Blockbench.showMessage('No valid cubes', 'center')
			return;
		}
		function getNextPower(num, min) {
			var i = min ? min : 2
			while (i < num && i < 4000) {
				i *= 2
			}
			return i;
		}
		//Size
		var max_size = Math.max(max_x_pos, line_y_pos)
		max_size = Math.ceil(max_size/16)*16//getNextPower(max_size, 16)

		if (background_color.getAlpha() != 0) {
			background_color = background_color.toInteger()
		}
		
		function drawTemplateRectangle(image, border_color, color, coords) {
			if (typeof background_color === 'number') {
				border_color = background_color
				color = undefined
			}
			Painter.drawRectangle(image, border_color, {
				x: coords.x*res_multiple,
				y: coords.y*res_multiple,
				w: coords.w*res_multiple,
				h: coords.h*res_multiple
			})
			if (coords.w <= 2 || coords.h <= 2 || !color) return;
			Painter.drawRectangle(image, color, {
				x: coords.x * res_multiple + 1,
				y: coords.y * res_multiple + 1,
				w: coords.w * res_multiple - 2,
				h: coords.h * res_multiple - 2
			})
		}

		//Drawing
		new Jimp(max_size*res_multiple, max_size*res_multiple, 0, function(err, image) {

			bone_temps.forEach(function(bt) {
				bt.forEach(function(t) {

					drawTemplateRectangle(image, 0xb4d4e1ff, 0xecf8fdff, {x: t.posx+t.z, 		y: t.posy, 		w: t.x, 	h: t.z})// up
					drawTemplateRectangle(image, 0x536174ff, 0x6e788cff, {x: t.posx+t.z+t.x, 	y: t.posy, 		w: t.x, 	h: t.z})// down
					drawTemplateRectangle(image, 0x43e88dff, 0x7BFFA3ff, {x: t.posx, 			y: t.posy+t.z, 	w: t.z, 	h: t.y})// east
					drawTemplateRectangle(image, 0x5bbcf4ff, 0x7BD4FFff, {x: t.posx+t.z, 		y: t.posy+t.z, 	w: t.x, 	h: t.y})// north
					drawTemplateRectangle(image, 0xf48686ff, 0xFFA7A4ff, {x: t.posx+t.z+t.x, 	y: t.posy+t.z, 	w: t.z, 	h: t.y})// west
					drawTemplateRectangle(image, 0xf8dd72ff, 0xFFF899ff, {x: t.posx+t.z+t.x+t.z,y: t.posy+t.z, 	w: t.x, 	h: t.y})// south

					let obj = t.obj
					obj.uv_offset[0] = t.posx
					obj.uv_offset[1] = t.posy

					if (!Blockbench.entity_mode) {
						var size = obj.size(undefined, true)
						
						var face_list = [   
							{face: 'north', fIndex: 10,	from: [size[2], size[2]],			 	size: [size[0],  size[1]]},
							{face: 'east', fIndex: 0,	from: [0, size[2]],				   		size: [size[2],  size[1]]},
							{face: 'south', fIndex: 8,	from: [size[2]*2 + size[0], size[2]], 	size: [size[0],  size[1]]},
							{face: 'west', fIndex: 2,	from: [size[2] + size[0], size[2]],   	size: [size[2],  size[1]]},
							{face: 'up', fIndex: 4,		from: [size[2]+size[0], size[2]],	 	size: [-size[0], -size[2]]},
							{face: 'down', fIndex: 6,	from: [size[2]+size[0]*2, 0],		 	size: [-size[0], size[2]]}
						]

						face_list.forEach(function(f) {

							obj.faces[f.face].uv[0] = (f.from[0]			 + 	Math.floor(obj.uv_offset[0]+0.0000001)) / max_size  * 16,
							obj.faces[f.face].uv[1] = (f.from[1]			 + 	Math.floor(obj.uv_offset[1]+0.0000001)) / max_size * 16,
							obj.faces[f.face].uv[2] = (f.from[0] + f.size[0] + 	Math.floor(obj.uv_offset[0]+0.0000001)) / max_size  * 16,
							obj.faces[f.face].uv[3] = (f.from[1] + f.size[1] + 	Math.floor(obj.uv_offset[1]+0.0000001)) / max_size * 16

						})
					}
				})
			})
			image.getBase64("image/png", function(a, dataUrl){
				var texture = cb(dataUrl)
				entityMode.setResolution(max_size, max_size, true)
				if (texture && !Blockbench.entity_mode) {
					bone_temps.forEach(function(bt) {
						bt.forEach(function(t) {
							t.obj.applyTexture(texture, true)
							t.obj.autouv = 0
						})
					})
				}
			})
		})
	}
}
var Painter = new BBPainter()

BARS.defineActions(function() {
	new BarSelect({
		id: 'vertex_snap_mode',
		options: {
			move: true,
			scale: true
		}
	})
	new ColorPicker({
		id: 'brush_color',
		palette: true
	})
	new BarSelect({
		id: 'brush_mode',
		options: {
			brush: true,
			noise: true,
			eraser: true,
			fill: true
		}
	})

	new NumSlider({
		id: 'slider_brush_size',
		settings: {
			min: 1, max: 20, step: 1, default: 1,
		}
	})
	new NumSlider({
		id: 'slider_brush_softness',
		settings: {
			min: 0, max: 100, default: 0,
			interval: function(event) {
				if (event.shiftKey && event.ctrlKey) {
					return 0.25;
				} else if (event.shiftKey) {
					return 5;
				} else if (event.ctrlKey) {
					return 1;
				} else {
					return 10;
				}
			}
		}
	})
	new NumSlider({
		id: 'slider_brush_opacity',
		settings: {
			min: 0, max: 100, default: 100,
			interval: function(event) {
				if (event.shiftKey && event.ctrlKey) {
					return 0.25;
				} else if (event.shiftKey) {
					return 5;
				} else if (event.ctrlKey) {
					return 1;
				} else {
					return 10;
				}
			}
		}
	})
})
