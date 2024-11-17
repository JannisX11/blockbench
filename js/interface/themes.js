const CustomTheme = {
	data: {
		id: 'dark',
		name: '',
		author: '',
		customized: false,
		borders: false,
		main_font: '',
		headline_font: '',
		code_font: '',
		css: '',
		thumbnail: '',
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
		bright_ui_text: '#000006',
		subtle_text: '#848891',
		grid: '#495061',
		wireframe: '#576f82',
		checkerboard: '#1c2026',
	},
	sideloaded_themes: [],
	setup() {

		function saveChanges() {
			localStorage.setItem('theme', JSON.stringify(CustomTheme.data));
		}
		if (isApp && localStorage.getItem('themes_sideloaded')) {
			try {
				let sideloaded = JSON.parse(localStorage.getItem('themes_sideloaded'));
				if (sideloaded instanceof Array && sideloaded.length) {
					CustomTheme.sideloaded_themes = sideloaded;
					CustomTheme.sideloaded_themes.forEachReverse(path => {
						if (!fs.existsSync(path)) {
							CustomTheme.sideloaded_themes.remove(path);
						}
					})
					localStorage.setItem('themes_sideloaded', JSON.stringify(CustomTheme.sideloaded_themes));
					Blockbench.read(CustomTheme.sideloaded_themes, {errorbox: false}, files => {
						files.forEach(file => {
							let data = JSON.parse(file.content);
							data.id = file.name.replace(/\.\w+$/, '');
							if (!data.name) data.name = data.id;
							data.sideloaded = true;
							data.source = 'file';
							data.path = file.path;
							CustomTheme.themes.push(data);

						})
					})
				}
			} catch (err) {}

			CustomTheme.loadThumbnailStyles();
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
					thumbnail: tl('layout.thumbnail'),
				},
				page: 'select',
				actions: [
					{
						name: 'layout.documentation',
						icon: 'fa-book',
						click() {
							Blockbench.openLink('https://www.blockbench.net/wiki/blockbench/themes');
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
			onOpen() {
				if (!CustomTheme.remote_themes_loaded) {
					CustomTheme.remote_themes_loaded = true;
					$.getJSON('https://api.github.com/repos/JannisX11/blockbench-themes/contents/themes').then(files => {
						files.forEach(async file => {
							try {
								let {content} = await $.getJSON(file.git_url);
								let theme = JSON.parse(patchedAtob(content));
								if (theme.desktop_only && Blockbench.isMobile) return false;
								theme.id = file.name.replace(/\.\w+/, '');
								theme.source = 'repository';
								CustomTheme.themes.push(theme);
							} catch (err) {
								console.error(err);
							}
						})
					}).catch(console.error)
				}
			},
			component: {
				data: {
					backup: '',
					data: CustomTheme.data,
					open_category: 'select',
					themes: CustomTheme.themes,
					theme_icons: {
						built_in: '',
						repository: 'globe',
						file: 'draft',
					}
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
					'data.borders'() {
						CustomTheme.updateSettings();
						saveChanges();
					},
					'data.css'() {
						CustomTheme.updateSettings();
						saveChanges();
					},
					'data.thumbnail'() {
						CustomTheme.updateSettings();
						saveChanges();
					},
					'data.colors': {
						handler() {
							CustomTheme.updateColors();
							saveChanges();
						},
						deep: true
					}
				},
				methods: {
					selectTheme(theme) {
						CustomTheme.loadTheme(theme);
						saveChanges();
					},
					loadBackup() {
						CustomTheme.loadTheme(JSON.parse(CustomTheme.backup_data));
						CustomTheme.data.customized = true;
						this.clearBackup();
					},
					clearBackup() {
						this.backup = '';
						CustomTheme.backup_data = null;
					},
					customizeTheme() {
						CustomTheme.customizeTheme();
					},
					getThemeThumbnailStyle(theme) {
						let style = {};
						for (let key in CustomTheme.defaultColors) {
							style[`--color-${key}`] = CustomTheme.defaultColors[key];
						}
						for (let key in theme.colors) {
							style[`--color-${key}`] = theme.colors[key];
						}
						return style;
					},
					openContextMenu(theme, event) {
						if (!theme.sideloaded) return;
						let menu = new Menu([
							{
								name: 'menu.texture.folder',
								icon: 'folder',
								condition: isApp,
								click: () => {
									if (!isApp || !theme.path) return;
									if (!fs.existsSync(theme.path)) {
										Blockbench.showQuickMessage('texture.error.file');
										return;
									}
									shell.showItemInFolder(theme.path);
								}
							},
							{
								name: 'generic.remove',
								icon: 'clear',
								click: () => {
									this.themes.remove(theme);
									CustomTheme.sideloaded_themes.remove(theme.path);
									localStorage.setItem('themes_sideloaded', JSON.stringify(CustomTheme.sideloaded_themes));
								}
							}
						])
						menu.open(event);
					},
					tl
				},
				computed: {
					listed_themes() {
						let themes = this.themes.slice();
						if (this.data.customized) {
							themes.splice(0, 0, this.data);
						}
						return themes;
					}
				},
				template: `
					<div id="theme_editor">
						<div v-if="open_category == 'select'">
							<div v-if="backup" class="theme_backup_bar" @click.stop="loadBackup()">
								{{ tl('layout.restore_backup', [backup]) }}
								<i class="material-icons icon" @click.stop="clearBackup()">clear</i>
							</div>
							<h2 class="i_b">${tl('layout.select')}</h2>

							<div id="theme_list">
								<div v-for="theme in listed_themes" :key="theme.id" class="theme" :class="{selected: theme.id == data.id}" @click="selectTheme(theme)" @contextmenu="openContextMenu(theme, $event)">
									<div class="theme_preview" :class="{ borders: theme.borders }" :theme_id="theme.id" :style="getThemeThumbnailStyle(theme)">
										<div class="theme_preview_header">
											<span class="theme_preview_text" style="width: 20px;" />
											<div class="theme_preview_menu_header">
												<span class="theme_preview_text" style="width: 34px;" />
											</div>
											<span class="theme_preview_text" style="width: 45px;" />
										</div>
										<div class="theme_preview_menu">
											<span class="theme_preview_text" style="width: 23px;" />
											<span class="theme_preview_text" style="width: 16px;" />
											<span class="theme_preview_text" style="width: 40px;" />
										</div>
										<div class="theme_preview_window">
											<div class="theme_preview_sidebar"></div>
											<div class="theme_preview_center"></div>
											<div class="theme_preview_sidebar"></div>
										</div>
									</div>
									<div class="theme_name">{{ theme.name }}</div>
									<div class="theme_type_icon">
										<i class="material-icons icon">{{ theme_icons[theme.source] }}</i>
									</div>
									<div class="theme_author">{{ theme.author }}</div>
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

							<div class="dialog_bar" v-if="data.customized">
								<label class="name_space_left" for="layout_name">${tl('layout.name')}</label>
								<input @input="customizeTheme($event)" type="text" class="half dark_bordered" id="layout_name" v-model="data.name">
							</div>

							<div class="dialog_bar" v-if="data.customized">
								<label class="name_space_left" for="layout_name">${tl('layout.author')}</label>
								<input @input="customizeTheme($event)" type="text" class="half dark_bordered" id="layout_name" v-model="data.author">
							</div>

							<hr />

							<div class="dialog_bar">
								<label class="name_space_left" for="layout_font_main">${tl('layout.font.main')}</label>
								<input @input="customizeTheme($event)" style="font-family: var(--font-main)" type="text" class="half dark_bordered" id="layout_font_main" v-model="data.main_font">
							</div>
	
							<div class="dialog_bar">
								<label class="name_space_left" for="layout_font_headline">${tl('layout.font.headline')}</label>
								<input @input="customizeTheme($event)" style="font-family: var(--font-headline)" type="text" class="half dark_bordered" id="layout_font_headline" v-model="data.headline_font">
							</div>
							<div class="dialog_bar">
								<label class="name_space_left" for="layout_font_code">${tl('layout.font.code')}</label>
								<input @input="customizeTheme($event)" style="font-family: var(--font-code)" type="text" class="half dark_bordered" id="layout_font_code" v-model="data.code_font">
							</div>
							<div class="dialog_bar">
								<label class="name_space_left" for="layout_borders">${tl('layout.borders')}</label>
								<input @input="customizeTheme($event)" type="checkbox" id="layout_borders" v-model="data.borders">
							</div>
						</div>
						
						<div v-if="open_category == 'css'">
							<h2 class="i_b">${tl('layout.css')}</h2>
							<div id="css_editor">
								<p v-if="data.css && data.css.length > 65000">Hidden due to performance limitations of the built-in CSS editor</p>
								<vue-prism-editor v-else v-model="data.css" @change="customizeTheme(1, $event)" language="css" :line-numbers="true" />
							</div>
	
						</div>

						<div v-if="open_category == 'thumbnail'">
							<h2 class="i_b">${tl('layout.thumbnail')}</h2>
							<div class="theme_preview custom_thumbnail_preview" :class="{ borders: data.borders }" :theme_id="data.id" :style="getThemeThumbnailStyle(data)">
								<div class="theme_preview_header">
									<span class="theme_preview_text" style="width: 20px;" />
									<div class="theme_preview_menu_header">
										<span class="theme_preview_text" style="width: 34px;" />
									</div>
									<span class="theme_preview_text" style="width: 45px;" />
								</div>
								<div class="theme_preview_menu">
									<span class="theme_preview_text" style="width: 23px;" />
									<span class="theme_preview_text" style="width: 16px;" />
									<span class="theme_preview_text" style="width: 40px;" />
								</div>
								<div class="theme_preview_window">
									<div class="theme_preview_sidebar"></div>
									<div class="theme_preview_center"></div>
									<div class="theme_preview_sidebar"></div>
								</div>
							</div>
							<div id="thumbnail_editor">
								<vue-prism-editor v-model="data.thumbnail" @change="customizeTheme(1, $event)" language="css" :line-numbers="true" />
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
						CustomTheme.customizeTheme();
					},
					change(c) {
						last_color = c.toHexString();
					},
					hide(c) {
						CustomTheme.data.colors[scope_key] = last_color;
						field.spectrum('set', last_color);
					},
					beforeShow() {
						last_color = CustomTheme.data.colors[scope_key];
						field.spectrum('set', last_color);
					}
				});
			})()
		}
		CustomTheme.dialog_is_setup = true;
	},
	customizeTheme() {
		if (!CustomTheme.data.customized) {
			CustomTheme.data.customized = true;
			CustomTheme.data.name = CustomTheme.data.name ? ('Copy of ' + CustomTheme.data.name) : 'Custom Theme';
			CustomTheme.data.author = settings.username.value;
			CustomTheme.data.id = 'custom_theme';
			let i = 0;
			while (CustomTheme.themes.find(theme => theme.id == CustomTheme.data.id)) {
				i++;
				CustomTheme.data.id = 'custom_theme_'+i;
			}
			localStorage.setItem('theme', JSON.stringify(CustomTheme.data));
		}
	},
	updateColors() {		
		
		for (var key in CustomTheme.data.colors) {
			var hex = CustomTheme.data.colors[key];
			document.body.style.setProperty('--color-'+key, hex);
		}
		$('meta[name=theme-color]').attr('content', CustomTheme.data.colors.frame);
		document.body.classList.toggle('light_mode', new tinycolor(CustomTheme.data.colors.ui).isLight());

		if (typeof gizmo_colors != 'undefined') {
			let preview_style = window.getComputedStyle(document.getElementById('preview'));
			function update(three_color, variable) {
				let string = preview_style.getPropertyValue(variable).trim();
				three_color.set(string);
			}
			update(gizmo_colors.r, '--color-axis-x');
			update(gizmo_colors.g, '--color-axis-y');
			update(gizmo_colors.b, '--color-axis-z');
			update(gizmo_colors.grid, '--color-grid');
			update(Canvas.gridMaterial.color, '--color-grid');
			update(Canvas.wireframeMaterial.color, '--color-wireframe');
			update(gizmo_colors.solid, '--color-solid');
			update(gizmo_colors.outline, '--color-outline');
			update(gizmo_colors.gizmo_hover, '--color-gizmohover');
			update(Canvas.outlineMaterial.color, '--color-outline');
			update(Canvas.ground_plane.material.color, '--color-ground');
			update(Canvas.brush_outline.material.uniforms.color.value, '--color-brush-outline');
			
			Canvas.pivot_marker.children.forEach(c => {
				c.updateColors();
			})
		}
	},
	updateSettings() {
		document.body.style.setProperty('--font-custom-main', CustomTheme.data.main_font);
		document.body.style.setProperty('--font-custom-headline', CustomTheme.data.headline_font);
		document.body.style.setProperty('--font-custom-code', CustomTheme.data.code_font);
		document.body.classList.toggle('theme_borders', !!CustomTheme.data.borders);
		$('style#theme_css').text(CustomTheme.data.css);
		CustomTheme.loadThumbnailStyles();
		CustomTheme.updateColors();
	},
	loadThumbnailStyles() {
		let split_regex = (isApp || window.chrome) ? new RegExp('(?<!\\[[^\\]]*),(?![^\\[]*\\])|(?<!"[^"]*),(?![^"]*")', 'g') : null;
		if (!split_regex) return;
		let thumbnailStyles = '\n';
		const style = document.createElement('style');
		document.head.appendChild(style);
		for (const theme of CustomTheme.themes) {
			style.textContent = theme.thumbnail;
			const sheet = style.sheet;
			for (const rule of sheet.cssRules) {
				if (!rule.selectorText) continue;
				thumbnailStyles += `${rule.selectorText.split(split_regex).map(e => `[theme_id="${theme.id}"] ${e.trim()}`).join(", ")} { ${rule.style.cssText} }\n`;
			}
		}
		if (CustomTheme.data.customized) {
			style.textContent = CustomTheme.data.thumbnail;
			const sheet = style.sheet;
			for (const rule of sheet.cssRules) {
				if (!rule.selectorText) continue;
				thumbnailStyles += `${rule.selectorText.split(split_regex).map(e => `[theme_id="${CustomTheme.data.id}"] ${e.trim()}`).join(", ")} { ${rule.style.cssText} }\n`;
			}
		}
		document.head.removeChild(style);
		$('style#theme_thumbnail_css').text(thumbnailStyles);
	},
	loadTheme(theme) {
		var app = CustomTheme.data;

		if (app.customized && app.name) {
			// Backup
			if (!CustomTheme.dialog.content_vue) CustomTheme.dialog.build();
			CustomTheme.dialog.content_vue.backup = app.name;
			CustomTheme.backup_data = JSON.stringify(app);
		}

		app.id = '';
		app.name = '';
		app.author = '';
		app.main_font = '';
		app.headline_font = '';
		app.code_font = '';
		app.borders = false;
		app.customized = false;
		Merge.string(app, theme, 'id')
		Merge.string(app, theme, 'name')
		Merge.string(app, theme, 'author')
		Merge.boolean(app, theme, 'borders')
		Merge.string(app, theme, 'main_font')
		Merge.string(app, theme, 'headline_font')
		Merge.string(app, theme, 'code_font')
		for (var key in app.colors) {
			if (theme.colors[key]) {
				Merge.string(app.colors, theme.colors, key);
			} else {
				CustomTheme.data.colors[key] = CustomTheme.defaultColors[key];
			}
		}
		Merge.string(app, theme, 'css');
		if (!theme.thumbnail) theme.thumbnail = '';
		Merge.string(app, theme, 'thumbnail');
		this.updateColors();
		this.updateSettings();
	},
	import(file) {
		var data = JSON.parse(file.content)
		if (data && data.colors) {
			data.id = file.name.replace(/\.\w+$/, '');
			if (!data.name) data.name = data.id;

			data.sideloaded = true;
			data.source = 'file';
			data.path = file.path;

			CustomTheme.loadTheme(data);
			CustomTheme.themes.push(data);

			if (isApp) {
				CustomTheme.sideloaded_themes.push(file.path);
				localStorage.setItem('themes_sideloaded', JSON.stringify(CustomTheme.sideloaded_themes));
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
		if (stored_theme.customized) CustomTheme.data.customized = true;
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
				extensions: ['bbtheme'],
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
			let theme = {};
			Object.assign(theme, CustomTheme.data);
			delete theme.customized;
			delete theme.id;
			Blockbench.export({
				resource_id: 'config',
				type: 'Blockbench Theme',
				extensions: ['bbtheme'],
				name: theme.id,
				content: compileJSON(theme)
			})
		}
	})
	BarItems.import_theme.toElement('#layout_title_bar')
	BarItems.export_theme.toElement('#layout_title_bar')
})
