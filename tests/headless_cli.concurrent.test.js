import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import test from 'node:test'
import {setTimeout as wait} from 'node:timers/promises'

import electron from 'electron'

const repository = path.resolve(import.meta.dirname, '..')
const concurrency = Number(process.env.BLOCKBENCH_HEADLESS_CONCURRENCY || 8)

function listHeadlessProfiles() {
	return new Set(fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('blockbench-headless-')))
}

function runAction(index, output) {
	return new Promise((resolve, reject) => {
		const child = spawn(electron, [
			'.',
			'--headless',
			'--input', path.join(repository, 'tests', 'fixtures', 'headless_empty.bbmodel'),
			'--eval', `const cube = new Cube({name: "agent_${index}", from: [0, 0, 0], to: [1, 1, 1]}).init(); Canvas.updateAll(); return {uuid: cube.uuid}`,
			'--output', output,
			'--timeout', '60000',
		], {
			cwd: repository,
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
		})
		let stdout = ''
		let stderr = ''
		child.stdout.setEncoding('utf8').on('data', chunk => stdout += chunk)
		child.stderr.setEncoding('utf8').on('data', chunk => stderr += chunk)
		child.on('error', reject)
		child.on('exit', code => resolve({code, stdout, stderr}))
	})
}

test(`${concurrency} independent headless actions can run concurrently`, async t => {
	assert.ok(Number.isInteger(concurrency) && concurrency > 0 && concurrency <= 64)
	const profiles_before = listHeadlessProfiles()
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blockbench-cli-concurrent-'))
	t.after(() => fs.rmSync(directory, {recursive: true, force: false}))

	const started_at = performance.now()
	const actions = Array.from({length: concurrency}, (_, index) => {
		const output = path.join(directory, `agent_${index}.bbmodel`)
		return runAction(index, output).then(run => ({index, output, ...run}))
	})
	const runs = await Promise.all(actions)
	const duration_ms = Math.round(performance.now() - started_at)

	for (const run of runs) {
		assert.equal(run.code, 0, `agent ${run.index}\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`)
		const model = JSON.parse(fs.readFileSync(run.output, 'utf8'))
		assert.equal(model.elements.length, 1)
		assert.equal(model.elements[0].name, `agent_${run.index}`)
	}
	console.log(`${concurrency} headless actions completed in ${duration_ms}ms`)

	for (let attempt = 0; attempt < 100; attempt++) {
		const added = [...listHeadlessProfiles()].filter(name => !profiles_before.has(name))
		if (!added.length) return
		await wait(100)
	}
	const added = [...listHeadlessProfiles()].filter(name => !profiles_before.has(name))
	assert.deepEqual(added, [], `Leaked temporary profiles: ${added.join(', ')}`)
})

test('concurrent actions cannot both claim the same output', async t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blockbench-cli-collision-'))
	t.after(() => fs.rmSync(directory, {recursive: true, force: false}))
	const output = path.join(directory, 'shared.bbmodel')
	const runs = await Promise.all([
		runAction('first', output),
		runAction('second', output),
	])

	assert.deepEqual(runs.map(run => run.code).sort((a, b) => a - b), [0, 4])
	const model = JSON.parse(fs.readFileSync(output, 'utf8'))
	assert.equal(model.elements.length, 1)
	assert.ok(['agent_first', 'agent_second'].includes(model.elements[0].name))
})
