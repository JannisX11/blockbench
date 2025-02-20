(function() {

var codec = new Codec('optifine_entity', {
	name: 'OptiFine JEM',
	extension: 'jem',
	remember: true,
	support_partial_export: true,
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
		if (Project.credit || settings.credit.value) {
			entitymodel.credit = Project.credit || settings.credit.value
		}
		var geo_code = 'geometry.'+Project.geometry_name
		function getTexturePath(tex) {
			return tex.folder ? (tex.folder + '/' + tex.name) : tex.name;
		}
		function isAppliedInModel(texture) {
			return Group.all.find(group => {
				return group.export && group.texture == texture.uuid;
			})
		}
		entitymodel.textureSize = [Project.texture_width, Project.texture_height];
		let default_texture = Texture.getDefault();
		if (default_texture && (default_texture.use_as_default || (settings.optifine_save_default_texture.value && !isAppliedInModel(default_texture)))) {
			let texture = Texture.getDefault();
			entitymodel.texture = getTexturePath(Texture.getDefault());
			entitymodel.textureSize = [texture.uv_width, texture.uv_height];
		} else {
			default_texture = null;
		}
		if (Project.shadow_size != 1) entitymodel.shadowSize = Project.shadow_size;
		entitymodel.models = []

		function compilePart(g) {
			if (!settings.export_empty_groups.value && !g.children.find(child => child.export)) return;
			//Bone
			var bone = {
				part: g.name,
				id: g.name,
				invertAxis: 'xy',
				mirrorTexture: undefined,
				translate: g.origin.slice()
			}
			bone.translate.V3_multiply(-1);

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
			if (g.cem_scale) {
				bone.scale = g.cem_scale;
			}

			function populate(p_model, group, depth, parent_texture) {

				if (group.children.length === 0) return;
				let mirror_sub;

				let child_cubes = group.children.filter(obj => obj.export && obj.type === 'cube')
				let has_different_mirrored_children = !!child_cubes.find(obj => obj.mirror_uv !== child_cubes[0].mirror_uv);
				let texture = parent_texture;
				if (group.texture) {
					let match = Texture.all.find(t => t.uuid == group.texture);
					if (match) texture = match;
				}

				if (texture && texture != parent_texture) {
					p_model.texture = getTexturePath(texture);
					if (!parent_texture || texture.uv_width != parent_texture.uv_width || texture.uv_height != parent_texture.uv_height) {
						p_model.textureSize = [texture.uv_width, texture.uv_height];
					}
				}

				group.children.forEach(obj => {
					if (!obj.export) return;
					if (obj.type === 'cube') {

						if (obj.box_uv) {
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
						if (obj.box_uv) {
							box.textureOffset = obj.uv_offset
						} else {
							for (let face in obj.faces) {
								if (obj.faces[face].texture !== null) {
									let uv = obj.faces[face].uv;
									box[`uv${capitalizeFirstLetter(face)}`] = uv;
								}
							}
						}

						if (obj.inflate && typeof obj.inflate === 'number') {
							box.sizeAdd = obj.inflate
						}

						if (obj.mirror_uv !== group.mirror_uv && has_different_mirrored_children) {
							if (!mirror_sub) {
								mirror_sub = { 
									invertAxis: 'xy',
									mirrorTexture: 'u',
									boxes: []
								}
								if (!p_model.submodels) p_model.submodels = [];
								p_model.submodels.splice(0, 0, mirror_sub)
							}
							mirror_sub.boxes.push(box);
						} else {
							if (!p_model.boxes) p_model.boxes = [];
							if (obj.mirror_uv !== group.mirror_uv) {
								p_model.mirrorTexture = obj.mirror_uv ? 'u' : undefined;
							}
							p_model.boxes.push(box)
						}
					} else if (obj.type === 'group') {

						var bone = {
							id: obj.name,
							invertAxis: 'xy',
							mirrorTexture: undefined,
							translate: obj.origin.slice()
						}
						if (obj.mirror_uv) {
							bone.mirrorTexture = 'u';
						}
						if (!obj.rotation.allEqual(0)) {
							bone.rotate = obj.rotation.slice()
						}
						populate(bone, obj, depth+1, texture)
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
			populate(bone, g, 0, default_texture)

			if (g.cem_animations && g.cem_animations.length) {
				bone.animations = g.cem_animations;
			}

			entitymodel.models.push(bone)
		}

		if (options.build_part) {
			compilePart({
				name: Project.name,
				origin: [0, 0, 0],
				rotation: [0, 0, 0],
				children: Outliner.root.filter(g => g.export)
			});
		} else {
			for (let group of Outliner.root) {
				if (group instanceof Group && group.export) {
					compilePart(group);
				}
			}
		}

		this.dispatchEvent('compile', {entitymodel, options});

		if (options.raw) {
			return entitymodel
		} else {
			return autoStringify(entitymodel)
		}
	},
	parse(model, path) {
		this.dispatchEvent('parse', {model});

		const imported_textures =  {};
		function importTexture(string, uv) {
			if (typeof string !== 'string') return;
			if (imported_textures[string]) return imported_textures[string];

			let texture_path = string.replace(/[\\/]/g, osfs);
			if (texture_path.match(/^textures/) && path.includes('optifine')) {
				texture_path = path.replace(/[\\/]optifine[\\/].+$/i, osfs+texture_path);
			} else {
				texture_path = path.replace(/[\\/][^\\/]+$/, osfs+texture_path);
			}
			if (!texture_path.match(/\.\w{3,4}$/)) texture_path = texture_path + '.png';
			let texture = new Texture().fromPath(texture_path).add(false);
			imported_textures[string] = texture;
			if (uv instanceof Array) {
				texture.extend({
					uv_width: uv[0],
					uv_height: uv[1]
				})
			}
			return texture;
		}

		if (typeof model.credit == 'string') Project.credit = model.credit;
		if (model.textureSize) {
			Project.texture_width = parseInt(model.textureSize[0])||16;
			Project.texture_height = parseInt(model.textureSize[1])||16;
		}
		let main_texture = importTexture(model.texture, model.textureSize);
		if (main_texture) {
			main_texture.use_as_default = true;
		}
		if (typeof model.shadowSize == 'number') Project.shadow_size = model.shadowSize;
		let empty_face = {uv: [0, 0, 0, 0], texture: null}
		if (model.models) {
			model.models.forEach(function(b) {
				if (typeof b !== 'object') return;
				let subcount = 0;

				//Bone
				let texture = importTexture(b.texture, b.textureSize);
				let group = 0;
				if (!model._is_jpm) {
					group = new Group({
						name: b.part,
						origin: b.translate,
						rotation: b.rotate,
						mirror_uv: (b.mirrorTexture && b.mirrorTexture.includes('u')),
						cem_animations: b.animations,
						cem_attach: b.attach,
						cem_scale: b.scale,
						texture: texture ? texture.uuid : undefined,
					})
					group.origin.V3_multiply(-1);
					group.init().addTo();
				}

				function readContent(submodel, p_group, depth, texture) {

					if (submodel.boxes && submodel.boxes.length) {
						submodel.boxes.forEach(box => {

							var base_cube = new Cube({
								name: box.name || p_group.name,
								autouv: 0,
								uv_offset: box.textureOffset,
								box_uv: !!box.textureOffset,
								inflate: box.sizeAdd,
								mirror_uv: p_group.mirror_uv
							})
							/*if (texture) {
								for (let fkey in base_cube.faces) {
									base_cube.faces[fkey].texture = texture.uuid;
								}
							}*/
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
								base_cube.extend({
									box_uv: false,
									faces: {
										north: box.uvNorth ? {uv: box.uvNorth} : empty_face,
										east:  box.uvEast  ? {uv: box.uvEast}  : empty_face,
										south: box.uvSouth ? {uv: box.uvSouth} : empty_face,
										west:  box.uvWest  ? {uv: box.uvWest}  : empty_face,
										up:    box.uvUp    ? {uv: box.uvUp}    : empty_face,
										down:  box.uvDown  ? {uv: box.uvDown}  : empty_face,
									}
								})
							}
							if (p_group && (p_group.parent !== 'root' || model._is_jpm)) {
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
							let sub_texture = importTexture(subsub.texture, subsub.textureSize);
							let group = new Group({
								name: subsub.id || subsub.comment || `${b.part??'part'}_sub_${subcount}`,
								origin: subsub.translate || (depth >= 1 ? submodel.translate : undefined),
								rotation: subsub.rotate,
								mirror_uv: (subsub.mirrorTexture && subsub.mirrorTexture.includes('u')),
								texture: (sub_texture || texture)?.uuid,
							})
							subcount++;
							group.addTo(p_group).init()
							readContent(subsub, group, depth+1, sub_texture || texture)
						})
					}

				}
				readContent(b, group, 0, texture || main_texture)
			})
		}
		Project.box_uv = Cube.all.filter(cube => cube.box_uv).length > Cube.all.length/2;
		this.dispatchEvent('parsed', {model});
		Canvas.updateAllBones();
		Validator.validate()
	}
})


var format = new ModelFormat({
	id: 'optifine_entity',
	extension: 'jem',
	icon: 'icon-format_optifine',
	category: 'minecraft',
	target: 'Minecraft: Java Edition with OptiFine',
	format_page: {
		content: [
			{type: 'h3', text: tl('mode.start.format.informations')},
			{text: `* ${tl('format.optifine_entity.info.optifine_required')}
					* ${tl('format.optifine_entity.info.pivots')}`.replace(/\t+/g, '')
			},
			{type: 'h3', text: tl('mode.start.format.resources')},
			{text: `* [OptiFine Modeling and Animation Tutorial](https://youtu.be/arj2eim42KI)`}
		]
	},
	model_identifier: false,
	box_uv: true,
	optional_box_uv: true,
	per_group_texture: true,
	single_texture_default: true,
	per_texture_uv_size: true,
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
