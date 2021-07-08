function initializeWebApp() {
	
	$(document.body).on('click', 'a[href]', (event) => {
		event.preventDefault();
		window.open(event.target.href, '_blank');
	});
	if (!Blockbench.isTouch && !Blockbench.isPWA) {
		$('#web_download_button').show()
	}

	if (Blockbench.browser == 'firefox') {
		document.body.style.imageRendering = 'crisp-edges'
	}
}
try {
	window.matchMedia('(display-mode: standalone)').addEventListener('change', (evt) => {
		if (!Blockbench.isMobile) $('#web_download_button').toggle(!evt.matches);
	});
} catch (err) {
	if (!Blockbench.isMobile) $('#web_download_button').hide();
}

function loadInfoFromURL() {
	if (location.hash.substr(1, 8) == 'session=') {
		EditSession.dialog()
		$('#edit_session_token').val(location.hash.substr(9))
	}

	if (location.hash.substr(1, 2) == 'm=') {
		$.getJSON(`https://blckbn.ch/api/models/${location.hash.substr(3)}`, (model) => {
			Codecs.project.load(model, {path: ''});
		})
	}
}

//Misc
window.onbeforeunload = function() {
	if (Project.saved === false && elements.length > 0) {
		return 'Unsaved Changes';
	} else {
		Blockbench.dispatchEvent('before_closing')
		EditSession.quit()
	}
}
function showSaveDialog(close) {
	var unsaved_textures = 0;
	Texture.all.forEach(function(t) {
		if (!t.saved) {
			unsaved_textures++;
		}
	})
	if ((Project.saved === false && elements.length > 0) || unsaved_textures) {

		var answer = confirm(tl('message.close_warning.web'))
		return answer;
	} else {
		return true;
	}
}

function setupMobilePanelSelector() {
	if (Blockbench.isMobile) {
		Interface.PanelSelectorVue = new Vue({
			el: '#panel_selector_bar',
			data: {
				all_panels: Interface.Panels,
				selected: null,
				modifiers: Pressing.overrides
			},
			computed: {
				panels() {
					let arr = [];
					arr.push({
						icon: '3d_rotation',
						name: tl('data.preview'),
						id: 'preview'
					})
					for (var id in this.all_panels) {
						let panel = this.all_panels[id];
						if (Condition(panel.condition)) {
							arr.push(panel)
						}
					}
					return arr;
				}
			},
			methods: {
				select(panel) {
					this.selected = panel && panel.id;
					let overlay = $('#mobile_panel_overlay');
					$('#left_bar').append(overlay.children());
					if (panel instanceof Panel) {
						overlay.append(panel.node);
						overlay.show();
						$(panel.node).show();
						if (panel.onResize) panel.onResize();
					} else {
						overlay.hide();
					}
				},
				openKeyboardMenu(event) {
					let menu = new Menu([
						{icon: Pressing.overrides.ctrl ? 'check_box' : 'check_box_outline_blank', name: 'keys.ctrl', click() {Pressing.overrides.ctrl = !Pressing.overrides.ctrl}},
						{icon: Pressing.overrides.shift ? 'check_box' : 'check_box_outline_blank', name: 'keys.shift', click() {Pressing.overrides.shift = !Pressing.overrides.shift}},
						{icon: Pressing.overrides.alt ? 'check_box' : 'check_box_outline_blank', name: 'keys.alt', click() {Pressing.overrides.alt = !Pressing.overrides.alt}},
						'_',
						{icon: 'clear_all', name: 'menu.mobile_keyboard.disable_all', condition: () => {
							let {length} = [Pressing.overrides.ctrl, Pressing.overrides.shift, Pressing.overrides.alt].filter(key => key);
							return length;
						}, click() {
							Pressing.overrides.ctrl = false; Pressing.overrides.shift = false; Pressing.overrides.alt = false;
						}},
					])
					menu.open(this.$refs.mobile_keyboard_menu)
				}
			},
			template: `
				<div id="panel_selector_bar">
					<div class="panel_selector" :class="{selected: selected == null}" @click="select(null)">
						<div class="icon_wrapper"><i class="material-icons icon">3d_rotation</i></div>
					</div>
					<div class="panel_selector" :class="{selected: selected == panel.id}" v-for="panel in all_panels" v-if="Condition(panel.condition)" @click="select(panel)">
						<div class="icon_wrapper" v-html="Blockbench.getIconNode(panel.icon).outerHTML"></div>
					</div>
					<div id="mobile_keyboard_menu" @click="openKeyboardMenu($event)" ref="mobile_keyboard_menu" :class="{enabled: modifiers.ctrl || modifiers.shift || modifiers.alt}">
						<i class="material-icons">keyboard</i>
					</div>
				</div>`
		})
	}
}
