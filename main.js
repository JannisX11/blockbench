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
      experimentalFeatures: true,
      webgl: true
    }
  })
  win.setMenu(null);
  win.maximize()
  win.show()
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))
  win.on('closed', () => {
    win = null
  })
  win.webContents.openDevTools()
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})


app.on('activate', () => {
  if (win === null) {
    createWindow()
  }
})