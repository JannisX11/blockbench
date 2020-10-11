(function() {
	$.getScript("lib/file_saver.js");
	$.getScript('https://rawgit.com/nodeca/pako/master/dist/pako.min.js', function() {
		window.zlib = pako
	})
})()

function initializeWebApp() {
	
	$(document.body).on('click', 'a[href]', (event) => {
		event.preventDefault();
		window.open(event.target.href, '_blank');
	});
	if (!Blockbench.isMobile) {
		$('#web_download_button').show()
	}

	if (Blockbench.browser == 'firefox') {
		document.body.style.imageRendering = 'crisp-edges'
	}
}

function loadInfoFromURL() {
	if (location.hash.substr(1, 8) == 'session=') {
		EditSession.dialog()
		$('#edit_session_token').val(location.hash.substr(9))
	}
	if (location.hash.substr(1, 5) == 'load=') {
		$.getJSON('https://blockbench.net/api/rawtext.php?url='+location.hash.substr(6), (model) => {
			if (showSaveDialog()) {
				resetProject();
				Codecs.project.load(model, {path: ''});
			}
		})
	} else if (location.hash.substr(1, 5) == 'pbin=') {
		$.getJSON('https://blockbench.net/api/rawtext.php?url='+'https://pastebin.com/raw/'+location.hash.substr(6), (model) => {
			if (showSaveDialog()) {
				resetProject();
				Codecs.project.load(model, {path: ''});
			}
		})
	}
}

setInterval(function() {
	Prop.zoom = Math.round(devicePixelRatio*100)
}, 500)

//Misc
window.onbeforeunload = function() {
	if (Prop.project_saved === false && elements.length > 0) {
		return 'Unsaved Changes';
	} else {
		Blockbench.dispatchEvent('before_closing')
		EditSession.quit()
	}
}
function showSaveDialog(close) {
	var unsaved_textures = 0;
	textures.forEach(function(t) {
		if (!t.saved) {
			unsaved_textures++;
		}
	})
	if ((Prop.project_saved === false && elements.length > 0) || unsaved_textures) {

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
							console.log(id)
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
						if (panel.onResize) panel.onResize();
						overlay.show();
					} else {
						overlay.hide();
					}
				}
			}
		})
	}
}
