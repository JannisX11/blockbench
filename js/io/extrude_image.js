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
	async convertImage(file, options) {
		let image = new Image();
		await new Promise(resolve => {
			image.onload = resolve;
			image.onerror = resolve;
			image.src = Filesystem.getImageSource(file);
		})
		if (!image.naturalWidth) return false;
		Extruder.ext_img = image;
		Extruder.image_file = file;
		Extruder.width = image.naturalWidth;
		Extruder.height = image.naturalHeight;
		Extruder.startConversion(options);
		return true;
	},
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
	scanAreas(image_data, width, height, options = {}) {
		let mode = options.mode || 'areas';
		let tolerance = Math.round(options.scan_tolerance ?? 255);
		let finished_pixels = {};
		let areas = [];

		function isOpaquePixel(px_x, px_y) {
			let opacity = image_data[(px_x + width * px_y) * 4 + 3];
			return Math.isBetween(px_x, 0, width-1)
				&& Math.isBetween(px_y, 0, height-1)
				&& opacity >= tolerance;
		}
		function isPixelFinished(x, y) {
			return (finished_pixels[x] !== undefined && finished_pixels[x][y] === true);
		}

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				if (isPixelFinished(x, y) || !isOpaquePixel(x, y)) continue;

				let rect = {x, y, x2: x, y2: y};
				let loop = true;
				let safety_limit = 5000;
				while (loop && safety_limit) {
					let can_expand_x = false;
					let can_expand_y = false;
					if (mode === 'areas' || mode === 'lines') {
						can_expand_x = true;
						for (let check = rect.y; check <= rect.y2; check++) {
							if (!isOpaquePixel(rect.x2 + 1, check) || isPixelFinished(rect.x2 + 1, check)) can_expand_x = false;
						}
						if (can_expand_x) rect.x2++;
					}
					if (mode === 'areas' || mode === 'columns') {
						can_expand_y = true;
						for (let check = rect.x; check <= rect.x2; check++) {
							if (!isOpaquePixel(check, rect.y2 + 1) || isPixelFinished(check, rect.y2 + 1)) can_expand_y = false;
						}
						if (can_expand_y) rect.y2++;
					}
					if (!can_expand_x && !can_expand_y) loop = false;
					safety_limit--;
				}
				for (let fy = rect.y; fy <= rect.y2; fy++) {
					for (let fx = rect.x; fx <= rect.x2; fx++) {
						if (finished_pixels[fx] === undefined) finished_pixels[fx] = {};
						finished_pixels[fx][fy] = true;
					}
				}
				areas.push(rect);
			}
		}
		return areas;
	},
	startConversion(formResult) {
		let offset = formResult.offset instanceof Array ? formResult.offset : [0, 0, 0];
		let depth = typeof formResult.depth == 'number' ? formResult.depth : null;

		//Undo
		Undo.initEdit({elements: Outliner.selected, outliner: true, textures: []})
		var texture = new Texture().fromFile(Extruder.image_file).add(false).fillParticle();

		var c = document.createElement('canvas')
		var ctx = c.getContext('2d');
		c.width = Extruder.ext_img.naturalWidth;
		c.height = Extruder.ext_img.naturalHeight;
		ctx.drawImage(Extruder.ext_img, 0, 0)
		var image_data = ctx.getImageData(0, 0, c.width, c.height).data
		texture.uv_width = c.width;
		texture.uv_height = c.height;

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

		for (let rect of Extruder.scanAreas(image_data, c.width, c.height, formResult)) {
			let from, to, faces;
			if (formResult.orientation == 'upright')  {
				from = [rect.x*scale_i, 16 - (rect.y2+1)*scale_i, 0];
				to = [(rect.x2+1)*scale_i, 16 - rect.y*scale_i, depth ?? scale_i];
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
				to = [(rect.x2+1)*scale_i, depth ?? scale_i, (rect.y2+1)*scale_i];
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
				from: from.map((v, i) => v + offset[i]),
				to: to.map((v, i) => v + offset[i]),
				faces
			}).init();
			Outliner.selected.push(current_cube);
			cube_nr++;
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