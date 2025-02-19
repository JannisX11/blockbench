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
	new MenuSeparator('settings'),
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
	new MenuSeparator('manage'),
	{icon: 'delete', name: 'generic.delete', click: function(marker) {
		if (Animation.selected) Animation.selected.markers.remove(marker);
	}}
])

const Timeline = {
	animators: [],
	selected: Keyframe.selected,//frames
	playing_sounds: [],
	paused_sounds: [],
	playback_speed: 100,
	time: 0,
	get second() {return Timeline.time},
	get animation_length() {return Animation.selected ? Animation.selected.length : 0;},
	playing: false,
	custom_range: [0, 0],
	graph_editor_limit: 10_000,
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

			if (Timeline.selector.interval) clearInterval(Timeline.selector.interval);
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
			R.start_event = e;
			if (e.shiftKey || Pressing.overrides.shift) {
				Timeline.selector.selected_before = Timeline.selected.slice();
			}
			Undo.initSelection({timeline: true});
		},
		move(e) {
			var R = Timeline.selector;
			if (!R.selecting) {
				if (Math.pow(R.start_event.clientX - mouse_pos.x, 2) + Math.pow(R.start_event.clientY - mouse_pos.y, 2) > 20) {
					R.selecting = true;
					$('#timeline_selector').show();
				} else {
					return;
				}
			}
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
			e.stopPropagation();
			document.removeEventListener('mousemove', Timeline.selector.move);
			document.removeEventListener('mouseup', Timeline.selector.end);
			clearInterval(Timeline.selector.interval);

			if (!Timeline.selector.selecting) {
				if (settings.canvas_unselect.value) {
					Timeline.selected.empty();
					updateKeyframeSelection();
					Undo.finishSelection('Unselect keyframes');
				}
				Timeline.vue.clickGraphEditor(e);
				return false;
			} else {
				updateKeyframeSelection()
				Timeline.selector.selected_before.empty();
				Timeline.selector.selecting = false;
				$('#timeline_selector')
					.css('width', 0)
					.css('height', 0)
					.hide();
				Undo.finishSelection('Select keyframes');
			}
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
	playAudioStutter() {
		if (!settings.audio_scrubbing.value) return;
		let effect_animator = Animation.selected?.animators.effects;
		if (!effect_animator || effect_animator.muted.sound) return;
		
		effect_animator.sound.forEach(kf => {
			if (kf.data_points[0].file) {
				var diff = kf.time - effect_animator.animation.time;
				if (diff < 0 && Timeline.waveforms[kf.data_points[0].file] && Timeline.waveforms[kf.data_points[0].file].duration > -diff) {
					let audio_path = kf.data_points[0].file;
					let media = Timeline.paused_sounds.find(sound => sound.keyframe_id == kf.uuid && audio_path == sound.audio_path) ?? new Audio(audio_path);
					if (media.stutter_timeout) {
						clearTimeout(media.stutter_timeout);
					}
					media.playbackRate = Math.clamp(Timeline.playback_speed/100, 0.1, 4.0);
					media.volume = Math.clamp(settings.volume.value/100, 0, 1);
					media.currentTime = -diff;
					media.keyframe_id = kf.uuid;
					media.audio_path = audio_path;

					if (media.paused) media.play().catch(() => {});
					media.stutter_timeout = setTimeout(() => {
						media.pause();
						delete media.stutter_timeout;
					}, 60)
				} 
			}
		})
	},
	revealTime(time) {
		let body = document.getElementById('timeline_body');
		if (!body) return;
		var scroll = body.scrollLeft;
		var playhead = time * Timeline.vue._data.size + 8;
		if (playhead < scroll || playhead > scroll + document.getElementById('timeline_vue').clientWidth - Timeline.vue._data.head_width) {
			body.scrollLeft = playhead-16;
		} else if (time == 0) {
			body.scrollLeft = 0;
		}
	},
	setTimecode(time) {
		let second_fractions = 100;
		let m = Math.floor(time/60)
		let s = Math.floor(time%60)
		let f = Math.round((time%1) * second_fractions)
		if ((s+'').length === 1) {s = '0'+s}
		if ((f+'').length === 1) {f = '0'+f}
		Timeline.vue.timestamp = `${m}:${s}:${f}`;
		Timeline.vue.framenumber = Math.round(time/Timeline.getStep());
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
		document.getElementById('timeline_body').addEventListener('mousedown', e => {
			if (e.which === 2 || (Keybinds.extra.preview_drag.keybind.isTriggered(e) && e.which !== 1)) {
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
					if (e.which == 3 && Math.pow(e.clientX - pos[0], 2) + Math.pow(e.clientY - pos[1], 2) > 40) {
						preventContextMenu();
					}
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

			} else if (e.target.id == 'timeline_onion_skin_point') {

				Timeline.dragging_onion_skin_point = true;

			} else {

				convertTouchEvent(e);
				Timeline.dragging_playhead = true;
				if (Timeline.playing) Timeline.pause();
				
				let offset = e.clientX - $('#timeline_time').offset().left;
				let time = Math.clamp(offset / Timeline.vue._data.size, 0, Infinity);
				let rounded = false;
				if (!e.ctrlOrCmd && !Pressing.overrides.ctrl) {
					time = Timeline.snapTime(time);
					rounded = true;
				}
				Timeline.setTime(time);
				Animator.preview();
				if (rounded) {
					Timeline.playAudioStutter();
				}
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
				let rounded = false;
				if (!e.ctrlOrCmd && !Pressing.overrides.ctrl) {
					time = Timeline.snapTime(time);
					rounded = true;
				}
				if (Timeline.time != time) {
					Timeline.setTime(time)
					Animator.preview()
					if (rounded) {
						Timeline.playAudioStutter();
					}
					Blockbench.setCursorTooltip(Math.roundTo(time, 2));
				}
			} else if (Timeline.dragging_endbracket) {

				convertTouchEvent(e);
				let offset = e.clientX - $('#timeline_time').offset().left;
				let time = Timeline.snapTime(offset / Timeline.vue._data.size)
				
				Animation.selected.setLength(time)
				Timeline.revealTime(time)
				Blockbench.setCursorTooltip(Math.roundTo(time, 2));

			} else if (Timeline.dragging_onion_skin_point) {

				convertTouchEvent(e);
				let offset = e.clientX - $('#timeline_time').offset().left;
				let time = Timeline.snapTime(offset / Timeline.vue._data.size)
				
				if (Timeline.vue.onion_skin_time != time) {
					Timeline.vue.onion_skin_time = time;
					Timeline.revealTime(time);
					Animator.updateOnionSkin();
					Blockbench.setCursorTooltip(Math.roundTo(time, 2));
				}
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

			} else if (Timeline.dragging_onion_skin_point) {
				delete Timeline.dragging_onion_skin_point
			}
			Blockbench.setCursorTooltip();
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
			let second_fractions = 100;
			let seconds
				= times[0]*60
				+ limitNumber(times[1], 0, 59)
				+ limitNumber(times[2]/second_fractions, 0, second_fractions-1)
			if (Math.abs(seconds-Timeline.time) > 1e-3 ) {
				Timeline.setTime(seconds, true)
				Animator.preview()
			}
		})
		//Enter Frame
		$('#timeline_framenumber').click(e => {
			if ($('#timeline_framenumber').attr('contenteditable') == 'true') return;

			$('#timeline_framenumber').attr('contenteditable', true).trigger('focus');
			document.execCommand('selectAll');
		})
		.on('focusout keydown', e => {
			if (e.type === 'focusout' || Keybinds.extra.confirm.keybind.isTriggered(e) || Keybinds.extra.cancel.keybind.isTriggered(e)) {
				$('#timeline_framenumber').attr('contenteditable', false)
			}
		})
		.on('keyup', e => {
			let frame = parseInt($('#timeline_framenumber').text())
			let seconds = frame * Timeline.getStep();
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
		max_length = Math.max(max_length, Timeline.time) + width/2/Timeline.vue._data.size
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
		Timeline.last_frame_timecode = performance.now();
		if (Animation.selected.loop == 'hold' && Timeline.time >= (Animation.selected.length||1e3)) {
			Timeline.setTime(Timeline.custom_range[0])
		}
		if (Timeline.time > 0) {
			Animator.animations.forEach(animation => {
				if (animation.playing && animation.animators.effects) {
					animation.animators.effects.startPreviousSounds();
				}
			})
		}
		Blockbench.dispatchEvent('timeline_play', {});
		Timeline.loop()
	},
	loop() {
		if (!Animation.selected) return;

		let max_length = Animation.selected.length || 1e3;
		let max_time = Timeline.custom_range[1] || max_length;
		let new_time;
		if (Animation.selected && Animation.selected.anim_time_update) {
			new_time = Animator.MolangParser.parse(Animation.selected.anim_time_update);
		}
		if (new_time == undefined || new_time <= Timeline.time) {
			new_time = Animator.MolangParser.parse('query.anim_time + query.delta_time')
		}
		let time = Timeline.time + (new_time - Timeline.time) * (Timeline.playback_speed/100)
		if (Animation.selected.loop == 'hold') {
			time = Math.clamp(time, Timeline.custom_range[0], max_time);
		}
		Timeline.last_frame_timecode = performance.now();

		if (time < max_time) {
			Timeline.setTime(time);
		} else {
			if (Animation.selected.loop == 'loop' || BarItems.looped_animation_playback.value) {
				Timeline.setTime(Timeline.custom_range[0]);
			} else if (Animation.selected.loop == 'once') {
				Timeline.setTime(Timeline.custom_range[0]);
				Animator.preview()
				Timeline.pause()
			} else if (Animation.selected.loop == 'hold') {
				Timeline.setTime(max_time);
				Timeline.pause()
			}
		}
		Animator.preview(true);
	},
	pause() {
		Animator.preview();
		Timeline.playing = false;
		BarItems.play_animation.setIcon('play_arrow')
		Timeline.playing_sounds.forEach(media => {
			if (!media.paused) {
				media.pause();
			}
		})
		Timeline.paused_sounds.safePush(...Timeline.playing_sounds);
		Timeline.playing_sounds.empty();
		Blockbench.dispatchEvent('timeline_pause', {});
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
		if (Blockbench.hasFlag('no_context_menu')) return;
		Timeline.menu.open(event, event);
	},
	menu: new Menu([
		new MenuSeparator('preview'),
		'play_animation',
		'looped_animation_playback',
		'jump_to_timeline_start',
		'jump_to_timeline_end',
		'set_timeline_range_start',
		'set_timeline_range_end',
		'disable_timeline_range',
		new MenuSeparator('copypaste'),
		'paste',
		'apply_animation_preset',
		new MenuSeparator('view'),
		{name: 'menu.view.zoom', id: 'zoom', condition: isApp, icon: 'search', children: [
			'zoom_in',
			'zoom_out',
			'zoom_reset'
		]},
		'select_all',
		'fold_all_animations',
		'bring_up_all_animations',
		'clear_timeline',
		new MenuSeparator('timeline_setups'),
		'timeline_setups',
		'save_timeline_setup',
		new MenuSeparator('graph_editor'),
		'graph_editor_other_graphs',
		'graph_editor_include_other_graphs',
		'graph_editor_zero_line',
	])
}

Interface.definePanels(() => {
	function eventTargetToAnimator(target) {
		let target_node = target;
		let i = 0;
		while (target_node && target_node.classList && !target_node.classList.contains('animator')) {
			if (i < 3 && target_node) {
				target_node = target_node.parentNode;
				i++;
			} else {
				return [];
			}
		}
		return [Timeline.animators.find(animator => animator.uuid == target_node.attributes.uuid.value), target_node];
	}
	Timeline.panel = new Panel('timeline', {
		icon: 'timeline',
		condition: {modes: ['animate'], method: () => !AnimationController.selected},
		default_position: {
			slot: 'bottom',
			float_position: [100, 400],
			float_size: [600, 300],
			height: 260,
		},
		growable: true,
		resizable: true,
		toolbars: [
			new Toolbar('timeline', {
				children: [
					'timeline_graph_editor',
					'timeline_focus',
					'clear_timeline',
					'bring_up_all_animations',
					'select_effect_animator',
					'add_marker',
					'+',
					'jump_to_timeline_start',
					'play_animation',
					'jump_to_timeline_end',
					'+',
					'slider_animation_speed',
				],
				default_place: true
			})
		],
		onResize() {
			Timeline.updateSize();
			if (this.inside_vue.$el) {
				this.inside_vue.timeline_height = this.inside_vue.$el.clientHeight;
			}
		},
		component: {
			name: 'panel-timeline',
			data() {return {
				size: 300,
				length: 10,
				timeline_height: 100,
				animation_length: 0,
				scroll_left: 0,
				scroll_top: 0,
				head_width: Blockbench.isMobile ? 108 : Interface.data.timeline_head,
				timecodes: [],
				animators: Timeline.animators,
				markers: [],
				custom_range: Timeline.custom_range,
				waveforms: Timeline.waveforms,
				focus_channel: null,
				playhead: Timeline.time,
				timestamp: '0',
				framenumber: '0',

				graph_editor_open: false,
				graph_editor_channel: 'rotation',
				graph_editor_axis: 'x',
				graph_offset: 200,
				graph_size: 200,
				show_other_graphs: true,
				include_other_graphs: true,
				show_zero_line: true,
				show_all_handles: !Settings.get('only_selected_bezier_handles'),
				loop_graphs: [''],

				onion_skin_selectable: BarItems.animation_onion_skin.value,
				onion_skin_time: 0,

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
				rulers() {
					let lines = [];
					let values = [0];

					let interval_options = [1, 2, 4, 8, 10, 20, 25, 50, 100, 200, 250, 400, 500];
					let estimate = 100 / Timeline.vue.graph_size;
					if (estimate > 500) return values;
					let interval = Math.snapToValues(estimate, interval_options);
					let box_height = Timeline.vue.$refs.timeline_body.clientHeight;

					for (let i = 1; i < 20; i += 1) {
						let value = i * interval;
						let keep_going = false;
						if (this.graph_offset - value * this.graph_size > 0) {
							values.push(value);
							keep_going = true;
						}
						if (this.graph_offset + value * this.graph_size < box_height) {
							values.push(i * -interval);
							keep_going = true;
						}
						if (!keep_going) break;
					}

					values.forEach(value => {
						let height = this.graph_offset - this.graph_size * value;
						lines.push({
							position: height,
							label: Math.round(value),
							path: `M0 ${height} L10000 ${height}`
						});
					})
					return lines;
				},
				graphs() {
					let ba = this.graph_editor_animator;
					if (!ba || !ba[this.graph_editor_channel] || !ba[this.graph_editor_channel].length) {
						this.loop_graphs.empty();
						return [];
					}
					let original_time = Timeline.time;
					let step = 2;
					let clientWidth = this.$refs.timeline_body ? this.$refs.timeline_body.clientWidth : 400;
					let clientHeight = this.$refs.timeline_body ? this.$refs.timeline_body.clientHeight : 400;
					let keyframes = ba[this.graph_editor_channel];
					let points = [];
					let loop_points = [];

					let min = this.show_zero_line ? -1 : Timeline.graph_editor_limit,
						max = this.show_zero_line ? 1 : -Timeline.graph_editor_limit;

					for (let time = Math.clamp(this.scroll_left - 9, 0, Infinity); time < (clientWidth + this.scroll_left - this.head_width); time += step) {
						Timeline.time = time / this.size;

						let snap_kf = keyframes.find(kf => Timeline.time <= kf.time && Timeline.time > kf.time - step / this.size );
						if (snap_kf) {
							Timeline.time = snap_kf.time;
						}
						Animator.resetLastValues();
						let values = [
							(this.show_other_graphs || this.graph_editor_axis === 'x') ? ba.interpolate(this.graph_editor_channel, false, 'x') : 0,
							(this.show_other_graphs || this.graph_editor_axis === 'y') ? ba.interpolate(this.graph_editor_channel, false, 'y') : 0,
							(this.show_other_graphs || this.graph_editor_axis === 'z') ? ba.interpolate(this.graph_editor_channel, false, 'z') : 0
						];
						let value = values[this.graph_editor_axis_number];
						if (snap_kf) snap_kf.display_value = value;
						
						if (Timeline.time > Animation.selected.length && Animation.selected.length && Animation.selected.loop === 'loop') {
							if (points.length && !loop_points.length) loop_points.push(points.last())
							loop_points.push(values);
						} else {
							points.push(values);
							if (this.show_other_graphs && this.include_other_graphs) {
								min = Math.min(min, ...values);
								max = Math.max(max, ...values);
							} else {
								min = Math.min(min, value);
								max = Math.max(max, value);
							}
						}
					}
					keyframes.forEach(kf => {
						if (kf.interpolation === 'bezier') {
							min = Math.min(min, kf.display_value + kf.bezier_left_value[this.graph_editor_axis_number]);
							max = Math.max(max, kf.display_value + kf.bezier_left_value[this.graph_editor_axis_number]);
							min = Math.min(min, kf.display_value + kf.bezier_right_value[this.graph_editor_axis_number]);
							max = Math.max(max, kf.display_value + kf.bezier_right_value[this.graph_editor_axis_number]);
						}
					})
					
					Timeline.time = original_time;

					let padding = 16;
					let min_size = 2.4;
					let unit_size = Math.clamp(max-min, min_size, Timeline.graph_editor_limit);
					this.graph_size = (clientHeight - 2*padding) / unit_size;
					let blend = Math.clamp(1 - (max-min) / min_size, 0, 1)
					this.graph_offset = clientHeight - padding + (this.graph_size * (min - unit_size/2 * blend ) );

					let graphs = this.show_other_graphs ? ['', '', ''] : [''];
					points.forEach((values, i) => {
						let command = i == 0 ? 'M' : 'L';
						if (this.show_other_graphs) {
							values.forEach((value, axis) => {
								graphs[axis] += `${command}${i*step} ${this.graph_offset - value * this.graph_size} `;
							})
						} else {
							graphs[0] += `${command}${i*step} ${this.graph_offset - values[this.graph_editor_axis_number] * this.graph_size} `;
						}
					})

					this.loop_graphs.empty();
					if (loop_points.length) {
						if (this.show_other_graphs) {
							this.loop_graphs.push('', '', '');
						} else {
							this.loop_graphs.push('');
						}
						loop_points.forEach((values, i) => {
							let command = i == 0 ? 'M' : 'L';
							i = i + points.length - 1;
							if (this.show_other_graphs) {
								values.forEach((value, axis) => {
									this.loop_graphs[axis] += `${command}${i*step} ${this.graph_offset - value * this.graph_size} `;
								})
							} else {
								this.loop_graphs[0] += `${command}${i*step} ${this.graph_offset - values[this.graph_editor_axis_number] * this.graph_size} `;
							}
						})
					}

					return graphs;
				},
				graph_editor_axis_number() {
					return getAxisNumber(this.graph_editor_axis)
				}
			},
			methods: {
				tl,
				updateTimecodes() {
					if (!this._isMounted) return;
					this.timecodes.empty();
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

					// Rounding to "FPS" to better match snapping
					if (step < 1) {
						let substep_simplification = Math.max((Math.floor(Math.sqrt(step / Timeline.getStep()))-1), 1);
						var FPS = Timeline.getStep() / substep_simplification;
						step = Math.round(step/FPS) * FPS
					}

					// Substep simplification
					let substeps = step / Timeline.getStep()
					while (substeps > 8) {
						substeps /= 2;
					}
					
					// Generate
					var i = Math.floor(this.scroll_left / this.size / step) * step;
					while (i < Math.ceil((this.scroll_left + timeline_container_width) / this.size / step) * step) {
						if (settings.timecode_frame_number.value) {
							var text = Math.round(i / Timeline.getStep());
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
					Undo.initSelection();
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
					Undo.finishSelection('Select animation channel');
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
				dragAnimator(animator, e1) {
					if (getFocusedTextInput()) return;
					if (e1.button == 1 || e1.button == 2) return;
					convertTouchEvent(e1);

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
									document.getElementById('timeline_body_inner').scrollTop += last_event.clientY - e2.clientY;
								}
							} else if (distance > 6) {
								active = true;
								Undo.initSelection();
							}
						} else {
							if (e2) e2.preventDefault();
							
							if (Menu.open) Menu.open.hide();

							if (!helper) {
								helper = document.createElement('div');
								helper.id = 'animation_drag_helper';
								let icon = document.createElement('i');		icon.className = 'material-icons'; icon.innerText = 'chevron_right'; helper.append(icon);
								let span = document.createElement('span');	span.innerText = animator.name;	helper.append(span);
								document.body.append(helper);
							}
							helper.style.left = `${e2.clientX}px`;
							helper.style.top = `${e2.clientY}px`;

							// drag
							$('.drag_hover').removeClass('drag_hover');
							$('.animator[order]').attr('order', null);

							let target = document.elementFromPoint(e2.clientX, e2.clientY);
							[drop_target, drop_target_node] = eventTargetToAnimator(target);
							if (drop_target) {
								let location = e2.clientY - $(drop_target_node).offset().top;
								let half_height = drop_target_node.clientHeight/2;
								let order = location <= half_height ? -1 : 1;
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
						$('.animator[order]').attr('order', null);
						if (Blockbench.isTouch) clearTimeout(timeout);

						if (active && !open_menu) {
							convertTouchEvent(e2);
							let target = document.elementFromPoint(e2.clientX, e2.clientY);
							[target_animator] = eventTargetToAnimator(target);
							if (!target_animator || target_animator == animator ) return;
							
							let index = Timeline.animators.indexOf(target_animator);
							if (index == -1) return;
							if (order == 1) index++;
							if (Timeline.animators[index] == animator) return;
							Timeline.animators.remove(animator);
							Timeline.animators.splice(index, 0, animator);
							Undo.finishSelection('Rearrange animators in timeline');
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
				},
				dragKeyframes(clicked, e1) {
					convertTouchEvent(e1);
					if (e1.target.classList.contains('keyframe_bezier_handle')) return;
					let dragging_range;
					let dragging_restriction;
					let originalValue;
					let previousValue;
					let time_stretching;
					let values_changed;
					let is_setup = false;
					let old_bezier_values = {};

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
							old_bezier_values[kf.uuid] = {
								left: kf.bezier_left_time.slice(),
								right: kf.bezier_right_time.slice(),
							}
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
						let difference = 0;
						let max, min;
						let time_factor = 1;
						if ((!e2.ctrlOrCmd && !e2.shiftKey) || time_stretching || !Timeline.vue.graph_editor_open) {
							difference = Math.clamp(offset[0] / Timeline.vue._data.size, -256, 256);
							[min, max] = dragging_range;
							
							if (time_stretching) {
								time_factor = (clicked && clicked.time_before < (min + max) / 2)
									? ((max-min-difference) / (max-min))
									: ((max-min+difference) / (max-min));
								time_factor = Math.roundTo(time_factor, 2);
							}
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
		
						for (let kf of Timeline.selected) {
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
							if (time_stretching && kf.interpolation == 'bezier') {
								let old_bezier = old_bezier_values[kf.uuid];
								kf.bezier_left_time.V3_set(old_bezier.left).V3_multiply(time_factor);
								kf.bezier_right_time.V3_set(old_bezier.right).V3_multiply(time_factor);
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
				dragBezierHandle(clicked, side, e1) {
					convertTouchEvent(e1);
					let values_changed;
					let is_setup = false;
					let axis_number = getAxisNumber(this.graph_editor_axis);
					let old_values = {};
					let lock_direction;

					function setup(offset) {

						if (!clicked.selected && !e1.shiftKey && !Pressing.overrides.shift && Timeline.selected.length != 0) {
							clicked.select()
						} else if (clicked && !clicked.selected) {
							clicked.select({shiftKey: true})
						}
						lock_direction = Math.abs(offset[0]) > Math.abs(offset[1]);

						Keyframe.selected.forEach(kf => {
							if (kf.interpolation == 'bezier') {
								old_values[kf.uuid] = {
									bezier_left_time: kf.bezier_left_time.slice(),
									bezier_left_value: kf.bezier_left_value.slice(),
									bezier_right_time: kf.bezier_right_time.slice(),
									bezier_right_value: kf.bezier_right_value.slice(),
								}
							}
						})

						Undo.initEdit({keyframes: Timeline.selected});
						Timeline.dragging_keyframes = true;

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
							if (Math.pow(offset[0], 2) + Math.pow(offset[1], 2) > 20) {
								setup(offset);
							} else {
								return;
							}
						}
						let difference_time = Math.clamp(offset[0] / Timeline.vue._data.size, -256, 256);
						let difference_value = Math.clamp(-offset[1] / Timeline.vue.graph_size, -256, 256);
						if (e2.shiftKey || Pressing.overrides.shift) {
							if (lock_direction) {
								difference_value = 0;
							} else {
								difference_time = 0;
							}
						}
						if (e2.ctrlOrCmd || Pressing.overrides.ctrl) {
							let time_snap = Timeline.getStep();
							let val_snap = 0.25;
							difference_time = Math.round(difference_time / time_snap) * time_snap;
							difference_value = Math.round(difference_value / val_snap) * val_snap;
						}

						for (let kf of Timeline.selected) {
							if (kf.interpolation == 'bezier') {

								kf.bezier_left_time.V3_set(old_values[kf.uuid].bezier_left_time);
								kf.bezier_left_value.V3_set(old_values[kf.uuid].bezier_left_value);
								kf.bezier_right_time.V3_set(old_values[kf.uuid].bezier_right_time);
								kf.bezier_right_value.V3_set(old_values[kf.uuid].bezier_right_value);

								if (side === 'left') {
									kf.bezier_left_time[axis_number] =  Math.min(0, old_values[kf.uuid].bezier_left_time[axis_number] + difference_time);
									kf.bezier_left_value[axis_number] = old_values[kf.uuid].bezier_left_value[axis_number] + difference_value;
									if (kf.bezier_linked) {
										kf.bezier_right_time[axis_number] = -kf.bezier_left_time[axis_number];
										kf.bezier_right_value[axis_number] = -kf.bezier_left_value[axis_number];
									}
								}
								if (side === 'right') {
									kf.bezier_right_time[axis_number] =  Math.max(0, old_values[kf.uuid].bezier_right_time[axis_number] + difference_time);
									kf.bezier_right_value[axis_number] = old_values[kf.uuid].bezier_right_value[axis_number] + difference_value;
									if (kf.bezier_linked) {
										kf.bezier_left_time[axis_number] = -kf.bezier_right_time[axis_number];
										kf.bezier_left_value[axis_number] = -kf.bezier_right_value[axis_number];
									}
								}
								if (kf.uniform) {
									let off_axis_a = (axis_number+1) % 3;
									let off_axis_b = (axis_number+2) % 3;
									kf.bezier_right_time[off_axis_a] = kf.bezier_right_time[off_axis_b] = kf.bezier_right_time[axis_number];
									kf.bezier_right_value[off_axis_a] = kf.bezier_right_value[off_axis_b] = kf.bezier_right_value[axis_number];
									kf.bezier_left_time[off_axis_a] = kf.bezier_left_time[off_axis_b] = kf.bezier_left_time[axis_number];
									kf.bezier_left_value[off_axis_a] = kf.bezier_left_value[off_axis_b] = kf.bezier_left_value[axis_number];
								}
								values_changed = true;
							}
						}
						let text = `${trimFloatNumber(Math.roundTo(difference_time, 2))} ⨉ ${trimFloatNumber(Math.roundTo(difference_value, 2))}`;
						Blockbench.setStatusBarText(text);

						Timeline.vue.show_zero_line = !Timeline.vue.show_zero_line;
						Timeline.vue.show_zero_line = !Timeline.vue.show_zero_line;
						Animator.showMotionTrail()
						Animator.preview()
					}
					function off() {
						removeEventListeners(document, 'mousemove touchmove', slide);
						removeEventListeners(document, 'mouseup touchend', off);

						if (is_setup) {
							Blockbench.setStatusBarText();
							if (values_changed) {
								Undo.finishEdit('Adjust keyframe bezier handles');
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
				slideGraphAmplify(e1, anchor_side) {
					convertTouchEvent(e1);
					let original_values = {};
					let values_changed;
					let is_setup = false;
					let keyframes = this.graph_editor_animator[this.graph_editor_channel].filter(kf => kf.selected);
					let original_range = this.getSelectedGraphRange();
					let original_pixel_range = (original_range[1] - original_range[0]) * this.graph_size;
					let axis = this.graph_editor_axis;

					function setup() {
						Undo.initEdit({keyframes});
						dragging_range = [Infinity, 0];
						previousValue = 0;
						values_changed = false;
						Timeline.dragging_keyframes = true;
						is_setup = true;

						for (let kf of keyframes) {
							original_values[kf.uuid] = kf.display_value || kf.get(this.graph_editor_axis);
						}
					}

					function slide(e2) {
						convertTouchEvent(e2);
						e2.preventDefault();
						let offset = e2.clientY - e1.clientY;
						if (anchor_side == 1) offset *= -1;
						if (!is_setup) {
							if (Math.abs(offset) > 4) {
								setup();
							} else {
								return;
							}
						}
						
						let value = 1 - offset / original_pixel_range;
						value = Math.round(value*100)/100;

						for (let kf of keyframes) {
							let origin = original_range[anchor_side];
							if (e2.altKey) {
								origin = Math.lerp(original_range[0], original_range[1], 0.5);
							}
							target_value = (original_values[kf.uuid] - origin) * value + origin;
							kf.offset(axis, -kf.get(axis) + target_value);
							values_changed = true;
						}
						let text = Math.round(value * 100) + '%';
						Blockbench.setStatusBarText(text);
						Animator.showMotionTrail()
						Animator.preview()

					}
					function off() {
						removeEventListeners(document, 'mousemove touchmove', slide);
						removeEventListeners(document, 'mouseup touchend', off);

						if (is_setup) {
							Blockbench.setStatusBarText();
							if (values_changed) {
								Undo.finishEdit('Amplify keyframes');
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
				clickGraphEditor(event) {
					if (!this.show_other_graphs || !this.graph_editor_animator) return;
					let value = (this.graph_offset - event.offsetY) / this.graph_size;
					let original_time = Timeline.time;

					let tryAt = (x_coord) => {
						let time = (x_coord) / this.size;
						Timeline.time = time;

						let distances = ['x', 'y', 'z'].map(axis => {
							let axis_value = this.graph_editor_animator.interpolate(this.graph_editor_channel, false, axis);
							let diff = Math.abs(axis_value - value) * this.graph_size;
							if (diff < 12.5) {
								return {axis, diff};
							}
						}).filter(a => a);
						if (distances.length) return distances;
					}
					
					let real_x_coord = event.offsetX-8;
					let distances = tryAt(real_x_coord) || tryAt(real_x_coord + 4) || tryAt(real_x_coord - 4);

					if (distances) {
						distances.sort((a, b) => a.diff - b.diff);
						this.graph_editor_axis = distances[0].axis;
					}
					Timeline.time = original_time;
				},
				getBezierHandleStyle(keyframe, side) {
					let axis_number = getAxisNumber(this.graph_editor_axis);
					let x_offset = -keyframe[`bezier_${side}_time`][axis_number] * this.size;
					let y_offset = -keyframe[`bezier_${side}_value`][axis_number] * this.graph_size;
					let length = Math.sqrt(Math.pow(x_offset, 2) + Math.pow(y_offset, 2));
					let angle = Math.atan2(-y_offset, x_offset);
					return {
						right: x_offset + 'px',
						top: y_offset + 'px',
						'--length': Math.max(length - 6, 0) + 'px',
						'--angle': Math.radToDeg(angle) + 'deg',
					}
				},
				getSelectedGraphRange() {
					if (Keyframe.selected.length == 0 || !this.graph_editor_animator) return null;
					let keyframes = this.graph_editor_animator[this.graph_editor_channel];
					if (!keyframes || keyframes.length < 2) return null;
					let range = [Infinity, -Infinity];
					keyframes.forEach(kf => {
						if (!kf.selected) return;
						range[0] = Math.min(range[0], kf.display_value);
						range[1] = Math.max(range[1], kf.display_value);
					})
					if (range[0] == range[1]) return null;
					return range;
				},
				clamp: Math.clamp,
				trimFloatNumber,
				getAxisLetter
			},
			watch: {
				size() {this.updateTimecodes()},
				length() {this.updateTimecodes()},
				scroll_left() {this.updateTimecodes()},
			},
			template: `
				<div id="timeline_vue" :class="{graph_editor: graph_editor_open}" :style="{'--timeline-height': timeline_height + 'px'}">
					<div id="timeline_header">
						<div id="timeline_corner" v-bind:style="{width: head_width+'px'}">
							<div id="timeline_timestamp">{{ timestamp }}</div>
							<span id="">/</span>
							<div id="timeline_framenumber">{{ framenumber }}</div>
							<div class="channel_axis_selector" v-if="graph_editor_open">
								<div @click="graph_editor_axis = 'x';" :class="{selected: graph_editor_axis == 'x'}" style="color: var(--color-axis-x);">X</div>
								<div @click="graph_editor_axis = 'y';" :class="{selected: graph_editor_axis == 'y'}" style="color: var(--color-axis-y);">Y</div>
								<div @click="graph_editor_axis = 'z';" :class="{selected: graph_editor_axis == 'z'}" style="color: var(--color-axis-z);">Z</div>
							</div>
						</div>
						<div id="timeline_time_wrapper">
						<div id="timeline_time" v-bind:style="{width: (size*length)+'px', left: -scroll_left+'px'}">
								<div id="timeline_custom_range_indicator" v-if="custom_range[1]"
									v-bind:style="{left: (custom_range[0] * size) + 'px', width: ((custom_range[1] - custom_range[0]) * size) + 'px'}"
								/>
								<div v-for="t in timecodes" class="timeline_timecode" :key="t.text" :style="{left: (t.time * size) + 'px', width: (t.width * size) + 'px'}">
									<span>{{ t.text }}</span>
									<div class="substeps">
										<div v-for="n in Math.ceil(t.substeps)" :key="t.text + '-' + n"></div>
									</div>
								</div>
								<div id="timeline_playhead"
									v-bind:style="{left: (playhead * size) + 'px'}"
								/>
								<div id="timeline_onion_skin_point"
									v-if="onion_skin_selectable"
									v-bind:style="{left: (onion_skin_time * size) + 'px'}"
								/>
								<div id="timeline_endbracket"
									v-bind:style="{left: (animation_length * size) + 'px'}"
								/>
								<div
									v-for="marker in markers"
									class="timeline_marker"
									v-bind:style="{left: (marker.time * size) + 'px', '--color': markerColors[marker.color % markerColors.length].standard}"
									@contextmenu.prevent="marker.showContextMenu($event)"
									v-on:click="marker.callPlayhead()"
								>
									<i class="material-icons icon">sports_score</i>
								</div>
							</div>
						</div>
					</div>
					<div id="timeline_graph_editor_amplifier"
						v-if="graph_editor_open && getSelectedGraphRange()"
						:style="{top: (graph_offset - getSelectedGraphRange()[1] * graph_size - 8) + 'px', height: ((getSelectedGraphRange()[1] - getSelectedGraphRange()[0]) * graph_size + 15) + 'px'}"
						title="${tl('timeline.amplify')}"
					>
						<div @mousedown="slideGraphAmplify($event, 0)" @touchstart="slideGraphAmplify($event, 0)"></div>
						<div @mousedown="slideGraphAmplify($event, 1)" @touchstart="slideGraphAmplify($event, 1)"></div>
					</div>
					<div id="timeline_body" ref="timeline_body" @scroll="updateScroll($event)">
						<div id="timeline_body_inner" v-bind:style="{width: (size*length + head_width)+'px'}" @contextmenu.stop="Timeline.showMenu($event)">
							<li v-for="animator in animators" class="animator" :class="{selected: animator.selected, boneless: animator.constructor.name == 'BoneAnimator' && !animator.group}" :uuid="animator.uuid" v-on:click="animator.clickSelect();">
								<div class="animator_head_bar">
									<div class="channel_head" v-bind:style="{left: '0px', width: head_width+'px'}" v-on:dblclick.stop="toggleAnimator(animator)" @contextmenu.stop="animator.showContextMenu($event)">
										<div class="text_button" v-on:click.stop="toggleAnimator(animator)">
											<i class="icon-open-state fa" v-bind:class="{'fa-angle-right': !animator.expanded, 'fa-angle-down': animator.expanded}"></i>
										</div>
										<span v-on:click.stop="animator.clickSelect();" @mousedown="dragAnimator(animator, $event)" @touchstart="dragAnimator(animator, $event)">{{animator.name}}</span>
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
										v-bind:style="{left: '0px', width: head_width+'px'}"
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
											v-bind:class="{[keyframe.channel]: true, selected: keyframe.selected, has_expressions: keyframe.has_expressions}"
											v-bind:id="keyframe.uuid"
											v-on:click.stop="keyframe.clickSelect($event)"
											v-on:dblclick="keyframe.callPlayhead()"
											:title="tl('timeline.'+keyframe.channel)"
											@mousedown="dragKeyframes(keyframe, $event)" @touchstart="dragKeyframes(keyframe, $event)"
											@contextmenu.prevent.stop="keyframe.showContextMenu($event)"
										>
											<i class="material-icons keyframe_icon_smaller" v-if="keyframe.interpolation == 'catmullrom'">lens</i>
											<i class="material-icons keyframe_icon_step" v-else-if="keyframe.interpolation == 'step'">eject</i>
											<i class="icon-keyframe_bezier" v-else-if="keyframe.interpolation == 'bezier'"></i>
											<i :class="keyframe.data_points.length == 1 ? 'icon-keyframe' : 'icon-keyframe_discontinuous'" v-else></i>
											<svg class="keyframe_waveform" v-if="keyframe.channel == 'sound' && keyframe.data_points[0].file && waveforms[keyframe.data_points[0].file]" :style="{width: waveforms[keyframe.data_points[0].file].duration * size}">
												<polygon :points="getWaveformPoints(waveforms[keyframe.data_points[0].file].samples, size)"></polygon>
											</svg>
										</div>
									</div>
								</div>
							</li>
							<div id="timeline_empty_head" class="channel_head" v-bind:style="{width: head_width+'px'}">
							</div>
							<div id="timeline_selector" class="selection_rectangle"></div>
							<div id="timeline_graph_editor" ref="graph_editor" v-if="graph_editor_open" :style="{left: head_width + 'px', top: scroll_top + 'px'}">
								<svg :style="{'margin-left': clamp(scroll_left, 9, Infinity) + 'px'}">
									<path :d="zero_line" style="stroke: var(--color-grid);"></path>
									<path :d="one_line" style="stroke: var(--color-grid); stroke-dasharray: 6;" v-if="graph_editor_channel == 'scale'"></path>
									<template v-for="ruler in rulers">
										<path :d="ruler.path" style="stroke: var(--color-grid); stroke-width: 0.5px;"></path>
										<text :y="ruler.position - 4">{{ ruler.label }}</text>
									</template>

									<path v-for="(loop_graph, i) in loop_graphs"
										:d="loop_graph"
										class="loop_graph"
										:class="{selected: loop_graphs.length == 0 || i == graph_editor_axis_number}"
										style="stroke: var(--color-grid);"
									></path>
									<path v-if="graphs.length == 3"
										:d="graphs[(graph_editor_axis_number+1) % 3]"
										class="main_graph"
										:style="{stroke: 'var(--color-axis-' + getAxisLetter((graph_editor_axis_number+1) % 3) + ')'}"
									></path>
									<path v-if="graphs.length == 3"
										:d="graphs[(graph_editor_axis_number+2) % 3]"
										class="main_graph"
										:style="{stroke: 'var(--color-axis-' + getAxisLetter((graph_editor_axis_number+2) % 3) + ')'}"
									></path>
									<path
										:d="graphs[graphs.length == 3 ? graph_editor_axis_number : 0]"
										class="main_graph selected"
										:style="{stroke: 'var(--color-axis-' + graph_editor_axis + ')'}"
									></path>
								</svg>
								<template v-if="graph_editor_animator">
									<div
										v-for="keyframe in graph_editor_animator[graph_editor_channel]"
										v-bind:style="{left: (10 + keyframe.time * size) + 'px', top: (graph_offset - keyframe.display_value * graph_size - 8) + 'px', color: getColor(keyframe.color)}"
										class="keyframe graph_keyframe"
										v-bind:class="[keyframe.channel, keyframe.selected?'selected':'']"
										v-bind:id="keyframe.uuid"
										v-on:click.stop="keyframe.clickSelect($event)"
										v-on:dblclick="keyframe.callPlayhead()"
										:title="trimFloatNumber(keyframe.time, 2) + ' ⨉ ' + trimFloatNumber(keyframe.display_value || 0)"
										@mousedown="dragKeyframes(keyframe, $event)" @touchstart="dragKeyframes(keyframe, $event)"
										@contextmenu.prevent.stop="keyframe.showContextMenu($event)"
									>
										<i class="material-icons keyframe_icon_smaller" v-if="keyframe.interpolation == 'catmullrom'">lens</i>
										<i class="material-icons keyframe_icon_step" v-else-if="keyframe.interpolation == 'step'">eject</i>
										<i :class="keyframe.data_points.length == 1 ? 'icon-keyframe' : 'icon-keyframe_discontinuous'" v-else></i>

										<template v-if="keyframe.interpolation == 'bezier' && (show_all_handles || keyframe.selected)">
											<div class="keyframe_bezier_handle"
												:style="getBezierHandleStyle(keyframe, 'left')"
												:title="'${tl('generic.left')}: ' + trimFloatNumber(keyframe.bezier_left_time[graph_editor_axis_number], 2) + ' ⨉ ' + trimFloatNumber(keyframe.bezier_left_value[graph_editor_axis_number])"
												@mousedown="dragBezierHandle(keyframe, 'left', $event)" @touchstart="dragBezierHandle('left', $event)"
											></div>
											<div class="keyframe_bezier_handle"
												:style="getBezierHandleStyle(keyframe, 'right')"
												:title="'${tl('generic.right')}: ' + trimFloatNumber(keyframe.bezier_right_time[graph_editor_axis_number], 2) + ' ⨉ ' + trimFloatNumber(keyframe.bezier_right_value[graph_editor_axis_number])"
												@mousedown="dragBezierHandle(keyframe, 'right', $event)" @touchstart="dragBezierHandle('right', $event)"
											></div>
										</template>
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
	new Toggle('graph_editor_other_graphs', {
		icon: 'exposure_zero',
		category: 'animation',
		condition: {modes: ['animate'], method: () => Timeline.vue.graph_editor_open},
		default: true,
		onChange(state) {
			Timeline.vue.show_other_graphs = state;
		}
	})
	new Toggle('graph_editor_include_other_graphs', {
		icon: 'exposure_zero',
		category: 'animation',
		condition: {modes: ['animate'], method: () => Timeline.vue.graph_editor_open && Timeline.vue.show_other_graphs},
		default: true,
		onChange(state) {
			Timeline.vue.include_other_graphs = state;
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
		condition: {modes: ['animate'], selected: {animation_controller: false}},
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
	new Toggle('looped_animation_playback', {
		icon: 'fa-repeat',
		category: 'animation',
		condition: {modes: ['animate']},
		default: false
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
			let time = Timeline.custom_range[0] || 0;
			Timeline.setTime(time);
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
			let time = Timeline.custom_range[1] || (Animation.selected ? Animation.selected.length : 0);
			Timeline.setTime(time);
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
				Timeline.playAudioStutter();
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
				Timeline.playAudioStutter();
				Animator.preview()
			} else {
				BarItems.animated_texture_frame.change(v => v + 1);
			}
		}
	})
	new Action('set_timeline_range_start', {
		icon: 'logout',
		category: 'animation',
		condition: {modes: ['animate']},
		click() {
			Timeline.custom_range.set(0, Timeline.time);
			BARS.updateConditions();
		}
	})
	new Action('set_timeline_range_end', {
		icon: 'login',
		category: 'animation',
		condition: {modes: ['animate']},
		click() {
			Timeline.custom_range.set(1, Timeline.time);
			BARS.updateConditions();
		}
	})
	new Action('disable_timeline_range', {
		icon: 'code_off',
		category: 'animation',
		condition: {modes: ['animate']},
		condition: () => Timeline.custom_range[0] || Timeline.custom_range[1],
		click() {
			Timeline.custom_range.replace([0, 0]);
			BARS.updateConditions();
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
			unselectAllElements();
		}
	})
	new Action('select_effect_animator', {
		icon: 'fa-magic',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function () {
			if (!Animation.selected) return;
			if (!Animation.selected.animators.effects) {
				Animation.selected.animators.effects = new EffectAnimator(Animation.selected);
			}
			Animation.selected.animators.effects.select();
			BarItems.timeline_graph_editor.set(false);
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
						unselectAllElements();
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
