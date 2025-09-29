import { invertMolang } from '../../util/molang';
import LZUTF8 from '../../lib/lzutf8'
import { fs } from '../../native_apis';
import versionUtil from '../../util/versionUtil';

const FORMATV = '5.0';

function processHeader(model) {
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
	if (versionUtil.compare(model.meta.format_version, '>', FORMATV)) {
		Blockbench.showMessageBox({
			translateKey: 'outdated_client',
			icon: 'error',
		})
		return;
	}
}
function processCompatibility(model) {

	if (!model.meta.model_format) {
		if (model.meta.bone_rig) {
			model.meta.model_format = 'bedrock_old';
		} else {
			model.meta.model_format = 'java_block';
		}
	}

	if (model.cubes && !model.elements) {
		model.elements = model.cubes;
	}
	if (model.geometry_name) model.model_identifier = model.geometry_name;

	if (model.elements && model.meta.box_uv && versionUtil.compare(model.meta.format_version, '<=', '4.5')) {
		model.elements.forEach(element => {
			if (element.shade === false) {
				element.mirror_uv = true;
			}
		})
	}

	if (model.outliner) {
		if (versionUtil.compare(model.meta.format_version, '<=', '3.2')) {
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
	}
	if (model.textures) {
		if (isApp && versionUtil.compare(model.meta.format_version, '<=', '4.10')) {
			for (let texture of model.textures) {
				if (texture.relative_path) texture.relative_path = PathModule.join('/', texture.relative_path);
			}
		}
	}
	if (model.animations && versionUtil.compare(model.meta.format_version, '<=', '5.0')) {
		for (let anim of model.animations) {
			for (let uuid in anim.animators) {
				let animator = anim.animators[uuid]
				for (let keyframe of (animator.keyframes??[])) {
					for (let data_point of keyframe.data_points) {
						if ((keyframe.channel == 'position' || keyframe.channel == 'rotation') && data_point.x) {
							data_point.x = invertMolang(data_point.x);
						}
						if (keyframe.channel == 'rotation' && data_point.y) {
							data_point.y = invertMolang(data_point.y);
						}
					}
					if (keyframe.interpolation == 'bezier') {
						if ((keyframe.channel == 'position' || keyframe.channel == 'rotation') && keyframe.bezier_left_value) {
							keyframe.bezier_left_value[0] *= -1;
							keyframe.bezier_right_value[0] *= -1;
						}
						if (keyframe.channel == 'rotation' && keyframe.bezier_left_value) {
							keyframe.bezier_left_value[1] *= -1;
							keyframe.bezier_right_value[1] *= -1;
						}
					}
				}
			}
		}
	}
}

var codec = new Codec('project', {
	name: 'Blockbench Project',
	extension: 'bbmodel',
	remember: true,
	support_partial_export: true,
	load_filter: {
		type: 'json',
		extensions: ['bbmodel']
	},
	load(model, file) {
		if (!model || !model.meta) {
			return Blockbench.showMessageBox({translateKey: 'invalid_model'});
		}
		setupProject(Formats[model.meta.model_format] || Formats.free);
		var name = pathToName(file.path, true);
		Project.name = pathToName(name, false);
		if (file.path && isApp && !file.no_file ) {
			let project = Project;
			Project.save_path = file.path;
			addRecentProject({
				name,
				path: file.path,
				icon: 'icon-blockbench_file'
			})
			setTimeout(() => {
				if (Project == project) updateRecentProjectThumbnail();
			}, 200)
		}
		this.parse(model, file.path)

		if (Modes.animate && !AnimationItem.selected && AnimationItem.all[0]) {
			AnimationItem.all[0].select();
		}
	},
	export() {
		Blockbench.export({
			resource_id: 'model',
			type: this.name,
			extensions: [this.extension],
			name: this.fileName(),
			startpath: this.startPath(),
			content: isApp ? null : this.compile(),
			custom_writer: isApp ? (content, path) => {
				// Path needs to be changed before compiling for relative resource paths
				Project.save_path = path;
				Project.name = pathToName(path, false);
				content = this.compile();
				this.write(content, path);
			} : null,
		}, path => this.afterDownload(path))
	},
	async exportCollection(collection) {
		this.context = collection;
		Blockbench.export({
			resource_id: 'model',
			type: this.name,
			extensions: [this.extension],
			name: this.fileName(),
			startpath: this.startPath(),
			content: isApp ? null : this.compile({collection_only: collection}),
			custom_writer: isApp ? (content, path) => {
				// Path needs to be changed before compiling for relative resource paths
				let old_save_path = Project.save_path;
				Project.save_path = path;
				content = this.compile({collection_only: collection});
				this.write(content, path);
				this.context = null;
				Project.save_path = old_save_path;
			} : null,
		}, path => this.afterDownload(path));
	},
	async writeCollection(collection) {
		if (!collection.export_path) {
			console.warn('No path specified');
			return;
		}
		this.context = collection;
		let old_save_path = Project.save_path;
		let content = this.compile({collection_only: collection});
		this.write(content, collection.export_path);
		this.context = null;
		Project.save_path = old_save_path;
	},
	compile(options) {
		if (!options) options = 0;
		let model = {
			meta: {
				format_version: FORMATV,
				//creation_time: Math.round(new Date().getTime()/1000),
				backup: options.backup ? true : undefined,
				model_format: Format.id,
				box_uv: Project.box_uv
			}
		}
		let save_relative_paths = settings.export_asset_paths.value == 'relative' || settings.export_asset_paths.value == 'both';
		let save_absolute_paths = settings.export_asset_paths.value == 'absolute' || settings.export_asset_paths.value == 'both';
		if (typeof options.absolute_paths == 'boolean') save_absolute_paths = options.absolute_paths;
		
		for (var key in ModelProject.properties) {
			if (ModelProject.properties[key].export == false) continue;
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

		if (options.editor_state) {
			Project.saveEditorState();
			model.editor_state = {
				save_path: Project.save_path,
				export_path: Project.export_path,
				saved: Project.saved,
				added_models: Project.added_models,
				mode: Project.mode,
				tool: Project.tool,
				display_uv: Project.display_uv,
				exploded_view: Project.exploded_view,
				uv_viewport: Project.uv_viewport,
				previews: JSON.parse(JSON.stringify(Project.previews)),

				selected_elements: Project.selected_elements.map(e => e.uuid),
				selected_groups: Project.selected_groups.map(g => g.uuid),
				mesh_selection: JSON.parse(JSON.stringify(Project.mesh_selection)),
				selected_texture: Project.selected_texture?.uuid,
			};
		}

		if (!(Format.id == 'skin' && model.skin_model)) {
			if (options.collection_only) {
				var all_collection_children = options.collection_only.getAllChildren();
			}
			model.elements = [];
			Outliner.elements.forEach(el => {
				if (options.collection_only && !all_collection_children.includes(el)) return;
				let copy = el.getSaveCopy(model.meta);
				model.elements.push(copy);
			})
			model.groups = [];
			Group.all.forEach(group => {
				if (options.collection_only && !all_collection_children.includes(group)) return;
				let copy = group.getSaveCopy(false);
				model.groups.push(copy);
			});

			model.outliner = Outliner.toJSON();

			if (options.collection_only) {
				function filterList(list) {
					list.forEachReverse(item => {
						if (typeof item == 'string') {
							if (!all_collection_children.find(node => node.uuid == item)) {
								list.remove(item);
							}
						} else {
							if (item.children instanceof Array) {
								filterList(item.children);
							}
							if (item.uuid && !all_collection_children.find(node => node.uuid == item.uuid)) {
								if (!item.children || item.children.length == 0) {
									list.remove(item);
								}
							}
						}
					})
				}
				filterList(model.outliner);
			}
		}

		function handleAssetPath(object, key, relative_key) {
			let path = object[key];
			if (options.absolute_paths == false) object[key] = undefined;
			if (!isApp || !Project.save_path || !path) return;
			if (save_absolute_paths == false) object[key] = undefined;
			if (PathModule.isAbsolute(path) && save_relative_paths) {
				let relative = PathModule.relative(PathModule.dirname(Project.save_path), path);
				object[relative_key??key] = relative.replace(/\\/g, '/');
			}
		}

		model.textures = [];
		Texture.all.forEach(tex => {
			let t = tex.getSaveCopy();
			handleAssetPath(t, 'path', 'relative_path');
			if (options.bitmaps != false && (Settings.get('embed_textures') || options.backup || options.bitmaps == true)) {
				t.source = tex.getDataURL()
				t.internal = true;
			}
			model.textures.push(t);
		})
		for (let texture_group of TextureGroup.all) {
			if (!model.texture_groups) model.texture_groups = [];
			let copy = texture_group.getSaveCopy();
			model.texture_groups.push(copy);
		}

		let collections = [];
		for (let collection of Collection.all) {
			let copy = collection.getSaveCopy();
			if (copy.export_path)
			collections.push(copy);
		}
		if (collections.length) model.collections = collections;

		if (Animation.all.length) {
			model.animations = [];
			Animation.all.forEach(animation => {
				let a = animation.getUndoCopy({absolute_paths: options.absolute_paths}, true);
				model.animations.push(a);
				handleAssetPath(a, 'path');
			})
		}
		if (AnimationController.all.length) {
			model.animation_controllers = [];
			AnimationController.all.forEach(cont => {
				let a = cont.getUndoCopy();
				handleAssetPath(a, 'path');
				model.animation_controllers.push(a);
			})
		}
		if (Interface.Panels.variable_placeholders.inside_vue._data.text) {
			model.animation_variable_placeholders = Interface.Panels.variable_placeholders.inside_vue._data.text;
		}

		if (Format.display_mode && Object.keys(Project.display_settings).length >= 1) {
			var new_display = {}
			var entries = 0;
			for (var i in DisplayMode.slots) {
				var key = DisplayMode.slots[i]
				if (DisplayMode.slots.hasOwnProperty(i) && Project.display_settings[key] && Project.display_settings[key].export) {
					new_display[key] = Project.display_settings[key].export()
					entries++;
				}
			}
			if (entries) {
				model.display = new_display
			}
		}

		if (!options.backup && options.reference_images != false) {
			// Reference Images
			const reference_images = [];

			for (let reference of Project.reference_images) {
				reference_images.push(reference.getSaveCopy());
			}
			if (reference_images.length) {
				model.reference_images = reference_images;
			}
		}

		if (Object.keys(Project.export_options).length) {
			model.export_options = {};
			for (let codec_id in Project.export_options) {
				if (Object.keys(Project.export_options[codec_id]).length) {
					model.export_options[codec_id] = Object.assign({}, Project.export_options[codec_id]);
				}
			}
		}

		if (options.history) {
			model.history = [];
			Undo.history.forEach(h => {
				var e = {
					before: omitKeys(h.before, ['aspects']),
					post: omitKeys(h.post, ['aspects']),
					action: h.action,
					time: h.time
				}
				model.history.push(e);
			})
			model.history_index = Undo.index;
		}

		Blockbench.dispatchEvent('save_project', {model, options});
		this.dispatchEvent('compile', {model, options})

		if (options.raw) {
			return model;
		} else if (options.compressed) {
			var json_string = compileJSON(model, {small: true});
			var compressed = '<lz>'+LZUTF8.compress(json_string, {outputEncoding: 'StorageBinaryString'});
			return compressed;
		} else {
			return compileJSON(model, {small: Settings.get('minify_bbmodel') || options.minify});
		}
	},
	parse(model, path) {

		processHeader(model);
		processCompatibility(model);

		if (model.meta.model_format) {
			if (!Formats[model.meta.model_format]) {
				let supported_plugins = Plugins.all.filter(plugin => {
					return plugin.contributes?.formats?.includes(model.meta.model_format);
				})
				let commands = {};
				for (let plugin of supported_plugins) {
					commands[plugin.id] = {
						icon: plugin.icon,
						text: tl('message.invalid_format.install_plugin', [plugin.title])
					}
				}
				Blockbench.showMessageBox({
					translateKey: 'invalid_format',
					message: tl('message.invalid_format.message', [model.meta.model_format]),
					commands,
				}, plugin_id => {
					let plugin = plugin_id && supported_plugins.find(p => p.id == plugin_id);
					if (plugin) {
						BarItems.plugins_window.click();
						Plugins.dialog.content_vue.selectPlugin(plugin);
					}
				})
			}
			var format = Formats[model.meta.model_format]||Formats.free;
			format.select()
		}

		Blockbench.dispatchEvent('load_project', {model, path});
		this.dispatchEvent('parse', {model})

		if (model.meta.box_uv !== undefined && Format.optional_box_uv) {
			Project.box_uv = model.meta.box_uv
		}

		for (var key in ModelProject.properties) {
			ModelProject.properties[key].merge(Project, model)
		}
		if (path && path != 'backup.bbmodel') {
			Project.name = pathToName(path, false);
		}

		if (model.overrides) {
			Project.overrides = model.overrides;
		}
		if (model.resolution !== undefined) {
			Project.texture_width = model.resolution.width;
			Project.texture_height = model.resolution.height;
		}

		if (model.texture_groups) {
			model.texture_groups.forEach(tex_group => {
				new TextureGroup(tex_group, tex_group.uuid).add(false);
			})
		}
		if (model.textures) {
			model.textures.forEach(tex => {
				var tex_copy = new Texture(tex, tex.uuid).add(false);
				if (isApp && tex.relative_path && Project.save_path) {
					let resolved_path = PathModule.resolve(PathModule.dirname(Project.save_path), tex.relative_path);
					if (fs.existsSync(resolved_path)) {
						tex_copy.loadContentFromPath(resolved_path)
						return;
					}
				}
				if (isApp && tex.path && fs.existsSync(tex.path) && !model.meta.backup) {
					tex_copy.loadContentFromPath(tex.path)
					return;
				}
				if (tex.source && tex.source.substr(0, 5) == 'data:') {
					tex_copy.fromDataURL(tex.source)
				}
			})
		}

		if (model.skin_model) {
			Codecs.skin_model.rebuild(model.skin_model, model.skin_pose);
		}
		if (model.elements) {
			let default_texture = Texture.getDefault();
			model.elements.forEach((template) => {

				let copy = OutlinerElement.fromSave(template, true)
				for (let face in copy.faces) {
					if (!Format.single_texture && template.faces) {
						let texture = template.faces[face].texture !== null && Texture.all[template.faces[face].texture]
						if (texture) {
							copy.faces[face].texture = texture.uuid
						}
					} else if (default_texture && copy.faces && copy.faces[face].texture !== null && !Format.single_texture_default) {
						copy.faces[face].texture = default_texture.uuid
					}
				}
				copy.init()
			})
		}
		if (model.groups) {
			model.groups.forEach((template) => {
				new Group(template, template.uuid).init();
			})
		}
		if (model.outliner) {
			Outliner.loadJSON(model.outliner)
		}
		if (model.collections instanceof Array) {
			for (let collection_data of model.collections) {
				let collection = new Collection(collection_data, collection_data.uuid);
				collection.add();
			}
		}
		if (model.animations) {
			model.animations.forEach(ani => {
				var base_ani = new Animation()
				base_ani.uuid = ani.uuid;
				base_ani.extend(ani).add();
				if (isApp && Format.animation_files) {
					base_ani.saved_name = base_ani.name;
				}
			})
		}
		if (model.animation_controllers) {
			model.animation_controllers.forEach(ani => {
				var base_ani = new AnimationController()
				base_ani.uuid = ani.uuid;
				base_ani.extend(ani).add();
				if (isApp && Format.animation_files) {
					base_ani.saved_name = base_ani.name;
				}
			})
		}
		if (model.animation_variable_placeholders) {
			Interface.Panels.variable_placeholders.inside_vue._data.text = model.animation_variable_placeholders;
		}
		if (model.display !== undefined) {
			DisplayMode.loadJSON(model.display)
		}
		if (model.backgrounds) {
			for (let key in model.backgrounds) {
				let template = model.backgrounds[key];
				let reference = new ReferenceImage({
					position: [template.x, template.y + template.size/2],
					size: [template.size/2, template.size/2],
					layer: 'background',
					is_blueprint: template.lock,
					source: template.image,
					name: (template.image && !template.image.startsWith('data:')) ? template.image.split([/[/\\]/]).last() : 'Reference'
				}).addAsReference();
				/*if (Project.backgrounds.hasOwnProperty(key)) {

					let store = model.backgrounds[key]
					let real = Project.backgrounds[key]

					if (store.image	!== undefined) {real.image = store.image}
					if (store.size	!== undefined) {real.size = store.size}
					if (store.x		!== undefined) {real.x = store.x}
					if (store.y		!== undefined) {real.y = store.y}
					if (store.lock	!== undefined) {real.lock = store.lock}
				}*/
			}
		}
		if (model.reference_images) {
			model.reference_images.forEach(template => {
				new ReferenceImage(template).addAsReference();
			})
		}
		if (model.export_options) {
			for (let codec_id in model.export_options) {
				Project.export_options[codec_id] = Object.assign({}, model.export_options[codec_id]);
			}
		}
		if (model.history) {
			Undo.history = model.history.slice()
			Undo.index = model.history_index;
		}
		Canvas.updateAllBones()
		Canvas.updateAllPositions()
		Canvas.updateAllFaces()
		ReferenceImage.updateAll();
		Validator.validate()
		this.dispatchEvent('parsed', {model})

		if (model.editor_state) {
			let state = model.editor_state;
			Merge.string(Project, state, 'save_path')
			Merge.string(Project, state, 'export_path')
			Merge.boolean(Project, state, 'saved')
			Merge.number(Project, state, 'added_models')
			Merge.string(Project, state, 'mode')
			Merge.string(Project, state, 'tool')
			Merge.string(Project, state, 'display_uv')
			Merge.boolean(Project, state, 'exploded_view')
			if (state.uv_viewport) {
				Merge.number(Project.uv_viewport, state.uv_viewport, 'zoom')
				Merge.arrayVector2(Project.uv_viewport = state.uv_viewport, 'offset');
			}
			if (state.previews) {
				for (let id in state.previews) {
					Project.previews[id] = state.previews[id];
				}
			}
			state.selected_elements.forEach(uuid => {
				let el = Outliner.elements.find(el2 => el2.uuid == uuid);
				Project.selected_elements.push(el);
			})
			if (state.selected_groups) {
				Group.multi_selected = state.selected_groups.map(uuid => Group.all.find(g => g.uuid == uuid)).filter(g => g instanceof Group);
			}
			(state.selected_texture && Texture.all.find(t => t.uuid == state.selected_texture))?.select();

			Project.loadEditorState();
		}
	},
	merge(model, path) {

		processHeader(model);
		processCompatibility(model);

		Blockbench.dispatchEvent('merge_project', {model, path});
		this.dispatchEvent('merge', {model})
		Project.added_models++;

		let uuid_map = {};
		let tex_uuid_map = {};
		let new_elements = [];
		let new_groups = [];
		let new_textures = [];
		let new_animations = [];
		let imported_format = Formats[model.meta.model_format];
		Undo.initEdit({
			elements: new_elements,
			groups: new_groups,
			textures: new_textures,
			animations: Format.animation_mode && new_animations,
			outliner: true,
			selection: true,
			display_slots: Format.display_mode && displayReferenceObjects.slots
		})

		if (model.overrides instanceof Array && Project.overrides instanceof Array) {
			Project.overrides.push(...model.overrides);
		}

		let width = model.resolution.width || Project.texture_width;
		let height = model.resolution.height || Project.texture_height;

		function loadTexture(tex) {
			if (isApp && Texture.all.find(tex2 => tex.path && tex.path == tex2.path)) {
				return Texture.all.find(tex2 => tex.path && tex.path == tex2.path)
			}
			if (Texture.all.find(tex2 => tex2.uuid == tex.uuid)) {
				tex_uuid_map[tex.uuid] = guid();
				tex.uuid = tex_uuid_map[tex.uuid];
			}
			var tex_copy = new Texture(tex, tex.uuid).add(false);
			let c = 0;
			while (Texture.all.find(t => t !== tex_copy && t.id == c)) {
				c++;
				tex_copy.id = c.toString();
			}
			if (isApp && tex.relative_path && path) {
				let resolved_path = PathModule.resolve(PathModule.dirname(path), tex.relative_path);
				if (fs.existsSync(resolved_path)) {
					tex_copy.loadContentFromPath(resolved_path)
					return tex_copy;
				}
			}
			if (isApp && tex.path && fs.existsSync(tex.path) && !model.meta.backup) {
				tex_copy.loadContentFromPath(tex.path)
				return tex_copy;
			}
			if (tex.source && tex.source.substr(0, 5) == 'data:') {
				tex_copy.fromDataURL(tex.source)
				return tex_copy;
			}
		}

		if (model.texture_groups) {
			model.texture_groups.forEach(tex_group => {
				new TextureGroup(tex_group, tex_group.uuid).add(false);
			})
		}
		if (model.textures && (!Format.single_texture || Texture.all.length == 0)) {
			new_textures.replace(model.textures.map(loadTexture))
		}

		if (model.skin_model) {
			let elements_before = Outliner.elements.slice();
			Codecs.skin_model.rebuild(model.skin_model);
			for (let element of Outliner.elements) {
				if (!elements_before.includes(element)) new_elements.push(element);
			}
		}
		let adjust_uv = !Format.per_texture_uv_size || !imported_format?.per_texture_uv_size;
		if (model.elements) {
			let default_texture = new_textures[0] || Texture.getDefault();
			let format = Formats[model.meta.model_format] || Format
			model.elements.forEach(function(element) {
				if (!OutlinerElement.isTypePermitted(element.type)) return;

				if (Outliner.elements.find(el => el.uuid == element.uuid)) {
					let uuid = guid();
					uuid_map[element.uuid] = uuid;
					element.uuid = uuid;
				}
				var copy = OutlinerElement.fromSave(element, true)
				if (copy instanceof Cube) {
					for (var face in copy.faces) {
						if (!format.single_texture && element.faces) {
							var texture = element.faces[face].texture !== null && new_textures[element.faces[face].texture]
							if (texture) {
								copy.faces[face].texture = texture.uuid
							}
						} else if (default_texture && copy.faces && copy.faces[face].texture !== null) {
							copy.faces[face].texture = default_texture.uuid
						}
						if (!copy.box_uv && adjust_uv) {
							let tex = copy.faces[face].getTexture();
							if (tex && imported_format?.per_texture_uv_size) {
								width = tex.uv_width;
								height = tex.uv_height;
							}
							copy.faces[face].uv[0] *= (Project.getUVWidth(tex)) / width;
							copy.faces[face].uv[2] *= (Project.getUVWidth(tex)) / width;
							copy.faces[face].uv[1] *= (Project.getUVHeight(tex)) / height;
							copy.faces[face].uv[3] *= (Project.getUVHeight(tex)) / height;
						}
					}
				} else if (copy instanceof Mesh) {
					for (let fkey in copy.faces) {
						if (!format.single_texture && element.faces) {
							var texture = element.faces[fkey].texture !== null && new_textures[element.faces[fkey].texture]
							if (texture) {
								copy.faces[fkey].texture = texture.uuid
							}
						} else if (default_texture && copy.faces && copy.faces[fkey].texture !== null) {
							copy.faces[fkey].texture = default_texture.uuid
						}
						if (adjust_uv) {
							for (let vkey in copy.faces[fkey].uv) {
								let tex = copy.faces[fkey].getTexture();
								if (tex && imported_format?.per_texture_uv_size) {
									width = tex.uv_width;
									height = tex.uv_height;
								}
								copy.faces[fkey].uv[vkey][0] *= Project.getUVWidth(tex) / width;
								copy.faces[fkey].uv[vkey][1] *= Project.getUVHeight(tex) / height;
							}
						}
					}
				}
				copy.init()
				new_elements.push(copy);
			})
		}
		if (model.groups) {
			model.groups.forEach((template) => {
				if (Group.all.find(g => g.uuid == template.uuid)) {
					template.uuid = uuid_map[template.uuid] = guid();
				}
				let group = new Group(template, template.uuid).init();
				new_groups.push(group);
			})
		}
		if (model.outliner) {
			// Handle existing UUIDs
			function processList(list) {
				list.forEach((node, i) => {
					if (typeof node == 'string') {
						// element
						if (uuid_map[node]) {
							list[i] = uuid_map[node];
						}
					} else if (node && node.uuid) {
						// Group
						if (uuid_map[node.uuid]) {
							node.uuid = uuid_map[node.uuid];
						}
						if (node.children) processList(node.children);
					}
				})
			}
			processList(model.outliner);

			Outliner.loadJSON(model.outliner, true);
		}
		if (model.collections instanceof Array) {
			for (let collection_data of model.collections) {
				let collection = new Collection(collection_data, collection_data.uuid);
				collection.add();
				for (let i = 0; i < collection.children.length; i++) {
					if (uuid_map[collection.children[i]]) {
						collection.children[i] = uuid_map[collection.children[i]];
					}
				}
			}
		}
		if (model.animations && Format.animation_mode) {
			model.animations.forEach(ani => {
				var base_ani = new Animation();
				if (Animation.all.find(a => a.uuid == ani.uuid)) {
					ani.uuid = guid();
				}
				if (base_ani.animators) {
					for (let key in base_ani.animators) {
						if (uuid_map[key]) {
							base_ani.animators[uuid_map[key]] = base_ani.animators[key];
							delete base_ani.animators[key];
						}
					}
				}
				base_ani.uuid = ani.uuid;
				base_ani.extend(ani).add();
				new_animations.push(base_ani);
			})
		}
		if (model.animation_controllers) {
			model.animation_controllers.forEach(ani => {
				var base_ani = new AnimationController()
				if (AnimationController.all.find(a => a.uuid == ani.uuid)) {
					ani.uuid = guid();
				}
				base_ani.uuid = ani.uuid;
				base_ani.extend(ani).add();
				if (isApp && Format.animation_files) {
					base_ani.saved_name = base_ani.name;
				}
			})
		}
		if (Format.bone_rig) {
			Group.all.forEachReverse(group => group.createUniqueName());
		}
		if (model.animation_variable_placeholders) {
			let vue = Interface.Panels.variable_placeholders.inside_vue;
			if (vue._data.text) {
				vue._data.text = vue._data.text + '\n\n' + model.animation_variable_placeholders;
			} else {
				vue._data.text = model.animation_variable_placeholders;
			}
		}
		if (model.display !== undefined) {
			DisplayMode.loadJSON(model.display)
		}
		Undo.finishEdit('Merge project')
		Canvas.updateAllBones()
		Canvas.updateAllPositions()
		Canvas.updateAllFaces()
		ReferenceImage.updateAll();
		this.dispatchEvent('parsed', {model})
	}
})
Formats.free.codec = codec;

BARS.defineActions(function() {
	codec.export_action = new Action('save_project', {
		icon: 'save',
		category: 'file',
		keybind: new Keybind({key: 's', ctrl: true, alt: true}),
		condition: () => Project,
		click: function () {
			saveTextures(true)
			if (isApp && Project.save_path) {
				codec.write(codec.compile(), Project.save_path);
			} else {
				codec.export()
			}
		}
	})

	new Action('save_project_incremental', {
		icon: 'difference',
		category: 'file',
		keybind: new Keybind({key: 's', shift: true, alt: true}),
		condition: isApp ? (() => Project && Project.save_path) : false,
		click: function () {
			saveTextures(true);
			let projectTailRegex = /\.bbmodel$/;
			let projectVerRegex = /([0-9]+)\.bbmodel$/;
			let projectVerMatch = projectVerRegex.exec(Project.save_path);

			let file_path;
			if (projectVerMatch) {
				let projectVer = parseInt(projectVerMatch[1]); // Parse & store project ver int (capturing group 1)
				file_path = Project.save_path.replace(projectVerRegex, `${projectVer + 1}.bbmodel`);
			} else {
				file_path = Project.save_path.replace(projectTailRegex, "_1.bbmodel");
			}
			let original_file_path = file_path;
			let i = 1;
			while (fs.existsSync(file_path) && i < 100) {
				file_path = original_file_path.replace(projectTailRegex, `_alt_${i == 1 ? '' : i}.bbmodel`);
				i++;
			}
			codec.write(codec.compile(), file_path);
		}
	})

	new Action('save_project_as', {
		icon: 'save',
		category: 'file',
		keybind: new Keybind({key: 's', ctrl: true, alt: true, shift: true}),
		condition: () => Project,
		click: function () {
			saveTextures(true)
			codec.export()
		}
	})
	new Action('export_legacy_project', {
		icon: 'save',
		name: 'Export Legacy Project',
		description: 'Export bbmodel file for Blockbench 4',
		category: 'file',
		condition: () => Project,
		click: function () {
			saveTextures(true);
			let model = codec.compile({raw: true});
			model.meta.format_version = '4.10';
			function compileGroups(undo, lut) {
				var result = []
				function iterate(array, save_array) {
					var i = 0;
					for (var element of array) {
						if (element.type === 'group') {
							var obj = element.compile(undo)
		
							if (element.children.length > 0) {
								iterate(element.children, obj.children)
							}
							save_array.push(obj)
						} else {
							if (undo) {
								save_array.push(element.uuid)
							} else {
								var index = elements.indexOf(element)
								if (index >= 0) {
									save_array.push(index)
								}
							}
						}
						i++;
					}
				}
				iterate(Outliner.root, result);
				return result;
			}
			model.outliner = compileGroups(true);
			delete model.groups;
			for (let anim of (model.animations??[])) {
				for (let animator_id in anim.animators) {
					for (let kf of (anim.animators[animator_id].keyframes??[])) {
						for (let dp of (kf.data_points??[])) {
							if ((kf.channel == 'rotation' || kf.channel == 'position') && dp.x) dp.x = invertMolang(dp.x);
							if (kf.channel == 'rotation' && dp.y) dp.y = invertMolang(dp.y);
						}
					}
				}
			}

			let content = compileJSON(model, {small: Settings.get('minify_bbmodel')});
			Blockbench.export({
				resource_id: 'model',
				type: codec.name,
				extensions: [codec.extension],
				name: codec.fileName(),
				startpath: codec.startPath(),
				content,
			}, path => codec.afterDownload(path))
		}
	})

	new Action('import_project', {
		icon: 'icon-blockbench_file',
		category: 'file',
		condition: () => Format && !Format.pose_mode,
		click: function () {
			Blockbench.import({
				resource_id: 'model',
				extensions: [codec.extension],
				type: codec.name,
				multiple: true,
			}, function(files) {
				files.forEach(file => {
					var model = autoParseJSON(file.content);
					codec.merge(model);
				})
			})
		}
	})
})
