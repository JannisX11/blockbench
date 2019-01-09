/*
Plugin Loader for Blockbench
By JannisX11
*/
var onUninstall, onInstall;
const Plugins = {
	apipath: 'https://raw.githubusercontent.com/JannisX11/blockbench-plugins/master/plugins.json',
	Vue: [],			//Vue Object
	installed: [], 		//Simple List of Names
	json: undefined,	//Json from website
	data: [],			//Vue Object Data
	loadingStep: false,
	updateSearch: function() {
		Plugins.Vue._data.showAll = !Plugins.Vue._data.showAll
		Plugins.Vue._data.showAll = !Plugins.Vue._data.showAll
	},
	devReload: function() {
		var reloads = 0;
		Plugins.data.forEach(function(pl) {
			if (pl.fromFile) {
				pl.reload()
				reloads++;
			}
		})
		console.log('Reloaded '+reloads+ ' plugin'+pluralS(reloads))
	}
}

if (isApp) {
	Plugins.path = app.getPath('userData')+osfs+'plugins'+osfs
	fs.readdir(Plugins.path, function(err) {
		if (err) {
			fs.mkdir(Plugins.path, function(a) {})
		}
	})
}
$.getJSON(Plugins.apipath, function(data) {
	Plugins.json = data
	if (Plugins.loadingStep === true) {
		loadInstalledPlugins()
	} else {
		Plugins.loadingStep = true
	}
}).fail(function() {
	console.log('Could not connect to plugin server')
	$('#plugin_available_empty').text('Could not connect to plugin server')
	if (Plugins.loadingStep === true) {
		loadInstalledPlugins()
	} else {
		Plugins.loadingStep = true
	}
})

$(document).ready(function() {
	if (Plugins.loadingStep === true) {
		loadInstalledPlugins()
	} else {
		Plugins.loadingStep = true
	}
})

function loadInstalledPlugins() {
	var storage_data = localStorage.getItem('installed_plugins')
	if (storage_data !== null) {
		Plugins.installed = JSON.parse(storage_data)
	}
	if (Plugins.json !== undefined) {
		for (var id in Plugins.json) {
			var plugin = Plugins.json[id]
			var obj = {
				id: id,
				title: plugin.title,
				author: plugin.author,
				description: plugin.description,
				about: plugin.about,
				icon: plugin.icon,
				variant: plugin.variant,
				min_version: plugin.min_version,
				installed: Plugins.installed.includes(id),
				expanded: false
			}
			if (obj.installed) {
				if (isApp) {
					downloadPlugin(id)
				} else {
					loadPlugin(id)
				}
			}
			Plugins.data.push(obj)
			Plugins.data.sort(function(a,b) {
				return sort_collator.compare(a.title, b.title)
			});
		}
	} else if (Plugins.installed.length > 0) {
		//Only show downloaded plugins in the plugin window
		Plugins.installed.forEach(function(id) {
			loadPlugin(id, function() {
				//Plugin Data Comes from the plugin file
				if (plugin_data === undefined) return;
				var obj = {
					id: id,
					title: plugin_data.title,
					author: plugin_data.author,
					description: plugin_data.description,
					about: plugin_data.about,
					icon: plugin_data.icon,
					variant: plugin_data.variant,
					min_version: plugin_data.min_version,
					installed: true,
					expanded: false
				}
				Plugins.data.push(obj)
				Plugins.data.sort(function(a,b) {
					return sort_collator.compare(a.title, b.title)
				});
			})
		})
	}
	if (Plugins.installed.length > 0) {
		console.log('Loaded '+Plugins.installed.length+' plugin'+pluralS(Plugins.installed.length))
	}
	

	Plugins.Vue = new Vue({
		el: '#plugin_list',
		data: {
			showAll: false,
			items: Plugins.data
		},
		computed: {
			installedPlugins() {
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
		},
		methods: {
			install: function(plugin) {
				if (isApp) {
					downloadPlugin(plugin.id)
				} else {
					loadPlugin(plugin.id)
				}
			},
			uninstall: function(plugin) {
				uninstallPlugin(plugin.id)
			},
			update: function(plugin) {
				if (isApp) {
					downloadPlugin(plugin.id)
				}
			},
			checkIfInstallable: function(plugin) {
				var result = 
					plugin.variant === 'both' ||
					(
						isApp === (plugin.variant === 'desktop') && 
						isApp !== (plugin.variant === 'web')
					);
				if (result && plugin.min_version) {
					result = compareVersions(plugin.min_version, appVersion) ? 'outdated' : true
				} else if (result === false) {
					result = (plugin.variant === 'web') ? 'web_only' : 'app_only'
				}
				return (result === true) ? true : tl('dialog.plugins.'+result);	
			},
			toggleInfo: function(plugin, force) {
				Plugins.data.forEach(function(p) {
					if (p !== plugin && p.expanded) p.expanded = false;
				})
				plugin.expanded = plugin.expanded !== true
				if (force !== undefined) {
					plugin.expanded = force === true
				}
				if (plugin.expanded) {
					plugin.expandicon = 'expand_less'
				} else {
					plugin.expandicon = 'expand_more'
				}
			}
		}
	})
}
function saveInstalledPlugins() {
	localStorage.setItem('installed_plugins', JSON.stringify(Plugins.installed))
	hideDialog()
}
function loadPlugin(id, cb, install) {
	if (isApp === true) {
		$.getScript(Plugins.path + id + '.js', function(a) {
			if (onUninstall) {
				Plugins.data.findInArray('id', id).uninstall = onUninstall
				onUninstall = undefined
			}
			if (install && onInstall) {
				onInstall()
			}
			onInstall = undefined
			if (cb !== undefined) cb()
		}).fail(function() {
			console.log('Could not find file of plugin "'+id+'". Uninstalling it instead.')
			uninstallPlugin(id)
			saveInstalledPlugins()
		})
	} else {
		$.getScript('https://raw.githubusercontent.com/JannisX11/blockbench-plugins/master/plugins/'+id+'.js', function() {
			if (onUninstall) {
				Plugins.data.findInArray('id', id).uninstall = onUninstall
				onUninstall = undefined
			}
			if (install && onInstall) {
				onInstall()
			}
			onInstall = undefined
			if (cb) cb()
		})
	}
	if (Plugins.installed.includes(id) === false) {
		Plugins.installed.push(id)
	}
	Plugins.data.findInArray('id', id).installed = true
}
function loadPluginFromFile(file, hideWarning) {
	var hideWarning;
	var content = file.content
	var path = file.path
	localStorage.setItem('plugin_dev_path', path)
	onInstall = undefined

	if (!hideWarning) {
		if (isApp) {
			if (!confirm(tl('message.load_plugin_app'))) return;
		} else {
			if (!confirm(tl('message.load_plugin_web'))) return;
		}
	}
	try {
		eval(content)
	} catch (err) {
		Blockbench.showQuickMessage('message.invalid_plugin')
		console.error(err)
		return;
	}
	var obj = {
		author: 'unknown',
		icon: 'extension',
		installed: true,
		id: 'test',
		title: 'Plugin',
		variant: 'both',
		description: '',
		about: '',
		fromFile: true,
		filePath: path,
		expanded: false,
		uninstall: function() {
			var index = Plugins.data.indexOf(this)
			if (index >= 0) Plugins.data.splice(index, 1)
			if (this.uninstallMethod) {
				this.uninstallMethod()
			}
		},
		reload: function() {
			if (isApp) {
				obj.uninstall()
				fs.readFile(path, 'utf-8', function (err, data) {
					if (err) {
						console.log(err)
						return;
					}
					loadPluginFromFile({
						content: data,
						path: path
					}, true)
				})
			}
		},
		uninstallMethod: false
	}
	$.extend(true, obj, plugin_data)
	obj.uninstallMethod = onUninstall
	onUninstall = undefined
	if (onInstall) onInstall()
	onInstall = undefined
	Plugins.data.push(obj)
	Plugins.data.sort(function(a,b) {
		return sort_collator.compare(a.title, b.title)
	});
}
function downloadPlugin(id, is_install) {
	//$('.uc_btn').attr('disabled', true)

	var file = originalFs.createWriteStream(Plugins.path+id+'.js')
	var request = https.get('https://raw.githubusercontent.com/JannisX11/blockbench-plugins/master/plugins/'+id+'.js', function(response) {
		response.pipe(file);
		response.on('end', function() {
			setTimeout(function() {
				loadPlugin(id, undefined, is_install)
			}, 100)
		})
	});
}
function uninstallPlugin(id) {
	if (isApp) {
		var filepath = Plugins.path + id + '.js'
		if (fs.existsSync(filepath)) {
			fs.unlink(filepath, (err) => {
				if (err) {
					console.log(err);
					return;
				}
			});
		} else {
			//File does not exist
		}
	}
	var index = Plugins.installed.indexOf(id)
	if (index > -1) {
		Plugins.installed.splice(index, 1)
	}
	var data_obj = Plugins.data.findInArray('id', id)
	data_obj.installed = false
	if (data_obj.uninstall) {
		data_obj.uninstall()
	}
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
		id: 'load_plugin',
		icon: 'fa-file-code-o',
		category: 'blockbench',
		click: function () {
			Blockbench.import({
				extensions: ['bbplugin', 'js'],
				type: 'Blockbench Plugin',
				startpath: localStorage.getItem('plugin_dev_path')
			}, function(files) {
				loadPluginFromFile(files[0])
			})
		}
	})
})
