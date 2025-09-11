import { BBPlugin } from './plugin_loader';
import { createScopedFS } from './util/scoped_fs';

const electron: typeof import('@electron/remote') = require('@electron/remote');
const { clipboard, shell, nativeImage, ipcRenderer, webUtils } =
	require('electron') as typeof import('electron');
const app = electron.app;
const fs: typeof import('node:fs') = require('node:fs');
const NodeBuffer: typeof import('node:buffer') = require('buffer');
const zlib: typeof import('node:zlib') = require('zlib');
const child_process: typeof import('node:child_process') = require('child_process');
const https: typeof import('node:https') = require('https');
const PathModule: typeof import('node:path') = require('path');
const os: typeof import('node:os') = require('os');
const currentwindow = electron.getCurrentWindow();
const dialog = electron.dialog;

/** @internal */
export {
	electron,
	clipboard,
	shell,
	ipcRenderer,
	webUtils,
	app,
	fs,
	NodeBuffer,
	zlib,
	child_process,
	https,
	PathModule,
	os,
	currentwindow,
	dialog,
	Buffer,
	nativeImage,
};

/**
 * @internal
 */
export const process = window.process;
delete window.process;

const { stringify, parse } = JSON;

const SAFE_APIS = [
	'path',
	'crypto',
	'events',
	'zlib',
	'timers',
	'url',
	'string_decoder',
	'querystring',
];
const REQUESTABLE_APIS = [
	'fs',
	'process',
	'child_process',
	'https',
	'net',
	'tls',
	'util',
	'os',
	'v8',
];
const API_DESCRIPTIONS = {
	fs: 'access and change files on your computer',
	process: 'access to the process running Blockbench',
	child_process: 'launch external programs',
	net: 'full network access',
	os: 'see information about your computer',
	https: 'create servers and talk to other servers',
	dialog: 'open native dialogs',
};
type PluginPermissions = {
	allowed: Record<string, boolean | any>;
};
const PLUGIN_SETTINGS_PATH = PathModule.join(app.getPath('userData'), 'plugin_permissions.json');
const PluginSettings: Record<string, PluginPermissions> = {};
try {
	let content = fs.readFileSync(PLUGIN_SETTINGS_PATH, { encoding: 'utf-8' });
	let data = parse(content);
	if (typeof data == 'object') {
		Object.assign(PluginSettings, data);
	}
} catch (err) {}
function savePluginSettings() {
	fs.writeFileSync(PLUGIN_SETTINGS_PATH, stringify(PluginSettings), { encoding: 'utf-8' });
}
interface GetModuleOptions {
	scope?: string;
	message?: string;
}
function getModule(
	module_name: string,
	plugin_id: string,
	plugin: InstanceType<typeof BBPlugin>,
	options: GetModuleOptions = {}
) {
	const no_namespace_name = module_name.replace(/^node:/, '');
	if (SAFE_APIS.includes(no_namespace_name)) {
		return originalRequire(module_name);
	}
	if (!REQUESTABLE_APIS.includes(no_namespace_name)) {
		throw `The module "${module_name}" is not supported`;
	}
	const options2: GetModuleOptions = {};
	for (let key in options) {
		options2[key] = options[key];
	}

	let permission = PluginSettings[plugin_id]?.allowed[module_name];
	let has_permission = false;
	if (permission === true) {
		has_permission = true;
	} else if (module_name == 'fs' && permission?.directories?.includes(options2.scope)) {
		has_permission = true;
	}

	if (!has_permission) {
		let api_description = API_DESCRIPTIONS[module_name] ?? `the module "${module_name}"`;
		let option_text = '';
		if (module_name == 'fs' && options2.scope) {
			api_description = 'a folder';
			option_text = '\nLocation: "' + options2.scope.replace(/\n/g, '') + '"';
		}

		let result = dialog.showMessageBoxSync(currentwindow, {
			title: 'Plugin Permission',
			message: `Permission to ${api_description} requested`,
			detail: `The plugin "${plugin.name}" (${plugin_id}) requires permission to ${api_description}.${option_text}${options.message ? `\n\n"${options.message}"` : ''}`,
			type: 'question',
			noLink: true,
			cancelId: 3,
			buttons: ['Allow once', 'Always allow for this plugin', 'Uninstall plugin', 'Deny'],
		});
		enum Result {
			Once = 0,
			Always = 1,
			Uninstall = 2,
			Deny = 3,
		}
		if (result == Result.Always) {
			// Save permission
			if (!PluginSettings[plugin_id]?.allowed) {
				PluginSettings[plugin_id] = {
					allowed: {},
				};
			}
			let allowed = PluginSettings[plugin_id].allowed;
			if (module_name == 'fs' && options2.scope) {
				if (typeof allowed[module_name] != 'object')
					allowed[module_name] = { directories: [] };
				allowed[module_name].directories.push(options2.scope);
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
		if (!(result == Result.Once || result == Result.Always)) {
			console.warn(`User denied access to "${module_name}" module`);
			return;
		}

		console.warn(`Gave plugin ${plugin_id} access to module ${module_name}`);
	}

	if (no_namespace_name == 'fs') {
		return createScopedFS(options2.scope);
	} else if (no_namespace_name == 'process') {
		return process;
	} else if (no_namespace_name == 'dialog') {
		let api = {};
		for (let key in dialog) {
			api[key] = (options: any) => dialog[key](currentwindow, options);
		}
		return api;
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
	};
}
const originalRequire = window.require;
delete window.require;

export function revokePluginPermissions(plugin: InstanceType<typeof BBPlugin>): string[] {
	let permissions = Object.keys(PluginSettings[plugin.id]?.allowed ?? {});
	delete PluginSettings[plugin.id];
	savePluginSettings();
	return permissions;
}
export function getPluginPermissions(plugin: InstanceType<typeof BBPlugin>) {
	let data = PluginSettings[plugin.id]?.allowed;
	if (data) return parse(stringify(data)) as Record<string, boolean | any>;
}

export const SystemInfo = {
	platform: process.platform,
	home_directory: os.homedir(),
	appdata_directory: electron.process.env.APPDATA,
	arch: process.arch,
	os_version: os.version(),
};

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
		child_process.exec(`open '${file_path}' -a '${editor}'`);
	} else {
		child_process.spawn(editor, [file_path]);
	}
}

Object.assign(window, {
	SystemInfo,
	Buffer,
});

/**
 * TODO:
 * - Ensure it still works in the web app
 */
