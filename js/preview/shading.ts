export type ShadingModeType = 'gradient' | 'cardinal' | 'directional'

export interface ShadingModeFaces {
	up?: number
	down?: number
	north?: number
	south?: number
	east?: number
	west?: number
}

export interface ShadingModeOptions {
	/**
	 * Display name of the shading mode
	 */
	name?: string
	/**
	 * How the shade of a face is calculated. `gradient` is Blockbench's own smooth shading, `cardinal` shades
	 * each face by the axis it points along, and `directional` lights the model with two directional lights
	 */
	type?: ShadingModeType
	/**
	 * Shade of each cardinal direction, for `cardinal` modes
	 */
	faces?: ShadingModeFaces
	/**
	 * The two light directions, for `directional` modes. They do not need to be normalized
	 */
	lights?: [ArrayVector3, ArrayVector3]
}

const shader_types: Record<ShadingModeType, number> = {gradient: 0, cardinal: 1, directional: 2};

export const shading_uniforms = {
	SHADEMODE: {type: 'int', value: 0},
	SHADEPOS: {type: 'vec3', value: new THREE.Vector3(0.6, 1, 0.8)},
	SHADENEG: {type: 'vec3', value: new THREE.Vector3(0.6, 0.5, 0.8)},
	LIGHTDIR0: {type: 'vec3', value: new THREE.Vector3(0, 1, 0)},
	LIGHTDIR1: {type: 'vec3', value: new THREE.Vector3(0, -1, 0)},
};

export const ShadingModes: Record<string, ShadingMode> = {};

export class ShadingMode {
	id: string
	name: string
	type: ShadingModeType
	faces: Required<ShadingModeFaces>
	lights: [ArrayVector3, ArrayVector3]

	constructor(id: string, data: ShadingModeOptions = {}) {
		this.id = id;
		this.name = data.name ?? id;
		this.type = data.type ?? 'cardinal';
		this.faces = {up: 1, down: 0.5, north: 0.8, south: 0.8, east: 0.6, west: 0.6, ...data.faces};
		this.lights = data.lights ?? [[0, 1, 0], [0, -1, 0]];
		ShadingModes[id] = this;
	}
	apply() {
		shading_uniforms.SHADEMODE.value = shader_types[this.type];
		if (this.type == 'cardinal') {
			shading_uniforms.SHADEPOS.value.set(this.faces.east, this.faces.up, this.faces.south);
			shading_uniforms.SHADENEG.value.set(this.faces.west, this.faces.down, this.faces.north);
		} else if (this.type == 'directional') {
			shading_uniforms.LIGHTDIR0.value.fromArray(this.lights[0]).normalize();
			shading_uniforms.LIGHTDIR1.value.fromArray(this.lights[1]).normalize();
		}
	}
	delete() {
		delete ShadingModes[this.id];
	}
	/**
	 * Shading mode that display mode and other contexts render with, overriding every other source
	 */
	static override: string | null = null;
	/**
	 * Resolves the shading mode to render with, in order of priority
	 */
	static getActive(): ShadingMode {
		return ShadingModes[ShadingMode.override]
			|| ShadingModes[Format?.shading_mode]
			|| ShadingModes[PreviewScene.active?.shading_mode]
			|| ShadingModes[settings.shading_mode?.value as string]
			|| ShadingModes.blockbench;
	}
	static getSelectOptions(): Record<string, string> {
		let options: Record<string, string> = {};
		for (let id in ShadingModes) {
			options[id] = tl(ShadingModes[id].name);
		}
		return options;
	}
}

new ShadingMode('blockbench', {
	name: 'Blockbench',
	type: 'gradient'
});
new ShadingMode('minecraft_world', {
	name: 'Minecraft World',
	type: 'cardinal',
	faces: {up: 1, down: 0.5, north: 0.8, south: 0.8, east: 0.6, west: 0.6}
});
new ShadingMode('minecraft_gui_front', {
	name: 'Minecraft GUI (Front)',
	type: 'directional',
	lights: [[-0.2225, 0.1715, 0.9597], [-0.2150, 0.9718, 0.0966]]
});
new ShadingMode('minecraft_gui_side', {
	name: 'Minecraft GUI (Side)',
	type: 'directional',
	lights: [[-0.9334, 0.2627, -0.2443], [-0.1036, 0.9766, 0.1884]]
});
new ShadingMode('minecraft_entity', {
	name: 'Minecraft Entity',
	type: 'directional',
	lights: [[0.2, 1, -0.7], [-0.2, 1, 0.7]]
});

const global = {
	ShadingMode,
	ShadingModes
};
declare global {
	type ShadingMode = import('./shading').ShadingMode
	const ShadingMode: typeof global.ShadingMode
	const ShadingModes: Record<string, ShadingMode>
}
Object.assign(window, global);
