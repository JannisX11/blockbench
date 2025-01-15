const Validator = {
	checks: [],

	warnings: [],
	errors: [],
	_timeout: null,
	accumulated_triggers: [],
	wildcard_trigger: false,
	validate(trigger) {
		if (trigger) {
			this.accumulated_triggers.safePush(trigger);
		} else {
			this.wildcard_trigger = true;
		}
		if (this._timeout) {
			clearTimeout(this._timeout);
			this._timeout = null;
		}
		if (!Project) return;

		this._timeout = setTimeout(() => {
			this._timeout = null;
			Validator.warnings.empty();
			Validator.errors.empty();

			Validator.checks.forEach(check => {
				try {
					if (!Condition(check.condition)) return;

					if (this.wildcard_trigger || check.update_triggers.includes(trigger) || this.accumulated_triggers.find(t => check.update_triggers.includes(t))) {
						check.update();
					}
					Validator.warnings.push(...check.warnings);
					Validator.errors.push(...check.errors);

				} catch (error) {
					console.error(error);
				}
			})
			this.accumulated_triggers.empty();
			this.wildcard_trigger = false;
		}, 40)
	},
	openDialog() {
		if (!Validator.dialog) {
			Validator.dialog = new Dialog({
				id: 'validator',
				title: 'action.validator_window',
				singleButton: true,
				width: 800,
				component: {
					data() {return {
						warnings: Validator.warnings,
						errors: Validator.errors,
					}},
					computed: {
						problems() {
							this.errors.forEach(error => error.error = true);
							return [...this.errors, ...this.warnings]
						}
					},
					methods: {
						getIconNode: Blockbench.getIconNode,
						pureMarked
					},
					template: `
						<template>
							<ul>
								<li v-for="problem in problems" class="validator_dialog_problem" :class="problem.error ? 'validator_error' : 'validator_warning'" :key="problem.message">
									<i class="material-icons">{{ problem.error ? 'error' : 'warning' }}</i>
									<span class="markdown" v-html="pureMarked(problem.message.replace(/\\n/g, '\\n\\n'))"></span>
									<template v-if="problem.buttons">
										<div v-for="button in problem.buttons" class="tool" :title="button.name" @click="button.click($event)">
											<div class="icon_wrapper plugin_icon normal" v-html="getIconNode(button.icon, button.color).outerHTML"></div>
										</div>
									</div>
								</li>
							</ul>
						</template>
					`
				}
			});
		}
		Validator.dialog.show();
	},
	triggers: [],
	updateCashedTriggers() {
		Validator.triggers.empty();
		Validator.checks.forEach(check => {
			Validator.triggers.safePush(...check.update_triggers);
		})
	}
};


class ValidatorCheck {
	constructor(id, options) {
		this.id = id;

		this.type = options.type;
		this.update_triggers = options.update_triggers
			? (options.update_triggers instanceof Array ? options.update_triggers : [options.update_triggers])
			: [];
		this.condition = options.condition;
		this.run = options.run;
		this.errors = [];
		this.warnings = [];
		this._timeout = null;
		this.plugin = options.plugin || (typeof Plugins != 'undefined' ? Plugins.currently_loading : '');

		Validator.checks.push(this);
		Validator.updateCashedTriggers();
	}
	delete() {
		Validator.checks.remove(this);
		Validator.updateCashedTriggers();
	}
	update() {
		this.errors.empty();
		this.warnings.empty();
		try {
			this.run();
			if (this.errors.length > 100) this.errors.splice(100);
			if (this.warnings.length > 100) this.warnings.splice(100);

		} catch (error) {
			console.error(error);
		}
	}
	validate() {
		if (this._timeout) {
			clearTimeout(this._timeout);
			this._timeout = null;
		}

		this._timeout = setTimeout(() => {
			this._timeout = null;

			this.update();

			Validator.warnings.empty();
			Validator.errors.empty();

			Validator.checks.forEach(check => {
				Validator.warnings.push(...check.warnings);
				Validator.errors.push(...check.errors);
			})
		}, 40)
	}
	warn(...warnings) {
		this.warnings.push(...warnings);
	}
	fail(...errors) {
		this.errors.push(...errors);
	}
}


BARS.defineActions(function() {
	new Action('validator_window', {
		icon: 'checklist',
		category: 'file',
		condition: () => Project,
		click() {
			Validator.openDialog();
		}
	})
})

new ValidatorCheck('cube_size_limit', {
	condition: () => Format.cube_size_limiter && settings.deactivate_size_limit.value,
	update_triggers: ['update_selection'],
	run() {
		Cube.all.forEach(cube => {
			if (Format.cube_size_limiter.test(cube)) {
				this.warn({
					message: `The cube "${cube.name}" is outside the allowed size restrictions. It may not work correctly on the target platform.`,
					buttons: [
						{
							name: 'Select Cube',
							icon: 'fa-cube',
							click() {
								Validator.dialog.hide();
								cube.select();
							}
						}
					]
				})
			}
		})
	}
})

new ValidatorCheck('box_uv', {
	condition: () => Cube.all.find(cube => cube.box_uv),
	update_triggers: ['update_selection'],
	run() {
		Cube.all.forEach(cube => {
			if (!cube.box_uv) return;
			let size = cube.size();
			let invalid_size_axes = size.filter((value, axis) => value < 0.999 && (value+cube.inflate*2) * cube.stretch[axis] > 0.005);
			if (invalid_size_axes.length) {
				let buttons = [
					{
						name: 'Select Cube',
						icon: 'fa-cube',
						click() {
							Validator.dialog.hide();
							cube.select();
						}
					}
				];
				if (Format.optional_box_uv) {
					buttons.push({
						name: 'Switch to Per-face UV',
						icon: 'toggle_on',
						click() {
							Validator.dialog.hide();
							
							Undo.initEdit({elements: [cube], uv_only: true});
							cube.setUVMode(false);
							Undo.finishEdit('Change UV mode')
							updateSelection();
						}
					})
				}
				this.warn({
					message: `The cube "${cube.name}" has ${invalid_size_axes.length*2} faces that are smaller than one unit along an axis, which may render incorrectly in Box UV. Increase the size of the cube to at least 1 or switch to Per-face UV and resize the UV to fix this.`,
					buttons
				})
			}
		})
	}
})

new ValidatorCheck('texture_names', {
	condition: {formats: ['java_block']},
	update_triggers: ['add_texture', 'change_texture_path'],
	run() {
		Texture.all.forEach(texture => {
			let used_path = texture.folder ? (texture.folder + '/' + texture.name) : texture.name;
			let characters = used_path.replace(/^#/, '').match(/[^a-z0-9._/\\-]/)
			if (characters) {
				this.warn({
					message: `Texture "${used_path}" contains the following invalid characters: "${characters.join('')}". Valid characters are: a-z0-9._/\\-. Uppercase letters and spaces are invalid.`,
					buttons: [
						{
							name: 'Select Texture',
							icon: 'mouse',
							click() {
								Validator.dialog.hide();
								texture.select();
							}
						}
					]
				})
			}
		})
	}
})

new ValidatorCheck('catmullrom_keyframes', {
	condition: {features: ['animation_files']},
	update_triggers: ['update_keyframe_selection'],
	run() {
		function getButtons(kf) {
			return [{
				name: 'Reveal Keyframe',
				icon: 'icon-keyframe',
				click() {
					Dialog.open.close();
					kf.showInTimeline();
				}
			}]
		}
		Animation.all.forEach(animation => {
			for (let key in animation.animators) {
				let animator = animation.animators[key];
				if (animator instanceof BoneAnimator) {
					for (let channel in animator.channels) {
						if (!animator[channel] || !animator[channel].find(kf => kf.interpolation == 'catmullrom')) continue;

						let keyframes = animator[channel].slice().sort((a, b) => a.time - b.time);
						keyframes.forEach((kf, i) => {
							if (kf.interpolation == 'catmullrom') {
								if (kf.data_points.find(dp => isNaN(dp.x) || isNaN(dp.y) || isNaN(dp.z))) {
									this.fail({
										message: `${animator.channels[channel].name} keyframe at ${kf.time.toFixed(2)} on "${animator.name}" in "${animation.name}" contains non-numeric values. Smooth keyframes cannot contain math expressions.`,
										buttons: getButtons(kf)
									})

								}
								if ((!keyframes[i-1] || keyframes[i-1].interpolation != 'catmullrom') && (!keyframes[i+1] || keyframes[i+1].interpolation != 'catmullrom')) {
									this.warn({
										message: `${animator.channels[channel].name} keyframe at ${kf.time.toFixed(2)} on "${animator.name}" in "${animation.name}" is not surrounded by smooth keyframes. Multiple smooth keyframes are required to create a smooth spline.`,
										buttons: getButtons(kf)
									})

								} else if (!keyframes[i+1] && animation.length && (kf.time+0.01) < animation.length && kf.data_points.find(dp => parseFloat(dp.x) || parseFloat(dp.y) || parseFloat(dp.z))) {
									this.warn({
										message: `${animator.channels[channel].name} keyframe at ${kf.time.toFixed(2)} on "${animator.name}" in "${animation.name}" is the last smooth keyframe, but does not line up with the end of the animation. The last keyframe should either be linear, or line up with the animation end.`,
										buttons: getButtons(kf)
									})

								} else if (!keyframes[i+1] && animation.loop === 'hold' && kf.data_points.find(dp => parseFloat(dp.x) || parseFloat(dp.y) || parseFloat(dp.z))) {
									this.warn({
										message: `${animator.channels[channel].name} keyframe on "${animator.name}" in "${animation.name}" is the last keyframe, and is smooth. The last keyframe per channel on "hold on last frame" animations should generally be set to linear, since splines cannot hold their value past the last keyframe.`,
										buttons: getButtons(kf)
									})

								}
							} else if (keyframes[i+1] && keyframes[i+1].interpolation == 'catmullrom' && kf.data_points.find(dp => isNaN(dp.x) || isNaN(dp.y) || isNaN(dp.z))) {
								this.fail({
									message: `${animator.channels[channel].name} keyframe at ${kf.time.toFixed(2)} on "${animator.name}" in "${animation.name}" contains non-numeric values. Keyframes that are adjacent to smooth keyframes cannot contain math expressions.`,
									buttons: getButtons(kf)
								})

							} else if (keyframes[i-1] && keyframes[i-1].interpolation == 'catmullrom' && kf.data_points.find(dp => isNaN(dp.x) || isNaN(dp.y) || isNaN(dp.z))) {
								this.fail({
									message: `${animator.channels[channel].name} keyframe at ${kf.time.toFixed(2)} on "${animator.name}" in "${animation.name}" contains non-numeric values. Keyframes that are adjacent to smooth keyframes cannot contain math expressions.`,
									buttons: getButtons(kf)
								})

							} else if (keyframes[i-2] && keyframes[i-2].interpolation == 'catmullrom' && kf.data_points.find(dp => isNaN(dp.x) || isNaN(dp.y) || isNaN(dp.z))) {
								this.warn({
									message: `${animator.channels[channel].name} keyframe at ${kf.time.toFixed(2)} on "${animator.name}" in "${animation.name}" contains non-numeric values. Keyframes that are adjacent to smooth keyframes cannot contain math expressions.`,
									buttons: getButtons(kf)
								})

							}
						})
					}
				}
			}
		})
	}
})

new ValidatorCheck('zero_wide_uv_faces', {
	condition: {formats: ['optifine_entity', 'java_block']},
	update_triggers: ['update_selection'],
	run() {
		for (let cube of Cube.all) {
			if (cube.box_uv && Format.id == 'optifine_entity') continue;
			let affected_faces = [];
			let select_cube_button = {
				name: 'Select Cube',
				icon: 'fa-cube',
				click() {
					Validator.dialog.hide();
					cube.select();
					UVEditor.getSelectedFaces(cube, true).replace(affected_faces);
					updateSelection();
				}
			};
			for (let fkey in cube.faces) {
				let face = cube.faces[fkey];
				if (face.texture === null) continue;
				let uv_size = face.uv_size;
				let size_issue;
				for (let i of [0, 1]) {
					let size = uv_size[i];
					if (Math.abs(size) < 0.00005) {
						size_issue = true;
					}
				}
				if (size_issue) {
					affected_faces.push(fkey);
					this.warn({
						message: `The face "${fkey}" on cube "${cube.name}" has invalid UV sizes. UV sizes should not be 0.`,
						buttons: [select_cube_button]
					})
				}
			}
		}
	}
})
