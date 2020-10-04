(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Molang = factory());
}(this, (function () { 'use strict';

	var MathUtil = {
		random(a, b) {
			return a + Math.random() * (b-a)
		},
		clamp(number, min, max) {
			if (number > max) number = max;
			if (number < min || isNaN(number)) number = min;
			return number;
		}
	};

	/**
	 * Author: JannisX11
	 * License: MIT
	 */


	// Util
	function trimInput(string) {
		string = string.toLowerCase();
		string = string.replace(/;\s+/g, ';').replace(/;\s*$/, '').trim();
		return string;
	}



	function Molang() {

		const self = this;

		this.global_variables = {};
		this.cache_enabled = true;
		this.use_radians = false;

		let cached = {};
		let current_variables = {};


		// Tree Types
		function Expression(string) {
			this.original_input = string;
			this.lines = string.split(';').map(line => {
				return iterateString(line);
			});
		}
		function Comp(operator, a, b, c) {
			this.operator = operator;
			this.a = iterateString(a);
			if (b !== undefined) this.b = iterateString(b);
			if (c !== undefined) this.c = iterateString(c);
		}
		function Allocation(name, value) {
			this.value = iterateString(value);
			this.name = name;
		}
		function Statement(type, value) {
			this.value = iterateString(value);
			this.type = type;
		}

		let angleFactor = () => this.use_radians ? 1 : (Math.PI/180);

		function calculate(expression, variables) {
			current_variables = variables||{};
			var i = 0;
			for (var line of expression.lines) {
				let result = iterateExp(line);
				i++;
				if (i == expression.lines.length || (line instanceof Statement && line.type === 'return')) {
					return result;
				}
			}
			return 0;
		}
		
		function iterateString(s) {
			//Iterates through string, returns float, string or comp;
			if (!s) return 0;
			if (!isNaN(s)) return parseFloat(s);
		
			s = s.replace(/\s/g, '');
		
			while (canTrimParentheses(s)) {
				s = s.substr(1, s.length-2);
			}
		
			//Statement
			var match = s.length > 5 && s.match(/^return/);
			if (match) {
				return new Statement(match[0], s.substr(match[0].length))
			}
		
			//allocation
			var match = s.length > 6 && s.match(/(temp|variable)\.\w+=/);
			if (match) {
				let name = match[0].replace(/=$/, '');
				let value = s.substr(match.index + match[0].length);
				return new Allocation(name, value)
			}
		
			//ternary
			var split = splitString(s, '?');
			if (split) {
				let ab = splitString(split[1], ':');
				if (ab && ab.length) {
					return new Comp(10, split[0], ab[0], ab[1]);
				}
			}
		
			//2 part operators
			var comp = (
				testOp(s, '&&', 11) ||
				testOp(s, '||', 12) ||
				testOp(s, '<', 13) ||
				testOp(s, '<=', 14) ||
				testOp(s, '>', 15) ||
				testOp(s, '>=', 16) ||
				testOp(s, '==', 17) ||
				testOp(s, '!=', 18) ||
		
				testOp(s, '+', 1, true) ||
				testMinus(s, '-', 2, true) ||
				testOp(s, '*', 3) ||
				testOp(s, '/', 4)
			);
			if (comp) return comp;
		
			if (s.substr(0, 5) === 'math.') {
				if (s.substr(0, 7) === 'math.pi') {
					return Math.PI
				}
				let begin = s.search(/\(/);
				let operator = s.substr(5, begin-5);
				let inner = s.substr(begin+1, s.length-begin-2);
				let params = splitString(inner, ',')||[inner];
				if (params.length > 1) {
					var last2 = splitString(params[1], ',');
					if (last2 && last2.length > 1) {
						params[1] = last2[0];
						params[2] = last2[1];
					}
				}
		
				switch (operator) {
					case 'abs':
						return new Comp(20, params[0]);
					case 'sin':
						return new Comp(21, params[0]);
					case 'cos':
						return new Comp(22, params[0]);
					case 'exp':
						return new Comp(23, params[0]);
					case 'ln':
						return new Comp(24, params[0]);
					case 'pow':
						return new Comp(25, params[0], params[1]);
					case 'sqrt':
						return new Comp(26, params[0]);
					case 'random':
						return new Comp(27, params[0], params[1]);
					case 'ceil':
						return new Comp(28, params[0]);
					case 'round':
						return new Comp(29, params[0]);
					case 'trunc':
						return new Comp(30, params[0]);
					case 'floor':
						return new Comp(31, params[0]);
					case 'mod':
						return new Comp(32, params[0], params[1]);
					case 'min':
						return new Comp(33, params[0], params[1]);
					case 'max':
						return new Comp(34, params[0], params[1]);
					case 'clamp':
						return new Comp(35, params[0], params[1], params[2]);
					case 'lerp':
						return new Comp(36, params[0], params[1], params[2]);
					case 'lerprotate':
						return new Comp(37, params[0], params[1], params[2]);
				}
			}
			split = s.match(/[a-zA-Z0-9._]{2,}/g);
			if (split && split.length === 1) {
				return s;
			}
			return 0;
		}
		function canTrimParentheses(s) {
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
		}
		function testOp(s, char, operator, inverse) {
		
			var split = splitString(s, char, inverse);
			if (split) {
				return new Comp(operator, split[0], split[1])
			}
		}
		function testMinus(s, char, operator, inverse) {
		
			var split = splitString(s, char, inverse);
			if (split) {
				if (split[0].length === 0) {
					return new Comp(operator, 0, split[1])
				} else if ('+*/<>=|&?:'.includes(split[0].substr(-1)) === false) {
					return new Comp(operator, split[0], split[1])
				}
			}
		}
		function splitString(s, char, inverse) {
			var direction = inverse ? -1 : 1;
			var i = inverse ? s.length-1 : 0;
			var level = 0;
			var is_string = typeof char === 'string';
			while (inverse ? i >= 0 : i < s.length) {
				if (s[i] === '(') {
					level += direction;
				} else if (s[i] === ')') {
					level -= direction;
				} else if (level === 0) {
					var letters = s.substr(i, char.length);
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
		function iterateExp(T) {
			if (typeof T === 'number') {
				return T
			} else if (typeof T === 'string') {
				var val = current_variables[T];
				if (val === undefined) {
					if (T === 'true') {
						return 1;
					} else if (T === 'false') {
						return 0;
					} else {
						val = self.global_variables[T];
					}
				}
				if (val === undefined && typeof self.variableHandler === 'function') {
					val = self.variableHandler(T, current_variables);
				}
				if (typeof val === 'string') {
					val = self.parse(val, current_variables);
				}
				return val||0;
		
			} else if (T instanceof Statement) {
				return iterateExp(T.value);
		
			} else if (T instanceof Allocation) {
				return current_variables[T.name] = iterateExp(T.value);
		
			} else if (T instanceof Comp) {
				switch (T.operator) {
					//Basic
					case 1:
						return iterateExp(T.a) + iterateExp(T.b);
					case 2:
						return iterateExp(T.a) - iterateExp(T.b);
					case 3:
						return iterateExp(T.a) * iterateExp(T.b);
					case 4:
						return iterateExp(T.a) / iterateExp(T.b);
					//Logical
					case 10:
						return iterateExp(T.a) ? iterateExp(T.b) : iterateExp(T.c);
					case 11:
						return iterateExp(T.a) && iterateExp(T.b) ? 1 : 0;
					case 12:
						return iterateExp(T.a) || iterateExp(T.b) ? 1 : 0;
					case 13:
						return iterateExp(T.a) < iterateExp(T.b) ? 1 : 0;
					case 14:
						return iterateExp(T.a) <= iterateExp(T.b) ? 1 : 0;
					case 15:
						return iterateExp(T.a) > iterateExp(T.b) ? 1 : 0;
					case 16:
						return iterateExp(T.a) >= iterateExp(T.b) ? 1 : 0;
					case 17:
						return iterateExp(T.a) === iterateExp(T.b) ? 1 : 0;
					case 18:
						return iterateExp(T.a) !== iterateExp(T.b) ? 1 : 0;
					//Math
					case 20:
						return Math.abs(iterateExp(T.a));
					case 21:
						return Math.sin(iterateExp(T.a) * angleFactor());
					case 22:
						return Math.cos(iterateExp(T.a) * angleFactor());
					case 23:
						return Math.exp(iterateExp(T.a));
					case 24:
						return Math.log(iterateExp(T.a));
					case 25:
						return Math.pow(iterateExp(T.a), iterateExp(T.b));
					case 26:
						return Math.sqrt(iterateExp(T.a));
					case 27:
						return MathUtil.random(iterateExp(T.a), iterateExp(T.b), iterateExp(T.c));
					case 28:
						return Math.ceil(iterateExp(T.a));
					case 29:
						return Math.round(iterateExp(T.a));
					case 30:
						return Math.trunc(iterateExp(T.a));
					case 31:
						return Math.floor(iterateExp(T.a));
					case 32:
						return iterateExp(T.a) % iterateExp(T.b);
					case 33:
						return Math.min(iterateExp(T.a), iterateExp(T.b));
					case 34:
						return Math.max(iterateExp(T.a), iterateExp(T.b));
					case 35:
						return MathUtil.clamp(iterateExp(T.a), iterateExp(T.b), iterateExp(T.c));
					case 36:
						let n1 = iterateExp(T.a);
						return n1 + (iterateExp(T.b) - n1) * iterateExp(T.c);
					case 37:
						let radify = n => (((n + 180) % 360) +180) % 360;
						let a = radify(iterateExp(T.a));
						let b = radify(iterateExp(T.b));
						let i = iterateExp(T.c);
		
						if (a > b) [a, b] = [b, a];
						var diff = b-a;
						if (diff > 180) {
							return radify(b + i * (360-diff));
						} else {
							return a + i * diff;
						}
				}
			}
			return 0;
		}


		this.parse = (input, variables) => {
			if (typeof input === 'number') {
				return isNaN(input) ? 0 : input
			}
			if (typeof input !== 'string') return 0;
			input = trimInput(input);
		
			if (this.cache_enabled && cached[input]) {
				var expression = cached[input];
			} else {
				var expression = new Expression(input);
				if (this.cache_enabled) {
					cached[input] = expression;
				}
			}
			var value = calculate(expression, variables);
			return value;
		};
	}

	return Molang;

})));
