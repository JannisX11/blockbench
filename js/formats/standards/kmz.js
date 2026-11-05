import {KMZLoader} from 'three/examples/jsm/loaders/KMZLoader.js'
import { loadThreeModel } from "../../io/three_import";

new Codec('kmz', {
	name: 'KMZ Model',
	extension: 'kmz',
	load_filter: {
		type: 'binary',
		readtype: 'buffer',
		extensions: ['kmz']
	},
	async load(content, file) {
		let kmz;
		try {
			kmz = new KMZLoader().parse(content);
		} catch (error) {
			console.error(error);
			return Blockbench.showMessageBox({translateKey: 'invalid_model'});
		}
		await loadThreeModel(kmz.scene, file, this);
	}
})
