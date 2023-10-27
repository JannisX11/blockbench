
const Screencam = {
	NoAAPreview: null,
	recording_timelapse: false,
	gif_options_dialog: new Dialog({
		id: 'create_gif',
		title: tl('dialog.create_gif.title'),
		draggable: true,
		form: {
			format: {label: 'dialog.create_gif.format', type: 'select', options: {
				gif: 'dialog.create_gif.format.gif',
				apng: 'APNG',
				png_sequence: 'dialog.create_gif.format.png_sequence',
			}},
			'_1': '_',
			length_mode: {label: 'dialog.create_gif.length_mode', type: 'select', default: 'seconds', options: {
				seconds: 'dialog.create_gif.length_mode.seconds',
				frames: 'dialog.create_gif.length_mode.frames',
				animation: 'dialog.create_gif.length_mode.animation',
				turntable: 'dialog.create_gif.length_mode.turntable',
			}},
			length: 	{label: 'dialog.create_gif.length', type: 'number', value: 5, min: 0.1, step: 0.25, condition: (form) => ['seconds', 'frames'].includes(form.length_mode)},
			fps: 		{label: 'dialog.create_gif.fps', type: 'number', value: 20, min: 0.5, max: 120},
			'_2': '_',
			pixelate:	{label: 'dialog.create_gif.pixelate', type: 'range', value: 1, min: 1, max: 8, step: 1},
			color:  	{label: 'dialog.create_gif.color', type: 'color', value: '#00000000'},
			bg_image:  	{label: 'dialog.create_gif.bg_image', type: 'file', extensions: ['png'], readtype: 'image', filetype: 'PNG'},
			turn:		{label: 'dialog.create_gif.turn', type: 'number', value: 0, min: -90, max: 90, description: 'dialog.create_gif.turn.desc'},
			play: 		{label: 'dialog.create_gif.play', type: 'checkbox', condition: () => Animator.open},
		},
		onConfirm(formData) {
			let background = formData.color.toHex8String() != '#00000000' ? formData.color.toHexString() : undefined;
			this.hide();
			if (document.getElementById('gif_recording_frame')) {
				document.getElementById('gif_recording_frame').remove();
			}
			Screencam.createGif({
				format: formData.format,
				length_mode: formData.length_mode,
				length: formData.length,
				fps: formData.fps,
				quality: formData.quality,
				pixelate: formData.pixelate,
				background,
				background_image: formData.bg_image,
				play: formData.play,
				turnspeed: formData.turn,
			})
		}
	}),
	advanced_screenshot_dialog: new Dialog({
		id: 'advanced_screenshot',
		title: 'action.advanced_screenshot',
		form: {
			/*angle_preset: 	{type: 'select', label: 'dialog.advanced_screenshot.angle_preset', value: 'view', options: {
				view: 'View',
			}},*/
			resolution: 	{type: 'vector', label: 'dialog.advanced_screenshot.resolution', dimensions: 2, value: [1920, 1080]},
			//zoom_to_fit: 	{type: 'checkbox', label: 'dialog.advanced_screenshot.zoom_to_fit', value: false},
			zoom: 			{type: 'number', label: 'dialog.advanced_screenshot.zoom', value: 40, condition: form => !form.zoom_to_fit},
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

				if (display_mode && display_slot === 'gui') {
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
			render_viewport.copyView(preview);
			if (!render_viewport.isOrtho) {
				render_viewport.camera.setFocalLength(options.zoom);
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

		let preview = Preview.selected;
		let animation = Animation.selected;
		let interval = options.fps ? (1000/options.fps) : 100;
		let frames = 0;
		let gif;
		let apng_encoder;
		let frame_canvases = [];
		let frame, frame_label;
		let recording = false;
		let loop = null;
		let crop = Screencam.gif_crop;
		let background_image;
		if (options.background_image) {
			background_image = new Image();
			background_image.src = options.background_image
			background_image.onerror = () => {
				background_image = null;
			}
		}
		if (options.format == 'gif' || options.format == 'apng') {
			interval = Math.max(Math.round(interval/10) * 10, 20);
		}

		function getProgress() {
			switch (options.length_mode) {
				case 'seconds': return interval*frames/(options.length*1000); break;
				case 'frames': return frames/options.length; break;
				case 'turntable': return Math.abs(preview.controls.autoRotateProgress) / (2*Math.PI); break;
				case 'animation': return Timeline.time / (animation.length-(interval/1000)); break;
			}
		}
		function startRecording() {
			let canvas_width = Math.clamp((preview.width - crop.left - crop.right) * window.devicePixelRatio, 24, 4000);
			let canvas_height = Math.clamp((preview.height - crop.top - crop.bottom) * window.devicePixelRatio, 24, 4000);

			function createEmptyCanvas() {
				canvas = document.createElement('canvas');
				let ctx = canvas.getContext('2d');
				canvas.width = canvas_width;
				canvas.height = canvas_height;
				ctx.imageSmoothingEnabled = false;
				return [canvas, ctx];
			}

			if (options.format == 'gif') {
				gif = GIFEnc.GIFEncoder();

			} else if (options.format == 'apng') {
				let [canvas] = createEmptyCanvas();
				apng_encoder = new APNGencoder(canvas);
				
				apng_encoder.setRepeat(0);
				apng_encoder.setDelay(Math.round(interval / 10));    // 1/100 sec
				apng_encoder.setDispose((background_image || options.background) ? 0 : 1);
				apng_encoder.setBlend(1);
			  
				apng_encoder.start();
			}
	
			if (options.turnspeed) {
				preview.controls.autoRotate = true;
				preview.controls.autoRotateSpeed = options.turnspeed;
				preview.controls.autoRotateProgress = 0;
			} else if (options.length_mode == 'turntable') {
				options.length_mode = 'seconds'
			}
	
			if (options.play && animation) {
				Timeline.time = 0;
				Timeline.start()
				if (!animation.length) options.length_mode = 'seconds';
			} else if (options.length_mode == 'animation') {
				options.length_mode = 'seconds'
			}
	
			if (!options.silent) {
				Blockbench.setStatusBarText(tl('status_bar.recording_gif'));
			}

			// Use renderer without anti aliasing to avoid texture bleeding and color flickering
			let NoAAPreview = Screencam.NoAAPreview;
			NoAAPreview.resize(
				preview.width * window.devicePixelRatio / options.pixelate,
				preview.height * window.devicePixelRatio / options.pixelate
			);
			NoAAPreview.setProjectionMode(preview.isOrtho);

			recording = true;
			loop = setInterval(() => {
				frames++;
				Canvas.withoutGizmos(function() {
					// Update camera
					NoAAPreview.controls.unlinked = preview.controls.unlinked;
					NoAAPreview.controls.target.copy(preview.controls.target);
					NoAAPreview.camera.position.copy(preview.camera.position);
					NoAAPreview.camera.quaternion.copy(preview.camera.quaternion);
					if (NoAAPreview.isOrtho) {
						NoAAPreview.camera.zoom = preview.camera.zoom;
						NoAAPreview.camera.top = preview.camera.top;
						NoAAPreview.camera.bottom = preview.camera.bottom;
						NoAAPreview.camera.right = preview.camera.right;
						NoAAPreview.camera.left = preview.camera.left;
						NoAAPreview.camOrtho.updateProjectionMatrix();
					} else {
						NoAAPreview.setFOV(preview.camPers.fov);
					}

					let [canvas, ctx] = createEmptyCanvas();

					NoAAPreview.render();
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					if (options.background) {
						ctx.fillStyle = options.background;
						ctx.fillRect(0, 0, canvas.width, canvas.height);
					}
					if (background_image) {
						ctx.drawImage(background_image, 0, 0, canvas_width, canvas_height);
					}
					ctx.drawImage(NoAAPreview.canvas,
						Math.round(-crop.left * window.devicePixelRatio),
						Math.round(-crop.top * window.devicePixelRatio),
						Math.round(NoAAPreview.width * options.pixelate),
						Math.round(NoAAPreview.height * options.pixelate)
					);
					if (options.format == 'png_sequence' || options.format == 'gif' || options.format == 'apng') {
						frame_canvases.push(canvas);
					}
					NoAAPreview.controls.unlinked = false;
				})
				Blockbench.setProgress(getProgress());
				frame_label.textContent = frames + ' - ' + (interval*frames/1000).toFixed(2) + 's';

				if (getProgress() >= 1) {
					endRecording(true);
					return;
				}
	
			}, interval)

			frame.classList.add('recording');
		}
		async function endRecording(render) {
			if (!recording) return;
			recording = false;
			clearInterval(loop);
			if (frame) {
				frame.remove();
			}
			Blockbench.setProgress();
			if (Animator.open && Timeline.playing) {
				Timeline.pause();
			}
			if (options.turnspeed) {
				preview.controls.autoRotate = false;
			}

			// Render
			if (!render) return;
			if (!options.silent) {
				Blockbench.setStatusBarText(tl('status_bar.processing_gif'))
				Screencam.processing_gif = gif;
			}
			if (options.format == 'gif') {
				let i = 0;
				let format = 'rgba4444';
				function quantize(data) {
					let palette = [[0, 0, 0]];
					for (let i = 0; i < data.length; i += 4) {
						if (data[i+3] < 127) {
							continue;
						}
						let r = data[i];
						let g = data[i+1];
						let b = data[i+2];
						let match = palette.findIndex((color, i) => color[0] == r && color[1] == g && color[2] == b && i != 0);
						if (match == -1) {
							palette.push([r, g, b])
						}
						if (palette.length > 256) break;
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
						let match = palette.findIndex((color, i) => color[0] == r && color[1] == g && color[2] == b && i != 0);
						if (match == -1) {match = 0;}
						array[i] = match;
					}
					return array;
				}
				for (let canvas of frame_canvases) {
					let data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
					let palette = quantize(data, 256, {format, oneBitAlpha: true});
					let index;
					if (palette.length > 256) {
						// Built-in methods
						palette = GIFEnc.quantize(data, 256, {format, oneBitAlpha: true});
						index = GIFEnc.applyPalette(data, palette, format);
					} else {
						// Direct flicker-free color mapping
						index = applyPalette(data, palette, format);
					}
					gif.writeFrame(index, canvas.width, canvas.height, {palette, delay: interval, transparent: true});
					i++;
					Blockbench.setProgress(i / frame_canvases.length);
					await new Promise(resolve => setTimeout(resolve, 0));
				}

				gif.finish();

				let buffer = gif.bytesView();
				let blob = new Blob([buffer], {type: 'image/gif'});
				var reader = new FileReader();
				reader.onload = () => {
					Blockbench.setProgress();
					Blockbench.setStatusBarText();
					delete Screencam.processing_gif;
					Screencam.returnScreenshot(reader.result, cb, blob);
				}
				reader.readAsDataURL(blob);

			} else if (options.format == 'apng') {

				let i = 0;
				for (let canvas of frame_canvases) {
					apng_encoder.addFrame(canvas);
					i++;
					Blockbench.setProgress(i / frame_canvases.length);
					await new Promise(resolve => setTimeout(resolve, 0));
				}

				apng_encoder.finish();
				Blockbench.setProgress();

				var base64Out = bytesToBase64(apng_encoder.stream().bin);
				let dataUrl = "data:image/png;base64," + base64Out;
				Screencam.returnScreenshot(dataUrl, cb);

			} else if (options.format == 'png_sequence') {
				// Export PNGs as ZIP
				let archive = new JSZip();
				let digits = frame_canvases.length.toString().length;
				let i = 0;
				for (let canvas of frame_canvases) {
					let data_url = canvas.toDataURL();
					archive.file(i.toDigitString(digits) + '.png', data_url.replace('data:image/png;base64,', ''), {base64: true});
					i++;
					Blockbench.setProgress(i / frame_canvases.length);
					await new Promise(resolve => setTimeout(resolve, 0));
				}
				archive.generateAsync({type: 'blob'}).then(content => {
					Blockbench.export({
						type: 'Zip Archive',
						extensions: ['zip'],
						name: 'png_sequence',
						content: content,
						savetype: 'zip'
					})
					Blockbench.setProgress();
				})
			}
		}
		function cancel() {
			frame.remove();
		}
		function updateCrop() {
			crop.left = 	Math.clamp(crop.left, 	0, preview.width/2  - 20);
			crop.right = 	Math.clamp(crop.right, 	0, preview.width/2  - 20);
			crop.top = 		Math.clamp(crop.top, 	0, preview.height/2 - 20);
			crop.bottom = 	Math.clamp(crop.bottom, 0, preview.height/2 - 20);
			frame.style.top = crop.top + 'px';
			frame.style.left = crop.left + 'px';
			frame.style.right = crop.right + 'px';
			frame.style.bottom = crop.bottom + 'px';
			frame_label.textContent = Math.round(Math.clamp((preview.width - crop.left - crop.right) * window.devicePixelRatio, 24, 4000))
							+ ' x ' + Math.round(Math.clamp((preview.height - crop.top - crop.bottom) * window.devicePixelRatio, 24, 4000))
		}

		// Setup recording UI
		frame = Interface.createElement('div', {id: 'gif_recording_frame'});
		preview.node.append(frame);

		frame_label = Interface.createElement('div', {id: 'gif_recording_frame_label'});
		frame.append(frame_label);

		function drag(e1) {
			let crop_original = Object.assign({}, crop);
			function move(e2) {
				convertTouchEvent(e2);
				crop.left	= crop_original.left	+ (e2.clientX - e1.clientX);
				crop.right	= crop_original.right	- (e2.clientX - e1.clientX);
				crop.top	= crop_original.top		+ (e2.clientY - e1.clientY);
				crop.bottom	= crop_original.bottom	- (e2.clientY - e1.clientY);
				updateCrop();
			}
			function stop(e3) {
				removeEventListeners(document, 'mousemove touchmove', move);
				removeEventListeners(document, 'mouseup touchend', stop);
			}
			addEventListeners(document, 'mousemove touchmove', move);
			addEventListeners(document, 'mouseup touchend', stop);
		}
		addEventListeners(frame_label, 	'mousedown touchstart', e => drag(e, 'right', 'top'));

		let resizer_top_right = 	Interface.createElement('div', {style: 'top: -2px; right: -2px;', 	class: 'gif_recording_frame_handle gif_resize_ne'}, Blockbench.getIconNode('arrow_back_ios'));
		let resizer_top_left = 		Interface.createElement('div', {style: 'top: -2px; left: -2px;', 	class: 'gif_recording_frame_handle gif_resize_nw'}, Blockbench.getIconNode('arrow_back_ios'));
		let resizer_bottom_right = 	Interface.createElement('div', {style: 'bottom: -2px; right: -2px;',class: 'gif_recording_frame_handle gif_resize_se'}, Blockbench.getIconNode('arrow_back_ios'));
		let resizer_bottom_left = 	Interface.createElement('div', {style: 'bottom: -2px; left: -2px;', class: 'gif_recording_frame_handle gif_resize_sw'}, Blockbench.getIconNode('arrow_back_ios'));

		function resize(e1, x_value, y_value) {
			let crop_original = Object.assign({}, crop);
			function move(e2) {
				convertTouchEvent(e2);
				crop[x_value] = crop_original[x_value] + (e2.clientX - e1.clientX) * (x_value == 'left' ? 1 : -1);
				crop[y_value] = crop_original[y_value] + (e2.clientY - e1.clientY) * (y_value == 'top'  ? 1 : -1);
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
		frame.append(resizer_top_right);
		frame.append(resizer_top_left);
		frame.append(resizer_bottom_right);
		frame.append(resizer_bottom_left);
		updateCrop();

		let controls = Interface.createElement('div', {id: 'gif_recording_controls'});
		frame.append(controls);

		let record_button = Interface.createElement('div', {class: 'tool gif_record_button'}, Blockbench.getIconNode('fiber_manual_record', 'var(--color-close)'));
		record_button.addEventListener('click', event => {
			startRecording();
		});
		controls.append(record_button);

		let stop_button = Interface.createElement('div', {class: 'tool'}, Blockbench.getIconNode('stop'));
		stop_button.addEventListener('click', event => {
			recording ? endRecording(true) : cancel();
		})
		controls.append(stop_button);

		let cancel_button = Interface.createElement('div', {class: 'tool'}, Blockbench.getIconNode('clear'));
		cancel_button.addEventListener('click', event => {
			recording ? endRecording(false) : cancel();
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
