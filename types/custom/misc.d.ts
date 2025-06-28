/// <reference path="./blockbench.d.ts"/>

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
	| 'before_closing'
	| 'create_session'
	| 'join_session'
	| 'quit_session'
	| 'send_session_data'
	| 'receive_session_data'
	| 'user_joins_session'
	| 'user_leaves_session'
	| 'process_chat_message'
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

interface MessageBoxOptions {
	/**
	 * Index of the confirm button within the buttons array
	 */
	confirm?: number
	/**
	 * Index of the cancel button within the buttons array
	 */
	cancel?: number
	buttons?: string[]
	translateKey?: string
	title?: string
	message?: string
	icon?: string
	width?: number
	cancelIndex?: number
	confirmIndex?: number
	/**
	 * Display a list of actions to do in the dialog. When clicked, the message box closes with the string ID of the command as first argument.
	 */
	commands?: {
		[id: string]:
			| string
			| {
					text: string
					icon?: IconString
					condition?: ConditionResolvable
					description?: string
			  }
	}
	/**
	 * Adds checkboxes to the bottom of the message box
	 */
	checkboxes?: {
		[id: string]:
			| string
			| {
					value?: boolean
					condition: ConditionResolvable
					text: string
			  }
	}
}

interface PropertyOptions {
	default?: any
	condition?: ConditionResolvable
	exposed?: boolean
	label?: string
	/**
	 * Options used for select types
	 */
	options?: any
	/**
	 * Enum possible values
	 */
	values?: string[]
	merge?(instance: any, data: any): void
	reset?(instance: any): void
	merge_validation?(value: any): boolean
}

interface IPropertyType {
	string: string
	molang: string
	number: number
	boolean: boolean
	array: any[]
	object: any
	instance: any
	vector: ArrayVector3
	vector2: ArrayVector2
}

/**
 * Creates a new property on the specified target class
 */
declare class Property<T extends keyof IPropertyType> extends Deletable {
	constructor(target_class: any, type: T, name: string, options?: PropertyOptions)
	class: any
	name: string
	type: T
	default: IPropertyType[T]
	export?: boolean

	isString: boolean
	isEnum: boolean
	isMolang: boolean
	isNumber: boolean
	isBoolean: boolean
	isArray: boolean
	isVector: boolean
	isVector2: boolean
	isInstance: boolean

	enum_values?: string[]
	merge_validation: undefined | ((value: IPropertyType[T]) => boolean)
	condition: ConditionResolvable
	exposed: boolean
	label: any
	inputs?: any
	merge(instance: IPropertyType[T], data: IPropertyType[T]): void
	reset(instance: IPropertyType[T]): void
	getDefault(instance: IPropertyType[T]): IPropertyType[T]
	copy(instance: IPropertyType[T], target: IPropertyType[T]): void
}

declare function updateSelection(): void

/**
 * Returns a translated string in the current language
 * @param key Translation key
 * @param arguments Array of arguments that replace anchors (%0, etc.) in the translation. Items can be strings or anything that can be converted to strings
 */
declare function tl(key: string, arguments?: any[]): string

declare namespace Language {
	/**
	 * Translation data for the current language
	 */
	const data: {
		[key: string]: string
	}
	/**
	 * Language code indicating the currently selected language
	 */
	const code: string
	/**
	 * Add translations for custom translation strings
	 * @param language Two letter language code, e. G. 'en'
	 * @param strings Object listing the translation keys and values
	 */
	function addTranslations(language: string, strings: { [key: string]: string }): void
}

interface Object {
	boneConfig: Record<string, Property<any> | undefined>
}

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

declare function isStringNumber(value: any): boolean

declare function marked(text: string): string
declare function pureMarked(text: string): string
