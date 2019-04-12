var Toolbars, BarItems, open_menu, Toolbox;
//Bars
class MenuSeparator {
	constructor() {
		this.menu_node = $('<li class="menu_separator"></li>')
	}
}
class BarItem {
	constructor(data) {
		this.id = data.id;
		if (!data.private) {
			BarItems[this.id] = this;
		}
		this.name = tl('action.'+this.id)
		this.description = tl('action.'+this.id+'.desc')
		if (data.name) this.name = tl(data.name);
		if (data.description) this.description = tl(data.description);
		this.node;
		this.condition = data.condition;
		this.nodes = []
		this.toolbars = []
		//Key
		this.category = data.category ? data.category : 'misc'
		if (!data.private) {
			if (data.keybind) {
				this.default_keybind = data.keybind
			}
			if (Keybinds.stored[this.id]) {
				this.keybind = new Keybind(Keybinds.stored[this.id])
			} else {
				this.keybind = new Keybind(data.keybind)
			}
			this.keybind.setAction(this.id)
			this.work_in_dialog = data.work_in_dialog === true
			this.uses = 0;
			Keybinds.actions.push(this)
		}
	}
	conditionMet() {
		if (this.condition === undefined) {
			return true;
		} else if (typeof this.condition === 'function') {
			return this.condition()
		} else {
			return !!this.condition
		}
	}
	addLabel(in_bar, action) {
		if (!action || this instanceof BarItem) {
			action = this;
		}
		$(action.node).attr('title', action.description)
		if (in_bar) {
			$(action.node).prepend('<label class="f_left in_toolbar">'+action.name+':</label>')
		} else {
			$(action.node).prepend('<div class="tooltip">'+action.name+'</div>')
			.on('mouseenter', function() {

				var tooltip = $(this).find('div.tooltip')
				if (!tooltip || typeof tooltip.offset() !== 'object') return;

				tooltip.css('margin-left', '0')
				var offset = tooltip.offset()
				offset.right = offset.left + parseInt(tooltip.css('width').replace(/px/, '')) - $(window).width()

				if (offset.right > 4) {
					tooltip.css('margin-left', -offset.right+'px')
				}
			})
		}
	}
	getNode() {
		var scope = this;
		if (this.id === 'uv_rotation') {
		}
		if (scope.nodes.length === 0) {
			scope.nodes = [scope.node]
		}
		if (!scope.node.isConnected) {
			$(scope.node).detach()
			return scope.node;
		}
		var i = 0;
		while (i < scope.nodes.length) {
			if (!scope.nodes[i].isConnected) {
				$(scope.nodes[i]).detach()
				return scope.nodes[i];
			}
			i++;
		}
		var clone = $(scope.node).clone(true, true).get(0);
		scope.nodes.push(clone);
		return clone;
	}
	toElement(destination) {
		$(destination).first().append(this.getNode())
		return this;
	}
	pushToolbar(bar) {
		var scope = this;
		if (scope.uniqueNode && scope.toolbars.length) {
			for (var i = scope.toolbars.length-1; i >= 0; i--) {
				scope.toolbars[i].remove(scope)
			}
		}
		bar.children.push(this)
		this.toolbars.safePush(bar)
	}
}
class KeybindItem {
	constructor(data) {
		this.id = data.id
		this.type = 'keybind_item'
		this.name = tl('keybind.'+this.id)
		this.category = data.category ? data.category : 'misc'
		if (data.keybind) {
			this.default_keybind = data.keybind
		}
		this.keybind = new Keybind(data.keybind).set(Keybinds.stored[this.id])

		Keybinds.actions.push(this)
		Keybinds.extra[this.id] = this;
		this.keybind.setAction(this.id)
	}
}
class Action extends BarItem {
	constructor(data) {
		super(data)
		var scope = this;
		this.type = 'action'
		//Icon
		this.icon = data.icon
		this.color = data.color

		if (data.linked_setting) {
			this.description = tl('settings.'+data.linked_setting+'.desc')
			this.linked_setting = data.linked_setting
		}
		if (data.condition) this.condition = data.condition

		//Node
		this.click = data.click
		this.icon_node = Blockbench.getIconNode(this.icon, this.color)
		this.node = $(`<div class="tool ${this.id}"></div>`).get(0)
		this.nodes = [this.node]
		this.menu_node = $(`<li>${this.name}</li>`).get(0)
		$(this.node).add(this.menu_node).append(this.icon_node)
		this.addLabel(data.label)
		$(this.node).click(function(e) {scope.trigger(e)})

		if (data.linked_setting) {
			this.toggleLinkedSetting(false)
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

			$(scope.nodes).each(function() {
				$(this).css('color', 'var(--color-light)')
			})
			setTimeout(function() {
				$(scope.nodes).each(function() {
					$(this).css('color', '')
				})
			}, 200)
			return true;
		}
		return false;
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
	toggleLinkedSetting(change) {
		if (this.linked_setting && settings[this.linked_setting]) {
			if (change !== false) {
				settings[this.linked_setting].value = !settings[this.linked_setting].value
			}
			this.setIcon(settings[this.linked_setting].value ? 'check_box' : 'check_box_outline_blank')
		}
	}
}
class Tool extends Action {
	constructor(data) {
		super(data)
		var scope = this;
		this.type = 'tool'
		this.toolbar = data.toolbar;
		this.alt_tool = data.alt_tool;
		this.modes = data.modes;
		this.selectFace = data.selectFace;
		this.selectCubes = data.selectCubes !== false;
		this.paintTool = data.paintTool;
		this.transformerMode = data.transformerMode;
		this.allowWireframe = data.allowWireframe !== false;

		if (!this.condition) {
			this.condition = function() {
				return !scope.modes || scope.modes.includes(Modes.id);
			}
		}
		this.onCanvasClick = data.onCanvasClick;
		this.onSelect = data.onSelect;
		this.onUnselect = data.onUnselect;
		$(this.node).click(function() {scope.select()})
	}
	select() {
		if (this === Toolbox.selected) return;
		if (Toolbox.selected && Toolbox.selected.onUnselect && typeof Toolbox.selected.onUnselect == 'function') {
			Toolbox.selected.onUnselect()
		}
		Toolbox.selected = this;
		delete Toolbox.original;
		this.uses++;

		if (this.transformerMode) {
			Transformer.setMode(this.transformerMode)
		}
		if (Prop.wireframe && !this.allowWireframe) {
			Prop.wireframe = false
			Canvas.updateAll()
		}
		if (this.toolbar && Toolbars[this.toolbar]) {
			Toolbars[this.toolbar].toPlace('tool_options')
		} else {
			$('.toolbar_wrapper.tool_options > .toolbar').detach()
		}
		$('#preview').css('cursor', (this.cursor ? this.cursor : 'default'))
		updateSelection()
		$('.tool.sel').removeClass('sel')
		$('.tool.'+this.id).addClass('sel')

		if (typeof this.onSelect == 'function') {
			this.onSelect()
		}
		return this;
	}
	trigger(event) {
		var scope = this;
		if (BARS.condition(scope.condition, scope)) {
			this.select()
			return true;
		} else if (event.type.includes('key') && this.modes) {
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
class Widget extends BarItem {
	constructor(data) {
		super(data);
		this.type = 'widget';
		//this.uniqueNode = true;
	}
}
class NumSlider extends Widget {
	constructor(data) {
		super(data);
		this.uv = !!data.uv;
		this.type = 'numslider'
		this.icon = 'code'
		this.value = 0;
		this.width = 79;
		this.uniqueNode = true;
		if (typeof data.get === 'function') this.get = data.get;
		this.onBefore = data.onBefore;
		this.onAfter = data.onAfter;
		if (typeof data.change === 'function') this.change = data.change;
		if (data.settings) {
			this.settings = data.settings;
			if (this.settings.default) {
				this.value = this.settings.default
			}
			if (data.settings.interval) {
				this.getInterval = data.settings.interval
			} else {
				this.getInterval = function(event) {
					return this.settings.step ? this.settings.step : 1
				};
			}
		} else {
			this.getInterval = function(event) {
				event = event||false;
				return canvasGridSize(event.shiftKey, event.ctrlKey);
			};
		}
		if (typeof data.getInterval === 'function') {
			this.getInterval = data.getInterval;
		}
		if (this.keybind) {
			this.keybind.shift = null;
		}
		var scope = this;
		this.node = $( `<div class="tool wide widget nslide_tool">
							<div class="tooltip">${this.name}</div>
							<div class="nslide" n-action="${this.id}"></div>
					  	</div>`).get(0);
		this.jq_outer = $(this.node)
		this.jq_inner = this.jq_outer.find('.nslide');

		//Slide
		this.jq_inner.draggable({
			revert: true,
			axis: 'x',
			revertDuration: 0,
			helper: function () {return '<div id="nslide_head"><span id="nslide_offset"></span></div>'},
			opacity: 0.8,
			appendTo: 'body',
			cursor: "none",
			start: function(event, ui) {
				if (typeof scope.onBefore === 'function') {
					scope.onBefore()
				}
				scope.pre = canvasGridSize()
				scope.top = ui.position.top
				scope.left = ui.position.left
				scope.last_value = scope.value
			},
			drag: function(event, ui) {
				scope.slide(event, ui)
			},
			stop: function() {
				if (typeof scope.onAfter === 'function') {
					scope.onAfter(scope.value - scope.last_value)
				}
			}
		})
		//Input
		.keypress(function (e) {
			if (e.keyCode === 10 || e.keyCode === 13) {
				e.preventDefault();
				scope.stopInput()
			}
		})
		.keyup(function (e) {
			if (e.keyCode !== 10 && e.keyCode !== 13) {
				scope.input()
			}
		})
		.focusout(function() {
			scope.stopInput()
		})
		.click(function(event) {
			if (event.target != this) return;
			scope.jq_inner.find('.nslide_arrow').remove()
			scope.jq_inner.attr('contenteditable', 'true')
			scope.jq_inner.addClass('editing')
			scope.jq_inner.focus()
			document.execCommand('selectAll')
		});
		//Arrows
		this.jq_outer
		.on('mouseenter', function() {
			scope.jq_outer.append(
				'<div class="nslide_arrow na_left" ><i class="material-icons">navigate_before</i></div>'+
				'<div class="nslide_arrow na_right"><i class="material-icons">navigate_next</i></div>'
			)

			var n = limitNumber(scope.width/2-24, 6, 1000)

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
	setWidth(width) {
		if (width) {
			this.width = width
		} else {
			width = this.width
		}
		$(this.node).width(width).find('> div.nslide').css('width', width+'px')
		return this;
	}
	slide(event, ui) {
		//Variables
		var scope = this;
		var number = 0;
		//Math
		var offset = Math.round((event.clientX-scope.left)/30)
		if (scope.uv === false) {
			offset *= canvasGridSize();
		}
		var difference = offset - scope.pre;
		scope.pre = offset;
		difference *= this.getInterval(event)
		if (difference == 0 || isNaN(difference)) return;

		this.change(difference)
		this.update()
	}
	input(obj) {
		var scope = this;
		if (typeof this.onBefore === 'function') {
			this.onBefore()
		}
		this.last_value = this.value
		var number = this.jq_inner.text().replace(/[^-.0-9]/g, "");
		var number = parseFloat(number)
		if (isNaN(number)) {
			number = 0;
		}
		this.change(number, true)
		this.update()
		if (typeof this.onAfter === 'function') {
			this.onAfter(scope.value - scope.last_value)
		}
	}
	stopInput() {
		this.jq_inner.attr('contenteditable', 'false')
		this.jq_inner.removeClass('editing')
		this.update()
	}
	arrow(difference, event) {
		if (typeof this.onBefore === 'function') {
			this.onBefore()
		}
		difference *= this.getInterval(event)
		this.change(difference)
		this.update()
		if (typeof this.onAfter === 'function') {
			this.onAfter(difference)
		}
	}
	trigger(event) {
		if (typeof this.onBefore === 'function') {
			this.onBefore()
		}
		var difference = this.getInterval(false) * event.shiftKey ? -1 : 1;
		this.change(difference)
		this.update()
		if (typeof this.onAfter === 'function') {
			this.onAfter(difference)
		}
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
		this.jq_outer.find('.nslide:not(.editing)').text(this.value)
		//this.jq_inner.text(this.value)
		return this;
	}
	change(difference, fixed) {
		//Solo Sliders only
		var num = difference
		if (!fixed) {
			num += this.get()
		}
		if (this.settings && typeof this.settings.min === 'number') {
			num = limitNumber(num, this.settings.min, this.settings.max)
		}
		this.value = num
	}
	get() {
		//Solo Sliders only
		return parseFloat(this.value);
	}
	update() {
		if (!BARS.condition(this.condition)) return;
		var number = this.get();
		this.setValue(number)
		$('#nslide_head #nslide_offset').text(this.name+': '+this.value)
	}
}
class BarSlider extends Widget {
	constructor(data) {
		super(data)
		var scope = this;
		this.type = 'slider'
		this.icon = 'fa-sliders'
		this.value = data.value||0
		this.node = $('<div class="tool widget">'+
			'<input type="range" class="dark_bordered"'+
				' value="'+(data.value?data.value:0)+'" '+
				' min="'+(data.min?data.min:0)+'" '+
				' max="'+(data.max?data.max:10)+'" '+
				' step="'+(data.step?data.step:1)+'" '+
				' style="width: '+(data.width?data.width:'auto')+'px;">'+
		'</div>').get(0)
		this.addLabel(data.label)
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
	constructor(data) {
		super(data)
		var scope = this;
		this.type = 'select'
		this.icon = 'list'
		this.node = $('<div class="tool widget bar_select"><select></select></div>').get(0)
		if (data.width) {
			$(this.node).children('select').css('width', data.width+'px')
		}
		this.value = data.value
		this.values = []
		var select = $(this.node).find('select')
		if (data.options) {
			for (var key in data.options) {
				if (!this.value) {
					this.value = key
				}
				var name = data.options[key]
				if (name === true) {
					name = tl('action.'+this.id+'.'+key)
				}
				select.append(`<option id="${key}" ${key == this.value ? 'selected' : ''}>${name}</option>`)
				this.values.push(key);
			}
		}
		this.addLabel(data.label)
		if (typeof data.onChange === 'function') {
			this.onChange = data.onChange
		}
		$(this.node).children('select').change(function(event) {
			scope.change(event)
		})
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
			var index = this.values.indexOf(this.value)+1
			if (index >= this.values.length) index = 0;
			this.set(this.values[index])
			
			scope.uses++;
			return true;
		}
		return false;
	}
	change(event) {
		this.set( $(event.target).find('option:selected').prop('id') )
		if (this.onChange) {
			this.onChange(this, event)
		}
	}
	set(id) {
		this.value = id
		$(this.nodes).find('option#'+id).prop('selected', true).siblings().prop('selected', false)
	}
	get() {
		return this.value
	}
}
class BarText extends Widget {
	constructor(data) {
		super(data)
		this.type = 'bar_text'
		this.icon = 'text_format'
		this.node = $('<div class="tool widget bar_text">'+data.text||''+'</div>').get(0)
		if (data.right) {
			$(this.node).addClass('f_right')
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
		Blockbench.showQuickMessage(this.text)
		return this;
	}
}
class ColorPicker extends Widget {
	constructor(data) {
		super(data)
		var scope = this;
		this.type = 'color_picker'
		this.icon = 'color_lens'
		this.node = $('<div class="tool widget"><input class="f_left" type="text"></div>').get(0)
		this.addLabel(data.label)
		this.jq = $(this.node).find('input')
		if (typeof data.onChange === 'function') {
			this.onChange = data.onChange
		}
		this.value = new tinycolor('ffffff')
		this.jq.spectrum({
			preferredFormat: "hex",
			color: 'ffffff',
			showAlpha: true,
			showInput: true,
			maxSelectionSize: 128,
			showPalette: data.palette === true,
			palette: data.palette ? [] : undefined,
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
		this.children = [];
		this.default_children = data.children.slice()
		var jq = $('<div class="toolbar">'+
			'<div class="content"></div>'+
			'<div class="tool toolbar_menu"><i class="material-icons">more_vert</i></div>'+
		'</div>')
		this.node = jq.get(0)
		BarItem.prototype.addLabel(false, {
			name: tl('data.toolbar'),
			node: jq.find('.tool.toolbar_menu').get(0)
		})
		$(this.node).find('div.toolbar_menu').click(function(event) {scope.contextmenu(event)})
		if (data) {
			this.id = data.id
			this.narrow = !!data.narrow
			this.build(data)
		}
	}
	build(data, force) {
		var scope = this;
		//Items
		this.children.length = 0;
		var items = data.children
		if (!force && BARS.stored[scope.id] && typeof BARS.stored[scope.id] === 'object') {
			items = BARS.stored[scope.id]
		}
		if (items && items.constructor.name === 'Array') {
			var content = $(scope.node).find('div.content')
			content.children().detach()
			items.forEach(function(id) {
				if (typeof id === 'string' && id.substr(0, 1) === '_') {
					content.append('<div class="toolbar_separator"></div>')
					scope.children.push('_'+guid().substr(0,8))
					return;
				}
				var item = BarItems[id]
				if (item) {
					item.pushToolbar(scope)
					if (BARS.condition(item.condition)) {
						content.append(item.getNode())
					}
				}
			})
		}
		$(scope.node).toggleClass('narrow', this.narrow)
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
		var scope = this;
		BARS.editing_bar = this;
		this.children.forEach(function(c, ci) {
		})
		BARS.list.currentBar = this.children;
		showDialog('toolbar_edit');
		return this;
	}
	add(action, position) {
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
		this.update()
		return this;
	}
	remove(action) {
		var i = this.children.length-1;
		while (i >= 0) {
			var item = this.children[i]
			if (item === action || item.id === action) {
				item.toolbars.remove(this)
				this.children.splice(i, 1)
				this.update()
				return this;
			}
			i--;
		}
		return this;
	}
	update() {
		var scope = this;
		var content = $(this.node).find('.content')
		content.find('> .tool').detach()
		var separators = content.find('> .toolbar_separator').detach()
		var sep_nr = 0;

		this.children.forEach(function(item, i) {
			if (typeof item === 'string') {
				var last = content.find('> :last-child')
				if (last.length === 0 || last.hasClass('toolbar_separator') || i == scope.children.length-1) {
					return
				}
				var sep = separators[sep_nr]
				if (sep) {
					content.append(sep)
					sep_nr++;
				} else {
					content.append('<div class="toolbar_separator"></div>')
				}
			} else if (typeof item === 'object') {
				if (BARS.condition( item.condition )) {
					content.append(item.getNode())
					item.toolbars.safePush(scope)
				} else {
					item.toolbars.remove(scope)
				}
			}
		})
		var last = content.find('> :last-child')
		if (last.length && last.hasClass('toolbar_separator')) {
			last.remove()
		}
		this.save()
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
		BARS.stored[this.id] = arr
		localStorage.setItem('toolbars', JSON.stringify(BARS.stored))
		return this;
	}
	reset() {
		this.build({
			children: this.default_children,
			default_place: this.default_place
		}, true)
		this.save()
		return this;
	}
}

const BARS = {
	stored: {},
	editing_bar: undefined,
	action_definers: [],
	condition: Condition,
	defineActions: function(definer) {
		BARS.action_definers.push(definer)
	},
	setupActions: function() {
		BarItems = {}

		//Extras
			new KeybindItem({
				id: 'preview_select',
				category: 'navigate',
				keybind: new Keybind({key: 1, ctrl: null, shift: null, alt: null})
			})
			new KeybindItem({
				id: 'preview_rotate',
				category: 'navigate',
				keybind: new Keybind({key: 1})
			})
			new KeybindItem({
				id: 'preview_drag',
				category: 'navigate',
				keybind: new Keybind({key: 3})
			})

			new KeybindItem({
				id: 'confirm',
				category: 'navigate',
				keybind: new Keybind({key: 13})
			})
			new KeybindItem({
				id: 'cancel',
				category: 'navigate',
				keybind: new Keybind({key: 27})
			})

		//Tools
			new Tool({
				id: 'move_tool',
				icon: 'fa-hand-paper-o',
				category: 'tools',
				selectFace: true,
				transformerMode: 'translate',
				toolbar: 'transform',
				alt_tool: 'resize_tool',
				modes: ['edit', 'display', 'animate'],
				keybind: new Keybind({key: 86}),
			})
			new Tool({
				id: 'resize_tool',
				icon: 'open_with',
				category: 'tools',
				selectFace: true,
				transformerMode: 'scale',
				toolbar: 'transform',
				alt_tool: 'move_tool',
				modes: ['edit', 'display', 'animate'],
				keybind: new Keybind({key: 83}),
			})
			new Tool({
				id: 'rotate_tool',
				icon: 'sync',
				category: 'tools',
				selectFace: true,
				transformerMode: 'rotate',
				toolbar: 'transform',
				alt_tool: 'pivot_tool',
				modes: ['edit', 'display', 'animate'],
				keybind: new Keybind({key: 82}),
			})
			new Tool({
				id: 'pivot_tool',
				icon: 'gps_fixed',
				category: 'tools',
				transformerMode: 'translate',
				toolbar: 'transform',
				alt_tool: 'rotate_tool',
				modes: ['edit'],
				keybind: new Keybind({key: 80}),
			})
			new Tool({
				id: 'vertex_snap_tool',
				icon: 'icon-vertexsnap',
				transformerMode: 'hidden',
				toolbar: 'vertex_snap',
				category: 'tools',
				selectCubes: true,
				cursor: 'copy',
				modes: ['edit'],
				keybind: new Keybind({key: 88}),
				onCanvasClick: function(data) {
					Vertexsnap.canvasClick(data)
				},
				onSelect: function() {
					Blockbench.addListener('update_selection', Vertexsnap.select)
					Vertexsnap.select()
				},
				onUnselect: function() {
					Vertexsnap.removeVertexes()
					Vertexsnap.step1 = true
					Blockbench.removeListener('update_selection', Vertexsnap.select)
				}
			})
			new BarSelect({
				id: 'vertex_snap_mode',
				options: {
					move: true,
					scale: true
				},
				category: 'edit'
			})
			new Action({
				id: 'swap_tools',
				icon: 'swap_horiz',
				category: 'tools',
				condition: () => !Animator.open,
				keybind: new Keybind({key: 32}),
				click: function () {
					if (Toolbox.selected.id === 'move_tool') {
						BarItems.resize_tool.select()
					} else if (Toolbox.selected.id === 'resize_tool') {
						BarItems.move_tool.select()
					}
				}
			})

		//File
			new Action({
				id: 'project_window',
				icon: 'featured_play_list',
				category: 'file',
				click: function () {
					showDialog('project_settings');
					if (Blockbench.entity_mode) {
						Undo.initEdit({resolution: true})
					}
				}
			})
			new Action({
				id: 'open_model_folder',
				icon: 'folder_open',
				category: 'file',
				condition: () => {return isApp && Prop.file_path && Prop.file_path !== ''},
				click: function () {
					shell.showItemInFolder(Prop.file_path)
				}
			})
			new Action({
				id: 'open_backup_folder',
				icon: 'fa-archive',
				category: 'file',
				condition: () => isApp,
				click: function (e) {
					shell.showItemInFolder(app.getPath('userData')+osfs+'backups'+osfs+'.')
				}
			})
			new Action({
				id: 'settings_window',
				icon: 'settings',
				category: 'blockbench',
				keybind: new Keybind({key: 69, ctrl: true}),
				click: function () {openSettings()}
			})
			new Action({
				id: 'update_window',
				icon: 'update',
				category: 'blockbench',
				condition: isApp,
				click: function () {checkForUpdates()}
			})
			new Action({
				id: 'donate',
				icon: 'loyalty',
				category: 'blockbench',
				click: function () {Blockbench.openLink('http://blockbench.net/donate')}
			})
			new Action({
				id: 'reload',
				icon: 'refresh',
				category: 'file',
				condition: () => Blockbench.hasFlag('dev'),
				click: function () {Blockbench.reload()}
			})

		//Edit
			new Action({
				id: 'copy',
				icon: 'fa-clone',
				category: 'edit',
				work_in_dialog: true,
				keybind: new Keybind({key: 67, ctrl: true, shift: null}),
				click: function (event) {Clipbench.copy(event)}
			})
			new Action({
				id: 'paste',
				icon: 'fa-clipboard',
				category: 'edit',
				work_in_dialog: true,
				keybind: new Keybind({key: 86, ctrl: true, shift: null}),
				click: function (event) {Clipbench.paste(event)}
			})
			new Action({
				id: 'cut',
				icon: 'fa-scissors',
				category: 'edit',
				work_in_dialog: true,
				keybind: new Keybind({key: 88, ctrl: true, shift: null}),
				click: function (event) {Clipbench.copy(event, true)}
			})

		//Move Cube Keys
			new Action({
				id: 'move_up',
				icon: 'arrow_upward',
				category: 'transform',
				condition: () => (selected.length && !open_menu && Modes.id === 'edit'),
				keybind: new Keybind({key: 38, ctrl: null, shift: null}),
				click: function (e) {moveCubesRelative(-1, 2, e)}
			})
			new Action({
				id: 'move_down',
				icon: 'arrow_downward',
				category: 'transform',
				condition: () => (selected.length && !open_menu && Modes.id === 'edit'),
				keybind: new Keybind({key: 40, ctrl: null, shift: null}),
				click: function (e) {moveCubesRelative(1, 2, e)}
			})
			new Action({
				id: 'move_left',
				icon: 'arrow_back',
				category: 'transform',
				condition: () => (selected.length && !open_menu && Modes.id === 'edit'),
				keybind: new Keybind({key: 37, ctrl: null, shift: null}),
				click: function (e) {moveCubesRelative(-1, 0, e)}
			})
			new Action({
				id: 'move_right',
				icon: 'arrow_forward',
				category: 'transform',
				condition: () => (selected.length && !open_menu && Modes.id === 'edit'),
				keybind: new Keybind({key: 39, ctrl: null, shift: null}),
				click: function (e) {moveCubesRelative(1, 0, e)}
			})
			new Action({
				id: 'move_forth',
				icon: 'keyboard_arrow_up',
				category: 'transform',
				condition: () => (selected.length && !open_menu && Modes.id === 'edit'),
				keybind: new Keybind({key: 33, ctrl: null, shift: null}),
				click: function (e) {moveCubesRelative(-1, 1, e)}
			})
			new Action({
				id: 'move_back',
				icon: 'keyboard_arrow_down',
				category: 'transform',
				condition: () => (selected.length && !open_menu && Modes.id === 'edit'),
				keybind: new Keybind({key: 34, ctrl: null, shift: null}),
				click: function (e) {moveCubesRelative(1, 1, e)}
			})

		//Settings
			new Action({
				id: 'reset_keybindings',
				icon: 'replay',
				category: 'blockbench',
				click: function () {Keybinds.reset()}
			})
			new Action({
				id: 'import_layout',
				icon: 'folder',
				category: 'blockbench',
				click: function () {
					Blockbench.import({
						extensions: ['bbstyle', 'js'],
						type: 'Blockbench Style'
					}, function(files) {
						applyBBStyle(files[0].content)
					})
				}
			})
			new Action({
				id: 'export_layout',
				icon: 'style',
				category: 'blockbench',
				click: function () {
					Blockbench.export({
						type: 'Blockbench Style',
						extensions: ['bbstyle'],
						content: autoStringify(app_colors)
					})
				}
			})
			new Action({
				id: 'reset_layout',
				icon: 'replay',
				category: 'blockbench',
				click: function () {
					colorSettingsSetup(true)
					Interface.data = $.extend(true, {}, Interface.default_data)
					Interface.data.left_bar.forEach((id) => {
						$('#left_bar').append(Interface.Panels[id].node)
					})
					Interface.data.right_bar.forEach((id) => {
						$('#right_bar').append(Interface.Panels[id].node)
					})
					updateInterface()
				}
			})

		//View
			new Action({
				id: 'fullscreen',
				icon: 'fullscreen',
				category: 'view',
				condition: isApp,
				keybind: new Keybind({key: 122}),
				click: function () {
					currentwindow.setFullScreen(!currentwindow.isFullScreen())
				}
			})
			new Action({
				id: 'zoom_in',
				icon: 'zoom_in',
				category: 'view',
				click: function () {setZoomLevel('in')}
			})
			new Action({
				id: 'zoom_out',
				icon: 'zoom_out',
				category: 'view',
				click: function () {setZoomLevel('out')}
			})
			new Action({
				id: 'zoom_reset',
				icon: 'zoom_out_map',
				category: 'view',
				click: function () {setZoomLevel('reset')}
			})

		//Find Action
			new Action({
				id: 'action_control',
				icon: 'fullscreen',
				category: 'blockbench',
				keybind: new Keybind({key: 70}),
				click: function () {
					ActionControl.select()
				}
			})

		BARS.action_definers.forEach((definer) => {
			if (typeof definer === 'function') {
				definer()
			}
		})
	},
	setupToolbars: function() {
		//
		Toolbars = {}
		var stored = localStorage.getItem('toolbars')
		if (stored && localStorage.getItem('welcomed_version') == appVersion) {
			stored = JSON.parse(stored)
			if (typeof stored === 'object') {
				BARS.stored = stored
			}
		}
		Toolbars.outliner = new Toolbar({
			id: 'outliner',
			children: [
				'add_cube',
				'add_group',
				'outliner_toggle',
				'cube_counter'
			],
			default_place: true
		})
		Toolbars.texturelist = new Toolbar({
			id: 'texturelist',
			children: [
				'import_texture',
				'create_texture',
				'reload_textures',
				'animated_textures'
			],
			default_place: true
		})
		Toolbars.tools = new Toolbar({
			id: 'tools',
			children: [
				'move_tool',
				'resize_tool',
				'rotate_tool',
				'pivot_tool',
				'vertex_snap_tool',
				'brush_tool',
				'fill_tool',
				'eraser',
				'color_picker'
			],
			default_place: true
		})
		Toolbars.rotation = new Toolbar({
			id: 'rotation',
			children: [
				'slider_rotation_x',
				'slider_rotation_y',
				'slider_rotation_z',
				'rescale_toggle',
				'bone_reset_toggle'
			],
			default_place: true
		})
		Toolbars.origin = new Toolbar({
			id: 'origin',
			children: [
				'slider_origin_x',
				'slider_origin_y',
				'slider_origin_z',
				'origin_to_geometry'
			],
			default_place: true
		})
		Toolbars.display = new Toolbar({
			id: 'display',
			children: [
				'copy',
				'paste',
				'add_display_preset'
			],
			default_place: true
		})
		//UV
		Toolbars.main_uv = new Toolbar({
			id: 'main_uv',
			children: [
				'uv_grid',
				'uv_apply_all',
				'uv_maximize',
				'uv_auto',
				'uv_transparent',
				'uv_rotation',
				//Box
				'toggle_uv_overlay',
				'uv_shift',
				'toggle_mirror_uv',
			],
			default_place: true
		})
		Toolbars.uv_dialog = new Toolbar({
			id: 'uv_dialog',
			children: [
				'uv_grid',
				'_',
				'uv_select_all',
				'uv_select_none',
				'_',
				'uv_maximize',
				'uv_auto',
				'uv_rel_auto',
				'_',
				'uv_mirror_x',
				'uv_mirror_y',
				'_',
				'copy',
				'paste',
				'_',
				'uv_transparent',
				'uv_reset',
				'_',
				'face_tint',
				'_',
				'cullface',
				'auto_cullface',
				'_',
				'uv_rotation'
			],
			default_place: true
		})
		//Animations
		Toolbars.animations = new Toolbar({
			id: 'animations',
			children: [
				'add_animation',
				'slider_animation_length',
			],
			default_place: true
		})
		Toolbars.keyframe = new Toolbar({
			id: 'keyframe',
			children: [
				'slider_keyframe_time',
				'reset_keyframe'
			],
			default_place: true
		})
		Toolbars.timeline = new Toolbar({
			id: 'timeline',
			children: [
				'slider_animation_speed',
				'previous_keyframe',
				'next_keyframe',
				'play_animation',
			],
			default_place: true
		})
		//Tools
		Toolbars.transform = new Toolbar({
			id: 'transform',
			children: [
				'slider_pos_x',
				'slider_pos_y',
				'slider_pos_z',
				'_',
				'slider_size_x',
				'slider_size_y',
				'slider_size_z',
				'_',
				'slider_inflate'
			]
		})
		Toolbars.brush = new Toolbar({
			id: 'brush',
			children: [
				'brush_mode',
				'fill_mode',
				'slider_brush_size',
				'slider_brush_opacity',
				'slider_brush_softness'
			]
		})
		Toolbars.vertex_snap = new Toolbar({
			id: 'vertex_snap',
			children: [
				'vertex_snap_mode'
			]
		})

		Toolbox = Toolbars.tools;
		Toolbox.toggleTransforms = function() {
			if (Toolbox.selected.id === 'move_tool') {
				BarItems['resize_tool'].select()
			} else if (Toolbox.selected.id === 'resize_tool') {
				BarItems['move_tool'].select()
			}
		}
		BarItems.move_tool.select()

		BarItems.reset_keybindings.toElement('#keybinds_title_bar')
		BarItems.import_layout.toElement('#layout_title_bar')
		BarItems.export_layout.toElement('#layout_title_bar')
		BarItems.reset_layout.toElement('#layout_title_bar')
		BarItems.load_plugin.toElement('#plugins_header_bar')
		BarItems.uv_dialog.toElement('#uv_title_bar')
		BarItems.uv_dialog_full.toElement('#uv_title_bar')
		BarItems.toggle_chat.toElement('#chat_title_bar')
	},
	setupVue: function() {
		BARS.list = new Vue({
			el: '#toolbar_edit',
			data: {
				showAll: true,
				items: BarItems,
				currentBar: []
			},
			computed: {
				searchedBarItems() {
					var name = $('#action_search_bar').val().toUpperCase()
					var list = [{
						icon: 'bookmark',
						name: tl('data.separator'),
						type: 'separator'
					}]
					if (this.showAll == false) {
						return list
					}
					for (var key in BarItems) {
						var item = BarItems[key]
						if (name.length == 0 ||
							item.name.toUpperCase().includes(name) ||
							item.id.toUpperCase().includes(name)
						) {
							if (
								BARS.condition(item.condition) &&
								!this.currentBar.includes(item)
							) {
								list.push(item)
							}
						}
					}
					return list;
				}
			},
			methods: {
				sort: function(event) {
					var item = this.currentBar.splice(event.oldIndex, 1)[0]
					this.currentBar.splice(event.newIndex, 0, item)
					this.update()
				},
				drop: function(event) {
					var scope = this;
					var index = event.oldIndex
					$('#bar_items_current .tooltip').css('display', '')
					setTimeout(() => {
						if ($('#bar_items_current:hover').length === 0) {
							var item = scope.currentBar.splice(event.oldIndex, 1)[0]
							item.toolbars.remove(BARS.editing_bar)
							scope.update()
						}
					}, 30)
				},
				choose: function(event) {
					$('#bar_items_current .tooltip').css('display', 'none')
				},
				update: function() {
					BARS.editing_bar.update()
				},
				addItem: function(item) {
					if (item.type === 'separator') {
						item = '_'
					}
					BARS.editing_bar.add(item)
					BARS.editing_bar.update()
				}
			}
		})
		BARS.list.updateSearch = function() {	
			BARS.list._data.showAll = !BARS.list._data.showAll
			BARS.list._data.showAll = !BARS.list._data.showAll
		}

		ActionControl.vue = new Vue({
			el: '#action_selector',
			data: {
				open: false,
				search_input: '',
				index: 0,
				length: 0,
				list: []
			},
			computed: {
				actions: function() {
					var search_input = this._data.search_input.toUpperCase()
					var list = this._data.list.empty()
					for (var i = 0; i < Keybinds.actions.length; i++) {
						var item = Keybinds.actions[i];
						if (
							search_input.length == 0 ||
							item.name.toUpperCase().includes(search_input) ||
							item.id.toUpperCase().includes(search_input)
						) {
							if (item instanceof Action && BARS.condition(item.condition)) {
								list.push(item)
								if (list.length > ActionControl.max_length) i = Infinity;
							}
						}
					}
					this._data.length = list.length;
					if (this._data.index < 0) {
						this._data.index = 0;
					}
					if (this._data.index >= list.length) {
						this._data.index = list.length-1;
					}
					return list;
				}
			}
		})
	},
	updateConditions: function() {
		for (var key in Toolbars) {
			if (Toolbars.hasOwnProperty(key) &&
				$(Toolbars[key].node).find('input[type="text"]:focus, input[type="number"]:focus, div[contenteditable="true"]:focus').length === 0
			) {
				Toolbars[key].update()
			}
		}
		uv_dialog.all_editors.forEach((editor) => {
			editor.updateInterface()
		})
		BARS.updateToolToolbar()
	},
	updateToolToolbar: function() {
		if (!Toolbars || !Toolbars[Toolbox.selected.toolbar]) return;
		Toolbars[Toolbox.selected.toolbar].children.forEach(function(action) {
			if (action.type === 'numslider') {
				action.setWidth(40)
			}
		})
		if ($('div.tool_options .toolbar').length > 0) {
			var sliders = $('header .tool.nslide_tool').length
			var space = $(window).width() - $('div.tool_options .toolbar').offset().left - $('div.tool_options .toolbar').width() - $('#mode_selector').width() + 6
			var width = limitNumber(37 + space / sliders, 40, 80)
			Toolbars[Toolbox.selected.toolbar].children.forEach(function(action) {
				if (action.type === 'numslider') {
					action.setWidth(width)
				}
			})
		}
	}
}
const ActionControl = {
	get open() {return ActionControl.vue._data.open},
	set open(state) {ActionControl.vue._data.open = !!state},
	type: 'action_selector',
	max_length: 16,
	select: function() {
		ActionControl.open = true;
		open_interface = ActionControl;
		ActionControl.vue._data.index = 0;
		Vue.nextTick(_ => {
			$('#action_selector > input').focus().select();
		})
	},
	hide: function() {
		open_interface = false;
		ActionControl.open = false;
	},
	confirm: function(e) {
		var data = ActionControl.vue._data
		var action = data.list[data.index]
		ActionControl.hide()
		if (action) {
			action.trigger(e)
		}
	},
	cancel: function() {
		ActionControl.hide()
	},
	click: function(action, e) {
		action.trigger(e)
		ActionControl.hide()
	},
	handleKeys: function(e) {
		var data = ActionControl.vue._data

		if (e.altKey) {
			ActionControl.vue.$forceUpdate()
		}

		if (e.which === 38) {
			data.index--;
			if (data.index < 0) {
				data.index = data.length-1;
			}
		} else if (e.which === 40) {
			data.index++;
			if (data.index >= data.length) {
				data.index = 0;
			}
		} else {
			return false;
		}
		return true;
	}
}

//Menu
class Menu {
	constructor(structure) {
		var scope = this;
		this.children = [];
		this.node = $('<ul class="contextMenu"></ul>')[0]
		this.structure = structure
	}
	hover(node, event) {
		if (event) event.stopPropagation()
		$(open_menu.node).find('li.focused').removeClass('focused')
		$(open_menu.node).find('li.opened').removeClass('opened')
		var obj = $(node)
		obj.addClass('focused')
		obj.parents('li.parent').addClass('opened')

		if (obj.hasClass('parent')) {
			var childlist = obj.find('> ul.contextMenu.sub')

			var p_width = obj.outerWidth()
			childlist.css('left', p_width + 'px')
			var el_width = childlist.width()
			var offset = childlist.offset()
			var el_height = childlist.height()

			if (offset.left + el_width > $(window).width()) {
				childlist.css('left', -el_width + 'px')
			}

			if (offset.top + el_height > $(window).height()) {
				childlist.css('margin-top', 4-childlist.height() + 'px')
				if (childlist.offset().top < 0) {
					var space = $(window).height() - $(window).height()
					childlist.offset({top: space/2})
				}
			}
			if (el_height > $(window).height()) {
				childlist.css('height', $(window).height()+'px').css('overflow-y', 'scroll')
			}
		}
	}
	keyNavigate(e) {
		var scope = this;
		var used;
		var obj = $(this.node)
		if (e.which >= 37 && e.which <= 40) {

			if (obj.find('li.focused').length) {
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
				} else if (scope.type === 'bar_menu' && e.which%2) {
					var index = MenuBar.keys.indexOf(scope.id)
					index += (e.which == 39 ? 1 : -1)
					if (index < 0) {
						index = MenuBar.keys.length-1
					} else if (index >= MenuBar.keys.length) {
						index = 0;
					}
					MenuBar.menues[MenuBar.keys[index]].open()
				}
			} else {
				obj.find('> li:first-child').addClass('focused')
			}
			used = true;
		} else if (Keybinds.extra.confirm.keybind.isTriggered(e)) {
			obj.find('li.focused').click()
			if (scope) {
				scope.hide()
			}
			used = true;
		} else if (Keybinds.extra.cancel.keybind.isTriggered(e)) {
			scope.hide()
			used = true;
		}
		return used;
	}
	open(position, context) {

		var scope = this;
		var ctxmenu = $(this.node)
		if (open_menu) {
			open_menu.hide()
		}
		$('body').append(ctxmenu)

		ctxmenu.children().detach()

		function getEntry(s, parent) {

			var entry;
			if (s === '_') {
				entry = new MenuSeparator().menu_node
				var last = parent.children().last()
				if (last.length && !last.hasClass('menu_separator')) {
					parent.append(entry)
				}
			} else if (typeof s === 'string' || s instanceof Action) {
				if (typeof s === 'string') {
					s = BarItems[s]
				}
				if (!s) {
					return;
				}
				entry = s.menu_node
				if (BARS.condition(s.condition)) {

					if (!entry.hasMenuEvents) {
						entry.hasMenuEvents = true
						entry.addEventListener('click', (e) => {s.trigger(e)})
						$(entry).on('mouseenter mousedown', function(e) {
							scope.hover(this, e)
						})
					}
					parent.append(entry)
				}
			} else if (typeof s === 'object') {

				if (BARS.condition(s.condition, context)) {
					if (typeof s.icon === 'function') {
						var icon = Blockbench.getIconNode(s.icon(context), s.color)
					} else {
						var icon = Blockbench.getIconNode(s.icon, s.color)
					}
					entry = $('<li>' + tl(s.name) + '</li>')
					entry.prepend(icon)
					if (typeof s.click === 'function') {
						entry.click(function(e) {s.click(context, e)})
					}
					//Submenu
					if (typeof s.children == 'function' || typeof s.children == 'object') {
						if (typeof s.children == 'function') {
							var list = s.children(context)
						} else {
							var list = s.children
						}
						if (list.length) {
							entry.addClass('parent')
							var childlist = $('<ul class="contextMenu sub"></ul>')
							entry.append(childlist)
							list.forEach(function(s2, i) {
								getEntry(s2, childlist)
							})
							var last = childlist.children().last()
							if (last.length && last.hasClass('menu_separator')) {
								last.remove()
							}
						}
					}
					parent.append(entry)
					entry.mouseenter(function(e) {
						scope.hover(this, e)
					})
				}
			}
		}

		scope.structure.forEach(function(s, i) {
			getEntry(s, ctxmenu)
		})
		var last = ctxmenu.children().last()
		if (last.length && last.hasClass('menu_separator')) {
			last.remove()
		}

		var el_width = ctxmenu.width()
		var el_height = ctxmenu.height()

		if (position && position.clientX !== undefined) {
			var offset_left = position.clientX
			var offset_top  = position.clientY+1
		} else {
			if (!position && scope.type === 'bar_menu') {
				position = scope.label
			}
			var offset_left = $(position).offset().left
			var offset_top  = $(position).offset().top + $(position).height()+3
		}

		if (offset_left > $(window).width() - el_width) {
			offset_left -= el_width
		}
		if (offset_top  > $(window).height() - el_height ) {
			offset_top -= el_height
		}

		ctxmenu.css('left', offset_left+'px')
		ctxmenu.css('top',  offset_top +'px')

		$(scope.node).filter(':not(.tx)').addClass('tx').click(function(ev) {
			if (
				ev.target.className.includes('parent') ||
				(ev.target.parentNode && ev.target.parentNode.className.includes('parent'))
			) {} else {
				scope.hide()
			}

		})

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
		$(this.node).detach()
		open_menu = undefined;
		return this;
	}
	conditionMet() {
		if (this.condition === undefined) {
			return true;
		} else if (typeof this.condition === 'function') {
			return this.condition()
		} else {
			return !!this.condition
		}
	}
	addAction(action, path) {

		if (path === undefined) path = ''
		path = path.split('.')

		function traverse(arr, layer) {
			if (path.length === layer || path[layer] === '' || !isNaN(parseInt(path[layer]))) {
				var index = arr.length;
				if (path[layer] !== '' && path.length !== layer) {
					index = parseInt(path[layer])
				}
				arr.splice(index, 0, action)
			} else {
				for (var i = 0; i < arr.length; i++) {
					var item = arr[i]
					if (item.children && item.children.length > 0 && item.id === path[layer] && layer < 20) {
						traverse(item.children, layer+1)
						i = 1000
					}
				}
			}
		}
		traverse(this.structure, 0)
	}
	removeAction(path) {

		if (path === undefined) path = ''
		path = path.split('.')

		function traverse(arr, layer) {
			var result;
			if (!isNaN(parseInt(path[layer]))) {
				result = arr[parseInt(path[layer])]

			} else if (typeof path[layer] === 'string') {
				var i = arr.length-1;
				while (i >= 0) {
					var item = arr[i]
					if (item.id === path[layer] && layer < 20) {
						if (layer === path.length-1) {
							arr.splice(i, 1)
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
}
class BarMenu extends Menu {
	constructor(id, structure, condition) {
		super()
		var scope = this;
		MenuBar.menues[id] = this
		this.type = 'bar_menu'
		this.id = id
		this.children = [];
		this.condition = condition
		this.node = $('<ul class="contextMenu"></ul>')[0]
		this.label = $('<li class="menu_bar_point">'+tl('menu.'+id)+'</li>')[0]
		$(this.label).click(function() {
			if (open_menu === scope) {
				scope.hide()
			} else {
				scope.open()
			}
		})
		$(this.label).mouseenter(function() {
			if (MenuBar.open && MenuBar.open !== scope) {
				scope.open()
			}
		})
		this.structure = structure
	}
	hide() {
		$(this.node).detach()
		$(this.label).removeClass('opened')
		MenuBar.open = undefined
		open_menu = undefined;
		return this;
	}
}
const MenuBar = {
	menues: {},
	open: undefined,
	setup: function() {
		new BarMenu('file', [
			'project_window',
			'_',
			{name: 'menu.file.new', id: 'new', icon: 'insert_drive_file', condition: () => (!EditSession.active || EditSession.hosting), children: [
				'new_block_model',
				'new_entity_model',
			]},
			{name: 'menu.file.recent', id: 'recent', icon: 'history', condition: function() {return isApp && recent_projects.length && (!EditSession.active || EditSession.hosting)}, children: function() {
				var arr = []
				recent_projects.forEach(function(p) {
					switch (p.icon_id) {
						default: var icon = 'fa-file-o'; break;
						case 1:  var icon = 'icon-blockbench_file'; break;
						case 2:  var icon = 'fa-file-text-o'; break;
					}
					arr.splice(0, 0, {
						name: p.name,
						path: p.path,
						icon: icon,
						click: function(c, event) {
							readFile(p.path, !event.shiftKey)
						}
					})
				})
				return arr
			}},
			'open_model',
			{name: 'menu.file.import', id: 'import', icon: 'insert_drive_file', children: [
				'add_model',
				'extrude_texture'
			]},
			{name: 'menu.file.export', id: 'export', icon: 'insert_drive_file', children: [
				'export_blockmodel',
				'export_entity',
				'export_class_entity',
				'export_optifine_part',
				'export_optifine_full',
				'export_obj',
				'upload_sketchfab'
			]},
			'export_bbmodel',
			'export_asset_archive',
			'save',
			'_',
			'settings_window',
			'edit_session',
			'update_window',
			'donate',
			'reload'
		])
		new BarMenu('edit', [
			'undo',
			'redo',
			'_',
			'add_cube',
			'add_group',
			'duplicate',
			'delete',
			'_',
			'local_move',
			'_',
			'select_window',
			'invert_selection'
		], () => (!display_mode && !Animator.open))
		new BarMenu('transform', [
			'scale',
			{name: 'menu.transform.rotate', id: 'rotate', icon: 'rotate_90_degrees_ccw', children: [
				'rotate_x_cw',
				'rotate_x_ccw',
				'rotate_y_cw',
				'rotate_y_ccw',
				'rotate_z_cw',
				'rotate_z_ccw'
			]},
			{name: 'menu.transform.flip', id: 'flip', icon: 'flip', children: [
				'flip_x',
				'flip_y',
				'flip_z'
			]},
			{name: 'menu.transform.center', id: 'center', icon: 'filter_center_focus', children: [
				'center_x',
				'center_y',
				'center_z',
				'center_all'
			]},
			{name: 'menu.transform.properties', id: 'properties', icon: 'navigate_next', children: [
				'toggle_visibility',
				'toggle_export',
				'toggle_autouv',
				'toggle_shade',
				'toggle_mirror_uv',
				'rename'
			]}

		], () => (!display_mode && !Animator.open))

		new BarMenu('display', [
			'copy',
			'paste',
			'_',
			'add_display_preset',
			{name: 'menu.display.preset', icon: 'fa-list', children: function() {
				var presets = []
				display_presets.forEach(function(p) {
					var icon = 'label'
					if (p.fixed) {
						switch(p.id) {
							case 'item': icon = 'filter_vintage'; break;
							case 'block': icon = 'fa-cube'; break;
							case 'handheld': icon = 'build'; break;
							case 'rod': icon = 'remove'; break;
						}
					}
					presets.push({
						icon: icon,
						name: p.id ? tl('display.preset.'+p.id) : p.name,
						click: function() {
							DisplayMode.applyPreset(p)
						}
					})
				})
				return presets;
			}},
			{name: 'menu.display.preset_all', icon: 'fa-list', children: function() {
				var presets = []
				display_presets.forEach(function(p) {
					var icon = 'label'
					if (p.fixed) {
						switch(p.id) {
							case 'item': icon = 'filter_vintage'; break;
							case 'block': icon = 'fa-cube'; break;
							case 'handheld': icon = 'build'; break;
							case 'rod': icon = 'remove'; break;
						}
					}
					presets.push({
						icon: icon,
						name: p.id ? tl('display.preset.'+p.id) : p.name,
						click: function() {
							DisplayMode.applyPreset(p, true)
						}
					})
				})
				return presets;
			}},
			{name: 'menu.display.remove_preset', icon: 'fa-list', children: function() {
				var presets = []
				display_presets.forEach(function(p) { 
					if (!p.fixed) {
						presets.push({
							icon: 'label',
							name: p.name,
							click: function() {
								display_presets.splice(display_presets.indexOf(p),1)
							}
						})
					}
				})
				return presets;
			}}
		], () => display_mode)
		
		new BarMenu('filter', [
			'plugins_window',
			'_',
			/*
			plaster
			optimize
			sort by transparency
			entity / player model / shape generator
			*/

		])

		new BarMenu('animation', [
			'copy',
			'paste',
			'select_all_keyframes',
			'delete_keyframes',
			'_',
			'load_animation_file',
			'export_animation_file',
		], () => Animator.open)


		new BarMenu('view', [
			'fullscreen',
			{name: 'menu.view.zoom', id: 'zoom', condition: isApp, icon: 'search', children: [
				'zoom_in',
				'zoom_out',
				'zoom_reset'
			]},
			'_',
			'toggle_wireframe',
			'toggle_quad_view',
			{name: 'menu.view.screenshot', id: 'screenshot', icon: 'camera_alt', children: [
				'screenshot_model',
				'screenshot_app',
				'record_model_gif',
			]},
		])
		MenuBar.update()
	},
	update: function() {
		var bar = $('#menu_bar')
		bar.children().detach()
		this.keys = []
		for (var menu in MenuBar.menues) {
			if (MenuBar.menues.hasOwnProperty(menu)) {
				if (MenuBar.menues[menu].conditionMet()) {
					bar.append(MenuBar.menues[menu].label)
					this.keys.push(menu)
				}
			}
		}
	},
	getNode: function(data) {	
	},
	addAction: function(action, path) {
		if (path) {
			path = path.split('.')
			var menu = MenuBar.menues[path.splice(0, 1)[0]]
			if (menu) {
				menu.addAction(action, path.join('.'))
			}
		}
	},
	removeAction: function(path) {
		if (path) {
			path = path.split('.')
			var menu = MenuBar.menues[path.splice(0, 1)[0]]
			if (menu) {
				menu.removeAction(path.join('.'))
			}
		}
	}
}
const Keybinds = {
	actions: [],
	stored: {},
	extra: {},
	structure: {},
	save: function() {
		localStorage.setItem('keybindings', JSON.stringify(Keybinds.stored))
	},
	reset: function() {
		for (var category in Keybinds.structure) {
			var entries = Keybinds.structure[category].actions
			if (entries && entries.length) {
				entries.forEach(function(item) {
					if (item.keybind) {
						if (item.default_keybind) {
							item.keybind.set(item.default_keybind);
						} else {
							item.keybind.clear();
						}
						item.keybind.save(false)
					}
				})
			}
		}
		Keybinds.save()
	}
}
if (localStorage.getItem('keybindings')) {
	try {
		Keybinds.stored = JSON.parse(localStorage.getItem('keybindings'))
	} catch (err) {}
}

Toolbar.prototype.menu = new Menu([
	//Needs to be down here because Menu isn't defined before
	{name: 'menu.toolbar.edit', icon: 'edit', click: function(bar) {
		bar.editMenu()
	}},
	{name: 'menu.toolbar.reset', icon: 'refresh', click: function(bar) {
		bar.reset()
	}}
])