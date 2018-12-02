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
function useBedrockFlipFix(axis) {
	if (Blockbench.entity_mode === false) return false;
	if (typeof axis === 'string') {
		axis = getAxisNumber(axis)
	}
	var group;
	if (selected_group) {
			var group = selected_group
	} else {
		var i = 0;
		while (i < selected.length) {
			if (typeof selected[i].parent === 'object' &&
				selected[i].parent.type === 'group'
			) {
				var group = selected[i].parent
			}
			i++;
		}
	}
	if (group) {
		var rotations = group.rotation.slice()
		rotations.splice(axis, 1)
		rotations.forEach(function(r, i) {
			rotations[i] = (r >= -90 && r <= 90)
		})
		return rotations[0] !== rotations[1]
	} else {
		return false
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
function trimFloatNumber(val) {
	if (val == '') return val;
	var string = val.toFixed(4)
	string = string.replace(/0+$/g, '').replace(/\.$/g, '')
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

//Array
Array.prototype.safePush = function(item) {
	if (!this.includes(item)) {
		this.push(item)
	}
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
}
Array.prototype.findInArray = function(key, value) {
	if (this.length === 0) return {};
	var i = 0
	while (i < this.length) {
		if (this[i][key] === value) return this[i]
		i++;
	}
	return {};
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
	} else if (extension === 'mobs_id') {
		var name = path_array[path_array.length-1].split('.').slice(0, -1).join('.')
		if (name === 'mobs' && path_array[path_array.length-3]) {
			name = name + ' (' + path_array[path_array.length-3].substr(0,8) + '...)'
		}
		return name
	} else {
		return path_array[path_array.length-1].replace(/\.\w+$/, '')
	}
}
function pathToExtension(path) {
	var matches = path.match(/\.\w{2,24}$/)
	if (!matches || !matches.length) return '';
	return matches[0].replace('.', '').toLowerCase()
}

//Color
tinycolor.prototype.toInt = function() {
	var rgba = this.toRgb()
	return Jimp.rgbaToInt(rgba.r, rgba.g, rgba.b, rgba.a)
}
function getAverageRGB(imgEl) {
		
		var blockSize = 5, // only visit every 5 pixels
				defaultRGB = {r:0,g:0,b:0}, // for non-supporting envs
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

