(function() {

let item_parents = [
	'item/generated', 	'minecraft:item/generated',
	'item/handheld', 	'minecraft:item/handheld',
	'item/handheld_rod','minecraft:item/handheld_rod',
	'builtin/generated','minecraft:builtin/generated',
]

var codec = new Codec('java_block', {
	name: 'Java Block/Item Model',
	remember: true,
	extension: 'json',
	load_filter: {
		type: 'json',
		extensions: ['json'],
		condition(model) {
			return model.parent || model.elements || model.textures;
		}
	},
	compile(options) {
		if (options === undefined) options = {}
		var clear_elements = []
		var textures_used = []
		var element_index_lut = []
		var overflow_cubes = [];

		function computeCube(s) {
			if (s.export == false) return;
			//Create Element
			var element = {}
			element_index_lut[Cube.all.indexOf(s)] = clear_elements.length

			if ((options.cube_name !== false && !settings.minifiedout.value) || options.cube_name === true) {
				if (s.name !== 'cube') {
					element.name = s.name
				}
			}
			element.from = s.from.slice();
			element.to = s.to.slice();
			if (s.inflate) {
				for (var i = 0; i < 3; i++) {
					element.from[i] -= s.inflate;
					element.to[i] += s.inflate;
				}
			}
			if (s.shade === false) {
				element.shade = false
			}
			if (!s.rotation.allEqual(0) || !s.origin.allEqual(0)) {
				var axis = s.rotationAxis()||'y';
				element.rotation = new oneLiner({
					angle: s.rotation[getAxisNumber(axis)],
					axis,
					origin: s.origin
				})
			}
			if (s.rescale) {
				if (element.rotation) {
					element.rotation.rescale = true
				} else {
					element.rotation = new oneLiner({
						angle: 0,
						axis: s.rotation_axis||'y',
						origin: s.origin,
						rescale: true
					})
				}

			}
			if (s.rotation.positiveItems() >= 2) {
				element.rotated = s.rotation
			}
			var element_has_texture
			var e_faces = {}
			for (var face in s.faces) {
				if (s.faces.hasOwnProperty(face)) {
					if (s.faces[face].texture !== null) {
						var tag = new oneLiner()
						if (s.faces[face].enabled !== false) {
							tag.uv = s.faces[face].uv.slice();
							tag.uv.forEach((n, i) => {
								tag.uv[i] = n * 16 / UVEditor.getResolution(i%2);
							})
						}
						if (s.faces[face].rotation) {
							tag.rotation = s.faces[face].rotation
						}
						if (s.faces[face].texture) {
							var tex = s.faces[face].getTexture()
							if (tex) {
								tag.texture = '#' + tex.id
								textures_used.safePush(tex)
							}
							element_has_texture = true
						}
						if (!tag.texture) {
							tag.texture = '#missing'
						}
						if (s.faces[face].cullface) {
							tag.cullface = s.faces[face].cullface
						}
						if (s.faces[face].tint >= 0) {
							tag.tintindex = s.faces[face].tint
						}
						e_faces[face] = tag
					}
				}
			}
			//Gather Textures
			if (!element_has_texture) {
				element.color = s.color
			}
			element.faces = e_faces

			function inVd(n) {
				return n < -16 || n > 32; 
			}
			if (inVd(element.from[0]) ||
				inVd(element.from[1]) ||
				inVd(element.from[2]) ||
				inVd(element.to[0]) ||
				inVd(element.to[1]) ||
				inVd(element.to[2])
			) {
				overflow_cubes.push(s);
			}
			if (Object.keys(element.faces).length) {
				clear_elements.push(element)
			}
		}
		function iterate(arr) {
			var i = 0;
			if (!arr || !arr.length) {
				return;
			}
			for (i=0; i<arr.length; i++) {
				if (arr[i].type === 'cube') {
					computeCube(arr[i])
				} else if (arr[i].type === 'group') {
					iterate(arr[i].children)
				}
			}
		}
		iterate(Outliner.root)

		function checkExport(key, condition) {
			key = options[key]
			if (key === undefined) {
				return condition;
			} else {
				return key
			}
		}
		var isTexturesOnlyModel = clear_elements.length === 0 && checkExport('parent', Project.parent != '')
		var texturesObj = {}
		Texture.all.forEach(function(t, i){
			var link = t.javaTextureLink()
			if (t.particle) {
				texturesObj.particle = link
			}
			if (!textures_used.includes(t) && !isTexturesOnlyModel) return;
			if (t.id !== link.replace(/^#/, '')) {
				texturesObj[t.id] = link
			}
		})

		if (options.prevent_dialog !== true && overflow_cubes.length > 0 && settings.dialog_larger_cubes.value) {
			Blockbench.showMessageBox({
				translateKey: 'model_clipping',
				icon: 'settings_overscan',
				message: tl('message.model_clipping.message', [overflow_cubes.length]),
				buttons: ['dialog.scale.select_overflow', 'dialog.ok'],
				confirm: 1,
				cancel: 1,
			}, (result) => {
				if (result == 0) {
					selected.splice(0, Infinity, ...overflow_cubes)
					updateSelection();
				}
			})
		}
		if (options.prevent_dialog !== true && clear_elements.length && item_parents.includes(Project.parent)) {
			Blockbench.showMessageBox({
				translateKey: 'invalid_builtin_parent',
				icon: 'info',
				message: tl('message.invalid_builtin_parent.message', [Project.parent])
			})
			Project.parent = '';
		}

		var blockmodel = {}
		if (checkExport('comment', settings.credit.value)) {
			blockmodel.credit = settings.credit.value
		}
		if (checkExport('parent', Project.parent != '')) {
			blockmodel.parent = Project.parent
		}
		if (checkExport('ambientocclusion', Project.ambientocclusion === false)) {
			blockmodel.ambientocclusion = false
		}
		if (Project.texture_width !== 16 || Project.texture_height !== 16) {
			blockmodel.texture_size = [Project.texture_width, Project.texture_height]
		}
		if (checkExport('textures', Object.keys(texturesObj).length >= 1)) {
			blockmodel.textures = texturesObj
		}
		if (checkExport('elements', clear_elements.length >= 1)) {
			blockmodel.elements = clear_elements
		}
		if (checkExport('front_gui_light', Project.front_gui_light)) {
			blockmodel.gui_light = 'front';
		}
		if (checkExport('overrides', Project.overrides)) {
			blockmodel.overrides = Project.overrides;
		}
		if (checkExport('display', Object.keys(Project.display_settings).length >= 1)) {
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
				blockmodel.display = new_display
			}
		}
		if (checkExport('groups', (settings.export_groups.value && Group.all.length))) {
			groups = compileGroups(false, element_index_lut)
			var i = 0;
			while (i < groups.length) {
				if (typeof groups[i] === 'object') {
					i = Infinity
				}
				i++
			}
			if (i === Infinity) {
				blockmodel.groups = groups
			}
		}
		this.dispatchEvent('compile', {model: blockmodel, options});
		if (options.raw) {
			return blockmodel
		} else {
			return autoStringify(blockmodel)
		}
	},
	parse(model, path, add) {
		if (!model.elements && !model.parent && !model.display && !model.textures) {
			Blockbench.showMessageBox({
				translateKey: 'invalid_model',
				icon: 'error',
			})
			return;
		}
		Formats.java_block.select()
		Settings.save()

		this.dispatchEvent('parse', {model});

		var previous_texture_length = add ? Texture.all.length : 0
		var new_cubes = [];
		var new_textures = [];
		if (add) {
			Undo.initEdit({elements: new_cubes, outliner: true, textures: new_textures})
			Project.added_models++;
			var import_group = new Group(pathToName(path, false)).init()
		}

		//Load
		if (model.texture_size instanceof Array && !add) {
			Project.texture_width  = Math.clamp(parseInt(model.texture_size[0]), 1, Infinity)
			Project.texture_height = Math.clamp(parseInt(model.texture_size[1]), 1, Infinity)
		}
		if (model.display !== undefined) {
			DisplayMode.loadJSON(model.display)
		}
		if (model.overrides instanceof Array) {
			Project.overrides = model.overrides.slice();
		}

		var texture_ids = {}
		var texture_paths = {}
		if (model.textures) {
			//Create Path Array to fetch textures
			var path_arr = path.split(osfs)
			if (!path_arr.includes('cit')) {
				var index = path_arr.length - path_arr.indexOf('models')
				path_arr.splice(-index)
			}

			var texture_arr = model.textures

			for (var tex in texture_arr) {
				if (texture_arr.hasOwnProperty(tex)) {
					if (tex != 'particle') {
						var t = new Texture({id: tex}).fromJavaLink(texture_arr[tex], path_arr.slice()).add();
						texture_paths[texture_arr[tex]] = texture_ids[tex] = t
						new_textures.push(t);
					}
				}
			}
			if (texture_arr.particle) {
				if (texture_paths[texture_arr.particle]) {
					texture_paths[texture_arr.particle].enableParticle()
				} else {
					var t = new Texture({id: 'particle'}).fromJavaLink(texture_arr.particle, path_arr.slice()).enableParticle().add();
					texture_paths[texture_arr.particle] = texture_ids.particle = t;
					new_textures.push(t);
				}
			}
			//Get Rid Of ID overlapping
			for (var i = previous_texture_length; i < Texture.all.length; i++) {
				var t = Texture.all[i]
				if (getTexturesById(t.id).length > 1) {
					t.id = Project.added_models + '_' + t.id
				}
			}
			//Select Last Texture
			if (Texture.all.length > 0) {
				Texture.all.last().select();
			}
		}

		var oid = elements.length

		if (model.elements) {
			model.elements.forEach(function(obj) {
				base_cube = new Cube(obj)
				if (obj.__comment) base_cube.name = obj.__comment
				//Faces
				var faces_without_uv = false;
				for (var key in base_cube.faces) {
					if (obj.faces[key] && !obj.faces[key].uv) {
						faces_without_uv = true;
					}
				}
				if (faces_without_uv) {
					base_cube.autouv = 2
					base_cube.mapAutoUV()
				} else {
					base_cube.autouv = 0;
				}

				for (var key in base_cube.faces) {
					var read_face = obj.faces[key];
					var new_face = base_cube.faces[key];
					if (read_face === undefined) {

						new_face.texture = null
						new_face.uv = [0,0,0,0]
					} else {
						if (typeof read_face.uv === 'object') {

							new_face.uv.forEach((n, i) => {
								new_face.uv[i] = read_face.uv[i] * UVEditor.getResolution(i%2) / 16;
							})
						}
						if (read_face.texture === '#missing') {
							new_face.texture = false;
							
						} else if (read_face.texture) {
							var id = read_face.texture.replace(/^#/, '')
							var t = texture_ids[id]

							if (t instanceof Texture === false) {
								if (texture_paths[read_face.texture]) {
									var t = texture_paths[read_face.texture]
									if (t.id === 'particle') {
										t.extend({id: id, name: '#'+id}).loadEmpty(3)
									}
								} else {
									var t = new Texture({id: id, name: '#'+id}).add(false).loadEmpty(3)
									texture_ids[id] = t
									new_textures.push(t);
								}
							}
							new_face.texture = t.uuid;
						}
						if (typeof read_face.tintindex == 'number') {
							new_face.tint = read_face.tintindex;
						}
					}
				}

				if (!add) {
					Outliner.root.push(base_cube)
					base_cube.parent = 'root'
				} else if (import_group) {
					import_group.children.push(base_cube)
					base_cube.parent = import_group
				}
				base_cube.init()
				new_cubes.push(base_cube);
			})
		}
		if (model.groups && model.groups.length > 0) {
			if (!add) {
				parseGroups(model.groups)
			} else if (import_group) {
				parseGroups(model.groups, import_group, oid)
			}
		}
		if (import_group) {
			import_group.addTo().select()
		}
		if (
			!model.elements &&
			item_parents.includes(model.parent) &&
			model.textures &&
			typeof model.textures.layer0 === 'string'
		) {
			let texture_mesh = new TextureMesh({
				name: model.textures.layer0,
				rotation: [90, 180, 0],
				local_pivot: [0, -7.5, -16],
				locked: true,
				export: false
			}).init()
			texture_mesh.locked = true;

			new_cubes.push(texture_mesh);
		} else if (!model.elements && model.parent) {
			Blockbench.showMessageBox({
				translateKey: 'child_model_only',
				icon: 'info',
				message: tl('message.child_model_only.message', [model.parent])
			})
		}
		updateSelection()

		//Set Parent
		if (model.parent !== undefined) {
			Project.parent = model.parent;
		}
		//Set Ambient Occlusion
		if (model.ambientocclusion === false) {
			Project.ambientocclusion = false;
		}
		if (model.gui_light === 'front') {
			Project.front_gui_light = true;
		}
		this.dispatchEvent('parsed', {model});
		if (add) {
			Undo.finishEdit('Add block model')
		}
	},
})

var format = new ModelFormat({
	id: 'java_block',
	extension: 'json',
	icon: 'icon-format_block',
	category: 'minecraft',
	target: 'Minecraft: Java Edition',
	format_page: {
		content: [
			{type: 'h3', text: tl('mode.start.format.informations')},
			{text: `* ${tl('format.java_block.info.rotation')}
					* ${tl('format.java_block.info.size')}
					* ${tl('format.java_block.info.animation')}`.replace(/\t+/g, '')
			}
		]
	},
	render_sides() {
		if (Modes.display && ['thirdperson_righthand', 'thirdperson_lefthand', 'head'].includes(display_slot)) {
			return 'double';
		} else {
			return 'front';
		}
	},
	model_identifier: false,
	parent_model_id: true,
	vertex_color_ambient_occlusion: true,
	rotate_cubes: true,
	canvas_limit: true,
	rotation_limit: true,
	optional_box_uv: true,
	uv_rotation: true,
	java_face_properties: true,
	animated_textures: true,
	select_texture_for_particles: true,
	display_mode: true,
	texture_folder: true,
	codec
})
codec.format = format;

BARS.defineActions(function() {
	codec.export_action = new Action({
		id: 'export_blockmodel',
		icon: 'icon-format_block',
		category: 'file',
		condition: () => Format == format,
		click: function () {
			codec.export();
		}
	})
	new Action('import_java_block_model', {
		icon: 'assessment',
		category: 'file',
		condition: () => Format == format,
		click: function () {
			Blockbench.import({
				resource_id: 'model',
				extensions: ['json'],
				type: codec.name,
				multiple: true,
			}, function(files) {
				files.forEach(file => {
					var model = autoParseJSON(file.content)
					codec.parse(model, file.path, true)
				})
			})
		}
	})
})

})()