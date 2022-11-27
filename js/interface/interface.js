class ResizeLine {
	constructor(id, data) {
		var scope = this;
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		this.id = id
		this.horizontal = data.horizontal === true
		this.position = data.position
		this.condition = data.condition
		this.width = 0;
		this.get = data.get;
		this.set = data.set;
		this.node = document.createElement('div');
		this.node.className = 'resizer '+(data.horizontal ? 'horizontal' : 'vertical');
		this.node.id = 'resizer_'+this.id;
		$(this.node).draggable({
			axis: this.horizontal ? 'y' : 'x',
			containment: '#work_screen',
			revert: true,
			revertDuration: 0,
			start(e, u) {
				scope.before = data.get()
			},
			drag(e, u) {
				if (scope.horizontal) {
					data.set(scope.before, u.position.top - u.originalPosition.top)
				} else {
					data.set(scope.before, (u.position.left - u.originalPosition.left))
				}
				updateInterface()
			},
			stop(e, u) {
				updateInterface()
			}
		})
	}
	update() {
		if (BARS.condition(this.condition)) {
			$(this.node).show()
			if (this.position) {
				this.position.call(this, this)
			}
		} else {
			$(this.node).hide()
		}
	}
	setPosition(data) {
		var jq = $(this.node)
		jq.css('top', 	data.top 	!== undefined ? data.top+	'px' : '')
		jq.css('bottom',data.bottom !== undefined ? data.bottom+'px' : '')
		jq.css('left', 	data.left 	!== undefined ? data.left+	'px' : '')
		jq.css('right', data.right 	!== undefined ? data.right+	'px' : '')

		if (data.top !== undefined) {
			jq.css('top', data.top+'px')
		}
		if (data.bottom !== undefined && (!this.horizontal || data.top === undefined)) {
			jq.css('bottom', data.bottom+'px')
		}
		if (data.left !== undefined) {
			jq.css('left', data.left+'px')
		}
		if (data.right !== undefined && (this.horizontal || data.left === undefined)) {
			jq.css('right', data.right+'px')
		}
	}
}
const Interface = {
	default_data: {
		left_bar_width: 366,
		right_bar_width: 314,
		quad_view_x: 50,
		quad_view_y: 50,
		timeline_head: Blockbench.isMobile ? 140 : 196,
		left_bar: ['uv', 'color', 'textures', 'display', 'animations', 'keyframe', 'variable_placeholders'],
		right_bar: ['element', 'bone', 'color', 'skin_pose', 'outliner', 'chat'],
		panels: {
			paint: {
				slot: 'left_bar',
				float_position: [300, 0],
				float_size: [500, 600],
				height: window.innerHeight/2-50
			},
			color_2d: {
				slot: 'left_bar',
				float_position: [50, 0],
				float_size: [300, 400],
				height: 400
			}
		}
	},
	get left_bar_width() {
		return Prop.show_left_bar && Interface.getLeftPanels().length ? Interface.data.left_bar_width : 0;
	},
	get right_bar_width() {
		return Prop.show_right_bar && Interface.getRightPanels().length ? Interface.data.right_bar_width : 0;
	},
	get top_panel_height() {
		return 1;
	},
	get bottom_panel_height() {
		return 1;
	},
	getTopPanel() {
		for (let key in Panels) {
			let panel = Panels[key];
			if (panel.slot == 'top' && Condition(panel.condition)) {
				return panel;
			}
		}
	},
	getBottomPanel() {
		for (let key in Panels) {
			let panel = Panels[key];
			if (panel.slot == 'bottom' && Condition(panel.condition)) {
				return panel;
			}
		}
	},
	getLeftPanels() {
		let list = [];
		for (let key in Panels) {
			let panel = Panels[key];
			if (panel.slot == 'left_bar' && Condition(panel.condition)) {
				list.push(panel);
			}
		}
		return list;
	},
	getRightPanels() {
		let list = [];
		for (let key in Panels) {
			let panel = Panels[key];
			if (panel.slot == 'right_bar' && Condition(panel.condition)) {
				list.push(panel);
			}
		}
		return list;
	},
	Resizers: {
		left: new ResizeLine('left', {
			condition() {
				if (Blockbench.isMobile) return false;
				if (!Prop.show_left_bar) return false;
				for (let p of Interface.data.left_bar) {
					if (Panels[p] && BARS.condition(Panels[p].condition) && Panels[p].slot == 'left_bar') {
						return true;
					}
				}
			},
			get() {return Interface.data.left_bar_width},
			set(o, diff) {
				let min = 128;
				let calculated = limitNumber(o + diff, min, window.innerWidth- 120 - Interface.data.right_bar_width)
				Interface.data.left_bar_width = Math.snapToValues(calculated, [Interface.default_data.left_bar_width], 16);
				
				if (calculated == min) {
					Prop.show_left_bar = false;
					Interface.data.left_bar_width = Interface.default_data.left_bar_width;
				} else {
					Prop.show_left_bar = true;
				}
			},
			position() {
				this.setPosition({
					top: 0,
					bottom: 0,
					left: Interface.data.left_bar_width+2
				})
			}
		}),
		right: new ResizeLine('right', {
			condition() {
				if (Blockbench.isMobile) return false;
				if (!Prop.show_right_bar) return false;
				for (let p of Interface.data.right_bar) {
					if (Panels[p] && BARS.condition(Panels[p].condition) && Panels[p].slot == 'right_bar') {
						return true;
					}
				}
			},
			get() {return Interface.data.right_bar_width},
			set(o, diff) {
				let min = 128;
				let calculated = limitNumber(o - diff, min, window.innerWidth- 120 - Interface.data.left_bar_width);
				Interface.data.right_bar_width = Math.snapToValues(calculated, [Interface.default_data.right_bar_width], 12);
				
				if (calculated == min) {
					Prop.show_right_bar = false;
					Interface.data.right_bar_width = Interface.default_data.right_bar_width;
				} else {
					Prop.show_right_bar = true;
				}
			},
			position() {
				this.setPosition({
					top: 30,
					bottom: 0,
					right: Interface.data.right_bar_width-2
				})
			}
		}),
		quad_view_x: new ResizeLine('quad_view_x', {
			condition() {return quad_previews.enabled},
			get() {return Interface.data.quad_view_x},
			set(o, diff) {Interface.data.quad_view_x = limitNumber(o + diff/$('#preview').width()*100, 5, 95)},
			position() {
				var p = document.getElementById('preview')
				this.setPosition({
					top: 32,
					bottom: p ? window.innerHeight - (p.clientHeight + $(p).offset().top) : 0,
					left: Interface.left_bar_width + document.getElementById('preview').clientWidth*Interface.data.quad_view_x/100
				}
			)}
		}),
		quad_view_y: new ResizeLine('quad_view_y', {
			horizontal: true,
			condition() {return quad_previews.enabled},
			get() {return Interface.data.quad_view_y},
			set(o, diff) {
				Interface.data.quad_view_y = limitNumber(o + diff/document.getElementById('preview').clientHeight*100, 5, 95)
			},
			position() {this.setPosition({
				left: Interface.left_bar_width+2,
				right: Interface.right_bar_width+2,
				top: Interface.preview.offsetTop + 30 + Interface.preview.clientHeight*Interface.data.quad_view_y/100
			})}
		}),
		top: new ResizeLine('top', {
			horizontal: true,
			condition() {return !Blockbench.isMobile && Interface.getTopPanel()},
			get() {
				let panel = Interface.getTopPanel();
				return panel.folded ? panel.handle.clientHeight : panel.height;
			},
			set(o, diff) {
				let panel = Interface.getTopPanel();
				panel.position_data.height = limitNumber(o + diff, 150);
				if (panel.folded) panel.fold(false);
				panel.update();
				if (Interface.getBottomPanel()) Interface.getBottomPanel().update();
			},
			position() {this.setPosition({
				left: Interface.left_bar_width+2,
				right: Interface.right_bar_width+2,
				top: this.get() + Interface.work_screen.offsetTop - document.getElementById('page_wrapper').offsetTop
			})}
		}),
		bottom: new ResizeLine('bottom', {
			horizontal: true,
			condition() {return !Blockbench.isMobile && Interface.getBottomPanel()},
			get() {
				let panel = Interface.getBottomPanel();
				return panel.folded ? panel.handle.clientHeight : panel.height;
			},
			set(o, diff) {
				let panel = Interface.getBottomPanel();
				panel.position_data.height = limitNumber(o - diff, 150);
				if (panel.folded) panel.fold(false);
				panel.update();
				if (Interface.getTopPanel()) Interface.getTopPanel().update();
			},
			position() {this.setPosition({
				left: Interface.left_bar_width+2,
				right: Interface.right_bar_width+2,
				top: Interface.work_screen.clientHeight - document.getElementById('status_bar').clientHeight - this.get()
			})}
		}),
		timeline_head: new ResizeLine('timeline_head', {
			horizontal: false,
			condition() {return Modes.animate},
			get() {return Interface.data.timeline_head},
			set(o, diff) {
				let value = limitNumber(o + diff, 90, Panels.timeline.node.clientWidth - 40);
				value = Math.snapToValues(value, [Interface.default_data.timeline_head], 12);
				Interface.data.timeline_head = Timeline.vue._data.head_width = value;
			},
			position() {
				let offset = $(Panels.timeline.vue.$el).offset();
				this.setPosition({
					left: offset.left + 2 + Interface.data.timeline_head,
					top: offset.top - Interface.work_screen.offsetTop + 30,
					bottom: Interface.work_screen.clientHeight - offset.top + Interface.work_screen.offsetTop - Panels.timeline.vue.$el.clientHeight + 10
				})
			}
		})
	},
	CustomElements: {},
	status_bar: {},
	Panels: {},
	toggleSidebar(side, status) {
		if (status == undefined) status = !Prop[`show_${side}_bar`];
		Prop[`show_${side}_bar`] = !!status;
		resizeWindow();
	}
}
const Panels = Interface.Panels;
Interface.panel_definers = []
Interface.definePanels = function(callback) {
	Interface.panel_definers.push(callback);
};

(function() {
	Interface.data = $.extend(true, {}, Interface.default_data)
	var interface_data = localStorage.getItem('interface_data')
	if (!interface_data) return;
	try {
		interface_data = JSON.parse(interface_data)
		let original_left_bar, original_right_bar;
		if (interface_data.left_bar) {
			original_left_bar = Interface.data.left_bar;
			Interface.data.left_bar = interface_data.left_bar;
		}
		if (interface_data.right_bar) {
			original_right_bar = Interface.data.right_bar;
			Interface.data.right_bar = interface_data.right_bar;
		}
		if (original_left_bar) {
			original_left_bar.forEach((panel, i) => {
				if (Interface.data.left_bar.includes(panel)) return;
				if (Interface.data.right_bar.includes(panel)) return;
				Interface.data.left_bar.splice(i, 0, panel);
			})
		}
		if (original_right_bar) {
			original_right_bar.forEach((panel, i) => {
				if (Interface.data.right_bar.includes(panel)) return;
				if (Interface.data.left_bar.includes(panel)) return;
				Interface.data.right_bar.splice(i, 0, panel);
			})
		}
		$.extend(true, Interface.data, interface_data)
	} catch (err) {
		console.error(err);
	}
})()

//Misc
function unselectInterface(event) {
	if (open_menu && $('.contextMenu').find(event.target).length === 0 && $('.menu_bar_point.opened:hover').length === 0) {
		Menu.closed_in_this_click = open_menu.id;
		open_menu.hide();

		function mouseUp(e) {
			delete Menu.closed_in_this_click;
			document.removeEventListener('click', mouseUp);
		}
		document.addEventListener('click', mouseUp);
	}
	if (ActionControl.open && $('#action_selector').find(event.target).length === 0 && (!open_menu || open_menu instanceof BarMenu)) {
		ActionControl.hide();
	}
	if ($(event.target).is('input.cube_name:not([disabled])') === false && Blockbench.hasFlag('renaming')) {
		stopRenameOutliner()
	}
}
function setupInterface() {

	translateUI()

	if (Blockbench.isMobile) document.body.classList.add('is_mobile');
	if (Blockbench.isLandscape) document.body.classList.add('is_landscape');
	if (Blockbench.isTouch) document.body.classList.add('is_touch');

	document.getElementById('title_bar_home_button').title = tl('projects.start_screen');

	document.getElementById('center').classList.toggle('checkerboard', settings.preview_checkerboard.value);
	document.body.classList.toggle('mobile_sidebar_left', settings.mobile_panel_side.value == 'left');

	setupPanels()
	
	Interface.status_bar.menu = new Menu([
		'project_window',
		'open_model_folder',
		'open_backup_folder',
		'save',
		'timelapse',
		'cancel_gif',
	])
	
	if (Blockbench.isMobile) {
		setupMobilePanelSelector()
		Prop.show_right_bar = false;
		Prop.show_left_bar = false;
	}

	for (var key in Interface.Resizers) {
		var resizer = Interface.Resizers[key]
		$('#work_screen').append(resizer.node)
	}
	//$(document).contextmenu()

	if (Blockbench.isMobile) {
		document.getElementById('preview').append(
			document.querySelector('.toolbar_wrapper.narrow.tools')
		);
	}

	//Tooltip Fix
	$(document).on('mouseenter', '.tool', function() {
		var tooltip = $(this).find('div.tooltip')
		if (!tooltip || typeof tooltip.offset() !== 'object') return;
		//Left
		if (tooltip.css('left') === '-4px') {
			tooltip.css('left', 'auto')
		}
		if (-tooltip.offset().left > 4) {
			tooltip.css('left', '-4px')
		}
		//Right
		if (tooltip.css('right') === '-4px') {
			tooltip.css('right', 'auto')
		}

		if ((tooltip.offset().left + tooltip.width()) - window.innerWidth > 4) {
			tooltip.css('right', '-4px')
		} else if ($(this).parent().css('position') == 'relative') {
			tooltip.css('right', '0')
		}
	})




	//Clickbinds
	$('#preview').click(function() { setActivePanel('preview' )})

	$('#texture_list').click(function(){
		unselectTextures()
	})
	$(Panels.timeline.node).mousedown((event) => {
		setActivePanel('timeline');
	})
	$(document).on('mousedown touchstart', unselectInterface)

	window.addEventListener('resize', resizeWindow);
	window.addEventListener('orientationchange', () => {
		setTimeout(resizeWindow, 100)
	});

	setProjectTitle()

	Interface.text_edit_menu = new Menu([
		{
			id: 'copy',
			name: 'action.copy',
			icon: 'fa-copy',
			click() {
				document.execCommand('copy');
			}
		},
		{
			id: 'paste',
			name: 'action.paste',
			icon: 'fa-paste',
			click() {
				document.execCommand('paste');
			}
		}
	])

	document.oncontextmenu = function (event) {
		if (!$(event.target).hasClass('allow_default_menu') && event instanceof TouchEvent == false) {
			if (event.target.nodeName === 'INPUT' && $(event.target).is(':focus')) {
				Interface.text_edit_menu.open(event, event.target)
			}
			return false;
		}
	}

	//Scrolling
	$('input[type="range"]').on('mousewheel', function () {
		var obj = $(event.target)
		var factor = event.deltaY > 0 ? -1 : 1
		var val = parseFloat(obj.val()) + parseFloat(obj.attr('step')) * factor
		val = limitNumber(val, obj.attr('min'), obj.attr('max'))

		if (obj.attr('trigger_type')) {
			DisplayMode.scrollSlider(obj.attr('trigger_type'), val, obj)
			return;
		}

		obj.val(val)
		eval(obj.attr('oninput'))
		eval(obj.attr('onmouseup'))
	})

	//Mousemove
	$(document).mousemove(function(event) {
		mouse_pos.x = event.clientX
		mouse_pos.y = event.clientY
	})
	updateInterface()
}

function updateInterface() {
	BARS.updateConditions()
	MenuBar.update()
	resizeWindow()
	localStorage.setItem('interface_data', JSON.stringify(Interface.data))
}

function resizeWindow(event) {
	if (!Preview.all || (event && event.target && event.target !== window)) {
		return;
	}
	Blockbench.isLandscape = window.innerWidth > window.innerHeight;
	document.body.classList.toggle('is_landscape', Blockbench.isLandscape);
	if (Interface.data) {
		updateInterfacePanels()
	}
	Preview.all.forEach(function(prev) {
		if (prev.canvas.isConnected) {
			prev.resize()
		}
	})
	Outliner.elements.forEach(element => {
		if (element.preview_controller.updateWindowSize) {
			element.preview_controller.updateWindowSize(element);
		}
	})
	if (Format.image_editor) {
		UVEditor.updateSize();
	}
	var dialog = $('dialog#'+open_dialog)
	if (dialog.length) {
		if (dialog.outerWidth() + dialog.offset().left > window.innerWidth) {
			dialog.css('left', limitNumber(window.innerWidth-dialog.outerWidth(), 0, 4e3) + 'px')
		}
		if (dialog.outerHeight() + dialog.offset().top > window.innerHeight) {
			dialog.css('top', limitNumber(window.innerHeight-dialog.outerHeight(), 0, 4e3) + 'px')
		}
	}
	Blockbench.dispatchEvent('resize_window', event);
}

function setProjectTitle(title) {
	let window_title = 'Blockbench';
	if (title == undefined && Project.name) {
		title = Project.name
	}
	if (title) {
		Prop.file_name = Prop.file_name_alt = title
		if (!Project.name) {
			Project.name = title
		}
		if (Format.bone_rig) {
			title = title.replace(/^geometry\./,'').replace(/:[a-z0-9.]+/, '')
		}
		window_title = title+' - Blockbench';
	} else {
		Prop.file_name = Prop.file_name_alt = ''
	}
	if (Project && !Project.saved) window_title = '● ' + window_title;
	$('title').text(window_title);
	$('#header_free_bar').text(window_title);
}
//Zoom
function setZoomLevel(mode) {
	if (Prop.active_panel === 'uv') {
		var zoom = UVEditor.zoom
		switch (mode) {
			case 'in':	zoom *= 1.5;  break;
			case 'out':   zoom *= 0.66;  break;
			case 'reset': zoom = 1; break;
		}
		UVEditor.setZoom(zoom);

	} else if (Prop.active_panel == 'timeline') {
		
		let body = document.getElementById('timeline_body');
		let offsetX = Timeline.vue.scroll_left + (body.clientWidth - Timeline.vue.head_width) / 2;
		
		if (mode == 'reset') {
			let original_size = Timeline.vue._data.size
			Timeline.vue._data.size = 200;
			
			body.scrollLeft += (Timeline.vue._data.size - original_size) * (offsetX / original_size)
		} else {
			let zoom = mode == 'in' ? 1.2 : 0.8;
			let original_size = Timeline.vue._data.size
			let updated_size = limitNumber(Timeline.vue._data.size * zoom, 10, 1000)
			Timeline.vue._data.size = updated_size;
			
			body.scrollLeft += (updated_size - original_size) * (offsetX / original_size)
		}
	} else {
		switch (mode) {
			case 'in':		Preview.selected.controls.dollyIn(1.16);  break;
			case 'out':  	Preview.selected.controls.dollyOut(1.16);  break;
		}
	}
}

//UI Edit
function setProgressBar(id, val, time) {
	if (!id || id === 'main') {
		Prop.progress = val
	} else {
		$('#'+id+' > .progress_bar_inner').animate({width: val*488}, time-1)
	}
	if (isApp) {
		currentwindow.setProgressBar(val)
	}
}

//Tooltip
function showShiftTooltip() {
	$(':hover').find('.tooltip_shift').css('display', 'inline')
}
$(document).keyup(function(event) {
	if (event.which === 16) {
		$('.tooltip_shift').hide()
	}
})
/**
 * 
 * @param {string} tag Tag name
 * @param {object} [attributes] Attributes
 * @param {string|HTMLElement|string[]|HTMLElement[]} [content] Content
 * @returns {HTMLElement} Element
 */
Interface.createElement = (tag, attributes = {}, content) => {
	let el = document.createElement(tag);
	for (let key in attributes) {
		if (attributes[key] !== undefined) {
			el.setAttribute(key, attributes[key]);
		}
	}
	if (typeof content == 'string') el.textContent = content;
	if (content instanceof Array) {
		content.forEach(node => el.append(node));
	}
	if (content instanceof HTMLElement) el.append(content);
	return el;
}


// Custom Elements
Interface.CustomElements.ResizeLine = ResizeLine;
Interface.CustomElements.SelectInput = function(id, data) {
	function getNameFor(key) {
		let val = data.options[key];
		if (val) {
			return tl(val.name || val);
		} else {
			return '';
		}
	}
	let value = data.value || data.default || Object.keys(data.options)[0];
	let select = Interface.createElement('bb-select', {id, class: 'half', value: value}, getNameFor(value));
	function setKey(key) {
		value = key;
		select.setAttribute('value', key);
		select.textContent = getNameFor(key);
		if (typeof data.onChange == 'function') {
			data.onChange(value);
		}
	}
	select.addEventListener('click', function(event) {
		if (Menu.closed_in_this_click == id) return this;
		let items = [];
		for (let key in data.options) {
			let val = data.options[key];
			if (val) {
				items.push({
					name: getNameFor(key),
					icon: val.icon || ((value == key) ? 'far.fa-dot-circle' : 'far.fa-circle'),
					condition: val.condition,
					click: (e) => {
						setKey(key);
					}
				})
			}
		}
		let menu = new Menu(id, items, {searchable: items.length > 16});
		menu.node.style['min-width'] = select.clientWidth+'px';
		menu.open(select);
	})
	this.node = select;
	this.set = setKey;
}

function openTouchKeyboardModifierMenu(node) {
	if (Menu.closed_in_this_click == 'mobile_keyboard') return;

	let modifiers = ['ctrl', 'shift', 'alt'];
	let menu = new Menu('mobile_keyboard', [
		...modifiers.map(key => {
			let name = tl(`keys.${key}`);
			if (Interface.status_bar.vue.modifier_keys[key].length) {
				name += ' (' + tl(Interface.status_bar.vue.modifier_keys[key].last()) + ')';
			}
			return {
				name,
				icon: Pressing.overrides[key] ? 'check_box' : 'check_box_outline_blank',
				click() {
					Pressing.overrides[key] = !Pressing.overrides[key]
				}
			}
		}),
		'_',
		{icon: 'clear_all', name: 'menu.mobile_keyboard.disable_all', condition: () => {
			let {length} = [Pressing.overrides.ctrl, Pressing.overrides.shift, Pressing.overrides.alt].filter(key => key);
			return length;
		}, click() {
			Pressing.overrides.ctrl = false; Pressing.overrides.shift = false; Pressing.overrides.alt = false;
		}},
	])
	menu.open(node);
}

onVueSetup(function() {
	Interface.status_bar.vue = new Vue({
		el: '#status_bar',
		data: {
			Prop,
			isMobile: Blockbench.isMobile,
			streamer_mode: settings.streamer_mode.value,
			selection_info: '',
			Format: null,
			show_modifier_keys: settings.status_bar_modifier_keys.value,
			warnings: Validator.warnings,
			errors: Validator.errors,
			modifier_keys: {
				ctrl: [],
				shift: [],
				alt: []
			},
			modifiers: Blockbench.isTouch && !Blockbench.isMobile && Pressing.overrides,
			keyboard_menu_in_status_bar: Blockbench.isTouch && !Blockbench.isMobile
		},
		methods: {
			showContextMenu(event) {
				Interface.status_bar.menu.show(event);
			},
			toggleStreamerMode() {
				ActionControl.select(`setting: ${tl('settings.streamer_mode')}`);
			},
			updateSelectionInfo() {
				let selection_mode = BarItems.selection_mode.value;
				if (Modes.edit && Mesh.selected.length && selection_mode !== 'object') {
					if (selection_mode == 'face') {
						let total = 0, selected = 0;
						Mesh.selected.forEach(mesh => total += Object.keys(mesh.faces).length);
						Mesh.selected.forEach(mesh => mesh.forAllFaces(face => selected += (face.isSelected() ? 1 : 0)));
						this.selection_info = tl('status_bar.selection.faces', `${selected} / ${total}`);
					}
					if (selection_mode == 'edge') {
						let total = 0, selected = 0;
						Mesh.selected.forEach(mesh => {
							let selected_vertices = mesh.getSelectedVertices();
							let processed_lines = [];
							mesh.forAllFaces(face => {
								let vertices = face.getSortedVertices();
								vertices.forEach((vkey, i) => {
									let vkey2 = vertices[i+1] || vertices[0];
									if (!processed_lines.find(processed => processed.includes(vkey) && processed.includes(vkey2))) {
										processed_lines.push([vkey, vkey2]);
										total += 1;
										if (selected_vertices.includes(vkey) && selected_vertices.includes(vkey2)) {
											selected += 1;
										}
									}
								})
							})
						})
						this.selection_info = tl('status_bar.selection.edges', `${selected} / ${total}`);
					}
					if (selection_mode == 'vertex') {
						let total = 0, selected = 0;
						Mesh.selected.forEach(mesh => total += Object.keys(mesh.vertices).length);
						Mesh.selected.forEach(mesh => selected += mesh.getSelectedVertices().length);
						this.selection_info = tl('status_bar.selection.vertices', `${selected} / ${total}`);
					}
				} else {
					this.selection_info = '';
				}
			},
			clickModifiers() {
				ActionControl.select(`setting: ${tl('settings.status_bar_modifier_keys')}`);
			},
			openValidator() {
				Validator.openDialog();
			},
			openKeyboardMenu() {
				openTouchKeyboardModifierMenu(this.$refs.mobile_keyboard_menu);
			},
			toggleSidebar: Interface.toggleSidebar,
			getIconNode: Blockbench.getIconNode,
			tl
		},
		template: `
			<div id="status_bar" @contextmenu="showContextMenu($event)">
				<div class="sidebar_toggle_button" v-if="!isMobile" @click="toggleSidebar('left')" title="${tl('status_bar.toggle_sidebar')}">
					<i class="material-icons">{{Prop.show_left_bar ? 'chevron_left' : 'chevron_right'}}</i>
				</div>
				
				<div class="f_left" v-if="streamer_mode"
					style="background-color: var(--color-stream); color: var(--color-light);"
					@click="toggleStreamerMode()"
					title="${tl('interface.streamer_mode_on')}"
				>
					<i class="material-icons">live_tv</i>
				</div>
				<div v-if="Format" v-html="getIconNode(Format.icon).outerHTML" v-bind:title="Format.name"></div>
				<div v-if="Prop.recording" v-html="getIconNode('fiber_manual_record').outerHTML" style="color: var(--color-close)" title="${tl('status_bar.recording')}"></div>


				<div id="status_name">
					{{ Prop.file_name }}
				</div>
				<div id="status_message" class="hidden"></div>

				<template v-if="show_modifier_keys && !isMobile">
					<div class="status_bar_modifier_key" v-if="modifier_keys.ctrl.length" @click="clickModifiers()">
						<kbd>${tl(Blockbench.platform == 'darwin' ? 'keys.meta' : 'keys.ctrl')}</kbd>
						<span>{{ tl(modifier_keys.ctrl.last()) }}</span>
					</div>
					<div class="status_bar_modifier_key" v-if="modifier_keys.shift.length" @click="clickModifiers()">
						<kbd>${tl('keys.shift')}</kbd>
						<span>{{ tl(modifier_keys.shift.last()) }}</span>
					</div>
					<div class="status_bar_modifier_key" v-if="modifier_keys.alt.length" @click="clickModifiers()">
						<kbd>${tl('keys.alt')}</kbd>
						<span>{{ tl(modifier_keys.alt.last()) }}</span>
					</div>
				</template>

				<div class="status_selection_info">{{ selection_info }}</div>

				<div class="f_right" id="validator_status" v-if="warnings.length || errors.length" @click="openValidator()">
					<span v-if="warnings.length" style="color: var(--color-warning)">{{ warnings.length }}<i class="material-icons">warning</i></span>
					<span v-if="errors.length" style="color: var(--color-error)">{{ errors.length }}<i class="material-icons">error</i></span>
				</div>

				<div v-if="keyboard_menu_in_status_bar" id="mobile_keyboard_menu" @click="openKeyboardMenu()" ref="mobile_keyboard_menu" :class="{enabled: modifiers.ctrl || modifiers.shift || modifiers.alt}">
					<i class="material-icons">keyboard</i>
				</div>

				<div class="f_right">
					{{ Prop.fps }} FPS
				</div>

				<div class="sidebar_toggle_button" v-if="!isMobile" @click="toggleSidebar('right')" title="${tl('status_bar.toggle_sidebar')}">
					<i class="material-icons">{{Prop.show_right_bar ? 'chevron_right' : 'chevron_left'}}</i>
				</div>

				<div id="status_progress" v-if="Prop.progress" v-bind:style="{width: Prop.progress*100+'%'}"></div>
			</div>
		`
	})

	Interface.addSuggestedModifierKey = (key, text) => {
		Interface.status_bar.vue.modifier_keys[key].safePush(text);
	};
	Interface.removeSuggestedModifierKey = (key, text) => {
		Interface.status_bar.vue.modifier_keys[key].remove(text);
	};
})
