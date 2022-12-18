let ColorPanel;

function colorDistance(color1, color2) {
	return Math.sqrt(
		Math.pow(color2._r - color1._r, 2) +
		Math.pow(color2._g - color1._g, 2) +
		Math.pow(color2._b - color1._b, 2)
	);
}
(function() {
//
StateMemory.init('color_palettes', 'array')

var palettes = {
	default: [
		'#1a1a1b','#353637','#464849','#5d5f60','#757677','#868788','#979b9d','#b8bdbe','#dadedf','#ffffff',
		'#9a080f','#b40a1a','#d21129','#ef2142','#ff5774','#bb7907','#cc9104','#edb508','#fcd720','#fef364',
		'#0d7e36','#12933d','#11aa38','#1cc93d','#29e64d','#044b8f','#0955a8','#126bc3','#1782db','#339afc',
		'#cd3e00','#e65b00','#f37800','#f89520','#fdaf40','#02a8c1','#0cc3ca','#17d1c7','#38debd','#5be9b7',
	],
	material: [
		'#ffebee','#ffcdd2','#ef9a9a','#e57373','#ef5350','#f44336','#e53935','#d32f2f','#c62828','#b71c1c','#ff5252','#ff1744',
		'#fce4ec','#f8bbd0','#f48fb1','#f06292','#ec407a','#e91e63','#d81b60','#c2185b','#ad1457','#880e4f','#ff4081','#f50057',
		'#f3e5f5','#e1bee7','#ce93d8','#ba68c8','#ab47bc','#9c27b0','#8e24aa','#7b1fa2','#6a1b9a','#4a148c','#e040fb','#d500f9',
		'#ede7f6','#d1c4e9','#b39ddb','#9575cd','#7e57c2','#673ab7','#5e35b1','#512da8','#4527a0','#311b92','#7c4dff','#651fff',
		'#e8eaf6','#c5cae9','#9fa8da','#7986cb','#5c6bc0','#3f51b5','#3949ab','#303f9f','#283593','#1a237e','#536dfe','#3d5afe',
		'#e3f2fd','#bbdefb','#90caf9','#64b5f6','#42a5f5','#2196f3','#1e88e5','#1976d2','#1565c0','#0d47a1','#448aff','#2979ff',
		'#e1f5fe','#b3e5fc','#81d4fa','#4fc3f7','#29b6f6','#03a9f4','#039be5','#0288d1','#0277bd','#01579b','#40c4ff','#00b0ff',
		'#e0f7fa','#b2ebf2','#80deea','#4dd0e1','#26c6da','#00bcd4','#00acc1','#0097a7','#00838f','#006064','#18ffff','#00e5ff',
		'#e0f2f1','#b2dfdb','#80cbc4','#4db6ac','#26a69a','#009688','#00897b','#00796b','#00695c','#004d40','#64ffda','#1de9b6',
		'#e8f5e9','#c8e6c9','#a5d6a7','#81c784','#66bb6a','#4caf50','#43a047','#388e3c','#2e7d32','#1b5e20','#69f0ae','#00e676',
		'#f1f8e9','#dcedc8','#c5e1a5','#aed581','#9ccc65','#8bc34a','#7cb342','#689f38','#558b2f','#33691e','#b2ff59','#76ff03',
		'#f9fbe7','#f0f4c3','#e6ee9c','#dce775','#d4e157','#cddc39','#c0ca33','#afb42b','#9e9d24','#827717','#eeff41','#c6ff00',
		'#fffde7','#fff9c4','#fff59d','#fff176','#ffee58','#ffeb3b','#fdd835','#fbc02d','#f9a825','#f57f17','#ffff00','#ffea00',
		'#fff8e1','#ffecb3','#ffe082','#ffd54f','#ffca28','#ffc107','#ffb300','#ffa000','#ff8f00','#ff6f00','#ffd740','#ffc400',
		'#fff3e0','#ffe0b2','#ffcc80','#ffb74d','#ffa726','#ff9800','#fb8c00','#f57c00','#ef6c00','#e65100','#ffab40','#ff9100',
		'#fbe9e7','#ffccbc','#ffab91','#ff8a65','#ff7043','#ff5722','#f4511e','#e64a19','#d84315','#bf360c','#ff6e40','#ff3d00',
		'#efebe9','#d7ccc8','#bcaaa4','#a1887f','#8d6e63','#795548','#6d4c41','#5d4037','#4e342e','#3e2723','#6d422d','#593022',
		'#fafafa','#f5f5f5','#eeeeee','#e0e0e0','#bdbdbd','#9e9e9e','#757575','#616161','#424242','#212121','#ffffff','#000000',
		'#eceff1','#cfd8dc','#b0bec5','#90a4ae','#78909c','#607d8b','#546e7a','#455a64','#37474f','#263238',
	],
	endesga64: [
		'#ff0040','#131313','#1b1b1b','#272727','#3d3d3d','#5d5d5d','#858585','#b4b4b4','#ffffff','#c7cfdd',
		'#92a1b9','#657392','#424c6e','#2a2f4e','#1a1932','#0e071b','#1c121c','#391f21','#5d2c28','#8a4836',
		'#bf6f4a','#e69c69','#f6ca9f','#f9e6cf','#edab50','#e07438','#c64524','#8e251d','#ff5000','#ed7614',
		'#ffa214','#ffc825','#ffeb57','#d3fc7e','#99e65f','#5ac54f','#33984b','#1e6f50','#134c4c','#0c2e44',
		'#00396d','#0069aa','#0098dc','#00cdf9','#0cf1ff','#94fdff','#fdd2ed','#f389f5','#db3ffd','#7a09fa',
		'#3003d9','#0c0293','#03193f','#3b1443','#622461','#93388f','#ca52c9','#c85086','#f68187','#f5555d',
		'#ea323c','#c42430','#891e2b','#571c27',
	]
}


Interface.definePanels(() => {
	var saved_colors = localStorage.getItem('colors');
	if (saved_colors) {
		try {
			saved_colors = JSON.parse(saved_colors);
		} catch (err) {
			saved_colors = null;
		}
	}
	StateMemory.init('color_picker_tab', 'string')

	ColorPanel = new Panel('color', {
		icon: 'palette',
		condition: {modes: ['paint']},
		default_position: {
			slot: 'right_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400
		},
		toolbars: {
			color_picker: Toolbars.color_picker,
			palette: Toolbars.palette
		},
		onResize() {
			Interface.Panels.color.vue.width = 0;
			Vue.nextTick(() => {
				let disp_before = this.vue.$refs.square_picker.style.display;
				this.vue.$refs.square_picker.style.display = 'none';
				let max = this.isInSidebar()
					? 1000
					: Math.min(1000, (this.height - this.vue.$el.clientHeight - this.handle.clientHeight) * (this.vue.picker_type == 'box' ? 1.25 : 1));
				Interface.Panels.color.vue.width = Math.clamp(this.width, 100, max);
				this.vue.$refs.square_picker.style.display = disp_before;
				Vue.nextTick(() => {
					$('#main_colorpicker').spectrum('reflow');
				})
			})
		},
		component: {
			data: {
				width: 100,
				open_tab: StateMemory.color_picker_tab || 'picker',
				picker_type: Settings.get('color_wheel') ? 'wheel' : 'box',
				picker_toggle_label: tl('panel.color.picker_type'),
				main_color: '#000000',
				hover_color: '',
				get color_code() {return this.hover_color || this.main_color},
				set color_code(color) {
					this.main_color = color.toLowerCase().replace(/[^a-f0-9#]/g, '');
				},
				text_input: '#000000',
				hsv: {
					h: 0,
					s: 0,
					v: 0,
				},
				palette: (saved_colors && saved_colors.palette instanceof Array) ? saved_colors.palette : palettes.default.slice(),
				history: (saved_colors && saved_colors.history instanceof Array) ? saved_colors.history : []
			},
			methods: {
				togglePickerType() {
					settings.color_wheel.set(!settings.color_wheel.value);
					Panels.color.onResize();
				},
				onMouseWheel(event) {
					if (!event.target) return;
					if (settings.color_wheel.value || event.target.classList.contains('sp-hue') || event.target.classList.contains('sp-slider')) {
						let sign = Math.sign(event.deltaY);
						if (event.shiftKey) sign *= 4;
						BarItems.slider_color_h.change(v => v+sign);
					}
				},
				sort(event) {
					var item = this.palette.splice(event.oldIndex, 1)[0];
					this.palette.splice(event.newIndex, 0, item);
				},
				drop(event) {
				},
				setColor(color) {
					ColorPanel.set(color);
				},
				validateMainColor() {
					var color = this.main_color;
					if (!color.match(/^#[0-9a-f]{6}$/)) {
						this.main_color = tinycolor(color).toHexString();
					}
				},
				isDarkColor(hex) {
					if (hex) {
						let color_val = new tinycolor(hex).getBrightness();
						let bg_val = new tinycolor(CustomTheme.data.colors.back).getBrightness();
						return Math.abs(color_val - bg_val) <= 50;
					}
				},
				tl
			},
			watch: {
				main_color: function(value) {
					this.hover_color = '';
					Object.assign(this.hsv, ColorPanel.hexToHsv(value));
					BarItems.slider_color_h.update();
					BarItems.slider_color_s.update();
					BarItems.slider_color_v.update();
					$('#main_colorpicker').spectrum('set', value);
					this.text_input = value;
				},
				open_tab(tab) {
					StateMemory.color_picker_tab = tab;
					StateMemory.save('color_picker_tab');
					Vue.nextTick(() => {
						ColorPanel.onResize()
					})
				}
			},
			template: `
				<div id="color_panel_wrapper" class="panel_inside">
					<div id="color_panel_head">
						<div class="main" v-bind:style="{'background-color': hover_color || main_color}"></div>
						<div class="side">
							<input type="text" v-model="color_code" @focusout="validateMainColor()">
							<div id="color_history">
								<li
									v-for="(color, i) in history" v-if="i || color != main_color"
									:key="color"
									v-bind:style="{'background-color': color}"
									v-bind:title="color" @click="setColor(color)"
								></li>
							</div>
						</div>
					</div>

					<div class="bar tabs_small">

						<input type="radio" name="tab" id="radio_color_picker" value="picker" v-model="open_tab">
						<label for="radio_color_picker">${tl('panel.color.picker')}</label>

						<input type="radio" name="tab" id="radio_color_palette" value="palette" v-model="open_tab">
						<label for="radio_color_palette">${tl('panel.color.palette')}</label>

						<input type="radio" name="tab" id="radio_color_both" value="both" v-model="open_tab">
						<label for="radio_color_both">${tl('panel.color.both')}</label>

						<div class="tool" @click="togglePickerType()" :title="picker_toggle_label">
							<i class="fa_big icon" :class="picker_type == 'box' ? 'fas fa-square' : 'far fa-stop-circle'"></i>
						</div>

					</div>
					<div v-show="open_tab == 'picker' || open_tab == 'both'" @mousewheel="onMouseWheel($event)">
						<div v-show="picker_type == 'box'" ref="square_picker" :style="{maxWidth: width + 'px'}">
							<input id="main_colorpicker">
						</div>
						<color-wheel v-if="picker_type == 'wheel' && width" v-model="main_color" :width="width" :height="width"></color-wheel>
						<div class="toolbar_wrapper color_picker" toolbar="color_picker"></div>
					</div>
					<div v-show="open_tab == 'palette' || open_tab == 'both'">
						<div class="toolbar_wrapper palette" toolbar="palette"></div>
						<ul id="palette_list" class="list mobile_scrollbar" v-sortable="{onUpdate: sort, onEnd: drop, fallbackTolerance: 10}" @contextmenu="ColorPanel.menu.open($event)">
							<li
								class="color" v-for="color in palette"
								:title="color" :key="color"
								:class="{selected: color == main_color, contrast: isDarkColor(color)}"
								@click="setColor(color)"
								@mouseenter="hover_color = color"
								@mouseleave="hover_color = ''"
							>
								<div class="color_inner" v-bind:style="{'background-color': color}"></div>
							</li>
						</ul>
					</div>
				</div>
			`,
			mounted() {
				Panels.color.picker = $(this.$el).find('#main_colorpicker').spectrum({
					preferredFormat: "hex",
					color: 'ffffff',
					flat: true,
					localStorageKey: 'brush_color_palette',
					move: function(c) {
						ColorPanel.change(c)
					}
				})
			}
		},
		menu: new Menu([
			'sort_palette',
			'save_palette',
			'load_palette'
		])
	})
	ColorPanel.updateFromHsv = function() {
		ColorPanel.change({
			h: ColorPanel.vue._data.hsv.h,
			s: ColorPanel.vue._data.hsv.s/100,
			v: ColorPanel.vue._data.hsv.v/100
		});
	}
	ColorPanel.hexToHsv = function(hex) {
		var color = new tinycolor(hex);
		var tc = color.toHsv();
		return {h: tc.h, s: tc.s*100, v: tc.v*100};
	}


	ColorPanel.palette = Interface.Panels.color.vue._data.palette;
	ColorPanel.addToHistory = function(color) {
		color = color.toLowerCase();
		var history = ColorPanel.vue._data.history;
		if (color == history[0]) return;

		if (color.match(/#[a-f0-9]{6}/g)) {
			var max = 18;
			history.remove(color);
			history.splice(0, 0, color);
			if (history.length > max) history.length = max;
			$('#color_history')[0].scrollLeft = 0;
			ColorPanel.saveLocalStorages();
		}
	}
	ColorPanel.change = function(color) {
		var value = new tinycolor(color)
		ColorPanel.vue._data.main_color = value.toHexString();
	}
	ColorPanel.set = function(color, no_sync) {
		ColorPanel.change(color)
		ColorPanel.addToHistory(ColorPanel.vue._data.main_color)
		if (!no_sync && isApp && settings.sync_color.value) {
			ipcRenderer.send('change-main-color', ColorPanel.vue._data.main_color);
		}
	}
	ColorPanel.get = function() {
		ColorPanel.addToHistory(ColorPanel.vue._data.main_color);
		return ColorPanel.vue._data.main_color;
	}
	ColorPanel.saveLocalStorages = function() {
		localStorage.setItem('colors', JSON.stringify({
			palette: ColorPanel.vue._data.palette,
			history: ColorPanel.vue._data.history,
		}))
	}

	$('#color_history').on('mousewheel', function(e) {
		var delta = (e.originalEvent.deltaY < 0 ? -90 : 90);
		this.scrollLeft += delta;
	})

	if (isApp) {
		ipcRenderer.on('set-main-color', (event, arg) => {
			ColorPanel.set(arg, true);
		})
	}	

	ColorPanel.importPalette = function(file) {

		let extension = pathToExtension(file.path);


		if (extension == 'png') {
			var img = new Image();
			img.src = file.content || file.path.replace(/#/g, '%23');
			img.onload = function() {
				var c = document.createElement('canvas');
				var ctx = c.getContext('2d');
				c.width = img.naturalWidth;
				c.height = img.naturalHeight;
				ctx.drawImage(img, 0, 0);
				ColorPanel.generatePalette(ctx, false);
			}
			return;
		}
		var colors = [];


		if (extension === 'ase') {
			let colorContents = file.content;
			let colorBuffer = Buffer.from(colorContents);
			let signature = colorBuffer.toString('utf-8', 0, 4);
			let versionMajor = colorBuffer.slice(4, 6).readInt16BE(0);
			let versionMin = colorBuffer.slice(6, 8).readInt16BE(0);
			let count = colorBuffer.slice(8, 12).readInt32BE(0);

			if (colorBuffer.length > 12 && signature !== 'ASEF' && versionMajor !== 1 && versionMin !== 0) {
				console.log('Invalid ASE swatch file');
				return;
			}

			let i = 12;
			while (i < colorBuffer.length) {

				let blockLength;
				let blockType = colorBuffer.slice(i, i + 2).readInt16BE(0).toString(16);
				i += 2;

				// Ignore group start c001, end c002
				if (blockType === 'c001') {
					blockLength = colorBuffer.slice(i, i + 4).readInt32BE(0);
					i += blockLength;
				}
				if (blockType === 'c002') {
					i += 2;
				}

				// Color entry, start 0001
				if (blockType === '1') {
					blockLength = colorBuffer.slice(i, i + 4).readInt32BE(0);
					let nameLength = colorBuffer.slice(i + 4, i + 6).readUInt16BE(0);
					let colorName = '';
					let color;
					for (let j = 0; j < nameLength * 2 - 2; j += 2) {
						colorName += String.fromCodePoint(colorBuffer.slice(i + 6 + j, i + 8 + j).readInt16BE(0));
					}
					let _i = i + 6 + nameLength * 2;
					let colorModel = colorBuffer.slice(_i, _i + 4).toString('utf-8', 0, 4);
					_i += 4;
					if (colorModel === 'RGB ') {
						let r = colorBuffer.slice(_i, _i + 4).readFloatBE(0);
						_i += 4;
						let g = colorBuffer.slice(_i, _i + 4).readFloatBE(0);
						_i += 4;
						let b = colorBuffer.slice(_i, _i + 4).readFloatBE(0);

						color = new tinycolor({r: r*255, g: g*255, b: b*255})
						//nscolor = color.colorWithRGBA(r * 255, g * 255, b * 255, 1.0);
					} else if (colorModel === 'CMYK') {
						let c = colorBuffer.slice(_i, _i + 4).readFloatBE(0);
						_i += 4;
						let m = colorBuffer.slice(_i, _i + 4).readFloatBE(0);
						_i += 4;
						let y = colorBuffer.slice(_i, _i + 4).readFloatBE(0);
						_i += 4;
						let k = colorBuffer.slice(_i, _i + 4).readFloatBE(0);
						//nscolor = color.colorWithCMYKA(c * 100, m * 100, y * 100, k * 100, 1.0);
						color = new tinycolor({
							r: 255 * (1 - c) * (1 - k),
							g: 255 * (1 - m) * (1 - k),
							b: 255 * (1 - y) * (1 - k)
						})

					} else if (colorModel === 'LAB ') {
						let l = colorBuffer.slice(_i, _i + 4).readFloatBE(0);
						_i += 4;
						let a = colorBuffer.slice(_i, _i + 4).readFloatBE(0);
						_i += 4;
						let b = colorBuffer.slice(_i, _i + 4).readFloatBE(0);
						//nscolor = color.colorWithLABA(l * 100, a * 100, b * 100, 1.0);
					} else if (colorModel === 'Gray') {
						let g = colorBuffer.slice(_i, _i + 4).readFloatBE(0);
						color = new tinycolor({r: g*255, g: g*255, b: g*255})
					}

					colors.push(color.toHexString());

					i += blockLength;
				}
			}
		} else if (extension === 'aco') {

			let colorContents = file.content;
			let colorBuffer = Buffer.from(colorContents);

			if (colorBuffer.length < 4) {
				UI.message('Invalid ACO file');
				return;
			}

			let version = colorBuffer.slice(0, 2).readUInt16BE(0);
			let count = colorBuffer.slice(2, 4).readUInt16BE(0);

			// version 1
			let i;
			if (version === 1 && (colorBuffer.length - 4) / 10 === count) {
				i = 4;
				while (i < colorBuffer.length) {
					let colorSpace = colorBuffer.slice(i, i + 2).readUInt16BE(0);
					let r = colorBuffer.slice(i + 2, i + 4).readUInt16BE(0);
					let g = colorBuffer.slice(i + 4, i + 6).readUInt16BE(0);
					let b = colorBuffer.slice(i + 6, i + 8).readUInt16BE(0);
					let z = colorBuffer.slice(i + 8, i + 10).readUInt16BE(0);

					if (colorSpace === 0) {
						let color = new tinycolor({
							r: Math.floor(r/255),
							g: Math.floor(g/255),
							b: Math.floor(b/255)
						})
						colors.push(color.toHexString());
					}
					i += 10;
				}
			}
			// version 2
			if (
				(version === 2) ||
				(
					version === 1 &&
					colorBuffer.length > count * 10 + 8 &&
					colorBuffer.slice(4 + count * 10, 6 + count * 10).readUInt16BE(0) === 2 &&
					colorBuffer.slice(6 + count * 10, 8 + count * 10).readUInt16BE(0) === count
				)
			) {
				i = 4 + count * 10 + 4;
				if (version === 2) {
					i = 4;
				}
				while (i < colorBuffer.length) {
					let colorSpace = colorBuffer.slice(i, i + 2).readUInt16BE(0);
					let r = colorBuffer.slice(i + 2, i + 4).readUInt16BE(0);
					let g = colorBuffer.slice(i + 4, i + 6).readUInt16BE(0);
					let b = colorBuffer.slice(i + 6, i + 8).readUInt16BE(0);
					let z = colorBuffer.slice(i + 8, i + 10).readUInt16BE(0);
					let colorName = '';
					let nameLength = colorBuffer.slice(i + 12, i + 14).readUInt16BE(0);
					/*for (let j = 0; j < nameLength * 2 - 2; j += 2) {
						colorName += String.fromCodePoint(colorBuffer.slice(i + 14 + j, i + 16 + j).readUInt16BE(0));
					}*/
					// colorspace: [0: RGB, 1: HSB (hsv), 2: CMYK, 7: Lab, 8: Gray]
					if (colorSpace === 0) {
						let color = new tinycolor({
							r: Math.floor(r/255),
							g: Math.floor(g/255),
							b: Math.floor(b/255)
						})
						colors.push(color.toHexString());
					}
					i += 14 + nameLength * 2;
				}
			}

		} else if (extension === 'act') {

			let colorContents = file.content;
			let colorBuffer = Buffer.from(colorContents);
			let maxLength = Math.min(colorBuffer.length, 768);
			if (colorBuffer.length === 772) {
				maxLength = colorBuffer[769]*3
			}

			for (var i = 0; i < maxLength; i += 3) {
				let color = new tinycolor({
					r: colorBuffer[i+0],
					g: colorBuffer[i+1],
					b: colorBuffer[i+2]
				})
				colors.push(color);
			}


		} else {

			var string = file.content;

			var m_hex = string.match(/(#|FF)?[a-fA-F0-9]{6}/g);
			if (m_hex) m_hex.forEach(color => {
				color = color.substr(-6).toLowerCase();
				colors.safePush('#'+color);
			})
			var m_rgb = string.match(/\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}\s*\)/g)
			if (m_rgb) m_rgb.forEach(color => {
				color = tinycolor('rgb'+color);
				colors.safePush(color.toHexString());
			})
			var m_gpl = string.match(/\n\s*\d{1,3}\s+\d{1,3}\s+\d{1,3}/g)
			if (m_gpl) m_gpl.forEach(color => {
				color = tinycolor(`rgb(${color.replace(/^[\n\s]*/, '').replace(/\s+/g, ',')})`);
				colors.safePush(color.toHexString());
			})
		}
		if (ColorPanel.palette.length) {
			var dialog = new Dialog({
				id: 'palette_import',
				title: 'action.import_palette',
				width: 400,
				form: {
					replace: {label: 'message.import_palette.replace_palette', type: 'checkbox', value: true},
				},
				onConfirm(formData) {
					if (formData.replace) {
						ColorPanel.palette.purge();
						ColorPanel.palette.push(...colors);
					} else {
						colors.forEach(color => {
							ColorPanel.palette.safePush(color);
						})
					}
					ColorPanel.saveLocalStorages();
					dialog.hide();
				}
			});
			dialog.show();
		} else {
			colors.forEach(color => {
				ColorPanel.palette.push(color);
			})
			ColorPanel.saveLocalStorages();
		}
	}
	ColorPanel.generatePalette = function(source, process_colors = true) {

		var options = {};
		if (!source) {
			Texture.all.forEach((tex, i) => {
				if (!tex.error) {
					options[i] = tex.name;
				}
			})
		}
		var dialog = new Dialog({
			id: 'generate_palette',
			title: 'action.import_palette',
			width: 460,
			form: {
				texture: {label: 'data.texture', type: 'select', options, condition: !source},
				replace: {label: 'message.import_palette.replace_palette', type: 'checkbox', value: true},
				threshold: {label: 'message.import_palette.threshold', type: 'number', value: 10, min: 0, max: 100, condition: process_colors},
			},
			onConfirm(formData) {
				var colors = {};
				var result_palette = [];

				if (!source) {
					var texture = Texture.all[formData.texture];
					var ctx = Painter.getCanvas(texture).getContext('2d');
				} else {
					var ctx = source;
				}
				Painter.scanCanvas(ctx, 0, 0, ctx.canvas.width, ctx.canvas.height, (x, y, px) => {
					if (px[3] < 12) return;
					var t = tinycolor({
						r: px[0],
						g: px[1],
						b: px[2]
					})
					var hex = t.toHexString();
					if (colors[hex]) {
						colors[hex].count++;
					} else {
						colors[hex] = t;
						t.count = 1;
					}
				})
				if (process_colors) {
					var pots = {gray:[], red:[], orange:[], yellow:[], green:[], blue:[], magenta:[]}
					for (var hex in colors) {
						var color = colors[hex];
						if (Math.abs(color._r - color._g) + Math.abs(color._g - color._b) + Math.abs(color._r - color._b) < 74) {
							//gray
							pots.gray.push(color);
						} else {
							var distances = {
								red: colorDistance(color, 	 {_r: 250, _g: 0, _b: 0}),
								orange: colorDistance(color, {_r: 240, _g: 127, _b: 0})*1.4,
								yellow: colorDistance(color, {_r: 265, _g: 240, _b: 0})*1.4,
								green: colorDistance(color,  {_r: 0, _g: 255, _b: 0}),
								blue: colorDistance(color, 	 {_r: 0, _g: 50, _b: 240}),
								magenta: colorDistance(color,{_r: 255, _g: 0, _b: 255})*1.4,
							}
							var closest = highestInObject(distances, true);
							pots[closest].push(color);
						}
					}
					for (var pot in pots) {
						pots[pot].sort((a, b) => {
							return (a._r + a._g + a._b) - (b._r + b._g + b._b);
						})
						if (pots[pot].length > 1) {
							for (var i = pots[pot].length-2; i >= 0; i--) {
								var col = pots[pot][i];
								var abv = pots[pot][i+1];
								var distance = colorDistance(col, abv);
								if (distance < formData.threshold) {
									if (col.count < col.count) {
										pots[pot].splice(i, 1);
									} else {
										pots[pot].splice(i+1, 1);
									}
								}
							}
						}
						pots[pot].forEach(color => {
							result_palette.push(color.toHexString());
						})
					}
				} else {
					for (var hex in colors) {
						result_palette.push(hex);
					}
				}
				
				if (formData.replace) {
					ColorPanel.palette.purge();
					ColorPanel.palette.push(...result_palette);
				} else {
					result_palette.forEach(color => {
						ColorPanel.palette.safePush(color);
					})
				}
				ColorPanel.saveLocalStorages();
				dialog.hide();
			}
		});
		dialog.show();
	}

	Blockbench.addDragHandler('palette', {
		extensions: ['gpl', 'css', 'txt', 'hex', 'png', 'aco', 'act', 'ase', 'bbpalette'],
		readtype: 'text',
		readtype: (path) => {
			switch (pathToExtension(path)) {
				case 'png': return 'image'; break;
				case 'ase': return 'binary'; break;
				case 'act': return 'binary'; break;
				case 'aco': return 'binary'; break;
				default: return 'text'; break;
			}},
		element: '#color',
		propagate: true,
	}, function(files) {
		if (files && files[0]) {
			ColorPanel.importPalette(files[0]);
		}
	})
	Toolbars.palette.toPlace();
	Toolbars.color_picker.toPlace();
})




BARS.defineActions(function() {

	new Action('add_to_palette', {
		icon: 'add',
		category: 'color',
		click: function () {
			var color = ColorPanel.get();
			if (!ColorPanel.palette.includes(color)) {
				ColorPanel.palette.push(color);
				ColorPanel.saveLocalStorages();
				Blockbench.showQuickMessage('message.add_to_palette');
			}
		}
	})
	new Action('import_palette', {
		icon: 'palette',
		category: 'color',
		click: function () {
			Blockbench.import({
				resource_id: 'palette',
				extensions: ['gpl', 'css', 'txt', 'hex', 'png', 'aco', 'act', 'ase', 'bbpalette'],
				type: 'Blockbench Palette',
				readtype: (path) => {
					switch (pathToExtension(path)) {
						case 'png': return 'image'; break;
						case 'ase': return 'binary'; break;
						case 'act': return 'binary'; break;
						case 'aco': return 'binary'; break;
						default: return 'text'; break;
					}},
			}, function(files) {
				if (files && files[0]) {
					ColorPanel.importPalette(files[0]);
				}
			})
		}
	})
	new Action('export_palette', {
		icon: 'fas.fa-dice-four',
		category: 'color',
		click: function () {
			let content = 'GIMP Palette\nName: Blockbench palette\nColumns: 10\n';
			ColorPanel.palette.forEach(color => {
				t = new tinycolor(color);
				content += `${t._r}\t${t._g}\t${t._b}\t${color}\n`;
			})
			Blockbench.export({
				resource_id: 'palette',
				extensions: ['gpl'],
				type: 'GPL Palette',
				content
			}, (path) => {
				Blockbench.showQuickMessage(tl('message.save_file', pathToName(path)));
			})
		}
	})
	new Action('generate_palette', {
		icon: 'blur_linear',
		category: 'color',
		click: function () {
			ColorPanel.generatePalette();
		}
	})
	new Action('sort_palette', {
		icon: 'fa-sort-amount-down',
		category: 'color',
		click: function () {
			var colors = {};

			ColorPanel.palette.forEach(color => {
				colors[color] = tinycolor(color);
			})
			ColorPanel.palette.empty();
			
			var pots = {gray:[], red:[], orange:[], yellow:[], green:[], blue:[], magenta:[]}
			for (var hex in colors) {
				var color = colors[hex];
				if (Math.abs(color._r - color._g) + Math.abs(color._g - color._b) + Math.abs(color._r - color._b) < 74) {
					//gray
					pots.gray.push(color);
				} else {
					var distances = {
						red: colorDistance(color, 	 {_r: 250, _g: 0, _b: 0}),
						orange: colorDistance(color, {_r: 240, _g: 127, _b: 0})*1.4,
						yellow: colorDistance(color, {_r: 265, _g: 240, _b: 0})*1.4,
						green: colorDistance(color,  {_r: 0, _g: 255, _b: 0}),
						blue: colorDistance(color, 	 {_r: 0, _g: 50, _b: 240}),
						magenta: colorDistance(color,{_r: 255, _g: 0, _b: 255})*1.4,
					}
					var closest = highestInObject(distances, true);
					pots[closest].push(color);
				}
			}
			for (var pot in pots) {
				pots[pot].sort((a, b) => {
					return (a._r + a._g + a._b) - (b._r + b._g + b._b);
				})
				pots[pot].forEach(color => {
					ColorPanel.palette.push(color.toHexString());
				})
			}
			ColorPanel.saveLocalStorages();
		}
	})

	function loadPalette(arr) {
		ColorPanel.palette.splice(0, Infinity, ...arr);
		ColorPanel.saveLocalStorages();
	}
	new Action('load_palette', {
		icon: 'fa-tasks',
		category: 'color',
		click: function (e) {
			new Menu(this.children()).open(e.target)
		},
		children() {
			let options = this.default_palettes.slice();

			StateMemory.color_palettes.forEach((palette, i) => {
				let option = {
					name: palette.name,
					icon: 'bubble_chart',
					id: i.toString(),
					click() {
						loadPalette(palette.colors);
					},
					children: [
						{icon: 'update', name: 'menu.palette.load.update', description: 'menu.palette.load.update.desc', click() {
							palette.colors.replace(ColorPanel.palette);
							StateMemory.save('color_palettes');
						}},
						{icon: 'delete', name: 'generic.delete', click() {
							StateMemory.color_palettes.remove(palette);
							StateMemory.save('color_palettes');
						}}
					]
				}
				options.push(option);
			})
			
			options.push(
				'_',
				{name: 'menu.palette.load.empty', icon: 'clear', id: 'empty', click: () => {
					loadPalette([]);
				}}
			);
			return options;
		}
	})
	BarItems.load_palette.default_palettes = [
		{name: 'menu.palette.load.default', icon: 'bubble_chart', id: 'default', click: () => {
			loadPalette(palettes.default);
		}},
		{name: 'Endesga 64', description: 'Pixel art palette created by lospec.com/endesga', icon: 'bubble_chart', id: 'endesga64', click: () => {
			loadPalette(palettes.endesga64);
		}},
		{name: 'Material', icon: 'bubble_chart', id: 'material', click: () => {
			loadPalette(palettes.material);
		}},
		'_'
	];

	new Action('save_palette', {
		icon: 'playlist_add',
		click(event) {	
			let dialog = new Dialog({
				id: 'save_palette',
				title: 'action.save_palette',
				width: 540,
				form: {
					name: {label: 'generic.name'},
				},
				onConfirm: function(formResult) {
					if (!formResult.name) return;
	
					let palette = {
						name: formResult.name,
						colors: ColorPanel.palette.slice()
					}

					StateMemory.color_palettes.push(palette);
					StateMemory.save('color_palettes');
				}
			})
			dialog.show()
		}
	})


	new NumSlider('slider_color_h', {
		condition: () => Modes.paint,
		category: 'color',
		settings: {
			min: 0, max: 360, default: 0, show_bar: true
		},
		getInterval(e) {
			if (e.shiftKey || Pressing.overrides.shift) return 12.5;
			if (e.ctrlOrCmd || Pressing.overrides.ctrl) return 1;
			return 4
		},
		get: function() {
			return Math.round(ColorPanel.vue._data.hsv.h);
		},
		change: function(modify) {
			var value = modify(ColorPanel.vue._data.hsv.h);
			ColorPanel.vue._data.hsv.h = Math.clamp(value, this.settings.min, this.settings.max);
			ColorPanel.updateFromHsv();
		}
	})
	new NumSlider('slider_color_s', {
		condition: () => Modes.paint,
		category: 'color',
		settings: {
			min: 0, max: 100, default: 0, show_bar: true
		},
		getInterval(e) {
			if (e.shiftKey || Pressing.overrides.shift) return 10;
			if (e.ctrlOrCmd || Pressing.overrides.ctrl) return 1;
			return 2
		},
		get: function() {
			return Math.round(ColorPanel.vue._data.hsv.s);
		},
		change: function(modify) {
			var value = modify(ColorPanel.vue._data.hsv.s);
			ColorPanel.vue._data.hsv.s = Math.clamp(value, this.settings.min, this.settings.max);
			ColorPanel.updateFromHsv();
		}
	})
	new NumSlider('slider_color_v', {
		condition: () => Modes.paint,
		category: 'color',
		settings: {
			min: 0, max: 100, default: 100, show_bar: true
		},
		getInterval(e) {
			if (e.shiftKey || Pressing.overrides.shift) return 10;
			if (e.ctrlOrCmd || Pressing.overrides.ctrl) return 1;
			return 2
		},
		get: function() {
			return Math.round(ColorPanel.vue._data.hsv.v);
		},
		change: function(modify) {
			var value = modify(ColorPanel.vue._data.hsv.v);
			ColorPanel.vue._data.hsv.v = Math.clamp(value, this.settings.min, this.settings.max);
			ColorPanel.updateFromHsv();
		}
	})
	let slider_vector_color = [BarItems.slider_color_h, BarItems.slider_color_s, BarItems.slider_color_v];
	slider_vector_color.forEach(slider => slider.slider_vector = slider_vector_color);

	new Action('pick_screen_color', {
		icon: 'colorize',
		category: 'color',
		condition: () => (typeof EyeDropper == 'function'),
		click: async function () {
			if (Blockbench.platform == 'win32') {
				// workaround for https://github.com/electron/electron/issues/27980
				ipcRenderer.send('request-color-picker', {sync: settings.sync_color.value});

			} else if (typeof EyeDropper == 'function') {
				let dropper = new EyeDropper();
				let {sRGBHex} = await dropper.open();
				ColorPanel.set(sRGBHex);
			}
		}
	})
})
})()
