import { Filesystem } from "../../file_system";
import { BoundingBox, BoundingBoxFunction } from "../../outliner/types/bounding_box";

type BoxSchema = {
	min: ArrayVector3,
	max: ArrayVector3,
}
type MainSchema = {
	description: {
		identifier: string
	}
	shape: {
		boxes: BoxSchema[]
	}
}

var codec = new Codec('bedrock_voxel_shape', {
	name: 'Bedrock Voxel Shape',
	extension: 'json',
	remember: true,
	support_partial_export: true,
	load_filter: {
		type: 'json',
		extensions: ['json'],
		condition(model) {
			return model['minecraft:voxel_shape'];
		}
	},
	parse(model, path, args = {}) {

		this.dispatchEvent('parse', {model});

		let main = model["minecraft:voxel_shape"] as MainSchema;
		if (main.description.identifier && !args.import_to_current_project) {
			Project.model_identifier = main.description.identifier;
		}

		let bounding_boxes: BoundingBox[] = [];
		let groups = [];
		if (args.import_to_current_project) {
			Undo.initEdit({elements: bounding_boxes, groups, outliner: true});
		}

		let group = new Group({
			name: 'voxel_shape',
		}).init();
		const offset: ArrayVector3 = [-8, 0, -8];
		let i = 0;
		for (let box_template of main.shape.boxes) {
			let bounding_box = new BoundingBox({
				from: box_template.min.slice().V3_add(offset),
				to: box_template.max.slice().V3_add(offset),
				color: 6
			});
			bounding_box.init().addTo(group);
			bounding_boxes.push(bounding_box);
			i++;
		}

		if (args.import_to_current_project) {
			groups.push(group);
			Undo.finishEdit('Import bounding box');
		}

		this.dispatchEvent('parsed', {model});
		Validator.validate();
	},
	compile(options: any = {}) {

		let main_tag: MainSchema = {
			description: {
				identifier: Project.model_identifier
			},
			shape: {boxes: []}
		}

		const offset: ArrayVector3 = [-8, 0, -8];
		for (let element of BoundingBox.all) {
			let box = element as BoundingBox;
			if (box.export == false) continue;
			let box_template: BoxSchema = {
				min: box.from.slice().V3_subtract(offset),
				max: box.to.slice().V3_subtract(offset),
			}
			main_tag.shape.boxes.push(box_template);
		}

		let file_object = {
			"format_version": "1.21.110",
			"minecraft:voxel_shape": main_tag
		}

		this.dispatchEvent('compile', {model: file_object, options});

		if (options.raw) {
			return file_object
		} else {
			return autoStringify(file_object)
		}
	},
	fileName() {
		var name = Project.name||'model';
		if (!name.match(/\.geo$/)) {
			name += '.geo';
		}
		return name;
	},
})

export function loadBedrockCollisionFromJSON(json: any, name: string, undo: boolean = false): BoundingBox[] {
	if (json instanceof Array == false) json = [json];
	let bounding_boxes: BoundingBox[] = [];
	Outliner.selected.empty();
	for (let box of json) {
		if (typeof box != 'object' || box.origin instanceof Array == false || box.size instanceof Array == false) return;
		if (bounding_boxes.length == 0 && undo) {
			Undo.initEdit({elements: bounding_boxes, outliner: true});
		}
		let bb = new BoundingBox({
			name,
			from: [-(box.origin[0]+box.size[0]), box.origin[1], box.origin[2]],
			to: [-box.origin[0], box.origin[1] + box.size[1], box.origin[2] + box.size[2]],
			function: [name == 'selection' ? 'hitbox' : 'collision'],
			color: name == 'selection' ? 0 : 2
		});
		bb.addTo().init();
		bounding_boxes.push(bb);
		bb.markAsSelected();
	}
	updateSelection();
	if (bounding_boxes.length && undo) {
		Undo.finishEdit('Paste bounding boxes');
	}
	return bounding_boxes;
}

BARS.defineActions(function() {
	codec.format = Formats.bedrock_block;
	codec.export_action = new Action('export_bedrock_voxel_shape', {
		icon: 'fa-cubes',
		category: 'file',
		condition: {formats: ['bedrock_block'], method: () => BoundingBox.all.length > 0},
		click() {
			codec.export()
		}
	})
	new Action('import_bedrock_voxel_shape', {
		icon: 'fa-cubes',
		category: 'file',
		condition: {formats: ['bedrock_block']},
		click() {
			Filesystem.importFile({
				resource_id: 'bedrock_voxel_shape',
				extensions: ['json'],
				type: 'Voxel Shape',
				multiple: true,
				readtype: 'text'
			}, files => {
				for (let file of files) {
					let json = autoParseJSON(file.content as string);
					codec.parse(json, file.path, {import_to_current_project: true});
				}
			})
		}
	})
	type CollisionBoxJSON = {
		origin: ArrayVector3
		size: ArrayVector3
	}

	new Action('generate_bedrock_block_box', {
		icon: 'fa-cubes',
		category: 'file',
		condition: {formats: ['bedrock_block']},
		click() {
			if (!BoundingBox.all.length) {
				return Blockbench.showQuickMessage('dialog.bedrock_bounding_box.no_bounding_boxes');
			}

			function generate(type: 'collision_box' | 'selection_box', minify: boolean) {
				let bounding_boxes = BoundingBox.all as BoundingBox[];
				if (bounding_boxes.some(box => box.function.length)) {
					let func: BoundingBoxFunction = type == 'collision_box' ? 'collision' : 'hitbox';
					bounding_boxes = bounding_boxes.filter(box => box.function.includes(func));
				}
				let box_data: CollisionBoxJSON[] = bounding_boxes.map(bb => {
					return {
						origin: [-bb.to[0], bb.from[1], bb.from[2]],
						size: bb.size()
					}
				});
				if (type == 'selection_box') box_data.length = 1;
				let data = box_data as any;
				if (box_data.length == 1 && box_data[0].origin.equals([-8, 0, -8]) && box_data[0].size.equals([16, 16, 16])) {
					data = true;
				} else if (box_data.length == 1) {
					data = box_data[0];
				} else if (box_data.length == 0) {
					data = false;
				}
				let key = `"minecraft:${type}": `;
				return key + compileJSON(data, {small: minify})
			}
			new Dialog({
				id: 'generate_bedrock_block_box',
				title: 'action.generate_bedrock_block_box',
				form: {
					type: {label: 'dialog.bedrock_bounding_box.type', type: 'inline_select', options: {
						collision_box: 'dialog.bedrock_bounding_box.type.collision_box',
						selection_box: 'dialog.bedrock_bounding_box.type.selection_box'
					}},
					minify: {type: 'checkbox', label: 'Minify'},
					output: {
						type: 'textarea',
						style: 'code',
						value: generate('collision_box', false),
						full_width: true,
						readonly: true,
						share_text: true
					}
				},
				onFormChange(result) {
					let text = generate(result.type as 'collision_box' | 'selection_box', result.minify as boolean);
					Dialog.open.setFormValues({output: text}, false);
				},
				singleButton: true,
			}).show();
		}
	})

	new Action('generate_bedrock_entity_box', {
		icon: 'fa-cubes',
		category: 'file',
		condition: {formats: ['bedrock']},
		click() {
			if (!BoundingBox.all.length) {
				return Blockbench.showQuickMessage('dialog.bedrock_bounding_box.no_bounding_boxes');
			}

			function generate(type: 'collision_box' | 'selection_box', minify: boolean) {
				let bounding_boxes = BoundingBox.all as BoundingBox[];
				if (bounding_boxes.some(box => box.function.length)) {
					let func: BoundingBoxFunction = type == 'collision_box' ? 'collision' : 'hitbox';
					bounding_boxes = bounding_boxes.filter(box => box.function.includes(func));
				}
				if (type == 'collision_box') {
					let key = `"minecraft:collision_box": `;
					let bb = bounding_boxes[0];
					let box = {
						width: bb.size(0) / 16,
						height: bb.size(1) / 16
					}
					return key + compileJSON(box, {small: minify})
				} else {
					let key = `"minecraft:custom_hit_test": `;
					let hitboxes = bounding_boxes.map(bb => {
						let center = bb.to.slice().V3_add(bb.from).V3_divide(2);
						return {
							width: bb.size(0) / 16,
							height: bb.size(1) / 16,
							pivot: [-center[0] / 16, center[1] / 16, center[2] / 16],
						}
					})
					return key + compileJSON({hitboxes}, {small: minify});
				}
			}
			new Dialog({
				id: 'generate_bedrock_entity_box',
				title: 'action.generate_bedrock_entity_box',
				form: {
					type: {label: 'dialog.bedrock_bounding_box.type', type: 'inline_select', options: {
						collision_box: 'dialog.bedrock_bounding_box.type.collision_box',
						hitbox: 'dialog.bedrock_bounding_box.type.hitbox'
					}},
					minify: {type: 'checkbox', label: 'Minify'},
					output: {
						type: 'textarea',
						style: 'code',
						value: generate('collision_box', false),
						full_width: true,
						readonly: true,
						share_text: true
					},
					collision_note: {type: 'info', text: 'dialog.bedrock_bounding_box.collision_note', condition: (r) => r.type == 'collision_box'},
					hitbox_note: {type: 'info', text: 'dialog.bedrock_bounding_box.hitbox_note', condition: (r) => r.type == 'hitbox'},
				},
				onFormChange(result) {
					let text = generate(result.type as 'collision_box' | 'selection_box', result.minify as boolean);
					Dialog.open.setFormValues({output: text}, false);
				},
				singleButton: true,
			}).show();
		}
	})
	
	const formats = ['bedrock', 'bedrock_block'];
	// @ts-ignore
	Blockbench.on('drop_text paste_text', (arg: {text: string}) => {
		if (!Format || !formats.includes(Format.id)) return;
		let text = arg.text.replace(/\s+/g, '');
		if (text.startsWith('"minecraft:selection_box"') || text.startsWith('"minecraft:collision_box"')) {
			let data = text.replace(/^"[^"]*"\s*:\s*/, '').replace(/[,\s]+$/, '');
			let json = autoParseJSON(data, true) as (CollisionBoxJSON | CollisionBoxJSON[]);
			if (!json) return;
			let name = /minecraft:(\w+)/.exec(text)?.[1] ?? 'box';
			loadBedrockCollisionFromJSON(json, name, true);
		}
	})
})

const global = {
	loadBedrockCollisionFromJSON
}
declare global {
	//const loadBedrockCollisionFromJSON: typeof global.loadBedrockCollisionFromJSON
}
Object.assign(window, global);
