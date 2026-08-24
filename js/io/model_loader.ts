import { Vue } from "../lib/libs";
import { FormatPage } from "./format";

export interface ModelLoaderOptions {
	icon: string
	name?: string
	description?: string
	category?: string
	target?: string | string[]
	show_on_start_screen?: boolean
	confidential?: boolean
	condition?: ConditionResolvable
	plugin?: string
	format_page?: FormatPage
	onFormatPage?: () => void
	onStart: () => void
}
/**
 * A model loader provides a way for users to create a new model that is loaded or created from code. Examples are Entity Wizard or CEM Template loader.
 * Model loaders show up alongside formats on the start screen and in File > New.
 */
export class ModelLoader implements Deletable {
	id: any;
	icon: string
	name?: string
	description?: string
	category?: string
	target?: string | string[]
	show_on_start_screen: boolean;
	confidential: boolean;
	condition: ConditionResolvable;
	format_page: FormatPage;
	plugin?: string
	onFormatPage: () => void;
	onStart: () => void;

	constructor(id: string, options: ModelLoaderOptions) {
		this.id = id;
		this.name = tl(options.name);
		this.description = options.description ? tl(options.description) : '';
		this.icon = options.icon || 'arrow_forward';
		this.category = options.category || 'loaders';
		this.target = options.target || '';
		this.show_on_start_screen = options.show_on_start_screen ?? true;
		this.confidential = options.confidential || false;
		this.condition = options.condition;
		this.plugin = options.plugin || (typeof Plugins != 'undefined' ? Plugins.currently_loading : '');

		this.format_page = options.format_page;
		this.onFormatPage = options.onFormatPage;
		this.onStart = options.onStart;

		Vue.set(ModelLoader.loaders, id, this);
		if (this.format_page && this.format_page.component) {
			Vue.component(`format_page_${this.id}`, this.format_page.component)
		}
		Blockbench.dispatchEvent('construct_model_loader', {loader: this});
	}
	new() {
		this.onStart();
	}
	delete() {
		Vue.delete(ModelLoader.loaders, this.id);
		Blockbench.dispatchEvent('delete_model_loader', {loader: this});
	}
	static loaders: Record<string, ModelLoader> = {}
}

const global = {
	ModelLoader
};
declare global {
	type ModelLoader = import('./model_loader').ModelLoader
	const ModelLoader: typeof global.ModelLoader
}
Object.assign(window, global);
