class Animation {
	constructor(data) {
		this.name = '';
		this.uuid = guid()
		this.loop = true;
		this.override = false;
		this.selected = false;
		this.anim_time_update = '';
		this.length = 0
		this.bones = {
			//uuid: BoneAnimator
		}
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
		return this;
	}
	undoCopy() {
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
		if (this.bones.length) {
			copy.bones = {}
			for (var uuid in this.bones) {
				var kfs = this.bones[uuid].keyframes
				if (kfs && kfs.length) {
					var kfs_copy = copy.bones[uuid] = []
					kfs.forEach(kf => {
						kfs_copy.push(kf.undoCopy())
					})
				}
			}
		}
		return copy;
	}
	select() {
		var scope = this;
		var selected_bone = selected_group
		Animator.animations.forEach(function(a) {
			a.selected = false;
		})
		Prop.active_panel = 'animations'
		this.selected = true
		Animator.selected = this
		unselectAll()
		BarItems.slider_animation_length.update()

		function iterate(arr) {
			arr.forEach((it) => {
				if (it.type === 'group') {
					Animator.selected.getBoneAnimator(it)
					if (it.children && it.children.length) {
						iterate(it.children)
					}
				}
			})
		}
		iterate(TreeElements)

		if (selected_bone) {
			selected_bone.select()
		}
		Animator.preview()
		return this;
	}
	rename() {
		var scope = this;
		Blockbench.textPrompt('message.rename_animation', this.name, function(name) {
			if (name) {
				scope.name = name
			}
		})
		return this;
	}
	editUpdateVariable() {
		var scope = this;
		Blockbench.textPrompt('message.animation_update_var', this.anim_time_update, function(name) {
			if (name) {
				scope.anim_time_update = name
			}
		})
		return this;
	}
	showContextMenu(event) {
		this.select();
		this.menu.open(event, this);
		return this;
	}
	getBoneAnimator(group) {
		if (!group && selected_group) {
			group = selected_group
		} else if (!group) {
			return;
		}
		var uuid = group.uuid
		if (!this.bones[uuid]) {
			var ba = this.bones[uuid] = new BoneAnimator()
			ba.uuid = uuid
		}
		return this.bones[uuid];
	}
	displayFrame(time) {
		for (var uuid in this.bones) {
			this.bones[uuid].displayFrame(time)
		}
		if (selected_group) {
			centerTransformer()
		}
	}
	add() {
		if (!Animator.animations.includes(this)) {
			Animator.animations.push(this)
		}
		return this;
	}
	remove() {
		if (Animator.selected === this) {
			Animator.selected = false
		}
		Animator.animations.remove(this)
		return this;
	}
	getMaxLength() {
		var len = this.length||0

		for (var uuid in this.bones) {
			var bone = this.bones[uuid]
			var i = 0;
			while (i < bone.keyframes.length) {
				len = Math.max(len, bone.keyframes[i].time)
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
		{name: 'generic.rename', icon: 'text_format', click: function(animation) {
			animation.rename()
		}},
		{name: 'menu.animation.loop', icon: (a) => (a.loop?'check_box':'check_box_outline_blank'), click: function(animation) {
			animation.loop = !animation.loop
		}},
		{name: 'menu.animation.override', icon: (a) => (a.override?'check_box':'check_box_outline_blank'), click: function(animation) {
			animation.override = !animation.override
		}},
		{name: 'menu.animation.anim_time_update', icon: 'update', click: function(animation) {
			animation.editUpdateVariable()
		}},
		{name: 'generic.delete', icon: 'delete', click: function(animation) {
			animation.remove()
		}},
		/*
			rename
			Loop: checkbox
			Override: checkbox
			anim_time_update:
				WalkPosition
			delete
		*/
	])
class BoneAnimator {
	constructor() {
		this.keyframes = []
		this.uuid;
	}
	getGroup() {
		this.group = TreeElements.findRecursive('uuid', this.uuid)
		if (!this.group) {
			console.log('no group found for '+this.uuid)
		}
		return this.group
	}
	addKeyframe(values, time, channel) {
		var keyframe = new Keyframe({
			time: time,
			channel: channel
		})
		if (values && typeof values === 'object') {
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
				x: values
			})
		} else {
			var ref = this.interpolate(time, channel, true)
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
		}
		this.keyframes.push(keyframe)
		keyframe.parent = this;
		return keyframe;
	}
	pushKeyframe(keyframe) {
		this.keyframes.push(keyframe)
		keyframe.parent = this;
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
		bone.rotation.copy(bone.fix_rotation)

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
		bone.position.copy(bone.fix_position)
		if (arr) {
			bone.position.add(new THREE.Vector3().fromArray(arr))
		}
		return this;
	}
	displayScale(arr) {
		var bone = this.group.mesh
		if (arr) {
			bone.scale.x = bone.scale.y = bone.scale.z = arr[0] ? arr[0] : 0.00001
		} else {
			bone.scale.x = bone.scale.y = bone.scale.z = 1
		}
		return this;
	}
	interpolate(time, channel, allow_expression) {
		var i = 0;
		var before = false
		var after = false
		var result = false
		while (i < this.keyframes.length) {
			var keyframe = this.keyframes[i]

			if (keyframe.channel !== channel) {
			} else if (keyframe.time < time) {

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
			result = [
				before.getLerp(after, 'x', alpha, allow_expression)
			]
			if (before.channel !== 'scale')	{
				result[1] = before.getLerp(after, 'y', alpha, allow_expression)
				result[2] = before.getLerp(after, 'z', alpha, allow_expression)
			}
			if (before.isQuaternion && after.isQuaternion) {
				result[3] = before.getLerp(after, 'q', alpha, allow_expression)
			}
		}
		if (result && result.type === 'keyframe') {
			let keyframe = result
			let method = allow_expression ? 'get' : 'calc'
			result = [
				keyframe[method]('x')
			]
			if (keyframe.channel !== 'scale')	{
				result[1] = keyframe[method]('y')
				result[2] = keyframe[method]('z')
			}
			if (keyframe.isQuaternion)	 	{
				result[3] = keyframe[method]('w')
			}
		}
		return result
	}
	displayFrame(time) {
		if (!this.doRender()) return;
		this.getGroup()
		for (var channel in Animator.possible_channels) {
			var result = this.interpolate(time, channel)
			if (channel === 'rotation') {
				this.displayRotation(result)
			} else if (channel === 'position') {
				this.displayPosition(result)
			} else if (channel === 'scale') {
				this.displayScale(result)
			}
		}
		this.group.mesh.updateMatrixWorld()
	}
	select() {
		var duplicates;
		function iterate(arr) {
			arr.forEach((it) => {
				if (it.type === 'group' && !duplicates) {
					if (it.name === selected_group.name && it !== selected_group) {
						duplicates = true
					} else if (it.children && it.children.length) {
						iterate(it.children)
					}
				}
			})
		}
		iterate(TreeElements)
		if (duplicates) {
			Blockbench.showMessageBox({
				translateKey: 'duplicate_groups',
				icon: 'folder',
				buttons: [tl('dialog.ok')],
			})
		}
		Timeline.animator = this;
		Timeline.keyframes.forEach(function(kf) {
			kf.selected = false
		})
		Timeline.selected.length = 0
		Timeline.keyframes = Timeline.vue._data.keyframes = this.keyframes
		if (this.keyframes[0]) {
			this.keyframes[0].select()
		} else {
			updateKeyframeSelection()
		}
		if (this.group && this.group.parent && this.group.parent !== 'root') {
			this.group.parent.openUp()
		}
		Vue.nextTick(Timeline.update)
		return this;
	}
}
class Keyframe {
	constructor(data) {
		this.type = 'keyframe'
		this.channel = 'rotation'//, 'position', 'scale'
		this.channel_index = 0;
		this.time = 0;
		this.selected = 0;
		this.x = '0';
		this.y = '0';
		this.z = '0';
		this.w = '0';
		this.isQuaternion = false;
		this.uuid = guid()
		if (typeof data === 'object') {
			this.extend(data)
			if (this.channel === 'scale' && data.x === undefined) {
				this.x = 1
			}
		}
	}
	get(axis) {
		if (!this[axis]) {
			return 0;
		} else if (!isNaN(this[axis])) {
			return parseFloat(this[axis])
		} else {
			return this[axis]
		}
	}
	calc(axis) {
		return parseMolang(this[axis])
	}
	set(axis, value) {
		if (axis === 'x' || axis === 'y' || axis === 'z' || axis === 'w') {
			this[axis] = value
		}
		return this;
	}
	offset(axis, amount) {
		var value = this.get(axis)
		if (!value || value === '0') {
			this.set(axis, amount)
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

		/*
		function iterate(string, index) {
			if (!isNaN(string)) {
				return [index, string.length]
			}
			var splices = splitUpMolang(string, ['+', '-'])
			if (!splices) return false;

			var result = iterate(splices[1], index+splices[0].length)
			if (result) return result;

			result = iterate(splices[0], index)
			if (result) return result;
		}

		var p = iterate(value, 0)
		if (p) {
			value = value.substr(0, p[0]) + amount + value.substr(p[0]+p[1])
			this.set(axis, value)
		} else {
			amount = ''+amount
			if (amount.substr(0, 1) !== '-') amount = '+'+amount
			this.set(axis, value+amount)
		}*/
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
		if (this.channel === 'scale') {
			return this.get('x')
		}
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
	select(event) {
		var scope = this;
		if (this.dragging) {
			delete this.dragging
			return this;
		}
		if (!event || (!event.shiftKey && !event.ctrlKey)) {
			Timeline.selected.forEach(function(kf) {
				kf.selected = false
			})
			Timeline.selected.length = 0
		}
		if (event && event.shiftKey && Timeline.selected.length) {
			var last = Timeline.selected[Timeline.selected.length-1]
			if (last && last.channel === scope.channel) {
				Timeline.keyframes.forEach((kf) => {
					if (kf.channel === scope.channel &&
						Math.isBetween(kf.time, last.time, scope.time) &&
						!kf.selected
					) {
						kf.selected = true
						Timeline.selected.push(kf)
					}
				})
			}
		}
		if (Timeline.selected.indexOf(this) == -1) {
			Timeline.selected.push(this)
		}
		this.selected = true
		updateKeyframeSelection()
		return this;
	}
	callMarker() {
		Timeline.setTime(this.time)
		Animator.preview()
		return this;
	}
	findNearest(distance, channel, direction) {
		if (!this.parent) return [];
		//channel: all, others, this, 0, 1, 2
		//direction: true>, false<, undefined<>
		var scope = this
		function getDelta(kf, abs) {
			if (abs) {
				return Math.abs(kf.time - scope.time)
			} else {
				return kf.time - scope.time
			}
		}
		var matches = []
		var i = 0;
		while (i < scope.parent.keyframes.length) {
			var kf = scope.parent.keyframes[i]
			let delta = getDelta(kf)

			let delta_match = Math.abs(delta) <= distance &&
				(delta>0 == direction || direction === undefined)

			let channel_match = (
				(channel === 'all') ||
				(channel === 'others' && kf.channel !== scope.channel) ||
				(channel === 'this' && kf.channel === scope.channel) ||
				(channel === kf.channel_index) ||
				(channel === kf.channel)
			)

			if (channel_match && delta_match) {
				matches.push(kf)
			}
			i++;
		}

		matches.sort((a, b) => {
			return getDelta(a, true) - getDelta(b, true)
		})

		return matches
	}
	showContextMenu(event) {
		if (!this.selected) {
			this.select();
		}
		this.menu.open(event, this);
		return this;
	}
	remove() {
		if (this.parent) {
			this.parent.keyframes.remove(this)
		}
		Timeline.selected.remove(this)
	}
	extend(data) {
		if (data.channel && Animator.possible_channels[data.channel]) {
			Merge.string(this, data, 'channel')
		} else if (typeof data.channel === 'number') {
			this.channel = Animator.channel_index[data.channel]
		}
		Merge.number(this, data, 'time')

		Merge.string(this, data, 'x')
		Merge.string(this, data, 'y')
		Merge.string(this, data, 'z')
		Merge.string(this, data, 'w')
		Merge.boolean(this, data, 'isQuaternion')

		this.channel_index = Animator.channel_index.indexOf(this.channel)
		return this;
	}
	undoCopy() {
		var copy = {
			channel: this.channel_index,
			time: this.time,
			x: this.x,
			//uuid: this.uuid
		}
		if (this.channel_index !== 2) {//Not Scale
			copy.y = this.y
			copy.z = this.z
		}
		if (this.channel_index === 0 && this.isQuaternion) {
			copy.w = this.w
		}
		return copy;
	}
}
	Keyframe.prototype.menu = new Menu([
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
		},
		{name: 'generic.delete', icon: 'delete', click: function(keyframe) {
			keyframe.select({shiftKey: true})
			removeSelectedKeyframes()
		}},
		/*
			settotimestamp
			delete
		*/
	])

function updateKeyframeValue(obj) {
	var axis = $(obj).attr('axis')
	var value = $(obj).val()
	Timeline.selected.forEach(function(kf) {
		kf.set(axis, value)
	})
	BARS.updateConditions()
	Animator.preview()
}
function updateKeyframeSelection() {
	if (!selected_group) {
		Timeline.keyframes = Timeline.vue._data.keyframes = []
		Timeline.animator = undefined
		Timeline.selected.length = 0
	}
	var multi_channel = false;
	var channel = false;
	Timeline.selected.forEach((kf) => {
		if (channel === false) {
			channel = kf.channel
		} else if (channel !== kf.channel) {
			multi_channel = true
		}
	})
	if (Timeline.selected.length && !multi_channel) {
		var first = Timeline.selected[0]
		$('#keyframe_type_label').text(tl('panel.keyframe.type', [tl('timeline.'+first.channel)] ))
		$('#keyframe_bar_x').show()
		$('#keyframe_bar_y, #keyframe_bar_z').toggle(first.channel !== 'scale')
		$('#keyframe_bar_w').toggle(first.channel === 'rotation' && first.isQuaternion) 

		var values = [
			first.get('x'),
			first.get('y'),
			first.get('z'),
			first.get('w')
		]
		values.forEach((v, vi) => {
			if (typeof v === 'number') {
				values[vi] = trimFloatNumber(v)
			}
		})
		$('#keyframe_bar_x input').val(values[0])
		$('#keyframe_bar_y input').val(values[1])
		$('#keyframe_bar_z input').val(values[2])
		$('#keyframe_bar_w input').val(values[3])

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
	Undo.initEdit({keyframes: Timeline.selected, keep_saved: true})
	var i = Timeline.keyframes.length;
	while (i > 0) {
		i--;
		let kf = Timeline.keyframes[i]
		if (Timeline.selected.includes(kf)) {
			kf.remove()
		}
	}
	updateKeyframeSelection()
	Undo.finishEdit('remove keyframes')
}

const Animator = {
	possible_channels: {rotation: true, position: true, scale: true},
	channel_index: ['rotation', 'position', 'scale'],
	open: false,
	animations: [],
	frame: 0,
	interval: false,
	join: function() {

		Animator.open = true;
		selected.length = 0
		updateSelection()

		if (quad_previews.enabled) {
			quad_previews.enabled_before = true
		}
		main_preview.fullscreen()
		main_preview.setNormalCamera()

		$('body').addClass('animation_mode')
		$('.m_edit').hide()
		if (!Animator.timeline_node) {
			Animator.timeline_node = $('#timeline').get(0)
		}
		$('#preview').append(Animator.timeline_node)
		updateInterface()
		if (!Timeline.is_setup) {
			Timeline.setup()
		}
		Timeline.update()
		if (outlines.children.length) {
			outlines.children.length = 0
			Canvas.updateAllPositions()
		}
		if (Animator.selected) {
			Animator.selected.select()
		}
		if (isApp && !Prop.animation_path && !Animator.animations.length && Prop.file_path) {
			//Load
			findBedrockAnimation()
		}
	},
	leave: function (argument) {
		Timeline.pause()
		Animator.open = false;
		Canvas.updateAllPositions()
		$('#timeline').detach()
		$('.m_edit').show()
		$('body').removeClass('animation_mode')
		resizeWindow()
		updateInterface()
		if (quad_previews.enabled_before) {
			openQuadView()
		}
	},
	preview: function() {
		if (Animator.selected) {
			Animator.selected.displayFrame(Timeline.second)
		}
	},
	loadFile: function(file) {
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
					blend_weight: a.blend_weight
				}).add()
				//Bones
				for (var bone_name in a.bones) {
					var b = a.bones[bone_name]
					var group = TreeElements.findRecursive('name', bone_name)
					if (group) {
						var ba = new BoneAnimator()
						animation.bones[group.uuid] = ba
						ba.uuid = group.uuid;
						//Channels
						for (var channel in b) {
							if (Animator.possible_channels[channel]) {
								if (typeof b[channel] === 'string' || typeof b[channel] === 'number' || (typeof b[channel] === 'object' && b[channel].constructor.name === 'Array')) {
									ba.addKeyframe(b[channel], 0, channel)
								} else if (typeof b[channel] === 'object') {
									for (var timestamp in b[channel]) {
										ba.addKeyframe(b[channel][timestamp], parseFloat(timestamp), channel)
									}
								}
							}
						}
					}
				}
				if (!Animator.selected) {
					animation.select()
				}
			}
			if (isApp && file.path) {
				Prop.animation_path = file.path
			}
		}
	},
	buildFile: function(options) {
		if (typeof options !== 'object') {
			options = {}
		}
		var animations = {}
		Animator.animations.forEach(function(a) {
			var ani_tag = animations[a.name] = {}
			if (a.loop) ani_tag.loop = true
			if (a.length) ani_tag.animation_length = a.length
			if (a.override) ani_tag.override = true
			if (a.anim_time_update) ani_tag.anim_time_update = a.anim_time_update
			ani_tag.bones = {}
			for (var uuid in a.bones) {
				var group = a.bones[uuid].getGroup()
				if (group && a.bones[uuid].keyframes.length) {

					var bone_tag = ani_tag.bones[group.name] = {}
					var channels = {}
					//Saving Keyframes
					a.bones[uuid].keyframes.forEach(function(kf) {
						if (!channels[kf.channel]) {
							channels[kf.channel] = {}
						}
						let timecode = trimFloatNumber(Math.round(kf.time*60)/60) + ''
						if (!timecode.includes('.')) {
							timecode = timecode + '.0'
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
		})
		return {
			format_version: '1.8.0',
			animations: animations
		}
	}
}
const Timeline = {
	keyframes: [],//frames
	selected: [],//frames
	second: 0,
	playing: false,
	setTime: function(seconds, editing) {
		seconds = limitNumber(seconds, 0, 1000)
		Timeline.vue._data.marker = seconds
		Timeline.second = seconds
		if (!editing) {
			Timeline.setTimecode(seconds)
		}
		Timeline.updateSize()
		//Scroll
		var scroll = $('#timeline_inner').scrollLeft()
		var marker = Timeline.second * Timeline.vue._data.size + 8
		if (marker < scroll || marker > scroll + $('#timeline_inner').width()) {
			$('#timeline_inner').scrollLeft(marker-16)
		}
	},
	setTimecode: function(time) {
		let m = Math.floor(time/60)
		let s = Math.floor(time%60)
		let f = Math.floor((time%1) * 30)
		if ((s+'').length === 1) {s = '0'+s}
		if ((f+'').length === 1) {f = '0'+f}
		$('#timeline_corner').text(m + ':' + s  + ':' + f)
	},
	setup: function() {
		/*
		$('#timeline_inner #timeline_marker').draggable({
			axis: 'x',
			distance: 2,
			start: function(event, ui) {
				Timeline.pause()
			},
			drag: function(event, ui) {
				var difference = (ui.position.left - ui.originalPosition.left) / Timeline.vue._data.size;
				Timeline.second = limitNumber(Timeline.vue._data.marker + difference, 0, 1000)
				Timeline.setTimecode(Timeline.second)
				Timeline.updateSize()
				if (Animator.selected) {
					Animator.preview() 
				}
			},
			stop: function(event, ui) {
				Timeline.setTime(Timeline.second)
			}
		})*/
		$('#timeline_inner #timeline_time').mousedown(e => {
			Timeline.dragging_marker = true;
			let time = e.offsetX / Timeline.vue._data.size
			Timeline.setTime(time)
			if (Animator.selected) {
				Animator.preview()
			}
		})
		$(document).mousemove(e => {
			if (Timeline.dragging_marker) {
				let offset = mouse_pos.x - $('#timeline_inner #timeline_time').offset().left
				let time = offset / Timeline.vue._data.size
				Timeline.setTime(time)
				Animator.preview()
			}
		})
		.mouseup(e => {
			if (Timeline.dragging_marker) {
				delete Timeline.dragging_marker
			}
		})
		//Keyframe inputs
		$('.keyframe_input').click(e => {
			Undo.initEdit({keyframes: Timeline.selected, keep_saved: true})
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
				Timeline.setTimecode(Timeline.second)
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
				+ limitNumber(times[2]/30, 0, 29)
			if (Math.abs(seconds-Timeline.second) > 1e-3 ) {
				Timeline.setTime(seconds, true)
				if (Animator.selected) {
					Animator.preview()
				}
			}
		})

		Timeline.is_setup = true
		Timeline.setTime(0)
	},
	update: function() {
		//Draggable
		$('#timeline_inner .keyframe').draggable({
			axis: 'x',
			distance: 10,
			start: function(event, ui) {
				Undo.initEdit({keyframes: Timeline.keyframes, keep_saved: true})
				var id = $(ui.helper).attr('id')
				var i = 0;
				while (i < Timeline.vue._data.keyframes.length) {
					var kf = Timeline.vue._data.keyframes[i]
					if (kf.uuid === id || kf.selected) {
						kf.time_before = kf.time
					}
					i++;
				}
			},
			drag: function(event, ui) {
				var difference = (ui.position.left - ui.originalPosition.left - 8) / Timeline.vue._data.size;
				var id = $(ui.helper).attr('id')
				var snap_value = false
				var nearest
				var i = 0;
				while (i < Timeline.vue._data.keyframes.length) {
					var kf = Timeline.vue._data.keyframes[i]
					if (kf.uuid === id) {
						i = Infinity
						kf.time = limitNumber(kf.time_before + difference, 0, 256)
						nearest = kf.findNearest(8 / Timeline.vue._data.size, 'others')
					}
					i++;
				}
				if (nearest && nearest.length) {
					snap_value = nearest[0].time
					difference = snap_value - kf.time_before;
				}

				var i = 0;
				while (i < Timeline.vue._data.keyframes.length) {
					var kf = Timeline.vue._data.keyframes[i]
					if (kf.uuid === id || kf.selected) {
						var t = limitNumber(kf.time_before + difference, 0, 256)
						if (kf.uuid === id) {
							ui.position.left = t * Timeline.vue._data.size + 8
						}
						kf.time = t
					}
					i++;
				}
				BarItems.slider_keyframe_time.update()
				Animator.preview()
			},
			stop: function(event, ui) {
				var id = $(ui.helper).attr('id')
				var i = 0;
				while (i < Timeline.vue._data.keyframes.length) {
					var kf = Timeline.vue._data.keyframes[i]
					if (kf.uuid === id) {
						kf.dragging = true
					}
					i++;
				}
				Undo.finishEdit('drag keyframes')
			}
		})
	},
	updateSize: function() {
		let size = Timeline.vue._data.size
		var max_length = ($('#timeline_inner').width()-8) / Timeline.vue._data.size;
		Timeline.vue._data.keyframes.forEach((kf) => {
			max_length = Math.max(max_length, kf.time)
		})
		max_length = Math.max(max_length, Timeline.second)
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


		var i = 0;
		while (i < Timeline.vue._data.length) {
			Timeline.vue._data.timecodes.push({
				time: i,
				text: Math.round(i*100)/100
			})
			i += step;
		}
	},
	unselect: function(e) {
		if (!Animator.selected) return;
		Timeline.keyframes.forEach((kf) => {
			if (kf.selected) {
				Timeline.selected.remove(kf)
			}
			kf.selected = false
		})
		updateKeyframeSelection()
	},
	start: function() {
		if (!Animator.selected) return;
		Animator.selected.getMaxLength()
		Timeline.pause()
		Timeline.playing = true
		BarItems.play_animation.setIcon('pause')
		Timeline.loop()
	},
	loop: function() {
		if (Animator.selected) {
			Animator.selected.displayFrame(Timeline.second)
		}
		if (Animator.selected && Timeline.second < (Animator.selected.length||1e3)) {
			Animator.interval = setTimeout(Timeline.loop, 16.66)
			Timeline.setTime(Timeline.second + 1/60)
		} else {
			Timeline.setTime(0)
			if (Animator.selected && Animator.selected.loop) {
				Timeline.start()
			} else {
				Timeline.pause()
			}
		}
	},
	pause: function() {
		Timeline.playing = false;
		BarItems.play_animation.setIcon('play_arrow')
		if (Animator.interval) {
			clearInterval(Animator.interval)
			Animator.interval = false
		}
	},
	addKeyframe: function(channel) {
		if (!Animator.selected) { 
			Blockbench.showQuickMessage('message.no_animation_selected')
			return
		}
		var bone = Animator.selected.getBoneAnimator()
		if (!bone) { 
			Blockbench.showQuickMessage('message.no_bone_selected')
			return
		}
		Undo.initEdit({keyframes: bone.keyframes, keep_saved: true})
		var kf = bone.addKeyframe(false, Timeline.second, channel?channel:'rotation')
		kf.select()
		Undo.finishEdit('add_keyframe')
		Vue.nextTick(Timeline.update)
	},
	showMenu: function(event) {
		if (event.target.id === 'timeline_inner') {
			Timeline.menu.open(event, event);
		}
	},
	menu: new Menu([
		{name: 'menu.timeline.add', icon: 'add', click: function(context) {
			var time = (context.offsetX+$('#timeline_inner').scrollLeft()-8) / Timeline.vue._data.size
			var row = Math.floor((context.offsetY-32) / 31 + 0.15)
			if (!Animator.selected) {
				Blockbench.showQuickMessage('message.no_animation_selected')
				return;
			}
			var bone = Animator.selected.getBoneAnimator()
			if (bone) {
				Undo.initEdit({keyframes: bone.keyframes, keep_saved: true})
				var kf = bone.addKeyframe(false, Math.round(time*30)/30, row === 2 ? 'scale' : (row === 1 ? 'position' : 'rotation'))
				kf.select().callMarker()
				Vue.nextTick(Timeline.update)
				Undo.finishEdit('add_keyframe')
			} else {
				Blockbench.showQuickMessage('message.no_bone_selected')
			}
		}}
	])
}

BARS.defineActions(function() {
	new Action({
		id: 'add_animation',
		icon: 'fa-plus-circle',
		category: 'animation',
		condition: () => Animator.open,
		click: function () {
			var animation = new Animation({
				name: 'animation.' + (Project.parent||'model') + '.new'
			}).add().select()

		}
	})
	new Action({
		id: 'load_animation_file',
		icon: 'fa-file-video-o',
		category: 'animation',
		condition: () => Animator.open,
		click: function () {
			var path = Prop.file_path
			if (isApp) {
				var exp = new RegExp(osfs.replace('\\', '\\\\')+'models'+osfs.replace('\\', '\\\\'))
				var m_index = path.search(exp)
				if (m_index > 3) {
					path = path.substr(0, m_index) + osfs + 'animations' + osfs +  pathToName(Prop.file_path, true)
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
	new Action({
		id: 'export_animation_file',
		icon: 'save',
		category: 'animation',
		condition: () => Animator.open,
		click: function () {
			var content = autoStringify(Animator.buildFile())
			var path = Prop.animation_path

			if (isApp && !path) {
				path = Prop.file_path
				var exp = new RegExp(osfs.replace('\\', '\\\\')+'models'+osfs.replace('\\', '\\\\'))
				var m_index = path.search(exp)
				if (m_index > 3) {
					path = path.substr(0, m_index) + osfs + 'animations' + osfs +  pathToName(Prop.file_path, true)
				}
			}
			Blockbench.export({
				type: 'JSON Animation',
				extensions: ['json'],
				name: Project.parent||'animation',
				startpath: path,
				content: content
			})

		}
	})
	new Action({
		id: 'play_animation',
		icon: 'play_arrow',
		category: 'animation',
		keybind: new Keybind({key: 32}),
		condition: () => Animator.open,
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
	new NumSlider({
		id: 'slider_animation_length',
		category: 'animation',
		condition: () => Animator.open && Animator.selected,
		get: function() {
			return Animator.selected.length
		},
		change: function(value, fixed) {
			if (!fixed) {
				value += Animator.selected.length
			}
			Animator.selected.length = limitNumber(value, 0, 1e4)
		}
	})
	new NumSlider({
		id: 'slider_keyframe_time',
		category: 'animation',
		condition: () => Animator.open && Timeline.selected.length,
		get: function() {
			return Timeline.selected[0] ? Timeline.selected[0].time : 0
		},
		change: function(value, fixed) {
			Timeline.selected.forEach((kf) => {
				if (!fixed) {
					value += kf.time
				}
				kf.time = limitNumber(value, 0, 1e4)
			})
			Animator.preview()
		},
		onBefore: function() {
			Undo.initEdit({keyframes: Timeline.selected, keep_saved: true})
		},
		onAfter: function() {
			Undo.finishEdit('edit keyframe')
		}
	})
	new Action({
		id: 'select_all_keyframes',
		icon: 'select_all',
		category: 'animation',
		condition: () => Animator.open,
		keybind: new Keybind({key: 65, ctrl: true}),
		click: function () {selectAllKeyframes()}
	})
	new Action({
		id: 'delete_keyframes',
		icon: 'delete',
		category: 'animation',
		condition: () => Animator.open,
		keybind: new Keybind({key: 46}),
		click: function () {removeSelectedKeyframes()}
	})
})