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
			let frametime = 1000/settings.texture_fps.value;
			if (Format.texture_mcmeta && Texture.getDefault()) {
				let tex = Texture.getDefault();
				frametime = Math.max(tex.frame_time, 1) * 50;
			}

			function splitIntoFrames(stride = texture.display_height) {
				let frames = [];
				let gauge = texture.width;
				for (let i = 0; i < texture.frameCount; i++) {
					let canvas = document.createElement('canvas');
					let ctx = canvas.getContext('2d');
					canvas.width = texture.width;
					canvas.height = stride;
					ctx.drawImage(texture.canvas, 0, -stride * i);
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
			/**
			 * 
			
			Frame context menu
			buttons below frame list
				duplicate frame
				add frame
				add frames
				remove frame
			keybindings in dialog
				prev/next
				delete
				duplicate?
			reframe
			save

			 */

			TextureAnimator.editor_dialog = new Dialog('animated_texture_editor', {
				title: 'action.animated_texture_editor',
				width: 1000,
				buttons: ['Apply', 'dialog.cancel'],
				component: {
					data() {return {
						frames: splitIntoFrames(),
						frame_index: 0,
						playing: false,
						stride: texture.display_height,
						fps: 1000 / frametime,
						interval: null
					}},
					methods: {
						togglePlay() {
							if (!this.playing) {
								this.playing = true;
								let frametime = Math.clamp(1000 / this.fps, 2, 1000);
								this.interval = setInterval(() => {
									this.frame_index++;
									if (this.frame_index == this.frames.length) {
										this.frame_index = 0;
									}
									if (Dialog.open != TextureAnimator.editor_dialog) {
										this.togglePlay();
									}
								}, frametime)
							} else {
								this.playing = false;
								clearInterval(this.interval);
							}
						},
						updateFPS() {
							if (this.playing) {
								this.togglePlay();
								this.togglePlay();
							}
						},
						setFrame(i) {
							if (this.playing) this.togglePlay();
							this.frame_index = i;
						},
						jumpFrames(number) {
							if (this.playing) this.togglePlay();
							this.frame_index = Math.clamp(this.frame_index + number, 0, this.frames.length-1);
						},
						reframe() {
							let new_frames = splitIntoFrames();
							this.frames.replace(new_frames);
						},
						sort(event) {
							var item = this.frames.splice(event.oldIndex, 1)[0];
							this.frames.splice(event.newIndex, 0, item);
						}
					},
					mounted() {
						this.togglePlay();
					},
					template: `
						<div id="flipbook_editor">
							<div class="flipbook_frame_timeline">

								<button @click="reframe()">Reframe</button>
								<ul>
									<li v-for="(frame, i) in frames" :key="frame.uuid"
										:title="i"
										v-sortable="{onUpdate: sort, animation: 160, handle: '.frame_drag_handle'}"
										class="flipbook_frame" :class="{viewing: frame_index == i}"
										@click="frame_index = i"
										@dblclick="setFrame(i)"
									>
										<label>{{ i }}</label>
										<img class="checkerboard" :src="frame.data_url" width="120">
									</li>
								</ul>
								<div>
									<div class="tool" @click="">
										<i class="material-icons">Plus</i>
									</div>
								</div>
							</div>
							<div class="flipbook_frame_preview">
								<div>
									<img class="checkerboard" v-if="frames[frame_index]" :src="frames[frame_index].data_url" :width="256">
								</div>
								<div class="flipbook_controls">
									<div class="tool" @click="jumpFrames(-1)">
										<i class="material-icons">navigate_before</i>
									</div>
									<div class="tool" @click="togglePlay()">
										<i class="material-icons">{{ playing ? 'pause' : 'play_arrow' }}</i>
									</div>
									<div class="tool" @click="jumpFrames(1)">
										<i class="material-icons">navigate_next</i>
									</div>
								</div>
								<div class="flipbook_controls">
									<label>${'FPS'}</label>
									<numeric-input v-model.number="fps" min="1" step="1" @input="updateFPS()" />
								</div>
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
