class Panel {
	constructor(data) {
		let scope = this;
		this.type = 'panel';
		this.id = data.id || 'new_panel';
		this.icon = data.icon;
		this.menu = data.menu;
		this.name = tl(data.name ? data.name : `panel.${this.id}`);
		this.selection_only = data.selection_only == true;
		this.condition = data.condition;
		this.onResize = data.onResize;
		if (data.toolbars) {
			this.toolbars = data.toolbars;
        } else {
			this.toolbars = {};
		}
        // Vue
        if (data.component) {
            data.component.name = 'inside-vue'
            $(`.sidebar#${data.default_side||'left'}_bar`).append(`<div id="mount-panel-${this.id}"></div>`)

            this.vue = new Vue({
                components: {
                    'inside-vue': data.component
                },
				template: `<div class="panel ${this.selection_only ? 'selection_only' : ''} ${this.growable ? 'grow' : ''}" id="${this.id}">
					<h3 class="panel_handle">${this.name}</h3>
                    <inside-vue class="panel_inside" ref="inside"></inside-vue>
				</div>`,
				mounted() {
					Vue.nextTick(() => {
						updateInterfacePanels()
					})
				}
			}).$mount(`#mount-panel-${this.id}`)

			this.inside_vue = this.vue.$refs.inside;
			
			this.node = $('.panel#'+this.id).get(0)
			this.handle = $(this.node).find('h3.panel_handle').get(0)
			
        } else {
			this.node = $('.panel#'+this.id).get(0)
			this.handle = $('<h3 class="panel_handle">'+this.name+'</h3>').get(0)
			$(this.node).prepend(this.handle)
		}


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
					let target = Interface.panel
					if (typeof target === 'string') {
						scope.moveTo(target)
					} else if (target.type === 'panel') {
						let target_pos = $(target.node).offset().top
						let target_height = $(target.node).height()
						let before = ui.position.top < target_pos + target_height / 2
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
	delete() {
		delete Interface.Panels[this.id];
        $(this.node).detach()
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
	Interface.Panels.uv = new Panel({
		id: 'uv',
		icon: 'photo_size_select_large',
		condition: {modes: ['edit', 'paint']},
		toolbars: {
			bottom: Toolbars.main_uv
		},
		onResize: function() {
			let size = limitNumber($(this.node).width()-10, 64, 1200)
			size = Math.floor(size/16)*16
			main_uv.setSize(size)
		}
	})
	Interface.Panels.textures = new Panel({
		id: 'textures',
		icon: 'fas.fa-images',
		condition: {modes: ['edit', 'paint']},
		toolbars: {
			head: Toolbars.texturelist
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
		icon: 'fas.fa-cube',
		condition: {modes: ['edit']},
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
		condition: {modes: ['animate']},
		selection_only: true,
		toolbars: {
			//bone_ik: Toolbars.bone_ik,
		},
		component: {
			template: `
				<div>
					<p>${ tl('panel.element.origin') }</p>
					<div class="toolbar_wrapper bone_origin"></div>
					<!--p>${ tl('panel.bone.ik') }</p>
					<div class="toolbar_wrapper bone_ik"></div-->
				</div>
			`
		}
	})
	Interface.Panels.outliner = new Panel({
		id: 'outliner',
		icon: 'list_alt',
		condition: {modes: ['edit', 'paint', 'animate']},
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
		icon: 'chat',
		condition: {method() {return EditSession.active}},
		toolbars: {},
		onResize: t => {
		},
		menu: new Menu([
			'toggle_chat'
		]),
		component: {
			data() {return Chat},
			template: `
				<div>
					<div class="bar next_to_title" id="chat_title_bar"></div>
					<ul id="chat_history" v-if="expanded">
						<li v-for="msg in history">
							<b v-if="msg.showAuthor()" v-bind:class="{self: msg.self}">{{ msg.author }}:</b>
							<span class="text" v-bind:style="{color: msg.hex || 'inherit'}" v-html="msg.html"></span>
							<span class="timestamp">{{ msg.timestamp }}</span>
						</li>
					</ul>
					<div id="chat_bar">
						<input type="text" id="chat_input" class="dark_bordered f_left" maxlength="512">
						<i class="material-icons" onclick="Chat.send()">send</i>
					</div>
				</div>
			`
		}
	})
	BarItems.toggle_chat.toElement('#chat_title_bar')

	Interface.Panels.animations = new Panel({
		id: 'animations',
		icon: 'movie',
		condition: {modes: ['animate']},
		toolbars: {
			head: Toolbars.animations
		},
		component: {
			name: 'panel-animations',
			data() { return {
				animations: Animator.animations,
				files_folded: {}
			}},
			methods: {
				toggle(key) {
					this.files_folded[key] = !this.files_folded[key];
					this.$forceUpdate();
				}
			},
			computed: {
				files() {
					let files = {};
					this.animations.forEach(animation => {
						let key = animation.path || '';
						if (!files[key]) files[key] = {
							animations: [],
							name: animation.path ? pathToName(animation.path, true) : 'Unsaved'
						};
						files[key].animations.push(animation);
					})
					return files;
				}
			},
			template: `
				<div>
					<div class="toolbar_wrapper animations"></div>
					<ul id="animations_list" class="list">
						<li v-for="(file, key) in files" :key="key" class="animation_file">
							<div class="animation_file_head" v-on:dblclick.stop="toggle(key)">
								<i v-on:click.stop="toggle(key)" class="icon-open-state fa" :class=\'{"fa-angle-right": files_folded[key], "fa-angle-down": !files_folded[key]}\'></i>
								{{ file.name }}
							</div>
							<ul v-if="!files_folded[key]">	
								<li
									v-for="animation in file.animations"
									v-bind:class="{ selected: animation.selected }"
									v-bind:anim_id="animation.uuid"
									class="animation"
									v-on:click.stop="animation.select()"
									v-on:dblclick.stop="animation.rename()"
									:key="animation.uuid"
									@contextmenu.prevent.stop="animation.showContextMenu($event)"
								>
									<i class="material-icons">movie</i>
									<input class="animation_name" v-model="animation.name" disabled="true">
									<div class="animation_save_button" v-bind:class="{clickable: !animation.saved}" v-on:click.stop="animation.save()">
										<i v-if="animation.saved" class="material-icons">check_circle</i>
										<i v-else class="material-icons">save</i>
									</div>
									<div class="animation_play_toggle" v-on:click.stop="animation.togglePlayingState()">
										<i v-if="animation.playing" class="fa_big far fa-play-circle"></i>
										<i v-else class="fa_big far fa-circle"></i>
									</div>
								</li>
							</ul>
						</li>
					</ul>
				</div>
			`
		}
	})
	Interface.Panels.keyframe = new Panel({
		id: 'keyframe',
		icon: 'timeline',
		condition: {modes: ['animate']},
		toolbars: {
			head: Toolbars.keyframe
		}
	})
	Interface.Panels.variable_placeholders = new Panel({
		id: 'variable_placeholders',
		icon: 'fas.fa-stream',
		condition: {modes: ['animate']},
		toolbars: {
		}
	})
	Interface.Panels.display = new Panel({
		id: 'display',
		icon: 'tune',
		condition: {modes: ['display']},
		toolbars: {
			head: Toolbars.display
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
