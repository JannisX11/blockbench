/// <reference types="./blockbench"/>
interface AnglePreset {
	position: ArrayVector3
	target?: ArrayVector3
	rotation?: ArrayVector3
	projection: 'unset' | 'orthographic' | 'perspective'
	zoom?: number
	focal_length?: number
	lockedAngle?: number
}

interface PreviewOptions {
	id: string
	antialias?: boolean
}

type RaycastResult = {
	type: 'element' | 'keyframe' | 'vertex' | 'cube' | 'line'
	event: Event
	cube?: Cube
	intersects?: any[]
	face?: string
	vertex?: any
	keyframe?: _Keyframe
	element?: OutlinerElement
}

type SplitScreenMode = 'single'|'double_horizontal'|'double_vertical'|'quad'|'triple_left'|'triple_right'|'triple_top'|'triple_bottom'

/**
 * Previews are 3D viewports, that can either be used as a viewport for the user, or as an offscreen view to record media.
 */
declare class Preview extends Deletable {
	constructor(options: PreviewOptions)

	id: string
	canvas: HTMLCanvasElement
	height: number
	width: number
	node: HTMLElement
	/**
	 * True if the preview is in orthographic camera mode
	 */
	isOrtho: boolean
	/**
	 * Angle, when in a specific side view
	 */
	angle: null | number
	readonly camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
	camPers: THREE.PerspectiveCamera
	camOrtho: THREE.OrthographicCamera
	controls: any
	annotations: any
	renderer: THREE.WebGLRenderer
	background: {
		name: string
		image: any
		size: number
		x: number
		y: number
		lock: boolean
	}
	raycaster: THREE.Raycaster

	mouse: THREE.Vector2

	split_screen: {
		before: undefined | null
		enabled: boolean
		lazyLoadPreview: () => void
		mode: string
		previews: Preview[]
		setMode(mode: string): void
		updateSize(): void
	}

	raycast(event: MouseEvent): false | RaycastResult
	render(): void
	setProjectionMode(orthographic: boolean): this
	setFOV(fov: number): void
	setLockedAngle(angle: number): this

	loadAnglePreset(angle_preset: AnglePreset): this
	/**
	 * Opens a dialog to create and save a new angle preset
	 */
	newAnglePreset(): this

	getFacingDirection(): 'north' | 'south' | 'east' | 'west'
	getFacingHeight(): 'up' | 'middle' | 'down'

	occupyTransformer(): this
	showContextMenu(event: Event | HTMLElement): this
	loadBackground(): void

	/**
	 * List of all previews
	 */
	static all: Preview[]
	/**
	 * The last used preview
	 */
	static selected: Preview

	/**
	 * Utility regarding split screen preview mode
	 */
	static split_screen: {
		/**
		 * Whether the split screen is enabled
		 */
		enabled: boolean
		/**
		 * The current split screen mode
		 */
		mode: SplitScreenMode
		previews: Preview[]
		lazyLoadPreview(index: number, camera_preset): Preview
		/**
		 * Set a split screen mode
		 */
		setMode(mode: SplitScreenMode = 'single')
		/**
		 * Update the size of the split screens
		 */
		updateSize()
	}
}

declare function animate(): void
