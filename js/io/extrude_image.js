//Extruder
export const Extruder = {
	dialog: new Dialog({
		id: 'image_extruder',
		title: 'dialog.extrude.title',
		buttons: ['dialog.confirm', 'dialog.cancel'],
		part_order: ['form', 'lines'],
		form: {
			mode: {
				label: 'dialog.extrude.mode',
				type: 'select',
				options: {
					areas: 'dialog.extrude.mode.areas',
					lines: 'dialog.extrude.mode.lines',
					columns: 'dialog.extrude.mode.columns',
					pixels: 'dialog.extrude.mode.pixels'
				}
			},
			orientation: {
				label: 'dialog.extrude.orientation',
				type: 'select',
				options: {
					upright: 'dialog.extrude.orientation.upright',
					flat: 'dialog.extrude.orientation.flat',
				}
			},
			scan_tolerance: {
				label: 'dialog.extrude.opacity',
				type: 'range',
				min: 1, max: 255, value: 255, step: 1,
				editable_range_label: true
			}
		},
		lines: [
			Interface.createElement('canvas', {height: 256, width: 256, id: 'extrusion_canvas', class: 'checkerboard'})
		],
		onConfirm(formResult) {
			Extruder.startConversion(formResult);
		}
	}),
	drawImage(file) {
		Extruder.canvas = $('#extrusion_canvas').get(0)
		var ctx = Extruder.canvas.getContext('2d')

		Extruder.ext_img = new Image()
		Extruder.ext_img.src = isApp ? file.path.replace(/#/g, '%23') : file.content
		Extruder.image_file = file
		Extruder.ext_img.style.imageRendering = 'pixelated'
		Extruder.canvas.style.imageRendering = 'pixelated'

		Extruder.ext_img.onload = function() {
			let ratio = Extruder.ext_img.naturalWidth / Extruder.ext_img.naturalHeight;
			Extruder.canvas.width = 256;
			Extruder.canvas.height = 256 / ratio;
			ctx.clearRect(0, 0, Extruder.canvas.width, Extruder.canvas.height);
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(Extruder.ext_img, 0, 0, Extruder.canvas.width, Extruder.canvas.height);
			Extruder.width = Extruder.ext_img.naturalWidth;
			Extruder.height = Extruder.ext_img.naturalHeight;

			if (Extruder.width > 128) return;

			var p = 0
			ctx.beginPath();

			for (var x = 0; x < Extruder.canvas.width; x += 256 / Extruder.width) {
				ctx.moveTo(0.5 + x + p, p);
				ctx.lineTo(0.5 + x + p, 256 + p);
			}
			for (var x = 0; x < Extruder.canvas.height; x += 256 / Extruder.width) {
				ctx.moveTo(p, 0.5 + x + p);
				ctx.lineTo(256 + p, 0.5 + x + p);
			}

			ctx.strokeStyle = CustomTheme.data.colors.grid;
			ctx.stroke();
		}
	},
	startConversion(formResult) {
		var scan_mode = formResult.mode;
		var pixel_opacity_tolerance = Math.round(formResult.scan_tolerance);

		//Undo
		Undo.initEdit({elements: Outliner.selected, outliner: true, textures: []})
		var texture = new Texture().fromFile(Extruder.image_file).add(false).fillParticle();

		//var ext_x, ext_y;
		var ctx = Painter.getCanvas(texture).getContext('2d')

		var c = document.createElement('canvas')
		var ctx = c.getContext('2d');
		c.width = Extruder.ext_img.naturalWidth;
		c.height = Extruder.ext_img.naturalHeight;
		ctx.drawImage(Extruder.ext_img, 0, 0)
		var image_data = ctx.getImageData(0, 0, c.width, c.height).data
		texture.uv_width = c.width;
		texture.uv_height = c.height;

		var finished_pixels = {}
		var cube_nr = 0;
		var cube_name = texture.name.split('.')[0]
		Outliner.selected.empty()

		//Scale Index
		var scale_i = 1;
		if (Format.cube_size_limiter && !Format.integer_size) {
			scale_i = 16 / Extruder.width;
		}
		let uv_scale_x = Project.getUVWidth(texture) / Extruder.width;
		let uv_scale_y = Project.getUVHeight(texture) / Extruder.height;

		function isOpaquePixel(px_x, px_y) {
			var opacity = image_data[(px_x + ctx.canvas.width * px_y) * 4 + 3]
			return Math.isBetween(px_x, 0, Extruder.width-1)
				&& Math.isBetween(px_y, 0, Extruder.height-1)
				&& opacity >= pixel_opacity_tolerance;
		}
		function finishPixel(x, y) {
			if (finished_pixels[x] === undefined) {
				finished_pixels[x] = {}
			}
			finished_pixels[x][y] = true
		}
		function isPixelFinished(x, y) {
			return (finished_pixels[x] !== undefined && finished_pixels[x][y] === true)
		}

		//Scanning
		let ext_y = 0;
		while (ext_y < Extruder.height) {

			let ext_x = 0;
			while (ext_x < Extruder.width) {
				if (isPixelFinished(ext_x, ext_y) === false && isOpaquePixel(ext_x, ext_y) === true) {

					//Search From New Pixel
					var loop = true;
					var rect = {x: ext_x, y: ext_y, x2: ext_x, y2: ext_y}
					var safety_limit = 5000

					//Expanding Loop
					while (loop === true && safety_limit) {
						var y_check, x_check, canExpandX, canExpandY;
						//Expand X
						if (scan_mode === 'areas' || scan_mode === 'lines') {
							y_check = rect.y
							x_check = rect.x2 + 1
							canExpandX = true
							while (y_check <= rect.y2) {
								//Check If Row is Free
								if (isOpaquePixel(x_check, y_check) === false || isPixelFinished(x_check, y_check) === true) {
									canExpandX = false;
								}
								y_check += 1
							}
							if (canExpandX === true) {
								rect.x2 += 1
							}
						} else {
							canExpandX = false;
						}
						//Expand Y
						if (scan_mode === 'areas' || scan_mode === 'columns') {
							x_check = rect.x
							y_check = rect.y2 + 1
							canExpandY = true
							while (x_check <= rect.x2) {
								//Check If Row is Free
								if (isOpaquePixel(x_check, y_check) === false || isPixelFinished(x_check, y_check) === true) {
									canExpandY = false
								}
								x_check += 1
							}
							if (canExpandY === true) {
								rect.y2 += 1
							}
						} else {
							canExpandY = false;
						}
						//Conclusion
						if (canExpandX === false && canExpandY === false) {
							loop = false;
						}
						safety_limit--;
					}

					//Draw Rectangle
					var draw_x = rect.x
					var draw_y = rect.y
					while (draw_y <= rect.y2) {
						draw_x = rect.x
						while (draw_x <= rect.x2) {
							finishPixel(draw_x, draw_y)
							draw_x++;
						}
						draw_y++;
					}

					// Generate cube
					let from, to, faces;
					if (formResult.orientation == 'upright')  {
						from = [rect.x*scale_i, 16 - (rect.y2+1)*scale_i, 0];
						to = [(rect.x2+1)*scale_i, 16 - rect.y*scale_i, scale_i];
						faces = {
							south:	{uv: [rect.x*uv_scale_x, rect.y*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							north:	{uv: [(rect.x2+1)*uv_scale_x, rect.y*uv_scale_y, rect.x*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							up:		{uv: [rect.x*uv_scale_x, rect.y*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y+1)*uv_scale_y], texture: texture},
							down:	{uv: [rect.x*uv_scale_x, rect.y2*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							east:	{uv: [rect.x2*uv_scale_x, rect.y*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							west:	{uv: [rect.x*uv_scale_x, rect.y*uv_scale_y, (rect.x+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
						};
					} else {
						from = [rect.x*scale_i, 0, rect.y*scale_i];
						to = [(rect.x2+1)*scale_i, scale_i, (rect.y2+1)*scale_i];
						faces = {
							up:		{uv: [rect.x*uv_scale_x, rect.y*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							down:	{uv: [rect.x*uv_scale_x, (rect.y2+1)*uv_scale_y, (rect.x2+1)*uv_scale_x, rect.y*uv_scale_y], texture: texture},
							north:	{uv: [(rect.x2+1)*uv_scale_x, rect.y*uv_scale_y, rect.x*uv_scale_x, (rect.y+1)*uv_scale_y], texture: texture},
							south:	{uv: [rect.x*uv_scale_x, rect.y2*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture},
							east:	{uv: [rect.x2*uv_scale_x, rect.y*uv_scale_y, (rect.x2+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture, rotation: 90},
							west:	{uv: [rect.x*uv_scale_x, rect.y*uv_scale_y, (rect.x+1)*uv_scale_x, (rect.y2+1)*uv_scale_y], texture: texture, rotation: 270},
						};
					}
					var current_cube = new Cube({
						name: cube_name+'_'+cube_nr,
						autouv: 0, box_uv: false,
						from, to, faces
					}).init();
					Outliner.selected.push(current_cube);
					cube_nr++;
				}

				ext_x++;
			}
			ext_y++;
		}

		var group = new Group(cube_name).init().addTo()
		Outliner.selected.forEach(function(s) {
			s.addTo(group).init()
		})

		Undo.finishEdit(
			'Add extruded texture',
			{elements: Outliner.selected, outliner: true, textures: [Texture.all[Texture.all.length-1]]}
		)
	}
}

BARS.defineActions(() => {
	new Action('extrude_texture', {
		icon: 'eject',
		category: 'file',
		condition: _ => (Project && (!Project.box_uv || Format.optional_box_uv)),
		click() {
			Blockbench.import({
				resource_id: 'texture',
				extensions: ['png'],
				type: 'PNG Texture',
				readtype: 'image'
			}, (files) => {
				if (files.length) {
					Extruder.dialog.show();
					Extruder.drawImage(files[0]);
				}
			})
		}
	})
});