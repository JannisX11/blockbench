(function() {

function arrangeArray(array) {
	return array.map(v => Math.roundTo(v, 6)).join(' ');
}


var codec = new Codec('collada', {
	name: 'Collada Model',
	extension: 'dae',
	compile(options = 0) {
		let scope = this;
		let geometries = [];
		let root = [];
		let effects = [];
		let images = [];
		let materials = [];

		let export_scale = Settings.get('model_export_scale');

		// Structure
		let model = {
			type: 'COLLADA',
			attributes: {
				xmlns: 'http://www.collada.org/2005/11/COLLADASchema',
				version: '1.4.1',
				'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
			},
			content: [
				{
					type: 'asset',
					content: [
						{
							name: 'contributor',
							content: [
								{type: 'author', content: settings.username.value || 'Blockbench user'},
								{type: 'authoring_tool', content: 'Blockbench'},
							]
						},
						{name: 'created', content: new Date().toISOString()},
						{name: 'modified', content: new Date().toISOString()},
						{name: 'unit', attributes: {name: 'meter', meter: "1.0"}},
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

		// Materials
		Texture.all.forEach((texture, i) => {
			effects.push({
				type: 'effect',
				attributes: {id: `Material_${i}-effect`},
				content: {
					type: 'profile_COMMON',
					content: [
						{
							type: 'newparam',
							attributes: {sid: `Image_${i}-surface`},
							content: {
								type: 'surface',
								attributes: {type: '2D'},
								content: {type: 'init_from', content: `Image_${i}`}
							}
						},
						{
							type: 'newparam',
							attributes: {sid: `Image_${i}-sampler`},
							content: {
								type: 'sampler2D',
								content: {type: 'source', content: `Image_${i}-surface`}
							}
						},
						{
							type: 'technique',
							attributes: {sid: 'common'},
							content: {
								type: 'lambert',
								content: [
									{type: 'emission', content: {type: 'color', attributes: {sid: 'emission'}, content: '0 0 0 1'}},
									{type: 'diffuse', content: {type: 'texture', attributes: {texture: `Image_${i}-sampler`, texcoord: 'UVMap'}}},
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
					content: `${texture.name.replace(/\.png$/, '')}.png`
				}
			})
			materials.push({
				type: 'material',
				attributes: {
					id: `Material_${i}-material`,
					name: `Material_${i}`,
				},
				content: {name: 'instance_effect', attributes: {url: `#Material_${i}-effect`}}
			})
		})

		// Cube Geometry
		const cube_face_normals = {
			north: [0, 0, -1],
			east: [1, 0, 0],
			south: [0, 0, 1],
			west: [-1, 0, 0],
			up: [0, 1, 0],
			down: [0, -1, 0],
		}
		Cube.all.forEach(cube => {

			let positions = [];
			let normals = [];
			let uv = [];
			let vcount = [];
			let primitive = [];

			function addPosition(x, y, z) {
				positions.push(
					(x - cube.origin[0]) / export_scale,
					(y - cube.origin[1]) / export_scale,
					(z - cube.origin[2]) / export_scale
				);
			}

			addPosition(cube.to[0]   + cube.inflate, cube.to[1] +	cube.inflate, cube.to[2]  	+ cube.inflate);
			addPosition(cube.to[0]   + cube.inflate, cube.to[1] +	cube.inflate, cube.from[2]  - cube.inflate);
			addPosition(cube.to[0]   + cube.inflate, cube.from[1] -	cube.inflate, cube.to[2]  	+ cube.inflate);
			addPosition(cube.to[0]   + cube.inflate, cube.from[1] -	cube.inflate, cube.from[2]  - cube.inflate);
			addPosition(cube.from[0] - cube.inflate, cube.to[1] +	cube.inflate, cube.from[2]  - cube.inflate);
			addPosition(cube.from[0] - cube.inflate, cube.to[1] +	cube.inflate, cube.to[2]  	+ cube.inflate);
			addPosition(cube.from[0] - cube.inflate, cube.from[1] -	cube.inflate, cube.from[2]  - cube.inflate);
			addPosition(cube.from[0] - cube.inflate, cube.from[1] -	cube.inflate, cube.to[2]  	+ cube.inflate);

			for (let fkey in cube.faces) {
				let face = cube.faces[fkey];
				if (face.texture === null) continue;
				normals.push(...cube_face_normals[fkey]);

				let uv_outputs = [
					[face.uv[0] / Project.texture_width, 1 - face.uv[1] / Project.texture_height],
					[face.uv[2] / Project.texture_width, 1 - face.uv[1] / Project.texture_height],
					[face.uv[2] / Project.texture_width, 1 - face.uv[3] / Project.texture_height],
					[face.uv[0] / Project.texture_width, 1 - face.uv[3] / Project.texture_height],
				];
				var rot = face.rotation || 0;
				while (rot > 0) {
					uv_outputs.splice(0, 0, uv_outputs.pop());
					rot -= 90;
				}
				uv_outputs.forEach(coord => {
					uv.push(...coord);
				})

				vcount.push(4);
				let vertices;
				switch (fkey) {
					case 'north': 	vertices = [1, 4, 6, 3]; break;
					case 'east': 	vertices = [0, 1, 3, 2]; break;
					case 'south': 	vertices = [5, 0, 2, 7]; break;
					case 'west': 	vertices = [4, 5, 7, 6]; break;
					case 'up': 		vertices = [4, 1, 0, 5]; break;
					case 'down': 	vertices = [7, 2, 3, 6]; break;
				}
				primitive.push(
					vertices[3], (normals.length/3)-1, vcount.length*4 - 1,
					vertices[2], (normals.length/3)-1, vcount.length*4 - 2,
					vertices[1], (normals.length/3)-1, vcount.length*4 - 3,
					vertices[0], (normals.length/3)-1, vcount.length*4 - 4,
				)
			}

			let geometry = {
				type: 'geometry',
				attributes: {
					id: `${cube.uuid}-mesh`,
					name: cube.name
				},
				content: {
					type: 'mesh',
					content: [
						{
							type: 'source',
							attributes: {id: `${cube.uuid}-mesh-positions`},
							content: [
								{
									type: 'float_array',
									attributes: {id: `${cube.uuid}-mesh-positions-array`, count: positions.length},
									content: arrangeArray(positions)
								},
								{
									type: 'technique_common',
									content: {
										type: 'accessor',
										attributes: {source: `#${cube.uuid}-mesh-positions-array`, count: positions.length/3, stride: 3},
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
									attributes: {id: `${cube.uuid}-mesh-normals-array`, count: normals.length},
									content: arrangeArray(normals)
								},
								{
									type: 'technique_common',
									content: {
										type: 'accessor',
										attributes: {source: `#${cube.uuid}-mesh-normals-array`, count: normals.length/3, stride: 3},
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
									attributes: {id: `${cube.uuid}-mesh-map-0-array`, count: uv.length},
									content: arrangeArray(uv)
								},
								{
									type: 'technique_common',
									content: {
										type: 'accessor',
										attributes: {source: `#${cube.uuid}-mesh-map-0-array`, count: uv.length/2, stride: 2},
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
									attributes: {semantic: 'POSITION', source: `#${cube.uuid}-mesh-positions`}
								}
							]
						}
					]
				}
			}

			let j = 0;
			let last_tex;
			let render_groups = [];
			for (let fkey in cube.faces) {
				let face = cube.faces[fkey];
				if (face.texture !== null) {
					let vcount_here = vcount[j];
					let p_here = primitive.slice(j * 12, j * 12 + 12);
					if (last_tex && face.texture === last_tex) {
						render_groups.last().vcount.push(vcount_here);
						render_groups.last().primitive.push(...p_here);

					} else {
						render_groups.push({
							texture: face.getTexture(),
							vcount: [vcount_here],
							primitive: p_here,
						})
						last_tex = face.texture;
					}
					j++;
				}
			}
			render_groups.forEach(render_group => {
				geometry.content.content.push({
					type: 'polylist',
					attributes: {
						material: `Material_${Texture.all.indexOf(render_group.texture)}-material`,
						count: 6
					},
					content: [
						{type: 'input', attributes: {semantic: 'VERTEX', source: `#${cube.uuid}-mesh-vertices`, offset: 0}},
						{type: 'input', attributes: {semantic: 'NORMAL', source: `#${cube.uuid}-mesh-normals`, offset: 1}},
						{type: 'input', attributes: {semantic: 'TEXCOORD', source: `#${cube.uuid}-mesh-map-0`, offset: 2, set: 0}},
						{type: 'vcount', content: arrangeArray(render_group.vcount)},
						{type: 'p', content: arrangeArray(render_group.primitive)}
					]
				})
			})

			geometries.push(geometry);
		})

		// Mesh Geo
		Mesh.all.forEach(mesh => {

			let positions = [];
			let normals = [];
			let uv = [];
			let vertex_keys = [];

			function addPosition(x, y, z) {
				positions.push(x/export_scale, y/export_scale, z/export_scale);
			}

			for (let vkey in mesh.vertices) {
				addPosition(...mesh.vertices[vkey]);
				vertex_keys.push(vkey);
			}

			let texture;

			
			let j = 0;
			let last_tex;
			let render_groups = [];
			let primitive_count = 0;
			for (let key in mesh.faces) {
				if (mesh.faces[key].vertices.length >= 3) {
					let face = mesh.faces[key];
					let vertices = face.getSortedVertices();
					let tex = mesh.faces[key].getTexture();

					vertices.forEach(vkey => {
						uv.push(face.uv[vkey][0] / Project.texture_width, 1 - face.uv[vkey][1] / Project.texture_height);
					})

					normals.push(...face.getNormal(true));
					
					let face_primitives = [];
					vertices.forEach((vkey, vi) => {
						face_primitives.push(
							vertex_keys.indexOf(vkey),
							(normals.length/3)-1,
							(uv.length/2)-vertices.length+vi,
						)
					})

					if (last_tex && face.texture === last_tex) {
						render_groups.last().vcount.push(vertices.length);
						render_groups.last().primitive.push(...face_primitives);

					} else {
						render_groups.push({
							texture: face.getTexture(),
							vcount: [vertices.length],
							primitive: face_primitives,
						})
						last_tex = face.texture;
					}
					primitive_count += face.vertices.length;
					i++;
				}
			}

			let geometry = {
				type: 'geometry',
				attributes: {
					id: `${mesh.uuid}-mesh`,
					name: mesh.name
				},
				content: {
					type: 'mesh',
					content: [
						{
							type: 'source',
							attributes: {id: `${mesh.uuid}-mesh-positions`},
							content: [
								{
									type: 'float_array',
									attributes: {id: `${mesh.uuid}-mesh-positions-array`, count: positions.length},
									content: arrangeArray(positions)
								},
								{
									type: 'technique_common',
									content: {
										type: 'accessor',
										attributes: {source: `#${mesh.uuid}-mesh-positions-array`, count: positions.length/3, stride: 3},
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
							attributes: {id: `${mesh.uuid}-mesh-normals`},
							content: [
								{
									type: 'float_array',
									attributes: {id: `${mesh.uuid}-mesh-normals-array`, count: normals.length},
									content: arrangeArray(normals)
								},
								{
									type: 'technique_common',
									content: {
										type: 'accessor',
										attributes: {source: `#${mesh.uuid}-mesh-normals-array`, count: normals.length/3, stride: 3},
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
							attributes: {id: `${mesh.uuid}-mesh-map-0`},
							content: [
								{
									type: 'float_array',
									attributes: {id: `${mesh.uuid}-mesh-map-0-array`, count: uv.length},
									content: arrangeArray(uv)
								},
								{
									type: 'technique_common',
									content: {
										type: 'accessor',
										attributes: {source: `#${mesh.uuid}-mesh-map-0-array`, count: uv.length/2, stride: 2},
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
							attributes: {id: `${mesh.uuid}-mesh-vertices`},
							content: [
								{
									type: 'input',
									attributes: {semantic: 'POSITION', source: `#${mesh.uuid}-mesh-positions`}
								}
							]
						}
					]
				}
			}

			render_groups.forEach(render_group => {
				geometry.content.content.push({
					type: 'polylist',
					attributes: {
						material: `Material_${Texture.all.indexOf(render_group.texture)}-material`,
						count: 6
					},
					content: [
						{type: 'input', attributes: {semantic: 'VERTEX', source: `#${mesh.uuid}-mesh-vertices`, offset: 0}},
						{type: 'input', attributes: {semantic: 'NORMAL', source: `#${mesh.uuid}-mesh-normals`, offset: 1}},
						{type: 'input', attributes: {semantic: 'TEXCOORD', source: `#${mesh.uuid}-mesh-map-0`, offset: 2, set: 0}},
						{type: 'vcount', content: arrangeArray(render_group.vcount)},
						{type: 'p', content: arrangeArray(render_group.primitive)}
					]
				})
			})

			geometries.push(geometry);
		})

		// Object Hierarchy
		function processNode(node) {
			let position = node.origin.slice();
			if (node.parent instanceof Group) position.V3_subtract(node.parent.origin);

			let tag = {
				name: 'node',
				attributes: {
					id: node.uuid,
					name: node.name,
					type: 'NODE'
				},
				content: [
					{type: 'scale', attributes: {sid: 'scale'}, content: '1 1 1'},
					{type: 'translate', attributes: {sid: 'location'}, content: position.V3_divide(export_scale).join(' ')},
				]
			}
			if (node.rotatable) {
				tag.content.push(
					{type: 'rotate', attributes: {sid: 'rotationZ'}, content: `0 0 1 ${node.rotation[2]}`},
					{type: 'rotate', attributes: {sid: 'rotationY'}, content: `0 1 0 ${node.rotation[1]}`},
					{type: 'rotate', attributes: {sid: 'rotationX'}, content: `1 0 0 ${node.rotation[0]}`},
				)
			}
			if (node instanceof Cube || node instanceof Mesh) {
				let textures = [];
				for (let fkey in node.faces) {
					let tex = node.faces[fkey].getTexture();
					if (tex instanceof Texture) textures.safePush(tex);
				}
				tag.content.push({
					type: 'instance_geometry',
					attributes: {url: `#${node.uuid}-mesh`, name: node.name},
					content: {
						name: 'bind_material',
						content: {
							name: 'technique_common',
							content: textures.map(tex => {
								let index = Texture.all.indexOf(tex);
								return {
									name: 'instance_material',
									attributes: {symbol: `Material_${index}-material`, target: `#Material_${index}-material`},
									content: {
										name: 'bind_vertex_input',
										attributes: {semantic: 'UVMap', input_semantic: 'TEXCOORD', input_set: '0'}
									}
								}
							})
						}
					}
				});
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

		
		let compiled_animations = Codecs.gltf.buildAnimationTracks(false);
		if (compiled_animations.length) {
			let animations_tag = {
				type: 'library_animations',
				content: []
			}
			let animation_clips_tag = {
				type: 'library_animation_clips',
				content: []
			}

			let animators = {};
			let time_offset = 0;

			compiled_animations.forEach(anim_obj => {
				if (anim_obj.duration < 0.01) return;
				
				anim_obj.tracks.forEach(track => {
					if (!animators[track.group_uuid]) animators[track.group_uuid] = {}
					if (!animators[track.group_uuid][track.channel]) {
						animators[track.group_uuid][track.channel] = {
							animations_added: [],
							times: [],
						}
					}
				});
			});

			compiled_animations.forEach((anim_obj, anim_i) => {
				if (anim_obj.duration < 0.01) return;
				
				anim_obj.tracks.forEach(track => {

					let track_channel = animators[track.group_uuid][track.channel];
					track_channel.times.push(...track.times.map(t => t + time_offset));
					track_channel.animations_added.push(anim_i);

					let add_keyframe_at_end = track.times[track.times.length-1] - anim_obj.duration <= 0.1;
					if (add_keyframe_at_end) track_channel.times.push(anim_obj.duration + time_offset);
					
					if (track.channel == 'rotation') {
						if (!track_channel.values) track_channel.values = {};
						['X', 'Y', 'Z'].forEach((axis, axis_i) => {
							if (!track_channel.values[axis]) track_channel.values[axis] = [];
							let axis_values = track.values.filter((v, i) => {
								return i % 3 == axis_i;
							}).map(v => Math.radToDeg(v));
							track_channel.values[axis].push(...axis_values);
							if (add_keyframe_at_end) {
								track_channel.values[axis].push(...track_channel.values[axis].slice(-1));
							}
						})
					} else {
						if (!track_channel.values) track_channel.values = [];
						track_channel.values.push(...track.values);
						if (add_keyframe_at_end) {
							track_channel.values.push(...track_channel.values.slice(-3));
						}
					}
				})

				for (let uuid in animators) {
					let group = Group.all.find(group => group.uuid == uuid);
					
					for (let channel in animators[uuid]) {
						let track_channel = animators[uuid][channel];
						if (track_channel.animations_added.includes(anim_i)) {
							continue;
						} else {
							track_channel.times.push(time_offset, time_offset+anim_obj.duration);

							if (channel == 'rotation') {
								if (!track_channel.values) track_channel.values = {};
								['X', 'Y', 'Z'].forEach((axis, axis_i) => {
									if (!track_channel.values[axis]) track_channel.values[axis] = [];
									track_channel.values[axis].push(0, 0);
								})
							} else if (channel == 'scale') {
								if (!track_channel.values) track_channel.values = [];
								track_channel.values.push(1, 1, 1, 1, 1, 1);
							} else {
								if (!track_channel.values) track_channel.values = [];
								let pos = group.origin.slice();
								if (group.parent instanceof Group) pos.V3_subtract(group.parent.origin);
								pos.V3_divide(export_scale);
								track_channel.values.push(...pos, ...pos);
							}
						}
					}
				}

				let animation_clip_tag = {
					type: 'animation_clip',
					attributes: {
						id: anim_obj.name,
						name: anim_obj.name,
						start: time_offset,
						end: time_offset + anim_obj.duration
					},
					/*
					content: [
						{type: 'instance_animation', attributes: {url: `#animation-${anim_obj.name}`}}
					]*/
				}
				time_offset += anim_obj.duration + 0.01;
				animation_clips_tag.content.push(animation_clip_tag)
			})

			for (let group_uuid in animators) {
				let anim_tag = {
					type: 'animation',
					attributes: {
						id: `animation-${group_uuid}`,
						name: group_uuid
					},
					content: []
				}
				for (let channel in animators[group_uuid]) {
					let track = animators[group_uuid][channel];
					let group = OutlinerNode.uuids[group_uuid];
					let collada_channel = channel;
					if (collada_channel == 'position') collada_channel = 'location';
					if (collada_channel == 'rotation') collada_channel = 'rotation_euler';
					let track_name = `${group.name}_${collada_channel}`

					let track_tag = {
						type: 'animation',
						attributes: {id: `${track_name}`, name: track_name},
						content: [
							{
								type: 'source',
								attributes: {id: track_name+'-input'},
								content: [
									{
										type: 'float_array',
										attributes: {id: track_name+'-input-array', count: track.times.length},
										content: arrangeArray(track.times)
									},
									{
										type: 'technique_common',
										content: {
											type: 'accessor',
											attributes: {source: '#'+track_name+'-input-array', count: track.times.length, stride: 1},
											content: {type: 'param', attributes: {name: 'TIME', type: 'float'}}
										}
									}
								]
							},
						]
					}
					if (channel == 'rotation') {
						['X', 'Y', 'Z'].forEach((axis, axis_i) => {
							let axis_values = track.values[axis];
							track_tag.content.push(
								{
									type: 'source',
									attributes: {id: track_name+'_'+axis+'-output'},
									content: [
										{
											type: 'float_array',
											attributes: {id: track_name+'_'+axis+'-output-array', count: axis_values.length},
											content: arrangeArray(axis_values)
										},
										{
											type: 'technique_common',
											content: {
												type: 'accessor',
												attributes: {source: '#'+track_name+'_'+axis+'-output-array', count: axis_values.length, stride: 1},
												content: [
													{type: 'param', attributes: {name: 'ANGLE', type: 'float'}},
												]
											}
										}
									]
								},
								{
									type: 'sampler',
									attributes: {id: `${track_name+'_'+axis}-sampler`},
									content: [
										{type: 'input', attributes: {semantic: 'INPUT', source: '#'+track_name+'-input'}},
										{type: 'input', attributes: {semantic: 'OUTPUT', source: '#'+track_name+'_'+axis+'-output'}},
										//{type: 'input', attributes: {semantic: 'INTERPOLATION', source: '#'+track_name+'-interpolation'}},
									]
								},
								{
									type: 'channel',
									attributes: {source: `#${track_name+'_'+axis}-sampler`, target: `${group.uuid}/rotation${axis}.ANGLE`}
								}
							)
						})
					} else {
						track_tag.content.push(
							{
								type: 'source',
								attributes: {id: track_name+'-output'},
								content: [
									{
										type: 'float_array',
										attributes: {id: track_name+'-output-array', count: track.values.length},
										content: arrangeArray(track.values)
									},
									{
										type: 'technique_common',
										content: {
											type: 'accessor',
											attributes: {source: '#'+track_name+'-output-array', count: track.values.length, stride: 3},
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
								type: 'sampler',
								attributes: {id: `${track_name}-sampler`},
								content: [
									{type: 'input', attributes: {semantic: 'INPUT', source: '#'+track_name+'-input'}},
									{type: 'input', attributes: {semantic: 'OUTPUT', source: '#'+track_name+'-output'}},
									//{type: 'input', attributes: {semantic: 'INTERPOLATION', source: '#'+track_name+'-interpolation'}},
								]
							},
							{
								type: 'channel',
								attributes: {source: `#${track_name}-sampler`, target: `${group.uuid}/${collada_channel}`}
							}
						)
					}
					anim_tag.content.push(track_tag)
				}

				animations_tag.content.push(anim_tag)
			}
			
			model.content.push(animations_tag);
			model.content.push(animation_clips_tag);
		}

		scope.dispatchEvent('compile', {model, options});
		

		if (options.raw) {
			return model
		} else {
			return compileXML(model)
		}
	},
	write(content, path) {
		var scope = this;

		content = this.compile();
		Blockbench.writeFile(path, {content}, path => scope.afterSave(path));

		Texture.all.forEach(tex => {
			if (tex.error) return;
			var name = tex.name;
			if (name.substr(-4).toLowerCase() !== '.png') {
				name += '.png';
			}
			var image_path = path.split(osfs);
			image_path.splice(-1, 1, name);
			Blockbench.writeFile(image_path.join(osfs), {
				content: tex.source,
				savetype: 'image'
			})
		})
	},
	export() {
		var scope = this;
		if (isApp) {
			Blockbench.export({
				resource_id: 'dae',
				type: this.name,
				extensions: [this.extension],
				startpath: this.startPath(),
				content: this.compile(),
				name: this.fileName(),
				custom_writer: (a, b) => scope.write(a, b),
			}, path => this.afterDownload(path))

		} else {
			var archive = new JSZip();
			var content = this.compile()

			archive.file((Project.name||'model')+'.dae', content)

			Texture.all.forEach(tex => {
				if (tex.error) return;
				var name = tex.name;
				if (name.substr(-4).toLowerCase() !== '.png') {
					name += '.png';
				}
				archive.file(name, tex.source.replace('data:image/png;base64,', ''), {base64: true});
			})
			archive.generateAsync({type: 'blob'}).then(content => {
				Blockbench.export({
					type: 'Zip Archive',
					extensions: ['zip'],
					name: 'assets',
					content: content,
					savetype: 'zip'
				}, path => scope.afterDownload(path));
			})
		}
	}
})

BARS.defineActions(function() {
	codec.export_action = new Action({
		id: 'export_collada',
		icon: 'icon-collada',
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
				if (typeof node == 'object') handleObject(node);
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
