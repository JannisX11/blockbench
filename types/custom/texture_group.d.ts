/// <reference path="./blockbench.d.ts"/>

interface TextureGroupOptions {
	uuid?: string
	name?: string
	is_material?: boolean
	material_config?: TextureGroupMaterialConfigData
}

/**
 * A way to group textures. Texture groups can also be used to represent materials in enabled formats
 */
declare class TextureGroup {
	static all: TextureGroup[]

	constructor(data?: Omit<TextureGroupOptions, 'uuid'>, uuid?: string)
	uuid: string
	name: string
	folded: boolean
	/**
	 * If true, the texture group works as a material
	 */
	is_material: boolean
	/**
	 * Material configuration
	 */
	material_config: TextureGroupMaterialConfig
	get material(): THREE.MeshStandardMaterial
	extend(data: TextureGroupOptions): this
	add(): this
	select(): this
	remove(): void
	showContextMenu(event: Event): void
	rename(): this
	getTextures(): Texture[]
	getUndoCopy(): Required<TextureGroupOptions>
	getSaveCopy(): Omit<TextureGroupOptions, 'is_material' | 'uuid'>
	updateMaterial(): void
	getMaterial(): THREE.MeshStandardMaterial
}

interface TextureGroupMaterialConfigData {
	color_value?: [number, number, number, number]
	mer_value?: [number, number, number]
	saved?: boolean
}
declare class TextureGroupMaterialConfig {
	constructor(texture_group: TextureGroup, data: TextureGroupMaterialConfigData)
	color_value: [number, number, number, number]
	mer_value: [number, number, number]
	saved: boolean
	menu: Menu
	texture_group: TextureGroup

	extend(data: TextureGroupMaterialConfigData): this
	getUndoCopy(): {}
	getSaveCopy(): {}
	compileForBedrock(): {
		format_version: string
		'minecraft:texture_set': {}
	}
	getFilePath(): string
	getFileName(extension?: boolean): string
	save(): void
	showContextMenu(event: Event): void
	propertiesDialog(): void
}
declare function importTextureSet(file: any): void
