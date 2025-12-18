<template>
	<div>
		<div class="toolbar_wrapper display"></div>
		<p class="panel_toolbar_label">{{ tl('display.slot') }}</p>
		<div id="display_bar" class="bar tabs_small icon_bar">
			<input class="hidden" type="radio" name="display" id="thirdperson_righthand" checked>
			<label class="tool" for="thirdperson_righthand" onclick="DisplayMode.loadThirdRight()"><div class="tooltip">{{ tl('display.slot.third_right') }}</div><i class="material-icons">accessibility</i></label>
			<input class="hidden" type="radio" name="display" id="thirdperson_lefthand">
			<label class="tool" for="thirdperson_lefthand" onclick="DisplayMode.loadThirdLeft()"><div class="tooltip">{{ tl('display.slot.third_left') }}</div><i class="material-icons">accessibility</i></label>

			<input class="hidden" type="radio" name="display" id="firstperson_righthand">
			<label class="tool" for="firstperson_righthand" onclick="DisplayMode.loadFirstRight()"><div class="tooltip">{{ tl('display.slot.first_right') }}</div><i class="material-icons">person</i></label>
			<input class="hidden" type="radio" name="display" id="firstperson_lefthand">
			<label class="tool" for="firstperson_lefthand" onclick="DisplayMode.loadFirstLeft()"><div class="tooltip">{{ tl('display.slot.first_left') }}</div><i class="material-icons">person</i></label>

			<input class="hidden" type="radio" name="display" id="head">
			<label class="tool" for="head" onclick="DisplayMode.loadHead()"><div class="tooltip">{{ tl('display.slot.head') }}</div><i class="material-icons">sentiment_satisfied</i></label>

			<input class="hidden" type="radio" name="display" id="ground">
			<label class="tool" for="ground" onclick="DisplayMode.loadGround()"><div class="tooltip">{{ tl('display.slot.ground') }}</div><i class="icon-ground"></i></label>

			<input class="hidden" type="radio" name="display" id="fixed">
			<label class="tool" for="fixed" onclick="DisplayMode.loadFixed()"><div class="tooltip">{{ tl('display.slot.frame') }}</div><i class="material-icons">filter_frames</i></label>
			
			<template v-if="!isBedrockStyle()">
				<input class="hidden" type="radio" name="display" id="on_shelf">
				<label class="tool" for="on_shelf" onclick="DisplayMode.loadShelf()"><div class="tooltip">{{ tl('display.slot.on_shelf') }}</div><i class="material-icons">table_view</i></label>
			</template>

			<input class="hidden" type="radio" name="display" id="gui">
			<label class="tool" for="gui" onclick="DisplayMode.loadGUI()"><div class="tooltip">{{ tl('display.slot.gui') }}</div><i class="material-icons">border_style</i></label>
		</div>
		<p class="panel_toolbar_label">{{ tl('display.reference') }}</p>
		<div id="display_ref_bar" class="bar tabs_small icon_bar">
		</div>

		<div id="display_sliders">
			
			<div class="bar display_slot_section_bar">
				<p class="panel_toolbar_label">{{ tl('display.rotation') }}</p>
				<div class="tool head_right" v-on:click="resetChannel('rotation')"><i class="material-icons">replay</i></div>
			</div>
			<div class="bar slider_input_combo" v-for="axis in axes" :key="'rotation.'+axis" :title="getAxisLetter(axis).toUpperCase()">
				<input type="range" :style="{'--color-thumb': `var(--color-axis-${getAxisLetter(axis)})`}" class="tool disp_range" v-model.number="slot.rotation[axis]" v-bind:trigger_type="'rotation.'+axis"
					min="-180" max="180" step="1" value="0"
					@input="change(axis, 'rotation')" @mousedown="start()" @change="save">
				<numeric-input class="tool disp_text" v-model.number="slot.rotation[axis]" :min="-180" :max="180" :step="0.5" @input="change(axis, 'rotation')" @change="focusout(axis, 'rotation');save()" @mousedown="start()" />
			</div>
			
			<div class="bar display_slot_section_bar">
				<p class="panel_toolbar_label">{{ tl('display.translation') }}</p>
				<div class="tool head_right" v-on:click="resetChannel('translation')"><i class="material-icons">replay</i></div>
				</div>
			<div class="bar slider_input_combo" v-for="axis in axes" :key="'translation.'+axis" :title="getAxisLetter(axis).toUpperCase()">
				<input type="range" :style="{'--color-thumb': `var(--color-axis-${getAxisLetter(axis)})`}" class="tool disp_range" v-model.number="slot.translation[axis]" v-bind:trigger_type="'translation.'+axis"
					v-bind:min="Math.abs(slot.translation[axis]) < 10 ? -20 : (slot.translation[axis] > 0 ? -70*3+10 : -80)"
					v-bind:max="Math.abs(slot.translation[axis]) < 10 ?  20 : (slot.translation[axis] < 0 ? 70*3-10 : 80)"
					v-bind:step="Math.abs(slot.translation[axis]) < 10 ? 0.25 : 1"
					value="0" @input="change(axis, 'translation')" @mousedown="start()" @change="save">
				<numeric-input class="tool disp_text" v-model.number="slot.translation[axis]" :min="-80" :max="80" :step="0.5" @input="change(axis, 'translation');" @change="focusout(axis, 'translation');save()" @mousedown="start()" />
			</div>

			<div class="bar display_slot_section_bar">
				<p class="panel_toolbar_label">{{ tl('display.scale') }}</p>
				<div class="tool head_right" @click="showMirroringSetting()" v-if="allowEnablingMirroring()"><i class="material-icons">flip</i></div>
				<div class="tool head_right" @click="resetChannel('scale')"><i class="material-icons">replay</i></div>
			</div>
			<div class="bar slider_input_combo" v-for="axis in axes" :key="'mirror.'+axis" :title="getAxisLetter(axis).toUpperCase()">
				<div class="tool display_scale_invert" v-on:click="invert(axis)" v-if="allowMirroring()">
					<div class="tooltip">{{ tl('display.mirror') }}</div>
					<i class="material-icons">{{ slot.mirror[axis] ? 'check_box' : 'check_box_outline_blank' }}</i>
				</div>
				<input type="range" :style="{'--color-thumb': `var(--color-axis-${getAxisLetter(axis)})`}" class="tool disp_range scaleRange" v-model.number="slot.scale[axis]" v-bind:trigger_type="'scale.'+axis" v-bind:id="'scale_range_'+axis"
					v-bind:min="slot.scale[axis] > 1 ? -2 : 0"
					v-bind:max="slot.scale[axis] > 1 ? 4 : 2"
					step="0.01"
					value="0" @input="change(axis, 'scale')" @mousedown="start(axis, 'scale')" @change="save(axis, 'scale')">
				<numeric-input class="tool disp_text" v-model.number="slot.scale[axis]" :min="0" :max="4" :step="0.01" @input="change(axis, 'scale')" @change="focusout(axis, 'scale');save()" @mousedown="start()" />
			</div>
			<div class="bar" v-if="isBedrockStyle() && slot.slot_id == 'gui'" @click="toggleFitToFrame()">
				<input type="checkbox" :checked="slot.fit_to_frame == true">
				<label style="padding-top: 3px;">Fit to Frame</label>
			</div>
			
			<template v-if="reference_model == 'player'">
				<div class="bar display_slot_section_bar">
					<p class="panel_toolbar_label">{{ tl('display.pose_angle') }}</p>
				</div>
				<div class="bar slider_input_combo">
					<input type="range" class="tool disp_range" v-model.number="pose_angle"
						min="-180" max="180" step="1" >
					<numeric-input class="tool disp_text" v-model.number="pose_angle" :min="-180" :max="180" :step="0.5" />
				</div>
			</template>
			
			<template v-if="isBedrockStyle()">
				<div class="bar display_slot_section_bar">
					<p class="panel_toolbar_label">{{ tl('display.rotation_pivot') }}</p>
					<div class="tool head_right" v-on:click="resetChannel('rotation_pivot')"><i class="material-icons">replay</i></div>
				</div>
				<div class="bar display_inline_inputs">
					<numeric-input class="tool disp_text is_colored"
						:style="{'--corner-color': 'var(--color-axis-'+getAxisLetter(axis) + ')'}"
						v-for="axis in axes" :key="'rotation_pivot.'+axis" :title="getAxisLetter(axis).toUpperCase()"
						v-model.number="slot.rotation_pivot[axis]"
						:min="-10" :max="10" :step="0.05"
						@input="change(axis, 'rotation_pivot')"
						@change="focusout(axis, 'rotation_pivot');save()"
						@mousedown="start()"
					/>
				</div>

				<div class="bar display_slot_section_bar">
					<p class="panel_toolbar_label">{{ tl('display.scale_pivot') }}</p>
					<div class="tool head_right" v-on:click="resetChannel('scale_pivot')"><i class="material-icons">replay</i></div>
				</div>
				<div class="bar display_inline_inputs">
					<numeric-input class="tool disp_text is_colored"
						:style="{'--corner-color': 'var(--color-axis-'+getAxisLetter(axis) + ')'}"
						v-for="axis in axes" :key="'scale_pivot.'+axis" :title="getAxisLetter(axis).toUpperCase()"
						v-model.number="slot.scale_pivot[axis]"
						:min="-10" :max="10" :step="0.05"
						@input="change(axis, 'scale_pivot')"
						@change="focusout(axis, 'scale_pivot');save()"
						@mousedown="start()"
					/>
				</div>
			</template>
		</div>
	</div>
</template>

<script lang="js">
import { DisplayMode, displayReferenceObjects } from './display_mode';
import { tl } from '../languages';

export default {
	data() {return {
		axes: [0, 1, 2],
		reference_model: 'player',
		pose_angle: 0,
		slot: new DisplaySlot(''),
		allow_mirroring: Settings.get('allow_display_slot_mirror')
	}},
	watch: {
		pose_angle(value) {
			displayReferenceObjects.active.pose_angles[DisplayMode.display_slot] = value;
			if (displayReferenceObjects.active.updateBasePosition) displayReferenceObjects.active.updateBasePosition();
		}
	},
	methods: {
		tl,
		allowMirroring() {
			return this.allow_mirroring && !this.isBedrockStyle();
		},
		allowEnablingMirroring() {
			return Format.id != 'bedrock_block';
		},
		isBedrockStyle() {
			return Format.id == 'bedrock_block';
		},
		isMirrored: (axis) => {
			if (Project.display_settings[DisplayMode.display_slot]) {
				return Project.display_settings[DisplayMode.display_slot].scale[axis] < 0;
			}
		},
		change: (axis, channel) => {
			if (channel === 'scale') {
				if (Pressing.shift || Pressing.overrides.shift) {
					var val = limitNumber(parseFloat(DisplayMode.slot.scale[axis]), 0, 4)
					DisplayMode.slot.scale[0] = val;
					DisplayMode.slot.scale[1] = val;
					DisplayMode.slot.scale[2] = val;
				}
			}
			DisplayMode.updateDisplayBase()
		},
		focusout: (axis, channel) => {
			if (channel === 'scale') {
				var val = limitNumber(DisplayMode.slot.scale[axis], 0, 4)
				DisplayMode.slot.scale[axis] = val;
				if (Pressing.shift || Pressing.overrides.shift) {
					DisplayMode.slot.scale[0] = val;
					DisplayMode.slot.scale[1] = val;
					DisplayMode.slot.scale[2] = val;
				}
			} else if (channel === 'translation') {
				DisplayMode.slot.translation[axis] = limitNumber(DisplayMode.slot.translation[axis], -80, 80)||0;
			} else if (channel == 'rotation') {
				DisplayMode.slot.rotation[axis] = Math.trimDeg(DisplayMode.slot.rotation[axis])||0;
			} else {
				DisplayMode.slot[channel][axis] = DisplayMode.slot[channel][axis] ?? 0;
			}
			DisplayMode.updateDisplayBase()
		},
		resetChannel: (channel) => {
			var v = channel === 'scale' ? 1 : 0;
			Undo.initEdit({display_slots: [DisplayMode.display_slot]})
			DisplayMode.slot.extend({[channel]: [v, v, v]})
			if (channel === 'scale') {
			DisplayMode.slot.extend({mirror: [false, false, false]})
			}
			Undo.finishEdit('Reset display channel')
		},
		invert: (axis) => {
			Undo.initEdit({display_slots: [DisplayMode.display_slot]})
			DisplayMode.slot.mirror[axis] = !DisplayMode.slot.mirror[axis];
			DisplayMode.slot.update()
			Undo.finishEdit('Mirror display setting')
		},
		start: () => {
			Undo.initEdit({display_slots: [DisplayMode.display_slot]});
			Interface.addSuggestedModifierKey('shift', 'modifier_actions.uniform_scaling');
		},
		save: () => {
			Undo.finishEdit('Change display setting');
			Interface.removeSuggestedModifierKey('shift', 'modifier_actions.uniform_scaling');
		},
		toggleFitToFrame() {
			Undo.initEdit({display_slots: [DisplayMode.display_slot]});
			this.slot.fit_to_frame = !this.slot.fit_to_frame;
			Undo.finishEdit('Change display setting fit-to-frame property');
			Interface.removeSuggestedModifierKey('shift', 'modifier_actions.uniform_scaling');
		},
		showMirroringSetting() {
			Settings.openDialog({search_term: tl('settings.allow_display_slot_mirror')});
		},
		getAxisLetter
	},
}
</script>