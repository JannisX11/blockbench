const { app, ipcMain } = require('electron')
const PACKAGE = require('../package.json')
const { Command } = require('commander')
const pathjs = require('path')

const program = new Command()

program.name('blockbench').description(PACKAGE.description).exitOverride()

program
	.option('--version', 'output the version number', () => {
		console.log(PACKAGE.version)
		process.exit(0)
	})
	.option('--userData <path>', 'change the folder Blockbench uses to store user data')
	.option('--no-auto-update', 'disables auto update')
	.option('--with-plugin-files <paths...>', 'install plugins from the given paths')
	.option('--with-plugin-urls <urls...>', 'install plugins from the given URLs')

/**
 * Makes sure the environment variables are set to defaults if they are not set.
 *
 * Allows for overriding the default values by setting the environment variables before starting Blockbench.
 */
function affirmEnvironmentVariables() {
	process.env.BLOCKBENCH_AUTO_UPDATE ??= 'ENABLED'
	process.env.BLOCKBENCH_USER_DATA ??= app.getPath('userData')
	process.env.BLOCKBENCH_INSTALLED_PLUGIN_FILES ??= ''
	process.env.BLOCKBENCH_INSTALLED_PLUGIN_URLS ??= ''
}

function parseCLI() {
	// Parse command line arguments.
	program.parse()
	/**
	 * @type {{ userData?: string, autoUpdate?: boolean, withPluginFiles?: string[], withPluginUrls?: string[] }}
	 */
	let { userData, autoUpdate, withPluginFiles, withPluginUrls } = program.opts()

	// --no-auto-update
	if (autoUpdate === false) {
		process.env.BLOCKBENCH_AUTO_UPDATE = 'DISABLED'
	}

	// --userData
	if (userData) {
		if (!pathjs.isAbsolute(userData)) {
			// Automatically resolve relative paths.
			userData = pathjs.resolve(userData)
		}
		process.env.BLOCKBENCH_USER_DATA = userData
	}
	app.setPath('userData', process.env.BLOCKBENCH_USER_DATA)

	// --with-plugin-files
	if (withPluginFiles?.length > 0) {
		process.env.BLOCKBENCH_INSTALLED_PLUGIN_FILES = withPluginFiles.join(',')
	}
	// --with-plugin-urls
	if (withPluginUrls?.length > 0) {
		process.env.BLOCKBENCH_INSTALLED_PLUGIN_URLS = withPluginUrls.join(',')
	}
}

module.exports = function cli() {
	affirmEnvironmentVariables()

	try {
		parseCLI()
	} catch (error) {
		console.error(error)
		app.exit(1)
	}
}
