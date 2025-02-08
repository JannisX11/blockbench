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
		 * A comma-separated list of plugin file paths
		 */
		BLOCKBENCH_PLUGIN_FILES?: string
		/**
		 * A comma-separated list of plugin URLs
		 */
		BLOCKBENCH_PLUGIN_URLS?: string
	}
}
