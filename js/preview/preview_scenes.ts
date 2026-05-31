
import { CustomMenuItem } from "../interface/menu";
import { adjustFromAndToForInflateAndStretch } from "../outliner/types/cube";
import { compileJSON } from "../util/json";
import { toSnakeCase } from "../util/util";

export interface PreviewSceneOptions {
	name?: string
	description?: string
	category?: string
	web_config?: string
	require_minecraft_eula?: boolean
	light_color?: {r: number, g: number, b: number}
	light_side?: number
	condition?: ConditionResolvable
	cubemap?: string[]
	fog?: {
		type: 'linear' | 'exponential'
		color
		near?: number
		far?: number
		density?: number
	}
	fov?: number
	preview_models?: (string | PreviewModel | PreviewModelOptions)[]
}

export class PreviewScene {
	id: string
	loaded: boolean = false;
	require_minecraft_eula: boolean = false;
	name: string;
	description?: string;
	category: string;
	light_color: {r: number, g: number, b: number} = {r: 1, g: 1, b: 1};
	light_side: number = 0;
	condition: ConditionResolvable;
	fov: number = null;
	web_config_path?: string
	fog?: THREE.Fog | THREE.FogExp2
	cubemap?: THREE.CubeTexture
	preview_models = [];

	constructor(id: string, data: PreviewSceneOptions = {}) {
		PreviewScene.scenes[id] = this;
		this.id = id;
		this.loaded = false;
		this.require_minecraft_eula = false;

		this.name = tl(data.name || `preview_scene.${id}`);
		this.category = data.category || 'generic';

		this.light_color = {r: 1, g: 1, b: 1};
		this.light_side = 0;
		this.condition;
		this.fov = null;

		this.preview_models = [];

		if (data) this.extend(data);

		PreviewScene.menu_categories[this.category][id] = this.name;
	}
	extend(data: PreviewSceneOptions) {
		this.loaded = data.web_config ? false : true;
		this.web_config_path = data.web_config;
		if (data.require_minecraft_eula) this.require_minecraft_eula = true;

		this.name = tl(data.name || `preview_scene.${this.id}`);
		if (data.description) {
			this.description = tl(data.description);
		} else {
			this.description = tl('action.'+this.id+'.desc', [], '');
		}
		if (data.light_color) this.light_color = data.light_color;
		if (data.light_side) this.light_side = data.light_side;
		this.condition = data.condition;

		this.cubemap = null;
		if (data.cubemap) {
			let urls = data.cubemap;
			let texture_cube = new THREE.CubeTextureLoader().load(urls, () => {
				if (PreviewScene.active == this && Project.view_mode == 'material') {
					Canvas.updateShading();
				}
			});
			// @ts-expect-error
			texture_cube.colorSpace = THREE.SRGBColorSpace;
			texture_cube.mapping = THREE.CubeRefractionMapping;
			this.cubemap = texture_cube;
		}

		this.fog = null;
		if (data.fog) {
			if (data.fog.type == 'linear') {
				this.fog = new THREE.Fog(data.fog.color, data.fog.near, data.fog.far);
			} else {
				this.fog = new THREE.FogExp2(data.fog.color, data.fog.density);
			}
		}

		this.fov = null;
		if (data.fov) this.fov = data.fov;

		if (data.preview_models) {
			this.preview_models = data.preview_models.map(model => {
				if (typeof model == 'string') return PreviewModel.models[model];
				if (model instanceof PreviewModel == false && typeof model == 'object') {
					if (!model.name) model.name = this.name;
					model = new PreviewModel(model.id || this.id, model);
				}
				return model;
			})
		}
	}
	async lazyLoadFromWeb() {
		let repo = PreviewScene.source_repository;
		// repo = './../blockbench-scenes'
		this.loaded = true;
		let response = await fetch(`${repo}/${this.web_config_path}`);
		if (!response.ok) {
			console.error(response);
			Blockbench.showQuickMessage('message.preview_scene_load_failed', 2000);
		}
		let json = await response.json() as PreviewSceneOptions;
		function convertURL(url: string) {
			return `${repo}/${url}`;
		}
		if (json.preview_models) {
			json.preview_models.forEach(model => {
				if (typeof model == 'object' && model.texture) {
					model.texture = convertURL(model.texture);
				}
			})
		}
		if (json.cubemap instanceof Array) {
			json.cubemap.forEach((url, i) => {
				json.cubemap[i] = convertURL(url);
			})
		}
		this.extend(json);
	}
	/**
	 * Selects this preview scene
	 */
	async select() {
		if (this.require_minecraft_eula) {
			let accepted = await MinecraftEULA.promptUser('preview_scenes');
			if (accepted != true) return false;
		}
		if (!this.loaded) {
			await this.lazyLoadFromWeb()
		}
		if (PreviewScene.active) PreviewScene.active.unselect();

		Canvas.global_light_color.copy(this.light_color as THREE.Color);
		Canvas.global_light_side = this.light_side;
		Canvas.scene.background = this.cubemap;
		Canvas.scene.fog = this.fog;

		if (this.fov && !(Modes.display && DisplayMode.display_slot.startsWith('firstperson'))) {
			Preview.selected.setFOV(this.fov);
		}
		// Update independent models
		PreviewModel.getActiveModels().forEach(model => {
			model.update();
		});
		this.preview_models.forEach(model => {
			model.enable();
		})
		PreviewScene.active = this;
		Blockbench.dispatchEvent('select_preview_scene', {scene: this});
		Canvas.updateShading();
	}
	/**
	 * Unselects this preview scene
	 */
	unselect() {
		this.preview_models.forEach(model => {
			model.disable();
		})

		Canvas.global_light_color.set(0xffffff);
		Canvas.global_light_side = 0;
		if (this.cubemap) scene.background = null;
		if (this.fog) scene.fog = null;
		if (this.fov && !(Modes.display && DisplayMode.display_slot.startsWith('firstperson'))) {
			Preview.all.forEach(preview => preview.setFOV(settings.fov.value as number));
		}
		Blockbench.dispatchEvent('unselect_preview_scene', {scene: this});
		Canvas.updateShading();
		PreviewScene.active = null;
	}
	delete() {
		delete PreviewScene.scenes[this.id];
		delete PreviewScene.menu_categories[this.category][this.id];
	}

	/**
	 * All preview scenes, listed by ID
	 */
	static scenes: Record<string, PreviewScene> = {};
	/**
	 * The currently active scene
	 */
	static active: PreviewScene | null = null;
	static select_options = {};
	/**
	 * The URL to the source repository that scenes are pulled from
	 */
	static source_repository = 'https://cdn.jsdelivr.net/gh/JannisX11/blockbench-scenes';
	static menu_categories: {
		[category_id: string]: {
			[id: string]: string
		}
	} = {
		main: {
			none: tl('generic.none')
		},
		generic: {
			_label: 'Generic'
		},
		realistic: {
			_label: 'Realistic'
		},
		minecraft: {
			_label: 'Minecraft'
		},
	};

}

StateMemory.init('preview_model_customization', 'object');

interface PreviewModelCubeTemplate {
	prefab?: string
	offset?: ArrayVector3
	offset_space?: 'block' | 'pixel'
	position?: ArrayVector3
	size?: ArrayVector3
	origin?: ArrayVector3
	rotation?: ArrayVector3
	faces?: {
		north?: { uv: ArrayVector4 }
		east?: { uv: ArrayVector4 }
		west?: { uv: ArrayVector4 }
		south?: { uv: ArrayVector4 }
		up?: { uv: ArrayVector4 }
		down?: { uv: ArrayVector4 }
	}
}
type PrefabTemplate = PreviewModelCubeTemplate
export interface PreviewModelOptions {
	id?: string
	name?: string
	condition?: ConditionResolvable
	cubes?: PreviewModelCubeTemplate[]
	prefabs?: Record<string, PrefabTemplate>
	/**
	 * Source of the model's texture
	 */
	texture?: string
	/**
	 * Model tint color
	 */
	color?: string
	/**
	 * Enable shading on the material
	 */
	shading?: boolean
	/**
	 * THREE.JS material render side
	 */
	render_side?: number
	texture_size?: [number, number]
	position?: ArrayVector3
	rotation?: ArrayVector3
	scale?: ArrayVector3
	onUpdate?(): void
}
export class PreviewModel implements Deletable {
	id: string
	name: string
	condition: ConditionResolvable
	model_3d: THREE.Object3D
	onUpdate?: () => void
	enabled: boolean = false;
	build_data: {
		prefabs?: Record<string, PrefabTemplate>,
		cubes?: PreviewModelCubeTemplate[],
		texture?: string
		position?: ArrayVector3
		rotation?: ArrayVector3
		scale?: ArrayVector3
	}
	color: string
	shading: boolean
	render_side: THREE.Side
	texture_size: ArrayVector2
	cubes: PreviewModelCubeTemplate[]
	texture?: string
	[idkey: string]: any

	constructor(id: string, data: PreviewModelOptions) {
		PreviewModel.models[id] = this;
		this.id = id;
		this.name = data.name ? tl(data.name) : '';
		this.condition = data.condition;
		this.model_3d = new THREE.Object3D();
		this.onUpdate = data.onUpdate;
		this.enabled = false;

		this.build_data = {
			prefabs: data.prefabs,
			cubes: data.cubes || [],
			texture: data.texture,
			position: data.position,
			rotation: data.rotation,
			scale: data.scale,
		}
		this.color = data.color || '#ffffff';
		this.shading = data.shading !== false;
		this.render_side = data.render_side == undefined ? THREE.DoubleSide : data.render_side;
		this.texture_size = data.texture_size || [16, 16];

		this.buildModel();
	}
	/**
	 * Enables the model in the preview
	 */
	enable() {
		Canvas.scene.add(this.model_3d);
		this.enabled = true;
		this.update();
	}
	/**
	 * Disables the model in the preview
	 */
	disable() {
		Canvas.scene.remove(this.model_3d);
		this.enabled = false;
	}
	/**
	 * Update the appearance and visibility of the model
	 */
	update() {
		let custom_data = StateMemory.preview_model_customization?.[this.id];

		if (custom_data?.position instanceof Array) {
			this.model_3d.position.fromArray(custom_data.position);
		} else {
			if (this.build_data.position) {
				this.model_3d.position.fromArray(this.build_data.position);
			} else {
				this.model_3d.position.set(0, 0, 0);
			}
			let offset = Format.centered_grid ? 0 : 8;
			this.model_3d.position.x += offset;
			this.model_3d.position.z += offset;
		}
		if (custom_data?.rotation instanceof Array) {
			this.model_3d.rotation.fromArray(custom_data.rotation.map((v: number) => Math.degToRad(v)));
		} else if (this.build_data.rotation) {
			this.model_3d.rotation.fromArray(this.build_data.rotation.map(v => Math.degToRad(v)));
		} else {
			this.model_3d.rotation.set(0, 0, 0);
		}
		if (custom_data?.scale instanceof Array) {
			this.model_3d.scale.fromArray(custom_data.scale);
		} else if (this.build_data.scale) {
			this.model_3d.scale.fromArray(this.build_data.scale);
		} else {
			this.model_3d.scale.set(1, 1, 1);
		}

		this.model_3d.visible = !!Condition(this.condition);

		if (typeof this.onUpdate == 'function') {
			this.onUpdate();
		}
	}
	buildModel() {
		let tex: THREE.Texture = undefined;
		if (this.build_data.texture) {
			let img = new Image();
			img.src = this.build_data.texture;
			tex = new THREE.Texture(img);
			tex.magFilter = THREE.NearestFilter;
			tex.minFilter = THREE.NearestFilter;
			tex.wrapS = THREE.RepeatWrapping;
			tex.wrapT = THREE.RepeatWrapping;
			img.crossOrigin = '';
			img.onload = function() {
				tex.needsUpdate = true;
			}
		}
		this.material = new (this.shading ? THREE.MeshLambertMaterial : THREE.MeshBasicMaterial)({
			color: this.color,
			map: tex,
			side: this.render_side,
			alphaTest: 0.05
		});
		if (typeof this.color == 'object') {
			this.material.color.copy(this.color);
		}

		if (this.build_data.position) this.model_3d.position.fromArray(this.build_data.position);
		if (this.build_data.rotation) this.model_3d.rotation.fromArray(this.build_data.rotation.map(r => Math.degToRad(r)));
		if (this.build_data.scale) this.model_3d.scale.fromArray(this.build_data.scale);

		this.build_data.cubes.forEach(cube => {
			if (cube.prefab) {
				if (!this.build_data.prefabs[cube.prefab]) console.error(`Invalid prefab "${cube.prefab}"`)
				cube = Object.assign(cube, this.build_data.prefabs[cube.prefab]);
				if (cube.offset) {
					if (cube.offset_space == 'block') cube.offset.V3_multiply(16);
					cube.position = cube.position.slice().V3_add(cube.offset);
					if (cube.origin) cube.origin = cube.origin.slice().V3_add(cube.offset);
				}
			}
			let mesh = new THREE.Mesh(new THREE.BoxGeometry(cube.size[0], cube.size[1], cube.size[2]), this.material)
			if (cube.origin) {
				mesh.position.set(cube.origin[0], cube.origin[1], cube.origin[2])
				mesh.geometry.translate(-cube.origin[0], -cube.origin[1], -cube.origin[2])
			}
			mesh.geometry.translate(cube.position[0] + cube.size[0]/2, cube.position[1] + cube.size[1]/2, cube.position[2] + cube.size[2]/2)
			if (cube.rotation) {
				// @ts-expect-error
				mesh.rotation.setFromDegreeArray(cube.rotation)
			}

			let getUVArray = (face) => {
				let arr = [
					[face.uv[0]/this.texture_size[0], 1-(face.uv[1]/this.texture_size[1])],
					[face.uv[2]/this.texture_size[0], 1-(face.uv[1]/this.texture_size[1])],
					[face.uv[0]/this.texture_size[0], 1-(face.uv[3]/this.texture_size[1])],
					[face.uv[2]/this.texture_size[0], 1-(face.uv[3]/this.texture_size[1])]
				]
				let rot = (face.rotation+0)
				while (rot > 0) {
					let a = arr[0];
					arr[0] = arr[2];
					arr[2] = arr[3];
					arr[3] = arr[1];
					arr[1] = a;
					rot = rot-90;
				}
				return arr;
			}

			let indices = [];
			// @ts-expect-error
			mesh.geometry.faces = [];
			mesh.geometry.clearGroups();
			Canvas.face_order.forEach((fkey, i) => {
				if (cube.faces[fkey]) {
					indices.push(0 + i*4, 2 + i*4, 1 + i*4, 2 + i*4, 3 + i*4, 1 + i*4);
					// @ts-expect-error
					mesh.geometry.faces.push(fkey)
				}
			})
			mesh.geometry.setIndex(indices);

			for (let face in cube.faces) {
				let uv_array = getUVArray(cube.faces[face]);
				let fIndex = 0;
				switch(face) {
					case 'north':   fIndex = 10;	break;
					case 'east':	fIndex = 0;		break;
					case 'south':   fIndex = 8;		break;
					case 'west':	fIndex = 2;		break;
					case 'up':		fIndex = 4;		break;
					case 'down':	fIndex = 6;		break;
				}
				let uv_attr = mesh.geometry.attributes.uv;
				(uv_attr.array as any).set(uv_array[0], fIndex*4 + 0);  //0,1
				(uv_attr.array as any).set(uv_array[1], fIndex*4 + 2);  //1,1
				(uv_attr.array as any).set(uv_array[2], fIndex*4 + 4);  //0,0
				(uv_attr.array as any).set(uv_array[3], fIndex*4 + 6);  //1,0
				uv_attr.needsUpdate = true;
			}

			this.model_3d.add(mesh);
		})
		return this;
	}
	delete() {
		delete PreviewModel.models[this.id];
	}

	static generateModelFromProject() {
		let cubes = Cube.all.map(cube => {
			let from = cube.from.slice() as ArrayVector3;
			let to = cube.to.slice() as ArrayVector3;
			adjustFromAndToForInflateAndStretch(from, to, cube);
			let data = {
				"position": from,
				"size": to.V3_subtract(from),
				"origin": undefined,
				"rotation": undefined,
				"faces": {}
			}
			if (cube.rotation.allEqual(0) == false) {
				data.rotation = cube.rotation.slice();
				data.origin = cube.origin.slice();
			}
			for (let fkey in cube.faces) {
				let face = cube.faces[fkey];
				if (face.texture == null) continue;
				data.faces[fkey] = new oneLiner({
					uv: face.uv.slice()
				})
			}
			return data;
		});
		let texture = Texture.getDefault();
		let texture_size = [
			Project.getUVWidth(texture),
			Project.getUVHeight(texture),
		]
		return compileJSON({
			texture_size,
			cubes
		});
	}
	static models: Record<string, PreviewModel> = {};
	static getActiveModels = function(): PreviewModel[] {
		let list = [];
		for (let id in PreviewModel.models) {
			let model = PreviewModel.models[id];
			if (model.enabled) {
				list.push(model);
			}
		}
		return list;
	}
	static transform_model: PreviewModel | null = null;
}

new PreviewModel('studio', {
	name: 'preview_scene.studio',
	texture: './assets/preview_scenes/studio.png',
	texture_size: [64, 64],
	shading: false,
	render_side: THREE.BackSide,
	cubes: [
		{position: [-240, 0, -240], size: [480, 128, 480], faces: {
			up: {uv: [0, 16.04, 15.96, 31.96]},
			down: {uv: [0, 0, 16, 16]},
		}},
		{position: [48, 0, -240], size: [96, 128, 480], faces: {
			south: {uv: [16.06, 0, 64, 64]},
			north: {uv: [16.06, 0, 64, 64]}
		}},
		{position: [-48, 0, -240], size: [96, 128, 480], faces: {
			south: {uv: [16.06, 0, 64, 64]},
			north: {uv: [16.06, 0, 64, 64]}
		}},
		{position: [-144, 0, -240], size: [96, 128, 480], faces: {
			south: {uv: [16.06, 0, 64, 64]},
			north: {uv: [16.06, 0, 64, 64]}
		}},
		{position: [144, 0, -240], size: [96, 128, 480], faces: {
			south: {uv: [16.06, 0, 64, 64]},
			north: {uv: [16.06, 0, 64, 64]}
		}},
		{position: [-240, 0, -240], size: [96, 128, 480], faces: {
			south: {uv: [16.06, 0, 64, 64]},
			north: {uv: [16.06, 0, 64, 64]}
		}},

		{position: [-240, 0, 48], size: [480, 128, 96], faces: {
			east: {uv: [16.06, 0, 64, 64]},
			west: {uv: [16.06, 0, 64, 64]}
		}},
		{position: [-240, 0, -48], size: [480, 128, 96], faces: {
			east: {uv: [16.06, 0, 64, 64]},
			west: {uv: [16.06, 0, 64, 64]}
		}},
		{position: [-240, 0, -144], size: [480, 128, 96], faces: {
			east: {uv: [16.06, 0, 64, 64]},
			west: {uv: [16.06, 0, 64, 64]}
		}},
		{position: [-240, 0, 144], size: [480, 128, 96], faces: {
			east: {uv: [16.06, 0, 64, 64]},
			west: {uv: [16.06, 0, 64, 64]}
		}},
		{position: [-240, 0, -240], size: [480, 128, 96], faces: {
			east: {uv: [16.06, 0, 64, 64]},
			west: {uv: [16.06, 0, 64, 64]}
		}},
	]
})
// Scenes
new PreviewScene('studio', {
	category: 'generic',
	light_color: {r: 1.04, g: 1.03, b: 1.1},
	light_side: 1,
	preview_models: ['studio']
});
new PreviewScene('sky', {
	category: 'realistic',
	web_config: 'realistic/sky/sky.json',
});
new PreviewScene('space', {
	category: 'realistic',
	web_config: 'realistic/space/space.json',
});
new PreviewScene('minecraft_plains', {
	category: 'minecraft',
	web_config: 'minecraft/plains/plains.json',
	require_minecraft_eula: true,
});
new PreviewScene('minecraft_snowy_tundra', {
	category: 'minecraft',
	web_config: 'minecraft/snowy_tundra/snowy_tundra.json',
	require_minecraft_eula: true,
});
new PreviewScene('minecraft_cherry_grove', {
	category: 'minecraft',
	web_config: 'minecraft/cherry_grove/cherry_grove.json',
	require_minecraft_eula: true,
});
new PreviewScene('minecraft_sunset', {
	category: 'minecraft',
	web_config: 'minecraft/sunset/sunset.json',
	require_minecraft_eula: true,
});
new PreviewScene('minecraft_night', {
	category: 'minecraft',
	web_config: 'minecraft/night/night.json',
	require_minecraft_eula: true,
});
new PreviewScene('minecraft_desert', {
	category: 'minecraft',
	web_config: 'minecraft/desert/desert.json',
	require_minecraft_eula: true,
});
new PreviewScene('minecraft_ocean', {
	category: 'minecraft',
	web_config: 'minecraft/ocean/ocean.json',
	require_minecraft_eula: true,
});
new PreviewScene('minecraft_underwater', {
	category: 'minecraft',
	web_config: 'minecraft/underwater/underwater.json',
	require_minecraft_eula: true,
});
new PreviewScene('minecraft_coral_reef', {
	category: 'minecraft',
	web_config: 'minecraft/coral_reef/coral_reef.json',
	require_minecraft_eula: true,
});
new PreviewScene('minecraft_lush_cave', {
	category: 'minecraft',
	web_config: 'minecraft/lush_cave/lush_cave.json',
	require_minecraft_eula: true,
});
new PreviewScene('minecraft_deep_dark', {
	category: 'minecraft',
	web_config: 'minecraft/deep_dark/deep_dark.json',
	require_minecraft_eula: true,
});
new PreviewScene('minecraft_nether', {
	category: 'minecraft',
	web_config: 'minecraft/nether/nether.json',
	require_minecraft_eula: true,
});
new PreviewScene('minecraft_end', {
	category: 'minecraft',
	web_config: 'minecraft/end/end.json',
	require_minecraft_eula: true,
});


export const player_preview_model = new PreviewModel('minecraft_player', {
	name: 'preview_model.minecraft_player',
	texture: './assets/player_skin.png',
	texture_size: [64, 64],
	position: [22, 0, 0],
	rotation: [0, 20, 0],
	scale: [0.9375, 0.9375, 0.9375],
	onUpdate() {
		this.material.color.copy(Canvas.global_light_color);
		if (!this.was_set_up) {
			DisplayMode.updateDisplaySkin();
			this.was_set_up = true;
		}
	},
	cubes: [
		{
			// "Head
			"position": [-4, 24, -4],
			"size": [8, 8, 8],
			"rotation": [0, 18, 0],
			"faces": {
				"north": {"uv": [8, 8, 16, 16]},
				"east": {"uv": [0, 8, 8, 16]},
				"south": {"uv": [24, 8, 32, 16]},
				"west": {"uv": [16, 8, 24, 16]},
				"up": {"uv": [16, 8, 8, 0]},
				"down": {"uv": [24, 0, 16, 8]}
			}
		},
		{
			// Hat Layer
			"position": [-4.5, 23.5, -4.5],
			"size": [9, 9, 9],
			"rotation": [0, 18, 0],
			"faces": {
				"north": {"uv": [40, 8, 48, 16]},
				"east": {"uv": [32, 8, 40, 16]},
				"south": {"uv": [56, 8, 64, 16]},
				"west": {"uv": [48, 8, 56, 16]},
				"up": {"uv": [48, 8, 40, 0]},
				"down": {"uv": [56, 0, 48, 8]}
			}
		},
		{
			// "Body
			"position": [-4, 12, -2],
			"size": [8, 12, 4],
			"faces": {
				"north": {"uv": [20, 20, 28, 32]},
				"east": {"uv": [16, 20, 20, 32]},
				"south": {"uv": [32, 20, 40, 32]},
				"west": {"uv": [28, 20, 32, 32]},
				"up": {"uv": [28, 20, 20, 16]},
				"down": {"uv": [36, 16, 28, 20]}
			}
		},
		{
			// Body Layer
			"position": [-4.25, 11.75, -2.25],
			"size": [8.5, 12.5, 4.5],
			"faces": {
				"north": {"uv": [20, 36, 28, 48]},
				"east": {"uv": [16, 36, 20, 48]},
				"south": {"uv": [32, 36, 40, 48]},
				"west": {"uv": [28, 36, 32, 48]},
				"up": {"uv": [28, 36, 20, 32]},
				"down": {"uv": [36, 32, 28, 36]}
			}
		},


		// ======= Wide Arms
		{
			// Right Arm
			"position": [4, 12, -2],
			"size": [4, 12, 4],
			"origin": [5, 22, 0],
			"rotation": [-1, 0, 3],
			"faces": {
				"north": {"uv": [44, 20, 48, 32]},
				"east": {"uv": [40, 20, 44, 32]},
				"south": {"uv": [52, 20, 56, 32]},
				"west": {"uv": [48, 20, 52, 32]},
				"up": {"uv": [48, 20, 44, 16]},
				"down": {"uv": [52, 16, 48, 20]}
			}
		},
		{
			// Arm Layer
			"position": [3.75, 11.75, -2.25],
			"size": [4.5, 12.5, 4.5],
			"origin": [5, 22, 0],
			"rotation": [-1, 0, 3],
			"faces": {
				"north": {"uv": [44, 36, 48, 48]},
				"east": {"uv": [40, 36, 44, 48]},
				"south": {"uv": [52, 36, 56, 48]},
				"west": {"uv": [48, 36, 52, 48]},
				"up": {"uv": [48, 36, 44, 32]},
				"down": {"uv": [52, 32, 48, 36]}
			}
		},
		{
			// Left Arm
			"position": [-8, 12, -2],
			"size": [4, 12, 4],
			"origin": [-5, 22, 0],
			"rotation": [1, 0, -3],
			"faces": {
				"north": {"uv": [36, 52, 40, 64]},
				"east": {"uv": [32, 52, 36, 64]},
				"south": {"uv": [44, 52, 48, 64]},
				"west": {"uv": [40, 52, 44, 64]},
				"up": {"uv": [40, 52, 36, 48]},
				"down": {"uv": [44, 48, 40, 52]}
			}
		},
		{
			// Arm Layer
			"position": [-8.25, 11.75, -2.25],
			"size": [4.5, 12.5, 4.5],
			"origin": [-5, 22, 0],
			"rotation": [1, 0, -3],
			"faces": {
				"north": {"uv": [52, 52, 56, 64]},
				"east": {"uv": [48, 52, 52, 64]},
				"south": {"uv": [60, 52, 64, 64]},
				"west": {"uv": [56, 52, 60, 64]},
				"up": {"uv": [56, 52, 52, 48]},
				"down": {"uv": [60, 48, 56, 52]}
			}
		},


		// ======= Slim Arms
		{
			// Right Arm
			"position": [4, 11.5, -2],
			"size": [3, 12, 4],
			"origin": [5, 21.5, 0],
			"rotation": [-1, 0, 3],
			"faces": {
				"north": {"uv": [44,20,47,32]},
				"east": {"uv": [40,20,44,32]},
				"south": {"uv": [51,20,54,32]},
				"west": {"uv": [47,20,51,32]},
				"up": {"uv": [47,20,44,16]},
				"down": {"uv": [50,16,47,20]}
			}
		},
		{
			// Arm Layer
			"position": [3.75, 11.25, -2.25],
			"size": [3.5, 12.5, 4.5],
			"origin": [5, 21.5, 0],
			"rotation": [-1, 0, 3],
			"faces": {
				"north": {"uv": [44,36,47,48]},
				"east": {"uv": [40,36,44,48]},
				"south": {"uv": [51,36,54,48]},
				"west": {"uv": [47,36,51,48]},
				"up": {"uv": [47,36,44,32]},
				"down": {"uv": [50,32,47,36]}
			}
		},
		{
			// Left Arm
			"position": [-7, 11.5, -2],
			"size": [3, 12, 4],
			"origin": [-5, 21.5, 0],
			"rotation": [1, 0, -3],
			"faces": {
				"north": {"uv": [36,52,39,64]},
				"east": {"uv": [32,52,36,64]},
				"south": {"uv": [43,52,46,64]},
				"west": {"uv": [39,52,43,64]},
				"up": {"uv": [39,52,36,48]},
				"down": {"uv": [42,48,39,52]}
			}
		},
		{
			// Arm Layer
			"position": [-7.25, 11.25, -2.25],
			"size": [3.5, 12.5, 4.5],
			"origin": [-5, 21.5, 0],
			"rotation": [1, 0, -3],
			"faces": {
				"north": {"uv": [52,52,55,64]},
				"east": {"uv": [48,52,52,64]},
				"south": {"uv": [59,52,62,64]},
				"west": {"uv": [55,52,59,64]},
				"up": {"uv": [55,52,52,48]},
				"down": {"uv": [58,48,55,52]}
			}
		},



		{
			// Right Leg
			"position": [-0.1, 0, -2],
			"size": [4, 12, 4],
			"faces": {
				"north": {"uv": [4, 20, 8, 32]},
				"east": {"uv": [0, 20, 4, 32]},
				"south": {"uv": [12, 20, 16, 32]},
				"west": {"uv": [8, 20, 12, 32]},
				"up": {"uv": [8, 20, 4, 16]},
				"down": {"uv": [12, 16, 8, 20]}
			}
		},
		{
			// Leg Layer
			"position": [-0.35, -0.25, -2.25],
			"size": [4.5, 12.5, 4.5],
			"faces": {
				"north": {"uv": [4, 36, 8, 48]},
				"east": {"uv": [0, 36, 4, 48]},
				"south": {"uv": [12, 36, 16, 48]},
				"west": {"uv": [8, 36, 12, 48]},
				"up": {"uv": [8, 36, 4, 32]},
				"down": {"uv": [12, 32, 8, 36]}
			}
		},
		{
			// Left Leg
			"position": [-3.9, 0, -2],
			"size": [4, 12, 4],
			"faces": {
				"north": {"uv": [20, 52, 24, 64]},
				"east": {"uv": [16, 52, 20, 64]},
				"south": {"uv": [28, 52, 32, 64]},
				"west": {"uv": [24, 52, 28, 64]},
				"up": {"uv": [24, 52, 20, 48]},
				"down": {"uv": [28, 48, 24, 52]}
			}
		},
		{
			// Leg Layer
			"position": [-4.15, -0.25, -2.25],
			"size": [4.5, 12.5, 4.5],
			"faces": {
				"north": {"uv": [4, 52, 8, 64]},
				"east": {"uv": [0, 52, 4, 64]},
				"south": {"uv": [12, 52, 16, 64]},
				"west": {"uv": [8, 52, 12, 64]},
				"up": {"uv": [8, 52, 4, 48]},
				"down": {"uv": [12, 48, 8, 52]}
			}
		}
	]
})

player_preview_model.updateArmVariant = function(slim) {
	for (let i = 4; i < 8; i++) {
		this.model_3d.children[i].visible = !slim;
	}
	for (let i = 8; i < 12; i++) {
		this.model_3d.children[i].visible = !!slim;
	}
}

StateMemory.init('minecraft_eula_accepted', 'object');
export const MinecraftEULA = {
	isAccepted(key: string) {
		return StateMemory.minecraft_eula_accepted[key];
	},
	async promptUser(key: string) {
		if (MinecraftEULA.isAccepted(key)) {
			return true;
		}
		return await new Promise((resolve) => {
			Blockbench.showMessageBox({
				width: 540,
				title: 'Minecraft EULA',
				message: 'This feature includes Minecraft assets. In order to use it, you need to agree to the [Minecraft End User License Agreement (EULA)](https://www.minecraft.net/en-us/eula).',
				icon: 'icon-format_bedrock',
				checkboxes: {
					accepted: {text: 'I have read the End User License Agreement and I agree to its terms', value: false}
				},
				buttons: ['dialog.ok', 'dialog.cancel']
			}, (button, result) => {
				if (button == 0 && result.accepted) {
					StateMemory.minecraft_eula_accepted[key] = true;
					StateMemory.save('minecraft_eula_accepted');
				} else if (button == 0) {
					return false;
				}
				resolve(result.accepted);
			})
		})
	}
}

BARS.defineActions(function() {
	new Action('preview_scene', {
		category: 'view',
		icon: 'nature_people',
		click(event) {
			new Menu(this.children).show(event.target as HTMLElement);
		},
		children: () => {
			let list = [];
			for (let category in PreviewScene.menu_categories) {
				let options = PreviewScene.menu_categories[category];
				if (options._label) {
					list.push(new MenuSeparator('options_'+toSnakeCase(options._label), options._label));
				}
				for (let key in options) {
					if (key.startsWith('_')) continue;
					let scene = PreviewScene.scenes[key];
					list.push({
						id: key,
						name: options[key],
						icon: PreviewScene.active == scene ? 'far.fa-dot-circle' : 'far.fa-circle',
						click() {
							if (scene) {
								scene.select();
							} else if (PreviewScene.active) {
								PreviewScene.active.unselect();
							}
						}
					})
				}
			}
			return list;

		}
	})
	new Action('preview_models', {
		category: 'view',
		icon: 'park',
		click(event) {
			new Menu(this.children).show(event.target as HTMLElement);
		},
		children: () => {
			let list = [];
			for (let id in PreviewModel.models) {
				let model = PreviewModel.models[id];
				list.push({
					name: (model.name || id),
					icon: model.enabled ? 'check_box' : 'check_box_outline_blank',
					click() {
						if (!model.enabled) {
							model.enable();
						} else {
							model.disable();
						}
					},
					children: model.enabled == false ? undefined : [
						{
							name: 'preview_model.transform',
							icon: 'control_camera',
							click() {
								PreviewModel.transform_model = model;
								Transformer.updateSelection();
							}
						},
						{
							name: 'preview_model.reset_transform',
							icon: 'reset_settings',
							click() {
								delete StateMemory.preview_model_customization[model.id];
								StateMemory.save('preview_model_customization');
								model.update();
							}

						}
					] as CustomMenuItem[]
				})
			}
			return list;

		}
	})
})

new TransformerModule('preview_model', {
	priority: 3,
	condition: () => PreviewModel.transform_model != undefined,
	updateGizmo() {
		let model = PreviewModel.transform_model;
		let channel = Toolbox.selected.animation_channel;

		model.model_3d.getWorldPosition(Transformer.position);
		Transformer.position.sub(Canvas.scene.position);
		let local = channel != 'position';
		Transformer.rotation_ref = local ? model.model_3d : Canvas.scene;
		return true;
	},
	calculateOffset(context) {
		let {point, axis, angle, event} = context;
		let channel = Toolbox.selected.animation_channel
		let value = point[axis];
		let interval = 1;
		
		if (channel == 'rotation') {
			value = angle;
			interval = getRotationInterval(event)
		} else if (channel == 'position') {
			interval = getSpatialInterval(context.event);
			
		} else if (channel == 'scale') {
			value *= context.direction * 0.1;
			interval = getSpatialInterval(context.event);
			interval *= 0.1;
		}
		value = Math.round(value/interval)*interval;

		return value;
	},
	onMove(context) {
		let {point, axis, axis_number, value} = context;
		let model = PreviewModel.transform_model;
		let channel = Toolbox.selected.animation_channel

		let difference = value - (this.previous_value||0);

		let data = StateMemory.preview_model_customization;
		let model_data = data[model.id];
		if (!model_data) model_data = data[model.id] = {};

		if (channel == 'position') {
			model.model_3d.position[axis] += difference;
			model_data.position = model.model_3d.position.toArray();
		} else if (channel == 'rotation') {
			model.model_3d.rotation[axis] += Math.degToRad(difference);
			model_data.rotation = [
				Math.radToDeg(model.model_3d.rotation.x),
				Math.radToDeg(model.model_3d.rotation.y),
				Math.radToDeg(model.model_3d.rotation.z),
			];
		} else {
			model.model_3d.scale[axis] += difference;
			model_data.scale = model.model_3d.scale.toArray();
		}

		Blockbench.setCursorTooltip(trimFloatNumber(value - this.initial_value));
		Transformer.center()

	},
	onEnd(context) {
		StateMemory.save('preview_model_customization');
	},
});

const global = {
	PreviewScene,
	PreviewModel,
	MinecraftEULA,
	player_preview_model
};
declare global {
	type PreviewScene = import('./preview_scenes').PreviewScene
	const PreviewScene: typeof global.PreviewScene
	type PreviewModel = import('./preview_scenes').PreviewModel
	const PreviewModel: typeof global.PreviewModel
	const MinecraftEULA: typeof global.MinecraftEULA
	const player_preview_model: PreviewModel
}
Object.assign(window, global);
