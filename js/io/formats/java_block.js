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

			if (Format.cube_size_limiter) {
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
		if (checkExport('comment', Project.credit || settings.credit.value)) {
			blockmodel.credit = Project.credit || settings.credit.value
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
		if (checkExport('overrides', Project.overrides instanceof Array && Project.overrides.length)) {
			Project.overrides.forEach(override => delete override._uuid)
			blockmodel.overrides = Project.overrides.map(override => new oneLiner(override));
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
		if (typeof (model.credit || model.__comment) == 'string') Project.credit = (model.credit || model.__comment);
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

			for (var key in texture_arr) {
				if (typeof texture_arr[key] === 'string' && key != 'particle') {
					let link = texture_arr[key];
					if (link.startsWith('#') && texture_arr[link.substring(1)]) {
						link = texture_arr[link.substring(1)];
					}
					let texture = new Texture({id: key}).fromJavaLink(texture_arr[key], path_arr.slice()).add();
					texture_paths[texture_arr[key].replace(/^minecraft:/, '')] = texture_ids[key] = texture;
					new_textures.push(texture);
				}
			}
			if (texture_arr.particle) {
				let link = texture_arr.particle;
				if (link.startsWith('#') && texture_arr[link.substring(1)]) {
					link = texture_arr[link.substring(1)];
				}
				if (texture_paths[link.replace(/^minecraft:/, '')]) {
					texture_paths[link.replace(/^minecraft:/, '')].enableParticle()
				} else {
					let texture = new Texture({id: 'particle'}).fromJavaLink(link, path_arr.slice()).enableParticle().add();
					texture_paths[link.replace(/^minecraft:/, '')] = texture_ids.particle = texture;
					new_textures.push(texture);
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
			let can_open = isApp && !model.parent.replace(/\w+:/, '').startsWith('builtin');
			Blockbench.showMessageBox({
				translateKey: 'child_model_only',
				icon: 'info',
				message: tl('message.child_model_only.message', [model.parent]),
				commands: can_open && {
					open: 'message.child_model_only.open',
					open_with_textures: {text: 'message.child_model_only.open_with_textures', condition: Texture.all.length > 0}
				}
			}, (result) => {
				if (result) {
					let textures;
					if (result == 'open_with_textures') {
						textures = {};
						Texture.all.forEach(tex => {
							textures[tex.id] = tex;
						})
					}
					let parent = model.parent.replace(/\w+:/, '');
					let path_arr = path.split(osfs);
					let index = path_arr.length - path_arr.indexOf('models');
					path_arr.splice(-index);
					path_arr.push('models', ...parent.split('/'));
					let parent_path = path_arr.join(osfs) + '.json';

					Blockbench.read([parent_path], {}, (files) => {
						loadModelFile(files[0]);

						if (result == 'open_with_textures') {
							Texture.all.forEach(tex => {
								if (tex.error == 3 && tex.name.startsWith('#')) {
									let loaded_tex = textures[tex.name.replace(/#/, '')];
									if (loaded_tex) {
										tex.fromPath(loaded_tex.path);
										tex.namespace = loaded_tex.namespace;
									}
								}
							})
						}
					})
				}
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
		Validator.validate()
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
	rotation_limit: true,
	rotation_snap: true,
	optional_box_uv: true,
	uv_rotation: true,
	java_face_properties: true,
	animated_textures: true,
	select_texture_for_particles: true,
	texture_mcmeta: true,
	display_mode: true,
	texture_folder: true,
	cube_size_limiter: {
		coordinate_limits: [-16, 32],
		test(cube, values = 0) {
			let from = values.from || cube.from;
			let to = values.to || cube.to;
			let inflate = values.inflate == undefined ? cube.inflate : values.inflate;

			return undefined !== from.find((v, i) => {
				return (
					to[i] + inflate > 32 ||
					to[i] + inflate < -16 ||
					from[i] - inflate > 32 ||
					from[i] - inflate < -16
				)
			})
		},
		move(cube, values = 0) {
			let from = values.from || cube.from;
			let to = values.to || cube.to;
			let inflate = values.inflate == undefined ? cube.inflate : values.inflate;
			
			[0, 1, 2].forEach((ax) => {
				var overlap = to[ax] + inflate - 32
				if (overlap > 0) {
					//If positive site overlaps
					from[ax] -= overlap
					to[ax] -= overlap

					if (16 + from[ax] - inflate < 0) {
						from[ax] = -16 + inflate
					}
				} else {
					overlap = from[ax] - inflate + 16
					if (overlap < 0) {
						from[ax] -= overlap
						to[ax] -= overlap

						if (to[ax] + inflate > 32) {
							to[ax] = 32 - inflate
						}
					}
				}
			})
		},
		clamp(cube, values = 0) {
			let from = values.from || cube.from;
			let to = values.to || cube.to;
			let inflate = values.inflate == undefined ? cube.inflate : values.inflate;
			
			[0, 1, 2].forEach((ax) => {
				from[ax] = Math.clamp(from[ax] - inflate, -16, 32) + inflate;
				to[ax] = Math.clamp(to[ax] + inflate, -16, 32) - inflate;
			})
		}
	},
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