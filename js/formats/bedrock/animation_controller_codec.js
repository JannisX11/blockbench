import { fs } from '../../native_apis';
import { AnimationCodec } from './../../animations/animation_codec'


export const animation_codec = new AnimationCodec('bedrock_animation_controller', {
	multiple_per_file: true,
	// MARK: Import
	loadFile(file, animation_filter) {
		var json = file.json || autoParseJSON(file.content, {file_path: file.path});
		let path = file.path;
		let new_animations = [];
		let new_sounds = {};
		let new_particles = {};
		if (!json) return new_animations;
		if (typeof json.animations === 'object') {
			return AnimationCodec.codecs.bedrock.loadFile(file, animation_filter);
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
				}).add();

				for (let state of controller.states) {
					for (let sound of state.sounds) {
						new_sounds[sound.effect] ??= [];
						new_sounds[sound.effect].push(sound);
					}
					for (let particle of state.particles) {
						new_particles[particle.effect] ??= [];
						new_particles[particle.effect].push(particle);
					}
				}
				if (!Animation.selected && !AnimationController.selected && Animator.open) {
					controller.select();
				}
				new_animations.push(controller)
				Blockbench.dispatchEvent('load_animation_controller', {animation_controller: controller, json});
			}
			if (Project.BedrockEntityManager) {
				for (let short_name in new_particles) {
					let path_result = Project.BedrockEntityManager.getParticleFile(short_name);
					if (path_result) {
						let effect = Animator.loadParticleEmitter(path_result, fs.readFileSync(path_result, 'utf-8'));
						delete effect.config.preview_texture;
						for (let entry of new_particles[short_name]) {
							entry.file = path_result;
						}
					}
				}
				for (let short_name in new_sounds) {
					let path_result = Project.BedrockEntityManager.getSoundFile(short_name);
					if (path_result && fs.existsSync(path_result)) {
						for (let entry of new_sounds[short_name]) {
							entry.file = path_result;
						}
					}
				}
			}
		}
		return new_animations
	},

	// MARK: Export
	compileAnimation(a) {
		return a.compileForBedrock();
	},
	compileFile(anim_controllers) {
		let controllers = {}
		anim_controllers.forEach(function(a) {
			let ani_tag = a.compileForBedrock();
			controllers[a.name] = ani_tag;
		})
		return {
			format_version: '1.19.0',
			animation_controllers: controllers
		}
	},
	exportFile(path, save_as) {
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

		if (!save_as && isApp && path && fs.existsSync(path)) {
			AnimationController.all.forEach(function(a) {
				if (a.path == filter_path && !a.saved) {
					a.save();
				}
			})
		} else {
			let animations = Animator.animations.filter((a) => {
				return a.path == filter_path || (!a.path && !filter_path);
			})
			let content = this.compileFile(animations);
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
	},
	deleteAnimationFromFile(controller) {
		let content = fs.readFileSync(controller.path, 'utf-8');
		let json = autoParseJSON(content, false);
		if (json && json.animation_controllers && json.animation_controllers[controller.name]) {
			delete json.animation_controllers[controller.name];
			Blockbench.writeFile(controller.path, {content: compileJSON(json)});
			Undo.history.last().before.animation_controllers[controller.uuid].saved = false
		}
	}
})
