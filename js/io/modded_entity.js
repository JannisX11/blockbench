(function() {

var codec = new Codec('modded_entity', {
	name: 'Java Class',
	extension: 'java',
	remember: true,
	compile(options) {
		function F(num) {
			var s = trimFloatNumber(num) + '';
			if (!s.includes('.')) {
				s += '.0';
			}
			return s+'F';
		}

		var bone_nr = 1
		var model_id = Project.geometry_name.replace(/[\s-]+/g, '_') || 'custom_model';
		var all_groups = getAllGroups();
		var renderers = {};

		var ver = settings.class_export_version.value == '1.14' ? 1 : 0;
		var rendererName = ver == 1 ? 'RendererModel' : 'ModelRenderer'

		var loose_cubes = []
		Outliner.root.forEach(obj => {
			if (obj.type === 'cube') {
				loose_cubes.push(obj)
			}
		})
		if (loose_cubes.length) {
			var group = {
				name: 'bb_main',
				rotation: [0, 0, 0],
				origin: [0, 0, 0],
				parent: 'root',
				children: loose_cubes
			}
			all_groups.splice(0, 0, group)
		}

		all_groups.forEach((g) => {
			//model += `\nthis.bone${bone_nr} = new ModelRenderer`
			var id = g.name
			bone_nr++;
			if (g.export === false) return;

			var bone = {
				id: id,
				rootBone: g.parent instanceof Group == false,
				lines: [
					`${id} = new ${rendererName}(this);`,//Texture Offset
				]
			}
			var origin = [-g.origin[0], -g.origin[1], g.origin[2]]
			//Rotation
			if (!g.rotation.allEqual(0)) {
				bone.lines.push(
					`setRotationAngle(${id}, ${
						F(Math.degToRad(-g.rotation[0])) }, ${
						F(Math.degToRad(-g.rotation[1])) }, ${
						F(Math.degToRad(g.rotation[2])) });`
				)
			}
			//Parent
			if (!bone.rootBone && all_groups.indexOf(g.parent) >= 0) {
				bone.lines.push(
					`${ g.parent.name }.addChild(${id});`
				)
				origin[0] += g.parent.origin[0]
				origin[1] += g.parent.origin[1]
				origin[2] -= g.parent.origin[2]
			} else {
				origin[1] += 24
			}
			//origin
			bone.lines.splice(1, 0, 
				`${id}.setRotationPoint(${F(origin[0])}, ${F(origin[1])}, ${F(origin[2])});`
			)

			//Boxes
			g.children.forEach((obj) => {
				if (obj.export === false || obj.type !== 'cube') return;
				var values = [
					''+id,
					Math.floor(obj.uv_offset[0]),
					Math.floor(obj.uv_offset[1]),
					F(g.origin[0] - obj.to[0]),
					F(-obj.from[1] - obj.size(1, true) + g.origin[1]),
					F(obj.from[2] - g.origin[2]),
					obj.size(0, true),
					obj.size(1, true),
					obj.size(2, true),
					F(obj.inflate),
					obj.mirror_uv
				]
				bone.lines.push(
					`${id}.cubeList.add(new ModelBox(${ values.join(', ') }));`
				)
			})

			renderers[id] = bone;

		})


		var model = (settings.credit.value
				? '//'+settings.credit.value+'\n'
				: '')+
			'//Paste this code into your mod.\n' +
			'\nimport org.lwjgl.opengl.GL11;'+
			'\nimport net.minecraft.client.model.ModelBase;'+
			'\nimport net.minecraft.client.model.ModelBox;'+
			`\nimport net.minecraft.client.model.${rendererName};`+
			'\nimport net.minecraft.client.renderer.GlStateManager;'+
			'\nimport net.minecraft.entity.Entity;\n';
		if (ver == 1) {
			model += '\npublic class '+model_id+' extends EntityModel {';
		} else {
			model += '\npublic class '+model_id+' extends ModelBase {';
		}

		for (var r_id in renderers) {
			model += `\n	private final ${rendererName} ${r_id};`;
		}

		model += '\n'+
			 '\n	public '+model_id+'() {'+
			 '\n		textureWidth = '+	(Project.texture_width || 32)	+';'+
			 '\n		textureHeight = '+	(Project.texture_height|| 32)	+';\n';

		for (var r_id in renderers) {
			model += `\n		${renderers[r_id].lines.join('\n		')}\n`;
		}

		model +=
			 '	}\n'+
			 '\n	@Override'+
			 '\n	public void render(Entity entity, float f, float f1, float f2, float f3, float f4, float f5) {'
		
		for (var r_id in renderers) {
			if (renderers[r_id].rootBone) {
				model += `\n		${r_id}.render(f5);`;
			}
		}
		model +=
			 '\n	}'+
			 `\n	public void setRotationAngle(${rendererName} modelRenderer, float x, float y, float z) {`+
			 '\n		modelRenderer.rotateAngleX = x;'+
			 '\n		modelRenderer.rotateAngleY = y;'+
			 '\n		modelRenderer.rotateAngleZ = z;'+
			 '\n	}'+
			 '\n}';
		return model;
	},
	parse(model, path, add) {
		// WIP //
		var lines = [];
		model.split('\n').forEach(l => {
			l = l.replace(/\/\*[^(\*\/)]*\*\/|\/\/.*/g, '').trim().replace(/;$/, '');
			if (l) {
				lines.push(l)
			}
		})

		var getArgs = function(input) {
			var i = input.search('(')
			var args = input.substr(i+1).replace(/\)$/, '');
			return args.split(/, ?/);
		}
		function parseScheme(scheme, input) {
			scheme = scheme.replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\./g, '\\.');
			var parts = scheme.split('$');
			var regexstring = '';
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
						case 'f': key_regex = '^-?\\d+\\.?\\d*F'; break;
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
					bones[line.split(' ')[1]] = new Group({
						name: line.split(' ')[1],
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


				if (parseScheme('textureWidth = $i', line)) {
					Project.texture_width = match[0];
				} else
				
				if (parseScheme('textureHeight = $i', line)) {
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
				
				if (parseScheme('$v.setRotationPoint($f, $f, $f)', line)) {
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
					child.origin[0] += parent.origin[0];
					child.origin[1] += parent.origin[1] - 24;
					child.origin[2] += parent.origin[2];
					child.children.forEach(cube => {
						if (cube instanceof Cube) {
							cube.from[0] += parent.origin[0]; cube.to[0] += parent.origin[0];
							cube.from[1] += parent.origin[1]-24; cube.to[1] += parent.origin[1]-24;
							cube.from[2] += parent.origin[2]; cube.to[2] += parent.origin[2];
						}
					})
				} else
				
				//Cubes
				if (parseScheme('$v.cubeList.add(new ModelBox($v, $i, $i, $f, $f, $f, $i, $i, $i, $f, $b))', line)) {
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
							cube.from[0] + match[7],
							cube.from[1] + match[8],
							cube.from[2] + match[9],
						]
					});
					cube.addTo(bones[match[0]]).init();
				} else
				
				if (parseScheme('$v.addBox($f, $f, $f, $i, $i, $i)', line)
				 || parseScheme('$v.addBox($f, $f, $f, $i, $i, $i, $v)', line)
				 || parseScheme('$v.addBox($f, $f, $f, $i, $i, $i, $f)', line)
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
							cube.from[0] + match[4],
							cube.from[1] + match[5],
							cube.from[2] + match[6],
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

				if (parseScheme('$v.rotateAngleX = $f', line)) {
					//default
					var group = bones[match[0]];
					if (group) {
						group.rotation[0] = -Math.radToDeg(match[1]);
					}
				} else
				if (parseScheme('$v.rotateAngleY = $f', line)) {
					//default
					var group = bones[match[0]];
					if (group) {
						group.rotation[1] = -Math.radToDeg(match[1]);
					}
				} else
				if (parseScheme('$v.rotateAngleZ = $f', line)) {
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
		Canvas.updateAll();
	}
})

var format = new ModelFormat({
	id: 'modded_entity',
	icon: 'icon-format_java',
	codec,
	box_uv: true,
	single_texture: true,
	integer_size: true,
	bone_rig: true,
	centered_grid: true,
})
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