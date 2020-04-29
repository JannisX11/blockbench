var onUninstall, onInstall;
const Plugins = {
	apipath: 'https://raw.githubusercontent.com/JannisX11/blockbench-plugins/master/plugins.json',
	Vue: [],			//Vue Object
	installed: [], 		//Simple List of Names
	json: undefined,	//Json from website
	all: [],			//Vue Object Data
	registered: {},
	loadingStep: false,
	updateSearch() {
		Plugins.Vue._data.showAll = !Plugins.Vue._data.showAll
		Plugins.Vue._data.showAll = !Plugins.Vue._data.showAll
	},
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
		Plugins.all.sort(function(a,b) {
			return sort_collator.compare(a.title, b.title)
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
		this.variant = '';
		this.min_version = '';
		this.source = 'store'

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
		Merge.string(this, data, 'variant')
		Merge.string(this, data, 'min_version')

		Merge.function(this, data, 'onload')
		Merge.function(this, data, 'onunload')
		Merge.function(this, data, 'oninstall')
		Merge.function(this, data, 'onuninstall')
		return this;
	}
	install(first, cb) {
		var scope = this;
		Plugins.registered[this.id] = this;
		$.getScript(Plugins.path + scope.id + '.js', function() {
			if (cb) cb.bind(scope)()
			scope.bindGlobalData(first)
			if (first && scope.oninstall) {
				scope.oninstall()
			}
		}).fail(function() {
			if (isApp) {
				console.log('Could not find file of plugin "'+scope.id+'". Uninstalling it instead.')
				scope.uninstall()
			}
		})
		this.remember()
		scope.installed = true;
		return scope;
	}
	bindGlobalData() {
		var scope = this;
		if (onUninstall) {
			scope.onuninstall = onUninstall
		}
		if (onUninstall) {
			scope.onuninstall = onUninstall
		}
		window.onInstall = window.onUninstall = window.plugin_data = undefined
		return this;
	}
	download(first) {
		var scope = this;
		if (!isApp) {
			scope.install()
			return this;
		}
		var file = originalFs.createWriteStream(Plugins.path+this.id+'.js')
		var request = https.get('https://raw.githubusercontent.com/JannisX11/blockbench-plugins/master/plugins/'+this.id+'.js', function(response) {
			response.pipe(file);
			response.on('end', function() {
				setTimeout(function() {
					scope.install(first)
				}, 50)
			})
		});
		return this;
	}
	loadFromFile(file, first) {
		var scope = this;
		if (!isApp && !first) return this;
		if (first) {
			if (isApp) {
				if (!confirm(tl('message.load_plugin_app'))) return;
			} else {
				if (!confirm(tl('message.load_plugin_web'))) return;
			}
		}

		scope.id = pathToName(file.path)
		Plugins.registered[this.id] = this;
		localStorage.setItem('plugin_dev_path', file.path)
		Plugins.all.safePush(this)

		scope.source = 'file'
		if (isApp) {
			$.getScript(file.path, () => {
				if (window.plugin_data) {
					scope.id = (plugin_data && plugin_data.id)||pathToName(file.path)
					scope.extend(plugin_data)
					scope.bindGlobalData()
				}
				scope.installed = true
				scope.path = file.path
				this.remember()
				Plugins.sort()
			})
		} else {
			try {
				eval(file.content);
			} catch (err) {
				throw err;
				return;
			}
			if (!Plugins.registered && window.plugin_data) {
				scope.id = (plugin_data && plugin_data.id)||scope.id
				scope.extend(plugin_data)
				scope.bindGlobalData()
			}
			scope.installed = true
			this.remember()
			Plugins.sort()
		}
		return this;
	}
	loadFromURL(url, first) {
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

		this.source = 'url';
		$.getScript(url, () => {
			if (window.plugin_data) {
				this.id = (plugin_data && plugin_data.id)||pathToName(url)
				this.extend(plugin_data)
				this.bindGlobalData()
			}
			this.installed = true
			this.path = url
			this.remember()
			Plugins.sort()
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

		} else if (isApp) {
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
			result = compareVersions(scope.min_version, appVersion) ? 'outdated' : true
		} else if (result === false) {
			result = (scope.variant === 'web') ? 'web_only' : 'app_only'
		}
		return (result === true) ? true : tl('dialog.plugins.'+result);
	}
	toggleInfo(force) {
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
	if (!plugin) return;
	plugin.extend(data)
	if (data.icon) plugin.icon = Blockbench.getIconNode(data.icon)
	if (plugin.onload instanceof Function) {
		plugin.onload()
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
$.getJSON(Plugins.apipath, function(data) {
	Plugins.json = data
	loadInstalledPlugins()
}).fail(function() {
	console.log('Could not connect to plugin server')
	$('#plugin_available_empty').text('Could not connect to plugin server')
	loadInstalledPlugins()
})

function loadInstalledPlugins() {
	if (!Plugins.loadingStep) {
		Plugins.loadingStep = true
		return;
	}
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
	if (Plugins.json instanceof Object) {
		//From Store
		for (var id in Plugins.json) {
			var plugin = new Plugin(id, Plugins.json[id])
			if (Plugins.installed.find(p => {
				return p && p.id == id && p.source == 'store'
			})) {
				plugin.download()
			}
		}
		Plugins.sort();
	} else if (Plugins.installed.length > 0 && isApp) {
		//Offline
		Plugins.installed.forEach(function(plugin) {

			if (plugin.source == 'store') {
				var plugin = new Plugin(plugin.id).install(false, function() {
					this.extend(window.plugin_data)
					Plugins.sort()
				})
			}
		})
	}
	if (Plugins.installed.length > 0) {
		var loaded = []
		Plugins.installed.forEachReverse(function(plugin) {

			if (plugin.source == 'file') {
				//Dev Plugins
				if (isApp && fs.existsSync(plugin.path)) {
					var plugin = new Plugin(plugin.id).loadFromFile({path: plugin.path}, false)
					loaded.push('Local: '+ plugin.id || plugin.path)
				} else {
					Plugins.installed.remove(plugin)
				}

			} else if (plugin.source == 'url') {
				var plugin = new Plugin(plugin.id).loadFromFile({path: plugin.path}, false)
				loaded.push('URL: '+ plugin.id || plugin.path)

			} else {
				loaded.push('Store: '+ plugin.id)
			}
		})
		console.log(`Loaded ${loaded.length} plugin${pluralS(loaded.length)}`, loaded)
	}
	StateMemory.save('installed_plugins')
	
	Plugins.Vue = new Vue({
		el: '#plugin_list',
		data: {
			showAll: false,
			items: Plugins.all
		},
		computed: {
			plugin_search() {
				var name = $('#plugin_search_bar').val().toUpperCase()
				return this.items.filter(item => {
					if (this.showAll !== item.installed) {
						if (name.length > 0) {
							return (
								item.id.toUpperCase().includes(name) ||
								item.title.toUpperCase().includes(name) ||
								item.description.toUpperCase().includes(name) ||
								item.author.toUpperCase().includes(name)
							)
						}
						return true;
					}
					return false;
				})
			}
		}
	})
}
function switchPluginTabs(installed) {
	$('#plugins .tab_bar > .open').removeClass('open')
	if (installed) {
		$('#installed_plugins').addClass('open')
		Plugins.Vue._data.showAll = false
	} else {
		$('#all_plugins').addClass('open')
		Plugins.Vue._data.showAll = true
	}
}

BARS.defineActions(function() {
	new Action('plugins_window', {
		icon: 'extension',
		category: 'blockbench',
		click: function () {
			showDialog('plugins')
			$('#plugin_list').css('max-height', limitNumber($(window).height()-300, 80, 600)+'px')
		}
	})
	new Action('reload_plugins', {
		icon: 'sync',
		category: 'blockbench',
		keybind: new Keybind({ctrl: true, key: 74}),
		click: function () {
			Plugins.devReload()
		}
	})
	new Action('load_plugin', {
		icon: 'fa-file-code',
		category: 'blockbench',
		click: function () {
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
		click: function () {
			Blockbench.textPrompt('URL', '', url => {
				new Plugin().loadFromURL(url, true)
			})
		}
	})
})
