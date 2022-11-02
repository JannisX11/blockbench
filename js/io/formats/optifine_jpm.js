(function() {

var part_codec = new Codec('optifine_part', {
	name: 'OptiFine Part',
	extension: 'jpm',
	remember: true,
	load_filter: {
		type: 'json',
		extensions: ['jpm']
	},
	compile(options) {
		if (options === undefined) options = {}
		var jpm = {}
		if (Texture.getDefault()) {
			jpm.texture = pathToName(Texture.getDefault().name, false)
		}
		jpm.textureSize = [Project.texture_width, Project.texture_height]

		if (Project.credit || settings.credit.value) {
			jpm.credit = Project.credit || settings.credit.value
		}

		var submodels = []
		var boxes = []

		Cube.all.forEach(function(s) {
			if (s.export === false) return;
			var box = {};
			var originalOrigin = s.origin.slice();
			s.transferOrigin([0, 0, 0], false)
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
							Math.floor(s.faces[face].uv[0]),
							Math.floor(s.faces[face].uv[1]),
							Math.ceil(s.faces[face].uv[2]),
							Math.ceil(s.faces[face].uv[3])
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
			s.transferOrigin(originalOrigin, false)
		})
		if (boxes.length) {
			jpm.boxes = boxes
		}
		if (submodels.length) {
			jpm.submodels = submodels
		}
		this.dispatchEvent('compile', {model: jpm, options});

		if (options.raw) {
			return jpm
		} else {
			return autoStringify(jpm)
		}
	},
	parse(model, path, add) {
		this.dispatchEvent('parse', {model});

		var new_cubes = [];
		var import_group = add ? new Group({
			name: pathToName(path)
		}).init() : 'root';
		var origin = [0, 0, 0];
		if (add) {
			Undo.initEdit({elements: new_cubes, outliner: true, uv_mode: true})
		}

		if (typeof model.credit == 'string') Project.credit = model.credit;
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
							base_cube.box_uv = true;
							base_cube.extend({
								box_uv: true,
								uv_offset: box.textureOffset
							})
						} else {
							base_cube.box_uv = false;
							base_cube.extend({
								box_uv: false,
								faces: {
									north: {uv: box.uvNorth},
									east: {uv: box.uvEast},
									south: {uv: box.uvSouth},
									west: {uv: box.uvWest},
									up: {uv: box.uvUp},
									down: {uv: box.uvDown},
								}
							})
							if (!box.uvNorth) {
								base_cube.faces.north.uv = [0, 0, 0, 0]
								base_cube.faces.north.texture = null;
							}
							if (!box.uvEast) {
								base_cube.faces.east.uv = [0, 0, 0, 0]
								base_cube.faces.east.texture = null;
							}
							if (!box.uvSouth) {
								base_cube.faces.south.uv = [0, 0, 0, 0]
								base_cube.faces.south.texture = null;
							}
							if (!box.uvWest) {
								base_cube.faces.west.uv = [0, 0, 0, 0]
								base_cube.faces.west.texture = null;
							}
							if (!box.uvUp) {
								base_cube.faces.up.uv = [0, 0, 0, 0]
								base_cube.faces.up.texture = null;
							}
							if (!box.uvDown) {
								base_cube.faces.down.uv = [0, 0, 0, 0]
								base_cube.faces.down.texture = null;
							}
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
		if (add) {
			Undo.finishEdit('Add JPM model')
		} else {
			Project.box_uv = Cube.all.filter(cube => cube.box_uv).length > Cube.all.length/2;
		}
		addSubmodel(model)
		this.dispatchEvent('parsed', {model});
		Canvas.updateAllBones()
		Validator.validate()
	}
})


var part_format = new ModelFormat({
		name: 'OptiFine Part',
		id: 'optifine_part',
		extension: 'jpm',
		icon: 'icon-format_optifine',
		category: 'minecraft',
		show_on_start_screen: false,
		model_identifier: false,
		single_texture: true,
		integer_size: true,
		rotate_cubes: true,
		optional_box_uv: true,
		codec: part_codec
})
Object.defineProperty(part_format, 'integer_size', {get: _ => Project.box_uv})
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
				resource_id: 'model',
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