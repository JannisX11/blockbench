const {app, BrowserWindow, Menu} = require('electron')
const path = require('path')
const url = require('url')

let orig_win;

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
			nodeIntegration: true
		}
	})
	if (!orig_win) orig_win = win;
	var index_path = path.join(__dirname, 'index.html')
	if (process.platform === 'darwin') {
		var template = [{ 
			label: 'File', 
			submenu: [{ 
				label: 'Quit', 
				accelerator: 'CmdOrCtrl+Q', 
				click: function() { 
					app.quit(); 
				} 
			}] 
		}, { 
			label: 'Edit',
			submenu: [{
				label: 'Cut',
				accelerator: 'CmdOrCtrl+X',
				selector: 'cut:'
			}, {
				label: 'Copy',
				accelerator: 'CmdOrCtrl+C',
				selector: 'copy:'
			}, {
				label: 'Paste',
				accelerator: 'CmdOrCtrl+V',
				selector: 'paste:'
			}, {
				label: 'Select All',
				accelerator: 'CmdOrCtrl+A',
				selector: 'selectAll:'
			}]
		}]
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
		win = null
	})
	if (second_instance === true) {
		win.webContents.second_instance = true

	}
}

app.on('second-instance', function (event, argv, cwd) {
	process.argv = argv
	createWindow(true)
})

app.commandLine.appendSwitch('ignore-gpu-blacklist')

app.on('ready', createWindow)

app.on('window-all-closed', () => {
	app.quit()
})
