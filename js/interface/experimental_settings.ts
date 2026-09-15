import { FormResultValue, InputFormConfig } from "./form"

StateMemory.init('experimental_settings', 'object');

export const ExperimentalSettings = {
	values: {} as Record<string, FormResultValue>,
	settings: {} as Record<string, FormElementOptions>,
	add(id: string, options: FormElementOptions) {
		options.reset_button ??= true;
		ExperimentalSettings.settings[id] = options;
		ExperimentalSettings.values[id] ??= options.value ?? options.default;
	},
	get(id: string): FormResultValue | undefined {
		return ExperimentalSettings.values[id];
	},
	showDialog() {
		const form: InputFormConfig = {};

		for (let id in ExperimentalSettings.settings) {
			form[id] = ExperimentalSettings.settings[id];
		}

		const dialog = new Dialog('experimental_settings', {
			title: 'action.experimental_settings',
			icon: 'experiment',
			width: 700,
			form,
			onConfirm(result) {
				Object.assign(ExperimentalSettings.values, result);
				StateMemory.set('experimental_settings', ExperimentalSettings.values);
			}
		});
		dialog.show();
		dialog.form.setValues(ExperimentalSettings.values);
		let form_div = dialog.object.querySelector('div.form') as HTMLDivElement;
		if (form_div) {
			form_div.style.setProperty('--max_label_width', '50%');
		}
	}
}
try {
	let data = StateMemory.get('experimental_settings');
	if (typeof data == 'object') {
		Object.assign(ExperimentalSettings.values, data);
	}
} catch (err) {
	console.error("Failed to load experimental settings", err);
	StateMemory.set('experimental_settings', {});
}

BARS.defineActions(() => {
	new Action('experimental_settings', {
		icon: 'experiment',
		click() {
			ExperimentalSettings.showDialog();
		}
	})
});

const global = {
	ExperimentalSettings,
};
declare global {
	const ExperimentalSettings: typeof global.ExperimentalSettings
}
Object.assign(window, global);
