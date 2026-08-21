import { ModelFormat } from "../../io/format"
import { getTexturesById } from "../../texturing/textures"
import { convertTextureMeshesToCubes, GeneratedItemMesh } from "./../../outliner/types/texture_mesh"
import { LoadOptions } from "./../../io/codec"

const ITEM_LAYER_LIMIT = 5
const ITEM_PARENTS = [
	'item/generated', 	'minecraft:item/generated',
	'item/handheld', 	'minecraft:item/handheld',
	'item/handheld_rod','minecraft:item/handheld_rod',
	'builtin/generated','minecraft:builtin/generated',
]

interface ElementTemplate {
	name?: string
	__comment?: string
	from: ArrayVector3
	to: ArrayVector3
	rotation?: any
	faces: Record<string, any>
	shade?: boolean
	light_emission?: number
	shade_direction_override?: string
	rotated?: any
	color?: number
}
interface CompileOptions {
	cube_name?: boolean
	prevent_dialog?: boolean
	raw?: boolean
}
const resolved_conflicts = new WeakSet<object>();

function removeGeneratedItemPlaceholders() {
	let placeholders = GeneratedItemMesh.all.slice();
	if (!placeholders.length) return;
	Undo.initEdit({elements: placeholders, outliner: true, selection: true});
	placeholders.forEach(placeholder => placeholder.remove());
	Undo.finishEdit('Remove generated item model', {elements: [], outliner: true, selection: true});
	updateSelection();
}

function hasOwnElements() {
	return !!Outliner.elements.find(element => element instanceof GeneratedItemMesh == false);
}

function resolveGeneratedItemConflict() {
	if (!GeneratedItemMesh.all.length || !hasOwnElements()) return;
	if (resolved_conflicts.has(Project)) return;
	resolved_conflicts.add(Project);

	let project = Project;
	Blockbench.showMessageBox({
		translateKey: 'generated_item_model_conflict',
		icon: 'wallpaper',
		width: 512,
		commands: {
			convert: {
				text: 'message.generated_item_model_conflict.convert',
				description: 'message.generated_item_model_conflict.convert.desc',
				icon: 'eject'
			},
			remove: {
				text: 'message.generated_item_model_conflict.remove',
				description: 'message.generated_item_model_conflict.remove.desc',
				icon: 'delete'
			},
			keep: {
				text: 'message.generated_item_model_conflict.keep',
				description: 'message.generated_item_model_conflict.keep.desc',
				icon: 'visibility'
			}
		},
		buttons: ['dialog.cancel'],
		cancel: 0
	}, result => {
		if (result == 'convert') {
			convertTextureMeshesToCubes(GeneratedItemMesh.all.slice());
		} else if (result == 'remove') {
			removeGeneratedItemPlaceholders();
		} else if (result != 'keep') {
			resolved_conflicts.delete(project);
			if (Project == project) Undo.undo();
		}
	})
}

function confirmGeneratedItemConversion(placeholders: GeneratedItemMesh[]) {
	Blockbench.showMessageBox({
		translateKey: 'convert_generated_item_model',
		icon: 'eject',
		width: 512,
		buttons: ['message.convert_generated_item_model.confirm', 'dialog.cancel'],
		confirm: 0,
		cancel: 1
	}, result => {
		if (result != 0) return;
		convertTextureMeshesToCubes(placeholders);
	})
}

const codec = new Codec('java_block', {
	name: 'Java Block/Item Model',
	remember: true,
	extension: 'json',
	support_partial_export: true,
	load_filter: {
		type: 'json',
		extensions: ['json'],
		condition(model: any) {
			return model.parent || model.elements || model.textures;
		}
	},
	compile(options: CompileOptions) {
		if (options === undefined) options = {}
		let clear_elements = []
		let textures_used = []
		let element_indices = []
		let overflow_cubes = [];

		function computeCube(s: Cube) {
			if (s.export == false) return;
			//Create Element
			let element: Partial<ElementTemplate> = {};
			element_indices[Cube.all.indexOf(s)] = clear_elements.length

			if ((options.cube_name !== false && !settings.minifiedout.value) || options.cube_name === true) {
				if (s.name !== 'cube') {
					element.name = s.name
				}
			}
			element.from = s.from.slice() as ArrayVector3;
			element.to = s.to.slice() as ArrayVector3;
			if (s.inflate) {
				for (let i = 0; i < 3; i++) {
					element.from[i] -= s.inflate;
					element.to[i] += s.inflate;
				}
			}
			if (s.shade === false) {
				element.shade = false
			}
			if (s.light_emission) {
				element.light_emission = s.light_emission;
			}
			if (s.shade_direction_override) {
				element.shade_direction_override = s.shade_direction_override;
			}
			if (!s.rotation.allEqual(0) || (!s.origin.allEqual(0) && settings.java_export_pivots.value)) {
				element.rotation = new oneLiner({});
				if (!Format.rotation_limit && (s.rotation.positiveItems() > 1 || s.rotation.some(v => Math.abs(v) > 45))) {
					// New format
					element.rotation.x = s.rotation[0];
					element.rotation.y = s.rotation[1];
					element.rotation.z = s.rotation[2];
				} else {
					// Restricted
					let axis = s.rotationAxis()||'y';
					let angle = s.rotation[getAxisNumber(axis)];
					element.rotation.angle = Format.rotation_snap ? Math.round(angle / 22.5) * 22.5 : angle;
					element.rotation.axis = axis;
				}
				element.rotation.origin = s.origin.slice();
			}
			if (s.rescale) {
				if (element.rotation) {
					element.rotation.rescale = true
				} else {
					element.rotation = new oneLiner({
						angle: 0,
						axis: s.rotation_axis||'y',
						origin: s.origin,
						rescale: true
					})
				}

			}
			if (Format.rotation_limit && s.rotation.positiveItems() >= 2) {
				element.rotated = s.rotation
			}
			let element_has_texture = false;
			let e_faces = {}
			for (let face in s.faces) {
				if (s.faces.hasOwnProperty(face)) {
					if (s.faces[face].texture !== null) {
						let tag = new oneLiner<any>()
						if (s.faces[face].enabled !== false) {
							tag.uv = s.faces[face].uv.slice();
							tag.uv.forEach((n, i) => {
								tag.uv[i] = n * 16 / UVEditor.getResolution(i%2);
							})
						}
						if (s.faces[face].rotation) {
							tag.rotation = s.faces[face].rotation
						}
						if (s.faces[face].texture) {
							let tex = s.faces[face].getTexture()
							if (tex) {
								tag.texture = '#' + tex.id
								textures_used.safePush(tex)
							}
							element_has_texture = true
						}
						if (!tag.texture) {
							tag.texture = '#missing'
						}
						if (s.faces[face].cullface) {
							tag.cullface = s.faces[face].cullface
						}
						if (s.faces[face].tint >= 0) {
							tag.tintindex = s.faces[face].tint
						}
						e_faces[face] = tag
					}
				}
			}
			//Gather Textures
			if (!element_has_texture) {
				element.color = s.color
			}
			element.faces = e_faces

			if (Format.cube_size_limiter) {
				function inVd(n) {
					return n < -16 || n > 32; 
				}
				if (inVd(element.from[0]) ||
					inVd(element.from[1]) ||
					inVd(element.from[2]) ||
					inVd(element.to[0]) ||
					inVd(element.to[1]) ||
					inVd(element.to[2])
				) {
					overflow_cubes.push(s);
				}
			}
			if (Object.keys(element.faces).length) {
				clear_elements.push(element)
			}
		}
		function iterate(arr) {
			if (!arr || !arr.length) {
				return;
			}
			for (let i=0; i<arr.length; i++) {
				if (arr[i].type === 'cube') {
					computeCube(arr[i])
				} else if (arr[i].type === 'group') {
					iterate(arr[i].children)
				}
			}
		}
		iterate(Outliner.root)

		function checkExport(key, condition) {
			key = options[key]
			if (key === undefined) {
				return condition;
			} else {
				return key
			}
		}
		let isTexturesOnlyModel = clear_elements.length === 0 && checkExport('parent', Project.parent != '')
		let texturesObj: Record<string, string> = {}
		Texture.all.forEach(function(t, i){
			let link = t.javaTextureLink()
			if (t.particle) {
				texturesObj.particle = link
			}
			if (!textures_used.includes(t) && !isTexturesOnlyModel) return;
			if (t.id !== link.replace(/^#/, '')) {
				texturesObj[t.id] = link
			}
		})

		if (options.prevent_dialog !== true && overflow_cubes.length > 0 && settings.dialog_larger_cubes.value) {
			Blockbench.showMessageBox({
				translateKey: 'model_clipping',
				icon: 'settings_overscan',
				message: tl('message.model_clipping.message', [overflow_cubes.length]),
				buttons: ['dialog.scale.select_overflow', 'dialog.ok'],
				confirm: 1,
				cancel: 1,
			}, (result) => {
				if (result == 0) {
					Outliner.selected.splice(0, Infinity, ...overflow_cubes)
					updateSelection();
				}
			})
		}
		/*if (options.prevent_dialog !== true && clear_elements.length && item_parents.includes(Project.parent)) {
			Blockbench.showMessageBox({
				translateKey: 'invalid_builtin_parent',
				icon: 'info',
				message: tl('message.invalid_builtin_parent.message', [Project.parent])
			})
			Project.parent = '';
		}*/

		let blockmodel: any = {
			format_version: Project.java_block_version
		};
		if (checkExport('comment', Project.credit || settings.credit.value)) {
			blockmodel.credit = Project.credit || settings.credit.value
		}
		if (checkExport('parent', Project.parent != '')) {
			blockmodel.parent = Project.parent
		}
		if (checkExport('ambientocclusion', Project.ambientocclusion === false)) {
			blockmodel.ambientocclusion = false
		}
		if (Project.unhandled_root_fields.render_type) {
			blockmodel.render_type = Project.unhandled_root_fields.render_type;
		}
		if (Project.texture_width !== 16 || Project.texture_height !== 16) {
			blockmodel.texture_size = [Project.texture_width, Project.texture_height]
		}
		if (checkExport('textures', Object.keys(texturesObj).length >= 1)) {
			blockmodel.textures = texturesObj
		}
		if (checkExport('elements', clear_elements.length >= 1)) {
			blockmodel.elements = clear_elements
		}
		if (checkExport('front_gui_light', Project.front_gui_light)) {
			blockmodel.gui_light = 'front';
		}
		if (checkExport('overrides', Project.overrides instanceof Array && Project.overrides.length)) {
			Project.overrides.forEach(override => delete override._uuid)
			blockmodel.overrides = Project.overrides.map(override => new oneLiner(override));
		}
		if (checkExport('display', Object.keys(Project.display_settings).length >= 1)) {
			let new_display = {}
			let entries = 0;
			for (let i in DisplayMode.slots) {
				let key = DisplayMode.slots[i]
				if (DisplayMode.slots.hasOwnProperty(i) && Project.display_settings[key] && Project.display_settings[key].export) {
					new_display[key] = Project.display_settings[key].export()
					entries++;
				}
			}
			if (entries) {
				blockmodel.display = new_display
			}
		}
		if (checkExport('groups', (settings.export_groups.value && Group.all.length))) {
			let groups = []
			function iterate(array, save_array) {
				let i = 0;
				for (let element of array) {
					if (element.type === 'group') {
						if (element.export === true) {
							let obj = element.compile(false)
							if (element.children.length > 0) {
								iterate(element.children, obj.children)
							}
							save_array.push(obj)
						}
					} else {
						let index = element_indices[elements.indexOf(element)]
						if (index >= 0) {
							save_array.push(index)
						}
					}
					i++;
				}
			}
			iterate(Outliner.root, groups);
			let i = 0;
			while (i < groups.length) {
				if (typeof groups[i] === 'object') {
					i = Infinity
				}
				i++
			}
			if (i === Infinity) {
				blockmodel.groups = groups
			}
		}
		for (let key in Project.unhandled_root_fields) {
			if (blockmodel[key] === undefined) blockmodel[key] = Project.unhandled_root_fields[key];
		}
		this.dispatchEvent('compile', {model: blockmodel, options});
		if (options.raw) {
			return blockmodel
		} else {
			return autoStringify(blockmodel)
		}
	},
	parse(model: any, path: string, args: LoadOptions = {}) {
		if (!model.elements && !model.parent && !model.display && !model.textures) {
			Blockbench.showMessageBox({
				translateKey: 'invalid_model',
				icon: 'error',
			})
			return;
		}

		this.dispatchEvent('parse', {model});

		// Backwards compatibility with the old "add" third argument
		const import_to_current_project = typeof args === "boolean" ? args : args.import_to_current_project

		let uses_new_rotations = false;

		let previous_texture_length = import_to_current_project ? Texture.all.length : 0
		let new_cubes = [];
		let new_textures = [];
		if (import_to_current_project) {
			let groups = [];
			Undo.initEdit({elements: new_cubes, outliner: true, textures: new_textures, groups})
			Project.added_models++;
			var import_group = new Group(pathToName(path, false)).init()
			groups.push(import_group);
		}

		if (!import_to_current_project && typeof model.format_version == 'string') {
			Project.java_block_version = model.format_version;
		}

		//Load
		if (typeof (model.credit || model.__comment) == 'string') Project.credit = (model.credit || model.__comment);
		if (model.texture_size instanceof Array && !import_to_current_project) {
			Project.texture_width  = Math.clamp(parseInt(model.texture_size[0]), 1, Infinity)
			Project.texture_height = Math.clamp(parseInt(model.texture_size[1]), 1, Infinity)
		}
		if (model.display !== undefined) {
			DisplayMode.loadJSON(model.display)
		}
		if (model.overrides instanceof Array) {
			Project.overrides = model.overrides.slice();
		}

		let texture_ids: Record<string, Texture> = {}
		let texture_paths: Record<string, Texture> = {}
		let texture_by_link: Record<string, Texture> = {}
		if (model.textures) {
			//Create Path Array to fetch textures
			let path_arr = path.split(osfs)
			if (!path_arr.includes('cit')) {
				let index = path_arr.length - path_arr.indexOf('models')
				path_arr.splice(-index)
			}

			let texture_arr = model.textures

			for (let key in texture_arr) {
				if (typeof texture_arr[key] === 'string' && key != 'particle') {
					let link = texture_arr[key];
					if (link.startsWith('#') && texture_arr[link.substring(1)]) {
						link = texture_arr[link.substring(1)];
					}
					let texture;
					if (texture_by_link[link]) {
						texture = texture_by_link[link]
					} else {
						texture = new Texture({id: key}).fromJavaLink(link, path_arr.slice(), args.externalDataLoader).add();
					}
					let path = texture_arr[key].replace(/^minecraft:/, '');
					texture_paths[path] = texture_ids[key] = texture_by_link[link] = texture;
					new_textures.safePush(texture);
				}
			}
			if (texture_arr.particle) {
				let link = texture_arr.particle;
				if (link.startsWith('#') && texture_arr[link.substring(1)]) {
					link = texture_arr[link.substring(1)];
				}
				if (texture_paths[link.replace(/^minecraft:/, '')]) {
					texture_paths[link.replace(/^minecraft:/, '')].enableParticle()
				} else {
					let texture = new Texture({id: 'particle'}).fromJavaLink(link, path_arr.slice(), args.externalDataLoader).enableParticle().add();
					texture_paths[link.replace(/^minecraft:/, '')] = texture_ids.particle = texture;
					new_textures.push(texture);
				}
			}
			//Get Rid Of ID overlapping
			for (let i = previous_texture_length; i < Texture.all.length; i++) {
				let t = Texture.all[i]
				if (getTexturesById(t.id).length > 1) {
					t.id = Project.added_models + '_' + t.id
				}
			}
			//Select Last Texture
			if (Texture.all.length > 0) {
				Texture.all.last().select();
			}
		}

		let oid = Outliner.elements.length

		if (model.elements) {
			model.elements.forEach((obj: ElementTemplate) => {
				let base_cube = new Cube(obj);
				if (obj.__comment) base_cube.name = obj.__comment
				if (typeof obj.rotation == 'object') {
					if (obj.rotation.origin) {
						base_cube.extend({origin: obj.rotation.origin});
					}
					Merge.boolean(base_cube, obj.rotation, 'rescale');
					if (obj.rotation.axis) {
						if (obj.rotation.angle && obj.rotation.axis) {
							let axis = getAxisNumber(obj.rotation.axis)
							if (axis >= 0) {
								base_cube.rotation.V3_set(0, 0, 0);
								base_cube.rotation[axis] = obj.rotation.angle;
							}
						}
						if (obj.rotation.origin) {
							Merge.number(base_cube.origin, obj.rotation.origin, 0)
							Merge.number(base_cube.origin, obj.rotation.origin, 1)
							Merge.number(base_cube.origin, obj.rotation.origin, 2)
						}
						if (typeof obj.rotation.axis === 'string') {
							base_cube.rotation_axis = obj.rotation.axis
						}

					} else if (obj.rotation.x || obj.rotation.y || obj.rotation.z) {
						base_cube.extend({
							rotation: [
								obj.rotation.x || 0,
								obj.rotation.y || 0,
								obj.rotation.z || 0
							]
						});
						uses_new_rotations = true;
					}
				}
				//Faces
				let faces_without_uv = false;
				for (let key in base_cube.faces) {
					if (obj.faces[key] && !obj.faces[key].uv) {
						faces_without_uv = true;
					}
				}
				if (faces_without_uv) {
					base_cube.autouv = 2
					base_cube.mapAutoUV()
				} else {
					base_cube.autouv = 0;
				}

				for (let key in base_cube.faces) {
					let read_face = obj.faces[key];
					let new_face = base_cube.faces[key];
					if (read_face === undefined) {

						new_face.texture = null
						new_face.uv = [0,0,0,0]
					} else {
						if (typeof read_face.uv === 'object') {

							new_face.uv.forEach((n, i) => {
								new_face.uv[i] = read_face.uv[i] * UVEditor.getResolution(i%2) / 16;
							})
						}
						if (read_face.texture === '#missing') {
							new_face.texture = false;
							
						} else if (read_face.texture) {
							let id = read_face.texture.replace(/^#/, '')
							let t = texture_ids[id]

							if (t instanceof Texture === false) {
								if (texture_paths[read_face.texture]) {
									t = texture_paths[read_face.texture]
									if (t.id === 'particle') {
										t.extend({id: id, name: '#'+id}).loadEmpty(3)
									}
								} else {
									t = new Texture({id: id, name: '#'+id}).add(false).loadEmpty(3)
									texture_ids[id] = t
									new_textures.push(t);
								}
							}
							new_face.texture = t.uuid;
						}
						if (typeof read_face.tintindex == 'number') {
							new_face.tint = read_face.tintindex;
						}
					}
				}

				if (!import_to_current_project) {
					Outliner.root.push(base_cube)
					base_cube.parent = 'root'
				} else if (import_group) {
					import_group.children.push(base_cube)
					base_cube.parent = import_group
				}
				base_cube.init()
				new_cubes.push(base_cube);
			})
		}
		if (model.groups && model.groups.length > 0) {

			function parseGroupsForJava(array, import_reference?: Group, startIndex?: number) {
				function iterate(array, save_array: any[], addGroup?: Group | typeof Outliner.ROOT) {
					let i = 0;
					while (i < array.length) {
						if (typeof array[i] === 'number' || typeof array[i] === 'string') {
							
							let obj;
							if (typeof array[i] === 'number') {
								obj = Outliner.elements[array[i] + (startIndex ? startIndex : 0) ]
							} else {
								obj = OutlinerNode.uuids[array[i]];
							}
							if (obj) {
								obj.removeFromParent()
								save_array.push(obj)
								obj.parent = addGroup
							}
						} else {
							if (OutlinerNode.uuids[array[i].uuid] instanceof Group) {
								OutlinerNode.uuids[array[i].uuid].removeFromParent();
								delete OutlinerNode.uuids[array[i].uuid];
							}
							let obj = new Group(array[i], array[i].uuid)
							obj.parent = addGroup
							obj.isOpen = !!array[i].isOpen
							if (array[i].uuid) {
								obj.uuid = array[i].uuid
							}
							save_array.push(obj)
							obj.init()
							if (array[i].children && array[i].children.length > 0) {
								iterate(array[i].children, obj.children, obj)
							}
							if (array[i].content && array[i].content.length > 0) {
								iterate(array[i].content, obj.children, obj)
							}
						}
						i++;
					}
				}
				if (import_reference instanceof Group && startIndex !== undefined) {
					iterate(array, import_reference.children, import_reference)
				} else {
					if (!import_reference) {
						Group.all.forEach(group => {
							group.removeFromParent();
						})
						Group.all.empty();
					}
					iterate(array, Outliner.root, Outliner.ROOT);
				}
			}

			if (!import_to_current_project) {
				parseGroupsForJava(model.groups)
			} else if (import_group) {
				parseGroupsForJava(model.groups, import_group, oid)
			}
		}
		if (import_group) {
			import_group.addTo().select()
		}
		let item_layers = [];
		while (item_layers.length < ITEM_LAYER_LIMIT && typeof model.textures?.['layer' + item_layers.length] === 'string') {
			item_layers.push('layer' + item_layers.length);
		}
		if (
			!model.elements &&
			ITEM_PARENTS.includes(model.parent) &&
			item_layers.length
		) {
			let placeholders = item_layers.map(key => {
				let layer_texture = texture_ids[key];
				return new GeneratedItemMesh({
					name: model.textures[key],
					texture_name: layer_texture ? layer_texture.name : '',
					rotation: [90, 180, 0],
					local_pivot: [0, -7.5, -16],
					export: false
				}).init();
			});

			new_cubes.push(...placeholders);

			let layer0 = texture_ids[item_layers[0]];
			if (settings.dialog_generated_item_model.value && !hasOwnElements()) {
				Blockbench.showMessageBox({
					translateKey: 'generated_item_model',
					icon: 'wallpaper',
					width: 512,
					commands: {
						edit_texture: {
							text: 'message.generated_item_model.edit_texture',
							icon: 'draw',
							condition: !!(layer0 && !layer0.error)
						},
						convert: {
							text: 'message.generated_item_model.convert',
							icon: 'eject',
							condition: !!(layer0 && !layer0.error)
						}
					},
					checkboxes: {
						dont_show_again: {value: false, text: 'dialog.dontshowagain'}
					},
					buttons: ['dialog.close']
				}, (result, checkboxes: any = {}) => {
					if (checkboxes.dont_show_again) {
						settings.dialog_generated_item_model.set(false);
					}
					if (result == 'edit_texture') {
						layer0.openInImageEditor();
					} else if (result == 'convert') {
						confirmGeneratedItemConversion(placeholders);
					}
				})
			}

		} else if (!model.elements && model.parent) {
			let can_open = isApp && !model.parent.replace(/\w+:/, '').startsWith('builtin');
			Blockbench.showMessageBox({
				translateKey: 'child_model_only',
				icon: 'info',
				message: tl('message.child_model_only.message', [model.parent]),
				commands: can_open && {
					open: 'message.child_model_only.open',
					open_with_textures: {text: 'message.child_model_only.open_with_textures', condition: Texture.all.length > 0}
				}
			}, async result => {
				if (typeof result == 'string') {
					let parent = model.parent.replace(/\w+:/, '');
					let path_arr = path.split(osfs);
					let index = path_arr.length - path_arr.indexOf('models');
					path_arr.splice(-index);
					path_arr.push('models', ...parent.split('/'));
					let parent_path = path_arr.join(osfs) + '.json';

					function loadParentModel(file) {
						loadModelFile(file, args);

						if (result == 'open_with_textures') {
							Texture.all.forEachReverse(tex => {
								if (tex.error == 3 && tex.name.startsWith('#')) {
									let loaded_tex = texture_ids[tex.name.replace(/#/, '')];
									if (loaded_tex) {
										tex.fromPath(loaded_tex.path, args.externalDataLoader);
										tex.namespace = loaded_tex.namespace;
									}
								}
							})
						}
					}

					let loaded;
					if (args.externalDataLoader) {
						let external = args.externalDataLoader(parent_path.replaceAll("\\", "/"));
						if (external) {
							if (external instanceof Uint8Array) {
								external = new TextDecoder().decode(external);
							}
							try {
								loadParentModel({
									name: PathModule.basename(parent_path),
									path: parent_path,
									content: external
								});
								loaded = true;
							} catch {}
						}
					}

					if (!loaded) {
						Blockbench.read([parent_path], {}, files => loadParentModel(files[0]));
					}
				}
			})
		}
		updateSelection()

		if (uses_new_rotations && VersionUtil.compare(Project.java_block_version, '<', '1.21.11')) {
			Project.java_block_version = '1.21.11';
		}
		//Set Parent
		if (model.parent !== undefined) {
			Project.parent = model.parent;
		}
		//Set Ambient Occlusion
		if (model.ambientocclusion === false) {
			Project.ambientocclusion = false;
		}
		if (model.gui_light === 'front') {
			Project.front_gui_light = true;
		}
		let supported_fields = new Set(['textures', 'elements', 'groups', 'parent', 'display', '__comment', 'credit', 'texture_size', 'overrides', 'ambientocclusion', 'gui_light']);
		for (let key in model) {
			if (!supported_fields.has(key)) {
				Project.unhandled_root_fields[key] = model[key];
			}
		}

		this.dispatchEvent('parsed', {model});
		if (import_to_current_project) {
			Undo.finishEdit('Add block model')
		}
		Validator.validate()
	},
})

const format = new ModelFormat('java_block', {
	icon: 'icon-format_block',
	category: 'minecraft',
	target: 'Minecraft: Java Edition',
	format_page: {
		content: [
			{type: 'h3', text: tl('mode.start.format.informations')},
			{text: `* ${tl('format.java_block.info.size')}
					* ${tl('format.java_block.info.animation')}`.replace(/\t+/g, '')
			}
		]
	},
	render_sides: 'front',
	model_identifier: false,
	parent_model_id: true,
	vertex_color_ambient_occlusion: true,
	rotate_cubes: true,
	rotation_limit: false,
	rotation_snap: false,
	optional_box_uv: true,
	uv_rotation: true,
	java_cube_shading_properties: true,
	java_face_properties: true,
	cullfaces: true,
	animated_textures: true,
	select_texture_for_particles: true,
	texture_mcmeta: true,
	display_mode: true,
	texture_folder: true,
	molang: false,
	pbr: true,
	cube_size_limiter: {
		coordinate_limits: [-16, 32],
		test(cube: Cube, values: any = {}) {
			let from = values.from || cube.from;
			let to = values.to || cube.to;
			let inflate = values.inflate == undefined ? cube.inflate : values.inflate;

			return undefined !== from.find((v, i) => {
				return (
					to[i] + inflate > 32 ||
					to[i] + inflate < -16 ||
					from[i] - inflate > 32 ||
					from[i] - inflate < -16
				)
			})
		},
		move(cube: Cube, values: any = {}) {
			let from = values.from || cube.from;
			let to = values.to || cube.to;
			let inflate = values.inflate == undefined ? cube.inflate : values.inflate;
			
			[0, 1, 2].forEach((ax) => {
				let overlap = to[ax] + inflate - 32
				if (overlap > 0) {
					//If positive site overlaps
					from[ax] -= overlap
					to[ax] -= overlap

					if (16 + from[ax] - inflate < 0) {
						from[ax] = -16 + inflate
					}
				} else {
					overlap = from[ax] - inflate + 16
					if (overlap < 0) {
						from[ax] -= overlap
						to[ax] -= overlap

						if (to[ax] + inflate > 32) {
							to[ax] = 32 - inflate
						}
					}
				}
			})
		},
		clamp(cube: Cube, values: any = {}) {
			let from = values.from || cube.from;
			let to = values.to || cube.to;
			let inflate = values.inflate == undefined ? cube.inflate : values.inflate;
			
			[0, 1, 2].forEach((ax) => {
				from[ax] = Math.clamp(from[ax] - inflate, -16, 32) + inflate;
				to[ax] = Math.clamp(to[ax] + inflate, -16, 32) - inflate;
			})
		}
	},
	codec
})
codec.format = format;
Object.defineProperty(format, 'rotation_snap', {
	get() {
		return Project.java_block_version == '1.9.0'
	}
})
Object.defineProperty(format, 'rotation_limit', {
	get() {
		try {
			return !VersionUtil.compare(Project.java_block_version, '>=', '1.21.11');
		} catch (err) {
			return true;
		}
	}
})


BARS.defineActions(function() {
	codec.export_action = new Action('export_blockmodel', {
		icon: 'icon-format_block',
		category: 'file',
		condition: () => Format == format,
		click() {
			codec.export();
		}
	})
	new Action('import_java_block_model', {
		icon: 'assessment',
		category: 'file',
		condition: () => Format == format,
		click() {
			Blockbench.import({
				resource_id: 'model',
				extensions: ['json'],
				type: codec.name,
				multiple: true,
			}, function(files) {
				files.forEach(file => {
					let model = autoParseJSON(file.content as string, {file_path: file.path});
					(codec as any).parse(model, file.path, {
						import_to_current_project: true
					})
				})
			})
		}
	})
})

declare global {
	interface BarItemRegistry {
		export_blockmodel: Action
		import_java_block_model: Action
	}
}

Blockbench.on('finished_edit', () => {
	if (Format?.id != 'java_block') return;
	setTimeout(resolveGeneratedItemConflict, 0);
})

new ValidatorCheck('generated_item_model_elements', {
	condition: () => Format?.id == 'java_block' && GeneratedItemMesh.all.length > 0,
	update_triggers: ['finished_edit', 'undo', 'redo'],
	run() {
		if (!hasOwnElements()) return;
		this.warn({
			message: 'This model has a generated item model and its own elements. Minecraft only uses the elements, so the generated shape is ignored in game.',
			buttons: [
				{
					name: 'Convert to Extruded Model',
					icon: 'eject',
					click() {
						Validator.dialog.hide();
						convertTextureMeshesToCubes(GeneratedItemMesh.all.slice());
					}
				},
				{
					name: 'Remove Generated Model',
					icon: 'delete',
					click() {
						Validator.dialog.hide();
						removeGeneratedItemPlaceholders();
					}
				}
			]
		})
	}
})
