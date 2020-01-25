var Toolbars, BarItems, Toolbox;
//Bars
class MenuSeparator {
	constructor() {
		this.menu_node = $('<li class="menu_separator"></li>')
	}
}
class BarItem {
	constructor(id, data) {
		this.id = id;
		if (!data.private) {
			BarItems[this.id] = this;
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
				if ($(this).parent().parent().hasClass('vertical')) {
					tooltip.css('margin', '0')
					if ($(this).offset().left > window.innerWidth/2) {
						tooltip.css('margin-left', (-tooltip.width()-3) + 'px')
					} else {
						tooltip.css('margin-left', '34px')
					}
				} else {
					if (!tooltip || typeof tooltip.offset() !== 'object') return;

					tooltip.css('margin-left', '0')
					var offset = tooltip.offset()
					offset.right = offset.left + parseInt(tooltip.css('width').replace(/px/, '')) - $(window).width()

					if (offset.right > 4) {
						tooltip.css('margin-left', -offset.right+'px')
					}
				}
			})
		}
	}
	getNode() {
		var scope = this;
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
		this.name = tl('keybind.'+this.id)
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
			this.description = tl('settings.'+data.linked_setting+'.desc')
			this.linked_setting = data.linked_setting
		}
		if (data.condition) this.condition = data.condition

		//Node
		this.click = data.click
		this.icon_node = Blockbench.getIconNode(this.icon, this.color)
		this.node = $(`<div class="tool ${this.id}"></div>`).get(0)
		this.nodes = [this.node]
		this.menus = [];
		this.menu_node = $(`<li title="${this.description||''}">${this.name}</li>`).get(0)
		$(this.node).add(this.menu_node).append(this.icon_node)
		this.addLabel()
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
	delete() {
		super.delete();
		for (var i = this.menus.length-1; i >= 0; i--) {
			var m = this.menus[i]
			if (m.menu) {
				m.path += (m.path ? '.' : '') + this.id; 
				m.menu.removeAction(m.path)
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
		this.selectCubes = data.selectCubes !== false;
		this.paintTool = data.paintTool;
		this.transformerMode = data.transformerMode;
		this.animation_channel = data.animation_channel;
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

		if (typeof this.onSelect == 'function') {
			this.onSelect()
		}
		$('#preview').css('cursor', (this.cursor ? this.cursor : 'default'))
		$('.tool.sel').removeClass('sel')
		$('.tool.'+this.id).addClass('sel')
		updateSelection()
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
		if (typeof data.get === 'function') this.get = data.get;
		this.onBefore = data.onBefore;
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
				return canvasGridSize(event.shiftKey, event.ctrlOrCmd);
			};
		}
		if (typeof data.getInterval === 'function') {
			this.interval = data.getInterval;
		}
		if (this.keybind) {
			this.keybind.shift = null;
		}
		var scope = this;
		var css_color = 'xyz'.includes(this.color) ? `var(--color-axis-${this.color})` : this.color;
		this.node = $( `<div class="tool wide widget nslide_tool">
							<div class="nslide_overlay">
								<div class="color_corner" style="border-color: ${css_color}"></div>
							</div>
							<div class="tooltip">${this.name}</div>
							<div class="nslide tab_target" n-action="${this.id}"></div>
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
				scope.sliding = true;
				scope.pre = 0;
				scope.left = ui.position.left
				scope.last_value = scope.value
			},
			drag: function(event, ui) {
				scope.slide(event, ui)
			},
			stop: function() {
				delete scope.sliding;
				Blockbench.setStatusBarText();
				if (typeof scope.onAfter === 'function') {
					scope.onAfter(scope.value - scope.last_value)
				}
			}
		})
		//Input
		.keypress(function (e) {
			if (e.keyCode === 10 || e.keyCode === 13) {
				e.preventDefault();
				scope.stopInput();
			}
		})
		.keyup(function (e) {
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
		})
		.dblclick(function(event) {
			if (event.target != this) return;
			scope.jq_inner.text('0');
			scope.stopInput()

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
		$(this.node).width(width)
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
	slide(event, ui) {
		var offset = Math.round((event.clientX-this.left)/30)-1
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
		var scope = this;
		var text = this.jq_inner.text();
		if (this.last_value !== text) {
			var first_token = text.substr(0, 1);

			if (typeof this.onBefore === 'function') {
				this.onBefore()
			}

			if (text.match(/^-?\d*(\.\d+)?$/gm)) {
				var number = parseFloat(text);
				if (isNaN(number)) {
					number = 0;
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
						return Molang.parse(val + text, variables)
					} else {
						return Molang.parse(text, variables)
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
		if (typeof this.onBefore === 'function') {
			this.onBefore()
		}
		var difference = this.getInterval(false) * event.shiftKey ? -1 : 1;
		this.change(n => n + difference)
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
		return this;
	}
	change(modify) {
		//Solo sliders only, gets overwritten for most sliders
		var num = modify(this.get());
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
		if (isNaN(number)) {
			this.jq_outer.find('.nslide:not(.editing)').text('')
		}
		if (this.sliding) {
			$('#nslide_head #nslide_offset').text(this.name+': '+this.value)
		}
	}
}
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
		this.value = data.value||0
		this.node = $('<div class="tool widget">'+
			'<input type="range"'+
				' value="'+(data.value?data.value:0)+'" '+
				' min="'+(data.min?data.min:0)+'" '+
				' max="'+(data.max?data.max:10)+'" '+
				' step="'+(data.step?data.step:1)+'" '+
				' style="width: '+(data.width?data.width:'auto')+'px;">'+
		'</div>').get(0)
		this.addLabel()
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
		this.node = $('<div class="tool widget bar_select"><div class="bar_select_wrapper"><select></select></div></div>').get(0)
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
		this.addLabel()
		if (typeof data.onChange === 'function') {
			this.onChange = data.onChange
		}
		$(this.node).find('select').change(function(event) {
			scope.change(event)
		})
		$(this.node).on('mousewheel', event => {
			scope.trigger(event.originalEvent);
		})
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
			if (event.type === 'mousewheel' || event.type === 'wheel') {
				index += event.deltaY < 0 ? -1 : 1;
			} else {
				index++;
				if (index >= this.values.length) index = 0;
			}
			if (index >= 0 && index < this.values.length) {
				this.set(this.values[index]);
				if (this.onChange) {
					this.onChange(this, event);
				}
			}
			
			scope.uses++;
			return true;
		}
		return false;
	}
	change(event) {
		this.set( $(event.target).find('option:selected').prop('id') );
		if (this.onChange) {
			this.onChange(this, event);
		}
		return this;
	}
	set(id) {
		this.value = id
		$(this.nodes).find('option#'+id).prop('selected', true).siblings().prop('selected', false);
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
		if (data) {
			this.id = data.id
			this.narrow = !!data.narrow
			this.vertical = !!data.vertical
			this.default_children = data.children.slice()
		}
		var jq = $(`<div class="toolbar">
			<div class="content"></div>
			<div class="tool toolbar_menu">
				<i class="material-icons">${this.vertical ? 'more_horiz' : 'more_vert'}</i>
			</div>
		</div>`)
		this.node = jq.get(0)
		BarItem.prototype.addLabel(false, {
			name: tl('data.toolbar'),
			node: jq.find('.tool.toolbar_menu').get(0)
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
				keybind: new Keybind({key: Blockbench.isMobile ? 0 : 1, ctrl: null, shift: null, alt: null})
			})
			new KeybindItem('preview_rotate', {
				category: 'navigate',
				keybind: new Keybind({key: 1})
			})
			new KeybindItem('preview_drag', {
				category: 'navigate',
				keybind: new Keybind({key: 3})
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
				icon: 'fas.fa-hand-paper',
				category: 'tools',
				selectFace: true,
				transformerMode: 'translate',
				animation_channel: 'position',
				toolbar: Blockbench.isMobile ? 'element_position' : 'main_tools',
				alt_tool: 'resize_tool',
				modes: ['edit', 'display', 'animate'],
				keybind: new Keybind({key: 86}),
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
				keybind: new Keybind({key: 83}),
			})
			new Tool('rotate_tool', {
				icon: 'sync',
				category: 'tools',
				selectFace: true,
				transformerMode: 'rotate',
				animation_channel: 'rotation',
				toolbar: Blockbench.isMobile ? 'element_rotation' : 'main_tools',
				alt_tool: 'pivot_tool',
				modes: ['edit', 'display', 'animate'],
				keybind: new Keybind({key: 82})
			})
			new Tool('pivot_tool', {
				icon: 'gps_fixed',
				category: 'tools',
				transformerMode: 'translate',
				toolbar: Blockbench.isMobile ? 'element_origin' : 'main_tools',
				alt_tool: 'rotate_tool',
				modes: ['edit', 'animate'],
				keybind: new Keybind({key: 80}),
			})
			new Tool('vertex_snap_tool', {
				icon: 'icon-vertexsnap',
				transformerMode: 'hidden',
				toolbar: 'vertex_snap',
				category: 'tools',
				selectCubes: true,
				cursor: 'copy',
				modes: ['edit'],
				keybind: new Keybind({key: 88}),
				onCanvasClick(data) {
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
			new BarSelect('vertex_snap_mode', {
				options: {
					move: true,
					scale: true
				},
				category: 'edit'
			})
			new Action('swap_tools', {
				icon: 'swap_horiz',
				category: 'tools',
				condition: {modes: ['edit', 'paint', 'display']},
				keybind: new Keybind({key: 32}),
				click: function () {
					if (BarItems[Toolbox.selected.alt_tool]) {
						BarItems[Toolbox.selected.alt_tool].select()
					}
				}
			})

		//File
			new Action('open_model_folder', {
				icon: 'folder_open',
				category: 'file',
				condition: () => {return isApp && (ModelMeta.save_path || ModelMeta.export_path)},
				click: function () {
					shell.showItemInFolder(ModelMeta.export_path || ModelMeta.save_path);
				}
			})
			new Action('open_backup_folder', {
				icon: 'fa-archive',
				category: 'file',
				condition: () => isApp,
				click: function (e) {
					shell.showItemInFolder(app.getPath('userData')+osfs+'backups'+osfs+'.')
				}
			})
			new Action('settings_window', {
				icon: 'settings',
				category: 'blockbench',
				keybind: new Keybind({key: 69, ctrl: true}),
				click: function () {Settings.open()}
			})
			new Action('update_window', {
				icon: 'update',
				category: 'blockbench',
				condition: isApp,
				click: function () {checkForUpdates()}
			})
			new Action('reload', {
				icon: 'refresh',
				category: 'file',
				condition: () => Blockbench.hasFlag('dev'),
				click: function () {Blockbench.reload()}
			})

		//Edit Generic
			new Action('rename', {
				icon: 'text_format',
				category: 'edit',
				keybind: new Keybind({key: 113}),
				click: function () {
					if (Modes.edit || Modes.paint) {
						renameOutliner()
					} else if (Prop.active_panel == 'animations' && Animator.selected) {
						Animator.selected.rename()
					}
				}
			})
			new Action('delete', {
				icon: 'delete',
				category: 'edit',
				//condition: () => (Modes.edit && (selected.length || Group.selected)),
				keybind: new Keybind({key: 46}),
				click: function () {
					if (Prop.active_panel == 'textures' && textures.selected) {
						textures.selected.remove()
					} else if (Prop.active_panel == 'color' && ColorPanel.vue._data.open_tab == 'palette') {
						if (ColorPanel.vue._data.palette.includes(ColorPanel.vue._data.main_color)) {
							ColorPanel.vue._data.palette.remove(ColorPanel.vue._data.main_color)
						}
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
						updateSelection()
						Undo.finishEdit('delete elements')

					} else if (Prop.active_panel == 'animations' && Animator.selected) {
						Animator.selected.remove(true)

					} else if (Animator.open) {
						removeSelectedKeyframes()
					}
				}
			})
			new Action('duplicate', {
				icon: 'content_copy',
				category: 'edit',
				condition: () => (Animator.selected && Modes.animate) || (Modes.edit && (selected.length || Group.selected)),
				keybind: new Keybind({key: 68, ctrl: true}),
				click: function () {
					if (Modes.animate) {
						if (Animator.selected && Prop.active_panel == 'animations') {
							var copy = Animator.selected.getUndoCopy();
							var animation = new Animation(copy);
							animation.createUniqueName();
							Animator.animations.splice(Animator.animations.indexOf(Animator.selected)+1, 0, animation)
							animation.add(true).select();
						}
					} else if (Group.selected && (Group.selected.matchesSelection() || selected.length === 0)) {
						var cubes_before = elements.length;
						Undo.initEdit({outliner: true, elements: [], selection: true});
						var g = Group.selected.duplicate();
						g.select();
						Undo.finishEdit('duplicate_group', {outliner: true, elements: elements.slice().slice(cubes_before), selection: true})
					} else {
						var added_elements = [];
						Undo.initEdit({elements: added_elements, outliner: true, selection: true})
						selected.forEach(function(obj, i) {
							var copy = obj.duplicate();
							added_elements.push(copy);
						})
						BarItems.move_tool.select();
						Undo.finishEdit('duplicate')
					}
				}
			})


		//Settings
			new Action('reset_keybindings', {
				icon: 'replay',
				category: 'blockbench',
				click: function () {Keybinds.reset()}
			})



		//View
			new Action('fullscreen', {
				icon: 'fullscreen',
				category: 'view',
				condition: isApp,
				keybind: new Keybind({key: 122}),
				click: function () {
					currentwindow.setFullScreen(!currentwindow.isFullScreen())
				}
			})
			new Action('zoom_in', {
				icon: 'zoom_in',
				category: 'view',
				click: function () {setZoomLevel('in')}
			})
			new Action('zoom_out', {
				icon: 'zoom_out',
				category: 'view',
				click: function () {setZoomLevel('out')}
			})
			new Action('zoom_reset', {
				icon: 'zoom_out_map',
				category: 'view',
				click: function () {setZoomLevel('reset')}
			})

		//Find Action
			new Action('action_control', {
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
	setupToolbars() {
		//
		Toolbars = {}
		var stored = localStorage.getItem('toolbars')
		if (stored && !Blockbench.hasFlag('after_update')) {
			stored = JSON.parse(stored)
			if (typeof stored === 'object') {
				BARS.stored = stored;
			}
		}
		Toolbars.outliner = new Toolbar({
			id: 'outliner',
			children: [
				'add_cube',
				'add_group',
				'outliner_toggle',
				'toggle_skin_layer',
				'cube_counter'
			],
			default_place: true
		})

		//update 3.3
		if (!Toolbars.outliner.children.includes(BarItems.toggle_skin_layer)) {
			Toolbars.outliner.add(BarItems.toggle_skin_layer, -1)
		}
		//update 3.3.1
		if (!Toolbars.outliner.children.includes(BarItems.cube_counter)) {
			Toolbars.outliner.add(BarItems.cube_counter)
		}

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
			vertical: Blockbench.isMobile,
			default_place: true
		})


		Toolbars.element_position = new Toolbar({
			id: 'element_position',
			children: [
				'slider_pos_x',
				'slider_pos_y',
				'slider_pos_z',
				'local_move'
			],
			default_place: !Blockbench.isMobile
		})
		Toolbars.element_size = new Toolbar({
			id: 'element_size',
			children: [
				'slider_size_x',
				'slider_size_y',
				'slider_size_z',
				'slider_inflate'
			],
			default_place: !Blockbench.isMobile
		})
		Toolbars.element_origin = new Toolbar({
			id: 'element_origin',
			children: [
				'slider_origin_x',
				'slider_origin_y',
				'slider_origin_z',
				'origin_to_geometry'
			],
			default_place: !Blockbench.isMobile
		})
		Toolbars.element_rotation = new Toolbar({
			id: 'element_rotation',
			children: [
				'slider_rotation_x',
				'slider_rotation_y',
				'slider_rotation_z',
				'rescale_toggle'
			],
			default_place: !Blockbench.isMobile
		})
		/*
		Toolbars.bone_ik = new Toolbar({
			id: 'bone_ik',
			children: [
				'ik_enabled',
				'slider_ik_chain_length'
			],
			default_place: !Blockbench.isMobile
		})*/


		Toolbars.palette = new Toolbar({
			id: 'palette',
			children: [
				'import_palette',
				'export_palette',
				'generate_palette',
				'sort_palette',
			]
		})
		Toolbars.color_picker = new Toolbar({
			id: 'color_picker',
			children: [
				'slider_color_h',
				'slider_color_s',
				'slider_color_v',
				'add_to_palette'
			]
		})



		Toolbars.display = new Toolbar({
			id: 'display',
			children: [
				'copy',
				'paste',
				'add_display_preset',
				'gui_light'
			],
			default_place: true
		})
		//update 3.3.1
		if (!Toolbars.display.children.includes(BarItems.gui_light)) {
			Toolbars.display.add(BarItems.gui_light)
		}
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
				'change_keyframe_file',
				'reset_keyframe'
			],
			default_place: true
		})
		Toolbars.timeline = new Toolbar({
			id: 'timeline',
			children: [
				'timeline_focus',
				'clear_timeline',
				'select_effect_animator',
				'add_marker',
				'_',
				'slider_animation_speed',
				'previous_keyframe',
				'next_keyframe',
				'play_animation',
			],
			default_place: true
		})
		//update 3.3
		if (!Toolbars.timeline.children.includes(BarItems.add_marker)) {
			Toolbars.timeline.add(BarItems.add_marker, 3)
		}
		//Tools
		Toolbars.main_tools = new Toolbar({
			id: 'main_tools',
			children: [
			]
		})
		Toolbars.brush = new Toolbar({
			id: 'brush',
			children: [
				'brush_mode',
				'fill_mode',
				'_',
				'slider_brush_size',
				'slider_brush_opacity',
				'slider_brush_min_opacity',
				'slider_brush_softness',
				'_',
				'painting_grid',
			]
		})
		Toolbars.vertex_snap = new Toolbar({
			id: 'vertex_snap',
			children: [
				'vertex_snap_mode'
			]
		})

		//Mobile
		Toolbars.mobile_side = new Toolbar({
			id: 'mobile_side',
			children: [
				'sidebar_right',
				'sidebar_left',
				'action_control',
			],
			vertical: true,
			default_place: Blockbench.isMobile
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
		BarItems.load_plugin.toElement('#plugins_header_bar')
		BarItems.uv_dialog.toElement('#uv_title_bar')
		BarItems.uv_dialog_full.toElement('#uv_title_bar')
		BarItems.toggle_chat.toElement('#chat_title_bar')
	},
	setupVue() {
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
					this.update();
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
					BARS.editing_bar.update().save();
				},
				addItem: function(item) {
					if (item.type === 'separator') {
						item = '_'
					}
					BARS.editing_bar.add(item);
					BARS.editing_bar.update().save();
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
	updateConditions() {
		var open_input = $('input[type="text"]:focus, input[type="number"]:focus, div[contenteditable="true"]:focus')[0]
		for (var key in Toolbars) {
			if (Toolbars.hasOwnProperty(key) &&
				(!open_input || $(Toolbars[key].node).has(open_input).length === 0)
			) {
				Toolbars[key].update()
			}
		}
		uv_dialog.all_editors.forEach((editor) => {
			editor.updateInterface()
		})
		BARS.updateToolToolbar()
	},
	updateToolToolbar() {
		if (!Toolbars || !Toolbars[Toolbox.selected.toolbar]) return;
		Toolbars[Toolbox.selected.toolbar].children.forEach(function(action) {
			if (action.type === 'numslider') {
				action.setWidth(40)
			}
		})
		var tool_toolbar = $('#main_toolbar .tool_options')
		if (tool_toolbar.find('.toolbar').length > 0) {
			var sliders = tool_toolbar.find('.tool.nslide_tool').length
			var space = tool_toolbar.width()-50
			var width = limitNumber(space / sliders, 40, 72)
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
	max_length: 32,
	select() {
		ActionControl.open = true;
		open_interface = ActionControl;
		ActionControl.vue._data.index = 0;
		Vue.nextTick(_ => {
			$('#action_selector > input').focus().select();
		})
	},
	hide() {
		open_interface = false;
		ActionControl.open = false;
	},
	confirm(e) {
		var data = ActionControl.vue._data
		var action = data.list[data.index]
		ActionControl.hide()
		if (action) {
			ActionControl.trigger(action, e)
		}
	},
	cancel() {
		ActionControl.hide()
	},
	trigger(action, e) {
		if (action.id == 'action_control') {
			$('body').effect('shake');
			Blockbench.showQuickMessage('Congratulations! You have discovered recursion!', 3000)
		}
		action.trigger(e)
	},
	click(action, e) {
		ActionControl.trigger(action, e)
		ActionControl.hide()
	},
	handleKeys(e) {
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

const Keybinds = {
	actions: [],
	stored: {},
	extra: {},
	structure: {
		search_results: {
			name: tl('dialog.settings.search_results'),
			hidden: true,
			open: true,
			actions: {}
		}
	},
	save() {
		localStorage.setItem('keybindings', JSON.stringify(Keybinds.stored))
	},
	reset() {
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

