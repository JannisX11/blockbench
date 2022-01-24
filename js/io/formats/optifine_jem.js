(function() {

var codec = new Codec('optifine_entity', {
	name: 'OptiFine JEM',
	extension: 'jem',
	remember: true,
	load_filter: {
		type: 'json',
		extensions: ['jem'],
		condition(file) {
			return file && file.models != undefined;
		}
	},
	compile(options) {
		if (options === undefined) options = {}
		var entitymodel = {}
		var geo_code = 'geometry.'+Project.geometry_name
		if (Texture.getDefault()) {
			let tex = Texture.getDefault();
			entitymodel.texture = tex.folder ? (tex.folder + '/' + tex.name) : tex.name;
		}
		entitymodel.textureSize = [Project.texture_width, Project.texture_height];
		if (Project.shadow_size != 1) entitymodel.shadowSize = Project.shadow_size;
		entitymodel.models = []

		Outliner.root.forEach(function(g) {
			if (g instanceof Group == false) return;
			if (!settings.export_empty_groups.value && !g.children.find(child => child.export)) return;
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
					bone_codes.rotation.forEach((dft, i) => {
						bone.rotate[i] += dft;
					})
				}
			}
			if (g.mirror_uv) {
				bone.mirrorTexture = 'u'
			}
			if (g.cem_attach) {
				bone.attach = true;
			}

			function populate(p_model, group, depth) {

				if (group.children.length === 0) return;
				var mirror_sub;

				if (group.texture) {
					p_model.texture = group.texture;
				}
				if (group.texture_size && !group.texture_size.allEqual(0)) {
					p_model.textureSize = group.texture_size;
				}

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
								if (obj.faces[face].texture !== null) {
									var uv = obj.faces[face].uv;
									box[`uv${capitalizeFirstLetter(face)}`] = uv;
								}
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
						}
						populate(bone, obj, depth+1)
						if (depth >= 1) {
							bone.translate[0] -= group.origin[0];
							bone.translate[1] -= group.origin[1];
							bone.translate[2] -= group.origin[2];
						}

						if (!p_model.submodels) p_model.submodels = [];
						p_model.submodels.push(bone)
					} 
				})
			}
			populate(bone, g, 0)

			if (g.cem_animations && g.cem_animations.length) {
				bone.animations = g.cem_animations;
			}

			entitymodel.models.push(bone)
		})

		this.dispatchEvent('compile', {entitymodel, options});

		if (options.raw) {
			return entitymodel
		} else {
			return autoStringify(entitymodel)
		}
	},
	parse(model, path) {
		this.dispatchEvent('parse', {model});
		if (model.textureSize) {
			Project.texture_width = parseInt(model.textureSize[0])||16;
			Project.texture_height = parseInt(model.textureSize[1])||16;
		}
		if (typeof model.shadowSize == 'number') Project.shadow_size = model.shadowSize;
		let empty_face = {uv: [0, 0, 0, 0], texture: null}
		if (model.models) {
			model.models.forEach(function(b) {
				if (typeof b !== 'object') return;
				var subcount = 0;

				//Bone
				var group = new Group({
					name: b.part,
					origin: b.translate,
					rotation: b.rotate,
					mirror_uv: (b.mirrorTexture && b.mirrorTexture.includes('u')),
					cem_animations: b.animations,
					cem_attach: b.attach,
					texture: b.texture,
					texture_size: b.textureSize,
				})
				group.origin[1] *= -1;
				group.origin[2] *= -1;

				function readContent(submodel, p_group, depth) {

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
							if (!box.textureOffset && (
									box.uvNorth
								 || box.uvEast
								 || box.uvSouth
								 || box.uvWest
								 || box.uvUp
								 || box.uvDown
							)) {
								Project.box_uv = false;
								base_cube.extend({faces: {
									north: box.uvNorth ? {uv: box.uvNorth} : empty_face,
									east:  box.uvEast  ? {uv: box.uvEast}  : empty_face,
									south: box.uvSouth ? {uv: box.uvSouth} : empty_face,
									west:  box.uvWest  ? {uv: box.uvWest}  : empty_face,
									up:    box.uvUp    ? {uv: box.uvUp}    : empty_face,
									down:  box.uvDown  ? {uv: box.uvDown}  : empty_face,
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
							if (depth >= 1 && subsub.translate) {
								subsub.translate[0] += p_group.origin[0];
								subsub.translate[1] += p_group.origin[1];
								subsub.translate[2] += p_group.origin[2];
							}
							var group = new Group({
								name: subsub.id || `${b.part}_sub_${subcount}`,
								origin: subsub.translate || (depth >= 1 ? submodel.translate : undefined),
								rotation: subsub.rotate,
								mirror_uv: (subsub.mirrorTexture && subsub.mirrorTexture.includes('u')),
								texture: subsub.texture,
								texture_size: subsub.textureSize,
							})
							subcount++;
							group.addTo(p_group).init()
							readContent(subsub, group, depth+1)
						})
					}

				}
				group.init().addTo()
				readContent(b, group, 0)
			})
		}
		if (typeof model.texture == 'string') {
			let texture_path = model.texture.replace(/[\\/]/g, osfs);
			if (texture_path.match(/^textures/)) {
				texture_path = path.replace(/[\\/]optifine[\\/][\\\w .-]+$/i, '\\'+texture_path);
			} else {
				texture_path = path.replace(/\\[\w .-]+$/, '\\'+texture_path);
			}
			new Texture().fromPath(texture_path).add(false);
		}
		this.dispatchEvent('parsed', {model});
		Canvas.updateAllBones();
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
	centered_grid: true,
	texture_folder: true,
	codec
})
Object.defineProperty(format, 'integer_size', {get: _ => Project.box_uv})
codec.format = format;


BARS.defineActions(function() {
	codec.export_action = new Action('export_optifine_full', {
		icon: 'icon-optifine_file',
		category: 'file',
		condition: () => Format == format,
		click: function () {
			codec.export()
		}
	})
})

})()
