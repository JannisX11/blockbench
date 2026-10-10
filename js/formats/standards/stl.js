import {STLExporter} from 'three/examples/jsm/exporters/STLExporter.js'
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js'
import { loadThreeModel } from "../../io/three_import";
import { THREE } from "../../lib/libs";

var codec = new Codec('stl', {
	name: 'STL Model',
	extension: 'stl',
	load_filter: {
		type: 'binary',
		readtype: 'buffer',
		extensions: ['stl']
	},
	async load(content, file) {
		let geometry;
		try {
			geometry = new STLLoader().parse(content);
		} catch (error) {
			console.error(error);
			return Blockbench.showMessageBox({translateKey: 'invalid_model'});
		}
		let root = new THREE.Mesh(geometry);
		root.name = pathToName(file.path, false);
		await loadThreeModel(root, file, this, {scale: 1});
	},
	export_options: {
		encoding: {type: 'select', label: 'codec.common.encoding', options: {ascii: 'ASCII', binary: 'Binary'}},
	},
	compile(options = 0) {
		let scope = this;
		let export_scale = Settings.get('model_export_scale');
		let exporter = new STLExporter();
		let scene = new THREE.Scene();
		scene.name = 'blockbench_export'

		if (!Modes.edit) {
			Animator.showDefaultPose();
		}
		Outliner.root.forEach(node => {
			scene.children.push(node.mesh);
		})

		let result = exporter.parse(scene, {binary: options.encoding == 'binary'});

		scope.dispatchEvent('compile', {result, options});

		return result;
	}
})

BARS.defineActions(function() {
	codec.export_action = new Action({
		id: 'export_stl',
		icon: 'database',
		category: 'file',
		click: function () {
			codec.export()
		}
	})
})

