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

type EventName =
	| 'remove_animation'
	| 'display_animation_frame'
	| 'display_default_pose'
	| 'interpolate_keyframes'
	| 'before_closing'
	| 'create_session'
	| 'join_session'
	| 'quit_session'
	| 'send_session_data'
	| 'receive_session_data'
	| 'user_joins_session'
	| 'user_leaves_session'
	| 'process_chat_message'
	| 'loaded_plugin'
	| 'unloaded_plugin'
	| 'update_settings'
	| 'update_project_settings'
	| 'save_project'
	| 'load_project'
	| 'new_project'
	| 'reset_project'
	| 'close_project'
	| 'saved_state_changed'
	| 'save_model_action'
	| 'add_cube'
	| 'add_mesh'
	| 'add_group'
	| 'add_texture_mesh'
	| 'add_armature'
	| 'add_armature_bone'
	| 'group_elements'
	| 'update_selection'
	| 'compile_bedrock_animations'
	| 'load_animation'
	| 'load_animation_controller'
	| 'update_keyframe_selection'
	| 'select_all'
	| 'added_to_selection'
	| 'invert_selection'
	| 'canvas_select'
	| 'canvas_click'
	| 'change_texture_path'
	| 'add_texture'
	| 'generate_texture_template'
	| 'update_texture_selection'
	| 'init_edit'
	| 'finish_edit'
	| 'finished_edit'
	| 'undo'
	| 'redo'
	| 'load_undo_save'
	| 'create_undo_save'
	| 'change_color'
	| 'select_mode'
	| 'unselect_mode'
	| 'change_active_panel'
	| 'resize_window'
	| 'press_key'
	| 'select_format'
	| 'convert_format'
	| 'construct_format'
	| 'delete_format'
	| 'select_project'
	| 'unselect_project'
	| 'setup_project'
	| 'update_project_resolution'
	| 'merge_project'
	| 'display_model_stats'
	| 'update_view'
	| 'update_camera_position'
	| 'render_frame'
	| 'construct_model_loader'
	| 'delete_model_loader'
	| 'update_recent_project_data'
	| 'update_recent_project_thumbnail'
	| 'load_from_recent_project_data'
	| 'edit_animation_properties'
	| 'select_preview_scene'
	| 'unselect_preview_scene'
	| 'compile_bedrock_animation_controller_state'
	| 'select_animation_controller_state'
	| 'add_animation_controller_animation'
	| 'add_animation_controller_transition'
	| 'add_animation_controller_particle'
	| 'add_animation_controller_sound'
	| 'compile_bedrock_animation_controller'
	| 'add_animation_controller'
	| 'edit_animation_controller_properties'
	| 'timeline_play'
	| 'timeline_pause'
	| 'unselect_interface'
	| 'reset_layout'
	| 'update_pressed_modifier_keys'
	| 'open_bar_menu'
	| 'unselect_all'
	| 'quick_save_model'
	| 'save_editor_state'
	| 'load_editor_state'
	| 'select_no_project'
	| 'flip_node_name'
	| 'update_scene_shading'
	| 'edit_layer_properties'
	| 'select_texture'
	| 'compile_texture_mcmeta'
	| 'register_element_type'
	| 'edit_collection_properties'

type IconString = string

declare const osfs: '\\' | '/';

declare function updateSelection(): void

declare var LZUTF8: any

declare function unselectAllElements(): void
declare function updateCubeHighlights(hover_cube: Cube, force_off: boolean): void
declare function getRescalingFactor(angle: number): number

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

declare function updateCubeHighlights(hover_cube: Cube, force_off: boolean): void
declare function getRescalingFactor(angle: number): number

declare function isStringNumber(value: any): boolean

declare function marked(text: string): string
declare function pureMarked(text: string): string
