import {STLExporter} from 'three/examples/jsm/exporters/STLExporter.js'

var codec = new Codec('stl', {
	name: 'STL Model',
	extension: 'stl',
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

