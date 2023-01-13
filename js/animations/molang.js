
Animator.MolangParser.global_variables = {
	'true': 1,
	'false': 0,
	get 'query.delta_time'() {
		let time = (Date.now() - Timeline.last_frame_timecode + 1) / 1000;
		if (time < 0) time += 1;
		return Math.clamp(time, 0, 0.1);
	},
	get 'query.anim_time'() {
		return Animation.selected ? Animation.selected.time : Timeline.time;
	},
	get 'query.life_time'() {
		return Timeline.time;
	},
	get 'query.time_stamp'() {
		return Math.floor(Timeline.time * 20) / 20;
	},
	get 'query.all_animations_finished'() {
		if (AnimationController.selected?.selected_state) {
			let state = AnimationController.selected?.selected_state;
			let state_time = state.getStateTime();
			let all_finished = state.animations.allAre(a => {
				let animation = Animation.all.find(anim => anim.uuid == a.animation);
				return !animation || state_time > animation.length;
			})
			return all_finished ? 1 : 0;
		}
		return 0;
	},
	get 'query.any_animation_finished'() {
		if (AnimationController.selected?.selected_state) {
			let state = AnimationController.selected?.selected_state;
			let state_time = state.getStateTime();
			let finished_anim = state.animations.find(a => {
				let animation = Animation.all.find(anim => anim.uuid == a.animation);
				return animation && state_time > animation.length;
			})
			return finished_anim ? 1 : 0;
		}
		return 0;
	},
	'query.camera_rotation'(axis) {
		let val = cameraTargetToRotation(Preview.selected.camera.position.toArray(), Preview.selected.controls.target.toArray())[axis ? 0 : 1];
		if (axis == 0) val *= -1;
		return val;
	},
	'query.rotation_to_camera'(axis) {
		let val = cameraTargetToRotation([0, 0, 0], Preview.selected.camera.position.toArray())[axis ? 0 : 1] ;
		if (axis == 0) val *= -1;
		return val;
	},
	get 'query.distance_from_camera'() {
		return Preview.selected.camera.position.length() / 16;
	},
	'query.lod_index'(indices) {
		indices.sort((a, b) => a - b);
		let distance = Preview.selected.camera.position.length() / 16;
		let index = indices.length;
		indices.forEachReverse((val, i) => {
			if (distance < val) index = i;
		})
		return index;
	},
	'query.camera_distance_range_lerp'(a, b) {
		let distance = Preview.selected.camera.position.length() / 16;
		return Math.clamp(Math.getLerp(a, b, distance), 0, 1);
	},
	get 'time'() {
		return Timeline.time;
	}
}
Animator.MolangParser.variableHandler = function (variable) {
	var inputs = Interface.Panels.variable_placeholders.inside_vue.text.split('\n');
	var i = 0;
	while (i < inputs.length) {
		let key, val;
		[key, val] = inputs[i].split(/=\s*(.+)/);
		key = key.replace(/[\s;]/g, '');
		key = key.replace(/^v\./, 'variable.').replace(/^q\./, 'query.').replace(/^t\./, 'temp.').replace(/^c\./, 'context.');

		if (key === variable && val !== undefined) {
			val = val.trim();

			if (val.match(/^(slider|toggle|impulse)\(/)) {
				let [type, content] = val.substring(0, val.length - 1).split(/\(/);
				let [id] = content.split(/\(|, */);
				id = id.replace(/['"]/g, '');
				
				let button = Interface.Panels.variable_placeholders.inside_vue.buttons.find(b => b.id === id && b.type == type);
				return button ? parseFloat(button.value) : 0;
				
			} else {
				return val[0] == `'` ? val : Animator.MolangParser.parse(val);
			}
		}
		i++;
	}
};

(function() {
	let RootTokens = [
		'true',
		'false',
		'math.',
		'query.',	//'q.',
		'variable.',//'v.',
		'temp.',	//'t.',
		'context.',	//'c.',
		'this',
		'loop()',
		'return',
		'break',
		'continue',
	]
	let MolangQueries = [
		// common
		'all_animations_finished',
		'any_animation_finished',
		'anim_time',
		'life_time',
		'yaw_speed',
		'ground_speed',
		'vertical_speed',
		'property',
		'has_property()',
		'variant',
		'mark_variant',
		'skin_id',


		'above_top_solid',
		'actor_count',
		'all()',
		'all_tags',
		'anger_level',
		'any()',
		'any_tag',
		'approx_eq()',
		'armor_color_slot',
		'armor_material_slot',
		'armor_texture_slot',
		'average_frame_time',
		'blocking',
		'body_x_rotation',
		'body_y_rotation',
		'bone_aabb',
		'bone_origin',
		'bone_rotation',
		'camera_distance_range_lerp',
		'camera_rotation()',
		'can_climb',
		'can_damage_nearby_mobs',
		'can_dash',
		'can_fly',
		'can_power_jump',
		'can_swim',
		'can_walk',
		'cape_flap_amount',
		'cardinal_facing',
		'cardinal_facing_2d',
		'cardinal_player_facing',
		'combine_entities()',
		'count',
		'current_squish_value',
		'dash_cooldown_progress',
		'day',
		'death_ticks',
		'debug_output',
		'delta_time',
		'distance_from_camera',
		'effect_emitter_count',
		'effect_particle_count',
		'equipment_count',
		'equipped_item_all_tags',
		'equipped_item_any_tag()',
		'equipped_item_is_attachable',
		'eye_target_x_rotation',
		'eye_target_y_rotation',
		'facing_target_to_range_attack',
		'frame_alpha',
		'get_actor_info_id',
		'get_animation_frame',
		'get_default_bone_pivot',
		'get_locator_offset',
		'get_root_locator_offset',
		'had_component_group()',
		'has_any_family()',
		'has_armor_slot',
		'has_biome_tag',
		'has_block_property',
		'has_cape',
		'has_collision',
		'has_dash_cooldown',
		'has_gravity',
		'has_owner',
		'has_rider',
		'has_target',
		'head_roll_angle',
		'head_x_rotation',
		'head_y_rotation',
		'health',
		'heartbeat_interval',
		'heartbeat_phase',
		'heightmap',
		'hurt_direction',
		'hurt_time',
		'in_range()',
		'invulnerable_ticks',
		'is_admiring',
		'is_alive',
		'is_angry',
		'is_attached_to_entity',
		'is_avoiding_block',
		'is_avoiding_mobs',
		'is_baby',
		'is_breathing',
		'is_bribed',
		'is_carrying_block',
		'is_casting',
		'is_celebrating',
		'is_celebrating_special',
		'is_charged',
		'is_charging',
		'is_chested',
		'is_critical',
		'is_croaking',
		'is_dancing',
		'is_delayed_attacking',
		'is_digging',
		'is_eating',
		'is_eating_mob',
		'is_elder',
		'is_emerging',
		'is_emoting',
		'is_enchanted',
		'is_fire_immune',
		'is_first_person',
		'is_ghost',
		'is_gliding',
		'is_grazing',
		'is_idling',
		'is_ignited',
		'is_illager_captain',
		'is_in_contact_with_water',
		'is_in_love',
		'is_in_ui',
		'is_in_water',
		'is_in_water_or_rain',
		'is_interested',
		'is_invisible',
		'is_item_equipped',
		'is_item_name_any()',
		'is_jump_goal_jumping',
		'is_jumping',
		'is_laying_down',
		'is_laying_egg',
		'is_leashed',
		'is_levitating',
		'is_lingering',
		'is_moving',
		'is_name_any()',
		'is_on_fire',
		'is_on_ground',
		'is_on_screen',
		'is_onfire',
		'is_orphaned',
		'is_owner_identifier_any()',
		'is_persona_or_premium_skin',
		'is_playing_dead',
		'is_powered',
		'is_pregnant',
		'is_ram_attacking',
		'is_resting',
		'is_riding',
		'is_roaring',
		'is_rolling',
		'is_saddled',
		'is_scared',
		'is_selected_item',
		'is_shaking',
		'is_shaking_wetness',
		'is_sheared',
		'is_shield_powered',
		'is_silent',
		'is_sitting',
		'is_sleeping',
		'is_sneaking',
		'is_sneezing',
		'is_sniffing',
		'is_sonic_boom',
		'is_spectator',
		'is_sprinting',
		'is_stackable',
		'is_stalking',
		'is_standing',
		'is_stunned',
		'is_swimming',
		'is_tamed',
		'is_transforming',
		'is_using_item',
		'is_wall_climbing',
		'item_in_use_duration',
		'item_is_charged',
		'item_max_use_duration',
		'item_remaining_use_duration',
		'item_slot_to_bone_name()',
		'key_frame_lerp_time',
		'last_frame_time',
		'last_hit_by_player',
		'lie_amount',
		'life_span',
		'lod_index',
		'log',
		'main_hand_item_max_duration',
		'main_hand_item_use_duration',
		'max_durability',
		'max_health',
		'max_trade_tier',
		'maximum_frame_time',
		'minimum_frame_time',
		'model_scale',
		'modified_distance_moved',
		'modified_move_speed',
		'moon_brightness',
		'moon_phase',
		'movement_direction',
		'noise',
		'on_fire_time',
		'out_of_control',
		'player_level',
		'position()',
		'position_delta()',
		'previous_squish_value',
		'remaining_durability',
		'roll_counter',
		'rotation_to_camera()',
		'shake_angle',
		'shake_time',
		'shield_blocking_bob',
		'show_bottom',
		'sit_amount',
		'sleep_rotation',
		'sneeze_counter',
		'spellcolor',
		'standing_scale',
		'structural_integrity',
		'surface_particle_color',
		'surface_particle_texture_coordinate',
		'surface_particle_texture_size',
		'swell_amount',
		'swelling_dir',
		'swim_amount',
		'tail_angle',
		'target_x_rotation',
		'target_y_rotation',
		'texture_frame_index',
		'time_of_day',
		'time_since_last_vibration_detection',
		'time_stamp',
		'total_emitter_count',
		'total_particle_count',
		'trade_tier',
		'unhappy_counter',
		'walk_distance',
		'wing_flap_position',
		'wing_flap_speed',
	];
	let MolangQueryLabels = {
		'in_range()': 'in_range( value, min, max )',
		'all()': 'in_range( value, values... )',
		'any()': 'in_range( value, values... )',
		'approx_eq()': 'in_range( value, values... )',
	};
	let DefaultContext = [
		'item_slot',
		'block_face',
		'cardinal_block_face_placed_on',
		'is_first_person',
		'owning_entity',
		'player_offhand_arm_height',
		'other',
		'count',
	];
	let DefaultVariables = [
		'attack_time',
		'is_first_person',
	];
	let MathFunctions = [
		'sin()',
		'cos()',
		'abs()',
		'clamp()',
		'pow()',
		'sqrt()',
		'random()',
		'ceil()',
		'round()',
		'trunc()',
		'floor()',
		'mod()',
		'min()',
		'max()',
		'exp()',
		'ln()',
		'lerp()',
		'lerprotate()',
		'pi',
		'asin()',
		'acos()',
		'atan()',
		'atan2()',
		'die_roll()',
		'die_roll_integer()',
		'hermite_blend()',
		'random_integer()',
	];
	let MathFunctionLabels = {
		'clamp()': 'clamp( value, min, max )',
		'pow()': 'pow( base, exponent )',
		'random()': 'random( low, high )',
		'mod()': 'mod( value, denominator )',
		'min()': 'min( A, B )',
		'max()': 'max( A, B )',
		'lerp()': 'lerp( start, end, 0_to_1 )',
		'lerprotate()': 'lerprotate( start, end, 0_to_1 )',
		'atan2()': 'atan2( y, x )',
		'die_roll()': 'die_roll( num, low, high )',
		'die_roll_integer()': 'die_roll_integer( num, low, high )',
		'random_integer()': 'random_integer( low, high )',
		'hermite_blend()': 'hermite_blend( 0_to_1 )',
	};

	function getProjectVariables(current) {
		let set = new Set();
		let expressions = getAllMolangExpressions();
		expressions.forEach(exp => {
			if (!exp.value) return;
			let matches = exp.value.match(/(v|variable)\.\w+/gi);
			if (!matches) return;
			matches.forEach(match => {
				let name = match.substring(match.indexOf('.')+1);
				if (name !== current) set.add(name);
			})
		})
		return set;
	}

	function filterAndSortList(list, match, blacklist, labels) {
		let result = list.filter(f => f.startsWith(match));
		list.forEach(f => {
			if (!result.includes(f) && f.includes(match)) result.push(f);
		})
		if (blacklist) blacklist.forEach(black => result.remove(black));
		return result.map(text => {return {text, label: labels && labels[text], overlap: match.length}})
	}

	Animator.autocompleteMolang = function(text, position, type) {
		let beginning = text.substring(0, position).split(/[^a-zA-Z_.]\.*/g).last();
		if (!beginning) return [];

		beginning = beginning.toLowerCase();
		if (beginning.includes('.')) {
			let [namespace, dir] = beginning.split('.');
			if (namespace == 'math') {
				return filterAndSortList(MathFunctions, dir, null, MathFunctionLabels);
			}
			if (namespace == 'query' || namespace == 'q') {
				return filterAndSortList(MolangQueries, dir, type !== 'controller' && ['all_animations_finished', 'any_animation_finished'], MolangQueryLabels);
			}
			if (namespace == 'temp' || namespace == 't') {
				let temps = text.match(/([^a-z]|^)t(emp)?\.\w+/gi);
				if (temps) {
					temps = temps.map(t => t.split('.')[1]);
					temps = temps.filter((t, i) => t !== dir && temps.indexOf(t) === i);
					return filterAndSortList(temps, dir);
				}
			}
			if (namespace == 'context' || namespace == 'c') {
				return filterAndSortList(DefaultContext, dir);
			}
			if (namespace == 'variable' || namespace == 'v') {
				let options = [...getProjectVariables(dir)];
				options.safePush(...DefaultVariables);
				return filterAndSortList(options, dir);
			}
		} else {
			let root_tokens = RootTokens.slice();
			let labels = {};
			if (type === 'placeholders') {
				labels = {
					'toggle()': 'toggle( name )',
					'slider()': 'slider( name, step?, min?, max? )',
					'impulse()': 'impulse( name, duration )',
				};
				root_tokens.push(...Object.keys(labels));
			}
			return filterAndSortList(root_tokens, beginning, null, labels);
		}
		return [];
	}
})()

function getAllMolangExpressions() {
	let expressions = [];
	Animation.all.forEach(animation => {
		for (let key in Animation.properties) {
			let property = Animation.properties[key];
			if (Condition(property.condition, animation) && property.type == 'molang' && animation[key] && isNaN(animation[key])) {
				let value = animation[key];
				expressions.push({
					value,
					type: 'animation',
					key, animation
				});
			}
		}

		for (let key in animation.animators) {
			let animator = animation.animators[key];
			for (let channel in animator.channels) {
				animator[channel].forEach((kf, i) => {
					kf.data_points.forEach(data_point => {
						for (let key in KeyframeDataPoint.properties) {
							let property = KeyframeDataPoint.properties[key];
							if (Condition(property.condition, data_point) && property.type == 'molang' && data_point[key] && isNaN(data_point[key])) {
								expressions.push({
									value: data_point[key],
									type: 'keyframe',
									key, animation, animator, channel, kf
								})
							}
						}
					})
				})
			}
		}
	})
	AnimationController.all.forEach(controller => {
		controller.states.forEach(state => {
			if (state.on_entry && isNaN(state.on_entry)) {
				expressions.push({
					value: state.on_entry,
					type: 'controller',
					controller, state
				})
			}
			if (state.on_entry && isNaN(state.on_exit)) {
				expressions.push({
					value: state.on_exit,
					type: 'controller',
					controller, state
				})
			}
			state.animations.forEach(a => {
				if (a.blend_value && isNaN(a.blend_value)) {
					expressions.push({
						value: a.blend_value,
						type: 'controller_animation',
						controller, state
					})
				}
			})
			state.transitions.forEach(t => {
				if (t.condition && isNaN(t.condition)) {
					expressions.push({
						value: t.condition,
						type: 'controller_transition',
						controller, state
					})
				}
			})
		})
	})
	return expressions;
}

new ValidatorCheck('molang_syntax', {
	condition: {features: ['animation_mode']},
	update_triggers: ['update_keyframe_selection', 'edit_animation_properties'],
	run() {
		let check = this;
		function validateMolang(string, message, instance) {
			if (!string || typeof string !== 'string') return;
			let clear_string = string.replace(/'.*'/g, '0');
			
			let issues = [];
			if (clear_string.match(/([-+*/]\s*[+*/])|(\+\s*-)/)) {
				issues.push('Two directly adjacent operators');
			}
			if (clear_string.match(/^[+*/.,?=&<>|]/)) {
				issues.push('Expression starts with an invalid character');
			}
			if (clear_string.match(/[\w.]\s+[\w.]/)) {
				issues.push('Two expressions with no operator in between');
			}
			if (clear_string.match(/(^|[^a-z0-9_])[\d.]+[a-z_]+/i)) {
				issues.push('Invalid token ' + clear_string.match(/(^|[^a-z0-9_])[\d.]+[a-z_]+/i)[0].replace(/[^a-z0-9._]/g, ''));
			}
			if (clear_string.match(/[^\w\s+\-*/().,;:[\]!?=<>&|]/)) {
				issues.push('Invalid character: ' + clear_string.match(/[^\s\w+\-*/().,;:[\]!?=<>&|]+/g).join(', '));
			}
			let left = string.match(/\(/g) || 0;
			let right = string.match(/\)/g) || 0;
			if (left.length !== right.length) {
				issues.push('Brackets do not match');
			}

			if (issues.length) {
				let button;
				if (instance instanceof Animation) {
					button = {
						name: 'Edit Animation',
						icon: 'movie',
						click() {
							Dialog.open.close();
							instance.propertiesDialog();
						}
					}
				} else {
					button = {
						name: 'Reveal Keyframe',
						icon: 'icon-keyframe',
						click() {
							Dialog.open.close();
							instance.showInTimeline();
						}
					}
				}
				check.fail({
					message: `${message} ${issues.join('; ')}. Script: \`${string}\``,
					buttons: [button]
				})
			}
		}

		getAllMolangExpressions().forEach(ex => {
			if (ex.type == 'animation') {
				validateMolang(ex.value, `Property "${ex.key}" on animation "${ex.animation.name}" contains invalid molang:`, ex.animation);

			} else if (ex.type == 'keyframe') {
				let channel_name = ex.animator.channels[ex.channel].name;
				validateMolang(ex.value, `${channel_name} keyframe at ${ex.kf.time.toFixed(2)} on "${ex.animator.name}" in "${ex.animation.name}" contains invalid molang:`, ex.kf);
			}
		})
	}
})
