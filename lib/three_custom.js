THREE.BoxGeometry.prototype.from = function(arr) {
	/*
	vertices[0] //south east up
	vertices[1] //north east up
	vertices[2] //south east down
	vertices[3] //north east down
	vertices[4] //north west up
	vertices[5] //south west up
	vertices[6] //north west down
	vertices[7] //south west down
	*/
	//X
	this.vertices[4].setX(arr[0])
	this.vertices[5].setX(arr[0])
	this.vertices[6].setX(arr[0])
	this.vertices[7].setX(arr[0])
	//Y
	this.vertices[2].setY(arr[1])
	this.vertices[3].setY(arr[1])
	this.vertices[6].setY(arr[1])
	this.vertices[7].setY(arr[1])
	//Z
	this.vertices[1].setZ(arr[2])
	this.vertices[3].setZ(arr[2])
	this.vertices[4].setZ(arr[2])
	this.vertices[6].setZ(arr[2])

	this.verticesNeedUpdate = true
}
THREE.BoxGeometry.prototype.to = function(arr) {
	//X
	this.vertices[0].setX(arr[0])
	this.vertices[1].setX(arr[0])
	this.vertices[2].setX(arr[0])
	this.vertices[3].setX(arr[0])
	//Y
	this.vertices[0].setY(arr[1])
	this.vertices[1].setY(arr[1])
	this.vertices[4].setY(arr[1])
	this.vertices[5].setY(arr[1])
	//Z
	this.vertices[0].setZ(arr[2])
	this.vertices[2].setZ(arr[2])
	this.vertices[5].setZ(arr[2])
	this.vertices[7].setZ(arr[2])

	this.verticesNeedUpdate = true
}
Object.assign( THREE.Euler.prototype, {
	setFromDegreeArray: function ( arr, invert ) {

		this._x = Math.degToRad(arr[0]) * (invert ? -1 : 1);
		this._y = Math.degToRad(arr[1]) * (invert ? -1 : 1);
		this._z = Math.degToRad(arr[2]) * (invert ? -1 : 1);

		this.onChangeCallback();

		return this;

	}
})
THREE.Euler.prototype.inverse = function () {

	var q = new THREE.Quaternion();
	return function inverse() {

		return this.setFromQuaternion( q.setFromEuler( this ).inverse() );

	};
}();
THREE.Vector3.prototype.removeEuler = function (euler) {
	return function removeEuler(euler) {
		var inverse = new THREE.Euler().copy(euler).inverse();
		this.applyEuler(inverse)
		return this;
	};
}();
THREE.Vector3.prototype.toString = function() {
	return `${this.x}, ${this.y}, ${this.z}`
}
var GridBox = function( from, to, size, material) {

	var vertices = [];

	function getVector2(arr, axis) {
		switch (axis) {
			case 0: return [arr[1], arr[2]]; break;
			case 1: return [arr[0], arr[2]]; break;
			case 2: return [arr[0], arr[1]]; break;
		}
	}
	function addVector(u, v, axis, w) {
		switch (axis) {
			case 0: vertices.push(w, u, v); break;
			case 1: vertices.push(u, w, v); break;
			case 2: vertices.push(u, v, w); break;
		}
	}

	for (var axis = 0; axis < 3; axis++) {
		
		var start = getVector2(from, axis)
		var end = getVector2(to, axis)
		var steps = getVector2(size, axis)

		for (var side = 0; side < 2; side++) {
			var w = side ? from[axis] : to[axis]

			//lines
			var step = Math.abs( (end[1]-start[1]) / steps[1] );
			if (step < 0.0625) step = 0.0625;
			for (var line = start[1]; line <= end[1]; line += step) {
				addVector(start[0], line, axis, w)
				addVector(end[0], line, axis, w)
			}
			//Columns
			var step = Math.abs( (end[0]-start[0]) / steps[0] );
			if (step < 0.0625) step = 0.0625;
			for (var col = start[0]; col <= end[0]; col += step) {
				addVector(col, start[1], axis, w)
				addVector(col, end[1], axis, w)
			}
		}
	}

	var geometry = new THREE.BufferGeometry();
	geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );

	material = material || new THREE.LineBasicMaterial( { color: gizmo_colors.grid } );

	THREE.LineSegments.call( this, geometry, material );
}
GridBox.prototype = Object.assign( Object.create( THREE.LineSegments.prototype ), {
	constructor: GridBox,
	copy: function ( source ) {
		THREE.LineSegments.prototype.copy.call( this, source );
		this.geometry.copy( source.geometry );
		this.material.copy( source.material );
		return this;
	},
	clone: function () {
		return new this.constructor().copy( this );
	}
} );
THREE.GridBox = GridBox

THREE.Object3D.prototype.toScreenPosition = function(camera, canvas)
{
    var vector = new THREE.Vector3();

    var widthHalf = 0.5*canvas.width;
    var heightHalf = 0.5*canvas.height;

    this.updateMatrixWorld();
    vector.setFromMatrixPosition(this.matrixWorld);
    vector.project(camera);

    vector.x = ( vector.x * widthHalf ) + widthHalf;
    vector.y = - ( vector.y * heightHalf ) + heightHalf;
    vector.divideScalar(window.devicePixelRatio);

    return { 
        x: vector.x,
        y: vector.y
    };

};

THREE.NormalX = new THREE.Vector3(1, 0, 0);
THREE.NormalY = new THREE.Vector3(0, 1, 0);
THREE.NormalZ = new THREE.Vector3(0, 0, 1);
//22725 Init Log
//17544 ProgramLog message
//22919 WebGL Error
//AxesHelper
//45899 Grid Color { color: color1 }
