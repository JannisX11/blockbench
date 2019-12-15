const electron = require('electron').remote;
const {clipboard, shell, nativeImage} = require('electron');
const app = electron.app;
const fs = require('fs');
const zlib = require('zlib');
const exec = require('child_process').exec;
const originalFs = require('original-fs');
const https = require('https');

const currentwindow = electron.getCurrentWindow();
const ElecDialogs = {};
var dialog_win	 = null,
	latest_version = false,
	recent_projects= undefined;

app.setAppUserModelId('blockbench')

if (electron.dialog.showMessageBoxSync) {
	ElecDialogs.showMessageBox = function(a, b, cb) {
		if (!cb) cb = b;
		var result = electron.dialog.showMessageBoxSync(a, b);
		if (typeof cb == 'function') cb(result);
		return result;
	}
	ElecDialogs.showSaveDialog = function(a, b, cb) {
		if (!cb) cb = b;
		var result = electron.dialog.showSaveDialogSync(a, b);
		if (typeof cb == 'function') cb(result);
		return result;
	}
	ElecDialogs.showOpenDialog = function(a, b, cb) {
		if (!cb) cb = b;
		var result = electron.dialog.showOpenDialogSync(a, b);
		if (typeof cb == 'function') cb(result);
		return result;
	}
} else {
	ElecDialogs.showMessageBox = electron.dialog.showMessageBox;
	ElecDialogs.showSaveDialog = electron.dialog.showSaveDialog;
	ElecDialogs.showOpenDialog = electron.dialog.showOpenDialog;
}

function initializeDesktopApp() {

	//Setup
	$(document.body).on('click', 'a[href]', (event) => {
		event.preventDefault();
		shell.openExternal(event.target.href);
		return true;
	});
	if (compareVersions('5.0.0', process.versions.electron)) {
		Prop.zoom = 100 + currentwindow.webContents._getZoomLevel()*12
	} else {
		Prop.zoom = 100 + currentwindow.webContents.getZoomLevel()*12
	}
	if (fs.existsSync(app.getPath('userData')+osfs+'backups') === false) {
		fs.mkdirSync( app.getPath('userData')+osfs+'backups')
	}
	createBackup(true)
	$('.web_only').remove()
	if (__dirname.includes('C:\\xampp\\htdocs\\blockbench')) {
		Blockbench.addFlag('dev')
	}

	//Load Model
	if (electron.process.argv.length >= 2) {
		var extension = pathToExtension(electron.process.argv.last())
		if (['json', 'bbmodel', 'jem'].includes(extension)) {
			Blockbench.read([electron.process.argv.last()], {}, (files) => {
				loadModelFile(files[0])
			})
		}
	}
	if (Blockbench.platform == 'darwin') {
		//Placeholder
		$('#mac_window_menu').show()
		currentwindow.on('enter-full-screen', () => {
			$('#mac_window_menu').hide()
		})
		currentwindow.on('leave-full-screen', () => {
			$('#mac_window_menu').show()
		})
	} else {
		$('#windows_window_menu').show()
	}

}
(function() {
	console.log('Electron '+process.versions.electron+', Node '+process.versions.node)
})()

//Recent Projects
function updateRecentProjects() {
	if (recent_projects === undefined) {
		//Setup
		recent_projects = []
		var raw = localStorage.getItem('recent_projects')
		if (raw) {
			try {
				recent_projects = JSON.parse(raw).slice().reverse()
			} catch (err) {}
		}
	}
	//Set Local Storage
	localStorage.setItem('recent_projects', JSON.stringify(recent_projects.slice().reverse()))
}
function addRecentProject(data) {
	var i = recent_projects.length-1
	while (i >= 0) {
		var p = recent_projects[i]
		if (p.path === data.path) {
			recent_projects.splice(i, 1)
		}
		i--;
	}
	recent_projects.splice(0, 0, {
		name: data.name,
		path: data.path,
		icon: data.icon,
		day: new Date().dayOfYear()
	})
	app.addRecentDocument(data.path)
	if (recent_projects.length > Math.clamp(settings.recent_projects.value, 0, 256)) {
		recent_projects.pop()
	}
	updateRecentProjects()
}

//Window Controls
function updateWindowState(e, type) {
	$('#header_free_bar').toggleClass('resize_space', !currentwindow.isMaximized());
}
currentwindow.on('maximize', e => updateWindowState(e, 'maximize'));
currentwindow.on('unmaximize', e => updateWindowState(e, 'unmaximize'));
currentwindow.on('enter-full-screen', e => updateWindowState(e, 'screen'));
currentwindow.on('leave-full-screen', e => updateWindowState(e, 'screen'));
currentwindow.on('ready-to-show', e => updateWindowState(e, 'load'));

//Updates
//Called on start to show message
function getLatestVersion() {
	if (process.platform == 'linux') return;
	$.getJSON('https://raw.githubusercontent.com/JannisX11/blockbench/master/package.json', (data) => {
		if (data.version) {
			latest_version = data.version
			checkForUpdates()
		}
	}).fail(function() {
		latest_version = false
	})
}
function checkForUpdates(instant) {
	showDialog('updater')
	setProgressBar('update_bar', 0, 1)
	var data;
	if (latest_version === false) {

		data =  `<div class="tool" onclick="refreshUpdateDialog()">
				<i class="material-icons">refresh</i>
				<div class="tooltip">${tl('dialog.update.refresh')}</div>
				</div>
				<div class="dialog_bar narrow">
				<i class="material-icons blue_icon">cloud_off</i>${tl('dialog.update.no_connection')}
				</div>`;

	} else if (latest_version !== appVersion) {
		data = 
			`<div class="dialog_bar narrow">${tl('dialog.update.latest')}: ${latest_version}</div>
			<div class="dialog_bar narrow">${tl('dialog.update.installed')}: ${appVersion}</div>
			<div class=""><button type="button" class="uc_btn" id="update_button" onclick="installUpdate()">${tl('dialog.update.update')}</button></div>`;

		if (instant) {
			setTimeout(function() {
				installUpdate()
			}, 60)
		}
	} else {
		data = 
			`<div class="tool" onclick="refreshUpdateDialog()">
				<i class="material-icons">refresh</i>
				<div class="tooltip">${tl('dialog.update.refresh')}</div>
			</div>
			<div class="dialog_bar narrow">
			<i class="material-icons blue_icon">check</i>
			${tl('dialog.update.up_to_date')}
			</div>`;
	}
	$('#updater_content').html(data)
}
function refreshUpdateDialog() {
	currentwindow.webContents.session.clearCache(function() {
		data = '<div class="dialog_bar narrow"><i class="material-icons blue_icon spinning">refresh</i>'+tl('dialog.update.connecting')+'</div>'
		$('#updater_content').html(data)
		getLatestVersion()
	})
}
function installUpdate() {
	console.log('Starting Update')
	var received_bytes = 0;
	var total_bytes = 0;

	$('.uc_btn').css('visibility', 'hidden')

	var asar_path = __dirname;
	if (asar_path.includes('.asar') === false) {
		asar_path = asar_path + osfs+'resources'+osfs+'app.asar';
	}

	var file = originalFs.createWriteStream(asar_path);

	var request = https.get("https://blockbench.net/api/app.asar", function(response) {
		response.pipe(file);

		total_bytes = parseInt(response.headers['content-length']);

		response.on('end', updateInstallationEnd)
		response.on('data', function(chunk) {
			received_bytes += chunk.length;
			setProgressBar('update_bar', received_bytes / total_bytes, 1);
		})
	});
}
function updateInstallationEnd() {
	hideDialog();
	if (showSaveDialog()) {
		app.relaunch()
		app.exit()
	} else {
		Blockbench.showQuickMessage('message.restart_to_update');
	}
}
//Image Editor
function changeImageEditor(texture, from_settings) {
	var dialog = new Dialog({
		title: tl('message.image_editor.title'),
		id: 'image_editor',
		lines: ['<div class="dialog_bar"><select class="input_wide">'+
				'<option id="ps">Photoshop</option>'+
				'<option id="gimp">Gimp</option>'+
				(Blockbench.platform == 'win32' ? '<option id="pdn">Paint.NET</option>' : '')+
				'<option id="other">'+tl('message.image_editor.file')+'</option>'+
			'</select></div>'],
		draggable: true,
		onConfirm() {
			var id = $('.dialog#image_editor option:selected').attr('id')
			var path;
			if (Blockbench.platform == 'darwin') {
				switch (id) {
					case 'ps':  path = '/Applications/Adobe Photoshop CC 2019/Adobe Photoshop CC 2019.app'; break;
					case 'gimp':path = '/Applications/Gimp-2.10.app'; break;
				}
			} else {
				switch (id) {
					case 'ps':  path = 'C:\\Program Files\\Adobe\\Adobe Photoshop CC 2019\\Photoshop.exe'; break;
					case 'gimp':path = 'C:\\Program Files\\GIMP 2\\bin\\gimp-2.10.exe'; break;
					case 'pdn': path = 'C:\\Program Files\\paint.net\\PaintDotNet.exe'; break;
				}
			}
			if (id === 'other') {
				selectImageEditorFile(texture)

			} else if (path) {
				settings.image_editor.value = path
				if (texture) {
					texture.openEditor()
				}
			}
			dialog.hide()
			if (from_settings) {
				Settings.open()
			}
		},
		onCancel() {
			dialog.hide()
			if (from_settings) {
				Settings.open()
			}
		}
	}).show()
}
function selectImageEditorFile(texture) {
	ElecDialogs.showOpenDialog(currentwindow, {
		title: tl('message.image_editor.exe'),
		filters: [{name: 'Executable Program', extensions: ['exe', 'app']}]
	}, function(filePaths) {
		if (filePaths) {
			settings.image_editor.value = filePaths[0]
			if (texture) {
				texture.openEditor()
			}
		}
	})
}
//Default Pack
function openDefaultTexturePath() {
	var answer = ElecDialogs.showMessageBox(currentwindow, {
		type: 'info',
		buttons: (
			settings.default_path.value ? 	[tl('dialog.cancel'), tl('dialog.continue'), tl('generic.remove')]
										:	[tl('dialog.cancel'), tl('dialog.continue')]
		),
		noLink: true,
		title: tl('message.default_textures.title'),
		message: tl('message.default_textures.message'),
		detail: tl('message.default_textures.detail'),
	})
	if (answer === 0) {
		return;
	} else if (answer === 1) {
		 ElecDialogs.showOpenDialog(currentwindow, {
			title: tl('message.default_textures.select'),
			properties: ['openDirectory'],
		}, function(filePaths) {
			if (filePaths) {
				settings.default_path.value = filePaths[0]
			}
		})
	} else {
		settings.default_path.value = false
	}
}
function findExistingFile(paths) {
	for (var path of paths) {
		if (fs.existsSync(path)) {
			return path;
		}
	}
}
//Backup
function createBackup(init) {
	setTimeout(createBackup, limitNumber(parseFloat(settings.backup_interval.value), 1, 10e8)*60000)

	var duration = parseInt(settings.backup_retain.value)+1
	var folder_path = app.getPath('userData')+osfs+'backups'
	var d = new Date()
	var days = d.getDate() + (d.getMonth()+1)*30.44 + (d.getYear()-100)*365.25

	if (init) {
		//Clear old backups
		fs.readdir(folder_path, (err, files) => {
			if (!err) {
				files.forEach((name, i) => {
					var date = name.split('_')[1]
					if (date) {
						var nums = date.split('.')
						nums.forEach((n, ni) => {
							nums[ni] = parseInt(n)
						})
						var b_days = nums[0] + nums[1]*30.44 + nums[2]*365.25
						if (!isNaN(b_days) && days - b_days > duration) {
							try {
								fs.unlinkSync(folder_path +osfs+ name)
							} catch (err) {console.log(err)}
						}
					}
				})
			}
		})
	}
	if (init || elements.length === 0) return;

	var model = Codecs.project.compile({compressed: true})
	localStorage.setItem('backup_model', model)
	var file_name = 'backup_'+d.getDate()+'.'+(d.getMonth()+1)+'.'+(d.getYear()-100)+'_'+d.getHours()+'.'+d.getMinutes()
	var file_path = folder_path+osfs+file_name+'.bbmodel'

	fs.writeFile(file_path, model, function (err) {
		if (err) {
			console.log('Error creating backup: '+err)
		}
	})
}
//Close
window.onbeforeunload = function() {
	if (!Blockbench.hasFlag('allow_closing')) {
		setTimeout(function() {
			showSaveDialog(true)
		}, 2)
		return true;
	}
}
function showSaveDialog(close) {
	if (Blockbench.hasFlag('allow_reload')) {
		close = false
	}
	var unsaved_textures = 0;
	textures.forEach(function(t) {
		if (!t.saved) {
			unsaved_textures++;
		}
	})
	if ((window.Prop && Prop.project_saved === false && (elements.length > 0 || Group.all.length > 0)) || unsaved_textures) {
		var answer = ElecDialogs.showMessageBox(currentwindow, {
			type: 'question',
			buttons: [tl('dialog.save'), tl('dialog.discard'), tl('dialog.cancel')],
			title: 'Blockbench',
			message: tl('message.close_warning.message'),
			noLink: true
		})
		if (answer === 0) {
			if (close === true) {
				Blockbench.addFlag('close_after_saving')
			}
			BarItems.save_project.trigger()
			return true;
		} else if (answer === 2) {
			return false;
		} else {
			if (close === true) {
				closeBlockbenchWindow()
			}
			return true;
		}
	} else {
		if (close === true) {
			closeBlockbenchWindow()
		}
		return true;
	}
}
function closeBlockbenchWindow() {
	Blockbench.addFlag('allow_closing');
	Blockbench.dispatchEvent('before_closing')
	localStorage.removeItem('backup_model')
	EditSession.quit()
	
	return currentwindow.close();
}
