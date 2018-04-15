class BBPainter {
	constructor() {
		this.color = 0x0000ffff
		this.currentPixel = [-1, -1]
		this.brushChanges = false
		this.current = {/*texture, image*/}
	}
	edit(texture, cb, options) {
		if (typeof options !== 'object') {
			options = {}
		}
		if (texture.mode === 'link') {
			console.error('Cannot edit link texture')
			return;
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
	        		Undo.add('Paint', true)
	        	}
	        })
		} else {
		    Painter.current.texture = texture
		    Jimp.read(Buffer.from(texture.source.replace('data:image/png;base64,', ''), 'base64'), function() {}).then(function(image) {
		    	cb(image)
		    	Painter.current.image = image
		        image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
		        	texture.source = dataUrl
		        	texture.updateMaterial()
		        	main_uv.loadData()
		        	if (!options.noUndo) {
		        		Undo.add('Paint', true)
		        	}
		        })
		    })
		}
	}
	startBrushCanvas(data, event) {

		var texture = getTextureById(data.cube.faces[data.face].texture)
		if (texture) {
			var x = Math.floor( data.intersects[0].uv.x * texture.img.naturalWidth )
			var y = Math.floor( (1-data.intersects[0].uv.y) * texture.img.naturalHeight )
			Painter.startBrush(texture, x, y, data.cube.faces[data.face].uv, event)
		}
		if (event.altKey === false && texture && texture.mode !== 'link') {
			document.addEventListener('mousemove', Painter.moveBrushCanvas, false );
			document.addEventListener('mouseup', Painter.stopBrushCanvas, false );
		}
	}
	moveBrushCanvas(force) {
		var data = Canvas.raycast()
		if (data) {
			var texture = getTextureById(data.cube.faces[data.face].texture)
			if (!texture) {
				Blockbench.showMessage('The surface does not have a texture', 'center')
			} else if (texture.mode !== 'bitmap') {
				texture.highlightModeToggle()
				Blockbench.showMessage('You can only paint on bitmap textures', 'center')
			} else {
				var x = Math.floor( data.intersects[0].uv.x * texture.img.naturalWidth )
				var y = Math.floor( (1-data.intersects[0].uv.y) * texture.img.naturalHeight )
				Painter.useBrush(texture, x, y, data.cube.faces[data.face].uv)
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
			if (texture.mode !== 'bitmap') {
				texture.highlightModeToggle()
				Blockbench.showMessage('You can only paint on bitmap textures', 'center')
			} else {
            	Painter.brushChanges = false
				Painter.useBrush(texture, x, y, uvTag)
			}
		} else {
			Painter.colorPicker(texture, x, y)
		}
	}
	colorPicker(texture, x, y) {
		function getPxColor(image) {
			var c = image.getPixelColor(x,y)
			c = tinycolor(Jimp.intToRGBA(c))
			$('#brush_color').spectrum('set', c.toHexString())
		}
		if (texture.mode == 'bitmap') {
			Jimp.read(Buffer.from(texture.source.replace('data:image/png;base64,', ''), 'base64'), function() {}).then(getPxColor)
		} else {
			Jimp.read(texture.source, function() {}).then(getPxColor)
		}
	}
	useBrush(texture, x, y, uvTag) {
		if ((Painter.currentPixel[0] !== x || Painter.currentPixel[1] !== y)) {
			Painter.currentPixel = [x, y]
			Painter.brushChanges = true

			Painter.edit(texture, function(image) {
				var color = $('#brush_color').spectrum('get').toRgb()
				var size = limitNumber(parseInt($('#brush_size').val()), 1, 20);
				var softness = limitNumber(parseFloat($('#brush_softness').val()), 0, 1);
				var brush_mode = $('select#brush_mode option:selected').attr('id')

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

				if (brush_mode === 'round') {
			    	Painter.editCircle(image, x, y, size, softness, function(pxcolor, opacity) {
			    		var result_color = Painter.combineColors(pxcolor, color, opacity);
						return result_color;
			    	})
				} else if (brush_mode === 'noise') {
			    	Painter.editCircle(image, x, y, size, softness, function(pxcolor, opacity) {
			    		var result_color = Painter.combineColors(pxcolor, color, opacity*Math.random());
						return result_color;
			    	})
				} else if (brush_mode === 'eraser') {
			    	Painter.editCircle(image, x, y, size, softness, function(pxcolor, opacity) {
						return {r: pxcolor.r, g: pxcolor.g, b: pxcolor.b, a: pxcolor.a*(1-opacity)};
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
			Undo.add('Paint', true)
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
	addBitmapDialog() {
		var lines = []
		lines.push('<div class="dialog_bar"><label class="name_space_left" for="bitmap_name">Name</label><input class="dark_bordered half" type="text" id="bitmap_name"></div>')
		lines.push('<div class="dialog_bar"><label class="name_space_left" for="bitmap_folder">Folder</label><input class="dark_bordered half" type="text" id="bitmap_folder"></div>')
		if (elements.length > 0 && Blockbench.entity_mode) {
			lines.push('<div class="dialog_bar"><input type="checkbox" id="bitmap_doTemplate"><label class="name_space_left" for="bitmap_doTemplate">Generate Template</label></div>')
		}
		lines.push('<div class="dialog_bar"><input type="text" id="bitmap_color"><label class="name_space_left" for="bitmap_color">Background Color</label></div>')
		lines.push('<div class="dialog_bar"><label class="name_space_left" for="bitmap_resolution">Resolution</label><input class="dark_bordered" style="width:72px" type="number" id="bitmap_resolution"></div>')
		var dialog = new Dialog({
			id: 'add_bitmap',
			title: 'Create Texture',
			draggable: true,
			lines: lines,
			onConfirm: function() {
				Painter.addBitmapFromDialog()
				dialog.hide()
			}
		})
		dialog.show()
		$('input#bitmap_color').spectrum({
	        preferredFormat: "hex",
	        color: 'ffffff',
	        showAlpha: true,
	        showInput: true
		})
		$('.dialog#add_bitmap input#bitmap_doTemplate').click(function() {
			if ($(this).is(':checked') && $('input#bitmap_color').spectrum('get').toHex8() === 'ffffffff') {
				$('input#bitmap_color').spectrum('set', '#00000000')
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
		var color = $('input#bitmap_color').spectrum('get').toRgb()
		color = Jimp.rgbaToInt(color.r, color.g, color.b, color.a*255)

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
			options.color = 0xffffffff
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
		}
		if (options.entity_template === true) {
			Painter.generateTemplate(options.res, options.color, makeTexture)
		} else {
			Painter.generateBlank(options.res, options.res, options.color, makeTexture)
		}
	}
	generateBlank(height, width, color, cb) {
		new Jimp(height, width, color, function(err, image) {
			image.getBase64("image/png", function(a, dataUrl){
				cb(dataUrl)
			})
		})
	}
	generateTemplate(res, color, cb) {
		function cubeTempl(obj) {
			this.x = Math.ceil(obj.size(0))
			this.y = Math.ceil(obj.size(1))
			this.z = Math.ceil(obj.size(2))
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
		var line_length = Math.ceil( Math.sqrt(elements.length/2) )
		var i = 0
		var o = 0

		elements.forEach(function(obj) {
			if (o === line_length) {
				o = 0
				i++
				lines[i] = []
			}
			lines[i][o] = obj
			o++
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
		function snapNum(number, snapTo) {
			return number - number%snapTo + (number%snapTo==0 ? 0 : snapTo)
		}
		//Size
		var max_size = Math.max(max_x_pos, line_y_pos)
		max_size = snapNum(max_size, 16)
		var img_size = {x: max_size, y: max_size}
		
		function drawTemplateRectangle(image, border_color, color, coords) {
			Painter.drawRectangle(image, border_color, {
				x: coords.x*res_multiple,
				y: coords.y*res_multiple,
				w: coords.w*res_multiple,
				h: coords.h*res_multiple
			})
			if (coords.w <= 2 || coords.h <= 2) return;
			Painter.drawRectangle(image, color, {
				x: coords.x * res_multiple + 1,
				y: coords.y * res_multiple + 1,
				w: coords.w * res_multiple - 2,
				h: coords.h * res_multiple - 2
			})
		}
		//Drawing
		new Jimp(img_size.x*res_multiple, img_size.y*res_multiple, color, function(err, image) {

			bone_temps.forEach(function(bt) {
				bt.forEach(function(t) {

					drawTemplateRectangle(image, 0xb4d4e1ff, 0xecf8fdff, {x: t.posx+t.z, 		y: t.posy, 		w: t.x, 	h: t.z})// up
					drawTemplateRectangle(image, 0x536174ff, 0x6e788cff, {x: t.posx+t.z+t.x, 	y: t.posy, 		w: t.x, 	h: t.z})// down
					drawTemplateRectangle(image, 0x43e88dff, 0x7BFFA3ff, {x: t.posx, 			y: t.posy+t.z, 	w: t.z, 	h: t.y})// east
					drawTemplateRectangle(image, 0x5bbcf4ff, 0x7BD4FFff, {x: t.posx+t.z, 		y: t.posy+t.z, 	w: t.x, 	h: t.y})// north
					drawTemplateRectangle(image, 0xf48686ff, 0xFFA7A4ff, {x: t.posx+t.z+t.x, 	y: t.posy+t.z, 	w: t.z, 	h: t.y})// west
					drawTemplateRectangle(image, 0xf8dd72ff, 0xFFF899ff, {x: t.posx+t.z+t.x+t.z,y: t.posy+t.z, 	w: t.x, 	h: t.y})// south

					t.obj.uv_offset[0] = t.posx
					t.obj.uv_offset[1] = t.posy

				})
			})
			image.getBase64("image/png", function(a, dataUrl){
				cb(dataUrl)
				entityMode.setResolution(img_size.x, img_size.y, true)
			})
		})
	}
}
var Painter = new BBPainter()
