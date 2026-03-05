import { FormElementOptions } from "./interface/form";
import type { ModelFormat } from "./io/format";
import { Prop } from "./misc";
import { EventSystem } from "./util/event_system";
import VersionUtil from './util/version_util';
import { Filesystem } from "./file_system";
import { MessageBoxOptions } from "./interface/dialog";
import { currentwindow, electron, shell, SystemInfo } from "./native_apis";
import type { SplineCurve, SplineHandle, SplineMesh } from "./outliner/types/spline_mesh";
import type { BillboardFace } from "./outliner/types/billboard";
import type { Keyframe } from "./animations/keyframe";
import type { ModelProject } from "./io/project";
import type { ModelLoader } from "./io/model_loader";
import type { Plugin } from "./plugin_loader";

declare const appVersion: string;
declare let Format: ModelFormat


interface ToastNotificationOptions {
	/**
	 * Text message
	 */
	text: string
	/**
	 * Blockbench icon string
	 */
	icon?: IconString
	/**
	 * Expire time in miliseconds
	 */
	expire?: number
	/**
	 * Background color, accepts any CSS color string
	 */
	color?: string
	/**
	 * Method to run on click.
	 * @returns Return `true` to close toast
	 */
	click?: (event: Event) => boolean
}
export const LastVersion = localStorage.getItem('last_version') || localStorage.getItem('welcomed_version') || appVersion;

// @ts-ignore
// const previous_data = window.Blockbench as {};

export class Blockbench {
	//...previous_data,
	static isWeb = !isApp
	static isMobile = (window.innerWidth <= 960 || window.innerHeight <= 500) && 'ontouchend' in document
	static isLandscape = window.innerWidth > window.innerHeight
	static isTouch = 'ontouchend' in document
	static get isPWA() {
		return 'standalone' in navigator || window.matchMedia('(display-mode: standalone)').matches;
	}
	static version = appVersion
	static operating_system = ''
	static platform = 'web'
	static flags = []
	static drag_handlers = {}
	static events: Record<string, Function[]> = {}
	static openTime = new Date()
	static setup_successful: null | true = null
	static argv = isApp ? electron.process?.argv?.slice() : null
	/**
	 * @deprecated Use Undo.initEdit and Undo.finishEdit instead
	 */
	static edit(aspects: UndoAspects, cb: () => void) {
		Undo.initEdit(aspects)
		cb();
		Undo.finishEdit('Edit')
	}
	static reload() {
		if (isApp) {
			Blockbench.setProgress(0)
			Blockbench.addFlag('allow_closing')
			Blockbench.addFlag('allow_reload')
			location.reload()
		} else {
			location.reload()
		}
	}
	static isNewerThan(version: string): boolean {
		return VersionUtil.compare(Blockbench.version, '>', version);
	}
	static isOlderThan(version: string): boolean {
		return VersionUtil.compare(Blockbench.version, '<', version);
	}
	static registerEdit() {
		console.warn('Blockbench.registerEdit is outdated. Please use Undo.initEdit and Undo.finishEdit')
	}
	//Interface
	static getIconNode(icon: IconString | boolean | HTMLElement | (() => (IconString | boolean | HTMLElement)), color?: string): HTMLElement {
		let node;
		if (typeof icon === 'function') {
			icon = icon()
		}
		if (icon === undefined) {
			//Missing
			node = document.createElement('i');
			node.classList.add('material-icons', 'notranslate', 'icon');
			node.innerText = 'help_outline';
		} else if (icon instanceof HTMLElement) {
			//Node
			node = icon
		} else if (icon === true || icon === false) {
			//Boolean
			node = document.createElement('i');
			node.classList.add('material-icons', 'notranslate', 'icon');
			node.innerText = icon ? 'check_box' : 'check_box_outline_blank';

		} else if (icon === null) {
			//Node
			node = document.createElement('i');
			node.classList.add('fa_big', 'icon');

		} else if (icon.match(/^(fa[.-])|(fa[rsb]\.)/)) {
			//Font Awesome
			node = document.createElement('i');
			node.classList.add('fa_big', 'icon');
			if (icon.substr(3, 1) === '.') {
				node.classList.add(icon.substr(0, 3), icon.substr(4));
			} else {
				node.classList.add('fa', icon);
			}
		} else if (icon.substr(0, 5) === 'icon-') {
			//Icomoon
			node = document.createElement('i');
			node.classList.add(icon, 'icon');
		} else if (icon.startsWith('data:image/')) {
			//Data URL
			node = document.createElement('img');
			node.classList.add('icon');
			node.src = icon;
		} else {
			//Material Icon
			node = document.createElement('i');
			node.classList.add('material-icons', 'notranslate', 'icon');
			node.innerText = icon;
		}
		if (color) {
			if (color === 'x') {
				node.classList.add('color_x');
			} else if (color === 'y') {
				node.classList.add('color_y');
			} else if (color === 'z') {
				node.classList.add('color_z');
			}  else if (color === 'u') {
				node.classList.add('color_u');
			}   else if (color === 'v') {
				node.classList.add('color_v');
			}   else if (color === 'w') {
				node.classList.add('color_w');
			} else if (typeof color === 'string') {
				node.style.color = color;
			}
		}
		return node
	}
	static showQuickMessage(message, time = 1000) {
		document.getElementById('quick_message_box')?.remove();
		let quick_message_box = Interface.createElement('div', {id: 'quick_message_box'}, tl(message));
		document.body.append(quick_message_box);

		setTimeout(function() {
			quick_message_box.remove()
		}, time);
	}

	static showToastNotification(options: ToastNotificationOptions) {
		let notification = document.createElement('li');
		notification.className = 'toast_notification';
		if (options.icon) {
			let icon = Blockbench.getIconNode(options.icon);
			notification.append(icon);
		}
		let text = document.createElement('span');
		text.innerText = tl(options.text);
		notification.append(text);

		let close_button = document.createElement('div');
		close_button.innerHTML = '<i class="material-icons">clear</i>';
		close_button.className = 'toast_close_button';
		close_button.addEventListener('click', (event) => {
			notification.remove();
		})
		notification.append(close_button);

		if (options.color) {
			notification.style.backgroundColor = options.color;
		}
		if (typeof options.click == 'function') {
			notification.addEventListener('click', (event) => {
				if (event.target == close_button || (event.target as HTMLElement).parentElement == close_button) return;
				let result = options.click(event);
				if (result == true) {
					notification.remove();
				}
			})
			notification.style.cursor = 'pointer';
		}

		if (options.expire) {
			setTimeout(() => {
				notification.remove();
			}, options.expire);
		}

		document.getElementById('toast_notification_list').append(notification);

		function deletableToast(node: HTMLElement) {
			this.delete = function() {
				node.remove();
			}
		}
		return new deletableToast(notification);
	}
	static setCursorTooltip(text?: string): void {}
	static setProgress(progress: number, time: number = 0, bar?: string): void {}
	static showStatusMessage(message: string, time: number = 800) {
		Blockbench.setStatusBarText(tl(message))
		setTimeout(function() {
			Blockbench.setStatusBarText()
		}, time);
	}
	static setStatusBarText(text?: string) {
		if (text !== undefined) {
			Prop.file_name = text
		} else {
			Prop.file_name = Prop.file_name_alt||''
		}
	}
	static showMessage(message, location) {
		if (location === 'status_bar') {
			Blockbench.showStatusMessage(message)
		} else if (location === 'center') {
			Blockbench.showQuickMessage(message)
		}
	}
	static showMessageBox(options: MessageBoxOptions, cb?: (button: number | string, result?: Record<string, boolean>, event?: Event) => void) {
		return new MessageBox(options, cb).show();
	}
	/**
	 *
	 * @param {*} title
	 * @param {*} value
	 * @param {*} callback
	 * @param {object} options Options
	 * @param {string} options.info Info text
	 * @param {string} options.description Description for the text input
	 * @returns {Promise<string>} Input value
	 */
	static async textPrompt(title: string, value: string, callback: (text: string) => void, options: {placeholder?: string, description?: string, info?: string} = {}) {
		if (typeof options == 'string') {
			options = {placeholder: options};
			console.warn('textPrompt: 4th argument is expected to be an object');
		}
		let answer = await new Promise((resolve) => {
			let form: Record<string, FormElementOptions> = {
				text: {type: 'text', full_width: true, placeholder: options.placeholder, value, description: options.description},
			};
			if (options.info) {
				form.description = {
					type: 'info',
					text: tl(options.info)
				}
			}
			new Dialog({
				id: 'text_input',
				title: title || 'dialog.input.title',
				form,
				onConfirm({text}) {
					if (callback) callback(text);
					resolve(text);
				},
				onOpen() {
					this.object.querySelector('input')?.focus();
				}
			}).show();
		});
		return answer;
	}
	static addMenuEntry(name: string, icon: IconString, click) {
		console.warn('Blockbench.addMenuEntry is deprecated. Please use Actions instead.')
		let id = name.replace(/\s/g, '').toLowerCase();
		var action = new Action(id, {icon: icon, name: name, click: click})
		MenuBar.addAction(action, 'tools')
	}
	static removeMenuEntry(name: string) {
		let id = name.replace(/\s/g, '').toLowerCase();
		MenuBar.removeAction('tools.'+id);
	}
	static openLink(link: string) {
		if (isApp) {
			shell.openExternal(link)
		} else {
			window.open(link)
		}
	}
	static notification(title: string, text: string, icon?: string) {
		Notification.requestPermission().then(status => {
			if (status == 'granted') {
				let n = new Notification(title, {body: text, icon: icon||'favicon.png'})
				n.onclick = function() {
					if (isApp) {
						// @ts-ignore
						currentwindow.focus();
					} else {
						window.focus();
					}
				}
			}
		})
	}
	//CSS
	static addCSS(css: string, layer: string = 'plugin'): Deletable {
		let style_node = document.createElement('style');
		style_node.setAttribute('type', 'text/css');
		if (layer != '') css = `@layer ${layer} {${css}}`;
		style_node.appendChild(document.createTextNode(css));
		document.getElementsByTagName('head')[0].appendChild(style_node);
		function deletableStyle(node) {
			this.delete = function() {
				node.remove();
			}
		}
		return new deletableStyle(style_node);
	}
	//Flags
	static addFlag(flag: string): void {
		this.flags[flag] = true;
	}
	static removeFlag(flag: string): void {
		delete this.flags[flag];
	}
	static hasFlag(flag: string): boolean | undefined {
		return this.flags[flag];
	}
	//Events
	static dispatchEvent<T extends BlockbenchEventName, D extends BlockbenchEventMap[T]>(event_name: T, data: D): any[] {
		let list = Blockbench.events[event_name];
		let results: any[];
		if (list) {
			results = [];
			for (let i = 0; i < list.length; i++) {
				if (typeof list[i] === 'function') {
					let result = list[i](data);
					results.push(result);
				}
			}
		}
		if (Validator.triggers.includes(event_name)) {
			Validator.validate(event_name);
		}
		return results;
	}
	static on<T extends BlockbenchEventName, D extends BlockbenchEventMap[T]>(event_name: T, cb: (data: D) => any): Deletable {
		return EventSystem.prototype.on.call(this, event_name, cb);
	}
	static once<T extends BlockbenchEventName, D extends BlockbenchEventMap[T]>(event_name: T, cb: (data: D) => any): Deletable {
		return EventSystem.prototype.once.call(this, event_name, cb);
	}
	static addListener<T extends BlockbenchEventName, D extends BlockbenchEventMap[T]>(event_name: T, cb: (data: D) => any): Deletable {
		return EventSystem.prototype.addListener.call(this, event_name, cb);
	}
	static removeListener<T extends BlockbenchEventName, D extends BlockbenchEventMap[T]>(event_name: T, cb: (data: D) => any): void {
		return EventSystem.prototype.removeListener.call(this, event_name, cb);
	}
	// Update
	static onUpdateTo(version, callback) {
		if (LastVersion && VersionUtil.compare(version, '>', LastVersion) && !Blockbench.isOlderThan(version)) {
			callback(LastVersion);
		}
	}

	// Globals
	static Format: (ModelFormat | number) = 0
	static Project: (ModelProject | number) = 0
	static get Undo() {
		return Blockbench.Project instanceof Blockbench.ModelProject ? Blockbench.Project.undo : undefined;
	}
	// File System
	static import = Filesystem.importFile
	static importFile = Filesystem.importFile
	static pickDirectory = Filesystem.pickDirectory
	static read = Filesystem.readFile
	static readFile = Filesystem.readFile
	static export = Filesystem.exportFile
	static exportFile = Filesystem.exportFile
	static writeFile = Filesystem.writeFile
	static findFileFromContent = Filesystem.findFileFromContent
	static addDragHandler = Filesystem.addDragHandler
	static removeDragHandler = Filesystem.removeDragHandler

	static Outliner: typeof Outliner
	static OutlinerNode: typeof OutlinerNode
	static OutlinerElement: typeof OutlinerElement
	static Group: typeof Group
	static Cube: typeof Cube
	static Mesh: typeof Mesh
	static Locator: typeof Locator
	static NullObject: typeof NullObject
	static TextureMesh: typeof TextureMesh
	static SplineMesh: typeof SplineMesh

	static Face: typeof Face
	static CubeFace: typeof CubeFace
	static MeshFace: typeof MeshFace
	static BillboardFace: typeof BillboardFace
	static SplineHandle: typeof SplineHandle
	static SplineCurve: typeof SplineCurve
	static NodePreviewController: typeof NodePreviewController

	static Animator: typeof Animator
	static Timeline: typeof Timeline
	static AnimationItem: typeof AnimationItem
	static Animation: typeof _Animation
	static AnimationController: typeof AnimationController
	static AnimationControllerState: typeof AnimationControllerState
	static Keyframe: typeof Keyframe
	static KeyframeDataPoint: typeof KeyframeDataPoint
	static BoneAnimator: typeof BoneAnimator
	static NullObjectAnimator: typeof NullObjectAnimator
	static EffectAnimator: typeof EffectAnimator
	static TimelineMarker: typeof TimelineMarker

	static Panel: typeof Panel
	static Mode: typeof Mode
	static Dialog: typeof Dialog
	static ShapelessDialog: typeof ShapelessDialog
	static ToolConfig: typeof ToolConfig
	static InputForm: typeof InputForm
	static Setting: typeof Setting
	static Plugin: typeof Plugin
	static Preview: typeof Preview
	static Toolbar: typeof Toolbar

	static Language: typeof Language
	static Painter: typeof Painter
	static Screencam: typeof Screencam
	static Settings: typeof Settings
	static TextureAnimator: typeof TextureAnimator
	static Toolbox: typeof Toolbox
	static BarItems: typeof BarItems

	static BarItem: typeof BarItem
	static Action: typeof Action
	static Tool: typeof Tool
	static Toggle: typeof Toggle
	static Widget: typeof Widget
	static BarSelect: typeof BarSelect
	static BarSlider: typeof BarSlider
	static BarText: typeof BarText
	static NumSlider: typeof NumSlider
	static ColorPicker: typeof ColorPicker
	static Keybind: typeof Keybind
	static KeybindItem: typeof KeybindItem
	static Menu: typeof Menu
	static BarMenu: typeof BarMenu
	static ResizeLine: typeof ResizeLine

	static ModelProject: typeof ModelProject
	static ModelFormat: typeof ModelFormat
	static ModelLoader: typeof ModelLoader
	static Codec: typeof Codec
	static DisplaySlot: typeof DisplaySlot
	static Reusable: typeof Reusable

	static Texture: typeof Texture
	static TextureLayer: typeof TextureLayer
	static SharedActions: typeof SharedActions
}

(function() {
	if (!LastVersion || LastVersion.replace(/.\d+$/, '') != appVersion.replace(/.\d+$/, '')) {
		Blockbench.addFlag('after_update');
	} else if (LastVersion != appVersion) {
		Blockbench.addFlag('after_patch_update');
	}
	try {
		let ui_mode = JSON.parse(localStorage.getItem('settings')).interface_mode.value;
		if (ui_mode == 'desktop') Blockbench.isMobile = false;
		if (ui_mode == 'mobile') Blockbench.isMobile = true;
	} catch (err) {}
})();

if (isApp) {
	Blockbench.platform = SystemInfo.platform;
	switch (Blockbench.platform) {
		case 'win32': 	Blockbench.operating_system = 'Windows'; break;
		case 'darwin': 	Blockbench.operating_system = 'macOS'; break;
		default:		Blockbench.operating_system = 'Linux'; break;
	}
	// @ts-ignore
	if (Blockbench.platform.includes('win32') === true) window.osfs = '\\';
}

const global = {
	LastVersion,
	Blockbench,
	isApp
}
declare global {
	const LastVersion: typeof global.LastVersion
	const Blockbench: typeof global.Blockbench
}
Object.assign(window, global);
