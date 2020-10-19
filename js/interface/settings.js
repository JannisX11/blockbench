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
	}
	delete() {
		if (settings[this.id]) {
			delete settings[this.id];
		}
		if (Settings.structure[this.category] && Settings.structure[this.category].items[this.id]) {
			delete Settings.structure[this.category].items[this.id];
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
			updateStreamerModeNotification();
		}});

		//Interface
		new Setting('origin_size',  		{category: 'interface', value: 10, type: 'number'});
		new Setting('control_size',  		{category: 'interface', value: 10, type: 'number'});
		new Setting('motion_trails',  		{category: 'interface', value: true, onChange() {
			if (Animator.open) {
				scene[this.value ? 'add' : 'remove'](Animator.motion_trail);
			}
		}});
		new Setting('seethrough_outline', 	{category: 'interface', value: false});
		new Setting('outliner_colors', 		{category: 'interface', value: false});
		new Setting('preview_checkerboard',	{category: 'interface', value: false, onChange() {
			$('#center').toggleClass('checkerboard', settings.preview_checkerboard.value);
		}});
		new Setting('uv_checkerboard', 		{category: 'interface', value: false, onChange() {
			$('.UVEditor').toggleClass('checkerboard_trigger', settings.uv_checkerboard.value);
		}});
		
		//Preview 
		new Setting('brightness',  		{category: 'preview', value: 50, type: 'number'});
		new Setting('shading', 	  		{category: 'preview', value: true, onChange() {
			updateShading()
		}});
		new Setting('antialiasing', 	{category: 'preview', value: true});
		new Setting('fov', 		  		{category: 'preview', value: 45, type: 'number', onChange(val) {
			Preview.all.forEach(preview => preview.setFOV(val));
		}});
		new Setting('render_sides', 	{category: 'preview', value: 'auto', type: 'select', options: {
			'auto': tl('settings.render_sides.auto'),
			'front': tl('settings.render_sides.front'),
			'double': tl('settings.render_sides.double'),
		}, onChange() {
			Canvas.updateRenderSides();
		}});
		/*
		new Setting('transparency',		{category: 'preview', value: true, onChange() {
			for (var uuid in Canvas.materials) {
				let material = Canvas.materials[uuid]
				if (material instanceof THREE.Material) {
					material.transparent = settings.transparency.value
				}
			}
		}});
		*/
		new Setting('texture_fps',   	{category: 'preview', value: 2, type: 'number', onChange() {
			TextureAnimator.updateSpeed()
		}});
		new Setting('particle_tick_rate',{category: 'preview', value: 30, type: 'number', onChange() {
			Wintersky.global_options.tick_rate = this.value;
		}});
		new Setting('volume',  	  		{category: 'preview', value: 80, type: 'number'});
		new Setting('display_skin',  	{category: 'preview', value: false, type: 'click', condition: isApp, icon: 'icon-player', click: function() { changeDisplaySkin() }});
		
		//Edit
		new Setting('undo_limit',			{category: 'edit', value: 256, type: 'number'});
		new Setting('canvas_unselect',  	{category: 'edit', value: false});
		new Setting('highlight_cubes',  	{category: 'edit', value: true, onChange() {
			updateCubeHighlights();
		}});
		new Setting('deactivate_size_limit',{category: 'edit', value: false});
		
		//Grid
		new Setting('base_grid',		{category: 'grid', value: true,});
		new Setting('large_grid', 		{category: 'grid', value: false});
		new Setting('full_grid',		{category: 'grid', value: false});
		new Setting('large_box',		{category: 'grid', value: false});
		new Setting('large_grid_size',	{category: 'grid', value: 3, type: 'number'});
		new Setting('display_grid',		{category: 'grid', value: false});
		new Setting('painting_grid',	{category: 'grid', value: true, onChange() {
			Canvas.updatePaintingGrid();
		}});
		
		//Snapping
		new Setting('edit_size',	{category: 'snapping', value: 16, type: 'number'});
		new Setting('shift_size', 	{category: 'snapping', value: 64, type: 'number'});
		new Setting('ctrl_size',	{category: 'snapping', value: 160, type: 'number'});
		new Setting('negative_size',{category: 'snapping', value: false});
		new Setting('animation_snap',{category: 'snapping', value: 25, type: 'number'});

		//Paint
		new Setting('sync_color',	{category: 'paint', value: false});
		new Setting('paint_side_restrict',	{category: 'paint', value: true});
		new Setting('brush_opacity_modifier', {category: 'paint', value: 'pressure', type: 'select', options: {
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
		new Setting('autouv',	   	{category: 'defaults', value: true});
		new Setting('create_rename', {category: 'defaults', value: false});
		new Setting('default_path', {category: 'defaults', value: false, type: 'click', condition: isApp, icon: 'burst_mode', click: function() { openDefaultTexturePath() }});
		
		//Dialogs
		new Setting('dialog_larger_cubes', {category: 'dialogs', value: true});
		new Setting('dialog_drag_background', {category: 'dialogs', value: true});
		new Setting('dialog_rotation_limit', {category: 'dialogs', value: true});
		
		//Application
		new Setting('recent_projects', {category: 'application', value: 12, max: 128, min: 0, type: 'number', condition: isApp});
		new Setting('backup_interval', {category: 'application', value: 10, type: 'number', condition: isApp});
		new Setting('backup_retain', {category: 'application', value: 30, type: 'number', condition: isApp});
		new Setting('automatic_updates', {category: 'application', value: true, condition: isApp});
		
		//Export
		new Setting('minifiedout', {category: 'export', value: false});
		new Setting('minify_bbmodel', {category: 'export', value: true});
		new Setting('export_groups', {category: 'export', value: true});
		new Setting('sketchfab_token', {category: 'export', value: '', type: 'password'});
		new Setting('credit', {category: 'export', value: 'Made with Blockbench', type: 'text'});

	},
	addCategory(id, data) {
		if (!data) data = 0;
		Settings.structure[id] = {
			name: data.name || tl('settings.category.'+id),
			open: data.open != undefined ? !!data.open : id === 'general',
			items: {}
		}
	},
	open(options = 0) {
		for (var sett in settings) {
			if (settings.hasOwnProperty(sett)) {
				Settings.old[sett] = settings[sett].value
			}
		}
		showDialog('settings')

		setSettingsTab(options.tab || 'setting');

		if (options.search) {
			$('dialog#settings div.search_bar input').val(options.search);
			if (options.tab == 'keybindings') {
				Keybinds.updateSearch()
			} else {
				Settings.updateSearch()
			}
		}
	},
	saveLocalStorages() {
		var settings_copy = {}
		for (var key in settings) {
			settings_copy[key] = {value: settings[key].value}
		}
		localStorage.setItem('settings', JSON.stringify(settings_copy) )

		localStorage.setItem('canvas_scenes', JSON.stringify(canvas_scenes))
		localStorage.setItem('colors', JSON.stringify({
			palette: ColorPanel.vue._data.palette,
			history: ColorPanel.vue._data.history,
		}))
	},
	save() {
		Settings.saveLocalStorages()
		function hasSettingChanged(id) {
			return (settings[id].value !== Settings.old[id])
		}
		hideDialog()
		updateSelection()

		for (var key in BarItems) {
			var action = BarItems[key]
			if (action.linked_setting) {
				action.toggleLinkedSetting(false)
			}
		}
		if (hasSettingChanged('base_grid') || hasSettingChanged('large_grid') || hasSettingChanged('full_grid') || hasSettingChanged('large_grid_size')
			||hasSettingChanged('large_box') || hasSettingChanged('display_grid') || hasSettingChanged('edit_size')) {
			buildGrid()
		}
		Canvas.outlineMaterial.depthTest = !settings.seethrough_outline.value
		if (hasSettingChanged('brightness')) {
			updateShading()
		}
		for (var id in settings) {
			var setting = settings[id];
			if (setting.onChange && hasSettingChanged(id)) {
				setting.onChange(setting.value);
			}
		}
		Blockbench.dispatchEvent('update_settings');
	},
	updateSearch() {
		var term = Settings.vue._data.search_term = $('input#settings_search_bar').val().toLowerCase();
		var structure = Settings.structure;
		if (term) {
			var keywords = term.replace(/_/g, ' ').split(' ');
			var items = {};
			for (var key in settings) {
				var setting = settings[key];
				if (Condition(setting)) {
					var name = tl('settings.'+key).toLowerCase();
					var desc = tl('settings.'+key+'.desc').toLowerCase();
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
			structure.search_results.items = items
			structure.search_results.hidden = false;
			for (var key in structure) {
				structure[key].open = false
			}
			structure.search_results.open = true;
		} else {
			structure.search_results.hidden = true;
		}
	},
	get(id) {
		if (id && settings[id]) {
			return settings[id].value;
		}
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
					Settings.open({search: 'streamer_mode'})
				}}
			]
		})
	}
}

onVueSetup(function() {
	Settings.structure.search_results = {
		name: tl('dialog.settings.search_results'),
		hidden: true,
		open: true,
		items: {}
	}
	for (var key in settings) {
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
	Settings.vue = new Vue({
		el: 'ul#settingslist',
		data: {
			structure: Settings.structure,
			search_term: ''
		},
		methods: {
			saveSettings() {
				localStorage.setItem('settings', JSON.stringify(settings))
			},
			toggleCategory(category) {
				if (!category.open) {
					for (var ct in Settings.structure) {
						Settings.structure[ct].open = false
					}
				}
				category.open = !category.open
			}
		}
	})
})