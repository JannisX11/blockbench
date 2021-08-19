var osfs = '/'
var prev_side = 'north';
var uv_clipboard;
var pe_list_data = []
var open_dialog = false;
var open_interface = false;
var tex_version = 1;
var pe_list;
const Pressing = {
	shift: false,
	ctrl: false,
	alt: false,
	overrides: {
		shift: false,
		ctrl: false,
		alt: false,
	}
}
var Prop = {
	active_panel	: 'preview',
	view_mode	  	: 'textured',
	file_path	  	: '',
	file_name	  	: '',
	added_models 	: 0,
	recording		: null,
	fps				: 0,
	progress		: 0,
	session 		: false,
	connections 	: 0,
	facing		 	: 'north',
	show_right_bar  : true,
	show_left_bar   : true,
}

const mouse_pos = {x:0,y:0}
const sort_collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

function canvasGridSize(shift, ctrl) {
	if (!shift && !ctrl) {
		return 16 / Math.clamp(settings.edit_size.value, 1, 512)
	} else if (ctrl && shift) {
		return 16 / Math.clamp(settings.ctrl_shift_size.value, 1, 4096)
	} else if (ctrl) {
		return 16 / Math.clamp(settings.ctrl_size.value, 1, 4096)
	} else {
		return 16 / Math.clamp(settings.shift_size.value, 1, 4096)
	}
}
function updateNslideValues() {

	if (Outliner.selected.length) {
		BarItems.slider_pos_x.update()
		BarItems.slider_pos_y.update()
		BarItems.slider_pos_z.update()

		BarItems.slider_size_x.update()
		BarItems.slider_size_y.update()
		BarItems.slider_size_z.update()

		BarItems.slider_inflate.update()

		if (!Project.box_uv) {
			BarItems.slider_face_tint.update()
		}
	}
	if (Outliner.selected.length || (Format.bone_rig && Group.selected)) {
		BarItems.slider_origin_x.update()
		BarItems.slider_origin_y.update()
		BarItems.slider_origin_z.update()

		BarItems.slider_rotation_x.update()
		BarItems.slider_rotation_y.update()
		BarItems.slider_rotation_z.update()
		if (Format.bone_rig) {
			BarItems.bone_reset_toggle.setIcon(Group.selected && Group.selected.reset ? 'check_box' : 'check_box_outline_blank')
		} else {
			BarItems.rescale_toggle.setIcon(Outliner.selected[0].rescale ? 'check_box' : 'check_box_outline_blank')
		}
	}
	if (Modes.animate && NullObject.selected[0]) {
		BarItems.slider_ik_chain_length.update();
		BarItems.ik_enabled.setIcon(NullObject.selected[0].ik_enabled ? 'check_box' : 'check_box_outline_blank')
	}
	if (Texture.all.length) {
		BarItems.animated_texture_frame.update();
	}
}

//Selections
function updateSelection(options = {}) {
	elements.forEach(obj => {
		if (selected.includes(obj) && !obj.selected && !obj.locked) {
			obj.selectLow()
		} else if ((!selected.includes(obj) || obj.locked) && obj.selected) {
			obj.unselect()
		}
	})
	if (Group.selected && Group.selected.locked) Group.selected.unselect()

	Cube.all.forEach(cube => {
		if (cube.visibility) {
			var mesh = cube.mesh
			if (mesh && mesh.outline) {
				mesh.outline.visible = cube.selected
			}
		}
	})
	for (var i = Cube.selected.length-1; i >= 0; i--) {
		if (!selected.includes(Cube.selected[i])) {
			Cube.selected.splice(i, 1)
		}
	}
	if (Cube.selected.length) {
		document.querySelectorAll('.selection_only').forEach(node => node.style.setProperty('visibility', 'visible'));
	} else {
		if (Format.bone_rig && Group.selected) {
			document.querySelectorAll('.selection_only').forEach(node => node.style.setProperty('visibility', 'hidden'));
			document.querySelectorAll('.selection_only#element').forEach(node => node.style.setProperty('visibility', 'visible'));
		} else {
			document.querySelectorAll('.selection_only').forEach(node => node.style.setProperty('visibility', 'hidden'));
			if (Outliner.selected.length) {
				document.querySelectorAll('.selection_only#element').forEach(node => node.style.setProperty('visibility', 'visible'));
			}
		}
		if (Group.selected || NullObject.selected[0]) {
			document.querySelectorAll('.selection_only#bone').forEach(node => node.style.setProperty('visibility', 'visible'));
		}
		if (Format.single_texture && Modes.paint) {
			document.querySelectorAll('.selection_only#uv').forEach(node => node.style.setProperty('visibility', 'visible'));
		}
	}
	if (Outliner.selected.length || (Format.single_texture && Modes.paint)) {
		UVEditor.loadData()
	}
	if (Modes.animate) {
		updateKeyframeSelection();
		if (Timeline.selected_animator && !Timeline.selected_animator.selected) {
			Timeline.selected_animator = null;
		}
	}

	BarItems.cube_counter.update();
	updateNslideValues();
	if (settings.highlight_cubes.value) updateCubeHighlights();
	Canvas.updateOrigin();
	Transformer.updateSelection();
	Transformer.update();
	Preview.all.forEach(preview => {
		preview.updateAnnotations();
	})

	BARS.updateConditions();
	delete TickUpdates.selection;
	Blockbench.dispatchEvent('update_selection');
}
function selectAll() {
	if (Modes.animate) {
		selectAllKeyframes()
	} else if (Prop.active_panel == 'uv') {
		UVEditor.selectAll()

	} else if (Modes.edit || Modes.paint) {
		if (Outliner.selected.length < Outliner.elements.length) {
			if (Outliner.root.length == 1) {
				Outliner.root[0].select();
			} else {
				Outliner.elements.forEach(obj => {
					obj.selectLow()
				})
				TickUpdates.selection = true;
			}
		} else {
			unselectAll()
		}
	}
	Blockbench.dispatchEvent('select_all')
}
function unselectAll() {
	selected.forEachReverse(obj => obj.unselect())
	if (Group.selected) Group.selected.unselect()
	Group.all.forEach(function(s) {
		s.selected = false
	})
	TickUpdates.selection = true;
}
//Backup
setInterval(function() {
	if (Project && (Outliner.root.length || Project.textures.length)) {
		try {
			var model = Codecs.project.compile({compressed: false, backup: true});
			localStorage.setItem('backup_model', model)
		} catch (err) {
			console.log('Unable to create backup. ', err)
		}
	}
}, 1e3*30)
//Misc
const TickUpdates = {
	Run() {
		try {
			if (TickUpdates.selection) {
				delete TickUpdates.selection;
				updateSelection()
			}
			if (TickUpdates.UVEditor) {
				delete TickUpdates.UVEditor;
				UVEditor.loadData()
			}
			if (TickUpdates.texture_list) {
				delete TickUpdates.texture_list;
				loadTextureDraggable();
			}
			if (TickUpdates.keyframe_selection) {
				delete TickUpdates.keyframe_selection;
				Vue.nextTick(updateKeyframeSelection)
			}
			if (TickUpdates.keybind_conflicts) {
				delete TickUpdates.keybind_conflicts;
				updateKeybindConflicts();
			}
		} catch (err) {
			console.error(err);
		}
	}
}

const documentReady = new Promise((resolve, reject) => {
	$(document).ready(function() {
		resolve()
	})
});


BARS.defineActions(() => {
	
	new Action('about_window', {
		name: tl('dialog.settings.about') + '...',
		icon: 'info',
		category: 'blockbench',
		click: function () {
			const data = {
				isApp,
				version_label: Blockbench.version
			};
			jQuery.ajax({
				url: 'https://api.github.com/repos/JannisX11/blockbench/releases/latest',
				cache: false,
				type: 'GET',
				success(release) {
					let v = release.tag_name.replace(/^v/, '');
					if (compareVersions(v, Blockbench.version)) {
						data.version_label = `${Blockbench.version} (${tl('about.version.update_available', [v])})`;
					} else if (compareVersions(Blockbench.version, v)) {
						data.version_label = `${Blockbench.version} (Pre-release)`;
					} else {
						data.version_label = `${Blockbench.version} (${tl('about.version.up_to_date')}😄)`;
					}
				},
				error(err) {}
			})

			new Dialog({
				id: 'about',
				title: 'dialog.settings.about',
				width: 600,
				singleButton: true,
				title_menu: new Menu([
					'settings_window',
					'keybindings_window',
					'theme_window',
					'about_window',
				]),
				component: {
					data() {return data},
					template: `
						<div>
							<div id="about_page_title">
								<img src="assets/logo_text_white.svg" width="240px">
							</div>
							<p><b>${tl('about.version')}</b> <span>{{ version_label }}</span></p>
							<p><b>${tl('about.creator')}</b> JannisX11</p>
							<p><b>${tl('about.website')}</b> <a class="open-in-browser" href="https://blockbench.net">blockbench.net</a></p>
							<p><b>${tl('about.repository')}</b> <a class="open-in-browser" href="https://github.com/JannisX11/blockbench">github.com/JannisX11/blockbench</a></p>
							<p>${tl('about.vertex_snap')}</p>
							<p><b>${tl('about.icons')}</b> <a href="https://material.io/icons/" class="open-in-browser">material.io/icons</a> &amp; <a href="https://fontawesome.io/icons/" class="open-in-browser">fontawesome</a></p>
							<p><b>${tl('about.libraries')}</b>
								<a class="open-in-browser" href="https://electronjs.org">Electron</a>,
								<a class="open-in-browser" href="https://vuejs.org">Vue</a>,
								<a class="open-in-browser" href="https://github.com/weibangtuo/vue-tree">Vue Tree</a>,
								<a class="open-in-browser" href="https://github.com/sagalbot/vue-sortable">Vue Sortable</a>,
								<a class="open-in-browser" href="https://threejs.org">ThreeJS</a>,
								<a class="open-in-browser" href="https://github.com/lo-th/fullik">Full IK</a>,
								<a class="open-in-browser" href="https://github.com/oliver-moran/jimp">Jimp</a>,
								<a class="open-in-browser" href="https://bgrins.github.io/spectrum">Spectrum</a>,
								<a class="open-in-browser" href="https://github.com/jnordberg/gif.js">gif.js</a>,
								<a class="open-in-browser" href="https://stuk.github.io/jszip/">JSZip</a>,
								<a class="open-in-browser" href="https://github.com/rotemdan/lzutf8.js">LZ-UTF8</a>,
								<a class="open-in-browser" href="https://jquery.com">jQuery</a>,
								<a class="open-in-browser" href="https://jqueryui.com">jQuery UI</a>,
								<a class="open-in-browser" href="https://github.com/furf/jquery-ui-touch-punch">jQuery UI Touch Punch</a>,
								<a class="open-in-browser" href="https://github.com/eligrey/FileSaver.js">FileSaver.js</a>,
								<a class="open-in-browser" href="https://peerjs.com">PeerJS</a>,
								<a class="open-in-browser" href="https://github.com/markedjs/marked">Marked</a>,
								<a class="open-in-browser" href="https://prismjs.com">Prism</a>,
								<a class="open-in-browser" href="https://github.com/koca/vue-prism-editor">Vue Prism Editor</a>,
								<a class="open-in-browser" href="https://github.com/JannisX11/molangjs">MolangJS</a>,
								<a class="open-in-browser" href="https://github.com/JannisX11/wintersky">Wintersky</a>
							</p>
						</div>`
				}
			}).show()
		}
	})
})

const entityMode = {
	hardcodes: JSON.parse('{"geometry.chicken":{"body":{"rotation":[90,0,0]}},"geometry.llama":{"chest1":{"rotation":[0,90,0]},"chest2":{"rotation":[0,90,0]},"body":{"rotation":[90,0,0]}},"geometry.cow":{"body":{"rotation":[90,0,0]}},"geometry.sheep.sheared":{"body":{"rotation":[90,0,0]}},"geometry.sheep":{"body":{"rotation":[90,0,0]}},"geometry.phantom":{"body":{"rotation":[0,0,0]},"wing0":{"rotation":[0,0,5.7]},"wingtip0":{"rotation":[0,0,5.7]},"wing1":{"rotation":[0,0,-5.7]},"wingtip1":{"rotation":[0,0,-5.7]},"head":{"rotation":[11.5,0,0]},"tail":{"rotation":[0,0,0]},"tailtip":{"rotation":[0,0,0]}},"geometry.pig":{"body":{"rotation":[90,0,0]}},"geometry.ocelot":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.cat":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.turtle":{"eggbelly":{"rotation":[90,0,0]},"body":{"rotation":[90,0,0]}},"geometry.villager.witch":{"hat2":{"rotation":[-3,0,1.5]},"hat3":{"rotation":[-6,0,3]},"hat4":{"rotation":[-12,0,6]}},"geometry.pufferfish.mid":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.pufferfish.large":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.tropicalfish_a":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}},"geometry.tropicalfish_b":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}}}')
}
