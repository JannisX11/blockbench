import { mouse_pos } from '../misc'
import { NumSliderOptions } from './actions'


/**
 * The menu class lets you create content menus. Context menus can contain custom menu items, and a number of existing UI elements, including Actions, Tools, etc.
 * 
 * ## Example
 * ```
 * document.addEventListener('contextmenu', event => {
 *   let items = [
 *     'open_model',
 *     {
 *       name: 'Example',
 *       icon: 'house',
 *       click() {
 *         console.log('Hello World')
 *       }
 *     }
 *   ];
 *   new Menu(items).open(event);
 * })
 * ```
 * @module
 */


export interface CustomMenuItem {
	name: string
	id?: string
	icon: IconString | boolean | ((context: any) => (IconString|boolean))
	color?: string
	description?: string
	condition?: ConditionResolvable
	/**
	 * Keybind or string to display in the menu, won't work as an actual keybinding by default
	 */
	keybind?: Keybind | string
	/**
	 * If true, mark the menu item as the selected one (underlined text in default theme)
	 */
	marked?: boolean | ((context: any) => boolean)
	/**
	 * Adds a search bar to the menu or submenu
	 */
	searchable?: boolean
	children?: MenuItem[] | ((context: any) => MenuItem[])
	click?(context?: any, event?: Event): void
}
export type MenuItem = CustomMenuItem | Action | BarSelect | MenuSeparator | string | ((context: any) => MenuItem)
type ResolvedMenuItem = CustomMenuItem | Action | BarSelect
type MenuParentItem = (CustomMenuItem | Action | BarSelect)
type MenuOpenPositionAnchor = MouseEvent | HTMLElement | 'mouse';
export interface MenuOptions {
	onOpen?(position: MenuOpenPositionAnchor, context?: any): void
	onClose?(): void
	keep_open?: boolean
	searchable?: boolean
	class?: string | string[]
}

export class MenuSeparator {
	id: string
	label?: string
	menu_node: HTMLLIElement
	constructor(id: string = '', label?: string) {
		this.id = id;
		this.menu_node = Interface.createElement('li', {class: 'menu_separator', menu_separator_id: id}) as HTMLLIElement;
		if (label) {
			this.label = tl(label);
			this.menu_node.append(Interface.createElement('label', {}, this.label));
			this.menu_node.classList.add('has_label');
		}
	}
}
function handleMenuOverflow(node) {
	node = node.get(0);
	if (!node) return;
	function offset(amount) {
		let top = parseInt(node.style.top);
		let offset = top - $(node).offset().top;
		let top_gap = 26;
		if (Blockbench.isMobile && Menu.open instanceof BarMenu) {
			top_gap = window.innerHeight > 400 ? 106 : 56;
		}
		top = Math.clamp(
			top + amount,
			window.innerHeight - node.clientHeight + offset,
			offset + top_gap
		);
		node.style.top = `${top}px`;
	}
	if (Blockbench.isTouch) {
		node.addEventListener('touchstart', e1 => {
			e1.stopPropagation();
			convertTouchEvent(e1);
			let last_y = e1.clientY;
			let move = e2 => {
				convertTouchEvent(e2);
				offset(e2.clientY - last_y);
				last_y = e2.clientY;
			}
			let stop = e2 => {
				document.removeEventListener('touchmove', move);
				document.removeEventListener('touchend', stop);
			}
			document.addEventListener('touchmove', move);
			document.addEventListener('touchend', stop);
		})
	}
	node.addEventListener('wheel', e => {
		e.stopPropagation();
		offset(-e.deltaY);
	})
}

/**
 * Use the Menu class to create a context menu. Menus can contain custom entries and hierarchy, or existing actions and tools.
 */
export class Menu implements Deletable {
	id: string
	children: []
	structure: MenuItem[] | ((context: any) => MenuItem[])
	options?: MenuOptions
	condition?: ConditionResolvable
	onOpen?(position: MenuOpenPositionAnchor, context?: any): void
	onClose?(): void
	node: HTMLUListElement
	highlight_action?: MenuItem

	public type = 'menu'

	/**
	 * Creates a new context menu
	 */
	constructor(template: MenuItem[] | ((context?: any) => MenuItem[]), options?: MenuOptions)
	constructor(
		id: string,
		template: MenuItem[] | ((context?: any) => MenuItem[]),
		options?: MenuOptions
	)
	constructor(
		id: string | MenuItem[] | ((context?: any) => MenuItem[]),
		template: MenuItem[] | ((context?: any) => MenuItem[]) | MenuOptions,
		options?: MenuOptions
	) {
		this.id = '';
		if (typeof id == 'string') {
			this.id = id;
			// @ts-expect-error
			this.structure = template;
			this.options = options || {};
		} else {
			this.structure = id;
			// @ts-expect-error
			this.options = template || {};

		}
		this.id = typeof id == 'string' ? id : '';
		this.children = [];
		this.onOpen = this.options.onOpen;
		this.onClose = this.options.onClose;
		this.node = document.createElement('ul');
		this.node.classList.add('contextMenu');
		if (this.options.class) {
			if (this.options.class instanceof Array) {
				this.node.classList.add(...this.options.class);
			} else {
				this.node.classList.add(this.options.class);
			}
		}
	}
	hover(node: HTMLElement, event?: Event, expand?: boolean): void {
		if (node.classList.contains('focused') && !expand) {
			if (node.classList.contains('hybrid_parent')) {
				node.classList.remove('opened');
			} else {
				return;
			}
		}
		if (event) event.stopPropagation()
		$(Menu.open.node).find('li.focused').removeClass('focused')
		$(Menu.open.node).find('li.opened').removeClass('opened')
		var obj = $(node)
		node.classList.add('focused')
		obj.parents('li.parent, li.hybrid_parent').addClass('opened')

		if (obj.hasClass('parent') || (expand && obj.hasClass('hybrid_parent'))) {
			var childlist = obj.find('> ul.contextMenu.sub')

			if (expand) node.classList.add('opened');

			var p_width = obj.outerWidth()
			childlist.css('left', p_width + 'px')
			childlist.css('margin-top', '');
			var el_width = childlist.width()
			var offset = childlist.offset()
			var el_height = childlist.height()

			if (offset.left + el_width > window.innerWidth) {
				let clamp_at_screen_edge = window.innerWidth - offset.left + p_width - el_width;
				if (Blockbench.isMobile) {
					// On mobile, overlay submenus
					childlist.css('visibility', 'hidden');
					setTimeout(() => {
						childlist.css('left', 0);
						childlist.css('visibility', 'visible');
					}, 100);
				} else if (expand) {
					// In hybrid menu, offset below so the menu doesn't close
					childlist.css('margin-top', (node.clientHeight-5) + 'px');
					let clamp_at_button_overlap = p_width - (event.target as HTMLElement).clientWidth;
					childlist.css('left', Math.min(clamp_at_screen_edge, clamp_at_button_overlap) + 'px');
				} else if (el_width > offset.left - p_width) {
					// If not enough space on the left, stick to the right screen edge
					childlist.css('left', clamp_at_screen_edge + 'px');
				} else {
					// Display to the left of the menu
					childlist.css('left', -el_width + 'px')
				}
			}

			let top_gap = 26;
			if (Blockbench.isMobile && this instanceof BarMenu) {
				top_gap = window.innerHeight > 400 ? 106 : 56;
			}
			let window_height = window.innerHeight - top_gap;

			if (el_height > window_height) {
				childlist.css('margin-top', '0').css('top', '0')
				childlist.css('top', (-childlist.offset().top + top_gap) + 'px')
				handleMenuOverflow(childlist);

			} else if (offset.top + el_height > window_height) {
				childlist.css('margin-top', top_gap-childlist.height() + 'px')
				if (childlist.offset().top < top_gap) {
					childlist.offset({top: top_gap})
				}
			}
		}
	}
	//reveal(path) {}

	/**
	 * Trigger keyboard navigation
	 * @param e Event
	 * @returns True if the input was used for navigation
	 * @private
	 */
	keyNavigate(e: KeyboardEvent): boolean {
		var used: boolean = false;
		var obj = $(this.node)
		if (e.which >= 37 && e.which <= 40) {

			let is_menu_bar = this instanceof BarMenu && e.which%2;
			if (obj.find('li.focused').length || is_menu_bar) {
				var old = obj.find('li.focused'), next;
				switch (e.which) {
					case 37: next = old.parent('ul').parent('li'); 					break;//<
					case 38: next = old.prevAll('li:not(.menu_separator)').first(); break;//UP
					case 39: next = old.find('ul li:first-child'); 					break;//>
					case 40: next = old.nextAll('li:not(.menu_separator)').first(); break;//DOWN
				}

				if (!next.length && e.which%2 == 0) {
					var siblings = old.siblings('li:not(.menu_separator)')
					if (e.which === 38) {
						next = siblings.last()
					} else {
						next = siblings.first()
					}
				}
				if (next && next.length) {
					old.removeClass('focused')
					this.hover(next.get(0))
				} else if (is_menu_bar) {
					var index = MenuBar.keys.indexOf(this.id)
					index += (e.which == 39 ? 1 : -1)
					if (index < 0) {
						index = MenuBar.keys.length-1
					} else if (index >= MenuBar.keys.length) {
						index = 0;
					}
					MenuBar.menus[MenuBar.keys[index]].open()
				}
			} else {
				obj.find('> li:first-child').addClass('focused')
			}
			used = true;
		} else if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
			obj.find('li.focused').trigger('click');
			if (this && !this.options.keep_open) {
				//this.hide()
			}
			used = true;
		} else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
			this.hide()
			used = true;
		}
		return used;
	}
	/**
	 * Opens the menu somewhere
	 * @param position Position where to open the menu. Can be a mouse event, or a node that the menu is spawned below.
	 * @param context Context for the click events inside the menu
	 */
	open(position?: MenuOpenPositionAnchor, context?: any): this {
		if (this.onOpen) this.onOpen(position, context);

		if (position instanceof Event && 'changedTouches' in position) {
			convertTouchEvent(position);
		}
		let last_context = context;
		var scope = this;
		var ctxmenu = this.node;
		if (open_menu) {
			open_menu.hide()
		}
		document.body.append(this.node);

		ctxmenu.replaceChildren();

		function createChildList(object: MenuParentItem, node: HTMLElement, list: MenuItem[]): number
		function createChildList(object: MenuParentItem & {children: MenuItem[] | ((context: any) => MenuItem[])}, node: HTMLElement): number
		function createChildList(object: MenuParentItem & {children: MenuItem[] | ((context: any) => MenuItem[])}, node: HTMLElement, list?: MenuItem[]): number {
			if (!list) {
				if (typeof object.children == 'function') {
					list = object.children(context)
				} else if (object.children) {
					list = object.children
				}
			}
			node.querySelectorAll('ul.contextMenu.sub').forEach(node => node.remove());
			if (list.length) {
				let childlist = Interface.createElement('ul', {class: 'contextMenu sub'}) as HTMLUListElement;

				populateList(list, childlist, 'searchable' in object && object.searchable);

				if ((typeof (object as any).click == 'function' || object instanceof Tool) && (object instanceof Action == false || object.side_menu)) {
					if (node.querySelector(':scope > .menu_more_button') == null) {
						node.classList.add('hybrid_parent');
						let more_button = Interface.createElement('div', {class: 'menu_more_button'}, Blockbench.getIconNode('more_horiz'));
						node.append(more_button);
						more_button.addEventListener('mouseenter', e => {
							scope.hover(node, e, true);
						})
						more_button.addEventListener('mouseleave', e => {
							if (node.matches(':hover') && !childlist.matches(':hover')) {
								scope.hover(node, e);
							}
						})
					}
				} else {
					node.classList.add('parent');
				}
				node.append(childlist)
				return childlist.childElementCount;
			}
			return 0;
		}
		function populateList(list: MenuItem[], menu_node: HTMLUListElement, searchable?: boolean) {
			
			if (searchable) {
				let display_limit = 256;
				let input = Interface.createElement('input', {type: 'text', placeholder: tl('generic.search'), inputmode: 'search'}) as HTMLInputElement;
				let search_button = Interface.createElement('div', {}, Blockbench.getIconNode('search'));
				let search_bar = Interface.createElement('li', {class: 'menu_search_bar'}, [input, search_button]);
				menu_node.append(search_bar);
				
				let object_list = [];
				list.forEach(function(s2: MenuItem, i) {
					let {node, item} = getAndAppendMenuNode(s2, menu_node);
					if (!node) return;
					object_list.push({
						object: s2,
						node: node,
						id: item?.id,
						name: item?.name,
						description: item?.description,
					})
				})
				search_button.onclick = (e) => {
					input.value = '';
					input.oninput(e);
				}
				input.oninput = (e) => {
					let search_term = input.value.toUpperCase();
					search_button.firstElementChild.replaceWith(Blockbench.getIconNode(search_term ? 'clear' : 'search'));

					object_list.forEach(item => {
						item.node.remove();
					})
					let count = 0;
					for (let item of object_list) {
						if (count > display_limit) break;
						if (
							typeof item.object == 'string' ||
							item.object.always_show ||
							(item.id && item.id.toUpperCase().includes(search_term)) ||
							(item.name && item.name.toUpperCase().includes(search_term)) ||
							(item.description && item.description.toUpperCase().includes(search_term))
						) {
							menu_node.append(item.node);
							count++;
						}
					}
				}
				input.oninput(0 as any);
				if (menu_node == ctxmenu) {
					input.focus();
				}

			} else {
				list.forEach((object) => {
					getAndAppendMenuNode(object, menu_node);
				})
			}
			if (menu_node.lastElementChild?.classList.contains('menu_separator')) {
				menu_node.lastElementChild.remove();
			}

			let is_scrollable = [...menu_node.childNodes].some((node: HTMLElement) => (
				node.classList.contains('parent') || node.classList.contains('hybrid_parent'))
			) == false;
			menu_node.classList.toggle('scrollable', is_scrollable);
		}

		function getAndAppendMenuNode(item: MenuItem, parent_ul: HTMLUListElement): {node: HTMLElement, item?: ResolvedMenuItem} {

			if (typeof item == 'object' && 'context' in item) {
				last_context = context;
				context = item.context;
			}
			let scope_context = context;
			var entry;
			if (item === '_') {
				item = new MenuSeparator();
			} else if (typeof item == 'string' && item.startsWith('#')) {
				item = new MenuSeparator(item.substring(1));
			}
			if (item instanceof MenuSeparator) {
				entry = item.menu_node;
				var last = parent_ul.lastElementChild
				if (last && !last.classList.contains('menu_separator')) {
					parent_ul.append(entry)
				}
				return {node: entry};
			}
			if (typeof item == 'string' && BarItems[item]) {
				item = BarItems[item] as Action;
			}
			if (typeof item === 'function') {
				item = item(scope_context);
			}
			if (item == undefined || (typeof item == 'object' && 'condition' in item && !Condition(item.condition, scope_context))) return;

			if (item instanceof Action) {

				entry = item.menu_node;

				entry.classList.remove('focused', 'opened');

				//Submenu
				if (typeof item.children == 'function' || typeof item.children == 'object') {
					createChildList(item as (MenuParentItem & {children: any}), entry)
				} else {
					if (item.side_menu instanceof Menu) {
						let content_list = typeof item.side_menu.structure == 'function' ? item.side_menu.structure(scope_context) : item.side_menu.structure;
						createChildList(item, entry, content_list);

					} else if (item.side_menu instanceof Dialog) {
						createChildList(item, entry, [
							{
								name: 'menu.options',
								icon: 'web_asset',
								click() {
									item.side_menu.show();
								}
							}
						]);
					}
				}

				parent_ul.append(entry)

			} else if (item instanceof BarSelect) {
				
				if (typeof item.icon === 'function') {
					var icon = Blockbench.getIconNode(item.icon(scope_context), item.color)
				} else {
					var icon = Blockbench.getIconNode(item.icon, item.color)
				}
				entry = Interface.createElement('li', {title: item.description && tl(item.description), menu_item: item.id}, Interface.createElement('span', {}, tl(item.name)));
				entry.prepend(icon)

				//Submenu
				let children = [];
				for (let key in item.options) {
					let val = item.options[key];
					if (!val) continue;
					children.push({
						name: item.getNameFor(key),
						id: key,
						icon: (val as any).icon || ((item.value == key) ? 'far.fa-dot-circle' : 'far.fa-circle'),
						condition: (val as any).condition,
						click: (e: MouseEvent) => {
							item.set(key);
							if (item.onChange) {
								item.onChange(item, e);
							}
						}
					})
				}

				let child_count = createChildList({children} as any, entry);

				if (child_count !== 0 || typeof (item as any).click === 'function') {
					parent_ul.append(entry)
				}
				entry.addEventListener('mouseenter', function(e) {
					scope.hover(entry, e);
				})

			} else if (item instanceof NumSlider) {
				let trigger = {
					name: item.name,
					description: item.description,
					icon: 'code',
					click() {
						let settings: NumSliderOptions["settings"] = {};
						if (item.settings) {
							settings = {
								min: item.settings.min,
								max: item.settings.max,
								step: item.settings.step
							}
							if (typeof item.settings.interval == 'function') {
								settings.step = item.settings.interval();
							}
						}
						new Dialog(item.id, {
							title: item.name,
							width: 360,
							form: {
								value: {label: item.name, type: 'number', value: item.get(), ...settings}
							},
							onConfirm(result) {
								if (typeof item.onBefore === 'function') {
									item.onBefore();
								}
								item.change(n => result.value);
								item.update();
								if (typeof item.onAfter === 'function') {
									item.onAfter();
								}
							}
						}).show();
					}
				}
				return getAndAppendMenuNode(trigger, parent_ul);
				
				/*let icon = Blockbench.getIconNode(s.icon, s.color);
				let numeric_input = new Interface.CustomElements.NumericInput(s.id, {
					value: s.get(),
					min: s.settings?.min, max: s.settings?.max,
					onChange(value) {
						if (typeof s.onBefore === 'function') {
							s.onBefore()
						}
						s.change(() => value);
						if (typeof s.onAfter === 'function') {
							s.onAfter()
						}
						s.update();
					}
				});
				entry = Interface.createElement('li', {title: s.description && tl(s.description), menu_item: s.id}, [
					Interface.createElement('span', {}, tl(s.name)),
					numeric_input.node
				]);
				entry.prepend(icon);

				parent.append(entry);

				$(entry).mouseenter(function(e) {
					scope.hover(this, e)
				})
				*/
			} else if (item instanceof HTMLElement) {
				parent_ul.append(item);

			} else if (typeof item === 'object') {
				let menu_item = item as CustomMenuItem;

				let child_count;
				if (typeof menu_item.icon === 'function') {
					var icon = Blockbench.getIconNode(menu_item.icon(scope_context), menu_item.color)
				} else {
					var icon = Blockbench.getIconNode(menu_item.icon, menu_item.color)
				}
				entry = Interface.createElement('li', {title: menu_item.description && tl(menu_item.description), menu_item: menu_item.id}, Interface.createElement('span', {}, tl(menu_item.name)));
				entry.prepend(icon);
				if (menu_item.marked && Condition(menu_item.marked, scope_context)) {
					entry.classList.add('marked');
				}
				if (menu_item.keybind) {
					let label = document.createElement('label') as HTMLLabelElement;
					label.classList.add('keybinding_label')
					label.innerText = menu_item.keybind?.toString() || '';
					entry.append(label);
				}
				if (typeof menu_item.click === 'function') {
					entry.addEventListener('click', e => {
						if (e.target == entry) {
							menu_item.click(scope_context, e)
						}
					})
				}
				//Submenu
				if (typeof menu_item.children == 'function' || typeof menu_item.children == 'object') {
					child_count = createChildList(menu_item as MenuParentItem & {children: any}, entry);
				}
				if (child_count !== 0 || typeof menu_item.click === 'function') {
					parent_ul.append(entry)
				}
				addEventListeners(entry, 'mouseenter mouseover', (e) => {
					if ((e.target as HTMLElement).classList.contains('menu_separator')) return;
					if ((e.target as HTMLElement).classList.contains('contextMenu')) return;
					scope.hover(entry, e);
				})
			}
			//Highlight
			if (scope.highlight_action == item && entry) {
				let obj = entry;
				while (obj && obj.nodeName == 'LI') {
					obj.classList.add('highlighted');
					obj = obj.parentElement.parentElement;
				}
			}
			// @ts-expect-error
			if (item.context && last_context != context) context = last_context;

			let result_item = (typeof item == 'string' || typeof item == 'function' || item instanceof MenuSeparator) ? undefined : item;
			return {node: entry, item: result_item};
		}

		let content_list = typeof this.structure == 'function' ? this.structure(context) : this.structure;
		populateList(content_list, ctxmenu, this.options.searchable);

		let el_width = ctxmenu.clientWidth;
		let el_height = ctxmenu.clientHeight;
		let top_gap = 26;
		if (Blockbench.isMobile && this instanceof BarMenu) {
			top_gap = window.innerHeight > 400 ? 106 : 56;
		}
		let window_height = window.innerHeight - top_gap;

		if (position instanceof Event && position.clientX !== undefined) {
			var offset_left = position.clientX
			var offset_top  = position.clientY+1

		} else if (position == document.body) {
			var offset_left = (document.body.clientWidth-el_width)/2
			var offset_top  = (document.body.clientHeight-el_height)/2

		} else if (position == 'mouse') {
			var offset_left = mouse_pos.x;
			var offset_top  = mouse_pos.y;

		} else {
			if (!position && this instanceof BarMenu) {
				position = this.label
			} else if (position instanceof HTMLElement && position.parentElement.classList.contains('tool')) {
				position = position.parentElement;
			}
			let offset = $(position).offset();
			var offset_left = offset.left;
			var offset_top  = offset.top + (position instanceof HTMLElement ? position.offsetHeight : 0);
		}

		if (offset_left > window.innerWidth - el_width) {
			offset_left -= el_width
			if (position instanceof HTMLElement && position.clientWidth) offset_left += position.clientWidth;
			if (offset_left < 0) offset_left = 0;
		}
		if (offset_top > window_height - el_height ) {
			if (el_height < offset_top - 50) {
				// Snap to element top
				offset_top -= el_height;
				if (position instanceof HTMLElement) {
					offset_top -= position.clientHeight;
				}
			} else {
				// Move up
				offset_top = window_height - el_height;
			}
		}
		offset_top = Math.max(offset_top, top_gap);

		ctxmenu.style.left = offset_left+'px';
		ctxmenu.style.top =  offset_top +'px';

		if (el_height > window_height) {
			handleMenuOverflow(ctxmenu);
		}

		scope.node.onclick = (ev) => {
			let target = ev.target as HTMLElement;
			if (
				target.classList.contains('parent') ||
				(target.parentNode && (target.parentNode as HTMLElement).classList.contains('parent')) ||
				target.classList.contains('menu_search_bar') ||
				(target.parentNode && (target.parentNode as HTMLElement).classList.contains('menu_search_bar'))
			) {} else {
				if (this.options.keep_open) {
					this.hide()
					this.open(position, context);
				} else {
					this.hide()
				}
			}
		}

		if (this instanceof BarMenu) {
			MenuBar.open = this;
			this.label.classList.add('opened');
		}
		window.open_menu = this;
		Menu.open = this;
		return this;
	}
	/**
	 * Alias for .open()
	 */
	show(position?: MenuOpenPositionAnchor, context?: any): this
	show(...args: any[]) {
		return this.open(...args as any);
	}
	/**
	 * Closes the menu if it's open
	 */
	hide(): this {
		if (this.onClose) this.onClose();
		$(this.node).find('li.highlighted').removeClass('highlighted');
		this.node.remove()
		window.open_menu = null;
		Menu.open = null;
		return this;
	}
	/**
	 * @deprecated
	 */
	conditionMet() {
		return Condition(this.condition);
	}
	/**
	 * Adds an action to the menu structure
	 * @param action Action to add
	 * @param path Path pointing to the location. Use the ID of each level of the menu, or index within a level, separated by a point. For example, `export.0` places the action at the top position of the Export submenu.
	 */
	addAction(action: Action | CustomMenuItem | '_', path: string | number = ''): void {
		if (this.structure instanceof Array == false) return;
		if (typeof path !== 'string') path = path.toString();
		let track = path.split('.')

		function traverse(arr, layer) {
			if (track.length === layer || track[layer] === '' || !isNaN(parseInt(track[layer])) || (track[layer][0] == '#')) {
				let index = arr.length;
				if (track[layer] !== '' && track.length !== layer) {
					if (track[layer].startsWith('#')) {
						// Group Anchor
						let group = track[layer].substring(1);
						let group_match = false;
						index = 0;
						for (let item of arr) {
							if (item instanceof MenuSeparator) {
								if (item.id == group) {
									group_match = true;
								} else if (group_match && item.id != group) {
									break;
								}
							}
							index++;
						}
					} else {
						index = parseInt(track[layer])
					}
				}
				arr.splice(index, 0, action)
			} else {
				for (let i = 0; i < arr.length; i++) {
					let item = arr[i]
					if (item.children instanceof Array && item.id === track[layer] && layer < 20) {
						traverse(item.children, layer+1);
						break;
					}
				}
			}
		}
		traverse(this.structure, 0)
		if (typeof action == 'object' && 'menus' in action) {
			action.menus.push({menu: this, path});
		}
	}
	/**
	 * Remove an action or menu item from the menu
	 * @param path Path pointing to the location. Use the ID of each level of the menu, or index within a level, or item ID, separated by a point. For example, `export.export_special_format` removes the action "Export Special Format" from the Export submenu.
	 */
	removeAction(path: string | Action): void {
		if (this.structure instanceof Array == false) return;
		var scope = this;
		if (path instanceof Action) {
			let action = path;
			this.structure.remove(action);
			this.structure.remove(action.id);
			action.menus.remove(this);
		} else if (this.structure.includes(path)) {
			this.structure.remove(path);
		}
		if (path === undefined) path = '';
		let path_arr = [];
		if (typeof path == 'string') {
			path_arr = path.split('.');
		}
		if (path_arr instanceof Array == false) return;

		function traverse(arr, layer) {
			if (!isNaN(parseInt(path_arr[layer]))) {
				let result = arr[parseInt(path_arr[layer])]

			} else if (typeof path_arr[layer] === 'string') {
				var i = arr.length-1;
				while (i >= 0) {
					var item = arr[i]
					if (item.id === path_arr[layer] && layer < 20) {
						if (layer === path_arr.length-1) {
							var action = arr.splice(i, 1)[0]
							if (action instanceof Action) {
								for (var i = action.menus.length-1; i >= 0; i--) {
									if (action.menus[i].menu == scope) {
										action.menus.splice(i, 1)
									}
								}
							}
						} else if (item.children) {
							traverse(item.children, layer+1)
						}
					}
					i--;
				}
			}
		}
		traverse(this.structure, 0)
	}
	/**
	 * @deprecated Use removeAction instead
	 */
	deleteItem(rm_item: Action): void {
		var scope = this;

		function traverse(arr: any) {
			arr.forEachReverse((item, i) => {
				if (item === rm_item || item === rm_item.id) {
					arr.splice(i, 1)
				} else if (item && item.children instanceof Array) {
					traverse(item.children)
				}
			})
		}
		traverse(this.structure)
		rm_item.menus.remove(scope)
	}
	delete() {
		this.node.remove()
	}
	static open: Menu | null = null;
	static closed_in_this_click?: string
}

export function preventContextMenu() {
	Blockbench.addFlag('no_context_menu');
	setTimeout(() => {
		Blockbench.removeFlag('no_context_menu');
	}, 20);
}

const global = {
	MenuSeparator,
	Menu,
	preventContextMenu,
	open_menu: null
}
declare global {
	type Menu = import('./menu').Menu
	const Menu: typeof global.Menu
	type MenuSeparator = import('./menu').MenuSeparator
	const MenuSeparator: typeof global.MenuSeparator
	function preventContextMenu(): void
	let open_menu: Menu | null
	interface Window {
		open_menu: Menu | null
	}
}
Object.assign(window, global);
