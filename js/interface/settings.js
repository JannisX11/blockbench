var settings;

const Settings = {
	setup() {
		settings = {
			//General
			language:			{value: 'en', type: 'select', options: Language.options},
			username:       	{value: '', type: 'text'},
			recent_projects:	{value: 12, max: 128, min: 0, type: 'number', condition: isApp},
			backup_interval:	{value: 10, type: 'number', condition: isApp},
			backup_retain:		{value: 30, type: 'number', condition: isApp},
			//Preview 
			origin_size: 		{category: 'preview', value: 10, type: 'number'},
			control_size: 		{category: 'preview', value: 10, type: 'number'},
				//focal_length: 		{category: 'preview', value: 70, type: 'number'},
			seethrough_outline:	{category: 'preview', value: false},
			brightness: 		{category: 'preview', value: 50, type: 'number'},
			shading:	  		{category: 'preview', value: true}, 
			transparency: 		{category: 'preview', value: true}, 
			outliner_colors:	{category: 'preview', value: false}, 
			texture_fps:  		{category: 'preview', value: 2, type: 'number'},
			volume: 	  		{category: 'preview', value: 80, type: 'number'},
			display_skin: 		{category: 'preview', value: false, type: 'click', condition: isApp, icon: 'icon-player', click: function() { changeDisplaySkin() }},
			//Edit
			undo_limit:   		{category: 'edit', value: 128, type: 'number'},
			local_move:   		{category: 'edit', value: true},
			canvas_unselect: 	{category: 'edit', value: false},
			paint_side_restrict:{category: 'edit', value: true},
			image_editor: 		{category: 'edit', value: false, type: 'click', condition: isApp, icon: 'fas.fa-pen-square', click: function() {changeImageEditor(null, true) }},
			//Grid
			base_grid:		{category: 'grid', value: true,},
			large_grid: 	{category: 'grid', value: false},
			full_grid:		{category: 'grid', value: false},
			large_box:		{category: 'grid', value: false},
			display_grid:	{category: 'grid', value: false},
			painting_grid:	{category: 'grid', value: true},
			//Snapping
			edit_size:		{category: 'snapping', value: 16, type: 'number'},
			shift_size: 	{category: 'snapping', value: 64, type: 'number'},
			ctrl_size:		{category: 'snapping', value: 160, type: 'number'},
			negative_size:	{category: 'snapping', value: false},
			animation_snap:	{category: 'snapping', value: 25, type: 'number'},
			//Defaults
			autouv:	   		{category: 'defaults', value: true},
			create_rename: 	{category: 'defaults', value: false},
			default_path: 	{category: 'defaults', value: false, type: 'click', condition: isApp, icon: 'burst_mode', click: function() { openDefaultTexturePath() }},
			//Dialogs
			dialog_unsaved_textures:{category: 'dialogs', value: true},
			dialog_larger_cubes:	{category: 'dialogs', value: true},
			dialog_rotation_limit:	{category: 'dialogs', value: true},
			//Export
			minifiedout:  	{category: 'export', value: false},
			export_groups:	{category: 'export', value: true},
			sketchfab_token:{category: 'export', value: '', type: 'text'},
			credit: 		{category: 'export', value: 'Made with Blockbench', type: 'text'},
		}

		if (localStorage.getItem('settings') != null) {
			var stored_settings = JSON.parse(localStorage.getItem('settings'))
			for (var key in stored_settings) {
				if (stored_settings.hasOwnProperty(key) && !stored_settings[key].is_title && settings.hasOwnProperty(key)) {
					settings[key].value = stored_settings[key].value
				}
			}
			if (settings.edit_size.value < 3) {
				settings.edit_size.value = 16
			}
		}
	},
	open() {
		for (var sett in settings) {
			if (settings.hasOwnProperty(sett)) {
				Settings.old[sett] = settings[sett].value
			}
		}
		showDialog('settings')
		setSettingsTab('setting')
	},
	saveLocalStorages() {
		localStorage.setItem('canvas_scenes', JSON.stringify(canvas_scenes))
		var settings_copy = {}
		for (var key in settings) {
			if (settings.hasOwnProperty(key) && !settings[key].is_title) {
				settings_copy[key] = {value: settings[key].value}
			}
		}
		localStorage.setItem('settings', JSON.stringify(settings_copy) )
	},
	save() {
		function hasSettingChanged(id) {
			return (settings[id].value !== Settings.old[id])
		}
		hideDialog()
		updateUIColor()
		updateSelection()

		for (var key in BarItems) {
			var action = BarItems[key]
			if (action.linked_setting) {
				action.toggleLinkedSetting(false)
			}
		}
		if (hasSettingChanged('base_grid') || hasSettingChanged('large_grid') || hasSettingChanged('full_grid')
			||hasSettingChanged('large_box') || hasSettingChanged('display_grid') || hasSettingChanged('edit_size')) {
			buildGrid()
		}
		if (hasSettingChanged('painting_grid')) {
			Cube.all.forEach(cube => {
				Canvas.buildGridBox(cube)
			})
		}
		if (hasSettingChanged('transparency')) {
			for (var mat in Canvas.materials) {
				if (Canvas.materials.hasOwnProperty(mat)) {
					Canvas.materials[mat].transparent = settings.transparency.value
				}
			}
		}
		Canvas.outlineMaterial.depthTest = !settings.seethrough_outline.value
		if (hasSettingChanged('shading') || hasSettingChanged('brightness')) {
			setShading()
		}
		if (hasSettingChanged('texture_fps')) {
			TextureAnimator.updateSpeed()
		}
		Blockbench.dispatchEvent('update_settings');
	},
	updateSearch() {
		var term = Settings.vue._data.search_term = $('input#settings_search_bar').val().toLowerCase();
		var structure = Settings.vue._data.structure;
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
	old: {}
}
$(window).on('unload', Settings.saveLocalStorages)
Settings.setup()

onVueSetup(function() {
	var structure = {
		search_results: {
			name: tl('dialog.settings.search_results'),
			hidden: true,
			open: true,
			items: {}
		}
	}
	for (var key in settings) {
		var category = settings[key].category
		if (!category) category = 'general'

		if (!structure[category]) {
			structure[category] = {
				name: tl('settings.category.'+category),
				open: category === 'general',
				items: {}
			}
		}
		structure[category].items[key] = settings[key]
	}
	Settings.vue = new Vue({
		el: 'ul#settingslist',
		data: {
			structure,
			search_term: ''
		},
		methods: {
			saveSettings() {
				localStorage.setItem('settings', JSON.stringify(settings))
			},
			toggleCategory(category) {
				if (!category.open) {
					for (var ct in structure) {
						structure[ct].open = false
					}
				}
				category.open = !category.open
			}
		}
	})
	var project_vue = new Vue({
		el: '#project_settings',
		data: {Project},
		methods: {
			syncGeometry: function() {
				if (Blockbench.bone_rig && Project.name.length > 0 && !Project.geometry_name) {
					Project.geometry_name = Project.name.toLowerCase().replace(/\s/g, '')
				}
			}
		}
	})
})