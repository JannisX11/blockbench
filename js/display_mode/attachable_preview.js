import { player_preview_model } from "../preview/preview_scenes";


BARS.defineActions(function() {

	let player_attachable_reference_model = new PreviewModel('attachable_reference_player', {
		texture: './assets/player_skin.png',
		texture_size: [64, 64],
		cubes: [
			{
				// "Head
				"position": [-4, 24, -4],
				"size": [8, 8, 8],
				"faces": {
					"north": {"uv": [8, 8, 16, 16]},
					"east": {"uv": [0, 8, 8, 16]},
					"south": {"uv": [24, 8, 32, 16]},
					"west": {"uv": [16, 8, 24, 16]},
					"up": {"uv": [16, 8, 8, 0]},
					"down": {"uv": [24, 0, 16, 8]}
				}
			},
			{
				// Hat Layer
				"position": [-4.5, 23.5, -4.5],
				"size": [9, 9, 9],
				"faces": {
					"north": {"uv": [40, 8, 48, 16]},
					"east": {"uv": [32, 8, 40, 16]},
					"south": {"uv": [56, 8, 64, 16]},
					"west": {"uv": [48, 8, 56, 16]},
					"up": {"uv": [48, 8, 40, 0]},
					"down": {"uv": [56, 0, 48, 8]}
				}
			},
			{
				// "Body
				"position": [-4, 12, -2],
				"size": [8, 12, 4],
				"faces": {
					"north": {"uv": [20, 20, 28, 32]},
					"east": {"uv": [16, 20, 20, 32]},
					"south": {"uv": [32, 20, 40, 32]},
					"west": {"uv": [28, 20, 32, 32]},
					"up": {"uv": [28, 20, 20, 16]},
					"down": {"uv": [36, 16, 28, 20]}
				}
			},
			{
				// Body Layer
				"position": [-4.25, 11.75, -2.25],
				"size": [8.5, 12.5, 4.5],
				"faces": {
					"north": {"uv": [20, 36, 28, 48]},
					"east": {"uv": [16, 36, 20, 48]},
					"south": {"uv": [32, 36, 40, 48]},
					"west": {"uv": [28, 36, 32, 48]},
					"up": {"uv": [28, 36, 20, 32]},
					"down": {"uv": [36, 32, 28, 36]}
				}
			},


			// ======= Wide Arms
			{
				// Right Arm
				"position": [4, 12, -2],
				"size": [4, 12, 4],
				"origin": [5, 22, 0],
				"rotation": [15, 0, 0],
				"faces": {
					"north": {"uv": [44, 20, 48, 32]},
					"east": {"uv": [40, 20, 44, 32]},
					"south": {"uv": [52, 20, 56, 32]},
					"west": {"uv": [48, 20, 52, 32]},
					"up": {"uv": [48, 20, 44, 16]},
					"down": {"uv": [52, 16, 48, 20]}
				}
			},
			{
				// Arm Layer
				"position": [3.75, 11.75, -2.25],
				"size": [4.5, 12.5, 4.5],
				"origin": [5, 22, 0],
				"rotation": [15, 0, 0],
				"faces": {
					"north": {"uv": [44, 36, 48, 48]},
					"east": {"uv": [40, 36, 44, 48]},
					"south": {"uv": [52, 36, 56, 48]},
					"west": {"uv": [48, 36, 52, 48]},
					"up": {"uv": [48, 36, 44, 32]},
					"down": {"uv": [52, 32, 48, 36]}
				}
			},
			{
				// Left Arm
				"position": [-8, 12, -2],
				"size": [4, 12, 4],
				"origin": [-5, 22, 0],
				"rotation": [1, 0, -3],
				"faces": {
					"north": {"uv": [36, 52, 40, 64]},
					"east": {"uv": [32, 52, 36, 64]},
					"south": {"uv": [44, 52, 48, 64]},
					"west": {"uv": [40, 52, 44, 64]},
					"up": {"uv": [40, 52, 36, 48]},
					"down": {"uv": [44, 48, 40, 52]}
				}
			},
			{
				// Arm Layer
				"position": [-8.25, 11.75, -2.25],
				"size": [4.5, 12.5, 4.5],
				"origin": [-5, 22, 0],
				"rotation": [1, 0, -3],
				"faces": {
					"north": {"uv": [52, 52, 56, 64]},
					"east": {"uv": [48, 52, 52, 64]},
					"south": {"uv": [60, 52, 64, 64]},
					"west": {"uv": [56, 52, 60, 64]},
					"up": {"uv": [56, 52, 52, 48]},
					"down": {"uv": [60, 48, 56, 52]}
				}
			},


			// ======= Slim Arms
			{
				// Right Arm
				"position": [4, 11.5, -2],
				"size": [3, 12, 4],
				"origin": [5, 21.5, 0],
				"rotation": [15, 0, 0],
				"faces": {
					"north": {"uv": [44,20,47,32]},
					"east": {"uv": [40,20,44,32]},
					"south": {"uv": [51,20,54,32]},
					"west": {"uv": [47,20,51,32]},
					"up": {"uv": [47,20,44,16]},
					"down": {"uv": [50,16,47,20]}
				}
			},
			{
				// Arm Layer
				"position": [3.75, 11.25, -2.25],
				"size": [3.5, 12.5, 4.5],
				"origin": [5, 21.5, 0],
				"rotation": [15, 0, 0],
				"faces": {
					"north": {"uv": [44,36,47,48]},
					"east": {"uv": [40,36,44,48]},
					"south": {"uv": [51,36,54,48]},
					"west": {"uv": [47,36,51,48]},
					"up": {"uv": [47,36,44,32]},
					"down": {"uv": [50,32,47,36]}
				}
			},
			{
				// Left Arm
				"position": [-7, 11.5, -2],
				"size": [3, 12, 4],
				"origin": [-5, 21.5, 0],
				"rotation": [1, 0, -3],
				"faces": {
					"north": {"uv": [36,52,39,64]},
					"east": {"uv": [32,52,36,64]},
					"south": {"uv": [43,52,46,64]},
					"west": {"uv": [39,52,43,64]},
					"up": {"uv": [39,52,36,48]},
					"down": {"uv": [42,48,39,52]}
				}
			},
			{
				// Arm Layer
				"position": [-7.25, 11.25, -2.25],
				"size": [3.5, 12.5, 4.5],
				"origin": [-5, 21.5, 0],
				"rotation": [1, 0, -3],
				"faces": {
					"north": {"uv": [52,52,55,64]},
					"east": {"uv": [48,52,52,64]},
					"south": {"uv": [59,52,62,64]},
					"west": {"uv": [55,52,59,64]},
					"up": {"uv": [55,52,52,48]},
					"down": {"uv": [58,48,55,52]}
				}
			},


			{
				// Right Leg
				"position": [-0.1, 0, -2],
				"size": [4, 12, 4],
				"faces": {
					"north": {"uv": [4, 20, 8, 32]},
					"east": {"uv": [0, 20, 4, 32]},
					"south": {"uv": [12, 20, 16, 32]},
					"west": {"uv": [8, 20, 12, 32]},
					"up": {"uv": [8, 20, 4, 16]},
					"down": {"uv": [12, 16, 8, 20]}
				}
			},
			{
				// Leg Layer
				"position": [-0.35, -0.25, -2.25],
				"size": [4.5, 12.5, 4.5],
				"faces": {
					"north": {"uv": [4, 36, 8, 48]},
					"east": {"uv": [0, 36, 4, 48]},
					"south": {"uv": [12, 36, 16, 48]},
					"west": {"uv": [8, 36, 12, 48]},
					"up": {"uv": [8, 36, 4, 32]},
					"down": {"uv": [12, 32, 8, 36]}
				}
			},
			{
				// Left Leg
				"position": [-3.9, 0, -2],
				"size": [4, 12, 4],
				"faces": {
					"north": {"uv": [20, 52, 24, 64]},
					"east": {"uv": [16, 52, 20, 64]},
					"south": {"uv": [28, 52, 32, 64]},
					"west": {"uv": [24, 52, 28, 64]},
					"up": {"uv": [24, 52, 20, 48]},
					"down": {"uv": [28, 48, 24, 52]}
				}
			},
			{
				// Leg Layer
				"position": [-4.15, -0.25, -2.25],
				"size": [4.5, 12.5, 4.5],
				"faces": {
					"north": {"uv": [4, 52, 8, 64]},
					"east": {"uv": [0, 52, 4, 64]},
					"south": {"uv": [12, 52, 16, 64]},
					"west": {"uv": [8, 52, 12, 64]},
					"up": {"uv": [8, 52, 4, 48]},
					"down": {"uv": [12, 48, 8, 52]}
				}
			}
		]
	})

	DisplayMode.player_attachable_reference_model = player_attachable_reference_model;
	player_attachable_reference_model.updateArmVariant = player_preview_model.updateArmVariant;
	player_attachable_reference_model.updateArmVariant();

	let camera_preset_1st = {
		name: tl('action.bedrock_animation_mode.attachable_first'),
		id: 'attachable_first',
		condition: () => Format.id == 'bedrock' && Project.bedrock_animation_mode == 'attachable_first',
		position: [0, 19, -40],
		projection: "perspective",
		target: [0, 16, 0],
		focal_length: 18,
	};
	DefaultCameraPresets.push(camera_preset_1st);

	let center_first_person_button = Interface.createElement('button', {id: 'center_first_person_button'}, tl('preview.center_camera'));
	center_first_person_button.addEventListener('click', event => {
		Preview.selected.loadAnglePreset(camera_preset_1st);
	});

	let player_skin_setup = false;
	function updateBase(mode) {
		let root_has_binding = Outliner.root.find(g => g instanceof Group && g.bedrock_binding)
		if (mode == 'attachable_first') {
			if (root_has_binding) {
				Project.model_3d.position.set(-20, 21, 0);
			} else {
				Project.model_3d.position.set(-8, 6, -18);
			}
			Project.model_3d.rotation.set(
				Math.degToRad(-95),
				Math.degToRad(45),
				Math.degToRad(115),
				'ZYX'
			);
			Interface.preview.append(center_first_person_button);
		} else {
			center_first_person_button.remove();
		}

		if (mode == 'attachable_third') {
			let angle = Math.degToRad(15);
			if (root_has_binding) {
				let arm_offset = Reusable.vec1.set(1, -31, 1).applyAxisAngle(Reusable.vec2.set(1, 0, 0), angle);
				Project.model_3d.position.set(5, 22, 0).add(arm_offset);
			} else {
				let arm_offset = Reusable.vec1.set(1, -7, 1).applyAxisAngle(Reusable.vec2.set(1, 0, 0), angle);
				Project.model_3d.position.set(5, 22, 0).add(arm_offset);
			}
			Project.model_3d.rotation.set(angle, 0, 0);
			player_attachable_reference_model.enable()

			if (!player_skin_setup) {
				updateDisplaySkin();
				player_skin_setup = true;
			}
		} else {
			player_attachable_reference_model.disable()
		}
	
		if (mode != 'attachable_first' && mode != 'attachable_third' && Format.id == 'bedrock') {
			Project.model_3d.position.set(0, 0, 0);
			Project.model_3d.rotation.set(0, 0, 0);
		}
	}
	let bedrock_animation_mode_select = new BarSelect('bedrock_animation_mode', {
		condition: {
			modes: ['animate'],
			formats: ['bedrock'],
		},
		category: 'animation',
		value: 'entity',
		options: {
			entity: true,
			attachable_first: true,
			attachable_third: true
		},
		onChange() {
			if (Project.bedrock_animation_mode == this.value) return;
			Project.bedrock_animation_mode = this.value;

			updateBase(this.value);

			if (this.value == 'attachable_first') {
				Preview.selected.loadAnglePreset(camera_preset_1st);
			} else {
				Preview.selected.loadAnglePreset(DefaultCameraPresets[0]);
			}
		}
	})
	/*
	todo
	Attach model based on binding return values
	*/

	Blockbench.on('select_project', ({project}) => {
		bedrock_animation_mode_select.set(project.bedrock_animation_mode || 'entity');
	})
	Blockbench.on('select_mode', ({mode}) => {
		if (Modes.animate && Project.bedrock_animation_mode) {
			updateBase(Project.bedrock_animation_mode);
		} else {
			updateBase();
		}
	})
})