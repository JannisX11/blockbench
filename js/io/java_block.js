(function() {

var codec = new Codec('java_block', {
	name: 'Java Block/Item Model',
	remember: true,
	extension: 'json',
	compile(options) {
		if (options === undefined) options = {}
		var clear_elements = []
		var textures_used = []
		var element_index_lut = []
		var largerCubesNr = 0;

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
			element.from = s.from.slice()
			element.to = s.to.slice()
			if (s.inflate) {
				for (var i = 0; i < 3; i++) {
					element.from[i] -= s.inflate;
					element.to[i] += s.inflate;
				}
			}
			if (s.shade === false) {
				element.shade = false
			}
			if (!s.rotation.allEqual(0) || !s.origin.allEqual(8)) {
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
								tag.uv[i] = n * 16 / main_uv.getResolution(i%2);
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
						if (s.faces[face].tint) {
							tag.tintindex = 0
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
				return n > 32 || n < -16
			}
			if (inVd(element.from[0]) ||
				inVd(element.from[1]) ||
				inVd(element.from[2]) ||
				inVd(element.to[0]) ||
				inVd(element.to[1]) ||
				inVd(element.to[2])
			) {
				largerCubesNr++;
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
		var hasUnsavedTextures = false
		textures.forEach(function(t, i){
			if (t.mode === 'bitmap') {
				hasUnsavedTextures = true
			}
			var link = t.javaTextureLink()
			if (t.particle) {
				texturesObj.particle = link
			}
			if (!textures_used.includes(t) && !isTexturesOnlyModel) return;
			if (t.id !== link.replace(/^#/, '')) {
				texturesObj[t.id] = link
			}
		})

		//if (options.prevent_dialog !== true && hasUnsavedTextures && settings.dialog_unsaved_textures.value) {
		//	Blockbench.showMessageBox({
		//		translateKey: 'unsaved_textures',
		//		icon: 'broken_image',
		//	})
		//}
		if (options.prevent_dialog !== true && largerCubesNr > 0 && settings.dialog_larger_cubes.value) {
			Blockbench.showMessageBox({
				translateKey: 'model_clipping',
				icon: 'settings_overscan',
				message: tl('message.model_clipping.message', [largerCubesNr])
			})
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
		if (checkExport('display', Object.keys(display).length >= 1)) {
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

		var previous_length = add ? elements.length : 0
		var previous_texture_length = add ? textures.length : 0
		var new_cubes = [];
		var new_textures = [];
		if (add) {
			Undo.initEdit({elements: new_cubes, outliner: true, textures: new_textures})
			Prop.added_models++;
			var import_group = new Group(pathToName(path, false)).init()
		}

		//Load
		if (model.texture_size instanceof Array) {
			Project.texture_width  = Math.clamp(parseInt(model.texture_size[0]), 1, Infinity)
			Project.texture_height = Math.clamp(parseInt(model.texture_size[1]), 1, Infinity)
		}
		if (model.display !== undefined) {
			DisplayMode.loadJSON(model.display)
		}
		var texture_ids = {}
		var texture_paths = {}
		if (model.textures) {
			//Create Path Array to fetch textures
			var path_arr = path.split(osfs)
			var index = path_arr.length - path_arr.indexOf('models')
			path_arr.splice(-index)

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
					var t = new Texture({id: 'particle'}).fromJavaLink(texture_arr[tex], path_arr.slice()).enableParticle().add();
					texture_paths[texture_arr[tex]] = texture_ids.particle = t;
					new_textures.push(t);
				}
			}
			//Get Rid Of ID overlapping
			for (var i = previous_texture_length; i < textures.length; i++) {
				var t = textures[i]
				if (getTexturesById(t.id).length > 1) {
					t.id = Prop.added_models + '_' + t.id
				}
			}
			//Select Last Texture
			if (textures.length > 0) {
				textures[textures.length-1].select();
			}
		}

		var oid = elements.length

		if (model.elements) {
			model.elements.forEach(function(obj) {
				base_cube = new Cube(obj)
				if (obj.__comment) base_cube.name = obj.__comment
				//Faces
				var uv_stated = false;
				for (var key in base_cube.faces) {
					var read_face = obj.faces[key];
					var new_face = base_cube.faces[key];
					if (read_face === undefined) {

						new_face.texture = null
						new_face.uv = [0,0,0,0]
					} else {
						if (typeof read_face.uv === 'object') {
							uv_stated = true

							new_face.uv.forEach((n, i) => {
								new_face.uv[i] *= main_uv.getResolution(i%2) / 16;
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
						if (read_face.tintindex !== undefined) {
							new_face.tint = true;
						}
					}
				}
				if (!uv_stated) {
					base_cube.autouv = 2
					base_cube.mapAutoUV()
				} else {
					base_cube.autouv = 0;
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
			(model.parent == 'item/generated' || model.parent == 'item/handheld' || model.parent == 'item/handheld_rod') &&
			model.textures &&
			typeof model.textures.layer0 === 'string'
		) {
			base_cube = new Cube()
			base_cube.extend({
				name: model.textures.layer0,
				from: [0, 0, 7.5],
				to:   [16, 16, 7.8],
				faces: {
					north: {uv: [16,0,0,16], texture: textures[0].uuid || null},
					south: {uv: [0,0,16,16], texture: textures[0].uuid || null},
					east:  {uv: [0,0,0,0], texture: null},
					west:  {uv: [0,0,0,0], texture: null},
					up:	   {uv: [0,0,0,0], texture: null},
					down:  {uv: [0,0,0,0], texture: null},
				},
				autouv: 0,
				export: false
			}).init()
			new_cubes.push(base_cube);
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
		if (add) {
			Undo.finishEdit('add block model')
		}
	},
})

var format = new ModelFormat({
	id: 'java_block',
	extension: 'json',
	icon: 'icon-format_block',
	rotate_cubes: true,
	canvas_limit: true,
	rotation_limit: true,
	optional_box_uv: true,
	uv_rotation: true,
	display_mode: true,
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
})

})()