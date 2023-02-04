var onUninstall, onInstall;
const Plugins = {
	Vue: [],			//Vue Object
	installed: [], 		//Simple List of Names
	json: undefined,	//Json from website
	download_stats: {},
	all: [],			//Vue Object Data
	registered: {},
	devReload() {
		var reloads = 0;
		for (var i = Plugins.all.length-1; i >= 0; i--) {
			if (Plugins.all[i].source == 'file') {
				Plugins.all[i].reload()
				reloads++;
			}
		}
		Blockbench.showQuickMessage(tl('message.plugin_reload', [reloads]))
		console.log('Reloaded '+reloads+ ' plugin'+pluralS(reloads))
	},
	sort() {
		Plugins.all.sort((a, b) => {
			if (a.tags.find(tag => tag.match(/deprecated/i))) return 1;
			if (b.tags.find(tag => tag.match(/deprecated/i))) return -1;
			let download_difference = (Plugins.download_stats[b.id] || 0) - (Plugins.download_stats[a.id] || 0);
			if (download_difference) {
				return download_difference
			} else {
				return sort_collator.compare(a.title, b.title);
			}
		});
	}
}
StateMemory.init('installed_plugins', 'array')
Plugins.installed = StateMemory.installed_plugins;

class Plugin {
	constructor(id, data) {
		this.id = id||'unknown';
		this.installed = false;
		this.expanded = false;
		this.title = '';
		this.author = '';
		this.description = '';
		this.about = '';
		this.icon = '';
		this.tags = [];
		this.version = '0.0.1';
		this.variant = 'both';
		this.min_version = '';
		this.max_version = '';
		this.source = 'store'
		this.await_loading = false;

		this.extend(data)

		Plugins.all.safePush(this);
	}
	extend(data) {
		if (!(data instanceof Object)) return this;
		Merge.boolean(this, data, 'installed')
		Merge.boolean(this, data, 'expanded')
		Merge.string(this, data, 'title')
		Merge.string(this, data, 'author')
		Merge.string(this, data, 'description')
		Merge.string(this, data, 'about')
		Merge.string(this, data, 'icon')
		Merge.string(this, data, 'version')
		Merge.string(this, data, 'variant')
		Merge.string(this, data, 'min_version')
		Merge.boolean(this, data, 'await_loading');
		if (data.tags instanceof Array) this.tags.safePush(...data.tags.slice(0, 3));

		Merge.function(this, data, 'onload')
		Merge.function(this, data, 'onunload')
		Merge.function(this, data, 'oninstall')
		Merge.function(this, data, 'onuninstall')
		return this;
	}
	get name() {
		return this.title;
	}
	async install(first, cb) {
		var scope = this;
		Plugins.registered[this.id] = this;
		return await new Promise((resolve, reject) => {
			$.getScript(Plugins.path + scope.id + '.js', () => {
				if (cb) cb.bind(scope)()
				scope.bindGlobalData(first)
				if (first && scope.oninstall) {
					scope.oninstall()
				}
				if (first) Blockbench.showQuickMessage(tl('message.installed_plugin', [this.title]));
				resolve()
			}).fail(() => {
				if (isApp) {
					console.log('Could not find file of plugin "'+scope.id+'". Uninstalling it instead.')
					scope.uninstall()
				}
				if (first) Blockbench.showQuickMessage(tl('message.installed_plugin_fail', [this.title]));
				reject()
			})
			this.remember()
			scope.installed = true;
		})
	}
	bindGlobalData() {
		var scope = this;
		if (onUninstall) {
			scope.onuninstall = onUninstall
		}
		if (onUninstall) {
			scope.onuninstall = onUninstall
		}
		if (window.plugin_data) {
			console.warn(`plugin_data is deprecated. Please use Plugin.register instead. (${plugin_data.id || 'unknown plugin'})`)
		}
		window.onInstall = window.onUninstall = window.plugin_data = undefined
		return this;
	}
	async download(first) {
		var scope = this;
		function register() {
			jQuery.ajax({
				url: 'https://blckbn.ch/api/event/install_plugin',
				type: 'POST',
				data: {
					plugin: scope.id
				}
			})
		}
		if (!isApp) {
			if (first) register();
			return await scope.install(first)
		}
		return await new Promise((resolve, reject) => {
			var file = originalFs.createWriteStream(Plugins.path+this.id+'.js')
			https.get('https://cdn.jsdelivr.net/gh/JannisX11/blockbench-plugins/plugins/'+this.id+'.js', function(response) {
				response.pipe(file);
				response.on('end', function() {
					setTimeout(async function() {
						await scope.install(first);
						resolve()
					}, 20)
					if (first) register();
				})
			});
		});
	}
	async loadFromFile(file, first) {
		var scope = this;
		if (!isApp && !first) return this;
		if (first) {
			if (isApp) {
				if (!confirm(tl('message.load_plugin_app'))) return;
			} else {
				if (!confirm(tl('message.load_plugin_web'))) return;
			}
		}

		this.id = pathToName(file.path);
		Plugins.registered[this.id] = this;
		localStorage.setItem('plugin_dev_path', file.path);
		Plugins.all.safePush(this);
		this.source = 'file';
		this.tags.safePush('Local');

		return await new Promise((resolve, reject) => {

			if (isApp) {
				$.getScript(file.path, () => {
					if (window.plugin_data) {
						scope.id = (plugin_data && plugin_data.id)||pathToName(file.path)
						scope.extend(plugin_data)
						scope.bindGlobalData()
					}
					if (first && scope.oninstall) {
						scope.oninstall()
					}
					scope.installed = true;
					scope.path = file.path;
					this.remember();
					Plugins.sort();
					resolve()
				}).fail(reject)
			} else {
				try {
					new Function(file.content)();
				} catch (err) {
					reject(err)
				}
				if (!Plugins.registered && window.plugin_data) {
					scope.id = (plugin_data && plugin_data.id)||scope.id
					scope.extend(plugin_data)
					scope.bindGlobalData()
				}
				if (first && scope.oninstall) {
					scope.oninstall()
				}
				scope.installed = true
				this.remember()
				Plugins.sort()
				resolve()
			}
		})
	}
	async loadFromURL(url, first) {
		if (first) {
			if (isApp) {
				if (!confirm(tl('message.load_plugin_app'))) return;
			} else {
				if (!confirm(tl('message.load_plugin_web'))) return;
			}
		}

		this.id = pathToName(url)
		Plugins.registered[this.id] = this;
		localStorage.setItem('plugin_dev_path', url)
		Plugins.all.safePush(this)
		this.tags.safePush('Remote');

		this.source = 'url';
		await new Promise((resolve, reject) => {
			$.getScript(url, () => {
				if (window.plugin_data) {
					this.id = (plugin_data && plugin_data.id)||pathToName(url)
					this.extend(plugin_data)
					this.bindGlobalData()
				}
				if (first && this.oninstall) {
					this.oninstall()
				}
				this.installed = true
				this.path = url
				this.remember()
				Plugins.sort()
				// Save
				if (isApp) {
					var file = originalFs.createWriteStream(Plugins.path+this.id+'.js')
					https.get(url, (response) => {
						response.pipe(file);
						response.on('end', resolve)
					}).on('error', reject);
				} else {
					resolve()
				}
			}).fail(() => {
				if (isApp) {
					this.install().then(resolve).catch(resolve)
				}
			})
		})
		return this;
	}
	remember(id = this.id, path = this.path) {
		if (Plugins.installed.find(plugin => plugin.id == this.id)) {
			return this;
		}
		Plugins.installed.push({
			id: id,
			path: path,
			source: this.source
		})
		StateMemory.save('installed_plugins')
		return this;
	}
	uninstall() {
		try {
			this.unload();
			if (this.onuninstall) {
				this.onuninstall();
			}
		} catch (err) {
			console.log('Error in unload or uninstall method: ', err);
		}
		delete Plugins.registered[this.id];
		let in_installed = Plugins.installed.find(plugin => plugin.id == this.id);
		Plugins.installed.remove(in_installed);
		StateMemory.save('installed_plugins')
		this.installed = false;

		if (isApp && this.source !== 'store') {
			Plugins.all.remove(this)
		}
		if (isApp && this.source != 'file') {
			var filepath = Plugins.path + this.id + '.js'
			if (fs.existsSync(filepath)) {
				fs.unlink(filepath, (err) => {
					if (err) {
						console.log(err);
					}
				});
			}
		}
		StateMemory.save('installed_plugins')
		return this;
	}
	unload() {
		if (this.onunload) {
			this.onunload()
		}
		return this;
	}
	reload() {
		if (!isApp && this.source == 'file') return this;

		this.unload()
		this.tags.empty();
		Plugins.all.remove(this)

		if (this.source == 'file') {
			this.loadFromFile({path: this.path}, false)

		} else if (this.source == 'url') {
			this.loadFromURL(this.path, false)
		}
		return this;
	}
	isReloadable() {
		return (this.source == 'file' && isApp) || (this.source == 'url')
	}
	isInstallable() {
		var scope = this;
		var result = 
			scope.variant === 'both' ||
			(
				isApp === (scope.variant === 'desktop') && 
				isApp !== (scope.variant === 'web')
			);
		if (result && scope.min_version) {
			result = Blockbench.isOlderThan(scope.min_version) ? 'outdated_client' : true;
		}
		if (result && scope.max_version) {
			result = Blockbench.isNewerThan(scope.max_version) ? 'outdated_plugin' : true
		}
		if (result === false) {
			result = (scope.variant === 'web') ? 'web_only' : 'app_only'
		}
		return (result === true) ? true : tl('dialog.plugins.'+result);
	}
	toggleInfo(force) {
		if (!this.about) return;
		var scope = this;
		Plugins.all.forEach(function(p) {
			if (p !== scope && p.expanded) p.expanded = false;
		})
		if (force !== undefined) {
			this.expanded = force === true
		} else {
			this.expanded = this.expanded !== true
		}
	}
	get expandicon() {
		return this.expanded ? 'expand_less' : 'expand_more'
	}
}
// Alias for typescript
const BBPlugin = Plugin;

Plugin.register = function(id, data) {
	if (typeof id !== 'string' || typeof data !== 'object') {
		console.warn('Plugin.register: not enough arguments, string and object required.')
		return;
	}
	var plugin = Plugins.registered[id];
	if (!plugin) {
		plugin = Plugins.registered.unknown;
		if (plugin) {
			delete Plugins.registered.unknown;
			plugin.id = id;
			Plugins.registered[id] = plugin;
		}
	}
	if (!plugin) {
		Blockbench.showMessageBox({
			translateKey: 'load_plugin_failed',
			message: tl('message.load_plugin_failed.message', [id])
		})
	};
	plugin.extend(data)
	if (data.icon) plugin.icon = Blockbench.getIconNode(data.icon)
	if (plugin.isInstallable() == true) {
		if (plugin.onload instanceof Function) {
			plugin.onload()
		}
	}
	return plugin;
}

if (isApp) {
	Plugins.path = app.getPath('userData')+osfs+'plugins'+osfs
	fs.readdir(Plugins.path, function(err) {
		if (err) {
			fs.mkdir(Plugins.path, function(a) {})
		}
	})
} else {
	Plugins.path = 'https://cdn.jsdelivr.net/gh/JannisX11/blockbench-plugins/plugins/';
}

Plugins.loading_promise = new Promise((resolve, reject) => {

	$.ajax({
		cache: false,
		url: 'https://cdn.jsdelivr.net/gh/JannisX11/blockbench-plugins/plugins.json',
		dataType: 'json',
		success(data) {
			Plugins.json = data;
			resolve();
			Plugins.loading_promise.resolved = true;
		},
		error() {
			console.log('Could not connect to plugin server')
			$('#plugin_available_empty').text('Could not connect to plugin server')
			resolve();
			Plugins.loading_promise.resolved = true;
		}
	});
})

$.getJSON('https://blckbn.ch/api/stats/plugins?weeks=2', data => {
	Plugins.download_stats = data;
	if (Plugins.json) {
		Plugins.sort();
	}
})

async function loadInstalledPlugins() {
	if (!Plugins.loading_promise.resolved) {
		await Plugins.loading_promise;
	}
	const install_promises = [];
	// Legacy Plugins Import
	if (localStorage.getItem('installed_plugins')) {
		var legacy_plugins = JSON.parse(localStorage.getItem('installed_plugins'))
		if (legacy_plugins instanceof Array) {
			legacy_plugins.forEach((string, i) => {
				if (typeof string == 'string') {
					if (string.match(/\.js$/)) {
						Plugins.installed[i] = {
							id: string.split(/[\\/]/).last().replace(/\.js$/, ''),
							path: string,
							source: 'file'
						}
					} else {
						Plugins.installed[i] = {
							id: string,
							source: 'store'
						}
					}
				}
			})
		}
		StateMemory.save('installed_plugins')
		localStorage.removeItem('installed_plugins')
	}
	Plugins.installed.replace(Plugins.installed.filter(p => p !== null))

	if (Plugins.json instanceof Object && navigator.onLine) {
		//From Store
		for (var id in Plugins.json) {
			var plugin = new Plugin(id, Plugins.json[id])
			if (Plugins.installed.find(p => {
				return p && p.id == id && p.source == 'store'
			})) {
				let promise = plugin.download();
				if (plugin.await_loading) {
					install_promises.push(promise);
				}
			}
		}
		Plugins.sort();
	} else if (Plugins.installed.length > 0 && isApp) {
		//Offline
		Plugins.installed.forEach(function(plugin) {

			if (plugin.source == 'store') {
				var promise = new Plugin(plugin.id).install(false, function() {
					this.extend(window.plugin_data)
					Plugins.sort()
				})
				install_promises.push(promise);
			}
		})
	}
	if (Plugins.installed.length > 0) {
		var load_counter = 0;
		Plugins.installed.forEachReverse(function(plugin) {

			if (plugin.source == 'file') {
				//Dev Plugins
				if (isApp && fs.existsSync(plugin.path)) {
					var instance = new Plugin(plugin.id);
					install_promises.push(instance.loadFromFile({path: plugin.path}, false));
					load_counter++;
					console.log(`🧩📁 Loaded plugin "${plugin.id || plugin.path}" from file`);
				} else {
					Plugins.installed.remove(plugin)
				}

			} else if (plugin.source == 'url') {
				var instance = new Plugin(plugin.id);
				install_promises.push(instance.loadFromURL(plugin.path, false));
				load_counter++;
				console.log(`🧩🌐 Loaded plugin "${plugin.id || plugin.path}" from URL`);

			} else {
				load_counter++;
				console.log(`🧩🛒 Loaded plugin "${plugin.id}" from store`)
			}
		})
		console.log(`Loaded ${load_counter} plugin${pluralS(load_counter)}`)
	}
	StateMemory.save('installed_plugins')
	

	install_promises.forEach(promise => {
		promise.catch(console.error);
	})
	return await Promise.allSettled(install_promises);
}

BARS.defineActions(function() {

	Plugins.dialog = new Dialog({
		id: 'plugins',
		title: 'dialog.plugins.title',
		singleButton: true,
		width: 760,
		component: {
			data: {
				tab: 'installed',
				search_term: '',
				items: Plugins.all
			},
			computed: {
				plugin_search() {
					var name = this.search_term.toUpperCase()
					return this.items.filter(item => {
						if ((this.tab == 'installed') == item.installed) {
							if (name.length > 0) {
								return (
									item.id.toUpperCase().includes(name) ||
									item.title.toUpperCase().includes(name) ||
									item.description.toUpperCase().includes(name) ||
									item.author.toUpperCase().includes(name) ||
									item.tags.find(tag => tag.toUpperCase().includes(name))
								)
							}
							return true;
						}
						return false;
					})
				}
			},
			methods: {
				getTagClass(tag) {
					if (tag.match(/^(local|remote)$/i)) {
						return 'plugin_tag_source'
					} else if (tag.match(/^minecraft/i)) {
						return 'plugin_tag_mc'
					} else if (tag.match(/^deprecated/i)) {
						return 'plugin_tag_deprecated'
					}
				},
				getIconNode: Blockbench.getIconNode,
				pureMarked,
				tl
			},
			template: `
				<div style="margin-top: 10px;">
					<div class="bar">
						<div class="tab_bar">
							<div :class="{open: tab == 'installed'}" @click="tab = 'installed'">${tl('dialog.plugins.installed')}</div>
							<div :class="{open: tab == 'available'}" @click="tab = 'available'">${tl('dialog.plugins.available')}</div>
						</div>
						<search-bar id="plugin_search_bar" v-model="search_term"></search-bar>
					</div>
					<ul class="list" id="plugin_list">
						<li v-for="plugin in plugin_search" v-bind:plugin="plugin.id" v-bind:class="{plugin: true, testing: plugin.fromFile, expanded: plugin.expanded, has_about_text: !!plugin.about}">
							<div class="title" v-on:click="plugin.toggleInfo()">
								<div class="icon_wrapper plugin_icon normal" v-html="getIconNode(plugin.icon || 'error_outline', plugin.icon ? plugin.color : 'var(--color-close)').outerHTML"></div>

								<i v-if="plugin.expanded" class="material-icons plugin_expand_icon">expand_less</i>
								<i v-else class="material-icons plugin_expand_icon">expand_more</i>
								{{ plugin.title || plugin.id }}
							</div>
							<div class="plugin_version">{{ plugin.version }}</div>
							<div class="button_bar" v-if="plugin.installed || plugin.isInstallable() == true">
								<button type="button" class="" v-on:click="plugin.uninstall()" v-if="plugin.installed"><i class="material-icons">delete</i><span>${tl('dialog.plugins.uninstall')}</span></button>
								<button type="button" class="" v-on:click="plugin.download(true)" v-else><i class="material-icons">add</i><span>${tl('dialog.plugins.install')}</span></button>
								<button type="button" v-on:click="plugin.reload()" v-if="plugin.installed && plugin.isReloadable()"><i class="material-icons">refresh</i><span>${tl('dialog.plugins.reload')}</span></button>
							</div>
							<div class="button_bar tiny" v-if="plugin.isInstallable() != true">{{ plugin.isInstallable() }}</div>

							<div class="author">{{ tl('dialog.plugins.author', [plugin.author]) }}</div>
							<div class="description">{{ plugin.description }}</div>
							<div v-if="plugin.expanded" class="about markdown" v-html="pureMarked(plugin.about.replace(/\\n/g, '\\n\\n'))"><button>a</button></div>
							<div v-if="plugin.expanded" v-on:click="plugin.toggleInfo()" style="text-decoration: underline;">${tl('dialog.plugins.show_less')}</div>
							<ul class="plugin_tag_list">
								<li v-for="tag in plugin.tags" :class="getTagClass(tag)" :key="tag" @click="search_term = tag;">{{tag}}</li>
							</ul>
						</li>
						<div class="no_plugin_message tl" v-if="plugin_search.length < 1 && tab === 'installed'">${tl('dialog.plugins.none_installed')}</div>
						<div class="no_plugin_message tl" v-if="plugin_search.length < 1 && tab === 'available'" id="plugin_available_empty">{{ tl(navigator.onLine ? 'dialog.plugins.none_available' : 'dialog.plugins.offline') }}</div>
					</ul>
				</div>
			`
		}
	})

	new Action('plugins_window', {
		icon: 'extension',
		category: 'blockbench',
		side_menu: new Menu('plugins_window', [
			'load_plugin',
			'load_plugin_from_url'
		]),
		click(e) {
			Plugins.dialog.show();
			let none_installed = !Plugins.all.find(plugin => plugin.installed);
			if (none_installed) Plugins.dialog.content_vue.tab = 'available';
			if (!Plugins.dialog.button_bar) {
				Plugins.dialog.button_bar = Interface.createElement('div', {class: 'bar next_to_title', id: 'plugins_header_bar'});
				Plugins.dialog.object.firstElementChild.after(Plugins.dialog.button_bar);
				BarItems.load_plugin.toElement('#plugins_header_bar');
				BarItems.load_plugin_from_url.toElement('#plugins_header_bar');
			}
			$('#plugin_list').css('max-height', limitNumber(window.innerHeight-226, 80, 800)+'px');
			$('dialog#plugins #plugin_search_bar input').trigger('focus')
		}
	})
	new Action('reload_plugins', {
		icon: 'sync',
		category: 'blockbench',
		click() {
			Plugins.devReload()
		}
	})
	new Action('load_plugin', {
		icon: 'fa-file-code',
		category: 'blockbench',
		click() {
			Blockbench.import({
				resource_id: 'dev_plugin',
				extensions: ['js'],
				type: 'Blockbench Plugin',
			}, function(files) {
				new Plugin().loadFromFile(files[0], true)
			})
		}
	})
	new Action('load_plugin_from_url', {
		icon: 'cloud_download',
		category: 'blockbench',
		click() {
			Blockbench.textPrompt('URL', '', url => {
				new Plugin().loadFromURL(url, true)
			})
		}
	})
	new Action('add_plugin', {
		icon: 'add',
		category: 'blockbench',
		click() {
			setTimeout(_ => ActionControl.select('+plugin: '), 1);
		}
	})
	new Action('remove_plugin', {
		icon: 'remove',
		category: 'blockbench',
		click() {
			setTimeout(_ => ActionControl.select('-plugin: '), 1);
		}
	})
})
