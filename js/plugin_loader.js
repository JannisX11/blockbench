var onUninstall, onInstall;
const Plugins = {
	Vue: [],			//Vue Object
	installed: [], 		//Simple List of Names
	json: undefined,	//Json from website
	download_stats: {},
	all: [],			//Vue Object Data
	registered: {},
	currently_loading: '',
	api_path: settings.cdn_mirror.value ? 'https://blckbn.ch/cdn/plugins' : 'https://cdn.jsdelivr.net/gh/JannisX11/blockbench-plugins/plugins',
	devReload() {
		let reloads = 0;
		for (let i = Plugins.all.length-1; i >= 0; i--) {
			let plugin = Plugins.all[i];
			if (plugin.source == 'file' && plugin.isReloadable()) {
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

async function runPluginFile(path, plugin_id) {
	let file_content;
	if (path.startsWith('http')) {
		if (!path.startsWith('https')) {
			throw 'Cannot load plugins over http: ' + path;
		}
		await new Promise((resolve, reject) => {
			$.ajax({
				cache: false,
				url: path,
				success(data) {
					file_content = data;
					resolve();
				},
				error() {
					reject('Failed to load plugin ' + plugin_id);
				}
			});
		})

	} else if (isApp) {
		file_content = fs.readFileSync(path, {encoding: 'utf-8'});

	} else {
		throw 'Failed to load plugin: Unknown URL format'
	}
	if (typeof file_content != 'string' || file_content.length < 20) {
		throw `Issue loading plugin "${plugin_id}": Plugin file empty`;
	}
	let func = new Function(file_content + `\n//# sourceURL=PLUGINS/(Plugin):${plugin_id}.js`);
	func();
	return file_content;
}

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
		this.deprecation_note = '';
		this.website = '';
		this.source = 'store';
		this.creation_date = 0;
		this.contributes = {};
		this.await_loading = false;
		this.has_changelog = false;
		this.changelog = null;
		this.details = null;
		this.about_fetched = false;
		this.changelog_fetched = false;
		this.disabled = false;
		this.new_repository_format = false;
		this.cache_version = 0;

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
		Merge.string(this, data, 'deprecation_note')
		Merge.string(this, data, 'website')
		Merge.string(this, data, 'repository')
		Merge.string(this, data, 'bug_tracker')
		Merge.boolean(this, data, 'await_loading');
		Merge.boolean(this, data, 'has_changelog');
		Merge.boolean(this, data, 'disabled');
		if (data.creation_date) this.creation_date = Date.parse(data.creation_date);
		if (data.tags instanceof Array) this.tags.safePush(...data.tags.slice(0, 3));
		if (data.dependencies instanceof Array) this.dependencies.safePush(...data.dependencies);

		if (data.new_repository_format) this.new_repository_format = true;
		if (this.min_version != '' && !compareVersions('4.8.0', this.min_version)) {
			this.new_repository_format = true;
		}
		if (typeof data.contributes == 'object') {
			this.contributes = data.contributes;
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
		if (this.tags.includes('Deprecated') || this.deprecation_note) {
			let message = tl('message.plugin_deprecated.message');
			if (this.deprecation_note) {
				message += '\n\n*' + this.deprecation_note + '*';
			}
			let answer = await new Promise((resolve) => {
				Blockbench.showMessageBox({
					icon: 'warning',
					title: this.title,
					message,
					cancelIndex: 0,
					buttons: ['dialog.cancel', 'message.plugin_deprecated.install_anyway']
				}, resolve)
			})
			if (answer == 0) return;
		}
		return await this.download(true);
	}
	async load(first, cb) {
		var scope = this;
		Plugins.registered[this.id] = this;
		return await new Promise((resolve, reject) => {
			let path = Plugins.path + scope.id + '.js';
			if (!isApp && this.new_repository_format)  {
				path = `${Plugins.path}${scope.id}/${scope.id}.js`;
			}
			runPluginFile(path, this.id).then((content) => {
				if (cb) cb.bind(scope)()
				scope.bindGlobalData(first)
				if (first && scope.oninstall) {
					scope.oninstall()
				}
				if (first) Blockbench.showQuickMessage(tl('message.installed_plugin', [this.title]));
				resolve()
			}).catch((error) => {
				if (isApp) {
					console.log('Could not find file of plugin "'+scope.id+'". Uninstalling it instead.')
					scope.uninstall()
				}
				if (first) Blockbench.showQuickMessage(tl('message.installed_plugin_fail', [this.title]));
				reject()
				console.error(error)
			})
			this.remember()
			scope.installed = true;
		})
	}
	async installDependencies(first) {
		let required_dependencies = [];
		for (let id of this.dependencies) {
			let saved_install = !first && Plugins.installed.find(p => p.id == id);
			if (saved_install) {
				continue;
			}
			let plugin = Plugins.all.find(p => p.id == id);
			if (plugin) {
				if (plugin.installed == false) required_dependencies.push(plugin);
				continue;
			}
			required_dependencies.push(id);
		}
		if (required_dependencies.length) {
			let failed_dependency = required_dependencies.find(p => {
				return !p.isInstallable || p.isInstallable() != true
			});
			if (failed_dependency) {
				let error_message = failed_dependency;
				if (failed_dependency instanceof Plugin) {
					error_message = `**${failed_dependency.title}**: ${failed_dependency.isInstallable()}`;
				}
				Blockbench.showMessageBox({
					title: 'message.plugin_dependencies.title',
					message: `Updating **${this.title||this.id}**:\n\n${tl('message.plugin_dependencies.invalid')}\n\n${error_message}`,
				});
				return false;
			}

			let list = required_dependencies.map(p => `**${p.title}** ${tl('dialog.plugins.author', [p.author])}`);
			let response = await new Promise(resolve => {
				Blockbench.showMessageBox({
					title: 'message.plugin_dependencies.title',
					message: `${tl('message.plugin_dependencies.' + (first ? 'message1' : 'message1_update'), [this.title])} \n\n* ${ list.join('\n* ') }\n\n${tl('message.plugin_dependencies.message2')}`,
					buttons: ['dialog.continue', first ? 'dialog.cancel' : 'dialog.plugins.uninstall'],
					width: 512,
				}, button => {
					resolve(button == 0);
				})
			})
			if (!response) {
				if (this.installed) this.uninstall();
				return false;
			}

			for (let dependency of required_dependencies) {
				await dependency.install();
			}
		}
		return true;
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
		let response = await this.installDependencies(first);
		if (response == false) return;

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
			https.get(Plugins.api_path+'/'+origin_filename, function(response) {
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

		if (isApp) {
			let content = await runPluginFile(file.path, this.id).catch((error) => {
				console.error(error);
			});
			if (content) {
				if (window.plugin_data) {
					scope.id = (plugin_data && plugin_data.id)||pathToName(file.path)
					scope.extend(plugin_data)
					scope.bindGlobalData()
				}
				if (first && scope.oninstall) {
					scope.oninstall()
				}
				scope.path = file.path;
			}
		} else {
			try {
				new Function(file.content + `\n//# sourceURL=PLUGINS/(Plugin):${this.id}.js`)();
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
		}
		this.installed = true;
		this.remember();
		Plugins.sort();
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
		let content = await runPluginFile(url, this.id).catch((error) => {
			if (isApp) {
				this.load().then(resolve).catch(resolve)
			}
			console.error(error);
		})
		if (content) {
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
				await new Promise((resolve) => {
					let file = originalFs.createWriteStream(Plugins.path+this.id+'.js')
					https.get(url, (response) => {
						response.pipe(file);
						response.on('end', resolve)
					}).on('error', reject);
				})
			}
		}
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
			console.error(`Error in unload or uninstall method of "${this.id}": `, err);
		}
		delete Plugins.registered[this.id];
		let in_installed = Plugins.installed.find(plugin => plugin.id == this.id);
		Plugins.installed.remove(in_installed);
		StateMemory.save('installed_plugins')
		this.installed = false;
		this.disabled = false;

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

		this.cache_version++;
		this.unload()
		this.tags.empty();
		this.dependencies.empty();
		Plugins.all.remove(this);
		this.details = null;
		let had_changelog = this.changelog_fetched;
		this.changelog_fetched = false;

		if (this.source == 'file') {
			this.loadFromFile({path: this.path}, false)

		} else if (this.source == 'url') {
			this.loadFromURL(this.path, false)
		}

		this.fetchAbout(true);
		if (had_changelog && this.has_changelog) {
			this.fetchChangelog(true);
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
		//if (!this.installed) return;
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
					return this.path.replace(/\w+\.js$/, this.icon + (this.cache_version ? '?'+this.cache_version : ''));
				}
			return `${Plugins.api_path}/${this.id}/${this.icon}`;
		}
		return this.icon;
	}
	async fetchAbout(force) {
		if (((!this.about_fetched && !this.about) || force) && this.new_repository_format) {
			if (isApp && this.installed) {
				try {
					let about_path;
					if (this.source == 'store') {
						about_path = PathModule.join(Plugins.path, this.id + '.about.md');
					} else {
						about_path = this.path.replace(/\w+\.js$/, 'about.md');
					}
					let content = fs.readFileSync(about_path, {encoding: 'utf-8'});
					this.about = content;
					this.about_fetched = true;
					return;
				} catch (err) {
					console.error('failed to get about for plugin ' + this.id);
				}
			}
			let url = `${Plugins.api_path}/${this.id}/about.md`;
			let result = await fetch(url).catch(() => {
				console.error('about.md missing for plugin ' + this.id);
			});
			if (result.ok) {
				this.about = await result.text();
			}
			this.about_fetched = true;
		}
	}
	async fetchChangelog(force) {
		if ((!this.changelog_fetched && !this.changelog) || force) {
			function reverseOrder(input) {
				let output = {};
				Object.keys(input).forEachReverse(key => {
					output[key] = input[key];
				})
				return output;
			}
			if (isApp && this.installed && this.source != 'store') {
				try {
					let changelog_path = this.path.replace(/\w+\.js$/, 'changelog.json');
					let content = fs.readFileSync(changelog_path, {encoding: 'utf-8'});
					this.changelog = reverseOrder(JSON.parse(content));
					this.changelog_fetched = true;
					return;
				} catch (err) {
					console.error('failed to get changelog for plugin ' + this.id, err);
				}
			}
			let url = `${Plugins.api_path}/${this.id}/changelog.json`;
			let result = await fetch(url).catch(() => {
				console.error('changelog.json missing for plugin ' + this.id);
			});
			if (result.ok) {
				this.changelog = reverseOrder(await result.json());
			}
			this.changelog_fetched = true;
		}
	}
	getPluginDetails() {
		if (this.details) return this.details;
		this.details = {
			version: this.version,
			last_modified: 'N/A',
			creation_date: 'N/A',
			last_modified_full: '',
			creation_date_full: '',
			min_version: this.min_version ? (this.min_version+'+') : '-',
			max_version: this.max_version || '',
			website: this.website || '',
			repository: this.repository || '',
			bug_tracker: this.bug_tracker || '',
			author: this.author,
			variant: this.variant == 'both' ? 'All' : this.variant,
			weekly_installations: separateThousands(Plugins.download_stats[this.id] || 0),
		};

		let trackDate = (input_date, key) => {
			let date = getDateDisplay(input_date);
			this.details[key] = date.short;
			this.details[key + '_full'] = date.full;
		}
		if (this.source == 'store') {
			if (!this.details.bug_tracker) {
				this.details.bug_tracker = `https://github.com/JannisX11/blockbench-plugins/issues/new?title=[${this.title}]`;
			}
			if (!this.details.repository) {
				this.details.repository = `https://github.com/JannisX11/blockbench-plugins/tree/master/plugins/${this.id + (this.new_repository_format ? '' : '.js')}`;
			}

			let github_path = (this.new_repository_format ? (this.id+'/'+this.id) : this.id) + '.js';
			let commit_url = `https://api.github.com/repos/JannisX11/blockbench-plugins/commits?path=plugins/${github_path}`;
			fetch(commit_url).catch((err) => {
				console.error('Cannot access commit info for ' + this.id, err);
			}).then(async response => {
				let commits = await response.json().catch(err => console.error(err));
				if (!commits || !commits.length) return;
				trackDate(Date.parse(commits[0].commit.committer.date), 'last_modified');

				if (!this.creation_date) {
					trackDate(Date.parse(commits.last().commit.committer.date), 'creation_date');
				}
			});

		}
		if (this.creation_date) {
			trackDate(this.creation_date, 'creation_date');
		}
		return this.details;
	}
}
Plugin.prototype.menu = new Menu([
	new MenuSeparator('installation'),
	{
		name: 'generic.share',
		icon: 'share',
		condition: plugin => Plugins.json[plugin.id],
		click(plugin) {
			let url = `https://www.blockbench.net/plugins/${plugin.id}`;
			new Dialog('share_plugin', {
				title: tl('generic.share') + ': ' + plugin.title,
				icon: 'extension',
				form: {
					link: {type: 'text', value: url, readonly: true, share_text: true}
				}
			}).show();
		}
	},
	'_',
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
		condition: plugin => (plugin.installed && !plugin.disabled),
		click(plugin) {
			plugin.toggleDisabled();
		}
	},
	{
		name: 'dialog.plugins.enable',
		icon: 'bedtime',
		condition: plugin => (plugin.installed && plugin.disabled),
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
			showItemInFolder(plugin.path);
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
		return;
	};
	plugin.extend(data)
	if (plugin.isInstallable() == true && plugin.disabled == false) {
		if (plugin.onload instanceof Function) {
			Plugins.currently_loading = id;
			plugin.onload();
			Plugins.currently_loading = '';
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
	Plugins.path = Plugins.api_path+'/';
}

Plugins.loading_promise = new Promise((resolve, reject) => {
	$.ajax({
		cache: false,
		url: Plugins.api_path+'.json',
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

			if (settings.cdn_mirror.value == false && navigator.onLine) {
				settings.cdn_mirror.set(true);
				console.log('Switching to plugin CDN mirror. Restart to apply.');
			}
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
		let to_install = [];
		for (let id in Plugins.json) {
			let plugin = new Plugin(id, Plugins.json[id]);
			to_install.push(plugin);
		}
		Plugins.sort();

		for (let plugin of to_install) {
			let installed_match = Plugins.installed.find(p => {
				return p && p.id == plugin.id && p.source == 'store'
			});
			if (installed_match) {
				plugin.installed = true;
				if (installed_match.disabled) plugin.disabled = true;

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
				if (plugin.path) {
					var instance = new Plugin(plugin.id, {disabled: plugin.disabled});
					install_promises.push(instance.loadFromURL(plugin.path, false));
					load_counter++;
					console.log(`🧩🌐 Loaded plugin "${plugin.id || plugin.path}" from URL`);
				} else {
					Plugins.installed.remove(plugin);
				}

			} else {
				if (Plugins.all.find(p => p.id == plugin.id)) {
					load_counter++;
					console.log(`🧩🛒 Loaded plugin "${plugin.id}" from store`);
				} else if (Plugins.json instanceof Object && navigator.onLine) {
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
		resizable: 'xy',
		component: {
			data: {
				tab: 'installed',
				page_tab: 'about',
				search_term: '',
				items: Plugins.all,
				selected_plugin: null,
				page: 0,
				per_page: 25,
				settings: settings,
				isMobile: Blockbench.isMobile,
			},
			computed: {
				plugin_search() {
					let search_name = this.search_term.toUpperCase();
					if (search_name) {
						let filtered = this.items.filter(item => {
							return (
								item.id.toUpperCase().includes(search_name) ||
								item.title.toUpperCase().includes(search_name) ||
								item.description.toUpperCase().includes(search_name) ||
								item.author.toUpperCase().includes(search_name) ||
								item.tags.find(tag => tag.toUpperCase().includes(search_name))
							)
						});
						let installed = filtered.filter(p => p.installed);
						let not_installed = filtered.filter(p => !p.installed);
						return installed.concat(not_installed);
					} else {
						return this.items.filter(item => {
							return (this.tab == 'installed') == item.installed;
						})
					}
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
				},
				selected_plugin_settings() {
					if (!this.selected_plugin) return {};
					let plugin_settings = {};
					for (let id in this.settings) {
						if (settings[id].plugin == this.selected_plugin.id) {
							plugin_settings[id] = settings[id];
						}
					}
					return plugin_settings;
				}
			},
			methods: {
				setTab(tab) {
					this.tab = tab;
					this.setPage(0);
				},
				setPage(number) {
					this.page = number;
					this.$refs.plugin_list.scrollTop = 0;
				},
				selectPlugin(plugin) {
					if (!plugin) {
						this.selected_plugin = Plugin.selected = null;
						return;
					}
					plugin.fetchAbout();
					this.selected_plugin = Plugin.selected = plugin;
					if (!this.selected_plugin.installed && this.page_tab == 'settings') {
						this.page_tab == 'about';
					}
					if (this.page_tab == 'changelog') {
						if (plugin.has_changelog) {
							plugin.fetchChangelog();
						} else {
							this.page_tab == 'about';
						}
					}
				},
				setPageTab(tab) {
					this.page_tab = tab;
					if (this.page_tab == 'changelog' && this.selected_plugin.has_changelog) {
						this.selected_plugin.fetchChangelog();
					}
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
				reduceLink(url) {
					url = url.replace('https://', '').replace(/\/$/, '');
					if (url.length > 50) {
						return url.substring(0, 50)+'...';
					} else {
						return url;
					}
				},
				printDate(input_date) {
					return getDateDisplay(input_date).short;
				},
				printDateFull(input_date) {
					return getDateDisplay(input_date).full;
				},
				formatChangelogLine(line) {
					let content = [];
					let last_i = 0;
					for (let match of line.matchAll(/\[.+?\]\(.+?\)/g)) {
						let split = match[0].search(/\]\(/);
						let label = match[0].substring(1, split);
						let href = match[0].substring(split+2, match[0].length-1);
						let a = Interface.createElement('a', {href, title: href}, label);
						content.push(line.substring(last_i, match.index));
						content.push(a);
						last_i = match.index + match[0].length;
					}
					content.push(line.substring(last_i));
					let node = Interface.createElement('p', {}, content.filter(a => a));
					return node.innerHTML;
				},

				// Settings
				changePluginSetting(setting) {
					setTimeout(() => {
						if (typeof setting.onChange == 'function') {
							setting.onChange(setting.value);
						}
						Settings.saveLocalStorages();
					}, 20);
				},
				settingContextMenu(setting, event) {
					new Menu([
						{
							name: 'dialog.settings.reset_to_default',
							icon: 'replay',
							click: () => {
								setting.ui_value = setting.default_value;
								Settings.saveLocalStorages();
							}
						}
					]).open(event);
				},
				getProfileValuesForSetting(key) {
					return SettingsProfile.all.filter(profile => {
						return profile.settings[key] !== undefined;
					});
				},

				// Features
				getPluginFeatures(plugin) {
					let types = [];

					let formats = [];
					for (let id in Formats) {
						if (Formats[id].plugin == plugin.id) formats.push(Formats[id]);
					}
					if (formats.length) {
						types.push({
							id: 'formats',
							name: tl('data.format'),
							features: formats.map(format => {
								return {
									id: format.id,
									name: format.name,
									icon: format.icon,
									description: format.description,
									click: format.show_on_start_screen && (() => {
										Dialog.open.close();
										StartScreen.open();
										StartScreen.vue.loadFormat(format);
									})
								}
							})
						})
					}

					let loaders = [];
					for (let id in ModelLoader.loaders) {
						if (ModelLoader.loaders[id].plugin == plugin.id) loaders.push(ModelLoader.loaders[id]);
					}
					if (loaders.length) {
						types.push({
							id: 'loaders',
							name: tl('format_category.loaders'),
							features: loaders.map(loader => {
								return {
									id: loader.id,
									name: loader.name,
									icon: loader.icon,
									description: loader.description,
									click: loader.show_on_start_screen && (() => {
										Dialog.open.close();
										StartScreen.open();
										StartScreen.vue.loadFormat(loader);
									})
								}
							})
						})
					}

					let codecs = [];
					for (let id in Codecs) {
						if (Codecs[id].plugin == plugin.id) codecs.push(Codecs[id]);
					}
					if (codecs.length) {
						types.push({
							id: 'codecs',
							name: 'Codec',
							features: codecs.map(codec => {
								return {
									id: codec.id,
									name: codec.name,
									icon: codec.export_action ? codec.export_action.icon : 'save',
									description: codec.export_action ? codec.export_action.description : ''
								}
							})
						})
					}

					let bar_items = Keybinds.actions.filter(action => action.plugin == plugin.id);
					let tools = bar_items.filter(action => action instanceof Tool);
					let other_actions = bar_items.filter(action => action instanceof Tool == false);

					if (tools.length) {
						types.push({
							id: 'tools',
							name: tl('category.tools'),
							features: tools.map(tool => {
								return {
									id: tool.id,
									name: tool.name,
									icon: tool.icon,
									description: tool.description,
									extra_info: tool.keybind.label,
									click: Condition(tool.condition) && (() => {
										ActionControl.select(tool.name);
									})
								}
							})
						})
					}
					if (other_actions.length) {
						types.push({
							id: 'actions',
							name: 'Action',
							features: other_actions.map(action => {
								return {
									id: action.id,
									name: action.name,
									icon: action.icon,
									description: action.description,
									extra_info: action.keybind.label,
									click: Condition(action.condition) && (() => {
										ActionControl.select(action.name);
									})
								}
							})
						})
					}

					let panels = [];
					for (let id in Panels) {
						if (Panels[id].plugin == plugin.id) panels.push(Panels[id]);
					}
					if (panels.length) {
						types.push({
							id: 'panels',
							name: tl('data.panel'),
							features: panels.map(panel => {
								return {
									id: panel.id,
									name: panel.name,
									icon: panel.icon
								}
							})
						})
					}

					let setting_list = [];
					for (let id in settings) {
						if (settings[id].plugin == plugin.id) setting_list.push(settings[id]);
					}
					if (setting_list.length) {
						types.push({
							id: 'settings',
							name: tl('data.setting'),
							features: setting_list.map(setting => {
								return {
									id: setting.id,
									name: setting.name,
									icon: setting.icon,
									click: () => {
										this.page_tab = 'settings';
									}
								}
							})
						})
					}

					let validator_checks = Validator.checks.filter(check => check.plugin == plugin.id);
					if (validator_checks.length) {
						types.push({
							id: 'validator_checks',
							name: 'Validator Check',
							features: validator_checks.map(validator_check => {
								return {
									id: validator_check.id,
									name: validator_check.name,
									icon: 'task_alt'
								}
							})
						})
					}
					//TODO
					//Modes
					//Element Types
					return types;
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
							<div class="tool" v-if="!isMobile" @click="selectPlugin(null);"><i class="material-icons icon">home</i></div>
							<search-bar id="plugin_search_bar" v-model="search_term" @input="setPage(0)"></search-bar>
						</div>
						<div class="tab_bar" v-if="!search_term">
							<div :class="{open: tab == 'installed'}" @click="setTab('installed')">${tl('dialog.plugins.installed')}</div>
							<div :class="{open: tab == 'available'}" @click="setTab('available')">${tl('dialog.plugins.available')}</div>
						</div>
						<ul class="list" :class="{paginated_list: pages.length > 1}" id="plugin_list" ref="plugin_list">
							<li v-for="plugin in viewed_plugins" :plugin="plugin.id" :class="{plugin: true, testing: plugin.fromFile, selected: plugin == selected_plugin, disabled_plugin: plugin.disabled, installed_plugin: plugin.installed, disabled_plugin: plugin.disabled, incompatible: plugin.isInstallable() !== true}" @click="selectPlugin(plugin)" @contextmenu="selectPlugin(plugin); plugin.showContextMenu($event)">
								<div>
									<div class="plugin_icon_area">
										<img v-if="plugin.hasImageIcon()" :src="plugin.getIcon()" width="48" height="48px" />
										<dynamic-icon v-else :icon="plugin.icon" />
									</div>
									<div>
										<div class="title">{{ plugin.title || plugin.id }}</div>
										<div class="author">{{ tl('dialog.plugins.author', [plugin.author]) }}</div>
									</div>
									<div v-if="plugin.installed && search_term" class="plugin_installed_tag">✓ ${tl('dialog.plugins.is_installed')}</div>
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
					
					<div id="plugin_browser_page" v-if="selected_plugin" :class="{plugin_disabled: selected_plugin.disabled, plugin_installed: selected_plugin.installed}">
						<div v-if="isMobile" @click="selectPlugin(null);" class="plugin_browser_back_button">
							<i class="material-icons icon">arrow_back_ios</i>
							${tl('generic.navigate_back')}</div>
						<div class="plugin_browser_page_header" :class="{disabled_plugin: selected_plugin.disabled}" @contextmenu="selected_plugin.showContextMenu($event)">
							<div class="plugin_browser_page_titlebar" :class="{disabled_plugin: selected_plugin.disabled}">
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
								<button type="button" v-if="selected_plugin.installed" @click="selected_plugin.toggleDisabled()">
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
						</div>

						<ul id="plugin_browser_page_tab_bar">
							<li :class="{selected: page_tab == 'about'}" @click="setPageTab('about')">About</li>
							<li :class="{selected: page_tab == 'details'}" @click="setPageTab('details')">Details</li>
							<li :class="{selected: page_tab == 'changelog'}" @click="setPageTab('changelog')" v-if="selected_plugin.has_changelog">Changelog</li>
							<li :class="{selected: page_tab == 'settings'}" @click="setPageTab('settings')" v-if="selected_plugin.installed">Settings</li>
							<li :class="{selected: page_tab == 'features'}" @click="setPageTab('features')" v-if="selected_plugin.installed">Features</li>
						</ul>

						<dynamic-icon v-if="page_tab == 'about' && !selected_plugin.about && !selected_plugin.hasImageIcon()" :icon="selected_plugin.icon" id="plugin_page_background_decoration" />

						<div class="about markdown" v-show="page_tab == 'about'" v-if="selected_plugin.about" v-html="formatAbout(selected_plugin.about)">
						</div>

						<table v-if="page_tab == 'details'" id="plugin_browser_details">
							<tbody>
								<tr>
									<td>Author</td>
									<td>{{ selected_plugin.getPluginDetails().author }}</td>
								</tr>
								<tr>
									<td>Identifier</td>
									<td>{{ selected_plugin.id }}</td>
								</tr>
								<tr>
									<td>Version</td>
									<td>{{ selected_plugin.details.version }}</td>
								</tr>
								<tr>
									<td>Last updated</td>
									<td :title="selected_plugin.details.last_modified_full">{{ selected_plugin.details.last_modified }}</td>
								</tr>
								<tr>
									<td>Published</td>
									<td :title="selected_plugin.details.creation_date_full">{{ selected_plugin.details.creation_date }}</td>
								</tr>
								<tr>
									<td>Required Blockbench version</td>
									<td>{{ selected_plugin.details.min_version }}</td>
								</tr>
								<tr v-if="selected_plugin.details.max_version">
									<td>Maximum allowed Blockbench version</td>
									<td>{{ selected_plugin.details.max_version }}</td>
								</tr>
								<tr>
									<td>Supported variants</td>
									<td>{{ capitalizeFirstLetter(selected_plugin.details.variant || '') }}</td>
								</tr>
								<tr>
									<td>Installations per week</td>
									<td>{{ selected_plugin.details.weekly_installations }}</td>
								</tr>
								<tr v-if="selected_plugin.details.website">
									<td>Website</td>
									<td><a :href="selected_plugin.details.website" :title="selected_plugin.details.website">{{ reduceLink(selected_plugin.details.website) }}</a></td>
								</tr>
								<tr v-if="selected_plugin.details.repository">
									<td>Plugin source</td>
									<td><a :href="selected_plugin.details.repository" :title="selected_plugin.details.repository">{{ reduceLink(selected_plugin.details.repository) }}</a></td>
								</tr>
								<tr v-if="selected_plugin.details.bug_tracker">
									<td>Report issues</td>
									<td><a :href="selected_plugin.details.bug_tracker" :title="selected_plugin.details.bug_tracker">{{ reduceLink(selected_plugin.details.bug_tracker) }}</a></td>
								</tr>
							</tbody>
						</table>

						<ul v-if="page_tab == 'changelog' && typeof selected_plugin.changelog == 'object'" id="plugin_browser_changelog">
							<li v-for="(version, key) in selected_plugin.changelog">
								<h3>{{ version.title || key }}</h3>
								<label class="plugin_changelog_author" v-if="version.author">{{ tl('dialog.plugins.author', [version.author]) }}</label>
								<label class="plugin_changelog_date" v-if="version.date" :title="printDateFull(version.date)">
									<i class="material-icons icon">calendar_today</i>
									{{ printDate(version.date) }}
								</label>
								<ul>
									<li v-for="category in version.categories">
										<h4>{{ category.title || key }}</h4>
										<ul class="plugin_changelog_features">
											<li v-for="change in category.list" v-html="formatChangelogLine(change)"></li>
										</ul>
									</li>
								</ul>
							</li>
						</ul>
						
						<div v-if="page_tab == 'settings'">
							<ul class="settings_list">
								<li v-for="(setting, key) in selected_plugin_settings" v-if="Condition(setting.condition)"
									v-on="setting.click ? {click: setting.click} : {}"
									@contextmenu="settingContextMenu(setting, $event)"
								>
									<template v-if="setting.type === 'number'">
										<div class="setting_element"><numeric-input v-model.number="setting.ui_value" :min="setting.min" :max="setting.max" :step="setting.step" @input="changePluginSetting(setting)" /></div>
									</template>
									<template v-else-if="setting.type === 'click'">
										<div class="setting_element setting_icon" v-html="getIconNode(setting.icon).outerHTML"></div>
									</template>
									<template v-else-if="setting.type == 'toggle'"><!--TOGGLE-->
										<div class="setting_element"><input type="checkbox" v-model="setting.ui_value" v-bind:id="'setting_'+key" @click="changePluginSetting(setting)"></div>
									</template>

									<div class="setting_label">
										<label class="setting_name" v-bind:for="'setting_'+key">{{ setting.name }}</label>
										<div class="setting_profile_value_indicator"
											v-for="profile_here in getProfileValuesForSetting(key)"
											:style="{'--color-profile': markerColors[profile_here.color] && markerColors[profile_here.color].standard}"
											:class="{active: profile_here.isActive()}"
											:title="tl('Has override in profile ' + profile_here.name)"
											@click.stop="profile = (profile == profile_here) ? null : profile_here"
										/>
										<div class="setting_description">{{ setting.description }}</div>
									</div>

									<template v-if="setting.type === 'text'">
										<input type="text" class="dark_bordered" style="width: 96%" v-model="setting.ui_value" @input="changePluginSetting(setting)">
									</template>

									<template v-if="setting.type === 'password'">
										<input :type="setting.hidden ? 'password' : 'text'" class="dark_bordered" style="width: calc(96% - 28px);" v-model="setting.ui_value" @input="changePluginSetting(setting)">
										<div class="password_toggle" @click="setting.hidden = !setting.hidden;">
											<i class="fas fa-eye-slash" v-if="setting.hidden"></i>
											<i class="fas fa-eye" v-else></i>
										</div>
									</template>

									<template v-else-if="setting.type === 'select'">
										<div class="bar_select">
											<select-input v-model="setting.ui_value" :options="setting.options" @change="changePluginSetting"setting />
										</div>
									</template>
								</li>
							</ul>
						</div>
						
						<ul v-if="page_tab == 'features'" class="features_list">
							<li v-for="type in getPluginFeatures(selected_plugin)" :key="type.id">
								<h4>{{ type.name }}</h4>
								<ul>
									<li v-for="feature in type.features" :key="feature.id" class="plugin_feature_entry" :class="{clickable: feature.click}" @click="feature.click && feature.click($event)">
										<dynamic-icon v-if="feature.icon" :icon="feature.icon" />
										<label>{{ feature.name }}</label>
										<div class="description">{{ feature.description }}</div>
										<div v-if="feature.extra_info" class="extra_info">{{ feature.extra_info }}</div>
									</li>
								</ul>
							</li>
						</ul>
						
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
