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
	getUndoCopy() {
		return {
			color: this.color,
			time: this.time,
		}
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
	{name: 'menu.cube.color', icon: 'color_lens', children() {
		return [
			...markerColors.map((color, i) => {return {
				icon: 'flag',
				color: color.standard,
				name: color.name || 'cube.color.'+color.id,
				click(marker) {marker.color = i;}
			}})
		];
	}},
	{
		name: 'menu.timeline_marker.set_time',
		icon: 'schedule',
		click(marker) {
			new Dialog({
				id: 'timeline_marker_set_time',
				title: 'menu.timeline_marker.set_time',
				form: {
					time: {label: 'action.slider_keyframe_time', value: Math.roundTo(marker.time, 4), type: 'number', min: 0}
				},
				onConfirm(form) {
					marker.time = form.time;
				}
			}).show();
		}
	},
	'_',
	{icon: 'delete', name: 'generic.delete', click: function(marker) {
		if (Animation.selected) Animation.selected.markers.remove(marker);
	}}
])

const Timeline = {
	animators: [],
	selected: Keyframe.selected,//frames
	playing_sounds: [],
	playback_speed: 100,
	time: 0,
	get second() {return Timeline.time},
	get animation_length() {return Animation.selected ? Animation.selected.length : 0;},
	playing: false,
	selector: {
		start: [0, 0],
		selecting: false,
		selected_before: [],
		down(e) {
			if (e.which !== 1 || (
				!e.target.classList.contains('keyframe_section') &&
				!e.target.classList.contains('animator_head_bar') &&
				e.target.id !== 'timeline_graph_editor' &&
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
			if (e.shiftKey || Pressing.overrides.shift) {
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
			let {channels} = Timeline.vue._data;
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
						channels[kf.channel] != false &&
						(!Timeline.vue.graph_editor_open || (kf.channel == Timeline.vue.graph_editor_channel && animator.selected)) &&
						(!channels.hide_empty || animator[kf.channel].length)
					) {
						if (!Timeline.vue.graph_editor_open) {

							var channel_index = 0 //animator.channels.indexOf(kf.channel);
							for (var channel in animator.channels) {
								if (kf.channel == channel) break;
								if (channels[channel] != false && (!channels.hide_empty || animator[channel].length)) {
									channel_index++;
								}
							}
							var height = offset + channel_index*24 + 36;

						} else {
							var height = Timeline.vue.graph_offset - (kf.display_value || 0) * Timeline.vue.graph_size + Timeline.vue.scroll_top;
						}
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
			let speed = 15;

			var lef = mouse_pos.x - R.panel_offset[0] - body.scrollLeft - Timeline.vue._data.head_width;
			var rig = body.clientWidth - (mouse_pos.x - R.panel_offset[0] - body.scrollLeft);
			if (lef < 0) body.scrollLeft = body.scrollLeft - speed;
			if (rig < 0) body.scrollLeft = Math.clamp(body.scrollLeft + speed, 0, body_inner.clientWidth - body.clientWidth);

			if (!Timeline.vue.graph_editor_open) {
				var top = mouse_pos.y - R.panel_offset[1] - body.scrollTop;
				var bot = body.scrollTop + body.clientHeight - (mouse_pos.y - R.panel_offset[1]);
				if (top < 0) body.scrollTop  = body.scrollTop  - speed;
				if (bot < 0) body.scrollTop  = Math.clamp(body.scrollTop  + speed, 0, body_inner.clientHeight - body.clientHeight + 3);
			}

			updateKeyframeSelection()
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
		var scroll = $('#timeline_body').scrollLeft();
		var playhead = time * Timeline.vue._data.size + 8;
		if (playhead < scroll || playhead > scroll + $('#timeline_vue').width() - Timeline.vue._data.head_width) {
			$('#timeline_body').scrollLeft(playhead-16);
		} else if (time == 0) {
			$('#timeline_body').scrollLeft(0);
		}
	},
	setTimecode(time) {
		let second_fractions = settings.timecode_frame_number.value ? 1/Timeline.getStep() : 100;
		let m = Math.floor(time/60)
		let s = Math.floor(time%60)
		let f = Math.floor((time%1) * second_fractions)
		if ((s+'').length === 1) {s = '0'+s}
		if ((f+'').length === 1) {f = '0'+f}
		$('#timeline_timestamp').text(m + ':' + s  + ':' + f)
	},
	snapTime(time, animation) {
		//return time;
		if (time == undefined || isNaN(time)) {
			time = Timeline.time;
		}
		if (!animation) animation = Animation.selected;
		var fps = Math.clamp(animation ? animation.snapping : settings.animation_snap.value, 1, 120);
		return Math.clamp(Math.round(time*fps)/fps, 0);
	},
	getStep() {
		return 1/Math.clamp(Animation.selected ? Animation.selected.snapping : settings.animation_snap.value, 1, 120);
	},
	setup() {
		$('#timeline_body').on('mousedown', e => {
			if (e.which === 2) {
				let pos = [e.clientX, e.clientY];
				let timeline = e.currentTarget;
				function move(e2) {
					timeline.scrollLeft += pos[0] - e2.clientX;
					if (!Timeline.vue.graph_editor_open) {
						timeline.scrollTop += pos[1] - e2.clientY;
					}
					pos = [e2.clientX, e2.clientY];
				}
				function stop(e2) {
					document.removeEventListener('mousemove', move);
					document.removeEventListener('mouseup', stop);
				}
				document.addEventListener('mousemove', move);
				document.addEventListener('mouseup', stop);
				e.preventDefault();
			} else {
				Timeline.selector.down(e);
			}
		})

		$('#timeline_time').on('mousedown touchstart', e => {
			if (e.which !== 1 && !event.changedTouches) return;
			if (e.target.classList.contains('timeline_marker')) return;

			if (e.target.id == 'timeline_endbracket') {

				if (Animation.selected) {
					Timeline.dragging_endbracket = true;
					Undo.initEdit({animations: [Animation.selected]});
				} else {
					Blockbench.showQuickMessage('message.no_animation_selected');
				}

			} else {

				convertTouchEvent(e);
				Timeline.dragging_playhead = true;
				if (Timeline.playing) Timeline.pause();
				
				let offset = e.clientX - $('#timeline_time').offset().left;
				let time = Math.clamp(offset / Timeline.vue._data.size, 0, Infinity);
				if (!e.ctrlOrCmd && !Pressing.overrides.ctrl) time = Timeline.snapTime(time);
				Timeline.setTime(time);
				Animator.preview();
				Interface.addSuggestedModifierKey('ctrl', 'modifier_actions.drag_without_snapping');
				if (e.shiftKey || Pressing.overrides.shift) {
					time = Timeline.snapTime(time);

					for (let i = 0; i < Timeline.animators.length; i++) {
						let animator = Timeline.animators[i];
						for (let channel in animator.channels) {
							if (Timeline.vue.channels[channel] !== false) {
								let match = animator[channel].find(kf => Math.epsilon(kf.time, time, 0.01));
								if (match && !match.selected) {
									match.selected = true;
									Timeline.selected.push(match);
								}
							}
						}
					}
					updateKeyframeSelection();
				}
			}
		})
		$(document).on('mousemove touchmove', e => {
			if (Timeline.dragging_playhead) {

				convertTouchEvent(e);
				let offset = e.clientX - $('#timeline_time').offset().left;
				let time = Math.clamp(offset / Timeline.vue._data.size, 0, Infinity);
				if (!e.ctrlOrCmd && !Pressing.overrides.ctrl) time = Timeline.snapTime(time);
				if (Timeline.time != time) {
					Timeline.setTime(time)
					Animator.preview()
				}
			} else if (Timeline.dragging_endbracket) {

				convertTouchEvent(e);
				let offset = e.clientX - $('#timeline_time').offset().left;
				let time = Timeline.snapTime(offset / Timeline.vue._data.size)
				
				Animation.selected.setLength(time)
				Timeline.revealTime(time)

			}
		})
		.on('mouseup touchend', e => {
			if (Timeline.dragging_playhead) {
				delete Timeline.dragging_playhead;
				Interface.removeSuggestedModifierKey('ctrl', 'modifier_actions.drag_without_snapping');
				Timeline.pause();

			} else if (Timeline.dragging_endbracket) {

				Undo.finishEdit('Change Animation Length')
				delete Timeline.dragging_endbracket
			}
		})
		
		//Enter Time
		$('#timeline_timestamp').click(e => {
			if ($('#timeline_timestamp').attr('contenteditable') == 'true') return;

			$('#timeline_timestamp').attr('contenteditable', true).focus().select()
			var times = $('#timeline_timestamp').text().split(':')
			while (times.length < 3) {
				times.push('00')
			}
			var node = $('#timeline_timestamp').get(0).childNodes[0]
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
				$('#timeline_timestamp').attr('contenteditable', false)
				Timeline.setTimecode(Timeline.time)
			}
		})
		.on('keyup', e => {
			var times = $('#timeline_timestamp').text().split(':')
			times.forEach((t, i) => {
				times[i] = parseInt(t)
				if (isNaN(times[i])) {
					times[i] = 0
				}
			})
			while (times.length < 3) {
				times.push(0)
			}
			let second_fractions = settings.timecode_frame_number.value ? 1/Timeline.getStep() : 100;
			let seconds
				= times[0]*60
				+ limitNumber(times[1], 0, 59)
				+ limitNumber(times[2]/second_fractions, 0, second_fractions-1)
			if (Math.abs(seconds-Timeline.time) > 1e-3 ) {
				Timeline.setTime(seconds, true)
				Animator.preview()
			}
		})

		$('#timeline_vue').on('mousewheel scroll', function(e) {
			e.preventDefault()
			let event = e.originalEvent;
			let body = document.getElementById('timeline_body');
			if (event.shiftKey) {
				body.scrollLeft += event.deltaY/4

			} else if  (event.ctrlOrCmd) {

				let offset = $('#timeline_body_inner').offset()
				let offsetX = event.clientX - offset.left - Timeline.vue._data.head_width;
				
				var zoom = 1 - event.deltaY/600
				let original_size = Timeline.vue._data.size
				let updated_size = limitNumber(Timeline.vue._data.size * zoom, 10, 1000)
				Timeline.vue._data.size = updated_size;
				
				body.scrollLeft += (updated_size - original_size) * (offsetX / original_size)

			} else {
				body.scrollTop += event.deltaY/6.25
			}
			Timeline.updateSize()
			event.preventDefault();
		});

		BarItems.slider_animation_speed.update()
		Timeline.is_setup = true
		Timeline.setTime(0)
	},
	getMaxLength() {
		let width = (document.getElementById('timeline_vue')||0).clientWidth;
		var max_length = (width-8) / Timeline.vue._data.size;
		if (Animation.selected) max_length = Math.max(max_length, Animation.selected.length)
		Timeline.keyframes.forEach((kf) => {
			max_length = Math.max(max_length, kf.time)
		})
		max_length = Math.max(max_length, Timeline.time) + 50/Timeline.vue._data.size
		return max_length;
	},
	updateSize() {
		Timeline.vue.updateTimecodes();
	},
	updateScroll(e) {
		$('.channel_head').css('left', scroll_amount+'px')
		$('#timeline_time').css('left', -scroll_amount+'px')
	},
	unselect(e) {
		if (!Animation.selected) return;
		Timeline.keyframes.forEach((kf) => {
			if (kf.selected) {
				Timeline.selected.remove(kf)
			}
			kf.selected = false
		})
		TickUpdates.keyframe_selection = true;
	},
	clear() {
		Timeline.animators.purge();
		Timeline.selected.empty();
		Timeline.vue.markers = [];
		Timeline.vue.animation_length = 0;
		updateKeyframeSelection();
	},
	start() {
		if (!Animation.selected) return;
		Animation.selected.getMaxLength()
		if (Timeline.playing) {
			Timeline.pause()
		}
		Timeline.playing = true
		BarItems.play_animation.setIcon('pause')
		Timeline.last_frame_timecode = Date.now();
		if (Animation.selected.loop == 'hold' && Timeline.time >= (Animation.selected.length||1e3)) {
			Timeline.setTime(0)
		}
		if (Timeline.time > 0) {
			Animator.animations.forEach(animation => {
				if (animation.playing && animation.animators.effects) {
					animation.animators.effects.startPreviousSounds();
				}
			})
		}
		Timeline.loop()
	},
	loop() {
		Animator.preview(true);
		if (Animation.selected && Timeline.time < (Animation.selected.length||1e3)) {

			var new_time;
			if (Animation.selected && Animation.selected.anim_time_update) {
				var new_time = Animator.MolangParser.parse(Animation.selected.anim_time_update);
			}
			if (new_time == undefined || new_time <= Timeline.time) {
				var new_time = Animator.MolangParser.parse('query.anim_time + query.delta_time')
			}
			let time = Timeline.time + (new_time - Timeline.time) * (Timeline.playback_speed/100)
			if (Animation.selected.loop == 'hold') {
				time = Math.clamp(time, 0, Animation.selected.length);
			}
			Timeline.setTime(time);
			Timeline.last_frame_timecode = Date.now();

		} else {
			if (Animation.selected.loop == 'once') {
				Timeline.setTime(0)
				Animator.preview()
				Timeline.pause()
			} else if (Animation.selected.loop == 'hold') {
				Timeline.pause()
			} else {
				Timeline.setTime(0)
			}
		}
	},
	pause() {
		Animator.preview();
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

	waveforms: {},
	waveform_sample_rate: 60,
	async visualizeAudioFile(path) {

		if (!Timeline.waveforms[path]) {
			Timeline.waveforms[path] = {
				samples: [],
				duration: 0
			};
		}
		let {samples} = Timeline.waveforms[path];

		let audioContext = new AudioContext()
		let response = await fetch(path);
		let arrayBuffer = await response.arrayBuffer();
		let audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
		let data_array = audioBuffer.getChannelData(0);

		Timeline.waveforms[path].duration = audioBuffer.duration;
		
		// Sample
		let sample_count = Math.ceil(audioBuffer.duration * Timeline.waveform_sample_rate);
		samples.splice(0, samples.length);
		for (var i = 0; i < sample_count; i++) {
			samples.push(0);
		}
		for (var i = 0; i < data_array.length; i++) {
			let sample_index = Math.floor((i / data_array.length) * sample_count);
			samples[sample_index] += Math.abs(data_array[i]);
		}

		// Normalize
		let max = Math.max(...samples);
		samples.forEach((v, i) => samples[i] = v / max);
		
		Timeline.vue.$forceUpdate();

		return samples;
	},
	
	get keyframes() {
		var keyframes = [];
		if (!Timeline.vue.graph_editor_open) {
			Timeline.animators.forEach(animator => {
				keyframes.push(...animator.keyframes)
			})
		} else if (Timeline.vue.graph_editor_animator && Timeline.vue.graph_editor_animator[Timeline.vue.graph_editor_channel]) {
			keyframes.push(...Timeline.vue.graph_editor_animator[Timeline.vue.graph_editor_channel])
		}
		return keyframes;
	},
	showMenu(event) {
		if (event.target.nodeName == 'KEYFRAME' || event.target.parentElement.nodeName == 'KEYFRAME') return;
		Timeline.menu.open(event, event);
	},
	menu: new Menu([
		'paste',
		'_',
		{name: 'menu.view.zoom', id: 'zoom', condition: isApp, icon: 'search', children: [
			'zoom_in',
			'zoom_out',
			'zoom_reset'
		]},
		'select_all',
		'fold_all_animations',
		'_',
		'timeline_setups',
		'save_timeline_setup',
		'bring_up_all_animations',
		'clear_timeline',
		'_',
		'graph_editor_zero_line',
	])
}

Interface.definePanels(() => {
	Timeline.panel = new Panel('timeline', {
		icon: 'timeline',
		condition: {modes: ['animate']},
		default_position: {
			slot: 'bottom',
			float_position: [100, 400],
			float_size: [600, 300],
			height: 260,
		},
		toolbars: {
			timeline: Toolbars.timeline
		},
		onResize() {
			Timeline.updateSize();
		},
		component: {
			name: 'panel-timeline',
			data() {return {
				size: 200,
				length: 10,
				animation_length: 0,
				scroll_left: 0,
				scroll_top: 0,
				head_width: Interface.data.timeline_head,
				timecodes: [],
				animators: Timeline.animators,
				markers: [],
				waveforms: Timeline.waveforms,
				focus_channel: null,
				playhead: Timeline.time,

				graph_editor_open: false,
				graph_editor_channel: 'rotation',
				graph_editor_axis: 'x',
				graph_offset: 200,
				graph_size: 200,
				show_zero_line: true,
				loop_graph: '',

				channels: {
					rotation: true,
					position: true,
					scale: true,
					hide_empty: false,
				}
			}},
			computed: {
				graph_editor_animator() {
					return this.animators.find(animator => animator.selected && animator instanceof BoneAnimator);
				},
				zero_line() {
					let height = this.graph_offset;
					return `M0 ${height} L10000 ${height}`
				},
				one_line() {
					let height = this.graph_offset - this.graph_size;
					return `M0 ${height} L10000 ${height}`
				},
				graph() {
					let ba = this.graph_editor_animator;
					if (!ba || !ba[this.graph_editor_channel] || !ba[this.graph_editor_channel].length) {
						this.loop_graph = '';
						return '';
					}
					let original_time = Timeline.time;
					let step = 2;
					let clientWidth = this.$refs.timeline_body ? this.$refs.timeline_body.clientWidth : 400;
					let clientHeight = this.$refs.timeline_body ? this.$refs.timeline_body.clientHeight : 400;
					let keyframes = ba[this.graph_editor_channel];
					let points = [];
					let loop_points = [];
					let min = this.show_zero_line ? -1 : 10000,
						max = this.show_zero_line ? 1 : -10000;

					for (let time = Math.clamp(this.scroll_left - 9, 0, Infinity); time < (clientWidth + this.scroll_left - this.head_width); time += step) {
						Timeline.time = time / this.size;

						let snap_kf = keyframes.find(kf => Timeline.time <= kf.time && Timeline.time > kf.time - step / this.size );
						if (snap_kf) {
							Timeline.time = snap_kf.time;
						}
						Animator.resetLastValues();
						let value = ba.interpolate(this.graph_editor_channel, false, this.graph_editor_axis);
						if (snap_kf) snap_kf.display_value = value;
						
						if (Timeline.time > Animation.selected.length && Animation.selected.length && Animation.selected.loop === 'loop') {
							if (points.length && !loop_points.length) loop_points.push(points.last())
							loop_points.push(value);
						} else {
							points.push(value);
							min = Math.min(min, value);
							max = Math.max(max, value);
						}
					}
					
					Timeline.time = original_time;

					let padding = 16;
					let min_size = 2.4;
					let unit_size = Math.clamp(max-min, min_size, 1e4);
					this.graph_size = (clientHeight - 2*padding) / unit_size;
					let blend = Math.clamp(1 - (max-min) / min_size, 0, 1)
					this.graph_offset = clientHeight - padding + (this.graph_size * (min - unit_size/2 * blend ) );

					let string = '';
					points.forEach((value, i) => {
						string += `${string.length ? 'L' : 'M'}${i*step} ${this.graph_offset - value * this.graph_size} `
					})

					this.loop_graph = '';
					if (loop_points.length) {
						loop_points.forEach((value, i) => {
							i = i + points.length - 1;
							this.loop_graph += `${this.loop_graph.length ? 'L' : 'M'}${i*step} ${this.graph_offset - value * this.graph_size} `
						})
					}

					return string;
				}
			},
			methods: {
				tl,
				updateTimecodes() {
					if (!this._isMounted) return;
					this.timecodes.empty();
					let second_fractions = settings.timecode_frame_number.value ? 1/Timeline.getStep() : 100;
					let timeline_container_width = Panels.timeline.node.clientWidth - this.head_width;
					this.length = Timeline.getMaxLength();

					var step = 1
					if (this.size < 1) {step = 1}
					else if (this.size < 20) {step = 4}
					else if (this.size < 40) {step = 2}
					else if (this.size < 100) {step = 1}
					else if (this.size < 256) {step = 0.5}
					else if (this.size < 520) {step = 0.25}
					else if (this.size < 660) {step = 0.2}
					else if (this.size < 860) {step = 0.1}
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
					
					var i = Math.floor(this.scroll_left / this.size / step) * step;
					while (i < Math.ceil((this.scroll_left + timeline_container_width) / this.size / step) * step) {
						if (settings.timecode_frame_number.value) {
							var text = `${Math.floor(i)}:${Math.round((i % 1) * second_fractions)}`;
						} else {
							var text = Math.round(i*100)/100;
						}
						this.timecodes.push({
							time: i,
							width: step,
							substeps,
							text,
						})
						i += step;
					}

					if (this.graph_editor_open) {
						this.graph_size += 1e-5;
					}
				},
				toggleAnimator(animator) {
					animator.expanded = !animator.expanded;
				},
				removeAnimator(animator) {
					Timeline.animators.remove(animator);
				},
				toggleGlobalSpace(animator) {
					Undo.initEdit({animations: [Animation.selected]});
					animator.rotation_global = !animator.rotation_global;
					Undo.finishEdit('Toggle rotation in global space');
					Animator.preview();
				},
				selectChannel(animator, channel) {
					if (this.graph_editor_channel == channel && animator.selected) return;
					if (!animator.channels[channel].transform) return;
					if (!animator.selected) animator.select();
					// Select keyframe in new channel
					if (animator[channel].length && Keyframe.selected.length > 0) {
						if (animator[channel].length == 1 && Math.epsilon(animator[channel][0].time, Timeline.time, 0.002)) {
							animator[channel][0].select();
						} else if (animator[channel].find(kf => Math.epsilon(kf.time, Keyframe.selected[0].time))) {
							let kf = animator[channel].find(kf => Math.epsilon(kf.time, Keyframe.selected[0].time, 0.002));
							kf.select();
						} else {
							let kf = animator[channel].slice().sort((a, b) => Math.abs(a.time - Timeline.time) - Math.abs(b.time - Timeline.time))[0];
							kf.select();
						}
					}
					this.graph_editor_channel = channel;
				},
				getColor(index) {
					if (index == -1 || index == undefined) return;
					return markerColors[index % markerColors.length].standard;
				},
				getWaveformPoints(samples, size) {
					let height = 23;
					let points = [`0,${height}`];
					samples.forEach((sample, i) => {
						points.push(`${(i + 0.5) / Timeline.waveform_sample_rate * size},${(1 - sample) * height}`);
					})
					points.push(`${(samples.length) / Timeline.waveform_sample_rate * size},${height}`)
					return points.join(' ');
				},
				updateScroll() {
					this.scroll_left = this.$refs.timeline_body ? this.$refs.timeline_body.scrollLeft : 0;
					this.scroll_top = this.$refs.timeline_body ? this.$refs.timeline_body.scrollTop : 0;
				},
				dragKeyframes(clicked, e1) {
					convertTouchEvent(e1);
					let dragging_range;
					let dragging_restriction;
					let originalValue;
					let previousValue;
					let time_stretching;
					let values_changed;
					let is_setup = false;

					function setup() {
						dragging_range = [Infinity, 0];
						dragging_restriction;
						originalValue;
						previousValue = 0;
						time_stretching = !Timeline.vue.graph_editor_open && (e1.ctrlOrCmd || Pressing.overrides.ctrl) && Timeline.selected.length > 1;
						values_changed = false;

						if (!clicked.selected && !e1.shiftKey && !Pressing.overrides.shift && Timeline.selected.length != 0) {
							clicked.select()
						} else if (clicked && !clicked.selected) {
							clicked.select({shiftKey: true})
						}

						Undo.initEdit({keyframes: Timeline.selected});
						Timeline.dragging_keyframes = true;

						for (var kf of Timeline.selected) {
							kf.time_before = kf.time;
							dragging_range[0] = Math.min(dragging_range[0], kf.time);
							dragging_range[1] = Math.max(dragging_range[1], kf.time);
						}

						if (Timeline.vue.graph_editor_open) {
							// Find dragging restriction
							dragging_restriction = [-Infinity, Infinity];
							let ba = this.graph_editor_animator || 0;
							let all_keyframes = ba[this.graph_editor_channel];
							if (all_keyframes) {

								let frst_keyframe;
								let last_keyframe;
								Timeline.selected.forEach(kf => {
									if (!frst_keyframe || frst_keyframe.time > kf.time) frst_keyframe = kf;
									if (!last_keyframe || last_keyframe.time < kf.time) last_keyframe = kf;
								})
								let prvs_keyframe;
								let next_keyframe;
								all_keyframes.forEach(kf => {
									if (kf.time < frst_keyframe.time && (!prvs_keyframe || prvs_keyframe.time < kf.time)) prvs_keyframe = kf;
									if (kf.time > last_keyframe.time && (!next_keyframe || next_keyframe.time > kf.time)) next_keyframe = kf;
								})
								if (prvs_keyframe) dragging_restriction[0] = prvs_keyframe.time;
								if (next_keyframe) dragging_restriction[1] = next_keyframe.time;
							}
						}
						is_setup = true;
					}

					function slide(e2) {
						convertTouchEvent(e2);
						e2.preventDefault();
						let offset = [
							e2.clientX - e1.clientX,
							e2.clientY - e1.clientY,
						]
						if (!is_setup) {
							if (Math.pow(offset[0], 2) + Math.pow(offset[1], 2) > 40) {
								setup();
							} else {
								return;
							}
						}
						
						// Time
						var difference = Math.clamp(offset[0] / Timeline.vue._data.size, -256, 256);
						let [min, max] = dragging_range;
						
						if (time_stretching) {
							var time_factor = (clicked && clicked.time_before < (min + max) / 2)
								? ((max-min-difference) / (max-min))
								: ((max-min+difference) / (max-min));
							time_factor = Math.roundTo(time_factor, 2);
						}

						// Value
						let value = 0;
						let value_diff = 0;
						if (Timeline.vue.graph_editor_open) {
							value = -offset[1] / Timeline.vue.graph_size;
							var round_num = canvasGridSize(e2.shiftKey || Pressing.overrides.shift, e2.ctrlOrCmd || Pressing.overrides.ctrl);
							if (Toolbox.selected.id === 'resize_tool') {
								round_num *= 0.1;
							}
							value = Math.round(value/round_num)*round_num
							previousValue = previousValue == undefined ? value : previousValue;
							originalValue = originalValue == undefined ? value : originalValue;

							if (value !== previousValue) {
								value_diff = value - (previousValue||0);
								previousValue = value;
							}
						}
		
						for (var kf of Timeline.selected) {
							if (time_stretching) {
								if (clicked && clicked.time_before < (min + max) / 2) {
									var t = max - (kf.time_before - max) * -time_factor;
								} else {
									var t = min + (kf.time_before - min) * time_factor;
								}
							} else {
								var t = kf.time_before + difference;
							}
							let old_time = kf.time;
							if (dragging_restriction) {
								let step = Timeline.getStep();
								kf.time = Timeline.snapTime(Math.clamp(t, dragging_restriction[0] + step, dragging_restriction[1] - step));
							} else {
								kf.time = Timeline.snapTime(t);
							}
							if (old_time !== kf.time) {
								values_changed = true;
							}

							if (Timeline.vue.graph_editor_open && value_diff) {
								kf.offset(Timeline.vue.graph_editor_axis, value_diff);
								values_changed = true;
							}
						}
						if (time_stretching) {
							Blockbench.setStatusBarText(Math.round(time_factor * 100) + '%');
						} else {
							let text = trimFloatNumber(Math.round(difference * Animation.selected.snapping));
							if (Timeline.vue.graph_editor_open) {
								text += ` ⨉ ${trimFloatNumber(value - originalValue)}`
							}
							Blockbench.setStatusBarText(text);
						}
						BarItems.slider_keyframe_time.update()
						Animator.showMotionTrail()
						Animator.preview()

					}
					function off() {
						removeEventListeners(document, 'mousemove touchmove', slide);
						removeEventListeners(document, 'mouseup touchend', off);

						if (is_setup) {
							var deleted = []
							for (var kf of Timeline.selected) {
								delete kf.time_before;
								kf.replaceOthers(deleted);
							}
							Blockbench.setStatusBarText();
							if (values_changed) {
								Animation.selected.setLength();
								if (time_stretching) {
									Undo.finishEdit('Stretch keyframes');
								} else {
									Undo.addKeyframeCasualties(deleted);
									Undo.finishEdit('Drag keyframes');
								}
							} else {
								Undo.cancelEdit();
							}
							setTimeout(() => {
								Timeline.dragging_keyframes = false;
							}, 20);
						}
					}
					addEventListeners(document, 'mousemove touchmove', slide, {passive: false});
					addEventListeners(document, 'mouseup touchend', off);
				},
				clamp: Math.clamp,
				trimFloatNumber
			},
			watch: {
				size() {this.updateTimecodes()},
				length() {this.updateTimecodes()},
				scroll_left() {this.updateTimecodes()},
			},
			template: `
				<div id="timeline_vue" :class="{graph_editor: graph_editor_open}">
					<div id="timeline_header">
						<div id="timeline_corner" v-bind:style="{width: head_width+'px'}">
							<div id="timeline_timestamp"></div>
							<div class="channel_axis_selector" v-if="graph_editor_open">
								<div @click="graph_editor_axis = 'x';" :class="{selected: graph_editor_axis == 'x'}" style="color: var(--color-axis-x);">X</div>
								<div @click="graph_editor_axis = 'y';" :class="{selected: graph_editor_axis == 'y'}" style="color: var(--color-axis-y);">Y</div>
								<div @click="graph_editor_axis = 'z';" :class="{selected: graph_editor_axis == 'z'}" style="color: var(--color-axis-z);">Z</div>
							</div>
						</div>
						<div id="timeline_time_wrapper">
							<div id="timeline_time" v-bind:style="{width: (size*length)+'px', left: -scroll_left+'px'}">
								<div v-for="t in timecodes" class="timeline_timecode" :key="t.text" :style="{left: (t.time * size) + 'px', width: (t.width * size) + 'px'}">
									<span>{{ t.text }}</span>
									<div class="substeps">
										<div v-for="n in Math.ceil(t.substeps)" :key="t.text + '-' + n"></div>
									</div>
								</div>
								<div id="timeline_playhead"
									v-bind:style="{left: (playhead * size) + 'px'}"
								></div>
								<div id="timeline_endbracket"
									v-bind:style="{left: (animation_length * size) + 'px'}"
								></div>
								<div
									v-for="marker in markers"
									class="timeline_marker"
									v-bind:style="{left: (marker.time * size) + 'px', 'border-color': markerColors[marker.color % markerColors.length].standard}"
									@contextmenu.prevent="marker.showContextMenu($event)"
									v-on:click="marker.callPlayhead()"
								></div>
							</div>
						</div>
					</div>
					<div id="timeline_body" ref="timeline_body" @scroll="updateScroll($event)">
						<div id="timeline_body_inner" v-bind:style="{width: (size*length + head_width)+'px'}" @contextmenu.stop="Timeline.showMenu($event)">
							<li v-for="animator in animators" class="animator" :class="{selected: animator.selected, boneless: animator.constructor.name == 'BoneAnimator' && !animator.group}" :uuid="animator.uuid" v-on:click="animator.select();">
								<div class="animator_head_bar">
									<div class="channel_head" v-bind:style="{left: scroll_left+'px', width: head_width+'px'}" v-on:dblclick.stop="toggleAnimator(animator)" @contextmenu.stop="animator.showContextMenu($event)">
										<div class="text_button" v-on:click.stop="toggleAnimator(animator)">
											<i class="icon-open-state fa" v-bind:class="{'fa-angle-right': !animator.expanded, 'fa-angle-down': animator.expanded}"></i>
										</div>
										<span v-on:click.stop="animator.select();">{{animator.name}}</span>
										<div class="text_button" v-on:click.stop="removeAnimator(animator)">
											<i class="material-icons">remove</i>
										</div>
									</div>
									<div class="keyframe_section" v-if="!graph_editor_open">
										<template v-for="(channel_options, channel) in animator.channels" v-if="!(animator.expanded && channels[channel] != false && (!channels.hide_empty || animator[channel].length))">
											<div
												v-for="keyframe in animator[channel]"
												v-bind:style="{left: (8 + keyframe.time * size) + 'px'}"
												class="keyframe"
												v-bind:id="'_'+keyframe.uuid"
											>
												<i class="material-icons">lens</i>
											</div>
										</template>
									</div>
								</div>
								<div class="animator_channel_bar"
									v-bind:style="{width: (size*length + head_width)+'px'}"
									v-for="(channel_options, channel) in animator.channels"
									v-if="animator.expanded && channels[channel] != false && (!channels.hide_empty || animator[channel].length)"
								>
									<div class="channel_head"
										:class="{selected: graph_editor_open && animator.selected && graph_editor_channel == channel}"
										v-bind:style="{left: scroll_left+'px', width: head_width+'px'}"
										@click.stop="selectChannel(animator, channel);"
										@contextmenu.stop="animator.showContextMenu($event)"
									>
										<div class="text_button" v-if="channel_options.mutable" v-on:click.stop="animator.toggleMuted(channel)">
											<template v-if="channel === 'sound'">
												<i class="channel_mute fas fa-volume-mute" v-if="animator.muted[channel]"></i>
												<i class="channel_mute fas fa-volume-up" v-else></i>
											</template>
											<template v-else>
												<i class="channel_mute fas fa-eye-slash" v-if="animator.muted[channel]"></i>
												<i class="channel_mute fas fa-eye" v-else></i>
											</template>
										</div>
										<div class="text_button" v-else></div>
										<span>{{ channel_options.name }}</span>
										<div
											class="text_button rotation_global" :class="{off: !animator.rotation_global}"
											v-if="channel == 'rotation' && animator.type == 'bone'"
											title="${tl('menu.animator.rotation_global')}"
											@click.stop="toggleGlobalSpace(animator)"
										>
											<i class="material-icons">{{ animator.rotation_global ? 'public' : 'public_off' }}</i>
										</div>
										<div class="text_button" v-on:click.stop="animator.createKeyframe(null, null, channel, true)">
											<i class="material-icons">add</i>
										</div>
									</div>
									<div class="keyframe_section" v-if="!graph_editor_open">
										<div
											v-for="keyframe in animator[channel]"
											v-bind:style="{left: (8 + keyframe.time * size) + 'px', color: getColor(keyframe.color)}"
											class="keyframe"
											v-bind:class="[keyframe.channel, keyframe.selected?'selected':'']"
											v-bind:id="keyframe.uuid"
											v-on:click.stop="keyframe.select($event)"
											v-on:dblclick="keyframe.callPlayhead()"
											:title="tl('timeline.'+keyframe.channel)"
											@mousedown="dragKeyframes(keyframe, $event)" @touchstart="dragKeyframes(keyframe, $event)"
											@contextmenu.prevent.stop="keyframe.showContextMenu($event)"
										>
											<i class="material-icons keyframe_icon_smaller" v-if="keyframe.interpolation == 'catmullrom'">lens</i>
											<i class="material-icons keyframe_icon_step" v-else-if="keyframe.interpolation == 'step'">eject</i>
											<i :class="keyframe.data_points.length == 1 ? 'icon-keyframe' : 'icon-keyframe_discontinuous'" v-else></i>
											<svg class="keyframe_waveform" v-if="keyframe.channel == 'sound' && keyframe.data_points[0].file && waveforms[keyframe.data_points[0].file]" :style="{width: waveforms[keyframe.data_points[0].file].duration * size}">
												<polygon :points="getWaveformPoints(waveforms[keyframe.data_points[0].file].samples, size)"></polygon>
											</svg>
										</div>
									</div>
								</div>
							</li>
							<div id="timeline_empty_head" class="channel_head" v-bind:style="{left: scroll_left+'px', width: head_width+'px'}">
							</div>
							<div id="timeline_selector" class="selection_rectangle"></div>
							<div id="timeline_graph_editor" ref="graph_editor" v-if="graph_editor_open" :style="{left: head_width + 'px', top: scroll_top + 'px'}">
								<svg :style="{'margin-left': clamp(scroll_left, 9, Infinity) + 'px'}">
									<path :d="zero_line" style="stroke: var(--color-grid);"></path>
									<path :d="one_line" style="stroke: var(--color-grid); stroke-dasharray: 6;" v-if="graph_editor_channel == 'scale'"></path>
									<path :d="loop_graph" class="loop_graph" style="stroke: var(--color-grid);"></path>
									<path :d="graph" :style="{stroke: 'var(--color-axis-' + graph_editor_axis + ')'}"></path>
								</svg>
								<template v-if="graph_editor_animator">
									<div
										v-for="keyframe in graph_editor_animator[graph_editor_channel]"
										v-bind:style="{left: (10 + keyframe.time * size) + 'px', top: (graph_offset - keyframe.display_value * graph_size - 8) + 'px', color: getColor(keyframe.color)}"
										class="keyframe graph_keyframe"
										v-bind:class="[keyframe.channel, keyframe.selected?'selected':'']"
										v-bind:id="keyframe.uuid"
										v-on:click.stop="keyframe.select($event)"
										v-on:dblclick="keyframe.callPlayhead()"
										:title="trimFloatNumber(keyframe.time) + ' ⨉ ' + keyframe.display_value"
										@mousedown="dragKeyframes(keyframe, $event)" @touchstart="dragKeyframes(keyframe, $event)"
										@contextmenu.prevent.stop="keyframe.showContextMenu($event)"
									>
										<i class="material-icons keyframe_icon_smaller" v-if="keyframe.interpolation == 'catmullrom'">lens</i>
										<i class="material-icons keyframe_icon_step" v-else-if="keyframe.interpolation == 'step'">eject</i>
										<i :class="keyframe.data_points.length == 1 ? 'icon-keyframe' : 'icon-keyframe_discontinuous'" v-else></i>
									</div>
								</template>
							</div>
						</div>
					</div>
				</div>
			`
		}
	})
	Timeline.vue = Timeline.panel.inside_vue;
	Timeline.panel.on('change_zindex', ({zindex}) => {
		if (Condition(Timeline.panel.condition)) {
			document.getElementById('resizer_timeline_head').style.zIndex = zindex ? zindex+1 : null;
		}
	})
})


BARS.defineActions(function() {
	new Toggle('timeline_graph_editor', {
		icon: 'timeline',
		category: 'animation',
		condition: {modes: ['animate']},
		keybind: new Keybind({key: 114}),
		onChange(state) {
			Timeline.vue.graph_editor_open = state;
			if (Timeline.vue.graph_editor_open &&
				Timeline.selected.length &&
				Timeline.selected_animator &&
				Timeline.selected_animator.channels[Timeline.selected[0].channel] &&
				Timeline.selected_animator.channels[Timeline.selected[0].channel].transform
			) {
				Timeline.vue.graph_editor_channel = Timeline.selected[0].channel;
			}
		}
	})
	new Toggle('graph_editor_zero_line', {
		icon: 'exposure_zero',
		category: 'animation',
		condition: {modes: ['animate'], method: () => Timeline.vue.graph_editor_open},
		default: true,
		onChange(state) {
			Timeline.vue.show_zero_line = state;
		}
	})
	new Action('play_animation', {
		icon: 'play_arrow',
		category: 'animation',
		keybind: new Keybind({key: 32}),
		condition: {modes: ['animate']},
		click: function () {
			
			if (!Animation.selected) {
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
		settings: {
			default: 100,
			min: 0,
			max: 10000
		},
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
			let was_playing = Timeline.playing;
			if (Timeline.playing) Timeline.pause();
			Timeline.setTime(0);
			if (was_playing) {
				Timeline.start();
			} else {
				Animator.preview();
			}
		}
	})

	new Action('jump_to_timeline_end', {
		icon: 'skip_next',
		category: 'animation',
		condition: {modes: ['animate']},
		keybind: new Keybind({key: 35}),
		click: function () {
			let was_playing = Timeline.playing;
			if (Timeline.playing) Timeline.pause();
			Timeline.setTime(Animation.selected ? Animation.selected.length : 0)
			if (was_playing) {
				Timeline.start();
			} else {
				Animator.preview();
			}
		}
	})
	new Action('timeline_frame_back', {
		icon: 'arrow_back',
		category: 'animation',
		condition: {modes: ['animate', 'edit', 'paint'], method: () => (Modes.animate || Interface.Panels.textures.inside_vue.maxFrameCount())},
		keybind: new Keybind({key: 188}),
		click: function (e) {
			if (Modes.animate || Prop.active_panel == 'timeline') {
				let time = Timeline.snapTime(limitNumber(Timeline.time - Timeline.getStep(), 0, 1e4));
				Timeline.setTime(time);
				Animator.preview()
			} else {
				BarItems.animated_texture_frame.change(v => v - 1);
			}
		}
	})
	new Action('timeline_frame_forth', {
		icon: 'arrow_forward',
		category: 'animation',
		condition: {modes: ['animate', 'edit', 'paint'], method: () => (Modes.animate || Interface.Panels.textures.inside_vue.maxFrameCount())},
		keybind: new Keybind({key: 190}),
		click: function (e) {
			if (Modes.animate || Prop.active_panel == 'timeline') {
				let time = Timeline.snapTime(limitNumber(Timeline.time + Timeline.getStep(), 0, 1e4));
				Timeline.setTime(time);
				Animator.preview()
			} else {
				BarItems.animated_texture_frame.change(v => v + 1);
			}
		}
	})

	new Action('bring_up_all_animations', {
		icon: 'fa-sort-amount-up',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function () {
			if (!Animation.selected) return;
			for (var uuid in Animation.selected.animators) {
				var ba = Animation.selected.animators[uuid]
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
			if (!Animation.selected) return;
			if (!Animation.selected.animators.effects) {
				var ea = Animation.selected.animators.effects = new EffectAnimator(Animation.selected);
			}
			Animation.selected.animators.effects.select()
		}
	})
	new Action('timeline_focus', {
		icon: 'fas.fa-filter',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function (e) {
			new Menu(this.children()).open(e.target)
		},
		children: function() {
			let on = 'fas.fa-check-square';
			let off = 'far.fa-square';
			let {channels} = Timeline.vue._data;
			return [
				{name: 'timeline.rotation',	icon: channels.rotation ? on : off, click() {channels.rotation = !channels.rotation}},
				{name: 'timeline.position',	icon: channels.position ? on : off, click() {channels.position = !channels.position}},
				{name: 'timeline.scale', 	icon: channels.scale 	? on : off, click() {channels.scale	 = !channels.scale}},
				'_',
				{name: 'action.timeline_focus.hide_empty', icon: channels.hide_empty ? on : off, click() {channels.hide_empty	 = !channels.hide_empty}},
			]
		}
	})
	new Action('add_marker', {
		icon: 'flag',
		category: 'animation',
		condition: {modes: ['animate']},
		keybind: new Keybind({ctrl: true, key: 'm'}),
		click: function (event) {
			if (!Animation.selected) {
				Blockbench.showQuickMessage('message.no_animation_selected')
				return;
			}
			var time = Timeline.snapTime();
			var original_marker;
			for (var m of Animation.selected.markers) {
				if (Math.abs(m.time - time) < 0.01) {
					original_marker = m;
					break;
				}
			}
			if (original_marker) {
				Animation.selected.markers.remove(original_marker);
			} else {
				let marker = new TimelineMarker({time});
				Animation.selected.markers.push(marker);
			}
		}
	})

	

	new Action('timeline_setups', {
		icon: 'folder_special',
		condition: {modes: ['animate'], project: true, method: () => Project.timeline_setups.length},
		children() {
			return Project.timeline_setups.map(setup => {
				return {
					name: setup.name,
					icon: 'star_outline',
					click() {
						Timeline.vue._data.animators.purge();
						unselectAll();
						setup.animators.forEach(uuid => {
							var ba = Animation.selected.animators[uuid]
							if (ba) ba.addToTimeline();
						})
						Timeline.vue.channels.position = !!setup.channels.position;
						Timeline.vue.channels.rotation = !!setup.channels.rotation;
						Timeline.vue.channels.scale = !!setup.channels.scale;
						Timeline.vue.channels.hide_empty = !!setup.channels.hide_empty;
					},
					children: [
						{icon: 'delete', name: 'generic.delete', click() {
							Project.timeline_setups.remove(setup);
						}}
					]
				}
			})
		},
		click(e) {
			new Menu(this.children()).open(e.target);
		}
	})
	new Action('save_timeline_setup', {
		icon: 'star',
		condition: {modes: ['animate']},
		async click() {
			let name = await Blockbench.textPrompt('generic.name', 'Timeline Setup');
			let setup = {
				name: name || 'Setup',
				channels: {
					position: Timeline.vue.channels.position,
					rotation: Timeline.vue.channels.rotation,
					scale: Timeline.vue.channels.scale,
					hide_empty: Timeline.vue.channels.hide_empty
				},
				animators: Timeline.animators.map(animator => animator.uuid),
			};
			Project.timeline_setups.push(setup);
			BARS.updateConditions();
		}
	})
})
