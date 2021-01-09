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
		this.load_filter = data.load_filter;
		this.export_action = data.export_action;
	}
	//Import
	load(model, file, add) {
		if (!this.parse) return false;
		if (!add) {
			newProject(this.format)
		}
		if (file.path && isApp && this.remember && !file.no_file ) {
			var name = pathToName(file.path, true);
			ModelMeta.name = pathToName(name, false);
			ModelMeta.export_path = file.path;
			addRecentProject({
				name,
				path: file.path,
				icon: Format.icon
			})
		}
		this.parse(model, file.path)
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
		return ModelMeta.name||Project.name||'model';
	}
	startPath() {
		return ModelMeta.export_path;
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
			Prop.project_saved = true;
		}
		Blockbench.showQuickMessage(tl('message.save_file', [path ? pathToName(path, true) : this.fileName()]));
	}
	afterSave(path) {
		var name = pathToName(path, true)
		if (Format.codec == this || this.id == 'project') {
			if (this.id == 'project') {
				ModelMeta.save_path = path;
			} else {
				ModelMeta.export_path = path;
			}
			ModelMeta.name = pathToName(path, false);
			Prop.project_saved = true;
		}
		if (this.remember) {
			addRecentProject({
				name,
				path: path,
				icon: this.id == 'project' ? 'icon-blockbench_file' : Format.icon
			});
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


//Import
function setupDragHandlers() {
	Blockbench.addDragHandler(
		'model',
		{extensions: Codec.getAllExtensions},
		function(files) {
			loadModelFile(files[0])
		}
	)
	Blockbench.addDragHandler(
		'style',
		{extensions: ['bbstyle', 'bbtheme']},
		function(files) {
			CustomTheme.import(files[0]);
		}
	)
	Blockbench.addDragHandler(
		'plugin',
		{extensions: ['bbplugin', 'js']},
		function(files) {
			new Plugin().loadFromFile(files[0], true)
		}
	)
	Blockbench.addDragHandler(
		'texture',
		{extensions: ['png', 'tga'], propagate: true, readtype: 'image'},
		function(files, event) {
			var texture_li = $(event.target).parents('li.texture')
			if (texture_li.length) {
				var tex = textures.findInArray('uuid', texture_li.attr('texid'))
				if (tex) {
					tex.fromFile(files[0])
					TickUpdates.selection = true;
					return;
				}
			}
			files.forEach(function(f) {
				new Texture().fromFile(f).add().fillParticle()
			})
		}
	)
}
function loadModelFile(file) {
	if (showSaveDialog()) {
		resetProject();

		(function() {
			var extension = pathToExtension(file.path);
			// Text
			for (var id in Codecs) {
				let codec = Codecs[id];
				if (codec.load_filter && codec.load_filter.type == 'text') {
					if (codec.load_filter.extensions.includes(extension) && Condition(codec.load_filter.condition, file.content)) {
						codec.load(file.content, file);
						return;
					}
				}
			}
			// JSON
			var model = autoParseJSON(file.content);
			for (var id in Codecs) {
				let codec = Codecs[id];
				if (codec.load_filter && codec.load_filter.type == 'json') {
					if (codec.load_filter.extensions.includes(extension) && Condition(codec.load_filter.condition, model)) {
						codec.load(model, file);
						return;
					}
				}
			}
		})();

		EditSession.initNewModel()
		if (!Format) {
			Modes.options.start.select()
			Modes.vue.$forceUpdate()
			Blockbench.dispatchEvent('close_project');
		}
	}
}
