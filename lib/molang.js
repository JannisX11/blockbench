var Molang = {
	parse: function (input, variables) {

		if (typeof input === 'number') {
			return isNaN(input) ? 0 : input
		}
		if (typeof input !== 'string') return 0;
		input = input.toLowerCase();
		if (input.substr(-1) === ';') input = input.substr(0, input.length-1)

		if (Molang.cache_enabled && Molang._cached[input]) {
			var expression = Molang._cached[input];
		} else {
			var expression = new Molang.expression(input)
			if (Molang.cache_enabled) {
				Molang._cached[input] = expression;
			}
		}
		var value = Molang.calculate(expression, variables)
		return value;
	},
	global_variables: {},
	cache_enabled: true,
	use_radians: false,
	expression: function(string) {
		this.original_input = string;
		this.data = Molang._itS(string);
	},
	calculate: function(expression, variables) {
		Molang._current_variables = variables||0;
		return Molang._itEx(expression.data);
	},
	Comp: function(operator, a, b, c) {
		this.operator = operator;
		this.a = Molang._itS(a);
		if (b !== undefined) this.b = Molang._itS(b);
		if (c !== undefined) this.c = Molang._itS(c);
	},

	_cached: {},
	_itS: function(s) {
		//Iterates through string, returns float, string or comp;
		if (!s) return 0;
		var M = Molang;
		if (!isNaN(s)) return parseFloat(s);

		s = s.replace(/\s/g, '')

		while (M._canTrimParentheses(s)) {
			s = s.substr(1, s.length-2);
		}

		//ternary
		var split = Molang._splitString(s, '?');
		if (split) {
			let ab = Molang._splitString(split[1], ':');
			if (ab && ab.length) {
				return new Molang.Comp(10, split[0], ab[0], ab[1]);
			}
		}

		//2 part operators
		var comp = (
			M._testOp(s, '&&', 11) ||
			M._testOp(s, '||', 12) ||
			M._testOp(s, '<', 13) ||
			M._testOp(s, '<=', 14) ||
			M._testOp(s, '>', 15) ||
			M._testOp(s, '>=', 16) ||
			M._testOp(s, '==', 17) ||
			M._testOp(s, '!=', 18) ||

			M._testOp(s, '+', 1, true) ||
			M._testMinus(s, '-', 2, true) ||
			M._testOp(s, '*', 3) ||
			M._testOp(s, '/', 4)
		)
		if (comp) return comp;

		if (s.substr(0, 5) === 'math.') {
			if (s.substr(0, 7) === 'math.pi') {
				return Math.PI
			}
			let begin = s.search(/\(/);
			let operator = s.substr(5, begin-5);
			let inner = s.substr(begin+1, s.length-begin-2)
			let params = Molang._splitString(inner, ',')||[inner];
			if (params.length > 1) {
				var last2 = Molang._splitString(params[1], ',')
				if (last2 && last2.length > 1) {
					params[1] = last2[0];
					params[2] = last2[1];
				}
			}

			switch (operator) {
				case 'abs':
					return new M.Comp(20, params[0]);
					break;
				case 'sin':
					return new M.Comp(21, params[0]);
					break;
				case 'cos':
					return new M.Comp(22, params[0]);
					break;
				case 'exp':
					return new M.Comp(23, params[0]);
					break;
				case 'ln':
					return new M.Comp(24, params[0]);
					break;
				case 'pow':
					return new M.Comp(25, params[0], params[1]);
					break;
				case 'sqrt':
					return new M.Comp(26, params[0]);
					break;
				case 'random':
					return new M.Comp(27, params[0], params[1]);
					break;
				case 'ceil':
					return new M.Comp(28, params[0]);
					break;
				case 'round':
					return new M.Comp(29, params[0]);
					break;
				case 'trunc':
					return new M.Comp(30, params[0]);
					break;
				case 'floor':
					return new M.Comp(31, params[0]);
					break;
				case 'mod':
					return new M.Comp(32, params[0], params[1]);
					break;
				case 'min':
					return new M.Comp(33, params[0], params[1]);
					break;
				case 'max':
					return new M.Comp(34, params[0], params[1]);
					break;
				case 'clamp':
					return new M.Comp(35, params[0], params[1], params[2]);
					break;
				case 'lerp':
					return new M.Comp(36, params[0], params[1], params[2]);
					break;
				case 'lerprotate':
					return new M.Comp(37, params[0], params[1], params[2]);
					break;
			}
		}
		split = s.match(/[a-zA-Z0-9._]{2,}/g)
		if (split && split.length === 1) {
			return s;
		}
		return 0;
	},
	_canTrimParentheses: function(s) {
		if (s.substr(0, 1) === '(' && s.substr(-1) === ')') {
			let level = 0;
			for (var i = 0; i < s.length-1; i++) {
				switch (s[i]) {
					case '(': level++; break;
					case ')': level--; break;
				}
				if (level == 0) return false;
			}
			return true;
		}
	},
	_testOp: function(s, char, operator, inverse) {

		var split = Molang._splitString(s, char, inverse)
		if (split) {
			return new Molang.Comp(operator, split[0], split[1])
		}
	},
	_testMinus: function(s, char, operator, inverse) {

		var split = Molang._splitString(s, char, inverse)
		if (split) {
			if (split[0].length === 0) {
				return new Molang.Comp(operator, 0, split[1])
			} else if ('+*/<>=|&?:'.includes(split[0].substr(-1)) === false) {
				return new Molang.Comp(operator, split[0], split[1])
			}
		}
	},
	_splitString: function(s, char, inverse) {
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
	},
	get _angleFactor() {
		return this.use_radians ? 1 : (Math.PI/180);
	},
	_itEx: function(T) {
		if (typeof T === 'number') {
			return T
		} else if (typeof T === 'string') {
			var val = Molang._current_variables[T]
			if (val === undefined) {
				val = Molang.global_variables[T];
			}
			if (val === undefined && typeof Molang.variableHandler === 'function') {
				val = Molang.variableHandler(T)
			}
			if (typeof val === 'string') {
				val = Molang.parse(val, Molang._current_variables)
			}
			return val||0;
		} else if (T instanceof Molang.Comp) {
			var M = Molang;
			switch (T.operator) {
				//Basic
				case 1:
					return M._itEx(T.a) + M._itEx(T.b);
					break;
				case 2:
					return M._itEx(T.a) - M._itEx(T.b);
					break;
				case 3:
					return M._itEx(T.a) * M._itEx(T.b);
					break;
				case 4:
					return M._itEx(T.a) / M._itEx(T.b);
					break;
				//Boolean
				case 10:
					return M._itEx(T.a) ? M._itEx(T.b) : M._itEx(T.c);
					break;
				case 11:
					return M._itEx(T.a) && M._itEx(T.b) ? 1 : 0;
					break;
				case 12:
					return M._itEx(T.a) || M._itEx(T.b) ? 1 : 0;
					break;
				case 13:
					return M._itEx(T.a) < M._itEx(T.b) ? 1 : 0;
					break;
				case 14:
					return M._itEx(T.a) <= M._itEx(T.b) ? 1 : 0;
					break;
				case 15:
					return M._itEx(T.a) > M._itEx(T.b) ? 1 : 0;
					break;
				case 16:
					return M._itEx(T.a) >= M._itEx(T.b) ? 1 : 0;
					break;
				case 17:
					return M._itEx(T.a) === M._itEx(T.b) ? 1 : 0;
					break;
				case 18:
					return M._itEx(T.a) !== M._itEx(T.b) ? 1 : 0;
					break;
				//Math
				case 20:
					return Math.abs(M._itEx(T.a));
					break;
				case 21:
					return Math.sin(M._itEx(T.a) * Molang._angleFactor);
					break;
				case 22:
					return Math.cos(M._itEx(T.a) * Molang._angleFactor);
					break;
				case 23:
					return Math.exp(M._itEx(T.a));
					break;
				case 24:
					return Math.log(M._itEx(T.a));
					break;
				case 25:
					return Math.pow(M._itEx(T.a), M._itEx(T.b));
					break;
				case 26:
					return Math.sqrt(M._itEx(T.a));
					break;
				case 27:
					return Molang._random(M._itEx(T.a), M._itEx(T.b), M._itEx(T.c));
					break;
				case 28:
					return Math.ceil(M._itEx(T.a));
					break;
				case 29:
					return Math.round(M._itEx(T.a));
					break;
				case 30:
					return Math.trunc(M._itEx(T.a));
					break;
				case 31:
					return Math.floor(M._itEx(T.a));
					break;
				case 32:
					return M._itEx(T.a) % M._itEx(T.b);
					break;
				case 33:
					return Math.min(M._itEx(T.a), M._itEx(T.b));
					break;
				case 34:
					return Math.max(M._itEx(T.a), M._itEx(T.b));
					break;
				case 35:
					return Molang._clamp(M._itEx(T.a), M._itEx(T.b), M._itEx(T.c));
					break;
				case 36:
					let n1 = M._itEx(T.a);
					return n1 + (M._itEx(T.b) - n1) * M._itEx(T.c);
					break;
				case 37:
					let a = (((M._itEx(T.a) + 180) % 360) +180) % 360
					let b = (((M._itEx(T.b) + 180) % 360) +180) % 360
					let d = b-a
					let i = M._itEx(T.c)
					if (Math.abs(d) > 180) {
						i *= -1
					}
					return a + v*i
					break;
			}
		}
	}
}

Molang._random = function(a, b) {
	return a + Math.random() * (b-a)
}
Molang._clamp = function(number, min, max) {
	if (number > max) number = max;
	if (number < min || isNaN(number)) number = min;
	return number;
}
