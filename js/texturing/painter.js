const Painter = {
	currentPixel: [-1, -1],
	brushChanges: false,
	current: {/*texture, image*/},
	selection: {},
	mirror_painting: false,
	lock_alpha: false,
	edit(texture, cb, options) {
		if (!options.no_undo) {
			Undo.initEdit({textures: [texture], bitmap: true})
		}
		if (texture.mode === 'link') {
			texture.source = 'data:image/png;base64,' + texture.getBase64()
			texture.mode = 'bitmap'
			texture.saved = false
		}
		var instance = Painter.current[options.method === 'jimp' ? 'image' : 'canvas']
		Painter.current[options.method === 'jimp' ? 'canvas' : 'image'] = undefined

		var edit_name = options.no_undo ? null : (options.edit_name || 'edit texture');

		if (options.use_cache &&
			texture === Painter.current.texture &&
			typeof instance === 'object'
		) {
			//IS CACHED
			if (options.method === 'jimp') {
				instance = cb(instance) || instance
			} else {
				instance = cb(instance) || instance
			}
			if (options.no_update === true) {
				return;
			}

			if (options.method === 'jimp') {
				Painter.current.image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
					texture.updateSource(dataUrl)
					if (!options.no_undo) {
						Undo.finishEdit(edit_name)
					}
				})
			} else {
				texture.updateSource(instance.toDataURL())
				if (!options.no_undo) {
					Undo.finishEdit(edit_name)
				}
			}
		} else {
			if (options.method === 'jimp') {
				Painter.current.texture = texture
				Jimp.read(Buffer.from(texture.source.replace('data:image/png;base64,', ''), 'base64')).then(function(image) {
					image = cb(image) || image
					Painter.current.image = image
					image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
						texture.updateSource(dataUrl)
						if (!options.no_undo) {
							Undo.finishEdit(edit_name)
						}
					})
				})
			} else {
				Painter.current.texture = texture
				var c = Painter.current.canvas = Painter.getCanvas(texture)
				c = cb(c) || c;

				texture.updateSource(c.toDataURL())
				if (!options.no_undo) {
					Undo.finishEdit(edit_name)
				}
			}
		}
	},

	//alpha
	setAlphaMatrix(texture, x, y, val) {
		if (!Painter.current.alpha_matrix) Painter.current.alpha_matrix = {}
		var mx = Painter.current.alpha_matrix;
		if (!mx[texture.uuid]) mx[texture.uuid] = {};
		if (!mx[texture.uuid][x]) mx[texture.uuid][x] = {};
		if (mx[texture.uuid][x][y]) {
			val = Math.max(val, mx[texture.uuid][x][y])
		}
		mx[texture.uuid][x][y] = val
	},
	getAlphaMatrix(texture, x, y) {
		return Painter.current.alpha_matrix
			&& Painter.current.alpha_matrix[texture.uuid]
			&& Painter.current.alpha_matrix[texture.uuid][x]
			&& Painter.current.alpha_matrix[texture.uuid][x][y];
	},
	// Preview Brush
	startPaintToolCanvas(data, e) {
		if (!data && Toolbox.selected.id == 'color_picker') {
			var preview = Preview.selected;
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
		if (!data || (data.cube && data.cube.locked)) return;
		var texture = data.cube.faces[data.face].getTexture()
		if (!texture || (texture.error && texture.error !== 2)) {
			Blockbench.showQuickMessage('message.untextured')
			return;
		}
		let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brushTool ? 0.5 : 0;
		var x = Math.floor( data.intersects[0].uv.x * texture.img.naturalWidth + offset )
		var y = Math.floor( (1-data.intersects[0].uv.y) * texture.img.naturalHeight + offset )
		Painter.startPaintTool(texture, x, y, data.cube.faces[data.face].uv, e, data)

		if (Toolbox.selected.id !== 'color_picker') {
			addEventListeners(document, 'mousemove touchmove', Painter.movePaintToolCanvas, false );
			addEventListeners(document, 'mouseup touchend', Painter.stopPaintToolCanvas, false );
		}
	},
	movePaintToolCanvas(event) {
		convertTouchEvent(event);
		var data = Canvas.raycast(event)
		if (data && data.cube && !data.cube.locked) {
			var texture = data.cube.faces[data.face].getTexture()
			if (texture) {
				var x, y, new_face;
				let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brushTool ? 0.5 : 0;
				x = Math.floor( data.intersects[0].uv.x * texture.img.naturalWidth + offset );
				y = Math.floor( (1-data.intersects[0].uv.y) * texture.img.naturalHeight + offset );
				if (texture.img.naturalWidth + texture.img.naturalHeight == 0) return;

				if (x === Painter.current.x && y === Painter.current.y) {
					return
				}
				if (Painter.current.face !== data.face || Painter.current.cube !== data.cube) {
					if (Toolbox.selected.id === 'draw_shape_tool') {
						return;
					}
					Painter.current.x = x
					Painter.current.y = y
					Painter.current.face = data.face
					Painter.current.cube = data.cube
					new_face = true
					if (texture !== Painter.current.texture) {
						Undo.current_save.addTexture(texture)
					}
				}
				Painter.movePaintTool(texture, x, y, event, new_face, data.cube.faces[data.face].uv)
			}
		}
	},
	stopPaintToolCanvas() {
		removeEventListeners(document, 'mousemove touchmove', Painter.movePaintToolCanvas, false );
		removeEventListeners(document, 'mouseup touchend', Painter.stopPaintToolCanvas, false );
		Painter.stopPaintTool();
	},
	// Paint Tool Main
	startPaintTool(texture, x, y, uvTag, event, data) {
		//Called directly by startPaintToolCanvas and startBrushUV
		if (Toolbox.selected.id === 'color_picker') {
			Painter.colorPicker(texture, x, y)
		} else if (Toolbox.selected.id === 'draw_shape_tool') {

			Undo.initEdit({textures: [texture], selected_texture: true, bitmap: true});
			Painter.brushChanges = false;
			Painter.painting = true;
			Painter.current = {
				cube: data && data.cube,
				face: data && data.face,
				x, y,
				clear: document.createElement('canvas'),
			}
			Painter.startPixel = [x, y];
			Painter.current.clear.width = texture.width;
			Painter.current.clear.height = texture.height;
			Painter.current.clear.getContext('2d').drawImage(texture.img, 0, 0);

		} else {
			Undo.initEdit({textures: [texture], selected_texture: true, bitmap: true});
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
				Painter.useBrushlike(texture, x, y, event, uvTag)
			}
			Painter.current.x = x;
			Painter.current.y = y;
		}
	},
	movePaintTool(texture, x, y, event, new_face, uv) {
		// Called directly from movePaintToolCanvas and moveBrushUV
		if (Toolbox.selected.id === 'draw_shape_tool') {

			Painter.useShapeTool(texture, x, y, event, uv)

		} else {
			Painter.drawBrushLine(texture, x, y, event, new_face, uv)
		}
		Painter.current.x = x;
		Painter.current.y = y;
	},
	stopPaintTool() {
		//Called directly by stopPaintToolCanvas and stopBrushUV
		if (Painter.brushChanges) {
			Undo.finishEdit('paint');
			Painter.brushChanges = false;
		}
		delete Painter.current.alpha_matrix;
		Painter.painting = false;
		Painter.currentPixel = [-1, -1];
	},
	// Tools
	useBrushlike(texture, x, y, event, uvTag, no_update, is_opposite) {
		if (Painter.currentPixel[0] === x && Painter.currentPixel[1] === y) return;
		Painter.currentPixel = [x, y]
		Painter.brushChanges = true;
		let uvFactorX = 1 / Project.texture_width * texture.width;
		let uvFactorY = 1 / Project.texture_height * texture.display_height;

		if (Painter.mirror_painting && !is_opposite) {
			Painter.runMirrorBrush(texture, x, y, event, uvTag);
		}

		texture.edit(function(canvas) {
			var ctx = canvas.getContext('2d')
			ctx.save()

			ctx.beginPath();
			if (uvTag) {
				let anim_offset = texture.display_height * texture.currentFrame;
				var rect = Painter.editing_area = [
					uvTag[0] * uvFactorX,
					uvTag[1] * uvFactorY + anim_offset,
					uvTag[2] * uvFactorX,
					uvTag[3] * uvFactorY + anim_offset
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

			if (Toolbox.selected.id === 'fill_tool') {
				Painter.useFilltool(texture, ctx, x, y, { rect, uvFactorX, uvFactorY, w, h })
			} else {
				Painter.useBrush(texture, ctx, x, y, event)
			}
			Painter.editing_area = undefined;


		}, {no_undo: true, use_cache: true, no_update});
	},
	useBrush(texture, ctx, x, y, event) {

		var color = tinycolor(ColorPanel.get()).toRgb();
		var size = BarItems.slider_brush_size.get();
		let softness = BarItems.slider_brush_softness.get()/100;
		let b_opacity = BarItems.slider_brush_opacity.get()/100;
		let tool = Toolbox.selected.id;

		ctx.clip()
		if (event.touches && event.touches[0] && event.touches[0].touchType == 'stylus' && event.touches[0].force) {

			// Stylus
			var touch = event.touches[0];
			if (touch.force == 1) touch.force == Painter.current.force || 0;
			Painter.current.force = touch.force;

			if (settings.brush_opacity_modifier.value == 'pressure' && touch.force) {
				b_opacity = Math.clamp(b_opacity * touch.force*1.25, 0, 100);

			} else if (settings.brush_opacity_modifier.value == 'tilt' && touch.altitudeAngle !== undefined) {
				var modifier = Math.clamp(1.5 / (touch.altitudeAngle + 0.3), 1, 4)/2;
				b_opacity = Math.clamp(b_opacity * modifier, 0, 100);
			}
			if (settings.brush_size_modifier.value == 'pressure' && touch.force) {
				size = Math.clamp(touch.force * size * 2, 1, 20);

			} else if (settings.brush_size_modifier.value == 'tilt' && touch.altitudeAngle !== undefined) {
				size *= Math.clamp(1.5 / (touch.altitudeAngle + 0.3), 1, 4);
			}
		}

		if (tool === 'brush_tool') {
			Painter.editCircle(ctx, x, y, size, softness, function(pxcolor, opacity, px, py) {
				var a = b_opacity * opacity;
				var before = Painter.getAlphaMatrix(texture, px, py)
				Painter.setAlphaMatrix(texture, px, py, a);
				if (a > before) {
					a = (a - before) / (1 - before);
				} else if (before) {
					a = 0;
				}
				var result_color = Painter.combineColors(pxcolor, color, a);
				if (Painter.lock_alpha) result_color.a = pxcolor.a
				return result_color;
			})
		} else if (tool === 'eraser') {
			Painter.editCircle(ctx, x, y, size, softness, function(pxcolor, opacity, px, py) {
				if (Painter.lock_alpha) return pxcolor;

				var a = b_opacity * opacity;

				var before = Painter.getAlphaMatrix(texture, px, py)
				Painter.setAlphaMatrix(texture, px, py, a);

				if (a > before) {
					a = (a - before) / (1 - before);
				} else if (before) {
					a = 0;
				}
				pxcolor.a = Math.clamp(pxcolor.a * (1-a), 0, 1);
				return pxcolor;

			})
		}
		ctx.restore();
	},
	useFilltool(texture, ctx, x, y, area) {
		
		var color = tinycolor(ColorPanel.get()).toRgb();
		let b_opacity = BarItems.slider_brush_opacity.get()/100;
		let tool = Toolbox.selected.id;

		let {rect, uvFactorX, uvFactorY, w, h} = area;

		ctx.fillStyle = tinycolor(ColorPanel.get()).setAlpha(b_opacity).toRgbString();

		var fill_mode = BarItems.fill_mode.get()
		var cube = Painter.current.cube;
		if (cube && fill_mode === 'cube') {
			for (var face in cube.faces) {
				var tag = cube.faces[face]
				ctx.beginPath();
				if (tag.getTexture() === texture) {
					var face_rect = getRectangle(
						Math.floor(tag.uv[0] * uvFactorX),
						Math.floor(tag.uv[1] * uvFactorY),
						Math.ceil(tag.uv[2]  * uvFactorX),
						Math.ceil(tag.uv[3]  * uvFactorY)
					)
					ctx.rect(face_rect.ax, face_rect.ay, face_rect.x, face_rect.y)
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
			var scan_value = true;
			if (fill_mode === 'color_connected') {
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
				scan_value = false;
			}
			Painter.scanCanvas(ctx, rect[0], rect[1], w, h, (x, y, px) => {
				if (map[x] && map[x][y] === scan_value) {
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
					if (!Painter.lock_alpha) px[3] = result_color.a*255
				}
			})
		}
	},
	runMirrorBrush(texture, x, y, event, uvTag) {
		if (uvTag && Painter.current.cube) {
			let mirror_cube = Painter.getMirrorCube(Painter.current.cube);
			if (mirror_cube) {

				let uvFactorX = 1 / Project.texture_width * texture.img.naturalWidth;
				let uvFactorY = 1 / Project.texture_height * texture.img.naturalHeight;

				let face = Painter.current.face;
				let side_face = (face === 'west' || face === 'east')
				if (side_face) face = Face.opposite[face];
				face = mirror_cube.faces[face];

				if (side_face &&
					uvTag[1] === face.uv[1] && uvTag[3] === face.uv[3] &&
					Math.min(uvTag[0], uvTag[2]) === Math.min(face.uv[0], face.uv[2])
					//same face
				) return;

				//calculate original point
				var point_on_uv = [
					x - Math.min(uvTag[0], uvTag[2]) * uvFactorX,
					y - Math.min(uvTag[1], uvTag[3]) * uvFactorY,
				]
				//calculate new point
				if (face.uv[0] > face.uv[0+2] == uvTag[0] > uvTag[0+2]) {
					point_on_uv[0] = Math.max(face.uv[0], face.uv[0+2]) * uvFactorX - point_on_uv[0] - 1;
					if (BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brushTool) point_on_uv[0] += 1
				} else {
					point_on_uv[0] = Math.min(face.uv[0], face.uv[0+2]) * uvFactorX + point_on_uv[0];
				}
				if (face.uv[1] > face.uv[1+2] == uvTag[1] > uvTag[1+2]) {
					point_on_uv[1] = Math.min(face.uv[1], face.uv[1+2]) * uvFactorY + point_on_uv[1];
				} else {
					point_on_uv[1] = Math.max(face.uv[1], face.uv[1+2]) * uvFactorY - point_on_uv[1] - 1;
				}

				let cube = Painter.current.cube;
				Painter.current.cube = mirror_cube;
				Painter.useBrushlike(texture, ...point_on_uv, event, face.uv, true, true);
				Painter.current.cube = cube;
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
			Painter.useBrushlike(texture, x, y, event, uv, i < length-1);
			i++;
		}
	},
	useShapeTool(texture, x, y, event, uvTag) {
		Painter.brushChanges = true;

		texture.edit(function(canvas) {
			var ctx = canvas.getContext('2d')
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(Painter.current.clear, 0, 0)

			let color = tinycolor(ColorPanel.get()).toRgb();
			let b_opacity = BarItems.slider_brush_opacity.get()/100;
			var width = BarItems.slider_brush_size.get();
			let shape = BarItems.draw_shape_type.get();
			let hollow = shape.substr(-1) == 'h';
			shape = shape.replace(/_h$/, '');

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


			
			let diff_x = x - Painter.startPixel[0];
			let diff_y = y - Painter.startPixel[1];

			if (event.shiftKey) {
				let clamp = Math.floor((Math.abs(diff_x) + Math.abs(diff_y))/2);
				diff_x = diff_x>0 ? clamp : -clamp;
				diff_y = diff_y>0 ? clamp : -clamp;
			}

			if (shape === 'rectangle') {
				ctx.strokeStyle = ctx.fillStyle = tinycolor(ColorPanel.get()).setAlpha(b_opacity).toRgbString();
				ctx.lineWidth = width;
				ctx.beginPath();
				var rect = getRectangle(Painter.startPixel[0], Painter.startPixel[1], Painter.startPixel[0]+diff_x, Painter.startPixel[1]+diff_y);
				
				if (hollow) {
					ctx.rect(rect.ax+(width%2 ? 0.5 : 1), rect.ay+(width%2 ? 0.5 : 1), rect.x, rect.y);
					ctx.stroke();
				} else {
					ctx.rect(rect.ax, rect.ay, rect.x+1, rect.y+1);
					ctx.fill();
				}
			} else if (shape === 'ellipse') {
				Painter.modifyCanvasSection(ctx, rect[0], rect[1], w, h, (changePixel) => {
					//changePixel(0, 0, editPx)
					function editPx(pxcolor) {
						return Painter.combineColors(pxcolor, color, b_opacity);
					}
					if (hollow) {
						let r_min = Math.trunc(-width/2);
						let r_max = Math.ceil(width/2);
						for (var diff_x_m = diff_x+r_min; diff_x_m < diff_x+r_max; diff_x_m++) {
							for (var diff_y_m = diff_y+r_min; diff_y_m < diff_y+r_max; diff_y_m++) {
								for (var i = 0; i < Math.abs(diff_x_m); i++) {
									for (var j = 0; j < 4; j++) {
										changePixel(
											Painter.startPixel[0] + (j<2?1:-1) * i,
											Painter.startPixel[1] + (j%2?1:-1) * Math.round(Math.cos(Math.asin(i / Math.abs(diff_x_m))) * diff_y_m),
											editPx
										)
									}
								}
								for (var i = 0; i < Math.abs(diff_y_m); i++) {
									for (var j = 0; j < 4; j++) {
										changePixel(
											Painter.startPixel[0] + (j<2?1:-1) * Math.round(Math.sin(Math.acos(i / Math.abs(diff_y_m))) * diff_x_m),
											Painter.startPixel[1] + (j%2?1:-1) * i,
											editPx
										)
									}
								}
							}
						}
					} else {
						diff_x = Math.clamp(diff_x, -64, 64);
						diff_y = Math.clamp(diff_y, -64, 64);
						for (var i = 0; i <= Math.abs(diff_x); i++) {
							let radius = Math.round(Math.cos(Math.asin(i / Math.abs(diff_x))) * Math.abs(diff_y))
							for (var k = 0; k <= radius; k++) {
								for (var j = 0; j < 4; j++) {
									changePixel(
										Painter.startPixel[0] + (j<2?1:-1) * i,
										Painter.startPixel[1] + (j%2?1:-1) * k,
										editPx
									)
								}
							}
						}
						for (var i = 0; i <= Math.abs(diff_y); i++) {
							let radius = Math.round(Math.sin(Math.acos(i / Math.abs(diff_y))) * Math.abs(diff_x))
							for (var k = 0; k <= radius; k++) {
								for (var j = 0; j < 4; j++) {
									changePixel(
										Painter.startPixel[0] + (j<2?1:-1) * k,
										Painter.startPixel[1] + (j%2?1:-1) * i,
										editPx
									)
								}
							}
						}
					}
				})
			}
			//Painter.editing_area = undefined;

		}, {no_undo: true, use_cache: true});
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
	// Util
	combineColors(base, added, opacity) {
		if (Math.isNumber(base)) base = Jimp.intToRGBA(base)
		if (Math.isNumber(added)) added = Jimp.intToRGBA(added)

		if (added.a*opacity == 1) return added

		var original_a = added.a
		added.a = added.a*opacity

		var mix = {};
		mix.a = limitNumber(1 - (1 - added.a) * (1 - base.a), 0, 1); // alpha
		mix.r = Math.round((added.r * added.a / mix.a) + (base.r * base.a * (1 - added.a) / mix.a)); // red
		mix.g = Math.round((added.g * added.a / mix.a) + (base.g * base.a * (1 - added.a) / mix.a)); // green
		mix.b = Math.round((added.b * added.a / mix.a) + (base.b * base.a * (1 - added.a) / mix.a)); // blue

		added.a = original_a
		return mix;
	},
	getMirrorCube(cube) {
		let center = Format.centered_grid ? 0 : 8;
		let e = 0.002
		if (cube.from[0]-center === center-cube.to[0] && !cube.rotation[1] && !cube.rotation[2]) {
			return cube;
		} else {
			for (var cube2 of Cube.all) {
				if (
					cube.inflate === cube2.inflate &&
					Math.epsilon(cube.from[2], cube2.from[2], e) && Math.epsilon(cube.to[2], cube2.to[2], e) &&
					Math.epsilon(cube.from[1], cube2.from[1], e) && Math.epsilon(cube.to[1], cube2.to[1], e) &&
					Math.epsilon(cube.size(0), cube2.size(0), e) && Math.epsilon(cube.to[0]-center, center-cube2.from[0], e)
				) {
					return cube2;
				}
			}
		}
		return false;
	},
	updateNslideValues() {
		BarItems.slider_brush_size.update()
		BarItems.slider_brush_softness.update()
		BarItems.slider_brush_opacity.update()
	},
	getCanvas(texture) {
		var c = document.createElement('canvas')
		var ctx = c.getContext('2d');
		c.width = texture.width;
		c.height = texture.height;
		ctx.drawImage(texture instanceof Texture ? texture.img : texture, 0, 0)
		return c;
	},
	scanCanvas(ctx, x, y, w, h, cb) {
		var arr = ctx.getImageData(x, y, w, h)
		for (var i = 0; i < arr.data.length; i += 4) {
			var pixel = arr.data.slice(i, i+4)

			var px = x + (i/4) % w
			var py = y + Math.floor((i/4) / w)
			if (px >= ctx.canvas.width || px < 0 || py >= ctx.canvas.height || py < 0) continue;
			pixel = cb(px, py, pixel)||pixel

			pixel.forEach((p, pi) => {
				arr.data[i+pi] = p
			})
		}
		ctx.putImageData(arr, x, y)
	},
	modifyCanvasSection(ctx, x, y, w, h, cb) {
		var arr = ctx.getImageData(x, y, w, h)
		var processed = [];

		cb((px, py, editPx) => {
			//changePixel
			px = Math.floor(px)-x;
			py = Math.floor(py)-y;
			if (px < 0 || px >= w) return;
			if (py < 0 || py >= h) return;
			let start = (px + py*w) * 4;
			if (processed.includes(start)) return;
			processed.push(start);
			var result_color = editPx({
				r: arr.data[start+0],
				g: arr.data[start+1],
				b: arr.data[start+2],
				a: arr.data[start+3]/255
			})
			arr.data[start+0] = result_color.r
			arr.data[start+1] = result_color.g
			arr.data[start+2] = result_color.b
			arr.data[start+3] = result_color.a*255
		})

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
	editCircle(ctx, x, y, r, s, editPx) {
		r = Math.round(r+1)/2
		Painter.scanCanvas(ctx, x-Math.ceil(r)-2, y-Math.ceil(r)-2, 2*r+3, 2*r+3, function (px, py, pixel) {
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

			px -= x - r%1;
			py -= y - r%1;

			var distance = Math.sqrt(px*px + py*py)
			if (s*r != 0) {
				var pos_on_gradient = (distance-(1-s)*r) / (s*r)
			} else {
				var pos_on_gradient = Math.floor((distance*1.2)/r)
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
		brushTool: true,
		allowWireframe: false,
		keybind: new Keybind({key: 66}),
		modes: ['paint'],
		onCanvasClick: function(data) {
			Painter.startPaintToolCanvas(data, data.event)
		},
		onSelect: function() {
			Painter.updateNslideValues()
		},
		onUnselect: function() {
			uv_dialog.all_editors.forEach(editor => {
				editor.brush_outline.detach()
			})
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
			Painter.startPaintToolCanvas(data, data.event)
		},
		onSelect: function() {
			Painter.updateNslideValues()
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
		brushTool: true,
		allowWireframe: false,
		modes: ['paint'],
		keybind: new Keybind({key: 69}),
		onCanvasClick: function(data) {
			Painter.startPaintToolCanvas(data, data.event)
		},
		onSelect: function() {
			Painter.updateNslideValues()
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
			Painter.startPaintToolCanvas(data, data.event)
		},
		onSelect: function() {
			Painter.updateNslideValues()
		}
	})
	new Tool('draw_shape_tool', {
		icon: 'fas.fa-shapes',
		category: 'tools',
		toolbar: 'brush',
		alt_tool: 'color_picker',
		cursor: 'crosshair',
		selectFace: true,
		transformerMode: 'hidden',
		paintTool: true,
		allowWireframe: false,
		modes: ['paint'],
		condition: {modes: ['paint']},
		keybind: new Keybind({key: 85}),
		onCanvasClick: function(data) {
			Painter.startPaintToolCanvas(data, data.event)
		},
		onSelect: function() {
			Painter.updateNslideValues()
		}
	})
	new Tool('copy_paste_tool', {
		icon: 'fa-vector-square',
		category: 'tools',
		toolbar: 'brush',
		alt_tool: 'color_picker',
		cursor: 'crosshair',
		selectFace: true,
		transformerMode: 'hidden',
		paintTool: true,
		allowWireframe: false,
		modes: ['paint'],
		condition: {modes: ['paint']},
		keybind: new Keybind({key: 77})
	})

	new BarSelect('draw_shape_type', {
		category: 'paint',
		condition: () => Toolbox && Toolbox.selected.id === 'draw_shape_tool',
		onChange() {
			BARS.updateConditions();
			Painter.updateNslideValues()
		},
		options: {
			rectangle: true,
			rectangle_h: true,
			ellipse: true,
			ellipse_h: true,
		}
	})
	new BarSelect('fill_mode', {
		category: 'paint',
		condition: () => Toolbox && Toolbox.selected.id === 'fill_tool',
		options: {
			face: true,
			cube: true,
			color_connected: true,
			color: true,
		}
	})
	new Action('mirror_painting', {
		label: true,
		icon: 'check_box_outline_blank',
		category: 'paint',
		condition: () => Modes.paint,
		click: function () {
			Painter.mirror_painting = !Painter.mirror_painting;
			this.setIcon(Painter.mirror_painting ? 'check_box' : 'check_box_outline_blank')
		}
	})
	new Action('lock_alpha', {
		icon: 'fas.fa-unlock',
		category: 'paint',
		condition: () => Modes.paint,
		click: function () {
			Painter.lock_alpha = !Painter.lock_alpha;
			this.setIcon(Painter.lock_alpha ? 'fas.fa-lock' : 'fas.fa-unlock')
		}
	})

	new Action('painting_grid', {
		name: tl('settings.painting_grid'),
		description: tl('settings.painting_grid.desc'),
		icon: 'check_box',
		icon_states: ['grid_off', 'grid_on'],
		category: 'view',
		condition: () => Modes.paint,
		keybind: new Keybind({key: 71}),
		linked_setting: 'painting_grid',
		click: function () {
			BarItems.painting_grid.toggleLinkedSetting()
		}
	})

	new NumSlider('slider_brush_size', {
		condition: () => (Toolbox && ['brush_tool', 'eraser', 'draw_shape_tool'].includes(Toolbox.selected.id)),
		tool_setting: 'brush_size',
		category: 'paint',
		settings: {
			min: 1, max: 50, interval: 1, default: 1,
		}
	})
	new NumSlider('slider_brush_softness', {
		category: 'paint',
		condition: () => (Toolbox && ['brush_tool', 'eraser'].includes(Toolbox.selected.id)),
		tool_setting: 'brush_softness',
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
		category: 'paint',
		condition: () => (Toolbox && ['brush_tool', 'eraser', 'fill_tool', 'draw_shape_tool'].includes(Toolbox.selected.id)),
		tool_setting: 'brush_opacity',
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
})
