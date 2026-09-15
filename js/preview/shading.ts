export interface ShadingUniform {
	type: string
	value: any
}

export interface ShadingTypeOptions {
	/**
	 * Uniforms this type needs, declared into every shader that supports shading modes
	 */
	uniforms?: Record<string, ShadingUniform>
	/**
	 * Body that calculates the shade. `N` is the world space normal, and the snippet must assign to `light`
	 */
	glsl: string
	/**
	 * Writes a mode of this type into the uniforms
	 */
	apply?(mode: ShadingMode, uniforms: Record<string, ShadingUniform>): void
}

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
	 * ID of the shading type that calculates the shade
	 */
	type?: string
	/**
	 * Shade of each cardinal direction, for `cardinal` modes
	 */
	faces?: ShadingModeFaces
	/**
	 * The two light directions, for `directional` modes. They do not need to be normalized
	 */
	lights?: [ArrayVector3, ArrayVector3]
	/**
	 * How much the lights contribute, for `directional` modes
	 */
	power?: number
	/**
	 * Shade of a face that no light reaches, for `directional` modes
	 */
	ambient?: number
	/**
	 * Light colour of the environment this mode renders, multiplied with the preview scene's own colour
	 */
	color?: ArrayVector3
	[key: string]: any
}

export const shading_uniforms: Record<string, ShadingUniform> = {
	SHADEMODE: {type: 'int', value: 0}
};

export const ShadingTypes: Record<string, ShadingType> = {};
export const ShadingModes: Record<string, ShadingMode> = {};

export class ShadingType {
	id: string
	index: number
	uniforms: Record<string, ShadingUniform>
	glsl: string
	apply: (mode: ShadingMode, uniforms: Record<string, ShadingUniform>) => void

	constructor(id: string, data: ShadingTypeOptions) {
		this.id = id;
		this.glsl = data.glsl;
		this.uniforms = data.uniforms ?? {};
		this.apply = data.apply ?? (() => {});
		this.index = ShadingType.all.length;
		ShadingType.all.push(this);
		ShadingTypes[id] = this;
		Object.assign(shading_uniforms, this.uniforms);
	}
	static all: ShadingType[] = []
}

export function compileShading(source: string): string {
	if (!source.includes('SHADING_')) return source;
	let declarations = '';
	for (let name in shading_uniforms) {
		if (name == 'SHADEMODE') continue;
		declarations += `uniform ${shading_uniforms[name].type} ${name};\n`;
	}
	let branches = '';
	for (let type of ShadingType.all) {
		branches += `${branches ? '} else ' : ''}if (SHADEMODE == ${type.index}) {\n${type.glsl}\n`;
	}
	return source
		.replace('SHADING_UNIFORMS', declarations.trimEnd())
		.replace('SHADING_MODES', branches + '}');
}

export class ShadingMode {
	id: string
	name: string
	type: string
	faces: Required<ShadingModeFaces>
	lights: [ArrayVector3, ArrayVector3]
	power: number
	ambient: number
	color: THREE.Color
	[key: string]: any

	constructor(id: string, data: ShadingModeOptions = {}) {
		Object.assign(this, data);
		this.id = id;
		this.name = data.name ?? id;
		this.type = data.type ?? 'cardinal';
		this.faces = {up: 1, down: 0.5, north: 0.8, south: 0.8, east: 0.6, west: 0.6, ...data.faces};
		this.lights = data.lights ?? [[0, 1, 0], [0, -1, 0]];
		this.power = data.power ?? 0.6;
		this.ambient = data.ambient ?? 0.4;
		this.color = new THREE.Color().fromArray(data.color ?? [1, 1, 1]);
		ShadingModes[id] = this;
		ShadingMode.updateSelectOptions();
	}
	writeUniforms(uniforms: Record<string, ShadingUniform>): Record<string, ShadingUniform> {
		let type = ShadingTypes[this.type];
		if (!type) return uniforms;
		uniforms.SHADEMODE.value = type.index;
		type.apply(this, uniforms);
		return uniforms;
	}
	apply() {
		this.writeUniforms(shading_uniforms);
	}
	/**
	 * Uniforms for a material that always renders with this mode, whatever the scene uses
	 */
	getUniforms(): Record<string, ShadingUniform> {
		let uniforms: Record<string, ShadingUniform> = {SHADEMODE: {type: 'int', value: 0}};
		for (let name in shading_uniforms) {
			if (name == 'SHADEMODE') continue;
			let {type, value} = shading_uniforms[name];
			uniforms[name] = {type, value: value?.clone ? value.clone() : value};
		}
		return this.writeUniforms(uniforms);
	}
	delete() {
		delete ShadingModes[this.id];
		ShadingMode.updateSelectOptions();
	}
	/**
	 * Resolves the shading mode to render with, in order of priority
	 */
	static getActive(): ShadingMode {
		let format_mode = Format?.shading_mode;
		if (typeof format_mode == 'function') format_mode = format_mode();
		return ShadingModes[settings.shading_mode?.value as string]
			|| ShadingModes[PreviewScene.shown?.shading_mode]
			|| ShadingModes[format_mode]
			|| ShadingModes.minecraft_world;
	}
	static updateSelectOptions() {
		if (typeof settings != 'undefined' && settings.shading_mode) {
			settings.shading_mode.options = ShadingMode.getSelectOptions();
		}
	}
	static getSelectOptions(): Record<string, string> {
		let options: Record<string, string> = {auto: tl('settings.shading_mode.auto')};
		for (let id in ShadingModes) {
			options[id] = tl(ShadingModes[id].name);
		}
		return options;
	}
}

new ShadingType('cardinal', {
	uniforms: {
		SHADEPOS: {type: 'vec3', value: new THREE.Vector3(0.6, 1, 0.8)},
		SHADENEG: {type: 'vec3', value: new THREE.Vector3(0.6, 0.5, 0.8)}
	},
	glsl: `
			vec3 S = N * N;
			light = S.x * (N.x >= 0.0 ? SHADEPOS.x : SHADENEG.x)
				+ S.y * (N.y >= 0.0 ? SHADEPOS.y : SHADENEG.y)
				+ S.z * (N.z >= 0.0 ? SHADEPOS.z : SHADENEG.z);`,
	apply(mode, uniforms) {
		uniforms.SHADEPOS.value.set(mode.faces.east, mode.faces.up, mode.faces.south);
		uniforms.SHADENEG.value.set(mode.faces.west, mode.faces.down, mode.faces.north);
	}
});
new ShadingType('directional', {
	uniforms: {
		LIGHTDIR0: {type: 'vec3', value: new THREE.Vector3(0, 1, 0)},
		LIGHTDIR1: {type: 'vec3', value: new THREE.Vector3(0, -1, 0)},
		SHADEMIX: {type: 'vec2', value: new THREE.Vector2(0.6, 0.4)}
	},
	glsl: `
			light = min(1.0, (max(0.0, dot(N, LIGHTDIR0)) + max(0.0, dot(N, LIGHTDIR1))) * SHADEMIX.x + SHADEMIX.y);`,
	apply(mode, uniforms) {
		uniforms.LIGHTDIR0.value.fromArray(mode.lights[0]).normalize();
		uniforms.LIGHTDIR1.value.fromArray(mode.lights[1]).normalize();
		uniforms.SHADEMIX.value.set(mode.power, mode.ambient);
	}
});

new ShadingMode('minecraft_world', {
	name: 'Minecraft World',
	type: 'cardinal',
	faces: {up: 1, down: 0.5, north: 0.8, south: 0.8, east: 0.6, west: 0.6}
});
new ShadingMode('minecraft_nether', {
	name: 'Minecraft Nether',
	type: 'cardinal',
	faces: {up: 0.9, down: 0.9, north: 0.8, south: 0.8, east: 0.6, west: 0.6},
	color: [0.377, 0.314, 0.259]
});
new ShadingMode('minecraft_night', {
	name: 'Minecraft Night',
	type: 'cardinal',
	color: [0.279, 0.279, 0.505]
});
new ShadingMode('minecraft_end', {
	name: 'Minecraft End',
	type: 'cardinal',
	color: [0.447, 0.504, 0.447]
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
new ShadingMode('soft', {
	name: 'Soft',
	type: 'cardinal',
	faces: {up: 1, down: 0.8, north: 0.92, south: 0.92, east: 0.86, west: 0.86}
});
new ShadingMode('studio', {
	name: 'Studio',
	type: 'cardinal',
	faces: {up: 0.8, down: 0.8, north: 1, south: 0.5, east: 0.6, west: 0.6},
	color: [1.04, 1.03, 1.1]
});

const global = {
	ShadingMode,
	ShadingModes,
	ShadingType,
	ShadingTypes
};
declare global {
	type ShadingMode = import('./shading').ShadingMode
	const ShadingMode: typeof global.ShadingMode
	const ShadingModes: Record<string, ShadingMode>
	type ShadingType = import('./shading').ShadingType
	const ShadingType: typeof global.ShadingType
	const ShadingTypes: Record<string, ShadingType>
}
Object.assign(window, global);
