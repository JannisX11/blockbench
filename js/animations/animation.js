class Animation {
	constructor(data) {
		this.name = '';
		this.uuid = guid()
		this.loop = 'once';
		this.playing = false;
		this.override = false;
		this.selected = false;
		this.anim_time_update = '';
		this.blend_weight = '';
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
		Merge.string(this, data, 'anim_time_update')
		Merge.string(this, data, 'blend_weight')
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
						animator = this.animators[key] = new EffectAnimator(this);
					} else {
						let uuid = isUUID(key) && key;
						if (!uuid) {
							let lowercase_bone_name = key.toLowerCase();
							let group_match = Group.all.find(group => group.name.toLowerCase() == lowercase_bone_name)
							uuid = group_match ? group_match.uuid : guid();
						}
						animator = this.animators[uuid] = new BoneAnimator(uuid, this, animator_blueprint.name)
					}
				} else {
					animator = this.animators[key];
					animator.channels.forEach(channel => {
						animator[channel].empty()
					})
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
				this.markers.push(new TimelineMarker(marker));
			})
		}
		return this;
	}
	getUndoCopy(options, save) {
		var copy = {
			uuid: this.uuid,
			name: this.name,
			loop: this.loop,
			override: this.override,
			anim_time_update: this.anim_time_update,
			blend_weight: this.blend_weight,
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
		if (Object.keys(this.animators).length) {
			copy.animators = {}
			for (var uuid in this.animators) {
				let ba = this.animators[uuid]
				var kfs = ba.keyframes
				if (kfs && kfs.length) {
					let ba_copy = copy.animators[uuid] = {
						name: ba.name,
						keyframes: []
					}
					kfs.forEach(kf => {
						ba_copy.keyframes.push(kf.getUndoCopy(true));
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
		ani_tag.bones = {};

		for (var uuid in this.animators) {
			var animator = this.animators[uuid];
			if (animator instanceof EffectAnimator) {

				animator.sound.forEach(kf => {
					if (!ani_tag.sound_effects) ani_tag.sound_effects = {};
					ani_tag.sound_effects[kf.getTimecodeString()] = kf.compileBedrockKeyframe();
				})
				animator.particle.forEach(kf => {
					if (!ani_tag.particle_effects) ani_tag.particle_effects = {};
					ani_tag.particle_effects[kf.getTimecodeString()] = kf.compileBedrockKeyframe();
				})
				animator.timeline.forEach(kf => {
					if (!ani_tag.timeline) ani_tag.timeline = {};
					ani_tag.timeline[kf.getTimecodeString()] = kf.compileBedrockKeyframe()
				})

			} else if (animator.keyframes.length) {

				var group = animator.getGroup(); 
				var bone_tag = ani_tag.bones[group ? group.name : animator.name] = {};
				var channels = {};
				//Saving Keyframes
				animator.keyframes.forEach(function(kf) {
					if (!channels[kf.channel]) {
						channels[kf.channel] = {};
					}
					let timecode = kf.getTimecodeString();
					channels[kf.channel][timecode] = kf.compileBedrockKeyframe()
				})
				//Sorting keyframes
				for (var channel in Animator.possible_channels) {
					if (channels[channel]) {
						let timecodes = Object.keys(channels[channel])
						if (timecodes.length === 1 && animator[channel][0].data_points.length == 1 && animator[channel][0].interpolation == 'linear') {
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
		if (Object.keys(ani_tag.bones).length == 0) {
			delete ani_tag.bones;
		}
		return ani_tag;
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
					if (this.saved_name) delete content.animations[this.saved_name];
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

		if (selected_bone) {
			selected_bone.select();
		}
		if (Modes.animate) Animator.preview();
		return this;
	}
	setLength(len) {
		this.length = 0;
		this.length = limitNumber(len, this.getMaxLength(), 1e4);
		if (Animation.selected == this) {
			Timeline.vue._data.animation_length = this.length;
			BarItems.slider_animation_length.update()
		}
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
				Undo.finishEdit('rename animation');
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
			group = Group.selected
		} else if (!group) {
			return;
		}
		var uuid = group.uuid
		if (!this.animators[uuid]) {
			this.animators[uuid] = new BoneAnimator(uuid, this);
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
			Undo.finishEdit('add animation', {animations: [this]})
		}
		return this;
	}
	remove(undo, remove_from_file = true) {
		if (undo) {
			Undo.initEdit({animations: [this]})
		}
		Animator.animations.remove(this)
		if (undo) {
			Undo.finishEdit('remove animation', {animations: []})

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
			var i = 0;
			while (i < keyframes.length) {
				len = Math.max(len, keyframes[i].time)
				i++;
			}
		}
		return len
	}
	setLoop(value, undo) {
		if ((value == 'once' || value == 'loop' || value == 'hold') && value !== this.loop) {
			if (undo) Undo.initEdit({animations: [this]})
			this.loop = value;
			if (undo) Undo.finishEdit('change animation loop mode')
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
			width: 640,
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
				line: '_',
			},
			component: {
				components: {VuePrismEditor},
				data: {
					anim_time_update: this.anim_time_update,
					blend_weight: this.blend_weight,
				},
				template: 
					`<div id="animation_properties_vue">
						<label>{{ tl('menu.animation.anim_time_update') }}</label>
						<div class="dialog_bar">
							<vue-prism-editor class="molang_input dark_bordered" v-model="anim_time_update" language="molang" :line-numbers="false" />
						</div>
						<label>${tl('menu.animation.blend_weight')}</label>
						<div class="dialog_bar">
							<vue-prism-editor class="molang_input dark_bordered" v-model="blend_weight" language="molang" :line-numbers="false" />
						</div>
					</div>`
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
				) {
					Undo.initEdit({animations: [this]});

					this.extend({
						loop: form_data.loop,
						name: form_data.name,
						override: form_data.override,
						snapping: form_data.snapping,
						anim_time_update: dialog.component.data.anim_time_update.trim().replace(/\n/g, ''),
						blend_weight: dialog.component.data.blend_weight.trim().replace(/\n/g, ''),
					})
					this.createUniqueName();
					if (isApp) this.path = form_data.path;

					Undo.finishEdit('edit animation properties');
				}
			},
			onCancel() {
				dialog.hide().delete();
			}
		})
		dialog.show();
	}
}
	Animation.all = [];
	Animation.selected = null;
	Animation.prototype.menu = new Menu([
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
		'duplicate',
		'rename',
		'delete',
		'_',
		{name: 'menu.animation.properties', icon: 'list', click: function(animation) {
			animation.propertiesDialog();
		}}
	])
	Animation.prototype.file_menu = new Menu([
		{name: 'menu.animation_file.unload', icon: 'clear_all', click: function(id) {
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
			Undo.finishEdit('remove animation', {animations: []})
		}}
	])
	new Property(Animation, 'boolean', 'saved', {default: true, condition: () => Format.animation_files})
	new Property(Animation, 'string', 'path', {condition: () => isApp && Format.animation_files})

Blockbench.on('finish_edit', event => {
	if (!Format.animation_files) return;
	if (event.aspects.animations && event.aspects.animations.length) {
		event.aspects.animations.forEach(animation => {
			animation.saved = false;
		})
	}
	if (event.aspects.keyframes && event.aspects.keyframes instanceof Array && Animation.selected) {
		Animation.selected.saved = false;
	}
})

class GeneralAnimator {
	constructor(uuid, animation) {
		this.animation = animation;
		this.expanded = false;
		this.selected = false;
		this.uuid = uuid || guid();
		this.muted = {};
		this.channels.forEach(channel => {
			this.muted[channel] = false;
		})
	}
	select() {
		var scope = this;
		for (var key in Animation.selected.animators) {
			Animation.selected.animators[key].selected = false;
		}
		this.selected = true;
		Timeline.selected_animator = this;
		this.addToTimeline();
		Vue.nextTick(() => {
			scope.scrollTo();
		})
		return this;
	}
	addToTimeline() {
		if (!Timeline.animators.includes(this)) {
			Timeline.animators.splice(0, 0, this);
		}
		if (!this.expanded) this.expanded = true;
		return this;
	}
	addKeyframe(data, uuid) {
		var channel = data.channel;
		if (typeof channel == 'number') channel = this.channels[channel];
		if (channel && this[channel]) {
			var kf = new Keyframe(data, uuid);
			this[channel].push(kf);
			kf.animator = this;
			return kf;
		}
	}
	createKeyframe(value, time, channel, undo, select) {
		if (!this[channel]) return;
		var keyframes = [];
		if (undo) {
			Undo.initEdit({keyframes})
		}
		var keyframe = new Keyframe({
			channel: channel,
			time: time
		});
		keyframes.push(keyframe);

		if (value) {
			keyframe.extend(value);
		} else if (this.fillValues) {
			this.fillValues(keyframe, value, true);
		}

		keyframe.channel = channel;
		keyframe.time = time;

		this[channel].push(keyframe);
		keyframe.animator = this;

		if (select !== false) {
			keyframe.select();
		}
		var deleted = [];
		delete keyframe.time_before;
		keyframe.replaceOthers(deleted);
		Undo.addKeyframeCasualties(deleted);

		if (undo) {
			Undo.finishEdit('added keyframe')
		}
		return keyframe;
	}
	getOrMakeKeyframe(channel) {
		var before, result;

		for (var kf of this[channel]) {
			if (Math.abs(kf.time - Timeline.time) < 0.02) {
				before = kf;
			}
		}
		result = before ? before : this.createKeyframe(null, Timeline.time, channel, false, false);
		return {before, result};
	}
	toggleMuted(channel) {
		this.muted[channel] = !this.muted[channel];
		if (this instanceof BoneAnimator) Animator.preview();
		return this;
	}
	scrollTo() {
		var el = $(`#timeline_body_inner > li[uuid=${this.uuid}]`).get(0)
		if (el) {
			var offset = el.offsetTop;
			var timeline = document.getElementById('timeline_body');
			var scroll_top = timeline.scrollTop;
			var height = timeline.clientHeight;
			if (offset < scroll_top) {
				$(timeline).animate({
					scrollTop: offset
				}, 200);
			}
			if (offset + el.clientHeight > scroll_top + height) {
				$(timeline).animate({
					scrollTop: offset - (height-el.clientHeight-20)
				}, 200);
			}
		}
	}
}
class BoneAnimator extends GeneralAnimator {
	constructor(uuid, animation, name) {
		super(uuid, animation);
		this.uuid = uuid;
		this._name = name;

		this.rotation = [];
		this.position = [];
		this.scale = [];
	}
	get name() {
		var group = this.getGroup();
		if (group) return group.name;
		return this._name;
	}
	set name(name) {
		this._name = name;
	}
	get keyframes() {
		return [...this.rotation, ...this.position, ...this.scale];
	}
	getGroup() {
		this.group = OutlinerNode.uuids[this.uuid];
		if (!this.group) {
			if (this.animation && this.animation.animators[this.uuid] && this.animation.animators[this.uuid].type == 'bone') {
				delete this.animation.bones[this.uuid];
			}
		}
		return this.group
	}
	select(group_is_selected) {
		if (!this.getGroup() || this.group.locked) return this;

		var duplicates;
		for (var key in this.animation.animators) {
			this.animation.animators[key].selected = false;
		}
		if (group_is_selected !== true && this.group) {
			this.group.select();
		}
		Group.all.forEach(group => {
			if (group.name == group.selected.name && group != Group.selected) {
				duplicates = true;
			}
		})
		function iterate(arr) {
			arr.forEach((it) => {
				if (it.type === 'group' && !duplicates) {
					if (it.name === Group.selected.name && it !== Group.selected) {
						duplicates = true;
					} else if (it.children && it.children.length) {
						iterate(it.children);
					}
				}
			})
		}
		iterate(Outliner.root);
		if (duplicates) {
			Blockbench.showMessageBox({
				translateKey: 'duplicate_groups',
				icon: 'folder',
			});
		}
		super.select();
		
		if (this[Toolbox.selected.animation_channel] && (Timeline.selected.length == 0 || Timeline.selected[0].animator != this)) {
			var nearest;
			this[Toolbox.selected.animation_channel].forEach(kf => {
				if (Math.abs(kf.time - Timeline.time) < 0.002) {
					nearest = kf;
				}
			})
			if (nearest) {
				nearest.select();
			}
		}

		if (this.group && this.group.parent && this.group.parent !== 'root') {
			this.group.parent.openUp();
		}
		return this;
	}
	fillValues(keyframe, values, allow_expression, round = true) {

		if (values instanceof Array) {
			keyframe.extend({
				data_points: [{
					x: values[0],
					y: values[1],
					z: values[2]
				}]
			})
		} else if (typeof values === 'number' || typeof values === 'string') {
			keyframe.extend({
				data_points: [{
					x: values,
					y: values,
					z: values
				}]
			})
		} else if (values === null) {
			let original_time = Timeline.time;
			Timeline.time = keyframe.time;
			var ref = this.interpolate(keyframe.channel, allow_expression)
			Timeline.time = original_time;
			if (ref) {
				if (round) {
					let e = keyframe.channel == 'scale' ? 1e4 : 1e2
					ref.forEach((r, i) => {
						if (!isNaN(r)) {
							ref[i] = Math.round(parseFloat(r)*e)/e
						}
					})
				}
				keyframe.extend({
					data_points: [{
						x: ref[0],
						y: ref[1],
						z: ref[2],
					}]
				})
			}
			let closest;
			this[keyframe.channel].forEach(kf => {
				if (!closest || Math.abs(kf.time - keyframe.time) < Math.abs(closest.time - keyframe.time)) {
					closest = kf;
				}
			});
			keyframe.extend({
				interpolation: closest && closest.interpolation
			})
		} else {
			keyframe.extend(values)
		}
	}
	pushKeyframe(keyframe) {
		this[keyframe.channel].push(keyframe)
		keyframe.animator = this;
		return this;
	}
	doRender() {
		this.getGroup()
		if (this.group && this.group.children && this.group.mesh) {
			let mesh = this.group.mesh
			return (mesh && mesh.fix_rotation)
		}
	}
	displayRotation(arr, multiplier = 1) {
		var bone = this.group.mesh

		if (!arr) {
		} else if (arr.length === 4) {
			var added_rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(arr), 'ZYX')
			bone.rotation.x -= added_rotation.x * multiplier
			bone.rotation.y -= added_rotation.y * multiplier
			bone.rotation.z += added_rotation.z * multiplier
		} else {
			arr.forEach((n, i) => {
				bone.rotation[getAxisLetter(i)] += Math.degToRad(n) * (i == 2 ? 1 : -1) * multiplier
			})
		}
		return this;
	}
	displayPosition(arr, multiplier = 1) {
		var bone = this.group.mesh
		if (arr) {
			bone.position.x -= arr[0] * multiplier;
			bone.position.y += arr[1] * multiplier;
			bone.position.z += arr[2] * multiplier;
		}
		return this;
	}
	displayScale(arr, multiplier = 1) {
		if (!arr) return this;
		var bone = this.group.mesh;
		bone.scale.x *= (1 + (arr[0] - 1) * multiplier) || 0.00001;
		bone.scale.y *= (1 + (arr[1] - 1) * multiplier) || 0.00001;
		bone.scale.z *= (1 + (arr[2] - 1) * multiplier) || 0.00001;
		return this;
	}
	interpolate(channel, allow_expression, axis) {
		let time = Timeline.time;
		var before = false
		var after = false
		var result = false
		let epsilon = 1/1200;

		function mapAxes(cb) {
			if (axis) {
				return cb(axis);
			} else {
				return ['x', 'y', 'z'].map(cb);
			}
		}

		for (var keyframe of this[channel]) {

			if (keyframe.time < time) {
				if (!before || keyframe.time > before.time) {
					before = keyframe
				}
			} else  {
				if (!after || keyframe.time < after.time) {
					after = keyframe
				}
			}
			i++;
		}
		if (before && Math.epsilon(before.time, time, epsilon)) {
			result = before
		} else if (after && Math.epsilon(after.time, time, epsilon)) {
			result = after
		} else if (before && !after) {
			result = before
		} else if (after && !before) {
			result = after
		} else if (!before && !after) {
			//
		} else {
			let no_interpolations = Blockbench.hasFlag('no_interpolations')
			let alpha = Math.lerp(before.time, after.time, time)

			if (no_interpolations || (before.interpolation == Keyframe.interpolation.linear && after.interpolation == Keyframe.interpolation.linear)) {
				if (no_interpolations) {
					alpha = Math.round(alpha)
				}
				return mapAxes(axis => before.getLerp(after, axis, alpha, allow_expression));
			} else {

				let sorted = this[channel].slice().sort((kf1, kf2) => (kf1.time - kf2.time));
				let before_index = sorted.indexOf(before);
				let before_plus = sorted[before_index-1];
				let after_plus = sorted[before_index+2];

				return mapAxes(axis => before.getCatmullromLerp(before_plus, before, after, after_plus, axis, alpha));
			}
		}
		if (result && result instanceof Keyframe) {
			let keyframe = result
			let method = allow_expression ? 'get' : 'calc'
			let dp_index = (keyframe.time > time || Math.epsilon(keyframe.time, time, epsilon)) ? 0 : keyframe.data_points.length-1;

			return mapAxes(axis => keyframe[method](axis, dp_index));
		}
		return false;
	}
	displayFrame(multiplier = 1) {
		if (!this.doRender()) return;
		this.getGroup()

		if (!this.muted.rotation) this.displayRotation(this.interpolate('rotation'), multiplier)
		if (!this.muted.position) this.displayPosition(this.interpolate('position'), multiplier)
		if (!this.muted.scale) this.displayScale(this.interpolate('scale'), multiplier)
	}
}
	BoneAnimator.prototype.channels = ['rotation', 'position', 'scale']
class EffectAnimator extends GeneralAnimator {
	constructor(animation) {
		super(null, animation);

		this.name = tl('timeline.effects')
		this.selected = false;

		this.particle = [];
		this.sound = [];
		this.timeline = [];
	}
	get keyframes() {
		return [...this.particle, ...this.sound, ...this.timeline];
	}
	pushKeyframe(keyframe) {
		this[keyframe.channel].push(keyframe)
		keyframe.animator = this;
		return this;
	}
	displayFrame(in_loop) {
		if (in_loop && !this.muted.sound) {
			this.sound.forEach(kf => {
				var diff = kf.time - Timeline.time;
				if (diff >= 0 && diff < (1/60) * (Timeline.playback_speed/100)) {
					if (kf.data_points[0].file && !kf.cooldown) {
						var media = new Audio(kf.data_points[0].file);
						media.playbackRate = Math.clamp(Timeline.playback_speed/100, 0.1, 4.0);
						media.volume = Math.clamp(settings.volume.value/100, 0, 1);
						media.play().catch(() => {});
						Timeline.playing_sounds.push(media);
						media.onended = function() {
							Timeline.playing_sounds.remove(media);
						}

						kf.cooldown = true;
						setTimeout(() => {
							delete kf.cooldown;
						}, 400)
					} 
				}
			})
		}
		
		if (!this.muted.particle) {
			this.particle.forEach(kf => {
				var diff = Timeline.time - kf.time;
				if (diff >= 0) {
					let i = 0;
					for (var data_point of kf.data_points) {
						let particle_effect = data_point.file && Animator.particle_effects[data_point.file]
						if (particle_effect) {

							let emitter = particle_effect.emitters[kf.uuid + i];
							if (!emitter) {
								emitter = particle_effect.emitters[kf.uuid + i] = new Wintersky.Emitter(WinterskyScene, particle_effect.config);
							}

							var locator = data_point.locator && Locator.all.find(l => l.name == data_point.locator)
							if (locator && locator.parent instanceof Group) {
								locator.parent.mesh.add(emitter.local_space);
								emitter.local_space.position.set(
									locator.from[0] - ((locator.parent.origin && locator.parent.origin[0]) || 0),
									locator.from[1] - ((locator.parent.origin && locator.parent.origin[1]) || 0),
									locator.from[2] - ((locator.parent.origin && locator.parent.origin[2]) || 0)
								)
								emitter.parent_mode = 'locator';
							} else {
								emitter.parent_mode = 'entity';
							}
							scene.add(emitter.global_space);
							emitter.jumpTo(diff);
						} 
						i++;
					}
				}
			})
		}
	}
	startPreviousSounds() {
		if (!this.muted.sound) {
			this.sound.forEach(kf => {
				if (kf.data_points[0].file && !kf.cooldown) {
					var diff = kf.time - Timeline.time;
					if (diff < 0 && Timeline.waveforms[kf.data_points[0].file] && Timeline.waveforms[kf.data_points[0].file].duration > -diff) {
						var media = new Audio(kf.data_points[0].file);
						media.playbackRate = Math.clamp(Timeline.playback_speed/100, 0.1, 4.0);
						media.volume = Math.clamp(settings.volume.value/100, 0, 1);
						media.currentTime = -diff;
						media.play().catch(() => {});
						Timeline.playing_sounds.push(media);
						media.onended = function() {
							Timeline.playing_sounds.remove(media);
						}

						kf.cooldown = true;
						setTimeout(() => {
							delete kf.cooldown;
						}, 400)
					} 
				}
			})
		}
	}
}
	EffectAnimator.prototype.channels = ['particle', 'sound', 'timeline']

//Clipbench
Object.assign(Clipbench, {
	setKeyframes() {

		var keyframes = Timeline.selected;

		Clipbench.keyframes = []
		if (!keyframes || keyframes.length === 0) {
			return;
		}
		var first = keyframes[0];
		var single_animator;
		keyframes.forEach(function(kf) {
			if (kf.time < first.time) {
				first = kf
			}
			if (single_animator && single_animator !== kf.animator.uuid) {
				single_animator = false;
			} else if (single_animator == undefined) {
				single_animator = kf.animator.uuid;
			}
		})

		keyframes.forEach(function(kf) {
			var copy = kf.getUndoCopy();
			copy.time_offset = kf.time - first.time;
			if (single_animator != false) {
				delete copy.animator;
			}
			Clipbench.keyframes.push(copy)
		})
		if (isApp) {
			clipboard.writeHTML(JSON.stringify({type: 'keyframes', content: Clipbench.keyframes}))
		}
	},
	pasteKeyframes() {
		if (isApp) {
			var raw = clipboard.readHTML()
			try {
				var data = JSON.parse(raw)
				if (data.type === 'keyframes' && data.content) {
					Clipbench.keyframes = data.content
				}
			} catch (err) {}
		}
		if (Clipbench.keyframes && Clipbench.keyframes.length) {

			if (!Animation.selected) return;
			var keyframes = [];
			Undo.initEdit({keyframes});
			Timeline.selected.empty();
			Timeline.keyframes.forEach((kf) => {
				kf.selected = false;
			})
			Clipbench.keyframes.forEach(function(data, i) {

				if (data.animator) {
					var animator = Animation.selected.animators[data.animator];
					if (animator && !Timeline.animators.includes(animator)) {
						animator.addToTimeline();
					}
				} else {
					var animator = Timeline.selected_animator;
				}
				if (animator) {
					var kf = animator.createKeyframe(data, Timeline.time + data.time_offset, data.channel, false, false)
					if (!kf) return;
					keyframes.push(kf);
					kf.selected = true;
					Timeline.selected.push(kf);
				}

			})
			TickUpdates.keyframe_selection = true;
			Animator.preview()
			Undo.finishEdit('paste keyframes');
		}
	}
})

const WinterskyScene = new Wintersky.Scene({
	fetchTexture: isApp && function(config) {
		if (config.file_path && config.particle_texture_path) {
			let path_arr = config.file_path.split(PathModule.sep);
			let particle_index = path_arr.indexOf('particles')
			path_arr.splice(particle_index)
			let filePath = PathModule.join(path_arr.join(PathModule.sep), config.particle_texture_path.replace(/\.png$/, '')+'.png')

			if (fs.existsSync(filePath)) {
				return filePath;
			}
		}
	}
});
WinterskyScene.global_options.scale = 16;
WinterskyScene.global_options.loop_mode = 'once';
WinterskyScene.global_options.parent_mode = 'entity';


const Animator = {
	possible_channels: {rotation: true, position: true, scale: true, sound: true, particle: true, timeline: true},
	open: false,
	animations: Animation.all,
	get selected() {return Animation.selected},
	MolangParser: new Molang(),
	motion_trail: new THREE.Object3D(),
	motion_trail_lock: false,
	_last_values: {rotation: [0, 0, 0], position: [0, 0, 0], scale: [0, 0, 0]},
	join() {
		
		if (isApp && (Format.id == 'bedrock' || Format.id == 'bedrock_old') && !BedrockEntityManager.initialized_animations) {
			BedrockEntityManager.initAnimations();
		}

		Animator.open = true;
		Canvas.updateAllBones()

		Outliner.vue.options.hidden_types.push('cube');
		scene.add(WinterskyScene.space);
		WinterskyScene.global_options.tick_rate = settings.particle_tick_rate.value;
		if (settings.motion_trails.value) scene.add(Animator.motion_trail);
		Animator.motion_trail.no_export = true;

		if (!Animator.timeline_node) {
			Animator.timeline_node = $('#timeline').get(0)
		}
		updateInterface()
		Toolbars.element_origin.toPlace('bone_origin')
		if (!Timeline.is_setup) {
			Timeline.setup()
		}
		if (outlines.children.length) {
			outlines.children.empty()
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
		Animator.preview()
	},
	leave() {
		Timeline.pause()
		Animator.open = false;
		Outliner.vue.options.hidden_types.remove('cube');

		scene.remove(WinterskyScene.space);
		scene.remove(Animator.motion_trail);
		Animator.resetParticles(true);

		Toolbars.element_origin.toPlace()

		Canvas.updateAllBones()
	},
	showDefaultPose(no_matrix_update) {
		Group.all.forEach(group => {
			var bone = group.mesh;
			bone.rotation.copy(bone.fix_rotation)
			bone.position.copy(bone.fix_position)
			bone.scale.x = bone.scale.y = bone.scale.z = 1;

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
			target = Animator.motion_trail_lock && OutlinerNode.uuids[Animator.motion_trail_lock];
			if (!target) target = Group.selected || NullObject.selected[0];
		}
		let target_bone = target instanceof Group ? target : target.parent;
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
		let multiplier = animation.blend_weight ? Math.clamp(Animator.MolangParser.parse(animation.blend_weight), 0, Infinity) : 1;
		let geometry = new THREE.Geometry();
		let bone_stack = [];
		let iterate = g => {
			bone_stack.push(g);
			if (g.parent instanceof Group) iterate(g.parent);
		}
		iterate(target_bone)
		
		let keyframes = {};
		let keyframe_source = Group.selected || (NullObject.selected[0] && NullObject.selected[0].parent)
		if (keyframe_source instanceof Group) {
			let ba = Animation.selected.getBoneAnimator(keyframe_source);
			let channel = target == Group.selected ? ba.position : (ba[Toolbox.selected.animation_channel] || ba.position)
			channel.forEach(kf => {
				keyframes[Math.round(kf.time / step)] = kf;
			})
		}

		function displayTime(time) {
			Timeline.time = time;
			bone_stack.forEach(group => {
				var mesh = group.mesh;
				mesh.rotation.copy(mesh.fix_rotation)
				mesh.position.copy(mesh.fix_position)
				mesh.scale.x = mesh.scale.y = mesh.scale.z = 1;
				animation.getBoneAnimator(group).displayFrame(multiplier);
			})
			target_bone.mesh.updateWorldMatrix(true, false)
		}

		for (var time = start_time; time <= max_time; time += step) {
			displayTime(time);
			let position = target instanceof Group
						 ? THREE.fastWorldPosition(target.mesh, new THREE.Vector3())
						 : target.getWorldCenter();
			geometry.vertices.push(position);
		}
		
		Timeline.time = currentTime;
		Animator.preview();

		var line = new THREE.Line(geometry, Canvas.outlineMaterial);
		line.no_export = true;
		Animator.motion_trail.children.forEachReverse(child => {
			Animator.motion_trail.remove(child);
		})
		Animator.motion_trail.add(line);

		let dot_geo = new THREE.OctahedronGeometry(0.25);
		let keyframe_geo = new THREE.OctahedronGeometry(1.0);
		let dot_material = new THREE.MeshBasicMaterial({color: gizmo_colors.outline});
		geometry.vertices.forEach((vertex, i) => {
			let keyframe = keyframes[i];
			if (keyframe) {
				let mesh = new THREE.Mesh(keyframe_geo, dot_material);
				mesh.position.copy(vertex);
				Animator.motion_trail.add(mesh);
				mesh.isKeyframe = true;
				mesh.keyframeUUID = keyframe.uuid;
			} else {
				let mesh = new THREE.Mesh(dot_geo, dot_material);
				mesh.position.copy(vertex);
				Animator.motion_trail.add(mesh);
			}
		})
		Animator.updateMotionTrailScale();
	},
	updateMotionTrailScale() {
		if (!Preview.selected) return;
		Animator.motion_trail.children.forEach((object) => {
			if (object.isLine) return;
			let scale = Preview.selected.calculateControlScale(object.position) * 0.6;
			object.scale.set(scale, scale, scale)
		})
	},
	preview(in_loop) {
		// Bones
		Animator.showDefaultPose(true);
		Group.all.forEach(group => {
			Animator._last_values = {rotation: [0, 0, 0], position: [0, 0, 0], scale: [0, 0, 0]}
			Animator.animations.forEach(animation => {
				let multiplier = animation.blend_weight ? Math.clamp(Animator.MolangParser.parse(animation.blend_weight), 0, Infinity) : 1;
				if (animation.playing) {
					animation.getBoneAnimator(group).displayFrame(multiplier)
				}
			})
		})
		Animator._last_values = {rotation: [0, 0, 0], position: [0, 0, 0], scale: [0, 0, 0]}
		scene.updateMatrixWorld()

		// Effects
		Animator.resetParticles(true);
		Animator.animations.forEach(animation => {
			if (animation.playing) {
				if (animation.animators.effects) {
					animation.animators.effects.displayFrame(in_loop);
				}
			}
		})

		if (Group.selected || NullObject.selected[0]) {
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
				.setFromJSON(json_content, {path})
				.set('file_path', path);
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
	},
	loadFile(file, animation_filter) {
		var json = file.json || autoParseJSON(file.content);
		let path = file.path;
		let new_animations = [];
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
					anim_time_update: (typeof a.anim_time_update == 'string'
						? a.anim_time_update.replace(/;(?!$)/, ';\n')
						: a.anim_time_update),
					blend_weight: (typeof a.blend_weight == 'string'
						? a.blend_weight.replace(/;(?!$)/, ';\n')
						: a.blend_weight),
					length: a.animation_length
				}).add()
				//Bones
				if (a.bones) {
					function getKeyframeDataPoints(source) {
						if (source instanceof Array) {
							return [{
								x: source[0],
								y: source[1],
								z: source[2],
							}]
						} else if (['number', 'string'].includes(typeof source)) {
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
							if (Animator.possible_channels[channel]) {
								if (typeof b[channel] === 'string' || typeof b[channel] === 'number' || b[channel] instanceof Array) {
									ba.addKeyframe({
										time: 0,
										channel,
										data_points: getKeyframeDataPoints(b[channel]),
									})
								} else if (typeof b[channel] === 'object' && b[channel].post) {
									ba.addKeyframe({
										time: 0,
										channel,
										interpolation: b[channel].lerp_mode,
										data_points: getKeyframeDataPoints(b[channel]),
									});
								} else if (typeof b[channel] === 'object') {
									for (var timestamp in b[channel]) {
										ba.addKeyframe({
											time: parseFloat(timestamp),
											channel,
											interpolation: b[channel][timestamp].lerp_mode,
											data_points: getKeyframeDataPoints(b[channel][timestamp]),
										});
									}
								}
							}
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
			form[key.hashCode()] = {label: key, type: 'checkbox', value: true};
			keys.push(key);
		}
		file.json = json;
		if (keys.length == 0) {
			Blockbench.showQuickMessage('message.no_animation_to_import');

		} else if (keys.length == 1) {
			Undo.initEdit({animations: []})
			let new_animations = Animator.loadFile(file, keys);
			Undo.finishEdit('import animations', {animations: new_animations})

		} else {
			let dialog = new Dialog({
				id: 'animation_import',
				title: 'dialog.animation_import.title',
				form,
				onConfirm(form_result) {
					dialog.hide();
					let names = [];
					for (var key of keys) {
						if (form_result[key.hashCode()]) {
							names.push(key);
						}
					}
					Undo.initEdit({animations: []})
					let new_animations = Animator.loadFile(file, names);
					Undo.finishEdit('import animations', {animations: new_animations})
				}
			})
			dialog.show();
		}
	},
	exportAnimationFile(path) {
		let filter_path = path || '';

		if (isApp && !path) {
			path = ModelMeta.export_path
			var exp = new RegExp(osfs.replace('\\', '\\\\')+'models'+osfs.replace('\\', '\\\\'))
			var m_index = path.search(exp)
			if (m_index > 3) {
				path = path.substr(0, m_index) + osfs + 'animations' + osfs +  pathToName(ModelMeta.export_path, true)
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
						Blockbench.writeFile(path, {content})
						cb(path);
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
Blockbench.on('update_camera_position', e => {
	if (Animator.open && settings.motion_trails.value && (Group.selected || NullObject.selected[0] || Animator.motion_trail_lock)) {
		Animator.updateMotionTrailScale();
	}
})
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

Animator.MolangParser.global_variables = {
	'true': 1,
	'false': 0,
	get 'query.delta_time'() {
		let time = (Date.now() - Timeline.last_frame_timecode + 1) / 1000;
		if (time < 0) time += 1;
		return Math.clamp(time, 0, 0.1);
	},
	get 'query.anim_time'() {
		return Timeline.time;
	},
	get 'query.life_time'() {
		return Timeline.time;
	},
	get 'time'() {
		return Timeline.time;
	}
}
Animator.MolangParser.variableHandler = function (variable) {
	var inputs = Interface.Panels.variable_placeholders.inside_vue._data.text.split('\n');
	var i = 0;
	while (i < inputs.length) {
		let key, val;
		[key, val] = inputs[i].split(/=(.+)/);
		key = key.replace(/[\s;]/g, '');
		if (key === variable) {
			return Animator.MolangParser.parse(val)
		}
		i++;
	}
}

Blockbench.addDragHandler('animation', {
	extensions: ['animation.json'],
	readtype: 'text',
	condition: {modes: ['animate']},
}, function(files) {
	Animator.importFile(files[0])
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
			var path = ModelMeta.export_path
			if (isApp) {
				var exp = new RegExp(osfs.replace('\\', '\\\\')+'models'+osfs.replace('\\', '\\\\'))
				var m_index = path.search(exp)
				if (m_index > 3) {
					path = path.substr(0, m_index) + osfs + 'animations' + osfs + pathToName(ModelMeta.export_path).replace(/\.geo/, '.animation')
				}
			}
			Blockbench.import({
				resource_id: 'animation',
				extensions: ['json'],
				type: 'JSON Animation',
				startpath: path
			}, function(files) {
				Animator.importFile(files[0])
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

	//Inverse Kinematics
	new Action('ik_enabled', {
		icon: 'check_box_outline_blank',
		category: 'animation',
		condition: () => Animator.open && NullObject.selected[0] && !Group.selected,
		click() {
			NullObject.selected[0].ik_enabled = !NullObject.selected[0].ik_enabled;
			updateNslideValues();
			Transformer.updateSelection();
		}
	})
	new NumSlider('slider_ik_chain_length', {
		category: 'animation',
		condition: () => Animator.open && NullObject.selected[0] && !Group.selected,
		get: function() {
			return NullObject.selected[0].ik_chain_length||0;
		},
		settings: {
			min: 0, max: 64, default: 0,
			interval: function(event) {
				return 1;
			}
		},
		change: function(modify) {
			NullObject.selected[0].ik_chain_length = Math.clamp(modify(NullObject.selected[0].ik_chain_length), 0, 64);
			updateSelection()
		},
		onBefore: function() {
			Undo.initEdit({keyframes: Timeline.selected})
		},
		onAfter: function() {
			Undo.finishEdit('move keyframes')
		}
	})

	// Motion Trail
	new Toggle('lock_motion_trail', {
		icon: 'lock_open',
		category: 'animation',
		condition: () => Animator.open && (Group.selected || NullObject.selected[0]),
		onChange(value) {
			if (value && (Group.selected || NullObject.selected[0])) {
				Animator.motion_trail_lock = Group.selected ? Group.selected.uuid : NullObject.selected[0].uuid;
			} else {
				Animator.motion_trail_lock = false;
				Animator.showMotionTrail();
			}
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

	Interface.Panels.animations = new Panel({
		id: 'animations',
		icon: 'movie',
		growable: true,
		condition: {modes: ['animate']},
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

							Undo.finishEdit('reorder animations');
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
				}
			},
			template: `
				<div>
					<div class="toolbar_wrapper animations"></div>
					<ul
						id="animations_list"
						class="list mobile_scrollbar"
						@mousedown="dragAnimation($event)"
						@touchstart="dragAnimation($event)"
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
									<label :title="animation.name">{{ animation.name }}</label>
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
				</div>
			`
		}
	})

	Interface.Panels.variable_placeholders = new Panel({
		id: 'variable_placeholders',
		icon: 'fas.fa-stream',
		condition: {modes: ['animate']},
		growable: true,
		toolbars: {
		},
		component: {
			name: 'panel-placeholders',
			components: {VuePrismEditor},
			data() { return {
				text: ''
			}},
			template: `
				<div style="flex-grow: 1; display: flex; flex-direction: column;">
					<p>{{ tl('panel.variable_placeholders.info') }}</p>
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
