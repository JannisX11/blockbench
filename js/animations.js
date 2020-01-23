class Animation {
	constructor(data) {
		this.name = '';
		this.uuid = guid()
		this.loop = false;
		this.playing = false;
		this.override = false;
		this.selected = false;
		this.anim_time_update = '';
		this.length = 0;
		this.animators = {};
		this.markers = [];
		if (typeof data === 'object') {
			this.extend(data)
		}
	}
	extend(data) {
		Merge.string(this, data, 'name')
		Merge.boolean(this, data, 'loop')
		Merge.boolean(this, data, 'override')
		Merge.string(this, data, 'anim_time_update')
		Merge.number(this, data, 'length')
		if (data.bones && !data.animators) {
			data.animators = data.bones;
		}
		if (data.animators instanceof Object) {
			for (var key in data.animators) {
				var group = Group.all.findInArray( isUUID(key) ? 'uuid' : 'name', key )
				if (group) {
					var ba = this.getBoneAnimator(group)
					var kfs = data.animators[key]
					if (kfs && ba) {
						ba.rotation.length = 0;
						ba.position.length = 0;
						ba.scale.length = 0;
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
		var scope = this;
		var copy = {
			uuid: this.uuid,
			name: this.name,
			loop: this.loop,
			override: this.override,
			anim_time_update: this.anim_time_update,
			length: this.length,
			selected: this.selected,
		}
		if (Object.keys(this.animators).length) {
			copy.animators = {}
			for (var uuid in this.animators) {
				var kfs = this.animators[uuid].keyframes
				if (kfs && kfs.length) {
					if (options && options.bone_names && this.animators[uuid] instanceof BoneAnimator) {
						var group = this.animators[uuid].getGroup();
						uuid = group ? group.name : '';
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
		this.length = len
		if (this == Animator.selected) {
			BarItems.slider_animation_length.update()
		}
		return len
	}
}
	Animation.prototype.menu = new Menu([
		{name: 'menu.animation.loop', icon: (a) => (a.loop?'check_box':'check_box_outline_blank'), click: function(animation) {
			animation.loop = !animation.loop
		}},
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
		/*
			rename
			Loop: checkbox
			Override: checkbox
			anim_time_update:
				WalkPosition
			delete
		*/
	])
class TimelineMarker {
	constructor(data) {
		this.time = 0;
		this.color = 0;
		if (data) {
			this.extend(data);
		}
	}
	extend(data) {
		Merge.number(this, data, 'color');
		Merge.number(this, data, 'time');
	}
	callPlayhead() {
		Timeline.setTime(this.time)
		Animator.preview()
		return this;
	}
	showContextMenu(event) {
		this.menu.open(event, this);
		return this;
	}
}
	TimelineMarker.prototype.menu = new Menu([
		{icon: 'flag', color: markerColors[0].standard, name: 'cube.color.'+markerColors[0].name, click: function(marker) {marker.color = 0;}},
		{icon: 'flag', color: markerColors[1].standard, name: 'cube.color.'+markerColors[1].name, click: function(marker) {marker.color = 1;}},
		{icon: 'flag', color: markerColors[2].standard, name: 'cube.color.'+markerColors[2].name, click: function(marker) {marker.color = 2;}},
		{icon: 'flag', color: markerColors[3].standard, name: 'cube.color.'+markerColors[3].name, click: function(marker) {marker.color = 3;}},
		{icon: 'flag', color: markerColors[4].standard, name: 'cube.color.'+markerColors[4].name, click: function(marker) {marker.color = 4;}},
		{icon: 'flag', color: markerColors[5].standard, name: 'cube.color.'+markerColors[5].name, click: function(marker) {marker.color = 5;}},
		{icon: 'flag', color: markerColors[6].standard, name: 'cube.color.'+markerColors[6].name, click: function(marker) {marker.color = 6;}},
		{icon: 'flag', color: markerColors[7].standard, name: 'cube.color.'+markerColors[7].name, click: function(marker) {marker.color = 7;}},
		{icon: 'delete', name: 'generic.delete', click: function(marker) {
			if (Animator.selected) Animator.selected.markers.remove(marker);
		}}
	])
class GeneralAnimator {
	constructor(uuid, animation) {
		this.animation = animation;
		this.expanded = false;
		this.selected = false;
		this.uuid = uuid || guid();
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
			this.fillValues(keyframe, value);
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
	constructor(uuid, animation) {
		super(uuid, animation);
		this.uuid = uuid;

		this.rotation = [];
		this.position = [];
		this.scale = [];
	}
	get name() {
		var group = this.getGroup();
		if (group) return group.name;
		return '';
	}
	get keyframes() {
		return [...this.rotation, ...this.position, ...this.scale];
	}
	getGroup() {
		this.group = Group.all.findInArray('uuid', this.uuid)
		if (!this.group) {
			console.log('no group found for '+this.uuid)
			if (this.animation && this.animation.animators[this.uuid] && this.animation.animators[this.uuid].type == 'bone') {
				delete this.animation.bones[this.uuid];
			}
		}
		return this.group
	}
	select(group_is_selected) {
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
	fillValues(keyframe, values) {

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
			var ref = this.interpolate(Timeline.time, keyframe.channel, true)
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
				bone.rotation[getAxisLetter(i)] += Math.PI / (180 / n) * (i == 2 ? 1 : -1)
			})
		}
		return this;
	}
	displayPosition(arr) {
		var bone = this.group.mesh
		if (arr) {
			var offset = new THREE.Vector3().fromArray(arr);
			offset.x *= -1;
			bone.position.add(offset)
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
	interpolate(time, channel, allow_expression) {
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
	displayFrame(time) {
		if (!this.doRender()) return;
		this.getGroup()

		this.displayRotation(this.interpolate(time, 'rotation'))
		this.displayPosition(this.interpolate(time, 'position'))
		this.displayScale(this.interpolate(time, 'scale'))
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
		this.sound.forEach(kf => {
			var diff = kf.time - Timeline.time;
			if (diff >= 0 && diff < (1/60) * (Timeline.playback_speed/100)) {
				if (kf.file && !kf.cooldown) {
					 var media = new Audio(kf.file);
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
	EffectAnimator.prototype.channels = ['particle', 'sound', 'timeline']
class Keyframe {
	constructor(data, uuid) {
		this.type = 'keyframe'
		this.channel = 'rotation';
		this.time = 0;
		this.selected = 0;
		this.x = '0';
		this.y = '0';
		this.z = '0';
		this.w = '0';
		this.isQuaternion = false;
		this.effect = '';
		this.file = '';
		this.locator = '';
		this.script = '';
		this.instructions = '';
		this.uuid = (uuid && isUUID(uuid)) ? uuid : guid();
		if (typeof data === 'object') {
			Merge.string(this, data, 'channel')
			this.transform = this.channel === 'rotation' || this.channel === 'position' || this.channel === 'scale';
			this.extend(data)
			if (this.channel === 'scale' && data.x == undefined && data.y == undefined && data.z == undefined) {
				this.x = this.y = this.z = 1;
			}
		}
	}
	extend(data) {
		Merge.number(this, data, 'time')

		if (this.transform) {
			if (data.values != undefined) {
				if (typeof data.values == 'number' || typeof data.values == 'string') {
					data.x = data.y = data.z = data.values;

				} else if (data.values instanceof Array) {
					data.x = data.values[0];
					data.y = data.values[1];
					data.z = data.values[2];
					data.w = data.values[3];
				}
			}
			Merge.string(this, data, 'x')
			Merge.string(this, data, 'y')
			Merge.string(this, data, 'z')
			Merge.string(this, data, 'w')
			Merge.boolean(this, data, 'isQuaternion')
		} else {
			if (data.values) {
				data.effect = data.values.effect;
				data.locator = data.values.locator;
				data.script = data.values.script;
				data.file = data.values.file;
				data.instructions = data.values.instructions;
			}
			Merge.string(this, data, 'effect')
			Merge.string(this, data, 'locator')
			Merge.string(this, data, 'script')
			Merge.string(this, data, 'file')
			Merge.string(this, data, 'instructions')
		}
		return this;
	}
	get(axis) {
		if (!this[axis]) {
			return this.transform ? 0 : '';
		} else if (!isNaN(this[axis])) {
			return parseFloat(this[axis])
		} else {
			return this[axis]
		}
	}
	calc(axis) {
		return Molang.parse(this[axis])
	}
	set(axis, value) {
		this[axis] = value;
		return this;
	}
	offset(axis, amount) {
		var value = this.get(axis)
		if (!value || value === '0') {
			this.set(axis, amount)
			return amount;
		}
		if (typeof value === 'number') {
			this.set(axis, value+amount)
			return value+amount
		}
		var start = value.match(/^-?\s*\d*(\.\d+)?\s*(\+|-)/)
		if (start) {
			var number = parseFloat( start[0].substr(0, start[0].length-1) ) + amount
			value = trimFloatNumber(number) + value.substr(start[0].length-1)
		} else {

			var end = value.match(/(\+|-)\s*\d*(\.\d+)?\s*$/)
			if (end) {
				var number = (parseFloat( end[0] ) + amount)+''
				value = value.substr(0, end.index) + (number.substr(0,1)=='-'?'':'+') + trimFloatNumber(number)
			} else {
				value = trimFloatNumber(amount) +(value.substr(0,1)=='-'?'':'+')+ value
			}
		}
		this.set(axis, value)
		return value;
	}
	flip(axis) {
		if (!this.transform) return this;
		function negate(value) {
			if (!value || value === '0') {
				return value;
			}
			if (typeof value === 'number') {
				return -value;
			}
			var start = value.match(/^-?\s*\d*(\.\d+)?\s*(\+|-)/)
			if (start) {
				var number = parseFloat( start[0].substr(0, start[0].length-1) );
				return trimFloatNumber(-number) + value.substr(start[0].length-1);
			} else {
				return `-(${value})`;
			}
		}
		if (this.channel == 'rotation') {
			for (var i = 0; i < 3; i++) {
				if (i != axis) {
					let l = getAxisLetter(i)
					this.set(l, negate(this.get(l)))
				}
			}
		} else if (this.channel == 'position' || this.channel == 'scale') {
			let l = getAxisLetter(axis)
			this.set(l, negate(this.get(l)))
		}
		return this;
	}
	getLerp(other, axis, amount, allow_expression) {
		if (allow_expression && this.get(axis) === other.get(axis)) {
			return this.get(axis)
		} else {
			let calc = this.calc(axis)
			return calc + (other.calc(axis) - calc) * amount
		}
	}
	getArray() {
		var arr = [
			this.get('x'),
			this.get('y'),
			this.get('z'),
		]
		if (this.channel === 'rotation' && this.isQuaternion) {
			arr.push(this.get('w'))
		}
		return arr;
	}
	replaceOthers(save) {
		var scope = this;
		var arr = this.animator[this.channel];
		var replaced;
		arr.forEach(kf => {
			if (kf != scope && Math.abs(kf.time - scope.time) < 0.0001) {
				save.push(kf);
				kf.remove();
			}
		})
	}
	select(event) {
		var scope = this;
		if (Timeline.dragging_keyframes) {
			Timeline.dragging_keyframes = false
			return this;
		}
		if (!event || (!event.shiftKey && !event.ctrlOrCmd)) {
			Timeline.selected.forEach(function(kf) {
				kf.selected = false
			})
			Timeline.selected.length = 0
		}
		if (event && event.shiftKey && Timeline.selected.length) {
			var last = Timeline.selected[Timeline.selected.length-1]
			if (last && last.channel === scope.channel && last.animator == scope.animator) {
				Timeline.keyframes.forEach((kf) => {
					if (kf.channel === scope.channel &&
						kf.animator === scope.animator &&
						Math.isBetween(kf.time, last.time, scope.time) &&
						!kf.selected
					) {
						kf.selected = true
						Timeline.selected.push(kf)
					}
				})
			}
		}
		Timeline.selected.safePush(this);
		if (Timeline.selected.length == 1 && Timeline.selected[0].animator.selected == false) {
			Timeline.selected[0].animator.select()
		}

		var select_tool = true;
		Timeline.selected.forEach(kf => {
			if (kf.channel != scope.channel) select_tool = false;
		})
		this.selected = true
		TickUpdates.keyframe_selection = true;
		if (select_tool) {
			switch (this.channel) {
				case 'rotation': BarItems.rotate_tool.select(); break;
				case 'position': BarItems.move_tool.select(); break;
				case 'scale': BarItems.resize_tool.select(); break;
			}
		}
		return this;
	}
	callPlayhead() {
		Timeline.setTime(this.time)
		Animator.preview()
		return this;
	}
	showContextMenu(event) {
		if (!this.selected) {
			this.select();
		}
		this.menu.open(event, this);
		return this;
	}
	remove() {
		if (this.animator) {
			this.animator[this.channel].remove(this)
		}
		Timeline.selected.remove(this)
	}
	getUndoCopy(save) {
		var copy = {
			animator: save ? undefined : this.animator && this.animator.uuid,
			uuid: save && this.uuid,
			channel: this.channel,
			time: this.time,
			x: this.x,
			y: this.y,
			z: this.z,
		}
		if (this.transform) {
			copy.x = this.x;
			copy.y = this.y;
			copy.z = this.z;
			if (this.channel == 'rotation' && this.isQuaternion) {
				copy.w = this.w
			}
		} else if (this.channel == 'particle') {
			copy.effect = this.effect;
			copy.locator = this.locator;
			copy.script = this.script;

		} else if (this.channel == 'sound') {
			copy.effect = this.effect;
			copy.file = this.file;

		} else if (this.channel == 'timeline') {
			copy.instructions = this.instructions;
		}
		return copy;
	}
}
	Keyframe.prototype.menu = new Menu([
		//Quaternions have been removed in Bedrock 1.10.0
		/*
		{name: 'menu.keyframe.quaternion',
			icon: (keyframe) => (keyframe.isQuaternion ? 'check_box' : 'check_box_outline_blank'),
			condition: (keyframe) => keyframe.channel === 'rotation',
			click: function(keyframe) {
				keyframe.select()
				var state = !keyframe.isQuaternion
				Timeline.keyframes.forEach((kf) => {
					kf.isQuaternion = state
				})
				updateKeyframeSelection()
			}
		},*/
		'change_keyframe_file',
		'_',
		'copy',
		'delete',
	])
//Misc Functions
	function updateKeyframeValue(obj) {
		var axis = $(obj).attr('axis');
		var value = $(obj).val();
		Timeline.selected.forEach(function(kf) {
			kf.set(axis, value);
		})
		if (!['effect', 'locator', 'script'].includes(axis)) {
			Animator.preview();
		}
	}
	function updateKeyframeSelection() {
		var multi_channel = false;
		var channel = false;
		Timeline.selected.forEach((kf) => {
			if (channel === false) {
				channel = kf.channel
			} else if (channel !== kf.channel) {
				multi_channel = true
			}
		})
		$('.panel#keyframe .bar').hide();

		if (Timeline.selected.length && !multi_channel) {
			var first = Timeline.selected[0]

			$('#keyframe_type_label').text(tl('panel.keyframe.type', [tl('timeline.'+first.channel)] ))

			if (first.animator instanceof BoneAnimator) {
				function _gt(axis) {
					var n = first.get(axis);
					if (typeof n == 'number') return trimFloatNumber(n);
					return n;
				}
				$('#keyframe_bar_x, #keyframe_bar_y, #keyframe_bar_z').show();
				$('#keyframe_bar_w').toggle(first.channel === 'rotation' && first.isQuaternion)

				$('#keyframe_bar_x input').val(_gt('x'));
				$('#keyframe_bar_y input').val(_gt('y'));
				$('#keyframe_bar_z input').val(_gt('z'));
				if (first.channel === 'rotation' && first.isQuaternion) {
					$('#keyframe_bar_w input').val(_gt('w'));
				}
			} else if (first.channel == 'particle') {
				$('#keyframe_bar_effect').show();
				$('#keyframe_bar_effect input').val(first.get('effect'));
				$('#keyframe_bar_locator').show();
				$('#keyframe_bar_locator input').val(first.get('locator'));
				$('#keyframe_bar_script').show();
				$('#keyframe_bar_script input').val(first.get('script'));

			} else if (first.channel == 'sound') {
				$('#keyframe_bar_effect').show();
				$('#keyframe_bar_effect input').val(first.get('effect'));

			} else if (first.channel == 'timeline') {
				$('#keyframe_bar_instructions').show();
				$('#keyframe_bar_instructions textarea').val(first.get('instructions'));
			}
			BarItems.slider_keyframe_time.update()
		} else {
			$('#keyframe_type_label').text('')
			$('#keyframe_bar_x, #keyframe_bar_y, #keyframe_bar_z, #keyframe_bar_w').hide()
		}
		BARS.updateConditions()
	}
	function selectAllKeyframes() {
		if (!Animator.selected) return;
		var state = Timeline.selected.length !== Timeline.keyframes.length
		Timeline.keyframes.forEach((kf) => {
			if (state && !kf.selected) {
				Timeline.selected.push(kf)
			} else if (!state && kf.selected) {
				Timeline.selected.remove(kf)
			}
			kf.selected = state
		})
		updateKeyframeSelection()
	}
	function removeSelectedKeyframes() {
		Undo.initEdit({keyframes: Timeline.selected})
		var i = Timeline.keyframes.length;
		while (i > 0) {
			i--;
			let kf = Timeline.keyframes[i]
			if (Timeline.selected.includes(kf)) {
				kf.remove()
			}
		}
		updateKeyframeSelection()
		Animator.preview()
		Undo.finishEdit('remove keyframes')
	}
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
	animations: [],
	frame: 0,
	interval: false,
	join() {

		Animator.open = true;
		selected.length = 0
		Canvas.updateAllBones()

		if (quad_previews.enabled) {
			quad_previews.enabled_before = true
		}
		main_preview.fullscreen()
		main_preview.setNormalCamera()

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
			outlines.children.length = 0
			Canvas.updateAllPositions()
		}
		if (Animator.selected) {
			Animator.selected.select()
		} else if (Animator.animations.length) {
			Animator.animations[0].select()
		}
		if (isApp && !ModelMeta.animation_path && !Animator.animations.length && ModelMeta.export_path) {
			//Load
			findBedrockAnimation()
		}
	},
	leave() {
		Timeline.pause()
		Animator.open = false;
		$('body').removeClass('animation_mode')
		resizeWindow()
		updateInterface()
		Toolbars.element_origin.toPlace()
		if (quad_previews.enabled_before) {
			openQuadView()
		}
		Canvas.updateAllBones()
	},
	preview() {

		Group.all.forEach(group => {
			var bone = group.mesh;
			bone.rotation.copy(bone.fix_rotation)
			bone.position.copy(bone.fix_position)
			bone.scale.x = bone.scale.y = bone.scale.z = 1;

			Animator.animations.forEach(animation => {
				if (animation.playing) {
					animation.getBoneAnimator(group).displayFrame(Timeline.time)
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
		var json = autoParseJSON(file.content)
		if (json && typeof json.animations === 'object') {
			for (var ani_name in json.animations) {
				//Animation
				var a = json.animations[ani_name]
				var animation = new Animation({
					name: ani_name,
					loop: a.loop,
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
						var group = Group.all.findInArray('name', bone_name)
						if (group) {
							var ba = new BoneAnimator(group.uuid, animation);
							animation.animators[group.uuid] = ba;
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
			if (isApp && file.path) {
				ModelMeta.animation_path = file.path
			}
		}
	},
	buildFile(options) {
		if (typeof options !== 'object') {
			options = false
		}
		var animations = {}
		Animator.animations.forEach(function(a) {
			var ani_tag = animations[a.name] = {};
			if (a.getMaxLength() == 0 || a.loop) ani_tag.loop = true;
			if (a.length) ani_tag.animation_length = a.length;
			if (a.override) ani_tag.override_previous_animation = true;
			if (a.anim_time_update) ani_tag.anim_time_update = a.anim_time_update;
			ani_tag.bones = {};

			for (var uuid in a.animators) {
				var animator = a.animators[uuid];
				if (animator instanceof EffectAnimator) {

					animator.sound.forEach(kf => {
						if (!ani_tag.sound_effects) ani_tag.sound_effects = {};
						let timecode = Math.clamp(trimFloatNumber(Math.round(kf.time*60)/60), 0) + '';
						if (!timecode.includes('.')) {
							timecode += '.0';
						}
						ani_tag.sound_effects[timecode] = {
							effect: kf.effect
						};
					})
					animator.particle.forEach(kf => {
						if (!ani_tag.particle_effects) ani_tag.particle_effects = {};
						let timecode = Math.clamp(trimFloatNumber(Math.round(kf.time*60)/60), 0) + '';
						if (!timecode.includes('.')) {
							timecode += '.0';
						}
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
						let timecode = Math.clamp(trimFloatNumber(Math.round(kf.time*60)/60), 0) + '';
						if (!timecode.includes('.')) {
							timecode += '.0';
						}
						ani_tag.timeline[timecode] = kf.instructions.split('\n');
					})

				} else if (a.animators[uuid].keyframes.length && a.animators[uuid].group) {

					var group = a.animators[uuid].group; 
					var bone_tag = ani_tag.bones[group.name] = {};
					var channels = {};
					//Saving Keyframes
					a.animators[uuid].keyframes.forEach(function(kf) {
						if (!channels[kf.channel]) {
							channels[kf.channel] = {};
						}
						let timecode = Math.clamp(trimFloatNumber(Math.round(kf.time*60)/60), 0) + '';
						if (!timecode.includes('.')) {
							timecode = timecode + '.0';
						}
						channels[kf.channel][timecode] = kf.getArray()
					})
					//Sorting keyframes
					for (var channel in Animator.possible_channels) {
						if (channels[channel]) {
							let timecodes = Object.keys(channels[channel])
							if (timecodes.length === 1) {
								bone_tag[channel] = channels[channel][timecodes[0]]
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
		})
		return {
			format_version: '1.8.0',
			animations: animations
		}
	}
}
const Timeline = {
	animators: [],
	selected: [],//frames
	playing_sounds: [],
	playback_speed: 100,
	time: 0,
	get second() {return Timeline.time},
	playing: false,
	selector: {
		start: [0, 0],
		selecting: false,
		selected_before: [],
		down(e) {
			if (e.which !== 1 || (
				!e.target.classList.contains('keyframe_section') &&
				!e.target.classList.contains('animator_head_bar') &&
				e.target.id !== 'timeline_body_inner'
			)) {
				return
			};

			Timeline.selector.interval = setInterval(Timeline.selector.move, 1000/60);
			document.addEventListener('mouseup', Timeline.selector.end, false);

			var offset = $('#timeline_body_inner').offset();
			var R = Timeline.selector;
			R.panel_offset = [
				offset.left,
				offset.top,
			]
			R.start = [
				e.clientX - R.panel_offset[0],
				e.clientY - R.panel_offset[1],
			]
			if (e.shiftKey) {
				Timeline.selector.selected_before = Timeline.selected.slice();
			}
			R.selecting = true;
			$('#timeline_selector').show()
			Timeline.selector.move(e)
		},
		move(e) {
			var R = Timeline.selector;
			if (!R.selecting) return;
			//CSS
			var offset = $('#timeline_body_inner').offset();
			R.panel_offset = [
				offset.left,
				offset.top,
			]
			var rect = getRectangle(R.start[0], R.start[1], mouse_pos.x - R.panel_offset[0], mouse_pos.y - R.panel_offset[1])
			$('#timeline_selector')
				.css('width', rect.x + 'px')
				.css('height', rect.y + 'px')
				.css('left', rect.ax + 'px')
				.css('top', rect.ay + 'px');
			//Keyframes
			var epsilon = 6;
			var focus = Timeline.vue._data.focus_channel;
			rect.ax -= epsilon;
			rect.ay -= epsilon;
			rect.bx += epsilon;
			rect.by += epsilon;

			var min_time = (rect.ax-Timeline.vue._data.head_width-8)/Timeline.vue._data.size;
			var max_time = (rect.bx-Timeline.vue._data.head_width-8)/Timeline.vue._data.size;

			Timeline.selected.length = 0;
			for (var animator of Timeline.animators) {
				var node = $('#timeline_body_inner .animator[uuid=' + animator.uuid + ']').get(0)
				var offset = node && node.offsetTop;
				for (var kf of animator.keyframes) {
					if (Timeline.selector.selected_before.includes(kf)) {
						Timeline.selected.push(kf);
						continue;
					}
					kf.selected = false;
					if (kf.time > min_time &&
						kf.time < max_time &&
						(kf.channel == focus || !focus)
					) {
						var channel_index = focus ? 0 : animator.channels.indexOf(kf.channel);
						height = offset + channel_index*24 + 36;
						if (height > rect.ay && height < rect.by) {
							kf.selected = true;
							Timeline.selected.push(kf);
						}
					}
				}
			}
			//Scroll body
			var body = $('#timeline_body').get(0)
			var body_inner = $('#timeline_body_inner').get(0)

			var top = mouse_pos.y - R.panel_offset[1] - body.scrollTop;
			var bot = body.scrollTop + body.clientHeight - (mouse_pos.y - R.panel_offset[1]);
			var lef = mouse_pos.x - R.panel_offset[0] - body.scrollLeft - Timeline.vue._data.head_width;
			var rig = body.clientWidth - (mouse_pos.x - R.panel_offset[0] - body.scrollLeft);

			if (top < 0) body.scrollTop  = body.scrollTop  - 5;
			if (bot < 0) body.scrollTop  = Math.clamp(body.scrollTop  + 5, 0, body_inner.clientHeight - body.clientHeight + 3);
			if (lef < 0) body.scrollLeft = body.scrollLeft - 5;
			if (rig < 0) body.scrollLeft = Math.clamp(body.scrollLeft + 5, 0, body_inner.clientWidth - body.clientWidth);
		},
		end(e) {
			if (!Timeline.selector.selecting) return false;
			e.stopPropagation();
			document.removeEventListener('mousemove', Timeline.selector.move);
			clearInterval(Timeline.selector.interval);
			document.removeEventListener('mouseup', Timeline.selector.end);

			updateKeyframeSelection()
			Timeline.selector.selected_before.empty();
			Timeline.selector.selecting = false;
			$('#timeline_selector')
				.css('width', 0)
				.css('height', 0)
				.hide()
		},
	},
	setTime(seconds, editing) {
		seconds = limitNumber(seconds, 0, 1000)
		Timeline.vue._data.playhead = seconds
		Timeline.time = seconds
		if (!editing) {
			Timeline.setTimecode(seconds)
		}
		Timeline.updateSize()
		//Scroll
		var scroll = $('#timeline_body').scrollLeft()
		var playhead = Timeline.time * Timeline.vue._data.size + 8
		if (playhead < scroll || playhead > scroll + $('#timeline_body').width() - Timeline.vue._data.head_width) {
			$('#timeline_body').scrollLeft(playhead-16)
		}
	},
	setTimecode(time) {
		let m = Math.floor(time/60)
		let s = Math.floor(time%60)
		let f = Math.floor((time%1) * 100)
		if ((s+'').length === 1) {s = '0'+s}
		if ((f+'').length === 1) {f = '0'+f}
		$('#timeline_corner').text(m + ':' + s  + ':' + f)
	},
	snapTime(time) {
		//return time;
		if (time == undefined || isNaN(time)) {
			time = Timeline.time;
		}
		var fps = Math.clamp(settings.animation_snap.value, 1, 120);
		return Math.clamp(Math.round(time*fps)/fps, 0);
	},
	getStep() {
		return 1/Math.clamp(settings.animation_snap.value, 1, 120);
	},
	setup() {
		$('#timeline_body').mousedown(Timeline.selector.down)

		$('#timeline_time').on('mousedown touchstart', e => {
			if (e.which !== 1 && !event.changedTouches) return;
			if (e.target.classList.contains('timeline_marker')) return;
			convertTouchEvent(e);
			Timeline.dragging_playhead = true;
			let time = (e.offsetX) / Timeline.vue._data.size
			Timeline.setTime(Timeline.snapTime(time))
			Animator.preview()
		})
		$(document).on('mousemove touchmove', e => {
			if (Timeline.dragging_playhead) {
				convertTouchEvent(e);
				let offset = e.clientX - $('#timeline_time').offset().left;
				let time = Timeline.snapTime(offset / Timeline.vue._data.size)
				if (Timeline.time != time) {
					Timeline.setTime(time)
					Animator.preview()
				}
			}
		})
		.on('mouseup touchend', e => {
			if (Timeline.dragging_playhead) {
				delete Timeline.dragging_playhead
				Timeline.pause();
			}
		})
		//Keyframe inputs
		$('.keyframe_input').click(e => {
			Undo.initEdit({keyframes: Timeline.selected})
		}).focusout(e => {
			Undo.finishEdit('edit keyframe')
		})
		//Enter Time
		$('#timeline_corner').click(e => {
			if ($('#timeline_corner').attr('contenteditable') == 'true') return;

			$('#timeline_corner').attr('contenteditable', true).focus().select()
			var times = $('#timeline_corner').text().split(':')
			while (times.length < 3) {
				times.push('00')
			}
			var node = $('#timeline_corner').get(0).childNodes[0]
			var selection = window.getSelection();        
			var range = document.createRange();

			var sel = [0, node.length]
			if (e.offsetX < 24) {
				sel = [0, times[0].length]
			} else if (e.offsetX < 54) {
				sel = [times[0].length+1, times[1].length]
			} else if (e.offsetX < 80) {
				sel = [times[0].length+times[1].length+2, times[2].length]
			}
			sel[1] = limitNumber(sel[0]+sel[1], sel[0], node.length)

			range.setStart(node, sel[0])
			range.setEnd(node, sel[1])
			selection.removeAllRanges();
			selection.addRange(range);
		})
		.on('focusout keydown', e => {
			if (e.type === 'focusout' || Keybinds.extra.confirm.keybind.isTriggered(e) || Keybinds.extra.cancel.keybind.isTriggered(e)) {
				$('#timeline_corner').attr('contenteditable', false)
				Timeline.setTimecode(Timeline.time)
			}
		})
		.on('keyup', e => {
			var times = $('#timeline_corner').text().split(':')
			times.forEach((t, i) => {
				times[i] = parseInt(t)
				if (isNaN(times[i])) {
					times[i] = 0
				}
			})
			while (times.length < 3) {
				times.push(0)
			}
			var seconds
				= times[0]*60
				+ limitNumber(times[1], 0, 59)
				+ limitNumber(times[2]/100, 0, 99)
			if (Math.abs(seconds-Timeline.time) > 1e-3 ) {
				Timeline.setTime(seconds, true)
				Animator.preview()
			}
		})

		$('#timeline_vue').on('mousewheel', function() {
			var body = $('#timeline_body').get(0)
			if (event.shiftKey) {
				body.scrollLeft += event.deltaY/4
			} else if  (event.ctrlOrCmd) {
				var offset = 1 - event.deltaY/600
				Timeline.vue._data.size = limitNumber(Timeline.vue._data.size * offset, 10, 1000)
				body.scrollLeft *= offset
				let l = (event.offsetX / body.clientWidth) * 500 * (event.deltaY<0?1:-0.2)
				body.scrollLeft += l
			} else {
				body.scrollTop += event.deltaY/6.25
			}
			Timeline.updateSize()
			event.preventDefault();
		});
		$('#timeline_body').on('scroll', e => {
			Timeline.vue._data.scroll_left = $('#timeline_body').scrollLeft()||0;
		})

		BarItems.slider_animation_speed.update()
		Timeline.is_setup = true
		Timeline.setTime(0)
	},
	update() {
		//Draggable
		$('#timeline_body .keyframe:not(.ui-draggable)').draggable({
			axis: 'x',
			distance: 4,
			helper: () => $('<div></div>'),
			start: function(event, ui) {

				var id = $(event.target).attr('id');
				var clicked = Timeline.keyframes.findInArray('uuid', id)

				if (!$(event.target).hasClass('selected') && !event.shiftKey && Timeline.selected.length != 0) {
					clicked.select()
				} else if (clicked && !clicked.selected) {
					clicked.select({shiftKey: true})
				}

				Undo.initEdit({keyframes: Timeline.selected})
				Timeline.dragging_keyframes = true;

				var i = 0;
				for (var kf of Timeline.selected) {
					kf.time_before = kf.time
				}
			},
			drag: function(event, ui) {
				var difference = (ui.position.left - ui.originalPosition.left - 8) / Timeline.vue._data.size;
				var id = $(ui.helper).attr('id')
				var snap_value = false
				var nearest

				for (var kf of Timeline.selected) {
					var t = limitNumber(kf.time_before + difference, 0, 256)
					if (kf.uuid === id) {
						ui.position.left = t * Timeline.vue._data.size + 8
					}
					kf.time = Timeline.snapTime(t);
				}
				BarItems.slider_keyframe_time.update()
				Animator.preview()
			},
			stop: function(event, ui) {
				var deleted = []
				for (var kf of Timeline.selected) {
					delete kf.time_before;
					kf.replaceOthers(deleted);
				}
				Undo.addKeyframeCasualties(deleted);
				Undo.finishEdit('drag keyframes')
			}
		})
		$('#timeline_body .keyframe:not(.ui-draggable)').draggable({
			axis: 'x',
			distance: 4,
			helper: () => $('<div></div>'),
			start: function(event, ui) {

				var id = $(event.target).attr('id');
				var clicked = Timeline.keyframes.findInArray('uuid', id)

				if (!$(event.target).hasClass('selected') && !event.shiftKey && Timeline.selected.length != 0) {
					clicked.select()
				} else if (clicked && !clicked.selected) {
					clicked.select({shiftKey: true})
				}

				Undo.initEdit({keyframes: Timeline.selected})
				Timeline.dragging_keyframes = true;

				var i = 0;
				for (var kf of Timeline.selected) {
					kf.time_before = kf.time
				}
			},
			drag: function(event, ui) {
				var difference = (ui.position.left - ui.originalPosition.left - 8) / Timeline.vue._data.size;
				var id = $(ui.helper).attr('id')
				var snap_value = false
				var nearest

				for (var kf of Timeline.selected) {
					var t = limitNumber(kf.time_before + difference, 0, 256)
					if (kf.uuid === id) {
						ui.position.left = t * Timeline.vue._data.size + 8
					}
					kf.time = Timeline.snapTime(t);
				}
				BarItems.slider_keyframe_time.update()
				Animator.preview()
			},
			stop: function(event, ui) {
				var deleted = []
				for (var kf of Timeline.selected) {
					delete kf.time_before;
					kf.replaceOthers(deleted);
				}
				Undo.addKeyframeCasualties(deleted);
				Undo.finishEdit('drag keyframes')
			}
		})
	},
	updateSize() {
		let size = Timeline.vue._data.size
		var max_length = ($('#timeline_body').width()-8) / Timeline.vue._data.size;
		Timeline.keyframes.forEach((kf) => {
			max_length = Math.max(max_length, kf.time)
		})
		max_length = Math.max(max_length, Timeline.time) + 50/Timeline.vue._data.size
		Timeline.vue._data.length = max_length
		Timeline.vue._data.timecodes.length = 0

		var step = 1
		if (size < 1) {step = 1}
		else if (size < 20) {step = 4}
		else if (size < 40) {step = 2}
		else if (size < 90) {step = 1}
		else if (size < 180) {step = 0.5}
		else if (size < 400) {step = 0.2}
		else if (size < 800) {step = 0.1}
		else {step = 0.05}

		if (step < 1) {
			var FPS = Timeline.getStep();
			step = Math.round(step/FPS) * FPS
			step = 1/Math.round(1/step)
		}

		var i = 0;
		while (i < Timeline.vue._data.length) {
			Timeline.vue._data.timecodes.push({
				time: i,
				text: Math.round(i*100)/100
			})
			i += step;
		}
	},
	updateScroll(e) {
		$('.channel_head').css('left', scroll_amount+'px')
		$('#timeline_time').css('left', -scroll_amount+'px')
	},
	unselect(e) {
		if (!Animator.selected) return;
		Timeline.keyframes.forEach((kf) => {
			if (kf.selected) {
				Timeline.selected.remove(kf)
			}
			kf.selected = false
		})
		TickUpdates.keyframe_selection = true;
	},
	start() {
		if (!Animator.selected) return;
		Animator.selected.getMaxLength()
		Timeline.pause()
		Timeline.playing = true
		BarItems.play_animation.setIcon('pause')
		Timeline.loop()
	},
	loop() {
		Animator.preview()
		if (Animator.selected && Timeline.time < (Animator.selected.length||1e3)) {
			
			Animator.interval = setTimeout(Timeline.loop, 100/6)
			Timeline.setTime(Timeline.time + (1/60) * (Timeline.playback_speed/100))
		} else {
			Timeline.setTime(0)
			if (Animator.selected && Animator.selected.loop) {
				Timeline.start()
			} else {
				Timeline.pause()
			}
		}
	},
	pause() {
		Timeline.playing = false;
		BarItems.play_animation.setIcon('play_arrow')
		if (Animator.interval) {
			clearInterval(Animator.interval)
			Animator.interval = false
		}
		Timeline.playing_sounds.forEach(media => {
			if (!media.paused) {
				media.pause();
			}
		})
		Timeline.playing_sounds.empty();
	},
	get keyframes() {
		var keyframes = [];
		Timeline.animators.forEach(animator => {
			keyframes = [...keyframes, ...animator.keyframes]
		})
		return keyframes;
	},
	showMenu(event) {
		if (event.target.nodeName == 'KEYFRAME' || event.target.parentElement.nodeName == 'KEYFRAME') return;
		Timeline.menu.open(event, event);
	},
	menu: new Menu([
		'paste',
		'_',
		'select_all',
		'bring_up_all_animations',
		'clear_timeline',
	])
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
		[key, val] = inputs[i].replace(/[\s;]/g, '').split('=')
		if (key === variable) {
			return Molang.parse(val)
		}
		i++;
	}
}

onVueSetup(function() {
	Animator.vue = new Vue({
		el: '#animations_list',
		data: {
			animations: Animator.animations
		},
		methods: {
			sort(event) {
				var item = Animator.animations.splice(event.oldIndex, 1)[0];
				Animator.animations.splice(event.newIndex, 0, item);
			}
		}
	})
	Timeline.vue = new Vue({
		el: '#timeline_vue',
		data: {
			size: 150,
			length: 10,
			scroll_left: 0,
			head_width: 170,
			timecodes: [],
			animators: Timeline.animators,
			markers: [],
			focus_channel: null,
			playhead: Timeline.time
		},
		methods: {
			toggleAnimator(animator) {
				animator.expanded = !animator.expanded;
			},
			removeAnimator(animator) {
				Timeline.animators.remove(animator);
			}
		}
	})
})
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
	new Action('play_animation', {
		icon: 'play_arrow',
		category: 'animation',
		keybind: new Keybind({key: 32}),
		condition: {modes: ['animate']},
		click: function () {
			
			if (!Animator.selected) {
				Blockbench.showQuickMessage('message.no_animation_selected')
				return;
			}
			if (Timeline.playing) {
				Timeline.pause()
			} else {
				Timeline.start()
			}
		}
	})
	new NumSlider('slider_animation_length', {
		category: 'animation',
		condition: () => Animator.open && Animator.selected,
		get: function() {
			return Animator.selected.length
		},
		change: function(modify) {
			Animator.selected.length = limitNumber(modify(Animator.selected.length), 0, 1e4)
		}
	})
	new NumSlider('slider_animation_speed', {
		category: 'animation',
		condition: {modes: ['animate']},
		get: function() {
			return Timeline.playback_speed;
		},
		change: function(modify) {
			Timeline.playback_speed = limitNumber(modify(Timeline.playback_speed), 0, 10000)
		},
		getInterval: (e) => {
			var val = BarItems.slider_animation_speed.get()
			if (e.shiftKey) {
				if (val < 50) {
					return 10;
				} else {
					return 50;
				}
			}
			if (e.ctrlOrCmd) {
				if (val < 500) {
					return 1;
				} else {
					return 10;
				}
			}
			if (val < 10) {
				return 1;
			} else if (val < 50) {
				return 5;
			} else if (val < 160) {
				return 10;
			} else if (val < 300) {
				return 20;
			} else if (val < 1000) {
				return 50;
			} else {
				return 500;
			}
		}
	})
	new NumSlider('slider_keyframe_time', {
		category: 'animation',
		condition: () => Animator.open && Timeline.selected.length,
		get: function() {
			return Timeline.selected[0] ? Timeline.selected[0].time : 0
		},
		change: function(modify) {
			Timeline.selected.forEach((kf) => {
				kf.time = Timeline.snapTime(limitNumber(modify(kf.time), 0, 1e4))
			})
			Animator.preview()
		},
		onBefore: function() {
			Undo.initEdit({keyframes: Timeline.selected})
		},
		onAfter: function() {
			Undo.finishEdit('move keyframes')
		}
	})
	/*
	new BarSlider('volume', {
		category: 'animation',
		min: 0, max: 100, step: 5, width: 80,
		onChange: function(slider) {
			Animator.volume = slider.get();
		}
	})*/
	new Action('reset_keyframe', {
		icon: 'replay',
		category: 'animation',
		condition: () => Animator.open && Timeline.selected.length,
		click: function () {
			Undo.initEdit({keyframes: Timeline.selected})
			Timeline.selected.forEach((kf) => {
				var n = kf.channel === 'scale' ? 1 : 0;
				kf.extend({
					x: n,
					y: n,
					z: n,
					w: kf.isQuaternion ? 0 : undefined
				})
			})
			Undo.finishEdit('reset keyframes')
			updateKeyframeSelection()
			Animator.preview()
		}
	})
	new Action('change_keyframe_file', {
		icon: 'fa-file-audio',
		category: 'animation',
		condition: () => (Animator.open && Timeline.selected.length && Timeline.selected[0].channel == 'sound' && isApp),
		click: function () {
			Blockbench.import({
				extensions: ['ogg'],
				type: 'Audio File',
				startpath: Timeline.selected[0].file
			}, function(files) {

				Undo.initEdit({keyframes: Timeline.selected})
				Timeline.selected.forEach((kf) => {
					if (kf.channel == 'sound') {
						kf.file = files[0].path;
					}
				})
				Undo.finishEdit('changed keyframe audio file')
			})
		}
	})
	new Action('reverse_keyframes', {
		icon: 'swap_horizontal_circle',
		category: 'animation',
		condition: () => Animator.open && Timeline.selected.length,
		click: function () {
			var start = 1e9;
			var end = 0;
			Timeline.selected.forEach((kf) => {
				start = Math.min(start, kf.time);
				end = Math.max(end, kf.time);
			})
			Undo.initEdit({keyframes: Timeline.selected})
			Timeline.selected.forEach((kf) => {
				kf.time = end + start - kf.time;
			})
			Undo.finishEdit('reverse keyframes')
			updateKeyframeSelection()
			Animator.preview()
		}
	})

	new Action('previous_keyframe', {
		icon: 'fa-arrow-circle-left',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function () {

			var time = Timeline.time;
			function getDelta(kf, abs) {
				return kf.time - time
			}
			let animator = Timeline.selected_animator
						|| (Timeline.selected[0] && Timeline.selected[0].animator)
						|| Timeline.animators[0];
			let channel = Timeline.selected[0] ? Timeline.selected[0].channel : (animator && animator.channels[0]);
			
			var matches = []
			for (var kf of Timeline.keyframes) {
				if ((!animator || animator == kf.animator) && (!channel || channel == kf.channel)) {
					let delta = getDelta(kf)
					if (delta < 0) {
						matches.push(kf)
					}
				}
			}
			matches.sort((a, b) => {
				return Math.abs(getDelta(a)) - Math.abs(getDelta(b))
			})
			var kf = matches[0]
			if (kf) {
				kf.select().callPlayhead()
			} else {
				if (Timeline.selected.length) {
					selectAllKeyframes()
					selectAllKeyframes()
				}
				Timeline.setTime(0)
				Animator.preview()
			}
		}
	})
	new Action('next_keyframe', {
		icon: 'fa-arrow-circle-right',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function () {

			var time = Timeline.time;
			function getDelta(kf, abs) {
				return kf.time - time
			}
			let animator = Timeline.selected_animator
						|| (Timeline.selected[0] && Timeline.selected[0].animator)
						|| Timeline.animators[0];
			let channel = Timeline.selected[0] ? Timeline.selected[0].channel : (animator && animator.channels[0]);

			var matches = []
			for (var kf of Timeline.keyframes) {
				if ((!animator || animator == kf.animator) && (!channel || channel == kf.channel)) {
					let delta = getDelta(kf)
					if (delta > 0) {
						matches.push(kf)
					}
				}
			}
			matches.sort((a, b) => {
				return Math.abs(getDelta(a)) - Math.abs(getDelta(b))
			})
			var kf = matches[0]
			if (kf) {
				kf.select().callPlayhead()
			}
		}
	})

	new Action('move_keyframe_back', {
		icon: 'arrow_back',
		category: 'transform',
		condition: {modes: ['animate'], method: () => (!open_menu && Timeline.selected.length)},
		keybind: new Keybind({key: 37}),
		click: function (e) {
			Undo.initEdit({keyframes: Timeline.selected})
			Timeline.selected.forEach((kf) => {
				kf.time = Timeline.snapTime(limitNumber(kf.time - Timeline.getStep(), 0, 1e4))
			})
			Animator.preview()
			Undo.finishEdit('move keyframes')
		}
	})
	new Action('move_keyframe_forth', {
		icon: 'arrow_forward',
		category: 'transform',
		condition: {modes: ['animate'], method: () => (!open_menu && Timeline.selected.length)},
		keybind: new Keybind({key: 39}),
		click: function (e) {
			Undo.initEdit({keyframes: Timeline.selected})
			Timeline.selected.forEach((kf) => {
				kf.time = Timeline.snapTime(limitNumber(kf.time + Timeline.getStep(), 0, 1e4))
			})
			Animator.preview()
			Undo.finishEdit('move keyframes')
		}
	})

	new Action('add_keyframe', {
		icon: 'add_circle',
		category: 'animation',
		condition: {modes: ['animate']},
		keybind: new Keybind({key: 81, shift: null}),
		click: function (event) {
			var animator = Timeline.selected_animator;
			if (!animator) return;
			var channel = animator.channels[0];
			if (Toolbox.selected.id == 'rotate_tool' && animator.channels.includes('rotation')) channel = 'rotation';
			if (Toolbox.selected.id == 'move_tool' && animator.channels.includes('position')) channel = 'position';
			if (Toolbox.selected.id == 'resize_tool' && animator.channels.includes('scale')) channel = 'scale';
			animator.createKeyframe((event && event.shiftKey) ? {} : null, Timeline.time, channel, true);
			if (event && event.shiftKey) {
				Animator.preview();
			}
		}
	})

	new Action('add_marker', {
		icon: 'flag',
		category: 'animation',
		condition: {modes: ['animate']},
		keybind: new Keybind({key: 77}),
		click: function (event) {
			if (!Animator.selected) {
				Blockbench.showQuickMessage('message.no_animation_selected')
				return;
			}
			var time = Timeline.snapTime();
			var original_marker;
			for (var m of Animator.selected.markers) {
				if (Math.abs(m.time - time) < 0.01) {
					original_marker = m;
					break;
				}
			}
			if (original_marker) {
				Animator.selected.markers.remove(original_marker);
			} else {
				let marker = new TimelineMarker({time});
				Animator.selected.markers.push(marker);
			}
		}
	})

	new Action('bring_up_all_animations', {
		icon: 'fa-sort-amount-up',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function () {
			for (var uuid in Animator.selected.animators) {
				var ba = Animator.selected.animators[uuid]
			    if (ba && ba.keyframes.length) {
			        ba.addToTimeline();
			    }
			}

		}
	})
	new Action('clear_timeline', {
		icon: 'clear_all',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function () {
			Timeline.vue._data.animators.purge();
			unselectAll();
		}
	})
	new Action('select_effect_animator', {
		icon: 'fa-magic',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function () {
			if (!Animator.selected) return;
			if (!Animator.selected.animators.effects) {
				var ea = Animator.selected.animators.effects = new EffectAnimator(Animator.selected);
			}
			Animator.selected.animators.effects.select()
		}
	})
	new BarSelect('timeline_focus', {
		options: {
			all: true,
			rotation: tl('timeline.rotation'),
			position: tl('timeline.position'),
			scale: tl('timeline.scale'),
		},
		onChange: function(slider) {
			var val = slider.get();
			Timeline.vue._data.focus_channel = val != 'all' ? val : null;
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
