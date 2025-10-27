/**
 * Basic and non-feature-complete YAML parser for Blockbench
 */
export namespace BBYaml {
	function parseValue(value: string): any {
		switch (value) {
			case 'true': return true;
			case 'false': return false;
		}
		if (value.startsWith('"') && value.endsWith('"')) {
			return value.substring(1, value.length-1);
		}
		// @ts-ignore
		if (!isNaN(value)) {
			return parseFloat(value);
		}
		return value;
	}
	export function parse(input: string): any {
		let lines = input.split(/(\r?\n)+/g);
		let root = {};
		let stack: (any)[] = [root];
		let last_key: string;
		
		for (let line of lines) {
			let indent_level = line.match(/^\s*/)[0]?.replace(/  /g, '\t').length;
			let [key, value] = line.split(/: *(.*)/s);
			key = key.trim();
			if (!key || key.startsWith('#')) continue;
			while (indent_level < stack.length-1) {
				stack.pop();
			}
			if (key.startsWith('- ')) {
				key = key.substring(2);
				if (stack.last() instanceof Array == false && stack[stack.length-2]) {
					// Convert to array
					stack[stack.length-2][last_key] = stack[stack.length-1] = [];
				}
				
				if (typeof value == 'string') {
					let obj = {};
					stack.last().push(obj);
					stack.push(obj);
				} else {
					stack.last().push(parseValue(key));
					continue;
				}
			}
			if (typeof value == 'string') {
				if (value) {
					stack.last()[key] = parseValue(value);
				} else {
					let obj = stack.last()[key] = {};
					stack.push(obj);
				}
			}
			last_key = key;
		}
		return root;
	}
}
