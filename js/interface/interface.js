const StartScreen = {};
var ColorPanel;

//Panels
class Panel {
	constructor(data) {
		var scope = this;
		this.type = 'panel'
		this.id = data.id || 'new_panel'
		this.menu = data.menu
		this.title = data.title || tl('panel.'+this.id)
		this.condition = data.condition
		this.onResize = data.onResize
		this.node = $('.panel#'+this.id).get(0)// || $('<div class="panel" id="'+this.id+'"></div>')[0]
		if (data.toolbars) {
			this.toolbars = data.toolbars
		}
		this.handle = $('<h3 class="panel_handle">'+this.title+'</h3>').get(0)
		if (!Blockbench.isMobile) {
			$(this.handle).draggable({
				revertDuration: 0,
				cursorAt: { left: 24, top: 24 },
				helper: 'clone',
				revert: true,
				appendTo: 'body',
				zIndex: 19,
				scope: 'panel',
				start: function() {
					Interface.panel = scope;
				},
				stop: function(e, ui) {
					if (!ui) return;
					if (Math.abs(ui.position.top - ui.originalPosition.top) + Math.abs(ui.position.left - ui.originalPosition.left) < 180) return;
					var target = Interface.panel
					if (typeof target === 'string') {
						scope.moveTo(target)
					} else if (target.type === 'panel') {
						var target_pos = $(target.node).offset().top
						var target_height = $(target.node).height()
						var before = ui.position.top < target_pos + target_height / 2
						if (target && target !== scope) {
							scope.moveTo(target, before)
						} else {
							if (e.clientX > window.innerWidth - 200) {
								scope.moveTo('right_bar')
							} else if (e.clientX < 200) {
								scope.moveTo('left_bar')
							}
						}
					}
					saveInterfaceRearrangement()
					updateInterface()
				}
			})
		}
		$(this.node)
			.droppable({
				accept: 'h3',
				scope: 'panel',
				tolerance: 'pointer',
				drop: function(e, ui) {
					Interface.panel = scope;
				}
			})
			.click((event) => {
				setActivePanel(this.id)
			})
			.contextmenu((event) => {
				setActivePanel(this.id)
			})
			.prepend(this.handle)
	}
	moveTo(ref_panel, before) {
		var scope = this
		if (typeof ref_panel === 'string') {
			if (ref_panel === 'left_bar') {
				$('#left_bar').append(scope.node)
			} else {
				$('#right_bar').append(scope.node)
			}
		} else {
			if (before) {
				$(ref_panel.node).before(scope.node)
			} else {
				$(ref_panel.node).after(scope.node)
			}
		}
		if (this.onResize) {
			this.onResize()
		}
		updateInterface()
	}
	update() {
		var show = BARS.condition(this.condition)
		if (show) {
			$(this.node).show()
			if (Interface.data.left_bar.includes(this.id)) {
				this.width = Interface.data.left_bar_width
			} else if (Interface.data.right_bar.includes(this.id)) {
				this.width = Interface.data.right_bar_width
			}
			if (this.onResize) this.onResize()
		} else {
			$(this.node).hide()
		}
	}
}
class ResizeLine {
	constructor(data) {
		var scope = this;
		this.id = data.id
		this.horizontal = data.horizontal === true
		this.position = data.position
		this.condition = data.condition
		this.width = 0;
		var jq = $('<div class="resizer '+(data.horizontal ? 'horizontal' : 'vertical')+'"></div>')
		this.node = jq.get(0)
		jq.draggable({
			axis: this.horizontal ? 'y' : 'y',
			containment: '#page_wrapper',
			revert: true,
			start: function(e, u) {
				scope.before = data.get()
			},
			drag: function(e, u) {
				if (scope.horizontal) {
					data.set(scope.before, u.position.top - u.originalPosition.top)
				} else {
					data.set(scope.before, (e.clientX - u.position.left))
				}
				updateInterface()
			},
			stop: function(e, u) {
				updateInterface()
			}
		})
	}
	update() {
		if (BARS.condition(this.condition)) {
			$(this.node).show()
			if (this.position) {
				this.position(this)
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
		if (data.bottom !== undefined && (!data.horizontal || data.top === undefined)) {
			jq.css('bottom', data.bottom+'px')
		}
		if (data.left !== undefined) {
			jq.css('left', data.left+'px')
		}
		if (data.right !== undefined && (data.horizontal || data.left === undefined)) {
			jq.css('right', data.right+'px')
		}
	}
}

var Interface = {
	default_data: {
		left_bar_width: 332,
		right_bar_width: 314,
		quad_view_x: 50,
		quad_view_y: 50,
		timeline_height: 260,
		left_bar: ['uv', 'textures', 'display', 'animations', 'keyframe', 'variable_placeholders'],
		right_bar: ['color', 'outliner', 'chat']
	},
	Resizers: {
		left: new ResizeLine({
			id: 'left',
			condition: function() {
				var i = 0;
				Interface.data.left_bar.forEach(p => {
					if (Interface.Panels[p] && BARS.condition(Interface.Panels[p].condition)) {i++;}
				})
				return i;
			},
			get: function() {return Interface.data.left_bar_width},
			set: function(o, diff) {
				Interface.data.left_bar_width = limitNumber(o + diff, 128, $(window).width()- 240 - Interface.data.right_bar_width)
			},
			position: function(line) {
				line.setPosition({
					top: 32,
					bottom: 0,
					left: Interface.data.left_bar_width-3
				})
			}
		}),
		right: new ResizeLine({
			id: 'right',
			condition: function() {
				var i = 0;
				Interface.data.right_bar.forEach(p => {
					if (Interface.Panels[p] && BARS.condition(Interface.Panels[p].condition)) {i++;}
				})
				return i;
			},
			get: function() {return Interface.data.right_bar_width},
			set: function(o, diff) {
				Interface.data.right_bar_width = limitNumber(o - diff, 128, $(window).width()- 240 - Interface.data.left_bar_width)
			},
			position: function(line) {
				line.setPosition({
					top: 32,
					bottom: 0,
					right: Interface.data.right_bar_width-3
				})
			}
		}),
		quad_view_x: new ResizeLine({
			id: 'quad_view_x',
			condition: function() {return quad_previews.enabled},
			get: function() {return Interface.data.quad_view_x},
			set: function(o, diff) {Interface.data.quad_view_x = limitNumber(o + diff/$('#preview').width()*100, 5, 95)},
			position: function(line) {
				var p = document.getElementById('preview')
				line.setPosition({
					top: 32,
					bottom: p ? window.innerHeight - (p.clientHeight + p.offsetTop) : 0,
					left: Interface.data.left_bar_width + $('#preview').width()*Interface.data.quad_view_x/100
				}
			)}
		}),
		quad_view_y: new ResizeLine({
			id: 'quad_view_y',
			horizontal: true,
			condition: function() {return quad_previews.enabled},
			get: function() {return Interface.data.quad_view_y},
			set: function(o, diff) {
				Interface.data.quad_view_y = limitNumber(o + diff/$('#preview').height()*100, 5, 95)
			},
			position: function(line) {line.setPosition({
				left: Interface.data.left_bar_width+2,
				right: Interface.data.right_bar_width+2,
				top: $('#preview').offset().top + $('#preview').height()*Interface.data.quad_view_y/100
			})}
		}),
		timeline: new ResizeLine({
			id: 'timeline',
			horizontal: true,
			condition: function() {return Modes.animate},
			get: function() {return Interface.data.timeline_height},
			set: function(o, diff) {
				Interface.data.timeline_height = limitNumber(o - diff, 150, document.body.clientHeight-120)
			},
			position: function(line) {line.setPosition({
				left: Interface.data.left_bar_width+2,
				right: Interface.data.right_bar_width+2,
				top: $('#timeline').offset().top
			})}
		})
	},
	status_bar: {},
	Panels: {}
}

//Misc
function unselectInterface(event) {
	if (open_menu && $('.contextMenu').find(event.target).length === 0 && $('.menu_bar_point.opened:hover').length === 0) {
		open_menu.hide();
	}
	if (ActionControl.open && $('#action_selector').find(event.target).length === 0) {
		ActionControl.hide();
	}
	if ($(event.target).is('input.cube_name:not([disabled])') === false && Blockbench.hasFlag('renaming')) {
		stopRenameOutliner()
	}
}
function setupInterface() {
	Interface.data = $.extend(true, {}, Interface.default_data)
	var interface_data = localStorage.getItem('interface_data')
	try {
		interface_data = JSON.parse(interface_data)
		var old_data = Interface.data
		if (interface_data.left_bar) Interface.data.left_bar = interface_data.left_bar;
		if (interface_data.right_bar) Interface.data.right_bar = interface_data.right_bar;
		for (key in Interface.Panels) {
			if (!Interface.data.left_bar.includes(key) && !Interface.data.right_bar.includes(key)) {
				if (old_data.left_bar.includes(key)) {
					Interface.data.left_bar.push(key)
				} else {
					Interface.data.right_bar.push(key)
				}
			}
		}
		$.extend(true, Interface.data, interface_data)
	} catch (err) {}

	if (!Language.loading_steps) {
		Language.loading_steps = true;
	} else {
		translateUI()
	}
	$('.edit_session_active').hide()

	$('.sidebar').droppable({
		accept: 'h3',
		scope: 'panel',
		tolerance: 'pointer',
		drop: function(e, ui) {
			Interface.panel = $(this).attr('id');
		}
	})


	//Panels
	Interface.Panels.uv = new Panel({
		id: 'uv',
		condition: () => Modes.id === 'edit' || Modes.id === 'paint',
		toolbars: {
			bottom: Toolbars.main_uv
		},
		onResize: function() {
			var size = limitNumber($(this.node).width()-10, 64, 1200)
			size = Math.floor(size/16)*16
			main_uv.setSize(size)
		}
	})
	Interface.Panels.textures = new Panel({
		id: 'textures',
		condition: () => Modes.id === 'edit' || Modes.id === 'paint',
		toolbars: {
			head: Toolbars.textures
		},
		menu: new Menu([
			'import_texture',
			'create_texture',
			'reload_textures',
			'change_textures_folder',
			'save_textures'
		])
	})
	Interface.Panels.element = new Panel({
		id: 'element',
		condition: () => Modes.edit,
		toolbars: {
			element_position: Toolbars.element_position,
			element_size: Toolbars.element_size,
			element_origin: Toolbars.element_origin,
			element_rotation: Toolbars.element_rotation,
		}
	})
	Interface.Panels.bone = new Panel({
		id: 'bone',
		condition: () => Modes.animate,
		toolbars: {
			//bone_ik: Toolbars.bone_ik,
		}
	})
	Interface.Panels.outliner = new Panel({
		id: 'outliner',
		condition: () => Modes.id === 'edit' || Modes.id === 'paint' || Modes.id === 'animate',
		toolbars: {
			head: Toolbars.outliner
		},
		onResize: t => {
			getAllOutlinerObjects().forEach(o => o.updateElement())
		},
		menu: new Menu([
			'add_cube',
			'add_group',
			'_',
			'sort_outliner',
			'select_all',
			'collapse_groups',
			'element_colors',
			'outliner_toggle'
		])
	})
	Interface.Panels.chat = new Panel({
		id: 'chat',
		condition: function() {return EditSession.active},
		toolbars: {},
		onResize: t => {
		},
		menu: new Menu([
		])
	})
	Interface.Panels.animations = new Panel({
		id: 'animations',
		condition: () => Animator.open,
		toolbars: {
			head: Toolbars.animations
		}
	})
	Interface.Panels.keyframe = new Panel({
		id: 'keyframe',
		condition: () => Animator.open,
		toolbars: {
			head: Toolbars.keyframe
		}
	})
	Interface.Panels.variable_placeholders = new Panel({
		id: 'variable_placeholders',
		condition: () => Animator.open,
		toolbars: {
		}
	})
	Interface.Panels.display = new Panel({
		id: 'display',
		condition: function() {return display_mode},
		toolbars: {
			head: Toolbars.textures
		}
	})
	Interface.data.left_bar.forEach((id) => {
		if (Interface.Panels[id]) {
			$('#left_bar').append(Interface.Panels[id].node)
		}
	})
	Interface.data.right_bar.forEach((id) => {
		if (Interface.Panels[id]) {
			$('#right_bar').append(Interface.Panels[id].node)
		}
	})


	Interface.status_bar.menu = new Menu([
		'project_window',
		'open_model_folder',
		'open_backup_folder',
		'save',
		'timelapse',
	])

	for (var key in Interface.Resizers) {
		var resizer = Interface.Resizers[key]
		$('#page_wrapper').append(resizer.node)
	}
	//$(document).contextmenu()


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

		if ((tooltip.offset().left + tooltip.width()) - $(window).width() > 4) {
			tooltip.css('right', '-4px')
		} else if ($(this).parent().css('position') == 'relative') {
			tooltip.css('right', '0')
		}
	})

	var stats_bar_vue = new Vue({
		el: '#status_bar',
		data: {Prop}
	})



	//Clickbinds
	$('header'	  ).click( 	function() { setActivePanel('header'  )})
	$('#preview'	).click(function() { setActivePanel('preview' )})

	$('ul#cubes_list').click(function(event) {
		if (event.target === document.getElementById('cubes_list')) {
			unselectAll()
		}
	})
	$('#texture_list').click(function(){
		unselectTextures()
	})
	$('#timeline').mousedown((event) => {
		setActivePanel('timeline');
	})
	$(document).on('mousedown touchstart', unselectInterface)
	
	$('.context_handler').on('click', function() {
		$(this).addClass('ctx')
	})
	$(document).contextmenu(function(event) {
		if (!$(event.target).hasClass('allow_default_menu')) {
			/*if (event.target.nodeName === 'INPUT' && $(event.target).is(':focus')) {
				Interface.text_edit_menu.open(event, event.target)
			}*/
			return false;
		}
	})

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
function saveInterfaceRearrangement() {
	Interface.data.left_bar.length = 0
	$('#left_bar > .panel').each((i, obj) => {
		let id = $(obj).attr('id');
		Interface.data.left_bar.push(id);
	})
	Interface.data.right_bar.length = 0
	$('#right_bar > .panel').each((i, obj) => {
		let id = $(obj).attr('id');
		Interface.data.right_bar.push(id);
	})
	localStorage.setItem('interface_data', JSON.stringify(Interface.data))
}

function updateInterface() {
	BARS.updateConditions()
	MenuBar.update()
	resizeWindow()
	localStorage.setItem('interface_data', JSON.stringify(Interface.data))
}
function updateInterfacePanels() {
	$('#page_wrapper').css(
		'grid-template-columns',
		Interface.data.left_bar_width+'px auto '+ Interface.data.right_bar_width +'px'
	)
	for (var key in Interface.Panels) {
		var panel = Interface.Panels[key]
		panel.update()
	}
	var left_width = $('.sidebar#left_bar > .panel:visible').length ? Interface.data.left_bar_width : 0
	var right_width = $('.sidebar#right_bar > .panel:visible').length ? Interface.data.right_bar_width : 0
	if (!left_width || !right_width) {
		$('#page_wrapper').css(
			'grid-template-columns',
			left_width+'px auto '+ right_width +'px'
		)
	}

	$('.quad_canvas_wrapper.qcw_x').css('width', Interface.data.quad_view_x+'%')
	$('.quad_canvas_wrapper.qcw_y').css('height', Interface.data.quad_view_y+'%')
	$('.quad_canvas_wrapper:not(.qcw_x)').css('width', (100-Interface.data.quad_view_x)+'%')
	$('.quad_canvas_wrapper:not(.qcw_y)').css('height', (100-Interface.data.quad_view_y)+'%')
	$('#timeline').css('height', Interface.data.timeline_height+'px')
	for (var key in Interface.Resizers) {
		var resizer = Interface.Resizers[key]
		resizer.update()
	}
}

function resizeWindow(event) {
	if (!previews || (event && event.target && event.target !== window)) {
		return;
	}
	if (Animator.open) {
		Timeline.updateSize()
	}

	if (Interface.data) {
		updateInterfacePanels()
	}
	previews.forEach(function(prev) {
		if (prev.canvas.isConnected) {
			prev.resize()
		}
	})
	var dialog = $('dialog#'+open_dialog)
	if (dialog.length) {
		if (dialog.outerWidth() + dialog.offset().left > window.innerWidth) {
			dialog.css('left', limitNumber(window.innerWidth-dialog.outerWidth(), 0, 4e3) + 'px')
		}
		if (dialog.outerHeight() + dialog.offset().top > window.innerHeight) {
			dialog.css('top', limitNumber(window.innerHeight-dialog.outerHeight(), 0, 4e3) + 'px')
		}
	}
	BARS.updateToolToolbar()
}
$(window).on('resize orientationchange', resizeWindow)

function setActivePanel(panel) {
	Prop.active_panel = panel
}
function setProjectTitle(title) {
	if (Format.bone_rig && Project.geometry_name) {
		title = Project.geometry_name
	}
	if (title) {
		Prop.file_name = Prop.file_name_alt = title
		if (!Project.name) {
			Project.name = title
		}
		if (Format.bone_rig) {
			title = title.replace(/^geometry\./,'').replace(/:[a-z0-9.]+/, '')
		}
		$('title').text(title+' - Blockbench')
	} else {
		Prop.file_name = Prop.file_name_alt = ''
		$('title').text('Blockbench')
	}
}
//Zoom
function setZoomLevel(mode) {
	if (Prop.active_panel === 'uv') {
		var zoom = main_uv.zoom
		switch (mode) {
			case 'in':	zoom *= 1.5;  break;
			case 'out':   zoom *= 0.66;  break;
			case 'reset': zoom = 1; break;
		}
		zoom = limitNumber(zoom, 1, 4)
		main_uv.setZoom(zoom)

	} else if (isApp) {
		switch (mode) {
			case 'in':	Prop.zoom += 5;  break;
			case 'out':   Prop.zoom -= 5;  break;
			case 'reset': Prop.zoom = 100; break;
		}
		var level = (Prop.zoom - 100) / 12
		currentwindow.webContents.setZoomLevel(level)
		resizeWindow()
	}
}

//Dialogs
function showDialog(dialog) {
	var obj = $('.dialog#'+dialog)
	$('.dialog').hide(0)
	if (open_menu) {
		open_menu.hide()
	}
	$('#blackout').fadeIn(0)
	obj.fadeIn(0)
	open_dialog = dialog
	open_interface = dialog
	Prop.active_panel = 'dialog'
	//Draggable
	if (obj.hasClass('draggable')) {
		obj.draggable({
			handle: ".dialog_handle",
			containment: '#page_wrapper'
		})
		var x = ($(window).width()-obj.outerWidth()) / 2;
		var top = ($(window).height() - obj.outerHeight()) / 2;
		obj.css('left', x+'px')
		obj.css('top', 'px')
		obj.css('max-height', ($(window).height()-128)+'px')
	}
}
function hideDialog() {
	$('#blackout').fadeOut(0)
	$('.dialog').fadeOut(0)
	open_dialog = false;
	open_interface = false;
	Prop.active_panel = undefined
}
function setSettingsTab(tab) {
	$('#settings .tab.open').removeClass('open')
	$('#settings .tab#'+tab).addClass('open')
	$('#settings .tab_content').addClass('hidden')
	$('#settings .tab_content#'+tab).removeClass('hidden')
	if (tab === 'keybindings') {
		//Keybinds
		$('#keybindlist').css('max-height', ($(window).height() - 420) +'px')
		$('#keybind_search_bar').focus()

	} else if (tab === 'setting') {
		//Settings
		$('#settingslist').css('max-height', ($(window).height() - 420) +'px')
		$('#settings_search_bar').focus()

	} else if (tab === 'layout_settings') {
		//Layout

		$('#theme_editor').css('max-height', ($(window).height() - 420) +'px')
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

//Start Screen
function addStartScreenSection(data) {
	var obj = $('<section></section>')
	if (typeof data.graphic === 'object') {
		var left = $('<left class="graphic"></left>')
		obj.append(left)

		if (data.graphic.type === 'icon') {
			var icon = Blockbench.getIconNode(data.graphic.icon)
			$(icon).addClass('graphic_icon')
			left.append(icon)
		} else {
			left.css('background-image', `url('${data.graphic.source}')`)
		}
		if (data.graphic.width) {
			left.css('width', data.graphic.width+'px').css('flex-shrink', '0');
		}
		if (data.graphic.width && data.graphic.height && Blockbench.isMobile) {
			left.css('height', '0')
				.css('padding-top', '0')
				.css('padding-bottom', (data.graphic.height/data.graphic.width*100)+'%')
		} else {
			if (data.graphic.height) left.css('height', data.graphic.height+'px');
			if (data.graphic.width && !data.graphic.height) left.css('height', data.graphic.width+'px');
		}
	}
	if (data.text instanceof Array) {
		var right = $('<right></right>')
		obj.append(right)
		data.text.forEach(line => {
			var content = line.text ? marked(tl(line.text)) : '';
			switch (line.type) {
				case 'h1': var tag = 'h3'; break;
				case 'h2': var tag = 'h4'; break;
				case 'list':
					var tag = 'ul class="list_style"';
					line.list.forEach(string => {
						content += `<li>${marked(tl(string))}</li>`;
					})
					break;
				case 'button': var tag = 'button'; break;
				default:   var tag = 'p'; break;
			}
			var l = $(`<${tag}>${content}</${tag.split(' ')[0]}>`);
			if (typeof line.click == 'function') {
				l.click(line.click);
			}
			right.append(l);
		})
	}
	if (data.closable !== false) {
		obj.append(`<i class="material-icons start_screen_close_button">clear</i>`);
		obj.find('i.start_screen_close_button').click((e) => {
			obj.detach()
		});
	}
	if (data.color) {
		obj.css('background-color', data.color);
		if (data.color == 'var(--color-bright_ui)') {
			obj.addClass('bright_ui')
		}
	}
	if (data.text_color) {
		obj.css('color', data.text_color);
	}
	if (data.last) {
		$('#start_screen content').append(obj);
	} else {
		$('#start_screen content').prepend(obj);
	}
}

var documentReady = new Promise((resolve, reject) => {
	$(document).ready(function() {
		resolve()
	})
});


(function() {
	var news_call = $.getJSON('https://blockbench.net/api/news/news.json')
	var version_call = $.getJSON('https://raw.githubusercontent.com/JannisX11/blockbench/master/package.json')
	Promise.all([news_call, documentReady]).then((data) => {
		if (!data || !data[0]) return;
		data = data[0];

		//Update Screen
		if (Blockbench.hasFlag('after_update') && data.new_version) {
			addStartScreenSection(data.new_version)
		}
		if (data.psa) {
			addStartScreenSection(data.psa)
		}

	})
	documentReady.then(() => {
		Blockbench.startup_count = parseInt(localStorage.getItem('startups')||0)

		//Backup Model
		if (localStorage.getItem('backup_model') && (!isApp || !currentwindow.webContents.second_instance)) {
			var backup_model = localStorage.getItem('backup_model')
			localStorage.removeItem('backup_model')

			addStartScreenSection({
				color: 'var(--color-back)',
				graphic: {type: 'icon', icon: 'fa-archive'},
				text: [
					{type: 'h1', text: tl('message.recover_backup.title')},
					{text: tl('message.recover_backup.message')},
					{type: 'button', text: tl('dialog.ok'), click: (e) => {
						loadModelFile({content: backup_model, path: 'backup.bbmodel', no_file: true})
					}}
				]
			})
		}


		//Electron
		if (isApp && !compareVersions(process.versions.electron, '4.0.0')) {
			addStartScreenSection({
				graphic: {type: 'icon', icon: 'fas.fa-atom'},
				text: [
					{type: 'h1', text: 'Electron Update Recommended'},
					{text: 'Your Blockbench is using an old version of Electron. Install the latest version to get the best performance and newest features. Just run the latest Blockbench installer. This only takes a minute and will not affect your custom settings.'},
					{text: '[Blockbench Downloads](https://blockbench.net/downloads/)'}
				]
			})
		}
		//Discord
		if (Blockbench.startup_count < 6) {
			addStartScreenSection({
				color: '#7289da',
				text_color: '#ffffff',
				graphic: {type: 'icon', icon: 'fab.fa-discord'},
				text: [
					{type: 'h1', text: 'Discord Server'},
					{text: 'You need help with modeling or you want to chat about Blockbench? Join the [Modeling Discord](https://discord.gg/WVHg5kH)!'}
				],
				last: true
			})
		}
		//Donation reminder
		if (Blockbench.startup_count % 12 === 11) {
			addStartScreenSection({
				graphic: {type: 'icon', icon: 'fas.fa-heart'},
				text: [
					{type: 'h1', text: 'Donation'},
					{text: 'Are you enjoying Blockbench? Consider donating to the project. Blockbench is 100% donation funded.'},
					{text: '[Donate](https://blockbench.net/donate)'}
				],
				last: true
			})
		}
	})

	Promise.all([version_call, documentReady]).then((data) => {
		if (data[0] && data[0].version) {
			latest_version = data[0].version;
			if (isApp && compareVersions(latest_version, appVersion)) {

				addStartScreenSection({
					color: 'var(--color-back)',
					graphic: {type: 'icon', icon: 'update'},
					text: [
						{type: 'h1', text: tl('message.update_notification.title')},
						{text: tl('message.update_notification.message', [latest_version])},
						{type: 'button', text: tl('message.update_notification.install'), click: (e) => {
							checkForUpdates(true)
						}}
					]
				})
			}
		}
	})

})()

onVueSetup(function() {
	
	StartScreen.vue = new Vue({
		el: '#start_screen',
		data: {
			formats: Formats,
			recent: isApp ? recent_projects : []
		},
		methods: {
			getDate(p) {
				if (p.day) {
					var diff = (365e10 + Blockbench.openTime.dayOfYear() - p.day) % 365;
					if (diff <= 0) {
						return tl('dates.today');
					} else if (diff == 1) {
						return tl('dates.yesterday');
					} else if (diff <= 7) {
						return tl('dates.this_week');
					} else {
						return tl('dates.weeks_ago', [Math.ceil(diff/7)]);
					}
				} else {
					return '-'
				}
			},
			openProject: function(p, event) {
				Blockbench.read([p.path], {}, files => {
					loadModelFile(files[0]);
				})
				//readFile(p.path, !event.shiftKey)
			}
		}
	})
})
