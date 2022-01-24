class Panel {
	constructor(data) {
		let scope = this;
		this.type = 'panel';
		this.id = data.id || 'new_panel';
		this.icon = data.icon;
		this.menu = data.menu;
		this.growable = data.growable;
		this.name = tl(data.name ? data.name : `panel.${this.id}`);
		this.selection_only = data.selection_only == true;
		this.condition = data.condition;
		this.onResize = data.onResize;
		this.onFold = data.onFold;
		this.folded = false;
		if (data.toolbars) {
			this.toolbars = data.toolbars;
		} else {
			this.toolbars = {};
		}
		// Vue
		if (data.component) {
			data.component.name = 'inside-vue'
			let bar = $(`.sidebar#${data.default_side||'left'}_bar`);
			let node = $(`<div id="mount-panel-${this.id}"></div>`);

			if (data.insert_before && bar.find(`> .panel#${data.insert_before}`).length) {
				node.insertBefore(bar.find(`> .panel#${data.insert_before}`));
			} else if (data.insert_after && bar.find(`> .panel#${data.insert_after}`).length) {
				node.insertAfter(bar.find(`> .panel#${data.insert_after}`));
			} else {
				bar.append(node)
			}

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
			}).$mount(`#mount-panel-${this.id}`)

			this.inside_vue = this.vue.$refs.inside;
			
		}
		this.node = $('.panel#'+this.id).get(0)
		this.handle = $(`<h3 class="panel_handle">
			<label>${this.name}</label>
		</h3>`).get(0)

		$(this.node).prepend(this.handle)

		if (!Blockbench.isMobile) {
			let fold_button = $(`<div class="tool panel_folding_button"><i class="material-icons">expand_more</i></div>`)[0];
			this.handle.append(fold_button);
			fold_button.addEventListener('click', (e) => {
				this.fold();
			})

			$(this.handle).draggable({
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
		
		// Sort
		if (Blockbench.setup_successful) {
			if (Interface.data.right_bar.includes(this.id)) {
				let index = Interface.data.right_bar.indexOf(this.id);
				if (index == 0) {
					this.moveTo(Interface.Panels[Interface.data.right_bar[1]], true)
				} else {
					this.moveTo(Interface.Panels[Interface.data.right_bar[index-1]], false)
				}
			} else if (Interface.data.left_bar.includes(this.id)) {
				let index = Interface.data.left_bar.indexOf(this.id);
				if (index == 0) {
					this.moveTo(Interface.Panels[Interface.data.left_bar[1]], true)
				} else {
					this.moveTo(Interface.Panels[Interface.data.left_bar[index-1]], false)
				}
			}
		}
		
		// Toolbars
		for (let key in this.toolbars) {
			let toolbar = this.toolbars[key]
			if (toolbar instanceof Toolbar) {
				toolbar.toPlace(toolbar.id)
			}
		}

		Interface.Panels[this.id] = this;
	}
	isVisible() {
		return !this.folded && this.node.parentElement && this.node.parentElement.style.display !== 'none';
	}
	fold(state = !this.folded) {
		this.folded = !!state;
		$(this.handle).find('> .panel_folding_button > i').text(state ? 'expand_less' : 'expand_more');
		this.node.classList.toggle('folded', state);
		if (this.onFold) {
			this.onFold();
		}
	}
	moveTo(ref_panel, before) {
		let scope = this
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
		let show = BARS.condition(this.condition)
		if (show) {
			$(this.node).show()
			if (Blockbench.isMobile) {
				this.width = this.node.clientWidth;
			} else if (Interface.data.left_bar.includes(this.id)) {
				this.width = Interface.data.left_bar_width
			} else if (Interface.data.right_bar.includes(this.id)) {
				this.width = Interface.data.right_bar_width
			}
			if (this.onResize) this.onResize()
		} else {
			$(this.node).hide()
		}
	}
	delete() {
		delete Interface.Panels[this.id];
		this.node.remove()
	}
}


function setupPanels() {

	$('.sidebar').droppable({
		accept: 'h3',
		scope: 'panel',
		tolerance: 'pointer',
		drop: function(e, ui) {
			Interface.panel = $(this).attr('id');
		}
	})

	//Panels
	Interface.Panels.element = new Panel({
		id: 'element',
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
	Interface.Panels.bone = new Panel({
		id: 'bone',
		icon: 'fas.fa-bone',
		condition: !Blockbench.isMobile && {modes: ['animate']},
		selection_only: true,
		toolbars: {
			//inverse_kinematics: Toolbars.inverse_kinematics,
		},
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
}



function setActivePanel(panel) {
	Prop.active_panel = panel
}

function saveInterfaceRearrangement() {
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
