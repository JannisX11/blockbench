import { Vue } from "../../lib/libs";
import { Blockbench } from "../api";
import { Dialog } from "./dialog";

export const settings: Record<string, Setting> = {};

type SettingsValue = string | number | boolean;
interface SettingOptions {
	name?: string
	type?: 'number' | 'text' | 'toggle' | 'password' | 'select' | 'click'
	value?: boolean | number | string
	condition?: ConditionResolvable
	category?: string
	description?: string
	requires_restart?: boolean
	launch_setting?: boolean
	//launch_setting?: boolean
	min?: number
	max?: number
	step?: number
	icon?: string
	plugin?: string
	click?(): void
	options?: {
		[id: string]: string
	}
	onChange?(value: any): void
}

export class Setting {
	id: string
	type: string
	default_value: SettingsValue
	master_value: SettingsValue
	condition: ConditionResolvable
	category: string
	name: string
	description: string
	requires_restart: boolean
	launch_setting: boolean
	plugin?: string
	min?: number
	max?: number
	step?: number
	icon: string
	click: (event: MouseEvent | KeyboardEvent) => void
	options: Record<string, string>
	hidden: boolean
	onChange: (value: SettingsValue) => void
	keybind_label: string

	constructor(id: string, data: SettingOptions) {
		this.id = id;
		settings[id] = this;
		this.type = 'toggle';
		if (data.type) this.type = data.type;
		if (data.value != undefined) {
			this.default_value = data.value;
		} else {
			switch (this.type) {
				case 'toggle': this.default_value = true; break;
				case 'number': this.default_value = 0; break;
				case 'text': this.default_value = ''; break;
				case 'password': this.default_value = ''; break;
				case 'select': this.default_value; break;
				case 'click': this.default_value = false; break;
			}
		}
		if (typeof Settings.stored[id] === 'object') {
			// @ts-ignore
			this.master_value = Settings.stored[id].value;

		} else if (data.value != undefined) {
			this.master_value = data.value

		} else {
			this.master_value = this.default_value;
		}
		this.condition = data.condition;
		this.category = data.category || 'general';
		this.name = data.name || tl(`settings.${id}`);
		this.description = data.description || tl(`settings.${id}.desc`);
		this.requires_restart = data.requires_restart == true;
		this.launch_setting = data.launch_setting || false;
		this.plugin = data.plugin || (typeof Plugins != 'undefined' ? Plugins.currently_loading : '');

		if (this.type == 'number') {
			this.min = data.min;
			this.max = data.max;
			this.step = data.step;
		}
		if (this.type == 'click') {
			this.icon = data.icon;
			this.click = data.click;
		}
		if (this.type == 'select') {
			this.options = data.options;
		}
		if (this.type == 'password') {
			this.hidden = true;
		}
		if (typeof data.onChange == 'function') {
			this.onChange = data.onChange
		}

		//add to structure
		var category = Settings.structure[this.category];
		if (category) {
			category.items[id] = this;
			let before = category.open;
			category.open = false;
			Vue.nextTick(() => {
				category.open = before;
			})
		}

		if (!this.icon) {
			if (this.type == 'toggle') this.icon = this.value ? 'check_box' : 'check_box_outline_blank';
			if (this.type == 'number') this.icon = 'tag';
			if (this.type == 'password') this.icon = 'password';
			if (this.type == 'text') this.icon = 'format_color_text';
			if (this.type == 'select') this.icon = 'list';
			if (!this.icon) this.icon = 'settings';
		}
		this.keybind_label = tl('data.setting');

		if (Blockbench.setup_successful) {
			Settings.saveLocalStorages();
		}
	}
	get value() {
		let profile = SettingsProfile.all.find(profile => profile.isActive() && profile.settings[this.id] !== undefined);
		if (profile) {
			return profile.settings[this.id] ?? this.master_value;
		} else {
			return this.master_value;
		}
	}
	set value(value) {
		this.master_value = value;
	}
	get ui_value() {
		let profile = Settings.dialog.content_vue?.$data.profile;
		if (profile) {
			return profile.settings[this.id] ?? this.master_value;
		} else {
			return this.master_value;
		}
	}
	set ui_value(value) {
		let profile = Settings.dialog.content_vue?.$data.profile;
		if (this.type == 'number') value = Math.clamp(value, this.min, this.max)
		if (profile) {
			Vue.set(profile.settings, this.id, value);
		} else {
			this.master_value = value;
		}
	}
	delete() {
		if (settings[this.id]) {
			delete settings[this.id];
		}
		if (Settings.structure[this.category] && Settings.structure[this.category].items[this.id]) {
			delete Settings.structure[this.category].items[this.id];
		}
	}
	set(value: SettingsValue) {
		if (value === undefined || value === null) return;
		let old_value = this.value;

		if (this.type == 'number' && typeof value == 'number') {
			if (this.step) {
				value = Math.round(value / this.step) * this.step;
			}
			this.value = Math.clamp(value, this.min, this.max)
		} else if (this.type == 'toggle') {
			this.value = !!value;
		} else if (this.type == 'click') {
			this.value = value;
		} else if (typeof value == 'string') {
			this.value = value;
		}
		if (typeof this.onChange == 'function' && this.value !== old_value) {
			this.onChange(this.value);
		}
		Settings.saveLocalStorages();
	}
	trigger(e: KeyboardEvent | MouseEvent) {
		let {type} = this;
		let setting = this;
		if (type == 'toggle') {
			this.set(!this.value);
			Settings.save();
			if (setting.requires_restart) {
				Settings.showRestartMessage();
			}

		} else if (type == 'click') {
			this.click(e)

		} else if (type == 'select') {
			let list = [];
			for (let key in this.options) {
				list.push({
					id: key,
					name: this.options[key],
					icon: this.value == key
						? 'far.fa-dot-circle'
						: 'far.fa-circle',
					click: () => {
						this.set(key);
						Settings.save();
						if (setting.requires_restart) {
							Settings.showRestartMessage();
						}
					}
				})
			}
			new Menu(list).open(e.target as HTMLElement);

		} else {
			let dialog = new Dialog({
				id: 'setting_' + this.id,
				title: tl('data.setting'),
				form: {
					input: {
						value: this.value,
						label: this.name,
						description: this.description,
						type: this.type
					},
					description: this.description ? {
						type: 'info',
						text: this.description
					} : undefined,
					reset: {
						type: 'buttons',
						buttons: ['dialog.settings.reset_to_default'],
						click() {
							dialog.setFormValues({input: setting.default_value});
						}
					}
				},
				onConfirm({input}) {
					setting.set(input);
					Settings.save();
					this.hide().delete();
					if (setting.requires_restart) {
						Settings.showRestartMessage();
					}
				},
				onCancel() {
					this.hide().delete();
				}
			}).show();

		}
	}
}

enum SettingsProfileConditionType {
	selectable = 'selectable',
	format = 'format',
	file_path = 'file_path',
}
interface SettingsProfileData {
	name?: string
	color?: number
}
export class SettingsProfile {
	uuid: string
	name: string
	color: number
	condition: {
		type: SettingsProfileConditionType,
		value: string
	}
	settings: Record<string, SettingsValue>
	selected: boolean

	constructor(data: SettingsProfileData = {}) {
		this.uuid = guid();
		this.name = data.name || 'New Profile';
		this.color = data.color == undefined ? Math.randomInteger(0, markerColors.length-1) : data.color;
		this.condition = {
			type: SettingsProfileConditionType.selectable,
			value: ''
		};
		this.settings = {};
		this.extend(data);
		this.selected = false;
		SettingsProfile.all.push(this);
	}
	select(update = true) {
		if (this.condition.type !== SettingsProfileConditionType.selectable) return;

		SettingsProfile.all.forEach(p => p.selected = false);
		this.selected = true;
		SettingsProfile.selected = this;
		
		if (update) {
			Settings.updateSettingsInProfiles();
			Settings.saveLocalStorages();
			Settings.updateProfileButton();
		}
	}
	extend(data) {
		Merge.string(this, data, 'name');
		if (data.condition) {
			this.condition.type = data.condition.type;
			this.condition.value = data.condition.value;
		}
		if (data.settings) {
			for (let key in data.settings) {
				let value = data.settings[key];
				if (value === undefined || value === null) continue;
				Vue.set(this.settings, key, value);
			}
		}
	}
	isActive() {
		switch (this.condition.type) {
			case SettingsProfileConditionType.selectable:
				return SettingsProfile.selected == this;
			case SettingsProfileConditionType.format:
				if (Format && Format.id == this.condition.value) return true;
				break;
			case SettingsProfileConditionType.file_path:
				let regex = new RegExp(this.condition.value, 'i');
				if (Project && (
					regex.test(Project.save_path.replace(osfs, '/')) ||
					regex.test(Project.export_path.replace(osfs, '/'))
				)) {
					return true;
				}
				break;
		}
		return false;
	}
	clear(key) {
		Vue.delete(this.settings, key);
		Settings.saveLocalStorages();
	}
	openDialog() {
		let color_options = {};
		for (let i = 0; i < markerColors.length; i++) {
			color_options[i] = tl(`cube.color.${markerColors[i].id}`);
		}
		let condition_types = {
			selectable: tl('settings_profile.condition.type.selectable'),
			format: tl('data.format'),
			file_path: tl('data.file_path'),
		};
		let formats = {};
		for (let key in Formats) {
			formats[key] = Formats[key].name;
		}
		let dialog = new Dialog({
			id: 'settings_profile',
			title: tl('data.settings_profile'),
			form: {
				name: {label: 'generic.name', type: 'text', value: this.name},
				color: {label: 'menu.cube.color', type: 'select', options: color_options, value: this.color},
				_1: '_',

				condition_type: {
					type: 'select',
					label: 'settings_profile.condition',
					value: this.condition.type,
					options: condition_types
				},
				format: {
					type: 'select',
					label: 'data.format',
					value: this.condition.type == 'format' ? this.condition.value : '',
					options: formats,
					condition: (form) => form.condition_type == 'format'
				},
				file_path: {
					type: 'text',
					label: 'data.file_path',
					description: 'settings_profile.condition.type.file_path.desc',
					value: this.condition.type == 'file_path' ? this.condition.value : '',
					condition: (form) => form.condition_type == 'file_path'
				},
				_2: '_',

				remove: {type: 'buttons', buttons: ['generic.delete'], click: (button) => {
					if (confirm(tl('settings_profile.confirm_delete')))
					this.remove();
					Settings.dialog.content_vue.$data.profile = null;
					SettingsProfile.unselect();
					dialog.close(0);
				}}
			},
			onConfirm: (result) => {
				this.name = result.name;
				this.color = result.color;
				this.condition.type = result.condition_type;
				if (this.condition.type == 'format') this.condition.value = result.format;
				if (this.condition.type == 'file_path') this.condition.value = result.file_path;
				Settings.saveLocalStorages();
				Settings.updateProfileButton();
			},
			onCancel() {
				Settings.updateProfileButton();
			}
		}).show();
	}
	remove() {
		SettingsProfile.all.remove(this);
		Settings.saveLocalStorages();
	}
	static all: SettingsProfile[] = []
	static selected: SettingsProfile | null = null
	static unselect = function(update = true) {
		SettingsProfile.all.forEach(p => p.selected = false);
		SettingsProfile.selected = null;
		if (update) {
			Settings.updateSettingsInProfiles();
			Settings.saveLocalStorages();
			Settings.updateProfileButton();
		}
	}
}

export const Settings = {
	profile_menu_button: null as HTMLElement | null,
	structure: {},
	stored: {} as Record<string, SettingsValue>,
	dialog: null as Dialog | null,
	addCategory(id: string, data: {name?: string, open?: boolean}) {
		Settings.structure[id] = {
			name: data.name || tl('settings.category.'+id),
			open: data.open != undefined ? !!data.open : id === 'general',
			items: {}
		}
		Settings.dialog.sidebar.pages[id] = Settings.structure[id].name;
		Settings.dialog.sidebar.build();
	},
	saveLocalStorages() {
		var settings_copy = {}
		for (var key in settings) {
			settings_copy[key] = {value: settings[key].master_value}
		}
		localStorage.setItem('settings', JSON.stringify(settings_copy) )
		localStorage.setItem('settings_profiles', JSON.stringify(SettingsProfile.all));

		// @ts-ignore
		if (window.ColorPanel) ColorPanel.saveLocalStorages()
	},
	save() {
		Settings.saveLocalStorages()
		updateSelection();
		for (let key in BarItems) {
			let action = BarItems[key]
			if (action instanceof Toggle && action.linked_setting) {
				if (settings[action.linked_setting] && action.value != settings[action.linked_setting].value) {
					action.value = settings[action.linked_setting].value as boolean;
					action.updateEnabledState();
				}
			}
		}
		Settings.updateProfileButton();
		Blockbench.dispatchEvent('update_settings', {});
	},
	updateSettingsInProfiles() {
		let settings_to_change = new Set();
		for (let profile of SettingsProfile.all) {
			for (let key in profile.settings) {
				if (settings[key]) {
					settings_to_change.add(key);
				} else {
					delete profile.settings[key];
				}
			}
		}
		settings_to_change.forEach((key: string) => {
			let setting = settings[key];
			if (setting.onChange) setting.onChange(setting.value);
		})
	},
	updateProfileButton() {
		let profile = SettingsProfile.selected;
		Settings.profile_menu_button.style.color = profile ? markerColors[profile.color % markerColors.length].standard : '';
		Settings.profile_menu_button.classList.toggle('hidden', SettingsProfile.all.findIndex(p => p.condition.type == 'selectable') == -1);
	},
	import(file) {
		let data = JSON.parse(file.content);
		for (let key in settings) {
			let setting = settings[key];
			if (setting instanceof Setting && data.settings[key] !== undefined) {
				setting.set(data.settings[key]);
			}
		}
	},
	get(id: string) {
		if (id && settings[id]) {
			return settings[id].value;
		}
	},
	openDialog(options: {search_term?: string, profile?: string} = {}) {
		for (var sett in settings) {
			if (settings.hasOwnProperty(sett)) {
				Settings.old[sett] = settings[sett].value
			}
		}
		Settings.dialog.show();
		if (options.search_term) Settings.dialog.content_vue.$data.search_term = options.search_term;
		if (options.profile) Settings.dialog.content_vue.$data.profile = options.profile;
		Settings.dialog.content_vue.$forceUpdate();
	},
	showRestartMessage(settings?: Setting[]) {
		let message;
		if (settings instanceof Array) {
			message = tl('message.settings_require_restart.message') + '\n\n';
			for (let setting of settings) {
				message += '* ' + setting.name + '\n'
			}
		}
		Blockbench.showMessageBox({
			icon: 'fa-power-off',
			translateKey: 'settings_require_restart',
			message,
			commands: {
				restart_now: {text: 'message.settings_require_restart.restart_now'}
			},
			buttons: ['message.settings_require_restart.restart_later']
		}, result => {
			if (result == 'restart_now') {
				if (isApp) {
					Blockbench.once('before_closing', () => {
						ipcRenderer.send('new-window');
					})
					window.close();
				} else {
					location.reload();
				}
			}
		})
	},
	old: {}
}

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

Object.assign(window, {
	settings,
	Setting,
	SettingsProfile,
	Settings,
});
