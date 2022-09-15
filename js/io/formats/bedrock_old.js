(function() {

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

	let geometry_name = data.name.replace(/^geometry\./, '');

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
	Project.texture_width = data.object.texturewidth || 64;
	Project.texture_height = data.object.textureheight || 64;

	if (typeof data.object.visible_bounds_width == 'number' && typeof data.object.visible_bounds_height == 'number') {
		Project.visible_box[0] = Math.max(Project.visible_box[0], data.object.visible_bounds_width || 0);
		Project.visible_box[1] = Math.max(Project.visible_box[1], data.object.visible_bounds_height || 0);
		if (data.object.visible_bounds_offset && typeof data.object.visible_bounds_offset[1] == 'number') {
			Project.visible_box[2] = data.object.visible_bounds_offset[1] || 0;
		}
	}

	var bones = {}

	if (data.object.bones) {
		var included_bones = []
		data.object.bones.forEach(function(b) {
			included_bones.push(b.name)
		})
		data.object.bones.forEach(function(b, bi) {
			var group = new Group({
				name: b.name,
				origin: b.pivot,
				rotation: b.rotation,
				material: b.material,
				color: Group.all.length%markerColors.length
			}).init()
			bones[b.name] = group
			if (b.pivot) {
				group.origin[0] *= -1
			}
			group.rotation[0] *= -1;
			group.rotation[1] *= -1;
			
			group.mirror_uv = b.mirror === true
			group.reset = b.reset === true

			if (b.cubes) {
				b.cubes.forEach(function(s) {
					var base_cube = new Cube({name: b.name, autouv: 0, color: group.color})
					if (s.origin) {
						base_cube.from.V3_set(s.origin);
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
					base_cube.addTo(group).init()
				})
			}
			if (b.children) {
				b.children.forEach(function(cg) {
					cg.addTo(group)
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
					coords[0] *= -1
					var locator = new Locator({position: coords, name: key, rotation}).addTo(group).init();
				}
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

	codec.dispatchEvent('parsed', {model: data.object});

	pe_list_data.length = 0;
	hideDialog()

	loadTextureDraggable()
	Canvas.updateAllBones()
	setProjectTitle()
	if (isApp && Project.geometry_name) {
		Project.BedrockEntityManager.initEntity()
	}
	Validator.validate()
	updateSelection()
}


var codec = new Codec('bedrock_old', {
	name: 'Bedrock Entity Model',
	extension: 'json',
	remember: true,
	multiple_per_file: true,
	load_filter: {
		type: 'json',
		extensions: ['json'],
		condition(model) {
			return (model.format_version && compareVersions('1.12.0', model.format_version)) ||
				Object.keys(model).find(s => s.match(/^geometry\./));
		}
	},
	compile(options) {
		if (options === undefined) options = {}
		var entitymodel = {}
		entitymodel.texturewidth = Project.texture_width;
		entitymodel.textureheight = Project.texture_height;
		var bones = []
		var visible_box = new THREE.Box3()

		var groups = getAllGroups();
		var loose_elements = [];
		Outliner.root.forEach(obj => {
			if (obj.type === 'cube' || obj.type == 'locator') {
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
				bone.rotation = [
					-g.rotation[0],
					-g.rotation[1],
					g.rotation[2]
				]
			}
			if (g.reset) bone.reset = true;
			if (g.mirror_uv && Project.box_uv) bone.mirror = true;
			if (g.material) bone.material = g.material;

			//Elements
			var cubes = []
			var locators = {};
			for (var obj of g.children) {
				if (obj.export) {
					if (obj instanceof Cube) {

						var template = new oneLiner()
						template.origin = obj.from.slice()
						template.size = obj.size()
						template.origin[0] = -(template.origin[0] + template.size[0])
						template.uv = obj.uv_offset
						if (obj.inflate && typeof obj.inflate === 'number') {
							template.inflate = obj.inflate
						}
						if (obj.mirror_uv === !bone.mirror) {
							template.mirror = obj.mirror_uv
						}
						//Visible Bounds
						var mesh = obj.mesh
						if (mesh) {
							visible_box.expandByObject(mesh)
						}
						cubes.push(template)

					} else if (obj instanceof Locator) {

						locators[obj.name] = obj.position.slice();
						locators[obj.name][0] *= -1;
					}
				}
			}
			if (cubes.length) {
				bone.cubes = cubes
			}
			if (Object.keys(locators).length) {
				bone.locators = locators
			}
			bones.push(bone)
		})

		if (bones.length && options.visible_box !== false) {

			let visible_box = calculateVisibleBox();
			entitymodel.visible_bounds_width = visible_box[0] || 0;
			entitymodel.visible_bounds_height = visible_box[1] || 0;
			entitymodel.visible_bounds_offset = [0, visible_box[2] || 0, 0]
		}
		if (bones.length) {
			entitymodel.bones = bones
		}
		this.dispatchEvent('compile', {model: entitymodel, options});

		if (options.raw) {
			return entitymodel
		} else {
			var model_name = 'geometry.' + (Project.geometry_name||'unknown')
			return autoStringify({
				format_version: '1.10.0',
				[model_name]: entitymodel
			})
		}
	},
	parse(data, path) {
		pe_list_data.length = 0

		var geometries = []
		for (var key in data) {
			if (typeof data[key] === 'object') {
				geometries.push(key);
			}
		}
		if (geometries.length === 1) {
			parseGeometry({object: data[geometries[0]], name: geometries[0]})
			return;
		}

		$('#pe_search_bar').val('')
		if (pe_list && pe_list._data) {
			pe_list._data.search_term = ''
		}

		function create_thumbnail(model_entry, isize) {
			var included_bones = []
			model_entry.object.bones.forEach(function(b) {
				included_bones.push(b.name)
			})
			new Jimp(48, 48, 0x00000000, function(err, image) {
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
					search_term: '',
					list: pe_list_data
				},
				methods: {
					selectE: function(item, event) {
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
							return item.name.toUpperCase().includes(this.search_term)
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
	export() {
		var scope = this;
		Blockbench.export({
			resource_id: 'model',
			type: this.name,
			extensions: [this.extension],
			name: this.fileName(),
			startpath: this.startPath(),
			content: this.compile({raw: isApp}),
			custom_writer: isApp ? (a, path) => scope.overwrite(a, path, () => scope.afterSave(path)) : null,
		})
	},

	overwrite(content, path, cb) {

		var model_name = 'geometry.' + (Project.geometry_name.replace(/^geometry\./, '')||'unknown')
		var data;
		try {
			data = fs.readFileSync(path, 'utf-8')
		} catch (err) {}
		var obj = {
			format_version: '1.10.0'
		}
		if (data) {
			try {
				obj = autoParseJSON(data, false)
			} catch (err) {
				err = err+''
				var answer = electron.dialog.showMessageBoxSync(currentwindow, {
					type: 'warning',
					buttons: [
						tl('message.bedrock_overwrite_error.backup_overwrite'),
						tl('message.bedrock_overwrite_error.overwrite'),
						tl('dialog.cancel')
					],
					title: 'Blockbench',
					message: tl('message.bedrock_overwrite_error.message'),
					detail: err,
					noLink: false
				})
				if (answer === 0) {
					var backup_file_name = pathToName(path, true) + ' backup ' + new Date().toLocaleString().split(':').join('_')
					backup_file_name = path.replace(pathToName(path, false), backup_file_name)
					fs.writeFile(backup_file_name, data, function (err2) {
						if (err2) {
							console.log('Error saving backup model: ', err2)
						}
					}) 
				}
				if (answer === 2) {
					return;
				}
			}
			if (typeof obj === 'object') {
				for (var key in obj) {
					if (obj.hasOwnProperty(key) &&
						obj[key].bones &&
						typeof obj[key].bones === 'object' &&
						obj[key].bones.constructor.name === 'Array'
					) {
						obj[key].bones.forEach(function(bone) {
							if (typeof bone.cubes === 'object' &&
								bone.cubes.constructor.name === 'Array'
							) {
								bone.cubes.forEach(function(c, ci) {
									bone.cubes[ci] = new oneLiner(c)
								})
							}
						})
					}
				}
			}
		}
		obj[model_name] = this.compile({raw: true});
		content = autoStringify(obj);

		Blockbench.writeFile(path, {content}, cb);
	}
})

var format = new ModelFormat({
	id: 'bedrock_old',
	extension: 'json',
	icon: 'icon-format_bedrock_legacy',
	category: 'minecraft',
	show_on_start_screen: false,
	box_uv: true,
	single_texture: true,
	bone_rig: true,
	centered_grid: true,
	animated_textures: true,
	animation_files: true,
	animation_mode: true,
	locators: true,
	codec,
	onSetup(project) {
		if (isApp) {
			project.BedrockEntityManager = new BedrockEntityManager(project);
		}
	}
})
codec.format = format;

BARS.defineActions(function() {
	codec.export_action = new Action({
		id: 'export_entity',
		icon: format.icon,
		category: 'file',
		condition: () => Format == format,
		click: function () {
			codec.export()
		}
	})
})

})()

