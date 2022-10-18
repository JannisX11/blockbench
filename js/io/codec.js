const Codecs = {};
class Codec {
	constructor(id, data) {
		if (!data) data = 0;
		this.id = id;
		Codecs[id] = this;
		this.name = data.name || 'Unknown Format';
		this.events = {};
		Merge.function(this, data, 'load');
		Merge.function(this, data, 'compile');
		Merge.function(this, data, 'parse');
		Merge.function(this, data, 'merge');
		Merge.function(this, data, 'write');
		Merge.function(this, data, 'overwrite');
		Merge.function(this, data, 'export');
		Merge.function(this, data, 'fileName');
		Merge.function(this, data, 'afterSave');
		Merge.function(this, data, 'afterDownload');
		Merge.string(this, data, 'extension');
		Merge.boolean(this, data, 'remember');
		Merge.boolean(this, data, 'multiple_per_file');
		this.format = data.format;
		this.load_filter = data.load_filter;
		this.export_action = data.export_action;
	}
	//Import
	load(model, file, add) {
		if (!this.parse) return false;
		if (!add) {
			setupProject(this.format)
		}
		if (file.path && isApp && this.remember && !file.no_file ) {
			var name = pathToName(file.path, true);
			let project = Project;
			Project.name = pathToName(name, false);
			Project.export_path = file.path;
			
			addRecentProject({
				name,
				path: file.path,
				icon: Format.icon
			})
			setTimeout(() => {
				if (Project == project) updateRecentProjectThumbnail();
			}, 200)
		}
		this.parse(model, file.path)
		if (isApp) loadDataFromModelMemory();
	}
	//parse(model, path)

	//Export
	compile() {
		this.dispatchEvent('compile', {content: ''})
		return '';
	}
	export() {
		var scope = this;
		Blockbench.export({
			resource_id: 'model',
			type: scope.name,
			extensions: [scope.extension],
			name: scope.fileName(),
			startpath: scope.startPath(),
			content: scope.compile(),
			custom_writer: isApp ? (a, b) => scope.write(a, b) : null,
		}, path => scope.afterDownload(path))
	}
	fileName() {
		return Project.name||'model';
	}
	startPath() {
		return Project.export_path;
	}
	write(content, path) {
		var scope = this;
		if (fs.existsSync(path) && this.overwrite) {
			this.overwrite(content, path, path => scope.afterSave(path))
		} else {
			Blockbench.writeFile(path, {content}, path => scope.afterSave(path));
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
		if (Format.codec == this || this.id == 'project') {
			if (this.id == 'project') {
				Project.save_path = path;
			} else {
				Project.export_path = path;
			}
			Project.name = pathToName(path, false);
			Project.saved = true;
		}
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
	//Events
	dispatchEvent(event_name, data) {
		var list = this.events[event_name]
		if (!list) return;
		for (var i = 0; i < list.length; i++) {
			if (typeof list[i] === 'function') {
				list[i](data)
			}
		}
	}
	on(event_name, cb) {
		if (!this.events[event_name]) {
			this.events[event_name] = []
		}
		this.events[event_name].safePush(cb)
	}
	removeListener(event_name, cb) {
		if (this.events[event_name]) {
			this.events[event_name].remove(cb);
		}
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
