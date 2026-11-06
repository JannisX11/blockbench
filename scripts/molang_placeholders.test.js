import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import MolangParser from 'molangjs/dist/molang.esm.js';

const source = readFileSync(new URL('../js/animations/molang.js', import.meta.url), 'utf8');
// Load the resolver setup without the editor's UI registration below it.
const setup = source.slice(source.indexOf('Animator.MolangParser.context'), source.indexOf('export function getAllMolangExpressions'));

function createParser(placeholders, buttons = []) {
	const Animator = { MolangParser: new MolangParser(), global_variable_lines: placeholders };
	runInNewContext(setup, {
		Animator,
		Panels: { variable_placeholders: { inside_vue: { buttons } } },
		isStringNumber: value => typeof value == 'number' || /^-?\d+(\.\d+f?)?$/.test(value),
	});
	Animator.MolangParser.global_variables = {};
	return Animator.MolangParser;
}

test('direct and indirect cycles resolve to zero, including dependent arithmetic', () => {
	for (const placeholders of [
		{ aa: 'aa;' },
		{ aa: 'aa + 1' },
		{ aa: 'bb + 1', bb: 'aa + 1' },
		{ aa: 'bb + 3', bb: 'bb + 1' },
	]) {
		const parser = createParser({ ...placeholders, good: '5' });
		assert.equal(parser.parse('aa'), 0);
		assert.equal(parser.parse('aa + good'), 5);
		assert.equal(parser.parse('good'), 5);
	}
});

test('valid chains, repeated references and short-circuited self references still work', () => {
	const parser = createParser({ aa: 'bb + bb', bb: 'cc + 1', cc: '2', safe: '0 ? safe : 7' });
	assert.equal(parser.parse('aa + aa'), 12);
	assert.equal(parser.parse('safe'), 7);
});

test('argument-specific placeholders use their full definition as the cycle key', () => {
	const parser = createParser({
		'query.foo(1)': 'query.foo(2)',
		'query.foo(2)': '7',
		"query.foo('left')": "query.foo('right')",
		"query.foo('right')": '9',
	});
	assert.equal(parser.parse('q.foo(1)'), 7);
	assert.equal(parser.parse("q.foo('left')"), 9);
});

test('cycles through argument-specific placeholders resolve to zero', () => {
	const parser = createParser({ 'query.foo(1)': 'q.foo(2) + 1', 'query.foo(2)': 'q.foo(1) + 1' });
	assert.equal(parser.parse('q.foo(1)'), 0);
});

test('a bare query placeholder still takes precedence over argument-specific values', () => {
	const parser = createParser({ 'query.foo': 'q.foo(2) + 1', 'query.foo(2)': '7' });
	assert.equal(parser.parse('q.foo(1)'), 0);
});

test('editing a cyclic placeholder restores evaluation without resetting the parser', () => {
	const placeholders = { aa: 'aa' };
	const parser = createParser(placeholders);
	assert.equal(parser.parse('aa'), 0);
	placeholders.aa = '4';
	assert.equal(parser.parse('aa + aa'), 8);
});

test('resolution state is cleared after an unrelated evaluation error', () => {
	const placeholders = { aa: 'q.fail(1)' };
	const parser = createParser(placeholders);
	parser.global_variables['query.fail'] = () => { throw new Error('test failure'); };
	assert.throws(() => parser.parse('aa'), /test failure/);
	placeholders.aa = '6';
	assert.equal(parser.parse('aa'), 6);
});

test('context variables, strings, fallback values and placeholder controls are preserved', () => {
	const parser = createParser({
		aa: 'q.anim_time * 2',
		label: "'walk'",
		speed: "slider('speed')",
		enabled: "toggle('enabled')",
		pulse: "impulse('pulse')",
		missing: "slider('missing')",
	}, [
		{ id: 'speed', type: 'slider', value: '2.5' },
		{ id: 'enabled', type: 'toggle', value: '1' },
		{ id: 'pulse', type: 'impulse', value: '0.5' },
	]);
	assert.equal(parser.parse('aa', { 'query.anim_time': 3 }), 6);
	assert.equal(parser.parse("label == 'walk'"), 1);
	assert.equal(parser.parse('q.model_scale'), 1/16);
	assert.equal(parser.parse('unknown'), 0);
	assert.equal(parser.parse('speed + enabled + pulse + missing'), 4);
});
