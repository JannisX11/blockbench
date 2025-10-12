import { Blockbench } from "../api";
import { ipcRenderer } from "../native_apis";
import { Plugins } from "../plugin_loader";
import { compileJSON } from "../util/json";
import { Dialog } from "./dialog";
import { Setting, SettingsProfile } from "./settings";

BARS.defineActions(() => {
	new Action('settings_window', {
		icon: 'settings',
		category: 'blockbench',
		click: function () {
			for (var sett in settings) {
				if (settings.hasOwnProperty(sett)) {
					Settings.old[sett] = settings[sett].value
				}
			}
			Settings.dialog.show();
			(document.querySelector('dialog#settings .search_bar > input') as HTMLElement).focus();
		}
	})
	
	new Action('import_settings', {
		icon: 'folder',
		category: 'blockbench',
		click: function () {
			// @ts-ignore for now
			Blockbench.import({
				resource_id: 'config',
				extensions: ['bbsettings'],
				type: 'Blockbench Settings'
			}, function(files) {
				Settings.import(files[0]);
			})
		}
	})
	new Action('export_settings', {
		icon: 'fas.fa-user-cog',
		category: 'blockbench',
		click: async function () {
			let private_data = [];
			var settings_copy = {}
			for (var key in settings) {
				settings_copy[key] = settings[key].value;
				if (settings[key].value && settings[key].type == 'password') {
					private_data.push(key);
				}
			}
			if (private_data.length) {
				let go_on = await new Promise((resolve, reject) => {
					Blockbench.showMessageBox({
						title: 'dialog.export_private_settings.title',
						message: tl('dialog.export_private_settings.message', [private_data.map(key => settings[key].name).join(', ')]),
						buttons: ['dialog.export_private_settings.keep', 'dialog.export_private_settings.omit', 'dialog.cancel']
					}, result => {
						if (result == 1) {
							private_data.forEach(key => {
								delete settings_copy[key];
							})
						}
						resolve(result !== 2);
					})
				});
				if (!go_on) return;
			}
			// @ts-ignore for now
			Blockbench.export({
				resource_id: 'config',
				type: 'Blockbench Settings',
				extensions: ['bbsettings'],
				content: compileJSON({settings: settings_copy})
			})
		}
	})
	let title_bar = document.getElementById('settings_title_bar');
	BarItems.import_settings.toElement(title_bar);
	BarItems.export_settings.toElement(title_bar);
})

onVueSetup(function() {
	for (var key in settings) {
		if (settings[key].condition == false) continue;
		var category = settings[key].category
		if (!category) category = 'general'

		if (!Settings.structure[category]) {
			Settings.structure[category] = {
				name: tl('settings.category.'+category),
				open: category === 'general',
				items: {}
			}
		}
		Settings.structure[category].items[key] = settings[key]
	}

	let sidebar_pages = {};
	for (let key in Settings.structure) {
		sidebar_pages[key] = Settings.structure[key].name;
	}

	interface SettingsDialogVueData {
		structure: any,
		profile: null | SettingsProfile,
		all_profiles: SettingsProfile[],
		open_category: string,
		search_term: string
	}
	Settings.dialog = new Dialog({
		id: 'settings',
		title: 'dialog.settings.settings',
		width: 920,
		singleButton: true,
		title_menu: new Menu([
			'settings_window',
			'keybindings_window',
			'theme_window',
			'about_window',
		]),
		sidebar: {
			pages: sidebar_pages,
			page: 'general',
			actions: [
				'import_settings',
				'export_settings',
			],
			onPageSwitch(page) {
				Settings.dialog.content_vue.open_category = page;
				Settings.dialog.content_vue.search_term = '';
			}
		},
		component: {
			data() {return {
				structure: Settings.structure,
				profile: null,
				all_profiles: SettingsProfile.all,
				open_category: 'general',
				search_term: ''
			} as SettingsDialogVueData},
			methods: {
				saveSettings(this: SettingsDialogVueData) {
					Settings.saveLocalStorages();
				},
				settingContextMenu(setting: Setting, event: MouseEvent) {
					new Menu([
						{
							name: 'dialog.settings.reset_to_default',
							icon: 'replay',
							click: () => {
								setting.ui_value = setting.default_value;
								this.saveSettings();
							}
						}
					]).open(event);
				},
				showProfileMenu(this: SettingsDialogVueData) {
					let items: MenuItem[] = [
						{
							name: 'generic.none',
							icon: 'remove',
							color: '',
							click: () => {
								this.profile = null;
							}
						}
					];
					SettingsProfile.all.forEach(profile => {
						items.push({
							name: profile.name,
							icon: 'manage_accounts',
							color: markerColors[profile.color % markerColors.length].standard,
							click: () => {
								this.profile = profile;
								if (profile.condition.type == 'selectable') {
									profile.select();
								} else {
									SettingsProfile.unselect();
								}
							}
						})
					})

					items.push(
						'_',
						{name: 'dialog.settings.create_profile', icon: 'add', click: () => {
							this.profile = new SettingsProfile({});
							this.profile.openDialog();
						}}
					)
					// @ts-ignore
					new Menu('settings_profiles', items).open(this.$refs.profile_menu)
				},
				profileButtonPress(this: SettingsDialogVueData) {
					if (!this.profile) {
						this.profile = new SettingsProfile({});
					}
					this.profile.openDialog();
				},
				getProfileValuesForSetting(this: SettingsDialogVueData, key) {
					return this.all_profiles.filter(profile => {
						return profile.settings[key] !== undefined;
					});
				},
				getProfileColor(profile?: SettingsProfile): string {
					if (profile && markerColors[profile.color % markerColors.length]) {
						return markerColors[profile.color % markerColors.length].standard
					}
					return '';
				},
				isFullWidth(setting: Setting): boolean {
					return ['text', 'password', 'select'].includes(setting.type);
				},
				getPluginName(plugin_id: string): string {
					let plugin = Plugins.all.find(p => p.id == plugin_id);
					return plugin?.title ?? plugin_id;
				},
				revealPlugin(plugin_id: string) {
					let plugin = Plugins.all.find(p => p.id == plugin_id);
					if (!plugin) return;
					
					Plugins.dialog.show();
					Plugins.dialog.content_vue.selectPlugin!(plugin);
				},
				getIconNode: Blockbench.getIconNode,
				tl,
				Condition
			},
			computed: {
				list() {
					if (this.search_term) {
						var keywords = this.search_term.toLowerCase().replace(/_/g, ' ').split(' ');
						var items = {};
						for (var key in settings) {
							var setting = settings[key];
							if (Condition(setting.condition)) {
								var name = setting.name.toLowerCase();
								var desc = setting.description.toLowerCase();
								var missmatch = false;
								for (var word of keywords) {
									if (
										!key.includes(word) &&
										!name.includes(word) &&
										!desc.includes(word)
									) {
										missmatch = true;
									}
								}
								if (!missmatch) {
									items[key] = setting;
								}
							}
						}
						return items;
					} else {
						return this.structure[this.open_category].items;
					}
				},
				title() {
					if (this.search_term) {
						return tl('dialog.settings.search_results');
					} else {
						return this.structure[this.open_category].name;
					}
				},
				profile_name() {
					return this.profile ? this.profile.name : tl('generic.none');
				}
			},
			template: `
				<div :style="{'--color-profile': getProfileColor(profile)}">
					<div id="settings_profile_wrapper">
						Profile:
						<div class="bb-select" ref="profile_menu" id="settings_profile_select" @click="showProfileMenu($event)" :class="{profile_is_selected: !!profile}">{{ profile_name }}</div>
						<div class="tool" @click="profileButtonPress()"><i class="material-icons">{{ profile ? 'build' : 'add' }}</i></div>
					</div>

					<h2 class="i_b">{{ title }}</h2>

					<search-bar id="settings_search_bar" v-model="search_term"></search-bar>

					<ul class="settings_list" id="settingslist">

						<li v-for="(setting, key) in list" v-if="Condition(setting.condition)"
							v-on="setting.click ? {click: setting.click} : {}"
							:class="{has_profile_override: profile && profile.settings[key] !== undefined, full_width_input: isFullWidth(setting)}"
							@contextmenu="settingContextMenu(setting, $event)"
						>
							<div class="tool setting_profile_clear_button" v-if="profile && profile.settings[key] !== undefined" @click.stop="profile.clear(key)" title="${tl('dialog.settings.clear_profile_value')}">
								<i class="material-icons">clear</i>
							</div>

							<template v-if="setting.type === 'number'">
								<div class="setting_element"><numeric-input v-model.number="setting.ui_value" :min="setting.min" :max="setting.max" :step="setting.step" v-on:input="saveSettings()" /></div>
							</template>
							<template v-else-if="setting.type === 'click'">
								<div class="setting_element setting_icon" v-html="getIconNode(setting.icon).outerHTML"></div>
							</template>
							<template v-else-if="setting.type == 'toggle'"><!--TOGGLE-->
								<div class="setting_element"><input type="checkbox" class="toggle_switch" v-model="setting.ui_value" v-bind:id="'setting_'+key" :key="key" v-on:click="saveSettings()"></div>
							</template>

							<div class="setting_label">
								<label class="setting_name" v-bind:for="'setting_'+key">
									{{ setting.name }}
								 </label>
								<div class="setting_plugin_label" v-if="setting.plugin" @click="revealPlugin(setting.plugin)">
									<span>${tl('data.plugin')}:</span> {{ getPluginName(setting.plugin) }}
								</div>
								<div class="setting_profile_value_indicator"
									v-for="profile_here in getProfileValuesForSetting(key)"
									:style="{'--color-profile': getProfileColor(profile_here)}"
									:class="{active: profile_here.isActive()}"
									:title="tl('Has override in profile ' + profile_here.name)"
									@click.stop="profile = (profile == profile_here) ? null : profile_here"
								/>
								<div class="setting_description">{{ setting.description }}</div>
							</div>

							<template v-if="setting.type === 'text'">
								<input type="text" class="dark_bordered" style="width: 96%" v-model="setting.ui_value" v-on:input="saveSettings()">
							</template>

							<template v-if="setting.type === 'password'">
								<input :type="setting.hidden ? 'password' : 'text'" class="dark_bordered" style="width: calc(96% - 28px);" v-model="setting.ui_value" v-on:input="saveSettings()">
								<div class="password_toggle" @click="setting.hidden = !setting.hidden;">
									<i class="fas fa-eye-slash" v-if="setting.hidden"></i>
									<i class="fas fa-eye" v-else></i>
								</div>
							</template>

							<template v-else-if="setting.type === 'select'">
								<div class="bar_select">
									<select-input v-model="setting.ui_value" :options="setting.options" />
								</div>
							</template>
						</li>
					</ul>
				</div>`
		},
		onButton() {
			Settings.save();
			function hasSettingChanged(id) {
				return (Settings.old && settings[id].value !== Settings.old[id])
			}
			let changed_settings = [];
			for (let id in settings) {
				let setting = settings[id];
				if (!Condition(setting.condition)) continue;
				let has_changed = hasSettingChanged(id);
				if (has_changed) {
					changed_settings.push(setting);
					if (setting.onChange) {
						setting.onChange(setting.value);
					}
					if (isApp && setting.launch_setting) {
						ipcRenderer.send('edit-launch-setting', {key: id, value: setting.value})
					}
				}
			}
			let restart_settings = changed_settings.filter(setting => setting.requires_restart);
			if (restart_settings.length) {
				Settings.showRestartMessage(restart_settings);
			}
		}
	})
})