(function() {
	$.getScript("lib/file_saver.js");
	$.getScript('https://rawgit.com/nodeca/pako/master/dist/pako.js', function() {
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
	if (location.hash.substr(1, 8) == 'session=') {
		EditSession.dialog()
		$('#edit_session_token').val(location.hash.substr(9))
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


BARS.defineActions(function() {
	if (Blockbench.isMobile) {
		var page_wrapper = $('#page_wrapper')
		new Action('sidebar_left', {
			icon: 'burst_mode',
			category: 'view',
			condition: () => !Modes.start,
			click: function () {
				page_wrapper.removeClass('show_right')
				page_wrapper.toggleClass('show_left')
				var s = page_wrapper.hasClass('show_left')

				$('#left_bar').css('margin-left', '-400px')
				$('#left_bar').animate({'margin-left': 0}, 160)

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
				page_wrapper.removeClass('show_left')
				page_wrapper.toggleClass('show_right')
				var s = page_wrapper.hasClass('show_right')

				$('#right_bar').css('margin-left', '400px')
				$('#right_bar').animate({'margin-left': 0}, 160)

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
		$('.panel#element').detach();
		var swiping;
		var height = 0;
		var start_x = 0;
		var edge = 20;
		var swipe_min = 60;
		document.addEventListener('touchstart', (event) => {
			if (event.changedTouches.length == 1) {
				var touch = event.changedTouches[0];
				height = touch.clientY;
				start_x = touch.clientX;
				if (touch.clientX < edge) {
					swiping = 'left';
				} else if (document.body.clientWidth - touch.clientX < edge) {
					swiping = 'right';
				}
			}
		}, false)
		document.addEventListener('touchend', (event) => {
			if (event.changedTouches.length == 1) {
				var touch = event.changedTouches[0];
				var delta_height = Math.abs(height - touch.clientY);
				if (start_x < edge && touch.clientX > swipe_min && delta_height < 30) {
					if (page_wrapper.hasClass('show_right')) {
						BarItems.sidebar_right.trigger(event);
					} else {
						BarItems.sidebar_left.trigger(event);
					}
				} else if (
					document.body.clientWidth - start_x < edge &&
					(document.body.clientWidth - touch.clientX) > swipe_min &&
					delta_height < 30
				) {
					if (page_wrapper.hasClass('show_left')) {
						BarItems.sidebar_left.trigger(event);
					} else {
						BarItems.sidebar_right.trigger(event);
					}
				} else if (
					document.body.clientWidth - start_x < 40 &&
					document.body.clientWidth - touch.clientX < 40 &&
					delta_height < 10 &&
					event.target == page_wrapper[0] &&
					(page_wrapper.hasClass('show_left') || page_wrapper.hasClass('show_right'))
				) {
					page_wrapper.removeClass('show_left')
					page_wrapper.removeClass('show_right')

					BarItems.sidebar_left.nodes.forEach(n => {
						$(n).removeClass('sel')
					})
					updateInterfacePanels()
					resizeWindow()
				}
			}
			height = 0;
			swiping = undefined;
		}, false)
	}
})

