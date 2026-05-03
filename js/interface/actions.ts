import MolangParser from "molangjs";
import { isMac, Keybinds } from "./keyboard";
import tinycolor from "tinycolor2";

type ActionEventName =
	| 'delete'
	| 'use'
	| 'used'
	| 'trigger'
	| 'get_node'
	| 'select'
	| 'change'
	| 'changed'
	| 'update'
	| 'open'
	| 'modify_color'

export const BarItems: Record<string, BarItem> = {};

//Bars
type SubKeybind = {
	name: string
	keybind?: Keybind
	default_keybind?: Keybind
	trigger: (event: Event) => void
}
export interface KeybindItemOptions {
	name?: string
	description?: string
	category?: string
	keybind?: Keybind
	variations?: {
		[key: string]: { name: string; description?: string }
	}
}
export interface BarItemOptions extends KeybindItemOptions {
	name?: string
	description?: string
	icon?: IconString | (() => IconString)
	color?: string
	condition?: ConditionResolvable
	category?: string
	keybind?: Keybind
	/**
	 * If set to true, the item can only be used in private context and does not appear in keybindings, action control, or toolbar customization
	 */
	private?: true
	/**
	 * The plugin that this was added by
	 */
	plugin?: string
	work_in_dialog?: boolean
	variations?: {
		[key: string]: {
			name: string,
			description?: string,
		}
	}
}
/**
 * BarItem, the base abstract class for anything that can be added to a toolbar
 * @module Actions
 */
export abstract class BarItem extends EventSystem {
	static constructing: BarItem | undefined;

	id: string
	name: string
	description: string
	icon?: IconString | (() => IconString)
	category?: string
	color?: string
	condition: ConditionResolvable

	type: string
	node: HTMLElement
	nodes: HTMLElement[]
	uniqueNode?: boolean
	toolbars: Toolbar[]
	keybind: Keybind
	default_keybind?: Keybind
	/**
	 * The plugin that this was added by
	 */
	plugin?: string
	/**
	 * @private How often the action was used
	 */
	uses?: number
	work_in_dialog?: boolean
	variations?: BarItemOptions['variations']

	/**
	 * Anything that can go into a toolbar, including actions, tools, toggles, widgets etc.
	 */
	constructor(id: string, data: BarItemOptions) {
		super();
		BarItem.constructing = this;
		this.id = id;
		if (!data.private) {
			if (this.id && !BarItems[this.id]) {
				BarItems[this.id] = this;
			} else {
				if (BarItems[this.id]) {
					console.warn(`${this.constructor.name} ${this.id} has a duplicate ID`)
				} else {
					console.warn(`${this.constructor.name} defined without a vaild ID`)
				}
			}
		}
		this.name = tl(data.name ?? 'action.'+this.id);
		this.description = tl(data.description ?? 'action.'+this.id+'.desc', [], '');
		this.color = data.color
		this.node;
		this.condition = data.condition;
		this.nodes = []
		this.toolbars = []
		this.plugin = data.plugin || (typeof Plugins != 'undefined' ? Plugins.currently_loading : '');
		//Key
		this.category = data.category ? data.category : 'misc'
		if (!data.private && this.condition !== false/*Rule out app/web only actions*/) {
			if (data.keybind) {
				this.default_keybind = data.keybind
			}
			this.keybind = new Keybind(null, this.default_keybind?.variations);
			if (Keybinds.stored[this.id]) {
				this.keybind.set(Keybinds.stored[this.id], this.default_keybind);
			} else {
				this.keybind.set(data.keybind);
			}
			this.variations = data.variations;
			this.keybind.setAction(this.id)
			this.work_in_dialog = data.work_in_dialog === true
			this.uses = 0;
			Keybinds.actions.push(this);
		}
	}
	conditionMet(): boolean {
		return Condition(this.condition)
	}
	/**
	 * Adds a label to the HTML element of the bar item
	 * @param in_bar Set to true to generate an in-bar label, as opposed to a regular on-hover label
	 * @param action Provide the action to generate the label. This defaults to self and is only needed in special cases
	 */
	addLabel(in_bar?: boolean, action?: any): void {
		if (!action || this instanceof BarItem) {
			action = this;
		}

		if (in_bar) {
			let label = document.createElement('label');
			label.classList.add('f_left', 'toolbar_label')
			label.innerText = action.name;
			this.node.classList.add('has_label')
			this.node.prepend(label)
		} else {
			let tooltip = document.createElement('div');
			tooltip.className = 'tooltip';
			tooltip.innerText = action.name;
			
			let label = document.createElement('label');
			label.className = 'keybinding_label';
			label.innerText = action.keybind || '';
			tooltip.append(label);

			let description;
			if (action.description) {
				description = document.createElement('div');
				description.className = 'tooltip_description';
				description.innerText = action.description;
				tooltip.append(description);
			}

			action.node.prepend(tooltip);

			addEventListeners(action.node, 'mouseenter touchstart', () => {
				let j_tooltip = $(tooltip);
				let j_description = description && $(description);
				if ($(action.node).parent().parent().hasClass('vertical')) {
					j_tooltip.css('margin', '0')
					if ($(action.node).offset().left > window.innerWidth/2) {
						j_tooltip.css('margin-left', (-j_tooltip.width()-3) + 'px')
					} else {
						j_tooltip.css('margin-left', '34px')
					}
				} else {

					j_tooltip.css('margin-left', '0')
					var offset = j_tooltip && j_tooltip.offset()
					let right_offset = offset.left + parseInt(j_tooltip.css('width').replace(/px/, '')) - window.innerWidth

					if (right_offset > 4) {
						j_tooltip.css('margin-left', -right_offset+'px')
					}				

					// description
					if (!j_description) return;

					j_description.css('margin-left', '-5px')
					var offset = j_description.offset()
					right_offset = offset.left + parseInt(j_description.css('width').replace(/px/, '')) - window.innerWidth

					if (right_offset > 4) {
						j_description.css('margin-left', -right_offset+'px')
					}

					// height
					if ((window.innerHeight - offset.top) < 28) {
						j_tooltip.css('margin-top', -2-j_tooltip.height()+'px');
						j_description.css('margin-top', '-51px');
					}
				}
			}, {passive: true})
			action.node.addEventListener('touchstart', () => {
				tooltip.style.display = 'none';
				let show_tooltip = setTimeout(() => {
					tooltip.style.display = 'block';
					setTimeout(() => {
						tooltip.style.display = 'none';
					}, 1200)
				}, 500)
				let stop = e => {
					clearInterval(show_tooltip);
					document.removeEventListener('touchend', stop);
				};
				document.addEventListener('touchend', stop);
			}, {passive: true})
		}
	}
	/**
	 * Gets a copy of the elements HTML node that is not yet in use.
	 */
	getNode(ignore_disconnected?: boolean): HTMLElement {
		if (this.nodes.length === 0) {
			this.nodes = [this.node]
		}
		for (let node of this.nodes) {
			if (!node.isConnected && !ignore_disconnected) {
				$(node).detach();
				return node;
			}
		}
		var clone = $(this.node).clone(true, true).get(0);
		clone.onclick = (e) => {
			// @ts-expect-error
			this.trigger(e)
		}
		this.nodes.push(clone);
		return clone;
	}
	/**
	 * Appends the bar item to a HTML element
	 */
	toElement(destination: HTMLElement | string): this {
		// @ts-expect-error
		$(destination).first().append(this.getNode())
		return this;
	}
	pushToolbar(bar: Toolbar, index?: number): void {
		if (this.uniqueNode && this.toolbars.length) {
			for (var i = this.toolbars.length-1; i >= 0; i--) {
				this.toolbars[i].remove(this, false);
			}
		}
		if (index !== undefined) {
			bar.children.splice(index, 0, this);
		} else {
			bar.children.push(this);
		}
		this.toolbars.safePush(bar)
	}
	sub_keybinds?: Record<string, SubKeybind>
	addSubKeybind(id: string, name: string, default_keybind: Keybind, trigger) {
		if (!this.sub_keybinds) this.sub_keybinds = {};
		this.sub_keybinds[id] = {
			name: tl(name, null, name),
			trigger
		};

		if (default_keybind) {
			this.sub_keybinds[id].default_keybind = default_keybind
		}
		if (Keybinds.stored[this.id + '.' + id]) {
			this.sub_keybinds[id].keybind = new Keybind().set(Keybinds.stored[this.id + '.' + id], default_keybind);
		} else {
			this.sub_keybinds[id].keybind = new Keybind().set(default_keybind);
		}
		this.sub_keybinds[id].keybind.setAction(this.id, id);
	}
	delete() {
		this.dispatchEvent('delete', {});
		this.toolbars.forEach(bar => {
			bar.remove(this);
		})
		delete BarItems[this.id];
		Keybinds.actions.remove(this);
		for (let key in Keybinds.structure) {
			if (Keybinds.structure[key]?.actions?.length) {
				Keybinds.structure[key].actions.remove(this);
			}
		}
	}
}
export class KeybindItem {
	id: string
	type: string
	name: string
	description: string
	category?: string
	keybind: Keybind
	default_keybind?: Keybind
	condition?: ConditionResolvable
	variations?: {
		[key: string]: { name: string; description?: string }
	}
	constructor(id: string, data: KeybindItemOptions & {id: string}) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		this.id = id
		this.type = 'keybind_item'
		this.name =  tl(data.name || ('keybind.'+this.id))
		this.description = tl(data.description ?? 'action.'+this.id+'.desc', [], '');
		this.category = data.category ? data.category : 'misc'
		if (data.keybind) {
			this.default_keybind = data.keybind
		}
		let a = this.default_keybind?.variations
		if (Keybinds.stored[this.id]) {
			this.keybind = new Keybind(null, this.default_keybind?.variations).set(Keybinds.stored[this.id], this.default_keybind);
		} else {
			this.keybind = new Keybind(null, this.default_keybind?.variations).set(data.keybind);
		}
		this.variations = data.variations;

		Keybinds.actions.push(this)
		Keybinds.extra[this.id] = this;
		this.keybind.setAction(this.id)
	}
	delete() {
		Keybinds.actions.remove(this);
		for (let key in Keybinds.structure) {
			if (Keybinds.structure[key]?.actions?.length) {
				Keybinds.structure[key].actions.remove(this);
			}
		}
	}
}



export interface ActionOptions extends BarItemOptions {
	/**
	 * Function to run when user uses the action successfully
	 */
	click?: (event?: Event) => void
	/**
	 * Icon color. Can be a CSS color string, or an axis letter to use an axis color.
	 */
	color?: string
	children?: MenuItem[] | ((context: any) => MenuItem[])
	searchable?: boolean
	/**
	 * Show the full label in toolbars
	 */
	label?: boolean
	/**
	 * Provide a menu that belongs to the action, and gets displayed as a small arrow next to it in toolbars.
	 */
	side_menu?: Menu | ToolConfig | Dialog
	/**
	 * Provide a window with additional configutation related to the action
	 */
	tool_config?: ToolConfig
}
export interface ActionSpecificOptions extends ActionOptions {
	click:(event?: Event) => void
}
/**
 * Actions can be triggered to run something, they can be added to menus, toolbars, assigned a keybinding, or run via Action Control
 */
export class Action extends BarItem {
	
	menu_node: HTMLElement
	icon_node: HTMLElement
	/**
	 * Provide a menu that belongs to the action, and gets displayed as a small arrow next to it in toolbars.
	 */
	side_menu?: ActionOptions['side_menu']
	menus: {menu: Menu, path: string}[]
	/**
	 * Provide a window with additional configutation related to the action
	 */
	tool_config?: ToolConfig
	onClick: any

	children?: ActionOptions['children']
	searchable?: boolean

	click: ActionOptions['click']


	constructor(id: string, data: ActionSpecificOptions) {
		if (typeof id == 'object') {
			data = id;
			// @ts-expect-error
			id = data.id;
		}
		super(id, data)
		var scope = this;
		this.type = 'action'
		//Icon
		this.icon = data.icon

		// Needs to run here instead of in toggle constructor to be set before HTML elements are generated
		let linked_setting = (data as ToggleOptions).linked_setting;
		if (this instanceof Toggle && linked_setting) {
			if (!data.name) this.name = tl(`settings.${linked_setting}`);
			if (!data.description) this.description = tl(`settings.${linked_setting}.desc`);
		}

		if (data.condition) this.condition = data.condition
		this.children = data.children;
		this.searchable = data.searchable;

		//Node
		if (!this.click && data.click) {
			this.onClick = data.click;
			this.click = (...args) => {
				let result = this.dispatchEvent('use', {});
				if (result == false) return;
				this.onClick(...args);
				this.dispatchEvent('used', {});
			};
		}
		this.icon_node = Blockbench.getIconNode(this.icon, this.color)
		this.node = document.createElement('div');
		this.node.classList.add('tool');
		this.node.setAttribute('toolbar_item', this.id);
		this.node.append(this.icon_node);
		this.nodes = [this.node]
		this.menus = [];
		
		this.menu_node = Interface.createElement('li', {title: this.description || '', menu_item: id}, [
			this.icon_node.cloneNode(true) as HTMLElement,
			Interface.createElement('span', {}, this.name),
			Interface.createElement('label', {class: 'keybinding_label'}, this.keybind?.toString() || '')
		]);
		addEventListeners(this.menu_node, 'mouseenter mousedown', event => {
			if (event.target == this.menu_node) {
				Menu.open.hover(this.menu_node, event);
			}
		});
		if (!this.children) {
			this.menu_node.addEventListener('click', event => {
				if (!(event.target == this.menu_node || (event.target as HTMLElement).parentElement == this.menu_node)) return;
				this.trigger(event);
			});
		}

		this.addLabel(data.label)
		this.updateKeybindingLabel()

		if (data.tool_config instanceof ToolConfig) {
			this.tool_config = data.tool_config;
			if (!data.side_menu) data.side_menu = data.tool_config;
		}
		if (data.side_menu) {
			this.side_menu = data.side_menu;
			this.node.classList.add('side_menu_tool');
			
			let open_node = Blockbench.getIconNode('arrow_drop_down');
			open_node.classList.add('action_more_options');
			open_node.onclick = e => {
				e.stopPropagation();
				if (this.side_menu instanceof Menu) {
					this.side_menu.open((e.target as HTMLElement).parentElement);
				} else if (this.side_menu instanceof ToolConfig) {
					this.side_menu.show(this.node);
				} else if (this.side_menu instanceof Dialog) {
					this.side_menu.show();
				}
			}
			this.node.append(open_node);
		}

		this.node.onclick = (e) => {
			scope.trigger(e)
		}
	}
	/**
	 * Trigger to run or select the action. This is the equivalent of clicking or using a keybind to trigger it. Also checks if the condition is met.
	 */
	trigger(event?: Event): boolean {
		var scope = this;
		let condition_met = BARS.condition(scope.condition, this);
		this.dispatchEvent('trigger', {condition_met});
		if (condition_met) {
			if (event && event.type === 'click' && (event as MouseEvent).altKey && scope.keybind) {
				var record = function() {
					document.removeEventListener('keyup', record)
					scope.keybind.record()
				}
				document.addEventListener('keyup', record, false)
				return true;
			}
			scope.click(event)
			scope.uses++;

			scope.nodes.forEach(node => {
				node.style.setProperty('color', 'var(--color-light)')
			})
			setTimeout(function() {
				scope.nodes.forEach(node => {
					node.style.setProperty('color', '')
				})
			}, 200)
			return true;
		}
		return false;
	}
	updateKeybindingLabel(): this {
		let keybind_text = this.keybind?.toString() || '';
		if (!keybind_text && this.id == 'color_picker') {
			keybind_text = tl(isMac ? 'keys.option' : 'keys.alt');
		}
		this.menu_node.querySelector('.keybinding_label').textContent = keybind_text;
		this.nodes.forEach(node => {
			node.querySelector('.keybinding_label').textContent = keybind_text;
		});
		return this;
	}
	getNode(ignore_disconnected) {
		let clone = super.getNode(ignore_disconnected);
		if (this.side_menu) {
			let options = clone.querySelector('.action_more_options') as HTMLDivElement;
			if (options && !options.onclick) {
				options.onclick = e => {
					e.stopPropagation();
					if (this.side_menu instanceof Menu) {
						this.side_menu.open((e.target as HTMLElement).parentElement);
					} else if (this.side_menu instanceof ToolConfig) {
						this.side_menu.show(clone);
					} else if (this.side_menu instanceof Dialog) {
						this.side_menu.show();
					}
				}
			}
		}
		this.dispatchEvent('get_node', {node: clone});
		return clone;
	}
	/** Change the icon of the action */
	setIcon(icon: IconString): void {
		this.icon = icon
		this.icon_node = Blockbench.getIconNode(this.icon)
		$(this.menu_node).find('> .icon').replaceWith(this.icon_node)

		this.nodes.forEach(n => {
			let old_icon = n.querySelector('.icon:not(.action_more_options)');
			old_icon.replaceWith(this.icon_node.cloneNode(true));
		})
	}
	/**
	 * Change the name of the action
	 */
	setName(name: string): void {
		this.name = name;
		this.nodes.forEach(node => {
			let tooltip = node.querySelector('.tooltip');
			if (tooltip && tooltip.firstChild) {
				tooltip.firstChild.textContent = this.name;;
			}
		})
		let menu_span = this.menu_node.querySelector('span');
		if (menu_span) {
			menu_span.innerText = this.name;
		}
	}
	delete() {
		super.delete();
		for (var i = this.menus.length-1; i >= 0; i--) {
			var m = this.menus[i]
			if (m.menu) {
				m.menu.deleteItem(this)
			}
		}
	}
}


type RGBAColor = { r: number; g: number; b: number; a: number }
type ViewMode = 'textured' | 'solid' | 'wireframe' | 'uv' | 'normal'
type PaintContext = {
	/**
	 * Brush color, set by the Blockbench color panel
	 */
	color: string
	/**
	 * Opacity, as set by the Opacity slider
	 */
	opacity: number
	/**
	 * 2D Canvas context of the texture that is being edited
	 */
	ctx: CanvasRenderingContext2D
	/**X Coordinate of the position of the brush stroke */
	x: number
	/**Y Coordinate of the position of the brush stroke */
	y: number
	/**
	 * Brush size, as set by the Brush Size slider
	 */
	size: number
	/**
	 * Brush softness, as set by the Brush Softness slider
	 */
	softness: number
	/**
	 * Blockbench texture that is being edited
	 */
	texture: Texture
	/**
	 * Javascript pointer event that the brush stroke originated from
	 */
	event: PointerEvent
}
export interface BrushOptions {
	/**
	 * Enable the input for blend modes when this tool is selected
	 */
	blend_modes: boolean
	/**
	 * Enable the input for shapes when this tool is selected
	 */
	shapes: boolean
	/**
	 * Enable the input for brush size when this tool is selected
	 */
	size: boolean
	/**
	 * Enable the input for softness when this tool is selected
	 */
	softness: boolean
	/**
	 * Enable the input for opacity when this tool is selected
	 */
	opacity: boolean
	/**
	 * When the brush size is an even number, offset the snapping by half a pixel so that even size brush strokes can be correctly centered
	 */
	offset_even_radius: boolean
	/**
	 * Set whether the brush coordinates get floored to snap to the nearest pixel.
	 */
	floor_coordinates: boolean | (() => boolean)
	/**
	 * Function that runs per pixel when the brush is used. Mutually exclusive with draw().
	 * @param pixel_x Local X coordinate relative to the brush center
	 * @param pixel_y Local Y coordinate relative to the brush center
	 * @param pixel_color Current color of the pixel on the texture
	 * @param local_opacity Local opacity of the current pixel on the brush, between 0 and 1. Opacity falls of to the sides of the brush if the brush is set to smooth. Opacity from the Opacity slider is not factored in yet.
	 * @param PaintContext Additional context to the paint stroke
	 */
	changePixel(
		pixel_x: number,
		pixel_y: number,
		pixel_color: RGBAColor,
		local_opacity: number,
		PaintContext: PaintContext
	): RGBAColor
	/**
	 * Function that runs when a new brush stroke starts. Return false to cancel the brush stroke
	 * @param context
	 */
	onStrokeStart(context: {
		texture: Texture
		x: number
		y: number
		uv?: any
		event: PointerEvent
		raycast_data: RaycastResult
	}): boolean
	/**
	 * Function that runs when a new brush stroke starts. Return false to cancel the brush stroke
	 * @param context
	 */
	onStrokeMove(context: {
		texture: Texture
		x: number
		y: number
		uv?: any
		event: PointerEvent
		raycast_data: RaycastResult
	}): boolean
	/**
	 * Function that runs when a new brush stroke starts.
	 * @param context
	 */
	onStrokeEnd(context: {
		texture: Texture
		x: number
		y: number
		uv?: any
		raycast_data: RaycastResult
	}): void
	/**
	 * Alternative way to create a custom brush, mutually exclusive with the changePixel() function. Draw runs once every time the brush starts or moves, and also along the bath on lines.
	 * @param context
	 */
	draw(context: {
		ctx: CanvasRenderingContext2D
		x: number
		y: number
		size: number
		softness: number
		texture: Texture
		event: PointerEvent
	}): void
}
interface ToolSpecificOptions {
	selectFace?: boolean
	selectElements?: boolean
	transformerMode?: 'translate' | 'hidden' | ''
	cursor?: string,
	animation_channel?: string
	toolbar?: string
	transform_toolbar?: string
	alt_tool?: string
	modes?: string[]
	allowed_view_modes?: ViewMode
	paintTool?: boolean
	brush?: BrushOptions
	raycast_options?: {
		edges?: boolean
		vertices?: boolean
	}
	onCanvasClick?(raycast_data: RaycastResult): void
	onSelect?(): void
	onUnselect?(): void
	onCanvasMouseMove?(raycast_data: RaycastResult)
	onCanvasRightClick?(raycast_data: RaycastResult)
	onTextureEditorClick?(raycast_data: RaycastResult)
}
export type ToolOptions = ActionOptions & ToolSpecificOptions

export interface Tool extends ToolSpecificOptions {}
/**
 * A tool, such as move tool, vertex snap tool, or paint brush
 */
export class Tool extends Action implements ToolSpecificOptions {
	tool_settings: Record<string, any>


	constructor(id: string, data: ToolOptions) {
		if (typeof id == 'object') {
			data = id;
			// @ts-expect-error
			id = data.id;
		}
		// @ts-expect-error
		super(id, data);
		var scope = this;
		this.type = 'tool'
		this.toolbar = data.toolbar;
		this.transform_toolbar = data.transform_toolbar;
		this.alt_tool = data.alt_tool;
		this.modes = data.modes;
		this.selectFace = data.selectFace;
		this.cursor = data.cursor;
		this.selectElements = data.selectElements !== false;
		this.paintTool = data.paintTool;
		this.brush = data.brush;
		this.transformerMode = data.transformerMode;
		this.animation_channel = data.animation_channel;
		this.allowed_view_modes = data.allowed_view_modes || null;
		this.tool_settings = {};

		if (this.condition == undefined && this.modes instanceof Array) {
			this.condition = {modes: this.modes};
		}
		this.raycast_options = data.raycast_options;
		this.onCanvasClick = data.onCanvasClick;
		this.onCanvasMouseMove = data.onCanvasMouseMove;
		this.onCanvasRightClick = data.onCanvasRightClick;
		this.onTextureEditorClick = data.onTextureEditorClick;
		this.onSelect = data.onSelect;
		this.onUnselect = data.onUnselect;
		this.node.onclick = () => {
			scope.select();
		}
		Tool.all.push(this);
	}
	select() {
		if (this === Toolbox.selected) return;
		let previous_tool = Toolbox.selected;
		if (Toolbox.selected) {
			Toolbox.selected.nodes.forEach(node => {
				node.classList.remove('enabled')
			})
			Toolbox.selected.menu_node.classList.remove('enabled')
			if (typeof Toolbox.selected.onUnselect == 'function') {
				Toolbox.selected.onUnselect()
			}
			if (Toolbox.selected.brush?.size && !this.brush?.size) {
				scene.remove(Canvas.brush_outline);
			}
			if (Transformer.dragging) {
				Transformer.cancelMovement({}, true);
			}
		}
		Toolbox.selected = this;
		delete Toolbox.original;
		this.uses++;
		if (Project) {
			Project.tool = Mode.selected.tool = this.id;
		}

		if (this.transformerMode) {
			Transformer.setMode(this.transformerMode)
		}
		if (this.allowed_view_modes && !this.allowed_view_modes.includes(Project.view_mode)) {
			Project.view_mode = 'textured';
			(BarItems.view_mode as BarSelect).change('textured');
		}
		if (this.toolbar && Toolbars[this.toolbar]) {
			Toolbars[this.toolbar].toPlace('tool_options');
		}
		else {
			$('.toolbar_wrapper.tool_options > .toolbar').detach();
		}
		if (Blockbench.isMobile && Settings.get('status_bar_transform_sliders')) {
			let wrapper = document.getElementById('status_bar_tool_controls');
			if (wrapper) {
				while (wrapper.firstElementChild) {
					wrapper.firstElementChild.remove();
				}
				if (Toolbars[this.transform_toolbar]) {
					wrapper.append(Toolbars[this.transform_toolbar].node);
				}
			}
		}

		if (typeof this.onSelect == 'function') {
			this.onSelect()
		}
		this.dispatchEvent('select', {previous_tool});
		Interface.preview.style.cursor = this.cursor ? this.cursor : 'default';
		this.nodes.forEach(node => {
			node.classList.add('enabled')
		})
		this.menu_node.classList.add('enabled')
		TickUpdates.selection = true;
		return this;
	}
	trigger(event: Event): boolean {
		if (BARS.condition(this.condition, this)) {
			this.select()
			return true;
		} else if (this.modes && event instanceof KeyboardEvent == false) {
			return this.switchModeAndSelect();
		}
		return false;
	}
	switchModeAndSelect() {
		for (var i = 0; i < this.modes.length; i++) {
			var mode = Modes.options[this.modes[i]]
			if (mode && Condition(mode.condition)) {
				mode.select()
				this.select()
				return true;
			}
		}
	}
	delete() {
		super.delete();
		Tool.all.remove(this);
	}
	static all: Tool[] = [];
	static selected: Tool | null = null;
}

export interface ToggleOptions extends Omit<ActionOptions, 'click'> {
	/**
	 * Default value of the toggle
	 */
	default?: boolean
	/**
	 * If true, remember the value between restarts
	 */
	save_on_restart?: boolean
	/**
	 * ID of a setting that the toggle is linked to
	 */
	linked_setting?: string
	/**
	 * Method that gets called when the user changes the value of the toggle
	 */
	onChange?(value: boolean): void
	icon: IconString | (() => IconString)
}
/**
 * A toggle is a type of action that can be on or off. The state is not persistent between restarts by default.
 */
export class Toggle extends Action {
	/**
	 * ID of a setting that the toggle is linked to
	 */
	linked_setting?: string
	value: boolean
	onChange?: (value: boolean) => void
	menu_icon_node: HTMLElement

	constructor(id: string, data: ToggleOptions) {
		// @ts-expect-error
		super(id, data);
		this.type = 'toggle';
		this.value = data.default || false;
		if (data.linked_setting) {
			this.linked_setting = data.linked_setting;
			if (settings[this.linked_setting]) {
				this.value = !!settings[this.linked_setting].value;
			}
		} else if (data.save_on_restart) {
			let value = localStorage.getItem(`bar_item_value.${this.id}`);
			if (value) this.value = value == 'true';
		}
		this.onChange = data.onChange;

		this.menu_icon_node = Blockbench.getIconNode('check_box_outline_blank');
		$(this.menu_node).find('.icon').replaceWith(this.menu_icon_node);

		this.click = () => {
			this.value = !this.value;
			if (this.linked_setting && settings[this.linked_setting]) {
				let setting = settings[this.linked_setting];
				setting.value = this.value;
				if (setting.onChange) setting.onChange(setting.value);
				Settings.saveLocalStorages();
			}
			if (this.onChange) this.onChange(this.value);
			this.dispatchEvent('change', {state: this.value});

			if (data.save_on_restart) {
				localStorage.setItem(`bar_item_value.${this.id}`, this.value.toString());
			}

			this.updateEnabledState();
		}

		this.updateEnabledState();
	}
	set(value: boolean): this {
		if (value == this.value) return this;
		this.click();
		return this;
	}
	setIcon(icon: IconString): this {
		if (!icon) return this;
		this.icon = icon;
		this.icon_node = Blockbench.getIconNode(this.icon);
		this.nodes.forEach(n => {
			$(n).find('.icon').replaceWith($(this.icon_node).clone());
		})
		return this;
	}
	/**
	 * Updates the state of the toggle in the UI
	 */
	updateEnabledState() {
		this.nodes.forEach(node => {
			node.classList.toggle('enabled', this.value);
		})
		this.menu_icon_node.innerText = this.value ? 'check_box' : 'check_box_outline_blank';
		return this;
	}
}
interface WidgetOptions extends BarItemOptions {
	id?: string
}
export abstract class Widget extends BarItem {
	constructor(id: string, data: WidgetOptions) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data);
		this.type = 'widget';
	}
}
type NumSliderOptions = WidgetOptions & {
	private?: boolean
	settings?: {
		default?: number
		min?: number
		max?: number
		interval?: number
		step?: number
		show_bar?: boolean
		limit?: boolean
	}
	sensitivity?: number
	invert_scroll_direction?: boolean
	/**
	 * Define a tool setting key under which the value of the slider is saved on the selected tool
	 */
	tool_setting?: string
	uv?: boolean
	sub_keybinds?: {
		increase: Keybind
		decrease: Keybind
	}

	getInterval?(event: Event): number
	change?(value: (n: number) => number): void
	get?(): number
	onChange?: (value: number, event?: Event) => void
	onBefore?(): void
	onAfter?: (difference?: number) => void
}
export class NumSlider extends Widget {
	value: number | string
	width: number
	sensitivity: number
	invert_scroll_direction: boolean
	pre?: number
	private last_value: number | string
	private sliding: boolean
	private sliding_start_pos: number
	settings: NumSliderOptions['settings']
	interval: number | ((event: Event) => number)
	onBefore?: () => void
	onChange?: (value: number, event?: Event) => void
	onAfter?: (difference?: number) => void
	uv?: boolean
	/**
	 * @private
	 */
	jq_outer: JQuery
	/**
	 * @private
	 */
	jq_inner: JQuery
	/**
	 * Define a tool setting key under which the value of the slider is saved on the selected tool
	 */
	tool_setting?: string
	/**
	 * All sliders that form the vector input that this slider is a part of
	 */
	slider_vector?: NumSlider[]

	constructor(id: string, data: NumSliderOptions) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data);
		this.uv = !!data.uv;
		this.type = 'numslider'
		this.icon = 'code'
		this.value = 0;
		this.width = 69;
		this.sensitivity = data.sensitivity || 30;
		this.invert_scroll_direction = data.invert_scroll_direction == true;
		this.uniqueNode = true;
		if (data.tool_setting) this.tool_setting = data.tool_setting;
		if (typeof data.get === 'function') this.get = data.get;
		this.onBefore = data.onBefore;
		this.onChange = data.onChange;
		this.onAfter = data.onAfter;
		if (typeof data.change === 'function') {
			this.change = (modify, ...args) => {
				data.change(modify)
				this.dispatchEvent('changed', {modify});
			};
		}
		if (data.settings) {
			this.settings = data.settings;
			if (this.settings.default) {
				this.value = this.settings.default
			}
			this.interval = this.settings.step || this.settings.interval;

		} else {
			this.interval = function(event: Event | any = {}) {
				if (!event.shiftKey && !event.ctrlOrCmd) {
					return 1
				} else if (event.ctrlOrCmd && event.shiftKey) {
					return 0.025
				} else if (event.ctrlOrCmd) {
					return 0.1
				} else if (event.shiftKey)  {
					return 0.25
				}
			}
		}
		if (typeof data.getInterval === 'function') {
			this.interval = data.getInterval;
		}
		if (this.keybind) {
			//this.keybind.shift = null;
			this.keybind.label = this.keybind.getText();
		}
		this.addSubKeybind('increase',
			'keybindings.item.num_slider.increase',
			data.sub_keybinds?.increase,
			(event) => {
				if (!Condition(this.condition)) return false;
				if (typeof this.onBefore === 'function') {
					this.onBefore()
				}
				var difference = this.getInterval(event);
				this.change(n => n + difference);
				this.update();
				if (typeof this.onAfter === 'function') {
					this.onAfter(difference)
				}
			}
		);
		this.addSubKeybind('decrease',
			'keybindings.item.num_slider.decrease',
			data.sub_keybinds?.decrease,
			(event) => {
				if (!Condition(this.condition)) return false;
				if (typeof this.onBefore === 'function') {
					this.onBefore()
				}
				var difference = this.getInterval(event);
				this.change(n => n - difference);
				this.update();
				if (typeof this.onAfter === 'function') {
					this.onAfter(difference)
				}
			}
		);

		var scope = this;
		this.node = Interface.createElement('div', {class: 'tool wide widget nslide_tool', toolbar_item: this.id}, [
			Interface.createElement('div', {class: 'nslide tab_target', inputmode: this.settings?.min >= 0 ? 'decimal' : '', 'n-action': this.id})
		])
		this.jq_outer = $(this.node)
		this.jq_inner = this.jq_outer.find('.nslide');

		if (this.color) {
			var css_color = 'uvwxyz'.includes(this.color.toString()) ? `var(--color-axis-${this.color})` : this.color;
			this.node.style.setProperty('--corner-color', css_color.toString());
			this.node.classList.add('is_colored');
		}

		this.addLabel();

		this.jq_inner
		.on('mousedown touchstart', async (event) => {
			if (scope.jq_inner.hasClass('editing')) return;
			scope.last_value = scope.value;
			
			let drag_event = await new Promise<MouseEvent | TouchEvent | false>((resolve, reject) => {
				function move(e2) {
					if (!e2.clientX || Math.abs(e2.clientX-event.clientX) > 2) {
						removeEventListeners(document, 'mousemove touchmove', move);
						removeEventListeners(document, 'mouseup touchend', stop);
						resolve(e2);
					}
				}
				function stop(e2) {
					removeEventListeners(document, 'mousemove touchmove', move);
					removeEventListeners(document, 'mouseup touchend', stop);
					if (event.target == event.target) scope.startInput()
					resolve(false);
				}
				addEventListeners(document, 'mousemove touchmove', move);
				addEventListeners(document, 'mouseup touchend', stop);
			})
			if (!drag_event) return;

			if (typeof scope.onBefore === 'function') {
				scope.onBefore()
			}
			convertTouchEvent(drag_event);
			drag_event = drag_event;
			// @ts-expect-error
			let clientX = drag_event.clientX;
			scope.sliding = true;
			scope.pre = 0;
			scope.sliding_start_pos = clientX;
			let move_calls = 0;

			if ('touches' in drag_event == false) scope.jq_inner.get(0).requestPointerLock();

			function move(e) {
				convertTouchEvent(e)
				if (drag_event && 'touches' in drag_event) {
					clientX = e.clientX;
				} else {
					let limit = move_calls <= 2 ? 1 : 160;
					clientX += Math.clamp(e.movementX, -limit, limit);
				}
				scope.slide(clientX, e);
				move_calls++;
			}
			function stop(e: MouseEvent | TouchEvent) {
				removeEventListeners(document, 'mousemove touchmove', move);
				removeEventListeners(document, 'mouseup touchend', stop);
				document.exitPointerLock()
				Blockbench.setStatusBarText();
				delete scope.sliding;
				if (typeof scope.onAfter === 'function') {
					scope.onAfter(parseFloat(scope.value as string) - parseFloat(scope.last_value as string))
				}
			}
			addEventListeners(document, 'mousemove touchmove', move);
			addEventListeners(document, 'mouseup touchend', stop);
		})
		//Input
		.on('keypress', function (e) {
			if (e.keyCode === 10 || e.keyCode === 13) {
				e.preventDefault();
				scope.stopInput();
			}
		})
		.on('keyup', function (e) {
			if (e.keyCode !== 10 && e.keyCode !== 13) {
				scope.input()
			}
			if (e.keyCode === 27) {
				if (!scope.jq_inner.hasClass('editing')) return;
				e.preventDefault();
				scope.jq_inner.removeClass('editing')
				scope.jq_inner.attr('contenteditable', 'false')
				scope.update()
			}
		})
		.on('focusout', function() {
			scope.stopInput()
		})
		.on('dblclick', function(event) {
			if (event.target != this) return;
			let value = scope.settings && scope.settings.default ? scope.settings.default.toString() : '0';
			scope.jq_inner.text(value);
			scope.stopInput()

		})
		.on('contextmenu', (event: Event) => {
			new Menu([
				new MenuSeparator('copypaste'),
				{
					id: 'copy',
					name: 'action.copy',
					icon: 'fa-copy',
					click: () => {
						Clipbench.setText(this.value.toString());
					}
				},
				{
					id: 'copy',
					name: 'menu.text_edit.copy_vector',
					icon: 'fa-copy',
					condition: this.slider_vector instanceof Array,
					click: () => {
						let numbers = this.slider_vector.map(slider => slider.value);
						let text = numbers.join(' ');
						Clipbench.setText(text);
					}
				},
				{
					id: 'paste',
					name: 'action.paste',
					icon: 'fa-paste',
					click: async () => {
						this.startInput()
						let text = await navigator.clipboard.readText();
						this.jq_inner.text(text);
						this.stopInput();
					}
				},
				new MenuSeparator('edit'),
				{
					id: 'round',
					name: 'menu.slider.round_value',
					icon: 'percent',
					click: () => {
						if (typeof this.onBefore === 'function') {
							this.onBefore()
						}
						this.change(n => Math.round(n));
						this.update()
						if (typeof this.onAfter === 'function') {
							this.onAfter()
						}
					}
				},
				{
					id: 'round',
					name: 'menu.slider.reset_vector',
					icon: 'replay',
					condition: this.slider_vector instanceof Array,
					click: () => {
						if (typeof this.onBefore === 'function') {
							this.onBefore()
						}
						for (let slider of this.slider_vector) {
							let value = slider.settings?.default ?? 0;
							slider.change(n => value);
							slider.update();
						}
						if (typeof this.onAfter === 'function') {
							this.onAfter()
						}
					}
				}
			]).open(event as MouseEvent);
		});
		//Arrows
		this.jq_outer
		.on('mouseenter', function() {
			scope.jq_outer.append(
				'<div class="nslide_arrow na_left" ><i class="material-icons">navigate_before</i></div>'+
				'<div class="nslide_arrow na_right"><i class="material-icons">navigate_next</i></div>'
			)

			var n = limitNumber(scope.node.clientWidth/2-22, 6, 1000)

			scope.jq_outer.find('.nslide_arrow.na_left').click(function(e) {
				scope.arrow(-1, e)
			}).css('margin-left', (-n-22)+'px')

			scope.jq_outer.find('.nslide_arrow.na_right').click(function(e) {
				scope.arrow(1, e)
			}).css('margin-left', (n)+'px')
		})
		.on('mouseleave', function() {
			scope.jq_outer.find('.nslide_arrow').remove()
		})
	}
	startInput() {
		this.jq_inner.find('.nslide_arrow').remove()
		this.jq_inner.attr('contenteditable', 'true')
		this.jq_inner.addClass('editing')
		this.jq_inner.focus()
		document.execCommand('selectAll')
	}
	setWidth(width: number) {
		if (width) {
			this.width = width
		} else {
			width = this.width
		}
		this.node.style.width = width + 'px';
		return this;
	}
	getInterval(e?: Event) {
		if (typeof this.interval == 'function') {
			return this.interval(e);
		} else if (typeof this.interval === 'number') {
			return this.interval;
		} else {
			return 0;
		}
	}
	slide(clientX: number, event: MouseEvent | PointerEvent) {
		var offset = Math.round((clientX - this.sliding_start_pos)/this.sensitivity)
		var difference = (offset - this.pre) * this.getInterval(event);
		this.pre = offset;

		if (!difference) return;

		this.change(n => n + difference, event);
		this.update();
		let display_offset = trimFloatNumber(parseFloat(this.value as string) - parseFloat(this.last_value as string || '0'));
		if (!Blockbench.isMobile) {
			Blockbench.setStatusBarText(display_offset);
		}
	}
	input() {
		this.last_value = this.value;
	}
	stopInput() {
		if (!this.jq_inner.hasClass('editing')) return;
		var text = this.jq_inner.text();
		if (this.last_value?.toString() !== text) {
			var first_token = text.substr(0, 1);

			if (typeof this.onBefore === 'function') {
				this.onBefore()
			}

			if (this.slider_vector && text.split(/\s+/g).length == this.slider_vector.length) {
				let components = text.split(/\s+/g);

				components.forEach((input, axis) => {
					let slider = this.slider_vector[axis];
					let number = parseFloat(input);
					if (isNaN(number)) {
						number = 0;
					}
					slider.change(val => number);

					this.jq_inner.removeClass('editing')
					this.jq_inner.attr('contenteditable', 'false')
					this.update()
				})

				this.onAfter()
				return;
			}


			text = text.replace(/,(?=\d+$)/, '.');
			if (text.match(/^-?\d*(\.\d+)?%?$/gm)) {
				var number = parseFloat(text);
				if (isNaN(number)) {
					number = 0;
				}
				if (text.endsWith('%') && typeof this.settings?.min == 'number' && typeof this.settings?.max == 'number') {
					number = Math.lerp(this.settings.min, this.settings.max, number/100);
				}
				this.change(val => number);
			} else {
				var n = 0;
				this.change(val => {
					var variables = {
						val: val,
						n
					};
					n++;

					if ('+*/'.includes(first_token)) {
						return NumSlider.MolangParser.parse(val + text, variables)
					} else {
						return NumSlider.MolangParser.parse(text, variables)
					}
				});
			}
			if (typeof this.onAfter === 'function') {
				this.onAfter()
			}
		}
		this.jq_inner.removeClass('editing')
		this.jq_inner.attr('contenteditable', 'false')
		this.update()
	}
	arrow(difference, event) {
		if (typeof this.onBefore === 'function') {
			this.onBefore()
		}
		difference *= this.getInterval(event)
		this.change(n => n + difference)
		this.update()
		if (typeof this.onAfter === 'function') {
			this.onAfter(difference)
		}
	}
	trigger(event: Event) {
		if (!Condition(this.condition)) return false;
		if (typeof this.onBefore === 'function') {
			this.onBefore()
		}
		let sign = event.shiftKey ? -1 : 1;
		if ((event as WheelEvent).deltaY > 0) sign *= -1;
		if (event instanceof WheelEvent && this.invert_scroll_direction) sign *= -1;
		var difference = this.getInterval() * sign;
		this.change(n => n + difference)
		this.update()
		if (typeof this.onAfter === 'function') {
			this.onAfter(difference)
		}
		return true;
	}
	setValue(value: number | string, trim: boolean = true) {
		if (typeof value === 'string') {
			value = parseFloat(value)
		}
		if (trim === false) {
			this.value = value
		} else if (typeof value === 'number') {
			this.value = trimFloatNumber(value)
		} else {

		}
		if (this.tool_setting) {
			Toolbox.selected.tool_settings[this.tool_setting] = value;
		}
		if (!this.jq_inner.hasClass('editing') && this.jq_inner[0].textContent !== this.value.toString()) {
			this.jq_inner.text(this.value)
		}
		if (this.settings && this.settings.show_bar && typeof this.settings.max == 'number') {
			this.node.classList.add('has_percentage_bar');
			let percentage = Math.getLerp(this.settings.min ?? 0, this.settings.max, value as number) * 100;
			this.node.style.setProperty('--percentage', percentage.toString());
		} 
		return this;
	}
	change(modify: (old_value: number) => number, event?: Event) {
		//Solo sliders only, gets overwritten for most sliders
		var num = modify(this.get());
		if (this.settings && typeof this.settings.min === 'number' && this.settings.limit !== false) {
			num = limitNumber(num, this.settings.min, this.settings.max)
		}
		this.value = num;
		if (this.tool_setting) {
			Toolbox.selected.tool_settings[this.tool_setting] = num;
		}
		if (typeof this.onChange === 'function') {
			this.onChange(num, event);
		}
		this.dispatchEvent('change', {number: num});
	}
	get() {
		//Solo Sliders only
		if (this.tool_setting) {
			return Toolbox.selected.tool_settings[this.tool_setting] != undefined
				 ? Toolbox.selected.tool_settings[this.tool_setting]
				 : (this.settings.default||0)
		} else {
			return parseFloat(this.value as string);
		}
	}
	update() {
		if (!BARS.condition(this.condition)) return;
		var number = this.get();
		this.setValue(number)
		if (isNaN(number) && !this.jq_inner.hasClass('editing') && this.jq_inner[0].textContent) {
			this.jq_inner.text('')
		}
		this.dispatchEvent('update', {});
	}
	static MolangParser = new MolangParser();
}

interface BarSliderOptions extends WidgetOptions {
	value?: number
	min?: number
	max?: number
	step?: number
	circular?: boolean
	width?: number
	onChange?: (event: Event) => void
	onBefore?: (event: Event) => void
	onAfter?: (event: Event) => void
	sub_keybinds?: {
		increase: Keybind
		decrease: Keybind
	}
}
export class BarSlider extends Widget {
	value: number
	settings: {
		min: number
		max: number
		step: number
		circular?: boolean
	}
	onChange?: (event: Event) => void
	onBefore?: (event: Event) => void
	onAfter?: (event: Event) => void
	constructor(id: string, data: BarSliderOptions) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data);
		var scope = this;
		this.type = 'slider'
		this.icon = 'fa-sliders-h'
		this.value = data.value||0;
		this.settings = {
			min: data.min ? data.min : 0,
			max: data.max ? data.max : 10,
			step: data.step ? data.step : 1,
			circular: data.circular
		}
		this.node = Interface.createElement('div', {class: 'tool widget', toolbar_item: this.id}, [
			Interface.createElement('input', {
				type: 'range',
				value: data.value ? data.value : 0,
				...this.settings,
				style: `width: ${data.width ? (data.width+'px') : 'auto'};`
			})
		])
		this.addLabel();
		if (typeof data.onChange === 'function') {
			this.onChange = data.onChange
		}
		if (typeof data.onBefore === 'function') {
			this.onBefore = data.onBefore
		}
		if (typeof data.onAfter === 'function') {
			this.onAfter = data.onAfter
		}
		$(this.node).children('input').on('input', function(event) {
			let value = parseFloat( $(event.target).val() );
			scope.change(value, event.originalEvent);
		})
		if (scope.onBefore) {
			$(this.node).children('input').on('mousedown', function(event) {
				scope.onBefore(event.originalEvent)
			})
		}
		if (scope.onAfter) {
			$(this.node).children('input').on('change', function(event) {
				scope.onAfter(event.originalEvent)
			})
		}
		this.addSubKeybind('increase',
			'keybindings.item.num_slider.increase',
			data.sub_keybinds?.increase,
			(event) => {
				if (!Condition(this.condition)) return false;
				if (typeof this.onBefore === 'function') {
					this.onBefore(event);
				}
				let value = this.get() + this.settings.step;
				if (this.settings.circular && value > this.settings.max) value = this.settings.min;
				this.change(value, event);

				if (typeof this.onAfter === 'function') {
					this.onAfter(event);
				}
			}
		);
		this.addSubKeybind('decrease',
			'keybindings.item.num_slider.decrease',
			data.sub_keybinds?.decrease,
			(event) => {
				if (!Condition(this.condition)) return false;
				if (typeof this.onBefore === 'function') {
					this.onBefore(event);
				}
				let value = this.get() - this.settings.step;
				if (this.settings.circular && value < this.settings.min) value = this.settings.max;
				this.change(value, event);

				if (typeof this.onAfter === 'function') {
					this.onAfter(event);
				}
			}
		);
	}
	change(value: number, event?: Event) {
		value = Math.clamp(value, this.settings.min, this.settings.max);
		this.set( value );
		if (this.onChange) {
			this.onChange(event)
		}
		this.dispatchEvent('change', {value: this.value});
	}
	set(value: number) {
		this.value = value
		$(this.nodes).children('input').val(value)
	}
	get(): number {
		return this.value
	}
}
type BarSelectPropertyFormat = string | boolean | {
	name: string | true
	condition?: ConditionResolvable
	icon?: string
}
interface BarSelectOptions extends WidgetOptions {
	value?: string
	icon_mode?: boolean
	options: Record<string, BarSelectPropertyFormat>
	onChange?(self: BarSelect, event?: Event): void
	width?: number
	min_width?: number
	sub_keybinds?: {
		[key: string]: Keybind
	}
}
export class BarSelect extends Widget {
	icon_mode: boolean
	value: string
	values: string[]
	options: Record<string, BarSelectPropertyFormat>
	onChange?(self: BarSelect, event?: Event): void

	constructor(id: string, data: BarSelectOptions) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data);
		this.type = 'select'
		this.icon = 'list'
		this.icon_mode = !!data.icon_mode;
		this.value = data.value
		this.values = [];
		this.options = data.options;
		if (data.options) {
			for (let key in data.options) {
				if (!this.value) {
					this.value = key
				}
				this.values.push(key);
			}
		}
		this.node = Interface.createElement('div', {class: 'tool widget bar_select', toolbar_item: this.id});
		if (this.icon_mode) {
			this.node.classList.add('icon_mode');
			for (let key in data.options) {
				let button = document.createElement('div');
				button.className = 'select_option';
				button.setAttribute('key', key);
				button.append(Blockbench.getIconNode(typeof data.options[key] == 'object' ? data.options[key].icon : ''));
				this.node.append(button);
				button.addEventListener('click', event => {
					this.set(key);
					if (this.onChange) {
						this.onChange(this, event);
					}
				})
				let title = this.getNameFor(key);
				button.addEventListener('mouseenter', event => {
					this.node.firstElementChild.firstChild.textContent = this.name + ': ' + title;
				})
			}

		} else {
			let select = Interface.createElement('div', {class: 'bb-select'});
			this.node.append(select);
			if (data.width) {
				select.style.setProperty('width', data.width+'px');
			}
			if (data.min_width) {
				select.style.setProperty('min-width', data.min_width+'px');
			}
			select.addEventListener('click', event => {
				this.open(event)
			})
		}
		if (data.options) {
			for (let key in data.options) {
				this.addSubKeybind(key,
					this.getNameFor(key),
					data.sub_keybinds?.[key],
					(event) => {
						if (!Condition(this.condition)) return false;
						this.set(key);
						if (this.onChange) {
							this.onChange(this, event);
						}
					}
				);
			}
		}

		this.nodes.push(this.node);
		this.set(this.value);
		this.addLabel()
		if (typeof data.onChange === 'function') {
			this.onChange = data.onChange
		}
		$(this.node).on('wheel', event => {
			this.trigger(event.originalEvent as WheelEvent);
		})
	}
	getNode(ignore_disconnected?: boolean) {
		let length = this.nodes.length;
		let node = super.getNode(ignore_disconnected);
		node.onclick = null;
		if (this.nodes.length !== length) {
			// Cloned
			if (this.icon_mode) {
				for (let key in this.options) {
					let button = node.querySelector(`div[key="${key}"]`);
					if (button) {
						button.addEventListener('click', event => {
							this.set(key);
							if (this.onChange) {
								this.onChange(this, event);
							}
						})
						let title = this.getNameFor(key);
						button.addEventListener('mouseenter', event => {
							node.firstElementChild.firstChild.textContent = this.name + ': ' + title;
						})
					}
				}

			} else {
				let select = node.querySelector('.bb-select');
				select && select.addEventListener('click', event => {
					this.open(event)
				})
			}
		}
		return node;
	}
	open(event: Event) {
		if (Menu.closed_in_this_click == this.id) return this;
		let scope = this;
		let items = [];
		for (let key in this.options) {
			let val = this.options[key];
			if (val) {
				let save_key = key;
				items.push({
					name: scope.getNameFor(key),
					icon: (val as any).icon || ((scope.value == save_key) ? 'far.fa-dot-circle' : 'far.fa-circle'),
					condition: (val as any).condition,
					click: (e: MouseEvent) => {
						scope.set(save_key);
						if (scope.onChange) {
							scope.onChange(scope, e);
						}
					}
				})
			}
		}
		let menu = new Menu(this.id, items, {class: 'select_menu'});
		this.dispatchEvent('open', {menu, items});
		menu.node.style['min-width'] = this.node.clientWidth+'px';
		menu.open(event.target as HTMLElement, this);
	}
	trigger(event: MouseEvent | TouchEvent | KeyboardEvent | WheelEvent): boolean | undefined {
		var scope = this;
		let condition_met = BARS.condition(this.condition, this);
		this.dispatchEvent('trigger', {condition_met});
		if (condition_met) {
			if (event && event.type === 'click' && event.altKey && scope.keybind) {
				var record = function() {
					document.removeEventListener('keyup', record)
					scope.keybind.record()
				}
				document.addEventListener('keyup', record, false)
				return true;
			}

			var index = this.values.indexOf(this.value)
			function advance() {
				if (event.type === 'mousewheel' || event.type === 'wheel') {
					index += (event as WheelEvent).deltaY < 0 ? -1 : 1;
				} else {
					index++;
					if (index >= scope.values.length) index = 0;
				}
			}
			for (var i = 0; i < 40; i++) {
				advance()
				if (index < 0 || index >= this.values.length) return;
				let opt = this.options[this.values[index]];
				if (opt && Condition((opt as any).condition)) break;
			}
			this.set(this.values[index]);
			if (this.onChange) {
				this.onChange(this, event);
			}
			
			scope.uses++;
			return true;
		}
		return false;
	}
	change(value: string, event?: Event) {
		this.set(value);
		if (this.onChange) {
			this.onChange(this, event);
		}
		this.dispatchEvent('change', {value, event});
		return this;
	}
	getNameFor(key: string): string {
		let val = this.options[key];
		let name_input = typeof val == 'object' ? val.name : val;
		let name = tl(val == true || name_input === true
				? ('action.'+this.id+'.'+key) 
				: ((val && (val as any).name) || val)
			);
		return name;
	}
	set(key: string) {
		if (this.options[key] == undefined) {
			console.warn(`Option ${key} does not exist in BarSelect ${this.id}`)
			return this;
		}
		this.value = key;
		if (this.icon_mode) {
			this.nodes.forEach(node => {
				for (let key in this.options) {
					let button = node.querySelector(`div.select_option[key=${key}]`);
					button.classList.toggle('selected', this.value == key);
				}
			})
		} else {
			let name = this.getNameFor(key);
			this.nodes.forEach(node => {
				$(node).find('.bb-select').text(name)
			})
			if (!this.nodes.includes(this.node)) {
				$(this.node).find('.bb-select').text(name)
			}
		}
		return this;
	}
	get(): string {
		return this.value;
	}
}
interface BarTextOptions extends WidgetOptions {
	text: string
	onUpdate: () => void
	click?: () => void
}
export class BarText extends Widget {
	text: string
	onUpdate: () => void
	click: () => void
	constructor(id: string, data: BarTextOptions) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data);
		this.type = 'bar_text'
		this.icon = 'text_format'
		this.node = Interface.createElement('div', {class: 'tool widget bar_text', toolbar_item: this.id}, data.text);

		this.onUpdate = data.onUpdate;
		if (typeof data.click === 'function') {
			this.click = data.click;
			this.node.addEventListener('click', this.click)
		}
	}
	set(text: string): this {
		this.text = text;
		$(this.nodes).text(text)
		return this;
	}
	update() {
		if (typeof this.onUpdate === 'function') {
			this.onUpdate()
		}
		this.dispatchEvent('update', {});
		return this;
	}
	trigger(event: Event) {
		if (!Condition(this.condition)) return false;
		this.dispatchEvent('trigger', {event});
		Blockbench.showQuickMessage(this.text)
		return true;
	}
}

export interface ColorPickerOptions extends WidgetOptions {
	value?: string
	palette?: boolean
	onChange?: (color: tinycolor.Instance) => void
}

export class ColorPicker extends Widget {
	value: tinycolor.Instance
	jq: JQuery
	onChange?: (color: tinycolor.Instance) => void
	
	constructor(options: ColorPickerOptions)
	constructor(id: string, data: ColorPickerOptions)
	constructor(id: string | ColorPickerOptions, data?: ColorPickerOptions) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data);
		var scope = this;
		this.type = 'color_picker'
		this.icon = 'color_lens'
		this.node = Interface.createElement('div', {class: 'tool widget', toolbar_item: this.id}, [
			Interface.createElement('input', {class: 'f_left', type: 'text'})
		]);
		this.addLabel();
		this.jq = $(this.node).find('input')
		if (typeof data.onChange === 'function') {
			this.onChange = data.onChange
		}
		this.value = new tinycolor('ffffff')
		this.jq.spectrum({
			preferredFormat: "hex",
			color: data.value || 'ffffff',
			showAlpha: true,
			showInput: true,
			maxSelectionSize: 128,
			showPalette: data.palette === true,
			palette: data.palette ? [] : undefined,
			// @ts-expect-error
			resetText: tl('generic.reset'),
			cancelText: tl('dialog.cancel'),
			chooseText: tl('dialog.confirm'),
			show: function() {
				open_interface = scope
			},
			hide: function() {
				open_interface = false
			},
			change: function(c) {
				scope.change(c)
			},
			move(arg) {
				scope.dispatchEvent('modify_color', {color: arg});
			}
		})
	}
	change(color: tinycolor.Instance) {
		if (this.onChange) {
			this.onChange(color);
		}
		this.dispatchEvent('change', {color});
	}
	hide() {
		// @ts-expect-error
		this.jq.spectrum('cancel');
	}
	confirm() {
		this.jq.spectrum('hide');
	}
	set(color: tinycolor.ColorInput) {
		this.value = new tinycolor(color)
		this.jq.spectrum('set', this.value.toHex8String())
		return this;
	}
	get() {
		this.value = this.jq.spectrum('get');
		return this.value;
	}
}



const global = {
	BarItem,
	KeybindItem,
	Action,
	Tool,
	Toggle,
	Widget,
	NumSlider,
	BarSlider,
	BarSelect,
	BarText,
	ColorPicker,
	Keybinds,
	BarItems,
};
declare global {
	type BarItem = import('./actions').BarItem
	const BarItem: typeof global.BarItem
	type KeybindItem = import('./actions').KeybindItem
	const KeybindItem: typeof global.KeybindItem
	type Action = import('./actions').Action
	const Action: typeof global.Action
	type Tool = import('./actions').Tool
	const Tool: typeof global.Tool
	type Toggle = import('./actions').Toggle
	const Toggle: typeof global.Toggle
	type Widget = import('./actions').Widget
	const Widget: typeof global.Widget
	type NumSlider = import('./actions').NumSlider
	const NumSlider: typeof global.NumSlider
	type BarSlider = import('./actions').BarSlider
	const BarSlider: typeof global.BarSlider
	type BarSelect = import('./actions').BarSelect
	const BarSelect: typeof global.BarSelect
	type BarText = import('./actions').BarText
	const BarText: typeof global.BarText
	type ColorPicker = import('./actions').ColorPicker
	const ColorPicker: typeof global.ColorPicker
	const BarItems: typeof global.BarItems
}
Object.assign(window, global);

