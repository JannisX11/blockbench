import {app, BrowserWindow, Menu, ipcMain, shell} from 'electron'
import path from 'path'
import url from 'url'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import {spawn} from 'node:child_process'
import {
	HEADLESS_CLI_USAGE,
	HeadlessExitCode,
	createHeadlessCLIProfile,
	parseHeadlessCLIArguments,
	removeHeadlessCLIProfile,
	validateHeadlessCLIPaths,
} from './headless_cli.js'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const { autoUpdater } = require('electron-updater');
const remote = require('@electron/remote/main')
remote.initialize();

let all_wins = [];
let orig_win;
let load_project_data;
let headless_cli_options;
let headless_cli_profile;
let headless_cli_window;
let headless_cli_timeout;
let headless_cli_finished = false;

try {
	headless_cli_options = parseHeadlessCLIArguments(process.argv);
	if (headless_cli_options?.help) {
		process.stdout.write(HEADLESS_CLI_USAGE + '\n');
		process.exit(HeadlessExitCode.SUCCESS);
	}
	if (headless_cli_options) {
		validateHeadlessCLIPaths(headless_cli_options);
		headless_cli_profile = createHeadlessCLIProfile();
		app.setPath('userData', headless_cli_profile);
		app.setPath('sessionData', headless_cli_profile);
	}
} catch (error) {
	const exit_code = Number.isInteger(error.exitCode) ? error.exitCode : HeadlessExitCode.USAGE;
	process.stderr.write(`Blockbench headless: ${error.message}\n`);
	if (exit_code === HeadlessExitCode.USAGE) {
		process.stderr.write(`\n${HEADLESS_CLI_USAGE}\n`);
	} else {
		const phase = exit_code === HeadlessExitCode.INPUT
			? 'input'
			: (exit_code === HeadlessExitCode.OUTPUT ? 'output' : 'script');
		process.stdout.write(JSON.stringify({
			ok: false,
			input: headless_cli_options?.input,
			output: headless_cli_options?.output,
			phase,
			exitCode: exit_code,
			error: {name: error.name, message: error.message},
		}) + '\n');
	}
	process.exit(exit_code);
}

function cleanupHeadlessCLIProfile() {
	if (!headless_cli_profile) return;
	try {
		removeHeadlessCLIProfile(headless_cli_profile);
		headless_cli_profile = null;
	} catch (error) {
		// Chromium can briefly retain cache files while quitting. The process exit
		// hook below makes one final synchronous attempt.
	}
}

function scheduleHeadlessCLIProfileCleanup() {
	if (!headless_cli_profile) return;
	const profile_path = headless_cli_profile;
	const cleanup_script = path.join(__dirname, 'headless_cleanup.js');
	try {
		const cleanup_process = spawn(
			process.execPath,
			[cleanup_script, profile_path, String(process.pid)],
			{
				detached: true,
				stdio: 'ignore',
				windowsHide: true,
				env: {...process.env, ELECTRON_RUN_AS_NODE: '1'},
			},
		);
		cleanup_process.unref();
		headless_cli_profile = null;
	} catch (error) {
		// Keep the path for the in-process quit/exit cleanup fallback.
	}
}

function finishHeadlessCLI(result) {
	if (!headless_cli_options || headless_cli_finished) return;
	headless_cli_finished = true;
	clearTimeout(headless_cli_timeout);

	const exit_code = Number.isInteger(result.exitCode)
		? result.exitCode
		: (result.ok ? HeadlessExitCode.SUCCESS : HeadlessExitCode.RUNTIME);
	const payload = {
		ok: !!result.ok,
		input: headless_cli_options.input,
		output: headless_cli_options.output,
		...result,
		exitCode: exit_code,
	};
	if (!payload.ok && payload.error?.message) {
		process.stderr.write(`Blockbench headless: ${payload.error.message}\n`);
	}
	process.stdout.write(JSON.stringify(payload) + '\n');
	process.exitCode = exit_code;

	scheduleHeadlessCLIProfileCleanup();
	if (headless_cli_window && !headless_cli_window.isDestroyed()) {
		headless_cli_window.destroy();
	}
	app.exit(exit_code);
}

if (headless_cli_options) {
	app.commandLine.appendSwitch('disable-background-networking');
	app.commandLine.appendSwitch('disable-component-update');
	app.commandLine.appendSwitch('disable-http-cache');
	app.commandLine.appendSwitch('disable-renderer-backgrounding');
	app.commandLine.appendSwitch('no-proxy-server');

	ipcMain.on('headless-cli-log', (event, entry) => {
		if (event.sender !== headless_cli_window?.webContents) return;
		const level = entry?.level || 'log';
		const message = typeof entry?.message === 'string' ? entry.message : String(entry?.message ?? '');
		process.stderr.write(`[headless:${level}] ${message}\n`);
	});
	ipcMain.on('headless-cli-result', (event, result) => {
		if (event.sender !== headless_cli_window?.webContents) return;
		finishHeadlessCLI(result);
	});
	process.on('uncaughtException', error => {
		finishHeadlessCLI({
			ok: false,
			phase: 'main',
			exitCode: HeadlessExitCode.RUNTIME,
			error: {name: error.name, message: error.message, stack: error.stack},
		});
	});
	process.on('unhandledRejection', reason => {
		const error = reason instanceof Error ? reason : new Error(String(reason));
		finishHeadlessCLI({
			ok: false,
			phase: 'main',
			exitCode: HeadlessExitCode.RUNTIME,
			error: {name: error.name, message: error.message, stack: error.stack},
		});
	});
	app.on('quit', cleanupHeadlessCLIProfile);
	process.on('exit', cleanupHeadlessCLIProfile);
}

(() => {
	// Allow advanced users to specify a custom userData directory.
	// Useful for portable installations, and for setting up development environments.
	if (headless_cli_options) return;
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
}

function createWindow(second_instance, options = {}) {
	if (!options.headless && app.requestSingleInstanceLock && !app.requestSingleInstanceLock()) {
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
		skipTaskbar: options.headless === true,
		webPreferences: {
			webgl: true,
			webSecurity: true,
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true,
			backgroundThrottling: options.headless !== true,
			offscreen: options.headless === true,
			additionalArguments: options.headless ? ['--blockbench-headless-renderer'] : [],
		}
	};
	if (options.headless) {
		win_options.frame = false;
		win_options.paintWhenInitiallyHidden = true;
	}
	if (options.position) {
		win_options.x = options.position[0] - 300;
		win_options.y = Math.max(options.position[1] - 100, 0);
	}
	let win = new BrowserWindow(win_options)
	if (!orig_win) orig_win = win;
	all_wins.push(win);

	remote.enable(win.webContents)

	if (!options.headless && process.platform === 'darwin') {

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
	} else if (!options.headless) {
		win.setMenu(null);
	}
	
	if (!options.headless && options.maximize !== false) win.maximize()

	let index_path = path.join(__dirname, './../index.html')
	let url_path = url.format({
		pathname: index_path,
		protocol: 'file:',
		slashes: true
	});
	win.loadURL(url_path).then(() => {
		if (!options.headless) win.show();
	}, error => {
		if (options.headless) {
			finishHeadlessCLI({
				ok: false,
				phase: 'boot',
				exitCode: HeadlessExitCode.RUNTIME,
				error: {name: error.name, message: error.message, stack: error.stack},
			});
		} else {
			win.show();
		}
	});
	win.on('closed', () => {
		const index = all_wins.indexOf(win);
		if (index !== -1) all_wins.splice(index, 1);
	})
	if (second_instance === true) {
		win.webContents.second_instance = true;
	}
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
ipcMain.on('request-color-picker', async (event, arg) => {
	const ColorPicker = await import('electron-color-picker');
	const color = await ColorPicker.getColorHexRGB().catch((error) => {
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
ipcMain.on('show-item-in-folder', async (event, path) => {
	shell.showItemInFolder(path);
})
ipcMain.on('open-in-default-app', async (event, path) => {
	shell.openPath(path);
})

app.on('ready', () => {

	const dev_mode = process.execPath && process.execPath.match(/node_modules[\\\/]electron/);
	let app_was_loaded = false;
	ipcMain.on('app-loaded', event => {
		if (headless_cli_options) {
			if (event.sender !== headless_cli_window?.webContents || app_was_loaded) return;
			app_was_loaded = true;
			event.sender.send('headless-cli-run', headless_cli_options);
			return;
		}

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

	if (headless_cli_options) {
		headless_cli_window = createWindow(false, {headless: true, maximize: false});
		headless_cli_window.webContents.on('console-message', event => {
			if (event.level === 'error' || event.level === 'warning') {
				process.stderr.write(`[renderer:${event.level}] ${event.message}\n`);
			}
		});
		headless_cli_window.webContents.on('did-fail-load', (event, error_code, error_description, validated_url, is_main_frame) => {
			if (!is_main_frame) return;
			finishHeadlessCLI({
				ok: false,
				phase: 'boot',
				exitCode: HeadlessExitCode.RUNTIME,
				error: {
					name: 'RendererLoadError',
					message: `Renderer load failed: ${error_description} (${error_code})`,
				},
			});
		});
		headless_cli_window.webContents.on('render-process-gone', (event, details) => {
			finishHeadlessCLI({
				ok: false,
				phase: 'renderer',
				exitCode: HeadlessExitCode.RUNTIME,
				error: {
					name: 'RendererProcessError',
					message: `Renderer process exited: ${details.reason} (${details.exitCode})`,
				},
			});
		});
		headless_cli_timeout = setTimeout(() => {
			finishHeadlessCLI({
				ok: false,
				phase: 'timeout',
				exitCode: HeadlessExitCode.TIMEOUT,
				error: {
					name: 'HeadlessCLITimeoutError',
					message: `Headless action exceeded ${headless_cli_options.timeout}ms`,
				},
			});
		}, headless_cli_options.timeout);

	} else if (dev_mode) {

		// Timeout to avoid race condition of Blockbench opening before esbuild finishes. Needs proper solution long-term
		setTimeout(() => {
			createWindow()
		}, 1000);

	} else {

		createWindow()

	}
})

app.on('window-all-closed', () => {
	app.quit()
})
