
const Screencam = {
	recording_timelapse: false,
	gif_options_dialog: new Dialog({
		id: 'create_gif',
		title: tl('dialog.create_gif.title'),
		draggable: true,
		form: {
			length_mode: {label: 'dialog.create_gif.length_mode', type: 'select', default: 'seconds', options: {
				seconds: 'dialog.create_gif.length_mode.seconds',
				frames: 'dialog.create_gif.length_mode.frames',
				animation: 'dialog.create_gif.length_mode.animation',
				turntable: 'dialog.create_gif.length_mode.turntable',
			}},
			length: {label: 'dialog.create_gif.length', type: 'number', value: 10, min: 0, step: 0.25, condition: (form) => ['seconds', 'frames'].includes(form.length_mode)},
			fps: 	{label: 'dialog.create_gif.fps', type: 'number', value: 20, min: 1, max: 120},
			quality:{label: 'dialog.create_gif.compression', type: 'number', value: 20, min: 1, max: 80},
			color:  {label: 'dialog.create_gif.color', type: 'color', value: '#00000000'},
			turn:	{label: 'dialog.create_gif.turn', type: 'number', value: 0, min: -10, max: 10},
			play: 	{label: 'dialog.create_gif.play', type: 'checkbox', condition: () => Animator.open},
		},
		onConfirm: function(formData) {
			let background = formData.color.toHex8String() != '#00000000' ? formData.color.toHexString() : undefined;
			this.hide();
			if (document.getElementById('gif_recording_frame')) {
				document.getElementById('gif_recording_frame').remove();
			}
			Screencam.createGif({
				length_mode: formData.length_mode,
				length: limitNumber(formData.length, 0.1, 24000),
				fps: limitNumber(formData.fps, 0.5, 30),
				quality: limitNumber(formData.quality, 0, 30),
				background,
				play: formData.play,
				turnspeed: formData.turn,
			})
		}
	}),
	screenshotPreview(preview, options, cb) {
		if (!options) options = 0;

		Canvas.withoutGizmos(function() {

			preview.render()

			if (options.crop == false && !options.width && !options.height) {
				var dataUrl = preview.canvas.toDataURL()
				Screencam.returnScreenshot(dataUrl, cb)
				return;
			}
			
			if (options.crop !== false && !(display_mode && display_slot === 'gui')) {
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
				return;
			}

			var dataUrl = preview.canvas.toDataURL()
			dataUrl = dataUrl.replace('data:image/png;base64,','')
			Jimp.read(Buffer.from(dataUrl, 'base64')).then(function(image) { 
				
				if (display_mode && display_slot === 'gui' && options.crop !== false) {
					var zoom = display_preview.camOrtho.zoom * devicePixelRatio
					var resolution = 256 * zoom;

					var start_x = display_preview.width *devicePixelRatio/2 - display_preview.controls.target.x*zoom*40 - resolution/2;
					var start_y = display_preview.height*devicePixelRatio/2 + display_preview.controls.target.y*zoom*40 - resolution/2;
					
					image.crop(start_x, start_y, resolution, resolution)
				} else {
					if (options.crop !== false) {
						image.autocrop([0, false])
					}
					if (options && options.width && options.height) {
						image.contain(options.width, options.height)
					}
				}

				image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
					Screencam.returnScreenshot(dataUrl, cb)
				})
			});
		})
	},
	fullScreen(options, cb) {
		setTimeout(function() {
			currentwindow.capturePage().then(function(screenshot) {
				var dataUrl = screenshot.toDataURL()

				if (!(options && options.width && options.height)) {
					Screencam.returnScreenshot(dataUrl, cb)
					return;
				}

				dataUrl = dataUrl.replace('data:image/png;base64,','')
				Jimp.read(Buffer.from(dataUrl, 'base64')).then(function(image) { 

					image.contain(options.width, options.height)

					image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
						Screencam.returnScreenshot(dataUrl, cb)
					})
				});
			})
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
		var dataUrl = canvas.toDataURL();
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

		let center = document.createElement('center');
		center.innerHTML = `<div>${img.naturalWidth} x ${img.naturalHeight}px, ${is_gif ? 'GIF' : 'PNG'}</div>`;
		center.appendChild(img);

		let buttons = [tl('dialog.save'), tl('dialog.cancel')]
		if (!is_gif) {
			buttons.splice(0, 0, tl('message.screenshot.clipboard'))
		}
		let dialog = new Dialog({
			title: 'message.screenshot.title', 
			id: 'screenshot',
			width: img.naturalWidth + 50,
			lines: [
				center
			],
			buttons,
			onButton(result) {

				if (result === 0 && buttons.length == 3) {
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
				} else if (result === buttons.length-2) {
					Blockbench.export({
						resource_id: 'screenshot',
						extensions: [is_gif ? 'gif' : 'png'],
						type: tl('data.image'),
						savetype: is_gif ? 'binary' : 'image',
						name: Project ? Project.name.replace(/\.geo$/, '') : 'screenshot',
						content: is_gif ? (isApp ? Buffer(dataUrl.split(',')[1], 'base64') : blob) : dataUrl,
					})
				}
			}
		})
		dialog.show();
	},
	// deprecated
	cleanCanvas(options, cb) {
		quad_previews.current.screenshot(options, cb)
	},
	gif_crop: {top: 0, left: 0, right: 0, bottom: 0},

	async createGif(options = {}, cb) {
		if (!options.length_mode) options.length_mode = 'seconds';
		if (!options.length) options.length = 1;

		let preview = Preview.selected;
		let animation = Animation.selected;
		let interval = options.fps ? (1000/options.fps) : 100;
		let frames = 0;
		let gif;
		let frame, frame_label;
		let recording = false;
		let loop = null;
		let crop = Screencam.gif_crop;

		function getProgress() {
			switch (options.length_mode) {
				case 'seconds': return interval*frames/(options.length*1000); break;
				case 'frames': return frames/options.length; break;
				case 'turntable': return Math.abs(preview.controls.autoRotateProgress) / (2*Math.PI); break;
				case 'animation': return Timeline.time / (animation.length-(interval/1000)); break;
			}
		}
		function startRecording() {
			let canvas = document.createElement('canvas');
			let ctx = canvas.getContext('2d');
			canvas.width = Math.clamp((preview.width - crop.left - crop.right) * window.devicePixelRatio, 24, 4000);
			canvas.height = Math.clamp((preview.height - crop.top - crop.bottom) * window.devicePixelRatio, 24, 4000);

			gif = new GIF({
				repeat: options.repeat,
				quality: options.quality,
				background: options.background ? options.background : {r: 30, g: 0, b: 255},
				transparent: options.background ? undefined : 0x1e01ff,
				width: canvas.width,
				height: canvas.height 
			});
	
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
				gif.on('progress', Blockbench.setProgress);
			}

			recording = true;
			loop = setInterval(() => {
				frames++;
				Canvas.withoutGizmos(function() {
					let img = new Image();
					preview.render();
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.drawImage(preview.canvas, Math.round(-crop.left * window.devicePixelRatio), Math.round(-crop.top * window.devicePixelRatio));
					img.src = canvas.toDataURL();
					img.onload = () => {
						gif.addFrame(img, {delay: interval});
					}
				})
				Blockbench.setProgress(getProgress());
				frame_label.textContent = frames + ' - ' + (interval*frames/1000).toFixed(2) + 's';

				if (getProgress() >= 1) {
					endRecording(true);
					return;
				}
	
			}, interval)
			gif.on('finished', blob => {
				delete Screencam.processing_gif;
				var reader = new FileReader();
				reader.onload = () => {
					if (!options.silent) {
						Blockbench.setProgress();
						Blockbench.setStatusBarText();
					}
					Screencam.returnScreenshot(reader.result, cb, blob);
				}
				reader.readAsDataURL(blob);
			});

			frame.classList.add('recording');
		}
		function endRecording(render) {
			if (!recording) return;
			recording = false;
			clearInterval(loop);
			if (frame) {
				frame.remove();
			}
			Blockbench.setProgress();
			if (render) {
				gif.render();
				if (!options.silent) {
					Blockbench.setStatusBarText(tl('status_bar.processing_gif'))
					Screencam.processing_gif = gif;
				}
			}
			if (Animator.open && Timeline.playing) {
				Timeline.pause();
			}
			if (options.turnspeed) {
				preview.controls.autoRotate = false;
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
			var view_pos = new THREE.Vector3().copy(quad_previews.current.camera.position);
			var view_tar = new THREE.Vector3().copy(quad_previews.current.controls.target);
		}
		Screencam.timelapse_loop = setInterval(function() {
			index++;

			if (!isApp || options.source === 'preview' || options.source === 'locked') {
				var scope = quad_previews.current;
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
