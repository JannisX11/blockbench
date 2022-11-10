StateMemory.init('brush_presets', 'array')
const Painter = {
	currentPixel: [-1, -1],
	brushChanges: false,
	current: {/*texture, image*/},
	selection: {},
	mirror_painting: false,
	lock_alpha: false,
	erase_mode: false,
	edit(texture, cb, options) {
		if (!options.no_undo && !options.no_undo_init) {
			Undo.initEdit({textures: [texture], bitmap: true})
		}
		if (texture.mode === 'link') {
			texture.source = 'data:image/png;base64,' + texture.getBase64()
			texture.mode = 'bitmap'
			texture.saved = false
		}
		var instance = Painter.current[options.method === 'jimp' ? 'image' : 'canvas']
		Painter.current[options.method === 'jimp' ? 'canvas' : 'image'] = undefined

		var edit_name = options.no_undo ? null : (options.edit_name || 'Edit texture');

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
					if (!options.no_undo && !options.no_undo_finish) {
						Undo.finishEdit(edit_name)
					}
				})
			} else {
				if (options.no_undo) {
					let map = texture.getMaterial().map
					map.image = Painter.current.canvas;
					map.needsUpdate = true;
					texture.display_canvas = true;
					UVEditor.vue.updateTextureCanvas();
				} else {
					texture.updateSource(instance.toDataURL())
					if (!options.no_undo_finish) {
						Undo.finishEdit(edit_name)
					}
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
						if (!options.no_undo && !options.no_undo_finish) {
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
				if (!options.no_undo && !options.no_undo_finish) {
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
					if (settings.pick_color_opacity.value) {
						let opacity = Math.floor(color.getAlpha()*256);
						for (let id in BarItems) {
							let tool = BarItems[id];
							if (tool.tool_settings && tool.tool_settings.brush_opacity >= 0) {
								tool.tool_settings.brush_opacity = opacity;
							}
						}
					}
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
		var x = data.intersects[0].uv.x * texture.img.naturalWidth;
		var y = (1-data.intersects[0].uv.y) * texture.img.naturalHeight;
		if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
			let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0.5 : 0;
			x = Math.floor(x + offset);
			y = Math.floor(y + offset);
		}
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
			var texture = data.element.faces[data.face].getTexture();
			if (!texture) return;

			var x, y, new_face;
			x = data.intersects[0].uv.x * texture.img.naturalWidth;
			y = (1-data.intersects[0].uv.y) * texture.img.naturalHeight;

			if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
				let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0.5 : 0;
				x = Math.floor(x + offset);
				y = Math.floor(y + offset);
			}
			if (texture.img.naturalWidth + texture.img.naturalHeight == 0) return;

			if (x === Painter.current.x && y === Painter.current.y) {
				return
			}
			if (
				Painter.current.element !== data.element ||
				(Painter.current.face !== data.face && !(data.element.faces[data.face] instanceof MeshFace && data.element.faces[data.face].getUVIsland().includes(Painter.current.face)))
			) {
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
			} else {
				Painter.current.face = data.face;
			}
			Painter.movePaintTool(texture, x, y, event, new_face, data.element.faces[data.face].uv)
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

		delete Painter.paint_stroke_canceled;
		if (settings.paint_with_stylus_only.value && !(event.touches && event.touches[0] && event.touches[0].touchType == 'stylus')) {
			Painter.paint_stroke_canceled = true;
			return;
		}
		if (Toolbox.selected.brush && Toolbox.selected.brush.onStrokeStart) {
			let result = Toolbox.selected.brush.onStrokeStart({texture, x, y, uv: uvTag, event, raycast_data: data});
			if (result == false) {
				Painter.paint_stroke_canceled = true;
				return;
			}
		}

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
				face_matrices: {}
			}
			Painter.startPixel = [x, y];
			Painter.current.clear.width = texture.width;
			Painter.current.clear.height = texture.height;
			Painter.current.clear.getContext('2d').drawImage(texture.img, 0, 0);

		} else {
			Undo.initEdit({textures: [texture], selected_texture: true, bitmap: true});
			Painter.brushChanges = false;
			Painter.painting = true;
			Painter.current.face_matrices = {};

			let is_line
			if (data) {
				is_line = (event.shiftKey || Pressing.overrides.shift)
					   && Painter.current.element == data.element
					   && (Painter.current.face == data.face ||
							(data.element.faces[data.face] instanceof MeshFace && data.element.faces[data.face].getUVIsland().includes(Painter.current.face))
						)
				Painter.current.element = data.element;
				Painter.current.face = data.face;
			} else {
				//uv editor
				is_line = (event.shiftKey || Pressing.overrides.shift);
			}
			if (Toolbox.selected.brush?.line == false) is_line = false;

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
		if (Painter.paint_stroke_canceled) return;
		
		if (Toolbox.selected.brush && Toolbox.selected.brush.onStrokeMove) {
			let result = Toolbox.selected.brush.onStrokeMove({texture, x, y, uv, event, raycast_data: data});
			if (result == false) return;
		}

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
		if (Painter.paint_stroke_canceled) {
			delete Painter.paint_stroke_canceled;
			return;
		}

		if (Toolbox.selected.brush && Toolbox.selected.brush.onStrokeEnd) {
			let result = Toolbox.selected.brush.onStrokeEnd({texture, x, y, uv, event, raycast_data: data});
			if (result == false) return;
		}
		if (Painter.brushChanges) {
			Undo.finishEdit('Paint texture');
			Painter.brushChanges = false;
		}
		if (Toolbox.selected.id == 'gradient_tool' || Toolbox.selected.id == 'draw_shape_tool') {
			Blockbench.setStatusBarText();
		}
		delete Painter.current.alpha_matrix;
		delete Painter.editing_area;
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
				
				let current_face = Mesh.selected[0] && Mesh.selected[0].faces[Painter.current.face];
				if (current_face) {
					let island = current_face.getUVIsland();
					island.forEach(fkey => {
						let face = Mesh.selected[0].faces[fkey];
						for (let vkey in face.uv) {
							min_x = Math.min(min_x, face.uv[vkey][0]); max_x = Math.max(max_x, face.uv[vkey][0]);
							min_y = Math.min(min_y, face.uv[vkey][1]); max_y = Math.max(max_y, face.uv[vkey][1]);
						}
					})
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
			let targets = Painter.getMirrorPaintTargets(texture, x, y, uvTag);
			if (targets.length) {
				let old_element = Painter.current.element;
				let old_face = Painter.current.face;
				targets.forEach(target => {
					Painter.current.element = target.element;
					Painter.current.face = target.face;
					Painter.useBrushlike(texture, target.x, target.y, event, target.uv_tag, true, true);
				})
				Painter.current.element = old_element;
				Painter.current.face = old_face;
			}
		}

		let ctx = Painter.current.ctx;
		ctx.save()

		ctx.beginPath();
		let rect = Painter.editing_area || Painter.setupRectFromFace(uvTag, texture);
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
		let tool = Toolbox.selected;

		ctx.clip()
		if (Painter.current.element instanceof Mesh) {
			let face = Painter.current.element.faces[Painter.current.face];
			if (face && face.vertices.length > 2 && !Painter.current.face_matrices[Painter.current.face]) {
				Painter.current.face_matrices[Painter.current.face] = face.getOccupationMatrix(true, [0, 0]);
				let island = face.getUVIsland();
				for (let fkey of island) {
					let face = Painter.current.element.faces[fkey];
					face.getOccupationMatrix(true, [0, 0], Painter.current.face_matrices[Painter.current.face]);
				}
			}
		}
		if (event.touches && event.touches[0] && event.touches[0].touchType == 'stylus' && event.touches[0].force !== undefined) {
			// Stylus
			var touch = event.touches[0];

			if (settings.brush_opacity_modifier.value == 'pressure' && touch.force !== undefined) {
				b_opacity = Math.clamp(b_opacity * Math.clamp(touch.force*1.25, 0, 1), 0, 100);

			} else if (settings.brush_opacity_modifier.value == 'tilt' && touch.altitudeAngle !== undefined) {
				var modifier = Math.clamp(0.5 / (touch.altitudeAngle + 0.3), 0, 1);
				b_opacity = Math.clamp(b_opacity * modifier, 0, 100);
			}
			if (settings.brush_size_modifier.value == 'pressure' && touch.force !== undefined) {
				size = Math.clamp(touch.force * size * 2, 1, 20);

			} else if (settings.brush_size_modifier.value == 'tilt' && touch.altitudeAngle !== undefined) {
				size *= Math.clamp(1.5 / (touch.altitudeAngle + 0.3), 1, 4);
			}
		}

		if (tool.brush.draw) {

			tool.brush.draw({ctx, x, y, size, softness, texture, event});

		} else {
			let shape = BarItems.brush_shape.value;
			if (shape == 'square') {
				Painter.editSquare(ctx, x, y, size, softness, function(pxcolor, local_opacity, px, py) {
					if (Painter.current.face_matrices[Painter.current.face] && settings.paint_side_restrict.value) {
						let matrix = Painter.current.face_matrices[Painter.current.face];
						if (!matrix[px] || !matrix[px][py]) {
							return pxcolor;
						}
					}
					return tool.brush.changePixel(px, py, pxcolor, local_opacity, {color, opacity: b_opacity, ctx, x, y, size, softness, texture, event});
				})
			} else if (shape == 'circle') {
				Painter.editCircle(ctx, x, y, size, softness, function(pxcolor, local_opacity, px, py) {
					if (Painter.current.face_matrices[Painter.current.face] && settings.paint_side_restrict.value) {
						let matrix = Painter.current.face_matrices[Painter.current.face];
						if (!matrix[px] || !matrix[px][py]) {
							return pxcolor;
						}
					}
					return tool.brush.changePixel(px, py, pxcolor, local_opacity, {color, opacity: b_opacity, ctx, x, y, size, softness, texture, event});
				})
			}

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
			if (Painter.lock_alpha) {
				ctx.globalCompositeOperation = 'source-atop';
			}
		}

		if (element instanceof Cube && fill_mode === 'element') {
			ctx.beginPath();
			for (var face in element.faces) {
				var tag = element.faces[face]
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
				}
			}
			ctx.fill()

		} else if (element instanceof Mesh && (fill_mode === 'element' || fill_mode === 'face')) {
			ctx.beginPath();
			for (var fkey in element.faces) {
				var face = element.faces[fkey];
				if (fill_mode === 'face' && fkey !== Painter.current.face) continue;
				if (face.vertices.length <= 2 || face.getTexture() !== texture) continue;
				
				let matrix = Painter.current.face_matrices[fkey] || face.getOccupationMatrix(true, [0, 0]);
				Painter.current.face_matrices[fkey] = matrix;
				for (let x in matrix) {
					for (let y in matrix[x]) {
						if (!matrix[x][y]) continue;
						x = parseInt(x); y = parseInt(y);
						ctx.rect(x, y, 1, 1);
					}
				}
			}
			ctx.fill()

		} else if (fill_mode === 'face') {
			ctx.fill()
		} else {
			let image_data = ctx.getImageData(x, y, 1, 1)
			let pxcol = [...image_data.data];
			let map = {}
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
	getMirrorPaintTargets(texture, x, y, uvTag) {
		function getTargetWithOptions(symmetry_axes, local) {
			let mirror_element = local ? Painter.current.element : Painter.getMirrorElement(Painter.current.element, symmetry_axes);
			let offset_pixel_brush = Condition(Toolbox.selected.brush?.floor_coordinates) ? 1 : 0;
			let even_brush_size = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius && Condition(Toolbox.selected.brush?.floor_coordinates);
			if (mirror_element instanceof Cube) {
	
				let uvFactorX = 1 / Project.texture_width * texture.img.naturalWidth;
				let uvFactorY = 1 / Project.texture_height * texture.img.naturalHeight;
	
				let fkey = Painter.current.face;
				let side_face = (symmetry_axes[0] && (fkey === 'west' || fkey === 'east'))
							 || (symmetry_axes[1] && (fkey === 'up' || fkey === 'down'))
							 || (symmetry_axes[2] && (fkey === 'south' || fkey === 'north'));
				if (side_face && local !== null) fkey = CubeFace.opposite[fkey];
				let face = mirror_element.faces[fkey];
	
				if (side_face &&
					uvTag[1] === face.uv[1] && uvTag[3] === face.uv[3] &&
					Math.min(uvTag[0], uvTag[2]) === Math.min(face.uv[0], face.uv[2]) &&
					symmetry_axes.filter(v => v).length == 1
					//same face
				) return;
	
				//calculate original point
				var point_on_uv = [
					x - Math.min(uvTag[0], uvTag[2]) * uvFactorX,
					y - Math.min(uvTag[1], uvTag[3]) * uvFactorY,
				]
				//calculate new point
				let mirror_x = symmetry_axes[0] != symmetry_axes[2];
				if (local === null) mirror_x = !mirror_x;
				if (fkey === 'up' || fkey === 'down') mirror_x = !!symmetry_axes[0];
				
				if ((face.uv[0] > face.uv[0+2] == uvTag[0] > uvTag[0+2]) == mirror_x) {
					point_on_uv[0] = Math.max(face.uv[0], face.uv[0+2]) * uvFactorX - point_on_uv[0] - offset_pixel_brush;
					if (even_brush_size) point_on_uv[0] += 1
				} else {
					point_on_uv[0] = Math.min(face.uv[0], face.uv[0+2]) * uvFactorX + point_on_uv[0];
				}
				let mirror_y = symmetry_axes[2] && (fkey === 'up' || fkey === 'down');
				if ((face.uv[1] > face.uv[1+2] == uvTag[1] > uvTag[1+2]) != mirror_y) {
					point_on_uv[1] = Math.min(face.uv[1], face.uv[1+2]) * uvFactorY + point_on_uv[1];
				} else {
					point_on_uv[1] = Math.max(face.uv[1], face.uv[1+2]) * uvFactorY - point_on_uv[1] - offset_pixel_brush;
				}
	
				return {
					element: mirror_element,
					x: point_on_uv[0],
					y: point_on_uv[1],
					uv_tag: face.uv,
					face: fkey
				}
	
			} else if (mirror_element instanceof Mesh) {
				
				let mesh = mirror_element;
				
				let clicked_face = Painter.current.element.faces[Painter.current.face];
				let normal = clicked_face.getNormal(true);
				let center = clicked_face.getCenter();
				let ep = 0.5;
				let en = 0.1;
				let face;
				let match_fkey;
				for (let fkey in mesh.faces) {
					let normal2 = mesh.faces[fkey].getNormal(true);
					let center2 = mesh.faces[fkey].getCenter();
					if (local !== null) {
						if (symmetry_axes[0]) {normal2[0] *= -1; center2[0] *= -1;}
						if (symmetry_axes[1]) {normal2[1] *= -1; center2[1] *= -1;}
						if (symmetry_axes[2]) {normal2[2] *= -1; center2[2] *= -1;}
					}
					if (
						Math.epsilon(normal[0], normal2[0], en) && Math.epsilon(normal[1], normal2[1], en) && Math.epsilon(normal[2], normal2[2], en) &&
						Math.epsilon(center[0], center2[0], ep) && Math.epsilon(center[1], center2[1], ep) && Math.epsilon(center[2], center2[2], ep)
					) {
						face = mesh.faces[fkey];
						match_fkey = fkey;
					}
				}
				if (!face) return;
				
				let source_uv = [
					(even_brush_size ? x : x + 0.5) * (Project.texture_width / texture.width),
					(even_brush_size ? y : y + 0.5) * (Project.texture_height / texture.height)
				];

				let point_on_uv;
				if (local === null) {
					let vector = clicked_face.UVToLocal(source_uv);
					if (symmetry_axes[0]) vector.x *= -1;
					if (symmetry_axes[1]) vector.y *= -1;
					if (symmetry_axes[2]) vector.z *= -1;
					let world_coord = Painter.current.element.mesh.localToWorld(vector);
					if (symmetry_axes[0]) world_coord.x *= -1;
					if (symmetry_axes[1]) world_coord.y *= -1;
					if (symmetry_axes[2]) world_coord.z *= -1;
					mesh.mesh.worldToLocal(world_coord);
					point_on_uv = face.localToUV(world_coord);
					

				} else if (local) {
					let vector = clicked_face.UVToLocal(source_uv);
					if (symmetry_axes[0]) vector.x *= -1;
					if (symmetry_axes[1]) vector.y *= -1;
					if (symmetry_axes[2]) vector.z *= -1;
					point_on_uv = face.localToUV(vector);
					
				} else {
					let world_coord = Painter.current.element.mesh.localToWorld(clicked_face.UVToLocal(source_uv));
					if (symmetry_axes[0]) world_coord.x *= -1;
					if (symmetry_axes[1]) world_coord.y *= -1;
					if (symmetry_axes[2]) world_coord.z *= -1;
					mesh.mesh.worldToLocal(world_coord);
					point_on_uv = face.localToUV(world_coord);
				}

				point_on_uv[0] /= Project.texture_width / texture.width;
				point_on_uv[1] /= Project.texture_height / texture.height;
				
				if (Condition(Toolbox.selected.brush?.floor_coordinates)) {
					if (even_brush_size) {
						point_on_uv = point_on_uv.map(v => Math.round(v))
					} else {
						point_on_uv = point_on_uv.map(v => Math.floor(v))
					}
				}
				
				return {
					element: mesh,
					x: point_on_uv[0],
					y: point_on_uv[1],
					uv_tag: face.uv,
					face: match_fkey
				}
			}
		}
		
		let targets = [];
		if (uvTag && Painter.current.element) {
			let mirror_vectors = [[
				Painter.mirror_painting_options.axis.x?1:0,
				0, //Painter.mirror_painting_options.axis.y?1:0,
				Painter.mirror_painting_options.axis.z?1:0
			]];
			if (mirror_vectors[0].filter(v => v).length == 3) {
				mirror_vectors = [
					[1,0,0], [0,1,0], [0,0,1],
					[1,1,0], [0,1,1], [1,0,1],
					[1,1,1]
				]
			} else if (mirror_vectors[0].equals([1, 1, 0])) {
				mirror_vectors = [[1,0,0], [0,1,0], [1,1,0]];

			} else if (mirror_vectors[0].equals([0, 1, 1])) {
				mirror_vectors = [[0,1,0], [0,0,1], [0,1,1]];

			} else if (mirror_vectors[0].equals([1, 0, 1])) {
				mirror_vectors = [[1,0,0], [0,0,1], [1,0,1]];
			}
			mirror_vectors.forEach((mirror_vector, i) => {
				if (Painter.mirror_painting_options.global) {
					targets.push(getTargetWithOptions(mirror_vector, false));
				}
				if (Painter.mirror_painting_options.local) {
					targets.push(getTargetWithOptions(mirror_vector, true));
				}
				if (Painter.mirror_painting_options.global && Painter.mirror_painting_options.local) {
					targets.push(getTargetWithOptions(mirror_vector, null));
				}
			})
		}
		// 2D
		if (Painter.mirror_painting_options.texture && !Painter.current.element) {
			let offset = 0;
			if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
				offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0 : 1;
			}
			if (Painter.mirror_painting_options.axis.x) {
				targets.push({
					x: texture.width - x - offset,
					y: y
				});
			}
			if (Painter.mirror_painting_options.axis.z) {
				targets.push({
					x: x,
					y: texture.display_height - y - offset
				});
			}
			if (Painter.mirror_painting_options.axis.x && Painter.mirror_painting_options.axis.z) {
				targets.push({
					x: texture.width - x - offset,
					y: texture.display_height - y - offset
				});
			}
		}
		// Texture animation
		if (Painter.mirror_painting_options.texture_frames && Format.animated_textures && texture && texture.frameCount > 1) {
			let spatial_targets = targets.slice();
			for (let frame = 0; frame < texture.frameCount; frame++) {
				if (frame == texture.currentFrame) continue;

				targets.push({
					element: Painter.current.element,
					x,
					y: y + (frame - texture.currentFrame) * texture.display_height,
					face: Painter.current.face
				});
				spatial_targets.forEach(spatial => {
					targets.push({
						element: spatial.element,
						x: spatial.x,
						y: spatial.y + (frame - texture.currentFrame) * texture.display_height,
						face: spatial.face
					});
				})
			}
		}
		return targets.filter(target => !!target);
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
		var interval = Toolbox.selected.brush?.line_interval || 1;
		var i = Math.min(interval, length);
		var x, y;
		if (Math.abs(diff_x) > Math.abs(diff_y)) {
			interval = Math.sqrt(Math.pow(diff_y/diff_x, 2) + 1)
		} else {
			interval = Math.sqrt(Math.pow(diff_x/diff_y, 2) + 1)
		}

		while (i <= length) {
			x = length ? (start_x + diff_x / length * i) : end_x;
			y = length ? (start_y + diff_y / length * i) : end_y;
			if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
				x = Math.round(x);
				y = Math.round(y);
			}
			Painter.useBrushlike(texture, x, y, event, uv, i < length-1);
			i += interval;
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

			function drawShape(start_x, start_y, x, y, uvTag) {

				var rect = Painter.setupRectFromFace(uvTag, texture);
				var [w, h] = [rect[2] - rect[0], rect[3] - rect[1]]

				let diff_x = x - start_x;
				let diff_y = y - start_y;

				if (event.shiftKey || Pressing.overrides.shift) {
					let clamp = Math.floor((Math.abs(diff_x) + Math.abs(diff_y))/2);
					diff_x = diff_x>0 ? clamp : -clamp;
					diff_y = diff_y>0 ? clamp : -clamp;
				}

				if (Painter.erase_mode) {
					ctx.globalAlpha = b_opacity;
					ctx.globalCompositeOperation = 'destination-out'
				} else if (Painter.lock_alpha) {
					ctx.globalCompositeOperation = 'source-atop';
				}

				if (shape === 'rectangle') {
					ctx.strokeStyle = ctx.fillStyle = tinycolor(ColorPanel.get()).setAlpha(b_opacity).toRgbString();
					ctx.lineWidth = width;
					ctx.beginPath();
					var rect = getRectangle(start_x, start_y, start_x+diff_x, start_y+diff_y);
					
					if (hollow && rect.w > 0 && rect.h > 0) {
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
								let result_color = Painter.combineColors(pxcolor, color, b_opacity);
								if (Painter.lock_alpha) {
									result_color = {
										r: result_color.r,
										g: result_color.g,
										b: result_color.b,
										a: pxcolor.a
									}
								}
								return result_color;
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
												start_x + (j<2?1:-1) * i,
												start_y + (j%2?1:-1) * Math.round(Math.cos(Math.asin(i / Math.abs(diff_x_m))) * diff_y_m),
												editPx
											)
										}
									}
									for (var i = 0; i < Math.abs(diff_y_m); i++) {
										for (var j = 0; j < 4; j++) {
											changePixel(
												start_x + (j<2?1:-1) * Math.round(Math.sin(Math.acos(i / Math.abs(diff_y_m))) * diff_x_m),
												start_y + (j%2?1:-1) * i,
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
											start_x + (j<2?1:-1) * i,
											start_y + (j%2?1:-1) * k,
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
											start_x + (j<2?1:-1) * k,
											start_y + (j%2?1:-1) * i,
											editPx
										)
									}
								}
							}
						}
					})
				}

				if (shape === 'ellipse') {
					Blockbench.setStatusBarText(`${Math.abs(diff_x*2) + 1} x ${Math.abs(diff_y*2) + 1}`);
				} else {
					Blockbench.setStatusBarText(`${Math.abs(diff_x) + 1} x ${Math.abs(diff_y) + 1}`);
				}
			}

			drawShape(Painter.startPixel[0], Painter.startPixel[1], x, y, uvTag);
			
			if (Painter.mirror_painting) {
				let targets = Painter.getMirrorPaintTargets(texture, x, y, uvTag);
				if (targets) {
					let start_targets = Painter.getMirrorPaintTargets(texture, Painter.startPixel[0], Painter.startPixel[1], uvTag);
					let old_element = Painter.current.element;
					let old_face = Painter.current.face;
					targets.forEach((target, i) => {
						let start_target = start_targets[i];
						Painter.current.element = target.element;
						Painter.current.face = target.face;
						drawShape(start_target.x, start_target.y, target.x, target.y, target.uv_tag)
					})
					Painter.current.element = old_element;
					Painter.current.face = old_face;
				}
			}

			//Painter.editing_area = undefined;
			ctx.globalAlpha = 1.0;
			ctx.globalCompositeOperation = 'source-over';

		}, {no_undo: true, use_cache: true});
	},
	useGradientTool(texture, x, y, event, uvTag) {
		Painter.brushChanges = true;

		texture.edit(function(canvas) {
			let b_opacity = BarItems.slider_brush_opacity.get()/255;
			var ctx = canvas.getContext('2d')
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(Painter.current.clear, 0, 0)
			if (Painter.lock_alpha) {
				ctx.globalCompositeOperation = 'source-atop';
			}

			function drawGradient(start_x, start_y, x, y, uvTag) {
				let rect = Painter.setupRectFromFace(uvTag, texture);
				var [w, h] = [rect[2] - rect[0], rect[3] - rect[1]];
				let diff_x = x - start_x;
				let diff_y = y - start_y;

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
					x = start_x + diff_x * Math.sign(x - start_x);
					y = start_y + diff_y * Math.sign(y - start_y);
				}

				let gradient = ctx.createLinearGradient(start_x, start_y, x, y);
				gradient.addColorStop(0, tinycolor(ColorPanel.get()).setAlpha(b_opacity).toRgbString());
				gradient.addColorStop(1, tinycolor(ColorPanel.get()).setAlpha(0).toRgbString());

				ctx.beginPath();
				ctx.fillStyle = gradient;
				ctx.rect(rect[0], rect[1], w, h);
				ctx.fill();

				return [diff_x, diff_y];
			}
			let [diff_x, diff_y] = drawGradient(Painter.startPixel[0], Painter.startPixel[1], x, y, uvTag);

			if (Painter.mirror_painting) {
				let targets = Painter.getMirrorPaintTargets(texture, x, y, uvTag);
				if (targets) {
					let start_targets = Painter.getMirrorPaintTargets(texture, Painter.startPixel[0], Painter.startPixel[1], uvTag);
					let old_element = Painter.current.element;
					let old_face = Painter.current.face;
					targets.forEach((target, i) => {
						let start_target = start_targets[i];
						Painter.current.element = target.element;
						drawGradient(start_target.x, start_target.y, target.x, target.y, target.uv_tag)
					})
					Painter.current.element = old_element;
					Painter.current.face = old_face;
				}
			}
			ctx.globalCompositeOperation = 'source-over';
			
			let degrees = Math.round(Math.radToDeg(Math.atan2(diff_x, diff_y)) * 4) / 4;
			Blockbench.setStatusBarText(`${Math.round(diff_x)} x ${Math.round(diff_y)}, ${degrees}°`);

		}, {no_undo: true, use_cache: true});
	},
	colorPicker(texture, x, y) {
		var ctx = Painter.getCanvas(texture).getContext('2d')
		let color = Painter.getPixelColor(ctx, x, y);
		if (settings.pick_color_opacity.value) {
			let opacity = Math.floor(color.getAlpha()*256);
			for (let id in BarItems) {
				let tool = BarItems[id];
				if (tool.tool_settings && tool.tool_settings.brush_opacity >= 0) {
					tool.tool_settings.brush_opacity = opacity;
				}
			}
		}
		ColorPanel.set(color);
	},
	// Util
	combineColors(base, added, opacity) {
		if (Math.isNumber(base)) base = Jimp.intToRGBA(base)
		if (Math.isNumber(added)) added = Jimp.intToRGBA(added)

		if (added.a*opacity == 1) return {r: added.r, g: added.g, b: added.b, a: added.a};

		var original_a = added.a
		added.a = added.a*opacity

		var mix = {};
		mix.a = Math.clamp(1 - (1 - added.a) * (1 - base.a), 0, 1); // alpha
		mix.r = Math.round((added.r * added.a / mix.a) + (base.r * base.a * (1 - added.a) / mix.a)); // red
		mix.g = Math.round((added.g * added.a / mix.a) + (base.g * base.a * (1 - added.a) / mix.a)); // green
		mix.b = Math.round((added.b * added.a / mix.a) + (base.b * base.a * (1 - added.a) / mix.a)); // blue

		added.a = original_a
		return mix;
	},
	blendColors(base, added, opacity, blend_mode) {
		if (Math.isNumber(base)) base = Jimp.intToRGBA(base)
		if (Math.isNumber(added)) added = Jimp.intToRGBA(added)

		var original_a = added.a
		added.a = added.a*opacity

		var mix = {};
		mix.a = Math.clamp(1 - (1 - added.a) * (1 - base.a), 0, 1); // alpha

		['r', 'g', 'b'].forEach(ch => {
			let normal_base = base[ch] / 255;
			let normal_added = added[ch] / 255;
			if (base.a == 0) normal_base = normal_added;

			switch (blend_mode) {

				case 'behind':
				mix[ch] = (normal_base * base.a / mix.a)  +  (normal_added * added.a * (1 - base.a) / mix.a);
				break;

				case 'color':
				mix[ch] = ((normal_base / normal_added) * added.a) + (normal_base * (1-added.a));
				break;

				case 'multiply':
				mix[ch] = ((normal_base * normal_added) * added.a) + (normal_base * (1-added.a));
				break;

				case 'divide':
				mix[ch] = ((normal_base / normal_added) * added.a) + (normal_base * (1-added.a));
				break;

				case 'add':
				mix[ch] = ((normal_base + normal_added) * added.a) + (normal_base * (1-added.a));
				break;

				case 'subtract':
				mix[ch] = ((normal_base - normal_added) * added.a) + (normal_base * (1-added.a));
				break;

				case 'screen':
				mix[ch] = ((1 - ((1-normal_base) * (1-normal_added))) * added.a) + (normal_base * (1-added.a));
				break;

				//case 'hard_light':
				//mix[ch] = ((normal_base / normal_added) * added.a) + (normal_base * (1-added.a));
				//break;

				case 'difference':
				mix[ch] = ((1-normal_base) * added.a * normal_added) + (normal_base * (1-(added.a*normal_added)));
				break;

			}
			mix[ch] = Math.clamp(Math.round(255 * mix[ch]), 0, 255);
		})

		added.a = original_a
		return mix;
	},
	getMirrorElement(element, symmetry_axes) {
		let center = Format.centered_grid ? 0 : 8;
		let e = 0.01;
		symmetry_axes = symmetry_axes.map((v, i) => v ? i : false).filter(v => v !== false);
		let off_axes = [0, 1, 2].filter(i => !symmetry_axes.includes(i));
		if (element instanceof Cube) {
			if (
				symmetry_axes.find((axis) => !Math.epsilon(element.from[axis]-center, center-element.to[axis], e)) == undefined &&
				off_axes.find(axis => element.rotation[axis]) == undefined
			) {
				return element;
			} else {
				for (var element2 of Cube.all) {
					if (
						Math.epsilon(element.inflate, element2.inflate, e) &&
						off_axes.find(axis => !Math.epsilon(element.from[axis], element2.from[axis], e)) == undefined &&
						off_axes.find(axis => !Math.epsilon(element.to[axis], element2.to[axis], e)) == undefined &&
						symmetry_axes.find(axis => !Math.epsilon(element.size(axis), element2.size(axis), e)) == undefined &&
						symmetry_axes.find(axis => !Math.epsilon(element.to[axis]-center, center-element2.from[axis], e)) == undefined
					) {
						return element2;
					}
				}
			}
			return false;
		} else if (element instanceof Mesh) {
			let ep = 0.5;
			let this_center = element.getCenter(true);
			if (
				symmetry_axes.find((axis) => !Math.epsilon(element.origin[axis], center, e)) == undefined &&
				symmetry_axes.find((axis) => !Math.epsilon(this_center[axis], center, ep)) == undefined &&
				off_axes.find(axis => element.rotation[axis]) == undefined
			) {
				return element;
			} else {
				for (var element2 of Mesh.all) {
					let other_center = element2.getCenter(true);
					if (Object.keys(element.vertices).length !== Object.keys(element2.vertices).length) continue;
					if (
						symmetry_axes.find(axis => !Math.epsilon(element.origin[axis]-center, center-element2.origin[axis], e)) == undefined &&
						symmetry_axes.find(axis => !Math.epsilon(this_center[axis]-center, center-other_center[axis], ep)) == undefined &&
						off_axes.find(axis => !Math.epsilon(element.origin[axis], element2.origin[axis], e)) == undefined &&
						off_axes.find(axis => !Math.epsilon(this_center[axis], other_center[axis], ep)) == undefined
					) {
						return element2;
					}
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
		let canvas = texture instanceof Texture ? texture.canvas : document.createElement('canvas');
		let ctx = canvas.getContext('2d');
		canvas.width = texture.width;
		canvas.height = texture.height;
		ctx.drawImage(texture instanceof Texture ? texture.img : texture, 0, 0)
		return canvas;
	},
	scanCanvas(ctx, x, y, w, h, cb) {
		let arr = ctx.getImageData(x, y, w, h)
		for (let i = 0; i < arr.data.length; i += 4) {
			let pixel = [arr.data[i], arr.data[i+1], arr.data[i+2], arr.data[i+3]]

			let px = x + (i/4) % w
			let py = y + Math.floor((i/4) / w)
			if (px >= ctx.canvas.width || px < 0 || py >= ctx.canvas.height || py < 0) continue;
			let result = cb(px, py, pixel) || pixel

			result.forEach((p, pi) => {
				if (p != arr.data[i+pi]) arr.data[i+pi] = p
			})
		}
		ctx.putImageData(arr, x, y)
	},
	getPixelColor(ctx, x, y) {
		let {data} = ctx.getImageData(x, y, 1, 1)
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
	editCircle(ctx, x, y, r, soft, editPx) {
		r = Math.round(r+1)/2
		Painter.scanCanvas(ctx, Math.floor(x)-Math.ceil(r)-2, Math.floor(y)-Math.ceil(r)-2, 2*r+3, 2*r+3, function (px, py, pixel) {
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

			let v_px = px - x;
			let v_py = py - y;

			if (x%1) {
				// Smooth
				v_px += 0.5; v_py += 0.5;
			} else if (r%1) {
				// Pixel Perfect
				v_px += 0.5; v_py += r%1;
			}

			var distance = Math.sqrt(v_px*v_px + v_py*v_py)
			if (soft*r != 0) {
				var pos_on_gradient = Math.clamp((distance-(1-soft)*r) / (soft*r), 0, 1)
				pos_on_gradient = 3*Math.pow(pos_on_gradient, 2) - 2*Math.pow(pos_on_gradient, 3);
			} else {
				if (r < 8) {
					distance *= 1.2;
				}
				var pos_on_gradient = Math.floor(distance/r);
			}

			var opacity = limitNumber(1-pos_on_gradient, 0, 1)

			if (opacity > 0) {
				var result_color = editPx({
					r: pixel[0],
					g: pixel[1],
					b: pixel[2],
					a: pixel[3]/255
				}, opacity, px, py)
				pixel[0] = result_color.r
				pixel[1] = result_color.g
				pixel[2] = result_color.b
				pixel[3] = result_color.a*255
			}
		});
	},
	editSquare(ctx, x, y, r, s, editPx) {
		r = Math.round(r+1)/2;
		Painter.scanCanvas(ctx, Math.floor(x)-Math.ceil(r)-2, Math.floor(y)-Math.ceil(r)-2, 2*r+3, 2*r+3, function (px, py, pixel) {
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

			let v_px = px - x;
			let v_py = py - y;

			if (x%1) {
				// Smooth
				v_px += 0.5; v_py += 0.5;
			} else if (r%1) {
				// Pixel Perfect
				v_px += 0.5; v_py += r%1;
			}

			var distance = Math.max(Math.abs(v_px), Math.abs(v_py));
			if (s*r != 0) {
				var pos_on_gradient = Math.clamp((distance-(1-s)*r) / (s*r), 0, 1)
				pos_on_gradient = 3*Math.pow(pos_on_gradient, 2) - 2*Math.pow(pos_on_gradient, 3);
			} else {
				var pos_on_gradient = Math.floor((distance)/r)
			}

			var opacity = limitNumber(1-pos_on_gradient, 0, 1)

			if (opacity > 0) {
				var result_color = editPx({
					r: pixel[0],
					g: pixel[1],
					b: pixel[2],
					a: pixel[3]/255
				}, opacity, px, py)
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
	},
	openBrushOptions() {
		let current_preset = 0;
		let dialog = new Dialog({
			id: 'brush_options',
			title: 'menu.brush_presets.dialog',
			singleButton: true,
			part_order: ['component', 'form'],
			component: {
				data() {return {
					presets: StateMemory.brush_presets,
					selected_preset: null,
				}},
				methods: {
					addPreset() {
						let new_preset = {
							name: 'Preset',
							size: 1,
							softness: 0,
							opacity: null,
							color: null,
							shape: 'square',
							blend_mode: 'default'
						};
						this.presets.push(new_preset);
						this.selectPreset(new_preset);
						return new_preset;
					},
					removePreset(preset) {
						if (!preset) preset = this.selected_preset;
						let index = this.presets.indexOf(preset);
						this.presets.remove(preset);
						this.selected_preset = null;
						current_preset = 0;
						dialog.object.classList.remove('preset_selected');
						this.save();
						if (this.presets[index] || this.presets[index-1]) {
							this.selectPreset(this.presets[index] || this.presets[index-1]);
						}
					},
					selectPreset(preset) {
						this.selected_preset = preset;
						current_preset = preset;
						dialog.object.classList.add('preset_selected');
						dialog.setFormValues({
							name: preset.name,
							use_size: preset.size !== null,
							size: preset.size == null ? BarItems.slider_brush_size.get() : preset.size,
							use_softness: preset.softness !== null,
							softness: preset.softness == null ? BarItems.slider_brush_softness.get() : preset.softness,
							use_opacity: preset.opacity !== null,
							opacity: preset.opacity == null ? BarItems.slider_brush_opacity.get() : preset.opacity,
							use_color: preset.color !== null,
							color: preset.color == null ? ColorPanel.get() : preset.color,
							shape: preset.shape ? preset.shape : 'unset',
							blend_mode: preset.blend_mode ? preset.blend_mode : 'unset',
						});
					},
					openContextMenu(preset, event) {
						new Menu([
							{
								name: 'generic.delete',
								icon: 'delete',
								click: () => {
									this.removePreset(preset);
								}
							}
						]).open(event);
					},
					save() {
						StateMemory.save('brush_presets');
					},
					getBrushStyle(preset) {
						return {
							color: preset.color,
							opacity: preset.opacity == null ? 1 : (preset.opacity/255),
							filter: preset.softness ? `blur(${preset.softness/24}px)` : undefined
						}
					}
				},
				template: `
					<ul id="brush_preset_bar">
						<li v-for="preset in presets" :class="{selected: preset == selected_preset}" @click="selectPreset(preset)" @contextmenu="openContextMenu(preset, $event)">
							<i class="icon material-icons" v-if="preset.shape == 'circle'" :style="getBrushStyle(preset)"">circle</i>
							<i class="fa_big icon fas fa-square" v-else :style="getBrushStyle(preset)""></i>
						</li>
						<li class="add_brush_preset" @click="addPreset()">
							<i class="material-icons">add</i>
						</li>
					</ul>
				`
			},
			form: {
				name: {label: 'generic.name', type: 'text'},
				shape: {label: 'action.brush_shape', description: 'action.brush_shape.desc', description: 'action.brush_shape.desc', type: 'select', options: {
					unset: 'generic.unset',
					square: 'action.brush_shape.square',
					circle: 'action.brush_shape.circle'
				}},
				blend_mode: {label: 'action.blend_mode', description: 'action.blend_mode.desc', type: 'select', options: {
					unset: 'generic.unset',
					default: 'action.blend_mode.default',
					set_opacity: 'action.blend_mode.set_opacity',
					color: 'action.blend_mode.color',
					behind: 'action.blend_mode.behind',
					multiply: 'action.blend_mode.multiply',
					divide: 'action.blend_mode.divide',
					add: 'action.blend_mode.add',
					subtract: 'action.blend_mode.subtract',
					screen: 'action.blend_mode.screen',
					difference: 'action.blend_mode.difference',
				}},
				use_size: {label: 'action.slider_brush_size', description: 'action.slider_brush_size.desc', type: 'checkbox'},
				size: {label: ' ', nocolon: true, description: 'action.slider_brush_size.desc', type: 'number', condition: form => form.use_size, value: 1, min: 1, max: 100},
				use_opacity: {label: 'action.slider_brush_opacity', description: 'action.slider_brush_opacity.desc', type: 'checkbox'},
				opacity: {label: ' ', nocolon: true, description: 'action.slider_brush_opacity.desc', type: 'number', condition: form => form.use_opacity, value: 255, min: 0, max: 255},
				use_softness: {label: 'action.slider_brush_softness', description: 'action.slider_brush_softness.desc', type: 'checkbox'},
				softness: {label: ' ', nocolon: true, description: 'action.slider_brush_softness.desc', type: 'number', condition: form => form.use_softness, value: 0, min: 0, max: 100},
				use_color: {label: 'data.color', type: 'checkbox'},
				color: {label: ' ', nocolon: true, description: 'action.brush_shape.desc', type: 'color', condition: form => form.use_color},
				actions: {type: 'buttons', buttons: ['generic.delete'], click() {
					dialog.content_vue.removePreset();
				}}
			},
			onFormChange(form) {
				let preset = this.content_vue.selected_preset;
				preset.name = form.name;

				if (form.use_size) {
					preset.size = form.size;
				} else {
					preset.size = null;
				}
				if (form.use_softness) {
					preset.softness = form.softness;
				} else {
					preset.softness = null;
				}
				if (form.use_opacity) {
					preset.opacity = form.opacity;
				} else {
					preset.opacity = null;
				}
				if (form.use_color) {
					preset.color = form.color.toHexString();
				} else {
					preset.color = null;
				}
				
				if (form.shape !== 'unset') {
					preset.shape = form.shape;
				} else {
					preset.shape = null;
				}
				if (form.blend_mode !== 'unset') {
					preset.blend_mode = form.blend_mode;
				} else {
					preset.blend_mode = null;
				}
			},
			onConfirm() {
				StateMemory.save('brush_presets');
				if (current_preset) Painter.loadBrushPreset(current_preset);
			},
			onOpen() {
				Vue.nextTick(() => {
					if (this.content_vue.presets[0]) {
						this.content_vue.selectPreset(this.content_vue.presets[0]);
					}
				})
			}
		}).show();
	},
	loadBrushPreset(preset) {
		if (typeof preset.size == 'number') 	BarItems.slider_brush_size.setValue(preset.size);
		if (typeof preset.softness == 'number') BarItems.slider_brush_softness.setValue(preset.softness);
		if (typeof preset.opacity == 'number') 	BarItems.slider_brush_opacity.setValue(preset.opacity);
		if (preset.color) 		ColorPanel.set(preset.color);
		if (preset.shape) {
			BarItems.brush_shape.set(preset.shape);
			if (BarItems.brush_shape.onChange) {
				BarItems.brush_shape.onChange(BarItems.brush_shape);
			}
		}
		if (preset.blend_mode) {
			BarItems.blend_mode.set(preset.blend_mode);
			if (BarItems.blend_mode.onChange) {
				BarItems.blend_mode.onChange(BarItems.blend_modeis);
			}
		}
	},
	default_brush_presets: [
		{
			name: 'menu.brush_presets.pixel_brush',
			default: true,
			size: 1,
			softness: 0,
			shape: 'square',
			blend_mode: 'default'
		},
		{
			name: 'menu.brush_presets.smooth_brush',
			default: true,
			size: 5,
			softness: 70,
			shape: 'circle',
			blend_mode: 'default'
		}
	]
}

BARS.defineActions(function() {

	new Tool('pan_tool', {
		icon: 'pan_tool',
		category: 'tools',
		cursor: 'grab',
		selectFace: false,
		transformerMode: 'hidden',
		allowed_view_modes: ['textured'],
		modes: ['paint'],
		condition: Blockbench.isMobile && {modes: ['paint']}
	})
	new Tool('brush_tool', {
		icon: 'fa-paint-brush',
		category: 'tools',
		toolbar: 'brush',
		alt_tool: 'color_picker',
		cursor: 'crosshair',
		selectFace: true,
		transformerMode: 'hidden',
		paintTool: true,
		brush: {
			blend_modes: true,
			shapes: true,
			size: true,
			softness: true,
			opacity: true,
			offset_even_radius: true,
			floor_coordinates: () => BarItems.slider_brush_softness.get() == 0,
			changePixel(px, py, pxcolor, local_opacity, {color, opacity, ctx, x, y, size, softness, texture, event}) {
				let blend_mode = BarItems.blend_mode.value;
				if (blend_mode == 'set_opacity') local_opacity = 1;
				let a = opacity * local_opacity;

				if (blend_mode == 'set_opacity') {
					if (Painter.lock_alpha && pxcolor.a == 0) return pxcolor;
					return {r: color.r, g: color.g, b: color.b, a}

				} else {
					var before = Painter.getAlphaMatrix(texture, px, py)
					Painter.setAlphaMatrix(texture, px, py, a);
					if (a > before) {
						a = (a - before) / (1 - before);
					} else if (before) {
						a = 0;
					}
					let result_color;
					if (blend_mode == 'default') {
						result_color = Painter.combineColors(pxcolor, color, a);
					} else {
						result_color = Painter.blendColors(pxcolor, color, a, blend_mode);
					}
					if (Painter.lock_alpha) result_color.a = pxcolor.a
					return result_color;
				}
			}
		},
		allowed_view_modes: ['textured'],
		keybind: new Keybind({key: 'b'}),
		modes: ['paint'],
		side_menu: new Menu('brush_tool', () => {
			
			let list = [
				{name: 'menu.brush_presets.pixel_brush', icon: 'mode_edit', click() {
					BarItems.brush_tool.select();
					Painter.loadBrushPreset(Painter.default_brush_presets[0])
				}},
				{name: 'menu.brush_presets.smooth_brush', icon: 'fa-paint-brush', click() {
					BarItems.brush_tool.select();
					Painter.loadBrushPreset(Painter.default_brush_presets[1])
				}},
			];
			StateMemory.brush_presets.forEach((preset) => {
				let menu_entry = {
					name: preset.name,
					icon: preset.shape == 'circle' ? 'circle' : 'fas.fa-square',
					color: preset.color || undefined,
					click() {
						Painter.loadBrushPreset(preset);
					}
				}
				list.push(menu_entry);
			})
			list.push(
				'_',
				{id: 'brush_settings', name: 'menu.brush_presets.dialog', icon: 'tune', click() {
					Painter.openBrushOptions();
				}}
			)
			return list;
		}),
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
	let copy_source;
	let stroke_start_pos;
	new Tool('copy_brush', {
		icon: 'fa-stamp',
		category: 'tools',
		toolbar: 'brush',
		cursor: 'crosshair',
		selectFace: true,
		transformerMode: 'hidden',
		paintTool: true,
		brush: {
			shapes: true,
			size: true,
			softness: true,
			opacity: true,
			offset_even_radius: true,
			onStrokeStart({texture, event, x, y, raycast_data}) {
				if (event.ctrlOrCmd || Pressing.overrides.ctrl) {
					if (!Painter.current.canvas) {
						Painter.current.canvas = Painter.getCanvas(texture);
					}
					let size = BarItems.slider_brush_size.get();
					copy_source = {
						data: texture.canvas.getContext('2d').getImageData(0, 0, texture.width, texture.height).data,
						width: texture.width,
						height: texture.height,
						size,
						x,
						y,
					}
					UVEditor.vue.copy_brush_source = {
						x, y,
						size,
						texture: texture.uuid
					}
					Preview.all.forEach(preview => {
						preview.removeAnnotation('copy_brush');
					})
					if (raycast_data) {
						let node = Interface.createElement('div', {id: 'preview_copy_brush_outline'})
						node.style.setProperty('--radius', '30px');
						let object = new THREE.Object3D();
						object.position.copy(raycast_data.intersects[0].point);
						Preview.selected.addAnnotation('copy_brush', {object, node})
					}
					return false;
				} else {
					if (!copy_source) return false;
					stroke_start_pos = [x, y]
				}
			},
			changePixel(px, py, pxcolor, local_opacity, {opacity,x, y, texture}) {
				let a = opacity * local_opacity;
				let mode = BarItems.copy_brush_mode.value

				let source_pos;
				if (mode == 'copy') {
					source_pos = [
						Math.round(copy_source.x + (px - stroke_start_pos[0])),
						Math.round(copy_source.y + (py - stroke_start_pos[1])),
					]
				} else if (mode == 'pattern') {
					let size = copy_source.size;
					let grid_start = [
						copy_source.x - size/2,
						copy_source.y - size/2,
					]
					source_pos = [
						Math.floor(grid_start[0] + ((px + size*200 - (grid_start[0] % size)) % size)),
						Math.floor(grid_start[1] + ((py + size*200 - (grid_start[1] % size)) % size)),
					]
				} else {
					source_pos = [
						Math.round(copy_source.x + (px - x)),
						Math.round(copy_source.y + (py - y)),
					]
				}
				if (source_pos[0] < 0 || source_pos[0] >= copy_source.width || source_pos[1] < 0 || source_pos[1] >= copy_source.height) {
					return pxcolor;
				}

				let source_index = (source_pos[0] + source_pos[1] * copy_source.width) * 4;
				let color = {
					r: copy_source.data[source_index + 0],
					g: copy_source.data[source_index + 1],
					b: copy_source.data[source_index + 2],
					a: copy_source.data[source_index + 3] / 255
				}

				let before = Painter.getAlphaMatrix(texture, px, py)
				Painter.setAlphaMatrix(texture, px, py, a * color.a);
				if (a > before) {
					a = (a - before) / (1 - before);
				} else if (before) {
					a = 0;
				}

				let result_color = Painter.combineColors(pxcolor, color, a);
				if (Painter.lock_alpha) result_color.a = pxcolor.a
				return result_color;
			}
		},
		allowed_view_modes: ['textured'],
		modes: ['paint'],
		onCanvasClick(data) {
			Painter.startPaintToolCanvas(data, data.event);
		},
		onSelect() {
			Painter.updateNslideValues();
			Interface.addSuggestedModifierKey('shift', 'modifier_actions.draw_line');
			Interface.addSuggestedModifierKey('ctrl', 'modifier_actions.set_copy_source');
		},
		onUnselect() {
			Interface.removeSuggestedModifierKey('shift', 'modifier_actions.draw_line');
			Interface.removeSuggestedModifierKey('ctrl', 'modifier_actions.set_copy_source');
			UVEditor.vue.copy_brush_source = null;
			Preview.all.forEach(preview => {
				preview.removeAnnotation('copy_brush');
			})
		}
	})
	BarItems.copy_brush.tool_settings.brush_size = 16;
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
		brush: {
			shapes: true,
			size: true,
			softness: true,
			opacity: true,
			offset_even_radius: true,
			floor_coordinates: () => BarItems.slider_brush_softness.get() == 0,
			changePixel(px, py, pxcolor, local_opacity, {opacity, ctx, x, y, size, softness, texture, event}) {
				if (Painter.lock_alpha) return pxcolor;

				var a = opacity * local_opacity;

				var before = Painter.getAlphaMatrix(texture, px, py)
				Painter.setAlphaMatrix(texture, px, py, a);

				if (a > before) {
					a = (a - before) / (1 - before);
				} else if (before) {
					a = 0;
				}
				pxcolor.a = Math.clamp(pxcolor.a * (1-a), 0, 1);
				return pxcolor;
			}
		},
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
		onCanvasClick(data) {
			if (data && data.element) {
				Blockbench.showQuickMessage('message.copy_paste_tool_viewport')
			}
		}
	})

	new BarSelect('brush_shape', {
		category: 'paint',
		condition: () => Toolbox && Toolbox.selected.brush && Toolbox.selected.brush.shapes,
		onChange() {
			BARS.updateConditions();
			UVEditor.vue.brush_type = this.value;
		},
		icon_mode: true,
		options: {
			square: {name: true, icon: 'fas.fa-square'},
			circle: {name: true, icon: 'circle'}
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
	new BarSelect('blend_mode', {
		category: 'paint',
		condition: () => (Toolbox && ((Toolbox.selected.brush?.blend_modes == true) || ['draw_shape_tool'].includes(Toolbox.selected.id))),
		options: {
			default: true,
			set_opacity: true,
			color: true,
			behind: true,
			multiply: true,
			divide: true,
			add: true,
			subtract: true,
			screen: true,
			difference: true,
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
	new BarSelect('copy_brush_mode', {
		category: 'paint',
		condition: () => Toolbox && ['copy_brush'].includes(Toolbox.selected.id),
		options: {
			copy: true,
			pattern: true,
			sample: true
		}
	})
	new BarSelect('copy_paste_tool_mode', {
		category: 'paint',
		condition: {tools: ['copy_paste_tool']},
		options: {
			copy: true,
			move: true,
		}
	})

	StateMemory.init('mirror_painting_options', 'object');
	Painter.mirror_painting_options = StateMemory.mirror_painting_options;
	if (!Painter.mirror_painting_options.axis) {
		Painter.mirror_painting_options.axis = {x: true, y: false, z: false};
	}
	if (!Painter.mirror_painting_options.global && !Painter.mirror_painting_options.local) {
		Painter.mirror_painting_options.global = true;
	}
	function toggleMirrorPaintingAxis(axis) {
		let axes = Painter.mirror_painting_options.axis
		axes[axis] = !axes[axis];
		if (!axes.x && !axes.z) {
			if (axis == 'x') {
				axes.z = true;
			} else {
				axes.x = true;
			}
		}
		highlightMirrorPaintingAxes();
		StateMemory.save('mirror_painting_options');
	}
	function toggleMirrorPaintingSpace(space) {
		let options = Painter.mirror_painting_options;
		options[space] = !options[space];
		if (!options.global && !options.local && !options.texture_frames) {
			if (space == 'global') {
				options.local = true;
			} else {
				options.global = true;
			}
		}
		StateMemory.save('mirror_painting_options');
	}
	function highlightMirrorPaintingAxes() {
		if (!Painter.mirror_painting) return;
		
		let grids = new THREE.Object3D();
		let size = 16*16;
		if (Painter.mirror_painting_options.axis.x) {
			var grid = new THREE.GridHelper(size, 16*2, new THREE.LineBasicMaterial({color: gizmo_colors.r}));
			grid.rotation.z = Math.PI/2;
			grid.position.y = size/2;
			grid.position.x = Format.centered_grid ? 0 : 8;
			grids.add(grid);
		}
		if (Painter.mirror_painting_options.axis.z) {
			var grid = new THREE.GridHelper(size, 16*2, new THREE.LineBasicMaterial({color: gizmo_colors.b}));
			grid.rotation.x = Math.PI/2;
			grid.position.y = size/2;
			grid.position.z = Format.centered_grid ? 0 : 8;
			grids.add(grid);
		}
		scene.add(grids);
		setTimeout(() => {
			scene.remove(grids);
			grid.geometry.dispose();
		}, 1000)
	}
	new Toggle('mirror_painting', {
		icon: 'flip',
		category: 'paint',
		condition: () => Modes.paint,
		onChange: function (value) {
			Painter.mirror_painting = value;
			highlightMirrorPaintingAxes();
		},
		side_menu: new Menu('mirror_painting', [
			// Enabled
			{
				name: 'Enabled',
				icon: () => Painter.mirror_painting,
				click() {BarItems.mirror_painting.trigger()}
			},
			'_',
			// Axis
			{
				name: 'menu.mirror_painting.axis',
				description: 'menu.mirror_painting.axis.desc',
				icon: 'call_split',
				children: [
					{name: 'X', icon: () => Painter.mirror_painting_options.axis.x, color: 'x', click() {toggleMirrorPaintingAxis('x')}},
					//{name: 'Y', icon: () => Painter.mirror_painting_options.axis.y, color: 'y', click() {toggleMirrorPaintingAxis('y')}},
					{name: 'Z', icon: () => Painter.mirror_painting_options.axis.z, color: 'z', click() {toggleMirrorPaintingAxis('z')}},
				]
			},
			// Global
			{
				name: 'menu.mirror_painting.global',
				description: 'menu.mirror_painting.global.desc',
				icon: () => !!Painter.mirror_painting_options.global,
				click() {toggleMirrorPaintingSpace('global')}
			},
			// Local
			{
				name: 'menu.mirror_painting.local',
				description: 'menu.mirror_painting.local.desc',
				icon: () => !!Painter.mirror_painting_options.local,
				click() {toggleMirrorPaintingSpace('local')}
			},
			// Texture
			{
				name: 'menu.mirror_painting.texture',
				description: 'menu.mirror_painting.texture.desc',
				icon: () => !!Painter.mirror_painting_options.texture,
				click() {Painter.mirror_painting_options.texture = !Painter.mirror_painting_options.texture; StateMemory.save('mirror_painting_options')}
			},
			// Animated Texture Frames
			{
				name: 'menu.mirror_painting.texture_frames',
				description: 'menu.mirror_painting.texture_frames.desc',
				icon: () => !!Painter.mirror_painting_options.texture_frames,
				click() {toggleMirrorPaintingSpace('texture_frames')}
			},
		], {keep_open: true})
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
		condition: () => (Toolbox && ((Toolbox.selected.brush?.size == true) || ['draw_shape_tool'].includes(Toolbox.selected.id))),
		tool_setting: 'brush_size',
		category: 'paint',
		settings: {
			min: 1, max: 50, interval: 1, default: 1,
		}
	})
	new NumSlider('slider_brush_softness', {
		category: 'paint',
		condition: () => (Toolbox && (Toolbox.selected.brush?.softness == true)),
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
		condition: () => (Toolbox && ((Toolbox.selected.brush?.opacity == true) || ['fill_tool', 'draw_shape_tool', 'gradient_tool'].includes(Toolbox.selected.id))),
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
