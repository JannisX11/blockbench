/*class MathNode {
	constructor(data) {

	}
	intact() {
		for (var key in this.inputs) {
			if (this.inputs[keys] === false) {
				return false
			}
		}
		return true;
	}
}
class MathNodeSimple {
	constructur(data) {
		super(data)
		this.operator = data.operator||'+'
		this.inputs = {
			a: false,
			b: false
		}
	}
	get() {
		let a = this.inputs.a ? this.inputs.a.get()
		let b = this.inputs.a ? this.inputs.b.get()
		switch (this.operator) {
			case '-': return a-b; break;
			case '+': return a+b; break;
			case '*': return a*b; break;
			case '/': return a/b; break;
			default:  return 0; break;
		}
	}
	getString() {
		if (a !== undefined && b !== undefined) {

		}
	}
}
*/


/*
TODO:
Support for negative numbers
*/

function splitUpMolang(s, char, inverse) {
	var direction = inverse ? -1 : 1;
	var i = inverse ? s.length-1 : 0;
	var level = 0;
	var is_string = typeof char === 'string'
	while (inverse ? i >= 0 : i < s.length) {
		let c = s[i];
		if (c === '(') {
			level += direction;
		} else if (c === ')') {
			level -= direction;
		} else if (level === 0) {
			var letters = s.substr(i, char.length)
			if (is_string && letters === char) {
				return [
					s.substr(0, i),
					s.substr(i+char.length)
				];
			} else if (!is_string) {
				for (var xi = 0; xi < char.length; xi++) {
					if (char[xi] === letters) {
						return [
							s.substr(0, i),
							s.substr(i+char[xi].length)
						];
					}
				}
			}
		}
		i += direction;
	}

}

function parseMolang(string) {
	if (typeof string === 'number') {
		return isNaN(string) ? 0 : string
	}
	function iterate(s) {
		//Spaces and brackets
		s = s.replace(/\s/g, '')
		if (s.substr(0, 1) === '(' && s.substr(-1) === ')') {
			s = s.substr(1, s.length-2)
		}
		let split = splitUpMolang(s, '&&')
		// a ? b : c
		split = splitUpMolang(s, '?')
		if (split) {
			let condition = iterate(split[0])
			let ab = splitUpMolang(split[1], ':')
			if (ab.length) {
				return iterate(ab[condition?0:1])
			}
		}
		//Logic operators, ==, !=, > etc.
		if (split) {
			return iterate(split[0]) && iterate(split[1]) ? 1 : 0
		}
		split = splitUpMolang(s, '||')
		if (split) {
			return iterate(split[0]) || iterate(split[1]) ? 1 : 0
		}
		split = splitUpMolang(s, '<')
		if (split) {
			return iterate(split[0]) < iterate(split[1]) ? 1 : 0
		}
		split = splitUpMolang(s, '<==')
		if (split) {
			return iterate(split[0]) <= iterate(split[1]) ? 1 : 0
		}
		split = splitUpMolang(s, '>')
		if (split) {
			return iterate(split[0]) < iterate(split[1]) ? 1 : 0
		}
		split = splitUpMolang(s, '>==')
		if (split) {
			return iterate(split[0]) <= iterate(split[1]) ? 1 : 0
		}
		split = splitUpMolang(s, '===')
		if (split) {
			return iterate(split[0]) === iterate(split[1]) ? 1 : 0
		}
		split = splitUpMolang(s, '!==')
		if (split) {
			return iterate(split[0]) !== iterate(split[1]) ? 1 : 0
		}

		split = splitUpMolang(s, '+', true)
		if (split) {
			return iterate(split[0]) + iterate(split[1])
		}
		split = splitUpMolang(s, '-', true)
		if (split) {
			if (split[0].length === 0) {
				return -iterate(split[1])
			} else if ('+*/<>=|&?:'.includes(split[0].substr(-1)) === false) {
				return iterate(split[0]) - iterate(split[1])
			}
		}
		split = splitUpMolang(s, '*')
		if (split) {
			return iterate(split[0]) * iterate(split[1])
		}
		split = splitUpMolang(s, '/')
		if (split) {
			return iterate(split[0]) / iterate(split[1])
		}
		if (s.substr(0, 5) === 'Math.') {
			let begin = s.search(/\(/);
			let operator = s.substr(5, begin-5);
			let inner = s.substr(begin+1, s.length-begin-2)
			let params = inner.split(',');

			params.forEach((c, i) => {
				params[i] = iterate(c);
			})

			if (s.substr(0, 7) === 'Math.Pi') {
				return Math.PI
			}

			if (operator === 'abs') {
				return Math.abs(params[0])
			}
			if (operator === 'sin') {
				return Math.sin(params[0])
			}
			if (operator === 'cos') {
				return Math.cos(params[0])
			}
			if (operator === 'exp') {
				return Math.exp(params[0])
			}
			if (operator === 'ln') {
				return Math.log(params[0])
			}
			if (operator === 'pow') {
				return Math.pow( params[0], params[1] )
			}
			if (operator === 'sqrt') {
				return Math.sqrt(params[0])
			}
			if (operator === 'random') {
				return params[0] + Math.random() * (params[1] - params[0])
			}
			if (operator === 'ceil') {
				return Math.ceil(params[0])
			}
			if (operator === 'round') {
				return Math.round(params[0])
			}
			if (operator === 'trunc') {
				return Math.trunc(params[0])
			}
			if (operator === 'floor') {
				return Math.floor(params[0])
			}
			if (operator === 'mod') {
				return params[0] % params[1]
			}
			if (operator === 'min') {
				return Math.min(params[0], params[1])
			}
			if (operator === 'max') {
				return Math.max(params[0], params[1])
			}
			if (operator === 'clamp') {
				return limitNumber(params[0], params[1], params[2])
			}
			if (operator === 'lerp') {
				return params[0] + (params[1]-params[0]) * params[2]
			}
			if (operator === 'lerprotate') {
				let a = (((params[0] + 180) % 360) +180) % 360
				let b = (((params[1] + 180) % 360) +180) % 360
				let d = b-a
				let i = params[2]
				if (Math.abs(d) > 180) {
					i *= -1
				}
				return a + v*i
			}
		}
		split = s.match(/[a-zA-Z._]{2,}/g)
		if (split && split.length === 1) {
			return previewVariableValue(split[0], Timeline.second)
		}
		split = parseFloat(s)
		if (split) {
			return split
		}
		return 0;
	}
	try {
		return iterate(string)
	} catch(err) {
		return 0;
	}
}

function previewVariableValue(name, time) {
	if (name === 'true') {
		return 1
	} else if (name === 'false') {
		return 0
	} else if (name === 'global.anim_time' || name === 'Params.AnimTime' || name === 'Params.LifeTime' || name === 'global.life_time' ) {
		return time
	} else {
		var inputs = $('#var_placeholder_area').val().split('\n')
		var i = 0;
		while (i < inputs.length) {
			let key, val;
			[key, val] = inputs[i].replace(/[\s;]/g, '').split('=')
			if (key === name) {
				return parseMolang(val)
			}
			i++;
		}
	}
	return 0;
}