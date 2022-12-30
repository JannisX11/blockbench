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

						let template = Codecs.bedrock.compileCube(obj, g);
						cubes.push(template)

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
		this.dispatchEvent('compile', {model: entitymodel, options});
		return entitymodel
	},
	parse(data, resolution, texture_path, pose = true, layer_template) {
		this.dispatchEvent('parse', {model: data});
		Project.texture_width = data.texturewidth || 64;
		Project.texture_height = data.textureheight || 64;

		Interface.Panels.skin_pose.inside_vue.pose = Project.skin_pose = pose ? 'natural' : 'none';

		var bones = {}
		var template_cubes = {};

		if (data.bones) {
			var included_bones = []
			data.bones.forEach(function(b) {
				included_bones.push(b.name)
			})
			data.bones.forEach(function(b, bi) {
				var group = new Group({
					name: b.name,
					origin: b.pivot,
					rotation: (pose && b.pose) ? b.pose : b.rotation
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
				group.skin_original_origin = group.origin.slice();

				if (b.cubes) {
					b.cubes.forEach(function(cube) {

						let base_cube = Codecs.bedrock.parseCube(cube, group);
						template_cubes[Cube.all.indexOf(base_cube)] = cube;

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
		} else if (resolution) {
			var texture = generateTemplate(
				Project.texture_width*resolution,
				Project.texture_height*resolution,
				template_cubes,
				data.name,
				data.eyes,
				layer_template
			)
		}
		for (var index in template_cubes) {
			if (template_cubes[index].visibility === false) {
				Cube.all[index].visibility = false;
			}
		}
		if (texture) {
			texture.load_callback = function() {
				Modes.options.paint.select();
			}
		}
		if (data.camera_angle) {
			main_preview.loadAnglePreset(DefaultCameraPresets.find(p => p.id == data.camera_angle))
		}
		loadTextureDraggable()
		Canvas.updateAllBones()
		Canvas.updateVisibility()
		setProjectTitle()
		updateSelection()
	},
})
codec.export = null;
codec.rebuild = function(model_id, pose) {
	let [preset_id, variant] = model_id.split('.');
	let preset = skin_presets[preset_id];
	let model = JSON.parse(preset.model || (variant == 'java' ? preset.model_java : preset.model_bedrock));
	codec.parse(model, undefined, undefined, pose && pose !== 'none');
	if (pose && pose !== 'none') {
		setTimeout(() => {
			Panels.skin_pose.inside_vue.setPose(pose);
		}, 1)
	}
}


const format = new ModelFormat('skin', {
	icon: 'icon-player',
	category: 'minecraft',
	target: ['Minecraft: Java Edition', 'Minecraft: Bedrock Edition'],
	format_page: {
		content: [
			{type: 'h3', text: tl('mode.start.format.informations')},
			{text: `* ${tl('format.skin.info.skin')}
					* ${tl('format.skin.info.model')}`.replace(/\t+/g, '')
			},
			{type: 'h3', text: tl('mode.start.format.resources')},
			{text: `* [Skin Design Tutorial](https://youtu.be/xC81Q3HGraE)`}
		]
	},
	can_convert_to: false,
	model_identifier: false,
	bone_rig: true,
	box_uv: true,
	centered_grid: true,
	single_texture: true,
	integer_size: true,
	rotate_cubes: false,
	edit_mode: false,
	pose_mode: true,
	codec
})
format.new = function() {
	skin_dialog.show();
	return true;
}
format.presets = skin_presets;

function generateTemplate(width = 64, height = 64, cubes, name = 'name', eyes, layer_template) {

	var texture = new Texture({
		mode: 'bitmap',
		name: name+'.png'
	})

	var canvas = document.createElement('canvas')
	var ctx = canvas.getContext('2d');
	canvas.width = width;
	canvas.height = height;

	if (Project.box_uv) {
		Cube.all.forEach((cube, i) => {
			let template_cube = cubes[i];
			if (layer_template || !template_cube.layer) {
				TextureGenerator.paintCubeBoxTemplate(cube, texture, canvas, null, template_cube.layer);
			}
		})
	} else if (cubes[0] && !cubes[0].layer) {
		ctx.fillStyle = TextureGenerator.face_data.up.c1;
		ctx.fillRect(0, 0, width, height)
		ctx.fillStyle = TextureGenerator.face_data.up.c2;
		ctx.fillRect(1, 1, width-2, height-2)
	}
	if (eyes) {
		var res_multiple = canvas.width/Project.texture_width;
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

const model_options = {};
const skin_dialog = new Dialog({
	title: tl('dialog.skin.title'),
	id: 'skin',
	form: {
		model: {
			label: 'dialog.skin.model',
			type: 'select',
			options: model_options
		},
		variant: {
			label: 'dialog.skin.variant',
			type: 'select',
			default: 'java_edition',
			options: {
				java_edition: 'Java Edition',
				bedrock_edition: 'Bedrock Edition',
			},
			condition(form) {
				return !skin_presets[form.model].model;
			}
		},
		resolution: {label: 'dialog.create_texture.resolution', type: 'select', value: 16, options: {
			16: '16x',
			32: '32x',
			64: '64x',
			128: '128x',
		}},
		resolution_warning: {
			type: 'info', text: 'dialog.skin.high_res_texture',
			condition: (form) => form.resolution != 16 && (form.model == 'steve' || form.model == 'alex')
		},
		texture: {
			label: 'dialog.skin.texture',
			type: 'file',
			extensions: ['png'],
			readtype: 'image',
			filetype: 'PNG',
		},
		pose: {type: 'checkbox', label: 'dialog.skin.pose', value: true, condition: form => (!!skin_presets[form.model].pose)},
		layer_template: {type: 'checkbox', label: 'dialog.skin.layer_template', value: false}
	},
	draggable: true,
	onConfirm(result) {
		if (result.model == 'flat_texture') {
			if (result.texture) {
				Codecs.image.load(dataUrl);
			} else {
				Formats.image.new();
			}

		} else {
			if (newProject(format)) {
				let preset = skin_presets[result.model];
				let model = JSON.parse(preset.model || (result.variant == 'java_edition' ? preset.model_java : preset.model_bedrock));
				codec.parse(model, result.resolution/16, result.texture, result.pose, result.layer_template);
				Project.skin_model = result.model + '.' + (result.variant == 'java_edition' ? 'java' : 'bedrock');
			}
		}
	},
	onCancel() {
		Format = 0;
	}
});
format.setup_dialog = skin_dialog;


BARS.defineActions(function() {
	new Action('toggle_skin_layer', {
		icon: 'layers_clear',
		category: 'edit',
		condition: {formats: ['skin']},
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
			Undo.finishEdit('Toggle skin layer');
			Canvas.updateVisibility()
		}
	})
	new Action({
		id: 'export_minecraft_skin',
		icon: 'icon-player',
		category: 'file',
		condition: () => Format == format && Texture.all[0],
		click: function () {
			Texture.all[0].save(true);
		}
	})
	
	let explode_skin_model = new Toggle('explode_skin_model', {
		icon: () => 'open_in_full',
		category: 'edit',
		condition: {formats: ['skin']},
		value: false,
		onChange(exploded_view) {
			Undo.initEdit({elements: Cube.all, exploded_view: !exploded_view});
			Cube.all.forEach(cube => {
				let center = [
					cube.from[0] + (cube.to[0] - cube.from[0]) / 2,
					cube.from[1],
					cube.from[2] + (cube.to[2] - cube.from[2]) / 2,
				]
				let offset = cube.name.toLowerCase().includes('leg') ? 1 : 0.5;
				center.V3_multiply(exploded_view ? offset : -offset/(1+offset));
				cube.from.V3_add(center);
				cube.to.V3_add(center);
			})
			Project.exploded_view = exploded_view;
			Undo.finishEdit(exploded_view ? 'Explode skin model' : 'Revert exploding skin model', {elements: Cube.all, exploded_view: exploded_view});
			Canvas.updateView({elements: Cube.all, element_aspects: {geometry: true}});
			this.setIcon(this.icon);
		}
	})
	Blockbench.on('select_project', () => {
		explode_skin_model.value = !!Project.exploded_view;
		explode_skin_model.updateEnabledState();
	})
})

Interface.definePanels(function() {
	const poses = {
		none: {
			Head: [0, 0, 0],
			Body: [0, 0, 0],
			RightArm: [0, 0, 0],
			LeftArm: [0, 0, 0],
			RightLeg: [0, 0, 0],
			LeftLeg: [0, 0, 0],
		},
		natural: {
			Head: [6, -5, 0],
			Body: [0, 0, 0],
			RightArm: [10, 0, 0],
			LeftArm: [-12, 0, 0],
			RightLeg: [-11, 0, 2],
			LeftLeg: [10, 0, -2],
		},
		walking: {
			Head: [-2, 0, 0],
			Body: [0, 0, 0],
			RightArm: [-35, 0, 0],
			LeftArm: [35, 0, 0],
			RightLeg: [42, 0, 2],
			LeftLeg: [-42, 0, -2]
		},
		crouching: {
			Head: {rotation: [-5, 0, 0], offset: [0, -1, 0]},
			Body: {rotation: [-28, 0, 0], offset: [0, 0, -1]},
			RightArm: [-15, 0, 0],
			LeftArm: [-40, 0, 0],
			RightLeg: {rotation: [-14, 0, 0], offset: [0, 3, 3.75]},
			LeftLeg: {rotation: [14, 0, 0], offset: [0, 3, 4]}
		},
		sitting: {
			Head: [5.5, 0, 0],
			Body: [0, 0, 0],
			RightArm: [36, 0, 0],
			LeftArm: [36, 0, 0],
			RightLeg: [72, -18, 0],
			LeftLeg: [72, 18, 0]
		},
		jumping: {
			Head: [20, 0, 0],
			Body: [0, 0, 0],
			RightArm: {rotation: [-175, 0, -20], offset: [0, 2, 0]},
			LeftArm: {rotation: [-170, 0, 15], offset: [0, 2, 0]},
			RightLeg: {rotation: [-5, 0, 15], offset: [0, -1, 0]},
			LeftLeg: {rotation: [2.5, 0, -10], offset: [0, 6, -3.75]}
		},
		aiming: {
			Head: [8, -35, 0],
			Body: [-2, 0, 0],
			RightArm: {rotation: [97, -17, -2], offset: [-1, 1, -1]},
			LeftArm: [104, -44, -10],
			RightLeg: {rotation: [2.5, 0, 0], offset: [0, 1, -2]},
			LeftLeg: [-28, 0, 0]
		},
	};
	new Panel('skin_pose', {
		icon: 'icon-player',
		condition: {modes: ['pose']},
		default_position: {
			slot: 'right_bar',
			float_position: [0, 0],
			float_size: [300, 80],
			height: 80
		},
		component: {
			data() {return {
				pose: 'default'
			}},
			methods: {
				setPose(pose) {
					/*let old_angles = poses[this.pose];
					for (let name in old_angles) {
						if (old_angles[name].offset) {
							let group = Group.all.find(g => g.name == name);
							if (group) {
								group.origin.V3_subtract(old_angles[name].offset);
							}
						}
					}*/
					Group.all.forEach(group => {
						if (!group.skin_original_origin) return;
						let offset = group.origin.slice().V3_subtract(group.skin_original_origin);
						group.forEachChild(cube => {
							cube.from.V3_add(offset);
							cube.to.V3_add(offset);
							cube.origin.V3_add(offset);
						}, Cube)
						group.origin.V3_set(group.skin_original_origin);
					})
					this.pose = pose;
					Project.skin_pose = pose;
					let angles = poses[pose];
					for (let name in angles) {
						let group = Group.all.find(g => g.name == name);
						if (group) {
							group.extend({rotation: angles[name].rotation || angles[name]});
							if (angles[name].offset) group.origin.V3_add(angles[name].offset);
						}
					}
					Canvas.updateAllBones();
				}
			},
			template: `
				<div>
					<ul id="skin_pose_selector">
						<li :class="{selected: pose == 'none'}" @click="setPose('none')" title="${tl('panel.skin_pose.none')}"><div class="pose_icon" style="mask-image: url('./assets/poses/none.svg');"/></li>
						<li :class="{selected: pose == 'natural'}" @click="setPose('natural')" title="${tl('panel.skin_pose.natural')}"><div class="pose_icon" style="mask-image: url('./assets/poses/natural.svg');"/></li>
						<li :class="{selected: pose == 'walking'}" @click="setPose('walking')" title="${tl('panel.skin_pose.walking')}"><div class="pose_icon" style="mask-image: url('./assets/poses/walking.svg');"/></li>
						<li :class="{selected: pose == 'crouching'}" @click="setPose('crouching')" title="${tl('panel.skin_pose.crouching')}"><div class="pose_icon" style="mask-image: url('./assets/poses/crouching.svg');"/></li>
						<li :class="{selected: pose == 'sitting'}" @click="setPose('sitting')" title="${tl('panel.skin_pose.sitting')}"><div class="pose_icon" style="mask-image: url('./assets/poses/sitting.svg');"/></li>
						<li :class="{selected: pose == 'jumping'}" @click="setPose('jumping')" title="${tl('panel.skin_pose.jumping')}"><div class="pose_icon" style="mask-image: url('./assets/poses/jumping.svg');"/></li>
						<li :class="{selected: pose == 'aiming'}" @click="setPose('aiming')" title="${tl('panel.skin_pose.aiming')}"><div class="pose_icon" style="mask-image: url('./assets/poses/aiming.svg');"/></li>
					</ul>
				</div>
			`
		}
	})
})

skin_presets.steve = {
	display_name: 'Steve',
	pose: true,
	model: `{
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
				"pose": [-6, 5, 0],
				"cubes": [
					{"name": "Head", "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]},
					{"name": "Hat Layer", "visibility": false, "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0], "inflate": 0.5, "layer": true}
				]
			},
			{
				"name": "Body",
				"color": 3,
				"pivot": [0, 24, 0],
				"cubes": [
					{"name": "Body", "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]},
					{"name": "Body Layer", "visibility": false, "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 32], "inflate": 0.25, "layer": true}
				]
			},
			{
				"name": "Right Arm",
				"color": 5,
				"pivot": [-5, 22, 0],
				"pose": [-10, 0, 0],
				"cubes": [
					{"name": "Right Arm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]},
					{"name": "Right Arm Layer", "visibility": false, "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 32], "inflate": 0.25, "layer": true}
				]
			},
			{
				"name": "Left Arm",
				"color": 0,
				"pivot": [5, 22, 0],
				"pose": [12, 0, 0],
				"cubes": [
					{"name": "Left Arm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [32, 48]},
					{"name": "Left Arm Layer", "visibility": false, "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [48, 48], "inflate": 0.25, "layer": true}
				]
			},
			{
				"name": "Right Leg",
				"color": 6,
				"pivot": [-1.9, 12, 0],
				"pose": [11, 0, 2],
				"cubes": [
					{"name": "Right Leg", "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]},
					{"name": "Right Leg Layer", "visibility": false, "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 32], "inflate": 0.25, "layer": true}
				]
			},
			{
				"name": "Left Leg",
				"color": 7,
				"pivot": [1.9, 12, 0],
				"pose": [-10, 0, -2],
				"cubes": [
					{"name": "Left Leg", "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [16, 48]},
					{"name": "Left Leg Layer", "visibility": false, "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [0, 48], "inflate": 0.25, "layer": true}
				]
			}
		]
	}`
};
skin_presets.alex = {
	display_name: 'Alex',
	pose: true,
	model_java: `{
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
				"pose": [-6, 5, 0],
				"cubes": [
					{"name": "Head", "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]},
					{"name": "Hat Layer", "visibility": false, "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0], "inflate": 0.5, "layer": true}
				]
			},
			{
				"name": "Body",
				"color": 3,
				"pivot": [0, 24, 0],
				"cubes": [
					{"name": "Body", "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]},
					{"name": "Body Layer", "visibility": false, "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 32], "inflate": 0.25, "layer": true}
				]
			},
			{
				"name": "Right Arm",
				"color": 5,
				"pivot": [-5, 22, 0],
				"pose": [-10, 0, 0],
				"cubes": [
					{"name": "Right Arm", "origin": [-7, 12, -2], "size": [3, 12, 4], "uv": [40, 16]},
					{"name": "Right Arm Layer", "visibility": false, "origin": [-7, 12, -2], "size": [3, 12, 4], "uv": [40, 32], "inflate": 0.25, "layer": true}
				]
			},
			{
				"name": "Left Arm",
				"color": 0,
				"pivot": [5, 22, 0],
				"pose": [12, 0, 0],
				"cubes": [
					{"name": "Left Arm", "origin": [4, 12, -2], "size": [3, 12, 4], "uv": [32, 48]},
					{"name": "Left Arm Layer", "visibility": false, "origin": [4, 12, -2], "size": [3, 12, 4], "uv": [48, 48], "inflate": 0.25, "layer": true}
				]
			},
			{
				"name": "Right Leg",
				"color": 6,
				"pivot": [-1.9, 12, 0],
				"pose": [11, 0, 2],
				"cubes": [
					{"name": "Right Leg", "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]},
					{"name": "Right Leg Layer", "visibility": false, "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 32], "inflate": 0.25, "layer": true}
				]
			},
			{
				"name": "Left Leg",
				"color": 7,
				"pivot": [1.9, 12, 0],
				"pose": [-10, 0, -2],
				"cubes": [
					{"name": "Left Leg", "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [16, 48]},
					{"name": "Left Leg Layer", "visibility": false, "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [0, 48], "inflate": 0.25, "layer": true}
				]
			}
		]
	}`,
	model_bedrock: `{
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
				"pose": [-6, 5, 0],
				"cubes": [
					{"name": "Head", "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]},
					{"name": "Hat Layer", "visibility": false, "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0], "inflate": 0.5, "layer": true}
				]
			},
			{
				"name": "Body",
				"color": 3,
				"pivot": [0, 24, 0],
				"cubes": [
					{"name": "Body", "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]},
					{"name": "Body Layer", "visibility": false, "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 32], "inflate": 0.25, "layer": true}
				]
			},
			{
				"name": "Right Arm",
				"color": 5,
				"pivot": [-5, 21.5, 0],
				"pose": [-10, 0, 0],
				"cubes": [
					{"name": "Right Arm", "origin": [-7, 11.5, -2], "size": [3, 12, 4], "uv": [40, 16]},
					{"name": "Right Arm Layer", "visibility": false, "origin": [-7, 11.5, -2], "size": [3, 12, 4], "uv": [40, 32], "inflate": 0.25, "layer": true}
				]
			},
			{
				"name": "Left Arm",
				"color": 0,
				"pivot": [5, 21.5, 0],
				"pose": [12, 0, 0],
				"cubes": [
					{"name": "Left Arm", "origin": [4, 11.5, -2], "size": [3, 12, 4], "uv": [32, 48]},
					{"name": "Left Arm Layer", "visibility": false, "origin": [4, 11.5, -2], "size": [3, 12, 4], "uv": [48, 48], "inflate": 0.25, "layer": true}
				]
			},
			{
				"name": "Right Leg",
				"color": 6,
				"pivot": [-1.9, 12, 0],
				"pose": [11, 0, 2],
				"cubes": [
					{"name": "Right Leg", "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]},
					{"name": "Right Leg Layer", "visibility": false, "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 32], "inflate": 0.25, "layer": true}
				]
			},
			{
				"name": "Left Leg",
				"color": 7,
				"pivot": [1.9, 12, 0],
				"pose": [-10, 0, -2],
				"cubes": [
					{"name": "Left Leg", "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [16, 48]},
					{"name": "Left Leg Layer", "visibility": false, "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [0, 48], "inflate": 0.25, "layer": true}
				]
			}
		]
	}`
};

skin_presets.flat_texture = {
	display_name: 'Texture',
	model: `{
		"name": "flat_texture",
		"camera_angle": "top",
		"texturewidth": 16,
		"textureheight": 16,
		"bones": [
			{
				"name": "block",
				"pivot": [0, 0, 0],
				"cubes": [
					{
						"origin": [-8, 0, -8],
						"size": [16, 1, 16],
						"layer": true,
						"uv": {
							"up": {"uv": [16, 16], "uv_size": [-16, -16]}
						}
					}
				]
			}
		]
	}`
};
skin_presets.block = {
	display_name: 'Block',
	model: `{
		"name": "block",
		"texturewidth": 16,
		"textureheight": 16,
		"bones": [
			{
				"name": "block",
				"pivot": [0, 0, 0],
				"cubes": [
					{
						"origin": [-8, 0, -8],
						"size": [16, 16, 16],
						"uv": {
							"north": {"uv": [0, 0], "uv_size": [16, 16]},
							"east": {"uv": [0, 0], "uv_size": [16, 16]},
							"south": {"uv": [0, 0], "uv_size": [16, 16]},
							"west": {"uv": [0, 0], "uv_size": [16, 16]},
							"up": {"uv": [16, 16], "uv_size": [-16, -16]},
							"down": {"uv": [16, 16], "uv_size": [-16, -16]}
						}
					}
				]
			}
		]
	}`
};

skin_presets.allay = {
	display_name: 'Allay',
	model: `{
		"name": "allay",
		"texturewidth": 32,
		"textureheight": 32,
		"eyes": [
			[6, 7, 1, 2],
			[8, 7, 1, 2]
		],
		"bones": [
			{
				"name": "root",
				"pivot": [0, 0, 0]
			},
			{
				"name": "head",
				"parent": "root",
				"pivot": [0, 4, 0],
				"cubes": [
					{"origin": [-2.5, 4.01, -2.5], "size": [5, 5, 5], "uv": [0, 0]}
				]
			},
			{
				"name": "body",
				"parent": "root",
				"pivot": [0, 4, 0],
				"cubes": [
					{"origin": [-1.5, 0, -1], "size": [3, 4, 2], "uv": [0, 10]},
					{"origin": [-1.5, -1, -1], "size": [3, 5, 2], "inflate": -0.2, "uv": [0, 16]}
				]
			},
			{
				"name": "rightItem",
				"parent": "body",
				"pivot": [0, -1, -2],
				"rotation": [-80, 0, 0]
			},
			{
				"name": "right_arm",
				"parent": "body",
				"pivot": [-1.75, 3.5, 0],
				"cubes": [
					{"origin": [-2.5, 0, -1], "size": [1, 4, 2], "uv": [23, 0]}
				]
			},
			{
				"name": "left_arm",
				"parent": "body",
				"pivot": [1.75, 3.5, 0],
				"cubes": [
					{"origin": [1.5, 0, -1], "size": [1, 4, 2], "uv": [23, 6]}
				]
			},
			{
				"name": "left_wing",
				"parent": "body",
				"pivot": [0.5, 3, 1],
				"cubes": [
					{"origin": [0.5, -2, 1], "size": [0, 5, 8], "uv": [16, 14], "mirror": true}
				]
			},
			{
				"name": "right_wing",
				"parent": "body",
				"pivot": [-0.5, 3, 1],
				"cubes": [
					{"origin": [-0.5, -2, 1], "size": [0, 5, 8], "uv": [16, 14]}
				]
			}
		]
	}`
}
skin_presets.armor_main = {
	display_name: 'Armor (Main)',
	pose: true,
	model: `{
		"name": "armor_main",
		"texturewidth": 64,
		"textureheight": 32,
		"bones": [
			{
				"name": "Head",
				"color": 1,
				"pivot": [0, 24, 0],
				"pose": [-6, 5, 0],
				"cubes": [
					{"name": "Helmet", "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0], "inflate": 1},
					{"name": "Hat Layer", "visibility": false, "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0], "inflate": 1.5, "layer": true}
				]
			},
			{
				"name": "Body",
				"color": 3,
				"pivot": [0, 24, 0],
				"cubes": [
					{"name": "Chestplate", "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16], "inflate": 1.01}
				]
			},
			{
				"name": "Right Arm",
				"color": 5,
				"pivot": [-5, 22, 0],
				"pose": [-10, 0, 0],
				"cubes": [
					{"name": "Right Arm Armor", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16], "inflate": 1}
				]
			},
			{
				"name": "Left Arm",
				"color": 0,
				"pivot": [5, 22, 0],
				"pose": [12, 0, 0],
				"cubes": [
					{"name": "Left Arm Armor", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [40, 16], "inflate": 1, "mirror": true}
				]
			},
			{
				"name": "Right Leg",
				"color": 6,
				"pivot": [-1.9, 12, 0],
				"pose": [11, 0, 2],
				"cubes": [
					{"name": "Right Boot", "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16], "inflate": 1.0}
				]
			},
			{
				"name": "Left Leg",
				"color": 7,
				"pivot": [1.9, 12, 0],
				"pose": [-10, 0, -2],
				"cubes": [
					{"name": "Left Boot", "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [0, 16], "inflate": 1.0, "mirror": true}
				]
			}
		]
	}`
};
skin_presets.armor_leggings = {
	display_name: 'Armor (Leggings)',
	pose: true,
	model: `{
		"name": "armor_leggings",
		"texturewidth": 64,
		"textureheight": 32,
		"bones": [
			{
				"name": "Body",
				"color": 3,
				"pivot": [0, 24, 0],
				"cubes": [
					{"name": "Belt", "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16], "inflate": 0.51}
				]
			},
			{
				"name": "Right Leg",
				"color": 6,
				"pivot": [-1.9, 12, 0],
				"pose": [11, 0, 2],
				"cubes": [
					{"name": "Right Leg Armor", "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16], "inflate": 0.5}
				]
			},
			{
				"name": "Left Leg",
				"color": 7,
				"pivot": [1.9, 12, 0],
				"pose": [-10, 0, -2],
				"cubes": [
					{"name": "Left Leg Armor", "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [0, 16], "inflate": 0.5, "mirror": true}
				]
			}
		]
	}`
};
skin_presets.armor_stand = {
	display_name: 'Armor Stand',
	model: `{
		"name": "armor_stand",
		"texturewidth": 64,
		"textureheight": 64,
		"bones": [
			{
				"name": "Baseplate",
				"pivot": [0, 0, 0],
				"cubes": [
					{"name": "baseplate", "origin": [-6, 0, -6], "size": [12, 1, 12], "uv": [0, 32]}
				]
			},
			{
				"name": "Waist",
				"parent": "baseplate",
				"pivot": [0, 12, 0]
			},
			{
				"name": "Body",
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
				"name": "Head",
				"parent": "body",
				"pivot": [0, 24, 0],
				"cubes": [
					{"name": "head", "origin": [-1, 24, -1], "size": [2, 7, 2], "uv": [0, 0]}
				]
			},
			{
				"name": "LeftArm",
				"parent": "body",
				"pivot": [5, 22, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftArm", "origin": [5, 12, -1], "size": [2, 12, 2], "uv": [32, 16]}
				]
			},
			{
				"name": "LeftLeg",
				"parent": "body",
				"pivot": [1.9, 12, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftLeg", "origin": [0.9, 1, -1], "size": [2, 11, 2], "uv": [40, 16]}
				]
			},
			{
				"name": "RightArm",
				"parent": "body",
				"pivot": [-5, 22, 0],
				"cubes": [
					{"name": "RightArm", "origin": [-7, 12, -1], "size": [2, 12, 2], "uv": [24, 0]}
				]
			},
			{
				"name": "RightLeg",
				"parent": "body",
				"pivot": [-1.9, 12, 0],
				"cubes": [
					{"name": "RightLeg", "origin": [-2.9, 1, -1], "size": [2, 11, 2], "uv": [8, 0]}
				]
			}
		]
	}`
};
skin_presets.axolotl = {
	display_name: 'Axolotl',
	model: `{
		"name": "axolotl",
		"texturewidth": 64,
		"textureheight": 64,
		"eyes": [
			[4, 8, 2, 1],
			[12, 8, 2, 1]
		],
		"bones": [
			{
				"name": "root",
				"pivot": [0, -4, 0]
			},
			{
				"name": "body",
				"parent": "root",
				"pivot": [0, 3, 4],
				"cubes": [
					{"origin": [-4, 0, -5], "size": [8, 4, 10], "uv": [0, 11]},
					{"origin": [0, 0, -5], "size": [0, 5, 9], "uv": [2, 17]}
				]
			},
			{
				"name": "right_arm",
				"parent": "body",
				"pivot": [-4, 1, -4],
				"rotation": [0, -90, 90],
				"cubes": [
					{"origin": [-6, -4, -4], "size": [3, 5, 0], "uv": [2, 13]}
				]
			},
			{
				"name": "right_leg",
				"parent": "body",
				"pivot": [-4, 1, 4],
				"rotation": [0, 90, 90],
				"cubes": [
					{"origin": [-5, -4, 4], "size": [3, 5, 0], "uv": [2, 13]}
				]
			},
			{
				"name": "left_arm",
				"parent": "body",
				"pivot": [4, 1, -4],
				"rotation": [0, 90, -90],
				"cubes": [
					{"origin": [3, -4, -4], "size": [3, 5, 0], "uv": [2, 13]}
				]
			},
			{
				"name": "left_leg",
				"parent": "body",
				"pivot": [4, 1, 4],
				"rotation": [0, -90, -90],
				"cubes": [
					{"origin": [2, -4, 4], "size": [3, 5, 0], "uv": [2, 13]}
				]
			},
			{
				"name": "tail",
				"parent": "body",
				"pivot": [0, 2, 4],
				"cubes": [
					{"origin": [0, 0, 4], "size": [0, 5, 12], "uv": [2, 19]}
				]
			},
			{
				"name": "head",
				"parent": "body",
				"pivot": [0, 2, -5],
				"reset": true,
				"cubes": [
					{"origin": [-4, 0, -10], "size": [8, 5, 5], "uv": [0, 1]}
				]
			},
			{
				"name": "left_gills",
				"parent": "head",
				"pivot": [4, 2, -6],
				"cubes": [
					{"origin": [4, 0, -6], "size": [3, 7, 0], "uv": [11, 40]}
				]
			},
			{
				"name": "right_gills",
				"parent": "head",
				"pivot": [-4, 2, -6],
				"cubes": [
					{"origin": [-7, 0, -6], "size": [3, 7, 0], "uv": [0, 40]}
				]
			},
			{
				"name": "top_gills",
				"parent": "head",
				"pivot": [0, 5, -6],
				"cubes": [
					{"origin": [-4, 5, -6], "size": [8, 3, 0], "uv": [3, 37]}
				]
			}
		]
	}`
}
skin_presets.bat = {
	display_name: 'Bat',
	pose: true,
	model: `{
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
				"pose": [0, -10, 0],
				"cubes": [
					{"name": "rightWing", "origin": [-12, 7, 1.5], "size": [10, 16, 1], "uv": [42, 0]}
				]
			},
			{
				"name": "rightWingTip",
				"parent": "rightWing",
				"pivot": [-12, 23, 1.5],
				"pose": [0, -15, 0],
				"cubes": [
					{"name": "rightWingTip", "origin": [-20, 10, 1.5], "size": [8, 12, 1], "uv": [24, 16]}
				]
			},
			{
				"name": "leftWing",
				"parent": "body",
				"pivot": [0, 24, 0],
				"pose": [0, 10, 0],
				"mirror": true,
				"cubes": [
					{"name": "leftWing", "origin": [2, 7, 1.5], "size": [10, 16, 1], "uv": [42, 0]}
				]
			},
			{
				"name": "leftWingTip",
				"parent": "leftWing",
				"pivot": [12, 23, 1.5],
				"pose": [0, 15, 0],
				"mirror": true,
				"cubes": [
					{"name": "leftWingTip", "origin": [12, 10, 1.5], "size": [8, 12, 1], "uv": [24, 16]}
				]
			}
		]
	}`
};
skin_presets.bee = {
	display_name: 'Bee',
	model: `{
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
	}`
};
skin_presets.bell = {
	display_name: 'Bell',
	model: `{
		"name": "bell",
		"texturewidth": 32,
		"textureheight": 32,
		"bones": [
			{
				"name": "bell",
				"pivot": [0, 11, 0],
				"cubes": [
					{"name": "cube", "origin": [-4, 2, -4], "size": [8, 2, 8], "uv": [0, 13]},
					{"name": "cube", "origin": [-3, 4, -3], "size": [6, 7, 6], "uv": [0, 0]}
				]
			}
		]
	}`
};
skin_presets.blaze = {
	display_name: 'Blaze',
	model: `{
		"name": "blaze",
		"texturewidth": 64,
		"textureheight": 32,
		"eyes": [
			[9, 11],
			[13, 11]
		],
		"bones": [
			{
				"name": "upperBodyParts0",
				"pivot": [8, 26, -3],
				"cubes": [
					{"name": "upperBodyParts0", "origin": [8, 18, -3], "size": [2, 8, 2], "uv": [0, 16]}
				]
			},
			{
				"name": "upperBodyParts1",
				"pivot": [-10, 26, 1],
				"cubes": [
					{"name": "upperBodyParts1", "origin": [-10, 18, 1], "size": [2, 8, 2], "uv": [0, 16]}
				]
			},
			{
				"name": "upperBodyParts2",
				"pivot": [1, 26, 8],
				"cubes": [
					{"name": "upperBodyParts2", "origin": [1, 18, 8], "size": [2, 8, 2], "uv": [0, 16]}
				]
			},
			{
				"name": "upperBodyParts3",
				"pivot": [-3, 26, -10],
				"cubes": [
					{"name": "upperBodyParts3", "origin": [-3, 18, -10], "size": [2, 8, 2], "uv": [0, 16]}
				]
			},
			{
				"name": "upperBodyParts4",
				"pivot": [5, 18, -1],
				"cubes": [
					{"name": "upperBodyParts4", "origin": [5, 10, -1], "size": [2, 8, 2], "uv": [0, 16]}
				]
			},
			{
				"name": "upperBodyParts5",
				"pivot": [-7, 18, -1],
				"cubes": [
					{"name": "upperBodyParts5", "origin": [-7, 10, -1], "size": [2, 8, 2], "uv": [0, 16]}
				]
			},
			{
				"name": "upperBodyParts6",
				"pivot": [-1, 18, 5],
				"cubes": [
					{"name": "upperBodyParts6", "origin": [-1, 10, 5], "size": [2, 8, 2], "uv": [0, 16]}
				]
			},
			{
				"name": "upperBodyParts7",
				"pivot": [-1, 18, -7],
				"cubes": [
					{"name": "upperBodyParts7", "origin": [-1, 10, -7], "size": [2, 8, 2], "uv": [0, 16]}
				]
			},
			{
				"name": "upperBodyParts8",
				"pivot": [3, 8, 2],
				"cubes": [
					{"name": "upperBodyParts8", "origin": [3, 0, 2], "size": [2, 8, 2], "uv": [0, 16]}
				]
			},
			{
				"name": "upperBodyParts9",
				"pivot": [-5, 8, -4],
				"cubes": [
					{"name": "upperBodyParts9", "origin": [-5, 0, -4], "size": [2, 8, 2], "uv": [0, 16]}
				]
			},
			{
				"name": "upperBodyParts10",
				"pivot": [-4, 8, 3],
				"cubes": [
					{"name": "upperBodyParts10", "origin": [-4, 0, 3], "size": [2, 8, 2], "uv": [0, 16]}
				]
			},
			{
				"name": "upperBodyParts11",
				"pivot": [2, 8, -5],
				"cubes": [
					{"name": "upperBodyParts11", "origin": [2, 0, -5], "size": [2, 8, 2], "uv": [0, 16]}
				]
			},
			{
				"name": "head",
				"pivot": [0, 24, 0],
				"cubes": [
					{"name": "head", "origin": [-4, 20, -4], "size": [8, 8, 8], "uv": [0, 0]}
				]
			}
		]
	}`
};
skin_presets.boat = {
	display_name: 'Boat',
	model: `{
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
	}`
};
skin_presets.cat = {
	display_name: 'Cat',
	model: `{
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
	}`
};
skin_presets.chest = {
	display_name: 'Chest',
	model: `{
		"name": "chest",
		"texturewidth": 64,
		"textureheight": 64,
		"bones": [
			{
				"name": "chest",
				"pivot": [0, 8, 0],
				"rotation": [0, 0, -180],
				"cubes": [
					{"name": "cube", "origin": [-1, 5, 7], "size": [2, 4, 1], "uv": [0, 0]},
					{"name": "cube", "origin": [-7, 2, -7], "size": [14, 5, 14], "uv": [0, 0]},
					{"name": "cube", "origin": [-7, 6, -7], "size": [14, 10, 14], "uv": [0, 19]}
				]
			}
		]
	}`
};
skin_presets.chest_left = {
	display_name: 'Chest Left',
	model: `{
		"name": "chest_left",
		"texturewidth": 64,
		"textureheight": 64,
		"bones": [
			{
				"name": "chest",
				"pivot": [0, 8, 0],
				"rotation": [0, 0, -180],
				"cubes": [
					{"name": "cube", "origin": [-9, 5, 7], "size": [2, 4, 1], "uv": [0, 0]},
					{"name": "cube", "origin": [-8, 2, -7], "size": [15, 5, 14], "uv": [0, 0]},
					{"name": "cube", "origin": [-8, 6, -7], "size": [15, 10, 14], "uv": [0, 19]}
				]
			}
		]
	}`
};
skin_presets.chest_right = {
	display_name: 'Chest Right',
	model: `{
		"name": "chest_right",
		"texturewidth": 64,
		"textureheight": 64,
		"bones": [
			{
				"name": "chest",
				"pivot": [0, 8, 0],
				"rotation": [0, 0, -180],
				"cubes": [
					{"name": "cube", "origin": [7, 5, 7], "size": [2, 4, 1], "uv": [0, 0]},
					{"name": "cube", "origin": [-7, 2, -7], "size": [15, 5, 14], "uv": [0, 0]},
					{"name": "cube", "origin": [-7, 6, -7], "size": [15, 10, 14], "uv": [0, 19]}
				]
			}
		]
	}`
};
skin_presets.chicken = {
	display_name: 'Chicken',
	model: `{
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
	}`
};
skin_presets.cod = {
	display_name: 'Cod',
	model: `{
		"name": "cod",
		"texturewidth": 32,
		"textureheight": 32,
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
	}`
};
skin_presets.cow = {
	display_name: 'Cow',
	model: `{
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
	}`
};
skin_presets.creeper = {
	display_name: 'Creeper',
	model: `{
		"name": "creeper",
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
	}`
};
skin_presets.dolphin = {
	display_name: 'Dolphin',
	pose: true,
	model_bedrock: `{
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
				"pose": [-5, 0, 0],
				"cubes": [
					{"name": "tail", "origin": [-2, 0, 10], "size": [4, 5, 11], "uv": [0, 33]}
				]
			},
			{
				"name": "tail_fin",
				"parent": "tail",
				"pivot": [0, 2.5, 20],
				"pose": [-8, 0, 0],
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
	}`,
	model_java: `{
		"name": "dolphin",
		"texturewidth": 64,
		"textureheight": 64,
		"bones": [
			{
				"name": "body",
				"pivot": [0, 0, -3],
				"cubes": [
					{"name": "body", "origin": [-4, 0, -3], "size": [8, 7, 13], "uv": [22, 0]}
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
				"pose": [-5, 0, 0],
				"cubes": [
					{"name": "tail", "origin": [-2, 0, 10], "size": [4, 5, 11], "uv": [0, 19]}
				]
			},
			{
				"name": "tail_fin",
				"parent": "tail",
				"pivot": [0, 2.5, 20],
				"pose": [-8, 0, 0],
				"cubes": [
					{"name": "tail_fin", "origin": [-5, 2, 19], "size": [10, 1, 6], "uv": [19, 20]}
				]
			},
			{
				"name": "back_fin",
				"parent": "body",
				"pivot": [0, 7, 2],
				"rotation": [60, 0, 0],
				"cubes": [
					{"name": "back_fin", "origin": [-0.5, 3.75, 1.5], "size": [1, 4, 5], "uv": [51, 0]}
				]
			},
			{
				"name": "left_fin",
				"parent": "body",
				"pivot": [3, 2, 2],
				"rotation": [55, 0, 107],
				"cubes": [
					{"name": "left_fin", "origin": [3, 2, 0.5], "size": [1, 4, 7], "uv": [48, 20]}
				]
			},
			{
				"name": "right_fin",
				"parent": "body",
				"pivot": [-3, 2, 2],
				"rotation": [55, 0, -107],
				"cubes": [
					{"name": "left_fin", "origin": [-4, 2, 0.5], "size": [1, 4, 7], "uv": [48, 20], "mirror": true}
				]
			}
		]
	}`
};
skin_presets.enderdragon = {
	display_name: 'Ender Dragon',
	pose: true,
	model: `{
		"name": "enderdragon",
		"texturewidth": 256,
		"textureheight": 256,
		"bones": [
			{
				"name": "neck",
				"pivot": [0, 7, -8],
				"pose": [-5, 0, 0],
				"cubes": [
					{"name": "neck", "origin": [-5, 2, -18], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "neck", "origin": [-1, 12, -16], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "neck2",
				"parent": "neck",
				"pivot": [0, 7, -18],
				"pose": [5, 0, 0],
				"cubes": [
					{"name": "neck", "origin": [-5, 2, -28], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "neck", "origin": [-1, 12, -26], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "neck3",
				"parent": "neck2",
				"pivot": [0, 7, -28],
				"pose": [5, 0, 0],
				"cubes": [
					{"name": "neck", "origin": [-5, 2, -38], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "neck", "origin": [-1, 12, -36], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "neck4",
				"parent": "neck3",
				"pivot": [0, 7, -38],
				"pose": [5, 0, 0],
				"cubes": [
					{"name": "neck", "origin": [-5, 2, -48], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "neck", "origin": [-1, 12, -46], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "neck5",
				"parent": "neck4",
				"pivot": [0, 7, -48],
				"pose": [5, 0, 0],
				"cubes": [
					{"name": "neck", "origin": [-5, 2, -58], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "neck", "origin": [-1, 12, -56], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "head",
				"parent": "neck5",
				"pivot": [0, 7, -58],
				"pose": [5, 0, 0],
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
				"pose": [15, 0, 0],
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
				"pose": [0, 10, 10],
				"cubes": [
					{"name": "wing", "origin": [-68, 15, -2], "size": [56, 8, 8], "uv": [112, 88]},
					{"name": "wing", "origin": [-68, 19, 4], "size": [56, 0, 56], "uv": [-56, 88], "inflate": 0.01}
				]
			},
			{
				"name": "wingtip",
				"parent": "wing",
				"pivot": [-68, 19, 0],
				"pose": [0, 0, -20],
				"cubes": [
					{"name": "wingtip", "origin": [-124, 17, 0], "size": [56, 4, 4], "uv": [112, 136]},
					{"name": "wingtip", "origin": [-124, 19, 4], "size": [56, 0, 56], "uv": [-56, 144], "inflate": 0.01}
				]
			},
			{
				"name": "wing1",
				"pivot": [12, 19, 2],
				"pose": [0, -10, -10],
				"mirror": true,
				"cubes": [
					{"name": "wing1", "origin": [12, 15, -2], "size": [56, 8, 8], "uv": [112, 88]},
					{"name": "wing1", "origin": [12, 19, 4], "size": [56, 0, 56], "uv": [-56, 88], "inflate": 0.01}
				]
			},
			{
				"name": "wingtip1",
				"parent": "wing1",
				"pivot": [68, 19, 0],
				"pose": [0, 0, 20],
				"mirror": true,
				"cubes": [
					{"name": "wingtip1", "origin": [68, 17, 0], "size": [56, 4, 4], "uv": [112, 136]},
					{"name": "wingtip1", "origin": [68, 19, 4], "size": [56, 0, 56], "uv": [-56, 144], "inflate": 0.01}
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
				"pose": [1, 0, 0],
				"cubes": [
					{"name": "tail", "origin": [-5, 9, 66], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "tail", "origin": [-1, 19, 68], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "tail3",
				"parent": "tail2",
				"pivot": [0, 14, 76],
				"pose": [1, 0, 0],
				"cubes": [
					{"name": "tail", "origin": [-5, 9, 76], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "tail", "origin": [-1, 19, 78], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "tail4",
				"parent": "tail3",
				"pivot": [0, 14, 86],
				"pose": [1, 0, 0],
				"cubes": [
					{"name": "tail", "origin": [-5, 9, 86], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "tail", "origin": [-1, 19, 88], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "tail5",
				"parent": "tail4",
				"pivot": [0, 14, 96],
				"pose": [2, 0, 0],
				"cubes": [
					{"name": "tail", "origin": [-5, 9, 96], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "tail", "origin": [-1, 19, 98], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "tail6",
				"parent": "tail5",
				"pivot": [0, 14, 106],
				"pose": [3, 0, 0],
				"cubes": [
					{"name": "tail", "origin": [-5, 9, 106], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "tail", "origin": [-1, 19, 108], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "tail7",
				"parent": "tail6",
				"pivot": [0, 14, 116],
				"pose": [3, 0, 0],
				"cubes": [
					{"name": "tail", "origin": [-5, 9, 116], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "tail", "origin": [-1, 19, 118], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "tail8",
				"parent": "tail7",
				"pivot": [0, 14, 126],
				"pose": [1, 0, 0],
				"cubes": [
					{"name": "tail", "origin": [-5, 9, 126], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "tail", "origin": [-1, 19, 128], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "tail9",
				"parent": "tail8",
				"pivot": [0, 14, 136],
				"pose": [-1, 0, 0],
				"cubes": [
					{"name": "tail", "origin": [-5, 9, 136], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "tail", "origin": [-1, 19, 138], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "tail10",
				"parent": "tail9",
				"pivot": [0, 14, 146],
				"pose": [-2, 0, 0],
				"cubes": [
					{"name": "tail", "origin": [-5, 9, 146], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "tail", "origin": [-1, 19, 148], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "tail11",
				"parent": "tail10",
				"pivot": [0, 14, 156],
				"pose": [-3, 0, 0],
				"cubes": [
					{"name": "tail", "origin": [-5, 9, 156], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "tail", "origin": [-1, 19, 158], "size": [2, 4, 6], "uv": [48, 0]}
				]
			},
			{
				"name": "tail12",
				"parent": "tail11",
				"pivot": [0, 14, 166],
				"pose": [-3, 0, 0],
				"cubes": [
					{"name": "tail", "origin": [-5, 9, 166], "size": [10, 10, 10], "uv": [192, 104]},
					{"name": "tail", "origin": [-1, 19, 168], "size": [2, 4, 6], "uv": [48, 0]}
				]
			}
		]
	}`
};
skin_presets.enderman = {
	display_name: 'Enderman',
	model: `{
		"name": "enderman",
		"texturewidth": 64,
		"textureheight": 32,
		"bones": [
			{
				"name": "head",
				"pivot": [0, 24, 0],
				"cubes": [
					{"name": "head", "origin": [-4, 40, -4], "size": [8, 8, 8], "uv": [0, 0], "inflate": -0.5},
					{"name": "head layer", "origin": [-4, 38, -4], "size": [8, 8, 8], "uv": [0, 16], "inflate": -0.5, "layer": true}
				]
			},
			{
				"name": "Body",
				"pivot": [0, 38, 0],
				"cubes": [
					{"name": "Body", "origin": [-4, 26, -2], "size": [8, 12, 4], "uv": [32, 16]}
				]
			},
			{
				"name": "RightArm",
				"pivot": [-3, 36, 0],
				"cubes": [
					{"name": "RightArm", "origin": [-6, 8, -1], "size": [2, 30, 2], "uv": [56, 0]}
				]
			},
			{
				"name": "LeftArm",
				"pivot": [5, 36, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftArm", "origin": [4, 8, -1], "size": [2, 30, 2], "uv": [56, 0]}
				]
			},
			{
				"name": "RightLeg",
				"pivot": [-2, 26, 0],
				"cubes": [
					{"name": "RightLeg", "origin": [-3, -4, -1], "size": [2, 30, 2], "uv": [56, 0]}
				]
			},
			{
				"name": "LeftLeg",
				"pivot": [2, 26, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftLeg", "origin": [1, -4, -1], "size": [2, 30, 2], "uv": [56, 0]}
				]
			}
		]
	}`
};
skin_presets.endermite = {
	display_name: 'Endermite',
	model: `{
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
	}`
};
skin_presets.evocation_fang = {
	display_name: 'Evocation Fang',
	model: `{
		"name": "evocation_fang",
		"texturewidth": 64,
		"textureheight": 32,
		"bones": [
			{
				"name": "base",
				"pivot": [0, 0, 0],
				"cubes": [
					{"name": "base", "origin": [-5, 0, -5], "size": [10, 12, 10], "uv": [0, 0]}
				]
			},
			{
				"name": "upper_jaw",
				"parent": "base",
				"pivot": [0, 11, 0],
				"rotation": [0, 180, -150],
				"cubes": [
					{"name": "upper_jaw", "origin": [-1.5, -4, -4], "size": [4, 14, 8], "uv": [40, 0], "inflate": 0.01}
				]
			},
			{
				"name": "lower_jaw",
				"parent": "base",
				"pivot": [0, 11, 0],
				"rotation": [0, 0, 150],
				"cubes": [
					{"name": "lower_jaw", "origin": [-1.5, -4, -4], "size": [4, 14, 8], "uv": [40, 0]}
				]
			}
		]
	}`
};
skin_presets.evoker = {
	display_name: 'Evoker',
	model: `{
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
				"name": "RightArm",
				"parent": "body",
				"pivot": [-5, 22, 0],
				"cubes": [
					{"name": "RightArm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 46]}
				]
			},
			{
				"name": "LeftArm",
				"parent": "body",
				"pivot": [5, 22, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftArm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [40, 46]}
				]
			}
		]
	}`
};
skin_presets.fox = {
	display_name: 'Fox',
	model_bedrock: `{
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
	}`,
	model_java: `{
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
	}`
};
skin_presets.frog = {
	display_name: 'Frog',
	model: `{
		"name": "frog",
		"texturewidth": 48,
		"textureheight": 48,
		"eyes": [
			[2, 4, 5, 1],
			[2, 9, 5, 1]
		],
		"bones": [
			{
				"name": "root",
				"pivot": [0, 0, 0]
			},
			{
				"name": "body",
				"parent": "root",
				"pivot": [0, 2, 4],
				"cubes": [
					{"origin": [-3.5, 1, -4], "size": [7, 3, 9], "uv": [3, 1]},
					{"origin": [-3.5, 3, -4], "size": [7, 0, 9], "uv": [23, 22]}
				]
			},
			{
				"name": "head",
				"parent": "body",
				"pivot": [0, 4, 3],
				"cubes": [
					{"origin": [-3.5, 5, -4], "size": [7, 0, 9], "uv": [23, 13]},
					{"origin": [-3.5, 3, -4], "size": [7, 3, 9], "uv": [0, 13]}
				]
			},
			{
				"name": "eyes",
				"parent": "head",
				"pivot": [-0.5, 4, 5]
			},
			{
				"name": "right_eye",
				"parent": "eyes",
				"pivot": [-2, 7, -1.5],
				"cubes": [
					{"origin": [-3.5, 6, -3], "size": [3, 2, 3], "uv": [0, 0]}
				]
			},
			{
				"name": "left_eye",
				"parent": "eyes",
				"pivot": [2, 7, -1.5],
				"cubes": [
					{"origin": [0.5, 6, -3], "size": [3, 2, 3], "uv": [0, 5]}
				]
			},
			{
				"name": "croaking_body",
				"parent": "body",
				"pivot": [0, 3, -1],
				"cubes": [
					{"origin": [-3.5, 1.1, -3.9], "size": [7, 2, 3], "inflate": -0.1, "uv": [26, 5]}
				]
			},
			{
				"name": "tongue",
				"parent": "body",
				"pivot": [0, 3.1, 5],
				"cubes": [
					{"origin": [-2, 3.1, -2.1], "size": [4, 0, 7], "uv": [17, 13]}
				]
			},
			{
				"name": "left_arm",
				"parent": "body",
				"pivot": [4, 3, -2.5],
				"cubes": [
					{"origin": [3, 0, -3.5], "size": [2, 3, 3], "uv": [0, 32]},
					{"origin": [0, -0.01, -7.5], "size": [8, 0, 8], "uv": [18, 40], "layer": true}
				]
			},
			{
				"name": "right_arm",
				"parent": "body",
				"pivot": [-4, 3, -2.5],
				"cubes": [
					{"origin": [-5, 0, -3.5], "size": [2, 3, 3], "uv": [0, 38]},
					{"origin": [-8, -0.01, -7.5], "size": [8, 0, 8], "uv": [2, 40], "layer": true}
				]
			},
			{
				"name": "left_leg",
				"parent": "root",
				"pivot": [3.5, 3, 4],
				"cubes": [
					{"origin": [2.5, 0, 2], "size": [3, 3, 4], "uv": [14, 25]},
					{"origin": [1.5, -0.01, 0], "size": [8, 0, 8], "uv": [2, 32], "layer": true}
				]
			},
			{
				"name": "right_leg",
				"parent": "root",
				"pivot": [-3.5, 3, 4],
				"cubes": [
					{"origin": [-5.5, 0, 2], "size": [3, 3, 4], "uv": [0, 25]},
					{"origin": [-9.5, -0.01, 0], "size": [8, 0, 8], "uv": [18, 32], "layer": true}
				]
			}
		]
	}`
};
skin_presets.ghast = {
	display_name: 'Ghast',
	model: `{
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
	}`
};
skin_presets.goat = {
	display_name: 'Goat',
	model: `{
		"name": "goat",
		"texturewidth": 64,
		"textureheight": 64,
		"bones": [
			{
				"name": "left_back_leg",
				"pivot": [1, 10, 4],
				"cubes": [
					{"origin": [1, 0, 4], "size": [3, 6, 3], "uv": [36, 29]}
				]
			},
			{
				"name": "right_back_leg",
				"pivot": [-3, 10, 4],
				"cubes": [
					{"origin": [-3, 0, 4], "size": [3, 6, 3], "uv": [49, 29]}
				]
			},
			{
				"name": "right_front_leg",
				"pivot": [-3, 10, -6],
				"cubes": [
					{"origin": [-3, 0, -6], "size": [3, 10, 3], "uv": [49, 2]}
				]
			},
			{
				"name": "left_front_leg",
				"pivot": [1, 10, -6],
				"cubes": [
					{"origin": [1, 0, -6], "size": [3, 10, 3], "uv": [35, 2]}
				]
			},
			{
				"name": "body",
				"pivot": [0, 0, 0],
				"cubes": [
					{"origin": [-4, 6, -7], "size": [9, 11, 16], "uv": [1, 1]},
					{"origin": [-5, 4, -8], "size": [11, 14, 11], "uv": [0, 28]}
				]
			},
			{
				"name": "head",
				"pivot": [1, 10, 0],
				"cubes": [
					{"origin": [-2, 15, -16], "size": [5, 7, 10], "pivot": [1, 18, -8], "rotation": [55, 0, 0], "uv": [34, 46]},
					{"origin": [-1.99, 19, -10], "size": [2, 7, 2], "uv": [12, 55]},
					{"origin": [0.99, 19, -10], "size": [2, 7, 2], "uv": [12, 55]},
					{"origin": [3, 19, -10], "size": [3, 2, 1], "uv": [2, 61], "mirror": true},
					{"origin": [-5, 19, -10], "size": [3, 2, 1], "uv": [2, 61]},
					{"origin": [0.5, 6, -14], "size": [0, 7, 5], "uv": [23, 52]}
				]
			},
			{
				"name": "head_main",
				"parent": "head",
				"pivot": [1, 18, -8],
				"rotation": [55, 0, 0],
				"cubes": [
					{"origin": [-2, 15, -16], "size": [5, 7, 10], "pivot": [1, 18, -8], "uv": [34, 46]}
				]
			}
		]
	}`
};
skin_presets.guardian = {
	display_name: 'Guardian',
	model: `{
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
	}`
};
skin_presets.hoglin = {
	display_name: 'Hoglin',
	model: `{
		"name": "hoglin",
		"texturewidth": 128,
		"textureheight": 64,
		"bones": [
			{
				"name": "body",
				"pivot": [0, 19, -3],
				"cubes": [
					{"origin": [-8, 11, -7], "size": [16, 14, 26], "inflate": 0.02, "uv": [1, 1]},
					{"origin": [0, 22, -10], "size": [0, 10, 19], "inflate": 0.02, "uv": [90, 33]}
				]
			},
			{
				"name": "head",
				"parent": "body",
				"pivot": [0, 22, -5],
				"rotation": [50, 0, 0],
				"cubes": [
					{"origin": [-7, 21, -24], "size": [14, 6, 19], "uv": [61, 1]},
					{"origin": [-8, 22, -19], "size": [2, 11, 2], "uv": [1, 13]},
					{"origin": [6, 22, -19], "size": [2, 11, 2], "uv": [1, 13]}
				]
			},
			{
				"name": "right_ear",
				"parent": "head",
				"pivot": [-7, 27, -7],
				"rotation": [0, 0, -50],
				"cubes": [
					{"origin": [-13, 26, -10], "size": [6, 1, 4], "uv": [1, 1]}
				]
			},
			{
				"name": "left_ear",
				"parent": "head",
				"pivot": [7, 27, -7],
				"rotation": [0, 0, 50],
				"cubes": [
					{"origin": [7, 26, -10], "size": [6, 1, 4], "uv": [1, 6]}
				]
			},
			{
				"name": "leg_back_right",
				"pivot": [6, 8, 17],
				"cubes": [
					{"origin": [-8, 0, 13], "size": [5, 11, 5], "uv": [21, 45]}
				]
			},
			{
				"name": "leg_back_left",
				"pivot": [-6, 8, 17],
				"cubes": [
					{"origin": [3, 0, 13], "size": [5, 11, 5], "uv": [0, 45]}
				]
			},
			{
				"name": "leg_front_right",
				"pivot": [-6, 12, -3],
				"cubes": [
					{"origin": [-8, 0, -6], "size": [6, 14, 6], "uv": [66, 42]}
				]
			},
			{
				"name": "leg_front_left",
				"pivot": [6, 12, -3],
				"cubes": [
					{"origin": [2, 0, -6], "size": [6, 14, 6], "uv": [41, 42]}
				]
			}
		]
	}`
};
skin_presets.horse = {
	display_name: 'Horse',
	model: `{
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
	}`
};
skin_presets.irongolem = {
	display_name: 'Iron Golem',
	model: `{
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
	}`
};
skin_presets.llama = {
	display_name: 'Llama',
	model: `{
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
	}`
};
skin_presets.lavaslime = {
	display_name: 'Magma Cube',
	model: `{
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
	}`
};
skin_presets.minecart = {
	display_name: 'Minecart',
	model: `{
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
	}`
};
skin_presets.panda = {
	display_name: 'Panda',
	model: `{
		"name": "panda",
		"texturewidth": 64,
		"textureheight": 64,
		"eyes": [
			[11, 19, 2, 1],
			[18, 19, 2, 1]
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
	}`
};
skin_presets.parrot = {
	display_name: 'Parrot',
	model: `{
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
	}`
};
skin_presets.phantom = {
	display_name: 'Phantom',
	model: `{
		"name": "phantom",
		"eyes": [
			[5, 6, 2, 1],
			[10, 6, 2, 1]
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
	}`
};
skin_presets.pig = {
	display_name: 'Pig',
	model: `{
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
	}`
};
skin_presets.piglin = {
	display_name: 'Piglin',
	model: `{
		"name": "piglin",
		"texturewidth": 64,
		"textureheight": 64,
		"eyes": [
			[10, 11, 1, 1],
			[15, 11, 1, 1]
		],
		"bones": [
			{
				"name": "Body",
				"pivot": [0, 24, 0],
				"cubes": [
					{"origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]},
					{"origin": [-4, 12, -2], "size": [8, 12, 4], "inflate": 0.25, "uv": [16, 32]}
				]
			},
			{
				"name": "head",
				"pivot": [0, 24, 0],
				"cubes": [
					{"origin": [-5, 24, -4], "size": [10, 8, 8], "inflate": -0.02, "uv": [0, 0]},
					{"origin": [-2, 24, -5], "size": [4, 4, 1], "uv": [31, 1]},
					{"origin": [2, 24, -5], "size": [1, 2, 1], "uv": [2, 4]},
					{"origin": [-3, 24, -5], "size": [1, 2, 1], "uv": [2, 0]}
				]
			},
			{
				"name": "leftear",
				"parent": "head",
				"pivot": [5, 30, 0],
				"rotation": [0, 0, -30],
				"cubes": [
					{"origin": [4, 25, -2], "size": [1, 5, 4], "uv": [51, 6]}
				]
			},
			{
				"name": "rightear",
				"parent": "head",
				"pivot": [-5, 30, 0],
				"rotation": [0, 0, 30],
				"cubes": [
					{"origin": [-5, 25, -2], "size": [1, 5, 4], "uv": [39, 6]}
				]
			},
			{
				"name": "hat",
				"parent": "head",
				"pivot": [0, 24, 0]
			},
			{
				"name": "RightArm",
				"pivot": [-5, 22, 0],
				"cubes": [
					{"origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]},
					{"origin": [-8, 12, -2], "size": [4, 12, 4], "inflate": 0.25, "uv": [40, 32]}
				]
			},
			{
				"name": "LeftArm",
				"pivot": [5, 22, 0],
				"cubes": [
					{"origin": [4, 12, -2], "size": [4, 12, 4], "uv": [32, 48]},
					{"origin": [4, 12, -2], "size": [4, 12, 4], "inflate": 0.25, "uv": [48, 48]}
				]
			},
			{
				"name": "RightLeg",
				"pivot": [-1.9, 12, 0],
				"cubes": [
					{"origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 16]},
					{"origin": [-4, 0, -2], "size": [4, 12, 4], "inflate": 0.25, "uv": [0, 32]}
				]
			},
			{
				"name": "LeftLeg",
				"pivot": [1.9, 12, 0],
				"cubes": [
					{"origin": [0, 0, -2], "size": [4, 12, 4], "uv": [16, 48]},
					{"origin": [0, 0, -2], "size": [4, 12, 4], "inflate": 0.25, "uv": [0, 48]}
				]
			},
			{
				"name": "leftItem",
				"pivot": [6, 15, 1]
			}
		]
	}`
};
skin_presets.pillager = {
	display_name: 'Pillager',
	model: `{
		"name": "pillager",
		"texturewidth": 64,
		"textureheight": 64,
		"bones": [
			{
				"name": "waist",
				"pivot": [0, 12, 0]
			},
			{
				"name": "Body",
				"parent": "waist",
				"pivot": [0, 0, 0],
				"cubes": [
					{"name": "Body", "origin": [-4, 12, -3], "size": [8, 12, 6], "uv": [16, 20]},
					{"name": "Body", "origin": [-4, 6, -3], "size": [8, 18, 6], "uv": [0, 38], "inflate": 0.5}
				]
			},
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
				"name": "LeftLeg",
				"pivot": [2, 12, 0],
				"cubes": [
					{"name": "LeftLeg", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
				]
			},
			{
				"name": "RightLeg",
				"pivot": [-2, 12, 0],
				"mirror": true,
				"cubes": [
					{"name": "RightLeg", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
				]
			},
			{
				"name": "RightArm",
				"pivot": [-5, 22, 0],
				"cubes": [
					{"name": "RightArm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 46]}
				]
			},
			{
				"name": "LeftArm",
				"pivot": [5, 22, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftArm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [40, 46]}
				]
			}
		]
	}`
};
skin_presets.polarbear = {
	display_name: 'Polarbear',
	model: `{
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
	}`
};
skin_presets.pufferfish = {
	display_name: 'Pufferfish',
	model: `{
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
	}`
};
skin_presets.rabbit = {
	display_name: 'Rabbit',
	model: `{
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
	}`
};
skin_presets.ravager = {
	display_name: 'Ravager',
	model: `{
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
	}`
};
skin_presets.salmon = {
	display_name: 'Salmon',
	model: `{
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
	}`
};
skin_presets.sheep = {
	display_name: 'Sheep',
	model: `{
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
	}`
};
skin_presets.shield = {
	display_name: 'Shield',
	model: `{
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
	}`
};
skin_presets.shulker = {
	display_name: 'Shulker',
	model: `{
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
	}`
};
skin_presets.shulker_bullet = {
	display_name: 'Shulker Bullet',
	model: `{
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
	}`
};
skin_presets.silverfish = {
	display_name: 'Silverfish',
	model: `{
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
					{"name": "bodyLayer_2", "origin": [-3, 0, -3], "size": [6, 5, 2], "uv": [20, 18], "layer": true}
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
					{"name": "bodyLayer_1", "origin": [-3, 0, 5.5], "size": [6, 4, 3], "uv": [20, 11], "layer": true}
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
					{"name": "bodyLayer_0", "origin": [-5, 0, -0.5], "size": [10, 8, 3], "uv": [20, 0], "layer": true}
				]
			}
		]
	}`
};
skin_presets.skeleton = {
	display_name: 'Skeleton',
	model: `{
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
				"name": "Body",
				"parent": "waist",
				"pivot": [0, 24, 0],
				"cubes": [
					{"name": "Body", "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}
				]
			},
			{
				"name": "head",
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
				"name": "RightArm",
				"pivot": [-5, 22, 0],
				"cubes": [
					{"name": "RightArm", "origin": [-6, 12, -1], "size": [2, 12, 2], "uv": [40, 16]}
				]
			},
			{
				"name": "LeftArm",
				"pivot": [5, 22, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftArm", "origin": [4, 12, -1], "size": [2, 12, 2], "uv": [40, 16]}
				]
			},
			{
				"name": "leftItem",
				"parent": "LeftArm",
				"pivot": [6, 15, 1]
			},
			{
				"name": "RightLeg",
				"pivot": [-2, 12, 0],
				"cubes": [
					{"name": "RightLeg", "origin": [-3, 0, -1], "size": [2, 12, 2], "uv": [0, 16]}
				]
			},
			{
				"name": "LeftLeg",
				"pivot": [2, 12, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftLeg", "origin": [1, 0, -1], "size": [2, 12, 2], "uv": [0, 16]}
				]
			}
		]
	}`
};
skin_presets.slime = {
	display_name: 'Slime',
	model: `{
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
					{"name": "cube layer", "visibility": false, "origin": [-4, 0, -4], "size": [8, 8, 8], "uv": [0, 0], "layer": true},
					{"name": "eye0 layer", "visibility": false, "origin": [-3.3, 4, -3.5], "size": [2, 2, 2], "uv": [32, 0], "layer": true},
					{"name": "eye1 layer", "visibility": false, "origin": [1.3, 4, -3.5], "size": [2, 2, 2], "uv": [32, 4], "layer": true},
					{"name": "mouth layer", "visibility": false, "origin": [0, 2, -3.5], "size": [1, 1, 1], "uv": [32, 8], "layer": true}
				]
			}
		]
	}`
};
skin_presets.snowgolem = {
	display_name: 'Snowgolem',
	model: `{
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
	}`
};
skin_presets.spider = {
	display_name: 'Spider',
	model: `{
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
	}`
};
skin_presets.spyglass = {
	display_name: 'Spyglass',
	model: `{
		"name": "spyglass",
		"texturewidth": 16,
		"textureheight": 16,
		"bones": [
			{
				"name": "spyglass",
				"pivot": [0, 0, 0],
				"cubes": [
					{"origin": [-11.1, -0.1, -0.1], "size": [6.2, 2.2, 2.2], "uv": [0, 0]},
					{"origin": [-5, 0, 0], "size": [5, 2, 2], "uv": [0, 4]}
				]
			}
		]
	}`
}
skin_presets.squid = {
	display_name: 'Squid',
	model: `{
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
	}`
};
skin_presets.strider = {
	display_name: 'Strider',
	model: `{
		"name": "strider",
		"texturewidth": 64,
		"textureheight": 128,
		"eyes": [
			[17, 25, 2, 1],
			[29, 25, 2, 1]
		],
		"bones": [
			{
				"name": "Body",
				"pivot": [0, 17, 0],
				"cubes": [
					{"name": "cube", "origin": [-8, 17, -8], "size": [16, 14, 16], "uv": [0, 0]}
				]
			},
			{
				"name": "right_bristles_1",
				"parent": "Body",
				"pivot": [-8, 30, 0],
				"rotation": [0, 0, -60],
				"mirror": true,
				"cubes": [
					{"name": "cube", "origin": [-20, 30, -8], "size": [12, 0, 16], "uv": [4, 33]}
				]
			},
			{
				"name": "left_bristles_1",
				"parent": "Body",
				"pivot": [8, 30, 0],
				"rotation": [0, 0, 60],
				"cubes": [
					{"name": "cube", "origin": [8, 30, -8], "size": [12, 0, 16], "uv": [4, 33]}
				]
			},
			{
				"name": "right_bristles_2",
				"parent": "Body",
				"pivot": [-8, 26, 0],
				"rotation": [0, 0, -60],
				"mirror": true,
				"cubes": [
					{"name": "cube", "origin": [-20, 26, -8], "size": [12, 0, 16], "uv": [4, 49]}
				]
			},
			{
				"name": "left_bristles_2",
				"parent": "Body",
				"pivot": [8, 26, 0],
				"rotation": [0, 0, 60],
				"cubes": [
					{"name": "cube", "origin": [8, 26, -8], "size": [12, 0, 16], "uv": [4, 49]}
				]
			},
			{
				"name": "right_bristles_3",
				"parent": "Body",
				"pivot": [-8, 21, 0],
				"rotation": [0, 0, -60],
				"mirror": true,
				"cubes": [
					{"name": "cube", "origin": [-20, 21, -8], "size": [12, 0, 16], "uv": [4, 65]}
				]
			},
			{
				"name": "left_bristles_3",
				"parent": "Body",
				"pivot": [8, 21, 0],
				"rotation": [0, 0, 60],
				"cubes": [
					{"name": "cube", "origin": [8, 21, -8], "size": [12, 0, 16], "uv": [4, 65]}
				]
			},
			{
				"name": "RightLeg",
				"pivot": [-4, 17, 0],
				"cubes": [
					{"name": "cube", "origin": [-6, 0, -2], "size": [4, 17, 4], "uv": [0, 32]}
				]
			},
			{
				"name": "LeftLeg",
				"pivot": [4, 17, 0],
				"mirror": true,
				"cubes": [
					{"name": "cube", "origin": [2, 0, -2], "size": [4, 17, 4], "uv": [0, 32]}
				]
			}
		]
	}`
};
skin_presets.tadpole = {
	display_name: 'Tadpole',
	model: `{
		"name": "tadpole",
		"texturewidth": 16,
		"textureheight": 16,
		"eyes": [
			[2, 3, 2, 1],
			[5, 3, 2, 1]
		],
		"bones": [
			{
				"name": "root",
				"pivot": [0, 0, 0]
			},
			{
				"name": "body",
				"parent": "root",
				"pivot": [0, 0, 1],
				"cubes": [
					{"origin": [-1.5, 1, -2.5], "size": [3, 2, 3], "uv": [0, 0]}
				]
			},
			{
				"name": "tail",
				"parent": "root",
				"pivot": [0, 0, 1],
				"cubes": [
					{"origin": [0, 1, -0.5], "size": [0, 2, 7], "uv": [0, 0]}
				]
			}
		]
	}`
};
skin_presets.tropicalfish_a = {
	display_name: 'Tropicalfish A',
	model: `{
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
	}`
};
skin_presets.tropicalfish_b = {
	display_name: 'Tropicalfish B',
	model: `{
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
	}`
};
skin_presets.turtle = {
	display_name: 'Turtle',
	model: `{
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
	}`
};
skin_presets.vex = {
	display_name: 'Vex',
	model: `{
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
				"name": "RightArm",
				"pivot": [-5, 22, 0],
				"cubes": [
					{"name": "RightArm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}
				]
			},
			{
				"name": "LeftArm",
				"pivot": [5, 22, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftArm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}
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
	}`
};
skin_presets.villager = {
	display_name: 'Villager (Old)',
	model: `{
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
				"name": "RightLeg",
				"pivot": [-2, 12, 0],
				"cubes": [
					{"name": "leg0", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
				]
			},
			{
				"name": "LeftLeg",
				"pivot": [2, 12, 0],
				"cubes": [
					{"name": "leg1", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
				]
			}
		]
	}`
};
skin_presets.villager_v2 = {
	display_name: 'Villager (New)',
	model: `{
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
				"name": "RightLeg",
				"parent": "body",
				"pivot": [-2, 12, 0],
				"cubes": [
					{"name": "leg0", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
				]
			},
			{
				"name": "LeftLeg",
				"parent": "body",
				"pivot": [2, 12, 0],
				"cubes": [
					{"name": "leg1", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22], "mirror": true}
				]
			}
		]
	}`
};
skin_presets.vindicator = {
	display_name: 'Vindicator',
	model: `{
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
				"name": "RightLeg",
				"pivot": [-2, 12, 0],
				"cubes": [
					{"name": "RightLeg", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
				]
			},
			{
				"name": "LeftLeg",
				"pivot": [2, 12, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftLeg", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
				]
			},
			{
				"name": "RightArm",
				"pivot": [-5, 22, 0],
				"cubes": [
					{"name": "RightArm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 46]}
				]
			},
			{
				"name": "LeftArm",
				"pivot": [5, 22, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftArm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [40, 46]}
				]
			}
		]
	}`
};
skin_presets.warden = {
	display_name: 'Warden',
	model: `{
		"name": "warden",
		"texturewidth": 128,
		"textureheight": 128,
		"eyes": [
			[12, 50, 12, 7]
		],
		"bones": [
			{
				"name": "root",
				"pivot": [0, 0, 0]
			},
			{
				"name": "body",
				"parent": "root",
				"pivot": [0, 21, 0],
				"cubes": [
					{"origin": [-9, 13, -4], "size": [18, 21, 11], "uv": [0, 0]}
				]
			},
			{
				"name": "right_ribcage",
				"parent": "body",
				"pivot": [-7, 23, -4],
				"cubes": [
					{"origin": [-9, 13, -4.1], "size": [9, 21, 0], "uv": [90, 11]}
				]
			},
			{
				"name": "left_ribcage",
				"parent": "body",
				"pivot": [7, 23, -4],
				"cubes": [
					{"origin": [0, 13, -4.1], "size": [9, 21, 0], "uv": [90, 11], "mirror": true}
				]
			},
			{
				"name": "head",
				"parent": "body",
				"pivot": [0, 34, 0],
				"cubes": [
					{"origin": [-8, 34, -5], "size": [16, 16, 10], "uv": [0, 32]}
				]
			},
			{
				"name": "right_tendril",
				"parent": "head",
				"pivot": [-8, 46, 0],
				"cubes": [
					{"origin": [-24, 43, 0], "size": [16, 16, 0], "uv": [52, 32]}
				]
			},
			{
				"name": "left_tendril",
				"parent": "head",
				"pivot": [8, 46, 0],
				"cubes": [
					{"origin": [8, 43, 0], "size": [16, 16, 0], "uv": [58, 0]}
				]
			},
			{
				"name": "right_arm",
				"parent": "body",
				"pivot": [-13, 34, 1],
				"cubes": [
					{"origin": [-17, 6, -3], "size": [8, 28, 8], "uv": [44, 50]}
				]
			},
			{
				"name": "left_arm",
				"parent": "body",
				"pivot": [13, 34, 1],
				"cubes": [
					{"origin": [9, 6, -3], "size": [8, 28, 8], "uv": [0, 58]}
				]
			},
			{
				"name": "right_leg",
				"parent": "root",
				"pivot": [-5.9, 13, 0],
				"cubes": [
					{"origin": [-9, 0, -3], "size": [6, 13, 6], "uv": [76, 48]}
				]
			},
			{
				"name": "left_leg",
				"parent": "root",
				"pivot": [5.9, 13, 0],
				"cubes": [
					{"origin": [3, 0, -3], "size": [6, 13, 6], "uv": [76, 76]}
				]
			}
		]
	}`
}
skin_presets.witch = {
	display_name: 'Witch',
	model: `{
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
	}`
};
skin_presets.witherBoss = {
	display_name: 'Wither',
	model: `{
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
	}`
};
skin_presets.wolf = {
	display_name: 'Wolf',
	model: `{
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
	}`
};
skin_presets.zombie = {
	display_name: 'Zombie',
	pose: true,
	model: `{
		"name": "zombie",
		"texturewidth": 64,
		"textureheight": 32,
		"eyes": [
			[9, 12, 2, 1],
			[13, 12, 2, 1]
		],
		"bones": [
			{
				"name": "Body",
				"pivot": [0, 24, 0],
				"cubes": [
					{"name": "Body", "origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}
				]
			},
			{
				"name": "head",
				"pivot": [0, 24, 0],
				"pose": [3, -10, 0],
				"cubes": [
					{"name": "head", "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]},
					{"name": "hat", "visibility": false, "origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0], "inflate": 0.5}
				]
			},
			{
				"name": "RightArm",
				"pivot": [-5, 22, 0],
				"pose": [-80, -5, 0],
				"cubes": [
					{"name": "RightArm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}
				]
			},
			{
				"name": "LeftArm",
				"pivot": [5, 22, 0],
				"pose": [-75, 5, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftArm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}
				]
			},
			{
				"name": "RightLeg",
				"pivot": [-1.9, 12, 0],
				"pose": [-25, 0, 5],
				"cubes": [
					{"name": "RightLeg", "origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}
				]
			},
			{
				"name": "LeftLeg",
				"pivot": [1.9, 12, 0],
				"pose": [20, 0, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftLeg", "origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}
				]
			}
		]
	}`
};
skin_presets.zombie_villager_1 = {
	display_name: 'Zombie Villager (Old)',
	model: `{
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
				"name": "Body",
				"pivot": [0, 24, 0],
				"cubes": [
					{"name": "Body", "origin": [-4, 12, -3], "size": [8, 12, 6], "uv": [16, 20]},
					{"name": "Body", "origin": [-4, 6, -3], "size": [8, 18, 6], "uv": [0, 38], "inflate": 0.5}
				]
			},
			{
				"name": "waist",
				"pivot": [0, 12, 0]
			},
			{
				"name": "RightArm",
				"pivot": [-5, 22, 0],
				"cubes": [
					{"name": "RightArm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [44, 38]}
				]
			},
			{
				"name": "LeftArm",
				"pivot": [5, 22, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftArm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [44, 38]}
				]
			},
			{
				"name": "RightLeg",
				"pivot": [-2, 12, 0],
				"cubes": [
					{"name": "RightLeg", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
				]
			},
			{
				"name": "LeftLeg",
				"pivot": [2, 12, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftLeg", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
				]
			}
		]
	}`
};
skin_presets.zombie_villager_2 = {
	display_name: 'Zombie Villager (New)',
	model: `{
		"name": "zombie_villager_2",
		"texturewidth": 64,
		"textureheight": 64,
		"bones": [
			{
				"name": "waist",
				"pivot": [0, 12, 0]
			},
			{
				"name": "Body",
				"parent": "waist",
				"pivot": [0, 24, 0],
				"cubes": [
					{"name": "Body", "origin": [-4, 12, -3], "size": [8, 12, 6], "uv": [16, 20]},
					{"name": "Body", "origin": [-4, 6, -3], "size": [8, 18, 6], "uv": [0, 38], "inflate": 0.5}
				]
			},
			{
				"name": "head",
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
				"name": "RightArm",
				"pivot": [-5, 22, 0],
				"cubes": [
					{"name": "RightArm", "origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [44, 22]}
				]
			},
			{
				"name": "LeftArm",
				"pivot": [5, 22, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftArm", "origin": [4, 12, -2], "size": [4, 12, 4], "uv": [44, 22]}
				]
			},
			{
				"name": "RightLeg",
				"pivot": [-2, 12, 0],
				"cubes": [
					{"name": "RightLeg", "origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
				]
			},
			{
				"name": "LeftLeg",
				"pivot": [2, 12, 0],
				"mirror": true,
				"cubes": [
					{"name": "LeftLeg", "origin": [0, 0, -2], "size": [4, 12, 4], "uv": [0, 22]}
				]
			}
		]
	}`
};

for (var id in skin_presets) {
	model_options[id] = skin_presets[id].display_name;
}

})()
