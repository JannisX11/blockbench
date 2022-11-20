var Toolbars, BarItems, Toolbox;
//Bars
class MenuSeparator {
	constructor() {
		this.menu_node = Interface.createElement('li', {class: 'menu_separator'});
	}
}
class BarItem {
	constructor(id, data) {
		this.id = id;
		if (!data.private) {
			if (this.id && !BarItems[this.id]) {
				BarItems[this.id] = this;
			} else {
				if (!BarItems[this.id]) {
					console.warn(`${this.constructor.name} ${this.id} has a duplicate ID`)
				} else {
					console.warn(`${this.constructor.name} defined without a vaild ID`)
				}
			}
		}
		this.name = tl('action.'+this.id)
		if (data.name) this.name = tl(data.name);

		this.description = tl('action.'+this.id+'.desc')
		if (data.description) {
			this.description = tl(data.description);
		} else {
			var key = `action.${this.id}.desc`;
			this.description = tl('action.'+this.id+'.desc')
			if (this.description == key) this.description = '';
		}
		this.color = data.color
		this.node;
		this.condition = data.condition;
		this.nodes = []
		this.toolbars = []
		//Key
		this.category = data.category ? data.category : 'misc'
		if (!data.private && this.condition !== false/*Rule out app/web only actions*/) {
			if (data.keybind) {
				this.default_keybind = data.keybind
			}
			if (Keybinds.stored[this.id]) {
				this.keybind = new Keybind().set(Keybinds.stored[this.id], this.default_keybind);
			} else {
				this.keybind = new Keybind().set(data.keybind);
			}
			this.keybind.setAction(this.id)
			this.work_in_dialog = data.work_in_dialog === true
			this.uses = 0;
			Keybinds.actions.push(this)
		}
	}
	conditionMet() {
		return Condition(this.condition)
	}
	addLabel(in_bar, action) {
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
					offset.right = offset.left + parseInt(j_tooltip.css('width').replace(/px/, '')) - window.innerWidth

					if (offset.right > 4) {
						j_tooltip.css('margin-left', -offset.right+'px')
					}				

					// description
					if (!j_description) return;

					j_description.css('margin-left', '-5px')
					var offset = j_description.offset()
					offset.right = offset.left + parseInt(j_description.css('width').replace(/px/, '')) - window.innerWidth

					if (offset.right > 4) {
						j_description.css('margin-left', -offset.right+'px')
					}

					// height
					if ((window.innerHeight - offset.top) < 28) {
						j_tooltip.css('margin-top', -2-j_tooltip.height()+'px');
						j_description.css('margin-top', '-51px');
					}
				}
			})
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
			})
		}
	}
	getNode(ignore_disconnected) {
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
			this.trigger(e)
		}
		this.nodes.push(clone);
		return clone;
	}
	toElement(destination) {
		$(destination).first().append(this.getNode())
		return this;
	}
	pushToolbar(bar, idx) {
		var scope = this;
		if (scope.uniqueNode && scope.toolbars.length) {
			for (var i = scope.toolbars.length-1; i >= 0; i--) {
				scope.toolbars[i].remove(scope)
			}
		}
		if (idx !== undefined) {
			bar.children.splice(idx, 0, this);
		} else {
			bar.children.push(this);
		}
		this.toolbars.safePush(bar)
	}
	delete() {
		var scope = this;
		this.toolbars.forEach(bar => {
			bar.remove(scope);
		})
		delete BarItems[this.id];
		Keybinds.actions.remove(this);
	}
}
class KeybindItem {
	constructor(id, data) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		this.id = id
		this.type = 'keybind_item'
		this.name =  tl(data.name || ('keybind.'+this.id))
		this.category = data.category ? data.category : 'misc'
		if (data.keybind) {
			this.default_keybind = data.keybind
		}
		if (Keybinds.stored[this.id]) {
			this.keybind = new Keybind().set(Keybinds.stored[this.id], this.default_keybind);
		} else {
			this.keybind = new Keybind().set(data.keybind);
		}

		Keybinds.actions.push(this)
		Keybinds.extra[this.id] = this;
		this.keybind.setAction(this.id)
	}
	delete() {
		Keybinds.actions.remove(this);
	}
}
class Action extends BarItem {
	constructor(id, data) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data)
		var scope = this;
		this.type = 'action'
		//Icon
		this.icon = data.icon

		if (data.linked_setting) {
			if (!data.name) this.name = tl(`settings.${data.linked_setting}`);
			if (!data.description) this.description = tl(`settings.${data.linked_setting}.desc`);
			this.linked_setting = data.linked_setting;
		}
		if (data.condition) this.condition = data.condition
		this.children = data.children;
		this.searchable = data.searchable;

		//Node
		if (!this.click) this.click = data.click
		this.icon_node = Blockbench.getIconNode(this.icon, this.color)
		this.icon_states = data.icon_states;
		this.node = document.createElement('div');
		this.node.classList.add('tool', this.id);
		this.node.append(this.icon_node);
		this.nodes = [this.node]
		this.menus = [];
		
		this.menu_node = Interface.createElement('li', {title: this.description || '', menu_item: id}, [
			this.icon_node.cloneNode(true),
			Interface.createElement('span', {}, this.name),
			Interface.createElement('label', {class: 'keybinding_label'}, this.keybind || '')
		]);

		this.addLabel(data.label)
		this.updateKeybindingLabel()

		if (data.side_menu) {
			this.side_menu = data.side_menu;
			this.node.classList.add('side_menu_tool');
			
			let open_node = Blockbench.getIconNode('arrow_drop_down');
			open_node.classList.add('action_more_options');
			open_node.onclick = e => {
				e.stopPropagation();
				this.side_menu.open(e.target.parentElement);
			}
			this.node.append(open_node);
		}

		this.node.onclick = (e) => {
			scope.trigger(e)
		}
	}
	trigger(event) {
		var scope = this;
		if (BARS.condition(scope.condition, scope)) {
			if (event && event.type === 'click' && event.altKey && scope.keybind) {
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
	updateKeybindingLabel() {
		this.menu_node.querySelector('.keybinding_label').textContent = this.keybind || '';
		this.nodes.forEach(node => {
			node.querySelector('.keybinding_label').textContent = this.keybind || '';
		});
		return this;
	}
	getNode(ignore_disconnected) {
		let clone = super.getNode(ignore_disconnected);
		if (this.side_menu) {
			let options = clone.querySelector('.action_more_options');
			if (options && !options.onclick) {
				options.onclick = e => {
					e.stopPropagation();
					this.side_menu.open(e.target.parentElement);
				}
			}
		}
		return clone;
	}
	setIcon(icon) {
		var scope = this;
		this.icon = icon
		this.icon_node = Blockbench.getIconNode(this.icon)
		$(this.menu_node).find('.icon').replaceWith(this.icon_node)

		this.nodes.forEach(function(n) {
			$(n).find('.icon').replaceWith($(scope.icon_node).clone())
		})
	}
	setName(name) {
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
class Tool extends Action {
	constructor(id, data) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data);
		var scope = this;
		this.type = 'tool'
		this.toolbar = data.toolbar;
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

		if (this.condition == undefined) {
			this.condition = function() {
				return !scope.modes || scope.modes.includes(Modes.id);
			}
		}
		this.onCanvasClick = data.onCanvasClick;
		this.onSelect = data.onSelect;
		this.onUnselect = data.onUnselect;
		this.node.onclick = () => {
			scope.select();
		}
	}
	select() {
		if (this === Toolbox.selected) return;
		if (Toolbox.selected) {
			Toolbox.selected.nodes.forEach(node => {
				node.classList.remove('enabled')
			})
			Toolbox.selected.menu_node.classList.remove('enabled')
			if (typeof Toolbox.selected.onUnselect == 'function') {
				Toolbox.selected.onUnselect()
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
			Canvas.updateAllFaces()
		}
		if (this.toolbar && Toolbars[this.toolbar]) {
			Toolbars[this.toolbar].toPlace('tool_options')
		} else {
			$('.toolbar_wrapper.tool_options > .toolbar').detach()
		}

		if (typeof this.onSelect == 'function') {
			this.onSelect()
		}
		Interface.preview.style.cursor = this.cursor ? this.cursor : 'default';
		this.nodes.forEach(node => {
			node.classList.add('enabled')
		})
		this.menu_node.classList.add('enabled')
		TickUpdates.selection = true;
		return this;
	}
	trigger(event) {
		if (BARS.condition(this.condition, this)) {
			this.select()
			return true;
		} else if (this.modes) {
			for (var i = 0; i < this.modes.length; i++) {
				var mode = Modes.options[this.modes[i]]
				if (mode && Condition(mode.condition)) {
					mode.select()
					this.select()
					return true;
				}
			}
		}
		return false;
	}
}
class Toggle extends Action {
	constructor(id, data) {
		super(id, data);
		this.type = 'toggle';
		this.value = data.default || false;
		if (this.linked_setting && settings[this.linked_setting]) {
			this.value = settings[this.linked_setting].value;
		}
		this.onChange = data.onChange;

		this.menu_icon_node = Blockbench.getIconNode('check_box_outline_blank');
		$(this.menu_node).find('.icon').replaceWith(this.menu_icon_node);

		this.updateEnabledState();
	}
	click() {
		this.value = !this.value;
		if (this.linked_setting && settings[this.linked_setting]) {
			let setting = settings[this.linked_setting];
			setting.value = this.value;
			if (setting.onChange) setting.onChange(setting.value);
			Settings.saveLocalStorages();
		}
		if (this.onChange) this.onChange(this.value);

		this.updateEnabledState();
	}
	setIcon(icon) {
		if (icon) {
			this.icon = icon;
			this.icon_node = Blockbench.getIconNode(this.icon);
			this.nodes.forEach(n => {
				$(n).find('.icon').replaceWith($(this.icon_node).clone());
			})
		}
	}
	updateEnabledState() {
		this.nodes.forEach(node => {
			node.classList.toggle('enabled', this.value);
		})
		this.menu_icon_node.innerText = this.value ? 'check_box' : 'check_box_outline_blank';
	}
}
class Widget extends BarItem {
	constructor(id, data) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data);
		this.type = 'widget';
		//this.uniqueNode = true;
	}
}
class NumSlider extends Widget {
	constructor(id, data) {
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
		this.uniqueNode = true;
		if (data.tool_setting) this.tool_setting = data.tool_setting;
		if (typeof data.get === 'function') this.get = data.get;
		this.onBefore = data.onBefore;
		this.onChange = data.onChange;
		this.onAfter = data.onAfter;
		if (typeof data.change === 'function') this.change = data.change;
		if (data.settings) {
			this.settings = data.settings;
			if (this.settings.default) {
				this.value = this.settings.default
			}
			this.interval = this.settings.step || this.settings.interval;

		} else {
			this.interval = function(event) {
				event = event||0;
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
			this.keybind.shift = null;
			this.keybind.label = this.keybind.getText();
		}
		var scope = this;
		this.node = Interface.createElement('div', {class: 'tool wide widget nslide_tool'}, [
			Interface.createElement('div', {class: 'nslide tab_target', 'n-action': this.id})
		])
		this.jq_outer = $(this.node)
		this.jq_inner = this.jq_outer.find('.nslide');

		if (this.color) {
			var css_color = 'xyz'.includes(this.color) ? `var(--color-axis-${this.color})` : this.color;
			this.node.style.setProperty('--corner-color', css_color);
			this.node.classList.add('is_colored');
		}

		this.addLabel(data.label);

		this.jq_inner
		.on('mousedown touchstart', async (event) => {
			if (scope.jq_inner.hasClass('editing')) return;
			
			let drag_event = await new Promise((resolve, reject) => {
				function move(e2) {
					removeEventListeners(document, 'mousemove touchmove', move);
					removeEventListeners(document, 'mouseup touchend', stop);
					resolve(e2);
				}
				function stop(e2) {
					removeEventListeners(document, 'mousemove touchmove', move);
					removeEventListeners(document, 'mouseup touchend', stop);
					if (event.target == event.target) scope.startInput(event)
					resolve(false);
				}
				addEventListeners(document, 'mousemove touchmove', move);
				addEventListeners(document, 'mouseup touchend', stop);
			})
			if (!drag_event) return;

			if (typeof scope.onBefore === 'function') {
				scope.onBefore()
			}
			convertTouchEvent(drag_event)
			let clientX = drag_event.clientX;
			scope.sliding = true;
			scope.pre = 0;
			scope.sliding_start_pos = drag_event.clientX;
			scope.last_value = scope.value;
			let move_calls = 0;

			if (!drag_event.touches) scope.jq_inner.get(0).requestPointerLock();

			function move(e) {
				convertTouchEvent(e)
				if (drag_event.touches) {
					clientX = e.clientX;
				} else {
					let limit = move_calls <= 2 ? 1 : 160;
					clientX += Math.clamp(e.movementX, -limit, limit);
				}
				scope.slide(clientX, e);
				move_calls++;
			}
			function stop(e) {
				removeEventListeners(document, 'mousemove touchmove', move);
				removeEventListeners(document, 'mouseup touchend', stop);
				document.exitPointerLock()
				Blockbench.setStatusBarText();
				delete scope.sliding;
				if (typeof scope.onAfter === 'function') {
					scope.onAfter(scope.value - scope.last_value)
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
		.on('contextmenu', event => {
			new Menu([
				{
					id: 'copy',
					name: 'action.copy',
					icon: 'fa-copy',
					click: () => {
						Clipbench.setText(this.value);
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
					click: () => {
						this.startInput()
						document.execCommand('paste');
						setTimeout(() => {
							this.stopInput();
						}, 20);
					}
				}
			]).open(event);
		});
		//Arrows
		this.jq_outer
		.on('mouseenter', function() {
			scope.jq_outer.append(
				'<div class="nslide_arrow na_left" ><i class="material-icons">navigate_before</i></div>'+
				'<div class="nslide_arrow na_right"><i class="material-icons">navigate_next</i></div>'
			)

			var n = limitNumber(scope.node.clientWidth/2-24, 6, 1000)

			scope.jq_outer.find('.nslide_arrow.na_left').click(function(e) {
				scope.arrow(-1, e)
			}).css('margin-left', (-n-24)+'px')

			scope.jq_outer.find('.nslide_arrow.na_right').click(function(e) {
				scope.arrow(1, e)
			}).css('margin-left', n+'px')
		})
		.on('mouseleave', function() {
			scope.jq_outer.find('.nslide_arrow').remove()
		})
	}
	startInput(e) {
		this.jq_inner.find('.nslide_arrow').remove()
		this.jq_inner.attr('contenteditable', 'true')
		this.jq_inner.addClass('editing')
		this.jq_inner.focus()
		document.execCommand('selectAll')
	}
	setWidth(width) {
		if (width) {
			this.width = width
		} else {
			width = this.width
		}
		this.node.style.width = width + 'px';
		return this;
	}
	getInterval(e) {
		if (typeof this.interval == 'function') {
			return this.interval(e);
		} else if (typeof this.interval === 'number') {
			return this.interval;
		} else {
			return 0;
		}
	}
	slide(clientX, event) {
		var offset = Math.round((clientX - this.sliding_start_pos)/30)
		var difference = (offset - this.pre) * this.getInterval(event);
		this.pre = offset;

		if (!difference) return;

		this.change(n => n + difference);
		this.update();
		Blockbench.setStatusBarText(trimFloatNumber(this.value - this.last_value));
	}
	input() {
		this.last_value = this.value;
	}
	stopInput() {
		if (!this.jq_inner.hasClass('editing')) return;
		var text = this.jq_inner.text();
		if (this.last_value !== text) {
			var first_token = text.substr(0, 1);

			if (typeof this.onBefore === 'function') {
				this.onBefore()
			}

			if (this.slider_vector && text.split(/\s+/g).length == this.slider_vector.length) {
				let components = text.split(/\s+/g);

				components.forEach((number, axis) => {
					let slider = this.slider_vector[axis];
					number = parseFloat(number);
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
	trigger(event) {
		if (!Condition(this.condition)) return false;
		if (typeof this.onBefore === 'function') {
			this.onBefore()
		}
		var difference = this.getInterval(false) * (event.shiftKey != event.deltaY > 0) ? -1 : 1;
		this.change(n => n + difference)
		this.update()
		if (typeof this.onAfter === 'function') {
			this.onAfter(difference)
		}
		return true;
	}
	setValue(value, trim) {
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
		this.jq_outer.find('.nslide:not(.editing)').text(this.value)
		if (this.settings && this.settings.show_bar) {
			this.node.classList.add('has_percentage_bar');
			this.node.style.setProperty('--percentage', Math.getLerp(this.settings.min, this.settings.max, value)*100);
		} 
		return this;
	}
	change(modify) {
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
			this.onChange(num);
		}
	}
	get() {
		//Solo Sliders only
		if (this.tool_setting) {
			return Toolbox.selected.tool_settings[this.tool_setting] != undefined
				 ? Toolbox.selected.tool_settings[this.tool_setting]
				 : (this.settings.default||0)
		} else {
			return parseFloat(this.value);
		}
	}
	update() {
		if (!BARS.condition(this.condition)) return;
		var number = this.get();
		this.setValue(number)
		if (isNaN(number)) {
			this.jq_outer.find('.nslide:not(.editing)').text('')
		}
		if (this.sliding) {
			$('#nslide_head #nslide_offset').text(this.name+': '+this.value)
		}
	}
}
NumSlider.MolangParser = new Molang()

class BarSlider extends Widget {
	constructor(id, data) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data);
		var scope = this;
		this.type = 'slider'
		this.icon = 'fa-sliders-h'
		this.value = data.value||0;
		this.node = Interface.createElement('div', {class: 'tool widget'}, [
			Interface.createElement('input', {
				type: 'range',
				value: data.value ? data.value : 0,
				min: data.min ? data.min : 0,
				max: data.max ? data.max : 10,
				step: data.step ? data.step : 1,
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
			scope.change(event)
		})
		if (scope.onBefore) {
			$(this.node).children('input').on('mousedown', function(event) {
				scope.onBefore(event)
			})
		}
		if (scope.onAfter) {
			$(this.node).children('input').on('change', function(event) {
				scope.onAfter(event)
			})
		}
	}
	change(event) {
		this.set( parseFloat( $(event.target).val() ) )
		if (this.onChange) {
			this.onChange(this, event)
		}
	}
	set(value) {
		this.value = value
		$(this.nodes).children('input').val(value)
	}
	get() {
		return this.value
	}
}
class BarSelect extends Widget {
	constructor(id, data) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data);
		var scope = this;
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
		this.node = document.createElement('div');
		this.node.className = 'tool widget bar_select';
		if (this.icon_mode) {
			this.node.classList.add('icon_mode');
			for (let key in data.options) {
				let button = document.createElement('div');
				button.className = 'select_option';
				button.setAttribute('key', key);
				button.title = this.getNameFor(key);
				button.append(Blockbench.getIconNode(data.options[key].icon));
				this.node.append(button);
				button.addEventListener('click', event => {
					this.set(key);
					if (this.onChange) {
						this.onChange(this, event);
					}
				})
			}

		} else {
			let select = document.createElement('bb-select')
			this.node.append(select);
			if (data.width) {
				select.style.setProperty('width', data.width+'px');
			}
			if (data.min_width) {
				select.style.setProperty('min-width', data.min_width+'px');
			}
			select.addEventListener('click', event => {
				scope.open(event)
			})
		}
		this.nodes.push(this.node);
		this.set(this.value);
		this.addLabel()
		if (typeof data.onChange === 'function') {
			this.onChange = data.onChange
		}
		$(this.node).on('mousewheel', event => {
			scope.trigger(event.originalEvent);
		})
	}
	getNode(ignore_disconnected) {
		let length = this.nodes.length;
		let node = super.getNode(ignore_disconnected);
		node.onclick = '';
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
					}
				}

			} else {
				let select = node.querySelector('bb-select');
				select && select.addEventListener('click', event => {
					this.open(event)
				})
			}
		}
		return node;
	}
	open(event) {
		if (Menu.closed_in_this_click == this.id) return this;
		let scope = this;
		let items = [];
		for (var key in this.options) {
			let val = this.options[key];
			if (val) {
				(function() {
					var save_key = key;
					items.push({
						name: scope.getNameFor(key),
						icon: val.icon || ((scope.value == save_key) ? 'far.fa-dot-circle' : 'far.fa-circle'),
						condition: val.condition,
						click: (e) => {
							scope.set(save_key);
							if (scope.onChange) {
								scope.onChange(scope, e);
							}
						}
					})
				})()
			}
		}
		let menu = new Menu(this.id, items);
		menu.node.style['min-width'] = this.node.clientWidth+'px';
		menu.open(event.target, this);
	}
	trigger(event) {
		if (!event) event = 0;
		var scope = this;
		if (BARS.condition(scope.condition, scope)) {
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
					index += event.deltaY < 0 ? -1 : 1;
				} else {
					index++;
					if (index >= scope.values.length) index = 0;
				}
			}
			for (var i = 0; i < 40; i++) {
				advance()
				if (index < 0 || index >= this.values.length) return;
				let opt = this.options[this.values[index]];
				if (opt && Condition(opt.condition)) break;
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
	change(value, event) {
		this.set(value);
		if (this.onChange) {
			this.onChange(this, event);
		}
		return this;
	}
	getNameFor(key) {
		let val = this.options[key];
		let name = tl(val === true || (val && val.name === true)
				? ('action.'+this.id+'.'+key) 
				: ((val && val.name) || val)
			);
		return name;
	}
	set(key) {
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
				$(node).find('bb-select').text(name)
			})
			if (!this.nodes.includes(this.node)) {
				$(this.node).find('bb-select').text(name)
			}
		}
		return this;
	}
	get() {
		return this.value;
	}
}
class BarText extends Widget {
	constructor(id, data) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data);
		this.type = 'bar_text'
		this.icon = 'text_format'
		this.node = $('<div class="tool widget bar_text">'+data.text||''+'</div>').get(0)
		if (data.right) {
			this.node.classList.add('f_right');
		}
		this.onUpdate = data.onUpdate;
		if (typeof data.click === 'function') {
			this.click = data.click;
			this.node.addEventListener('click', this.click)
		}
	}
	set(text) {
		this.text = text;
		$(this.nodes).text(text)
		return this;
	}
	update() {
		if (typeof this.onUpdate === 'function') {
			this.onUpdate()
		}
		return this;
	}
	trigger(event) {
		if (!Condition(this.condition)) return false;
		Blockbench.showQuickMessage(this.text)
		return true;
	}
}
class ColorPicker extends Widget {
	constructor(id, data) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(id, data);
		var scope = this;
		this.type = 'color_picker'
		this.icon = 'color_lens'
		this.node = $('<div class="tool widget"><input class="f_left" type="text"></div>').get(0)
		this.addLabel()
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
			}
		})
	}
	change(color) {
		if (this.onChange) {
			this.onChange()
		}
	}
	hide() {
		this.jq.spectrum('cancel');
	}
	confirm() {
		this.jq.spectrum('hide');
	}
	set(color) {
		this.value = new tinycolor(color)
		this.jq.spectrum('set', this.value.toHex8String())
		return this;
	}
	get() {
		this.value = this.jq.spectrum('get');
		return this.value;
	}
}
class Toolbar {
	constructor(data) {
		var scope = this;
		this.name = data.name && tl(data.name);
		this.label = !!data.label;
		this.children = [];
		this.condition_cache = [];

		// items the toolbar could not load on startup, most likely from plugins (stored as IDs)
		this.postload = null;
		// object storing initial position of actions
		// if a property with a given position is set, then this slot is occupied
		// and the associated object (action) can effectively be used with indexOf on children
		this.positionLookup = {};

		if (data) {
			this.id = data.id
			this.narrow = !!data.narrow
			this.vertical = !!data.vertical
			this.default_children = data.children.slice()
		}
		let toolbar_menu = Interface.createElement('div', {class: 'tool toolbar_menu'}, Interface.createElement('i', {class: 'material-icons'}, this.vertical ? 'more_horiz' : 'more_vert'))
		this.node = Interface.createElement('div', {class: 'toolbar'}, [
			toolbar_menu,
			Interface.createElement('div', {class: 'content'})
		])
		BarItem.prototype.addLabel(false, {
			name: tl('data.toolbar'),
			node: toolbar_menu
		})
		if (data) {
			this.build(data)
		}
		$(this.node).find('div.toolbar_menu').click(function(event) {scope.contextmenu(event)})
	}
	build(data, force) {
		var scope = this;
		//Items
		this.children.length = 0;
		var items = data.children
		if (!force && BARS.stored[scope.id] && typeof BARS.stored[scope.id] === 'object') {
			items = BARS.stored[scope.id]
			if (data.children) {
				// Add new actions to existing toolbars
				data.children.forEach((key, index) => {
					if (typeof key == 'string' && key.length > 1 && !items.includes(key) && !Keybinds.stored[key] && BarItems[key]) {
						// Figure out best index based on item before. Otherwise use index from original array
						let prev_index = items.indexOf(data.children[index-1]);
						if (prev_index != -1) index = prev_index+1;
						items.splice(index, 0, key);
					}
				})
			}
		}
		if (items && items.constructor.name === 'Array') {
			var content = $(scope.node).find('div.content')
			content.children().detach()
			for (var itemPosition = 0; itemPosition < items.length; itemPosition++) {
				var itemId = items[itemPosition];
				if (typeof itemId === 'string' && itemId.match(/^[_+#]/)) {
					let char = itemId.substr(0, 1);
					content.append(`<div class="toolbar_separator ${char == '_' ? 'border' : (char == '+' ? 'spacer' : 'linebreak')}"></div>`);
					this.children.push(char + guid().substr(0,8));
					this.positionLookup[itemPosition] = char;

					continue;
				}

				var item = BarItems[itemId];
				if (item) {
					item.pushToolbar(this);
					if (BARS.condition(item.condition)) {
						content.append(item.getNode())
					}
					this.positionLookup[itemPosition] = item;
				} else {
					var postloadAction = [itemId, itemPosition];
					if (this.postload) {
						this.postload.push(postloadAction);
					} else {
						this.postload = [postloadAction];
					}
				}
			}
		}
		$(scope.node).toggleClass('narrow', this.narrow)
		$(scope.node).toggleClass('vertical', this.vertical)
		if (data.default_place) {
			this.toPlace(this.id)
		}
		return this;
	}
	contextmenu(event) {
		var offset = $(this.node).find('.toolbar_menu').offset()
		if (offset) {
			event.clientX = offset.left+7
			event.clientY = offset.top+28
		}
		this.menu.open(event, this)
	}
	editMenu() {
		BARS.editing_bar = this;
		BARS.dialog.show();
		BARS.dialog.content_vue.currentBar = this.children;
		return this;
	}
	add(action, position) {
		if (action instanceof BarItem && this.children.includes(action)) return this;
		if (position === undefined) position = this.children.length
		if (typeof action === 'object' && action.uniqueNode && action.toolbars.length) {
			for (var i = action.toolbars.length-1; i >= 0; i--) {
				action.toolbars[i].remove(action)
			}
		}
		//Adding
		this.children.splice(position, 0, action)
		if (typeof action === 'object') {
			action.toolbars.safePush(this)
		}
		this.update().save();
		return this;
	}
	remove(action) {
		var i = this.children.length-1;
		while (i >= 0) {
			var item = this.children[i]
			if (item === action || item.id === action) {
				item.toolbars.remove(this)
				this.children.splice(i, 1)
				this.update().save();
				return this;
			}
			i--;
		}
		return this;
	}
	update(force) {
		var scope = this;

		// check if some unkown actions are now known
		if (this.postload) {
			var idx = 0;
			while (idx < this.postload.length) {
				var postloadAction = this.postload[idx];
				var item = BarItems[postloadAction[0]];
				if (item) {
					var insertAfter = postloadAction[1];
					// while there isn't displayed element at insertAfter - 1, decrease to reach one or 0
					while (this.positionLookup[--insertAfter] === undefined && insertAfter >= 0) {}
					var itemIdx = insertAfter + 1;
					if (!this.children.includes(item)) {
						item.pushToolbar(this, itemIdx);
						this.positionLookup[itemIdx] = item;
					}
					this.postload.splice(idx, 1);
				} else {
					idx++;
				}
			}
			if (this.postload.length == 0) {
				this.postload = null; // array obj no longer needed
			}
		}

		//scope.condition_cache.empty();
		let needsUpdate = force === true || scope.condition_cache.length !== scope.children.length;
		scope.condition_cache.length = scope.children.length;

		this.children.forEach(function(item, i) {
			let value = null;
			if (typeof item === 'object') {
				value = !!Condition(item.condition)
			}
			if (!needsUpdate && value !== scope.condition_cache[i]) {
				needsUpdate = true;
			}
			scope.condition_cache[i] = value;
		})
		if (!needsUpdate) return this;

		var content = $(this.node).find('.content')
		content.find('> .tool').detach()
		var separators = {
			border: content.find('> .toolbar_separator.border').detach().toArray(),
			spacer: content.find('> .toolbar_separator.spacer').detach().toArray(),
			linebreak: content.find('> .toolbar_separator.linebreak').detach().toArray(),
		}

		this.children.forEach(function(item, i) {
			if (typeof item === 'string') {
				var last = content.find('> :last-child')
				let type = item[0] == '_' ? 'border' : (item[0] == '+' ? 'spacer' : 'linebreak');
				if ((last.length === 0 || last.hasClass('toolbar_separator') || i == scope.children.length-1) && type !== 'spacer') {
					return this;
				}
				let sep = separators[type].shift();
				if (sep) {
					content.append(sep);
				} else {
					let separator = document.createElement('div');
					separator.className = `toolbar_separator ${type}`;
					content.append(separator);
				}

			} else if (typeof item === 'object') {
				if (scope.condition_cache[i]) {
					content.append(item.getNode())
					item.toolbars.safePush(scope)
				} else {
					item.toolbars.remove(scope)
				}
			}
		})
		var last = content.find('> :last-child')
		if (last.length && last.hasClass('toolbar_separator') && !last.hasClass('spacer')) {
			last.remove()
		}
		return this;
	}
	toPlace(place) {
		if (!place) place = this.id
		$('div.toolbar_wrapper.'+place+' > .toolbar').detach()
		$('div.toolbar_wrapper.'+place).append(this.node)
		return this;
	}
	save() {
		var arr = []
		this.children.forEach(function(c) {
			if (typeof c === 'string') {
				arr.push(c)
			} else {
				arr.push(c.id)
			}
		})
		BARS.stored[this.id] = arr;
		if (arr.equals(this.default_children)) {
			delete BARS.stored[this.id];
		}
		localStorage.setItem('toolbars', JSON.stringify(BARS.stored))
		return this;
	}
	reset() {
		this.build({
			children: this.default_children,
			default_place: this.default_place
		}, true);
		this.update();
		this.save();
		return this;
	}
}
Toolbar.prototype.menu = new Menu([
		{name: 'menu.toolbar.edit', icon: 'edit', click: function(bar) {
			bar.editMenu()
		}},
		{name: 'menu.toolbar.reset', icon: 'refresh', click: function(bar) {
			bar.reset()
		}}
	])

const BARS = {
	stored: {},
	editing_bar: undefined,
	action_definers: [],
	condition: Condition,
	defineActions(definer) {
		BARS.action_definers.push(definer)
	},
	setupActions() {
		BarItems = {}

		//Extras
			new KeybindItem('preview_select', {
				category: 'navigate',
				keybind: new Keybind({key: Blockbench.isTouch ? 0 : 1, ctrl: null, shift: null, alt: null})
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
				toolbar: Blockbench.isMobile ? 'element_position' : 'main_tools',
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
				toolbar: Blockbench.isMobile ? 'element_size' : 'main_tools',
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
				toolbar: Blockbench.isMobile ? 'element_rotation' : 'main_tools',
				alt_tool: 'pivot_tool',
				modes: ['edit', 'display', 'animate', 'pose'],
				keybind: new Keybind({key: 'r'})
			})
			new Tool('pivot_tool', {
				icon: 'gps_fixed',
				category: 'tools',
				selectFace: true,
				transformerMode: 'translate',
				toolbar: Blockbench.isMobile ? 'element_origin' : 'main_tools',
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
			new BarSelect('vertex_snap_mode', {
				options: {
					move: true,
					scale: {condition: () => !Format.integer_size, name: true}
				},
				category: 'edit'
			})
			new Action('swap_tools', {
				icon: 'swap_horiz',
				category: 'tools',
				condition: {modes: ['edit', 'paint', 'display'], project: true},
				keybind: new Keybind({key: 32}),
				click: function () {
					if (BarItems[Toolbox.selected.alt_tool] && Condition(BarItems[Toolbox.selected.alt_tool].condition)) {
						BarItems[Toolbox.selected.alt_tool].select()
					}
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
				condition: () => {return isApp && (Project.save_path || Project.export_path)},
				click: function () {
					shell.showItemInFolder(Project.export_path || Project.save_path);
				}
			})
			new Action('open_backup_folder', {
				icon: 'fa-archive',
				category: 'file',
				condition: () => isApp,
				click: function (e) {
					shell.openPath(app.getPath('userData')+osfs+'backups')
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

		//Edit Generic
			new Action('rename', {
				icon: 'text_format',
				category: 'edit',
				keybind: new Keybind({key: 113}),
				click: function () {
					if (Modes.edit || Modes.paint) {
						renameOutliner()
					} else if (Prop.active_panel == 'animations' && Animation.selected) {
						Animation.selected.rename()
					}
				}
			})
			new Action('delete', {
				icon: 'delete',
				category: 'edit',
				keybind: new Keybind({key: 46}),
				click: function () {
					if (Prop.active_panel == 'textures' && Texture.selected) {
						Texture.selected.remove()
					} else if (Prop.active_panel == 'color' && ['palette', 'both'].includes(ColorPanel.vue._data.open_tab)) {
						if (ColorPanel.vue._data.palette.includes(ColorPanel.vue._data.main_color)) {
							ColorPanel.vue._data.palette.remove(ColorPanel.vue._data.main_color)
						}
					} else if (Modes.edit && Mesh.selected.length && Project.selected_vertices[Mesh.selected[0].uuid] && Project.selected_vertices[Mesh.selected[0].uuid].length < Mesh.selected[0].vertice_list.length) {

						Undo.initEdit({elements: Mesh.selected})

						Mesh.selected.forEach(mesh => {
							let has_selected_faces = false;
							let selected_vertices = mesh.getSelectedVertices();
							for (let key in mesh.faces) {
								has_selected_faces = has_selected_faces || mesh.faces[key].isSelected();
							}
							if (BarItems.selection_mode.value == 'face' && has_selected_faces) {
								for (let key in mesh.faces) {
									let face = mesh.faces[key];
									if (face.isSelected()) {
										delete mesh.faces[key];
									}
								}
								selected_vertices.forEach(vertex_key => {
									let used = false;
									for (let key in mesh.faces) {
										let face = mesh.faces[key];
										if (face.vertices.includes(vertex_key)) used = true;
									}
									if (!used) {
										delete mesh.vertices[vertex_key];
									}
								})
							} else if (BarItems.selection_mode.value == 'edge' && selected_vertices.length) {
								for (let key in mesh.faces) {
									let face = mesh.faces[key];
									let sorted_vertices = face.getSortedVertices();
									let selected_corners = sorted_vertices.filter(vkey => selected_vertices.includes(vkey));
									if (selected_corners.length >= 2) {
										let index_diff = (sorted_vertices.indexOf(selected_corners[0]) - sorted_vertices.indexOf(selected_corners[1])) % sorted_vertices.length;
										if ((sorted_vertices.length < 4 || Math.abs(index_diff) !== 2)) {
											delete mesh.faces[key];
										}
									}
								}
								selected_vertices.forEach(vertex_key => {
									let used = false;
									for (let key in mesh.faces) {
										let face = mesh.faces[key];
										if (face.vertices.includes(vertex_key)) used = true;
									}
									if (!used) {
										delete mesh.vertices[vertex_key];
									}
								})

							} else {
								let selected_vertices = Project.selected_vertices[mesh.uuid];
								selected_vertices.forEach(vertex_key => {
									delete mesh.vertices[vertex_key];

									for (let key in mesh.faces) {
										let face = mesh.faces[key];
										if (!face.vertices.includes(vertex_key)) continue;
										if (face.vertices.length > 2) {
											face.vertices.remove(vertex_key);
											delete face.uv[vertex_key];
											
											if (face.vertices.length == 2) {
												for (let fkey2 in mesh.faces) {
													if (fkey2 != key && !face.vertices.find(vkey => !mesh.faces[fkey2].vertices.includes(vkey))) {
														delete mesh.faces[key];
														break;
													}
												}
											}
										} else {
											delete mesh.faces[key];
										}
									}
								})
							}
						})

						Undo.finishEdit('Delete mesh part')
						Canvas.updateView({elements: Mesh.selected, selection: true, element_aspects: {geometry: true, faces: true, uv: Mesh.selected.length > 0}})

					} else if ((Modes.edit || Modes.paint) && (selected.length || Group.selected)) {

						var array;
						Undo.initEdit({elements: selected, outliner: true, selection: true})
						if (Group.selected) {
							Group.selected.remove(true)
							return;
						}
						if (array == undefined) {
							array = selected.slice(0)
						} else if (array.constructor !== Array) {
							array = [array]
						} else {
							array = array.slice(0)
						}
						array.forEach(function(s) {
							s.remove(false)
						})
						TickUpdates.selection = true;
						Undo.finishEdit('Delete elements')

					} else if (Prop.active_panel == 'animations' && Animation.selected) {
						Animation.selected.remove(true)

					} else if (Animator.open) {
						removeSelectedKeyframes()
					}
				}
			})
			new Action('duplicate', {
				icon: 'content_copy',
				category: 'edit',
				condition: () => (Animation.selected && Modes.animate && Prop.active_panel == 'animations') || (Modes.edit && (selected.length || Group.selected)),
				keybind: new Keybind({key: 'd', ctrl: true}),
				click: function () {
					if (Modes.animate) {
						if (Animation.selected && Prop.active_panel == 'animations') {
							var copy = Animation.selected.getUndoCopy();
							var animation = new Animation(copy);
							Property.resetUniqueValues(Animation, animation);
							animation.createUniqueName();
							Animator.animations.splice(Animator.animations.indexOf(Animation.selected)+1, 0, animation)
							animation.saved = false;
							animation.add(true).select();
						}
					} else if (Group.selected && (Group.selected.matchesSelection() || selected.length === 0)) {
						var cubes_before = elements.length;
						Undo.initEdit({outliner: true, elements: [], selection: true});
						var g = Group.selected.duplicate();
						g.select();
						Undo.finishEdit('Duplicate group', {outliner: true, elements: elements.slice().slice(cubes_before), selection: true})
					} else {
						var added_elements = [];
						Undo.initEdit({elements: added_elements, outliner: true, selection: true})
						selected.forEachReverse(function(obj, i) {
							var copy = obj.duplicate();
							added_elements.push(copy);
						})
						BarItems.move_tool.select();
						Undo.finishEdit('Duplicate elements')
					}
				}
			})
			let find_replace_dialog = new Dialog({
				id: 'find_replace',
				title: 'action.find_replace',
				form: {
					target: {label: 'dialog.find_replace.target', type: 'select', options: {
						element_names: 'dialog.find_replace.target.element_names',
						group_names: 'dialog.find_replace.target.group_names',
						animation_names: 'dialog.find_replace.target.animation_names',
						keyframe_values: 'dialog.find_replace.target.keyframe_values',
					}},
					find: {label: 'dialog.find_replace.find', type: 'text'},
					replace: {label: 'dialog.find_replace.replace', type: 'text'},
					regex: {label: 'dialog.find_replace.regex', type: 'checkbox', value: false},
				},
				onFormChange() {

				},
				onConfirm(form) {
					if (!form.find) return;
					function replace(name) {
						if (form.regex) {
							let regex = new RegExp(form.find, 'g');
							return name.replace(regex, form.replace);
						} else {
							return name.split(form.find).join(form.replace);
						}
					}
					if (form.target == 'element_names') {
						let elements = (Outliner.selected.length ? Outliner.selected : Outliner.elements);
						Undo.initEdit({elements});
						elements.forEach(element => {
							element.name = replace(element.name);
							element.sanitizeName();
							if (Condition(element.needsUniqueName)) {
								element.createUniqueName();
							}
						})
					}
					if (form.target == 'group_names') {
						let groups = Group.selected ? Group.all.filter(g => g.selected) : Group.all;
						Undo.initEdit({outliner: true});
						groups.forEach(group => {
							group.name = replace(group.name);
							group.sanitizeName();
							if (Condition(group.needsUniqueName)) {
								group.createUniqueName();
							}
						})
					}
					if (form.target == 'animation_names') {
						let animations = Animation.all;
						Undo.initEdit({animations});
						animations.forEach(animation => {
							animation.name = replace(animation.name);
							animation.createUniqueName();
						})
					}
					if (form.target == 'keyframe_values') {
						let keyframes = [];
						if (Timeline.selected.length) {
							keyframes = Timeline.selected;
						} else if (Animation.selected) {
							for (let key in Animation.selected.animators) {
								keyframes.push(...Animation.selected.animators[key].keyframes);
							}
						}
						Undo.initEdit({keyframes});
						keyframes.forEach(keyframe => {
							keyframe.data_points.forEach(datapoint => {
								if (datapoint.x != undefined) datapoint.x = replace(datapoint.x.toString());
								if (datapoint.y != undefined) datapoint.y = replace(datapoint.y.toString());
								if (datapoint.z != undefined) datapoint.z = replace(datapoint.z.toString());

								if (datapoint.effect) datapoint.effect = replace(datapoint.effect);
								if (datapoint.locator) datapoint.locator = replace(datapoint.locator);
								if (datapoint.script) datapoint.script = replace(datapoint.script);
							})
						})
					}
					Undo.finishEdit('Find/replace')
				}
			})
			new Action('find_replace', {
				icon: 'find_replace',
				category: 'edit',
				click: function () {
					find_replace_dialog.show();
				}
			})


		//Settings
			new Action('open_dev_tools', {
				name: 'menu.help.developer.dev_tools',
				icon: 'fas.fa-tools',
				condition: isApp,
				work_in_dialog: true,
				keybind: new Keybind({ctrl: true, shift: true, key: 'i'}),
				work_in_dialog: true,
				click: () => {
					currentwindow.toggleDevTools();
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

		BARS.action_definers.forEach((definer) => {
			if (typeof definer === 'function') {
				definer()
			}
		})
	},
	setupToolbars() {
		//
		Toolbars = {}
		var stored = localStorage.getItem('toolbars')
		if (stored) {
			stored = JSON.parse(stored)
			if (typeof stored === 'object') {
				BARS.stored = stored;
			}
		}
		Toolbars.outliner = new Toolbar({
			id: 'outliner',
			children: [
				'add_cube',
				'add_mesh',
				'add_group',
				'outliner_toggle',
				'toggle_skin_layer',
				'explode_skin_model',
				'+',
				'cube_counter'
			]
		})

		Toolbars.texturelist = new Toolbar({
			id: 'texturelist',
			children: [
				'import_texture',
				'create_texture',
				'append_to_template',
			]
		})
		Blockbench.onUpdateTo('4.3.0-beta.0', () => {
			Toolbars.texturelist.add(BarItems.append_to_template);
		})

		Toolbars.tools = new Toolbar({
			id: 'tools',
			children: [
				'move_tool',
				'resize_tool',
				'rotate_tool',
				'pivot_tool',
				'vertex_snap_tool',
				'seam_tool',
				'pan_tool',
				'brush_tool',
				'copy_brush',
				'fill_tool',
				'eraser',
				'color_picker',
				'draw_shape_tool',
				'gradient_tool',
				'copy_paste_tool'
			],
			vertical: Blockbench.isMobile == true,
			default_place: true
		})

		Toolbars.element_position = new Toolbar({
			id: 'element_position',
			name: 'panel.element.position',
			label: true,
			children: [
				'slider_pos_x',
				'slider_pos_y',
				'slider_pos_z'
			]
		})
		Toolbars.element_size = new Toolbar({
			id: 'element_size',
			name: 'panel.element.size',
			label: true,
			children: [
				'slider_size_x',
				'slider_size_y',
				'slider_size_z',
				'slider_inflate'
			]
		})
		Toolbars.element_origin = new Toolbar({
			id: 'element_origin',
			name: 'panel.element.origin',
			label: true,
			children: [
				'slider_origin_x',
				'slider_origin_y',
				'slider_origin_z',
				'origin_to_geometry'
			]
		})
		Toolbars.element_rotation = new Toolbar({
			id: 'element_rotation',
			name: 'panel.element.rotation',
			label: true,
			children: [
				'slider_rotation_x',
				'slider_rotation_y',
				'slider_rotation_z',
				'rescale_toggle'
			]
		})

		Toolbars.palette = new Toolbar({
			id: 'palette',
			children: [
				'import_palette',
				'export_palette',
				'generate_palette',
				'sort_palette',
				'save_palette',
				'load_palette',
			]
		})
		Blockbench.onUpdateTo('4.3.0-beta.0', () => {
			Toolbars.palette.add(BarItems.save_palette, -1);
		})
		Toolbars.color_picker = new Toolbar({
			id: 'color_picker',
			children: [
				'slider_color_h',
				'slider_color_s',
				'slider_color_v',
				'add_to_palette',
				'pick_screen_color'
			]
		})


		Toolbars.display = new Toolbar({
			id: 'display',
			children: [
				'copy',
				'paste',
				'add_display_preset',
				'apply_display_preset',
				'gui_light'
			]
		})
		//UV
		Toolbars.uv_editor = new Toolbar({
			id: 'uv_editor',
			children: [
				'move_texture_with_uv',
				'uv_apply_all',
				'uv_maximize',
				'uv_auto',
				'uv_transparent',
				'uv_mirror_x',
				'uv_mirror_y',
				'uv_rotation',
				//Box
				'toggle_mirror_uv',
			]
		})
		//Animations
		Toolbars.animations = new Toolbar({
			id: 'animations',
			children: [
				'add_animation',
				'load_animation_file',
				'slider_animation_length',
			]
		})
		Toolbars.keyframe = new Toolbar({
			id: 'keyframe',
			children: [
				'slider_keyframe_time',
				'keyframe_interpolation',
				'keyframe_uniform',
				'change_keyframe_file',
				'reset_keyframe'
			]
		})
		Toolbars.timeline = new Toolbar({
			id: 'timeline',
			children: [
				'timeline_graph_editor',
				'timeline_focus',
				'clear_timeline',
				'bring_up_all_animations',
				'select_effect_animator',
				'add_marker',
				'+',
				'jump_to_timeline_start',
				'play_animation',
				'jump_to_timeline_end',
				'+',
				'slider_animation_speed',
			],
			default_place: true
		})
		//Tools
		Toolbars.main_tools = new Toolbar({
			id: 'main_tools',
			children: [
				'transform_space',
				'rotation_space',
				'selection_mode',
				'lock_motion_trail',
				'extrude_mesh_selection',
				'inset_mesh_selection',
				'loop_cut',
				'create_face',
				'invert_face',
			]
		})
		if (Blockbench.isMobile) {
			[Toolbars.element_position,
				Toolbars.element_size,
				Toolbars.element_origin,
				Toolbars.element_rotation
			].forEach(toolbar => {
				Toolbars.main_tools.children.forEach(child => {
					toolbar.add(child);
				})
			})
		}
		Blockbench.onUpdateTo('4.4.0-beta.0', () => {
			delete BARS.stored.brush;
		})
		Toolbars.brush = new Toolbar({
			id: 'brush',
			children: [
				'fill_mode',
				'copy_brush_mode',
				'draw_shape_type',
				'copy_paste_tool_mode',
				'_',
				'slider_brush_size',
				'slider_brush_opacity',
				'slider_brush_softness',
				'_',
				'brush_shape',
				'blend_mode',
				'mirror_painting',
				'color_erase_mode',
				'lock_alpha',
				'painting_grid',
			]
		})
		Toolbars.vertex_snap = new Toolbar({
			id: 'vertex_snap',
			children: [
				'vertex_snap_mode',
				'selection_mode'
			]
		})
		Toolbars.seam_tool = new Toolbar({
			id: 'seam_tool',
			children: [
				'select_seam'
			]
		})

		Toolbox = Toolbars.tools;
		Toolbox.toggleTransforms = function() {
			if (Toolbox.selected.id === 'move_tool') {
				BarItems['resize_tool'].select();
			} else if (Toolbox.selected.id === 'resize_tool') {
				BarItems['move_tool'].select()
			}
		}
		BarItems.move_tool.select()

	},
	setupVue() {

		let sidebar_pages = {
			separators: tl('category.separators')
		};
		for (let key in BarItems) {
			let category = BarItems[key].category;
			if (!sidebar_pages[category]) {
				sidebar_pages[category] = tl(`category.${category}`);
			}
		}

		BARS.dialog = new Dialog({
			id: 'toolbar_edit',
			title: 'dialog.toolbar_edit.title',
			singleButton: true,
			width: 780,
			sidebar: {
				pages: sidebar_pages,
				page: 'separators',
				onPageSwitch(page) {
					BARS.dialog.content_vue.open_category = page;
					BARS.dialog.content_vue.search_term = '';
				}
			},
			component: {
				data: {
					items: BarItems,
					currentBar: [],
					search_term: '',
					open_category: 'separators',
					separators: [
						{
							icon: 'fa-grip-lines-vertical',
							name: tl('data.separator'),
							type: 'separator',
							separator_code: '_'
						},
						{
							icon: 'space_bar',
							name: tl('data.separator.spacer'),
							type: 'separator',
							separator_code: '+'
						},
						{
							icon: 'fa-paragraph',
							name: tl('data.separator.linebreak'),
							type: 'separator',
							separator_code: '#'
						}
					]
				},
				computed: {
					searchedBarItems() {
						var term = this.search_term.toLowerCase();
						var list = [];
						if (this.open_category == 'separators' || term) {
							if (term) {
								list = this.separators.filter(item => {
									return item.name.toLowerCase().includes(term)
								})
							} else {
								list = this.separators;
							}
						}
						for (var key in BarItems) {
							var item = BarItems[key];
							if (this.currentBar.includes(item)) continue;

							if (term) {
								if (
									item.name.toLowerCase().includes(term) ||
									item.id.toLowerCase().includes(term)
								) {
									list.push(item)
								}

							} else if (item.category == this.open_category) {
								list.push(item);
							}
						}
						return list;
					}
				},
				methods: {
					sort(event) {
						var item = this.currentBar.splice(event.oldIndex, 1)[0]
						this.currentBar.splice(event.newIndex, 0, item)
						this.update();
					},
					drop(event) {
						var scope = this;
						$('#bar_items_current .tooltip').css('display', '')
						setTimeout(() => {
							if ($('#bar_items_current:hover').length === 0) {
								var item = scope.currentBar.splice(event.newIndex, 1)[0];
								if (item instanceof BarItem) item.toolbars.remove(BARS.editing_bar);
								scope.update();
							}
						}, 30)
					},
					choose() {
						$('#bar_items_current .tooltip').css('display', 'none')
					},
					update() {
						BARS.editing_bar.update(true).save();
					},
					addItem(item) {
						if (item.type === 'separator') {
							item = item.separator_code;
						}
						BARS.editing_bar.add(item);
					},
					openContextMenu(item, event) {
						new Menu([
							{
								name: 'generic.remove',
								icon: 'clear',
								click: () => {
									this.currentBar.remove(item);
									if (item instanceof BarItem) item.toolbars.remove(BARS.editing_bar);
									this.update();
								}
							}
						]).open(event)
					},
					getSpacerTitle(char) {
						switch (char) {
							case '_': return this.separators[0].name;
							case '+': return this.separators[1].name;
							case '#': return this.separators[2].name;
						}
					},
					getIconNode: Blockbench.getIconNode,
					Condition,
					tl
				},
				template: `
					<div>
						<ul class="bar" id="bar_items_current" v-sortable="{onChoose: choose, onUpdate: sort, onEnd: drop, animation: 160 }">
							<li v-for="item in currentBar" v-bind:title="typeof item == 'string' ? getSpacerTitle(item[0]) : item.name" :key="item.id||item" @contextmenu="openContextMenu(item, $event)">
								<div v-if="typeof item === 'string'" class="toolbar_separator" :class="{border: item[0] == '_', spacer: item[0] == '+', linebreak: item[0] == '#'}"></div>
								<div v-else class="tool">
									<div class="tooltip">{{item.name + (Condition(item.condition) ? '' : ' (' + tl('dialog.toolbar_edit.hidden') + ')' )}}</div>
									<span class="icon_wrapper" v-bind:style="{opacity: Condition(item.condition) ? 1 : 0.4}" v-html="getIconNode(item.icon, item.color).outerHTML"></span>
								</div>
							</li> 
						</ul>
			
						<p class="small_text subtle" style="display: inline;">${tl('dialog.toolbar_edit.hidden_tools')}</p>
		
						<search-bar v-model="search_term"></search-bar>
			
						<ul class="list" id="bar_item_list">
							<li v-for="item in searchedBarItems" v-on:click="addItem(item)" :class="{separator_item: item.type == 'separator'}">
								<div class="icon_wrapper normal" v-html="getIconNode(item.icon, item.color).outerHTML"></div>
								<div class="icon_wrapper add"><i class="material-icons">add</i></div>
								{{ item.name }}
							</li>
						</ul>
			
					</div>
				`
			}
		})
	},
	updateConditions() {
		var open_input = document.querySelector('input[type="text"]:focus, input[type="number"]:focus, div[contenteditable="true"]:focus');
		for (var key in Toolbars) {
			if (Toolbars.hasOwnProperty(key) &&
				(!open_input || $(Toolbars[key].node).has(open_input).length === 0)
			) {
				Toolbars[key].update()
			}
		}
	}
}

const Keybinds = {
	actions: [],
	stored: {},
	extra: {},
	structure: {},
	save() {
		localStorage.setItem('keybindings', JSON.stringify(Keybinds.stored))
	}
}
if (localStorage.getItem('keybindings')) {
	try {
		Keybinds.stored = JSON.parse(localStorage.getItem('keybindings'))
	} catch (err) {}
}

