class Animation {
	constructor(data) {
		this.name = '';
		this.uuid = guid()
		this.loop = true;
		this.override = false;
		this.selected = false;
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
		return this;
	}
	select() {
		Animator.animations.forEach(function(a) {
			a.selected = false;
		})
		Prop.active_panel = 'animations'
		this.selected = true
		Animator.selected = this
		return this;
	}
	showContextMenu(event) {
		this.select();
		this.menu.open(event, this);
		return this;
	}
	getCurrentBoneAnimator() {
		if (!selected_group) return
		var uuid = selected_group.uuid
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
	}
	add() {
		if (!Animator.animations.includes(this)) {
			Animator.animations.push(this)
		}
		this.select()
		return this;
	}
	remove() {
		Animator.animations.remove(this)
		return this;
	}
}
	Animation.prototype.menu = new Menu([
		{name: 'Delete', icon: 'delete', click: function(animation) {
			animation.remove()
		}}
		/*
			rename
			Loop: checkbox
			Override: checkbox
			anim_time_update:
				WalkPosition
			delete
		*/
	])
/*
Entity.Member.targetYRot
Entity.Member.WalkPosition
Entity.Member.Variant
Entity.Member.YawSpeed
Entity.Member.WalkSpeed

Entity.Member.HairColor

Params.AnimTime
Params.AnimPos ?
Params.AnimSpeed ?
Params.DeltaTime
Params.LifeTime
Params.KeyFrameLerpTime
Params.FrameAlpha
Params.GroundSpeed ?

*/
class BoneAnimator {
	constructor() {
		this.keyframes = []
		this.uuid;
	}
	getGroup() {
		this.group = TreeElements.findRecursive('uuid', this.uuid)
		if (!this.group) {
			cl('couldnt find group for')
			cl({uuid: this.uuid, ba: this})
		}
		return this.group
	}
	addKeyframe(array, time, channel) {
		var keyframe = new Keyframe({
			time: time,
			x: array[0],
			y: array[1],
			z: array[2],
			w: array[3],
		})
		this.keyframes.push(keyframe)
		keyframe.parent = this;
	}
	displayRotation(arr) {
		this.getGroup()
		var bone = this.group.getMesh()
		//bone.rotation.reorder('ZYX')
		bone.rotation.copy(bone.fix_rotation)

		if (arr.length === 4) {
			var added_rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(arr))
			bone.rotation.x += added_rotation.x
			bone.rotation.y += added_rotation.y
			bone.rotation.z += added_rotation.z
		} else {
			arr.forEach((n, i) => {
				bone.rotation[getAxisLetter(i)] += Math.PI / (180 / n) * (i == 2 ? -1 : 1)
			})
		}
		return this;
	}
	displayPosition(arr) {
		this.getGroup()
		var bone = this.group.getMesh()
		bone.position.copy(bone.fix_position).add(new THREE.Vector3().fromArray([arr]))
		//Process Children
		return this;
	}
	displayScale(arr) {
		this.getGroup()
		var bone = this.group.getMesh()
		bone.scale.setFromArray(arr)
		return this;
	}
	displayFrame(time) {
		for (var channel in Animator.possible_channels) {
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
			if (before && Math.abs(before.time - time) < 1/120) {
				result = before
			} else if (after && Math.abs(after.time - time) < 1/120) {
				result = after
			} else if (before && !after) {
				result = before
			} else if (after && !before) {
				result = after
			} else if (!before && !after) {
				//
			} else {
				var alpha = Math.lerp(before.time, after.time, time)
				var result = {
					x: before.get('x') + (after.get('x') - before.get('x')) * alpha,
					y: before.get('y') + (after.get('y') - before.get('y')) * alpha,
					z: before.get('z') + (after.get('z') - before.get('z')) * alpha,
				}
			}
			if (result && channel === 'rotation') {
				this.displayRotation([-result.x, -result.y, -result.z])
			}
		}
	}
	select() {
		Timeline.animator = this;
		Timeline.vue._data.keyframes = this.keyframes
		Vue.nextTick(Timeline.update)
		return this;
	}
}
class Keyframe {
	constructor(data) {
		this.channel = 'rotation'//, 'position', 'scale'
		this.channel_index = 0;
		this.time = 0;
		this.selected = 0;
		this.x = '';
		this.y = '';
		this.z = '';
		this.w = '';
		this.isQuaternion = false;
		this.uuid = guid()
		if (typeof data === 'object') {
			this.extend(data)
		}
	}
	get(axis) {
		return parseFloat(this[axis])||0
	}
	set(axis, value) {
		if (axis === 'x' || axis === 'y' || axis === 'z' || axis === 'w') {
			this[axis] = value
		}
	}
	getArray() {
		var arr = [
			this.get('x'),
			this.get('y'),
			this.get('z'),
		]
		if (this.channel === 'rotation' && this.w) {
			arr.push(this.get('w'))
		}
		return arr;
	}
	select(event) {
		if (!event.shiftKey) {
			Timeline.selected.forEach(function(kf) {
				kf.selected = false
			})
			Timeline.selected.length = 0
		}
		Timeline.selected.push(this)
		this.selected = true
		updateKeyframeSelection()
	}
	showContextMenu(event) {
		//this.select();
		this.menu.open(event, this);
		return this;
	}
	remove() {
		if (this.parent) {
			this.parent.keyframes.remove(this)
		}
	}
	extend(data) {
		if (data.channel && Animator.possible_channels[data.channel]) {
			Merge.string(this, data, 'channel')
		}
		Merge.number(this, data, 'time')

		Merge.string(this, data, 'x')
		Merge.string(this, data, 'y')
		Merge.string(this, data, 'z')
		Merge.string(this, data, 'w')

		this.channel_index = this.channel === 'rotation' ? 0 : (this.channel === 'position' ? 1 : 2)
		return this;
	}
}
	Keyframe.prototype.menu = new Menu([
		{name: 'Delete', icon: 'delete', click: function(animation) {
			animation.remove()
		}}
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
}
function updateKeyframeSelection() {
	if (Timeline.selected.length) {
		var first = Timeline.selected[0]
		$('#keyframe_bar_y, #keyframe_bar_z').toggle(first.channel !== 'scale')
		$('#keyframe_bar_w').toggle(first.channel === 'rotation' && first.channel.isQuaternion) 

		$('#keyframe_bar_x input').val(first.get('x'))
		$('#keyframe_bar_y input').val(first.get('y'))
		$('#keyframe_bar_z input').val(first.get('z'))
		$('#keyframe_bar_w input').val(first.get('w'))
	}
}


const Animator = {
	possible_channels: {rotation: true, position: true, scale: true},
	channel_index: {rotation: true, position: true, scale: true},
	state: false,
	animations: [],
	frame: 0,
	interval: false,
	playing: false,
	join: function() {

		Animator.state = true;
		selected.length = 0
		updateSelection()

		if (quad_previews.enabled) {
			quad_previews.enabled_before = true
			main_preview.fullscreen()
		}
		main_preview.setNormalCamera()
		main_preview.camPers.position.set(-80, 40, -30)
		main_preview.camPers.setFocalLength(45)


		$('body').addClass('animation_mode')
		$('.m_edit').hide()
		if (!Animator.timeline_node) {
			Animator.timeline_node = $('#timeline').get(0)
		}
		$('#preview').append(Animator.timeline_node)
		updateInterface()

		if (outlines.children.length) {
			outlines.children.length = 0
			Canvas.updateAllPositions()
		}
	},
	leave: function (argument) {
		
		Animator.state = false;
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
	loadFile: function(file) {
		var json = autoParseJSON(file.content)
		if (json && typeof json.animations === 'object') {
			for (var ani_name in json.animations) {
				var a = json.animations[ani_name]
				var animation = new Animation({
					name: ani_name,
					loop: a.loop,
					override: a.override_previous_animation,
					length: a.animation_length,
					blend_weight: a.blend_weight
				}).add()
				for (var bone_name in a.bones) {
					var b = a.bones[bone_name]
					var group = TreeElements.findRecursive('name', bone_name)
					if (group) {
						var ba = new BoneAnimator()
						animation.bones[group.uuid] = ba
						ba.uuid = group.uuid;
						for (var channel in b) {
							if (channel === 'rotation' || channel === 'position' || channel === 'scale') {
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
			if (a.override) ani_tag.override = true
			ani_tag.bones = {}
			for (var uuid in a.bones) {
				var bone_name = a.bones[uuid].getGroup().name
				var bone_tag = ani_tag.bones[bone_name] = {}
				a.bones[uuid].keyframes.forEach(function(kf) {
					if (!bone_tag[kf.channel]) {
						bone_tag[kf.channel] = {}
					}
					bone_tag[kf.channel][Math.round(kf.time*60)/60] = kf.getArray()
				})
			}
		})
		return {
			animations: animations
		}
	}

}
const Timeline = {
	selected: [],//frames
	second: 0,
	update: function() {
		$('#timeline_inner .keyframe').draggable({
			axis: 'x',
			distance: 10,
			stop: function(event, ui) {
				var difference = (ui.position.left - ui.originalPosition.left) / Timeline.vue._data.size;
				var id = $(ui.helper).attr('id')
				var i = 0;
				while (i < Timeline.vue._data.keyframes.length) {
					var kf = Timeline.vue._data.keyframes[i]
					if (kf.uuid === id || kf.selected) {
						kf.time = limitNumber(kf.time + difference, 0, 256)
						//i = Infinity
					}
					i++;
				}
			}
		})
	},
	start: function() {
		Timeline.pause()
		Animator.playing = true
		Timeline.loop()
	},
	loop: function() {
		if (Animator.selected) {
			Animator.selected.displayFrame(Timeline.second)
		}
		if (Timeline.second < 20) {
			Animator.interval = setTimeout(Timeline.loop, 16.66)
			Timeline.second += 1/60
		} else {
			Timeline.pause()
		}
	},
	pause: function() {
		Animator.playing = false;
		if (Animator.interval) {
			clearInterval(Animator.interval)
			Animator.interval = false
		}
	}
}
/*
Create
	Add new Animation
	Select Bone
	add Keyframe
	set value/code
*/


/*
TODO
Animation Export



*/