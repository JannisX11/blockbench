import { fs } from "../../native_apis"

export const animation_codec = new AnimationCodec('bedrock', {

	// MARK: Import
	pickFile() {
		let path = Project.export_path
		if (isApp) {
			let exp = new RegExp(osfs.replace('\\', '\\\\')+'models'+osfs.replace('\\', '\\\\'))
			let m_index = path.search(exp)
			if (m_index > 3) {
				path = path.substr(0, m_index) + osfs + 'animations' + osfs + pathToName(Project.export_path).replace(/\.geo/, '.animation')
			}
		}
		Blockbench.import({
			resource_id: 'animation',
			extensions: ['json'],
			type: 'JSON Animation, JSON Animation Controller',
			multiple: true,
			startpath: path
		}, async (files) => {
			for (let file of files) {
				await this.importFile(file);
			}
		})
	},
	importFile(file, auto_loaded) {
		let codec = this;
		let form = {};
		if (auto_loaded && file.path) {
			form['_path'] = {type: 'info', text: file.path};
		}
		let json = autoParseJSON(file.content, {file_path: file.path})
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
			form['anim' + key.hashCode()] = {label: key, type: 'checkbox', value: true};
			keys.push(key);
		}
		file.json = json;
		if (keys.length == 0) {
			Blockbench.showQuickMessage('message.no_animation_to_import');

		} else if (keys.length == 1) {
			Undo.initEdit({animations: []})
			let new_animations = codec.loadFile(file, keys);
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
						let new_animations = codec.loadFile(file, names);
						Undo.finishEdit('Import animations', {animations: new_animations})
						resolve();
					},
					onCancel(index) {
						if (Project.memory_animation_files_to_load) {
							Project.memory_animation_files_to_load.remove(file.path);
						}
						resolve();
					},
					onButton(index) {
						if (auto_loaded && index == 2 && Project.memory_animation_files_to_load) {
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
	loadFile(file, animation_filter) {
		var json = file.json || autoParseJSON(file.content, {file_path: file.path});
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
						let matches = text.match(/(query|variable|context|temp)\.\w+(\([^)]*\))?/gi);
						if (!matches) return;
						matches.forEach(match => {
							let panel_vue = Interface.Panels.variable_placeholders.inside_vue;
							if (existing_variables.includes(match)) return;
							if (panel_vue.text.split('\n').find(line => line.substr(0, match.length) == match)) return;

							let [space, name] = match.split(/\./);
							if (panel_vue.text != '' && panel_vue.text.substr(-1) !== '\n') panel_vue.text += '\n';
							name = name.replace(/[')]/g, '').replace('(', ':');

							if (name == 'modified_distance_moved') {
								panel_vue.text += `${match} = time * 8`;
							} else if (name.match(/is_|has_|can_|blocking/)) {
								panel_vue.text += `${match} = toggle('${name}')`;
							} else {
								panel_vue.text += `${match} = slider('${name}')`;
							}
						})
					}
					function getKeyframeDataPoints(source, channel) {
						if (source instanceof Array) {
							source.forEach(processPlaceholderVariables);
							let vec = {
								x: source[0],
								y: source[1],
								z: source[2],
							}
							if (channel == 'position') {
								vec.x = invertMolang(vec.x);
							}
							if (channel == 'rotation') {
								vec.x = invertMolang(vec.x);
								vec.y = invertMolang(vec.y);
							}
							return [vec];
						} else if (['number', 'string'].includes(typeof source)) {
							processPlaceholderVariables(source);
							return [{
								x: source, y: source, z: source
							}]
						} else if (typeof source == 'object') {
							let points = [];
							if (source.pre) {
								points.push(getKeyframeDataPoints(source.pre, channel)[0]);
							}
							if (source.post && !(source.pre instanceof Array && source.post instanceof Array && source.post.equals(source.pre))) {
								points.push(getKeyframeDataPoints(source.post, channel)[0]);
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
									data_points: getKeyframeDataPoints(b[channel], channel),
								})
							} else if (typeof b[channel] === 'object' && b[channel].post) {
								ba.addKeyframe({
									time: 0,
									channel,
									interpolation: b[channel].lerp_mode,
									uniform: !(b[channel].post instanceof Array),
									data_points: getKeyframeDataPoints(b[channel], channel),
								});
							} else if (typeof b[channel] === 'object') {
								for (var timestamp in b[channel]) {
									ba.addKeyframe({
										time: parseFloat(timestamp),
										channel,
										interpolation: b[channel][timestamp].lerp_mode,
										uniform: !(b[channel][timestamp] instanceof Array),
										data_points: getKeyframeDataPoints(b[channel][timestamp], channel),
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
				animation.setScopeFromAnimators();
				if (!Animation.selected && Animator.open) {
					animation.select()
				}
				new_animations.push(animation)
				Blockbench.dispatchEvent('load_animation', {animation, json});
			}
		} else if (typeof json.animation_controllers === 'object') {
			AnimationCodec.codecs.bedrock_animation_controller.loadFile(file, animation_filter);
		}
		return new_animations
	},

	reloadAnimation(animation) {
		Blockbench.read([animation.path], {}, ([file]) => {
			Undo.initEdit({animations: [animation]})
			let anim_index = Animation.all.indexOf(animation);
			animation.remove(false, false);
			let [new_animation] = animation_codec.loadFile(file, [animation.name]);
			if (new_animation) {
				Animation.all.remove(new_animation);
				Animation.all.splice(anim_index, 0, new_animation);
				Undo.finishEdit('Reload animation', {animations: [new_animation]})
			} else {
				Undo.cancelEdit();
			}
		})
	},
	reloadFile(path) {
		let id = path;
		let animations_to_remove = Animation.all.filter(anim => anim.path == id && anim.saved);
		let controllers_to_remove = AnimationController.all.filter(anim => anim.path == id && anim.saved);
		if (!animations_to_remove.length && !controllers_to_remove.length) return;

		Undo.initEdit({animations: animations_to_remove, animation_controllers: controllers_to_remove});
		let names = [];
		let selected_name = AnimationItem.selected?.name;
		animations_to_remove.forEach(animation => {
			names.push(animation.name);
			animation.remove(false, false);
		})
		controllers_to_remove.forEach(animation => {
			names.push(animation.name);
			animation.remove(false, false);
		})

		Blockbench.read([id], {}, ([file]) => {
			let new_animations = animation_codec.loadFile(file, names);
			let selected = new_animations.find(item => item.name == selected_name);
			if (selected) selected.select();
			if (new_animations[0] instanceof AnimationController) {
				Undo.finishEdit('Reload animation controller file', {animation_controllers: new_animations, animations: []});
			} else {
				Undo.finishEdit('Reload animation file', {animations: new_animations, animation_controllers: []});
			}
		})
	},
	// MARK: Export
	compileAnimation(animation) {
		let ani_tag = {};

		if (animation.loop == 'hold') {
			ani_tag.loop = 'hold_on_last_frame';
		} else if (animation.loop == 'loop' || animation.getMaxLength() == 0) {
			ani_tag.loop = true;
		}

		if (animation.length) ani_tag.animation_length = Math.roundTo(animation.length, 4);
		if (animation.override) ani_tag.override_previous_animation = true;
		if (animation.anim_time_update) ani_tag.anim_time_update = exportMolang(animation.anim_time_update);
		if (animation.blend_weight) ani_tag.blend_weight = exportMolang(animation.blend_weight);
		if (animation.start_delay) ani_tag.start_delay = exportMolang(animation.start_delay);
		if (animation.loop_delay && ani_tag.loop) ani_tag.loop_delay = exportMolang(animation.loop_delay);
		ani_tag.bones = {};

		for (var uuid in animation.animators) {
			var animator = animation.animators[uuid];
			if (!animator.keyframes.length && !animator.rotation_global) continue;
			if (animator instanceof EffectAnimator) {

				animator.sound.sort((kf1, kf2) => (kf1.time - kf2.time)).forEach(kf => {
					if (!ani_tag.sound_effects) ani_tag.sound_effects = {};
					ani_tag.sound_effects[kf.getTimecodeString()] = kf.compileBedrockKeyframe();
				})
				animator.particle.sort((kf1, kf2) => (kf1.time - kf2.time)).forEach(kf => {
					if (!ani_tag.particle_effects) ani_tag.particle_effects = {};
					ani_tag.particle_effects[kf.getTimecodeString()] = kf.compileBedrockKeyframe();
				})
				animator.timeline.sort((kf1, kf2) => (kf1.time - kf2.time)).forEach(kf => {
					if (!ani_tag.timeline) ani_tag.timeline = {};
					ani_tag.timeline[kf.getTimecodeString()] = kf.compileBedrockKeyframe()
				})

			} else if (animator.type == 'bone') {

				var group = animator.getGroup(); 
				var bone_tag = ani_tag.bones[group ? group.name : animator.name] = {};
				if (animator.rotation_global) {
					bone_tag.relative_to = {rotation: 'entity'};
					bone_tag.rotation = [0, 0, 0.01];
				}
				for (var channel in Animator.possible_channels) {
					if (!animator[channel]?.length) continue;

					// Saving Keyframes
					bone_tag[channel] = {};
					let sorted_keyframes = animator[channel].slice().sort((a, b) => a.time - b.time);

					sorted_keyframes.forEach((kf, i) => {
						let timecode = kf.getTimecodeString();
						bone_tag[channel][timecode] = kf.compileBedrockKeyframe()
						if (animator.rotation_global && kf.channel == 'rotation' && bone_tag[kf.channel][timecode] instanceof Array && bone_tag[kf.channel][timecode].allEqual(0)) {
							bone_tag[kf.channel][timecode][2] = 0.01;
						}
						// Bake bezier keyframe curve
						let next_keyframe = sorted_keyframes[i+1];
						if (next_keyframe && (kf.interpolation === 'bezier' || next_keyframe.interpolation === 'bezier')) {
							let interval = 1 / animation.snapping;
							let interpolated_values = {};
							for (let time = kf.time + interval; time < next_keyframe.time + (interval/2); time += interval) {
								let itimecode = trimFloatNumber(Timeline.snapTime(time, animation)).toString();
								if (!itimecode.includes('.')) itimecode += '.0';
								let lerp = Math.getLerp(kf.time, next_keyframe.time, time)
								let value = [0, 1, 2].map(axis => {
									return kf.getBezierLerp(kf, next_keyframe, getAxisLetter(axis), lerp);
								})
								if (channel == 'position' || channel == 'rotation') value[0] = -value[0];
								if (channel == 'rotation') value[1] = -value[1];
								interpolated_values[itimecode] = value;
							}
							// Optimize data
							let itimecodes = Object.keys(interpolated_values);
							let skipped = 0;
							let threshold = channel == 'scale' ? 0.005 : (channel == 'rotation' ? 0.1 : 0.01);
							itimecodes.forEach((itimecode, ti) => {
								let value = interpolated_values[itimecode]
								let last = interpolated_values[itimecodes[ti-1]] || bone_tag[channel][timecode];
								let next = interpolated_values[itimecodes[ti+1]];
								if (!next) return;
								let max_diff = 0;
								let all_axes_irrelevant = value.allAre((val, axis) => {
									let diff = Math.abs((last[axis] - val) - (val - next[axis]));
									max_diff = Math.max(max_diff, diff);
									return diff < threshold
								})
								if (all_axes_irrelevant && skipped < Math.clamp(2 * (threshold / max_diff), 0, 12)) {
									skipped++;
								} else {
									bone_tag[channel][itimecode] = value;
									skipped = 0;
								}
							})
						}
					})

					// Compressing keyframes
					let timecodes = Object.keys(bone_tag[channel]);
					if (timecodes.length === 1 && animator[channel][0].data_points.length == 1 && animator[channel][0].interpolation != 'catmullrom') {
						bone_tag[channel] = bone_tag[channel][timecodes[0]]
						if (channel == 'scale' &&
							bone_tag[channel] instanceof Array &&
							bone_tag[channel].allEqual(bone_tag[channel][0])
						) {
							bone_tag[channel] = bone_tag[channel][0];
						}
					} 
				}
			}
		}
		// Inverse Kinematics
		let ik_samples = animation.sampleIK();
		let sample_rate = settings.animation_sample_rate.value;
		for (let uuid in ik_samples) {
			let group = OutlinerNode.uuids[uuid];
			var bone_tag = ani_tag.bones[group ? group.name : animator.name] = {};
			bone_tag.rotation = {};
			ik_samples[uuid].forEach((rotation, i) => {
				let timecode = trimFloatNumber(Timeline.snapTime(i / sample_rate, animation)).toString();
				if (!timecode.includes('.')) {
					timecode += '.0';
				}
				rotation.array[0] = invertMolang(rotation.array[0]);
				rotation.array[1] = invertMolang(rotation.array[1]);
				bone_tag.rotation[timecode] = rotation.array;
			})
		}
		if (Object.keys(ani_tag.bones).length == 0) {
			delete ani_tag.bones;
		}
		Blockbench.dispatchEvent('compile_bedrock_animation', {animation: animation, json: ani_tag});
		return ani_tag;
	},
	compileFile(animations) {
		var compiled_animations = {}
		animations.forEach((a) => {
			let ani_tag = this.compileAnimation(a);
			compiled_animations[a.name] = ani_tag;
		})
		return {
			format_version: '1.8.0',
			animations: compiled_animations
		}
	},
	saveAnimation(animation) {
		if (isApp && !animation.path) {
			Blockbench.export({
				resource_id: 'animation',
				type: 'JSON Animation',
				extensions: ['json'],
				name: (Project.geometry_name||'model')+'.animation',
				startpath: animation.path,
				custom_writer: (content, path) => {
					if (!path) return
					animation.path = path;
					animation.save();
				}
			})
			return;
		}
		let content = {
			format_version: '1.8.0',
			animations: {
				[animation.name]: this.compileAnimation(animation)
			}
		}
		if (isApp && animation.path) {
			if (fs.existsSync(animation.path)) {
				//overwrite path
				let data;
				try {
					data = fs.readFileSync(animation.path, 'utf-8');
					data = autoParseJSON(data, false);
					if (typeof data.animations !== 'object') {
						throw 'Incompatible format'
					}

				} catch (err) {
					data = null;
					var answer = dialog.showMessageBoxSync(currentwindow, {
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
				if (data) {
					let animation_json = content.animations[animation.name];
					content = data;
					if (animation.saved_name && animation.saved_name !== animation.name) delete content.animations[animation.saved_name];
					content.animations[animation.name] = animation_json;

					// Sort
					let file_keys = Object.keys(content.animations);
					let anim_keys = Animation.all.filter(anim => anim.path == animation.path).map(anim => anim.name);
					let changes = false;
					let index = 0;

					anim_keys.forEach(key => {
						let key_index = file_keys.indexOf(key);
						if (key_index == -1) {
							//Skip
						} else if (key_index < index) {
							file_keys.splice(key_index, 1);
							file_keys.splice(index, 0, key);
							changes = true;

						} else {
							index = key_index;
						}
					})
					if (changes) {
						let sorted_animations = {};
						file_keys.forEach(key => {
							sorted_animations[key] = content.animations[key];
						})
						content.animations = sorted_animations;
					}
				}
			}
			// Write
			Blockbench.writeFile(animation.path, {content: compileJSON(content)}, (real_path) => {
				animation.saved = true;
				animation.saved_name = animation.name;
				animation.path = real_path;
			});

		} else {
			// Web Download
			Blockbench.export({
				resource_id: 'animation',
				type: 'JSON Animation',
				extensions: ['json'],
				name: (Project.geometry_name||'model')+'.animation',
				startpath: animation.path,
				content: compileJSON(content),
			}, (real_path) => {
				animation.path == real_path;
				animation.saved = true;
			})
		}
	},
	exportFile(path, save_as) {
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

		let animations = Animator.animations.filter(a => a.path == filter_path);
		if (!save_as && isApp && path && fs.existsSync(path)) {
			animations.forEach(function(a) {
				if (a.path == filter_path && !a.saved) {
					a.save();
				}
			})
		} else {
			let content = this.compileFile(animations);
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
				animations.forEach(function(a) {
					a.path = new_path;
					a.saved = true;
				})
			})
		}
	},
	deleteAnimationFromFile(animation) {
		let content = fs.readFileSync(animation.path, 'utf-8');
		let json = autoParseJSON(content, false);
		if (json && json.animations && json.animations[animation.name]) {
			delete json.animations[animation.name];
			Blockbench.writeFile(animation.path, {content: compileJSON(json)});
			Undo.history.last().before.animations[animation.uuid].saved = false
		}
	}
})