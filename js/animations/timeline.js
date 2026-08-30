import { markerColors } from "../marker_colors";
import { dragHelper } from "../util/drag_helper";
import TimelineComponent from "./Timeline.vue"

export class TimelineMarker {
	constructor(data) {
		this.uuid = guid();
		this.time = 0;
		this.color = 0;
		this.name = 0;
		if (data) {
			this.extend(data);
		}
	}
	extend(data) {
		Merge.number(this, data, 'color');
		Merge.number(this, data, 'time');
		Merge.string(this, data, 'name');
	}
	getUndoCopy() {
		return {
			color: this.color,
			time: this.time,
			name: this.name,
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
	propertiesDialog() {
		new Dialog({
			id: 'timeline_marker_properties',
			title: 'menu.animation.properties',
			form: {
				time: {label: 'action.slider_keyframe_time', value: Math.roundTo(this.time, 4), type: 'number', min: 0},
				name: {label: 'generic.name', value: this.name, type: 'text'}
			},
			onConfirm: (form) => {
				this.time = form.time;
				this.name = form.name;
			}
		}).show();
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
	new MenuSeparator('manage'),
	{icon: 'delete', name: 'generic.delete', click: function(marker) {
		if (Animation.selected) Animation.selected.markers.remove(marker);
	}},
	new MenuSeparator('properties'),
	{
		name: 'menu.animation.properties',
		icon: 'list',
		click(marker) {
			marker.propertiesDialog();
		}
	},
])

export const Timeline = {
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
				e.target.id !== 'timeline_body_keyframe_canvas' &&
				Timeline.vue.keyframeHoverUuid !== ""
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
			Timeline.vue.refreshTimelineCanvas();
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

			Timeline.vue.refreshTimelineCanvas();
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
		let timeline_body = Panels.timeline.node.querySelector('#timeline_body');
		timeline_body.addEventListener('mousedown', e => {
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

		let timeline_time = Panels.timeline.node.querySelector('#timeline_time');
		addEventListeners(timeline_time, 'mousedown touchstart', e => {
			if (e.which !== 1 && !event.changedTouches) return;
			if (e.target.classList.contains('timeline_marker')) {
				let marker_uuid = e.target.getAttribute('uuid');
				let marker = Animation.selected.markers.find(m => m.uuid == marker_uuid);
				if (marker && (Pressing.overrides.ctrl || e.ctrlOrCmd)) {
					let initial_time = marker.time;
					dragHelper(e, {
						onMove(arg) {
							marker.time = Math.max(0, initial_time + arg.delta.x / Timeline.vue.$data.size);
							if (!arg.event.ctrlKey) marker.time = Timeline.snapTime(marker.time);
							displayTimeOnCursor(marker.time);
						},
						onEnd() {
							Blockbench.setCursorTooltip();
						}
					})
				}
				return;
			}

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
		function displayTimeOnCursor(time) {
			if (settings.timecode_frame_number.value) {
				time = Math.round(time / Timeline.getStep());
			} else {
				time = Math.roundTo(time, 2);
			}
			Blockbench.setCursorTooltip(time);
		}
		addEventListeners(document, 'mousemove touchmove', e => {
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
					displayTimeOnCursor(time);
				}
			} else if (Timeline.dragging_endbracket) {

				convertTouchEvent(e);
				let offset = e.clientX - $('#timeline_time').offset().left;
				let time = Timeline.snapTime(offset / Timeline.vue._data.size)
				
				Animation.selected.setLength(time)
				Timeline.revealTime(time)
				displayTimeOnCursor(time);

			} else if (Timeline.dragging_onion_skin_point) {

				convertTouchEvent(e);
				let offset = e.clientX - $('#timeline_time').offset().left;
				let time = Timeline.snapTime(offset / Timeline.vue._data.size)
				
				if (Timeline.vue.onion_skin_time != time) {
					Timeline.vue.onion_skin_time = time;
					Timeline.revealTime(time);
					Animator.updateOnionSkin();
					displayTimeOnCursor(time);
				}
			}
		});
		addEventListeners(document, 'mouseup touchend', e => {
			if (Timeline.dragging_playhead) {
				delete Timeline.dragging_playhead;
				Interface.removeSuggestedModifierKey('ctrl', 'modifier_actions.drag_without_snapping');
				if (Timeline.playing) Timeline.pause();

			} else if (Timeline.dragging_endbracket) {
				Undo.finishEdit('Change Animation Length')
				delete Timeline.dragging_endbracket

			} else if (Timeline.dragging_onion_skin_point) {
				delete Timeline.dragging_onion_skin_point
			}
			Blockbench.setCursorTooltip();
		});
		
		//Enter Time
		let timestamp = Panels.timeline.node.querySelector('#timeline_timestamp');
		addEventListeners(timestamp, 'click', e => {
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
		addEventListeners(timestamp, 'focusout keydown', e => {
			if (e.type === 'focusout' || Keybinds.extra.confirm.keybind.isTriggered(e) || Keybinds.extra.cancel.keybind.isTriggered(e)) {
				$('#timeline_timestamp').attr('contenteditable', false)
				Timeline.setTimecode(Timeline.time)
			}
		})
		addEventListeners(timestamp, 'keyup', e => {
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
		let framenumber = Panels.timeline.node.querySelector('#timeline_framenumber');
		framenumber.addEventListener('click', e => {
			if ($('#timeline_framenumber').attr('contenteditable') == 'true') return;

			$('#timeline_framenumber').attr('contenteditable', true).trigger('focus');
			document.execCommand('selectAll');
		})
		addEventListeners(framenumber, 'focusout keydown', e => {
			if (e.type === 'focusout' || Keybinds.extra.confirm.keybind.isTriggered(e) || Keybinds.extra.cancel.keybind.isTriggered(e)) {
				$('#timeline_framenumber').attr('contenteditable', false)
			}
		})
		addEventListeners(framenumber, 'keyup', e => {
			let frame = parseInt($('#timeline_framenumber').text())
			let seconds = frame * Timeline.getStep();
			if (Math.abs(seconds-Timeline.time) > 1e-3 ) {
				Timeline.setTime(seconds, true)
				Animator.preview()
			}
		})

		let timeline_vue = Panels.timeline.node.querySelector('#timeline_vue');
		addEventListeners(timeline_vue, 'mousewheel scroll', function(event) {
			event.preventDefault()
			let body = document.getElementById('timeline_body');
			let is_zoom_gesture = event.ctrlKey && !Pressing.ctrl;

			body.scrollLeft += event.deltaX/2;

			if (event.shiftKey) {
				body.scrollLeft += event.deltaY/4

			} else if (is_zoom_gesture || Keybinds.extra.uv_editor_scroll_zoom.keybind.isTriggered(event)) {

				let offset = $('#timeline_body_inner').offset()
				let offsetX = event.clientX - offset.left - Timeline.vue._data.head_width;
				
				var zoom = 1 - event.deltaY / (is_zoom_gesture ? 160 : 600)
				let original_size = Timeline.vue._data.size
				let updated_size = limitNumber(Timeline.vue._data.size * zoom, 10, 1000)
				Timeline.vue._data.size = updated_size;
				
				body.scrollLeft += (updated_size - original_size) * (offsetX / original_size)

			} else {
				body.scrollTop += event.deltaY/4;
			}
			Timeline.updateSize()
			Timeline.vue.refreshTimelineCanvas();
			event.preventDefault();
		});

		Blockbench.on('update_pressed_modifier_keys', (keys) => {
			if (!Modes.animate) return;
			let timeline_time = document.getElementById('timeline_time');
			if (!timeline_time) return;
			timeline_time.classList.toggle('holding_ctrl', keys.now.ctrl);
		})

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
		Timeline.vue.clearTimelineCanvas();
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
		'timeline_focus',
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

StateMemory.init("timeline_channels", "object", {
	rotation: true,
	position: true,
	scale: true,
	hide_empty: false,
});

Interface.definePanels(() => {
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
		component: TimelineComponent
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

			Timeline.vue.refreshTimelineCanvas();
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
		condition: {
			modes: ['animate'],
			method: () => Timeline.custom_range[0] || Timeline.custom_range[1],
		},
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
			Timeline.vue.refreshTimelineCanvas();
		}
	})
	new Action('add_all_to_timeline', {
		icon: 'docs_add_on',
		category: 'animation',
		condition: {modes: ['animate'], selected: {animation_controller: false, animation: true}},
		click() {
			Group.all.concat(Outliner.elements).forEach(node => {
				if (!node.selected) return;
				let ba = Animation.selected.getBoneAnimator(node);
				if (ba) ba.addToTimeline();
			})
			Timeline.vue.refreshTimelineCanvas();
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
			Timeline.vue.refreshTimelineCanvas();
		}
	})
	new Action('clear_timeline', {
		icon: 'clear_all',
		category: 'animation',
		condition: {modes: ['animate']},
		click: function () {
			Timeline.vue._data.animators.purge();
			Timeline.vue.clearTimelineCanvas();
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
			let menu_list = [];
			let used_animator_types = [BoneAnimator];
			for (let animator of Timeline.animators) {
				used_animator_types.safePush(animator.constructor);
			}
			for (let type of used_animator_types) {
				for (let id in type.prototype.channels) {
					if (menu_list.find(e => e.id == id)) continue;
					let channel = type.prototype.channels[id];
					menu_list.push({
						id,
						name: channel.name ?? `timeline.${id}`,
						icon: channels[id] != false ? on : off,
						click() {
							Vue.set(channels, id, channels[id] == false);
							StateMemory.save('timeline_channels');
							Timeline.vue.refreshTimelineCanvas();
						}
					})
				}
			}
			return [
				...menu_list,
				'_',
				{name: 'action.timeline_focus.hide_empty', icon: channels.hide_empty ? on : off, click() {
					Vue.set(channels, 'hide_empty', !channels.hide_empty);
					StateMemory.save('timeline_channels');
					Timeline.vue.refreshTimelineCanvas();
				}},
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


Object.assign(window, {
	TimelineMarker,
	Timeline
});
