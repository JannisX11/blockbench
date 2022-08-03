const Validator = {
	checks: [],

	warnings: [],
	errors: [],
	validate(trigger) {
		Validator.warnings.empty();
		Validator.errors.empty();

		if (!Project) return;
		Validator.checks.forEach(check => {
			try {
				if (!Condition(check.condition)) return;

				if (!trigger || check.update_triggers.includes(trigger)) {
					check.update();
				}
				Validator.warnings.push(...check.warnings);
				Validator.errors.push(...check.errors);

			} catch (error) {
				console.error(error);
			}
		})
	},
	openDialog() {
		if (!Validator.dialog) {
			Validator.dialog = new Dialog({
				id: 'validator',
				title: 'action.validator_window',
				singleButton: true,
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
						getIconNode: Blockbench.getIconNode
					},
					template: `
						<template>
							<ul>
								<li v-for="problem in problems" class="validator_dialog_problem" :class="problem.error ? 'validator_error' : 'validator_warning'" :key="problem.message">
									<i class="material-icons">{{ problem.error ? 'error' : 'warning' }}</i>
									<span>{{ problem.message }}</span>
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

new ValidatorCheck('texture_names', {
	condition: {formats: ['java_block']},
	update_triggers: ['add_texture', 'change_texture_path'],
	run() {
		Texture.all.forEach(texture => {
			let characters = (texture.folder + texture.name).match(/[^a-z0-9._/\\-]/)
			if (characters) {
				this.warn({
					message: `Texture "${texture.name}" contains the following invalid characters: "${characters.join('')}"`,
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
