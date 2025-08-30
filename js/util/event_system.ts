type Deletable = {
	delete(): void
}

export interface BlockbenchEventMap {
	add_animation_controller
	add_animation_controller_animation
	add_animation_controller_particle
	add_animation_controller_sound
	add_animation_controller_transition
	add_cube
	add_group
	add_mesh
	add_texture
	add_texture_mesh
	added_to_selection
	before_closing
	canvas_click
	canvas_select
	change_active_panel
	change_color
	change_texture_path
	close_project
	compile_bedrock_animation_controller
	compile_bedrock_animation_controller_state
	compile_bedrock_animations
	compile_texture_mcmeta
	construct_format
	construct_model_loader
	convert_format
	create_session
	create_undo_save
	delete_format
	delete_model_loader
	display_animation_frame
	edit_animation_controller_properties
	edit_animation_properties
	edit_layer_properties
	finish_edit
	finished_edit
	flip_node_name
	group_elements
	init_edit
	invert_selection
	join_session
	load_animation
	load_animation_controller
	load_editor_state
	load_from_recent_project_data
	load_project
	load_undo_save
	merge_project
	new_project
	open_bar_menu
	press_key
	process_chat_message
	quick_save_model
	quit_session
	receive_session_data
	redo
	remove_animation
	render_frame
	reset_layout
	reset_project
	resize_window
	save_editor_state
	save_model_action
	save_project
	saved_state_changed
	select_all
	select_animation_controller_state
	select_format
	select_mode
	select_no_project
	select_preview_scene
	select_project
	select_texture
	send_session_data
	setup_project
	timeline_pause
	timeline_play
	undo
	unselect_all
	unselect_interface
	unselect_mode
	unselect_preview_scene
	unselect_project
	update_camera_position
	update_keyframe_selection
	update_pressed_modifier_keys
	update_project_resolution
	update_project_settings
	update_recent_project_data
	update_recent_project_thumbnail
	update_scene_shading
	update_selection
	update_settings
	update_texture_selection
	update_view
	user_joins_session
	user_leaves_session
}

type Split<S extends string, D extends string> = string extends S
	? string[]
	: S extends ''
	? []
	: S extends `${infer T}${D}${infer U}`
	? [T, ...Split<U, D>]
	: [S]

type IsKnownEventName<
	EventMap extends Record<string, any>,
	T = Extract<keyof EventMap, string>
> = T extends keyof EventMap ? T : never

type ExtractKnownEventNames<EventMap extends Record<string, any>, T extends string> = Split<
	T,
	' '
> extends (infer U)[]
	? U extends string
		? IsKnownEventName<EventMap, U>
		: never
	: never

export interface GenericEventListener<
	EventMap extends Record<string, any>,
	EventName extends Extract<keyof EventMap, string> = Extract<keyof EventMap, string>
> {
	(event: EventMap[EventName]): void
}

function callbackIsFunction(cb: unknown): cb is Function {
	if (typeof cb !== 'function') {
		console.warn(cb, 'is not a function!')
		return false
	}
	return true
}

export type BlockbenchEventNames = keyof BlockbenchEventMap

export class EventSystem<
	EventMap extends Record<string, any>,
	EventNames extends string = Extract<keyof EventMap, string>,
	ListenerType = GenericEventListener<EventMap, ExtractKnownEventNames<EventMap, EventNames>>
> {
	events = {} as Record<EventNames, EventListener[]>

	dispatchEvent(eventName: EventNames, data: EventMap[typeof eventName]) {
		const list = this.events[eventName]
		if (!list) return
		for (var i = 0; i < list.length; i++) {
			list[i](data)
		}
	}

	on(
		eventName: EventNames,
		cb: ListenerType
	): Deletable {
		if (!callbackIsFunction(cb)) return
		const eventNames = eventName.split(' ') as EventNames[]
		for (const name of eventNames) {
			this.events[name] ??= []
			this.events[name].safePush(cb)
		}
		return {
			delete: () => {
				for (let name of eventNames) {
					this.events[name].remove(cb)
				}
			},
		}
	}

	once(
		event_name: EventNames,
		cb: ListenerType
	): Deletable {
		if (!callbackIsFunction(cb)) return
		const listener = (data => {
			this.removeListener(event_name, listener)
			cb(data)
		}) as ListenerType
		return this.on(event_name, listener)
	}

	addListener(
		eventName: EventNames,
		cb: ListenerType
	) {
		return this.on(eventName, cb)
	}

	removeListener(
		eventName: EventNames,
		cb: ListenerType
	) {
		const eventNames = eventName.split(' ') as EventNames[]
		for (const name of eventNames) {
			this.events[name]?.remove(cb)
		}
	}
}
