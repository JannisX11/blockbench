
function createEmptyCanvas(width, height) {
	canvas = document.createElement('canvas');
	let ctx = canvas.getContext('2d');
	canvas.width = width;
	canvas.height = height;
	ctx.imageSmoothingEnabled = false;
	return [canvas, ctx];
}

const ScreencamGIFFormats = {
	gif: {
		name: 'dialog.create_gif.format.gif',
		interval: v => Math.max(Math.round(v.interval / 10) * 10, 20),
		async process(vars, options) {
			vars.gif = GIFEnc.GIFEncoder()
			if (!options.silent) {
				Screencam.processing_gif = vars.gif;
			}
			let i = 0;
			let format = 'rgb565';
			let prio_color_accuracy = false;
			function quantize(data) {
				let palette = vars.has_transparency ? [[0, 0, 0]] : [];
				let counter = vars.has_transparency ? [100] : [];
				for (let i = 0; i < data.length; i += 4) {
					if (data[i+3] < 127) {
						continue;
					}
					let r = data[i];
					let g = data[i+1];
					let b = data[i+2];
					let match = palette.findIndex((color, i) => color[0] == r && color[1] == g && color[2] == b && (i != 0 || !vars.has_transparency));
					if (match == -1) {
						palette.push([r, g, b])
						counter.push(1)
					} else {
						counter[match] += 1;
					}
					if (!prio_color_accuracy && palette.length > 256) break;
				}
				let threshold = 4;
				while (palette.length > 256 && prio_color_accuracy) {
					counter.forEachReverse((count, index) => {
						if (index == 0) return;
						if (count < threshold) {
							palette.splice(index, 1);
							counter.splice(index, 1);
						}
					});
					threshold *= 1.5;
					if (threshold > 50) break;
				}
				return palette;
			}
			function applyPalette(data, palette) {
				let array = new Uint8Array(data.length / 4);
				for (let i = 0; i < array.length; i++) {
					if (data[i*4+3] < 127) {
						continue;
					}
					let r = data[i*4];
					let g = data[i*4+1];
					let b = data[i*4+2];
					let match = palette.findIndex((color, i) => color[0] == r && color[1] == g && color[2] == b && (i != 0 || !vars.has_transparency));
					if (match == -1 && prio_color_accuracy) {
						let closest = palette.filter((color, i) => Math.epsilon(color[0], r, 6) && Math.epsilon(color[1], g, 6) && Math.epsilon(color[2], b, 6) && (i != 0 || !vars.has_transparency));
						if (!closest.length) {
							closest = palette.filter((color, i) => Math.epsilon(color[0], r, 24) && Math.epsilon(color[1], g, 24) && Math.epsilon(color[2], b, 128) && (i != 0 || !vars.has_transparency));
						}
						if (!closest.length) {
							closest = palette.filter((color, i) => Math.epsilon(color[0], r, 24) && Math.epsilon(color[1], g, 24) && Math.epsilon(color[2], b, 128) && (i != 0 || !vars.has_transparency));
						}
						if (!closest.length) {
							closest = palette.filter((color, i) => Math.epsilon(color[0], r, 64) && Math.epsilon(color[1], g, 64) && Math.epsilon(color[2], b, 128) && (i != 0 || !vars.has_transparency));
						}
						if (!closest.length) {
							closest = palette.slice();
						}
						closest.sort((color_a, color_b) => {
							let diff_a = Math.pow(color_a[0] + r, 2) + Math.pow(color_a[1] + g, 2) + Math.pow(color_a[2] + b, 2);
							let diff_b = Math.pow(color_b[0] + r, 2) + Math.pow(color_b[1] + g, 2) + Math.pow(color_b[2] + b, 2);
							return diff_a - diff_b;
						})
						if (closest[0]) {
							match = palette.indexOf(closest[0]);
						}
					}
					if (match != -1) array[i] = match;
				}
				return array;
			}
			for (let canvas of vars.frame_canvases) {
				let data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
				let palette = quantize(data, 256, {format, oneBitAlpha: true, clearAlphaThreshold: 127});
				let index;
				if (palette.length > 256) {
					// Built-in methods
					palette = GIFEnc.quantize(data, 256, {format, oneBitAlpha: true, clearAlphaThreshold: 127});
					index = GIFEnc.applyPalette(data, palette, format);
				} else {
					// Direct flicker-free color mapping
					index = applyPalette(data, palette, format);
				}
				vars.gif.writeFrame(index, canvas.width, canvas.height, { palette, delay: vars.interval, transparent: vars.has_transparency });
				i++;
				Blockbench.setProgress(i / vars.frame_canvases.length);
				await new Promise(resolve => setTimeout(resolve, 0));
			}

			vars.gif.finish();

			let buffer = vars.gif.bytesView();
			let blob = new Blob([buffer], {type: 'image/gif'});
			var reader = new FileReader();
			reader.onload = () => {
				delete Screencam.processing_gif;
				Screencam.returnScreenshot(reader.result, vars.cb, blob);
			}
			reader.readAsDataURL(blob);
		}
	},
	apng: {
		name: 'APNG',
		interval: v => Math.max(Math.round(v.interval / 10) * 10, 20),
		async process(vars, options) {
			let [canvas] = createEmptyCanvas(vars.canvas_width, vars.canvas_height);
			vars.apng_encoder = new APNGencoder(canvas);
			
			vars.apng_encoder.setRepeat(0);
			vars.apng_encoder.setDelay(Math.round(vars.interval / 10));    // 1/100 sec
			vars.apng_encoder.setDispose((vars.background_image || options.background) ? 0 : 1);
			vars.apng_encoder.setBlend(1);
			
			vars.apng_encoder.start();

			let i = 0;
			for (let canvas of vars.frame_canvases) {
				vars.apng_encoder.addFrame(canvas);
				i++;
				Blockbench.setProgress(i / vars.frame_canvases.length);
				await new Promise(resolve => setTimeout(resolve, 0));
			}

			vars.apng_encoder.finish();

			var base64Out = bytesToBase64(vars.apng_encoder.stream().bin);
			let dataUrl = "data:image/png;base64," + base64Out;
			Screencam.returnScreenshot(dataUrl, vars.cb);
		}
	},
	png_sequence: {
		name: 'dialog.create_gif.format.png_sequence',
		async process(vars) {
			let archive = new JSZip();
			let digits = vars.frame_canvases.length.toString().length;
			let i = 0;
			for (let canvas of vars.frame_canvases) {
				let data_url = canvas.toDataURL();
				archive.file(i.toDigitString(digits) + '.png', data_url.replace('data:image/png;base64,', ''), {base64: true});
				i++;
				Blockbench.setProgress(i / vars.frame_canvases.length);
				await new Promise(resolve => setTimeout(resolve, 0));
			}
			archive.generateAsync({type: 'blob'}).then(content => {
				Blockbench.export({
					type: 'Zip Archive',
					extensions: ['zip'],
					name: 'png_sequence',
					content,
					savetype: 'zip'
				})
			})
		}
	}
}

const Screencam = {
	NoAAPreview: null,
	recording_timelapse: false,
	gif_options_dialog: new Dialog({
		id: 'create_gif',
		title: tl('dialog.create_gif.title'),
		draggable: true,
		form: {
			format: {label: 'dialog.create_gif.format', type: 'select', options: Object.fromEntries(Object.entries(ScreencamGIFFormats).map(e => [e[0], e[1].name]))},
			'_1': '_',
			length_mode: {label: 'dialog.create_gif.length_mode', type: 'select', default: 'seconds', options: {
				seconds: 'dialog.create_gif.length_mode.seconds',
				frames: 'dialog.create_gif.length_mode.frames',
				animation: 'dialog.create_gif.length_mode.animation',
				turntable: 'dialog.create_gif.length_mode.turntable',
			}},
			length: 	{label: 'dialog.create_gif.length', type: 'number', value: 5, min: 0.1, step: 0.25, condition: (form) => ['seconds', 'frames'].includes(form.length_mode)},
			fps: 		{label: 'dialog.create_gif.fps', type: 'number', value: 20, min: 0.5, max: 120},
			resolution: {type: 'vector', label: 'dialog.advanced_screenshot.resolution', dimensions: 2, linked_ratio: false, value: [500, 500], toggle_enabled: true, toggle_default: false},
			zoom: 		{type: 'number', label: 'dialog.advanced_screenshot.zoom', value: 42, toggle_enabled: true, toggle_default: false},
			'_2': '_',
			pixelate:	{label: 'dialog.create_gif.pixelate', type: 'range', value: 1, min: 1, max: 8, step: 1},
			color:  	{label: 'dialog.create_gif.color', type: 'color', value: '#000000', toggle_enabled: true, toggle_default: false},
			background_image:  	{label: 'dialog.create_gif.bg_image', type: 'file', extensions: ['png'], readtype: 'image', filetype: 'PNG'},
			play: 		{label: 'dialog.create_gif.play', type: 'checkbox', condition: () => Animator.open},
			turnspeed:	{label: 'dialog.create_gif.turn', type: 'number', value: 0, min: -90, max: 90, description: 'dialog.create_gif.turn.desc'},
			turnspeed_o:{type: 'buttons', condition: (form) => (Animation.selected && form.play), buttons: ['dialog.create_gif.turn.sync_to_anim_length'], click: (index) => {
				Dialog.open.setFormValues({turnspeed: 60 / (Animation.selected.length||1)});
			}},
		},
		onConfirm(formData) {
			formData.background = (formData.color && formData.color.toHex8String() != '#00000000') ? formData.color.toHexString() : undefined;
			this.hide();
			document.getElementById('gif_recording_frame')?.remove();
			Screencam.createGif(formData)
		}
	}),
	advanced_screenshot_dialog: new Dialog({
		id: 'advanced_screenshot',
		title: 'action.advanced_screenshot',
		form: {
			angle_preset: 	{type: 'select', label: 'dialog.advanced_screenshot.angle_preset', value: 'view', options() {
				let options = {
					view: 'View',
				};
				let presets = localStorage.getItem('camera_presets')
				presets = (presets && autoParseJSON(presets, false)) || [];

				DefaultCameraPresets.forEach(preset => {
					if (!Condition(preset.condition)) return;
					options[preset.id] = {color: preset.color, name: tl(preset.name)};
				})
				presets.forEach((preset, i) => {
					if (!Condition(preset.condition)) return;
					options['_'+i] = preset.name;
				})
				return options;
			}},
			resolution: 	{type: 'vector', label: 'dialog.advanced_screenshot.resolution', dimensions: 2, value: [1920, 1080], linked_ratio: false},
			//zoom_to_fit: 	{type: 'checkbox', label: 'dialog.advanced_screenshot.zoom_to_fit', value: false},
			zoom: 			{type: 'number', label: 'dialog.advanced_screenshot.zoom', value: 42, condition: form => !form.zoom_to_fit, toggle_enabled: true, toggle_default: false},
			anti_aliasing: 	{type: 'select', label: 'dialog.advanced_screenshot.anti_aliasing', value: 'ssaa', options: {
				off: 'dialog.advanced_screenshot.anti_aliasing.off',
				msaa: 'dialog.advanced_screenshot.anti_aliasing.msaa',
				ssaa: 'dialog.advanced_screenshot.anti_aliasing.ssaa',
			}},
			show_gizmos: 	{type: 'checkbox', label: 'dialog.advanced_screenshot.show_gizmos'},
			shading: 		{type: 'checkbox', label: 'dialog.advanced_screenshot.shading', value: settings.shading.value},
		},
		onConfirm(result) {
			Screencam.advancedScreenshot(Preview.selected, result, Screencam.returnScreenshot);
		}
	}),
	screenshotPreview(preview, options = 0, cb) {
		Canvas.withoutGizmos(function() {

			preview.render()

			if (options.crop !== false) {

				if (!options && Modes.display && display_slot === 'gui') {
					var zoom = display_preview.camOrtho.zoom * devicePixelRatio
					var resolution = 256 * zoom;
	
					var start_x = display_preview.width *devicePixelRatio/2 - display_preview.controls.target.x*zoom*40 - resolution/2;
					var start_y = display_preview.height*devicePixelRatio/2 + display_preview.controls.target.y*zoom*40 - resolution/2;
					
					let frame = new CanvasFrame(resolution, resolution)
	
					frame.ctx.drawImage(preview.canvas, start_x, start_y, resolution, resolution, 0, 0, resolution, resolution);
					Screencam.returnScreenshot(frame.canvas.toDataURL(), cb);

				} else {
					let frame = new CanvasFrame(preview.canvas);
					frame.autoCrop()
	
					if (options.width && options.height) {
						let new_frame = new CanvasFrame(options.width, options.height)
						let width = frame.width;
						let height = frame.height;
						if (width > options.width)   {height /= width / options.width;  width = options.width;}
						if (height > options.height) {width /= height / options.height; height = options.height;}
						new_frame.ctx.drawImage(frame.canvas, (options.width - width)/2, (options.height - height)/2, width, height)
						frame = new_frame;
					}
	
					Screencam.returnScreenshot(frame.canvas.toDataURL(), cb)
				}
			} else {
				
				if (!options.width && !options.height) {
					var dataUrl = preview.canvas.toDataURL()
					Screencam.returnScreenshot(dataUrl, cb)

				} else {	
					let frame = new CanvasFrame(options.width, options.height)
					let width = preview.canvas.width;
					let height = preview.canvas.height;
					if (width > options.width)   {height /= width / options.width;  width = options.width;}
					if (height > options.height) {width /= height / options.height; height = options.height;}
					frame.ctx.drawImage(preview.canvas, (options.width - width)/2, (options.height - height)/2, width, height)
	
					Screencam.returnScreenshot(frame.canvas.toDataURL(), cb)
				}
			}
		})
	},
	async advancedScreenshot(preview = Preview.selected, options = 0, cb) {
		let current_shading = settings.shading.value;

		let render = async () => {

			if (typeof options.shading == 'boolean' && options.shading != current_shading) {
				settings.shading.set(options.shading);
			}

			let render_viewport = options.anti_aliasing == 'msaa' ? MediaPreview : Screencam.NoAAPreview;

			let sample_factor = options.anti_aliasing == 'ssaa' ? 4 : 1;
			render_viewport.resize(options.resolution[0] * sample_factor, options.resolution[1] * sample_factor);
			if (options.angle_preset == 'view') {
				render_viewport.copyView(preview);
			} else {
				let preset = isNaN(options.angle_preset.substring(1))
					? DefaultCameraPresets.find(p => p.id == options.angle_preset)
					: JSON.parse(localStorage.getItem('camera_presets'))[parseInt(options.angle_preset)];
				render_viewport.loadAnglePreset(preset);
			}
			if (options.zoom) {
				if (!render_viewport.isOrtho) {
					render_viewport.camera.setFocalLength(options.zoom);
				} else {
					render_viewport.camera.zoom = options.zoom / 100 * sample_factor;
					render_viewport.camera.updateProjectionMatrix();
				}
			}
			if (render_viewport.isOrtho) {

			}
			render_viewport.render();

			if (options.anti_aliasing == 'ssaa') {

				let img_frame = new CanvasFrame(options.resolution[0] * sample_factor, options.resolution[1] * sample_factor);
				let frame = new CanvasFrame(options.resolution[0], options.resolution[1]);
				let img = new Image()
				img.src = render_viewport.canvas.toDataURL();
				await new Promise((resolve, reject) => {
					img.onload = function() {
						resolve()
					}
					img.onerror = reject;
				})
				img_frame.ctx.filter = `blur(1px)`;
				img_frame.ctx.drawImage(img, 0, 0, options.resolution[0] * sample_factor, options.resolution[1] * sample_factor, 0, 0, options.resolution[0] * sample_factor, options.resolution[1] * sample_factor);
				frame.ctx.drawImage(img_frame.canvas, 0, 0, options.resolution[0] * sample_factor, options.resolution[1] * sample_factor, 0, 0, options.resolution[0], options.resolution[1]);

				if (frame.isEmpty() && options.resolution[0] * options.resolution[1] > 2_000_000) {
					Blockbench.showMessageBox({
						translateKey: 'screenshot_too_large',
						icon: 'broken_image'
					})
					return false;
				}

				Screencam.returnScreenshot(frame.canvas.toDataURL(), cb);

			} else {
				Screencam.returnScreenshot(render_viewport.canvas.toDataURL(), cb);
			}

			if (settings.shading.value != current_shading) {
				settings.shading.set(current_shading);
			}
		};
		if (options.show_gizmos) {
			render();
		} else {
			Canvas.withoutGizmos(render);
		}
	},
	fullScreen(options = 0, cb) {
		setTimeout(async function() {
			let screenshot = await currentwindow.capturePage();
			let dataUrl = screenshot.toDataURL()

			if (!options.width && !options.height) {
				Screencam.returnScreenshot(dataUrl, cb)

			} else {
				let frame = await new CanvasFrame().loadFromURL(dataUrl);
				let width = frame.width;
				let height = frame.height;
				if (width > options.width)   {height /= width / options.width;  width = options.width;}
				if (height > options.height) {width /= height / options.height; height = options.height;}
				frame.ctx.drawImage(frame, (options.width - width)/2, (options.height - height)/2, width, height)

				Screencam.returnScreenshot(frame.canvas.toDataURL(), cb)
			}
		}, 40)
	},
	screenshot2DEditor(options = 0, cb) {
		let canvas = document.createElement('canvas');
		let ctx = canvas.getContext('2d');
		canvas.width = options.width || UVEditor.vue.inner_width;
		canvas.height = options.height || UVEditor.vue.inner_height;
		ctx.imageSmoothingEnabled = false;
		let tex = Texture.getDefault();
		if (tex) {
			ctx.drawImage(tex.img, 0, 0, canvas.width, canvas.height);
		}
		let dataUrl = canvas.toDataURL();
		Screencam.returnScreenshot(dataUrl, cb);
		return;
	},
	async returnScreenshot(dataUrl, cb, blob) {

		if (cb) {
			cb(dataUrl);
			return;
		}

		let img = new Image()
		let is_gif = dataUrl.substr(5, 9) == 'image/gif'
		img.src = dataUrl
		img.className = 'allow_default_menu checkerboard';
		await new Promise((resolve, reject) => {
			img.onload = resolve;
			img.onerror = reject;
		})
		let bytes = dataUrl.length * 0.73;
		let size_text = '';
		if (blob) bytes = blob.size;
		if (bytes > 1048576) {
			size_text = `${Math.roundTo(bytes / 1048576, 2)} MB`;
		} else {
			size_text = `${Math.round(bytes / 1024)} KB`;
		}

		let center = document.createElement('center');
		center.innerHTML = `<div>${img.naturalWidth} x ${img.naturalHeight}px, ${size_text}, ${is_gif ? 'GIF' : 'PNG'}</div>`;
		center.appendChild(img);

		let buttons = ['dialog.save', 'dialog.cancel'];
		if (!is_gif) {
			buttons = ['message.screenshot.clipboard', 'dialog.save', 'menu.texture.edit', 'dialog.cancel'];
		}
		let dialog = new Dialog({
			title: 'message.screenshot.title', 
			id: 'screenshot',
			width: img.naturalWidth + 50,
			lines: [
				center
			],
			buttons,
			onButton(result_index) {
				let result = buttons[result_index];

				if (result === 'message.screenshot.clipboard') {
					if (navigator.clipboard && navigator.clipboard.write) {
						fetch(dataUrl).then(async data => {
							const blob = await data.blob();
							await navigator.clipboard.write([
								new ClipboardItem({
									[blob.type]: blob
								})
							]);
						})
					} else {
						Blockbench.showQuickMessage('message.screenshot.right_click');
						return false;
					}
				} else if (result === 'dialog.save') {
					Blockbench.export({
						resource_id: 'screenshot',
						extensions: [is_gif ? 'gif' : 'png'],
						type: tl('data.image'),
						savetype: is_gif ? 'binary' : 'image',
						name: Project ? Project.name.replace(/\.geo$/, '') : 'screenshot',
						content: is_gif ? (isApp ? Buffer(dataUrl.split(',')[1], 'base64') : blob) : dataUrl,
					})
				} else if (result === 'menu.texture.edit') {
					Codecs.image.load(dataUrl, '', [img.naturalWidth, img.naturalHeight]);
					Texture.all[0].name = 'screenshot';
				}
			}
		})
		dialog.show();
	},
	// deprecated
	cleanCanvas(options, cb) {
		Preview.selected.screenshot(options, cb)
	},
	gif_crop: {top: 0, left: 0, right: 0, bottom: 0},

	async createGif(options = {}, cb) {
		if (!options.format) options.format = 'gif';
		if (!options.length_mode) options.length_mode = 'seconds';
		if (!options.length) options.length = 1;
		if (!options.pixelate) options.pixelate = 1;
		if (!options.quality) options.quality = 40;

		const vars = {
			cb,
			preview: Preview.selected,
			animation: Animation.selected,
			interval: options.fps ? (1000/options.fps) : 100,
			frames: 0,
			frame_canvases: [],
			recording: false,
			loop: null,
			crop: Screencam.gif_crop,
			custom_resolution: options.resolution && (options.resolution[0] > Preview.selected.width || options.resolution[1] > Preview.selected.height),
			has_transparency: options.background == undefined
		}
		if (options.background_image) {
			vars.background_image = new Image();
			vars.background_image.src = options.background_image
			vars.background_image.onerror = () => {
				vars.background_image = null;
			}
			vars.background_image.onload = () => {
				vars.has_transparency = false;
			}
		}
		if (ScreencamGIFFormats[options.format].interval) {
			vars.interval = ScreencamGIFFormats[options.format].interval(vars)
		}

		function getProgress() {
			switch (options.length_mode) {
				case 'seconds': return vars.interval*vars.frames/(options.length*1000); break;
				case 'frames': return vars.frames/options.length; break;
				case 'turntable': return Math.abs(vars.preview.controls.autoRotateProgress) / (2*Math.PI); break;
				case 'animation': return Timeline.time / (vars.animation.length-(vars.interval/1000)); break;
			}
		}
		function startRecording() {
			vars.canvas_width = Math.round(Math.clamp((vars.preview.width - vars.crop.left - vars.crop.right) * window.devicePixelRatio, 24, 4000));
			vars.canvas_height = Math.round(Math.clamp((vars.preview.height - vars.crop.top - vars.crop.bottom) * window.devicePixelRatio, 24, 4000));
	
			if (options.turnspeed) {
				vars.preview.controls.autoRotate = true;
				vars.preview.controls.autoRotateSpeed = options.turnspeed;
				vars.preview.controls.autoRotateProgress = 0;
			} else if (options.length_mode == 'turntable') {
				options.length_mode = 'seconds'
			}
	
			if (options.play && vars.animation) {
				Timeline.setTime(0);
				if (!vars.animation.length) options.length_mode = 'seconds';
			} else if (options.length_mode == 'animation') {
				options.length_mode = 'seconds'
			}
	
			if (!options.silent) {
				Blockbench.setStatusBarText(`${tl('status_bar.recording_gif')} ${tl(ScreencamGIFFormats[options.format].name)}`);
			}

			// Use renderer without anti aliasing to avoid texture bleeding and color flickering
			let NoAAPreview = Screencam.NoAAPreview;
			if (vars.custom_resolution) {
				NoAAPreview.resize(
					vars.canvas_width / options.pixelate,
					vars.canvas_height / options.pixelate
				);
			} else {
				NoAAPreview.resize(
					vars.preview.width * window.devicePixelRatio / options.pixelate,
					vars.preview.height * window.devicePixelRatio / options.pixelate
				);
			}
			NoAAPreview.setProjectionMode(vars.preview.isOrtho);

			vars.recording = true;
			vars.loop = setInterval(() => {
				if (vars.animation && options.play) {
					Timeline.setTime((Timeline.playback_speed/100) * vars.interval*vars.frames / 1000);
					Animator.preview(true);
				}
				vars.frames++;
				Canvas.withoutGizmos(function() {
					// Update camera
					NoAAPreview.controls.unlinked = vars.preview.controls.unlinked;
					NoAAPreview.controls.target.copy(vars.preview.controls.target);
					NoAAPreview.camera.position.copy(vars.preview.camera.position);
					NoAAPreview.camera.quaternion.copy(vars.preview.camera.quaternion);
					if (NoAAPreview.isOrtho) {
						NoAAPreview.camera.zoom = vars.preview.camera.zoom;
						NoAAPreview.camera.top = vars.preview.camera.top;
						NoAAPreview.camera.bottom = vars.preview.camera.bottom;
						NoAAPreview.camera.right = vars.preview.camera.right;
						NoAAPreview.camera.left = vars.preview.camera.left;
						NoAAPreview.camOrtho.updateProjectionMatrix();
					} else {
						if (options.zoom) {
							if (!NoAAPreview.isOrtho) {
								NoAAPreview.camera.setFocalLength(options.zoom);
							} else {
								NoAAPreview.camera.zoom = options.zoom / 100;
								NoAAPreview.camera.updateProjectionMatrix();
							}
							NoAAPreview.camPers.setFocalLength(options.zoom);
						} else {
							NoAAPreview.setFOV(vars.preview.camPers.fov);
						}
					}

					let [canvas, ctx] = createEmptyCanvas(vars.canvas_width, vars.canvas_height);

					NoAAPreview.render();
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					if (options.background) {
						ctx.fillStyle = options.background;
						ctx.fillRect(0, 0, canvas.width, canvas.height);
					}
					if (vars.background_image) {
						ctx.drawImage(vars.background_image, 0, 0, canvas.width, canvas.height);
					}
					if (vars.custom_resolution) {
						ctx.drawImage(NoAAPreview.canvas, 0, 0, NoAAPreview.width * options.pixelate, NoAAPreview.height * options.pixelate);
					} else {
						ctx.drawImage(NoAAPreview.canvas,
							Math.round(-vars.crop.left * window.devicePixelRatio),
							Math.round(-vars.crop.top * window.devicePixelRatio),
							Math.round(NoAAPreview.width * options.pixelate),
							Math.round(NoAAPreview.height * options.pixelate)
						);
					}
					if (ScreencamGIFFormats[options.format].frameRendered) {
						ScreencamGIFFormats[options.format].frameRendered(vars, canvas)
					} else {
						vars.frame_canvases.push(canvas)
					}
					NoAAPreview.controls.unlinked = false;
				})
				Blockbench.setProgress(getProgress());
				vars.frame_label.textContent = vars.frames + ' - ' + (vars.interval*vars.frames/1000).toFixed(2) + 's';

				if (getProgress() >= 1) {
					endRecording(true);
					return;
				}
	
			}, vars.interval)

			vars.frame.classList.add('recording');

			key_listener.delete();
		}
		async function endRecording(render) {
			if (!vars.recording) return;
			vars.recording = false;
			clearInterval(vars.loop);
			if (vars.frame) {
				vars.frame.remove();
			}
			Blockbench.setProgress();
			if (Animator.open && Timeline.playing) {
				Timeline.pause();
			}
			if (options.turnspeed) {
				vars.preview.controls.autoRotate = false;
			}

			// Render
			if (!render) return;
			if (!options.silent) {
				Blockbench.setStatusBarText(`${tl('status_bar.processing_gif')} ${tl(ScreencamGIFFormats[options.format].name)}`)
			}
			await ScreencamGIFFormats[options.format].process(vars, options)
			Blockbench.setProgress();
			Blockbench.setStatusBarText();
		}
		function cancel() {
			vars.frame.remove();
			key_listener.delete();
		}
		function updateCrop() {
			if (!options.resolution) {
				vars.crop.left = 	Math.clamp(vars.crop.left, 	0, vars.preview.width/2  - 20);
				vars.crop.right = 	Math.clamp(vars.crop.right, 	0, vars.preview.width/2  - 20);
				vars.crop.top = 		Math.clamp(vars.crop.top, 	0, vars.preview.height/2 - 20);
				vars.crop.bottom = 	Math.clamp(vars.crop.bottom, 0, vars.preview.height/2 - 20);
			}
			vars.frame.style.top = vars.crop.top + 'px';
			vars.frame.style.left = vars.crop.left + 'px';
			vars.frame.style.right = vars.crop.right + 'px';
			vars.frame.style.bottom = vars.crop.bottom + 'px';
			vars.frame_label.textContent = Math.round(Math.clamp((vars.preview.width - vars.crop.left - vars.crop.right) * window.devicePixelRatio, 24, 4000))
							+ ' x ' + Math.round(Math.clamp((vars.preview.height - vars.crop.top - vars.crop.bottom) * window.devicePixelRatio, 24, 4000))
		}

		// Setup recording UI
		vars.frame = Interface.createElement('div', {id: 'gif_recording_frame'});
		vars.preview.node.append(vars.frame);

		vars.frame_label = Interface.createElement('div', {id: 'gif_recording_frame_label'});
		vars.frame.append(vars.frame_label);

		if (options.resolution) {
			vars.crop.left = vars.crop.right = (vars.preview.width  - options.resolution[0] / window.devicePixelRatio) / 2;
			vars.crop.top = vars.crop.bottom = (vars.preview.height - options.resolution[1] / window.devicePixelRatio) / 2;
		}
		function drag(e1) {
			let crop_original = Object.assign({}, vars.crop);
			function move(e2) {
				convertTouchEvent(e2);
				vars.crop.left	= crop_original.left	+ (e2.clientX - e1.clientX);
				vars.crop.right	= crop_original.right	- (e2.clientX - e1.clientX);
				vars.crop.top	= crop_original.top		+ (e2.clientY - e1.clientY);
				vars.crop.bottom= crop_original.bottom	- (e2.clientY - e1.clientY);
				vars.custom_resolution = false;
				updateCrop();
			}
			function stop(e3) {
				removeEventListeners(document, 'mousemove touchmove', move);
				removeEventListeners(document, 'mouseup touchend', stop);
			}
			addEventListeners(document, 'mousemove touchmove', move);
			addEventListeners(document, 'mouseup touchend', stop);
		}
		addEventListeners(vars.frame_label, 'mousedown touchstart', e => drag(e, 'right', 'top'));

		let resizer_top_right = 	Interface.createElement('div', {style: 'top: -2px; right: -2px;', 	class: 'gif_recording_frame_handle gif_resize_ne'}, Blockbench.getIconNode('arrow_back_ios'));
		let resizer_top_left = 		Interface.createElement('div', {style: 'top: -2px; left: -2px;', 	class: 'gif_recording_frame_handle gif_resize_nw'}, Blockbench.getIconNode('arrow_back_ios'));
		let resizer_bottom_right = 	Interface.createElement('div', {style: 'bottom: -2px; right: -2px;',class: 'gif_recording_frame_handle gif_resize_se'}, Blockbench.getIconNode('arrow_back_ios'));
		let resizer_bottom_left = 	Interface.createElement('div', {style: 'bottom: -2px; left: -2px;', class: 'gif_recording_frame_handle gif_resize_sw'}, Blockbench.getIconNode('arrow_back_ios'));

		function resize(e1, x_value, y_value) {
			let crop_original = Object.assign({}, vars.crop);
			function move(e2) {
				convertTouchEvent(e2);
				vars.crop[x_value] = crop_original[x_value] + (e2.clientX - e1.clientX) * (x_value == 'left' ? 1 : -1);
				vars.crop[y_value] = crop_original[y_value] + (e2.clientY - e1.clientY) * (y_value == 'top'  ? 1 : -1);
				vars.custom_resolution = false;
				updateCrop();
			}
			function stop(e3) {
				removeEventListeners(document, 'mousemove touchmove', move);
				removeEventListeners(document, 'mouseup touchend', stop);
			}
			addEventListeners(document, 'mousemove touchmove', move);
			addEventListeners(document, 'mouseup touchend', stop);
		}
		addEventListeners(resizer_top_right, 	'mousedown touchstart', e => resize(e, 'right', 'top'));
		addEventListeners(resizer_top_left, 	'mousedown touchstart', e => resize(e, 'left', 'top'));
		addEventListeners(resizer_bottom_right, 'mousedown touchstart', e => resize(e, 'right', 'bottom'));
		addEventListeners(resizer_bottom_left,	'mousedown touchstart', e => resize(e, 'left', 'bottom'));
		vars.frame.append(resizer_top_right);
		vars.frame.append(resizer_top_left);
		vars.frame.append(resizer_bottom_right);
		vars.frame.append(resizer_bottom_left);
		updateCrop();

		let controls = Interface.createElement('div', {id: 'gif_recording_controls'});
		vars.frame.append(controls);

		let record_button = Interface.createElement('div', {class: 'tool gif_record_button'}, Blockbench.getIconNode('fiber_manual_record', 'var(--color-close)'));
		record_button.addEventListener('click', event => {
			startRecording();
		});
		controls.append(record_button);

		let key_listener = Blockbench.on('press_key', context => {
			if (Keybinds.extra.confirm.keybind.isTriggered(context.event)) {
				context.capture();
				startRecording();
				return;
			}
			if (Keybinds.extra.cancel.keybind.isTriggered(context.event)) {
				context.capture();
				vars.recording ? endRecording(false) : cancel();
				return;
			}
		})

		let stop_button = Interface.createElement('div', {class: 'tool'}, Blockbench.getIconNode('stop'));
		stop_button.addEventListener('click', event => {
			vars.recording ? endRecording(true) : cancel();
		})
		controls.append(stop_button);

		let cancel_button = Interface.createElement('div', {class: 'tool'}, Blockbench.getIconNode('clear'));
		cancel_button.addEventListener('click', event => {
			vars.recording ? endRecording(false) : cancel();
		})
		controls.append(cancel_button);
	},
	recordTimelapse(options) {
		if (!options.destination) return;

		function getFileName(num) {
			return `${Project.name||'model'}_${num.toDigitString(4)}.png`;
		}
		var index = 0;
		try {
			var list = fs.readdirSync(options.destination);
			while (list.includes(getFileName(index+1))) {
				index++;
			}
		} catch (err) {
			console.log('Unable to analyze past timelapse recording', err)
		}

		Prop.recording = true;
		BarItems.timelapse.setIcon('stop');
		Blockbench.showQuickMessage('message.timelapse_start');

		function saveImage(image) {
			var path = `${options.destination}${osfs}${getFileName(index)}`;
			fs.writeFile(path, image, (e, b) => {});
			
		}
		if (options.source === 'locked') {
			var view_pos = new THREE.Vector3().copy(Preview.selected.camera.position);
			var view_tar = new THREE.Vector3().copy(Preview.selected.controls.target);
		}
		Screencam.timelapse_loop = setInterval(function() {
			index++;

			if (!isApp || options.source === 'preview' || options.source === 'locked') {
				var scope = Preview.selected;
				if (options.source === 'locked') {
					var old_pos = new THREE.Vector3().copy(scope.camera.position);
					var old_tar = new THREE.Vector3().copy(scope.controls.target);
					scope.camera.position.copy(view_pos);
					scope.controls.target.copy(view_tar);
				}

				Canvas.withoutGizmos(function() {

					scope.render();
					var dataUrl = scope.canvas.toDataURL();
					saveImage(nativeImage.createFromDataURL(dataUrl).toPNG());

					if (options.source === 'locked') {
						scope.camera.position.copy(old_pos);
						scope.controls.target.copy(old_tar);
					}

				})
			} else {
				currentwindow.capturePage().then((image) => {
					saveImage(image.toPNG());
				});
			}

		}, options.interval*1000);
	},
	stopTimelapse() {
		if (Prop.recording) {
			Prop.recording = false;
			clearInterval(Screencam.timelapse_loop);
			BarItems.timelapse.setIcon('timelapse');
			Blockbench.showQuickMessage('message.timelapse_stop');
		}
	}
}



BARS.defineActions(function() {
	new Action('screenshot_model', {
		icon: 'photo_camera',
		category: 'view',
		condition: () => !!Project,
		keybind: new Keybind({key: 'p', ctrl: true}),
		click() {
			if (!Format.image_editor) {
				Preview.selected.screenshot()
			} else {
				Screencam.screenshot2DEditor();
			}
		}
	})
	new Action('advanced_screenshot', {
		icon: 'add_a_photo',
		category: 'view',
		condition: () => !!Project && !Format.image_editor,
		click() {
			Screencam.advanced_screenshot_dialog.show();
		}
	})
	new Action('record_model_gif', {
		icon: 'local_movies',
		category: 'view',
		condition: () => Project && !Format.image_editor,
		click() {
			Screencam.gif_options_dialog.show();
		}
	})
	new Action('cancel_gif', {
		icon: 'close',
		category: 'view',
		condition: () => Screencam.processing_gif,
		click() {
			Screencam.processing_gif.abort();
			delete Screencam.processing_gif;
			Blockbench.setProgress();
			Blockbench.setStatusBarText();
		}
	})
	Screencam.timelapse_dialog = new Dialog({
		id: 'timelapse',
		title: tl('action.timelapse'),
		draggable: true,
		form: {
			interval: 	 {label: 'dialog.timelapse.interval', type: 'number', value: 10, step: 0.25},
			source: 	 {label: 'dialog.timelapse.source', type: 'select', value: 'preview', options: {
				preview: 'data.preview',
				locked: 'dialog.timelapse.source.locked',
				interface: 'dialog.timelapse.source.interface',
			}, condition: isApp},
			destination: {label: 'dialog.timelapse.destination', type: 'folder', value: '', resource_id: 'timelapse'},
		},
		onConfirm: function(formData) {
			Screencam.recordTimelapse(formData);
			this.hide();
		}
	})
	new Action('timelapse', {
		icon: 'timelapse',
		category: 'view',
		condition: isApp && (() => !!Project),
		click() {
			if (!Prop.recording) {
				Screencam.timelapse_dialog.show();
			} else {
				Screencam.stopTimelapse();
			}
		}
	})
	new Action('screenshot_app', {
		icon: 'icon-bb_interface',
		category: 'view',
		condition: isApp,
		click() {Screencam.fullScreen()}
	})
})
