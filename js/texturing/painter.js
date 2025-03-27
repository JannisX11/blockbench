StateMemory.init('brush_presets', 'array')
const Painter = {
	currentPixel: [-1, -1],
	brushChanges: false,
	current: {/*texture, image*/},
	selection: {},
	mirror_painting: false,
	lock_alpha: false,
	erase_mode: false,
	edit(texture, callback, options) {
		if (!options.no_undo && !options.no_undo_init) {
			Undo.initEdit({textures: [texture], bitmap: true})
		}
		if (!texture.internal) texture.convertToInternal();

		let edit_name = options.no_undo ? null : (options.edit_name || 'Edit texture');
		let {canvas, ctx, offset} = texture.getActiveCanvas();
		Painter.current.ctx = ctx;
		if (!Painter.current.textures) Painter.current.textures = [];
		Painter.current.textures.safePush(texture);
		Painter.current.texture = texture;
		Painter.current.offset = offset;

		callback(canvas, Painter.current);

		Blockbench.dispatchEvent('edit_texture', {texture, options, canvas, ctx, offset});

		if (options.use_cache && options.no_update === true) {
			return;
		}

		if (options.no_undo && options.use_cache) {
			texture.updateLayerChanges();
			let map = texture.getOwnMaterial().map;
			map.needsUpdate = true;
			UVEditor.vue.updateTextureCanvas();
		} else {
			texture.updateChangesAfterEdit();
			if (!options.no_undo && !options.no_undo_finish) {
				Undo.finishEdit(edit_name)
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
	getTextureToEdit(input_texture) {
		if (BarItems.view_mode.value == 'material' && input_texture) {
			if (input_texture.selected) return input_texture;
			let texture_group = input_texture.getGroup();
			if (texture_group) {
				let textures = texture_group.getTextures();
				if (textures.includes(Texture.selected)) {
					return Texture.selected;
				}
			}
		}
		return input_texture;
	},
	startPaintToolCanvas(data, e) {
		if (!data.intersects && Toolbox.selected.id == 'color_picker') {
			let projections = {};
			let references = ReferenceImage.active.filter(reference => {
				let result = reference.projectMouseCursor(e.clientX, e.clientY);
				if (result) {
					projections[reference.uuid] = result;
					return true;
				}
			});
			if (references.length > 1) {
				let z_indices = {background: 1, viewport: 2, blueprint: 0, float: 4};
				references.sort((a, b) => z_indices[a.layer] - z_indices[b.layer]);
			}

			if (references.length) {
				let projection = projections[references.last().uuid];
				var ctx = Painter.getCanvas(references.last().img).getContext('2d');
				let color = Painter.getPixelColor(ctx, projection[0], projection[1]);
				if (settings.pick_color_opacity.value) {
					let opacity = Math.floor(color.getAlpha()*256);
					for (let id in BarItems) {
						let tool = BarItems[id];
						if (tool.tool_settings && tool.tool_settings.brush_opacity >= 0) {
							tool.tool_settings.brush_opacity = opacity;
						}
					}
				}
				ColorPanel.set(color, e.button == 2);
			}
		}
		if (!data.intersects || (data.element && data.element.locked)) return;
		var texture = Painter.getTextureToEdit(data.element.faces[data.face].getTexture())
		if (!texture || (texture.error && texture.error !== 2)) {
			Blockbench.showQuickMessage('message.untextured')
			return;
		}
		let [x, y] = Painter.getCanvasToolPixelCoords(data.intersects[0].uv, texture);

		Painter.startPaintTool(texture, x, y, data.element.faces[data.face].uv, e, data)

		if (Toolbox.selected.id !== 'color_picker') {
			addEventListeners(document, 'mousemove touchmove', Painter.movePaintToolCanvas, false );
			addEventListeners(document, 'mouseup touchend', Painter.stopPaintToolCanvas, false );
		}
	},
	movePaintToolCanvas(event, data) {
		convertTouchEvent(event);
		if (!data) data = Canvas.raycast(event)
		if (data && data.element && !data.element.locked && data.face) {
			var texture = Painter.getTextureToEdit(data.element.faces[data.face].getTexture());
			if (!texture) return;
			if (texture.img.naturalWidth + texture.img.naturalHeight == 0) return;

			let new_face;
			let [x, y] = Painter.getCanvasToolPixelCoords(data.intersects[0].uv, texture);

			let interval = Toolbox.selected.brush?.interval || 1;
			if (Math.sqrt(Math.pow(x - Painter.current.x, 2) + Math.pow(y - Painter.current.y, 2)) < interval) {
				return;
			}

			if (
				Painter.current.element !== data.element ||
				(Painter.current.face !== data.face && !(data.element.faces[data.face] instanceof MeshFace && Painter.getMeshUVIsland(data.face, data.element.faces[data.face]).includes(Painter.current.face)))
			) {
				if (Toolbox.selected.id === 'draw_shape_tool' || Toolbox.selected.id === 'gradient_tool') {
					return;
				}
				Painter.current.x = x
				Painter.current.y = y
				Painter.current.face = data.face
				Painter.current.element = data.element
				new_face = true
				UVEditor.vue.texture = texture;
				if (texture !== Painter.current.texture && Undo.current_save) {
					Undo.current_save.addTextureOrLayer(texture)
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
	getMeshUVIsland(fkey, face) {
		if (!Painter.current.uv_islands) Painter.current.uv_islands = {};
		if (!Painter.current.uv_islands[fkey]) {
			Painter.current.uv_islands[fkey] = face.getUVIsland();
		}
		return Painter.current.uv_islands[fkey];
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
			Painter.colorPicker(texture, x, y, event);
			return;
		}
		
		let undo_aspects = {selected_texture: true, bitmap: true};
		if (texture.layers_enabled && texture.layers[0]) {
			undo_aspects.layers = [texture.getActiveLayer()];
		} else {
			undo_aspects.textures = [texture];
		}
		Undo.initEdit(undo_aspects);
		Painter.brushChanges = false;
		Painter.painting = true;
		
		if (Toolbox.selected.id === 'draw_shape_tool' || Toolbox.selected.id === 'gradient_tool') {
			Painter.current = {
				element: data && data.element,
				face: data && data.face,
				x, y,
				clear: document.createElement('canvas'),
				face_matrices: {}
			}
			Painter.startPixel = [x, y];
			let {canvas} = texture.getActiveCanvas();
			Painter.current.clear.width = canvas.width;
			Painter.current.clear.height = canvas.height;
			Painter.current.clear.getContext('2d').drawImage(canvas, 0, 0);

		} else {
			Painter.current.face_matrices = {};

			let is_line
			if (data) {
				is_line = (event.shiftKey || Pressing.overrides.shift)
					   && Painter.current.element == data.element
					   && (Painter.current.face == data.face ||
							(data.element.faces[data.face] instanceof MeshFace && Painter.getMeshUVIsland(data.face, data.element.faces[data.face]).includes(Painter.current.face))
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
				let is_line = true;
				if (BarItems.image_tiled_view.value == true && (Math.abs(Painter.current.x - x) > texture.width/2 || Math.abs(Painter.current.y - y) > texture.display_height/2)) {
					is_line = false;
				}
				if (is_line) {
					Painter.drawBrushLine(texture, x, y, event, new_face, uv);
				} else {
					Painter.current.x = Painter.current.y = 0
					Painter.useBrushlike(texture, x, y, event, uv)
				}
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
		let texture = Painter.current.texture;

		if (Toolbox.selected.brush && Toolbox.selected.brush.onStrokeEnd) {
			let result = Toolbox.selected.brush.onStrokeEnd({texture});
			if (result == false) return;
		}
		if (Painter.brushChanges) {
			Painter.current.textures.forEach(texture => {
				texture.updateChangesAfterEdit();
			})
			Undo.finishEdit('Paint texture');
			Painter.brushChanges = false;
		}
		if (Toolbox.selected.id == 'gradient_tool' || Toolbox.selected.id == 'draw_shape_tool') {
			Blockbench.setStatusBarText();
		}
		preventContextMenu();
		delete Painter.current.alpha_matrix;
		delete Painter.editing_area;
		delete Painter.current.cached_canvases;
		delete Painter.current.last_pixel;
		delete Painter.current.texture;
		delete Painter.current.textures;
		delete Painter.current.uv_rects;
		delete Painter.current.uv_islands;
		Painter.painting = false;
		Painter.currentPixel = [-1, -1];
	},
	// Tools
	setupRectFromFace(uvTag, texture) {
		if (!Painter.current.uv_rects) {
			Painter.current.uv_rects = new Map();
		}
		let cached_rect = Painter.current.uv_rects.get(uvTag);
		if (cached_rect) {
			Painter.editing_area = cached_rect;
			return cached_rect;
		}

		let rect;
		let uvFactorX = texture.width / texture.getUVWidth();
		let uvFactorY = texture.display_height / texture.getUVHeight();
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
				let min_x = texture.getUVWidth(), min_y = texture.getUVHeight(), max_x = 0, max_y = 0;

				for (let vkey in uvTag) {
					min_x = Math.min(min_x, uvTag[vkey][0]); max_x = Math.max(max_x, uvTag[vkey][0]);
					min_y = Math.min(min_y, uvTag[vkey][1]); max_y = Math.max(max_y, uvTag[vkey][1]);
				}
				
				let current_face = Mesh.selected[0] && Mesh.selected[0].faces[Painter.current.face];
				if (current_face) {
					let island = Painter.getMeshUVIsland(Painter.current.face, current_face);
					island.forEach(fkey => {
						let face = Mesh.selected[0].faces[fkey];
						if (!face) return;
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
		Painter.current.uv_rects.set(uvTag, rect);
		return rect;
	},
	useBrushlike(texture, x, y, event, uvTag, no_update, is_opposite) {
		if (Painter.currentPixel[0] === x && Painter.currentPixel[1] === y) return;
		Painter.currentPixel = [x, y];
		Painter.brushChanges = true;
		if (!is_opposite) {
			UVEditor.vue.last_brush_position.V2_set(x, y);
		}
		let uvFactorX = texture.width / texture.getUVWidth();
		let uvFactorY = texture.display_height / texture.getUVHeight();

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

		var color = tinycolor(ColorPanel.get(Keybinds.extra.paint_secondary_color.keybind.isTriggered(event))).toRgb();
		var size = BarItems.slider_brush_size.get();
		let softness = BarItems.slider_brush_softness.get()/100;
		let b_opacity = BarItems.slider_brush_opacity.get()/255;
		let tool = Toolbox.selected;
		let matrix_id = Painter.current.element
					  ? (Painter.current.element.uuid + Painter.current.face)
					  : Painter.current.face;

		if (TextureLayer.selected) {
			TextureLayer.selected.expandTo([x-size+1, y-size+1], [x+size, y+size]);
		}

		ctx.clip()
		if (Painter.current.element instanceof Mesh) {
			let face = Painter.current.element.faces[Painter.current.face];
			if (face && face.vertices.length > 2 && !Painter.current.face_matrices[matrix_id]) {
				Painter.current.face_matrices[matrix_id] = face.getOccupationMatrix(true, [0, 0]);
				let island = Painter.getMeshUVIsland(Painter.current.face, face);
				for (let fkey of island) {
					let face = Painter.current.element.faces[fkey];
					face.getOccupationMatrix(true, [0, 0], Painter.current.face_matrices[matrix_id]);
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
			let face_matrix = settings.paint_side_restrict.value && Painter.current.face_matrices[matrix_id];
			let run_per_pixel = (pxcolor, local_opacity, px, py) => {
				if (face_matrix) {
					if (!face_matrix[px] || !face_matrix[px][py % texture.display_height]) {
						return pxcolor;
					}
				}
				return tool.brush.changePixel(px, py, pxcolor, local_opacity, {color, opacity: b_opacity, ctx, x, y, size, softness, texture, event});
			}
			let shape = BarItems.brush_shape.value;
			if (shape == 'square') {
				Painter.editSquare(ctx, x, y, size, softness * 1.8, run_per_pixel);
			} else if (shape == 'circle') {
				Painter.editCircle(ctx, x, y, size, softness * 1.8, run_per_pixel);
			}

		}
		ctx.restore();
	},
	useFilltool(texture, ctx, x, y, area) {
		let color = tinycolor(ColorPanel.get()).toRgb();
		let b_opacity = BarItems.slider_brush_opacity.get()/255;
		let fill_mode = BarItems.fill_mode.get()
		let blend_mode = BarItems.blend_mode.value;
		let {element, offset} = Painter.current;
		let {rect, uvFactorX, uvFactorY, w, h} = area;

		if (Painter.erase_mode && (fill_mode === 'element' || fill_mode === 'face')) {
			ctx.globalAlpha = b_opacity;
			ctx.fillStyle = 'white';
			ctx.globalCompositeOperation = 'destination-out';
		} else {
			ctx.fillStyle = tinycolor(ColorPanel.get()).setAlpha(b_opacity).toRgbString();
			ctx.globalCompositeOperation = Painter.getBlendModeCompositeOperation();
			if (Painter.lock_alpha) {
				ctx.globalCompositeOperation = 'source-atop';
			}
		}

		function paintElement(element) {
			if (element instanceof Cube) {
				texture.selection.maskCanvas(ctx, offset);
				ctx.beginPath();
				for (var fkey in element.faces) {
					var face = element.faces[fkey]
					if (fill_mode === 'face' && fkey !== Painter.current.face) continue;
					if (Painter.getTextureToEdit(face.getTexture()) === texture) {
						var face_rect = getRectangle(
							face.uv[0] * uvFactorX,
							face.uv[1] * uvFactorY,
							face.uv[2] * uvFactorX,
							face.uv[3] * uvFactorY
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
				ctx.restore();

			} else if (element instanceof Mesh) {
				ctx.beginPath();
				for (var fkey in element.faces) {
					var face = element.faces[fkey];
					if (fill_mode === 'face' && fkey !== Painter.current.face) continue;
					if (face.vertices.length <= 2 || Painter.getTextureToEdit(face.getTexture()) !== texture) continue;
					
					let matrix = Painter.current.face_matrices[element.uuid + fkey] || face.getOccupationMatrix(true, [0, 0]);
					Painter.current.face_matrices[element.uuid + fkey] = matrix;
					for (let x in matrix) {
						for (let y in matrix[x]) {
							if (!matrix[x][y]) continue;
							x = parseInt(x); y = parseInt(y);
							if (!texture.selection.allow(x, y)) continue;
							ctx.rect(x, y, 1, 1);
						}
					}
				}
				ctx.fill()
			}
		}

		if ((element instanceof Cube || element instanceof Mesh) && (fill_mode === 'element' || fill_mode === 'face')) {
			paintElement(element);

		} else if (fill_mode === 'face' || fill_mode === 'element' || fill_mode === 'selection') {
			texture.selection.maskCanvas(ctx, offset);
			ctx.fill();
			ctx.restore();

		} else if (fill_mode === 'selected_elements') {
			for (let element of Outliner.selected) {
				paintElement(element);
			}

		} else {
			let selection = texture.selection;
			let image_data = ctx.getImageData(x - offset[0], y - offset[1], 1, 1);
			let pxcol = [...image_data.data];
			let map = {}
			Painter.scanCanvas(ctx, rect[0], rect[1], w, h, (x, y, px) => {
				if (pxcol.equals(px) && selection.allow(x, y)) {
					if (!map[x]) map[x] = {}
					map[x][y] = true
				}
			})
			var scan_value = true;
			if (fill_mode === 'color_connected') {
				let points = [[x, y]];
				for (let i = 0; i < 1_000_000; i++) {
					let current_points = points;
					points = [];
					for (let [x, y] of current_points) {
						if (map[x] && map[x][y]) {
							map[x][y] = false;
							points.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
						}
					}
					if (points.length == 0) break;
				}
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
						if (blend_mode == 'default') {
							result_color = Painter.combineColors(pxcolor, color, b_opacity);
						} else {
							result_color = Painter.blendColors(pxcolor, color, b_opacity, blend_mode);
						}
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
					return px;
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
			if (Toolbox.selected.id == 'gradient_tool') even_brush_size = true;
			if (mirror_element instanceof Cube) {
	
				let uvFactorX = 1 / texture.getUVWidth() * texture.img.naturalWidth;
				let uvFactorY = 1 / texture.getUVHeight() * texture.img.naturalHeight;
	
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
					(even_brush_size ? x : x + 0.5) * (texture.getUVWidth() / texture.width),
					(even_brush_size ? y : y + 0.5) * (texture.getUVHeight() / texture.height)
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

				point_on_uv[0] /= texture.getUVWidth() / texture.width;
				point_on_uv[1] /= texture.getUVHeight() / texture.height;
				
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
			let center = Painter.mirror_painting_options.texture_center;
			if (!center || (!center[0] && !center[1])) {
				center = [texture.width/2, texture.display_height/2];
			}
			if (Painter.mirror_painting_options.axis.x) {
				targets.push({
					x: center[0]*2 - x - offset,
					y: y
				});
			}
			if (Painter.mirror_painting_options.axis.z) {
				targets.push({
					x: x,
					y: center[1]*2 - y - offset
				});
			}
			if (Painter.mirror_painting_options.axis.x && Painter.mirror_painting_options.axis.z) {
				targets.push({
					x: center[0]*2 - x - offset,
					y: center[1]*2 - y - offset
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
		targets = targets.filter(target => !!target);
		targets.forEach(target => {
			target.x = Math.roundTo(target.x, 8);
			target.y = Math.roundTo(target.y, 8);
		})
		return targets;
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
		let interval = Toolbox.selected.brush?.interval || 1;
		var i = Math.min(interval, length);
		var x, y;
		let {ctx, offset} = Painter.current;
		if (interval == 1) {
			if (Math.abs(diff_x) > Math.abs(diff_y)) {
				interval = Math.sqrt(Math.pow(diff_y/diff_x, 2) + 1)
			} else {
				interval = Math.sqrt(Math.pow(diff_x/diff_y, 2) + 1)
			}
		}

		if (Toolbox.selected.brush?.pixel_perfect && BarItems.pixel_perfect_drawing.value && BarItems.slider_brush_size.get() == 1) {
			let direction = 0;
			if (length == 1 && diff_x && !diff_y) {direction = 1;}
			if (length == 1 && !diff_x && diff_y) {direction = 2;}
			let image_data = ctx.getImageData(end_x - offset[0], end_y - offset[1], 1, 1);
			let pixel = {
				direction,
				image_data,
				position: [end_x - offset[0], end_y - offset[1]]
			};
			if (length == 1 && Painter.current.last_pixel && Painter.current.last_pixel.direction && direction && Painter.current.last_pixel.direction != direction) {
				ctx.putImageData(Painter.current.last_pixel.image_data, ...Painter.current.last_pixel.position);
				delete Painter.current.last_pixel;
			} else {
				Painter.current.last_pixel = pixel;
			}
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
			let {ctx, offset} = Painter.current;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(Painter.current.clear, 0, 0)

			let color = tinycolor(ColorPanel.get(Keybinds.extra.paint_secondary_color.keybind.isTriggered(event))).toRgb();
			let b_opacity = BarItems.slider_brush_opacity.get()/255;
			var width = BarItems.slider_brush_size.get();
			let shape = BarItems.draw_shape_type.get();
			let hollow = shape.substr(-1) == 'h';
			let blend_mode = BarItems.blend_mode.value;
			shape = shape.replace(/_h$/, '');

			function drawShape(start_x, start_y, x, y, uvTag) {

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
				} else {
					ctx.globalCompositeOperation = Painter.getBlendModeCompositeOperation();
				}


				if (shape === 'rectangle') {
					if (uvTag) {
						let rect = Painter.setupRectFromFace(uvTag, texture);
						let [w, h] = [rect[2] - rect[0], rect[3] - rect[1]];
						ctx.beginPath();
						ctx.rect(rect[0] - offset[0], rect[1] - offset[1], w, h);
					} else {
						texture.selection.maskCanvas(ctx, offset);
					}
					ctx.strokeStyle = ctx.fillStyle = tinycolor(ColorPanel.get(Keybinds.extra.paint_secondary_color.keybind.isTriggered(event))).setAlpha(b_opacity).toRgbString();
					ctx.lineWidth = width;
					ctx.beginPath();
					var rect = getRectangle(start_x, start_y, start_x+diff_x, start_y+diff_y);
					
					if (hollow && rect.w > 0 && rect.h > 0) {
						ctx.rect(rect.ax+(width%2 ? 0.5 : 1) - offset[0], rect.ay+(width%2 ? 0.5 : 1) - offset[1], rect.x, rect.y);
						ctx.stroke();
					} else {
						ctx.rect(rect.ax - offset[0], rect.ay - offset[1], rect.x+1, rect.y+1);
						ctx.fill();
					}
				} else if (shape === 'ellipse') {
					let rect = Painter.setupRectFromFace(uvTag, texture);
					let [w, h] = [rect[2] - rect[0], rect[3] - rect[1]];
					Painter.modifyCanvasSection(ctx, rect[0], rect[1], w, h, offset, (changePixel) => {
						//changePixel(0, 0, editPx)
						function editPx(pxcolor) {
							if (!Painter.erase_mode) {
								if (blend_mode == 'default') {
									result_color = Painter.combineColors(pxcolor, color, b_opacity);
								} else {
									result_color = Painter.blendColors(pxcolor, color, b_opacity, blend_mode);
								}
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
			let {ctx, offset} = Painter.current;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(Painter.current.clear, 0, 0)
			if (Painter.lock_alpha) {
				ctx.globalCompositeOperation = 'source-atop';
			}

			function drawGradient(start_x, start_y, x, y, uvTag) {
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

				let gradient = ctx.createLinearGradient(start_x - offset[0], start_y - offset[1], x - offset[0], y - offset[1]);
				let color = tinycolor(ColorPanel.get(Keybinds.extra.paint_secondary_color.keybind.isTriggered(event)));
				gradient.addColorStop(0, color.setAlpha(b_opacity).toRgbString());
				gradient.addColorStop(1, color.setAlpha(0).toRgbString());

				if (uvTag) {
					let rect = Painter.setupRectFromFace(uvTag, texture);
					let [w, h] = [rect[2] - rect[0], rect[3] - rect[1]];
					ctx.beginPath();
					ctx.rect(rect[0] - offset[0], rect[1] - offset[1], w, h);
				} else {
					texture.selection.maskCanvas(ctx, offset);
					let rect = texture.selection.getBoundingRect(true);
					ctx.rect(rect.start_x - offset[0], rect.start_y - offset[1], rect.width, rect.height);
				}
				ctx.fillStyle = gradient;
				ctx.fill();
				ctx.restore();

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
	colorPicker(texture, x, y, event) {
		let {ctx} = settings.pick_combined_color.value ? texture : texture.getActiveCanvas();
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
		ColorPanel.set(color, event && event.button == 2);
	},
	// Util
	combineColors(base, added, opacity) {
		//if (Math.isNumber(base)) base = intToRGBA(base)
		//if (Math.isNumber(added)) added = intToRGBA(added)

		if (added.a*opacity == 1) return {r: added.r, g: added.g, b: added.b, a: added.a};

		let original_a = added.a
		added.a = added.a*opacity

		let mix = {};
		mix.a = Math.clamp(1 - (1 - added.a) * (1 - base.a), 0, 1); // alpha
		mix.r = Math.round((added.r * added.a / mix.a) + (base.r * base.a * (1 - added.a) / mix.a)); // red
		mix.g = Math.round((added.g * added.a / mix.a) + (base.g * base.a * (1 - added.a) / mix.a)); // green
		mix.b = Math.round((added.b * added.a / mix.a) + (base.b * base.a * (1 - added.a) / mix.a)); // blue

		added.a = original_a
		return mix;
	},
	blendColors(base, added, opacity, blend_mode) {
		//if (Math.isNumber(base)) base = intToRGBA(base);
		//if (Math.isNumber(added)) added = intToRGBA(added);

		let original_a = added.a;
		added.a = added.a*opacity;

		let mix = {};
		mix.a = Math.clamp(1 - (1 - added.a) * (1 - base.a), 0, 1); // alpha

		let luminance;
		if (blend_mode == 'color') {
			luminance = (base.r * 0.2126 + base.g * 0.7152 + base.b * 0.0722) / 255;
			mix.a = base.a;
		}

		['r', 'g', 'b'].forEach(ch => {
			let normal_base = base[ch] / 255;
			let normal_added = added[ch] / 255;
			if (base.a == 0) normal_base = normal_added;

			switch (blend_mode) {
				case 'behind':
				mix[ch] = (normal_base * base.a / mix.a)  +  (normal_added * added.a * (1 - base.a) / mix.a);
				break;

				case 'color':
				mix[ch] = (luminance * normal_added * added.a) + (normal_base * (1-added.a));
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

				case 'overlay':
					if (base[ch] < 128) {
						mix[ch] = (((2*normal_base*normal_added)) * added.a) + (normal_base * (1-added.a));
					}
					else{
						mix[ch] = ((1 - 2*((1-normal_base) * (1-normal_added))) * added.a) + (normal_base * (1-added.a));
					}
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
						symmetry_axes.find(axis => !Math.epsilon(element.to[axis]-center, center-element2.from[axis], e)) == undefined &&
						symmetry_axes.find(axis => !Math.epsilon(element.rotation[axis], element2.rotation[axis], e)) == undefined
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
		BarItems.slider_color_select_threshold.update()
	},
	getBlendModeCompositeOperation(input = BarItems.blend_mode.value) {
		switch (input) {
			case 'set_opacity': return 'source-atop';
			case 'color': return 'color';
			case 'behind': return 'destination-over';
			case 'multiply': return 'multiply';
			//case 'divide': return 'color-burn';
			case 'add': return 'lighter';
			//case 'subtract': return 'darken';
			case 'screen': return 'screen';
			case 'overlay': return 'overlay';
			case 'difference': return 'difference';
			default: return 'source-over';
		}
	},
	getCanvasToolPixelCoords(uv_point, texture) {
		let x = uv_point.x * texture.img.naturalWidth;
		let y = (1-uv_point.y) * texture.img.naturalHeight;
		if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
			let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0.5 : 0;
			x = Math.floor(x + offset);
			y = Math.floor(y + offset);
		}
		return [x, y];
	},
	getCanvas(texture) {
		if (texture instanceof Texture) {
			return texture.canvas;
		} else {
			let img = texture;
			let canvas = document.createElement('canvas');
			let ctx = canvas.getContext('2d');
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			ctx.drawImage(img, 0, 0)
			return canvas;
		}
	},
	copyCanvas(original_canvas) {
		let canvas = document.createElement('canvas');
		let ctx = canvas.getContext('2d');
		canvas.width = original_canvas.width;
		canvas.height = original_canvas.height;
		ctx.drawImage(original_canvas, 0, 0);
		return canvas;
	},
	scanCanvas(ctx, x, y, w, h, cb) {
		let local_x = x;
		let local_y = y;
		if (Painter.current.texture && Painter.current.texture.selected_layer) {
			local_x -= Painter.current.texture.selected_layer.offset[0];
			local_y -= Painter.current.texture.selected_layer.offset[1];
		}
		if (local_x < 0) { x -= local_x; local_x = 0; }
		if (local_y < 0) { y -= local_y; local_y = 0; }
		w = Math.min(w, ctx.canvas.width - local_x);
		h = Math.min(h, ctx.canvas.height - local_y);
		if (!w || !h) return;
		let arr = ctx.getImageData(local_x, local_y, w, h);
		let changes = false;
		for (let i = 0; i < arr.data.length; i += 4) {
			let pixel = [arr.data[i], arr.data[i+1], arr.data[i+2], arr.data[i+3]];

			let px = x + (i/4) % w;
			let py = y + Math.floor((i/4) / w);
			let result = cb(px, py, pixel);

			if (result) {
				arr.data[i+0] = result[0];
				arr.data[i+1] = result[1];
				arr.data[i+2] = result[2];
				arr.data[i+3] = result[3];
				changes = true;
			}
		}
		if (changes) {
			ctx.putImageData(arr, local_x, local_y);
		}
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
	modifyCanvasSection(ctx, x, y, w, h, offset = [0, 0], cb) {
		if (x < offset[0]) x = offset[0];
		if (y < offset[1]) y = offset[1];
		w = Math.min(w, ctx.canvas.width - x + offset[0]);
		h = Math.min(h, ctx.canvas.height - y + offset[1]);
		let arr = ctx.getImageData(x - offset[0], y - offset[1], w, h);
		let processed = [];
		let texture_selection = UVEditor.texture && UVEditor.texture.selection;

		cb((px, py, editPx) => {
			if (texture_selection && !texture_selection.allow(px, py)) return;
			// to image data space
			px = px - x;
			py = py - y;
			if (px < 0 || px >= w) return;
			if (py < 0 || py >= h) return;
			let start = (px + py*w) * 4;
			if (processed.includes(start)) return;
			processed.push(start);
			let result_color = editPx({
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

		ctx.putImageData(arr, x - offset[0], y - offset[1]);
	},
	editCircle(ctx, x, y, r, soft, editPx) {
		r = Math.round(r+1)/2;
		let pixel_roundness_factor = 1 + 1 / (r+3);
		let selection = Painter.current.texture.selection;
		let check_painting_area = settings.paint_side_restrict.value && Painter.editing_area && typeof Painter.editing_area === 'object';
		let is_smooth = x%1 != 0;
		let r_1 = r%1;
		Painter.scanCanvas(ctx, Math.floor(x)-Math.ceil(r)-2, Math.floor(y)-Math.ceil(r)-2, 2*r+3, 2*r+3, function (px, py, pixel) {
			if (
				check_painting_area &&
				(
					px+0.02 < Math.floor(Painter.editing_area[0]) ||
					py+0.02 < Math.floor(Painter.editing_area[1]) ||
					px+0.02 >= Painter.editing_area[2] ||
					py+0.02 >= Painter.editing_area[3]
				)
			) {
				return;
			}
			if (selection.allow(px, py) == 0) return;

			let v_px = px - x;
			let v_py = py - y;

			if (is_smooth) {
				// Smooth
				v_px += 0.5; v_py += 0.5;
			} else if (r_1) {
				// Pixel Perfect
				v_px += 0.5; v_py += r_1;
			}

			let distance = Math.sqrt(v_px*v_px + v_py*v_py)
			let pos_on_gradient;
			if (soft*r != 0) {
				pos_on_gradient = Math.clamp((distance-(1-soft)*r) / (soft*r), 0, 1)
				pos_on_gradient = Math.hermiteBlend(pos_on_gradient);
			} else {
				distance *= pixel_roundness_factor;
				pos_on_gradient = Math.floor(distance/r);
			}

			let opacity = Math.clamp(1-pos_on_gradient, 0, 1);

			if (opacity > 0) {
				let result_color = editPx({
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
			return pixel;
		});
	},
	editSquare(ctx, x, y, r, soft, editPx) {
		r = Math.round(r+1)/2;
		let selection = Painter.current.texture.selection;
		let check_painting_area = settings.paint_side_restrict.value && Painter.editing_area && typeof Painter.editing_area === 'object';
		let is_smooth = x%1 != 0;
		let r_1 = r%1;
		Painter.scanCanvas(ctx, Math.floor(x)-Math.ceil(r)-2, Math.floor(y)-Math.ceil(r)-2, 2*r+3, 2*r+3, function (px, py, pixel) {
			if (
				check_painting_area &&
				(
					px+0.02 < Math.floor(Painter.editing_area[0]) ||
					py+0.02 < Math.floor(Painter.editing_area[1]) ||
					px+0.02 >= Painter.editing_area[2] ||
					py+0.02 >= Painter.editing_area[3]
				)
			) {
				return;
			}
			if (selection.allow(px, py) == 0) return;

			let v_px = px - x;
			let v_py = py - y;

			if (is_smooth) {
				// Smooth
				v_px += 0.5; v_py += 0.5;
			} else if (r_1) {
				// Pixel Perfect
				v_px += 0.5; v_py += r_1;
			}

			let distance = Math.max(Math.abs(v_px), Math.abs(v_py));
			let pos_on_gradient;
			if (soft*r != 0) {
				pos_on_gradient = Math.clamp((distance-(1-soft)*r) / (soft*r), 0, 1)
				pos_on_gradient = 3*Math.pow(pos_on_gradient, 2) - 2*Math.pow(pos_on_gradient, 3);
			} else {
				pos_on_gradient = Math.floor((distance)/r)
			}

			let opacity = limitNumber(1-pos_on_gradient, 0, 1)

			if (opacity > 0) {
				let result_color = editPx({
					r: pixel[0],
					g: pixel[1],
					b: pixel[2],
					a: pixel[3]/255
				}, opacity, px, py)
				pixel[0] = result_color.r
				pixel[1] = result_color.g
				pixel[2] = result_color.b
				pixel[3] = result_color.a*255
				return pixel;
			}
		});
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
						dialog.setFormToggles({
							size: preset.size !== null,
							softness: preset.softness !== null,
							opacity: preset.opacity !== null,
							color: preset.color !== null,
						}, false);
						dialog.setFormValues({
							name: preset.name,
							size: preset.size == null ? BarItems.slider_brush_size.get() : preset.size,
							softness: preset.softness == null ? BarItems.slider_brush_softness.get() : preset.softness,
							opacity: preset.opacity == null ? BarItems.slider_brush_opacity.get() : preset.opacity,
							pixel_perfect: preset.pixel_perfect == null ? BarItems.pixel_perfect_drawing.value : preset.pixel_perfect,
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
					//divide: 'action.blend_mode.divide',
					add: 'action.blend_mode.add',
					//subtract: 'action.blend_mode.subtract',
					screen: 'action.blend_mode.screen',
					overlay: 'action.blend_mode.overlay',
					difference: 'action.blend_mode.difference',
				}},
				size: {
					label: 'action.slider_brush_size', nocolon: true,
					description: 'action.slider_brush_size.desc',
					type: 'number',
					value: 1, min: 1, max: 100,
					toggle_enabled: true,
					toggle_default: true
				},
				opacity: {
					label: 'action.slider_brush_opacity', nocolon: true,
					description: 'action.slider_brush_opacity.desc', type: 'number',
					value: 255, min: 0, max: 255,
					toggle_enabled: true,
					toggle_default: true
				},
				softness: {
					label: 'action.slider_brush_softness', nocolon: true,
					description: 'action.slider_brush_softness.desc', type: 'number',
					value: 0, min: 0, max: 100,
					toggle_enabled: true,
					toggle_default: true
				},
				pixel_perfect: {
					label: 'action.pixel_perfect_drawing',
					type: 'checkbox',
				},
				color: {
					label: 'data.color', nocolon: true,
					description: 'action.brush_shape.desc', type: 'color',
					toggle_enabled: true,
					toggle_default: true
				},
				actions: {type: 'buttons', buttons: ['generic.delete'], click() {
					dialog.content_vue.removePreset();
				}}
			},
			/**
			use_size
			use_opacity
			use_softness
			use_color
			 */
			onFormChange(form) {
				let preset = this.content_vue.selected_preset;
				preset.name = form.name;

				if (form.size != undefined) {
					preset.size = form.size;
				} else {
					preset.size = null;
				}
				if (form.softness != undefined) {
					preset.softness = form.softness;
				} else {
					preset.softness = null;
				}
				if (form.opacity != undefined) {
					preset.opacity = form.opacity;
				} else {
					preset.opacity = null;
				}
				if (form.color != undefined) {
					preset.color = form.color.toHexString();
				} else {
					preset.color = null;
				}
				if (form.pixel_perfect) {
					preset.pixel_perfect = true;
				} else {
					preset.pixel_perfect = false;
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
		if (preset.pixel_perfect != undefined) 	BarItems.pixel_perfect_drawing.set(preset.pixel_perfect);
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
			pixel_perfect: false,
			shape: 'square',
			blend_mode: 'default'
		},
		{
			name: 'menu.brush_presets.pixel_perfect',
			default: true,
			size: 1,
			softness: 0,
			pixel_perfect: true,
			shape: 'square',
			blend_mode: 'default'
		},
		{
			name: 'menu.brush_presets.smooth_brush',
			default: true,
			size: 5,
			softness: 70,
			pixel_perfect: false,
			shape: 'circle',
			blend_mode: 'default'
		}
	]
}

class IntMatrix {
	constructor(width = 16, height = 16) {
		this.width = width;
		this.height = height;
		this.array = null;
		this.override = false;
	}
	get is_custom() {
		return this.override === null;
	}
	/**
	 * The array does not exist by default to save memory, this activates it.
	 */
	activate() {
		this.array = new Int8Array(this.width * this.height);
	}
	/**
	 * Get the value at the specified pixel
	 * @param {*} x 
	 * @param {*} y 
	 * @returns 
	 */
	get(x, y) {
		if (this.override !== null) {
			return this.override
		} else {
			if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
			return this.array[y * this.width + x] || 0;
		}
	}
	/**
	 * Test whether painting is allowed at a specific pixel
	 * @param {*} x 
	 * @param {*} y 
	 * @returns 
	 */
	allow(x, y) {
		if (this.override !== null) {
			return true;
		} else {
			return this.array[y * this.width + x];
		}
	}
	/**
	 * Get the value at the specified pixel directly without override and bounds check
	 * @param {*} x 
	 * @param {*} y 
	 * @returns 
	 */
	getDirect(x, y) {
		return this.array[y * this.width + x];
	}
	getBoundingRect(respect_empty) {
		let rect = new Rectangle();
		if (this.override == true || (respect_empty && this.override == false)) {
			rect.width = this.width;
			rect.height = this.height;
		} else if (this.override == null) {
			let min_x = this.width;
			let min_y = this.height;
			let max_x = 0;
			let max_y = 0;
			this.forEachPixel((x, y, value) => {
				if (!value) return;
				min_x = Math.min(min_x, x);
				min_y = Math.min(min_y, y);
				max_x = Math.max(max_x, x+1);
				max_y = Math.max(max_y, y+1);
			})
			if (min_x == this.width) {
				// No pixel selected
				rect.width = this.width;
				rect.height = this.height;
			} else {
				rect.fromCoords(min_x, min_y, max_x, max_y);
			}
		}
		return rect;
	}
	hasSelection() {
		if (this.is_custom) {
			return this.array.findIndex(v => v) != -1;
		} else {
			return this.override;
		}
	}
	/**
	 * Set the value at a specified pixel
	 * @param {number} x 
	 * @param {number} y 
	 * @param {number} value 
	 */
	set(x, y, value) {
		if (this.override !== null) {
			if (!this.array) this.activate();
			if (this.override == true) {
				this.array.fill(1);
			}
			this.override = null;
		}
		this.array[y * this.width + x] = value;
	}
	/**
	 * If there was a selection, whether override or not, clear it
	 */
	clear() {
		this.setOverride(false);
	}
	/**
	 * Change override mode
	 * @param {true|false|null} value 
	 * @returns 
	 */
	setOverride(value) {
		if (value === this.override) return;
		this.override = value;
		if (value === null) {
			if (!this.array) {
				this.activate();
			} else {
				this.array.fill(0);
			}
		} else {
			delete this.array;
		}
	}
	/**
	 * Change the size of the matrix. Unless using overrides, the selection gets lost.
	 * @param {number} width 
	 * @param {number} height 
	 * @returns {boolean} Whether the size had to be changed
	 */
	changeSize(width, height)  {
		if (width == this.width && height == this.height) return false;
		this.width = width;
		this.height = height;
		if (this.array) {
			this.array = new Int8Array(this.width * this.height);
		}
		return true;
	}
	forEachPixel(callback) {
		let length = this.width * this.height;
		for (let i = 0; i < length; i++) {
			let x = i % this.width;
			let y = Math.floor(i /  this.width);
			callback(x, y, this.array[i], i);
		}
	}
	translate(offset_x, offset_y) {
		if (this.override !== null) return;
		let new_array = new Int8Array(this.width * this.height);
		this.forEachPixel((x, y, value, i) => {
			x += offset_x;
			y += offset_y;
			if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
			new_array[y * this.width + x] = value;
		})
		this.array = new_array;
	}
	toBoxes() {
		if (!this.is_custom) return [[0, 0, this.width, this.height]];
		let boxes = [];
		this.forEachPixel((x, y, value) => {
			if (value !== 1) return;
			let w = 1;
			let h = 1;
			let can_exp_w = true;
			let can_exp_h = true;
			let i = 0;
			while (can_exp_w || can_exp_h) {
				i++;
				if (can_exp_w && x + i >= this.width) can_exp_w = false;
				if (can_exp_w) {
					for (let j = 0; j < h; j++) {
						if (this.getDirect(x+i, y+j) != 1) {
							can_exp_w = false;
							break;
						}
					}
					if (can_exp_w) w++;
				}
				if (can_exp_h && y + i >= this.height) can_exp_h = false;
				if (can_exp_h) {
					for (let j = 0; j < w; j++) {
						if (this.getDirect(x+j, y+i) != 1) {
							can_exp_h = false;
							break;
						}
					}
					if (can_exp_h) h++;
				}
			}
			for (let x2 = 0; x2 < w; x2++) {
				for (let y2 = 0; y2 < h; y2++) {
					this.array[(y+y2) * this.width + (x+x2)] = 2;
				}
			};
			boxes.push([x, y, w, h]);
		})
		this.forEachPixel((x, y, value, i) => {
			if (value === 2) this.array[i] = 1;
		})
		return boxes;
	}
	maskCanvas(ctx, offset = [0, 0]) {
		ctx.save();
		if (!this.is_custom) return;
		ctx.beginPath();
		let boxes = this.toBoxes();
		boxes.forEach(box => {
			ctx.rect(box[0] - offset[0], box[1] - offset[1], box[2], box[3]);
		})
		ctx.closePath();
		ctx.clip();
	}
}

SharedActions.add('copy', {
	subject: 'image_content',
	condition: () => Prop.active_panel == 'uv' && Modes.paint && Texture.getDefault(),
	run(event, cut) {
		let texture = Texture.getDefault();
		let selection = texture.selection;

		let {canvas, ctx, offset} = texture.getActiveCanvas();
		
		if (selection.override != null) {
			Clipbench.image = {
				x: offset[0], y: offset[1],
				frame: texture.currentFrame,
				data: canvas.toDataURL('image/png', 1),
			}
		} else {
			let rect = selection.getBoundingRect();
			let copy_canvas = document.createElement('canvas');
			let copy_ctx = copy_canvas.getContext('2d');
			copy_canvas.width = rect.width;
			copy_canvas.height = rect.height;
			
			selection.maskCanvas(copy_ctx, [rect.start_x, rect.start_y]);
			copy_ctx.drawImage(canvas, -rect.start_x + offset[0], -rect.start_y + offset[1]);

			Clipbench.image = {
				x: rect.start_x,
				y: rect.start_y,
				frame: texture.currentFrame,
				data: copy_canvas.toDataURL('image/png', 1)
			}
			canvas = copy_canvas;
		}


		if (isApp) {
			let img = nativeImage.createFromDataURL(Clipbench.image.data);
			clipboard.writeImage(img);
		} else {
			canvas.toBlob(blob => {
				navigator.clipboard.write([
					new ClipboardItem({
						[blob.type]: blob,
					}),
				]);
			});
		}

		if (cut) {
			SharedActions.runSpecific('delete', 'image_content', {message: 'Cut texture selection'});
		}
	}
})
SharedActions.add('paste', {
	subject: 'image_content',
	condition: () => Prop.active_panel == 'uv' && Modes.paint && Texture.getDefault(),
	run(event) {
		let texture = Texture.getDefault();

		async function loadFromDataUrl(data_url) {
			let frame = new CanvasFrame();
			await frame.loadFromURL(data_url);

			Undo.initEdit({textures: [texture], bitmap: true});
			if (!texture.layers_enabled) {
				texture.flags.add('temporary_layers');
				texture.activateLayers(false);
			}
			let offset;
			if (Clipbench.image) {
				offset = [Math.clamp(Clipbench.image.x, 0, texture.width), Math.clamp(Clipbench.image.y, 0, texture.height)];
				offset[0] = Math.clamp(offset[0], 0, texture.width-frame.width);
				offset[1] = Math.clamp(offset[1], 0, texture.height-frame.height);
			}
			let old_frame = Clipbench.image?.frame || 0;
			if (old_frame || texture.currentFrame) {
				offset[1] += texture.display_height * ((texture.currentFrame||0) - old_frame);
			}
			let layer = new TextureLayer({name: 'pasted', offset}, texture);
			let image_data = frame.ctx.getImageData(0, 0, frame.width, frame.height);
			layer.setSize(frame.width, frame.height);
			layer.ctx.putImageData(image_data, 0, 0);
			if (!offset) layer.center();

			layer.addForEditing();
			layer.setLimbo();
			texture.updateChangesAfterEdit();

			Undo.finishEdit('Paste into texture');
			if (Toolbox.selected.id != 'selection_tool') BarItems.move_layer_tool.select();
			updateInterfacePanels();
			BARS.updateConditions();
		}
		
	
		if (isApp) {
			var image = clipboard.readImage().toDataURL();
			loadFromDataUrl(image);
		} else {
			navigator.clipboard.read().then(content => {
				if (content && content[0] && content[0].types.includes('image/png')) {
					content[0].getType('image/png').then(blob => {
						let url = URL.createObjectURL(blob);
						loadFromDataUrl(url);
					})
				}
			}).catch(() => {})
		}
		
	}
})
SharedActions.add('duplicate', {
	subject: 'image_content',
	condition: () => Prop.active_panel == 'uv' && Modes.paint && Texture.getDefault(),
	run(event) {
		let texture = Texture.getDefault();
		let selection = texture.selection;

		let {canvas, ctx, offset} = texture.getActiveCanvas();
		let layer = texture.selected_layer;
		
		if (selection.is_custom) {
			let rect = selection.getBoundingRect();
			let copy_canvas = document.createElement('canvas');
			let copy_ctx = copy_canvas.getContext('2d');
			copy_canvas.width = rect.width;
			copy_canvas.height = rect.height;
			
			selection.maskCanvas(copy_ctx, [rect.start_x, rect.start_y]);
			copy_ctx.drawImage(canvas, -rect.start_x + offset[0], -rect.start_y + offset[1]);

			canvas = copy_canvas;
			offset = [rect.start_x, rect.start_y];
		}

		Undo.initEdit({textures: [texture], bitmap: true});
		if (!texture.layers_enabled) {
			texture.flags.add('temporary_layers');
			texture.activateLayers(false);
		}
		let new_layer = new TextureLayer({name: layer ? (layer.name + ' - copy') : 'selection', offset}, texture);
		let image_data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
		new_layer.setSize(canvas.width, canvas.height);
		new_layer.ctx.putImageData(image_data, 0, 0);
		new_layer.addForEditing();
		new_layer.setLimbo();
		texture.updateLayerChanges(true);
		texture.saved = false;

		Undo.finishEdit('Duplicate texture selection');
		updateInterfacePanels();
		BARS.updateConditions();
	}
})
SharedActions.add('delete', {
	subject: 'image_content',
	condition: () => Prop.active_panel == 'uv' && Modes.paint && Texture.getDefault(),
	run(event, context = 0) {
		let texture = Texture.getDefault();
		if (texture.selection.override == false) return;

		texture.edit((canvas, {ctx, offset}) => {
			let selection = texture.selection;
			let boxes = selection.toBoxes();
			boxes.forEach(box => {
				ctx.clearRect(box[0] - offset[0], box[1] - offset[1], box[2], box[3]);
			})
		}, {edit_name: context.message || 'Delete texture section'});
	}
})

BARS.defineActions(function() {

	new KeybindItem('paint_secondary_color', {
		category: 'paint',
		keybind: new Keybind({shift: null})
	})
	Blockbench.onUpdateTo('4.9.0-beta.1', () => {
		if (Keybinds.extra.preview_drag.keybind.key != 3 && Keybinds.extra.preview_rotate.keybind.key != 3) {
			Keybinds.extra.paint_secondary_color.keybind.set({key: 3}).save(false);
		}
	})
	new Tool('pan_tool', {
		icon: 'pan_tool',
		category: 'tools',
		cursor: 'grab',
		selectFace: false,
		transformerMode: 'hidden',
		allowed_view_modes: ['textured', 'material'],
		modes: ['paint'],
		condition: Blockbench.isMobile && {modes: ['paint']}
	})
	const BlendModes = {
		set_opacity: 'set_opacity',
		set_opacity: 'set_opacity',
		difference: 'difference',
		default: 'default',
	}
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
			pixel_perfect: true,
			floor_coordinates: () => BarItems.slider_brush_softness.get() == 0,
			get interval() {
				let size = BarItems.slider_brush_size.get();
				if (size > 40) {
					return size / 12;
				} else {
					return 1 + size * BarItems.slider_brush_softness.get() / 1500;
				}
			},
			changePixel(px, py, pxcolor, local_opacity, {color, opacity, ctx, x, y, size, softness, texture, event}) {
				let blend_mode = BarItems.blend_mode.value;
				if (blend_mode == BlendModes.set_opacity) local_opacity = 1;
				let a = opacity * local_opacity;

				if (blend_mode == BlendModes.set_opacity) {
					if (Painter.lock_alpha && pxcolor.a == 0) return pxcolor;
					return {r: color.r, g: color.g, b: color.b, a}

				} else {
					if (blend_mode == BlendModes.difference) {
						let before = Painter.getAlphaMatrix(texture, px, py)
						Painter.setAlphaMatrix(texture, px, py, a);
						if (a > before) {
							a = (a - before) / (1 - before);
						} else if (before) {
							a = 0;
						}
					} else if (opacity < 1 || blend_mode != BlendModes.default) {
						let before = Painter.getAlphaMatrix(texture, px, py);
						let new_val = (before||0);
						if (a > before) {
							a = Math.clamp(a, 0, (opacity - before) / (1 - before));
						} else if (before) {
							a = 0;
						}
						new_val = new_val + (1-new_val) * a;
						if (new_val > before || before == undefined) Painter.setAlphaMatrix(texture, px, py, new_val);
					}
					let result_color;
					if (blend_mode == BlendModes.default) {
						result_color = Painter.combineColors(pxcolor, color, a);
					} else {
						result_color = Painter.blendColors(pxcolor, color, a, blend_mode);
					}
					if (Painter.lock_alpha) result_color.a = pxcolor.a
					return result_color;
				}
			}
		},
		allowed_view_modes: ['textured', 'material'],
		keybind: new Keybind({key: 'b'}),
		modes: ['paint'],
		side_menu: new Menu('brush_tool', () => {
			
			let list = [
				{name: 'menu.brush_presets.pixel_brush', icon: 'mode_edit', click() {
					BarItems.brush_tool.select();
					Painter.loadBrushPreset(Painter.default_brush_presets[0])
				}},
				{name: 'menu.brush_presets.pixel_perfect', icon: 'stylus_note', click() {
					BarItems.brush_tool.select();
					Painter.loadBrushPreset(Painter.default_brush_presets[1])
				}},
				{name: 'menu.brush_presets.smooth_brush', icon: 'fa-paint-brush', click() {
					BarItems.brush_tool.select();
					Painter.loadBrushPreset(Painter.default_brush_presets[2])
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
					let size = BarItems.slider_brush_size.get();
					copy_source = {
						data: Painter.getCanvas(texture).getContext('2d').getImageData(0, 0, texture.width, texture.height).data,
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
		allowed_view_modes: ['textured', 'material'],
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
		allowed_view_modes: ['textured', 'material'],
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
			get interval() {
				return 1 + BarItems.slider_brush_size.get() * BarItems.slider_brush_softness.get() / 1500;
			},
			changePixel(px, py, pxcolor, local_opacity, {opacity, ctx, x, y, size, softness, texture, event}) {
				if (Painter.lock_alpha) return pxcolor;

				var a = opacity * local_opacity;

				if (opacity < 1) {
					let before = Painter.getAlphaMatrix(texture, px, py);
					let new_val = (before||0);
					if (before) {
						a = Math.clamp(a, 0, (opacity - before) / (1 - before));
					}
					new_val = new_val + (1-new_val) * a;
					if (new_val > before || before == undefined) Painter.setAlphaMatrix(texture, px, py, new_val);
				}
				pxcolor.a = Math.clamp(pxcolor.a * (1-a), 0, 1);
				return pxcolor;
			}
		},
		allowed_view_modes: ['textured', 'material'],
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
		allowed_view_modes: ['textured', 'material'],
		modes: ['paint'],
		onCanvasClick(data) {
			Painter.startPaintToolCanvas(data, data.event)
		},
		onCanvasRightClick(data) {
			Painter.startPaintToolCanvas(data, data.event);
			if (data.element) return false;
		},
		onTextureEditorClick(texture, x, y, event) {
			if (texture) {
				Painter.startPaintTool(texture, x, y, undefined, event);
			}
			return false;
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
		allowed_view_modes: ['textured', 'material'],
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
		allowed_view_modes: ['textured', 'material'],
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
	/*new Tool('copy_paste_tool', {
		icon: 'fa-vector-square',
		category: 'tools',
		toolbar: 'brush',
		alt_tool: 'color_picker',
		cursor: 'crosshair',
		selectFace: true,
		transformerMode: 'hidden',
		paintTool: true,
		allowed_view_modes: ['textured', 'material'],
		modes: ['paint'],
		condition: {modes: ['paint']},
		keybind: new Keybind({key: 'm'}),
		onCanvasClick(data) {
			if (data && data.element) {
				Blockbench.showQuickMessage('message.copy_paste_tool_viewport')
			}
		},
		onUnselect() {
			if (Painter.selection.overlay && open_interface) {
				open_interface.confirm()
			}
		}
	})*/
	let selection_tools = {
		rectangle: {name: 'action.selection_tool.rectangle', icon: 'select'},
		ellipse: {name: 'action.selection_tool.ellipse', icon: 'lasso_select'},
		lasso: {name: 'action.selection_tool.lasso', icon: 'fa-draw-polygon'},
		wand: {name: 'action.selection_tool.wand', icon: 'fa-magic'},
		color: {name: 'action.selection_tool.color', icon: 'fa-eye-dropper'},
	};
	let selection_tool = new Tool('selection_tool', {
		icon: 'select',
		category: 'tools',
		toolbar: 'brush',
		cursor: 'crosshair',
		selectFace: true,
		transformerMode: 'hidden',
		paintTool: true,
		allowed_view_modes: ['textured', 'material'],
		modes: ['paint'],
		keybind: new Keybind({key: 'm'}, {
			create: '',
			add: 'shift',
			subtract: 'ctrl',
			intersect: '',
		}),
		side_menu: new Menu('selection_tool', () => {
			let entries = [];
			for (let id in selection_tools) {
				let entry = {
					id,
					name: selection_tools[id].name,
					icon: selection_tools[id].icon,
					keybind: BarItems.selection_tool.sub_keybinds[id]?.keybind || undefined,
					click() {
						selection_tool.setIcon(selection_tools[id].icon);
						selection_tool.mode = id;
						selection_tool.select();
						BARS.updateConditions();
						BarItems.slider_color_select_threshold.update();
					}
				}
				entries.push(entry);
			}
			return entries;
		}),
		variations: {
			create: {name: 'action.selection_tool_operation_mode.create'},
			add: {name: 'action.selection_tool_operation_mode.add'},
			subtract: {name: 'action.selection_tool_operation_mode.subtract'},
			intersect: {name: 'action.selection_tool_operation_mode.intersect'},
		},
		onCanvasClick(data) {
			if (data && data.element) {
				Blockbench.showQuickMessage('message.copy_paste_tool_viewport')
			}
		},
		onTextureEditorClick(texture, x, y, event) {
			if (texture) {
				UVEditor.vue.startTextureSelection(x, y, event);
			}
			return false;
		},
		onSelect() {
			UVEditor.vue.updateTexture();
			BarItems.slider_color_select_threshold.update();
		},
		onUnselect() {
			if (TextureLayer.selected?.in_limbo) {
				TextureLayer.selected.resolveLimbo();
			}
			UVEditor.vue.texture_selection_polygon.empty();
			Interface.removeSuggestedModifierKey('alt', 'modifier_actions.drag_to_duplicate');
		}
	})
	for (let id in selection_tools) {
		selection_tool.addSubKeybind(id, selection_tools[id].name, null, event => {
			selection_tool.setIcon(selection_tools[id].icon);
			selection_tool.mode = id;
			selection_tool.select();
			BARS.updateConditions();
			BarItems.slider_color_select_threshold.update();
		});
	}
	selection_tool.mode = 'rectangle';

	new Tool('move_layer_tool', {
		icon: 'drag_pan',
		category: 'tools',
		toolbar: 'brush',
		cursor: 'move',
		selectFace: true,
		transformerMode: 'hidden',
		paintTool: true,
		allowed_view_modes: ['textured', 'material'],
		modes: ['paint'],
		keybind: new Keybind({shift: true, key: 'v'}),
		onCanvasClick(data) {
			if (data && data.element) {
				Blockbench.showQuickMessage('message.copy_paste_tool_viewport')
			}
		},
		onTextureEditorClick(texture, x, y, event) {
			if (texture) {
				UVEditor.vue.startTextureSelection(x, y, event);
			}
			return false;
		},
		onSelect() {
			let texture = Texture.selected;
			if (texture && texture.selection.is_custom && texture.selection.hasSelection() && (!texture.selected_layer || !texture.selected_layer.in_limbo)) {
				Texture.selected.selectionToLayer(true);
			}
		}
	})

	new BarSelect('brush_shape', {
		category: 'paint',
		condition: () => Toolbox && Toolbox.selected.brush && Toolbox.selected.brush.shapes,
		onChange() {
			BARS.updateConditions();
			UVEditor.vue.brush_type = this.value;
			switch (this.value) {
				case 'square': Canvas.brush_outline.material.uniforms.SHAPE.value = 0; break;
				case 'circle': Canvas.brush_outline.material.uniforms.SHAPE.value = 1; break;
			}
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
			ellipse: {name: true, icon: 'fas.fa-circle'},
			ellipse_h: {name: true, icon: 'far.fa-circle'},
		}
	})
	new BarSelect('blend_mode', {
		category: 'paint',
		condition: () => (Toolbox && ((Toolbox.selected.brush?.blend_modes == true) || ['draw_shape_tool', 'fill_tool'].includes(Toolbox.selected.id))),
		options: {
			default: true,
			set_opacity: true,
			color: true,
			behind: true,
			multiply: true,
			//divide: true,
			add: true,
			//subtract: true,
			screen: true,
			overlay: true,
			difference: true,
		}
	})
	new BarSelect('fill_mode', {
		category: 'paint',
		condition: () => Toolbox && Toolbox.selected.id === 'fill_tool',
		options: {
			face: {name: true, condition: () => !Format.image_editor},
			selection: {name: true, condition: () => Format.image_editor},
			element: {name: true, condition: () => !Format.image_editor},
			selected_elements: {name: true, condition: () => !Format.image_editor},
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
	new BarSelect('selection_tool_operation_mode', {
		category: 'paint',
		condition: {tools: ['selection_tool']},
		icon_mode: true,
		options: {
			create: {name: true, icon: 'shadow'},
			add: {name: true, icon: 'shadow_add'},
			subtract: {name: true, icon: 'shadow_minus'},
			intersect: {name: true, icon: 'join_inner'},
		}
	})
	let last_mode = null;
	let last_changed_to = null;
	Blockbench.on('update_pressed_modifier_keys', ({before, now, event}) => {
		let tool = BarItems.selection_tool_operation_mode;
		let selection_tool = BarItems.selection_tool;
		if (!Condition(tool.condition)) return;
		if (UVEditor.vue.selection_rect.active) return;

		if (selection_tool.keybind.additionalModifierTriggered(event) == 'add') {
			if (!last_mode) last_mode = tool.value;
			tool.set('add');
			last_changed_to = 'add';

		} else if (selection_tool.keybind.additionalModifierTriggered(event) == 'subtract') {
			if (!last_mode) last_mode = tool.value;
			tool.set('subtract');
			last_changed_to = 'subtract';

		} else if (selection_tool.keybind.additionalModifierTriggered(event) == 'intersect') {
			if (!last_mode) last_mode = tool.value;
			tool.set('intersect');
			last_changed_to = 'intersect';

		} else if (last_changed_to == tool.value) {
			tool.set(last_mode);
			last_changed_to = last_mode;
			last_mode = null;
		}
	});

	let expand_texture_selection_dialog = new Dialog('expand_texture_selection', {
		title: 'action.expand_texture_selection',
		form: {
			value: {type: 'number', label: 'dialog.expand_texture_selection.radius', value: 1},
			corner: {
				type: 'select',
				label: 'dialog.expand_texture_selection.corner',
				options: {
					round: 'dialog.expand_texture_selection.corner.round',
					square: 'dialog.expand_texture_selection.corner.square',
					manhattan: 'dialog.expand_texture_selection.corner.manhattan',
				}
			}
		},
		onConfirm(result) {
			if (result.value == 0) return;
			let texture = UVEditor.texture;
			let selection = texture.selection;
			let radius = Math.abs(result.value);
			let radius_sq = result.value ** 2;
			const round = 'round';
			const manhattan = 'manhattan';

			if (selection.is_custom) {
				let selection_copy = selection.array.slice();
				let expected_value = result.value < 0 ? 0 : 1;
				selection.forEachPixel((x, y, val, index) => {
					if (val == expected_value) return;
					for (let offset_x = -radius; offset_x <= radius; offset_x++) {
						for (let offset_y = -radius; offset_y <= radius; offset_y++) {
							// Radius check
							if (result.corner == round) {
								if ((offset_x ** 2 + offset_y ** 2) > radius_sq) continue;
							} else if (result.corner == manhattan) {
								if ((Math.abs(offset_x) + Math.abs(offset_y)) > radius) continue;
							}
							// Testing
							if (selection.get(x + offset_x, y + offset_y) == expected_value) {
								selection_copy[index] = expected_value;
								return;
							}
						}
					}
				})
				selection.array = selection_copy;
			} else if (selection.override == true && result.value < 0) {
				selection.setOverride(null);
				selection.forEachPixel((x, y, val, index) => {
					let selected = x >= radius && y >= radius && x < selection.width - radius && y < selection.height - radius;
					selection.array[index] = selected ? 1 : 0;
				});
			}
			UVEditor.updateSelectionOutline();
		}
	});
	new Action('expand_texture_selection', {
		icon: 'settings_overscan',
		category: 'paint',
		click() {
			expand_texture_selection_dialog.show();
		}
	})

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
			for (let grid of grids.children) {
				grid.geometry.dispose();
			}
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
		tool_config: new ToolConfig('mirror_painting', {
			title: 'action.mirror_painting',
			width: 408,
			form: {
				enabled: {type: 'checkbox', label: 'menu.mirror_painting.enabled', value: Painter.mirror_painting},
				_1: '_',
				global: {type: 'checkbox', label: 'menu.mirror_painting.global', value: true, description: 'menu.mirror_painting.global.desc',},
				local: {type: 'checkbox', label: 'menu.mirror_painting.local', description: 'menu.mirror_painting.local.desc',},
				axis: {type: 'inline_multi_select', label: 'menu.mirror_painting.axis', options: {x: 'X', z: 'Z'}, value: {x: true, z: false}, description: 'menu.mirror_painting.axis.desc'},
				_2: '_',
				texture: {type: 'checkbox', label: 'menu.mirror_painting.texture', description: 'menu.mirror_painting.texture.desc'},
				texture_center: {type: 'vector', label: 'menu.mirror_painting.texture_center', dimensions: 2, condition: form => form.texture, toggle_enabled: true, toggle_default: false},
				_3: '_',
				texture_frames: {
					type: 'checkbox',
					label: 'menu.mirror_painting.texture_frames',
					description: 'menu.mirror_painting.texture_frames.desc',
					condition: () => Texture.all.find(tex => tex.frameCount > 1)
				},
			},
			onFormChange(result) {
				Painter.mirror_painting = result.enabled;
				BarItems.mirror_painting.set(result.enabled);
				if (!result.axis.x && !result.axis.z) {
					this.setFormValues({axis: {x: true, z: false}});
				}
				if (!result.global && !result.local) {
					this.setFormValues({global: true});
				}
			}
		})
	})
	Painter.mirror_painting_options = BarItems.mirror_painting.tool_config.options;
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
		icon: 'grid_3x3',
		category: 'view',
		condition: {modes: ['paint']},
		keybind: new Keybind({key: 'g'}),
		linked_setting: 'painting_grid'
	})
	new Toggle('image_tiled_view', { 
		category: 'paint',
		icon: 'grid_view',
		onChange(value) {
			if (value && BarItems.image_onion_skin_view.value) {
				BarItems.image_onion_skin_view.set(false);
			}
			UVEditor.vue.overlay_canvas_mode = value ? 'tiled' : null;
			UVEditor.vue.updateTexture();
			UVEditor.updateOverlayCanvas();
		},
		tool_config: new ToolConfig('image_onion_skin_view', {
			title: 'action.image_onion_skin_view',
			form: {
				mirrored: {
					label: 'menu.image_tiled_view.mirrored',
					type: 'checkbox',
					value: false
				}
			},
			onFormChange(result) {
				UVEditor.updateOverlayCanvas();
			}
		})
	})
	Painter.image_tiled_view_options = BarItems.image_tiled_view.tool_config.options;

	new Toggle('image_onion_skin_view', { 
		category: 'paint',
		icon: 'animation',
		condition: () => Panels.textures.vue.maxFrameCount(),
		onChange(value) {
			if (value && BarItems.image_tiled_view.value) {
				BarItems.image_tiled_view.set(false);
			}
			UVEditor.vue.overlay_canvas_mode = value ? 'onion_skin' : null;
			UVEditor.vue.updateTexture();
			UVEditor.updateOverlayCanvas();
		},
		tool_config: new ToolConfig('image_onion_skin_view', {
			title: 'action.image_onion_skin_view',
			form: {
				frame: {
					label: 'menu.image_onion_skin_view.frame',
					type: 'select',
					value: 'last_viewed',
					options: {
						last_viewed: 'menu.image_onion_skin_view.frame.last_viewed',
						previous: 'menu.image_onion_skin_view.frame.previous',
						next: 'menu.image_onion_skin_view.frame.next',
						both: 'menu.image_onion_skin_view.frame.both',
					}
				},
				display: {
					label: 'menu.image_onion_skin_view.display',
					type: 'select',
					value: 'pixels',
					options: {
						pixels: 'menu.image_onion_skin_view.display.pixels',
						transparent: 'menu.image_onion_skin_view.display.transparent',
					}
				},
				above: {
					label: 'menu.image_onion_skin_view.above',
					type: 'checkbox'
				},
			},
			onFormChange(result) {
				UVEditor.updateOverlayCanvas();
			}
		})
	})
	Painter.image_onion_skin_view_options = BarItems.image_onion_skin_view.tool_config.options;

	new NumSlider('slider_brush_size', {
		condition: () => (Toolbox && ((Toolbox.selected.brush?.size == true) || ['draw_shape_tool'].includes(Toolbox.selected.id))),
		tool_setting: 'brush_size',
		category: 'paint',
		settings: {
			min: 1, max: 1024, interval: 1, default: 1,
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
	new Toggle('pixel_perfect_drawing', {
		icon: 'stylus_laser_pointer',
		category: 'view',
		condition: () => Toolbox && Toolbox.selected.brush?.pixel_perfect == true,
	})
	new NumSlider('slider_color_select_threshold', {
		category: 'paint',
		condition: {tools: ['selection_tool'], method: () => ['color', 'wand'].includes(BarItems.selection_tool.mode)},
		tool_setting: 'color_select_threshold',
		value: 0,
		settings: {
			min: 0, max: 100, default: 0, value: 0,
			interval: 1,
			show_bar: true
		}
	})
})
