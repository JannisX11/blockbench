(function() {


var codec = new Codec('collada', {
	name: 'Collada Model',
	extension: 'dae',
	async compile(options = 0) {
		let scope = this;
		/*
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
		scene.add(Project.model_3d);
		*/
		let geometries = [];
		let root = [];

		let model = {
			type: 'COLLADA',
			content: [
				{
					type: 'asset',
					content: [
						{
							name: 'contributor',
							content: [
								{type: 'authoring_tool', content: 'Blockbench'},
								{type: 'author', content: settings.username.value || 'Blockbench user'}
							]
						},
						{name: 'created', content: new Date().toISOString()},
						{name: 'modified', content: new Date().toISOString()},
						{name: 'up_axis', content: 'Y_UP'}
					]
				},
				{
					type: 'library_geometries',
					content: geometries
				},
				{
					type: 'library_visual_scenes',
					content: [{
						type: visual_scene,
						attributes: {
							id: 'Scene',
							name: 'Scene',
						},
						content: root
					}]
				},
				{
					type: 'scene',
					content: [{
						type: 'instance_visual_scene',
						attributes: {
							url: '#Scene'
						}
					}]
				}
			]
		}

		Cube.all.forEach(cube => {
			let node = {
				attributes: {
					id: cube.uuid,
					name: cube.name,
					type: 'NODE'
				},
				content: [
					{type: 'scale', attributes: {sid: 'scale'}, content: '1 1 1'},
					{type: 'rotate', attributes: {sid: 'rotationX'}, content: '1 0 0 0'},
					{type: 'rotate', attributes: {sid: 'rotationY'}, content: '0 1 0 0'},
					{type: 'rotate', attributes: {sid: 'rotationZ'}, content: '0 0 1 -7'},
					{type: 'translate', attributes: {sid: 'location'}, content: cube.origin.join(' ')},
					{type: 'instance_geometry', attributes: {url: `#${cube.uuid}-mesh`, name: cube.name}},
				]
			}
			root.push(node);

			let geometry = {
				attributes: {
					id: `${cube.uuid}-mesh`,
					name: Cube.name
				},
				content: [{
					type: 'mesh',
					content: [
						{
							type: 'source',
							attributes: {id: `${cube.uuid}-mesh-positions`},
							content: [
								{
									type: 'float_array',
									attributes: {id: `${cube.uuid}-mesh-positions-array`, count: 24},
									content: cube.mesh.geometry.attributes.position.array.join(' ')
								}
							]
						},
						{
							type: 'source',
							attributes: {id: `${cube.uuid}-mesh-normals`},
							content: [
								{
									type: 'float_array',
									attributes: {id: `${cube.uuid}-mesh-normals-array`, count: 24},
									content: cube.mesh.geometry.attributes.normal.array.join(' ')
								}
							]
						},
						{
							type: 'vertices',
							attributes: {id: `${cube.uuid}-mesh-vertices`},
							content: [
								{
									type: 'input',
									attributes: {semantic: 'POSITION', id: `${cube.uuid}--mesh-positions`}
								}
							]
						}
					]
				}]
			}
			geometries.push(geometry);
		})

		scope.dispatchEvent('compile', {model, options});
		

		if (options.raw) {
			return model
		} else {
			return compileXML(model)
		}
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

function compileXML(object) {
	let depth = 0;
	let output = '<?xml version="1.0" encoding="utf-8"?>\n';

	function spaces() {
		let s = '';
		for (let i = 0; i < depth; i++) {
			s += '  ';
		}
		return s;
	}
	function handleObject(object) {
		let type = object.type || object.name;
		let head = `<${type}`;
		if (object.attributes) {
			for (let key in object.attributes) {
				head += ` ${key}="${object.attributes[key]}"`
			}
		}
		output += spaces() + head;
		if (typeof object.content == 'string') {
			output += '>' + object.content + `</${type}>\n`;
		} else if (object.content instanceof Array) {
			depth++;
			output += `>\n`;
			object.content.forEach(node => {
				handleObject(node);
			})
			depth--;
			output += spaces() + `</${type}>\n`;
		} else {
			output += '/>\n';
		}
	}
	handleObject(object);

	return output;
}
