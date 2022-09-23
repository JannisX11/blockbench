(function() {

function arrangeArray(array) {
	return array.map(v => Math.roundTo(v, 6)).join(' ');
}


var codec = new Codec('fbx', {
	name: 'FBX Model',
	extension: 'fbx',
	compile(options = 0) {
		let scope = this;
		let model = [
			'; FBX 6.1.0 project file',
			'; Created by Blockbench FBX Exporter',
			'; ----------------------------------------------------',
			'; ',
			'',
			'',
		].join('\n');

		function formatFBXComment(comment) {
			return '\n; ' + comment.split(/\n/g).join('\n; ')
				+ '\n;------------------------------------------------------------------\n\n';
		}

		// FBXHeaderExtension
		let date = new Date();
		model += compileASCIIFBXSection({
			FBXHeaderExtension: {
				FBXHeaderVersion: 1003,
				FBXVersion: 7300,
				CreationTimeStamp: {
					Version: 1000,
					Year: 1900 + date.getYear(),
					Month: date.getMonth()+1,
					Day: date.getDate(),
					Hour: date.getHours(),
					Minute: date.getMinutes(),
					Second: date.getSeconds(),
					Millisecond: date.getMilliseconds()
				},
				Creator: 'FBX SDK/FBX Plugins build 20070228',
				OtherFlags: {
					FlagPLE: 0
				}
			},
			CreationTime: "2014-03-20 17:38:29:000",
			Creator: 'Blockbench '+Blockbench.version,
		})

		model += compileASCIIFBXSection({
			GlobalSettings: {
				Version: 1000,
				Properties60: {
					Property: ["UpAxis", "int", "",1],
					Property: ["UpAxisSign", "int", "",1],
					Property: ["FrontAxis", "int", "",2],
					Property: ["FrontAxisSign", "int", "",1],
					Property: ["CoordAxis", "int", "",0],
					Property: ["CoordAxisSign", "int", "",1],
					Property: ["UnitScaleFactor", "double", "",1],
				}
			}
		});

		// Object definitions
		model += formatFBXComment('Object definitions');

		model += compileASCIIFBXSection({
			Definitions: {
				Version: 100,
				Count: 3,
				ot1: {
					_key: 'ObjectType',
					_values: ["Model"],
					Count: 1
				},
				ot2: {
					_key: 'ObjectType',
					_values: ["Geometry"],
					Count: 1
				},
				ot3: {
					_key: 'ObjectType',
					_values: ["Material"],
					Count: 1
				},
				ot4: {
					_key: 'ObjectType',
					_values: ["Pose"],
					Count: 1
				},
				ot5: {
					_key: 'ObjectType',
					_values: ["GlobalSettings"],
					Count: 1
				}
			}
		})

		// Object properties
		let Objects = {};
		model += formatFBXComment('Object properties');

		// Cube Geometry
		/*const cube_face_normals = {
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
				positions.push((x - cube.origin[0]) / 16, (y - cube.origin[1]) / 16, (z - cube.origin[2]) / 16);
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
		})*/

		// Mesh Geo
		Mesh.all.forEach(mesh => {

			let positions = [];
			let normals = [];
			let uv = [];
			let vertex_keys = [];
			let indices = [];
			let uv_indices = [];

			function addPosition(x, y, z) {
				positions.push(x/16, y/16, z/16);
			}

			for (let vkey in mesh.vertices) {
				addPosition(...mesh.vertices[vkey]);
				vertex_keys.push(vkey);
			}

	
			for (let key in mesh.faces) {
				if (mesh.faces[key].vertices.length >= 3) {
					let face = mesh.faces[key];
					let vertices = face.getSortedVertices();
					let tex = mesh.faces[key].getTexture();

					vertices.forEach(vkey => {
						uv.push(face.uv[vkey][0] / Project.texture_width, 1 - face.uv[vkey][1] / Project.texture_height);
					})

					normals.push(...face.getNormal(true));
					
					vertices.forEach((vkey, vi) => {
						let index = vertex_keys.indexOf(vkey);
						if (vi+1 == vertices.length) index = -1 -index;
						indices.push(index);
					})
					i++;
				}
			}


			let mesh_model = {
				_key: 'Model',
				_values: [`Model::${mesh.name}`, 'Mesh'],
				Version: 232,
				Properties60:  {
					P01: {_key: 'Property', _values: ["QuaternionInterpolate", "bool", "",0]},
					P02: {_key: 'Property', _values: ["Visibility", "Visibility", "A+", mesh.visibility ? 1 : 0]},
					P03: {_key: 'Property', _values: ["Lcl Translation", "Lcl Translation", "A+", ...mesh.origin]},
					P04: {_key: 'Property', _values: ["Lcl Rotation", "Lcl Rotation", "A+", ...mesh.rotation]},
					P05: {_key: 'Property', _values: ["Lcl Scaling", "Lcl Scaling", "A+", 1, 1, 1]},
					P06: {_key: 'Property', _values: ["RotationOffset", "Vector3D", "",0,0,0]},
					P07: {_key: 'Property', _values: ["RotationPivot", "Vector3D", "",0,0,0]},
					P08: {_key: 'Property', _values: ["ScalingOffset", "Vector3D", "",0,0,0]},
					P09: {_key: 'Property', _values: ["ScalingPivot", "Vector3D", "",0,0,0]},
					P10: {_key: 'Property', _values: ["TranslationActive", "bool", "",0]},
					P11: {_key: 'Property', _values: ["TranslationMin", "Vector3D", "",0,0,0]},
					P12: {_key: 'Property', _values: ["TranslationMax", "Vector3D", "",0,0,0]},
					P13: {_key: 'Property', _values: ["TranslationMinX", "bool", "",0]},
					P14: {_key: 'Property', _values: ["TranslationMinY", "bool", "",0]},
					P15: {_key: 'Property', _values: ["TranslationMinZ", "bool", "",0]},
					P16: {_key: 'Property', _values: ["TranslationMaxX", "bool", "",0]},
					P17: {_key: 'Property', _values: ["TranslationMaxY", "bool", "",0]},
					P18: {_key: 'Property', _values: ["TranslationMaxZ", "bool", "",0]},
					P19: {_key: 'Property', _values: ["RotationOrder", "enum", "",0]},
					P20: {_key: 'Property', _values: ["RotationSpaceForLimitOnly", "bool", "",0]},
					P21: {_key: 'Property', _values: ["AxisLen", "double", "",10]},
					P22: {_key: 'Property', _values: ["PreRotation", "Vector3D", "",0,0,0]},
					P23: {_key: 'Property', _values: ["PostRotation", "Vector3D", "",0,0,0]},
					P24: {_key: 'Property', _values: ["RotationActive", "bool", "",0]},
					P25: {_key: 'Property', _values: ["RotationMin", "Vector3D", "",0,0,0]},
					P26: {_key: 'Property', _values: ["RotationMax", "Vector3D", "",0,0,0]},
					P27: {_key: 'Property', _values: ["RotationMinX", "bool", "",0]},
					P28: {_key: 'Property', _values: ["RotationMinY", "bool", "",0]},
					P29: {_key: 'Property', _values: ["RotationMinZ", "bool", "",0]},
					P30: {_key: 'Property', _values: ["RotationMaxX", "bool", "",0]},
					P31: {_key: 'Property', _values: ["RotationMaxY", "bool", "",0]},
					P32: {_key: 'Property', _values: ["RotationMaxZ", "bool", "",0]},
					P33: {_key: 'Property', _values: ["RotationStiffnessX", "double", "",0]},
					P34: {_key: 'Property', _values: ["RotationStiffnessY", "double", "",0]},
					P35: {_key: 'Property', _values: ["RotationStiffnessZ", "double", "",0]},
					P36: {_key: 'Property', _values: ["MinDampRangeX", "double", "",0]},
					P37: {_key: 'Property', _values: ["MinDampRangeY", "double", "",0]},
					P38: {_key: 'Property', _values: ["MinDampRangeZ", "double", "",0]},
					P39: {_key: 'Property', _values: ["MaxDampRangeX", "double", "",0]},
					P40: {_key: 'Property', _values: ["MaxDampRangeY", "double", "",0]},
					P41: {_key: 'Property', _values: ["MaxDampRangeZ", "double", "",0]},
					P42: {_key: 'Property', _values: ["MinDampStrengthX", "double", "",0]},
					P43: {_key: 'Property', _values: ["MinDampStrengthY", "double", "",0]},
					P44: {_key: 'Property', _values: ["MinDampStrengthZ", "double", "",0]},
					P45: {_key: 'Property', _values: ["MaxDampStrengthX", "double", "",0]},
					P46: {_key: 'Property', _values: ["MaxDampStrengthY", "double", "",0]},
					P47: {_key: 'Property', _values: ["MaxDampStrengthZ", "double", "",0]},
					P48: {_key: 'Property', _values: ["PreferedAngleX", "double", "",0]},
					P49: {_key: 'Property', _values: ["PreferedAngleY", "double", "",0]},
					P50: {_key: 'Property', _values: ["PreferedAngleZ", "double", "",0]},
					P51: {_key: 'Property', _values: ["InheritType", "enum", "",0]},
					P52: {_key: 'Property', _values: ["ScalingActive", "bool", "",0]},
					P53: {_key: 'Property', _values: ["ScalingMin", "Vector3D", "",1,1,1]},
					P54: {_key: 'Property', _values: ["ScalingMax", "Vector3D", "",1,1,1]},
					P55: {_key: 'Property', _values: ["ScalingMinX", "bool", "",0]},
					P56: {_key: 'Property', _values: ["ScalingMinY", "bool", "",0]},
					P57: {_key: 'Property', _values: ["ScalingMinZ", "bool", "",0]},
					P58: {_key: 'Property', _values: ["ScalingMaxX", "bool", "",0]},
					P59: {_key: 'Property', _values: ["ScalingMaxY", "bool", "",0]},
					P60: {_key: 'Property', _values: ["ScalingMaxZ", "bool", "",0]},
					P61: {_key: 'Property', _values: ["GeometricTranslation", "Vector3D", "",0,0,0]},
					P62: {_key: 'Property', _values: ["GeometricRotation", "Vector3D", "",0,0,0]},
					P63: {_key: 'Property', _values: ["GeometricScaling", "Vector3D", "",1,1,1]},
					P64: {_key: 'Property', _values: ["LookAtProperty", "object", ""]},
					P65: {_key: 'Property', _values: ["UpVectorProperty", "object", ""]},
					P66: {_key: 'Property', _values: ["Show", "bool", "",1]},
					P67: {_key: 'Property', _values: ["NegativePercentShapeSupport", "bool", "",1]},
					P68: {_key: 'Property', _values: ["DefaultAttributeIndex", "int", "",0]},
					P69: {_key: 'Property', _values: ["Color", "Color", "A",0.8,0.8,0.8]},
					P70: {_key: 'Property', _values: ["Size", "double", "",100]},
					P71: {_key: 'Property', _values: ["Look", "enum", "",1]},
				},
				MultiLayer: 0,
				MultiTake: 1,
				Shading: 'Y',
				Culling: "CullingOff",

				Vertices: positions,
				PolygonVertexIndex: indices,
				GeometryVersion: [124],
				LayerElementNormal: {
					_values: [0],
					Version: 101,
					Name: "",
					MappingInformationType: "ByPolygon",
					ReferenceInformationType: "Direct",
					Normals: normals,
				},
				LayerElementSmoothing: {
					_values: [0],
					Version: 102,
					Name: "",
					MappingInformationType: "ByPolygon",
					ReferenceInformationType: "Direct",
					Smoothing: 1,
				},
				LayerElementUV: {
					_values: [0],
					Version: 101,
					Name: "UVMap",
					MappingInformationType: "ByPolygonVertex",
					ReferenceInformationType: "IndexToDirect",
					UV: uv,
					UVIndex: uv_indices,
				},
				LayerElementTexture: {
					_values: [0],
					Version: 101,
					Name: "",
					MappingInformationType: "NoMappingInformation",
					ReferenceInformationType: "IndexToDirect",
					BlendMode: "Translucent",
					TextureAlpha: 1,
					TextureId: []
				},
				LayerElementMaterial: {
					_values: [0],
					Version: 101,
					Name: "",
					MappingInformationType: "AllSame",
					ReferenceInformationType: "IndexToDirect",
					Materials: 0,
				},
				Layer: {
					_values: [0],
					Version: 100,
					LayerElement:  {
						Type: "LayerElementNormal",
						TypedIndex: 0
					},
					LayerElement:  {
						Type: "LayerElementSmoothing",
						TypedIndex: 0
					},
					LayerElement:  {
						Type: "LayerElementUV",
						TypedIndex: 0
					},
					LayerElement:  {
						Type: "LayerElementTexture",
						TypedIndex: 0
					},
					LayerElement:  {
						Type: "LayerElementMaterial",
						TypedIndex: 0
					}
				}
			};
			Objects[mesh.uuid] = mesh_model;

		})
		Objects.Pose = {
			_values: ["Pose::BIND_POSES", "BindPose"],
			Type: "BindPose",
			Version: 100,
			Properties60: {},
			NbPoseNodes: 1,
			PoseNode:  {
				Node: "Model::Rock_Medium_SPR",
				Matrix: [0.000000075497901,1.000000000000000,0.000000162920685,0.000000000000000,-1.000000000000000,0.000000075497901,0.000000000000012,0.000000000000000,0.000000000000000,-0.000000162920685,1.000000000000000,0.000000000000000,0.000000000000000,0.000000000000000,-534.047119140625000,1.000000000000000],
			}
		};

		model += compileASCIIFBXSection({
			Objects,
			/*Objects: {
				Model: {
					_values: ['Name', 'Mesh'],
					Vertices: [],
					PolygonVertexIndex: [],
					LayerElementNormal: [],
					LayerElementUV: []
				},
				Material: {
					_values: ['Name', '']
				},
				Pose: {},
				GlobalSettings: {},
			}*/
		});

		// Object relations
		model += compileASCIIFBXSection({
			Relations: {
				Model: {},
				Material: {},
				Pose: {},
				GlobalSettings: {},
			}
		});

		// Object connections
		model += `\nConnections:  {\n\n`;
		let root = {name: 'RootNode', uuid: 0};
		[...Group.all, ...Outliner.elements].forEach(node => {
			let parent = node.parent == 'root' ? root : node.parent;
			model += `Model::${node.name}, Model::${parent.name}}\n\tC: "OO",${node.uuid},${parent.uuid}\n`;

			if (node instanceof Mesh || node instanceof Cube) {
				// Material
			}
		})
		model += `}\n`;

		// Takes
		model += formatFBXComment('Takes');
		model += compileASCIIFBXSection({
			Takes: {
				Current: ''
			}
		})

		// Version5
		/*model += compileASCIIFBXSection({
			Version5:  {
				AmbientRenderSettings:  {
					Version: 101,
					AmbientLightColor: [0.0,0.0,0.0,0]
				},
				FogOptions:  {
					FogEnable: 0,
					FogMode: 0,
					FogDensity: 0.000,
					FogStart: 5.000,
					FogEnd: 25.000,
					FogColor: [0.1,0.1,0.1,1]
				},
				Settings:  {
					FrameRate: "24",
					TimeFormat: 1,
					SnapOnFrames: 0,
					ReferenceTimeIndex: -1,
					TimeLineStartTime: 0,
					TimeLineStopTime: 479181389250,
				},
				RendererSetting:  {
					DefaultCamera: "Producer Perspective",
					DefaultViewingMode: 0
				}
			}
		})*/


		scope.dispatchEvent('compile', {model, options});
		
		return model;
	},
	write(content, path) {
		var scope = this;

		content = this.compile();
		Blockbench.writeFile(path, {content}, path => scope.afterSave(path));

		Texture.all.forEach(tex => {
			if (tex.error == 1) return;
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
				resource_id: 'fbx',
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

			archive.file((Project.name||'model')+'.fbx', content)

			Texture.all.forEach(tex => {
				if (tex.error == 1) return;
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
		id: 'export_fbx',
		icon: 'fas.fa-cube',
		category: 'file',
		click: function () {
			codec.export()
		}
	})
})

})()

function compileASCIIFBXSection(object) {
	let depth = 0;
	function indent() {
		let spaces = '';
		for (let i = 0; i < depth; i++) {
			spaces += '\t';
		}
		return spaces;
	}

	function handleValue(value) {
		if (typeof value == 'string') return '"' + value + '"';
		return value;
	}
	function handleObjectChildren(parent) {
		let output = '';
		for (let key in parent) {
			if (typeof key == 'string' && key.startsWith('_')) continue;
			let object = parent[key];
			if (object._key) key = object._key;

			let values = '';
			if (object instanceof Array) {
				values = object.map(handleValue).join(', ');
			} else if (typeof object !== 'object') {
				values = handleValue(object);
			} else if (object._values) {
				values = object._values.map(handleValue).join(', ');
			}

			output += `${indent()}${key}: ${values}`;

			let content;
			if (typeof object == 'object' && object instanceof Array == false) {
				depth++;
				content = handleObjectChildren(object);
				depth--;
			}
			if (content) {
				output += ` {\n${content}${indent()}}\n`;
			} else {
				output += '\n';
			}
		}
		return output;
	}
	return handleObjectChildren(object);
}
