import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
	HeadlessCLIArgumentError,
	HeadlessExitCode,
	createHeadlessCLIProfile,
	parseHeadlessCLIArguments,
	removeHeadlessCLIProfile,
	validateHeadlessCLIPaths,
} from '../electron/headless_cli.js'

test('returns null outside headless mode', () => {
	assert.equal(parseHeadlessCLIArguments(['Blockbench', 'model.bbmodel']), null)
})

test('parses one stateless action and trailing script arguments', () => {
	const cwd = path.join('C:', 'models')
	const options = parseHeadlessCLIArguments([
		'Blockbench',
		'--headless',
		'--input', 'creature.bbmodel',
		'--script', 'remove_saddle.js',
		'--output', 'creature_no_saddle.bbmodel',
		'--force',
		'--timeout', '90000',
		'--', 'saddle', 'replacement_back',
	], cwd)

	assert.equal(options.input, path.resolve(cwd, 'creature.bbmodel'))
	assert.equal(options.script, path.resolve(cwd, 'remove_saddle.js'))
	assert.equal(options.output, path.resolve(cwd, 'creature_no_saddle.bbmodel'))
	assert.equal(options.force, true)
	assert.equal(options.timeout, 90_000)
	assert.deepEqual(options.args, ['saddle', 'replacement_back'])
})

test('requires exactly one script source', () => {
	assert.throws(() => parseHeadlessCLIArguments([
		'Blockbench', '--headless',
		'--input', 'in.bbmodel',
		'--output', 'out.bbmodel',
	]), HeadlessCLIArgumentError)

	assert.throws(() => parseHeadlessCLIArguments([
		'Blockbench', '--headless',
		'--input', 'in.bbmodel',
		'--output', 'out.bbmodel',
		'--script', 'action.js',
		'--eval', 'return 1',
	]), /cannot be used together/)
})

test('validates input, script, output extension, and replacement policy', t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blockbench-cli-test-'))
	t.after(() => fs.rmSync(directory, {recursive: true, force: false}))
	const input = path.join(directory, 'input.bbmodel')
	const script = path.join(directory, 'action.js')
	const output = path.join(directory, 'output.bbmodel')
	fs.writeFileSync(input, '{}')
	fs.writeFileSync(script, 'return true')

	const options = parseHeadlessCLIArguments([
		'Blockbench', '--headless',
		'--input', input,
		'--script', script,
		'--output', output,
	])
	assert.equal(validateHeadlessCLIPaths(options), options)

	fs.writeFileSync(output, '{}')
	assert.throws(() => validateHeadlessCLIPaths(options), error => {
		assert.match(error.message, /already exists/)
		assert.equal(error.exitCode, HeadlessExitCode.OUTPUT)
		return true
	})
	options.force = true
	assert.equal(validateHeadlessCLIPaths(options), options)

	options.output = path.join(directory, 'wrong.json')
	assert.throws(() => validateHeadlessCLIPaths(options), /\.bbmodel extension/)
})

test('ephemeral profiles are unique and cleanup rejects unrelated paths', () => {
	const first = createHeadlessCLIProfile()
	const second = createHeadlessCLIProfile()
	assert.notEqual(first, second)
	assert.equal(removeHeadlessCLIProfile(first), true)
	assert.equal(removeHeadlessCLIProfile(second), true)
	assert.equal(removeHeadlessCLIProfile(second), false)
	assert.throws(() => removeHeadlessCLIProfile(os.tmpdir()), /Refusing to remove/)
})
