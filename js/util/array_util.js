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
Array.prototype.set = function(index, value) {
	this.splice(index, 1, value);
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
Object.defineProperty(Array.prototype, "equals", {enumerable: false});

//Array Vector
Array.prototype.V3_set = function(x, y, z) {
	if (x instanceof Array) return this.V3_set(...x);
	if (x instanceof THREE.Vector3) return this.V3_set(x.x, x.y, x.z);
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