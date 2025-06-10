/// <reference path="./blockbench.d.ts"/>
interface PreviewModelCubeTemplate {
	position: ArrayVector3
	size: ArrayVector3
	origin?: ArrayVector3
	rotation?: ArrayVector3
	faces: {
		north?: { uv: ArrayVector4 }
		east?: { uv: ArrayVector4 }
		west?: { uv: ArrayVector4 }
		south?: { uv: ArrayVector4 }
		up?: { uv: ArrayVector4 }
		down?: { uv: ArrayVector4 }
	}
}

interface PreviewModelOptions {
	condition?: ConditionResolvable
	cubes: PreviewModelCubeTemplate[]
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
	onUpdate?(): void
}

declare class PreviewModel extends Deletable {
	constructor(id: string, options: PreviewModelOptions)

	static models: {
		(id: string): PreviewModel
	}
	static getActiveModels(): PreviewModel[]

	id: string
	model_3d: THREE.Object3D
	cubes: PreviewModelCubeTemplate[]
	texture?: string
	color?: string
	shading: boolean
	render_side: number
	texture_size: [number, number]
	onUpdate?: () => void
	/**
	 * Enables the model in the preview
	 */
	enable(): void
	/**
	 * Disables the model in the preview
	 */
	disable(): boolean
	/**
	 * Update the appearance and visibility of the model
	 */
	update(): void
	buildModel(): void
}

interface PreviewSceneOptions {
	name?: string
	description?: string
	light_color?: string
	light_side?: number
	condition?: ConditionResolvable
	preview_models?: string[]
}

declare class PreviewScene extends Deletable {
	constructor(id: string, options: PreviewSceneOptions)

	/**
	 * All preview scenes, listed by ID
	 */
	static scenes: Record<string, PreviewScene>
	/**
	 * The currently active scene
	 */
	static active: PreviewScene | null
	/**
	 * The URL to the source repository that scenes are pulled from
	 */
	static source_repository: string
	static menu_categories: {
		[category_id: string]: {
			[id: string]: string
		}
	}

	id: string
	name: string
	description: string
	light_color: string
	light_side: number
	condition?: ConditionResolvable
	preview_models: string[]

	/**
	 * Selects this preview scene
	 */
	select(): void
	/**
	 * Unselects this preview scene
	 */
	unselect(): void
}
