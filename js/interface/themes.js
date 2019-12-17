const CustomTheme = {
	data: {
		main_font: '',
		headline_font: '',
		code_font: '',
		css: '',
		colors: {}
	},
	defaultColors: {
		ui: '#282c34',
		back: '#21252b',
		dark: '#17191d',
		border: '#181a1f',
		selected: '#3c4456',
		button: '#3a3f4b',
		bright_ui: '#f4f3ff',
		accent: '#3e90ff',
		text: '#cacad4',
		light: '#f4f3ff',
		accent_text: '#000006',
		grid: '#495061',
		wireframe: '#576f82',
		checkerboard: '#2f3339',
	},
	setup() {

		for (var key in CustomTheme.defaultColors) {
			CustomTheme.data.colors[key] = CustomTheme.defaultColors[key];
		}

		function saveChanges() {
			localStorage.setItem('theme', JSON.stringify(CustomTheme.data));
		}

		CustomTheme.vue = new Vue({
			el: '#theme_editor',
			data: CustomTheme.data,
			components: {
			    VuePrismEditor
			},
			watch: {
				main_font() {
					document.body.style.setProperty('--font-custom-main', CustomTheme.data.main_font);
					saveChanges();
				},
				headline_font() {
					document.body.style.setProperty('--font-custom-headline', CustomTheme.data.headline_font);
					saveChanges();
				},
				code_font() {
					document.body.style.setProperty('--font-custom-code', CustomTheme.data.code_font);
					saveChanges();
				},
				css() {
					$('style#theme_css').text(CustomTheme.data.css);
					saveChanges();
				},
				colors: {
					handler() {
						for (var key in CustomTheme.data.colors) {
							var hex = CustomTheme.data.colors[key];
							document.body.style.setProperty('--color-'+key, hex);
						}
						$('meta[name=theme-color]').attr('content', CustomTheme.data.colors.border);

						var c_outline = parseInt('0x'+CustomTheme.data.colors.accent.replace('#', ''))
						if (c_outline !== gizmo_colors.outline.getHex()) {
							gizmo_colors.outline.set(c_outline)
							Canvas.outlineMaterial.color = gizmo_colors.outline
						}
						var c_wire = parseInt('0x'+CustomTheme.data.colors.wireframe.replace('#', ''))
						if (c_wire !== gizmo_colors.wire.getHex()) {
							gizmo_colors.wire.set(c_wire);
							Canvas.wireframeMaterial.color = gizmo_colors.wire;
						}

						var c_grid = parseInt('0x'+CustomTheme.data.colors.grid.replace('#', ''))
						if (c_grid !== gizmo_colors.grid.getHex()) {
							gizmo_colors.grid.set(c_grid);
							three_grid.children.forEach(c => {
								if (c.name === 'grid' && c.material) {
									c.material.color = gizmo_colors.grid;
								}
							})
						}

						saveChanges();
					},
					deep: true
				},

			}
		})
		Vue.nextTick(function() {
			CustomTheme.fetchFromStorage();

			var wrapper = $('#color_wrapper');
			for (var key in CustomTheme.defaultColors) {
				(() => {
					var scope_key = key;
					var hex = CustomTheme.data.colors[scope_key];
					var last_color = hex;
					var field = wrapper.find('#color_field_'+scope_key);

					field.spectrum({
						preferredFormat: "hex",
						color: hex,
						showAlpha: false,
						showInput: true,
						move(c) {
							CustomTheme.data.colors[scope_key] = c.toHexString();
						},
						change(c) {
							last_color = c.toHexString();
						},
						hide(c) {
							CustomTheme.data.colors[scope_key] = last_color;
							field.spectrum('set', last_color);
						}
					});
				})()
			}
		})
	},
	fetchFromStorage() {
		var legacy_colors = 0;
		var stored_theme = 0;
		try {
			if (localStorage.getItem('theme')) {
				stored_theme = JSON.parse(localStorage.getItem('theme'))
			}
			if (localStorage.getItem('app_colors')) {
				legacy_colors = JSON.parse(localStorage.getItem('app_colors'))
			}
		} catch (err) {}

		if (stored_theme) {
			for (var key in CustomTheme.data) {
				if (stored_theme[key] && typeof CustomTheme.data[key] !== 'object') {
					CustomTheme.data[key] = stored_theme[key];
				}
			}
		} else if (legacy_colors) {
			if (legacy_colors.main) {
				CustomTheme.data.main_font = legacy_colors.main.font;
			}
			if (legacy_colors.headline) {
				CustomTheme.data.headline_font = legacy_colors.headline.font;
			}
			if (legacy_colors.css) {
				CustomTheme.data.css = legacy_colors.css;
			}
		}
		for (var key in CustomTheme.defaultColors) {
			if (stored_theme && stored_theme.colors[key]) {
				CustomTheme.data.colors[key] = stored_theme.colors[key];
			} else if (legacy_colors && legacy_colors[key] && legacy_colors[key].hex) {
				CustomTheme.data.colors[key] = legacy_colors[key].hex;
			}
		}
	},
	import(file) {
		var data = JSON.parse(file.content)
		var app = CustomTheme.data;
		if (pathToExtension(file.path) == 'bbstyle') {
			//legacy import
			if (data.main) app.main_font = data.main.font;
			if (data.headline) app.headline_font = data.headline.font;
			if (data.css) app.css = data.css;
			for (var key in app.colors) {
				if (data[key] && data[key].hex) {
					app.colors[key] = data[key].hex;
				}
			}
			if (data.text_acc) {
				app.colors.accent_text = data.text_acc
			}

		} else {
			if (data && data.colors) {
				Merge.string(app, data, 'main_font')
				Merge.string(app, data, 'headline_font')
				Merge.string(app, data, 'code_font')
				for (var key in app.colors) {
					Merge.string(app.colors, data.colors, key);
				}
				Merge.string(app, data, 'css')
			}
		}
	}
}


BARS.defineActions(function() {
	new Action('import_theme', {
		icon: 'folder',
		category: 'blockbench',
		click: function () {
			Blockbench.import({
				extensions: ['bbstyle', 'bbtheme'],
				type: 'Blockbench Theme'
			}, function(files) {
				CustomTheme.import(files[0]);
			})
		}
	})
	new Action('export_theme', {
		icon: 'style',
		category: 'blockbench',
		click: function () {
			Blockbench.export({
				type: 'Blockbench Theme',
				extensions: ['bbtheme'],
				content: autoStringify(CustomTheme.data)
			})
		}
	})
	new Action('reset_theme', {
		icon: 'replay',
		category: 'blockbench',
		click() {
			var app = CustomTheme.data;
			app.main_font = '';
			app.headline_font = '';
			app.code_font = '';
			app.css = '';
			for (var key in app.colors) {
				Merge.string(app.colors, CustomTheme.defaultColors, key);
			}
		}
	})
	//Only interface
	new Action('reset_layout', {
		icon: 'replay',
		category: 'blockbench',
		click: function () {
			Interface.data = $.extend(true, {}, Interface.default_data)
			Interface.data.left_bar.forEach((id) => {
				$('#left_bar').append(Interface.Panels[id].node)
			})
			Interface.data.right_bar.forEach((id) => {
				$('#right_bar').append(Interface.Panels[id].node)
			})
			updateInterface()
		}
	})
	BarItems.import_theme.toElement('#layout_title_bar')
	BarItems.export_theme.toElement('#layout_title_bar')
	BarItems.reset_theme.toElement('#layout_title_bar')
})