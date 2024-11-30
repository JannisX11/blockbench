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
			UVEditor.previous_animation_frame = slider_tex.currentFrame;
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
			let gauge = texture.width;
			let copied;
			if (Format.texture_mcmeta && Texture.getDefault()) {
				let tex = Texture.getDefault();
				frametime = Math.max(tex.frame_time, 1) * 50;
			}

			function displayCodeSuggestion(texture, frame_count, fps) {
				let content, text, file_name, docs;
				if (Format.id == 'bedrock') {
					let model_id = Project.model_identifier || 'entity';
					docs = 'https://wiki.bedrock.dev/visuals/animated-entity-texture.html';
					file_name = `${model_id}.render_controllers.json`;
					content = {
						"format_version": "1.20.0",
						"render_controllers": {
							[`controller.render.${model_id}`]: {
								"geometry": "Geometry.default",
								"textures": ["Texture.default"],
								"materials": [
									{"*": "Material.default"}
								],
								"uv_anim": {
									"scale": [1, `1 / ${frame_count}`],
									"offset": [0, `Math.mod(Math.floor(query.life_time * ${fps}), ${frame_count}) / ${frame_count}`]
								}
							}
						}
					};
					text = compileJSON(content);
					let material_note = `Make sure to use a material with 'USE_UV_ANIM' enabled, such as 'conduit_wind'!`;
					text = text.replace('"Material.default"', '"Material.default"' + '	//' + material_note);

				} else if (Format.id == 'bedrock_block') {
					let file_path = texture.path.replace(/[\7\\]+/g, '/').replace(/(^|.*\/)textures\//, 'textures/').replace(/\.\w*$/, '');

					docs = 'https://wiki.bedrock.dev/blocks/flipbook-textures.html';
					file_name = 'flipbook_textures.json';
					content = [
						{ 
							"flipbook_texture": file_path,
							"atlas_tile": pathToName(texture.name, false),
							"ticks_per_frame": Math.round(20 / fps),
							"blend_frames": false
						}
					];
					text = compileJSON(content);

				} else if (Format.id == 'java_block') {
					docs = 'https://minecraft.wiki/w/Resource_pack#Animation';
					file_name = (texture.name.match(/\.png$/i) ? texture.name : texture.name + '.png') + '.mcmeta';
					content = texture.getMCMetaContent();
					text = compileJSON(content);
				}
				if (!content) return;

				new Dialog('animated_texture_editor_code', {
					title: 'dialog.animated_texture_editor.code_reference',
					resizable: 'x',
					width: 720,
					singleButton: true,
					part_order: ['form', 'component'],
					form: {
						about: {type: 'info', text: 'dialog.animated_texture_editor.code_reference.about'},
						docs: {type: 'info', label: 'dialog.animated_texture_editor.code_reference.docs', text: `[${docs.replace('https://', '').substring(0, 36)}...](${docs})`},
					},
					component: {
						components: {VuePrismEditor},
						data: {
							text: text,
							file_name: file_name
						},
						methods: {
							copyText() {
								Clipbench.setText(this.text);
							}
						},
						template: `
							<div>
								<p class="code_editor_file_title">{{ file_name }}</p>
								<vue-prism-editor v-model="text" language="json" style="height: 260px;" :line-numbers="true" />
								<button @click="copyText()" style="width: 100%;">${tl('action.copy')}</button>
							</div>
						`
					}
				}).show();
			}

			function splitIntoFrames(stride = texture.display_height, old_frames) {
				let frames = [];
				let frame_count = Math.ceil(texture.height / stride);
				let has_selected = false;
				for (let i = 0; i < frame_count; i++) {
					let canvas = document.createElement('canvas');
					let ctx = canvas.getContext('2d');
					canvas.width = gauge;
					canvas.height = stride;
					ctx.drawImage(texture.canvas, 0, -stride * i);
					let data_url = canvas.toDataURL();
					let frame = {
						uuid: guid(),
						initial_index: i,
						selected: false,
						canvas, ctx,
						data_url,
					};
					if (old_frames && old_frames[i]?.selected) {
						frame.selected = true;
						has_selected = true;
					}
					frames.push(frame);
				}
				if (!has_selected && frames[0]) {
					frames[0].selected = true;
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
						interval: null,
						code_available: ['bedrock', 'bedrock_block', 'java_block'].includes(Format.id)
					}},
					methods: {
						togglePlay() {
							if (!this.playing) {
								for (let frame of this.frames) {
									frame.selected = false;
								}
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
									let new_frames = splitIntoFrames(content_vue.stride, content_vue.frames);
									content_vue.frames.replace(new_frames);
								}
							}).show();
						},
						select(index, event) {
							if (!this.frames[index]) return;

							let previous_index = this.frame_index;
							this.frame_index = index;

							if (event && event.ctrlOrCmd) {
								this.frames[index].selected = true;
								
							} else if (event && event.shiftKey) {
								let start_index = Math.min(index, previous_index);
								let end_index = Math.max(index, previous_index);
								for (let i = start_index; i <= end_index; i++) {
									this.frames[i].selected = true;
								}

							} else {
								for (let frame of this.frames) {
									frame.selected = false;
								}
								this.frames[index].selected = true;

							}
						},
						duplicateFrame() {
							let frames = this.frames.filter(frame => frame.selected);
							if (!frames.length) return;
							let insert_index = this.frames.indexOf(frames.last()) + 1;
							for (let frame of frames) {
								let copy = Object.assign({}, frame);
								copy.uuid = guid();
								frame.selected = false;
								this.frames.splice(insert_index, 0, copy);
								this.frame_index = insert_index;
								insert_index++;
							}
						},
						deleteFrame() {
							for (let frame of this.frames.slice()) {
								if (!frame.selected) continue;
								this.frames.remove(frame);
							}
							this.frame_index = Math.min(this.frame_index, this.frames.length-1);
						},
						createFrame() {
							let canvas_frame = new CanvasFrame(gauge, this.stride);
							let frame = {
								uuid: guid(),
								canvas: canvas_frame.canvas,
								data_url: canvas_frame.canvas.toDataURL(),
							};
							this.frame_index++;
							this.frames.splice(this.frame_index, 0, frame);
							this.select(this.frame_index);
						},
						copy() {
							copied = [];
							for (let frame of this.frames) {
								if (!frame.selected) continue;
								copied.push(frame);
							}

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
							let insert_index = this.frames.findLastIndex(f => f.selected) + 1;
							let addFrame = (data_url) => {
								let canvas_frame = new CanvasFrame(gauge, this.stride);
								canvas_frame.loadFromURL(data_url);
								let frame = {
									uuid: guid(),
									canvas: canvas_frame.canvas,
									data_url,
								};
								this.frames.splice(insert_index, 0, frame);
								this.select(insert_index);
							}
							
							if (copied) {
								for (let frame of this.frames) {
									frame.selected = false;
								}
								for (let original of copied) {
									let copy = Object.assign({}, original);
									copy.uuid = guid();
									copy.selected = true;
									this.frames.splice(insert_index, 0, copy);
									this.frame_index = insert_index;
									insert_index++;
								}

							} else if (isApp) {
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
						resizeFrames() {
							let vue = this;
							let old_resolution = [gauge, this.stride];
							new Dialog('resize_flipbook_frames', {
								title: 'dialog.animated_texture_editor.resize_frames',
								form: {
									mode: {label: 'dialog.resize_texture.mode', type: 'inline_select', default: 'crop', options: {
										crop: 'dialog.resize_texture.mode.crop',
										scale: 'dialog.resize_texture.mode.scale',
									}},
									size: {
										label: 'dialog.project.texture_size',
										type: 'vector',
										dimensions: 2,
										value: old_resolution,
										min: 1
									},
									offset: {
										label: 'dialog.resize_texture.offset',
										type: 'vector',
										dimensions: 2,
										value: [0, 0]
									},
								},
								onConfirm(result) {
									gauge = result.size[0];
									let stride = vue.stride = result.size[1];
									let copy_canvas = document.createElement('canvas');
									let copy_ctx = copy_canvas.getContext('2d');
									copy_canvas.width = gauge;
									copy_canvas.height = vue.stride;

									for (let frame of vue.frames) {
										copy_canvas.width = gauge;
										copy_ctx.imageSmoothingEnabled = false;
										if (result.mode == 'crop') {
											copy_ctx.drawImage(frame.canvas, result.offset[0], result.offset[1]);
										} else {
											copy_ctx.drawImage(frame.canvas, result.offset[0], result.offset[1], gauge, stride);
										}

										frame.canvas.width = gauge;
										frame.canvas.height = stride;
										frame.ctx.drawImage(copy_canvas, 0, 0);
										
										frame.data_url = frame.canvas.toDataURL();
									}
								}
							}).show();
						},
						sort(event) {
							let selected = this.frames[this.frame_index];
							var item = this.frames.splice(event.oldIndex, 1)[0];
							this.frames.splice(event.newIndex, 0, item);
							this.frame_index = this.frames.findIndex(frame => frame == selected);
						},
						openCode() {
							displayCodeSuggestion(texture, this.frames.length, this.fps);
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
										class="flipbook_frame" :class="{viewing: frame_index == i, selected: frame.selected}"
										@click="select(i, $event);"
										@dblclick="setFrame(i)"
									>
										<label>{{ i }}</label>
										<img class="checkerboard" :src="frame.data_url" width="105">
									</li>
								</ul>
								<div>
									<div class="tool" @click="duplicateFrame()" title="${tl('action.duplicate')}">
										<i class="material-icons">content_copy</i>
									</div>
									<div class="tool" @click="deleteFrame()" title="${tl('generic.delete')}">
										<i class="material-icons">delete</i>
									</div>
									<div class="tool" @click="createFrame()" title="${tl('dialog.animated_texture_editor.add_frame')}">
										<i class="material-icons">library_add</i>
									</div>
									<div class="tool" @click="resizeFrames()" title="${tl('dialog.animated_texture_editor.resize_frames')}">
										<i class="material-icons">photo_size_select_large</i>
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
								<div class="flipbook_options">
									<label>${'FPS'}</label>
									<numeric-input v-model.number="fps" :min="1" :step="1" @input="updateFPS()" />
									<button @click="openCode()" v-if="code_available">${tl('dialog.animated_texture_editor.code_reference')}</button>
								</div>
							</div>
						</div>
					`
				},
				onConfirm: async function() {
					let {frames, stride} = this.content_vue;
					if (frames.length == 0) {
						this.content_vue.createFrame();
					}
					texture.canvas.width = gauge;
					texture.canvas.height = stride * frames.length;

					Undo.initEdit({textures: [texture], bitmap: true, uv_mode: !Format.per_texture_uv_size});
					
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

					if (Format.per_texture_uv_size) {
						texture.uv_height = texture.uv_width * (stride / gauge);
					} else {
						Project.texture_height = Project.texture_width * (stride / gauge);
					}

					texture.updateChangesAfterEdit();
					Undo.finishEdit('Apply flipbook animation changes');
					updateInterfacePanels();
					UVEditor.vue.updateTexture();
					BARS.updateConditions();
				}
			}).show();
		}
	})
})
