var ColorPanel;

//Panels

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
			axis: this.horizontal ? 'y' : 'x',
			containment: '#work_screen',
			revert: true,
			revertDuration: 0,
			start: function(e, u) {
				scope.before = data.get()
			},
			drag: function(e, u) {
				if (scope.horizontal) {
					data.set(scope.before, u.position.top - u.originalPosition.top)
				} else {
					data.set(scope.before, (u.position.left - u.originalPosition.left))
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
const Interface = {
	default_data: {
		left_bar_width: 366,
		right_bar_width: 314,
		quad_view_x: 50,
		quad_view_y: 50,
		timeline_height: 260,
		timeline_head: Blockbench.isMobile ? 140 : 196,
		left_bar: ['uv', 'textures', 'display', 'animations', 'keyframe', 'variable_placeholders'],
		right_bar: ['element', 'bone', 'color', 'skin_pose', 'outliner', 'chat']
	},
	get left_bar_width() {
		return Prop.show_left_bar ? Interface.data.left_bar_width : 0;
	},
	get right_bar_width() {
		return Prop.show_right_bar ? Interface.data.right_bar_width : 0;
	},
	Resizers: {
		left: new ResizeLine({
			id: 'left',
			condition: function() {
				if (!Prop.show_left_bar) return false;
				for (let p of Interface.data.left_bar) {
					if (Interface.Panels[p] && BARS.condition(Interface.Panels[p].condition)) {
						return true;
					}
				}
			},
			get: function() {return Interface.data.left_bar_width},
			set: function(o, diff) {
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
			position: function(line) {
				line.setPosition({
					top: document.getElementById('work_screen').offsetTop,
					bottom: 0,
					left: Interface.data.left_bar_width+2
				})
			}
		}),
		right: new ResizeLine({
			id: 'right',
			condition: function() {
				if (!Prop.show_right_bar) return false;
				for (let p of Interface.data.right_bar) {
					if (Interface.Panels[p] && BARS.condition(Interface.Panels[p].condition)) {
						return true;
					}
				}
			},
			get: function() {return Interface.data.right_bar_width},
			set: function(o, diff) {
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
			position: function(line) {
				line.setPosition({
					top: document.getElementById('work_screen').offsetTop+30,
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
			position: function(line) {
				var p = document.getElementById('preview')
				line.setPosition({
					top: 32,
					bottom: p ? window.innerHeight - (p.clientHeight + p.offsetTop) : 0,
					left: Interface.left_bar_width + document.getElementById('preview').clientWidth*Interface.data.quad_view_x/100
				}
			)}
		}),
		quad_view_y: new ResizeLine({
			id: 'quad_view_y',
			horizontal: true,
			condition: function() {return quad_previews.enabled},
			get: function() {return Interface.data.quad_view_y},
			set: function(o, diff) {
				Interface.data.quad_view_y = limitNumber(o + diff/document.getElementById('preview').clientHeight*100, 5, 95)
			},
			position: function(line) {line.setPosition({
				left: Interface.left_bar_width+2,
				right: Interface.right_bar_width+2,
				top: $('#preview').offset().top + document.getElementById('preview').clientHeight*Interface.data.quad_view_y/100
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
				left: Interface.left_bar_width+2,
				right: Interface.right_bar_width+2,
				top: $('#timeline').offset().top
			})}
		}),
		timeline_head: new ResizeLine({
			id: 'timeline_head',
			horizontal: false,
			condition() {return Modes.animate},
			get() {return Interface.data.timeline_head},
			set(o, diff) {
				let value = limitNumber(o + diff, 90, document.getElementById('timeline').clientWidth - 40);
				value = Math.snapToValues(value, [Interface.default_data.timeline_head], 12);
				Interface.data.timeline_head = Timeline.vue._data.head_width = value;
			},
			position(line) {line.setPosition({
				left: Interface.left_bar_width+2 + Interface.data.timeline_head,
				top: $('#timeline').offset().top + 60,
				bottom: document.getElementById('status_bar').clientHeight + 12,
			})}
		})
	},
	status_bar: {},
	Panels: {},
	toggleSidebar(side) {
		let status = !Prop[`show_${side}_bar`];
		Prop[`show_${side}_bar`] = status;
		resizeWindow();
	}
}
Interface.panel_definers = []
Interface.definePanels = function(callback) {
	Interface.panel_definers.push(callback);
}

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
	Interface.data = $.extend(true, {}, Interface.default_data)
	var interface_data = localStorage.getItem('interface_data')
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
	} catch (err) {}

	translateUI()

	document.getElementById('title_bar_home_button').title = tl('projects.start_screen');

	$('#center').toggleClass('checkerboard', settings.preview_checkerboard.value);

	setupPanels()
	
	if (Blockbench.isMobile && window.setupMobilePanelSelector) {
		setupMobilePanelSelector()
	}

	for (var key in Interface.Resizers) {
		var resizer = Interface.Resizers[key]
		$('#work_screen').append(resizer.node)
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

		if ((tooltip.offset().left + tooltip.width()) - window.innerWidth > 4) {
			tooltip.css('right', '-4px')
		} else if ($(this).parent().css('position') == 'relative') {
			tooltip.css('right', '0')
		}
	})




	//Clickbinds
	$('header'	).click(function() { setActivePanel('header'  )})
	$('#preview').click(function() { setActivePanel('preview' )})

	$('#texture_list').click(function(){
		unselectTextures()
	})
	$('#timeline').mousedown((event) => {
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
			name: 'Copy',
			icon: 'fa-copy',
			click() {
				document.execCommand('copy');
			}
		},
		{
			id: 'paste',
			name: 'Paste',
			icon: 'fa-paste',
			click() {
				document.execCommand('paste');
			}
		}
	])

	$(document).on('contextmenu', function(event) {
		if (!$(event.target).hasClass('allow_default_menu')) {
			if (event.target.nodeName === 'INPUT' && $(event.target).is(':focus')) {
				Interface.text_edit_menu.open(event, event.target)
			}
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

function updateInterface() {
	BARS.updateConditions()
	MenuBar.update()
	resizeWindow()
	localStorage.setItem('interface_data', JSON.stringify(Interface.data))
}
function updateInterfacePanels() {

	if (!Blockbench.isMobile) {
		$('.sidebar#left_bar').css('display', Prop.show_left_bar ? 'flex' : 'none');
		$('.sidebar#right_bar').css('display', Prop.show_right_bar ? 'flex' : 'none');
	}
	let work_screen = document.getElementById('work_screen');

	work_screen.style.setProperty(
		'grid-template-columns',
		Interface.data.left_bar_width+'px auto '+ Interface.data.right_bar_width +'px'
	)
	for (var key in Interface.Panels) {
		var panel = Interface.Panels[key]
		panel.update()
	}
	var left_width = $('.sidebar#left_bar > .panel:visible').length ? Interface.left_bar_width : 0;
	var right_width = $('.sidebar#right_bar > .panel:visible').length ? Interface.right_bar_width : 0;

	if (!left_width || !right_width) {
		work_screen.style.setProperty(
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
	if (!Preview.all || (event && event.target && event.target !== window)) {
		return;
	}
	if (Interface.data) {
		updateInterfacePanels()
	}
	if (Animator.open) {
		Timeline.updateSize()
	}
	Preview.all.forEach(function(prev) {
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
		zoom = limitNumber(zoom, 1, 4)
		UVEditor.setZoom(zoom)

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

//Dialogs
function showDialog(dialog) {
	var obj = $('.dialog#'+dialog)
	$('.dialog').hide()
	if (open_menu) {
		open_menu.hide()
	}
	$('#blackout').show()
	obj.show()
	open_dialog = dialog
	open_interface = {
		confirm() {
			$('dialog#'+open_dialog).find('.confirm_btn:not([disabled])').trigger('click');
		},
		cancel() {
			$('dialog#'+open_dialog).find('.cancel_btn:not([disabled])').trigger('click');
		}
	}
	Prop.active_panel = 'dialog'
	//Draggable
	if (obj.hasClass('draggable')) {
		obj.draggable({
			handle: ".dialog_handle",
			containment: '#page_wrapper'
		})
		var x = (window.innerWidth-obj.outerWidth()) / 2;
		obj.css('left', x+'px')
		obj.css('max-height', (window.innerHeight-128)+'px')
	}
}
function hideDialog() {
	$('#blackout').hide()
	$('.dialog').hide()
	open_dialog = false;
	open_interface = false;
	Prop.active_panel = undefined
}

function getStringWidth(string, size) {
	var a = $('<label style="position: absolute">'+string+'</label>')
	if (size && size !== 16) {
		a.css('font-size', size+'pt')
	}
	$('body').append(a.css('visibility', 'hidden'))
	var width = a.width()
	a.detach()
	return width;
};

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

Interface.createElement = (tag, attributes = {}, content) => {
	let el = document.createElement(tag);
	for (let key in attributes) {
		el.setAttribute(key, attributes[key]);
	}
	if (typeof content == 'string') el.textContent = content;
	if (content instanceof Array) {
		content.forEach(node => el.append(node));
	}
	if (content instanceof HTMLElement) el.append(content);
	return el;
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
			modifier_keys: {
				ctrl: [],
				shift: [],
				alt: []
			}
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
						<kbd>${tl(Blockbench.platform == 'darwin' ? 'keys.cmd' : 'keys.ctrl')}</kbd>
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
