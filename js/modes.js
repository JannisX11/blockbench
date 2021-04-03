class Mode extends KeybindItem {
	constructor(id, data) {
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		super(data)
		this.id = id;
		this.name = data.name || tl('mode.'+this.id);
		this.selected = false

		this.default_tool = data.default_tool;
		this.selectCubes = data.selectCubes !== false

		this.center_windows = data.center_windows||[];
		this.hide_toolbars = data.hide_toolbars
		this.hide_sidebars = data.hide_sidebars
		this.hide_status_bar = data.hide_status_bar

		this.condition = data.condition;
		this.onSelect = data.onSelect;
		this.onUnselect = data.onUnselect;

		Modes.options[this.id] = this;

		if (data.component) {
			let node = document.createElement('div');
			let mount = document.createElement('div');
			node.id = 'mode_screen_' + this.id;
			node.classList.add('center_window');
			node.appendChild(mount);
			document.getElementById('center').appendChild(node);

			this.vue = new Vue(data.component)
			this.vue.$mount(mount);

			this.center_windows.safePush(node.id);
		} else {
			this.center_windows.safePush('preview');
		}
	}
	select() {
		if (Modes.selected) {
			delete Modes[Modes.selected.id];
			Modes.previous_id = Modes.selected.id;
		}
		if (typeof Modes.selected.onUnselect === 'function') {
			Blockbench.dispatchEvent('unselect_mode', {mode: Modes.selected})
			Modes.selected.onUnselect()
		}
		if (Modes.selected.selected) {
			Modes.selected.selected = false
		}
		this.selected = true;
		Mode.selected = this;
		Modes.selected = this;
		Modes[Modes.selected.id] = true;

		document.body.setAttribute('mode', this.id);

		$('#center > .center_window').each((i, obj) => {
			$(obj).toggle(this.center_windows.includes(obj.id));
		})

		$('#main_toolbar .toolbar_wrapper').css('visibility', this.hide_toolbars ? 'hidden' : 'visible');
		$('#status_bar').css('display', this.hide_status_bar ? 'none' : 'flex');

		if (typeof this.onSelect === 'function') {
			this.onSelect()
		}
		if (Blockbench.isMobile) {
			Interface.PanelSelectorVue.$forceUpdate();
			Interface.PanelSelectorVue.select(null);
		}

		updateInterface()
		Canvas.updateRenderSides()
		if (BarItems[this.default_tool]) {
			BarItems[this.default_tool].select()
		} else {
			BarItems.move_tool.select()
		}
		TickUpdates.selection = true;
		Blockbench.dispatchEvent('select_mode', {mode: this})
	}
	trigger() {
		if (Condition(this.condition)) {
			this.select()
		}
	}
	delete() {
		if (Mode.selected == this) {
			Modes.options.start.select();
		}
		delete Modes.options[this.id];
	}
}
const Modes = {
	get id() {
		return Mode.selected ? Mode.selected.id : 'edit'
	},
	selected: false,
	options: {},
};
onVueSetup(function() {
	Modes.vue = new Vue({
		el: '#mode_selector',
		data: {
			options: Modes.options
		}
	})
});
BARS.defineActions(function() {
	
	StateMemory.init('start_screen_list_type', 'string')
	StartScreen = new Mode('start', {
		category: 'navigate',
		hide_toolbars: true,
		hide_sidebars: true,
		hide_status_bar: true,
		component: {
			data: {
				formats: Formats,
				recent: isApp ? recent_projects : [],
				list_type: StateMemory.start_screen_list_type || 'list',
				redact_names: settings.streamer_mode.value,
				isApp
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
				},
				getThumbnail(model_path) {
					let hash = model_path.hashCode().toString().replace(/^-/, '0');
					let path = PathModule.join(app.getPath('userData'), 'thumbnails', `${hash}.png`);
					if (!fs.existsSync(path)) return 'none'
					path = `url('${path.replace(/\\/g, '/')}?${Math.round(Math.random()*255)}')`;
					return path;
				},
				setListType(type) {
					this.list_type = type;
					StateMemory.start_screen_list_type = type;
					StateMemory.save('start_screen_list_type')
				}
			},
			template: `
				<div id="start_screen">
					<content>
						<section id="start-files">
							<left>
								<h2 class="tl">mode.start.new</h2>
								<div class="bar next_to_title" id="uv_title_bar">
									<div class="tool" onclick="Blockbench.openLink('https://blockbench.net/quickstart/')">
										<div class="tooltip tl">menu.help.quickstart</div>
										<i class="fas fa-question-circle"></i>
									</div>
								</div>
								<ul>
									<li v-for="format in formats" v-if="format.show_on_start_screen" v-on:click="format.new()">
										<span class="icon_wrapper f_left" v-html="Blockbench.getIconNode(format.icon).outerHTML"></span>
										<h3>{{ format.name }}</h3>
										<p>{{ format.description }}</p>
									</li>
								</ul>
							</left>
							<right>
								<h2 class="tl">mode.start.recent</h2>
								<div id="start_screen_list_type" v-if="isApp && !redact_names">
									<li class="tool" v-bind:class="{selected: list_type == 'list'}" v-on:click="setListType('list')">
										<i class="material-icons">list</i>
									</li>
									<li class="tool" v-bind:class="{selected: list_type == 'grid'}" v-on:click="setListType('grid')">
										<i class="material-icons">view_module</i>
									</li>
								</div>
								<div v-if="redact_names">{{ '['+tl('generic.redacted')+']' }}</div>
								<ul v-else-if="list_type == 'list'">
									<li v-on:click="openProject(project, $event)" v-for="project in recent" v-key="project.path" v-bind:title="redact_names ? '' : project.path" class="recent_project">
										<span class="icon_wrapper" v-html="Blockbench.getIconNode(project.icon).outerHTML"></span>
										<span class="recent_project_name">{{ redact_names ? '[${tl('generic.redacted')}]' : project.name }}</span>
										<span class="recent_project_date">{{ getDate(project) }}</span>
									</li>
									<div v-if="recent.length == 0">{{ tl('mode.start.no_recents') }}</div>
								</ul>
								<ul :class="{redact: redact_names}" v-else>
									<li v-on:click="openProject(project, $event)" v-for="project in recent" v-key="project.path" v-bind:title="redact_names ? '' : project.path" class="recent_project thumbnail">
										<div class="thumbnail_image" :style="{'background-image': getThumbnail(project.path)}"></div>
										<span class="recent_project_name">{{ redact_names ? '[${tl('generic.redacted')}]' : project.name }}</span>
										<span class="icon_wrapper" v-html="Blockbench.getIconNode(project.icon).outerHTML"></span>
									</li>
									<div v-if="recent.length == 0">{{ tl('mode.start.no_recents') }}</div>
								</ul>
								<button class="tl" style="margin-top: 20px;" onclick="BarItems.open_model.trigger()">action.open_model</button>
							</right>
						</section>
					</content>
				</div>
			`	
		},
		onSelect: function () {
			if (Format && isApp) updateRecentProjectThumbnail()
		},
		onUnselect: function () {
		}
	})
	new Mode('edit', {
		default_tool: 'move_tool',
		category: 'navigate',
		condition: () => Format,
	})
	new Mode('paint', {
		default_tool: 'brush_tool',
		category: 'navigate',
		condition: () => Format,
		onSelect: () => {
			if (Modes.previous_id == 'animate') {
				Animator.preview();
			}
			Cube.all.forEach(cube => {
				Canvas.buildGridBox(cube)
			})
			$('#main_colorpicker').spectrum('set', ColorPanel.vue._data.main_color);
			BarItems.slider_color_h.update();
			BarItems.slider_color_s.update();
			BarItems.slider_color_v.update();

			$('.UVEditor').find('#uv_size').hide();
			$('.bar.uv_editor_sliders').hide();
			three_grid.visible = false;
		},
		onUnselect: () => {
			Cube.all.forEach(cube => {
				Canvas.buildGridBox(cube)
			})
			$('.UVEditor').find('#uv_size').show();
			$('.bar.uv_editor_sliders').show();
			three_grid.visible = true;
		},
	})
	new Mode('display', {
		selectCubes: false,
		default_tool: 'move_tool',
		category: 'navigate',
		condition: () => Format.display_mode,
		onSelect: () => {
			enterDisplaySettings()
		},
		onUnselect: () => {
			exitDisplaySettings()
		},
	})
	new Mode('animate', {
		default_tool: 'move_tool',
		category: 'navigate',
		center_windows: ['preview', 'timeline'],
		condition: () => Format.animation_mode,
		onSelect: () => {
			Animator.join()
		},
		onUnselect: () => {
			Animator.leave()
		}
	})
	//Update to 3.2.0
	if (Modes.options.animate.keybind.key == 51) {
		Modes.options.animate.keybind.set({key: 52})
	}
})