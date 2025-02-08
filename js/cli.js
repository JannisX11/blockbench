const { app, ipcMain } = require('electron')
const PACKAGE = require('../package.json')
const { Command } = require('commander')
const pathjs = require('path')

const program = new Command()

program.name('blockbench').description(PACKAGE.description)

program
	.option('-v, --version', 'output the version number', () => {
		app.terminal.log('NO_PREFIX', PACKAGE.version)
		process.exit(0)
	})
	.option('--userData <path>', 'change the folder Blockbench uses to store user data')
	.option('--no-auto-update', 'disables auto update')
	.option('--with-plugin-files <paths...>', 'install plugins from the given paths on startup')
	.option('--with-plugin-urls <urls...>', 'install plugins from the given URLs on startup')
	.option('--open-dev-tools', 'open the developer tools on startup')
	// Custom Error Handling
	.exitOverride(error => {
		switch (error.code) {
			case 'commander.help':
			case 'commander.helpDisplayed':
			case 'commander.version':
				process.exit(0)
			case 'commander.unknownOption':
			case 'commander.excessArguments':
				// Uses ANSI escape codes to clear the previous line and print a warning message.
				app.terminal.log('NO_PREFIX', '\x1b[1A\x1b[2K\x1b[33mUse --help to see available options\x1b[0m')
				process.exit(1)
			default:
				app.terminal.error('\x1b[2;31m%s\x1b[0m', error)
				process.exit(1)
		}
	})
	.configureOutput({
		getOutHasColors: () => true,
		writeErr: str => {
			console.error('\x1b[91m%s\x1b[0m', str)
		},
	})
	// Custom Help Styling
	.configureHelp({
		styleTitle(str) {
			return `\x1b[1m${str}\x1b[0m`
		},
		styleCommandText(str) {
			return `\x1b[36m${str}\x1b[0m`
		},
		styleCommandDescription(str) {
			return `\x1b[1A\x1b[2K\x1b[35m${str}\x1b[0m`
		},
		styleDescriptionText(str) {
			return `\x1b[3m${str}\x1b[0m`
		},
		styleOptionText(str) {
			return `\x1b[32m${str}\x1b[0m`
		},
		styleArgumentText(str) {
			return `\x1b[33m${str}\x1b[0m`
		},
		styleSubcommandText(str) {
			return `\x1b[34m${str}\x1b[0m`
		},
	})

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
	process.env.BLOCKBENCH_OPEN_DEV_TOOLS ??= 'FALSE'
}

function parseCLI() {
	// Parse command line arguments.
	program.parse()
	/**
	 * @type {{ userData?: string, autoUpdate?: boolean, withPluginFiles?: string[], withPluginUrls?: string[] }}
	 */
	let { userData, autoUpdate, withPluginFiles, withPluginUrls, openDevTools } = program.opts()

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
	// --open-dev-tools
	if (openDevTools) {
		process.env.BLOCKBENCH_OPEN_DEV_TOOLS = 'TRUE'
	}
}

module.exports = function cli() {
	affirmEnvironmentVariables()

	try {
		parseCLI()
	} catch (error) {
		app.terminal.error(error)
		app.exit(1)
	}
}
