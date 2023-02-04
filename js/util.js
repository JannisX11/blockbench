//Blockbench
function compareVersions(string1/*new*/, string2/*old*/) {
	// Is string1 newer than string2 ?
	var arr1 = string1.split(/[.-]/);
	var arr2 = string2.split(/[.-]/);
	var i = 0;
	var num1 = 0;
	var num2 = 0;
	while (i < Math.max(arr1.length, arr2.length)) {
		num1 = arr1[i];
		num2 = arr2[i];
		if (num1 == 'beta') num1 = -1;
		if (num2 == 'beta') num2 = -1;
		num1 = parseInt(num1) || 0;
		num2 = parseInt(num2) || 0;
		if (num1 > num2) {
			return true;
		} else if (num1 < num2) {
			return false
		}
		i++;
	}
	return false;
}
/**
 * 
 * @param {*} condition Input condition. Can be undefined, a boolean, a function or a condition object
 * @param {*} context 
 */
const Condition = function(condition, context) {
	if (condition !== undefined && condition !== null && condition.condition !== undefined) {
		condition = condition.condition
	}
	if (condition === undefined) {
		return true;
	} else if (typeof condition === 'function') {
		return !!condition(context)
	} else if (typeof condition === 'object') {
		if (condition.modes instanceof Array && condition.modes.includes(Modes.id) === false) return false;
		if (condition.formats instanceof Array && condition.formats.includes(Format.id) === false) return false;
		if (condition.tools instanceof Array && window.Toolbox && condition.tools.includes(Toolbox.selected.id) === false) return false;
		if (condition.features instanceof Array && Format && condition.features.find(feature => !Format[feature])) return false;
		if (condition.selected) {
			if (condition.selected.animation === true && !Animation.selected) return false;
			if (condition.selected.animation === false && Animation.selected) return false;
			if (condition.selected.animation_controller === true && !AnimationController.selected) return false;
			if (condition.selected.animation_controller === false && AnimationController.selected) return false;
			if (condition.selected.animation_controller_state === true && !(AnimationController.selected?.selected_state)) return false;
			if (condition.selected.animation_controller_state === false && (AnimationController.selected?.selected_state)) return false;
			if (condition.selected.keyframe === true && !(Keyframe.selected.length)) return false;
			if (condition.selected.keyframe === false && (Keyframe.selected.length)) return false;
			if (condition.selected.group === true && !Group.selected) return false;
			if (condition.selected.group === false && Group.selected) return false;
			if (condition.selected.texture === true && !Texture.selected) return false;
			if (condition.selected.texture === false && Texture.selected) return false;
			if (condition.selected.element === true && !Outliner.selected.length) return false;
			if (condition.selected.element === false && Outliner.selected.length) return false;
			if (condition.selected.cube === true && !Cube.selected.length) return false;
			if (condition.selected.cube === false && Cube.selected.length) return false;
			if (condition.selected.mesh === true && !Mesh.selected.length) return false;
			if (condition.selected.mesh === false && Mesh.selected.length) return false;
			if (condition.selected.locator === true && !Locator.selected.length) return false;
			if (condition.selected.locator === false && Locator.selected.length) return false;
			if (condition.selected.null_object === true && !NullObject.selected.length) return false;
			if (condition.selected.null_object === false && NullObject.selected.length) return false;
			if (condition.selected.texture_mesh === true && !TextureMesh.selected.length) return false;
			if (condition.selected.texture_mesh === false && TextureMesh.selected.length) return false;
			if (condition.selected.outliner === true && !(Outliner.selected.length || Group.selected)) return false;
			if (condition.selected.outliner === false && (Outliner.selected.length || Group.selected)) return false;
		}
		if (condition.project && !Project) return false;

		if (condition.method instanceof Function) {
			return !!condition.method(context);
		}
		return true;
	} else {
		return !!condition
	}
}
Condition.mutuallyExclusive = function(a, b) {
	if (typeof a !== 'object' || typeof b !== 'object') return false;
	if (a.modes && b.modes && a.modes.overlap(b.modes) == 0) return true;
	if (a.tools && b.tools && a.tools.overlap(b.tools) == 0) return true;
	if (a.formats && b.formats && a.formats.overlap(b.formats) == 0) return true;
	if (a.features && b.features && a.features.overlap(b.features) == 0) return true;
	if (a.selected && b.selected) {
		for (let key in a.selected) {
			if (a.selected[key] === true && b.selected[key] === false) return true;
			if (a.selected[key] === false && b.selected[key] === true) return true;
		}
	}
	return false;
}

function pureMarked(input) {
	let dom = marked(input);
	return DOMPurify.sanitize(dom);
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
		//event.preventDefault();
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

function patchedAtob(base64) {
	return (typeof Buffer == 'function')
		? Buffer.from(base64, 'base64').toString()
		: atob(base64);
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
function trimFloatNumber(val, max_digits = 4) {
	if (val == '') return val;
	var string = val.toFixed(max_digits)
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
	rect.x = rect.w = rect.bx - rect.ax
	rect.y = rect.h = rect.by - rect.ay
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
Array.prototype.safePush = function(...items) {
	let included = false;
	for (var item of items) {
		if (!this.includes(item)) {
			this.push(item);
			included = true;
		}
	}
	return included;
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
Array.prototype.remove = function (...items) {
	items.forEach(item => {
		var index = this.indexOf(item)
		if (index > -1) {
			this.splice(index, 1)
		}
	})		
}
Array.prototype.empty = function() {
	this.splice(0, this.length);
	return this;
}
Array.prototype.purge = function() {
	this.splice(0, this.length);
	return this;
}
Array.prototype.replace = function(items) {
	this.splice(0, this.length, ...items);
	return this;
}
Array.prototype.allAre = function(cb) {
	return this.findIndex((item, index) => {
		return !cb(item, index);
	}) === -1;
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
Array.prototype.toggle = function(item, state = !this.includes(item)) {
	if (state) {
		this.safePush(item);
	} else {
		this.remove(item);
	}
}

//Array Vector
Array.prototype.V3_set = function(x, y, z) {
	if (x instanceof Array) return this.V3_set(...x);
	if (y === undefined && z === undefined) z = y = x;
	this[0] = parseFloat(x)||0;
	this[1] = parseFloat(y)||0;
	this[2] = parseFloat(z)||0;
	return this;
}
Array.prototype.V3_add = function(x, y, z) {
	if (x instanceof Array) return this.V3_add(...x);
	if (x instanceof THREE.Vector3) return this.V3_add(x.x, x.y, x.z);
	this[0] += parseFloat(x)||0;
	this[1] += parseFloat(y)||0;
	this[2] += parseFloat(z)||0;
	return this;
}
Array.prototype.V3_subtract = function(x, y, z) {
	if (x instanceof Array) return this.V3_subtract(...x);
	if (x instanceof THREE.Vector3) return this.V3_subtract(x.x, x.y, x.z);
	this[0] -= parseFloat(x)||0;
	this[1] -= parseFloat(y)||0;
	this[2] -= parseFloat(z)||0;
	return this;
}
Array.prototype.V3_multiply = function(x, y, z) {
	if (x instanceof Array) return this.V3_multiply(...x);
	if (x instanceof THREE.Vector3) return this.V3_multiply(x.x, x.y, x.z);
	if (y === undefined && z === undefined) z = y = x;
	this[0] *= parseFloat(x)||0;
	this[1] *= parseFloat(y)||0;
	this[2] *= parseFloat(z)||0;
	return this;
}
Array.prototype.V3_divide = function(x, y, z) {
	if (x instanceof Array) return this.V3_divide(...x);
	if (x instanceof THREE.Vector3) return this.V3_divide(x.x, x.y, x.z);
	if (y === undefined && z === undefined) z = y = x;
	this[0] /= parseFloat(x)||1;
	this[1] /= parseFloat(y)||1;
	this[2] /= parseFloat(z)||1;
	return this;
}
Array.prototype.V3_toThree = function() {
	return new THREE.Vector3(this[0], this[1], this[2]);
}
Array.prototype.V2_set = function(x, y) {
	if (x instanceof Array) return this.V2_set(...x);
	if (y === undefined) y = x;
	this[0] = parseFloat(x)||0;
	this[1] = parseFloat(y)||0;
	return this;
}
Array.prototype.V2_add = function(x, y) {
	if (x instanceof Array) return this.V2_add(...x);
	this[0] += parseFloat(x)||0;
	this[1] += parseFloat(y)||0;
	return this;
}
Array.prototype.V2_subtract = function(x, y) {
	if (x instanceof Array) return this.V2_subtract(...x);
	this[0] -= parseFloat(x)||0;
	this[1] -= parseFloat(y)||0;
	return this;
}
Array.prototype.V2_multiply = function(x, y) {
	if (x instanceof Array) return this.V2_multiply(...x);
	if (y === undefined) y = x;
	this[0] *= parseFloat(x)||0;
	this[1] *= parseFloat(y)||0;
	return this;
}
Array.prototype.V2_divide = function(x, y) {
	if (x instanceof Array) return this.V2_divide(...x);
	if (y === undefined) y = x;
	this[0] /= parseFloat(x)||1;
	this[1] /= parseFloat(y)||1;
	return this;
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
	number(obj, source, index) {
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
	string(obj, source, index, validate) {
		if (source[index] || typeof source[index] === 'string') {
			var val = source[index]
			if (typeof val !== 'string') val = val.toString();
			if (validate instanceof Function === false || validate(val)) {
				obj[index] = val
			}
		}
	},
	molang(obj, source, index) {
		if (['string', 'number'].includes(typeof source[index])) {
			obj[index] = source[index];
		}
	},
	boolean(obj, source, index, validate) {
		if (source[index] !== undefined) {
			if (validate instanceof Function === false || validate(source[index])) {
				obj[index] = source[index]
			}
		}
	},
	function(obj, source, index, validate) {
		if (typeof source[index] === 'function') {
			if (validate instanceof Function === false || validate(source[index])) {
				obj[index] = source[index]
			}
		}
	},
	arrayVector(obj, source, index, validate) {
		if (source[index] instanceof Array) {
			if (validate instanceof Function === false || validate(source[index])) {
				obj[index].V3_set(source[index]);
			}
		}
	},
	arrayVector2(obj, source, index, validate) {
		if (source[index] instanceof Array) {
			if (validate instanceof Function === false || validate(source[index])) {
				obj[index].replace(source[index]);
			}
		}
	}
}

function onVueSetup(func) {
	if (!onVueSetup.funcs) {
		onVueSetup.funcs = []
	}
	onVueSetup.funcs.push(func)
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
Object.defineProperty(String.prototype, 'hashCode', {
	value() {
		var hash = 0, i, chr;
		for (i = 0; i < this.length; i++) {
			chr   = this.charCodeAt(i);
			hash  = ((hash << 5) - hash) + chr;
			hash |= 0;
		}
		return hash;
	}
});

//Color
tinycolor.prototype.toInt = function() {
	let {r, g, b, a} = this.toRgb();
	return r * Math.pow(256, 3) + g * Math.pow(256, 2) + b * Math.pow(256, 1) + a * Math.pow(256, 0);
}
function intToRGBA(int) {
	const rgba = {};

	rgba.r = Math.floor(int / Math.pow(256, 3));
	rgba.g = Math.floor((int - rgba.r * Math.pow(256, 3)) / Math.pow(256, 2));
	rgba.b = Math.floor(
		(int - rgba.r * Math.pow(256, 3) - rgba.g * Math.pow(256, 2)) /
			Math.pow(256, 1)
	);
	rgba.a = Math.floor(
		(int -
			rgba.r * Math.pow(256, 3) -
			rgba.g * Math.pow(256, 2) -
			rgba.b * Math.pow(256, 1)) /
			Math.pow(256, 0)
	);
	return rgba;
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

function stringifyLargeInt(int) {
	let string = int.toString();
	return string.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}


function intersectLines(p1, p2, p3, p4) {
	let s1 = [ p2[0] - p1[0],   p2[1] - p1[1] ];
	let s2 = [ p4[0] - p3[0],   p4[1] - p3[1] ];

	let s = (-s1[1] * (p1[0] - p3[0]) + s1[0] * (p1[1] - p3[1])) / (-s2[0] * s1[1] + s1[0] * s2[1]);
	let t = ( s2[0] * (p1[1] - p3[1]) - s2[1] * (p1[0] - p3[0])) / (-s2[0] * s1[1] + s1[0] * s2[1]);

	return (s >= 0 && s <= 1 && t >= 0 && t <= 1);
}
function pointInRectangle(point, rect_start, rect_end) {
	return (point[0] > rect_start[0] && point[0] < rect_end[0] && point[1] > rect_start[1] && point[1] < rect_end[1])
}
function lineIntersectsReactangle(p1, p2, rect_start, rect_end) {
	// Check if points inside rect
	if (pointInRectangle(p1, rect_start, rect_end)) return true;
	if (pointInRectangle(p2, rect_start, rect_end)) return true;
	// If points are the same, the line no longer intersect
	if (Math.epsilon(p1[0], p2[0], 0.01) && Math.epsilon(p1[1], p2[1], 0.01)) return false;
	// Intersect all 4 lines of rect
	return intersectLines(p1, p2, [rect_start[0], rect_start[1]], [rect_end[0], rect_start[1]])
		|| intersectLines(p1, p2, [rect_start[0], rect_start[1]], [rect_start[0], rect_end[1]])
		|| intersectLines(p1, p2, [rect_end[0], rect_end[1]], [rect_end[0], rect_start[1]])
		|| intersectLines(p1, p2, [rect_end[0], rect_end[1]], [rect_start[0], rect_end[1]])
}

function cameraTargetToRotation(position, target) {
	let spherical = new THREE.Spherical();
	spherical.setFromCartesianCoords(...target.slice().V3_subtract(position));
	let theta = Math.radToDeg(-spherical.theta);
	let phi = Math.radToDeg(-spherical.phi) - 90;
	if (phi < 90) phi += 180; theta += 180;
	return [theta, phi];
}
function cameraRotationToTarget(position, rotation) {
	let vec = new THREE.Vector3(0, 0, 16);
	vec.applyEuler(new THREE.Euler(Math.degToRad(rotation[1]), Math.degToRad(rotation[0]), 0, 'ZYX'));
	vec.z *= -1;
	vec.y *= -1;
	return vec.toArray().V3_add(position);
}
