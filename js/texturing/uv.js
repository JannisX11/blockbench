function switchBoxUV(state) {
	BARS.updateConditions()
	if (state) {
		Cube.all.forEach(cube => {
			if (cube.faces.west.uv[2] < cube.faces.east.uv[0]) {
				cube.mirror_uv = true;
				cube.uv_offset[0] = cube.faces.west.uv[2];
			} else {
				cube.mirror_uv = false;
				cube.uv_offset[0] = cube.faces.east.uv[0];
			}
			cube.uv_offset[1] = cube.faces.up.uv[3];
		})
	}
	$('#uv_panel_sides').toggle(!state)
	UVEditor.vue.box_uv = state;
	//UVEditor.setGrid(1).setSize(UVEditor.size)//.displayAllMappingOverlays();
	Canvas.updateAllUVs()
}

const UVEditor = {
	face: 'north',
	size: 320,
	zoom: 1,
	grid: 1,
	max_zoom: 16,
	auto_grid: true,
	texture: false,
	panel: null,
	sliders: {},

	get vue() {
		return this.panel.inside_vue;
	},
	/*
	buildDom(toolbar) {
		var scope = this
		if (this.jquery.main) {
			this.jquery.main.detach()
		}
		this.jquery.main = $('<div class="UVEditor" id="UVEditor_' + scope.id + '"></div>')
		if (this.headline) {
			this.jquery.main.append('<div class="uv_headline"><div class="uv_title">'+capitalizeFirstLetter(scope.id)+'</div><div class="tool"><i class="material-icons">fullscreen</i><div class="tooltip">Fullscreen</div></div></div>')
			this.jquery.main.find('div.uv_headline > .tool').click(function() {
				UVEditor.openTab(scope.id)
			})
			this.jquery.main.find('div.uv_headline').click(function(event) {
				event.stopPropagation()
				UVEditor.select(scope.id, event)
			})
		}
		this.jquery.viewport = $('<div id="uv_viewport" class="checkerboard_target"></div>')
		this.jquery.transform_info = $('<div class="uv_transform_info"></div>')
		this.jquery.main.append(this.jquery.transform_info)
		this.jquery.main.append(this.jquery.viewport)

		this.jquery.frame = $(`<div id="uv_frame">
				<div id="uv_size">
					<div class="uv_size_handle"></div>
				</div>
			</div>`);
		this.img = new Image();
		this.img.style.objectFit = Format.animated_textures ? 'cover' : 'fill';
		this.jquery.frame.append(this.img)
		this.jquery.size  = this.jquery.frame.find('div#uv_size')
		this.jquery.viewport.append(this.jquery.frame)
		if (Blockbench.browser === 'firefox') {
			this.jquery.frame.css('image-rendering', '-moz-crisp-edges')
		}
		if (Toolbox.selected.paintTool) {
			this.jquery.size.hide()
		}
		this.jquery.main.toggleClass('checkerboard_trigger', settings.uv_checkerboard.value);

		this.jquery.sliders = $('<div class="bar uv_editor_sliders" style="margin-left: 2px;"></div>')

		this.jquery.main.append(this.jquery.sliders)


		this.jquery.frame.droppable({
			accept: 'li.texture',
			tolerance: 'pointer',
			drop: function(event, ui) {
				if (Cube.selected.length == 0) {
					return
				}
				var id = $(ui.helper).attr('texid')
				scope.applyTexture(id)
			}
		})

		this.jquery.size.mouseenter(function() {
			scope.displayMappingOverlay()
		})
		this.jquery.size.mouseleave(function() {
			$(this).find('.uv_mapping_overlay').remove()
		})

		this.jquery.viewport.contextmenu(function(event) {
			scope.contextMenu()
		})

		this.jquery.viewport.on('mousedown touchstart', function(event) {
			if (Toolbox.selected.paintTool && (event.which === 1 || (event.touches && event.touches.length == 1))) {
				scope.startPaintTool(event)
			}
		})
		this.jquery.viewport.on('mousewheel', function(e) {
			let event = e.originalEvent;

			if (event.ctrlOrCmd) {

				event.stopPropagation()

				var n = (event.deltaY < 0) ? 0.1 : -0.1;
				n *= scope.zoom
				var number = limitNumber(scope.zoom + n, 1, scope.max_zoom)
				let old_zoom = scope.zoom;

				scope.setZoom(number)
				event.preventDefault()

				let offset = scope.jquery.viewport.offset()
				let offsetX = event.clientX - offset.left;
				let offsetY = event.clientY - offset.top;

				let zoom_diff = scope.zoom - old_zoom;
				this.scrollLeft += ((this.scrollLeft + offsetX) * zoom_diff) / old_zoom
				this.scrollTop  += ((this.scrollTop  + offsetY) * zoom_diff) / old_zoom

				scope.updateBrushOutline(e)

				return false;
			}
		})
		.on('scroll', e => {
			scope.updateDragHandle()
		})

		var dMWCoords = {x: 0, y: 0}
		function dragMouseWheel(e) {
			scope.jquery.viewport[0].scrollLeft -= (e.pageX - dMWCoords.x)
			scope.jquery.viewport[0].scrollTop -= (e.pageY - dMWCoords.y)
			dMWCoords = {x: e.pageX, y: e.pageY}
		}
		function dragMouseWheelStop(e) {
			removeEventListeners(document, 'mousemove touchmove', dragMouseWheel);
			removeEventListeners(document, 'mouseup touchend', dragMouseWheelStop);
		}
		scope.jquery.viewport.on('mousedown touchstart', function(e) {
			if (e.which === 2) {
				addEventListeners(document, 'mousemove touchmove', dragMouseWheel);
				addEventListeners(document, 'mouseup touchend', dragMouseWheelStop);
				dMWCoords = {x: e.pageX, y: e.pageY}
				e.preventDefault();
				return false;
			}
		})
		//Paint brush outline
		this.brush_outline = $('<div id="uv_brush_outline"></div>');
		scope.jquery.frame.on('mouseenter mousemove', e => {
			this.updateBrushOutline(e)
		})
		scope.jquery.frame.on('mouseleave', e => {
			this.brush_outline.detach();
		})
		this.setSize(this.size)
		return this;
	},
	*/
	updateBrushOutline(e) {
		if (Modes.paint && Toolbox.selected.brushTool) {
			UVEditor.vue.$refs.frame.append(this.brush_outline);
			let outline = this.brush_outline.get(0);
			var pixel_size = this.inner_width / (this.texture ? this.texture.width : Project.texture_width);
			//pos
			let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brushTool ? 0.5 : 0;
			let left = (0.5 - offset + Math.floor(e.offsetX / pixel_size + offset)) * pixel_size;
			let top =  (0.5 - offset + Math.floor(e.offsetY / pixel_size + offset)) * pixel_size;
			outline.style.left = left+'px'
			outline.style.top = top+'px';
			//size
			var radius = (BarItems.slider_brush_size.get()/2) * pixel_size;
			outline.style.padding = radius+'px'
			outline.style.margin = (-radius)+'px';
		} else {
			this.brush_outline.detach();
		}
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
		var scope = this;
		convertTouchEvent(event);
		var pixel_size = scope.inner_width / tex.width
		var result = {};

		if (Toolbox.selected.id === 'copy_paste_tool') {
			result.x = Math.round(event.offsetX/pixel_size*1);
			result.y = Math.round(event.offsetY/pixel_size*1);
		} else {
			let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brushTool ? 0.5 : 0;
			result.x = Math.floor(event.offsetX/pixel_size*1 + offset);
			result.y = Math.floor(event.offsetY/pixel_size*1 + offset);
		}
		if (tex.frameCount) result.y += (tex.height / tex.frameCount) * tex.currentFrame;
		return result;
	},
	startPaintTool(event) {
		var scope = this;
		Painter.active_uv_editor = scope;

		var texture = scope.getTexture()
		if (texture) {
			var coords = scope.getBrushCoordinates(event, texture)

			if (Toolbox.selected.id !== 'copy_paste_tool') {
				Painter.startPaintTool(texture, coords.x, coords.y, undefined, event)
			} else {
				this.startSelection(texture, coords.x, coords.y, event)
			}
		}
		if (Toolbox.selected.id !== 'color_picker' && texture) {
			addEventListeners(this.vue.$refs.frame, 'mousemove touchmove', UVEditor.movePaintTool, false );
			addEventListeners(document, 'mouseup touchend', UVEditor.stopBrush, false );
		}
	},
	movePaintTool(event) {
		var scope = Painter.active_uv_editor;
		var texture = scope.getTexture()
		if (!texture) {
			Blockbench.showQuickMessage('message.untextured')
		} else {
			var new_face;
			var {x, y} = scope.getBrushCoordinates(event, texture);
			if (texture.img.naturalWidth + texture.img.naturalHeight == 0) return;

			if (x === Painter.current.x && y === Painter.current.y) {
				return
			}
			if (Painter.current.face !== scope.face) {
				Painter.current.x = x
				Painter.current.y = y
				Painter.current.face = scope.face
				new_face = true;
				if (texture !== Painter.current.texture && Undo.current_save) {
					Undo.current_save.addTexture(texture)
				}
			}
			if (Toolbox.selected.id !== 'copy_paste_tool') {
				Painter.movePaintTool(texture, x, y, event, new_face)
			} else {
				scope.dragSelection(texture, x, y, event)
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
	startSelection(texture, x, y, event) {
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
			rect.id = 'texture_selection_rect';
			this.vue.$refs.frame.append(rect)
			Painter.selection.rect = rect;
			Painter.selection.start_x = x;
			Painter.selection.start_y = y;
		} else {
			Painter.selection.start_x = Painter.selection.x;
			Painter.selection.start_y = Painter.selection.y;
			Painter.selection.start_event = event;
		}
	},
	dragSelection(texture, x, y, event) {
		let m = this.inner_width / this.texture.width;

		if (!Painter.selection.overlay) {
			let calcrect = getRectangle(Painter.selection.start_x, Painter.selection.start_y, x, y)
			Painter.selection.calcrect = calcrect;
			Painter.selection.x = calcrect.ax;
			Painter.selection.y = calcrect.ay;
			$(Painter.selection.rect)
				.css('left', 	calcrect.ax*m + 'px')
				.css('top', 	calcrect.ay*m + 'px')
				.css('width', 	calcrect.x *m + 'px')
				.css('height', 	calcrect.y *m + 'px')
		} else if (this.texture && Painter.selection.canvas) {
			Painter.selection.x = Painter.selection.start_x + Math.round((event.clientX - Painter.selection.start_event.clientX) / m);
			Painter.selection.y = Painter.selection.start_y + Math.round((event.clientY - Painter.selection.start_event.clientY) / m);
			Painter.selection.x = Math.clamp(Painter.selection.x, 0, this.texture.width-Painter.selection.canvas.width)
			Painter.selection.y = Math.clamp(Painter.selection.y, 0, this.texture.height-Painter.selection.canvas.height)
			this.updatePastingOverlay()
		}
	},
	stopSelection() {
		if (Painter.selection.rect) {
			Painter.selection.rect.remove()
		}
		if (Painter.selection.overlay || !Painter.selection.calcrect) return;
		if (Painter.selection.calcrect.x == 0 || Painter.selection.calcrect.y == 0) return;

		let calcrect = Painter.selection.calcrect;
		var canvas = document.createElement('canvas')
		var ctx = canvas.getContext('2d');
		canvas.width = calcrect.x;
		canvas.height = calcrect.y;
		ctx.drawImage(this.vue.texture.img, -calcrect.ax, -calcrect.ay)

		if (isApp) {
			let image = nativeImage.createFromDataURL(canvas.toDataURL())
			clipboard.writeImage(image)
		}
		Painter.selection.canvas = canvas;

		this.addPastingOverlay();
	},
	addPastingOverlay() {
		if (Painter.selection.overlay) return;
		let scope = this;
		let overlay = $(`<div id="texture_pasting_overlay">
			<div class="control">
				<div class="button_place" title="${tl('uv_editor.copy_paste_tool.place')}"><i class="material-icons">check_circle</i></div>
				<div class="button_cancel" title="${tl('dialog.cancel')}"><i class="material-icons">cancel</i></div>
				<div class="button_cut" title="${tl('uv_editor.copy_paste_tool.cut')}"><i class="fas fa-cut"></i></div>
				<div class="button_mirror_x" title="${tl('uv_editor.copy_paste_tool.mirror_x')}"><i class="icon-mirror_x icon"></i></div>
				<div class="button_mirror_y" title="${tl('uv_editor.copy_paste_tool.mirror_y')}"><i class="icon-mirror_y icon"></i></div>
				<div class="button_rotate" title="${tl('uv_editor.copy_paste_tool.rotate')}"><i class="material-icons">rotate_right</i></div>
			</div>
		</div>`)

		open_interface = {
			confirm() {
				scope.removePastingOverlay()
				if (scope.texture) {
					scope.texture.edit((canvas) => {
						var ctx = canvas.getContext('2d');
						ctx.drawImage(Painter.selection.canvas, Painter.selection.x, Painter.selection.y)
					})
				}
			},
			hide() {
				scope.removePastingOverlay()
			}
		}
		overlay.find('.button_place').click(open_interface.confirm);
		overlay.find('.button_cancel').click(open_interface.hide);

		function getCanvasCopy() {
			var temp_canvas = document.createElement('canvas')
			var temp_ctx = temp_canvas.getContext('2d');
			temp_canvas.width = Painter.selection.canvas.width;
			temp_canvas.height = Painter.selection.canvas.height;
			temp_ctx.drawImage(Painter.selection.canvas, 0, 0)
			return temp_canvas
		}
		overlay.find('.button_cut').click(e => {

				scope.removePastingOverlay()
				scope.texture.edit((canvas) => {
					var ctx = canvas.getContext('2d');
					ctx.clearRect(Painter.selection.x, Painter.selection.y, Painter.selection.canvas.width, Painter.selection.canvas.height);
				})

		})
		overlay.find('.button_mirror_x').click(e => {
			let temp_canvas = getCanvasCopy()

			let ctx = Painter.selection.canvas.getContext('2d');
			ctx.save();
			ctx.translate(ctx.canvas.width, 0);
			ctx.scale(-1, 1);

			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			ctx.drawImage(temp_canvas, ctx.canvas.width, 0, -ctx.canvas.width, ctx.canvas.height);
			ctx.restore();
		})
		overlay.find('.button_mirror_y').click(e => {
			let temp_canvas = getCanvasCopy()

			let ctx = Painter.selection.canvas.getContext('2d');
			ctx.save();
			ctx.translate(0, ctx.canvas.height);
			ctx.scale(1, -1);

			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			ctx.drawImage(temp_canvas, 0, ctx.canvas.height, ctx.canvas.width, -ctx.canvas.height);
			ctx.restore();
		})
		overlay.find('.button_rotate').click(e => {
			let temp_canvas = getCanvasCopy()

			let ctx = Painter.selection.canvas.getContext('2d');
			[ctx.canvas.width, ctx.canvas.height] = [ctx.canvas.height, ctx.canvas.width]
			ctx.save();
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

			ctx.translate(ctx.canvas.width/2,ctx.canvas.height/2);
			ctx.rotate(Math.PI/2);

			ctx.drawImage(temp_canvas,-temp_canvas.width/2,-temp_canvas.height/2);

			//ctx.rotate(-Math.PI/2);

			ctx.restore();
			scope.updateSize()
		})
		overlay.append(Painter.selection.canvas)
		Painter.selection.overlay = overlay;
		$(UVEditor.vue.$refs.frame).append(overlay)
		Painter.selection.x = Math.clamp(Painter.selection.x, 0, this.texture.width-Painter.selection.canvas.width)
		Painter.selection.y = Math.clamp(Painter.selection.y, 0, this.texture.height-Painter.selection.canvas.height)
		this.updateSize()


		function clickElsewhere(event) {
			if (!Painter.selection.overlay) {
				removeEventListeners(document, 'mousedown touchstart', clickElsewhere)
			} else if (Painter.selection.overlay.has(event.target).length == 0) {
				open_interface.confirm()
			}
			/*
			if (!Painter.selection.overlay) {
				removeEventListeners(document, 'mousedown touchstart', clickElsewhere)
			} else if (Painter.selection.overlay.has(event.target).length == 0) {
				open_interface.confirm()
			}
			*/
		}
		addEventListeners(document, 'mousedown touchstart', clickElsewhere)
	},
	removePastingOverlay() {
		Painter.selection.overlay.detach();
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
			.css('top', Painter.selection.y * m);
		return this;
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
	getPixelSize() {
		if (Project.box_uv) {
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
		let object = 'object'
		return Outliner.selected.filter(el => typeof el.faces == object);
	},
	getUVTag(obj) {
		if (!obj) obj = Cube.selected[0]
		if (Project.box_uv) {
			return [obj.uv_offset[0], obj.uv_offset[1], 0, 0];
		} else {
			return obj.faces[this.face].uv;
		}
	},
	getTexture() {
		if (Format.single_texture) return Texture.getDefault();
		return this.vue.texture;
	},
	//Set
	setZoom(zoom) {
		this.vue.zoom = zoom;
		return this;
	},
	setGrid(value) {
		return this;
		var update = this.id == 'UVEditor' || open_dialog == 'UVEditor';
		if (value == 'auto') {
			this.auto_grid = true;
			if (update) this.displayTexture();
		} else {
			value = parseInt(value);
			if (typeof value !== 'number') value = 1;
			this.grid = Math.clamp(value, 1, 1024);
			this.auto_grid = false;
		}
		if (update) this.updateSize();
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
			for (var face in cube.faces) {
				var uv = cube.faces[face].uv
				if (uv && Math.isBetween(u, uv[0], uv[2]) && Math.isBetween(v, uv[1], uv[3]) && (cube.faces[face].getTexture() === scope.vue.texture || Format.single_texture)) {
					matches.safePush(cube)
					face_matches.safePush(face)
					break;
				}
			}
		})
		if (matches.length) {
			if (!Project.box_uv) {
				UVEditor.vue.selected_faces.replace(face_matches);
			}
			if (!event.shiftKey && !Pressing.overrides.shift && !event.ctrlOrCmd && !Pressing.overrides.ctrl) {
				Project.selected_elements.empty();
			}
			matches.forEach(s => {
				Project.selected_elements.safePush(s)
			});
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
	//Load
	loadSelectedFace() {
		this.face = $('#uv_panel_sides input:checked').attr('id').replace('_radio', '')
		this.loadData()
		return false;
	},
	loadData() {
		this.vue.updateTexture();
		this.displaySliders();
		this.displayTools();
		this.vue.$forceUpdate();
		return this;
		if (Cube.selected.length === 0 && !Modes.paint) return;
		var face = Cube.selected[0] && Cube.selected[0].faces[this.face];
		
		//Set Rotation

		this.displayTexture(face)
		this.displayFrame()//and transform info
		if (this !== UVEditor && this.face === UVEditor.face) {
			UVEditor.loadData()
		}
	},
	save(pos_only) {
		if (!Modes.edit) return;
		var scope = this;
		//Save UV from Frame to object

		if (Project.box_uv) {

			Cube.selected.forEach(function(obj) {
				obj.uv_offset = [
					Math.round(scope.jquery.size.position().left / (scope.inner_width/Project.texture_width) * 8) / 8,
					Math.round(scope.jquery.size.position().top  / (scope.inner_width/Project.texture_width) * 8) / 8
				]
				Canvas.updateUV(obj)
			})

		} else {
			var trim = v => Math.round(v * this.grid) / this.grid;
			var pixelSize = this.inner_width/this.getResolution(0);

			var position = this.jquery.size.position()
			var left = trim( position.left / pixelSize);
			var top  = trim( position.top / pixelSize);
			var left2= Math.clamp(trim( (this.jquery.size.width() + position.left) / pixelSize), 0, this.getResolution(0));
			var top2 = Math.clamp(trim( (this.jquery.size.height() + position.top) / pixelSize), 0, this.getResolution(1));

			var uvTag = this.getUVTag()

			if (uvTag[0] > uvTag[2]) {
				left2 = [left, left = left2][0];
			}
			if (uvTag[1] > uvTag[3]) {
				top2 = [top, top = top2][0];
			}

			Cube.selected.forEach(function(obj) {
				let {uv} = obj.faces[scope.face];
				if (pos_only) {
					let diff_x = left > left2 ? left2 - uv[2] : left - uv[0];
					let diff_y = top  > top2  ? top2  - uv[3] : top  - uv[1];
					uv[0] += diff_x;
					uv[1] += diff_y;
					uv[2] += diff_x;
					uv[3] += diff_y;
				} else {
					uv.replace([left, top, left2, top2])
				}
				Canvas.updateUV(obj)
			})
		}

		if (this !== UVEditor && this.face === UVEditor.face) {
			UVEditor.loadData()
		}
	},
	applyTexture(uuid) {
		var scope = this;
		Undo.initEdit({elements: Cube.selected, uv_only: true})
		this.forCubes(obj => {
			obj.faces[scope.face].texture = uuid
		})
		this.loadData()
		Canvas.updateSelectedFaces()
		Undo.finishEdit('Apply texture')
	},
	displayTexture(face) {
		return this;
		if (!face && Cube.selected.length) {
			var face = Cube.selected[0].faces[this.face];
		}
		var tex = face ? face.getTexture() : Texture.getDefault();
		if (!tex || typeof tex !== 'object' || (tex.error && tex.error != 2)) {
			this.img.src = '';
			this.img.style.display = 'none';
			this.texture = false;
		} else {
			this.img.src = tex.source;
			this.img.style.display = 'block';
			this.texture = tex;
			if (!Project.box_uv && this.auto_grid) {
				this.grid = tex.width / Project.texture_width;
			}
		}
		if (!tex || typeof tex !== 'object') {
			if (!Format.single_texture && Texture.selected) {
				unselectTextures()
			}
		} else if (Texture.selected != tex) {
			tex.select()
		}
		this.setSize(this.size, true)
	},
	displayTransformInfo() {
		return this;
		var ref = Cube.selected[0].faces[this.face]
		this.jquery.transform_info.text('')
		if (Project.box_uv) return;

		if (ref.uv[0] > ref.uv[2]) {
			this.jquery.transform_info.append('<b>X</b>')
		}
		if (ref.uv[1] > ref.uv[3]) {
			this.jquery.transform_info.append('<b>Y</b>')
		}
		if (ref.rotation) {
			this.jquery.transform_info.append('<b>'+ref.rotation+'</b>')
		}
	},
	displaySliders() {
		if (!Cube.selected.length) return;
		this.sliders.pos_x.update()
		this.sliders.pos_y.update()
		this.sliders.size_x.update()
		this.sliders.size_y.update()
		let face = this.getReferenceFace();
		BarItems.uv_rotation.set((face && face.rotation)||0)
	},
	displayTools() {
		//Cullface
		if (!Cube.selected.length) return;
		var face = Cube.selected[0].faces[this.face]
		BarItems.cullface.set(face.cullface||'off')
		BarItems.face_tint.setIcon(face.tint !== -1 ? 'check_box' : 'check_box_outline_blank')
		BarItems.slider_face_tint.update()
	},
	contextMenu(event) {
		var scope = this;
		UVEditor.getReferenceFace() = Cube.selected[0] && Cube.selected[0].faces[scope.face];
		UVEditor.menu.open(event, UVEditor)
		return UVEditor;
	},
	slidePos(modify, axis) {
		var scope = this
		var limit = scope.getResolution(axis);

		Cube.selected.forEach(function(obj) {
			if (Project.box_uv === false) {
				var uvTag = scope.getUVTag(obj)
				var size = uvTag[axis + 2] - uvTag[axis]

				var value = modify(uvTag[axis])

				value = limitNumber(value, 0, limit)
				value = limitNumber(value + size, 0, limit) - size

				uvTag[axis] = value
				uvTag[axis+2] = value + size
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
			Canvas.updateUV(obj)
		})
		this.displaySliders()
		this.vue.$forceUpdate()
	},
	slideSize(modify, axis) {
		var scope = this
		var limit = scope.getResolution(axis);

		Cube.selected.forEach(function(obj) {
			if (Project.box_uv === false) {

				var uvTag = scope.getUVTag(obj)
				var difference = modify(uvTag[axis+2]-uvTag[axis]) + uvTag[axis]
				uvTag[axis+2] = limitNumber(difference, 0, limit);
				Canvas.updateUV(obj)
			}
		})
		this.displaySliders()
		this.disableAutoUV()
		this.vue.$forceUpdate()
	},
	getResolution(axis, texture) {
		return axis ? Project.texture_height : Project.texture_width;
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
	},
	disableAutoUV() {
		this.forCubes(obj => {
			obj.autouv = 0
		})
	},
	toggleUV() {
		var scope = this
		var state = Cube.selected[0].faces[this.face].enabled === false
		this.forCubes(obj => {
			obj.faces[scope.face].enabled = state
		})
	},
	maximize(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(obj, event).forEach(function(side) {
				obj.faces[side].uv = [0, 0, scope.getResolution(0, obj.faces[side]), scope.getResolution(1, obj.faces[side])]
			})
			obj.autouv = 0
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
			})
			obj.autouv = 0;
			Canvas.updateUV(obj);
		})
		this.message('uv_editor.turned');
		this.loadData();
	},
	setAutoSize(event) {
		var scope = this;
		var top2, left2;

		this.forCubes(obj => {
			scope.getFaces(obj, event).forEach(function(side) {
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
				left2 *= scope.getResolution(0, face) / Project.texture_width;
				top2 *= scope.getResolution(1, face) / Project.texture_height;
				face.uv_size = [left2, top2];
				if (mirror_x) [face.uv[0], face.uv[2]] = [face.uv[2], face.uv[0]];
				if (mirror_y) [face.uv[1], face.uv[3]] = [face.uv[3], face.uv[1]];
			})
			obj.autouv = 0
			Canvas.updateUV(obj)
		})
		this.message('uv_editor.autouv')
		this.loadData()
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
		this.forCubes(obj => {
			scope.getFaces(obj, event).forEach(function(side) {
				var proxy = obj.faces[side].uv[0]
				obj.faces[side].uv[0] = obj.faces[side].uv[2]
				obj.faces[side].uv[2] = proxy
			})
			obj.autouv = 0
			Canvas.updateUV(obj)
		})
		this.message('uv_editor.mirrored')
		this.loadData()
	},
	mirrorY(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(obj, event).forEach(function(side) {
				var proxy = obj.faces[side].uv[1]
				obj.faces[side].uv[1] = obj.faces[side].uv[3]
				obj.faces[side].uv[3] = proxy
			})
			obj.autouv = 0
			Canvas.updateUV(obj)
		})
		this.message('uv_editor.mirrored')
		this.loadData()
	},
	applyAll(event) {
		var scope = this;
		this.forCubes(obj => {
			UVEditor.cube_faces.forEach(function(side) {
				$.extend(true, obj.faces[side], obj.faces[scope.face]) 
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
		var scope = this;
		Undo.initEdit({elements: Cube.selected, uv_only: true})
		var val = BarItems.cullface.get()
		if (val === 'off') val = false
		this.forCubes(obj => {
			obj.faces[scope.face].cullface = val || '';
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
		var val = Cube.selected[0].faces[scope.face].tint === -1 ? 0 : -1;

		if (event === 0 || event === false) val = event
		this.forCubes(obj => {
			obj.faces[scope.face].tint = val
		})
		if (val !== -1) {
			this.message('uv_editor.tint_on')
		} else {
			this.message('uv_editor.tint_off')
		}
		this.displayTools()
	},
	setTint(event, val) {
		var scope = this;

		this.forCubes(obj => {
			obj.faces[scope.face].tint = val
		})
		this.displayTools()
	},
	rotate() {
		var scope = this;
		var value = parseInt(BarItems.uv_rotation.get())
		this.forCubes(obj => {
			obj.faces[scope.face].rotation = value
			Canvas.updateUV(obj)
		})
		this.displayTransformInfo()
		this.message('uv_editor.rotated')
	},
	setRotation(value) {
		var scope = this;
		value = parseInt(value)
		this.forCubes(obj => {
			obj.faces[scope.face].rotation = value
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
		if (Cube.selected.length === 0) return;

		UVEditor.clipboard = []

		if (Project.box_uv) {
			var new_tag = {
				uv: Cube.selected[0].uv_offset
			}
			UVEditor.clipboard.push(new_tag)
			this.message('uv_editor.copied')
			return;
		}

		function addToClipboard(face) {
			if (Project.box_uv) {
				var new_tag = {
					uv: Cube.selected[0].uv_offset
				}
				UVEditor.clipboard.push(new_tag)
				return;
			}
			var tag = Cube.selected[0].faces[face]
			var new_tag = new Face(face, tag)
			UVEditor.clipboard.push(new_tag)
		}
		if (event.shiftKey) {
			UVEditor.cube_faces.forEach(function(s) {
				addToClipboard(s)
			})
		} else {
			addToClipboard(this.face)
		}
		this.message('uv_editor.copied_x', [UVEditor.clipboard.length])
	},
	paste(event) {
		if (UVEditor.clipboard === null || Cube.selected.length === 0) return;

		Undo.initEdit({elements: Cube.selected, uv_only: true})
		if (Project.box_uv) {
			Cube.selected.forEach(function(obj) {
				obj.uv_offset = UVEditor.clipboard[0].uv.slice()
				Canvas.updateUV(obj)
			})
			this.loadData()
			this.message('uv_editor.pasted')
			Undo.finishEdit('Paste UV')
			return;
		}

		function applyFace(tag, face) {
			if (!face) face = tag.face
			Cube.selected.forEach(function(obj) {
				obj.faces[face].extend(tag)
				Canvas.updateUV(obj)
			})
		}

		if (event) {
			if (event.shiftKey) {
				UVEditor.cube_faces.forEach(function(s) {
					applyFace(UVEditor.clipboard[0], s)
				})
			} else {
				if (UVEditor.clipboard.length === 1) {
					applyFace(UVEditor.clipboard[0], UVEditor.face)
				} else {
					UVEditor.clipboard.forEach(function(s) {
						applyFace(s, s.direction)
					})
				}
			}
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
			if (Prop.view_mode === 'textured') {
				obj.preview_controller.updateUV(obj);
			}
		})
		this.loadData()
		this.message('uv_editor.reset')
	},

	// Dialog
	clipboard: null,
	cube_faces: ['north', 'south', 'west', 'east', 'up', 'down'],
	forSelection(cb, event, ...args) {
		UVEditor[cb](...args);
		/*
		if (open_dialog === false) {
			UVEditor[cb](event, ...args)
		} else if (UVEditor.single) {
			UVEditor.editors.single[cb](...args)
		} else {
			if (UVEditor.selection.length > 0) {
				UVEditor.selection.forEach(function(s) {
					UVEditor.editors[s][cb](...args)
				})
			} else {
				UVEditor.cube_faces.forEach(function(s) {
					UVEditor.editors[s][cb](...args)
				})
			}
		}*/
	},
	/*
	copy(event) {

		let element = UVEditor.getMappableElements()[0]
		if (!element) return;
		UVEditor.clipboard = []

		function addToClipboard(face) {
			var tag = element.faces[face]
			if (tag && element instanceof Cube) {
				UVEditor.clipboard.push(new Face(null, tag))
			} else if (tag && element instanceof Mesh) {
				UVEditor.clipboard.push(new MeshFace(null, tag))
			}
		}
		UVEditor.vue.selected_faces.forEach(function(s) {
			addToClipboard(s)
			UVEditor.message('uv_editor.copied')
		})
	},
	paste(event) {
		if (UVEditor.clipboard === null || Cube.selected.length === 0) return;

		function applyFace(tag, face) {
			if (!face) face = tag.face
			UVEditor.getMappableElements().forEach(function(obj) {
				if (obj.faces[face]) {
					obj.faces[face].extend(tag);
					Canvas.updateUV(obj);
				}
			})
		}

		if (UVEditor.vue.selected_faces.length === 1) {
			applyFace(UVEditor.clipboard[0], UVEditor.vue.selected_faces[0])
		} else {
			if (UVEditor.clipboard.length === 1) {
				UVEditor.vue.selected_faces.forEach(function(s) {
					applyFace(UVEditor.clipboard[0], s)
				})
			} else {
				UVEditor.clipboard.forEach(function(s) {
					if (UVEditor.vue.selected_faces.includes(s.face)) {
						applyFace(s)
					}
				})
			}
		}
		UVEditor.message('uv_editor.pasted')
		UVEditor.loadData()
	},*/


	menu: new Menu([
		{name: 'menu.view.zoom', id: 'zoom', condition: isApp, icon: 'search', children: [
			'zoom_in',
			'zoom_out',
			'zoom_reset'
		]},
		'uv_checkerboard',
		'_',
		'copy',
		'paste',
		{icon: 'photo_size_select_large', name: 'menu.uv.mapping', condition: () => !Project.box_uv, children: function(editor) { return [
			{icon: UVEditor.getReferenceFace().enabled!==false ? 'check_box' : 'check_box_outline_blank', name: 'generic.export', click: function() {
				Undo.initEdit({elements: Cube.selected, uv_only: true})
				UVEditor.toggleUV(event)
				Undo.finishEdit('Toggle UV export')
			}},
			'uv_maximize',
			'uv_auto',
			'uv_rel_auto',
			{icon: 'rotate_90_degrees_ccw', condition: () => Format.uv_rotation, name: 'menu.uv.mapping.rotation', children: function() {
				var off = 'radio_button_unchecked'
				var on = 'radio_button_checked'
				return [
					{icon: (!UVEditor.getReferenceFace().rotation ? on : off), name: '0&deg;', click: function() {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						UVEditor.setRotation(0)
						Undo.finishEdit('Rotate UV')
					}},
					{icon: (UVEditor.getReferenceFace().rotation === 90 ? on : off), name: '90&deg;', click: function() {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						UVEditor.setRotation(90)
						Undo.finishEdit('Rotate UV')
					}},
					{icon: (UVEditor.getReferenceFace().rotation === 180 ? on : off), name: '180&deg;', click: function() {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						UVEditor.setRotation(180)
						Undo.finishEdit('Rotate UV')
					}},
					{icon: (UVEditor.getReferenceFace().rotation === 270 ? on : off), name: '270&deg;', click: function() {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						UVEditor.setRotation(270)
						Undo.finishEdit('Rotate UV')
					}}
				]
			}},
			'uv_turn_mapping',
			{
				icon: (UVEditor.getReferenceFace().uv[0] > UVEditor.getReferenceFace().uv[2] ? 'check_box' : 'check_box_outline_blank'),
				name: 'menu.uv.mapping.mirror_x',
				click: function() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					UVEditor.mirrorX(event)
					Undo.finishEdit('Mirror UV')
				}
			},
			{
				icon: (UVEditor.getReferenceFace().uv[1] > UVEditor.getReferenceFace().uv[3] ? 'check_box' : 'check_box_outline_blank'),
				name: 'menu.uv.mapping.mirror_y',
				click: function() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					UVEditor.mirrorY(event)
					Undo.finishEdit('Mirror UV')
				}
			},
		]}},
		'face_tint',
		{icon: 'flip_to_back', condition: () => (Format.id == 'java_block'&& Cube.selected.length), name: 'action.cullface' , children: function() {
			var off = 'radio_button_unchecked';
			var on = 'radio_button_checked';
			function setCullface(cullface) {
				Undo.initEdit({elements: Cube.selected, uv_only: true})
				UVEditor.forCubes(obj => {
					obj.faces[UVEditor.face].cullface = cullface;
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
		{icon: 'collections', name: 'menu.uv.texture', condition: () => !Project.box_uv, children: function() {
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
					Undo.initEdit('texture blank')
				}},
				{icon: 'clear', name: 'menu.cube.texture.transparent', click: function() {UVEditor.clear(event)}},
			]
			Texture.all.forEach(function(t) {
				arr.push({
					name: t.name,
					icon: (t.mode === 'link' ? t.img : t.source),
					click: function() {UVEditor.applyTexture(t.uuid)}
				})
			})
			return arr;
		}}
	])
}


BARS.defineActions(function() {
	/*
	new Action('UVEditor', {
		icon: 'view_module',
		category: 'blockbench',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function () {UVEditor.openAll()}
	})
	new Action('UVEditor_full', {
		icon: 'web_asset',
		category: 'blockbench',
		click: function () {UVEditor.openFull()}
	})*/


	new BarSlider('uv_rotation', {
		category: 'uv',
		condition: () => !Project.box_uv && Format.uv_rotation && Cube.selected.length,
		min: 0, max: 270, step: 90, width: 80,
		onBefore: () => {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
		},
		onChange: function(slider) {
			//UVEditor.forSelection('rotate')
		},
		onAfter: () => {
			Undo.finishEdit('Rotate UV')
		}
	})
	new BarSelect('uv_grid', { 
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
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
	/*
	new Action('uv_select_all', {
		icon: 'view_module',
		category: 'uv',
		condition: () => open_dialog === 'UVEditor',
		click: UVEditor.selectAll
	})
	*/
	new Action('uv_maximize', {
		icon: 'zoom_out_map',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) { 
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('maximize', event)
			Undo.finishEdit('Maximize UV')
		}
	})
	new Action('uv_turn_mapping', {
		icon: 'screen_rotation',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) { 
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('turnMapping', event)
			Undo.finishEdit('Turn UV mapping')
		}
	})
	new Action('uv_auto', {
		icon: 'brightness_auto',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('setAutoSize', event)
			Undo.finishEdit('Auto UV')
		}
	})
	new Action('uv_rel_auto', {
		icon: 'brightness_auto',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('setRelativeAutoSize', event)
			Undo.finishEdit('Auto UV')
		}
	})
	new Action('uv_mirror_x', {
		icon: 'icon-mirror_x',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('mirrorX', event)
			Undo.finishEdit('Mirror UV')
		}
	})
	new Action('uv_mirror_y', {
		icon: 'icon-mirror_y',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('mirrorY', event)
			Undo.finishEdit('Mirror UV')
		}
	})
	new Action('uv_transparent', {
		icon: 'clear',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			UVEditor.forSelection('clear', event)
		}
	})
	new Action('uv_reset', {
		icon: 'replay',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('reset', event)
			Undo.finishEdit('Reset UV')
		}
	})
	new Action('uv_apply_all', {
		icon: 'format_color_fill',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (e) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.applyAll(e)
			Undo.finishEdit('Apply UV to all faces')
		}
	})
	new BarSelect('cullface', { 
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
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
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('autoCullface', event)
			Undo.finishEdit('Set automatic cullface')
		}
	})
	new Action('face_tint', {
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('switchTint', event)
			Undo.finishEdit('Toggle face tint')
		}
	})
	new NumSlider('slider_face_tint', {
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		getInterval(event) {
			return 1;
		},
		get: function() {
			return Cube.selected[0] && Cube.selected[0].faces[UVEditor.face].tint
		},
		change: function(modify) {
			let number = Math.clamp(Math.round(modify(this.get())), -1)

			UVEditor.forSelection('setTint', event, number)
		},
		onBefore: function() {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
		},
		onAfter: function() {
			Undo.finishEdit('Set face tint')
		}
	})


	new Toggle('toggle_uv_overlay', {
		//condition: () => Project.box_uv,
		icon: 'view_quilt',
		category: 'uv',
		onChange(value) {
			UVEditor.vue.showing_overlays = value;
		}
	})
})

Interface.definePanels(function() {
	
	UVEditor.panel = Interface.Panels.uv = new Panel({
		id: 'uv',
		icon: 'photo_size_select_large',
		selection_only: true,
		condition: {modes: ['edit', 'paint']},
		toolbars: {
			bottom: Toolbars.UVEditor
		},
		onResize: function() {
			UVEditor.vue.updateSize()
		},
		component: {
			data() {return {
				mode: 'uv',
				box_uv: false,
				width: 320,
				height: 320,
				zoom: 1,
				checkerboard: settings.uv_checkerboard.value,
				texture: 0,
				mouse_coords: {x: -1, y: -1},

				project_resolution: [16, 16],
				elements: [],
				all_elements: [],
				selected_vertices: {},
				selected_faces: [],
				showing_overlays: false,

				face_names: {
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
					return this.width * this.zoom;
				},
				inner_height() {
					return this.width * (this.project_resolution[1] / this.project_resolution[0]) * this.zoom;
				},
				mappable_elements() {
					return this.elements.filter(element => element.faces);
				},
				all_mappable_elements() {
					return this.all_elements.filter(element => element.faces);
				}
			},
			watch: {
				project_resolution: {
					deep: true,
					handler() {
						let min_zoom = Math.min(1, this.inner_width/this.inner_height);
						if (this.zoom < min_zoom) this.zoom = 1;
					}
				}
			},
			methods: {
				projectResolution() {
					BarItems.project_window.trigger()
				},
				updateSize() {
					if (!this.$refs.viewport) return;
					let old_size = this.width;
					let size = Math.floor(Math.clamp(UVEditor.panel.width - 10, 64, 1e5));
					this.width = size;
					this.height = size * Math.clamp(this.project_resolution[1] / this.project_resolution[0], 0.5, 1);
					this.$refs.viewport.scrollLeft = Math.round(this.$refs.viewport.scrollLeft * (size / old_size));
					this.$refs.viewport.scrollTop  = Math.round(this.$refs.viewport.scrollTop  * (size / old_size));

					for (var id in UVEditor.sliders) {
						var slider = UVEditor.sliders[id];
						slider.setWidth(size/(Project.box_uv?2:4)-1)
						slider.node.style.setProperty('display', BARS.condition(slider.condition)?'block':'none')
					}
				},
				setMode(mode) {
					this.mode = mode;
				},
				updateTexture() {
					let texture;
					if (Format.single_texture) {
						texture = Texture.getDefault();
					} else {
						let elements = this.mappable_elements;
						if (elements.length && this.selected_faces.length) {
							for (let element of elements) {
								if (element.faces[this.selected_faces[0]]) {
									texture = element.faces[this.selected_faces[0]].getTexture();
								}
							}
						}
					}
					if (texture == null) {
						this.texture = UVEditor.texture = null;
					} else if (texture instanceof Texture) {
						this.texture = texture;
					} else {
						this.texture = UVEditor.texture = 0;
					}
				},
				updateMouseCoords(event) {					
					convertTouchEvent(event);
					var pixel_size = this.inner_width / this.texture.width

					if (Toolbox.selected.id === 'copy_paste_tool') {
						this.mouse_coords.x = Math.round(event.offsetX/pixel_size*1);
						this.mouse_coords.y = Math.round(event.offsetY/pixel_size*1);
					} else {
						let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brushTool ? 0.5 : 0;
						this.mouse_coords.x = Math.floor(event.offsetX/pixel_size*1 + offset);
						this.mouse_coords.y = Math.floor(event.offsetY/pixel_size*1 + offset);
					}
					if (this.texture.frameCount) {
						this.mouse_coords.y += (this.texture.height / this.texture.frameCount) * this.texture.currentFrame
					}
				},
				onMouseWheel(event) {
					if (event.ctrlOrCmd) {
				
						event.stopPropagation()
						event.preventDefault()
				
						var n = (event.deltaY < 0) ? 0.1 : -0.1;
						n *= this.zoom
						var number = Math.clamp(this.zoom + n, Math.min(1, this.inner_width/this.inner_height), this.max_zoom)
						let old_zoom = this.zoom;

						this.zoom = number;
						
						let {viewport} = this.$refs;
						let offset = $(this.$refs.viewport).offset()
						let offsetX = event.clientX - offset.left;
						let offsetY = event.clientY - offset.top;
				
						let zoom_diff = this.zoom - old_zoom;
						viewport.scrollLeft += ((viewport.scrollLeft + offsetX) * zoom_diff) / old_zoom
						viewport.scrollTop  += ((viewport.scrollTop  + offsetY) * zoom_diff) / old_zoom
						
						this.updateMouseCoords(event)

						return false;
					}
				},
				onMouseDown(event) {
					if (event.which === 2) {
						let {viewport} = this.$refs;
						let coords = {x: 0, y: 0}
						function dragMouseWheel(e2) {
							viewport.scrollLeft -= (e2.pageX - coords.x)
							viewport.scrollTop -= (e2.pageY - coords.y)
							coords = {x: e2.pageX, y: e2.pageY}
						}
						function dragMouseWheelStop(e) {
							removeEventListeners(document, 'mousemove touchmove', dragMouseWheel);
							removeEventListeners(document, 'mouseup touchend', dragMouseWheelStop);
						}
						addEventListeners(document, 'mousemove touchmove', dragMouseWheel);
						addEventListeners(document, 'mouseup touchend', dragMouseWheelStop);
						coords = {x: event.pageX, y: event.pageY}
						event.preventDefault();
						return false;
					} else if (this.mode == 'paint' && Toolbox.selected.paintTool && (event.which === 1 || (event.touches && event.touches.length == 1))) {
						UVEditor.startPaintTool(event)
					}
				},
				contextMenu(event) {
					UVEditor.menu.open(event);
				},
				selectFace(key, event, keep_selection) {
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
					UVEditor.vue.updateTexture()
				},
				selectCube(cube, event) {
					if (!this.dragging_uv) {
						cube.select(event);
					}
					UVEditor.vue.updateTexture()
				},
				reverseSelect(event) {
					var offset = $(this.$refs.frame).offset();
					event.offsetX = event.clientX - offset.left;
					event.offsetY = event.clientY - offset.top;
					if (!this.dragging_uv && event.target.id == 'uv_frame') {
						let results = UVEditor.reverseSelect(event)
						if (!(results && results.length)) {
							if (!this.box_uv) {
								this.selected_faces.empty();
							}
						}
					}
				},
				dragFace(face_key, event) {
					if (event.which == 2 || event.which == 3) return;

					this.selectFace(face_key, event, true);
					let scope = this;
					let elements = this.mappable_elements;
					Undo.initEdit({elements, uv_only: true})

					let pos = [0, 0];
					let last_pos = [0, 0];
					let offset;
					if (Project.box_uv) {
						offset = function(element, x, y) {
							element.uv_offset[0] += x;
							element.uv_offset[1] += y;
						}
					} else {
						offset = function(element, x, y) {
							scope.selected_faces.forEach(key => {
								if (element.faces[key] && element instanceof Cube) {
									element.faces[key].uv[0] += x;
									element.faces[key].uv[1] += y;
									element.faces[key].uv[2] += x;
									element.faces[key].uv[3] += y;
								}
							})
						}
					}

					function drag(e1) {

						let step_x = (scope.inner_width / UVEditor.getResolution(0) / UVEditor.grid);
						let step_y = (scope.inner_height / UVEditor.getResolution(1) / UVEditor.grid);
						
						pos[0] = Math.round((e1.clientX - event.clientX) / step_x) / UVEditor.grid;
						pos[1] = Math.round((e1.clientY - event.clientY) / step_y) / UVEditor.grid;

						if (pos[0] != last_pos[0] || pos[1] != last_pos[1]) {

							elements.forEach(element => {
								if (element instanceof Mesh) {
									scope.selected_faces.forEach(key => {
										let face = element.faces[key];
										if (!face) return;
										face.vertices.forEach(vertex_key => {
											face.uv[vertex_key][0] += pos[0] - last_pos[0];
											face.uv[vertex_key][1] += pos[1] - last_pos[1];
										})
									})
								} else {
									offset(element, pos[0] - last_pos[0], pos[1] - last_pos[1]);
								}
							})
							last_pos.replace(pos);
						}
						UVEditor.displaySliders();
						UVEditor.loadData();
						UVEditor.vue.$forceUpdate();
						Canvas.updateView({elements: scope.mappable_elements, element_aspects: {uv: true}});
						scope.dragging_uv = true;
					}

					function stop(e1) {
						removeEventListeners(document, 'mousemove touchmove', drag);
						removeEventListeners(document, 'mouseup touchend', stop);
						UVEditor.disableAutoUV()
						Undo.finishEdit('Move UV')
						setTimeout(() => scope.dragging_uv = false, 10);
					}
					addEventListeners(document, 'mousemove touchmove', drag);
					addEventListeners(document, 'mouseup touchend', stop);
				},
				resizeFace(face_key, event, x_side, y_side) {
					if (event.which == 2 || event.which == 3) return;
					event.stopPropagation();
					let scope = this;
					let elements = this.mappable_elements;
					Undo.initEdit({elements, uv_only: true})

					let pos = [0, 0];
					let last_pos = [0, 0];
					let offset = function(element, x, y) {
						scope.selected_faces.forEach(key => {
							if (element.faces[key] && element instanceof Cube) {
								if (x_side == -1) element.faces[key].uv[0] += x;
								if (y_side == -1) element.faces[key].uv[1] += y;
								if (x_side ==  1) element.faces[key].uv[2] += x;
								if (y_side ==  1) element.faces[key].uv[3] += y;
							}
						})
						element.uv_offset[0] += x;
						element.uv_offset[1] += y;
					}

					function drag(e1) {

						let step_x = (scope.inner_width / UVEditor.getResolution(0) / UVEditor.grid);
						let step_y = (scope.inner_height / UVEditor.getResolution(1) / UVEditor.grid);
						
						pos[0] = Math.round((e1.clientX - event.clientX) / step_x) / UVEditor.grid;
						pos[1] = Math.round((e1.clientY - event.clientY) / step_y) / UVEditor.grid;

						if (pos[0] != last_pos[0] || pos[1] != last_pos[1]) {

							elements.forEach(element => {
								offset(element, pos[0] - last_pos[0], pos[1] - last_pos[1])
							})
							last_pos.replace(pos);
						}
						UVEditor.displaySliders();
						UVEditor.loadData();
						UVEditor.vue.$forceUpdate();
						Canvas.updateView({elements: scope.mappable_elements, element_aspects: {uv: true}});
						scope.dragging_uv = true;
					}

					function stop() {
						removeEventListeners(document, 'mousemove touchmove', drag);
						removeEventListeners(document, 'mouseup touchend', stop);
						UVEditor.disableAutoUV()
						Undo.finishEdit('Resize UV')
						setTimeout(() => scope.dragging_uv = false, 10);
					}
					addEventListeners(document, 'mousemove touchmove', drag);
					addEventListeners(document, 'mouseup touchend', stop);
				},

				dragVertices(element, vertex_key, event) {
					if (event.which == 2 || event.which == 3) return;

					if (!this.selected_vertices[element.uuid]) this.selected_vertices[element.uuid] = [];
					let sel_vertices = this.selected_vertices[element.uuid];
					if (sel_vertices.includes(vertex_key)) {

					} else if (event.shiftvertex_key || event.ctrlOrCmd || Pressing.overrides.shift || Pressing.overrides.ctrl) {
						if (sel_vertices.includes(vertex_key)) {
							sel_vertices.remove(vertex_key);
						} else {
							sel_vertices.push(vertex_key);
						}
					} else {
						sel_vertices.replace([vertex_key]);
					}


					let scope = this;
					let elements = this.mappable_elements;
					Undo.initEdit({elements, uv_only: true})

					let pos = [0, 0];
					let last_pos = [0, 0];

					function drag(e1) {

						let step_x = (scope.inner_width / UVEditor.getResolution(0) / UVEditor.grid);
						let step_y = (scope.inner_height / UVEditor.getResolution(1) / UVEditor.grid);
						
						pos[0] = Math.round((e1.clientX - event.clientX) / step_x) / UVEditor.grid;
						pos[1] = Math.round((e1.clientY - event.clientY) / step_y) / UVEditor.grid;

						if (pos[0] != last_pos[0] || pos[1] != last_pos[1]) {

							elements.forEach(element => {
								scope.selected_faces.forEach(key => {
									let face = element.faces[key];
									face.vertices.forEach(vertex_key => {
										if (scope.selected_vertices[element.uuid] && scope.selected_vertices[element.uuid].includes(vertex_key)) {
											face.uv[vertex_key][0] += pos[0] - last_pos[0];
											face.uv[vertex_key][1] += pos[1] - last_pos[1];
										}
									})
								})
							})


							last_pos.replace(pos);
						}
						UVEditor.displaySliders();
						UVEditor.loadData();
						UVEditor.vue.$forceUpdate();
						Canvas.updateView({elements: scope.mappable_elements, element_aspects: {uv: true}});
						scope.dragging_uv = true;
					}

					function stop(e1) {
						removeEventListeners(document, 'mousemove touchmove', drag);
						removeEventListeners(document, 'mouseup touchend', stop);
						Undo.finishEdit('Move UV')
						setTimeout(() => scope.dragging_uv = false, 10);
					}
					addEventListeners(document, 'mousemove touchmove', drag);
					addEventListeners(document, 'mouseup touchend', stop);
				},
				/*
				openFaceMenu(event) {
					let faces = [];
					this.mappable_elements.forEach(element => {
						for (let key in element.faces) {
							if (faces.find(item => item.id == key)) continue;
							faces.push({
								id: key,
								name: this.face_names[key],
								icon: this.selected_faces.includes(key) ? 'check_box' : 'check_box_outline_blank',
								click: () => {
									this.selected_faces.splice(0, Infinity, key);
									//UVEditor.loadData()
								}
							})
						}
					})
					new Menu(faces).open(this.$refs.seleced_faces)
				},*/

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
							((UV[0] + uv_offset[0]) / this.project_resolution[0] * this.inner_width + 1) + ',' +
							((UV[1] + uv_offset[1]) / this.project_resolution[0] * this.inner_width + 1)
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
				}
			},
			/*
			Extra Info
				Selected Faces
				Pointer Coords
			*/
			template: `
				<div class="UVEditor" ref="main" :class="{checkerboard_trigger: checkerboard}" id="UVEditor">

					<div class="bar next_to_title" id="uv_title_bar">
						<div id="project_resolution_status" @click="projectResolution()">
							{{ project_resolution[0] + ' ⨉ ' + project_resolution[1] }}
						</div>
					</div>

					<div class="bar uv_cube_face_bar" v-if="mappable_elements[0] && mappable_elements[0].type == 'cube' && !box_uv">
						<li v-for="(face, key) in mappable_elements[0].faces" :class="{selected: selected_faces.includes(key), disabled: mappable_elements[0].faces[key].texture == null}" @mousedown="selectFace(key, $event)">
							{{ face_names[key] }}
						</li>
					</div>

					<div id="uv_viewport"
						@contextmenu="contextMenu($event)"
						@mousedown="onMouseDown($event)"
						@touchstart="onMouseDown($event)"
						@mousewheel="onMouseWheel($event)"
						@mousemove="updateMouseCoords($event)"
						@mouseleave="if (mode == 'paint') mouse_coords.x = -1"
						class="checkerboard_target"
						ref="viewport"
						:style="{width: (width+8) + 'px', height: (height+8) + 'px', overflowX: (zoom > 1) ? 'scroll' : 'hidden', overflowY: (inner_height > height) ? 'scroll' : 'hidden'}"
					>

						<div id="uv_frame" @click.stop="reverseSelect($event)" ref="frame" :style="{width: inner_width + 'px', height: inner_height + 'px'}" v-if="texture != null">

							<template v-if="mode == 'uv'" v-for="element in (showing_overlays ? all_mappable_elements : mappable_elements)" :key="element.uuid">

								<template v-if="element.type == 'cube' && !box_uv">
									<div class="cube_uv_face"
										v-for="(face, key) in element.faces" :key="key"
										v-if="face.getTexture() == texture"
										:title="face_names[key]"
										:class="{selected: selected_faces.includes(key), unselected: showing_overlays && !mappable_elements.includes(element)}"
										@mousedown.prevent="dragFace(key, $event)"
										:style="{
											left: toPixels(Math.min(face.uv[0], face.uv[2]), -1),
											top: toPixels(Math.min(face.uv[1], face.uv[3]), -1),
											'--width': toPixels(Math.abs(face.uv_size[0]), 2),
											'--height': toPixels(Math.abs(face.uv_size[1]), 2),
										}"
									>
										<template v-if="selected_faces.includes(key)">
											{{ face_names[key] || '' }}
											<div class="uv_resize_side horizontal" @mousedown="resizeFace(key, $event, 0, -1)" style="width: var(--width)"></div>
											<div class="uv_resize_side horizontal" @mousedown="resizeFace(key, $event, 0, 1)" style="top: var(--height); width: var(--width)"></div>
											<div class="uv_resize_side vertical" @mousedown="resizeFace(key, $event, -1, 0)" style="height: var(--height)"></div>
											<div class="uv_resize_side vertical" @mousedown="resizeFace(key, $event, 1, 0)" style="left: var(--width); height: var(--height)"></div>
											<div class="uv_resize_corner uv_c_nw" @mousedown="resizeFace(key, $event, -1, -1)" style="left: 0; top: 0"></div>
											<div class="uv_resize_corner uv_c_ne" @mousedown="resizeFace(key, $event, 1, -1)" style="left: var(--width); top: 0"></div>
											<div class="uv_resize_corner uv_c_sw" @mousedown="resizeFace(key, $event, -1, 1)" style="left: 0; top: var(--height)"></div>
											<div class="uv_resize_corner uv_c_se" @mousedown="resizeFace(key, $event, 1, 1)" style="left: var(--width); top: var(--height)"></div>
										</template>
									</div>
								</template>
								
								<div v-else-if="element.type == 'cube'" class="cube_box_uv"
									@mousedown.prevent="dragFace(null, $event)"
									@click.prevent="selectCube(element, $event)"
									:class="{unselected: showing_overlays && !mappable_elements.includes(element)}"
									:style="{left: toPixels(element.uv_offset[0]), top: toPixels(element.uv_offset[1])}"
								>
									<div class="uv_fill" :style="{left: '-1px', top: toPixels(element.size(2, true), -1), width: toPixels(element.size(2, true)*2 + element.size(0, true)*2, 2), height: toPixels(element.size(1, true), 2)}" />
									<div class="uv_fill" :style="{left: toPixels(element.size(2, true), -1), top: '-1px', width: toPixels(element.size(0, true)*2, 2), height: toPixels(element.size(2, true), 2), borderBottom: 'none'}" />
									<div :style="{left: toPixels(element.size(2, true), -1), top: '-1px', width: toPixels(element.size(0, true), 2), height: toPixels(element.size(2, true) + element.size(1, true), 2)}" />
									<div :style="{left: toPixels(element.size(2, true)*2 + element.size(0, true), -1), top: toPixels(element.size(2, true), -1), width: toPixels(element.size(0, true), 2), height: toPixels(element.size(1, true), 2)}" />
								</div>

								<template v-if="element.type == 'mesh'">
									<div class="mesh_uv_face"
										v-for="(face, key) in element.faces" :key="key"
										v-if="face.vertices.length > 2 && face.getTexture() == texture"
										:class="{selected: selected_faces.includes(key)}"
										@mousedown.prevent="dragFace(key, $event)"
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
										<template v-if="selected_faces.includes(key)">
											<div class="uv_mesh_vertex" v-for="key in face.vertices"
												:class="{selected: selected_vertices[element.uuid] && selected_vertices[element.uuid].includes(key)}"
												@mousedown.prevent.stop="dragVertices(element, key, $event)"
												:style="{left: toPixels( face.uv[key][0] - getMeshFaceCorner(face, 0) ), top: toPixels( face.uv[key][1] - getMeshFaceCorner(face, 1) )}"
											></div>
										</template>
									</div>
								</template>

							</template>

							<img style="object-fit: cover; object-position: 0px 0px;" v-if="texture && texture.error != 1" :src="texture.source">
						</div>

						<div class="uv_transparent_face" v-else>${tl('uv_editor.transparent_face')}</div>
					</div>
					<div v-show="mode == 'paint'" class="bar uv_painter_info">
						<span style="color: var(--color-subtle_text);">{{ mouse_coords.x < 0 ? '-' : (mouse_coords.x + ' ⨉ ' + mouse_coords.y) }}</span>
						<span v-if="texture">{{ texture.name }}</span>
						<span style="color: var(--color-subtle_text);">{{ Math.round(this.zoom*100).toString() + '%' }}</span>
					</div>
					<div v-show="mode == 'uv'" class="bar uv_editor_sliders" ref="slider_bar" style="margin-left: 2px;"></div>
					<div v-show="mode == 'uv'" class="toolbar_wrapper uv_editor"></div>
				</div>
			</div>
			`
		}
	})

	Toolbars.uv_editor.toPlace()

	let {slider_bar} = UVEditor.vue.$refs;

	var onBefore = function() {
		Undo.initEdit({elements: Cube.selected})
	}
	var onAfter = function() {
		Undo.finishEdit('Edit UV')
	}
	var getInterval = function(event) {
		return 1/UVEditor.grid
	}
	UVEditor.sliders.pos_x = new NumSlider({
		id: 'uv_slider_pos_x',
		private: true,
		condition: () => UVEditor.vue.selected_faces.length,
		get: function() {
			let elements = UVEditor.getMappableElements();
			if (Project.box_uv && elements[0]) {
				return trimFloatNumber(elements[0].uv_offset[0])
			} else if (elements[0]) {
				var face = UVEditor.getReferenceFace();
				if (face) {
					return trimFloatNumber(face.uv[0])
				}
			}
			return 0
		},
		change: function(modify) {
			UVEditor.slidePos(modify, 0)
		},
		getInterval,
		onBefore,
		onAfter
	}).toElement(slider_bar);

	UVEditor.sliders.pos_y = new NumSlider({
		id: 'uv_slider_pos_y',
		private: true,
		condition: () => UVEditor.vue.selected_faces.length,
		get: function() {
			let elements = UVEditor.getMappableElements();
			if (Project.box_uv && elements[0]) {
				return trimFloatNumber(elements[0].uv_offset[1])
			} else if (elements[0]) {
				var face = UVEditor.getReferenceFace();
				if (face) {
					return trimFloatNumber(face.uv[1])
				}
			}
			return 0
		},
		change: function(modify) {
			UVEditor.slidePos(modify, 1)
		},
		getInterval,
		onBefore,
		onAfter
	}).toElement(slider_bar);

	UVEditor.sliders.size_x = new NumSlider({
		id: 'uv_slider_size_x',
		private: true,
		condition: () => (!Project.box_uv && Cube.selected[0]),
		get: function() {
			if (!Project.box_uv) {
				let ref_face = UVEditor.getReferenceFace();
				if (ref_face instanceof Face) {
					return trimFloatNumber(ref_face.uv[2] - ref_face.uv[0]);
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
		condition: () => (!Project.box_uv && Cube.selected[0]),
		get: function() {
			if (!Project.box_uv) {
				let ref_face = UVEditor.getReferenceFace();
				if (ref_face instanceof Face) {
					return trimFloatNumber(ref_face.uv[3] - ref_face.uv[1]);
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
