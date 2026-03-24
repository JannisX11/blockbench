import { Blockbench } from "../api";
import { FormElementOptions } from "../interface/form";
import { flipNameOnAxis } from "../modeling/transform";
import { Animation } from "./animation";
import { Keyframe } from "./keyframe";
import { BoneAnimator } from "./timeline_animators";

type TKeyframe = _Keyframe;
interface FlipCopyKeyframesOptions {
	keyframes: TKeyframe[]
	animators?: BoneAnimator[]
	clear_opposite?: boolean
	offset: number
	show_in_timeline?: boolean
}
function flipCopyKeyframes(options: FlipCopyKeyframesOptions):
	{added_keyframes: TKeyframe[], removed_keyframes: TKeyframe[]}
{
	let added_keyframes: TKeyframe[] = [];
	let removed_keyframes: TKeyframe[] = [];
	let animators = [];
	let original_keyframes = options.keyframes.slice();
	original_keyframes.forEach(kf => animators.safePush(kf.animator));
	if (options.animators) {
		options.animators.forEach(ba => animators.safePush(ba));
	}
	let channels = ['rotation', 'position', 'scale'];
	let all_animatable_nodes: any[] = [
		...Group.all,
		...Outliner.elements.filter(el => (el.constructor as typeof OutlinerElement).animator)
	];
	let animation = Animation.selected;

	animators.forEach(animator => {
		let opposite_animator: BoneAnimator;
		channels.forEach(channel => {
			if (!animator[channel]) return;
			let kfs: TKeyframe[];
			if (options.clear_opposite) {
				kfs = animator[channel].slice();;
			} else {
				kfs = original_keyframes.filter(kf => kf.channel == channel && kf.animator == animator);
			}
			if (!kfs.length) return;
			let order: 0|1 = 0;;
			if (!opposite_animator) {
				let name = flipNameOnAxis(
					{name: animator.name},
					0,
					(name: string, _order: 0|1) => {order = _order; return true;},
					animator.name
				);
				let opposite_bone = all_animatable_nodes.find(g => g.name == name);
				if (!opposite_bone) {
					console.log(`Animation Flipping: Unable to find opposite bone for ${animator.name}`)
					return;
				}
				opposite_animator = animation.getBoneAnimator(opposite_bone);
			}
			if (opposite_animator == animator) return;

			if (options.clear_opposite) {
				for (let kf of opposite_animator[channel].slice() as TKeyframe[]) {
					removed_keyframes.push(kf);
					kf.remove();
				}
			}

			let offset_factor = (4 + (options.offset/360) * (order ? 1 : -1)) % 1;
			let offset_time = offset_factor * animation.length;

			let temp_wrap_keyframe: TKeyframe | undefined;
			if (offset_time && !kfs.find(kf => Math.epsilon(kf.time, offset_time, 0.005)) && !Format.animation_loop_wrapping) {
				temp_wrap_keyframe = animator.createKeyframe(null, animation.length-offset_time, channel, false, false);
				kfs.push(temp_wrap_keyframe);
			}
			kfs.sort((a, b) => a.time - b.time);
			let occupied_times = [];
			kfs.forEach(old_kf => {
				let time = old_kf.time;
				if (offset_time) {
					time = (time + offset_time) % (animation.length + 0.001);
				}
				if (old_kf == temp_wrap_keyframe) {
					time = animation.length;
				}
				time = Timeline.snapTime(time);
				if (Math.epsilon(time, animation.length, 0.004) && offset_time && !occupied_times.includes(0)) {
					// Copy keyframe to start
					occupied_times.push(0);
					let new_kf = opposite_animator.createKeyframe(old_kf, 0, channel, false, false)
					if (new_kf) {
						new_kf.flip(0);
						added_keyframes.push(new_kf);
					}
				}
				if (occupied_times.includes(time)) return;
				occupied_times.push(time);
				let new_kf = opposite_animator.createKeyframe(old_kf, time, channel, false, false)
				if (new_kf) {
					new_kf.flip(0);
					added_keyframes.push(new_kf);
				}
			})
			if (offset_time && !occupied_times.includes(0) && temp_wrap_keyframe) {
				let new_kf = opposite_animator.createKeyframe(added_keyframes.last(), 0, channel, false, false)
				if (new_kf) {
					added_keyframes.push(new_kf);
				}
			}
			if (temp_wrap_keyframe) {
				temp_wrap_keyframe.remove();
			}
		})
		if (options.show_in_timeline && opposite_animator) {
			opposite_animator.addToTimeline();
		}
	})
	return {
		added_keyframes,
		removed_keyframes
	}
}

let initial_keyframes: TKeyframe[] | undefined;
Blockbench.on('init_edit', (args) => {
	initial_keyframes = undefined;
	let toggle = BarItems.mirror_animating as Toggle;
	if (!toggle.value) return;

	if (args.aspects.keyframes instanceof Array)  {
		initial_keyframes = args.aspects.keyframes.slice();
	}
})
Blockbench.on('finish_edit', (args) => {
	let toggle = BarItems.mirror_animating as Toggle;
	if (!toggle.value) return;

	if (!args.aspects.keyframes?.length && !initial_keyframes?.length) return;

	let animators: BoneAnimator[] = [];
	if (initial_keyframes?.length) {
		initial_keyframes.forEach(kf => animators.safePush(kf.animator));
	}
	let options = toggle.tool_config.options;
	let offset = options.offset == '180' ? 180 : 0;
	if (options.offset == 'custom') offset = options.custom_offset as number;
	let {added_keyframes, removed_keyframes} = flipCopyKeyframes({
		keyframes: args.aspects.keyframes,
		animators,
		clear_opposite: true,
		offset,
		show_in_timeline: false,
	});
	if (removed_keyframes.length) {
		Undo.addKeyframeCasualties(removed_keyframes as _Keyframe[]);
	}
	let original_keyframes = args.aspects.keyframes.filter(kf => !removed_keyframes.includes(kf));
	args.aspects.keyframes = [
		...original_keyframes,
		...added_keyframes
	]

})

BARS.defineActions(function() {
	const COMMON_FORM_ELEMENTS = {
		offset: {
			label: 'dialog.flip_animation.phase_offset',
			type: 'inline_select',
			value: '180',
			options: {
				'0': 'dialog.flip_animation.phase_offset.off',
				'180': '180°',
				'custom': 'dialog.flip_animation.phase_offset.custom',
			}
		} as FormElementOptions,
		custom_offset: {
			type: 'range',
			editable_range_label: true,
			full_width: true,
			step: 5,
			min: -180,
			max: 180,
			value: 0,
			condition: (form) => form.offset == 'custom',
		} as FormElementOptions,
	}

	let icon = Blockbench.getIconNode('vertical_align_center');
	icon.style.transform = 'rotate(90deg)';
	let toggle = new Toggle('mirror_animating', {
		// @ts-ignore
		icon,
		category: 'animation',
		condition: {modes: ['animate']},
		onChange() {
			Project.mirror_animating_enabled = this.value;
			toggle.tool_config.options.enabled = this.value;
			updateSelection();
		},
		tool_config: new ToolConfig('mirror_animating_options', {
			title: 'action.mirror_animating',
			form: {
				enabled: {type: 'checkbox', label: 'menu.mirror_painting.enabled', value: false},
				...COMMON_FORM_ELEMENTS
			},
			onFormChange(formResult) {
				if (toggle.value != formResult.enabled) {
					toggle.trigger();
				}
			}
		})
	})


	new Action('flip_animation', {
		icon: 'transfer_within_a_station',
		category: 'animation',
		condition: {modes: ['animate'], method: () => Animation.selected},
		click() {

			if (!Animation.selected) {
				Blockbench.showQuickMessage('message.no_animation_selected')
				return;
			}
			if (!Timeline.keyframes.length) return;

			new Dialog({
				id: 'flip_animation',
				title: 'action.flip_animation',
				form: {
					info: {type: 'info', text: 'dialog.flip_animation.info'},
					...COMMON_FORM_ELEMENTS,
					clear_opposite: {label: 'dialog.flip_animation.clear_opposite', type: 'checkbox', value: false},
					show_in_timeline: {label: 'dialog.flip_animation.show_in_timeline', type: 'checkbox', value: true},
				},
				onConfirm(options: {offset: string, custom_offset: number, show_in_timeline: boolean, clear_opposite: boolean}) {
					this.hide()
					
					let new_keyframes = [];
					Undo.initEdit({keyframes: new_keyframes});
					let original_keyframes = Timeline.selected.length ? Timeline.selected : Timeline.keyframes;

					let offset = options.offset == '180' ? 180 : 0;
					if (options.offset == 'custom') offset = options.custom_offset;
					let {added_keyframes, removed_keyframes} = flipCopyKeyframes({
						keyframes: original_keyframes,
						clear_opposite: options.clear_opposite,
						show_in_timeline: options.show_in_timeline,
						offset
					});
					if (removed_keyframes.length) {
						Undo.addKeyframeCasualties(removed_keyframes as _Keyframe[]);
					}
					new_keyframes.replace(added_keyframes);

					updateKeyframeSelection();
					Animator.preview();

					Undo.finishEdit('Copy and flip keyframes');
				}
			}).show()
		}
	})
});