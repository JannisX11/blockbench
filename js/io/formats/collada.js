(function() {


var codec = new Codec('collada', {
	name: 'Collada Model',
	extension: 'dae',
	compile(options = 0, callback) {
		let scope = this;
		let exporter = new THREE.ColladaExporter();
		let animations = [];
		let gl_scene = new THREE.Scene();
		gl_scene.name = 'blockbench_export'

		scene.children.forEachReverse(object => {
			if (object.isGroup || object.isElement) {
				gl_scene.add(object);
			}
		});
		if (!Modes.edit) {
			Animator.showDefaultPose();
		}
		if (options.animations !== false) {
			animations = buildAnimationTracks();
		}
		exporter.parse(gl_scene, (json) => {

			scope.dispatchEvent('compile', {model: json, options});
			callback(JSON.stringify(json));

			gl_scene.children.forEachReverse(object => {
				if (object.isGroup || object.isElement) {
					scene.add(object);
				}
			});
		}, {
			animations,
			version: '1.5.0',
			author: 'Blockbench',
			textureDirectory: 'textures'
		});
	},
	export() {
		var scope = codec;
		scope.compile(0, content => {
			setTimeout(_ => {
				Blockbench.export({
					resource_id: 'gltf',
					type: scope.name,
					extensions: [scope.extension],
					name: scope.fileName(),
					startpath: scope.startPath(),
					content,
					custom_writer: isApp ? (a, b) => scope.write(a, b) : null,
				}, path => scope.afterDownload(path))
			}, 20)
		})
	}
})

BARS.defineActions(function() {
	codec.export_action = new Action({
		id: 'export_collada',
		icon: 'fas.fa-sync-alt',
		category: 'file',
		click: function () {
			codec.export()
		}
	})
})

})()
