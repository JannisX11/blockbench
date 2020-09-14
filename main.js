const {app, BrowserWindow, Menu, ipcMain} = require('electron')
const path = require('path')
const url = require('url')
const { autoUpdater } = require('electron-updater');

let orig_win;
let all_wins = [];

function createWindow(second_instance) {
	if (app.requestSingleInstanceLock && !app.requestSingleInstanceLock()) {
		app.quit()
		return;
	}
	let win = new BrowserWindow({
		icon:'icon.ico',
		show: false,
		backgroundColor: '#21252b',
		frame: false,
		titleBarStyle: 'hidden',
		minWidth: 640,
		minHeight: 480,
		webPreferences: {
			webgl: true,
			webSecurity: true,
			nodeIntegration: true,
			enableRemoteModule: true
		}
	})
	if (!orig_win) orig_win = win;
	all_wins.push(win);
	var index_path = path.join(__dirname, 'index.html')
	if (process.platform === 'darwin') {

		let template = [
			{
				"label": "Blockbench",
				"submenu": [
					{
						"role": "hide"
					},
					{
						"role": "hideothers"
					},
					{
						"role": "unhide"
					},
					{
						"type": "separator"
					},
					{
                        "role": "quit"
					}
				]
			},
			{
				"label": "Edit",
				"submenu": [
					{
						"role": "cut"
					},
					{
						"role": "copy"
					},
					{
						"role": "paste"
					},
					{
						"role": "selectall"
					}
				]
			},
			{
				"label": "Window",
				"role": "window",
				"submenu": [
					{
						"label": "Toggle Full Screen",
						"accelerator": "Ctrl+Command+F"
					},
					{
						"role": "minimize"
					},
					{
						"role": "close"
					},
					{
						"type": "separator"
					},
					{
						"role": "front"
					}
				]
			}
		]


		var osxMenu = Menu.buildFromTemplate(template);
		Menu.setApplicationMenu(osxMenu)
	} else {
		win.setMenu(null);
	}
	
	win.maximize()
	win.show()

	win.loadURL(url.format({
		pathname: index_path,
		protocol: 'file:',
		slashes: true
	}))
	win.on('closed', () => {
		win = null;
		all_wins.splice(all_wins.indexOf(win), 1);
	})
	if (second_instance === true) {
		win.webContents.second_instance = true;

	}
}

app.on('second-instance', function (event, argv, cwd) {
	process.argv = argv
	createWindow(true)
})

app.commandLine.appendSwitch('ignore-gpu-blacklist')
app.commandLine.appendSwitch('enable-accelerated-video')

ipcMain.on('change-main-color', (event, arg) => {
	all_wins.forEach(win => {
		if (win.isDestroyed() || win.webContents == event.sender.webContents) return;
		win.webContents.send('set-main-color', arg)
	})
})

app.on('ready', () => {

	createWindow()

	autoUpdater.autoInstallOnAppQuit = true;
	autoUpdater.autoDownload = false;

	autoUpdater.on('update-available', (a) => {
		console.log('update-available', a)
		ipcMain.on('allow-auto-update', () => {
			autoUpdater.downloadUpdate()
		})
		orig_win.webContents.send('update-available');
	})
	autoUpdater.on('update-downloaded', (a) => {
		console.log('update-downloaded', a)
		orig_win.webContents.send('update-downloaded', a)
	})
	autoUpdater.on('error', (a) => {
		console.log('update-error', a)
		orig_win.webContents.send('update-error', a)
	})
	autoUpdater.on('download-progress', (a) => {
		console.log('update-progress', a)
		orig_win.webContents.send('update-progress', a)
	})
	autoUpdater.checkForUpdates().catch(err => {})
})

app.on('window-all-closed', () => {
	app.quit()
})
