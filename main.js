const { app, BrowserWindow, ipcMain } = require('electron')

const remote = require('electron').remote;
const path = require('path')
const url = require('url')

let win

function createWindow() {
	win = new BrowserWindow({
		icon: 'icon.ico',
		show: false,
		backgroundColor: '#21252b',
		frame: false,
		titleBarStyle: 'hidden',
		width: 1009,
		height: 676,
		minWidth: 1009,
		minHeight: 676,
		webPreferences: {
			//experimentalFeatures: true,
			webgl: true,
			webSecurity: true,
			nodeIntegration: true
		}
	})
	var index_path = path.join(__dirname, 'index.html')
	if (__dirname.includes('xampp\\htdocs\\')) {
		//index_path = path.join(__dirname, 'index.php')
	}
	win.setMenu(null);
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
	//win.webContents.openDevTools()
}

app.commandLine.appendSwitch('ignore-gpu-blacklist')
app.on('ready', createWindow)


app.on('window-all-closed', () => {
	app.quit()
})


app.on('activate', () => {
	if (win === null) {
		createWindow()
	}
})
