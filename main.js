const {app, BrowserWindow, Menu, ipcMain} = require('electron')
const path = require('path')
const url = require('url')
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const {getColorHexRGB} = require('electron-color-picker')
require('@electron/remote/main').initialize()

let orig_win;
let all_wins = [];

const LaunchSettings = {
	path: path.join(app.getPath('userData'), 'launch_settings.json'),
	settings: {},
	get(key) {
		return this.settings[key]
	},
	set(key, value) {
		this.settings[key] = value;
		let content = JSON.stringify(this.settings, null, '\t');
		fs.writeFileSync(this.path, content);
	},
	load() {
		try {
			if (fs.existsSync(this.path)) {
				let content = fs.readFileSync(this.path, 'utf-8');
				this.settings = JSON.parse(content);
			}
		} catch (error) {}
		return this;
	}
}.load();

if (LaunchSettings.get('hardware_acceleration') == false) {
	app.disableHardwareAcceleration();
}

function createWindow(second_instance) {
	if (app.requestSingleInstanceLock && !app.requestSingleInstanceLock()) {
		app.quit()
		return;
	}
	let win = new BrowserWindow({
		icon:'icon.ico',
		show: false,
		backgroundColor: '#21252b',
		frame: LaunchSettings.get('native_window_frame') === true,
		titleBarStyle: 'hidden',
		minWidth: 640,
		minHeight: 480,
		webPreferences: {
			webgl: true,
			webSecurity: true,
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true
		}
	})
	if (!orig_win) orig_win = win;
	all_wins.push(win);

	require('@electron/remote/main').enable(win.webContents)

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
	return win;
}

app.commandLine.appendSwitch('ignore-gpu-blacklist')
app.commandLine.appendSwitch('enable-accelerated-video')

app.on('second-instance', function (event, argv, cwd) {
	process.argv = argv;
	let win = all_wins.find(win => !win.isDestroyed());
	if (win && argv[argv.length-1 || 1] && argv[argv.length-1 || 1].substr(0, 2) !== '--') {
		win.webContents.send('open-model', argv[argv.length-1 || 1]);
		win.focus();
	} else {
		createWindow(true);
	}
})
app.on('open-file', function (event, path) {
	process.argv[process.argv.length-1 || 1] = path;
	let win = all_wins.find(win => !win.isDestroyed());
	if (win) {
		win.webContents.send('open-model', path);
	}
})

ipcMain.on('change-main-color', (event, arg) => {
	all_wins.forEach(win => {
		if (win.isDestroyed() || win.webContents == event.sender.webContents) return;
		win.webContents.send('set-main-color', arg)
	})
})
ipcMain.on('edit-launch-setting', (event, arg) => {
	LaunchSettings.set(arg.key, arg.value);
})
ipcMain.on('add-recent-project', (event, path) => {
	app.addRecentDocument(path);
})
ipcMain.on('new-window', (event, path) => {
	createWindow(true);
})
ipcMain.on('request-color-picker', async (event, arg) => {
	const color = await getColorHexRGB().catch((error) => {
		console.warn('[Error] Failed to pick color', error)
		return ''
	})
	if (color) {
		all_wins.forEach(win => {
			if (win.isDestroyed() || (!arg.sync && win.webContents.getProcessId() != event.sender.getProcessId())) return;
			win.webContents.send('set-main-color', color)
		})
	}
})

app.on('ready', () => {

	createWindow()

	ipcMain.on('app-loaded', () => {

		if (process.execPath && process.execPath.match(/electron\.\w+$/)) {

			console.log('[Blockbench] App launched in development mode')
	
		} else {
	
			autoUpdater.autoInstallOnAppQuit = true;
			autoUpdater.autoDownload = false;
			if (LaunchSettings.get('update_to_prereleases') === true) {
				autoUpdater.allowPrerelease = true;
				autoUpdater.channel = 'beta';
			}
	
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
		}
	})
})

app.on('window-all-closed', () => {
	app.quit()
})
