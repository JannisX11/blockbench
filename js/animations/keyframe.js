class KeyframeDataPoint {
	constructor(keyframe) {
		this.keyframe = keyframe;
		for (var key in KeyframeDataPoint.properties) {
			KeyframeDataPoint.properties[key].reset(this);
		}
	}
	extend(data) {
		if (data.values) {
			Object.assign(data, data.values)
		}
		for (var key in KeyframeDataPoint.properties) {
			KeyframeDataPoint.properties[key].merge(this, data)
		}
	}
	getUndoCopy() {
		var copy = {}
		for (var key in KeyframeDataPoint.properties) {
			KeyframeDataPoint.properties[key].copy(this, copy)
		}
		return copy;
	}
}
new Property(KeyframeDataPoint, 'molang', 'x', { label: 'X', condition: point => point.keyframe.transform, default: point => (point && point.keyframe.channel == 'scale' ? '1' : '0') });
new Property(KeyframeDataPoint, 'molang', 'y', { label: 'Y', condition: point => point.keyframe.transform, default: point => (point && point.keyframe.channel == 'scale' ? '1' : '0') });
new Property(KeyframeDataPoint, 'molang', 'z', { label: 'Z', condition: point => point.keyframe.transform, default: point => (point && point.keyframe.channel == 'scale' ? '1' : '0') });
new Property(KeyframeDataPoint, 'string', 'effect', {label: tl('data.effect'), condition: point => ['particle', 'sound'].includes(point.keyframe.channel)});
new Property(KeyframeDataPoint, 'string', 'locator',{label: tl('data.locator'), condition: point => 'particle' == point.keyframe.channel});
new Property(KeyframeDataPoint, 'molang', 'script', {label: tl('timeline.pre_effect_script'), condition: point => ['particle', 'timeline'].includes(point.keyframe.channel), default: ''});
new Property(KeyframeDataPoint, 'string', 'file', 	{exposed: false, condition: point => ['particle', 'sound'].includes(point.keyframe.channel)});

class Keyframe {
	constructor(data, uuid, animator) {
		this.type = 'keyframe'
		this.uuid = (uuid && isUUID(uuid)) ? uuid : guid();
		this.channel == 'rotation'
		this.selected = 0;
		this.data_points = []

		if (typeof data === 'object') {
			Merge.string(this, data, 'channel')
			this.animator = animator;
			this.transform = !!(this.animator.channels[this.channel]).transform;
			this.data_points.push(new KeyframeDataPoint(this));
		}

		for (var key in Keyframe.properties) {
			Keyframe.properties[key].reset(this);
		}

		if (typeof data === 'object') {
			this.extend(data)
		}
	}
	extend(data) {
		for (var key in Keyframe.properties) {
			Keyframe.properties[key].merge(this, data)
		}
		if (data.data_points && data.data_points.length) {
			this.data_points.splice(data.data_points.length);
			data.data_points.forEach((point, i) => {
				if (!this.data_points[i]) {
					this.data_points.push(new KeyframeDataPoint(this));
				}
				let this_point = this.data_points[i];
				this_point.extend(point)
			})
		} else {
			// Direct extending
			for (var key in KeyframeDataPoint.properties) {
				KeyframeDataPoint.properties[key].merge(this.data_points[0], data)
			}
		}
		return this;
	}
	get(axis, data_point = 0) {
		if (data_point) data_point = Math.clamp(data_point, 0, this.data_points.length-1);
		data_point = this.data_points[data_point];
		if (!data_point || !data_point[axis]) {
			return this.transform ? 0 : '';
		} else if (!isNaN(data_point[axis])) {
			let num = parseFloat(data_point[axis]);
			return isNaN(num) ? 0 : num;
		} else {
			return data_point[axis]
		}
	}
	calc(axis, data_point = 0) {
		if (data_point) data_point = Math.clamp(data_point, 0, this.data_points.length-1);
		data_point = this.data_points[data_point];
		let last_value = Animator._last_values[this.channel] && Animator._last_values[this.channel][axis];
		let result = Animator.MolangParser.parse(data_point && data_point[axis], {
			'this': last_value,
			'query.anim_time': this.animator.animation.time
		});
		return result;
	}
	set(axis, value, data_point = 0) {
		if (data_point) data_point = Math.clamp(data_point, 0, this.data_points.length-1);
		if (this.data_points[data_point]) {
			if (this.uniform) {
				this.data_points[data_point].x = value;
				this.data_points[data_point].y = value;
				this.data_points[data_point].z = value;
			} else {
				this.data_points[data_point][axis] = value;
			}
		}
		return this;
	}
	offset(axis, amount, data_point = 0) {
		if (data_point) data_point = Math.clamp(data_point, 0, this.data_points.length-1);
		var value = this.get(axis)
		if (!value || value === '0') {
			this.set(axis, amount, data_point)
			return amount;
		}
		if (typeof value === 'number') {
			this.set(axis, value+amount, data_point)
			return value+amount
		}
		var start = value.match(/^-?\s*\d+(\.\d+)?\s*(\+|-)/)
		if (start) {
			var number = parseFloat( start[0].substr(0, start[0].length-1) ) + amount;
			if (number == 0) {
				value = value.substr(start[0].length + (value[start[0].length-1] == '+' ? 0 : -1));
				value = value.trim();
			} else {
				value = trimFloatNumber(number) + (start[0].substr(-2, 1) == ' ' ? ' ' : '') + value.substr(start[0].length-1);
			}
		} else {

			var end = value.match(/(\+|-)\s*\d*(\.\d+)?\s*$/)
			if (end) {
				var number = (parseFloat( end[0] ) + amount)
				value = value.substr(0, end.index) + ((number.toString()).substr(0,1)=='-'?'':'+') + trimFloatNumber(number)
			} else {
				value = trimFloatNumber(amount) +(value.substr(0,1)=='-'?'':'+')+ value
			}
		}
		this.set(axis, value, data_point)
		return value;
	}
	flip(axis) {
		if (!this.transform || this.channel == 'scale') return this;
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
		this.data_points.forEach((data_point, data_point_i) => {
			if (this.channel == 'rotation') {
				for (var i = 0; i < 3; i++) {
					if (i != axis) {
						let l = getAxisLetter(i)
						this.set(l, negate(this.get(l, data_point_i)), data_point_i)
					}
				}
			} else if (this.channel == 'position') {
				let l = getAxisLetter(axis)
				this.set(l, negate(this.get(l, data_point_i)), data_point_i)
			}
		})
		return this;
	}
	getLerp(other, axis, amount, allow_expression) {
		let this_data_point = (this.data_points.length > 1 && this.time < other.time) ? 1 : 0;
		let other_data_point = (other.data_points.length > 1 && this.time > other.time) ? 1 : 0;
		if (allow_expression && this.get(axis, this_data_point) === other.get(axis, other_data_point)) {
			return this.get(axis, this_data_point);
		} else {
			let calc = this.calc(axis, this_data_point);
			return calc + (other.calc(axis, other_data_point) - calc) * amount;
		}
	}
	getCatmullromLerp(before_plus, before, after, after_plus, axis, alpha) {
		var vectors = [];

		if (before_plus && before.data_points.length == 1) vectors.push(new THREE.Vector2(before_plus.time, before_plus.calc(axis, 1)))
		if (before) 	vectors.push(new THREE.Vector2(before.time, before.calc(axis, 1)))
		if (after) 		vectors.push(new THREE.Vector2(after.time, after.calc(axis, 0)))
		if (after_plus && after.data_points.length == 1) vectors.push(new THREE.Vector2(after_plus.time, after_plus.calc(axis, 0)))

		var curve = new THREE.SplineCurve(vectors);
		let time = (alpha + (before_plus ? 1 : 0)) / (vectors.length-1);

		return curve.getPoint(time).y;
	}
	getArray(data_point = 0) {
		var arr = [
			this.get('x', data_point),
			this.get('y', data_point),
			this.get('z', data_point),
		]
		arr.forEach((n, i) => {
			if (n.replace) arr[i] = n.replace(/\n/g, '');
		})
		return arr;
	}
	getFixed(data_point = 0, do_quaternion = true) {
		if (this.channel === 'rotation') {
			let fix = this.animator.group.mesh.fix_rotation;
			let euler = new THREE.Euler(
				(fix.x||0) - Math.degToRad(this.calc('x', data_point)),
				(fix.y||0) - Math.degToRad(this.calc('y', data_point)),
				(fix.z||0) + Math.degToRad(this.calc('z', data_point)),
				'ZYX'
			)
			return do_quaternion ? new THREE.Quaternion().setFromEuler(euler) : euler;
		} else if (this.channel === 'position') {
			let fix = this.animator.group.mesh.fix_position;
			return new THREE.Vector3(
				fix.x - this.calc('x', data_point),
				fix.y + this.calc('y', data_point),
				fix.z + this.calc('z', data_point)
			)
		} else if (this.channel === 'scale') {
			return new THREE.Vector3(
				this.calc('x', data_point),
				this.calc('y', data_point),
				this.calc('z', data_point)
			)
		}
	}
	getTimecodeString() {
		let timecode = trimFloatNumber(Timeline.snapTime(this.time, this.animator.animation)).toString();
		if (!timecode.includes('.')) {
			timecode += '.0';
		}
		return timecode;
	}
	getPreviousKeyframe() {
		let keyframes = this.animator[this.channel].filter(kf => kf.time < this.time);
		keyframes.sort((a, b) => b.time - a.time);
		return keyframes[0];
	}
	compileBedrockKeyframe() {
		if (this.transform) {

			if (this.interpolation != 'linear' && this.interpolation != 'step') {
				let previous = this.getPreviousKeyframe();
				let include_pre = (!previous && this.time > 0) || (previous && previous.interpolation != 'catmullrom')
				return {
					pre: include_pre ? this.getArray(0) : undefined,
					post: this.getArray(include_pre ? 1 : 0),
					lerp_mode: this.interpolation,
				}
			} else if (this.data_points.length == 1) {
				let previous = this.getPreviousKeyframe();
				if (previous && previous.interpolation == 'step') {
					return new oneLiner({
						pre:  previous.getArray(1),
						post: this.getArray(),
					})
				} else {
					return this.getArray();
				}
			} else {
				return new oneLiner({
					pre:  this.getArray(0),
					post: this.getArray(1),
				})
			}
		} else if (this.channel == 'timeline') {
			let scripts = [];
			this.data_points.forEach(data_point => {
				if (data_point.script) {
					scripts.push(...data_point.script.split('\n'));
				}
			})
			scripts = scripts.filter(script => !!script.replace(/[\n\s;.]+/g, ''));
			scripts = scripts.map(line => (line.match(/;\s*$/) || line.startsWith('/')) ? line : (line+';'));
			return scripts.length <= 1 ? scripts[0] : scripts;
		} else {
			let points = [];
			this.data_points.forEach(data_point => {
				if (data_point.effect) {
					let script = data_point.script || undefined;
					if (script && !script.replace(/[\n\s;.]+/g, '')) script = undefined;
					if (script && !script.match(/;$/)) script += ';';
					points.push({
						effect: data_point.effect,
						locator: data_point.locator || undefined,
						pre_effect_script: script,
					})
				}
			})
			return points.length <= 1 ? points[0] : points;
		}
	}
	replaceOthers(save) {
		var scope = this;
		var arr = this.animator[this.channel];
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
		if (!event || (!event.shiftKey && !event.ctrlOrCmd && !Pressing.overrides.ctrl && !Pressing.overrides.shift)) {
			Timeline.selected.forEach(function(kf) {
				kf.selected = false
			})
			Timeline.selected.empty()
		}
		if (event && (event.shiftKey || Pressing.overrides.shift) && Timeline.selected.length) {
			var last = Timeline.selected[Timeline.selected.length-1]
			if (last && last.channel === this.channel && last.animator == this.animator) {
				Timeline.keyframes.forEach((kf) => {
					if (kf.channel === this.channel &&
						kf.animator === this.animator &&
						Math.isBetween(kf.time, last.time, this.time) &&
						!kf.selected
					) {
						kf.selected = true
						Timeline.selected.push(kf)
					}
				})
			} else if (last && Math.epsilon(this.time, last.time, 0.01)) {
				let animators = Timeline.animators;
				let vertical_index_last = animators.indexOf(last.animator);
				let vertical_index_this = animators.indexOf(this.animator);
				let sign = Math.sign(vertical_index_this - vertical_index_last);
				if (sign == 0) {
					let channels = Object.keys(this.animator.channels);
					sign = this.channel == channels[0] ? -1 : 1;
				}

				let active = false;
				for (let i = vertical_index_last; (sign == 1 ? (i <= vertical_index_this) : (i >= vertical_index_this)) && animators[i]; i += sign) {
					let animator = animators[i];
					let channels = Object.keys(animator.channels);
					if (sign !== 1) channels.reverse();
					for (let channel of channels) {
						if (active && channel == this.channel && animator == this.animator) active = false;
						if (active && Timeline.vue.channels[channel] !== false) {
							let match = animator[channel].find(kf => Math.epsilon(this.time, kf.time, 0.01));
							if (match && !match.selected) {
								match.selected = true;
								Timeline.selected.push(match);
							}
						}
						if (!active && channel == last.channel && animator == last.animator) active = true;
					}
				}
			}
		}
		Timeline.selected.safePush(this);
		if (Timeline.selected.length == 1 && Timeline.selected[0].animator.selected == false) {
			Timeline.selected[0].animator.select()
		}
		this.selected = true
		TickUpdates.keyframe_selection = true;

		if (this.transform) Timeline.vue.graph_editor_channel = this.channel;

		var select_tool = true;
		Timeline.selected.forEach(kf => {
			if (kf.channel != this.channel) select_tool = false;
		})
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
	
	showInTimeline() {
		if (!this.animator.animation.selected) {
			this.animator.animation.select();
		}
		this.animator.addToTimeline();
		this.select();

		Vue.nextTick(() => {
			let element = $(`.keyframe#${this.uuid}`);
			let offset = element.offset();
			if (!offset) return;

			let body = document.getElementById('timeline_body');
			let body_offset = $(body).offset();

			$(body).animate({
				scrollLeft: (offset.left - body_offset.left - 300),
				scrollTop: (offset.top - body_offset.top - 120)
			}, 200);
		})
	}
	showContextMenu(event) {
		if (!this.selected) {
			this.select();
			updateKeyframeSelection();
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
	getUndoCopy(save, options = {}) {
		var copy = {
			animator: save ? undefined : this.animator && this.animator.uuid,
			channel: this.channel,
			data_points: []
		}
		if (!save && this.animator instanceof EffectAnimator) {
			copy.animator = 'effects';
		}
		if (save) copy.uuid = this.uuid;
		for (var key in Keyframe.properties) {
			Keyframe.properties[key].copy(this, copy)
		}
		this.data_points.forEach(data_point => {
			let point_copy = data_point.getUndoCopy();
			if (options.absolute_paths == false) delete point_copy.file;
			copy.data_points.push(point_copy);
		})
		return copy;
	}
}
	Keyframe.prototype.menu = new Menu([
		'change_keyframe_file',
		'_',
		'keyframe_uniform',
		'keyframe_interpolation',
		{name: 'menu.cube.color', icon: 'color_lens', children() {
			return [
				{icon: 'bubble_chart', name: 'generic.unset', click: function(kf) {kf.forSelected(kf2 => {kf2.color = -1}, 'change color')}},
				...markerColors.map((color, i) => {return {
					icon: 'bubble_chart',
					color: color.standard,
					name: color.name || 'cube.color.'+color.id,
					click(kf) {
						kf.forSelected(function(kf2){kf2.color = i}, 'change color')
					}
				}})
			];
		}},
		'copy',
		'delete',
	])
	new Property(Keyframe, 'number', 'time')
	new Property(Keyframe, 'number', 'color', {default: -1})
	new Property(Keyframe, 'boolean', 'uniform', {condition: keyframe => keyframe.channel == 'scale', default: settings.uniform_keyframe.value})
	new Property(Keyframe, 'string', 'interpolation', {default: 'linear'})
	Keyframe.selected = [];
	Keyframe.interpolation = {
		linear: 'linear',
		catmullrom: 'catmullrom',
		step: 'step',
	}

// Misc Functions
function updateKeyframeValue(axis, value, data_point) {
	Timeline.selected.forEach(function(kf) {
		if (axis == 'uniform' && kf.channel == 'scale') kf.uniform = true;
		kf.set(axis, value, data_point);
	})
	if (!['effect', 'locator', 'script'].includes(axis)) {
		Animator.preview();
		updateKeyframeSelection();
	}
}
function updateKeyframeSelection() {
	Timeline.keyframes.forEach(kf => {
		if (kf.selected && !Timeline.selected.includes(kf)) {
			kf.selected = false;
		}
	})
	if (Timeline.selected.length) {
		BarItems.slider_keyframe_time.update()
		BarItems.keyframe_interpolation.set(Timeline.selected[0].interpolation)
		if (BarItems.keyframe_uniform.value != !!Timeline.selected[0].uniform) {
			BarItems.keyframe_uniform.value = !!Timeline.selected[0].uniform;
			BarItems.keyframe_uniform.updateEnabledState();
		}
	}
	if (settings.motion_trails.value && Modes.animate && Animation.selected && (Group.selected || (Outliner.selected[0] && Outliner.selected[0].constructor.animator) || Project.motion_trail_lock)) {
		Animator.showMotionTrail();
	} else if (Animator.motion_trail.parent) {
		Animator.motion_trail.children.forEachReverse(child => {
			Animator.motion_trail.remove(child);
		})
	}
	if (Timeline.selected.length >= 2) {
		Interface.addSuggestedModifierKey('ctrl', 'modifier_actions.stretch_keyframes');
	} else {
		Interface.removeSuggestedModifierKey('ctrl', 'modifier_actions.stretch_keyframes');
	}
	BARS.updateConditions()
	Blockbench.dispatchEvent('update_keyframe_selection');
}
function selectAllKeyframes() {
	if (!Animation.selected) return;
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
function unselectAllKeyframes() {
	if (!Animation.selected) return;
	Timeline.keyframes.forEach((kf) => {
		Timeline.selected.remove(kf)
		kf.selected = false;
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
	Undo.finishEdit('Remove keyframes')
}

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
					Property.resetUniqueValues(Keyframe, kf);
					Timeline.selected.push(kf);
				}

			})
			TickUpdates.keyframe_selection = true;
			Animator.preview()
			Undo.finishEdit('Paste keyframes');
		}
	}
})

BARS.defineActions(function() {
	new Action('add_keyframe', {
		icon: 'add_circle',
		category: 'animation',
		condition: {modes: ['animate']},
		keybind: new Keybind({key: 'q', shift: null}),
		click: function (event) {
			var animator = Timeline.selected_animator;
			if (!animator) return;
			var channel = Object.keys(animator.channels)[0];
			if (Toolbox.selected.id == 'rotate_tool' && animator.channels['rotation']) channel = 'rotation';
			if (Toolbox.selected.id == 'move_tool' && animator.channels['position']) channel = 'position';
			if (Toolbox.selected.id == 'resize_tool' && animator.channels['scale']) channel = 'scale';
			if (Timeline.vue.graph_editor_open && Prop.active_panel == 'timeline' && animator.channels[Timeline.vue.graph_editor_channel]) {
				channel = Timeline.vue.graph_editor_channel;
			}
			animator.createKeyframe((event && (event.shiftKey || Pressing.overrides.shift)) ? {} : null, Timeline.time, channel, true);
			if (event && (event.shiftKey || Pressing.overrides.shift)) {
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
			BarItems.slider_keyframe_time.update()
			Undo.finishEdit('Move keyframes back')
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
			Animation.selected.setLength();
			Animator.preview()
			BarItems.slider_keyframe_time.update()
			Undo.finishEdit('Move keyframes forwards')
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
			let channel = Timeline.selected[0] ? Timeline.selected[0].channel : (animator && Object.keys(animator.channels)[0]);
			
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
			let channel = Timeline.selected[0] ? Timeline.selected[0].channel : (animator && Object.keys(animator.channels)[0]);

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

	new NumSlider('slider_keyframe_time', {
		category: 'animation',
		condition: () => Animator.open && Timeline.selected.length,
		getInterval(event) {
			if ((event && event.shiftKey) || Pressing.overrides.shift) return 1;
			return Timeline.getStep()
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
			Animation.selected.setLength();
			Undo.finishEdit('Change keyframe time')
		}
	})
	new Toggle('keyframe_uniform', {
		icon: 'link',
		category: 'animation',
		condition: () => Animator.open && Timeline.selected.length && !Timeline.selected.find(kf => kf.channel !== 'scale'),
		onChange(value) {
			let keyframes = Timeline.selected;
			Undo.initEdit({keyframes})
			keyframes.forEach((kf) => {
				kf.uniform = value;
			})
			Undo.finishEdit('Change keyframes uniform setting')
			Interface.Panels.keyframe.inside_vue.$forceUpdate();
			updateKeyframeSelection();
		}
	})
	new BarSelect('keyframe_interpolation', {
		category: 'animation',
		condition: () => Animator.open && Timeline.selected.length && Timeline.selected.find(kf => kf.transform),
		options: {
			linear: true,
			catmullrom: true,
			step: true,
		},
		onChange: function(sel, event) {
			Undo.initEdit({keyframes: Timeline.selected})
			Timeline.selected.forEach((kf) => {
				if (kf.transform) kf.interpolation = sel.value;
			})
			Undo.finishEdit('Change keyframes interpolation')
			updateKeyframeSelection();
		}
	})
	new Action('reset_keyframe', {
		icon: 'replay',
		category: 'animation',
		condition: () => Animator.open && Timeline.selected.length,
		click: function () {
			Undo.initEdit({keyframes: Timeline.selected})
			Timeline.selected.forEach((kf) => {
				kf.data_points.replace([new KeyframeDataPoint(kf)]);
			})
			Undo.finishEdit('Reset keyframes')
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
					kf.animator.fillValues(kf, null, false, false);
				}
			})
			Timeline.time = time_before;
			Undo.finishEdit('Resolve keyframes')
			updateKeyframeSelection()
		}
	})
	/*new Action('change_keyframe_file', {
		icon: 'fa-file',
		category: 'animation',
		condition: () => (Animator.open && Timeline.selected.length && ['sound', 'particle'].includes(Timeline.selected[0].channel)),
		click: function () {

			if (Timeline.selected[0].channel == 'particle') {
				Blockbench.import({
					resource_id: 'animation_particle',
					extensions: ['json'],
					type: 'Bedrock Particle',
					startpath: Timeline.selected[0].data_points[0].file
				}, function(files) {

					let {path} = files[0];
					Undo.initEdit({keyframes: Timeline.selected})
					Timeline.selected.forEach((kf) => {
						if (kf.channel == 'particle') {
							kf.data_points.forEach(data_point => {
								data_point.file = path;
							})
						}
					})
					Animator.loadParticleEmitter(path, files[0].content);
					Undo.finishEdit('Change keyframe particle file')
				})	
			} else {
				Blockbench.import({
					resource_id: 'animation_audio',
					extensions: ['ogg', 'wav', 'mp3'],
					type: 'Audio File',
					startpath: Timeline.selected[0].data_points[0].file
				}, function(files) {

					let path = isApp
						? files[0].path
						: URL.createObjectURL(files[0].browser_file);

					Undo.initEdit({keyframes: Timeline.selected})
					Timeline.selected.forEach((kf) => {
						if (kf.channel == 'sound') {
							kf.data_points.forEach(data_point => {
								data_point.file = path;
								if (!data_point.effect) data_point.effect = files[0].name.toLowerCase().replace(/\.[a-z]+$/, '').replace(/[^a-z0-9._]+/g, '');
							})
						}
					})
					Timeline.visualizeAudioFile(path);
					Undo.finishEdit('Change keyframe audio file')
				})
			}
		}
	})*/
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
				if (kf.transform && kf.data_points.length > 1) {
					kf.data_points.reverse();
				}
			})
			Undo.finishEdit('Reverse keyframes')
			updateKeyframeSelection()
			Animator.preview()
		}
	})
	let channels = ['rotation', 'position', 'scale']
	new Action('keyframe_column_create', {
		icon: 'add_road',
		category: 'animation',
		condition: () => Animator.open,
		click() {
			Timeline.selected.empty();
			let new_keyframes = [];
			Undo.initEdit({keyframes: new_keyframes})
			Timeline.animators.forEach(animator => {
				if (animator instanceof BoneAnimator == false) return;
				channels.forEach(channel => {
					if (Timeline.vue.channels[channel] !== false && animator[channel] && animator[channel].length) {
						let kf = animator[channel].find(kf => Math.epsilon(kf.time, Timeline.time, 1e-5));
						if (!kf) {
							kf = animator.createKeyframe(null, Timeline.time, channel, false, false);
							new_keyframes.push(kf)
						}
						Timeline.selected.push(kf);
						kf.selected = true;
					}
				})
			})
			updateKeyframeSelection();
			Undo.finishEdit('Create keyframe column');
		}
	})
	new Action('keyframe_column_select', {
		icon: 'unfold_more_double',
		category: 'animation',
		condition: () => Animator.open,
		click() {
			Timeline.selected.empty();
			Timeline.animators.forEach(animator => {
				if (animator instanceof BoneAnimator == false) return;
				channels.forEach(channel => {
					if (Timeline.vue.channels[channel] !== false && animator[channel] && animator[channel].length) {
						animator[channel].forEach(kf => {
							if (Math.epsilon(kf.time, Timeline.time, 1e-5) && Timeline.vue.channels[kf.channel] !== false) {
								Timeline.selected.push(kf);
								kf.selected = true;
							}
						})
					}
				})
			})
			updateKeyframeSelection();
		}
	})

	flip_action = new Action('flip_animation', {
		icon: 'transfer_within_a_station',
		category: 'animation',
		condition: {modes: ['animate'], method: () => Animation.selected},
		click() {

			if (!Animation.selected) {
				Blockbench.showQuickMessage('message.no_animation_selected')
				return;
			}

			let original_keyframes = (Timeline.selected.length ? Timeline.selected : Timeline.keyframes).slice();
			if (!original_keyframes.length) return;

			new Dialog({
				id: 'flip_animation',
				title: 'action.flip_animation',
				form: {
					info: {type: 'info', text: 'dialog.flip_animation.info'},
					offset: {label: 'dialog.flip_animation.offset', type: 'checkbox', value: false},
					show_in_timeline: {label: 'dialog.flip_animation.show_in_timeline', type: 'checkbox', value: true},
				},
				onConfirm(formResult) {
					this.hide()
					
					let new_keyframes = [];
					Undo.initEdit({keyframes: new_keyframes});
					let animators = [];
					original_keyframes.forEach(kf => animators.safePush(kf.animator));
					let channels = ['rotation', 'position', 'scale'];

					animators.forEach(animator => {
						let opposite_animator;
						channels.forEach(channel => {
							if (!animator[channel]) return;
							let kfs = original_keyframes.filter(kf => kf.channel == channel && kf.animator == animator);
							if (!kfs.length) return;
							if (!opposite_animator) {
								let name = animator.name.toLowerCase().replace(/left/g, '%LX').replace(/right/g, 'left').replace(/%LX/g, 'right');
								let opposite_bone = Group.all.find(g => g.name.toLowerCase() == name);
								if (!opposite_bone) {
									console.log(`Animation Flipping: Unable to find opposite bone for ${animator.name}`)
									return;
								}
								opposite_animator = Animation.selected.getBoneAnimator(opposite_bone);
							}

							let center_keyframe;
							if (formResult.offset && !kfs.find(kf => Math.epsilon(kf.time, Timeline.snapTime(Animation.selected.length/2), 0.004))) {
								center_keyframe = animator.createKeyframe(null, Timeline.snapTime(Animation.selected.length/2), channel, false, false);
								kfs.push(center_keyframe);
							}
							kfs.sort((a, b) => a.time - b.time);
							let occupied_times = [];
							kfs.forEach(old_kf => {
								let time = old_kf.time;
								if (formResult.offset) {
									time = (time + Animation.selected.length/2) % (Animation.selected.length + 0.001);
								}
								time = Timeline.snapTime(time);
								if (occupied_times.includes(time)) return;
								occupied_times.push(time);
								let new_kf = opposite_animator.createKeyframe(old_kf, time, channel, false, false)
								if (new_kf) {
									new_kf.flip(0);
									new_keyframes.push(new_kf);
								}
							})
							if (formResult.offset && !occupied_times.includes(0)) {
								let new_kf = opposite_animator.createKeyframe(new_keyframes.last(), 0, channel, false, false)
								if (new_kf) {
									new_keyframes.push(new_kf);
								}
							}
							if (center_keyframe) center_keyframe.remove();
						})
						if (formResult.show_in_timeline && opposite_animator) {
							opposite_animator.addToTimeline();
						}
					})
					TickUpdates.keyframes = true;
					Animator.preview();

					Undo.finishEdit('Copy and flip keyframes');
				}
			}).show()
		}
	})
	MenuBar.addAction(flip_action, 'animation')
})

Interface.definePanels(function() {

	let locator_suggestion_list = $('<datalist id="locator_suggestion_list" hidden></datalist>').get(0);
	document.body.append(locator_suggestion_list);
	
	new Panel('keyframe', {
		icon: 'icon-keyframe',
		condition: {modes: ['animate']},
		default_position: {
			slot: 'left_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400
		},
		toolbars: {
			head: Toolbars.keyframe
		},
		component: {
			name: 'panel-keyframe',
			components: {VuePrismEditor},
			data() { return {
				keyframes: Timeline.selected,
				channel_colors: {
					x: 'color_x',
					y: 'color_y',
					z: 'color_z',
				}
			}},
			methods: {
				updateInput(axis, value, data_point) {
					updateKeyframeValue(axis, value, data_point);
				},
				getKeyframeInfos() {
					let list =  [tl('timeline.'+this.channel)];
					if (this.keyframes.length > 1) list.push(this.keyframes.length);
					return list.join(', ')
				},
				addDataPoint() {
					Undo.initEdit({keyframes: Timeline.selected})
					Timeline.selected.forEach(kf => {
						if (kf.data_points.length < kf.animator.channels[kf.channel].max_data_points) {
							kf.data_points.push(new KeyframeDataPoint(kf))
							kf.data_points.last().extend(kf.data_points[0])
						}
					})
					Animator.preview()
					Undo.finishEdit('Add keyframe data point')
				},
				removeDataPoint(data_point_index) {
					Undo.initEdit({keyframes: Timeline.selected})
					Timeline.selected.forEach(kf => {
						if (kf.data_points.length >= 2) {
							kf.data_points.splice(data_point_index, 1);
						}
					})
					Animator.preview()
					Undo.finishEdit('Remove keyframe data point')
				},
				updateLocatorSuggestionList() {
					locator_suggestion_list.innerHTML = '';
					Locator.all.forEach(locator => {
						let option = document.createElement('option');
						option.value = locator.name;
						locator_suggestion_list.append(option);
					})
				},
				focusAxis(axis) {
					if ('xyz'.includes(axis)) {
						Timeline.vue.graph_editor_axis = axis;
					}
				},
				slideValue(axis, e1) {
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
						Undo.initEdit({keyframes: Keyframe.selected});
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
							let val = Math.round((clientX - e1.clientX) / 40);
							let difference = (val - last_val);
							if (difference) {
								if (Toolbox.selected.id === 'rotate_tool') {
									difference *= getRotationInterval(e2);
								} else {
									difference *= canvasGridSize(e2.shiftKey || Pressing.overrides.shift, e2.ctrlOrCmd || Pressing.overrides.ctrl);
								}
							
								Keyframe.selected.forEach(kf => {
									kf.offset(axis, difference);
								})

								last_val = val;
								total += difference;

								Animator.preview()
								Blockbench.setStatusBarText(trimFloatNumber(total));
							}
							last_event = e2;
							move_calls++;
						}
					}
					function off(e2) {
						if (document.exitPointerLock) document.exitPointerLock()
						removeEventListeners(document, 'mousemove touchmove', move);
						removeEventListeners(document, 'mouseup touchend', off);
						if (total) {
							Undo.finishEdit('Slide keyframe');
						} else {
							Undo.cancelEdit();
						}
					}
					addEventListeners(document, 'mouseup touchend', off);
					addEventListeners(document, 'mousemove touchmove', move);
				},
				changeKeyframeFile(data_point, keyframe) {
					if (keyframe.channel == 'particle') {
						Blockbench.import({
							resource_id: 'animation_particle',
							extensions: ['json'],
							type: 'Bedrock Particle',
							startpath: keyframe.data_points[0].file
						}, function(files) {

							let {path} = files[0];
							Undo.initEdit({keyframes: [keyframe]})
							data_point.file = path;
							let effect = Animator.loadParticleEmitter(path, files[0].content);
							delete effect.config.preview_texture;
							Undo.finishEdit('Change keyframe particle file');

							if (!isApp || effect.config.texture.image.src.match(/^data:/)) {
								Blockbench.import({
									extensions: ['png'],
									type: 'Particle Texture',
									readtype: 'image',
									startpath: effect.config.preview_texture || path
								}, function(files) {
									effect.config.preview_texture = isApp ? files[0].path : files[0].content;
									if (isApp) effect.config.updateTexture();
								})
							}
						})
					} else {
						Blockbench.import({
							resource_id: 'animation_audio',
							extensions: ['ogg', 'wav', 'mp3'],
							type: 'Audio File',
							startpath: keyframe.data_points[0].file
						}, function(files) {

							let path = isApp
								? files[0].path
								: URL.createObjectURL(files[0].browser_file);

							Undo.initEdit({keyframes: [keyframe]})
							data_point.file = path;
							if (!data_point.effect) data_point.effect = files[0].name.toLowerCase().replace(/\.[a-z]+$/, '').replace(/[^a-z0-9._]+/g, '');
							Timeline.visualizeAudioFile(path);
							Undo.finishEdit('Change keyframe audio file')
						})
					}
				},
				tl,
				Condition
			},
			computed: {
				channel() {
					var channel = false;
					for (var kf of this.keyframes) {
						if (channel === false) {
							channel = kf.channel
						} else if (channel !== kf.channel) {
							channel = false
							break;
						}
					}
					return channel;
				}
			},
			template: `
				<div>
					<div class="toolbar_wrapper keyframe"></div>

					<template v-if="channel != false">

						<div id="keyframe_type_label">
							<label>{{ tl('panel.keyframe.type', [getKeyframeInfos()]) }}</label>
							<div
								class="in_list_button"
								v-if="keyframes[0].animator.channels[channel] && keyframes[0].data_points.length < keyframes[0].animator.channels[channel].max_data_points && keyframes[0].interpolation !== 'catmullrom'"
								v-on:click.stop="addDataPoint()"
								title="${ tl('panel.keyframe.change_effect_file') }"
							>
								<i class="material-icons">add</i>
							</div>
						</div>

						<ul class="list">

							<div v-for="(data_point, data_point_i) of keyframes[0].data_points" class="keyframe_data_point">

								<div class="keyframe_data_point_header" v-if="keyframes[0].data_points.length > 1">
									<label>{{ keyframes[0].transform ? tl('panel.keyframe.' + (data_point_i ? 'post' : 'pre')) : (data_point_i + 1) }}</label>
									<div class="flex_fill_line"></div>
									<div class="in_list_button" v-on:click.stop="removeDataPoint(data_point_i)" title="${ tl('panel.keyframe.remove_data_point') }">
										<i class="material-icons">clear</i>
									</div>
								</div>

								<template v-if="channel == 'scale' && keyframes[0].uniform && data_point.x_string == data_point.y_string && data_point.y_string == data_point.z_string">
									<div
										class="bar flex"
										id="keyframe_bar_uniform_scale"
									>
										<label>${ tl('generic.all') }</label>
										<vue-prism-editor 
											class="molang_input dark_bordered keyframe_input tab_target"
											v-model="data_point['x_string']"
											@change="updateInput('uniform', $event, data_point_i)"
											language="molang"
											:ignoreTabKey="true"
											:line-numbers="false"
										/>
									</div>
								</template>


								<template v-else>
									<div
										v-for="(property, key) in data_point.constructor.properties"
										v-if="property.exposed != false && Condition(property.condition, data_point)"
										class="bar flex"
										:id="'keyframe_bar_' + property.name"
									>
										<label :class="{[channel_colors[key]]: true, slidable_input: property.type == 'molang'}" :style="{'font-weight': channel_colors[key] ? 'bolder' : 'unset'}" @mousedown="slideValue(key, $event)" @touchstart="slideValue(key, $event)">{{ property.label }}</label>
										<vue-prism-editor 
											v-if="property.type == 'molang'"
											class="molang_input dark_bordered keyframe_input tab_target"
											v-model="data_point[key+'_string']"
											@change="updateInput(key, $event, data_point_i)"
											@focus="focusAxis(key)"
											language="molang"
											:ignoreTabKey="true"
											:line-numbers="false"
										/>
										<input
											v-else
											type="text"
											class="dark_bordered code keyframe_input tab_target"
											v-model="data_point[key]"
											:list="key == 'locator' && 'locator_suggestion_list'"
											@focus="key == 'locator' && updateLocatorSuggestionList()"
											@input="updateInput(key, $event.target.value, data_point_i)"
										/>
										<div class="tool" v-if="key == 'effect'" title="${tl('action.change_keyframe_file')}" @click="changeKeyframeFile(data_point, keyframes[0])">
											<i class="material-icons">upload_file</i>
										</div>
									</div>
								</template>
							</div>
						</ul>
					</template>
				</div>
			`
		}
	})

	let keyframe_edit_value;
	function isTarget(target) {
		return target && target.classList && (target.classList.contains('keyframe_input') || (target.parentElement && target.parentElement.classList.contains('keyframe_input')));
	}
	document.addEventListener('focus', event => {
		if (isTarget(event.target)) {

			keyframe_edit_value = event.target.value || event.target.innerText;
			Undo.initEdit({keyframes: Timeline.selected.slice()})
		}
	}, true)
	document.addEventListener('focusout', event => {
		if (isTarget(event.target)) {

			let val = event.target.value || event.target.innerText;
			if (val != keyframe_edit_value) {
				Undo.finishEdit('Edit keyframe');
			} else {
				Undo.cancelEdit();
			}
		}
	})
})
