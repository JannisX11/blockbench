const settings = {};

class Setting {
	constructor(id, data) {
		this.id = id;
		settings[id] = this;
		this.type = 'toggle';
		if (data.type) this.type = data.type;
		if (Settings.stored[id]) {
			this.value = Settings.stored[id].value;

		} else if (data.value != undefined) {
			this.value = data.value

		} else {
			switch (this.type) {
				case 'toggle': this.value = true; break;
				case 'number': this.value = 0; break;
				case 'text': this.value = ''; break;
				case 'password': this.value = ''; break;
				case 'select': this.value; break;
				case 'click': this.value = false; break;
			}
		}
		this.condition = data.condition;
		this.category = data.category || 'general';
		this.name = data.name || tl(`settings.${id}`);
		this.description = data.description || tl(`settings.${id}.desc`);
		this.launch_setting = data.launch_setting || false;

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
	}
	delete() {
		if (settings[this.id]) {
			delete settings[this.id];
		}
		if (Settings.structure[this.category] && Settings.structure[this.category].items[this.id]) {
			delete Settings.structure[this.category].items[this.id];
		}
	}
	set(value) {
		if (value === undefined || value === null) return;
		let old_value = this.value;

		if (this.type == 'number' && typeof value == 'number') {
			if (this.snap) {
				value = Math.round(value / this.snap) * this.snap;
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
	trigger(e) {
		let {type} = this;
		let setting = this;
		if (type == 'toggle') {
			this.set(!this.value);
			Settings.save();

		} else if (type == 'click') {
			this.click(e)

		} else if (type == 'select') {
			let list = [];
			for (let key in this.options) {
				list.push({
					id: key,
					name: this.options[key],
					icon: this.value == key
						? 'radio_button_checked'
						: 'radio_button_unchecked',
					click: () => {
						this.set(key);
						Settings.save();
					}
				})
			}
			new Menu(list).open(e.target);

		} else if (type == 'click') {
			this.click(e)

		} else {
			new Dialog({
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
					} : undefined
				},
				onConfirm({input}) {
					setting.set(input);
					Settings.save();
					this.hide().delete();
				},
				onCancel() {
					this.hide().delete();
				}
			}).show();

		}
	}
}

const Settings = {
	structure: {},
	stored: {},
	setup() {
		if (localStorage.getItem('settings') != null) {
			Settings.stored = JSON.parse(localStorage.getItem('settings'));
		}
		
		//General
		new Setting('language', {value: 'en', type: 'select', options: Language.options});
		new Setting('username', {value: '', type: 'text'});
		new Setting('streamer_mode', {value: false, onChange() {
			StartScreen.vue._data.redact_names = settings.streamer_mode.value;
			Interface.status_bar.vue.streamer_mode = settings.streamer_mode.value;
			updateStreamerModeNotification();
		}});

		//Interface
		new Setting('interface_scale', 		{category: 'interface', value: 100, min: 40, max: 200, type: 'number', condition: isApp, onChange() {
			var factor = Math.clamp(settings.interface_scale.value, 40, 200) / 100;
			currentwindow.webContents.setZoomFactor(factor)
			resizeWindow()
		}});
		new Setting('hide_tab_bar', 		{category: 'interface', value: Blockbench.isMobile, onChange() {
			updateTabBarVisibility();
		}});
		new Setting('mobile_panel_side',	{category: 'interface', value: 'right', condition: Blockbench.isMobile, type: 'select', options: {
			'right': tl('generic.right'),
			'left': tl('generic.left'),
		}, onChange() {
			document.body.classList.toggle('mobile_sidebar_left', settings.mobile_panel_side.value == 'left');
		}});
		new Setting('status_bar_modifier_keys', {category: 'interface', value: true, condition: !Blockbench.isTouch, onChange(value) {
			Interface.status_bar.vue.show_modifier_keys = value;
		}});
		new Setting('origin_size',  		{category: 'interface', value: 10, type: 'number', min: 2, max: 40});
		new Setting('control_size',  		{category: 'interface', value: 10, type: 'number', min: 2, max: 40});
		new Setting('motion_trails',  		{category: 'interface', value: true, onChange() {
			if (Animator.open) {
				scene[this.value ? 'add' : 'remove'](Animator.motion_trail);
			}
		}});
		new Setting('seethrough_outline', 	{category: 'interface', value: false});
		new Setting('outliner_colors', 		{category: 'interface', value: false});
		new Setting('preview_checkerboard',	{category: 'interface', value: true, onChange() {
			$('#center').toggleClass('checkerboard', settings.preview_checkerboard.value);
		}});
		new Setting('uv_checkerboard', 		{category: 'interface', value: true, onChange(val) {
			UVEditor.vue.checkerboard = val;
		}});
		new Setting('timecode_frame_number',{category: 'interface', value: false, onChange() {
			Timeline.vue.updateTimecodes();
		}});
		
		//Preview 
		new Setting('brightness',  		{category: 'preview', value: 50, type: 'number', min: 0, max: 400});
		new Setting('shading', 	  		{category: 'preview', value: true, onChange() {
			Canvas.updateShading()
		}});
		new Setting('antialiasing', 	{category: 'preview', value: true});
		new Setting('fov', 		  		{category: 'preview', value: 45, type: 'number', min: 1, max: 120, onChange(val) {
			Preview.all.forEach(preview => preview.setFOV(val));
		}});
		new Setting('camera_near_plane',{category: 'preview', value: 1, type: 'number', min: 0.01, max: 100, onChange(val) {
			Preview.all.forEach(preview => {
				preview.camPers.near = val;
				preview.camPers.updateProjectionMatrix();
			});
		}});
		new Setting('render_sides', 	{category: 'preview', value: 'auto', type: 'select', options: {
			'auto': tl('settings.render_sides.auto'),
			'front': tl('settings.render_sides.front'),
			'double': tl('settings.render_sides.double'),
		}, onChange() {
			Canvas.updateRenderSides();
		}});
		new Setting('background_rendering', 	{category: 'preview', value: true});
		new Setting('texture_fps',   	{category: 'preview', value: 7, type: 'number', min: 0, max: 120, onChange() {
			TextureAnimator.updateSpeed()
		}});
		new Setting('particle_tick_rate',{category: 'preview', value: 30, type: 'number', min: 1, max: 1000, onChange() {
			WinterskyScene.global_options.tick_rate = this.value;
		}});
		new Setting('volume',  	  		{category: 'preview', value: 80, min: 0, max: 200, type: 'number'});
		new Setting('display_skin',  	{category: 'preview', value: false, type: 'click', condition: isApp, icon: 'icon-player', click: function() { changeDisplaySkin() }});
		
		//Edit
		new Setting('undo_limit',			{category: 'edit', value: 256, type: 'number', min: 1});
		new Setting('canvas_unselect',  	{category: 'edit', value: false});
		new Setting('highlight_cubes',  	{category: 'edit', value: true, onChange() {
			updateCubeHighlights();
		}});
		new Setting('allow_display_slot_mirror', {category: 'edit', value: false, onChange(value) {
			DisplayMode.vue.allow_mirroring = value;
		}})
		new Setting('deactivate_size_limit',{category: 'edit', value: false});
		new Setting('vertex_merge_distance',{category: 'edit', value: 0.1, step: 0.01, type: 'number', min: 0});
		new Setting('preview_paste_behavior',{category: 'edit', value: 'always_ask', type: 'select', options: {
			'always_ask': tl('settings.preview_paste_behavior.always_ask'),
			'outliner': tl('menu.paste.outliner'),
			'face': tl('menu.paste.face'),
			'mesh_selection': tl('menu.paste.mesh_selection'),
		}});
		
		//Grid
		new Setting('base_grid',		{category: 'grid', value: true,});
		new Setting('large_grid', 		{category: 'grid', value: true});
		new Setting('full_grid',		{category: 'grid', value: false});
		new Setting('large_box',		{category: 'grid', value: false});
		new Setting('large_grid_size',	{category: 'grid', value: 3, type: 'number', min: 0, max: 2000});
		//new Setting('display_grid',		{category: 'grid', value: false});
		new Setting('painting_grid',	{category: 'grid', value: true, onChange(value) {
			Canvas.updatePaintingGrid();
			UVEditor.vue.pixel_grid = value;
		}});
		new Setting('ground_plane',		{category: 'grid', value: false, onChange() {
			Canvas.ground_plane.visible = this.value;
		}});
		
		//Snapping
		new Setting('edit_size',		{category: 'snapping', value: 16, type: 'number', min: 1, max: 8192});
		new Setting('shift_size', 		{category: 'snapping', value: 64, type: 'number', min: 1, max: 8192});
		new Setting('ctrl_size',		{category: 'snapping', value: 160, type: 'number', min: 1, max: 8192});
		new Setting('ctrl_shift_size',	{category: 'snapping', value: 640, type: 'number', min: 1, max: 8192});
		new Setting('negative_size',	{category: 'snapping', value: false});
		new Setting('nearest_rectangle_select',{category: 'snapping', value: false});

		//Paint
		new Setting('sync_color',	{category: 'paint', value: false});
		new Setting('color_wheel',	{category: 'paint', value: false, onChange(value) {
			Interface.Panels.color.vue.picker_type = value ? 'wheel' : 'box';
		}});
		new Setting('pick_color_opacity',		{category: 'paint', value: false});
		new Setting('paint_side_restrict',		{category: 'paint', value: true});
		new Setting('paint_with_stylus_only',	{category: 'paint', value: false});
		new Setting('brush_opacity_modifier',	{category: 'paint', value: 'pressure', type: 'select', options: {
			'pressure': tl('settings.brush_modifier.pressure'),
			'tilt': tl('settings.brush_modifier.tilt'),
			'none': tl('settings.brush_modifier.none'),
		}});
		new Setting('brush_size_modifier', {category: 'paint', value: 'tilt', type: 'select', options: {
			'pressure': tl('settings.brush_modifier.pressure'),
			'tilt': tl('settings.brush_modifier.tilt'),
			'none': tl('settings.brush_modifier.none'),
		}});
		new Setting('image_editor',  	{category: 'paint', value: false, type: 'click', condition: isApp, icon: 'fas.fa-pen-square', click: function() {changeImageEditor(null, true) }});
		
		//Defaults
		new Setting('default_cube_size',		{category: 'defaults', value: 2, type: 'number', min: 0, max: 32});
		new Setting('autouv',	   				{category: 'defaults', value: true});
		new Setting('create_rename', 			{category: 'defaults', value: false});
		new Setting('show_only_selected_uv', 	{category: 'defaults', value: false});
		new Setting('default_path', 			{category: 'defaults', value: false, type: 'click', condition: isApp, icon: 'burst_mode', click: function() { openDefaultTexturePath() }});
		new Setting('animation_snap',			{category: 'defaults', value: 24, type: 'number'});
		new Setting('uniform_keyframe',			{category: 'defaults', value: true});
		
		//Dialogs
		new Setting('dialog_larger_cubes', 		{category: 'dialogs', value: true, name: tl('message.model_clipping.title'), description: tl('settings.dialog.desc', [tl('message.model_clipping.title')])});
		new Setting('dialog_rotation_limit', 	{category: 'dialogs', value: true, name: tl('message.rotation_limit.title'), description: tl('settings.dialog.desc', [tl('message.rotation_limit.title')])});
		new Setting('dialog_loose_texture', 	{category: 'dialogs', value: true, name: tl('message.loose_texture.title'), description: tl('settings.dialog.desc', [tl('message.loose_texture.title')])});
		new Setting('dialog_invalid_characters',{category: 'dialogs', value: true, name: tl('message.invalid_characters.title'), description: tl('settings.dialog.desc', [tl('message.invalid_characters.title')])});
		
		//Application
		new Setting('recent_projects', {category: 'application', value: 32, max: 256, min: 0, type: 'number', condition: isApp});
		new Setting('backup_interval', {category: 'application', value: 10, type: 'number', min: 0, condition: isApp});
		new Setting('backup_retain', {category: 'application', value: 30, type: 'number', min: 0, condition: isApp});
		new Setting('automatic_updates', {category: 'application', value: true, condition: isApp});
		new Setting('update_to_prereleases', {category: 'application', value: false, condition: isApp, launch_setting: true});
		new Setting('hardware_acceleration', {category: 'application', value: true, condition: isApp, launch_setting: true});
		
		//Export
		new Setting('minifiedout', 			{category: 'export', value: false});
		new Setting('minify_bbmodel', 		{category: 'export', value: true});
		new Setting('export_empty_groups',	{category: 'export', value: true});
		new Setting('export_groups', 		{category: 'export', value: true});
		new Setting('obj_face_export_mode',	{category: 'export', value: 'both', type: 'select', options: {
			both: tl('settings.obj_face_export_mode.both'),
			tris: tl('settings.obj_face_export_mode.tris'),
			quads: tl('settings.obj_face_export_mode.quads'),
		}});
		new Setting('animation_sample_rate',{category: 'export', value: 24, type: 'number', min: 1, max: 640});
		new Setting('model_export_scale',	{category: 'export', value: 16, type: 'number', min: 0.0001, max: 4096});
		new Setting('sketchfab_token', 		{category: 'export', value: '', type: 'password'});
		new Setting('credit', 				{category: 'export', value: 'Made with Blockbench', type: 'text'});
	},
	addCategory(id, data = {}) {
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
			settings_copy[key] = {value: settings[key].value}
		}
		localStorage.setItem('settings', JSON.stringify(settings_copy) )

		if (window.canvas_scenes) {
			localStorage.setItem('canvas_scenes', JSON.stringify(canvas_scenes))
		}
		if (window.ColorPanel) {
			ColorPanel.saveLocalStorages()
		}
	},
	save() {
		Settings.saveLocalStorages()
		function hasSettingChanged(id) {
			return (settings[id].value !== Settings.old[id])
		}
		updateSelection()

		for (var key in BarItems) {
			var action = BarItems[key]
			if (action.linked_setting) {
				if (settings[action.linked_setting] && action.value != settings[action.linked_setting].value) {
					action.value = settings[action.linked_setting].value;
					action.updateEnabledState();
				}
			}
		}
		if (hasSettingChanged('base_grid') || hasSettingChanged('large_grid') || hasSettingChanged('full_grid') || hasSettingChanged('large_grid_size')
			||hasSettingChanged('large_box') || hasSettingChanged('edit_size')) {
			Canvas.buildGrid()
		}
		Canvas.outlineMaterial.depthTest = !settings.seethrough_outline.value
		if (hasSettingChanged('brightness')) {
			Canvas.updateShading()
		}
		for (var id in settings) {
			var setting = settings[id];
			if (!Condition(setting.condition)) continue;
			if (setting.onChange && hasSettingChanged(id)) {
				setting.onChange(setting.value);
			}
			if (isApp && setting.launch_setting && hasSettingChanged(id)) {
				ipcRenderer.send('edit-launch-setting', {key: id, value: setting.value})
			}
		}
		Blockbench.dispatchEvent('update_settings');
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
	get(id) {
		if (id && settings[id]) {
			return settings[id].value;
		}
	},
	openDialog(options = {}) {
		for (var sett in settings) {
			if (settings.hasOwnProperty(sett)) {
				Settings.old[sett] = settings[sett].value
			}
		}
		Settings.dialog.show();
		if (options.search_term) Settings.dialog.content_vue.search_term = options.search_term;
	},
	old: {}
}
Settings.setup()

function updateStreamerModeNotification() {
	$('#start_screen section#streamer_mode').detach()

	if (settings.streamer_mode.value) {
		addStartScreenSection('streamer_mode', {
			graphic: {type: 'icon', icon: 'live_tv'},
			color: 'var(--color-stream)',
			text_color: 'var(--color-light)',
			text: [
				{type: 'h1', text: tl('interface.streamer_mode_on'), click() {
					Settings.openDialog({search_term: tl('settings.streamer_mode')})
				}}
			]
		})
	}
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
			Settings.dialog.show()
			document.querySelector('dialog#settings .search_bar > input').focus()
		}
	})
	
	new Action('import_settings', {
		icon: 'folder',
		category: 'blockbench',
		click: function () {
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
			Blockbench.export({
				resource_id: 'config',
				type: 'Blockbench Settings',
				extensions: ['bbsettings'],
				content: compileJSON({settings: settings_copy})
			})
		}
	})
	BarItems.import_settings.toElement('#settings_title_bar')
	BarItems.export_settings.toElement('#settings_title_bar')
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
				open_category: 'general',
				search_term: '',
			}},
			methods: {
				saveSettings() {
					Settings.saveLocalStorages();
				},
				getIconNode: Blockbench.getIconNode,
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
				}
			},
			template: `
				<div>
					<h2 class="i_b">{{ title }}</h2>

					<search-bar id="settings_search_bar" v-model="search_term"></search-bar>

					<ul id="settingslist">

						<li v-for="(setting, key) in list" v-if="Condition(setting.condition)" v-on="setting.click ? {click: setting.click} : {}">
							<template v-if="setting.type === 'number'">
								<div class="setting_element"><input type="number" v-model.number="setting.value" :min="setting.min" :max="setting.max" :step="setting.step" v-on:input="saveSettings()"></div>
							</template>
							<template v-else-if="setting.type === 'click'">
								<div class="setting_element setting_icon" v-html="getIconNode(setting.icon).outerHTML"></div>
							</template>
							<template v-else-if="setting.type == 'toggle'"><!--TOGGLE-->
								<div class="setting_element"><input type="checkbox" v-model="setting.value" v-bind:id="'setting_'+key" v-on:click="saveSettings()"></div>
							</template>

							<label class="setting_label" v-bind:for="'setting_'+key">
								<div class="setting_name">{{ setting.name }}</div>
								<div class="setting_description">{{ setting.description }}</div>
							</label>

							<template v-if="setting.type === 'text'">
								<input type="text" class="dark_bordered" style="width: 96%" v-model="setting.value" v-on:input="saveSettings()">
							</template>

							<template v-if="setting.type === 'password'">
								<input :type="setting.hidden ? 'password' : 'text'" class="dark_bordered" style="width: calc(96% - 28px);" v-model="setting.value" v-on:input="saveSettings()">
								<div class="password_toggle" @click="setting.hidden = !setting.hidden;">
									<i class="fas fa-eye-slash" v-if="setting.hidden"></i>
									<i class="fas fa-eye" v-else></i>
								</div>
							</template>

							<template v-else-if="setting.type === 'select'">
								<div class="bar_select">
									<select-input v-model="setting.value" :options="setting.options" />
								</div>
							</template>
						</li>
					</ul>
				</div>`
		},
		onButton() {
			Settings.save();
		}
	})
})