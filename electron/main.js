import {app, BrowserWindow, Menu, ipcMain, shell, MessageChannelMain} from 'electron'
import path from 'path'
import url from 'url'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const { autoUpdater } = require('electron-updater');
const remote = require('@electron/remote/main')
remote.initialize();

let all_wins = [];
let orig_win;
let load_project_data;
// [Popout] windowId -> {win, kind: 'panel'|'preview', targetId, ownerWinId}
let popout_wins = new Map();
let popout_win_id_counter = 0;

(() => {
	// Allow advanced users to specify a custom userData directory.
	// Useful for portable installations, and for setting up development environments.
	const index = process.argv.findIndex(arg => arg === '--userData');
	if (index !== -1) {
		if (!process.argv.at(index + 1)) {
			console.error('No path specified after --userData')
			process.exit(1)
		}
		app.setPath('userData', process.argv[index + 1]);
	}
})()

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
	if (process.platform != 'win32') {
		app.commandLine.appendSwitch('enable-unsafe-swiftshader');
	}
}

function createWindow(second_instance, options = {}) {
	if (app.requestSingleInstanceLock && !app.requestSingleInstanceLock()) {
		app.quit()
		return;
	}
	let native_frame = LaunchSettings.get('native_window_frame') === true;
	let win_options = {
		icon: 'icon.ico',
		show: false,
		backgroundColor: '#21252b',
		frame: native_frame,
		titleBarStyle: native_frame ? 'default' : 'hidden',
		minWidth: 640,
		minHeight: 480,
		width: 1080,
		height: 720,
		webPreferences: {
			webgl: true,
			webSecurity: true,
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true
		}
	};
	if (options.position) {
		win_options.x = options.position[0] - 300;
		win_options.y = Math.max(options.position[1] - 100, 0);
	}
	let win = new BrowserWindow(win_options)
	if (!orig_win) orig_win = win;
	all_wins.push(win);

	remote.enable(win.webContents)

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
	
	if (options.maximize !== false) win.maximize()

	let index_path = path.join(__dirname, './../index.html')
	let url_path = url.format({
		pathname: index_path,
		protocol: 'file:',
		slashes: true
	});
	win.loadURL(url_path).finally(() => {
		win.show();
	});

	// [Popout] In dev mode the main window also auto-opens detached devtools, to make it easier to debug alongside popout windows.
	if (!app.isPackaged) {
		win.webContents.once('did-finish-load', () => {
			if (!win.isDestroyed()) win.webContents.openDevTools({mode: 'detach'});
		});
	}
	win.on('closed', () => {
		all_wins.splice(all_wins.indexOf(win), 1);
		// [Popout] Cascade-close all popped-out panel/preview windows owned by this window, to prevent orphaned windows
		for (let [popout_id, entry] of popout_wins) {
			if (entry.ownerWinId == win.id && !entry.win.isDestroyed()) {
				entry.win.close();
			}
		}
		win = null;
	})
	if (second_instance === true) {
		win.webContents.second_instance = true;
	}
	return win;
}

// [Popout] Pops a panel/preview viewport out as a child window of the main window (child window, parent=main window).
// The window still loads the same index.html+bundle.js
// (full resources, no trimmed entry - Panel/Preview instances are created as top-level
// side effects of their respective business modules, so they can't be sliced into a
// subset at module granularity). It passes --popout-kind=/--popout-target= via
// additionalArguments; on the renderer side, boot_loader.js reads these two arguments
// after the full startup flow finishes and performs a one-time visual trim
// (applyPanelPopout/applyPreviewPopout).
// Frameless (frame:false) + hidden native titlebar: the title bar / drag region /
// always-on-top button are self-drawn by the renderer, consistent with the main-window style.
function createPopoutWindow(owner_win, {kind, targetId, width, height, x, y}) {
	let win_options = {
		icon: 'icon.ico',
		show: false,
		backgroundColor: '#21252b',
		frame: false,
		titleBarStyle: 'hidden',
		// [Popout] As a child window of the main window (rather than an independent top-level window):
		// always floats above the main window, hides when the main window is minimized, and closes
		// together with the main window. This also serves as the fallback for the cascade-close logic.
		parent: owner_win,
		minWidth: 280,
		minHeight: 200,
		width: width || 480,
		height: height || 480,
		webPreferences: {
			webgl: true,
			webSecurity: true,
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true,
			additionalArguments: [
				`--popout-kind=${kind}`,
				`--popout-target=${targetId}`,
				`--popout-owner-window-id=${owner_win.id}`,
			]
		}
	};
	// [Popout] Restore the last remembered position (x,y are read from StateMemory by the renderer and passed in).
	// Only apply when both values are finite numbers, otherwise leave it to the OS default centered placement.
	if (Number.isFinite(x) && Number.isFinite(y)) {
		win_options.x = x;
		win_options.y = y;
	}
	let win = new BrowserWindow(win_options);
	remote.enable(win.webContents);
	win.setMenu(null);
	win.show();

	// [Popout] In dev mode, forward the popout window renderer's console, crash, and
	// load-failure events to the main-process terminal for easier debugging (the popout
	// window no longer opens its own devtools - you can't see it when it flashes by, and
	// it's disruptive; just watch the forwarded logs in the main-window terminal when needed).
	if (!app.isPackaged) {
		// Electron 40 changed the console-message event signature from (event,level,message,line,sourceId)
		// to a single details object; support both to avoid printing undefined.
		win.webContents.on('console-message', (...a) => {
			let msg, src, line;
			if (a[0] && typeof a[0] == 'object' && 'message' in a[0]) {
				msg = a[0].message; src = a[0].sourceId; line = a[0].lineNumber;
			} else {
				msg = a[2]; line = a[3]; src = a[4];
			}
			console.log(`[popout ${kind}:${targetId}] ${msg}  (${src}:${line})`);
		});
		win.webContents.on('render-process-gone', (e, details) => {
			console.error(`[popout ${kind}:${targetId}] render-process-gone:`, details);
		});
		win.webContents.on('did-fail-load', (e, code, desc, u) => {
			console.error(`[popout ${kind}:${targetId}] did-fail-load ${code} ${desc} ${u}`);
		});
		win.on('closed', () => console.log(`[popout ${kind}:${targetId}] window closed`));
	}

	let index_path = path.join(__dirname, './../index.html');
	win.loadURL(url.format({
		pathname: index_path,
		protocol: 'file:',
		slashes: true
	}));

	let popout_id = ++popout_win_id_counter;
	popout_wins.set(popout_id, {win, kind, targetId, ownerWinId: owner_win.id});

	// [Popout] The main process creates a single MessageChannelMain and distributes the two
	// ends to both sides, which is simpler and race-free compared to "each side requests, main
	// process forwards": port1 is sent immediately to the already-running main window, and
	// port2 is sent to the popout window only after its did-finish-load (by which point
	// popout.ts's IPC listener is registered), avoiding messages being sent - and lost -
	// before the listener is in place.
	let channel = new MessageChannelMain();
	if (!owner_win.isDestroyed()) {
		owner_win.webContents.postMessage('popout-provide-message-port', {popoutWindowId: win.id}, [channel.port1]);
	}
	win.webContents.once('did-finish-load', () => {
		if (!win.isDestroyed()) {
			win.webContents.postMessage('popout-provide-message-port', {ownerWindowId: owner_win.id}, [channel.port2]);
		}
	});

	win.on('closed', () => {
		let bounds_before_close = popout_wins.get(popout_id)?.last_bounds;
		popout_wins.delete(popout_id);
		if (!owner_win.isDestroyed()) {
			owner_win.webContents.send('popout-closed', {kind, targetId, bounds: bounds_before_close, popoutWindowId: win.id});
		}
	});
	// Track last known bounds so they can be reported back on close, without
	// needing a high-frequency IPC round trip while the window is open.
	let bounds_update = () => {
		let entry = popout_wins.get(popout_id);
		if (entry) entry.last_bounds = win.getBounds();
	};
	win.on('resize', bounds_update);
	win.on('move', bounds_update);

	return win;
}

app.commandLine.appendSwitch('ignore-gpu-blacklist')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
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

ipcMain.on('edit-launch-setting', (event, arg) => {
	LaunchSettings.set(arg.key, arg.value);
})
ipcMain.handle('get-launch-setting', (event, arg) => {
	return LaunchSettings.get(arg.key);
})
ipcMain.on('add-recent-project', (event, path) => {
	app.addRecentDocument(path);
})
ipcMain.on('dragging-tab', (event, value) => {
	all_wins.forEach(win => {
		if (win.isDestroyed() || win.id == event.sender.id) return;
		win.webContents.send('accept-detached-tab', JSON.parse(value));
	})
})
ipcMain.on('new-window', (event, data, position) => {
	if (typeof data == 'string') load_project_data = JSON.parse(data);
	if (position) {
		position = JSON.parse(position)
		let place_in_window = all_wins.find(win => {
			if (win.isDestroyed() || win.webContents == event.sender || win.isMinimized()) return false;
			let pos = win.getPosition();
			let size = win.getSize();
			return (position.offset[0] >= pos[0] && position.offset[0] <= pos[0] + size[0]
				 && position.offset[1] >= pos[1] && position.offset[1] <= pos[1] + size[1]);
		})
		if (place_in_window) {
			place_in_window.send('load-tab', load_project_data);
			place_in_window.focus();
			load_project_data = null;
		} else {
			createWindow(true, {
				maximize: false,
				position: position.offset
			});
		}
	} else {
		createWindow(true);
	}
})
ipcMain.on('close-detached-project', async (event, window_id, uuid) => {
	let window = all_wins.find(win => win.id == window_id);
	if (window) window.send('close-detached-project', uuid);
})
// [Popout] Pops a panel/preview viewport out into a separate window. The data-sync
// MessagePort is pushed to both sides directly by the main process inside
// createPopoutWindow and does not depend on the return value here, so this uses
// .on/send rather than handle/invoke.
ipcMain.on('popout-request', (event, {kind, targetId, width, height, x, y}) => {
	let owner_win = BrowserWindow.fromWebContents(event.sender);
	if (!owner_win) return;
	// Avoid popping out multiple windows for the same panel/preview viewport: if one already exists, focus the existing window
	let existing = [...popout_wins.values()].find(entry => (
		entry.kind == kind && entry.targetId == targetId && entry.ownerWinId == owner_win.id && !entry.win.isDestroyed()
	));
	if (existing) {
		existing.win.focus();
		return;
	}
	createPopoutWindow(owner_win, {kind, targetId, width, height, x, y});
})
ipcMain.on('request-color-picker', async (event, arg) => {
	const ColorPicker = await import('electron-color-picker');
	const color = await ColorPicker.getColorHexRGB().catch((error) => {
		console.warn('[Error] Failed to pick color', error)
		return ''
	})
	if (color) {
		// [Popout] Always send the picked color back to the requesting window itself (event.sender) -
		// popout windows are in popout_wins, not in all_wins, so the original code that only
		// iterated all_wins would leave colors picked in a popout window unable to ever come back.
		// In sync mode, additionally broadcast to other main windows (multiple open projects share the main color).
		event.sender.send('set-main-color', color);
		if (arg.sync) {
			all_wins.forEach(win => {
				if (win.isDestroyed() || win.webContents.id == event.sender.id) return;
				win.webContents.send('set-main-color', color)
			})
		}
	}
})
ipcMain.on('show-item-in-folder', async (event, path) => {
	shell.showItemInFolder(path);
})
ipcMain.on('open-in-default-app', async (event, path) => {
	shell.openPath(path);
})

app.on('ready', () => {

	const dev_mode = process.execPath && process.execPath.match(/node_modules[\\\/]electron/);

	if (dev_mode) {

		// Timeout to avoid race condition of Blockbench opening before esbuild finishes. Needs proper solution long-term
		setTimeout(() => {
			createWindow()
		}, 1000);

	} else {

		createWindow()
		
	}

	let app_was_loaded = false;
	ipcMain.on('app-loaded', () => {

		if (load_project_data) {
			all_wins[all_wins.length-1].send('load-tab', load_project_data);
			load_project_data = null;
		}

		if (app_was_loaded) {
			console.log('[Blockbench] App reloaded or new window opened')
			return;
		}

		app_was_loaded = true;
		if (dev_mode) {

			console.log('[Blockbench] App launched in development mode')
	
		} else {
	
			autoUpdater.autoInstallOnAppQuit = true;
			autoUpdater.autoDownload = false;
			if (LaunchSettings.get('update_to_prereleases') === true) {
				autoUpdater.allowPrerelease = true;
				//autoUpdater.channel = 'beta';
			}
	
			autoUpdater.on('update-available', (a) => {
				console.log('update-available', a)
				ipcMain.on('allow-auto-update', () => {
					autoUpdater.downloadUpdate()
				})
				if (!orig_win.isDestroyed()) orig_win.webContents.send('update-available', a);
			})
			autoUpdater.on('update-downloaded', (a) => {
				console.log('update-downloaded', a)
				if (!orig_win.isDestroyed()) orig_win.webContents.send('update-downloaded', a)
			})
			autoUpdater.on('error', (a) => {
				console.log('update-error', a)
				if (!orig_win.isDestroyed()) orig_win.webContents.send('update-error', a)
			})
			autoUpdater.on('download-progress', (a) => {
				console.log('update-progress', a)
				if (!orig_win.isDestroyed()) orig_win.webContents.send('update-progress', a)
			})
			autoUpdater.checkForUpdates().catch(err => {})
		}
	})
})

app.on('window-all-closed', () => {
	app.quit()
})
