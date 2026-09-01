import { Filesystem } from "../file_system";
import { fs } from "../native_apis";

/**
 * A codec represents a specific file format that can be imported into and exported from Blockbench. The codec handles the compilation and parsing, as well as the loading and exporting logic
 * @module
 */

export interface LoadOptions {
	import_to_current_project?: boolean
	externalDataLoader?: (path: string) => any
	resolve_parent?: false | 'open' | 'open_with_textures'
	[key: string]: unknown
}
export interface CodecOptions {
	name?: string
	load?(model: any, file: Filesystem.FileResult, args?: LoadOptions): void
	compile?(options?: any): string | ArrayBuffer | any
	parse?(data: any, path: string, args?: LoadOptions): void
	export?(): void
	/**
	 * Generate a file name to suggest when exporting
	 */
	fileName?(): string
	startPath?(): string
	write?(content: any, path: string): void
	overwrite?(content: any, path: string, callback: (path: any) => void): void
	afterDownload?(path: any): void
	afterSave?(path: any): void
	exportCollection?(collection: Collection): void
	writeCollection?(collection: Collection): void

	dispatchEvent?(event_name: string, data: any): void

	extension?: string
	/**
	 * Whether to remember the models exported using this codec
	 */
	remember?: boolean
	/**
	 * Whether the codec can be used to export a part of the model via a collection
	 */
	support_partial_export?: boolean
	support_offset?: boolean
	load_filter?: {
		extensions: string[] | (() => string[])
		type: 'json' | 'text' | 'image'
		condition?: ConditionResolvable
	}
	/**
	 * List of export option inputs, based on the Dialog form API
	 */
	export_options?: {
		[key: string]: FormElementOptions
	}
	/**
	 * Default action that is used to export to the codec
	 */
	export_action?: Action
	format?: ModelFormat
	plugin?: string
}

/**
 * A codec represents a specific file format that can be imported into and exported from Blockbench. The codec handles the compilation and parsing, as well as the loading and exporting logic
 */
export class Codec extends EventSystem {
	/**
	 * The display name of the codec
	 */
	name: string
	/**
	 * The default file extension that the codec uses
	 */
	extension: string
	/**
	 * Whether to remember files that use this codec in the recent models list
	 */
	remember: boolean
	/**
	 * Whether the codec can be used to export a part of the model via a collection
	 */
	support_partial_export: boolean
	support_offset: boolean
	/**
	 * If available, the action that is used to export files using this codec
	 */
	export_action?: Action

	/**
	 * List of export option inputs
	 */
	export_options: Record<string, FormElementOptions> = {};
	/**
	 * Additional properties
	 */
	[key: string]: any
	/**
	 * Default/main format of this codec
	 */
	format?: ModelFormat
	plugin?: string


	/**
	 * Creates a new codec
	 * @param id Codec ID
	 * @param data Codec options
	 */
	constructor(id: string, data: CodecOptions = {}) {
		super();
		this.id = id;
		Codecs[id] = this;
		this.name = data.name || 'Unknown Format';
		this.events = {};
		this.export_options = data.export_options || {};
		Merge.function(this, data, 'load');
		Merge.function(this, data, 'compile');
		Merge.function(this, data, 'parse');
		Merge.function(this, data, 'merge');
		Merge.function(this, data, 'write');
		Merge.function(this, data, 'overwrite');
		Merge.function(this, data, 'export');
		Merge.function(this, data, 'exportCollection');
		Merge.function(this, data, 'writeCollection');
		Merge.function(this, data, 'fileName');
		Merge.function(this, data, 'afterSave');
		Merge.function(this, data, 'afterDownload');
		Merge.string(this, data, 'extension');
		Merge.boolean(this, data, 'remember');
		Merge.boolean(this, data, 'multiple_per_file');
		Merge.boolean(this, data, 'support_partial_export');
		Merge.boolean(this, data, 'support_offset');
		this.format = data.format;
		this.load_filter = data.load_filter;
		this.export_action = data.export_action;
		this.plugin = data.plugin || (typeof Plugins != 'undefined' ? Plugins.currently_loading : '');
		this.context = null;
	}
	/**
	 * Return the stored export option values of the current project
	 */
	getExportOptions(): { [key: string]: any } {
		let options = {};
		for (let key in this.export_options) {
			options[key] = this.export_options[key].value;
		}
		let saved = Project.export_options[this.id];
		if (saved) Object.assign(options, saved);
		return options;
	}
	//Import
	/**
	 * Load a file into the program
	 * @param model
	 * @param file
	 * @param args Load options
	 */
	load(model: any, file?: Filesystem.FileResult, args: LoadOptions = {}): boolean | void {
		if (!this.parse) return false;
		if (!args.import_to_current_project) {
			setupProject(this.format)
		}
		if (file.path && isApp && this.remember && !file.no_file ) {
			var name = pathToName(file.path, true);
			Project.name = pathToName(name, false);
			Project.export_path = file.path;
			Project.export_codec = this.id;
		}

		this.parse(model, file.path, args)

		if (file.path && isApp && this.remember && !file.no_file ) {
			loadDataFromModelMemory();
			addRecentProject({
				name,
				path: file.path,
				icon: Format.icon
			})
			let project = Project;
			setTimeout(() => {
				if (Project == project) updateRecentProjectThumbnail();
			}, 500)
		}
		Settings.updateSettingsInProfiles();
	}
	/**
	 * Takes the content of a file, and loads the model into the current Blockbench project
	 * @param data File content
	 * @param path File path
	 */
	parse?(data: any, path: string, args?: LoadOptions): void

	/**
	 * Compiles the file content
	 * @param options
	 */
	compile(options = this.getExportOptions()): any {
		this.dispatchEvent('compile', {content: ''})
		return '';
	}
	/**
	 * Prompt the user to enter their preferred export settings into the dialog
	 */
	async promptExportOptions(): Promise<{ [key: string]: any } | null> {
		let codec = this;
		return await new Promise((resolve, reject) => {
			let form = {};
			let opts_in_project = Project.export_options[codec.id];

			for (let form_id in this.export_options) {
				// if (!Condition(this.export_options[form_id].condition)) continue;
				form[form_id] = {};
				for (let key in this.export_options[form_id]) {
					form[form_id][key] = this.export_options[form_id][key];
				}
				if (opts_in_project && opts_in_project[form_id] != undefined) {
					form[form_id].value = opts_in_project[form_id];
				}
			}
			new Dialog('export_options', {
				title: 'dialog.export_options.title',
				width: 480,
				form,
				onConfirm(result) {
					if (!Project.export_options[codec.id]) Project.export_options[codec.id] = {};
					for (let key in result) {
						let value = result[key];
						Project.export_options[codec.id][key] = value;
					}
					resolve(result);
				},
				onCancel() {
					resolve(null);
				}
			}).show();
		})
	}
	/**
	 * Opens the file browser to export a file of this type
	 */
	async export(options?: Record<string, any>) {
		if (Object.keys(this.export_options).length) {
			let result = await this.promptExportOptions();
			if (options === null) return;
			if (result) options = Object.assign({...options}, result);
		}
		Blockbench.export({
			resource_id: 'model',
			type: this.name,
			extensions: [this.extension],
			name: this.fileName(),
			startpath: this.startPath(),
			content: this.compile(options),
			custom_writer: isApp ? (a, b) => this.write(a, b) : null,
		}, path => this.afterDownload(path))
	}
	async patchCollectionExport(collection: Collection, callback) {
		this.context = collection;
		let name = this.name;
		this.name = collection.name;
		let element_export_values = {};
		let all = (Outliner.elements as OutlinerNode[]).concat(Group.all);
		for (let node of all) {
			if (typeof node.export != 'boolean') continue;
			element_export_values[node.uuid] = node.export;
			node.export = false;
		}
		for (let node of collection.getAllChildren()) {
			if (node.export == false) node.export = true;
		}
		try {
			await callback();
		} catch (error) {
			throw error;
		} finally {
			this.context = null;
			this.name = name;
			for (let node of all) {
				if (element_export_values[node.uuid] === undefined) continue;
				node.export = element_export_values[node.uuid];
			}
		}
	}
	async exportCollection(collection: Collection) {
		this.patchCollectionExport(collection, async () => {
			await this.export();
		})
	}
	async writeCollection(collection: Collection) {
		this.patchCollectionExport(collection, async () => {
			this.write(this.compile(), collection.export_path);
			collection.saved = true;
		})
	}
	/**
	 * Generate a file name to suggest when exporting
	 */
	fileName(): string {
		if (this.context instanceof Collection) {
			return this.context.name;
		} else {
			return Project.name||'model';
		}
	}
	/**
	 * Generates the suggested file path. This is the path that the explorer opens in when exporting this type
	 */
	startPath(): string {
		if (this.context instanceof Collection) {
			return this.context.export_path;
		} else {
			return Project.export_path;
		}
	}
	/**
	 * Write the content of this file to the selected location. The default method can be overwritten to achieve custom behavior
	 * @param content File content, as generated by compile()
	 * @param path The file export path
	 */
	write(content: any, path: string) {
		if (fs.existsSync(path) && this.overwrite) {
			this.overwrite(content, path, path => this.afterSave(path))
		} else {
			Blockbench.writeFile(path, {content}, path => this.afterSave(path));
		}
	}
	overwrite?(content: any, path: string, callback: (path: string) => void): void;

	afterDownload(path: string): void {
		if (this.remember) {
			Project.saved = true;
		}
		Blockbench.showQuickMessage(tl('message.save_file', [path ? pathToName(path, true) : this.fileName()]));
	}
	afterSave(path: string): void {
		var name = pathToName(path, true)
		if (this.context instanceof Collection) {
			this.context.export_path = path;
			this.context.export_codec = this.id;

		} else if (Format.codec == this || this.id == 'project') {
			if (this.id == 'project') {
				Project.save_path = path;
			} else {
				Project.export_path = path;
				Project.export_codec = this.id;
			}
			Project.name = pathToName(path, false);
			Project.saved = true;
		}
		Settings.updateSettingsInProfiles();
		if (this.remember) {
			addRecentProject({
				name,
				path: path,
				icon: this.id == 'project' ? 'icon-blockbench_file' : Format.icon
			});
			updateRecentProjectThumbnail();
		}
		Blockbench.showQuickMessage(tl('message.save_file', [name]));
	}
	//Delete
	delete() {
		delete Codecs[this.id];
		if (this.format && this.format.codec == this) delete this.format.codec;
	}

	/**
	 * Get a list of all possible extensions of all codecs
	 */
	static getAllExtensions(): string[] {
		let extensions = [];
		for (let id in Codecs) {
			let codec = Codecs[id];
			if (codec.load_filter && codec.load_filter.extensions) {
				let list = typeof codec.load_filter.extensions == 'function'
					? codec.load_filter.extensions()
					: codec.load_filter.extensions ?? [];
				extensions.safePush(...list);
			}
		}
		return extensions;
	}
}
export const Codecs: Record<string, Codec> = {};


const global = {
	Codec,
	Codecs
};
declare global {
	const Codec: typeof global.Codec
	type Codec = import('./codec').Codec
	const Codecs: Record<string, Codec>
}
Object.assign(window, global);
