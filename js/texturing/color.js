function colorDistance(color1, color2) {
	return Math.sqrt(
		Math.pow(color2._r - color1._r, 2) +
		Math.pow(color2._g - color1._g, 2) +
		Math.pow(color2._b - color1._b, 2)
	);
}

onVueSetup(() => {
	var palettes = {
		default: [
			'#1a1a1b',
			'#353637',
			'#464849',
			'#5d5f60',
			'#757677',
			'#868788',
			'#979b9d',
			'#b8bdbe',
			'#dadedf',
			'#ffffff',
			'#9a080f',
			'#b40a1a',
			'#d21129',
			'#ef2142',
			'#ff5774',
			'#bb7907',
			'#cc9104',
			'#edb508',
			'#fcd720',
			'#fef364',
			'#0d7e36',
			'#12933d',
			'#11aa38',
			'#1cc93d',
			'#29e64d',
			'#044b8f',
			'#0955a8',
			'#126bc3',
			'#1782db',
			'#339afc',
			'#cd3e00',
			'#e65b00',
			'#f37800',
			'#f89520',
			'#fdaf40',
			'#02a8c1',
			'#0cc3ca',
			'#17d1c7',
			'#38debd',
			'#5be9b7',
		],
		material: [
			'#FFEBEE',
			'#FFCDD2',
			'#EF9A9A',
			'#E57373',
			'#EF5350',
			'#F44336',
			'#E53935',
			'#D32F2F',
			'#C62828',
			'#B71C1C',
			'#FCE4EC',
			'#F8BBD0',
			'#F48FB1',
			'#F06292',
			'#EC407A',
			'#E91E63',
			'#D81B60',
			'#C2185B',
			'#AD1457',
			'#880E4F',
			'#F3E5F5',
			'#E1BEE7',
			'#CE93D8',
			'#BA68C8',
			'#AB47BC',
			'#9C27B0',
			'#8E24AA',
			'#7B1FA2',
			'#6A1B9A',
			'#4A148C',
			'#EDE7F6',
			'#D1C4E9',
			'#B39DDB',
			'#9575CD',
			'#7E57C2',
			'#673AB7',
			'#5E35B1',
			'#512DA8',
			'#4527A0',
			'#311B92',
			'#E8EAF6',
			'#C5CAE9',
			'#9FA8DA',
			'#7986CB',
			'#5C6BC0',
			'#3F51B5',
			'#3949AB',
			'#303F9F',
			'#283593',
			'#1A237E',
			'#E3F2FD',
			'#BBDEFB',
			'#90CAF9',
			'#64B5F6',
			'#42A5F5',
			'#2196F3',
			'#1E88E5',
			'#1976D2',
			'#1565C0',
			'#0D47A1',
			'#E1F5FE',
			'#B3E5FC',
			'#81D4FA',
			'#4FC3F7',
			'#29B6F6',
			'#03A9F4',
			'#039BE5',
			'#0288D1',
			'#0277BD',
			'#01579B',
			'#E0F7FA',
			'#B2EBF2',
			'#80DEEA',
			'#4DD0E1',
			'#26C6DA',
			'#00BCD4',
			'#00ACC1',
			'#0097A7',
			'#00838F',
			'#006064',
			'#E0F2F1',
			'#B2DFDB',
			'#80CBC4',
			'#4DB6AC',
			'#26A69A',
			'#009688',
			'#00897B',
			'#00796B',
			'#00695C',
			'#004D40',
			'#E8F5E9',
			'#C8E6C9',
			'#A5D6A7',
			'#81C784',
			'#66BB6A',
			'#4CAF50',
			'#43A047',
			'#388E3C',
			'#2E7D32',
			'#1B5E20',
			'#F1F8E9',
			'#DCEDC8',
			'#C5E1A5',
			'#AED581',
			'#9CCC65',
			'#8BC34A',
			'#7CB342',
			'#689F38',
			'#558B2F',
			'#33691E',
			'#F9FBE7',
			'#F0F4C3',
			'#E6EE9C',
			'#DCE775',
			'#D4E157',
			'#CDDC39',
			'#C0CA33',
			'#AFB42B',
			'#9E9D24',
			'#827717',
			'#FFFDE7',
			'#FFF9C4',
			'#FFF59D',
			'#FFF176',
			'#FFEE58',
			'#FFEB3B',
			'#FDD835',
			'#FBC02D',
			'#F9A825',
			'#F57F17',
			'#FFF8E1',
			'#FFECB3',
			'#FFE082',
			'#FFD54F',
			'#FFCA28',
			'#FFC107',
			'#FFB300',
			'#FFA000',
			'#FF8F00',
			'#FF6F00',
			'#FFF3E0',
			'#FFE0B2',
			'#FFCC80',
			'#FFB74D',
			'#FFA726',
			'#FF9800',
			'#FB8C00',
			'#F57C00',
			'#EF6C00',
			'#E65100',
			'#FBE9E7',
			'#FFCCBC',
			'#FFAB91',
			'#FF8A65',
			'#FF7043',
			'#FF5722',
			'#F4511E',
			'#E64A19',
			'#D84315',
			'#BF360C',
			'#EFEBE9',
			'#D7CCC8',
			'#BCAAA4',
			'#A1887F',
			'#8D6E63',
			'#795548',
			'#6D4C41',
			'#5D4037',
			'#4E342E',
			'#3E2723',
			'#FAFAFA',
			'#F5F5F5',
			'#EEEEEE',
			'#E0E0E0',
			'#BDBDBD',
			'#9E9E9E',
			'#757575',
			'#616161',
			'#424242',
			'#212121',
			'#ECEFF1',
			'#CFD8DC',
			'#B0BEC5',
			'#90A4AE',
			'#78909C',
			'#607D8B',
			'#546E7A',
			'#455A64',
			'#37474F',
			'#263238',
		],
		endesga64: [
			'#ff0040',
			'#131313',
			'#1b1b1b',
			'#272727',
			'#3d3d3d',
			'#5d5d5d',
			'#858585',
			'#b4b4b4',
			'#ffffff',
			'#c7cfdd',
			'#92a1b9',
			'#657392',
			'#424c6e',
			'#2a2f4e',
			'#1a1932',
			'#0e071b',
			'#1c121c',
			'#391f21',
			'#5d2c28',
			'#8a4836',
			'#bf6f4a',
			'#e69c69',
			'#f6ca9f',
			'#f9e6cf',
			'#edab50',
			'#e07438',
			'#c64524',
			'#8e251d',
			'#ff5000',
			'#ed7614',
			'#ffa214',
			'#ffc825',
			'#ffeb57',
			'#d3fc7e',
			'#99e65f',
			'#5ac54f',
			'#33984b',
			'#1e6f50',
			'#134c4c',
			'#0c2e44',
			'#00396d',
			'#0069aa',
			'#0098dc',
			'#00cdf9',
			'#0cf1ff',
			'#94fdff',
			'#fdd2ed',
			'#f389f5',
			'#db3ffd',
			'#7a09fa',
			'#3003d9',
			'#0c0293',
			'#03193f',
			'#3b1443',
			'#622461',
			'#93388f',
			'#ca52c9',
			'#c85086',
			'#f68187',
			'#f5555d',
			'#ea323c',
			'#c42430',
			'#891e2b',
			'#571c27',
		]
	}
	ColorPanel = Interface.Panels.color = new Panel({
		id: 'color',
		condition: () => Modes.id === 'paint',
		toolbars: {
			picker: Toolbars.color_picker,
			palette: Toolbars.palette
		},
		onResize: t => {
			$('#main_colorpicker').spectrum('reflow');
		},
		menu: new Menu([
			'sort_palette',
			'clear_palette',
			{name: 'menu.palette.load', id: 'load', icon: 'fa-tasks', children: [
				{name: 'menu.palette.load.default', icon: 'bubble_chart', id: 'default', click: () => {
					ColorPanel.palette.splice(0, Infinity, ...palettes.default);
				}},
				{name: 'Endesga 64', description: 'Pixel art palette created by lospec.com/endesga', icon: 'bubble_chart', id: 'endesga64', click: () => {
					ColorPanel.palette.splice(0, Infinity, ...palettes.endesga64);
				}},
				{name: 'Material', icon: 'bubble_chart', id: 'material', click: () => {
					ColorPanel.palette.splice(0, Infinity, ...palettes.material);
				}},
			]}
		])
	})
	var saved_colors = localStorage.getItem('colors');
	if (saved_colors) {
		try {
			saved_colors = JSON.parse(saved_colors);
		} catch (err) {
			saved_colors = null;
		}
	}
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
	Interface.Panels.color.vue = new Vue({
		el: '#color_panel_wrapper',
		data: {
			open_tab: 'picker',
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
			sort(event) {
				var index = event.oldIndex;
				var item = this.palette.splice(event.oldIndex, 1)[0];
				this.palette.splice(event.newIndex, 0, item);
			},
			drop: function(event) {
				/*
				var scope = this;
				setTimeout(() => {
					if ($('#palette_list:hover').length === 0) {
						scope.palette.splice(event.oldIndex, 1)[0]
					}
				}, 30)
				*/
			},
			setColor(color) {
				ColorPanel.set(color);
			},
			validateMainColor() {
				var color = this.main_color;
				if (!color.match(/^#[0-9a-f]{6}$/)) {
					this.main_color = tinycolor(color).toHexString();
				}
			}
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
			}
		}
	})


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
		}
	}
	ColorPanel.change = function(color) {
		var value = new tinycolor(color)
		ColorPanel.vue._data.main_color = value.toHexString();
	}
	ColorPanel.set = function(color) {
		ColorPanel.change(color)
		ColorPanel.addToHistory(ColorPanel.vue._data.main_color)
	}
	ColorPanel.get = function() {
		ColorPanel.addToHistory(ColorPanel.vue._data.main_color);
		return ColorPanel.vue._data.main_color;
	}
	Interface.Panels.color.picker = $('#main_colorpicker').spectrum({
		preferredFormat: "hex",
		color: 'ffffff',
		flat: true,
		localStorageKey: 'brush_color_palette',
		move: function(c) {
			ColorPanel.change(c)
		}
	})

	$('#color_history').on('mousewheel', function(e) {
		var current = this.scrollLeft;
		var delta = (e.originalEvent.deltaY < 0 ? -90 : 90);
		this.scrollLeft += delta;

		//$(this).animate({scrollLeft: current + delta}, 200)
	})

	ColorPanel.importPalette = function(file) {

		let extension = pathToExtension(file.path);


		if (extension == 'png') {
			var img = new Image(file.content);
			img.src = file.content || file.path;
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
			var m_gpl = string.match(/\n\d{1,3} \d{1,3} \d{1,3}/g)
			if (m_gpl) m_gpl.forEach(color => {
				color = tinycolor(`rgb(${color.substr(1).replace(/ /g, ',')})`);
				colors.safePush(color.toHexString());
			})
			var m_gpl = string.match(/\n\d{1,3} \d{1,3} \d{1,3}/g)
			if (m_gpl) m_gpl.forEach(color => {
				color = tinycolor(`rgb(${color.substr(1).replace(/ /g, ',')})`);
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
					dialog.hide();
				}
			});
			dialog.show();
		} else {
			colors.forEach(color => {
				ColorPanel.palette.push(color);
			})
		}
	}
	ColorPanel.generatePalette = function(source, process_colors = true) {

		var options = {};
		if (!source) {
			textures.forEach((tex, i) => {
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
					var texture = textures[formData.texture];
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
				Blockbench.showQuickMessage('message.add_to_palette')
			}
		}
	})
	new Action('import_palette', {
		icon: 'palette',
		category: 'color',
		click: function () {
			Blockbench.import({
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
		}
	})
	new Action('clear_palette', {
		icon: 'clear',
		category: 'color',
		click: function () {
			ColorPanel.palette.purge();
		}
	})


	new NumSlider('slider_color_h', {
		condition: () => Modes.paint,
		category: 'color',
		settings: {
			min: 0, max: 360, default: 0,
		},
		getInterval(e) {
			if (e.shiftKey) return 12.5;
			if (e.ctrlKey) return 1;
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
			min: 0, max: 100, default: 0,
		},
		getInterval(e) {
			if (e.shiftKey) return 10;
			if (e.ctrlKey) return 1;
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
			min: 0, max: 100, default: 100,
		},
		getInterval(e) {
			if (e.shiftKey) return 10;
			if (e.ctrlKey) return 1;
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
})