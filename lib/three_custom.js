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
//22138 Init Log
//17264 ProgramLog message
//22319 WebGL Error
//AxesHelper
//44584 Grid Color { color: color1 }
