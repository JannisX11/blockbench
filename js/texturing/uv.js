const UVEditor = {
	face: 'north',
	size: 320,
	zoom: 1,
	grid: 1,
	auto_grid: true,
	panel: null,
	sliders: {},

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
		let pixel_size = this.inner_width / tex.width
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

		if (Toolbox.selected.id === 'copy_paste_tool') {
			if (settings.nearest_rectangle_select.value) {
				result.x = Math.round(mouse_coords[0]/pixel_size*1);
				result.y = Math.round(mouse_coords[1]/pixel_size*1);
			} else {
				result.x = Math.floor(mouse_coords[0]/pixel_size*1);
				result.y = Math.floor(mouse_coords[1]/pixel_size*1);
			}
		} else {
			let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0.5 : 0;
			result.x = mouse_coords[0]/pixel_size*1 + offset;
			result.y = mouse_coords[1]/pixel_size*1 + offset;
			if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
				result.x = Math.floor(result.x);
				result.y = Math.floor(result.y);
			}
		}
		if (tex.frameCount) result.y += (tex.height / tex.frameCount) * tex.currentFrame;
		if (!tex.frameCount && tex.ratio != Project.texture_width / Project.texture_height) result.y /= tex.ratio;
		return result;
	},
	startPaintTool(event) {
		delete Painter.current.face_matrices;
		delete Painter.current.element;

		var texture = this.getTexture()
		if (texture) {
			var coords = this.getBrushCoordinates(event, texture)

			if (Toolbox.selected.id !== 'copy_paste_tool') {
				Painter.startPaintTool(texture, coords.x, coords.y, undefined, event)
			} else {
				this.startSelection(coords.x, coords.y, event)
			}
		}
		if (Toolbox.selected.id !== 'color_picker' && Toolbox.selected.id !== 'copy_paste_tool' && texture) {
			addEventListeners(this.vue.$refs.frame, 'mousemove touchmove', UVEditor.movePaintTool, false );
			addEventListeners(document, 'mouseup touchend', UVEditor.stopBrush, false );
		}
	},
	movePaintTool(event) {
		var texture = UVEditor.getTexture()
		if (!texture) {
			Blockbench.showQuickMessage('message.untextured')
		} else if (event.which === 1 || (event.touches && event.touches.length == 1)) {
			var new_face;
			var {x, y} = UVEditor.getBrushCoordinates(event, texture);
			if (texture.img.naturalWidth + texture.img.naturalHeight == 0) return;

			if (x === Painter.current.x && y === Painter.current.y) {
				return
			}
			if (Painter.current.face !== UVEditor.selected_faces[0]) {
				Painter.current.x = x
				Painter.current.y = y
				Painter.current.face = UVEditor.selected_faces[0];
				new_face = true;
				if (texture !== Painter.current.texture && Undo.current_save) {
					Undo.current_save.addTexture(texture)
				}
			}
			if (Toolbox.selected.id !== 'copy_paste_tool') {
				Painter.movePaintTool(texture, x, y, event, new_face)
			}
		}
	},
	stopBrush(event) {
		removeEventListeners( UVEditor.vue.$refs.frame, 'mousemove touchmove', UVEditor.movePaintTool, false );
		removeEventListeners( document, 'mouseup touchend', UVEditor.stopBrush, false );
		if (Toolbox.selected.id !== 'copy_paste_tool') {
			Painter.stopPaintTool()
		} else {
			UVEditor.stopSelection()
		}
	},
	// Copy Paste Tool
	startSelection(x, y, event) {
		if (Painter.selection.overlay && event.target && event.target.id === 'uv_frame') {
			if (open_interface) {
				open_interface.confirm()
			} else {
				this.removePastingOverlay()
			}
		}
		delete Painter.selection.calcrect;
		if (!Painter.selection.overlay) {
			$(this.vue.$refs.frame).find('#texture_selection_rect').detach();
			let rect = document.createElement('div');
			rect.style.visibility = 'hidden';
			rect.id = 'texture_selection_rect';
			this.vue.$refs.frame.append(rect)
			Painter.selection.rect = rect;
			Painter.selection.start_x = Math.clamp(x, 0, UVEditor.texture ? UVEditor.texture.width : Project.texture_width);
			Painter.selection.start_y = Math.clamp(y, 0, UVEditor.texture ? UVEditor.texture.height : Project.texture_height);
			UVEditor.vue.copy_overlay.width = 0;
			UVEditor.vue.copy_overlay.height = 0;
		} else {
			Painter.selection.start_x = Painter.selection.x;
			Painter.selection.start_y = Painter.selection.y;
			Painter.selection.start_event = event;
		}

		function drag(e1) {
			let texture = UVEditor.texture;
			var {x, y} = UVEditor.getBrushCoordinates(e1, texture);
			if (texture.img.naturalWidth + texture.img.naturalHeight == 0) return;
			UVEditor.dragSelection(x, y, e1);
		}
		function stop() {
			removeEventListeners(document, 'mousemove touchmove', drag);
			removeEventListeners(document, 'mouseup touchend', stop);
			UVEditor.stopSelection();
		}
		addEventListeners(document, 'mousemove touchmove', drag);
		addEventListeners(document, 'mouseup touchend', stop);
	},
	dragSelection(x, y, event) {
		let m = UVEditor.inner_width / UVEditor.texture.width;

		if (!Painter.selection.overlay) {
			let {start_x, start_y} = Painter.selection;
			if (!settings.nearest_rectangle_select.value) {
				if (x >= Painter.selection.start_x) x++;
				if (y >= Painter.selection.start_y) y++;
				if (x < Painter.selection.start_x) start_x++;
				if (y < Painter.selection.start_y) start_y++;
			}
			if (x === Painter.current.x && y === Painter.current.y) return;
			Painter.current.x = x = Math.clamp(x, 0, UVEditor.texture.img.naturalWidth);
			Painter.current.y = y = Math.clamp(y, 0, UVEditor.texture.img.naturalHeight);
			
			let calcrect = getRectangle(start_x, start_y, x, y)
			if (!calcrect.x && !calcrect.y) return;
			UVEditor.vue.copy_overlay.state = 'select';
			Painter.selection.calcrect = calcrect;
			Painter.selection.x = calcrect.ax;
			Painter.selection.y = calcrect.ay;
			UVEditor.vue.copy_overlay.width = calcrect.x;
			UVEditor.vue.copy_overlay.height = calcrect.y;
			$(Painter.selection.rect)
				.css('left', 	calcrect.ax*m + 'px')
				.css('top', 	(calcrect.ay%UVEditor.texture.display_height)*m + 'px')
				.css('width', 	calcrect.x *m + 'px')
				.css('height', 	calcrect.y *m + 'px')
				.css('visibility', 'visible')

		} else if (UVEditor.texture && Painter.selection.canvas) {
			Painter.selection.x = Painter.selection.start_x + Math.round((event.clientX - Painter.selection.start_event.clientX) / m);
			Painter.selection.y = Painter.selection.start_y + Math.round((event.clientY - Painter.selection.start_event.clientY) / m);
			Painter.selection.x = Math.clamp(Painter.selection.x, 1-Painter.selection.canvas.width,  UVEditor.texture.width -1)
			Painter.selection.y = Math.clamp(Painter.selection.y, 1-Painter.selection.canvas.height, UVEditor.texture.height-1)
			UVEditor.updatePastingOverlay()
		}
	},
	stopSelection() {
		if (Painter.selection.rect) {
			Painter.selection.rect.remove()
		}
		if (Painter.selection.overlay || !Painter.selection.calcrect) return;
		UVEditor.vue.copy_overlay.state = 'off';
		if (Painter.selection.calcrect.x == 0 || Painter.selection.calcrect.y == 0) return;

		let calcrect = Painter.selection.calcrect;
		var canvas = document.createElement('canvas')
		var ctx = canvas.getContext('2d');
		canvas.width = calcrect.x;
		canvas.height = calcrect.y;
		ctx.drawImage(UVEditor.vue.texture.img, -calcrect.ax, -calcrect.ay)

		if (isApp) {
			let image = nativeImage.createFromDataURL(canvas.toDataURL())
			clipboard.writeImage(image)
		}
		Painter.selection.canvas = canvas;

		Painter.selection.move_mode = BarItems.copy_paste_tool_mode.value == 'move';
		if (Painter.selection.move_mode) {
			UVEditor.texture.edit((canvas) => {
				var ctx = canvas.getContext('2d');
				ctx.clearRect(Painter.selection.x, Painter.selection.y, Painter.selection.canvas.width, Painter.selection.canvas.height);
			}, {no_undo_finish: true});
		}

		UVEditor.addPastingOverlay();
	},
	addPastingOverlay() {
		if (Painter.selection.overlay) return;
		let scope = this;
		let overlay = $(Interface.createElement('div', {id: 'texture_pasting_overlay'}));
		UVEditor.vue.copy_overlay.state = 'move';

		open_interface = {
			confirm() {
				scope.removePastingOverlay()
				if (scope.texture) {
					scope.texture.edit((canvas) => {
						var ctx = canvas.getContext('2d');
						let y = (Painter.selection.y % scope.texture.display_height);
						if (scope.texture.frameCount > 1) y += scope.texture.currentFrame * scope.texture.display_height;
						ctx.drawImage(Painter.selection.canvas, Painter.selection.x, y)
					}, {no_undo_init: Painter.selection.move_mode})
				}
			},
			hide() {
				scope.removePastingOverlay()
			}
		}
		overlay.append(Painter.selection.canvas)
		Painter.selection.overlay = overlay;
		$(UVEditor.vue.$refs.frame).append(overlay)
		Painter.selection.x = Math.clamp(Painter.selection.x, 0, this.texture.width-Painter.selection.canvas.width)
		Painter.selection.y = Math.clamp(Painter.selection.y, 0, this.texture.height-Painter.selection.canvas.height)
		UVEditor.updatePastingOverlay()

		function clickElsewhere(event) {
			if (event.button == 1) return;
			if (!Painter.selection.overlay) {
				removeEventListeners(document, 'mousedown touchstart', clickElsewhere)
			} else if (Painter.selection.overlay.has(event.target).length == 0 && $(scope.vue.$refs.copy_paste_tool_control).has(event.target).length == 0) {
				open_interface.confirm()
			}
		}
		addEventListeners(document, 'mousedown touchstart', clickElsewhere)
	},
	removePastingOverlay() {
		Painter.selection.overlay.detach();
		UVEditor.vue.copy_overlay.state = 'off';
		delete Painter.selection.overlay;
		open_interface = false;
	},
	updatePastingOverlay() {
		let m = this.inner_width/this.texture.width
		$(Painter.selection.canvas)
			.css('width', Painter.selection.canvas.width * m)
			.css('height', Painter.selection.canvas.height * m)
		Painter.selection.overlay
			.css('left', Painter.selection.x * m)
			.css('top', (Painter.selection.y%this.texture.display_height) * m);
		return this;
	},
	focusOnSelection() {
		let min_x = Project.texture_width;
		let min_y = Project.texture_height;
		let max_x = 0;
		let max_y = 0;
		let elements = UVEditor.getMappableElements();
		elements.forEach(element => {
			if (element instanceof Cube && element.box_uv) {
				let size = element.size(undefined, true)
				min_x = Math.min(min_x, element.uv_offset[0]);
				min_y = Math.min(min_y, element.uv_offset[1]);
				max_x = Math.max(max_x, element.uv_offset[0] + (size[0] + size[2]) * 2);
				max_y = Math.max(max_y, element.uv_offset[1] + size[1] + size[2]);
			} else {
				for (let fkey in element.faces) {
					if (!UVEditor.selected_faces.includes(fkey)) continue;
					let face = element.faces[fkey];
					if (element instanceof Cube) {
						min_x = Math.min(min_x, face.uv[0], face.uv[2]);
						min_y = Math.min(min_y, face.uv[1], face.uv[3]);
						max_x = Math.max(max_x, face.uv[0], face.uv[2]);
						max_y = Math.max(max_y, face.uv[1], face.uv[3]);
					} else if (element instanceof Mesh) {
						face.vertices.forEach(vkey => {
							if (!face.uv[vkey]) return;
							min_x = Math.min(min_x, face.uv[vkey][0]);
							min_y = Math.min(min_y, face.uv[vkey][1]);
							max_x = Math.max(max_x, face.uv[vkey][0]);
							max_y = Math.max(max_y, face.uv[vkey][1]);
						})
					}
				}
			}
		})
		let pixel_size = UVEditor.getPixelSize();
		let focus = [min_x+max_x, min_y+max_y].map(v => v * 0.5 * pixel_size);
		let {viewport} = UVEditor.vue.$refs;
		let margin = UVEditor.vue.getFrameMargin();
		$(viewport).animate({
			scrollLeft: focus[0] + margin[0] - UVEditor.width / 2,
			scrollTop: focus[1] + margin[1] - UVEditor.height / 2,
		}, 100)
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
		return this.vue.selected_faces;
	},
	get texture() {
		return this.vue.texture;
	},
	getPixelSize() {
		if (UVEditor.isBoxUV()) {
			return this.inner_width/Project.texture_width
		} else {
			return this.inner_width/ (
				(typeof this.texture === 'object' && this.texture.width)
					? this.texture.width
					: Project.texture_width
			);
		}
	},
	getFaces(obj, event) {
		let available = Object.keys(obj.faces)
		if (event && event.shiftKey) {
			return available;
		} else {
			return UVEditor.vue.selected_faces.filter(key => available.includes(key));
		}
	},
	getReferenceFace() {
		let el = this.getMappableElements()[0];
		if (el) {
			for (let key in el.faces) {
				if (UVEditor.vue.selected_faces.includes(key)) {
					return el.faces[key];
				}
			}
		}
	},
	getMappableElements() {
		return Outliner.selected.filter(el => typeof el.faces == 'object');
	},
	getTexture() {
		if (Format.single_texture) return Texture.getDefault();
		return this.vue.texture;
	},
	isFaceUV() {
		return !Cube.selected.length || !Cube.selected.find(cube => cube.box_uv);
	},
	isBoxUV() {
		return Cube.selected.length ? !Cube.selected.find(cube => !cube.box_uv) : Project.box_uv;
	},
	//Set
	setZoom(zoom) {
		let max_zoom = Math.round((this.vue.texture ? this.vue.texture.height : Project.texture_width) * 32 / UVEditor.width);
		zoom = Math.clamp(zoom, UVEditor.height > 800 ? 0.2 : 0.5, Math.clamp(max_zoom, 16, 64))
		this.vue.zoom = zoom;
		Project.uv_viewport.zoom = this.zoom;
		Vue.nextTick(() => {
			if (Painter.selection.overlay) UVEditor.updatePastingOverlay()
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
	setFace(face, update = true) {
		this.vue.selected_faces.replace([face]);
		return this;
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
					face_matches.safePush(face);
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
					face_matches.safePush(fkey);
					break;
				}
			}
		})
		if (matches.length) {
			if (!event.shiftKey && !Pressing.overrides.shift && !event.ctrlOrCmd && !Pressing.overrides.ctrl) {
				Project.selected_elements.empty();
				UVEditor.vue.selected_faces.empty();
			}
			if (UVEditor.isFaceUV()) {
				UVEditor.vue.selected_faces.safePush(...face_matches);
			}
			matches.forEach(s => {
				Project.selected_elements.safePush(s)
			});
			if (!event.shiftKey) UVEditor.selectMeshUVIsland(UVEditor.selected_faces[0]);
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
		this.vue.updateTexture();
		this.displayTools();
		this.displayTools();
		this.vue.box_uv = UVEditor.isBoxUV();
		this.vue.$forceUpdate();
		return this;
	},
	applyTexture(texture) {
		let elements = this.getMappableElements();
		Undo.initEdit({elements, uv_only: true})
		elements.forEach(el => {
			this.vue.selected_faces.forEach(face => {
				if (el.faces[face]) {
					el.faces[face].texture = texture.uuid;
				}
			})
		})
		this.loadData()
		Canvas.updateSelectedFaces()
		Undo.finishEdit('Apply texture')
	},
	displayTools() {
		if (!this.getMappableElements().length) return;
		for (var id in UVEditor.sliders) {
			var slider = UVEditor.sliders[id];
			slider.node.style.setProperty('display', BARS.condition(slider.condition)?'block':'none');
			slider.update();
		}
		var face = Cube.selected[0] && this.selected_faces[0] && Cube.selected[0].faces[this.selected_faces[0]]
		if (face) {
			BarItems.uv_rotation.set((face && face.rotation)||0);
			if (Format.java_face_properties) {
				BarItems.cullface.set(face.cullface||'off')
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
				scope.selected_faces.forEach(fkey => {
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
				obj.uv_offset[axis] = value
			}
			obj.preview_controller.updateUV(obj);
		})
		Mesh.selected.forEach(mesh => {
			let selected_vertices = Project.selected_vertices[mesh.uuid];
			
			if (selected_vertices) {
				UVEditor.vue.selected_faces.forEach(fkey => {
					if (!mesh.faces[fkey]) return
					selected_vertices.forEach(vkey => {
						if (!mesh.faces[fkey].vertices.includes(vkey)) return;
						mesh.faces[fkey].uv[vkey][axis] = modify(mesh.faces[fkey].uv[vkey][axis]);
					})
				})
			} else {
				UVEditor.vue.selected_faces.forEach(fkey => {
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
				scope.selected_faces.forEach(fkey => {
					if (!cube.faces[fkey]) return;
					var uvTag = cube.faces[fkey].uv;
					var difference = modify(uvTag[axis+2]-uvTag[axis]) + uvTag[axis];
					uvTag[axis+2] = limitNumber(difference, 0, limit);
					Canvas.updateUV(cube);
				})
			}
		})
		Mesh.selected.forEach(mesh => {
			mesh.forAllFaces((face, fkey) => {
				if (!this.selected_faces.includes(fkey)) return;
				let rect = face.getBoundingRect();
				let start = (axis ? rect.ay : rect.ax);
				let size = (axis ? rect.y : rect.x);
				let multiplier = modify(size) / size;
				face.vertices.forEach(vkey => {
					if (!face.uv[vkey]) return;
					face.uv[vkey][axis] = (face.uv[vkey][axis] - start) * multiplier + start;
					if (isNaN(face.uv[vkey][axis])) face.uv[vkey][axis] = start;
				})
			})
		})
		this.displayTools()
		this.disableAutoUV()
		this.vue.$forceUpdate()
	},
	getResolution(axis, texture) {
		return axis ? Project.texture_height : Project.texture_width;
	},
	saveViewportOffset() {
		let uv_viewport = this.vue.$refs.viewport;
		if (!uv_viewport || !Project || Blockbench.hasFlag('switching_project')) return;
		Project.uv_viewport.offset[0] = (uv_viewport.scrollLeft - this.width/2) / this.vue.inner_width;
		Project.uv_viewport.offset[1] = (uv_viewport.scrollTop - this.height/2) / this.vue.inner_height;
	},
	loadViewportOffset() {
		let uv_viewport = this.vue.$refs.viewport;
		if (!uv_viewport) return;
		UVEditor.setZoom(Project.uv_viewport.zoom);
		Vue.nextTick(() => {
			uv_viewport.scrollLeft = Project.uv_viewport.offset[0] * this.vue.inner_width + this.width/2;
			uv_viewport.scrollTop = Project.uv_viewport.offset[1] * this.vue.inner_height + this.height/2;
		})
	},

	//Events
	selectAll() {
		let selected_before = this.vue.selected_faces.length;
		this.vue.mappable_elements.forEach(element => {
			for (let key in element.faces) {
				this.vue.selected_faces.safePush(key);
			}
		})
		if (selected_before == this.vue.selected_faces.length) {
			this.vue.selected_faces.empty();
		}
		UVEditor.displayTools();
	},
	selectMeshUVIsland(face_key) {
		if (face_key && Mesh.selected[0] && Mesh.selected[0].faces[face_key]) {
			if (UVEditor.selected_faces.length == 1) {
				let mesh = Mesh.selected[0];
				function crawl(face) {
					for (let i = 0; i < face.vertices.length; i++) {
						let adjacent = face.getAdjacentFace(i);
						if (!adjacent) continue;
						if (UVEditor.selected_faces.includes(adjacent.key)) continue;
						let epsilon = 0.2;
						let uv_a1 = adjacent.face.uv[adjacent.edge[0]];
						let uv_a2 = face.uv[adjacent.edge[0]];
						if (!Math.epsilon(uv_a1[0], uv_a2[0], epsilon) || !Math.epsilon(uv_a1[1], uv_a2[1], epsilon)) continue;
						let uv_b1 = adjacent.face.uv[adjacent.edge[1]];
						let uv_b2 = face.uv[adjacent.edge[1]];
						if (!Math.epsilon(uv_b1[0], uv_b2[0], epsilon) || !Math.epsilon(uv_b1[1], uv_b2[1], epsilon)) continue;
						UVEditor.selected_faces.push(adjacent.key);
						crawl(adjacent.face);
					}
				}
				crawl(mesh.faces[face_key]);
			} else {
				UVEditor.selected_faces.replace([face_key]);
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
		var state = Cube.selected[0].faces[this.selected_faces[0]].enabled === false
		this.forCubes(obj => {
			this.selected_faces.forEach(face => {
				obj.faces[face].enabled = state;
			})
		})
	},
	maximize(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(obj, event).forEach(function(side) {
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
			scope.getFaces(obj, event).forEach(function(side) {
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
				let overlap_px = Math.clamp(Math.max(obj.faces[side].uv[0], obj.faces[side].uv[2]) - Project.texture_width, 0, Infinity);
				obj.faces[side].uv[0] -= overlap_px;
				obj.faces[side].uv[2] -= overlap_px;
				let overlap_py = Math.clamp(Math.max(obj.faces[side].uv[1], obj.faces[side].uv[3]) - Project.texture_height, 0, Infinity);
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
			var top2, left2;
			let faces = face_keys || this.getFaces(obj, event);
			if (obj instanceof Cube) {
				faces.forEach(function(side) {
					let face = obj.faces[side];
					let mirror_x = face.uv[0] > face.uv[2];
					let mirror_y = face.uv[1] > face.uv[3];
					face.uv[0] = Math.min(face.uv[0], face.uv[2]);
					face.uv[1] = Math.min(face.uv[1], face.uv[3]);
					if (side == 'north' || side == 'south') {
						left2 = limitNumber(obj.size('0'), 0, Project.texture_width)
						top2 = limitNumber(obj.size('1'), 0, Project.texture_height)
					} else if (side == 'east' || side == 'west') {
						left2 = limitNumber(obj.size('2'), 0, Project.texture_width)
						top2 = limitNumber(obj.size('1'), 0, Project.texture_height)
					} else if (side == 'up' || side == 'down') {
						left2 = limitNumber(obj.size('0'), 0, Project.texture_width)
						top2 = limitNumber(obj.size('2'), 0, Project.texture_height)
					}
					if (face.rotation % 180) {
						[left2, top2] = [top2, left2];
					}
					left2 *= UVEditor.getResolution(0, face) / Project.texture_width;
					top2 *= UVEditor.getResolution(1, face) / Project.texture_height;
					face.uv_size = [left2, top2];
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
						vertex_uvs[vkey][0] = vertex_uvs[vkey][0] - (pmin_x % 1) + uv_center[0],
						vertex_uvs[vkey][1] = vertex_uvs[vkey][1] - (pmin_y % 1) + uv_center[1],
						min_x = Math.min(min_x, vertex_uvs[vkey][0]);
						min_y = Math.min(min_y, vertex_uvs[vkey][1]);
						max_x = Math.max(max_x, vertex_uvs[vkey][0]);
						max_y = Math.max(max_y, vertex_uvs[vkey][1]);
					}
					let offset = [
						min_x < 0 ? -min_x : (max_x > Project.texture_width ? Math.round(Project.texture_width - max_x) : 0),
						min_y < 0 ? -min_y : (max_y > Project.texture_height ? Math.round(Project.texture_height - max_y) : 0),
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
			scope.getFaces(obj, event).forEach(function(side) {
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
			scope.getFaces(obj, event).forEach(function(side) {
				if (obj instanceof Cube) {
					var proxy = obj.faces[side].uv[0]
					obj.faces[side].uv[0] = obj.faces[side].uv[2]
					obj.faces[side].uv[2] = proxy
				} else if (obj instanceof Mesh) {
					let center = 0;
					let count = 0;
					obj.faces[side].vertices.forEach(vkey => {
						center += obj.faces[side].uv[vkey][0];
						count++;
					})
					center /= count;
					obj.faces[side].vertices.forEach(vkey => {
						obj.faces[side].uv[vkey][0] = center*2 - obj.faces[side].uv[vkey][0];
					})
				}
			})
			if (obj.autouv) obj.autouv = 0
			obj.preview_controller.updateUV(obj);
		})
		this.message('uv_editor.mirrored')
		this.loadData()
	},
	mirrorY(event) {
		var scope = this;
		this.forElements(obj => {
			scope.getFaces(obj, event).forEach(function(side) {
				if (obj instanceof Cube) {
					var proxy = obj.faces[side].uv[1]
					obj.faces[side].uv[1] = obj.faces[side].uv[3]
					obj.faces[side].uv[3] = proxy
				} else if (obj instanceof Mesh) {
					let center = 0;
					let count = 0;
					obj.faces[side].vertices.forEach(vkey => {
						center += obj.faces[side].uv[vkey][1];
						count++;
					})
					center /= count;
					obj.faces[side].vertices.forEach(vkey => {
						obj.faces[side].uv[vkey][1] = center*2 - obj.faces[side].uv[vkey][1];
					})
				}
			})
			if (obj.autouv) obj.autouv = 0;
			obj.preview_controller.updateUV(obj);
		})
		this.message('uv_editor.mirrored')
		this.loadData()
	},
	applyAll() {
		this.forCubes(obj => {
			UVEditor.cube_faces.forEach(side => {
				obj.faces[side].extend(obj.faces[this.selected_faces[0]])
			})
			obj.autouv = 0
		})
		Canvas.updateSelectedFaces()
		this.message('uv_editor.to_all')
		this.loadData()
	},
	clear(event) {
		var scope = this;
		Undo.initEdit({elements: Cube.selected, uv_only: true})
		this.forCubes(obj => {
			scope.getFaces(obj, event).forEach(function(side) {
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
			this.selected_faces.forEach(face => {
				obj.faces[face].cullface = val || '';
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
		var scope = this;
		var val = Cube.selected[0].faces[scope.selected_faces[0]].tint === -1 ? 0 : -1;

		if (event === 0 || event === false) val = event
		this.forCubes(obj => {
			this.selected_faces.forEach(face => {
				obj.faces[face].tint = val;
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
			this.selected_faces.forEach(face => {
				obj.faces[face].tint = val;
			})
		})
		this.displayTools()
	},
	rotate(mesh_angle) {
		var value = parseInt(BarItems.uv_rotation.get());
		if (Cube.selected[0] && Cube.selected[0].faces[this.selected_faces] && Math.abs(Cube.selected[0].faces[this.selected_faces].rotation - value) % 180 == 90) {
			UVEditor.turnMapping();
		}
		this.forCubes(obj => {
			this.selected_faces.forEach(face => {
				obj.faces[face].rotation = value;
			})
			Canvas.updateUV(obj);
		})
		Mesh.selected.forEach(mesh => {
			mesh.forAllFaces((face, fkey) => {
				if (!UVEditor.selected_faces.includes(fkey)) return;
				if (face.vertices.length < 3) return;
				let center = [0, 0];
				face.vertices.forEach(vkey => {
					if (!face.uv[vkey]) return;
					center[0] += face.uv[vkey][0];
					center[1] += face.uv[vkey][1];
				})
				center[0] /= face.vertices.length;
				center[1] /= face.vertices.length;

				face.vertices.forEach(vkey => {
					if (!face.uv[vkey]) return;
					let sin = Math.sin(Math.degToRad(mesh_angle));
					let cos = Math.cos(Math.degToRad(mesh_angle));
					face.uv[vkey][0] -= center[0];
					face.uv[vkey][1] -= center[1];
					let a = (face.uv[vkey][0] * cos - face.uv[vkey][1] * sin);
					let b = (face.uv[vkey][0] * sin + face.uv[vkey][1] * cos);
					face.uv[vkey][0] = Math.clamp(a + center[0], 0, Project.texture_width);
					face.uv[vkey][1] = Math.clamp(b + center[1], 0, Project.texture_height);
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
		this.forCubes(obj => {
			this.selected_faces.forEach(face => {
				obj.faces[face].rotation = value;
			})
			Canvas.updateUV(obj)
		})
		this.loadData()
		this.message('uv_editor.rotated')
	},
	selectGridSize(event) {
	},
	autoCullface(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(obj, event).forEach(function(side) {
				obj.faces[side].cullface = side
			})
		})
		this.loadData()
		this.message('uv_editor.auto_cull')
	},
	copy(event) {
		let elements = this.getMappableElements();
		if (!elements.length) return;

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
			let element = elements.find(el => el.faces[key]);
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
		if (event.shiftKey) {
			for (let key in elements[0].faces) {
				addToClipboard(key)
			}
		} else {
			UVEditor.vue.selected_faces.forEach(key => {
				addToClipboard(key);
			})
		}
		this.message('uv_editor.copied_x', [UVEditor.clipboard.length])
	},
	paste(event) {
		let elements = UVEditor.getMappableElements();
		if (UVEditor.clipboard === null || elements.length === 0) return;



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
			} else {
				face.extend(tag);
			}
		}

		let shifting = (event && event.shiftKey) || Pressing.overrides.shift;
		if (shifting || UVEditor.clipboard.length === 1) {
			let tag = UVEditor.clipboard[0];
			elements.forEach(el => {
				if (el instanceof Cube && el.box_uv) return;
				if ((el instanceof Cube && tag instanceof CubeFace) || (el instanceof Mesh && tag instanceof MeshFace)) {
					for (let key in el.faces) {
						if (shifting || UVEditor.vue.selected_faces.includes(key)) {
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
			scope.getFaces(obj, event).forEach(function(side) {
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
		{name: 'menu.view.zoom', id: 'zoom', icon: 'search', children: [
			'zoom_in',
			'zoom_out',
			'zoom_reset'
		]},
		{name: 'menu.uv.display_uv', id: 'display_uv', icon: 'visibility', children: () => {
			let options = ['selected_faces', 'selected_elements', 'all_elements'];
			return options.map(option => {return {
				id: option,
				name: `menu.uv.display_uv.${option}`,
				icon: UVEditor.vue.display_uv == option ? 'radio_button_checked' : 'radio_button_unchecked',
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
		'uv_checkerboard',
		'paint_mode_uv_overlay',
		'_',
		'copy',
		'paste',
		'cube_uv_mode',
		{icon: 'photo_size_select_large', name: 'menu.uv.mapping', condition: () => !UVEditor.isBoxUV() && UVEditor.getReferenceFace(), children() {
			let reference_face = UVEditor.getReferenceFace();
			function isMirrored(axis) {
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
			}
			return [
				{icon: reference_face.enabled!==false ? 'check_box' : 'check_box_outline_blank', name: 'generic.export', click: function() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					UVEditor.toggleUV(event)
					Undo.finishEdit('Toggle UV export')
				}},
				'uv_maximize',
				'uv_auto',
				'uv_rel_auto',
				'snap_uv_to_pixels',
				'uv_rotate_left',
				'uv_rotate_right',
				{icon: 'rotate_90_degrees_ccw', condition: () => reference_face instanceof CubeFace && Format.uv_rotation, name: 'menu.uv.mapping.rotation', children: function() {
					var off = 'radio_button_unchecked'
					var on = 'radio_button_checked'
					return [
						{icon: (!reference_face.rotation ? on : off), name: '0&deg;', click: function() {
							Undo.initEdit({elements: Cube.selected, uv_only: true})
							UVEditor.setRotation(0)
							Undo.finishEdit('Rotate UV')
						}},
						{icon: (reference_face.rotation === 90 ? on : off), name: '90&deg;', click: function() {
							Undo.initEdit({elements: Cube.selected, uv_only: true})
							UVEditor.setRotation(90)
							Undo.finishEdit('Rotate UV')
						}},
						{icon: (reference_face.rotation === 180 ? on : off), name: '180&deg;', click: function() {
							Undo.initEdit({elements: Cube.selected, uv_only: true})
							UVEditor.setRotation(180)
							Undo.finishEdit('Rotate UV')
						}},
						{icon: (reference_face.rotation === 270 ? on : off), name: '270&deg;', click: function() {
							Undo.initEdit({elements: Cube.selected, uv_only: true})
							UVEditor.setRotation(270)
							Undo.finishEdit('Rotate UV')
						}}
					]
				}},
				'uv_turn_mapping',
				{
					icon: (isMirrored(0) ? 'check_box' : 'check_box_outline_blank'),
					name: 'menu.uv.mapping.mirror_x',
					click: function() {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						UVEditor.mirrorX(event)
						Undo.finishEdit('Mirror UV')
					}
				},
				{
					icon: (isMirrored(1) ? 'check_box' : 'check_box_outline_blank'),
					name: 'menu.uv.mapping.mirror_y',
					click: function() {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						UVEditor.mirrorY(event)
						Undo.finishEdit('Mirror UV')
					}
				},
			]
		}},
		'face_tint',
		{icon: 'flip_to_back', condition: () => (Format.java_face_properties && Cube.selected.length && UVEditor.getReferenceFace()), name: 'action.cullface' , children: function() {
			var off = 'radio_button_unchecked';
			var on = 'radio_button_checked';
			function setCullface(cullface) {
				Undo.initEdit({elements: Cube.selected, uv_only: true})
				UVEditor.forCubes(obj => {
					UVEditor.selected_faces.forEach(face => {
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
		{icon: 'collections', name: 'menu.uv.texture', condition: () => UVEditor.getReferenceFace() && !Project.single_texture, children: function() {
			var arr = [
				{icon: 'crop_square', name: 'menu.cube.texture.blank', click: function(context, event) {
					let elements = UVEditor.vue.mappable_elements;
					Undo.initEdit({elements})
					elements.forEach((obj) => {
						UVEditor.getFaces(obj, event).forEach(function(side) {
							obj.faces[side].texture = false;
						})
						obj.preview_controller.updateFaces(obj);
					})
					UVEditor.loadData()
					UVEditor.message('uv_editor.reset')
					Undo.finishEdit('Apply blank texture')
				}},
				{icon: 'clear', name: 'menu.cube.texture.transparent', condition: () => UVEditor.getReferenceFace() instanceof CubeFace, click: function(event) {UVEditor.clear(event)}},
			]
			Texture.all.forEach(function(t) {
				arr.push({
					name: t.name,
					icon: (t.mode === 'link' ? t.img : t.source),
					click: function() {UVEditor.applyTexture(t)}
				})
			})
			return arr;
		}}
	])
}


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
		click: function (event) {
			Undo.initEdit({elements: UVEditor.getMappableElements(), uv_only: true})
			UVEditor.forSelection('setAutoSize', event)
			Undo.finishEdit('Auto UV')
		}
	})
	new Action('uv_rel_auto', {
		icon: 'brightness_auto',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('setRelativeAutoSize', event)
			Undo.finishEdit('Auto UV')
		}
	})
	new Action('uv_mirror_x', {
		icon: 'icon-mirror_x',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && UVEditor.getMappableElements().length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('mirrorX', event)
			Undo.finishEdit('Mirror UV')
		}
	})
	new Action('uv_mirror_y', {
		icon: 'icon-mirror_y',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && UVEditor.getMappableElements().length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('mirrorY', event)
			Undo.finishEdit('Mirror UV')
		}
	})
	new Action('uv_rotate_left', {
		icon: 'rotate_left',
		category: 'uv',
		condition: () => Mesh.selected.length,
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
		click: function (event) {
			UVEditor.forSelection('clear', event)
		}
	})
	new Action('uv_reset', {
		icon: 'replay',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Cube.selected.length,
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
		condition: () => UVEditor.isFaceUV() && Format.java_face_properties && Cube.selected.length && UVEditor.selected_faces[0],
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
		condition: () => UVEditor.isFaceUV() && Format.java_face_properties && Cube.selected.length && UVEditor.selected_faces[0],
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('autoCullface', event)
			Undo.finishEdit('Set automatic cullface')
		}
	})
	new Action('face_tint', {
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Format.java_face_properties && Cube.selected.length && UVEditor.selected_faces[0],
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('switchTint', event)
			Undo.finishEdit('Toggle face tint')
		}
	})
	new NumSlider('slider_face_tint', {
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && Format.java_face_properties && Cube.selected.length && UVEditor.selected_faces[0] && Cube.selected[0].faces[UVEditor.selected_faces[0]],
		getInterval(event) {
			return 1;
		},
		get: function() {
			return Cube.selected[0] && Cube.selected[0].faces[UVEditor.selected_faces[0]].tint
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
	new Action('snap_uv_to_pixels', {
		icon: 'grid_goldenratio',
		category: 'uv',
		condition: () => UVEditor.isFaceUV() && UVEditor.getMappableElements().length,
		click: function (event) {
			let elements = UVEditor.getMappableElements();
			Undo.initEdit({elements, uv_only: true})
			elements.forEach(element => {
				let selected_vertices = element instanceof Mesh && element.getSelectedVertices();
				UVEditor.selected_faces.forEach(fkey => {
					if (!element.faces[fkey]) return;
					let face = element.faces[fkey];
					if (element instanceof Mesh) {
						face.vertices.forEach(vkey => {
							if ((!selected_vertices.length || selected_vertices.includes(vkey)) && face.uv[vkey]) {
								face.uv[vkey][0] = Math.clamp(Math.round(face.uv[vkey][0]), 0, Project.texture_width);
								face.uv[vkey][1] = Math.clamp(Math.round(face.uv[vkey][1]), 0, Project.texture_height);
							}
						})
					} else if (element instanceof Cube) {
						face.uv[0] = Math.clamp(Math.round(face.uv[0]), 0, Project.texture_width);
						face.uv[1] = Math.clamp(Math.round(face.uv[1]), 0, Project.texture_height);
						face.uv[2] = Math.clamp(Math.round(face.uv[2]), 0, Project.texture_width);
						face.uv[3] = Math.clamp(Math.round(face.uv[3]), 0, Project.texture_height);
					}
				})
				element.preview_controller.updateUV(element);
			})
			UVEditor.loadData();
			Undo.finishEdit('Set automatic cullface')
		}
	})
	new Toggle('paint_mode_uv_overlay', {
		icon: 'splitscreen',
		category: 'animation',
		condition: {modes: ['paint']},
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

	let copy_overlay = {
		state: 'off',
		width: 0, height: 0,
		
		doPlace() {
			open_interface.confirm();
		},
		doCancel() {
			open_interface.hide();
		},
		doCut(e) {
			UVEditor.removePastingOverlay()
			UVEditor.texture.edit((canvas) => {
				var ctx = canvas.getContext('2d');
				ctx.clearRect(Painter.selection.x, Painter.selection.y, Painter.selection.canvas.width, Painter.selection.canvas.height);
			})
		},
		doMirror_x(e) {
			let temp_canvas = getCanvasCopy()
	
			let ctx = Painter.selection.canvas.getContext('2d');
			ctx.save();
			ctx.translate(ctx.canvas.width, 0);
			ctx.scale(-1, 1);
	
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			ctx.drawImage(temp_canvas, ctx.canvas.width, 0, -ctx.canvas.width, ctx.canvas.height);
			ctx.restore();
			UVEditor.updatePastingOverlay()
		},
		doMirror_y(e) {
			let temp_canvas = getCanvasCopy()
	
			let ctx = Painter.selection.canvas.getContext('2d');
			ctx.save();
			ctx.translate(0, ctx.canvas.height);
			ctx.scale(1, -1);
	
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			ctx.drawImage(temp_canvas, 0, ctx.canvas.height, ctx.canvas.width, -ctx.canvas.height);
			ctx.restore();
		},
		doRotate(e) {
			let temp_canvas = getCanvasCopy()
	
			let ctx = Painter.selection.canvas.getContext('2d');
			[ctx.canvas.width, ctx.canvas.height] = [ctx.canvas.height, ctx.canvas.width]
			ctx.save();
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	
			ctx.translate(ctx.canvas.width/2,ctx.canvas.height/2);
			ctx.rotate(Math.PI/2);
	
			ctx.drawImage(temp_canvas,-temp_canvas.width/2,-temp_canvas.height/2);
	
			ctx.restore();
			UVEditor.updatePastingOverlay()
		},
	}
	
	UVEditor.panel = new Panel('uv', {
		icon: 'photo_size_select_large',
		selection_only: true,
		expand_button: true,
		condition: {modes: ['edit', 'paint'], method: () => !Format.image_editor},
		display_condition: () => UVEditor.getMappableElements().length || Modes.paint,
		default_position: {
			slot: 'left_bar',
			float_position: [300, 0],
			float_size: [500, 600],
			height: 500
		},
		toolbars: {
			bottom: Toolbars.UVEditor
		},
		onResize: function() {
			UVEditor.vue.hidden = Format.image_editor ? false : !this.isVisible();
			Vue.nextTick(() => {
				UVEditor.vue.updateSize();
			})
		},
		onFold: function() {
			Vue.nextTick(() => {
				UVEditor.vue.hidden = Format.image_editor ? false : !this.isVisible();
			})
		},
		component: {
			data() {return {
				mode: 'uv',
				hidden: false,
				box_uv: false,
				width: 320,
				height: 320,
				zoom: 1,
				centered_view: true,
				checkerboard: settings.uv_checkerboard.value,
				pixel_grid: settings.painting_grid.value,
				uv_overlay: false,
				texture: 0,
				mouse_coords: {x: -1, y: -1},
				copy_brush_source: null,
				helper_lines: {x: -1, y: -1},
				brush_type: BarItems.brush_shape.value,
				selection_rect: {
					pos_x: 0,
					pos_y: 0,
					width: 0,
					height: 0,
					active: false
				},
				copy_overlay,

				project_resolution: [16, 16],
				elements: [],
				all_elements: [],
				selected_vertices: {},
				selected_faces: [],
				display_uv: 'selected_elements',

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
					let axis = this.project_resolution[0] / this.project_resolution[1] < this.width / this.height;
					if (axis) {
						return this.height * this.zoom * (this.project_resolution[0] / this.project_resolution[1]);
					} else {
						return this.width * this.zoom;
					}
				},
				inner_height() {
					return Math.min(this.height * this.zoom, this.width * this.zoom / (this.project_resolution[0] / this.project_resolution[1]));
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
					let size = UVEditor.getPixelSize();
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
				textureGridBold() {
					if (!this.texture) return '';
					let lines = [];
					let size = UVEditor.getPixelSize();
					let interval = 16;
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
				project_resolution: {
					deep: true,
					handler() {
						let min_zoom = Math.min(1, this.inner_width/this.inner_height);
						if (this.zoom < min_zoom) UVEditor.setZoom(1);
					}
				},
				mode() {
					Vue.nextTick(() => {
						this.updateSize();
					})
				}
			},
			methods: {
				projectResolution() {
					BarItems.project_window.trigger()
				},
				updateSize() {
					if (!this.$refs.viewport) return;
					let old_size = this.width;
					let size = Format.image_editor
							? Math.floor(Math.clamp(Interface.center_screen.clientWidth - 10, 64, 1e5))
							: Math.floor(Math.clamp(UVEditor.panel.width - 10, 64, 1e5));
					this.width = size;
					if (Format.image_editor) {
						this.height = Interface.center_screen.clientHeight - 38;

					} else if (Panels.uv.slot.includes('_bar')) {
						this.height = size * Math.clamp(this.project_resolution[1] / this.project_resolution[0], 0.5, 1);

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
				},
				centerView() {
					this.$refs.viewport.scrollLeft = this.width/2;
					this.$refs.viewport.scrollTop = this.height/2;
					this.centered_view = true;
				},
				setMode(mode) {
					this.mouse_coords.x = this.mouse_coords.y = -1;
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
								let face = element.faces[ this.selected_faces[0] || Object.keys(element.faces)[0] ];
								if (face) texture = face.getTexture() || texture;
								if (texture) break;
							}
						} else if (Modes.paint) {
							texture = Texture.getDefault();
						}
					}
					if (texture === null) {
						this.texture = null;
					} else if (texture instanceof Texture) {
						this.texture = texture;
						if (!UVEditor.isBoxUV() && UVEditor.auto_grid) {
							UVEditor.grid = texture.width / Project.texture_width;
						}
					} else {
						this.texture = 0;
					}
					// Display canvas while painting
					this.updateTextureCanvas();
				},
				updateTextureCanvas() {
					if (this.texture && this.texture.display_canvas) {
						Vue.nextTick(() => {
							let wrapper = this.$refs.texture_canvas_wrapper;
							this.texture.canvas.style.objectPosition = `0 ${-this.texture.currentFrame * this.inner_height}px`;
							this.texture.canvas.style.objectFit = this.texture.frameCount > 1 ? 'cover' : 'fill';
							wrapper.append(this.texture.canvas);
						})
					}
				},
				updateMouseCoords(event) {					
					convertTouchEvent(event);
					var pixel_size = this.inner_width / (this.texture ? this.texture.width : this.project_resolution[0]);

					if (Toolbox.selected.id === 'copy_paste_tool') {
						this.mouse_coords.x = Math.round(event.offsetX/pixel_size*1);
						this.mouse_coords.y = Math.round(event.offsetY/pixel_size*1);
					} else {
						this.mouse_coords.x = event.offsetX/pixel_size*1;
						this.mouse_coords.y = event.offsetY/pixel_size*1;
						if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
							let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0.5 : 0;
							this.mouse_coords.x = Math.floor(this.mouse_coords.x + offset);
							this.mouse_coords.y = Math.floor(this.mouse_coords.y + offset);
						}
					}
					if (this.texture && this.texture.frameCount) {
						this.mouse_coords.y += (this.texture.height / this.texture.frameCount) * this.texture.currentFrame
					}
				},
				onMouseWheel(event) {
					if (event.ctrlOrCmd) {
				
						event.stopPropagation()
						event.preventDefault()
				
						let original_margin = this.getFrameMargin();
						let old_zoom = this.zoom;
						var n = (event.deltaY < 0) ? 0.1 : -0.1;
						n *= this.zoom

						let zoom = this.zoom + n;
						if (zoom > 0.91 && zoom < 1.1) zoom = 1;
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
							
							if (this.mode == 'paint') {
								this.mouse_coords.x = -1;
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
					if (event.which === 2 || (event.touches && !Toolbox.selected.paintTool && event.target.id == 'uv_frame')) {
						// Drag
						if (event.touches) {
							event.clientX = event.touches[0].clientX;
							event.clientY = event.touches[0].clientY;
						}
						let {viewport} = this.$refs;
						let margin = this.getFrameMargin();
						let margin_center = [this.width/2, this.height/2];
						let original = [
							viewport.scrollLeft,
							viewport.scrollTop
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
						}
						function dragMouseWheelStop(e) {
							removeEventListeners(document, 'mousemove touchmove', dragMouseWheel);
							removeEventListeners(document, 'mouseup touchend', dragMouseWheelStop);
						}
						addEventListeners(document, 'mousemove touchmove', dragMouseWheel);
						addEventListeners(document, 'mouseup touchend', dragMouseWheelStop);
						event.preventDefault();
						$(getFocusedTextInput()).trigger('blur');
						return false;

					} else if (this.mode == 'paint' && Toolbox.selected.paintTool && (event.which === 1 || (event.touches && event.touches.length == 1))) {
						// Paint
						if (event.target && event.target.id === 'uv_viewport') return;
						UVEditor.startPaintTool(event);
						event.preventDefault();
						return false;

					} else if (this.mode == 'uv' && event.target.id == 'uv_frame' && (event.which === 1 || (event.touches && event.touches.length == 1))) {

						if (event.altKey || Pressing.overrides.alt) {
							return this.dragFace(null, event);
						}

						let {selection_rect} = this;
						let scope = this;
						let old_faces = this.selected_faces.slice();
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
								event.offsetX / scope.inner_width * scope.project_resolution[0],
								event.offsetY / scope.inner_height * scope.project_resolution[1],
								(event.offsetX - event.clientX + e1.clientX) / scope.inner_width * scope.project_resolution[0],
								(event.offsetY - event.clientY + e1.clientY) / scope.inner_height * scope.project_resolution[1],
							)
							selection_rect.pos_x = rect.ax;
							selection_rect.pos_y = rect.ay;
							selection_rect.width = rect.x;
							selection_rect.height = rect.y;
							
							if (!e1.shiftKey) {
								scope.selected_faces.empty();
								if (old_elements) Outliner.selected.empty();
							} else {
								scope.selected_faces.replace(old_faces);
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
											scope.selected_faces.safePush(fkey);
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
													scope.selected_faces.safePush(fkey);
												}
												if (pointInRectangle(face.uv[vkey], [rect.ax, rect.ay], [rect.bx, rect.by])) {
													selected_vertices.safePush(vkey);
												}
											}
										}
									}
								}
							})
							if (old_elements) updateSelection();
							UVEditor.displayTools();
						}
						function stop() {
							removeEventListeners(document, 'mousemove touchmove', drag);
							removeEventListeners(document, 'mouseup touchend', stop);
							setTimeout(() => {
								selection_rect.active = false;
							}, 1)
						}
						addEventListeners(document, 'mousemove touchmove', drag, false);
						addEventListeners(document, 'mouseup touchend', stop, false);
					}
				},
				onMouseLeave(event) {
					if (this.mode == 'paint') {
						this.mouse_coords.x = -1;
					}
				},
				contextMenu(event) {
					setActivePanel('uv');
					UVEditor.menu.open(event);
				},
				selectTextureMenu(event) {
					let menu = new Menu(Texture.all.map(tex => {
						return {
							name: tex.name,
							icon: tex.img,
							click(event) {
								tex.select(event);
							}
						}
					}))
					menu.open(event.target);
				},
				selectFace(key, event, keep_selection, support_dragging) {
					if (keep_selection && this.selected_faces.includes(key)) {

					} else if (event.shiftKey || event.ctrlOrCmd || Pressing.overrides.shift || Pressing.overrides.ctrl) {
						if (this.selected_faces.includes(key)) {
							this.selected_faces.remove(key);
						} else {
							this.selected_faces.push(key);
						}
					} else {
						this.selected_faces.replace([key]);
					}
					UVEditor.vue.updateTexture();
					UVEditor.displayTools();

					if (support_dragging) {
						let scope = this;
						function drag(e1) {
							if (e1.target && e1.target.nodeName == 'LI' && e1.target.parentElement.id == 'uv_cube_face_bar') {
								let face = e1.target.attributes.face.value;
								scope.selected_faces.safePush(face);
								UVEditor.displayTools();
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
								this.selected_faces.empty();
							}
						}
					}
				},
				drag({event, onDrag, onEnd, onAbort, snap}) {
					if (event.which == 2 || event.which == 3) return;
					convertTouchEvent(event);
					let scope = this;

					let pos = [0, 0];
					let last_pos = [0, 0];
					function drag(e1) {
						convertTouchEvent(e1);

						if (snap == undefined) {
							let snap = UVEditor.grid / canvasGridSize(e1.shiftKey || Pressing.overrides.shift, e1.ctrlOrCmd || Pressing.overrides.ctrl);
	
							let step_x = (scope.inner_width / UVEditor.getResolution(0) / snap);
							let step_y = (scope.inner_height / UVEditor.getResolution(1) / snap);

							pos[0] = Math.round((e1.clientX - event.clientX) / step_x) / snap;
							pos[1] = Math.round((e1.clientY - event.clientY) / step_y) / snap;
						} else {	
							let step_x = (scope.inner_width / UVEditor.getResolution(0) / snap);
							let step_y = (scope.inner_height / UVEditor.getResolution(1) / snap);

							pos[0] = Math.round((e1.clientX - event.clientX) / step_x) / snap;
							pos[1] = Math.round((e1.clientY - event.clientY) / step_y) / snap;
						}

						if (pos[0] != last_pos[0] || pos[1] != last_pos[1]) {
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
				dragFace(face_key, event) {
					if (event.which == 2 || event.which == 3) return;

					let face_selected_before = this.selected_faces[0];
					if (face_key) this.selectFace(face_key, event, true);
					let elements = UVEditor.getMappableElements();
					Undo.initEdit({
						elements,
						uv_only: true,

					});
					let total_diff = [0, 0];
					let do_move_uv = !!(BarItems.move_texture_with_uv.value && this.texture);

					UVEditor.getMappableElements().forEach(el => {
						if (el instanceof Mesh) {
							delete Project.selected_vertices[el.uuid];
						}
					})

					let overlay_canvas;
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
							tex_ctx.beginPath();
							UVEditor.getMappableElements().forEach(el => {
								if (el instanceof Mesh) {
									for (var fkey in el.faces) {
										var face = el.faces[fkey];
										if (!this.selected_faces.includes(fkey)) continue;
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
									let factor_x = this.texture.width  / Project.texture_width;
									let factor_y = this.texture.height / Project.texture_height;
									for (var fkey in el.faces) {
										var face = el.faces[fkey];
										if (!this.selected_faces.includes(fkey) && !el.box_uv) continue;
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
						}, {no_undo: true})

						UVEditor.vue.$refs.frame.append(overlay_canvas);

					} else {
						Undo.initEdit({elements, uv_only: true});
					}

					this.drag({
						event,
						snap: UVEditor.isBoxUV() ? 1 : undefined,
						onDrag: (diff_x, diff_y) => {
							elements.forEach(element => {
								if (element instanceof Mesh) {
									this.selected_faces.forEach(key => {
										let face = element.faces[key];
										if (!face) return;
										face.vertices.forEach(vertex_key => {
											diff_x = Math.clamp(diff_x, -face.uv[vertex_key][0], Project.texture_width  - face.uv[vertex_key][0]);
											diff_y = Math.clamp(diff_y, -face.uv[vertex_key][1], Project.texture_height - face.uv[vertex_key][1]);
										})
									})
								} else if (element.box_uv) {
									let size = element.size(undefined, true);
									let uv_size = [
										size[2] + size[0] + (size[1] ? size[2] : 0) + size[0],
										size[2] + size[1],
									]
									diff_x = Math.clamp(diff_x, -element.uv_offset[0] - (size[1] ? 0 : size[2]), Project.texture_width  - element.uv_offset[0] - uv_size[0]);
									diff_y = Math.clamp(diff_y, -element.uv_offset[1] - (size[0] ? 0 : size[2]), Project.texture_height - element.uv_offset[1] - uv_size[1]);

								} else {
									this.selected_faces.forEach(key => {
										if (element.faces[key] && element instanceof Cube) {
											diff_x = Math.clamp(diff_x, -element.faces[key].uv[0], Project.texture_width  - element.faces[key].uv[0]);
											diff_y = Math.clamp(diff_y, -element.faces[key].uv[1], Project.texture_height - element.faces[key].uv[1]);
											diff_x = Math.clamp(diff_x, -element.faces[key].uv[2], Project.texture_width  - element.faces[key].uv[2]);
											diff_y = Math.clamp(diff_y, -element.faces[key].uv[3], Project.texture_height - element.faces[key].uv[3]);
										}
									})
								}
							})
							elements.forEach(element => {
								if (element instanceof Mesh) {
									this.selected_faces.forEach(key => {
										let face = element.faces[key];
										if (!face) return;
										face.vertices.forEach(vertex_key => {
											face.uv[vertex_key][0] += diff_x;
											face.uv[vertex_key][1] += diff_y;
										})
									})
								} else if (element.box_uv) {
									element.uv_offset[0] += diff_x;
									element.uv_offset[1] += diff_y;
								} else {
									this.selected_faces.forEach(key => {
										if (element.faces[key] && element instanceof Cube) {
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
										total_diff[0] * this.texture.width  / Project.texture_width,
										total_diff[1] * this.texture.height / Project.texture_height
									);
								}, {no_undo: true})
								overlay_canvas.remove();
								Canvas.updateView({elements, element_aspects: {uv: true}});
							}
							Undo.finishEdit('Move UV');
						},
						onAbort: () => {
							if (do_move_uv) {
								overlay_canvas.remove();
							}
							let selected_faces = this.selected_faces.slice()
							UVEditor.selectMeshUVIsland(face_key);
							if (
								(this.selected_faces.includes(face_selected_before) && face_selected_before !== face_key) ||
								(event.shiftKey || event.ctrlOrCmd || Pressing.overrides.shift || Pressing.overrides.ctrl)
							) {
								this.selected_faces.replace(selected_faces);
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
						this.selected_faces.forEach(key => {
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
								this.selected_faces.forEach(key => {
									if (element.faces[key] && element instanceof Cube) {
										if (x_side && (x_side == -1) != inverted[element.uuid][key][0]) element.faces[key].uv[0] = Math.clamp(element.faces[key].uv[0] + x, 0, Project.texture_width);
										if (y_side && (y_side == -1) != inverted[element.uuid][key][1]) element.faces[key].uv[1] = Math.clamp(element.faces[key].uv[1] + y, 0, Project.texture_height);
										if (x_side && (x_side ==  1) != inverted[element.uuid][key][0]) element.faces[key].uv[2] = Math.clamp(element.faces[key].uv[2] + x, 0, Project.texture_width);
										if (y_side && (y_side ==  1) != inverted[element.uuid][key][1]) element.faces[key].uv[3] = Math.clamp(element.faces[key].uv[3] + y, 0, Project.texture_height);
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
						this.selected_faces.forEach(fkey => {
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
									scope.selected_faces.forEach(key => {
										if (element.faces[key]) {
											element.faces[key].rotation += 90 * Math.sign(last_angle - angle);
											if (element.faces[key].rotation == 360) element.faces[key].rotation = 0;
											if (element.faces[key].rotation < 0) element.faces[key].rotation += 360;
										}
									})

								} else if (element instanceof Mesh) {
									scope.selected_faces.forEach(fkey => {
										let face = element.faces[fkey];
										if (!face) return;
										face.vertices.forEach(vkey => {
											if (!face.uv[vkey]) return;
											let sin = Math.sin(Math.degToRad(angle));
											let cos = Math.cos(Math.degToRad(angle));
											face.uv[vkey][0] = face.old_uv[vkey][0] - face_center[0];
											face.uv[vkey][1] = face.old_uv[vkey][1] - face_center[1];
											let a = (face.uv[vkey][0] * cos - face.uv[vkey][1] * sin);
											let b = (face.uv[vkey][0] * sin + face.uv[vkey][1] * cos);
											face.uv[vkey][0] = Math.clamp(a + face_center[0], 0, Project.texture_width);
											face.uv[vkey][1] = Math.clamp(b + face_center[1], 0, Project.texture_height);
										})
										let e = 0.6;
										face.vertices.forEach((vkey, i) => {
											for (let j = i+1; j < face.vertices.length; j++) {
												let relative_angle = Math.radToDeg(Math.PI + Math.atan2(
													face.uv[vkey][1] - face.uv[face.vertices[j]][1],
													face.uv[vkey][0] - face.uv[face.vertices[j]][0],
												)) % 180;
												if (Math.abs(relative_angle - 90) < e) {
													straight_angle = angle;
													if (scope.helper_lines.x == -1) scope.helper_lines.x = face.uv[vkey][0];
												}
												if (relative_angle < e || 180 - relative_angle < e) {
													straight_angle = angle;
													if (scope.helper_lines.y == -1) scope.helper_lines.y = face.uv[vkey][1];
												}
											} 
										})
									})
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
						this.selected_faces.forEach(fkey => {
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
								this.selected_faces.forEach(key => {
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

					if (!this.selected_vertices[element.uuid]) this.selected_vertices[element.uuid] = [];
					let sel_vertices = this.selected_vertices[element.uuid];
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
								this.selected_faces.forEach(key => {
									let face = element.faces[key];
									if (!face) return;
									face.vertices.forEach(vertex_key => {
										if (this.selected_vertices[element.uuid] && this.selected_vertices[element.uuid].includes(vertex_key)) {
											x = Math.clamp(x, -face.uv[vertex_key][0], Project.texture_width - face.uv[vertex_key][0]);
											y = Math.clamp(y, -face.uv[vertex_key][1], Project.texture_height - face.uv[vertex_key][1]);
										}
									})
								})
							})
							elements.forEach(element => {
								this.selected_faces.forEach(key => {
									let face = element.faces[key];
									let old_uv_coords = face.vertices.map(vkey => face.uv[vkey].slice())
									face.vertices.forEach((vertex_key, i) => {
										if (this.selected_vertices[element.uuid] && this.selected_vertices[element.uuid].includes(vertex_key)) {
											let is_duplicate = face.vertices.find((vkey2, j) => {
												return j > i && face.uv[vertex_key].equals(old_uv_coords[j])
											})
											if (is_duplicate) {
												this.selected_vertices[element.uuid].remove(vertex_key);
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
					return (uv_coord / this.project_resolution[0] * this.inner_width + offset) + 'px'
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
							Math.roundTo((UV[0] + uv_offset[0]) / this.project_resolution[0] * this.inner_width + 1, 4) + ',' +
							Math.roundTo((UV[1] + uv_offset[1]) / this.project_resolution[0] * this.inner_width + 1, 4)
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
				filterMeshFaces(faces) {
					let keys = Object.keys(faces);
					if (keys.length > 800) {
						let result = {};
						this.selected_faces.forEach(key => {
							if (faces[key]) result[key] = faces[key];
						})
						return result;
					} else {
						return faces;
					}
				},
				isScalingAvailable() {
					if (this.mappable_elements[0] instanceof Cube) {
						return UVEditor.isFaceUV() && this.selected_faces.length > 1;

					} else if (this.mappable_elements[0] instanceof Mesh) {
						return this.selected_faces.length > 0;
					}
				},
				getSelectedUVBoundingBox() {
					let min = [Project.texture_width, Project.texture_height];
					let max = [0, 0];
					this.selected_faces.forEach(fkey => {
						this.mappable_elements.forEach(element => {
							if (!element.faces[fkey]) return;

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
					if (Toolbox.selected.brush) {
						var pixel_size = this.inner_width / (this.texture ? this.texture.width : Project.texture_width);
						//pos
						let offset = 0;
						if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
							offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0 : 0.5;
						}
						let left = this.mouse_coords.x;
						let top =  this.mouse_coords.y % (this.texture ? this.texture.display_height : Project.texture_height);
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
							click(event) {
								UVEditor.applyTexture(tex);
							}
						}
					}))
					menu.open(event.target);
				},
				toggleFaceTint(key, event) {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					UVEditor.switchTint(event)
					Undo.finishEdit('Toggle face tint')
				},
				changeFaceTint(key, event) {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					UVEditor.setTint(event, parseInt(event.target.value));
					Undo.finishEdit('Toggle face tint');
				},
				setCullface(key, value) {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					UVEditor.forCubes(obj => {
						UVEditor.selected_faces.forEach(face => {
							obj.faces[face].cullface = value;
						})
					})
					Undo.finishEdit(value ? `Set cullface to ${value}` : 'Disable cullface');
				},
				startInputMaterialInstance(event) {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
				},
				endInputMaterialInstance(event) {
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
						<div id="project_resolution_status" @click="projectResolution()">
							{{ project_resolution[0] + ' ⨉ ' + project_resolution[1] }}
						</div>
					</div>

					<div class="bar" id="uv_cube_face_bar" ref="uv_cube_face_bar" v-if="mode == 'uv' && mappable_elements[0] && mappable_elements[0].type == 'cube' && !box_uv">
						<li v-for="(face, key) in mappable_elements[0].faces" :face="key" :class="{selected: selected_faces.includes(key), disabled: mappable_elements[0].faces[key].texture === null}" @mousedown="selectFace(key, $event, false, true)">
							{{ face_names[key] }}
						</li>
						<li @click="mode = 'face_properties'" class="tool face_properties_toggle">
							<div class="tooltip">${tl('uv_editor.face_properties')}</div>
							<i class="material-icons">checklist</i>
						</li>
					</div>


					<div id="uv_face_properties" v-if="mode === 'face_properties' && mappable_elements[0] && mappable_elements[0].type == 'cube'">
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


						<ul>
							<li v-for="(face, key) in mappable_elements[0].faces" :face="key"
								class="uv_face_properties_line"
								:class="{selected: selected_faces.includes(key), disabled: mappable_elements[0].faces[key].texture === null}"
								@mousedown="selectFace(key, $event, false, true)"
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

									<select-input class="flexible" title="${tl('action.cullface')}" :value="mappable_elements[0].faces[key].cullface" @input="setCullface(key, $event)" :options="cullface_options" />
								</template>

								<template v-if="checkFormat({id: 'bedrock_block'})">
									<input type="text" style="width: 100px;" class="flexible dark_bordered"
										title="${tl('uv_editor.face_properties.material_instance')}"
										v-model="mappable_elements[0].faces[key].material_name"
										@focus="startInputMaterialInstance($event)"
										@focusout="endInputMaterialInstance($event)"
									>
								</template>
							</li>
						</ul>
					</div>


					<div id="uv_viewport"
						@contextmenu="contextMenu($event)"
						@mousedown="onMouseDown($event)"
						@touchstart="onMouseDown($event)"
						@mousewheel="onMouseWheel($event)"
						class="checkerboard_target"
						ref="viewport"
						v-if="!hidden && mode !== 'face_properties'"
						:style="{width: (width+8) + 'px', height: (height+8) + 'px', overflowX: (zoom > 1) ? 'scroll' : 'hidden', overflowY: (inner_height > height) ? 'scroll' : 'hidden'}"
					>

						<div id="uv_frame" ref="frame"
							v-if="texture !== null"
							@click.stop="reverseSelect($event)"
							@mousemove="updateMouseCoords($event)"
							@mouseleave="onMouseLeave($event)"
							:class="{overlay_mode: uv_overlay && mode == 'paint'}"
							:style="{width: inner_width + 'px', height: inner_height + 'px', margin: getFrameMargin(true)}"
						>

							<template id="uv_allocations" v-if="mode == 'uv' || uv_overlay" v-for="element in ((display_uv === 'all_elements' || mode == 'paint') ? all_mappable_elements : mappable_elements)">

								<template v-if="element.type == 'cube' && !element.box_uv">
									<div class="cube_uv_face"
										v-for="(face, key) in element.faces" :key="element.uuid + ':' + key"
										v-if="(face.getTexture() == texture || texture == 0) && (display_uv !== 'selected_faces' || selected_faces.includes(key))"
										:title="face_names[key]"
										:class="{selected: selected_faces.includes(key), unselected: display_uv === 'all_elements' && !mappable_elements.includes(element)}"
										@mousedown.prevent="dragFace(key, $event)"
										@touchstart.prevent="dragFace(key, $event)"
										@contextmenu="selectFace(key, $event, true, false)"
										:style="{
											left: toPixels(Math.min(face.uv[0], face.uv[2]), -1),
											top: toPixels(Math.min(face.uv[1], face.uv[3]), -1),
											'--width': toPixels(Math.abs(face.uv_size[0]), 2),
											'--height': toPixels(Math.abs(face.uv_size[1]), 2),
										}"
									>
										<template v-if="selected_faces.includes(key) && mode == 'uv' && !(display_uv === 'all_elements' && !mappable_elements.includes(element))">
											{{ face_names[key] || '' }}
											<div class="uv_resize_side horizontal" @mousedown="resizeFace(key, $event, 0, -1)" @touchstart.prevent="resizeFace(key, $event, 0, -1)" style="width: var(--width)"></div>
											<div class="uv_resize_side horizontal" @mousedown="resizeFace(key, $event, 0, 1)" @touchstart.prevent="resizeFace(key, $event, 0, 1)" style="top: var(--height); width: var(--width)"></div>
											<div class="uv_resize_side vertical" @mousedown="resizeFace(key, $event, -1, 0)" @touchstart.prevent="resizeFace(key, $event, -1, 0)" style="height: var(--height)"></div>
											<div class="uv_resize_side vertical" @mousedown="resizeFace(key, $event, 1, 0)" @touchstart.prevent="resizeFace(key, $event, 1, 0)" style="left: var(--width); height: var(--height)"></div>
											<div class="uv_resize_corner uv_c_nw" :class="{main_corner: !face.rotation}" @mousedown="resizeFace(key, $event, -1, -1)" @touchstart.prevent="resizeFace(key, $event, -1, -1)" style="left: 0; top: 0">
												<div class="uv_rotate_field" v-if="!face.rotation" @mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"></div>
											</div>
											<div class="uv_resize_corner uv_c_ne" :class="{main_corner: face.rotation == 270}" @mousedown="resizeFace(key, $event, 1, -1)" @touchstart.prevent="resizeFace(key, $event, 1, -1)" style="left: var(--width); top: 0">
												<div class="uv_rotate_field" v-if="face.rotation == 270" @mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"></div>
											</div>
											<div class="uv_resize_corner uv_c_sw" :class="{main_corner: face.rotation == 90}" @mousedown="resizeFace(key, $event, -1, 1)" @touchstart.prevent="resizeFace(key, $event, -1, 1)" style="left: 0; top: var(--height)">
												<div class="uv_rotate_field" v-if="face.rotation == 90" @mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"></div>
											</div>
											<div class="uv_resize_corner uv_c_se" :class="{main_corner: face.rotation == 180}" @mousedown="resizeFace(key, $event, 1, 1)" @touchstart.prevent="resizeFace(key, $event, 1, 1)" style="left: var(--width); top: var(--height)">
												<div class="uv_rotate_field" v-if="face.rotation == 180" @mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"></div>
											</div>
										</template>
									</div>
								</template>
								
								<div v-else-if="element.type == 'cube'" class="cube_box_uv"
									:key="element.uuid"
									@mousedown.prevent="dragFace(null, $event)"
									@touchstart.prevent="dragFace(null, $event)"
									@click.prevent="selectCube(element, $event)"
									:class="{unselected: display_uv === 'all_elements' && !mappable_elements.includes(element)}"
									:style="{left: toPixels(element.uv_offset[0]), top: toPixels(element.uv_offset[1])}"
								>
									<div class="uv_fill" :style="{left: '-1px', top: toPixels(element.size(2, true), -1), width: toPixels(element.size(2, true)*2 + element.size(0, true)*2, 2), height: toPixels(element.size(1, true), 2)}" />
									<div class="uv_fill" :style="{left: toPixels(element.size(2, true), -1), top: '-1px', width: toPixels(element.size(0, true)*2, 2), height: toPixels(element.size(2, true), 2), borderBottom: 'none'}" />
									<div :style="{left: toPixels(element.size(2, true), -1), top: '-1px', width: toPixels(element.size(0, true), 2), height: toPixels(element.size(2, true) + element.size(1, true), 2)}" />
									<div :style="{left: toPixels(element.size(2, true)*2 + element.size(0, true), -1), top: toPixels(element.size(2, true), -1), width: toPixels(element.size(0, true), 2), height: toPixels(element.size(1, true), 2)}" />
								</div>

								<template v-if="element.type == 'mesh'">
									<div class="mesh_uv_face"
										v-for="(face, key) in filterMeshFaces(element.faces)" :key="element.uuid + ':' + key"
										v-if="face.vertices.length > 2 && (display_uv !== 'selected_faces' || selected_faces.includes(key)) && face.getTexture() == texture"
										:class="{selected: selected_faces.includes(key)}"
										@mousedown.prevent="dragFace(key, $event)"
										@touchstart.prevent="dragFace(key, $event)"
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
										<template v-if="selected_faces.includes(key) && mode == 'uv'">
											<div class="uv_mesh_vertex" v-for="(key, index) in face.vertices"
												:class="{main_corner: index == 0, selected: selected_vertices[element.uuid] && selected_vertices[element.uuid].includes(key)}"
												@mousedown.prevent.stop="dragVertices(element, key, $event)" @touchstart.prevent.stop="dragVertices(element, key, $event)"
												:style="{left: toPixels( face.uv[key][0] - getMeshFaceCorner(face, 0) ), top: toPixels( face.uv[key][1] - getMeshFaceCorner(face, 1) )}"
											>
												<div class="uv_rotate_field" @mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)" v-if="index == 0"></div>
											</div>
										</template>
									</div>
								</template>

							</template>

							<div id="uv_scale_handle" v-if="mode == 'uv' && isScalingAvailable()"
								@mousedown.stop="scaleFaces($event)" @touchstart.prevent.stop="scaleFaces($event)"
								:title="tl('uv_editor.scale_uv')"
								:style="{
									left: toPixels(getSelectedUVBoundingBox()[2], -2),
									top: toPixels(getSelectedUVBoundingBox()[3], -2),
								}
							">
								<i class="fa fa-solid fa-square-up-right"></i>
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

							<div id="uv_brush_outline" v-if="mode == 'paint' && mouse_coords.x >= 0" :class="brush_type" :style="getBrushOutlineStyle()"></div>

							<div id="uv_copy_brush_outline" v-if="copy_brush_source && texture && texture.uuid == copy_brush_source.texture" :style="getCopyBrushOutlineStyle()"></div>

							<img
								:style="{objectFit: texture.frameCount > 1 ? 'cover' : 'fill', objectPosition: \`0 -\${texture.currentFrame * inner_height}px\`}"
								v-if="texture && texture.error != 1 && !texture.display_canvas"
								:src="texture.source"
							>
							<div ref="texture_canvas_wrapper" id="texture_canvas_wrapper" v-if="texture && texture.error != 1 && texture.display_canvas"></div>
							<img style="object-fit: fill; opacity: 0.02; mix-blend-mode: screen;" v-if="texture == 0 && !box_uv" src="./assets/missing_blend.png">
							<svg id="uv_texture_grid" v-if="pixel_grid && mode == 'paint' && texture && texture.width">
								<path :d="textureGrid" />
								<path :d="textureGridBold" class="bold_grid" />
							</svg>
						</div>

						<div class="uv_transparent_face" v-else-if="selected_faces.length">${tl('uv_editor.transparent_face')}</div>
					</div>

					<div v-show="mode == 'paint'" class="bar uv_painter_info">
						<div v-if="copy_overlay.state == 'move'" ref="copy_paste_tool_control" class="copy_paste_tool_control">
							<div class="tool button_cut" @click="copy_overlay.doCut"><div class="tooltip">${tl('uv_editor.copy_paste_tool.cut')}</div><i class="fa_big icon fa fas fa-cut"></i></div>
							<div class="tool button_mirror_x" @click="copy_overlay.doMirror_x"><div class="tooltip">${tl('uv_editor.copy_paste_tool.mirror_x')}</div><i class="icon-mirror_x icon"></i></div>
							<div class="tool button_mirror_y" @click="copy_overlay.doMirror_y"><div class="tooltip">${tl('uv_editor.copy_paste_tool.mirror_y')}</div><i class="icon-mirror_y icon"></i></div>
							<div class="tool button_rotate" @click="copy_overlay.doRotate"><div class="tooltip">${tl('uv_editor.copy_paste_tool.rotate')}</div><i class="material-icons">rotate_right</i></div>

							<div class="tool button_cancel" @click="copy_overlay.doCancel"><div class="tooltip">${tl('dialog.cancel')}</div><i class="material-icons">clear</i></div>
							<div class="tool button_place" @click="copy_overlay.doPlace"><div class="tooltip">${tl('uv_editor.copy_paste_tool.place')}</div><i class="material-icons">check</i></div>
						</div>

						<template v-else>
							<span v-if="copy_overlay.state == 'select'" style="color: var(--color-subtle_text);">{{ copy_overlay.width + ' ⨉ ' + copy_overlay.height }}</span>
							<span v-else style="color: var(--color-subtle_text);">{{ mouse_coords.x < 0 ? '-' : (trimFloatNumber(mouse_coords.x, 1) + ', ' + trimFloatNumber(mouse_coords.y, 1)) }}</span>
							<span v-if="texture" class="uv_panel_texture_name" @click="selectTextureMenu($event)">{{ texture.name }}</span>
							<span style="color: var(--color-subtle_text);">{{ Math.round(this.zoom*100).toString() + '%' }}</span>
						</template>

						<div v-show="copy_overlay.state !== 'move'" id="toggle_uv_overlay_anchor"></div>
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

	Toolbars.uv_editor.toPlace()

	BarItems.paint_mode_uv_overlay.toElement('#toggle_uv_overlay_anchor');

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
			var face = UVEditor.getReferenceFace();
			if (face) {
				let selected_vertices = Project.selected_vertices[elements[0].uuid];
				let has_selected_vertices = selected_vertices && face.vertices.find(vkey => selected_vertices.includes(vkey))
				let min = Infinity;
				face.vertices.forEach(vkey => {
					if ((!has_selected_vertices || selected_vertices.includes(vkey)) && face.uv[vkey]) {
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
		condition: () => UVEditor.vue.selected_faces.length || UVEditor.isBoxUV(),
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
		condition: () => UVEditor.vue.selected_faces.length || UVEditor.isBoxUV(),
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
		condition: () => (UVEditor.isFaceUV() && UVEditor.vue.selected_faces.length),
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
		condition: () => (UVEditor.isFaceUV() && UVEditor.vue.selected_faces.length),
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
})
