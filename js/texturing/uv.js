const UVEditor = {
	face: 'north',
	size: 320,
	zoom: 1,
	grid: 1,
	auto_grid: true,
	panel: null,
	sliders: {},
	selected_element_faces: {},
	previous_animation_frame: 1,
	overlay_canvas: (() => {
		let canvas = document.createElement('canvas');
		canvas.classList.add('overlay_canvas');
		return canvas;
	})(),

	get vue() {
		return this.panel.inside_vue;
	},
	message(msg, vars) {
		msg = tl(msg, vars)
		let box = document.createElement('div');
		box.className = 'uv_message_box'
		box.textContent = msg;
		this.vue.$refs.main.append(box)
		setTimeout(function() {
			box.remove()
		}, 1200)
	},
	//Brush
	getBrushCoordinates(event, tex) {
		convertTouchEvent(event);
		let pixel_size = this.inner_width / (tex ? tex.width : Project.texture_width);
		let result = {};
		let mouse_coords;
		if (event.target.id == 'uv_frame') {
			mouse_coords = [event.offsetX, event.offsetY];
		} else {
			let frame_pos = $('#uv_frame').offset();
			mouse_coords = [
				event.clientX - frame_pos.left,
				event.clientY - frame_pos.top
			];
		}

		if (Toolbox.selected.id === 'selection_tool') {
			if (BarItems.selection_tool.mode == 'lasso') {
				result.x = mouse_coords[0]/pixel_size;
				result.y = mouse_coords[1]/pixel_size;
			} else if (settings.nearest_rectangle_select.value) {
				result.x = Math.round(mouse_coords[0]/pixel_size*1);
				result.y = Math.round(mouse_coords[1]/pixel_size*1);
			} else {
				result.x = Math.floor(mouse_coords[0]/pixel_size*1);
				result.y = Math.floor(mouse_coords[1]/pixel_size*1);
			}
		} else if (Toolbox.selected.id === 'move_layer_tool') {
			result.x = Math.round(mouse_coords[0]/pixel_size*1);
			result.y = Math.round(mouse_coords[1]/pixel_size*1);
		} else {
			let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0.5 : 0;
			result.x = mouse_coords[0]/pixel_size*1 + offset;
			result.y = mouse_coords[1]/pixel_size*1 + offset;
			if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
				result.x = Math.floor(result.x);
				result.y = Math.floor(result.y);
			}
		}
		if (tex) {
			if (tex.frameCount) result.y += (tex.height / tex.frameCount) * tex.currentFrame;
			if (!tex.frameCount && tex.ratio != tex.getUVWidth() / tex.getUVHeight() && UVEditor.vue.mode != 'paint') result.y /= tex.ratio;
			if (BarItems.image_tiled_view.value == true) {
				if (Painter.image_tiled_view_options.mirrored) {
					if (result.x < 0 || result.x >= tex.width) result.x = tex.width - result.x - 1;
					if (result.y < 0 || result.y >= tex.display_height) result.y = tex.display_height - result.y - 1;
				}
				result.x = (tex.width + result.x) % tex.width;
				result.y = (tex.display_height + result.y) % tex.display_height;
			}
		}
		// Snap line tool
		if (UVEditor.vue.mouse_coords.line_preview && event.ctrlOrCmd && UVEditor.vue.last_brush_position) {
			let original_pos = UVEditor.vue.last_brush_position.slice();
			let offset = [result.x - original_pos[0], result.y - original_pos[1]];
			let length = Math.sqrt(Math.pow(offset[0], 2) + Math.pow(offset[1], 2));
			let angle = Math.radToDeg(Math.atan2(offset[1], offset[0]));
			// Snapping
			let x_2 = Math.radToDeg(Math.atan(1/2));
			let x_3 = Math.radToDeg(Math.atan(1/3));
			let x_6 = Math.radToDeg(Math.atan(1/6));
			let snap_values = [0, 45];
			if (length > 16) {
				snap_values = [0, x_6, x_3, x_2, 33.75, 45, 90-33.75, 90-x_2, 90-x_3, 90 - x_6];
			} else if (length > 10) {
				snap_values = [0, x_3, x_2, , 45, 90-x_2, 90-x_3];
			} else if (length > 4) {
				snap_values = [0, x_2, 45, 90-x_2];
			}
			let osv = snap_values.slice();
			for (let i of [1, -1, -2]) {
				snap_values.push(...osv.map(v => v + i*90));
			}
			angle = Math.snapToValues(angle, snap_values, 90);
			angle = Math.degToRad(angle);
			result.x = original_pos[0] + Math.cos(angle) * length;
			result.y = original_pos[1] + Math.sin(angle) * length;
			// Round
			let px_offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0.5 : 0;
			result.x = Math.round(result.x) + px_offset;
			result.y = Math.round(result.y) + px_offset;
			if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
				result.x = Math.floor(result.x);
				result.y = Math.floor(result.y);
			}
		}
		return result;
	},
	startPaintTool(event) {
		delete Painter.current.face_matrices;
		delete Painter.current.element;

		var texture = this.getTexture()
		var coords = this.getBrushCoordinates(event, texture);
		
		let tool_result;
		if (Toolbox.selected.onTextureEditorClick) {
			tool_result = Toolbox.selected.onTextureEditorClick(texture, coords.x, coords.y, event);
		}
		if (tool_result !== false && texture) {
			if (event.target.id == 'uv_viewport') {
				// Discard scrollbar clicks
				if (event.offsetX >= event.target.clientWidth) return;
				if (event.offsetY >= event.target.clientHeight) return;
			}
			Painter.startPaintTool(texture, coords.x, coords.y, undefined, event);
			addEventListeners(UVEditor.vue.$refs.viewport, 'mousemove touchmove', UVEditor.movePaintTool, false );
			addEventListeners(document, 'mouseup touchend', UVEditor.stopBrush, false );
		}
	},
	movePaintTool(event) {
		var texture = UVEditor.getTexture()
		if (!texture) {
			Blockbench.showQuickMessage('message.untextured')
		} else if (event.which === 1 || Keybinds.extra.paint_secondary_color.keybind.isTriggered(event) || (event.touches && event.touches.length == 1)) {
			var new_face;
			var {x, y} = UVEditor.getBrushCoordinates(event, texture);
			if (texture.img.naturalWidth + texture.img.naturalHeight == 0) return;

			let interval = Toolbox.selected.brush?.interval || 1;
			if (Math.sqrt(Math.pow(x - Painter.current.x, 2) + Math.pow(y - Painter.current.y, 2)) < interval) {
				return;
			}
			if (Painter.current.face !== UVEditor.getSelectedFaces(null)[0]) {
				Painter.current.x = x
				Painter.current.y = y
				Painter.current.face = UVEditor.getSelectedFaces(null)[0];
				new_face = true;
				if (texture !== Painter.current.texture && Undo.current_save) {
					Undo.current_save.addTextureOrLayer(texture)
				}
			}
			if (Toolbox.selected.id !== 'selection_tool') {
				Painter.movePaintTool(texture, x, y, event, new_face)
			}
		}
	},
	stopBrush(event) {
		removeEventListeners( UVEditor.vue.$refs.viewport, 'mousemove touchmove', UVEditor.movePaintTool, false );
		removeEventListeners( document, 'mouseup touchend', UVEditor.stopBrush, false );
		if (Toolbox.selected.id !== 'selection_tool') {
			Painter.stopPaintTool()
		} else {
			UVEditor.stopSelection()
		}
	},

	selection_outline_lines: [],
	async updateSelectionOutline(recalculate_lines = true) {
		if (!Modes.paint) return;
		let {texture} = this.vue;
		if (!texture) {
			this.vue.selection_outline = '';
			return;
		}
		if (texture.selection.override == false) {
			this.vue.selection_outline = '';
			return;
		}
		let size = UVEditor.getTexturePixelSize();
		let width = this.vue.texture.width;
		let height = this.vue.texture.display_height;
		let full_height = this.vue.texture.height;

		if (texture.selection.override == true) {
			this.vue.selection_outline = `M1 1 L${width * size + 1} 1 L${width * size + 1} ${height * size + 1} L1 ${height * size + 1} L1 1`;
			return;
		}

		let anim_offset = UVEditor.vue.texture?.currentFrame ? (UVEditor.vue.texture?.currentFrame * UVEditor.vue.texture.display_height) : 0;
		let lines = UVEditor.selection_outline_lines;

		if (recalculate_lines) {
			lines.empty();
			let matrix = texture.selection;

			// Bounds
			let bounds = [Infinity, Infinity, 0, 0];
			for (let y = 0; y < full_height; y++) {
				for (let x = 0; x < width; x++) {
					let val = matrix.getDirect(x, y);
					if (val == 1) {
						bounds[0] = Math.min(bounds[0], x);
						bounds[1] = Math.min(bounds[1], y);
						bounds[2] = Math.max(bounds[2], x+1);
						bounds[3] = Math.max(bounds[3], y+1);
					}
				}
			}
			await new Promise(r => setTimeout(r, 0));
			// =
			for (let y = bounds[1]; y <= bounds[3]; y++) {
				let pre = null;
				for (let x = bounds[0]; x <= bounds[2]; x++) {
					let a = matrix.get(x, y-1);
					let b = matrix.get(x, y);
					let line = a != b;
					if (pre !== line) {
						if (pre !== null || line) {
							lines.push([!!line, x, y]);
						}
						pre = line;
					}
				}
			}
			await new Promise(r => setTimeout(r, 0));
			// ||
			for (let x = bounds[0]; x <= bounds[2]; x++) {
				let pre = null;
				for (let y = bounds[1]; y <= bounds[3]; y++) {
					let a = matrix.get(x-1, y);
					let b = matrix.get(x, y);
					let line = a != b;
					if (pre !== line) {
						if (pre !== null || line) {
							lines.push([!!line, x, y]);
						}
						pre = line;
					}
				}
			}
			await new Promise(r => setTimeout(r, 0));
		}
		size = UVEditor.getTexturePixelSize();
		let outline = '';
		for (let line of lines) {
			outline += `${outline ? '' : ' '}${line[0] ? 'M' : 'L'}${line[1] * size + 1} ${(line[2]-anim_offset) * size + 1}`;
		}
		this.vue.selection_outline = outline;
	},
	async focusOnSelection(zoom) {
		if (zoom instanceof Event) {
			zoom = BarItems.focus_on_selection.keybind.additionalModifierTriggered(zoom, 'zoom');
		}
		let [min_x, min_y, max_x, max_y] = this.vue.getSelectedUVBoundingBox();
		if (zoom) {
			let width = (max_x-min_x) / UVEditor.getUVWidth();
			let height = (max_y-min_y) / UVEditor.getUVHeight();
			let target_zoom_factor = 1/Math.max(width, height);
			let target_zoom = Math.clamp(UVEditor.zoom, target_zoom_factor * 0.618, Math.max(1, target_zoom_factor * 0.84));
			UVEditor.setZoom(target_zoom);
			await new Promise(Vue.nextTick);
		}

		let pixel_size = UVEditor.inner_width / UVEditor.vue.uv_resolution[0];
		let focus = [min_x+max_x, min_y+max_y].map(v => v * 0.5 * pixel_size);
		let {viewport} = UVEditor.vue.$refs;
		let margin = UVEditor.vue.getFrameMargin();
		$(viewport).animate({
			scrollLeft: focus[0] + margin[0] - UVEditor.width / 2,
			scrollTop: focus[1] + margin[1] - UVEditor.height / 2,
		}, {
			duration: zoom ? 0 : 100,
			complete: () => {
				UVEditor.updateUVNavigator();
			}
		})
	},

	updateOverlayCanvas() {
		if (!UVEditor.texture) return;
		let canvas = UVEditor.overlay_canvas;
		let texture = UVEditor.texture;
		let ctx = canvas.getContext('2d');
		canvas.width = texture.width;

		if (BarItems.image_tiled_view.value == true) {
			canvas.setAttribute('overlay_mode', 'tiled');
			canvas.width = texture.width * 3;
			canvas.height = texture.display_height * 3;
			if (Painter.image_tiled_view_options.mirrored) {
				// X
				ctx.scale(-1, 1);
				ctx.drawImage(texture.canvas, -1 * texture.width, 1 * texture.display_height);
				ctx.drawImage(texture.canvas, -3 * texture.width, 1 * texture.display_height);
				// Y
				ctx.scale(-1, -1);
				ctx.drawImage(texture.canvas, 1 * texture.width, -1 * texture.display_height);
				ctx.drawImage(texture.canvas, 1 * texture.width, -3 * texture.display_height);
				// XY
				ctx.scale(-1, 1);
				ctx.drawImage(texture.canvas, -1 * texture.width, -1 * texture.display_height);
				ctx.drawImage(texture.canvas, -1 * texture.width, -3 * texture.display_height);
				ctx.drawImage(texture.canvas, -3 * texture.width, -1 * texture.display_height);
				ctx.drawImage(texture.canvas, -3 * texture.width, -3 * texture.display_height);
				ctx.scale(-1, -1);
				
			} else {
				for (let x = 0; x < 3; x++) {
					for (let y = 0; y < 3; y++) {
						ctx.drawImage(texture.canvas, x * texture.width, y * texture.display_height);
					}
				}
			}
		} else if (BarItems.image_onion_skin_view.value == true && texture.frameCount > 2) {
			canvas.setAttribute('overlay_mode', 'onion_skin');
			let frames = [];
			switch (Painter.image_onion_skin_view_options.frame) {
				case 'last_viewed': frames = [UVEditor.previous_animation_frame]; break;
				case 'previous': frames = [texture.currentFrame-1]; break;
				case 'next': frames = [texture.currentFrame+1]; break;
				case 'both': frames = [texture.currentFrame-1, texture.currentFrame+1]; break;
			}
			frames = frames.map(f => (f+texture.frameCount) % texture.frameCount).filter(f => f != texture.currentFrame);

			if (Painter.image_onion_skin_view_options.display == 'transparent') {
				canvas.width = texture.width;
				canvas.height = texture.display_height;
				ctx.filter = `opacity(${45}%)`;
				for (let frame_offset of frames) {
					ctx.drawImage(texture.canvas, 0, frame_offset * -texture.display_height);
				}
			} else {
				canvas.width = texture.width * 4;
				canvas.height = texture.display_height * 4;
				ctx.filter = "";
				for (let frame_offset of frames) {
					let image_data = texture.canvas.getContext('2d').getImageData(0, frame_offset * texture.display_height, texture.width, texture.display_height);
					for (let i = 0; i < image_data.data.length; i += 4) {
						if (image_data.data[i+3] < 2) continue;
						ctx.fillStyle = `rgba(${image_data.data[i]}, ${image_data.data[i+1]}, ${image_data.data[i+2]}, ${image_data.data[i+3] / 460})`;
						let x = (i / 4) % texture.width;
						let y = Math.floor((i / 4) / texture.width);
						ctx.fillRect(x * 4 + 1, y * 4 + 1, 2, 2);
					}
				}
			}
		}
		let is_above = BarItems.image_onion_skin_view.value && Painter.image_onion_skin_view_options.above;
		canvas.classList.toggle('above', !!is_above);
	},
	//Get
	get width() {
		return this.vue.width;
	},
	get height() {
		return this.vue.height;
	},
	get zoom() {
		return this.vue.zoom;
	},
	get inner_width() {
		return this.vue.inner_width;
	},
	get inner_height() {
		return this.vue.inner_height;
	},
	get selected_faces() {
		return this.getSelectedFaces(this.getFirstMappableElement());
	},
	get texture() {
		return this.vue.texture;
	},
	getUVWidth() {
		return this.texture ? this.texture.getUVWidth() : Project.texture_width;
	},
	getUVHeight() {
		return this.texture ? this.texture.getUVHeight() : Project.texture_height;
	},
	getPixelSize() {
		if (UVEditor.isBoxUV()) {
			return this.inner_width/UVEditor.getUVWidth()
		} else {
			return this.inner_width/ (
				(typeof this.texture === 'object' && this.texture.width)
					? this.texture.width
					: UVEditor.getUVWidth()
			);
		}
	},
	getTexturePixelSize() {
		return this.inner_width/ (
			(typeof this.texture === 'object' && this.texture.width)
				? this.texture.width
				: UVEditor.getUVWidth()
		);
	},
	getFaces(element, event, action) {
		let available = Object.keys(element.faces)
		if (event && (action ? action.keybind.additionalModifierTriggered(event, 'all_faces') : event.shiftKey)) {
			return available;
		} else {
			return UVEditor.getSelectedFaces(element).filter(key => available.includes(key));
		}
	},
	getReferenceFace() {
		let el = this.getFirstMappableElement();
		if (el) {
			let fkey = UVEditor.getSelectedFaces(el).find(fkey => el.faces[fkey]);
			return el.faces[fkey];
		}
	},
	getMappableElements() {
		return Outliner.selected.filter(el => typeof el.faces == 'object');
	},
	getFirstMappableElement() {
		return Outliner.selected.find(el => typeof el.faces == 'object');
	},
	getSelectedFaces(element, create) {
		if (!element) return [];
		if (element.getSelectedFaces) {
			return element.getSelectedFaces(create);
		} else {
			if (!UVEditor.selected_element_faces[element.uuid]) {
				if (create) {
					let faces = UVEditor.selected_element_faces[element.uuid] = [];
					return faces;
				} else {
					return [];
				}
			} else {
				return UVEditor.selected_element_faces[element.uuid];
			}
		}
	},
	hasElements() {
		return Outliner.selected.findIndex(el => typeof el.faces == 'object') != -1;
	},
	getTexture() {
		if (Format.single_texture) return Texture.getDefault();
		return this.vue.texture;
	},
	isFaceUV() {
		let selected_cubes = Cube.selected;
		return !selected_cubes.length || !selected_cubes.find(cube => cube.box_uv);
	},
	isBoxUV() {
		let selected_cubes = Cube.selected;
		return selected_cubes.length ? !selected_cubes.find(cube => !cube.box_uv) : Project.box_uv;
	},
	isSelectedFaceMirrored(axis) {
		let reference_face = UVEditor.getReferenceFace();
		if (reference_face instanceof CubeFace) {
			reference_face.uv[axis+0] > reference_face.uv[axis+2]
		} else {
			let vertices = reference_face.getSortedVertices();
			if (vertices.length <= 2) return false;
			if (!Math.epsilon(reference_face.uv[vertices[0]][axis], reference_face.uv[vertices[1]][axis], 0.01)) {
				return reference_face.uv[vertices[0]][axis] > reference_face.uv[vertices[1]][axis];
			} else {
				return reference_face.uv[vertices[0]][axis] > reference_face.uv[vertices[2]][axis];
			}
		}
	},
	updateFaceSelection() {
		updateSelection();
	},
	//Set
	setZoom(zoom) {
		let max_zoom = Math.round((this.vue.texture ? this.vue.texture.height : Project.texture_width) * 32 / UVEditor.width);
		zoom = Math.clamp(zoom, UVEditor.height > 800 ? 0.2 : 0.5, Math.clamp(max_zoom, 16, 64))
		this.vue.zoom = zoom;
		Project.uv_viewport.zoom = this.zoom;
		Vue.nextTick(() => {
			UVEditor.updateSelectionOutline(false);
		})
		return this;
	},
	setGrid(value) {
		if (value == 'auto') {
			this.auto_grid = true;
			this.vue.updateTexture()
		} else {
			value = parseInt(value);
			if (typeof value !== 'number') value = 1;
			this.grid = Math.clamp(value, 1, 1024);
			this.auto_grid = false;
		}
		this.updateSize();
		return this;
	},
	updateSize() {
		this.vue.updateSize();
	},
	//Selection
	reverseSelect(event) {
		var scope = this;
		if (!this.vue.texture && !Format.single_texture) return this;
		if (!event.target.classList.contains('uv_size_handle') && !event.target.id === 'uv_frame') {
			return this;
		}
		var matches = [];
		var face_matches = [];
		var u = event.offsetX / this.vue.inner_width * this.getResolution(0);
		var v = event.offsetY / this.vue.inner_height * this.getResolution(1);
		Cube.all.forEach(cube => {
			if (cube.locked) return;
			for (var face in cube.faces) {
				var uv = cube.faces[face].uv
				if (uv && Math.isBetween(u, uv[0], uv[2]) && Math.isBetween(v, uv[1], uv[3]) && (cube.faces[face].getTexture() === scope.vue.texture || Format.single_texture)) {
					matches.safePush(cube);
					face_matches.push([cube, face]);
					break;
				}
			}
		})
		Mesh.all.forEach(mesh => {
			if (mesh.locked) return;
			for (var fkey in mesh.faces) {
				let face = mesh.faces[fkey];
				let rect = face.getBoundingRect();
				if (face.uv && Math.isBetween(u, rect.ax, rect.bx) && Math.isBetween(v, rect.ay, rect.by) && (face.getTexture() === scope.vue.texture || Format.single_texture)) {
					matches.safePush(mesh);
					face_matches.push([mesh, fkey]);
					break;
				}
			}
		})
		if (matches.length) {
			if (!event.shiftKey && !Pressing.overrides.shift && !event.ctrlOrCmd && !Pressing.overrides.ctrl) {
				for (let el of Project.selected_elements) {
					let selected = UVEditor.getSelectedFaces(el, true);
					if (selected.length) selected.empty();
				}
				Project.selected_elements.empty();
			}
			if (UVEditor.isFaceUV()) {
				for (let [el, fkey] of face_matches) {
					let selected = UVEditor.getSelectedFaces(el, true);
					selected.push(fkey);
				}
			}
			matches.forEach(s => {
				Project.selected_elements.safePush(s)
			});
			if (!event.shiftKey && Mesh.selected[0]) {
				UVEditor.selectMeshUVIsland(UVEditor.getSelectedFaces(Mesh.selected[0])[0]);
			}
			updateSelection();
		}
		return matches;
	},
	forCubes(cb) {
		var i = 0;
		while (i < Cube.selected.length) {
			cb(Cube.selected[i]);
			i++;
		}
	},
	forElements(cb) {
		this.getMappableElements().forEach(cb);
	},
	//Load
	loadData() {
		if (this.panel.folded) return this;
		this.vue.updateTexture();
		this.displayTools();
		this.displayTools();
		this.vue.box_uv = UVEditor.isBoxUV();
		this.vue.uv_resolution.splice(0, 2,
			UVEditor.getUVWidth(),
			UVEditor.getUVHeight()
		);
		this.updateUVNavigator();
		this.vue.$forceUpdate();
		return this;
	},
	applyTexture(texture) {
		let elements = this.getMappableElements();

		if (Format.per_group_texture) {
			elements = [];
			let groups = Group.multi_selected;
			Outliner.selected.forEach(el => {
				if (el.faces && el.parent instanceof Group) groups.safePush(el.parent);
			});
			Undo.initEdit({outliner: true});
			groups.forEach(group => {
				group.texture = texture.uuid;
				group.forEachChild(child => {
					if (child.faces) elements.safePush(child);
				})
			})
		} else {
			Undo.initEdit({elements, uv_only: true})
			elements.forEach(el => {
				let faces = (el.box_uv || Format.per_group_texture) ? UVEditor.cube_faces : UVEditor.getSelectedFaces(el);
				faces.forEach(face => {
					if (el.faces[face]) {
						el.faces[face].texture = texture.uuid;
					}
				})
			})
		}

		this.loadData()
		Canvas.updateView({elements, element_aspects: {faces: true, uv: true}})
		Undo.finishEdit('Apply texture')
	},
	displayTools() {
		for (let id in UVEditor.sliders) {
			let slider = UVEditor.sliders[id];
			slider.node.style.setProperty('display', Condition(slider.condition)?'block':'none');
			slider.update();
		}
		if (!this.hasElements()) return;
		let face = UVEditor.getReferenceFace();
		if (face instanceof CubeFace) {
			BarItems.uv_rotation.set((face && face.rotation)||0);
			if (Format.cullfaces) {
				BarItems.cullface.set(face.cullface||'off')
			}
			if (Format.java_face_properties) {
				BarItems.face_tint.setIcon(face.tint !== -1 ? 'check_box' : 'check_box_outline_blank')
				BarItems.slider_face_tint.update()
			}
		}
	},
	slidePos(modify, axis) {
		var scope = this
		var limit = scope.getResolution(axis);

		Cube.selected.forEach(function(obj) {
			if (obj.box_uv === false) {
				UVEditor.getSelectedFaces(obj).forEach(fkey => {
					if (!obj.faces[fkey]) return;
					let uvTag = obj.faces[fkey].uv;
					var size = uvTag[axis + 2] - uvTag[axis]
	
					var value = modify(uvTag[axis])
	
					value = limitNumber(value, 0, limit)
					value = limitNumber(value + size, 0, limit) - size
	
					uvTag[axis] = value
					uvTag[axis+2] = value + size
				})
			} else {
				let minimum = 0;
				if (axis === 0) {
					var size = (obj.size(0) + (obj.size(1) ? obj.size(2) : 0))*2
					if (obj.size(1) == 0) minimum = -obj.size(2);
				} else {
					var size = obj.size(2) + obj.size(1)
					if (obj.size(0) == 0) minimum = -obj.size(2);
				}
				var value = modify(obj.uv_offset[axis])

				value = limitNumber(value, minimum, limit)
				value = limitNumber(value + size, minimum, limit) - size
				obj.uv_offset[axis] = Math.round(value);
			}
			obj.preview_controller.updateUV(obj);
		})
		Mesh.selected.forEach(mesh => {
			let selected_vertices = mesh.getSelectedVertices();
			
			if (selected_vertices.length) {
				UVEditor.getSelectedFaces(mesh).forEach(fkey => {
					if (!mesh.faces[fkey]) return
					selected_vertices.forEach(vkey => {
						if (!mesh.faces[fkey].vertices.includes(vkey)) return;
						mesh.faces[fkey].uv[vkey][axis] = modify(mesh.faces[fkey].uv[vkey][axis]);
					})
				})
			} else {
				UVEditor.getSelectedFaces(mesh).forEach(fkey => {
					if (!mesh.faces[fkey]) return
					let face = mesh.faces[fkey];
					let face_rect = face.getBoundingRect();
					let face_start = [face_rect.ax, face_rect.ay];
					let offset = modify(face_start[axis]) - face_start[axis];
					face.vertices.forEach(vkey => {
						face.uv[vkey][axis] += offset;
					})
				})
			}
			mesh.preview_controller.updateUV(mesh);
		})
		this.displayTools()
		this.vue.$forceUpdate()
	},
	slideSize(modify, axis) {
		var scope = this
		var limit = scope.getResolution(axis);

		Cube.selected.forEach(function(cube) {
			if (cube.box_uv === false) {
				UVEditor.getSelectedFaces(cube).forEach(fkey => {
					var uvTag = cube.faces[fkey].uv;
					var difference = modify(uvTag[axis+2]-uvTag[axis]) + uvTag[axis];
					uvTag[axis+2] = limitNumber(difference, 0, limit);
					Canvas.updateUV(cube);
				})
			}
		})
		Mesh.selected.forEach(mesh => {
			for (let fkey of mesh.getSelectedFaces()) {
				let face = mesh.faces[fkey];
				let rect = face.getBoundingRect();
				let start = (axis ? rect.ay : rect.ax);
				let size = (axis ? rect.y : rect.x);
				let multiplier = modify(size) / size;
				face.vertices.forEach(vkey => {
					if (!face.uv[vkey]) return;
					face.uv[vkey][axis] = (face.uv[vkey][axis] - start) * multiplier + start;
					if (isNaN(face.uv[vkey][axis])) face.uv[vkey][axis] = start;
				})
			}
			Mesh.preview_controller.updateUV(mesh);
		})
		this.displayTools()
		this.disableAutoUV()
		this.vue.$forceUpdate()
	},
	getResolution(axis, texture) {
		return axis ? UVEditor.getUVHeight() : UVEditor.getUVWidth();
	},
	saveViewportOffset() {
		let uv_viewport = this.vue.$refs.viewport;
		if (!uv_viewport || !Project || Blockbench.hasFlag('switching_project') || !uv_viewport.clientWidth || !uv_viewport.scrollLeft) return;
		Project.uv_viewport.offset[0] = (uv_viewport.scrollLeft - this.width/2) / this.vue.inner_width;
		Project.uv_viewport.offset[1] = (uv_viewport.scrollTop - this.height/2) / this.vue.inner_height;
	},
	loadViewportOffset() {
		let uv_viewport = this.vue.$refs.viewport;
		if (!uv_viewport || !Project) return;
		UVEditor.setZoom(Project.uv_viewport.zoom);
		let project = Project;
		Vue.nextTick(() => {
			if (!Project || project != Project) return;
			uv_viewport.scrollLeft = Project.uv_viewport.offset[0] * this.vue.inner_width + this.width/2;
			uv_viewport.scrollTop = Project.uv_viewport.offset[1] * this.vue.inner_height + this.height/2;
		})
	},
	beforeMoving() {
		UVEditor.saveViewportOffset();
		setTimeout(() => {
			UVEditor.loadViewportOffset();
		}, 0);
	},
	updateUVNavigator() {
		if (UVEditor.vue.mode != 'uv') return;
		let style = UVEditor.getUVNavigatorStyle();
		let element = UVEditor.vue.$el.querySelector('.uv_navigator');
		if (!element) return;
		if (style) {
			for (let key in style) {
				element.style.setProperty(key, style[key]);
			}
			element.style.display = 'block';
		} else {
			element.style.display = 'none';
		}
	},
	getUVNavigatorStyle() {
		let vue = UVEditor.vue;
		let mappable_element = vue.mappable_elements.find(el => (el.box_uv || (UVEditor.getSelectedFaces(el)?.length)));
		if (!mappable_element) return;
		let box = vue.getSelectedUVBoundingBox();
		if (!box) return;

		let uv_viewport = vue.$refs.viewport;
		if (!uv_viewport || !Project || Blockbench.hasFlag('switching_project') || !uv_viewport.clientWidth) return;
		let offset = [
			(uv_viewport.scrollLeft - vue.width/2) / vue.inner_width,
			(uv_viewport.scrollTop - vue.height/2) / vue.inner_height
		];
		let {zoom, uv_resolution} = vue;
		let view_box = [
			offset[0] * uv_resolution[0],
			offset[1] * uv_resolution[1],
			(offset[0] + vue.width/vue.inner_width) * uv_resolution[0],
			(offset[1] + vue.width/vue.inner_width) * uv_resolution[1],
		];

		let [x1_1, y1_1, x2_1, y2_1] = box;
		let [x1_2, y1_2, x2_2, y2_2] = view_box;
		let out_of_view = (x2_1 < x1_2 || x1_1 > x2_2 || y2_1 < y1_2 || y1_1 > y2_2);
		if (!out_of_view) return;

		let direction = Math.atan2(
			Math.lerp(y1_2, y2_2, 0.5) - Math.lerp(y1_1, y2_1, 0.5),
			Math.lerp(x1_2, x2_2, 0.5) - Math.lerp(x1_1, x2_1, 0.5),
		);
		let direction_degrees = Math.radToDeg(direction);
		let screen_offset = uv_viewport.getBoundingClientRect();
		let style = {
			'--rotation': (direction_degrees-90) + 'deg',
			left: (screen_offset.x) + 'px',
			top: (screen_offset.y) + 'px',
		};
		let rotation_range = Math.round(2 * direction / Math.PI);
		let rotation_modulo = ((direction_degrees + 540 + 45) % 90) / 90;
		rotation_modulo = Math.hermiteBlend(rotation_modulo);
		switch (rotation_range) {
			case 2: case -2: {
				style.left = (screen_offset.x + vue.width - 25) + 'px';
				style.top = (screen_offset.y + rotation_modulo*(vue.height - 25)) + 'px';
				break;
			}
			case -1: {
				style.left = (screen_offset.x + (1-rotation_modulo)*(vue.width - 25)) + 'px';
				style.top = (screen_offset.y + vue.height - 25) + 'px';
				break;
			}
			case 0: {
				style.left = (screen_offset.x) + 'px';
				style.top = (screen_offset.y + (1-rotation_modulo)*(vue.height - 25)) + 'px';
				break;
			}
			case 1: {
				style.left = (screen_offset.x + rotation_modulo*(vue.width - 25)) + 'px';
				style.top = (screen_offset.y) + 'px';
				break;
			}
		}
		return style;
	},

	//Events
	selectAll() {
		let selected_before = 0;
		let total_selectable = 0;
		this.vue.mappable_elements.forEach(element => {
			let selected_faces = UVEditor.getSelectedFaces(element, true);
			selected_before += selected_faces.length;
			for (let key in element.faces) {
				selected_faces.safePush(key);
				total_selectable++;
			}
		})
		if (selected_before == total_selectable) {
			this.vue.mappable_elements.forEach(element => {
				let selected_faces = UVEditor.getSelectedFaces(element, true);
				selected_faces.empty();
			})
		}
		UVEditor.displayTools();
	},
	selectMeshUVIsland(face_key) {
		let mesh = Mesh.selected[0];
		let selected_faces = mesh.getSelectedFaces(true);
		if (face_key && mesh && mesh.faces[face_key]) {
			if (selected_faces.length == 1) {
				function crawl(face) {
					for (let i = 0; i < face.vertices.length; i++) {
						let adjacent = face.getAdjacentFace(i);
						if (!adjacent) continue;
						if (selected_faces.includes(adjacent.key)) continue;
						let epsilon = 0.2;
						let uv_a1 = adjacent.face.uv[adjacent.edge[0]];
						let uv_a2 = face.uv[adjacent.edge[0]];
						if (!Math.epsilon(uv_a1[0], uv_a2[0], epsilon) || !Math.epsilon(uv_a1[1], uv_a2[1], epsilon)) continue;
						let uv_b1 = adjacent.face.uv[adjacent.edge[1]];
						let uv_b2 = face.uv[adjacent.edge[1]];
						if (!Math.epsilon(uv_b1[0], uv_b2[0], epsilon) || !Math.epsilon(uv_b1[1], uv_b2[1], epsilon)) continue;
						selected_faces.push(adjacent.key);
						if (BarItems.selection_mode.value == 'face') {
							let selected_faces = mesh.getSelectedFaces(true);
							selected_faces.safePush(adjacent.key);
						}
						crawl(adjacent.face);
					}
				}
				crawl(mesh.faces[face_key]);
			} else {
				selected_faces.replace([face_key]);
			}
		}
	},
	moveSelection(offset, event) {
		Undo.initEdit({elements: UVEditor.getMappableElements()})
		let step = canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl) / UVEditor.grid;
		if (UVEditor.isBoxUV()) step = 1;
		UVEditor.slidePos((old_val) => {
			let sign = offset[offset[0] ? 0 : 1];
			return old_val + step * sign;
		}, offset[0] ? 0 : 1);
		Undo.finishEdit('Move UV')
	},
	disableAutoUV() {
		this.forCubes(obj => {
			obj.autouv = 0
		})
	},
	toggleUV() {
		let face = UVEditor.getReferenceFace();
		let state = face.enabled === false;
		this.forCubes(cube => {
			UVEditor.getSelectedFaces(cube).forEach(face => {
				cube.faces[face].enabled = state;
			})
		})
	},
	maximize(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(obj, event, BarItems.uv_maximize).forEach(function(side) {
				obj.faces[side].uv = [0, 0, scope.getResolution(0, obj.faces[side]), scope.getResolution(1, obj.faces[side])]
			})
			obj.autouv = 0;
			Canvas.updateUV(obj)
		})
		this.message('uv_editor.maximized')
		this.loadData()
	},
	turnMapping(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(obj, event, BarItems.uv_turn_mapping).forEach(function(side) {
				var uv = obj.faces[side].uv_size;
				obj.faces[side].uv_size = [uv[1], uv[0]];
				if (uv[0] < 0) {
					obj.faces[side].uv[0] += uv[0];
					obj.faces[side].uv[2] += uv[0];
					obj.faces[side].uv[1] -= uv[0];
					obj.faces[side].uv[3] -= uv[0];
				}
				if (uv[1] < 0) {
					obj.faces[side].uv[1] += uv[1];
					obj.faces[side].uv[3] += uv[1];
					obj.faces[side].uv[0] -= uv[1];
					obj.faces[side].uv[2] -= uv[1];
				}
				let overlap_px = Math.clamp(Math.max(obj.faces[side].uv[0], obj.faces[side].uv[2]) - UVEditor.getUVWidth(), 0, Infinity);
				obj.faces[side].uv[0] -= overlap_px;
				obj.faces[side].uv[2] -= overlap_px;
				let overlap_py = Math.clamp(Math.max(obj.faces[side].uv[1], obj.faces[side].uv[3]) - UVEditor.getUVHeight(), 0, Infinity);
				obj.faces[side].uv[1] -= overlap_py;
				obj.faces[side].uv[3] -= overlap_py;
			})
			obj.autouv = 0;
			Canvas.updateUV(obj);
		})
		this.message('uv_editor.turned');
		this.loadData();
	},
	setAutoSize(event, silent, face_keys) {		
		let vec1 = new THREE.Vector3(),
			vec2 = new THREE.Vector3(),
			vec3 = new THREE.Vector3(),
			vec4 = new THREE.Vector3(),
			plane = new THREE.Plane();

		this.getMappableElements().forEach(obj => {
			let height, width;
			let faces = face_keys || this.getFaces(obj, event, BarItems.uv_auto);
			if (obj instanceof Cube) {
				faces.forEach(function(side) {
					let face = obj.faces[side];
					let mirror_x = face.uv[0] > face.uv[2];
					let mirror_y = face.uv[1] > face.uv[3];
					face.uv[0] = Math.min(face.uv[0], face.uv[2]);
					face.uv[1] = Math.min(face.uv[1], face.uv[3]);
					if (side == 'north' || side == 'south') {
						width = Math.abs(obj.size(0));
						height = Math.abs(obj.size(1));
					} else if (side == 'east' || side == 'west') {
						width = Math.abs(obj.size(2));
						height = Math.abs(obj.size(1));
					} else if (side == 'up' || side == 'down') {
						width = Math.abs(obj.size(0));
						height = Math.abs(obj.size(2));
					}
					if (face.rotation % 180) {
						[width, height] = [height, width];
					}
					width *= UVEditor.getResolution(0, face) / UVEditor.getUVWidth();
					height *= UVEditor.getResolution(1, face) / UVEditor.getUVHeight();
					width = Math.clamp(width, 0, UVEditor.getUVWidth());
					height = Math.clamp(height, 0, UVEditor.getUVHeight());
					face.uv[0] = Math.min(face.uv[0], UVEditor.getUVWidth() - width);
					face.uv[1] = Math.min(face.uv[1], UVEditor.getUVHeight() - height);
					face.uv_size = [width, height];
					// left2 *= UVEditor.getResolution(0, face) / UVEditor.getUVWidth();
					// top2 *= UVEditor.getResolution(1, face) / UVEditor.getUVHeight();
					// face.uv_size = [left2, top2];
					if (mirror_x) [face.uv[0], face.uv[2]] = [face.uv[2], face.uv[0]];
					if (mirror_y) [face.uv[1], face.uv[3]] = [face.uv[3], face.uv[1]];
				})
				obj.autouv = 0

			} else if (obj instanceof Mesh) {
				faces.forEach(fkey => {
					let face = obj.faces[fkey];
					let vertex_uvs = {};
					let uv_center = [0, 0];
					let new_uv_center = [0, 0];
					let normal_vec = vec1.fromArray(face.getNormal(true));
					plane.setFromNormalAndCoplanarPoint(
						normal_vec,
						vec2.fromArray(obj.vertices[face.vertices[0]])
					)
					let rot = cameraTargetToRotation([0, 0, 0], normal_vec.toArray());
					let e = new THREE.Euler(Math.degToRad(rot[1] - 90), Math.degToRad(rot[0] + 180), 0);
					face.vertices.forEach(vkey => {
						let coplanar_pos = plane.projectPoint(vec3.fromArray(obj.vertices[vkey]), vec4.set(0, 0, 0));
						coplanar_pos.applyEuler(e);
						vertex_uvs[vkey] = [
							Math.roundTo(coplanar_pos.x, 4),
							Math.roundTo(coplanar_pos.z, 4),
						]
					})
					// Rotate UV to match corners
					let rotation_angles = {};
					let precise_rotation_angle = {};
					let vertices = face.getSortedVertices();
					vertices.forEach((vkey, i) => {
						let vkey2 = vertices[i+1] || vertices[0];
						let rot = Math.atan2(
							vertex_uvs[vkey2][0] - vertex_uvs[vkey][0],
							vertex_uvs[vkey2][1] - vertex_uvs[vkey][1],
						)
						let snap = 2;
						rot = (Math.radToDeg(rot) + 360) % 90;
						let rounded = Math.round(rot / snap) * snap;
						if (rotation_angles[rounded]) {
							rotation_angles[rounded]++;
						} else {
							rotation_angles[rounded] = 1;
							precise_rotation_angle[rounded] = rot;
						}
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

					// Find position on UV map
					let pmin_x = Infinity, pmin_y = Infinity;
					face.vertices.forEach(vkey => {
						pmin_x = Math.min(pmin_x, vertex_uvs[vkey][0]);
						pmin_y = Math.min(pmin_y, vertex_uvs[vkey][1]);
					})
					face.vertices.forEach(vkey => {
						uv_center[0] += face.uv[vkey] ? face.uv[vkey][0] : 0;
						uv_center[1] += face.uv[vkey] ? face.uv[vkey][1] : 0;
						new_uv_center[0] += vertex_uvs[vkey][0];
						new_uv_center[1] += vertex_uvs[vkey][1];
					})
					uv_center[0] = Math.round((uv_center[0] - new_uv_center[0]) / face.vertices.length);
					uv_center[1] = Math.round((uv_center[1] - new_uv_center[1]) / face.vertices.length);

					let min_x = Infinity, min_y = Infinity, max_x = 0, max_y = 0;
					for (let vkey in vertex_uvs) {
						vertex_uvs[vkey][0] = vertex_uvs[vkey][0] - ((pmin_x+1000.5) % 1 - 0.5) + uv_center[0],
						vertex_uvs[vkey][1] = vertex_uvs[vkey][1] - ((pmin_y+1000.5) % 1 - 0.5) + uv_center[1],
						min_x = Math.min(min_x, vertex_uvs[vkey][0]);
						min_y = Math.min(min_y, vertex_uvs[vkey][1]);
						max_x = Math.max(max_x, vertex_uvs[vkey][0]);
						max_y = Math.max(max_y, vertex_uvs[vkey][1]);
					}
					// Prevent overflow
					let offset = [
						min_x < 0 ? -min_x : (max_x > UVEditor.getUVWidth() ? Math.round(UVEditor.getUVWidth() - max_x) : 0),
						min_y < 0 ? -min_y : (max_y > UVEditor.getUVHeight() ? Math.round(UVEditor.getUVHeight() - max_y) : 0),
					];
					face.vertices.forEach(vkey => {
						face.uv[vkey] = [
							vertex_uvs[vkey][0] + offset[0],
							vertex_uvs[vkey][1] + offset[1],
						]
					})
				})
			}
			obj.preview_controller.updateUV(obj);
		})
		if (!silent) this.message('uv_editor.autouv');
		this.loadData();
	},
	setRelativeAutoSize(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(obj, event, BarItems.uv_rel_auto).forEach(function(side) {
				var uv = obj.faces[side].uv,
					ru = scope.getResolution(0, obj.faces[side]),
					rv = scope.getResolution(1, obj.faces[side]);
				switch (side) {
					case 'north':
					uv = [
						ru - obj.to[0],
						rv - obj.to[1],
						ru - obj.from[0],
						rv - obj.from[1],
					];
					break;
					case 'south':
					uv = [
						obj.from[0],
						rv - obj.to[1],
						obj.to[0],
						rv - obj.from[1],
					];
					break;
					case 'west':
					uv = [
						obj.from[2],
						rv - obj.to[1],
						obj.to[2],
						rv - obj.from[1],
					];
					break;
					case 'east':
					uv = [
						ru - obj.to[2],
						rv - obj.to[1],
						ru - obj.from[2],
						rv - obj.from[1],
					];
					break;
					case 'up':
					uv = [
						obj.from[0],
						obj.from[2],
						obj.to[0],
						obj.to[2],
					];
					break;
					case 'down':
					uv = [
						obj.from[0],
						rv - obj.to[2],
						obj.to[0],
						rv - obj.from[2],
					];
					break;
				}
				uv.forEach(function(s, uvi) {
					uv[uvi] = limitNumber(s, 0, uvi%2 ? rv : ru);
				})
				obj.faces[side].uv = uv
			})
			obj.autouv = 0
			Canvas.updateUV(obj)
		})
		this.message('uv_editor.autouv')
		this.loadData()
	},
	mirrorX(event) {
		var scope = this;
		this.forElements(obj => {
			if (obj instanceof Cube) {
				scope.getFaces(obj, event, BarItems.uv_mirror_x).forEach((side) => {
					var proxy = obj.faces[side].uv[0]
					obj.faces[side].uv[0] = obj.faces[side].uv[2]
					obj.faces[side].uv[2] = proxy
				})
			} else if (obj instanceof Mesh) {
				let min = Infinity;
				let max = -Infinity;
				scope.getFaces(obj, event, BarItems.uv_mirror_x).forEach((side) => {
					obj.faces[side].vertices.forEach(vkey => {
						min = Math.min(min, obj.faces[side].uv[vkey][0]);
						max = Math.max(max, obj.faces[side].uv[vkey][0]);
					})
				})
				let center = Math.lerp(min, max, 0.5);

				scope.getFaces(obj, event, BarItems.uv_mirror_x).forEach((side) => {
					obj.faces[side].vertices.forEach(vkey => {
						obj.faces[side].uv[vkey][0] = center*2 - obj.faces[side].uv[vkey][0];
					})
				})
			}
			if (obj.autouv) obj.autouv = 0
			obj.preview_controller.updateUV(obj);
		})
		this.message('uv_editor.mirrored')
		this.loadData()
	},
	mirrorY(event) {
		var scope = this;
		this.forElements(obj => {
			if (obj instanceof Cube) {
				scope.getFaces(obj, event, BarItems.uv_mirror_y).forEach((side) => {
					var proxy = obj.faces[side].uv[1]
					obj.faces[side].uv[1] = obj.faces[side].uv[3]
					obj.faces[side].uv[3] = proxy
				})
			} else if (obj instanceof Mesh) {
				let min = Infinity;
				let max = -Infinity;
				scope.getFaces(obj, event, BarItems.uv_mirror_y).forEach((side) => {
					obj.faces[side].vertices.forEach(vkey => {
						min = Math.min(min, obj.faces[side].uv[vkey][1]);
						max = Math.max(max, obj.faces[side].uv[vkey][1]);
					})
				})
				let center = Math.lerp(min, max, 0.5);

				scope.getFaces(obj, event, BarItems.uv_mirror_y).forEach((side) => {
					obj.faces[side].vertices.forEach(vkey => {
						obj.faces[side].uv[vkey][1] = center*2 - obj.faces[side].uv[vkey][1];
					})
				})
			}
			if (obj.autouv) obj.autouv = 0;
			obj.preview_controller.updateUV(obj);
		})
		this.message('uv_editor.mirrored')
		this.loadData()
	},
	applyAll() {
		let ref_face = this.getReferenceFace();
		this.forCubes(cube => {
			UVEditor.cube_faces.forEach(side => {
				cube.faces[side].extend(ref_face);
			})
			cube.autouv = 0
		})
		Canvas.updateSelectedFaces()
		this.message('uv_editor.to_all')
		this.loadData()
	},
	clear(event) {
		var scope = this;
		Undo.initEdit({elements: Cube.selected, uv_only: true})
		this.forCubes(obj => {
			scope.getFaces(obj, event, BarItems.uv_transparent).forEach(function(side) {
				obj.faces[side].uv = [0, 0, 0, 0]
				obj.faces[side].texture = null;
			})
			obj.preview_controller.updateFaces(obj);
		})
		this.loadData()
		this.message('uv_editor.transparent')
		Undo.finishEdit('Remove face')
		Canvas.updateSelectedFaces()
	},
	switchCullface(event) {
		Undo.initEdit({elements: Cube.selected, uv_only: true})
		var val = BarItems.cullface.get()
		if (val === 'off') val = false
		this.forCubes(obj => {
			UVEditor.getSelectedFaces(obj).forEach(fkey => {
				obj.faces[fkey].cullface = val || '';
			})
		})
		if (val) {
			this.message('uv_editor.cullface_on')
		} else {
			this.message('uv_editor.cullface_off')
		}
		Undo.finishEdit('Toggle cullface')
	},
	switchTint(event) {
		var val = UVEditor.getReferenceFace().tint === -1 ? 0 : -1;

		if (event === 0 || event === false) val = event
		this.forCubes(obj => {
			UVEditor.getSelectedFaces(obj).forEach(fkey => {
				obj.faces[fkey].tint = val;
			})
		})
		if (val !== -1) {
			this.message('uv_editor.tint_on')
		} else {
			this.message('uv_editor.tint_off')
		}
		this.displayTools()
	},
	setTint(event, val) {
		this.forCubes(obj => {
			UVEditor.getSelectedFaces(obj).forEach(fkey => {
				obj.faces[fkey].tint = val;
			})
		})
		this.displayTools()
	},
	rotate(mesh_angle) {
		var value = parseInt(BarItems.uv_rotation.get());
		let ref_face = this.getReferenceFace();
		if (Cube.selected[0] && ref_face instanceof CubeFace && Math.abs(ref_face.rotation - value) % 180 == 90) {
			UVEditor.turnMapping();
		}
		if (Format.uv_rotation) {
			this.forCubes(obj => {
				this.getSelectedFaces(obj).forEach(face => {
					obj.faces[face].rotation = value;
				})
				Canvas.updateUV(obj);
			})
		}
		let rect = this.vue.getSelectedUVBoundingBox();
		let center = [(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2];
		Mesh.selected.forEach(mesh => {
			mesh.getSelectedFaces().forEach((fkey) => {
				let face = mesh.faces[fkey];
				if (face.vertices.length < 3) return;

				face.vertices.forEach(vkey => {
					if (!face.uv[vkey]) return;
					let sin = Math.sin(Math.degToRad(mesh_angle));
					let cos = Math.cos(Math.degToRad(mesh_angle));
					face.uv[vkey][0] -= center[0];
					face.uv[vkey][1] -= center[1];
					let a = (face.uv[vkey][0] * cos - face.uv[vkey][1] * sin);
					let b = (face.uv[vkey][0] * sin + face.uv[vkey][1] * cos);
					face.uv[vkey][0] = Math.clamp(a + center[0], 0, UVEditor.getUVWidth());
					face.uv[vkey][1] = Math.clamp(b + center[1], 0, UVEditor.getUVHeight());
				})
			})
			Mesh.preview_controller.updateUV(mesh);
		})
		this.loadData();
		this.message('uv_editor.rotated')
	},
	setRotation(value) {
		var scope = this;
		value = parseInt(value)
		this.forCubes(cube => {
			this.getSelectedFaces(cube).forEach(face => {
				cube.faces[face].rotation = value;
			})
			Canvas.updateUV(cube)
		})
		this.loadData()
		this.message('uv_editor.rotated')
	},
	selectGridSize(event) {
	},
	autoCullface(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(obj, event, BarItems.auto_cullface).forEach(function(side) {
				obj.faces[side].cullface = side
			})
		})
		this.loadData()
		this.message('uv_editor.auto_cull')
	},
	copy(event) {
		let elements = this.getMappableElements();
		if (!elements.length) return;
		let multiple = BarItems.copy.keybind.additionalModifierTriggered(event) == 'multiple';

		UVEditor.clipboard = []

		if (UVEditor.isBoxUV() && Cube.selected[0]) {
			var new_tag = {
				uv: Cube.selected[0].uv_offset
			}
			UVEditor.clipboard.push(new_tag)
			this.message('uv_editor.copied')
			return;
		}

		function addToClipboard(key) {
			let element = elements[0];
			if (!element) return;
			var tag = element.faces[key];
			var new_face;
			if (element instanceof Mesh) {
				new_face = new MeshFace(null, tag);
				Property.resetUniqueValues(MeshFace, new_face);
				new_face.vertices = tag.getSortedVertices();
				new_face.direction = key;
			} else {
				new_face = new CubeFace(key, tag);
				Property.resetUniqueValues(CubeFace, new_face);
			}
			UVEditor.clipboard.push(new_face);
		}
		if (multiple) {
			for (let key in elements[0].faces) {
				addToClipboard(key)
			}
		} else {
			UVEditor.getSelectedFaces(elements[0]).forEach(key => {
				addToClipboard(key);
			})
		}
		this.message('uv_editor.copied_x', [UVEditor.clipboard.length])
	},
	paste(event) {
		let elements = UVEditor.getMappableElements();
		if (UVEditor.clipboard === null || elements.length === 0) return;

		let multiple = BarItems.paste.keybind.additionalModifierTriggered(event) == 'multiple';


		Undo.initEdit({elements, uv_only: true})
		if (UVEditor.isBoxUV() && UVEditor.clipboard[0].uv instanceof Array) {
			Cube.selected.forEach(function(el) {
				el.uv_offset = UVEditor.clipboard[0].uv.slice()
				el.preview_controller.updateUV(el);
			})
		}

		function mergeFace(element, key, tag) {
			if (!element.faces[key]) return;
			let face = element.faces[key];
			if (element instanceof Mesh) {

				let uv_points = [];
				tag.vertices.forEach(vkey => {
					uv_points.push(tag.uv[vkey]);
				})
				face.getSortedVertices().forEach((vkey, i) => {
					if (uv_points[i]) face.uv[vkey].replace(uv_points[i]);
				})
				face.texture = tag.texture;
			} else {
				face.extend(tag);
			}
		}

		if (multiple || UVEditor.clipboard.length === 1) {
			let tag = UVEditor.clipboard[0];
			elements.forEach(el => {
				if (el instanceof Cube && el.box_uv) return;
				if ((el instanceof Cube && tag instanceof CubeFace) || (el instanceof Mesh && tag instanceof MeshFace)) {
					let selected_faces = UVEditor.getSelectedFaces(el);
					for (let key in el.faces) {
						if (multiple || selected_faces.includes(key)) {
							mergeFace(el, key, tag);
						}
					}
					el.preview_controller.updateUV(el);
					el.preview_controller.updateFaces(el);
				}
			})
		} else {
			UVEditor.clipboard.forEach(tag => {
				elements.forEach(el => {
					if (el instanceof Cube && el.box_uv) return;
					if ((el instanceof Cube && tag instanceof CubeFace) || (el instanceof Mesh && tag instanceof MeshFace)) {
						let key = tag.direction;
						if (el.faces[key]) {
							mergeFace(el, key, tag);
						}
					}
				})
			})
			elements.forEach(el => {
				el.preview_controller.updateUV(el);
				el.preview_controller.updateFaces(el);
			})
		}
		this.loadData()
		Canvas.updateSelectedFaces()
		this.message('uv_editor.pasted')
		Undo.finishEdit('Paste UV')
	},
	reset(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(obj, event, BarItems.uv_reset).forEach(function(side) {
				obj.faces[side].reset()
			})
			obj.preview_controller.updateFaces(obj);
			obj.preview_controller.updateUV(obj);
		})
		this.loadData()
		this.message('uv_editor.reset')
	},

	// Dialog
	clipboard: null,
	cube_faces: ['north', 'south', 'west', 'east', 'up', 'down'],
	forSelection(cb, event, ...args) {
		UVEditor[cb](event, ...args);
	},


	menu: new Menu([
		new MenuSeparator('interface'),
		{name: 'menu.view.zoom', id: 'zoom', icon: 'search', children: [
			'zoom_in',
			'zoom_out',
			'zoom_reset'
		]},
		{name: 'menu.uv.display_uv', id: 'display_uv', icon: 'visibility', condition: () => (!Format.image_editor), children: () => {
			let options = ['selected_faces', 'selected_elements', 'all_elements'];
			return options.map(option => {return {
				id: option,
				name: `menu.uv.display_uv.${option}`,
				icon: UVEditor.vue.display_uv == option ? 'far.fa-dot-circle' : 'far.fa-circle',
				condition: !(option == 'selected_faces' && UVEditor.isBoxUV() && !Mesh.selected.length),
				click() {
					Project.display_uv = UVEditor.vue.display_uv = option;
					if (option == 'selected_faces') settings.show_only_selected_uv.set(true);
					if (option == 'selected_elements') settings.show_only_selected_uv.set(false);
					Settings.saveLocalStorages();
				}
			}})
		}},
		'focus_on_selection',
		'painting_grid',
		'uv_checkerboard',
		'paint_mode_uv_overlay',
		new MenuSeparator('copypaste'),
		'copy',
		'paste',
		'cube_uv_mode',
		new MenuSeparator('uv'),
		{
			name: 'menu.uv.export',
			icon: () => UVEditor.getReferenceFace()?.enabled !== false ? 'check_box' : 'check_box_outline_blank',
			condition: () => (!UVEditor.isBoxUV() && UVEditor.getReferenceFace() && Format.java_face_properties),
			click(event) {
				Undo.initEdit({elements: Cube.selected, uv_only: true});
				UVEditor.toggleUV(event);
				Undo.finishEdit('Toggle UV export');
			}
		},
		'uv_maximize',
		'uv_auto',
		'uv_rel_auto',
		'uv_project_from_view',
		'connect_uv_faces',
		'merge_uv_vertices',
		'snap_uv_to_pixels',
		'uv_rotate_left',
		'uv_rotate_right',
		{icon: 'rotate_90_degrees_ccw', condition: () => UVEditor.getReferenceFace() instanceof CubeFace && Format.uv_rotation, name: 'menu.uv.mapping.rotation', children() {
			let reference_face = UVEditor.getReferenceFace();
			let off = 'far.fa-circle';
			let on = 'far.fa-dot-circle';
			return [
				{icon: (!reference_face.rotation ? on : off), name: '0°', click() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					UVEditor.setRotation(0)
					Undo.finishEdit('Rotate UV')
				}},
				{icon: (reference_face.rotation === 90 ? on : off), name: '90°', click() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					UVEditor.setRotation(90)
					Undo.finishEdit('Rotate UV')
				}},
				{icon: (reference_face.rotation === 180 ? on : off), name: '180°', click() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					UVEditor.setRotation(180)
					Undo.finishEdit('Rotate UV')
				}},
				{icon: (reference_face.rotation === 270 ? on : off), name: '270°', click() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					UVEditor.setRotation(270)
					Undo.finishEdit('Rotate UV')
				}}
			]
		}},
		'uv_cycle',
		'uv_cycle_invert',
		'uv_turn_mapping',
		{
			name: 'menu.uv.flip_x',
			icon: () => (UVEditor.isSelectedFaceMirrored(0) ? 'check_box' : 'check_box_outline_blank'),
			condition: () => !UVEditor.isBoxUV() && UVEditor.getReferenceFace(),
			click(event) {
				Undo.initEdit({elements: UVEditor.getMappableElements(), uv_only: true});
				UVEditor.mirrorX(event);
				Undo.finishEdit('Flip UV');
			}
		},
		{
			name: 'menu.uv.flip_y',
			icon: () => (UVEditor.isSelectedFaceMirrored(1) ? 'check_box' : 'check_box_outline_blank'),
			condition: () => !UVEditor.isBoxUV() && UVEditor.getReferenceFace(),
			click(event) {
				Undo.initEdit({elements: UVEditor.getMappableElements(), uv_only: true});
				UVEditor.mirrorY(event);
				Undo.finishEdit('Flip UV');
			}
		},
		new MenuSeparator('face_options'),
		'face_tint',
		{icon: 'flip_to_back', condition: () => (Format.cullfaces && Cube.selected.length && UVEditor.getReferenceFace()), name: 'action.cullface' , children: function() {
			let off = 'far.fa-circle';
			let on = 'far.fa-dot-circle';
			function setCullface(cullface) {
				Undo.initEdit({elements: Cube.selected, uv_only: true})
				UVEditor.forCubes(obj => {
					UVEditor.getSelectedFaces(obj).forEach(face => {
						obj.faces[face].cullface = cullface;
					})
				})
				Undo.finishEdit(cullface ? `Set cullface to ${cullface}` : 'Disable cullface');
			}
			return [
				{icon: (!UVEditor.getReferenceFace().cullface ? on : off), name: 'uv_editor.no_faces', click: () => setCullface('')},
				{icon: (UVEditor.getReferenceFace().cullface == 'north' ? on : off), name: 'face.north', click: () => setCullface('north')},
				{icon: (UVEditor.getReferenceFace().cullface == 'south' ? on : off), name: 'face.south', click: () => setCullface('south')},
				{icon: (UVEditor.getReferenceFace().cullface == 'west' ? on : off), name: 'face.west', click: () => setCullface('west')},
				{icon: (UVEditor.getReferenceFace().cullface == 'east' ? on : off), name: 'face.east', click: () => setCullface('east')},
				{icon: (UVEditor.getReferenceFace().cullface == 'up' ? on : off), name: 'face.up', click: () => setCullface('up')},
				{icon: (UVEditor.getReferenceFace().cullface == 'down' ? on : off), name: 'face.down', click: () => setCullface('down')},
				'auto_cullface'
			]
		}},
		{icon: 'collections', name: 'menu.uv.texture', condition: () => UVEditor.getReferenceFace() && !Format.single_texture, children: function() {
			let arr = [
				{icon: 'crop_square', name: Format.single_texture_default ? 'menu.cube.texture.default' : 'menu.cube.texture.blank', click: function(context, event) {
					let elements = UVEditor.vue.mappable_elements.slice();

					if (Format.per_group_texture) {
						elements = [];
						let groups = Group.multi_selected;
						Outliner.selected.forEach(el => {
							if (el.faces && el.parent instanceof Group) groups.safePush(el.parent);
						});
						Undo.initEdit({outliner: true});
						groups.forEach(group => {
							group.texture = '';
							group.forEachChild(child => {
								if (child.faces) elements.safePush(child);
							})
						})
					} else {
						Undo.initEdit({elements, uv_only: true})
						elements.forEach((obj) => {
							UVEditor.getFaces(obj, event).forEach(fkey => {
								obj.faces[fkey].texture = false;
							})
						})
					}
					UVEditor.loadData()
					Canvas.updateView({elements, element_aspects: {faces: true, uv: true}})
					UVEditor.message('uv_editor.reset')
					Undo.finishEdit('Apply blank texture')
				}},
				{icon: 'clear', name: 'menu.cube.texture.transparent', condition: () => UVEditor.getReferenceFace() instanceof CubeFace, click: function(event) {UVEditor.clear(event)}},
			]
			Texture.all.forEach(function(t) {
				arr.push({
					name: t.name,
					icon: (t.mode === 'link' ? t.img : t.source),
					marked: t == UVEditor.texture,
					click() {
						UVEditor.applyTexture(t);
					}
				})
			})
			return arr;
		}}
	])
}

SharedActions.add('select_all', {
	condition: () => Prop.active_panel == 'uv' && Modes.edit,
	run() {
		Undo.initSelection();
		UVEditor.selectAll()
		Undo.finishSelection('Select all UV');
	}
})
SharedActions.add('select_all', {
	condition: () => Prop.active_panel == 'uv' && Modes.paint && UVEditor.texture,
	run() {
		Undo.initSelection({texture_selection: true});
		UVEditor.texture.selection.setOverride(UVEditor.texture.selection.override == true ? false : true);
		UVEditor.updateSelectionOutline();
		Undo.finishSelection('Select all');
		Interface.removeSuggestedModifierKey('alt', 'modifier_actions.drag_to_duplicate');
	}
})
SharedActions.add('unselect_all', {
	condition: () => Prop.active_panel == 'uv' && Modes.edit,
	run() {
		Undo.initSelection();
		UVEditor.getMappableElements().forEach(element => {
			UVEditor.getSelectedFaces(element, true).empty();
		})
		UVEditor.displayTools();
		Undo.finishSelection('Unselect all UV');
	}
})
SharedActions.add('unselect_all', {
	condition: () => Prop.active_panel == 'uv' && Modes.paint && UVEditor.texture,
	run() {
		Undo.initSelection({texture_selection: true});
		UVEditor.texture.selection.setOverride(false);
		Undo.finishSelection('Unselect all');
		UVEditor.updateSelectionOutline();
		Interface.removeSuggestedModifierKey('alt', 'modifier_actions.drag_to_duplicate');
	}
})
SharedActions.add('invert_selection', {
	condition: () => Prop.active_panel == 'uv' && Modes.paint && UVEditor.texture,
	run() {
		Undo.initSelection({texture_selection: true});
		let texture = UVEditor.texture;
		if (texture.selection.is_custom) {
			texture.selection.forEachPixel((x, y, val, index) => {
				texture.selection.array[index] = val ? 0 : 1;
			})
		} else {
			texture.selection.setOverride(!texture.selection.override);
		}
		UVEditor.updateSelectionOutline();
		Undo.finishSelection('Invert selection');
	}
})

BARS.defineActions(function() {

	new BarSlider('uv_rotation', {
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Format.uv_rotation && Cube.selected.length,
		min: 0, max: 270, step: 90, width: 80,
		onBefore: () => {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
		},
		onChange: function(slider) {
			UVEditor.rotate();
		},
		onAfter: () => {
			Undo.finishEdit('Rotate UV')
		}
	})
	new BarSelect('uv_grid', { 
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Cube.selected.length,
		min_width: 68,
		value: 'auto',
		options: {
			'auto': 'Pixel',
			'1x': '1x',
			'2x': '2x',
			'3x': '3x',
			'4x': '4x',
			'6x': '6x',
			'8x': '8x',
		},
		onChange: function(slider) {
			var value = slider.get().replace(/x/, '');
			UVEditor.setGrid(value);
		}
	})
	new Action('uv_maximize', {
		icon: 'zoom_out_map',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Cube.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) { 
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('maximize', event)
			Undo.finishEdit('Maximize UV')
		}
	})
	new Action('uv_turn_mapping', {
		icon: 'screen_rotation',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Cube.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) { 
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('turnMapping', event)
			Undo.finishEdit('Turn UV mapping')
		}
	})
	new Action('uv_auto', {
		icon: 'brightness_auto',
		category: 'uv',
		condition: () => (UVEditor.isFaceUV() && Cube.selected.length) || Mesh.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: UVEditor.getMappableElements(), uv_only: true})
			UVEditor.forSelection('setAutoSize', event)
			Undo.finishEdit('Auto UV')
		}
	})
	new Action('uv_project_from_view', {
		icon: 'view_in_ar',
		category: 'uv',
		condition: () => (UVEditor.isFaceUV() && Mesh.selected.length),
		click(event) {
			Undo.initEdit({elements: Mesh.selected, uv_only: true})

			let preview = Preview.selected;
			let vector = new THREE.Vector3();

			function projectPoint(vector) {
				let widthHalf = 0.5 * preview.canvas.width / window.devicePixelRatio;
				let heightHalf = 0.5 * preview.canvas.height / window.devicePixelRatio;
				vector.project(preview.camera);
				return [
					 ( vector.x * widthHalf ) + widthHalf,
					-( vector.y * heightHalf ) + heightHalf
				]
			}
			Mesh.selected.forEach(mesh => {
				let scale = preview.calculateControlScale(mesh.getWorldCenter()) / 14;
				let selected_faces = UVEditor.getSelectedFaces(mesh);
				let vertices = {};
				let min = [Infinity, Infinity];
				let max = [-Infinity, -Infinity];
				let previous_origin = [0, 0];
				let face_count = 0;
				
				for (let fkey in mesh.faces) {
					if (!selected_faces.includes(fkey)) continue;
					mesh.faces[fkey].vertices.forEach(vkey => {
						if (vertices[vkey]) return;

						vertices[vkey] = projectPoint( mesh.mesh.localToWorld(vector.fromArray(mesh.vertices[vkey])) );
						for (let i of [0, 1]) {
							vertices[vkey][i] *= scale;
							min[i] = Math.min(min[i], vertices[vkey][i]);
							max[i] = Math.max(max[i], vertices[vkey][i]);
							previous_origin[i] += mesh.faces[fkey].uv[vkey][i];
						}
						face_count++;
					})
				}

				previous_origin.V2_divide(face_count);
				let offset = previous_origin.map((previous, i) => {
					let difference = previous - Math.lerp(min[i], max[i], 0.5);
					return Math.clamp(difference, -min[1], max[1]);
				})

				for (let fkey in mesh.faces) {
					if (!selected_faces.includes(fkey)) continue;
					mesh.faces[fkey].vertices.forEach(vkey => {
						mesh.faces[fkey].uv[vkey][0] = vertices[vkey][0] + offset[0];
						mesh.faces[fkey].uv[vkey][1] = vertices[vkey][1] + offset[1];
					})
				}
				mesh.preview_controller.updateUV(mesh);
			})

			UVEditor.loadData();
			Undo.finishEdit('Auto UV')
		}
	})
	new Action('uv_rel_auto', {
		icon: 'brightness_auto',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Cube.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('setRelativeAutoSize', event)
			Undo.finishEdit('Auto UV')
		}
	})
	new Action('uv_mirror_x', {
		icon: 'icon-mirror_x',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && UVEditor.hasElements(),
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: UVEditor.getMappableElements(), uv_only: true})
			UVEditor.forSelection('mirrorX', event)
			Undo.finishEdit('Mirror UV')
		}
	})
	new Action('uv_mirror_y', {
		icon: 'icon-mirror_y',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && UVEditor.hasElements(),
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: UVEditor.getMappableElements(), uv_only: true})
			UVEditor.forSelection('mirrorY', event)
			Undo.finishEdit('Mirror UV')
		}
	})
	new Action('uv_rotate_left', {
		icon: 'rotate_left',
		category: 'uv',
		condition: () => Mesh.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: Mesh.selected, uv_only: true})
			UVEditor.rotate(-90);
			Undo.finishEdit('Rotate UV left');
		}
	})
	new Action('uv_rotate_right', {
		icon: 'rotate_right',
		category: 'uv',
		condition: () => Mesh.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: Mesh.selected, uv_only: true})
			UVEditor.rotate(90);
			Undo.finishEdit('Rotate UV right');
		}
	})
	new Action('uv_transparent', {
		icon: 'clear',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Cube.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			UVEditor.forSelection('clear', event)
		}
	})
	new Action('uv_reset', {
		icon: 'replay',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Cube.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('reset', event)
			Undo.finishEdit('Reset UV')
		}
	})
	new Action('uv_apply_all', {
		icon: 'format_color_fill',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Cube.selected.length,
		click: function (e) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.applyAll(e)
			Undo.finishEdit('Apply UV to all faces')
		}
	})
	new BarSelect('cullface', { 
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Format.cullfaces && Cube.selected.length && UVEditor.getReferenceFace(),
		label: true,
		options: {
			off: tl('uv_editor.no_faces'),
			north: tl('face.north'),
			south: tl('face.south'),
			west: tl('face.west'),
			east: tl('face.east'),
			up: tl('face.up'),
			down: tl('face.down'),
		},
		onChange: function(sel, event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true});
			UVEditor.forSelection('switchCullface');
			Undo.finishEdit('Set cullface');
		}
	})
	new Action('auto_cullface', {
		icon: 'block',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Format.cullfaces && Cube.selected.length && UVEditor.getReferenceFace(),
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('autoCullface', event)
			Undo.finishEdit('Set automatic cullface')
		}
	})
	new Action('face_tint', {
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Format.java_face_properties && Cube.selected.length && UVEditor.getReferenceFace(),
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('switchTint', event)
			Undo.finishEdit('Toggle face tint')
		}
	})
	new NumSlider('slider_face_tint', {
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Format.java_face_properties && Cube.selected.length && UVEditor.getReferenceFace(),
		getInterval(event) {
			return 1;
		},
		get: function() {
			return Cube.selected[0] && Cube.selected[0].faces[UVEditor.getSelectedFaces(Cube.selected[0], false)[0]].tint
		},
		change: function(modify) {
			let number = Math.clamp(Math.round(modify(this.get())), -1)
			UVEditor.setTint(null, number);
		},
		onBefore: function() {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
		},
		onAfter: function() {
			Undo.finishEdit('Set face tint')
		}
	})
	new Action('merge_uv_vertices', {
		icon: 'close_fullscreen',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Mesh.selected[0] && UVEditor.getSelectedFaces(Mesh.selected[0]).length >= 2,
		click: function (event) {
			Undo.initEdit({elements: Mesh.selected, uv_only: true})
			Mesh.selected.forEach(mesh => {
				let selected_vertices = mesh.getSelectedVertices();
				let selected_faces = mesh.getSelectedFaces();
				let face1 = mesh.faces[selected_faces.last()];
				let target_coords = {};
				let main_target_coord;
				face1.vertices.forEach(vkey => {
					if (!selected_vertices.includes(vkey)) return;
					target_coords[vkey] = face1.uv[vkey];
					main_target_coord = face1.uv[vkey];
				});
				selected_faces.forEach(fkey => {
					let face = mesh.faces[fkey];
					if (!face || face == face1) return;
					let i = 0;
					face.vertices.forEach(vkey => {
						if (selected_vertices.includes(vkey) && face.uv[vkey]) {
							face.uv[vkey][0] = (target_coords[vkey] || main_target_coord)[0];
							face.uv[vkey][1] = (target_coords[vkey] || main_target_coord)[1];
							i++;
						}
					})
				})
				mesh.preview_controller.updateUV(mesh);
			})
			UVEditor.loadData();
			Undo.finishEdit('Merge UV vertices');
		}
	})
	new Action('connect_uv_faces', {
		icon: 'move_up',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Mesh.selected[0] && UVEditor.getSelectedFaces(Mesh.selected[0]).length >= 2,
		click: function (event) {
			Undo.initEdit({elements: Mesh.selected, uv_only: true})
			Mesh.selected.forEach(mesh => {
				let selected_vertices = mesh.getSelectedVertices();
				let selected_faces = mesh.getSelectedFaces();
				let face1 = mesh.faces[selected_faces.last()];
				let face2 = mesh.faces[selected_faces[0]];

				// Get edge to connect
				let connection_edge_1 = face1.vertices.filter(vkey => face2.vertices.includes(vkey));
				let connection_edge_2;
				if (connection_edge_1.length == 2) {
					connection_edge_2 = connection_edge_1;
				} else {
					// array to make sure we don't end up with 2x the same vkey on face 2
					let face2_used_vkeys = [];
					let distance_a = Infinity;
					let vertex_distances = face1.vertices.map(vkey => {
						let uv_1 = face1.uv[vkey];
						let distance_b = Infinity;
						let closest_from_face_2;
						face2.vertices.forEach(vkey2 => {
							if (face2_used_vkeys.includes(vkey2)) return;
							let uv_2 = face2.uv[vkey2]
							let distance = Math.sqrt(Math.pow(uv_2[0] - uv_1[0], 2), Math.pow(uv_2[1] - uv_1[1], 2))
							if (distance < distance_b) {
								closest_from_face_2 = vkey2;
								distance_b = distance;
							}
						})
						face2_used_vkeys.push(face2_used_vkeys);
						return {
							vkey1: vkey,
							vkey2: closest_from_face_2,
							distance: distance_b
						}
					})
					vertex_distances.sort((a, b) => a.distance - b.distance);
					connection_edge_1 = [vertex_distances[0].vkey1, vertex_distances[1].vkey1];
					connection_edge_2 = [vertex_distances[0].vkey2, vertex_distances[1].vkey2];
				}

				// Fix angle
				let angle1 = Math.PI + Math.atan2(
					face1.uv[connection_edge_1[0]][1] - face1.uv[connection_edge_1[1]][1],
					face1.uv[connection_edge_1[0]][0] - face1.uv[connection_edge_1[1]][0],
				);
				let angle2 = Math.PI + Math.atan2(
					face2.uv[connection_edge_2[0]][1] - face2.uv[connection_edge_2[1]][1],
					face2.uv[connection_edge_2[0]][0] - face2.uv[connection_edge_2[1]][0],
				);
				let angle_total = (angle1 - angle2 + Math.PI*6) % (Math.PI*2);
				let sin = Math.sin(angle_total);
				let cos = Math.cos(angle_total);
				selected_faces.forEach(fkey => {
					let face = mesh.faces[fkey];
					if (!face || face == face1) return;
					face.vertices.forEach(vkey => {
						if (!face.uv[vkey]) return;
						face.uv[vkey][0] = (face.uv[vkey][0] * cos - face.uv[vkey][1] * sin);
						face.uv[vkey][1] = (face.uv[vkey][0] * sin + face.uv[vkey][1] * cos);
					})
				})

				// Fix offset
				let offset = [
					face1.uv[connection_edge_1[0]][0] - face2.uv[connection_edge_2[0]][0],
					face1.uv[connection_edge_1[0]][1] - face2.uv[connection_edge_2[0]][1]
				];
				selected_faces.forEach(fkey => {
					let face = mesh.faces[fkey];
					if (!face || face == face1) return;
					face.vertices.forEach(vkey => {
						if (!face.uv[vkey]) return;;
						face.uv[vkey][0] = Math.clamp(face.uv[vkey][0] + offset[0], 0, Project.texture_width);
						face.uv[vkey][1] = Math.clamp(face.uv[vkey][1] + offset[1], 0, Project.texture_height);
					})
				})

				mesh.preview_controller.updateUV(mesh);
			})
			UVEditor.loadData();
			Undo.finishEdit('Connect UV faces');
		}
	})
	new Action('snap_uv_to_pixels', {
		icon: 'grid_goldenratio',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && UVEditor.hasElements(),
		click: function (event) {
			let elements = UVEditor.getMappableElements();
			Undo.initEdit({elements, uv_only: true})
			elements.forEach(element => {
				let selected_vertices = element instanceof Mesh && element.getSelectedVertices();
				UVEditor.getSelectedFaces(element).forEach(fkey => {
					if (!element.faces[fkey]) return;
					let face = element.faces[fkey];
					let texture = face.getTexture();
					let res_x = 1, res_y = 2;
					if (texture) {
						res_x = texture.getUVWidth() / texture.width;
						res_y = texture.getUVHeight() / texture.display_height;
					}
					if (element instanceof Mesh) {
						face.vertices.forEach(vkey => {
							if ((!selected_vertices.length || selected_vertices.includes(vkey)) && face.uv[vkey]) {
								face.uv[vkey][0] = Math.clamp(Math.round(face.uv[vkey][0] / res_x) * res_x, 0, UVEditor.getUVWidth());
								face.uv[vkey][1] = Math.clamp(Math.round(face.uv[vkey][1] / res_y) * res_y, 0, UVEditor.getUVHeight());
							}
						})
					} else if (element instanceof Cube) {
						face.uv[0] = Math.clamp(Math.round(face.uv[0] / res_x) * res_x, 0, UVEditor.getUVWidth());
						face.uv[1] = Math.clamp(Math.round(face.uv[1] / res_y) * res_y, 0, UVEditor.getUVHeight());
						face.uv[2] = Math.clamp(Math.round(face.uv[2] / res_x) * res_x, 0, UVEditor.getUVWidth());
						face.uv[3] = Math.clamp(Math.round(face.uv[3] / res_y) * res_y, 0, UVEditor.getUVHeight());
					}
				})
				element.preview_controller.updateUV(element);
			})
			UVEditor.loadData();
			Undo.finishEdit('Snap UV to pixel grid')
		}
	})
	new Action('uv_cycle', {
		icon: 'fa-arrows-spin',
		category: 'uv',
		condition: () => Mesh.hasSelected(),
		click(event) {
			let elements = Mesh.selected;
			Undo.initEdit({elements, uv_only: true})
			elements.forEach(element => {
				UVEditor.getSelectedFaces(element).forEach(fkey => {
					let face = element.faces[fkey];
					if (!face || face.vertices.length < 3) return;
					let first_uv;
					let sorted_vertices = face.getSortedVertices();
					let offset = (event?.shiftKey || Pressing.overrides.shift) ? -1 : 1;
					sorted_vertices[offset == 1 ? 'forEach' : 'forEachReverse']((vkey, i) => {
						if (!first_uv) first_uv = face.uv[vkey];
						let vkey_next = sorted_vertices[i + offset];
						face.uv[vkey] = vkey_next ? face.uv[vkey_next] : first_uv;
					})
				})
				element.preview_controller.updateUV(element);
			})
			UVEditor.loadData();
			Undo.finishEdit('Cycle UV')
		}
	})
	new Action('uv_cycle_invert', {
		icon: 'fa-group-arrows-rotate',
		category: 'uv',
		condition: () => Mesh.hasSelected(),
		click(event) {
			let elements = Mesh.selected;
			Undo.initEdit({elements, uv_only: true})
			elements.forEach(element => {
				UVEditor.getSelectedFaces(element).forEach(fkey => {
					let face = element.faces[fkey];
					if (!face || face.vertices.length < 3) return;
					let sorted_vertices = face.getSortedVertices();
					let last_i = sorted_vertices.length-1;
					let uv1 = face.uv[sorted_vertices[1]];
					face.uv[sorted_vertices[1]] = face.uv[sorted_vertices[last_i]];
					face.uv[sorted_vertices[last_i]] = uv1;
				})
				element.preview_controller.updateUV(element);
			})
			UVEditor.loadData();
			Undo.finishEdit('Cycle reverse UV')
		}
	})
	new Toggle('edit_mode_uv_overlay', {
		name: 'action.paint_mode_uv_overlay',
		description: 'action.edit_mode_uv_overlay.desc',
		icon: 'stack',
		category: 'uv',
		condition: {modes: ['edit']},
		onChange(value) {
			if (value) {
				Project.display_uv = UVEditor.vue.display_uv = 'all_elements';
				settings.show_only_selected_uv.set(true);
			} else {
				if (settings.show_only_selected_uv.value) {
					Project.display_uv = UVEditor.vue.display_uv = 'selected_faces';
				} else {
					Project.display_uv = UVEditor.vue.display_uv = 'selected_elements';
				}
			}
		}
	})
	new Toggle('paint_mode_uv_overlay', {
		icon: 'stack',
		category: 'uv',
		condition: {modes: ['paint'], method: () => !Format.image_editor},
		onChange(value) {
			UVEditor.vue.uv_overlay = value;
		}
	})
	new Toggle('move_texture_with_uv', {
		icon: 'fas.fa-link',
		category: 'uv',
		condition: {modes: ['edit']}
	})
})

Interface.definePanels(function() {
	function getCanvasCopy() {
		var temp_canvas = document.createElement('canvas')
		var temp_ctx = temp_canvas.getContext('2d');
		temp_canvas.width = Painter.selection.canvas.width;
		temp_canvas.height = Painter.selection.canvas.height;
		temp_ctx.drawImage(Painter.selection.canvas, 0, 0)
		return temp_canvas
	}

	
	UVEditor.panel = new Panel('uv', {
		icon: 'photo_size_select_large',
		expand_button: true,
		condition: {modes: ['edit', 'paint'], method: () => !Format.image_editor},
		display_condition: () => UVEditor.hasElements() || Modes.paint,
		default_position: {
			slot: 'left_bar',
			float_position: [300, 0],
			float_size: [500, 600],
			height: 500
		},
		min_height: 200,
		resizable: true,
		toolbars: [
			new Toolbar('uv_editor', {
				children: [
					'move_texture_with_uv',
					'uv_apply_all',
					'uv_maximize',
					'uv_auto',
					'uv_project_from_view',
					'uv_transparent',
					'uv_mirror_x',
					'uv_mirror_y',
					'uv_rotation',
					//Box
					'toggle_mirror_uv',
				]
			})
		],
		onResize: function() {
			UVEditor.vue.hidden = Format.image_editor ? false : !this.isVisible();
			Vue.nextTick(() => {
				UVEditor.vue.updateSize();
			})
		},
		onFold: function() {
			Vue.nextTick(() => {
				if (!this.folded) UVEditor.loadData();
				UVEditor.vue.hidden = Format.image_editor ? false : !this.isVisible();
			})
		},
		component: {
			data() {return {
				mode: 'uv',
				hidden: false,
				box_uv: false,
				cube_uv_rotation: true,
				width: 320,
				height: 320,
				zoom: 1,
				centered_view: true,
				checkerboard: settings.uv_checkerboard.value,
				pixel_grid: settings.painting_grid.value,
				uv_overlay: false,
				texture: 0,
				layer: null,
				mouse_coords: {x: -1, y: -1, active: false, line_preview: false},
				last_brush_position: [0, 0],
				copy_brush_source: null,
				helper_lines: {x: -1, y: -1},
				brush_type: BarItems.brush_shape.value,
				overlay_canvas_mode: null,
				selection_rect: {
					pos_x: 0,
					pos_y: 0,
					width: 0,
					height: 0,
					active: false
				},
				texture_selection_rect: {
					pos_x: 0,
					pos_y: 0,
					width: 0,
					height: 0,
					active: false,
					ellipse: false
				},
				texture_selection_polygon: [],

				uv_resolution: [16, 16],
				elements: [],
				all_elements: [],
				display_uv: 'selected_elements',
				selection_outline: '',

				face_names: {
					north: tl('face.north'),
					south: tl('face.south'),
					west: tl('face.west'),
					east: tl('face.east'),
					up: tl('face.up'),
					down: tl('face.down'),
				},
				cullface_options: {
					'': tl('uv_editor.no_faces'),
					north: tl('face.north'),
					south: tl('face.south'),
					west: tl('face.west'),
					east: tl('face.east'),
					up: tl('face.up'),
					down: tl('face.down'),
				}
			}},
			computed: {
				inner_width() {
					let axis = this.applicable_aspect_ratio < this.width / this.height;
					if (axis) {
						return this.height * this.zoom * (this.applicable_aspect_ratio);
					} else {
						return this.width * this.zoom;
					}
				},
				inner_height() {
					return Math.min(this.height * this.zoom, this.width * this.zoom / (this.applicable_aspect_ratio));
				},
				applicable_aspect_ratio() {
					if (this.mode == 'paint' && this.texture && this.texture.width) {
						return this.texture.width / this.texture.display_height;
					} else {
						return this.uv_resolution[0] / this.uv_resolution[1];
					}
				},
				mappable_elements() {
					return this.elements.filter(element => element.faces && !element.locked);
				},
				all_mappable_elements() {
					return this.all_elements.filter(element => element.faces && !element.locked);
				},
				textureGrid() {
					if (!this.texture) return '';
					let lines = [];
					let size = UVEditor.getTexturePixelSize();
					if (size <= 5) return '';
					// =
					for (let y = 1; y < this.texture.display_height; y++) {
						if (y % 16 == 0) continue;
						lines.push(`M${0} ${y*size} L${this.inner_width} ${y*size}`);
					}
					// ||
					for (let x = 1; x < this.texture.width; x++) {
						if (x % 16 == 0) continue;
						lines.push(`M${x*size} ${0} L${x*size} ${this.inner_height}`);
					}
					return lines.join(' ');
				},
				textureGridStroke() {
					if (!this.texture) return '';
					let size = UVEditor.getTexturePixelSize();
					return Math.clamp((size - 4) / 16, 0, 0.4) + 'px';
				},
				textureGridBold() {
					if (!this.texture) return '';
					let lines = [];
					let size = UVEditor.getTexturePixelSize();
					let interval = settings.image_editor_grid_size.value;
					// =
					for (let y = interval; y < this.texture.display_height; y += interval) {
						lines.push(`M${0} ${y*size} L${this.inner_width} ${y*size}`);
					}
					// ||
					for (let x = interval; x < this.texture.width; x += interval) {
						lines.push(`M${x*size} ${0} L${x*size} ${this.inner_height}`);
					}
					return lines.join(' ');
				}
			},
			watch: {
				texture() {
					this.uv_resolution.splice(0, 2,
						UVEditor.getUVWidth(),
						UVEditor.getUVHeight()
					);
				},
				'texture.uv_width'(value) {
					this.uv_resolution.splice(0, 2,
						UVEditor.getUVWidth(),
						UVEditor.getUVHeight()
					);
				},
				'texture.uv_height'(value) {
					this.uv_resolution.splice(0, 2,
						UVEditor.getUVWidth(),
						UVEditor.getUVHeight()
					);
				},
				mode() {
					Vue.nextTick(() => {
						this.updateSize();
					})
				}
			},
			methods: {
				projectResolution() {
					if (Format.per_texture_uv_size && UVEditor.texture) {
						UVEditor.texture.openMenu();
					} else {
						BarItems.project_window.trigger();
					}
				},
				updateSize() {
					if (!this.$refs.viewport) return;
					let old_size = this.width;
					let size = Format.image_editor
							? Math.floor(Math.clamp(Interface.center_screen.clientWidth - 8, 64, 1e5))
							: Math.floor(Math.clamp(UVEditor.panel.width - 8, 64, 1e5));
					this.width = size;
					if (Format.image_editor) {
						this.height = Interface.preview.clientHeight - 38;
						if (Blockbench.isMobile) {
							let panel = Interface.getBottomPanel();
							if (panel) this.height -= panel.height;
						}

					} else if (Panels.uv.slot.includes('_bar') && !UVEditor.panel.fixed_height) {
						this.height = size;

					} else {
						this.height = Math.clamp(
							UVEditor.panel.height
							-UVEditor.panel.handle.clientHeight - 8
							-(this.$refs.uv_cube_face_bar ? this.$refs.uv_cube_face_bar.clientHeight : 0)
							-(this.$refs.uv_toolbars ? this.$refs.uv_toolbars.clientHeight : 0)
							-(this.mode == 'paint' ? 30 : 0),
						64, 1e5);
					}
					this.$refs.viewport.scrollLeft = Math.round(this.$refs.viewport.scrollLeft * (size / old_size));
					this.$refs.viewport.scrollTop  = Math.round(this.$refs.viewport.scrollTop  * (size / old_size));

					if (this.$refs.viewport && this.zoom == 1 && ((!this.$refs.viewport.scrollLeft && !this.$refs.viewport.scrollTop) || this.centered_view)) {
						this.centerView();
					}
					this.updateTextureCanvas();
					UVEditor.updateSelectionOutline(false);
				},
				centerView() {
					if (this.$refs.viewport) {
						this.$refs.viewport.scrollLeft = this.width/2;
						this.$refs.viewport.scrollTop = this.height/2;
						UVEditor.updateUVNavigator();
					}
					this.centered_view = true;
				},
				setMode(mode) {
					this.mouse_coords.active = false;
					this.mode = mode;
					this.updateTexture();
				},
				updateTexture() {
					let texture;
					if (Format.single_texture) {
						texture = Texture.getDefault();
					} else {
						let elements = UVEditor.getMappableElements();
						if (elements.length) {
							for (let element of elements) {
								let face = element.faces[ UVEditor.getSelectedFaces(element)[0] || Object.keys(element.faces)[0] ];
								if (face) texture = face.getTexture() || texture;
								if (texture) break;
							}
						} else if (Modes.paint) {
							texture = Texture.getDefault();
						}
					}
					if (texture === null) {
						this.texture = null;
					} else if (texture instanceof Texture && BarItems.view_mode.value == 'material' && texture?.getGroup()?.getTextures()?.includes(Texture.selected)) {
						this.texture = texture = Texture.selected;
						if (!UVEditor.isBoxUV() && UVEditor.auto_grid) {
							UVEditor.grid = texture.width / UVEditor.getUVWidth();
						}
					} else if (texture instanceof Texture) {
						this.texture = texture;
						if (!UVEditor.isBoxUV() && UVEditor.auto_grid) {
							UVEditor.grid = texture.width / UVEditor.getUVWidth();
						}
					} else {
						this.texture = 0;
					}
					this.layer = (this.texture && this.texture.selected_layer) || null;
					// Display canvas while painting
					UVEditor.updateSelectionOutline();
					this.updateTextureCanvas();
				},
				updateTextureCanvas() {
					if (!this.texture) return;
					this.texture.canvas.style.objectPosition = `0 ${-this.texture.currentFrame * this.inner_height}px`;
					this.texture.canvas.style.objectFit = this.texture.frameCount > 1 ? 'cover' : 'fill';
					this.texture.canvas.style.imageRendering = this.texture.width < this.inner_width ? 'inherit' : 'auto';

					UVEditor.updateOverlayCanvas();

					Vue.nextTick(() => {
						let wrapper = this.$refs.texture_canvas_wrapper;
						let overlay_canvas_mode = this.overlay_canvas_mode;
						if (this.mode != 'paint') overlay_canvas_mode = null;
						if (!wrapper || (wrapper.firstChild == this.texture.canvas && !overlay_canvas_mode)) return;
						while (wrapper.firstChild) {
							wrapper.firstChild.remove();
						}
						if (UVEditor.overlay_canvas && overlay_canvas_mode) {
							wrapper.append(UVEditor.overlay_canvas);
						}
						wrapper.append(this.texture.canvas);
					})
				},
				updateMouseCoords(event) {					
					convertTouchEvent(event);
					if (!this.texture) return;

					var {x, y} = UVEditor.getBrushCoordinates(event, this.texture);
					this.mouse_coords.active = true;
					this.mouse_coords.x = x;
					this.mouse_coords.y = y;
					let grab = Toolbox.selected.id == 'move_layer_tool' ||
							  (Toolbox.selected.id == 'selection_tool' && settings.move_with_selection_tool.value && this.texture && this.texture.selection.get(this.mouse_coords.x, this.mouse_coords.y) && BarItems.selection_tool_operation_mode.value == 'create');
					this.$refs.frame.style.cursor = grab ? 'move' : '';
				},
				onScroll() {
					UVEditor.updateUVNavigator();
				},
				onMouseWheel(event) {
					if (event.ctrlOrCmd) {
				
						event.stopPropagation()
						event.preventDefault()
				
						let original_margin = this.getFrameMargin();
						let old_zoom = this.zoom;
						let n = (event.deltaY < 0) ? 0.15 : -0.15;
						if (Math.abs(event.deltaY) < 10) n *= 0.25;
						n *= this.zoom * settings.editor_2d_zoom_speed.value/100;

						let zoom = this.zoom + n;
						if (zoom > (1 - Math.abs(n)) && zoom < (1 + Math.abs(n))) zoom = 1;
						UVEditor.setZoom(zoom);
						
						let updateScroll = () => {
							let {viewport} = this.$refs;
							let offset = $(this.$refs.viewport).offset()
							let margin = this.getFrameMargin();
							let offsetX = event.clientX - offset.left - margin[0];
							let offsetY = event.clientY - offset.top - margin[1];
							// Make it a bit easier to scroll into corners
							offsetX = (offsetX - this.width/2 + margin[0]) * 1.1 + this.width/2 - margin[0];
							offsetY = (offsetY - this.height/2 + margin[1]) * 1.1 + this.height/2 - margin[1];
							let zoom_diff = this.zoom - old_zoom;
							
							viewport.scrollLeft += ((viewport.scrollLeft + offsetX) * zoom_diff) / old_zoom + margin[0] - original_margin[0];
							viewport.scrollTop  += ((viewport.scrollTop  + offsetY) * zoom_diff) / old_zoom + margin[1] - original_margin[1];

							let diagonal_offset = Math.sqrt(Math.pow(margin[0] - viewport.scrollLeft, 2) + Math.pow(margin[1] - viewport.scrollTop, 2));
							if (this.zoom == 1 && Panels.uv.isInSidebar() && diagonal_offset/UVEditor.width < 0.12) {
								this.centerView();
							}

							this.updateTextureCanvas();
							UVEditor.updateUVNavigator();
							
							if (this.mode == 'paint') {
								this.mouse_coords.active = false;
							}
						}
						if (n > 0) {
							Vue.nextTick(updateScroll);
						} else {
							updateScroll();
						}

						return false;
					}
				},
				onMouseDown(event) {
					setActivePanel('uv');
					let scope = this;
					let second_touch;
					let original_zoom = this.zoom;
					let original_margin = scope.getFrameMargin();
					let offset = $(scope.$refs.viewport).offset();
					UVEditor.total_zoom_offset = [6, 6];
					if (event.which === 2 ||
						(Keybinds.extra.preview_drag.keybind.isTriggered(event) && !event.which == 1) ||
						(event.touches && !Toolbox.selected.paintTool && event.target.id == 'uv_frame')
					) {
						// Drag
						if (event.touches) {
							event.clientX = event.touches[0].clientX;
							event.clientY = event.touches[0].clientY;
						}
						let {viewport} = this.$refs;
						let margin = this.getFrameMargin();
						let margin_center = [this.width/2, this.height/2];
						let original = [
							viewport.scrollLeft - 5,
							viewport.scrollTop - 5
						];
						function dragMouseWheel(e2) {
							if (e2.touches) {
								e2.clientX = e2.touches[0].clientX;
								e2.clientY = e2.touches[0].clientY;

								if (!second_touch && e2.touches[1]) {
									second_touch = e2.touches[1];
								}
								if (second_touch && e2.touches[1]) {

									let factor = Math.sqrt(Math.pow(e2.touches[0].clientX - e2.touches[1].clientX, 2) + Math.pow(e2.touches[0].clientY - e2.touches[1].clientY, 2))
											/ Math.sqrt(Math.pow(event.touches[0].clientX - second_touch.clientX, 2) + Math.pow(event.touches[0].clientY - second_touch.clientY, 2));

									if (!Math.epsilon(scope.zoom, original_zoom * factor, 0.01)) {
										UVEditor.setZoom(original_zoom * factor);

										let margin = scope.getFrameMargin();
										let offsetX = e2.clientX - offset.left - margin[0];
										let offsetY = e2.clientY - offset.top - margin[1];
										let zoom_diff = scope.zoom - original_zoom;

										UVEditor.total_zoom_offset[0] = ((original[0] + event.clientX - e2.clientX + offsetX) * zoom_diff) / original_zoom + margin[0] - original_margin[0];
										UVEditor.total_zoom_offset[1] = ((original[1] + event.clientY - e2.clientY  + offsetY) * zoom_diff) / original_zoom + margin[1] - original_margin[1];
									}
								}
							}
							viewport.scrollLeft = Math.snapToValues(original[0] + event.clientX - e2.clientX + UVEditor.total_zoom_offset[0], [margin[0], margin_center[0]], 10);
							viewport.scrollTop = Math.snapToValues(original[1] + event.clientY - e2.clientY + UVEditor.total_zoom_offset[1], [margin[1], margin_center[1]], 10);

							UVEditor.vue.centered_view = (viewport.scrollLeft == margin[0] || viewport.scrollLeft == margin_center[0])
														&& (viewport.scrollTop == margin[1] || viewport.scrollTop == margin_center[1]);
							UVEditor.updateUVNavigator();
						}
						function dragMouseWheelStop(e) {
							removeEventListeners(document, 'mousemove touchmove', dragMouseWheel);
							removeEventListeners(document, 'mouseup touchend', dragMouseWheelStop);
							if (e.which == 3 && Math.pow(viewport.scrollLeft - original[0], 2) + Math.pow(viewport.scrollTop - original[1], 2) > 50) {
								preventContextMenu();
							}
						}
						addEventListeners(document, 'mousemove touchmove', dragMouseWheel);
						addEventListeners(document, 'mouseup touchend', dragMouseWheelStop);
						event.preventDefault();
						$(getFocusedTextInput()).trigger('blur');
						return false;

					} else if (this.mode == 'paint' && Toolbox.selected.paintTool && (event.which === 1 || Keybinds.extra.paint_secondary_color.keybind.isTriggered(event) || (event.touches && event.touches.length == 1))) {
						// Paint
						UVEditor.startPaintTool(event);
						event.preventDefault();
						return false;

					} else if (this.mode == 'uv' && event.target.id == 'uv_frame' && (event.which === 1 || (event.touches && event.touches.length == 1))) {

						if (event.altKey || Pressing.overrides.alt) {
							return this.dragFace(null, null, event);
						}

						let {selection_rect} = this;
						let scope = this;
						let old_faces = {};
						for (let element of UVEditor.getMappableElements()) {
							old_faces[element.uuid] = UVEditor.getSelectedFaces().slice();
						}
						let old_selected_vertices = {};
						Mesh.selected.forEach(mesh => {
							old_selected_vertices[mesh.uuid] = mesh.getSelectedVertices().slice();
						})


						let old_elements;
						if (UVEditor.isBoxUV()) {
							old_elements = UVEditor.getMappableElements().slice();
						}

						function drag(e1) {
							selection_rect.active = true;
							let rect = getRectangle(
								event.offsetX / scope.inner_width * scope.uv_resolution[0],
								event.offsetY / scope.inner_height * scope.uv_resolution[1],
								(event.offsetX - event.clientX + e1.clientX) / scope.inner_width * scope.uv_resolution[0],
								(event.offsetY - event.clientY + e1.clientY) / scope.inner_height * scope.uv_resolution[1],
							)
							selection_rect.pos_x = rect.ax;
							selection_rect.pos_y = rect.ay;
							selection_rect.width = rect.x;
							selection_rect.height = rect.y;
							
							if (!e1.shiftKey && !Mesh.selected.length) {
								for (let element of UVEditor.getMappableElements()) {
									UVEditor.getSelectedFaces(element, true).empty();
								}
								if (old_elements) Outliner.selected.empty();
							} else {
								for (let element of UVEditor.getMappableElements()) {
									UVEditor.getSelectedFaces(element, true).replace(old_faces[element.uuid]);
								}
								if (old_elements) Outliner.selected.replace(old_elements);
							}

							let elements;
							if (UVEditor.isBoxUV()) {
								elements = Cube.all.filter(cube => !cube.locked);
								elements.safePush(UVEditor.getMappableElements());
							} else {
								elements = UVEditor.getMappableElements();
							}
							
							elements.forEach(element => {
								if (element instanceof Cube && !element.box_uv) {
									for (let fkey in element.faces) {
										let face_rect = getRectangle(...element.faces[fkey].uv);
										if (doRectanglesOverlap(rect, face_rect)) {
											UVEditor.getSelectedFaces(element, true).safePush(fkey);
										}
									}
								} else if (element instanceof Cube) {
									let overlaps = false;
									for (let fkey in element.faces) {
										let face_rect = getRectangle(...element.faces[fkey].uv);
										if (doRectanglesOverlap(rect, face_rect)) {
											overlaps = true;
											break;
										}
									}
									if (overlaps) {
										Outliner.selected.safePush(element);
									}
								} else if (element instanceof Mesh) {
									let selected_vertices = element.getSelectedVertices(true);
									let selected_faces = element.getSelectedFaces(true);
									if (!e1.shiftKey) {
										selected_vertices.empty();
									} else {
										selected_vertices.replace(old_selected_vertices[element.uuid]);
									}
									for (let fkey in element.faces) {
										let face = element.faces[fkey];
										let vertices = face.getSortedVertices();
										if (vertices.length >= 3) {
											let i = 0;
											for (let vkey of vertices) {
												i++;
												let vkey2 = vertices[i] || vertices[0];
												if (lineIntersectsReactangle(face.uv[vkey], face.uv[vkey2], [rect.ax, rect.ay], [rect.bx, rect.by])) {
													selected_faces.safePush(fkey);
												}
												if (pointInRectangle(face.uv[vkey], [rect.ax, rect.ay], [rect.bx, rect.by])) {
													selected_vertices.safePush(vkey);
												}
											}
										}
									}
								}
							})
							updateSelection();
							UVEditor.displayTools();
						}
						function stop(e2) {
							removeEventListeners(document, 'mousemove touchmove', drag);
							removeEventListeners(document, 'mouseup touchend', stop);

							if (Math.pow(event.clientX - e2.clientX, 2) + Math.pow(event.clientY - e2.clientY, 2) < 10) {
								for (let element of UVEditor.getMappableElements()) {
									UVEditor.getSelectedFaces(element, true).empty();
								}
								if (old_elements) Outliner.selected.empty();
							}
							setTimeout(() => {
								selection_rect.active = false;
							}, 1)
						}
						addEventListeners(document, 'mousemove touchmove', drag, false);
						addEventListeners(document, 'mouseup touchend', stop, false);
					}
				},
				onMouseEnter(event) {
					if (this.mode == 'paint' && Painter.current.x != undefined) {
						this.mouse_coords.line_preview = event.shiftKey;
					}
				},
				onMouseLeave(event) {
					if (this.mode == 'paint') {
						this.mouse_coords.active = false;
					}
				},
				contextMenu(event) {
					setActivePanel('uv');
					if (Blockbench.hasFlag('no_context_menu')) return;
					UVEditor.menu.open(event);
				},
				selectTextureMenu(event) {
					let menu = new Menu(Texture.all.map(tex => {
						return {
							name: tex.name,
							icon: tex.img,
							marked: tex == UVEditor.texture,
							click(event) {
								tex.select(event);
							}
						}
					}))
					menu.open(event.target);
				},
				selectFace(element, key, event, keep_selection, support_dragging) {
					let selected_faces = element ? UVEditor.getSelectedFaces(element, true) : [];
					let add_to_list = event.shiftKey || event.ctrlOrCmd || Pressing.overrides.shift || Pressing.overrides.ctrl;
					if (keep_selection && selected_faces.includes(key)) {

					} else if (add_to_list) {
						if (selected_faces.includes(key)) {
							selected_faces.remove(key);
						} else {
							selected_faces.push(key);
						}
					} else {
						selected_faces.replace([key]);
					}
					if (!element && key) {
						UVEditor.getMappableElements().forEach(element => {
							let element_selected_faces = UVEditor.getSelectedFaces(element, true);
							if (add_to_list) {
								if (element.faces[key]) {
									element_selected_faces.safePush(key);
								}
							} else {
								if (!element.faces[key]) {
									element_selected_faces.empty();
								} else {
									element_selected_faces.replace([key]);
								}
							}
						})
					}
					UVEditor.vue.updateTexture();
					UVEditor.updateFaceSelection();

					if (support_dragging) {
						function drag(e1) {
							if (e1.target && e1.target.nodeName == 'LI' && e1.target.parentElement.id == 'uv_cube_face_bar') {
								let fkey = e1.target.attributes.face.value;
								for (let element of UVEditor.getMappableElements()) {
									if (element.faces[fkey]) {
										let selected_faces = UVEditor.getSelectedFaces(element, true);
										selected_faces.safePush(fkey);
										UVEditor.updateFaceSelection();
									}
								}
								UVEditor.displayTools();
								UVEditor.updateFaceSelection();
							}
						}
						function stop() {
							removeEventListeners(document, 'mousemove touchmove', drag);
							removeEventListeners(document, 'mouseup touchend', stop);
						}
						addEventListeners(document, 'mousemove touchmove', drag);
						addEventListeners(document, 'mouseup touchend', stop);
					}
				},
				selectCube(cube, event) {
					if (!this.dragging_uv) {
						cube.select(event);
					}
					UVEditor.vue.updateTexture()
				},
				reverseSelect(event) {
					if (this.mode !== 'uv') return;
					var offset = $(this.$refs.frame).offset();
					event.offsetX = event.clientX - offset.left;
					event.offsetY = event.clientY - offset.top;
					if (!this.dragging_uv && !this.selection_rect.active && event.target.id == 'uv_frame') {
						let results = UVEditor.reverseSelect(event)
						if (!(results && results.length)) {
							if (UVEditor.isFaceUV()) {
								for (let element of UVEditor.getMappableElements()) {
									UVEditor.getSelectedFaces(element, true).empty();
								}
							}
						}
					}
				},
				drag({event, onStart, onDrag, onEnd, onAbort, snap, uv_grid}) {
					if (event.which == 2 || event.which == 3) return;
					convertTouchEvent(event);
					let scope = this;

					let pos = [0, 0];
					let last_pos = [0, 0];
					let viewport = this.$refs.viewport;
					let initial_scroll_offset = [viewport.scrollLeft, viewport.scrollTop];
					let original_snap = snap;
					let on_start_ran = false;
					function drag(e1) {
						convertTouchEvent(e1);
						let step_x, step_y;
						let snap = original_snap;

						if (uv_grid == false) {
							step_x = (scope.inner_width / scope.texture.width / snap);
							step_y = (scope.inner_height / scope.texture.height / snap);

						} else if (snap == undefined) {
							snap = UVEditor.grid / canvasGridSize(e1.shiftKey || Pressing.overrides.shift, e1.ctrlOrCmd || Pressing.overrides.ctrl);
	
							step_x = (scope.inner_width / UVEditor.getResolution(0) / snap);
							step_y = (scope.inner_height / UVEditor.getResolution(1) / snap);

						} else {	
							step_x = (scope.inner_width / UVEditor.getResolution(0) / snap);
							step_y = (scope.inner_height / UVEditor.getResolution(1) / snap);
						}
						pos[0] = Math.round((e1.clientX - event.clientX + viewport.scrollLeft - initial_scroll_offset[0]) / step_x) / snap;
						pos[1] = Math.round((e1.clientY - event.clientY + viewport.scrollTop  - initial_scroll_offset[1]) / step_y) / snap;

						if (pos[0] != last_pos[0] || pos[1] != last_pos[1]) {
							if (onStart && !on_start_ran) {
								on_start_ran = true;
								onStart();
							}
							let applied_difference = onDrag(pos[0] - last_pos[0], pos[1] - last_pos[1], e1)
							last_pos[0] += applied_difference[0];
							last_pos[1] += applied_difference[1];
							UVEditor.loadData();
							UVEditor.vue.$forceUpdate();
							Canvas.updateView({elements, element_aspects: {uv: true}});
							scope.dragging_uv = true;
						}
					}

					function stop() {
						removeEventListeners(document, 'mousemove touchmove', drag);
						removeEventListeners(document, 'mouseup touchend', stop);
						if (scope.dragging_uv) {
							onEnd();
							setTimeout(() => scope.dragging_uv = false, 10);
						} else {
							if (onAbort) onAbort();
							Undo.cancelEdit();
						}
					}
					addEventListeners(document, 'mousemove touchmove', drag);
					addEventListeners(document, 'mouseup touchend', stop);
				},
				dragFace(element, face_key, event) {
					if (event.which == 2 || event.which == 3) return;

					let face_selected_before = UVEditor.getSelectedFaces(element)[0];
					if (element && face_key) this.selectFace(element, face_key, event, true);
					let elements = UVEditor.getMappableElements();
					Undo.initEdit({
						elements,
						uv_only: true,

					});
					let total_diff = [0, 0];
					let do_move_uv = !!(BarItems.move_texture_with_uv.value && this.texture);

					UVEditor.getMappableElements().forEach(el => {
						if (el instanceof Mesh) {
							let vertices = el.getSelectedVertices(true);
							if (vertices.length) vertices.empty();
							let edges = el.getSelectedEdges(true);
							if (edges.length) edges.empty();
						}
					})

					let overlay_canvas;
					let started = false;

					this.drag({
						event,
						snap: UVEditor.isBoxUV() ? 1 : undefined,
						onDrag: (diff_x, diff_y) => {
							if (!started) {
								started = true;
								if (do_move_uv) {
									Undo.initEdit({
										elements,
										uv_only: true,
										bitmap: true,
										textures: [this.texture]
									});
			
									overlay_canvas = Interface.createElement('canvas', {class: 'move_texture_with_uv'});
									let ctx = overlay_canvas.getContext('2d');
									overlay_canvas.width = this.texture.width;
									overlay_canvas.height = this.texture.height;
									
									this.texture.edit(canvas => {
										let tex_ctx = canvas.getContext('2d');
										ctx.beginPath();
										tex_ctx.save();
										tex_ctx.beginPath();
										UVEditor.getMappableElements().forEach(el => {
											if (el instanceof Mesh) {
												for (var fkey in el.faces) {
													var face = el.faces[fkey];
													if (!UVEditor.getSelectedFaces(el).includes(fkey)) continue;
													if (face.vertices.length <= 2 || face.getTexture() !== this.texture) continue;
													
													let matrix = face.getOccupationMatrix(true, [0, 0]);
													for (let x in matrix) {
														for (let y in matrix[x]) {
															if (!matrix[x][y]) continue;
															x = parseInt(x); y = parseInt(y);
															ctx.rect(x, y, 1, 1);
															tex_ctx.rect(x, y, 1, 1);
														}
													}
												}
											} else {
												let factor_x = this.texture.width  / UVEditor.getUVWidth();
												let factor_y = this.texture.height / UVEditor.getUVHeight();
												for (var fkey in el.faces) {
													var face = el.faces[fkey];
													if (!UVEditor.getSelectedFaces(el).includes(fkey) && !el.box_uv) continue;
													if (face.getTexture() !== this.texture) continue;
													
													let rect = face.getBoundingRect();
													let canvasRect = [
														Math.floor(rect.ax * factor_x),
														Math.floor(rect.ay * factor_y),
														Math.ceil(rect.bx * factor_x) - Math.floor(rect.ax * factor_x),
														Math.ceil(rect.by * factor_y) - Math.floor(rect.ay * factor_y),
													]
													ctx.rect(...canvasRect);
													tex_ctx.rect(...canvasRect);
												}
											}
										})
										ctx.clip();
										ctx.drawImage(this.texture.img, 0, 0);
										tex_ctx.clip();
										tex_ctx.clearRect(0, 0, canvas.width, canvas.height);
										tex_ctx.restore();
									}, {no_undo: true})
			
									UVEditor.vue.$refs.frame.append(overlay_canvas);
			
								} else {
									Undo.initEdit({elements, uv_only: true});
								}
							}
							elements.forEach(element => {
								if (element instanceof Mesh) {
									UVEditor.getSelectedFaces(element).forEach(key => {
										let face = element.faces[key];
										if (!face) return;
										face.vertices.forEach(vertex_key => {
											diff_x = Math.clamp(diff_x, -face.uv[vertex_key][0], UVEditor.getUVWidth()  - face.uv[vertex_key][0]);
											diff_y = Math.clamp(diff_y, -face.uv[vertex_key][1], UVEditor.getUVHeight() - face.uv[vertex_key][1]);
										})
									})
								} else if (element.box_uv) {
									let size = element.size(undefined, Format.box_uv_float_size != true);
									let uv_size = [
										size[2] + size[0] + (size[1] ? size[2] : 0) + size[0],
										size[2] + size[1],
									]
									diff_x = Math.clamp(diff_x, -element.uv_offset[0] - (size[1] ? 0 : size[2]), UVEditor.getUVWidth()  - element.uv_offset[0] - uv_size[0]);
									diff_y = Math.clamp(diff_y, -element.uv_offset[1] - (size[0] ? 0 : size[2]), UVEditor.getUVHeight() - element.uv_offset[1] - uv_size[1]);

								} else {
									UVEditor.getSelectedFaces(element).forEach(key => {
										if (element.faces[key] && element instanceof Cube && element.faces[key].texture !== null) {
											diff_x = Math.clamp(diff_x, -element.faces[key].uv[0], UVEditor.getUVWidth()  - element.faces[key].uv[0]);
											diff_y = Math.clamp(diff_y, -element.faces[key].uv[1], UVEditor.getUVHeight() - element.faces[key].uv[1]);
											diff_x = Math.clamp(diff_x, -element.faces[key].uv[2], UVEditor.getUVWidth()  - element.faces[key].uv[2]);
											diff_y = Math.clamp(diff_y, -element.faces[key].uv[3], UVEditor.getUVHeight() - element.faces[key].uv[3]);
										}
									})
								}
							})
							elements.forEach(element => {
								if (element instanceof Mesh) {
									UVEditor.getSelectedFaces(element).forEach(key => {
										let face = element.faces[key];
										if (!face) return;
										face.vertices.forEach(vertex_key => {
											face.uv[vertex_key][0] += diff_x;
											face.uv[vertex_key][1] += diff_y;
										})
									})
								} else if (element.box_uv) {
									element.uv_offset[0] = Math.floor(element.uv_offset[0] + diff_x);
									element.uv_offset[1] = Math.floor(element.uv_offset[1] + diff_y);
								} else {
									UVEditor.getSelectedFaces(element).forEach(key => {
										if (element.faces[key] && element instanceof Cube && element.faces[key].texture !== null) {
											element.faces[key].uv[0] += diff_x;
											element.faces[key].uv[1] += diff_y;
											element.faces[key].uv[2] += diff_x;
											element.faces[key].uv[3] += diff_y;
										}
									})
								}
							})
							if (do_move_uv) {
								total_diff[0] += diff_x;
								total_diff[1] += diff_y;
								overlay_canvas.style.left = this.toPixels(total_diff[0]);
								overlay_canvas.style.top  = this.toPixels(total_diff[1]);
							}
							return [diff_x, diff_y]
						},
						onEnd: () => {
							UVEditor.disableAutoUV()
							if (do_move_uv) {
								this.texture.edit((canvas) => {
									canvas.getContext('2d').drawImage(
										overlay_canvas,
										total_diff[0] * this.texture.width  / UVEditor.getUVWidth(),
										total_diff[1] * this.texture.height / UVEditor.getUVHeight()
									);
								}, {no_undo: true})
								overlay_canvas.remove();
								Canvas.updateView({elements, element_aspects: {uv: true}});
							}
							Undo.finishEdit('Move UV');
						},
						onAbort: () => {
							if (do_move_uv) {
								if (overlay_canvas) overlay_canvas.remove();
							}
							if (face_key && Mesh.selected[0]) {
								let selected_faces = UVEditor.getSelectedFaces(element, true);
								let selected_before = selected_faces.slice();
								UVEditor.selectMeshUVIsland(face_key);
								if (
									(selected_faces.includes(face_selected_before) && face_selected_before !== face_key) ||
									(event.shiftKey || event.ctrlOrCmd || Pressing.overrides.shift || Pressing.overrides.ctrl)
								) {
									selected_faces.replace(selected_before);
								}
							}
						}
					})
				},
				resizeFace(face_key, event, x_side, y_side) {
					if (event.which == 2 || event.which == 3) return;
					event.stopPropagation();
					let elements = UVEditor.getMappableElements();
					Undo.initEdit({elements, uv_only: true})
					let inverted = {};
					elements.forEach(element => {
						let faces = inverted[element.uuid] = {};
						UVEditor.getSelectedFaces(element).forEach(key => {
							if (element.faces[key] && element instanceof Cube) {
								faces[key] = [
									element.faces[key].uv[0] > element.faces[key].uv[2],
									element.faces[key].uv[1] > element.faces[key].uv[3],
								]
							}
						})
					})

					this.drag({
						event,
						onDrag: (x, y) => {
							elements.forEach(element => {
								UVEditor.getSelectedFaces(element).forEach(key => {
									if (element.faces[key] && element instanceof Cube) {
										if (x_side && (x_side == -1) != inverted[element.uuid][key][0]) element.faces[key].uv[0] = Math.clamp(element.faces[key].uv[0] + x, 0, UVEditor.getUVWidth());
										if (y_side && (y_side == -1) != inverted[element.uuid][key][1]) element.faces[key].uv[1] = Math.clamp(element.faces[key].uv[1] + y, 0, UVEditor.getUVHeight());
										if (x_side && (x_side ==  1) != inverted[element.uuid][key][0]) element.faces[key].uv[2] = Math.clamp(element.faces[key].uv[2] + x, 0, UVEditor.getUVWidth());
										if (y_side && (y_side ==  1) != inverted[element.uuid][key][1]) element.faces[key].uv[3] = Math.clamp(element.faces[key].uv[3] + y, 0, UVEditor.getUVHeight());
									}
								})
							})
							return [x, y]
						},
						onEnd: () => {
							UVEditor.disableAutoUV()
							Undo.finishEdit('Resize UV')
						}
					})
				},
				rotateFace(event) {
					if (event.which == 2 || event.which == 3) return;
					event.stopPropagation();
					convertTouchEvent(event);
					let scope = this;
					let elements = UVEditor.getMappableElements();
					Undo.initEdit({elements, uv_only: true})

					let face_center = [0, 0];
					let points = 0;
					elements.forEach(element => {
						UVEditor.getSelectedFaces(element).forEach(fkey => {
							let face = element.faces[fkey];
							if (!face) return;
							if (element instanceof Cube) {
								face_center[0] += face.uv[0] + face.uv[2];
								face_center[1] += face.uv[1] + face.uv[3];
								points += 2;
							} else if (element instanceof Mesh) {
								face.old_uv = {};
								face.vertices.forEach(vkey => {
									if (!face.uv[vkey]) return;
									face_center[0] += face.uv[vkey][0];
									face_center[1] += face.uv[vkey][1];
									points += 1;
									face.old_uv[vkey] = face.uv[vkey].slice();
								})
							}
						})
					})
					face_center.forEach((v, i) => face_center[i] = v / points);

					let offset = $(UVEditor.vue.$refs.frame).offset();
					let center_on_screen = [
						face_center[0] * UVEditor.getPixelSize() + offset.left,
						face_center[1] * UVEditor.getPixelSize() + offset.top,
					]

					let angle = 0;
					let last_angle;
					let original_angle;
					let straight_angle;
					let snap = elements[0] instanceof Cube ? 90 : 1;
					function drag(e1) {
						convertTouchEvent(e1);

						angle = Math.atan2(
							(e1.clientY - center_on_screen[1]),
							(e1.clientX - center_on_screen[0]),
						)
						angle = Math.round(Math.radToDeg(angle) / snap) * snap;
						if (original_angle == undefined) original_angle = angle;
						angle -= original_angle;
						if (last_angle == undefined) last_angle = angle;
						if (Math.abs(angle - last_angle) > 300) last_angle = angle;

						if (angle != last_angle && (straight_angle == undefined || Math.abs(straight_angle - angle) > 6 || e1.ctrlOrCmd || Pressing.overrides.ctrl)) {
							
							straight_angle = undefined;
							scope.helper_lines.x = scope.helper_lines.y = -1;
							elements.forEach(element => {
								if (element instanceof Cube && Format.uv_rotation) {
									UVEditor.getSelectedFaces(element).forEach(key => {
										if (element.faces[key]) {
											element.faces[key].rotation += 90 * Math.sign(last_angle - angle);
											if (element.faces[key].rotation == 360) element.faces[key].rotation = 0;
											if (element.faces[key].rotation < 0) element.faces[key].rotation += 360;
										}
									})

								} else if (element instanceof Mesh) {
									function setUV(angle) {
										UVEditor.getSelectedFaces(element).forEach(fkey => {
											let face = element.faces[fkey];
											if (!face) return;
											let sin = Math.sin(Math.degToRad(angle));
											let cos = Math.cos(Math.degToRad(angle));
											face.vertices.forEach(vkey => {
												if (!face.uv[vkey]) return;
												face.uv[vkey][0] = face.old_uv[vkey][0] - face_center[0];
												face.uv[vkey][1] = face.old_uv[vkey][1] - face_center[1];
												let a = (face.uv[vkey][0] * cos - face.uv[vkey][1] * sin);
												let b = (face.uv[vkey][0] * sin + face.uv[vkey][1] * cos);
												face.uv[vkey][0] = Math.clamp(a + face_center[0], 0, UVEditor.getUVWidth());
												face.uv[vkey][1] = Math.clamp(b + face_center[1], 0, UVEditor.getUVHeight());
											})
										})
									}
									setUV(angle);
									let e = 0.6;
									UVEditor.getSelectedFaces(element).forEach(fkey => {
										let face = element.faces[fkey];
										if (!face) return;
										face.vertices.forEach((vkey, i) => {
											for (let j = i+1; j < face.vertices.length; j++) {
												let relative_angle = Math.radToDeg(Math.PI + Math.atan2(
													face.uv[vkey][1] - face.uv[face.vertices[j]][1],
													face.uv[vkey][0] - face.uv[face.vertices[j]][0],
												)) % 180;
												if (Math.abs(relative_angle - 90) < e) {
													straight_angle = angle - (relative_angle - 90);
													if (scope.helper_lines.x == -1) scope.helper_lines.x = face.uv[vkey][0];
													break;
												}
												if (relative_angle < e || 180 - relative_angle < e) {
													straight_angle = angle - (relative_angle > 90 ? (relative_angle-180) : relative_angle);
													if (scope.helper_lines.y == -1) scope.helper_lines.y = face.uv[vkey][1];
													break;
												}
											} 
										})
									})
									if (straight_angle) {
										setUV(straight_angle);
									}
								}
							})
							UVEditor.turnMapping()

							last_angle = angle;
							UVEditor.loadData();
							UVEditor.vue.$forceUpdate();
							Canvas.updateView({elements, element_aspects: {uv: true}});
							scope.dragging_uv = true;
						}
					}

					function stop() {
						removeEventListeners(document, 'mousemove touchmove', drag);
						removeEventListeners(document, 'mouseup touchend', stop);
						scope.helper_lines.x = scope.helper_lines.y = -1;
						if (scope.dragging_uv) {
							UVEditor.disableAutoUV()
							Undo.finishEdit('Rotate UV')
							setTimeout(() => scope.dragging_uv = false, 10);
						} else {
							Undo.cancelEdit();
						}
					}
					addEventListeners(document, 'mousemove touchmove', drag);
					addEventListeners(document, 'mouseup touchend', stop);

				},
				scaleFaces(event) {
					if (event.which == 2 || event.which == 3) return;
					event.stopPropagation();
					let elements = UVEditor.getMappableElements();
					Undo.initEdit({elements, uv_only: true})
					elements.forEach(element => {
						UVEditor.getSelectedFaces(element).forEach(fkey => {
							let face = element.faces[fkey];
							if (!face) return;
							if (element instanceof Cube) {
								face.old_uv = face.uv.slice();
							} else if (element instanceof Mesh) {
								face.old_uv = {};
								face.vertices.forEach(vkey => {
									if (!face.uv[vkey]) return;
									face.old_uv[vkey] = face.uv[vkey].slice();
								})
							}
						})
					})
					let min = this.getSelectedUVBoundingBox();
					let bounding_size = [min[2]-min[0], min[3]-min[1]]

					let total_offset = [0, 0];
					let total_offset_y = 0;
					this.drag({
						event,
						onDrag: (x, y, event) => {
							total_offset[0] += x;
							total_offset[1] += y;
							total_offset_y = (event.altKey || Pressing.overrides.alt) ? (total_offset[0] / bounding_size[0] * bounding_size[1]) : total_offset[1];
							elements.forEach(element => {
								UVEditor.getSelectedFaces(element).forEach(key => {
									if (!element.faces[key]) return;
									let face = element.faces[key];
									if (element instanceof Cube) {
										face.uv[0] = min[0] + (face.old_uv[0] - min[0]) * (1 + total_offset[0]/bounding_size[0]);
										face.uv[1] = min[1] + (face.old_uv[1] - min[1]) * (1 + total_offset_y /bounding_size[1]);
										face.uv[2] = min[0] + (face.old_uv[2] - min[0]) * (1 + total_offset[0]/bounding_size[0]);
										face.uv[3] = min[1] + (face.old_uv[3] - min[1]) * (1 + total_offset_y /bounding_size[1]);
									} else if (element instanceof Mesh) {
										for (let vkey in face.uv) {
											face.uv[vkey][0] = min[0] + (face.old_uv[vkey][0] - min[0]) * (1 + total_offset[0]/bounding_size[0]);
											face.uv[vkey][1] = min[1] + (face.old_uv[vkey][1] - min[1]) * (1 + total_offset_y /bounding_size[1]);
										}
									}
								})
							})
							return [x, y]
						},
						onEnd: () => {
							UVEditor.disableAutoUV()
							Undo.finishEdit('Scale UV')
						}
					})
				},

				dragVertices(element, vertex_key, event) {
					if (event.which == 2 || event.which == 3) return;

					let sel_vertices = element.getSelectedVertices(true);
					let add_to_selection = (event.shiftKey || event.ctrlOrCmd || Pressing.overrides.shift || Pressing.overrides.ctrl);
					if (sel_vertices.includes(vertex_key)) {

					} else if (add_to_selection) {
						if (sel_vertices.includes(vertex_key)) {
							sel_vertices.remove(vertex_key);
						} else {
							sel_vertices.push(vertex_key);
						}
					} else {
						sel_vertices.replace([vertex_key]);
					}

					let elements = UVEditor.getMappableElements();
					Undo.initEdit({elements, uv_only: true})

					this.drag({
						event,
						onDrag: (x, y, event) => {
							elements.forEach(element => {
								let vertices = element.getSelectedVertices();
								UVEditor.getSelectedFaces(element).forEach(key => {
									let face = element.faces[key];
									if (!face) return;
									face.vertices.forEach(vertex_key => {
										if (vertices.includes(vertex_key)) {
											x = Math.clamp(x, -face.uv[vertex_key][0], UVEditor.getUVWidth() - face.uv[vertex_key][0]);
											y = Math.clamp(y, -face.uv[vertex_key][1], UVEditor.getUVHeight() - face.uv[vertex_key][1]);
										}
									})
								})
							})
							elements.forEach(element => {
								let vertices = element.getSelectedVertices().slice();
								UVEditor.getSelectedFaces(element).forEach(key => {
									let face = element.faces[key];
									if (!face) return;
									let old_uv_coords = face.vertices.map(vkey => face.uv[vkey].slice())
									face.vertices.forEach((vertex_key, i) => {
										if (vertices.includes(vertex_key)) {
											let is_duplicate = face.vertices.find((vkey2, j) => {
												return j > i && face.uv[vertex_key].equals(old_uv_coords[j])
											})
											if (is_duplicate) {
												vertices.remove(vertex_key);
												return;
											}
											face.uv[vertex_key][0] += x;
											face.uv[vertex_key][1] += y;
											if ((event.shiftKey || Pressing.overrides.shift) && !(event.ctrlOrCmd || Pressing.overrides.ctrl)) {
												let multiplier = (settings.shift_size.value / 16) * UVEditor.grid;
												face.uv[vertex_key][0] = Math.round(face.uv[vertex_key][0] * multiplier) / multiplier;
												face.uv[vertex_key][1] = Math.round(face.uv[vertex_key][1] * multiplier) / multiplier;
											}
										}
									})
								})
							})
							return [x, y]
						},
						onEnd: () => {
							Undo.finishEdit('Move UV');
						},
						onAbort() {
							if (!add_to_selection) {
								sel_vertices.replace([vertex_key]);
							}
						}
					})
				},

				toPixels(uv_coord, offset = 0) {
					return (uv_coord / this.uv_resolution[0] * this.inner_width + offset) + 'px';
				},
				toTexturePixels(tex_coord, axis, offset = 0) {
					if (axis == 1 && this.texture.currentFrame > 0) {
						return ((tex_coord / this.texture.width - this.texture.currentFrame) * this.inner_width + offset) + 'px';
					} else {
						return (tex_coord / this.texture.width * this.inner_width + offset) + 'px';
					}
				},
				getDisplayedUVElements() {
					if (this.mode == 'uv' || this.uv_overlay) {
						return (this.display_uv === 'all_elements' || this.mode == 'paint')
							 ? this.all_mappable_elements
							 : this.mappable_elements;
					} else {
						return [];
					}
				},
				getMeshFaceOutline(face) {
					let coords = [];
					let uv_offset = [
						-this.getMeshFaceCorner(face, 0),
						-this.getMeshFaceCorner(face, 1),
					]
					face.getSortedVertices().forEach(key => {
						let UV = face.uv[key];
						coords.push(
							Math.roundTo((UV[0] + uv_offset[0]) / this.uv_resolution[0] * this.inner_width + 1, 4) + ',' +
							Math.roundTo((UV[1] + uv_offset[1]) / this.uv_resolution[0] * this.inner_width + 1, 4)
						)
					})
					return coords.join(' ');
				},
				getMeshFaceCorner(face, axis) {
					let val = Infinity;
					face.vertices.forEach(key => {
						let UV = face.uv[key];
						val = Math.min(val, UV[axis]);
					})
					return val;
				},
				getMeshFaceWidth(face, axis) {
					let min = Infinity;
					let max = 0;
					face.vertices.forEach(key => {
						let UV = face.uv[key];
						min = Math.min(min, UV[axis]);
						max = Math.max(max, UV[axis]);
					})
					return max - min;
				},
				filterMeshFaces(element) {
					let keys = Object.keys(element.faces);
					if (keys.length > 2000) {
						let result = {};
						element.getSelectedFaces().forEach(key => {
							result[key] = element.faces[key];
						})
						return result;
					} else {
						return element.faces;
					}
				},
				isScalingAvailable() {
					if (this.mappable_elements[0] instanceof Cube) {
						return UVEditor.isFaceUV() && !!UVEditor.getReferenceFace();

					} else if (this.mappable_elements[0] instanceof Mesh) {
						return this.mappable_elements[0].getSelectedFaces().length > 0;
					}
				},
				isRotatingAvailable() {
					/*if (this.mappable_elements[0] instanceof Cube) {
						return UVEditor.isFaceUV();
					}*/
					if (this.mappable_elements[0] instanceof Mesh) {
						return this.mappable_elements[0].getSelectedFaces().length > 0;
					}
				},
				getSelectedUVBoundingBox() {
					if (!Project) return [0, 0, 0, 0];
					let min = [UVEditor.getUVWidth(), UVEditor.getUVHeight()];
					let max = [0, 0];
					this.mappable_elements.forEach(element => {
						UVEditor.getSelectedFaces(element).forEach(fkey => {
							if (element.faces[fkey].texture === null) return;

							let face = element.faces[fkey];
							if (element instanceof Cube) {
								min[0] = Math.min(min[0], face.uv[0], face.uv[2]);
								min[1] = Math.min(min[1], face.uv[1], face.uv[3]);
								max[0] = Math.max(max[0], face.uv[0], face.uv[2]);
								max[1] = Math.max(max[1], face.uv[1], face.uv[3]);
							} else if (element instanceof Mesh) {
								face.vertices.forEach(vkey => {
									if (!face.uv[vkey]) return;
									min[0] = Math.min(min[0], face.uv[vkey][0]);
									min[1] = Math.min(min[1], face.uv[vkey][1]);
									max[0] = Math.max(max[0], face.uv[vkey][0]);
									max[1] = Math.max(max[1], face.uv[vkey][1]);
								})
							}
						})
					})
					return [...min, ...max];
				},
				getBrushOutlineStyle() {
					if (Toolbox.selected.brush && Settings.get('brush_cursor_2d')) {
						var pixel_size = this.inner_width / (this.texture ? this.texture.width : Project.texture_width);
						//pos
						let offset = 0;
						if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
							offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0 : 0.5;
						}
						let left = this.mouse_coords.x;
						let top =  this.mouse_coords.y - (this.texture ? this.texture.currentFrame * this.texture.display_height : 0);
						left = (left + offset) * pixel_size;
						top =  (top + offset) * pixel_size;
						//size
						var radius = (BarItems.slider_brush_size.get()/2) * pixel_size;
						return {
							'--radius': radius,
							left: left+'px',
							top: top+'px'
						}
					} else {
						return {display: 'none'};
					}
				},
				getCopyBrushOutlineStyle() {
					if (Toolbox.selected.brush) {
						var pixel_size = this.inner_width / (this.texture ? this.texture.width : Project.texture_width);
						//pos
						let offset = this.copy_brush_source.size%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0 : 0.5;
						let left = (this.copy_brush_source.x + offset) * pixel_size;
						let top =  (this.copy_brush_source.y + offset) * pixel_size;
						//size
						var radius = (this.copy_brush_source.size/2) * pixel_size;
						return {
							'--radius': radius,
							left: left+'px',
							top: top+'px'
						}
					} else {
						return {display: 'none'};
					}
				},
				getFrameMargin(style) {
					let gap_x = Math.max((this.width - this.inner_width) / 2, 0);
					let gap_y = Math.max((this.height - this.inner_height) / 2, 0);
					let margin = [
						Math.floor(gap_x + this.width/2),
						Math.floor(gap_y + this.height/2),
					];
					return style ? `${margin[1]}px ${margin[0]}px` : margin;
				},
				getTextureSelectionPolygon() {
					return this.texture_selection_polygon.map((point, i) => {
						let x = point[0] / this.texture.width * this.inner_width;
						let y = point[1] / this.texture.width * this.inner_width;
						return `${i?'L':'M'}${x+1} ${y+1}`;
					}).join(' ');
				},
				isSelectionPolygonClosed() {
					let polygon = this.texture_selection_polygon;
					if (polygon.length <= 3) return false;
					let first = polygon[0];
					let last = polygon.last()
					let distance = Math.sqrt(Math.pow(first[0]-last[0], 2) + Math.pow(first[1]-last[1], 2));
					let radius = Blockbench.isTouch ? 12 : 7;
					return distance < (radius/UVEditor.getPixelSize());
				},

				startTextureSelection(x, y, event) {
					let texture = UVEditor.texture;
					if (!texture) return;
					if (texture.img.naturalWidth + texture.img.naturalHeight == 0) return;
					if (!texture.selected) texture.select();

					let clicked_val = texture.selection.get(Math.floor(x), Math.floor(y));
					let selection_mode = BarItems.selection_tool.mode;
					let op_mode = BarItems.selection_tool_operation_mode.value;
					let selection_rect = this.texture_selection_rect;
					let selection_polygon = this.texture_selection_polygon;
					let scope = this;
					let start_x, start_y, calcrect;
					let layer = texture.selected_layer;
					let move_with_selection_tool = Toolbox.selected.id == 'selection_tool' && op_mode == 'create' && settings.move_with_selection_tool.value && (clicked_val || layer?.in_limbo)
					let create_selection = Toolbox.selected.id == 'selection_tool'
						&& !move_with_selection_tool
						&& !event.target.classList.contains('uv_layer_transform_handles');
					let initial_offset = layer ? layer.offset.slice() : [0, 0];

					if (!create_selection) {
						x = Math.round(x);
						y = Math.round(y);
					}
					start_x = x;
					start_y = y;

					if (create_selection) {
						Undo.initSelection({texture_selection: true});
						if (op_mode == 'create' && (selection_mode != 'lasso' || selection_polygon.length == 0)) {
							texture.selection.clear();
						}
						
						if (selection_mode == 'wand' || selection_mode == 'color') {
							let {canvas, ctx, offset} = texture.getActiveCanvas();
							let image_data = ctx.getImageData(x - offset[0], y - offset[1], 1, 1);
							let pxcol = [...image_data.data];
							let map = {};
							let color_threshold = BarItems.slider_color_select_threshold.get();
							let pxcol_lab = rgb2lab(pxcol);
							let colorsWithinThreshold = (color_b) => {
								if (pxcol.equals(color_b)) return true;
								if (color_threshold == 0) return false;
								if (Math.abs(pxcol[3] - color_b[3]) / 2.52 > color_threshold) return false;
								let color_b_lab = rgb2lab(color_b);
								let distance = labColorDistance(pxcol_lab, color_b_lab);
								return distance <= color_threshold;
							}
							Painter.scanCanvas(ctx, 0, 0, canvas.width, canvas.height, (x, y, px) => {
								if (colorsWithinThreshold(px)) {
									if (!map[x]) map[x] = {};
									map[x][y] = true
								}
							})
							var scan_value = true;
							if (selection_mode == 'wand') {
								let points = [[x - offset[0], y - offset[1]]];
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
							let value = op_mode == 'subtract' ? 0 : (op_mode == 'intersect' ? 2 : 1);
							for (let x in map) {
								for (let y in map[x]) {
									if (map[x][y] == scan_value) {
										x = parseInt(x);
										y = parseInt(y);
										if (op_mode == 'intersect') {
											let previous = texture.selection.get(x + offset[0], y + offset[1]);
											if (!previous) continue;
										}
										texture.selection.set(x + offset[0], y + offset[1], value);
									}
								}
							}
							if (op_mode == 'intersect') {
								texture.selection.forEachPixel((x, y, value, i) => {
									if (value == 2) {
										texture.selection.array[i] = 1;
									} else {
										texture.selection.array[i] = 0;
									}
								})
							}
							UVEditor.updateSelectionOutline();
							Undo.finishSelection('Select color');
							return;
						} else if (selection_mode == 'lasso') {
							selection_polygon.push([x, y]);
						}
					}

					let last_x, last_y;
					let started_movement = false;
					function drag(e1) {

						let {x, y} = UVEditor.getBrushCoordinates(e1, texture);
						if (!create_selection) {
							x = Math.round(x);
							y = Math.round(y);
						}
						if (last_x == x && last_y == y) return;
						last_x = x, last_y = y;
						
						if (create_selection && selection_mode == 'lasso') {
							selection_polygon.push([x, y]);

						} else if (create_selection) {
							let start_x_here = start_x;
							let start_y_here = start_y;
							if (!settings.nearest_rectangle_select.value) {
								if (x >= start_x) x++;
								if (y >= start_y) y++;
								if (x < start_x) start_x_here++;
								if (y < start_y) start_y_here++;
							}
							if (x === Painter.current.x && y === Painter.current.y) return;
							Painter.current.x = x = Math.clamp(x, 0, UVEditor.texture.img.naturalWidth);
							Painter.current.y = y = Math.clamp(y, 0, UVEditor.texture.img.naturalHeight);
							start_x_here = Math.clamp(start_x_here, 0, UVEditor.texture.img.naturalWidth);
							start_y_here = Math.clamp(start_y_here, 0, UVEditor.texture.img.naturalHeight);
						
							calcrect = getRectangle(start_x_here, start_y_here, x, y);
							if (!calcrect.x && !calcrect.y) return;
							if (e1.ctrlKey || Pressing.overrides.ctrl) {
								calcrect.y = calcrect.x = Math.round((calcrect.y + calcrect.x) / 2);
								calcrect.bx = calcrect.ax + calcrect.x;
								calcrect.by = calcrect.ay + calcrect.y;
							}

							selection_rect.active = true;
							selection_rect.ellipse = selection_mode == 'ellipse';
							selection_rect.pos_x = calcrect.ax;
							selection_rect.pos_y = calcrect.ay;
							selection_rect.width = calcrect.x;
							selection_rect.height = calcrect.y;

							Blockbench.setCursorTooltip(`${selection_rect.width} x ${selection_rect.height}`);

						} else {
							if (!started_movement) {
								UVEditor.vue.selection_outline = '';
								if ((!layer || !layer.in_limbo) && texture.selection.is_custom && texture.selection.hasSelection()) {
									Undo.initEdit({textures: [texture], bitmap: true});
									texture.selectionToLayer(false, (e1.altKey || Pressing.overrides.alt));
									layer = texture.selected_layer;
									initial_offset = layer.offset.slice();
								} else if (!layer) {
									Undo.initEdit({textures: [texture], bitmap: true});
									texture.activateLayers(false);
									layer = texture.selected_layer;
								/*} else if (event.altKey || Pressing.overrides.alt) {
									Undo.initEdit({textures: [texture], bitmap: true});
									let old_layer = texture.selected_layer;
									SharedActions.runSpecific('duplicate', 'layer', event, layer, true);
									layer = texture.selected_layer;
									old_layer.resolveLimbo(true);*/
								} else {
									Undo.initEdit({layers: [layer], bitmap: true});
								}
								selection_polygon.empty();
								texture.selection.clear();
								UVEditor.updateSelectionOutline();
							}
							layer.offset[0] = initial_offset[0] + x - start_x;
							layer.offset[1] = initial_offset[1] + y - start_y;
							Blockbench.setCursorTooltip(`${x - start_x} x ${y - start_y}`);
							texture.updateLayerChanges();
							UVEditor.vue.$forceUpdate();
						}
						started_movement = true;
					}
					function stop() {
						removeEventListeners(document, 'pointermove', drag);
						removeEventListeners(document, 'pointerup', stop);
						selection_rect.active = false;
						Blockbench.setCursorTooltip();

						if (create_selection) {
							if ((!calcrect || selection_rect.width == 0 || selection_rect.height == 0) && selection_mode != 'lasso') {
								if (!texture.selection.hasSelection()) {
									texture.selection.clear();
									UVEditor.updateSelectionOutline();
									Undo.finishSelection('Unselect texture area');
								}
								if (TextureLayer.selected?.in_limbo) {
									TextureLayer.selected.resolveLimbo();
								}
								return;
							}

							if (op_mode == 'create' && selection_mode != 'lasso') {
								texture.selection.clear();
							}
							if (selection_mode == 'rectangle') {
								for (let x = calcrect.ax; x < calcrect.bx; x++) {
									for (let y = calcrect.ay; y < calcrect.by; y++) {
										switch (op_mode) {
											case 'create': case 'add': {
												texture.selection.set(x, y, 1);
												break;
											}
											case 'subtract': {
												texture.selection.set(x, y, 0);
												break;
											}
											case 'intersect': {
												if (texture.selection.get(x, y)) {
													texture.selection.set(x, y, 2);
												}
												break;
											}
										}
									}
								}
							}
							if (selection_mode == 'ellipse') {
								let center_x = calcrect.ax + calcrect.x/2;
								let center_y = calcrect.ay + calcrect.y/2;
								for (let x = calcrect.ax; x < calcrect.bx; x++) {
									for (let y = calcrect.ay; y < calcrect.by; y++) {
										let distance = Math.sqrt(Math.pow((center_x - x - 0.5) / calcrect.x, 2) + Math.pow((center_y - y - 0.5) / calcrect.y, 2));
										if (distance > 0.5) continue;
										switch (op_mode) {
											case 'create': case 'add': {
												texture.selection.set(x, y, 1);
												break;
											}
											case 'subtract': {
												texture.selection.set(x, y, 0);
												break;
											}
											case 'intersect': {
												if (texture.selection.get(x, y)) {
													texture.selection.set(x, y, 2);
												}
												break;
											}
										}
									}
								}
							}
							if (selection_mode == 'lasso' && scope.isSelectionPolygonClosed()) {
								selection_polygon.pop();
								let min_x = Infinity, min_y = Infinity, max_x = 0, max_y = 0;
								for (let point of selection_polygon) {
									min_x = Math.min(point[0], min_x);
									min_y = Math.min(point[1], min_y);
									max_x = Math.max(point[0], max_x);
									max_y = Math.max(point[1], max_y);
								}
								min_x = Math.clamp(min_x, 0, UVEditor.texture.img.naturalWidth);
								min_y = Math.clamp(min_y, 0, UVEditor.texture.img.naturalHeight);
								max_x = Math.clamp(max_x, 0, UVEditor.texture.img.naturalWidth);
								max_y = Math.clamp(max_y, 0, UVEditor.texture.img.naturalHeight);
								for (let x = Math.floor(min_x); x < max_x; x++) {
									for (let y = Math.floor(min_y); y < max_y; y++) {
										let is_inside = pointInPolygon([x+0.5, y+0.5], selection_polygon);
										if (!is_inside) continue;
										switch (op_mode) {
											case 'create': case 'add': {
												texture.selection.set(x, y, 1);
												break;
											}
											case 'subtract': {
												texture.selection.set(x, y, 0);
												break;
											}
											case 'intersect': {
												if (texture.selection.get(x, y)) {
													texture.selection.set(x, y, 2);
												}
												break;
											}
										}
									}
								}
								selection_polygon.empty();
							}
							if (op_mode == 'intersect') {
								for (let x = 0; x < texture.width; x++) {
									for (let y = 0; y < texture.height; y++) {
										let val = texture.selection.getDirect(x, y);
										if (val == 2) {
											texture.selection.set(x, y, 1);
										} else if (val == 1) {
											texture.selection.set(x, y, 0);
										}
									}
								}
							}
							if (!texture.selection.hasSelection()) {
								texture.selection.clear();
							}
							Undo.finishSelection('Select texture area');
							UVEditor.updateSelectionOutline();
							Interface.addSuggestedModifierKey('alt', 'modifier_actions.drag_to_duplicate');

						} else if (!started_movement) {
							if (TextureLayer.selected?.in_limbo) {
								TextureLayer.selected.resolveLimbo();
							}
							if (Toolbox.selected.id == 'move_layer_tool') {
								// select
								let layers_reverse = texture.layers.slice().reverse();
								for (let layer of layers_reverse) {
									let {offset} = layer;
									if (x >= offset[0] && y >= offset[1] && x < offset[0] + layer.width && y < offset[1] + layer.height) {
										let data = layer.ctx.getImageData(x - offset[0], y - offset[1], 1, 1);
										if (data.data[3] > 10) {
											layer.select();
											break;
										}
									}
								}
							}
						} else {
							texture.updateLayerChanges(true);
							texture.saved = false;
							Undo.finishEdit('Move layer');
						}
					}
					addEventListeners(document, 'pointermove', drag);
					addEventListeners(document, 'pointerup', stop);
				},
				resizeLayer(event, dir_x, dir_y) {
					if (event.which == 2 || event.which == 3 || !this.texture || !this.layer) return;
					convertTouchEvent(event);
					let layer = this.layer;
					event.stopPropagation();

					Undo.initEdit({layers: [layer]});

					let target_size = [layer.scaled_width, layer.scaled_height];
					let last_target_size = [layer.scaled_width, layer.scaled_height];
					let initial_size = [layer.width, layer.height];
					if (dir_x && dir_y) Interface.addSuggestedModifierKey('alt', 'modifier_actions.no_uniform_scaling');
					this.drag({
						event,
						onDrag: (x, y, e1) => {
							last_target_size.replace(target_size);
							target_size[0] = Math.max(target_size[0] + (x * dir_x), 0);
							target_size[1] = Math.max(target_size[1] + (y * dir_y), 0);
							if (!(e1.ctrlOrCmd || Pressing.overrides.ctrl) && dir_x && dir_y) {
								target_size[1] = Math.round(target_size[0] * (initial_size[1] / initial_size[0]));
							}
							x = target_size[0] - last_target_size[0];
							y = target_size[1] - last_target_size[1];
							if (dir_x == -1) layer.offset[0] -= x;
							if (dir_y == -1) layer.offset[1] -= y;

							layer.scale[0] = target_size[0] / initial_size[0];
							layer.scale[1] = target_size[1] / initial_size[1];
							Blockbench.setCursorTooltip(`${target_size[0]} x ${target_size[1]}\n${Math.round(layer.scale[0] * 100)}% x ${Math.round(layer.scale[1] * 100)}%`);
							this.texture.updateLayerChanges();
							UVEditor.vue.$forceUpdate();

							return [x * dir_x, y * dir_y];
						},
						onEnd: () => {
							Undo.finishEdit('Resize layer');
							Blockbench.setCursorTooltip();
							if (dir_x && dir_y) Interface.removeSuggestedModifierKey('alt', 'modifier_actions.no_uniform_scaling');
						},
						snap: 1,
						uv_grid: false
					})
				},
				getUVSelectionFrameStyle() {
					let box = this.getSelectedUVBoundingBox();
					if (!box) return {};
					return {
						left: this.toPixels(box[0], 0),
						top: this.toPixels(box[1], 0),
						width: this.toPixels(box[2] - box[0], 0),
						height: this.toPixels(box[3] - box[1], 0),
					};
				},
				focusOnSelection(event) {
					UVEditor.focusOnSelection(event);
				},
				showTransparentFaceText() {
					return UVEditor.getSelectedFaces(this.mappable_elements[0]).length;
				},
				isFaceSelected(element, fkey) {
					if (!element) element = this.mappable_elements[0];
					return UVEditor.getSelectedFaces(element).indexOf(fkey) != -1;
				},
				isTransformingLayer() {
					if (!this.texture || !this.texture.selected_layer) return false;
					let tool = Toolbox.selected;
					if (tool.id == 'move_layer_tool' || (tool.id == 'selection_tool' && settings.move_with_selection_tool.value && TextureLayer.selected?.in_limbo)) {
						return true;
					}
					return false;
				},
				getLinePreviewAngle() {
					let angle = Math.atan2(this.last_brush_position[1] - this.mouse_coords.y, this.last_brush_position[0] - this.mouse_coords.x);
					return Math.radToDeg(angle);
				},
				getLinePreviewStyle() {
					let tex = this.texture;
					let pixel_size = this.inner_width / (tex ? tex.width : Project.texture_width);
					let width = Math.sqrt(Math.pow(this.mouse_coords.x - this.last_brush_position[0], 2) + Math.pow(this.mouse_coords.y - this.last_brush_position[1], 2));
					let angle = this.getLinePreviewAngle();
					return {
						width: width * pixel_size + 'px',
						rotate: angle + 'deg'
					};
				},
				getBrushPositionText() {
					if (!this.mouse_coords.active) return '';
					let string = trimFloatNumber(this.mouse_coords.x, 1) + ', ' + trimFloatNumber(this.mouse_coords.y, 1);
					if (this.mouse_coords.line_preview) {
						let angle = this.getLinePreviewAngle();
						angle = (angle + 180) % 90;
						string += `, ${trimFloatNumber(Math.roundTo(angle, 1))}°`;
					}
					return string;
				},

				checkFormat(values) {
					for (let key in values) {
						if (Format[key] != values[key]) return false;
					}
					return true;
				},
				toggleFaceEnabled(key, event) {
					let value = this.mappable_elements[0].faces[key].texture === null;
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					UVEditor.forCubes(obj => {
						UVEditor.getFaces(obj, event).forEach(function(side) {
							if (value) {
								if (obj.faces[side].texture === null) obj.faces[side].texture = false;
							} else {
								obj.faces[side].texture = null;
							}
						})
						obj.preview_controller.updateFaces(obj);
					})
					UVEditor.loadData()
					Undo.finishEdit('Toggle face')
					Canvas.updateSelectedFaces()
				},
				openFaceTextureMenu(event) {
					let menu = new Menu(Texture.all.map(tex => {
						return {
							name: tex.name,
							icon: tex.img,
							marked: tex == UVEditor.texture,
							click(event) {
								UVEditor.applyTexture(tex);
							}
						}
					}))
					menu.open(event.target);
				},
				toggleFaceTint(key, event) {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					let value = UVEditor.getFirstMappableElement()?.faces[key]?.tint === -1 ? 0 : -1;
					UVEditor.forCubes(cube => {
						cube.faces[key].tint = value;
					})
					this.$forceUpdate();
					Undo.finishEdit('Toggle face tint')
				},
				changeFaceTint(key, event) {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					let value = parseInt(event.target.value);
					UVEditor.forCubes(cube => {
						cube.faces[key].tint = value;
					})					
					Undo.finishEdit('Set face tint');
				},
				setCullface(key, value) {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					UVEditor.forCubes(obj => {
						if (obj.faces[key]) {
							obj.faces[key].cullface = value;
						}
					})
					Undo.finishEdit(value ? `Set cullface to ${value}` : 'Disable cullface');
				},
				startInputMaterialInstance(event) {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
				},
				endInputMaterialInstance(event, fkey) {
					let value = this.mappable_elements[0]?.faces[fkey]?.material_name;
					if (typeof value == 'string') {
						for (let element of this.mappable_elements) {
							if (element.faces[fkey]) {
								element.faces[fkey].material_name = value;
							}
						}
					}
					Undo.finishEdit('Change material instances');
				},
				showInfoBox(title, text) {
					Blockbench.showMessageBox({
						title: tl(title),
						message: tl(text),
						icon: 'info'
					})
				}
			},
			template: `
				<div class="UVEditor" ref="main" :class="{checkerboard_trigger: checkerboard}" id="UVEditor">

					<div class="bar next_to_title" id="uv_title_bar">
						<div id="uv_resolution_status" @click="projectResolution()">
							{{ uv_resolution[0] + ' ⨉ ' + uv_resolution[1] }}
						</div>
					</div>

					<div class="bar" id="uv_cube_face_bar" ref="uv_cube_face_bar" v-if="mode == 'uv' && mappable_elements[0] && mappable_elements[0].type == 'cube' && !box_uv">
						<li v-for="(face, key) in mappable_elements[0].faces" :face="key"
							:class="{selected: isFaceSelected(null, key), disabled: mappable_elements[0].faces[key].texture === null}"
							@mousedown="selectFace(null, key, $event, false, true)"
						>
							{{ face_names[key] }}
						</li>
						<li @click="mode = 'face_properties'" class="tool face_properties_toggle">
							<div class="tooltip">${tl('uv_editor.face_properties')}</div>
							<i class="material-icons">checklist</i>
						</li>
					</div>


					<div id="uv_face_properties" v-if="mode === 'face_properties'">
						<div class="bar" id="face_properties_header_bar">
							<li></li>
							<li @click="mode = 'uv'" class="tool face_properties_toggle">
								<i class="material-icons">clear</i>
							</li>
						</div>

						<div class="uv_face_properties_labels">
								
							<label style="width: 76px;">Enabled</label>

							<label style="width: 120px;" class="flexible">Texture</label>

							<template v-if="checkFormat({java_face_properties: true})">
								<label style="width: 58px;" @click="showInfoBox('action.face_tint', 'uv_editor.tint.info')" title="${tl('uv_editor.tint.info')}">
									${tl('action.face_tint')}
									<i class="material-icons">info</i>
								</label>
							</template>

							<template v-if="checkFormat({cullfaces: true})">
								<label style="width: 50px;" @click="showInfoBox('action.cullface', 'uv_editor.cullface.info')" title="${tl('uv_editor.cullface.info')}" class="flexible">
									${tl('action.cullface')}
									<i class="material-icons">info</i>
								</label>
							</template>

							<template v-if="checkFormat({id: 'bedrock_block'})">
								<label style="width: 100px;" class="flexible" @click="showInfoBox('uv_editor.face_properties.material_instance', 'uv_editor.material_instance.info')" title="${tl('uv_editor.material_instance.info')}">
									${tl('uv_editor.face_properties.material_instance')}
									<i class="material-icons">info</i>
								</label>
							</template>
						</div>


						<ul v-if="mappable_elements[0] && mappable_elements[0].type == 'cube'">
							<li v-for="(face, key) in mappable_elements[0].faces" :face="key"
								class="uv_face_properties_line"
								:class="{selected: isFaceSelected(mappable_elements[0], key), disabled: mappable_elements[0].faces[key].texture === null}"
								@mousedown="selectFace(mappable_elements[0], key, $event, false, true)"
							>
								
								<input type="checkbox" :checked="mappable_elements[0].faces[key].texture !== null" @change="toggleFaceEnabled(key, $event)">

								<label>{{ face_names[key] }}</label>

								<div class="face_properties_texture" :face_texture="face_texture = mappable_elements[0].faces[key].getTexture()" @click="openFaceTextureMenu($event)">
									<img :src="face_texture.source" class="texture_icon" width="32px" height="32px" alt="" v-if="face_texture && face_texture.show_icon" />
									<div class="texture_dummy_icon" v-else></div>
									{{ face_texture ? face_texture.name : '${tl('menu.cube.texture.blank')}' }}
								</div>

								<template v-if="checkFormat({java_face_properties: true})">
									<div style="width: 58px; display: flex;">
										<input type="checkbox" title="${tl('action.face_tint')}" :checked="mappable_elements[0].faces[key].tint > -1" @change="toggleFaceTint(key, $event)">
										<input type="number" title="${tl('action.face_tint')}" style="width: 30px;" :value="mappable_elements[0].faces[key].tint" min="0" step="1" @input="changeFaceTint(key, $event)" v-if="mappable_elements[0].faces[key].tint > -1">
									</div>
								</template>

								<template v-if="checkFormat({cullfaces: true})">
									<select-input class="flexible" title="${tl('action.cullface')}" :value="mappable_elements[0].faces[key].cullface" @input="setCullface(key, $event)" :options="cullface_options" />
								</template>

								<template v-if="checkFormat({id: 'bedrock_block'})">
									<input type="text" style="width: 100px;" class="flexible dark_bordered"
										title="${tl('uv_editor.face_properties.material_instance')}"
										v-model="mappable_elements[0].faces[key].material_name"
										@focus="startInputMaterialInstance($event)"
										@focusout="endInputMaterialInstance($event, key)"
									>
								</template>
							</li>
						</ul>
					</div>


					<div id="uv_viewport"
						@contextmenu="contextMenu($event)"
						@mousedown="onMouseDown($event)"
						@touchstart="onMouseDown($event)"
						@wheel="onMouseWheel($event)"
						@scroll="onScroll($event)"
						@mousemove="updateMouseCoords($event)"
						@mouseenter="onMouseEnter($event)"
						@mouseleave="onMouseLeave($event)"
						class="checkerboard_target"
						:class="{tiled_mode: overlay_canvas_mode == 'tiled'}"
						ref="viewport"
						v-if="!hidden && mode !== 'face_properties'"
						:style="{width: (width+8) + 'px', height: (height+8) + 'px', overflowX: (zoom > 1) ? 'scroll' : 'hidden', overflowY: (inner_height > height) ? 'scroll' : 'hidden'}"
					>

						<div id="uv_frame" ref="frame"
							v-if="texture !== null"
							@click.stop="reverseSelect($event)"
							:class="{overlay_mode: uv_overlay && mode == 'paint'}"
							:style="{width: inner_width + 'px', height: inner_height + 'px', margin: getFrameMargin(true), '--inner-width': inner_width + 'px', '--inner-height': inner_height + 'px'}"
						>
							<div id="uv_frame_spacer" :style="{left: (inner_width+getFrameMargin()[0])+'px', top: (inner_height+getFrameMargin()[1])+'px'}"></div>

							<template v-for="element in getDisplayedUVElements()">

								<template v-if="element.type == 'cube' && !element.box_uv">
									<div class="cube_uv_face uv_face"
										v-for="(face, key) in element.faces" :key="element.uuid + ':' + key"
										v-if="(face.getTexture() == texture || texture == 0) && face.texture !== null && (display_uv !== 'selected_faces' || isFaceSelected(element, key))"
										:title="face_names[key]"
										:class="{selected: isFaceSelected(element, key), unselected: display_uv === 'all_elements' && !mappable_elements.includes(element)}"
										@mousedown.prevent="dragFace(element, key, $event)"
										@touchstart.prevent="dragFace(element, key, $event)"
										@contextmenu="selectFace(element, key, $event, true, false)"
										:style="{
											left: toPixels(Math.min(face.uv[0], face.uv[2]), -1),
											top: toPixels(Math.min(face.uv[1], face.uv[3]), -1),
											'--width': toPixels(Math.abs(face.uv_size[0]), 2),
											'--height': toPixels(Math.abs(face.uv_size[1]), 2),
										}"
									>
										<template v-if="isFaceSelected(element, key) && mode == 'uv' && !(display_uv === 'all_elements' && !mappable_elements.includes(element))">
											{{ face_names[key] || '' }}
											<div class="uv_resize_side horizontal" @mousedown="resizeFace(key, $event, 0, -1)" @touchstart.prevent="resizeFace(key, $event, 0, -1)" style="width: var(--width)"></div>
											<div class="uv_resize_side horizontal" @mousedown="resizeFace(key, $event, 0, 1)" @touchstart.prevent="resizeFace(key, $event, 0, 1)" style="top: var(--height); width: var(--width)"></div>
											<div class="uv_resize_side vertical" @mousedown="resizeFace(key, $event, -1, 0)" @touchstart.prevent="resizeFace(key, $event, -1, 0)" style="height: var(--height)"></div>
											<div class="uv_resize_side vertical" @mousedown="resizeFace(key, $event, 1, 0)" @touchstart.prevent="resizeFace(key, $event, 1, 0)" style="left: var(--width); height: var(--height)"></div>
											<div class="uv_resize_corner uv_c_nw" :class="{main_corner: !face.rotation}" @mousedown="resizeFace(key, $event, -1, -1)" @touchstart.prevent="resizeFace(key, $event, -1, -1)" style="left: 0; top: 0">
												<div class="uv_rotate_field" v-if="cube_uv_rotation && face.rotation == 0" @mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"></div>
											</div>
											<div class="uv_resize_corner uv_c_ne" :class="{main_corner: face.rotation == 270}" @mousedown="resizeFace(key, $event, 1, -1)" @touchstart.prevent="resizeFace(key, $event, 1, -1)" style="left: var(--width); top: 0">
												<div class="uv_rotate_field" v-if="cube_uv_rotation && face.rotation == 270" @mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"></div>
											</div>
											<div class="uv_resize_corner uv_c_sw" :class="{main_corner: face.rotation == 90}" @mousedown="resizeFace(key, $event, -1, 1)" @touchstart.prevent="resizeFace(key, $event, -1, 1)" style="left: 0; top: var(--height)">
												<div class="uv_rotate_field" v-if="cube_uv_rotation && face.rotation == 90" @mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"></div>
											</div>
											<div class="uv_resize_corner uv_c_se" :class="{main_corner: face.rotation == 180}" @mousedown="resizeFace(key, $event, 1, 1)" @touchstart.prevent="resizeFace(key, $event, 1, 1)" style="left: var(--width); top: var(--height)">
												<div class="uv_rotate_field" v-if="cube_uv_rotation && face.rotation == 180" @mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"></div>
											</div>
										</template>
									</div>
								</template>
								
								<div v-else-if="element.type == 'cube'" class="cube_box_uv uv_face"
									:key="element.uuid"
									@mousedown.prevent="dragFace(element, null, $event)"
									@touchstart.prevent="dragFace(element, null, $event)"
									@click.prevent="selectCube(element, $event)"
									:class="{unselected: display_uv === 'all_elements' && !mappable_elements.includes(element)}"
									:style="{left: toPixels(element.uv_offset[0]), top: toPixels(element.uv_offset[1])}"
								>
									<div class="uv_fill" v-if="element.size(1, 'box_uv') > 0" :style="{left: '-1px', top: toPixels(element.size(2, 'box_uv'), -1), width: toPixels(element.size(2, 'box_uv')*2 + element.size(0, 'box_uv')*2, 2), height: toPixels(element.size(1, 'box_uv'), 2)}" />
									<div class="uv_fill" v-if="element.size(0, 'box_uv') > 0" :style="{left: toPixels(element.size(2, 'box_uv'), -1), top: '-1px', width: toPixels(element.size(0, 'box_uv')*2, 2), height: toPixels(element.size(2, 'box_uv'), 2), borderBottom: element.size(1, 'box_uv') > 0 ? 'none' : undefined}" />
									<div :style="{left: toPixels(element.size(2, 'box_uv'), -1), top: element.size(0, 'box_uv') > 0 ? '-1px' : toPixels(element.size(2, 'box_uv'), -1), width: toPixels(element.size(0, 'box_uv'), 2), height: toPixels( (element.size(0, 'box_uv') > 0 ? element.size(2, 'box_uv') : 0) + element.size(1, 'box_uv'), 2), borderRight: element.size(0, 'box_uv') == 0 ? 'none' : undefined}" />
									<div v-if="element.size(1, 'box_uv') > 0 && element.size(0, 'box_uv') > 0" :style="{left: toPixels(element.size(2, 'box_uv')*2 + element.size(0, 'box_uv'), -1), top: toPixels(element.size(2, 'box_uv'), -1), width: toPixels(element.size(0, 'box_uv'), 2), height: toPixels(element.size(1, 'box_uv'), 2)}" />
								</div>

								<template v-if="element.type == 'mesh'">
									<div class="mesh_uv_face uv_face"
										v-for="(face, key) in filterMeshFaces(element)" :key="element.uuid + ':' + key"
										v-if="face.vertices.length > 2 && (display_uv !== 'selected_faces' || isFaceSelected(element, key)) && face.getTexture() == texture"
										:class="{selected: isFaceSelected(element, key)}"
										@mousedown.prevent="dragFace(element, key, $event)"
										@touchstart.prevent="dragFace(element, key, $event)"
										:style="{
											left: toPixels(getMeshFaceCorner(face, 0), -1),
											top: toPixels(getMeshFaceCorner(face, 1), -1),
											width: toPixels(getMeshFaceWidth(face, 0), 2),
											height: toPixels(getMeshFaceWidth(face, 1), 2),
										}"
									>
										<svg>
											<polygon :points="getMeshFaceOutline(face)" />
										</svg>
										<template v-if="isFaceSelected(element, key) && mode == 'uv'">
											<div class="uv_mesh_vertex" v-for="(key, index) in face.vertices"
												:class="{main_corner: index == 0, selected: element.getSelectedVertices().includes(key)}"
												@mousedown.prevent.stop="dragVertices(element, key, $event)" @touchstart.prevent.stop="dragVertices(element, key, $event)"
												:style="{left: toPixels( face.uv[key][0] - getMeshFaceCorner(face, 0) ), top: toPixels( face.uv[key][1] - getMeshFaceCorner(face, 1) )}"
											>
											</div>
										</template>
									</div>
								</template>

							</template>

							<div id="uv_selection_frame" v-if="mode == 'uv' && isScalingAvailable()" :style="getUVSelectionFrameStyle()">
								<div id="uv_rotate_handle" v-if="isRotatingAvailable()"
									@mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"
									:title="tl('uv_editor.rotate_uv')"
								>
									<i class="material-icons">rotate_right</i>
								</div>
								
								<div id="uv_scale_handle" v-if="isScalingAvailable()"
									@mousedown.stop="scaleFaces($event)" @touchstart.prevent.stop="scaleFaces($event)"
									:title="tl('uv_editor.scale_uv')"
								>
									<i class="fa fa-solid fa-square-up-right"></i>
								</div>
							</div>

							<div class="selection_rectangle"
								v-if="selection_rect.active"
								:style="{
									left: toPixels(selection_rect.pos_x),
									top: toPixels(selection_rect.pos_y),
									width: toPixels(selection_rect.width),
									height: toPixels(selection_rect.height),
								}">
							</div>
							

							<div v-if="helper_lines.x >= 0" class="uv_helper_line_x" :style="{left: toPixels(helper_lines.x)}"></div>
							<div v-if="helper_lines.y >= 0" class="uv_helper_line_y" :style="{top: toPixels(helper_lines.y)}"></div>

							<div id="uv_brush_outline" v-if="mode == 'paint' && mouse_coords.active" :class="brush_type" :style="getBrushOutlineStyle()">
								<div v-if="mouse_coords.line_preview" id="uv_brush_line_preview" :style="getLinePreviewStyle()"></div>
							</div>

							<div id="uv_copy_brush_outline" v-if="copy_brush_source && texture && texture.uuid == copy_brush_source.texture" :style="getCopyBrushOutlineStyle()"></div>

							<div ref="texture_canvas_wrapper" id="texture_canvas_wrapper" :key="'texture_canvas_wrapper'" v-show="texture && texture.error != 1"></div>
							<img style="object-fit: fill; opacity: 0.02; mix-blend-mode: screen;" v-if="texture == 0 && !box_uv" src="./assets/missing_blend.png">

							<svg id="uv_texture_grid" v-if="pixel_grid && mode == 'paint' && texture && texture.width">
								<path :d="textureGrid" :style="{strokeWidth: textureGridStroke}" />
								<path :d="textureGridBold" class="bold_grid" />
							</svg>

							<div class="uv_layer_transform_handles"
								v-if="isTransformingLayer()"
								:style="{
									left: toTexturePixels(layer.offset[0], 0, 0),
									top: toTexturePixels(layer.offset[1], 1, 0),
									width: toTexturePixels(layer.scaled_width, 2, 0),
									height: toTexturePixels(layer.scaled_height, 3, 0),
								}"
							>
								<div class="uv_resize_corner uv_c_nw" @mousedown="resizeLayer($event, -1, -1)" @touchstart.prevent="resizeLayer($event, -1, -1)" style="left: 0; top: 0;" />
								<div class="uv_resize_corner uv_c_ne" @mousedown="resizeLayer($event, 1, -1)" @touchstart.prevent="resizeLayer($event, 1, -1)" style="right: 0; top: 0;" />
								<div class="uv_resize_corner uv_c_sw" @mousedown="resizeLayer($event, -1, 1)" @touchstart.prevent="resizeLayer($event, -1, 1)" style="left: 0; bottom: 0;" />
								<div class="uv_resize_corner uv_c_se" @mousedown="resizeLayer($event, 1, 1)" @touchstart.prevent="resizeLayer($event, 1, 1)" style="right: 0; bottom: 0;" />

								<div class="uv_resize_corner uv_c_n" @mousedown="resizeLayer($event, 0, -1)" @touchstart.prevent="resizeLayer($event, 0, -1)" style="top: 0; left: 50%;" />
								<div class="uv_resize_corner uv_c_s" @mousedown="resizeLayer($event, 0, 1)" @touchstart.prevent="resizeLayer($event, 0, 1)" style="bottom: 0; left: 50%;" />
								<div class="uv_resize_corner uv_c_w" @mousedown="resizeLayer($event, -1, 0)" @touchstart.prevent="resizeLayer($event, -1, 0)" style="left: 0; top: 50%;" />
								<div class="uv_resize_corner uv_c_e" @mousedown="resizeLayer($event, 1, 0)" @touchstart.prevent="resizeLayer($event, 1, 0)" style="right: 0; top: 50%;" />
							</div>

							<div id="texture_selection_rect"
								v-if="texture_selection_rect.active"
								:class="{ellipse: texture_selection_rect.ellipse}"
								:style="{
									left: toTexturePixels(texture_selection_rect.pos_x, 0, 0),
									top: toTexturePixels(texture_selection_rect.pos_y, 1, 0),
									width: toTexturePixels(texture_selection_rect.width, 2, 0),
									height: toTexturePixels(texture_selection_rect.height, 3, 0),
								}">
							</div>

							<svg id="texture_selection_polygon" v-if="texture_selection_polygon.length">
								<path :d="getTextureSelectionPolygon()" />
								<circle :cx="texture_selection_polygon[0][0] / texture.width * inner_width + 1" :cy="texture_selection_polygon[0][1] / texture.width * inner_width + 1" r="7" :class="{closed: isSelectionPolygonClosed()}" />
							</svg>

							<svg id="uv_selection_outline" v-if="mode == 'paint'">
								<path :d="selection_outline" />
								<path :d="selection_outline" class="dash_overlay" />
							</svg>
						</div>

						<div class="uv_navigator" @click="focusOnSelection($event)" v-show="mode == 'uv'">
							<i class="material-icons icon">navigation</i>
						</div>

						<div class="uv_transparent_face" v-if="showTransparentFaceText()">${tl('uv_editor.transparent_face')}</div>
					</div>

					<div class="uv_layer_limbo_options" v-if="isTransformingLayer()">
						<template v-if="texture && layer && layer.in_limbo">
							<button @click="layer.resolveLimbo(true)">${tl('uv_editor.copy_paste_tool.to_layer')}</button>
							<button @click="layer.resolveLimbo(false)">${tl('uv_editor.copy_paste_tool.place')}</button>
						</template>
						<button v-else-if="layer.scale[0] != 1 || layer.scale[1] != 1" @click="layer.resolveLimbo(true)">${tl('dialog.scale.confirm')}</button>
					</div>

					<div v-show="mode == 'paint'" class="bar uv_painter_info">
						<div v-if="texture && layer && layer.in_limbo" ref="copy_paste_tool_control" class="copy_paste_tool_control">
							<div class="tool button_mirror_x" @click="layer.flip(0)"><div class="tooltip">${tl('uv_editor.copy_paste_tool.mirror_x')}</div><i class="icon-mirror_x icon"></i></div>
							<div class="tool button_mirror_y" @click="layer.flip(1)"><div class="tooltip">${tl('uv_editor.copy_paste_tool.mirror_y')}</div><i class="icon-mirror_y icon"></i></div>
							<div class="tool button_rotate" @click="layer.rotate(90)"><div class="tooltip">${tl('uv_editor.copy_paste_tool.rotate')}</div><i class="material-icons">rotate_right</i></div>
						</div>

						<template v-else>
							<span style="color: var(--color-subtle_text);">{{ getBrushPositionText() }}</span>
							<span v-if="texture" class="uv_panel_texture_name" @click="selectTextureMenu($event)">{{ texture.name }}</span>
							<span style="color: var(--color-subtle_text);">{{ Math.round(this.zoom*100).toString() + '%' }}</span>
						</template>

						<div id="toggle_uv_overlay_anchor"></div>
					</div>

					<div :class="{joined_uv_bar: width >= 720}" ref="uv_toolbars">
						<div v-show="mode == 'uv'" class="bar uv_editor_sliders" ref="slider_bar" style="margin-left: 2px;"></div>
						<div v-show="mode == 'uv'" class="toolbar_wrapper uv_editor"></div>
					</div>
				</div>
			`
		}
	})
	UVEditor.panel.on('move_to', (data) => {
		if (!Blockbench.isMobile) {
			UVEditor.saveViewportOffset();
		}
	})
	UVEditor.panel.on('moved_to', (data) => {
		Vue.nextTick(() => {
			UVEditor.loadViewportOffset();
		})
	})

	Blockbench.on('update_pressed_modifier_keys', ({before, now}) => {
		if (before.shift != now.shift && document.querySelector('#uv_viewport:hover')) {
			let active = now.shift;
			if (Painter.current.x == undefined) active = false;
			UVEditor.vue.mouse_coords.line_preview = active;
		}
	});

	Toolbars.uv_editor.toPlace()

	BarItems.paint_mode_uv_overlay.toElement('#toggle_uv_overlay_anchor');
	BarItems.edit_mode_uv_overlay.toElement('#toggle_edit_uv_overlay_anchor');

	let {slider_bar} = UVEditor.vue.$refs;

	var onBefore = function() {
		Undo.initEdit({elements: UVEditor.getMappableElements()})
	}
	var onAfter = function() {
		Undo.finishEdit('Edit UV')
	}
	var getInterval = function(event) {
		if (UVEditor.isBoxUV()) {
			return 1;
		} else {
			return canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl) / UVEditor.grid;
		}
	}
	function getPos(axis) {
		let elements = UVEditor.getMappableElements();
		if (!elements[0]) return 0;

		if (UVEditor.isBoxUV() && elements[0] instanceof Cube) {
			return trimFloatNumber(elements[0].uv_offset[axis])
		} else if (elements[0] instanceof Cube) {
			var face = UVEditor.getReferenceFace();
			if (face) {
				return trimFloatNumber(face.uv[axis])
			}
		} else if (elements[0] instanceof Mesh) {
			let selected_vertices = elements[0].getSelectedVertices();

			if (selected_vertices.length) {
				let min = Infinity;
				UVEditor.getSelectedFaces(elements[0]).forEach(fkey => {
					let face = elements[0].faces[fkey];
					face.vertices.forEach(vkey => {
						if (selected_vertices.includes(vkey) && face.uv[vkey]) {
							min = Math.min(min, face.uv[vkey][axis]);
						}
					})
				})
				if (min == Infinity) min = 0;
				return trimFloatNumber(min);

			} else {
				let face = UVEditor.getReferenceFace();
				if (!face) return 0;
				let min = Infinity;
				face.vertices.forEach(vkey => {
					if (face.uv[vkey]) {
						min = Math.min(min, face.uv[vkey][axis]);
					}
				})
				if (min == Infinity) min = 0;
				return trimFloatNumber(min)
			}
		}
		return 0
	}
	UVEditor.sliders.pos_x = new NumSlider({
		id: 'uv_slider_pos_x',
		private: true,
		condition: () => UVEditor.hasElements() && (UVEditor.getReferenceFace() || UVEditor.isBoxUV()),
		get: function() {
			return getPos(0);
		},
		change: function(modify) {
			UVEditor.slidePos(modify, 0);
		},
		getInterval,
		onBefore,
		onAfter
	}).toElement(slider_bar);

	UVEditor.sliders.pos_y = new NumSlider({
		id: 'uv_slider_pos_y',
		private: true,
		condition: () => UVEditor.hasElements() && (UVEditor.getReferenceFace() || UVEditor.isBoxUV()),
		get: function() {
			return getPos(1);
		},
		change: function(modify) {
			UVEditor.slidePos(modify, 1);
		},
		getInterval,
		onBefore,
		onAfter
	}).toElement(slider_bar);

	UVEditor.sliders.size_x = new NumSlider({
		id: 'uv_slider_size_x',
		private: true,
		condition: () => (UVEditor.hasElements() && UVEditor.isFaceUV() && UVEditor.getReferenceFace()),
		get: function() {
			if (UVEditor.isFaceUV()) {
				let ref_face = UVEditor.getReferenceFace();
				if (ref_face instanceof CubeFace) {
					return trimFloatNumber(ref_face.uv[2] - ref_face.uv[0]);
				} else if (ref_face instanceof MeshFace) {
					let rect = ref_face.getBoundingRect();
					return trimFloatNumber(rect.x);
				}
			}
			return 0
		},
		change: function(modify) {
			UVEditor.slideSize(modify, 0)
		},
		getInterval,
		onBefore,
		onAfter
	}).toElement(slider_bar);

	UVEditor.sliders.size_y = new NumSlider({
		id: 'uv_slider_size_y',
		private: true,
		condition: () => (UVEditor.hasElements() && UVEditor.isFaceUV() && UVEditor.getReferenceFace()),
		get: function() {
			if (UVEditor.isFaceUV()) {
				let ref_face = UVEditor.getReferenceFace();
				if (ref_face instanceof CubeFace) {
					return trimFloatNumber(ref_face.uv[3] - ref_face.uv[1]);
				} else if (ref_face instanceof MeshFace) {
					let rect = ref_face.getBoundingRect();
					return trimFloatNumber(rect.y);
				}
			}
			return 0
		},
		change: function(modify) {
			UVEditor.slideSize(modify, 1)
		},
		getInterval,
		onBefore,
		onAfter

	}).toElement(slider_bar);
	BarItems.edit_mode_uv_overlay.toElement(slider_bar);
})
