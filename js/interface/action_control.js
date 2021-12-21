const ActionControl = {
	get open() {return ActionControl.vue._data.open},
	set open(state) {ActionControl.vue._data.open = !!state},
	type: 'action_selector',
	max_length: 32,
	select(input) {
		ActionControl.open = true;
		open_interface = ActionControl;
		ActionControl.vue._data.index = 0;
		ActionControl.vue.updateSearch();
		if (input) {
			ActionControl.vue.search_input = input;
		}
		Vue.nextTick(_ => {
			let element = $('#action_selector > input');
			element.trigger('focus');
			if (!input)  element.trigger('select');
		})

		for (let key in settings) {
			let setting = settings[key];
			if (setting.type == 'toggle') {
				setting.icon = setting.value ? 'check_box' : 'check_box_outline_blank';
			}
		}
	},
	show(...args) {
		return this.select(...args);
	},
	hide() {
		if (open_interface == ActionControl) open_interface = false;
		ActionControl.recent_in_streamer_mode = false;
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
		if (action.type == 'recent_project') {
			Blockbench.read([action.description], {}, files => {
				loadModelFile(files[0]);
			})
		} else if (action.type == 'project_tab') {
			ModelProject.all.find(p => p.uuid == action.uuid).select();
		} else if (action.type == 'plugin') {
			let plugin = Plugins.all.find(plugin => plugin.id == action.id);
			if (plugin.installed) {
				plugin.uninstall();
			} else {
				plugin.download(true);
			}

		} else {
			action.trigger(e);
		}
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
		function updateScroll() {
			Vue.nextTick(() => {
				let list = document.querySelector('#action_selector_list ul');
				let node = list && list.children[data.index];
				if (!node) return;

				var list_pos = $(list).offset().top;
				var el_pos = $(node).offset().top;

				if (el_pos < list_pos) {
					list.scrollTop += el_pos - list_pos;
				} else if (el_pos > list.clientHeight + list_pos - 20) {
					list.scrollTop += el_pos - (list.clientHeight + list_pos) + 30;
				}
			})
		}

		if (e.which === 38) {
			data.index--;
			if (data.index < 0) {
				data.index = data.length-1;
			}
			updateScroll();
		} else if (e.which === 40) {
			data.index++;
			if (data.index >= data.length) {
				data.index = 0;
			}
			updateScroll();
		} else {
			return false;
		}
		return true;
	}
}



BARS.defineActions(function() {

	new Action('action_control', {
		icon: 'play_arrow',
		category: 'blockbench',
		keybind: new Keybind({key: 'f'}),
		click: function () {
			ActionControl.select()
		}
	})

	ActionControl.vue = new Vue({
		el: '#action_selector',
		data: {
			open: false,
			search_input: '',
			index: 0,
			length: 0,
			search_types: {
				'': 		{name: tl('action.action_control'), icon: 'play_arrow'},
				'setting': 	{name: tl('data.setting'), icon: 'settings'},
				'settings': {name: tl('data.setting'), icon: 'settings'},
				'+plugin': 	{name: tl('action.add_plugin'), icon: 'extension'},
				'-plugin': 	{name: tl('action.remove_plugin'), icon: 'extension_off'},
				'recent': 	{name: tl('menu.file.recent'), icon: 'history'},
				'tab': 		{name: tl('menu.action_control.type.tab'), icon: 'view_stream'},
				'angle': 	{name: tl('menu.action_control.type.angle'), icon: 'videocam'},
			},
			list: []
		},
		computed: {
			search_type() {
				if (this.search_input.search(/:/) > 0) {
					let [type] = this.search_input.split(/:\s*(.*)/);
					type = type.toLowerCase();
					if (this.search_types[type]) {
						return type;
					}
				}
				return '';
			}
		},
		methods: {
			updateSearch() {
				var list = this._data.list.empty();
				var type = this.search_type.toLowerCase();
				var search_input = this._data.search_input.toLowerCase()
				search_input = search_input.replace(type+':', '').trim();

				if (!type && search_input) {
					for (let key in this.search_types) {
						if (key == 'setting') continue;
						if (key.includes(search_input)) {
							list.push({
								name: this.search_types[key].name,
								icon: this.search_types[key].icon,
								keybind_label: `${key}:`,
								trigger: () => {
									ActionControl.select(key && (key + ': '));
								}
							})
						}
					}
				}
				if (!type) {
					for (var i = 0; i < Keybinds.actions.length; i++) {
						var item = Keybinds.actions[i];
						if (
							search_input.length == 0 ||
							item.name.toLowerCase().includes(search_input) ||
							item.id.toLowerCase().includes(search_input)
						) {
							if (item instanceof Action && Condition(item.condition) && !item.linked_setting) {
								list.safePush(item)
								if (list.length > ActionControl.max_length) break;
							}
						}
					}
				}
				if (!type || type == 'settings' || type == 'setting') {
					if (list.length <= ActionControl.max_length) {
						for (let key in settings) {
							let setting = settings[key];
							if (
								search_input.length == 0 ||
								setting.name.toLowerCase().includes(search_input) ||
								key.toLowerCase().includes(search_input)
							) {
								if (Condition(setting.condition)) {
									list.push(setting)
									if (list.length > ActionControl.max_length) break;
								}
							}
						}
					}
				}
				if (isApp && type == 'recent') {
					if (settings.streamer_mode.value && !ActionControl.recent_in_streamer_mode) {
						list.push({
							name: tl('menu.action_control.recent_in_streamer_mode'),
							description: tl('menu.action_control.recent_in_streamer_mode.desc'),
							icon: 'live_tv',
							trigger() {
								setTimeout(_ => {
									ActionControl.select('recent: ');
									ActionControl.recent_in_streamer_mode = true;
									ActionControl.vue.updateSearch();
								}, 1);
							}
						})
					} else {
						for (let project of recent_projects) {
							if (
								search_input.length == 0 ||
								project.path.toLowerCase().includes(search_input)
							) {
								list.push({
									name: project.name,
									icon: project.icon,
									description: settings.streamer_mode.value ? '' : project.path,
									keybind_label: StartScreen.vue.getDate(project),
									type: 'recent_project'
								})
								if (list.length > ActionControl.max_length) break;
							}
						}
					}
				}
				if (type == 'tab') {
					for (let project of ModelProject.all) {
						if (
							search_input.length == 0 ||
							project.name.toLowerCase().includes(search_input) ||
							project.geometry_name.toLowerCase().includes(search_input)
						) {
							list.push({
								name: project.getDisplayName(),
								icon: project.format.icon,
								description: project.path,
								keybind_label: Modes.options[project.mode].name,
								uuid: project.uuid,
								type: 'project_tab'
							})
							if (list.length > ActionControl.max_length) break;
						}
					}
				}
				if (type.substr(1) == 'plugin') {
					for (let plugin of Plugins.all) {
						if (
							plugin.installed == (type[0] == '-') &&
							(search_input.length == 0 ||
							plugin.name.toLowerCase().includes(search_input) ||
							plugin.description.toLowerCase().includes(search_input))
						) {
							list.push({
								name: plugin.name,
								icon: plugin.icon,
								description: plugin.description,
								keybind_label: plugin.author,
								id: plugin.id,
								type: 'plugin'
							})
							if (list.length > ActionControl.max_length) break;
						}
					}
				}
				if (type == 'angle') {
					let angles = Preview.prototype.menu.structure.find(m => m.id == 'angle').children(Preview.selected);
					for (let angle of angles) {
						if (typeof angle != 'object') continue;
						let name = tl(angle.name);
						if (
							search_input.length == 0 ||
							name.toLowerCase().includes(search_input) ||
							(angle.id && angle.id.toLowerCase().includes(search_input))
						) {
							list.push({
								name,
								icon: angle.icon,
								color: angle.color,
								type: 'angle',
								trigger() {
									Preview.selected.loadAnglePreset(angle.preset);
								}
							})
							if (list.length > ActionControl.max_length) break;
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
			},
			subtext() {
				let action = this.list[this.index];
				if (Pressing.alt) {
					if (action instanceof Setting) {
						if (action.type == 'select') {
							return action.options[action.value];
						} else {
							return action.value;
						}
					} else {
						action.keybind.label;
					}
				} else {
					return action.description;
				}
			},
			openTypeMenu() {
				let items = [];
				for (let key in this.search_types) {
					if (key == 'setting') continue;
					items.push({
						name: this.search_types[key].name,
						icon: this.search_types[key].icon,
						click: () => {
							this.search_input = key && (key + ': ');
							Vue.nextTick(_ => {
								let element = $('#action_selector > input');
								element.trigger('focus');
							})
						}
					});
				}
				new Menu(items).show(this.$refs.search_type_menu);
			},
			click: ActionControl.click,
			getIconNode: Blockbench.getIconNode
		},
		watch: {
			search_input() {
				this.updateSearch();
			}
		},
		template: `
			<dialog id="action_selector" v-if="open">
				<div class="tool" ref="search_type_menu" @click="openTypeMenu($event)">
					<div class="icon_wrapper normal" v-html="getIconNode(search_types[search_type] ? search_types[search_type].icon : 'fullscreen').outerHTML"></div>	
				</div>
				<input type="text" v-model="search_input" @input="e => search_input = e.target.value" autocomplete="off" autosave="off" autocorrect="off" spellcheck="false" autocapitalize="off">
				<i class="material-icons" id="action_search_bar_icon" @click="search_input = ''">{{ search_input ? 'clear' : 'search' }}</i>
				<div v-if="search_type" class="action_selector_type_overlay">{{ search_type }}:</div>
				<div id="action_selector_list">
					<ul>
						<li v-for="(item, i) in list"
							:class="{selected: i === index}"
							:title="item.description"
							@click="click(item, $event)"
							@mouseenter="index = i"
						>
							<div class="icon_wrapper normal" v-html="getIconNode(item.icon, item.color).outerHTML"></div>
							<span>{{ item.name }}</span>
							<label class="keybinding_label">{{ item.keybind_label || (item.keybind ? item.keybind.label : '') }}</label>
						</li>
					</ul>
					<div class="small_text" v-if="list[index]">{{ subtext() }}</div>
				</div>
			</dialog>
		`
	})
})