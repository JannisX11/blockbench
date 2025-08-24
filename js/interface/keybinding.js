import { BARS } from './toolbars';


BARS.defineActions(() => {
	
	new Action('keybindings_window', {
		name: tl('dialog.settings.keybinds') + '...',
		icon: 'keyboard',
		category: 'blockbench',
		click: function () {
			Keybinds.dialog.show();
			document.querySelector('dialog#keybindings .search_bar > input').focus();
		}
	})
	new Action('load_keymap', {
		icon: 'format_list_bulleted',
		category: 'blockbench',
		work_in_dialog: true,
		click(e) {
			new Menu(this.children).open(e.target);
		},
		children: [
			'import_keymap',
			'_',
			{icon: 'keyboard', id: 'default', description: 'action.load_keymap.default.desc', name: 'action.load_keymap.default', click() {Keybinds.loadKeymap('default')}},
			{icon: 'keyboard', id: 'mouse', description: 'action.load_keymap.mouse.desc', name: 'action.load_keymap.mouse', click() {Keybinds.loadKeymap('mouse')}},
			{icon: 'keyboard', id: 'blender', description: 'action.load_keymap.blender.desc', name: 'Blender', click() {Keybinds.loadKeymap('blender')}},
			{icon: 'keyboard', id: 'cinema4d', description: 'action.load_keymap.cinema4d.desc', name: 'Cinema 4D', click() {Keybinds.loadKeymap('cinema4d')}},
			{icon: 'keyboard', id: 'maya', description: 'action.load_keymap.maya.desc', name: 'Maya', click() {Keybinds.loadKeymap('maya')}}
		]
	})
	new Action('import_keymap', {
		icon: 'folder',
		category: 'blockbench',
		work_in_dialog: true,
		click() {
			Blockbench.import({
				resource_id: 'config',
				extensions: ['bbkeymap'],
				type: 'Blockbench Keymap'
			}, function(files) {
				let {keys} = JSON.parse(files[0].content);

				Keybinds.actions.forEach(keybind_item => {
					if (keys[keybind_item.id] === null) {
						keybind_item.keybind.clear();
					} else {
						keybind_item.keybind.set(keys[keybind_item.id]).save(false);
					}
				})
				Keybinds.save();
				TickUpdates.keybind_conflicts = true;
			})
		}
	})
	new Action('export_keymap', {
		icon: 'keyboard_hide',
		category: 'blockbench',
		work_in_dialog: true,
		click() {
			var keys = {}

			Keybinds.actions.forEach(item => {
				if (!Keybinds.stored[item.id]) return
				if (Keybinds.stored[item.id].key == -1) {
					keys[item.id] = null;
				} else {
					keys[item.id] = new oneLiner(Keybinds.stored[item.id])
				}
			})
			Blockbench.export({
				resource_id: 'config',
				type: 'Blockbench Keymap',
				extensions: ['bbkeymap'],
				content: compileJSON({keys})
			})
		}
	})
	BarItems.load_keymap.toElement('#keybinds_title_bar')
	BarItems.export_keymap.toElement('#keybinds_title_bar')
})

onVueSetup(function() {

	let sidebar_pages = {};
	for (let key in Keybinds.structure) {
		sidebar_pages[key] = Keybinds.structure[key].name;
	}

	Keybinds.dialog = new Dialog({
		id: 'keybindings',
		title: 'dialog.settings.keybinds',
		singleButton: true,
		width: 800,
		title_menu: new Menu([
			'settings_window',
			'keybindings_window',
			'theme_window',
			'about_window',
		]),
		sidebar: {
			pages: sidebar_pages,
			page: 'navigate',
			actions: [
				'load_keymap',
				'export_keymap',
			],
			onPageSwitch(page) {
				Keybinds.dialog.content_vue.open_category = page;
				Keybinds.dialog.content_vue.search_term = '';
			}
		},
		component: {
			data() {
				return {
				structure: Keybinds.structure,
				open_category: 'navigate',
				search_term: '',
				modifier_options: {
					'': '-',
					always: tl('modifier_actions.always'),
					ctrl: tl(Blockbench.platform == 'darwin' ? 'keys.meta' : 'keys.ctrl'),
					shift: tl('keys.shift'),
					alt: tl('keys.alt'),
					unless_ctrl: tl('modifier_actions.unless', tl(Blockbench.platform == 'darwin' ? 'keys.meta' : 'keys.ctrl')),
					unless_shift: tl('modifier_actions.unless', tl('keys.shift')),
					unless_alt: tl('modifier_actions.unless', tl('keys.alt')),
				} 
			}},
			methods: {
				record(item, sub_id) {
					if (sub_id) {
						item.sub_keybinds[sub_id].keybind.record();

					} else {
						if (!item.keybind) item.keybind = new Keybind();
						item.keybind.record();
					}
				},
				reset(item, sub_id) {
					if (sub_id) {
						let sub_keybind = item.sub_keybinds[sub_id];
						if (sub_keybind.default_keybind) {
							sub_keybind.keybind.set(sub_keybind.default_keybind);
						} else {
							sub_keybind.keybind.clear();
						}
						sub_keybind.keybind.save(true);

					} else if (item.keybind) {
						if (item.default_keybind) {
							item.keybind.set(item.default_keybind);
						} else {
							item.keybind.clear();
						}
						item.keybind.save(true);
					}
				},
				clear(item, sub_id) {
					if (sub_id) {
						item.sub_keybinds[sub_id].keybind.clear().save(true);

					} else if (item.keybind) {
						item.keybind.clear().save(true)
					}
				},
				toggleCategory(category) {
					if (!category.open) {
						for (var ct in Keybinds.structure) {
							Keybinds.structure[ct].open = false
						}
						
					}
					category.open = !category.open
				},
				hasSubKeybinds(item) {
					return item.sub_keybinds && typeof item.sub_keybinds === 'object' && Object.keys(item.sub_keybinds).length > 0;
				},
				hasVariationConflict(keybind, variation_key) {
					return keybind[keybind.variations[variation_key]];
				},
				getVariationText(action, variation) {
					return tl(action.variations?.[variation]?.name, null, variation);
				},
				getVariationDescription(action, variation) {
					return action.variations?.[variation]?.description ? tl(action.variations[variation].description, null, '') : '';
				},
			},
			computed: {
				list() {
					if (this.search_term) {
						var keywords = this.search_term.toLowerCase().replace(/_/g, ' ').split(' ');
						var actions = [];

						for (var action of Keybinds.actions) {
			
							if (true) {;
								var missmatch = false;
								for (var word of keywords) {
									if (
										!missmatch &&
										!action.name.toLowerCase().includes(word) &&
										!action.id.toLowerCase().includes(word) &&
										!action.keybind.label.toLowerCase().includes(word) 
									) {
										missmatch = true;
									}
									if (missmatch && action.sub_keybinds) {
										for (let key in action.sub_keybinds) {
											if (action.sub_keybinds[key].name.toLowerCase().includes(word)) {
												missmatch = false;
											}
										}
									}
									if (missmatch) break;
								}
								if (!missmatch) {
									actions.push(action)
								}
							}
						}
						return actions;
					} else {
						return this.structure[this.open_category].actions;
					}
				},
				title() {
					if (this.search_term) {
						return tl('dialog.settings.search_results');
					} else {
						return this.structure[this.open_category].name;
					}
				}
			},
			template: `
				<div>
					<h2 class="i_b">{{ title }}</h2>

					<search-bar id="settings_search_bar" v-model="search_term"></search-bar>

					<ul id="keybindlist">
						<li v-for="action in list">
							<div class="keybind_line">
								<div :title="action.description"><span>{{action.name}}</span><span class="keybind_guide_line" /></div>
								<div class="keybindslot" :class="{conflict: action.keybind && action.keybind.conflict}" @click.stop="record(action)" v-html="action.keybind ? action.keybind.getText(true) : ''"></div>

								<div class="tool" v-on:click="reset(action)" title="${tl('keybindings.reset')}"><i class="material-icons">replay</i></div>
								<div class="tool" v-on:click="clear(action)" title="${tl('keybindings.clear')}"><i class="material-icons">clear</i></div>
							</div>

							<ul class="keybind_item_variations" v-if="action.keybind.variations">
								<li v-for="(value, option_key) in action.keybind.variations">
									<label :title="getVariationDescription(action, option_key)">{{ getVariationText(action, option_key) }}</label>
									<select-input v-model="action.keybind.variations[option_key]" @input="action.keybind.save(true)" :options="modifier_options" />
									<i v-if="hasVariationConflict(action.keybind, option_key)" class="material-icons icon keybind_variation_conflict" title="${tl('keybindings.variation_conflict')}">warning</i>
								</li>
							</ul>

							<ul class="keybind_item_sub_keybinds" v-if="hasSubKeybinds(action)">
								<li v-for="(sub_keybind, sub_id) in action.sub_keybinds" class="keybind_line keybind_line__sub" :key="sub_id">
									<div><span>{{ sub_keybind.name }}</span><span class="keybind_guide_line" /></div>
									<div class="keybindslot"
										:class="{conflict: sub_keybind.keybind && sub_keybind.keybind.conflict}"
										@click.stop="record(action, sub_id)"
										v-html="sub_keybind.keybind ? sub_keybind.keybind.getText(true) : ''"
									></div>
		
									<div class="tool" v-on:click="reset(action, sub_id)" title="${tl('keybindings.reset')}"><i class="material-icons">replay</i></div>
									<div class="tool" v-on:click="clear(action, sub_id)" title="${tl('keybindings.clear')}"><i class="material-icons">clear</i></div>
								</li>
							</ul>
						</li>
					</ul>
				</div>`
		},
		onButton() {
			Keybinds.save();
		},
		onOpen() {
			updateKeybindConflicts();
		}
	})
})
