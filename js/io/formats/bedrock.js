
if (isApp) {
window.BedrockEntityManager = class BedrockEntityManager {
	constructor(project) {
		this.project = project || Project;
		this.root_path = '';
	}
	checkEntityFile(path) {
		try {
			var c = fs.readFileSync(path, 'utf-8');
			if (typeof c === 'string') {
				c = autoParseJSON(c, false);
				let main = c && (c['minecraft:client_entity'] || c['minecraft:attachable']);
				if (main && main.description && typeof main.description.geometry == 'object') {
					for (var key in main.description.geometry) {
						var geoname = main.description.geometry[key];
						if (typeof geoname == 'string') {
							geoname = geoname.replace(/^geometry\./, '');
							if (geoname == this.project.geometry_name) {
								main.type = c['minecraft:attachable'] ? 'attachable' : 'client_entity';
								return main;
							}
						}
					}
				} 
			}
		} catch (err) {
			console.log(err);
			return false;
		}
	}
	getEntityFile() {
		var path = this.project.export_path.split(osfs);
		var name = path.pop().replace(/\.json$/, '').replace(/\.geo$/, '');
		var root_index = path.indexOf('models');
		path.splice(root_index);
		this.root_path =  path.slice().join(osfs);
		path.push('entity');
		path = path.join(osfs);
		var entity_path = findExistingFile([
			path+osfs+name+'.entity.json',
			path+osfs+name+'.json',
		])
		if (entity_path) {
			var content = this.checkEntityFile(entity_path);
			if (content) {
				return content;
			}
		} else {
			let searchFolder = (path) => {
				try {
					var files = fs.readdirSync(path);	
					for (var name of files) {
						var new_path = path + osfs + name;
						if (name.match(/\.json$/)) {
							var result = this.checkEntityFile(new_path);
							if (result) return result;
						} else if (!name.includes('.')) {
							var result = searchFolder(new_path);
							if (result) return result;
						}
					}
				} catch (err) {}
			}
			if (Group.all.find(group => group.bedrock_binding)) {
				// Primarily an attachable
				return searchFolder(path.replace(/entity$/, 'attachables')) || searchFolder(path);
			} else {
				// Entity
				return searchFolder(path) || searchFolder(path.replace(/entity$/, 'attachables'));
			}
		}
	}
	initEntity() {
		this.client_entity = this.getEntityFile();
		if (this.client_entity && this.client_entity.description) {

			let render_mode;
			let {materials} = this.client_entity.description;
			if (materials) {
				let [key] = Object.keys(materials);
				if (typeof materials[key] == 'string') {
					if (materials[key].includes('emissive')) {
						render_mode = 'emissive'
					} else if (materials[key].includes('multitexture')) {
						render_mode = 'layered';
					}
				}
			}
			function updateLayeredTextures() {
				Texture.all.forEach((tex, i) => {
					tex.visible = i < 3
				})
				Interface.Panels.textures.inside_vue.$forceUpdate()
				Canvas.updateLayeredTextures();
			}

			// Textures
			var tex_list = this.client_entity.description.textures
			if (tex_list instanceof Object) {
				var valid_textures_list = [];
				for (var key in tex_list) {
					if (typeof tex_list[key] == 'string') {
						var path = this.root_path + osfs + tex_list[key].replace(/\//g, osfs);
						path = findExistingFile([
							path+'.png',
							path+'.tga'
						])
						if (path) {
							valid_textures_list.safePush(path);
						}
					}
				}
				if (valid_textures_list.length == 1) {
					new Texture({keep_size: true, render_mode}).fromPath(valid_textures_list[0]).add()
					if (render_mode == 'layered') {
						updateLayeredTextures();
					}

				} else if (valid_textures_list.length > 1) {
					setTimeout(() => {this.project.whenNextOpen(() => {
						let selected_textures = [];
						var dialog = new Dialog({
							title: tl('data.texture'),
							id: 'select_texture',
							width: 704,
							component: {
								data() {return {
									valid_textures_list,
									selected_textures,
									search_term: ''
								}},
								methods: {
									getName(path) {
										return pathToName(path, true);
									},
									getBackground(path) {
										return `url("${ path.replace(/\\/g, '/').replace(/#/g, '%23') }?1)`
									},
									clickTexture(texture) {
										if (selected_textures.includes(texture)) {
											selected_textures.remove(texture)
										} else {
											selected_textures.push(texture)
										}
									},
									dblclickTexture(texture) {
										selected_textures.replace([texture])
										dialog.confirm()
									}
								},
								computed: {
									textures() {
										if (!this.search_term) return this.valid_textures_list;
										let term = this.search_term.toLowerCase();
										return this.valid_textures_list.filter(path => {
											return path.toLowerCase().includes(this.search_term);
										});
									}
								},
								template: `
									<div>
										<search-bar style="float: none; height: 40px; margin-left: auto;" v-model="search_term" />
										<ul id="import_texture_list" class="y_scrollable">
											<li v-for="(texture, index) in textures"
												:title="getName(texture)" :arr_index="index"
												:class="{selected: selected_textures.includes(texture)}"
												:style="{backgroundImage: getBackground(texture)}"
												@click="clickTexture(texture)"
												@dblclick="dblclickTexture(texture)"
											>
												<label>{{ getName(texture) }}</label>
											</li>
										</ul>
									</div>
								`
							},
							buttons: ['dialog.import', 'dialog.select_texture.import_all', 'dialog.cancel'],
							confirmIndex: 0,
							cancelIndex: 2,
							onButton(index) {
								dialog.hide();
								if (index == 1) {
									valid_textures_list.forEach(path => {
										new Texture({keep_size: true, render_mode}).fromPath(path).add()
									})
								} else if (index == 0) {
									selected_textures.forEach(path => {
										new Texture({keep_size: true, render_mode}).fromPath(path).add()
									})
								}
								if (render_mode == 'layered') {
									updateLayeredTextures();
								}
							}
						}).show()
					})}, 2)
				}
			}

		} else {
			this.findEntityTexture(this.project.geometry_name)
		}
	}
	initAnimations() {
		let anim_list = this.client_entity && this.client_entity.description && this.client_entity.description.animations;
		if (anim_list instanceof Object) {
			let animation_names = [];
			for (var key in anim_list) {
				if (anim_list[key].match && anim_list[key].match(/^animation\./)) {
					animation_names.push(anim_list[key]);
				}
			}
			// get all paths in folder
			let anim_files = [];
			function searchFolder(path) {
				try {
					var files = fs.readdirSync(path);	
					for (var name of files) {
						var new_path = path + osfs + name;
						if (name.match(/\.json$/)) {
							anim_files.push(new_path);
						} else if (!name.includes('.')) {
							searchFolder(new_path);
						}
					}
				} catch (err) {}
			}
			searchFolder(PathModule.join(this.root_path, 'animations'));

			anim_files.forEach(path => {
				try {
					let content = fs.readFileSync(path, 'utf8');
					Animator.loadFile({path, content}, animation_names);
				} catch (err) {}
			})
		}
		this.initialized_animations = true;
	}
	findEntityTexture(mob, return_path) {
		if (!mob) return;
		var textures = {
			'llamaspit': 'llama/spit',
			'llama': 'llama/llama_creamy',
			'dragon': 'dragon/dragon',
			'ghast': 'ghast/ghast',
			'slime': 'slime/slime',
			'slime.armor': 'slime/slime',
			'lavaslime': 'slime/magmacube',
			'shulker': 'shulker/shulker_undyed',
			'rabbit': 'rabbit/brown',
			'horse': 'horse/horse_brown',
			'horse.v2': 'horse2/horse_brown',
			'humanoid': 'steve',
			'creeper': 'creeper/creeper',
			'enderman': 'enderman/enderman',
			'zombie': 'zombie/zombie',
			'zombie.husk': 'zombie/husk',
			'zombie.drowned': 'zombie/drowned',
			'pigzombie': 'pig/pigzombie',
			'pigzombie.baby': 'pig/pigzombie',
			'skeleton': 'skeleton/skeleton',
			'skeleton.wither': 'skeleton/wither_skeleton',
			'skeleton.stray': 'skeleton/stray',
			'spider': 'spider/spider',
			'cow': 'cow/cow',
			'mooshroom': 'cow/mooshroom',
			'sheep.sheared': 'sheep/sheep',
			'sheep': 'sheep/sheep',
			'pig': 'pig/pig',
			'irongolem': 'iron_golem',
			'snowgolem': 'snow_golem',
			'zombie.villager': 'zombie_villager/zombie_farmer',
			'evoker': 'illager/evoker',
			'vex': 'vex/vex',
			'wolf': 'wolf/wolf',
			'ocelot': 'cat/ocelot',
			'cat': 'cat/siamese',
			'turtle': 'sea_turtle',
			'villager': 'villager/farmer',
			'villager.witch': 'witch',
			'witherBoss': 'wither_boss/wither',
			'parrot': 'parrot/parrot_red_blue',
			'bed': 'bed/white',
			'player_head': 'steve',
			'mob_head': 'skeleton/skeleton',
			'dragon_head': 'dragon/dragon',
			'boat': 'boat/boat_oak',
			'cod': 'fish/fish',
			'pufferfish.small': 'fish/pufferfish',
			'pufferfish.mid': 'fish/pufferfish',
			'pufferfish.large': 'fish/pufferfish',
			'salmon': 'fish/salmon',
			'tropicalfish_a': 'fish/tropical_a',
			'tropicalfish_b': 'fish/tropical_b',
			'panda': 'panda/panda',
			'fishing_hook': 'fishhook',
			'ravager': 'illager/ravager',
			'bee': 'bee/bee',
			'fox': 'fox/fox',
			'shield': 'shield',
			'shulker_bullet': 'shulker/spark',
		}
		mob = mob.split(':')[0].replace(/^geometry\./, '')
		var path = textures[mob]
		if (!path) {
			path = mob
		}
		if (path) {
			var texture_path = this.project.export_path.split(osfs)
			var index = texture_path.lastIndexOf('models') - texture_path.length
			texture_path.splice(index)
			texture_path = [...texture_path, 'textures', 'entity', ...path.split('/')].join(osfs)

			if (return_path === true) {
				return texture_path+'.png';
			} else if (return_path === 'raw') {
				return ['entity', ...path.split('/')].join(osfs)
			} else {
				function tryItWith(extension) {
					if (fs.existsSync(texture_path+'.'+extension)) {
						var texture = new Texture({keep_size: true}).fromPath(texture_path+'.'+extension).add()
						return true;
					}
				}
				if (!tryItWith('png') && !tryItWith('tga')) {
					if (settings.default_path && settings.default_path.value) {
						
						texture_path = settings.default_path.value + osfs + 'entity' + osfs + path.split('/').join(osfs)
						tryItWith('png') || tryItWith('tga')
					}
				}
			}
		}
	}
}
window.BedrockBlockManager = class BedrockBlockManager {
	constructor(project) {
		this.project = project || Project;
		this.root_path = '';
	}
	checkBlockFile(path) {
		try {
			var c = fs.readFileSync(path, 'utf-8');
			if (typeof c === 'string') {
				c = autoParseJSON(c, false);
				let main = c && c['minecraft:block'];
				if (main && main.components && typeof main.components['minecraft:geometry'] == 'string') {
					var geoname = main.components['minecraft:geometry'];
					geoname = geoname.replace(/^geometry\./, '');
					if (geoname == this.project.geometry_name) {
						main.type = 'block';
						return main;
					}
				} 
			}
		} catch (err) {
			console.log(err);
			return false;
		}
	}
	getBlockFile() {
		var path = this.project.export_path.split(osfs);
		var name = path.pop().replace(/\.json$/, '').replace(/\.geo$/, '');
		let rp_dir = path.find(dir => (dir == 'resource_packs' || dir == 'development_resource_packs'));
		var root_index = path.indexOf(rp_dir);
		
		let rp_manifest_path = [...path.slice(0, root_index+2), 'manifest.json'].join(osfs);
		let rp_manifest_content = autoParseJSON(fs.readFileSync(rp_manifest_path, 'utf-8'), false);
		let rp_uuid = rp_manifest_content.header.uuid;

		path.splice(root_index);
		path.push(rp_dir.match(/development/) ? 'development_behavior_packs' : 'behavior_packs');
		let behavior_packs = fs.readdirSync(path.join(osfs), {withFileTypes: true});
		let bp_name;
		for (let dirent of behavior_packs) {
			if (dirent.isDirectory()) {
				try {
					let bp_manifest_path = [...path, dirent.name, 'manifest.json'].join(osfs);
					let bp_manifest_content = autoParseJSON(fs.readFileSync(bp_manifest_path, 'utf-8'), false);
					if (bp_manifest_content && bp_manifest_content.dependencies && bp_manifest_content.dependencies[0] && bp_manifest_content.dependencies[0].uuid == rp_uuid) {
						bp_name = dirent.name;
						break;
					}
				} catch (err) {}
			}
		}
		if (!bp_name) return;

		path.push(bp_name, 'blocks')
		path = path.join(osfs);
		var block_path = findExistingFile([
			path+osfs+name+'.block.json',
			path+osfs+name+'.json',
		])
		if (block_path) {
			var content = this.checkBlockFile(block_path);
			if (content) {
				return content;
			}
		} else {
			let searchFolder = (path) => {
				try {
					var files = fs.readdirSync(path);	
					for (var name of files) {
						var new_path = path + osfs + name;
						if (name.match(/\.json$/)) {
							var result = this.checkBlockFile(new_path);
							if (result) return result;
						} else if (!name.includes('.')) {
							var result = searchFolder(new_path);
							if (result) return result;
						}
					}
				} catch (err) {}
			}
			return searchFolder(path);
		}
	}
	initBlock() {
		this.rp_root_path = this.project.export_path.replace(/[\\/]models[\\/]blocks[\\/].+/, '');
		try {
			this.client_block = this.getBlockFile();
		} catch (err) {
			console.error(err);
		}
		if (this.client_block && this.client_block.components && this.client_block.components['minecraft:material_instances']) {

			let terrain_texture;
			try {
				let terrain_tex_path = this.rp_root_path + osfs + 'textures' + osfs + 'terrain_texture.json';
				let terrain_tex_content = autoParseJSON(fs.readFileSync(terrain_tex_path, 'utf-8'), false);
				terrain_texture = terrain_tex_content.texture_data;
			} catch (err) {
				console.error(err)
			}

			let materials = this.client_block.components['minecraft:material_instances'];
			for (let target in materials) {
				let material = materials[target];
				let texture_path = `textures/blocks/${material.texture || this.project.geometry_name}`;
				if (terrain_texture) {
					let texture_data = terrain_texture[material.texture];
					texture_path = texture_data.textures
				}
				let full_texture_path = PathModule.join(this.rp_root_path + osfs + texture_path.replace(/\.png$/i, ''));
				full_texture_path = findExistingFile([
					full_texture_path+'.png',
					full_texture_path+'.tga'
				])
				if (full_texture_path) {
					let texture = new Texture({keep_size: true}).fromPath(full_texture_path).add();
					let target_regex = new RegExp('^' + target.replace(/\*/g, '.*') + '$');

					Cube.all.forEach(cube => {
						for (let fkey in cube.faces) {
							let face = cube.faces[fkey];
							if (face.texture === null) continue;
							if (
								(target == '*') ||
								(face.material_name && face.material_name.match(target_regex))
							) {
								face.texture = texture.uuid;
							}
						}
					})
				}
			}
			Canvas.updateView({elements: Cube.all, element_aspects: {faces: true}})
			UVEditor.loadData()
		}
	}
}
}

function calculateVisibleBox() {
	var visible_box = new THREE.Box3()
	Canvas.withoutGizmos(() => {
		Cube.all.forEach(cube => {
			if (cube.export && cube.mesh) {
				visible_box.expandByObject(cube.mesh);
			}
		})
	})

	var offset = new THREE.Vector3(8,8,8);
	visible_box.max.add(offset);
	visible_box.min.add(offset);

	// Width
	var radius = Math.max(
		visible_box.max.x,
		visible_box.max.z,
		-visible_box.min.x,
		-visible_box.min.z
	)
	if (Math.abs(radius) === Infinity) {
		radius = 0
	}
	let width = Math.ceil((radius*2) / 16)
	width = Math.max(width, Project.visible_box[0]);
	Project.visible_box[0] = width;

	//Height
	let y_min = Math.floor(visible_box.min.y / 16);
	let y_max = Math.ceil(visible_box.max.y / 16);
	if (y_min === Infinity) y_min = 0;
	if (y_max === Infinity) y_max = 0;
	y_min = Math.min(y_min, Project.visible_box[2] - Project.visible_box[1]/2);
	y_max = Math.max(y_max, Project.visible_box[2] + Project.visible_box[1]/2);

	Project.visible_box.replace([width, y_max-y_min, (y_max+y_min) / 2])

	return Project.visible_box;
}

(function() {

// Parse

	function parseCube(s, group) {
		var base_cube = new Cube({
			name: s.name || group.name,
			autouv: 0,
			color: group.color,
			rotation: s.rotation,
			origin: s.pivot
		})
		base_cube.rotation.forEach(function(br, axis) {
			if (axis != 2) base_cube.rotation[axis] *= -1
		})
		base_cube.origin[0] *= -1;
		if (s.origin) {
			base_cube.from.V3_set(s.origin)
			base_cube.from[0] = -(base_cube.from[0] + s.size[0])
			if (s.size) {
				base_cube.to[0] = s.size[0] + base_cube.from[0]
				base_cube.to[1] = s.size[1] + base_cube.from[1]
				base_cube.to[2] = s.size[2] + base_cube.from[2]
			}
		}
		if (s.uv instanceof Array) {
			base_cube.uv_offset[0] = s.uv[0]
			base_cube.uv_offset[1] = s.uv[1]
			base_cube.box_uv = true;
		} else if (s.uv) {
			base_cube.box_uv = false;
			for (var key in base_cube.faces) {
				var face = base_cube.faces[key]
				if (s.uv[key]) {
					face.extend({
						material_name: s.uv[key].material_instance,
						uv: [
							s.uv[key].uv[0],
							s.uv[key].uv[1]
						]
					})
					if (s.uv[key].uv_size) {
						face.uv_size = [
							s.uv[key].uv_size[0],
							s.uv[key].uv_size[1]
						]
					} else {
						base_cube.autouv = 1;
						base_cube.mapAutoUV();
					}
					if (key == 'up' || key == 'down') {
						face.uv = [face.uv[2], face.uv[3], face.uv[0], face.uv[1]]
					}
				} else {
					face.texture = null;
					face.uv = [0, 0, 0, 0]
				}
			}
			
		}
		if (s.inflate && typeof s.inflate === 'number') {
			base_cube.inflate = s.inflate;
		}
		if (s.mirror === undefined) {
			base_cube.mirror_uv = group.mirror_uv;
		} else {
			base_cube.mirror_uv = s.mirror === true;
		}
		base_cube.addTo(group).init();
		return base_cube;
	}
	function parseBone(b, bones, parent_list) {
		var group = new Group({
			name: b.name,
			origin: b.pivot,
			rotation: b.rotation,
			material: b.material,
			bedrock_binding: b.binding,
			color: Group.all.length%markerColors.length
		}).init()
		group.createUniqueName();
		bones[b.name] = group
		if (b.pivot) {
			group.origin[0] *= -1
		}
		group.rotation.forEach(function(br, axis) {
			if (axis !== 2) group.rotation[axis] *= -1
		})
		
		group.mirror_uv = b.mirror === true
		group.reset = b.reset === true

		if (b.cubes) {
			b.cubes.forEach(function(s) {
				parseCube(s, group)
			})
		}
		if (b.locators) {
			for (var key in b.locators) {
				var coords, rotation;
				if (b.locators[key] instanceof Array) {
					coords = b.locators[key];
				} else {
					coords = b.locators[key].offset;
					rotation = b.locators[key].rotation;
				}
				coords[0] *= -1;
				if (rotation instanceof Array) {
					rotation[0] *= -1;
					rotation[1] *= -1;
				}
				if (key.substr(0, 6) == '_null_' && b.locators[key] instanceof Array) {
					new NullObject({from: coords, name: key.substr(6)}).addTo(group).init();
				} else {
					new Locator({position: coords, name: key, rotation}).addTo(group).init();
				}
			}
		}
		if (b.texture_meshes instanceof Array) {
			b.texture_meshes.forEach(tm => {
				let texture = Texture.all.find(tex => tex.name == tm.texture);
				let texture_mesh = new TextureMesh({
					texture_name: tm.texture,
					texture: texture ? texture.uuid : null,
					origin: tm.position,
					rotation: tm.rotation,
					local_pivot: tm.local_pivot,
					scale: tm.scale,
				})
				texture_mesh.local_pivot[2] *= -1;
				texture_mesh.origin[1] *= -1;

				if (b.pivot) texture_mesh.origin[1] += b.pivot[1];

				texture_mesh.origin[0] *= -1;
				texture_mesh.rotation[0] *= -1;
				texture_mesh.rotation[1] *= -1;
				texture_mesh.addTo(group).init();
			})
		}
		if (b.children) {
			b.children.forEach(function(cg) {
				cg.addTo(group);
			})
		}
		var parent_group = 'root';
		if (b.parent) {
			if (bones[b.parent]) {
				parent_group = bones[b.parent]
			} else {
				parent_list.forEach(function(ib) {
					if (ib.name === b.parent) {
						ib.children && ib.children.length ? ib.children.push(group) : ib.children = [group]
					}
				})
			}
		}
		group.addTo(parent_group)
	}
	function parseGeometry(data) {
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

		let {description} = data.object;
		let geometry_name = (description.identifier && description.identifier.replace(/^geometry\./, '')) || '';

		let existing_tab = isApp && ModelProject.all.find(project => (
			Project !== project && project.export_path == Project.export_path && project.geometry_name == geometry_name
		))
		if (existing_tab) {
			Project.close().then(() =>  {
				existing_tab.select();
			});
			pe_list_data.length = 0;
			hideDialog()
			return;
		}

		codec.dispatchEvent('parse', {model: data.object});

		Project.geometry_name = geometry_name;
		Project.texture_width = 16;
		Project.texture_height = 16;

		if (typeof description.visible_bounds_width == 'number' && typeof description.visible_bounds_height == 'number') {
			Project.visible_box[0] = Math.max(Project.visible_box[0], description.visible_bounds_width || 0);
			Project.visible_box[1] = Math.max(Project.visible_box[1], description.visible_bounds_height || 0);
			if (description.visible_bounds_offset && typeof description.visible_bounds_offset[1] == 'number') {
				Project.visible_box[2] = description.visible_bounds_offset[1] || 0;
			}
		}

		if (description.texture_width !== undefined) {
			Project.texture_width = description.texture_width;
		}
		if (description.texture_height !== undefined) {
			Project.texture_height = description.texture_height;
		}

		var bones = {}

		if (data.object.bones) {
			var included_bones = []
			data.object.bones.forEach(function(b) {
				included_bones.push(b.name)
			})
			data.object.bones.forEach(function(b) {
				parseBone(b, bones, data.object.bones)
			})
		}

		Project.box_uv = Cube.all.filter(cube => cube.box_uv).length > Cube.all.length/2;

		codec.dispatchEvent('parsed', {model: data.object});

		pe_list_data.length = 0;
		hideDialog()

		loadTextureDraggable()
		Canvas.updateAllBones()
		setProjectTitle()
		if (isApp && Project.geometry_name) {
			if (Format.id == 'bedrock') Project.BedrockEntityManager.initEntity();
			if (Format.id == 'bedrock_block') Project.BedrockBlockManager.initBlock();
		}
		Validator.validate()
		updateSelection()
	}

// Compile

	function compileCube(cube, bone) {
		var template = {
			origin: cube.from.slice(),
			size: cube.size(),
			inflate: cube.inflate||undefined,
		}
		if (cube.box_uv) {
			template = new oneLiner(template);
		}
		template.origin[0] = -(template.origin[0] + template.size[0])

		if (!cube.rotation.allEqual(0)) {
			template.pivot = cube.origin.slice();
			template.pivot[0] *= -1;
			
			template.rotation = cube.rotation.slice();
			template.rotation.forEach(function(br, axis) {
				if (axis != 2) template.rotation[axis] *= -1
			})
		}

		if (cube.box_uv) {
			template.uv = cube.uv_offset;
			if (cube.mirror_uv === !bone.mirror) {
				template.mirror = cube.mirror_uv
			}
		} else {
			template.uv = {};
			for (var key in cube.faces) {
				var face = cube.faces[key];
				if (face.texture !== null) {
					template.uv[key] = new oneLiner({
						uv: [
							face.uv[0],
							face.uv[1],
						],
						uv_size: [
							face.uv_size[0],
							face.uv_size[1],
						]
					});
					if (face.material_name) {
						template.uv[key].material_instance = face.material_name;
					}
					if (key == 'up' || key == 'down') {
						template.uv[key].uv[0] += template.uv[key].uv_size[0];
						template.uv[key].uv[1] += template.uv[key].uv_size[1];
						template.uv[key].uv_size[0] *= -1;
						template.uv[key].uv_size[1] *= -1;
					}
				}
			}
		}
		return template;
	}
	function compileGroup(g) {
		if (g.type !== 'group') return;
		if (!settings.export_empty_groups.value && !g.children.find(child => child.export)) return;
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
			bone.rotation[0] *= -1;
			bone.rotation[1] *= -1;
		}
		if (g.bedrock_binding) {
			bone.binding = g.bedrock_binding
		}
		if (g.reset) {
			bone.reset = true
		}
		if (g.mirror_uv && Project.box_uv) {
			bone.mirror = true
		}
		if (g.material) {
			bone.material = g.material
		}
		// Elements
		var cubes = []
		var locators = {};
		var texture_meshes = [];

		for (var obj of g.children) {
			if (obj.export) {
				if (obj instanceof Cube) {

					let template = compileCube(obj, bone);
					cubes.push(template);

				} else if (obj instanceof Locator || obj instanceof NullObject) {
					let key = obj.name;
					if (obj instanceof NullObject) key = '_null_' + key;
					let offset = obj.position.slice();
					offset[0] *= -1;

					if ((obj.rotatable && !obj.rotation.allEqual(0)) || obj.ignore_inherited_scale) {
						locators[key] = {
							offset
						};
						if (obj.rotatable) {
							locators[key].rotation = [
								-obj.rotation[0],
								-obj.rotation[1],
								obj.rotation[2]
							]
						}
						if (obj.ignore_inherited_scale) {
							locators[key].ignore_inherited_scale = true;
						}
					} else {
						locators[key] = offset;
					}
				} else if (obj instanceof TextureMesh) {
					let texmesh = {
						texture: obj.texture_name,
						position: obj.origin.slice(),
					}
					texmesh.position[0] *= -1;
					texmesh.position[1] -= bone.pivot[1];
					texmesh.position[1] *= -1;

					if (!obj.rotation.allEqual(0)) {
						texmesh.rotation = [
							-obj.rotation[0],
							-obj.rotation[1],
							obj.rotation[2]
						]
					}
					if (!obj.local_pivot.allEqual(0)) {
						texmesh.local_pivot = obj.local_pivot.slice();
						texmesh.local_pivot[2] *= -1;
					}
					if (!obj.scale.allEqual(1)) {
						texmesh.scale = obj.scale.slice();
					}
					texture_meshes.push(texmesh);
				}
			}
		}

		if (cubes.length) {
			bone.cubes = cubes
		}
		if (texture_meshes.length) {
			bone.texture_meshes = texture_meshes
		}
		if (Object.keys(locators).length) {
			bone.locators = locators
		}
		return bone;
	}


var codec = new Codec('bedrock', {
	name: 'Bedrock Model',
	extension: 'json',
	remember: true,
	multiple_per_file: true,
	load_filter: {
		type: 'json',
		extensions: ['json'],
		condition(model) {
			return model.format_version && !compareVersions('1.12.0', model.format_version)
		}
	},
	load(model, file, add) {
		let is_block = file.path && file.path.match(/[\\/]models[\\/]blocks[\\/]/);
		if (!add) {
			setupProject(is_block ? block_format : entity_format);
		}
		if (file.path && isApp && this.remember && !file.no_file ) {
			var name = pathToName(file.path, true);
			let project = Project;
			Project.name = pathToName(name, false);
			Project.export_path = file.path;

			addRecentProject({
				name,
				path: file.path,
				icon: Format.icon
			});
			setTimeout(() => {
				if (Project == project) updateRecentProjectThumbnail();
			}, 200)
		}
		this.parse(model, file.path)
		if (isApp) loadDataFromModelMemory();
	},
	compile(options) {
		if (options === undefined) options = {}

		var entitymodel = {}
		var main_tag = {
			format_version: Group.all.find(group => group.bedrock_binding) ? '1.16.0' : '1.12.0',
			'minecraft:geometry': [entitymodel]
		}
		entitymodel.description = {
			identifier: 'geometry.' + (Project.geometry_name||'unknown'),
			texture_width:  Project.texture_width || 16,
			texture_height: Project.texture_height || 16,
		}
		var bones = []

		var groups = getAllGroups();
		var loose_elements = [];
		Outliner.root.forEach(obj => {
			if (obj instanceof OutlinerElement) {
				loose_elements.push(obj)
			}
		})
		if (loose_elements.length) {
			let group = new Group({
				name: 'bb_main'
			});
			group.children.push(...loose_elements);
			group.is_catch_bone = true;
			group.createUniqueName();
			groups.splice(0, 0, group);
		}
		groups.forEach(function(g) {
			let bone = compileGroup(g);
			bones.push(bone)
		})

		if (bones.length && options.visible_box !== false) {

			let visible_box = calculateVisibleBox();
			entitymodel.description.visible_bounds_width = visible_box[0] || 0;
			entitymodel.description.visible_bounds_height = visible_box[1] || 0;
			entitymodel.description.visible_bounds_offset = [0, visible_box[2] || 0 , 0]
		}
		if (bones.length) {
			entitymodel.bones = bones
		}
		this.dispatchEvent('compile', {model: main_tag, options});

		if (options.raw) {
			return main_tag
		} else {
			return autoStringify(main_tag)
		}
	},
	overwrite(content, path, cb) {
		var data, index;
		var model_id = 'geometry.'+Project.geometry_name;
		try {
			data = fs.readFileSync(path, 'utf-8');
			data = autoParseJSON(data, false);
			if (data['minecraft:geometry'] instanceof Array == false) {
				throw 'Incompatible format';
			}
			var i = 0;
			for (model of data['minecraft:geometry']) {
				if (model.description && model.description.identifier == model_id) {
					index = i;
					break;
				}
				i++;
			}
		} catch (err) {
			var answer = electron.dialog.showMessageBox(currentwindow, {
				type: 'warning',
				buttons: [
					tl('message.bedrock_overwrite_error.overwrite'),
					tl('dialog.cancel')
				],
				title: 'Blockbench',
				message: tl('message.bedrock_overwrite_error.message'),
				detail: err+'',
				noLink: false
			})
			if (answer === 1) {
				return;
			}
		}
		if (data && index !== undefined) {

			if (Group.all.find(group => group.bedrock_binding)) {
				data.format_version = '1.16.0';
			}

			data['minecraft:geometry'].forEach(geo => {
				if (geo.bones instanceof Array) {
					geo.bones.forEach(bone => {
						if (bone.cubes instanceof Array) {
							bone.cubes.forEach((cube, ci) => {
								if (cube.uv instanceof Array) {
									bone.cubes[ci] = new oneLiner(cube);
								}
							})
						}
					})
				}
			})

			var model = this.compile({raw: true})['minecraft:geometry'][0]
			if (index != undefined) {
				data['minecraft:geometry'][index] = model
			} else {
				data['minecraft:geometry'].push(model)
			}
			content = autoStringify(data)
		}
		Blockbench.writeFile(path, {content}, cb);
	},
	parse(data, path) {
		pe_list_data.length = 0
		if (Format != Formats.bedrock && Format != Formats.bedrock_block) Formats.bedrock.select()

		var geometries = []
		for (var geo of data['minecraft:geometry']) {
			geometries.push(geo);
		}
		if (geometries.length === 1) {
			parseGeometry({object: data['minecraft:geometry'][0]})
			return;
		}

		$('#pe_search_bar').val('')
		if (pe_list && pe_list._data) {
			pe_list._data.search_text = ''
		}

		function create_thumbnail(model_entry, isize) {
			var included_bones = []
			model_entry.object.bones.forEach(function(b) {
				included_bones.push(b.name)
			})
			var thumbnail = new Jimp(48, 48, 0x00000000, function(err, image) {
				model_entry.object.bones.forEach(function(b) {
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
		for (var geo of data['minecraft:geometry']) {
			var key = geo.description && geo.description.identifier;
			if (key && key.includes('geometry.')) {
				var base_model = {
					name: key,
					bonecount: 0,
					cubecount: 0,
					selected: false,
					object: geo,
					icon: false
				}
				var oversize = 2;
				var words = key.replace(/:.*/g, '').replace('geometry.', '').split(/[\._]/g)
				words.forEach(function(w, wi) {
					words[wi] = capitalizeFirstLetter(w)
				})
				base_model.title = words.join(' ')
				if (geo.bones) {
					base_model.bonecount = geo.bones.length
					geo.bones.forEach(function(b) {
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
					selectE(item, event) {
						var index = pe_list_data.indexOf(item)
						pe_list_data.forEach(function(s) {
							s.selected = false;
						})
						pe_list_data[index].selected = true
					},
					open() {
						parseGeometry()
					},
					tl
				},
				computed: {
					searched() {
						return this.list.filter(item => {
							return item.name.toUpperCase().includes(this.search_text)
						})
					}
				}
			})
		}
		showDialog('entity_import')
		$('#pe_list').css('max-height', (window.innerHeight - 320) +'px')
		$('input#pe_search_bar').select()
		$('#entity_import .confirm_btn').off('click')
		$('#entity_import .confirm_btn').on('click', (e) => {
			parseGeometry()
		})
	},
	fileName() {
		var name = Project.name||'model';
		if (!name.match(/\.geo$/)) {
			name += '.geo';
		}
		return name;
	}
})

codec.parseCube = parseCube;
codec.parseBone = parseBone;
codec.parseGeometry = parseGeometry;
codec.compileCube = compileCube;
codec.compileGroup = compileGroup;


var entity_format = new ModelFormat({
	id: 'bedrock',
	extension: 'json',
	icon: 'icon-format_bedrock',
	category: 'minecraft',
	target: 'Minecraft: Bedrock Edition',
	format_page: {
		content: [
			{type: 'h3', text: tl('mode.start.format.informations')},
			{text: `* ${tl('format.bedrock.info.textures')}`},
			{type: 'h3', text: tl('mode.start.format.resources')},
			{text: `* [Article on modeling and implementation](https://www.blockbench.net/wiki/guides/bedrock-modeling)
					* [Modeling Tutorial Series](https://www.youtube.com/watch?v=U9FLteWmFzg&list=PLvULVkjBtg2SezfUA8kHcPUGpxIS26uJR)`.replace(/\t+/g, '')
			}
		]
	},
	rotate_cubes: true,
	box_uv: true,
	optional_box_uv: true,
	single_texture: true,
	bone_rig: true,
	centered_grid: true,
	animated_textures: true,
	animation_files: true,
	animation_mode: true,
	bone_binding_expression: true,
	locators: true,
	texture_meshes: true,
	codec,
	onSetup(project) {
		if (isApp) {
			project.BedrockEntityManager = new BedrockEntityManager(project);
		}
	}
})
var block_format = new ModelFormat({
	id: 'bedrock_block',
	category: 'minecraft',
	extension: 'json',
	icon: 'icon-format_bedrock_block',
	target: 'Minecraft: Bedrock Edition',
	format_page: {
		content: [
			{type: 'h3', text: tl('mode.start.format.informations')},
			{text: `* ${tl('format.bedrock_block.info.size_limit')}`},
			{text: `* ${tl('format.bedrock_block.info.textures')}`},
			{type: 'h3', text: tl('mode.start.format.resources')},
			{text: `* [Article on implementing custom blocks](https://learn.microsoft.com/en-us/minecraft/creator/documents/customblock)
					* [Modeling Tutorial Series](https://www.youtube.com/watch?v=U9FLteWmFzg&list=PLvULVkjBtg2SezfUA8kHcPUGpxIS26uJR)`.replace(/\t+/g, '')
			}
		]
	},
	show_on_start_screen: new Date().dayOfYear() >= 298 || new Date().getYear() > 122,
	rotate_cubes: true,
	box_uv: false,
	optional_box_uv: true,
	single_texture: false,
	bone_rig: true,
	centered_grid: true,
	animated_textures: true,
	animation_files: false,
	animation_mode: false,
	texture_meshes: true,
	cube_size_limiter: {
		rotation_affected: true,
		box_marker_size: [30, 30, 30],
		updateBoxMarker() {
			let center = Format.cube_size_limiter.getModelCenter();
			if (three_grid.size_limit_box) three_grid.size_limit_box.position.set(center[0] + center[3], center[1] + center[4], center[2] + center[5]).divideScalar(2);
		},
		getModelCenter(exclude_cubes = []) {
			let cache_key = exclude_cubes.length > 0 ? 'cached_center' : 'cached_center_all'
			if (block_format.cube_size_limiter[cache_key]) {
				return block_format.cube_size_limiter[cache_key];
			}

			let center = [-7, 1, -7, 7, 15, 7];
			Cube.all.forEach(cube => {
				if (exclude_cubes.includes(cube)) return;
				let vertices = block_format.cube_size_limiter.getCubeVertexCoordinates(cube, cube);

				vertices.forEach(array => {
					center[3] = Math.min(center[3], array[0] + 15);		center[0] = Math.max(center[0], array[0] - 15);
					center[4] = Math.min(center[4], array[1] + 15);		center[1] = Math.max(center[1], array[1] - 15);
					center[5] = Math.min(center[5], array[2] + 15);		center[2] = Math.max(center[2], array[2] - 15);
				})
			})
			block_format.cube_size_limiter[cache_key] = center;
			setTimeout(() => {
				delete block_format.cube_size_limiter[cache_key];
			}, 2)
			return center;
		},
		getCubeVertexCoordinates(cube, values) {
			let {from, to, inflate} = values;

			let vertices = [
				[from[0]-inflate, from[1]-inflate, from[2]-inflate],
				[from[0]-inflate, from[1]-inflate, to[2] + inflate],
				[from[0]-inflate, to[1] + inflate, from[2]-inflate],
				[from[0]-inflate, to[1] + inflate, to[2] + inflate],
				[to[0] + inflate, from[1]-inflate, from[2]-inflate],
				[to[0] + inflate, from[1]-inflate, to[2] + inflate],
				[to[0] + inflate, to[1] + inflate, from[2]-inflate],
				[to[0] + inflate, to[1] + inflate, to[2] + inflate]
			];
			vertices.forEach(array => {
				array.V3_subtract(cube.origin)
				let vector = Reusable.vec1.set(...array);
				cube.mesh.localToWorld(vector);
				array.replace(vector.toArray());
			});
			return vertices;
		},
		test(cube, values = 0) {
			let from = values.from || cube.from;
			let to = values.to || cube.to;
			let inflate = values.inflate == undefined ? cube.inflate : values.inflate;

			let vertices = block_format.cube_size_limiter.getCubeVertexCoordinates(cube, {from, to, inflate});
			let center = block_format.cube_size_limiter.getModelCenter([cube]);

			return undefined !== vertices.find((v, i) => {
				return (v[0] > center[3]+15 || v[0] < center[0]-15)
					|| (v[1] > center[4]+15 || v[1] < center[1]-15)
					|| (v[2] > center[5]+15 || v[2] < center[2]-15);
			})
		},
		move(cube, values = 0) {
			let from = values.from || cube.from;
			let to = values.to || cube.to;
			let inflate = values.inflate == undefined ? cube.inflate : values.inflate;

			let vertices = block_format.cube_size_limiter.getCubeVertexCoordinates(cube, {from, to, inflate});
			let center = block_format.cube_size_limiter.getModelCenter([cube]);

			let offset = [0, 0, 0];

			vertices.forEach(v => {
				v.forEach((val, i) => {
					if (val > center[i+3] + 15) offset[i] = Math.max(offset[i], val - (center[i+3] + 15));
					if (val < center[i] - 15) offset[i] = Math.min(offset[i], val - (center[i] - 15));
				})
			})

			let quat = cube.mesh.getWorldQuaternion(Reusable.quat1).invert();
			let required_offset = Reusable.vec2.set(...offset).applyQuaternion(quat).toArray();
			
			from.V3_subtract(required_offset);
			to.V3_subtract(required_offset);
						
		},
		clamp(cube, values = 0, axis, direction) {
			let from = values.from || cube.from;
			let to = values.to || cube.to;
			let inflate = values.inflate == undefined ? cube.inflate : values.inflate;

			let vertices = block_format.cube_size_limiter.getCubeVertexCoordinates(cube, {from, to, inflate});
			let center = block_format.cube_size_limiter.getModelCenter();

			let offset_from = [0, 0, 0];
			let offset_to = [0, 0, 0];

			vertices.forEach((v, vi) => {
				v.forEach((val, i) => {
					if (axis !== undefined && axis !== i) return;
					if ((i == 0 && vi < 4) || (i == 1 && (vi % 4) < 2) || (i == 2 && (vi % 2) < 1)) {
						if (val > center[i+3] + 15) offset_from[i] = Math.max(offset_from[i], val - (center[i+3] + 15));
						if (val < center[i] - 15) offset_from[i] = Math.min(offset_from[i], val - (center[i] - 15));
					} else {
						if (val > center[i+3] + 15) offset_to[i] = Math.max(offset_to[i], val - (center[i+3] + 15));
						if (val < center[i] - 15) offset_to[i] = Math.min(offset_to[i], val - (center[i] - 15));
					}
				})
			})

			let quat = cube.mesh.getWorldQuaternion(Reusable.quat1).invert();
			if (direction !== true) {
				let required_offset_to = Reusable.vec3.set(...offset_to).applyQuaternion(quat).toArray();
				to.V3_subtract(required_offset_to);
			}
			if (direction !== false) {
				let required_offset_from = Reusable.vec2.set(...offset_from).applyQuaternion(quat).toArray();
				from.V3_subtract(required_offset_from);
			}
		}
	},
	codec,
	onSetup(project) {
		if (isApp) {
			project.BedrockBlockManager = new BedrockBlockManager(project);
		}
	}
})
codec.format = entity_format;

BARS.defineActions(function() {
	codec.export_action = new Action({
		id: 'export_bedrock',
		icon: entity_format.icon,
		category: 'file',
		condition: () => Format == entity_format || Format == block_format,
		click: function () {
			codec.export()
		}
	})
})

})()

