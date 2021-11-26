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
		let effects = [];
		let images = [];
		let materials = [];

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
					type: 'library_effects',
					content: effects
				},
				{
					type: 'library_images',
					content: images
				},
				{
					type: 'library_materials',
					content: materials
				},
				{
					type: 'library_geometries',
					content: geometries
				},
				{
					type: 'library_visual_scenes',
					content: [{
						type: 'visual_scene',
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

		Texture.all.forEach((texture, i) => {
			effects.push({
				type: 'effect',
				attributes: {id: `Material_${i}-effect`},
				content: {
					type: 'profile_COMMON',
					content: [
						{
							type: 'newparam',
							attributes: {sid: `Image_0-surface`},
							content: {
								type: 'surface',
								attributes: {type: '2D'},
								content: {type: 'init_from', content: `Image_0`}
							}
						},
						{
							type: 'newparam',
							attributes: {sid: `Image_0-sampler`},
							content: {
								type: 'sampler2D',
								attributes: {type: '2D'},
								content: {type: 'source', content: `Image_0-surface`}
							}
						},
						{
							type: 'technique',
							attributes: {sid: 'common'},
							content: {
								type: 'lambert',
								content: [
									{type: 'emission', content: {type: 'color', attributes: {sid: 'emission'}, content: '0 0 0 1'}},
									{type: 'diffuse', content: {type: 'texture', attributes: {texture: `Image_0-sampler`, texcoord: 'UVMap'}}},
									{type: 'index_of_refraction', content: {type: 'float', attributes: {sid: 'ior'}, content: '1.45'}}
								]
							}
						}
					]
				}
			})
			images.push({
				type: 'image',
				attributes: {
					id: `Image_${i}`,
					name: `Image_${i}`,
				},
				content: {
					type: 'init_from',
					content: `Image_${i}.png`
				}
			})
			materials.push({
				type: 'material',
				attributes: {
					id: `Image_${i}-material`,
					name: `Image_${i}`,
				},
				content: {name: 'instance_effect', attributes: {url: `#Material_${i}-effect`}}
			})
		})

		Cube.all.forEach(cube => {

			let geometry = {
				type: 'geometry',
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
								},
								{
									type: 'technique_common',
									content: {
										type: 'accessor',
										attributes: {source: `#${cube.uuid}-mesh-positions-array`, count: 8, stride: 3},
										content: [
											{type: 'param', attributes: {name: 'X', type: 'float'}},
											{type: 'param', attributes: {name: 'Y', type: 'float'}},
											{type: 'param', attributes: {name: 'Z', type: 'float'}},
										]
									}
								}
							]
						},
						{
							type: 'source',
							attributes: {id: `${cube.uuid}-mesh-normals`},
							content: [
								{
									type: 'float_array',
									attributes: {id: `${cube.uuid}-mesh-normals-array`, count: 18},
									content: cube.mesh.geometry.attributes.normal.array.join(' ')
								},
								{
									type: 'technique_common',
									content: {
										type: 'accessor',
										attributes: {source: `#${cube.uuid}-mesh-normals-array`, count: 6, stride: 3},
										content: [
											{type: 'param', attributes: {name: 'X', type: 'float'}},
											{type: 'param', attributes: {name: 'Y', type: 'float'}},
											{type: 'param', attributes: {name: 'Z', type: 'float'}},
										]
									}
								}
							]
						},
						{
							type: 'source',
							attributes: {id: `${cube.uuid}-mesh-map-0`},
							content: [
								{
									type: 'float_array',
									attributes: {id: `${cube.uuid}-mesh-map-0-array`, count: 48},
									content: cube.mesh.geometry.attributes.uv.array.join(' ')
								},
								{
									type: 'technique_common',
									content: {
										type: 'accessor',
										attributes: {source: `#${cube.uuid}-mesh-map-0-array`, count: 24, stride: 2},
										content: [
											{type: 'param', attributes: {name: 'S', type: 'float'}},
											{type: 'param', attributes: {name: 'T', type: 'float'}},
										]
									}
								}
							]
						},
						{
							type: 'vertices',
							attributes: {id: `${cube.uuid}-mesh-vertices`},
							content: [
								{
									type: 'input',
									attributes: {semantic: 'POSITION', id: `${cube.uuid}-mesh-positions`}
								}
							]
						},
						{
							type: 'polylist',
							attributes: {
								count: 6,
								material: ''
							},
							content: [
								{type: 'input', semantic: 'VERTEX', source: `${cube.uuid}-mesh-positions`, offset: 0},
								{type: 'input', semantic: 'NORMAL', source: `${cube.uuid}-mesh-normals`, offset: 1},
								{type: 'input', semantic: 'TEXCOORD', source: `${cube.uuid}-mesh-map-0`, offset: 2, set: 0},
								{type: 'vcount', content: '4 4 4 4 4 4'},
								{type: 'p', content: '0 0 0 1 0 1 3 0 2 2 0 3 2 1 4 3 1 5 7 1 6 6 1 7 6 2 8 7 2 9 5 2 10 4 2 11 4 3 12 5 3 13 1 3 14 0 3 15 2 4 16 6 4 17 4 4 18 0 4 19 7 5 20 3 5 21 1 5 22 5 5 23'}
							]
						}
					]
				}]
			}
			geometries.push(geometry);
		})

		function processNode(node) {
			let tag = {
				attributes: {
					id: node.uuid,
					name: node.name,
					type: 'NODE'
				},
				content: [
					{type: 'scale', attributes: {sid: 'scale'}, content: '1 1 1'},
					{type: 'rotate', attributes: {sid: 'rotationX'}, content: '1 0 0 0'},
					{type: 'rotate', attributes: {sid: 'rotationY'}, content: '0 1 0 0'},
					{type: 'rotate', attributes: {sid: 'rotationZ'}, content: '0 0 1 -7'},
					{type: 'translate', attributes: {sid: 'location'}, content: node.origin.join(' ')},
					{type: 'instance_geometry', attributes: {url: `#${node.uuid}-mesh`, name: node.name}},
				]
			}
			if (node instanceof Group) {
				node.children.forEach(node => {
					tag.content.push(processNode(node));
				})
			}
			return tag;
		}

		Outliner.root.forEach(node => {
			root.push(processNode(node))
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
		} else if (typeof object.content == 'object') {
			depth++;
			output += `>\n`;
			let list = object.content instanceof Array ? object.content : [object.content];
			list.forEach(node => {
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
