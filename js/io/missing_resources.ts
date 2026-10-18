import { Dialog } from "../interface/dialog";
import { Filesystem } from "../file_system";

export interface MissingResource {
	name: string
	extensions?: string[]
	readtype?: string
	expand?: (file: Filesystem.FileResult) => MissingResource[]
}

export function promptMissingResources(missing: MissingResource[]): Promise<Record<string, Filesystem.FileResult> | null> {
	return new Promise(resolve => {
		let entries = missing.slice();
		let expanded = new Set<MissingResource>();
		let resolved = false;
		let dialog: Dialog;

		function buildFormConfig(): Record<string, any> {
			let form: Record<string, any> = {
				info: {type: 'info', text: 'dialog.missing_resources.message'}
			};
			entries.forEach((resource, index) => {
				form['file_' + index] = {
					label: resource.name,
					type: 'file',
					extensions: resource.extensions,
					readtype: resource.readtype ?? 'image',
					return_as: 'file'
				};
			});
			return form;
		}

		dialog = new Dialog('missing_resources', {
			title: 'dialog.missing_resources.title',
			form: buildFormConfig(),
			onFormChange(result: Record<string, Filesystem.FileResult>) {
				let added = false;
				entries.forEach((resource, index) => {
					if (!resource.expand || expanded.has(resource)) return;
					let file = result['file_' + index];
					if (!file) return;
					expanded.add(resource);
					for (let extra of resource.expand(file) || []) {
						if (!entries.find(entry => entry.name == extra.name)) {
							entries.push(extra);
							added = true;
						}
					}
				});
				if (!added) return;
				setTimeout(() => {
					let files: Record<string, Filesystem.FileResult> = {};
					for (let key in dialog.form.form_data) {
						let element: any = dialog.form.form_data[key];
						if (element.file) files[key] = element.file;
					}
					let form_config = dialog.form.form_config;
					for (let key in form_config) delete form_config[key];
					Object.assign(form_config, buildFormConfig());
					dialog.form.buildForm();
					for (let key in files) {
						let element: any = dialog.form.form_data[key];
						if (element) {
							element.file = files[key];
							element.value = files[key].path ?? files[key].name;
							element.updateInput();
						}
					}
				}, 0);
			},
			onConfirm(result: Record<string, Filesystem.FileResult>) {
				let provided: Record<string, Filesystem.FileResult> = {};
				entries.forEach((resource, index) => {
					if (result['file_' + index]) provided[resource.name] = result['file_' + index];
				});
				resolved = true;
				resolve(Object.keys(provided).length ? provided : null);
			},
			onCancel() {
				if (!resolved) resolve(null);
			}
		}).show();
	})
}

export function resourceToURL(file: Filesystem.FileResult): string {
	if (isApp && file.path) {
		return 'file:///' + encodeURI(file.path.replace(/\\/g, '/')).replace(/#/g, '%23');
	}
	if (typeof file.content == 'string') return file.content;
	return '';
}
