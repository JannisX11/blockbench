(function() {


var codec = new Codec('collada', {
	name: 'Collada Model',
	extension: 'dae',
	async compile(options = 0) {
		let scope = this;
		let exporter = new THREE.ColladaExporter();
		let animations = [];
		let gl_scene = new THREE.Scene();
		gl_scene.name = 'blockbench_export'

		gl_scene.add(Project.model_3d);

		if (!Modes.edit) {
			Animator.showDefaultPose();
		}
		if (options.animations !== false) {
			//animations = buildAnimationTracks();
		}
		let result = await new Promise((resolve, reject) => {
			exporter.parse(gl_scene, (result) => {
				resolve(result);
			}, {
				author: settings.username.value || 'Blockbench User',
				textureDirectory: 'textures'
			});
		})
		scope.dispatchEvent('compile', {model: result.data, options});
		console.log(result)

		scene.add(Project.model_3d);

		return result.data;
	},
	export() {
		var scope = codec;
		scope.compile().then(content => {
			Blockbench.export({
				resource_id: 'gltf',
				type: scope.name,
				extensions: [scope.extension],
				name: scope.fileName(),
				startpath: scope.startPath(),
				content,
				custom_writer: isApp ? (a, b) => scope.write(a, b) : null,
			}, path => scope.afterDownload(path))
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
