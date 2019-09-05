(function() {

var part_codec = new Codec('optifine_part', {
	name: 'OptiFine Part',
	extension: 'jpm',
	remember: true,
	compile(options) {
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

		Cube.all.forEach(function(s) {
			if (s.export === false) return;
			var box = {};
			var originalOrigin = s.origin.slice();
			s.transferOrigin([0, 0, 0])
			box.coordinates = [
				-s.to[0], 
				-s.from[1] - s.size(1), 
				s.from[2], 
				s.size(0), 
				s.size(1), 
				s.size(2)
			]
			for (var face in s.faces) {
				if (s.faces.hasOwnProperty(face)) {
					if (s.faces[face].texture !== undefined && s.faces[face].texture !== null) {
						box['uv'+capitalizeFirstLetter(face)] = [
							Math.floor(s.faces[face].uv[0] / 16 * Project.texture_width),
							Math.floor(s.faces[face].uv[1] / 16 * Project.texture_height),
							Math.ceil(s.faces[face].uv[2] / 16 * Project.texture_width),
							Math.ceil(s.faces[face].uv[3] / 16 * Project.texture_height)
						]
					}
				}
			}
			if (!s.rotation.equals([0, 0, 0])) {
				var submodel = {
					id: s.name,
					rotate: [
						-s.rotation[0],
						-s.rotation[1],
						s.rotation[2],
					],
					boxes: [box],
				}
				submodels.push(submodel)
			} else {
				boxes.push(box)
			}
			s.transferOrigin(originalOrigin)
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
	},
	parse(model, path, add) {
		Project.box_uv = false;
		var new_cubes = [];
		var box_uv_changed = false;
		var import_group = add ? new Group({
			name: pathToName(path)
		}).init() : 'root';
		var origin = [0, 0, 0];
		Undo.initEdit({elements: new_cubes, outliner: true, uv_mode: true})

		var resolution = model.textureSize;
		if (resolution.length == 2) {
			Project.texture_width = parseInt(resolution[0])||0;
			Project.texture_height = parseInt(resolution[1])||0;
		}
		if (isApp) {
			var texture_path = path.replace(/\.jpm$/, '.png')
			if (model.texture) {
				var arr = texture_path.split(osfs);
				arr[arr.length-1] = model.texture
				if (model.texture.substr(-4) != '.png') arr[arr.length-1] += '.png';
				texture_path = arr.join(osfs);
			}
			if (fs.existsSync(texture_path)) {
				new Texture().fromPath(texture_path).add(false)
			}
		}
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
						var rotation = submodel.rotate && [
							-submodel.rotate[0],
							-submodel.rotate[1],
							submodel.rotate[2],
						]
						var base_cube = new Cube({
							from: [
								-cs[0]-cs[3],
								-cs[1]-cs[4],
								cs[2]
							],
							size: [
								cs[3],
								cs[4],
								cs[5]
							],
							name: submodel.id,
							rotation,
							origin
						})
						if (box.textureOffset) {
							if (!add && !box_uv_changed) Project.box_uv = true;
							box_uv_changed = true;
							base_cube.extend({
								uv_offset: box.textureOffset
							})
						} else {
							if (!add && !box_uv_changed) Project.box_uv = false;
							box_uv_changed = true;
							base_cube.extend({
								faces: {
									north: {uv: convertUVCoords(box.uvNorth)},
									east: {uv: convertUVCoords(box.uvEast)},
									south: {uv: convertUVCoords(box.uvSouth)},
									west: {uv: convertUVCoords(box.uvWest)},
									up: {uv: convertUVCoords(box.uvUp)},
									down: {uv: convertUVCoords(box.uvDown)},
								}
							})
						}

						if (submodel.translate) {
							base_cube.from[0] -= submodel.translate[0];
							base_cube.from[1] -= submodel.translate[1];
							base_cube.from[2] += submodel.translate[2];
							base_cube.to[0] -= submodel.translate[0];
							base_cube.to[1] -= submodel.translate[1];
							base_cube.to[2] += submodel.translate[2];
							base_cube.origin[0] -= submodel.translate[0];
							base_cube.origin[1] -= submodel.translate[1];
							base_cube.origin[2] += submodel.translate[2];
						}

						base_cube.init().addTo(import_group);
						new_cubes.push(base_cube);
					}
				})
			}
			if (submodel.submodels) {
				submodel.submodels.forEach(addSubmodel)
			}
		}
		if (import_group instanceof Group) {
			import_group.addTo()
		}
		Undo.finishEdit('add jpm model')
		addSubmodel(model)
		Canvas.updateAll()
	}
})


var part_format = new ModelFormat({
		name: 'OptiFine Part',
		id: 'optifine_part',
		extension: 'jpm',
		icon: 'icon-format_optifine',
		//show_on_start_screen: false,
		single_texture: true,
		integer_size: true,
		rotate_cubes: true,
		codec: part_codec
})
part_codec.format = part_format;



BARS.defineActions(function() {
	part_codec.export_action = new Action('export_optifine_part', {
		name: 'Export OptiFine Part',
		description: 'Export a single part for an OptiFine model',
		icon: 'icon-optifine_file',
		category: 'file',
		condition: () => Format == part_format,
		click: function () {
			part_codec.export()
		}
	})
	new Action('import_optifine_part', {
		icon: 'icon-optifine_file',
		category: 'file',
		condition: () => (Format.id == 'optifine_entity' || Format.id == 'optifine_part'),
		click: function () {
			Blockbench.import({
				extensions: ['jpm'],
				type: 'JPM Entity Part Model',
				multiple: true,
			}, function(files) {
				files.forEach(file => {
					var model = autoParseJSON(file.content)
					part_codec.parse(model, file.path, true)
				})
			})
		}
	})
})


})()