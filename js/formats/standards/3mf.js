import {ThreeMFLoader} from 'three/examples/jsm/loaders/3MFLoader.js'
import { createLoadingManager, loadThreeModel } from "../../io/three_import";

new Codec('3mf', {
	name: '3MF Model',
	extension: '3mf',
	load_filter: {
		type: 'binary',
		readtype: 'buffer',
		extensions: ['3mf']
	},
	async load(content, file) {
		let root;
		let loading = createLoadingManager();
		try {
			root = new ThreeMFLoader(loading.manager).parse(content);
		} catch (error) {
			console.error(error);
			return Blockbench.showMessageBox({translateKey: 'invalid_model'});
		}
		await loading.wait();
		await loadThreeModel(root, file, this, {scale: 1});
	}
})
