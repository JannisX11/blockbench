//New
function newProject(entity_mode) {
	if (showSaveDialog()) {
		if (Toolbox.selected.id !== 'move_tool') BarItems.move_tool.select();
		elements.length = 0;
		TreeElements.length = 1;
		TreeElements.splice(0, 1);
		Canvas.materials.length = 0;
		textures.length = 0;
		selected.length = 0;
		selected_group = undefined;
		Blockbench.display_settings = display = {};
		Project.name = Project.parent = Project.description	 = '';
		Project.texture_width = Project.texture_height = 16;
		Project.ambientocclusion = true;
		Prop.file_path = Prop.file_name = Prop.file_name_alt = '';
		Prop.project_saved = true;
		Prop.animation_path = '';
		Prop.added_models = 0;
		setProjectTitle();
		Canvas.updateAll();
		outliner.$forceUpdate();
		texturelist.$forceUpdate();
		Undo.history.length = 0;
		Undo.index = 0;
		Painter.current = {};
		Animator.animations.length = 1;
		Animator.selected = undefined;
		Animator.animations.splice(0, 1);
		if (entity_mode) {
			entityMode.join();
		} else {
			entityMode.leave();
		}
		$('#var_placeholder_area').val('')
		Blockbench.dispatchEvent('new_project')
		return true;
	} else {
		return false;
	}
}
//Import
function setupDragHandlers() {
	Blockbench.addDragHandler(
		'model',
		{extensions: ['json', 'jem', 'jpm', 'bbmodel']},
		function(files) {
			loadModel(files[0].content, files[0].path || files[0].path)
			if (isApp) {
				addRecentProject({name: pathToName(files[0].path, 'mobs_id'), path: files[0].path})
			}
		}
	)
	Blockbench.addDragHandler(
		'style',
		{extensions: ['bbstyle']},
		function(files) {
			applyBBStyle(files[0].content)
		}
	)
	Blockbench.addDragHandler(
		'plugin',
		{extensions: ['bbplugin', 'js']},
		function(files) {
			loadPluginFromFile(files[0])
		}
	)
	Blockbench.addDragHandler(
		'texture',
		{extensions: ['png', 'tga'], element: '#textures', propagate: true, readtype: 'image'},
		function(files, event) {
			var texture_li = $(event.target).parents('li.texture')
			if (texture_li.length) {
				var tex = textures.findInArray('uuid', texture_li.attr('texid'))
				if (tex) {
					tex.fromFile(files[0])
					return;
				}
			}
			files.forEach(function(f) {
				new Texture().fromFile(f).add().fillParticle()
			})
		}
	)
}
function loadModel(data, filepath, add) {
	if (!add) {
		//Create New Project
		if (newProject() == false) return;
		Prop.file_path = filepath
		setProjectTitle(pathToName(filepath))
	}
	Blockbench.addFlag('importing')
	var model = autoParseJSON(data)
	var extension = pathToExtension(filepath)

	if (extension === 'bbmodel') {
		loadBBModel(model)
	} else if (extension === 'jpm') {
		loadJPMModel(model)
	} else if (extension === 'jem') {
		loadJEMModel(model)
	} else { //JSON
		for (var key in model) {
			if (key.includes('geometry.')) {
				loadEntityModelFile(model)
				return;
			}
		}
		loadBlockModel(model, filepath, add)
	}

	loadTextureDraggable()
	loadOutlinerDraggable()
	Canvas.updateAll()
	Blockbench.removeFlag('importing')
	if (!add) {
		Prop.project_saved = true;
	}
}
function loadBBModel(model) {
	if (!model.meta || !model.meta.format) {
		Blockbench.showMessageBox({
			translateKey: 'invalid_model',
			icon: 'error',
		})
		return;
	}
	if (compareVersions(model.meta.format, '1.0')) {
		Blockbench.showMessageBox({
			translateKey: 'outdated_client',
			icon: 'error',
		})
		return;
	}
	if (model.meta.box_uv && model.meta.bone_rig) {
		entityMode.join()
	} else {
		Blockbench.entity_mode = false;
	}
	saveSettings()
	Project.name = model.name;
	if (model.geo_name) {
		Project.geometry_name = model.geo_name;
	} else if (model.parent) {
		Project.parent = model.parent;
	}
	if (model.ambientocclusion !== undefined) {
		Project.ambientocclusion = !!model.ambientocclusion;
	}
	if (model.resolution !== undefined) {
		Project.texture_width = model.resolution.width;
		Project.texture_height = model.resolution.height;
	}

	if (model.textures) {
		model.textures.forEach(tex => {
			var tex_copy = new Texture(tex).add(false);
			tex_copy.uuid = tex.uuid;
			if (tex_copy.mode === 'link') {
				tex_copy.fromPath(tex.path)
			} else {
				tex_copy.fromDataURL(tex.source)
			}
		})
	}
	if (model.cubes) {
		model.cubes.forEach(function(cube) {
			base_cube = new Cube(cube).init(false)
			for (var face in base_cube.faces) {
				if (!model.meta.box_uv) {
					var texture = textures[cube.faces[face].texture]
					if (texture) {
						base_cube.faces[face].texture = texture.uuid
					}
				} else if (textures[0]) {
					base_cube.faces[face].texture = textures[0].uuid
				}
			}
		})
		loadOutlinerDraggable()
	}
	if (model.outliner) {
		parseGroups(model.outliner)
	}
	if (model.animations) {
		model.animations.forEach(ani => {
			var base_ani = new Animation(ani).add();
		})
	}
	if (model.display !== undefined) {
		DisplayMode.loadJSON(model.display)
	}
}
function loadBlockModel(model, filepath, add) {
	if (!model.elements && !model.parent && !model.display && !model.textures) {
		Blockbench.showMessageBox({
			translateKey: 'invalid_model',
			icon: 'error',
		})
		return;
	}
	if (model.mode === 'entity') {
		entityMode.join()
	} else {
		Blockbench.entity_mode = false;
	}
	saveSettings()

	var previous_length = add ? elements.length : 0
	var previous_texture_length = add ? textures.length : 0
	if (add) {
		Prop.added_models++;
		var import_group = new Group(pathToName(filepath, false))
	}

	//Load
	if (model.display !== undefined) {
		DisplayMode.loadJSON(model.display)
	}
	var texture_ids = {}
	if (model.textures) {
		//Create Path Array to fetch textures
		var path_arr = filepath.split(osfs)
		var index = path_arr.length - path_arr.indexOf('models')
		path_arr.splice(-index)

		var texture_arr = model.textures
		var paths = {}

		for (var tex in texture_arr) {
			if (texture_arr.hasOwnProperty(tex)) {
				if (tex != 'particle') {
					var t = new Texture({id: tex}).fromJavaLink(texture_arr[tex], path_arr.slice()).add(false)
					paths[texture_arr[tex]] = texture_ids[tex] = t
				}
			}
		}
		if (texture_arr.particle) {
			if (paths[texture_arr.particle]) {
				paths[texture_arr.particle].enableParticle()
			} else {
				var t = new Texture({id: 'particle'}).fromJavaLink(texture_arr[tex], path_arr.slice()).add(false).enableParticle()
				texture_ids.particle = t;
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
			for (var face in base_cube.faces) {
				if (obj.faces[face] === undefined) {

					base_cube.faces[face].texture = null
					base_cube.faces[face].uv = [0,0,0,0]
				} else {
					delete base_cube.faces[face].texture;
					if (typeof obj.faces[face].uv === 'object') {
						uv_stated = true
					}
					if (obj.faces[face].texture === '#missing') {

					} else if (obj.faces[face].texture) {
						var t = texture_ids[obj.faces[face].texture.replace(/^#/, '')]
						if (t instanceof Texture) {
							base_cube.faces[face].texture = t.uuid;
						}
					}
					if (obj.faces[face].tintindex !== undefined) {
						base_cube.faces[face].tint = true;
					}
				}
			}
			if (!uv_stated) {
				base_cube.autouv = 2
				base_cube.mapAutoUV()
			} else {
				base_cube.autouv = 0;
			}
			elements.push(base_cube);
			if (!add) {
				TreeElements.push(base_cube)
				base_cube.parent = 'root'
			} else if (import_group) {
				import_group.children.push(base_cube)
				base_cube.parent = import_group
			}
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
				north: {uv: [16,0,0,16], texture: 'layer0'},
				south: {uv: [16,0,16,0], texture: 'layer0'},
				east:  {uv: [0,0,0,0], texture: null},
				west:  {uv: [0,0,0,0], texture: null},
				up:	{uv: [0,0,0,0], texture: null},
				down:  {uv: [0,0,0,0], texture: null},
			},
			autouv: 0,
			export: false
		})
		elements.push(base_cube);
		base_cube.addTo()
	} else if (!model.elements && model.parent) {
		Blockbench.showMessageBox({
			translateKey: 'child_model_only',
			icon: 'info',
			message: tl('message.child_model_only.message', [model.parent])
		})
	}

	//Set Parent
	if (model.parent !== undefined) {
		Project.parent = model.parent;
	}
	//Set Ambient Occlusion
	if (model.ambientocclusion === false) {
		Project.ambientocclusion = false;
	}
}
function loadJPMModel(model) {
	function addSubmodel(submodel) {
		if (submodel.boxes) {
			submodel.boxes.forEach(function(box) {
				var cs = box.coordinates
				if (cs && cs.length >= 6) {
					base_cube = new Cube({
						from: [
							cs[0],
							cs[1],
							cs[2]
						],
						to: [
							cs[0] + cs[3],
							cs[1] + cs[4],
							cs[2] + cs[5]
						],
						name: submodel.id,
						faces: {
							north: {uv: box.uvNorth},
							east: {uv: box.uvEast},
							south: {uv: box.uvSouth},
							west: {uv: box.uvWest},
							up: {uv: box.uvUp},
							down: {uv: box.uvDown},
						},
						rotation: submodel.rotate
					})
					elements.push(base_cube);
					TreeElements.push(base_cube)
				}
			})
		}
		if (submodel.submodels) {
			submodel.submodels.forEach(addSubmodel)
		}
	}
	addSubmodel(model)
	Canvas.updateAll()
}
function loadJEMModel(model) {
	entityMode.join()
	if (model.textureSize) {
		Project.texture_width = parseInt(model.textureSize[0])
		Project.texture_height = parseInt(model.textureSize[1])
	}
	if (model.models) {
		model.models.forEach(function(b) {
			if (typeof b !== 'object') return;
			var subcount = 0;

			//Bone
			var group = new Group({
				name: b.part,
				origin: b.translate,
				rotation: b.rotate,
				mirror_uv: (b.mirrorTexture && b.mirrorTexture.includes('u'))
			})
			group.origin[1] *= -1
			group.origin[2] *= -1

			function readContent(submodel, p_group) {

				if (submodel.boxes && submodel.boxes.length) {
					submodel.boxes.forEach(box => {

						var base_cube = new Cube({
							name: box.name || p_group.name,
							autouv: 0,
							uv_offset: box.textureOffset,
							inflate: box.sizeAdd,
							mirror_uv: p_group.mirror_uv
						})
						if (box.coordinates) {
							base_cube.extend({
								from: [
									box.coordinates[0],
									box.coordinates[1],
									box.coordinates[2]
								],
								to: [
									box.coordinates[0]+box.coordinates[3],
									box.coordinates[1]+box.coordinates[4],
									box.coordinates[2]+box.coordinates[5]
								]
							})
						}
						if (p_group.parent !== 'root') {
							for (var i = 0; i < 3; i++) {
								base_cube.from[i] += p_group.origin[i];
								base_cube.to[i] += p_group.origin[i];
							}
						}
						elements.push(base_cube)
						base_cube.addTo(p_group)
					})
				}
				if (submodel.submodels && submodel.submodels.length) {
					submodel.submodels.forEach(subsub => {
						var group = new Group({
							name: `${b.part}_sub_${subcount}`,
							origin: subsub.translate || submodel.translate,
							rotation: subsub.rotate,
							mirror_uv: (subsub.mirrorTexture && subsub.mirrorTexture.includes('u'))
						})
						subcount++;
						group.rotation[2] *= -1
						group.addTo(p_group)
						readContent(subsub, group)
					})
				}

			}
			group.addTo(undefined)
			readContent(b, group)
		})
	}
	loadOutlinerDraggable()
	Canvas.updateAll()
	if (model.texture) {
		var path = Prop.file_path.replace(/\\[\w .-]+$/, '\\'+model.texture)
		new Texture().fromPath(path).add(false)
	}
}
function loadEntityModelFile(data) {
	pe_list_data.length = 0
	entityMode.join()

	var geometries = []
	for (var key in data) {
		if (typeof data[key] === 'object') {
			geometries.push(key);
		}
	}
	if (geometries.length === 1) {
		loadEntityModel({object: data[geometries[0]], name: geometries[0]})
		return;
	}

	$('#pe_search_bar').val('')
	if (pe_list && pe_list._data) {
		pe_list._data.search_text = ''
	}
	saveSettings()

	function rotateOriginCoord(pivot, y, z) {
		return [
			pivot[1] - pivot[2] + z,
			pivot[2] - y + pivot[1]
		]
	}
	function create_thumbnail(model_entry, isize) {
		var included_bones = []
		model_entry.object.bones.forEach(function(b) {
			included_bones.push(b.name)
		})
		var thumbnail = new Jimp(48, 48, 0x00000000, function(err, image) {
			model_entry.object.bones.forEach(function(b) {
				//var rotate_bone = false;
				//if (b.name === 'body' &&
				//	(included_bones.includes('leg3') || model_entry.name.includes('chicken') || model_entry.name.includes('ocelot')) &&
				//	included_bones.includes('leg4') === false &&
				//	!model_entry.name.includes('creeper') &&
				//	( b.rotation === undefined ||b.rotation.join('_') === '0_0_0')
				//) {
				//	rotate_bone = true;
				//}
				var rotation = b.rotation
				if (!rotation || rotation[0] === undefined) {
					if (entityMode.hardcodes[model_entry.name] && entityMode.hardcodes[model_entry.name][b.name]) {
						rotation = entityMode.hardcodes[model_entry.name][b.name].rotation
					}
				}
				if (b.cubes) {
					b.cubes.forEach(function(c) {
						if (c.origin && c.size) {
							//Do cube
							var inflate = c.inflate||0
							var coords = {
								x: (c.origin[2]-inflate)*isize+24,
								y: 40-(c.origin[1]+c.size[1]+inflate)*isize,
								w: (c.size[2]+2*inflate)*isize,
								h: (c.size[1]+2*inflate)*isize
							}
							var shade = (limitNumber(c.origin[0], -24, 24)+24)/48*255
							var color = parseInt('0xffffff'+shade.toString(16))
							coords.x = limitNumber(coords.x, 0, 47)
							coords.y = limitNumber(coords.y, 0, 47)
							coords.w = limitNumber(coords.w, 0, 47 - coords.x)
							coords.h = limitNumber(coords.h, 0, 47 - coords.y)
							if (coords.h > 0 && coords.w > 0) {
								if (rotation && rotation[0] !== 0 && b.pivot) {
									Painter.drawRotatedRectangle(
										image,
										0xffffff88,
										coords,
										b.pivot[2]*isize+24,
										40-b.pivot[1]*isize,
										-rotation[0]
									)
								} else {
									Painter.drawRectangle(image, 0xffffff88, coords)
								}
							}
						}
					})
				}
			})

			//Send
			image.getBase64("image/png", function(a, dataUrl){
				model_entry.icon = dataUrl
			})
		})
	}
	for (var key in data) {
		if (key.includes('geometry.') && data.hasOwnProperty(key)) {
			var base_model = {name: key, bonecount: 0, cubecount: 0, selected: false, object: data[key], icon: false}
			var oversize = 2;
			var words = key.replace(/:.*/g, '').replace('geometry.', '').split(/[\._]/g)
			words.forEach(function(w, wi) {
				words[wi] = capitalizeFirstLetter(w)
			})
			base_model.title = words.join(' ')
			if (data[key].bones) {
				base_model.bonecount = data[key].bones.length
				data[key].bones.forEach(function(b) {
					if (b.cubes) {
						base_model.cubecount += b.cubes.length
						b.cubes.forEach(function(c) {
							if (c.origin && c.size && (c.origin[2] < -12 || c.origin[2] + c.size[2] > 12 || c.origin[1] + c.size[1] > 22) && oversize === 2) oversize = 1
							if (c.origin && c.size && (c.origin[2] < -24 || c.origin[2] + c.size[2] > 24)) oversize = 0.5
						})
					}
				})
				if (typeof base_model.cubecount !== 'number') {
					base_model.cubecount = '[E]'
				} else if (base_model.cubecount > 0) {

					create_thumbnail(base_model, oversize)


				}
			}
			pe_list_data.push(base_model)
		}
	}
	if (pe_list == undefined) {
		pe_list = new Vue({
			el: '#pe_list',
			data: {
				search_text: '',
				list: pe_list_data
			},
			methods: {
				selectE: function(item, event) {
					var index = pe_list_data.indexOf(item)
					pe_list_data.forEach(function(s) {
						s.selected = false;
					})
					pe_list_data[index].selected = true
				}
			},
			computed: {
				searched() {
					var scope = this;
					return this.list.filter(item => {
						return item.name.toUpperCase().includes(scope.search_text)
					})
				}
			}
		})
	}
	showDialog('entity_import')
	$('#pe_list').css('max-height', ($(window).height() - 320) +'px')
	$('input#pe_search_bar').select()
	//texturelist._data.elements = textures
}
function loadEntityModel(data) {
	if (data === undefined) {
		pe_list_data.forEach(function(s) {
			if (s.selected === true) {
				data = s
			}
		})
		if (data == undefined) {
			data = pe_list_data[0]
		}
	}
	Project.parent = data.name.replace(/^geometry\./, '')
	Project.texture_width = 64
	Project.texture_height = 64

	if (data.object.texturewidth !== undefined) {
		Project.texture_width = data.object.texturewidth
	}
	if (data.object.textureheight !== undefined) {
		Project.texture_height = data.object.textureheight
	}
	entityMode.old_res.x = Project.texture_width
	entityMode.old_res.y = Project.texture_height

	var bones = {}

	if (data.object.bones) {
		var included_bones = []
		data.object.bones.forEach(function(b) {
			included_bones.push(b.name)
		})
		data.object.bones.forEach(function(b, bi) {
			var group = new Group({name: b.name, origin: b.pivot, material: b.material})
			bones[b.name] = group
			if (b.pivot) {
				group.origin[0] *= -1
			}
			if (b.rotation && b.rotation.join('_') !== '0_0_0') {
				group.rotation = b.rotation
			} else {
				if (entityMode.hardcodes[data.name] && entityMode.hardcodes[data.name][b.name]) {
					group.rotation = entityMode.hardcodes[data.name][b.name].rotation
				} else {
					if (b.name === 'body' &&
						included_bones.includes('leg3') &&
						included_bones.includes('leg4') === false &&
						!data.name.includes('creeper') &&
						(group.rotation.join('_') === '0_0_0' || group.rotation === undefined)
					) {
						group.rotation = [90, 0, 0]
					}
				}
			}
			group.rotation.forEach(function(br, ri) {
				group.rotation[ri] *= -1
			})
			
			group.mirror_uv = b.mirror === true
			group.reset = b.reset === true

			if (b.cubes) {
				b.cubes.forEach(function(s) {
					var base_cube = new Cube({name: b.name, autouv: 0, color: bi%8})
					if (s.origin) {
						base_cube.from = s.origin
						base_cube.from[0] = -(base_cube.from[0] + s.size[0])
						if (s.size) {
							base_cube.to[0] = s.size[0] + base_cube.from[0]
							base_cube.to[1] = s.size[1] + base_cube.from[1]
							base_cube.to[2] = s.size[2] + base_cube.from[2]
						}
					}
					if (s.uv) {
						base_cube.uv_offset[0] = s.uv[0]
						base_cube.uv_offset[1] = s.uv[1]
					}
					if (s.inflate && typeof s.inflate === 'number') {
						base_cube.inflate = s.inflate
					}
					if (s.mirror === undefined) {
						base_cube.mirror_uv = group.mirror_uv
					} else {
						base_cube.mirror_uv = s.mirror === true
					}
					elements.push(base_cube)
					base_cube.addTo(group)
				})
			}
			if (b.children) {
				b.children.forEach(function(cg) {
					cg.addTo(group)
				})
			}
			var parent_group = 'root';
			if (b.parent) {
				if (bones[b.parent]) {
					parent_group = bones[b.parent]
				} else {
					data.object.bones.forEach(function(ib) {
						if (ib.name === b.parent) {
							ib.children && ib.children.length ? ib.children.push(group) : ib.children = [group]
						}
					})
				}
			}
			group.addTo(parent_group)
		})
	}
	pe_list_data.length = 0;
	hideDialog()

	loadTextureDraggable()
	loadOutlinerDraggable()
	Canvas.updateAll()
	setProjectTitle()
	if (isApp && Project.parent) {
		findEntityTexture(Project.parent)
	}
}
var Extruder = {
	drawImage: function(path) {
		Extruder.canvas = $('#extrusion_canvas').get(0)
		var ctx = extrusion_canvas.getContext('2d')

		setProgressBar('extrusion_bar', 0)
		$('#scan_tolerance').on('input', function() {
			$('#scan_tolerance_label').text($(this).val())
		})
		showDialog('image_extruder')

		Extruder.ext_img = new Image()
		Extruder.ext_img.src = path
		Extruder.ext_img.style.imageRendering = 'pixelated'
		ctx.imageSmoothingEnabled = false;

		Extruder.ext_img.onload = function() {
			ctx.clearRect(0, 0, 256, 256);
			ctx.drawImage(Extruder.ext_img, 0, 0, 256, 256)
			Extruder.width = Extruder.ext_img.naturalWidth
			Extruder.height = Extruder.ext_img.naturalHeight

			if (Extruder.width > 128) return;

			var g = 256 / Extruder.width;
			var p = 0
			ctx.beginPath();

			for (var x = 0; x <= 256; x += g) {
				ctx.moveTo(0.5 + x + p, p);
				ctx.lineTo(0.5 + x + p, 256 + p);
			}
			for (var x = 0; x <= 256; x += g) {
				ctx.moveTo(p, 0.5 + x + p);
				ctx.lineTo(256 + p, 0.5 + x + p);
			}

			ctx.strokeStyle = "black";
			ctx.stroke();
		}

		//Grid
	},
	startConversion: function() {
		var scan_mode = $('select#scan_mode option:selected').attr('id') /*areas, lines, columns, pixels*/
		var texture = textures[textures.length-1].uuid
		var isNewProject = elements.length === 0;

		var jimage = Jimp.read(Extruder.ext_img.src).then(function(image) {	
			var pixel_opacity_tolerance = $('#scan_tolerance').val()

			//var ext_x, ext_y;
			var finished_pixels = {}
			var cube_nr = 0;
			var cube_name = textures[textures.length-1].name.split('.')[0]
			selected = []
			//Scale Index
			var scale_i = 1;
			if (Extruder.width < Extruder.height) {
				Extruder.width = Extruder.height;
			}
			scale_i = 16 / Extruder.width;

			function isOpaquePixel(px_x, px_y) {
				return Math.isBetween(px_x, 0, Extruder.width-1)
					&& Math.isBetween(px_y, 0, Extruder.height-1)
					&& parseInt(image.getPixelColor(px_x, px_y).toString(16).substr(6,2), 16) >= pixel_opacity_tolerance;
			}
			function finishPixel(x, y) {
				if (finished_pixels[x] === undefined) {
					finished_pixels[x] = {}
				}
				finished_pixels[x][y] = true
			}
			function isPixelFinished(x, y) {
				return (finished_pixels[x] !== undefined && finished_pixels[x][y] === true)
			}

			//Scanning
			let ext_y = 0;
			while (ext_y < Extruder.height) {

				let ext_x = 0;
				while (ext_x < Extruder.width) {
					if (isPixelFinished(ext_x, ext_y) === false && isOpaquePixel(ext_x, ext_y) === true) {

						//Search From New Pixel
						var loop = true;
						var rect = {x: ext_x, y: ext_y, x2: ext_x, y2: ext_y}
						var safety_limit = 5000

						//Expanding Loop
						while (loop === true && safety_limit) {
							var y_check, x_check, canExpandX, canExpandY;
							//Expand X
							if (scan_mode === 'areas' || scan_mode === 'lines') {
								y_check = rect.y
								x_check = rect.x2 + 1
								canExpandX = true
								while (y_check <= rect.y2) {
									//Check If Row is Free
									if (isOpaquePixel(x_check, y_check) === false || isPixelFinished(x_check, y_check) === true) {
										canExpandX = false;
									}
									y_check += 1
								}
								if (canExpandX === true) {
									rect.x2 += 1
								}
							} else {
								canExpandX = false;
							}
							//Expand Y
							if (scan_mode === 'areas' || scan_mode === 'columns') {
								x_check = rect.x
								y_check = rect.y2 + 1
								canExpandY = true
								while (x_check <= rect.x2) {
									//Check If Row is Free
									if (isOpaquePixel(x_check, y_check) === false || isPixelFinished(x_check, y_check) === true) {
										canExpandY = false
									}
									x_check += 1
								}
								if (canExpandY === true) {
									rect.y2 += 1
								}
							} else {
								canExpandY = false;
							}
							//Conclusion
							if (canExpandX === false && canExpandY === false) {
								loop = false;
							}
							safety_limit--;
						}

						//Draw Rectangle
						var draw_x = rect.x
						var draw_y = rect.y
						while (draw_y <= rect.y2) {
							draw_x = rect.x
							while (draw_x <= rect.x2) {
								finishPixel(draw_x, draw_y)
								draw_x++;
							}
							draw_y++;
						}
						var current_cube = new Cube({
							name: cube_name+'_'+cube_nr,
							autouv: 0,
							from: [rect.x*scale_i, 0, rect.y*scale_i],
							to: [(rect.x2+1)*scale_i, scale_i, (rect.y2+1)*scale_i],
							faces: {
								up:		{uv:[rect.x*scale_i, rect.y*scale_i, (rect.x2+1)*scale_i, (rect.y2+1)*scale_i], texture: texture},
								down:	{uv:[rect.x*scale_i, (rect.y2+1)*scale_i, (rect.x2+1)*scale_i, rect.y*scale_i], texture: texture},
								north:	{uv:[(rect.x2+1)*scale_i, rect.y*scale_i, rect.x*scale_i, (rect.y+1)*scale_i], texture: texture},
								south:	{uv:[rect.x*scale_i, rect.y2*scale_i, (rect.x2+1)*scale_i, (rect.y2+1)*scale_i], texture: texture},
								east:	{uv:[rect.x2*scale_i, rect.y*scale_i, (rect.x2+1)*scale_i, (rect.y2+1)*scale_i], texture: texture, rotation: 90},
								west:	{uv:[rect.x*scale_i, rect.y*scale_i, (rect.x+1)*scale_i, (rect.y2+1)*scale_i], texture: texture, rotation: 270}
							}
						})

						elements.push(current_cube)
						selected.push(elements[elements.length-1])
						cube_nr++;
					}


					ext_x++;
				}
				ext_y++;
			}

			var group = new Group(cube_name).addTo()
			selected.forEach(function(s) {
				s.addTo(group)
			})
			if (Blockbench.hasFlag('new_project') || isNewProject) {
				setProjectTitle(cube_name)
				Prop.project_saved = false;
			}
			Blockbench.removeFlag('new_project')
			loadOutlinerDraggable()
			Canvas.updateAll()
			hideDialog()
		})
	}
}
//Export
function buildBBModel(options) {
	if (!options) options = 0;
	var model = {
		meta: {
			format: '1.0',
			box_uv: Blockbench.entity_mode,
			bone_rig: Blockbench.entity_mode,
		},
		name: Project.name,
	}
	model[Blockbench.entity_mode ? 'geo_name' : 'parent'] = Project.parent
	if (!Blockbench.entity_mode) {
		model.ambientocclusion = Project.ambientocclusion
	}
	if (model.meta.box_uv) {
		model.resolution = {
			width: Project.texture_width || 16,
			height: Project.texture_height || 16,
		}
	}
	model.cubes = []
	elements.forEach(cube => {
		var el = {
			name: cube.name,
			from: cube.from,
			to: cube.to,
			autouv: cube.autouv,
			color: cube.color
		}
		if (!cube.visibility) el.visibility = false;
		if (!cube.export) el.export = false;
		if (!cube.shade) el.shade = false;
		if (cube.inflate) el.inflate = cube.inflate;
		if (!cube.rotation.allEqual(0)) el.rotation = cube.rotation;
		if (!cube.origin.allEqual(0)) el.origin = cube.origin;
		if (!cube.uv_offset.allEqual(0)) el.uv_offset = cube.uv_offset;

		if (!model.meta.box_uv) {
			el.faces = {}
			for (var face in cube.faces) {
				el.faces[face] = cube.faces[face].getSaveCopy()
			}
		}

		model.cubes.push(el)
	})
	model.outliner = compileGroups()

	model.textures = [];
	textures.forEach(tex => {
		var t = tex.getUndoCopy();
		delete t.selected;
		model.textures.push(t);
	})

	if (Animator.animations.length) {
		model.animations = [];
		Animator.animations.forEach(a => {
			model.animations.push(a.undoCopy({bone_names: true}))
		})
	}


	if (!Blockbench.entity_mode && Object.keys(display).length >= 1) {
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
	if (options.raw) {
		return model
	} else {
		return JSON.stringify(model)
	}
}
function buildBlockModel(options) {
	if (options === undefined) options = {}
	var clear_elements = []
	var textures_used = []
	var element_index_lut = []
	var largerCubesNr = 0;

	function computeCube(s) {
		if (s.export == false) return;
		//Create Element
		var element = {}
		element_index_lut[s.index] = clear_elements.length

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
		if (!s.rotation.equals([0, 0, 0])) {
			element.rotation = new oneLiner({
				angle: s.rotation[getAxisNumber(s.rotationAxis())],
				axis: s.rotationAxis(),
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
						tag.uv = s.faces[face].uv
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


		if (checkExport('backup')) {
			element.uv_offset = s.uv_offset
		}

		function inVd(n) {
			return n > 32 || n < -16
		}
		if (inVd(s.from[0]) ||
			inVd(s.from[1]) ||
			inVd(s.from[2]) ||
			inVd(s.to[0]) ||
			inVd(s.to[1]) ||
			inVd(s.to[2])
		) {
			largerCubesNr++;
		}
		clear_elements.push(element)
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
	iterate(TreeElements)

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
		if (!textures_used.includes(t) && !isTexturesOnlyModel) return;

		texturesObj[t.id] = t.javaTextureLink(options.backup)
		if (t.particle) {
			texturesObj.particle = t.javaTextureLink(options.backup)
		}
		if (t.mode === 'bitmap') {
			hasUnsavedTextures = true
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
	if (checkExport('textures', Object.keys(texturesObj).length >= 1)) {
		blockmodel.textures = texturesObj
	}
	if (checkExport('elements', clear_elements.length >= 1)) {
		blockmodel.elements = clear_elements
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
	if (checkExport('groups', (settings.export_groups.value && getAllOutlinerGroups().length))) {
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
	if (checkExport('backup')) {
		blockmodel.mode = Blockbench.entity_mode ? 'entity' : 'block'
	}
	if (options.raw) {
		return blockmodel
	} else {
		return autoStringify(blockmodel)
	}
}
function buildEntityModel(options) {
	if (options === undefined) options = {}
	var entitymodel = {}
	entitymodel.texturewidth = parseInt(Project.texture_width);
	entitymodel.textureheight = parseInt(Project.texture_height);
	var bones = []
	var cube_count = 0;
	var visible_box = new THREE.Box3()

	var groups = getAllOutlinerGroups()
	var loose_cubes = [];
	TreeElements.forEach(obj => {
		if (obj.type === 'cube') {
			loose_cubes.push(obj)
		}
	})
	if (loose_cubes.length) {
		groups.splice(0, 0, {
			type: 'group',
			parent: 'root',
			name: 'unknown_bone',
			origin: [0, 0, 0],
			rotation: [0],
			children: loose_cubes
		})
	}

	groups.forEach(function(g) {
		if (g.type !== 'group') return;
		//Bone
		var bone = {}
		bone.name = g.name
		if (g.parent.type === 'group') {
			bone.parent = g.parent.name
		}
		bone.pivot = g.origin.slice()
		bone.pivot[0] *= -1
		if (!g.rotation.allEqual(0)) {
			bone.rotation = g.rotation.slice()
			bone.rotation.forEach(function(br, ri) {
				bone.rotation[ri] *= -1
			})
		}
		if (g.reset) {
			bone.reset = true
		}
		if (g.mirror_uv) {
			bone.mirror = true
		}
		if (g.material) {
			bone.material = g.material
		}
		//Cubes
		if (g.children && g.children.length) {
			bone.cubes = []
			var i = 0;
			while (i < g.children.length) {
				var s = g.children[i]
				if (s !== undefined && s.type === 'cube' && s.export !== false) {
					var cube = new oneLiner()
					cube.origin = s.from.slice()
					cube.size = s.size()
					cube.origin[0] = -(cube.origin[0] + cube.size[0])
					cube.uv = s.uv_offset
					if (s.inflate && typeof s.inflate === 'number') {
						cube.inflate = s.inflate
					}
					if (s.mirror_uv === !bone.mirror) {
						cube.mirror = s.mirror_uv
					}
					//Visible Bounds
					var mesh = s.mesh
					if (mesh) {
						visible_box.expandByObject(mesh)
					}
					bone.cubes.push(cube)
					cube_count++;
				}
				i++;
			}
		}
		bones.push(bone)
	})

	if (bones.length && options.visible_box !== false) {
		var offset = new THREE.Vector3(8,8,8)
		visible_box.max.add(offset)
		visible_box.min.add(offset)
		//Width
		var radius = Math.max(
			visible_box.max.x,
			visible_box.max.z,
			-visible_box.min.x,
			-visible_box.min.z
		) * 0.9
		if (Math.abs(radius) === Infinity) {
			radius = 0
		}
		entitymodel.visible_bounds_width = Math.ceil((radius*2) / 16)
		//Height
		entitymodel.visible_bounds_height = Math.ceil(((visible_box.max.y - visible_box.min.y) * 0.9) / 16)
		if (Math.abs(entitymodel.visible_bounds_height) === Infinity) {
			entitymodel.visible_bounds_height = 0;
		}
		entitymodel.visible_bounds_offset = [0, entitymodel.visible_bounds_height/2 , 0]
	}
	if (bones.length) {
		entitymodel.bones = bones
	}

	if (options.raw) {
		return entitymodel
	} else {
		var model_name = 'geometry.' + (Project.parent||'unknown')
		return autoStringify({[model_name]: entitymodel})
	}
}
function buildJPMModel(options) {
	if (options === undefined) options = {}
	var jpm = {}
	if (textures[0]) {
		jpm.texture = pathToName(textures[0].name, false)
	}
	jpm.textureSize = [Project.texture_width, Project.texture_height]

	if (settings.credit.value) {
		jpm.credit = settings.credit.value
	}

	var submodels = []
	var boxes = []

	elements.forEach(function(s) {
		if (s.export === false) return;
		var box = {}
		box.coordinates = [s.from[0], s.from[1], s.from[2], s.size(0), s.size(1), s.size(2)]
		for (var face in s.faces) {
			if (s.faces.hasOwnProperty(face)) {
				if (s.faces[face].texture !== undefined && s.faces[face].texture !== null) {
					box['uv'+capitalizeFirstLetter(face)] = [
						s.faces[face].uv[0] / 16 * Project.texture_width,
						s.faces[face].uv[1] / 16 * Project.texture_height,
						s.faces[face].uv[2] / 16 * Project.texture_width,
						s.faces[face].uv[3] / 16 * Project.texture_height
					]
				}
			}
		}
		if (!s.rotation.equals([0, 0, 0])) {
			var submodel = {
				boxes: [box],
				id: s.name,
				rotate:  s.rotation
			}
			submodels.push(submodel)
		} else {
			boxes.push(box)
		}
	})
	if (boxes.length) {
		jpm.boxes = boxes
	}
	if (submodels.length) {
		jpm.submodels = submodels
	}


	if (options.raw) {
		return jpm
	} else {
		return autoStringify(jpm)
	}
}
function buildJEMModel(options) {
	if (options === undefined) options = {}
	var entitymodel = {}
	if (textures[0]) {
		entitymodel.texture = textures[0].name
	}
	entitymodel.textureSize = [parseInt(Project.texture_width), parseInt(Project.texture_height)];
	entitymodel.models = []

	TreeElements.forEach(function(g) {
		//Bone
		var bone = {
			part: g.name,
			invertAxis: 'xy',
			translate: g.origin.slice()
		}
		bone.translate[1] *= -1
		bone.translate[2] *= -1

		if (!g.rotation.allEqual(0)) {
			bone.rotate = g.rotation.slice()
		}
		if (g.mirror_uv) {
			bone.mirrorTexture = 'u'
		}

		function populate(p_model, group) {

			if (group.children.length === 0) return;
			var mirror_sub;

			group.children.forEach(obj => {
				if (!obj.export) return;
				if (obj.type === 'cube') {

					var box = new oneLiner()
					var c_size = obj.size()
					box.coordinates = [
						obj.from[0],
						obj.from[1],
						obj.from[2],
						c_size[0],
						c_size[1],
						c_size[2]
					]
					if (p_model && p_model.part === undefined) {
						box.coordinates[0] -= p_model.translate[0];
						box.coordinates[1] -= p_model.translate[1];
						box.coordinates[2] -= p_model.translate[2];
					}
					box.textureOffset = obj.uv_offset
					if (obj.inflate && typeof obj.inflate === 'number') {
						box.sizeAdd = obj.inflate
					}

					if (obj.mirror_uv !== group.mirror_uv) {
						if (!mirror_sub) {
							mirror_sub = { 
								invertAxis: 'xy',
								mirrorTexture: 'u',//xxx
								boxes: []
							}
							if (!p_model.submodels) p_model.submodels = [];
							p_model.submodels.splice(0, 0, mirror_sub)
						}
						mirror_sub.boxes.push(box)
					} else {
						if (!p_model.boxes) p_model.boxes = []
						p_model.boxes.push(box)
					}
				} else if (obj.type === 'group') {

					var bone = {
						invertAxis: 'xy',
						translate: obj.origin.slice()
					}
					if (obj.mirror_uv) {
						bone.mirrorTexture = 'u'
					}
					if (!obj.rotation.allEqual(0)) {
						bone.rotate = obj.rotation.slice()
						bone.rotate[2] *= -1
					}
					populate(bone, obj)

					if (!p_model.submodels) p_model.submodels = [];
					p_model.submodels.push(bone)
				} 
			})
		}
		populate(bone, g)
		entitymodel.models.push(bone)
	})

	if (options.raw) {
		return entitymodel
	} else {
		return autoStringify(entitymodel)
	}
}
function buildClassModel(options) {
	function F(num) {
		var s = trimFloatNumber(num) + ''
		if (!s.includes('.')) {
			s += '.0'
		}
		return s+'F';
	}

	var bone_nr = 1
	var model_id = Project.parent.replace(/^geometry\./, '') || 'unknown';
	var all_groups = getAllOutlinerGroups()
	var renderers = {}

	var loose_cubes = []
	TreeElements.forEach(obj => {
		if (obj.type === 'cube') {
			loose_cubes.push(obj)
		}
	})
	if (loose_cubes.length) {
		var group = {
			name: 'bb_main',
			rotation: [0, 0, 0],
			origin: [0, 0, 0],
			parent: 'root',
			children: loose_cubes
		}
		all_groups.splice(0, 0, group)
	}

	all_groups.forEach((g) => {
		//model += `\nthis.bone${bone_nr} = new ModelRenderer`
		var id = g.name
		bone_nr++;
		if (g.export === false) return;

		var bone = {
			id: id,
			rootBone: g.parent.type !== 'group',
			lines: [
				`${id} = new ModelRenderer(this);`,//Texture Offset
			]
		}
		var origin = [-g.origin[0], -g.origin[1], g.origin[2]]
		//Rotation
		if (!g.rotation.allEqual(0)) {
			bone.lines.push(
				`setRotationAngle(${id}, ${
					F(Math.degToRad(-g.rotation[0])) }, ${
					F(Math.degToRad(-g.rotation[1])) }, ${
					F(Math.degToRad(-g.rotation[2])) });`
			)
		}
		//Parent
		if (!bone.rootBone && all_groups.indexOf(g.parent) >= 0) {
			bone.lines.push(
				`${ g.parent.name }.addChild(${id});`
			)
			origin[0] += g.parent.origin[0]
			origin[1] += g.parent.origin[1]
			origin[2] -= g.parent.origin[2]
		} else {
			origin[1] += 24
		}
		//origin
		bone.lines.splice(1, 0, 
			`${id}.setRotationPoint(${F(origin[0])}, ${F(origin[1])}, ${F(origin[2])});`
		)

		//Boxes
		g.children.forEach((obj) => {
			if (obj.export === false || obj.type !== 'cube') return;
			var values = [
				''+id,
				Math.floor(obj.uv_offset[0]),
				Math.floor(obj.uv_offset[1]),
				F(g.origin[0] - obj.to[0]),
				F(-obj.from[1] - obj.size(1, true) + g.origin[1]),
				F(obj.from[2] - g.origin[2]),
				obj.size(0, true),
				obj.size(1, true),
				obj.size(2, true),
				F(obj.inflate),
				obj.mirror_uv
			]
			bone.lines.push(
				`${id}.cubeList.add(new ModelBox(${ values.join(', ') }));`
			)
		})

		renderers[id] = bone;

	})


	var model = (settings.credit.value
			? '//'+settings.credit.value+'\n'
			: '')+
		'//Paste this code into your mod.\n' +
		'\nimport org.lwjgl.opengl.GL11;'+
		'\nimport net.minecraft.client.model.ModelBase;'+
		'\nimport net.minecraft.client.model.ModelBox;'+
		'\nimport net.minecraft.client.model.ModelRenderer;'+
		'\nimport net.minecraft.client.renderer.GlStateManager;'+
		'\nimport net.minecraft.entity.Entity;\n'+
		'\npublic class '+model_id+' extends ModelBase {'

	for (var r_id in renderers) {
		model += `\n	private final ModelRenderer ${r_id};`;
	}

	model += '\n'+
		 '\n	public '+model_id+'() {'+
		 '\n		textureWidth = '+	(Project.texture_width || 32)	+';'+
		 '\n		textureHeight = '+	(Project.texture_height|| 32)	+';\n';

	for (var r_id in renderers) {
		model += `\n		${renderers[r_id].lines.join('\n		')}\n`;
	}

	model +=
		 '	}\n'+
		 '\n	@Override'+
		 '\n	public void render(Entity entity, float f, float f1, float f2, float f3, float f4, float f5) {'
	
	for (var r_id in renderers) {
		if (renderers[r_id].rootBone) {
			model += `\n		${r_id}.render(f5);`;
		}
	}
	model +=
		 '\n	}'+
		 '\n	public void setRotationAngle(ModelRenderer modelRenderer, float x, float y, float z) {'+
		 '\n		modelRenderer.rotateAngleX = x;'+
		 '\n		modelRenderer.rotateAngleY = y;'+
		 '\n		modelRenderer.rotateAngleZ = z;'+
		 '\n	}'+
		 '\n}';
	 return model;
}
function buildOBJModel(name) {
	scene.position.set(0,0,0)
	var exporter = new THREE.OBJExporter();
	var content = exporter.parse( scene, name);
	scene.position.set(-8,-8,-8)
	return content;
}
function compileJSON(object, options) {
	var output = ''
	if (typeof options !== 'object') options = {}
	function newLine(tabs) {
		if (options.small === true) {return '';}
		var s = '\n'
		for (var i = 0; i < tabs; i++) {
			s += '\t'
		}
		return s;
	}
	function handleVar(o, tabs) {
		var out = ''
		if (typeof o === 'string') {
			//String
			out += '"' + o.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
		} else if (typeof o === 'boolean') {
			//Boolean
			out += (o ? 'true' : 'false')
		} else if (typeof o === 'number') {
			//Number
			o = (Math.round(o*100000)/100000).toString()
			out += o
		} else if (o === null || o === Infinity || o === -Infinity) {
			//Null
			out += 'null'
		} else if (typeof o === 'object' && o.constructor.name === 'Array') {
			//Array
			var has_content = false
			out += '['
			for (var i = 0; i < o.length; i++) {
				var compiled = handleVar(o[i], tabs+1)
				if (compiled) {
					var breaks = typeof o[i] === 'object'
					if (has_content) {out += ',' + (breaks || options.small?'':' ')}
					if (breaks) {out += newLine(tabs)}
					out += compiled
					has_content = true
				}
			}
			if (typeof o[o.length-1] === 'object') {out += newLine(tabs-1)}
			out += ']'
		} else if (typeof o === 'object') {
			//Object
			var breaks = o.constructor.name !== 'oneLiner';
			var has_content = false
			out += '{'
			for (var key in o) {
				if (o.hasOwnProperty(key)) {
					var compiled = handleVar(o[key], tabs+1)
					if (compiled) {
						if (has_content) {out += ',' + (breaks || options.small?'':' ')}
						if (breaks) {out += newLine(tabs)}
						out += '"' + key + '":' + (options.small === true ? '' : ' ')
						out += compiled
						has_content = true
					}
				}
			}
			if (breaks && has_content) {out += newLine(tabs-1)}
			out += '}'
		}
		return out;
	}
	return handleVar(object, 1)
}
function autoParseJSON(data, feedback) {
	if (data.charCodeAt(0) === 0xFEFF) {
		data = data.substr(1)
	}
	try {
		data = JSON.parse(data)
	} catch (err1) {
		data = data.replace(/\/\*[^(\*\/)]*\*\/|\/\/.*/g, '')
		try {
			data = JSON.parse(data)
		} catch (err) {
			if (feedback === false) return;
			function logErrantPart(whole, start, length) {
				var line = whole.substr(0, start).match(/\n/gm)
				line = line ? line.length+1 : 1
				var result = '';
				var lines = whole.substr(start, length).split(/\n/gm)
				lines.forEach((s, i) => {
					result += `#${line+i} ${s}\n`
				})
				console.log(result.substr(0, result.length-1) + ' <-- HERE')
			}
			console.error(err)
			var length = err.toString().split('at position ')[1]
			if (length) {
				length = parseInt(length)
				var start = limitNumber(length-20, 0, Infinity)

				logErrantPart(data, start, 1+length-start)
			} else if (err.toString().includes('Unexpected end of JSON input')) {

				logErrantPart(data, data.length-10, 10)
			}
			Blockbench.showMessageBox({
				translateKey: 'invalid_file',
				icon: 'error',
				message: tl('message.invalid_file.message', [err])
			})
			return;
		}
	}
	return data;
}

BARS.defineActions(function() {
	//New
	new Action({
		id: 'new_block_model',
		icon: 'insert_drive_file',
		category: 'file',
		keybind: new Keybind({key: 78, ctrl: true}),
		click: function () {newProject()}
	})
	new Action({
		id: 'new_entity_model',
		icon: 'pets',
		category: 'file',
		keybind: new Keybind({key: 78, ctrl: true, shift: true}),
		click: function () {
			if (newProject(true)) {
				showDialog('project_settings');
			}
		}
	})
	//Import
	new Action({
		id: 'open_model',
		icon: 'assessment',
		category: 'file',
		keybind: new Keybind({key: 79, ctrl: true}),
		click: function () {
			Blockbench.import({
				extensions: ['json', 'jem', 'jpm', 'bbmodel'],
				type: 'JSON Model'
			}, function(files) {
				if (isApp) {
					addRecentProject({name: pathToName(files[0].path, 'mobs_id'), path: files[0].path})
				}
				loadModel(files[0].content, files[0].path)
			})
		}
	})
	new Action({
		id: 'add_model',
		icon: 'assessment',
		category: 'file',
		click: function () {
			Blockbench.import({
				extensions: ['json', 'jem', 'jpm'],
				type: 'JSON Model'
			}, function(files) {
				if (isApp) {
					addRecentProject({name: pathToName(files[0].path, 'mobs_id'), path: files[0].path})
				}
				loadModel(files[0].content, files[0].path, true)
			})
		}
	})
	new Action({
		id: 'extrude_texture',
		icon: 'eject',
		category: 'file',
		click: function () {
			Blockbench.import({
				extensions: ['png'],
				type: 'PNG Texture',
				readtype: 'image'
			}, function(files) {
				if (files.length) {
					if (isApp) {
						new Texture().fromPath(files[0].path).add(false).fillParticle()
					} else {
						new Texture().fromDataURL(files[0].content).add(false).fillParticle()
					}
					showDialog('image_extruder')
					Extruder.drawImage(isApp ? files[0].path : files[0].content)
				}
			})
		}
	})
	//Export
	new Action({
		id: 'export_blockmodel',
		icon: 'insert_drive_file',
		category: 'file',
		keybind: new Keybind({key: 83, ctrl: true, shift: true}),
		condition: function() {return !Blockbench.entity_mode},
		click: function () {
			Blockbench.export({
				type: 'JSON Model',
				extensions: ['json'],
				name: Project.name||'model',
				startpath: Prop.file_path,
				project_file: true,
				content: buildBlockModel()
			})
		}
	})
	new Action({
		id: 'export_bbmodel',
		icon: 'insert_drive_file',
		category: 'file',
		click: function () {
			Blockbench.export({
				type: 'Blockbench Save',
				extensions: ['bbmodel'],
				name: Project.name||'model',
				startpath: Prop.file_path,
				project_file: true,
				content: buildBBModel()
			})
		}
	})
	new Action({
		id: 'export_entity',
		icon: 'pets',
		category: 'file',
		keybind: new Keybind({key: 83, ctrl: true, shift: true}),
		condition: function() {return Blockbench.entity_mode},
		click: function () {
			Blockbench.export({
				type: 'JSON Entity Model',
				extensions: ['json'],
				name: Project.name,
				startpath: Prop.file_path,
				content: buildEntityModel({raw: isApp}),
				project_file: true,
				custom_writer: isApp ? writeFileEntity : undefined
			})
		}
	})
	new Action({
		id: 'export_class_entity',
		icon: 'free_breakfast',
		category: 'file',
		condition: function() {return Blockbench.entity_mode},
		click: function () {
			var content = buildClassModel();
			Blockbench.export({
				type: 'Java Class',
				extensions: ['java'],
				name: Project.name,
				startpath: Prop.file_path,
				content: content
			})
		}
	})
	new Action({
		id: 'export_optifine_part',
		icon: 'icon-optifine_file',
		category: 'file',
		condition: function() {return !Blockbench.entity_mode},
		click: function () {
			var content = buildJPMModel()
			Blockbench.export({
				type: 'Optifine Part Model',
				extensions: ['jpm'],
				name: Project.name,
				startpath: Prop.file_path,
				content: content
			})
		}
	})
	new Action({
		id: 'export_optifine_full',
		icon: 'icon-optifine_file',
		category: 'file',
		condition: function() {return Blockbench.entity_mode},
		click: function () {
			var content = buildJEMModel()
			Blockbench.export({
				type: 'Optifine Entity Model',
				extensions: ['jem'],
				startpath: Prop.file_path,
				content: content
			})
		}
	})
	new Action({
		id: 'export_obj',
		icon: 'icon-objects',
		category: 'file',
		click: function () {
			Blockbench.export({
				type: 'Alias Wavefront',
				extensions: ['obj'],
				startpath: Prop.file_path,
				custom_writer: writeFileObj
			})
		}
	})
	new Action({
		id: 'save',
		icon: 'save',
		category: 'file',
		keybind: new Keybind({key: 83, ctrl: true}),
		click: function () {saveFile();saveTextures();}
	})
	new Action({
		id: 'export_asset_archive',
		icon: 'archive',
		category: 'file',
		click: function() {
			var archive = new JSZip();
			if (Blockbench.entity_mode === false) {
				var content = buildBlockModel()
			} else {
				var content = buildEntityModel()
			}
			archive.file((Project.name||'model')+'.json', content)
			var texfolder = archive.folder('textures');
			textures.forEach(tex => {
				if (tex.mode === 'bitmap') {
					texfolder.file(pathToName(tex.name) + '.png', tex.source.replace('data:image/png;base64,', ''), {base64: true});
				}
			})
			archive.generateAsync({type: 'blob'}).then(content => {
				Blockbench.export({
					type: 'Zip Archive',
					extensions: ['zip'],
					name: 'assets',
					startpath: Prop.file_path,
					content: content,
					savetype: 'zip',
					project_file: true
				})
			})
		}
	})
})
