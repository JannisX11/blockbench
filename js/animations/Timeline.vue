<template>
	<div id="timeline_vue" :class="{graph_editor: graph_editor_open}" :style="{'--timeline-height': timeline_height + 'px'}">
		<div id="timeline_header">
			<div id="timeline_corner" :style="{width: head_width+'px'}">
				<div id="timeline_timestamp">{{ timestamp }}</div>
				<span>/</span>
				<div id="timeline_framenumber">{{ framenumber }}</div>
				<div class="channel_axis_selector" v-if="graph_editor_open">
					<div @click="setGraphEditorAxis('x');" :class="{selected: graph_editor_axis == 'x'}" style="color: var(--color-axis-x);">X</div>
					<div @click="setGraphEditorAxis('y');" :class="{selected: graph_editor_axis == 'y'}" style="color: var(--color-axis-y);">Y</div>
					<div @click="setGraphEditorAxis('z');" :class="{selected: graph_editor_axis == 'z'}" style="color: var(--color-axis-z);">Z</div>
				</div>
			</div>
			<div id="timeline_time_wrapper">
			<div id="timeline_time" :style="{width: (size*length)+'px', left: -scroll_left+'px'}">
					<div id="timeline_custom_range_indicator" v-if="custom_range[1]"
						:style="{left: (custom_range[0] * size) + 'px', width: ((custom_range[1] - custom_range[0]) * size) + 'px'}"
					/>
					<div v-for="timecode in timecodes" class="timeline_timecode" :key="timecode.text" :style="{left: (timecode.time * size) + 'px', width: (timecode.width * size) + 'px'}">
						<span>{{ timecode.text }}</span>
						<div class="substeps">
							<div v-for="n in Math.ceil(timecode.substeps)" :key="timecode.text + '-' + n"></div>
						</div>
					</div>
					<div id="timeline_playhead"
						:style="{left: (playhead * size) + 'px'}"
					/>
					<div id="timeline_onion_skin_point"
						v-if="onion_skin_selectable"
						:style="{left: (onion_skin_time * size) + 'px'}"
					/>
					<div id="timeline_endbracket"
						:style="{left: (animation_length * size) + 'px'}"
					/>
					<div
						v-for="marker in markers"
						class="timeline_marker tool"
						:style="{left: (marker.time * size) + 'px', '--color': getColor(marker.color)}"
						:uuid="marker.uuid"
						@contextmenu.prevent="marker.showContextMenu($event)"
						@dblclick.prevent="marker.propertiesDialog()"
						@click="marker.callPlayhead()"
					>
						<i class="material-icons icon">beenhere</i>
						<div class="tooltip" v-if="marker.name">{{ marker.name }}</div>
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
			<div id="timeline_body_inner" :style="{width: (size*length + head_width)+'px'}">
				<aside id="timeline_body_channel_headers">
					<li 
						v-for="animator in animators" 
						class="animator" 
						:class="{selected: animator.selected, boneless: animator.displayPosition && !animator.node}" 
						:uuid="animator.uuid" 
					>
						<div class="animator_head_bar">
							<div class="channel_head" :style="{left: '0px', width: head_width+'px'}" @dblclick.stop="toggleAnimator(animator)" @contextmenu.stop="animator.showContextMenu($event)">
								<div class="text_button" @click.stop="toggleAnimator(animator)">
									<i class="icon-open-state fa" :class="{'fa-angle-right': !animator.expanded, 'fa-angle-down': animator.expanded}"></i>
								</div>
								<dynamic-icon v-if="animator.node" :icon="animator.node.icon.replace('fa ', '').replace(/ /g, '.')" :color="getNodeColor(animator.node)" />
								<dynamic-icon v-else-if="animator.particle" :icon="'wand_shine'" />
								<dynamic-icon v-else :icon="'help'" style="color: var(--color-error)" />
								<span class="timeline_animator_name" @click.stop="animator.clickSelect();" @mousedown="dragAnimator(animator, $event)" @touchstart="dragAnimator(animator, $event)">
									{{animator.name}}
								</span>
								<div class="text_button" @click.stop="removeAnimator(animator)">
									<i class="material-icons">remove</i>
								</div>
							</div>
						</div>
						<div class="animator_channel_bar"
							v-for="(channel_options, channel) in animator.channels"
							v-if="animator.expanded && channels[channel] != false && Condition(channel_options.condition, animator) && (!channels.hide_empty || animator[channel].length)"
							:style="graph_editor_open ? {} : {width: head_width+'px'}"
						>
							<div class="channel_head"
								:class="{selected: graph_editor_open && animator.selected && graph_editor_channel == channel}"
								:style="{left: '0px', width: head_width+'px'}"
								@click.stop="selectChannel(animator, channel);"
								@contextmenu.stop="animator.showContextMenu($event)"
							>
								<div class="text_button" v-if="channel_options.mutable" @click.stop="animator.toggleMuted(channel)">
									<i class="icon material-icons channel_mute" :class="{disabled: animator.muted[channel]}">
										{{ channel === 'sound' ? (animator.muted[channel] ? 'volume_off' : 'volume_up') : (animator.muted[channel] ? 'visibility_off' : 'visibility') }}
									</i>
								</div>
								<div class="text_button" v-else></div>
								<span>{{ channel_options.name }}</span>
								<div class="text_button rotation_global" :class="{off: !animator.rotation_global}"
									v-if="channel == 'rotation' && animator.type == 'bone'"
									title="${tl('menu.animator.rotation_global')}"
									@click.stop="toggleGlobalSpace(animator)"
								>
									<i class="material-icons">{{ animator.rotation_global ? 'public' : 'public_off' }}</i>
								</div>
								<div class="text_button" @click.stop="animator.createKeyframe(null, null, channel, true)">
									<i class="material-icons">add</i>
								</div>
							</div>
						</div>
					</li>
					<div id="timeline_empty_head" class="channel_head" :style="{width: head_width+'px'}" />
				</aside>
				<!-- --------------------------------------------------------------------- -->
				<!-- Timeline keyframe canvas overlay (for all keyframes, graph & channel) -->
				<!-- --------------------------------------------------------------------- -->
				<canvas 
					id="timeline_body_keyframe_canvas" 
					ref="keyframe_canvas"
					:style="{left: `${head_width}px`}"
					@click.stop="clickKeyframeOnCanvas($event)" 
					@dblclick="callPlayHeadToKeyframeOnCanvas($event)" 
					@mousedown="dragOnCanvas($event)" 
					@touchstart="dragOnCanvas($event)"
					@contextmenu.prevent.stop="openKeyframeContextMenuOnCanvas($event)"
					@mousemove="hoverOnCanvas($event)"
					@mouseleave="clearHoveredKeyframe()"
				/>
				<!-- ----------------------------- -->
				<!-- Timeline regular channels DOM -->
				<!-- ----------------------------- -->
				<section id="timeline_body_keyframe_backdrop">
					<li 
						v-for="animator in animators" 
						v-if="!graph_editor_open" 
						class="animator" 
						:class="{selected: animator.selected, boneless: animator.displayPosition && !animator.node}" 
						:uuid="animator.uuid"
					>
						<div class="animator_head_bar" />
						<div class="animator_channel_bar"
							v-for="(channel_options, channel) in animator.channels"
							v-if="animator.expanded && channels[channel] != false && Condition(channel_options.condition, animator) && (!channels.hide_empty || animator[channel].length)"
							:style="graph_editor_open ? {} : {width: (size*length + head_width)+'px'}"
						>
							<div class="keyframe_section" v-if="!graph_editor_open">
								<div
									v-for="keyframe in animator[channel]"
									class="keyframe"
									:class="{[keyframe.channel]: true, selected: keyframe.selected, has_expressions: keyframe.has_expressions}"
									:id="keyframe.uuid"
									:style="{left: (8 + keyframe.time * size) + 'px'}"
								>
									<svg class="keyframe_waveform" v-if="keyframe.channel == 'sound' && keyframe.data_points[0].file && waveforms[keyframe.data_points[0].file]" :style="{width: waveforms[keyframe.data_points[0].file].duration * size}">
										<polygon :points="getWaveformPoints(waveforms[keyframe.data_points[0].file].samples, size)"></polygon>
									</svg>
								</div>
							</div>
						</div>
					</li>
				</section>
				<!-- ------------------------- -->
				<!-- Timeline Graph editor DOM -->
				<!-- ------------------------- -->
				<section v-if="graph_editor_open" id="timeline_graph_editor" ref="graph_editor" :style="{translate: '0 0', left: head_width + 'px', top: scroll_top + 'px'}">
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
							style="stroke: var(--color-loop_graph);"
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
				</section>

				<div id="timeline_selector" class="selection_rectangle"></div>
			</div>
		</div>
	</div>
</template>

<script lang="js">
import { tl } from '../languages';

export default {
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

		channels: StateMemory.timeline_channels,

		samplingScale: 4.0,

		keyframeHoverUuid: "",
		bezierHandleHover: {
			keyUuid: "",
			side: ""
		},
		keyframeIcons: { // There has to be a better way to type these characters, but this is the best I found for now - Aza
			linear: {
			  	default: "",
			  	discontinuous:  "",
				molang: "",
				discontinuous_molang: ""
			},
			bezier: {
			 	default: "",
				discontinuous: "",
			 	molang: "",
				discontinuous_molang: ""
			},
			smooth: {
			  	default: "",
			  	molang: ""
			},
			step: {
			  	default: "",
			  	discontinuous: "",
				molang: "",
				discontinuous_molang: ""
			},
			hidden: {
			  	default: "",
				discontinuous: "",
				molang: ""
			}
		}
	}},
	watch: {
		size() {this.updateTimecodes()},
		length() {this.updateTimecodes()},
		scroll_left() {this.updateTimecodes()},
	},
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
			
			this.refreshTimelineCanvas();
			return graphs;
		},
		graph_editor_axis_number() {
			return getAxisNumber(this.graph_editor_axis)
		}
	},
	methods: {
		tl,
		setGraphEditorAxis(axis) {
			this.graph_editor_axis = axis; 
			this.refreshTimelineCanvas();
		},
		clearTimelineCanvas() {
			let bodyCanvas = $('#timeline_body_keyframe_canvas').get(0);
			let context = bodyCanvas.getContext("2d");
			context.clearRect(0, 0, bodyCanvas.width, bodyCanvas.height);
		},
		shouldCullKeyframeOnGraph(keyframe) {
			if (!this.graph_editor_open) return false;
			let body = $('#timeline_body').get(0);
			let timelineStyle = window.getComputedStyle(body);
			let rectHeight = body.clientHeight;
			let rectWidth = body.clientWidth - this.head_width;
			let scrollOffsetY = body.scrollTop;
			let scrollOffsetX = body.scrollLeft;

			let keyRadius = timelineStyle.getPropertyValue("--keyframe-radius").trim();
			let keyHoveredRadius = timelineStyle.getPropertyValue("--keyframe-radius-hover").trim();
			let handleDiameter = timelineStyle.getPropertyValue("--keyframe-bezier-handle-diameter").trim();
			let keyHoveredHalfradius = keyHoveredRadius / 2.0;
			let keyHalfRadius = keyRadius / 2.0;
			let handleRadius = handleDiameter / 2.0;
			let size = this.size;
			let graphSize = this.graph_size;
			let graphOffset = this.graph_offset;
			let graphAxis = this.graph_editor_axis;
			let hoveredKeyframe = this.keyframeHoverUuid;
			let hoveredBezierHandle = this.bezierHandleHover;

			let timeStamp = keyframe.time;
			let isHovered = (hoveredKeyframe === keyframe.uuid);
			let anyHandleHovered = (hoveredBezierHandle.keyUuid === keyframe.uuid);
			let keyHalfScale = (isHovered || anyHandleHovered) ? keyHoveredHalfradius : keyHalfRadius;

			// Get keyframe X and Y without the text box offset
			let keyX = ((timeStamp * size) + keyHalfRadius - scrollOffsetX);
			let keyY = (graphOffset - (keyframe.display_value * graphSize) - scrollOffsetY);
			
			// Get keyframe X and Y with the text box offset
			let posX = (timeStamp * size) - (keyHalfScale - keyHoveredHalfradius) - scrollOffsetX;
			let posY = graphOffset - (keyframe.display_value * graphSize) - keyHalfScale - scrollOffsetY;
			
			// Handle position info
			let axis = getAxisNumber(graphAxis);
			let leftOffsetX = (keyframe[`bezier_left_time`][axis] * size) + keyX;
			let rightOffsetX = (keyframe[`bezier_right_time`][axis] * size) + keyX;
			let leftOffsetY = (-keyframe[`bezier_left_value`][axis] * graphSize) + keyY;
			let rightOffsetY = (-keyframe[`bezier_right_value`][axis] * graphSize) + keyY;

			// Checks
			let leftHandleOutOnLeft = (leftOffsetX < (handleRadius / 2.0));
			let leftHandleOutOnTop = (leftOffsetY < (handleRadius / 2.0));
			let leftHandleOutOnRight = (leftOffsetX > rectWidth + (handleRadius / 2.0));
			let leftHandleOutOnBottom = (leftOffsetY > rectHeight + (handleRadius / 2.0));
			let rightHandleOutOnLeft = (rightOffsetX < (handleRadius / 2.0));
			let rightHandleOutOnTop = (rightOffsetY < (handleRadius / 2.0));
			let rightHandleOutOnRight = (rightOffsetX > rectWidth + (handleRadius / 2.0));
			let rightHandleOutOnBottom = (rightOffsetY > rectHeight + (handleRadius / 2.0));
			let keyOutOnLeft = (posX < -keyHalfScale);
			let keyOutOnTop = (posY < -keyHalfScale);
			let keyOutOnRight = (posX > rectWidth - keyHalfScale);
			let keyOutOnBottom = (posY > rectHeight - keyHalfScale);

			let allOutOnLeft = keyOutOnLeft && leftHandleOutOnLeft && rightHandleOutOnLeft;
			let allOutOnTop = keyOutOnTop && leftHandleOutOnTop && rightHandleOutOnTop;
			let allOutOnRight = keyOutOnRight && leftHandleOutOnRight && rightHandleOutOnRight;
			let allOutOnBottom = keyOutOnBottom && leftHandleOutOnBottom && rightHandleOutOnBottom;
			if (allOutOnLeft || allOutOnRight || allOutOnTop || allOutOnBottom) return true;
			return false;
		},
		refreshTimelineCanvas() {
			if (!this._isMounted) return;
			if (!Animation.selected) { this.clearTimelineCanvas(); return; }
			if (!this.animators.length || (this.graph_editor_open && !this.graph_editor_animator)) { this.clearTimelineCanvas(); return; }

			// Store stuff, yk
			let size = this.size;
			let scale = this.samplingScale;
			let hoveredKeyframe = this.keyframeHoverUuid; 
			let hoveredBezierHandle = this.bezierHandleHover; 
			let icons = this.keyframeIcons;
			let isGraph = this.graph_editor_open;
			let graphOffset = this.graph_offset;
			let graphSize = this.graph_size;
			let graphShowAllHandles = this.show_all_handles;
			let graphAxis = this.graph_editor_axis;

			// Get required elements, stop if canvas is missing, we can't draw on nothing.
			let body = $('#timeline_body').get(0);
			let bodyCanvas = $('#timeline_body_keyframe_canvas').get(0);
			let bodyBackdrop = $('#timeline_body_keyframe_backdrop').get(0);
			if (!bodyCanvas) return;

			// Collect body style & scroll data
			let timelineStyle = window.getComputedStyle(body);
			let keyRadius = timelineStyle.getPropertyValue("--keyframe-radius").trim();
			let keyHoveredRadius = timelineStyle.getPropertyValue("--keyframe-radius-hover").trim();
			let keyGraphRadius = timelineStyle.getPropertyValue("--keyframe-graph-radius").trim();
			let keyGraphHoveredRadius = timelineStyle.getPropertyValue("--keyframe-graph-radius-hover").trim();
			let keyHiddenRadius = timelineStyle.getPropertyValue("--keyframe-radius-hidden").trim();
			let handleDiameter = timelineStyle.getPropertyValue("--keyframe-bezier-handle-diameter").trim();
			let handleStrokeWidth = timelineStyle.getPropertyValue("--keyframe-bezier-stroke-width").trim();
			let keyframeColor = timelineStyle.getPropertyValue("--color-keyframe").trim();
			let keyframeSelectedColor = timelineStyle.getPropertyValue("--color-keyframe-selected").trim();
			let keyframeHoveredColor = timelineStyle.getPropertyValue("--color-keyframe-hovered").trim();
			let keyframeCollapsedColor = timelineStyle.getPropertyValue("--color-keyframe-collapsed").trim();;
			let bezierHandleColor = timelineStyle.getPropertyValue("--color-keyframe-bezier-handle-dot").trim();
			let bezierHandleLineColor = timelineStyle.getPropertyValue("--color-keyframe-bezier-handle-line").trim();
			let keyHalfRadius = keyRadius / 2.0;
			let keyHoveredHalfradius = keyHoveredRadius / 2.0;
			let keyGraphHalfRadius = keyGraphRadius / 2.0;
			let keyGraphHoveredHalfradius = keyGraphHoveredRadius / 2.0;
			let keyHiddenHalfRadius = keyHiddenRadius / 2.0;
			let scrollOffsetY = body.scrollTop;
			let scrollOffsetX = body.scrollLeft;

			// Collect data & setup variables used for rendering only
			let context = bodyCanvas.getContext("2d");

			// Over-sample keyframe view, to avoid cut-off lines and odd blurs
			let rectHeight = body.clientHeight;
			let rectWidth = body.clientWidth - this.head_width;
			bodyCanvas.height = rectHeight * scale;
			bodyCanvas.width = rectWidth * scale;
			bodyCanvas.style.height = `${rectHeight}px`;
			bodyCanvas.style.width = `${rectWidth}px`;
			bodyBackdrop.style.translate = `-${rectWidth}px 0`;

			function drawKeyframe(keyframe, settings = { offset: 0, isCollapsed: false, isGraph: false }) {
				let radius = settings.isGraph ? keyGraphRadius : keyRadius;
				let halfRadius = settings.isGraph ? keyGraphHalfRadius : keyHalfRadius;
				let hoverRadius = settings.isGraph ? keyGraphHoveredRadius : keyHoveredRadius;
				let hoverHalfRadius = settings.isGraph ? keyGraphHoveredHalfradius : keyHoveredHalfradius;

				let isHovered = (hoveredKeyframe === keyframe.uuid);
				let anyHandleHovered = (hoveredBezierHandle.keyUuid === keyframe.uuid);
				let keyHalfScale = settings.isCollapsed ? keyHiddenHalfRadius : ((isHovered || anyHandleHovered) ? hoverHalfRadius : halfRadius);
				let timeStamp = keyframe.time;
				let posX = (timeStamp * size) - (keyHalfScale - hoverHalfRadius) - scrollOffsetX;
				let posY = settings.offset - keyHalfScale;
				
				if (settings.isGraph) {
					posY = graphOffset - (keyframe.display_value * graphSize) - keyHalfScale - scrollOffsetY;

					// Stop early if keyframe is out of frame
					if (Timeline.vue.shouldCullKeyframeOnGraph(keyframe)) return;
				}
				// Stop early if keyframe is out of frame horizontally
				else if (((posX < -keyHalfScale) || (posX > rectWidth - keyHalfScale))) return;

				// Set color & scale for hovering and selection
				let isSelected = keyframe.selected;
				let keyScale = radius * scale; // Over-sampled scale of keyframe
				let markerColor = Timeline.vue.getColor(keyframe.color, isHovered || anyHandleHovered);
				let color = (markerColor || keyframeColor);
				if (isSelected) {
					// Selection color
					color = keyframeSelectedColor;
				}
				if (isHovered || anyHandleHovered) {
					// Hovering scale & color (unless selected, then we use selection color) 
					color = isSelected ? keyframeSelectedColor : (markerColor || keyframeHoveredColor);
					keyScale = hoverRadius * scale;
				}
				if (settings.isCollapsed) {
					// Hidden scale & color 
					color = keyframeCollapsedColor
					keyScale = keyHiddenRadius * scale;
				};

				function pickIcon(iconData, continuousOnly = false) {
					let data = iconData;
					if (settings.isCollapsed) data = icons.hidden;

					if (continuousOnly) {
						if (isMolang) return data.molang;
						else return data.default;
					}

					if (isMolang && !isContinuous && !settings.isCollapsed) return data.discontinuous_molang;
					else if (isMolang) return data.molang;
					else if (!isContinuous) return data.discontinuous;
					else return data.default;
				} 

				let txtPosition = [(posX * scale), (posY * scale)];
				let icon = "";
				let isMolang = keyframe.has_expressions;
				let isContinuous = keyframe.data_points?.length == 1 || false;
				switch (keyframe.interpolation) {
					case "step": { 
						icon = pickIcon(icons.step);
						break; 
					}
					case "bezier": { 
						icon = pickIcon(settings.isGraph ? icons.linear : icons.bezier);
						break; 
					}
					case "catmullrom": { 
						icon = pickIcon(icons.smooth, true);
						break; 
					}
					default: { 
						icon = pickIcon(icons.linear);
						break; 
					}
				}

				if (settings.isGraph) {
					let displayHandles = (keyframe.interpolation == "bezier") && (graphShowAllHandles || keyframe.selected);

					if (displayHandles) {
						// Get keyframe X and Y without the text box offset
						let keyX = (timeStamp * size) + halfRadius - scrollOffsetX;
						let keyY = graphOffset - (keyframe.display_value * graphSize) - scrollOffsetY;

						// Handle position info
						let axis = getAxisNumber(graphAxis);
						let leftOffsetX = (keyframe[`bezier_left_time`][axis] * size) + keyX;
						let rightOffsetX = (keyframe[`bezier_right_time`][axis] * size) + keyX;
						let leftOffsetY = (-keyframe[`bezier_left_value`][axis] * graphSize) + keyY;
						let rightOffsetY = (-keyframe[`bezier_right_value`][axis] * graphSize) + keyY;
						let handleRadius = handleDiameter / 2.0;

						// Hover data
						let canBeHovered = hoveredBezierHandle.keyUuid === keyframe.uuid;
						let isLeftHovered = hoveredBezierHandle.side === "left" && canBeHovered;
						let isRightHovered = hoveredBezierHandle.side === "right" && canBeHovered;

						context.lineWidth = handleStrokeWidth * scale;
						
						// Left bezier
						context.strokeStyle = (isLeftHovered || isHovered) ? keyframeSelectedColor : bezierHandleLineColor;
						context.beginPath(); // Handle line start
						context.moveTo(keyX * scale, keyY * scale);
						context.lineTo(leftOffsetX * scale, leftOffsetY * scale);
						context.stroke();
						context.closePath();
						context.strokeStyle = (isLeftHovered || isHovered) ? keyframeSelectedColor : keyframeColor;
						context.fillStyle = bezierHandleColor;
						context.beginPath(); // Handle dot start
						context.arc(leftOffsetX * scale, leftOffsetY * scale, handleRadius * scale, 0, 2 * Math.PI);
						context.fill();
						context.stroke();
						context.closePath();

						// Right bezier
						context.strokeStyle = (isRightHovered || isHovered) ? keyframeSelectedColor : bezierHandleLineColor;
						context.beginPath(); // Handle line start
						context.moveTo(keyX * scale, keyY * scale);
						context.lineTo(rightOffsetX * scale, rightOffsetY * scale);
						context.stroke();
						context.closePath();
						context.strokeStyle = (isRightHovered || isHovered) ? keyframeSelectedColor : keyframeColor;
						context.fillStyle = bezierHandleColor;
						context.beginPath(); // Handle dot start
						context.arc(rightOffsetX * scale, rightOffsetY * scale, handleRadius * scale, 0, 2 * Math.PI);
						context.fill();
						context.stroke();
						context.closePath();
					}
				}
				
				context.font = `${keyScale}px icomoon`;
				context.fillStyle = color;
				context.textBaseline  = "top"; // Top as if it were images, starting at (0, 0) (left, top)
				context.fillText(icon, txtPosition[0], txtPosition[1]);
			}

			// re-draw keyframes.
			this.clearTimelineCanvas();
			if (isGraph) {
				let keyframes = this.graph_editor_animator[this.graph_editor_channel];
				for (let keyframe of keyframes) {
					drawKeyframe(keyframe, { isGraph: true });
				}
			}
			else {
				let channelHeight = timelineStyle.getPropertyValue("--timeline-channel-height").trim();
				let channelHalfHeight = channelHeight / 2.0;
				let heightAccumulator = 0;

				for (let i = 0; i < this.animators.length; i++) {
					let animator = this.animators[i];
					let channelKeys = Object.keys(animator.channels);
					let animatorY = channelHeight * heightAccumulator - scrollOffsetY;
					heightAccumulator++;

					for (let j = 0; j < channelKeys.length; j++) {
						let channel = channelKeys[j];
						let channelOptions = animator.channels[channel];

						// Stop early if channel should be hidden
						let channelExists = this.channels[channel] != false;
						let isConditionMet = Condition(channelOptions.condition, animator);
						let canShow = (!this.channels.hide_empty || animator[channel].length);
						let isExpanded = animator.expanded && channelExists && canShow
						if (!(isExpanded || isConditionMet)) continue;

						// Get our remaining data
						let channelY = channelHeight * heightAccumulator - scrollOffsetY;
						if (!isExpanded) channelY = animatorY;
						else if (isConditionMet) heightAccumulator++; // Add to total channel height stack if this channel is able to display

						// Stop early if channel is out of frame vertically
						if (channelY < -channelHalfHeight) continue;
						if (channelY > rectHeight - channelHalfHeight) break;

						let keyframes = animator[channel];
						for (let keyframe of keyframes) {
							drawKeyframe(keyframe, { offset: channelY + channelHalfHeight, isCollapsed: !isExpanded });
						}
					}
				}
			}
		},
		tryGetKeyframeClosestToMouse(event) {
			let body = $('#timeline_body').get(0);
			let bodyCanvas = $('#timeline_body_keyframe_canvas').get(0);
			let timelineStyle = window.getComputedStyle(body);
			let keyRadius = timelineStyle.getPropertyValue("--keyframe-radius").trim();
			let keyGraphRadius = timelineStyle.getPropertyValue("--keyframe-graph-radius").trim();
			let channelHeight = timelineStyle.getPropertyValue("--timeline-channel-height").trim();

			// Mouse position
    		let rect = bodyCanvas.getBoundingClientRect();
		    let x = event.pageX - rect.left;
		    let y = event.pageY - rect.top;
			let mouseVec = [x, y];

			// Dom info
			let size = this.size;
			let graphSize = this.graph_size;
			let channelHalfHeight = channelHeight / 2.0;
			let keyHalfRadius = keyRadius / 2.0;
			let keyGraphHalfRadius = keyGraphRadius / 2.0;
			let rectHeight = body.clientHeight;
			let rectWidth = body.clientWidth - this.head_width;
			let scrollOffsetY = body.scrollTop;
			let scrollOffsetX = body.scrollLeft;

			// Find closest keyframe to mouse
			let shortestDist = Infinity;
			let shortestUuid = "";
			let shortestHandle = "";
			if (this.graph_editor_open) {
				if (!this.graph_editor_animator) return;

				let keyframes = this.graph_editor_animator[this.graph_editor_channel];
				for (let keyframe of keyframes) {
					// Key position
					let posX = (keyframe.time * size) + keyGraphHalfRadius - scrollOffsetX;
					let posY = this.graph_offset - (keyframe.display_value * graphSize) - channelHalfHeight - scrollOffsetY;
				
					// Stop early if keyframe is out of frame
					if (this.shouldCullKeyframeOnGraph(keyframe)) continue;

					// Handle positions
					let axis = getAxisNumber(this.graph_editor_axis);
					let leftOffsetX = keyframe[`bezier_left_time`][axis] * size;
					let leftOffsetY = -keyframe[`bezier_left_value`][axis] * graphSize;
					let rightOffsetX = keyframe[`bezier_right_time`][axis] * size;
					let rightOffsetY = -keyframe[`bezier_right_value`][axis] * graphSize;

					if (keyframe.interpolation === "bezier") {
						let leftHandleVec = [leftOffsetX, leftOffsetY].V2_add([posX, posY]);
						let rightHandleVec = [rightOffsetX, rightOffsetY].V2_add([posX, posY]);
						let distanceToLeft = [...mouseVec].V2_subtract(leftHandleVec).V2_toThree().length();
						let distanceToRight = [...mouseVec].V2_subtract(rightHandleVec).V2_toThree().length();

						if (distanceToLeft < shortestDist) {
							shortestDist = distanceToLeft;
							shortestUuid = keyframe.uuid;
							shortestHandle = "left";
						}
						if (distanceToRight < shortestDist) {
							shortestDist = distanceToRight;
							shortestUuid = keyframe.uuid;
							shortestHandle = "right";
						}
					}

					let keyframeVec = [posX, posY].V2_add([keyGraphHalfRadius, keyGraphHalfRadius]);
					let distanceToKey = [...mouseVec].V2_subtract(keyframeVec).V2_toThree().length();
					if (distanceToKey < shortestDist) {
						shortestDist = distanceToKey;
						shortestUuid = keyframe.uuid;
						shortestHandle = "";
					}
				}
			}
			else {
				let heightAccumulator = 0;
				for (let i = 0; i < this.animators.length; i++) {
					let animator = this.animators[i];
					let channelKeys = Object.keys(animator.channels);
					heightAccumulator++;

					for (let j = 0; j < channelKeys.length; j++) {
						let channel = channelKeys[j];
						let channelOptions = animator.channels[channel];

						// Stop early if channel should be hidden
						let isExpanded = animator.expanded;
						let channelExists = this.channels[channel] != false;
						let isConditionMet = Condition(channelOptions.condition, animator);
						let canShow = (!this.channels.hide_empty || animator[channel].length);
						if (!(isExpanded && channelExists && isConditionMet && canShow)) continue; // This channel is not displayed atm, so we can stop.

						// Get our remaining data
						let channelY = channelHeight * heightAccumulator - scrollOffsetY;
						heightAccumulator++;

						// Stop early if channel is out of frame vertically
						if (channelY < -channelHalfHeight) continue;
						if (channelY > rectHeight - channelHalfHeight) break;

						let keyframes = animator[channel];
						for (let keyframe of keyframes) {
							let posX = (keyframe.time * size) - scrollOffsetX;
							let posY = channelY + channelHalfHeight - keyHalfRadius;

							// Stop early if keyframe is out of frame horizontally
							if ((posX < -keyHalfRadius) || (posX > rectWidth - keyHalfRadius)) continue;

							let keyframeVec = [posX, posY].V2_add([keyHalfRadius, keyHalfRadius / 4.0]); // unsure why I divided by 4 here, but it works
							let distance = [...mouseVec].V2_subtract(keyframeVec).V2_toThree().length();
							if (distance < shortestDist) {
								shortestDist = distance;
								shortestUuid = keyframe.uuid;
							}
						}
					}
				}
			}

			// Check if our closest keyframe is within the selection radius before we return it
			let closestKeyframe = Timeline.keyframes.find(keyframe => keyframe.uuid === shortestUuid);
			let trueRadius = this.graph_editor_open ? keyGraphRadius : keyRadius;
			if (shortestDist < trueRadius) {
				if (shortestHandle !== "") {
					return {
						target: closestKeyframe,
						handle: shortestHandle,
						type: "bezier_handle"
					};
				}

				return {
					target: closestKeyframe,
					type: "keyframe"
				};
			}
			
			return { type: "fail" };
			// console.log(`[${[x, y]}], ${shortestDist}, ${shortestUuid}`);
		},
		getKeyframeFromUuid(uuid) {
			if (uuid === "") return false;

			for (let animator of this.animators) {
				for (let channel of Object.keys(animator.channels)) {
					for (let keyframe of animator[channel]) {
						if (keyframe.uuid === uuid) return keyframe;
					}
				}
			}

			return false;
		},
		clickKeyframeOnCanvas(event) {
			let keyframe = this.getKeyframeFromUuid(this.keyframeHoverUuid);
			if (!keyframe) return;
			if (Timeline.selector.selecting) return;
			keyframe.clickSelect(event);
			this.refreshTimelineCanvas();
		},
		callPlayHeadToKeyframeOnCanvas(event) {
			let keyframe = this.getKeyframeFromUuid(this.keyframeHoverUuid);
			if (!keyframe) return;
			keyframe.callPlayhead();
		},
		dragOnCanvas(event) {
			let keyframe = this.getKeyframeFromUuid(this.keyframeHoverUuid);
			if (!keyframe) {
				if (this.bezierHandleHover.keyUuid !== "") {
					keyframe = this.getKeyframeFromUuid(this.bezierHandleHover.keyUuid);
					event.stopPropagation();
					this.dragBezierHandle(keyframe, this.bezierHandleHover.side, event);
				}
				return;
			}
			event.stopPropagation();
			this.dragKeyframes(keyframe, event);
		},
		openKeyframeContextMenuOnCanvas(event) {
			let keyframe = this.getKeyframeFromUuid(this.keyframeHoverUuid);
			if (!keyframe) {
				this.openContextMenu(event);
				return;
			}
			keyframe.showContextMenu(event);
		},
		hoverOnCanvas(event) {
			if (Timeline.selector.selecting) return;
			let result = this.tryGetKeyframeClosestToMouse(event);
			if (!result) return;

			switch (result.type) {
				case "keyframe": {
					if (!result.target) break;
					if (result.target.uuid === this.keyframeHoverUuid) break;

					// Make sure no handle is accidentally hovered
					if (this.bezierHandleHover.keyUuid !== "") {
						this.bezierHandleHover.keyUuid = "";
						this.bezierHandleHover.side = "";
					}

					this.keyframeHoverUuid = result.target.uuid;
					this.refreshTimelineCanvas();
					break;
				}
				case "bezier_handle": {
					if (!result.target) break;
					if (result.target.uuid === this.bezierHandleHover.keyUuid) break;
					
					// Make sure no keyframe is accidentally hovered
					if (this.keyframeHoverUuid !== "") {
						this.keyframeHoverUuid = "";
					}

					this.bezierHandleHover.keyUuid = result.target.uuid;
					this.bezierHandleHover.side = result.handle;
					this.refreshTimelineCanvas();
					break;
					// console.log(`hitting handle on the ${result.handle} of key at ${result.target.time}`)
				}
				case "fail": {
					if (this.keyframeHoverUuid !== "" || this.bezierHandleHover.keyUuid !== "") {
						this.keyframeHoverUuid = "";
						this.bezierHandleHover.keyUuid = "";
						this.bezierHandleHover.side = "";
						this.refreshTimelineCanvas();
					}
					break;
				}
			}
		},
		clearHoveredKeyframe() {
			this.keyframeHoverUuid = "";
			this.refreshTimelineCanvas();
		},
		eventTargetToAnimator(target) {
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
			return [this.animators.find(animator => animator.uuid == target_node.attributes.uuid.value), target_node];
		},
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
		updateGraph() {
			if (this.graph_editor_open) {
				this.graph_size += 1e-7;
			}
		},
		toggleAnimator(animator) {
			animator.expanded = !animator.expanded;
			this.refreshTimelineCanvas();
		},
		removeAnimator(animator) {
			Timeline.animators.remove(animator);

			if (Timeline.animators.length ===0) {
				this.clearTimelineCanvas();
			}
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
		getColor(index, pastel = false) {
			if (index == -1 || index == undefined) return;
			let color = markerColors[index % markerColors.length];
			return pastel ? color.pastel : color.standard;
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
			this.refreshTimelineCanvas();
		},
		openContextMenu(event) {
			if (event.target.nodeName == 'KEYFRAME' || event.target.parentElement.nodeName == 'KEYFRAME') return;
			if (Blockbench.hasFlag('no_context_menu')) return;
			event.preventDefault();
			Timeline.menu.open(event, event);
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
				Timeline.vue.refreshTimelineCanvas();
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
					let [target_animator] = eventTargetToAnimator(target);
					if (!target_animator || target_animator == animator ) return;
					
					let index = Timeline.animators.indexOf(target_animator);
					if (index == -1) return;
					if (order == 1) index++;
					if (Timeline.animators[index] == animator) return;
					Timeline.animators.remove(animator);
					Timeline.animators.splice(index, 0, animator);
					Undo.finishSelection('Rearrange animators in timeline');
					Timeline.vue.refreshTimelineCanvas();
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
			if (e1.target.classList.contains('keyframe_bezier_handle')) return;
			if (e1.button > 0) return;
			convertTouchEvent(e1);
			let dragging_range;
			let dragging_restriction;
			let originalValue;
			let previousValue;
			let time_stretching;
			let values_changed;
			let is_setup = false;
			let old_bezier_values = {};
			let scope = this;

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
					let ba = scope.graph_editor_animator || 0;
					let all_keyframes = ba[scope.graph_editor_channel];
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
				Animator.showMotionTrail(null, true)
				Animator.preview()
				Timeline.vue.refreshTimelineCanvas();

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

					Timeline.vue.refreshTimelineCanvas();
				}
			}
			addEventListeners(document, 'mousemove touchmove', slide, {passive: false});
			addEventListeners(document, 'mouseup touchend', off);
		},
		dragBezierHandle(clicked, side, e1) {
			if (e1.button > 0) return;
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
				Animator.showMotionTrail(null, true)
				Animator.preview()
				Timeline.vue.refreshTimelineCanvas();
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
			if (e1.button > 0) return;
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
				values_changed = false;
				Timeline.dragging_keyframes = true;
				is_setup = true;

				for (let kf of keyframes) {
					original_values[kf.uuid] = kf.display_value || kf.get(axis);
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
					let target_value = (original_values[kf.uuid] - origin) * value + origin;
					kf.offset(axis, -kf.get(axis) + target_value);
					values_changed = true;
				}
				let text = Math.round(value * 100) + '%';
				Blockbench.setStatusBarText(text);
				Animator.showMotionTrail(null, true)
				Animator.preview()
				Timeline.vue.refreshTimelineCanvas();
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
		getNodeColor(node) {
			if (node.color >= 0) {
				return markerColors[node.color % markerColors.length].pastel;
			}
			return '';
		},
		clamp: Math.clamp,
		Condition,
		trimFloatNumber,
		getAxisLetter
	}
}
</script>

<style>
#timeline_body_inner {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: flex-start;
    align-items: flex-start;
}

#timeline_body_channel_headers {
	display: flex;
	flex-direction: column;
    position: sticky;
    left: 0px;
    z-index: 4;
    min-height: stretch;
}

#timeline_body_keyframe_canvas {
    position: sticky;
	top: 0;
    z-index: 2;
}

#timeline_body_keyframe_backdrop {
    position: sticky;
	top: 0;
    z-index: 0;
	width: stretch;
	height: stretch;
}

.keyframe.graph_keyframe > svg {
	margin: none;
	pointer-events: inherit;
}

.animator_channel_bar {
	overflow: clip;
}
</style>