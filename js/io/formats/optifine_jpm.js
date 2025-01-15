(function() {

var part_codec = new Codec('optifine_part', {
	name: 'OptiFine Part',
	extension: 'jpm',
	remember: true,
	support_partial_export: true,
	load_filter: {
		type: 'json',
		extensions: ['jpm']
	},
	compile(options) {
		let original_options = options??0;
		options = options ? Object.assign({}, options) : {};
		options.raw = true;
		options.build_part = true;
		let entitymodel = Codecs.optifine_entity.compile(options);
		let part_model = entitymodel.models[0];
		part_model.credit = entitymodel.credit;
		if (!part_model.textureSize) {
			part_model.textureSize = entitymodel.textureSize;
		}
		if (part_model.id == '') delete part_model.id;
		delete part_model.part;

		this.dispatchEvent('compile', {model: part_model, original_options});

		if (original_options.raw) {
			return part_model
		} else {
			return autoStringify(part_model)
		}
	},
	parse(model, path) {
		this.dispatchEvent('parse', {model});
		if (typeof model.credit == 'string') Project.credit = model.credit;
		if (model.textureSize) {
			Project.texture_width = parseInt(model.textureSize[0])||16;
			Project.texture_height = parseInt(model.textureSize[1])||16;
		}
		let jem_model = {
			_is_jpm: true,
			invertAxis: 'xy',
			models: [model]
		}
		Codecs.optifine_entity.parse(jem_model, path);
		this.dispatchEvent('parsed', {model});
	}
})


var part_format = new ModelFormat({
		name: 'OptiFine Part',
		id: 'optifine_part',
		extension: 'jpm',
		icon: 'icon-format_optifine',
		category: 'minecraft',
		show_on_start_screen: false,
		model_identifier: false,
		box_uv: true,
		optional_box_uv: true,
		per_group_texture: true,
		single_texture_default: true,
		per_texture_uv_size: true,
		integer_size: true,
		bone_rig: true,
		centered_grid: true,
		texture_folder: true,
		codec: part_codec
})
Object.defineProperty(part_format, 'integer_size', {get: _ => Project.box_uv})
part_codec.format = part_format;



BARS.defineActions(function() {
	part_codec.export_action = new Action('export_optifine_part', {
		name: 'Export OptiFine Part',
		description: 'Export a single part for an OptiFine model',
		icon: 'icon-optifine_file',
		category: 'file',
		condition: () => Format == part_format,
		click: function () {
			part_codec.export()
		}
	})
	new Action('import_optifine_part', {
		icon: 'icon-optifine_file',
		category: 'file',
		condition: () => (Format.id == 'optifine_entity' || Format.id == 'optifine_part'),
		click: function () {
			Blockbench.import({
				resource_id: 'model',
				extensions: ['jpm'],
				type: 'JPM Entity Part Model',
				multiple: true,
			}, function(files) {
				files.forEach(file => {
					var model = autoParseJSON(file.content)
					part_codec.parse(model, file.path, true)
				})
			})
		}
	})
})


})()