
export const electron = require('@electron/remote');
export const {clipboard, shell, nativeImage, ipcRenderer, webUtils} = require('electron');
export const app = electron.app;
export const fs = require('fs');
export const NodeBuffer = require('buffer');
export const zlib = require('zlib');
export const child_process = require('child_process');
export const https = require('https');
export const PathModule = require('path');
export const currentwindow = electron.getCurrentWindow();
export const dialog = electron.dialog;


const SAFE_APIS = [
	'path',
	'crypto',
	'events',
	'stream',
	'zlib',
	'timers',
];

const API_DESCRIPTIONS = {
	fs: 'the File System',
	child_process: 'launch external programs',
	net: 'your network',
	os: 'information about your operating system',
};

const PLUGIN_SETTINGS_PATH = PathModule.join(app.getPath('userData'), 'plugin_permissions.json');
const PluginSettings = {};
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

function getModule(module_name, plugin_id) {
	if (SAFE_APIS.includes(module_name) || SAFE_APIS.includes(module_name.replace(/^node:/, ''))) {
		return originalRequire(module_name);
	}
	const has_permission = PluginSettings[plugin_id]?.allowed instanceof Array && PluginSettings[plugin_id].allowed.includes(module_name);

	if (!has_permission) {
		let api_description = API_DESCRIPTIONS[module_name] ?? `the module "${module_name}"`;
		let result = dialog.showMessageBoxSync(currentwindow, {
			title: 'Plugin Permission',
			detail: `The plugin "${plugin_id}" (${plugin_id}) requires access to ${api_description}. Allow?`,
			type: 'none',
			noLink: true,
			cancelId: 2,
			buttons: [
				'Allow this time',
				'Always allow for this plugin',
				'Deny',
			]
		});
		if (result == 1) {
			// Save permission
			if (PluginSettings[plugin_id]?.allowed instanceof Array == false) {
				PluginSettings[plugin_id] = {
					allowed: []
				}
			}
			PluginSettings[plugin_id].allowed.push(module_name);
			savePluginSettings();
		}
		if (!(result == 0 || result == 1)) return;

		console.warn(`Gave plugin ${plugin_id} access to module ${module_name}`);
	}

	return require(module_name);
}

export function getPluginScopedRequire(plugin) {
	const plugin_id = plugin.id;
	return function require(module_id) {
		return getModule(module_id, plugin_id);
	}
}
const originalRequire = window.require;
window.require = null;

/**
 * TODO:
 * - Ensure it still works in the web app
 * - Import from this file for all existing uses of these apis
 * - Remove global variables
 * - Potentially create a "trust plugin" system
 */

