const Codecs = {};
class Codec extends EventSystem {
	constructor(id, data) {
		super();
		if (!data) data = 0;
		this.id = id;
		Codecs[id] = this;
		this.name = data.name || 'Unknown Format';
		this.events = {};
		this.export_options = data.export_options || {};
		Merge.function(this, data, 'load');
		Merge.function(this, data, 'compile');
		Merge.function(this, data, 'parse');
		Merge.function(this, data, 'merge');
		Merge.function(this, data, 'write');
		Merge.function(this, data, 'overwrite');
		Merge.function(this, data, 'export');
		Merge.function(this, data, 'exportCollection');
		Merge.function(this, data, 'writeCollection');
		Merge.function(this, data, 'fileName');
		Merge.function(this, data, 'afterSave');
		Merge.function(this, data, 'afterDownload');
		Merge.string(this, data, 'extension');
		Merge.boolean(this, data, 'remember');
		Merge.boolean(this, data, 'multiple_per_file');
		Merge.boolean(this, data, 'support_partial_export');
		this.format = data.format;
		this.load_filter = data.load_filter;
		this.export_action = data.export_action;
		this.plugin = data.plugin || (typeof Plugins != 'undefined' ? Plugins.currently_loading : '');
		this.context = null;
	}
	getExportOptions() {
		let options = {};
		for (let key in this.export_options) {
			options[key] = this.export_options[key].value;
		}
		let saved = Project.export_options[this.id];
		if (saved) Object.assign(options, saved);
		return options;
	}
	//Import
	load(model, file, add) {
		if (!this.parse) return false;
		if (!add) {
			setupProject(this.format)
		}
		if (file.path && isApp && this.remember && !file.no_file ) {
			var name = pathToName(file.path, true);
			Project.name = pathToName(name, false);
			Project.export_path = file.path;
			
		}

		this.parse(model, file.path)

		if (file.path && isApp && this.remember && !file.no_file ) {
			loadDataFromModelMemory();
			addRecentProject({
				name,
				path: file.path,
				icon: Format.icon
			})
			let project = Project;
			setTimeout(() => {
				if (Project == project) updateRecentProjectThumbnail();
			}, 500)
		}
		Settings.updateSettingsInProfiles();
	}
	//parse(model, path)

	compile(options = this.getExportOptions()) {
		this.dispatchEvent('compile', {content: ''})
		return '';
	}
	async promptExportOptions() {
		let codec = this;
		return await new Promise((resolve, reject) => {
			let form = {};
			let opts_in_project = Project.export_options[codec.id];

			for (let form_id in this.export_options) {
				if (!Condition(this.export_options[form_id].condition)) continue;
				form[form_id] = {};
				for (let key in this.export_options[form_id]) {
					form[form_id][key] = this.export_options[form_id][key];
				}
				if (opts_in_project && opts_in_project[form_id] != undefined) {
					form[form_id].value = opts_in_project[form_id];
				}
			}
			new Dialog('export_options', {
				title: 'dialog.export_options.title',
				width: 480,
				form,
				onConfirm(result) {
					if (!Project.export_options[codec.id]) Project.export_options[codec.id] = {};
					for (let key in result) {
						let value = result[key];
						Project.export_options[codec.id][key] = value;
					}
					resolve(result);
				},
				onCancel() {
					resolve(null);
				}
			}).show();
		})
	}
	async export() {
		if (Object.keys(this.export_options).length) {
			let result = await this.promptExportOptions();
			if (result === null) return;
		}
		Blockbench.export({
			resource_id: 'model',
			type: this.name,
			extensions: [this.extension],
			name: this.fileName(),
			startpath: this.startPath(),
			content: this.compile(),
			custom_writer: isApp ? (a, b) => this.write(a, b) : null,
		}, path => this.afterDownload(path))
	}
	async patchCollectionExport(collection, callback) {
		this.context = collection;
		let element_export_values = {};
		let all = Outliner.elements.concat(Group.all);
		for (let node of all) {
			if (typeof node.export != 'boolean') continue;
			element_export_values[node.uuid] = node.export;
			node.export = false;
		}
		for (let node of collection.getAllChildren()) {
			if (node.export == false) node.export = true;
		}
		try {
			await callback();
		} catch (error) {
			throw error;
		} finally {
			this.context = null;
			for (let node of all) {
				if (element_export_values[node.uuid] === undefined) continue;
				node.export = element_export_values[node.uuid];
			}
		}
	}
	async exportCollection(collection) {
		this.patchCollectionExport(collection, async () => {
			await this.export();
		})
	}
	async writeCollection(collection) {
		this.patchCollectionExport(collection, async () => {
			await this.export();
		})
	}
	fileName() {
		if (this.context instanceof Collection) {
			return this.context.name;
		} else {
			return Project.name||'model';
		}
	}
	startPath() {
		if (this.context instanceof Collection) {
			return this.context.export_path;
		} else {
			return Project.export_path;
		}
	}
	write(content, path) {
		if (fs.existsSync(path) && this.overwrite) {
			this.overwrite(content, path, path => this.afterSave(path))
		} else {
			Blockbench.writeFile(path, {content}, path => this.afterSave(path));
		}
	}
	//overwrite(content, path, cb)
	afterDownload(path) {
		if (this.remember) {
			Project.saved = true;
		}
		Blockbench.showQuickMessage(tl('message.save_file', [path ? pathToName(path, true) : this.fileName()]));
	}
	afterSave(path) {
		var name = pathToName(path, true)
		if (this.context instanceof Collection) {
			this.context.export_path = path;
			this.context.codec = this.id;

		} else if (Format.codec == this || this.id == 'project') {
			if (this.id == 'project') {
				Project.save_path = path;
			} else {
				Project.export_path = path;
			}
			Project.name = pathToName(path, false);
			Project.saved = true;
		}
		Settings.updateSettingsInProfiles();
		if (this.remember) {
			addRecentProject({
				name,
				path: path,
				icon: this.id == 'project' ? 'icon-blockbench_file' : Format.icon
			});
			updateRecentProjectThumbnail();
		}
		Blockbench.showQuickMessage(tl('message.save_file', [name]));
	}
	//Delete
	delete() {
		delete Codecs[this.id];
		if (this.format && this.format.codec == this) delete this.format.codec;
	}
}
Codec.getAllExtensions = function() {
	let extensions = [];
	for (var id in Codecs) {
		if (Codecs[id].load_filter && Codecs[id].load_filter.extensions) {
			extensions.safePush(...Codecs[id].load_filter.extensions);
		}
	}
	return extensions;
}
