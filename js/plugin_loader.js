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
Plugins.installed = StateMemory.installed_plugins = StateMemory.installed_plugins.filter(p => p && typeof p == 'object');

class Plugin {
	constructor(id, data) {
		this.id = id||'unknown';
		this.installed = false;
		this.title = '';
		this.author = '';
		this.description = '';
		this.about = '';
		this.icon = '';
		this.tags = [];
		this.dependencies = [];
		this.version = '0.0.1';
		this.variant = 'both';
		this.min_version = '';
		this.max_version = '';
		this.source = 'store';
		this.creation_date = 0;
		this.await_loading = false;
		this.about_fetched = false;
		this.disabled = false;
		this.new_repository_format = false;

		this.extend(data)

		Plugins.all.safePush(this);
	}
	extend(data) {
		if (!(data instanceof Object)) return this;
		Merge.boolean(this, data, 'installed')
		Merge.string(this, data, 'title')
		Merge.string(this, data, 'author')
		Merge.string(this, data, 'description')
		Merge.string(this, data, 'about')
		Merge.string(this, data, 'icon')
		Merge.string(this, data, 'version')
		Merge.string(this, data, 'variant')
		Merge.string(this, data, 'min_version')
		Merge.string(this, data, 'max_version')
		Merge.boolean(this, data, 'await_loading');
		Merge.boolean(this, data, 'disabled');
		if (data.creation_date) this.creation_date = Date.parse(data.creation_date);
		if (data.tags instanceof Array) this.tags.safePush(...data.tags.slice(0, 3));
		if (data.dependencies instanceof Array) this.dependencies.safePush(...data.dependencies);

		if (data.new_repository_format) this.new_repository_format = true;
		if (this.min_version != '' && !compareVersions('4.8.0', this.min_version)) {
			this.new_repository_format = true;
		}

		Merge.function(this, data, 'onload')
		Merge.function(this, data, 'onunload')
		Merge.function(this, data, 'oninstall')
		Merge.function(this, data, 'onuninstall')
		return this;
	}
	get name() {
		return this.title;
	}
	async install() {
		let required_dependencies = this.dependencies
			.map(id => (Plugins.all.find(p => p.id == id) || id))
			.filter(p => (p instanceof Plugin == false || p.installed == false));
		if (required_dependencies.length) {
			let failed_dependency = required_dependencies.find(p => (!p.isInstallable || p.isInstallable() != true));
			if (failed_dependency) {
				let error_message = failed_dependency;
				if (failed_dependency instanceof Plugin) {
					error_message = `**${failed_dependency.title}**: ${failed_dependency.isInstallable()}`;
				}
				Blockbench.showMessageBox({
					title: 'message.plugin_dependencies.title',
					message: `${tl('message.plugin_dependencies.invalid')}\n\n${error_message}`,
				});
				return;
			}

			let list = required_dependencies.map(p => `**${p.title}** ${tl('dialog.plugins.author', [p.author])}`);
			let response = await new Promise(resolve => {
				Blockbench.showMessageBox({
					title: 'message.plugin_dependencies.title',
					message: `${tl('message.plugin_dependencies.message1')} \n\n* ${ list.join('\n* ') }\n\n${tl('message.plugin_dependencies.message2')}`,
					buttons: ['dialog.continue', 'dialog.cancel'],
					width: 512,
				}, button => {
					resolve(button == 0);
				})
			})
			if (!response) return;

			for (let dependency of required_dependencies) {
				await dependency.install();
			}
		}
		return await this.download(true);
	}
	async load(first, cb) {
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
			return await scope.load(first)
		}

		// Download files
		async function copyFileToDrive(origin_filename, target_filename, callback) {
			var file = originalFs.createWriteStream(PathModule.join(Plugins.path, target_filename));
			https.get('https://cdn.jsdelivr.net/gh/JannisX11/blockbench-plugins/plugins/'+origin_filename, function(response) {
				response.pipe(file);
				if (callback) response.on('end', callback);
			});
		}
		return await new Promise(async (resolve, reject) => {
			// New system
			if (this.new_repository_format) {
				copyFileToDrive(`${this.id}/${this.id}.js`, `${this.id}.js`, () => {
					if (first) register();
					setTimeout(async function() {
						await scope.load(first);
						resolve()
					}, 20)
				});
				if (this.hasImageIcon()) {
					copyFileToDrive(`${this.id}/${this.icon}`, this.id + '.' + this.icon);
				}
				await this.fetchAbout();
				if (this.about) {
					fs.writeFileSync(PathModule.join(Plugins.path, this.id + '.about.md'), this.about, 'utf-8');
				}

			} else {
				// Legacy system
				copyFileToDrive(`${this.id}.js`, `${this.id}.js`, () => {
					if (first) register();
					setTimeout(async function() {
						await scope.load(first);
						resolve()
					}, 20)
				});
			}
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
					this.load().then(resolve).catch(resolve)
				}
			})
		})
		return this;
	}
	remember(id = this.id, path = this.path) {
		let entry = Plugins.installed.find(plugin => plugin.id == this.id);
		let already_exists = !!entry;
		if (!entry) entry = {};

		entry.id = id;
		entry.version = this.version;
		entry.path = path;
		entry.source = this.source;
		entry.disabled = this.disabled ? true : undefined;

		if (!already_exists) Plugins.installed.push(entry);

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
			function removeCachedFile(filepath) {
				if (fs.existsSync(filepath)) {
					fs.unlink(filepath, (err) => {
						if (err) console.log(err);
					});
				}
			}
			removeCachedFile(Plugins.path + this.id + '.js');
			removeCachedFile(Plugins.path + this.id + '.' + this.icon);
			removeCachedFile(Plugins.path + this.id + '.about.md');
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
		this.dependencies.empty();
		Plugins.all.remove(this)

		if (this.source == 'file') {
			this.loadFromFile({path: this.path}, false)

		} else if (this.source == 'url') {
			this.loadFromURL(this.path, false)
		}
		return this;
	}
	toggleDisabled() {
		if (!this.disabled) {
			this.disabled = true;
			this.unload()
		} else {
			if (this.onload) {
				this.onload()
			}
			this.disabled = false;
		}
		this.remember();
	}
	showContextMenu(event) {
		if (!this.installed) return;
		this.menu.open(event, this);
	}
	isReloadable() {
		return this.installed && !this.disabled && ((this.source == 'file' && isApp) || (this.source == 'url'));
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
	hasImageIcon() {
		return this.icon.endsWith('.png') || this.icon.endsWith('.svg');
	}
	getIcon() {
		if (this.hasImageIcon()) {
			if (isApp) {
				if (this.installed && this.source == 'store') {
					return Plugins.path + this.id + '.' + this.icon;
				}
				if (this.source != 'store')
					return this.path.replace(/\w+\.js$/, this.icon);
				}
			return `https://cdn.jsdelivr.net/gh/JannisX11/blockbench-plugins/plugins/${this.id}/${this.icon}`;
		}
		return this.icon;
	}
	async fetchAbout() {
		if (!this.about_fetched && !this.about && this.new_repository_format) {
			if (isApp && this.installed) {
				try {
					let content = fs.readFileSync(PathModule.join(Plugins.path, this.id + '.about.md'), {encoding: 'utf-8'});
					this.about = content;
					this.about_fetched = true;
					return;
				} catch (err) {
					console.error('failed to get about for plugin ' + this.id);
				}
			}
			let url = `https://cdn.jsdelivr.net/gh/JannisX11/blockbench-plugins/plugins/${this.id}/about.md`;
			let result = await fetch(url).catch(() => {
				console.error('about.md missing for plugin ' + this.id);
			});
			if (result.ok) {
				this.about = await result.text();
			}
			this.about_fetched = true;
		}
	}
}
Plugin.prototype.menu = new Menu([
	new MenuSeparator('installation'),
	{
		name: 'dialog.plugins.install',
		icon: 'add',
		condition: plugin => (!plugin.installed && plugin.isInstallable() == true),
		click(plugin) {
			plugin.install();
		}
	},
	{
		name: 'dialog.plugins.uninstall',
		icon: 'delete',
		condition: plugin => (plugin.installed),
		click(plugin) {
			plugin.uninstall();
		}
	},
	{
		name: 'dialog.plugins.disable',
		icon: 'bedtime',
		condition: plugin => (plugin.installed && plugin.source != 'store' && !plugin.disabled),
		click(plugin) {
			plugin.toggleDisabled();
		}
	},
	{
		name: 'dialog.plugins.enable',
		icon: 'bedtime',
		condition: plugin => (plugin.installed && plugin.source != 'store' && plugin.disabled),
		click(plugin) {
			plugin.toggleDisabled();
		}
	},
	new MenuSeparator('developer'),
	{
		name: 'dialog.plugins.reload',
		icon: 'refresh',
		condition: plugin => (plugin.installed && plugin.isReloadable()),
		click(plugin) {
			plugin.reload();
		}
	},
	{
		name: 'menu.animation.open_location',
		icon: 'folder',
		condition: plugin => (isApp && plugin.source == 'file'),
		click(plugin) {
			shell.showItemInFolder(plugin.path);
		}
	},
]);


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
	if (plugin.isInstallable() == true && plugin.disabled == false) {
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

	if (Plugins.json instanceof Object && navigator.onLine) {
		//From Store
		for (var id in Plugins.json) {
			var plugin = new Plugin(id, Plugins.json[id]);
			let installed_match = Plugins.installed.find(p => {
				return p && p.id == id && p.source == 'store'
			});
			if (installed_match) {
				if (isApp && (
					(installed_match.version && plugin.version && !compareVersions(plugin.version, installed_match.version)) ||
					Blockbench.isOlderThan(plugin.min_version)
				)) {
					// Get from file
					let promise = plugin.load(false);
					install_promises.push(promise);
				} else {
					// Update
					let promise = plugin.download();
					if (plugin.await_loading) {
						install_promises.push(promise);
					}
				}
			}
		}
		Plugins.sort();
	} else if (Plugins.installed.length > 0 && isApp) {
		//Offline
		Plugins.installed.forEach(function(plugin_data) {

			if (plugin_data.source == 'store') {
				let instance = new Plugin(plugin_data.id); 
				let promise = instance.load(false, function() {
					Plugins.sort();
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
					var instance = new Plugin(plugin.id, {disabled: plugin.disabled});
					install_promises.push(instance.loadFromFile({path: plugin.path}, false));
					load_counter++;
					console.log(`🧩📁 Loaded plugin "${plugin.id || plugin.path}" from file`);
				} else {
					Plugins.installed.remove(plugin);
				}

			} else if (plugin.source == 'url') {
				var instance = new Plugin(plugin.id, {disabled: plugin.disabled});
				install_promises.push(instance.loadFromURL(plugin.path, false));
				load_counter++;
				console.log(`🧩🌐 Loaded plugin "${plugin.id || plugin.path}" from URL`);

			} else {
				if (Plugins.all.find(p => p.id == plugin.id)) {
					load_counter++;
					console.log(`🧩🛒 Loaded plugin "${plugin.id}" from store`);
				} else {
					Plugins.installed.remove(plugin);
				}
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
		buttons: [],
		width: 1200,
		component: {
			data: {
				tab: 'installed',
				search_term: '',
				items: Plugins.all,
				selected_plugin: null,
				page: 0,
				per_page: 25,
				isMobile: Blockbench.isMobile,
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
				},
				suggested_rows() {
					let tags = ["Animation"];
					this.items.forEach(plugin => {
						if (!plugin.installed) return;
						tags.safePush(...plugin.tags)
					})
					let rows = tags.map(tag => {
						let plugins = this.items.filter(plugin => !plugin.installed && plugin.tags.includes(tag) && !plugin.tags.includes('Deprecated')).slice(0, 12);
						return {
							title: tag,
							plugins,
						}
					}).filter(row => row.plugins.length > 2);
					//rows.sort((a, b) => a.plugins.length - b.plugins.length);
					rows.sort(() => Math.random() - 0.5);

					let cutoff = Date.now() - (3_600_000 * 24 * 28);
					let new_plugins = this.items.filter(plugin => !plugin.installed && plugin.creation_date > cutoff && !plugin.tags.includes('Deprecated'));
					if (new_plugins.length) {
						new_plugins.sort((a, b) => a.creation_date - b.creation_date);
						let new_row = {
							title: 'New',
							plugins: new_plugins.slice(0, 12)
						}
						rows.splice(0, 0, new_row);
					}

					return rows.slice(0, 3);
				},
				viewed_plugins() {
					return this.plugin_search.slice(this.page * this.per_page, (this.page+1) * this.per_page);
				},
				pages() {
					let pages = [];
					let length = this.plugin_search.length;
					for (let i = 0; i * this.per_page < length; i++) {
						pages.push(i);
					}
					return pages;
				}
			},
			methods: {
				setTab(tab) {
					this.tab = tab;
					this.setPage(0);
				},
				setPage(number) {
					this.page = number;
				},
				selectPlugin(plugin) {
					plugin.fetchAbout();
					this.selected_plugin = plugin;
				},
				showDependency(dependency) {
					let plugin = Plugins.all.find(p => p.id == dependency);
					if (plugin) {
						this.selectPlugin(plugin);
					}
				},
				getDependencyName(dependency) {
					let plugin = Plugins.all.find(p => p.id == dependency);
					return plugin ? (plugin.title + (plugin.installed ? ' ✓' : '')) : (dependency + ' ⚠');
				},
				isDependencyInstalled(dependency) {
					let plugin = Plugins.all.find(p => p.id == dependency);
					return plugin && plugin.installed;
				},
				getTagClass(tag) {
					if (tag.match(/^(local|remote)$/i)) {
						return 'plugin_tag_source'
					} else if (tag.match(/^minecraft/i)) {
						return 'plugin_tag_mc'
					} else if (tag.match(/^deprecated/i)) {
						return 'plugin_tag_deprecated'
					}
				},
				formatAbout(about) {
					return pureMarked(about);
				},
				getIconNode: Blockbench.getIconNode,
				pureMarked,
				tl
			},
			mount_directly: true,
			template: `
				<content style="display: flex;" class="dialog_content">
					<div id="plugin_browser_sidebar" v-show="!isMobile || !selected_plugin">
						<div class="bar flex" id="plugins_list_main_bar">
							<div class="tool" v-if="!isMobile" @click="selected_plugin = null"><i class="material-icons icon">home</i></div>
							<search-bar id="plugin_search_bar" v-model="search_term" @input="setPage(0)"></search-bar>
						</div>
						<div class="tab_bar">
							<div :class="{open: tab == 'installed'}" @click="setTab('installed')">${tl('dialog.plugins.installed')}</div>
							<div :class="{open: tab == 'available'}" @click="setTab('available')">${tl('dialog.plugins.available')}</div>
						</div>
						<ul class="list" id="plugin_list">
							<li v-for="plugin in viewed_plugins" :plugin="plugin.id" :class="{plugin: true, testing: plugin.fromFile, selected: plugin == selected_plugin, disabled_plugin: plugin.disabled, incompatible: plugin.isInstallable() !== true}" @click="selectPlugin(plugin)" @contextmenu="selectPlugin(plugin); plugin.showContextMenu($event)">
								<div>
									<div class="plugin_icon_area">
										<img v-if="plugin.hasImageIcon()" :src="plugin.getIcon()" width="48" height="48px" />
										<dynamic-icon v-else :icon="plugin.icon" />
									</div>
									<div>
										<div class="title">{{ plugin.title || plugin.id }}</div>
										<div class="author">{{ tl('dialog.plugins.author', [plugin.author]) }}</div>
									</div>
								</div>
								<div class="description">{{ plugin.description }}</div>
								<ul class="plugin_tag_list">
									<li v-for="tag in plugin.tags" :class="getTagClass(tag)" :key="tag" @click="search_term = tag;">{{tag}}</li>
								</ul>
							</li>
							<div class="no_plugin_message tl" v-if="plugin_search.length < 1 && tab === 'installed'">${tl('dialog.plugins.none_installed')}</div>
							<div class="no_plugin_message tl" v-if="plugin_search.length < 1 && tab === 'available'" id="plugin_available_empty">{{ tl(navigator.onLine ? 'dialog.plugins.none_available' : 'dialog.plugins.offline') }}</div>
						</ul>
						<ol class="pagination_numbers" v-if="pages.length > 1">
							<li v-for="number in pages" :class="{selected: page == number}" @click="setPage(number)">{{ number+1 }}</li>
						</ol>
					</div>
					
					<div id="plugin_browser_page" v-if="selected_plugin">
						<div v-if="isMobile" @click="selected_plugin = null;">Back to Overview todo</div>
						<div class="plugin_browser_page_header" :class="{disabled_plugin: selected_plugin.disabled}">
							<div class="plugin_icon_area">
								<img v-if="selected_plugin.hasImageIcon()" :src="selected_plugin.getIcon()" width="48" height="48px" />
								<dynamic-icon v-else :icon="selected_plugin.icon" />
							</div>
							<div>
								<h1>
									{{ selected_plugin.title || selected_plugin.id }}
									<div class="version">v{{ selected_plugin.version }}</div>
								</h1>
								<div class="author">
									{{ tl('dialog.plugins.author', [selected_plugin.author]) }}
									<div v-if="selected_plugin.disabled" class="plugin_disabled_tag">🌙 ${tl('dialog.plugins.is_disabled')}</div>
									<div v-else-if="selected_plugin.installed" class="plugin_installed_tag">✓ ${tl('dialog.plugins.is_installed')}</div>
								</div>
							</div>
						</div>

						<div class="button_bar" v-if="selected_plugin.installed || selected_plugin.isInstallable() == true">
							<button type="button" v-if="selected_plugin.installed && selected_plugin.source != 'store'" @click="selected_plugin.toggleDisabled()">
								<i class="material-icons icon">bedtime</i>
								<span>{{ selected_plugin.disabled ? '${tl('dialog.plugins.enable')}' : '${tl('dialog.plugins.disable')}' }}</span>
							</button>
							<button type="button" @click="selected_plugin.reload()" v-if="selected_plugin.installed && selected_plugin.isReloadable()">
								<i class="material-icons icon">refresh</i>
								<span>${tl('dialog.plugins.reload')}</span>
							</button>
							<button type="button" class="" @click="selected_plugin.uninstall()" v-if="selected_plugin.installed">
								<i class="material-icons icon">delete</i>
								<span>${tl('dialog.plugins.uninstall')}</span>
							</button>
							<button type="button" class="" @click="selected_plugin.install()" v-else>
								<i class="material-icons icon">add</i>
								<span>${tl('dialog.plugins.install')}</span>
							</button>
						</div>

						<ul class="plugin_tag_list">
							<li v-for="tag in selected_plugin.tags" :class="getTagClass(tag)" :key="tag" @click="search_term = tag;">{{tag}}</li>
						</ul>

						<div class="description" :class="{disabled_plugin: selected_plugin.disabled}">{{ selected_plugin.description }}</div>

						<div class="plugin_dependencies" v-if="selected_plugin.dependencies.length">
							${tl('dialog.plugins.dependencies')}
							<a v-for="dep in selected_plugin.dependencies" @click="showDependency(dep)" :class="{installed: isDependencyInstalled(dep)}">{{ getDependencyName(dep) }}</a>
						</div>

						<div class="tiny plugin_compatibility_issue" v-if="selected_plugin.isInstallable() != true">
							<i class="material-icons icon">error</i>
							{{ selected_plugin.isInstallable() }}
						</div>

						<h2 v-if="selected_plugin.about" style="margin-top: 36px;">About</h2>
						<dynamic-icon v-else-if="!selected_plugin.hasImageIcon()" :icon="selected_plugin.icon" id="plugin_page_background_decoration" />
						<div class="about markdown" v-if="selected_plugin.about" v-html="formatAbout(selected_plugin.about)"></div>
					</div>
					
					<div id="plugin_browser_start_page" v-if="!selected_plugin && !isMobile">
						<h1>Blockbench Plugins</h1>
						<img src="./assets/plugins.png" />
						<p>Plugins allow you to configure Blockbench beyond the default capabilities. Select from a list of 100 community created plugins.</p>
						<p>Want to write your own plugin? Check out the <a href="https://www.blockbench.net/wiki/docs/plugin" target="_blank">Plugin Documentation</a>.</p>
						
						<div v-for="row in suggested_rows" class="plugins_suggested_row">
							<h3>{{row.title}}</h3>
							<ul>
								<li v-for="plugin in row.plugins" @click="selectPlugin(plugin)">
									<div class="plugin_icon_area">
										<img v-if="plugin.hasImageIcon()" :src="plugin.getIcon()" width="48" height="48px" />
										<dynamic-icon v-else :icon="plugin.icon" />
									</div>
									<div class="title"><span>{{ plugin.title || plugin.id }}</span></div>
									<div class="author">{{ plugin.author }}</div>
								</li>
							</ul>
						</div>
					</div>
					
				</content>
			`
		}
	})

	let actions_setup = false;
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
			if (!actions_setup) {
				BarItems.load_plugin.toElement('#plugins_list_main_bar');
				BarItems.load_plugin_from_url.toElement('#plugins_list_main_bar');
				actions_setup = true;
			}
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
