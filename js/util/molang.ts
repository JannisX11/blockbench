let string_num_regex = /^-?\d+(\.\d+f?)?$/;
function isStringNumber(string: string) {
	return string_num_regex.test(string);
}

export function processMolangReturn(molang: string, callback: Function): string {
	if (/\breturn\s/.test(molang)) {
		return molang.replace(/\breturn(\s+)(.+?)(;|$)/gs, (match: string, whitespace: string, expression: string, end: string) => {
			return `return${whitespace}${callback(expression)}${end}`;
		})
	} else {
		// Ignore empty trailing statements without discarding their whitespace.
		const trailing = molang.match(/[;\s]*$/)[0];
		const trailingWhitespace = trailing.replace(/;/g, '');
		molang = molang.substring(0, molang.length - trailing.length);
		const lastSemicolonIndex = molang.lastIndexOf(';');
		if (lastSemicolonIndex === -1) {
			if (molang.includes('=')) {
				return molang + ';' + callback('') + trailingWhitespace;
			} else {
				return callback(molang) + trailingWhitespace;
			}
		}
		const before = molang.substring(0, lastSemicolonIndex);
		const after = molang.substring(lastSemicolonIndex + 1);
		if (after.includes('=')) {
			return molang + ';' + callback('') + trailingWhitespace;
		} else {
			return before + ';' + callback(after) + trailingWhitespace;
		}
	}
}

const BRACKET_OPEN = '{([';
const BRACKET_CLOSE = '})]';
export function invertMolang(molang: string): string
export function invertMolang(molang: number): number
export function invertMolang(molang: number|string): number|string {
	if (typeof molang == 'number') {
		return -molang;
	}
	if (molang == '' || molang == '0') return molang;
	if (isStringNumber(molang)) {
		let val = parseFloat(molang);
		return (-val).toString();
	}

	return processMolangReturn(molang, (expression : string) => {
		let invert = true;
		let bracket_depth = 0;
		let last_operator: undefined | string;
		let result = '';
		for (let char of expression) {
			if (!bracket_depth) {
				let operator: undefined | string;
				let had_input = true;
				if (char == '-' && last_operator != '*' && last_operator != '/') {
					if (!invert && !last_operator) result += '+';
					invert = false;
					continue;
				} else if (/\s/.test(char)) {
					had_input = false;
				} else if (char == '+' && last_operator != '*' && last_operator != '/') {
					result += '-';
					invert = false;
					continue;
				} else if ('?:'.includes(char)) {
					invert = true;
					operator = char;
				} else if (invert) {
					result += '-';
					invert = false;
				} else if ('+-*/&|'.includes(char)) {
					operator = char;
				}
				if (had_input) {
					last_operator = operator;
				}
			}
			if (BRACKET_OPEN.includes(char)) {
				bracket_depth++;
			} else if (BRACKET_CLOSE.includes(char)) {
				bracket_depth--;
			}
			result += char;
		}
		return result;
	});
}
function testInvertMolang(input: string) {
	let positive_result = Animator.MolangParser.parse(input);
	let inverted = invertMolang(input);
	let negative_result = Animator.MolangParser.parse(inverted);
	if (Math.epsilon(positive_result, -negative_result, 0.00001)) {
		return inverted
	} else {
		console.warn([positive_result, negative_result], inverted);
	}
}

const global = {
	invertMolang,
	testInvertMolang,
	processMolangReturn
};
declare global {
	const invertMolang: typeof global.invertMolang
	const testInvertMolang: typeof global.testInvertMolang
	const processMolangReturn: typeof global.processMolangReturn
}
Object.assign(window, global);
