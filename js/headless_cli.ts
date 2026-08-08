import { Blockbench } from './api';
import { Codecs } from './io/codec';
import { loadModelFile } from './io/io';
import { fs, ipcRenderer, PathModule } from './native_apis';

interface HeadlessCLIOptions {
	input: string
	output: string
	script: string
	eval: string
	force: boolean
	timeout: number
	args: string[]
}

const HeadlessExitCode = {
	INPUT: 3,
	OUTPUT: 4,
	SCRIPT: 5,
	RUNTIME: 6,
} as const;

class HeadlessCLIError extends Error {
	exitCode: number

	constructor(message: string, exit_code: number) {
		super(message);
		this.name = 'HeadlessCLIError';
		this.exitCode = exit_code;
	}
}

function serializeError(error: unknown) {
	const normalized = error instanceof Error ? error : new Error(String(error));
	return {
		name: normalized.name,
		message: normalized.message,
		stack: normalized.stack,
	};
}

function serializeValue(value: unknown): unknown {
	if (value === undefined) return null;
	try {
		return JSON.parse(JSON.stringify(value));
	} catch (error) {
		return String(value);
	}
}

function formatLogValue(value: unknown): string {
	if (typeof value === 'string') return value;
	if (value instanceof Error) return value.stack || value.message;
	try {
		return JSON.stringify(value);
	} catch (error) {
		return String(value);
	}
}

function createScriptConsole() {
	const script_console = {} as Record<string, (...values: unknown[]) => void>;
	for (const level of ['debug', 'log', 'info', 'warn', 'error']) {
		script_console[level] = (...values: unknown[]) => {
			ipcRenderer.send('headless-cli-log', {
				level,
				message: values.map(formatLogValue).join(' '),
			});
		};
	}
	return script_console;
}

async function waitForTextures(): Promise<void> {
	const pending = Texture.all.map(texture => {
		const image = texture.img as HTMLImageElement;
		if (!image || image.complete) return Promise.resolve();
		return new Promise<void>(resolve => {
			const finish = () => {
				image.removeEventListener('load', finish);
				image.removeEventListener('error', finish);
				resolve();
			};
			image.addEventListener('load', finish, {once: true});
			image.addEventListener('error', finish, {once: true});
		});
	});
	await Promise.all(pending);
	// Let Texture.onload finish its project and canvas updates.
	await new Promise<void>(resolve => setTimeout(resolve, 0));
}

async function executeScript(options: HeadlessCLIOptions) {
	let source = options.eval;
	let source_name = 'blockbench-headless-eval.js';
	if (options.script) {
		try {
			source = fs.readFileSync(options.script, 'utf8');
			source_name = options.script.replace(/[\r\n]/g, '');
		} catch (error) {
			throw new HeadlessCLIError(`Unable to read script: ${options.script}`, HeadlessExitCode.SCRIPT);
		}
	}

	const context = {
		input: options.input,
		output: options.output,
		args: options.args.slice(),
		Blockbench,
		globals: window,
		get project() {
			return Project;
		},
		waitForTextures,
	};
	const module = {exports: {}} as {exports: any};
	const exports = module.exports;
	const script_console = createScriptConsole();
	const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
	let result;
	try {
		const fn = new AsyncFunction(
			'context',
			'input',
			'output',
			'args',
			'console',
			'module',
			'exports',
			`"use strict";\n${source}\n//# sourceURL=${source_name}`,
		);
		result = await fn.call(
			window,
			context,
			options.input,
			options.output,
			options.args.slice(),
			script_console,
			module,
			exports,
		);
		const exported_function = typeof module.exports === 'function'
			? module.exports
			: (typeof module.exports?.default === 'function' ? module.exports.default : null);
		if (exported_function) {
			result = await exported_function.call(window, context);
		} else if (result === undefined && module.exports !== exports) {
			result = module.exports;
		}
	} catch (error) {
		if (error instanceof HeadlessCLIError) throw error;
		const normalized = error instanceof Error ? error : new Error(String(error));
		const wrapped = new HeadlessCLIError(normalized.message, HeadlessExitCode.SCRIPT);
		wrapped.name = normalized.name;
		wrapped.stack = normalized.stack;
		throw wrapped;
	}
	return result;
}

async function runHeadlessCLIAction(options: HeadlessCLIOptions) {
	const started_at = performance.now();
	let phase = 'input';
	try {
		let content: string;
		try {
			content = fs.readFileSync(options.input, 'utf8');
		} catch (error) {
			throw new HeadlessCLIError(`Unable to read input model: ${options.input}`, HeadlessExitCode.INPUT);
		}

		phase = 'load';
		const input_codec = loadModelFile({
			name: PathModule.basename(options.input),
			path: options.input,
			content,
		}, {silent: true});
		if (!input_codec || !(Project instanceof ModelProject)) {
			throw new HeadlessCLIError(`Blockbench could not load input model: ${options.input}`, HeadlessExitCode.INPUT);
		}
		await waitForTextures();

		phase = 'script';
		const script_result = await executeScript(options);

		phase = 'output';
		if (!(Project instanceof ModelProject)) {
			throw new HeadlessCLIError('The script closed the active project; there is nothing to save', HeadlessExitCode.OUTPUT);
		}
		if (!options.force && fs.existsSync(options.output)) {
			throw new HeadlessCLIError(
				`Output file already exists (use --force to replace it): ${options.output}`,
				HeadlessExitCode.OUTPUT,
			);
		}
		Project.save_path = options.output;
		Project.name = PathModule.basename(options.output, PathModule.extname(options.output));
		try {
			const output_content = await Promise.resolve(Codecs.project.compile());
			if (!options.force) {
				// Atomically reserve the destination after compilation. This closes the
				// preflight-check race when independent agents choose the same output.
				const reservation = fs.openSync(options.output, 'wx');
				fs.closeSync(reservation);
			}
			Codecs.project.write(output_content, options.output);
		} catch (error) {
			if (error instanceof HeadlessCLIError) throw error;
			const message = error instanceof Error ? error.message : String(error);
			throw new HeadlessCLIError(`Unable to save output model: ${message}`, HeadlessExitCode.OUTPUT);
		}
		if (!fs.existsSync(options.output) || !fs.statSync(options.output).isFile()) {
			throw new HeadlessCLIError(`Blockbench did not create output model: ${options.output}`, HeadlessExitCode.OUTPUT);
		}

		ipcRenderer.send('headless-cli-result', {
			ok: true,
			phase: 'complete',
			exitCode: 0,
			format: Format.id,
			elements: Outliner.elements.length,
			durationMs: Math.round(performance.now() - started_at),
			result: serializeValue(script_result),
		});
	} catch (error) {
		ipcRenderer.send('headless-cli-result', {
			ok: false,
			phase,
			exitCode: error instanceof HeadlessCLIError ? error.exitCode : HeadlessExitCode.RUNTIME,
			error: serializeError(error),
			durationMs: Math.round(performance.now() - started_at),
		});
	}
}

let initialized = false;

export function initializeHeadlessCLI(): void {
	if (!Blockbench.isHeadless || initialized) return;
	initialized = true;
	ipcRenderer.once('headless-cli-run', (event, options: HeadlessCLIOptions) => {
		runHeadlessCLIAction(options);
	});
}
