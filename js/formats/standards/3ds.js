import {TDSLoader} from 'three/examples/jsm/loaders/TDSLoader.js'
import { createLoadingManager, getResourceURL, loadThreeModel } from "../../io/three_import";

new Codec('3ds', {
	name: '3DS Model',
	extension: '3ds',
	load_filter: {
		type: 'binary',
		readtype: 'buffer',
		extensions: ['3ds']
	},
	async load(content, file) {
		let root;
		let loading = createLoadingManager();
		try {
			root = new TDSLoader(loading.manager).parse(content, getResourceURL(file.path));
		} catch (error) {
			console.error(error);
			return Blockbench.showMessageBox({translateKey: 'invalid_model'});
		}
		await loading.wait();
		await loadThreeModel(root, file, this, {scale: 1});
	}
})
