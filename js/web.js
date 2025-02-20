Blockbench.queries = {};
(function() {
	let query_string = location.search || location.hash;
	if (query_string) {
		query_string = decodeURIComponent(query_string.substring(1));
		let queries = query_string.split('&');
		queries.forEach(string => {
			let [key, value] = string.split(/=\s*(.+)/);
			Blockbench.queries[key] = value || true;
		})
	}
})()

function initializeWebApp() {
	
	$(document.body).on('click', 'a[href]', (event) => {
		event.preventDefault();
		window.open(event.currentTarget.href, '_blank');
	});
	if (location.host == 'blockbench-dev.netlify.app') {
		let button = $(`<a href="https://www.netlify.com/" style="padding: 10px; color: white; cursor: pointer; text-decoration: none; display: block;" target="_blank" rel="noopener">
				Hosted by
				<img src="./assets/netlify-full-logo-dark.svg" height="20px" style="vertical-align: text-top;">
			</div>`);
		button.insertBefore('#start_files');
	}
	if (!Blockbench.isTouch && !Blockbench.isPWA) {
		$('#web_download_button').show()
	}

	if (Blockbench.browser == 'firefox') {
		document.body.style.imageRendering = 'crisp-edges'
	}
}
addEventListener('load', function() {
	window.history.pushState({}, '')
})
addEventListener('popstate', e => {
	if (ModelProject.all.length == 0) {
		return;
	}

	if (open_interface) {
		if (typeof open_interface.cancel == 'function') {
			open_interface.cancel(event);
		} else if (typeof open_interface == 'string' && open_dialog) {
			$('dialog#'+open_dialog).find('.cancel_btn:not([disabled])').trigger('click');
		}
		
	} else if (Interface.tab_bar.new_tab.visible) {
		Interface.tab_bar.new_tab.close()
		
	} else if (open_menu) {
		open_menu.hide()

	} else if (Undo && Undo.index) {
		Undo.undo()

	} else if (!Blockbench.isMobile) {
		return;
	}

	window.history.pushState({}, '');
})

try {
	window.matchMedia('(display-mode: standalone)').addEventListener('change', (evt) => {
		if (!Blockbench.isMobile) $('#web_download_button').toggle(!evt.matches);
	});
} catch (err) {
	if (!Blockbench.isMobile) $('#web_download_button').hide();
}

async function loadInfoFromURL() {
	if (Blockbench.queries.session) {
		EditSession.token = Blockbench.queries.session;
		BarItems.edit_session.click();
	}

	if (Blockbench.queries.plugins) {
		let plugin_ids = Blockbench.queries.plugins.split(/,/);
		let plugins = plugin_ids.map(id => Plugins.all.find(plugin => plugin.id == id))
								.filter(p => p instanceof Plugin && p.installed == false && p.isInstallable() == true);
		if (plugins.length) {
			await new Promise(resolve => {
				let form = {
					info: {type: 'info', text: 'dialog.load_plugins_from_query.text'}
				}
				plugins.forEach(plugin => {
					form[plugin.id.replace(/\./g, '_')] = {type: 'checkbox', label: plugin.name, description: plugin.description, value: true}
				})
				new Dialog({
					id: 'load_plugins_from_query',
					title: 'dialog.load_plugins_from_query.title',
					form,
					buttons: ['dialog.plugins.install', 'dialog.cancel'],
					onConfirm: async function(result) {
						let promises = [];
						plugins.forEach(plugin => {
							if (result[plugin.id.replace(/\./g, '_')]) {
								promises.push(plugin.download());
							}
						})
						await Promise.all(promises);
						resolve();
					},
					onCancel() {
						resolve();
					}
				}).show();
			})
		}
	}

	if (Blockbench.queries.m) {
		$.getJSON(`https://blckbn.ch/api/models/${Blockbench.queries.m}`, (model, b) => {
			Codecs.project.load(model, {path: ''});
		}).fail(() => {
			Blockbench.showMessageBox({
				title: 'message.invalid_link',
				message: tl('message.invalid_link.message', ['`'+Blockbench.queries.m+'`']),
				icon: 'running_with_errors'
			})
		})
	} else if (Blockbench.queries.loadtype) {
		let file = {
			content: Blockbench.queries.loaddata,
			name: Blockbench.queries.loadname || 'file',
			path: Blockbench.queries.loadname || 'file'
		};
		switch (Blockbench.queries.loadtype) {
			case 'minecraft_skin': {
				Formats.skin.setup_dialog.show();
				Formats.skin.setup_dialog.setFormValues({
					texture: file
				})
				break;
			}
			case 'image': {
				loadImages([file]);
				break;
			}
			case 'json': {
				loadModelFile(file);
				break;
			}
		}
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
