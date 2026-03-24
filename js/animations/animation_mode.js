import MolangParser from "molangjs";
import Wintersky from 'wintersky';
import { Mode } from "../modes";
import { clipboard, fs } from "../native_apis";
import { openMolangEditor } from "./molang_editor";
import './mirror_animating'

export const Animator = {
	get possible_channels() {
		let obj = {};
		Object.assign(obj, BoneAnimator.prototype.channels, EffectAnimator.prototype.channels);
		return obj;
	},
	open: false,
	get animations() {return Animation.all},
	get selected() {return Animation.selected},
	MolangParser: new MolangParser(),
	motion_trail: new THREE.Object3D(),
	onion_skin_object: new THREE.Object3D(),
	motion_trail_lock: false,
	_last_values: {},
	global_variable_lines: {},
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
						AnimationCodec.getCodec()?.importFile(file, true);
					})
				})
			}
		}

		Animator.open = true;
		Canvas.updateAllBones();
		for (let mesh of Mesh.all) {
			mesh.sortAllFaceVertices();
		}
		Animator.MolangParser.resetVariables();
		processVariablePlaceholderText(Project.variable_placeholders);

		scene.add(WinterskyScene.space);
		WinterskyScene.global_options.tick_rate = settings.particle_tick_rate.value;
		if (settings.motion_trails.value) scene.add(Animator.motion_trail);
		Animator.motion_trail.no_export = true;

		if (!Animator.timeline_node) {
			Animator.timeline_node = Panels.timeline.node;
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
		if (Panels.transform) {
			Toolbars.element_origin.toPlace('bone_origin')
		}
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

		if (Panels.transform) {
			let anchor = Panels.transform.node.querySelector('#element_origin_toolbar_anchor');
			if (anchor) anchor.before(Toolbars.element_origin.node);
		}
	},
	showDefaultPose(reduced_updates) {
		[...Group.all, ...Outliner.elements].forEach(node => {
			if (!node.constructor.animator) return;
			var mesh = node.mesh;
			if (mesh.fix_rotation) mesh.rotation.copy(mesh.fix_rotation);
			if (mesh.fix_position) mesh.position.copy(mesh.fix_position);
			if (node.constructor.animator.prototype.channels && node.constructor.animator.prototype.channels.scale) {
				mesh.scale.x = mesh.scale.y = mesh.scale.z = 1;
			}
		})
		for (let mesh of Mesh.all) {
			let armature = mesh.getArmature();
			if (armature && !reduced_updates) {
				Mesh.preview_controller.updateGeometry(mesh);
			}
		}
		Blockbench.dispatchEvent('display_default_pose', {reduced_updates});
		if (!reduced_updates) scene.updateMatrixWorld()
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
	showMotionTrail(target, fast = false) {
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
			if (g.parent instanceof OutlinerNode && g.parent.constructor.animator) iterate(g.parent);
		}
		iterate(target)
		
		let keyframes = {};
		let keyframe_source = Group.first_selected || ((Outliner.selected[0] && Outliner.selected[0].constructor.animator) ? Outliner.selected[0] : null);
		if (keyframe_source) {
			let ba = Animation.selected.getBoneAnimator(keyframe_source);
			if (!ba) return;
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
			let position = (target instanceof OutlinerNode && target.children)
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
		if (!fast) {
			Animator.preview();
		}

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

		if (!enabled) return false;

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
			Animator.displayMeshDeformation();

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

		return true;
	},
	displayMeshDeformation() {
		for (let mesh of Mesh.all) {
			let armature = mesh.getArmature();
			if (armature) {
				let vertex_offsets = armature.calculateVertexDeformation(mesh);
				Mesh.preview_controller.displayDeformation(mesh, vertex_offsets);
			}
		}
	},
	stackAnimations(animations, in_loop, controller_blend_values = 0) {
		if (animations.length > 1 && Animation.selected && animations.includes(Animation.selected)) {
			// Ensure selected animation is applied last so that transform gizmo gets correct pre rotation
			animations = animations.slice();
			animations.remove(Animation.selected);
			animations.push(Animation.selected);
		}
		Group.all.concat(Outliner.elements).forEach(node => {
			if (!node.constructor.animator) return;
			Animator.resetLastValues();
			animations.forEach((animation, anim_i) => {
				if (animation.loop == 'once' && Timeline.time > animation.length && animation.length) {
					return;
				}
				let ba = animation.getBoneAnimator(node);
				let multiplier = animation.blend_weight ? Math.clamp(Animator.MolangParser.parse(animation.blend_weight), 0, Infinity) : 1;
				if (typeof controller_blend_values[animation.uuid] == 'number') multiplier *= controller_blend_values[animation.uuid];
				if (anim_i == animations.length - 1) {
					let mesh = node.mesh;
					if (!mesh.pre_rotation) mesh.pre_rotation = new THREE.Euler();
					mesh.pre_rotation.copy(mesh.rotation);
				}
				ba?.displayFrame(multiplier);
			})
		})

		scene.updateMatrixWorld();

		Animator.resetLastValues();

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

		Animator.displayMeshDeformation();

		Billboard.all.forEach(billboard => {
			Billboard.preview_controller.updateFacingCamera(billboard);
		})

		if (Interface.Panels.variable_placeholders.inside_vue.text.match(/^\s*preview\.texture\s*=/mi)) {
			let tex_index = Animator.MolangParser.variableHandler('preview.texture');
			let texture = Texture.all[tex_index % Texture.all.length];
			if (texture && texture != Texture.selected) texture.select();
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
		Blockbench.dispatchEvent('display_animation_frame', {in_loop});
	},
	particle_effects: {},
	loadParticleEmitter(path, content) {
		let json_content = autoParseJSON(content, {file_path: path});
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
		console.warn('"Animator.loadFile" is deprecated, use AnimationCodec instead')
		return AnimationCodec.codecs.bedrock.loadFile(file, animation_filter);
	},
	buildFile(path_filter, name_filter) {
		console.warn('"Animator.buildFile" is deprecated, use AnimationCodec instead')
		let animations = Animator.animations.filter((a) => {
			return (typeof path_filter != 'string' || a.path == path_filter || (!a.path && !path_filter)) && (!name_filter || !name_filter.length || name_filter.includes(a.name));
		})
		return AnimationCodec.codecs.bedrock.compileFile(animations);
	},
	importFile(file, auto_loaded) {
		console.warn('"Animator.importFile" is deprecated, use AnimationCodec instead')
		return AnimationCodec.codecs.bedrock.importFile(file, auto_loaded);
	},
	exportAnimationFile(path, save_as) {
		console.warn('"Animator.exportAnimationFile" is deprecated, use AnimationCodec instead')
		return AnimationCodec.codecs.bedrock.exportFile(path, save_as);
	},
	buildController(path_filter, name_filter) {
		console.warn('"Animator.buildController" is deprecated, use AnimationCodec instead')
		let controllers = AnimationController.all.filter(function(a) {
			return (typeof path_filter != 'string' || a.path == path_filter || (!a.path && !path_filter)) && (!name_filter || !name_filter.length || name_filter.includes(a.name))
		})
		return AnimationCodec.codecs.bedrock_animation_controller.compileFile(controllers);
	},
	exportAnimationControllerFile(path, save_as) {
		console.warn('"Animator.exportAnimationControllerFile" is deprecated, use AnimationCodec instead')
		return AnimationCodec.codecs.bedrock_animation_controller.exportFile(path, save_as);
	}
}
Canvas.gizmos.push(Animator.motion_trail, Animator.onion_skin_object);

export const WinterskyScene = new Wintersky.Scene({
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
	new Mode('animate', {
		icon: 'movie',
		default_tool: 'move_tool',
		category: 'navigate',
		hidden_node_types: ['cube', 'mesh', 'texture_mesh'],
		condition: () => Format.animation_mode,
		onSelect: () => {
			Animator.join()
		},
		onUnselect: () => {
			Animator.leave()
		}
	})
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
	let onion_skin_toggle = new Toggle('animation_onion_skin', {
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
			onion_skin_toggle.tool_config.options.enabled = this.value;
			Animator.updateOnionSkin();
		}
	})
	new Action('copy_animation_pose', {
		icon: 'detection_and_zone',
		category: 'animation',
		condition: () => Animator.open && Animation.selected,
		click() {
			let new_keyframes = [];

			for (let uuid in Animation.selected.animators) {
				let animator = Animation.selected.animators[uuid];
				if (!animator || !animator.keyframes.length || !(animator.group || animator.element)) continue;

				for (let channel in animator.channels) {
					if (!animator[channel] || !animator[channel].length) continue;
					let kf = animator[channel].find(kf => Math.epsilon(kf.time, Timeline.time, 1e-5));
					if (!kf) {
						kf = animator.createKeyframe(null, Timeline.time, channel, false, false);
						new_keyframes.push(kf)
					}
				}
			}

			Clipbench.keyframes = [];
			if (new_keyframes.length == 0) return;

			new_keyframes.forEach((kf) => {
				let copy = kf.getUndoCopy();
				copy.time_offset = 0;
				Clipbench.keyframes.push(copy);
			})
			for (let kf of new_keyframes) {
				kf.remove();
			}
			if (isApp) {
				clipboard.writeHTML(JSON.stringify({type: 'keyframes', content: Clipbench.keyframes}));
			}
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
			height: 400,
			sidebar_index: 10,
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
				openMolangContextMenu(event) {
					new Menu([
						{
							name: 'menu.text_edit.expression_editor',
							icon: 'code_blocks',
							click: () => {
								openMolangEditor({
									autocomplete_context: MolangAutocomplete.AnimationContext,
									text: this.text
								}, result => this.text = result)
							}
						}
					]).open(event);
				},
				autocomplete(text, position) {
					if (Settings.get('autocomplete_code') == false) return [];
					return MolangAutocomplete.VariablePlaceholdersContext.autocomplete(text, position);
				}
			},
			watch: {
				text(text) {
					if (Project && typeof text == 'string') {
						Project.variable_placeholders = text;
						processVariablePlaceholderText(text)
						this.updateButtons();
						Project.variable_placeholder_buttons.replace(this.buttons);
						Timeline.vue.updateGraph();
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
						@contextmenu="openMolangContextMenu($event)"
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

function processVariablePlaceholderText(text) {
	Animator.global_variable_lines = {}
	for (const line of text.split('\n')) {
		let [key, val] = line.split(/=\s*(.+)/)
		if(val === undefined) {
			continue
		}
		key = key.replace(/[\s;]/g, '')
		key = key
			.replace(/^v\./, 'variable.')
			.replace(/^q\./, 'query.')
			.replace(/^t\./, 'temp.')
			.replace(/^c\./, 'context.');
		Animator.global_variable_lines[key] = val.trim()
	}
}

Object.assign(window, {
	MolangParser,
	Animator,
	Wintersky,
	WinterskyScene
});
