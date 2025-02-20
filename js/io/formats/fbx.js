(function() {

const _FBX_VERSION = 7300;

/**
 * Wraps a number to include the type
 * @param {('I'|'D'|'F'|'L'|'C'|'Y')} type 
 * @param {number} value 
 */
function TNum(type, value) {
	return {type, value, isTNum: true}
}

var codec = new Codec('fbx', {
	name: 'FBX Model',
	extension: 'fbx',
	support_partial_export: true,
	compile(options) {
		options = Object.assign(this.getExportOptions(), options);
		let scope = this;
		let export_scale = (options.scale||16) / 100;
		let model = [];
		model.push([
			'; FBX 7.3.0 project file',
			'; Created by the Blockbench FBX Exporter',
			'; ----------------------------------------------------',
			'; ',
			'',
			'',
		].join('\n'));

		function formatFBXComment(comment) {
			return '\n; ' + comment.split(/\n/g).join('\n; ')
				+ '\n;------------------------------------------------------------------\n\n';
		}
		let UUIDMap = {};
		function getID(uuid) {
			if (uuid == 0) return TNum('L', 0);
			if (UUIDMap[uuid]) return UUIDMap[uuid];
			let s = '';
			for (let i = 0; i < 8; i++) {
				s += Math.floor(Math.random()*10)
			}
			s[0] = '7';
			UUIDMap[uuid] = TNum('L', parseInt(s));
			return UUIDMap[uuid];
		}
		let UniqueNames = {};
		function getUniqueName(namespace, uuid, original_name) {
			if (!UniqueNames[namespace]) UniqueNames[namespace] = {};
			let names = UniqueNames[namespace];
			if (names[uuid]) return names[uuid];

			let existing_names = Object.values(names);
			if (!existing_names.includes(original_name)) {
				names[uuid] = original_name;
				return names[uuid];
			}

			let i = 1;
			while (existing_names.includes(original_name + '_' + i)) {
				i++;
			}
			names[uuid] = original_name + '_' + i;
			return names[uuid];
		}

		// FBXHeaderExtension
		let date = new Date();
		let dateString = date.toISOString().replace('T', ' ').replace('.', ':').replace('Z', '');
		let model_url = 'C:\\Users\\Blockbench\\foobar.fbx';
		model.push({
			FBXHeaderExtension: {
				FBXHeaderVersion: 1003,
				FBXVersion: _FBX_VERSION,
				EncryptionType: 0,
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
				Creator: 'Blockbench ' + Blockbench.version,
				SceneInfo: {
					_values: ['SceneInfo::GlobalInfo', "UserData"],
					Type: "UserData",
					Version: 100,
					MetaData:  {
						Version: 100,
						Title: "",
						Subject: "",
						Author: "",
						Keywords: "",
						Revision: "",
						Comment: ""
					},
					Properties70:  {
						P01: {_key: 'P', _values: ["DocumentUrl", "KString", "Url", "", model_url]},
						P02: {_key: 'P', _values: ["SrcDocumentUrl", "KString", "Url", "", model_url]},
						P03: {_key: 'P', _values: ["Original", "Compound", "", ""]},
						P04: {_key: 'P', _values: ["Original|ApplicationVendor", "KString", "", "", "Blockbench"]},
						P05: {_key: 'P', _values: ["Original|ApplicationName", "KString", "", "", "Blockbench FBX Exporter"]},
						P06: {_key: 'P', _values: ["Original|ApplicationVersion", "KString", "", "", Blockbench.version]},
						P07: {_key: 'P', _values: ["Original|DateTime_GMT", "DateTime", "", "", "01/01/1970 00:00:00.000"]},
						P08: {_key: 'P', _values: ["Original|FileName", "KString", "", "", "/foobar.fbx"]},
						P09: {_key: 'P', _values: ["LastSaved", "Compound", "", ""]},
						P10: {_key: 'P', _values: ["LastSaved|ApplicationVendor", "KString", "", "", "Blockbench"]},
						P11: {_key: 'P', _values: ["LastSaved|ApplicationName", "KString", "", "", "Blockbench FBX Exporter"]},
						P12: {_key: 'P', _values: ["LastSaved|ApplicationVersion", "KString", "", "", Blockbench.version]},
						P13: {_key: 'P', _values: ["LastSaved|DateTime_GMT", "DateTime", "", "", "01/01/1970 00:00:00.000"]},
						P14: {_key: 'P', _values: ["Original|ApplicationNativeFile", "KString", "", "", ""]},
					}
				},
			},
			FileId: "iVFoobar",
			CreationTime: dateString,
			Creator: Settings.get('credit'),
		})

		model.push({
			GlobalSettings: {
				Version: 1000,
				Properties70: {
					P01: {_key: 'P', _values: ["UpAxis", "int", "Integer", "",1]},
					P02: {_key: 'P', _values: ["UpAxisSign", "int", "Integer", "",1]},
					P03: {_key: 'P', _values: ["FrontAxis", "int", "Integer", "",2]},
					P04: {_key: 'P', _values: ["FrontAxisSign", "int", "Integer", "",1]},
					P05: {_key: 'P', _values: ["CoordAxis", "int", "Integer", "",0]},
					P08: {_key: 'P', _values: ["CoordAxisSign", "int", "Integer", "",1]},
					P09: {_key: 'P', _values: ["OriginalUpAxis", "int", "Integer", "",-1]},
					P10: {_key: 'P', _values: ["OriginalUpAxisSign", "int", "Integer", "",1]},
					P11: {_key: 'P', _values: ["UnitScaleFactor", "double", "Number", "",TNum('D', 1)]},
					P12: {_key: 'P', _values: ["OriginalUnitScaleFactor", "double", "Number", "",TNum('D', 1)]},
					P13: {_key: 'P', _values: ["AmbientColor", "ColorRGB", "Color", "",TNum('D',0),TNum('D',0),TNum('D',0)]},
					P14: {_key: 'P', _values: ["DefaultCamera", "KString", "", "", "Producer Perspective"]},
					P15: {_key: 'P', _values: ["TimeMode", "enum", "", "",0]},
					P16: {_key: 'P', _values: ["TimeSpanStart", "KTime", "Time", "",TNum('L', 0)]},
					P17: {_key: 'P', _values: ["TimeSpanStop", "KTime", "Time", "",TNum('L', 46186158000)]},
					P18: {_key: 'P', _values: ["CustomFrameRate", "double", "Number", "",TNum('D', 24)]},
				}
			}
		});

		// Documents Description
		model.push(formatFBXComment('Documents Description'));
		const uuid = BigInt(Math.floor(Math.random() * 2147483647) + 1);
		model.push({
			Documents: {
				Count: 1,
				Document: {
					_values: [TNum('L', uuid)],
					Scene: "Scene",
					Properties70: {
						P01: {_key: 'P', _values: ["SourceObject", "object", "", ""]},
						P02: {_key: 'P', _values: ["ActiveAnimStackName", "KString", "", "", ""]}
					},
					RootNode: 0
				}
			},
		})

		// Document References
		model.push(formatFBXComment('Document References'));
		model.push({
			References: {
			}
		});


		let DefinitionCounter = {
			model: 0,
			geometry: 0,
			material: 0,
			texture: 0,
			image: 0,
			animation_stack: 0,
			animation_layer: 0,
			animation_curve_node: 0,
			animation_curve: 0,
		};
		let Objects = {};
		let Connections = [];
		let Takes = {
			Current: ''
		};
		let root = {name: 'RootNode', uuid: 0};

		function getElementPos(element) {
			let arr = element.origin.slice();
			if (element.parent instanceof Group) {
				arr.V3_subtract(element.parent.origin);
			}
			return arr.V3_divide(export_scale);
		}
		function addNodeBase(node, fbx_type) {
			let unique_name = getUniqueName('object', node.uuid, node.name);
			let rotation_order = node.mesh.rotation.order == 'XYZ' ? 5 : 0;
			Objects[node.uuid] = {
				_key: 'Model',
				_values: [getID(node.uuid), `Model::${unique_name}`, fbx_type],
				Version: 232,
				Properties70: {
					P1: {_key: 'P', _values: ["RotationActive", "bool", "", "",TNum('I', 1)]},
					P2: {_key: 'P', _values: ["InheritType", "enum", "", "",1]},
					P3: {_key: 'P', _values: ["ScalingMax", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
					P4: {_key: 'P', _values: ["Lcl Translation", "Lcl Translation", "", "A", ...getElementPos(node).map(v => TNum('D', v))]},
					P5: node.rotation ? {_key: 'P', _values: ["RotationPivot", "Vector3D", "Vector", "", TNum('D',0), TNum('D',0), TNum('D',0)]} : undefined,
					P6: node.rotation ? {_key: 'P', _values: ["Lcl Rotation", "Lcl Rotation", "", "A", ...node.rotation.map(v => TNum('D', v))]} : undefined,
					P7: node.rotation ? {_key: 'P', _values: ["RotationOrder", "enum", "", "", rotation_order]} : undefined,
					P8: node.faces ? {_key: 'P', _values: ["DefaultAttributeIndex", "int", "Integer", "",0]} : undefined,
				},
				Shading: true,
				Culling: "CullingOff",
			};
			let parent = node.parent == 'root' ? root : node.parent;
			Connections.push({
				name: [`Model::${unique_name}`, `Model::${getUniqueName('object', parent.uuid, parent.name)}`],
				id: [getID(node.uuid), getID(parent.uuid)],
			});
			DefinitionCounter.model++;
			return Objects[node.uuid];
		}

		// Groups
		Group.all.forEach(group => {
			if (!group.export) return;
			addNodeBase(group, 'Null');
		});
		// Locators + Null Objects
		[...Locator.all, ...NullObject.all].forEach(group => {
			if (!group.export) return;
			addNodeBase(group, 'Null');
		});

		// Meshes
		Mesh.all.forEach(mesh => {
			if (!mesh.export) return;
			addNodeBase(mesh, 'Mesh');
			let unique_name = getUniqueName('object', mesh.uuid, mesh.name);

			// Geometry
			let positions = [];
			let normals = [];
			let uv = [];
			let vertex_keys = [];
			let indices = [];

			function addPosition(x, y, z) {
				positions.push(x/export_scale, y/export_scale, z/export_scale);
			}

			for (let vkey in mesh.vertices) {
				addPosition(...mesh.vertices[vkey]);
				vertex_keys.push(vkey);
			}
			let textures = [];

			for (let key in mesh.faces) {
				if (mesh.faces[key].vertices.length >= 3) {
					let face = mesh.faces[key];
					let vertices = face.getSortedVertices();
					let tex = mesh.faces[key].getTexture();
					textures.push(tex);

					vertices.forEach(vkey => {
						uv.push(face.uv[vkey][0] / Project.getUVWidth(tex), 1 - face.uv[vkey][1] / Project.getUVHeight(tex));
					})

					normals.push(...face.getNormal(true));
					
					vertices.forEach((vkey, vi) => {
						let index = vertex_keys.indexOf(vkey);
						if (vi+1 == vertices.length) index = -1 -index;
						indices.push(index);
					})
				}
			}

			DefinitionCounter.geometry++;

			let used_textures = Texture.all.filter(t => textures.includes(t));

			let geo_id = getID(mesh.uuid + '_geo')
			let geometry = {
				_key: 'Geometry',
				_values: [geo_id, `Geometry::${unique_name}`, 'Mesh'],

				Vertices: {
					_values: [`_*${positions.length}`],
					_type: 'd',
					a: positions
				},
				PolygonVertexIndex: {
					_values: [`_*${indices.length}`],
					_type: 'i',
					a: indices
				},
				GeometryVersion: 124,
				LayerElementNormal: {
					_values: [0],
					Version: 101,
					Name: "",
					MappingInformationType: "ByPolygon",
					ReferenceInformationType: "Direct",
					Normals: {
						_values: [`_*${normals.length}`],
						_type: 'd',
						a: normals
					}
				},
				LayerElementUV: {
					_values: [0],
					Version: 101,
					Name: "",
					MappingInformationType: "ByPolygonVertex",
					ReferenceInformationType: "Direct",
					UV: {
						_values: [`_*${uv.length}`],
						_type: 'd',
						a: uv
					}
				},
				LayerElementMaterial: used_textures.length <= 1 ? {
					_values: [0],
					Version: 101,
					Name: "",
					MappingInformationType: "AllSame",
					ReferenceInformationType: "IndexToDirect",
					Materials: {
						_values: [`_*1`],
						_type: 'i',
						a: 0
					},
				} : {
					// Multitexture
					_values: [0],
					Version: 101,
					Name: "",
					MappingInformationType: "ByPolygon",
					ReferenceInformationType: "IndexToDirect",
					Materials: {
						_values: [`_*${textures.length}`],
						_type: 'i',
						a: textures.map(t => used_textures.indexOf(t))
					},
				},
				Layer: {
					_values: [0],
					Version: 100,
					LayerElement1: {
						_key: 'LayerElement',
						Type: "LayerElementNormal",
						TypedIndex: 0
					},
					LayerElement2: {
						_key: 'LayerElement',
						Type: "LayerElementMaterial",
						TypedIndex: 0
					},
					LayerElement3: {
						_key: 'LayerElement',
						Type: "LayerElementUV",
						TypedIndex: 0
					},
				}
			};
			Objects[geo_id.value] = geometry;

			Connections.push({
				name: [`Geometry::${unique_name}`, `Model::${unique_name}`],
				id: [geo_id, getID(mesh.uuid)],
			})
			used_textures.forEach(tex => {
				Connections.push({
					name: [`Material::${getUniqueName('material', tex.uuid, tex.name)}`, `Model::${unique_name}`],
					id: [getID(tex.uuid+'_m'), getID(mesh.uuid)],
				})
			})
		})

		// Cubes
		const cube_face_normals = {
			north: [0, 0, -1],
			east: [1, 0, 0],
			south: [0, 0, 1],
			west: [-1, 0, 0],
			up: [0, 1, 0],
			down: [0, -1, 0],
		}
		Cube.all.forEach(cube => {
			if (!cube.export) return;
			addNodeBase(cube, 'Mesh');
			let unique_name = getUniqueName('object', cube.uuid, cube.name);

			// Geometry
			let positions = [];
			let normals = [];
			let uv = [];
			let indices = [];

			function addPosition(x, y, z) {
				positions.push(
					(x - cube.origin[0]) / export_scale,
					(y - cube.origin[1]) / export_scale,
					(z - cube.origin[2]) / export_scale
				);
			}

			var adjustedFrom = cube.from.slice();
			var adjustedTo = cube.to.slice();
			adjustFromAndToForInflateAndStretch(adjustedFrom, adjustedTo, cube);

			addPosition(adjustedTo[0],   adjustedTo[1],   adjustedTo[2]  );
			addPosition(adjustedTo[0],   adjustedTo[1],   adjustedFrom[2]);
			addPosition(adjustedTo[0],   adjustedFrom[1], adjustedTo[2]  );
			addPosition(adjustedTo[0],   adjustedFrom[1], adjustedFrom[2]);
			addPosition(adjustedFrom[0], adjustedTo[1],   adjustedFrom[2]);
			addPosition(adjustedFrom[0], adjustedTo[1],   adjustedTo[2]  );
			addPosition(adjustedFrom[0], adjustedFrom[1], adjustedFrom[2]);
			addPosition(adjustedFrom[0], adjustedFrom[1], adjustedTo[2]  );

			let textures = [];

			for (let fkey in cube.faces) {
				let face = cube.faces[fkey];
				if (face.texture === null) continue;
				texture = face.getTexture();
				textures.push(texture);
				normals.push(...cube_face_normals[fkey]);

				let uv_outputs = [
					[face.uv[0] / Project.getUVWidth(texture), 1 - face.uv[3] / Project.getUVHeight(texture)],
					[face.uv[2] / Project.getUVWidth(texture), 1 - face.uv[3] / Project.getUVHeight(texture)],
					[face.uv[2] / Project.getUVWidth(texture), 1 - face.uv[1] / Project.getUVHeight(texture)],
					[face.uv[0] / Project.getUVWidth(texture), 1 - face.uv[1] / Project.getUVHeight(texture)],
				];
				var rot = face.rotation || 0;
				while (rot > 0) {
					uv_outputs.splice(0, 0, uv_outputs.pop());
					rot -= 90;
				}
				uv_outputs.forEach(coord => {
					uv.push(...coord);
				})

				let vertices;
				switch (fkey) {
					case 'north': 	vertices = [3, 6, 4, -1-1]; break;
					case 'east': 	vertices = [2, 3, 1, -1-0]; break;
					case 'south': 	vertices = [7, 2, 0, -1-5]; break;
					case 'west': 	vertices = [6, 7, 5, -1-4]; break;
					case 'up': 		vertices = [5, 0, 1, -1-4]; break;
					case 'down': 	vertices = [6, 3, 2, -1-7]; break;
				}
				indices.push(...vertices);
			}

			DefinitionCounter.geometry++;

			let used_textures = Texture.all.filter(t => textures.includes(t));

			let geo_id = getID(cube.uuid + '_geo')
			let geometry = {
				_key: 'Geometry',
				_values: [geo_id, `Geometry::${unique_name}`, 'Mesh'],

				Vertices: {
					_values: [`_*${positions.length}`],
					_type: 'd',
					a: positions
				},
				PolygonVertexIndex: {
					_values: [`_*${indices.length}`],
					_type: 'i',
					a: indices
				},
				GeometryVersion: 124,
				LayerElementNormal: {
					_values: [0],
					Version: 101,
					Name: "",
					MappingInformationType: "ByPolygon",
					ReferenceInformationType: "Direct",
					Normals: {
						_values: [`_*${normals.length}`],
						_type: 'd',
						a: normals
					}
				},
				LayerElementUV: {
					_values: [0],
					Version: 101,
					Name: "",
					MappingInformationType: "ByPolygonVertex",
					ReferenceInformationType: "Direct",
					UV: {
						_values: [`_*${uv.length}`],
						_type: 'd',
						a: uv
					}
				},
				LayerElementMaterial: used_textures.length <= 1 ? {
					_values: [0],
					Version: 101,
					Name: "",
					MappingInformationType: "AllSame",
					ReferenceInformationType: "IndexToDirect",
					Materials: {
						_values: [`_*1`],
						_type: 'i',
						a: 0
					},
				} : {
					// Multitexture
					_values: [0],
					Version: 101,
					Name: "",
					MappingInformationType: "ByPolygon",
					ReferenceInformationType: "IndexToDirect",
					Materials: {
						_values: [`_*${textures.length}`],
						_type: 'i',
						a: textures.map(t => used_textures.indexOf(t))
					},
				},
				Layer: {
					_values: [0],
					Version: 100,
					LayerElement1: {
						_key: 'LayerElement',
						Type: "LayerElementNormal",
						TypedIndex: 0
					},
					LayerElement2: {
						_key: 'LayerElement',
						Type: "LayerElementMaterial",
						TypedIndex: 0
					},
					LayerElement3: {
						_key: 'LayerElement',
						Type: "LayerElementUV",
						TypedIndex: 0
					},
				}
			};
			Objects[geo_id.value] = geometry;

			Connections.push({
				name: [`Geometry::${unique_name}`, `Model::${unique_name}`],
				id: [geo_id, getID(cube.uuid)],
			})
			used_textures.forEach(tex => {
				Connections.push({
					name: [`Material::${getUniqueName('texture', tex.uuid, tex.name)}`, `Model::${unique_name}`],
					id: [getID(tex.uuid+'_m'), getID(cube.uuid)],
				})
			})
		})

		// Textures
		Texture.all.forEach(tex => {
			DefinitionCounter.material++;
			DefinitionCounter.texture++;
			DefinitionCounter.image++;

			let fileContent = null;
			let fileName = tex.path;
			let relativeName = tex.name;

			// If no file path, use embedded texture
			if (tex.path == '') {
				fileName = '';
				relativeName = '';
			}
			if (options.embed_textures || tex.path == '') {
				fileContent = tex.getBase64();
			}

			let unique_name = getUniqueName('texture', tex.uuid, tex.name);

			let mat_object = {
				_key: 'Material',
				_values: [getID(tex.uuid+'_m'), `Material::${unique_name}`, ''],
				Version: 102,
				ShadingModel: "lambert",
				MultiLayer: 0,
				Properties70:  {
					P2: {_key: 'P', _values: ["Emissive", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
					P3: {_key: 'P', _values: ["Ambient", "Vector3D", "Vector", "",TNum('D',0.2), TNum('D',0.2), TNum('D',0.2)]},
					P4: {_key: 'P', _values: ["Diffuse", "Vector3D", "Vector", "",TNum('D',0.8), TNum('D',0.8), TNum('D',0.8)]},
					P5: {_key: 'P', _values: ["Opacity", "double", "Number", "",TNum('D', 1)]},
				}
			};
			let tex_object = {
				_key: 'Texture',
				_values: [getID(tex.uuid+'_t'), `Texture::${unique_name}`, ''],
				Type: "TextureVideoClip",
				Version: 202,
				TextureName: `Texture::${unique_name}`,
				Media: `Video::${unique_name}`,
				FileName: fileName,
				RelativeFilename: relativeName,
				ModelUVTranslation: [TNum('D',0),TNum('D',0)],
				ModelUVScaling: [TNum('D',1),TNum('D',1)],
				Texture_Alpha_Source: "None",
				Cropping: [0,0,0,0],
			};
			let image_object = {
				_key: 'Video',
				_values: [getID(tex.uuid+'_i'), `Video::${unique_name}`, 'Clip'],
				Type: "Clip",
				Properties70:  {
					P: ["Path", "KString", "XRefUrl", "", tex.path || tex.name]
				},
				UseMipMap: 0,
				Filename: fileName,
				RelativeFilename: relativeName,
				Content: fileContent
			};
			Objects[tex.uuid+'_m'] = mat_object;
			Objects[tex.uuid+'_t'] = tex_object;
			Objects[tex.uuid+'_i'] = image_object;

			Connections.push({
				name: [`Texture::${unique_name}`,  `Material::${unique_name}`],
				id: [getID(tex.uuid+'_t'), getID(tex.uuid+'_m')],
				property: "DiffuseColor"
			});
			Connections.push({
				name: [`Video::${unique_name}`,  `Texture::${unique_name}`],
				id: [getID(tex.uuid+'_i'), getID(tex.uuid+'_t')],
			});
		})

		// Animations
		if (options.include_animations) {
			let anim_clips = Codecs.gltf.buildAnimationTracks(export_scale, false); // Handles sampling of math based curves etc.
			let time_factor = 46186158000; // Arbitrary factor, found in three.js FBX importer
			anim_clips.forEach(clip => {
				DefinitionCounter.animation_stack++;
				DefinitionCounter.animation_layer++;

				let stack_id = getID(clip.uuid+'_s');
				let layer_id = getID(clip.uuid+'_l');
				let unique_name = getUniqueName('animation', clip.uuid, clip.name);
				let fbx_duration = Math.round(clip.duration * time_factor);

				let stack = {
					_key: 'AnimationStack',
					_values: [stack_id, `AnimStack::${unique_name}`, ''],
					Properties70: {
						p1: {_key: 'P', _values: ['LocalStop', 'KTime', 'Time', '', TNum('L', fbx_duration)]},
						p2: {_key: 'P', _values: ['ReferenceStop', 'KTime', 'Time', '', TNum('L', fbx_duration)]},
					}
				};
				let layer = {
					_key: 'AnimationLayer',
					_values: [layer_id, `AnimLayer::${unique_name}`, ''],
					_force_compound: true
				};
				Objects[clip.uuid+'_s'] = stack;
				Objects[clip.uuid+'_l'] = layer;
				Connections.push({
					name: [`AnimLayer::${unique_name}`, `AnimStack::${unique_name}`],
					id: [layer_id, stack_id],
				});

				clip.tracks.forEach(track => {
					// Track = CurveNode
					DefinitionCounter.animation_curve_node++;
					let track_id = getID(clip.uuid + '.' + track.name)
					let track_name = `AnimCurveNode::${unique_name}.${track.channel[0].toUpperCase()}`;
					let curve_node = {
						_key: 'AnimationCurveNode',
						_values: [track_id, track_name, ''],
						Properties70: {
							p1: {_key: 'P', _values: [`d|X`, 'Number', '', 'A', TNum('D',1)]},
							p2: {_key: 'P', _values: [`d|Y`, 'Number', '', 'A', TNum('D',1)]},
							p3: {_key: 'P', _values: [`d|Z`, 'Number', '', 'A', TNum('D',1)]},
						}
					};
					let timecodes = track.times.map(second => Math.round(second * time_factor));
					Objects[clip.uuid + '.' + track.name] = curve_node;

					// Connect to bone
					Connections.push({
						name: [track_name, `Model::${getUniqueName('object', track.group_uuid)}`],
						id: [track_id, getID(track.group_uuid)],
						property: track.channel == 'position' ? "Lcl Translation" : (track.channel == 'rotation' ? "Lcl Rotation" : "Lcl Scaling")
					});
					// Connect to layer
					Connections.push({
						name: [track_name, `AnimLayer::${unique_name}`],
						id: [track_id, layer_id],
					});


					['X', 'Y', 'Z'].forEach((axis_letter, axis_number) => {
						DefinitionCounter.animation_curve++;

						let curve_id = getID(clip.uuid + '.' + track.name + '.' + axis_letter);
						let curve_name = `AnimCurve::${unique_name}.${track.channel[0].toUpperCase()}${axis_letter}`;

						let values = track.values.filter((val, i) => (i % 3) == axis_number);
						if (track.channel == 'rotation') {
							values.forEach((v, i) => values[i] = Math.radToDeg(v));
						}
						let curve = {
							_key: 'AnimationCurve',
							_values: [curve_id, curve_name, ''],
							Default: 0,
							KeyVer: 4008,
							KeyTime: {
								_values: [`_*${timecodes.length}`],
								_type: 'd',
								a: timecodes
							},
							KeyValueFloat: {
								_values: [`_*${values.length}`],
								_type: 'f',
								a: values
							},
							KeyAttrFlags: {
								_values: [`_*${1}`],
								_type: 'i',
								a: [24836]
							},
							KeyAttrDataFloat: {
								_values: [`_*${4}`],
								_type: 'f',
								a: [0,0,255790911,0]
							},
							KeyAttrRefCount: {
								_values: [`_*${1}`],
								_type: 'i',
								a: [timecodes.length]
							},
						};
						Objects[clip.uuid + '.' + track.name + axis_letter] = curve;

						// Connect to track
						Connections.push({
							name: [curve_name, track_name],
							id: [curve_id, track_id],
							property: `d|${axis_letter}`
						});
					});
				})

				Takes[clip.uuid] = {
					_key: 'Take',
					_values: [unique_name],
					FileName: `${unique_name}.tak`,
					LocalTime: [0, fbx_duration],
					ReferenceTime: [0, fbx_duration],
				};
			})
		}

		// Object definitions
		model.push(formatFBXComment('Object definitions'));
		let total_definition_count = 1;
		for (let key in DefinitionCounter) {
			total_definition_count += DefinitionCounter[key];
		}
		model.push({
			Definitions: {
				Version: 100,
				Count: total_definition_count,
				global_settings: {
					_key: 'ObjectType',
					_values: ['GlobalSettings'],
					Count: 1
				},
				model: DefinitionCounter.model ? {
					_key: 'ObjectType',
					_values: ['Model'],
					Count: DefinitionCounter.model,
					PropertyTemplate: {
						_values: ['FbxNode'],
						Properties70: {
							P01: {_key: 'P', _values: ["QuaternionInterpolate", "enum", "", "",0]},
							P02: {_key: 'P', _values: ["RotationOffset", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P03: {_key: 'P', _values: ["RotationPivot", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P04: {_key: 'P', _values: ["ScalingOffset", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P05: {_key: 'P', _values: ["ScalingPivot", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P06: {_key: 'P', _values: ["TranslationActive", "bool", "", "",TNum('I', 0)]},
							P07: {_key: 'P', _values: ["TranslationMin", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P08: {_key: 'P', _values: ["TranslationMax", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P09: {_key: 'P', _values: ["TranslationMinX", "bool", "", "",TNum('I', 0)]},
							P10: {_key: 'P', _values: ["TranslationMinY", "bool", "", "",TNum('I', 0)]},
							P11: {_key: 'P', _values: ["TranslationMinZ", "bool", "", "",TNum('I', 0)]},
							P12: {_key: 'P', _values: ["TranslationMaxX", "bool", "", "",TNum('I', 0)]},
							P13: {_key: 'P', _values: ["TranslationMaxY", "bool", "", "",TNum('I', 0)]},
							P14: {_key: 'P', _values: ["TranslationMaxZ", "bool", "", "",TNum('I', 0)]},
							P15: {_key: 'P', _values: ["RotationOrder", "enum", "", "",5]},
							P16: {_key: 'P', _values: ["RotationSpaceForLimitOnly", "bool", "", "",TNum('I', 0)]},
							P17: {_key: 'P', _values: ["RotationStiffnessX", "double", "Number", "",TNum('D', 0)]},
							P18: {_key: 'P', _values: ["RotationStiffnessY", "double", "Number", "",TNum('D', 0)]},
							P19: {_key: 'P', _values: ["RotationStiffnessZ", "double", "Number", "",TNum('D', 0)]},
							P20: {_key: 'P', _values: ["AxisLen", "double", "Number", "",TNum('D', 10)]},
							P21: {_key: 'P', _values: ["PreRotation", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P22: {_key: 'P', _values: ["PostRotation", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P23: {_key: 'P', _values: ["RotationActive", "bool", "", "",TNum('I', 0)]},
							P24: {_key: 'P', _values: ["RotationMin", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P25: {_key: 'P', _values: ["RotationMax", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P26: {_key: 'P', _values: ["RotationMinX", "bool", "", "",TNum('I', 0)]},
							P27: {_key: 'P', _values: ["RotationMinY", "bool", "", "",TNum('I', 0)]},
							P28: {_key: 'P', _values: ["RotationMinZ", "bool", "", "",TNum('I', 0)]},
							P29: {_key: 'P', _values: ["RotationMaxX", "bool", "", "",TNum('I', 0)]},
							P30: {_key: 'P', _values: ["RotationMaxY", "bool", "", "",TNum('I', 0)]},
							P31: {_key: 'P', _values: ["RotationMaxZ", "bool", "", "",TNum('I', 0)]},
							P32: {_key: 'P', _values: ["InheritType", "enum", "", "",0]},
							P33: {_key: 'P', _values: ["ScalingActive", "bool", "", "",TNum('I', 0)]},
							P34: {_key: 'P', _values: ["ScalingMin", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P35: {_key: 'P', _values: ["ScalingMax", "Vector3D", "Vector", "",TNum('D',1), TNum('D',1), TNum('D',1)]},
							P36: {_key: 'P', _values: ["ScalingMinX", "bool", "", "",TNum('I', 0)]},
							P37: {_key: 'P', _values: ["ScalingMinY", "bool", "", "",TNum('I', 0)]},
							P38: {_key: 'P', _values: ["ScalingMinZ", "bool", "", "",TNum('I', 0)]},
							P39: {_key: 'P', _values: ["ScalingMaxX", "bool", "", "",TNum('I', 0)]},
							P40: {_key: 'P', _values: ["ScalingMaxY", "bool", "", "",TNum('I', 0)]},
							P41: {_key: 'P', _values: ["ScalingMaxZ", "bool", "", "",TNum('I', 0)]},
							P42: {_key: 'P', _values: ["GeometricTranslation", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P43: {_key: 'P', _values: ["GeometricRotation", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P44: {_key: 'P', _values: ["GeometricScaling", "Vector3D", "Vector", "",TNum('D',1), TNum('D',1), TNum('D',1)]},
							P45: {_key: 'P', _values: ["MinDampRangeX", "double", "Number", "",TNum('D', 0)]},
							P46: {_key: 'P', _values: ["MinDampRangeY", "double", "Number", "",TNum('D', 0)]},
							P47: {_key: 'P', _values: ["MinDampRangeZ", "double", "Number", "",TNum('D', 0)]},
							P48: {_key: 'P', _values: ["MaxDampRangeX", "double", "Number", "",TNum('D', 0)]},
							P49: {_key: 'P', _values: ["MaxDampRangeY", "double", "Number", "",TNum('D', 0)]},
							P50: {_key: 'P', _values: ["MaxDampRangeZ", "double", "Number", "",TNum('D', 0)]},
							P51: {_key: 'P', _values: ["MinDampStrengthX", "double", "Number", "",TNum('D', 0)]},
							P52: {_key: 'P', _values: ["MinDampStrengthY", "double", "Number", "",TNum('D', 0)]},
							P53: {_key: 'P', _values: ["MinDampStrengthZ", "double", "Number", "",TNum('D', 0)]},
							P54: {_key: 'P', _values: ["MaxDampStrengthX", "double", "Number", "",TNum('D', 0)]},
							P55: {_key: 'P', _values: ["MaxDampStrengthY", "double", "Number", "",TNum('D', 0)]},
							P56: {_key: 'P', _values: ["MaxDampStrengthZ", "double", "Number", "",TNum('D', 0)]},
							P57: {_key: 'P', _values: ["PreferedAngleX", "double", "Number", "",TNum('D', 0)]},
							P58: {_key: 'P', _values: ["PreferedAngleY", "double", "Number", "",TNum('D', 0)]},
							P59: {_key: 'P', _values: ["PreferedAngleZ", "double", "Number", "",TNum('D', 0)]},
							P60: {_key: 'P', _values: ["LookAtProperty", "object", "", ""]},
							P61: {_key: 'P', _values: ["UpVectorProperty", "object", "", ""]},
							P62: {_key: 'P', _values: ["Show", "bool", "", "",TNum('I', 1)]},
							P63: {_key: 'P', _values: ["NegativePercentShapeSupport", "bool", "", "",TNum('I', 1)]},
							P64: {_key: 'P', _values: ["DefaultAttributeIndex", "int", "Integer", "",-1]},
							P65: {_key: 'P', _values: ["Freeze", "bool", "", "",TNum('I', 0)]},
							P66: {_key: 'P', _values: ["LODBox", "bool", "", "",TNum('I', 0)]},
							P67: {_key: 'P', _values: ["Lcl Translation", "Lcl Translation", "", "A",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P68: {_key: 'P', _values: ["Lcl Rotation", "Lcl Rotation", "", "A",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P69: {_key: 'P', _values: ["Lcl Scaling", "Lcl Scaling", "", "A",TNum('D',1), TNum('D',1), TNum('D',1)]},
							P70: {_key: 'P', _values: ["Visibility", "Visibility", "", "A",TNum('D',1)]},
							P71: {_key: 'P', _values: ["Visibility Inheritance", "Visibility Inheritance", "", "",1]},
						}
					}
				} : undefined,
				geometry: DefinitionCounter.geometry ? {
					_key: 'ObjectType',
					_values: ['Geometry'],
					Count: DefinitionCounter.geometry,
					PropertyTemplate: {
						_values: ['FbxMesh'],
						Properties70: {
							P1: {_key: 'P', _values: ["Color", "ColorRGB", "Color", "",TNum('D',0.8),TNum('D',0.8),TNum('D',0.8)]},
							P2: {_key: 'P', _values: ["BBoxMin", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P3: {_key: 'P', _values: ["BBoxMax", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P4: {_key: 'P', _values: ["Primary Visibility", "bool", "", "",TNum('I', 1)]},
							P5: {_key: 'P', _values: ["Casts Shadows", "bool", "", "",TNum('I', 1)]},
							P6: {_key: 'P', _values: ["Receive Shadows", "bool", "", "",TNum('I', 1)]},
						}
					}
				} : undefined,
				material: DefinitionCounter.material ? {
					_key: 'ObjectType',
					_values: ['Material'],
					Count: DefinitionCounter.material,
					PropertyTemplate: {
						_values: ['FbxSurfaceLambert'],
						Properties70: {
							P01: {_key: 'P', _values: ["ShadingModel", "KString", "", "", "Lambert"]},
							P02: {_key: 'P', _values: ["MultiLayer", "bool", "", "",TNum('I', 0)]},
							P03: {_key: 'P', _values: ["EmissiveColor", "Color", "", "A",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P04: {_key: 'P', _values: ["EmissiveFactor", "Number", "", "A",TNum('D',1)]},
							P05: {_key: 'P', _values: ["AmbientColor", "Color", "", "A",TNum('D',0.2), TNum('D',0.2), TNum('D',0.2)]},
							P06: {_key: 'P', _values: ["AmbientFactor", "Number", "", "A",TNum('D',1)]},
							P07: {_key: 'P', _values: ["DiffuseColor", "Color", "", "A",TNum('D',0.8), TNum('D',0.8), TNum('D',0.8)]},
							P08: {_key: 'P', _values: ["DiffuseFactor", "Number", "", "A",TNum('D',1)]},
							P09: {_key: 'P', _values: ["Bump", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P10: {_key: 'P', _values: ["NormalMap", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P11: {_key: 'P', _values: ["BumpFactor", "double", "Number", "",TNum('D', 1)]},
							P12: {_key: 'P', _values: ["TransparentColor", "Color", "", "A",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P13: {_key: 'P', _values: ["TransparencyFactor", "Number", "", "A",TNum('D',0)]},
							P14: {_key: 'P', _values: ["DisplacementColor", "ColorRGB", "Color", "",TNum('D',0),TNum('D',0),TNum('D',0)]},
							P15: {_key: 'P', _values: ["DisplacementFactor", "double", "Number", "",TNum('D', 1)]},
							P16: {_key: 'P', _values: ["VectorDisplacementColor", "ColorRGB", "Color", "",TNum('D',0),TNum('D',0),TNum('D',0)]},
							P17: {_key: 'P', _values: ["VectorDisplacementFactor", "double", "Number", "",TNum('D', 1)]},
						}
					}
				} : undefined,
				texture: DefinitionCounter.texture ? {
					_key: 'ObjectType',
					_values: ['Texture'],
					Count: DefinitionCounter.texture,
					PropertyTemplate: {
						_values: ['FbxFileTexture'],
						Properties70: {
							P01: {_key: 'P', _values: ["TextureTypeUse", "enum", "", "",0]},
							P02: {_key: 'P', _values: ["Texture alpha", "Number", "", "A",TNum('D',1)]},
							P03: {_key: 'P', _values: ["CurrentMappingType", "enum", "", "",0]},
							P04: {_key: 'P', _values: ["WrapModeU", "enum", "", "",0]},
							P05: {_key: 'P', _values: ["WrapModeV", "enum", "", "",0]},
							P06: {_key: 'P', _values: ["UVSwap", "bool", "", "",TNum('I', 0)]},
							P07: {_key: 'P', _values: ["PremultiplyAlpha", "bool", "", "",TNum('I', 1)]},
							P08: {_key: 'P', _values: ["Translation", "Vector", "", "A",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P09: {_key: 'P', _values: ["Rotation", "Vector", "", "A",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P10: {_key: 'P', _values: ["Scaling", "Vector", "", "A",TNum('D',1), TNum('D',1), TNum('D',1)]},
							P11: {_key: 'P', _values: ["TextureRotationPivot", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P12: {_key: 'P', _values: ["TextureScalingPivot", "Vector3D", "Vector", "",TNum('D',0), TNum('D',0), TNum('D',0)]},
							P13: {_key: 'P', _values: ["CurrentTextureBlendMode", "enum", "", "",1]},
							P14: {_key: 'P', _values: ["UVSet", "KString", "", "", "default"]},
							P15: {_key: 'P', _values: ["UseMaterial", "bool", "", "",TNum('I', 0)]},
							P16: {_key: 'P', _values: ["UseMipMap", "bool", "", "",TNum('I', 0)]},
						}
					}
				} : undefined,
				image: DefinitionCounter.image ? {
					_key: 'ObjectType',
					_values: ['Video'],
					Count: DefinitionCounter.image,
					PropertyTemplate: {
						_values: ['FbxVideo'],
						Properties70: {
							P01: {_key: 'P', _values: ["ImageSequence", "bool", "", "",TNum('I', 0)]},
							P02: {_key: 'P', _values: ["ImageSequenceOffset", "int", "Integer", "",0]},
							P03: {_key: 'P', _values: ["FrameRate", "double", "Number", "",TNum('D', 0)]},
							P04: {_key: 'P', _values: ["LastFrame", "int", "Integer", "",0]},
							P05: {_key: 'P', _values: ["Width", "int", "Integer", "",0]},
							P06: {_key: 'P', _values: ["Height", "int", "Integer", "",0]},
							P07: {_key: 'P', _values: ["Path", "KString", "XRefUrl", "", ""]},
							P08: {_key: 'P', _values: ["StartFrame", "int", "Integer", "",0]},
							P09: {_key: 'P', _values: ["StopFrame", "int", "Integer", "",0]},
							P10: {_key: 'P', _values: ["PlaySpeed", "double", "Number", "",TNum('D', 0)]},
							P11: {_key: 'P', _values: ["Offset", "KTime", "Time", "",TNum('L', 0)]},
							P12: {_key: 'P', _values: ["InterlaceMode", "enum", "", "",0]},
							P13: {_key: 'P', _values: ["FreeRunning", "bool", "", "",TNum('I', 0)]},
							P14: {_key: 'P', _values: ["Loop", "bool", "", "",TNum('I', 0)]},
							P15: {_key: 'P', _values: ["AccessMode", "enum", "", "",0]},
						}
					}
				} : undefined,


				animation_stack: DefinitionCounter.animation_stack ? {
					_key: 'ObjectType',
					_values: ['AnimationStack'],
					Count: DefinitionCounter.animation_stack,
					PropertyTemplate: {
						_values: ['FbxAnimStack'],
						Properties70: {
							P01: {_key: 'P', _values: ["Description", "KString", "", "", ""]},
							P02: {_key: 'P', _values: ["LocalStart", "KTime", "Time", "",TNum('L', 0)]},
							P03: {_key: 'P', _values: ["LocalStop", "KTime", "Time", "",TNum('L', 0)]},
							P04: {_key: 'P', _values: ["ReferenceStart", "KTime", "Time", "",TNum('L', 0)]},
							P05: {_key: 'P', _values: ["ReferenceStop", "KTime", "Time", "",TNum('L', 0)]},
						}
					}
				} : undefined,
				animation_layer: DefinitionCounter.animation_layer ? {
					_key: 'ObjectType',
					_values: ['AnimationLayer'],
					Count: DefinitionCounter.animation_layer,
					PropertyTemplate: {
						_values: ['FbxAnimLayer'],
						Properties70: {
							P01: {_key: 'P', _values: ["Weight", "Number", "", "A",TNum('D',100)]},
							P02: {_key: 'P', _values: ["Mute", "bool", "", "",TNum('I', 0)]},
							P03: {_key: 'P', _values: ["Solo", "bool", "", "",TNum('I', 0)]},
							P04: {_key: 'P', _values: ["Lock", "bool", "", "",TNum('I', 0)]},
							P05: {_key: 'P', _values: ["Color", "ColorRGB", "Color", "",TNum('D',0.8),TNum('D',0.8),TNum('D',0.8)]},
							P06: {_key: 'P', _values: ["BlendMode", "enum", "", "",0]},
							P07: {_key: 'P', _values: ["RotationAccumulationMode", "enum", "", "",0]},
							P08: {_key: 'P', _values: ["ScaleAccumulationMode", "enum", "", "",0]},
							P09: {_key: 'P', _values: ["BlendModeBypass", "ULongLong", "", "",0]},
						}
					}
				} : undefined,
				animation_curve_node: DefinitionCounter.animation_curve_node ? {
					_key: 'ObjectType',
					_values: ['AnimationCurveNode'],
					Count: DefinitionCounter.animation_curve_node,
					PropertyTemplate: {
						_values: ['FbxAnimCurveNode'],
						Properties70: {
							P01: {_key: 'P', _values: ["d", "Compound", "", ""]},
						}
					}
				} : undefined,
				animation_curve: DefinitionCounter.animation_curve ? {
					_key: 'ObjectType',
					_values: ['AnimationCurve'],
					Count: DefinitionCounter.animation_curve,
				} : undefined
			}
		})

		model.push(formatFBXComment('Object properties'));
		model.push({
			Objects
		});

		// Object connections
		model.push(formatFBXComment('Object connections'));
		let connections = {};
		Connections.forEach((connection, i) => {
			//connections[`connection_${i}_comment`] = {_comment: connection.name.join(', ')}
			connections[`connection_${i}`] = {
				_key: 'C',
				_values: [connection.property ? 'OP' : 'OO', ...connection.id]
			}
			if (connection.property) {
				connections[`connection_${i}`]._values.push(connection.property);
			}
			//model += `\t;${connection.name.join(', ')}\n`;
			//model += `\tC: "${property ? 'OP' : 'OO'}",${connection.id.join(',')}${property}\n\n`;
		})

		model.push({
			Connections: connections
		});

		// Takes (Animation)
		model.push(formatFBXComment('Takes section'));
		model.push({
			Takes
		})

		scope.dispatchEvent('compile', {model, options});

		let compiled_model;
		if (options.encoding == 'binary') {
			
			let top_level_object = {};
			model.forEach(section => {
				if (typeof section == 'object') {
					for (let key in section) {
						top_level_object[key] = section[key];
					}
				}
			})
			compiled_model = compileBinaryFBXModel(top_level_object);
			
		} else {
			compiled_model = model.map(section => {
				if (typeof section == 'object') {
					return compileASCIIFBXSection(section);
				} else {
					return section;
				}
			}).join('');
		}

		return compiled_model;
	},
	write(content, path) {
		var scope = this;

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
	export_options: {
		encoding: {type: 'select', label: 'codec.common.encoding', options: {ascii: 'ASCII', binary: 'Binary (Experimental)'}},
		scale: {label: 'settings.model_export_scale', type: 'number', value: Settings.get('model_export_scale')},
		embed_textures: {type: 'checkbox', label: 'codec.common.embed_textures', value: false},
		include_animations: {label: 'codec.common.export_animations', type: 'checkbox', value: true}
	},
	async export() {
		if (Object.keys(this.export_options).length) {
			let result = await this.promptExportOptions();
			if (result === null) return;
		}
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
		id: 'export_fbx',
		icon: 'icon-fbx',
		category: 'file',
		condition: () => Project,
		click: function () {
			codec.export()
		}
	})
})

class BinaryWriter {
	constructor(minimal_length, little_endian) {
		this.array = new Uint8Array(minimal_length);
		this.buffer = this.array.buffer;
		this.view = new DataView(this.buffer);
		this.cursor = 0;
		this.little_endian = !!little_endian;
		this.textEncoder = new TextEncoder();
	}
	expand(n) {
		if (this.cursor+n > this.buffer.byteLength) {
			var oldArray = this.array;
			// Expand by at least 160 bytes at a time to improve performance. Only works for FBX since 176+ arbitrary bytes are added to the file end.
			this.array = new Uint8Array(this.cursor + Math.max(n, 176));
			this.buffer = this.array.buffer;
			this.array.set(oldArray);
			this.view = new DataView(this.buffer)
		}
	}
	WriteUInt8(value) {
		this.expand(1);
		this.view.setUint8(this.cursor, value);
		this.cursor += 1;
	}
	WriteUInt16(value) {
		this.expand(2);
		this.view.setUint16(this.cursor, value, this.little_endian);
		this.cursor += 2;
	}
	WriteInt16(value) {
		this.expand(2);
		this.view.setInt16(this.cursor, value, this.little_endian);
		this.cursor += 2;
	}
	WriteInt32(value) {
		this.expand(4);
		this.view.setInt32(this.cursor, value, this.little_endian);
		this.cursor += 4;
	}
	WriteInt64(value) {
		this.expand(8);
		this.view.setBigInt64(this.cursor, BigInt(value), this.little_endian);
		this.cursor += 8;
	}
	WriteUInt32(value) {
		this.expand(4);
		this.view.setUint32(this.cursor, value, this.little_endian);
		this.cursor += 4;
	}
	WriteFloat32(value) {
		this.expand(4);
		this.view.setFloat32(this.cursor, value, this.little_endian);
		this.cursor += 4;
	}
	WriteFloat64(value) {
		this.expand(8);
		this.view.setFloat64(this.cursor, value, this.little_endian);
		this.cursor += 8;
	}
	WriteBoolean(value) {
		this.WriteUInt8(value ? 1 : 0)
	}
	Write7BitEncodedInt(value) {
		while (value >= 0x80) {
			this.WriteUInt8(value | 0x80);
			value = value >> 7;
		}
		this.WriteUInt8(value);
	}
	WriteRawString(string) {
		var array = this.EncodeString(string);
		this.WriteBytes(array);
	}
	WriteString(string, raw) {
		var array = this.EncodeString(string);
		if (!raw) this.Write7BitEncodedInt(array.byteLength);
		this.WriteBytes(array);
	}
	WriteU32String(string) {
		var array = this.EncodeString(string);
		this.WriteUInt32(array.byteLength);
		this.WriteBytes(array);
	}
	WriteU32Base64(base64) {
		let data = patchedAtob(base64);
		let array = Uint8Array.from(data, c => c.charCodeAt(0));
		this.WriteUInt32(array.length);
		this.WriteBytes(array);
	}
	WritePoint(point) {
		this.expand(8);
		this.view.setInt32(this.cursor, point.x, this.little_endian);
		this.cursor += 4;
		this.view.setInt32(this.cursor, point.y, this.little_endian);
		this.cursor += 4;
	}
	WriteVector2(vector) {
		this.expand(8);
		this.view.setFloat32(this.cursor, vector.x, this.little_endian);
		this.cursor += 4;
		this.view.setFloat32(this.cursor, vector.y, this.little_endian);
		this.cursor += 4;
	}
	WriteVector3(vector) {
		this.expand(12);
		this.view.setFloat32(this.cursor, vector.x, this.little_endian);
		this.cursor += 4;
		this.view.setFloat32(this.cursor, vector.y, this.little_endian);
		this.cursor += 4;
		this.view.setFloat32(this.cursor, vector.z, this.little_endian);
		this.cursor += 4;
	}
	WriteIntVector3(vector) {
		this.expand(12);
		this.view.setInt32(this.cursor, vector.x, this.little_endian);
		this.cursor += 4;
		this.view.setInt32(this.cursor, vector.y, this.little_endian);
		this.cursor += 4;
		this.view.setInt32(this.cursor, vector.z, this.little_endian);
		this.cursor += 4;
	}
	WriteQuaternion(quat) {
		this.expand(16);
		this.view.setFloat32(this.cursor, quat.w, this.little_endian);
		this.cursor += 4;
		this.view.setFloat32(this.cursor, quat.x, this.little_endian);
		this.cursor += 4;
		this.view.setFloat32(this.cursor, quat.y, this.little_endian);
		this.cursor += 4;
		this.view.setFloat32(this.cursor, quat.z, this.little_endian);
		this.cursor += 4;
	}
	WriteBytes(array) {
		this.expand(array.byteLength);
		this.array.set(array, this.cursor);
		this.cursor += array.byteLength;
	}
	EncodeString(string) {
		return this.textEncoder.encode(string);
	}
};

function compileBinaryFBXModel(top_level_object) {
	// https://code.blender.org/2013/08/fbx-binary-file-format-specification/
	// https://github.com/jskorepa/fbx.js/blob/master/src/lib/index.ts

	let _BLOCK_SENTINEL_DATA;
	if (_FBX_VERSION < 7500) {
		_BLOCK_SENTINEL_DATA = new Uint8Array(
			Array(13).fill(0x00)
		);
	}
	else {
		_BLOCK_SENTINEL_DATA = new Uint8Array(
			Array(25).fill(0x00)
		);
	}

	// Awful exceptions from Blender: those "classes" of elements seem to need block sentinel even when having no children and some props.
	_KEYS_IGNORE_BLOCK_SENTINEL = ["AnimationStack", "AnimationLayer"];

	// TODO: if FBX_VERSION >= 7500, use 64-bit offsets (for read_fbx_elem_uint)

	var writer = new BinaryWriter(20, true);
	// Header
	writer.WriteRawString('Kaydara FBX Binary  ');
	writer.WriteUInt8(0x00);
	writer.WriteUInt8(0x1A);
	writer.WriteUInt8(0x00);
	// Version
	writer.WriteUInt32(_FBX_VERSION);


	function writeObjectRecursively(key, object) {

		let tuple;
		if (typeof object == 'object' && typeof object.map === 'function') {
			tuple = object;
		} else if (typeof object !== 'object') {
			tuple = [object];
		} else if (object._values) {
			tuple = object._values;
		} else {
			tuple = [];
		}
		let is_data_array = object.hasOwnProperty('_values') && object.hasOwnProperty('a') && 
								object._type != undefined;

		// EndOffset, change later
		let end_offset_index = writer.cursor;
		writer.WriteUInt32(0);
		// NumProperties
		writer.WriteUInt32(tuple.length);
		// PropertyListLen, change later
		let property_length_index = writer.cursor;
		writer.WriteUInt32(0);
		// Name
		writer.WriteString(key);

		
		let property_start_index = writer.cursor;
		// Data Array
		if (is_data_array) {
			let type = object._type || 'i';
			if (!object._type) console.log('default', key, 'to int')
			let array = object.a;
			if (array instanceof Array == false) array = [array];
			
			writer.WriteRawString(type);
			writer.WriteUInt32(array.length);
			// Encoding (compression, unused by Blockbench)
			writer.WriteUInt32(0);
			// Compressed Length (but we don't use compression, so it's just the data length)
			let data_size = 0;
			switch (type) {
				case 'f':
				case 'i':
					data_size = 4;
					break;
				case 'd':
				case 'l':
					data_size = 8;
					break;
				case 'b':
					data_size = 1;
					break;
			}
			writer.WriteUInt32(array.length * data_size);
			// Contents
			for (let v of array) {
				switch (type) {
					case 'f': writer.WriteFloat32(v); break;
					case 'd': writer.WriteFloat64(v); break;
					case 'l': writer.WriteInt64(v); break;
					case 'i': writer.WriteInt32(v); break;
					case 'b': writer.WriteBoolean(v); break;
				}
			}
		} else {

			// Tuple
			tuple.forEach((value, i) => {
				let type = typeof value;
				if (typeof value == 'object' && value.isTNum) {
					type = value.type;
					value = value.value;
				}
				if (type == 'number') {
					type = value % 1 ? 'D' : 'I';
					//if (!object._type) console.log('default', key, i, 'to', type, object)
				}
				// handle number types
				// C: boolean
				// R: raw binary data
				// S: string
				// Y: int16
				// I: int32
				// F: Float 32
				// D: Double 64
				// L: int64

				if (type == 'boolean') {
					writer.WriteRawString('C');
					writer.WriteBoolean(value);

				} else if (type == 'string' && value.startsWith('iV')) {
					// base64
					writer.WriteRawString('R');
					writer.WriteU32Base64(value);

				} else if (type == 'string') {
					// Replace '::' with 0x00 0x01 and swap the order
					// E.g. "Geometry::cube" becomes "cube\x00\x01Geometry"
					// Will this break any normal text that contains those characters? I hope not.
					if (value.includes('::')) {
						const hex00 = String.fromCharCode(0x00);
						const hex01 = String.fromCharCode(0x01);
						
						const parts = value.split("::");
						value = parts[1] + hex00 + hex01 + parts[0];
					}
					// string
					writer.WriteRawString('S');
					if (value.startsWith('_')) value = value.substring(1);
					writer.WriteU32String(value);

				} else if (type == 'Y') {
					writer.WriteRawString('Y');
					writer.WriteInt16(value);

				} else if (type == 'I') {
					writer.WriteRawString('I');
					writer.WriteInt32(value);

				} else if (type == 'F') {
					writer.WriteRawString('F');
					writer.WriteFloat32(value);

				} else if (type == 'D') {
					writer.WriteRawString('D');
					writer.WriteFloat64(value);

				} else if (type == 'L') {
					writer.WriteRawString('L');
					writer.WriteInt64(value);

				}
				
			})
		}

		// Property Byte Length
		writer.view.setUint32(property_length_index, writer.cursor - property_start_index, writer.little_endian);

		// Nested List
		if (typeof object == 'object' && object instanceof Array == false && !is_data_array) {

			let is_nested = false;
			for (let key in object) {
				if (typeof key == 'string' && key.startsWith('_')) continue;
				if (object[key] === undefined) continue;
				let child = object[key];
				if (child === null || child._comment) continue;
				if (child._key) key = child._key;

				is_nested = true;

				writeObjectRecursively(key, child);
			}
			// Null Record, indicating a nested list.
			if (is_nested || (Object.keys(object).length === 0 && !(_KEYS_IGNORE_BLOCK_SENTINEL.includes(key)))) {
				writer.WriteBytes(_BLOCK_SENTINEL_DATA);
			}
		}
		// End Offset
		writer.view.setUint32(end_offset_index, writer.cursor, writer.little_endian);
	}
	//writeObjectRecursively('', top_level_object);
	for (let key in top_level_object) {
		writeObjectRecursively(key, top_level_object[key]);
	}

	writer.WriteBytes(_BLOCK_SENTINEL_DATA);

	// Footer
	//		Write the FOOT ID
	let footer_id = [
        0xfa, 0xbc, 0xab, 0x09, 0xd0, 0xc8, 0xd4, 0x66, 0xb1, 0x76, 0xfb, 0x83, 0x1c, 0xf7, 0x26, 0x7e, 
		0x00, 0x00, 0x00, 0x00];
	writer.WriteBytes(new Uint8Array(footer_id));

	//		padding for alignment (values between 1 & 16 observed)
	//		if already aligned to 16, add a full 16 bytes padding.
	const offset = writer.cursor;
	let pad = ((offset + 15) & ~15) - offset;
	if (pad === 0) pad = 16;
	for (let i = 0; i < pad; i++) {
		writer.WriteUInt8(0x00);
	}

	// 		Write the FBX version
	writer.WriteUInt32(_FBX_VERSION);

	// 		Write some footer magic
	writer.WriteBytes(new Uint8Array(
		Array(120).fill(0x00))
	);
	let footer_magic = [
        0xf8, 0x5a, 0x8c, 0x6a, 0xde, 0xf5, 0xd9, 0x7e, 0xec, 0xe9, 0x0c, 0xe3, 0x75, 0x8f, 0x29, 0x0b
    ];
	writer.WriteBytes(new Uint8Array(footer_magic));

	// Cut the array to the cursor location (because the writer expand method can have added extra bytes)
	const output = writer.array.subarray(0, writer.cursor);

	return output;
}

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
		if (typeof value == 'object' && value.isTNum) value = value.value;
		if (typeof value == 'boolean') return value ? 'Y' : 'N';
		if (typeof value == 'string' && value.startsWith('_')) return value.substring(1);
		if (typeof value == 'string') return '"' + value + '"';
		return value;
	}
	function joinArray(array) {
		let string = '';
		if (Array.length == 0) return string;
		string += array[0];
		for (let i = 1; i < array.length; i++) {
			let item = array[i];
			string += ',';
			if (typeof item !== 'number') {
				string += ' ';
			}
			string += item;
		}
		return string;
	}
	function handleObjectChildren(parent) {
		let output = '';
		for (let key in parent) {
			if (typeof key == 'string' && key.startsWith('_')) continue;
			if (parent[key] === undefined || parent[key] === null) continue;
			let object = parent[key];
			if (object._comment) {
				output += `\n${indent()};${object._comment}\n`;
				continue;
			}
			if (object._key) key = object._key;

			let values = '';
			if (typeof object == 'object' && typeof object.map === 'function') {
				values = joinArray(object.map(handleValue));
			} else if (typeof object !== 'object') {
				values = handleValue(object);
			} else if (object._values) {
				values = joinArray(object._values.map(handleValue));
			}

			output += `${indent()}${key}: ${values}`;

			let content;
			if (typeof object == 'object' && typeof object.map !== 'function') {
				depth++;
				content = handleObjectChildren(object);
				depth--;
			}
			if (content || object._force_compound) {
				output += ` {\n${content}${indent()}}\n`;
			} else {
				output += '\n';
			}
		}
		return output;
	}
	return handleObjectChildren(object);
}

})()
