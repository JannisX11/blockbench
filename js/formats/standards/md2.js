import {MD2Loader} from 'three/examples/jsm/loaders/MD2Loader.js'
import { loadThreeModel } from "../../io/three_import";
import { THREE } from "../../lib/libs";

new Codec('md2', {
	name: 'MD2 Model',
	extension: 'md2',
	load_filter: {
		type: 'binary',
		readtype: 'buffer',
		extensions: ['md2']
	},
	async load(content, file) {
		let geometry;
		try {
			geometry = new MD2Loader().parse(content);
		} catch (error) {
			console.error(error);
			return Blockbench.showMessageBox({translateKey: 'invalid_model'});
		}
		let root = new THREE.Mesh(geometry);
		root.name = pathToName(file.path, false);
		await loadThreeModel(root, file, this, {scale: 1});
	}
})
