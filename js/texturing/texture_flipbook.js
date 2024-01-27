TextureAnimator = {
	isPlaying: false,
	interval: false,
	frame_total: 0,
	start() {
		clearInterval(TextureAnimator.interval)
		TextureAnimator.isPlaying = true
		TextureAnimator.frame_total = 0;
		TextureAnimator.updateButton()
		let frametime = 1000/settings.texture_fps.value;
		if (Format.texture_mcmeta && Texture.getDefault()) {
			let tex = Texture.getDefault();
			frametime = Math.max(tex.frame_time, 1) * 50;
		}
		TextureAnimator.interval = setInterval(TextureAnimator.nextFrame, frametime)
	},
	stop() {
		TextureAnimator.isPlaying = false
		clearInterval(TextureAnimator.interval)
		TextureAnimator.updateButton()
	},
	toggle() {
		if (TextureAnimator.isPlaying) {
			TextureAnimator.stop()
		} else {
			TextureAnimator.start()
		}
	},
	updateSpeed() {
		if (TextureAnimator.isPlaying) {
			TextureAnimator.stop()
			TextureAnimator.start()
		}
	},
	nextFrame() {
		var animated_textures = []
		TextureAnimator.frame_total++;
		Texture.all.forEach(tex => {
			if (tex.frameCount > 1) {
				let custom_indices = Format.texture_mcmeta && tex.getAnimationFrameIndices();
				if (custom_indices) {
					let index = custom_indices[TextureAnimator.frame_total % custom_indices.length];
					tex.currentFrame = Math.clamp(typeof index == 'object' ? index.index : index, 0, tex.frameCount-1);

				} else {
					if (tex.currentFrame >= tex.frameCount-1) {
						tex.currentFrame = 0
					} else {
						tex.currentFrame++;
					}
				}
				animated_textures.push(tex)
			}
		})
		TextureAnimator.update(animated_textures);
	},
	update(animated_textures) {
		let maxFrame = 0;
		animated_textures.forEach(tex => {
			maxFrame = Math.max(maxFrame, tex.currentFrame);
		})
		Outliner.elements.forEach(el => {
			if (!el.faces || !el.preview_controller.updateUV) return;
			let update = false
			for (let face in el.faces) {
				update = update || animated_textures.includes(el.faces[face].getTexture());
			}
			if (update) {
				el.preview_controller.updateUV(el, true);
			}
		})
		BarItems.animated_texture_frame.update();
		UVEditor.vue.updateTextureCanvas();
		UVEditor.updateSelectionOutline(true);
		Interface.Panels.textures.inside_vue._data.currentFrame = maxFrame;
	},
	reset() {
		TextureAnimator.stop();
		Texture.all.forEach(function(tex, i) {
			if (tex.frameCount) {
				tex.currentFrame = 0;
			} 
		})
		UVEditor.img.style.objectPosition = '';
		Outliner.elements.forEach(el => {
			if (!el.faces || !el.preview_controller.updateUV) return;
			el.preview_controller.updateUV(el);
		})
		UVEditor.updateSelectionOutline(true)
		UVEditor.vue.updateTextureCanvas();
	},
	updateButton() {
		BarItems.animated_textures.setIcon( TextureAnimator.isPlaying ? 'pause' : 'play_arrow' )
	},

	editor_dialog: null,
}



BARS.defineActions(function() {

	function textureAnimationCondition() {
		return Format.animated_textures && Texture.all.find(tex => tex.frameCount > 1);
	}
	new Action('animated_textures', {
		icon: 'play_arrow',
		category: 'textures',
		condition: textureAnimationCondition,
		click() {
			TextureAnimator.toggle()
		}
	})
	function getSliderTexture() {
		return [Texture.getDefault(), ...Texture.all].find(tex => tex && tex.frameCount > 1);
	}
	new NumSlider('animated_texture_frame', {
		category: 'textures',
		condition: textureAnimationCondition,
		getInterval(event) {
			return 1;
		},
		get: function() {
			let tex = getSliderTexture()
			return tex ? tex.currentFrame+1 : 0;
		},
		change: function(modify) {
			let slider_tex = getSliderTexture()
			if (!slider_tex) return;
			slider_tex.currentFrame = (modify(slider_tex.currentFrame + slider_tex.frameCount) % slider_tex.frameCount) || 0;

			let textures = Texture.all.filter(tex => tex.frameCount > 1);
			Texture.all.forEach(tex => {
				tex.currentFrame = (slider_tex.currentFrame % tex.frameCount) || 0;
			})
			TextureAnimator.update(textures);
		}
	})
	new Action('animated_texture_fps', {
		name: 'settings.texture_fps',
		description: 'settings.texture_fps.desc',
		icon: 'speed',
		category: 'textures',
		condition: textureAnimationCondition,
		click() {
			if (Format.texture_mcmeta && Texture.all.length) {
				Texture.getDefault().openMenu()
				$('dialog div.form_bar_frame_time input').trigger('focus');
			} else {
				settings.texture_fps.trigger();
			}
		}
	})


	new Action('animated_texture_editor', {
		icon: 'theaters',
		category: 'textures',
		condition: Format.animated_textures && Texture.selected,
		click() {
			let texture = Texture.selected;

			function splitIntoFrames(stride = texture.display_height) {
				let frames = [];
				let gauge = texture.width;
				for (let i = 0; i < texture.frameCount; i++) {
					let canvas = document.createElement('canvas');
					let ctx = copy_canvas.getContext('2d');
					canvas.width = texture.width;
					canvas.height = stride;
					ctx.drawImage(texture.img, 0, stride * i);
					let data_url = canvas.toDataURL();
					let frame = {
						uuid: guid(),
						initial_index: i,
						canvas, ctx,
						data_url,
					};
					frames.push(frame);
				}
				return frames;
			}

			TextureAnimator.editor_dialog = new Dialog('animated_texture_editor', {
				title: 'action.animated_texture_editor',
				buttons: ['Apply', 'dialog.cancel'],
				component: {
					data() {return {
						frames: splitIntoFrames(),
						frame_index: 0,
						stride: texture.display_height
					}},

					template: `
						<div>
							<div class="frame_timeline">

								<button>Reframe</button>
								<ul>
									<li v-for="frame in frames" :key="frame.uuid">

									</li>
								</ul>
								<div>
									<button>+</button>
									<button>++</button>
								</div>
							</div>
							<div class="frame_preview">
							</div>
						</div>
					`
				},
				onConfirm() {

				}
			}).show();
		}
	})
})
