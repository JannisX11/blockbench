const Painter = {
	currentPixel: [-1, -1],
	brushChanges: false,
	current: {/*texture, image*/},
	selection: {},
	mirror_painting: false,
	lock_alpha: false,
	erase_mode: false,
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
				Painter.current.ctx = c.getContext('2d');
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
		if (!data.intersects && Toolbox.selected.id == 'color_picker') {
			var preview = Preview.selected;
			if (preview && preview.background && preview.background.imgtag) {
				
				let bg_pos = preview.canvas.style.backgroundPosition.split(' ').map(v => parseFloat(v));
				let bg_size = parseFloat(preview.canvas.style.backgroundSize);
				var ctx = Painter.getCanvas(preview.background.imgtag).getContext('2d')
				var pixel_ratio = preview.background.imgtag.width / bg_size;
				var x = (e.offsetX - bg_pos[0]) * pixel_ratio
				var y = (e.offsetY - bg_pos[1]) * pixel_ratio
				if (x >= 0 && y >= 0 && x < preview.background.imgtag.width && y < preview.background.imgtag.height) {
					let color = Painter.getPixelColor(ctx, x, y);
					ColorPanel.set(color);
				}
			}
		}
		if (!data.intersects || (data.element && data.element.locked)) return;
		var texture = data.element.faces[data.face].getTexture()
		if (!texture || (texture.error && texture.error !== 2)) {
			Blockbench.showQuickMessage('message.untextured')
			return;
		}
		let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brushTool ? 0.5 : 0;
		var x = Math.floor( data.intersects[0].uv.x * texture.img.naturalWidth + offset )
		var y = Math.floor( (1-data.intersects[0].uv.y) * texture.img.naturalHeight + offset )
		Painter.startPaintTool(texture, x, y, data.element.faces[data.face].uv, e, data)

		if (Toolbox.selected.id !== 'color_picker') {
			addEventListeners(document, 'mousemove touchmove', Painter.movePaintToolCanvas, false );
			addEventListeners(document, 'mouseup touchend', Painter.stopPaintToolCanvas, false );
		}
	},
	movePaintToolCanvas(event) {
		convertTouchEvent(event);
		var data = Canvas.raycast(event)
		if (data && data.element && !data.element.locked) {
			var texture = data.element.faces[data.face].getTexture()
			if (texture) {
				var x, y, new_face;
				let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brushTool ? 0.5 : 0;
				x = Math.floor( data.intersects[0].uv.x * texture.img.naturalWidth + offset );
				y = Math.floor( (1-data.intersects[0].uv.y) * texture.img.naturalHeight + offset );
				if (texture.img.naturalWidth + texture.img.naturalHeight == 0) return;

				if (x === Painter.current.x && y === Painter.current.y) {
					return
				}
				if (Painter.current.face !== data.face || Painter.current.element !== data.element) {
					if (Toolbox.selected.id === 'draw_shape_tool' || Toolbox.selected.id === 'gradient_tool') {
						return;
					}
					Painter.current.x = x
					Painter.current.y = y
					Painter.current.face = data.face
					Painter.current.element = data.element
					new_face = true
					if (texture !== Painter.current.texture) {
						Undo.current_save.addTexture(texture)
					}
				}
				Painter.movePaintTool(texture, x, y, event, new_face, data.element.faces[data.face].uv)
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
		} else if (Toolbox.selected.id === 'draw_shape_tool' || Toolbox.selected.id === 'gradient_tool') {

			Undo.initEdit({textures: [texture], selected_texture: true, bitmap: true});
			Painter.brushChanges = false;
			Painter.painting = true;
			Painter.current = {
				element: data && data.element,
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
				var is_line = (event.shiftKey || Pressing.overrides.shift) && Painter.current.element == data.element && Painter.current.face == data.face
				Painter.current.element = data.element;
				Painter.current.face = data.face;
			} else {
				//uv editor
				var is_line = (event.shiftKey || Pressing.overrides.shift);
			}

			texture.edit(canvas => {
				if (is_line) {
					Painter.drawBrushLine(texture, x, y, event, false, uvTag);
				} else {
					Painter.current.x = Painter.current.y = 0
					Painter.useBrushlike(texture, x, y, event, uvTag)
				}
				Painter.current.x = x;
				Painter.current.y = y;
			}, {no_undo: true, use_cache: true});
		}
	},
	movePaintTool(texture, x, y, event, new_face, uv) {
		// Called directly from movePaintToolCanvas and moveBrushUV
		if (Toolbox.selected.id === 'draw_shape_tool') {

			Painter.useShapeTool(texture, x, y, event, uv)

		} else if (Toolbox.selected.id === 'gradient_tool') {

			Painter.useGradientTool(texture, x, y, event, uv)

		} else {
			texture.edit(canvas => {
				Painter.drawBrushLine(texture, x, y, event, new_face, uv)
			}, {no_undo: true, use_cache: true});
		}
		Painter.current.x = x;
		Painter.current.y = y;
	},
	stopPaintTool() {
		//Called directly by stopPaintToolCanvas and stopBrushUV
		if (Painter.brushChanges) {
			Undo.finishEdit('Paint texture');
			Painter.brushChanges = false;
		}
		if (Toolbox.selected.id == 'gradient_tool') {
			Blockbench.setStatusBarText();
		}
		delete Painter.current.alpha_matrix;
		Painter.painting = false;
		Painter.currentPixel = [-1, -1];
	},
	// Tools
	setupRectFromFace(uvTag, texture) {
		let rect;
		let uvFactorX = texture.width / Project.texture_width;
		let uvFactorY = texture.display_height / Project.texture_height;
		if (uvTag) {
			let anim_offset = texture.display_height * texture.currentFrame;
			if (uvTag instanceof Array) {
				rect = Painter.editing_area = [
					uvTag[0] * uvFactorX,
					uvTag[1] * uvFactorY + anim_offset,
					uvTag[2] * uvFactorX,
					uvTag[3] * uvFactorY + anim_offset
				]
				for (var t = 0; t < 2; t++) {
					if (rect[t] > rect[t+2]) {
						[rect[t], rect[t+2]] = [rect[t+2], rect[t]]
					}
					rect[t] = Math.floor(Math.roundTo(rect[t], 2))
					rect[t+2] = Math.ceil(Math.roundTo(rect[t+2], 2))
				}
			} else {
				let min_x = Project.texture_width, min_y = Project.texture_height, max_x = 0, max_y = 0;
				for (let vkey in uvTag) {
					min_x = Math.min(min_x, uvTag[vkey][0]); max_x = Math.max(max_x, uvTag[vkey][0]);
					min_y = Math.min(min_y, uvTag[vkey][1]); max_y = Math.max(max_y, uvTag[vkey][1]);
				}
				rect = Painter.editing_area = [
					Math.floor(min_x * uvFactorX),
					Math.floor(min_y * uvFactorY) + anim_offset,
					Math.ceil(max_x * uvFactorX),
					Math.ceil(max_y * uvFactorY) + anim_offset
				]
			}
		} else {
			rect = Painter.editing_area = [0, 0, texture.img.naturalWidth, texture.img.naturalHeight]
		}
		return rect;
	},
	useBrushlike(texture, x, y, event, uvTag, no_update, is_opposite) {
		if (Painter.currentPixel[0] === x && Painter.currentPixel[1] === y) return;
		Painter.currentPixel = [x, y]
		Painter.brushChanges = true;
		let uvFactorX = texture.width / Project.texture_width;
		let uvFactorY = texture.display_height / Project.texture_height;

		if (Painter.mirror_painting && !is_opposite) {
			Painter.runMirrorBrush(texture, x, y, event, uvTag);
		}

		let ctx = Painter.current.ctx;
		ctx.save()

		ctx.beginPath();
		let rect = Painter.setupRectFromFace(uvTag, texture);
		var [w, h] = [rect[2] - rect[0], rect[3] - rect[1]]
		ctx.rect(rect[0], rect[1], w, h)

		if (Toolbox.selected.id === 'fill_tool') {
			Painter.useFilltool(texture, ctx, x, y, { rect, uvFactorX, uvFactorY, w, h })
		} else {
			Painter.useBrush(texture, ctx, x, y, event)
		}
		Painter.editing_area = undefined;
	},
	useBrush(texture, ctx, x, y, event) {

		var color = tinycolor(ColorPanel.get()).toRgb();
		var size = BarItems.slider_brush_size.get();
		let softness = BarItems.slider_brush_softness.get()/100;
		let b_opacity = BarItems.slider_brush_opacity.get()/255;
		let tool = Toolbox.selected.id;

		ctx.clip()
		if (event.touches && event.touches[0] && event.touches[0].touchType == 'stylus' && event.touches[0].force) {

			// Stylus
			var touch = event.touches[0];
			if (touch.force == 1) touch.force == Painter.current.force || 0;
			Painter.current.force = touch.force;

			if (settings.brush_opacity_modifier.value == 'pressure' && touch.force) {
				b_opacity = Math.clamp(b_opacity * Math.clamp(touch.force*1.25, 0, 1), 0, 100);

			} else if (settings.brush_opacity_modifier.value == 'tilt' && touch.altitudeAngle !== undefined) {
				var modifier = Math.clamp(0.5 / (touch.altitudeAngle + 0.3), 0, 1);
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
		let b_opacity = BarItems.slider_brush_opacity.get()/255;
		var fill_mode = BarItems.fill_mode.get()
		var element = Painter.current.element;
		let {rect, uvFactorX, uvFactorY, w, h} = area;

		if (Painter.erase_mode && (fill_mode === 'element' || fill_mode === 'face')) {
			ctx.globalAlpha = b_opacity;
			ctx.fillStyle = 'white';
			ctx.globalCompositeOperation = 'destination-out';
		} else {
			ctx.fillStyle = tinycolor(ColorPanel.get()).setAlpha(b_opacity).toRgbString();
		}

		if (element instanceof Cube && fill_mode === 'element') {
			for (var face in element.faces) {
				var tag = element.faces[face]
				ctx.beginPath();
				if (tag.getTexture() === texture) {
					var face_rect = getRectangle(
						tag.uv[0] * uvFactorX,
						tag.uv[1] * uvFactorY,
						tag.uv[2] * uvFactorX,
						tag.uv[3] * uvFactorY
					)
					let animation_offset = texture.currentFrame * texture.display_height;
					ctx.rect(
						Math.floor(face_rect.ax),
						Math.floor(face_rect.ay) + animation_offset,
						Math.ceil(face_rect.bx) - Math.floor(face_rect.ax),
						Math.ceil(face_rect.by) - Math.floor(face_rect.ay)
					)
					ctx.fill()
				}
			}

		} else if (element instanceof Mesh && fill_mode === 'element') {
			for (var fkey in element.faces) {
				var face = element.faces[fkey];
				if (face.vertices.length <= 2 || face.getTexture() !== texture) continue;
				ctx.beginPath();
				
				let min_x = Project.texture_width;
				let min_y = Project.texture_height;
				let max_x = 0;
				let max_y = 0;
				face.vertices.forEach(vkey => {
					if (!face.uv[vkey]) return;
					min_x = Math.min(min_x, face.uv[vkey][0]);
					min_y = Math.min(min_y, face.uv[vkey][1]);
					max_x = Math.max(max_x, face.uv[vkey][0]);
					max_y = Math.max(max_y, face.uv[vkey][1]);
				})
				ctx.rect(
					Math.floor(min_x) * uvFactorX,
					Math.floor(min_y) * uvFactorY,
					(Math.ceil(max_x) - Math.floor(min_x)) * uvFactorX,
					(Math.ceil(max_y) - Math.floor(min_y)) * uvFactorY,
					)
				ctx.fill()
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
					var result_color = pxcolor;
					if (!Painter.erase_mode) {
						result_color = Painter.combineColors(pxcolor, color, b_opacity);
					} else if (!Painter.lock_alpha) {
						if (b_opacity == 1) {
							result_color.r = result_color.g = result_color.b = result_color.a = 0;
						} else {
							result_color.a = Math.clamp(result_color.a * (1-b_opacity), 0, 1);
						}
					}
					px[0] = result_color.r
					px[1] = result_color.g
					px[2] = result_color.b
					if (!Painter.lock_alpha) px[3] = result_color.a*255
				}
			})
		}
		ctx.globalAlpha = 1.0;
		ctx.globalCompositeOperation = 'source-over'
	},
	runMirrorBrush(texture, x, y, event, uvTag) {
		if (uvTag && Painter.current.element) {
			let mirror_element = Painter.getMirrorCube(Painter.current.element);
			let even_brush_size = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brushTool;
			if (mirror_element instanceof Cube) {

				let uvFactorX = 1 / Project.texture_width * texture.img.naturalWidth;
				let uvFactorY = 1 / Project.texture_height * texture.img.naturalHeight;

				let face = Painter.current.face;
				let side_face = (face === 'west' || face === 'east')
				if (side_face) face = CubeFace.opposite[face];
				face = mirror_element.faces[face];

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
					if (even_brush_size) point_on_uv[0] += 1
				} else {
					point_on_uv[0] = Math.min(face.uv[0], face.uv[0+2]) * uvFactorX + point_on_uv[0];
				}
				if (face.uv[1] > face.uv[1+2] == uvTag[1] > uvTag[1+2]) {
					point_on_uv[1] = Math.min(face.uv[1], face.uv[1+2]) * uvFactorY + point_on_uv[1];
				} else {
					point_on_uv[1] = Math.max(face.uv[1], face.uv[1+2]) * uvFactorY - point_on_uv[1] - 1;
				}

				let cube = Painter.current.element;
				Painter.current.element = mirror_element;
				Painter.useBrushlike(texture, ...point_on_uv, event, face.uv, true, true);
				Painter.current.element = cube;

			} else if (mirror_element instanceof Mesh) {
				
				let mesh = mirror_element;

				let clicked_face = mesh.faces[Painter.current.face];
				let normal = clicked_face.getNormal(true);
				let center = clicked_face.getCenter();
				let e = 0.01;
				let face;
				for (let fkey in mesh.faces) {
					let normal2 = mesh.faces[fkey].getNormal(true);
					let center2 = mesh.faces[fkey].getCenter();
					if (
						Math.epsilon(normal[0], -normal2[0], e) && Math.epsilon(normal[1], normal2[1], e) && Math.epsilon(normal[2], normal2[2], e) &&
						Math.epsilon(center[0], -center2[0], e) && Math.epsilon(center[1], center2[1], e) && Math.epsilon(center[2], center2[2], e)
					) {
						face = mesh.faces[fkey];
					}
				}
				if (!face) return;
				
				if (!even_brush_size) {
					x += 0.5; y += 0.5;
				}
				let world_coord = mesh.mesh.localToWorld(clicked_face.UVToLocal([x, y]));
				world_coord.x *= -1;
				mesh.mesh.worldToLocal(world_coord);
				let point_on_uv = face.localToUV(world_coord);
				
				if (even_brush_size) {
					point_on_uv = point_on_uv.map(v => Math.round(v))
				} else {
					point_on_uv = point_on_uv.map(v => Math.floor(v))
				}
				
				let old_mesh = Painter.current.element;
				Painter.current.element = mesh;
				Painter.useBrushlike(texture, ...point_on_uv, event, face.uv, true, true);
				Painter.current.element = old_mesh;
			}
		}
	},
	drawBrushLine(texture, end_x, end_y, event, new_face, uv) {
		var start_x = (Painter.current.x == undefined ? end_x : Painter.current.x);
		var start_y = (Painter.current.y == undefined ? end_y : Painter.current.y);
		
		var diff_x = end_x - start_x;
		var diff_y = end_y - start_y;

		var length = Math.round(Math.sqrt(diff_x*diff_x + diff_y*diff_y))
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
			let b_opacity = BarItems.slider_brush_opacity.get()/255;
			var width = BarItems.slider_brush_size.get();
			let shape = BarItems.draw_shape_type.get();
			let hollow = shape.substr(-1) == 'h';
			shape = shape.replace(/_h$/, '');

			var rect = Painter.setupRectFromFace(uvTag, texture);
			var [w, h] = [rect[2] - rect[0], rect[3] - rect[1]]

			let diff_x = x - Painter.startPixel[0];
			let diff_y = y - Painter.startPixel[1];

			if (event.shiftKey || Pressing.overrides.shift) {
				let clamp = Math.floor((Math.abs(diff_x) + Math.abs(diff_y))/2);
				diff_x = diff_x>0 ? clamp : -clamp;
				diff_y = diff_y>0 ? clamp : -clamp;
			}

			if (Painter.erase_mode) {
				ctx.globalAlpha = b_opacity;
				ctx.globalCompositeOperation = 'destination-out'
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
						if (!Painter.erase_mode) {
							return Painter.combineColors(pxcolor, color, b_opacity);
						} else {
							if (b_opacity == 1) {
								pxcolor.r = pxcolor.g = pxcolor.b = pxcolor.a = 0;
							} else {
								pxcolor.a = Math.clamp(pxcolor.a * (1-b_opacity), 0, 1);
							}
							return pxcolor;
						}
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
			ctx.globalAlpha = 1.0;
			ctx.globalCompositeOperation = 'source-over';

		}, {no_undo: true, use_cache: true});
	},
	useGradientTool(texture, x, y, event, uvTag) {
		Painter.brushChanges = true;

		texture.edit(function(canvas) {
			var ctx = canvas.getContext('2d')
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(Painter.current.clear, 0, 0)

			let b_opacity = BarItems.slider_brush_opacity.get()/255;

			let rect = Painter.setupRectFromFace(uvTag, texture);
			var [w, h] = [rect[2] - rect[0], rect[3] - rect[1]];
			let diff_x = x - Painter.startPixel[0];
			let diff_y = y - Painter.startPixel[1];

			if (event.shiftKey || Pressing.overrides.shift) {
				let length = Math.sqrt(Math.pow(diff_x, 2) + Math.pow(diff_y, 2));

				let ratio = Math.abs(diff_x) / Math.abs(diff_y);
				if (ratio < 0.25) {
					ratio = 0;
					diff_x = 0;
					diff_y = length;
				} else if (ratio < 0.75) {
					ratio = 0.5;
					diff_x = Math.round(length / 2.2361);
					diff_y = diff_x * 2;
				} else if (ratio < 1.5) {
					ratio = 1;
					diff_x = Math.round(Math.sqrt(Math.pow(length, 2) / 2));
					diff_y = diff_x;
				} else if (ratio < 3) {
					ratio = 2;
					diff_y = Math.round(length / 2.2361);
					diff_x = diff_y * 2;
				} else {
					ratio = Infinity;
					diff_x = length;
					diff_y = 0;
				}
				x = Painter.startPixel[0] + diff_x * Math.sign(x - Painter.startPixel[0]);
				y = Painter.startPixel[1] + diff_y * Math.sign(y - Painter.startPixel[1]);
			}

			let gradient = ctx.createLinearGradient(Painter.startPixel[0], Painter.startPixel[1], x, y);
			gradient.addColorStop(0, tinycolor(ColorPanel.get()).setAlpha(b_opacity).toRgbString());
			gradient.addColorStop(1, tinycolor(ColorPanel.get()).setAlpha(0).toRgbString());
			
			ctx.fillStyle = gradient;

			ctx.rect(rect[0], rect[1], w, h);
			ctx.fill();

			let degrees = Math.round(Math.radToDeg(Math.atan2(diff_x, diff_y)) * 4) / 4;
			Blockbench.setStatusBarText(`${Math.round(diff_x)} x ${Math.round(diff_y)}, ${degrees}°`);

		}, {no_undo: true, use_cache: true});
	},
	colorPicker(texture, x, y) {
		var ctx = Painter.getCanvas(texture).getContext('2d')
		let color = Painter.getPixelColor(ctx, x, y);
		ColorPanel.set(color);
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
	getMirrorCube(element) {
		let center = Format.centered_grid ? 0 : 8;
		let e = 0.01
		if (element instanceof Cube) {
			if (Math.epsilon(element.from[0]-center, center-element.to[0], e) && !element.rotation[1] && !element.rotation[2]) {
				return element;
			} else {
				for (var element2 of Cube.all) {
					if (
						element.inflate === element2.inflate &&
						Math.epsilon(element.from[2], element2.from[2], e) && Math.epsilon(element.to[2], element2.to[2], e) &&
						Math.epsilon(element.from[1], element2.from[1], e) && Math.epsilon(element.to[1], element2.to[1], e) &&
						Math.epsilon(element.size(0), element2.size(0), e) && Math.epsilon(element.to[0]-center, center-element2.from[0], e)
					) {
						return element2;
					}
				}
			}
			return false;
		} else if (element instanceof Mesh) {
			if (element instanceof Mesh && Math.epsilon(element.origin[0], center, e) && !element.rotation[1] && !element.rotation[2]) {
				return element;
			} else {
				for (var element2 of Mesh.all) {
					if (Object.keys(element.vertices).length !== Object.keys(element2.vertices).length) continue;
					return element2;
				}
			}
			return element;
		}
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
	getPixelColor(ctx, x, y) {
		var {data} = ctx.getImageData(x, y, 1, 1)
		return new tinycolor({
			r: data[0],
			g: data[1],
			b: data[2],
			a: data[3]/256
		})
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
		allowed_view_modes: ['textured'],
		keybind: new Keybind({key: 'b'}),
		modes: ['paint'],
		onCanvasClick(data) {
			Painter.startPaintToolCanvas(data, data.event);
		},
		onSelect() {
			Painter.updateNslideValues();
			Interface.addSuggestedModifierKey('alt', 'action.color_picker');
			Interface.addSuggestedModifierKey('shift', 'modifier_actions.draw_line');
		},
		onUnselect() {
			Interface.removeSuggestedModifierKey('alt', 'action.color_picker');
			Interface.removeSuggestedModifierKey('shift', 'modifier_actions.draw_line');
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
		allowed_view_modes: ['textured'],
		modes: ['paint'],
		onCanvasClick: function(data) {
			Painter.startPaintToolCanvas(data, data.event)
		},
		onSelect: function() {
			Painter.updateNslideValues();
			Interface.addSuggestedModifierKey('alt', 'action.color_picker');
		},
		onUnselect() {
			Interface.removeSuggestedModifierKey('alt', 'action.color_picker');
		}
	})
	new Tool('eraser', {
		icon: 'fa-eraser',
		category: 'tools',
		toolbar: 'brush',
		alt_tool: 'color_picker',
		selectFace: true,
		transformerMode: 'hidden',
		cursor: 'crosshair',
		paintTool: true,
		brushTool: true,
		allowed_view_modes: ['textured'],
		modes: ['paint'],
		keybind: new Keybind({key: 'e'}),
		onCanvasClick: function(data) {
			Painter.startPaintToolCanvas(data, data.event)
		},
		onSelect: function() {
			Painter.updateNslideValues()
			Interface.addSuggestedModifierKey('shift', 'modifier_actions.draw_line');
		},
		onUnselect() {
			Interface.removeSuggestedModifierKey('shift', 'modifier_actions.draw_line');
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
		allowed_view_modes: ['textured'],
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
		allowed_view_modes: ['textured'],
		modes: ['paint'],
		condition: {modes: ['paint']},
		keybind: new Keybind({key: 'u'}),
		onCanvasClick: function(data) {
			Painter.startPaintToolCanvas(data, data.event)
		},
		onSelect: function() {
			Painter.updateNslideValues()
			Interface.addSuggestedModifierKey('shift', 'modifier_actions.uniform_scaling');
		},
		onUnselect() {
			Interface.removeSuggestedModifierKey('shift', 'modifier_actions.uniform_scaling');
		}
	})
	new Tool('gradient_tool', {
		icon: 'gradient',
		category: 'tools',
		toolbar: 'brush',
		alt_tool: 'color_picker',
		cursor: 'crosshair',
		selectFace: true,
		transformerMode: 'hidden',
		paintTool: true,
		allowed_view_modes: ['textured'],
		modes: ['paint'],
		condition: {modes: ['paint']},
		//keybind: new Keybind({key: 'u'}),
		onCanvasClick: function(data) {
			Painter.startPaintToolCanvas(data, data.event)
		},
		onSelect: function() {
			Painter.updateNslideValues()
			Interface.addSuggestedModifierKey('shift', 'modifier_actions.snap_direction');
		},
		onUnselect() {
			Interface.removeSuggestedModifierKey('shift', 'modifier_actions.snap_direction');
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
		allowed_view_modes: ['textured'],
		modes: ['paint'],
		condition: {modes: ['paint']},
		keybind: new Keybind({key: 'm'}),
		onCanvasClick() {
			Blockbench.showQuickMessage('message.copy_paste_tool_viewport')
		}
	})

	new BarSelect('draw_shape_type', {
		category: 'paint',
		condition: () => Toolbox && Toolbox.selected.id === 'draw_shape_tool',
		onChange() {
			BARS.updateConditions();
			Painter.updateNslideValues()
		},
		icon_mode: true,
		options: {
			rectangle: {name: true, icon: 'fas.fa-square'},
			rectangle_h: {name: true, icon: 'far.fa-square'},
			ellipse: {name: true, icon: 'circle'},
			ellipse_h: {name: true, icon: 'radio_button_unchecked'},
		}
	})
	new BarSelect('fill_mode', {
		category: 'paint',
		condition: () => Toolbox && Toolbox.selected.id === 'fill_tool',
		options: {
			face: true,
			element: true,
			color_connected: true,
			color: true,
		}
	})
	new Toggle('mirror_painting', {
		icon: 'flip',
		category: 'paint',
		condition: () => Modes.paint,
		onChange: function (value) {
			Painter.mirror_painting = value;
			if (value) {
				let size = 16*16;
				var grid = new THREE.GridHelper(size, 16*2, gizmo_colors.outline);
				grid.rotation.z = Math.PI/2;
				grid.position.y = size/2;
				scene.add(grid);
				setTimeout(() => {
					scene.remove(grid);
					grid.geometry.dispose();
				}, 1000)
			}
		}
	})
	new Toggle('color_erase_mode', {
		icon: 'remove_circle',
		category: 'paint',
		condition: {
			tools: ['fill_tool', 'draw_shape_tool']
		},
		onChange: function (value) {
			Painter.erase_mode = value;
		}
	})
	new Toggle('lock_alpha', {
		icon: 'fas.fa-chess-board',
		category: 'paint',
		condition: () => Modes.paint,
		onChange: function () {
			Painter.lock_alpha = !Painter.lock_alpha;
		}
	})

	new Toggle('painting_grid', {
		icon: 'grid_on',
		category: 'view',
		condition: () => Modes.paint,
		keybind: new Keybind({key: 'g'}),
		linked_setting: 'painting_grid'
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
			show_bar: true,
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
		condition: () => (Toolbox && ['brush_tool', 'eraser', 'fill_tool', 'draw_shape_tool', 'gradient_tool'].includes(Toolbox.selected.id)),
		tool_setting: 'brush_opacity',
		settings: {
			min: 0, max: 255, default: 255,
			show_bar: true,
			interval: function(event) {
				if (event.shiftKey && event.ctrlOrCmd) {
					return 1;
				} else if (event.shiftKey) {
					return 4;
				} else if (event.ctrlOrCmd) {
					return 1;
				} else {
					return 8;
				}
			}
		}
	})
})
