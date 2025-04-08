/// <reference path="./blockbench.d.ts"/>
interface UndoAspects {
	selection?: boolean
	elements?: OutlinerElement[]
	/**
	 * Saves the entire outliner structure and hierarchy, including all groups. This is required when adding, or removing any elements, or changing their position in the outliner.
	 */
	outliner?: boolean
	/**
	 * Save individual groups, but not their children or hierarchy position
	 */
	groups?: Group[]
	/**
	 * Saves an individual group, but not it's children or hierarchy position
	 */
	group?: Group
	collections?: Collection[]
	/**
	 * Textures to save
	 */
	textures?: Texture[]
	texture_order?: boolean
	/**
	 * Save which texture is selected
	 */
	selected_texture?: boolean
	settings?: {}
	uv_mode?: boolean
	animations?: _Animation[]
	animation_controllers?: AnimationController[]
	keyframes?: _Keyframe[]
	display_slots?: string[]
	exploded_view?: boolean
}
interface UndoSelectionAspects {
	texture_selection?: boolean
}
type UndoSave = {
	aspects: UndoAspects
	selection?: []
	selection_group?: UUID
	elements?: {}
	outliner?: []
	group?: {}
	groups?: {}[]
	collections: {}[]
	textures?: {}
	texture_order?: UUID[]
	selected_texture?: UUID | null
	settings?: {}
	uv_mode?: {
		box_uv: boolean
		width: number
		height: number
	}
	animations?: {}
	keyframes?: {}
	display_slots?: {}
	exploded_views?: boolean
	/**
	 * Load the undo save
	 */
	load(reference: UndoSave, mode?: 'session'): void
	/**
	 * Add a texture to an undo edit during the edit
	 */
	addTexture(texture: Texture): void
	/**
	 * Add a texture to an undo edit during the edit
	 */
	addTextureOrLayer(texture: Texture): void
	/**
	 * Add elements to an undo edit during the edit
	 */
	addElements(elements: OutlinerElement[], aspects?: UndoAspects): void
}
type UndoSelectionSave = {
	aspects: UndoSelectionAspects
	elements: string[]
	groups: string[]
	geometry: {
		[uuid: string]: {
			faces: string[]
			edges: string[]
			vertices: string[]
		}
	}
	mode: string
	mesh_selection_mode: string
	texture: string
	texture_selection?: Int8Array | boolean
	animation_item?: string
	timeline?: {}
	graph_editor_channel?: string
	graph_editor_axis?: string
	graph_editor_open?: boolean
	/**
	 * Load the selection save
	 */
	load(): void
	/**
	 * Test whether the selection save matches another selection
	 * @param other Selection save to test against
	 */
	matches(other: UndoSelectionSave): boolean
}
type UndoEntry = {
	before?: UndoSave
	post?: UndoSave
	selection_before?: UndoSelectionSave
	selection_post?: UndoSelectionSave
	action: string
	type: 'original' | 'edit' | 'selection'
	time: number
}

declare class UndoSystem {
	constructor()
	/**
	 * Starts an edit to the current project by saving the state of the provided aspects
	 * @param aspects Aspects to save
	 */
	initEdit(aspects: UndoAspects): UndoEntry
	/**
	 * Finishes an edit by saving the state of the project after it was changed
	 * @param action Description of the edit
	 */
	finishEdit(action: string, aspects?: UndoAspects): UndoEntry
	/**
	 * Cancels an event before it was finished and reset the project to the state before
	 */
	cancelEdit(): void
	/**
	 * Add keyframes to the current edit that were indirectly removed by moving other keyframes to their position
	 * @param keyframes
	 */
	addKeyframeCasualties(keyframes: _Keyframe[]): void
	/**
	 * Undoes the latest edit
	 */
	/**
	 * Starts a selection change in the current project
	 * @param aspects Aspects to save
	 */
	initSelection(aspects?: UndoSelectionAspects): UndoEntry
	/**
	 * Finishes a selection change in the current project
	 * @param action Description of the edit
	 */
	finishSelection(action: string, aspects?: UndoSelectionAspects): UndoEntry
	/**
	 * Cancel the selection changes
	 * @param revert_changes If true, the already tracked selection changes will be reverted to the state before initSelection
	 */
	cancelSelection(revert_changes?: boolean): void
	/**
	 * Cancels an event before it was finished and reset the project to the state before
	 */
	undo(remote?: boolean): void
	/**
	 * Redoes the latest edit
	 */
	redo(remote?: boolean): void
	/**
	 * Provides a menu to amend the latest edit with slightly changed values
	 */
	amendEdit(form: InputFormConfig, callback: (values: any, form: any) => void): void
	/**
	 * Closes the amend edit menu
	 */
	closeAmendEditMenu(): void

	/**
	 * Loads a specific undo save
	 * @param save The undo save to load
	 * @param reference The current undo save for reference
	 * @param mode The load save modes
	 */
	loadSave(save: UndoSave, reference: UndoSave, mode?: 'session'): void

	history: UndoEntry[]
	index: number
}

/**
 * Blockbench's undo system of the current project to register edits to the project and switch between them

## Example

```javascript
Undo.initEdit({elements: []});

let new_cube = new Cube({name: 'kevin'}).init();
let other_cube = new Cube({name: 'lars'}).init();

Undo.finishEdit('Add new cubes', {elements: [new_cube, other_cube]});
```
 */
declare let Undo: UndoSystem
