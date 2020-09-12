class Keyframe {
	constructor(data, uuid) {
		this.type = 'keyframe'
		this.channel = 'rotation';
		this.time = 0;
		this.color = -1;
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
		Merge.number(this, data, 'color')

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
			let num = parseFloat(this[axis]);
			return isNaN(num) ? 0 : num;
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
				var number = (parseFloat( end[0] ) + amount)
				value = value.substr(0, end.index) + ((number.toString()).substr(0,1)=='-'?'':'+') + trimFloatNumber(number)
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
		} else if (this.channel == 'position') {
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
		return arr;
	}
	getFixed() {
		if (this.channel === 'rotation') {
			let fix = this.animator.group.mesh.fix_rotation;
			return new THREE.Quaternion().setFromEuler(new THREE.Euler(
				fix.x - Math.degToRad(this.calc('x')),
				fix.y - Math.degToRad(this.calc('y')),
				fix.z + Math.degToRad(this.calc('z')),
				'ZYX'
			));
		} else if (this.channel === 'position') {
			let fix = this.animator.group.mesh.fix_position;
			return new THREE.Vector3(
				fix.x - this.calc('x'),
				fix.y + this.calc('y'),
				fix.z + this.calc('z')
			)
		} else if (this.channel === 'scale') {
			return new THREE.Vector3(
				this.calc('x'),
				this.calc('y'),
				this.calc('z')
			)
		}
	}
	getTimecodeString() {
		let timecode = trimFloatNumber(Timeline.snapTime(this.time)).toString();
		if (!timecode.includes('.')) {
			timecode += '.0';
		}
		return timecode;
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
			Timeline.selected.empty()
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
	forSelected(fc, undo_tag) {
		if (Timeline.selected.length <= 1 || !Timeline.selected.includes(this)) {
			var edited = [this]
		} else {
			var edited = Timeline.selected
		}
		if (undo_tag) {
			Undo.initEdit({keyframes: edited})
		}
		for (var i = 0; i < edited.length; i++) {
			fc(edited[i])
		}
		if (undo_tag) {
			Undo.finishEdit(undo_tag)
		}
		return edited;
	}
	getUndoCopy(save) {
		var copy = {
			animator: save ? undefined : this.animator && this.animator.uuid,
			uuid: save && this.uuid,
			channel: this.channel,
			time: this.time,
			color: this.color,
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
		{name: 'menu.cube.color', icon: 'color_lens', children: [
			{icon: 'bubble_chart', name: 'generic.unset', click: function(kf) {kf.forSelected(kf2 => {kf2.color = -1}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[0].standard, name: 'cube.color.'+markerColors[0].name, click: function(kf) {kf.forSelected(function(kf2){kf2.color = 0}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[1].standard, name: 'cube.color.'+markerColors[1].name, click: function(kf) {kf.forSelected(function(kf2){kf2.color = 1}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[2].standard, name: 'cube.color.'+markerColors[2].name, click: function(kf) {kf.forSelected(function(kf2){kf2.color = 2}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[3].standard, name: 'cube.color.'+markerColors[3].name, click: function(kf) {kf.forSelected(function(kf2){kf2.color = 3}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[4].standard, name: 'cube.color.'+markerColors[4].name, click: function(kf) {kf.forSelected(function(kf2){kf2.color = 4}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[5].standard, name: 'cube.color.'+markerColors[5].name, click: function(kf) {kf.forSelected(function(kf2){kf2.color = 5}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[6].standard, name: 'cube.color.'+markerColors[6].name, click: function(kf) {kf.forSelected(function(kf2){kf2.color = 6}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[7].standard, name: 'cube.color.'+markerColors[7].name, click: function(kf) {kf.forSelected(function(kf2){kf2.color = 7}, 'change color')}}
		]},
		'copy',
		'delete',
	])

// Misc Functions
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
	Blockbench.dispatchEvent('update_keyframe_selection');
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

BARS.defineActions(function() {
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

	new NumSlider('slider_animation_length', {
		category: 'animation',
		condition: () => Animator.open && Animator.selected,
		getInterval(event) {
			if (event && event.shiftKey) return 1;
			return 1/Math.clamp(settings.animation_snap.value, 1, 120)
		},
		get: function() {
			return Animator.selected.length
		},
		change: function(modify) {
			Animator.selected.setLength(limitNumber(modify(Animator.selected.length), 0, 1e4))
		},
		onBefore: function() {
			Undo.initEdit({animations: [Animator.selected]});
		},
		onAfter: function() {
			Undo.finishEdit('Change Animation Length')
		}
	})
	new NumSlider('slider_keyframe_time', {
		category: 'animation',
		condition: () => Animator.open && Timeline.selected.length,
		getInterval(event) {
			if (event && event.shiftKey) return 1;
			return 1/Math.clamp(settings.animation_snap.value, 1, 120)
		},
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
	new Action('reset_keyframe', {
		icon: 'replay',
		category: 'animation',
		condition: () => Animator.open && Timeline.selected.length,
		click: function () {
			Undo.initEdit({keyframes: Timeline.selected})
			Timeline.selected.forEach((kf) => {
				var n = kf.channel === 'scale' ? '1' : '0';
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
	new Action('resolve_keyframe_expressions', {
		icon: 'functions',
		category: 'animation',
		condition: () => Animator.open && Timeline.selected.length,
		click: function () {
			Undo.initEdit({keyframes: Timeline.selected})
			let time_before = Timeline.time;
			Timeline.selected.forEach((kf) => {
				if (kf.animator.fillValues) {
					Timeline.time = kf.time;
					kf.animator.fillValues(kf, null, false);
				}
			})
			Timeline.time = time_before;
			Undo.finishEdit('reset keyframes')
			updateKeyframeSelection()
		}
	})
	new Action('change_keyframe_file', {
		icon: 'fa-file-audio',
		category: 'animation',
		condition: () => (Animator.open && Timeline.selected.length && Timeline.selected[0].channel == 'sound' && isApp),
		click: function () {
			Blockbench.import({
				resource_id: 'animation_audio',
				extensions: ['ogg'],
				type: 'Audio File',
				startpath: Timeline.selected[0].file
			}, function(files) {

				let {path} = files[0];
				Undo.initEdit({keyframes: Timeline.selected})
				Timeline.selected.forEach((kf) => {
					if (kf.channel == 'sound') {
						kf.file = path;
					}
				})
				Timeline.visualizeAudioFile(path);
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
})
