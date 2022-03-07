function initializeWebApp() {
	
	$(document.body).on('click', 'a[href]', (event) => {
		event.preventDefault();
		window.open(event.target.href, '_blank');
	});
	if (location.host == 'blockbench-dev.netlify.app') {
		let button = $(`<a href="https://www.netlify.com/" style="padding: 3px 8px; color: white; cursor: pointer; text-decoration: none;" target="_blank" rel="noopener">
				Hosted by
				<img src="https://www.blockbench.net/_nuxt/74d4819838c06fa271394f626e8c4b16.svg" height="20px" style="vertical-align: text-top;">
			</div>`);
		button.insertBefore('#web_download_button');
	}
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
		EditSession.token = location.hash.substr(9);
		BarItems.edit_session.click();
	}

	if (location.hash.substr(1, 2) == 'm=') {
		$.getJSON(`https://blckbn.ch/api/models/${location.hash.substr(3)}`, (model) => {
			Codecs.project.load(model, {path: ''});
		})
	}
}

//Misc
window.onbeforeunload = function() {
	let unsaved_projects = ModelProject.all.find(project => !project.saved);
	if (unsaved_projects) {
		return 'Unsaved Changes';
	} else {
		Blockbench.dispatchEvent('before_closing')
		if (Project.EditSession) Project.EditSession.quit()
	}
}
