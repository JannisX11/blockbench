class Animation {
	constructor(data) {
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
				var kfs = ba.keyframes
				if ((kfs && kfs.length) || ba.rotation_global) {
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

		if (this.length) ani_tag.animation_length = this.length;
		if (this.override) ani_tag.override_previous_animation = true;
		if (this.anim_time_update) ani_tag.anim_time_update = this.anim_time_update.replace(/\n/g, '');
		if (this.blend_weight) ani_tag.blend_weight = this.blend_weight.replace(/\n/g, '');
		if (this.start_delay) ani_tag.start_delay = this.start_delay.replace(/\n/g, '');
		if (this.loop_delay && ani_tag.loop) ani_tag.loop_delay = this.loop_delay.replace(/\n/g, '');
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
				//Saving Keyframes
				animator.keyframes.forEach(function(kf) {
					if (!channels[kf.channel]) {
						channels[kf.channel] = {};
					}
					let timecode = kf.getTimecodeString();
					channels[kf.channel][timecode] = kf.compileBedrockKeyframe()
					if (animator.rotation_global && kf.channel == 'rotation' && channels[kf.channel][timecode] instanceof Array && channels[kf.channel][timecode].allEqual(0)) {
						channels[kf.channel][timecode][2] = 0.01;
					}
				})
				// Sorting + compressing keyframes
				for (var channel in Animator.possible_channels) {
					if (channels[channel]) {
						let timecodes = Object.keys(channels[channel])
						if (timecodes.length === 1 && animator[channel][0].data_points.length == 1 && animator[channel][0].interpolation != 'catmullrom') {
							bone_tag[channel] = channels[channel][timecodes[0]]
							if (channel == 'scale' &&
								channels[channel][timecodes[0]] instanceof Array &&
								channels[channel][timecodes[0]].allEqual(channels[channel][timecodes[0]][0])
							) {
								bone_tag[channel] = channels[channel][timecodes[0]][0];
							}
						} else {
							timecodes.sort((a, b) => parseFloat(a) - parseFloat(b)).forEach((timecode) => {
								if (!bone_tag[channel]) {
									bone_tag[channel] = {}
								}
								bone_tag[channel][timecode] = channels[channel][timecode];
							})
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
		var scope = this;
		Prop.active_panel = 'animations';
		if (this == Animation.selected) return;
		var selected_bone = Group.selected;
		Animator.animations.forEach(function(a) {
			a.selected = a.playing = false;
		})
		Timeline.clear();
		Timeline.vue._data.markers = this.markers;
		Timeline.vue._data.animation_length = this.length;
		this.selected = true;
		this.playing = true;
		Animation.selected = this;
		unselectAll();
		BarItems.slider_animation_length.update();

		Group.all.forEach(group => {
			scope.getBoneAnimator(group);
		})
		Outliner.elements.forEach(element => {
			if (!element.constructor.animator) return;
			scope.getBoneAnimator(element);
		})

		if (selected_bone) {
			selected_bone.select();
		}
		if (Modes.animate) {
			Animator.preview();
		}
		return this;
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
		return (this.length && this.loop === 'loop') ? ((Timeline.time - 0.001) % this.length) + 0.001 : Timeline.time;
	}
	createUniqueName(arr) {
		var scope = this;
		var others = Animator.animations;
		if (arr && arr.length) {
			arr.forEach(g => {
				others.safePush(g)
			})
		}
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
		for (var num = 2; num < 8e3; num++) {
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
			this.playing = state !== undefined ? state : !this.playing;
			Animator.preview();
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
		if (!group && Group.selected) {
			group = Group.selected;
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
					delete this.animators[uuid2];
					break;
				}
			}
			this.animators[uuid] = match || new group.constructor.animator(uuid, this);
		}
		return this.animators[uuid];
	}
	add(undo) {
		if (undo) {
			Undo.initEdit({animations: []})
		}
		if (!Animator.animations.includes(this)) {
			Animator.animations.push(this)
		}
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

			if (isApp && remove_from_file && this.path && fs.existsSync(this.path)) {
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
					type: 'select',
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
				template: 
					`<div id="animation_properties_vue">
						<div class="dialog_bar form_bar">
							<label class="name_space_left">${tl('menu.animation.anim_time_update')}:</label>
							<vue-prism-editor class="molang_input dark_bordered" v-model="anim_time_update" language="molang" :line-numbers="false" />
						</div>
						<div class="dialog_bar form_bar">
							<label class="name_space_left">${tl('menu.animation.blend_weight')}:</label>
							<vue-prism-editor class="molang_input dark_bordered" v-model="blend_weight" language="molang" :line-numbers="false" />
						</div>
						<div class="dialog_bar form_bar">
							<label class="name_space_left">${tl('menu.animation.start_delay')}:</label>
							<vue-prism-editor class="molang_input dark_bordered" v-model="start_delay" language="molang" :line-numbers="false" />
						</div>
						<div class="dialog_bar form_bar" v-if="loop_mode == 'loop'">
							<label class="name_space_left">${tl('menu.animation.loop_delay')}:</label>
							<vue-prism-editor class="molang_input dark_bordered" v-model="loop_delay" language="molang" :line-numbers="false" />
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
					this.createUniqueName();
					if (isApp) this.path = form_data.path;

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
		'_',
		{name: 'menu.animation.loop', icon: 'loop', children: [
			{name: 'menu.animation.loop.once', icon: animation => (animation.loop == 'once' ? 'radio_button_checked' : 'radio_button_unchecked'), click(animation) {animation.setLoop('once', true)}},
			{name: 'menu.animation.loop.hold', icon: animation => (animation.loop == 'hold' ? 'radio_button_checked' : 'radio_button_unchecked'), click(animation) {animation.setLoop('hold', true)}},
			{name: 'menu.animation.loop.loop', icon: animation => (animation.loop == 'loop' ? 'radio_button_checked' : 'radio_button_unchecked'), click(animation) {animation.setLoop('loop', true)}},
		]},
		'_',
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
				shell.showItemInFolder(animation.path);
			}
		},
		'rename',
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
		'_',
		{name: 'menu.animation.properties', icon: 'list', click(animation) {
			animation.propertiesDialog();
		}}
	])
	Animation.prototype.file_menu = new Menu([
		{name: 'menu.animation_file.unload', icon: 'clear_all', click(id) {
			let animations_to_remove = [];
			Animation.all.forEach(animation => {
				if (animation.path == id && animation.saved) {
					animations_to_remove.push(animation);
				}
			})
			if (!animations_to_remove.length) return;
			Undo.initEdit({animations: animations_to_remove})
			animations_to_remove.forEach(animation => {
				animation.remove(false, false);
			})
			Undo.finishEdit('Unload animation file', {animations: []})
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


const WinterskyScene = new Wintersky.Scene({
	fetchTexture: isApp && function(config) {
		if (config.preview_texture) {
			return config.preview_texture;
		}
		if (config.file_path && config.particle_texture_path) {
			let path_arr = config.file_path.split(PathModule.sep);
			let particle_index = path_arr.indexOf('particles')
			path_arr.splice(particle_index)
			let filePath = PathModule.join(path_arr.join(PathModule.sep), config.particle_texture_path.replace(/\.png$/, '')+'.png')

			if (fs.existsSync(filePath)) {
				config.preview_texture = filePath;
				return filePath;
			}
		}
	}
});
WinterskyScene.global_options.scale = 16;
WinterskyScene.global_options.loop_mode = 'auto';
WinterskyScene.global_options.parent_mode = 'entity';

Prism.languages.molang['function-name'] = /\b(?!\d)(math\.\w+|button)(?=[\t ]*\()/i;

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

		Animator.open = true;
		Canvas.updateAllBones()

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
		if (Animation.all.length && !Animation.all.includes(Animation.selected)) {
			Animation.all[0].select();
		} else if (!Animation.all.length) {
			Timeline.selected.empty();
		}
		if (Group.selected) {
			Group.selected.select();
		}
		BarItems.slider_animation_length.update();
		Animator.preview();
	},
	leave() {
		Timeline.pause()
		Animator.open = false;

		scene.remove(WinterskyScene.space);
		scene.remove(Animator.motion_trail);
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
				if (emitter.local_space.parent) emitter.local_space.parent.remove(emitter.local_space);
				if (emitter.global_space.parent) emitter.global_space.parent.remove(emitter.global_space);
			}
		}
	},
	showMotionTrail(target) {
		if (!target) {
			target = Project.motion_trail_lock && OutlinerNode.uuids[Project.motion_trail_lock];
			if (!target) {
				target = Group.selected || ((Outliner.selected[0] && Outliner.selected[0].constructor.animator) ? Outliner.selected[0] : null);
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
		let keyframe_source = Group.selected || ((Outliner.selected[0] && Outliner.selected[0].constructor.animator) ? Outliner.selected[0] : null);
		if (keyframe_source) {
			let ba = Animation.selected.getBoneAnimator(keyframe_source);
			let channel = target == Group.selected ? ba.position : (ba[Toolbox.selected.animation_channel] || ba.position)
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
	preview(in_loop) {
		// Bones
		Animator.showDefaultPose(true);
		[...Group.all, ...Outliner.elements].forEach(node => {
			if (!node.constructor.animator) return;
			Animator.resetLastValues();
			Animator.animations.forEach(animation => {
				let multiplier = animation.blend_weight ? Math.clamp(Animator.MolangParser.parse(animation.blend_weight), 0, Infinity) : 1;
				if (animation.playing) {
					animation.getBoneAnimator(node).displayFrame(multiplier)
				}
			})
		})
		Animator.resetLastValues();
		scene.updateMatrixWorld();

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

		// Effects
		Animator.resetParticles(true);
		Animator.animations.forEach(animation => {
			if (animation.playing) {
				if (animation.animators.effects) {
					animation.animators.effects.displayFrame(in_loop);
				}
			}
		})
		if (Interface.Panels.variable_placeholders.inside_vue.text.match(/^\s*preview\.texture\s*=/mi)) {
			let tex_index = Animator.MolangParser.variableHandler('preview.texture');
			let texture = Texture.all[tex_index % Texture.all.length];
			if (texture) texture.select();
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

		if (Group.selected || (Outliner.selected[0] && Outliner.selected[0].constructor.animator)) {
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
						? string.replace(/;(?!$)/, ';\n')
						: string
		}
		if (json && typeof json.animations === 'object') {
			for (var ani_name in json.animations) {
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
	importFile(file) {
		let form = {};
		let json = autoParseJSON(file.content)
		let keys = [];
		for (var key in json.animations) {
			// Test if already loaded
			if (isApp && file.path) {
				let is_already_loaded = false
				for (var anim of Animation.all) {
					if (anim.path == file.path && anim.name == key) {
						is_already_loaded = true;
						break;
					}
				}
				if (is_already_loaded) {console.log(`${key} already exists`);continue;}
			}
			form[key.hashCode()] = {label: key, type: 'checkbox', value: true, nocolon: true};
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
				let dialog = new Dialog({
					id: 'animation_import',
					title: 'dialog.animation_import.title',
					form,
					onConfirm(form_result) {
						this.hide();
						let names = [];
						for (var key of keys) {
							if (form_result[key.hashCode()]) {
								names.push(key);
							}
						}
						Undo.initEdit({animations: []})
						let new_animations = Animator.loadFile(file, names);
						Undo.finishEdit('Import animations', {animations: new_animations})
						resolve();
					},
					onCancel() {
						resolve();
					}
				});
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
	}
}
Canvas.gizmos.push(Animator.motion_trail);
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

Clipbench.setAnimation = function() {
	if (!Animation.selected) return;
	Clipbench.animation = Animation.selected.getUndoCopy();

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
	if (!Clipbench.animation) return;

	let animations = [];
	Undo.initEdit({animations});
	let animation = new Animation(Clipbench.animation).add(false);
	animation.createUniqueName();
	animation.select().propertiesDialog();
	animations.push(animation);
	Undo.finishEdit('Paste animation')
}

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

			if (val.match(/^(slider|toggle)\(/)) {
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
}

Blockbench.addDragHandler('animation', {
	extensions: ['animation.json'],
	readtype: 'text',
	condition: {modes: ['animate']},
}, async function(files) {
	for (let file of files) {
		await Animator.importFile(file);
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
				name: 'animation.' + (Project.geometry_name||'model') + '.new'
			}).add(true).propertiesDialog()

		}
	})
	new Action('load_animation_file', {
		icon: 'fa-file-video',
		category: 'animation',
		condition: {modes: ['animate'], method: () => Format.animation_files},
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
				type: 'JSON Animation',
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
			Animation.all.forEach(animation => {
				paths.safePush(animation.path);
			})
			paths.forEach(path => {
				Animator.exportAnimationFile(path);
			})
		}
	})

	// Motion Trail
	new Toggle('lock_motion_trail', {
		icon: 'lock_open',
		category: 'animation',
		condition: () => Animator.open && (Group.selected || (Outliner.selected[0] && Outliner.selected[0].constructor.animator)),
		onChange(value) {
			if (value && (Group.selected || (Outliner.selected[0] && Outliner.selected[0].constructor.animator))) {
				Project.motion_trail_lock = Group.selected ? Group.selected.uuid : Outliner.selected[0].uuid;
			} else {
				Project.motion_trail_lock = false;
				Animator.showMotionTrail();
			}
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

			Modes.options.edit.select()
			Undo.finishEdit('Bake animation into model')
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
		return [Animation.all.find(anim => anim.uuid == target_node.attributes.anim_id.value), target_node];
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
		condition: {modes: ['animate']},
		default_position: {
			slot: 'left_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400
		},
		toolbars: {
			head: Toolbars.animations
		},
		component: {
			name: 'panel-animations',
			data() { return {
				animations: Animation.all,
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
				saveFile(path) {
					Animator.exportAnimationFile(path)
				},
				addAnimation(path) {
					let other_animation = Animation.all.find(a => a.path == path)
					new Animation({
						name: other_animation && other_animation.name.replace(/\w+$/, 'new'),
						path
					}).add(true).propertiesDialog()
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

							let index = Animation.all.indexOf(target_anim);
							if (Animation.all.indexOf(anim) < index) index--;
							if (order == 1) index++;
							if (Animation.all[index] == anim && anim.path == target_anim.path) return;
							
							Undo.initEdit({animations: [anim]});

							anim.path = target_anim.path;
							Animation.all.remove(anim);
							Animation.all.splice(index, 0, anim);

							Undo.finishEdit('Reorder animations');
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
								animations: this.animations,
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
							saved: true
						};
						if (!animation.saved) files[key].saved = false;
						files[key].animations.push(animation);
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
								v-on:click.stop="animation.select()"
								v-on:dblclick.stop="animation.propertiesDialog()"
								:key="animation.uuid"
								@contextmenu.prevent.stop="animation.showContextMenu($event)"
							>
								<i class="material-icons">movie</i>
								<label :title="animation.name">
									{{ common_namespace ? animation.name.split(common_namespace).join('') : animation.name }}
									<span v-if="common_namespace"> - {{ animation.name }}</span>
								</label>
								<div v-if="animation_files_enabled"  class="in_list_button" v-bind:class="{unclickable: animation.saved}" v-on:click.stop="animation.save()">
									<i v-if="animation.saved" class="material-icons">check_circle</i>
									<i v-else class="material-icons">save</i>
								</div>
								<div class="in_list_button" v-on:click.stop="animation.togglePlayingState()">
									<i v-if="animation.playing" class="fa_big far fa-play-circle"></i>
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
			'load_animation_file',
			'paste',
			'save_all_animations',
		])
	})

	new Panel('variable_placeholders', {
		icon: 'fas.fa-stream',
		condition: {modes: ['animate']},
		growable: true,
		default_position: {
			slot: 'left_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400
		},
		toolbars: {
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

					let text = this.text.toLowerCase();
					let matches = text.matchAll(/(slider|toggle)\(.+\)/g);

					for (let match of matches) {
						let [type, content] = match[0].substring(0, match[0].length - 1).split(/\(/);
						let [id, ...args] = content.split(/\(|, */);
						id = id.replace(/['"]/g, '');
						if (this.buttons.find(b => b.id == id)) return;

						let variable = text.substring(0, match.index).match(/[\w.-]+ *= *$/);
						variable = variable ? variable[0].replace(/[ =]+/g, '').replace(/^v\./, 'variable.').replace(/^q\./, 'query.').replace(/^t\./, 'temp.').replace(/^c\./, 'context.') : undefined;

						if (type == 'slider') {
							this.buttons.push({
								type,
								id,
								value: old_values[id] || 0,
								variable,
								step: args[0],
								min: args[1],
								max: args[2]
							})
						} else {
							this.buttons.push({
								type,
								id,
								value: old_values[id] || 0,
								variable,
							})
						}
					}
				},
				changeButtonValue(button, event) {
					if (button.type == 'toggle') {
						button.value = event.target.checked ? 1 : 0;
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
							difference *= canvasGridSize(e2.shiftKey || Pressing.overrides.shift, e2.ctrlOrCmd || Pressing.overrides.ctrl);
							
							button.value = Math.roundTo((parseFloat(button.value) || 0) + difference, 4);

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
					}
					addEventListeners(document, 'mouseup touchend', off);
					addEventListeners(document, 'mousemove touchmove', move);
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
				<div style="flex-grow: 1; display: flex; flex-direction: column;">

					<ul id="placeholder_buttons">
						<li v-for="button in buttons" :key="button.id" :class="{placeholder_slider: button.type == 'slider'}">
							<input v-if="button.type == 'toggle'" type="checkbox" class="tab_target" :value="button.value == 1" @change="changeButtonValue(button, $event)" :id="'placeholder_button_'+button.id">
							<input v-else type="number" class="dark_bordered tab_target" :step="button.step" :min="button.min" :max="button.max" v-model="button.value" @input="changeButtonValue(button, $event)">
							<label :for="'placeholder_button_'+button.id" @mousedown="slideButton(button, $event)" @touchstart="slideButton(button, $event)">{{ button.id }}</label>
						</li>
					</ul>

					<p>${tl('panel.variable_placeholders.info')}</p>

					<vue-prism-editor
						id="var_placeholder_area"
						class="molang_input dark_bordered tab_target"
						v-model="text"
						language="molang"
						:line-numbers="false"
						style="flex-grow: 1;"
						onkeyup="Animator.preview()"
					/>
				</div>
			`
		}
	})
})
