const settings = {};

class Setting {
	constructor(id, data) {
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
		let profile = Settings.dialog.content_vue?.profile;
		if (profile) {
			return profile.settings[this.id] ?? this.master_value;
		} else {
			return this.master_value;
		}
	}
	set ui_value(value) {
		let profile = Settings.dialog.content_vue?.profile;
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
			new Menu(list).open(e.target);

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

class SettingsProfile {
	constructor(data = 0) {
		this.uuid = guid();
		this.name = data.name || 'New Profile';
		this.color = data.color == undefined ? Math.randomInteger(0, markerColors.length-1) : data.color;
		this.condition = {
			type: 'selectable',
			value: ''
		};
		this.settings = {};
		this.extend(data);
		this.selected = false;
		SettingsProfile.all.push(this);
	}
	select(update = true) {
		if (this.condition.type !== 'selectable') return;

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
			case 'selectable':
				return SettingsProfile.selected == this;
			case 'format':
				if (Format && Format.id == this.condition.value) return true;
				break;
			case 'file_path':
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
					Settings.dialog.content_vue.profile = null;
					SettingsProfile.unselect();
					dialog.close();
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
}
SettingsProfile.all = [];
SettingsProfile.selected = null;
SettingsProfile.unselect = function(update = true) {
	SettingsProfile.all.forEach(p => p.selected = false);
	SettingsProfile.selected = null;
	if (update) {
		Settings.updateSettingsInProfiles();
		Settings.saveLocalStorages();
		Settings.updateProfileButton();
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
		new Setting('language', {value: 'en', type: 'select', requires_restart: true, options: Language.options});
		new Setting('username', {value: '', type: 'text'});
		new Setting('streamer_mode', {value: false, onChange() {
			StartScreen.vue._data.redact_names = settings.streamer_mode.value;
			Interface.status_bar.vue.streamer_mode = settings.streamer_mode.value;
			updateStreamerModeNotification();
		}});
		new Setting('classroom_mode', {value: false, requires_restart: true});
		new Setting('cdn_mirror', {value: false});
		new Setting('recovery_save_interval', {value: 30, type: 'number', min: 0, onChange() {
			clearTimeout(AutoBackup.loop_timeout);
			AutoBackup.backupProjectLoop(false);
		}});

		//Interface
		new Setting('interface_mode', 		{category: 'interface', value: 'auto', requires_restart: true, type: 'select', options: {
			'auto': tl('settings.interface_mode.auto'),
			'desktop': tl('settings.interface_mode.desktop'),
			'mobile': tl('settings.interface_mode.mobile'),
		}});
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
		new Setting('always_show_splash_art',{category: 'interface', value: true});
		new Setting('origin_size',  		{category: 'interface', value: 10, type: 'number', min: 2, max: 40});
		new Setting('control_size',  		{category: 'interface', value: 10, type: 'number', min: 2, max: 40});
		new Setting('motion_trails',  		{category: 'interface', value: true, onChange() {
			if (Animator.open) {
				scene[this.value ? 'add' : 'remove'](Animator.motion_trail);
			}
		}});
		new Setting('seethrough_outline', 	{category: 'interface', value: false, onChange(value) {
			Canvas.outlineMaterial.depthTest = !value;
			Canvas.meshOutlineMaterial.depthTest = !value;
		}});
		new Setting('outliner_colors', 		{category: 'interface', value: true});
		new Setting('preview_checkerboard',	{category: 'interface', value: true, onChange() {
			$('#center').toggleClass('checkerboard', settings.preview_checkerboard.value);
		}});
		new Setting('uv_checkerboard', 		{category: 'interface', value: true, onChange(val) {
			UVEditor.vue.checkerboard = val;
		}});
		new Setting('timecode_frame_number',{category: 'interface', value: false, onChange() {
			Timeline.vue.updateTimecodes();
		}});
		new Setting('only_selected_bezier_handles',{category: 'interface', value: false, onChange(val) {
			Timeline.vue.show_all_handles = !val;
		}});
		
		//Preview 
		new Setting('brightness',  		{category: 'preview', value: 50, type: 'number', min: 0, max: 400, onChange() {
			Canvas.updateShading();
		}});
		new Setting('shading', 	  		{category: 'preview', value: true, onChange() {
			Canvas.updateShading()
		}});
		new Setting('antialiasing', 	{category: 'preview', value: true, requires_restart: true});
		new Setting('antialiasing_bleed_fix', 	{category: 'preview', value: false, requires_restart: true});
		new Setting('fov', 		  		{category: 'preview', value: 45, type: 'number', min: 1, max: 120, onChange(val) {
			Preview.all.forEach(preview => preview.setFOV(val));
		}});
		new Setting('camera_near_plane',{category: 'preview', value: 1, type: 'number', min: 0.01, max: 100, onChange(val) {
			Preview.all.forEach(preview => {
				preview.camPers.near = val;
				preview.camPers.updateProjectionMatrix();
			});
		}});
		new Setting('render_sides', 			{category: 'preview', value: 'auto', type: 'select', options: {
			'auto': tl('settings.render_sides.auto'),
			'front': tl('settings.render_sides.front'),
			'double': tl('settings.render_sides.double'),
		}, onChange() {
			Canvas.updateRenderSides();
		}});
		new Setting('tone_mapping', 			{category: 'preview', value: 'none', type: 'select', options: {
			none: tl('generic.none'),
			linear: 'Linear',
			reinhard: 'Reinhard',
			cineon: 'Cineon',
			aces_filmic: 'ACES Filmic',
			agx: 'AgX',
			neutral: 'Neutral',
		}, onChange() {
			for (let preview of Preview.all) {
				preview.updateToneMapping();
			}
			Canvas.updateShading();
			for (let model of PreviewModel.getActiveModels()) {
				model.material.needsUpdate = true;
			}
		}});
		new Setting('fps_limit',				{category: 'preview', value: 144, min: 10, max: 1024, type: 'number'});
		new Setting('background_rendering', 	{category: 'preview', value: true});
		new Setting('texture_fps',   			{category: 'preview', value: 7, type: 'number', min: 0, max: 120, onChange() {
			TextureAnimator.updateSpeed()
		}});
		new Setting('particle_tick_rate',		{category: 'preview', value: 30, type: 'number', min: 1, max: 1000, onChange() {
			WinterskyScene.global_options.tick_rate = this.value;
		}});
		new Setting('volume', 					{category: 'preview', value: 80, min: 0, max: 200, type: 'number'});
		new Setting('audio_scrubbing',			{category: 'preview', value: true});
		new Setting('save_view_per_tab',		{category: 'preview', value: true});
		new Setting('display_skin',				{category: 'preview', value: false, type: 'click', icon: 'icon-player', click: function() { changeDisplaySkin() }});

		new Setting('viewport_rotate_speed',	{category: 'controls', value: 100, min: 10, max: 1000, type: 'number', onChange(value) {
			Preview.all.forEach(viewport => viewport.controls.rotateSpeed = value / 100)
		}});
		new Setting('viewport_zoom_speed',		{category: 'controls', value: 100, min: 10, max: 1000, type: 'number', onChange(value) {
			Preview.all.forEach(viewport => viewport.controls.zoomSpeed = value / 100 * 1.5)
		}});
		new Setting('editor_2d_zoom_speed',		{category: 'controls', value: 100, min: 10, max: 1000, type: 'number'});
		new Setting('gamepad_controls',			{category: 'controls', value: false, name: 'Gamepad Controls', description: 'Use a gamepad or 3D mouse to navigate the viewport'});
		new Setting('double_click_switch_tools',{category: 'controls', value: true});
		new Setting('canvas_unselect',  		{category: 'controls', value: false});
		new Setting('selection_tolerance', 		{category: 'controls', value: 10, type: 'number', min: 1, max: 50});

		//Edit
		new Setting('undo_selections',			{category: 'edit', value: false});
		new Setting('undo_limit',				{category: 'edit', value: 256, type: 'number', min: 1});
		new Setting('highlight_cubes',  		{category: 'edit', value: true, onChange() {
			updateCubeHighlights();
		}});
		new Setting('outliner_reveal_on_select', {category: 'edit', value: true})
		new Setting('allow_display_slot_mirror', {category: 'edit', value: false, onChange(value) {
			DisplayMode.vue.allow_mirroring = value;
		}})
		new Setting('deactivate_size_limit',	{category: 'edit', value: false});
		new Setting('modded_entity_integer_size',{category:'edit', value: true});
		new Setting('vertex_merge_distance',	{category: 'edit', value: 0.1, step: 0.01, type: 'number', min: 0});
		new Setting('preview_paste_behavior',	{category: 'edit', value: 'always_ask', type: 'select', options: {
			'always_ask': tl('settings.preview_paste_behavior.always_ask'),
			'outliner': tl('menu.paste.outliner'),
			'face': tl('menu.paste.face'),
			'mesh_selection': tl('menu.paste.mesh_selection'),
		}});
		new Setting('stretch_linked',		{category: 'edit', value: true});
		new Setting('auto_keyframe',		{category: 'edit', value: true});

		//Paint
		new Setting('color_wheel',					{category: 'paint', value: false, onChange(value) {
			Interface.Panels.color.vue.picker_type = value ? 'wheel' : 'box';
		}});
		new Setting('brush_cursor_2d',			{category: 'paint', value: true});
		new Setting('brush_cursor_3d',			{category: 'paint', value: true, onChange(value) {
			if (!value) scene.remove(Canvas.brush_outline);
		}});
		new Setting('outlines_in_paint_mode',		{category: 'paint', value: true});
		new Setting('move_with_selection_tool',		{category: 'paint', value: true});
		new Setting('pick_color_opacity',			{category: 'paint', value: false});
		new Setting('pick_combined_color',			{category: 'paint', value: false});
		new Setting('paint_through_transparency',	{category: 'paint', value: true});
		new Setting('paint_side_restrict',			{category: 'paint', value: true});
		new Setting('paint_with_stylus_only',		{category: 'paint', value: false});
		new Setting('brush_opacity_modifier',		{category: 'paint', value: 'none', type: 'select', options: {
			'pressure': tl('settings.brush_modifier.pressure'),
			'tilt': tl('settings.brush_modifier.tilt'),
			'none': tl('settings.brush_modifier.none'),
		}});
		new Setting('brush_size_modifier', {category: 'paint', value: 'none', type: 'select', options: {
			'pressure': tl('settings.brush_modifier.pressure'),
			'tilt': tl('settings.brush_modifier.tilt'),
			'none': tl('settings.brush_modifier.none'),
		}});
		new Setting('image_editor',  	{category: 'paint', value: false, type: 'click', condition: isApp, icon: 'fas.fa-pen-square', click: function() {changeImageEditor(null) }});
		
		//Grid
		new Setting('grids',				{category: 'grid', value: true, onChange() {Canvas.buildGrid()}});
		new Setting('base_grid',			{category: 'grid', value: true, onChange() {Canvas.buildGrid()}});
		new Setting('large_grid', 			{category: 'grid', value: true, onChange() {Canvas.buildGrid()}});
		new Setting('full_grid',			{category: 'grid', value: false, onChange() {Canvas.buildGrid()}});
		new Setting('large_box',			{category: 'grid', value: false, onChange() {Canvas.buildGrid()}});
		new Setting('large_grid_size',		{category: 'grid', value: 3, type: 'number', min: 0, max: 2000, onChange() {Canvas.buildGrid()}});
		//new Setting('display_grid',		{category: 'grid', value: false});
		new Setting('pixel_grid',			{category: 'grid', value: false, onChange(value) {
			Canvas.updatePixelGrid();
			UVEditor.vue.pixel_grid = value;
		}});
		new Setting('painting_grid',		{category: 'grid', value: true, onChange(value) {
			Canvas.updatePixelGrid();
			UVEditor.vue.pixel_grid = value;
		}});
		new Setting('image_editor_grid_size',{category: 'grid', type: 'number', value: 16, onChange() {
			UVEditor.vue.zoom += 0.01;
			UVEditor.vue.zoom -= 0.01;
		}});
		new Setting('ground_plane',			{category: 'grid', value: false, onChange() {
			Canvas.ground_plane.visible = this.value;
		}});
		new Setting('ground_plane_double_side',{category: 'grid', value: false, onChange() {
			Canvas.groundPlaneMaterial.side = this.value ? THREE.DoubleSide : THREE.FrontSide;
		}});
		
		//Snapping
		new Setting('edit_size',		{category: 'snapping', value: 16, type: 'number', min: 1, max: 8192, onChange() {Canvas.buildGrid()}});
		new Setting('shift_size', 		{category: 'snapping', value: 64, type: 'number', min: 1, max: 8192});
		new Setting('ctrl_size',		{category: 'snapping', value: 160, type: 'number', min: 1, max: 8192});
		new Setting('ctrl_shift_size',	{category: 'snapping', value: 640, type: 'number', min: 1, max: 8192});
		new Setting('negative_size',	{category: 'snapping', value: false});
		new Setting('nearest_rectangle_select',{category: 'snapping', value: false});
		
		//Defaults
		new Setting('default_cube_size',		{category: 'defaults', value: 2, type: 'number', min: 0, max: 32});
		new Setting('autouv',					{category: 'defaults', value: true});
		new Setting('inherit_parent_color',		{category: 'defaults', value: false});
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
		new Setting('dialog_save_codec',		{category: 'dialogs', value: true, name: tl('message.save_codec_selector.title'), description: tl('settings.dialog.desc', [tl('message.save_codec_selector.title')])});
		
		//Application
		new Setting('recent_projects', {category: 'application', value: 32, max: 256, min: 0, type: 'number', condition: isApp});
		new Setting('backup_interval', {category: 'application', value: 10, type: 'number', min: 0, condition: isApp});
		new Setting('backup_retain', {category: 'application', value: 30, type: 'number', min: 0, condition: isApp});
		new Setting('automatic_updates', {category: 'application', value: true, condition: isApp});
		new Setting('update_to_prereleases', {category: 'application', value: false, condition: isApp, launch_setting: true});
		new Setting('hardware_acceleration', {category: 'application', value: true, requires_restart: true, condition: isApp, launch_setting: true});
		
		//Export
		new Setting('json_indentation',		{category: 'export', value: 'tabs', type: 'select', options: {
			tabs: tl('settings.json_indentation.tabs'),
			spaces_4: tl('settings.json_indentation.spaces_4'),
			spaces_2: tl('settings.json_indentation.spaces_2'),
		}});
		new Setting('final_newline',		{category: 'export', value: false});
		new Setting('minifiedout',			{category: 'export', value: false});
		new Setting('embed_textures', 		{category: 'export', value: true});
		new Setting('minify_bbmodel', 		{category: 'export', value: true});
		new Setting('export_empty_groups',	{category: 'export', value: true});
		new Setting('export_groups', 		{category: 'export', value: true});
		new Setting('java_export_pivots', 	{category: 'export', value: true});
		new Setting('optifine_save_default_texture',{category: 'export', value: true});
		new Setting('obj_face_export_mode',	{category: 'export', value: 'both', type: 'select', options: {
			both: tl('settings.obj_face_export_mode.both'),
			tris: tl('settings.obj_face_export_mode.tris'),
			quads: tl('settings.obj_face_export_mode.quads'),
		}});
		new Setting('animation_sample_rate',{category: 'export', value: 24, type: 'number', min: 1, max: 640});
		new Setting('model_export_scale',	{category: 'export', value: 16, type: 'number', min: 0.0001, max: 4096});
		new Setting('sketchfab_token', 		{category: 'export', value: '', type: 'password'});
		new Setting('credit', 				{category: 'export', value: 'Made with Blockbench', type: 'text'});

		Blockbench.onUpdateTo('4.12.1', () => {
			settings.antialiasing_bleed_fix.set(false);
		})
	},
	setupProfiles() {
		if (localStorage.getItem('settings_profiles') != null) {
			let profiles = JSON.parse(localStorage.getItem('settings_profiles'));
			profiles.forEach(profile => {
				let new_profile = new SettingsProfile(profile);
				if (profile.selected) new_profile.select(false);
			})
		}
		Settings.profile_menu_button = document.getElementById('settings_profiles_header_menu');
		Settings.profile_menu_button.addEventListener('click', event => {
			let list = [
				{
					name: 'generic.none',
					icon: SettingsProfile.selected ? 'far.fa-circle' : 'far.fa-dot-circle',
					click: () => {
						SettingsProfile.unselect();
					}
				},
				'_'
			];
			SettingsProfile.all.forEach(profile => {
				if (profile.condition.type != 'selectable') return;
				list.push({
					name: profile.name,
					icon: profile.selected ? 'far.fa-dot-circle' : 'far.fa-circle',
					color: markerColors[profile.color].standard,
					click: () => {
						profile.select();
					}
				})
			})
			new Menu(list).open(Settings.profile_menu_button);
		});
		Settings.profile_menu_button.setAttribute('title', tl('data.settings_profile'))
		Settings.updateProfileButton();
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
			settings_copy[key] = {value: settings[key].master_value}
		}
		localStorage.setItem('settings', JSON.stringify(settings_copy) )
		localStorage.setItem('settings_profiles', JSON.stringify(SettingsProfile.all));

		if (window.ColorPanel) {
			ColorPanel.saveLocalStorages()
		}
	},
	save() {
		Settings.saveLocalStorages()
		updateSelection();
		for (let key in BarItems) {
			let action = BarItems[key]
			if (action.linked_setting) {
				if (settings[action.linked_setting] && action.value != settings[action.linked_setting].value) {
					action.value = settings[action.linked_setting].value;
					action.updateEnabledState();
				}
			}
		}
		Settings.updateProfileButton();
		Blockbench.dispatchEvent('update_settings');
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
		settings_to_change.forEach(key => {
			let setting = settings[key];
			if (setting.onChange) setting.onChange(setting.value);
		})
	},
	updateProfileButton() {
		let profile = SettingsProfile.selected;
		Settings.profile_menu_button.style.color = profile ? markerColors[profile.color].standard : '';
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
		if (options.profile) Settings.dialog.content_vue.profile = options.profile;
		Settings.dialog.content_vue.$forceUpdate();
	},
	showRestartMessage(settings) {
		let message;
		if (settings instanceof Array) {
			message = tl('message.settings_require_restart.message') + '\n\n';
			for (let plugin of settings) {
				message += '* ' + plugin.name + '\n'
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
					currentwindow.close();
				} else {
					location.reload();
				}
			}
		})
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
				{type: 'h2', text: tl('interface.streamer_mode_on'), click() {
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
				profile: null,
				all_profiles: SettingsProfile.all,
				open_category: 'general',
				search_term: ''
			}},
			methods: {
				saveSettings() {
					Settings.saveLocalStorages();
				},
				settingContextMenu(setting, event) {
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
				showProfileMenu(event) {
					let items = [
						{
							name: 'generic.none',
							icon: 'remove',
							click: () => {
								this.profile = null;
							}
						}
					];
					SettingsProfile.all.forEach(profile => {
						items.push({
							name: profile.name,
							icon: 'manage_accounts',
							color: markerColors[profile.color].standard,
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
					new Menu('settings_profiles', items).open(this.$refs.profile_menu)
				},
				profileButtonPress() {
					if (!this.profile) {
						this.profile = new SettingsProfile({});
					}
					this.profile.openDialog();
				},
				getProfileValuesForSetting(key) {
					return this.all_profiles.filter(profile => {
						return profile.settings[key] !== undefined;
					});
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
				<div :style="{'--color-profile': profile ? markerColors[profile.color] && markerColors[profile.color].standard : ''}">
					<div id="settings_profile_wrapper">
						Profile:
						<bb-select ref="profile_menu" id="settings_profile_select" @click="showProfileMenu($event)" :class="{profile_is_selected: !!profile}">{{ profile_name }}</bb-select>
						<div class="tool" @click="profileButtonPress()"><i class="material-icons">{{ profile ? 'build' : 'add' }}</i></div>
					</div>

					<h2 class="i_b">{{ title }}</h2>

					<search-bar id="settings_search_bar" v-model="search_term"></search-bar>

					<ul class="settings_list" id="settingslist">

						<li v-for="(setting, key) in list" v-if="Condition(setting.condition)"
							v-on="setting.click ? {click: setting.click} : {}"
							:class="{has_profile_override: profile && profile.settings[key] !== undefined}"
							@contextmenu="settingContextMenu(setting, $event)"
						>
							<div class="tool setting_profile_clear_button" v-if="profile && profile.settings[key] !== undefined" @click.stop="profile.clear(key)" title="${tl('Clear profile value')}">
								<i class="material-icons">clear</i>
							</div>

							<template v-if="setting.type === 'number'">
								<div class="setting_element"><numeric-input v-model.number="setting.ui_value" :min="setting.min" :max="setting.max" :step="setting.step" v-on:input="saveSettings()" /></div>
							</template>
							<template v-else-if="setting.type === 'click'">
								<div class="setting_element setting_icon" v-html="getIconNode(setting.icon).outerHTML"></div>
							</template>
							<template v-else-if="setting.type == 'toggle'"><!--TOGGLE-->
								<div class="setting_element"><input type="checkbox" v-model="setting.ui_value" v-bind:id="'setting_'+key" v-on:click="saveSettings()"></div>
							</template>

							<div class="setting_label">
								<label class="setting_name" v-bind:for="'setting_'+key">{{ setting.name }}</label>
								<div class="setting_profile_value_indicator"
									v-for="profile_here in getProfileValuesForSetting(key)"
									:style="{'--color-profile': markerColors[profile_here.color] && markerColors[profile_here.color].standard}"
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