import DarkTheme from '../../themes/dark.bbtheme'
import LightTheme from '../../themes/light.bbtheme'
import ContrastTheme from '../../themes/contrast.bbtheme'
import { compareVersions, patchedAtob } from '../util/util'

import { Dialog } from './dialog'
import { settings, Settings } from './settings'
import tinycolor from 'tinycolor2'
import { FSWatcher } from 'original-fs'
import { BBYaml } from '../util/yaml'

type ThemeSource = 'built_in' | 'file' | 'repository' | 'custom';
type ThemeData = {
	name: string
	author: string
	version?: string
	borders?: boolean
	thumbnail?: string
	css: string
	id: string
	main_font?: string
	headline_font?: string
	code_font?: string
	colors: Record<string, string>
	source?: ThemeSource
	path?: string
	desktop_only?: boolean
	options?: {
		[key: string]: {
			name: string
			options: Record<string, string>
		}
	}
	option_values: Record<string, string>
}

const DEFAULT_COLORS = {
	ui: '#282c34',
	back: '#21252b',
	dark: '#17191d',
	border: '#181a1f',
	selected: '#474d5d',
	elevated: '#323640',
	button: '#3a3f4b',
	bright_ui: '#f4f3ff',
	accent: '#3e90ff',
	frame: '#121418',
	text: '#cacad4',
	light: '#f4f3ff',
	accent_text: '#000006',
	bright_ui_text: '#000006',
	subtle_text: '#848891',
	grid: '#495061',
	wireframe: '#576f82',
	checkerboard: '#1c2026',
}

export class CustomTheme {
	name: string
	author: string
	version?: string
	borders: boolean
	thumbnail?: string
	css: string
	id: string
	main_font: string
	headline_font: string
	code_font: string
	colors: Record<string, string>
	source?: 'built_in' | 'file' | 'repository' | 'custom';
	path?: string
	desktop_only?: boolean
	options: null|{
		[key: string]: {
			name: string
			options: Record<string, string>
		}
	}
	option_values: Record<string, string>

	constructor(data?: Partial<ThemeData>) {
		let num = Math.round(Math.random()*100)
		this.id = '';
		this.name = '';
		this.author = '';
		this.main_font = '';
		this.headline_font = '';
		this.code_font = '';
		this.borders = false;
		this.thumbnail = '';
		this.css = '';
		this.colors = structuredClone(DEFAULT_COLORS);
		this.options = null;
		this.option_values = {};
		this._num = num;

		if (data) {
			this.extend(data);
		}
	}
	extend(data: Partial<ThemeData>) {
		Merge.string(this, data, 'id')
		Merge.string(this, data, 'name')
		Merge.string(this, data, 'author')
		Merge.string(this, data, 'version')
		Merge.string(this, data, 'source')
		Merge.string(this, data, 'path')
		Merge.boolean(this, data, 'desktop_only')
		Merge.boolean(this, data, 'borders')
		Merge.string(this, data, 'main_font')
		Merge.string(this, data, 'headline_font')
		Merge.string(this, data, 'code_font')
		Merge.string(this, data, 'css');
		Merge.string(this, data, 'thumbnail');

		if (data.colors) {
			for (let key in this.colors) {
				if (data.colors[key]) {
					Merge.string(this.colors, data.colors, key);
				} else {
					CustomTheme.selected.colors[key] = DEFAULT_COLORS[key];
				}
			}
		}
		if (data.options) this.options = structuredClone(data.options);
		if (data.option_values) this.option_values = Object.assign({}, data.option_values);
	}
	openOptions() {
		let form: InputFormConfig = {};
		if (!this.options) return;
		if (CustomTheme.selected != this) this.load();
		let theme = this;
		for (let key in this.options) {
			let opt = this.options[key];
			let chars = Object.keys(opt.options).reduce((val, key) => val + opt.options[key].length);
			form[key] = {
				label: opt.name,
				type: chars.length > 28 ? 'select' : 'inline_select',
				options: opt.options,
				value: this.option_values[key],
				default: this.option_values[key],
			}
		}
		new Dialog('theme_configuration', {
			name: 'layout.theme.configure',
			form,
			singleButton: true,
			onFormChange(result: Record<string, string>) {
				theme.option_values = result;
				CustomTheme.updateSettings();
				theme.save();
			},
		}).show();
	}

	static selected: CustomTheme = new CustomTheme({id: 'dark'})
	static get data(): CustomTheme {
		return CustomTheme.selected
	}
	static backup_data: string | null = null
	static themes: CustomTheme[] = [
		DarkTheme,
		LightTheme,
		ContrastTheme
	].map(theme_data => {
		let theme = new CustomTheme().parseBBTheme(theme_data, true);
		theme.source = 'built_in';
		return theme;
	})
	static defaultColors = DEFAULT_COLORS
	static sideloaded_themes: string[] = []
	static dialog: Dialog|null = null
	static setup() {

		const theme_watchers: Record<string, FSWatcher> = {};
		let remote_themes_loaded = false;
		CustomTheme.dialog = new Dialog({
			id: 'theme',
			title: 'dialog.settings.theme',
			singleButton: true,
			width: 950,
			title_menu: new Menu([
				'settings_window',
				'keybindings_window',
				'theme_window',
				'about_window',
			]),
			sidebar: {
				pages: {
					select: tl('layout.select'),
					_customize: new MenuSeparator('customize', 'layout.section.customize'),
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
				this.content_vue.data = CustomTheme.data;
				if (!remote_themes_loaded) {
					remote_themes_loaded = true;
					$.getJSON('https://api.github.com/repos/JannisX11/blockbench-themes/contents/themes').then(files => {
						files.forEach(async (file) => {
							try {
								let {content} = await $.getJSON(file.git_url);
								let theme = new CustomTheme().parseBBTheme(patchedAtob(content));
								if (theme.desktop_only && Blockbench.isMobile) return false;
								theme.id = file.name.replace(/\.\w+/, '');
								theme.source = 'repository';
								if (!CustomTheme.themes.find(t2 => t2.id == theme.id)) {
									CustomTheme.themes.push(theme);
								}
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
						CustomTheme.selected.save();
					},
					'data.headline_font'() {
						CustomTheme.updateSettings();
						CustomTheme.selected.save();
					},
					'data.code_font'() {
						CustomTheme.updateSettings();
						CustomTheme.selected.save();
					},
					'data.borders'() {
						CustomTheme.updateSettings();
						CustomTheme.selected.save();
					},
					'data.css'() {
						CustomTheme.updateSettings();
						CustomTheme.selected.save();
					},
					'data.thumbnail'() {
						CustomTheme.updateSettings();
						CustomTheme.selected.save();
					},
					'data.colors': {
						handler() {
							CustomTheme.updateSettings();
							CustomTheme.selected.save();
						},
						deep: true
					}
				},
				methods: {
					selectTheme(theme: CustomTheme) {
						theme.load();
						this.data = theme;
						CustomTheme.selected.save();
					},
					loadBackup() {
						let theme = new CustomTheme(JSON.parse(CustomTheme.backup_data));
						theme.load();
						this.clearBackup();
					},
					clearBackup() {
						this.backup = '';
						CustomTheme.backup_data = null;
					},
					customizeTheme() {
						CustomTheme.customizeTheme();
					},
					getThemeThumbnailStyle(theme: CustomTheme) {
						let style = {};
						for (let key in CustomTheme.defaultColors) {
							style[`--color-${key}`] = CustomTheme.defaultColors[key];
						}
						for (let key in theme.colors) {
							style[`--color-${key}`] = theme.colors[key];
						}
						return style;
					},
					openContextMenu(theme: CustomTheme, event: MouseEvent) {
						if (theme.source != 'file') return;
						let selected = theme.id == this.data.id;
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
								name: 'layout.file.watch_changes',
								icon: theme_watchers[theme.path] != undefined,
								condition: isApp && selected,
								click: () => {
									if (theme_watchers[theme.path]) {
										theme_watchers[theme.path].close();
										delete theme_watchers[theme.path];

									} else if (fs.existsSync(theme.path)) {
										let timeout: number = 0;
										theme_watchers[theme.path] = fs.watch(theme.path, (eventType) => {
											if (eventType == 'change') {
												if (timeout) {
													clearTimeout(timeout);
													timeout = 0;
												}
												timeout = window.setTimeout(() => {
													theme.reloadThemeFile();
												}, 60)
											}
										})
									}
								}
							},
							{
								name: 'generic.reload',
								icon: 'refresh',
								condition: isApp && selected,
								click: () => {
									theme.reloadThemeFile();
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
						if (this.data.source == 'custom') {
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

									<div class="theme_details_bar">
										<div class="theme_type_icon">
											<i class="material-icons icon">{{ theme_icons[theme.source] }}</i>
										</div>
										<div class="theme_author">{{ theme.author }}</div>
										<div class="tool" v-if="theme.options" @click.stop="theme.openOptions()">
											<i class="material-icons icon">tune</i>
											<div class="tooltip">${tl('layout.theme.configure')}...</div>
										</div>
									</div>
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

							<div class="dialog_bar" v-if="data.source == 'custom'">
								<label class="name_space_left" for="layout_name">${tl('layout.name')}</label>
								<input @input="customizeTheme($event)" type="text" class="half dark_bordered" id="layout_name" v-model="data.name">
							</div>

							<div class="dialog_bar" v-if="data.source == 'custom'">
								<label class="name_space_left" for="layout_name">${tl('layout.author')}</label>
								<input @input="customizeTheme($event)" type="text" class="half dark_bordered" id="layout_name" v-model="data.author">
							</div>

							<div class="dialog_bar" v-if="data.source == 'custom'">
								<label class="name_space_left" for="layout_name">${tl('layout.version')}</label>
								<input @input="customizeTheme($event)" type="text" class="half dark_bordered" id="layout_name" v-model="data.version">
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
	}
	static setupDialog() {
		let wrapper = $('#color_wrapper');
		for (let key in CustomTheme.defaultColors) {
			let scope_key = key;
			let hex = CustomTheme.selected.colors[scope_key];
			let last_color = hex;
			let field = wrapper.find(`#color_field_${scope_key} .layout_color_preview`);

			field.spectrum({
				preferredFormat: "hex",
				color: hex,
				showAlpha: false,
				showInput: true,
				// @ts-ignore Added in the customized version of spectrum but not in types
				defaultColor: CustomTheme.defaultColors[key],
				resetText: tl('generic.reset'),
				cancelText: tl('dialog.cancel'),
				chooseText: tl('dialog.confirm'),
				move(c) {
					CustomTheme.selected.colors[scope_key] = c.toHexString();
					CustomTheme.customizeTheme();
				},
				change(c) {
					last_color = c.toHexString();
				},
				hide(c) {
					CustomTheme.selected.colors[scope_key] = last_color;
					field.spectrum('set', last_color);
				},
				beforeShow() {
					last_color = CustomTheme.selected.colors[scope_key];
					field.spectrum('set', last_color);
				}
			});
		}
		CustomTheme.dialog_is_setup = true;
	}
	static dialog_is_setup = false;
	static customizeTheme() {
		if (CustomTheme.selected.source != 'custom') {
			let theme = new CustomTheme(CustomTheme.selected);
			theme.extend({
				name: theme.name ? ('Copy of ' + theme.name) : 'Custom Theme',
				author: settings.username.value as string,
				id: 'custom_theme',
				source: 'custom',
			})
			let i = 0;
			while (CustomTheme.themes.find(t2 => theme.id == t2.id)) {
				i++;
				theme.id = 'custom_theme_'+i;
			}
			if (CustomTheme.dialog.content_vue) CustomTheme.dialog.content_vue.data = theme;
			theme.load();
		}
	}
	static updateColors() {		
		$('meta[name=theme-color]').attr('content', CustomTheme.selected.colors.frame);
		document.body.classList.toggle('light_mode', new tinycolor(CustomTheme.selected.colors.ui).isLight());

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
			update(gizmo_colors.u, '--color-axis-u'); // spline space colors
			update(gizmo_colors.v, '--color-axis-v'); // spline space colors
			update(gizmo_colors.w, '--color-axis-w'); // spline space colors
			update(Canvas.gridMaterial.color, '--color-grid');
			update(Canvas.wireframeMaterial.color, '--color-wireframe');
			update(gizmo_colors.solid, '--color-solid');
			update(gizmo_colors.outline, '--color-outline');
			update(gizmo_colors.gizmo_hover, '--color-gizmohover');
			update(Canvas.outlineMaterial.color, '--color-outline');
			update(Canvas.ground_plane.material.color, '--color-ground');
			update(Canvas.brush_outline.material.uniforms.color.value, '--color-brush-outline');
			update(gizmo_colors.spline_handle_aligned, '--color-spline-handle-aligned');
			update(gizmo_colors.spline_handle_mirrored, '--color-spline-handle-mirrored');
			update(gizmo_colors.spline_handle_free, '--color-spline-handle-free');
			
			Canvas.pivot_marker.children.forEach(c => {
				// @ts-ignore
				c.updateColors();
			})
		}
	}
	static updateSettings() {
		let theme = CustomTheme.selected;
		let variables = {};
		for (let key in CustomTheme.selected.colors) {
			variables['--color-'+key] = CustomTheme.selected.colors[key];
		}
		variables['--font-custom-main'] = `'${theme.main_font}'`;
		variables['--font-custom-headline'] = `'${theme.headline_font}'`;
		variables['--font-custom-code'] = `'${theme.code_font}'`;
		let variable_section = `body {\n`;
		for (let key in variables) {
			variable_section += `\n\t${key}: ${variables[key]};`
		}
		variable_section += '\n}\n';
		document.getElementById('theme_css').textContent = `@layer theme {${variable_section}${theme.css}};`
		document.body.classList.toggle('theme_borders', !!theme.borders);
		// Options
		for (let attribute of document.body.attributes) {
			if (attribute.name.startsWith('theme-') && (!theme.options || theme.options[attribute.name.substring(6)] == undefined)) {
				document.body.removeAttribute(attribute.name);
			}
		}
		for (let key in (theme.options??{})) {
			if (theme.option_values[key] == undefined) continue;
			document.body.setAttribute('theme-'+key, theme.option_values[key]);
		}
		CustomTheme.loadThumbnailStyles();
		CustomTheme.updateColors();
	}
	static loadThumbnailStyles() {
		// @ts-ignore
		let split_regex = (isApp || window.chrome) ? new RegExp('(?<!\\[[^\\]]*),(?![^\\[]*\\])|(?<!"[^"]*),(?![^"]*")', 'g') : null;
		if (!split_regex) return;
		let thumbnailStyles = '\n';
		const style = document.createElement('style');
		document.head.appendChild(style);
		for (const theme of CustomTheme.themes) {
			style.textContent = theme.thumbnail;
			const sheet = style.sheet;
			for (const rule of sheet.cssRules) {
				if (!(rule as CSSStyleRule).selectorText) continue;
				thumbnailStyles += `${(rule as CSSStyleRule).selectorText.split(split_regex).map(e => `[theme_id="${theme.id}"] ${e.trim()}`).join(", ")} { ${rule.style.cssText} }\n`;
			}
		}
		if (CustomTheme.selected.source == 'custom') {
			style.textContent = CustomTheme.selected.thumbnail;
			const sheet = style.sheet;
			for (const rule of sheet.cssRules) {
				if (!(rule as CSSStyleRule).selectorText) continue;
				
				thumbnailStyles += `${(rule as CSSStyleRule).selectorText.split(split_regex).map(e => `[theme_id="${CustomTheme.selected.id}"] ${e.trim()}`).join(", ")} { ${rule.style.cssText} }\n`;
			}
		}
		document.head.removeChild(style);
		document.getElementById('theme_thumbnail_css').textContent = thumbnailStyles;
	}
	load() {
		if (CustomTheme.selected.source == 'custom' && CustomTheme.selected.name) {
			// Backup
			if (!CustomTheme.dialog.content_vue) CustomTheme.dialog.build();
			CustomTheme.dialog.content_vue.backup = CustomTheme.selected.name;
			CustomTheme.backup_data = JSON.stringify(CustomTheme.selected);
		}
		CustomTheme.selected = this;
		if (CustomTheme.dialog.content_vue) CustomTheme.dialog.content_vue.data = this;

		CustomTheme.updateSettings();
		this.save();
	}
	static loadTheme(theme: CustomTheme) {
		theme.load();
	}
	reloadThemeFile() {
		let content = fs.readFileSync(this.path, {encoding: 'utf8'});
		if (!content) return;
		let new_theme = new CustomTheme().parseBBTheme(content);
		delete new_theme.id;
		delete new_theme.option_values;
		this.extend(new_theme);
		this.load();
	}
	static import(file: FileResult) {
		let content = file.content as string;

		let theme = new CustomTheme().parseBBTheme(content);

		theme.id = file.name.replace(/\.\w+$/, '');
		if (!theme.name) theme.name = theme.id;

		theme.source = 'file';
		theme.path = file.path;

		CustomTheme.loadTheme(theme);
		CustomTheme.themes.remove(CustomTheme.themes.find((t2: CustomTheme) => t2.id == theme.id));
		CustomTheme.themes.push(theme);

		if (isApp) {
			CustomTheme.sideloaded_themes.safePush(file.path);
			localStorage.setItem('themes_sideloaded', JSON.stringify(CustomTheme.sideloaded_themes));
		}
	}
	parseBBTheme(content: string, include_id?: boolean): this {
		if (content.startsWith('{')) {
			// Lecagy format
			let json_data = JSON.parse(content);
			this.extend(json_data);

		} else {
			function extractSection(start_match: string, end_match: string): string | undefined {
				content = content.trim();
				if (content.startsWith(start_match) == false) return;
				let end = content.indexOf(end_match);
				let section = content.substring(start_match.length, end);
				content = content.substring(end+end_match.length);
				return section;
			}

			let metadata_section = extractSection('/*', '*/');
			if (metadata_section) {
				let metadata = BBYaml.parse(metadata_section);
				this.extend(metadata);
			}

			let variable_section = extractSection('body {', '}');
			if (variable_section) {
				for (let line of variable_section.split(/\r?\n/)) {
					line = line.trim();
					if (line.startsWith('--color')) {
						let [key, value] = line.replace('--color-', '').split(/:\s*/);
						this.colors[key] = value.replace(/;/, '');
					} else if (line.startsWith('--font-custom')) {
						let [key, value] = line.replace('--font-custom-', '').split(/:\s*/);
						value = value.replace(';', '');
						switch (key) {
							case 'main': this.main_font = value; break;
							case 'headline': this.headline_font = value; break;
							case 'code': this.code_font = value; break;
						}
					}
				}
			}

			this.thumbnail = extractSection('@scope (thumbnail) {', '\n}') ?? '';

			this.css = content;
		}
		return this;
	}
	compileBBTheme(): string {
		let theme = '/*';
		let metadata = {
			name: this.name,
			author: this.author,
			version: this.version,
			borders: this.borders,
		}
		for (let key in metadata) {
			if (metadata[key] == undefined) continue;
			theme += `\n${key}: ${metadata[key].toString()}`;
		}
		theme += '\n*/\n';
		// Variables
		theme += 'body {';
		for (let color in this.colors) {
			let color_value = this.colors[color];
			theme += `\n\t--color-${color}: ${color_value};`;
		}
		if (this.main_font) 	theme += `\n\t--font-custom-main: ${this.main_font};`;
		if (this.headline_font) theme += `\n\t--font-custom-headline: ${this.headline_font};`;
		if (this.code_font) 	theme += `\n\t--font-custom-code: ${this.code_font};`;

		theme += '\n}\n';
		if (this.thumbnail) {
			theme += '@scope (thumbnail) {\n'
			theme += this.thumbnail.replace(/\n/g, '\n\t');
			theme += '\n}\n';
		}
		if (this.css) {
			theme += this.css;
		}
		return theme;
	}
	save() {
		localStorage.setItem('theme', JSON.stringify(this));
	}
};

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
					let id = file.name.replace(/\.\w+$/, '');
					let theme = new CustomTheme().parseBBTheme(file.content as string);
					theme.id = id;
					if (!theme.name) theme.name = theme.id;
					theme.source = 'file';
					theme.path = file.path;
					CustomTheme.themes.push(theme);
				})
			})
		}
	} catch (err) {}

	CustomTheme.loadThumbnailStyles();
}

export function loadThemes() {
	let stored_theme_data: ThemeData | undefined;
	try {
		if (localStorage.getItem('theme')) {
			stored_theme_data = JSON.parse(localStorage.getItem('theme'))
		}
	} catch (err) {}

	if (stored_theme_data) {
		let stored_theme = new CustomTheme(stored_theme_data);

		// Check for updates
		if (stored_theme.source == 'repository' && stored_theme.id) {
			CustomTheme.loadTheme(stored_theme);
			fetch(`https://cdn.jsdelivr.net/gh/JannisX11/blockbench-themes/themes/${stored_theme.id}.bbtheme`).then(async (result) => {
				let text_content = await result.text();
				if (!text_content) return;
				let theme = new CustomTheme().parseBBTheme(text_content);

				if ((theme.version && !stored_theme.version) || (theme.version && stored_theme.version && compareVersions(theme.version, stored_theme.version))) {
					// Update theme
					stored_theme.extend(theme);
					stored_theme.source = 'repository';
					stored_theme.load();
					console.log(`Updated Theme "${stored_theme.id}" to v${theme.version}`);
				}
			});
		} else if ((stored_theme.source == 'built_in' || stored_theme.source == 'file') && stored_theme.id) {
			let match = CustomTheme.themes.find(t => t.id == stored_theme.id);
			if (match) {
				match.option_values = stored_theme.option_values;
				match.load();
			}
			
		} else if (stored_theme.source == 'custom') {
			CustomTheme.loadTheme(stored_theme);
		}
	}
}

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
			let id = CustomTheme.selected.id || '';
			let content = CustomTheme.selected.compileBBTheme();
			Blockbench.export({
				resource_id: 'config',
				type: 'Blockbench Theme',
				extensions: ['bbtheme'],
				name: id,
				content
			})
		}
	})
	BarItems.import_theme.toElement('#layout_title_bar')
	BarItems.export_theme.toElement('#layout_title_bar')
})

Object.assign(window, {
	CustomTheme,
});
