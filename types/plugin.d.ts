/// <reference path="./blockbench.d.ts"/>
interface PluginOptions {
	title: string
	author: string
	/**
	 * Description text in the plugin browser
	 */
	description: string
	/**
	 * The about text appears when the user unfolds the plugin in the plugin browser. It can contain additional information and usage instructions
	 */
	about?: string
	/**
	 * The version of the plugin.
	 */
	version?: string
	icon: string
	/**
	 * Plugin tags that will show up in the plugin store. You can provide up to 3 tags.
	 */
	tags?: [string, string?, string?]
	/**
	 * Where the plugin can be installed. Desktop refers to the electron app, web refers to the web app and PWA
	 */
	variant: 'both' | 'desktop' | 'web'
	/**
	 * Minimum Blockbench version in which the plugin can be installed
	 */
	min_version?: string
	/**
	 * Maximum Blockbench version in which the plugin can be installed
	 */
	max_version?: string
	/**
	 * Set to true if the plugin must finish loading before a project is opened, i. e. because it adds a format
	 */
	await_loading?: boolean
	/**
	 * Use the new repository format where plugin, iron, and about are stored in a separate folder
	 */
	new_repository_format?: boolean
	/**
	 * Can be used to specify which features a plugin adds. This allows Blockbench to be aware of and suggest even plugins that are not installed.
	 */
	contributes?: {
		formats: string[]
	}
	has_changelog?: boolean
	/**
	 * In combination with a "Deprecated" tag, this can be used to provide context on why a plugin is deprecated
	 */
	deprecation_note?: string
	/*
	 * Link to the plugin's website
	 */
	website?: string
	/*
	 * Link to the repository that contains the source for the plugin
	 */
	repository?: string
	/*
	 * Link to where users can report issues with the plugin
	 */
	bug_tracker?: string
	/*
	 * List of secondary contributors to the plugin, excluding the main author(s)
	 */
	contributors?: string[]
	/**
	 * Runs when the plugin loads
	 */
	onload?(): void
	/**
	 * Runs when the plugin unloads
	 */
	onunload?(): void
	/**
	 * Runs when the user manually installs the plugin
	 */
	oninstall?(): void
	/**
	 * Runs when the user manually uninstalls the plugin
	 */
	onuninstall?(): void
}

/**
 * A Blockbench plugin. "BBPlugin" is the Typescript alias to the regular name "Plugin", which is also valid in Javascript projects.
 */
declare class BBPlugin {
	constructor(id: string, options: PluginOptions)

	extend(options: PluginOptions): this

	installed: boolean
	id: string
	disabled: boolean
	title: string
	author: string
	/**
	 * Description text in the plugin browser
	 */
	description: string
	/**
	 * The about text appears when the user unfolds the plugin in the plugin browser. It can contain additional information and usage instructions
	 */
	about: string
	icon: string
	variant: 'both' | 'desktop' | 'web'
	version: string
	min_version: string
	max_version: string
	tags: string[]
	/**
	 * Can be used to specify which features a plugin adds. This allows Blockbench to be aware of and suggest even plugins that are not installed.
	 */
	contributes?: {
		formats: string[]
	}
	has_changelog: boolean
	/**
	 * In combination with a "Deprecated" tag, this can be used to provide context on why a plugin is deprecated
	 */
	deprecation_note?: string
	/*
	 * Link to the plugin's website
	 */
	website?: string
	/*
	 * Link to the repository that contains the source for the plugin
	 */
	repository?: string
	/*
	 * Link to where users can report issues with the plugin
	 */
	bug_tracker?: string
	/*
	 * List of secondary contributors to the plugin, excluding the main author(s)
	 */
	contributors: string[]
	onload(): void
	onunload(): void
	oninstall(): void
	onuninstall(): void

	static register(id: string, options: PluginOptions): BBPlugin

	hasImageIcon(): boolean
	getIcon(): string

	toggleDisabled(): void
}

type PluginInstalledData = {
	id: string
	version: string
	source: 'store' | 'file' | 'url'
	path?: string
	disabled?: boolean
}
declare namespace Plugins {
	/**
	 * All loaded plugins, including plugins from the store that are not installed
	 */
	const all: BBPlugin[]
	/**
	 * Data about which plugins are installed
	 */
	const installed: PluginInstalledData[]
	/**
	 * The plugins window
	 */
	const dialog: Dialog
	/**
	 * The currently used path to the plugin API
	 */
	const api_path: string
	/**
	 * Dev reload all side-loaded plugins
	 */
	function devReload(): void
	const currently_loading: string
}
