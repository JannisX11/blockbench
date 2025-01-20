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
			if (condition.selected.group === true && !Group.first_selected) return false;
			if (condition.selected.group === false && Group.first_selected) return false;
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
			if (condition.selected.outliner === true && !(Outliner.selected.length || Group.first_selected)) return false;
			if (condition.selected.outliner === false && (Outliner.selected.length || Group.first_selected)) return false;
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

async function wait(delay) {
	await new Promise((resolve) => {
		setTimeout(resolve, delay);
	})
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
function getStringWidth(string, size) {
	let node = Interface.createElement('label', {style: 'position: absolute; visibility: hidden;'}, string);
	if (size && size !== 16) {
		node.style.fontSize = size + 'pt';
	}
	document.body.append(node);
	let width = node.clientWidth;
	node.remove();
	return width + 1;
};

function patchedAtob(base64) {
	if (typeof Buffer == 'function') {
		return Buffer.from(base64, 'base64').toString();
	} else {
		return decodeURIComponent(atob(base64).split('').map((c) => {
			return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
		}).join(''));
	}
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

class Rectangle {
	constructor(start_x = 0, start_y = 0, width = 0, height = 0) {
		this.start_x = start_x;
		this.start_y = start_y;
		this.width = width;
		this.height = height;
	}
	get start() {
		return [this.x, this.y];
	}
	get w() {
		return this.width;
	}
	get h() {
		return this.width;
	}
	get end_x() {
		return this.start_x + this.width;
	}
	get end_y() {
		return this.start_y + this.height;
	}
	set end_x(val) {
		return this.width = val - this.start_x;
	}
	set end_y(val) {
		return this.height = val - this.start_y;
	}
	get area() {
		return this.width * this.height;
	}
	fromCoords(x1, y1, x2, y2) {
		this.start_x = x1;
		this.width = x2 - x1;
		this.start_y = y1;
		this.height = y2 - y1;
	}
	fromUnorderedCoords(x1, y1, x2, y2) {
		if (x1 < x2) {
			this.start_x = x1;
			this.width = x2 - x1;
		} else {
			this.start_x = x2;
			this.width = x1 - x2;
		}
		if (y1 < y2) {
			this.start_y = y1;
			this.height = y2 - y1;
		} else {
			this.start_y = y2;
			this.height = y1 - y2;
		}
	}
	expandTo(x, y) {
		if (x < this.start_x) this.start_x = x;
		else if (x > this.end_x) this.end_x = x;

		if (y < this.start_y) this.start_y = y;
		else if (y > this.end_y) this.end_y = y;
	}
}
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


//Object
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
		if (typeof source[index] == 'string') {
			obj[index] = source[index].replace(/-?\d\.\d+e-\d\d/g, '0');
		} else if (typeof source[index] == 'number') {
			obj[index] = Math.roundTo(source[index], 9).toString();
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
function exportMolang(input) {
	if (!input) return 0;
	if (typeof input == 'string') {
		if (!isNaN(input)) {
			let num = parseFloat(input);
			return isNaN(num) ? 0 : num;
		} else {
			return input.replace(/\n/g, '');
		}
	} else if (typeof input == 'number') {
		return input;
	} else {
		return 0;
	}
}

// HTML
function isNodeUnderCursor(node, event) {
	if (!node) return;
	let rect = node.getBoundingClientRect();
	return pointInRectangle([event.clientX, event.clientY], [rect.x, rect.y], [rect.right+1, rect.bottom+1]);
}
function findNodeUnderCursor(selector, event) {
	return document.querySelectorAll(selector).entries().map(([i, node]) => node).find(node => isNodeUnderCursor(node, event));
}


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
// Source: https://github.com/antimatter15/rgb-lab/
function rgb2lab(rgb){
	var r = rgb[0] / 255,
		g = rgb[1] / 255,
		b = rgb[2] / 255,
		x, y, z;
  
	r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
	g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
	b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  
	x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
	y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
	z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  
	x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
	y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
	z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;
  
	return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)]
}

// calculate the perceptual distance between colors in CIELAB
// https://github.com/THEjoezack/ColorMine/blob/master/ColorMine/ColorSpaces/Comparisons/Cie94Comparison.cs

function labColorDistance(labA, labB){
	var deltaL = labA[0] - labB[0];
	var deltaA = labA[1] - labB[1];
	var deltaB = labA[2] - labB[2];
	var c1 = Math.sqrt(labA[1] * labA[1] + labA[2] * labA[2]);
	var c2 = Math.sqrt(labB[1] * labB[1] + labB[2] * labB[2]);
	var deltaC = c1 - c2;
	var deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
	deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
	var sc = 1.0 + 0.045 * c1;
	var sh = 1.0 + 0.015 * c1;
	var deltaLKlsl = deltaL / (1.0);
	var deltaCkcsc = deltaC / (sc);
	var deltaHkhsh = deltaH / (sh);
	var i = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh;
	return i < 0 ? 0 : Math.sqrt(i);}

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
function pointInTriangle(pt, v1, v2, v3) {
	function sign(p1, p2, p3) {
		return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
	}
	let d1 = sign(pt, v1, v2);
	let d2 = sign(pt, v2, v3);
	let d3 = sign(pt, v3, v1);

	let has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
	let has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);

	return !(has_neg && has_pos);
}
function pointInPolygon(point, polygon_points) {
	// ray-casting algorithm based on
    // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html
    let x = point[0], y = point[1], vs = polygon_points;
    
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1];
        let xj = vs[j][0], yj = vs[j][1];
        
        let intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}
function lineIntersectsTriangle(l1, l2, v1, v2, v3) {
	return intersectLines(l1, l2, v1, v2) || intersectLines(l1, l2, v2, v3) || intersectLines(l1, l2, v3, v1);
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

function getDateDisplay(input_date) {
	let date = new Date(input_date);
	var diff = Math.round(Blockbench.openTime / (60_000*60*24)) - Math.round(date / (60_000*60*24));
	let label;
	if (diff <= 0) {
		label = tl('dates.today');
	} else if (diff == 1) {
		label = tl('dates.yesterday');
	} else if (diff <= 7) {
		label = tl('dates.this_week');
	} else if (diff <= 60) {
		label = tl('dates.weeks_ago', [Math.ceil(diff/7)]);
	} else {
		label = date.toLocaleDateString();
	}
	return {
		short: label,
		full: date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
	}
}

const NativeGlobals = {
	Animation
}
