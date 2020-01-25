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
			'#339afc'
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
					ColorPanel.palette.purge();
					ColorPanel.palette.push(...palettes.default);
				}}
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

		if (pathToExtension(file.path) == 'png') {
			var img = new Image(file.content);
			img.src = file.content || file.path;
			img.onload = function() {
				var c = document.createElement('canvas');
				var ctx = c.getContext('2d');
				c.width = img.naturalWidth;
				c.height = img.naturalHeight;
				ctx.drawImage(img, 0, 0);
				ColorPanel.generatePalette(ctx);
			}
			return;
		}
		var string = file.content;

		var colors = [];
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
	}
	ColorPanel.generatePalette = function(source) {

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
				threshold: {label: 'message.import_palette.threshold', type: 'number', value: 10, min: 0, max: 100},
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
		extensions: ['bbpalette', 'css', 'txt', 'gpl', 'hex', 'png'],
		readtype: 'text',
		readtype: (path) => (pathToExtension(path) == 'png' ? 'image' : 'text'),
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
				extensions: ['bbpalette', 'css', 'txt', 'gpl', 'hex', 'png'],
				type: 'Blockbench Palette',
				readtype: (path) => (pathToExtension(path) == 'png' ? 'image' : 'text'),
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
			Blockbench.export({
				extensions: ['bbpalette'],
				type: 'Blockbench Palette',
				content: ColorPanel.palette.join('\n')
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