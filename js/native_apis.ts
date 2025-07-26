import { BBPlugin } from "./plugin_loader";
import { createScopedFS } from "./util/scoped_fs";

const electron: typeof import("@electron/remote") = require('@electron/remote');
const {clipboard, shell, nativeImage, ipcRenderer, webUtils} = require('electron') as typeof import('electron');
const app = electron.app;
const fs: typeof import("node:fs") = require('node:fs');
const NodeBuffer: typeof import("node:buffer") = require('buffer');
const zlib: typeof import("node:zlib") = require('zlib');
const child_process: typeof import("node:child_process") = require('child_process');
const https: typeof import("node:https") = require('https');
const PathModule: typeof import("node:path") = require('path');
const os: typeof import("node:os") = require('os');
const currentwindow = electron.getCurrentWindow();
const dialog = electron.dialog;

/** @internal */
export {
	electron, clipboard, shell, nativeImage, ipcRenderer, webUtils,
	app, fs, NodeBuffer, zlib, child_process, https, PathModule, os, currentwindow, dialog,
}



const SAFE_APIS = [
	'path',
	'crypto',
	'events',
	'stream',
	'zlib',
	'timers',
];
const API_DESCRIPTIONS = {
	fs: 'your Files',
	child_process: 'launching external programs',
	net: 'your network',
	os: 'information about your computer',
};
type PluginPermissions = {
	allowed: Record<string, boolean|any>
}
const PLUGIN_SETTINGS_PATH = PathModule.join(app.getPath('userData'), 'plugin_permissions.json');
const PluginSettings: Record<string, PluginPermissions> = {};
try {
	let content = fs.readFileSync(PLUGIN_SETTINGS_PATH, {encoding: 'utf-8'});
	let data = JSON.parse(content);
	if (typeof data == 'object') {
		Object.assign(PluginSettings, data);
	}
} catch (err) {}
function savePluginSettings() {
	fs.writeFileSync(PLUGIN_SETTINGS_PATH, JSON.stringify(PluginSettings), {encoding: 'utf-8'});
}
interface GetModuleOptions {
	scope: string
}
function getModule(module_name: string, plugin_id: string, plugin: InstanceType<typeof BBPlugin>, options?: GetModuleOptions) {
	const no_namespace_name = module_name.replace(/^\w+:/, '');
	if (SAFE_APIS.includes(no_namespace_name)) {
		return originalRequire(module_name);
	}
	let permission = PluginSettings[plugin_id]?.allowed[module_name];
	let has_permission = false;
	if (permission === true) {
		has_permission = true;
	} else if (module_name == 'fs' && permission?.directories?.includes(options.scope)) {
		has_permission = true;
	}

	if (!has_permission) {
		let api_description = API_DESCRIPTIONS[module_name] ?? `the module "${module_name}"`;
		let option_text = '';
		if (module_name == 'fs' && options.scope) {
			api_description = 'a folder';
			option_text = '\nLocation: "' + options.scope.replace(/\n/g, '') + '"';
		}

		let result = dialog.showMessageBoxSync(currentwindow, {
			title: 'Plugin Permission',
			message: `Permission to access ${api_description} requested`,
			detail: `The plugin "${plugin.name}" (${plugin_id}) requires access to ${api_description}.${option_text}\nAllow?`,
			type: 'question',
			noLink: true,
			cancelId: 3,
			buttons: [
				'Allow once',
				'Always allow for this plugin',
				'Uninstall plugin',
				'Deny',
			]
		});
		enum Result {
			Once = 0,
			Always = 1,
			Uninstall = 2,
			Deny = 3
		}
		if (result == Result.Always) {
			// Save permission
			if (!PluginSettings[plugin_id]?.allowed) {
				PluginSettings[plugin_id] = {
					allowed: {}
				}
			}
			let allowed = PluginSettings[plugin_id].allowed;
			if (module_name == 'fs' && options.scope) {
				if (typeof allowed[module_name] != 'object') allowed[module_name] = {directories: []}
				allowed[module_name].directories.push(options.scope);
			} else {
				allowed[module_name] = true;
			}
			savePluginSettings();
		}
		if (result == Result.Uninstall) {
			setTimeout(() => {
				plugin.uninstall();
			}, 20);
		}
		if (!(result == Result.Once || result == Result.Always)) return;

		console.warn(`Gave plugin ${plugin_id} access to module ${module_name}`);
	}

	if (no_namespace_name == 'fs') {
		return createScopedFS(options?.scope);
	}

	return require(module_name);
}

/**
 * @internal
 */
export function getPluginScopedRequire(plugin: InstanceType<typeof BBPlugin>) {
	const plugin_id = plugin.id;
	return function require(module_id: string, options?: GetModuleOptions) {
		return getModule(module_id, plugin_id, plugin, options);
	}
}
const originalRequire = window.require;
delete window.require;

/**
 * @internal
 */
export const process = window.process;
delete window.process;

export const SystemInfo = {
	platform: process.platform,
	home_directory: os.homedir(),
	arch: process.arch,
	os_version: os.version(),
}

/**
 * @internal
 */
export function getPCUsername() {
	return process.env.USERNAME;
}
/**
 * @internal
 */
export function openFileInEditor(file_path: string, editor: string) {
	if (SystemInfo.platform == 'darwin') {
		child_process.exec(`open '${file_path}' -a '${editor}'`)
	} else {
		child_process.spawn(editor, [file_path])
	}
}

Object.assign(window, {
	SystemInfo,
});

/**
 * TODO:
 * - Ensure it still works in the web app
 */

