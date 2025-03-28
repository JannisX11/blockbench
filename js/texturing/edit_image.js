
BARS.defineActions(function() {

	function getTextures() {
		if (Texture.selected) {
			return Texture.all.filter(t => t.selected || t.multi_selected);
		} else {
			return Texture.all;
		}
	}
	let show_preview = true;

	// Adjustments
	new Action('invert_colors', {
		icon: 'invert_colors',
		category: 'textures',
		condition: {modes: ['paint'], method: () => Texture.all.length},
		click() {
			let textures = getTextures();
			Undo.initEdit({textures, bitmap: true});
			textures.forEach(texture => {
				texture.edit((canvas, env) => {
					let copy_canvas = Painter.copyCanvas(canvas);
					let ctx = canvas.getContext('2d');
					texture.selection.maskCanvas(ctx, env.offset);
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.filter = 'invert(1)';
					ctx.drawImage(copy_canvas, 0, 0);
					ctx.restore();

				}, {no_undo: true});
			})
			Undo.finishEdit('Invert colors')
		}
	})
	new Action('adjust_brightness_contrast', {
		icon: 'brightness_high',
		category: 'textures',
		condition: {modes: ['paint'], method: () => Texture.all.length},
		click() {
			let textures = getTextures();
			let original_canvases = textures.map(tex => {
				return Painter.copyCanvas(tex.getActiveCanvas().canvas);
			})
			Undo.initEdit({textures, bitmap: true});

			new Dialog({
				id: 'adjust_brightness_contrast',
				title: 'action.adjust_brightness_contrast',
				darken: false,
				component: {
					data() {return {
						show_preview,
						preview_changes: true,
						brightness: 100,
						contrast: 100,
						textures
					}},
					methods: {
						change() {
							textures.forEach((texture, i) => {
								texture.edit((canvas, env) => {
									let ctx = canvas.getContext('2d');
									texture.selection.maskCanvas(ctx, env.offset);
									ctx.clearRect(0, 0, texture.width, texture.height);
									if (this.preview_changes) {
										ctx.filter = `brightness(${this.brightness / 100}) contrast(${this.contrast / 100})`;
									} else {
										ctx.filter = `brightness(1.0) contrast(1.0)`;
									}
									ctx.drawImage(original_canvases[i], 0, 0);
									ctx.restore();

									setTimeout(() => {
										let ref_ctx = this.$refs.canvas[i].getContext('2d');
										ref_ctx.clearRect(0, 0, texture.width, texture.height);
										ref_ctx.drawImage(texture.canvas, 0, 0)
									}, 5);

								}, {no_undo: true, use_cache: true});
							})
						},
						togglePreview() {
							this.show_preview = show_preview = !this.show_preview;
						}
					},
					template: `
						<div>
							<div class="texture_adjust_previews checkerboard" ref="preview_list" :class="{folded: !show_preview}">
								<canvas v-for="(texture, i) in textures" :height="texture.height" :width="texture.width" ref="canvas" />
							</div>
							<div class="tool texture_adjust_preview_toggle" @click="togglePreview()"><i class="material-icons">{{ show_preview ? 'expand_more' : 'expand_less' }}</i></div>
							<div class="bar slider_input_combo">
								<input type="range" class="tool" min="0" max="200" step="1" v-model.number="brightness" @input="change()">
								<numeric-input class="tool" :min="0" :max="200" :step="1" v-model.number="brightness" @input="change()" />
							</div>
							<div class="bar slider_input_combo">
								<input type="range" class="tool" min="0" max="200" step="1" v-model.number="contrast" @input="change()">
								<numeric-input class="tool" :min="0" :max="200" :step="1" v-model.number="contrast" @input="change()" />
							</div>
							<div class="bar button_bar_checkbox">
								<input type="checkbox" v-model="preview_changes" id="checkbox_preview_changes" @change="change()">
								<label for="checkbox_preview_changes">${tl('dialog.edit_texture.preview')}</label>
							</div>
						</div>
					`,
					mounted() {
						textures.forEach((texture, i) => {
							let ref_ctx = this.$refs.canvas[i].getContext('2d');
							ref_ctx.clearRect(0, 0, texture.width, texture.height);
							ref_ctx.drawImage(texture.img, 0, 0);
						})
					}
				},
				onConfirm() {
					if (!this.content_vue.preview_changes) {
						this.content_vue.preview_changes = true;
						this.content_vue.change();
					}
					textures.forEach((texture, i) => {
						texture.updateChangesAfterEdit();
					})
					Undo.finishEdit('Adjust brightness and contrast');
				},
				onCancel() {
					Undo.cancelEdit(true);
				}
			}).show();
		}
	})
	new Action('adjust_saturation_hue', {
		icon: 'fa-tint',
		category: 'textures',
		condition: {modes: ['paint'], method: () => Texture.all.length},
		click() {
			let textures = getTextures();
			let original_canvases = textures.map(tex => {
				return Painter.copyCanvas(tex.getActiveCanvas().canvas);
			})
			Undo.initEdit({textures, bitmap: true});

			new Dialog({
				id: 'adjust_saturation_hue',
				title: 'action.adjust_saturation_hue',
				darken: false,
				component: {
					data() {return {
						show_preview,
						preview_changes: true,
						saturation: 100,
						hue: 0,
						textures
					}},
					methods: {
						change() {
							textures.forEach((texture, i) => {
								texture.edit((canvas, env) => {
									let ctx = canvas.getContext('2d');
									texture.selection.maskCanvas(ctx, env.offset);
									ctx.clearRect(0, 0, texture.width, texture.height);
									if (this.preview_changes) {
										ctx.filter = `saturate(${this.saturation / 100}) hue-rotate(${this.hue}deg)`;
									} else {
										ctx.filter = `brightness(1.0)`;
									}
									ctx.drawImage(original_canvases[i], 0, 0);
									ctx.restore();

									setTimeout(() => {
										let ref_ctx = this.$refs.canvas[i].getContext('2d');
										ref_ctx.clearRect(0, 0, texture.width, texture.height);
										ref_ctx.drawImage(texture.canvas, 0, 0)
									}, 5);

								}, {no_undo: true, use_cache: true});
							})
						},
						togglePreview() {
							this.show_preview = show_preview = !this.show_preview;
						}
					},
					template: `
						<div>
							<div class="texture_adjust_previews checkerboard" :class="{folded: !show_preview}">
								<canvas v-for="(texture, i) in textures" :height="texture.height" :width="texture.width" ref="canvas" />
							</div>
							<div class="tool texture_adjust_preview_toggle" @click="togglePreview()"><i class="material-icons">{{ show_preview ? 'expand_more' : 'expand_less' }}</i></div>
							<div class="bar slider_input_combo">
								<input type="range" class="tool" min="0" max="200" step="1" v-model.number="saturation" @input="change()">
								<numeric-input class="tool" :min="0" :max="200" :step="1" v-model.number="saturation" @input="change()" />
							</div>
							<div class="bar slider_input_combo">
								<input type="range" class="tool" min="-180" max="180" step="1" v-model.number="hue" @input="change()">
								<numeric-input class="tool" :min="-180" :max="180" :step="1" v-model.number="hue" @input="change()" />
							</div>
							<div class="bar button_bar_checkbox">
								<input type="checkbox" v-model="preview_changes" id="checkbox_preview_changes" @change="change()">
								<label for="checkbox_preview_changes">${tl('dialog.edit_texture.preview')}</label>
							</div>
						</div>
					`,
					mounted() {
						textures.forEach((texture, i) => {
							let ref_ctx = this.$refs.canvas[i].getContext('2d');
							ref_ctx.clearRect(0, 0, texture.width, texture.height);
							ref_ctx.drawImage(texture.img, 0, 0);
						})
					}
				},
				onConfirm() {
					if (!this.content_vue.preview_changes) {
						this.content_vue.preview_changes = true;
						this.content_vue.change();
					}
					textures.forEach((texture, i) => {
						texture.updateChangesAfterEdit();
					})
					Undo.finishEdit('Adjust saturation and hue');
				},
				onCancel() {
					Undo.cancelEdit(true);
				}
			}).show();
		}
	})
	new Action('adjust_curves', {
		icon: 'fa-chart-line',
		category: 'textures',
		condition: {modes: ['paint'], method: () => Texture.all.length},
		click() {
			let textures = getTextures();
			let original_image_data = textures.map(tex => {
				let {canvas, ctx} = tex.getActiveCanvas();
				let image_data = ctx.getImageData(0, 0, canvas.width, canvas.height);
				image_data.original_data = image_data.data.slice();
				return image_data;
			})
			Undo.initEdit({textures, bitmap: true});
			let image_data = original_image_data[0];
			let light_points = {};
			let highest_light_point = 0;
			for (let i = 0; i < 256; i++) {
				light_points[i] = 0;
			}
			for (let i = 0; i < image_data.data.length; i += 4) {
				let R = image_data.data[i+0];
				let G = image_data.data[i+1];
				let B = image_data.data[i+2];
				let A = image_data.data[i+3];
				if (A == 0) continue;
				let brightness = (0.2126*R + 0.7152*G + 0.0722*B);
				light_points[Math.round(brightness)] += 1;
				highest_light_point = Math.max(highest_light_point, light_points[Math.round(brightness)]);
			}

			let curves = {
				rgb: null,
				r: null,
				g: null,
				b: null,
				a: null,
			};

			function toCatmullRomBezier( points, tension = 0.5) {
				if (points.length == 2) {
					return `M${points[0][0]},${points[0][1]} L${points[1][0]},${points[1][1]}`
				}
				let tens = (tension !== 0) ? tension * 12 : 0.5 * 12
				let floats = points.map(x => x.map(x => parseFloat(x)))
				let firstMoveto = ['M' + floats[0][0] + ' ' + floats[0][1] + ' ']
				let matrixPoints = floats.map((point, i, arr) => {
					if (i == 0) {
						return getMatrix([arr[i],arr[i],arr[i+1],arr[i+2]])
					} else if (i == arr.length - 2) {
						return getMatrix([arr[i-1],arr[i],arr[i+1],arr[i+1]])
					} else {
						return getMatrix([arr[i-1],arr[i],arr[i+1],arr[i+2]])
					}
				}).filter(mx => mx[3] !== undefined)
				let matrixMathToBezier = matrixPoints.map(p => {
					return [
						{ x: p[1].x,	y: p[1].y },
						{	x: Math.clamp((-p[0].x + tens * p[1].x + p[2].x) / tens, p[1].x, p[2].x),
							y: ((-p[0].y + tens * p[1].y + p[2].y) / tens)
						},
						{	x: Math.clamp(( p[1].x + tens * p[2].x - p[3].x) / tens, p[1].x, p[2].x),
							y: ((p[1].y + tens * p[2].y - p[3].y) / tens)
						},
						{ x: p[2].x,	y: p[2].y }
					]
				})
				
				let toSVGNotation = matrixMathToBezier.map(bp => {
					return "C" + bp[1].x + "," + bp[1].y + " " + bp[2].x + "," + bp[2].y + " " + bp[3].x + "," + bp[3].y + " "
				})
				
				return firstMoveto.concat(toSVGNotation).join(' ')
				
				function getMatrix(arr) {
					return arr.map(p => {
						if (p !== undefined) { return { x : p[0], y : p[1] }}
					}) 
				}
			}

			new Dialog({
				id: 'adjust_curves',
				title: 'action.adjust_curves',
				darken: false,
				width: 460,
				component: {
					data() {return {
						preview_changes: true,
						light_data: '',
						graph: 'rgb',
						graphs: {
							rgb: 	{data: '', points: [[0, 0], [1, 1]]},
							r:		{data: '', points: [[0, 0], [1, 1]]},
							g:		{data: '', points: [[0, 0], [1, 1]]},
							b:		{data: '', points: [[0, 0], [1, 1]]},
							a:		{data: '', points: [[0, 0], [1, 1]]},
						},
						height: 400,
						width: 400,
						textures
					}},
					methods: {
						change() {
							let values = {};
							for (let key in this.graphs) {
								let graph = this.graphs[key];
								if (graph.points.length === 2 && graph.points[0].allEqual(0) && graph.points[1].allEqual(1)) {
									delete curves[key];
								} else {
									let vectors = [];
									values[key] = {};
									graph.points.forEach(point => {
										vectors.push(new THREE.Vector2(point[0], point[1]));
									})
									curves[key] = new THREE.SplineCurve(vectors);
								}
							}

							textures.forEach((texture, i) => {
								texture.edit((canvas, {offset}) => {
									let ctx = canvas.getContext('2d');
									let image_data = original_image_data[i];

									if (this.preview_changes) {
										for (let i = 0; i < image_data.data.length; i += 4) {
											if (!texture.selection.allow(offset[0] + (i/4) % image_data.width, offset[1] + Math.floor((i/4) / image_data.width))) continue;
											
											let R = image_data.original_data[i+0]
											let G = image_data.original_data[i+1]
											let B = image_data.original_data[i+2]
											let A = image_data.original_data[i+3]
											let brightness = Math.round(0.2126*R + 0.7152*G + 0.0722*B);

											let rgb = !curves.rgb ? brightness : (values.rgb[brightness] !== undefined ? values.rgb[brightness] : values.rgb[brightness] = curves.rgb.getPointAt(brightness / 255).y * 255);
											let r = !curves.r ? Math.max(brightness, 1) : (values.r[brightness] !== undefined ? values.r[brightness] : values.r[brightness] = curves.r.getPointAt(brightness / 255).y * 255);
											let g = !curves.g ? Math.max(brightness, 1) : (values.g[brightness] !== undefined ? values.g[brightness] : values.g[brightness] = curves.g.getPointAt(brightness / 255).y * 255);
											let b = !curves.b ? Math.max(brightness, 1) : (values.b[brightness] !== undefined ? values.b[brightness] : values.b[brightness] = curves.b.getPointAt(brightness / 255).y * 255);
											let a = !curves.a ? A : (values.a[A] !== undefined ? values.a[A] : values.a[A] = curves.a.getPointAt(A / 255).y * 255);
											brightness = Math.max(brightness, 1);
										
											image_data.data[i+0] = Math.max(R, 1) * (r / brightness) * (rgb / brightness);
											image_data.data[i+1] = Math.max(G, 1) * (g / brightness) * (rgb / brightness);
											image_data.data[i+2] = Math.max(B, 1) * (b / brightness) * (rgb / brightness);
											image_data.data[i+3] = a;
										}
									} else {
										for (let i = 0; i < image_data.data.length; i += 4) {
											if (!texture.selection.allow(offset[0] + (i/4) % image_data.width, offset[1] + Math.floor((i/4) / image_data.width))) continue;
											image_data.data[i+0] = image_data.original_data[i+0];
											image_data.data[i+1] = image_data.original_data[i+1];
											image_data.data[i+2] = image_data.original_data[i+2];
											image_data.data[i+3] = image_data.original_data[i+3];
										}
									}
									ctx.putImageData(image_data, 0, 0);


								}, {no_undo: true, use_cache: true});
							})
						},
						setGraph(graph) {
							this.graph = graph;
							this.updateGraph();
						},
						dragPoint(point, e1) {
							let scope = this;
							let {points} = this.graphs[this.graph];
							let original_point = point.slice();
							
							function drag(e2) {
								if (point == points[0] || point == points.last()) {
									point[0] = point == points[0] ? 0 : 1;
								} else {
									point[0] = Math.clamp(original_point[0] + (e2.clientX - e1.clientX) / scope.width, 0, 1);
								}
								point[1] = Math.clamp(original_point[1] - (e2.clientY - e1.clientY) / scope.height, 0, 1);
								scope.updateGraph();
								scope.change();
							}
							function stop() {
								removeEventListeners(document, 'mousemove touchmove', drag);
								removeEventListeners(document, 'mouseup touchend', stop);
							}
							addEventListeners(document, 'mousemove touchmove', drag);
							addEventListeners(document, 'mouseup touchend', stop);
						},
						createNewPoint(event) {
							if (event.target.id !== 'contrast_graph' || event.which == 3) return;
							let point = [
								(event.offsetX - 5) / this.width,
								1 - ((event.offsetY - 5) / this.width),
							]
							let {points} = this.graphs[this.graph];
							points.push(point);
							this.updateGraph();
							this.change();
							this.dragPoint(point, event);
						},
						updateGraph(id = this.graph) {
							let offset = 5;
							let {points} = this.graphs[this.graph];

							points.sort((a, b) => a[0] - b[0]);
							this.graphs[id].data = toCatmullRomBezier(points.map(p => {
								return [p[0] * this.width + offset, (1-p[1]) * this.height + offset];
							}));
						},
						contextMenu(point, event) {
							let {points} = this.graphs[this.graph];
							if (point == points[0] || point == points.last()) return;
							new Menu([{
								id: 'remove',
								name: 'Remove',
								icon: 'clear',
								click: () => {
									let {points} = this.graphs[this.graph];
									points.remove(point);
									this.updateGraph();
									this.change();
								}
							}]).open(event.target);
						}
					},
					template: `
						<div>
							<div class="bar contrast_graph_selector">
								<div @click="setGraph('rgb')" :class="{selected: graph == 'rgb'}">RGB</div>
								<div @click="setGraph('r')" :class="{selected: graph == 'r'}">R</div>
								<div @click="setGraph('g')" :class="{selected: graph == 'g'}">G</div>
								<div @click="setGraph('b')" :class="{selected: graph == 'b'}">B</div>
								<div @click="setGraph('a')" :class="{selected: graph == 'a'}">A</div>
							</div>
							<div id="contrast_graph" @mousedown="createNewPoint($event)" @touchstart="createNewPoint($event)">
								<svg>
									<path :class="{active: graph == 'r'}" :d="graphs.r.data" style="stroke: #ff0000;"></path>
									<path :class="{active: graph == 'g'}" :d="graphs.g.data" style="stroke: #00ff00;"></path>
									<path :class="{active: graph == 'b'}" :d="graphs.b.data" style="stroke: #3b3bff;"></path>
									<path :class="{active: graph == 'a'}" :d="graphs.a.data" style="stroke: var(--color-text);"></path>
									<path :class="{active: graph == 'rgb'}" :d="graphs.rgb.data"></path>
									<polygon :points="light_data" />
								</svg>
								<div class="contrast_graph_point"
									v-for="point in graphs[graph].points"
									:style="{left: point[0] * width + 'px', top: (1-point[1]) * height + 'px'}"
									@mousedown="dragPoint(point, $event)" @touchstart="dragPoint(point, $event)"
									@contextmenu="contextMenu(point, $event)"
								></div>
							</div>
							<div class="bar button_bar_checkbox">
								<input type="checkbox" v-model="preview_changes" id="checkbox_preview_changes" @change="change()">
								<label for="checkbox_preview_changes">${tl('dialog.edit_texture.preview')}</label>
							</div>
						</div>
					`,
					mounted() {
						for (let key in this.graphs) {
							this.updateGraph(key);
						}
						this.light_data = `${5},${this.height + 5}`;
						for (let key in light_points) {
							this.light_data += ` ${Math.round((key / 255) * this.width) + 5},${Math.round((1 - light_points[key] / highest_light_point) * this.height) + 5}`;
						}
						this.light_data += ` ${this.width + 5},${this.height + 5}`;

					}
				},
				onConfirm() {
					if (!this.content_vue.preview_changes) {
						this.content_vue.preview_changes = true;
						this.content_vue.change();
					}
					textures.forEach((texture, i) => {
						texture.updateChangesAfterEdit();
					})
					Undo.finishEdit('Adjust curves');
				},
				onCancel() {
					Undo.cancelEdit(true);
				}
			}).show();
		}
	})
	new Action('adjust_opacity', {
		icon: 'gradient',
		category: 'textures',
		condition: {modes: ['paint'], method: () => Texture.all.length},
		click() {
			let textures = getTextures();
			let original_canvases = textures.map(tex => {
				return Painter.copyCanvas(tex.getActiveCanvas().canvas);
			})
			Undo.initEdit({textures, bitmap: true});

			new Dialog({
				id: 'adjust_opacity',
				title: 'action.adjust_opacity',
				darken: false,
				component: {
					data() {return {
						show_preview,
						preview_changes: true,
						opacity: 100,
						textures
					}},
					methods: {
						change() {
							textures.forEach((texture, i) => {
								texture.edit((canvas, env) => {
									let ctx = canvas.getContext('2d');
									ctx.save();
									texture.selection.maskCanvas(ctx, env.offset);
									ctx.clearRect(0, 0, texture.width, texture.height);
									if (this.preview_changes) {
										ctx.filter = `opacity(${this.opacity}%)`;
										ctx.drawImage(original_canvases[i], 0, 0);
										if (this.opacity > 100 && this.preview_changes) {
											ctx.filter = `opacity(${this.opacity-100}%)`;
											ctx.drawImage(original_canvases[i], 0, 0);
										}
									} else {
										ctx.filter = `opacity(100%)`;
										ctx.drawImage(original_canvases[i], 0, 0);
									}
									ctx.restore();

									setTimeout(() => {
										let ref_ctx = this.$refs.canvas[i].getContext('2d');
										ref_ctx.clearRect(0, 0, texture.width, texture.height);
										ref_ctx.drawImage(texture.canvas, 0, 0)
									}, 5);

								}, {no_undo: true, use_cache: true});
							})
						},
						togglePreview() {
							this.show_preview = show_preview = !this.show_preview;
						}
					},
					template: `
						<div>
							<div class="texture_adjust_previews checkerboard" :class="{folded: !show_preview}">
								<canvas v-for="(texture, i) in textures" :height="texture.height" :width="texture.width" ref="canvas" />
							</div>
							<div class="tool texture_adjust_preview_toggle" @click="togglePreview()"><i class="material-icons">{{ show_preview ? 'expand_more' : 'expand_less' }}</i></div>
							<div class="bar slider_input_combo">
								<input type="range" class="tool" min="0" max="200" step="0.1" v-model.number="opacity" @input="change()">
								<numeric-input class="tool" style="width: 64px;" :min="0" :max="200" :step="0.1" v-model.number="opacity" @input="change()" />
							</div>
							<div class="bar button_bar_checkbox">
								<input type="checkbox" v-model="preview_changes" id="checkbox_preview_changes" @change="change()">
								<label for="checkbox_preview_changes">${tl('dialog.edit_texture.preview')}</label>
							</div>
						</div>
					`,
					mounted() {
						textures.forEach((texture, i) => {
							let ref_ctx = this.$refs.canvas[i].getContext('2d');
							ref_ctx.clearRect(0, 0, texture.width, texture.height);
							ref_ctx.drawImage(texture.img, 0, 0);
						})
					}
				},
				onConfirm() {
					if (!this.content_vue.preview_changes) {
						this.content_vue.preview_changes = true;
						this.content_vue.change();
					}
					textures.forEach((texture, i) => {
						texture.updateChangesAfterEdit();
					})
					Undo.finishEdit('Adjust opacity');
				},
				onCancel() {
					Undo.cancelEdit(true);
				}
			}).show();
		}
	})

	// Effects
	new Action('limit_to_palette', {
		icon: 'blur_linear',
		category: 'textures',
		condition: {modes: ['paint'], method: () => Texture.all.length},
		click() {
			let textures = getTextures();
			Undo.initEdit({textures, bitmap: true});
			textures.forEach(texture => {
				texture.edit((canvas) => {
					let ctx = canvas.getContext('2d');
					var palette = {};
					ColorPanel.palette.forEach(color => {
						palette[color] = tinycolor(color);
					})
					Painter.scanCanvas(ctx, 0, 0, canvas.width, canvas.height, (x, y, pixel) => {
						if (!texture.selection.allow(x, y)) return;
						if (pixel[3] < 4) return;
						let smallest_distance = Infinity;
						let nearest_color = null;
						let pixel_color = {_r: pixel[0], _g: pixel[1], _b: pixel[2]};
						for (let key in palette) {
							let color = palette[key];
							let distance = colorDistance(color, pixel_color);
							if (distance < smallest_distance) {
								smallest_distance = distance;
								nearest_color = color;
							}
						}
						if (!nearest_color) return;
						pixel[0] = nearest_color._r;
						pixel[1] = nearest_color._g;
						pixel[2] = nearest_color._b;
						return pixel;
					})

				}, {no_undo: true});
			})
			Undo.finishEdit('Limit texture to palette')
		}
	})
	new Action('split_rgb_into_layers', {
		icon: 'stacked_bar_chart',
		category: 'textures',
		condition: {modes: ['paint'], selected: {texture: true}},
		click() {
			let texture = Texture.getDefault();
			let original_data = texture.ctx.getImageData(0, 0, texture.canvas.width, texture.canvas.height);

			Undo.initEdit({textures: [texture], bitmap: true});

			texture.layers_enabled = true;
			let i = 0;
			for (let color of ['red', 'green', 'blue']) {
				data_copy = new ImageData(original_data.data.slice(), original_data.width, original_data.height);
				for (let j = 0; j < data_copy.data.length; j += 4) {
					if (i != 0) data_copy.data[j+0] = 0;
					if (i != 1) data_copy.data[j+1] = 0;
					if (i != 2) data_copy.data[j+2] = 0;
				}
				let layer = new TextureLayer({
					name: color,
					blend_mode: 'add'
				}, texture);
				layer.setSize(original_data.width, original_data.height);
				layer.ctx.putImageData(data_copy, 0, 0);
				texture.layers.unshift(layer);
				if (color == 'red') {
					layer.select();
				}
				i++;
			}
			texture.updateLayerChanges(true);
			Undo.finishEdit('Split texture into RGB layers');
			updateInterfacePanels();
			BARS.updateConditions();
		}
	})
	new Action('clear_unused_texture_space', {
		icon: 'cleaning_services',
		category: 'textures',
		condition: {modes: ['paint', 'edit'], features: ['edit_mode'], method: () => Texture.all.length},
		click() {
			let textures = getTextures();
			Undo.initEdit({textures, bitmap: true});
			textures.forEach(texture => {
				texture.edit((canvas) => {
					let frame_count = texture.frameCount || 1;
					let ctx = canvas.getContext('2d');
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.beginPath();

					for (let frame = 0; frame < frame_count; frame++) {
						let y_offset = (frame * texture.display_height) || 0;
						Outliner.elements.forEach(el => {
							if (el instanceof Mesh) {
								for (var fkey in el.faces) {
									var face = el.faces[fkey];
									if (face.vertices.length <= 2 || face.getTexture() !== texture) continue;
									
									let matrix = face.getOccupationMatrix(true, [0, 0]);
									for (let x in matrix) {
										for (let y in matrix[x]) {
											if (!matrix[x][y]) continue;
											x = parseInt(x); y = parseInt(y);
											ctx.rect(x, y + y_offset, 1, 1);
										}
									}
								}
							} else if (el instanceof Cube) {
								let factor_x = texture.width  / Project.texture_width;
								let factor_y = texture.display_height / Project.texture_height;
								for (var fkey in el.faces) {
									var face = el.faces[fkey];
									if (face.getTexture() !== texture) continue;
									
									let rect = face.getBoundingRect();
									let canvasRect = [
										Math.floor(rect.ax * factor_x),
										Math.floor(rect.ay * factor_y) + y_offset,
										Math.ceil(rect.bx * factor_x) - Math.floor(rect.ax * factor_x),
										Math.ceil(rect.by * factor_y) - Math.floor(rect.ay * factor_y),
									]
									ctx.rect(...canvasRect);
								}
							}
						})
					}

					ctx.clip();
					ctx.drawImage(texture.img, 0, 0);
				}, {no_undo: true});
			})
			Undo.finishEdit('Clear unused texture space')
		}
	})

	// Transform
	new Action('flip_texture_x', {
		icon: 'icon-mirror_x',
		category: 'textures',
		condition: {modes: ['paint'], method: () => Texture.all.length},
		click() {
			if (Texture.selected?.selected_layer) {
				Texture.selected?.selected_layer.flip(0, true);
				return;
			}
			let textures = getTextures();
			Undo.initEdit({textures, bitmap: true});
			textures.forEach(texture => {
				texture.edit((canvas) => {

					let ctx = canvas.getContext('2d');
					ctx.save();
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.scale(-1, 1);
					ctx.drawImage(texture.img, -canvas.width, 0);
					ctx.restore();

				}, {no_undo: true});
			})
			Undo.finishEdit('Flip texture X')
		}
	})
	new Action('flip_texture_y', {
		icon: 'icon-mirror_y',
		category: 'textures',
		condition: {modes: ['paint'], method: () => Texture.all.length},
		click() {
			if (Texture.selected?.selected_layer) {
				Texture.selected?.selected_layer.flip(1, true);
				return;
			}
			let textures = getTextures();
			Undo.initEdit({textures, bitmap: true});
			textures.forEach(texture => {
				texture.edit((canvas) => {

					let ctx = canvas.getContext('2d');
					ctx.save();
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.scale(1, -1);
					ctx.drawImage(texture.img, 0, -canvas.height);
					ctx.restore();

				}, {no_undo: true});
			})
			Undo.finishEdit('Flip texture Y')
		}
	})
	new Action('rotate_texture_cw', {
		icon: 'rotate_right',
		category: 'textures',
		condition: {modes: ['paint'], method: () => Texture.all.length},
		click() {
			if (Texture.selected?.selected_layer) {
				Texture.selected?.selected_layer.rotate(90, true);
				return;
			}
			let textures = getTextures();
			Undo.initEdit({textures, bitmap: true});
			textures.forEach(texture => {
				texture.edit((canvas) => {

					let ctx = canvas.getContext('2d');
					ctx.save();
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.rotate(Math.PI/2);
					ctx.drawImage(texture.img, 0, -canvas.height);
					ctx.restore();

				}, {no_undo: true});
			})
			Undo.finishEdit('Rotate texture clockwise')
		}
	})
	new Action('rotate_texture_ccw', {
		icon: 'rotate_left',
		category: 'textures',
		condition: {modes: ['paint'], method: () => Texture.all.length},
		click() {
			if (Texture.selected?.selected_layer) {
				Texture.selected?.selected_layer.rotate(-90, true);
				return;
			}
			let textures = getTextures();
			Undo.initEdit({textures, bitmap: true});
			textures.forEach(texture => {
				texture.edit((canvas) => {

					let ctx = canvas.getContext('2d');
					ctx.save();
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.rotate(-Math.PI/2);
					ctx.drawImage(texture.img, -canvas.width, 0);
					ctx.restore();

				}, {no_undo: true});
			})
			Undo.finishEdit('Rotate texture counter-clockwise')
		}
	})
	new Action('resize_texture', {
		icon: 'photo_size_select_large',
		category: 'textures',
		condition: () => Texture.selected,
		click() {
			let texture = Texture.selected;
			texture.resizeDialog();
		}
	})
	new Action('crop_texture_to_selection', {
		icon: 'crop',
		category: 'textures',
		condition: () => Texture.selected,
		click() {
			let texture = Texture.selected;
			let rect = texture.selection.getBoundingRect();
			let uv_factor = texture.width / texture.uv_width;
			let old_width = texture.width;
			let old_height = texture.height;
			if (!rect.width || !rect.height) return;

			Undo.initEdit({textures: [texture], bitmap: true});

			if (!texture.layers_enabled) {
				texture.width = texture.canvas.width = rect.width;
				texture.height = texture.canvas.height = rect.height;
				texture.ctx.imageSmoothingEnabled = false;
				texture.ctx.drawImage(texture.img, -rect.start_x, -rect.start_y);
			} else {
				texture.width = texture.canvas.width = rect.width;
				texture.height = texture.canvas.height = rect.height;
				texture.layers.forEach(layer => {
					layer.offset[0] -= rect.start_x;
					layer.offset[1] -= rect.start_y;
				})
			}
			texture.uv_width = texture.canvas.width * uv_factor;
			texture.uv_height = texture.canvas.height * uv_factor;

			texture.updateChangesAfterEdit();
			texture.selection.clear();
			UVEditor.updateSelectionOutline();

			Undo.finishEdit('Crop texture to selection');
			setTimeout(updateSelection, 100);

			// Fix UV
			let elements_to_change = [];
			Outliner.elements.forEach(element => {
				if (!element.faces) return;
				for (let key in element.faces) {
					if (element.faces[key].getTexture() == texture) {
						elements_to_change.safePush(element);
						break;
					}
				}
			})
			if (elements_to_change.length) {
				Undo.initEdit({elements: elements_to_change});
				let uv_adjust_x = 1;
				let uv_adjust_y = 1;
				if (Format.single_texture || Texture.all.length == 1 || Format.per_texture_uv_size) {
					if (!Format.per_texture_uv_size) {
						Undo.current_save.uv_mode = {
							box_uv: Project.box_uv,
							width:  Project.texture_width,
							height: Project.texture_height
						}
						Undo.current_save.aspects.uv_mode = true;
						Project.texture_width = Project.texture_width * (rect.width / old_width);
						Project.texture_height = Project.texture_height * (rect.height / old_height);
					}

				} else {
					uv_adjust_x = rect.width / old_width;
					uv_adjust_y = rect.height / old_height;
				}
				elements_to_change.forEach(element => {
					if (element instanceof Cube) {
						for (let key in element.faces) {
							if (element.faces[key].getTexture() != texture) continue;
							if (element.box_uv) {
								element.uv_offset[0] -= (rect.start_x * uv_factor);
								element.uv_offset[1] -= (rect.start_y * uv_factor);
							} else {
								let uv = element.faces[key].uv;
								uv[0] = uv[0] / uv_adjust_x - (rect.start_x * uv_factor);
								uv[2] = uv[2] / uv_adjust_x - (rect.start_x * uv_factor);
								uv[1] = uv[1] / uv_adjust_y - (rect.start_y * uv_factor);
								uv[3] = uv[3] / uv_adjust_y - (rect.start_y * uv_factor);
							}
							
						}
					} else if (element instanceof Mesh) {
						for (let key in element.faces) {
							if (element.faces[key].getTexture() != texture) continue;
							let uv = element.faces[key].uv;
							for (let vkey in uv) {
								uv[vkey][0] = uv[vkey][0] / uv_adjust_x - (rect.start_x * uv_factor);
								uv[vkey][1] = uv[vkey][1] / uv_adjust_y - (rect.start_y * uv_factor);
							}
						}
					}
				})
				Canvas.updateView({elements: elements_to_change, element_aspects: {uv: true}})
				Undo.finishEdit('Adjust UV after cropping texture');
			}
		}
	})
})