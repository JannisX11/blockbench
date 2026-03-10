import { MultiFileRuleset } from "../../multi_file_editing"
import { parseGeometry } from "./bedrock"
import { ModelLoader } from "./../../io/model_loader";
import { skin_presets } from "../minecraft/skin";
import { Filesystem } from "../../file_system";
import { Animation } from "../../animations/animation";
import { InputFormConfig } from "../../interface/form";
// @ts-ignore
import PlayerTexture from './../../../assets/player_skin.png'
import { splitCube } from "../../modeling/mesh/knife_tool";

const PLAYER_GEO = {
	"description": {
		"identifier": "geometry.default_player",
		"texture_width": 64,
		"texture_height": 64,
		"visible_bounds_width": 5,
		"visible_bounds_height": 4.5,
		"visible_bounds_offset": [0, 1.75, 0]
	},
	"bones": [
		{
			"name": "root",
			"pivot": [0, 0, 0]
		},
		{
			"name": "waist",
			"parent": "root",
			"pivot": [0, 12, 0]
		},
		{
			"name": "body",
			"parent": "waist",
			"pivot": [0, 24, 0],
			"cubes": [
				{"origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}
			]
		},
		{
			"name": "cape",
			"parent": "body",
			"pivot": [0, 24, 2],
			"cubes": [
				//{"origin": [-4, 10, 2], "size": [8, 14, 1], "uv": [-5, 1]}
				{
					"origin": [-4, 10, 2],
					"size": [8, 14, 1],
					"uv": {
						"north": {"uv": [36, 28], "uv_size": [1, 1]},
						"east": {"uv": [36, 28], "uv_size": [1, 1]},
						"south": {"uv": [36, 28], "uv_size": [1, 1]},
						"west": {"uv": [36, 28], "uv_size": [1, 1]},
						"up": {"uv": [37, 29], "uv_size": [-1, -1]},
						"down": {"uv": [37, 29], "uv_size": [-1, -1]}
					}
				}
			]
		},
		{
			"name": "head",
			"parent": "body",
			"pivot": [0, 24, 0],
			"cubes": [
				{"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]}
			]
		},
		{
			"name": "helmet",
			"parent": "head",
			"pivot": [0, 0, 0]
		},
		{
			"name": "rightArm",
			"parent": "body",
			"pivot": [-5, 22, 0],
			"cubes": [
				{"origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}
			]
		},
		{
			"name": "rightItem",
			"parent": "rightArm",
			"pivot": [-6, 15, 1],
		},
		{
			"name": "leftArm",
			"parent": "body",
			"pivot": [5, 22, 0],
			"cubes": [
				{"origin": [4, 12, -2], "size": [4, 12, 4], "uv": [32, 48]}
			]
		},
		{
			"name": "leftItem",
			"parent": "leftArm",
			"pivot": [6, 15, 1],
			"cubes": [
			]
		},
		{
			"name": "rightLeg",
			"parent": "root",
			"pivot": [-1.9, 12, 0],
			"cubes": [
				{"origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}
			]
		},
		{
			"name": "leftLeg",
			"parent": "root",
			"pivot": [1.9, 12, 0],
			"cubes": [
				{"origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [16, 48]}
			]
		}
	]
}


let attachable_ruleset = new MultiFileRuleset('bedrock_attachable', {
	scope_limited_animations: true,
	collections_as_files: true,
})

type AddedContent = {
	elements: OutlinerElement[]
	groups: Group[]
	nodes: OutlinerNode[]
	animations: _Animation[]
	textures: Texture[]
	collections: Collection[]
}
class AddedContentFinder {
	before: AddedContent
	constructor() {
		this.before = this.getCurrent();
	}
	getCurrent() {
		return {
			elements: Outliner.elements.slice(),
			groups: Group.all.slice(),
			nodes: (Group.all as OutlinerNode[]).concat(Outliner.elements),
			animations: Animation.all.slice(),
			textures: Texture.all.slice(),
			collections: Collection.all.slice(),
		}
	}
	find() {
		let data = this.getCurrent();
		for (let key in data) {
			data[key] = data[key].filter(a => this.before[key].indexOf(a) == -1);
		}
		return data;
	}
	findEmptyScope(): number {
		let scope = 1;
		for (let node of this.before.nodes) {
			if (scope == node.scope) scope++;
		}
		return scope;
	}
}

BARS.defineActions(function() {
	
	const player_loader = new ModelLoader('bedrock_player_model', {
		name: 'Bedrock Player Model',
		description: 'Default bedrock player model for making attachables and player animations',
		show_on_start_screen: false,
		icon: 'icon-player',
		target: 'Minecraft: Bedrock Edition',
		onStart: async function() {
			
			const can_import = Project && Format.id.includes('bedrock');
			const form: InputFormConfig = {
				model: {
					label: 'dialog.skin.model',
					type: 'select',
					value: 'steve',
					options: {
						steve: skin_presets.steve.display_name,
						alex: skin_presets.alex.display_name,
					}
				},
			};
			if (can_import) {
				form.import_as_attachable = {label: 'Import current model as attachable', value: true, type: 'checkbox'};
			}
			interface Result {
				import_as_attachable?: boolean
				model: 'steve' | 'alex'
			}
			let form_config = await new Promise<Result>((resolve, reject) => {
				new Dialog({
					title: 'Bedrock Player Model',
					form,
					onConfirm(result) {
						resolve(result)
					},
					onCancel() {
						reject();
					}
				}).show();
			});

			let import_bbmodel = form_config.import_as_attachable ? Codecs.project.compile() : null;
			let attachable_path = Project.export_path;

			setupProject(Formats.bedrock);

			let geo_copy = structuredClone(PLAYER_GEO);
			if (form_config.model == 'alex') {
				let right_arm = geo_copy.bones.find(b => b.name == 'rightArm');
				let left_arm = geo_copy.bones.find(b => b.name == 'leftArm');
				right_arm.cubes[0].size[0] = 3;
				right_arm.cubes[0].origin[0]++;
				right_arm.cubes[0].uv[0]++;
				left_arm.cubes[0].size[0] = 3;
				left_arm.cubes[0].uv[0]++;
			}
			parseGeometry({object: geo_copy}, {switch_to_existing_tab: false});

			Project.multi_file_ruleset = attachable_ruleset.id;


			let player_texture = new Texture({name: 'player.png', scope: 1}).fromDataURL(PlayerTexture).add(true, true);
			player_texture.saved = true;
			Outliner.nodes.forEach(node => {
				node.scope = 1;
			})
			new Collection({name: 'Player', scope: 1}).add();

			if (!Project.variable_placeholders.includes('.is_item_equipped')) {
				let text = `query.is_item_equipped = toggle('Holding Item')`;
				if (form_config.import_as_attachable) {
					text += `\nquery.equipped_item_is_attachable = true`;
				}
				Project.variable_placeholders = text + '\n' + Project.variable_placeholders;
				Panels.variable_placeholders.inside_vue.text = Project.variable_placeholders;
			}

			if (form_config.import_as_attachable) {
				let finder = new AddedContentFinder();
				
				let project_parsed = JSON.parse(import_bbmodel);
				Codecs.project.merge(project_parsed);

				let added = finder.find();

				[...added.elements, ...added.groups].forEach(node => {
					node.scope = 2;
				});
				for (let texture of Texture.all) {
					if (texture != player_texture) texture.scope = 2;
				}
				new Collection({
					name: project_parsed.name || 'Attachable',
					scope: 2,
					export_codec: 'bedrock',
					export_path: attachable_path,
					model_identifier: project_parsed.model_identifier,
				}).add();
				for (let animation of Animation.all) {
					animation.setScopeFromAnimators();
				}
				Canvas.updateAllBones();
			}
		}
	})

	new Action('load_on_bedrock_player', {
		name: 'Load with Bedrock Player',
		condition: () => Format.id == 'bedrock' && !Project.multi_file_ruleset,
		icon: 'icon-player',
		click() {
			player_loader.onStart();
			return;
		}
	})
	new Action('import_bedrock_attachable', {
		name: 'Import Bedrock Attachable',
		condition: () => Format.id == 'bedrock',
		icon: 'swords',
		click() {
			Filesystem.importFile({
				extensions: ['json'],
				type: Codecs.bedrock.name,
				readtype: 'text',
				multiple: true,
				resource_id: 'model',
			}, files => {
				for (let file of files) {
					let json = autoParseJSON(file.content as string);
					let finder = new AddedContentFinder();

					let collection = new Collection({
						name: file.name,
						export_codec: 'bedrock',
						export_path: file.path,
					}).add();
					Codecs.bedrock.load(json, file, {import_to_current_project: true, collection});
					let content = finder.find();
					let scope = finder.findEmptyScope();
					content.nodes.forEach(node => node.scope = scope);
					content.textures.forEach(t => t.scope = scope);
					collection.scope = scope;
				}
				for (let anim of Animation.all) {
					anim.setScopeFromAnimators();
				}
				Canvas.updateAllBones();
			})
		}
	})
	new Action('slice_bedrock_multiblock', {
		name: 'Slice Bedrock Multiblock',
		condition: () => Format.id == 'bedrock_block',
		icon: 'dashboard_customize',
		click() {
			let center = getSelectionCenter();
			let form: InputFormConfig = {
				split_cubes: {label: 'Split Cubes', value: true, type: 'checkbox'},
			}
			if (isApp) {
				form.export_location = {label: 'Export Directory', type: 'folder', value: PathModule.dirname(Project.export_path)};
			}
			new Dialog('slice_bedrock_multiblock', {
				title: this.name,
				form,
				onConfirm(result) {

					let cubes_modified = Cube.all.slice();
					Undo.initEdit({elements: cubes_modified, collections: []});

					if (result.split_cubes) {
						for (let axis = 0; axis < 3; axis++) {
							let original_cubes = Cube.all.slice();
							let off_axes = [0,1,2].filter(i => i != axis);
							for (let cube of original_cubes) {
								let self_and_ancestors = cube.getAllAncestors().concat([cube]);
								if (self_and_ancestors.allAre((group: Group | Cube) => {
										return group.rotation[off_axes[0]] == 0 && group.rotation[off_axes[1]] == 0
									})
								) {
									// Simple rotation
									let offset = axis == 1 ? 0 : 8;
									let start = Math.min(cube.from[axis], cube.to[axis]);
									let end = Math.max(cube.from[axis], cube.to[axis]);
									let pos = Math.ceil((start + offset) /16) * 16 - offset;
									let cuts: number[] = [];
									while (pos < end) {
										if (!Math.epsilon(pos, start, 0.6) && !Math.epsilon(pos, end, 0.6)) {
											cuts.push(pos);
										}
										pos += 16;
									}
									for (let cut of cuts) {
										let new_cube = splitCube(cube, axis, cut);
										cubes_modified.push(new_cube);
										cube = new_cube;
									}
								}
							}
						}
					}

					function offsetName(block_offset: number, center: string, positive: string, negative: string): string {
						if (block_offset == 0) {
							return center;
						}
						let absolute = Math.abs(block_offset);
						return `${Math.sign(block_offset) == 1 ? positive : negative}${absolute >= 2 ? absolute : ''}`;
					}

					let scope = 0;
					let collections: Record<string, Collection> = {};
					for (let cube of Cube.all) {
						let pos = cube.getWorldCenter();
						let block_offset = [
							Math.round(pos.x/16),
							Math.floor(pos.y/16),
							Math.round(pos.z/16),
						];
						let key = block_offset.join('-');
						let project_name = Project.geometry_name || Project.getDisplayName(false) || 'model';
						if (!collections[key]) {
							scope++;
							let name = [
								offsetName(block_offset[0], '', 'right', 'left'),
								offsetName(block_offset[1], 'bottom', 'top', 'below'),
								offsetName(block_offset[2], '', 'front', 'back'),
							].filter(v => v).join('_');
							collections[key] = new Collection({
								name,
								//scope,
								offset: block_offset.V3_multiply(16, 16, 16),
								export_codec: 'bedrock',
								model_identifier: Project.model_identifier + '.' + key,
							}).add();
							if (isApp && result.export_location) {
								collections[key].export_path = PathModule.join(result.export_location as string, project_name + '.' + name) + '.geo.json';
							}
						}
						collections[key].children.push(cube.uuid);
						//[key].children.safePush(...cube.getAllAncestors().map(node => node.uuid));
						//cube.scope = collections[key].scope;
					}

					Canvas.updateView({elements: cubes_modified, element_aspects: {transform: true, geometry: true}});
					Undo.finishEdit('Slice multi block model', {collections: Object.values(collections), elements: cubes_modified});
				}
			}).show();
		}
	})
})

const DEFAULT_POSE_FIRST = {
	rightarm: {
		rotation: [-95, 45, 115].map(Math.degToRad),
		position: [-13.5, -10, 12]
	},
	rightitem: {
		position: [0, -7, 0]
	},
	leftitem: {
		position: [0, -7, 0]
	},
	body: {hide_cubes: true},
	head: {hide_cubes: true},
	cape: {hide_cubes: true},
	rightleg: {hide_cubes: true},
	leftleg: {hide_cubes: true},
}
const DEFAULT_POSE_THIRD = {
	rightarm: {
		rotation: [18, 0, 0].map(Math.degToRad),
	}
}

function applyDefaultPose(data) {
	for (let bone_name in data) {
		let bone_data = data[bone_name];
		let bone = Group.all.find(g => g.name.toLowerCase() == bone_name);
		if (!bone) continue;
		if (bone_data.rotation) bone.mesh.rotation.fromArray(bone_data.rotation);
		if (bone_data.position) bone.mesh.position.add(Reusable.vec1.fromArray(bone_data.position));
		if (bone_data.scale) bone.mesh.scale.fromArray(bone_data.scale);
		if (bone_data.hide_cubes) {
			for (let child of bone.mesh.children) {
				if (child.type == 'cube') child.visible = false;
			}
		}
	}
}
Blockbench.on('display_default_pose', () => {
	if (Project.multi_file_ruleset == attachable_ruleset.id) {
		if (Project.bedrock_animation_mode == 'attachable_first') {
			applyDefaultPose(DEFAULT_POSE_FIRST);
		} else {
			let has_item = Animator.MolangParser.parse('query.is_item_equipped(0)');
			if (has_item) applyDefaultPose(DEFAULT_POSE_THIRD);
		}
	}
})
Blockbench.on('get_face_texture', (arg) => {
	if (Project.multi_file_ruleset == attachable_ruleset.id && arg.element?.scope) {
		let texture_match = Texture.all.find(t => t.scope == arg.element.scope);
		if (texture_match) return texture_match;
	}
})