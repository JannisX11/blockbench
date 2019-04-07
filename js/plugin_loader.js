var onUninstall, onInstall;
const Plugins = {
	apipath: 'https://raw.githubusercontent.com/JannisX11/blockbench-plugins/master/plugins.json',
	Vue: [],			//Vue Object
	installed: [], 		//Simple List of Names
	json: undefined,	//Json from website
	all: [],			//Vue Object Data
	loadingStep: false,
	updateSearch: function() {
		Plugins.Vue._data.showAll = !Plugins.Vue._data.showAll
		Plugins.Vue._data.showAll = !Plugins.Vue._data.showAll
	},
	devReload: function() {
		var reloads = 0;
		for (var i = Plugins.all.length-1; i >= 0; i--) {
			if (Plugins.all[i].fromFile) {
				Plugins.all[i].reload()
				reloads++;
			}
		}
		Blockbench.showQuickMessage(tl('message.plugin_reload', [reloads]))
		console.log('Reloaded '+reloads+ ' plugin'+pluralS(reloads))
	}
}

class Plugin {
	constructor(id, data) {
		this.id = id;
		this.installed = false;
		this.expanded = false;
		this.title = '';
		this.author = '';
		this.description = '';
		this.about = '';
		this.icon = '';
		this.variant = '';
		this.min_version = '';
		if (data) {
			this.extend(data)
		}
	}
	extend(data) {
		Merge.boolean(this, data, 'installed')
		Merge.boolean(this, data, 'expanded')
		Merge.string(this, data, 'title')
		Merge.string(this, data, 'author')
		Merge.string(this, data, 'description')
		Merge.string(this, data, 'about')
		Merge.string(this, data, 'icon')
		Merge.string(this, data, 'variant')
		Merge.string(this, data, 'min_version')
		return this;
	}
	install(first, cb) {
		var scope = this;
		$.getScript(Plugins.path + scope.id + '.js', function() {
			scope.bindGlobalData(first)
			if (cb) cb()
		}).fail(function() {
			if (isApp) {
				console.log('Could not find file of plugin "'+scope.id+'". Uninstalling it instead.')
				scope.uninstall()
			}
		})
		Plugins.installed.safePush(scope.id)
		scope.installed = true;
		return scope;
	}
	bindGlobalData(first) {
		var scope = this;
		if (onUninstall) {
			scope.onUninstall = onUninstall
		}
		if (first && onInstall) {
			onInstall()
		}
		window.onInstall = window.onUninstall = window.plugin_data = undefined
		return this;
	}
	download(first) {
		var scope = this;
		if (first) {
			Blockbench.showQuickMessage(tl('message.install_plugin', [scope.title]), 1400)
		}
		if (!isApp) {
			scope.install(first)
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
	loadFromFile(file, hideWarning) {
		var scope = this;
		var path = file.path
		localStorage.setItem('plugin_dev_path', file.path)
		onInstall = undefined

		if (!hideWarning) {
			if (isApp) {
				if (!confirm(tl('message.load_plugin_app'))) return;
			} else {
				if (!confirm(tl('message.load_plugin_web'))) return;
			}
		}
		$.getScript(file.path, function() {
			scope.id = (plugin_data && plugin_data.id)||pathToName(file.path)
			scope.installed = true
			scope.fromFile = true
			scope.path = file.path
			scope.extend(plugin_data)
			scope.bindGlobalData(true)
			Plugins.installed.safePush(scope.path)
			saveInstalledPlugins()
			Plugins.all.sort(function(a,b) {
				return sort_collator.compare(a.title, b.title)
			});
		})
		Plugins.all.safePush(this)
		return this;
	}
	uninstall() {
		var scope = this;
		if (isApp && this.fromFile) {
			if (this.onUninstall) {
				this.onUninstall()
			}
			Plugins.all.remove(this)
			Plugins.installed.remove(this.path)
		} else {
			if (isApp) {
				var filepath = Plugins.path + scope.id + '.js'
				if (fs.existsSync(filepath)) {
					fs.unlink(filepath, (err) => {
						if (err) {
							console.log(err);
						}
					});
				}
			}
			Plugins.installed.remove(scope.id)
			scope.installed = false
			if (scope.onUninstall) {
				scope.onUninstall()
			}
		}
		saveInstalledPlugins()
		return this;
	}
	reload() {
		if (!isApp) return this;
		this.uninstall()
		this.loadFromFile({path: this.path}, true)
		return this;
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
$(document).ready(function() {
	loadInstalledPlugins()
})

function loadInstalledPlugins() {
	if (!Plugins.loadingStep) {
		Plugins.loadingStep = true
		return;
	}
	var storage_data = localStorage.getItem('installed_plugins')
	if (storage_data !== null) {
		Plugins.installed = JSON.parse(storage_data)
	}
	if (Plugins.json !== undefined) {
		//From Store
		for (var id in Plugins.json) {
			var plugin = new Plugin(id, Plugins.json[id])
			if (Plugins.installed.includes(id)) {
				plugin.download()
			}
			Plugins.all.push(plugin)
		}
		Plugins.all.sort(function(a,b) {
			return sort_collator.compare(a.title, b.title)
		});
	} else if (Plugins.installed.length > 0 && isApp) {
		Plugins.installed.forEach(function(id) {

			if (id.substr(-3) !== '.js') {
				//downloaded public plugin
				var plugin = new Plugin(id).install(false, () => {
					if (typeof plugin_data === 'object') {
						plugin.extend(plugin_data)
						Plugins.all.push(plugin)
						Plugins.all.sort(function(a,b) {
							return sort_collator.compare(a.title, b.title)
						});
					}
				})
			}
		})
	}
	if (Plugins.installed.length > 0) {
		var loaded = []
		Plugins.installed.forEach(function(id) {

			if (id && id.substr(-3) === '.js') {
				//Dev Plugins
				var plugin = new Plugin().loadFromFile({path: id}, true)
				loaded.push(pathToName(id))
			} else if (id) {
				loaded.push(id)
			}
		})
		console.log(`Loaded ${loaded.length} plugin${pluralS(loaded.length)}`, loaded)
	}
	
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
function saveInstalledPlugins() {
	localStorage.setItem('installed_plugins', JSON.stringify(Plugins.installed))
}
function loadPluginFromFile(file) {
	var plugin = new Plugin().loadFromFile(file, false)
}
function switchPluginTabs(installed) {
	$('#plugins .tab').removeClass('open')
	if (installed) {
		$('#installed_plugins').addClass('open')
		Plugins.Vue._data.showAll = false
	} else {
		$('#all_plugins').addClass('open')
		Plugins.Vue._data.showAll = true
	}
}

BARS.defineActions(function() {
	new Action({
		id: 'plugins_window',
		icon: 'extension',
		category: 'blockbench',
		click: function () {
			showDialog('plugins')
			$('#plugin_list').css('max-height', limitNumber($(window).height()-300, 80, 600)+'px')
		}
	})
	new Action({
		id: 'reload_plugins',
		icon: 'sync',
		category: 'blockbench',
		keybind: new Keybind({ctrl: true, key: 74}),
		click: function () {
			Plugins.devReload()
		}
	})
	new Action({
		id: 'load_plugin',
		icon: 'fa-file-code-o',
		category: 'blockbench',
		click: function () {
			Blockbench.import({
				extensions: ['js'],
				type: 'Blockbench Plugin',
				startpath: localStorage.getItem('plugin_dev_path')
			}, function(files) {
				loadPluginFromFile(files[0])
			})
		}
	})
})
