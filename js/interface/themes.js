const CustomTheme = {
	data: {
		id: 'dark',
		name: '',
		author: '',
		main_font: '',
		headline_font: '',
		code_font: '',
		css: '',
		colors: {},
	},
	themes: [
		...CustomThemeOptions
	],
	defaultColors: {
		ui: '#282c34',
		back: '#21252b',
		dark: '#17191d',
		border: '#181a1f',
		selected: '#474d5d',
		button: '#3a3f4b',
		bright_ui: '#f4f3ff',
		accent: '#3e90ff',
		frame: '#181a1f',
		text: '#cacad4',
		light: '#f4f3ff',
		accent_text: '#000006',
		subtle_text: '#848891',
		grid: '#495061',
		wireframe: '#576f82',
		checkerboard: '#1c2026',
	},
	setup() {

		function saveChanges() {
			localStorage.setItem('theme', JSON.stringify(CustomTheme.data));
		}

		CustomTheme.dialog = new Dialog({
			id: 'theme',
			title: 'dialog.settings.theme',
			singleButton: true,
			width: 920,
			title_menu: new Menu([
				'settings_window',
				'keybindings_window',
				'theme_window',
				'about_window',
			]),
			sidebar: {
				pages: {
					select: tl('layout.select'),
					options: tl('layout.options'),
					color: tl('layout.color'),
					css: tl('layout.css'),
				},
				page: 'select',
				actions: [
					{
						name: 'layout.documentation',
						icon: 'fa-book',
						click() {

						}
					},
					'import_theme',
					'export_theme',
				],
				onPageSwitch(page) {
					CustomTheme.dialog.content_vue.open_category = page;
					if (page == 'color' && !CustomTheme.dialog_is_setup) {
						CustomTheme.setupDialog()
					}
				}
			},
			component: {
				data: {
					data: CustomTheme.data,
					open_category: 'select',
					themes: CustomTheme.themes
				},
				components: {
					VuePrismEditor
				},
				watch: {
					'data.main_font'() {
						CustomTheme.updateSettings();
						saveChanges();
					},
					'data.headline_font'() {
						CustomTheme.updateSettings();
						saveChanges();
					},
					'data.code_font'() {
						CustomTheme.updateSettings();
						saveChanges();
					},
					'data.css'() {
						CustomTheme.updateSettings();
						saveChanges();
					},
					'data.colors': {
						handler() {
							CustomTheme.updateColors();
							saveChanges();
						},
						deep: true
					},
	
				},
				methods: {
					selectTheme(theme) {
						CustomTheme.loadTheme(theme);
					},
					getThemeThumbnailStyle(theme) {
						let style = {};
						for (let key in theme.colors) {
							style[`--color-${key}`] = theme.colors[key];
						}
						return style;
					}
				},
				template: `
					<div id="theme_editor">
						<div v-if="open_category == 'select'">
							<h2 class="i_b">${tl('layout.select')}</h2>

							<div id="theme_list">
								<div v-for="theme in themes" :key="theme.id" class="theme" :class="{selected: theme.id == data.id}" @click="selectTheme(theme)" :style="getThemeThumbnailStyle(theme)">
									<div class="theme_preview"></div>
									<div class="theme_name">{{ theme.name }}</div>
									<div class="theme_author">{{ theme.author || 'Default' }}</div>
								</div>
							</div>
						</div>
						<div v-show="open_category == 'color'">
							<h2 class="i_b">${tl('layout.color')}</h2>
							<div id="color_wrapper">
								<div class="color_field" v-for="(color, key) in data.colors" :id="'color_field_' + key">
									<div class="layout_color_preview color_input" :style="{'background-color': color}"></div>
									<div class="desc">
										<h4>{{ tl('layout.color.'+key) }}</h4>
										<p>{{ tl('layout.color.'+key+'.desc') }}</p>
									</div>
								</div>
							</div>
						</div>
	
						<div v-if="open_category == 'options'">
							<h2 class="i_b">${tl('layout.options')}</h2>

							<div class="dialog_bar">
								<label class="name_space_left" for="layout_name">${tl('layout.name')}</label>
								<input type="text" class="half dark_bordered" id="layout_name" v-model="data.name">
							</div>

							<div class="dialog_bar">
								<label class="name_space_left" for="layout_name">${tl('layout.author')}</label>
								<input type="text" class="half dark_bordered" id="layout_name" v-model="data.author">
							</div>

							<hr />

							<div class="dialog_bar">
								<label class="name_space_left" for="layout_font_main">${tl('layout.font.main')}</label>
								<input style="font-family: var(--font-main)" type="text" class="half dark_bordered" id="layout_font_main" v-model="data.main_font">
							</div>
	
							<div class="dialog_bar">
								<label class="name_space_left" for="layout_font_headline">${tl('layout.font.headline')}</label>
								<input style="font-family: var(--font-headline)" type="text" class="half dark_bordered" id="layout_font_headline" v-model="data.headline_font">
							</div>
							<div class="dialog_bar">
								<label class="name_space_left" for="layout_font_cpde">${tl('layout.font.code')}</label>
								<input style="font-family: var(--font-code)" type="text" class="half dark_bordered" id="layout_font_cpde" v-model="data.code_font">
							</div>
						</div>
						
						<div v-if="open_category == 'css'">
							<h2 class="i_b">${tl('layout.css')}</h2>
							<div id="css_editor">
								<vue-prism-editor v-model="data.css" language="css" :line-numbers="true" />
							</div>
	
						</div>
	
					</div>`
			},
			onButton() {
				Settings.save();
			}
		})
	},
	setupDialog() {
		var wrapper = $('#color_wrapper');
		for (var key in CustomTheme.defaultColors) {
			(() => {
				var scope_key = key;
				var hex = CustomTheme.data.colors[scope_key];
				var last_color = hex;
				var field = wrapper.find(`#color_field_${scope_key} .layout_color_preview`);

				field.spectrum({
					preferredFormat: "hex",
					color: hex,
					showAlpha: false,
					showInput: true,
					defaultColor: CustomTheme.defaultColors[key],
					resetText: tl('generic.reset'),
					cancelText: tl('dialog.cancel'),
					chooseText: tl('dialog.confirm'),
					move(c) {
						CustomTheme.data.colors[scope_key] = c.toHexString();
					},
					change(c) {
						last_color = c.toHexString();
					},
					hide(c) {
						CustomTheme.data.colors[scope_key] = last_color;
						field.spectrum('set', last_color);
					},
					beforeShow(a, b) {
						last_color = CustomTheme.data.colors[scope_key];
						field.spectrum('set', last_color);
					}
				});
			})()
		}
		CustomTheme.dialog_is_setup = true;
	},
	updateColors() {
		
		for (var key in CustomTheme.data.colors) {
			var hex = CustomTheme.data.colors[key];
			document.body.style.setProperty('--color-'+key, hex);
		}
		$('meta[name=theme-color]').attr('content', CustomTheme.data.colors.frame);

		if (typeof gizmo_colors != 'undefined') {
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
		}
	},
	updateSettings() {
		document.body.style.setProperty('--font-custom-main', CustomTheme.data.main_font);
		document.body.style.setProperty('--font-custom-headline', CustomTheme.data.headline_font);
		document.body.style.setProperty('--font-custom-code', CustomTheme.data.code_font);
		$('style#theme_css').text(CustomTheme.data.css);
	},
	loadTheme(theme) {
		var app = CustomTheme.data;
		Merge.string(app, theme, 'id')
		Merge.string(app, theme, 'name')
		Merge.string(app, theme, 'author')
		Merge.string(app, theme, 'main_font')
		Merge.string(app, theme, 'headline_font')
		Merge.string(app, theme, 'code_font')
		for (var key in app.colors) {
			Merge.string(app.colors, theme.colors, key);
		}
		Merge.string(app, theme, 'css');
		this.updateColors();
		this.updateSettings();
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
				CustomTheme.loadTheme(data);
			}
		}
	}
};

(function() {

	var stored_theme = 0;
	try {
		if (localStorage.getItem('theme')) {
			stored_theme = JSON.parse(localStorage.getItem('theme'))
		}
	} catch (err) {}

	for (var key in CustomTheme.defaultColors) {
		CustomTheme.data.colors[key] = CustomTheme.defaultColors[key];
	}
	if (stored_theme) {
		CustomTheme.loadTheme(stored_theme);
	}
})()


BARS.defineActions(function() {
	new Action('theme_window', {
		name: tl('dialog.settings.theme') + '...',
		icon: 'style',
		category: 'blockbench',
		click: function () {
			CustomTheme.dialog.show();
		}
	})
	new Action('import_theme', {
		icon: 'folder',
		category: 'blockbench',
		click: function () {
			Blockbench.import({
				resource_id: 'config',
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
				resource_id: 'config',
				type: 'Blockbench Theme',
				extensions: ['bbtheme'],
				content: compileJSON(CustomTheme.data)
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



