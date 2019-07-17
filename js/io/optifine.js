(function() {

var codec = new Codec('optifine_entity', {
	name: 'OptiFine JEM',
	extension: 'jem',
	remember: true,
	compile(options) {
		if (options === undefined) options = {}
		var entitymodel = {}
		var geo_code = 'geometry.'+Project.geometry_name
		if (textures[0]) {
			entitymodel.texture = textures[0].name
		}
		entitymodel.textureSize = [Project.texture_width, Project.texture_height];
		entitymodel.models = []

		Outliner.root.forEach(function(g) {
			//Bone
			var bone = {
				part: g.name,
				id: g.name,
				invertAxis: 'xy',
				translate: g.origin.slice()
			}
			bone.translate[1] *= -1
			bone.translate[2] *= -1

			if (!g.rotation.allEqual(0)) {
				bone.rotate = g.rotation.slice()
			}
			if (entityMode.hardcodes[geo_code]) {
				var codes = entityMode.hardcodes[geo_code]
				var bone_codes = codes[bone.part] || codes[bone.part+'1']
				if (bone_codes) {
					if (!bone.rotate) bone.rotate = [0, 0, 0];
					entityMode.hardcodes[geo_code][bone.part].rotation.forEach((dft, i) => {
						bone.rotate[i] += dft;
					})
				}
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

						if (Project.box_uv) {
							var box = new oneLiner()
						} else {
							var box = {};
						}
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
						if (Project.box_uv) {
							box.textureOffset = obj.uv_offset
						} else {
							for (var face in obj.faces) {
								var uv = obj.faces[face].uv;
								box[`uv${capitalizeFirstLetter(face)}`] = uv;
							}
						}

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
							id: obj.name,
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
	},
	parse(model, path) {
		if (model.textureSize) {
			Project.texture_width = parseInt(model.textureSize[0])
			Project.texture_height = parseInt(model.textureSize[1])
		}
		function convertUVCoords(uv) {
			if (uv instanceof Array) {
				uv.forEach((n, i) => {
					uv[i] *= 16 / (i%2 ? Project.texture_height : Project.texture_width);
				})
			}
			return uv;
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
							if (!box.textureOffset && box.uvNorth) {
								Project.box_uv = false;
								base_cube.extend({faces: {
									north: {uv: convertUVCoords(box.uvNorth)},
									east: {uv: convertUVCoords(box.uvEast)},
									south: {uv: convertUVCoords(box.uvSouth)},
									west: {uv: convertUVCoords(box.uvWest)},
									up: {uv: convertUVCoords(box.uvUp)},
									down: {uv: convertUVCoords(box.uvDown)},
								}})
							}
							if (p_group.parent !== 'root') {
								for (var i = 0; i < 3; i++) {
									base_cube.from[i] += p_group.origin[i];
									base_cube.to[i] += p_group.origin[i];
								}
							}
							base_cube.addTo(p_group).init()
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
							group.addTo(p_group).init()
							readContent(subsub, group)
						})
					}

				}
				group.init().addTo()
				readContent(b, group)
			})
		}
		loadOutlinerDraggable()
		Canvas.updateAll()
		if (model.texture) {
			var path = path.replace(/\\[\w .-]+$/, '\\'+model.texture)
			new Texture().fromPath(path).add(false)
		}
	}
})

var part_codec = new Codec('optifine_part', {
	name: 'OptiFine Part',
	extension: 'jpm',
	parse(model, path) {
		Project.box_uv = false;
		var new_cubes = [];
		var import_group = new Group({
			name: pathToName(path)
		}).init();
		Undo.initEdit({elements: new_cubes, outliner: true})

		var resolution = model.textureSize
		function convertUVCoords(uv) {
			if (uv instanceof Array && resolution instanceof Array) {
				uv.forEach((n, i) => {
					uv[i] *= 16 / resolution[i%2];
				})
			}
			return uv;
		}
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
								north: {uv: convertUVCoords(box.uvNorth)},
								east: {uv: convertUVCoords(box.uvEast)},
								south: {uv: convertUVCoords(box.uvSouth)},
								west: {uv: convertUVCoords(box.uvWest)},
								up: {uv: convertUVCoords(box.uvUp)},
								down: {uv: convertUVCoords(box.uvDown)},
							},
							rotation: submodel.rotate
						}).init().addTo(import_group)
						new_cubes.push(base_cube);
					}
				})
			}
			if (submodel.submodels) {
				submodel.submodels.forEach(addSubmodel)
			}
		}
		import_group.addTo()
		Undo.finishEdit('add jpm model')
		addSubmodel(model)
		Canvas.updateAll()
	}
})

var format = new ModelFormat({
	id: 'optifine_entity',
	extension: 'jem',
	icon: 'icon-format_optifine',
	box_uv: true,
	optional_box_uv: true,
	single_texture: true,
	integer_size: true,
	bone_rig: true,
	codec
})
codec.format = format;

BARS.defineActions(function() {
	codec.export_action = new Action({
		id: 'export_optifine_full',
		icon: 'icon-optifine_file',
		category: 'file',
		condition: () => Format == format,
		click: function () {
			codec.export()
		}
	})
	new Action({
		id: 'import_optifine_part',
		icon: 'icon-optifine_file',
		category: 'file',
		condition: () => Format == format,
		click: function () {
			Blockbench.import({
				extensions: ['jpm'],
				type: 'JPM Entity Part Model',
				multiple: true,
			}, function(files) {
				files.forEach(file => {
					var model = autoParseJSON(file.content)
					part_codec.parse(model, file.path)
				})
			})
		}
	})
})

})()
