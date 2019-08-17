(function() {

var codec = new Codec('modded_entity', {
	name: 'Java Class',
	extension: 'java',
	remember: false,
	compile(options) {
		function F(num) {
			var s = trimFloatNumber(num) + '';
			if (!s.includes('.')) {
				s += '.0';
			}
			return s+'F';
		}

		var bone_nr = 1
		var model_id = Project.geometry_name;
		var all_groups = getAllGroups()
		var renderers = {}

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
				rootBone: g.parent.type !== 'group',
				lines: [
					`${id} = new ModelRenderer(this);`,//Texture Offset
				]
			}
			var origin = [-g.origin[0], -g.origin[1], g.origin[2]]
			//Rotation
			if (!g.rotation.allEqual(0)) {
				bone.lines.push(
					`setRotationAngle(${id}, ${
						F(Math.degToRad(-g.rotation[0])) }, ${
						F(Math.degToRad(-g.rotation[1])) }, ${
						F(Math.degToRad(-g.rotation[2])) });`
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
			'\nimport net.minecraft.client.model.ModelRenderer;'+
			'\nimport net.minecraft.client.renderer.GlStateManager;'+
			'\nimport net.minecraft.entity.Entity;\n'+
			'\npublic class '+model_id+' extends ModelBase {'

		for (var r_id in renderers) {
			model += `\n	private final ModelRenderer ${r_id};`;
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
			 '\n	public void setRotationAngle(ModelRenderer modelRenderer, float x, float y, float z) {'+
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
		var scope = 0,
			bones = {},
			geo_name;

		lines.forEach(line => {
			if (scope == 0) {
				if (/^public class/.test(line)) {
					scope = 1;
					geo_name = line.split(' ')[2];
				}
			} else if (scope == 1) {
				line = line.replace(/Public|Static|Final|Private|Void/g, '').trim();
				if (line.substr(0, 13) == 'ModelRenderer') {
					bones[line.split('')[1]] = new Group().init();
				} else if (line.substr(0, geo_name.length) == geo_name) {
					scope = 2;
				}

			} else if (scope == 2) {
				line = line.replace(/^this\./, '');
				var key = line.match(/^\w+(?=[\.|  |=])/);
				key = key ? key[0] : '';
				if (key.length) {
					var action = line.substr(key.length).trim();
					if (key == 'textureWidth') {
						Project.texture_width = parseInt(action.replace(/=/), '');
					} else
					if (key == 'textureHeight') {
						Project.texture_height = parseInt(action.replace(/=/), '');
					} else
					if (bones[key]) {
						if (action.match(/^= ?new ModelRenderer\(/)) {
							var args = getArgs(action);
						} else
						if (action.match(/^\.setRotationPoint\(/)) {
							var args = getArgs(action);
							var origin = [];
							args.forEach((n, i) => {
								origin[i] = parseInt(n.replace(/F/, '')) * (i == 2 ? 1 : -1);
							})
							bones[key].extend({origin})
						} else
						if (action.match(/^\.cubeList\.add\(/)) {
							
						}
					}
				}
			}
		})

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