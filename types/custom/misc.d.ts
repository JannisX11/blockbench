/// <reference types="./blockbench"/>

declare class Deletable {
	/**
	 * The ID of the plugin that created the object
	 */
	plugin?: string
	delete(): void
}
type UUID = string

declare global {
	const settings: typeof settings
}

/**
 * True if Blockbench runs as a native app
 */
declare const isApp: boolean

declare const VuePrismEditor: Vue.Component

interface BlockbenchEventMap {
	display_animation_frame: {in_loop: true}
	display_default_pose: {reduced_updates: boolean}
	interpolate_keyframes: {animator: BoneAnimator, t: number, time: number, use_quaternions: boolean, keyframe_before: _Keyframe, keyframe_after: _Keyframe}
	before_closing: any
	create_session: any
	join_session: any
	quit_session: any
	send_session_data: any
	receive_session_data: any
	user_joins_session: any
	user_leaves_session: any
	process_chat_message: any
	loaded_plugin: { plugin: BBPlugin }
	unloaded_plugin: { plugin: BBPlugin }
	installed_plugin: { plugin: BBPlugin }
	uninstalled_plugin: { plugin: BBPlugin }
	update_settings: any
	update_project_settings: Record<string, any>
	save_project: {model: any, options?: any}
	load_project: {model: any, path: string}
	new_project: any
	reset_project: any
	close_project: any
	saved_state_changed: any
	save_model_action: any
	add_cube: any
	add_mesh: any
	add_group: any
	add_texture_mesh: any
	add_armature: any
	add_armature_bone: any
	add_bounding_box: any
	group_elements: any
	update_selection: any
	compile_bedrock_animations: any
	load_animation: any
	load_animation_controller: any
	update_keyframe_selection: any
	select_all: any
	added_to_selection: any
	invert_selection: any
	canvas_select: any
	canvas_click: any
	change_texture_path: {texture: Texture}
	add_texture: {texture: Texture}
	generate_texture_template: any
	update_texture_selection: any
	init_edit: {aspects: UndoAspects, amended: boolean, save: UndoSave}
	finish_edit: {aspects: UndoAspects, message: string}
	finished_edit: {aspects: UndoAspects, message: string} | {remote: true}
	init_selection_change: {aspects: UndoAspects, save: UndoSelectionSave}
	finish_selection_change: {aspects: UndoAspects}
	finished_selection_change: {aspects: UndoAspects}
	cancel_selection_change: {selection_before: UndoSelectionSave}
	undo: { entry: UndoEntry }
	redo: { entry: UndoEntry }
	load_undo_save: {save: UndoSave, reference: UndoSave, mode: undefined | 'session'}
	create_undo_save: {save: UndoSave, aspects: UndoAspects}
	drop_text: { text: string }
	paste_text: { text: string }
	change_color: any
	select_mode: { mode: Mode }
	unselect_mode: { mode: Mode }
	change_active_panel: any
	resize_window: {event?: Event}
	press_key: {input_in_focus?: HTMLElement, event: KeyboardEvent, capture: () => void}
	select_format: {format: ModelFormat, project: ModelProject}
	convert_format: {format: ModelFormat, old_format: ModelFormat}
	construct_format: {format: ModelFormat}
	delete_format: {format: ModelFormat}
	select_project: { project: ModelProject }
	unselect_project: { project: ModelProject }
	setup_project: any
	update_project_resolution: any
	merge_project: any
	display_model_stats: any
	update_view: UpdateViewOptions
	update_camera_position: {preview: Preview}
	render_frame: any
	construct_model_loader: any
	delete_model_loader: any
	update_recent_project_data: any
	update_recent_project_thumbnail: any
	load_from_recent_project_data: any
	edit_animation_properties: {animation: _Animation}
	select_preview_scene: any
	unselect_preview_scene: any
	select_animation: {animation: _Animation}
	remove_animation: {animations: _Animation[]}
	compile_bedrock_animation_controller_state: {state: AnimationControllerState, json: any}
	select_animation_controller_state: {state: AnimationControllerState}
	add_animation_controller_animation: {state: AnimationControllerState}
	add_animation_controller_transition: {state: AnimationControllerState}
	add_animation_controller_particle: {state: AnimationControllerState}
	add_animation_controller_sound: {state: AnimationControllerState}
	compile_bedrock_animation_controller: {state: AnimationController, json: any}
	add_animation_controller: {state: AnimationController}
	edit_animation_controller_properties: {state: AnimationController}
	timeline_play: any
	timeline_pause: any
	unselect_interface: any
	reset_layout: any
	update_pressed_modifier_keys: {
		before: {shift: boolean, alt: boolean, ctrl: boolean}
		now: {shift: boolean, alt: boolean, ctrl: boolean}
		event: KeyboardEvent
	}
	open_bar_menu: {menu: BarMenu}
	unselect_all: any
	get_face_texture: {face: Face, element: OutlinerElement}
	quick_save_model: any
	save_editor_state: any
	load_editor_state: any
	select_no_project: any
	flip_node_name: any
	update_scene_shading: any
	edit_layer_properties: {layer: TextureLayer}
	select_texture: {texture: Texture, event: Event}
	compile_texture_mcmeta: {mcmeta: any}
	register_element_type: any
	edit_collection_properties: any
}

type BlockbenchEventName = keyof BlockbenchEventMap

type IconString = string

declare const osfs: '\\' | '/'

declare function updateSelection(): void

declare var LZUTF8: any

declare function unselectAllElements(exceptions?: OutlinerNode[]): void
declare function updateCubeHighlights(hover_cube: Cube, force_off: boolean): void
declare function getRescalingFactor(angle: number): number
/**
 * Get the world-space center of the selection
 * @param all If true, calculate the center of all elements instead of just selected
 */
declare function getSelectionCenter(all: boolean = false): ArrayVector3

declare const Pressing: {
	shift: boolean
	ctrl: boolean
	alt: boolean
	overrides: {
		shift: boolean
		ctrl: boolean
		alt: boolean
	}
}

type RecentProjectData = {
	name: string
	path: string
	icon: string
	day: number
	favorite: boolean
	textures?: string[]
	animation_files?: string[]
}
declare const recent_projects: RecentProjectData[]

declare const Prop = {
	active_panel: string
}
declare const Project: ModelProject

declare function updateCubeHighlights(hover_cube: Cube, force_off: boolean): void
declare function getRescalingFactor(angle: number): number

declare function isStringNumber(value: any): boolean

declare function marked(text: string): string
declare function pureMarked(text: string): string
