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
	UVEditor.setGrid(1).setSize(UVEditor.size)//.displayAllMappingOverlays();
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

	get vue() {
		return this.panel.inside_vue;
	},

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
			

		var dragging_not_clicking = false;
		this.jquery.size.resizable({
			handles: "all",
			maxHeight: 320,
			maxWidth: 320,
			minWidth: 0,
			minHeight: 0,
			containment: 'parent',
			start: function(event, ui) {
				Undo.initEdit({elements: Cube.selected, uv_only: true})
			},
			resize: function(event, ui) {
				scope.save(false)
				scope.displaySliders()
			},
			stop: function(event, ui) {
				dragging_not_clicking = true;
				scope.disableAutoUV()
				Undo.finishEdit('Edit UV size')
				scope.updateDragHandle(ui.position)
			}
		})

		this.jquery.size.draggable({
			start: function(event, ui) {
				Undo.initEdit({elements: Cube.selected, uv_only: true})
			},
			drag: function( event, ui ) {
				var p = ui.position;
				var o = ui.originalPosition;

				p.left = o.left + (p.left - o.left);
				p.top = o.top + (p.top - o.top);

				p.left = limitNumber(p.left, 0, scope.inner_width-scope.jquery.size.width()+1);
				p.top = limitNumber(p.top, 0, scope.inner_height-scope.jquery.size.height()+1);

				let step_x = (scope.inner_width / scope.getResolution(0) / scope.grid);
				let step_y = (scope.inner_height / scope.getResolution(1) / scope.grid);

				p.left = Math.round(p.left / step_x) * step_x;
				p.top  = Math.round(p.top  / step_y) * step_y;

				scope.save(true);
				scope.displaySliders();
				return true;
			},
			stop: function(event, ui) {
				scope.save(true)
				scope.disableAutoUV()
				Undo.finishEdit('Move UV')
				scope.updateDragHandle(ui.position)
			}
		})

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

		this.jquery.frame.click(function(event) {
			var offset = scope.jquery.frame.offset();
			event.offsetX = event.clientX - offset.left;
			event.offsetY = event.clientY - offset.top;
			if (!dragging_not_clicking && (event.ctrlOrCmd || Pressing.overrides.ctrl)) {
				scope.reverseSelect(event)
			}
			dragging_not_clicking = false;
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
	updateBrushOutline(e) {
		if (Modes.paint && Toolbox.selected.brushTool) {
			this.jquery.frame.append(this.brush_outline);
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
		var box = $('<div class="uv_message_box">' + msg + '</div>')
		this.jquery.main.append(box)
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
			addEventListeners(scope.jquery.frame.get(0), 'mousemove touchmove', scope.movePaintTool, false );
			addEventListeners(document, 'mouseup touchend', scope.stopBrush, false );
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
		var scope = Painter.active_uv_editor;
		removeEventListeners( scope.jquery.frame.get(0), 'mousemove touchmove', scope.movePaintTool, false );
		removeEventListeners( document, 'mouseup touchend', scope.stopBrush, false );
		if (Toolbox.selected.id !== 'copy_paste_tool') {
			Painter.stopPaintTool()
		} else {
			scope.stopSelection()
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
			this.jquery.frame.find('#texture_selection_rect').detach();
			let rect = $(`<div id="texture_selection_rect"></div>`);
			this.jquery.frame.append(rect)
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
			Painter.selection.rect
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
			Painter.selection.rect.detach()
		}
		if (Painter.selection.overlay || !Painter.selection.calcrect) return;
		if (Painter.selection.calcrect.x == 0 || Painter.selection.calcrect.y == 0) return;

		let calcrect = Painter.selection.calcrect;
		var canvas = document.createElement('canvas')
		var ctx = canvas.getContext('2d');
		canvas.width = calcrect.x;
		canvas.height = calcrect.y;
		ctx.drawImage(this.texture.img, -calcrect.ax, -calcrect.ay)

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
		this.jquery.frame.append(overlay)
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
		return this.size*this.zoom;
	},
	get inner_height() {
		return this.height*this.zoom;
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
	getFaces(event) {
		if (event && event.shiftKey) {
			return ['north', 'east', 'south', 'west', 'up', 'down']
		} else {
			return [this.face]
		}
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
		return Cube.selected[0].faces[this.face].getTexture();
	},
	//Set
	setSize(input_size, cancel_load) {
		return;
		var old_size = this.size;
		var size = input_size;
		this.size = size;
		this.vue.$refs.frame.style.width = (this.inner_width) + 'px';
		this.vue.$refs.viewport.style.width = (size+8) + 'px';
		this.vue.$refs.main.style.width = (size + (this.id == 'UVEditor' ? 8 : 10)) + 'px';

		for (var id in this.sliders) {
			this.sliders[id].setWidth(size/(Project.box_uv?2:4)-1)
		}
		if (!cancel_load && old_size !== size) {
			this.loadData();
		} else {
			this.updateSize();
		}
		// compensate offset
		this.vue.$refs.viewport.scrollLeft = Math.round(this.vue.$refs.viewport.scrollLeft * (size / old_size));
		this.vue.$refs.viewport.scrollTop  = Math.round(this.vue.$refs.viewport.scrollTop  * (size / old_size));
		return this;
	},
	setZoom(zoom) {
		this.vue.zoom = zoom;
		return this;
		var zoomed_size = this.size * zoom;
		var size = zoomed_size;
		this.zoom = size/this.size
		this.updateSize();
		this.displayFrame();

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
		//var size = this.size * this.zoom;

		return;
		this.jquery.viewport.height(this.height+8)
		this.jquery.size.resizable('option', 'maxHeight', this.inner_height)
		this.jquery.size.resizable('option', 'maxWidth', this.inner_width)
		this.jquery.size.resizable('option', 'grid', [
			this.inner_width/Project.texture_width/this.grid,
			this.inner_height/Project.texture_height/this.grid
		])
		this.displayMappingOverlay();
		this.updateAllMappingOverlays();
		if (this.texture && this.texture.currentFrame) {
			this.img.style.objectPosition = `0 -${this.texture.currentFrame * this.inner_height}px`;
		} else {
			this.img.style.objectPosition = `0 0`;
		}
		if (Painter.selection.overlay && this.texture) {
			this.updatePastingOverlay()
		}

		if (this.zoom > 1) {
			this.jquery.viewport.addClass('zoomed').css('overflow', 'scroll scroll')
		} else {
			this.jquery.viewport.removeClass('zoomed').css('overflow', 'hidden')
		}
	},
	setFace(face, update = true) {
		this.face = face
		if (this.id === 'UVEditor') {
			$('input#'+face+'_radio').prop("checked", true)
		}
		if (update) {
			this.loadData()
		}
		return this;
	},
	setToMainSlot() {
		var scope = this;
		$('.panel#uv > .panel_inside').append(this.jquery.main)
		$('.panel#uv > .panel_inside').on('mousewheel', function(e) {

			if (!Project.box_uv && !e.ctrlOrCmd && $('#uv_panel_sides:hover, #uv_viewport:not(.zoomed):hover').length) {
				var faceIDs = {'north': 0, 'south': 1, 'west': 2, 'east': 3, 'up': 4, 'down': 5}
				var id = faceIDs[scope.face]
				event.deltaY > 0 ? id++ : id--;
				if (id === 6) id = 0
				if (id === -1) id = 5
				$('input#'+getKeyByValue(faceIDs, id)+'_radio').prop("checked", true)
				scope.loadSelectedFace()
				e.preventDefault()
			}
		})
		this.jquery.frame.on('dblclick', function() {
			UVEditor.openFull()
		})
		return this;
	},
	appendTo(selector) {
		$(selector).append(this.jquery.main)
		return this;
	},
	//Selection
	reverseSelect(event) {
		var scope = this;
		if (!this.texture && !Format.single_texture) return this;
		if (!event.target.classList.contains('uv_size_handle') && !event.target.id === 'uv_frame') {
			return this;
		}
		var matches = [];
		var face_match;
		var u = event.offsetX / this.inner_width * this.getResolution(0);
		var v = event.offsetY / this.inner_height * this.getResolution(1);
		Cube.all.forEach(cube => {
			for (var face in cube.faces) {
				var uv = cube.faces[face].uv
				if (uv && Math.isBetween(u, uv[0], uv[2]) && Math.isBetween(v, uv[1], uv[3]) && (cube.faces[face].getTexture() === scope.texture || Format.single_texture)) {
					matches.safePush(cube)
					if (!face_match) {
						face_match = face
					}
					break;
				}
			}
		})
		if (matches.length) {
			if (!Project.box_uv) {
				UVEditor.setFace(face_match);
			}
			selected.empty();
			matches.forEach(s => {
				selected.safePush(s)
			});
			updateSelection();
			scope.displayMappingOverlay();
		}
		return this;
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
		return this;
		if (Cube.selected.length === 0 && !Modes.paint) return;
		var face = Cube.selected[0] && Cube.selected[0].faces[this.face];
		
		//Set Rotation
		BarItems.uv_rotation.set((face && face.rotation)||0)

		this.displayTexture(face)
		this.displayFrame()//and transform info
		this.displayTools()
		this.displaySliders()
		this.updateDragHandle()
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
	displayFrame() {
		return this;
		var scope = this;
		if (!Modes.edit) return;
		if (Project.box_uv) {
			var uvTag = this.getUVTag(Cube.selected[0])

			var size_tag = Cube.selected[0].size(undefined, true)

			var width = (size_tag[0] + size_tag[2])*2
				width = limitNumber(width, 0, Project.texture_width)
				width = width/Project.texture_width*scope.inner_width

			var x = limitNumber(uvTag[0], 0, Project.texture_width)
				x *= scope.inner_width/Project.texture_width

			this.jquery.size.width(width)
			this.jquery.size.css('left', x+'px')


			var height = size_tag[2] + size_tag[1]
				height = limitNumber(height, 0, Project.texture_height)
				height = height/Project.texture_height*scope.inner_width
				height *= Project.texture_height/Project.texture_width

			var y = limitNumber(uvTag[1], 0, Project.texture_height)
				y *= scope.inner_width/Project.texture_height
				y *= Project.texture_height/Project.texture_width

			this.jquery.size.height(height)
			this.jquery.size.css('top', y+'px')
		} else {

			var uvTag = this.getUVTag(Cube.selected[0])

			//X
			var tex_width = this.getResolution(0);
			var width = limitNumber(uvTag[2]-uvTag[0], -tex_width, tex_width)
			var x = limitNumber(uvTag[0], 0, tex_width)
			if (width < 0) {
				width *= -1
				x = x - width
			}
			var pixels = this.inner_width/tex_width;
			this.jquery.size.width(width * pixels);
			this.jquery.size.css('left', x*pixels+'px');

			//Y
			var tex_height = this.getResolution(1);
			var height = limitNumber(uvTag[3]-uvTag[1], -tex_height, tex_height);
			var y = limitNumber(uvTag[1], 0, tex_height);
			if (height < 0) {
				height *= -1;
				y = y - height;
			}
			this.jquery.size.height(height * pixels);
			this.jquery.size.css('top', y*pixels+'px');
		}
		this.updateDragHandle();
		this.displayTransformInfo();
	},
	//Overlay
	displayMappingOverlay() {
		return this;
		if (!Project.box_uv || Cube.selected.length == 0) return this;
		var scope = this;
		var sides = this.getMappingOverlay();

		$(scope.jquery.size).find('.mapping_overlay_cube').remove();
		scope.jquery.size.append(sides);

		return this;
	},
	getMappingOverlay(cube, absolute) {
		return this;
		var scope = this;
		var sides = document.createElement('div');
		sides.classList.add('mapping_overlay_cube');
		var pixels = scope.getPixelSize();
		if (!cube) cube = Cube.selected[0];
		function addElement(x, y, width, height, n, color) {
			if (absolute) {
				x += cube.uv_offset[0];
				y += cube.uv_offset[1];
			}
			x *= pixels;
			y *= pixels;
			width  = limitNumber(width *pixels + x, 0, scope.inner_width)  - x;
			height = limitNumber(height*pixels + y, 0, scope.inner_height)- y;

			let face = document.createElement('div');
			face.classList.add('uv_mapping_overlay');
			face.style.left = x+'px'; face.style.top = y+'px';
			face.style.height = height+'px'; face.style.width = width+'px';
			face.style.background = color;
			face.dataset.sizes = [x/pixels, y/pixels, width/pixels, height/pixels].map(v => Math.round(v)).join(',');
			sides.append(face);
		}
		var size = cube.size(undefined, true);

		sides.setAttribute('size_hash', `${cube.uv_offset[0]}_${cube.uv_offset[1]}_${size[0]}_${size[1]}_${size[2]}`)

		addElement(size[2], 0, size[0], size[2],				'#b4d4e1', '#ecf8fd')
		addElement(size[2]+size[0], 0, size[0], size[2],		'#536174', '#6e788c')
		addElement(0, size[2], size[2], size[1],				'#43e88d', '#7BFFA3')
		addElement(size[2], size[2], size[0], size[1],		  '#5bbcf4', '#7BD4FF')
		addElement(size[2]+size[0], size[2], size[2], size[1],  '#f48686', '#FFA7A4')
		addElement(2*size[2]+size[0], size[2], size[0], size[1],'#f8dd72', '#FFF899')

		return sides;
	},
	/*
	displayAllMappingOverlays(force_reload) {
		var scope = this;
		var cycle = 'C'+bbuid(4)
		if (this.showing_overlays && Project.box_uv) {
			Cube.all.forEach(cube => {
				var size = cube.size(undefined, true)
				var hash = `${cube.uv_offset[0]}_${cube.uv_offset[1]}_${size[0]}_${size[1]}_${size[2]}`
				if (scope.jquery.frame[0].querySelector(`:scope > .mapping_overlay_cube.${cycle}[size_hash="${hash}"]`)) return;

				var c = scope.jquery.frame[0].querySelector(`:scope > .mapping_overlay_cube:not(.${cycle})[size_hash="${hash}"]`)
				if (force_reload || !c) {
					var sides = scope.getMappingOverlay(cube, true)
					sides.classList.add(cycle)
					scope.jquery.frame.append(sides)
				} else {
					c.classList.add(cycle)
				}
			})
			$(`.mapping_overlay_cube:not(.${cycle})`).remove()
			$('.mapping_overlay_cube').removeClass(cycle)
		} else {
			$(scope.jquery.frame).find('.mapping_overlay_cube').remove()
		}
	},
	updateAllMappingOverlays() {
		var scope = this;
		var pixels = scope.getPixelSize();
		if (this.showing_overlays) {
			Cube.all.forEach(cube => {
				var size = cube.size(undefined, true)
				var hash = `${cube.uv_offset[0]}_${cube.uv_offset[1]}_${size[0]}_${size[1]}_${size[2]}`
				var c = scope.jquery.frame[0].querySelector(`:scope > .mapping_overlay_cube[size_hash="${hash}"]`);
				
				if (c) {
					c.childNodes.forEach(side => {
						var data = side.dataset.sizes;
						data = data.split(',');
						data.forEach((s, i) => {
							data[i] = parseInt(s);
						})
						side.style.left 	= (data[0] * pixels)+'px';
						side.style.top 		= (data[1] * pixels)+'px';
						side.style.width 	= (data[2] * pixels)+'px';
						side.style.height	= (data[3] * pixels)+'px';
					})
				}
			})
		}
	},*/
	//UI
	displaySliders() {
		if (!Cube.selected.length) return;
		this.sliders.pos_x.update()
		this.sliders.pos_y.update()
		this.sliders.size_x.update()
		this.sliders.size_y.update()
	},
	displayTools() {
		//Cullface
		if (!Cube.selected.length) return;
		var face = Cube.selected[0].faces[this.face]
		BarItems.cullface.set(face.cullface||'off')
		BarItems.face_tint.setIcon(face.tint !== -1 ? 'check_box' : 'check_box_outline_blank')
		BarItems.slider_face_tint.update()
	},
	updateDragHandle() {
		var pos = this.jquery.size.position()
		var handle = this.jquery.size.find('div.uv_size_handle').get(0);
		if (!handle) return;

		var left = limitNumber(this.vue.$refs.viewport.scrollLeft, 0, this.size*(this.zoom-1)) - pos.left;
		var top = limitNumber(this.vue.$refs.viewport.scrollTop, 0, (this.height||this.size)*(this.zoom-1)) - pos.top;
		handle.style.left = left +'px';
		handle.style.top = top +'px';

		handle.style.width = this.size + 'px';
		handle.style.height = (this.height||this.size) + 'px';
		return this;
	},
	updateInterface() {
		for (var key in this.sliders) {
			var slider = this.sliders[key]
			slider.node.style.setProperty('display', BARS.condition(slider.condition)?'block':'none')
		}
		this.jquery.size.resizable('option', 'disabled', Project.box_uv)
	},
	contextMenu() {
		var scope = this;
		this.reference_face = Cube.selected[0] && Cube.selected[0].faces[scope.face];
		this.menu.open(event, this)
		return this;
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
		this.displayFrame()
		this.disableAutoUV()
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
		this.displayFrame()
		this.disableAutoUV()
	},
	getResolution(axis, texture) {
		return axis ? Project.texture_height : Project.texture_width;
	},

	//Events
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
			scope.getFaces(event).forEach(function(side) {
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
			scope.getFaces(event).forEach(function(side) {
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
			scope.getFaces(event).forEach(function(side) {
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
			scope.getFaces(event).forEach(function(side) {
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
			scope.getFaces(event).forEach(function(side) {
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
			scope.getFaces(event).forEach(function(side) {
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
			scope.getFaces(event).forEach(function(side) {
				obj.faces[side].uv = [0, 0, 0, 0]
				obj.faces[side].texture = null;
			})
			Canvas.adaptObjectFaces(obj)
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
			scope.getFaces(event).forEach(function(side) {
				obj.faces[side].cullface = side
			})
		})
		this.loadData()
		this.message('uv_editor.auto_cull')
	},
	copy(event) {
		this.select()
		if (Cube.selected.length === 0) return;

		var scope = this;
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
		this.select()
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

		if (this.id === 'UVEditor' && event) {
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
		} else {
			if (UVEditor.selection.length === 1) {
				applyFace(UVEditor.clipboard[0], UVEditor.selection[0])
			} else {
				if (UVEditor.clipboard.length === 1) {
					UVEditor.selection.forEach(function(s) {
						applyFace(UVEditor.clipboard[0], s)
					})
				} else {
					UVEditor.clipboard.forEach(function(s) {
						if (UVEditor.selection.includes(s.face)) {
							applyFace(s)
						}
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
			scope.getFaces(event).forEach(function(side) {
				obj.faces[side].reset()
			})
			Canvas.adaptObjectFaces(obj)
			Canvas.updateUV(obj)
		})
		this.loadData()
		this.message('uv_editor.reset')
	},
	select() {
		if (UVEditor.cube_faces.includes(this.id) === false) return;
		UVEditor.selection = [this.id]
		UVEditor.updateSelection()
	},

	// Dialog
	
	isSetup: false,
	single: false,
	clipboard: null,
	cube_faces: ['north', 'south', 'west', 'east', 'up', 'down'],
	selection: [],
	selection_all: [],
	all_editors: [],
	hoveredSide: false,
	single_size: {},
	all_size: {},
	select: function(id, event) {
		if (event.shiftKey || Pressing.overrides.shift) {
			UVEditor.selection.push(id)
		} else {
			if (UVEditor.selection.includes(id) && UVEditor.selection.length === 1) {
				UVEditor.selection = []
			} else {
				UVEditor.selection = [id]
			}
		}
		UVEditor.updateSelection()
	},
	selectAll: function() {
		if (UVEditor.selection.length === 6) {
			UVEditor.selection.empty()
		} else {
			UVEditor.selection = UVEditor.cube_faces.slice()
		}
		UVEditor.updateSelection()
	},
	selectNone: function() {
		UVEditor.selection = []
		UVEditor.updateSelection()
	},
	forSelection: function(cb, event, ...args) {
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
		}
	},
	copy: function(event) {
		if (Cube.selected.length === 0) return;
		UVEditor.clipboard = []

		function addToClipboard(face) {
			var tag = Cube.selected[0].faces[face]
			UVEditor.clipboard.push(new Face(null, tag))
		}
		if (UVEditor.hoveredSide) {
			addToClipboard(UVEditor.hoveredSide)
			UVEditor.editors[UVEditor.hoveredSide].message('uv_editor.copied')

		} else if (UVEditor.single) {
			addToClipboard(UVEditor.editors.single.face)
			UVEditor.editors.single.message('uv_editor.copied')

		} else if (UVEditor.selection.length > 0) {
			UVEditor.selection.forEach(function(s) {
				addToClipboard(s)
				UVEditor.editors[s].message('uv_editor.copied')
			})
		} else {
			UVEditor.cube_faces.forEach(function(s) {
				addToClipboard(s)
				UVEditor.editors[s].message('uv_editor.copied')
			})
		}
	},
	paste: function(event) {
		if (UVEditor.clipboard === null || Cube.selected.length === 0) return;

		function applyFace(tag, face) {
			if (!face) face = tag.face
			Cube.selected.forEach(function(obj) {
				obj.faces[face].extend(tag)
				Canvas.updateUV(obj)
			})
		}

		if (UVEditor.hoveredSide) {
			UVEditor.editors[UVEditor.hoveredSide].paste({shiftKey: false})

		} else if (UVEditor.selection.length === 1) {
			applyFace(UVEditor.clipboard[0], UVEditor.selection[0])
			if (UVEditor.single) {
				UVEditor.editors.single.message('uv_editor.pasted')
			} else {
				UVEditor.editors[UVEditor.selection[0]].message('uv_editor.pasted')
			}
		} else {
			if (UVEditor.clipboard.length === 1) {
				UVEditor.selection.forEach(function(s) {
					applyFace(UVEditor.clipboard[0], s)
					UVEditor.editors[s].message('uv_editor.pasted')
				})
			} else {
				UVEditor.clipboard.forEach(function(s) {
					if (UVEditor.selection.includes(s.face)) {
						applyFace(s)
						UVEditor.editors[s].message('uv_editor.pasted')
					}
				})
			}
		}

		for (var key in UVEditor.editors) {
			if (UVEditor.editors[key]) {
				UVEditor.editors[key].loadData()
			}
		}
	},


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
			{icon: editor.reference_face.enabled!==false ? 'check_box' : 'check_box_outline_blank', name: 'generic.export', click: function(editor) {
				Undo.initEdit({elements: Cube.selected, uv_only: true})
				editor.toggleUV(event)
				Undo.finishEdit('Toggle UV export')
			}},
			'uv_maximize',
			'uv_auto',
			'uv_rel_auto',
			{icon: 'rotate_90_degrees_ccw', condition: () => Format.uv_rotation, name: 'menu.uv.mapping.rotation', children: function() {
				var off = 'radio_button_unchecked'
				var on = 'radio_button_checked'
				return [
					{icon: (!editor.reference_face.rotation ? on : off), name: '0&deg;', click: function(editor) {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						editor.setRotation(0)
						Undo.finishEdit('Rotate UV')
					}},
					{icon: (editor.reference_face.rotation === 90 ? on : off), name: '90&deg;', click: function(editor) {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						editor.setRotation(90)
						Undo.finishEdit('Rotate UV')
					}},
					{icon: (editor.reference_face.rotation === 180 ? on : off), name: '180&deg;', click: function(editor) {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						editor.setRotation(180)
						Undo.finishEdit('Rotate UV')
					}},
					{icon: (editor.reference_face.rotation === 270 ? on : off), name: '270&deg;', click: function(editor) {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						editor.setRotation(270)
						Undo.finishEdit('Rotate UV')
					}}
				]
			}},
			'uv_turn_mapping',
			{
				icon: (editor.reference_face.uv[0] > editor.reference_face.uv[2] ? 'check_box' : 'check_box_outline_blank'),
				name: 'menu.uv.mapping.mirror_x',
				click: function(editor) {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					editor.mirrorX(event)
					Undo.finishEdit('Mirror UV')
				}
			},
			{
				icon: (editor.reference_face.uv[1] > editor.reference_face.uv[3] ? 'check_box' : 'check_box_outline_blank'),
				name: 'menu.uv.mapping.mirror_y',
				click: function(editor) {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					editor.mirrorY(event)
					Undo.finishEdit('Mirror UV')
				}
			},
		]}},
		'face_tint',
		{icon: 'flip_to_back', condition: () => Format.id == 'java_block', name: 'action.cullface', children: function(editor) {
			var off = 'radio_button_unchecked';
			var on = 'radio_button_checked';
			function setCullface(cullface) {
				Undo.initEdit({elements: Cube.selected, uv_only: true})
				editor.forCubes(obj => {
					obj.faces[editor.face].cullface = cullface;
				})
				Undo.finishEdit(cullface ? `Set cullface to ${cullface}` : 'Disable cullface');
			}
			return [
				{icon: (!editor.reference_face.cullface ? on : off), name: 'uv_editor.no_faces', click: () => setCullface('')},
				{icon: (editor.reference_face.cullface == 'north' ? on : off), name: 'face.north', click: () => setCullface('north')},
				{icon: (editor.reference_face.cullface == 'south' ? on : off), name: 'face.south', click: () => setCullface('south')},
				{icon: (editor.reference_face.cullface == 'west' ? on : off), name: 'face.west', click: () => setCullface('west')},
				{icon: (editor.reference_face.cullface == 'east' ? on : off), name: 'face.east', click: () => setCullface('east')},
				{icon: (editor.reference_face.cullface == 'up' ? on : off), name: 'face.up', click: () => setCullface('up')},
				{icon: (editor.reference_face.cullface == 'down' ? on : off), name: 'face.down', click: () => setCullface('down')},
				'auto_cullface'
			]
		}},
		{icon: 'collections', name: 'menu.uv.texture', condition: () => !Project.box_uv, children: function() {
			var arr = [
				{icon: 'crop_square', name: 'menu.cube.texture.blank', click: function(editor, event) {
					Undo.initEdit({elements: Cube.selected})
					Cube.selected.forEach((obj) => {
						editor.getFaces(event).forEach(function(side) {
							obj.faces[side].texture = false;
						})
						Canvas.adaptObjectFaces(obj)
					})
					editor.loadData()
					editor.message('uv_editor.reset')
					Undo.initEdit('texture blank')
				}},
				{icon: 'clear', name: 'menu.cube.texture.transparent', click: function(editor) {editor.clear(event)}},
			]
			Texture.all.forEach(function(t) {
				arr.push({
					name: t.name,
					icon: (t.mode === 'link' ? t.img : t.source),
					click: function(editor) {editor.applyTexture(t.uuid)}
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
			UVEditor.all_editors.forEach(editor => {
				editor.setGrid(value);
			});
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
		condition: () => Project.box_uv,
		icon: 'view_quilt',
		category: 'uv',
		onChange(value) {
			//UVEditor.showing_overlays = value;
			//UVEditor.displayAllMappingOverlays();
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
				width: 320,
				height: 320,
				zoom: 1,
				checkerboard: settings.uv_checkerboard.value,
				texture: '',

				project_resolution: [16, 16],
				elements: [],
				selected_vertices: {},
				selected_faces: []
			}},
			computed: {
				inner_width() {
					return this.width * this.zoom;
				},
				inner_height() {
					return this.width * (this.project_resolution[0] / this.project_resolution[1]) * this.zoom;
				},
				mappable_elements() {
					return this.elements.filter(element => element.faces);
				}
			},
			watch: {
				width(width) {
				}
			},
			methods: {
				projectResolution() {
					BarItems.project_window.trigger()
				},
				updateSize() {
					let old_size = this.width;
					let size = Math.floor(Math.clamp(UVEditor.panel.width - 10, 64, 1e5));
					this.width = size;
					this.$refs.viewport.scrollLeft = Math.round(this.$refs.viewport.scrollLeft * (size / old_size));
					this.$refs.viewport.scrollTop  = Math.round(this.$refs.viewport.scrollTop  * (size / old_size));

					/*for (var id in UVEditor.sliders) {
						UVEditor.sliders[id].setWidth(size/(Project.box_uv?2:4)-1)
					}*/
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
						this.texture = null;
						UVEditor.texture = null;
					} else if (texture instanceof Texture) {
						this.texture = (!texture.error || texture.error == 2) ? texture.source : '';
					} else {
						this.texture = '';
					}
				},
				onMouseWheel(event) {
					if (event.ctrlOrCmd) {
				
						event.stopPropagation()
						event.preventDefault()
				
						var n = (event.deltaY < 0) ? 0.1 : -0.1;
						n *= this.zoom
						var number = limitNumber(this.zoom + n, 0.5, this.max_zoom)
						let old_zoom = this.zoom;

						this.zoom = number;
						
						let {viewport} = this.$refs;
						let offset = $(this.$refs.viewport).offset()
						let offsetX = event.clientX - offset.left;
						let offsetY = event.clientY - offset.top;
				
						let zoom_diff = this.zoom - old_zoom;
						viewport.scrollLeft += ((viewport.scrollLeft + offsetX) * zoom_diff) / old_zoom
						viewport.scrollTop  += ((viewport.scrollTop  + offsetY) * zoom_diff) / old_zoom
				
						return false;
					}
				},
				onMouseDown(event) {
					if (event.which === 2) {
						let {viewport} = this.$refs;
						let coords = {x: 0, y: 0}
						function dragMouseWheel(e2) {
							console.log()
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
					}
				},
				contextMenu(event) {
					UVEditor.menu.open(event);
				}
			},
			template: `
				<div class="UVEditor" ref="main" :class="{checkerboard_trigger: checkerboard}" id="UVEditor">

					<div class="bar next_to_title" id="uv_title_bar">
						<div id="project_resolution_status" @click="projectResolution()">
							{{ project_resolution[0] + ' ⨉ ' + project_resolution[1] }}
						</div>
					</div>

					<div id="uv_viewport" @contextmenu="contextMenu($event)" @mousedown="onMouseDown($event)" @touchstart="onMouseDown($event)" @mousewheel="onMouseWheel($event)" class="checkerboard_target" ref="viewport" :style="{width: width + 'px', height: height + 'px', overflowX: (zoom > 1) ? 'scroll' : 'hidden', overflowY: (inner_height > height) ? 'scroll' : 'hidden'}">

						<div id="uv_frame" ref="frame" :style="{width: inner_width + 'px', height: inner_height + 'px'}">

							<template v-if="mode == 'uv'" v-for="element in mappable_elements" :key="element.uuid">
								<template v-if="element.faces" v-for="(face, key) in element.faces" :key="key">
									{{ element.name + ' - ' + key }}
								</template>
							</template>

							<img style="object-fit: cover; object-position: 0px 0px;" v-if="texture" :src="texture">
						</div>
					</div>
					<div class="bar uv_editor_sliders" ref="slider_bar" style="margin-left: 2px;">
					</div>
					<div class="toolbar_wrapper uv_editor">
					</div>
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
	new NumSlider({
		id: 'uv_slider_pos_x',
		private: true,
		condition: function() {return true},
		get: function() {
			if (Project.box_uv && Cube.selected[0]) {
				return trimFloatNumber(Cube.selected[0].uv_offset[0])
			} else if (Cube.selected[0]) {
				var face_uv = Cube.selected[0].faces[UVEditor.face].uv
				if (face_uv) {
					return trimFloatNumber(face_uv[0])
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

	new NumSlider({
		id: 'uv_slider_pos_y',
		private: true,
		condition: function() {return true},
		get: function() {
			if (Project.box_uv && Cube.selected[0]) {
				return trimFloatNumber(Cube.selected[0].uv_offset[1])
			} else if (Cube.selected[0]) {
				var face_uv = Cube.selected[0].faces[UVEditor.face].uv
				if (face_uv) {
					return trimFloatNumber(face_uv[1])
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

	new NumSlider({
		id: 'uv_slider_size_x',
		private: true,
		condition: function() {return !Project.box_uv},
		get: function() {
			if (!Project.box_uv && Cube.selected[0]) {
				var face_uv = Cube.selected[0].faces[UVEditor.face].uv
				if (face_uv) {
					return trimFloatNumber(face_uv[2] - face_uv[0])
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

	new NumSlider({
		id: 'uv_slider_size_y',
		private: true,
		condition: function() {return !Project.box_uv},
		get: function() {
			if (!Project.box_uv && Cube.selected[0]) {
				var face_uv = Cube.selected[0].faces[UVEditor.face].uv
				if (face_uv) {
					return trimFloatNumber(face_uv[3] - face_uv[1])
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
