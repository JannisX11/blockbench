const Animator = {
	get possible_channels() {
		let obj = {};
		Object.assign(obj, BoneAnimator.prototype.channels, EffectAnimator.prototype.channels);
		return obj;
	},
	open: false,
	get animations() {return Animation.all},
	get selected() {return Animation.selected},
	MolangParser: new Molang(),
	motion_trail: new THREE.Object3D(),
	onion_skin_object: new THREE.Object3D(),
	motion_trail_lock: false,
	_last_values: {},
	resetLastValues() {
		for (let channel in BoneAnimator.prototype.channels) {
			if (BoneAnimator.prototype.channels[channel].transform) Animator._last_values[channel] = [0, 0, 0];
		}
	},
	join() {
		if (isApp && (Format.id == 'bedrock' || Format.id == 'bedrock_old') && !Project.BedrockEntityManager.initialized_animations) {
			Project.BedrockEntityManager.initAnimations();
		}
		if (isApp && Project.memory_animation_files_to_load) {
			let paths = Project.memory_animation_files_to_load.filter(path => !Animation.all.find(a => a.path == path));
			if (paths.length) {
				Blockbench.read(paths, {}, files => {
					files.forEach(file => {
						Animator.importFile(file, true);
					})
				})
			}
		}

		Animator.open = true;
		Canvas.updateAllBones();
		Animator.MolangParser.resetVariables();

		scene.add(WinterskyScene.space);
		WinterskyScene.global_options.tick_rate = settings.particle_tick_rate.value;
		if (settings.motion_trails.value) scene.add(Animator.motion_trail);
		Animator.motion_trail.no_export = true;

		if (!Animator.timeline_node) {
			Animator.timeline_node = Panels.timeline.node;
		}
		updateInterface()
		if (Panels.element) {
			Toolbars.element_origin.toPlace('bone_origin')
		}
		if (!Timeline.is_setup) {
			Timeline.setup()
		}
		if (Canvas.outlines.children.length) {
			Canvas.outlines.children.empty()
			Canvas.updateAllPositions()
		}
		if (AnimationItem.all.length && !AnimationItem.all.includes(Animation.selected)) {
			AnimationItem.all[0].select();
		} else if (!Animation.all.length) {
			Timeline.selected.empty();
		}
		if (Group.first_selected) {
			Group.first_selected.select();
		}
		BarItems.slider_animation_length.update();
		Animator.preview();
	},
	leave() {
		Timeline.pause()
		Animator.open = false;

		scene.remove(WinterskyScene.space);
		scene.remove(Animator.motion_trail);
		scene.remove(Animator.onion_skin_object);
		Animator.resetParticles(true);

		three_grid.position.z = three_grid.position.x;
		Canvas.ground_plane.position.z = Canvas.ground_plane.position.x;
		Animator.showDefaultPose();
		if (Project) Project.model_3d.scale.set(1, 1, 1);

		if (Panels.element) {
			let anchor = Panels.element.node.querySelector('#element_origin_toolbar_anchor');
			if (anchor) anchor.before(Toolbars.element_origin.node);
		}
	},
	showDefaultPose(no_matrix_update) {
		[...Group.all, ...Outliner.elements].forEach(node => {
			if (!node.constructor.animator) return;
			var mesh = node.mesh;
			if (mesh.fix_rotation) mesh.rotation.copy(mesh.fix_rotation);
			if (mesh.fix_position) mesh.position.copy(mesh.fix_position);
			if (node.constructor.animator.prototype.channels && node.constructor.animator.prototype.channels.scale) {
				mesh.scale.x = mesh.scale.y = mesh.scale.z = 1;
			}
		})
		if (!no_matrix_update) scene.updateMatrixWorld()
	},
	resetParticles(optimized) {
		for (var path in Animator.particle_effects) {
			let {emitters} = Animator.particle_effects[path];

			for (var uuid in emitters) {
				let emitter = emitters[uuid];
				if (emitter.tick_interval !== undefined) continue;
				if (emitter.local_space.parent) emitter.local_space.parent.remove(emitter.local_space);
				if (emitter.global_space.parent) emitter.global_space.parent.remove(emitter.global_space);
			}
		}
	},
	showMotionTrail(target) {
		if (!target) {
			target = Project.motion_trail_lock && OutlinerNode.uuids[Project.motion_trail_lock];
			if (!target) {
				target = Group.first_selected || ((Outliner.selected[0] && Outliner.selected[0].constructor.animator) ? Outliner.selected[0] : null);
			}
		}
		if (!target) return;
		let animation = Animation.selected;
		let currentTime = Timeline.time;
		let step = Timeline.getStep();
		let max_time = Math.max(Timeline.time, animation.getMaxLength());
		if (!max_time) max_time = 1;
		let start_time = 0;
		if (max_time > 20) {
			start_time = Math.clamp(currentTime - 8, 0, Infinity);
			max_time = Math.min(max_time, currentTime + 8);
		}
		let geometry = new THREE.BufferGeometry();
		let bone_stack = [];
		let iterate = g => {
			bone_stack.push(g);
			if (g.parent instanceof Group) iterate(g.parent);
		}
		iterate(target)
		
		let keyframes = {};
		let keyframe_source = Group.first_selected || ((Outliner.selected[0] && Outliner.selected[0].constructor.animator) ? Outliner.selected[0] : null);
		if (keyframe_source) {
			let ba = Animation.selected.getBoneAnimator(keyframe_source);
			let channel = target == Group.first_selected ? ba.position : (ba[Toolbox.selected.animation_channel] || ba.position)
			channel.forEach(kf => {
				keyframes[Math.round(kf.time / step)] = kf;
			})
		}

		function displayTime(time) {
			Timeline.time = time;
			let multiplier = animation.blend_weight ? Math.clamp(Animator.MolangParser.parse(animation.blend_weight), 0, Infinity) : 1;

			bone_stack.forEach(node => {
				let mesh = node.mesh;
				let ba = animation.getBoneAnimator(node)

				if (mesh.fix_rotation) mesh.rotation.copy(mesh.fix_rotation)
				if (mesh.fix_position) mesh.position.copy(mesh.fix_position)

				if (node instanceof NullObject) {
					if (!ba.muted.position) ba.displayPosition(ba.interpolate('position'), multiplier);
				} else {
					mesh.scale.x = mesh.scale.y = mesh.scale.z = 1;
					ba.displayFrame(multiplier);
				}
			})
			target.mesh.updateWorldMatrix(true, false)
		}

		let line_positions = [];
		let point_positions = [];
		let keyframe_positions = []
		let keyframeUUIDs = []
		let i = 0;
		for (var time = start_time; time <= max_time; time += step) {
			displayTime(time);
			let position = target instanceof Group
						 ? THREE.fastWorldPosition(target.mesh, new THREE.Vector3())
						 : target.getWorldCenter(true);
			position = position.toArray();
			line_positions.push(...position);

			let keyframe = keyframes[i];
			if (keyframe) {
				keyframe_positions.push(...position);
				keyframeUUIDs.push(keyframe.uuid);
			} else {
				point_positions.push(...position);
			}
			i++;
		}
		geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(line_positions), 3));
		
		Timeline.time = currentTime;
		Animator.preview();

		var line = new THREE.Line(geometry, Canvas.outlineMaterial);
		line.no_export = true;
		Animator.motion_trail.children.forEachReverse(child => {
			Animator.motion_trail.remove(child);
		})
		Animator.motion_trail.add(line);

		let point_material = new THREE.PointsMaterial({size: 4, sizeAttenuation: false, color: Canvas.outlineMaterial.color})
		let point_geometry = new THREE.BufferGeometry();
		point_geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(point_positions), 3));
		let points = new THREE.Points(point_geometry, point_material);
		Animator.motion_trail.add(points);

		let keyframe_material = new THREE.PointsMaterial({size: 10, sizeAttenuation: false, color: Canvas.outlineMaterial.color})
		let keyframe_geometry = new THREE.BufferGeometry();
		keyframe_geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(keyframe_positions), 3));
		let keyframe_points = new THREE.Points(keyframe_geometry, keyframe_material);
		keyframe_points.isKeyframe = true;
		keyframe_points.keyframeUUIDs = keyframeUUIDs;
		Animator.motion_trail.add(keyframe_points);
	},
	updateOnionSkin() {
		let enabled = BarItems.animation_onion_skin.value;
		let options = BarItems.animation_onion_skin.tool_config.options;
		let selective = options.selective;

		Animator.onion_skin_object.children.forEach(object => {
			object.geometry.dispose();
		});
		Animator.onion_skin_object.children.empty();

		if (!enabled) return;

		let times = [];

		if (options.frames == 'select') {
			times = [Timeline.vue.onion_skin_time];
		} else {
			let interval = Timeline.getStep() * (options.interval || 1);
			let go_pre = options.frames == 'previous', go_nex = options.frames == 'next';
			if (options.frames == 'previous_next') go_pre = go_nex = true;

			for (let i = 1; i <= options.count; i++) {
				if (go_pre) times.push(Timeline.time - interval * i);
				if (go_nex) times.push(Timeline.time + interval * i);
			}
		}

		let elements = Outliner.elements;
		let last_time = Timeline.time;

		let i = -1;
		for (let time of times) {
			i++;
			Timeline.time = time;
			Animator.showDefaultPose(true);
			Animator.stackAnimations(Animation.all.filter(a => a.playing), false);

			elements.forEach(obj => {
				if (!obj.visibility) return;
				if (selective && !obj.selected) return;
				let mesh = obj.mesh;
				if (!mesh || !mesh.geometry || !mesh.outline) return;

				let copy = mesh.outline.clone();
				copy.geometry = mesh.outline.geometry.clone();
				copy.material = time < last_time ? Canvas.onionSkinEarlierMaterial : Canvas.onionSkinLaterMaterial;
				copy.visible = true;

				THREE.fastWorldPosition(mesh, copy.position);
				copy.position.sub(scene.position);
				copy.rotation.setFromQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
				mesh.getWorldScale(copy.scale);

				copy.name = obj.uuid+'_onion_skin_outline';
				Animator.onion_skin_object.add(copy);
			})
		}
		Timeline.time = last_time;
		Animator.showDefaultPose(true);
		Animator.stackAnimations(Animation.all.filter(a => a.playing), false);

		scene.add(Animator.onion_skin_object);
	},
	stackAnimations(animations, in_loop, controller_blend_values = 0) {
		if (animations.length > 1 && Animation.selected && animations.includes(Animation.selected)) {
			// Ensure selected animation is applied last so that transform gizmo gets correct pre rotation
			animations = animations.slice();
			animations.remove(Animation.selected);
			animations.push(Animation.selected);
		}
		[...Group.all, ...Outliner.elements].forEach(node => {
			if (!node.constructor.animator) return;
			Animator.resetLastValues();
			animations.forEach((animation, anim_i) => {
				if (animation.loop == 'once' && Timeline.time > animation.length && animation.length) {
					return;
				}
				let multiplier = animation.blend_weight ? Math.clamp(Animator.MolangParser.parse(animation.blend_weight), 0, Infinity) : 1;
				if (typeof controller_blend_values[animation.uuid] == 'number') multiplier *= controller_blend_values[animation.uuid];
				if (anim_i == animations.length - 1) {
					let mesh = node.mesh;
					if (!mesh.pre_rotation) mesh.pre_rotation = new THREE.Euler();
					mesh.pre_rotation.copy(mesh.rotation);
				}
				animation.getBoneAnimator(node).displayFrame(multiplier);
			})
		})

		Animator.resetLastValues();
		scene.updateMatrixWorld();

		// Effects
		Animator.resetParticles(true);
		animations.forEach(animation => {
			if (animation.animators.effects) {
				animation.animators.effects.displayFrame(in_loop);
			}
		})
	},
	preview(in_loop) {
		// Reset
		Animator.showDefaultPose(true);

		// Controller
		if (AnimationController.selected?.selected_state) {
			let controller_blend_values, animations_to_play;
			let controller = AnimationController.selected;
			let {selected_state, last_state} = controller;
			let state_time = selected_state.getStateTime();
			let blend_progress = (last_state && last_state.blend_transition) ? Math.clamp(state_time / last_state.blend_transition, 0, 1) : 1;
			let blend_value = last_state?.calculateBlendValue(blend_progress) ?? blend_progress;

			// Active State
			Timeline.time = state_time;
			controller_blend_values = {};
			animations_to_play = [];

			selected_state.animations.forEach(a => {
				let animation = Animation.all.find(anim => a.animation == anim.uuid);
				if (!animation) return;
				let user_blend_value = a.blend_value.trim() ? Animator.MolangParser.parse(a.blend_value) : 1;
				controller_blend_values[animation.uuid] = user_blend_value * blend_value;
				animations_to_play.push(animation);
			})
			Animator.stackAnimations(animations_to_play, in_loop, controller_blend_values);

			// Last State
			if (blend_value < 1 && last_state) {
				Timeline.time = last_state.getStateTime();
				controller_blend_values = {};
				animations_to_play = [];

				last_state.animations.forEach(a => {
					let animation = Animation.all.find(anim => a.animation == anim.uuid);
					if (!animation) return;
					let user_blend_value = a.blend_value.trim() ? Animator.MolangParser.parse(a.blend_value) : 1;
					if (!controller_blend_values[animation.uuid]) controller_blend_values[animation.uuid] = 0;
					controller_blend_values[animation.uuid] += user_blend_value * (1-blend_value);
					animations_to_play.push(animation);
				})
				Animator.stackAnimations(animations_to_play, in_loop, controller_blend_values);
			}
		} else {
			Animator.stackAnimations(Animation.all.filter(a => a.playing), in_loop);
		}


		// Shift ground
		if (Canvas.ground_plane.visible && Animation.selected && Animation.selected.anim_time_update.includes('modified_distance_moved')) {
			let value = Animator.MolangParser.parse(Animation.selected.anim_time_update, {'query.modified_distance_moved': Timeline.time});
			value = (Timeline.time / value) * Timeline.time * 3;
			value = (value % 64) || 0;
			Canvas.ground_plane.position.z = Canvas.ground_plane.position.x + value;
			three_grid.position.z = three_grid.position.x + value;
		} else {
			three_grid.position.z = three_grid.position.x;
			Canvas.ground_plane.position.z = Canvas.ground_plane.position.x;
		}

		Animator.updateOnionSkin();

		if (Interface.Panels.variable_placeholders.inside_vue.text.match(/^\s*preview\.texture\s*=/mi)) {
			let tex_index = Animator.MolangParser.variableHandler('preview.texture');
			let texture = Texture.all[tex_index % Texture.all.length];
			if (texture) texture.select();
		}
		if (Interface.Panels.variable_placeholders.inside_vue.text.match(/^\s*preview\.texture_frame\s*=/mi)) {
			let frame = Animator.MolangParser.variableHandler('preview.texture_frame');

			Texture.all.forEach(tex => {
				tex.currentFrame = (frame % tex.frameCount) || 0;
			})
			TextureAnimator.update(Texture.all.filter(tex => tex.frameCount > 1));
		}
		if (Project) Project.model_3d.scale.set(1, 1, 1);
		if (Interface.Panels.variable_placeholders.inside_vue.text.match(/^\s*preview\.scale\s*=/mi)) {
			let scale = Animator.MolangParser.variableHandler('preview.scale');
			Project.model_3d.scale.x = Project.model_3d.scale.y = Project.model_3d.scale.z = scale;
		}
		if (Interface.Panels.variable_placeholders.inside_vue.text.match(/^\s*preview\.scalex\s*=/mi)) {
			let scale = Animator.MolangParser.variableHandler('preview.scalex');
			Project.model_3d.scale.x = scale;
		}
		if (Interface.Panels.variable_placeholders.inside_vue.text.match(/^\s*preview\.scaley\s*=/mi)) {
			let scale = Animator.MolangParser.variableHandler('preview.scaley');
			Project.model_3d.scale.y = scale;
		}
		if (Interface.Panels.variable_placeholders.inside_vue.text.match(/^\s*preview\.scalez\s*=/mi)) {
			let scale = Animator.MolangParser.variableHandler('preview.scalez');
			Project.model_3d.scale.z = scale;
		}

		if (Group.first_selected || (Outliner.selected[0] && Outliner.selected[0].constructor.animator)) {
			Transformer.updateSelection()
		}
		Blockbench.dispatchEvent('display_animation_frame')
	},
	particle_effects: {},
	loadParticleEmitter(path, content) {
		let json_content = autoParseJSON(content);
		if (!json_content || !json_content.particle_effect) return;

		if (Animator.particle_effects[path]) {
			Animator.particle_effects[path].config
				.reset()
				.set('file_path', path)
				.setFromJSON(json_content, {path});
			for (var uuid in Animator.particle_effects[path].emitters) {
				let emitter = Animator.particle_effects[path].emitters[uuid];
				emitter.updateConfig();
			}
		} else {
			Animator.particle_effects[path] = {
				config: new Wintersky.Config(WinterskyScene, json_content, {path}),
				emitters: {}
			};
			if (isApp) {
				let timeout;
				this.watcher = fs.watch(path, (eventType) => {
					if (eventType == 'change') {
						if (timeout) clearTimeout(timeout)
						timeout = setTimeout(() => {
							Blockbench.read(path, {errorbox: false}, (files) => {
								Animator.loadParticleEmitter(path, files[0].content);
							})
						}, 60)
					}
				})
			}
		}
		return Animator.particle_effects[path];
	},
	loadFile(file, animation_filter) {
		var json = file.json || autoParseJSON(file.content);
		let path = file.path;
		let new_animations = [];
		function multilinify(string) {
			return typeof string == 'string'
						? string.replace(/;\s*(?!$)/g, ';\n')
						: string
		}
		if (!json) return new_animations;
		if (typeof json.animations === 'object') {
			for (let ani_name in json.animations) {
				if (animation_filter && !animation_filter.includes(ani_name)) continue;
				//Animation
				var a = json.animations[ani_name]
				var animation = new Animation({
					name: ani_name,
					saved_name: ani_name,
					path,
					loop: a.loop && (a.loop == 'hold_on_last_frame' ? 'hold' : 'loop'),
					override: a.override_previous_animation,
					anim_time_update: multilinify(a.anim_time_update),
					blend_weight: multilinify(a.blend_weight),
					start_delay: multilinify(a.start_delay),
					loop_delay: multilinify(a.loop_delay),
					length: a.animation_length
				}).add()
				//Bones
				if (a.bones) {
					let existing_variables = [
						'query.anim_time',
						'query.life_time',
						'query.time_stamp',
						'query.delta_time',
						'query.camera_rotation',
						'query.rotation_to_camera',
						'query.distance_from_camera',
						'query.lod_index',
						'query.camera_distance_range_lerp',
					];
					function processPlaceholderVariables(text) {
						if (typeof text !== 'string') return;
						text = text.replace(/v\./, 'variable.').replace(/q\./, 'query.').replace(/t\./, 'temp.').replace(/c\./, 'context.').toLowerCase();
						let matches = text.match(/(query|variable|context|temp)\.\w+/gi);
						if (!matches) return;
						matches.forEach(match => {
							let panel_vue = Interface.Panels.variable_placeholders.inside_vue;
							if (existing_variables.includes(match)) return;
							if (panel_vue.text.split('\n').find(line => line.substr(0, match.length) == match)) return;

							let [space, name] = match.split(/\./);
							if (panel_vue.text != '' && panel_vue.text.substr(-1) !== '\n') panel_vue.text += '\n';

							if (name == 'modified_distance_moved') {
								panel_vue.text += `${match} = time * 8`;
							} else if (name.match(/is_|has_|can_|blocking/)) {
								panel_vue.text += `${match} = toggle('${name}')`;
							} else {
								panel_vue.text += `${match} = slider('${name}')`;
							}
						})
					}
					function getKeyframeDataPoints(source) {
						if (source instanceof Array) {
							source.forEach(processPlaceholderVariables);
							return [{
								x: source[0],
								y: source[1],
								z: source[2],
							}]
						} else if (['number', 'string'].includes(typeof source)) {
							processPlaceholderVariables(source);
							return [{
								x: source, y: source, z: source
							}]
						} else if (typeof source == 'object') {
							let points = [];
							if (source.pre) {
								points.push(getKeyframeDataPoints(source.pre)[0])
							}
							if (source.post && !(source.pre instanceof Array && source.post instanceof Array && source.post.equals(source.pre))) {
								points.push(getKeyframeDataPoints(source.post)[0])
							}
							return points;
						}
					}
					for (var bone_name in a.bones) {
						var b = a.bones[bone_name]
						let lowercase_bone_name = bone_name.toLowerCase();
						var group = Group.all.find(group => group.name.toLowerCase() == lowercase_bone_name)
						let uuid = group ? group.uuid : guid();

						var ba = new BoneAnimator(uuid, animation, bone_name);
						animation.animators[uuid] = ba;
						//Channels
						for (var channel in b) {
							if (!BoneAnimator.prototype.channels[channel]) continue;
							if (typeof b[channel] === 'string' || typeof b[channel] === 'number' || b[channel] instanceof Array) {
								ba.addKeyframe({
									time: 0,
									channel,
									uniform: !(b[channel] instanceof Array),
									data_points: getKeyframeDataPoints(b[channel]),
								})
							} else if (typeof b[channel] === 'object' && b[channel].post) {
								ba.addKeyframe({
									time: 0,
									channel,
									interpolation: b[channel].lerp_mode,
									uniform: !(b[channel].post instanceof Array),
									data_points: getKeyframeDataPoints(b[channel]),
								});
							} else if (typeof b[channel] === 'object') {
								for (var timestamp in b[channel]) {
									ba.addKeyframe({
										time: parseFloat(timestamp),
										channel,
										interpolation: b[channel][timestamp].lerp_mode,
										uniform: !(b[channel][timestamp] instanceof Array),
										data_points: getKeyframeDataPoints(b[channel][timestamp]),
									});
								}
							}
							// Set step interpolation
							let sorted_keyframes = ba[channel].slice().sort((a, b) => a.time - b.time);
							let last_kf_was_step = false;
							sorted_keyframes.forEach((kf, i) => {
								let next = sorted_keyframes[i+1];
								if (next && next.data_points.length == 2 && kf.getArray(1).equals(next.getArray(0))) {
									next.data_points.splice(0, 1);
									kf.interpolation = 'step';
									last_kf_was_step = true;
								} else if (!next && last_kf_was_step) {
									kf.interpolation = 'step';
								}
							})
						}
						if (b.relative_to && b.relative_to.rotation == 'entity') {
							ba.rotation_global = true;
						}
					}
				}
				if (a.sound_effects) {
					if (!animation.animators.effects) {
						animation.animators.effects = new EffectAnimator(animation);
					}
					for (var timestamp in a.sound_effects) {
						var sounds = a.sound_effects[timestamp];
						if (sounds instanceof Array === false) sounds = [sounds];
						animation.animators.effects.addKeyframe({
							channel: 'sound',
							time: parseFloat(timestamp),
							data_points: sounds
						})
					}
				}
				if (a.particle_effects) {
					if (!animation.animators.effects) {
						animation.animators.effects = new EffectAnimator(animation);
					}
					for (var timestamp in a.particle_effects) {
						var particles = a.particle_effects[timestamp];
						if (particles instanceof Array === false) particles = [particles];
						particles.forEach(particle => {
							if (particle) particle.script = particle.pre_effect_script;
						})
						animation.animators.effects.addKeyframe({
							channel: 'particle',
							time: parseFloat(timestamp),
							data_points: particles
						})
					}
				}
				if (a.timeline) {
					if (!animation.animators.effects) {
						animation.animators.effects = new EffectAnimator(animation);
					}
					for (var timestamp in a.timeline) {
						var entry = a.timeline[timestamp];
						var script = entry instanceof Array ? entry.join('\n') : entry;
						
						if (typeof script == 'string') {
							let panel_vue = Interface.Panels.variable_placeholders.inside_vue;
							let tex_variables = script.match(/(v|variable)\.texture\w*\s*=/);
							if (tex_variables && !panel_vue.text.includes('preview.texture =')) {
								if (panel_vue.text != '' && panel_vue.text.substr(-1) !== '\n') panel_vue.text += '\n';
								panel_vue.text += `preview.texture = ${tex_variables[0].replace(/\s*=$/, '')}`
							}
						}
						animation.animators.effects.addKeyframe({
							channel: 'timeline',
							time: parseFloat(timestamp),
							data_points: [{script}]
						})
					}
				}
				animation.calculateSnappingFromKeyframes();
				if (!Animation.selected && Animator.open) {
					animation.select()
				}
				new_animations.push(animation)
				Blockbench.dispatchEvent('load_animation', {animation, json});
			}
		} else if (typeof json.animation_controllers === 'object') {
			for (let ani_name in json.animation_controllers) {
				if (animation_filter && !animation_filter.includes(ani_name)) continue;
				//Animation
				let a = json.animation_controllers[ani_name];
				let controller = new AnimationController({
					name: ani_name,
					saved_name: ani_name,
					path,
					states: a.states,
					initial_state: a.initial_state || (a.states?.default ? 'default' : undefined)
				}).add()
				if (!Animation.selected && !AnimationController.selected && Animator.open) {
					controller.select();
				}
				new_animations.push(controller)
				Blockbench.dispatchEvent('load_animation_controller', {animation_controller: controller, json});
			}
		}
		return new_animations
	},
	buildFile(path_filter, name_filter) {
		var animations = {}
		Animator.animations.forEach(function(a) {
			if ((typeof path_filter != 'string' || a.path == path_filter || (!a.path && !path_filter)) && (!name_filter || !name_filter.length || name_filter.includes(a.name))) {
				let ani_tag = a.compileBedrockAnimation();
				animations[a.name] = ani_tag;
			}
		})
		return {
			format_version: '1.8.0',
			animations: animations
		}
	},
	buildController(path_filter, name_filter) {
		var controllers = {}
		AnimationController.all.forEach(function(a) {
			if ((typeof path_filter != 'string' || a.path == path_filter || (!a.path && !path_filter)) && (!name_filter || !name_filter.length || name_filter.includes(a.name))) {
				let ani_tag = a.compileForBedrock();
				controllers[a.name] = ani_tag;
			}
		})
		return {
			format_version: '1.19.0',
			animation_controllers: controllers
		}
	},
	importFile(file, auto_loaded) {
		let form = {};
		if (auto_loaded && file.path) {
			form['_path'] = {type: 'info', text: file.path};
		}
		let json = autoParseJSON(file.content)
		let keys = [];
		let is_controller = !!json.animation_controllers;
		let entries = json.animations || json.animation_controllers;
		for (var key in entries) {
			// Test if already loaded
			if (isApp && file.path) {
				let is_already_loaded = false
				for (var anim of is_controller ? AnimationController.all : Animation.all) {
					if (anim.path == file.path && anim.name == key) {
						is_already_loaded = true;
						break;
					}
				}
				if (is_already_loaded) continue;
			}
			form['anim' + key.hashCode()] = {label: key, type: 'checkbox', value: true, nocolon: true};
			keys.push(key);
		}
		file.json = json;
		if (keys.length == 0) {
			Blockbench.showQuickMessage('message.no_animation_to_import');

		} else if (keys.length == 1) {
			Undo.initEdit({animations: []})
			let new_animations = Animator.loadFile(file, keys);
			Undo.finishEdit('Import animations', {animations: new_animations})

		} else {
			return new Promise(resolve => {
				let buttons = ['dialog.ok', 'dialog.ignore'];
				if (auto_loaded && Project?.memory_animation_files_to_load?.length > 1) {
					buttons.push('dialog.ignore_all');
				}
				let dialog = new Dialog({
					id: 'animation_import',
					title: 'dialog.animation_import.title',
					form,
					buttons,
					cancelIndex: 1,
					onConfirm(form_result) {
						this.hide();
						let names = [];
						for (var key of keys) {
							if (form_result['anim' + key.hashCode()]) {
								names.push(key);
							}
						}
						Undo.initEdit({animations: []})
						let new_animations = Animator.loadFile(file, names);
						Undo.finishEdit('Import animations', {animations: new_animations})
						resolve();
					},
					onCancel(index) {
						Project.memory_animation_files_to_load.remove(file.path);
						resolve();
					},
					onButton(index) {
						if (auto_loaded && index == 2) {
							Project.memory_animation_files_to_load.empty();
						}
						resolve();
					}
				});
				form.select_all_none = {
					type: 'buttons',
					buttons: ['generic.select_all', 'generic.select_none'],
					click(index) {
						let values = {};
						keys.forEach(key => values['anim' + key.hashCode()] = (index == 0));
						dialog.setFormValues(values);
					}
				}
				dialog.show();
			});
		}
	},
	exportAnimationFile(path) {
		let filter_path = path || '';

		if (isApp && !path) {
			path = Project.export_path
			var exp = new RegExp(osfs.replace('\\', '\\\\')+'models'+osfs.replace('\\', '\\\\'))
			var m_index = path.search(exp)
			if (m_index > 3) {
				path = path.substr(0, m_index) + osfs + 'animations' + osfs +  pathToName(Project.export_path, true)
			}
			path = path.replace(/(\.geo)?\.json$/, '.animation.json')
		}

		if (isApp && path && fs.existsSync(path)) {
			Animator.animations.forEach(function(a) {
				if (a.path == filter_path && !a.saved) {
					a.save();
				}
			})
		} else {
			let content = Animator.buildFile(filter_path, true);
			Blockbench.export({
				resource_id: 'animation',
				type: 'JSON Animation',
				extensions: ['json'],
				name: (Project.geometry_name||'model')+'.animation',
				startpath: path,
				content: autoStringify(content),
				custom_writer: isApp && ((content, new_path, cb) => {
					if (new_path && fs.existsSync(new_path)) {
						Animator.animations.forEach(function(a) {
							if (a.path == filter_path && !a.saved) {
								a.path = new_path;
								a.save();
							}
						})
					} else {
						Blockbench.writeFile(new_path, {content})
						cb(new_path);
					}
				})
			}, new_path => {
				Animator.animations.forEach(function(a) {
					if (a.path == filter_path) {
						a.path = new_path;
						a.saved = true;
					}
				})
			})
		}
	},
	exportAnimationControllerFile(path) {
		let filter_path = path || '';

		if (isApp && !path) {
			path = Project.export_path
			var exp = new RegExp(osfs.replace('\\', '\\\\')+'models'+osfs.replace('\\', '\\\\'))
			var m_index = path.search(exp)
			if (m_index > 3) {
				path = path.substr(0, m_index) + osfs + 'animation_controllers' + osfs +  pathToName(Project.export_path, true)
			}
			path = path.replace(/(\.geo)?\.json$/, '.animation_controllers.json')
		}

		if (isApp && path && fs.existsSync(path)) {
			AnimationController.all.forEach(function(a) {
				if (a.path == filter_path && !a.saved) {
					a.save();
				}
			})
		} else {
			let content = Animator.buildController(filter_path, true);
			Blockbench.export({
				resource_id: 'animation_controller',
				type: 'JSON Animation Controller',
				extensions: ['json'],
				name: (Project.geometry_name||'model')+'.animation_controllers',
				startpath: path,
				content: autoStringify(content),
				custom_writer: isApp && ((content, new_path, cb) => {
					if (new_path && fs.existsSync(new_path)) {
						AnimationController.all.forEach(function(a) {
							if (a.path == filter_path && !a.saved) {
								a.path = new_path;
								a.save();
							}
						})
					} else {
						Blockbench.writeFile(new_path, {content})
						cb(new_path);
					}
				})
			}, new_path => {
				AnimationController.all.forEach(function(a) {
					if (a.path == filter_path) {
						a.path = new_path;
						a.saved = true;
					}
				})
			})
		}
	}
}
Canvas.gizmos.push(Animator.motion_trail, Animator.onion_skin_object);

const WinterskyScene = new Wintersky.Scene({
	fetchTexture: function(config) {
		if (config.preview_texture) {
			return config.preview_texture;
		}
		if (isApp && config.file_path && config.particle_texture_path) {
			let path_arr = config.file_path.split(PathModule.sep);
			let particle_index = path_arr.indexOf('particles')
			path_arr.splice(particle_index)
			let filePath = PathModule.join(path_arr.join(PathModule.sep), config.particle_texture_path.replace(/\.png$/, '')+'.png')

			if (fs.existsSync(filePath)) {
				config.preview_texture = filePath;
				return filePath;
			}
		}
	},
	async fetchParticleFile(identifier, config) {
		if (!identifier || !config.file_path || !isApp) return;

		let path_segments = config.file_path.split(/[\\/]+/);
		let index = path_segments.lastIndexOf('particles');
		let base_path = path_segments.slice(0, index+1).join(PathModule.sep);

		let prio_name = identifier.split(':')[1];
		let find_options = {
			filter_regex: /\.json$/i,
			priority_regex: prio_name ? new RegExp(prio_name, 'i') : undefined,
			read_file: true,
			json: true
		};
		return Blockbench.findFileFromContent([base_path], find_options, (file_path, json) => {
			if (json?.particle_effect?.description?.identifier == identifier) {
				return {json, file_path};
			}
		});
	}
});
WinterskyScene.global_options.scale = 16;
WinterskyScene.global_options.loop_mode = 'auto';
WinterskyScene.global_options.parent_mode = 'entity';

Prism.languages.molang['function-name'] = /\b(?!\d)(math\.\w+|button)(?=[\t ]*\()/i;

Blockbench.on('reset_project', () => {
	for (let path in Animator.particle_effects) {
		let effect = Animator.particle_effects[path];
		if (isApp && effect.watcher) {
			effect.watcher.close()
		}
		for (let uuid in effect.emitters) {
			effect.emitters[uuid].delete();
			delete effect.emitters[uuid];
		}
		delete Animator.particle_effects[path];
	}
})

Animator.animation_presets = {
	float: {
		name: 'Float',
		rotation: {
			"0.0": [
				"math.sin(query.anim_time * 120) * 6",
				"0",
				"math.cos(query.anim_time * 100) * 4",
			]
		},
		position: {
			"0.0": [
				"0",
				"math.sin(query.anim_time * 90) * 1",
				"0",
			]
		}
	},
	flap: {
		name: 'Flap',
		rotation: {
			"0.0": [
				"0",
				"0",
				"math.sin(query.anim_time * 1200) * 6",
			]
		},
	},
	swing: {
		name: 'Swing',
		rotation: {
			"0.0": [
				"math.sin(query.anim_time * 360) * 25",
				"0",
				"0",
			]
		},
	},
	strike: {
		name: 'Strike',
		"rotation": {
			"0.0": [-120, 0, 0],
			"0.0417": [-115, 0, 0],
			"0.0833": [-100, 0, 0],
			"0.125": [-37, 0, 0],
			"0.1667": [-16, 0, 0],
			"0.2083": [-8, 0, 0],
			"0.3333": [0, 0, 0]
		}
	},
	scale_in: {
		name: 'Scale in',
		"scale": {
			"0.0": [0, 0, 0],
			"0.0417": [0.06, 0.06, 0.06],
			"0.0833": [0.2, 0.2, 0.2],
			"0.1667": [0.8, 0.8, 0.8],
			"0.2083": [0.94, 0.94, 0.94],
			"0.25": [1, 1, 1]
		}
	},
	scale_out: {
		name: 'Scale out',
		"scale": {
			"0.0": [1, 1, 1],
			"0.0417": [0.94, 0.94, 0.94],
			"0.0833": [0.8, 0.8, 0.8],
			"0.1667": [0.2, 0.2, 0.2],
			"0.2083": [0.06, 0.06, 0.06],
			"0.25": [0, 0, 0]
		}
	},
	drop_down: {
		name: 'Drop down',
		"rotation": {
			"0.125": [0, 0, -2],
			"0.1667": [0, 0, -0.5],
			"0.2083": [0, 0, 1.25],
			"0.2917": [0, 0, 2.5],
			"0.3333": [0, 0, 2],
			"0.4167": [0, 0, -0.43],
			"0.4583": [0, 0, -0.8],
			"0.5417": [0, 0, -0.3],
			"0.5833": [0, 0, 0]
		},
		"position": {
			"0.0": [0, 12, 0],
			"0.1667": [0, 0, 0],
			"0.25": [0, 2.6, 0],
			"0.2917": [0, 2.5, 0],
			"0.375": [0, 0, 0],
			"0.4583": [0, 0.9, 0],
			"0.5": [0, 0.85, 0],
			"0.5833": [0, 0, 0]
		}
	},
	impact: {
		name: 'Impact',
		length: 0.5417,
		"rotation": {
			"0.0": {
				"post": [0, 0, 0],
				"lerp_mode": "catmullrom"
			},
			"0.125": {
				"post": [-15, 0, 0],
				"lerp_mode": "catmullrom"
			},
			"0.2917": {
				"post": [10, 0, 0],
				"lerp_mode": "catmullrom"
			},
			"0.4167": {
				"post": [-2.5, 0, 0],
				"lerp_mode": "catmullrom"
			},
			"0.5417": {
				"post": [0, 0, 0],
				"lerp_mode": "catmullrom"
			}
		},
		"position": {
			"0.0": [0, 0, 0],
			"0.0417": [0, -1, 0],
			"0.125": [0, 0, 0]
		}
	},
	shiver: {
		name: 'Shiver',
		rotation: {
			"0.0": [
				"0",
				"0",
				"math.sin(query.anim_time * 3000) * 3",
			]
		}
	},
	sway: {
		name: 'Sway',
		"rotation": {
			"0.0": ["math.sin(query.anim_time * 60) * 3", 0, "math.sin(query.anim_time * 120) * 5"]
		}
	},
	shake: {
		name: 'Shake',
		rotation: {
			"0.0": [0, 0, 0],
			"0.125": [0, 0, "math.sin(query.anim_time * 2160) * 20"],
			"0.375": [0, 0, "math.sin(query.anim_time * 2160) * 20"],
			"0.5": [0, 0, 0],
		}
	},
	jump: {
		name: 'Jump',
		length: 1.0833,
		"rotation": {
			"0.0": {
				"post": [0, 0, 0],
				"lerp_mode": "catmullrom"
			},
			"0.3333": {
				"post": [2.5, 0, 0],
				"lerp_mode": "catmullrom"
			},
			"0.5": {
				"post": [7.5, 0, 0],
				"lerp_mode": "catmullrom"
			},
			"0.7917": {
				"post": [-9.6, 0, 0],
				"lerp_mode": "catmullrom"
			},
			"0.875": {
				"post": [-4, 0, 0],
				"lerp_mode": "catmullrom"
			},
			"1.0833": {
				"post": [0, 0, 0],
				"lerp_mode": "catmullrom"
			}
		},
		"position": {
			"0.0": {
				"post": [0, 0, 0],
				"lerp_mode": "catmullrom"
			},
			"0.3333": {
				"post": [0, -3, 0],
				"lerp_mode": "catmullrom"
			},
			"0.4167": {
				"post": [0, 3.07, -3.25],
				"lerp_mode": "catmullrom"
			},
			"0.5417": {
				"post": [0, 7, -13],
				"lerp_mode": "catmullrom"
			},
			"0.6667": {
				"post": [0, 4.77, -22.85],
				"lerp_mode": "catmullrom"
			},
			"0.7917": {
				"post": [0, -2, -29.5],
				"lerp_mode": "catmullrom"
			},
			"1.0833": {
				"post": [0, 0, -30],
				"lerp_mode": "catmullrom"
			}
		},
	},
	swell: {
		name: 'Swell',
		length: 1.0417,
		"rotation": {
			"0": [0, 0, 0],
			"1": ["math.sin(q.anim_time * 3000) * 3", 0, "math.cos(q.anim_time * 2000) * 3"],
			"1.0417": [0, 0, 0]
		},
		"scale": {
			"0": [1, 1, 1],
			"1": [1.2, 1.2, 1.2],
			"0.1667": [1.0075, 1.0075, 1.0075],
			"0.3333": [1.02, 1.02, 1.02],
			"0.5": [1.045, 1.045, 1.045],
			"0.6667": [1.08, 1.08, 1.08],
			"0.8333": [1.13, 1.13, 1.13],
			"1.0417": {"pre": [1.6, 1.6, 1.6], "post": [0, 0, 0]}
		}
	},
	circle: {
		name: 'Circle',
		"position": {
			"0.0": [
				"math.cos(query.anim_time * 90) * 32",
				0,
				"-math.sin(query.anim_time * 90) * 32"
			]
		},
		"rotation": {
			"0.0": [
				0,
				"query.anim_time * 90",
				0,
			]
		}
	},
	open_door: {
		name: 'Open  Door',
		"rotation": {
			"0.0": [0, 0, 0],
			"0.0417": [0, -7.24, 0],
			"0.0833": [0, -21.895, 0],
			"0.1667": [0, -95.76, 0],
			"0.2083": [0, -104.125, 0],
			"0.25": [0, -106.38, 0],
			"0.2917": [0, -104.445, 0],
			"0.3333": [0, -99.36, 0],
			"0.375": [0, -96.485, 0],
			"0.4167": [0, -96, 0]
		}
	},
	close_door: {
		name: 'Close  Door',
		"rotation": {
			"0.0": [0, -96, 0],
			"0.0417": [0, -90.365, 0],
			"0.0833": [0, -77.345, 0],
			"0.125": [0, -53.2, 0],
			"0.1667": [0, -28.13, 0],
			"0.2083": [0, 0.6, 0],
			"0.2917": [0, -5.525, 0],
			"0.375": [0, 0, 0]
		}
	},
	look_at_target: {
		name: 'Look At Target',
		"rotation": {
			"0.0": [
				"query.target_x_rotation",
				"query.target_y_rotation",
				0
			]
		}
	},
	rotate_to_camera: {
		name: 'Rotate To Camera',
		"rotation": {
			"0.0": [
				"query.rotation_to_camera(0)",
				"query.rotation_to_camera(1) - query.body_y_rotation",
				0
			]
		}
	},
	flicker: {
		name: 'Flicker',
		"scale": {
			"0.0417": {"pre": [1, 1, 1], "post": [0, 0, 0]},
			"0.1667": {"pre": [0, 0, 0], "post": [1, 1, 1]},
			"0.2917": {"pre": [1, 1, 1], "post": [0, 0, 0]},
			"0.4167": {"pre": [0, 0, 0], "post": [1, 1, 1]},
			"0.5": {"pre": [1, 1, 1], "post": [0, 0, 0]},
			"0.625": {"pre": [0, 0, 0], "post": [1, 1, 1]},
			"0.75": {"pre": [1, 1, 1], "post": [0, 0, 0]},
			"0.7917": {"pre": [0, 0, 0], "post": [1, 1, 1]},
			"0.875": {"pre": [1, 1, 1], "post": [0, 0, 0]},
			"1.0": {"pre": [0, 0, 0], "post": [1, 1, 1]}
		}
	},
	hide: {
		name: 'Invisible',
		scale: {
			"0.0": [0, 0, 0]
		},
	},
}


BARS.defineActions(function() {
	// Motion Trail
	new Toggle('lock_motion_trail', {
		icon: 'lock_open',
		category: 'animation',
		condition: () => Animator.open && (Group.first_selected || (Outliner.selected[0] && Outliner.selected[0].constructor.animator)),
		onChange(value) {
			if (value && (Group.first_selected || (Outliner.selected[0] && Outliner.selected[0].constructor.animator))) {
				Project.motion_trail_lock = Group.first_selected ? Group.first_selected.uuid : Outliner.selected[0].uuid;
			} else {
				Project.motion_trail_lock = false;
				Animator.showMotionTrail();
			}
		}
	})
	// Onion Skin
	new Toggle('animation_onion_skin', {
		category: 'view',
		condition: {modes: ['animate']},
		tool_config: new ToolConfig('animation_onion_skin', {
			title: 'action.animation_onion_skin',
			form: {
				enabled: {type: 'checkbox', label: 'menu.mirror_painting.enabled', value: false},
				frames: {type: 'select', label: 'menu.animation_onion_skin.frames', value: 'previous', options: {
					select: 'menu.animation_onion_skin.select',
					previous: 'menu.animation_onion_skin.previous',
					next: 'menu.animation_onion_skin.next',
					previous_next: 'menu.animation_onion_skin.previous_next',
				}},
				count: {type: 'number', label: 'menu.animation_onion_skin.count', value: 1, condition: form => form.frames != 'select'},
				interval: {type: 'number', label: 'menu.animation_onion_skin.interval', value: 1, condition: form => form.frames != 'select'},
				selective: {type: 'checkbox', label: 'menu.animation_onion_skin_selective', value: true},
			},
			onOpen() {
				this.setFormValues({enabled: BarItems.animation_onion_skin.value}, false);
			},
			onFormChange(formResult) {
				if (BarItems.animation_onion_skin.value != formResult.enabled) {
					BarItems.animation_onion_skin.trigger();
				} else {
					Animator.updateOnionSkin();
				}
				Timeline.vue.onion_skin_selectable = formResult.enabled && this.options.frames == 'select';
			}
		}),
		onChange() {
			Timeline.vue.onion_skin_selectable = this.value && this.tool_config.options.frames == 'select';
			Animator.updateOnionSkin();
		}
	})
})


Interface.definePanels(function() {

	new Panel('variable_placeholders', {
		icon: 'fas.fa-stream',
		condition: {modes: ['animate']},
		growable: true,
		resizable: true,
		default_position: {
			slot: 'left_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400
		},
		component: {
			name: 'panel-placeholders',
			components: {VuePrismEditor},
			data() { return {
				text: '',
				buttons: []
			}},
			methods: {
				updateButtons() {
					let old_values = {};
					this.buttons.forEach(b => old_values[b.id] = b.value);
					this.buttons.empty();

					let text = this.text//.toLowerCase();
					let matches = text.matchAll(/(slider|toggle|impulse)\(.+\)/gi);

					for (let match of matches) {
						let [type, content] = match[0].substring(0, match[0].length - 1).split(/\(/);
						let [id, ...args] = content.split(/\(|, */);
						id = id.replace(/['"]/g, '');
						if (this.buttons.find(b => b.id == id)) return;

						let variable = text.substring(0, match.index).match(/[\w.-]+ *= *$/);
						variable = variable ? variable[0].replace(/[ =]+/g, '').replace(/^v\./i, 'variable.').replace(/^q\./i, 'query.').replace(/^t\./i, 'temp.').replace(/^c\./i, 'context.') : undefined;

						if (type == 'slider') {
							this.buttons.push({
								type,
								id,
								value: old_values[id] || 0,
								variable,
								step: isNaN(args[0]) ? undefined : parseFloat(args[0]),
								min: isNaN(args[1]) ? undefined : parseFloat(args[1]),
								max: isNaN(args[2]) ? undefined : parseFloat(args[2])
							})
						} else if (type == 'toggle') {
							this.buttons.push({
								type,
								id,
								value: old_values[id] || 0,
								variable,
							})
						} else if (type == 'impulse') {
							this.buttons.push({
								type,
								id,
								value: 0,
								variable,
								duration: parseFloat(args[0]) || 0.1
							})
						}
					}
				},
				changeButtonValue(button, event) {
					if (button.type == 'toggle') {
						button.value = event.target.checked ? 1 : 0;
					}
					if (button.type == 'impulse') {
						button.value = 1;
						setTimeout(() => {
							button.value = 0;
						}, Math.clamp(button.duration, 0, 1) * 1000);
					}
					if (button.variable) {
						delete Animator.MolangParser.variables[button.variable];
					}
					Animator.preview();
				},
				slideButton(button, e1) {
					convertTouchEvent(e1);
					let last_event = e1;
					let started = false;
					let move_calls = 0;
					let last_val = 0;
					let total = 0;
					let clientX = e1.clientX;
					function start() {
						started = true;
						if (!e1.touches && last_event == e1 && e1.target.requestPointerLock) e1.target.requestPointerLock();
					}
		
					function move(e2) {
						convertTouchEvent(e2);
						if (!started && Math.abs(e2.clientX - e1.clientX) > 5) {
							start()
						}
						if (started) {
							if (e1.touches) {
								clientX = e2.clientX;
							} else {
								let limit = move_calls <= 2 ? 1 : 100;
								clientX += Math.clamp(e2.movementX, -limit, limit);
							}
							let val = Math.round((clientX - e1.clientX) / 45);
							let difference = (val - last_val);
							if (!difference) return;
							if (button.step) {
								difference *= button.step;
							} else {
								difference *= canvasGridSize(e2.shiftKey || Pressing.overrides.shift, e2.ctrlOrCmd || Pressing.overrides.ctrl);
							}

							
							button.value = Math.clamp(Math.roundTo((parseFloat(button.value) || 0) + difference, 4), button.min, button.max);

							last_val = val;
							last_event = e2;
							total += difference;
							move_calls++;

							Animator.preview()
							Blockbench.setStatusBarText(trimFloatNumber(total));
						}
					}
					function off(e2) {
						if (document.exitPointerLock) document.exitPointerLock()
						removeEventListeners(document, 'mousemove touchmove', move);
						removeEventListeners(document, 'mouseup touchend', off);
						Blockbench.setStatusBarText();
					}
					addEventListeners(document, 'mouseup touchend', off);
					addEventListeners(document, 'mousemove touchmove', move);
				},
				autocomplete(text, position) {
					let test = MolangAutocomplete.VariablePlaceholdersContext.autocomplete(text, position);
					return test;
				}
			},
			watch: {
				text(text) {
					if (Project && typeof text == 'string') {
						Project.variable_placeholders = text;
						this.updateButtons();
						Project.variable_placeholder_buttons.replace(this.buttons);
					}
				}
			},
			template: `
				<div style="flex-grow: 1; display: flex; flex-direction: column; overflow: visible;">

					<ul id="placeholder_buttons">
						<li v-for="button in buttons" :key="button.id" :class="{placeholder_slider: button.type == 'slider'}" @click="button.type == 'impulse' && changeButtonValue(button, $event)" :buttontype="button.type">
							<i v-if="button.type == 'impulse'" class="material-icons">play_arrow</i>
							<input v-if="button.type == 'toggle'" type="checkbox" :value="button.value == 1" @change="changeButtonValue(button, $event)" :id="'placeholder_button_'+button.id">
							<numeric-input v-if="button.type == 'slider'" :step="button.step" :min="button.min" :max="button.max" v-model="button.value" @input="changeButtonValue(button, $event)" />
							<label :for="'placeholder_button_'+button.id" @mousedown="slideButton(button, $event)" @touchstart="slideButton(button, $event)">{{ button.id }}</label>
						</li>
					</ul>

					<p>${tl('panel.variable_placeholders.info')}</p>

					<vue-prism-editor
						id="var_placeholder_area"
						class="molang_input tab_target capture_tab_key"
						v-model="text"
						language="molang"
						:autocomplete="autocomplete"
						:line-numbers="false"
						style="flex-grow: 1;"
						onkeyup="Animator.preview()"
					/>
				</div>
			`
		}
	})
})
