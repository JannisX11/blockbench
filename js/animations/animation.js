class Animation {
	constructor(data) {
		this.name = '';
		this.uuid = guid()
		this.loop = 'once';
		this.playing = false;
		this.override = false;
		this.selected = false;
		this.anim_time_update = '';
		this.length = 0;
		this.animators = {};
		this.markers = [];
		for (var key in Animation.properties) {
			Animation.properties[key].reset(this);
		}
		if (typeof data === 'object') {
			this.extend(data)
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
		Merge.number(this, data, 'length')
		if (typeof data.length == 'number') {
			this.setLength(this.length)
		}
		if (data.bones && !data.animators) {
			data.animators = data.bones;
		}
		if (data.animators instanceof Object) {
			for (var key in data.animators) {
				var group = Group.all.findInArray( isUUID(key) ? 'uuid' : 'name', key )
				if (group) { // todo
					var ba = this.getBoneAnimator(group)
					var kfs = data.animators[key]
					if (kfs && ba) {
						ba.rotation.empty();
						ba.position.empty();
						ba.scale.empty();
						kfs.forEach(kf_data => {
							ba.addKeyframe(kf_data, kf_data.uuid);
						})
					}
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
			length: this.length,
			selected: this.selected,
		}
		for (var key in Animation.properties) {
			Animation.properties[key].copy(this, copy)
		}
		if (Object.keys(this.animators).length) {
			copy.animators = {}
			for (var uuid in this.animators) {
				var kfs = this.animators[uuid].keyframes
				if (kfs && kfs.length) {
					if (options && options.bone_names && this.animators[uuid] instanceof BoneAnimator) {
						var group = this.animators[uuid].getGroup();
						uuid = group ? group.name : this.animators[uuid].name;
					}
					copy.animators[uuid] = [];
					kfs.forEach(kf => {
						copy.animators[uuid].push(kf.getUndoCopy(save));
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
		if (this.anim_time_update) ani_tag.anim_time_update = this.anim_time_update;
		ani_tag.bones = {};

		for (var uuid in this.animators) {
			var animator = this.animators[uuid];
			if (animator instanceof EffectAnimator) {

				animator.sound.forEach(kf => {
					if (!ani_tag.sound_effects) ani_tag.sound_effects = {};
					let timecode = kf.getTimecodeString();
					ani_tag.sound_effects[timecode] = {
						effect: kf.effect
					};
				})
				animator.particle.forEach(kf => {
					if (!ani_tag.particle_effects) ani_tag.particle_effects = {};
					let timecode = kf.getTimecodeString();
					let script = kf.script || undefined;
					if (script && !script.match(/;$/)) script += ';';
					ani_tag.particle_effects[timecode] = {
						effect: kf.effect,
						locator: kf.locator || undefined,
						pre_effect_script: kf.script || undefined
					};
				})
				animator.timeline.forEach(kf => {
					if (!ani_tag.timeline) ani_tag.timeline = {};
					let timecode = kf.getTimecodeString();
					ani_tag.timeline[timecode] = kf.instructions.split('\n');
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
					channels[kf.channel][timecode] = kf.getArray()
				})
				//Sorting keyframes
				for (var channel in Animator.possible_channels) {
					if (channels[channel]) {
						let timecodes = Object.keys(channels[channel])
						if (timecodes.length === 1) {
							bone_tag[channel] = channels[channel][timecodes[0]]
							if (channel == 'scale' &&
								channels[channel][timecodes[0]] instanceof Array &&
								channels[channel][timecodes[0]].allEqual(channels[channel][timecodes[0]][0])
							) {
								bone_tag[channel] = channels[channel][timecodes[0]][0];
							}
						} else {
							timecodes.sort().forEach((time) => {
								if (!bone_tag[channel]) {
									bone_tag[channel] = {}
								}
								bone_tag[channel][time] = channels[channel][time]
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
		if (isApp) {
			//overwrite path
			if (scope.mode === 'link') {
				var image = nativeImage.createFromPath(scope.source.replace(/\?\d+$/, '')).toPNG()
			} else {
				var image = nativeImage.createFromDataURL(scope.source).toPNG()
			}
			tex_version++;
			if (!as && this.path && fs.existsSync(this.path)) {
				fs.writeFile(this.path, image, function (err) {
					scope.fromPath(scope.path)
				})
			} else {
				var find_path;
				if (Format.bone_rig && Project.geometry_name) {
					find_path = BedrockEntityManager.findEntityTexture(Project.geometry_name, true)
				}
				if (!find_path && ModelMeta.export_path) {
					var arr = ModelMeta.export_path.split(osfs);
					var index = arr.lastIndexOf('models');
					if (index > 1) arr.splice(index, 256, 'textures')
					if (scope.folder) arr = arr.concat(scope.folder.split('/'));
					arr.push(scope.name)
					find_path = arr.join(osfs)
				} 
				Blockbench.export({
					resource_id: 'texture',
					type: 'PNG Texture',
					extensions: ['png'],
					name: scope.name,
					content: image,
					startpath: find_path,
					savetype: 'image'
				}, function(path) {
					scope.fromPath(path)
				})
			}
		} else {
			//Download
			let content = {
				format_version: '1.8.0',
				animations: {
					[this.name]: this.compileBedrockAnimation()
				}
			}
			Blockbench.export({
				resource_id: 'animation',
				type: 'JSON Animation',
				extensions: ['json'],
				name: (Project.geometry_name||'model')+'.animation',
				startpath: path,
				content: compileJSON(content),
			}, () => {
				this.saved = true;
			})
		}
		return this;
	}
	select() {
		var scope = this;
		Prop.active_panel = 'animations';
		if (this == Animator.selected) return;
		var selected_bone = Group.selected;
		Animator.animations.forEach(function(a) {
			a.selected = a.playing = false;
		})
		Timeline.animators.purge();
		Timeline.selected.empty();
		Timeline.vue._data.markers = this.markers;
		Timeline.vue._data.animation_length = this.length;
		this.selected = true;
		this.playing = true;
		Animator.selected = this;
		unselectAll();
		BarItems.slider_animation_length.update();

		Group.all.forEach(group => {
			scope.getBoneAnimator(group);
		})

		if (selected_bone) {
			selected_bone.select();
		}
		Animator.preview();
		return this;
	}
	setLength(len) {
		len = limitNumber(len, 0, 1e4)
		this.length = len;
		if (Animator.selected == this) {
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
	editUpdateVariable() {
		var scope = this;
		Blockbench.textPrompt('message.animation_update_var', scope.anim_time_update, function(name) {
			if (name !== scope.anim_time_update) {
				Undo.initEdit({animations: [scope]})
				scope.anim_time_update = name
				Undo.finishEdit('change animation variable')
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
	remove(undo) {
		if (undo) {
			Undo.initEdit({animations: [this]})
		}
		if (Animator.selected === this) {
			Animator.selected = false
		}
		Animator.animations.remove(this)
		if (undo) {
			Undo.finishEdit('remove animation', {animation: null})
		}
		Blockbench.dispatchEvent('remove_animation', {animations: [this]})
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
		this.setLength(len)
		if (this == Animator.selected) {
			BarItems.slider_animation_length.update()
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
}
	Animation.all = [];
	Animation.prototype.menu = new Menu([
		{name: 'menu.animation.loop', icon: 'loop', children: [
			{name: 'menu.animation.loop.once', icon: animation => (animation.loop == 'once' ? 'radio_button_checked' : 'radio_button_unchecked'), click(animation) {animation.setLoop('once', true)}},
			{name: 'menu.animation.loop.hold', icon: animation => (animation.loop == 'hold' ? 'radio_button_checked' : 'radio_button_unchecked'), click(animation) {animation.setLoop('hold', true)}},
			{name: 'menu.animation.loop.loop', icon: animation => (animation.loop == 'loop' ? 'radio_button_checked' : 'radio_button_unchecked'), click(animation) {animation.setLoop('loop', true)}},
		]},
		{name: 'menu.animation.override', icon: (a) => (a.override?'check_box':'check_box_outline_blank'), click: function(animation) {
			animation.override = !animation.override
		}},
		{name: 'menu.animation.anim_time_update', icon: 'update', click: function(animation) {
			animation.editUpdateVariable()
		}},
		'_',
		'duplicate',
		'rename',
		'delete',
	])
	new Property(Animation, 'boolean', 'saved', {default: true})
	new Property(Animation, 'string', 'path')


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
		TickUpdates.keyframes = true;
		for (var key in Animator.selected.animators) {
			Animator.selected.animators[key].selected = false;
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
		TickUpdates.keyframes = true;

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
	}
	scrollTo() {
		var el = $(`#timeline_body_inner > li[uuid=${this.uuid}]`).get(0)
		if (el) {
			var offset = el.offsetTop;
			var timeline = $('#timeline_body').scrollTop();
			var height = $('#timeline_body').height();
			if (offset < timeline) {
				$('#timeline_body').animate({
					scrollTop: offset
				}, 200);
			}
			if (offset + el.clientHeight > timeline + height) {
				$('#timeline_body').animate({
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
		this.group = Group.all.findInArray('uuid', this.uuid)
		if (!this.group) {
			if (this.animation && this.animation.animators[this.uuid] && this.animation.animators[this.uuid].type == 'bone') {
				delete this.animation.bones[this.uuid];
			}
		}
		return this.group
	}
	select(group_is_selected) {
		if (this.getGroup().locked) return this;

		var duplicates;
		for (var key in this.animation.animators) {
			this.animation.animators[key].selected = false;
		}
		if (group_is_selected !== true) {
			this.group.select();
		}
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
				buttons: ['dialog.ok'],
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
	fillValues(keyframe, values, allow_expression) {

		if (values instanceof Array) {
			keyframe.extend({
				x: values[0],
				y: values[1],
				z: values[2]
			})
			if (values[3]) {
				keyframe.extend({w: values[3], isQuaternion: true})
			}
		} else if (typeof values === 'number' || typeof values === 'string') {
			keyframe.extend({
				x: values,
				y: values,
				z: values
			})
		} else if (values == null) {
			var ref = this.interpolate(keyframe.channel, allow_expression)
			if (ref) {
				let e = 1e2
				ref.forEach((r, i) => {
					if (!isNaN(r)) {
						ref[i] = Math.round(parseFloat(r)*e)/e
					}
				})
				keyframe.extend({
					x: ref[0],
					y: ref[1],
					z: ref[2],
					w: ref.length === 4 ? ref[3] : undefined,
					isQuaternion: ref.length === 4
				})
			}
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
	displayRotation(arr) {
		var bone = this.group.mesh

		if (!arr) {
		} else if (arr.length === 4) {
			var added_rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(arr), 'ZYX')
			bone.rotation.x -= added_rotation.x
			bone.rotation.y -= added_rotation.y
			bone.rotation.z += added_rotation.z
		} else {
			arr.forEach((n, i) => {
				bone.rotation[getAxisLetter(i)] += Math.degToRad(n) * (i == 2 ? 1 : -1)
			})
		}
		return this;
	}
	displayPosition(arr) {
		var bone = this.group.mesh
		if (arr) {
			bone.position.x += -arr[0];
			bone.position.y += arr[1];
			bone.position.z += arr[2];
		}
		return this;
	}
	displayScale(arr) {
		if (!arr) return this;
		var bone = this.group.mesh;
		bone.scale.x *= arr[0] || 0.00001;
		bone.scale.y *= arr[1] || 0.00001;
		bone.scale.z *= arr[2] || 0.00001;
		return this;
	}
	interpolate(channel, allow_expression) {
		let time = Timeline.time;
		var i = 0;
		var before = false
		var after = false
		var result = false
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
		if (before && Math.abs(before.time - time) < 1/1200) {
			result = before
		} else if (after && Math.abs(after.time - time) < 1/1200) {
			result = after
		} else if (before && !after) {
			result = before
		} else if (after && !before) {
			result = after
		} else if (!before && !after) {
			//
		} else {
			let alpha = Math.lerp(before.time, after.time, time)
			if (Blockbench.hasFlag('no_interpolations')) {
				alpha = Math.round(alpha)
			}
			result = [
				before.getLerp(after, 'x', alpha, allow_expression),
				before.getLerp(after, 'y', alpha, allow_expression),
				before.getLerp(after, 'z', alpha, allow_expression)
			]
			if (before.isQuaternion && after.isQuaternion) {
				result[3] = before.getLerp(after, 'q', alpha, allow_expression)
			}
		}
		if (result && result.type === 'keyframe') {
			let keyframe = result
			let method = allow_expression ? 'get' : 'calc'
			result = [
				keyframe[method]('x'),
				keyframe[method]('y'),
				keyframe[method]('z')
			]
			if (keyframe.isQuaternion)	 	{
				result[3] = keyframe[method]('w')
			}
		}
		return result
	}
	displayFrame() {
		if (!this.doRender()) return;
		this.getGroup()

		if (!this.muted.rotation) this.displayRotation(this.interpolate('rotation'))
		if (!this.muted.position) this.displayPosition(this.interpolate('position'))
		if (!this.muted.scale) this.displayScale(this.interpolate('scale'))
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
	displayFrame() {
		if (!this.muted.sound) {
			this.sound.forEach(kf => {
				var diff = kf.time - Timeline.time;
				if (diff >= 0 && diff < (1/60) * (Timeline.playback_speed/100)) {
					if (kf.file && !kf.cooldown) {
						 var media = new Audio(kf.file);
						 window._media = media
						 media.volume = Math.clamp(settings.volume.value/100, 0, 1);
						 media.play();
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

//Misc Functions
	function findBedrockAnimation() {
		var animation_path = ModelMeta.export_path.split(osfs)
		var index = animation_path.lastIndexOf('models')
		animation_path.splice(index)
		var path1 = [...animation_path, 'animations', pathToName(ModelMeta.export_path)+'.json'].join(osfs)
		var path2 = [...animation_path, 'animations', pathToName(ModelMeta.export_path).replace('.geo', '')+'.animation.json'].join(osfs)
		if (fs.existsSync(path1)) {
			Blockbench.read([path1], {}, (files) => {
				Animator.loadFile(files[0])
			})
		} else if (fs.existsSync(path2)) {
			Blockbench.read([path2], {}, (files) => {
				Animator.loadFile(files[0])
			})
		}
	}
//Clipbench
	Clipbench.setKeyframes = function() {

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
	}
	Clipbench.pasteKeyframes = function() {
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

			if (!Animator.selected) return;
			var keyframes = [];
			Undo.initEdit({keyframes});
			Timeline.selected.empty();
			Timeline.keyframes.forEach((kf) => {
				kf.selected = false;
			})
			Clipbench.keyframes.forEach(function(data, i) {

				if (data.animator) {
					var animator = Animator.selected.animators[data.animator];
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

const Animator = {
	possible_channels: {rotation: true, position: true, scale: true, sound: true, particle: true, timeline: true},
	open: false,
	animations: Animation.all,
	frame: 0,
	interval: false,
	join() {

		Animator.open = true;
		selected.empty()
		Canvas.updateAllBones()

		//if (quad_previews.enabled) {
		//	quad_previews.enabled_before = true
		//}
		//main_preview.fullscreen()
		//main_preview.setNormalCamera()

		$('body').addClass('animation_mode')
		if (!Animator.timeline_node) {
			Animator.timeline_node = $('#timeline').get(0)
		}
		updateInterface()
		Toolbars.element_origin.toPlace('bone_origin')
		if (!Timeline.is_setup) {
			Timeline.setup()
		}
		TickUpdates.keyframes = true;
		if (outlines.children.length) {
			outlines.children.empty()
			Canvas.updateAllPositions()
		}
		if (!Animator.selected && Animator.animations.length) {
			Animator.animations[0].select()
		}
		if (isApp && !ModelMeta.animation_path && !Animator.animations.length && ModelMeta.export_path) {
			//Load
			findBedrockAnimation()
		}
		Animator.preview()
	},
	leave() {
		Timeline.pause()
		Animator.open = false;
		$('body').removeClass('animation_mode')
		//resizeWindow()
		//updateInterface()
		Toolbars.element_origin.toPlace()
		//if (quad_previews.enabled_before) {
		//	openQuadView()
		//}
		Canvas.updateAllBones()
	},
	showDefaultPose(no_matrix_update) {
		Group.all.forEach(group => {
			var bone = group.mesh;
			bone.rotation.copy(bone.fix_rotation)
			bone.position.copy(bone.fix_position)
			bone.scale.x = bone.scale.y = bone.scale.z = 1;

			if (!no_matrix_update) group.mesh.updateMatrixWorld()
		})
	},
	preview() {
		Animator.showDefaultPose(true);

		Group.all.forEach(group => {
			Animator.animations.forEach(animation => {
				if (animation.playing) {
					animation.getBoneAnimator(group).displayFrame()
				}
			})
			group.mesh.updateMatrixWorld()
		})

		Animator.animations.forEach(animation => {
			if (animation.playing) {
				if (animation.animators.effects) {
					animation.animators.effects.displayFrame();
				}
			}
		})

		if (Group.selected) {
			Transformer.center()
		}
		Blockbench.dispatchEvent('display_animation_frame')
	},
	loadFile(file) {
		var json = file.json || autoParseJSON(file.content);
		let path = file.path;
		if (json && typeof json.animations === 'object') {
			for (var ani_name in json.animations) {
				//Animation
				var a = json.animations[ani_name]
				var animation = new Animation({
					name: ani_name,
					path,
					loop: a.loop && (a.loop == 'hold_on_last_frame' ? 'hold' : 'loop'),
					override: a.override_previous_animation,
					anim_time_update: a.anim_time_update,
					length: a.animation_length,
					blend_weight: a.blend_weight,
					//particle_effects: a.particle_effects,
					//sound_effects: a.sound_effects,
				}).add()
				//Bones
				if (a.bones) {
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
										values: b[channel],
									})
								} else if (typeof b[channel] === 'object') {
									for (var timestamp in b[channel]) {
										ba.addKeyframe({
											time: parseFloat(timestamp),
											channel,
											values: b[channel][timestamp],
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
						var sound = a.sound_effects[timestamp];
						if (sound instanceof Array) sound = sound[0];
						animation.animators.effects.addKeyframe({
							channel: 'sound',
							time: parseFloat(timestamp),
							effect: sound.effect,
						})
					}
				}
				if (a.particle_effects) {
					if (!animation.animators.effects) {
						animation.animators.effects = new EffectAnimator(animation);
					}
					for (var timestamp in a.particle_effects) {
						var particle = a.particle_effects[timestamp];
						if (particle instanceof Array) particle = particle[0];
						animation.animators.effects.addKeyframe({
							channel: 'particle',
							time: parseFloat(timestamp),
							effect: particle.effect,
							locator: particle.locator,
							script: particle.pre_effect_script,
						})
					}
				}
				if (a.timeline) {
					if (!animation.animators.effects) {
						animation.animators.effects = new EffectAnimator(animation);
					}
					for (var timestamp in a.timeline) {
						var entry = a.timeline[timestamp];
						var instructions = entry.join('\n');
						animation.animators.effects.addKeyframe({
							channel: 'timeline',
							time: parseFloat(timestamp),
							instructions
						})
					}
				}
				if (!Animator.selected) {
					animation.select()
				}
			}
		}
	},
	buildFile(options) {
		if (typeof options !== 'object') {
			options = false
		}
		var animations = {}
		Animator.animations.forEach(function(a) {
			let ani_tag = a.compileBedrockAnimation();
			animations[a.name] = ani_tag;
		})
		return {
			format_version: '1.8.0',
			animations: animations
		}
	}
}

Molang.global_variables = {
	'true': 1,
	'false': 0,
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
Molang.variableHandler = function (variable) {
	var inputs = $('#var_placeholder_area').val().split('\n')
	var i = 0;
	while (i < inputs.length) {
		let key, val;
		[key, val] = inputs[i].split(/=(.+)/);
		key = key.replace(/[\s;]/g, '');
		if (key === variable) {
			return Molang.parse(val)
		}
		i++;
	}
}

Blockbench.addDragHandler('animation', {
	extensions: ['animation.json'],
	readtype: 'text',
	condition: {modes: ['animate']},
}, function(files) {
	Animator.loadFile(files[0])
})

BARS.defineActions(function() {
	new Action('add_animation', {
		icon: 'fa-plus-circle',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function () {
			var animation = new Animation({
				name: 'animation.' + (Project.geometry_name||'model') + '.new'
			}).add(true).rename()

		}
	})
	new Action('load_animation_file', {
		icon: 'fa-file-video',
		category: 'animation',
		condition: {modes: ['animate']},
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
				Animator.loadFile(files[0])
			})
		}
	})
	new Action('export_animation_file', {
		icon: 'save',
		category: 'animation',
		click: function () {
			var content = autoStringify(Animator.buildFile())
			var path = ModelMeta.animation_path

			if (isApp && !path) {
				path = ModelMeta.export_path
				var exp = new RegExp(osfs.replace('\\', '\\\\')+'models'+osfs.replace('\\', '\\\\'))
				var m_index = path.search(exp)
				if (m_index > 3) {
					path = path.substr(0, m_index) + osfs + 'animations' + osfs +  pathToName(ModelMeta.export_path, true)
				}
				if (path.match(/\.geo\.json$/)) {
					path = path.replace(/\.geo\.json$/, '.animation.json')
				} else {
					path = path.replace(/\.json$/, '.animation.json')
				}
			}
			Blockbench.export({
				resource_id: 'animation',
				type: 'JSON Animation',
				extensions: ['json'],
				name: (Project.geometry_name||'model')+'.animation',
				startpath: path,
				content: content,
			}, (real_path) => {
				ModelMeta.animation_path = real_path;
			})

		}
	})

	/*
	//Inverse Kinematics
	new Action('ik_enabled', {
		icon: 'check_box_outline_blank',
		category: 'animation',
		click: function () {
			Group.selected.ik_enabled = !Group.selected.ik_enabled;
			updateNslideValues();
			Transformer.updateSelection();
		}
	})
	new NumSlider('slider_ik_chain_length', {
		category: 'animation',
		condition: () => Animator.open && Group.selected,
		get: function() {
			return Group.selected.ik_chain_length||0;
		},
		settings: {
			min: 0, max: 64, default: 0,
			interval: function(event) {
				return 1;
			}
		},
		change: function(modify) {
			Group.selected.ik_chain_length = modify(Group.selected.ik_chain_length);
		},
		onBefore: function() {
			Undo.initEdit({keyframes: Timeline.selected})
		},
		onAfter: function() {
			Undo.finishEdit('move keyframes')
		}
	})*/

})
