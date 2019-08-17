(function() {
	$.getScript("lib/file_saver.js");
	$.getScript('https://rawgit.com/nodeca/pako/master/dist/pako.js', function() {
		window.zlib = pako
	})
})()

$(document).ready(function() {
	
	$(document.body).on('click', 'a[href]', (event) => {
		event.preventDefault();
		window.open(event.target.href, '_blank');
	});
	if (!Blockbench.isMobile) {
		$('#web_download_button').show()
	}
	if (location.hash.substr(1, 8) == 'session=') {
		EditSession.dialog()
		$('#edit_session_token').val(location.hash.substr(9))
	}

})
setInterval(function() {
	Prop.zoom = Math.round(devicePixelRatio*100)
}, 500)

//Misc
window.onbeforeunload = function() {
	if (Prop.project_saved === false && elements.length > 0) {
		return 'Unsaved Changes';
	} else {
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
		if (answer == true) {
			return true;
		} else {
			return false;
		}
	} else {
		return true;
	}
}


BARS.defineActions(function() {
	if (Blockbench.isMobile) {
		new Action('sidebar_left', {
			icon: 'burst_mode',
			category: 'view',
			condition: () => !Modes.start,
			click: function () {
				$('#page_wrapper').removeClass('show_right')
				$('#page_wrapper').toggleClass('show_left')
				var s = $('#page_wrapper').hasClass('show_left')
				this.nodes.forEach(n => {
					$(n).toggleClass('sel', s)
				})
				BarItems.sidebar_right.nodes.forEach(n => {
					$(n).removeClass('sel')
				})
				updateInterfacePanels()
				resizeWindow()
			}
		})
		new Action('sidebar_right', {
			icon: 'view_list',
			category: 'view',
			condition: () => !Modes.start,
			click: function () {
				$('#page_wrapper').removeClass('show_left')
				$('#page_wrapper').toggleClass('show_right')
				var s = $('#page_wrapper').hasClass('show_right')
				this.nodes.forEach(n => {
					$(n).toggleClass('sel', s)
				})
				BarItems.sidebar_left.nodes.forEach(n => {
					$(n).removeClass('sel')
				})
				updateInterfacePanels()
				resizeWindow()
			}
		})
	}
})

