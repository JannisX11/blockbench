(function() {

function F(num) {
	var s = trimFloatNumber(num) + '';
	if (!s.includes('.')) {
		s += '.0';
	}
	return s+'F';
}
function I(num) {
	return Math.floor(num)
}
const Templates = {
	'1.12': {
		name: 'Forge 1.7 - 1.13',
		remember: true,
		integer_size: true,
		file:
		   `// Made with Blockbench %(bb_version)
			// Exported for Minecraft version 1.7 - 1.12
			// Paste this class into your mod and generate all required imports


			public class %(identifier) extends ModelBase {
				%(fields)

				public %(identifier)() {
					textureWidth = %(texture_width);
					textureHeight = %(texture_height);

					%(content)
				}

				@Override
				public void render(Entity entity, float f, float f1, float f2, float f3, float f4, float f5) {
					%(renderers)
				}

				public void setRotationAngle(ModelRenderer modelRenderer, float x, float y, float z) {
					modelRenderer.rotateAngleX = x;
					modelRenderer.rotateAngleY = y;
					modelRenderer.rotateAngleZ = z;
				}
			}`,
		field: `private final ModelRenderer %(bone);`,
		bone: 
		  `%(bone) = new ModelRenderer(this);
			%(bone).setRotationPoint(%(x), %(y), %(z));
			?(has_parent)%(parent).addChild(%(bone));
			?(has_rotation)setRotationAngle(%(bone), %(rx), %(ry), %(rz));
			%(cubes)`,
		renderer: `%(bone).render(f5);`,
		cube: `%(bone).cubeList.add(new ModelBox(%(bone), %(uv_x), %(uv_y), %(x), %(y), %(z), %(dx), %(dy), %(dz), %(inflate), %(mirror)));`,
	},

	'1.14': {
		name: 'Forge 1.14 (MCP)',
		remember: true,
		integer_size: true,
		file: 
		   `// Made with Blockbench %(bb_version)
			// Exported for Minecraft version 1.14 with MCP mappings
			// Paste this class into your mod and generate all required imports


			public class %(identifier) extends EntityModel {
				%(fields)

				public %(identifier)() {
					textureWidth = %(texture_width);
					textureHeight = %(texture_height);

					%(content)
				}

				@Override
				public void render(Entity entity, float f, float f1, float f2, float f3, float f4, float f5) {
					%(renderers)
				}

				public void setRotationAngle(RendererModel modelRenderer, float x, float y, float z) {
					modelRenderer.rotateAngleX = x;
					modelRenderer.rotateAngleY = y;
					modelRenderer.rotateAngleZ = z;
				}
			}`,
		field: `private final RendererModel %(bone);`,
		bone: 
		  `%(bone) = new RendererModel(this);
			%(bone).setRotationPoint(%(x), %(y), %(z));
			?(has_parent)%(parent).addChild(%(bone));
			?(has_rotation)setRotationAngle(%(bone), %(rx), %(ry), %(rz));
			%(cubes)`,
		renderer: `%(bone).render(f5);`,
		cube: `%(bone).cubeList.add(new ModelBox(%(bone), %(uv_x), %(uv_y), %(x), %(y), %(z), %(dx), %(dy), %(dz), %(inflate), %(mirror)));`,
	},

	'1.14_mojmaps': {
		name: 'Forge 1.14 (Mojmaps)',
		remember: false,
		integer_size: true,
		file:
			`// Made with Blockbench %(bb_version)
			// Exported for Minecraft version 1.14 with Mojang mappings
			// Paste this class into your mod and generate all required imports


			public class %(identifier) extends EntityModel {
				%(fields)

				public %(identifier)() {
					texWidth = %(texture_width);
					texHeight = %(texture_height);

					%(content)
				}

				@Override
				public void render(Entity entity, float f, float f1, float f2, float f3, float f4, float f5) {
					%(renderers)
				}

				public void setRotationAngle(RendererModel modelRenderer, float x, float y, float z) {
					modelRenderer.xRot = x;
					modelRenderer.yRot = y;
					modelRenderer.zRot = z;
				}
			}`,
		field: `private final RendererModel %(bone);`,
		bone:
			`%(bone) = new RendererModel(this);
			%(bone).setPos(%(x), %(y), %(z));
			?(has_parent)%(parent).addChild(%(bone));
			?(has_rotation)setRotationAngle(%(bone), %(rx), %(ry), %(rz));
			%(cubes)`,
		renderer: `%(bone).render(f5);`,
		cube: `%(bone).cubes.add(new ModelBox(%(bone), %(uv_x), %(uv_y), %(x), %(y), %(z), %(dx), %(dy), %(dz), %(inflate), %(mirror)));`,
	},

	'1.15': {
		name: 'Forge 1.15 - 1.16 (MCP)',
		remember: true,
		integer_size: false,
		file: 
		   `// Made with Blockbench %(bb_version)
			// Exported for Minecraft version 1.15 - 1.16 with MCP mappings
			// Paste this class into your mod and generate all required imports


			public class %(identifier) extends EntityModel<Entity> {
				%(fields)

				public %(identifier)() {
					textureWidth = %(texture_width);
					textureHeight = %(texture_height);

					%(content)
				}

				@Override
				public void setRotationAngles(Entity entity, float limbSwing, float limbSwingAmount, float ageInTicks, float netHeadYaw, float headPitch){
					//previously the render function, render code was moved to a method below
				}

				@Override
				public void render(MatrixStack matrixStack, IVertexBuilder buffer, int packedLight, int packedOverlay, float red, float green, float blue, float alpha){
					%(renderers)
				}

				public void setRotationAngle(ModelRenderer modelRenderer, float x, float y, float z) {
					modelRenderer.rotateAngleX = x;
					modelRenderer.rotateAngleY = y;
					modelRenderer.rotateAngleZ = z;
				}
			}`,
		field: `private final ModelRenderer %(bone);`,
		bone: 
		  `%(bone) = new ModelRenderer(this);
			%(bone).setRotationPoint(%(x), %(y), %(z));
			?(has_parent)%(parent).addChild(%(bone));
			?(has_rotation)setRotationAngle(%(bone), %(rx), %(ry), %(rz));
			%(cubes)`,
		renderer: `%(bone).render(matrixStack, buffer, packedLight, packedOverlay, red, green, blue, alpha);`,
		cube: `%(bone).setTextureOffset(%(uv_x), %(uv_y)).addBox(%(x), %(y), %(z), %(dx), %(dy), %(dz), %(inflate), %(mirror));`,
	},

	'1.15_mojmaps': {
		name: 'Forge 1.15 - 1.16 (Mojmaps)',
		remember: false,
		integer_size: false,
		file:
			`// Made with Blockbench %(bb_version)
			// Exported for Minecraft version 1.15 - 1.16 with Mojang mappings
			// Paste this class into your mod and generate all required imports


			public class %(identifier) extends EntityModel<Entity> {
				%(fields)

				public %(identifier)() {
					texWidth = %(texture_width);
					texHeight = %(texture_height);

					%(content)
				}

				@Override
				public void setupAnim(Entity entity, float limbSwing, float limbSwingAmount, float ageInTicks, float netHeadYaw, float headPitch){
					//previously the render function, render code was moved to a method below
				}

				@Override
				public void renderToBuffer(MatrixStack matrixStack, IVertexBuilder buffer, int packedLight, int packedOverlay, float red, float green, float blue, float alpha){
					%(renderers)
				}

				public void setRotationAngle(ModelRenderer modelRenderer, float x, float y, float z) {
					modelRenderer.xRot = x;
					modelRenderer.yRot = y;
					modelRenderer.zRot = z;
				}
			}`,
		field: `private final ModelRenderer %(bone);`,
		bone:
			`%(bone) = new ModelRenderer(this);
			%(bone).setPos(%(x), %(y), %(z));
			?(has_parent)%(parent).addChild(%(bone));
			?(has_rotation)setRotationAngle(%(bone), %(rx), %(ry), %(rz));
			%(cubes)`,
		renderer: `%(bone).render(matrixStack, buffer, packedLight, packedOverlay, red, green, blue, alpha);`,
		cube: `%(bone).texOffs(%(uv_x), %(uv_y)).addBox(%(x), %(y), %(z), %(dx), %(dy), %(dz), %(inflate), %(mirror));`,
	},

	'1.17': {
		name: 'Forge 1.17+ (Mojmaps)',
		remember: false,
		use_layer_definition: true,
		integer_size: false,
		file:
			`// Made with Blockbench %(bb_version)
			// Exported for Minecraft version 1.17 or later with Mojang mappings
			// Paste this class into your mod and generate all required imports


			public class %(identifier)<T extends Entity> extends EntityModel<T> {
				// This layer location should be baked with EntityRendererProvider.Context in the entity renderer and passed into this model's constructor
				public static final ModelLayerLocation LAYER_LOCATION = new ModelLayerLocation(new ResourceLocation("modid", "%(identifier_rl)"), "main");
				%(fields)

				public %(identifier)(ModelPart root) {
					%(model_parts)
				}

				public static LayerDefinition createBodyLayer() {
					MeshDefinition meshdefinition = new MeshDefinition();
					PartDefinition partdefinition = meshdefinition.getRoot();

					%(content)

					return LayerDefinition.create(meshdefinition, %(texture_width), %(texture_height));
				}

				@Override
				public void setupAnim(T entity, float limbSwing, float limbSwingAmount, float ageInTicks, float netHeadYaw, float headPitch) {

				}

				@Override
				public void renderToBuffer(PoseStack poseStack, VertexConsumer vertexConsumer, int packedLight, int packedOverlay, float red, float green, float blue, float alpha) {
					%(renderers)
				}
			}`,
		field: `private final ModelPart %(bone);`,
		model_part: `this.%(bone) = root.getChild("%(bone)");`,
		bone:
			`?(has_no_parent)PartDefinition %(bone) = partdefinition.addOrReplaceChild("%(bone)", CubeListBuilder.create()
			?(has_parent)PartDefinition %(bone) = %(parent).addOrReplaceChild("%(bone)", CubeListBuilder.create()
			%(remove_n)%(cubes)
			?(has_rotation)%(remove_n), PartPose.offsetAndRotation(%(x), %(y), %(z), %(rx), %(ry), %(rz)));
			?(has_no_rotation)%(remove_n), PartPose.offset(%(x), %(y), %(z)));`,
		renderer: `%(bone).render(poseStack, vertexConsumer, packedLight, packedOverlay, red, green, blue, alpha);`,
		cube: `.texOffs(%(uv_x), %(uv_y)){?(has_mirror).mirror()}.addBox(%(x), %(y), %(z), %(dx), %(dy), %(dz), new CubeDeformation(%(inflate))){?(has_mirror).mirror(false)}`,
	},

	get(key, version = Project.modded_entity_version) {
		let temp = Templates[version][key];
		if (typeof temp === 'string') temp = temp.replace(/\t\t\t/g, '');
		return temp;
	},
	keepLine(line) {
		return line.replace(/\?\(\w+\)/, '');
	},
	getVariableRegex(name) {
		return new RegExp(`%\\(${name}\\)`, 'g');
	}
}

function getIdentifier() {
	return (Project.geometry_name && Project.geometry_name.replace(/[\s-]+/g, '_')) || 'custom_model';
}

function askToSaveProject() {
	if (isApp && Project.save_path && fs.existsSync(Project.save_path)) return;
	Blockbench.showMessageBox({
		translateKey: 'cannot_re_import',
		buttons: ['dialog.save', 'dialog.cancel']
	}, button => {
		if (button == 0) BarItems.save_project.click();
	})
}

var codec = new Codec('modded_entity', {
	name: 'Java Class',
	extension: 'java',
	remember: true,
	load_filter: {
		type: 'text',
		extensions: ['java']
	},
	compile(options) {

		let R = Templates.getVariableRegex;
		let identifier = getIdentifier();

		let all_groups = getAllGroups();
		let loose_cubes = [];
		Cube.all.forEach(cube => {
			if (cube.parent == 'root') loose_cubes.push(cube)
		})
		if (loose_cubes.length) {
			let group = new Group({
				name: 'bb_main'
			});
			group.is_catch_bone = true;
			group.createUniqueName()
			all_groups.push(group)
			group.children.replace(loose_cubes)
		}

		all_groups.slice().forEach(group => {
			let subgroups = [];
			let group_i = all_groups.indexOf(group);
			group.children.forEachReverse(cube => {
				if (cube instanceof Cube == false || !cube.export) return;
				if (!cube.rotation.allEqual(0)) {
					let sub = subgroups.find(s => {
						if (!s.rotation.equals(cube.rotation)) return false;
						if (s.rotation.filter(n => n).length > 1) {
							return s.origin.equals(cube.origin)
						} else {
							for (var i = 0; i < 3; i++) {
								if (s.rotation[i] == 0 && s.origin[i] != cube.origin[i]) return false;
							}
							return true;
						}
					})
					if (!sub) {
						sub = new Group({
							rotation: cube.rotation,
							origin: cube.origin,
							name: `${cube.name}_r1`
						})
						sub.parent = group;
						sub.is_rotation_subgroup = true;
						sub.createUniqueName(all_groups)
						subgroups.push(sub)
						group_i++;
						all_groups.splice(group_i, 0, sub);
					}
					sub.children.push(cube);
				}
			})
		})

		let model = Templates.get('file');

		model = model.replace(R('bb_version'), Blockbench.version);
		model = model.replace(R('identifier'), identifier);
		model = model.replace(R('identifier_rl'), identifier.toLowerCase().replace(' ', '_'));
		model = model.replace(R('texture_width'), Project.texture_width);
		model = model.replace(R('texture_height'), Project.texture_height);

		model = model.replace(R('fields'), () => {
			let usesLayerDef = Templates.get('use_layer_definition')
			let group_snippets = [];
			for (var group of all_groups) {
				if ((group instanceof Group === false && !group.is_catch_bone) || !group.export || (usesLayerDef && group.parent instanceof Group)) continue;
				let snippet = Templates.get('field')
					.replace(R('bone'), group.name)
				group_snippets.push(snippet);
			}
			return group_snippets.join('\n\t')
		});

		model = model.replace(R('content'), () => {

			let group_snippets = [];
			for (var group of all_groups) {

				if ((group instanceof Group === false && !group.is_catch_bone) || !group.export) continue;
				let snippet = Templates.get('bone')

					.replace(R('bone'), group.name)

					.replace(/\n\?\(has_rotation\).+/, group.rotation.allEqual(0) ? '' : Templates.keepLine)
					.replace(/\n\?\(has_no_rotation\).+/, group.rotation.allEqual(0) ? Templates.keepLine : '')


				snippet = snippet
					.replace(R('rx'), F(Math.degToRad(-group.rotation[0])))
					.replace(R('ry'), F(Math.degToRad(-group.rotation[1])))
					.replace(R('rz'), F(Math.degToRad(group.rotation[2])))


				var origin = group.origin.slice();
				if (group.parent instanceof Group) {
					origin.V3_subtract(group.parent.origin)
				}
				origin[0] *= -1;
				if (Project.modded_entity_flip_y) {
					origin[1] *= -1;
					if (group.parent instanceof Group === false) {
						origin[1] += 24
					}
				}

				snippet = snippet
					.replace(R('x'), F(origin[0]))
					.replace(R('y'), F(origin[1]))
					.replace(R('z'), F(origin[2]))

					.replace(/(?:\n|^)\?\(has_parent\).+/, group.parent instanceof Group ? Templates.keepLine : '')
					.replace(/(?:\n|^)\?\(has_no_parent\).+/, group.parent instanceof Group ? '' : Templates.keepLine)
					.replace(/(?:\n|^)%\(remove_n\)/g, '')
					.trim()
					.replace(R('parent'), group.parent.name)

					.replace(R('cubes'), () => {

						let cube_snippets = [];
						for (var cube of group.children) {
							if (cube instanceof Cube === false || !cube.export || (!cube.rotation.allEqual(0) && !group.is_rotation_subgroup)) continue;

							let c_snippet = Templates.get('cube')
								.replace(R('bone'), group.name)

								.replace(R('uv_x'), I(cube.uv_offset[0]))
								.replace(R('uv_y'), I(cube.uv_offset[1]))

								.replace(R('inflate'), F(cube.inflate))
								.replace(/{\?\(has_mirror\)(.+?)}/g, cube.mirror_uv == true ? '$1' : '')
								.replace(R('mirror'), cube.mirror_uv)

							if (Project.modded_entity_flip_y) {
								c_snippet = c_snippet
									.replace(R('x'), F(group.origin[0] - cube.to[0]) )
									.replace(R('y'), F(-cube.from[1] - cube.size(1) + group.origin[1]) )
									.replace(R('z'), F(cube.from[2] - group.origin[2]) )

							} else {
								c_snippet = c_snippet
									.replace(R('x'), F(group.origin[0] - cube.to[0]) )
									.replace(R('y'), F(cube.from[1] - group.origin[1]) )
									.replace(R('z'), F(cube.from[2] - group.origin[2]) )
							}
							if (Templates.get('integer_size')) {
								c_snippet = c_snippet
									.replace(R('dx'), I(cube.size(0, true)) )
									.replace(R('dy'), I(cube.size(1, true)) )
									.replace(R('dz'), I(cube.size(2, true)) )

							} else {
								c_snippet = c_snippet
									.replace(R('dx'), F(cube.size(0, true)) )
									.replace(R('dy'), F(cube.size(1, true)) )
									.replace(R('dz'), F(cube.size(2, true)) )
							}

							cube_snippets.push(c_snippet);
						}
						return cube_snippets.join('\n');
					})
					.replace(/\n/g, '\n\t\t')
					
				group_snippets.push(snippet);
			}
			return group_snippets.join('\n\n\t\t')
		});

		model = model.replace(R('model_parts'), () => {
			let snippet = Templates.get('model_part')
			if (snippet == null)
				return '';

			let group_snippets = [];
			for (var group of all_groups) {
				if ((group instanceof Group === false && !group.is_catch_bone) || !group.export || group.parent instanceof Group) continue;
				let modelPart = snippet
					.replace(R('bone'), group.name);
				group_snippets.push(modelPart);
			}
			return group_snippets.join('\n\t\t')
		})

		model = model.replace(R('renderers'), () => {
			let group_snippets = [];
			for (var group of all_groups) {
				if ((group instanceof Group === false && !group.is_catch_bone) || !group.export) continue;
				if (!Templates.get('render_subgroups') && group.parent instanceof Group) continue;

				let snippet = Templates.get('renderer')
					.replace(R('bone'), group.name)
				group_snippets.push(snippet);
			}
			return group_snippets.join('\n\t\t')
		});

		let event = {model, options};
		this.dispatchEvent('compile', event);
		return event.model;
	},
	parse(model, path, add) {
		this.dispatchEvent('parse', {model});

		var lines = [];
		model.split('\n').forEach(l => {
			l = l.replace(/\/\*[^(\*\/)]*\*\/|\/\/.*/g, '').trim().replace(/;$/, '');
			if (l) {
				lines.push(l)
			}
		})

		function parseScheme(scheme, input) {
			scheme = scheme.replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\./g, '\\.');
			var parts = scheme.split('$');
			var results = [];
			var location = 0;
			var i = 0;
			for (var part of parts) {
				if (i == 0) {
					var partmatch = new RegExp('^'+part).exec(input);
					if (partmatch == null) return;

					location = partmatch[0].length;
				} else {
					var key = part.substr(0, 1);
					part = part.substr(1);
					var key_regex = '';
					switch (key) {
						case 'v': key_regex = '^[a-zA-Z_][a-zA-Z0-9_]+'; break;
						case 'i': key_regex = '^-?\\d+'; break;
						case 'f': key_regex = '^-?\\d+\\.?\\d*[Ff]'; break;
						case 'd': key_regex = '^-?\\d+\\.?\\d*'; break;
						case 'b': key_regex = '^true|false'; break;
					}
					var partmatch = new RegExp(key_regex+part).exec(input.substr(location));
					if (partmatch == null) return;


					var variable = new RegExp(key_regex).exec(input.substr(location))[0];
					switch (key) {
						case 'v': results.push(variable); break;
						case 'i': results.push(parseInt(variable)); break;
						case 'f': results.push(parseFloat(variable.replace(/F$/, ''))); break;
						case 'd': results.push(parseFloat(variable.replace(/F$/, ''))); break;
						case 'b': results.push(variable == 'true'); break;
					}
					location += partmatch[0].length;
				}

				i++;
			}
			match = results;
			return true;
		}
		var scope = 0,
			bones = {},
			geo_name,
			match,
			last_uv;

		lines.forEach(line => {
			if (scope == 0) {
				if (/^public class/.test(line)) {
					scope = 1;
					geo_name = line.split(/[\s<>()\.]+/g)[2];
				}
			} else if (scope == 1) {
				line = line.replace(/public |static |final |private |void /g, '').trim();
				if (line.substr(0, 13) == 'ModelRenderer' || line.substr(0, 13) == 'RendererModel') {
					let name = line.split(' ')[1];
					bones[name] = new Group({
						name,
						origin: [0, 24, 0]
					}).init();
				} else if (line.substr(0, geo_name.length) == geo_name) {
					scope = 2;
				}

			} else if (scope == 2) {
				line = line.replace(/^this\./, '');
				match = undefined;
				
				if (line == '}') {
					scope--;
				} else


				if (parseScheme('textureWidth = $i', line) || parseScheme('texWidth = $i', line)) {
					Project.texture_width = match[0];
				} else
				
				if (parseScheme('textureHeight = $i', line) || parseScheme('texHeight = $i', line)) {
					Project.texture_height = match[0];
				} else
				
				if (parseScheme('super($v, $i, $i)', line)) {
					Project.texture_width = match[1];
					Project.texture_height = match[2];
				} else
				
				if (
					parseScheme('ModelRenderer $v = new ModelRenderer(this, $i, $i)', line) ||
					parseScheme('RendererModel $v = new RendererModel(this, $i, $i)', line) ||
					parseScheme('$v = new ModelRenderer(this, $i, $i)', line) ||
					parseScheme('$v = new RendererModel(this, $i, $i)', line)
				) {
					if (!bones[match[0]]) {
						bones[match[0]] = new Group({
							name: match[0],
							origin: [0, 24, 0]
						}).init();
					}
					last_uv = [match[1], match[2]];
				} else
				
				if (
					parseScheme('$v = new ModelRenderer(this)', line)
				) {
					// Blockbench for 1.15
					if (!bones[match[0]]) {
						bones[match[0]] = new Group({
							name: match[0],
							origin: [0, 0, 0]
						}).init();
					}
				} else
				
				if (parseScheme('$v.setRotationPoint($f, $f, $f)', line) || parseScheme('$v.setPos($f, $f, $f)', line)) {
					var bone = bones[match[0]]
					if (bone) {
						bone.extend({origin: [-match[1], 24-match[2], match[3]]});
						bone.children.forEach(cube => {
							if (cube instanceof Cube) {
								cube.from[0] += bone.origin[0]; cube.to[0] += bone.origin[0];
								cube.from[1] += bone.origin[1]-24; cube.to[1] += bone.origin[1]-24;
								cube.from[2] += bone.origin[2]; cube.to[2] += bone.origin[2];
							}
						})
					}
				} else
				
				if (parseScheme('$v.addChild($v)', line.replace(/\(this\./g, '('))) {
					var child = bones[match[1]], parent = bones[match[0]];
					child.addTo(parent);
					child.origin.V3_add(parent.origin)
					child.origin[1] -= 24;

					child.children.forEach(cube => {
						if (cube instanceof Cube) {
							cube.from[0] += parent.origin[0]; cube.to[0] += parent.origin[0];
							cube.from[1] += parent.origin[1]-24; cube.to[1] += parent.origin[1]-24;
							cube.from[2] += parent.origin[2]; cube.to[2] += parent.origin[2];
						}
					})
				} else
				
				//Cubes
				if (parseScheme('$v.cubeList.add(new ModelBox($v, $i, $i, $f, $f, $f, $i, $i, $i, $f, $b))', line) || parseScheme('$v.cubes.add(new ModelBox($v, $i, $i, $f, $f, $f, $i, $i, $i, $f, $b))', line)) {
					var group = bones[match[0]];
					var cube = new Cube({
						name: match[0],
						uv_offset: [match[2], match[3]],
						from: [
							group.origin[0] - match[4] - match[7],
							group.origin[1] - match[5] - match[8],
							group.origin[2] + match[6]
						],
						inflate: match[10],
						mirror_uv: match[11],
					})
					cube.extend({
						to: [
							cube.from[0] + Math.floor(match[7]),
							cube.from[1] + Math.floor(match[8]),
							cube.from[2] + Math.floor(match[9]),
						]
					});
					cube.addTo(bones[match[0]]).init();
				} else
				
				if (parseScheme('$v.addBox($f, $f, $f, $i, $i, $i)', line)
				 || parseScheme('$v.addBox($f, $f, $f, $i, $i, $i, $v)', line)
				 || parseScheme('$v.addBox($f, $f, $f, $i, $i, $i, $f)', line)
				 || parseScheme('$v.addBox($f, $f, $f, $f, $f, $f, $f, $f, $f)', line)
				) {
					var group = bones[match[0]];
					var cube = new Cube({
						name: match[0],
						uv_offset: last_uv,
						from: [
							group.origin[0] - match[1] - match[4],
							group.origin[1] - match[2] - match[5],
							group.origin[2] + match[3]
						],
						inflate: (typeof match[7] == 'number' ? match[7] : 0),
						mirror_uv: group.mirror_uv
					})
					cube.extend({
						to: [
							cube.from[0] + Math.floor(match[4]),
							cube.from[1] + Math.floor(match[5]),
							cube.from[2] + Math.floor(match[6]),
						]
					});
					cube.addTo(bones[match[0]]).init();
				} else
				
				if (parseScheme('$v.setTextureOffset($i, $i).addBox($f, $f, $f, $f, $f, $f, $f, $b)', line) ||
					parseScheme('$v.texOffs($i, $i).addBox($f, $f, $f, $f, $f, $f, $f, $b)', line)
				) {
					var group = bones[match[0]];
					var cube = new Cube({
						name: match[0],
						uv_offset: [match[1], match[2]],
						from: [
							group.origin[0] - match[3] - match[6],
							group.origin[1] - match[4] - match[7],
							group.origin[2] + match[5]
						],
						inflate: match[9],
						mirror_uv: match[10]
					})
					cube.extend({
						to: [
							cube.from[0] + Math.floor(match[6]),
							cube.from[1] + Math.floor(match[7]),
							cube.from[2] + Math.floor(match[8]),
						]
					});
					cube.addTo(bones[match[0]]).init();
				} else


				//Rotation
				if (parseScheme('setRotationAngle($v, $f, $f, $f)', line)) {
					//blockbench
					var group = bones[match[0]];
					if (group) {
						group.extend({
							rotation: [
								-Math.radToDeg(match[1]),
								-Math.radToDeg(match[2]),
								Math.radToDeg(match[3]),
							]
						})
					}
				} else
				
				if (parseScheme('setRotation($v, $f, $f, $f)', line)) {
					//cubik
					var group = bones[match[0]];
					if (group) {
						group.extend({
							rotation: [
								-Math.radToDeg(match[1]),
								-Math.radToDeg(match[2]),
								Math.radToDeg(match[3]),
							]
						})
					}
				} else
				
				if (parseScheme('setRotateAngle($v, $f, $f, $f)', line)) {
					//tabula
					var group = bones[match[0]];
					if (group) {
						group.extend({
							rotation: [
								-Math.radToDeg(match[1]),
								-Math.radToDeg(match[2]),
								Math.radToDeg(match[3]),
							]
						})
					}
				} else

				if (parseScheme('$v.rotateAngleX = $f', line) || parseScheme('$v.xRot = $f', line)) {
					//default
					var group = bones[match[0]];
					if (group) {
						group.rotation[0] = -Math.radToDeg(match[1]);
					}
				} else
				if (parseScheme('$v.rotateAngleY = $f', line) || parseScheme('$v.yRot = $f', line)) {
					//default
					var group = bones[match[0]];
					if (group) {
						group.rotation[1] = -Math.radToDeg(match[1]);
					}
				} else
				if (parseScheme('$v.rotateAngleZ = $f', line) || parseScheme('$v.zRot = $f', line)) {
					//default
					var group = bones[match[0]];
					if (group) {
						group.rotation[2] = Math.radToDeg(match[1]);
					}
				} else
				
				if (parseScheme('$v.mirror = $b', line)) {
					var group = bones[match[0]];
					group.mirror_uv = match[1];
					group.children.forEach(cube => {
						cube.mirror_uv = match[1];
					});
				}
			}
		})
		Project.geometry_name = geo_name;
		this.dispatchEvent('parsed', {model});
		Canvas.updateAllBones();
		Validator.validate()
	},
	afterDownload(path) {
		if (this.remember) {
			Project.saved = true;
		} else if (!open_interface) {
			askToSaveProject();
		}
		Blockbench.showQuickMessage(tl('message.save_file', [path ? pathToName(path, true) : this.fileName()]));
	},
	afterSave(path) {
		var name = pathToName(path, true)
		if (Format.codec == this || this.id == 'project') {
			Project.export_path = path;
			Project.name = pathToName(path, false);
		}
		if (this.remember) {
			Project.saved = true;
			addRecentProject({
				name,
				path: path,
				icon: this.id == 'project' ? 'icon-blockbench_file' : Format.icon
			});
			updateRecentProjectThumbnail();
		} else if (!open_interface) {
			askToSaveProject();
		}
		Blockbench.showQuickMessage(tl('message.save_file', [name]));
	},
	fileName() {
		return getIdentifier();
	}
})
codec.templates = Templates;
Object.defineProperty(codec, 'remember', {
	get() {
		return !!Codecs.modded_entity.templates[Project.modded_entity_version].remember
	}
})

var format = new ModelFormat({
	id: 'modded_entity',
	icon: 'icon-format_java',
	category: 'minecraft',
	target: 'Minecraft: Java Edition',
	format_page: {
		content: [
			{type: 'h3', text: tl('mode.start.format.informations')},
			{text: `* ${tl('format.modded_entity.info.integer_size')}
					* ${tl('format.modded_entity.info.format')}`.replace(/\t+/g, '')
			}
		]
	},
	codec,
	box_uv: true,
	single_texture: true,
	bone_rig: true,
	centered_grid: true,
	rotate_cubes: true,
	integer_size: true
})
//Object.defineProperty(format, 'integer_size', {get: _ => Templates.get('integer_size')})
codec.format = format;


BARS.defineActions(function() {
	new Action({
		id: 'export_class_entity',
		icon: 'free_breakfast',
		category: 'file',
		condition: () => Format == format,
		click: function () {
			codec.export()
		}
	})
})

})()