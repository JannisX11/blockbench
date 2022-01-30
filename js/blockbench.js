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
	_active_panel	: 'preview',
	get active_panel() {
		return Prop._active_panel
	},
	set active_panel(panel) {
		let last_panel = Prop._active_panel;
		if (last_panel != panel) {
			Prop._active_panel = panel;
			Blockbench.dispatchEvent('change_active_panel', {last_panel, panel})
		}
	},
	file_path	  	: '',
	file_name	  	: '',
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
	if (Texture.all.length) {
		BarItems.animated_texture_frame.update();
	}
}

//Selections
function updateSelection(options = {}) {
	Outliner.elements.forEach(obj => {
		if (selected.includes(obj) && !obj.selected && !obj.locked) {
			obj.selectLow()
		} else if ((!selected.includes(obj) || obj.locked) && obj.selected) {
			obj.unselect()
		}
		if (obj instanceof Mesh) {
			if (Project.selected_vertices[obj.uuid]) {
				Project.selected_vertices[obj.uuid].forEachReverse(vkey => {
					if (vkey in obj.vertices == false) {
						Project.selected_vertices[obj.uuid].remove(vkey);
					}
				})
			}
			if (Project.selected_vertices[obj.uuid] && (Project.selected_vertices[obj.uuid].length == 0 || !obj.selected)) {
				delete Project.selected_vertices[obj.uuid];
			}
		}
	})
	if (Group.selected && Group.selected.locked) Group.selected.unselect()
	UVEditor.vue._computedWatchers.mappable_elements.run();

	Outliner.elements.forEach(element => {
		if (element.preview_controller.updateSelection) {
			element.preview_controller.updateSelection(element);
		}
	})
	for (var i = Outliner.selected.length-1; i >= 0; i--) {
		if (!selected.includes(Outliner.selected[i])) {
			Outliner.selected.splice(i, 1)
		}
	}
	if (Outliner.selected.length) {
		document.querySelectorAll('.selection_only').forEach(node => node.style.setProperty('visibility', 'visible'));
		if (Modes.edit && Toolbox.selected.id == 'resize_tool' && Format.meshes) {
			if (Mesh.selected.length) {
				Interface.removeSuggestedModifierKey('alt', 'modifier_actions.resize_both_sides');
				Interface.addSuggestedModifierKey('alt', 'modifier_actions.resize_one_side');
			} else {
				Interface.removeSuggestedModifierKey('alt', 'modifier_actions.resize_one_side');
				Interface.addSuggestedModifierKey('alt', 'modifier_actions.resize_both_sides');
			}
		}
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
		UVEditor.selected_faces.forEachReverse((fkey, i) => {
			if (!UVEditor.getMappableElements().find(el => el.faces[fkey])) {
				UVEditor.selected_faces.splice(i, 1);
			}
		})
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
	Interface.status_bar.vue.updateSelectionInfo();
	if (settings.highlight_cubes.value || (Mesh.all[0])) updateCubeHighlights();
	Canvas.updatePivotMarker();
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

	} else if (Modes.edit && Mesh.selected.length && Mesh.selected.length === Outliner.selected.length && BarItems.selection_mode.value !== 'object') {
		let unselect = Mesh.selected[0].getSelectedVertices().length == Object.keys(Mesh.selected[0].vertices).length;
		Mesh.selected.forEach(mesh => {
			if (unselect) {
				delete Project.selected_vertices[mesh.uuid];
			} else {
				mesh.getSelectedVertices(true).replace(Object.keys(mesh.vertices));
			}
		})
		updateSelection();

	} else if (Modes.edit || Modes.paint) {
		if (Outliner.selected.length < Outliner.elements.length) {
			if (Outliner.root.length == 1 && !Outliner.root[0].locked) {
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
	Project.selected_elements.forEachReverse(obj => obj.unselect())
	if (Group.selected) Group.selected.unselect()
	Group.all.forEach(function(s) {
		s.selected = false
	})
	for (let key in Project.selected_vertices) {
		delete Project.selected_vertices[key];
	}
	TickUpdates.selection = true;
}
//Backup
setInterval(function() {
	if (Project && (Outliner.root.length || Project.textures.length)) {
		try {
			var model = Codecs.project.compile({compressed: false, minify: true, backup: true});
			localStorage.setItem('backup_model', model)
		} catch (err) {
			console.error('Unable to create backup. ', err)
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
		description: `Blockbench ${Blockbench.version}`,
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
				width: 640,
				title_menu: new Menu([
					'settings_window',
					'keybindings_window',
					'theme_window',
					'about_window',
				]),
				buttons: [],
				component: {
					data() {return data},
					template: `
						<div>
							<div class="blockbench_logo" id="about_page_title">
								<img src="assets/logo_text_white.svg" alt="Blockbench" width="340px">
							</div>
							<p>Version <span>{{ version_label }}</span></p>

							<div class="socials">
								<a class="open-in-browser" href="https://blockbench.net">
									<i class="icon icon-blockbench_inverted" style="transform: scale(1.3);"></i>
									<label>Website</label>
								</a>
								<a class="open-in-browser" href="https://twitter.com/blockbench">
									<i class="icon fab fa-twitter" style="color: #1ea6ff;"></i>
									<label>Twitter</label>
								</a>
								<a class="open-in-browser" href="https://discord.blockbench.net">
									<i class="icon fab fa-discord" style="color: #727fff;"></i>
									<label>Discord</label>
								</a>
								<a class="open-in-browser" href="https://youtube.com/Blockbench3D">
									<i class="icon fab fa-youtube" style="color: #ff4444;"></i>
									<label>YouTube</label>
								</a>
								<a class="open-in-browser" href="https://github.com/JannisX11/blockbench">
									<i class="icon fab fa-github" style="color: #dddddd;"></i>
									<label>GitHub</label>
								</a>
								<a class="open-in-browser" href="https://blockbench.net/wiki">
								<i class="icon material-icons">menu_book</i>
									<label>Wiki</label>
								</a>
							</div>

							<p>Created by Jannis Petersen</p>
							<p style="color: var(--color-subtle_text);">A free and open-source low-poly model editor. To make 3D art easy and accessible for everyone.
								For all who enjoy stylied 3D art. For game developers, students, content creators, and for the Minecraft community.</p>

							<h4>SPECIAL THANKS TO</h4>
							<ul class="multi_column_list">
								<li>Mojang Studios</li>
								<li>The community moderators</li>
								<li>The Sketchfab team</li>
								<li>All donators</li>
								<li>All contributors</li>
								<li>All educators</li>
								<li>Wacky</li>
								<li>Ewan Howell and Lukas</li>
								<li>Sultan Taha and Kanno</li>
								<li>SirBenet</li>
								<li>The Blockbench Community</li>
							</ul>

							<h4>FRAMEWORKS, LIBRARIES, AND ICONS</h4>

							<p style="margin-bottom: 16px" v-if="isApp">This program is powered by <a class="open-in-browser" href="https://electronjs.org">Electron</a></p>

							<ul class="multi_column_list">
								<li><a class="open-in-browser" href="https://material.io/icons/">Material Icons</a></li>
								<li><a class="open-in-browser" href="https://fontawesome.com/icons//">Font Awesome</a></li>
								<li><a class="open-in-browser" href="https://electronjs.org">Electron</a></li>
								<li><a class="open-in-browser" href="https://vuejs.org">Vue</a></li>
								<li><a class="open-in-browser" href="https://github.com/weibangtuo/vue-tree">Vue Tree</a></li>
								<li><a class="open-in-browser" href="https://github.com/sagalbot/vue-sortable">Vue Sortable</a></li>
								<li><a class="open-in-browser" href="https://threejs.org">ThreeJS</a></li>
								<li><a class="open-in-browser" href="https://github.com/lo-th/fullik">Full IK</a></li>
								<li><a class="open-in-browser" href="https://github.com/oliver-moran/jimp">Jimp</a></li>
								<li><a class="open-in-browser" href="https://bgrins.github.io/spectrum">Spectrum</a></li>
								<li><a class="open-in-browser" href="https://github.com/stijlbreuk/vue-color-picker-wheel">Vue Color Picker Wheel</a></li>
								<li><a class="open-in-browser" href="https://github.com/jnordberg/gif.js">gif.js</a></li>
								<li><a class="open-in-browser" href="https://stuk.github.io/jszip/">JSZip</a></li>
								<li><a class="open-in-browser" href="https://github.com/rotemdan/lzutf8.js">LZ-UTF8</a></li>
								<li><a class="open-in-browser" href="https://jquery.com">jQuery</a></li>
								<li><a class="open-in-browser" href="https://jqueryui.com">jQuery UI</a></li>
								<li><a class="open-in-browser" href="https://github.com/furf/jquery-ui-touch-punch">jQuery UI Touch Punch</a></li>
								<li><a class="open-in-browser" href="https://github.com/eligrey/FileSaver.js">FileSaver.js</a></li>
								<li><a class="open-in-browser" href="https://peerjs.com">PeerJS</a></li>
								<li><a class="open-in-browser" href="https://github.com/markedjs/marked">Marked</a></li>
								<li><a class="open-in-browser" href="https://prismjs.com">Prism</a></li>
								<li><a class="open-in-browser" href="https://github.com/koca/vue-prism-editor">Vue Prism Editor</a></li>
								<li><a class="open-in-browser" href="https://github.com/JannisX11/molangjs">MolangJS</a></li>
								<li><a class="open-in-browser" href="https://github.com/JannisX11/wintersky">Wintersky</a></li>
							</ul>


							<p style="margin-top: 20px">Published under the <a class="open-in-browser" href="https://github.com/JannisX11/blockbench/blob/master/LICENSE.MD">GPL 3.0 license</a></p>
							<p><a class="open-in-browser" href="https://www.blockbench.net/privacy-policy">Privacy Policy</a></p>

						</div>`
				}
			}).show()
		}
	})
})

const entityMode = {
	hardcodes: JSON.parse('{"geometry.chicken":{"body":{"rotation":[90,0,0]}},"geometry.llama":{"chest1":{"rotation":[0,90,0]},"chest2":{"rotation":[0,90,0]},"body":{"rotation":[90,0,0]}},"geometry.cow":{"body":{"rotation":[90,0,0]}},"geometry.sheep.sheared":{"body":{"rotation":[90,0,0]}},"geometry.sheep":{"body":{"rotation":[90,0,0]}},"geometry.phantom":{"body":{"rotation":[0,0,0]},"wing0":{"rotation":[0,0,5.7]},"wingtip0":{"rotation":[0,0,5.7]},"wing1":{"rotation":[0,0,-5.7]},"wingtip1":{"rotation":[0,0,-5.7]},"head":{"rotation":[11.5,0,0]},"tail":{"rotation":[0,0,0]},"tailtip":{"rotation":[0,0,0]}},"geometry.pig":{"body":{"rotation":[90,0,0]}},"geometry.ocelot":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.cat":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.turtle":{"eggbelly":{"rotation":[90,0,0]},"body":{"rotation":[90,0,0]}},"geometry.villager.witch":{"hat2":{"rotation":[-3,0,1.5]},"hat3":{"rotation":[-6,0,3]},"hat4":{"rotation":[-12,0,6]}},"geometry.pufferfish.mid":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.pufferfish.large":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.tropicalfish_a":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}},"geometry.tropicalfish_b":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}}}')
}
