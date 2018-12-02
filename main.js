const {app, BrowserWindow} = require('electron')
const path = require('path')
const url = require('url')

let win

function createWindow () {
	win = new BrowserWindow({
		icon:'icon.ico',
		show: false,
		backgroundColor: '#21252b',
		webPreferences: {
			//experimentalFeatures: true,
			webgl: true,
			webSecurity: true
		}
	})
	var index_path = path.join(__dirname, 'index.html')
	if (__dirname.includes('xampp\\htdocs\\')) {
		index_path = path.join(__dirname, 'index.php')
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
	//if (process.platform !== 'darwin') {
		app.quit()
	//}
})


app.on('activate', () => {
	if (win === null) {
		createWindow()
	}
})