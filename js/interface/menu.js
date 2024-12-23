var open_menu = null;
class MenuSeparator {
	constructor(id, label) {
		this.id = id || '';
		this.menu_node = Interface.createElement('li', {class: 'menu_separator', menu_separator_id: id});
		if (label) {
			label = tl(label);
			this.menu_node.append(Interface.createElement('label', {}, label));
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
class Menu {
	constructor(id, structure, options) {
		if (typeof id !== 'string') {
			options = structure;
			structure = id;
		}
		this.id = typeof id == 'string' ? id : '';
		this.children = [];
		this.structure = structure;
		this.options = options || {};
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
	hover(node, event, expand) {
		if (node.classList.contains('focused') && !expand) return;
		if (event) event.stopPropagation()
		$(open_menu.node).find('li.focused').removeClass('focused')
		$(open_menu.node).find('li.opened').removeClass('opened')
		var obj = $(node)
		node.classList.add('focused')
		obj.parents('li.parent, li.hybrid_parent').addClass('opened')

		if (obj.hasClass('parent') || (expand && obj.hasClass('hybrid_parent'))) {
			var childlist = obj.find('> ul.contextMenu.sub')

			if (expand) node.classList.add('opened');

			var p_width = obj.outerWidth()
			childlist.css('left', p_width + 'px')
			var el_width = childlist.width()
			var offset = childlist.offset()
			var el_height = childlist.height()

			if (offset.left + el_width > window.innerWidth) {
				if (Blockbench.isMobile) {
					childlist.css('visibility', 'hidden');
					setTimeout(() => {
						childlist.css('left', 0);
						childlist.css('visibility', 'visible');
					}, 100);
				} else {
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
	reveal(path) {

	}
	keyNavigate(e) {
		var scope = this;
		var used;
		var obj = $(this.node)
		if (e.which >= 37 && e.which <= 40) {

			let is_menu_bar = scope.type === 'bar_menu' && e.which%2;
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
					scope.hover(next.get(0))
				} else if (is_menu_bar) {
					var index = MenuBar.keys.indexOf(scope.id)
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
			if (scope && !this.options.keep_open) {
				//scope.hide()
			}
			used = true;
		} else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
			scope.hide()
			used = true;
		}
		return used;
	}
	open(position, context) {
		if (this.onOpen) this.onOpen(position, context);

		if (position && position.changedTouches) {
			convertTouchEvent(position);
		}
		let last_context = context;
		var scope = this;
		var ctxmenu = $(this.node)
		if (open_menu) {
			open_menu.hide()
		}
		document.body.append(this.node);

		ctxmenu.children().detach()

		function createChildList(object, node, list) {
			if (!list && typeof object.children == 'function') {
				list = object.children(context)
			} else if (!list) {
				list = object.children
			}
			node = $(node);
			node.find('ul.contextMenu.sub').detach();
			if (list.length) {
				var childlist = $(Interface.createElement('ul', {class: 'contextMenu sub'}));

				populateList(list, childlist, object.searchable);

				if ((typeof object.click == 'function' || object instanceof Tool) && (object instanceof Action == false || object.side_menu)) {
					if (node.find('> .menu_more_button').length == 0) {
						node.addClass('hybrid_parent');
						let more_button = Interface.createElement('div', {class: 'menu_more_button'}, Blockbench.getIconNode('more_horiz'));
						node.append(more_button);
						more_button.addEventListener('mouseenter', e => {
							scope.hover(node.get(0), e, true);
						})
						more_button.addEventListener('mouseleave', e => {
							if (node.is(':hover') && !childlist.is(':hover')) {
								scope.hover(node.get(0), e);
							}
						})
					}
				} else {
					node.addClass('parent');
				}
				node.append(childlist)
				return childlist.children().length;
			}
			return 0;
		}
		function populateList(list, menu_node, searchable) {
			
			if (searchable) {
				let display_limit = 256;
				let input = Interface.createElement('input', {type: 'text', placeholder: tl('generic.search'), inputmode: 'search'});
				let search_button = Interface.createElement('div', {}, Blockbench.getIconNode('search'));
				let search_bar = Interface.createElement('li', {class: 'menu_search_bar'}, [input, search_button]);
				menu_node.append(search_bar);
				
				let object_list = [];
				list.forEach(function(s2, i) {
					let node = getEntry(s2, menu_node);
					if (!node) return;
					object_list.push({
						object: s2,
						node: node,
						id: s2.id,
						name: s2.name,
						description: s2.description,
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
						$(item.node).detach();
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
				input.oninput(0);
				if (menu_node == ctxmenu) {
					input.focus();
				}

			} else {
				list.forEach((object) => {
					getEntry(object, menu_node);
				})
			}
			let nodes = menu_node.children();
			if (nodes.length && nodes.last().hasClass('menu_separator')) {
				nodes.last().remove();
			}

			let is_scrollable = !nodes.toArray().find(node => node.classList.contains('parent') || node.classList.contains('hybrid_parent'));
			menu_node.toggleClass('scrollable', is_scrollable);
		}

		function getEntry(s, parent) {

			if (s.context) {
				last_context = context;
				context = s.context;
			}
			let scope_context = context;
			var entry;
			if (s === '_') {
				s = new MenuSeparator();
			} else if (typeof s == 'string' && s.startsWith('#')) {
				s = new MenuSeparator(s.substring(1));
			}
			if (s instanceof MenuSeparator) {
				entry = s.menu_node;
				var last = parent.children().last()
				if (last.length && !last.hasClass('menu_separator')) {
					parent[0].append(entry)
				}
				return entry;
			}
			if (typeof s == 'string' && BarItems[s]) {
				s = BarItems[s];
			}
			if (typeof s === 'function') {
				s = s(scope_context);
			}
			if (s == undefined || !Condition(s.condition, scope_context)) return;

			if (s instanceof Action) {

				entry = s.menu_node;

				entry.classList.remove('focused', 'opened');

				//Submenu
				if (typeof s.children == 'function' || typeof s.children == 'object') {
					createChildList(s, entry)
				} else {
					if (s.side_menu instanceof Menu) {
						let content_list = typeof s.side_menu.structure == 'function' ? s.side_menu.structure(scope_context) : s.side_menu.structure;
						createChildList(s, entry, content_list);

					} else if (s.side_menu instanceof Dialog) {
						createChildList(s, entry, [
							{
								name: 'menu.options',
								icon: 'web_asset',
								click() {
									s.side_menu.show();
								}
							}
						]);
					}
				}

				parent[0].append(entry)

			} else if (s instanceof BarSelect) {
				
				if (typeof s.icon === 'function') {
					var icon = Blockbench.getIconNode(s.icon(scope_context), s.color)
				} else {
					var icon = Blockbench.getIconNode(s.icon, s.color)
				}
				entry = Interface.createElement('li', {title: s.description && tl(s.description), menu_item: s.id}, Interface.createElement('span', {}, tl(s.name)));
				entry.prepend(icon)

				//Submenu
				var children = [];
				for (var key in s.options) {

					let val = s.options[key];
					if (val) {
						(function() {
							var save_key = key;
							children.push({
								name: s.getNameFor(key),
								id: key,
								icon: val.icon || ((s.value == save_key) ? 'far.fa-dot-circle' : 'far.fa-circle'),
								condition: val.condition,
								click: (e) => {
									s.set(save_key);
									if (s.onChange) {
										s.onChange(s, e);
									}
								}
							})
						})()
					}
				}

				let child_count = createChildList({children}, entry)

				if (child_count !== 0 || typeof s.click === 'function') {
					parent[0].append(entry)
				}
				entry.addEventListener('mouseenter', function(e) {
					scope.hover(entry, e);
				})

			} else if (s instanceof NumSlider) {
				let item = s;
				let trigger = {
					name: item.name,
					description: item.description,
					icon: 'code',
					click() {
						let settings = {};
						if (item.settings) {
							settings = {
								min: item.settings.min,
								max: item.settings.max,
								step: item.settings.step
							}
							if (typeof item.settings.interval == 'function') {
								settings.step = item.settings.interval(event);
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
				return getEntry(trigger, parent);
				
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

				parent[0].append(entry);

				$(entry).mouseenter(function(e) {
					scope.hover(this, e)
				})
				*/
			} else if (s instanceof HTMLElement) {
				parent[0].append(s);

			} else if (typeof s === 'object') {
				
				let child_count;
				if (typeof s.icon === 'function') {
					var icon = Blockbench.getIconNode(s.icon(scope_context), s.color)
				} else {
					var icon = Blockbench.getIconNode(s.icon, s.color)
				}
				entry = Interface.createElement('li', {title: s.description && tl(s.description), menu_item: s.id}, Interface.createElement('span', {}, tl(s.name)));
				entry.prepend(icon);
				if (s.marked && Condition(s.marked, scope_context)) {
					entry.classList.add('marked');
				}
				if (s.keybind) {
					let label = document.createElement('label');
					label.classList.add('keybinding_label')
					label.innerText = s.keybind || '';
					entry.append(label);
				}
				if (typeof s.click === 'function') {
					entry.addEventListener('click', e => {
						if (e.target == entry) {
							s.click(scope_context, e)
						}
					})
				}
				//Submenu
				if (typeof s.children == 'function' || typeof s.children == 'object') {
					child_count = createChildList(s, entry);
				}
				if (child_count !== 0 || typeof s.click === 'function') {
					parent[0].append(entry)
				}
				addEventListeners(entry, 'mouseenter mouseover', (e) => {
					if (e.target.classList.contains('menu_separator')) return;
					if (e.target.classList.contains('contextMenu')) return;
					scope.hover(entry, e);
				})
			}
			//Highlight
			if (scope.highlight_action == s && entry) {
				let obj = entry;
				while (obj && obj.nodeName == 'LI') {
					obj.classList.add('highlighted');
					obj = obj.parentElement.parentElement;
				}
			}
			if (s.context && last_context != context) context = last_context;
			return entry;
		}

		let content_list = typeof this.structure == 'function' ? this.structure(context) : this.structure;
		populateList(content_list, ctxmenu, this.options.searchable);

		let el_width = ctxmenu.width()
		let el_height = ctxmenu.height()
		let top_gap = 26;
		if (Blockbench.isMobile && this instanceof BarMenu) {
			top_gap = window.innerHeight > 400 ? 106 : 56;
		}
		let window_height = window.innerHeight - top_gap;

		if (position && position.clientX !== undefined) {
			var offset_left = position.clientX
			var offset_top  = position.clientY+1

		} else if (position == document.body) {
			var offset_left = (document.body.clientWidth-el_width)/2
			var offset_top  = (document.body.clientHeight-el_height)/2

		} else if (position == 'mouse') {
			var offset_left = mouse_pos.x;
			var offset_top  = mouse_pos.y;

		} else {
			if (!position && scope.type === 'bar_menu') {
				position = scope.label
			} else if (position && position.parentElement.classList.contains('tool')) {
				position = position.parentElement;
			}
			var offset_left = $(position).offset().left;
			var offset_top  = $(position).offset().top + position.offsetHeight;
		}

		if (offset_left > window.innerWidth - el_width) {
			offset_left -= el_width
			if (position && position.clientWidth) offset_left += position.clientWidth;
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

		ctxmenu.css('left', offset_left+'px')
		ctxmenu.css('top',  offset_top +'px')

		if (el_height > window_height) {
			handleMenuOverflow(ctxmenu);
		}

		scope.node.onclick = (ev) => {
			if (
				ev.target.classList.contains('parent') ||
				(ev.target.parentNode && ev.target.parentNode.classList.contains('parent')) ||
				ev.target.classList.contains('menu_search_bar') ||
				(ev.target.parentNode && ev.target.parentNode.classList.contains('menu_search_bar'))
			) {} else {
				if (this.options.keep_open) {
					this.hide()
					this.open(position, context);
				} else {
					this.hide()
				}
			}
		}

		if (scope.type === 'bar_menu') {
			MenuBar.open = scope
			scope.label.classList.add('opened');
		}
		open_menu = scope;
		Menu.open = this;
		return scope;
	}
	show(...args) {
		return this.open(...args);
	}
	hide() {
		if (this.onClose) this.onClose();
		$(this.node).find('li.highlighted').removeClass('highlighted');
		this.node.remove()
		open_menu = null;
		Menu.open = null;
		return this;
	}
	conditionMet() {
		return Condition(this.condition);
	}
	addAction(action, path = '') {
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
		if (action && action.menus) {
			action.menus.push({menu: this, path});
		}
	}
	removeAction(path) {
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
		if (typeof path == 'string') {
			path = path.split('.');
		}
		if (path instanceof Array == false) return;

		function traverse(arr, layer) {
			if (!isNaN(parseInt(path[layer]))) {
				result = arr[parseInt(path[layer])]

			} else if (typeof path[layer] === 'string') {
				var i = arr.length-1;
				while (i >= 0) {
					var item = arr[i]
					if (item.id === path[layer] && layer < 20) {
						if (layer === path.length-1) {
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
	deleteItem(rm_item) {
		var scope = this;

		function traverse(arr, layer) {
			arr.forEachReverse((item, i) => {
				if (item === rm_item || item === rm_item.id) {
					arr.splice(i, 1)
				} else if (item && item.children instanceof Array) {
					traverse(item.children)
				}
			})
		}
		traverse(this.structure, 0)
		rm_item.menus.remove(scope)
	}
}

function preventContextMenu() {
	Blockbench.addFlag('no_context_menu');
	setTimeout(() => {
		Blockbench.removeFlag('no_context_menu');
	}, 20);
}
