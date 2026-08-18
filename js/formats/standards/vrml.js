import {VRMLLoader} from 'three/examples/jsm/loaders/VRMLLoader.js'
import { createLoadingManager, getResourceURL, loadThreeModel } from "../../io/three_import";

new Codec('vrml', {
	name: 'VRML Model',
	extension: 'wrl',
	load_filter: {
		type: 'text',
		extensions: ['wrl']
	},
	async load(content, file) {
		let scene;
		let loading = createLoadingManager();
		try {
			scene = new VRMLLoader(loading.manager).parse(content, getResourceURL(file.path));
		} catch (error) {
			console.error(error);
			return Blockbench.showMessageBox({translateKey: 'invalid_model'});
		}
		await loading.wait();
		await loadThreeModel(scene, file, this, {scale: 1});
	}
})
