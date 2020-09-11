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

const Timeline = {
	animators: [],
	selected: [],//frames
	playing_sounds: [],
	playback_speed: 100,
	time: 0,
	get second() {return Timeline.time},
	get animation_length() {return Animator.selected ? Animator.selected.length : 0;},
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

			Timeline.selected.empty()
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
						(kf.channel == focus || !focus || focus == 'used')
					) {
						var channel_index = focus ? 0 : animator.channels.indexOf(kf.channel);
						if (focus == 'used') {
							for (var channel of animator.channels) {
								if (kf.channel == channel) break;
								channel_index++;
							}
						}
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

			let speed = 15;

			if (top < 0) body.scrollTop  = body.scrollTop  - speed;
			if (bot < 0) body.scrollTop  = Math.clamp(body.scrollTop  + speed, 0, body_inner.clientHeight - body.clientHeight + 3);
			if (lef < 0) body.scrollLeft = body.scrollLeft - speed;
			if (rig < 0) body.scrollLeft = Math.clamp(body.scrollLeft + speed, 0, body_inner.clientWidth - body.clientWidth);
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
		if (Timeline.getMaxLength() !== Timeline.vue._data.length) {
			Timeline.updateSize()
		}
		Timeline.revealTime(seconds)
	},
	revealTime(time) {
		var scroll = $('#timeline_body').scrollLeft()
		var playhead = time * Timeline.vue._data.size + 8
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

			if (e.target.id == 'timeline_endbracket') {

				if (Animator.selected) {
					Timeline.dragging_endbracket = true;
					Undo.initEdit({animations: [Animator.selected]});
				} else {
					Blockbench.showQuickMessage('message.no_animation_selected');
				}

			} else {

				convertTouchEvent(e);
				Timeline.dragging_playhead = true;
				
				let offset = e.clientX - $('#timeline_time').offset().left;
				let time = Timeline.snapTime(offset / Timeline.vue._data.size);
				Timeline.setTime(time);
				Animator.preview();
			}
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
			} else if (Timeline.dragging_endbracket) {

				convertTouchEvent(e);
				let offset = e.clientX - $('#timeline_time').offset().left;
				let time = Timeline.snapTime(offset / Timeline.vue._data.size)
				
				Animator.selected.setLength(time)
				Timeline.revealTime(time)

			}
		})
		.on('mouseup touchend', e => {
			if (Timeline.dragging_playhead) {
				delete Timeline.dragging_playhead
				Timeline.pause();

			} else if (Timeline.dragging_endbracket) {

				Undo.finishEdit('Change Animation Length')
				delete Timeline.dragging_endbracket
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

		$('#timeline_vue').on('mousewheel scroll', function(e) {
			e.preventDefault()
			var body = $('#timeline_body').get(0)
			if (event.shiftKey) {
				body.scrollLeft += event.deltaY/4

			} else if  (event.ctrlOrCmd) {

				let mouse_pos = event.clientX - $(this).offset().left;

				var zoom = 1 - event.deltaY/600
				let original_size = Timeline.vue._data.size
				Timeline.vue._data.size = limitNumber(Timeline.vue._data.size * zoom, 10, 1000)
				//let val = ((body.scrollLeft + mouse_pos) * (Timeline.vue._data.size - original_size) ) / 128

				let size_ratio = Timeline.vue._data.size / original_size
				let offset = mouse_pos - body.scrollLeft - 180
				let val = (size_ratio-1) * offset;
				// todo: optimize zooming in
				body.scrollLeft += val
				/*
				Timeline.vue._data.size = limitNumber(Timeline.vue._data.size * zoom, 10, 1000)
				body.scrollLeft *= zoom
				let l = (event.offsetX / body.clientWidth) * 500 * (event.deltaY<0?1:-0.2)
				body.scrollLeft += l
				*/

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
				setTimeout(() => {
					Timeline.dragging_keyframes = false;
				}, 20)
			}
		})
	},
	getMaxLength() {
		var max_length = ($('#timeline_body').width()-8) / Timeline.vue._data.size;
		Timeline.keyframes.forEach((kf) => {
			max_length = Math.max(max_length, kf.time)
		})
		max_length = Math.max(max_length, Timeline.time) + 50/Timeline.vue._data.size
		return max_length;
	},
	updateSize() {
		let size = Timeline.vue._data.size
		Timeline.vue._data.length = Timeline.getMaxLength()
		Timeline.vue._data.timecodes.empty()

		var step = 1
		if (size < 1) {step = 1}
		else if (size < 20) {step = 4}
		else if (size < 40) {step = 2}
		else if (size < 100) {step = 1}
		else if (size < 256) {step = 0.5}
		else if (size < 520) {step = 0.25}
		else if (size < 660) {step = 0.2}
		else if (size < 860) {step = 0.1}
		else {step = 0.05}


		if (step < 1) {
			var FPS = Timeline.getStep();
			step = Math.round(step/FPS) * FPS
			//step = 1/Math.round(1/step)
		}

		let substeps = step / Timeline.getStep()
		while (substeps > 8) {
			substeps /= 2;
		}
		//substeps = Math.round(substeps)


		var i = 0;
		while (i < Timeline.vue._data.length) {
			Timeline.vue._data.timecodes.push({
				time: i,
				width: step,
				substeps: substeps,
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
		Timeline.interval = setInterval(Timeline.loop, 100/6)
		if (Animator.selected.loop == 'hold' && Timeline.time >= (Animator.selected.length||1e3)) {
			Timeline.setTime(0)
		}
		Timeline.loop()
	},
	loop() {
		Animator.preview()
		if (Animator.selected && Timeline.time < (Animator.selected.length||1e3)) {

			let new_time = (Animator.selected && Animator.selected.anim_time_update)
						 ? Molang.parse(Animator.selected.anim_time_update)
						 : Timeline.time + (1/60);
			Timeline.setTime(new_time * (Timeline.playback_speed/100));

		} else {
			if (Animator.selected.loop == 'once') {
				Timeline.setTime(0)
				Animator.preview()
				Timeline.pause()
			} else if (Animator.selected.loop == 'hold') {
				Timeline.pause()
			} else {
				Timeline.setTime(0)
				Timeline.start()
			}
		}
	},
	pause() {
		Timeline.playing = false;
		BarItems.play_animation.setIcon('play_arrow')
		if (Timeline.interval) {
			clearInterval(Timeline.interval)
			Timeline.interval = false
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
		'fold_all_animations',
		'clear_timeline',
	])
}

onVueSetup(function() {
	Timeline.vue = new Vue({
		el: '#timeline_vue',
		data: {
			size: 150,
			length: 10,
			animation_length: 0,
			scroll_left: 0,
			head_width: 180,
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


BARS.defineActions(function() {
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
	new Action('jump_to_timeline_start', {
		icon: 'skip_previous',
		category: 'animation',
		condition: {modes: ['animate']},
		keybind: new Keybind({key: 36}),
		click: function () {
			Timeline.setTime(0)
			Animator.preview()
		}
	})

	new Action('jump_to_timeline_end', {
		icon: 'skip_next',
		category: 'animation',
		condition: {modes: ['animate']},
		keybind: new Keybind({key: 35}),
		click: function () {
			Timeline.setTime(Animator.selected ? Animator.selected.length : 0)
			Animator.preview()
		}
	})

	new Action('bring_up_all_animations', {
		icon: 'fa-sort-amount-up',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function () {
			if (!Animator.selected) return;
			for (var uuid in Animator.selected.animators) {
				var ba = Animator.selected.animators[uuid]
			    if (ba && ba.keyframes.length) {
			        ba.addToTimeline();
			    }
			}

		}
	})
	new Action('fold_all_animations', {
		icon: 'format_indent_decrease',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function () {
			for (var animator of Timeline.animators) {
			    animator.expanded = false;
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
			used: true,
			rotation: tl('timeline.rotation'),
			position: tl('timeline.position'),
			scale: tl('timeline.scale'),
		},
		onChange: function(slider) {
			var val = slider.get();
			Timeline.vue._data.focus_channel = val != 'all' ? val : null;
		}
	})
	new Action('add_marker', {
		icon: 'flag',
		category: 'animation',
		condition: {modes: ['animate']},
		keybind: new Keybind({ctrl: true, key: 77}),
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
})