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
				let frame_count = Math.ceil(texture.height / stride);
				for (let i = 0; i < frame_count; i++) {
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
			 * Other ideas:
			 * 	frame context menu
			 */

			TextureAnimator.editor_dialog = new Dialog('animated_texture_editor', {
				title: 'action.animated_texture_editor',
				width: 1000,
				buttons: ['dialog.animated_texture_editor.apply', 'dialog.cancel'],
				keyboard_actions: {
					previous_frame: {
						keybind: new Keybind({key: 37}),
						run() {
							this.content_vue.jumpFrames(-1);
						}
					},
					next_frame: {
						keybind: new Keybind({key: 39}),
						run() {
							this.content_vue.jumpFrames(1);
						}
					},
					play: {
						keybind: new Keybind({key: 32}),
						run() {
							this.content_vue.togglePlay();
						}
					},
					duplicate: {
						keybind: new Keybind({key: 'd', ctrl: true}),
						run() {
							this.content_vue.duplicateFrame();
						}
					},
					delete: {
						keybind: new Keybind({key: 46}),
						run() {
							this.content_vue.deleteFrame();
						}
					},
					copy: {
						keybind: new Keybind({key: 'c', ctrl: true}),
						run() {
							this.content_vue.copy();
						}
					},
					paste: {
						keybind: new Keybind({key: 'v', ctrl: true}),
						run() {
							this.content_vue.paste();
						}
					}
				},
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
						async reframe() {
							let content_vue = this;
							let last_data = {
								stride: this.stride,
								frames: Math.roundTo(texture.height / this.stride, 4)
							};
							new Dialog('flipbook_editor_reframe', {
								title: 'dialog.animated_texture_editor.reframe',
								form: {
									stride: {label: 'dialog.animated_texture_editor.stride', type: 'number', value: last_data.stride},
									frames: {label: 'dialog.animated_texture_editor.frames', type: 'number', value: last_data.frames}
								},
								onFormChange(data) {
									if (last_data.stride != data.stride) {
										this.setFormValues({frames: Math.roundTo(texture.height / data.stride, 4)}, false);

									} else if (last_data.frames != data.frames) {
										this.setFormValues({stride: Math.roundTo(texture.height / data.frames, 4)}, false);
									}
								},
								onConfirm(data) {
									content_vue.stride = Math.clamp(Math.round(data.stride), 1, texture.height);
									let new_frames = splitIntoFrames(content_vue.stride);
									content_vue.frames.replace(new_frames);
								}
							}).show();
						},
						duplicateFrame() {
							let frame = this.frames[this.frame_index];
							if (!frame) return;
							let copy = Object.assign({}, frame);
							copy.uuid = guid();
							this.frames.splice(this.frame_index+1, 0, copy);
							this.frame_index++;
						},
						deleteFrame() {
							let frame = this.frames[this.frame_index];
							if (!frame) return;
							this.frames.remove(frame);
						},
						createFrame() {
							let canvas_frame = new CanvasFrame(texture.width, this.stride);
							let frame = {
								uuid: guid(),
								canvas: canvas_frame.canvas,
								data_url: canvas_frame.canvas.toDataURL(),
							};
							this.frame_index++;
							this.frames.splice(this.frame_index, 0, frame);
						},
						copy() {
							let selected_frame = this.frames[this.frame_index];
							if (!selected_frame) return;
							Clipbench.image = {
								x: 0, y: 0,
								data: selected_frame.data_url,
							}
					
							if (isApp) {
								let img = nativeImage.createFromDataURL(Clipbench.image.data);
								clipboard.writeImage(img);
							} else {
								selected_frame.canvas.toBlob(blob => {
									navigator.clipboard.write([
										new ClipboardItem({[blob.type]: blob}),
									]);
								});
							}
						},
						paste() {
							let addFrame = (data_url) => {
								let canvas_frame = new CanvasFrame(texture.width, this.stride);
								canvas_frame.loadFromURL(data_url);
								let frame = {
									uuid: guid(),
									canvas: canvas_frame.canvas,
									data_url,
								};
								this.frame_index++;
								this.frames.splice(this.frame_index, 0, frame);
							}
						
							if (isApp) {
								var image = clipboard.readImage().toDataURL();
								addFrame(image);
							} else {
								navigator.clipboard.read().then(content => {
									if (content && content[0] && content[0].types.includes('image/png')) {
										content[0].getType('image/png').then(blob => {
											let url = URL.createObjectURL(blob);
											addFrame(url);
										})
									}
								}).catch(() => {})
							}
						},
						sort(event) {
							let selected = this.frames[this.frame_index];
							var item = this.frames.splice(event.oldIndex, 1)[0];
							this.frames.splice(event.newIndex, 0, item);
							this.frame_index = this.frames.findIndex(frame => frame == selected);
						},
						slideTimelinePointer(e1) {
							let scope = this;
							if (!this.$refs.timeline) return;
		
							let timeline_offset = $(this.$refs.timeline).offset().left + 8;
							let timeline_width = this.$refs.timeline.clientWidth - 8;
							let maxFrameCount = this.frames.length;
		
							function slide(e2) {
								convertTouchEvent(e2);
								let pos = e2.clientX - timeline_offset;
		
								scope.frame_index = Math.clamp(Math.round((pos / timeline_width) * maxFrameCount), 0, maxFrameCount-1);
							}
							function off(e3) {
								removeEventListeners(document, 'mousemove touchmove', slide);
								removeEventListeners(document, 'mouseup touchend', off);
							}
							addEventListeners(document, 'mousemove touchmove', slide);
							addEventListeners(document, 'mouseup touchend', off);
							slide(e1);
						},
						getPlayheadPos() {
							if (!this.$refs.timeline) return 0;
							let width = this.$refs.timeline.clientWidth - 2;
							return Math.clamp((this.frame_index / this.frames.length) * width, 0, width);
						}
					},
					mounted() {
					},
					template: `
						<div id="flipbook_editor">
							<div class="flipbook_frame_timeline">

								<button @click="reframe()">${tl('dialog.animated_texture_editor.reframe')}</button>
								<ul v-sortable="{onUpdate: sort, animation: 160}">
									<li v-for="(frame, i) in frames" :key="frame.uuid"
										:title="i"
										class="flipbook_frame" :class="{viewing: frame_index == i}"
										@click="frame_index = i"
										@dblclick="setFrame(i)"
									>
										<label>{{ i }}</label>
										<img class="checkerboard" :src="frame.data_url" width="120">
									</li>
								</ul>
								<div>
									<div class="tool" @click="duplicateFrame()" title="${tl('generic.duplicate')}">
										<i class="material-icons">content_copy</i>
									</div>
									<div class="tool" @click="deleteFrame()" title="${tl('generic.delete')}">
										<i class="material-icons">delete</i>
									</div>
									<div class="tool" @click="createFrame()" title="${tl('dialog.animated_texture_editor.add_frame')}">
										<i class="material-icons">library_add</i>
									</div>
								</div>
							</div>
							<div class="flipbook_frame_preview">
								<div>
									<img class="checkerboard" v-if="frames[frame_index]" :src="frames[frame_index].data_url" :width="256">
								</div>
								<div id="flipbook_editor_timeline" ref="timeline" @mousedown="slideTimelinePointer">
									<div class="frame" v-for="i in frames.length"></div>
									<div id="flipbook_editor_playhead" :style="{left: getPlayheadPos() + 'px'}"></div>
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
				onConfirm: async function() {
					let {frames, stride} = this.content_vue;
					texture.canvas.height = stride * frames.length;

					Undo.initEdit({textures: [texture], bitmap: true});
					
					if (texture.layers_enabled) {
						texture.layers_enabled = false;
						texture.selected_layer = null;
						texture.layers.empty();
						UVEditor.vue.layer = null;
					}
					
					let i = 0;
					for (let frame of frames) {
						texture.ctx.drawImage(frame.canvas, 0, i * stride);
						i++;
					}

					texture.updateChangesAfterEdit();
					Undo.finishEdit('Disable layers on texture');
					updateInterfacePanels();
					BARS.updateConditions();
				}
			}).show();
		}
	})
})
