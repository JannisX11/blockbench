let string_num_regex = /^-?\d+(\.\d+f?)?$/;
function isStringNumber(string: string) {
	return string_num_regex.test(string);
}

const BRACKET_OPEN = '{([';
const BRACKET_CLOSE = '})]';
export function invertMolang(molang: string): string;
export function invertMolang(molang: number): number;
export function invertMolang(molang: number | string): number | string {
	if (typeof molang == 'number') {
		return -molang;
	}
	if (molang == '' || molang == '0') return molang;
	if (isStringNumber(molang)) {
		let val = parseFloat(molang);
		return (-val).toString();
	}
	let invert = true;
	let bracket_depth = 0;
	let result = '';
	for (let char of molang) {
		if (!bracket_depth) {
			if (char == '-') {
				if (!invert) result += '+';
				invert = false;
				continue;
			} else if (char == '+') {
				result += '-';
				invert = false;
				continue;
			} else if ('?:'.includes(char)) {
				invert = true;
			} else if (invert && char != ' ') {
				result += '-';
				invert = false;
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
}
function testInvertMolang(input: string) {
	let positive_result = Animator.MolangParser.parse(input);
	let inverted = invertMolang(input);
	let negative_result = Animator.MolangParser.parse(inverted);
	if (positive_result == -negative_result) {
		return inverted;
	} else {
		console.warn([positive_result, negative_result], inverted);
	}
}

Object.assign(window, {
	invertMolang,
	testInvertMolang,
});
