THREE.BufferGeometry.prototype.setShape = function(from, to) {
	let {position} = this.attributes;

	// East
	position.array.set([
		to[0], to[1], to[2],
		to[0], to[1], from[2],
		to[0], from[1], to[2],
		to[0], from[1], from[2],
	], 0)
	// West
	position.array.set([
		from[0], to[1], from[2],
		from[0], to[1], to[2],
		from[0], from[1], from[2],
		from[0], from[1], to[2],
	], 12)

	// Up
	position.array.set([
		from[0], to[1], from[2],
		to[0], to[1], from[2],
		from[0], to[1], to[2],
		to[0], to[1], to[2],
	], 24)
	// Down
	position.array.set([
		from[0], from[1], to[2],
		to[0], from[1], to[2],
		from[0], from[1], from[2],
		to[0], from[1], from[2],
	], 36)

	// South
	position.array.set([
		from[0], to[1], to[2],
		to[0], to[1], to[2],
		from[0], from[1], to[2],
		to[0], from[1], to[2],
	], 48)
	// North
	position.array.set([
		to[0], to[1], from[2],
		from[0], to[1], from[2],
		to[0], from[1], from[2],
		from[0], from[1], from[2],
	], 60)

	position.needsUpdate = true;
}
Object.assign( THREE.Euler.prototype, {
	setFromDegreeArray: function ( arr, invert ) {

		this._x = Math.degToRad(arr[0]) * (invert ? -1 : 1);
		this._y = Math.degToRad(arr[1]) * (invert ? -1 : 1);
		this._z = Math.degToRad(arr[2]) * (invert ? -1 : 1);

		this._onChangeCallback();

		return this;

	}
})
THREE.Euler.prototype.invert = function () {

	var q = new THREE.Quaternion();
	return function invert() {

		return this.setFromQuaternion( q.setFromEuler( this ).invert() );

	};
}();
THREE.Vector3.prototype.removeEuler = function (euler) {
	return function removeEuler(euler) {
		var invert = new THREE.Euler().copy(euler).invert();
		this.applyEuler(invert)
		return this;
	};
}();
THREE.Vector3.prototype.toString = function() {
	return `${this.x}, ${this.y}, ${this.z}`
}

class GridBox extends THREE.LineSegments {
	constructor( from, to, size, material) {

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

		//THREE.LineSegments.call( this, geometry, material );
	}
}
/*
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
} );*/
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

THREE.AxesHelper = class AxesHelper extends THREE.LineSegments {
	constructor( size ) {

		size = size || 1;

		var vertices = [
			0, 0, 0,	size, 0, 0,
			0, 0, 0,	0, size, 0,
			0, 0, 0,	0, 0, size
		];

		var geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
		var material = new THREE.LineBasicMaterial( { vertexColors: THREE.VertexColors } );

		super(geometry, material);
		this.updateColors();
	}
	updateColors() {
		var colors = [
			...gizmo_colors.r.toArray(), ...gizmo_colors.r.toArray(), 
			...gizmo_colors.g.toArray(), ...gizmo_colors.g.toArray(), 
			...gizmo_colors.b.toArray(), ...gizmo_colors.b.toArray(),
		]
		this.geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
	}
}

THREE.AxesHelper.prototype = Object.create( THREE.LineSegments.prototype );
THREE.AxesHelper.prototype.constructor = THREE.AxesHelper;

THREE.GridHelper = class GridHelper extends THREE.LineSegments {

	constructor( size, divisions, material ) {

		size = size || 10;
		divisions = divisions || 10;

		const step = size / divisions;
		const halfSize = size / 2;

		const vertices = [];

		for ( let i = 0, j = 0, k = - halfSize; i <= divisions; i ++, k += step ) {

			vertices.push( - halfSize, 0, k, halfSize, 0, k );
			vertices.push( k, 0, - halfSize, k, 0, halfSize );

		}

		var geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );

		super( geometry, material );

		this.type = 'GridHelper';

	}

}

THREE.NormalX = new THREE.Vector3(1, 0, 0);
THREE.NormalY = new THREE.Vector3(0, 1, 0);
THREE.NormalZ = new THREE.Vector3(0, 0, 1);

THREE.fastWorldPosition = (object, vec) => {
	if (!vec) {
		vec = new THREE.Vector3();
	} else {
		vec.set(0, 0, 0);
	}
	object.localToWorld(vec);
	return vec;
}
