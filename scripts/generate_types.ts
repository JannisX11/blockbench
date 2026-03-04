import chalk from 'chalk'
import { spawn } from 'child_process'
import chokidar from 'chokidar'
import { readdir, readFile, rm, stat, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import config from '../types/type_config.json' with { type: 'json' }

const GENERATED_TYPES_DIR = './types/generated'

/**
 * Convert all auto-generated type definitions to declare globally instead of exporting
 * Removes empty files and excluded files
 */

let working = false
let processedFileCount = 0
let deletedFileCount = 0

function isComment(line: string) {
	return line.startsWith('/*') || line.startsWith(' *') || line.startsWith('//')
}

async function compileTypeDefinitions() {
	console.log(chalk.blue('⚙️  Compiling type definitions...\n'))
	return new Promise<void>((resolve, reject) =>
		spawn('tsc', ['--project', 'tsconfig.json'], { stdio: 'inherit' })
			.on('close', code => {
				if (code !== 0) {
					console.error(
						chalk.red('\n🚨 TypeScript compilation compiled with type warnings!')
					)
				} else {
					console.log(chalk.blue('\n✅ Type definitions compiled successfully.\n'))
				}
				resolve()
			})
			.on('error', error => {
				console.error(
					chalk.red('⚠️  Unexpected error during type definition compilation:'),
					error
				)
				reject(error)
			})
	)
}

function transformFileContents(content: string, path: string) {
	if (content.match(/\ndeclare global {/)) return content

	// TODO: Handle comments
	let lines = content.split(/\r?\n/)
	let output_lines = []
	let i = 0
	let global_scope = false
	let comment_stash = []
	for (let line of lines) {
		if (global_scope) {
			if (line.startsWith('}') || line.startsWith('  ')) {
				output_lines.push('    ' + line)
			} else if (
				(line.startsWith('export ') || line.startsWith('interface')) &&
				!line.startsWith('export {}')
			) {
				for (let comment of comment_stash) {
					output_lines.push('    ' + comment)
				}
				comment_stash.length = 0
				let shorter_line = line.replace(/^export (default )?(declare )?/, '')
				output_lines.push('    ' + shorter_line)
			} else if (isComment(line)) {
				// Comment
				comment_stash.push(line)
			} else {
				output_lines.push('}')
				global_scope = false
				output_lines.push(line)
			}
		} else if (
			(line.startsWith('export ') || line.startsWith('interface')) &&
			!line.startsWith('export {}')
		) {
			output_lines.push('declare global {')
			for (let comment of comment_stash) {
				output_lines.push('    ' + comment)
			}
			comment_stash.length = 0
			let shorter_line = line.replace(/^export (default )?(declare )?/, '')
			output_lines.push('    ' + shorter_line)
			global_scope = true
		} else if (isComment(line)) {
			// Comment
			comment_stash.push(line)
		} else {
			if (comment_stash.length) {
				output_lines.push(...comment_stash)
				comment_stash.length = 0
			}
			if (line) output_lines.push(line)
		}
		i++
	}
	if (output_lines.includes('export {};') == false) {
		output_lines.push('export {};')
	}
	output_lines = output_lines.map(line => {
		return line.replace(/, }/g, ' }')
	})
	output_lines.push('')
	let result = output_lines.join('\n')
	return result
}

function normalizePath(path: string) {
	return path.replaceAll('\\', '/')
}

function isExcluded(path: string) {
	const base = path.replace(/(.d)?.ts$/, '')
	return config.exclude.some(excluded => normalizePath(base).endsWith(excluded))
}

async function processFile(path: string) {
	if (isExcluded(path)) {
		await unlink(path)
		deletedFileCount++
		return
	}

	const fileContent = await readFile(path, { encoding: 'utf-8' })
	const processedContent = transformFileContents(fileContent, path)

	if (processedContent == undefined || processedContent.replace('export {};', '').length < 5) {
		await unlink(path)
		deletedFileCount++
		return
	}

	if (processedContent != fileContent) {
		await writeFile(path, processedContent, { encoding: 'utf-8' })
		processedFileCount++
	}
}

async function processDirectoryContents(path: string) {
	for (const item of await readdir(path)) {
		const itemPath = join(path, item)
		const stats = await stat(itemPath)

		if (stats.isDirectory()) {
			await processDirectoryContents(itemPath)
		} else {
			await processFile(itemPath)
		}
	}
}

async function convertTypes() {
	processedFileCount = 0
	deletedFileCount = 0
	await compileTypeDefinitions()
	await processDirectoryContents(GENERATED_TYPES_DIR)
	console.log(
		chalk.green(
			`\n✅ Done! ${chalk.cyan(processedFileCount)} files processed, ${chalk.red(deletedFileCount)} files deleted.`
		)
	)
}

const onUpdate = async (path: string) => {
	if (working) return // Prevent multiple simultaneous executions
	working = true

	console.log(chalk.blue(`📝 Change detected: ${path}\n`))
	try {
		await convertTypes()
	} finally {
		working = false
	}
}

async function main() {
	// Cleanup old generated types before starting
	console.log(chalk.blue('🧹 Cleaning up old generated types...'))
	await rm(GENERATED_TYPES_DIR, { recursive: true, force: true })
	// Generate types for the first time
	await convertTypes()

	if (process.argv.includes('--watch')) {
		chokidar
			.watch('./js', { ignoreInitial: true, awaitWriteFinish: true })
			.on('ready', () => {
				console.log(chalk.blue('👀 Watching for changes...'))
			})
			.on('change', onUpdate)
			.on('add', onUpdate)
			.on('unlink', onUpdate)
	}
}

void main()
