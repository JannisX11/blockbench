/// <reference path="./blockbench.d.ts"/>
interface UpdateViewOptions {
	/**
	 * List of elements to update
	 */
	elements?: OutlinerElement[]
	/**
	 * Which aspects of the elements to update
	 */
	element_aspects?: {
		/**
		 * Update visibility of elements
		 */
		visibility?: boolean
		/**
		 * Update the position and geometry
		 */
		geometry?: boolean
		/**
		 * Update the mesh faces
		 */
		faces?: boolean
		/**
		 * Update the UV mapping
		 */
		uv?: boolean
		/**
		 * Update the painting grid
		 */
		painting_grid?: boolean
		/**
		 * Update the transform of elements
		 */
		transform?: boolean
	}
	/**
	 * Groups to update
	 */
	groups?: Group[]
	/**
	 * Whether to update the selection (updates the selection outlines and interface)
	 */
	selection?: boolean
}

/**
 * A global namespace handling miscellaneous functionality related to the 3D preview
 */
declare namespace Canvas {
	const materials: {
		[uuid: UUID]: THREE.Material
	}
	const emptyMaterials: {
		[uuid: UUID]: THREE.Material
	}
	const meshes: {
		[uuid: UUID]: THREE.Mesh
	}
	const bones: {
		[uuid: UUID]: THREE.Object3D
	}
	/**
	 * Main scene, shared across all tabs
	 */
	const scene: THREE.Scene
	/**
	 * List of the gizmos (control and UI elements) in the 3D scene
	 */
	const gizmos: []
	/**
	 * The material used for all selection outlines
	 */
	const outlineMaterial: THREE.LineBasicMaterial
	const meshOutlineMaterial: THREE.LineBasicMaterial
	const onionSkinEarlierMaterial: THREE.LineBasicMaterial
	const onionSkinLaterMaterial: THREE.LineBasicMaterial
	/**
	 * The material used for the wireframe view
	 */
	const wireframeMaterial: THREE.MeshBasicMaterial
	const solidMaterial: THREE.ShaderMaterial
	const normalHelperMaterial: THREE.ShaderMaterial
	const uvHelperMaterial: THREE.ShaderMaterial
	const meshVertexMaterial: THREE.PointsMaterial
	const transparentMaterial: THREE.MeshBasicMaterial
	/**
	 * The material used for the grids
	 */
	const gridMaterial: THREE.LineBasicMaterial

	const pivot_marker: THREE.Object3D

	const global_light_color: THREE.Color
	const global_light_side: number

	const face_order: ['east', 'west', 'up', 'down', 'south', 'north']

	/**
	 * Raycast on the currently selected preview
	 */
	function raycast(event: MouseEvent): any
	/**
	 * Execute the callback function without any gizmos, grids and helpers visible
	 */
	function withoutGizmos(cb: () => void): void
	/**
	 * Clear all elements from the scene
	 */
	function clear(): void
	function buildGrid(): void
	function updateShading(): void
	/**
	 * Updates selected aspects of the preview
	 * @param options
	 */
	function updateView(options: UpdateViewOptions): void
	/**
	 * Regenerate all elements in the scene. Very unoptimized, use with care
	 */
	function updateAll(): void
	/**
	 * Update the position and shape of all elements
	 */
	function updateAllPositions(): void
	/**
	 * Update the visibility of all elements
	 */
	function updateVisibility(): void
	/**
	 * Update all faces in the scene
	 * @param texture Texture filter. If specified, only faces with this texture will be updated
	 */
	function updateAllFaces(texture?: Texture): void
	/**
	 * Update all UV maps in the scene
	 */
	function updateAllUVs(): void
	/**
	 * Returns the three.js render sides based on the current settings and state
	 */
	function getRenderSide(): number
	/**
	 * Update render sides of all materials
	 */
	function updateRenderSides(): void
	/**
	 * Redraw the selected elements in the scene
	 * @param arr Optionally specify an array of elements to update
	 */

	function updateSelected(arr: any): void
	/**
	 * Update positions and shapes of the selected elements
	 */
	function updatePositions(y?: number): void
	/**
	 * Update the faces of all selected elements (material, UV map)
	 */
	function updateSelectedFaces(): void
	/**
	 * Update the UV maps of all selected elements
	 */
	function updateUVs(): void
	/**
	 * Update the hierarchy and position of all bones
	 */
	function updateAllBones(): void
	/**
	 * Update the position of the origin / pivot point gizmo
	 */
	function updateOrigin(): boolean
	/**
	 * Update the position and shape of the specified cube
	 * @param cube Cube to update
	 * @param mesh Mesh instance of the cube
	 */
	function adaptObjectPosition(cube: Cube, mesh?: THREE.Mesh): void
	/**
	 * Update the geometry faces of the specified cube
	 * @param cube Cube to update
	 */
	function adaptObjectFaceGeo(cube: any): void
	/**
	 * Update the faces (material) of the specified cube
	 * @param cube Cube to update
	 * @param mesh Mesh instance of the cube
	 */
	function adaptObjectFaces(cube: any, mesh: any): void
	/**
	 * Update the layered or not layered material of all elements
	 */
	function updateLayeredTextures(): void
	/**
	 * Update the UV map of the specified cube
	 * @param cube Cube to update
	 * @param animation Whether to display the current animated texture frame
	 */
	function updateUV(cube: Cube, animation?: boolean): any
	/**
	 * Update the materials of marker colors if new colors were added
	 */
	function updateMarkerColorMaterials(): void
	/**
	 * Create an additional outline around the specified cubes
	 * @param arr List of cubes to outline
	 */
	function outlineObjects(arr: Cube[]): void
	/**
	 * Calculate the size of the model, in the currently displayed shape. Returns [width, height] in blockbench units
	 */
	function getModelSize(): [number, number]
}

/**
 * Marks a specific aspect of the interface to be updated in the next tick. Useful to avoid an update function getting called multiple times in the same task.
 */
declare namespace TickUpdates {
	let interface: undefined | true
	let outliner: undefined | true
	let selection: undefined | true
	let main_uv: undefined | true
	let texture_list: undefined | true
	let keyframes: undefined | true
	let keyframe_selection: undefined | true
	let keybind_conflicts: undefined | true
}

interface NodePreviewControllerOptions {
	/**
	 * NOTE: This option is just for type checking and should not be set in the options object. It should be set inside of the setup function via `this.mesh`
	 *
	 * ```
	 * setup(element) {
	 *    this.mesh = new THREE.Mesh()
	 * }
	 * ```
	 */
	mesh?: THREE.Object3D | THREE.Mesh
	setup?(element: OutlinerNode): void
	remove?(element: OutlinerNode): void
	updateAll?(element: OutlinerNode): void
	updateTransform?(element: OutlinerNode): void
	updateVisibility?(element: OutlinerNode): void
	updateSelection?(element: OutlinerNode): void
	updateGeometry?(element: OutlinerNode): void
	updateUV?(element: OutlinerNode): void
	updateFaces?(element: OutlinerNode): void
	updatePaintingGrid?(element: OutlinerNode): void
	updateHighlight?(element: OutlinerNode, ...args: any[]): void
}
declare class NodePreviewController {
	constructor(
		type: typeof OutlinerElement | typeof OutlinerNode,
		options: NodePreviewControllerOptions
	)
	type: typeof OutlinerNode
	events: {
		[event_name: string]: ((data: any) => void)[]
	}
	mesh: THREE.Object3D | THREE.Mesh
	dispatchEvent(event_name: string, data: Record<string, any>): void
	/**
	 * Adds an event listener
	 */
	on(event_name: string, cb: (data: any) => void): void
	/**
	 * Adds a single-use event listener
	 */
	once(event_name: string, cb: (data: any) => void): void
	/**
	 * Removes an event listener
	 */
	removeListener(event_name: string, cb: (data: any) => void): void

	setup(element: OutlinerNode): void
	remove(element: OutlinerNode): void
	updateAll(element: OutlinerNode): void
	updateTransform(element: OutlinerNode): void
	updateVisibility(element: OutlinerNode): void
	updateSelection(element: OutlinerNode): void
	updateGeometry(instance: OutlinerNode): void
	updateUV(instance: OutlinerNode): void
	updateFaces(instance: OutlinerNode): void
	updatePaintingGrid(instance: OutlinerNode): void
	updateHighlight(instance: OutlinerNode, ...args: any[]): void
}
