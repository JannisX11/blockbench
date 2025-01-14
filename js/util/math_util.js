//Math
function guid() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000)
			.toString(16)
			.substring(1);
	}
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
		s4() + '-' + s4() + s4() + s4();
}
function isUUID(s) {
	return (s.length === 36 && s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/))
}
function bbuid(l) {
	l = l || 1
	let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
	var s = '';
	while (l > 0) {
		var n = Math.floor(Math.random()*62)
		if (n > 9) {
			n = chars[n-10]
		}
		s += n
		l--;
	}
	return s;
}
Math.radToDeg = function(rad) {
	return rad / Math.PI * 180
}
Math.degToRad = function(deg) {
	return Math.PI / (180 /deg)
}
Math.roundTo = function(num, digits) {
	var d = Math.pow(10,digits)
	return Math.round(num * d) / d
}
Math.getLerp = function(a,b,m) {
	return (m-a) / (b-a)
}
Math.lerp = function(a, b, m) {
	return a + (b-a) * m
}
Math.isBetween = function(number, limit1, limit2) {
   return (number - limit1) * (number - limit2) <= 0
}
Math.epsilon = function(a, b, epsilon = 0.001) {
	return Math.abs(b - a) < epsilon
}
Math.trimDeg = function(a) {
	return (a+180*15)%360-180
}
Math.trimRad = function(a) {
	return (a+Math.PI*15)%(Math.PI*2)-Math.PI
}
Math.isPowerOfTwo = function(x) {
	return (x > 1) && ((x & (x - 1)) == 0);
}
Math._numbertype = 'number';
Math.isNumber = function(x) {
	return typeof x == Math._numbertype;
}
Math.randomab = function(a, b) {
	return a + Math.random()*(b-a);
}
Math.randomInteger = function(a, b) {
	a = Math.ceil(a);
	b = Math.floor(b);
	return a + Math.floor(Math.random() * (b - a + 1));
}
Math.areMultiples = function(n1, n2) {
	return (
		(n1/n2)%1 === 0 ||
		(n2/n1)%1 === 0
	)
}
Math.getNextPower = function(num, min) {
	var i = min ? min : 2
	while (i < num && i < 4000) {
		i *= 2
	}
	return i;
}
Math.signedPow = function(num, power=2) {
	if (power % 2 == 0) {
		return Math.pow(num, power) * Math.sign(num);
	} else {
		return Math.pow(num, power);
	}
}
Math.snapToValues = function(val, snap_points, epsilon = 12) {
	let snaps = snap_points.slice().sort((a, b) => {
		return Math.abs(val-a) - Math.abs(val-b)
	})
	if (Math.abs(snaps[0] - val) < epsilon) {
		return snaps[0]
	} else {
		return val
	}
}
Math.hermiteBlend = function(input) {
	return 3*(input**2) - 2*(input**3);
}
Math.clamp = function(number, min, max) {
	if (number > max) number = max;
	if (number < min || isNaN(number)) number = min;
	return number;
}
let limitNumber = Math.clamp;
function trimFloatNumber(val, max_digits = 4) {
	if (val == '') return val;
	var string = val.toFixed(max_digits)
	string = string.replace(/0+$/g, '').replace(/\.$/g, '')
	if (string == -0) return 0;
	return string;
}
function separateThousands(number) {
	let str = number.toString();
	let length = str.indexOf('.');
	if (length == -1) length = str.length;
	if (length < 4) return str;

	let modified;
	for (let i = length; i > 0; i -= 3) {
		if (i == length) {
			modified = str.substring(i-3);
		} else {
			modified = str.substring(Math.max(0, i-3), i) + ',' + modified;
		}
	}
	return modified;
}
function getAxisLetter(number) {
	switch (number) {
		case 0: return 'x'; break;
		case 1: return 'y'; break;
		case 2: return 'z'; break;
	}
}
function getAxisNumber(letter) {
	switch (letter.toLowerCase()) {
		case 'x': return 0; break;
		case 'y': return 1; break;
		case 'z': return 2; break;
	}
}
let string_num_regex = /^-?\d+(\.\d+f?)?$/;
function isStringNumber(string) {
	return typeof string == 'number' || string_num_regex.test(string);
}
