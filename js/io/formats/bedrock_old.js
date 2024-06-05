(function() {

function parseGeometry(data) {
	let geometry_name = data.name.replace(/^geometry\./, '');

	let existing_tab = isApp && ModelProject.all.find(project => (
		Project !== project && project.export_path == Project.export_path && project.geometry_name == geometry_name
	))
	if (existing_tab) {
		Project.close().then(() =>  {
			existing_tab.select();
		});
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

	Canvas.updateAllBones()
	setProjectTitle()
	if (isApp && Project.geometry_name && Project.BedrockEntityManager) {
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
			if (g.type !== 'group' || g.export == false) return;
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
			var model_name = 'geometry.' + (Project.geometry_name||Project.name||'unknown')
			return autoStringify({
				format_version: '1.10.0',
				[model_name]: entitymodel
			})
		}
	},
	parse(data, path) {
		let geometries = [];
		for (let key in data) {
			if (typeof data[key] !== 'object') continue;
			geometries.push({
				name: key,
				object: data[key]
			});
		}
		if (geometries.length === 1) {
			parseGeometry(geometries[0]);
			return;
		} else if (isApp && BedrockEntityManager.CurrentContext?.geometry) {
			return parseGeometry(geometries.find(geo => geo.name == BedrockEntityManager.CurrentContext.geometry));
		}

		geometries.forEach(geo => {
			geo.uuid = guid();

			geo.bonecount = 0;
			geo.cubecount = 0;
			if (geo.object.bones instanceof Array) {
				geo.object.bones.forEach(bone => {
					geo.bonecount++;
					if (bone.cubes instanceof Array) geo.cubecount += bone.cubes.length;
				})
			}
		})

		let selected = null;
		new Dialog({
			id: 'bedrock_model_select',
			title: 'dialog.select_model.title',
			buttons: ['Import', 'dialog.cancel'],
			component: {
				data() {return {
					search_term: '',
					geometries,
					selected: null,
				}},
				computed: {
					filtered_geometries() {
						if (!this.search_term) return this.geometries;
						let term = this.search_term.toLowerCase();
						return this.geometries.filter(geo => {
							return geo.name.toLowerCase().includes(term)
						})
					}
				},
				methods: {
					selectGeometry(geo) {
						this.selected = selected = geo;
					},
					open(geo) {
						Dialog.open.hide();
						parseGeometry(geo);
					},
					tl
				},
				template: `
					<div>
						<search-bar v-model="search_term"></search-bar>
						<ul class="list" id="model_select_list">
							<li v-for="geometry in filtered_geometries" :key="geometry.uuid" :class="{selected: geometry == selected}" @click="selectGeometry(geometry)" @dblclick="open(geometry)">
								<p>{{ geometry.name }}</p>
								<label>{{ geometry.bonecount+' ${tl('dialog.select_model.bones')}' }}, {{ geometry.cubecount+' ${tl('dialog.select_model.cubes')}' }}</label>
							</li>
						</ul>
					</div>
				`
			},
			onConfirm() {
				parseGeometry(selected);
			}
		}).show();
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
	animation_controllers: true,
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

