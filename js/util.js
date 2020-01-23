//Blockbench
function compareVersions(string1/*new*/, string2/*old*/) {
	// Is string1 newer than string2 ?
	var arr1 = string1.split('.')
	var arr2 = string2.split('.')
	var i = 0;
	var num1 = 0;
	var num2 = 0;
	while (i < arr1.length) {
		num1 = parseInt(arr1[i])
		num2 = parseInt(arr2[i])
		if (num1 > num2) {
			return true;
		} else if (num1 < num2) {
			return false
		}
		i++;
	}
	return false;
}
const Condition = function(condition, context) {
	if (condition !== undefined && condition !== null && condition.condition !== undefined) {
		condition = condition.condition
	}
	if (condition === undefined) {
		return true;
	} else if (typeof condition === 'function') {
		return condition(context)
	} else if (typeof condition === 'object') {
		if (condition.modes instanceof Array && condition.modes.includes(Modes.id) === false) return false;
		if (condition.formats instanceof Array && Format && condition.formats.includes(Format.id) === false) return false;
		if (condition.tools instanceof Array && condition.tools.includes(Toolbox.selected.id) === false) return false;

		if (condition.method instanceof Function) {
			return condition.method(context);
		}
		return true;
	} else {
		return !!condition
	}
}
class oneLiner {
	constructor(data) {
		if (data !== undefined) {
			for (var key in data) {
				if (data.hasOwnProperty(key)) {
					this[key] = data[key]
				}
			}
		}
	}
}
var cl = console.log
var asyncLoop = function(o){
	var i=-1;
	var async_loop = function(){
		i++;
		if(i==o.length){o.callback(); return;}
		o.functionToLoop(async_loop, i);
	} 
	async_loop();//init
}
Date.prototype.getTimestamp = function() {
	var l2 = i => (i.toString().length === 1 ? '0'+i : i);
	return l2(this.getHours()) + ':' + l2(this.getMinutes());
}
Object.defineProperty(Event.prototype, 'ctrlOrCmd', {
	get: function() {
		return this.ctrlKey || this.metaKey;
	}
})
Object.defineProperty($.Event.prototype, 'ctrlOrCmd', {
	get: function() {
		return this.ctrlKey || this.metaKey;
	}
})

function convertTouchEvent(event) {
	if (event && event.changedTouches && event.changedTouches.length && event.offsetX == undefined) {
		event.preventDefault();
		event.clientX = event.changedTouches[0].clientX;
		event.clientY = event.changedTouches[0].clientY;
		event.offsetX = event.changedTouches[0].clientX;
		event.offsetY = event.changedTouches[0].clientY;

		var offset = $(event.target).offset();
		if (offset) {
			event.offsetX -= offset.left;
			event.offsetY -= offset.top;
		}
	}
	return event;
}
function addEventListeners(el, events, func, option) {
	events.split(' ').forEach(e => {
		el.addEventListener(e, func, option)
	})
}
function removeEventListeners(el, events, func, option) {
	events.split(' ').forEach(e => {
		el.removeEventListener(e, func, option)
	})
}

//Jquery
$.fn.deepest = function() {
	if (!this.length) return this;
	var opts = []
	this.each((i, node) => {
		var i = 0;
		var obj = $(node)
		while (obj.parent().get(0) instanceof HTMLBodyElement === false) {
			obj = obj.parent()
			i++;
		}
		opts.push({depth: i, o: node})
	})
	opts.sort((a, b) => (a.depth < b.depth));
	return $(opts[0].o)
}

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
Math.lerp = function(a,b,m) {
	return (m-a) / (b-a)
}
Math.isBetween = function(n, a, b) {
   return (n - a) * (n - b) <= 0
}
Math.trimDeg = function(a) {
	return (a+180*15)%360-180
}
Math.isPowerOfTwo = function(x) {
	return (x > 1) && ((x & (x - 1)) == 0);
}
Math.randomab = function(a, b) {
	return a + Math.random()*(b-a);
}
Math.areMultiples = function(n1, n2) {
	return (
		(n1/n2)%1 === 0 ||
		(n2/n1)%1 === 0
	)
}
Math.getNextPower =function(num, min) {
	var i = min ? min : 2
	while (i < num && i < 4000) {
		i *= 2
	}
	return i;
}
function trimFloatNumber(val) {
	if (val == '') return val;
	var string = val.toFixed(4)
	string = string.replace(/0+$/g, '').replace(/\.$/g, '')
	if (string == -0) return 0;
	return string;
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
function limitNumber(number, min, max) {
	if (number > max) number = max;
	if (number < min || isNaN(number)) number = min;
	return number;
}
function highestInObject(obj, inverse) {
	var n = inverse ? Infinity : -Infinity;
	var result;
	for (var key in obj) {
		if ( (!inverse && obj[key] > n) || (inverse && obj[key] < n) ) {
			n = obj[key];
			result = key;
		}
	}
	return result;
}
Math.clamp = limitNumber;
function getRectangle(a, b, c, d) {
	var rect = {};
	if (!b && typeof a === 'object') {
		rect = a
	} else if (typeof a === 'object' && a.x) {
		rect.ax = a.x
		rect.ay = a.y

		rect.bx = b.x
		rect.by = b.y
	} else {
		rect.ax = a
		rect.ay = b
		if (typeof c === 'number' && typeof d === 'number') {
			rect.bx = c
			rect.by = d
		} else {
			rect.bx = a
			rect.by = b
		}
	}
	if (rect.ax > rect.bx) {
		[rect.ax, rect.bx] = [rect.bx, rect.ax]
	}
	if (rect.ay > rect.by) {
		[rect.ay, rect.by] = [rect.by, rect.ay]
	}
	rect.x = rect.bx - rect.ax
	rect.y = rect.by - rect.ay
	return rect;
}
function doRectanglesOverlap(rect1, rect2) {
	if (rect1.ax > rect2.bx || rect2.ax > rect1.bx) {
		return false
	}
	if (rect1.ay > rect2.by || rect2.ay > rect1.by) {
		return false
	}
	return true;
}

//Date
Number.prototype.toDigitString = function(digits) {
	if (!digits) digits = 1;
	var s = this.toString();
	var l = s.length
	for (var i = 0; i < (digits-l); i++) {
		s = '0'+s;
	}
	return s;
}
Date.prototype.getDateArray = function() {
	return [
		this.getDate(),
		this.getMonth()+1,
		this.getYear()+1900
	];
}
Date.prototype.getDateString = function() {
	var a = this.getDateArray();
	return `${a[0].toDigitString(2)}.${a[1].toDigitString(2)}.${a[2]}`;
}
Date.prototype.dayOfYear = function() {
	var start = new Date(this.getFullYear(), 0, 0);
	var diff = this - start;
	var oneDay = 1000 * 60 * 60 * 24;
	return Math.floor(diff / oneDay);

}

//Array
Array.prototype.safePush = function(item) {
	if (!this.includes(item)) {
		this.push(item);
		return true;
	}
	return false;
}
Array.prototype.equals = function (array) {
	if (!array)
			return false;

	if (this.length != array.length)
			return false;

	for (var i = 0, l=this.length; i < l; i++) {
			if (this[i] instanceof Array && array[i] instanceof Array) {
					if (!this[i].equals(array[i]))
							return false;			 
			}					 
			else if (this[i] != array[i]) { 
					return false;	 
			}					 
	}			 
	return true;
}
Array.prototype.remove = function (item) { {
	var index = this.indexOf(item)
	if (index > -1) {
		this.splice(index, 1)
		return index;
	}
	return false;
	}		
}
Array.prototype.empty = function() {
	this.length = 0;
	return this;
}
Array.prototype.purge = function() {
	this.splice(0, Infinity);
	return this;
}
Array.prototype.findInArray = function(key, value) {
	for (var i = 0; i < this.length; i++) {
		if (this[i][key] === value) return this[i]
	}
	return false;
}
Array.prototype.last = function() {
	return this[this.length-1];
}
Array.prototype.positiveItems = function() {
	var x = 0, i = 0;
	while (i < this.length) {
		if (this[i]) x++;
		i++;
	}
	return x;
}
Array.prototype.allEqual = function(s) {
	var i = 0;
	while (i < this.length) {
		if (this[i] !== s) {
			return false;
		}
		i++;
	}
	return true;
}
Array.prototype.random = function() {
	return this[Math.floor(Math.random()*this.length)]
}
Array.prototype.forEachReverse = function(cb) {
	var i = this.length;
	for (var i = this.length-1; i >= 0; i--) {
		cb(this[i], i);
	}
}
Array.prototype.overlap = function(arr2) {
	var count = 0;
	for (var item of this) {
		if (arr2.includes(item)) count++;
	}
	return count;
}

//Object
Object.defineProperty(Array.prototype, "equals", {enumerable: false});

function omitKeys(obj, keys, dual_level) {
	var dup = {};
	for (key in obj) {
		if (keys.indexOf(key) == -1) {
			if (dual_level === true && typeof obj[key] === 'object') {
				dup[key] = {}
				for (key2 in obj[key]) {
					if (keys.indexOf(key2) == -1) {
							dup[key][key2] = obj[key][key2];
					}
				}
			} else {
				dup[key] = obj[key];
			}
		}
	}
	return dup;
}
function get (options, name, defaultValue) {
	return (name in options ? options[name] : defaultValue)
}
function getKeyByValue(object, value) {
	return Object.keys(object).find(key => object[key] === value);
}

var Objector = {
	equalKeys: function(obj, ref) {
		for (var key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (!ref.hasOwnProperty(key)) {
					return false;
				}
			}
		}
		for (var key in ref) {
			if (ref.hasOwnProperty(key)) {
				if (!obj.hasOwnProperty(key)) {
					return false;
				}
			}
		}
		return true;
	},
	keyLength: function(obj) {
		var l = 0;
		for (var key in obj) {
			if (obj.hasOwnProperty(key)) {
				l++;
			}
		}
		return l;
	}
}

var Merge = {
	number: function(obj, source, index) {
		if (source[index] !== undefined) {
			var val = source[index]
			if (typeof val === 'number' && !isNaN(val)) {
				obj[index] = val
			} else {
				val = parseFloat(val)
				if (typeof val === 'number' && !isNaN(val)) {
					obj[index] = val
				}
			}
		}
	},
	string: function(obj, source, index) {
		if (source[index] !== undefined) {
			var val = source[index]
			if (typeof val === 'string') {
				obj[index] = val
			} else {
				obj[index] = val+''
			}
		}
	},
	boolean: function(obj, source, index) {
		if (source[index] !== undefined) {
			obj[index] = source[index]
		}
	},
	function: function(obj, source, index) {
		if (typeof source[index] === 'function') {
			obj[index] = source[index]
		}
	}
}

//String
function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}
function autoStringify(object) {
	return compileJSON(object, {small: settings.minifiedout.value})
}
function pluralS(arr) {
	if (arr.length === 1 || arr === 1) {
		return '';
	} else {
		return 's';
	}
}
function pathToName(path, extension) {
	var path_array = path.split('/').join('\\').split('\\')
	if (extension === true) {
		return path_array[path_array.length-1]
	} else {
		return path_array[path_array.length-1].replace(/\.\w+$/, '')
	}
}
function pathToExtension(path) {
	if (typeof path !== 'string') return '';
	var matches = path.match(/\.\w{2,24}$/)
	if (!matches || !matches.length) return '';
	return matches[0].replace('.', '').toLowerCase()
}

//Color
tinycolor.prototype.toInt = function() {
	var rgba = this.toRgb()
	return Jimp.rgbaToInt(rgba.r, rgba.g, rgba.b, rgba.a)
}
function getAverageRGB(imgEl, blockSize) {
		
	var defaultRGB = {r:0,g:0,b:0}, // for non-supporting envs
		canvas = document.createElement('canvas'),
		context = canvas.getContext && canvas.getContext('2d'),
		data, width, height,
		i = -4,
		length,
		rgb = {r:0,g:0,b:0},
		count = 0;
			
	if (!context) {
		return defaultRGB;
	}
	
	height = canvas.height = imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height;
	width = canvas.width = imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width;
	
	context.drawImage(imgEl, 0, 0);
	
	try {
		data = context.getImageData(0, 0, width, height);
	} catch(e) {
		/* security error, img on diff domain */alert('x');
		return defaultRGB;
	}
	
	length = data.data.length;

	if (!blockSize) blockSize = Math.ceil(length/64)
	
	while ( (i += blockSize * 4) < length ) {
		if (data.data[i+3] > 0) {
			++count;
			rgb.r += data.data[i];
			rgb.g += data.data[i+1];
			rgb.b += data.data[i+2];
		}
	}
	
	// ~~ used to floor values
	rgb.r = ~~(rgb.r/count);
	rgb.g = ~~(rgb.g/count);
	rgb.b = ~~(rgb.b/count);
	
	return rgb;	
}

