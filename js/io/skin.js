(function() {

const skin_presets = {};

const codec = new Codec('skin_model', {
	name: 'Skin Model',
	remember: false,
	compile(options) {
		if (options === undefined) options = 0;
		var entitymodel = {
			name: Project.geometry_name.split('.')[0]
		}
		entitymodel.texturewidth = Project.texture_width;
		entitymodel.textureheight = Project.texture_height;
		var bones = []
		var cube_count = 0;

		var groups = getAllGroups();

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
				bone.rotation = [
					-g.rotation[0],
					-g.rotation[1],
					g.rotation[2]
				]
			}
			if (g.reset) bone.reset = true;
			if (g.mirror_uv) bone.mirror = true;

			//Elements
			var cubes = []
			for (var obj of g.children) {
				if (obj.export) {
					if (obj instanceof Cube) {

						var cube = new oneLiner()
						cube.name = obj.name;
						if (obj.visibility == false) cube.visibility = false;
						cube.origin = obj.from.slice()
						cube.size = obj.size()
						cube.origin[0] = -(cube.origin[0] + cube.size[0])
						cube.uv = obj.uv_offset
						if (obj.inflate && typeof obj.inflate === 'number') {
							cube.inflate = obj.inflate
						}
						if (obj.mirror_uv === !bone.mirror) {
							cube.mirror = obj.mirror_uv
						}
						cubes.push(cube)
						cube_count++;

					}
				}
			}
			if (cubes.length) {
				bone.cubes = cubes
			}
			bones.push(bone)
		})

		if (bones.length) {
			entitymodel.bones = bones
		}
		return entitymodel
	},
	parse(data, resolution, texture_path) {
		Project.geometry_name = data.name;
		Project.texture_width = data.texturewidth || 64;
		Project.texture_height = data.textureheight || 64;

		var bones = {}

		if (data.bones) {
			var included_bones = []
			data.bones.forEach(function(b) {
				included_bones.push(b.name)
			})
			data.bones.forEach(function(b, bi) {
				var group = new Group({
					name: b.name,
					origin: b.pivot,
					rotation: b.rotation
				}).init()
				group.isOpen = true;
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
						var base_cube = new Cube({name: s.name, visibility: s.visibility, autouv: 0, color: b.color})
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
						var coords = b.locators[key];
						coords[0] *= -1
						var locator = new Locator({from: coords, name: key}).addTo(group).init();
					}
				}
				var parent_group = 'root';
				if (b.parent) {
					if (bones[b.parent]) {
						parent_group = bones[b.parent]
					} else {
						data.bones.forEach(function(ib) {
							if (ib.name === b.parent) {
								ib.children && ib.children.length ? ib.children.push(group) : ib.children = [group]
							}
						})
					}
				}
				group.addTo(parent_group)
			})
		}
		if (texture_path) {
			var texture = new Texture().fromPath(texture_path).add(false);
		} else {
			var texture = generateTemplate(Project.texture_width*resolution, Project.texture_height*resolution, data.name, data.eyes)
		}
		texture.load_callback = function() {
			Modes.options.paint.select();
		}
		loadTextureDraggable()
		Canvas.updateAllBones()
		setProjectTitle()
		if (isApp && Project.geometry_name) {
			BedrockEntityManager.initEntity()
		}
		updateSelection()
		EditSession.initNewModel()
	},
})



const format = new ModelFormat({
	id: 'skin',
	icon: 'icon-player',
	bone_rig: true,
	box_uv: true,
	centered_grid: true,
	single_texture: true,
	integer_size: true,
	codec,
	onActivation() {
		Modes.options.paint.select();
	}
})
format.new = function() {
	if (newProject(this)) {
		skin_dialog.show();
		return true;
	}
}

function generateTemplate(width = 64, height = 64, name = 'name', eyes) {

	var texture = new Texture({
		mode: 'bitmap',
		name: name+'.png'
	})

	var canvas = document.createElement('canvas')
	canvas.width = width;
	canvas.height = height;

	Cube.all.forEach(cube => {
		TextureGenerator.paintCubeBoxTemplate(cube, texture, canvas);
	})
	if (eyes) {
		var res_multiple = canvas.width/Project.texture_width;
		var ctx = canvas.getContext('2d');
		ctx.fillStyle = '#cdefff';
		eyes.forEach(eye => {
			ctx.fillRect(
				eye[0]*res_multiple,
				eye[1]*res_multiple,
				(eye[2]||2)*res_multiple,
				(eye[3]||2)*res_multiple
			)
		})
	}
	var dataUrl = canvas.toDataURL();
	texture.fromDataURL(dataUrl).add(false);
	return texture;
}

const skin_dialog = new Dialog({
	title: tl('dialog.skin.title'),
	id: 'image_editor',
	form: {
		model: {
			label: 'dialog.skin.model',
			type: 'select',
			default: Format.id,
			options: {
				steve: 'Steve',
				alex: 'Alex',
				armor_stand: 'Armor Stand',
				bat: 'Bat',
				bee: 'Bee',
				boat: 'Boat',
				cat: 'Cat',
				chicken: 'Chicken',
				cod: 'Cod',
				cow: 'Cow',
				creeper: 'Creeper',
				dolphin: 'Dolphin',
				enderdragon: 'Ender Dragon',
				enderman: 'Enderman',
				endermite: 'Endermite',
				evoker: 'Evoker',
				fox_bedrock: 'Fox (Bedrock)',
				fox_java: 'Fox (Java)',
				ghast: 'Ghast',
				guardian: 'Guardian',
				horse: 'Horse',
				llama: 'Llama',
				lavaslime: 'Lava Slime',
				irongolem: 'Iron Golem',
				minecart: 'Minecart',
				panda: 'Panda',
				parrot: 'Parrot',
				phantom: 'Phantom',
				pig: 'Pig',
				pillager: 'Pillager',
				polarbear: 'Polarbear',
				pufferfish: 'Pufferfish',
				rabbit: 'Rabbit',
				ravager: 'Ravager',
				salmon: 'Salmon',
				sheep: 'Sheep',
				shield: 'Shield',
				shulker: 'Shulker',
				shulker_bullet: 'Shulker Bullet',
				silverfish: 'Silverfish',
				skeleton: 'Skeleton',
				slime: 'Slime',
				snowgolem: 'Snowgolem',
				spider: 'Spider',
				squid: 'Squid',
				tropicalfish_a: 'Tropicalfish A',
				tropicalfish_b: 'Tropicalfish B',
				turtle: 'Turtle',
				vex: 'Vex',
				villager: 'Villager 1',
				villager_v2: 'Villager 2',
				vindicator: 'Vindicator',
				witch: 'Witch',
				witherBoss: 'Wither',
				wolf: 'Wolf',
				zombie: 'Zombie',
				zombie_villager_1: 'Zombie Villager 1',
				zombie_villager_2: 'Zombie Villager 2',
			}
		},
		resolution: {label: 'dialog.create_texture.resolution', type: 'select', value: 16, options: {
			16: '16x',
			32: '32x',
			64: '64x',
			128: '128x',
		}},
		texture: {
			label: 'dialog.skin.texture',
			type: 'file',
			extensions: ['png'],
			filetype: 'PNG',
		}
	},
	draggable: true,
	onConfirm(result) {
		if (newProject(format)) {
			var model = JSON.parse(skin_presets[result.model]);
			codec.parse(model, result.resolution/16, result.texture);
		}
		this.hide();
	},
	onCancel() {
		this.hide();
		Format = 0;
		Modes.options.start.select();
	}
});


BARS.defineActions(function() {
	new Action('toggle_skin_layer', {
		icon: 'layers_clear',
		category: 'edit',
		condition: () => Format.id == 'skin',
		click: function () {
			var edited = [];
			Cube.all.forEach(cube => {
				if (cube.name.toLowerCase().includes('layer')) {
					edited.push(cube);
				}
			})
			if (!edited.length) return;
			Undo.initEdit({elements: edited});
			value = !edited[0].visibility;
			edited.forEach(cube => {
				cube.visibility = value;
			})
			Undo.finishEdit('toggle skin layer');
			Canvas.updateVisibility()
		}
	})
})

skin_presets.steve = `{
	"name": "steve",
	"texturewidth": 64,
	"textureheight": 64,
	"eyes": [
		[9, 11],
		[13, 11]
	],
	"bones": [
		{
			"name": "Head",
			"color": 1,
			"pivot": [0, 24, 0],
			"rotation": [-6, 5, 0],
			"cubes": [
				{"name": "Head", "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]},
				{"name": "Hat Layer", "visibility": false, "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0], "inflate": 0.5}
			]
		},
		{
			"name": "Body",
			"color": 3,
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "Body", "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]},
				{"name": "Body Layer", "visibility": false, "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 32], "inflate": 0.25}
			]
		},
		{
			"name": "Right Arm",
			"color": 5,
			"pivot": [-5, 22, 0],
			"rotation": [-10, 0, 0],
			"cubes": [
				{"name": "Right Arm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]},
				{"name": "Right Arm Layer", "visibility": false, "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 32], "inflate": 0.25}
			]
		},
		{
			"name": "Left Arm",
			"color": 0,
			"pivot": [5, 22, 0],
			"rotation": [12, 0, 0],
			"cubes": [
				{"name": "Left Arm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [32, 48]},
				{"name": "Left Arm Layer", "visibility": false, "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [48, 48], "inflate": 0.25}
			]
		},
		{
			"name": "Right Leg",
			"color": 6,
			"pivot": [-1.9, 12, 0],
			"rotation": [11, 0, 2],
			"cubes": [
				{"name": "Right Leg", "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]},
				{"name": "Right Leg Layer", "visibility": false, "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 32], "inflate": 0.25}
			]
		},
		{
			"name": "Left Leg",
			"color": 7,
			"pivot": [1.9, 12, 0],
			"rotation": [-10, 0, -2],
			"cubes": [
				{"name": "Left Leg", "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [16, 48]},
				{"name": "Left Leg Layer", "visibility": false, "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [0, 48], "inflate": 0.25}
			]
		}
	]
}`;
skin_presets.alex = `{
	"name": "alex",
	"texturewidth": 64,
	"textureheight": 64,
	"eyes": [
		[9, 11],
		[13, 11]
	],
	"bones": [
		{
			"name": "Head",
			"color": 1,
			"pivot": [0, 24, 0],
			"rotation": [-6, 5, 0],
			"cubes": [
				{"name": "Head", "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]},
				{"name": "Hat Layer", "visibility": false, "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0], "inflate": 0.5}
			]
		},
		{
			"name": "Body",
			"color": 3,
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "Body", "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]},
				{"name": "Body Layer", "visibility": false, "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 32], "inflate": 0.25}
			]
		},
		{
			"name": "Right Arm",
			"color": 5,
			"pivot": [-5, 22, 0],
			"rotation": [-10, 0, 0],
			"cubes": [
				{"name": "Right Arm", "origin": [-7, 12, -2], "size": [3, 12, 4], "uv": [40, 16]},
				{"name": "Right Arm Layer", "visibility": false, "origin": [-7, 12, -2], "size": [3, 12, 4], "uv": [40, 32], "inflate": 0.25}
			]
		},
		{
			"name": "Left Arm",
			"color": 0,
			"pivot": [5, 22, 0],
			"rotation": [12, 0, 0],
			"cubes": [
				{"name": "Left Arm", "origin": [4, 12, -2], "size": [3, 12, 4], "uv": [32, 48]},
				{"name": "Left Arm Layer", "visibility": false, "origin": [4, 12, -2], "size": [3, 12, 4], "uv": [48, 48], "inflate": 0.25}
			]
		},
		{
			"name": "Right Leg",
			"color": 6,
			"pivot": [-1.9, 12, 0],
			"rotation": [11, 0, 2],
			"cubes": [
				{"name": "Right Leg", "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]},
				{"name": "Right Leg Layer", "visibility": false, "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 32], "inflate": 0.25}
			]
		},
		{
			"name": "Left Leg",
			"color": 7,
			"pivot": [1.9, 12, 0],
			"rotation": [-10, 0, -2],
			"cubes": [
				{"name": "Left Leg", "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [16, 48]},
				{"name": "Left Leg Layer", "visibility": false, "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [0, 48], "inflate": 0.25}
			]
		}
	]
}`;
skin_presets.armor_stand = `{
	"name": "armor_stand",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "baseplate",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "baseplate", "origin": [-6, 0, -6], "size": [12, 1, 12], "uv": [0, 32]}
			]
		},
		{
			"name": "waist",
			"parent": "baseplate",
			"pivot": [0, 12, 0]
		},
		{
			"name": "body",
			"parent": "waist",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "body", "origin": [-6, 21, -1.5], "size": [12, 3, 3], "uv": [0, 26]},
				{"name": "body", "origin": [-3, 14, -1], "size": [2, 7, 2], "uv": [16, 0]},
				{"name": "body", "origin": [1, 14, -1], "size": [2, 7, 2], "uv": [48, 16]},
				{"name": "body", "origin": [-4, 12, -1], "size": [8, 2, 2], "uv": [0, 48]}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "head", "origin": [-1, 24, -1], "size": [2, 7, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "hat",
			"parent": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "hat", "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0]}
			]
		},
		{
			"name": "leftarm",
			"parent": "body",
			"pivot": [5, 22, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftarm", "origin": [5, 12, -1], "size": [2, 12, 2], "uv": [32, 16]}
			]
		},
		{
			"name": "leftitem",
			"parent": "leftarm",
			"pivot": [6, 15, 1]
		},
		{
			"name": "leftleg",
			"parent": "body",
			"pivot": [1.9, 12, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftleg", "origin": [0.9, 1, -1], "size": [2, 11, 2], "uv": [40, 16]}
			]
		},
		{
			"name": "rightarm",
			"parent": "body",
			"pivot": [-5, 22, 0],
			"cubes": [
				{"name": "rightarm", "origin": [-7, 12, -1], "size": [2, 12, 2], "uv": [24, 0]}
			]
		},
		{
			"name": "rightitem",
			"parent": "rightarm",
			"pivot": [-6, 15, 1]
		},
		{
			"name": "rightleg",
			"parent": "body",
			"pivot": [-1.9, 12, 0],
			"cubes": [
				{"name": "rightleg", "origin": [-2.9, 1, -1], "size": [2, 11, 2], "uv": [8, 0]}
			]
		}
	]
}`;
skin_presets.bat = `{
	"name": "bat",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "head", "origin": [-3, 21, -3], "size": [6, 6, 6], "uv": [0, 0]}
			]
		},
		{
			"name": "rightEar",
			"parent": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "rightEar", "origin": [-4, 26, -2], "size": [3, 4, 1], "uv": [24, 0]}
			]
		},
		{
			"name": "leftEar",
			"parent": "head",
			"pivot": [0, 24, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftEar", "origin": [1, 26, -2], "size": [3, 4, 1], "uv": [24, 0]}
			]
		},
		{
			"name": "body",
			"pivot": [0, 24, 0],
			"rotation": [30, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-3, 8, -3], "size": [6, 12, 6], "uv": [0, 16]},
				{"name": "body", "origin": [-5, -8, 0], "size": [10, 16, 1], "uv": [0, 34]}
			]
		},
		{
			"name": "rightWing",
			"parent": "body",
			"pivot": [0, 24, 0],
			"rotation": [0, -10, 0],
			"cubes": [
				{"name": "rightWing", "origin": [-12, 7, 1.5], "size": [10, 16, 1], "uv": [42, 0]}
			]
		},
		{
			"name": "rightWingTip",
			"parent": "rightWing",
			"pivot": [-12, 23, 1.5],
			"rotation": [0, -15, 0],
			"cubes": [
				{"name": "rightWingTip", "origin": [-20, 10, 1.5], "size": [8, 12, 1], "uv": [24, 16]}
			]
		},
		{
			"name": "leftWing",
			"parent": "body",
			"pivot": [0, 24, 0],
			"rotation": [0, 10, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftWing", "origin": [2, 7, 1.5], "size": [10, 16, 1], "uv": [42, 0]}
			]
		},
		{
			"name": "leftWingTip",
			"parent": "leftWing",
			"pivot": [12, 23, 1.5],
			"rotation": [0, 15, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftWingTip", "origin": [12, 10, 1.5], "size": [8, 12, 1], "uv": [24, 16]}
			]
		}
	]
}`;
skin_presets.bee = `{
	"name": "bee",
	"texturewidth": 64,
	"textureheight": 64,
	"eyes": [
		[10, 13, 2, 3],
		[15, 13, 2, 3]
	],
	"bones": [
		{
			"name": "body",
			"pivot": [0.5, 5, 0],
			"cubes": [
				{"name": "body", "origin": [-3, 2, -5], "size": [7, 7, 10], "uv": [0, 0]},
				{"name": "body", "origin": [-2, 7, -8], "size": [1, 2, 3], "uv": [2, 3]},
				{"name": "body", "origin": [2, 7, -8], "size": [1, 2, 3], "uv": [2, 0]}
			]
		},
		{
			"name": "stinger",
			"parent": "body",
			"pivot": [0.5, 6, 1],
			"cubes": [
				{"name": "stinger", "origin": [0.5, 5, 5], "size": [0, 1, 2], "uv": [26, 7]}
			]
		},
		{
			"name": "rightwing_bone",
			"parent": "body",
			"pivot": [-1, 9, -3],
			"rotation": [15, -15, 0],
			"cubes": [
				{"name": "rightwing_bone", "origin": [-10, 9, -3], "size": [9, 0, 6], "uv": [0, 18]}
			]
		},
		{
			"name": "leftwing_bone",
			"parent": "body",
			"pivot": [2, 9, -3],
			"rotation": [15, 15, 0],
			"cubes": [
				{"name": "leftwing_bone", "origin": [2, 9, -3], "size": [9, 0, 6], "uv": [9, 24]}
			]
		},
		{
			"name": "leg_front",
			"parent": "body",
			"pivot": [2, 2, -2],
			"cubes": [
				{"name": "leg_front", "origin": [-3, 0, -2], "size": [7, 2, 0], "uv": [26, 1]}
			]
		},
		{
			"name": "leg_mid",
			"parent": "body",
			"pivot": [2, 2, 0],
			"cubes": [
				{"name": "leg_mid", "origin": [-3, 0, 0], "size": [7, 2, 0], "uv": [26, 3]}
			]
		},
		{
			"name": "leg_back",
			"parent": "body",
			"pivot": [2, 2, 2],
			"cubes": [
				{"name": "leg_back", "origin": [-3, 0, 2], "size": [7, 2, 0], "uv": [26, 5]}
			]
		}
	]
}`;
skin_presets.boat = `{
	"name": "boat",
	"texturewidth": 128,
	"textureheight": 64,
	"bones": [
		{
			"name": "bottom",
			"pivot": [0, 18, 0],
			"rotation": [90, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "bottom", "origin": [-14, 10, 0], "size": [28, 16, 3], "uv": [0, 0]}
			]
		},
		{
			"name": "front",
			"pivot": [15, 24, 0],
			"rotation": [0, 90, 0],
			"mirror": true,
			"cubes": [
				{"name": "front", "origin": [7, 21, -1], "size": [16, 6, 2], "uv": [0, 27]}
			]
		},
		{
			"name": "back",
			"pivot": [-15, 24, 0],
			"rotation": [0, -90, 0],
			"mirror": true,
			"cubes": [
				{"name": "back", "origin": [-24, 21, -1], "size": [18, 6, 2], "uv": [0, 19]}
			]
		},
		{
			"name": "right",
			"pivot": [0, 24, -9],
			"rotation": [0, -180, 0],
			"mirror": true,
			"cubes": [
				{"name": "right", "origin": [-14, 21, -10], "size": [28, 6, 2], "uv": [0, 35]}
			]
		},
		{
			"name": "left",
			"pivot": [0, 24, 9],
			"mirror": true,
			"cubes": [
				{"name": "left", "origin": [-14, 21, 8], "size": [28, 6, 2], "uv": [0, 43]}
			]
		},
		{
			"name": "paddle_left",
			"pivot": [-2.5, 28, 9],
			"rotation": [-30, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "paddle_left", "origin": [-3.5, 27, 3.5], "size": [2, 2, 18], "uv": [62, 0]},
				{"name": "paddle_left", "origin": [-2.51, 26, 17.5], "size": [1, 6, 7], "uv": [62, 0]}
			]
		},
		{
			"name": "paddle_right",
			"pivot": [-2.5, 28, -9],
			"rotation": [-30, 180, 0],
			"mirror": true,
			"cubes": [
				{"name": "paddle_right", "origin": [-3.5, 27, -14.5], "size": [2, 2, 18], "uv": [62, 20]},
				{"name": "paddle_right", "origin": [-3.49, 26, -0.5], "size": [1, 6, 7], "uv": [62, 20]}
			]
		}
	]
}`;
skin_presets.cat = `{
	"name": "cat",
	"texturewidth": 64,
	"textureheight": 32,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 7, 1]
		},
		{
			"name": "belly",
			"parent": "body",
			"pivot": [0, 7, 1],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-2, -1, -2], "size": [4, 16, 6], "uv": [20, 0]}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 9, -9],
			"cubes": [
				{"name": "head", "origin": [-2.5, 7, -12], "size": [5, 4, 5], "uv": [0, 0]},
				{"name": "head", "origin": [-1.5, 7.01562, -13], "size": [3, 2, 2], "uv": [0, 24]},
				{"name": "head", "origin": [-2, 11, -9], "size": [1, 1, 2], "uv": [0, 10]},
				{"name": "head", "origin": [1, 11, -9], "size": [1, 1, 2], "uv": [6, 10]}
			]
		},
		{
			"name": "tail1",
			"parent": "body",
			"pivot": [0, 9, 8],
			"rotation": [45, 0, 0],
			"cubes": [
				{"name": "tail1", "origin": [-0.5, 1, 8], "size": [1, 8, 1], "uv": [0, 15]}
			]
		},
		{
			"name": "tail2",
			"parent": "tail1",
			"pivot": [0, 1, 8],
			"rotation": [45, 0, 0],
			"cubes": [
				{"name": "tail2", "origin": [-0.5, -7, 8], "size": [1, 8, 1], "uv": [4, 15]}
			]
		},
		{
			"name": "backLegL",
			"parent": "body",
			"pivot": [1.1, 6, 7],
			"cubes": [
				{"name": "backLegL", "origin": [0.1, 0, 6], "size": [2, 6, 2], "uv": [8, 13]}
			]
		},
		{
			"name": "backLegR",
			"parent": "body",
			"pivot": [-1.1, 6, 7],
			"cubes": [
				{"name": "backLegR", "origin": [-2.1, 0, 6], "size": [2, 6, 2], "uv": [8, 13]}
			]
		},
		{
			"name": "frontLegL",
			"parent": "body",
			"pivot": [1.2, 10, -4],
			"cubes": [
				{"name": "frontLegL", "origin": [0.2, 0.2, -5], "size": [2, 10, 2], "uv": [40, 0]}
			]
		},
		{
			"name": "frontLegR",
			"parent": "body",
			"pivot": [-1.2, 10, -4],
			"cubes": [
				{"name": "frontLegR", "origin": [-2.2, 0.2, -5], "size": [2, 10, 2], "uv": [40, 0]}
			]
		}
	]
}`;
skin_presets.chicken = `{
	"name": "chicken",
	"texturewidth": 64,
	"textureheight": 32,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 8, 0],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-3, 4, -3], "size": [6, 8, 6], "uv": [0, 9]}
			]
		},
		{
			"name": "head",
			"pivot": [0, 9, -4],
			"cubes": [
				{"name": "head", "origin": [-2, 9, -6], "size": [4, 6, 3], "uv": [0, 0]}
			]
		},
		{
			"name": "comb",
			"parent": "head",
			"pivot": [0, 9, -4],
			"cubes": [
				{"name": "comb", "origin": [-1, 9, -7], "size": [2, 2, 2], "uv": [14, 4]}
			]
		},
		{
			"name": "beak",
			"parent": "head",
			"pivot": [0, 9, -4],
			"cubes": [
				{"name": "beak", "origin": [-2, 11, -8], "size": [4, 2, 2], "uv": [14, 0]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-2, 5, 1],
			"cubes": [
				{"name": "leg0", "origin": [-3, 0, -2], "size": [3, 5, 3], "uv": [26, 0]}
			]
		},
		{
			"name": "leg1",
			"pivot": [1, 5, 1],
			"cubes": [
				{"name": "leg1", "origin": [0, 0, -2], "size": [3, 5, 3], "uv": [26, 0]}
			]
		},
		{
			"name": "wing0",
			"pivot": [-3, 11, 0],
			"cubes": [
				{"name": "wing0", "origin": [-4, 7, -3], "size": [1, 4, 6], "uv": [24, 13]}
			]
		},
		{
			"name": "wing1",
			"pivot": [3, 11, 0],
			"cubes": [
				{"name": "wing1", "origin": [3, 7, -3], "size": [1, 4, 6], "uv": [24, 13]}
			]
		}
	]
}`;
skin_presets.cod = `{
	"name": "cod",
	"texturewidth": 32,
	"textureheight": 32,
	"eyes": [
		[7, 9],
		[11, 9]
	],
	"bones": [
		{
			"name": "body",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-1, 0, 1], "size": [2, 4, 7], "uv": [0, 0]},
				{"name": "body", "origin": [0, 4, 0], "size": [0, 1, 6], "uv": [20, -6]},
				{"name": "body", "origin": [0, -1, 3], "size": [0, 1, 2], "uv": [22, -1]}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 2, 0],
			"cubes": [
				{"name": "head", "origin": [-0.9992, 1.0008, -3], "size": [2, 3, 1], "uv": [0, 0]},
				{"name": "head", "origin": [-1, 0, -2], "size": [2, 4, 3], "uv": [11, 0]}
			]
		},
		{
			"name": "leftFin",
			"parent": "body",
			"pivot": [1, 1, 0],
			"rotation": [0, 0, 35],
			"cubes": [
				{"name": "leftFin", "origin": [1, 0, 0], "size": [2, 1, 2], "uv": [24, 4]}
			]
		},
		{
			"name": "rightFin",
			"parent": "body",
			"pivot": [-1, 1, 0],
			"rotation": [0, 0, -35],
			"cubes": [
				{"name": "rightFin", "origin": [-3, 0, 0], "size": [2, 1, 2], "uv": [24, 1]}
			]
		},
		{
			"name": "tailfin",
			"parent": "body",
			"pivot": [0, 0, 8],
			"cubes": [
				{"name": "tailfin", "origin": [0, 0, 8], "size": [0, 4, 6], "uv": [20, 1]}
			]
		},
		{
			"name": "waist",
			"parent": "body",
			"pivot": [0, 0, 0]
		}
	]
}`;
skin_presets.cow = `{
	"name": "cow",
	"texturewidth": 64,
	"textureheight": 32,
	"eyes": [
		[7, 9],
		[11, 9]
	],
	"bones": [
		{
			"name": "body",
			"pivot": [0, 19, 2],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-6, 11, -5], "size": [12, 18, 10], "uv": [18, 4]},
				{"name": "body", "origin": [-2, 11, -6], "size": [4, 6, 1], "uv": [52, 0]}
			]
		},
		{
			"name": "head",
			"pivot": [0, 20, -8],
			"cubes": [
				{"name": "head", "origin": [-4, 16, -14], "size": [8, 8, 6], "uv": [0, 0]},
				{"name": "head", "origin": [-5, 22, -12], "size": [1, 3, 1], "uv": [22, 0]},
				{"name": "head", "origin": [4, 22, -12], "size": [1, 3, 1], "uv": [22, 0]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-4, 12, 7],
			"cubes": [
				{"name": "leg0", "origin": [-6, 0, 5], "size": [4, 12, 4], "uv": [0, 16]}
			]
		},
		{
			"name": "leg1",
			"pivot": [4, 12, 7],
			"mirror": true,
			"cubes": [
				{"name": "leg1", "origin": [2, 0, 5], "size": [4, 12, 4], "uv": [0, 16]}
			]
		},
		{
			"name": "leg2",
			"pivot": [-4, 12, -6],
			"cubes": [
				{"name": "leg2", "origin": [-6, 0, -7], "size": [4, 12, 4], "uv": [0, 16]}
			]
		},
		{
			"name": "leg3",
			"pivot": [4, 12, -6],
			"mirror": true,
			"cubes": [
				{"name": "leg3", "origin": [2, 0, -7], "size": [4, 12, 4], "uv": [0, 16]}
			]
		}
	]
}`;
skin_presets.creeper = `{
	"name": "alex",
	"texturewidth": 64,
	"textureheight": 32,
	"eyes": [
		[9, 10],
		[13, 10]
	],
	"bones": [
		{
			"name": "body",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 6, -2], "size": [8, 12, 4], "uv": [16, 16]}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 18, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 18, -4], "size": [8, 8, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "leg0",
			"parent": "body",
			"pivot": [-2, 6, 4],
			"cubes": [
				{"name": "leg0", "origin": [-4, 0, 2], "size": [4, 6, 4], "uv": [0, 16]}
			]
		},
		{
			"name": "leg1",
			"parent": "body",
			"pivot": [2, 6, 4],
			"cubes": [
				{"name": "leg1", "origin": [0, 0, 2], "size": [4, 6, 4], "uv": [0, 16]}
			]
		},
		{
			"name": "leg2",
			"parent": "body",
			"pivot": [-2, 6, -4],
			"cubes": [
				{"name": "leg2", "origin": [-4, 0, -6], "size": [4, 6, 4], "uv": [0, 16]}
			]
		},
		{
			"name": "leg3",
			"parent": "body",
			"pivot": [2, 6, -4],
			"cubes": [
				{"name": "leg3", "origin": [0, 0, -6], "size": [4, 6, 4], "uv": [0, 16]}
			]
		}
	]
}`;
skin_presets.dolphin = `{
	"name": "dolphin",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 0, -3],
			"cubes": [
				{"name": "body", "origin": [-4, 0, -3], "size": [8, 7, 13], "uv": [0, 13]}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 0, -3],
			"cubes": [
				{"name": "head", "origin": [-4, 0, -9], "size": [8, 7, 6], "uv": [0, 0]}
			]
		},
		{
			"name": "nose",
			"parent": "head",
			"pivot": [0, 0, -13],
			"cubes": [
				{"name": "nose", "origin": [-1, 0, -13], "size": [2, 2, 4], "uv": [0, 13]}
			]
		},
		{
			"name": "tail",
			"parent": "body",
			"pivot": [0, 2.5, 11],
			"cubes": [
				{"name": "tail", "origin": [-2, 0, 10], "size": [4, 5, 11], "uv": [0, 33]}
			]
		},
		{
			"name": "tail_fin",
			"parent": "tail",
			"pivot": [0, 2.5, 20],
			"cubes": [
				{"name": "tail_fin", "origin": [-5, 2, 19], "size": [10, 1, 6], "uv": [0, 49]}
			]
		},
		{
			"name": "back_fin",
			"parent": "body",
			"pivot": [0, 7, 2],
			"rotation": [-30, 0, 0],
			"cubes": [
				{"name": "back_fin", "origin": [-0.5, 6.25, 1], "size": [1, 5, 4], "uv": [29, 0]}
			]
		},
		{
			"name": "left_fin",
			"parent": "body",
			"pivot": [3, 1, -1],
			"rotation": [0, -25, 20],
			"cubes": [
				{"name": "left_fin", "origin": [3, 1, -2.5], "size": [8, 1, 4], "uv": [40, 0]}
			]
		},
		{
			"name": "right_fin",
			"parent": "body",
			"pivot": [-3, 1, -1],
			"rotation": [0, 25, -20],
			"cubes": [
				{"name": "right_fin", "origin": [-11, 1, -2.5], "size": [8, 1, 4], "uv": [40, 6]}
			]
		}
	]
}`;
skin_presets.enderdragon = `{
	"name": "enderdragon",
	"texturewidth": 256,
	"textureheight": 256,
	"bones": [
		{
			"name": "neck",
			"pivot": [0, 7, -8],
			"rotation": [-5, 0, 0],
			"cubes": [
				{"name": "neck", "origin": [-5, 2, -18], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "neck", "origin": [-1, 12, -16], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "neck2",
			"parent": "neck",
			"pivot": [0, 7, -18],
			"rotation": [5, 0, 0],
			"cubes": [
				{"name": "neck", "origin": [-5, 2, -28], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "neck", "origin": [-1, 12, -26], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "neck3",
			"parent": "neck2",
			"pivot": [0, 7, -28],
			"rotation": [5, 0, 0],
			"cubes": [
				{"name": "neck", "origin": [-5, 2, -38], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "neck", "origin": [-1, 12, -36], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "neck4",
			"parent": "neck3",
			"pivot": [0, 7, -38],
			"rotation": [5, 0, 0],
			"cubes": [
				{"name": "neck", "origin": [-5, 2, -48], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "neck", "origin": [-1, 12, -46], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "neck5",
			"parent": "neck4",
			"pivot": [0, 7, -48],
			"rotation": [5, 0, 0],
			"cubes": [
				{"name": "neck", "origin": [-5, 2, -58], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "neck", "origin": [-1, 12, -56], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "head",
			"parent": "neck5",
			"pivot": [0, 7, -58],
			"rotation": [5, 0, 0],
			"cubes": [
				{"name": "head", "origin": [-6, 3, -88], "size": [12, 5, 16], "uv": [176, 44]},
				{"name": "head", "origin": [-8, -1, -74], "size": [16, 16, 16], "uv": [112, 30]},
				{"name": "head", "origin": [-5, 15, -68], "size": [2, 4, 6], "uv": [0, 0], "mirror": true},
				{"name": "head", "origin": [-5, 8, -86], "size": [2, 2, 4], "uv": [112, 0], "mirror": true},
				{"name": "head", "origin": [3, 15, -68], "size": [2, 4, 6], "uv": [0, 0]},
				{"name": "head", "origin": [3, 8, -86], "size": [2, 2, 4], "uv": [112, 0]}
			]
		},
		{
			"name": "jaw",
			"parent": "head",
			"pivot": [0, 3, -71],
			"rotation": [15, 0, 0],
			"cubes": [
				{"name": "jaw", "origin": [-6, -1, -88], "size": [12, 4, 16], "uv": [176, 65]}
			]
		},
		{
			"name": "body",
			"pivot": [0, 20, 8],
			"cubes": [
				{"name": "body", "origin": [-12, -4, -8], "size": [24, 24, 64], "uv": [0, 0]},
				{"name": "body", "origin": [-1, 20, -2], "size": [2, 6, 12], "uv": [220, 53]},
				{"name": "body", "origin": [-1, 20, 18], "size": [2, 6, 12], "uv": [220, 53]},
				{"name": "body", "origin": [-1, 20, 38], "size": [2, 6, 12], "uv": [220, 53]}
			]
		},
		{
			"name": "wing",
			"pivot": [-12, 19, 2],
			"rotation": [0, 10, 10],
			"cubes": [
				{"name": "wing", "origin": [-68, 15, -2], "size": [56, 8, 8], "uv": [112, 88]},
				{"name": "wing", "origin": [-68, 19, 4], "size": [56, 0, 56], "uv": [-56, 88]}
			]
		},
		{
			"name": "wingtip",
			"parent": "wing",
			"pivot": [-68, 19, 0],
			"rotation": [0, 0, -20],
			"cubes": [
				{"name": "wingtip", "origin": [-124, 17, 0], "size": [56, 4, 4], "uv": [112, 136]},
				{"name": "wingtip", "origin": [-124, 19, 4], "size": [56, 0, 56], "uv": [-56, 144]}
			]
		},
		{
			"name": "wing1",
			"pivot": [12, 19, 2],
			"rotation": [0, -10, -10],
			"mirror": true,
			"cubes": [
				{"name": "wing1", "origin": [12, 15, -2], "size": [56, 8, 8], "uv": [112, 88]},
				{"name": "wing1", "origin": [12, 19, 4], "size": [56, 0, 56], "uv": [-56, 88]}
			]
		},
		{
			"name": "wingtip1",
			"parent": "wing1",
			"pivot": [68, 19, 0],
			"rotation": [0, 0, 20],
			"mirror": true,
			"cubes": [
				{"name": "wingtip1", "origin": [68, 17, 0], "size": [56, 4, 4], "uv": [112, 136]},
				{"name": "wingtip1", "origin": [68, 19, 4], "size": [56, 0, 56], "uv": [-56, 144]}
			]
		},
		{
			"name": "rearleg",
			"pivot": [-16, 8, 42],
			"rotation": [60, 0, 0],
			"cubes": [
				{"name": "rearleg", "origin": [-24, -20, 34], "size": [16, 32, 16], "uv": [0, 0]}
			]
		},
		{
			"name": "rearlegtip",
			"parent": "rearleg",
			"pivot": [-16, -20, 43],
			"rotation": [25, 0, 0],
			"cubes": [
				{"name": "rearlegtip", "origin": [-22, -52, 36], "size": [12, 32, 12], "uv": [196, 0]}
			]
		},
		{
			"name": "rearfoot",
			"parent": "rearlegtip",
			"pivot": [-16, -52, 41],
			"rotation": [45, 0, 0],
			"cubes": [
				{"name": "rearfoot", "origin": [-25, -58, 21], "size": [18, 6, 24], "uv": [112, 0]}
			]
		},
		{
			"name": "rearleg1",
			"pivot": [16, 8, 42],
			"rotation": [60, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "rearleg1", "origin": [8, -20, 34], "size": [16, 32, 16], "uv": [0, 0]}
			]
		},
		{
			"name": "rearlegtip1",
			"parent": "rearleg1",
			"pivot": [16, -20, 43],
			"rotation": [25, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "rearlegtip", "origin": [10, -52, 36], "size": [12, 32, 12], "uv": [196, 0]}
			]
		},
		{
			"name": "rearfoot1",
			"parent": "rearlegtip1",
			"pivot": [16, -52, 41],
			"rotation": [45, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "rearfoot", "origin": [7, -58, 21], "size": [18, 6, 24], "uv": [112, 0]}
			]
		},
		{
			"name": "frontleg",
			"pivot": [-12, 4, 2],
			"rotation": [65, 0, 0],
			"cubes": [
				{"name": "frontleg", "origin": [-16, -16, -2], "size": [8, 24, 8], "uv": [112, 104]}
			]
		},
		{
			"name": "frontlegtip",
			"parent": "frontleg",
			"pivot": [-12, -16, 2],
			"rotation": [-20, 0, 0],
			"cubes": [
				{"name": "frontlegtip", "origin": [-15, -39, -1], "size": [6, 24, 6], "uv": [226, 138]}
			]
		},
		{
			"name": "frontfoot",
			"parent": "frontlegtip",
			"pivot": [-12, -38, 2],
			"rotation": [45, 0, 0],
			"cubes": [
				{"name": "frontfoot", "origin": [-16, -42, -10], "size": [8, 4, 16], "uv": [144, 104]}
			]
		},
		{
			"name": "frontleg1",
			"pivot": [12, 4, 2],
			"rotation": [65, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "frontleg1", "origin": [8, -16, -2], "size": [8, 24, 8], "uv": [112, 104]}
			]
		},
		{
			"name": "frontlegtip1",
			"parent": "frontleg1",
			"pivot": [12, -16, 2],
			"rotation": [-20, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "frontlegtip", "origin": [9, -39, -1], "size": [6, 24, 6], "uv": [226, 138]}
			]
		},
		{
			"name": "frontfoot1",
			"parent": "frontlegtip1",
			"pivot": [12, -38, 2],
			"rotation": [45, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "frontfoot", "origin": [8, -42, -10], "size": [8, 4, 16], "uv": [144, 104]}
			]
		},
		{
			"name": "tail",
			"pivot": [0, 14, 56],
			"cubes": [
				{"name": "tail", "origin": [-5, 9, 56], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "tail", "origin": [-1, 19, 58], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "tail2",
			"parent": "tail",
			"pivot": [0, 14, 66],
			"rotation": [1, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-5, 9, 66], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "tail", "origin": [-1, 19, 68], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "tail3",
			"parent": "tail2",
			"pivot": [0, 14, 76],
			"rotation": [1, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-5, 9, 76], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "tail", "origin": [-1, 19, 78], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "tail4",
			"parent": "tail3",
			"pivot": [0, 14, 86],
			"rotation": [1, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-5, 9, 86], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "tail", "origin": [-1, 19, 88], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "tail5",
			"parent": "tail4",
			"pivot": [0, 14, 96],
			"rotation": [2, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-5, 9, 96], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "tail", "origin": [-1, 19, 98], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "tail6",
			"parent": "tail5",
			"pivot": [0, 14, 106],
			"rotation": [3, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-5, 9, 106], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "tail", "origin": [-1, 19, 108], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "tail7",
			"parent": "tail6",
			"pivot": [0, 14, 116],
			"rotation": [3, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-5, 9, 116], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "tail", "origin": [-1, 19, 118], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "tail8",
			"parent": "tail7",
			"pivot": [0, 14, 126],
			"rotation": [1, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-5, 9, 126], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "tail", "origin": [-1, 19, 128], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "tail9",
			"parent": "tail8",
			"pivot": [0, 14, 136],
			"rotation": [-1, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-5, 9, 136], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "tail", "origin": [-1, 19, 138], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "tail10",
			"parent": "tail9",
			"pivot": [0, 14, 146],
			"rotation": [-2, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-5, 9, 146], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "tail", "origin": [-1, 19, 148], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "tail11",
			"parent": "tail10",
			"pivot": [0, 14, 156],
			"rotation": [-3, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-5, 9, 156], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "tail", "origin": [-1, 19, 158], "size": [2, 4, 6], "uv": [48, 0]}
			]
		},
		{
			"name": "tail12",
			"parent": "tail11",
			"pivot": [0, 14, 166],
			"rotation": [-3, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-5, 9, 166], "size": [10, 10, 10], "uv": [192, 104]},
				{"name": "tail", "origin": [-1, 19, 168], "size": [2, 4, 6], "uv": [48, 0]}
			]
		}
	]
}`;
skin_presets.enderman = `{
	"name": "enderman:geometry",
	"texturewidth": 64,
	"textureheight": 32,
	"bones": [
		{
			"name": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 40, -4], "size": [8, 8, 8], "uv": [0, 0], "inflate": -0.5},
				{"name": "head layer", "origin": [-4, 38, -4], "size": [8, 8, 8], "uv": [0, 16], "inflate": -0.5}
			]
		},
		{
			"name": "body",
			"pivot": [0, 38, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 26, -2], "size": [8, 12, 4], "uv": [32, 16]}
			]
		},
		{
			"name": "rightArm",
			"pivot": [-3, 36, 0],
			"cubes": [
				{"name": "rightArm", "origin": [-6, 8, -1], "size": [2, 30, 2], "uv": [56, 0]}
			]
		},
		{
			"name": "leftArm",
			"pivot": [5, 36, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftArm", "origin": [4, 8, -1], "size": [2, 30, 2], "uv": [56, 0]}
			]
		},
		{
			"name": "rightLeg",
			"pivot": [-2, 26, 0],
			"cubes": [
				{"name": "rightLeg", "origin": [-3, -4, -1], "size": [2, 30, 2], "uv": [56, 0]}
			]
		},
		{
			"name": "leftLeg",
			"pivot": [2, 26, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftLeg", "origin": [1, -4, -1], "size": [2, 30, 2], "uv": [56, 0]}
			]
		}
	]
}`;
skin_presets.endermite = `{
	"name": "endermite",
	"texturewidth": 64,
	"textureheight": 32,
	"bones": [
		{
			"name": "section_2",
			"pivot": [0, 0, 2.5],
			"cubes": [
				{"name": "section_2", "origin": [-1.5, 0, 2.5], "size": [3, 3, 1], "uv": [0, 14]}
			]
		},
		{
			"name": "section_0",
			"parent": "section_2",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "section_0", "origin": [-2, 0, -4.4], "size": [4, 3, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "section_1",
			"parent": "section_2",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "section_1", "origin": [-3, 0, -2.4], "size": [6, 4, 5], "uv": [0, 5]}
			]
		},
		{
			"name": "section_3",
			"parent": "section_2",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "section_3", "origin": [-0.5, 0, 3.5], "size": [1, 2, 1], "uv": [0, 18]}
			]
		}
	]
}`;
skin_presets.evoker = `{
	"name": "evoker",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 12, -3], "size": [8, 12, 6], "uv": [16, 20]},
				{"name": "body", "origin": [-4, 6, -3], "size": [8, 18, 6], "uv": [0, 38], "inflate": 0.5}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 24, -4], "size": [8, 10, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "nose",
			"parent": "head",
			"pivot": [0, 26, 0],
			"cubes": [
				{"name": "nose", "origin": [-1, 23, -6], "size": [2, 4, 2], "uv": [24, 0]}
			]
		},
		{
			"name": "arms",
			"parent": "body",
			"pivot": [0, 22, 0],
			"cubes": [
				{"name": "arms", "origin": [-8, 16, -2], "size": [4, 8, 4], "uv": [44, 22]},
				{"name": "arms", "origin": [4, 16, -2], "size": [4, 8, 4], "uv": [44, 22]},
				{"name": "arms", "origin": [-4, 16, -2], "size": [8, 4, 4], "uv": [40, 38]}
			]
		},
		{
			"name": "leg0",
			"parent": "body",
			"pivot": [-2, 12, 0],
			"cubes": [
				{"name": "leg0", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		},
		{
			"name": "leg1",
			"parent": "body",
			"pivot": [2, 12, 0],
			"mirror": true,
			"cubes": [
				{"name": "leg1", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		},
		{
			"name": "rightArm",
			"parent": "body",
			"pivot": [-5, 22, 0],
			"cubes": [
				{"name": "rightArm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 46]}
			]
		},
		{
			"name": "rightItem",
			"parent": "rightArm",
			"pivot": [-5.5, 16, 0.5]
		},
		{
			"name": "leftArm",
			"parent": "body",
			"pivot": [5, 22, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftArm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [40, 46]}
			]
		}
	]
}`;
skin_presets.fox_bedrock = `{
	"name": "fox",
	"texturewidth": 64,
	"textureheight": 32,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 8, 0],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-3, 0, -3], "size": [6, 11, 6], "uv": [30, 15]}
			]
		},
		{
			"name": "head",
			"pivot": [0, 8, -3],
			"cubes": [
				{"name": "head", "origin": [-4, 4, -9], "size": [8, 6, 6], "uv": [0, 0]},
				{"name": "head", "origin": [-4, 10, -8], "size": [2, 2, 1], "uv": [0, 0]},
				{"name": "head", "origin": [2, 10, -8], "size": [2, 2, 1], "uv": [22, 0]},
				{"name": "head", "origin": [-2, 4, -12], "size": [4, 2, 3], "uv": [0, 24]},
				{"name": "head_sleeping", "visibility": false, "origin": [-4, 4, -9], "size": [8, 6, 6], "uv": [0, 12]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-3, 6, 6],
			"cubes": [
				{"name": "leg0", "origin": [-3.005, 0, 5], "size": [2, 6, 2], "uv": [14, 24]}
			]
		},
		{
			"name": "leg1",
			"pivot": [1, 6, 6],
			"cubes": [
				{"name": "leg1", "origin": [1.005, 0, 5], "size": [2, 6, 2], "uv": [22, 24]}
			]
		},
		{
			"name": "leg2",
			"pivot": [-3, 6, -1],
			"cubes": [
				{"name": "leg2", "origin": [-3.005, 0, -2], "size": [2, 6, 2], "uv": [14, 24]}
			]
		},
		{
			"name": "leg3",
			"pivot": [1, 6, -1],
			"cubes": [
				{"name": "leg3", "origin": [1.005, 0, -2], "size": [2, 6, 2], "uv": [22, 24]}
			]
		},
		{
			"name": "tail",
			"pivot": [0, 8, 7],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-2, -2, 4.75], "size": [4, 9, 5], "uv": [28, 0]}
			]
		}
	]
}`;
skin_presets.fox_java = `{
	"name": "fox",
	"texturewidth": 48,
	"textureheight": 32,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 8, 0],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-3, 0, -3], "size": [6, 11, 6], "uv": [24, 15]}
			]
		},
		{
			"name": "head",
			"pivot": [0, 8, -3],
			"cubes": [
				{"name": "head", "origin": [-4, 4, -9], "size": [8, 6, 6], "uv": [1, 5]},
				{"name": "head", "origin": [-4, 10, -8], "size": [2, 2, 1], "uv": [8, 1]},
				{"name": "head", "origin": [2, 10, -8], "size": [2, 2, 1], "uv": [15, 1]},
				{"name": "head", "origin": [-2, 4, -12], "size": [4, 2, 3], "uv": [6, 18]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-3, 6, 6],
			"cubes": [
				{"name": "leg0", "origin": [-3.005, 0, 5], "size": [2, 6, 2], "uv": [13, 24]}
			]
		},
		{
			"name": "leg1",
			"pivot": [1, 6, 6],
			"cubes": [
				{"name": "leg1", "origin": [1.005, 0, 5], "size": [2, 6, 2], "uv": [4, 24]}
			]
		},
		{
			"name": "leg2",
			"pivot": [-3, 6, -1],
			"cubes": [
				{"name": "leg2", "origin": [-3.005, 0, -2], "size": [2, 6, 2], "uv": [13, 24]}
			]
		},
		{
			"name": "leg3",
			"pivot": [1, 6, -1],
			"cubes": [
				{"name": "leg3", "origin": [1.005, 0, -2], "size": [2, 6, 2], "uv": [4, 24]}
			]
		},
		{
			"name": "tail",
			"pivot": [0, 8, 7],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-2, -2, 4.75], "size": [4, 9, 5], "uv": [30, 0]}
			]
		}
	]
}`;
skin_presets.ghast = `{
	"name": "ghast",
	"texturewidth": 64,
	"textureheight": 32,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 8, 0],
			"cubes": [
				{"name": "body", "origin": [-8, 0, -8], "size": [16, 16, 16], "uv": [0, 0]}
			]
		},
		{
			"name": "tentacles_0",
			"parent": "body",
			"pivot": [-3.8, 1, -5],
			"cubes": [
				{"name": "tentacles_0", "origin": [-4.8, -8, -6], "size": [2, 9, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "tentacles_1",
			"parent": "body",
			"pivot": [1.3, 1, -5],
			"cubes": [
				{"name": "tentacles_1", "origin": [0.3, -10, -6], "size": [2, 11, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "tentacles_2",
			"parent": "body",
			"pivot": [6.3, 1, -5],
			"cubes": [
				{"name": "tentacles_2", "origin": [5.3, -7, -6], "size": [2, 8, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "tentacles_3",
			"parent": "body",
			"pivot": [-6.3, 1, 0],
			"cubes": [
				{"name": "tentacles_3", "origin": [-7.3, -8, -1], "size": [2, 9, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "tentacles_4",
			"parent": "body",
			"pivot": [-1.3, 1, 0],
			"cubes": [
				{"name": "tentacles_4", "origin": [-2.3, -12, -1], "size": [2, 13, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "tentacles_5",
			"parent": "body",
			"pivot": [3.8, 1, 0],
			"cubes": [
				{"name": "tentacles_5", "origin": [2.8, -10, -1], "size": [2, 11, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "tentacles_6",
			"parent": "body",
			"pivot": [-3.8, 1, 5],
			"cubes": [
				{"name": "tentacles_6", "origin": [-4.8, -11, 4], "size": [2, 12, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "tentacles_7",
			"parent": "body",
			"pivot": [1.3, 1, 5],
			"cubes": [
				{"name": "tentacles_7", "origin": [0.3, -11, 4], "size": [2, 12, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "tentacles_8",
			"parent": "body",
			"pivot": [6.3, 1, 5],
			"cubes": [
				{"name": "tentacles_8", "origin": [5.3, -12, 4], "size": [2, 13, 2], "uv": [0, 0]}
			]
		}
	]
}`;
skin_presets.guardian = `{
	"name": "guardian",
	"texturewidth": 64,
	"textureheight": 64,
	"eyes": [
		[19, 21, 6, 3]
	],
	"bones": [
		{
			"name": "head",
			"pivot": [0, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "head", "origin": [-6, 2, -8], "size": [12, 12, 16], "uv": [0, 0], "mirror": false},
				{"name": "head", "origin": [-8, 2, -6], "size": [2, 12, 12], "uv": [0, 28], "mirror": false},
				{"name": "head", "origin": [6, 2, -6], "size": [2, 12, 12], "uv": [0, 28]},
				{"name": "head", "origin": [-6, 14, -6], "size": [12, 2, 12], "uv": [16, 40]},
				{"name": "head", "origin": [-6, 0, -6], "size": [12, 2, 12], "uv": [16, 40]}
			]
		},
		{
			"name": "eye",
			"parent": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "eye", "origin": [-1, 7, -8.25], "size": [2, 2, 1], "uv": [8, 0]}
			]
		},
		{
			"name": "tailpart0",
			"parent": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "tailpart0", "origin": [-2, 6, 8], "size": [4, 4, 8], "uv": [40, 0]}
			]
		},
		{
			"name": "tailpart1",
			"parent": "tailpart0",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "tailpart1", "origin": [-1.5, 7, 16], "size": [3, 3, 7], "uv": [0, 54]}
			]
		},
		{
			"name": "tailpart2",
			"parent": "tailpart1",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "tailpart2", "origin": [-1, 8, 23], "size": [2, 2, 6], "uv": [41, 32]},
				{"name": "tailpart2", "origin": [0, 4.5, 26], "size": [1, 9, 9], "uv": [25, 19]}
			]
		},
		{
			"name": "spikepart0",
			"parent": "head",
			"pivot": [0, 24, 0],
			"rotation": [0, 0, 45],
			"cubes": [
				{"name": "spikepart0", "origin": [10.25, 19.5, -1], "size": [2, 9, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "spikepart1",
			"parent": "head",
			"pivot": [0, 24, 0],
			"rotation": [0, 0, -45],
			"cubes": [
				{"name": "spikepart1", "origin": [-12.25, 19.5, -1], "size": [2, 9, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "spikepart2",
			"parent": "head",
			"pivot": [0, 24, 0],
			"rotation": [45, 0, 0],
			"cubes": [
				{"name": "spikepart2", "origin": [-1, 19.5, -12.25], "size": [2, 9, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "spikepart3",
			"parent": "head",
			"pivot": [0, 24, 0],
			"rotation": [-45, 0, 0],
			"cubes": [
				{"name": "spikepart3", "origin": [-1, 19.5, 10.5], "size": [2, 9, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "spikepart4",
			"parent": "head",
			"pivot": [0, 24, 0],
			"rotation": [0, 0, 135],
			"cubes": [
				{"name": "spikepart4", "origin": [10.25, 42.5, -1], "size": [2, 9, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "spikepart5",
			"parent": "head",
			"pivot": [0, 24, 0],
			"rotation": [0, 0, -135],
			"cubes": [
				{"name": "spikepart5", "origin": [-12.25, 42.5, -1], "size": [2, 9, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "spikepart6",
			"parent": "head",
			"pivot": [0, 24, 0],
			"rotation": [135, 0, 0],
			"cubes": [
				{"name": "spikepart6", "origin": [-1, 43.5, -12.25], "size": [2, 9, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "spikepart7",
			"parent": "head",
			"pivot": [0, 24, 0],
			"rotation": [-135, 0, 0],
			"cubes": [
				{"name": "spikepart7", "origin": [-1, 42.5, 10.25], "size": [2, 9, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "spikepart8",
			"parent": "head",
			"pivot": [0, 24, 0],
			"rotation": [90, -45, 0],
			"cubes": [
				{"name": "spikepart8", "origin": [-1, 32.5, -17], "size": [2, 9, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "spikepart9",
			"parent": "head",
			"pivot": [0, 24, 0],
			"rotation": [90, 45, 0],
			"cubes": [
				{"name": "spikepart8", "origin": [-1, 32.5, -17], "size": [2, 9, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "spikepart10",
			"parent": "head",
			"pivot": [0, 24, 0],
			"rotation": [90, -135, 0],
			"cubes": [
				{"name": "spikepart8", "origin": [-1, 32.5, -17], "size": [2, 9, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "spikepart11",
			"parent": "head",
			"pivot": [0, 24, 0],
			"rotation": [90, 135, 0],
			"cubes": [
				{"name": "spikepart8", "origin": [-1, 32.5, -17], "size": [2, 9, 2], "uv": [0, 0]}
			]
		}
	]
}`;
skin_presets.horse = `{
	"name": "horse",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "Body",
			"pivot": [0, 13, 9],
			"cubes": [
				{"name": "Body", "origin": [-5, 11, -11], "size": [10, 10, 22], "uv": [0, 32]}
			]
		},
		{
			"name": "TailA",
			"pivot": [0, 20, 11],
			"rotation": [30, 0, 0],
			"cubes": [
				{"name": "TailA", "origin": [-1.5, 6, 9], "size": [3, 14, 4], "uv": [42, 36]}
			]
		},
		{
			"name": "Leg1A",
			"pivot": [3, 11, 9],
			"cubes": [
				{"name": "Leg1A", "origin": [1, 0, 7], "size": [4, 11, 4], "uv": [48, 21], "mirror": true}
			]
		},
		{
			"name": "Leg2A",
			"pivot": [-3, 11, 9],
			"cubes": [
				{"name": "Leg2A", "origin": [-5, 0, 7], "size": [4, 11, 4], "uv": [48, 21]}
			]
		},
		{
			"name": "Leg3A",
			"pivot": [3, 11, -9],
			"cubes": [
				{"name": "Leg3A", "origin": [1, 0, -11], "size": [4, 11, 4], "uv": [48, 21], "mirror": true}
			]
		},
		{
			"name": "Leg4A",
			"pivot": [-3, 11, -9],
			"cubes": [
				{"name": "Leg4A", "origin": [-5, 0, -11], "size": [4, 11, 4], "uv": [48, 21]}
			]
		},
		{
			"name": "Head",
			"pivot": [0, 28, -11],
			"rotation": [30, 0, 0],
			"cubes": [
				{"name": "Head", "origin": [-3, 28, -17], "size": [6, 5, 7], "uv": [0, 13]},
				{"name": "UMouth", "origin": [-2, 28, -22], "size": [4, 5, 5], "uv": [0, 25]}
			]
		},
		{
			"name": "Ear1",
			"pivot": [0, 17, -8],
			"rotation": [30, 0, 5],
			"cubes": [
				{"name": "Ear1", "origin": [-0.5, 32, -5.01], "size": [2, 3, 1], "uv": [19, 16], "mirror": true}
			]
		},
		{
			"name": "Ear2",
			"pivot": [0, 17, -8],
			"rotation": [30, 0, -5],
			"cubes": [
				{"name": "Ear2", "origin": [-1.5, 32, -5.01], "size": [2, 3, 1], "uv": [19, 16]}
			]
		},
		{
			"name": "MuleEarL",
			"pivot": [0, 17, -8],
			"rotation": [30, 0, 15],
			"cubes": [
				{"name": "MuleEarL", "visibility": false, "origin": [-3, 32, -5.01], "size": [2, 7, 1], "uv": [0, 12], "mirror": true}
			]
		},
		{
			"name": "MuleEarR",
			"pivot": [0, 17, -8],
			"rotation": [30, 0, -15],
			"cubes": [
				{"name": "MuleEarR", "visibility": false, "origin": [1, 32, -5.01], "size": [2, 7, 1], "uv": [0, 12]}
			]
		},
		{
			"name": "Neck",
			"pivot": [0, 17, -8],
			"rotation": [30, 0, 0],
			"cubes": [
				{"name": "Neck", "origin": [-2, 16, -11], "size": [4, 12, 7], "uv": [0, 35]},
				{"name": "Mane", "origin": [-1, 17, -4], "size": [2, 16, 2], "uv": [56, 36]}
			]
		},
		{
			"name": "Bag1",
			"pivot": [-5, 21, 11],
			"rotation": [0, -90, 0],
			"cubes": [
				{"name": "Bag1", "visibility": false, "origin": [-14, 13, 11], "size": [8, 8, 3], "uv": [26, 21]}
			]
		},
		{
			"name": "Bag2",
			"pivot": [5, 21, 11],
			"rotation": [0, 90, 0],
			"cubes": [
				{"name": "Bag2", "visibility": false, "origin": [6, 13, 11], "size": [8, 8, 3], "uv": [26, 21], "mirror": true}
			]
		},
		{
			"name": "Saddle",
			"pivot": [0, 22, 2],
			"cubes": [
				{"name": "Saddle", "origin": [-5, 12, -3.5], "size": [10, 9, 9], "uv": [26, 0], "inflate": 0.5}
			]
		},
		{
			"name": "SaddleMouthL",
			"pivot": [0, 17, -8],
			"rotation": [30, 0, 0],
			"cubes": [
				{"name": "SaddleMouthL", "origin": [2, 29, -14], "size": [1, 2, 2], "uv": [29, 5]}
			]
		},
		{
			"name": "SaddleMouthR",
			"pivot": [0, 17, -8],
			"rotation": [30, 0, 0],
			"cubes": [
				{"name": "SaddleMouthR", "origin": [-3, 29, -14], "size": [1, 2, 2], "uv": [29, 5]}
			]
		},
		{
			"name": "SaddleMouthLine",
			"pivot": [0, 17, -8],
			"cubes": [
				{"name": "SaddleMouthLine", "origin": [3.1, 24, -19.5], "size": [0, 3, 16], "uv": [32, 2]}
			]
		},
		{
			"name": "SaddleMouthLineR",
			"pivot": [0, 17, -8],
			"cubes": [
				{"name": "SaddleMouthLineR", "origin": [-3.1, 24, -19.5], "size": [0, 3, 16], "uv": [32, 2]}
			]
		},
		{
			"name": "HeadSaddle",
			"pivot": [0, 17, -8],
			"rotation": [30, 0, 0],
			"cubes": [
				{"name": "HeadSaddle", "origin": [-2, 28, -13], "size": [4, 5, 2], "uv": [19, 0], "inflate": 0.25},
				{"name": "HeadSaddle", "visibility": false, "origin": [-3, 28, -11], "size": [6, 5, 7], "uv": [0, 0], "inflate": 0.25}
			]
		}
	]
}`;
skin_presets.irongolem = `{
	"name": "irongolem",
	"texturewidth": 128,
	"textureheight": 128,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 31, 0],
			"cubes": [
				{"name": "body", "origin": [-9, 21, -6], "size": [18, 12, 11], "uv": [0, 40]},
				{"name": "body", "origin": [-4.5, 16, -3], "size": [9, 5, 6], "uv": [0, 70], "inflate": 0.5}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 31, -2],
			"cubes": [
				{"name": "head", "origin": [-4, 33, -7.5], "size": [8, 10, 8], "uv": [0, 0]},
				{"name": "head", "origin": [-1, 32, -9.5], "size": [2, 4, 2], "uv": [24, 0]}
			]
		},
		{
			"name": "arm0",
			"parent": "body",
			"pivot": [0, 31, 0],
			"cubes": [
				{"name": "arm0", "origin": [-13, 3.5, -3], "size": [4, 30, 6], "uv": [60, 21]}
			]
		},
		{
			"name": "arm1",
			"parent": "body",
			"pivot": [0, 31, 0],
			"cubes": [
				{"name": "arm1", "origin": [9, 3.5, -3], "size": [4, 30, 6], "uv": [60, 58]}
			]
		},
		{
			"name": "leg0",
			"parent": "body",
			"pivot": [-4, 13, 0],
			"cubes": [
				{"name": "leg0", "origin": [-7.5, 0, -3], "size": [6, 16, 5], "uv": [37, 0]}
			]
		},
		{
			"name": "leg1",
			"parent": "body",
			"pivot": [5, 13, 0],
			"mirror": true,
			"cubes": [
				{"name": "leg1", "origin": [1.5, 0, -3], "size": [6, 16, 5], "uv": [60, 0]}
			]
		}
	]
}`;
skin_presets.llama = `{
	"name": "llama",
	"texturewidth": 128,
	"textureheight": 64,
	"eyes": [
		[7, 21],
		[11, 21]
	],
	"bones": [
		{
			"name": "head",
			"pivot": [0, 17, -6],
			"cubes": [
				{"name": "head", "origin": [-2, 27, -16], "size": [4, 4, 9], "uv": [0, 0]},
				{"name": "head", "origin": [-4, 15, -12], "size": [8, 18, 6], "uv": [0, 14]},
				{"name": "head", "origin": [-4, 33, -10], "size": [3, 3, 2], "uv": [17, 0]},
				{"name": "head", "origin": [1, 33, -10], "size": [3, 3, 2], "uv": [17, 0]}
			]
		},
		{
			"name": "chest1",
			"pivot": [-8.5, 21, 3],
			"rotation": [0, 90, 0],
			"cubes": [
				{"name": "chest1", "origin": [-11.5, 13, 3], "size": [8, 8, 3], "uv": [45, 28]}
			]
		},
		{
			"name": "chest2",
			"pivot": [5.5, 21, 3],
			"rotation": [0, 90, 0],
			"cubes": [
				{"name": "chest2", "origin": [2.5, 13, 3], "size": [8, 8, 3], "uv": [45, 41]}
			]
		},
		{
			"name": "body",
			"pivot": [0, 19, 2],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-6, 11, -5], "size": [12, 18, 10], "uv": [29, 0]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-3.5, 14, 6],
			"cubes": [
				{"name": "leg0", "origin": [-5.5, 0, 4], "size": [4, 14, 4], "uv": [29, 29]}
			]
		},
		{
			"name": "leg1",
			"pivot": [3.5, 14, 6],
			"cubes": [
				{"name": "leg1", "origin": [1.5, 0, 4], "size": [4, 14, 4], "uv": [29, 29]}
			]
		},
		{
			"name": "leg2",
			"pivot": [-3.5, 14, -5],
			"cubes": [
				{"name": "leg2", "origin": [-5.5, 0, -7], "size": [4, 14, 4], "uv": [29, 29]}
			]
		},
		{
			"name": "leg3",
			"pivot": [3.5, 14, -5],
			"cubes": [
				{"name": "leg3", "origin": [1.5, 0, -7], "size": [4, 14, 4], "uv": [29, 29]}
			]
		}
	]
}`;
skin_presets.lavaslime = `{
	"name": "lavaslime",
	"texturewidth": 64,
	"textureheight": 32,
	"eyes": [
		[33, 18, 2, 1],
		[37, 18, 2, 1],
		[33, 27, 2, 1],
		[37, 27, 2, 1]
	],
	"bones": [
		{
			"name": "insideCube",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "insideCube", "origin": [-2, 2, -2], "size": [4, 4, 4], "uv": [0, 16]}
			]
		},
		{
			"name": "bodyCube_0",
			"parent": "insideCube",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "bodyCube_0", "origin": [-4, 7, -4], "size": [8, 1, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "bodyCube_1",
			"parent": "insideCube",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "bodyCube_1", "origin": [-4, 6, -4], "size": [8, 1, 8], "uv": [0, 1]}
			]
		},
		{
			"name": "bodyCube_2",
			"parent": "insideCube",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "bodyCube_2", "origin": [-4, 5, -4], "size": [8, 1, 8], "uv": [24, 10]}
			]
		},
		{
			"name": "bodyCube_3",
			"parent": "insideCube",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "bodyCube_3", "origin": [-4, 4, -4], "size": [8, 1, 8], "uv": [24, 19]}
			]
		},
		{
			"name": "bodyCube_4",
			"parent": "insideCube",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "bodyCube_4", "origin": [-4, 3, -4], "size": [8, 1, 8], "uv": [0, 4]}
			]
		},
		{
			"name": "bodyCube_5",
			"parent": "insideCube",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "bodyCube_5", "origin": [-4, 2, -4], "size": [8, 1, 8], "uv": [0, 5]}
			]
		},
		{
			"name": "bodyCube_6",
			"parent": "insideCube",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "bodyCube_6", "origin": [-4, 1, -4], "size": [8, 1, 8], "uv": [0, 6]}
			]
		},
		{
			"name": "bodyCube_7",
			"parent": "insideCube",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "bodyCube_7", "origin": [-4, 0, -4], "size": [8, 1, 8], "uv": [0, 7]}
			]
		}
	]
}`;
skin_presets.minecart = `{
	"name": "minecart",
	"texturewidth": 64,
	"textureheight": 32,
	"bones": [
		{
			"name": "bottom",
			"pivot": [0, 20, 0],
			"rotation": [90, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "bottom", "origin": [-10, 12, -20], "size": [20, 16, 2], "uv": [0, 10]}
			]
		},
		{
			"name": "front",
			"pivot": [-9, 25, 0],
			"rotation": [0, -90, 0],
			"mirror": true,
			"cubes": [
				{"name": "front", "origin": [-17, 2, -1], "size": [16, 8, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "back",
			"pivot": [9, 25, 0],
			"rotation": [0, 90, 0],
			"mirror": true,
			"cubes": [
				{"name": "back", "origin": [1, 2, -1], "size": [16, 8, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "right",
			"pivot": [0, 25, -7],
			"rotation": [0, -180, 0],
			"mirror": true,
			"cubes": [
				{"name": "right", "origin": [-8, 2, -8], "size": [16, 8, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "left",
			"pivot": [0, 25, 7],
			"mirror": true,
			"cubes": [
				{"name": "left", "origin": [-8, 2, 6], "size": [16, 8, 2], "uv": [0, 0]}
			]
		}
	]
}`;
skin_presets.panda = `{
	"name": "panda",
	"texturewidth": 64,
	"textureheight": 64,
	"eyes": [
		[11, 19, 2, 1],
		[18, 19, 2, 1],
	],
	"bones": [
		{
			"name": "body",
			"pivot": [0, 14, 0],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-9.5, 1, -6.5], "size": [19, 26, 13], "uv": [0, 25]}
			]
		},
		{
			"name": "head",
			"pivot": [0, 12.5, -17],
			"cubes": [
				{"name": "head", "origin": [-6.5, 7.5, -21], "size": [13, 10, 9], "uv": [0, 6]},
				{"name": "head", "origin": [-3.5, 7.5, -23], "size": [7, 5, 2], "uv": [45, 16]},
				{"name": "head", "origin": [-8.5, 16.5, -18], "size": [5, 4, 1], "uv": [52, 25]},
				{"name": "head", "origin": [3.5, 16.5, -18], "size": [5, 4, 1], "uv": [52, 25]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-5.5, 9, 9],
			"cubes": [
				{"name": "leg0", "origin": [-8.5, 0, 6], "size": [6, 9, 6], "uv": [40, 0]}
			]
		},
		{
			"name": "leg1",
			"pivot": [5.5, 9, 9],
			"cubes": [
				{"name": "leg1", "origin": [2.5, 0, 6], "size": [6, 9, 6], "uv": [40, 0]}
			]
		},
		{
			"name": "leg2",
			"pivot": [-5.5, 9, -9],
			"cubes": [
				{"name": "leg2", "origin": [-8.5, 0, -12], "size": [6, 9, 6], "uv": [40, 0]}
			]
		},
		{
			"name": "leg3",
			"pivot": [5.5, 9, -9],
			"cubes": [
				{"name": "leg3", "origin": [2.5, 0, -12], "size": [6, 9, 6], "uv": [40, 0]}
			]
		}
	]
}`;
skin_presets.parrot = `{
	"name": "parrot",
	"texturewidth": 32,
	"textureheight": 32,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 7.5, -3],
			"rotation": [25, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-1.5, 1.5, -4.5], "size": [3, 6, 3], "uv": [2, 8]}
			]
		},
		{
			"name": "wing0",
			"parent": "body",
			"pivot": [1.5, 7.1, -2.8],
			"rotation": [10, 0, 0],
			"cubes": [
				{"name": "wing0", "origin": [1, 2.1, -4.3], "size": [1, 5, 3], "uv": [19, 8]}
			]
		},
		{
			"name": "wing1",
			"parent": "body",
			"pivot": [-1.5, 7.1, -2.8],
			"rotation": [10, 0, 0],
			"cubes": [
				{"name": "wing1", "origin": [-2, 2.1, -4.3], "size": [1, 5, 3], "uv": [19, 8]}
			]
		},
		{
			"name": "head",
			"pivot": [0, 8.3, -2.8],
			"cubes": [
				{"name": "head", "origin": [-1, 6.8, -3.8], "size": [2, 3, 2], "uv": [2, 2]},
				{"name": "head2", "origin": [-1, 9.8, -5.8], "size": [2, 1, 4], "uv": [10, 0]},
				{"name": "beak1", "origin": [-0.5, 7.8, -4.7], "size": [1, 2, 1], "uv": [11, 7]},
				{"name": "beak2", "origin": [-0.5, 8.1, -5.7], "size": [1, 1.7, 1], "uv": [16, 7]},
				{"name": "feather", "origin": [0, 9.1, -4.9], "size": [0, 5, 4], "uv": [2, 18]}
			]
		},
		{
			"name": "tail",
			"pivot": [0, 2.9, 1.2],
			"rotation": [50, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-1.5, -0.1, 0.2], "size": [3, 4, 1], "uv": [22, 1]}
			]
		},
		{
			"name": "leg0",
			"pivot": [1.5, 1, -0.5],
			"cubes": [
				{"name": "leg0", "origin": [0.5, -0.5, -1.5], "size": [1, 2, 1], "uv": [14, 18]}
			]
		},
		{
			"name": "leg1",
			"pivot": [-0.5, 1, -0.5],
			"cubes": [
				{"name": "leg1", "origin": [-1.5, -0.5, -1.5], "size": [1, 2, 1], "uv": [14, 18]}
			]
		}
	]
}`;
skin_presets.phantom = `{
	"name": "phantom",
	"eyes": [
		[5, 6, 2, 1],
		[10, 6, 2, 1],
	],
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "body", "origin": [-3, 23, -8], "size": [5, 3, 9], "uv": [0, 8]}
			]
		},
		{
			"name": "wing0",
			"parent": "body",
			"pivot": [2, 26, -8],
			"rotation": [0, 0, 5],
			"cubes": [
				{"name": "wing0", "origin": [2, 24, -8], "size": [6, 2, 9], "uv": [23, 12]}
			]
		},
		{
			"name": "wingtip0",
			"parent": "wing0",
			"pivot": [8, 26, -8],
			"rotation": [0, 0, 10],
			"cubes": [
				{"name": "wingtip0", "origin": [8, 25, -8], "size": [13, 1, 9], "uv": [16, 24]}
			]
		},
		{
			"name": "wing1",
			"parent": "body",
			"pivot": [-3, 26, -8],
			"rotation": [0, 0, -5],
			"mirror": true,
			"cubes": [
				{"name": "wing1", "origin": [-9, 24, -8], "size": [6, 2, 9], "uv": [23, 12]}
			]
		},
		{
			"name": "wingtip1",
			"parent": "wing1",
			"pivot": [-9, 26, -8],
			"rotation": [0, 0, -10],
			"mirror": true,
			"cubes": [
				{"name": "wingtip1", "origin": [-22, 25, -8], "size": [13, 1, 9], "uv": [16, 24]}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 23, -7],
			"cubes": [
				{"name": "head", "origin": [-4, 22, -12], "size": [7, 3, 5], "uv": [0, 0]}
			]
		},
		{
			"name": "tail",
			"parent": "body",
			"pivot": [0, 26, 1],
			"rotation": [-5, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-2, 24, 1], "size": [3, 2, 6], "uv": [3, 20]}
			]
		},
		{
			"name": "tailtip",
			"parent": "tail",
			"pivot": [0, 25.5, 7],
			"rotation": [-5, 0, 0],
			"cubes": [
				{"name": "tailtip", "origin": [-1, 24.5, 7], "size": [1, 1, 6], "uv": [4, 29]}
			]
		}
	]
}`;
skin_presets.pig = `{
	"name": "pig",
	"texturewidth": 64,
	"textureheight": 32,
	"eyes": [
		[8, 11, 2, 1],
		[14, 11, 2, 1]
	],
	"bones": [
		{
			"name": "body",
			"pivot": [0, 13, 2],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-5, 7, -5], "size": [10, 16, 8], "uv": [28, 8]}
			]
		},
		{
			"name": "head",
			"pivot": [0, 12, -6],
			"cubes": [
				{"name": "head", "origin": [-4, 8, -14], "size": [8, 8, 8], "uv": [0, 0]},
				{"name": "head", "origin": [-2, 9, -15], "size": [4, 3, 1], "uv": [16, 16]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-3, 6, 7],
			"cubes": [
				{"name": "leg0", "origin": [-5, 0, 5], "size": [4, 6, 4], "uv": [0, 16]}
			]
		},
		{
			"name": "leg1",
			"pivot": [3, 6, 7],
			"mirror": true,
			"cubes": [
				{"name": "leg1", "origin": [1, 0, 5], "size": [4, 6, 4], "uv": [0, 16]}
			]
		},
		{
			"name": "leg2",
			"pivot": [-3, 6, -5],
			"cubes": [
				{"name": "leg2", "origin": [-5, 0, -7], "size": [4, 6, 4], "uv": [0, 16]}
			]
		},
		{
			"name": "leg3",
			"pivot": [3, 6, -5],
			"mirror": true,
			"cubes": [
				{"name": "leg3", "origin": [1, 0, -7], "size": [4, 6, 4], "uv": [0, 16]}
			]
		}
	]
}`;
skin_presets.pillager = `{
	"name": "pillager",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "waist",
			"pivot": [0, 12, 0]
		},
		{
			"name": "body",
			"parent": "waist",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 12, -3], "size": [8, 12, 6], "uv": [16, 20]},
				{"name": "body", "origin": [-4, 6, -3], "size": [8, 18, 6], "uv": [0, 38], "inflate": 0.5}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 24, -4], "size": [8, 10, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "nose",
			"parent": "head",
			"pivot": [0, 26, 0],
			"cubes": [
				{"name": "nose", "origin": [-1, 23, -6], "size": [2, 4, 2], "uv": [24, 0]}
			]
		},
		{
			"name": "leftLeg",
			"parent": "body",
			"pivot": [2, 12, 0],
			"cubes": [
				{"name": "leftLeg", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		},
		{
			"name": "rightLeg",
			"parent": "body",
			"pivot": [-2, 12, 0],
			"mirror": true,
			"cubes": [
				{"name": "rightLeg", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		},
		{
			"name": "rightarm",
			"parent": "body",
			"pivot": [-5, 22, 0],
			"cubes": [
				{"name": "rightarm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 46]}
			]
		},
		{
			"name": "leftarm",
			"parent": "body",
			"pivot": [5, 22, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftarm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [40, 46]}
			]
		}
	]
}`;
skin_presets.polarbear = `{
	"name": "polarbear",
	"texturewidth": 128,
	"textureheight": 64,
	"bones": [
		{
			"name": "body",
			"pivot": [-2, 15, 12],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-7, 14, 5], "size": [14, 14, 11], "uv": [0, 19]},
				{"name": "body", "origin": [-6, 28, 5], "size": [12, 12, 10], "uv": [39, 0]}
			]
		},
		{
			"name": "head",
			"pivot": [0, 14, -16],
			"mirror": true,
			"cubes": [
				{"name": "head", "origin": [-3.5, 10, -19], "size": [7, 7, 7], "uv": [0, 0], "mirror": false},
				{"name": "head", "origin": [-2.5, 10, -22], "size": [5, 3, 3], "uv": [0, 44], "mirror": false},
				{"name": "head", "origin": [-4.5, 16, -17], "size": [2, 2, 1], "uv": [26, 0], "mirror": false},
				{"name": "head", "origin": [2.5, 16, -17], "size": [2, 2, 1], "uv": [26, 0]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-4.5, 10, 6],
			"cubes": [
				{"name": "leg0", "origin": [-6.5, 0, 4], "size": [4, 10, 8], "uv": [50, 22]}
			]
		},
		{
			"name": "leg1",
			"pivot": [4.5, 10, 6],
			"cubes": [
				{"name": "leg1", "origin": [2.5, 0, 4], "size": [4, 10, 8], "uv": [50, 22]}
			]
		},
		{
			"name": "leg2",
			"pivot": [-3.5, 10, -8],
			"cubes": [
				{"name": "leg2", "origin": [-5.5, 0, -10], "size": [4, 10, 6], "uv": [50, 40]}
			]
		},
		{
			"name": "leg3",
			"pivot": [3.5, 10, -8],
			"cubes": [
				{"name": "leg3", "origin": [1.5, 0, -10], "size": [4, 10, 6], "uv": [50, 40]}
			]
		}
	]
}`;
skin_presets.pufferfish = `{
	"name": "pufferfish",
	"texturewidth": 32,
	"textureheight": 32,
	"bones": [
		{
			"name": "body_large",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 0, -4], "size": [8, 8, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "leftFin",
			"parent": "body_large",
			"pivot": [4, 7, 3],
			"cubes": [
				{"name": "leftFin", "origin": [4, 6, -2.9904], "size": [2, 1, 2], "uv": [24, 3]}
			]
		},
		{
			"name": "rightFin",
			"parent": "body_large",
			"pivot": [-4, 7, 1],
			"cubes": [
				{"name": "rightFin", "origin": [-5.9968, 6, -2.992], "size": [2, 1, 2], "uv": [24, 0]}
			]
		},
		{
			"name": "spines_top_front",
			"parent": "body_large",
			"pivot": [-4, 8, -4],
			"rotation": [45, 0, 0],
			"cubes": [
				{"name": "spines_top_front", "origin": [-4, 8, -4], "size": [8, 1, 1], "uv": [14, 16]}
			]
		},
		{
			"name": "spines_top_mid",
			"parent": "body_large",
			"pivot": [0, 8, 0],
			"cubes": [
				{"name": "spines_top_mid", "origin": [-4, 8, 0], "size": [8, 1, 1], "uv": [14, 16]}
			]
		},
		{
			"name": "spines_top_back",
			"parent": "body_large",
			"pivot": [0, 8, 4],
			"rotation": [-45, 0, 0],
			"cubes": [
				{"name": "spines_top_back", "origin": [-4, 8, 4], "size": [8, 1, 1], "uv": [14, 16]}
			]
		},
		{
			"name": "spines_bottom_front",
			"parent": "body_large",
			"pivot": [0, 0, -4],
			"rotation": [-45, 0, 0],
			"cubes": [
				{"name": "spines_bottom_front", "origin": [-4, -1, -4], "size": [8, 1, 1], "uv": [14, 19]}
			]
		},
		{
			"name": "spines_bottom_mid",
			"parent": "body_large",
			"pivot": [0, -1, 0],
			"cubes": [
				{"name": "spines_bottom_mid", "origin": [-4, -1, 0], "size": [8, 1, 1], "uv": [14, 19]}
			]
		},
		{
			"name": "spines_bottom_back",
			"parent": "body_large",
			"pivot": [0, 0, 4],
			"rotation": [45, 0, 0],
			"cubes": [
				{"name": "spines_bottom_back", "origin": [-4, -1, 4], "size": [8, 1, 1], "uv": [14, 19]}
			]
		},
		{
			"name": "spines_left_front",
			"parent": "body_large",
			"pivot": [4, 0, -4],
			"rotation": [0, 45, 0],
			"cubes": [
				{"name": "spines_left_front", "origin": [4, 0, -4], "size": [1, 8, 1], "uv": [0, 16]}
			]
		},
		{
			"name": "spines_left_mid",
			"parent": "body_large",
			"pivot": [4, 0, 0],
			"cubes": [
				{"name": "spines_left_mid", "origin": [4, 0, 0], "size": [1, 8, 1], "uv": [4, 16], "mirror": true}
			]
		},
		{
			"name": "spines_left_back",
			"parent": "body_large",
			"pivot": [4, 0, 4],
			"rotation": [0, -45, 0],
			"cubes": [
				{"name": "spines_left_back", "origin": [4, 0, 4], "size": [1, 8, 1], "uv": [8, 16], "mirror": true}
			]
		},
		{
			"name": "spines_right_front",
			"parent": "body_large",
			"pivot": [-4, 0, -4],
			"rotation": [0, -45, 0],
			"cubes": [
				{"name": "spines_right_front", "origin": [-5, 0, -4], "size": [1, 8, 1], "uv": [4, 16]}
			]
		},
		{
			"name": "spines_right_mid",
			"parent": "body_large",
			"pivot": [-4, 0, 0],
			"cubes": [
				{"name": "spines_right_mid", "origin": [-5, 0, 0], "size": [1, 8, 1], "uv": [8, 16]}
			]
		},
		{
			"name": "spines_right_back",
			"parent": "body_large",
			"pivot": [-4, 0, 4],
			"rotation": [0, 45, 0],
			"cubes": [
				{"name": "spines_right_back", "origin": [-5, 0, 4], "size": [1, 8, 1], "uv": [8, 16]}
			]
		},
		{
			"name": "body_mid",
			"pivot": [16, 0, 0],
			"cubes": [
				{"name": "body", "origin": [13.5, 1, -2.5], "size": [5, 5, 5], "uv": [12, 22]}
			]
		},
		{
			"name": "leftFin",
			"parent": "body_mid",
			"pivot": [18.5, 5, 0.5],
			"cubes": [
				{"name": "leftFin", "origin": [18.5, 4, -1.5], "size": [2, 1, 2], "uv": [24, 3]}
			]
		},
		{
			"name": "rightFin",
			"parent": "body_mid",
			"pivot": [13.5, 5, 0.5],
			"cubes": [
				{"name": "rightFin", "origin": [11.5, 4, -1.5], "size": [2, 1, 2], "uv": [24, 0]}
			]
		},
		{
			"name": "spines_top_front",
			"parent": "body_mid",
			"pivot": [16, 6, -2.5],
			"cubes": [
				{"name": "spines_top_front", "origin": [13.5, 6, -2.5], "size": [5, 1, 0], "uv": [19, 17]}
			]
		},
		{
			"name": "spines_top_back",
			"parent": "body_mid",
			"pivot": [16, 6, 2.5],
			"cubes": [
				{"name": "spines_top_back", "origin": [13.5, 6, 2.5], "size": [5, 1, 0], "uv": [11, 17]}
			]
		},
		{
			"name": "spines_bottom_front",
			"parent": "body_mid",
			"pivot": [16, 1, -2.5],
			"cubes": [
				{"name": "spines_bottom_front", "origin": [13.5, 0, -2.5], "size": [5, 1, 0], "uv": [18, 20]}
			]
		},
		{
			"name": "spines_bottom_back",
			"parent": "body_mid",
			"pivot": [16, 1, 2.5],
			"rotation": [45, 0, 0],
			"cubes": [
				{"name": "spines_bottom_back", "origin": [13.5, 0, 2.5], "size": [5, 1, 0], "uv": [18, 20]}
			]
		},
		{
			"name": "spines_left_front",
			"parent": "body_mid",
			"pivot": [18.5, 0, -2.5],
			"rotation": [0, 45, 0],
			"cubes": [
				{"name": "spines_left_front", "origin": [18.5, 1, -2.5], "size": [1, 5, 0], "uv": [1, 17]}
			]
		},
		{
			"name": "spines_left_back",
			"parent": "body_mid",
			"pivot": [18.5, 0, 2.5],
			"rotation": [0, -45, 0],
			"cubes": [
				{"name": "spines_left_back", "origin": [18.5, 1, 2.5], "size": [1, 5, 0], "uv": [1, 17]}
			]
		},
		{
			"name": "spines_right_front",
			"parent": "body_mid",
			"pivot": [13.5, 0, -2.5],
			"rotation": [0, -45, 0],
			"cubes": [
				{"name": "spines_right_front", "origin": [12.5, 1, -2.5], "size": [1, 5, 0], "uv": [5, 17]}
			]
		},
		{
			"name": "spines_right_back",
			"parent": "body_mid",
			"pivot": [13.5, 0, 2.5],
			"rotation": [0, 45, 0],
			"cubes": [
				{"name": "spines_right_back", "origin": [12.5, 1, 2.5], "size": [1, 5, 0], "uv": [9, 17]}
			]
		},
		{
			"name": "body_small",
			"pivot": [-16, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-17.5, 0, -1.5], "size": [3, 2, 3], "uv": [0, 27]},
				{"name": "body", "origin": [-15.5, 2, -1.5], "size": [1, 1, 1], "uv": [24, 6]},
				{"name": "body", "origin": [-17.5, 2, -1.5], "size": [1, 1, 1], "uv": [28, 6]}
			]
		},
		{
			"name": "tailfin",
			"parent": "body_small",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "tailfin", "origin": [-17.5, 1, 1.5], "size": [3, 0, 3], "uv": [-3, 0]}
			]
		},
		{
			"name": "leftFin",
			"parent": "body_small",
			"pivot": [6.5, 5, 0.5],
			"cubes": [
				{"name": "leftFin", "origin": [-14.5, 0, -1.5], "size": [1, 1, 2], "uv": [25, 0], "mirror": true}
			]
		},
		{
			"name": "rightFin",
			"parent": "body_small",
			"pivot": [-6.5, 5, 0.5],
			"cubes": [
				{"name": "rightFin", "origin": [-18.5, 0, -1.5], "size": [1, 1, 2], "uv": [25, 0]}
			]
		}
	]
}`;
skin_presets.rabbit = `{
	"name": "rabbit",
	"texturewidth": 64,
	"textureheight": 32,
	"bones": [
		{
			"name": "rearFootLeft",
			"pivot": [3, 6.5, 3.7],
			"mirror": true,
			"cubes": [
				{"name": "rearFootLeft", "origin": [2, 0, 0], "size": [2, 1, 7], "uv": [8, 24]}
			]
		},
		{
			"name": "rearFootRight",
			"pivot": [-3, 6.5, 3.7],
			"mirror": true,
			"cubes": [
				{"name": "rearFootRight", "origin": [-4, 0, 0], "size": [2, 1, 7], "uv": [26, 24]}
			]
		},
		{
			"name": "haunchLeft",
			"pivot": [3, 6.5, 3.7],
			"rotation": [-20, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "haunchLeft", "origin": [2, 2.5, 3.7], "size": [2, 4, 5], "uv": [16, 15]}
			]
		},
		{
			"name": "haunchRight",
			"pivot": [-3, 6.5, 3.7],
			"rotation": [-20, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "haunchRight", "origin": [-4, 2.5, 3.7], "size": [2, 4, 5], "uv": [30, 15]}
			]
		},
		{
			"name": "body",
			"pivot": [0, 5, 8],
			"rotation": [-20, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "body", "origin": [-3, 2, -2], "size": [6, 5, 10], "uv": [0, 0]}
			]
		},
		{
			"name": "frontLegLeft",
			"pivot": [3, 7, -1],
			"rotation": [-10, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "frontLegLeft", "origin": [2, 0, -2], "size": [2, 7, 2], "uv": [8, 15]}
			]
		},
		{
			"name": "frontLegRight",
			"pivot": [-3, 7, -1],
			"rotation": [-10, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "frontLegRight", "origin": [-4, 0, -2], "size": [2, 7, 2], "uv": [0, 15]}
			]
		},
		{
			"name": "head",
			"pivot": [0, 8, -1],
			"mirror": true,
			"cubes": [
				{"name": "head", "origin": [-2.5, 8, -6], "size": [5, 4, 5], "uv": [32, 0]}
			]
		},
		{
			"name": "earRight",
			"pivot": [0, 8, -1],
			"rotation": [0, -15, 0],
			"mirror": true,
			"cubes": [
				{"name": "earRight", "origin": [-2.5, 12, -2], "size": [2, 5, 1], "uv": [58, 0]}
			]
		},
		{
			"name": "earLeft",
			"pivot": [0, 8, -1],
			"rotation": [0, 15, 0],
			"mirror": true,
			"cubes": [
				{"name": "earLeft", "origin": [0.5, 12, -2], "size": [2, 5, 1], "uv": [52, 0]}
			]
		},
		{
			"name": "tail",
			"pivot": [0, 4, 7],
			"rotation": [-20, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "tail", "origin": [-1.5, 2.5, 7], "size": [3, 3, 2], "uv": [52, 6]}
			]
		},
		{
			"name": "nose",
			"pivot": [0, 8, -1],
			"mirror": true,
			"cubes": [
				{"name": "nose", "origin": [-0.5, 9.5, -6.5], "size": [1, 1, 1], "uv": [32, 9]}
			]
		}
	]
}`;
skin_presets.ravager = `{
	"name": "ravager",
	"texturewidth": 128,
	"textureheight": 128,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 19, 2],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-7, 10, -2], "size": [14, 16, 20], "uv": [0, 55]},
				{"name": "body", "origin": [-6, -3, -2], "size": [12, 13, 18], "uv": [0, 91]}
			]
		},
		{
			"name": "neck",
			"pivot": [0, 20, -20],
			"cubes": [
				{"name": "neck", "origin": [-5, 21, -10], "size": [10, 10, 18], "uv": [68, 73]}
			]
		},
		{
			"name": "head",
			"parent": "neck",
			"pivot": [0, 28, -10],
			"cubes": [
				{"name": "head", "origin": [-8, 14, -24], "size": [16, 20, 16], "uv": [0, 0]},
				{"name": "head", "origin": [-2, 12, -28], "size": [4, 8, 4], "uv": [0, 0]}
			]
		},
		{
			"name": "mouth",
			"parent": "head",
			"pivot": [0, 15, -10],
			"cubes": [
				{"name": "mouth", "origin": [-8, 13, -24], "size": [16, 3, 16], "uv": [0, 36]}
			]
		},
		{
			"name": "horns",
			"parent": "head",
			"pivot": [-5, 27, -19],
			"rotation": [60, 0, 0],
			"cubes": [
				{"name": "horns", "origin": [-10, 27, -20], "size": [2, 14, 4], "uv": [74, 55]},
				{"name": "horns", "origin": [8, 27, -20], "size": [2, 14, 4], "uv": [74, 55]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-12, 30, 22],
			"cubes": [
				{"name": "leg0", "origin": [-12, 0, 17], "size": [8, 37, 8], "uv": [96, 0]}
			]
		},
		{
			"name": "leg1",
			"pivot": [4, 30, 22],
			"cubes": [
				{"name": "leg1", "origin": [4, 0, 17], "size": [8, 37, 8], "uv": [96, 0]}
			]
		},
		{
			"name": "leg2",
			"pivot": [-4, 26, -4],
			"cubes": [
				{"name": "leg2", "origin": [-12, 0, -8], "size": [8, 37, 8], "uv": [64, 0]}
			]
		},
		{
			"name": "leg3",
			"pivot": [-4, 26, -4],
			"cubes": [
				{"name": "leg3", "origin": [4, 0, -8], "size": [8, 37, 8], "uv": [64, 0]}
			]
		}
	]
}`;
skin_presets.salmon = `{
	"name": "salmon",
	"texturewidth": 32,
	"textureheight": 32,
	"bones": [
		{
			"name": "body_front",
			"pivot": [0, 0, -4],
			"cubes": [
				{"name": "body_front", "origin": [-1.5, 3.5, -4], "size": [3, 5, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "body_back",
			"parent": "body_front",
			"pivot": [0, 0, 4],
			"cubes": [
				{"name": "body_back", "origin": [-1.5, 3.5, 4], "size": [3, 5, 8], "uv": [0, 13]}
			]
		},
		{
			"name": "dorsal_back",
			"parent": "body_back",
			"pivot": [0, 5, 4],
			"cubes": [
				{"name": "dorsal_back", "origin": [0, 8.5, 4], "size": [0, 2, 3], "uv": [2, 3]}
			]
		},
		{
			"name": "tailfin",
			"parent": "body_back",
			"pivot": [0, 0, 12],
			"cubes": [
				{"name": "tailfin", "origin": [0, 3.5, 12], "size": [0, 5, 6], "uv": [20, 10]}
			]
		},
		{
			"name": "dorsal_front",
			"parent": "body_front",
			"pivot": [0, 5, 2],
			"cubes": [
				{"name": "dorsal_front", "origin": [0, 8.5, 2], "size": [0, 2, 2], "uv": [4, 2]}
			]
		},
		{
			"name": "head",
			"parent": "body_front",
			"pivot": [0, 3, -4],
			"cubes": [
				{"name": "head", "origin": [-1, 4.5, -7], "size": [2, 4, 3], "uv": [22, 0]}
			]
		},
		{
			"name": "leftFin",
			"parent": "body_front",
			"pivot": [1.5, 1, -4],
			"rotation": [0, 0, 35],
			"cubes": [
				{"name": "leftFin", "origin": [-0.50752, 3.86703, -4], "size": [2, 0, 2], "uv": [2, 0]}
			]
		},
		{
			"name": "rightFin",
			"parent": "body_front",
			"pivot": [-1.5, 1, -4],
			"rotation": [0, 0, -35],
			"cubes": [
				{"name": "rightFin", "origin": [-1.49258, 3.86703, -4], "size": [2, 0, 2], "uv": [-2, 0]}
			]
		}
	]
}`;
skin_presets.sheep = `{
	"name": "sheep",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 19, 2],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 13, -5], "size": [8, 16, 6], "uv": [28, 8]},
				{"name": "body", "origin": [-4, 13, -5], "size": [8, 16, 6], "uv": [28, 40], "inflate": 1.75}
			]
		},
		{
			"name": "head",
			"pivot": [0, 18, -8],
			"cubes": [
				{"name": "head", "origin": [-3, 16, -14], "size": [6, 6, 8], "uv": [0, 0]},
				{"name": "head", "origin": [-3, 16, -12], "size": [6, 6, 6], "uv": [0, 32], "inflate": 0.6}
			]
		},
		{
			"name": "leg0",
			"pivot": [-3, 12, 7],
			"cubes": [
				{"name": "leg0", "origin": [-5, 0, 5], "size": [4, 12, 4], "uv": [0, 16]},
				{"name": "leg0", "origin": [-5, 6, 5], "size": [4, 6, 4], "uv": [0, 48], "inflate": 0.5}
			]
		},
		{
			"name": "leg1",
			"pivot": [3, 12, 7],
			"cubes": [
				{"name": "leg1", "origin": [1, 0, 5], "size": [4, 12, 4], "uv": [0, 16]},
				{"name": "leg1", "origin": [1, 6, 5], "size": [4, 6, 4], "uv": [0, 48], "inflate": 0.5}
			]
		},
		{
			"name": "leg2",
			"pivot": [-3, 12, -5],
			"cubes": [
				{"name": "leg2", "origin": [-5, 0, -7], "size": [4, 12, 4], "uv": [0, 16]},
				{"name": "leg2", "origin": [-5, 6, -7], "size": [4, 6, 4], "uv": [0, 48], "inflate": 0.5}
			]
		},
		{
			"name": "leg3",
			"pivot": [3, 12, -5],
			"cubes": [
				{"name": "leg3", "origin": [1, 0, -7], "size": [4, 12, 4], "uv": [0, 16]},
				{"name": "leg3", "origin": [1, 6, -7], "size": [4, 6, 4], "uv": [0, 48], "inflate": 0.5}
			]
		}
	]
}`;
skin_presets.shield = `{
	"name": "shield",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "shield",
			"pivot": [1, 15.5, 3],
			"cubes": [
				{"name": "shield", "origin": [0, 25, 0], "size": [2, 6, 6], "uv": [26, 0]},
				{"name": "shield", "origin": [-5, 17, -1], "size": [12, 22, 1], "uv": [0, 0]}
			]
		}
	]
}`;
skin_presets.shulker = `{
	"name": "shulker",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "base",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "base", "origin": [-8, 0, -8], "size": [16, 8, 16], "uv": [0, 28]}
			]
		},
		{
			"name": "lid",
			"parent": "base",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "lid", "origin": [-8, 13, -8], "size": [16, 12, 16], "uv": [0, 0]}
			]
		},
		{
			"name": "head",
			"parent": "base",
			"pivot": [0, 12, 0],
			"cubes": [
				{"name": "head", "origin": [-3, 6, -3], "size": [6, 6, 6], "uv": [0, 52]}
			]
		}
	]
}`;
skin_presets.shulker_bullet = `{
	"name": "shulker_bullet",
	"texturewidth": 64,
	"textureheight": 32,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-4, -4, -1], "size": [8, 8, 2], "uv": [0, 0]},
				{"name": "body", "origin": [-1, -4, -4], "size": [2, 8, 8], "uv": [0, 10]},
				{"name": "body", "origin": [-4, -1, -4], "size": [8, 2, 8], "uv": [20, 0]}
			]
		}
	]
}`;
skin_presets.silverfish = `{
	"name": "silverfish",
	"texturewidth": 64,
	"textureheight": 32,
	"bones": [
		{
			"name": "bodyPart_2",
			"pivot": [0, 4, 1],
			"cubes": [
				{"name": "bodyPart_2", "origin": [-3, 0, -0.5], "size": [6, 4, 3], "uv": [0, 9]}
			]
		},
		{
			"name": "bodyPart_0",
			"parent": "bodyPart_2",
			"pivot": [0, 2, -3.5],
			"cubes": [
				{"name": "bodyPart_0", "origin": [-1.5, 0, -4.5], "size": [3, 2, 2], "uv": [0, 0]}
			]
		},
		{
			"name": "bodyPart_1",
			"parent": "bodyPart_2",
			"pivot": [0, 3, -1.5],
			"cubes": [
				{"name": "bodyPart_1", "origin": [-2, 0, -2.5], "size": [4, 3, 2], "uv": [0, 4]}
			]
		},
		{
			"name": "bodyLayer_2",
			"parent": "bodyPart_1",
			"pivot": [0, 5, -1.5],
			"cubes": [
				{"name": "bodyLayer_2", "origin": [-3, 0, -3], "size": [6, 5, 2], "uv": [20, 18]}
			]
		},
		{
			"name": "bodyPart_3",
			"parent": "bodyPart_2",
			"pivot": [0, 3, 4],
			"cubes": [
				{"name": "bodyPart_3", "origin": [-1.5, 0, 2.5], "size": [3, 3, 3], "uv": [0, 16]}
			]
		},
		{
			"name": "bodyPart_4",
			"parent": "bodyPart_2",
			"pivot": [0, 2, 7],
			"cubes": [
				{"name": "bodyPart_4", "origin": [-1, 0, 5.5], "size": [2, 2, 3], "uv": [0, 22]}
			]
		},
		{
			"name": "bodyLayer_1",
			"parent": "bodyPart_4",
			"pivot": [0, 4, 7],
			"cubes": [
				{"name": "bodyLayer_1", "origin": [-3, 0, 5.5], "size": [6, 4, 3], "uv": [20, 11]}
			]
		},
		{
			"name": "bodyPart_5",
			"parent": "bodyPart_2",
			"pivot": [0, 1, 9.5],
			"cubes": [
				{"name": "bodyPart_5", "origin": [-1, 0, 8.5], "size": [2, 1, 2], "uv": [11, 0]}
			]
		},
		{
			"name": "bodyPart_6",
			"parent": "bodyPart_2",
			"pivot": [0, 1, 11.5],
			"cubes": [
				{"name": "bodyPart_6", "origin": [-0.5, 0, 10.5], "size": [1, 1, 2], "uv": [13, 4]}
			]
		},
		{
			"name": "bodyLayer_0",
			"parent": "bodyPart_2",
			"pivot": [0, 8, 1],
			"cubes": [
				{"name": "bodyLayer_0", "origin": [-5, 0, -0.5], "size": [10, 8, 3], "uv": [20, 0]}
			]
		}
	]
}`;
skin_presets.skeleton = `{
	"name": "skeleton",
	"texturewidth": 64,
	"textureheight": 32,
	"eyes": [
		[9, 12, 2, 1],
		[13, 12, 2, 1]
	],
	"bones": [
		{
			"name": "waist",
			"pivot": [0, 12, 0]
		},
		{
			"name": "body",
			"parent": "waist",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "hat",
			"parent": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "hat", "visibility": false, "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0], "inflate": 0.5}
			]
		},
		{
			"name": "rightArm",
			"parent": "body",
			"pivot": [-5, 22, 0],
			"cubes": [
				{"name": "rightArm", "origin": [-6, 12, -1], "size": [2, 12, 2], "uv": [40, 16]}
			]
		},
		{
			"name": "rightItem",
			"parent": "rightArm",
			"pivot": [-6, 15, 1]
		},
		{
			"name": "leftArm",
			"parent": "body",
			"pivot": [5, 22, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftArm", "origin": [4, 12, -1], "size": [2, 12, 2], "uv": [40, 16]}
			]
		},
		{
			"name": "leftItem",
			"parent": "leftArm",
			"pivot": [6, 15, 1]
		},
		{
			"name": "rightLeg",
			"parent": "body",
			"pivot": [-2, 12, 0],
			"cubes": [
				{"name": "rightLeg", "origin": [-3, 0, -1], "size": [2, 12, 2], "uv": [0, 16]}
			]
		},
		{
			"name": "leftLeg",
			"parent": "body",
			"pivot": [2, 12, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftLeg", "origin": [1, 0, -1], "size": [2, 12, 2], "uv": [0, 16]}
			]
		}
	]
}`;
skin_presets.slime = `{
	"name": "slime",
	"texturewidth": 64,
	"textureheight": 32,
	"bones": [
		{
			"name": "inner",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "cube", "origin": [-3, 1, -3], "size": [6, 6, 6], "uv": [0, 16]},
				{"name": "eye0", "origin": [-3.3, 4, -3.5], "size": [2, 2, 2], "uv": [32, 0]},
				{"name": "eye1", "origin": [1.3, 4, -3.5], "size": [2, 2, 2], "uv": [32, 4]},
				{"name": "mouth", "origin": [0, 2, -3.5], "size": [1, 1, 1], "uv": [32, 8]}
			]
		},
		{
			"name": "outer",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "cube layer", "visibility": false, "origin": [-4, 0, -4], "size": [8, 8, 8], "uv": [0, 0]},
				{"name": "eye0 layer", "visibility": false, "origin": [-3.3, 4, -3.5], "size": [2, 2, 2], "uv": [32, 0]},
				{"name": "eye1 layer", "visibility": false, "origin": [1.3, 4, -3.5], "size": [2, 2, 2], "uv": [32, 4]},
				{"name": "mouth layer", "visibility": false, "origin": [0, 2, -3.5], "size": [1, 1, 1], "uv": [32, 8]}
			]
		}
	]
}`;
skin_presets.snowgolem = `{
	"name": "snowgolem",
	"texturewidth": 64,
	"textureheight": 64,
	"eyes": [
		[9, 11],
		[13, 11]
	],
	"bones": [
		{
			"name": "piece2",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "piece2", "origin": [-6, 0, -6], "size": [12, 12, 12], "uv": [0, 36], "inflate": -0.5}
			]
		},
		{
			"name": "piece1",
			"parent": "piece2",
			"pivot": [0, 11, 0],
			"cubes": [
				{"name": "piece1", "origin": [-5, 11, -5], "size": [10, 10, 10], "uv": [0, 16], "inflate": -0.5}
			]
		},
		{
			"name": "head",
			"parent": "piece1",
			"pivot": [0, 20, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 20, -4], "size": [8, 8, 8], "uv": [0, 0], "inflate": -0.5}
			]
		},
		{
			"name": "arm1",
			"parent": "piece1",
			"pivot": [0, 18, 0],
			"rotation": [0, 0, 45],
			"cubes": [
				{"name": "arm1", "origin": [1, 20, -1], "size": [12, 2, 2], "uv": [32, 0], "inflate": -0.5}
			]
		},
		{
			"name": "arm2",
			"parent": "piece1",
			"pivot": [0, 18, 0],
			"rotation": [0, 0, 135],
			"cubes": [
				{"name": "arm2", "origin": [1, 14, -1], "size": [12, 2, 2], "uv": [32, 0], "inflate": -0.5}
			]
		}
	]
}`;
skin_presets.spider = `{
	"name": "spider",
	"texturewidth": 64,
	"textureheight": 32,
	"bones": [
		{
			"name": "head",
			"pivot": [0, 9, -3],
			"cubes": [
				{"name": "head", "origin": [-4, 5, -11], "size": [8, 8, 8], "uv": [32, 4]}
			]
		},
		{
			"name": "body0",
			"pivot": [0, 9, 0],
			"cubes": [
				{"name": "body0", "origin": [-3, 6, -3], "size": [6, 6, 6], "uv": [0, 0]}
			]
		},
		{
			"name": "body1",
			"pivot": [0, 9, 9],
			"cubes": [
				{"name": "body1", "origin": [-5, 5, 3], "size": [10, 8, 12], "uv": [0, 12]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-4, 9, 2],
			"rotation": [0, 45, -45],
			"cubes": [
				{"name": "leg0", "origin": [-19, 8, 1], "size": [16, 2, 2], "uv": [18, 0]}
			]
		},
		{
			"name": "leg1",
			"pivot": [4, 9, 2],
			"rotation": [0, -45, 45],
			"cubes": [
				{"name": "leg1", "origin": [3, 8, 1], "size": [16, 2, 2], "uv": [18, 0]}
			]
		},
		{
			"name": "leg2",
			"pivot": [-4, 9, 1],
			"rotation": [0, 15, -35],
			"cubes": [
				{"name": "leg2", "origin": [-19, 8, 0], "size": [16, 2, 2], "uv": [18, 0]}
			]
		},
		{
			"name": "leg3",
			"pivot": [4, 9, 1],
			"rotation": [0, -15, 35],
			"cubes": [
				{"name": "leg3", "origin": [3, 8, 0], "size": [16, 2, 2], "uv": [18, 0]}
			]
		},
		{
			"name": "leg4",
			"pivot": [-4, 9, 0],
			"rotation": [0, -15, -35],
			"cubes": [
				{"name": "leg4", "origin": [-19, 8, -1], "size": [16, 2, 2], "uv": [18, 0]}
			]
		},
		{
			"name": "leg5",
			"pivot": [4, 9, 0],
			"rotation": [0, 15, 35],
			"cubes": [
				{"name": "leg5", "origin": [3, 8, -1], "size": [16, 2, 2], "uv": [18, 0]}
			]
		},
		{
			"name": "leg6",
			"pivot": [-4, 9, -1],
			"rotation": [0, -45, -45],
			"cubes": [
				{"name": "leg6", "origin": [-19, 8, -2], "size": [16, 2, 2], "uv": [18, 0]}
			]
		},
		{
			"name": "leg7",
			"pivot": [4, 9, -1],
			"rotation": [0, 45, 45],
			"cubes": [
				{"name": "leg7", "origin": [3, 8, -2], "size": [16, 2, 2], "uv": [18, 0]}
			]
		}
	]
}`;
skin_presets.squid = `{
	"name": "squid",
	"texturewidth": 64,
	"textureheight": 32,
	"eyes": [
		[14, 18],
		[20, 18]
	],
	"bones": [
		{
			"name": "body",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-6, -8, -6], "size": [12, 16, 12], "uv": [0, 0]}
			]
		},
		{
			"name": "tentacle1",
			"pivot": [5, -7, 0],
			"rotation": [0, 90, 0],
			"cubes": [
				{"name": "tentacle1", "origin": [4, -25, -1], "size": [2, 18, 2], "uv": [48, 0]}
			]
		},
		{
			"name": "tentacle2",
			"pivot": [3.5, -7, 3.5],
			"rotation": [0, 45, 0],
			"cubes": [
				{"name": "tentacle2", "origin": [2.5, -25, 2.5], "size": [2, 18, 2], "uv": [48, 0]}
			]
		},
		{
			"name": "tentacle3",
			"pivot": [0, -7, 5],
			"cubes": [
				{"name": "tentacle3", "origin": [-1, -25, 4], "size": [2, 18, 2], "uv": [48, 0]}
			]
		},
		{
			"name": "tentacle4",
			"pivot": [-3.5, -7, 3.5],
			"rotation": [0, -45, 0],
			"cubes": [
				{"name": "tentacle4", "origin": [-4.5, -25, 2.5], "size": [2, 18, 2], "uv": [48, 0]}
			]
		},
		{
			"name": "tentacle5",
			"pivot": [-5, -7, 0],
			"rotation": [0, -90, 0],
			"cubes": [
				{"name": "tentacle5", "origin": [-6, -25, -1], "size": [2, 18, 2], "uv": [48, 0]}
			]
		},
		{
			"name": "tentacle6",
			"pivot": [-3.5, -7, -3.5],
			"rotation": [0, -135, 0],
			"cubes": [
				{"name": "tentacle6", "origin": [-4.5, -25, -4.5], "size": [2, 18, 2], "uv": [48, 0]}
			]
		},
		{
			"name": "tentacle7",
			"pivot": [0, -7, -5],
			"rotation": [0, -180, 0],
			"cubes": [
				{"name": "tentacle7", "origin": [-1, -25, -6], "size": [2, 18, 2], "uv": [48, 0]}
			]
		},
		{
			"name": "tentacle8",
			"pivot": [3.5, -7, -3.5],
			"rotation": [0, -225, 0],
			"cubes": [
				{"name": "tentacle8", "origin": [2.5, -25, -4.5], "size": [2, 18, 2], "uv": [48, 0]}
			]
		}
	]
}`;
skin_presets.tropicalfish_a = `{
	"name": "tropicalfish_a",
	"texturewidth": 32,
	"textureheight": 32,
	"bones": [
		{
			"name": "body",
			"pivot": [-0.5, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-1, 0, -3], "size": [2, 3, 6], "uv": [0, 0]},
				{"name": "body", "origin": [0, 3, -2.9992], "size": [0, 4, 6], "uv": [10, -6]}
			]
		},
		{
			"name": "tailfin",
			"parent": "body",
			"pivot": [0, 0, 3],
			"cubes": [
				{"name": "tailfin", "origin": [0, 0, 3], "size": [0, 3, 4], "uv": [24, -4]}
			]
		},
		{
			"name": "leftFin",
			"parent": "body",
			"pivot": [0.5, 0, 1],
			"rotation": [0, -35, 0],
			"cubes": [
				{"name": "leftFin", "origin": [0.336, 0, -0.10594], "size": [2, 2, 0], "uv": [2, 12]}
			]
		},
		{
			"name": "rightFin",
			"parent": "body",
			"pivot": [-0.5, 0, 1],
			"rotation": [0, 35, 0],
			"cubes": [
				{"name": "rightFin", "origin": [-2.336, 0, -0.10594], "size": [2, 2, 0], "uv": [2, 16]}
			]
		}
	]
}`;
skin_presets.tropicalfish_b = `{
	"name": "tropicalfish_b",
	"texturewidth": 32,
	"textureheight": 32,
	"bones": [
		{
			"name": "body",
			"pivot": [-0.5, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-1, 0, -0.0008], "size": [2, 6, 6], "uv": [0, 20]},
				{"name": "body", "origin": [0, -5, -0.0008], "size": [0, 5, 6], "uv": [20, 21]},
				{"name": "body", "origin": [0, 6, -0.0008], "size": [0, 5, 6], "uv": [20, 10]}
			]
		},
		{
			"name": "tailfin",
			"parent": "body",
			"pivot": [0, 0, 6],
			"cubes": [
				{"name": "tailfin", "origin": [0, 0.0008, 6], "size": [0, 6, 5], "uv": [21, 16]}
			]
		},
		{
			"name": "leftFin",
			"parent": "body",
			"pivot": [0.5, 0, 1],
			"rotation": [0, -35, 0],
			"cubes": [
				{"name": "leftFin", "origin": [2.05673, 0, 2.35152], "size": [2, 2, 0], "uv": [2, 12]}
			]
		},
		{
			"name": "rightFin",
			"parent": "body",
			"pivot": [-0.5, 0, 1],
			"rotation": [0, 35, 0],
			"cubes": [
				{"name": "rightFin", "origin": [-4.05673, 0, 2.35152], "size": [2, 2, 0], "uv": [2, 16]}
			]
		}
	]
}`;
skin_presets.turtle = `{
	"name": "turtle",
	"texturewidth": 128,
	"textureheight": 64,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 13, -10],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-9.5, -10, -20], "size": [19, 20, 6], "uv": [6, 37]},
				{"name": "body", "origin": [-5.5, -8, -23], "size": [11, 18, 3], "uv": [30, 1]}
			]
		},
		{
			"name": "eggbelly",
			"parent": "body",
			"pivot": [0, 13, -10],
			"cubes": [
				{"name": "eggbelly", "origin": [-4.5, -8, -24], "size": [9, 18, 1], "uv": [69, 33]}
			]
		},
		{
			"name": "head",
			"pivot": [0, 5, -10],
			"cubes": [
				{"name": "head", "origin": [-3, 1, -13], "size": [6, 5, 6], "uv": [2, 0]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-3.5, 2, 11],
			"cubes": [
				{"name": "leg0", "origin": [-5.5, 1, 11], "size": [4, 1, 10], "uv": [0, 23]}
			]
		},
		{
			"name": "leg1",
			"pivot": [3.5, 2, 11],
			"cubes": [
				{"name": "leg1", "origin": [1.5, 1, 11], "size": [4, 1, 10], "uv": [0, 12]}
			]
		},
		{
			"name": "leg2",
			"pivot": [-5, 3, -4],
			"rotation": [0, 10, 0],
			"cubes": [
				{"name": "leg2", "origin": [-18, 2, -6], "size": [13, 1, 5], "uv": [26, 30]}
			]
		},
		{
			"name": "leg3",
			"pivot": [5, 3, -4],
			"rotation": [0, -10, 0],
			"cubes": [
				{"name": "leg3", "origin": [5, 2, -6], "size": [13, 1, 5], "uv": [26, 24]}
			]
		}
	]
}`;
skin_presets.vex = `{
	"name": "vex",
	"texturewidth": 64,
	"textureheight": 64,
	"eyes": [
		[9, 12, 2, 1],
		[13, 12, 2, 1]
	],
	"bones": [
		{
			"name": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "body",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}
			]
		},
		{
			"name": "rightArm",
			"pivot": [-5, 22, 0],
			"cubes": [
				{"name": "rightArm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}
			]
		},
		{
			"name": "rightItem",
			"pivot": [-6, 13, 0]
		},
		{
			"name": "leftArm",
			"pivot": [5, 22, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftArm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-1.9, 12, 0],
			"cubes": [
				{"name": "leg0", "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]},
				{"name": "leg0", "origin": [-2.9, 3, -2], "size": [6, 10, 4], "uv": [32, 0]}
			]
		},
		{
			"name": "leftwing",
			"pivot": [0, 24, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftwing", "origin": [0, 12, 0], "size": [20, 12, 1], "uv": [0, 32]}
			]
		},
		{
			"name": "rightwing",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "rightwing", "origin": [-20, 12, 0], "size": [20, 12, 1], "uv": [0, 32]}
			]
		}
	]
}`;
skin_presets.villager = `{
	"name": "villager",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 24, -4], "size": [8, 10, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "nose",
			"parent": "head",
			"pivot": [0, 26, 0],
			"cubes": [
				{"name": "nose", "origin": [-1, 23, -6], "size": [2, 4, 2], "uv": [24, 0]}
			]
		},
		{
			"name": "body",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 12, -3], "size": [8, 12, 6], "uv": [16, 20]},
				{"name": "body", "origin": [-4, 6, -3], "size": [8, 18, 6], "uv": [0, 38], "inflate": 0.5}
			]
		},
		{
			"name": "arms",
			"pivot": [0, 22, 0],
			"rotation": [-45, 0, 0],
			"cubes": [
				{"name": "arms", "origin": [-4, 16, -2], "size": [8, 4, 4], "uv": [40, 38]},
				{"name": "arms", "origin": [-8, 16, -2], "size": [4, 8, 4], "uv": [44, 22]},
				{"name": "arms", "origin": [4, 16, -2], "size": [4, 8, 4], "uv": [44, 22]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-2, 12, 0],
			"cubes": [
				{"name": "leg0", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		},
		{
			"name": "leg1",
			"pivot": [2, 12, 0],
			"cubes": [
				{"name": "leg1", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		}
	]
}`;
skin_presets.villager_v2 = `{
	"name": "villager_v2",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "body",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 12, -3], "size": [8, 12, 6], "uv": [16, 20]},
				{"name": "body", "origin": [-4, 6, -3], "size": [8, 18, 6], "uv": [0, 38], "inflate": 0.5}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 24, -4], "size": [8, 10, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "helmet",
			"parent": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "helmet", "origin": [-4, 24, -4], "size": [8, 10, 8], "uv": [32, 0], "inflate": 0.5}
			]
		},
		{
			"name": "brim",
			"parent": "head",
			"pivot": [0, 24, 0],
			"rotation": [-90, 0, 0],
			"cubes": [
				{"name": "brim", "origin": [-8, 16, -6], "size": [16, 16, 1], "uv": [30, 47], "inflate": 0.1}
			]
		},
		{
			"name": "nose",
			"parent": "head",
			"pivot": [0, 26, 0],
			"cubes": [
				{"name": "nose", "origin": [-1, 23, -6], "size": [2, 4, 2], "uv": [24, 0]}
			]
		},
		{
			"name": "arms",
			"parent": "body",
			"pivot": [0, 22, 0],
			"rotation": [-45, 0, 0],
			"cubes": [
				{"name": "arms", "origin": [-4, 16, -2], "size": [8, 4, 4], "uv": [40, 38]},
				{"name": "arms", "origin": [-8, 16, -2], "size": [4, 8, 4], "uv": [44, 22]},
				{"name": "arms", "origin": [4, 16, -2], "size": [4, 8, 4], "uv": [44, 22], "mirror": true}
			]
		},
		{
			"name": "leg0",
			"parent": "body",
			"pivot": [-2, 12, 0],
			"cubes": [
				{"name": "leg0", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		},
		{
			"name": "leg1",
			"parent": "body",
			"pivot": [2, 12, 0],
			"cubes": [
				{"name": "leg1", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22], "mirror": true}
			]
		}
	]
}`;
skin_presets.vindicator = `{
	"name": "vindicator",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 24, -4], "size": [8, 10, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "nose",
			"parent": "head",
			"pivot": [0, 26, 0],
			"cubes": [
				{"name": "nose", "origin": [-1, 23, -6], "size": [2, 4, 2], "uv": [24, 0]}
			]
		},
		{
			"name": "body",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 12, -3], "size": [8, 12, 6], "uv": [16, 20]},
				{"name": "body", "origin": [-4, 6, -3], "size": [8, 18, 6], "uv": [0, 38], "inflate": 0.5}
			]
		},
		{
			"name": "arms",
			"pivot": [0, 22, 0],
			"cubes": [
				{"name": "arms", "origin": [-8, 16, -2], "size": [4, 8, 4], "uv": [44, 22]},
				{"name": "arms", "origin": [4, 16, -2], "size": [4, 8, 4], "uv": [44, 22]},
				{"name": "arms", "origin": [-4, 16, -2], "size": [8, 4, 4], "uv": [40, 38]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-2, 12, 0],
			"cubes": [
				{"name": "leg0", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		},
		{
			"name": "leg1",
			"pivot": [2, 12, 0],
			"mirror": true,
			"cubes": [
				{"name": "leg1", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		},
		{
			"name": "rightArm",
			"pivot": [-5, 22, 0],
			"cubes": [
				{"name": "rightArm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 46]}
			]
		},
		{
			"name": "rightItem",
			"parent": "rightArm",
			"pivot": [-5.5, 16, 0.5]
		},
		{
			"name": "leftArm",
			"pivot": [5, 22, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftArm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [40, 46]}
			]
		}
	]
}`;
skin_presets.witch = `{
	"name": "witch",
	"texturewidth": 64,
	"textureheight": 128,
	"bones": [
		{
			"name": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 24, -4], "size": [8, 10, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "nose",
			"parent": "head",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "nose", "origin": [-1, 23, -6], "size": [2, 4, 2], "uv": [24, 0]},
				{"name": "nose", "origin": [0, 25, -6.75], "size": [1, 1, 1], "uv": [0, 0], "inflate": -0.25}
			]
		},
		{
			"name": "hat",
			"parent": "head",
			"pivot": [-5, 32.03125, -5],
			"cubes": [
				{"name": "hat", "origin": [-5, 32.05, -5], "size": [10, 2, 10], "uv": [0, 64]}
			]
		},
		{
			"name": "hat2",
			"parent": "hat",
			"pivot": [1.75, 32, 2],
			"rotation": [-3, 0, 1.5],
			"cubes": [
				{"name": "hat2", "origin": [-3.25, 33.5, -3], "size": [7, 4, 7], "uv": [0, 76]}
			]
		},
		{
			"name": "hat3",
			"parent": "hat2",
			"pivot": [1.75, 35, 2],
			"rotation": [-6, 0, 3],
			"cubes": [
				{"name": "hat3", "origin": [-1.5, 36.5, -1], "size": [4, 4, 4], "uv": [0, 87]}
			]
		},
		{
			"name": "hat4",
			"parent": "hat3",
			"pivot": [1.75, 38, 2],
			"rotation": [-12, 0, 6],
			"cubes": [
				{"name": "hat4", "origin": [0.25, 40, 1], "size": [1, 2, 1], "uv": [0, 95], "inflate": 0.25}
			]
		},
		{
			"name": "body",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 12, -3], "size": [8, 12, 6], "uv": [16, 20]},
				{"name": "body", "origin": [-4, 6, -3], "size": [8, 18, 6], "uv": [0, 38], "inflate": 0.5}
			]
		},
		{
			"name": "arms",
			"pivot": [0, 22, 0],
			"rotation": [-45, 0, 0],
			"cubes": [
				{"name": "arms", "origin": [-4, 16, -2], "size": [8, 4, 4], "uv": [40, 38]},
				{"name": "arms", "origin": [-8, 16, -2], "size": [4, 8, 4], "uv": [44, 22]},
				{"name": "arms", "origin": [4, 16, -2], "size": [4, 8, 4], "uv": [44, 22]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-2, 12, 0],
			"cubes": [
				{"name": "leg0", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		},
		{
			"name": "leg1",
			"pivot": [2, 12, 0],
			"cubes": [
				{"name": "leg1", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		}
	]
}`;
skin_presets.witherBoss = `{
	"name": "witherBoss",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "upperBodyPart1",
			"pivot": [0, 0, 0],
			"cubes": [
				{"name": "upperBodyPart1", "origin": [-10, 17.1, -0.5], "size": [20, 3, 3], "uv": [0, 16]}
			]
		},
		{
			"name": "upperBodyPart2",
			"parent": "upperBodyPart1",
			"pivot": [-2, 17.1, -0.5],
			"cubes": [
				{"name": "upperBodyPart2", "origin": [-2, 7.1, -0.5], "size": [3, 10, 3], "uv": [0, 22]},
				{"name": "upperBodyPart2", "origin": [-6, 13.6, 0], "size": [11, 2, 2], "uv": [24, 22]},
				{"name": "upperBodyPart2", "origin": [-6, 11.1, 0], "size": [11, 2, 2], "uv": [24, 22]},
				{"name": "upperBodyPart2", "origin": [-6, 8.6, 0], "size": [11, 2, 2], "uv": [24, 22]}
			]
		},
		{
			"name": "upperBodyPart3",
			"parent": "upperBodyPart2",
			"pivot": [0, 7, 0],
			"rotation": [45, 0, 0],
			"cubes": [
				{"name": "upperBodyPart3", "origin": [-2, 1, 0], "size": [3, 6, 3], "uv": [12, 22]}
			]
		},
		{
			"name": "head1",
			"parent": "upperBodyPart1",
			"pivot": [0, 20, 0],
			"cubes": [
				{"name": "head1", "origin": [-4, 20, -4], "size": [8, 8, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "head2",
			"parent": "upperBodyPart1",
			"pivot": [-9, 18, -1],
			"cubes": [
				{"name": "head2", "origin": [-12, 18, -4], "size": [6, 6, 6], "uv": [32, 0]}
			]
		},
		{
			"name": "head3",
			"parent": "upperBodyPart1",
			"pivot": [9, 18, -1],
			"cubes": [
				{"name": "head3", "origin": [6, 18, -4], "size": [6, 6, 6], "uv": [32, 0]}
			]
		}
	]
}`;
skin_presets.wolf = `{
	"name": "wolf",
	"texturewidth": 64,
	"textureheight": 32,
	"bones": [
		{
			"name": "head",
			"pivot": [-1, 10.5, -7],
			"cubes": [
				{"name": "head", "origin": [-4, 7.5, -9], "size": [6, 6, 4], "uv": [0, 0]},
				{"name": "head", "origin": [-4, 13.5, -7], "size": [2, 2, 1], "uv": [16, 14]},
				{"name": "head", "origin": [0, 13.5, -7], "size": [2, 2, 1], "uv": [16, 14]},
				{"name": "head", "origin": [-2.5, 7.51563, -12], "size": [3, 3, 4], "uv": [0, 10]}
			]
		},
		{
			"name": "body",
			"pivot": [0, 10, 2],
			"rotation": [90, 0, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 3, -1], "size": [6, 9, 6], "uv": [18, 14]}
			]
		},
		{
			"name": "upperBody",
			"pivot": [-1, 10, 2],
			"rotation": [-90, 0, 0],
			"cubes": [
				{"name": "upperBody", "origin": [-5, 2, -2], "size": [8, 6, 7], "uv": [21, 0]}
			]
		},
		{
			"name": "leg0",
			"pivot": [-2.5, 8, 7],
			"cubes": [
				{"name": "leg0", "origin": [-3.5, 0, 6], "size": [2, 8, 2], "uv": [0, 18]}
			]
		},
		{
			"name": "leg1",
			"pivot": [0.5, 8, 7],
			"cubes": [
				{"name": "leg1", "origin": [-0.5, 0, 6], "size": [2, 8, 2], "uv": [0, 18]}
			]
		},
		{
			"name": "leg2",
			"pivot": [-2.5, 8, -4],
			"cubes": [
				{"name": "leg2", "origin": [-3.5, 0, -5], "size": [2, 8, 2], "uv": [0, 18]}
			]
		},
		{
			"name": "leg3",
			"pivot": [0.5, 8, -4],
			"cubes": [
				{"name": "leg3", "origin": [-0.5, 0, -5], "size": [2, 8, 2], "uv": [0, 18]}
			]
		},
		{
			"name": "tail",
			"pivot": [-1, 12, 8],
			"rotation": [55, 0, 0],
			"cubes": [
				{"name": "tail", "origin": [-2, 4, 7], "size": [2, 8, 2], "uv": [9, 18]}
			]
		}
	]
}`;
skin_presets.zombie = `{
	"name": "zombie",
	"texturewidth": 64,
	"textureheight": 32,
	"eyes": [
		[9, 12, 2, 1],
		[13, 12, 2, 1]
	],
	"bones": [
		{
			"name": "body",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 24, 0],
			"rotation": [3, -10, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]},
				{"name": "hat", "visibility": false, "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0], "inflate": 0.5}
			]
		},
		{
			"name": "rightArm",
			"parent": "body",
			"pivot": [-5, 22, 0],
			"rotation": [-80, -5, 0],
			"cubes": [
				{"name": "rightArm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}
			]
		},
		{
			"name": "rightItem",
			"parent": "rightArm",
			"pivot": [-6, 15, 1]
		},
		{
			"name": "leftArm",
			"parent": "body",
			"pivot": [5, 22, 0],
			"rotation": [-75, 5, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftArm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}
			]
		},
		{
			"name": "rightLeg",
			"parent": "body",
			"pivot": [-1.9, 12, 0],
			"rotation": [-25, 0, 5],
			"cubes": [
				{"name": "rightLeg", "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}
			]
		},
		{
			"name": "leftLeg",
			"parent": "body",
			"pivot": [1.9, 12, 0],
			"rotation": [20, 0, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftLeg", "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}
			]
		}
	]
}`;
skin_presets.zombie_villager_1 = `{
	"name": "zombie_villager_1",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 24, -4], "size": [8, 10, 8], "uv": [0, 0], "inflate": 0.25},
				{"name": "head", "origin": [-1, 23, -6], "size": [2, 4, 2], "uv": [24, 0], "inflate": 0.25}
			]
		},
		{
			"name": "body",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 12, -3], "size": [8, 12, 6], "uv": [16, 20]},
				{"name": "body", "origin": [-4, 6, -3], "size": [8, 18, 6], "uv": [0, 38], "inflate": 0.5}
			]
		},
		{
			"name": "waist",
			"pivot": [0, 12, 0]
		},
		{
			"name": "rightArm",
			"pivot": [-5, 22, 0],
			"cubes": [
				{"name": "rightArm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [44, 38]}
			]
		},
		{
			"name": "rightItem",
			"parent": "rightArm",
			"pivot": [-6, 15, 1]
		},
		{
			"name": "leftArm",
			"pivot": [5, 22, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftArm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [44, 38]}
			]
		},
		{
			"name": "rightLeg",
			"pivot": [-2, 12, 0],
			"cubes": [
				{"name": "rightLeg", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		},
		{
			"name": "leftLeg",
			"pivot": [2, 12, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftLeg", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		}
	]
}`;
skin_presets.zombie_villager_2 = `{
	"name": "zombie_villager_2",
	"texturewidth": 64,
	"textureheight": 64,
	"bones": [
		{
			"name": "waist",
			"pivot": [0, 12, 0]
		},
		{
			"name": "body",
			"parent": "waist",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "body", "origin": [-4, 12, -3], "size": [8, 12, 6], "uv": [16, 20]},
				{"name": "body", "origin": [-4, 6, -3], "size": [8, 18, 6], "uv": [0, 38], "inflate": 0.5}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "head", "origin": [-4, 24, -4], "size": [8, 10, 8], "uv": [0, 0], "inflate": 0.25},
				{"name": "head", "origin": [-1, 23, -6], "size": [2, 4, 2], "uv": [24, 0], "inflate": 0.25}
			]
		},
		{
			"name": "helmet",
			"parent": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "helmet", "origin": [-4, 24, -4], "size": [8, 10, 8], "uv": [32, 0], "inflate": 0.5}
			]
		},
		{
			"name": "brim",
			"parent": "head",
			"pivot": [0, 24, 0],
			"cubes": [
				{"name": "brim", "origin": [-8, 16, -6], "size": [16, 16, 1], "uv": [30, 47], "inflate": 0.1}
			]
		},
		{
			"name": "rightArm",
			"parent": "body",
			"pivot": [-5, 22, 0],
			"cubes": [
				{"name": "rightArm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [44, 22]}
			]
		},
		{
			"name": "rightItem",
			"parent": "rightArm",
			"pivot": [-6, 15, 1]
		},
		{
			"name": "leftArm",
			"parent": "body",
			"pivot": [5, 22, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftArm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [44, 22]}
			]
		},
		{
			"name": "rightLeg",
			"parent": "body",
			"pivot": [-2, 12, 0],
			"cubes": [
				{"name": "rightLeg", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		},
		{
			"name": "leftLeg",
			"parent": "body",
			"pivot": [2, 12, 0],
			"mirror": true,
			"cubes": [
				{"name": "leftLeg", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
			]
		}
	]
}`;

})()
