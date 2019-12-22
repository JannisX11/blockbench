
CustomTheme.setup()

initCanvas()
animate()

Blockbench.browser = 'electron'
if (isApp === false) {
	if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
		Blockbench.browser = 'firefox'
	} else if (!!window.chrome && !!window.chrome.webstore) {
		Blockbench.browser = 'chrome'
	} else if ((!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0) {
		Blockbench.browser = 'opera'
	} else if (/constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification))) {
		Blockbench.browser = 'safari'
	} else if (!!document.documentMode) {
		Blockbench.browser = 'internet_explorer'
	} else if (!!window.StyleMedia) {
		Blockbench.browser = 'edge'
	}
	if (navigator.appVersion.indexOf("Win") != -1) 	OSName = 'Windows';
	if (navigator.appVersion.indexOf("Mac") != -1) 	OSName = 'MacOS';
	if (navigator.appVersion.indexOf("Linux") != -1)OSName = 'Linux';
	if (['edge', 'internet_explorer'].includes(Blockbench.browser)) {
		alert(capitalizeFirstLetter(Blockbench.browser)+' does not support Blockbench')
	}
	$('.local_only').remove()
} else {
	$('.web_only').remove()
}
BARS.setupActions()
BARS.setupToolbars()
BARS.setupVue()
MenuBar.setup()
translateUI()

console.log('Blockbench ' + appVersion + (isApp
	? (' Desktop (' + Blockbench.operating_system +')')
	: (' Web ('+capitalizeFirstLetter(Blockbench.browser)+')')
))
var startups = parseInt(localStorage.getItem('startups')||0);
localStorage.setItem('startups', startups+1);


if (isApp) {
	updateRecentProjects()
}


if (!isApp) {
	/*
	async function registerSW() {
		if ('serviceWorker' in navigator) {
			try {
				await navigator.serviceWorker.register('./service_worker.js');
			} catch (err) {
				console.log(err)
			}
		}
	}
	registerSW();
	*/
}








setInterval(function() {
	Prop.fps = framespersecond;
	framespersecond = 0;
}, 1000)

main_uv = new UVEditor('main_uv', false, true)
main_uv.setToMainSlot()

onVueSetup.funcs.forEach((func) => {
	if (typeof func === 'function') {
		func()
	}
})

$('#cubes_list').droppable({
	greedy: true,
	accept: 'div.outliner_object',
	tolerance: 'pointer',
	hoverClass: 'drag_hover',
	drop: function(event, ui) {
		var item = Outliner.root.findRecursive('uuid', $(ui.draggable).parent().attr('id'))
		dropOutlinerObjects(item, undefined, event)
	}
})
$('#cubes_list').contextmenu(function(event) {
	event.stopPropagation();
	event.preventDefault();
	Interface.Panels.outliner.menu.show(event)
})
$('#texture_list').contextmenu(function(event) {
	Interface.Panels.textures.menu.show(event)
})

setupInterface()
setupDragHandlers()

if (isApp) {
	initializeDesktopApp();
} else {
	initializeWebApp();
}

Modes.options.start.select()

loadInstalledPlugins();

Blockbench.setup_successful = true;
