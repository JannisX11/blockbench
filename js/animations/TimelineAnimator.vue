<template>
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
</template>

<script lang="js">

</script>