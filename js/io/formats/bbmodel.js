(function() {

let FORMATV = '3.6';

var codec = new Codec('project', {
	name: 'Blockbench Project',
	extension: 'bbmodel',
	remember: true,
	load_filter: {
		type: 'json',
		extensions: ['bbmodel']
	},
	load(model, file) {
		newProject(model.meta.type||'free');
		var name = pathToName(file.path, true);
		if (file.path && isApp && !file.no_file ) {
			ModelMeta.save_path = file.path;
			ModelMeta.name = pathToName(name, false);
			addRecentProject({
				name,
				path: file.path,
				icon: 'icon-blockbench_file'
			})
		}
		this.parse(model, file.path)
	},
	compile(options) {
		if (!options) options = 0;
		var model = {
			meta: {
				format_version: FORMATV,
				creation_time: Math.round(new Date().getTime()/1000),
				backup: options.backup ? true : undefined,
				model_format: Format.id,
				box_uv: Project.box_uv
			}
		}
		
		for (var key in ModelProject.properties) {
			ModelProject.properties[key].copy(Project, model)
		}

		if (Project.overrides) {
			model.overrides = Project.overrides;
		}
		model.resolution = {
			width: Project.texture_width || 16,
			height: Project.texture_height || 16,
		}
		if (options.flag) {
			model.flag = options.flag;
		}
		model.elements = []
		elements.forEach(el => {
			var obj = el.getSaveCopy(model.meta)
			model.elements.push(obj)
		})
		model.outliner = compileGroups(true)

		model.textures = [];
		textures.forEach(tex => {
			var t = tex.getUndoCopy();
			delete t.selected;
			if (options.bitmaps != false) {
				t.source = 'data:image/png;base64,'+tex.getBase64()
				t.mode = 'bitmap'
			}
			model.textures.push(t);
		})

		if (Animator.animations.length) {
			model.animations = [];
			Animator.animations.forEach(a => {
				model.animations.push(a.getUndoCopy({bone_names: true}, true))
			})
		}
		if (Interface.Panels.variable_placeholders.inside_vue._data.text) {
			model.animation_variable_placeholders = Interface.Panels.variable_placeholders.inside_vue._data.text;
		}

		if (Format.display_mode && Object.keys(display).length >= 1) {
			var new_display = {}
			var entries = 0;
			for (var i in DisplayMode.slots) {
				var key = DisplayMode.slots[i]
				if (DisplayMode.slots.hasOwnProperty(i) && display[key] && display[key].export) {
					new_display[key] = display[key].export()
					entries++;
				}
			}
			if (entries) {
				model.display = new_display
			}
		}

		if (options.history) {
			model.history = [];
			Undo.history.forEach(h => {
				var e = {
					before: omitKeys(h.before, ['aspects']),
					post: omitKeys(h.post, ['aspects']),
					action: h.action
				}
				model.history.push(e);
			})
			model.history_index = Undo.index;
		}

		Blockbench.dispatchEvent('save_project', {model});
		this.dispatchEvent('compile', {model, options})

		if (options.raw) {
			return model;
		} else if (options.compressed) {
			var json_string = JSON.stringify(model);
			var compressed = '<lz>'+LZUTF8.compress(json_string, {outputEncoding: 'StorageBinaryString'});
			return compressed;
		} else {
			if (Settings.get('minify_bbmodel')) {
				return JSON.stringify(model);
			} else {
				return compileJSON(model);
			}
		}
	},
	parse(model, path) {
		if (!model.meta) {
			Blockbench.showMessageBox({
				translateKey: 'invalid_model',
				icon: 'error',
			})
			return;
		}
		if (!model.meta.format_version) {
			model.meta.format_version = model.meta.format;
		}
		if (compareVersions(model.meta.format_version, FORMATV)) {
			Blockbench.showMessageBox({
				translateKey: 'outdated_client',
				icon: 'error',
			})
			return;
		}
		if (model.meta.model_format) {
			var format = Formats[model.meta.model_format]||Formats.free;
			format.select()
		} else if (model.meta.bone_rig) {
			Formats.bedrock_old.select()
		} else {
			Formats.java_block.select()
		}

		Blockbench.dispatchEvent('load_project', {model, path});
		this.dispatchEvent('parse', {model})

		if (model.meta.box_uv !== undefined && Format.optional_box_uv) {
			Project.box_uv = model.meta.box_uv
		}

		for (var key in ModelProject.properties) {
			ModelProject.properties[key].merge(Project, model)
		}

		if (model.overrides) {
			Project.overrides = model.overrides;
		}
		if (model.resolution !== undefined) {
			Project.texture_width = model.resolution.width;
			Project.texture_height = model.resolution.height;
		}

		if (model.textures) {
			model.textures.forEach(tex => {
				var tex_copy = new Texture(tex, tex.uuid).add(false);
				if (isApp && tex.path && fs.existsSync(tex.path) && !model.meta.backup) {
					tex_copy.fromPath(tex.path)
				} else if (tex.source && tex.source.substr(0, 5) == 'data:') {
					tex_copy.fromDataURL(tex.source)
				}
			})
		}
		if (model.cubes && !model.elements) {
			model.elements = model.cubes;
		}
		if (model.elements) {
			model.elements.forEach(function(element) {

				var copy = NonGroup.fromSave(element, true)
				for (var face in copy.faces) {
					if (!Format.single_texture && element.faces) {
						var texture = element.faces[face].texture !== null && textures[element.faces[face].texture]
						if (texture) {
							copy.faces[face].texture = texture.uuid
						}
					} else if (Texture.getDefault() && copy.faces && copy.faces[face].texture !== null) {
						copy.faces[face].texture = Texture.getDefault().uuid
					}
				}
				copy.init()
				
			})
			loadOutlinerDraggable()
		}
		if (model.outliner) {
			if (compareVersions('3.2', model.meta.format_version)) {
				//Fix Z-axis inversion pre 3.2
				function iterate(list) {
					for (var child of list) {
						if (typeof child == 'object' ) {
							iterate(child.children);
							if (child.rotation) child.rotation[2] *= -1;
						}
					}
				}
				iterate(model.outliner)
			}
			parseGroups(model.outliner)
			if (model.meta.bone_rig) {
				Canvas.updateAllBones()
				Canvas.updateAllPositions()
			}
		}
		if (model.animations) {
			model.animations.forEach(ani => {
				var base_ani = new Animation()
				base_ani.uuid = ani.uuid;
				base_ani.extend(ani).add();
			})
		}
		if (model.animation_variable_placeholders) {
			Interface.Panels.variable_placeholders.inside_vue._data.text = model.animation_variable_placeholders;
		}
		if (model.display !== undefined) {
			DisplayMode.loadJSON(model.display)
		}
		if (model.history) {
			Undo.history = model.history.slice()
			Undo.index = model.history_index;
		}
		this.dispatchEvent('parsed', {model})
		Canvas.updateAll()
	}
})

BARS.defineActions(function() {
	codec.export_action = new Action('save_project', {
		icon: 'save',
		category: 'file',
		keybind: new Keybind({key: 83, ctrl: true, alt: true}),
		click: function () {
			saveTextures(true)
			if (isApp && ModelMeta.save_path) {
				codec.write(codec.compile(), ModelMeta.save_path);
			} else {
				codec.export()
			}
		}
	})

	new Action('save_project_as', {
		icon: 'save',
		category: 'file',
		keybind: new Keybind({key: 83, ctrl: true, alt: true, shift: true}),
		click: function () {
			saveTextures(true)
			codec.export()
		}
	})
})

})()
