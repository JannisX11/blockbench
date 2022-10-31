(function() {


var codec = new Codec('fbx', {
	name: 'FBX Model',
	extension: 'fbx',
	compile(options = 0) {
		let scope = this;
		let model = [
			'; FBX 7.3.0 project file',
			'; Created by the Blockbench FBX Exporter',
			'; ----------------------------------------------------',
			'; ',
			'',
			'',
		].join('\n');

		function formatFBXComment(comment) {
			return '\n; ' + comment.split(/\n/g).join('\n; ')
				+ '\n;------------------------------------------------------------------\n\n';
		}
		let UUIDMap = {};
		function getID(uuid) {
			if (uuid == 0) return 0;
			if (UUIDMap[uuid]) return UUIDMap[uuid];
			let s = '';
			for (let i = 0; i < 8; i++) {
				s += Math.floor(Math.random()*10)
			}
			s[0] = '7';
			UUIDMap[uuid] = parseInt(s);
			return UUIDMap[uuid];
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
				Creator: 'Blockbench '+Blockbench.version,
				OtherFlags: {
					FlagPLE: 0
				}
			},
			CreationTime: new Date().toISOString().replace('T', ' ').replace('.', ':').replace('Z', ''),
			Creator: Settings.get('credit'),
		})

		model += compileASCIIFBXSection({
			GlobalSettings: {
				Version: 1000,
				Properties60: {
					P01: {_key: 'Property', _values: ["UpAxis", "int", "",1]},
					P02: {_key: 'Property', _values: ["UpAxisSign", "int", "",1]},
					P03: {_key: 'Property', _values: ["FrontAxis", "int", "",2]},
					P04: {_key: 'Property', _values: ["FrontAxisSign", "int", "",1]},
					P05: {_key: 'Property', _values: ["CoordAxis", "int", "",0]},
					P06: {_key: 'Property', _values: ["CoordAxisSign", "int", "",1]},
					P07: {_key: 'Property', _values: ["UnitScaleFactor", "double", "",1]},
				}
			}
		});


		let DefinitionCounter = {
			model: 0,
			geometry: 0,
			material: 0,
			texture: 0,
			image: 0,
		};
		let Objects = {};
		let Connections = [];
		let root = {name: 'RootNode', uuid: 0};

		function getElementPos(element) {
			let arr = element.origin.slice();
			if (element.parent instanceof Group) {
				arr.V3_subtract(element.parent.origin);
			}
			return arr.V3_divide(16);
		}
		function addNodeBase(node, fbx_type) {
			Objects[node.uuid] = {
				_key: 'Model',
				_values: [getID(node.uuid), `Model::${node.name}`, fbx_type],
				Version: 232,
				Properties70: {
					P1: {_key: 'P', _values: ["RotationActive", "bool", "", "",1]},
					P2: {_key: 'P', _values: ["InheritType", "enum", "", "",1]},
					P3: {_key: 'P', _values: ["ScalingMax", "Vector3D", "Vector", "",0,0,0]},
					P4: {_key: 'P', _values: ["Lcl Translation", "Lcl Translation", "", "A", ...getElementPos(node)]},
					P5: node.faces ? {_key: 'P', _values: ["DefaultAttributeIndex", "int", "Integer", "",0]} : undefined,
				},
				Shading: '_Y',
				Culling: "CullingOff",
			};
			let parent = node.parent == 'root' ? root : node.parent;
			Connections.push({
				name: [`Model::${node.name}`, `Model::${parent.name}`],
				id: [getID(node.uuid), getID(parent.uuid)],
			});
			DefinitionCounter.model++;
			return Objects[node.uuid];
		}

		// Groups
		Group.all.forEach(group => {
			if (!group.export) return;
			addNodeBase(group, 'Null');
		})

		// Meshes
		Mesh.all.forEach(mesh => {
			if (!mesh.export) return;
			addNodeBase(mesh, 'Mesh');

			// Geometry
			let positions = [];
			let normals = [];
			let uv = [];
			let vertex_keys = [];
			let indices = [];

			function addPosition(x, y, z) {
				positions.push(x/16, y/16, z/16);
			}

			for (let vkey in mesh.vertices) {
				addPosition(...mesh.vertices[vkey]);
				vertex_keys.push(vkey);
			}
			let texture;

			let i = 0;
			for (let key in mesh.faces) {
				if (mesh.faces[key].vertices.length >= 3) {
					let face = mesh.faces[key];
					let vertices = face.getSortedVertices();
					let tex = mesh.faces[key].getTexture();
					if (tex) texture = tex;

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

			DefinitionCounter.geometry++;

			let geo_id = getID(mesh.uuid + '_geo')
			let geometry = {
				_key: 'Geometry',
				_values: [geo_id, `Geometry::${mesh.name}`, 'Mesh'],

				Vertices: {
					_values: [`_*${positions.length}`],
					a: positions
				},
				PolygonVertexIndex: {
					_values: [`_*${indices.length}`],
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
						a: uv
					}
				},
				LayerElementMaterial: {
					_values: [0],
					Version: 101,
					Name: "",
					MappingInformationType: "AllSame",
					ReferenceInformationType: "IndexToDirect",
					Materials: {
						_values: [`_*${1}`],
						a: 0
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
			Objects[geo_id] = geometry;

			Connections.push({
				name: [`Geometry::${mesh.name}`, `Model::${mesh.name}`],
				id: [geo_id, getID(mesh.uuid)],
			})
			if (texture) {
				Connections.push({
					name: [`Material::${texture.name}`, `Model::${mesh.name}`],
					id: [getID(texture.uuid+'_m'), getID(mesh.uuid)],
				})
			}
		})


		Texture.all.forEach(tex => {
			DefinitionCounter.material++;
			DefinitionCounter.texture++;
			DefinitionCounter.image++;

			let mat_object = {
				_key: 'Material',
				_values: [getID(tex.uuid+'_m'), `Material::${tex.name}`, ''],
				Version: 102,
				ShadingModel: "lambert",
				MultiLayer: 0,
				Properties70:  {
					P2: {_key: 'P', _values: ["Emissive", "Vector3D", "Vector", "",0,0,0]},
					P3: {_key: 'P', _values: ["Ambient", "Vector3D", "Vector", "",0.2,0.2,0.2]},
					P4: {_key: 'P', _values: ["Diffuse", "Vector3D", "Vector", "",0.8,0.8,0.8]},
					P5: {_key: 'P', _values: ["Opacity", "double", "Number", "",1]},
				}
			};
			let tex_object = {
				_key: 'Texture',
				_values: [getID(tex.uuid+'_t'), `Texture::${tex.name}`, ''],
				Type: "TextureVideoClip",
				Version: 202,
				TextureName: `Texture::${tex.name}`,
				Media: `Video::${tex.name}`,
				FileName: tex.path,
				RelativeFilename: tex.name,
				ModelUVTranslation: [0,0],
				ModelUVScaling: [1,1],
				Texture_Alpha_Source: "None",
				Cropping: [0,0,0,0],
			};
			let image_object = {
				_key: 'Video',
				_values: [getID(tex.uuid+'_i'), `Video::${tex.name}`, 'Clip'],
				Type: "Clip",
				Properties70:  {
					P: ["Path", "KString", "XRefUrl", "", tex.path || tex.name]
				},
				UseMipMap: 0,
				Filename: tex.path,
				RelativeFilename: tex.name,
				Content: ['_', tex.getBase64()]
			};
			Objects[tex.uuid+'_m'] = mat_object;
			Objects[tex.uuid+'_t'] = tex_object;
			Objects[tex.uuid+'_i'] = image_object;

			Connections.push({
				name: [`Texture::${tex.name}`,  `Material::${tex.name}`],
				id: [getID(tex.uuid+'_t'), getID(tex.uuid+'_m'), "DiffuseColor"],
				connector: 'OP'
			});
			Connections.push({
				name: [`Video::${tex.name}`,  `Texture::${tex.name}`],
				id: [getID(tex.uuid+'_i'), getID(tex.uuid+'_t')],
			});
		})


		// Object definitions
		model += formatFBXComment('Object definitions');
		let total_definition_count = 1;
		for (let key in DefinitionCounter) {
			total_definition_count += DefinitionCounter[key];
		}
		model += compileASCIIFBXSection({
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
							P02: {_key: 'P', _values: ["RotationOffset", "Vector3D", "Vector", "",0,0,0]},
							P03: {_key: 'P', _values: ["RotationPivot", "Vector3D", "Vector", "",0,0,0]},
							P04: {_key: 'P', _values: ["ScalingOffset", "Vector3D", "Vector", "",0,0,0]},
							P05: {_key: 'P', _values: ["ScalingPivot", "Vector3D", "Vector", "",0,0,0]},
							P06: {_key: 'P', _values: ["TranslationActive", "bool", "", "",0]},
							P07: {_key: 'P', _values: ["TranslationMin", "Vector3D", "Vector", "",0,0,0]},
							P08: {_key: 'P', _values: ["TranslationMax", "Vector3D", "Vector", "",0,0,0]},
							P09: {_key: 'P', _values: ["TranslationMinX", "bool", "", "",0]},
							P10: {_key: 'P', _values: ["TranslationMinY", "bool", "", "",0]},
							P11: {_key: 'P', _values: ["TranslationMinZ", "bool", "", "",0]},
							P12: {_key: 'P', _values: ["TranslationMaxX", "bool", "", "",0]},
							P13: {_key: 'P', _values: ["TranslationMaxY", "bool", "", "",0]},
							P14: {_key: 'P', _values: ["TranslationMaxZ", "bool", "", "",0]},
							P15: {_key: 'P', _values: ["RotationOrder", "enum", "", "",0]},
							P16: {_key: 'P', _values: ["RotationSpaceForLimitOnly", "bool", "", "",0]},
							P17: {_key: 'P', _values: ["RotationStiffnessX", "double", "Number", "",0]},
							P18: {_key: 'P', _values: ["RotationStiffnessY", "double", "Number", "",0]},
							P19: {_key: 'P', _values: ["RotationStiffnessZ", "double", "Number", "",0]},
							P20: {_key: 'P', _values: ["AxisLen", "double", "Number", "",10]},
							P21: {_key: 'P', _values: ["PreRotation", "Vector3D", "Vector", "",0,0,0]},
							P22: {_key: 'P', _values: ["PostRotation", "Vector3D", "Vector", "",0,0,0]},
							P23: {_key: 'P', _values: ["RotationActive", "bool", "", "",0]},
							P24: {_key: 'P', _values: ["RotationMin", "Vector3D", "Vector", "",0,0,0]},
							P25: {_key: 'P', _values: ["RotationMax", "Vector3D", "Vector", "",0,0,0]},
							P26: {_key: 'P', _values: ["RotationMinX", "bool", "", "",0]},
							P27: {_key: 'P', _values: ["RotationMinY", "bool", "", "",0]},
							P28: {_key: 'P', _values: ["RotationMinZ", "bool", "", "",0]},
							P29: {_key: 'P', _values: ["RotationMaxX", "bool", "", "",0]},
							P30: {_key: 'P', _values: ["RotationMaxY", "bool", "", "",0]},
							P31: {_key: 'P', _values: ["RotationMaxZ", "bool", "", "",0]},
							P32: {_key: 'P', _values: ["InheritType", "enum", "", "",0]},
							P33: {_key: 'P', _values: ["ScalingActive", "bool", "", "",0]},
							P34: {_key: 'P', _values: ["ScalingMin", "Vector3D", "Vector", "",0,0,0]},
							P35: {_key: 'P', _values: ["ScalingMax", "Vector3D", "Vector", "",1,1,1]},
							P36: {_key: 'P', _values: ["ScalingMinX", "bool", "", "",0]},
							P37: {_key: 'P', _values: ["ScalingMinY", "bool", "", "",0]},
							P38: {_key: 'P', _values: ["ScalingMinZ", "bool", "", "",0]},
							P39: {_key: 'P', _values: ["ScalingMaxX", "bool", "", "",0]},
							P40: {_key: 'P', _values: ["ScalingMaxY", "bool", "", "",0]},
							P41: {_key: 'P', _values: ["ScalingMaxZ", "bool", "", "",0]},
							P42: {_key: 'P', _values: ["GeometricTranslation", "Vector3D", "Vector", "",0,0,0]},
							P43: {_key: 'P', _values: ["GeometricRotation", "Vector3D", "Vector", "",0,0,0]},
							P44: {_key: 'P', _values: ["GeometricScaling", "Vector3D", "Vector", "",1,1,1]},
							P45: {_key: 'P', _values: ["MinDampRangeX", "double", "Number", "",0]},
							P46: {_key: 'P', _values: ["MinDampRangeY", "double", "Number", "",0]},
							P47: {_key: 'P', _values: ["MinDampRangeZ", "double", "Number", "",0]},
							P48: {_key: 'P', _values: ["MaxDampRangeX", "double", "Number", "",0]},
							P49: {_key: 'P', _values: ["MaxDampRangeY", "double", "Number", "",0]},
							P50: {_key: 'P', _values: ["MaxDampRangeZ", "double", "Number", "",0]},
							P51: {_key: 'P', _values: ["MinDampStrengthX", "double", "Number", "",0]},
							P52: {_key: 'P', _values: ["MinDampStrengthY", "double", "Number", "",0]},
							P53: {_key: 'P', _values: ["MinDampStrengthZ", "double", "Number", "",0]},
							P54: {_key: 'P', _values: ["MaxDampStrengthX", "double", "Number", "",0]},
							P55: {_key: 'P', _values: ["MaxDampStrengthY", "double", "Number", "",0]},
							P56: {_key: 'P', _values: ["MaxDampStrengthZ", "double", "Number", "",0]},
							P57: {_key: 'P', _values: ["PreferedAngleX", "double", "Number", "",0]},
							P58: {_key: 'P', _values: ["PreferedAngleY", "double", "Number", "",0]},
							P59: {_key: 'P', _values: ["PreferedAngleZ", "double", "Number", "",0]},
							P60: {_key: 'P', _values: ["LookAtProperty", "object", "", ""]},
							P61: {_key: 'P', _values: ["UpVectorProperty", "object", "", ""]},
							P62: {_key: 'P', _values: ["Show", "bool", "", "",1]},
							P63: {_key: 'P', _values: ["NegativePercentShapeSupport", "bool", "", "",1]},
							P64: {_key: 'P', _values: ["DefaultAttributeIndex", "int", "Integer", "",-1]},
							P65: {_key: 'P', _values: ["Freeze", "bool", "", "",0]},
							P66: {_key: 'P', _values: ["LODBox", "bool", "", "",0]},
							P67: {_key: 'P', _values: ["Lcl Translation", "Lcl Translation", "", "A",0,0,0]},
							P68: {_key: 'P', _values: ["Lcl Rotation", "Lcl Rotation", "", "A",0,0,0]},
							P69: {_key: 'P', _values: ["Lcl Scaling", "Lcl Scaling", "", "A",1,1,1]},
							P70: {_key: 'P', _values: ["Visibility", "Visibility", "", "A",1]},
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
							P1: {_key: 'P', _values: ["Color", "ColorRGB", "Color", "",0.8,0.8,0.8]},
							P2: {_key: 'P', _values: ["BBoxMin", "Vector3D", "Vector", "",0,0,0]},
							P3: {_key: 'P', _values: ["BBoxMax", "Vector3D", "Vector", "",0,0,0]},
							P4: {_key: 'P', _values: ["Primary Visibility", "bool", "", "",1]},
							P5: {_key: 'P', _values: ["Casts Shadows", "bool", "", "",1]},
							P6: {_key: 'P', _values: ["Receive Shadows", "bool", "", "",1]},
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
							P02: {_key: 'P', _values: ["MultiLayer", "bool", "", "",0]},
							P03: {_key: 'P', _values: ["EmissiveColor", "Color", "", "A",0,0,0]},
							P04: {_key: 'P', _values: ["EmissiveFactor", "Number", "", "A",1]},
							P05: {_key: 'P', _values: ["AmbientColor", "Color", "", "A",0.2,0.2,0.2]},
							P06: {_key: 'P', _values: ["AmbientFactor", "Number", "", "A",1]},
							P07: {_key: 'P', _values: ["DiffuseColor", "Color", "", "A",0.8,0.8,0.8]},
							P08: {_key: 'P', _values: ["DiffuseFactor", "Number", "", "A",1]},
							P09: {_key: 'P', _values: ["Bump", "Vector3D", "Vector", "",0,0,0]},
							P10: {_key: 'P', _values: ["NormalMap", "Vector3D", "Vector", "",0,0,0]},
							P11: {_key: 'P', _values: ["BumpFactor", "double", "Number", "",1]},
							P12: {_key: 'P', _values: ["TransparentColor", "Color", "", "A",0,0,0]},
							P13: {_key: 'P', _values: ["TransparencyFactor", "Number", "", "A",0]},
							P14: {_key: 'P', _values: ["DisplacementColor", "ColorRGB", "Color", "",0,0,0]},
							P15: {_key: 'P', _values: ["DisplacementFactor", "double", "Number", "",1]},
							P16: {_key: 'P', _values: ["VectorDisplacementColor", "ColorRGB", "Color", "",0,0,0]},
							P17: {_key: 'P', _values: ["VectorDisplacementFactor", "double", "Number", "",1]},
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
							P02: {_key: 'P', _values: ["Texture alpha", "Number", "", "A",1]},
							P03: {_key: 'P', _values: ["CurrentMappingType", "enum", "", "",0]},
							P04: {_key: 'P', _values: ["WrapModeU", "enum", "", "",0]},
							P05: {_key: 'P', _values: ["WrapModeV", "enum", "", "",0]},
							P06: {_key: 'P', _values: ["UVSwap", "bool", "", "",0]},
							P07: {_key: 'P', _values: ["PremultiplyAlpha", "bool", "", "",1]},
							P08: {_key: 'P', _values: ["Translation", "Vector", "", "A",0,0,0]},
							P09: {_key: 'P', _values: ["Rotation", "Vector", "", "A",0,0,0]},
							P10: {_key: 'P', _values: ["Scaling", "Vector", "", "A",1,1,1]},
							P11: {_key: 'P', _values: ["TextureRotationPivot", "Vector3D", "Vector", "",0,0,0]},
							P12: {_key: 'P', _values: ["TextureScalingPivot", "Vector3D", "Vector", "",0,0,0]},
							P13: {_key: 'P', _values: ["CurrentTextureBlendMode", "enum", "", "",1]},
							P14: {_key: 'P', _values: ["UVSet", "KString", "", "", "default"]},
							P15: {_key: 'P', _values: ["UseMaterial", "bool", "", "",0]},
							P16: {_key: 'P', _values: ["UseMipMap", "bool", "", "",0]},
						}
					}
				} : undefined,
				image: DefinitionCounter.image ? {
					_key: 'ObjectType',
					_values: ['Video'],
					Count: 1,
					PropertyTemplate: {
						_values: ['FbxVideo'],
						Properties70: {
							P01: {_key: 'P', _values: ["ImageSequence", "bool", "", "",0]},
							P02: {_key: 'P', _values: ["ImageSequenceOffset", "int", "Integer", "",0]},
							P03: {_key: 'P', _values: ["FrameRate", "double", "Number", "",0]},
							P04: {_key: 'P', _values: ["LastFrame", "int", "Integer", "",0]},
							P05: {_key: 'P', _values: ["Width", "int", "Integer", "",0]},
							P06: {_key: 'P', _values: ["Height", "int", "Integer", "",0]},
							P07: {_key: 'P', _values: ["Path", "KString", "XRefUrl", "", ""]},
							P08: {_key: 'P', _values: ["StartFrame", "int", "Integer", "",0]},
							P09: {_key: 'P', _values: ["StopFrame", "int", "Integer", "",0]},
							P10: {_key: 'P', _values: ["PlaySpeed", "double", "Number", "",0]},
							P11: {_key: 'P', _values: ["Offset", "KTime", "Time", "",0]},
							P12: {_key: 'P', _values: ["InterlaceMode", "enum", "", "",0]},
							P13: {_key: 'P', _values: ["FreeRunning", "bool", "", "",0]},
							P14: {_key: 'P', _values: ["Loop", "bool", "", "",0]},
							P15: {_key: 'P', _values: ["AccessMode", "enum", "", "",0]},
						}
					}
				} : undefined
			}
		})

		model += formatFBXComment('Object properties');
		model += compileASCIIFBXSection({
			Objects
		});

		// Object connections
		model += formatFBXComment('Object connections');
		model += `Connections:  {\n\n`;
		Connections.forEach(connection => {
			model += `\t;${connection.name.join(', ')}\n`;
			model += `\tC: "${connection.connector || 'OO'}",${connection.id.join(',')}\n\n`;
		})
		model += `}\n`;

		// Takes
		model += formatFBXComment('Takes section');
		model += compileASCIIFBXSection({
			Takes: {
				Current: ''
			}
		})

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
			if (parent[key] === undefined) continue;
			let object = parent[key];
			if (object._key) key = object._key;

			let values = '';
			if (object instanceof Array) {
				values = joinArray(object.map(handleValue));
			} else if (typeof object !== 'object') {
				values = handleValue(object);
			} else if (object._values) {
				values = joinArray(object._values.map(handleValue));
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
