import { Dialog } from "../interface/dialog";
import { Filesystem } from "../file_system";

export interface MissingResource {
	name: string
	extensions?: string[]
	readtype?: string
}

export function promptMissingResources(missing: MissingResource[]): Promise<Record<string, Filesystem.FileResult> | null> {
	return new Promise(resolve => {
		let resolved = false;
		let form: Record<string, any> = {
			info: {type: 'info', text: 'dialog.missing_resources.message'}
		};
		missing.forEach((resource, index) => {
			form['file_' + index] = {
				label: resource.name,
				type: 'file',
				extensions: resource.extensions,
				readtype: resource.readtype ?? 'image',
				return_as: 'file'
			};
		});
		new Dialog('missing_resources', {
			title: 'dialog.missing_resources.title',
			form,
			onConfirm(result: Record<string, Filesystem.FileResult>) {
				let provided: Record<string, Filesystem.FileResult> = {};
				missing.forEach((resource, index) => {
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
