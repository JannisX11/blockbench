import {TDSLoader} from 'three/examples/jsm/loaders/TDSLoader.js'
import { getResourceURL, loadThreeModel, parseWithResources } from "../../io/three_import";

new Codec('3ds', {
	name: '3DS Model',
	extension: '3ds',
	load_filter: {
		type: 'binary',
		readtype: 'buffer',
		extensions: ['3ds']
	},
	async load(content, file) {
		let root = await parseWithResources(manager => new TDSLoader(manager).parse(content, getResourceURL(file.path)));
		if (!root) return Blockbench.showMessageBox({translateKey: 'invalid_model'});
		await loadThreeModel(root, file, this, {scale: 1});
	}
})
