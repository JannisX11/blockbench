import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const HEADLESS_CLI_PROFILE_PREFIX = 'blockbench-headless-'

export const HeadlessExitCode = Object.freeze({
	SUCCESS: 0,
	USAGE: 2,
	INPUT: 3,
	OUTPUT: 4,
	SCRIPT: 5,
	RUNTIME: 6,
	TIMEOUT: 124,
})

export const HEADLESS_CLI_USAGE = `Usage:
  Blockbench --headless --input <model> --script <file.js> --output <result.bbmodel> [options] [-- <script args...>]
  Blockbench --headless --input <model> --eval <javascript> --output <result.bbmodel> [options] [-- <script args...>]

Options:
  -i, --input <path>    Model to open using Blockbench's normal codecs
  -s, --script <path>   JavaScript file to run against the live Blockbench globals
  -e, --eval <code>     JavaScript source to run instead of a script file
  -o, --output <path>   Destination Blockbench project (.bbmodel)
      --force           Allow replacing an existing output file
      --timeout <ms>    Whole-operation timeout (default: 60000)
  -h, --help            Show this help

The script runs in Blockbench's renderer after the input model is loaded. It can
use live globals such as Project, Cube, Group, Mesh, Texture, Undo, Canvas, and
Blockbench. Top-level await and return are supported. The variables context,
input, output, args, module, and exports are also provided. A CommonJS export
that is a function is called with context after the script body is evaluated.

This executes trusted code with the same local access as the desktop app. Each
invocation uses a new temporary Blockbench profile and exits after one action.`

export class HeadlessCLIArgumentError extends Error {
	constructor(message, exit_code = HeadlessExitCode.USAGE) {
		super(message)
		this.name = 'HeadlessCLIArgumentError'
		this.exitCode = exit_code
	}
}

function readOptionValue(argv, index, option) {
	const value = argv[index + 1]
	if (value === undefined || value === '--') {
		throw new HeadlessCLIArgumentError(`Missing value after ${option}`)
	}
	return value
}

/**
 * Parse arguments following --headless. Arguments before --headless belong to
 * Electron and are deliberately ignored.
 */
export function parseHeadlessCLIArguments(argv, cwd = process.cwd()) {
	const headless_index = argv.indexOf('--headless')
	if (headless_index === -1) return null

	const options = {
		headless: true,
		help: false,
		input: '',
		output: '',
		script: '',
		eval: '',
		force: false,
		timeout: 60_000,
		args: [],
	}

	for (let index = headless_index + 1; index < argv.length; index++) {
		const argument = argv[index]
		if (argument === '--') {
			options.args = argv.slice(index + 1)
			break
		}
		switch (argument) {
			case '-h':
			case '--help':
				options.help = true
				break
			case '-i':
			case '--input':
				options.input = readOptionValue(argv, index, argument)
				index++
				break
			case '-o':
			case '--output':
				options.output = readOptionValue(argv, index, argument)
				index++
				break
			case '-s':
			case '--script':
				options.script = readOptionValue(argv, index, argument)
				index++
				break
			case '-e':
			case '--eval':
				options.eval = readOptionValue(argv, index, argument)
				index++
				break
			case '--force':
				options.force = true
				break
			case '--timeout': {
				const value = readOptionValue(argv, index, argument)
				options.timeout = Number(value)
				index++
				break
			}
			default:
				throw new HeadlessCLIArgumentError(`Unknown headless option: ${argument}`)
		}
	}

	if (options.help) return options
	if (!options.input) throw new HeadlessCLIArgumentError('Missing required option: --input')
	if (!options.output) throw new HeadlessCLIArgumentError('Missing required option: --output')
	if (!options.script && !options.eval) {
		throw new HeadlessCLIArgumentError('Specify exactly one of --script or --eval')
	}
	if (options.script && options.eval) {
		throw new HeadlessCLIArgumentError('--script and --eval cannot be used together')
	}
	if (!Number.isInteger(options.timeout) || options.timeout < 1_000 || options.timeout > 3_600_000) {
		throw new HeadlessCLIArgumentError('--timeout must be an integer from 1000 to 3600000 milliseconds')
	}

	options.input = path.resolve(cwd, options.input)
	options.output = path.resolve(cwd, options.output)
	if (options.script) options.script = path.resolve(cwd, options.script)
	return options
}

export function validateHeadlessCLIPaths(options) {
	let input_stat
	try {
		input_stat = fs.statSync(options.input)
	} catch (error) {
		throw new HeadlessCLIArgumentError(`Input file does not exist: ${options.input}`, HeadlessExitCode.INPUT)
	}
	if (!input_stat.isFile()) {
		throw new HeadlessCLIArgumentError(`Input path is not a file: ${options.input}`, HeadlessExitCode.INPUT)
	}

	if (options.script) {
		let script_stat
		try {
			script_stat = fs.statSync(options.script)
		} catch (error) {
			throw new HeadlessCLIArgumentError(`Script file does not exist: ${options.script}`, HeadlessExitCode.SCRIPT)
		}
		if (!script_stat.isFile()) {
			throw new HeadlessCLIArgumentError(`Script path is not a file: ${options.script}`, HeadlessExitCode.SCRIPT)
		}
	}

	if (path.extname(options.output).toLowerCase() !== '.bbmodel') {
		throw new HeadlessCLIArgumentError('Output path must use the .bbmodel extension')
	}
	let output_directory_stat
	const output_directory = path.dirname(options.output)
	try {
		output_directory_stat = fs.statSync(output_directory)
	} catch (error) {
		throw new HeadlessCLIArgumentError(`Output directory does not exist: ${output_directory}`, HeadlessExitCode.OUTPUT)
	}
	if (!output_directory_stat.isDirectory()) {
		throw new HeadlessCLIArgumentError(`Output parent is not a directory: ${output_directory}`, HeadlessExitCode.OUTPUT)
	}
	if (!options.force && fs.existsSync(options.output)) {
		throw new HeadlessCLIArgumentError(
			`Output file already exists (use --force to replace it): ${options.output}`,
			HeadlessExitCode.OUTPUT,
		)
	}
	return options
}

export function createHeadlessCLIProfile() {
	return fs.mkdtempSync(path.join(os.tmpdir(), HEADLESS_CLI_PROFILE_PREFIX))
}

/**
 * Remove only a profile directory created directly under the OS temp folder.
 * Returns false when the directory was already absent.
 */
export function removeHeadlessCLIProfile(profile_path) {
	const resolved_profile = path.resolve(profile_path)
	const resolved_temp = path.resolve(os.tmpdir())
	const profile_name = path.basename(resolved_profile)
	const random_suffix = profile_name.slice(HEADLESS_CLI_PROFILE_PREFIX.length)
	if (
		path.dirname(resolved_profile) !== resolved_temp ||
		!profile_name.startsWith(HEADLESS_CLI_PROFILE_PREFIX) ||
		!/^[A-Za-z0-9]{6}$/.test(random_suffix)
	) {
		throw new Error(`Refusing to remove unexpected headless profile path: ${profile_path}`)
	}
	if (!fs.existsSync(resolved_profile)) return false
	const profile_stat = fs.lstatSync(resolved_profile)
	if (!profile_stat.isDirectory() || profile_stat.isSymbolicLink()) {
		throw new Error(`Refusing to remove non-directory headless profile path: ${profile_path}`)
	}
	fs.rmSync(resolved_profile, {recursive: true, force: false})
	return true
}
