/// <reference types="vue" />
/// <reference types="./three" />
/// <reference types="@types/prismjs" />
/// <reference types="@types/jquery" />
/// <reference types="wintersky" />

/// <reference types="./texture_layers" />
/// <reference types="./texture_group" />
/// <reference types="./action" />
/// <reference types="./animation" />
/// <reference types="./animation_controller" />
/// <reference types="./canvas_frame" />
/// <reference types="./canvas" />
/// <reference types="./codec" />
/// <reference types="./cube" />
/// <reference types="./desktop" />
/// <reference types="./dialog" />
/// <reference types="./display_mode" />
/// <reference types="./file_system" />
/// <reference types="./format" />
/// <reference types="./global" />
/// <reference types="./group" />
/// <reference types="./index" />
/// <reference types="./interface" />
/// <reference types="./keyframe" />
/// <reference types="./legacy" />
/// <reference types="./menu" />
/// <reference types="./mesh" />
/// <reference types="./misc" />
/// <reference types="./molang" />
/// <reference types="./outliner" />
/// <reference types="./painter" />
/// <reference types="./panel" />
/// <reference types="./plugin" />
/// <reference types="./preview" />
/// <reference types="./preview_scene" />
/// <reference types="./project" />
/// <reference types="./screencam" />
/// <reference types="./textures" />
/// <reference types="./timeline" />
/// <reference types="./undo" />
/// <reference types="./util" />
/// <reference types="./uveditor" />
/// <reference types="./validator" />
/// <reference types="./shared_actions" />
/// <reference types="./display_mode" />
/// <reference types="./misc" />
/// <reference types="./util" />
/// <reference types="./math_util" />
/// <reference types="./canvas_frame" />
/// <reference types="./io" />

import { settings } from "../js/interface/settings"



declare namespace Blockbench {
	export const platform: 'web' | 'win32' | 'darwin' | 'linux'
	/**
	 * Blockbench version number
	 */
	export const version: string
	/**
	 * URL queries when opened as web app using a link that contained queries
	 */
	export const queries: { [key: string]: string } | undefined
	/**
	 * Time when Blockbench was opened
	 */
	export const openTime: Date

	/**
	 * Reloads the Blockbench window
	 */
	export function reload(): void
	/**
	 * checks if Blockbench is newer than the specified version
	 *
	 * @param version
	 * semver string
	 */
	export function isNewerThan(version: string): boolean
	/**
	 * checks if Blockbench is older than the specified version
	 *
	 * @param version
	 * semver string
	 */
	export function isOlderThan(version: string): boolean
	/**
	 * Resolves an icon string as a HTML element
	 * @param icon
	 * Material Icons, Fontawesome or custom icon string
	 * @param color
	 * CSS color
	 */
	export function getIconNode(icon: IconString, color?: string): HTMLElement
	/**
	 * Shows a passing message in the middle of the screen
	 *
	 * @param message
	 * Message
	 * @param time
	 * Time in miliseconds that the message stays up
	 */
	export function showQuickMessage(message: string, time?: number): void

	export function showStatusMessage(message: string, time?: number): void

	export function setStatusBarText(text?: string): void

	/**
	 * Display a tooltip displaying a custom text that appears next to and follows the mouse cursor
	 * @param text The text to display. Line breaks are supported. Leave empty to hide the tooltip.
	 */
	export function setCursorTooltip(text?: string): void
	/**
	 * Set the value of a progress bar
	 *
	 * @param progress
	 * Progress of the bar between 0 and 1
	 * @param time
	 * Time over which the bar is animated, in miliseconds
	 * @param bar
	 * ID of the bar element. If omitted, the main status bar will be selected
	 */
	export function setProgress(progress: number, time?: number, bar?: string): void

	/**
	 * Opens a message box
	 */
	export function showMessageBox(
		options: MessageBoxOptions,
		callback?: (
			button: number | string,
			checkbox_results: { [key: string]: boolean } | undefined,
			event: Event
		) => void
	): void

	export function textPrompt(
		title: string,
		value: string,
		callback: (value: string) => void
	): void
	/**
	 * todo
	 */
	export function showToastMessage(): Deletable
	/**
	 * Opens the specified link in the browser or in a new tab
	 */
	export function openLink(link: string): void

	/**
	 * Shows a system notification
	 * @param title Title
	 * @param text Text
	 * @param icon Url or data url pointing to an icon. Defaults to Blockbench icon
	 */
	export function notification(title: string, text: string, icon?: string): void
	/**
	 * Adds custom CSS code to Blockbench, globally. Returns an object that is deletable
	 * @param css CSS string
	 */
	export function addCSS(css: string): Deletable

	export function addFlag(flag: string): void
	export function removeFlag(flag: string): void
	export function hasFlag(flag: string): boolean

	/**
	 * Dispatches a Blockbench event.
	 * If you're using TypeScript, You can call this with the type param <EventName> to get the default event names in Blockbench, or leave the param blank for custom events.
	 * ```ts
	 * Blockbench.dispatchEvent<EventName>(...)
	 * ```
	 */
	export function dispatchEvent<E extends string>(event_name: E, data?: any): void

	/**
	 * Adds a listener to a Blockbench event.
	 * If you're using TypeScript, You can call this with the type param <EventName> to get the default event names in Blockbench, or leave the param blank for custom events.
	 * ```ts
	 * Blockbench.addListener<EventName>(...)
	 * ```
	 */
	export function addListener<E extends string>(
		event_names: E,
		callback: (data: any) => void
	): void
	/**
	 * Adds a listener to a Blockbench event.
	 * If you're using TypeScript, You can call this with the type param <EventName> to get the default event names in Blockbench, or leave the param blank for custom events.
	 * ```ts
	 * Blockbench.on<EventName>(...)
	 * ```
	 */
	export function on<E extends string>(event_names: E, callback: (data: any) => void): void

	/**
	 * Removes a listener from a Blockbench event.
	 * If you're using TypeScript, You can call this with the type param <EventName> to get the default event names in Blockbench, or leave the param blank for custom events.
	 * ```ts
	 * Blockbench.removeListener<EventName>(...)
	 * ```
	 */
	export function removeListener<E extends string>(
		event_names: E,
		callback: (data: any) => void
	): void

}

type BlockbenchTypeOutliner = typeof Outliner
type BlockbenchTypeOutlinerNode = typeof OutlinerNode
type BlockbenchTypeOutlinerElement = typeof OutlinerElement
type BlockbenchTypeGroup = typeof Group
type BlockbenchTypeCube = typeof Cube
type BlockbenchTypeMesh = typeof Mesh
type BlockbenchTypeLocator = typeof Locator
type BlockbenchTypeNullObject = typeof NullObject
type BlockbenchTypeTextureMesh = typeof TextureMesh
type BlockbenchTypeFace = typeof Face
type BlockbenchTypeCubeFace = typeof CubeFace
type BlockbenchTypeMeshFace = typeof MeshFace
type BlockbenchTypeNodePreviewController = typeof NodePreviewController
type BlockbenchTypeCollection = typeof Collection
type BlockbenchTypeAnimator = typeof Animator
type BlockbenchTypeTimeline = typeof Timeline
type BlockbenchTypeAnimationItem = typeof AnimationItem
type BlockbenchTypeAnimation = typeof _Animation
type BlockbenchTypeAnimationController = typeof AnimationController
type BlockbenchTypeKeyframe = typeof _Keyframe
type BlockbenchTypeKeyframeDataPoint = typeof KeyframeDataPoint
type BlockbenchTypeBoneAnimator = typeof BoneAnimator
type BlockbenchTypeNullObjectAnimator = typeof NullObjectAnimator
type BlockbenchTypeEffectAnimator = typeof EffectAnimator
type BlockbenchTypeTimelineMarker = typeof TimelineMarker
type BlockbenchTypePanel = typeof Panel
type BlockbenchTypeMode = typeof Mode
type BlockbenchTypeDialog = typeof Dialog
type BlockbenchTypeSetting = typeof Setting
type BlockbenchTypePlugin = typeof Plugin
type BlockbenchTypePreview = typeof Preview
type BlockbenchTypeToolbar = typeof Toolbar
type BlockbenchTypeLanguage = typeof Language
type BlockbenchTypePainter = typeof Painter
type BlockbenchTypeScreencam = typeof Screencam
type BlockbenchTypeSettings = typeof Settings
type BlockbenchTypeTextureAnimator = typeof TextureAnimator
type BlockbenchTypeToolbox = typeof Toolbox
type BlockbenchTypeBarItems = typeof BarItems
type BlockbenchTypeBarItem = typeof BarItem
type BlockbenchTypeAction = typeof Action
type BlockbenchTypeTool = typeof Tool
type BlockbenchTypeToggle = typeof Toggle
type BlockbenchTypeWidget = typeof Widget
type BlockbenchTypeBarSelect = typeof BarSelect
type BlockbenchTypeBarSlider = typeof BarSlider
type BlockbenchTypeBarText = typeof BarText
type BlockbenchTypeNumSlider = typeof NumSlider
type BlockbenchTypeColorPicker = typeof ColorPicker
type BlockbenchTypeKeybind = typeof Keybind
type BlockbenchTypeKeybindItem = typeof KeybindItem
type BlockbenchTypeMenu = typeof Menu
type BlockbenchTypeBarMenu = typeof BarMenu
type BlockbenchTypeResizeLine = typeof ResizeLine
type BlockbenchTypeModelProject = typeof ModelProject
type BlockbenchTypeModelFormat = typeof ModelFormat
type BlockbenchTypeCodec = typeof Codec
type BlockbenchTypeDisplaySlot = typeof DisplaySlot
type BlockbenchTypeReusable = typeof Reusable
type BlockbenchTypeTexture = typeof Texture
declare namespace Blockbench {
	const Outliner: BlockbenchTypeOutliner
	const OutlinerNode: BlockbenchTypeOutlinerNode
	const OutlinerElement: BlockbenchTypeOutlinerElement
	const Group: BlockbenchTypeGroup
	const Cube: BlockbenchTypeCube
	const Mesh: BlockbenchTypeMesh
	const Locator: BlockbenchTypeLocator
	const NullObject: BlockbenchTypeNullObject
	const TextureMesh: BlockbenchTypeTextureMesh
	const Face: BlockbenchTypeFace
	const CubeFace: BlockbenchTypeCubeFace
	const MeshFace: BlockbenchTypeMeshFace
	const NodePreviewController: BlockbenchTypeNodePreviewController
	const Collection: BlockbenchTypeCollection
	const Animator: BlockbenchTypeAnimator
	const Timeline: BlockbenchTypeTimeline
	const AnimationItem: BlockbenchTypeAnimationItem
	const Animation: BlockbenchTypeAnimation
	const AnimationController: BlockbenchTypeAnimationController
	const Keyframe: BlockbenchTypeKeyframe
	const KeyframeDataPoint: BlockbenchTypeKeyframeDataPoint
	const BoneAnimator: BlockbenchTypeBoneAnimator
	const NullObjectAnimator: BlockbenchTypeNullObjectAnimator
	const EffectAnimator: BlockbenchTypeEffectAnimator
	const TimelineMarker: BlockbenchTypeTimelineMarker
	const Panel: BlockbenchTypePanel
	const Mode: BlockbenchTypeMode
	const Dialog: BlockbenchTypeDialog
	const Setting: BlockbenchTypeSetting
	const Plugin: BlockbenchTypePlugin
	const Preview: BlockbenchTypePreview
	const Toolbar: BlockbenchTypeToolbar
	const Language: BlockbenchTypeLanguage
	const Painter: BlockbenchTypePainter
	const Screencam: BlockbenchTypeScreencam
	const Settings: BlockbenchTypeSettings
	const TextureAnimator: BlockbenchTypeTextureAnimator
	const Toolbox: BlockbenchTypeToolbox
	const BarItems: BlockbenchTypeBarItems
	const BarItem: BlockbenchTypeBarItem
	const Action: BlockbenchTypeAction
	const Tool: BlockbenchTypeTool
	const Toggle: BlockbenchTypeToggle
	const Widget: BlockbenchTypeWidget
	const BarSelect: BlockbenchTypeBarSelect
	const BarSlider: BlockbenchTypeBarSlider
	const BarText: BlockbenchTypeBarText
	const NumSlider: BlockbenchTypeNumSlider
	const ColorPicker: BlockbenchTypeColorPicker
	const Keybind: BlockbenchTypeKeybind
	const KeybindItem: BlockbenchTypeKeybindItem
	const Menu: BlockbenchTypeMenu
	const BarMenu: BlockbenchTypeBarMenu
	const ResizeLine: BlockbenchTypeResizeLine
	const ModelProject: BlockbenchTypeModelProject
	const ModelFormat: BlockbenchTypeModelFormat
	const Codec: BlockbenchTypeCodec
	const DisplaySlot: BlockbenchTypeDisplaySlot
	const Reusable: BlockbenchTypeReusable
	const Texture: BlockbenchTypeTexture
}

/**
 * Provides access to global Javascript/DOM variables that are overwritten by Blockbench's own variables
 */
declare const NativeGlobals: {
	Animation: {
		new (
			effect?: AnimationEffect | null | undefined,
			timeline?: AnimationTimeline | null | undefined
		): Animation
		prototype: Animation
	}
}
