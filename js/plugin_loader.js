/*
Plugin Loader for Blockbench
By JannisX11
*/
var onUninstall, onInstall;
var Plugins = {
	apipath: 'http://blockbench.net/api/plugins.json',
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
		Plugins.data.forEach(function(pl) {
			if (pl.fromFile) {
				pl.reload()
			}
		})
	}
}

if (isApp) {
	Plugins.path = __dirname.replace('resources'+osfs+'app.asar', 'plugins'+osfs)
	fs.readdir(Plugins.path, function(err) {
	    if (err) {
	        fs.mkdir(Plugins.path, function(a) {})
	    }
	})
} else {
	Plugins.apipath = '../api/plugins.json'
}
$.getJSON('http://blockbench.net/api/plugins.json', function(data) {
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
				icon: plugin.icon,
				variant: plugin.variant,
				installed: Plugins.installed.includes(id)
			}
			if (obj.installed) {
				loadPlugin(id)
			}
			Plugins.data.push(obj)
			Plugins.data.sort(function(a,b) {
				return sort_collator.compare(a.title, b.title)
			});
		}
	} else if (Plugins.installed.length > 0) {
		Plugins.installed.forEach(function(id) {
			loadPlugin(id, function() {
				//Plugin Data Comes from the plugin file
				if (plugin_data === undefined) return;
				var obj = {
					id: id,
					title: plugin_data.title,
					author: plugin_data.author,
					description: plugin_data.description,
					icon: plugin_data.icon,
					variant: plugin_data.variant,
					installed: true
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
					if (this.showAll || item.installed) {
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
			install: function(event) {
				var id = $(event.target.parentElement.parentElement).attr('plugin')
				if (isApp) {
					downloadPlugin(id)
				} else {
					loadPlugin(id)
				}
			},
			uninstall: function() {
				var id = $(event.target.parentElement.parentElement).attr('plugin')
				uninstallPlugin(id)
			},
			update: function() {
				if (isApp) {
					var id = $(event.target.parentElement.parentElement).attr('plugin')
					downloadPlugin(id)
				}
			},
			checkIfInstallable: function(plugin) {
				var result = 
					plugin.variant === 'both' ||
					(
						isApp === (plugin.variant === 'desktop') && 
						isApp !== (plugin.variant === 'web')
					);
				return result;
					
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
			var index = Plugins.installed.indexOf(id)
			if (index > -1) {
				Plugins.installed.splice(index, 1)
			}
			var data_obj = Plugins.data.findInArray('id', id)
			data_obj.installed = false
			if (data_obj.uninstall) {
				data_obj.uninstall()
			}
		})
	} else {
		$.getScript('http://blockbench.net/api/plugins/'+id+'.js', function() {
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
function loadPluginFromFile() {
	function readFromPluginFile(content, path, hideWarning) {
		if (!hideWarning) {
			if (isApp) {
				if (!confirm('Do you want to allow this plugin to make changes to your PC? Only load plugins from people you trust.')) return;
			} else {
				if (!confirm('Do you want to load this plugin? Only load plugins from people you trust.')) return;
			}
		}
		try {
			eval(content)
		} catch (err) {
			showQuickMessage('Invalid Plugin File, See Console')
			console.error(err)
			return;
		}
		var obj = {
			author: 'x11',
			icon: 'refresh',
			installed: true,
			id: 'test',
			title: 'Plugin',
			variant: 'both',
			description: '',
			fromFile: true,
			filePath: path,
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
						readFromPluginFile(data, path, true)
				    })
				}
			},
			uninstallMethod: false
		}
		$.extend(true, obj, plugin_data)
		obj.uninstallMethod = onUninstall
		onUninstall = undefined
		Plugins.data.push(obj)
		Plugins.data.sort(function(a,b) {
			return sort_collator.compare(a.title, b.title)
		});
	}
	Blockbench.import('.js', readFromPluginFile, ['bbplugin', 'js'])
}
function downloadPlugin(id) {
    //$('.uc_btn').attr('disabled', true)

    var file = originalFs.createWriteStream(Plugins.path+id+'.js')
    var request = http.get('http://blockbench.net/api/plugins/'+id+'.js', function(response) {
        response.pipe(file);
        response.on('end', function() {
        	setTimeout(function() {
        		loadPlugin(id, undefined, true)
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