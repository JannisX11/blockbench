const Client = require("discord-rpc").Client
const rpc = new Client({transport : "ipc"})
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
  var index_path = path.join(__dirname, 'index.html')
  if (__dirname.includes('xampp\\htdocs\\blockbench\\web')) {
    index_path = path.join(__dirname, 'index.php')
  }
  win.setMenu(null);
  win.maximize()
  win.show()
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.php'),
    protocol: 'file:',
    slashes: true
  }))
  win.on('closed', () => {
    win = null
  })
  //win.webContents.openDevTools()
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
//padStart pollyfill required by discord-rpc
if (!String.prototype.padStart) {
  String.prototype.padStart = function padStart(targetLength,padString) {
      targetLength = targetLength>>0; //truncate if number or convert non-number to 0;
      padString = String((typeof padString !== 'undefined' ? padString : ' '));
      if (this.length > targetLength) {
          return String(this);
      }
      else {
          targetLength = targetLength-this.length;
          if (targetLength > padString.length) {
              padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
          }
          return padString.slice(0,targetLength) + String(this);
      }
  };
}

rpc.login("398111176145502209");
async function updatePresence() {
  if (!rpc)
  return;
  let details
  
  let projectName = await win.webContents.executeJavaScript("$(\"#project_name\")[0].value");
  projectName !== "" ? details = "Working on " + projectName : details = undefined
  rpc.setActivity({
    details: details,
    state: "Modeling in blockbench",
    largeImageKey: "blockbench",
    largeImageText: "Blockbench - free modeling tool",
    instance: false,
  })
}

rpc.once('ready', () => {
  updatePresence();

  // activity can only be set every 15 seconds
  setInterval(() => {
    updatePresence();
  }, 15e3);
});
