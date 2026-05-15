import { resizeWindow, setZoomLevel } from "./interface";
import { Filesystem } from "../file_system";
import { currentwindow, ipcRenderer } from "../native_apis";
import { BARS } from './toolbars'


BARS.defineActions(() => {

	new KeybindItem('preview_select', {
		category: 'navigate',
		keybind: new Keybind({key: Blockbench.isTouch ? 0 : 1},
			{multi_select: 'ctrl', group_select: 'shift', loop_select: 'alt'}
		),
		variations: {
			multi_select: {name: 'keybind.preview_select.multi_select'},
			group_select: {name: 'keybind.preview_select.group_select'},
			loop_select: {name: 'keybind.preview_select.loop_select'},
		}
	})
	new KeybindItem('preview_rotate', {
		category: 'navigate',
		keybind: new Keybind({key: 1})
	})
	new KeybindItem('preview_drag', {
		category: 'navigate',
		keybind: new Keybind({key: 3})
	})
	new KeybindItem('preview_zoom', {
		category: 'navigate',
		keybind: new Keybind({key: 1, shift: true})
	})
	new KeybindItem('preview_scroll_zoom', {
		category: 'navigate',
		keybind: new Keybind({key: 1001})
	})
	new KeybindItem('uv_editor_scroll_zoom', {
		category: 'navigate',
		keybind: new Keybind({key: 1001, ctrl: true})
	})
	new KeybindItem('preview_area_select', {
		category: 'navigate',
		keybind: new Keybind({key: 1, ctrl: true, shift: null})
	})

	new KeybindItem('confirm', {
		category: 'navigate',
		keybind: new Keybind({key: 13})
	})
	new KeybindItem('cancel', {
		category: 'navigate',
		keybind: new Keybind({key: 27})
	})

//Tools
	new Tool('move_tool', {
		icon: 'icon-gizmo',
		category: 'tools',
		selectFace: true,
		transformerMode: 'translate',
		animation_channel: 'position',
		toolbar: 'main_tools',
		transform_toolbar: 'element_position',
		alt_tool: 'resize_tool',
		modes: ['edit', 'display', 'animate', 'pose'],
		keybind: new Keybind({key: 'v'}),
	})
	new Tool('resize_tool', {
		icon: 'open_with',
		category: 'tools',
		selectFace: true,
		transformerMode: 'scale',
		animation_channel: 'scale',
		toolbar: 'main_tools',
		transform_toolbar: 'element_size',
		alt_tool: 'move_tool',
		modes: ['edit', 'display', 'animate'],
		keybind: new Keybind({key: 's'}),
		onSelect() {
			if (Modes.edit) {
				if (Mesh.selected.length) {
					Interface.addSuggestedModifierKey('alt', 'modifier_actions.resize_one_side');
				} else {
					Interface.addSuggestedModifierKey('alt', 'modifier_actions.resize_both_sides');
				}
			}
		},
		onUnselect() {
			Interface.removeSuggestedModifierKey('alt', 'modifier_actions.resize_one_side');
			Interface.removeSuggestedModifierKey('alt', 'modifier_actions.resize_both_sides');
		}
	})
	new Tool('rotate_tool', {
		icon: 'sync',
		category: 'tools',
		selectFace: true,
		transformerMode: 'rotate',
		animation_channel: 'rotation',
		toolbar: 'main_tools',
		transform_toolbar: 'element_rotation',
		alt_tool: 'pivot_tool',
		modes: ['edit', 'display', 'animate', 'pose'],
		keybind: new Keybind({key: 'r'}),
	})
	new Tool('pivot_tool', {
		icon: 'gps_fixed',
		category: 'tools',
		selectFace: true,
		transformerMode: 'translate',
		toolbar: 'main_tools',
		transform_toolbar: 'element_origin',
		alt_tool: 'rotate_tool',
		modes: ['edit', 'animate'],
		keybind: new Keybind({key: 'p'}),
	})
	new Tool('vertex_snap_tool', {
		icon: 'icon-vertexsnap',
		transformerMode: 'hidden',
		toolbar: 'vertex_snap',
		category: 'tools',
		selectElements: true,
		cursor: 'copy',
		modes: ['edit'],
		condition: {modes: ['edit']},
		keybind: new Keybind({key: 'x'}),
		onCanvasClick(data) {
			Vertexsnap.canvasClick(data)
		},
		onSelect: function() {
			Blockbench.addListener('update_selection', Vertexsnap.select)
			Vertexsnap.select()
		},
		onUnselect: function() {
			Vertexsnap.clearVertexGizmos()
			Vertexsnap.step1 = true
			Blockbench.removeListener('update_selection', Vertexsnap.select)
		}
	})
	new Tool('stretch_tool', {
		icon: 'expand',
		category: 'tools',
		condition: {features: ['stretch_cubes'], modes: ['edit']},
		selectFace: true,
		transformerMode: 'stretch',
		toolbar: 'main_tools',
		transform_toolbar: 'element_stretch',
		alt_tool: 'resize_tool',
		modes: ['edit'],
		keybind: new Keybind({key: 's', alt: true}),
	})

	let swap_tools = new Action('swap_tools', {
		icon: 'swap_horiz',
		category: 'tools',
		condition: {modes: ['edit', 'paint', 'display'], project: true},
		keybind: new Keybind({key: 32}),
		click: function () {
			let alt_tool = BarItems[Toolbox.selected.alt_tool];
			if (alt_tool instanceof Tool && Condition(alt_tool.condition)) {
				alt_tool.select();
			}
		}
	})
	swap_tools.addSubKeybind('hold', 'action.swap_tools.hold', new Keybind({key: 18}), () => {});
	
	new Action('set_element_marker_color', {
		name: 'menu.cube.color',
		icon: 'color_lens',
		condition: () => Outliner.selected.some(el => el.getTypeBehavior('marker_color')) || Group.selected.length > 0,
		click(e) {
			new Menu('set_element_marker_color', this.children()).open(e.target as HTMLElement);
		},
		children() {
			return markerColors.map((color, i) => {return {
				icon: 'bubble_chart',
				color: color.standard,
				name: color.name || 'cube.color.'+color.id,
				click() {
					let elements = Outliner.selected.filter(el => el.getTypeBehavior('marker_color'))
					let groups = Group.all.filter(g => g.selected);
					Undo.initEdit({elements, groups})
					let nodes = (elements as OutlinerNode[]).concat(groups);
					nodes.forEach(el => {
						if ('setColor' in el) {
							// @ts-expect-error
							el.setColor(i);
						}
					})
					Undo.finishEdit('Set marker color');
				}
			}});
		}
	})
	new Action('randomize_marker_colors', {
		icon: 'fa-shuffle',
		category: 'edit',
		condition: {modes: ['edit' ], project: true},
		click: function() {
			let randomColor = function() { return Math.floor(Math.random() * markerColors.length)}
			let elements = Outliner.selected.filter(element => element.getTypeBehavior('marker_color'))
			Undo.initEdit({outliner: true, elements: elements, selection: true, groups: Group.all.filter(g => g.selected)})
			Group.all.forEach(group => {
				if (group.selected) {
					let lastColor = group.color
					// Ensure chosen group color is never the same as before
					do group.color = randomColor();
					while (group.color === lastColor)
				}
			})
			elements.forEach(element => {
				if ('color' in element == false) return;
				let lastColor = element.color
				// Ensure chosen element color is never the same as before
				// @ts-expect-error
				do element.setColor(randomColor())
				while (element.color === lastColor)
			})
			Undo.finishEdit('Change marker color')
		}
	})

//File
	new Action('new_window', {
		icon: 'open_in_new',
		category: 'file',
		condition: isApp,
		click: function () {
			ipcRenderer.send('new-window');
		}
	})
	new Action('open_model_folder', {
		icon: 'folder_open',
		category: 'file',
		condition: () => {return isApp && !!(Project.save_path || Project.export_path)},
		click: function () {
			Filesystem.showFileInFolder(Project.export_path || Project.save_path);
		}
	})
	new Action('reload', {
		icon: 'refresh',
		category: 'file',
		condition: isApp,
		click: function () {
			if (Blockbench.hasFlag('dev') || confirm(tl('message.close_warning.web'))) {
				Blockbench.reload()
			}
		}
	})


//Settings
	new Action('open_dev_tools', {
		name: 'menu.help.developer.dev_tools',
		icon: 'fas.fa-tools',
		condition: isApp,
		work_in_dialog: true,
		keybind: new Keybind({ctrl: true, shift: true, key: 'i'}),
		click: () => {
			currentwindow.webContents.toggleDevTools();
		}
	})
	

//View
	new Action('fullscreen', {
		icon: 'fullscreen',
		category: 'view',
		condition: isApp,
		work_in_dialog: true,
		keybind: new Keybind({key: 122}),
		click: function () {
			currentwindow.setFullScreen(!currentwindow.isFullScreen())
		}
	})
	new Action('zoom_in', {
		icon: 'zoom_in',
		category: 'view',
		work_in_dialog: true,
		click: function () {setZoomLevel('in')}
	})
	new Action('zoom_out', {
		icon: 'zoom_out',
		category: 'view',
		work_in_dialog: true,
		click: function () {setZoomLevel('out')}
	})
	new Action('zoom_reset', {
		icon: 'zoom_out_map',
		category: 'view',
		work_in_dialog: true,
		click: function () {setZoomLevel('reset')}
	})
	new Action('toggle_sidebars', {
		icon: 'view_array',
		category: 'view',
		condition: () => !Blockbench.isMobile && Mode.selected && !Mode.selected.hide_sidebars,
		keybind: new Keybind({key: 'b', ctrl: true}),
		click: function () {
			let status = !Prop.show_left_bar;
			Prop.show_left_bar = status;
			Prop.show_right_bar = status;
			resizeWindow();
		}
	})
});


declare global {
	interface BarItemRegistry {
		move_tool: Tool
		resize_tool: Tool
		rotate_tool: Tool
		pivot_tool: Tool
		vertex_snap_tool: Tool
		stretch_tool: Tool
		swap_tools: Action
		set_element_marker_color: Action
		randomize_marker_colors: Action
		new_window: Action
		open_model_folder: Action
		reload: Action
		open_dev_tools: Action
		fullscreen: Action
		zoom_in: Action
		zoom_out: Action
		zoom_reset: Action
		toggle_sidebars: Action
	}
}