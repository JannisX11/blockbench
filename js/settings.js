var settings, settings_old, display_presets;

settingSetup()
displayPresetsSetup()

function settingSetup() {
	settings_old = {}
	settings = {
		//General
		language:			{value: 'en', type: 'select', options: Language.options},
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
		outliner_colors:	{category: 'preview', value: true}, 
		texture_fps:  		{category: 'preview', value: 2, type: 'number'},
		display_skin: 		{category: 'preview', value: false, type: 'click', condition: isApp, icon: 'icon-player', click: function() { changeDisplaySkin() }},
		//Edit
		undo_limit:   		{category: 'edit', value: 128, type: 'number'},
		restricted_canvas: 	{category: 'edit', value: true},
		limited_rotation: 	{category: 'edit', value: true},
		local_move:   		{category: 'edit', value: true},
		canvas_unselect: 	{category: 'edit', value: false},
		paint_side_restrict:{category: 'edit', value: true},
		image_editor: 		{category: 'edit', value: false, type: 'click', condition: isApp, icon: 'fa-pencil-square', click: function() {changeImageEditor() }},
		//Grid
		base_grid:		{category: 'grid', value: true,},
		large_grid: 	{category: 'grid', value: false},
		full_grid:		{category: 'grid', value: false},
		large_box:		{category: 'grid', value: false},
		display_grid:	{category: 'grid', value: false},
		//Snapping
		edit_size:		{category: 'snapping', value: 16, type: 'number'},
		shift_size: 	{category: 'snapping', value: 64, type: 'number'},
		ctrl_size:		{category: 'snapping', value: 160, type: 'number'},
		negative_size:	{category: 'snapping', value: false},
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
		obj_textures: 	{category: 'export', value: true},
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
}
function displayPresetsSetup() {
	display_presets = [
		{id: 'item', fixed: true, areas: {
				ground: {
					rotation: [ 0, 0, 0 ],
					translation: [ 0, 2, 0],
					scale:[ 0.5, 0.5, 0.5 ]
				},
				head: {
					rotation: [ 0, 180, 0 ],
					translation: [ 0, 13, 7],
					scale:[ 1, 1, 1]
				},
				thirdperson_righthand: {
					rotation: [ 0, 0, 0 ],
					translation: [ 0, 3, 1 ],
					scale: [ 0.55, 0.55, 0.55 ]
				},
				thirdperson_lefthand: {
					rotation: [ 0, 0, 0 ],
					translation: [ 0, 3, 1 ],
					scale: [ 0.55, 0.55, 0.55 ]
				},
				firstperson_righthand: {
					rotation: [ 0, -90, 25 ],
					translation: [ 1.13, 3.2, 1.13],
					scale: [ 0.68, 0.68, 0.68 ]
				},
				firstperson_lefthand: {
					rotation: [ 0, -90, 25 ],
					translation: [ 1.13, 3.2, 1.13],
					scale: [ 0.68, 0.68, 0.68 ]
				},
				fixed: {
					rotation: [ 0, 180, 0 ],
					translation: [ 0, 0, 0 ],
					scale: [ 1, 1, 1 ],
				}
			}
		},
		{id: 'block', fixed: true, areas: {
			gui: {
				rotation: [ 30, 225, 0 ],
				translation: [ 0, 0, 0],
				scale:[ 0.625, 0.625, 0.625 ]
			},
			ground: {
				rotation: [ 0, 0, 0 ],
				translation: [ 0, 3, 0],
				scale:[ 0.25, 0.25, 0.25 ]
			},
			fixed: {
				rotation: [ 0, 0, 0 ],
				translation: [ 0, 0, 0],
				scale:[ 0.5, 0.5, 0.5 ]
			},
			thirdperson_righthand: {
				rotation: [ 75, 45, 0 ],
				translation: [ 0, 2.5, 0],
				scale: [ 0.375, 0.375, 0.375 ]
			},
			thirdperson_lefthand: {
				rotation: [ 75, 45, 0 ],
				translation: [ 0, 2.5, 0],
				scale: [ 0.375, 0.375, 0.375 ]
			},
			firstperson_righthand: {
				rotation: [ 0, 45, 0 ],
				translation: [ 0, 0, 0 ],
				scale: [ 0.40, 0.40, 0.40 ]
			},
			firstperson_lefthand: {
				rotation: [ 0, 225, 0 ],
				translation: [ 0, 0, 0 ],
				scale: [ 0.40, 0.40, 0.40 ]
			}
		}
		},
		{id: 'handheld', fixed: true, areas: {
			thirdperson_righthand: {
				rotation: [ 0, -90, 55 ],
				translation: [ 0, 4.0, 0.5 ],
				scale: [ 0.85, 0.85, 0.85 ]
			},
			thirdperson_lefthand: {
				rotation: [ 0, 90, -55 ],
				translation: [ 0, 4.0, 0.5 ],
				scale: [ 0.85, 0.85, 0.85 ]
			},
			firstperson_righthand: {
				rotation: [ 0, -90, 25 ],
				translation: [ 1.13, 3.2, 1.13 ],
				scale: [ 0.68, 0.68, 0.68 ]
			},
			firstperson_lefthand: {
				rotation: [ 0, 90, -25 ],
				translation: [ 1.13, 3.2, 1.13 ],
				scale: [ 0.68, 0.68, 0.68 ]
			}
		}
		},
		{id: 'rod', fixed: true, areas: {
			thirdperson_righthand: {
				rotation: [ 0, 90, 55 ],
				translation: [ 0, 4.0, 2.5 ],
				scale: [ 0.85, 0.85, 0.85 ]
			},
			thirdperson_lefthand: {
				rotation: [ 0, -90, -55 ],
				translation: [ 0, 4.0, 2.5 ],
				scale: [ 0.85, 0.85, 0.85 ]
			},
			firstperson_righthand: {
				rotation: [ 0, 90, 25 ],
				translation: [ 0, 1.6, 0.8 ],
				scale: [ 0.68, 0.68, 0.68 ]
			},
			firstperson_lefthand: {
				rotation: [ 0, -90, -25 ],
				translation: [ 0, 1.6, 0.8 ],
				scale: [ 0.68, 0.68, 0.68 ]
			}
		}
		}
	]
	if (localStorage.getItem('display_presets') != null) {
		var stored_display_presets = JSON.parse(localStorage.getItem('display_presets'))
		$.extend(display_presets, stored_display_presets)
	}
}

function saveLocalStorages() {
	localStorage.setItem('canvas_scenes', JSON.stringify(canvas_scenes))
	var settings_copy = {}
	for (var key in settings) {
		if (settings.hasOwnProperty(key) && !settings[key].is_title) {
			settings_copy[key] = {value: settings[key].value}
		}
	}
	localStorage.setItem('settings', JSON.stringify(settings_copy) )
}
function openSettings() {
	for (var sett in settings) {
		if (settings.hasOwnProperty(sett)) {
			settings_old[sett] = settings[sett].value
		}
	}
	showDialog('settings')
	setSettingsTab('setting')
}
function saveSettings(force_update) {
	function hasSettingChanged(id) {
		return (settings[id].value !== settings_old[id])
	}
	//setScreenRatio()
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
	/*
	if (hasSettingChanged('focal_length')) {
		previews.forEach(p => {
			p.camPers.setFocalLength(2000/limitNumber(settings.focal_length.value, 10, 200))
		})
	}*/
	if (hasSettingChanged('restricted_canvas') && settings.restricted_canvas.value && Blockbench.entity_mode === false) {
		moveIntoBox(undefined, false)
	}
	Blockbench.dispatchEvent('update_settings')
}
function toggleSetting(setting) {
	if (settings[setting].value === true) {
		settings[setting].value = false
	} else {
		settings[setting].value = true
	}
	saveSettings()
}
function toggleWireframe() {
}

onVueSetup(function() {
	var structure = {}
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
	var settingslist = new Vue({
		el: 'ul#settingslist',
		data: {structure},
		methods: {
			saveSettings: function() {
				localStorage.setItem('settings', JSON.stringify(settings))
			},
			toggleCategory: function(category) {
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
				if (Blockbench.entity_mode && Project.name.length > 0 && !Project.geometry_name) {
					Project.geometry_name = Project.name.toLowerCase().replace(/\s/g, '')
				}
			}
		}
	})
})