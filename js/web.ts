import { InputFormConfig } from "./interface/form";

Blockbench.queries = {};

let query_string = location.search || location.hash;
if (query_string) {
	query_string = decodeURIComponent(query_string.substring(1));
	let queries = query_string.split('&');
	queries.forEach(string => {
		let [key, value] = string.split(/=\s*(.+)/);
		Blockbench.queries[key] = value || true;
	})
}


export function initializeWebApp() {
	
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
		} else if (typeof open_interface == 'string' && Dialog.open) {
			$(Dialog.open.object).find('.cancel_btn:not([disabled])').trigger('click');
		}
		
	} else if (Interface.tab_bar.$data.new_tab.visible) {
		Interface.tab_bar.$data.new_tab.close()
		
	} else if (Menu.open) {
		Menu.open.hide()

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

export async function loadInfoFromURL() {
	Blockbench.dispatchEvent('handle_url_parameters', {
		parameters: Blockbench.queries,
		type: 'url_queries'
	});
}

//Misc
window.onbeforeunload = function() {
	let unsaved_projects = ModelProject.all.find(project => !project.saved);
	if (unsaved_projects) {
		return 'Unsaved Changes';
	} else {
		Blockbench.dispatchEvent('before_closing', {});
		if (Project.EditSession) Project.EditSession.quit()
	}
}

// Match exports to desktop.ts
const NULL = null;
export {
	NULL as recent_projects,
	NULL as initializeDesktopApp,
	NULL as loadOpenWithBlockbenchFile,
	NULL as updateRecentProjects,
	NULL as addRecentProject,
	NULL as updateRecentProjectData,
	NULL as updateRecentProjectThumbnail,
	NULL as loadDataFromModelMemory,
	NULL as changeImageEditor,
	NULL as isImageEditorValid,
	NULL as openDefaultTexturePath,
	NULL as findExistingFile,
	NULL as createBackup,
}

Object.assign(window, {
	initializeWebApp,
	loadInfoFromURL 
})
