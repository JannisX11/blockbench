var open_menu = null;

function handleMenuOverflow(node) {
	node = node.get(0);
	if (!node) return;
	function offset(amount) {
		let top = parseInt(node.style.top);
		let offset = top - $(node).offset().top;
		top = Math.clamp(
			top + amount,
			window.innerHeight - node.clientHeight + offset,
			offset + 26
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
		this.node = document.createElement('ul');
		this.node.classList.add('contextMenu');
		this.structure = structure;
		this.options = options || {};
		this.onOpen = this.options.onOpen;
		this.onClose = this.options.onClose;
	}
	hover(node, event, expand) {
		if (event) event.stopPropagation()
		$(open_menu.node).find('li.focused').removeClass('focused')
		$(open_menu.node).find('li.opened').removeClass('opened')
		var obj = $(node)
		obj.addClass('focused')
		obj.parents('li.parent, li.hybrid_parent').addClass('opened')

		if (obj.hasClass('parent') || (expand && obj.hasClass('hybrid_parent'))) {
			var childlist = obj.find('> ul.contextMenu.sub')

			if (expand) obj.addClass('opened');

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

			let window_height = window.innerHeight - 26;

			if (el_height > window_height) {
				childlist.css('margin-top', '0').css('top', '0')
				childlist.css('top', (-childlist.offset().top + 26) + 'px')
				handleMenuOverflow(childlist);

			} else if (offset.top + el_height > window_height) {
				childlist.css('margin-top', 26-childlist.height() + 'px')
				if (childlist.offset().top < 26) {
					childlist.offset({top: 26})
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
			obj.find('li.focused').click()
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
		var scope = this;
		var ctxmenu = $(this.node)
		if (open_menu) {
			open_menu.hide()
		}
		$('body').append(ctxmenu)

		ctxmenu.children().detach()

		function createChildList(object, node, list) {
			if (!list && typeof object.children == 'function') {
				list = object.children(context)
			} else if (!list) {
				list = object.children
			}
			node.find('ul.contextMenu.sub').detach();
			if (list.length) {
				var childlist = $('<ul class="contextMenu sub"></ul>')

				populateList(list, childlist, object.searchable);

				if ((typeof object.click == 'function' || object instanceof Tool) && (object instanceof Action == false || object.side_menu)) {
					if (node.find('> .menu_more_button').length == 0) {
						node.addClass('hybrid_parent');
						let more_button = Interface.createElement('div', {class: 'menu_more_button'}, Blockbench.getIconNode('more_horiz'));
						node.append(more_button);
						$(more_button).mouseenter(e => {
							scope.hover(node.get(0), e, true);
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
				let input = Interface.createElement('input', {type: 'text', placeholder: tl('generic.search')});
				let search_button = Interface.createElement('div', {}, Blockbench.getIconNode('search'));
				let search_bar = Interface.createElement('li', {class: 'menu_search_bar'}, [input, search_button]);
				menu_node.append(search_bar);
				menu_node.append(Interface.createElement('li', {class: 'menu_separator'}));
				
				let object_list = [];
				list.forEach(function(s2, i) {
					let jq_node = getEntry(s2, menu_node);
					if (!jq_node) return;
					object_list.push({
						object: s2,
						node: jq_node[0] || jq_node,
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
					object_list.forEach(item => {
						if (
							typeof item.object == 'string' ||
							item.object.always_show ||
							(item.id && item.id.toUpperCase().includes(search_term)) ||
							(item.name && item.name.toUpperCase().includes(search_term)) ||
							(item.description && item.description.toUpperCase().includes(search_term))
						) {
							menu_node.append(item.node);
						}
					})
				}
				if (menu_node == ctxmenu) {
					input.focus();
				}

			} else {
				list.forEach((object) => {
					getEntry(object, menu_node);
				})
			}
			var last = menu_node.children().last();
			if (last.length && last.hasClass('menu_separator')) {
				last.remove()
			}
		}

		function getEntry(s, parent) {

			var entry;
			if (s === '_') {
				entry = new MenuSeparator().menu_node
				var last = parent.children().last()
				if (last.length && !last.hasClass('menu_separator')) {
					parent.append(entry)
				}
				return entry;
			}
			if (typeof s == 'string' && BarItems[s]) {
				s = BarItems[s];
			}
			if (!Condition(s.condition, context)) return;

			if (s instanceof Action) {

				entry = $(s.menu_node)

				entry.removeClass('focused')
				entry.off('click')
				entry.off('mouseenter mousedown')
				entry.on('mouseenter mousedown', function(e) {
					if (this == e.target) {
						scope.hover(this, e)
					}
				})
				//Submenu
				if (typeof s.children == 'function' || typeof s.children == 'object') {
					createChildList(s, entry)
				} else {
					entry.on('click', (e) => {
						if (!(e.target == entry[0] || e.target.parentElement == entry[0])) return;
						s.trigger(e)
					});
					if (s.side_menu) {
						let content_list = typeof s.side_menu.structure == 'function' ? s.side_menu.structure(context) : s.side_menu.structure;
						createChildList(s, entry, content_list);
					}
				}

				parent.append(entry)

			} else if (s instanceof BarSelect) {
				
				if (typeof s.icon === 'function') {
					var icon = Blockbench.getIconNode(s.icon(context), s.color)
				} else {
					var icon = Blockbench.getIconNode(s.icon, s.color)
				}
				entry = $(Interface.createElement('li', {title: s.description && tl(s.description), menu_item: s.id}, Interface.createElement('span', {}, tl(s.name))));
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
					parent.append(entry)
				}
				entry.mouseenter(function(e) {
					scope.hover(this, e)
				})

			} else if (s instanceof HTMLElement) {
				parent.append(s);

			} else if (typeof s === 'object') {
				
				let child_count;
				if (typeof s.icon === 'function') {
					var icon = Blockbench.getIconNode(s.icon(context), s.color)
				} else {
					var icon = Blockbench.getIconNode(s.icon, s.color)
				}
				entry = $(Interface.createElement('li', {title: s.description && tl(s.description), menu_item: s.id}, Interface.createElement('span', {}, tl(s.name))));
				entry.prepend(icon);
				if (s.keybind) {
					let label = document.createElement('label');
					label.classList.add('keybinding_label')
					label.innerText = s.keybind || '';
					entry.append(label);
				}
				if (typeof s.click === 'function') {
					entry.on('click', e => {
						if (e.target == entry.get(0)) {
							s.click(context, e)
						}
					})
				}
				//Submenu
				if (typeof s.children == 'function' || typeof s.children == 'object') {
					child_count = createChildList(s, entry);
				}
				if (child_count !== 0 || typeof s.click === 'function') {
					parent.append(entry)
				}
				entry.mouseenter(function(e) {
					scope.hover(this, e)
				})
			}
			//Highlight
			if (scope.highlight_action == s && entry) {
				let obj = entry;
				while (obj[0] && obj[0].nodeName == 'LI') {
					obj.addClass('highlighted');
					obj = obj.parent().parent();
				}
			}
			return entry;
		}

		let content_list = typeof this.structure == 'function' ? this.structure(context) : this.structure;
		populateList(content_list, ctxmenu, this.options.searchable);

		var el_width = ctxmenu.width()
		var el_height = ctxmenu.height()
		let window_height = window.innerHeight - 26;

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
		if (offset_top  > window_height - el_height ) {
			offset_top -= el_height;
			if (position instanceof HTMLElement) {
				offset_top -= position.clientHeight;
			}
		}
		offset_top = Math.clamp(offset_top, 26)

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
			$(scope.label).addClass('opened')
		}
		open_menu = scope;
		return scope;
	}
	show(position) {
		return this.open(position);
	}
	hide() {
		if (this.onClose) this.onClose();
		$(this.node).find('li.highlighted').removeClass('highlighted');
		$(this.node).detach()
		open_menu = null;
		return this;
	}
	conditionMet() {
		return Condition(this.condition);
	}
	addAction(action, path) {
		if (this.structure instanceof Array == false) return;
		if (path === undefined) path = '';
		if (typeof path !== 'string') path = path.toString();
		var track = path.split('.')

		function traverse(arr, layer) {
			if (track.length === layer || track[layer] === '' || !isNaN(parseInt(track[layer]))) {
				var index = arr.length;
				if (track[layer] !== '' && track.length !== layer) {
					index = parseInt(track[layer])
				}
				arr.splice(index, 0, action)
			} else {
				for (var i = 0; i < arr.length; i++) {
					var item = arr[i]
					if (item.children && item.children.length > 0 && item.id === track[layer] && layer < 20) {
						traverse(item.children, layer+1)
						i = 1000
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
		}
		if (path === undefined) path = '';
		if (typeof path == 'string') path = path.split('.');

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
