class Panel extends EventSystem {
	constructor(id, data) {
		super();
		if (!data) data = id;
		let scope = this;
		this.type = 'panel';
		this.id = typeof id == 'string' ? id : data.id || 'new_panel';
		this.name = tl(data.name ? data.name : `panel.${this.id}`);
		this.icon = data.icon;
		this.menu = data.menu;
		this.condition = data.condition;
		this.display_condition = data.display_condition;
		this.previous_slot = 'left_bar';
		this.optional = data.optional ?? true;
		this.plugin = data.plugin || (typeof Plugins != 'undefined' ? Plugins.currently_loading : '');

		this.growable = data.growable;
		this.resizable = data.resizable;
		this.min_height = data.min_height ?? 60;

		this.onResize = data.onResize;
		this.onFold = data.onFold;
		this.events = {};
		this.toolbars = [];

		if (!Interface.data.panels[this.id]) Interface.data.panels[this.id] = {};
		if (!Interface.getModeData().panels[this.id]) Interface.getModeData().panels[this.id] = {};
		this.position_data = Interface.getModeData().panels[this.id];
		let defaultp = this.default_position = data.default_position || 0;
		if (defaultp && defaultp.slot) this.previous_slot = defaultp.slot;
		if (!this.position_data.slot) 			this.position_data.slot 			= defaultp.slot || (data.default_side ? (data.default_side+'_bar') : 'left_bar');
		if (!this.position_data.float_position)	this.position_data.float_position 	= defaultp.float_position || [0, 0];
		if (!this.position_data.float_size) 	this.position_data.float_size 		= defaultp.float_size || [300, 300];
		if (!this.position_data.height) 		this.position_data.height 			= defaultp.height || 300;
		if (this.position_data.folded == undefined) 		this.position_data.folded 		= defaultp.folded || false;
		if (this.position_data.fixed_height == undefined) 	this.position_data.fixed_height = defaultp.fixed_height || false;

		for (let mode_id in Interface.data.modes) {
			let mode_data = Interface.getModeData(mode_id);
			if (!mode_data.panels[this.id]) mode_data.panels[this.id] = JSON.parse(JSON.stringify(this.position_data));
		}

		this.handle = Interface.createElement('h3', {class: 'panel_handle'}, Interface.createElement('label', {}, Interface.createElement('span', {}, this.name)));
		this.node = Interface.createElement('div', {class: 'panel', id: `panel_${this.id}`}, this.handle);

		if (this.growable) this.node.classList.add('grow');
		
		// Toolbars
		let toolbars = data.toolbars instanceof Array ? data.toolbars : (data.toolbars ? Object.keys(data.toolbars) : []);

		for (let item of toolbars) {
			let toolbar = item instanceof Toolbar ? item : this.toolbars[item];
			if (toolbar instanceof Toolbar == false) continue;

			if (toolbar.label) {
				let label = Interface.createElement('p', {class: 'panel_toolbar_label'}, tl(toolbar.name));
				this.node.append(label);
				toolbar.label_node = label;
			}
			this.node.append(toolbar.node);
			this.toolbars.push(toolbar);
		}

		if (data.component) {
			
			let component_mount = Interface.createElement('div');
			this.node.append(component_mount);
			let onmounted = data.component.mounted;
			data.component.mounted = function() {
				Vue.nextTick(() => {

					let toolbar_wrappers = this.$el.querySelectorAll('.toolbar_wrapper');
					toolbar_wrappers.forEach(wrapper => {
						let id = wrapper.attributes.toolbar && wrapper.attributes.toolbar.value;
						let toolbar = scope.toolbars.find(toolbar => toolbar.id == id);
						if (toolbar) {
							wrapper.append(toolbar.node);
						}
					})

					if (typeof onmounted == 'function') {
						onmounted.call(this);
					}
					//updateInterfacePanels()
				})
			}
			this.vue = this.inside_vue = new Vue(data.component).$mount(component_mount);	
			scope.vue.$el.classList.add('panel_vue_wrapper');
		}

		if (!Blockbench.isMobile) {
			if (data.expand_button) {
				let expand_button = Interface.createElement('div', {class: 'tool panel_control panel_expanding_button'}, Blockbench.getIconNode('fullscreen'))
				this.handle.append(expand_button);
				expand_button.addEventListener('click', (e) => {
					if (this.slot == 'float') {
						this.moveTo(this.previous_slot);
					} else {
						this.moveTo('float');
						this.moveToFront();
					}
				})
			}

			let snap_button = Interface.createElement('div', {class: 'tool panel_control'}, Blockbench.getIconNode('drag_handle'))
			this.handle.append(snap_button);
			snap_button.addEventListener('click', (e) => {
				this.snap_menu.show(snap_button, this);
			})

			let fold_button = Interface.createElement('div', {class: 'tool panel_control panel_folding_button'}, Blockbench.getIconNode('expand_more'))
			this.handle.append(fold_button);
			fold_button.addEventListener('click', (e) => {
				this.fold();
			})

			this.handle.firstElementChild.addEventListener('dblclick', e => {
				this.fold();
			})


			if (this.resizable) {
				this.sidebar_resize_handle = Interface.createElement('div', {class: 'panel_sidebar_resize_handle'})
				this.node.append(this.sidebar_resize_handle);
				let resize = e1 => {
					let height_before = this.node.clientHeight;
					let started = false;
					let direction = this.node.classList.contains('bottommost_panel') ? -1 : 1;
					let other_panel_height_before = {};

					let other_panels = this.slot == 'right_bar' ? Interface.getRightPanels() : Interface.getLeftPanels();

					let drag = e2 => {
						convertTouchEvent(e2);
						if (!started && (Math.pow(e2.clientX - e1.clientX, 2) + Math.pow(e2.clientY - e1.clientY, 2)) > 12) {
							started = true;
							this.sidebar_resize_handle.classList.add('dragging');
						}
						if (!started) return;

						let change_amount = (e2.clientY - e1.clientY) * direction;
						let sidebar_gap = this.node.parentElement.clientHeight;
						for (let panel of other_panels) {
							sidebar_gap -= panel.node.clientHeight;
						}

						let height1 = this.position_data.height;
						this.position_data.fixed_height = true;
						this.position_data.height = Math.max(height_before + change_amount, this.min_height);
						this.update();
						let height_difference = this.position_data.height - height1;

						let panel_b = other_panels.find(p => p != this && p.resizable && p.min_height < (p.height??p.node.clientHeight));
						if (sidebar_gap < 1 && panel_b && change_amount > 0) {
							if (!other_panel_height_before[panel_b.id]) other_panel_height_before[panel_b.id] = (panel_b.height??panel_b.node.clientHeight);
							panel_b.position_data.fixed_height = true;
							panel_b.position_data.height = Math.max(panel_b.position_data.height - height_difference, this.min_height);
							panel_b.update();
						}
					}
					let stop = e2 => {
						convertTouchEvent(e2);
						
						removeEventListeners(document, 'mousemove touchmove', drag);
						removeEventListeners(document, 'mouseup touchend', stop);
						this.sidebar_resize_handle.classList.remove('dragging');
					}
					addEventListeners(document, 'mousemove touchmove', drag);
					addEventListeners(document, 'mouseup touchend', stop);
				}
				addEventListeners(this.sidebar_resize_handle, 'mousedown touchstart', (event) => resize(event));
			}


			addEventListeners(this.handle.firstElementChild, 'mousedown touchstart', e1 => {
				if (e1.which == 2 || e1.which == 3) return;
				convertTouchEvent(e1);
				let started = false;
				let position_before = this.slot == 'float'
					? this.position_data.float_position.slice()
					: [e1.clientX - e1.offsetX, e1.clientY - e1.offsetY - 55];
				let original_show_left_bar = Prop.show_left_bar;
				let original_show_right_bar = Prop.show_right_bar;

				let target_slot, target_panel, target_before;
				function updateTargetHighlight() {
					$(`.panel[order]`).attr('order', null);
					if (target_panel) target_panel.node.setAttribute('order', target_before ? -1 : 1);

					if (target_slot) {
						Interface.center_screen.setAttribute('snapside', target_slot);
					} else {
						Interface.center_screen.removeAttribute('snapside');
					}
					if ((target_slot == 'right_bar' && Interface.right_bar_width) || (target_slot == 'left_bar' && Interface.left_bar_width)) {
						Interface.center_screen.removeAttribute('snapside');
					}
					Interface.left_bar.classList.toggle('drop_target', target_slot == 'left_bar');
					Interface.right_bar.classList.toggle('drop_target', target_slot == 'right_bar');

					if (target_slot == 'left_bar' && !Prop.show_left_bar) Interface.toggleSidebar('left');
					if (target_slot == 'right_bar' && !Prop.show_right_bar) Interface.toggleSidebar('right');
					if (target_slot != 'left_bar' && Prop.show_left_bar && !original_show_left_bar) Interface.toggleSidebar('left');
					if (target_slot != 'right_bar' && Prop.show_right_bar && !original_show_right_bar) Interface.toggleSidebar('right');
				}

				let drag = e2 => {
					convertTouchEvent(e2);
					if (!started && (Math.pow(e2.clientX - e1.clientX, 2) + Math.pow(e2.clientY - e1.clientY, 2)) > 15) {
						started = true;
						if (this.slot !== 'float') {
							this.moveTo('float');
							this.moveToFront();
						}
						this.node.classList.add('dragging');
					}
					if (!started) return;
					
					this.position_data.float_position[0] = position_before[0] + e2.clientX - e1.clientX;
					this.position_data.float_position[1] = position_before[1] + e2.clientY - e1.clientY;

					let threshold = 40;
					let threshold_y = 64;
					target_slot = null; target_panel = null; target_before = false;

					if (e2.ctrlOrCmd) {
					} else if (e2.clientX < Math.max(Interface.left_bar_width, threshold)) {

						let y = Interface.work_screen.offsetTop;
						target_slot = 'left_bar';
						for (let child of Interface.left_bar.childNodes) {
							if (!child.clientHeight) continue;
							target_panel = Panels[child.id.replace(/^panel_/, '')];
							if (e2.clientY < (y + child.clientHeight / 2)) {
								target_before = true;
								break;
							}
							y += child.clientHeight;
						}

					} else if (e2.clientX > document.body.clientWidth - Math.max(Interface.right_bar_width, threshold)) {
						
						let y = Interface.work_screen.offsetTop + 30;
						target_slot = 'right_bar';
						for (let child of Interface.right_bar.childNodes) {
							if (!child.clientHeight) continue;
							target_panel = Panels[child.id.replace(/^panel_/, '')];
							if (e2.clientY < (y + child.clientHeight / 2)) {
								target_before = true;
								break;
							}
							y += child.clientHeight;
						}

					} else if (
						e2.clientY < (Interface.work_screen.offsetTop + 30 + threshold_y) &&
						e2.clientX > Interface.left_bar_width && e2.clientX < (Interface.work_screen.clientWidth - Interface.right_bar_width)
					) {
						target_slot = 'top'

					} else if (
						e2.clientY > Interface.work_screen.offsetTop + Interface.work_screen.clientHeight - Interface.status_bar.vue.$el.clientHeight - threshold_y &&
						e2.clientX > Interface.left_bar_width && e2.clientX < (Interface.work_screen.clientWidth - Interface.right_bar_width)
					) {
						target_slot = 'bottom'

					}
					updateTargetHighlight();
					this.update(true);
					this.dispatchEvent('drag', {event: e2, target_before, target_panel, target_slot});
				}
				let stop = e2 => {
					convertTouchEvent(e2);
					this.node.classList.remove('dragging');
					Interface.center_screen.removeAttribute('snapside');
					$(`.panel[order]`).attr('order', null);
					Interface.left_bar.classList.remove('drop_target');
					Interface.right_bar.classList.remove('drop_target');

					if (target_slot) {
						this.fixed_height = false;
						this.moveTo(target_slot, target_panel, target_before)
					}

					if (this.slot != 'float') {
						this.position_data.float_position[0] = position_before[0];
						this.position_data.float_position[1] = position_before[1];
					}
					this.update();
					updateInterface()
					
					removeEventListeners(document, 'mousemove touchmove', drag);
					removeEventListeners(document, 'mouseup touchend', stop);
				}
				addEventListeners(document, 'mousemove touchmove', drag);
				addEventListeners(document, 'mouseup touchend', stop);

			})
		} else {			

			let close_button = Interface.createElement('div', {class: 'tool panel_control'}, Blockbench.getIconNode('clear'))
			this.handle.append(close_button);
			close_button.addEventListener('click', (e) => {
				Interface.PanelSelectorVue.select(null);
			})
			

			addEventListeners(this.handle.firstElementChild, 'mousedown touchstart', e1 => {
				convertTouchEvent(e1);
				let started = false;
				let height_before = this.position_data.height;
				let max = Blockbench.isLandscape ? window.innerWidth - 50 : Interface.work_screen.clientHeight;

				let drag = e2 => {
					convertTouchEvent(e2);
					let diff = Blockbench.isLandscape ? e1.clientX - e2.clientX : e1.clientY - e2.clientY;
					if (!started && Math.abs(diff) > 4) {
						started = true;
						if (this.folded) this.fold();
					}
					if (!started) return;
					
					let sign = (Blockbench.isLandscape && settings.mobile_panel_side.value == 'left') ? -1 : 1;
					this.position_data.height = Math.clamp(height_before + diff * sign, 140, max);

					this.update(true);
					resizeWindow();

				}
				let stop = e2 => {
					convertTouchEvent(e2);

					this.update();
					
					removeEventListeners(document, 'mousemove touchmove', drag);
					removeEventListeners(document, 'mouseup touchend', stop);
				}
				addEventListeners(document, 'mousemove touchmove', drag);
				addEventListeners(document, 'mouseup touchend', stop);

			})
		}
		this.node.addEventListener('mousedown', event => {
			setActivePanel(this.id);
			this.moveToFront();
		})
		
		
		// Add to slot
		if (Blockbench.isMobile) {
			this.moveTo('left_bar');
		} else {
			let reference_panel = Panels[data.insert_before || data.insert_after];
			this.moveTo(this.position_data.slot, reference_panel, reference_panel && !data.insert_after);
		}

		if (this.folded) this.fold(true);

		Panels[this.id] = this;
	}
	isVisible() {
		return !this.folded && this.node.parentElement && this.node.parentElement.style.display !== 'none';
	}
	isInSidebar() {
		return this.slot === 'left_bar' || this.slot === 'right_bar';
	}
	get slot() {
		return this.position_data.slot;
	}
	get folded() {
		return this.position_data.folded;
	}
	set folded(state) {
		this.position_data.folded = !!state;
	}
	get fixed_height() {
		return this.position_data.fixed_height;
	}
	set fixed_height(state) {
		this.position_data.fixed_height = !!state;
	}
	resetCustomLayout() {
		if (!Interface.getModeData().panels[this.id]) Interface.getModeData().panels[this.id] = {};
		this.position_data = Interface.getModeData().panels[this.id];
		
		let defaultp = this.default_position || 0;
		if (!this.position_data.slot) 			this.position_data.slot 			= defaultp.slot || 'left_bar';
		if (!this.position_data.float_position)	this.position_data.float_position 	= defaultp.float_position || [0, 0];
		if (!this.position_data.float_size) 	this.position_data.float_size 		= defaultp.float_size || [300, 300];
		if (!this.position_data.height) 		this.position_data.height 			= defaultp.height || 300;
		if (this.position_data.folded == undefined)			this.position_data.folded 		= defaultp.folded || false;
		if (this.position_data.fixed_height == undefined) 	this.position_data.fixed_height = defaultp.fixed_height || false;

		for (let mode_id in Interface.data.modes) {
			let mode_data = Interface.getModeData(mode_id);
			if (!mode_data.panels[this.id]) mode_data.panels[this.id] = JSON.parse(JSON.stringify(this.position_data));
		}

		this.moveTo(this.slot);
		this.fold(this.folded);
		return this;
	}
	addToolbar(toolbar, position = this.toolbars.length) {
		let nodes = [];
		if (toolbar.label) {
			let label = Interface.createElement('p', {class: 'panel_toolbar_label'}, tl(toolbar.name));
			nodes.push(label);
			toolbar.label_node = label;
		}
		nodes.push(toolbar.node);
		if (position == 0) {
			this.handle.after(...nodes);
		} else if (typeof position == 'string') {
			let anchor = this.node.querySelector(`.toolbar[toolbar_id="${position}"]`);
			if (anchor) {
				anchor.after(...nodes);
			}
		} else {
			this.node.append(...nodes);
		}
		this.toolbars.splice(position, 0, toolbar);
	}
	fold(state = !this.folded) {
		this.folded = !!state;
		let new_icon = Blockbench.getIconNode(state ? 'expand_less' : 'expand_more');
		$(this.handle).find('> .panel_folding_button > .icon').replaceWith(new_icon);
		this.node.classList.toggle('folded', state);
		if (this.onFold) {
			this.onFold();
		}
		if (this.slot == 'top' || this.slot == 'bottom') {
			resizeWindow();
		}
		this.update();
		this.dispatchEvent('fold', {});
		return this;
	}
	setupFloatHandles() {
		let sides = [
			Interface.createElement('div', {class: 'panel_resize_side resize_top'}),
			Interface.createElement('div', {class: 'panel_resize_side resize_bottom'}),
			Interface.createElement('div', {class: 'panel_resize_side resize_left'}),
			Interface.createElement('div', {class: 'panel_resize_side resize_right'}),
		];
		let corners = [
			Interface.createElement('div', {class: 'panel_resize_corner resize_top_left'}),
			Interface.createElement('div', {class: 'panel_resize_corner resize_top_right'}),
			Interface.createElement('div', {class: 'panel_resize_corner resize_bottom_left'}),
			Interface.createElement('div', {class: 'panel_resize_corner resize_bottom_right'}),
		];
		let resize = (e1, direction_x, direction_y) => {
			let position_before = this.position_data.float_position.slice();
			let size_before = [this.width, this.height];
			let started = false;

			let drag = e2 => {
				convertTouchEvent(e2);
				if (!started && (Math.pow(e2.clientX - e1.clientX, 2) + Math.pow(e2.clientY - e1.clientY, 2)) > 12) {
					started = true;
				}
				if (!started) return;

				this.position_data.float_size[0] = size_before[0] + (e2.clientX - e1.clientX) * direction_x;
				this.position_data.float_size[1] = size_before[1] + (e2.clientY - e1.clientY) * direction_y;

				if (direction_x == -1) this.position_data.float_position[0] = position_before[0] - this.position_data.float_size[0] + size_before[0];
				if (direction_y == -1) this.position_data.float_position[1] = position_before[1] - this.position_data.float_size[1] + size_before[1];

				this.update();
			}
			let stop = e2 => {
				convertTouchEvent(e2);
				
				removeEventListeners(document, 'mousemove touchmove', drag);
				removeEventListeners(document, 'mouseup touchend', stop);
			}
			addEventListeners(document, 'mousemove touchmove', drag);
			addEventListeners(document, 'mouseup touchend', stop);
		}
		addEventListeners(sides[0], 'mousedown touchstart', (event) => resize(event, 0, -1));
		addEventListeners(sides[1], 'mousedown touchstart', (event) => resize(event, 0, 1));
		addEventListeners(sides[2], 'mousedown touchstart', (event) => resize(event, -1, 0));
		addEventListeners(sides[3], 'mousedown touchstart', (event) => resize(event, 1, 0));
		addEventListeners(corners[0], 'mousedown touchstart', (event) => resize(event, -1, -1));
		addEventListeners(corners[1], 'mousedown touchstart', (event) => resize(event, 1, -1));
		addEventListeners(corners[2], 'mousedown touchstart', (event) => resize(event, -1, 1));
		addEventListeners(corners[3], 'mousedown touchstart', (event) => resize(event, 1, 1));

		let handles = Interface.createElement('div', {class: 'panel_resize_handle_wrapper'}, [...sides, ...corners]);
		this.node.append(handles);
		this.resize_handles = handles;
		return this;
	}
	moveToFront() {
		if (this.slot == 'float' && Panel.floating_panel_z_order[0] !== this.id) {
			Panel.floating_panel_z_order.remove(this.id);
			Panel.floating_panel_z_order.splice(0, 0, this.id);
			let zindex = 18;
			Panel.floating_panel_z_order.forEach(id => {
				let panel = Panels[id];
				panel.node.style.zIndex = zindex;
				panel.dispatchEvent('change_zindex', {zindex});
				zindex = Math.clamp(zindex-1, 14, 19);
			})
		}
		return this;
	}
	moveTo(slot, ref_panel, before = false) {
		let position_data = this.position_data;
		if (slot == undefined) {
			slot = ref_panel.position_data.slot;
		}
		if (slot !== this.slot) {
			this.previous_slot = this.slot;
		}

		this.dispatchEvent('move_to', {slot, ref_panel, before, previous_slot: this.previous_slot});

		this.node.classList.remove('floating');

		if (slot == 'left_bar' || slot == 'right_bar') {
			let change_panel_order = !!ref_panel;
			if (!ref_panel && Interface.getModeData()[slot].includes(this.id)) {
				let panels = Interface.getModeData()[slot].filter(id => Panels[id] && Panels[id].slot == slot || id == this.id);
				let index = panels.indexOf(this.id);
				if (index == 0) {
					ref_panel = Panels[panels[1]];
					before = true;
				} else {
					ref_panel = Panels[panels[index-1]];
					before = false;
				}
			}

			if (ref_panel instanceof Panel && ref_panel.slot == slot) {
				if (before) {
					$(ref_panel.node).before(this.node);
				} else {
					$(ref_panel.node).after(this.node);
				}
				if (change_panel_order) {
					Interface.getModeData()[slot].remove(this.id);
					Interface.getModeData()[slot].splice(Interface.getModeData()[slot].indexOf(ref_panel.id) + (before ? 0 : 1), 0, this.id);
				}
			} else {
				document.getElementById(slot).append(this.node);
				Interface.getModeData()[slot].safePush(this.id);
			}

		} else if (slot == 'top') {
			let top_panel = Interface.getTopPanel();
			if (top_panel && top_panel !== this && !Condition.mutuallyExclusive(this.condition, top_panel.condition)) {
				top_panel.moveTo(top_panel.previous_slot);
			}
			document.getElementById('top_slot').append(this.node);

		} else if (slot == 'bottom') {
			let bottom_panel = Interface.getBottomPanel();
			if (bottom_panel && bottom_panel !== this && !Condition.mutuallyExclusive(this.condition, bottom_panel.condition)) {
				bottom_panel.moveTo(bottom_panel.previous_slot);
			}
			document.getElementById('bottom_slot').append(this.node);

		} else if (slot == 'float' && !Blockbench.isMobile) {
			Interface.work_screen.append(this.node);
			this.node.classList.add('floating');
			this.dispatchEvent('change_zindex', {zindex: 14});
			if (!this.resize_handles) {
				this.setupFloatHandles();
			}
		} else if (slot == 'hidden' && !Blockbench.isMobile) {
			this.node.remove();
		}
		if (slot !== 'float') {
			Panel.floating_panel_z_order.remove(this.id);
			this.node.style.zIndex = '';
			this.dispatchEvent('change_zindex', {zindex: null});
		}
		position_data.slot = slot;
		
		this.update();
		if (Panels[this.id]) {
			TickUpdates.interface = true;
			this.dispatchEvent('moved_to', {slot, ref_panel, before, previous_slot: this.previous_slot});
		}
		return this;
	}
	updateSlot() {
		let slot = this.slot;

		this.node.classList.remove('floating');

		if (slot == 'left_bar' || slot == 'right_bar') {

			document.getElementById(slot).append(this.node);
			Interface.getModeData()[slot].safePush(this.id);

		} else if (slot == 'top') {
			document.getElementById('top_slot').append(this.node);

		} else if (slot == 'bottom') {
			document.getElementById('bottom_slot').append(this.node);

		} else if (slot == 'float' && !Blockbench.isMobile) {
			Interface.work_screen.append(this.node);
			this.node.classList.add('floating');
			this.dispatchEvent('change_zindex', {zindex: 14});
			if (!this.resize_handles) {
				this.setupFloatHandles();
			}
		} else if (slot == 'hidden' && !Blockbench.isMobile) {
			this.node.remove();
		}
		if (slot !== 'float') {
			Panel.floating_panel_z_order.remove(this.id);
			this.node.style.zIndex = '';
			this.dispatchEvent('change_zindex', {zindex: null});
		}
		if (this.folded != this.node.classList.contains('folded')) {
			this.folded = !!this.folded;
			let new_icon = Blockbench.getIconNode(this.folded ? 'expand_less' : 'expand_more');
			$(this.handle).find('> .panel_folding_button > .icon').replaceWith(new_icon);
			this.node.classList.toggle('folded', this.folded);
			if (this.onFold) {
				this.onFold();
			}
		}
		
		this.update();

		if (Panels[this.id]) {
			TickUpdates.interface = true;
		}
		return this;
	}
	update(dragging) {
		let show = BARS.condition(this.condition);
		let work_screen = document.querySelector('div#work_screen');
		let center_screen = document.querySelector('div#center');
		let slot = this.slot;
		let is_sidebar = slot == 'left_bar' || slot == 'right_bar';
		if (show) {
			this.node.classList.remove('hidden');
			if (slot == 'float') {
				if (!dragging && work_screen.clientWidth) {
					this.position_data.float_position[0] = Math.clamp(this.position_data.float_position[0], 0, work_screen.clientWidth - this.width);
					this.position_data.float_position[1] = Math.clamp(this.position_data.float_position[1], 0, work_screen.clientHeight - this.height);
					this.position_data.float_size[0] = Math.clamp(this.position_data.float_size[0], 200, work_screen.clientWidth - this.position_data.float_position[0]);
					this.position_data.float_size[1] = Math.clamp(this.position_data.float_size[1], 86, work_screen.clientHeight - this.position_data.float_position[1]);
				}
				this.node.style.left = this.position_data.float_position[0] + 'px';
				this.node.style.top = this.position_data.float_position[1] + 'px';
				this.width  = this.position_data.float_size[0];
				this.height = this.position_data.float_size[1];
				if (this.folded) this.height = this.handle.clientHeight;
				this.node.style.width = this.width + 'px';
				this.node.style.height = this.height + 'px';
				this.node.classList.remove('bottommost_panel');
				this.node.classList.remove('topmost_panel');
			} else {
				this.node.style.width = this.node.style.left = this.node.style.top = null;
			}
			if (Blockbench.isMobile) {
				this.width = this.node.clientWidth;
			} else if (slot == 'left_bar') {
				this.width = Interface.left_bar_width;
			} else if (slot == 'right_bar') {
				this.width = Interface.right_bar_width;
			}
			if (slot == 'top' || slot == 'bottom') {

				if (Blockbench.isMobile && Blockbench.isLandscape) {
					this.height = center_screen.clientHeight;
					this.width = Math.clamp(this.position_data.height, 30, center_screen.clientWidth);
					if (this.folded) this.width = 72;
				} else {
					let opposite_panel = slot == 'top' ? Interface.getBottomPanel() : Interface.getTopPanel();
					this.height = Math.clamp(this.position_data.height, 30, center_screen.clientHeight - (opposite_panel ? opposite_panel.height : 0));
					if (this.folded) this.height = this.handle.clientHeight;
					this.width = Interface.work_screen.clientWidth - Interface.left_bar_width - Interface.right_bar_width;
				}
				this.node.style.width = this.width + 'px';
				this.node.style.height = this.height + 'px';
			} else if (is_sidebar) {
				if (this.fixed_height) {
					//let other_panels = slot == 'left_bar' ? Interface.getLeftPanels() : Interface.getRightPanels();
					//let available_height = (slot == 'left_bar' ? Interface.left_bar : Interface.right_bar).clientHeight;
					//let min_height = other_panels.reduce((sum, panel) => (panel == this ? sum : (sum - panel.node.clientHeight)), available_height);
					this.height = Math.clamp(this.position_data.height, 30, Interface.work_screen.clientHeight);
					this.node.style.height = this.height + 'px';
					this.node.classList.add('fixed_height');
				} else {
					this.node.style.height = null;
				}
			}
			if (!this.fixed_height) this.node.classList.remove('fixed_height');

			if (this.sidebar_resize_handle) {
				this.sidebar_resize_handle.style.display = (is_sidebar) ? 'block' : 'none';
			}
			if ((slot == 'right_bar' && Interface.getRightPanels().last() == this) || (slot == 'left_bar' && Interface.getLeftPanels().last() == this)) {
				this.node.parentElement?.childNodes.forEach(n => n.classList.remove('bottommost_panel'));
				this.node.classList.add('bottommost_panel');
			}
			if ((slot == 'right_bar' && Interface.getRightPanels()[0] == this) || (slot == 'left_bar' && Interface.getLeftPanels()[0] == this)) {
				this.node.parentElement?.childNodes.forEach(n => n.classList.remove('topmost_panel'));
				this.node.classList.add('topmost_panel');
			}

			if (Panels[this.id] && this.onResize) this.onResize()
		} else {
			this.node.classList.add('hidden');
		}
		this.dispatchEvent('update', {show});
		localStorage.setItem('interface_data', JSON.stringify(Interface.data))
		return this;
	}
	//Delete
	delete() {
		delete Panels[this.id];
		this.node.remove()
	}
}
Panel.floating_panel_z_order = [];
Panel.prototype.snap_menu = new Menu([
	{
		name: 'menu.panel.move_to.left_bar',
		icon: 'align_horizontal_left',
		marked: panel => panel.slot == 'left_bar',
		click: (panel) => {
			panel.fixed_height = false;
			panel.moveTo('left_bar');
		}
	},
	{
		name: 'menu.panel.move_to.right_bar',
		icon: 'align_horizontal_right',
		marked: panel => panel.slot == 'right_bar',
		click: (panel) => {
			panel.fixed_height = false;
			panel.moveTo('right_bar');
		}
	},
	{
		name: 'menu.panel.move_to.top',
		icon: 'align_vertical_top',
		marked: panel => panel.slot == 'top',
		click: (panel) => {
			panel.fixed_height = false;
			panel.moveTo('top');
		}
	},
	{
		name: 'menu.panel.move_to.bottom',
		icon: 'align_vertical_bottom',
		marked: panel => panel.slot == 'bottom',
		click: (panel) => {
			panel.fixed_height = false;
			panel.moveTo('bottom');
		}
	},
	{
		name: 'menu.panel.move_to.float',
		icon: 'web_asset',
		marked: panel => panel.slot == 'float',
		click: (panel) => {
			panel.fixed_height = false;
			panel.moveTo('float');
		}
	},
	'_',
	{
		name: 'menu.panel.move_to.hidden',
		icon: 'web_asset_off',
		marked: panel => panel.slot == 'hidden',
		condition: panel => (panel.optional && panel.slot != 'hidden'),
		click: (panel) => {
			panel.fixed_height = false;
			panel.moveTo('hidden');
		}
	}
])


function setupPanels() {
	Interface.panel_definers.forEach((definer) => {
		if (typeof definer === 'function') {
			definer()
		}
	})
	updateSidebarOrder();
}

function updateInterfacePanels() {

	if (!Blockbench.isMobile) {
		Interface.left_bar.style.display = Prop.show_left_bar ? 'flex' : 'none';
		Interface.right_bar.style.display = Prop.show_right_bar ? 'flex' : 'none';
	}

	Interface.work_screen.style.setProperty(
		'grid-template-columns',
		Interface.left_bar_width+'px auto '+ Interface.right_bar_width +'px'
	)
	for (var key in Interface.Panels) {
		var panel = Panels[key]
		panel.update()
	}
	var left_width = Interface.left_bar.querySelector('.panel:not(.hidden)') ? Interface.left_bar_width : 0;
	var right_width = Interface.right_bar.querySelector('.panel:not(.hidden)') ? Interface.right_bar_width : 0;

	if (!left_width || !right_width) {
		Interface.work_screen.style.setProperty(
			'grid-template-columns',
			left_width+'px auto '+ right_width +'px'
		)
	}

	Interface.preview.style.visibility = Interface.preview.clientHeight > 80 ? 'visible' : 'hidden';

	let height = document.getElementById('center').clientHeight;
	height -= Interface.getBottomPanel()?.height || 0;
	height -= Interface.getTopPanel()?.height || 0;
	Interface.preview.style.height = height > 0 ? (height + 'px') : '';

	if (Preview.split_screen.enabled) {
		Preview.split_screen.updateSize()
	}
	for (var key in Interface.Resizers) {
		var resizer = Interface.Resizers[key]
		resizer.update()
	}
}

function updateSidebarOrder() {
	['left_bar', 'right_bar'].forEach(bar => {
		let bar_node = document.querySelector(`.sidebar#${bar}`);

		bar_node.childNodes.forEach(panel_node => panel_node.remove());

		let last_panel;
		let panel_count = 0;
		Interface.getModeData()[bar].forEach(panel_id => {
			let panel = Panels[panel_id];
			if (panel && panel.slot == bar) {
				panel.node.classList.remove('bottommost_panel');
				panel.node.classList.remove('topmost_panel');
				bar_node.append(panel.node);
				if (Condition(panel.condition)) {
					if (panel_count == 0) {
						panel.node.classList.add('topmost_panel');
					}
					panel_count++;
					last_panel = panel;
				}
			}
		});
		if (last_panel && panel_count > 1) {
			last_panel.node.classList.add('bottommost_panel');
		}
	})
}
function updatePanelSelector() {
	if (!Blockbench.isMobile) return;

	Interface.PanelSelectorVue.$forceUpdate();
	let bottom_panel = Interface.getBottomPanel();
	if (bottom_panel && !Condition(bottom_panel.display_condition)) {
		Interface.PanelSelectorVue.select(null);
	}
}

function setActivePanel(panel) {
	Prop.active_panel = panel
}

function setupMobilePanelSelector() {
	Interface.PanelSelectorVue = new Vue({
		el: '#panel_selector_bar',
		data: {
			all_panels: Interface.Panels,
			selected: null,
			modifiers: Pressing.overrides
		},
		computed: {
		},
		methods: {
			panels() {
				let arr = [];
				for (var id in this.all_panels) {
					let panel = this.all_panels[id];
					if (Condition(panel.condition) && Condition(panel.display_condition)) {
						arr.push(panel);
					}
				}
				return arr;
			},
			select(panel) {
				this.selected = panel && panel.id;
				for (let key in Panels) {
					let panel_b = Panels[key];
					if (panel_b.slot == 'bottom') {
						$(panel_b.node).detach();
						panel_b.position_data.slot = 'left_bar';
					}
				}
				if (panel) {
					panel.moveTo('bottom');
					if (panel.folded) panel.fold();
				} else {
					resizeWindow();
				}
			},
			openKeyboardMenu() {
				openTouchKeyboardModifierMenu(this.$refs.mobile_keyboard_menu);
			},
			Condition,
			getIconNode: Blockbench.getIconNode
		},
		template: `
			<div id="panel_selector_bar">
				<div class="panel_selector" :class="{selected: selected == null}" @click="select(null)">
					<div class="icon_wrapper"><i class="material-icons icon">3d_rotation</i></div>
				</div>
				<div class="panel_selector" :class="{selected: selected == panel.id}" v-for="panel in panels()" v-if="Condition(panel.condition)" @click="select(panel)">
					<div class="icon_wrapper" v-html="getIconNode(panel.icon).outerHTML"></div>
				</div>
				<div id="mobile_keyboard_menu" @click="openKeyboardMenu()" ref="mobile_keyboard_menu" :class="{enabled: modifiers.ctrl || modifiers.shift || modifiers.alt}">
					<i class="material-icons">keyboard</i>
				</div>
			</div>`
	})
}
