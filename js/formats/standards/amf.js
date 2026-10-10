import {AMFLoader} from 'three/examples/jsm/loaders/AMFLoader.js'
import { loadThreeModel } from "../../io/three_import";

new Codec('amf', {
	name: 'AMF Model',
	extension: 'amf',
	load_filter: {
		type: 'binary',
		readtype: 'buffer',
		extensions: ['amf']
	},
	async load(content, file) {
		let root;
		try {
			root = new AMFLoader().parse(content);
		} catch (error) {
			console.error(error);
			return Blockbench.showMessageBox({translateKey: 'invalid_model'});
		}
		await loadThreeModel(root, file, this, {scale: 1});
	}
})
