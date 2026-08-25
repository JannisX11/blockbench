<template>
	<div id="timeline_vue" :class="{graph_editor: graph_editor_open}" :style="{'--timeline-height': timeline_height + 'px'}">
		<div id="timeline_header">
			<div id="timeline_corner" v-bind:style="{width: head_width+'px'}">
				<div id="timeline_timestamp">{{ timestamp }}</div>
				<span>/</span>
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
						class="timeline_marker tool"
						:style="{left: (marker.time * size) + 'px', '--color': getColor(marker.color)}"
						:uuid="marker.uuid"
						@contextmenu.prevent="marker.showContextMenu($event)"
						@dblclick.prevent="marker.propertiesDialog()"
						v-on:click="marker.callPlayhead()"
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
			<div id="timeline_body_inner" v-bind:style="{width: (size*length + head_width)+'px'}" @contextmenu.stop="openContextMenu($event)">
				<li v-for="animator in animators" class="animator" :class="{selected: animator.selected, boneless: animator.displayPosition && !animator.node}" :uuid="animator.uuid" v-on:click="animator.clickSelect();">
					<div class="animator_head_bar">
						<div class="channel_head" v-bind:style="{left: '0px', width: head_width+'px'}" v-on:dblclick.stop="toggleAnimator(animator)" @contextmenu.stop="animator.showContextMenu($event)">
							<div class="text_button" v-on:click.stop="toggleAnimator(animator)">
								<i class="icon-open-state fa" v-bind:class="{'fa-angle-right': !animator.expanded, 'fa-angle-down': animator.expanded}"></i>
							</div>
							<dynamic-icon v-if="animator.node" :icon="animator.node.icon.replace('fa ', '').replace(/ /g, '.')" :color="getNodeColor(animator.node)" />
							<dynamic-icon v-else-if="animator.particle" :icon="'wand_shine'" />
							<dynamic-icon v-else :icon="'help'" style="color: var(--color-error)" />
							<span class="timeline_animator_name" v-on:click.stop="animator.clickSelect();" @mousedown="dragAnimator(animator, $event)" @touchstart="dragAnimator(animator, $event)">
								{{animator.name}}
							</span>
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
						v-bind:style="graph_editor_open ? {} : {width: (size*length + head_width)+'px'}"
						v-for="(channel_options, channel) in animator.channels"
						v-if="animator.expanded && channels[channel] != false && Condition(channel_options.condition, animator) && (!channels.hide_empty || animator[channel].length)"
					>
						<div class="channel_head"
							:class="{selected: graph_editor_open && animator.selected && graph_editor_channel == channel}"
							v-bind:style="{left: '0px', width: head_width+'px'}"
							@click.stop="selectChannel(animator, channel);"
							@contextmenu.stop="animator.showContextMenu($event)"
						>
							<div class="text_button" v-if="channel_options.mutable" v-on:click.stop="animator.toggleMuted(channel)">
								<i class="icon material-icons channel_mute" :class="{disabled: animator.muted[channel]}">
									{{ channel === 'sound' ? (animator.muted[channel] ? 'volume_off' : 'volume_up') : (animator.muted[channel] ? 'visibility_off' : 'visibility') }}
								</i>
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
								:title="animator.channels[channel].name"
								@mousedown="dragKeyframes(keyframe, $event)" @touchstart="dragKeyframes(keyframe, $event)"
								@contextmenu.prevent.stop="keyframe.showContextMenu($event)"
							>
								<i class="icon-keyframe_smooth" v-if="keyframe.interpolation == 'catmullrom'"></i>
								<i class="icon-keyframe_step" v-else-if="keyframe.interpolation == 'step'"></i>
								<i :class="keyframe.data_points.length == 1 ? 'icon-keyframe_bezier' : 'icon-keyframe_discontinuous_bezier'" v-else-if="keyframe.interpolation == 'bezier'"></i>
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
							<i class="icon-keyframe_smooth" v-if="keyframe.interpolation == 'catmullrom'"></i>
							<i class="icon-keyframe_step" v-else-if="keyframe.interpolation == 'step'"></i>
							<!--i :class="keyframe.data_points.length == 1 ? 'icon-keyframe_bezier' : 'icon-keyframe_discontinuous_bezier'" v-else-if="keyframe.interpolation == 'bezier'"></i (looks better without hourglass in graph editor) -->
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
</template>

<script>
</script>