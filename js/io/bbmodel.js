(function() {

var codec = new Codec('project', {
	name: 'Blockbench Project',
	extension: 'bbmodel',
	remember: true,
	load(model, file) {

		var name = pathToName(file.path, true)
		newProject(model.meta.type||'free');
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
				format_version: '3.2',
				model_format: Format.id,
				box_uv: Project.box_uv
			},
			name: Project.name,
		}
		if (Format.bone_rig) {
			model.geo_name = Project.geometry_name
		}
		if (Project.parent) {
			model.parent = Project.parent;
		}
		if (Format.id == 'java_block') {
			model.ambientocclusion = Project.ambientocclusion
			model.front_gui_light = Project.front_gui_light;
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

		if (options.raw) {
			return model;
		} else if (options.compressed) {
			var json_string = JSON.stringify(model);
			var compressed = '<lz>'+LZUTF8.compress(json_string, {outputEncoding: 'StorageBinaryString'});
			return compressed;
		} else {
			return JSON.stringify(model);
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
		if (compareVersions(model.meta.format_version, '3.2')) {
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
		if (model.meta.box_uv !== undefined && Format.optional_box_uv) {
			Project.box_uv = model.meta.box_uv
		}

		Blockbench.dispatchEvent('load_project', {model, path});

		Project.name = model.name;
		if (model.geo_name) {
			Project.geometry_name = model.geo_name;
		} else if (model.parent) {
			Project.parent = model.parent;
		}
		if (model.ambientocclusion !== undefined) {
			Project.ambientocclusion = !!model.ambientocclusion;
		}
		if (model.front_gui_light !== undefined) {
			Project.front_gui_light = !!model.front_gui_light;
		}
		if (model.resolution !== undefined) {
			Project.texture_width = model.resolution.width;
			Project.texture_height = model.resolution.height;
		}

		if (model.textures) {
			model.textures.forEach(tex => {
				var tex_copy = new Texture(tex, tex.uuid).add(false);
				if (isApp && tex.path && fs.existsSync(tex.path)) {
					tex_copy.fromPath(tex.path)
				} else {
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
					if (!Project.box_uv) {
						var texture = textures[element.faces[face].texture]
						if (texture) {
							copy.faces[face].texture = texture.uuid
						}
					} else if (textures[0]) {
						copy.faces[face].texture = textures[0].uuid
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
		if (model.display !== undefined) {
			DisplayMode.loadJSON(model.display)
		}
		if (model.history) {
			Undo.history = model.history.slice()
			Undo.index = model.history_index;
		}
		Canvas.updateAll()
	}
})

BARS.defineActions(function() {
	codec.export_action = new Action('save_project', {
		icon: 'save',
		category: 'file',
		keybind: new Keybind({key: 83, ctrl: true, alt: true}),
		click: function () {
			saveTextures()
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
			saveTextures()
			codec.export()
		}
	})
})

})()
