import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import test from 'node:test'
import {setTimeout as wait} from 'node:timers/promises'

import electron from 'electron'

const repository = path.resolve(import.meta.dirname, '..')
const executable = process.env.BLOCKBENCH_EXECUTABLE || electron
const application_arguments = process.env.BLOCKBENCH_EXECUTABLE ? [] : ['.']

function listHeadlessProfiles() {
	return new Set(fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('blockbench-headless-')))
}

async function assertNoNewProfiles(before) {
	for (let attempt = 0; attempt < 50; attempt++) {
		const added = [...listHeadlessProfiles()].filter(name => !before.has(name))
		if (!added.length) return
		await wait(100)
	}
	const added = [...listHeadlessProfiles()].filter(name => !before.has(name))
	assert.deepEqual(added, [], `Leaked temporary profiles: ${added.join(', ')}`)
}

function parseResult(stdout) {
	const lines = stdout.trim().split(/\r?\n/).reverse()
	for (const line of lines) {
		try {
			const value = JSON.parse(line)
			if (typeof value.ok === 'boolean' && Number.isInteger(value.exitCode)) return value
		} catch (error) {}
	}
	throw new Error(`No headless result found in stdout:\n${stdout}`)
}

test('prints help without booting the renderer', () => {
	const run = spawnSync(executable, [
		...application_arguments,
		'--headless',
		'--help',
	], {
		cwd: repository,
		encoding: 'utf8',
		timeout: 10_000,
	})

	assert.equal(run.error, undefined, run.error?.stack)
	assert.equal(run.status, 0, run.stderr)
	assert.match(run.stdout.trimStart(), /^Usage:\r?\n  Blockbench --headless/)
})

test('reports preflight failures as structured results', t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blockbench-cli-e2e-preflight-'))
	t.after(() => fs.rmSync(directory, {recursive: true, force: false}))
	const run = spawnSync(executable, [
		...application_arguments,
		'--headless',
		'--input', path.join(directory, 'missing.bbmodel'),
		'--eval', 'return true',
		'--output', path.join(directory, 'output.bbmodel'),
	], {
		cwd: repository,
		encoding: 'utf8',
		timeout: 10_000,
	})

	assert.equal(run.error, undefined, run.error?.stack)
	assert.equal(run.status, 3, run.stderr)
	const result = parseResult(run.stdout)
	assert.equal(result.ok, false)
	assert.equal(result.phase, 'input')
	assert.match(result.error.message, /does not exist/)
})

test('opens a bbmodel, edits live globals, and saves a new bbmodel', async t => {
	const profiles_before = listHeadlessProfiles()
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blockbench-cli-e2e-'))
	t.after(() => fs.rmSync(directory, {recursive: true, force: false}))
	const output = path.join(directory, 'created.bbmodel')
	const run = spawnSync(executable, [
		...application_arguments,
		'--headless',
		'--input', path.join(repository, 'tests', 'fixtures', 'headless_empty.bbmodel'),
		'--script', path.join(repository, 'tests', 'fixtures', 'headless_add_cube.js'),
		'--output', output,
		'--timeout', '30000',
		'--', 'agent_cube',
	], {
		cwd: repository,
		encoding: 'utf8',
		timeout: 40_000,
	})

	assert.equal(run.error, undefined, run.error?.stack)
	assert.equal(run.status, 0, `stdout:\n${run.stdout}\nstderr:\n${run.stderr}`)
	const result = parseResult(run.stdout)
	assert.equal(result.ok, true, `result:\n${JSON.stringify(result, null, 2)}\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`)
	assert.equal(result.result.name, 'agent_cube')
	assert.ok(result.result.undoEntries >= 1)
	assert.equal(result.elements, 1)

	const model = JSON.parse(fs.readFileSync(output, 'utf8'))
	assert.equal(model.elements.length, 1)
	assert.equal(model.elements[0].name, 'agent_cube')
	assert.deepEqual(model.elements[0].from, [0, 0, 0])
	assert.deepEqual(model.elements[0].to, [2, 3, 4])
	await assertNoNewProfiles(profiles_before)
})

test('returns the script exit code and does not write output after a script failure', async t => {
	const profiles_before = listHeadlessProfiles()
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blockbench-cli-e2e-error-'))
	t.after(() => fs.rmSync(directory, {recursive: true, force: false}))
	const output = path.join(directory, 'should_not_exist.bbmodel')
	const run = spawnSync(executable, [
		...application_arguments,
		'--headless',
		'--input', path.join(repository, 'tests', 'fixtures', 'headless_empty.bbmodel'),
		'--eval', 'throw new Error("expected script failure")',
		'--output', output,
		'--timeout', '30000',
	], {
		cwd: repository,
		encoding: 'utf8',
		timeout: 40_000,
	})

	assert.equal(run.error, undefined, run.error?.stack)
	assert.equal(run.status, 5, `stdout:\n${run.stdout}\nstderr:\n${run.stderr}`)
	const result = parseResult(run.stdout)
	assert.equal(result.ok, false)
	assert.equal(result.phase, 'script')
	assert.match(result.error.message, /expected script failure/)
	assert.equal(fs.existsSync(output), false)
	await assertNoNewProfiles(profiles_before)
})
