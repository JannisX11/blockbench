const StartScreen = {
	loaders: {}
};

function addStartScreenSection(id, data) {
	if (typeof id == 'object') {
		data = id;
		id = '';
	}
	var obj = $(Interface.createElement('section', {id}))
	if (typeof data.graphic === 'object') {
		var left = $('<div class="start_screen_left graphic"></div>')
		obj.append(left)

		if (data.graphic.type === 'icon') {
			var icon = Blockbench.getIconNode(data.graphic.icon)
			left.addClass('graphic_icon')
			left.append(icon)
		} else {
			left.css('background-image', `url('${data.graphic.source}')`)
		}
		if (data.graphic.width) {
			left.css('width', data.graphic.width+'px');
		}
		if (data.graphic.width && data.text) {
			left.css('flex-shrink', '0');
		}
		if (data.graphic.width && data.graphic.height && Blockbench.isMobile) {
			left.css('height', '0')
				.css('padding-top', '0')
				.css('padding-bottom', (data.graphic.height/data.graphic.width*100)+'%')
		} else {
			if (data.graphic.height) left.css('height', data.graphic.height+'px');
			if (data.graphic.width && !data.graphic.height && !data.graphic.aspect_ratio) left.css('height', data.graphic.width+'px');
			if (data.graphic.aspect_ratio) left.css('aspect-ratio', data.graphic.aspect_ratio);
		}
		if (data.graphic.description) {
			let content = $(marked(data.graphic.description));
			content.css({
				'bottom': '15px',
				'right': '15px',
				'color': data.graphic.text_color || '#ffffff',
			});
			left.append(content);
		}
	}
	if (data.text instanceof Array) {
		var right = $('<div class="start_screen_right"></div>')
		obj.append(right)
		data.text.forEach(line => {
			var content = line.text ? marked(tl(line.text)) : '';
			switch (line.type) {
				case 'h1': var tag = 'h1'; break;
				case 'h2': var tag = 'h3'; break;
				case 'h3': var tag = 'h4'; break;
				case 'list':
					var tag = 'ul class="list_style"';
					line.list.forEach(string => {
						content += `<li>${marked(tl(string))}</li>`;
					})
					break;
				case 'button': var tag = 'button'; break;
				default:   var tag = 'p'; break;
			}
			var l = $(`<${tag}>${content}</${tag.split(' ')[0]}>`);
			if (typeof line.click == 'function') {
				l.on('click', line.click);
			}
			right.append(l);
		})
	}
	if (data.layout == 'vertical') {
		obj.addClass('vertical');
	}

	if (data.features instanceof Array) {
		let features_section = document.createElement('ul');
		features_section.className = 'start_screen_features'
		data.features.forEach(feature => {
			let li = document.createElement('li');
			let img = new Image(); img.src = feature.image;
			let title = document.createElement('h3'); title.textContent = feature.title;
			let text = document.createElement('p'); text.textContent = feature.text;
			li.append(img, title, text);
			features_section.append(li);
		})
		obj.append(features_section);
	}

	if (data.closable !== false) {
		obj.append(`<i class="material-icons start_screen_close_button">clear</i>`);
		obj.find('i.start_screen_close_button').click((e) => {
			obj.detach()
		});
	}
	if (typeof data.click == 'function') {
		obj.on('click', event => {
			if (event.target.classList.contains('start_screen_close_button')) return;
			data.click()
		})
	}
	if (data.color) {
		obj.css('background-color', data.color);
		if (data.color == 'var(--color-bright_ui)') {
			obj.addClass('bright_ui')
		}
	}
	if (data.text_color) {
		obj.css('color', data.text_color);
	}
	if (data.last) {
		$('#start_screen > content').append(obj);
	} else if (data.insert_after) {
		$('#start_screen > content').find(`#${data.insert_after}`).after(obj);
	} else if (data.insert_before) {
		$('#start_screen > content').find(`#${data.insert_before}`).before(obj);
	} else {
		$('#start_screen > content').prepend(obj);
	}
	if (!obj[0].parentElement) {
		$('#start_screen > content').append(obj);
	}
	return {
		delete() {
			obj[0].remove();
		}
	}
}

onVueSetup(function() {
	StateMemory.init('start_screen_list_type', 'string')

	StartScreen.vue = new Vue({
		el: '#start_screen',
		components: {},
		data: {
			formats: Formats,
			loaders: ModelLoader.loaders,
			selected_format_id: '',
			recent: isApp ? recent_projects : [],
			list_type: StateMemory.start_screen_list_type || 'grid',
			redact_names: settings.streamer_mode.value,
			redacted: tl('generic.redacted'),
			search_term: '',
			isApp,
			mobile_layout: Blockbench.isMobile,
			thumbnails: {},
			getIconNode: Blockbench.getIconNode
		},
		methods: {
			getDate(p) {
				if (p.day) {
					var diff = (365e10 + Blockbench.openTime.dayOfYear() - p.day) % 365;
					if (diff <= 0) {
						return tl('dates.today');
					} else if (diff == 1) {
						return tl('dates.yesterday');
					} else if (diff <= 7) {
						return tl('dates.this_week');
					} else {
						return tl('dates.weeks_ago', [Math.ceil(diff/7)]);
					}
				} else {
					return '-'
				}
			},
			openProject: function(p, event) {
				Blockbench.read([p.path], {}, files => {
					loadModelFile(files[0]);
				})
			},
			updateThumbnails(model_paths) {
				this.recent.forEach(project => {
					if (model_paths && !model_paths.includes(project.path)) return;
					let hash = project.path.hashCode().toString().replace(/^-/, '0');
					let path = PathModule.join(app.getPath('userData'), 'thumbnails', `${hash}.png`);
					if (!fs.existsSync(path)) {
						delete this.thumbnails[project.path];
					} else {
						this.thumbnails[project.path] = path + '?' + Math.round(Math.random()*255);
					}
				})
				this.$forceUpdate();
			},
			setListType(type) {
				this.list_type = type;
				StateMemory.start_screen_list_type = type;
				StateMemory.save('start_screen_list_type')
			},
			recentProjectContextMenu(recent_project, event) {
				let menu = new Menu('recent_project', [
					{
						id: 'favorite',
						name: 'mode.start.recent.favorite',
						icon: recent_project.favorite ? 'fas.fa-star' : 'far.fa-star',
						click: () => {
							this.toggleProjectFavorite(recent_project);
						}
					},
					{
						id: 'open_folder',
						name: 'menu.texture.folder',
						icon: 'folder',
						click() {
							shell.showItemInFolder(recent_project.path)
						}
					},
					{
						id: 'remove',
						name: 'generic.remove',
						icon: 'clear',
						click: () => {
							recent_projects.remove(recent_project);
							updateRecentProjects();
						}
					}
				])
				menu.show(event);
			},
			toggleProjectFavorite(recent_project) {
				recent_project.favorite = !recent_project.favorite;
				if (recent_project.favorite) {
					recent_projects.remove(recent_project);
					recent_projects.splice(0, 0, recent_project);
				}
				updateRecentProjects();
			},
			getFormatCategories() {
				let categories = {};
				function add(key, format) {
					
					if (!categories[format.category]) {
						categories[format.category] = {
							name: tl('format_category.' + format.category),
							entries: []
						}
					}
					categories[format.category].entries.push(format);
				}
				for (let key in this.formats) {
					if (this.formats[key].show_on_start_screen != false) {
						add(key, this.formats[key]);
					}
				}
				for (let key in this.loaders) {
					if (this.loaders[key].show_on_start_screen != false) {
						add(key, this.loaders[key]);
					}
				}
				return categories;
			},
			loadFormat(format_entry) {
				this.selected_format_id = format_entry.id;
				if (format_entry.onFormatPage) format_entry.onFormatPage();
				Vue.nextTick(() => {
					let button = document.querySelector('.start_screen_format_page button');
					if (!button) return;
					let offset = $(button).offset().top;
					if (offset + 38 > window.innerHeight) {
						let change = offset + 64 - window.innerHeight;
						StartScreen.vue.$el.scrollTo({top: StartScreen.vue.$el.scrollTop + change, behavior: 'smooth'})
					}
				})
			},
			confirmSetupScreen(format_entry) {
				this.selected_format_id = '';
				if (format_entry.onStart) format_entry.onStart();
				if (typeof format_entry.new == 'function') format_entry.new();
			},
			openLink(link) {
				Blockbench.openLink(link);
			},
			tl
		},
		computed: {
			projects() {
				if (!this.search_term) return this.recent;
				let terms = this.search_term.toLowerCase().split(/\s/);

				return this.recent.filter(project => {
					return !terms.find(term => (
						!project.path.toLowerCase().includes(term)
					))
				})
			}
		},
		mounted() {
			this.updateThumbnails();
		},
		template: `
			<div id="start_screen">
				<content>
					<section id="start_files">

						<div class="start_screen_left" v-if="!(selected_format_id && mobile_layout)">
							<h2>${tl('mode.start.new')}</h2>
							<ul>
								<li v-for="(category, key) in getFormatCategories()" class="format_category" :key="key">
									<label>{{ category.name }}</label>
									<ul>
										<li
											v-for="format_entry in category.entries" :key="format_entry.id"
											class="format_entry" :class="{[format_entry instanceof ModelFormat ? 'format' : 'loader']: true, selected: format_entry.id == selected_format_id}"
											:title="format_entry.description"
											:format="format_entry.id"
											v-if="(!redact_names || !format_entry.confidential)"
											@click="loadFormat(format_entry)"
											@dblclick="confirmSetupScreen(format_entry)"
										>
											<span class="icon_wrapper f_left" v-html="getIconNode(format_entry.icon).outerHTML"></span>
											<label>{{ format_entry.name }}</label>
										</li>
									</ul>
								</li>
								<li class="format_category">
									<label>${tl('mode.start.info')}</label>
									<ul>
										<li class="format_entry start_screen_link" @click="openLink('https://blockbench.net/quickstart')">
											<span class="icon_wrapper f_left"><i class="material-icons">help</i></span>
											<label>${tl('menu.help.quickstart')}</label>
										</li>
										<li class="format_entry start_screen_link" @click="openLink('https://blockbench.net/wiki')">
											<span class="icon_wrapper f_left"><i class="material-icons">menu_book</i></span>
											<label>Blockbench Wiki</label>
										</li>
									</ul>
								</li>
							</ul>
						</div>

						<div class="start_screen_right start_screen_format_page" v-if="viewed_format = (selected_format_id && (formats[selected_format_id] || loaders[selected_format_id]) )" :id="'format_page_'+selected_format_id">
							<div class="tool format_page_close_button" @click="selected_format_id = ''"><i class="material-icons">clear</i></div>

							<h2 style="margin-bottom: 12px;">{{ viewed_format.name }}</h2>

							<template v-if="viewed_format.format_page && viewed_format.format_page.component">
								<component :is="'format_page_' + selected_format_id" />
							</template>

							<template v-else>
								<p class="format_description" v-if="viewed_format.description">{{ viewed_format.description }}</p>
								
								<p class="format_target" v-if="viewed_format.target">
									<b>${tl('mode.start.target')}</b>:
									<template v-if="viewed_format.target instanceof Array">
										<span v-for="target in viewed_format.target">{{ target }}</span>
									</template>
									<span v-else>{{ viewed_format.target }}</span>
								</p>

								<content v-if="viewed_format.format_page && viewed_format.format_page.content">
									<template v-for="item in viewed_format.format_page.content">

										<img v-if="item.type == 'image'" :src="item.source" :width="item.width" :height="item.height">
										<h2 v-else-if="item.type == 'h2'" class="markdown" v-html="marked(item.text.replace(/\\n/g, '\\n\\n'))"></h2>
										<h3 v-else-if="item.type == 'h3'" class="markdown" v-html="marked(item.text.replace(/\\n/g, '\\n\\n'))"></h3>
										<h4 v-else-if="item.type == 'h4'" class="markdown" v-html="marked(item.text.replace(/\\n/g, '\\n\\n'))"></h4>
										<label v-else-if="item.type == 'label'" class="markdown" v-html="marked(item.text.replace(/\\n/g, '\\n\\n'))"></label>
										<p v-else class="markdown" v-html="marked((item.text || item).replace(/\\n/g, '\\n\\n'))"></p>
									</template>
								</content>

								<div class="button_bar" v-if="!viewed_format.format_page || viewed_format.format_page.button_text !== ''">
									<button style="margin-top: 20px;" id="create_new_model_button" @click="confirmSetupScreen(viewed_format)">
										<i class="material-icons">arrow_forward</i>
										{{ viewed_format.format_page && viewed_format.format_page.button_text ? tl(viewed_format.format_page.button_text) : '${tl('mode.start.create_new')}' }}
									</button>
								</div>
							</template>
						</div>

						<div class="start_screen_right" v-else>
							<h2>${tl('mode.start.recent')}</h2>
							<div id="start_screen_view_menu" v-if="isApp && !redact_names">
								<search-bar :hide="true" v-model="search_term"></search-bar>
								<li class="tool" v-bind:class="{selected: list_type == 'grid'}" v-on:click="setListType('grid')">
									<i class="material-icons">view_module</i>
								</li>
								<li class="tool" v-bind:class="{selected: list_type == 'list'}" v-on:click="setListType('list')">
									<i class="material-icons">list</i>
								</li>
							</div>
							<div v-if="redact_names">{{ '['+tl('generic.redacted')+']' }}</div>
							<ul v-else-if="list_type == 'list'">
								<li v-for="project in projects" :key="project.path"
									v-bind:title="redact_names ? '' : project.path"
									class="recent_project"
									@click="openProject(project, $event)"
									@contextmenu="recentProjectContextMenu(project, $event)"
								>
									<div class="recent_favorite_button" :class="{favorite_enabled: project.favorite}" @click.stop="toggleProjectFavorite(project)" title="${tl('mode.start.recent.favorite')}">
										<i :class="'fa_big icon fa-star ' + (project.favorite ? 'fas' : 'far')">
									</div>
									<span class="icon_wrapper" v-html="getIconNode(project.icon).outerHTML"></span>
									<span class="recent_project_name">{{ redact_names ? redacted : project.name }}</span>
									<span class="recent_project_date">{{ getDate(project) }}</span>
								</li>
								<div v-if="recent.length == 0">{{ tl('mode.start.no_recents') }}</div>
							</ul>
							<ul :class="{redact: redact_names, recent_list_grid: true}" v-else>
								<li v-for="project in projects" :key="project.path"
									v-bind:title="redact_names ? '' : project.path"
									class="recent_project thumbnail"
									@click="openProject(project, $event)"
									@contextmenu="recentProjectContextMenu(project, $event)"
								>
									<img class="thumbnail_image" v-if="thumbnails[project.path]" :src="thumbnails[project.path]" />
									<span class="recent_project_name">{{ redact_names ? redacted : project.name }}</span>
									<span class="icon_wrapper" v-html="getIconNode(project.icon).outerHTML"></span>
									<div class="recent_favorite_button" :class="{favorite_enabled: project.favorite}" @click.stop="toggleProjectFavorite(project)" title="${tl('mode.start.recent.favorite')}">
										<i :class="'fa_big icon fa-star ' + (project.favorite ? 'fas' : 'far')">
									</div>
								</li>
							</ul>
							<div class="button_bar">
								<button style="margin-top: 20px;" onclick="BarItems.open_model.trigger()">${tl('action.open_model')}</button>
							</div>
						</div>

					</section>
				</content>
			</div>
		`
	})

	Blockbench.on('construct_format delete_format', () => {
		StartScreen.vue.$forceUpdate();
	})

	
	if (settings.streamer_mode.value) {
		updateStreamerModeNotification()
	}
	addStartScreenSection('splash_screen', {
		"text_color": '#000000',
		"graphic": {
			"type": "image",
			"source": "./assets/splash_art.png?44",
			"width": 1000,
			"aspect_ratio": "64/27",
			"description": "Splash Art by [Wan_win](https://twitter.com/Wan_w1n)",
			"text_color": '#cfcfcf'
		}
	})
	if (!Blockbench.hasFlag('after_update')) {
		document.getElementById('start_screen').scrollTop = 100;
	}
});


class ModelLoader {
	constructor(id, options) {
		this.id = id;
		this.name = tl(options.name);
		this.description = options.description ? tl(options.description) : '';
		this.icon = options.icon || 'arrow_forward';
		this.category = options.category || 'loaders';
		this.target = options.target || '';
		this.show_on_start_screen = true;
		this.confidential = options.confidential || false;
		this.condition = options.condition;

		this.format_page = options.format_page;
		this.onFormatPage = options.onFormatPage;
		this.onStart = options.onStart;

		Vue.set(ModelLoader.loaders, id, this);
		if (this.format_page && this.format_page.component) {
			Vue.component(`format_page_${this.id}`, this.format_page.component)
		}
		Blockbench.dispatchEvent('construct_model_loader', {loader: this});
	}
	new() {
		this.onStart();
	}
	delete() {
		Vue.delete(ModelLoader.loaders, this.id);
		Blockbench.dispatchEvent('delete_model_loader', {loader: this});
	}
}
ModelLoader.loaders = {};


(function() {
	/*$.getJSON('./content/news.json').then(data => {
		addStartScreenSection('new_version', data.new_version)
	})*/

	var news_call = $.ajax({
		cache: false,
		url: 'https://web.blockbench.net/content/news.json',
		dataType: 'json'
	});
	documentReady.then(() => {

		//Backup Model
		if (localStorage.getItem('backup_model') && (!isApp || !currentwindow.webContents.second_instance) && localStorage.getItem('backup_model').length > 40) {
			var backup_models = localStorage.getItem('backup_model')

			let section = addStartScreenSection({
				color: 'var(--color-back)',
				graphic: {type: 'icon', icon: 'fa-archive'},
				insert_after: 'splash_screen',
				text: [
					{type: 'h2', text: tl('message.recover_backup.title')},
					{text: tl('message.recover_backup.message')},
					{type: 'button', text: tl('message.recover_backup.recover'), click: (e) => {
						let parsed_backup_models = JSON.parse(backup_models);
						for (let uuid in parsed_backup_models) {
							Codecs.project.load(parsed_backup_models[uuid], {path: 'backup.bbmodel', no_file: true})
						}
						section.delete();
					}},
					{type: 'button', text: tl('dialog.discard'), click: (e) => {
						localStorage.removeItem('backup_model');
						section.delete();
					}}
				]
			})
		}

		//Twitter
		let twitter_ad;
		if (Blockbench.startup_count < 20 && Blockbench.startup_count % 5 === 4) {
			twitter_ad = true;
			addStartScreenSection({
				color: '#1da1f2',
				text_color: '#ffffff',
				graphic: {type: 'icon', icon: 'fab.fa-twitter'},
				text: [
					{type: 'h2', text: 'Blockbench on Twitter'},
					{text: 'Follow Blockbench on Twitter for the latest news as well as cool models from the community! [twitter.com/blockbench](https://twitter.com/blockbench/)'}
				],
				last: true
			})
		}
		//Discord
		if (Blockbench.startup_count < 6 && !twitter_ad) {
			addStartScreenSection({
				color: '#5865F2',
				text_color: '#ffffff',
				graphic: {type: 'icon', icon: 'fab.fa-discord'},
				text: [
					{type: 'h2', text: 'Discord Server'},
					{text: 'You need help with modeling or you want to chat about Blockbench? Join the official [Blockbench Discord](https://discord.gg/WVHg5kH)!'}
				],
				last: true
			})
		}

		// Quick Setup
		if (Blockbench.startup_count <= 1) {
			
			let section = Interface.createElement('section', {id: 'quick_setup'});
			document.querySelector('#start_screen #splash_screen').after(section);

			new Vue({
				data() {return {
					language: Language.code,
					language_original: Language.code,
					languages: Language.options,
					keymap: 'default',
					keymap_changed: false,
					theme: 'dark',
					keymap_options: {
						default: tl('action.load_keymap.default'),
						mouse: tl('action.load_keymap.mouse'),
						blender: 'Blender',
						cinema4d: 'Cinema 4D',
						maya: 'Maya',
					},
				}},
				methods: {
					tl,
					close() {
						this.$el.remove();
					},
					reload() {
						Blockbench.reload();
					},
					loadTheme(theme_id) {
						this.theme = theme_id;
						let theme = CustomTheme.themes.find(t => t.id == theme_id);
						if (theme) CustomTheme.loadTheme(theme);
					},
					getThemeThumbnailStyle(theme_id) {
						let theme = CustomTheme.themes.find(t => t.id == theme_id);
						let style = {};
						if (!theme) return style;
						for (let key in theme.colors) {
							style[`--color-${key}`] = theme.colors[key];
						}
						return style;
					},
					openThemes() {
						BarItems.theme_window.click();
					}
				},
				watch: {
					language(v) {
						settings.language.set(v);
						Settings.save();
					},
					keymap(keymap, old_keymap) {
						this.keymap_changed = true;
						let success = Keybinds.loadKeymap(keymap, true);
						if (!success) this.keymap = old_keymap;
					}
				},
				template: `
					<section id="quick_setup">
						<i class="material-icons start_screen_close_button" @click="close()">clear</i>
						<h2>${tl('mode.start.quick_setup')}</h2>

						<div>
							<label>${tl('mode.start.keymap')}:</label>
							<select-input v-model="keymap" :options="keymap_options" />
							<p v-if="keymap_changed">{{ tl('action.load_keymap.' + keymap + '.desc') }}</p>
						</div>
						<div>
							<label>${tl('settings.language')}:</label>
							<select-input v-model="language" :options="languages" />
							<div class="tool" @click="reload()" v-if="language != language_original" :title="tl('action.reload')">
								<i class="material-icons">refresh</i>
							</div>
							<p v-if="language != language_original">{{ tl('message.restart_to_update') }}</p>
						</div>
						<div style="width: 640px;">
							<label>${tl('dialog.settings.theme')}:</label>
							<div class="quick_setup_theme" :class="{selected: theme == 'dark'}" @click="loadTheme('dark')"><div :style="getThemeThumbnailStyle('dark')"></div>Dark</div>
							<div class="quick_setup_theme" :class="{selected: theme == 'light'}" @click="loadTheme('light')"><div :style="getThemeThumbnailStyle('light')"></div>Light</div>
							<div class="quick_setup_theme" :class="{selected: theme == 'contrast'}" @click="loadTheme('contrast')"><div :style="getThemeThumbnailStyle('contrast')"></div>Contrast</div>
							<div class="quick_setup_theme more_themes" @click="openThemes()"><div><i class="material-icons">more_horiz</i></div>{{ tl('mode.start.quick_setup.more_themes') }}</div>
						</div>
					</section>
				`
			}).$mount(section);
		}
	})
	Promise.all([news_call, documentReady]).then((data) => {
		if (!data || !data[0]) return;
		data = data[0];

		//Update Screen
		if (Blockbench.hasFlag('after_update') && data.new_version) {
			data.new_version.insert_after = 'splash_screen'
			addStartScreenSection('new_version', data.new_version);
			jQuery.ajax({
				url: 'https://blckbn.ch/api/event/successful_update',
				type: 'POST',
				data: {
					version: Blockbench.version
				}
			})
		}
		if (data.psa) {
			(function() {
				if (typeof data.psa.version == 'string') {
					if (data.psa.version.includes('-')) {
						limits = data.psa.version.split('-');
						if (limits[0] && compareVersions(limits[0], Blockbench.version)) return;
						if (limits[1] && compareVersions(Blockbench.version, limits[1])) return;
					} else {
						if (data.psa.version != Blockbench.version) return;
					}
				}
				addStartScreenSection(data.psa)
			})()
		}

	})
})()
