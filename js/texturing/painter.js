const Painter = {
	currentPixel: [-1, -1],
	brushChanges: false,
	current: {/*texture, image*/},
	background_color: new ColorPicker({
		id: 'background_color',
		name: 'data.color',
		private: true,
	}),
	edit(texture, cb, options) {
		if (!options.no_undo) {
			Undo.initEdit({textures: [texture], bitmap: true})
		}
		if (texture.mode === 'link') {
			texture.source = 'data:image/png;base64,' + texture.getBase64()
			texture.mode = 'bitmap'
			texture.saved = false
		}
		var instance = Painter.current[options.method === 'canvas' ? 'canvas' : 'image']
		Painter.current[options.method === 'canvas' ? 'image' : 'canvas'] = undefined

		if (options.use_cache &&
			texture === Painter.current.texture &&
			typeof instance === 'object'
		) {
			//IS CACHED
			if (options.method !== 'canvas') {
				instance = cb(instance) || instance
			} else {
				cb(instance)
			}
			if (options.no_update === true) {
				return;
			}

			if (options.method !== 'canvas') {
				Painter.current.image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
					texture.updateSource(dataUrl)
					if (!options.no_undo) {
						Undo.finishEdit('edit_texture')
					}
				})
			} else {
				texture.updateSource(instance.toDataURL())
				if (!options.no_undo) {
					Undo.finishEdit('edit_texture')
				}
			}
		} else {
			if (options.method !== 'canvas') {
				Painter.current.texture = texture
				Jimp.read(Buffer.from(texture.source.replace('data:image/png;base64,', ''), 'base64')).then(function(image) {
					image = cb(image) || image
					Painter.current.image = image
					image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
						texture.updateSource(dataUrl)
						if (!options.no_undo) {
							Undo.finishEdit('edit_texture')
						}
					})
				})
			} else {
				Painter.current.texture = texture
				var c = Painter.current.canvas = Painter.getCanvas(texture)
				cb(c)

				texture.updateSource(c.toDataURL())
				if (!options.no_undo) {
					Undo.finishEdit('edit_texture')
				}
			}
		}
	},
	setAlphaMatrix(tex, x, y, val) {
		if (!Painter.current.alpha_matrix) Painter.current.alpha_matrix = {}
		var mx = Painter.current.alpha_matrix;
		if (!mx[tex.uuid]) mx[tex.uuid] = {};
		if (!mx[tex.uuid][x]) mx[tex.uuid][x] = {};
		mx[tex.uuid][x][y] = val
	},
	getAlphaMatrix(tex, x, y) {
		return Painter.current.alpha_matrix
			&& Painter.current.alpha_matrix[tex.uuid]
			&& Painter.current.alpha_matrix[tex.uuid][x]
			&& Painter.current.alpha_matrix[tex.uuid][x][y];
	},
	startBrushCanvas(data, e) {
		if (!data && Toolbox.selected.id == 'color_picker') {
			var preview = quad_previews.current
			if (preview && preview.background && preview.background.imgtag) {
				
				var ctx = Painter.getCanvas(preview.background.imgtag).getContext('2d')
				var pixel_ratio = main_preview.background.imgtag.width / main_preview.background.size;
				var x = (event.offsetX - preview.width/2 - preview.background.x) * pixel_ratio + main_preview.background.imgtag.width/2
				var y = (event.offsetY - preview.height/2 - preview.background.y)* pixel_ratio
				if (x >= 0 && y >= 0 && x < main_preview.background.imgtag.width && y < main_preview.background.imgtag.height) {
					Painter.scanCanvas(ctx, x, y, 1, 1, (x, y, px) => {
						var t = tinycolor({
							r: px[0],
							g: px[1],
							b: px[2],
							a: px[3]/256
						})
						ColorPanel.set(t)
					})
				}
			}
		}
		if (!data) return;
		var texture = data.cube.faces[data.face].getTexture()
		if (!texture || (texture.error && texture.error !== 2)) {
			Blockbench.showQuickMessage('message.untextured')
			return;
		}
		var x = Math.floor( data.intersects[0].uv.x * texture.img.naturalWidth )
		var y = Math.floor( (1-data.intersects[0].uv.y) * texture.img.naturalHeight )
		Painter.startBrush(texture, x, y, data.cube.faces[data.face].uv, e, data)

		if (Toolbox.selected.id !== 'color_picker') {
			addEventListeners(document, 'mousemove touchmove', Painter.moveBrushCanvas, false );
			addEventListeners(document, 'mouseup touchend', Painter.stopBrushCanvas, false );
		}
	},
	moveBrushCanvas(event) {
		convertTouchEvent(event);
		var data = Canvas.raycast(event)
		if (data) {
			var texture = data.cube.faces[data.face].getTexture()
			if (texture) {
				var x, y, new_face;
				x = Math.floor( data.intersects[0].uv.x * texture.img.naturalWidth );
				y = Math.floor( (1-data.intersects[0].uv.y) * texture.img.naturalHeight );
				if (texture.img.naturalWidth + texture.img.naturalHeight == 0) return;

				if (x === Painter.current.x && y === Painter.current.y) {
					return
				}
				if (Painter.current.face !== data.face || Painter.current.cube !== data.cube) {
					Painter.current.x = x
					Painter.current.y = y
					Painter.current.face = data.face
					Painter.current.cube = data.cube
					new_face = true
					if (texture !== Painter.current.texture) {
						Undo.current_save.addTexture(texture)
					}
				}
				Painter.drawBrushLine(texture, x, y, event, new_face, data.cube.faces[data.face].uv)
			}
		}
	},
	drawBrushLine(texture, end_x, end_y, event, new_face, uv) {
		var start_x = (Painter.current.x == undefined ? end_x : Painter.current.x);
		var start_y = (Painter.current.y == undefined ? end_y : Painter.current.y);
		
		var diff_x = end_x - start_x;
		var diff_y = end_y - start_y;

		var length = Math.sqrt(diff_x*diff_x + diff_y*diff_y)
		if (new_face && !length) {
			length = 1
		}
		var i = 1;
		var x, y;
		while (i <= length) {
			x = Math.round(start_x + diff_x / length * i)
			y = Math.round(start_y + diff_y / length * i)
			Painter.useBrush(texture, x, y, event, uv, i < length-1);
			i++;
		}
		Painter.current.x = end_x;
		Painter.current.y = end_y;
	},
	stopBrushCanvas() {
		removeEventListeners(document, 'mousemove touchmove', Painter.moveBrushCanvas, false );
		removeEventListeners(document, 'mouseup touchend', Painter.stopBrushCanvas, false );
		Painter.stopBrush();
	},
	startBrush(texture, x, y, uvTag, event, data) {
		if (Toolbox.selected.id === 'color_picker') {
			Painter.colorPicker(texture, x, y)
		} else {
			Undo.initEdit({textures: [texture], bitmap: true});
			Painter.brushChanges = false;
			Painter.painting = true;

			if (data) {
				var is_line = event.shiftKey && Painter.current.cube == data.cube && Painter.current.face == data.face
				Painter.current.cube = data.cube;
				Painter.current.face = data.face;
			} else {
				//uv editor
				var is_line = event.shiftKey;
			}

			if (is_line) {
				Painter.drawBrushLine(texture, x, y, event, false, uvTag);
			} else {
				Painter.current.x = Painter.current.y = 0
				Painter.useBrush(texture, x, y, event, uvTag)
				Painter.current.x = x;
				Painter.current.y = y;
			}
		}
	},
	getCanvas(texture) {
		var c = document.createElement('canvas')
		var ctx = c.getContext('2d');
		c.width = texture.width;
		c.height = texture.height;
		ctx.drawImage(texture instanceof Texture ? texture.img : texture, 0, 0)
		return c;
	},
	colorPicker(texture, x, y) {
		var ctx = Painter.getCanvas(texture).getContext('2d')
		Painter.scanCanvas(ctx, x, y, 1, 1, (x, y, px) => {
			var t = tinycolor({
				r: px[0],
				g: px[1],
				b: px[2],
				a: px[3]/256
			})
			ColorPanel.set(t)
		})
	},
	useBrush(texture, x, y, event, uvTag, no_update) {
		if ((Painter.currentPixel[0] !== x || Painter.currentPixel[1] !== y)) {
			Painter.currentPixel = [x, y]
			Painter.brushChanges = true;

			texture.edit(function(canvas) {
				var ctx = canvas.getContext('2d')
				ctx.save()

				var color = tinycolor(ColorPanel.get()).toRgb();
				var size = BarItems.slider_brush_size.get();
				let softness = BarItems.slider_brush_softness.get()/100;
				let b_opacity = BarItems.slider_brush_opacity.get()/100;
				let m_opacity = BarItems.slider_brush_min_opacity.value/100;
				let tool = Toolbox.selected.id;
				let noise = BarItems.brush_mode.get() == 'noise';

				ctx.beginPath();
				if (uvTag) {
					var rect = Painter.editing_area = [
						uvTag[0] / Project.texture_width * texture.img.naturalWidth,
						uvTag[1] / Project.texture_height * texture.img.naturalHeight,
						uvTag[2] / Project.texture_width * texture.img.naturalWidth,
						uvTag[3] / Project.texture_height * texture.img.naturalHeight
					]
				} else {
					var rect = Painter.editing_area = [0, 0, texture.img.naturalWidth, texture.img.naturalHeight]
				}
				for (var t = 0; t < 2; t++) {
					if (rect[t] > rect[t+2]) {
						[rect[t], rect[t+2]] = [rect[t+2], rect[t]]
					}
					rect[t] = Math.round(rect[t])
					rect[t+2] = Math.round(rect[t+2])
				}
				var [w, h] = [rect[2] - rect[0], rect[3] - rect[1]]
				ctx.rect(rect[0], rect[1], w, h)

				if (tool === 'fill_tool') {

					ctx.fillStyle = tinycolor(ColorPanel.get()).setAlpha(b_opacity).toRgbString();

					var fill_mode = BarItems.fill_mode.get()
					var cube = Painter.current.cube;
					if (cube && fill_mode === 'cube') {
						for (var face in cube.faces) {
							var tag = cube.faces[face]
							if (tag.texture === Painter.current.texture.uuid) {
								var rect = getRectangle(
									Math.floor(tag.uv[0] / Project.texture_width * texture.img.naturalWidth),
									Math.floor(tag.uv[1] / Project.texture_height * texture.img.naturalHeight),
									Math.ceil(tag.uv[2] / Project.texture_width * texture.img.naturalWidth),
									Math.ceil(tag.uv[3] / Project.texture_height * texture.img.naturalHeight)
								)
								ctx.rect(rect.ax, rect.ay, rect.x, rect.y)
								ctx.fill()
							}
						}

					} else if (fill_mode === 'face') {
						ctx.fill()
					} else {

						var pxcol = [];
						var map = {}
						Painter.scanCanvas(ctx, x, y, 1, 1, (x, y, px) => {
							px.forEach((val, i) => {
								pxcol[i] = val
							})
						})
						Painter.scanCanvas(ctx, rect[0], rect[1], w, h, (x, y, px) => {
							if (pxcol.equals(px)) {
								if (!map[x]) map[x] = {}
								map[x][y] = true
							}
						})
						function checkPx(x, y) {
							if (map[x] && map[x][y]) {
								map[x][y] = false;

								checkPx(x+1, y)
								checkPx(x-1, y)
								checkPx(x, y+1)
								checkPx(x, y-1)
							}
						}
						checkPx(x, y)
						Painter.scanCanvas(ctx, rect[0], rect[1], w, h, (x, y, px) => {
							if (map[x] && map[x][y] === false) {
								var pxcolor = {
									r: px[0],
									g: px[1],
									b: px[2],
									a: px[3]/255
								}
								var result_color = Painter.combineColors(pxcolor, color, b_opacity);
								px[0] = result_color.r
								px[1] = result_color.g
								px[2] = result_color.b
								px[3] = result_color.a*255
							}
						})
					}
				} else {
					ctx.clip()
					if (event.touches && event.touches[0] && event.touches[0].force) {
						var touch = event.touches[0];
						if (touch.force == 1) touch.force == Painter.current.force || 0;
						Painter.current.force = touch.force;

						if (settings.brush_opacity_modifier.value == 'pressure' && touch.force) {
							b_opacity = Math.clamp(b_opacity * touch.force*1.25, 0, 100);
							m_opacity = Math.clamp(m_opacity * touch.force*1.25, 0, 100);

						} else if (settings.brush_opacity_modifier.value == 'tilt' && touch.altitudeAngle !== undefined) {
							var modifier = Math.clamp(1.5 / (touch.altitudeAngle + 0.3), 1, 4)/2;
							b_opacity = Math.clamp(b_opacity * modifier, 0, 100);
							m_opacity = Math.clamp(m_opacity * modifier, 0, 100);
						}
						if (settings.brush_size_modifier.value == 'pressure' && touch.force) {
							size = Math.clamp(touch.force * size * 2, 1, 20);

						} else if (settings.brush_size_modifier.value == 'tilt' && touch.altitudeAngle !== undefined) {
							size *= Math.clamp(1.5 / (touch.altitudeAngle + 0.3), 1, 4);
						}
					}

					if (tool === 'brush_tool') {
						Painter.editCircle(ctx, x, y, size, softness, function(pxcolor, opacity, px, py) {
							if (pxcolor.a == 0 && window.alphalock) return pxcolor;
							var a = noise
								  ? Math.randomab(m_opacity, b_opacity) * opacity
								  : b_opacity * opacity;
							var before = Painter.getAlphaMatrix(texture, px, py)
							Painter.setAlphaMatrix(texture, px, py, a);
							if (before) a = Math.clamp(a-before, 0, 1);
							var result_color = Painter.combineColors(pxcolor, color, a);
							return result_color;
						})
					} else if (tool === 'eraser') {
						Painter.editCircle(ctx, x, y, size, softness, function(pxcolor, opacity) {
							var a = noise
								  ? Math.randomab(m_opacity, b_opacity)
								  : b_opacity;
							return {r: pxcolor.r, g: pxcolor.g, b: pxcolor.b, a: pxcolor.a*(1-a)};
						})
					}
					ctx.restore();
				}
				Painter.editing_area = undefined;

			}, {method: 'canvas', no_undo: true, use_cache: true, no_update});
		}
	},
	stopBrush() {
		if (Painter.brushChanges) {
			Undo.finishEdit('paint');
			Painter.brushChanges = false;
		}
		delete Painter.current.alpha_matrix;
		Painter.painting = false;
		Painter.currentPixel = [-1, -1];
	},
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
	},
	updateNslideValues() {
		BarItems.slider_brush_size.update()
		BarItems.slider_brush_softness.update()
		BarItems.slider_brush_opacity.update()
		BarItems.slider_brush_min_opacity.update()
	},
	scanCanvas(ctx, x, y, w, h, cb) {
		var arr = ctx.getImageData(x, y, w, h)
		for (var i = 0; i < arr.data.length; i += 4) {
			var pixel = arr.data.slice(i, i+4)

			var px = (i/4) % w
			var py = Math.floor((i/4) / w)
			pixel = cb(x+px, y+py, pixel)||pixel

			pixel.forEach((p, pi) => {
				arr.data[i+pi] = p
			})
		}
		ctx.putImageData(arr, x, y)
	},
	drawRectangle(image, color, rect) {
		var color = Jimp.intToRGBA(color)
		image.scan(rect.x, rect.y, rect.w, rect.h, function (x, y, idx) {
			this.bitmap.data[idx + 0] = color.r
			this.bitmap.data[idx + 1] = color.g
			this.bitmap.data[idx + 2] = color.b
			this.bitmap.data[idx + 3] = color.a
		});
	},
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
	},
	editCircle(ctx, x, y, r, s, editPx) {
		r = Math.round(r)

		Painter.scanCanvas(ctx, x-r-1, y-r-1, 2*r+3, 2*r+3, function (px, py, pixel) {

			if (px >= ctx.canvas.width ||
				px < 0 ||
				py >= ctx.canvas.height ||
				py < 0
			) {
				return;
			}
			if (
				settings.paint_side_restrict.value &&
				Painter.editing_area && 
				typeof Painter.editing_area === 'object' &&
				(
					px+0.02 < Math.floor(Painter.editing_area[0]) ||
					py+0.02 < Math.floor(Painter.editing_area[1]) ||
					px+0.02 >= Painter.editing_area[2] ||
					py+0.02 >= Painter.editing_area[3]
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
					r: pixel[0],
					g: pixel[1],
					b: pixel[2],
					a: pixel[3]/255
				}, opacity, px+x, py+y)
				pixel[0] = result_color.r
				pixel[1] = result_color.g
				pixel[2] = result_color.b
				pixel[3] = result_color.a*255
			}
		});
	},
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
}
const TextureGenerator = {
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
			form: {
				name: 		{label: 'generic.name', value: 'texture'},
				folder: 	{label: 'dialog.create_texture.folder'},
				template:	{label: 'dialog.create_texture.template', type: 'checkbox', condition: Cube.all.length}
			},
			onConfirm: function(results) {
				results.particle = 'auto';
				dialog.hide()
				if (results.template) {
					var dialog2 = new Dialog({
						id: 'texture_template',
						title: tl('dialog.create_texture.template'),
						form: {
							compress: 	{label: 'dialog.create_texture.compress', type: 'checkbox', value: true, condition: Project.box_uv},
							power: 		{label: 'dialog.create_texture.power', type: 'checkbox', value: true},
							double_use: {label: 'dialog.create_texture.double_use', type: 'checkbox', value: true, condition: Project.box_uv},
							box_uv: 	{label: 'dialog.project.box_uv', type: 'checkbox', value: false, condition: !Project.box_uv},
							color: 		{label: 'data.color', type: 'color', colorpicker: Painter.background_color},
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
					if (Painter.background_color.get().toHex8() === 'ffffffff') {
						Painter.background_color.set('#00000000')
					}
				} else {
					var dialog2 = new Dialog({
						id: 'texture_simple',
						title: tl('action.create_texture'),
						form: {
							color: 		{label: 'data.color', type: 'color', colorpicker: Painter.background_color},
							resolution: {label: 'dialog.create_texture.resolution', type: 'number', value: 16, min: 16, max: 2048},
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
		if (isNaN(options.resolution) || !options.resolution) {
			options.resolution = 16
		}
		if (options.color === undefined) {
			options.color = new tinycolor().toRgb()
		}
		if (Format.single_texture) {
			options.texture = textures[0]
		}
		var texture = new Texture({
			mode: 'bitmap',
			keep_size: true,
			res: options.resolution,
			name: options.name ? options.name : 'texture',
			folder: options.folder ? options.folder : 'block'
		})
		function makeTexture(dataUrl) {
			texture.fromDataURL(dataUrl).add(false)
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
				Undo.finishEdit('create blank texture', {textures: [texture], bitmap: true})
			}
			return texture;
		}
		if (options.template === true) {
			Undo.initEdit({
				textures: Format.single_texture ? textures : [],
				elements: Format.single_texture ? Cube.all : Cube.selected,
				uv_only: true,
				uv_mode: true
			})
			if (Project.box_uv || options.box_uv) {
				TextureGenerator.generateTemplate(options, makeTexture)
			} else {
				TextureGenerator.generateFaceTemplate(options, makeTexture)
			}
		} else {
			Undo.initEdit({textures: []})
			TextureGenerator.generateBlank(options.resolution, options.resolution, options.color, makeTexture)
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
	boxUVCubeTemplate: function(obj, min_size) {
		this.x = obj.size(0, true) || min_size;
		this.y = obj.size(1, true) || min_size;
		this.z = obj.size(2, true) || min_size;
		this.posx = obj.uv_offset[0];
		this.posy = obj.uv_offset[1];
		this.obj = obj;
		this.template_size = (obj.size(2, true) + obj.size(1, true))+ (obj.size(2, true) + obj.size(0, true))*2;

		this.height = this.z + this.y;
		this.width = 2* (this.x + this.z);
		return this;	
	},
	generateTemplate(options, cb) {
		var res = options.resolution;
		var background_color = options.color;
		var texture = options.texture;
		var min_size = Project.box_uv ? 0 : 1;
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
				if (options.double_use && Project.box_uv && textures.length) {
					var double_key = [...obj.uv_offset, ...obj.size(undefined, true), ].join('_')
					if (doubles[double_key]) {
						doubles[double_key].push(template)
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
				for (var x = 0; x < tpl.width; x++) {		
					for (var y = 0; y < tpl.height; y++) {
						if (y >= tpl.z || (x >= tpl.z && x < (tpl.z + 2*tpl.x))) {
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
					max_height = Math.max(max_height, t.height)
				})
				//Place
				temps.forEach(function(t) {
					if (y_pos > 0 && (y_pos + t.height) <= max_height) {
						//same column
						t.posx = x_pos
						t.posy = y_pos + extend_y
						filled_x_pos = Math.max(filled_x_pos, x_pos+t.width)
						y_pos += t.height
					} else {
						//new column
						x_pos = filled_x_pos
						y_pos = t.height
						t.posx = x_pos
						t.posy = extend_y
						filled_x_pos = Math.max(filled_x_pos, x_pos+t.width)
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
		Project.texture_width = Project.texture_height = max_size;

		templates.forEach(function(t) {
			t.obj.uv_offset[0] = t.posx;
			t.obj.uv_offset[1] = t.posy;
			t.obj.mirror_uv = false;
			TextureGenerator.paintCubeBoxTemplate(t.obj, texture, canvas, t);
		})
		var dataUrl = canvas.toDataURL()
		var texture = cb(dataUrl)
		if (texture && !Project.single_texture) {
			templates.forEach(function(t) {
				t.obj.applyTexture(texture, true)
				t.obj.autouv = 0
			})
		}
		if (options.box_uv && !Project.box_uv) {
			Project.box_uv = true;
		}
		updateSelection()
		Undo.finishEdit('create template', {
			textures: [texture],
			bitmap: true,
			elements: Format.single_texture ? Cube.all : Cube.selected,
			uv_only: true,
			uv_mode: true
		})
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
		if (coords.w*res_multiple > 2 && coords.h*res_multiple > 2 && color) {
			ctx.fillStyle = color
			ctx.fillRect(
				coords.x * res_multiple + 1,
				coords.y * res_multiple + 1,
				coords.w * res_multiple - 2,
				coords.h * res_multiple - 2
			)
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
	},
	paintCubeBoxTemplate(cube, texture, canvas, template) {

		if (!template) {
			template = new TextureGenerator.boxUVCubeTemplate(cube, Project.box_uv ? 0 : 1);
		}
		
		for (var face in TextureGenerator.face_data) {
			let d = TextureGenerator.face_data[face]
			
			if (!cube.faces[face].texture ||
				!TextureGenerator.boxUVdrawTexture(cube.faces[face], d.place(template), texture, canvas)
			) {
				TextureGenerator.boxUVdrawTemplateRectangle(d.c1, d.c2, cube.faces[face], d.place(template), texture, canvas)
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
	generateFaceTemplate(options, cb) {

		var res_multiple = options.resolution / 16;
		var background_color = options.color;
		var texture = options.texture;

		var face_list = [];
		function faceRect(cube, face_key, tex, x, y) {
			this.cube = cube;
			this.width  = Math.abs(x) * res_multiple;
			this.height = Math.abs(y) * res_multiple;
			this.width  = (this.width  >= 0.01 && this.width  < 1) ? 1 : Math.round(this.width );
			this.height = (this.height >= 0.01 && this.height < 1) ? 1 : Math.round(this.height);
			this.size = this.width * this.height;
			this.face_key = face_key;
			this.texture = tex
			this.face = cube.faces[face_key];
			face_list.push(this);
		}

		var cube_array = Format.single_texture ? Cube.all : Cube.selected;
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
				for (var x = 0; x < tpl.width; x++) {		
					for (var y = 0; y < tpl.height; y++) {
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
				texture = textures[0];
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
			if (!ftemp.texture ||
				!drawTexture(ftemp.face, pos)
			) {
				drawTemplateRectangle(d.c1, d.c2, ftemp.face, pos)
			}
			var flip_rotation = ftemp.face.rotation % 180 != 0;
			ftemp.face.extend({
				rotation: 0,
				uv: flip_rotation ? [pos.y, pos.x] : [pos.x, pos.y]
			})
			ftemp.face.uv_size = flip_rotation ? [pos.h, pos.w] : [pos.w, pos.h];
		})
		var dataUrl = canvas.toDataURL()
		var texture = cb(dataUrl)
		Project.texture_width = Project.texture_height = max_size / res_multiple;
		if (texture && !Format.single_texture) {
			cube_array.forEach(function(cube) {
				for (var key in cube.faces) {
					if (cube.faces[key].texture !== null) {
						cube.faces[key].texture = texture.uuid;
					}
				}
				Canvas.adaptObjectFaces(cube)
				Canvas.updateUV(cube)
				cube.autouv = 0
			})
		}
		updateSelection()
		Undo.finishEdit('create template', {
			textures: [texture],
			bitmap: true,
			elements: cube_array,
			uv_only: true,
			uv_mode: true
		})
	}
}

BARS.defineActions(function() {

	new Tool('brush_tool', {
		icon: 'fa-paint-brush',
		category: 'tools',
		toolbar: 'brush',
		alt_tool: 'color_picker',
		cursor: 'crosshair',
		selectFace: true,
		transformerMode: 'hidden',
		paintTool: true,
		allowWireframe: false,
		keybind: new Keybind({key: 66}),
		modes: ['paint'],
		onCanvasClick: function(data) {
			Painter.startBrushCanvas(data, data.event)
		},
		onSelect: function() {
			Painter.updateNslideValues()
			$('.UVEditor').find('#uv_size').hide()
		},
		onUnselect: function() {
			$('.UVEditor').find('#uv_size').show()
		}
	})
	new Tool('fill_tool', {
		icon: 'format_color_fill',
		category: 'tools',
		toolbar: 'brush',
		alt_tool: 'color_picker',
		cursor: 'crosshair',
		selectFace: true,
		transformerMode: 'hidden',
		paintTool: true,
		allowWireframe: false,
		modes: ['paint'],
		onCanvasClick: function(data) {
			Painter.startBrushCanvas(data, data.event)
		},
		onSelect: function() {
			Painter.updateNslideValues()
			$('.UVEditor').find('#uv_size').hide()
		},
		onUnselect: function() {
			$('.UVEditor').find('#uv_size').show()
		}
	})
	new Tool('eraser', {
		icon: 'fa-eraser',
		category: 'tools',
		toolbar: 'brush',
		selectFace: true,
		transformerMode: 'hidden',
		cursor: 'crosshair',
		paintTool: true,
		allowWireframe: false,
		modes: ['paint'],
		keybind: new Keybind({key: 69}),
		onCanvasClick: function(data) {
			Painter.startBrushCanvas(data, data.event)
		},
		onSelect: function() {
			Painter.updateNslideValues()
			$('.UVEditor').find('#uv_size').hide()
		},
		onUnselect: function() {
			$('.UVEditor').find('#uv_size').show()
		}
	})
	new Tool('color_picker', {
		icon: 'colorize',
		category: 'tools',
		toolbar: 'brush',
		cursor: 'crosshair',
		selectFace: true,
		transformerMode: 'hidden',
		paintTool: true,
		allowWireframe: false,
		modes: ['paint'],
		onCanvasClick: function(data) {
			Painter.startBrushCanvas(data, data.event)
		},
		onSelect: function() {
			Painter.updateNslideValues()
			$('.UVEditor').find('#uv_size').hide()
		},
		onUnselect: function() {
			$('.UVEditor').find('#uv_size').show()
		}
	})

	new BarSelect('brush_mode', {
		condition: () => Toolbox && (Toolbox.selected.id === 'brush_tool' || Toolbox.selected.id === 'eraser'),
		onChange() {
			BARS.updateConditions();
			Painter.updateNslideValues()
		},
		options: {
			brush: true,
			noise: true
		}
	})
	new BarSelect('fill_mode', {
		condition: () => Toolbox && Toolbox.selected.id === 'fill_tool',
		options: {
			face: true,
			color: true,
			cube: true
		}
	})

	new Action('painting_grid', {
		name: tl('settings.painting_grid'),
		description: tl('settings.painting_grid.desc'),
		label: true,
		icon: 'check_box',
		category: 'view',
		condition: () => Modes.paint,
		keybind: new Keybind({key: 71}),
		linked_setting: 'painting_grid',
		click: function () {
			BarItems.painting_grid.toggleLinkedSetting()
			Cube.all.forEach(cube => {
				Canvas.buildGridBox(cube)
			})
		}
	})

	new NumSlider('slider_brush_size', {
		condition: () => (Toolbox && ['brush_tool', 'eraser'].includes(Toolbox.selected.id)),
		settings: {
			min: 1, max: 20, interval: 1, default: 1,
		}
	})
	new NumSlider('slider_brush_softness', {
		condition: () => (Toolbox && ['brush_tool', 'eraser'].includes(Toolbox.selected.id)),
		settings: {
			min: 0, max: 100, default: 0,
			interval: function(event) {
				if (event.shiftKey && event.ctrlOrCmd) {
					return 0.25;
				} else if (event.shiftKey) {
					return 5;
				} else if (event.ctrlOrCmd) {
					return 1;
				} else {
					return 10;
				}
			}
		}
	})
	new NumSlider('slider_brush_opacity', {
		condition: () => (Toolbox && ['brush_tool', 'eraser', 'fill_tool'].includes(Toolbox.selected.id)),
		settings: {
			min: 0, max: 100, default: 100,
			interval: function(event) {
				if (event.shiftKey && event.ctrlOrCmd) {
					return 0.25;
				} else if (event.shiftKey) {
					return 5;
				} else if (event.ctrlOrCmd) {
					return 1;
				} else {
					return 10;
				}
			}
		}
	})
	new NumSlider('slider_brush_min_opacity', {
		condition: () => (Toolbox && ['brush_tool', 'eraser'].includes(Toolbox.selected.id) && BarItems.brush_mode.value == 'noise'),
		settings: {
			min: 0, max: 100, default: 50,
			interval: function(event) {
				if (event.shiftKey && event.ctrlOrCmd) {
					return 0.25;
				} else if (event.shiftKey) {
					return 5;
				} else if (event.ctrlOrCmd) {
					return 1;
				} else {
					return 10;
				}
			}
		}
	})
})
