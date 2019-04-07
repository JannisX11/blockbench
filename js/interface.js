var app_colors;

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
		$('body').append(this.node)
		jq.draggable({
			axis: this.horizontal ? 'y' : 'y',
			containment: 'document',
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
		left_bar_width: 338,
		right_bar_width: 300,
		quad_view_x: 50,
		quad_view_y: 50,
		left_bar: ['uv', 'textures', 'display', 'animations', 'keyframe', 'variable_placeholders'],
		right_bar: ['options', 'outliner']
	},
	Resizers: {
		left: new ResizeLine({
			id: 'left',
			condition: function() {
				var i = 0;
				Interface.data.left_bar.forEach(p => {
					if (BARS.condition(Interface.Panels[p].condition)) {i++;}
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
					left: Interface.data.left_bar_width-2
				})
			}
		}),
		right: new ResizeLine({
			id: 'right',
			condition: function() {
				var i = 0;
				Interface.data.right_bar.forEach(p => {
					if (BARS.condition(Interface.Panels[p].condition)) {i++;}
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
					right: Interface.data.right_bar_width-2
				})
			}
		}),
		quad_view_x: new ResizeLine({
			id: 'quad_view_x',
			condition: function() {return quad_previews.enabled},
			get: function() {return Interface.data.quad_view_x},
			set: function(o, diff) {Interface.data.quad_view_x = limitNumber(o + diff/$('#preview').width()*100, 5, 95)},
			position: function(line) {line.setPosition({
				top: 32,
				bottom: 0,
				left: Interface.data.left_bar_width + $('#preview').width()*Interface.data.quad_view_x/100
			})}
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
				top: 32+$('#preview').height()*Interface.data.quad_view_y/100
			})}
		})
	},
	status_bar: {},
	Panels: {}
}

//Misc
function setupInterface() {
	Interface.data = $.extend(true, {}, Interface.default_data)
	var interface_data = localStorage.getItem('interface_data')
	try {
		interface_data = JSON.parse(interface_data)
		Interface.data.left_bar = interface_data.left_bar
		Interface.data.right_bar = interface_data.right_bar
		$.extend(true, Interface.data, interface_data)
	} catch (err) {}

	$('.entity_mode_only').hide()
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
		condition: function() {return !display_mode && !Animator.open},
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
		condition: function() {return !display_mode && !Animator.open},
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
	Interface.Panels.options = new Panel({
		id: 'options',
		condition: function() {return Modes.id === 'edit'},
		toolbars: {
			rotation: Toolbars.rotation,
			origin: Toolbars.origin,
		}
	})
	Interface.Panels.color = new Panel({
		id: 'color',
		condition: () => Modes.id === 'paint',
		toolbars: {

		},
		onResize: t => {
			$('#main_colorpicker').spectrum('reflow');
			var h = $('.panel#color .sp-container.sp-flat').height()-20;
			$('.panel#color .sp-palette').css('max-height', h+'px')
		}
	})
	Interface.Panels.color.picker = $('#main_colorpicker').spectrum({
			preferredFormat: "hex",
			color: 'ffffff',
			flat: true,
			showAlpha: true,
			showInput: true,
			maxSelectionSize: 128,
			showPalette: true,
			palette: [],
			localStorageKey: 'brush_color_palette',
			move: function(c) {
				$('#main_colorpicker_preview > div').css('background-color', c.toRgbString())
			}
		})
	Interface.Panels.outliner = new Panel({
		id: 'outliner',
		condition: function() {return !display_mode},
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
		'save'
	])
	//$(document).contextmenu()


	//Tooltip Fix
	$('.tool').on('mouseenter', function() {

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
	$(document).mousedown(function(event) {
		if (open_menu && $('.contextMenu').find(event.target).length === 0 && $('.menu_bar_point.opened:hover').length === 0) {
			open_menu.hide();
		}
		if (ActionControl.open && $('#action_selector').find(event.target).length === 0) {
			ActionControl.hide();
		}
		if ($(event.target).is('input.cube_name:not([disabled])') === false) {
			stopRenameCubes()
		}
	})
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
	$('body').css(
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
		$('body').css(
			'grid-template-columns',
			left_width+'px auto '+ right_width +'px'
		)
	}

	$('.quad_canvas_wrapper.qcw_x').css('width', Interface.data.quad_view_x+'%')
	$('.quad_canvas_wrapper.qcw_y').css('height', Interface.data.quad_view_y+'%')
	$('.quad_canvas_wrapper:not(.qcw_x)').css('width', (100-Interface.data.quad_view_x)+'%')
	$('.quad_canvas_wrapper:not(.qcw_y)').css('height', (100-Interface.data.quad_view_y)+'%')
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
	BARS.updateToolToolbar()
}
$(window).resize(resizeWindow)

function setActivePanel(panel) {
	Prop.active_panel = panel
}
function setProjectTitle(title) {
	if (Blockbench.entity_mode && Project.parent) {
		title = Project.parent
	}
	if (title) {
		Prop.file_name = Prop.file_name_alt = title
		if (!Project.name) {
			Project.name = title
		}
		if (Blockbench.entity_mode) {
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
	$('#blackout').fadeIn(200)
	obj.fadeIn(200)
	open_dialog = dialog
	open_interface = dialog
	Prop.active_panel = 'dialog'
	//Draggable
	if (obj.hasClass('draggable')) {
		obj.draggable({
			handle: ".dialog_handle",
			containment: 'body'
		})
		var x = ($(window).width()-obj.width())/2
		obj.css('left', x+'px')
		obj.css('top', '64px')
		obj.css('max-height', ($(window).height()-128)+'px')
	}
}
function hideDialog() {
	$('#blackout').fadeOut(200)
	$('.dialog').fadeOut(200)
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
		$('#keybindlist').css('max-height', ($(window).height() - 320) +'px')
	} else if (tab === 'setting') {
		//Settings
		$('#settingslist').css('max-height', ($(window).height() - 320) +'px')
	} else if (tab === 'layout_settings') {
		$('#layout_font_main').val(app_colors.main.font)
		$('#layout_font_headline').val(app_colors.headline.font)
	}
}

//Color
function colorSettingsSetup(reset) {
	app_colors = {
		back: {hex: '#21252b'},
		dark: {hex: '#17191d'},
		border: {hex: '#181a1f'},
		ui: {hex: '#282c34'},
		bright_ui: {hex: '#f4f3ff'},
		accent: {hex: '#3e90ff'},
		button: {hex: '#3a3f4b'},
		selected: {hex: '#495061'},
		text: {hex: '#cacad4'},
		light: {hex: '#f4f3ff'},
		text_acc: {hex: '#000006'},
		grid: {hex: '#495061'},
		wireframe: {hex: '#576f82'},
		main: {font: ''},
		headline: {font: ''},
		css: ''
	}
	if (reset) {
		$('#layout_font_main').val('')
		$('#layout_font_headline').val('')
		changeUIFont('main')
		changeUIFont('headline')
		$('style#bbstyle').text('')
		resizeWindow()
	}
	if (localStorage.getItem('app_colors') != null && reset != true) {
		var stored_app_colors = JSON.parse(localStorage.getItem('app_colors'))
		$.extend(app_colors, stored_app_colors)
	}
	updateUIColor()
	buildGrid()
}
function initUIColor(event) {
	var type = $(event.target).attr('id').split('color_')[1]
	$('input#color_'+type).val(app_colors[type].hex)
}
function changeUIColor(event) {
	var type = $(event.target).attr('id').split('color_')[1]

	app_colors[type].hex = $('input#color_'+type).val()
	updateUIColor()
}
function changeUIFont(type) {
	var font = $('#layout_font_'+type).val()
	app_colors[type].font = font
	if (type === 'main') {
		$('body').css('font-family', app_colors[type].font)
	} else {
		$('h1, h2, h3, h4, h5').css('font-family', app_colors[type].font)
	}
}
function updateUIColor() {
	for (var type in app_colors) {
		if (app_colors.hasOwnProperty(type)) {
			if (type === 'css') {
				$('style#bbstyle').text(app_colors.css)
			} else if (app_colors[type].hex) {
				document.body.style.setProperty('--color-'+type, app_colors[type].hex);
			} else if (app_colors[type].font) {
				if (type === 'main') {
					$('body').css('font-family', app_colors[type].font)
				} else {
					$('h1, h2, h3, h4, h5').css('font-family', app_colors[type].font)
				}
			}
		}
	}
	$('meta[name=theme-color]').attr('content', app_colors.ui.hex)

	var c_outline = parseInt('0x'+app_colors.accent.hex.replace('#', ''))
	if (!gizmo_colors.outline || c_outline !== gizmo_colors.outline.getHex()) {
		gizmo_colors.outline = new THREE.Color( c_outline )
		Canvas.outlineMaterial.color = gizmo_colors.outline
	}
	var w_wire = parseInt('0x'+app_colors.wireframe.hex.replace('#', ''))
	if (!gizmo_colors.wire || w_wire !== gizmo_colors.wire.getHex()) {
		gizmo_colors.wire = new THREE.Color( w_wire )
		Canvas.wireframeMaterial.color = gizmo_colors.wire
	}

	var c_grid = parseInt('0x'+app_colors.grid.hex.replace('#', ''))
	if (!gizmo_colors.grid || c_grid !== gizmo_colors.grid.getHex()) {
		gizmo_colors.grid = new THREE.Color( c_grid )
		three_grid.children.forEach(c => {
			if (c.name === 'grid' && c.material) {
				c.material.color = gizmo_colors.grid;
			}
		})
	}

	localStorage.setItem('app_colors', JSON.stringify(app_colors))
}

//BBLayout
function applyBBStyle(data) {
	data = autoParseJSON(data)
	if (typeof data !== 'object') return;
	$.extend(app_colors, data)
	if (data.css) {
		$('style#bbstyle').text(data.css)
		resizeWindow()
	}
	updateUIColor()
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

//SplashScreen
var splashScreen = {
	attempt: function(res) {
		//NOW:  Internet Available! -- DOM Ready!
		//Post Model
		if (!isApp && tryLoadPOSTModel()) {
			return;
		}
		//Show
		if (res[1] ||//Forced
			Blockbench.hasFlag('after_update')//Updated
		) {
			splashScreen.show()
		}
	},
	show: function() {
		if (open_dialog) return;
		$('#welcome_content').load('https://www.blockbench.net/api/welcome/index.html', () => {
			$('#welcome_screen #welcome_body').css('max-height', ($(window).height() - 478) + 'px')
			if (isApp) {
				$('#welcome_screen .open-in-browser').click((event) => {
					event.preventDefault();
					shell.openExternal(event.target.href);
					return true;
				});
			}
			showDialog('welcome_screen')
			Blockbench.dispatchEvent('show_splash_screen')
			localStorage.setItem('welcomed_version', appVersion) 
		})
	},
	p_doc: new Promise(function(resolve, reject) {
		$(document).ready(function() {
			resolve(true)
		})
	}),
	p_force: new Promise(function(resolve, reject) {
		$.getJSON('https://blockbench.net/api/index.json', function (data) {
			resolve(data.forceSplashScreen)
		})
	})
}
Promise.all([splashScreen.p_doc, splashScreen.p_force]).then(splashScreen.attempt)
