
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
			length: {label: 'dialog.create_gif.length', type: 'number', value: 10, step: 0.25, condition: (form) => ['seconds', 'frames'].includes(form.length_mode)},
			fps: 	{label: 'dialog.create_gif.fps', type: 'number', value: 20},
			quality:{label: 'dialog.create_gif.compression', type: 'number', value: 20, min: 1, max: 80},
			color:  {label: 'dialog.create_gif.color', type: 'color', value: '#00000000'},
			turn:	{label: 'dialog.create_gif.turn', type: 'number', value: 0, min: -10, max: 10},
			play: 	{label: 'dialog.create_gif.play', type: 'checkbox', condition: () => Animator.open},
		},
		onConfirm: function(formData) {
			let background = formData.color.toHex8String() != '#00000000' ? formData.color.toHexString() : undefined;
			Screencam.createGif({
				length_mode: formData.length_mode,
				length: limitNumber(formData.length, 0.1, 24000),
				fps: limitNumber(formData.fps, 0.5, 30),
				quality: limitNumber(formData.quality, 0, 30),
				background,
				play: formData.play,
				turnspeed: formData.turn,
			}, Screencam.returnScreenshot)
			this.hide();
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
			
			if (options.crop !== false && !(display_mode && display_slot === 'gui') && !options.width && !options.height) {
				let frame = new CanvasFrame(preview.canvas);
				frame.autoCrop()
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
	async returnScreenshot(dataUrl, cb) {

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
						name: Project.name.replace(/\.geo$/, ''),
						content: is_gif ? Buffer(dataUrl.split(',')[1], 'base64') : dataUrl,
					})
				}
			}
		})
		dialog.show();
	},
	cleanCanvas(options, cb) {
		quad_previews.current.screenshot(options, cb)
	},
	createGif(options, cb) {
		if (typeof options !== 'object') options = {}
		if (!options.length_mode) options.length_mode = 'seconds';
		if (!options.length) options.length = 1;

		var preview = quad_previews.current;
		var animation = Animation.selected;
		var interval = options.fps ? (1000/options.fps) : 100;
		var frames = 0;
		const gif = new GIF({
			repeat: options.repeat,
			quality: options.quality,
			background: options.background ? options.background : {r: 30, g: 0, b: 255},
			transparent: options.background ? undefined : 0x1e01ff,
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

		function getProgress() {
			switch (options.length_mode) {
				case 'seconds': return interval*frames/(options.length*1000); break;
				case 'frames': return frames/options.length; break;
				case 'turntable': return Math.abs(preview.controls.autoRotateProgress) / (2*Math.PI); break;
				case 'animation': return Timeline.time / (animation.length-(interval/1000)); break;
			}
		}

		let recording = true;
		var loop = setInterval(() => {
			frames++;
			Canvas.withoutGizmos(function() {
				var img = new Image();
				preview.render();
				img.src = preview.canvas.toDataURL();
				img.onload = () => {
					gif.addFrame(img, {delay: interval});
				}
			})
			Blockbench.setProgress(getProgress());
			if (getProgress() >= 1) {
				endRecording(true)
				return;
			}

		}, interval)

		function endRecording(render) {
			recording = false;
			clearInterval(loop)
			if (render) {
				gif.render();
				if (!options.silent) {
					Blockbench.setStatusBarText(tl('status_bar.processing_gif'))
				}
			}
			if (Animator.open && Timeline.playing) {
				Timeline.pause();
			}
			if (options.turnspeed) {
				preview.controls.autoRotate = false;
			}
		}

		let toast = Blockbench.showToastNotification({
			text: 'message.recording_gif',
			icon: 'local_movies',
			click() {
				if (recording) {
					endRecording(false);
				} else {
					gif.abort();
				}
				Blockbench.setStatusBarText();
				Blockbench.setProgress(0);
				return true;
			}
		})

		gif.on('finished', blob => {
			var reader = new FileReader();
			reader.onload = () => {
				if (!options.silent) {
					Blockbench.setProgress();
					Blockbench.setStatusBarText();
				}
				Screencam.returnScreenshot(reader.result, cb);
			}
			reader.readAsDataURL(blob);
			toast.delete();
		});

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
			console.trace(image)
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
		icon: 'fa-cubes',
		category: 'view',
		keybind: new Keybind({key: 'p', ctrl: true}),
		click: function () {Preview.selected.screenshot()}
	})
	new Action('record_model_gif', {
		icon: 'local_movies',
		category: 'view',
		click: function () {
			Screencam.gif_options_dialog.show();
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
		condition: isApp,
		click: function () {
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
		click: function () {Screencam.fullScreen()}
	})
})
