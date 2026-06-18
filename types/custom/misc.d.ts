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
	before_closing: {}
	create_session: {peer: Peer, token: string}
	join_session: {conn: DataConnection}
	quit_session: {}
	send_session_data: {type: string, data: any}
	receive_session_data: {type: string, data: any}
	user_joins_session: EditSession.Client
	user_leaves_session: EditSession.Client
	process_chat_message: {text: string, color: string}
	loaded_plugin: { plugin: BBPlugin }
	unloaded_plugin: { plugin: BBPlugin }
	installed_plugin: { plugin: BBPlugin }
	uninstalled_plugin: { plugin: BBPlugin }
	update_settings: {}
	update_project_settings: Record<string, any>
	save_project: {model: any, options?: any}
	load_project: {model: any, path: string}
	new_project: {project: ModelProject}
	close_project: {project: ModelProject, on_quit?: boolean}
	saved_state_changed: {project: ModelProject, saved: boolean}
	add_cube: {object: Cube}
	add_mesh: {object: Mesh}
	add_group: {object: Group}
	add_texture_mesh: {object: TextureMesh}
	add_armature: {object: Armature}
	add_armature_bone: {object: ArmatureBone}
	add_bounding_box: {object: BoundingBox}
	group_elements: {object: Group}
	update_selection: void
	compile_bedrock_animation: {animation: Animation, json: any}
	load_animation: {animation: Animation, json: any}
	load_animation_controller: {animation_controller: AnimationController, json: any}
	update_keyframe_selection: void
	select_all: {}
	added_to_selection: {added: OutlinerElement[]}
	invert_selection: {}
	change_texture_path: {texture: Texture}
	add_texture: {texture: Texture}
	generate_texture_template: {
		options: Record<string, any>
		elements: OutlinerElement[]
		texture: Texture
		resolution_multiplier: number
		data: {face_list: any, box_uv_templates: any}
	}
	update_texture_selection: void
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
	change_color: {color: string, secondary?: boolean}
	select_mode: { mode: Mode }
	unselect_mode: { mode: Mode }
	change_active_panel: {last_panel: Panel, panel: Panel}
	resize_window: {event?: Event}
	change_view_mode: {view_mode: string, previous_view_mode: string}
	press_key: {input_in_focus?: HTMLElement, event: KeyboardEvent, capture: () => void}
	select_format: {format: ModelFormat, project: ModelProject}
	convert_format: {format: ModelFormat, old_format: ModelFormat}
	construct_format: {format: ModelFormat}
	delete_format: {format: ModelFormat}
	select_project: { project: ModelProject }
	unselect_project: { project: ModelProject }
	setup_project: {project: ModelProject}
	update_project_resolution: {project: ModelProject}
	merge_project: {model: any, path: string}
	display_model_stats: {stats: {label: string, value: number | string}[]}
	update_view: UpdateViewOptions
	update_camera_position: {preview: Preview}
	render_frame: {}
	construct_model_loader: {loader: ModelLoader}
	delete_model_loader: {loader: ModelLoader}
	update_recent_project_data: {data: RecentProjectData}
	update_recent_project_thumbnail: {data: RecentProjectData, thumbnail: string}
	load_from_recent_project_data: {data: RecentProjectData}
	edit_animation_properties: {animation: _Animation}
	select_preview_scene: {scene: PreviewScene}
	unselect_preview_scene: {scene: PreviewScene}
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
	timeline_play: {}
	timeline_pause: {}
	unselect_interface: {event: Event}
	reset_layout: {}
	update_pressed_modifier_keys: {
		before: {shift: boolean, alt: boolean, ctrl: boolean}
		now: {shift: boolean, alt: boolean, ctrl: boolean}
		event: KeyboardEvent
	}
	open_bar_menu: {menu: BarMenu}
	unselect_all: {}
	get_face_texture: {face: Face, element: OutlinerElement}
	quick_save_model: {}
	save_editor_state: { project: ModelProject }
	load_editor_state: { project: ModelProject }
	select_no_project: {}
	flip_node_name: {pairs: Record<string, string>, node: OutlinerNode, axis: axisNumber, original_name?: string}
	update_scene_shading: any
	edit_layer_properties: {layer: TextureLayer}
	select_texture: {texture: Texture, event: Event}
	compile_texture_mcmeta: {mcmeta: any}
	register_element_type: {id: string, constructor: any}
	edit_collection_properties: {collection: Collection}
}

type BlockbenchEventName = keyof BlockbenchEventMap

type IconString = string | HTMLElement

declare const osfs: '\\' | '/'

declare function updateSelection(): void

declare var LZUTF8: any

declare function unselectAllElements(exceptions?: OutlinerNode[]): void
declare function getRescalingFactor(angle: number): number
/**
 * Get the world-space center of the selection
 * @param all If true, calculate the center of all elements instead of just selected
 */
declare function getSelectionCenter(all: boolean = false): ArrayVector3
declare function getSpatialInterval(event?: Event): number;
declare function getRotationInterval(event?: Event): number;

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

declare const Prop = {
	active_panel: string,
	fps: number,
	show_left_bar: boolean,
	show_right_bar: boolean,
}
declare const Project: ModelProject

declare function isStringNumber(value: any): boolean

declare function marked(text: string): string
declare function pureMarked(text: string): string

declare type SplineMesh = typeof OutlinerElement & Record<string, any>
declare const SplineMesh: typeof OutlinerElement
