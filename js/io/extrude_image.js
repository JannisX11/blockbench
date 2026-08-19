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
					upright_z: 'dialog.extrude.orientation.upright_z',
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
		let groups = [];
		Undo.initEdit({elements: Outliner.selected, groups, outliner: true, textures: []});
		let texture = new Texture().fromFile(Extruder.image_file).add(false).fillParticle();
		texture.uv_width = Extruder.ext_img.naturalWidth;
		texture.uv_height = Extruder.ext_img.naturalHeight;

		let pixel_size = 1;
		if (Format.cube_size_limiter && !Format.integer_size) {
			pixel_size = 16 / Extruder.width;
		}
		let result = Extruder.extrudeTexture(texture, Object.assign({
			image: Extruder.ext_img,
			pixel_size: [pixel_size, pixel_size],
			depth: pixel_size,
			group: texture.name.split('.')[0]
		}, formResult));
		if (result.group) groups.push(result.group);

		Undo.finishEdit(
			'Add extruded texture',
			{elements: Outliner.selected, groups, outliner: true, textures: [Texture.all[Texture.all.length-1]]}
		)
	},
	extrudeTexture(texture, options = {}) {
		let image = options.image || texture.img;
		let canvas = document.createElement('canvas');
		canvas.width = image.naturalWidth || texture.width;
		canvas.height = image.naturalHeight || texture.height;
		let ctx = canvas.getContext('2d');
		ctx.drawImage(image, 0, 0);
		let image_data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

		let orientation = options.orientation || 'flat';
		let mirror_x = options.mirror_x == true;
		let pixel_size = options.pixel_size || [1, 1];
		let depth = options.depth ?? 1;
		let offset = options.offset || [0, 0, 0];
		let origin = options.origin || [0, 0, 0];
		let rotation_steps = (options.rotation || [0, 0, 0]).map(angle => ((Math.round(angle / 90) % 4) + 4) % 4);
		let can_roll = (options.rotation || [0, 0, 0]).allAre(angle => Math.abs(angle % 90) < 0.0001);

		let uv_scale_x = Project.getUVWidth(texture) / canvas.width;
		let uv_scale_y = Project.getUVHeight(texture) / canvas.height;

		let cubes = [];
		for (let rect of Extruder.scanAreas(image_data, canvas.width, canvas.height, options)) {
			let x1 = rect.x * uv_scale_x;
			let x2 = (rect.x2 + 1) * uv_scale_x;
			let y1 = rect.y * uv_scale_y;
			let y2 = (rect.y2 + 1) * uv_scale_y;
			let sprite_x1 = mirror_x ? x2 : x1;
			let sprite_x2 = mirror_x ? x1 : x2;

			let east_uv = [x2 - uv_scale_x, y1, x2, y2];
			let west_uv = [x1, y1, x1 + uv_scale_x, y2];
			if (mirror_x) [east_uv, west_uv] = [west_uv, east_uv];

			let from, to, faces;
			if (orientation == 'upright') {
				from = [rect.x * pixel_size[0], 16 - (rect.y2+1) * pixel_size[1], 0];
				to = [(rect.x2+1) * pixel_size[0], 16 - rect.y * pixel_size[1], depth];
				faces = {
					south:	{uv: [sprite_x1, y1, sprite_x2, y2], texture},
					north:	{uv: [sprite_x2, y1, sprite_x1, y2], texture},
					up:		{uv: [sprite_x1, y1, sprite_x2, y1 + uv_scale_y], texture},
					down:	{uv: [sprite_x1, y2 - uv_scale_y, sprite_x2, y2], texture},
					east:	{uv: east_uv, texture},
					west:	{uv: west_uv, texture},
				};
			} else if (orientation == 'upright_z') {
				from = [0, 16 - (rect.y2+1) * pixel_size[1], 16 - (rect.x2+1) * pixel_size[0]];
				to = [depth, 16 - rect.y * pixel_size[1], 16 - rect.x * pixel_size[0]];
				faces = {
					east:	{uv: [sprite_x1, y1, sprite_x2, y2], texture},
					west:	{uv: [sprite_x2, y1, sprite_x1, y2], texture},
					up:		{uv: [sprite_x1, y1, sprite_x2, y1 + uv_scale_y], texture, rotation: 270},
					down:	{uv: [sprite_x1, y2 - uv_scale_y, sprite_x2, y2], texture, rotation: 90},
					north:	{uv: east_uv, texture},
					south:	{uv: west_uv, texture},
				};
			} else {
				from = [rect.x * pixel_size[0], 0, rect.y * pixel_size[1]];
				to = [(rect.x2+1) * pixel_size[0], depth, (rect.y2+1) * pixel_size[1]];
				faces = {
					up:		{uv: [sprite_x1, y1, sprite_x2, y2], texture},
					down:	{uv: [sprite_x1, y2, sprite_x2, y1], texture},
					north:	{uv: [sprite_x2, y1, sprite_x1, y1 + uv_scale_y], texture},
					south:	{uv: [sprite_x1, y2 - uv_scale_y, sprite_x2, y2], texture},
					east:	{uv: east_uv, texture, rotation: 90},
					west:	{uv: west_uv, texture, rotation: 270},
				};
			}
			if (mirror_x) {
				let sprite_axis = orientation == 'upright_z' ? 2 : 0;
				[from[sprite_axis], to[sprite_axis]] = [-to[sprite_axis], -from[sprite_axis]];
			}

			let cube = new Cube({
				name: options.name || texture.name.split('.')[0],
				autouv: 0, box_uv: false,
				from: from.map((value, axis) => Math.roundTo(value + offset[axis], 4)),
				to: to.map((value, axis) => Math.roundTo(value + offset[axis], 4)),
				origin: origin.slice(),
				rotation: can_roll ? [0, 0, 0] : (options.rotation || [0, 0, 0]).slice(),
				faces
			}).init();
			if (can_roll) {
				rotation_steps.forEach((steps, axis) => {
					if (steps) cube.roll(axis, steps, origin);
				})
			}
			cubes.push(cube);
		}

		let group = null;
		if (options.group) {
			group = new Group({name: options.group}).init().addTo(options.parent);
			cubes.forEach(cube => cube.addTo(group));
		}
		Outliner.selected.replace(cubes);
		return {cubes, group};
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
