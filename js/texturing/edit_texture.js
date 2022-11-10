
BARS.defineActions(function() {

	function getTextures() {
		if (Texture.selected) {
			return [Texture.selected];
		} else {
			return Texture.all;
		}
	}
	let show_preview = true;

	new Action('invert_colors', {
		icon: 'invert_colors',
		category: 'textures',
		condition: {modes: ['paint'], method: () => Texture.all.length},
		click() {
			let textures = getTextures();
			Undo.initEdit({textures, bitmap: true});
			textures.forEach(texture => {
				texture.edit((canvas) => {

					let ctx = canvas.getContext('2d');
					ctx.clearRect(0, 0, texture.width, texture.height);
					ctx.filter = 'invert(1)';
					ctx.drawImage(texture.img, 0, 0);

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
			let original_imgs = textures.map(tex => {
				return tex.img.cloneNode();
			})
			Undo.initEdit({textures, bitmap: true});

			new Dialog({
				id: 'adjust_brightness_contrast',
				title: 'action.adjust_brightness_contrast',
				darken: false,
				component: {
					data() {return {
						show_preview,
						brightness: 100,
						contrast: 100,
						textures
					}},
					methods: {
						change() {
							textures.forEach((texture, i) => {
								texture.edit((canvas) => {
									let ctx = canvas.getContext('2d');
									ctx.clearRect(0, 0, texture.width, texture.height);
									ctx.filter = `brightness(${this.brightness / 100}) contrast(${this.contrast / 100})`;
									ctx.drawImage(original_imgs[i], 0, 0);

									let ref_ctx = this.$refs.canvas[i].getContext('2d');
									ref_ctx.clearRect(0, 0, texture.width, texture.height);
									ref_ctx.drawImage(canvas, 0, 0);

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
								<input type="range" class="tool" min="0" max="200" step="1" v-model="brightness" @input="change()">
								<input lang="en" type="number" class="tool" min="0" max="200" step="1" v-model.number="brightness" @input="change()">
							</div>
							<div class="bar slider_input_combo">
								<input type="range" class="tool" min="0" max="200" step="1" v-model="contrast" @input="change()">
								<input lang="en" type="number" class="tool" min="0" max="200" step="1" v-model.number="contrast" @input="change()">
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
					Undo.finishEdit('Adjust brightness and contrast');
				},
				onCancel() {
					Undo.cancelEdit();
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
			let original_imgs = textures.map(tex => {
				return tex.img.cloneNode();
			})
			Undo.initEdit({textures, bitmap: true});

			new Dialog({
				id: 'adjust_saturation_hue',
				title: 'action.adjust_saturation_hue',
				darken: false,
				component: {
					data() {return {
						show_preview,
						saturation: 100,
						hue: 0,
						textures
					}},
					methods: {
						change() {
							textures.forEach((texture, i) => {
								texture.edit((canvas) => {
									let ctx = canvas.getContext('2d');
									ctx.clearRect(0, 0, texture.width, texture.height);
									ctx.filter = `saturate(${this.saturation / 100}) hue-rotate(${this.hue}deg)`;
									ctx.drawImage(original_imgs[i], 0, 0);

									let ref_ctx = this.$refs.canvas[i].getContext('2d');
									ref_ctx.clearRect(0, 0, texture.width, texture.height);
									ref_ctx.drawImage(canvas, 0, 0);

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
								<input type="range" class="tool" min="0" max="200" step="1" v-model="saturation" @input="change()">
								<input lang="en" type="number" class="tool" min="0" max="200" step="1" v-model.number="saturation" @input="change()">
							</div>
							<div class="bar slider_input_combo">
								<input type="range" class="tool" min="-180" max="180" step="1" v-model="hue" @input="change()">
								<input lang="en" type="number" class="tool" min="-180" max="180" step="1" v-model.number="hue" @input="change()">
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
					Undo.finishEdit('Adjust saturation and hue');
				},
				onCancel() {
					Undo.cancelEdit();
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
				let canvas = Painter.getCanvas(tex);
				let image_data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
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
								texture.edit((canvas) => {
									let ctx = canvas.getContext('2d');
									let image_data = original_image_data[i];

									for (let i = 0; i < image_data.data.length; i += 4) {

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
					Undo.finishEdit('Invert colors');
				},
				onCancel() {
					Undo.cancelEdit();
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
			let original_imgs = textures.map(tex => {
				return tex.img.cloneNode();
			})
			Undo.initEdit({textures, bitmap: true});

			new Dialog({
				id: 'adjust_opacity',
				title: 'action.adjust_opacity',
				darken: false,
				component: {
					data() {return {
						show_preview,
						opacity: 100,
						textures
					}},
					methods: {
						change() {
							textures.forEach((texture, i) => {
								texture.edit((canvas) => {
									let ctx = canvas.getContext('2d');
									ctx.clearRect(0, 0, texture.width, texture.height);
									ctx.filter = `opacity(${this.opacity}%)`;
									ctx.drawImage(original_imgs[i], 0, 0);
									if (this.opacity > 100) {
										ctx.filter = `opacity(${this.opacity-100}%)`;
										ctx.drawImage(original_imgs[i], 0, 0);
									}

									let ref_ctx = this.$refs.canvas[i].getContext('2d');
									ref_ctx.clearRect(0, 0, texture.width, texture.height);
									ref_ctx.drawImage(canvas, 0, 0);

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
								<input type="range" class="tool" min="0" max="200" step="0.1" v-model="opacity" @input="change()">
								<input lang="en" type="number" class="tool" style="width: 64px;" min="0" max="200" step="0.1" v-model.number="opacity" @input="change()">
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
					Undo.finishEdit('Adjust opacity');
				},
				onCancel() {
					Undo.cancelEdit();
				}
			}).show();
		}
	})

	new Action('flip_texture_x', {
		icon: 'icon-mirror_x',
		category: 'textures',
		condition: {modes: ['paint'], method: () => Texture.all.length},
		click() {
			let textures = getTextures();
			Undo.initEdit({textures, bitmap: true});
			textures.forEach(texture => {
				texture.edit((canvas) => {

					let ctx = canvas.getContext('2d');
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.scale(-1, 1);
					ctx.drawImage(texture.img, -canvas.width, 0);

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
			let textures = getTextures();
			Undo.initEdit({textures, bitmap: true});
			textures.forEach(texture => {
				texture.edit((canvas) => {

					let ctx = canvas.getContext('2d');
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.scale(1, -1);
					ctx.drawImage(texture.img, 0, -canvas.height);

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
			let textures = getTextures();
			Undo.initEdit({textures, bitmap: true});
			textures.forEach(texture => {
				texture.edit((canvas) => {

					let ctx = canvas.getContext('2d');
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.rotate(Math.PI/2);
					ctx.drawImage(texture.img, 0, -canvas.height);

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
			let textures = getTextures();
			Undo.initEdit({textures, bitmap: true});
			textures.forEach(texture => {
				texture.edit((canvas) => {

					let ctx = canvas.getContext('2d');
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.rotate(-Math.PI/2);
					ctx.drawImage(texture.img, -canvas.width, 0);

				}, {no_undo: true});
			})
			Undo.finishEdit('Rotate texture counter-clockwise')
		}
	})
	new Action('resize_texture', {
		icon: 'photo_size_select_large',
		category: 'textures',
		condition: () => Texture.all.length,
		click() {
			let texture = Texture.getDefault();
			texture.resizeDialog();
		}
	})
})