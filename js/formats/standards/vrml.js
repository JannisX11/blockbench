import {VRMLLoader} from 'three/examples/jsm/loaders/VRMLLoader.js'
import { getResourceURL, loadThreeModel, parseWithResources } from "../../io/three_import";

new Codec('vrml', {
	name: 'VRML Model',
	extension: 'wrl',
	load_filter: {
		type: 'text',
		extensions: ['wrl']
	},
	async load(content, file) {
		let scene = await parseWithResources(manager => new VRMLLoader(manager).parse(content, getResourceURL(file.path)));
		if (!scene) return Blockbench.showMessageBox({translateKey: 'invalid_model'});
		await loadThreeModel(scene, file, this, {scale: 1});
	}
})
