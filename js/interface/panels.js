class Panel {
	constructor(id, data) {
		if (!data) data = id;
		let scope = this;
		this.type = 'panel';
		this.id = typeof id == 'string' ? id : data.id || 'new_panel';
		this.name = tl(data.name ? data.name : `panel.${this.id}`);
		this.icon = data.icon;
		this.menu = data.menu;
		this.condition = data.condition;
		this.previous_slot = 'left_bar';

		this.growable = data.growable;
		this.selection_only = data.selection_only == true;
		this.folded = false;

		this.onResize = data.onResize;
		this.onFold = data.onFold;
		this.toolbars = data.toolbars || {};

		if (!Interface.data.panels[this.id]) {
			Interface.data.panels[this.id] = {
				slot: data.default_side ? (data.default_side+'_bar') : 'left',
				float_position: [0, 0],
				float_size: [300, 300],
				height: 300,
			}
		}
		this.position_data = Interface.data.panels[this.id];
		if (data.default_position) {
			Merge.string(this.position_data, data.default_position, 'slot');
			Merge.arrayVector2(this.position_data, data.default_position, 'float_position');
			Merge.arrayVector2(this.position_data, data.default_position, 'float_size');
			Merge.string(this.position_data, data.default_position, 'height');
		}





		this.handle = Interface.createElement('h3', {class: 'panel_handle'}, Interface.createElement('label', {}, this.name));
		this.node = Interface.createElement('div', {class: 'panel', id: `panel_${this.id}`}, this.handle);

		if (this.selection_only) this.node.classList.add('selection_only');
		if (this.growable) this.node.classList.add('grow');

		/*
		let bar = $(`.sidebar#${data.default_side||'left'}_bar`);

		if (data.insert_before && bar.find(`> .panel#${data.insert_before}`).length) {
			$(this.node).insertBefore(bar.find(`> .panel#${data.insert_before}`));
		} else if (data.insert_after && bar.find(`> .panel#${data.insert_after}`).length) {
			$(this.node).insertAfter(bar.find(`> .panel#${data.insert_after}`));
		} else {
			bar.append(this.node);
		}*/


		
		// Toolbars
		for (let key in this.toolbars) {
			let toolbar = this.toolbars[key];
			if (toolbar instanceof Toolbar) {
				if (toolbar.label) {
					let label = Interface.createElement('p', {class: 'panel_toolbar_label'}, tl(toolbar.name));
					this.node.append(label);
				}
				this.node.append(toolbar.node);
			}
		}

		if (data.component) {
			
			let component_mount = Interface.createElement('div', {class: 'panel_vue_wrapper'});
			this.node.append(component_mount);
			let component_mounted = data.component.mounted;
			data.component.mounted = function() {
				Vue.nextTick(() => {

					let toolbar_wrappers = this.$el.querySelectorAll('.toolbar_wrapper');
					toolbar_wrappers.forEach(wrapper => {
						let id = wrapper.attributes.toolbar && wrapper.attributes.toolbar.value;
						let toolbar = scope.toolbars[id];
						if (toolbar) {
							wrapper.append(toolbar.node);
						}
					})

					if (typeof component_mounted == 'function') {
						component_mounted.call(this);
					}
					updateInterfacePanels()
				})
			}
			this.vue = this.inside_vue = new Vue(data.component).$mount(component_mount);

			// TODO: On mounted, add toolbars to anchors in Vue node, probably updateInterfacePanels()

			/*
			data.component.name = 'inside-vue'

			this.vue = new Vue({
				components: {
					'inside-vue': data.component
				},
				template: `<div class="panel ${this.selection_only ? 'selection_only' : ''} ${this.growable ? 'grow' : ''}" id="${this.id}">
					<inside-vue class="panel_inside" ref="inside"></inside-vue>
				</div>`,
				mounted() {
					Vue.nextTick(() => {
						updateInterfacePanels()
					})
				}
			}).$mount(this.node);

			this.inside_vue = this.vue.$refs.inside;*/
			
		}

		if (!Blockbench.isMobile) {

			let snap_button = Interface.createElement('div', {class: 'tool panel_control'}, Blockbench.getIconNode('drag_handle'))
			this.handle.append(snap_button);
			snap_button.addEventListener('click', (e) => {
				new Menu([
					{
						name: 'Right Sidebar',
						click: e2 => this.moveTo('right_bar')
					},
					{
						name: 'Left Sidebar',
						click: e2 => this.moveTo('left_bar')
					},
					{
						name: 'Top',
						click: e2 => this.moveTo('top')
					},
					{
						name: 'Bottom',
						click: e2 => this.moveTo('bottom')
					},
					{
						name: 'Float',
						click: e2 => this.moveTo('float')
					}
				]).show(snap_button);
			})

			let fold_button = Interface.createElement('div', {class: 'tool panel_control panel_folding_button'}, Blockbench.getIconNode('expand_more'))
			this.handle.append(fold_button);
			fold_button.addEventListener('click', (e) => {
				this.fold();
			})



			addEventListeners(this.handle.firstElementChild, 'mousedown touchstart', e1 => {
				convertTouchEvent(e1);
				let started = false;
				let position_before = this.slot == 'float'
					? this.position_data.float_position.slice()
					: [e1.clientX - e1.offsetX, e1.clientY - e1.offsetY - 55];

				let drag = e2 => {
					convertTouchEvent(e2);
					if (!started && (Math.pow(e2.clientX - e1.clientX, 2) + Math.pow(e2.clientX - e1.clientX, 2)) > 15) {
						started = true;
					}
					if (!started) return;

					this.position_data.float_position[0] = position_before[0] + e2.clientX - e1.clientX;
					this.position_data.float_position[1] = position_before[1] + e2.clientY - e1.clientY;
					this.update();

				}
				let stop = e2 => {
					convertTouchEvent(e2);

					this.moveTo('float')

					saveSidebarOrder()
					updateInterface()
					
					removeEventListeners(document, 'mousemove touchmove', drag);
					removeEventListeners(document, 'mouseup touchend', stop);
				}
				addEventListeners(document, 'mousemove touchmove', drag);
				addEventListeners(document, 'mouseup touchend', stop);

			})

			/*$(this.handle).draggable({
				revertDuration: 0,
				cursorAt: { left: 24, top: 24 },
				helper: 'clone',
				revert: true,
				appendTo: 'body',
				zIndex: 19,
				scope: 'panel',
				handle: '> label',
				start: function() {
					Interface.panel = scope;
				},
				drag(e, ui) {
					$('.panel[order]').attr('order', null)
					let target_panel = $('div.panel:hover').get(0);
					if (!target_panel) return;
					let top = $(target_panel).offset().top;
					let height = target_panel.clientHeight;
					if (e.clientY > top + height/2) {
						$(target_panel).attr('order', 1);
					} else {
						$(target_panel).attr('order', -1);
					}
				},
				stop: function(e, ui) {
					$('.panel[order]').attr('order', null)
					if (!ui) return;
					if (Math.abs(ui.position.top - ui.originalPosition.top) + Math.abs(ui.position.left - ui.originalPosition.left) < 30) return;
					let target = Interface.panel
					if (typeof target === 'string') {
						scope.moveTo(target)
					} else if (target.type === 'panel') {
						let target_pos = $(target.node).offset().top
						let target_height = target.node.clientHeight;
						let before = e.clientY < target_pos + target_height / 2
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
					saveSidebarOrder()
					updateInterface()
				}
			})*/
		} else {
			

			let fold_button = Interface.createElement('div', {class: 'tool panel_control panel_folding_button'}, Blockbench.getIconNode('expand_more'))
			this.handle.append(fold_button);
			fold_button.addEventListener('click', (e) => {
				this.fold();
			})
			

			let close_button = Interface.createElement('div', {class: 'tool panel_control'}, Blockbench.getIconNode('clear'))
			this.handle.append(close_button);
			close_button.addEventListener('click', (e) => {
				Interface.PanelSelectorVue.select(null);
			})
		}
		this.node.addEventListener('mousedown', event => {
			setActivePanel(this.id)
		})
		
		let reference_panel = Panels[data.insert_before || data.insert_after];
		this.moveTo(this.position_data.slot, reference_panel, reference_panel && !data.insert_after);
		
		// Sort
		if (Blockbench.setup_successful) {
			if (Interface.data.right_bar.includes(this.id) && this.slot == 'right_bar') {
				let index = Interface.data.right_bar.indexOf(this.id);
				if (index == 0) {
					this.moveTo('right_bar', Interface.Panels[Interface.data.right_bar[1]], true)
				} else {
					this.moveTo('right_bar', Interface.Panels[Interface.data.right_bar[index-1]], false)
				}
			} else if (Interface.data.left_bar.includes(this.id) && this.slot == 'left_bar') {
				let index = Interface.data.left_bar.indexOf(this.id);
				if (index == 0) {
					this.moveTo('left_bar', Interface.Panels[Interface.data.left_bar[1]], true)
				} else {
					this.moveTo('left_bar', Interface.Panels[Interface.data.left_bar[index-1]], false)
				}
			}
		}

		Interface.Panels[this.id] = this;
	}
	isVisible() {
		return !this.folded && this.node.parentElement && this.node.parentElement.style.display !== 'none';
	}
	get slot() {
		return this.position_data.slot;
	}
	fold(state = !this.folded) {
		this.folded = !!state;
		let new_icon = Blockbench.getIconNode(state ? 'expand_less' : 'expand_more');
		$(this.handle).find('> .panel_folding_button > .icon').replaceWith(new_icon);
		this.node.classList.toggle('folded', state);
		if (this.onFold) {
			this.onFold();
		}
	}
	moveTo(slot, ref_panel, before = false) {
		console.trace(this.id, slot)
		let position_data = this.position_data;
		if (slot == undefined) {
			slot = ref_panel.position_data.slot;
		}
		this.node.classList.remove('floating');

		if (slot.match(/_bar$/)) {
			if (ref_panel instanceof Panel && ref_panel.slot == slot) {
				if (before) {
					$(ref_panel.node).before(this.node);
				} else {
					$(ref_panel.node).after(this.node);
				}
			} else {
				$(`#${slot}`).append(this.node);
			}

		} else if (slot == 'top') {
			let top_panel = Interface.getTopPanel();
			if (top_panel && top_panel !== this) top_panel.moveTo(top_panel.previous_slot);

			document.getElementById('top_slot').append(this.node);

		} else if (slot == 'bottom') {
			let bottom_panel = Interface.getBottomPanel();
			if (bottom_panel && bottom_panel !== this) bottom_panel.moveTo(bottom_panel.previous_slot);

			document.getElementById('bottom_slot').append(this.node);

		} else if (slot == 'float') {
			document.getElementById('work_screen').append(this.node);
			this.node.classList.add('floating');
			this.node.style.left = position_data.float_position[0] + 'px';
			this.node.style.top  = position_data.float_position[1] + 'px';
			this.node.style.width  = position_data.float_size[0] + 'px';
			this.node.style.height = position_data.float_size[1] + 'px';
		}
		position_data.slot = slot;

		if (Panels[this.id]) {
			// Only update after initial setup
			if (this.onResize) {
				this.onResize()
			}
			saveSidebarOrder()
			updateInterface()
		}
	}
	update() {
		let show = BARS.condition(this.condition);
		let center_screen = document.querySelector('div#center');
		if (show) {
			$(this.node).show()
			if (Blockbench.isMobile) {
				this.width = this.node.clientWidth;
			} else if (this.slot == 'left_bar') {
				this.width = Interface.data.left_bar_width
			} else if (this.slot == 'right_bar') {
				this.width = Interface.data.right_bar_width
			}
			if (this.slot == 'float') {
				this.node.style.left = Math.clamp(this.position_data.float_position[0], 0, 5000);
				this.node.style.top = Math.clamp(this.position_data.float_position[1], 0, 5000);
				this.width  = Math.clamp(this.position_data.float_position[0], 100, center_screen.clientWidth) + 'px';
				this.height = Math.clamp(this.position_data.float_position[1], 100, center_screen.clientHeight) + 'px';
				this.node.style.width = this.width + 'px';
				this.node.style.height = this.height + 'px';
			}
			if (this.slot == 'top' || this.slot == 'bottom') {
				this.height = Math.clamp(this.position_data.height, 30, center_screen.clientHeight);
				this.node.style.height = this.height + 'px';
			}

			if (this.onResize) this.onResize()
		} else {
			$(this.node).hide()
		}
		localStorage.setItem('interface_data', JSON.stringify(Interface.data))
	}
	delete() {
		delete Interface.Panels[this.id];
		this.node.remove()
	}
}


function setupPanels() {

	//Panels
	new Panel('element', {
		icon: 'fas.fa-cube',
		condition: !Blockbench.isMobile && {modes: ['edit', 'pose']},
		selection_only: true,
		toolbars: {
			element_position: 	!Blockbench.isMobile && Toolbars.element_position,
			element_size: 		!Blockbench.isMobile && Toolbars.element_size,
			element_origin: 	!Blockbench.isMobile && Toolbars.element_origin,
			element_rotation: 	!Blockbench.isMobile && Toolbars.element_rotation,
		}
	})
	new Panel('bone', {
		icon: 'fas.fa-bone',
		condition: !Blockbench.isMobile && {modes: ['animate']},
		selection_only: true,
		component: {
			template: `
				<div>
					<p>${ tl('panel.element.origin') }</p>
					<div class="toolbar_wrapper bone_origin"></div>
				</div>
			`
		}
	})

	Interface.panel_definers.forEach((definer) => {
		if (typeof definer === 'function') {
			definer()
		}
	})
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


function setActivePanel(panel) {
	Prop.active_panel = panel
}

function saveSidebarOrder() {
	Interface.data.left_bar.empty();
	$('#left_bar > .panel').each((i, obj) => {
		let id = $(obj).attr('id');
		Interface.data.left_bar.push(id);
	})
	Interface.data.right_bar.empty();
	$('#right_bar > .panel').each((i, obj) => {
		let id = $(obj).attr('id');
		Interface.data.right_bar.push(id);
	})
	localStorage.setItem('interface_data', JSON.stringify(Interface.data))
}
