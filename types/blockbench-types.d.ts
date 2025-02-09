/// <reference types="blockbench-types" />

// Define our custom env variables
declare namespace NodeJS {
	export interface ProcessEnv {
		/**
		 * Whether to enable auto-updates
		 */
		BLOCKBENCH_AUTO_UPDATE?: 'ENABLED' | 'DISABLED'
		/**
		 * The path to the user data directory
		 */
		BLOCKBENCH_USER_DATA?: string
		/**
		 * A comma-separated list of plugin file paths or URLs to install
		 */
		BLOCKBENCH_INSTALL_CUSTOM_PLUGINS?: string
		/**
		 * A comma-separated list of plugin IDs to install from the Blockbench plugin repository
		 */
		BLOCKBENCH_INSTALL_PLUGINS?: string
		/**
		 * Whether or not to open the dev tools on startup
		 */
		BLOCKBENCH_OPEN_DEV_TOOLS?: 'TRUE' | 'FALSE'
		/**
		 * Whether or not to remove all installed plugins on startup
		 */
		BLOCKBENCH_CLEAN_INSTALLED_PLUGINS?: 'TRUE' | 'FALSE'
	}
}
