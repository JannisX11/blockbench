class AnimationItem {
	constructor() {}
	getShortName() {
		if (typeof Project.BedrockEntityManager?.client_entity?.description?.animations == 'object') {
			let {animations} = Project.BedrockEntityManager.client_entity.description;
			for (let key in animations) {
				if (animations[key] == this.name) return key;
			}
		}
		return this.name.split(/\./).last();
	}
}
class Animation extends AnimationItem {
	constructor(data) {
		super(data);
		this.name = '';
		this.uuid = guid()
		this.loop = 'once';
		this.playing = false;
		this.override = false;
		this.selected = false;
		this.length = 0;
		this.snapping = Math.clamp(settings.animation_snap.value, 10, 500);
		this.animators = {};
		this.markers = [];
		this.type = 'animation';
		for (var key in Animation.properties) {
			Animation.properties[key].reset(this);
		}
		if (typeof data === 'object') {
			this.extend(data);
			if (isApp && Format.animation_files && data.saved_name) {
				this.saved_name = data.saved_name;
			}
		}
	}
	extend(data) {
		for (var key in Animation.properties) {
			Animation.properties[key].merge(this, data)
		}
		Merge.string(this, data, 'name')
		Merge.string(this, data, 'loop', val => ['once', 'loop', 'hold'].includes(val))
		Merge.boolean(this, data, 'override')
		Merge.number(this, data, 'length')
		Merge.number(this, data, 'snapping')
		this.snapping = Math.clamp(this.snapping, 10, 500);
		if (typeof data.length == 'number') {
			this.setLength(this.length)
		}
		if (data.bones && !data.animators) {
			data.animators = data.bones;
		}
		if (data.animators instanceof Object) {
			for (var key in data.animators) {
				let animator_blueprint = data.animators[key];
				// Update to 3.7
				if (animator_blueprint instanceof Array) {
					animator_blueprint = {
						keyframes: animator_blueprint
					}
				}
				var kfs = animator_blueprint.keyframes;
				var animator;
				if (!this.animators[key]) {
					if (key == 'effects') {
						// Effects
						animator = this.animators[key] = new EffectAnimator(this);
					} else if (animator_blueprint.type && animator_blueprint.type !== 'bone') {
						// Element
						let uuid = isUUID(key) && key;
						let element;
						if (!uuid) {
							let lowercase_name = key.toLowerCase();
							element = Outliner.elements.find(element2 => element2.constructor.animator && element2.name.toLowerCase() == lowercase_name)
							uuid = element ? element.uuid : guid();
						}
						if (!element) element = Outliner.elements.find(element => element.constructor.animator && element.uuid == uuid);
						if (element) {
							animator = this.animators[uuid] = new element.constructor.animator(uuid, this, animator_blueprint.name);
						}
					} else {
						// Bone
						let uuid = isUUID(key) && key;
						if (!uuid) {
							let lowercase_bone_name = key.toLowerCase();
							let group_match = Group.all.find(group => group.name.toLowerCase() == lowercase_bone_name)
							uuid = group_match ? group_match.uuid : guid();
						}
						animator = this.animators[uuid] = new BoneAnimator(uuid, this, animator_blueprint.name);
						if (animator_blueprint.rotation_global) animator.rotation_global = true;
					}
				} else {
					animator = this.animators[key];
					for (let channel in animator.channels) {
						animator[channel].empty()
					}
				}
				if (kfs && animator) {
					kfs.forEach(kf_data => {
						animator.addKeyframe(kf_data, kf_data.uuid);
					})
				}

			}
		}
		if (data.markers instanceof Array) {
			data.markers.forEach(marker => {
				if (!this.markers.find(m2 => Math.epsilon(m2.time, marker.time, 0.001))) {
					this.markers.push(new TimelineMarker(marker));
				}
			})
		}
		return this;
	}
	getUndoCopy(options = 0, save) {
		var copy = {
			uuid: this.uuid,
			name: this.name,
			loop: this.loop,
			override: this.override,
			length: this.length,
			snapping: this.snapping,
			selected: this.selected,
		}
		for (var key in Animation.properties) {
			Animation.properties[key].copy(this, copy)
		}
		if (this.markers.length) {
			copy.markers = this.markers.map(marker => marker.getUndoCopy());
		}
		if (options.absolute_paths == false) delete copy.path;
		if (Object.keys(this.animators).length) {
			copy.animators = {}
			for (var uuid in this.animators) {
				let ba = this.animators[uuid]
				let kfs = ba.keyframes
				if ((kfs && kfs.length) || ba.rotation_global || !save) {
					let ba_copy = copy.animators[uuid] = {
						name: ba.name,
						type: ba.type,
						rotation_global: ba.rotation_global ? true : undefined,
						keyframes: []
					}
					kfs.forEach(kf => {
						ba_copy.keyframes.push(kf.getUndoCopy(true, {absolute_paths: options.absolute_paths}));
					})
				}
			}
		}
		return copy;
	}
	compileBedrockAnimation() {
		let ani_tag = {};

		if (this.loop == 'hold') {
			ani_tag.loop = 'hold_on_last_frame';
		} else if (this.loop == 'loop' || this.getMaxLength() == 0) {
			ani_tag.loop = true;
		}

		if (this.length) ani_tag.animation_length = Math.roundTo(this.length, 4);
		if (this.override) ani_tag.override_previous_animation = true;
		if (this.anim_time_update) ani_tag.anim_time_update = exportMolang(this.anim_time_update);
		if (this.blend_weight) ani_tag.blend_weight = exportMolang(this.blend_weight);
		if (this.start_delay) ani_tag.start_delay = exportMolang(this.start_delay);
		if (this.loop_delay && ani_tag.loop) ani_tag.loop_delay = exportMolang(this.loop_delay);
		ani_tag.bones = {};

		for (var uuid in this.animators) {
			var animator = this.animators[uuid];
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
				var channels = {};
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
							let interval = 1 / this.snapping;
							let interpolated_values = {};
							for (let time = kf.time + interval; time < next_keyframe.time + (interval/2); time += interval) {
								let itimecode = trimFloatNumber(Timeline.snapTime(time, this)).toString();
								if (!itimecode.includes('.')) itimecode += '.0';
								let lerp = Math.getLerp(kf.time, next_keyframe.time, time)
								let value = [0, 1, 2].map(axis => {
									return kf.getBezierLerp(kf, next_keyframe, getAxisLetter(axis), lerp);
								})
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
		let ik_samples = this.sampleIK();
		let sample_rate = settings.animation_sample_rate.value;
		for (let uuid in ik_samples) {
			let group = OutlinerNode.uuids[uuid];
			var bone_tag = ani_tag.bones[group ? group.name : animator.name] = {};
			bone_tag.rotation = {};
			ik_samples[uuid].forEach((rotation, i) => {
				let timecode = trimFloatNumber(Timeline.snapTime(i / sample_rate, this)).toString();
				if (!timecode.includes('.')) {
					timecode += '.0';
				}
				bone_tag.rotation[timecode] = rotation.array;
			})
		}
		if (Object.keys(ani_tag.bones).length == 0) {
			delete ani_tag.bones;
		}
		Blockbench.dispatchEvent('compile_bedrock_animation', {animation: this, json: ani_tag});
		return ani_tag;
	}
	sampleIK(sample_rate = settings.animation_sample_rate.value) {
		let interval = 1 / Math.clamp(sample_rate, 1, 144);
		let last_time = Timeline.time;
		let samples = {};

		if (!NullObject.all.find(null_object => null_object.ik_target && this.getBoneAnimator(null_object).position.length)) return samples;

		Timeline.time = 0;
		while (Timeline.time <= this.length && Timeline.time <= 200) {
			// Bones
			Animator.showDefaultPose(true);
			
			Group.all.forEach(node => {
				Animator.resetLastValues();
				Animator.animations.forEach(animation => {
					let multiplier = animation.blend_weight ? Math.clamp(Animator.MolangParser.parse(animation.blend_weight), 0, Infinity) : 1;
					if (animation.playing) {
						animation.getBoneAnimator(node).displayFrame(multiplier);
					}
				})
			})
			Outliner.elements.forEach(node => {
				if (!node.constructor.animator) return;
				Animator.resetLastValues();
				let multiplier = this.blend_weight ? Math.clamp(Animator.MolangParser.parse(this.blend_weight), 0, Infinity) : 1;
				let animator = this.getBoneAnimator(node);
				animator.displayPosition(animator.interpolate('position'), multiplier);
				let bone_frame_rotation = animator.displayIK(true);
				for (let uuid in bone_frame_rotation) {
					if (!samples[uuid]) samples[uuid] = [];
					samples[uuid].push(bone_frame_rotation[uuid]);
				}
			})
			Animator.resetLastValues();
			Timeline.time += interval;
		}

		Timeline.time = last_time;
		if (Modes.animate && this.selected) {
			Animator.preview();
		} else {
			Canvas.updateAllBones()
		}
		return samples;
	}
	save() {
		if (isApp && !this.path) {
			Blockbench.export({
				resource_id: 'animation',
				type: 'JSON Animation',
				extensions: ['json'],
				name: (Project.geometry_name||'model')+'.animation',
				startpath: this.path,
				custom_writer: (content, path) => {
					if (!path) return
					this.path = path;
					this.save();
				}
			})
			return;
		}
		let content = {
			format_version: '1.8.0',
			animations: {
				[this.name]: this.compileBedrockAnimation()
			}
		}
		if (isApp && this.path) {
			if (fs.existsSync(this.path)) {
				//overwrite path
				let data;
				try {
					data = fs.readFileSync(this.path, 'utf-8');
					data = autoParseJSON(data, false);
					if (typeof data.animations !== 'object') {
						throw 'Incompatible format'
					}

				} catch (err) {
					data = null;
					var answer = electron.dialog.showMessageBoxSync(currentwindow, {
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
					let animation = content.animations[this.name];
					content = data;
					if (this.saved_name && this.saved_name !== this.name) delete content.animations[this.saved_name];
					content.animations[this.name] = animation;

					// Sort
					let file_keys = Object.keys(content.animations);
					let anim_keys = Animation.all.filter(anim => anim.path == this.path).map(anim => anim.name);
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
			Blockbench.writeFile(this.path, {content: compileJSON(content)}, (real_path) => {
				this.saved = true;
				this.saved_name = this.name;
				this.path = real_path;
			});

		} else {
			// Web Download
			Blockbench.export({
				resource_id: 'animation',
				type: 'JSON Animation',
				extensions: ['json'],
				name: (Project.geometry_name||'model')+'.animation',
				startpath: this.path,
				content: compileJSON(content),
			}, (real_path) => {
				this.path == real_path;
				this.saved = true;
			})
		}
		return this;
	}
	select() {
		let previous_animation = Animation.selected;
		if (this == Animation.selected) return;
		AnimationItem.all.forEach((a) => {
			a.selected = false;
			if (a.playing == true) a.playing = false;
		})
		let animator_keys = previous_animation && Object.keys(previous_animation.animators);
		let selected_animator_key;
		let timeline_animator_keys = previous_animation && Timeline.animators.map(a => {
			let key = animator_keys.find(key => previous_animation.animators[key] == a);
			if (a.selected) selected_animator_key = key;
			return key;
		});
		Timeline.clear();
		Timeline.vue._data.markers = this.markers;
		Timeline.vue._data.animation_length = this.length;
		Timeline.setTime(Timeline.time % this.length);
		Animator.MolangParser.resetVariables();
		this.selected = true;
		if (this.playing == false) this.playing = true;
		AnimationItem.selected = this;
		unselectAllElements();
		BarItems.slider_animation_length.update();

		Group.all.forEach(group => {
			this.getBoneAnimator(group);
		})
		Outliner.elements.forEach(element => {
			if (!element.constructor.animator) return;
			this.getBoneAnimator(element);
		})

		if (timeline_animator_keys) {
			timeline_animator_keys.forEachReverse(key => {
				let animator = this.animators[key];
				if (animator) {
					animator.addToTimeline();
					if (selected_animator_key == key) animator.select(false);
				}
			});
		}
		if (Modes.animate) {
			Animator.preview();
			updateInterface();
		}
		Blockbench.dispatchEvent('select_animation', {animation: this})
		return this;
	}
	clickSelect() {
		Undo.initSelection();
		Prop.active_panel = 'animations';
		this.select();
		Undo.finishSelection('Select animation')
	}
	setLength(len = this.length) {
		this.length = 0;
		this.length = limitNumber(len, this.getMaxLength(), 1e4);
		if (Animation.selected == this) {
			Timeline.vue._data.animation_length = this.length;
			BarItems.slider_animation_length.update()
		}
	}
	get time() {
		if (!this.length || this.loop == 'once') {
			return Timeline.time;
		} else if (this.loop === 'loop') {
			return ((Timeline.time - 0.001) % this.length) + 0.001;
		} else if (this.loop === 'hold') {
			return Math.min(Timeline.time, this.length);
		}
	}
	createUniqueName(arr) {
		var scope = this;
		var others = Animator.animations.slice();
		if (arr && arr.length) {
			arr.forEach(g => {
				others.safePush(g)
			})
		}
		others = others.filter(a => a.path == this.path);
		var name = this.name.replace(/\d+$/, '');
		function check(n) {
			for (var i = 0; i < others.length; i++) {
				if (others[i] !== scope && others[i].name == n) return false;
			}
			return true;
		}
		if (check(this.name)) {
			return this.name;
		}
		for (var num = 2; num < 8e2; num++) {
			if (check(name+num)) {
				scope.name = name+num;
				return scope.name;
			}
		}
		return false;
	}
	rename() {
		var scope = this;
		Blockbench.textPrompt('generic.rename', this.name, function(name) {
			if (name && name !== scope.name) {
				Undo.initEdit({animations: [scope]});
				scope.name = name;
				scope.createUniqueName();
				Undo.finishEdit('Rename animation');
			}
		})
		return this;
	}
	togglePlayingState(state) {
		if (!this.selected) {
			if (state !== undefined) {
				this.playing = state;
			} else if (this.playing == false) {
				this.playing = true;
			} else if (this.playing == true) {
				this.playing = 'locked';
			} else {
				this.playing = false;
			}
			Animator.preview();
		} else if (this.playing == 'locked') {
			this.playing = true;
		} else {
			Timeline.start();
		}
		return this.playing;
	}
	showContextMenu(event) {
		this.select();
		this.menu.open(event, this);
		return this;
	}
	getBoneAnimator(group) {
		if (!group && Group.first_selected) {
			group = Group.first_selected;
		} else if (!group && (Outliner.selected[0] && Outliner.selected[0].constructor.animator)) {
			group = Outliner.selected[0];
		} else if (!group) {
			return;
		}
		var uuid = group.uuid
		if (!this.animators[uuid]) {
			let match;
			for (let uuid2 in this.animators) {
				let animator = this.animators[uuid2];
				if (
					animator instanceof BoneAnimator &&
					animator._name && animator._name.toLowerCase() === group.name.toLowerCase() &&
					!animator.group
				) {
					match = animator;
					match.uuid = group.uuid;
					this.removeAnimator(uuid2);
					break;
				}
			}
			this.animators[uuid] = match || new group.constructor.animator(uuid, this);
		}
		return this.animators[uuid];
	}
	removeAnimator(id) {
		Timeline.animators.remove(this.animators[id]);
		if (Timeline.selected_animator == this.animators[id]) {
			Timeline.selected_animator = null;
		}
		delete this.animators[id];
		return this;
	}
	add(undo) {
		if (undo) {
			Undo.initEdit({animations: []})
		}
		if (!Animator.animations.includes(this)) {
			Animator.animations.push(this)
		}
		this.createUniqueName();
		if (undo) {
			this.select()
			Undo.finishEdit('Add animation', {animations: [this]})
		}
		return this;
	}
	remove(undo, remove_from_file = true) {
		if (undo) {
			Undo.initEdit({animations: [this]})
		}
		Animator.animations.remove(this)
		if (undo) {
			Undo.finishEdit('Remove animation', {animations: []})

			if (isApp && Format.animation_files && remove_from_file && this.path && fs.existsSync(this.path)) {
				Blockbench.showMessageBox({
					translateKey: 'delete_animation',
					icon: 'movie',
					buttons: ['generic.delete', 'dialog.cancel'],
					confirm: 0,
					cancel: 1,
				}, (result) => {
					if (result == 0) {
						let content = fs.readFileSync(this.path, 'utf-8');
						let json = autoParseJSON(content, false);
						if (json && json.animations && json.animations[this.name]) {
							delete json.animations[this.name];
							Blockbench.writeFile(this.path, {content: compileJSON(json)});
							Undo.history.last().before.animations[this.uuid].saved = false
						}
					}
				})
			}
		}
		Blockbench.dispatchEvent('remove_animation', {animations: [this]})
		if (Animation.selected === this) {
			Animation.selected = null;
			Timeline.clear();
			Animator.preview();
		}
		return this;
	}
	getMaxLength() {
		var len = this.length||0

		for (var uuid in this.animators) {
			var bone = this.animators[uuid]
			var keyframes = bone.keyframes;
			if (keyframes.find(kf => kf.interpolation == 'catmullrom')) {
				keyframes = keyframes.slice().sort((a, b) => a.time - b.time);
			}
			keyframes.forEach((kf, i) => {
				if (kf.interpolation == 'catmullrom' && i == keyframes.length-1) return;
				len = Math.max(len, keyframes[i].time);
			})
		}
		return len
	}
	setLoop(value, undo) {
		if ((value == 'once' || value == 'loop' || value == 'hold') && value !== this.loop) {
			if (undo) Undo.initEdit({animations: [this]})
			this.loop = value;
			if (undo) Undo.finishEdit('Change animation loop mode')
		}
	}
	calculateSnappingFromKeyframes() {
		let timecodes = [];
		for (var key in this.animators) {
			let animator = this.animators[key];
			animator.keyframes.forEach(kf => {
				timecodes.safePush(kf.time);
			})
		}
		if (timecodes.length > 1) {
			for (var i = 10; i <= 100; i++) {
				let works = true;
				for (var timecode of timecodes) {
					let factor = (timecode * i) % 1;
					if (factor > 0.01 && factor < 0.99) {
						works = false;
						break;
					}
				}
				if (works) {
					this.snapping = i;
					return this.snapping;
				}
			}
		}
	}
	propertiesDialog() {
		let dialog = new Dialog({
			id: 'animation_properties',
			title: this.name,
			width: 660,
			resizable: 'x',
			part_order: ['form', 'component'],
			form: {
				name: {label: 'generic.name', value: this.name},
				path: {
					label: 'menu.animation.file',
					value: this.path,
					type: 'file',
					extensions: ['json'],
					filetype: 'JSON Animation',
					condition: Animation.properties.path.condition
				},
				loop: {
					label: 'menu.animation.loop',
					type: 'inline_select',
					value: this.loop,
					options: {
						once: 'menu.animation.loop.once',
						hold: 'menu.animation.loop.hold',
						loop: 'menu.animation.loop.loop',
					},
				},
				override: {label: 'menu.animation.override', type: 'checkbox', value: this.override},
				snapping: {label: 'menu.animation.snapping', type: 'number', value: this.snapping, step: 1, min: 10, max: 500},
			},
			component: {
				components: {VuePrismEditor},
				data: {
					anim_time_update: this.anim_time_update,
					blend_weight: this.blend_weight,
					start_delay: this.start_delay,
					loop_delay: this.loop_delay,
					loop_mode: this.loop
				},
				methods: {
					autocomplete(text, position) {
						let test = MolangAutocomplete.AnimationContext.autocomplete(text, position);
						return test;
					}
				},
				template: 
					`<div id="animation_properties_vue">
						<div class="dialog_bar form_bar">
							<label class="name_space_left">${tl('menu.animation.anim_time_update')}:</label>
							<vue-prism-editor class="molang_input" v-model="anim_time_update" language="molang" :autocomplete="autocomplete" :line-numbers="false" />
						</div>
						<div class="dialog_bar form_bar">
							<label class="name_space_left">${tl('menu.animation.blend_weight')}:</label>
							<vue-prism-editor class="molang_input" v-model="blend_weight" language="molang" :autocomplete="autocomplete" :line-numbers="false" />
						</div>
						<div class="dialog_bar form_bar">
							<label class="name_space_left">${tl('menu.animation.start_delay')}:</label>
							<vue-prism-editor class="molang_input" v-model="start_delay" language="molang" :autocomplete="autocomplete" :line-numbers="false" />
						</div>
						<div class="dialog_bar form_bar" v-if="loop_mode == 'loop'">
							<label class="name_space_left">${tl('menu.animation.loop_delay')}:</label>
							<vue-prism-editor class="molang_input" v-model="loop_delay" language="molang" :autocomplete="autocomplete" :line-numbers="false" />
						</div>
					</div>`
			},
			onFormChange(form) {
				this.component.data.loop_mode = form.loop;
			},
			onConfirm: form_data => {
				dialog.hide().delete();
				if (
					form_data.loop != this.loop
					|| form_data.name != this.name
					|| (isApp && form_data.path != this.path)
					|| form_data.loop != this.loop
					|| form_data.override != this.override
					|| form_data.snapping != this.snapping
					|| dialog.component.data.anim_time_update != this.anim_time_update
					|| dialog.component.data.blend_weight != this.blend_weight
					|| dialog.component.data.start_delay != this.start_delay
					|| dialog.component.data.loop_delay != this.loop_delay
				) {
					Undo.initEdit({animations: [this]});

					this.extend({
						loop: form_data.loop,
						name: form_data.name,
						override: form_data.override,
						snapping: form_data.snapping,
						anim_time_update: dialog.component.data.anim_time_update.trim().replace(/\n/g, ''),
						blend_weight: dialog.component.data.blend_weight.trim().replace(/\n/g, ''),
						start_delay: dialog.component.data.start_delay.trim().replace(/\n/g, ''),
						loop_delay: dialog.component.data.loop_delay.trim().replace(/\n/g, ''),
					})
					if (isApp) this.path = form_data.path;
					this.createUniqueName();

					Blockbench.dispatchEvent('edit_animation_properties', {animation: this})

					Undo.finishEdit('Edit animation properties');
				}
			},
			onCancel() {
				dialog.hide().delete();
			}
		})
		dialog.show();
	}
}
	Object.defineProperty(Animation, 'all', {
		get() {
			return Project.animations || [];
		},
		set(arr) {
			Project.animations.replace(arr);
		}
	})
	Animation.selected = null;
	Animation.prototype.menu = new Menu([
		'copy',
		'paste',
		'duplicate',
		new MenuSeparator('settings'),
		{name: 'menu.animation.loop', icon: 'loop', children: [
			{name: 'menu.animation.loop.once', icon: animation => (animation.loop == 'once' ? 'far.fa-dot-circle' : 'far.fa-circle'), click(animation) {animation.setLoop('once', true)}},
			{name: 'menu.animation.loop.hold', icon: animation => (animation.loop == 'hold' ? 'far.fa-dot-circle' : 'far.fa-circle'), click(animation) {animation.setLoop('hold', true)}},
			{name: 'menu.animation.loop.loop', icon: animation => (animation.loop == 'loop' ? 'far.fa-dot-circle' : 'far.fa-circle'), click(animation) {animation.setLoop('loop', true)}},
		]},
		'change_animation_speed',
		new MenuSeparator('manage'),
		{
			name: 'menu.animation.save',
			id: 'save',
			icon: 'save',
			condition: () => Format.animation_files,
			click(animation) {
				animation.save();
			}
		},
		{
			name: 'menu.animation.open_location',
			id: 'open_location',
			icon: 'folder',
			condition(animation) {return isApp && Format.animation_files && animation.path && fs.existsSync(animation.path)},
			click(animation) {
				showItemInFolder(animation.path);
			}
		},
		{
			name: 'generic.edit_externally',
			id: 'edit_externally',
			icon: 'edit_document',
			condition(animation) {return isApp && Format.animation_files && animation.path && fs.existsSync(animation.path)},
			click(animation) {
				ipcRenderer.send('open-in-default-app', animation.path);
			}
		},
		'rename',
		{
			id: 'reload',
			name: 'menu.animation.reload',
			icon: 'refresh',
			condition: (animation) => Format.animation_files && isApp && animation.saved,
			click(animation) {
				Blockbench.read([animation.path], {}, ([file]) => {
					Undo.initEdit({animations: [animation]})
					let anim_index = Animation.all.indexOf(animation);
					animation.remove(false, false);
					let [new_animation] = Animator.loadFile(file, [animation.name]);
					Animation.all.remove(new_animation);
					Animation.all.splice(anim_index, 0, new_animation);
					Undo.finishEdit('Reload animation', {animations: [new_animation]})
				})
			}
		},
		{
			id: 'unload',
			name: 'menu.animation.unload',
			icon: 'remove',
			condition: () => Format.animation_files,
			click(animation) {
				Undo.initEdit({animations: [animation]})
				animation.remove(false, false);
				Undo.finishEdit('Unload animation', {animations: []})
			}
		},
		'delete',
		new MenuSeparator('properties'),
		{name: 'menu.animation.properties', icon: 'list', click(animation) {
			animation.propertiesDialog();
		}}
	])
	Animation.prototype.file_menu = new Menu([
		{name: 'menu.animation_file.unload', icon: 'remove', click(id) {
			let animations_to_remove = Animation.all.filter(anim => anim.path == id && anim.saved);
			let controllers_to_remove = AnimationController.all.filter(anim => anim.path == id && anim.saved);
			if (!animations_to_remove.length && !controllers_to_remove.length) return;

			Undo.initEdit({animations: animations_to_remove, animation_controllers: controllers_to_remove});
			animations_to_remove.forEach(animation => {
				animation.remove(false, false);
			})
			controllers_to_remove.forEach(animation => {
				animation.remove(false, false);
			})
			Undo.finishEdit('Unload animation file', {animations: [], animation_controllers: []});
		}},
		{name: 'menu.animation.reload', icon: 'refresh', click(id) {
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
				let new_animations = Animator.loadFile(file, names);
				let selected = new_animations.find(item => item.name == selected_name);
				if (selected) selected.select();
				if (new_animations[0] instanceof AnimationController) {
					Undo.finishEdit('Reload animation controller file', {animation_controllers: new_animations, animations: []});
				} else {
					Undo.finishEdit('Reload animation file', {animations: new_animations, animation_controllers: []});
				}
			})
		}},
		{name: 'menu.animation_file.import_remaining', icon: 'playlist_add', click(id) {
			Blockbench.read([id], {}, files => {
				Animator.importFile(files[0]);
			})
		}}
	])
	new Property(Animation, 'boolean', 'saved', {default: true, condition: () => Format.animation_files})
	new Property(Animation, 'string', 'path', {condition: () => isApp && Format.animation_files})
	new Property(Animation, 'molang', 'anim_time_update', {default: ''});
	new Property(Animation, 'molang', 'blend_weight', {default: ''});
	new Property(Animation, 'molang', 'start_delay', {default: ''});
	new Property(Animation, 'molang', 'loop_delay', {default: ''});

Blockbench.on('finish_edit', event => {
	if (!Format.animation_files) return;
	if (event.aspects.animations && event.aspects.animations.length) {
		event.aspects.animations.forEach(animation => {
			if (Undo.current_save && Undo.current_save.aspects.animations instanceof Array && Undo.current_save.aspects.animations.includes(animation)) {
				animation.saved = false;
			}
		})
	}
	if (event.aspects.keyframes && event.aspects.keyframes instanceof Array && Animation.selected) {
		Animation.selected.saved = false;
	}
})


Clipbench.setAnimation = function() {
	if (!Animation.selected && !AnimationController.selected) return;
	Clipbench.animation = AnimationItem.selected.getUndoCopy();

	if (isApp) {
		clipboard.writeHTML(JSON.stringify({type: 'animation', content: Clipbench.animation}));
	}
}
Clipbench.pasteAnimation = function() {
	if (isApp) {
		var raw = clipboard.readHTML()
		try {
			var data = JSON.parse(raw)
			if (data.type === 'animation' && data.content) {
				Clipbench.animation = data.content
			}
		} catch (err) {}
	}
	if (!Clipbench.animation || !Format.animation_mode) return;

	if (Clipbench.animation.type == 'animation_controller') {
		let animation_controllers = [];
		Undo.initEdit({animation_controllers});
		let animation_controller = new AnimationController(Clipbench.animation).add(false);
		animation_controller.createUniqueName();
		animation_controller.select().propertiesDialog();
		animation_controllers.push(animation_controller);
		Undo.finishEdit('Paste animation controller')

	} else {
		let animations = [];
		Undo.initEdit({animations});
		let animation = new Animation(Clipbench.animation).add(false);
		animation.createUniqueName();
		animation.select().propertiesDialog();
		animations.push(animation);
		Undo.finishEdit('Paste animation')
	}
}

SharedActions.add('rename', {
	condition: () => Prop.active_panel == 'animations' && AnimationItem.selected,
	run() {
		AnimationItem.selected.rename();
	}
})
SharedActions.add('delete', {
	condition: () => Prop.active_panel == 'animations' && AnimationItem.selected,
	run() {
		AnimationItem.selected.remove(true);
	}
})
SharedActions.add('duplicate', {
	condition: () => Prop.active_panel == 'animations' && Animation.selected,
	run() {
		let copy = Animation.selected.getUndoCopy();
		let animation = new Animation(copy);
		Property.resetUniqueValues(Animation, animation);
		animation.createUniqueName();
		Animator.animations.splice(Animator.animations.indexOf(Animation.selected)+1, 0, animation)
		animation.saved = false;
		animation.add(true).select();
	}
})

Blockbench.addDragHandler('animation', {
	extensions: ['animation.json', 'animation_controllers.json'],
	readtype: 'text',
	condition: {modes: ['animate']},
}, async function(files) {
	for (let file of files) {
		await Animator.importFile(file);
	}
})

new ValidatorCheck('unused_animators', {
	condition: { features: ['animation_mode'], selected: {animation: true} },
	update_triggers: ['select_animation'],
	run() {
		let animation = Animation.selected;
		if (!animation) return;
		let animators = [];
		for (let id in animation.animators) {
			let animator = animation.animators[id];
			if (animator instanceof BoneAnimator && animator.keyframes.length) {
				if (!animator.getGroup()) {
					animators.push(animator);
				}
			}
		}
		if (animators.length) {
			let buttons = [
				{
					name: 'Retarget Animators',
					icon: 'rebase',
					click() {
						Validator.dialog.close()
						BarItems.retarget_animators.click();
					},
				},
				{
					name: 'Reveal in Timeline',
					icon: 'fa-sort-amount-up',
					click() {
						for (let animator of animators) {
							animator.addToTimeline();
						}
						Validator.dialog.close();
					},
				}
			];
			this.warn({
				message: `The animation "${animation.name}" contains ${animators.length} animated nodes that do not exist in the current model.`,
				buttons,
			})
		}
	}
})

BARS.defineActions(function() {
	new NumSlider('slider_animation_length', {
		category: 'animation',
		condition: () => Animator.open && Animation.selected,
		getInterval(event) {
			if ((event && event.shiftKey) || Pressing.overrides.shift) return 1;
			return Timeline.getStep()
		},
		get: function() {
			return Animation.selected.length
		},
		change: function(modify) {
			Animation.selected.setLength(limitNumber(modify(Animation.selected.length), 0, 1e4))
		},
		onBefore: function() {
			Undo.initEdit({animations: [Animation.selected]});
		},
		onAfter: function() {
			Undo.finishEdit('Change animation length')
		}
	})
	new Action('set_animation_end', {
		icon: 'keyboard_tab',
		category: 'animation',
		condition: {modes: ['animate'], method: () => Animation.selected},
		keybind: new Keybind({ctrl: true, key: 35}),
		click: function () {
			Undo.initEdit({animations: [Animation.selected]});
			Animation.selected.setLength(Timeline.time);
			Undo.finishEdit('Set animation length');
		}
	})
	new Action('add_animation', {
		icon: 'fa-plus-circle',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function () {
			new Animation({
				name: Format.animation_files ? 'animation.' + (Project.geometry_name||'model') + '.new' : 'animation',
				saved: false
			}).add(true).propertiesDialog()

		}
	})
	new Action('load_animation_file', {
		icon: 'fa-file-video',
		category: 'animation',
		condition: {modes: ['animate'], features: ['animation_files']},
		click: function () {
			var path = Project.export_path
			if (isApp) {
				var exp = new RegExp(osfs.replace('\\', '\\\\')+'models'+osfs.replace('\\', '\\\\'))
				var m_index = path.search(exp)
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
			}, async function(files) {
				for (let file of files) {
					await Animator.importFile(file);
				}
			})
		}
	})
	new Action('export_animation_file', {
		icon: 'movie',
		category: 'animation',
		click: function () {
			let form = {};
			let keys = [];
			let animations = Animation.all.slice()
			if (Format.animation_files) animations.sort((a1, a2) => a1.path.hashCode() - a2.path.hashCode())
			animations.forEach(animation => {
				let key = animation.name;
				keys.push(key)
				form[key.hashCode()] = {label: key, type: 'checkbox', value: true};
			})
			let dialog = new Dialog({
				id: 'animation_export',
				title: 'dialog.animation_export.title',
				form,
				onConfirm(form_result) {
					dialog.hide();
					keys = keys.filter(key => form_result[key.hashCode()])
					let content = Animator.buildFile(null, keys)

					Blockbench.export({
						resource_id: 'animation',
						type: 'JSON Animation',
						extensions: ['json'],
						name: (Project.geometry_name||'model')+'.animation',
						content: autoStringify(content),
					})
				}
			})
			form.select_all_none = {
				type: 'buttons',
				buttons: ['generic.select_all', 'generic.select_none'],
				click(index) {
					let values = {};
					keys.forEach(key => values[key.hashCode()] = (index == 0));
					dialog.setFormValues(values);
				}
			}

			dialog.show();
		}
	})
	new Action('save_all_animations', {
		icon: 'save',
		category: 'animation',
		condition: () => Format.animation_files,
		click: function () {
			let paths = [];
			let controller_paths = [];
			Animation.all.forEach(animation => {
				paths.safePush(animation.path);
			})
			AnimationController.all.forEach(controller => {
				controller_paths.safePush(controller.path);
			})
			paths.forEach(path => {
				Animator.exportAnimationFile(path);
			})
			controller_paths.forEach(path => {
				Animator.exportAnimationControllerFile(path);
			})
		}
	})

	new Action('bake_ik_animation', {
		icon: 'precision_manufacturing',
		category: 'animation',
		condition: () => Modes.animate && NullObject.all.findIndex(n => n.ik_target) != -1,
		click() {
			let animation = Animation.selected;
			let ik_samples = animation.sampleIK(animation.snapping);

			let keyframes = [];
			Undo.initEdit({keyframes});
			
			for (let uuid in ik_samples) {
				let animator = animation.animators[uuid];
				ik_samples[uuid].forEach(({array}) => {
					array[0] = Math.roundTo(array[0], 4);
					array[1] = Math.roundTo(array[1], 4);
					array[2] = Math.roundTo(array[2], 4);
				})
				ik_samples[uuid].forEach(({array}, i) => {
					let before = ik_samples[uuid][i-1];
					let after = ik_samples[uuid][i+1];
					if ((!before || before.array.equals(array)) && (!after || after.array.equals(array))) return;

					let time = Timeline.snapTime(i / animation.snapping, animation);
					let values = {x: array[0], y: array[1], z: array[2]};
					let kf = animator.createKeyframe(values, time, 'rotation', false, false);
					keyframes.push(kf);
				})
				animator.addToTimeline();
			}
			
			Undo.finishEdit('Bake IK rotations');
		}
	})
	new Action('bake_animation_into_model', {
		icon: 'directions_run',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function () {
			let elements = Outliner.elements;
			Undo.initEdit({elements, outliner: true});

			let animatable_elements = Outliner.elements.filter(el => el.constructor.animator);
			[...Group.all, ...animatable_elements].forEach(node => {
				let offset_rotation = [0, 0, 0];
				let offset_position = [0, 0, 0];
				Animator.animations.forEach(animation => {
					if (animation.playing) {
						let animator = animation.getBoneAnimator(node);
						let multiplier = animation.blend_weight ? Math.clamp(Animator.MolangParser.parse(animation.blend_weight), 0, Infinity) : 1;
						
						if (node instanceof Group) {
							let rotation = animator.interpolate('rotation');
							let position = animator.interpolate('position');
							if (rotation instanceof Array) offset_rotation.V3_add(rotation.map(v => v * multiplier));
							if (position instanceof Array) offset_position.V3_add(position.map(v => v * multiplier));
						}
					}
				})
				// Rotation
				if (node.rotatable) {
					node.rotation[0] -= offset_rotation[0];
					node.rotation[1] -= offset_rotation[1];
					node.rotation[2] += offset_rotation[2];
				}
				// Position
				function offset(node) {
					if (node instanceof Group) {
						node.origin.V3_add(offset_position);
						node.children.forEach(offset);
					} else {
						if (node.from) node.from.V3_add(offset_position);
						if (node.to) node.to.V3_add(offset_position);
						if (node.origin && node.origin !== node.from) node.origin.V3_add(offset_position);
					}
				}
				offset(node);
			});

			Modes.options.edit.select();
			Canvas.updateAllBones();
			Undo.finishEdit('Bake animation into model')
		}
	})
	new Action('change_animation_speed', {
		icon: 'av_timer',
		category: 'animation',
		condition: {modes: ['animate'], method: () => Animation.selected},
		click() {
			let animation = Animation.selected;
			Undo.initEdit({animations: [animation]});
			let keyframes = [];
			let initial_times = {};
			let initial_snapping = animation.snapping;
			let initial_length = animation.length;
			let initial_bezier_times = {};
			for (let id in animation.animators) {
				let animator = animation.animators[id];
				keyframes.push(...animator.keyframes);
			}
			keyframes.forEach(kf => {
				initial_times[kf.uuid] = kf.time;
				initial_bezier_times[kf.uuid] = {
					left: kf.bezier_left_time.slice(),
					right: kf.bezier_right_time.slice(),
				};
			})

			let previous_speed = 1;
			let previous_snapping = initial_snapping;
			let dialog = new Dialog({
				id: 'change_animation_speed',
				title: 'action.change_animation_speed',
				darken: false,
				form: {
					speed: {label: 'dialog.change_animation_speed.speed', type: 'range', value: 1, min: 0.1, max: 4, step: 0.01, editable_range_label: true, full_width: true},
					adjust_snapping: {label: 'dialog.change_animation_speed.adjust_snapping', type: 'checkbox', value: true},
					snapping: {label: 'menu.animation.snapping', type: 'number', value: initial_snapping, min: 1, max: 500, condition: result => result.adjust_snapping},
				},
				onFormChange({speed, adjust_snapping, snapping}) {
					if (speed != previous_speed) {
						snapping = adjust_snapping ? Math.roundTo(initial_snapping * speed, 2) : initial_snapping
						dialog.setFormValues({snapping}, false);

					} else if (snapping != previous_snapping) {
						speed = Math.clamp(Math.roundTo(snapping / initial_snapping, 2), 0.1, 4);
						dialog.setFormValues({speed}, false);
					}
					previous_speed = speed;
					previous_snapping = snapping;

					animation.snapping = snapping;
					keyframes.forEach(kf => {
						kf.time = Timeline.snapTime(initial_times[kf.uuid] / speed, animation);
						if (kf.interpolation == 'bezier') {
							let old_bezier_time = initial_bezier_times[kf.uuid];
							kf.bezier_left_time.V3_set(old_bezier_time.left).V3_divide(speed);
							kf.bezier_right_time.V3_set(old_bezier_time.right).V3_divide(speed);
						}
					})
					animation.setLength(initial_length / speed);
					TickUpdates.keyframes = true;
					Animator.preview();
				},
				onConfirm(result) {
					Undo.finishEdit('Change animation speed');
				},
				onCancel() {
					Undo.cancelEdit();
				}
			}).show();
		}
	})
	new Action('merge_animation', {
		icon: 'merge_type',
		category: 'animation',
		condition: () => Modes.animate && Animation.all.length > 1,
		click: async function() {
			let source_animation = Animation.selected;

			let options = await new Promise(resolve => {
				let animation_options = {};
				for (let animation of Animation.all) {
					if (animation == source_animation) continue;
					animation_options[animation.uuid] = animation.name;
				}
				new Dialog('merge_animation', {
					name: 'action.merge_animation',
					form: {
						animation: {label: 'dialog.merge_animation.merge_target', type: 'select', options: animation_options},
					},
					onConfirm(result) {
						resolve(result);
					},
					onCancel() {
						resolve(false);
					}
				}).show();
			})
			if (!options) return;
			
			let target_animation = Animation.all.find(anim => anim.uuid == options.animation);
			let animations = [source_animation, target_animation];
			Undo.initEdit({animations});


			for (let uuid in source_animation.animators) {
				let source_animator = source_animation.animators[uuid];
				// Get target animator
				let target_animator;
				if (source_animator instanceof BoneAnimator) {
					let node = source_animator.getElement ? source_animator.getElement() : source_animator.getGroup();
					target_animator = target_animation.getBoneAnimator(node);
				} else if (source_animator instanceof EffectAnimator) {
					if (!target_animation.animators.effects) {
						target_animation.animators.effects = new EffectAnimator(target_animation);
					}
					target_animator = target_animation.animators.effects;
				}
				for (let channel in source_animator.channels) {
					let channel_config = source_animator.channels[channel];
					let source_kfs = source_animator[channel];
					let target_kfs = target_animator[channel];

					if (source_kfs.length == 0) {
						continue;
					} else if (target_kfs.length == 0) {
						for (let src_kf of source_kfs) {
							target_animator.createKeyframe(src_kf, src_kf.time, channel, false, false);
						}
						continue;
					}

					let timecodes = {};
					// Save base values
					for (let kf of source_kfs) {
						let key = Math.roundTo(kf.time, 2);
						if (!timecodes[key]) timecodes[key] = {};
						timecodes[key].source_kf = kf;
						timecodes[key].time = kf.time;
					}
					for (let kf of target_kfs) {
						let key = Math.roundTo(kf.time, 2);
						if (!timecodes[key]) timecodes[key] = {};
						timecodes[key].target_kf = kf;
						timecodes[key].time = kf.time;
					}
					if (source_animator.interpolate) {
						// Interpolate in between values before they become affected by changes
						for (let key in timecodes) {
							let data = timecodes[key];
							Timeline.time = data.time;
							if (!data.target_kf) {
								data.target_values = target_animator.interpolate(channel, true);
							}
							if (!data.source_kf) {
								data.source_values = source_animator.interpolate(channel, true);
							}
						}
					}
					function mergeValues(a, b) {
						if (!a) return b;
						if (!b) return a;
						if (typeof a == 'number' && typeof b == 'number') {
							return a + b;
						}
						return a.toString() + ' + ' + b.toString();
					}
					let keys = Object.keys(timecodes).sort((a, b) => a.time - b.time);
					for (let key of keys) {
						let {source_kf, target_kf, target_values, source_values, time} = timecodes[key];
						Timeline.time = time;
						if ((source_kf || target_kf).transform) {
							if (source_kf && target_kf) {
								for (let axis of 'xyz') {
									let source_val = source_kf.get(axis);
									let target_val = target_kf.get(axis);
									target_kf.set(axis, mergeValues(target_val, source_val));
								}
							} else if (source_kf) {
								let target_kf = target_animator.createKeyframe(null, time, channel, false, false);
								let i = 0;
								for (let axis of 'xyz') {
									let source_val = source_kf.get(axis);
									let target_val = target_values[i] ?? 0;
									target_kf.set(axis, mergeValues(target_val, source_val));
									i++;
								}

							} else if (target_kf) {
								let i = 0;
								for (let axis of 'xyz') {
									let source_val = source_values[i] ?? 0;
									let target_val = target_kf.get(axis);
									target_kf.set(axis, mergeValues(target_val, source_val));
									i++;
								}
							}
						} else if (source_animator instanceof EffectAnimator) {
							if (source_kf && target_kf) {
								if (channel == 'timeline' ) {
									let source = source_kf.data_points[0].script;
									let target = target_kf.data_points[0].script;
									target_kf.data_points[0].script = (source && target) ? (target + '\n' + source) : (source || target);
								} else if (channel_config?.max_data_points > 1) {
									for (let src_kfdp of source_kf.data_points) {
										let new_dp = new KeyframeDataPoint(target_kf);
										new_dp.extend(src_kfdp);
										target_kf.data_points.push(new_dp);
									}
								}
								
							} else if (source_kf) {
								let new_kf = target_animator.createKeyframe(source_kf, source_kf.time, source_kf.channel, false, false);
								Property.resetUniqueValues(Keyframe, new_kf);
							}
						}
					}
				}
			}
			animations.remove(source_animation);
			source_animation.remove(false);
			target_animation.select();
			
			Undo.finishEdit('Merge animations');
		}
	})
	let optimize_animation_mode = 'selected_animation';
	new Action('optimize_animation', {
		icon: 'settings_slow_motion',
		category: 'animation',
		condition: {modes: ['animate'], method: () => Animation.selected},
		click: async function() {
			let response = await new Promise(resolve => {
				new Dialog('optimize_animation', {
					name: 'action.optimize_animation',
					form: {
						selection: {label: 'dialog.optimize_animation.selection', type: 'select', value: optimize_animation_mode, options: {
							selected_keyframes: 'dialog.optimize_animation.selection.selected_keyframes',
							selected_animation: 'dialog.optimize_animation.selection.selected_animation',
							all_animations: 'dialog.optimize_animation.selection.all_animations',
						}},
						'_1': '_',
						advanced: {label: 'dialog.advanced', type: 'checkbox', value: false},
						'_1': '_',
						thresholds: {type: 'info', text: 'dialog.optimize_animation.thresholds', condition: form => form.advanced},
						threshold_rotation: {label: 'timeline.rotation', type: 'number', value: 0.05, min: 0, max: 1, condition: form => form.advanced},
						threshold_position: {label: 'timeline.position', type: 'number', value: 0.01, min: 0, max: 1, condition: form => form.advanced},
						threshold_scale: {label: 'timeline.scale', type: 'number', value: 0.005, min: 0, max: 1, condition: form => form.advanced},
					},
					onConfirm(result) {
						resolve(result);
					},
					onCancel() {
						resolve(false);
					}
				}).show();
			})
			if (!response) return;

			optimize_animation_mode = response.selection;
			let animations = [Animation.selected];
			if (response.selection == 'all_animations') animations = Animation.all;
			let thresholds = {
				rotation: response.threshold_rotation,
				position: response.threshold_position,
				scale: response.threshold_scale
			};
			let remove_count = 0;
			Undo.initEdit({animations});

			for (let animation of animations) {
				for (let id in animation.animators) {
					let animator = animation.animators[id];
					for (let channel in animator.channels) {
						if (!animator[channel]?.length) continue;
						if (!animator.channels[channel].transform) continue;
						let first = animator[channel][0];
						// todo: add data points
						if (animator[channel].length == 1 && first.data_points.length == 1 && (response.selection != 'selected_keyframes' || first.selected)) {
							let value = first.getArray();
							if (!value[0] && !value[1] && !value[2]) {
								first.remove();
								continue;
							}
						}

						let sorted_keyframes = animator[channel].slice().sort((a, b) => a.time - b.time);
						let original_keyframes = sorted_keyframes.slice();
						let prev;
						let skipped = 0;
						for (let i = 0; i < original_keyframes.length; i++) {
							let kf = original_keyframes[i];
							if (kf.data_points.length != 1 || (!kf.selected && response.selection == 'selected_keyframes')) {
								prev = kf;
								continue;
							}
							let next = original_keyframes[i+1];
							let d_kf = kf.getArray();
							let d_prev = prev && prev.getArray(1);
							let d_next = next && next.getArray(0);
							let remove = false;

							// Same values check
							if (
								(prev || next) &&
								(!prev || d_prev[0] == d_kf[0]) && (!next || d_next[0] == d_kf[0]) &&
								(!prev || d_prev[1] == d_kf[1]) && (!next || d_next[1] == d_kf[1]) &&
								(!prev || d_prev[2] == d_kf[2]) && (!next || d_next[2] == d_kf[2])
							) {
								remove = true;
							} else if (prev && next) {
								let alpha = Math.getLerp(prev.time, next.time, kf.time);
								let axes = ['x', 'y', 'z'];
								let interpolated_value;
								if (
									prev.interpolation === 'linear' &&
									(next.interpolation === 'linear' || next.interpolation === 'step')
								) {
									interpolated_value = axes.map(axis => prev.getLerp(next, axis, alpha));

								} else if (prev.interpolation === 'catmullrom' || next.interpolation === 'catmullrom') {

									let prev_plus = sorted_keyframes[sorted_keyframes.indexOf(prev)-1];
									let next_plus = sorted_keyframes[sorted_keyframes.indexOf(next)+1];
									interpolated_value = axes.map(axis => prev.getCatmullromLerp(prev_plus, prev, next, next_plus, axis, alpha));

								} else if (prev.interpolation === 'bezier' || next.interpolation === 'bezier') {
									// Bezier
									interpolated_value = axes.map(axis => prev.getBezierLerp(prev, next, axis, alpha));
								}

								if (interpolated_value) {
									let threshold = thresholds[channel] ?? thresholds.position;
									let max_diff = 0.0000001;
									let all_axes_irrelevant = interpolated_value.allAre((val, axis) => {
										let diff = Math.abs(val - d_kf[axis]);
										max_diff = Math.max(max_diff, diff);
										return diff < threshold;
									});
									if (all_axes_irrelevant && skipped < Math.clamp(2 * (threshold / max_diff), 0, 12)) {
										remove = true;
									}
								}
							} else if (!prev && !next) {
								if (d_kf.allAre(val => !val)) {
									remove = true;
								} else {
									kf.time = 0;
								}
							}

							if (remove) {
								kf.remove();
								skipped++;
								remove_count++;
							} else {
								skipped = 0;
								prev = kf;
							}
						}
					}
				}
			}
			
			if (remove_count) {
				Blockbench.showQuickMessage(tl('message.optimize_animation.keyframes_removed', remove_count), 2000);
				Undo.finishEdit('Optimize animations');
			} else {
				Blockbench.showQuickMessage('message.optimize_animation.nothing_to_optimize', 1800);
				Undo.cancelEdit(false);
			}
		}
	})
	new Action('retarget_animators', {
		icon: 'rebase',
		category: 'animation',
		condition: () => Animation.selected,
		click: async function() {
			let animation = Animation.selected;
			let form = {};
			let unassigned_animators = [];
			let assigned_animators = [];

			for (let id in animation.animators) {
				let animator = animation.animators[id];
				if (animator instanceof BoneAnimator && animator.keyframes.length) {
					if (!animator.getGroup()) {
						unassigned_animators.push(animator);
					} else {
						assigned_animators.push(animator);
					}
				}
			}
			let all_animators = unassigned_animators.slice();
			if (unassigned_animators.length && assigned_animators.length) {
				all_animators.push('_');
			}
			all_animators.push(...assigned_animators);

			for (let animator of all_animators) {
				if (animator == '_') {
					form._ = '_';
					continue;
				}
				let is_assigned = assigned_animators.includes(animator);
				let options = {};
				let nodes;
				if (animator.type == 'bone') {
					nodes = Group.all;
				} else {
					nodes = Outliner.all.filter(element => element.type == animator.type);
				}
				if (!is_assigned) options[animator.uuid] = '-';
				for (let node of nodes) {
					options[node.uuid] = node.name;
				}
				form[animator.uuid] = {
					label: animator.name,
					type: 'select',
					value: animator.uuid,
					options
				}
			}

			let form_result = await new Promise(resolve => {

				new Dialog('retarget_animators', {
					name: 'action.retarget_animators',
					form,
					onConfirm(result) {
						resolve(result);
					},
					onCancel() {
						resolve(false);
					}
				}).show();
			})
			if (!form_result) return;
			Undo.initEdit({animations: [animation]});

			let temp_animators = {};

			function copyAnimator(target, source) {
				for (let channel in target.channels) {
					target[channel].splice(0, Infinity, ...source[channel]);
					for (let kf of target[channel]) {
						kf.animator = target;
					}
				}
				target.rotation_global = source.rotation_global;
			}
			function resetAnimator(animator) {
				for (let channel in animator.channels) {
					animator[channel].empty();
				}
				animator.rotation_global = false;
			}

			for (let animator of all_animators) {
				if (animator == '_') continue;

				let target_uuid = form_result[animator.uuid];
				if (target_uuid == animator.uuid) continue;
				let target_animator = animation.animators[target_uuid];

				if (!temp_animators[target_uuid]) {
					temp_animators[target_uuid] = new animator.constructor(target_uuid, animation);
					copyAnimator(temp_animators[target_uuid], target_animator);
				}

				let tempsave_current_animator = !temp_animators[animator.uuid];
				if (tempsave_current_animator) {
					temp_animators[animator.uuid] = new animator.constructor(animator.uuid, animation);
					copyAnimator(temp_animators[animator.uuid], animator);
				}

				copyAnimator(target_animator, temp_animators[animator.uuid] ?? animator);
				
				// Reset animator
				if (tempsave_current_animator) {
					resetAnimator(animator)
				}
			}

			Undo.finishEdit('Retarget animations');
			Animator.preview();
		}
	})
})


Interface.definePanels(function() {

	function eventTargetToAnim(target) {
		let target_node = target;
		let i = 0;
		while (target_node && target_node.classList && !target_node.classList.contains('animation')) {
			if (i < 3 && target_node) {
				target_node = target_node.parentNode;
				i++;
			} else {
				return [];
			}
		}
		return [AnimationItem.all.find(anim => anim.uuid == target_node.attributes.anim_id.value), target_node];
	}
	function getOrder(loc, obj) {
		if (!obj) {
			return;
		} else {
			if (loc < 16) return -1;
			return 1;
		}
		return 0;
	}

	new Panel('animations', {
		icon: 'movie',
		growable: true,
		resizable: true,
		condition: {modes: ['animate']},
		default_position: {
			slot: 'left_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400
		},
		toolbars: [
			new Toolbar('animations', {
				children: [
					'add_animation',
					'add_animation_controller',
					'load_animation_file',
					'slider_animation_length',
					'export_modded_animations',
				]
			})
		],
		component: {
			name: 'panel-animations',
			data() { return {
				animations: Animation.all,
				animation_controllers: AnimationController.all,
				files_folded: {},
				animation_files_enabled: true
			}},
			methods: {
				openMenu(event) {
					Interface.Panels.animations.menu.show(event)
				},
				toggle(key) {
					this.files_folded[key] = !this.files_folded[key];
					this.$forceUpdate();
				},
				saveFile(path, file) {
					if (file.type == 'animation') {
						Animator.exportAnimationFile(path);
					} else {
						Animator.exportAnimationControllerFile(path);
					}
				},
				addAnimation(path) {
					let other_animation = AnimationItem.all.find(a => a.path == path);
					if (other_animation instanceof Animation) {
						new Animation({
							name: other_animation && other_animation.name.replace(/\w+$/, 'new'),
							path,
							saved: false
						}).add(true).propertiesDialog()
					} else {
						new AnimationController({
							name: other_animation && other_animation.name.replace(/\w+$/, 'new'),
							path,
							saved: false
						}).add(true);
					}
				},
				showFileContextMenu(event, id) {
					Animation.prototype.file_menu.open(event, id);
				},
				dragAnimation(e1) {
					if (getFocusedTextInput()) return;
					if (e1.button == 1 || e1.button == 2) return;
					convertTouchEvent(e1);
					
					let [anim] = eventTargetToAnim(e1.target);
					if (!anim || anim.locked) {
						function off(e2) {
							removeEventListeners(document, 'mouseup touchend', off);
						}
						addEventListeners(document, 'mouseup touchend', off);
						return;
					};

					let active = false;
					let helper;
					let timeout;
					let drop_target, drop_target_node, order;
					let last_event = e1;

					function move(e2) {
						convertTouchEvent(e2);
						let offset = [
							e2.clientX - e1.clientX,
							e2.clientY - e1.clientY,
						]
						if (!active) {
							let distance = Math.sqrt(Math.pow(offset[0], 2) + Math.pow(offset[1], 2))
							if (Blockbench.isTouch) {
								if (distance > 20 && timeout) {
									clearTimeout(timeout);
									timeout = null;
								} else {
									document.getElementById('animations_list').scrollTop += last_event.clientY - e2.clientY;
								}
							} else if (distance > 6) {
								active = true;
							}
						} else {
							if (e2) e2.preventDefault();
							
							if (open_menu) open_menu.hide();

							if (!helper) {
								helper = document.createElement('div');
								helper.id = 'animation_drag_helper';
								let icon = document.createElement('i');		icon.className = 'material-icons'; icon.innerText = 'movie'; helper.append(icon);
								let span = document.createElement('span');	span.innerText = anim.name;	helper.append(span);
								document.body.append(helper);
							}
							helper.style.left = `${e2.clientX}px`;
							helper.style.top = `${e2.clientY}px`;

							// drag
							$('.drag_hover').removeClass('drag_hover');
							$('.animation[order]').attr('order', null);

							let target = document.elementFromPoint(e2.clientX, e2.clientY);
							[drop_target, drop_target_node] = eventTargetToAnim(target);
							if (drop_target) {
								var location = e2.clientY - $(drop_target_node).offset().top;
								order = getOrder(location, drop_target)
								drop_target_node.setAttribute('order', order)
								drop_target_node.classList.add('drag_hover');
							}
						}
						last_event = e2;
					}
					function off(e2) {
						if (helper) helper.remove();
						removeEventListeners(document, 'mousemove touchmove', move);
						removeEventListeners(document, 'mouseup touchend', off);
						$('.drag_hover').removeClass('drag_hover');
						$('.animation[order]').attr('order', null);
						if (Blockbench.isTouch) clearTimeout(timeout);

						if (active && !open_menu) {
							convertTouchEvent(e2);
							let target = document.elementFromPoint(e2.clientX, e2.clientY);
							[target_anim] = eventTargetToAnim(target);
							if (!target_anim || target_anim == anim ) return;

							if (anim instanceof AnimationController) {
								let index = AnimationController.all.indexOf(target_anim);
								if (index == -1 && target_anim.path) return;
								if (AnimationController.all.indexOf(anim) < index) index--;
								if (order == 1) index++;
								if (AnimationController.all[index] == anim && anim.path == target_anim.path) return;
								
								Undo.initEdit({animation_controllers: [anim]});
	
								anim.path = target_anim.path;
								AnimationController.all.remove(anim);
								AnimationController.all.splice(index, 0, anim);
								anim.createUniqueName();
	
								Undo.finishEdit('Reorder animation controllers');

							} else {
								let index = Animation.all.indexOf(target_anim);
								if (index == -1 && target_anim.path) return;
								if (Animation.all.indexOf(anim) < index) index--;
								if (order == 1) index++;
								if (Animation.all[index] == anim && anim.path == target_anim.path) return;
								
								Undo.initEdit({animations: [anim]});
	
								anim.path = target_anim.path;
								Animation.all.remove(anim);
								Animation.all.splice(index, 0, anim);
								anim.createUniqueName();
	
								Undo.finishEdit('Reorder animations');
							}
						}
					}

					if (Blockbench.isTouch) {
						timeout = setTimeout(() => {
							active = true;
							move(e1);
						}, 320)
					}

					addEventListeners(document, 'mousemove touchmove', move, {passive: false});
					addEventListeners(document, 'mouseup touchend', off, {passive: false});
				}
			},
			computed: {
				files() {
					if (!this.animation_files_enabled) {
						return {
							'': {
								animations: this.animations.concat(this.animation_controllers),
								name: '',
								hide_head: true
							}
						}
					}
					let files = {};
					this.animations.forEach(animation => {
						let key = animation.path || '';
						if (!files[key]) files[key] = {
							animations: [],
							name: animation.path ? pathToName(animation.path, true) : 'Unsaved',
							type: 'animation',
							saved: true
						};
						if (!animation.saved) files[key].saved = false;
						files[key].animations.push(animation);
					})
					this.animation_controllers.forEach(controller => {
						let key = controller.path || '';
						if (!files[key]) files[key] = {
							animations: [],
							name: controller.path ? pathToName(controller.path, true) : 'Unsaved',
							type: 'animation_controller',
							saved: true
						};
						if (!controller.saved) files[key].saved = false;
						files[key].animations.push(controller);
					})
					return files;
				},
				common_namespace() {
					if (!this.animations.length) {
						return '';

					} else if (this.animations.length == 1) {
						let match = this.animations[0].name.match(/^.*[.:]/);
						return match ? match[0] : '';

					} else {
						let name = this.animations[0].name;
						if (name.search(/[.:]/) == -1) return '';

						for (var anim of this.animations) {
							if (anim == this.animations[0]) continue;

							let segments = anim.name.split(/[.:]/);
							let length = 0;

							for (var segment of segments) {
								if (segment == name.substr(length, segment.length)) {
									length += segment.length + 1;
								} else {
									break;
								}
							}
							name = name.substr(0, length);
							if (name.length < 8) return '';
						}
						return name;
					}
				},
				common_controller_namespace() {
					if (!this.animation_controllers.length) {
						return '';

					} else if (this.animation_controllers.length == 1) {
						let match = this.animation_controllers[0].name.match(/^.*[.:]/);
						return match ? match[0] : '';

					} else {
						let name = this.animation_controllers[0].name;
						if (name.search(/[.:]/) == -1) return '';

						for (var anim of this.animation_controllers) {
							if (anim == this.animation_controllers[0]) continue;

							let segments = anim.name.split(/[.:]/);
							let length = 0;

							for (var segment of segments) {
								if (segment == name.substr(length, segment.length)) {
									length += segment.length + 1;
								} else {
									break;
								}
							}
							name = name.substr(0, length);
							if (name.length < 8) return '';
						}
						return name;
					}
				}
			},
			template: `
				<ul
					id="animations_list"
					class="list mobile_scrollbar"
					@mousedown="dragAnimation($event)"
					@touchstart="dragAnimation($event)"
					@contextmenu.stop.prevent="openMenu($event)"
				>
					<li v-for="(file, key) in files" :key="key" class="animation_file" @contextmenu.prevent.stop="showFileContextMenu($event, key)">
						<div class="animation_file_head" v-if="!file.hide_head" v-on:click.stop="toggle(key)">
							<i v-on:click.stop="toggle(key)" class="icon-open-state fa" :class=\'{"fa-angle-right": files_folded[key], "fa-angle-down": !files_folded[key]}\'></i>
							<label :title="key">{{ file.name }}</label>
							<div class="in_list_button" v-if="animation_files_enabled && !file.saved" v-on:click.stop="saveFile(key, file)">
								<i class="material-icons">save</i>
							</div>
							<div class="in_list_button" v-on:click.stop="addAnimation(key)">
								<i class="material-icons">add</i>
							</div>
						</div>
						<ul v-if="!files_folded[key]" :class="{indented: !file.hide_head}">
							<li
								v-for="animation in file.animations"
								v-bind:class="{ selected: animation.selected }"
								v-bind:anim_id="animation.uuid"
								class="animation"
								@click.stop="animation.clickSelect()"
								@dblclick.stop="animation.propertiesDialog()"
								:key="animation.uuid"
								@contextmenu.prevent.stop="animation.showContextMenu($event)"
							>
								<i class="material-icons" v-if="animation.type == 'animation'">movie</i>
								<i class="material-icons" v-else>cable</i>
								<label :title="animation.name" v-if="animation.type == 'animation'">
									{{ common_namespace ? animation.name.split(common_namespace).join('') : animation.name }}
									<span v-if="common_namespace"> - {{ animation.name }}</span>
								</label>
								<label :title="animation.name" v-else>
									{{ common_controller_namespace ? animation.name.split(common_controller_namespace).join('') : animation.name }}
									<span v-if="common_controller_namespace"> - {{ animation.name }}</span>
								</label>
								<div v-if="animation_files_enabled"  class="in_list_button" v-bind:class="{unclickable: animation.saved}" v-on:click.stop="animation.save()">
									<i v-if="animation.saved" class="material-icons">check_circle</i>
									<i v-else class="material-icons">save</i>
								</div>
								<div class="in_list_button" @dblclick.stop @click.stop="animation.togglePlayingState()">
									<i v-if="animation.playing == 'locked'" class="fa_big fas fa-lock"></i>
									<i v-else-if="animation.playing" class="fa_big far fa-play-circle"></i>
									<i v-else class="fa_big far fa-circle"></i>
								</div>
							</li>
						</ul>
					</li>
				</ul>
			`
		},
		menu: new Menu([
			'add_animation',
			'add_animation_controller',
			'load_animation_file',
			'paste',
			'save_all_animations',
		])
	})
})
