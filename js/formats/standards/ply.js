import {PLYLoader} from 'three/examples/jsm/loaders/PLYLoader.js'
import { loadThreeModel } from "../../io/three_import";
import { THREE } from "../../lib/libs";

new Codec('ply', {
	name: 'PLY Model',
	extension: 'ply',
	load_filter: {
		type: 'binary',
		readtype: 'buffer',
		extensions: ['ply']
	},
	async load(content, file) {
		let geometry;
		try {
			geometry = new PLYLoader().parse(content);
		} catch (error) {
			console.error(error);
			return Blockbench.showMessageBox({translateKey: 'invalid_model'});
		}
		let root = new THREE.Mesh(geometry);
		root.name = pathToName(file.path, false);
		await loadThreeModel(root, file, this, {scale: 1});
	}
})
