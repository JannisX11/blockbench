export const electron = require('@electron/remote');
export const {clipboard, shell, nativeImage, ipcRenderer, dialog, webUtils} = require('electron');
export const app = electron.app;
export const fs = require('fs');
export const NodeBuffer = require('buffer');
export const zlib = require('zlib');
export const child_process = require('child_process');
export const https = require('https');
export const PathModule = require('path');
export const currentwindow = electron.getCurrentWindow();


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

const originalRequire = window.require;
window.require = function(module_name) {
	if (SAFE_APIS.includes(module_name) || SAFE_APIS.includes(module_name.replace(/^node:/, ''))) {
		return originalRequire(module_name);
	}

	let plugin_ids = new Set();
	let stack = (new Error().stack ?? '').split('\n');
	for (let line of stack) {
		console.log([line, line.split('(Plugin):')[1]])
		let id = line.split('(Plugin):')[1]?.split('.')[0];
		if (id) plugin_ids.add(id);
	}

	let plugin_id = Array.from(plugin_ids).join(', ');
	let api_description = API_DESCRIPTIONS[module_name] ?? `the module "${module_name}"`;
	let result = confirm(`The plugin ${plugin_id} requires access to ${api_description}. Allow?`);
	if (result == true) {
		console.warn(`Gave plugin ${plugin_id} access to module ${module_name}`);
		return require(module_name);
	}
}

/**
 * TODO:
 * - Ensure it still works in the web app
 * - Import from this file for all existing uses of these apis
 * - Remove global variables
 * - Potentially create a "trust plugin" system
 */

