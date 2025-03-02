/**
 * @license
 * Copyright 2010-2022 fik.js Authors
 * SPDX-License-Identifier: MIT
 */
const Tools = {

	error: function (str) {

		console.error( str );

	},


};

const math = {

	PI:Math.PI,
	toRad: Math.PI / 180,
	toDeg: 180 / Math.PI,
	pi90: Math.PI * 0.5,
	twoPI: Math.PI * 2,

	// Center point is p1; angle returned in Radians
    //findAngle: function ( p0, p1, p2 ) {
    findAngle: function ( b0, b1 ) {

    	//return Math.atan2( b1.end - b0.end, b1.start - b0.start )

    	/*let a = p1.minus(p2).lengthSq(), 
	    	b = p1.minus(p0).lengthSq(), 
	    	c = p2.minus(p0).lengthSq(),*/
	    let a = b0.end.minus(b1.end).lengthSq(), 
	    	b = b0.end.minus(b0.start).lengthSq(),
	    	c = b1.end.minus(b0.start).lengthSq(),
	    	angle, r, sign;

	    r = ( a + b - c ) / Math.sqrt( 4 * a * b );
        if( r <= -1 ) angle = Math.PI;
		else if( r >= 1 ) angle = 0;
		else angle = Math.acos( r );
		// sign
		sign = b0.end.x * b1.end.y - b0.end.y * b1.end.x;
		return sign >= 0 ? angle : -angle;

	},

	clamp: function ( v, min, max ) {

	    v = v < min ? min : v;
	    v = v > max ? max : v;
	    return v;

	},

	/*clamp: function ( value, min, max ) {

		return Math.max( min, Math.min( max, value ) );

	},*/

	lerp: function ( x, y, t ) { 

		return ( 1 - t ) * x + t * y; 

	},

	rand: function ( low, high ) { 

		return low + Math.random() * ( high - low ); 

	},

	randInt: function ( low, high ) { 

		return low + Math.floor( Math.random() * ( high - low + 1 ) ); 

	},

	nearEquals: function (a, b, t) { 

		return Math.abs(a - b) <= t ? true : false; 

	},

	perpendicular: function ( a, b ) {

		return math.nearEquals( a.dot(b), 0.0, 0.01 ) ? true : false;

	    //return math.nearEquals( math.dotProduct(a, b), 0.0, 0.01 ) ? true : false;

	},

	genPerpendicularVectorQuick: function ( v ) {

		//return math.genPerpendicularVectorFrisvad( v );

	    let p = v.clone();
	    // cross(v, UP) : cross(v, RIGHT)
	    return Math.abs( v.y ) < 0.99 ? p.set( -v.z, 0, v.x ).normalize() : p.set( 0, v.z, -v.y ).normalize();

	},

	/*genPerpendicularVectorHM: function ( v ) { 

	    let a = v.abs();
	    let b = v.clone();
	    if (a.x <= a.y && a.x <= a.z) return b.set(0, -v.z, v.y).normalize();
	    else if (a.y <= a.x && a.y <= a.z) return b.set(-v.z, 0, v.x).normalize();
	    else return b.set(-v.y, v.x, 0).normalize();

	},*/

	genPerpendicularVectorFrisvad: function ( v ) { 

		let nv = v.clone();
	    if ( v.z < -0.9999999 ) return nv.set(0, -1, 0);// Handle the singularity
	    let a = 1/(1 + v.z);
	    return nv.set( 1 - v.x * v.x * a, - v.x * v.y * a, -v.x ).normalize();

	},

	// rotation

	rotateXDegs: function ( v, angle ) { return v.clone().rotate( angle * math.toRad, 'X' ); },
	rotateYDegs: function ( v, angle ) { return v.clone().rotate( angle * math.toRad, 'Y' ) },
	rotateZDegs: function ( v, angle ) { return v.clone().rotate( angle * math.toRad, 'Z' ) },

	// distance

	withinManhattanDistance: function ( v1, v2, distance ) {

	    if (Math.abs(v2.x - v1.x) > distance) return false; // Too far in x direction
	    if (Math.abs(v2.y - v1.y) > distance) return false; // Too far in y direction
	    if (Math.abs(v2.z - v1.z) > distance) return false; // Too far in z direction   
	    return true;

	},

	manhattanDistanceBetween: function ( v1, v2 ) {

	    return Math.abs(v2.x - v1.x) + Math.abs(v2.x - v1.x) + Math.abs(v2.x - v1.x);

	},

	distanceBetween: function ( v1, v2 ) {

	    let dx = v2.x - v1.x;
	    let dy = v2.y - v1.y;
	    let dz = v1.z !== undefined ? v2.z - v1.z : 0;
	    return Math.sqrt( dx * dx + dy * dy + dz * dz );

	},

	unwrapDeg: ( r ) => (r - (Math.floor((r + 180)/360))*360), 
	unwrapRad: ( r ) => (r - (Math.floor((r + Math.PI)/(2*Math.PI)))*2*Math.PI),


	/*unwrapDeg: function ( r ) {

	    r = r % 360;
	    if (r > 180) r -= 360;
	    if (r < -180) r += 360;
	    return r;

	},

	unwrapRad: function( r ){

	    r = r % math.twoPI;
	    if (r > Math.Pi ) r -= math.twoPI;
	    if (r < - Math.Pi ) r += math.twoPI;
	    return r;

	},*/


	// ______________________________ 2D _____________________________

	rotateDegs: function( v, angle ) {

		return v.clone().rotate( angle * math.toRad )
 
	},


	validateDirectionUV: function( directionUV ) {

		if( directionUV.length() < 0 ) Tools.error("vector direction unit vector cannot be zero.");
 
	},

	validateLength: function( length ) {

		if( length < 0 ) Tools.error("Length must be a greater than or equal to zero.");
 
	},



};

class V2 {

    constructor( x = 0, y = 0 ) {

    	this.isVector2 = true;
	    this.x = x;
	    this.y = y;
	    
	}

	set( x, y ){

	    this.x = x || 0;
	    this.y = y || 0;
	    return this;

	}

	distanceTo( v ) {

		return Math.sqrt( this.distanceToSquared( v ) );

	}

	distanceToSquared( v ) {

		let dx = this.x - v.x, dy = this.y - v.y;
		return dx * dx + dy * dy;

	}

	multiplyScalar( scalar ) {

		this.x *= scalar;
		this.y *= scalar;
		return this;

	}

	divideScalar( scalar ) {

		return this.multiplyScalar( 1 / scalar );

	}

	length() {

		return Math.sqrt( this.x * this.x + this.y * this.y );

	}

	normalize() {

		return this.divideScalar( this.length() || 1 );

	}

	normalised() {

	    return new this.constructor( this.x, this.y ).normalize();
	
	}

	lengthSq() {

		return this.x * this.x + this.y * this.y;

	}

	add( v ) {

		this.x += v.x;
		this.y += v.y;
	    return this;

	}

	plus( v ) {

	    return new this.constructor( this.x + v.x, this.y + v.y );

	}

	min( v ) {

		this.x -= v.x;
		this.y -= v.y;
	    return this;

	}

	minus( v ) {

	    return new V2( this.x - v.x, this.y - v.y );

	}

	divideBy( value ) {

	    return new this.constructor( this.x, this.y ).divideScalar( value );
	
	}

	dot( a, b ) {

		return this.x * a.x + this.y * a.y;

	}

	negate() { 

	    this.x = -this.x;
	    this.y = -this.y;
	    return this;

	}

	negated() { 

	    return new this.constructor( -this.x, -this.y );

	}

	clone (){

	    return new this.constructor( this.x, this.y );

	}

	copy( v ) {

	    this.x = v.x;
	    this.y = v.y;
	    return this;

	}

	cross( v ) {

	    return this.x * v.y - this.y * v.x;

	}

	sign( v ) {

		let s = this.cross( v );
		return s >= 0 ? 1 : -1;

	}

	approximatelyEquals( v, t ) {

	    if ( t < 0 ) return false;
	    let xDiff = Math.abs(this.x - v.x);
	    let yDiff = Math.abs(this.y - v.y);
	    return ( xDiff < t && yDiff < t );

	}

	rotate( angle ) {

		let cos = Math.cos( angle );
		let sin = Math.sin( angle );
		let x = this.x * cos - this.y * sin;
		let y = this.x * sin + this.y * cos;
		this.x = x;
		this.y = y;
		return this;

	}

	angleTo( v ) {

		let a = this.dot(v) / (Math.sqrt( this.lengthSq() * v.lengthSq() ));
		if(a <= -1) return Math.PI;
		if(a >= 1) return 0;
		return Math.acos( a );

	}

	getSignedAngle( v ) {

		let a = this.angleTo( v );
		let s = this.sign( v );
		return s === 1 ? a : -a;
		
	}

	constrainedUV( baselineUV, min, max ) {

        let angle = baselineUV.getSignedAngle( this );
        if( angle > max ) this.copy( baselineUV ).rotate(max);
        if( angle < min ) this.copy( baselineUV ).rotate(min);
        return this;

    }

}

class V3 {

    constructor( x = 0, y = 0, z = 0 ) {

    	this.isVector3 = true;
	    this.x = x;
	    this.y = y;
	    this.z = z;

	}

	set( x, y, z ) {

	    this.x = x || 0;
	    this.y = y || 0;
	    this.z = z || 0;
	    return this;

	}

	distanceTo( v ) {

		return Math.sqrt( this.distanceToSquared( v ) );

	}

	distanceToSquared( v ) {

		let dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;

		return dx * dx + dy * dy + dz * dz;

	}

	abs() {

		return new this.constructor( 
			this.x < 0 ? -this.x : this.x, 
			this.y < 0 ? -this.y : this.y, 
			this.z < 0 ? -this.z : this.z
		);

	}

	dot( v ) {

		return this.x * v.x + this.y * v.y + this.z * v.z;

	}

	length() {

		return Math.sqrt( this.x * this.x + this.y * this.y + this.z * this.z );

	}

	lengthSq() {

		return this.x * this.x + this.y * this.y + this.z * this.z;

	}

	normalize() {

		return this.divideScalar( this.length() || 1 );

	}

	normalised() {

	    return new this.constructor( this.x, this.y, this.z ).normalize();
	
	}

	add( v ) {

		this.x += v.x;
		this.y += v.y;
		this.z += v.z;
	    return this;

	}

	min( v ) {

		this.x -= v.x;
		this.y -= v.y;
		this.z -= v.z;
	    return this;

	}

	plus( v ) {

	    return new this.constructor( this.x + v.x, this.y + v.y, this.z + v.z );

	}

	minus( v ) {

	    return new this.constructor( this.x - v.x, this.y - v.y, this.z - v.z );

	}

	divideBy( s ) {

	    return new this.constructor ( this.x / s, this.y / s, this.z / s );
	
	}

	multiply( s ) {

	    return new this.constructor( this.x * s, this.y * s, this.z * s );

	}
	

	multiplyScalar( scalar ) {

		this.x *= scalar;
		this.y *= scalar;
		this.z *= scalar;
		return this;

	}

	divideScalar( scalar ) {

		return this.multiplyScalar( 1 / scalar );

	}

	cross( v ) { 

	    return new this.constructor( this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x );

	}

	crossVectors( a, b ) {

		let ax = a.x, ay = a.y, az = a.z;
		let bx = b.x, by = b.y, bz = b.z;

		this.x = ay * bz - az * by;
		this.y = az * bx - ax * bz;
		this.z = ax * by - ay * bx;

		return this;

	}

	negate() { 

	    this.x = -this.x;
	    this.y = -this.y;
	    this.z = -this.z;
	    return this;

	}

	negated() { 

	    return new V3( -this.x, -this.y, -this.z );

	}

	clone() {

	    return new V3( this.x, this.y, this.z );

	}

	copy( v ) {

	    this.x = v.x;
	    this.y = v.y;
	    this.z = v.z;
	    return this;

	}

	approximatelyEquals( v, t ) {

	    if ( t < 0 ) return false;
	    let xDiff = Math.abs(this.x - v.x);
	    let yDiff = Math.abs(this.y - v.y);
	    let zDiff = Math.abs(this.z - v.z);
	    return ( xDiff < t && yDiff < t && zDiff < t );

	}

	zero() {

	    this.x = 0;
	    this.y = 0;
	    this.z = 0;
	    return this;

	}

	/*projectOnPlane_old: function ( planeNormal ) {

	    if ( planeNormal.length() <= 0 ){ Tools.error("Plane normal cannot be a zero vector."); return; }
	        
        // Projection of vector b onto plane with normal n is defined as: b - ( b.n / ( |n| squared )) * n
        // Note: |n| is length or magnitude of the vector n, NOT its (component-wise) absolute value        
        let b = this.normalised();
        let n = planeNormal.normalised();   

        return b.min( n.times( _Math.dotProduct( b, planeNormal ) ) ).normalize();

	},*/

	rotate( angle, axe ) {

		let cos = Math.cos( angle );
		let sin = Math.sin( angle );
		let x, y, z;

		switch ( axe ){
			case 'X':
			x = this.x;
			y = this.y * cos - this.z * sin;
			z = this.y * sin + this.z * cos;
			break
			case 'Y':
			x = this.z * sin + this.x * cos;
			y = this.y;
			z = this.z * cos - this.x * sin;
			break
			case 'Z':
			x = this.x * cos - this.y * sin;
			y = this.x * sin + this.y * cos;
			z = this.z;
			break
		}

		this.x = x;
		this.y = y;
		this.z = z;
		return this;

	}

	// added

	projectOnVector( vector ) {

		let scalar = vector.dot( this ) / vector.lengthSq();
		return this.copy( vector ).multiplyScalar( scalar );

	}

	projectOnPlane() {

		let v1 = new this.constructor();

		return function projectOnPlane( planeNormal ) {

			v1.copy( this ).projectOnVector( planeNormal.normalised() );

			return this.min( v1 ).normalize();

		}

	}

	applyM3( m ) {

		let x = this.x, y = this.y, z = this.z;
		let e = m.elements;

		this.x = e[ 0 ] * x + e[ 1 ] * y + e[ 2 ] * z;
		this.y = e[ 3 ] * x + e[ 4 ] * y + e[ 5 ] * z;
		this.z = e[ 6 ] * x + e[ 7 ] * y + e[ 8 ] * z;

		return this.normalize();

	}

	applyMatrix3( m ) {

		let x = this.x, y = this.y, z = this.z;
		let e = m.elements;

		this.x = e[ 0 ] * x + e[ 3 ] * y + e[ 6 ] * z;
		this.y = e[ 1 ] * x + e[ 4 ] * y + e[ 7 ] * z;
		this.z = e[ 2 ] * x + e[ 5 ] * y + e[ 8 ] * z;

		return this;

	}

	applyQuaternion( q ) {

		let x = this.x, y = this.y, z = this.z;
		let qx = q.x, qy = q.y, qz = q.z, qw = q.w;

		// calculate quat * vector

		let ix = qw * x + qy * z - qz * y;
		let iy = qw * y + qz * x - qx * z;
		let iz = qw * z + qx * y - qy * x;
		let iw = - qx * x - qy * y - qz * z;

		// calculate result * inverse quat

		this.x = ix * qw + iw * - qx + iy * - qz - iz * - qy;
		this.y = iy * qw + iw * - qy + iz * - qx - ix * - qz;
		this.z = iz * qw + iw * - qz + ix * - qy - iy * - qx;

		return this;

	}

	/////

	sign( v, normal ) {

		let s = this.cross( v ).dot( normal );
		return s >= 0 ? 1 : -1;

	}

	angleTo( v ) {

		let a = this.dot(v) / Math.sqrt( this.lengthSq() * v.lengthSq() );
		if(a <= -1) return Math.PI;
		if(a >= 1) return 0;
		return Math.acos( a );

	}

	getSignedAngle( v, normal ) {

		let a = this.angleTo( v );
		let s = this.sign( v, normal );
		return s === 1 ? a : -a;
		
	}

	constrainedUV( referenceAxis, rotationAxis, mtx, min, max ) {

        let angle = referenceAxis.getSignedAngle( this, rotationAxis );
        if( angle > max ) this.copy( mtx.rotateAboutAxis( referenceAxis, max, rotationAxis ) );
        if( angle < min ) this.copy( mtx.rotateAboutAxis( referenceAxis, min, rotationAxis ) );
        return this;

    }

    limitAngle( base, mtx, max ) {

        let angle = base.angleTo( this );
        if( angle > max ){ 
        	let correctionAxis = base.normalised().cross(this).normalize();
        	this.copy( mtx.rotateAboutAxis( base, max, correctionAxis ) );
        }
        return this;

    }


}

class M3 {

    constructor() {

		this.isMatrix3 = true;

		this.elements = [

			1, 0, 0,
			0, 1, 0,
			0, 0, 1

		];

		if ( arguments.length > 0 ) {

			console.error( 'M3: the constructor no longer reads arguments. use .set() instead.' );

		}

	}

	set( n11, n12, n13, n21, n22, n23, n31, n32, n33 ) {

		let te = this.elements;

		te[ 0 ] = n11; te[ 1 ] = n21; te[ 2 ] = n31;
		te[ 3 ] = n12; te[ 4 ] = n22; te[ 5 ] = n32;
		te[ 6 ] = n13; te[ 7 ] = n23; te[ 8 ] = n33;

		return this;

	}

	identity() {

		this.set(

			1, 0, 0,
			0, 1, 0,
			0, 0, 1

		);

		return this;

	}

	setV3( xAxis, yAxis, zAxis ) {

		const te = this.elements;

	    te[ 0 ] = xAxis.x;
	    te[ 3 ] = xAxis.y; 
	    te[ 6 ] = xAxis.z;
	        
	    te[ 1 ] = yAxis.x;
	    te[ 4 ] = yAxis.y; 
	    te[ 7 ] = yAxis.z;
	        
	    te[ 2 ] = zAxis.x;
	    te[ 5 ] = zAxis.y; 
	    te[ 8 ] = zAxis.z;

	    return this;

	}

	transpose() {

		let tmp, m = this.elements;

		tmp = m[ 1 ]; m[ 1 ] = m[ 3 ]; m[ 3 ] = tmp;
		tmp = m[ 2 ]; m[ 2 ] = m[ 6 ]; m[ 6 ] = tmp;
		tmp = m[ 5 ]; m[ 5 ] = m[ 7 ]; m[ 7 ] = tmp;

		return this;

	}

	createRotationMatrix( referenceDirection ) {
  
	    /*let zAxis = referenceDirection;//normalised();
	    let xAxis = new V3(1, 0, 0);
	    let yAxis = new V3(0, 1, 0);
	            
	    // Handle the singularity (i.e. bone pointing along negative Z-Axis)...
	    if( referenceDirection.z < -0.9999999 ){
	        xAxis.set(1, 0, 0); // ...in which case positive X runs directly to the right...
	        yAxis.set(0, 1, 0); // ...and positive Y runs directly upwards.
	    } else {
	        let a = 1/(1 + zAxis.z);
	        let b = -zAxis.x * zAxis.y * a;           
	        xAxis.set( 1 - zAxis.x * zAxis.x * a, b, -zAxis.x ).normalize();
	        yAxis.set( b, 1 - zAxis.y * zAxis.y * a, -zAxis.y ).normalize();
	    }

	    return this.setV3( xAxis, yAxis, zAxis );

	    */

	    // NEW VERSION - 1.3.8

		let zAxis = referenceDirection;
	    let xAxis = new V3(1, 0, 0);
	    let yAxis = new V3(0, 1, 0);
		
		// Singularity fix
		if ( Math.abs( referenceDirection.y ) > 0.9999 ){

			
			yAxis.copy( xAxis ).cross( zAxis ).normalize();

		} else {

			xAxis.copy( zAxis ).cross( yAxis ).normalize();
			yAxis.copy( xAxis ).cross( zAxis ).normalize();

		}

	    return this.setV3( xAxis, yAxis, zAxis );

	}

	rotateAboutAxis( v, angle, rotationAxis ){

	    let sinTheta = Math.sin( angle );
	    let cosTheta = Math.cos( angle );
	    let oneMinusCosTheta = 1.0 - cosTheta;
	    
	    // It's quicker to pre-calc these and reuse than calculate x * y, then y * x later (same thing).
	    let xyOne = rotationAxis.x * rotationAxis.y * oneMinusCosTheta;
	    let xzOne = rotationAxis.x * rotationAxis.z * oneMinusCosTheta;
	    let yzOne = rotationAxis.y * rotationAxis.z * oneMinusCosTheta;

	    let te = this.elements;

	    // Calculate rotated x-axis
	    te[ 0 ] = rotationAxis.x * rotationAxis.x * oneMinusCosTheta + cosTheta;
	    te[ 3 ] = xyOne + rotationAxis.z * sinTheta;
	    te[ 6 ] = xzOne - rotationAxis.y * sinTheta;

	    // Calculate rotated y-axis
	    te[ 1 ] = xyOne - rotationAxis.z * sinTheta;
	    te[ 4 ] = rotationAxis.y * rotationAxis.y * oneMinusCosTheta + cosTheta;
	    te[ 7 ] = yzOne + rotationAxis.x * sinTheta;

	    // Calculate rotated z-axis
	    te[ 2 ] = xzOne + rotationAxis.y * sinTheta;
	    te[ 5 ] = yzOne - rotationAxis.x * sinTheta;
	    te[ 8 ] = rotationAxis.z * rotationAxis.z * oneMinusCosTheta + cosTheta;

	    // Multiply the source by the rotation matrix we just created to perform the rotation
	    return v.clone().applyM3( this );

	}

}

/*
 * A list of constants built-in for
 * the Fik engine.
 */

const REVISION = '1.4.0';

const PRECISION = 0.001;
const PRECISION_DEG = 0.01;
const MAX_VALUE = Infinity;

// chain Basebone Constraint Type

const NONE = 1; // No constraint
// 3D
const GLOBAL_ROTOR = 2;// World-space rotor constraint
const GLOBAL_HINGE = 3;// World-space hinge constraint
const LOCAL_ROTOR = 4;// Rotor constraint in the coordinate space of (i.e. relative to) the direction of the connected bone
const LOCAL_HINGE = 5;// Hinge constraint in the coordinate space of (i.e. relative to) the direction of the connected bone

// 2D
const GLOBAL_ABSOLUTE = 6; // Constrained about a world-space direction
const LOCAL_RELATIVE = 7; // Constrained about the direction of the connected bone
const LOCAL_ABSOLUTE = 8; // Constrained about a direction with relative to the direction of the connected bone

// joint Type
const J_BALL = 10;
const J_LOCAL = 11;
const J_GLOBAL = 12;

const START = 20;
const END = 21;

// Define world-space axis

const X_AXE = new V3( 1, 0, 0 );
const Y_AXE = new V3( 0, 1, 0 );
const Z_AXE = new V3( 0, 0, 1 );

const X_NEG = new V3( -1, 0, 0 );
const Y_NEG = new V3( 0, -1, 0 );
const Z_NEG = new V3( 0, 0, -1 );

// Define world-space 2D cardinal axes

const UP = new V2( 0, 1 );
const DOWN = new V2( 0, -1 );
const LEFT = new V2( -1, 0 );
const RIGHT = new V2( 1, 0 );

class Joint3D {

    constructor() {

        this.isJoint3D = true;

        this.rotor = math.PI;
        this.min = -math.PI;
        this.max = math.PI;

        this.freeHinge = true;

        this.rotationAxisUV = new V3();
        this.referenceAxisUV = new V3();
        this.type = J_BALL;

    }

    clone() {

        let j = new this.constructor();
        j.type = this.type;
        j.rotor = this.rotor;
        j.max = this.max;
        j.min = this.min;
        j.freeHinge = this.freeHinge;
        j.rotationAxisUV.copy( this.rotationAxisUV );
        j.referenceAxisUV.copy( this.referenceAxisUV );

        return j

    }

    testAngle() {

        if( this.max === math.PI && this.min === -math.PI ) this.freeHinge = true;
        else this.freeHinge = false;

    }

    validateAngle( a ) {

        a = a < 0 ? 0 : a;
        a = a > 180 ? 180 : a;
        return a;

    }

    setAsBallJoint( angle ) {

        this.rotor = this.validateAngle( angle ) * math.toRad;
        this.type = J_BALL;
        
    }

    // Specify this joint to be a hinge with the provided settings

    setHinge( type, rotationAxis, clockwise, anticlockwise, referenceAxis ) {

        this.type = type;
        if( clockwise < 0 ) clockwise *= -1;
        this.min = -this.validateAngle( clockwise ) * math.toRad;
        this.max = this.validateAngle( anticlockwise ) * math.toRad;

        this.testAngle();

        this.rotationAxisUV.copy( rotationAxis ).normalize();
        this.referenceAxisUV.copy( referenceAxis ).normalize();

    }

    // GET

    getHingeReferenceAxis() {

        return this.referenceAxisUV; 

    }

    getHingeRotationAxis() {

        return this.rotationAxisUV; 

    }

    // SET

    setBallJointConstraintDegs( angle ) {

        this.rotor = this.validateAngle( angle ) * math.toRad;

    }

    setHingeClockwise( angle ) {

        if( angle < 0 ) angle *= -1;
        this.min = -this.validateAngle( angle ) * math.toRad;
        this.testAngle();

    }

    setHingeAnticlockwise( angle ) {

        this.max = this.validateAngle( angle ) * math.toRad;
        this.testAngle();

    }

    /*setHingeRotationAxis: function ( axis ) {

        this.rotationAxisUV.copy( axis ).normalize();

    },

    setHingeReferenceAxis: function ( referenceAxis ) {

        this.referenceAxisUV.copy( referenceAxis ).normalize(); 

    },*/

    
    
}

class Bone3D {

    constructor( startLocation, endLocation, directionUV, length, color ) {

        this.isBone3D = true;

        this.joint = new Joint3D();
        this.start = new V3();
        this.end = new V3();
        
        this.boneConnectionPoint = END;
        this.length = 0;

        this.color = color || 0xFFFFFF;
        this.name = '';

        this.init( startLocation, endLocation, directionUV, length );

    }

    init( startLocation, endLocation, directionUV, length ){

        this.setStartLocation( startLocation );
        if( endLocation ){ 
            this.setEndLocation( endLocation );
            this.length = this.getLength();

        } else {
            this.setLength( length );
            this.setEndLocation( this.start.plus( directionUV.normalised().multiplyScalar( length ) ) );
        }

    }

    clone() {

        let b = new this.constructor( this.start, this.end );
        b.joint = this.joint.clone();
        return b;

    }

    // SET

    setColor( c ) {

        this.color = c;

    }

    setBoneConnectionPoint( bcp ) {

        this.boneConnectionPoint = bcp;

    }

    setHingeClockwise( angle ) {


        this.joint.setHingeClockwise( angle );

    }

    setHingeAnticlockwise( angle ) {

        this.joint.setHingeAnticlockwise( angle );

    }

    setBallJointConstraintDegs( angle ) {

        this.joint.setBallJointConstraintDegs( angle );

    }

    setStartLocation( location ) {

        this.start.copy ( location );

    }

    setEndLocation( location ) {

        this.end.copy ( location );

    }

    setLength( lng ) {

        if ( lng > 0 ) this.length = lng;

    }

    setJoint( joint ) {

        this.joint = joint;

    }


    // GET

    getBoneConnectionPoint() {

        return this.boneConnectionPoint;

    }

    getDirectionUV () {

        return this.end.minus( this.start ).normalize();

    }

    getLength(){

        return this.start.distanceTo( this.end );

    }

}

class Chain3D {

    constructor( color ) {

        this.isChain3D = true;

        this.tmpTarget = new V3();
        this.tmpMtx = new M3();

        this.bones = [];
        this.name = '';
        this.color = color || 0xFFFFFF;

        this.solveDistanceThreshold = 1.0;
        this.minIterationChange = 0.01;
        this.maxIteration = 20;
        this.precision = 0.001;

        this.chainLength = 0;
        this.numBones = 0;

        this.baseLocation = new V3();
        this.fixedBaseMode = true;

        this.baseboneConstraintType = NONE;

        this.baseboneConstraintUV = new V3();
        this.baseboneRelativeConstraintUV = new V3();
        this.baseboneRelativeReferenceConstraintUV = new V3();
        this.lastTargetLocation = new V3( MAX_VALUE, MAX_VALUE, MAX_VALUE );

        this.lastBaseLocation =  new V3( MAX_VALUE, MAX_VALUE, MAX_VALUE );
        this.currentSolveDistance = MAX_VALUE;

        this.connectedChainNumber = -1;
        this.connectedBoneNumber = -1;
        this.boneConnectionPoint = END;

        // test full restrict angle 
        this.isFullForward = false;

        

        this.embeddedTarget = new V3();
        this.useEmbeddedTarget = false;

    }

    clone() {

        let c = new this.constructor();

        c.solveDistanceThreshold = this.solveDistanceThreshold;
        c.minIterationChange = this.minIterationChange;
        c.maxIteration = this.maxIteration;
        c.precision = this.precision;

        c.bones = this.cloneBones();
        c.baseLocation.copy( this.baseLocation );
        c.lastTargetLocation.copy( this.lastTargetLocation );
        c.lastBaseLocation.copy( this.lastBaseLocation );
                
        // Copy the basebone constraint UV if there is one to copy
        if ( !(this.baseboneConstraintType === NONE) ){
            c.baseboneConstraintUV.copy( this.baseboneConstraintUV );
            c.baseboneRelativeConstraintUV.copy( this.baseboneRelativeConstraintUV );
        }       
        
        // Native copy by value for primitive members
        c.fixedBaseMode          = this.fixedBaseMode;
        
        c.chainLength            = this.chainLength;
        c.numBones               = this.numBones;
        c.currentSolveDistance   = this.currentSolveDistance;

        c.boneConnectionPoint    = this.boneConnectionPoint;
        c.connectedChainNumber   = this.connectedChainNumber;
        c.connectedBoneNumber    = this.connectedBoneNumber;
        c.baseboneConstraintType = this.baseboneConstraintType;

        c.color = this.color;

        c.embeddedTarget = this.embeddedTarget.clone();
        c.useEmbeddedTarget = this.useEmbeddedTarget;

        return c;

    }

    clear() {

        let i = this.numBones;
        while(i--) this.removeBone(i);
        this.numBones = 0;

    }

    addBone( bone ) {

        bone.setColor( this.color );

        // Add the new bone to the end of the ArrayList of bones
        this.bones.push( bone );
        // Increment the number of bones in the chain and update the chain length
        this.numBones ++;

        // If this is the basebone...
        if ( this.numBones === 1 ){
            // ...then keep a copy of the fixed start location...
            this.baseLocation.copy( bone.start );
            
            // ...and set the basebone constraint UV to be around the initial bone direction
            this.baseboneConstraintUV.copy( bone.getDirectionUV() );
        }
        
        // Increment the number of bones in the chain and update the chain length
        this.updateChainLength();

    }

    removeBone( id ) {

        if ( id < this.numBones ){   
            // ...then remove the bone, decrease the bone count and update the chain length.
            this.bones.splice(id, 1);
            this.numBones --;
            this.updateChainLength();

        }

    }

    addConsecutiveBone( directionUV, length ) {

         if (this.numBones > 0) {               
            // Get the end location of the last bone, which will be used as the start location of the new bone
            // Add a bone to the end of this IK chain
            // Note: We use a normalised version of the bone direction
            this.addBone( new Bone3D(  this.bones[ this.numBones-1 ].end, undefined, directionUV.normalised(), length ) );
        }

    }

    addConsecutiveFreelyRotatingHingedBone( directionUV, length, type, hingeRotationAxis ) {

        this.addConsecutiveHingedBone( directionUV, length, type, hingeRotationAxis, 180, 180, math.genPerpendicularVectorQuick( hingeRotationAxis ) );

    }

    addConsecutiveHingedBone( DirectionUV, length, type, HingeRotationAxis, clockwiseDegs, anticlockwiseDegs, hingeReferenceAxis ) {

        // Cannot add a consectuive bone of any kind if the there is no basebone
        if ( this.numBones === 0 ) return;

        // Normalise the direction and hinge rotation axis 
        let directionUV = DirectionUV.normalised();
        let hingeRotationAxis = HingeRotationAxis.normalised();
            
        // Create a bone, get the end location of the last bone, which will be used as the start location of the new bone
        let bone = new Bone3D( this.bones[ this.numBones-1 ].end, undefined, directionUV, length, this.color );

        type = type || 'global';

        // ...set up a joint which we'll apply to that bone.
        bone.joint.setHinge( type === 'global' ? J_GLOBAL : J_LOCAL, hingeRotationAxis, clockwiseDegs, anticlockwiseDegs, hingeReferenceAxis );
        
        // Finally, add the bone to this chain
        this.addBone( bone );

    }

    addConsecutiveRotorConstrainedBone( boneDirectionUV, length, constraintAngleDegs ) {

        if (this.numBones === 0) return;

        // Create the bone starting at the end of the previous bone, set its direction, constraint angle and colour
        // then add it to the chain. Note: The default joint type of a new Bone is J_BALL.
        boneDirectionUV = boneDirectionUV.normalised();
        let bone = new Bone3D( this.bones[ this.numBones-1 ].end, undefined , boneDirectionUV, length );
        bone.joint.setAsBallJoint( constraintAngleDegs );
        this.addBone( bone );

    }

    // -------------------------------
    //      GET
    // -------------------------------

    getBoneConnectionPoint() {

        return this.boneConnectionPoint;

    }

    getConnectedBoneNumber(){

        return this.connectedBoneNumber;

    }

    getConnectedChainNumber(){

        return this.connectedChainNumber;

    }

    getBaseboneConstraintType(){

        return this.baseboneConstraintType;

    }

    getBaseboneConstraintUV(){

        if ( !(this.baseboneConstraintType === NONE) ) return this.baseboneConstraintUV;

    }

    getBaseLocation() {

        return this.bones[0].start;

    }

    getEffectorLocation() {

        return this.bones[this.numBones-1].end;

    }

    getLastTargetLocation() {

        return this.lastTargetLocation;

    }

    getLiveChainLength() {

        let lng = 0;
        let i = this.numBones;
        while( i-- ) lng += this.bones[i].getLength();
        return lng;

    }


    getBaseboneRelativeReferenceConstraintUV() {

        return this.baseboneRelativeReferenceConstraintUV;

    }

    // -------------------------------
    //      SET
    // -------------------------------

    setConnectedBoneNumber( boneNumber ) {

        this.connectedBoneNumber = boneNumber;

    }

    setConnectedChainNumber( chainNumber ) {

        this.connectedChainNumber = chainNumber;

    }

    setBoneConnectionPoint( point ) {

        this.boneConnectionPoint = point;

    }

    setColor( c ) {

        this.color = c;
        let i = this.numBones;
        while( i-- ) this.bones[i].setColor( this.color );
        
    }

    setBaseboneRelativeConstraintUV( uv ) { 

        this.baseboneRelativeConstraintUV = uv.normalised(); 

    }

    setBaseboneRelativeReferenceConstraintUV( uv ) { 

        this.baseboneRelativeReferenceConstraintUV = uv.normalised(); 

    }

    setBaseboneConstraintUV( uv ) {

        this.baseboneConstraintUV = uv.normalised(); 

    }

    setRotorBaseboneConstraint( type, constraintAxis, angleDegs ) {

        // Sanity checking
        if (this.numBones === 0){ Tools.error("Chain must contain a basebone before we can specify the basebone constraint type."); return; }     
        if ( !(constraintAxis.length() > 0) ){ Tools.error("Constraint axis cannot be zero."); return;}

        type = type || 'global';       
        // Set the constraint type, axis and angle
        this.baseboneConstraintType = type === 'global' ? GLOBAL_ROTOR : LOCAL_ROTOR;
        this.baseboneConstraintUV = constraintAxis.normalised();
        this.baseboneRelativeConstraintUV.copy( this.baseboneConstraintUV );
        this.bones[0].joint.setAsBallJoint( angleDegs );

    }

    setHingeBaseboneConstraint( type, hingeRotationAxis, cwDegs, acwDegs, hingeReferenceAxis ) {

        // Sanity checking
        if ( this.numBones === 0){ Tools.error("Chain must contain a basebone before we can specify the basebone constraint type."); return; }   
        if ( hingeRotationAxis.length() <= 0 ){ Tools.error("Hinge rotation axis cannot be zero."); return;  }          
        if ( hingeReferenceAxis.length() <= 0 ){ Tools.error("Hinge reference axis cannot be zero."); return; }     
        if ( !( math.perpendicular( hingeRotationAxis, hingeReferenceAxis ) ) ){ Tools.error("The hinge reference axis must be in the plane of the hinge rotation axis, that is, they must be perpendicular."); return; }
        
        type = type || 'global';

        // Set the constraint type, axis and angle
        this.baseboneConstraintType = type === 'global' ? GLOBAL_HINGE : LOCAL_HINGE;
        this.baseboneConstraintUV = hingeRotationAxis.normalised();
        this.bones[0].joint.setHinge( type === 'global' ? J_GLOBAL : J_LOCAL, hingeRotationAxis, cwDegs, acwDegs, hingeReferenceAxis );

    }

    setFreelyRotatingGlobalHingedBasebone( hingeRotationAxis ) {

        this.setHingeBaseboneConstraint( 'global', hingeRotationAxis, 180, 180, math.genPerpendicularVectorQuick( hingeRotationAxis ) );
    }

    setGlobalHingedBasebone( hingeRotationAxis, cwDegs, acwDegs, hingeReferenceAxis ) {

        this.setHingeBaseboneConstraint( 'global', hingeRotationAxis, cwDegs, acwDegs, hingeReferenceAxis );

    }

    setFreelyRotatingLocalHingedBasebone( hingeRotationAxis ) {

        this.setHingeBaseboneConstraint( 'local', hingeRotationAxis, 180, 180, math.genPerpendicularVectorQuick( hingeRotationAxis ) );

    }

    setLocalHingedBasebone( hingeRotationAxis, cwDegs, acwDegs, hingeReferenceAxis ) {

        this.setHingeBaseboneConstraint( 'local', hingeRotationAxis, cwDegs, acwDegs, hingeReferenceAxis );

    }

    setBaseLocation( baseLocation ) {

        this.baseLocation.copy( baseLocation );

    }
    
    setFixedBaseMode( value ){

        // Enforce that a chain connected to another chain stays in fixed base mode (i.e. it moves with the chain it's connected to instead of independently)
        if ( !value && this.connectedChainNumber !== -1) return;
        if ( this.baseboneConstraintType === GLOBAL_ROTOR && !value ) return;
        // Above conditions met? Set the fixedBaseMode
        this.fixedBaseMode = value;

    }

    setMaxIterationAttempts( maxIterations ) {

        if (maxIterations < 1) return;
        this.maxIteration = maxIterations;

    }

    setMinIterationChange( minIterationChange ) {

        if (minIterationChange < 0) return;
        this.minIterationChange = minIterationChange;

    }

    setSolveDistanceThreshold( solveDistance ) {

        if (solveDistance < 0) return;
        this.solveDistanceThreshold = solveDistance;

    }

    // -------------------------------
    //
    //      UPDATE TARGET
    //
    // -------------------------------

    solveForEmbeddedTarget() {

        if ( this.useEmbeddedTarget ) return this.solveForTarget( this.embeddedTarget );

    }

    resetTarget() {

        this.lastBaseLocation = new V3( MAX_VALUE, MAX_VALUE, MAX_VALUE );
        this.currentSolveDistance = MAX_VALUE;

    }


    // Method to solve this IK chain for the given target location.
    // The end result of running this method is that the IK chain configuration is updated.

    // To minimuse CPU usage, this method dynamically aborts if:
    // - The solve distance (i.e. distance between the end effector and the target) is below the solveDistanceThreshold,
    // - A solution incrementally improves on the previous solution by less than the minIterationChange, or
    // - The number of attempts to solve the IK chain exceeds the maxIteration.

    solveForTarget( t ) {

        this.tmpTarget.set( t.x, t.y, t.z );
        let p = this.precision;

        let isSameBaseLocation = this.lastBaseLocation.approximatelyEquals( this.baseLocation, p );

        // If we have both the same target and base location as the last run then do not solve
        if ( this.lastTargetLocation.approximatelyEquals( this.tmpTarget, p ) && isSameBaseLocation ) return this.currentSolveDistance;

        // Keep starting solutions and distance
        let startingDistance;
        let startingSolution = null;

        // If the base location of a chain hasn't moved then we may opt to keep the current solution if our 
        // best new solution is worse...
        if ( isSameBaseLocation ) {
            startingDistance = this.bones[ this.numBones-1 ].end.distanceTo( this.tmpTarget );
            startingSolution = this.cloneBones();
        } else {
            // Base has changed? Then we have little choice but to recalc the solution and take that new solution.
            startingDistance = MAX_VALUE;
        }
        
        /*
         * NOTE: We must allow the best solution of THIS run to be used for a new target or base location - we cannot
         * just use the last solution (even if it's better) - because that solution was for a different target / base
         * location combination and NOT for the current setup.
         */
                        
        // Not the same target? Then we must solve the chain for the new target.
        // We'll start by creating a list of bones to store our best solution
        let bestSolution = [];
        
        // We'll keep track of our best solve distance, starting it at a huge value which will be beaten on first attempt
        let bestSolveDistance = MAX_VALUE;
        let lastPassSolveDistance = MAX_VALUE;
        
        // Allow up to our iteration limit attempts at solving the chain
        let solveDistance;

        let i = this.maxIteration;

        while( i-- ){   

            // Solve the chain for this target
            solveDistance = this.solveIK( this.tmpTarget );
            
            // Did we solve it for distance? If so, update our best distance and best solution, and also
            // update our last pass solve distance. Note: We will ALWAYS beat our last solve distance on the first run. 
            if ( solveDistance < bestSolveDistance ) {   

                bestSolveDistance = solveDistance;
                bestSolution = this.cloneBones();
                
                // If we are happy that this solution meets our distance requirements then we can exit the loop now
                if ( solveDistance <= this.solveDistanceThreshold ) break;
                
            } else {// Did not solve to our satisfaction? Okay...
            
                // Did we grind to a halt? If so break out of loop to set the best distance and solution that we have
                if ( Math.abs( solveDistance - lastPassSolveDistance ) < this.minIterationChange )  break; 

            }
            
            // Update the last pass solve distance
            lastPassSolveDistance = solveDistance;
            
        } // End of loop

        // Did we get a solution that's better than the starting solution's to the new target location?
        if ( bestSolveDistance < startingDistance ){
            // If so, set the newly found solve distance and solution as the best found.
            this.currentSolveDistance = bestSolveDistance;
            this.bones = bestSolution;
        } else {
            // Did we make things worse? Then we keep our starting distance and solution!
            this.currentSolveDistance = startingDistance;
            this.bones = startingSolution; 
        }
        
        // Update our base and target locations
        this.lastBaseLocation.copy( this.baseLocation );
        this.lastTargetLocation.copy( this.tmpTarget );
        
        return this.currentSolveDistance;
        
    }

    // -------------------------------
    //
    //      SOLVE IK
    //
    // -------------------------------

    // Solve the IK chain for the given target using the FABRIK algorithm.
    // retun the best solve distance found between the end-effector of this chain and the provided target.

    solveIK( target ) {

        if ( this.numBones === 0 ) return;

        let bone, boneLength, joint, jointType, nextBone;
        let hingeRotationAxis, hingeReferenceAxis;
        let tmpMtx = this.tmpMtx;
        
        // ---------- Forward pass from end effector to base -----------

        // Loop over all bones in the chain, from the end effector (numBones-1) back to the basebone (0) 
        let i = this.numBones;

        while( i-- ){


            // Get the length of the bone we're working on
            bone = this.bones[i];
            boneLength  = bone.length;
            joint = bone.joint;
            jointType = joint.type;

            // If we are NOT working on the end effector bone
            if ( i !== this.numBones - 1 ) {

                nextBone = this.bones[i+1];

                // Get the outer-to-inner unit vector of the bone further out
                let outerBoneOuterToInnerUV = nextBone.getDirectionUV().negate();

                // Get the outer-to-inner unit vector of this bone
                let boneOuterToInnerUV = bone.getDirectionUV().negate();

                // Get the joint type for this bone and handle constraints on boneInnerToOuterUV

                /*if( this.isFullForward ){

                    switch ( jointType ) {
                        case J_BALL:
                            // Constrain to relative angle between this bone and the next bone if required
                            boneOuterToInnerUV.limitAngle( outerBoneOuterToInnerUV, tmpMtx, nextBone.joint.rotor );
                        break;                      
                        case J_GLOBAL:

                            hingeRotationAxis = nextBone.joint.getHingeRotationAxis().negated();
                            hingeReferenceAxis = nextBone.joint.getHingeReferenceAxis().negated();
                            
                            // Project this bone outer-to-inner direction onto the hinge rotation axis
                            boneOuterToInnerUV.projectOnPlane( hingeRotationAxis ); 

                            // NOTE: Constraining about the hinge reference axis on this forward pass leads to poor solutions... so we won't.
                            if( !nextBone.joint.freeHinge ) boneOuterToInnerUV.constrainedUV( hingeReferenceAxis, hingeRotationAxis, tmpMtx,  nextBone.joint.min,  nextBone.joint.max );

                            
                        break;
                        case J_LOCAL:
                            

                            if ( i > 0 ) {// Not a basebone? Then construct a rotation matrix based on the previous bones inner-to-to-inner direction...
                                // ...and transform the hinge rotation axis into the previous bones frame of reference.

                                tmpMtx.createRotationMatrix( outerBoneOuterToInnerUV );
                                hingeRotationAxis = nextBone.joint.getHingeRotationAxis().clone().negate().applyM3( tmpMtx );
                                hingeReferenceAxis = nextBone.joint.getHingeReferenceAxis().clone().negate().applyM3( tmpMtx );



                            } else {// ...basebone? Need to construct matrix from the relative constraint UV.

                                hingeRotationAxis = this.baseboneRelativeConstraintUV.negated();
                                hingeReferenceAxis = this.baseboneRelativeReferenceConstraintUV.negated();

                            }

                            // Project this bone's outer-to-inner direction onto the plane described by the relative hinge rotation axis
                            boneOuterToInnerUV.projectOnPlane( hingeRotationAxis );

                            // NOTE: Constraining about the hinge reference axis on this forward pass leads to poor solutions... so we won't.  
                            if( !nextBone.joint.freeHinge ){

                                boneOuterToInnerUV.constrainedUV( hingeReferenceAxis, hingeRotationAxis, tmpMtx, nextBone.joint.min, nextBone.joint.max );

                            }
                        break;
                    }
                } else {*/

                    switch ( jointType ) {
                        case J_BALL:
                            // Constrain to relative angle between this bone and the next bone if required
                            boneOuterToInnerUV.limitAngle( outerBoneOuterToInnerUV, tmpMtx, joint.rotor );
                        break;                      
                        case J_GLOBAL:

                            hingeRotationAxis = joint.getHingeRotationAxis();
                            
                            // Project this bone outer-to-inner direction onto the hinge rotation axis
                            boneOuterToInnerUV.projectOnPlane( hingeRotationAxis ); 

                            // NOTE: Constraining about the hinge reference axis on this forward pass leads to poor solutions... so we won't.
                        break;
                        case J_LOCAL:
                            

                            if ( i > 0 ) {// Not a basebone? Then construct a rotation matrix based on the previous bones inner-to-to-inner direction...
                                // ...and transform the hinge rotation axis into the previous bones frame of reference.

                                tmpMtx.createRotationMatrix( this.bones[i-1].getDirectionUV() );
                                hingeRotationAxis = joint.getHingeRotationAxis().clone().applyM3( tmpMtx );

                            } else {// ...basebone? Need to construct matrix from the relative constraint UV.

                                hingeRotationAxis = this.baseboneRelativeConstraintUV;

                            }

                            // Project this bone's outer-to-inner direction onto the plane described by the relative hinge rotation axis
                            boneOuterToInnerUV.projectOnPlane( hingeRotationAxis );

                            // NOTE: Constraining about the hinge reference axis on this forward pass leads to poor solutions... so we won't.
                        break;
                    }
                //}
                    
                // At this stage we have a outer-to-inner unit vector for this bone which is within our constraints,
                // so we can set the new inner joint location to be the end joint location of this bone plus the
                // outer-to-inner direction unit vector multiplied by the length of the bone.
                let newStartLocation = bone.end.plus( boneOuterToInnerUV.multiplyScalar( boneLength ) );

                // Set the new start joint location for this bone
                bone.setStartLocation( newStartLocation );

                // If we are not working on the basebone, then we also set the end joint location of
                // the previous bone in the chain (i.e. the bone closer to the base) to be the new
                // start joint location of this bone.
                if (i > 0) this.bones[i-1].setEndLocation( newStartLocation );
                
            } else { // If we ARE working on the end effector bone...
            
                // Snap the end effector's end location to the target
                bone.setEndLocation( target );
                
                // Get the UV between the target / end-location (which are now the same) and the start location of this bone
                let boneOuterToInnerUV = bone.getDirectionUV().negated();
                
                // If the end effector is global hinged then we have to snap to it, then keep that
                // resulting outer-to-inner UV in the plane of the hinge rotation axis
                switch ( jointType ) {
                    case J_BALL:
                        // Ball joints do not get constrained on this forward pass
                    break;                      
                    case J_GLOBAL:
                        hingeRotationAxis = joint.getHingeRotationAxis();
                        // Global hinges get constrained to the hinge rotation axis, but not the reference axis within the hinge plane
                        boneOuterToInnerUV.projectOnPlane( hingeRotationAxis );
                    break;
                    case J_LOCAL:
                        // Local hinges get constrained to the hinge rotation axis, but not the reference axis within the hinge plane
                        
                        // Construct a rotation matrix based on the previous bones inner-to-to-inner direction...
                        tmpMtx.createRotationMatrix( this.bones[i-1].getDirectionUV() );
                        
                        // ...and transform the hinge rotation axis into the previous bones frame of reference.
                        hingeRotationAxis = joint.getHingeRotationAxis().clone().applyM3( tmpMtx );
                                            
                        // Project this bone's outer-to-inner direction onto the plane described by the relative hinge rotation axis
                        boneOuterToInnerUV.projectOnPlane( hingeRotationAxis );
                    break;
                }
                                                
                // Calculate the new start joint location as the end joint location plus the outer-to-inner direction UV
                // multiplied by the length of the bone.
                let newStartLocation = target.plus( boneOuterToInnerUV.multiplyScalar( boneLength ) );
                
                // Set the new start joint location for this bone to be new start location...
                bone.setStartLocation( newStartLocation );

                // ...and set the end joint location of the bone further in to also be at the new start location (if there IS a bone
                // further in - this may be a single bone chain)
                if (i > 0) this.bones[i-1].setEndLocation( newStartLocation );
                
            }
            
        } // End of forward pass

        // ---------- Backward pass from base to end effector -----------
 
        for ( i = 0; i < this.numBones; i++ ){

            bone = this.bones[i];
            boneLength  = bone.length;
            joint = bone.joint;
            jointType = joint.type;

            // If we are not working on the basebone
            if ( i !== 0 ){

                // Get the inner-to-outer direction of this bone as well as the previous bone to use as a baseline
                let boneInnerToOuterUV = bone.getDirectionUV();

                let prevBoneInnerToOuterUV = this.bones[i-1].getDirectionUV();

                //let hingeRotationAxis, hingeReferenceAxis;

                switch ( jointType ) {

                    case J_BALL:

                        // Keep this bone direction constrained within the rotor about the previous bone direction
                        boneInnerToOuterUV.limitAngle( prevBoneInnerToOuterUV, tmpMtx, joint.rotor );

                    break;    
                    case J_GLOBAL:

                        // Get the hinge rotation axis and project our inner-to-outer UV onto it
                        hingeRotationAxis  = joint.getHingeRotationAxis();
                        hingeReferenceAxis = joint.getHingeReferenceAxis();

                        boneInnerToOuterUV.projectOnPlane( hingeRotationAxis );

                        // Constrain rotation about reference axis if required
                        if( !joint.freeHinge ) boneInnerToOuterUV.constrainedUV( hingeReferenceAxis, hingeRotationAxis, tmpMtx, joint.min, joint.max );

                    break;
                    case J_LOCAL:

                        // Transform the hinge rotation axis to be relative to the previous bone in the chain
                        // Construct a rotation matrix based on the previous bone's direction
                        tmpMtx.createRotationMatrix( prevBoneInnerToOuterUV );
                        
                        // Transform the hinge rotation axis into the previous bone's frame of reference
                        hingeRotationAxis  = joint.getHingeRotationAxis().clone().applyM3( tmpMtx );
                        hingeReferenceAxis = joint.getHingeReferenceAxis().clone().applyM3( tmpMtx );

                        
                        // Project this bone direction onto the plane described by the hinge rotation axis
                        // Note: The returned vector is normalised.
                        boneInnerToOuterUV.projectOnPlane( hingeRotationAxis );

                        // Constrain rotation about reference axis if required
                        if( !joint.freeHinge ) boneInnerToOuterUV.constrainedUV( hingeReferenceAxis, hingeRotationAxis, tmpMtx, joint.min, joint.max );

                    break;

                }
                
                // At this stage we have a outer-to-inner unit vector for this bone which is within our constraints,
                // so we can set the new inner joint location to be the end joint location of this bone plus the
                // outer-to-inner direction unit vector multiplied by the length of the bone.
                let newEndLocation = bone.start.plus( boneInnerToOuterUV.multiplyScalar( boneLength ) );

                // Set the new start joint location for this bone
                bone.setEndLocation( newEndLocation );

                // If we are not working on the end effector bone, then we set the start joint location of the next bone in
                // the chain (i.e. the bone closer to the target) to be the new end joint location of this bone.
                if (i < (this.numBones - 1)) { this.bones[i+1].setStartLocation( newEndLocation ); }

            } else { // If we ARE working on the basebone...
               
                // If the base location is fixed then snap the start location of the basebone back to the fixed base...
                if ( this.fixedBaseMode ){

                    bone.setStartLocation( this.baseLocation );

                } else { // ...otherwise project it backwards from the end to the start by its length.
                
                    bone.setStartLocation( bone.end.minus( bone.getDirectionUV().multiplyScalar( boneLength ) ) );

                }

                // Get the inner-to-outer direction of this bone
                let boneInnerToOuterUV = bone.getDirectionUV();

                let hingeRotationAxis, hingeReferenceAxis;

                switch ( this.baseboneConstraintType ){

                    case NONE:  // Nothing to do because there's no basebone constraint
                    break; 
                    case GLOBAL_ROTOR: 

                        boneInnerToOuterUV.limitAngle( this.baseboneConstraintUV, tmpMtx, joint.rotor );

                    break;
                    case LOCAL_ROTOR:

                        boneInnerToOuterUV.limitAngle( this.baseboneRelativeConstraintUV, tmpMtx, joint.rotor );

                    break;
                    case GLOBAL_HINGE:

                        hingeRotationAxis  = joint.getHingeRotationAxis();
                        hingeReferenceAxis = joint.getHingeReferenceAxis();

                        // Get the inner-to-outer direction of this bone and project it onto the global hinge rotation axis
                        boneInnerToOuterUV.projectOnPlane( hingeRotationAxis );

                        // Constrain as necessary
                        if( !joint.freeHinge ) boneInnerToOuterUV.constrainedUV( hingeReferenceAxis, hingeRotationAxis, tmpMtx, joint.min, joint.max );
                        
                    break;
                    case LOCAL_HINGE:

                        hingeRotationAxis  = this.baseboneRelativeConstraintUV;
                        hingeReferenceAxis = this.baseboneRelativeReferenceConstraintUV;

                        // Get the inner-to-outer direction of this bone and project it onto the global hinge rotation axis
                        //let boneInnerToOuterUV = bone.getDirectionUV();
                        boneInnerToOuterUV.projectOnPlane( hingeRotationAxis );

                        // Constrain as necessary
                        if( !joint.freeHinge ) boneInnerToOuterUV.constrainedUV( hingeReferenceAxis, hingeRotationAxis, tmpMtx, joint.min, joint.max );

                    break;

                }


                // Set the new end location of this bone, and if there are more bones,
                // then set the start location of the next bone to be the end location of this bone
                let newEndLocation = bone.start.plus( boneInnerToOuterUV.multiplyScalar( boneLength ) );
                bone.setEndLocation( newEndLocation );    
                
                if ( this.numBones > 1 ) { this.bones[1].setStartLocation( newEndLocation ); }

            } // End of basebone handling section

        } // End of backward-pass i over all bones

        // Update our last target location
        this.lastTargetLocation.copy( target );
                
        // DEBUG - check the live chain length and the originally calculated chain length are the same
        // if (Math.abs( this.getLiveChainLength() - chainLength) > 0.01) Tools.error(""Chain length off by > 0.01");
  
        // Finally, calculate and return the distance between the current effector location and the target.
        //return math.distanceBetween( this.bones[this.numBones-1].end, target );
        return this.bones[this.numBones-1].end.distanceTo( target );

    }

    updateChainLength() {

        // Loop over all the bones in the chain, adding the length of each bone to the chainLength property
        this.chainLength = 0;
        let i = this.numBones;
        while(i--) this.chainLength += this.bones[i].length;

    }

    cloneBones() {

        // Use clone to create a new Bone with the values from the source Bone.
        let chain = [];
        for ( let i = 0, n = this.bones.length; i < n; i++ ) chain.push( this.bones[i].clone() );
        return chain;

    }

}

//import * as THREE from 'three'

class Structure3D {

    constructor( scene, THREE ) {

        this.THREE = THREE;

        this.isStructure3D = true;

        this.fixedBaseMode = true;

        this.chains = [];
        this.meshChains = [];
        this.targets = [];
        this.numChains = 0;

        this.scene = scene || null;

        this.tmpMtx = new M3();

        this.isWithMesh = false;

    }

    update() {

        let chain, mesh, bone, target;
        let hostChainNumber;
        let hostBone, constraintType;

        //let i =  this.numChains;

        //while(i--){

        for( let i = 0; i < this.numChains; i++ ){

            chain = this.chains[i];
            target = this.targets[i];

            hostChainNumber = chain.getConnectedChainNumber();

            if ( hostChainNumber !== -1 ){

                hostBone  = this.chains[ hostChainNumber ].bones[ chain.getConnectedBoneNumber() ];

                chain.setBaseLocation( chain.getBoneConnectionPoint() === START ? hostBone.start : hostBone.end );

                // Now that we've clamped the base location of this chain to the start or end point of the bone in the chain we are connected to, it's
                // time to deal with any base bone constraints...

                constraintType = chain.getBaseboneConstraintType();

                switch (constraintType){

                    case NONE:         // Nothing to do because there's no basebone constraint
                    case GLOBAL_ROTOR: // Nothing to do because the basebone constraint is not relative to bones in other chains in this structure
                    case GLOBAL_HINGE: // Nothing to do because the basebone constraint is not relative to bones in other chains in this structure
                        break;
                        
                    // If we have a local rotor or hinge constraint then we must calculate the relative basebone constraint before calling solveForTarget
                    case LOCAL_ROTOR:
                    case LOCAL_HINGE:

                    //chain.resetTarget(); // ??

                    // Get the direction of the bone this chain is connected to and create a rotation matrix from it.
                    this.tmpMtx.createRotationMatrix( hostBone.getDirectionUV() );
                    //let connectionBoneMatrix = new FIK.M3().createRotationMatrix( hostBone.getDirectionUV() );
                        
                    // We'll then get the basebone constraint UV and multiply it by the rotation matrix of the connected bone 
                    // to make the basebone constraint UV relative to the direction of bone it's connected to.
                    //let relativeBaseboneConstraintUV = connectionBoneMatrix.times( c.getBaseboneConstraintUV() ).normalize();
                    let relativeBaseboneConstraintUV = chain.getBaseboneConstraintUV().clone().applyM3( this.tmpMtx );
                            
                    // Update our basebone relative constraint UV property
                    chain.setBaseboneRelativeConstraintUV( relativeBaseboneConstraintUV );
                        
                    // Update the relative reference constraint UV if we hav a local hinge
                    if (constraintType === LOCAL_HINGE )
                        chain.setBaseboneRelativeReferenceConstraintUV( chain.bones[0].joint.getHingeReferenceAxis().clone().applyM3( this.tmpMtx ) );
                        
                    break;

                }

                
                

            }

            // Finally, update the target and solve the chain

            if ( !chain.useEmbeddedTarget ) chain.solveForTarget( target );
            else chain.solveForEmbeddedTarget();

            // update 3d mesh

            if( this.isWithMesh ){

                mesh = this.meshChains[i];

                for ( let j = 0; j < chain.numBones; j++ ) {
                    bone = chain.bones[j];
                    mesh[j].position.copy( bone.start );
                    mesh[j].lookAt( bone.end );
                }

            }

        }

    }

    clear() {

        this.clearAllBoneMesh();

        let i;

        i = this.numChains;
        while(i--){
            this.remove(i);
        }

        this.chains = [];
        this.meshChains = [];
        this.targets = [];

    }

    add( chain, target, meshBone ) {

        this.chains.push( chain );
         
        this.targets.push( target ); 
        this.numChains ++;

        if( meshBone ) this.addChainMeshs( chain );
    }

    remove( id ) {

        this.chains[id].clear();
        this.chains.splice(id, 1);
        this.meshChains.splice(id, 1);
        this.targets.splice(id, 1);
        this.numChains --;

    }

    setFixedBaseMode( value ) {

        this.fixedBaseMode = value; 
        let i = this.numChains, host;
        while(i--){
            host = this.chains[i].getConnectedChainNumber();
            if( host===-1 ) this.chains[i].setFixedBaseMode( this.fixedBaseMode );
        }

    }

    getNumChains() {

        return this.numChains;

    }

    getChain(id) {

        return this.chains[id];

    }

    connectChain( Chain, chainNumber, boneNumber, point, target, meshBone, color ) {

        let c = chainNumber;
        let n = boneNumber;

        if ( chainNumber > this.numChains ) return;
        if ( boneNumber > this.chains[chainNumber].numBones ) return;

        // Make a copy of the provided chain so any changes made to the original do not affect this chain
        let chain = Chain.clone();//new Fullik.Chain( newChain );
        if( color !== undefined ) chain.setColor( color );

        // Connect the copy of the provided chain to the specified chain and bone in this structure
        //chain.connectToStructure( this, chainNumber, boneNumber );

        chain.setBoneConnectionPoint( point === 'end' ? END : START );
        chain.setConnectedChainNumber( c );
        chain.setConnectedBoneNumber( n );

        // The chain as we were provided should be centred on the origin, so we must now make it
        // relative to the start location of the given bone in the given chain.

        let position = point === 'end' ? this.chains[ c ].bones[ n ].end : this.chains[ c ].bones[ n ].start;
         

        chain.setBaseLocation( position );
        // When we have a chain connected to a another 'host' chain, the chain is which is connecting in
        // MUST have a fixed base, even though that means the base location is 'fixed' to the connection
        // point on the host chain, rather than a static location.
        chain.setFixedBaseMode( true );

        // Translate the chain we're connecting to the connection point
        for ( let i = 0; i < chain.numBones; i++ ){

            chain.bones[i].start.add( position );
            chain.bones[i].end.add( position );

        }
        
        this.add( chain, target, meshBone );

    }


    // 3D THREE

    addChainMeshs( chain, id ) {

        this.isWithMesh = true;

        let meshBone = [];
        let lng  = chain.bones.length;
        for(let i = 0; i < lng; i++ ){
            meshBone.push( this.addBoneMesh( chain.bones[i], i-1, meshBone, chain ));
        }

        this.meshChains.push( meshBone );

    }

    addBoneMesh( bone, prev, ar, chain ) {

        let s = 2, r = 2, a1, a2, axe;
        let size = bone.length;
        let color = bone.color;
        let g = new this.THREE.CylinderBufferGeometry ( 1, 0.5, size, 4 );
        g.rotateX( -Math.PI * 0.5 );
        g.translate( 0, 0, size*0.5 );
        //g.applyMatrix4( new this.THREE.Matrix4().makeRotationX( -Math.PI*0.5 ) )
        //g.applyMatrix4( new this.THREE.Matrix4().makeTranslation( 0, 0, size*0.5 ) );
        let m = new this.THREE.MeshStandardMaterial({ color:color, wireframe:false, shadowSide:this.THREE.DoubleSide });

        let m2 = new this.THREE.MeshBasicMaterial({ wireframe : true });
        //let m4 = new this.THREE.MeshBasicMaterial({ wireframe : true, color:color, transparent:true, opacity:0.3 });

        let extraMesh = null;
        let extraGeo;

        let type = bone.joint.type;
        switch(type){
            case J_BALL :
                m2.color.setHex(0xFF6600);
                let angle = bone.joint.rotor;
             
                if(angle === Math.PI) break;
                s = 2;//size/4;
                r = 2;//
                extraGeo = new this.THREE.CylinderBufferGeometry ( 0, r, s, 6,1, true );
                extraGeo.rotateX( -Math.PI * 0.5 );
                extraGeo.translate(  0, 0, s*0.5 );
                //extraGeo.applyMatrix4( new this.THREE.Matrix4().makeRotationX( -Math.PI*0.5 ) )
                //extraGeo.applyMatrix4( new this.THREE.Matrix4().makeTranslation( 0, 0, s*0.5 ) );
                extraMesh = new this.THREE.Mesh( extraGeo,  m2 );
            break;
            case J_GLOBAL :
            axe =  bone.joint.getHingeRotationAxis();
            a1 = bone.joint.min;
            a2 = bone.joint.max;
            r = 2;
            //console.log('global', a1, a2)
            m2.color.setHex(0xFFFF00);
            extraGeo = new this.THREE.CircleBufferGeometry( r, 12, a1, -a1+a2 );

            
            extraGeo.rotateX( -Math.PI * 0.5 );
            //extraGeo.applyMatrix4( new this.THREE.Matrix4().makeRotationX( -Math.PI*0.5 ) );
            if( axe.z === 1 ) extraGeo.rotateX( -Math.PI * 0.5 );//extraGeo.applyMatrix4( new this.THREE.Matrix4().makeRotationX( -Math.PI*0.5 ) );
            if( axe.y === 1 ) {extraGeo.rotateY( -Math.PI * 0.5 );  extraGeo.rotateX( -Math.PI * 0.5 ); }//{extraGeo.applyMatrix4( new this.THREE.Matrix4().makeRotationY( -Math.PI*0.5 ) );extraGeo.applyMatrix4( new this.THREE.Matrix4().makeRotationX( -Math.PI*0.5 ) );}
            if( axe.x === 1 ) {extraGeo.rotateY( Math.PI * 0.5 );/*extraGeo.applyMatrix4(new this.THREE.Matrix4().makeRotationY( Math.PI*0.5 ));*/}

            extraMesh = new this.THREE.Mesh( extraGeo,  m2 );
            break;
            case J_LOCAL :

            axe =  bone.joint.getHingeRotationAxis();
            a1 = bone.joint.min;
            a2 = bone.joint.max;
            r = 2;
            
            m2.color.setHex(0x00FFFF);
            extraGeo = new this.THREE.CircleBufferGeometry( r, 12, a1, -a1+a2 );
            extraGeo.rotateX( -Math.PI * 0.5 );

           // extraGeo.applyMatrix4( new this.THREE.Matrix4().makeRotationX( -Math.PI*0.5 ) );
            if( axe.z === 1 ) { extraGeo.rotateY( -Math.PI * 0.5 ); extraGeo.rotateX( Math.PI * 0.5 ); }
            if( axe.x === 1 ) extraGeo.rotateZ( -Math.PI * 0.5 );
            if( axe.y === 1 ) { extraGeo.rotateX( Math.PI * 0.5 ); extraGeo.rotateY( Math.PI * 0.5 ); }

            /*if( axe.z === 1 ) { extraGeo.applyMatrix4( new this.THREE.Matrix4().makeRotationY( -Math.PI*0.5 ) ); extraGeo.applyMatrix4( new this.THREE.Matrix4().makeRotationX( Math.PI*0.5 ) );}
            if( axe.x === 1 ) extraGeo.applyMatrix4( new this.THREE.Matrix4().makeRotationZ( -Math.PI*0.5 ) );
            if( axe.y === 1 ) { extraGeo.applyMatrix4( new this.THREE.Matrix4().makeRotationX( Math.PI*0.5 ) ); extraGeo.applyMatrix4(new this.THREE.Matrix4().makeRotationY( Math.PI*0.5 ));}*/

            extraMesh = new this.THREE.Mesh( extraGeo,  m2 );
            break;
        }

        axe = new this.THREE.AxesHelper(1.5);
        //let bw = new this.THREE.Mesh( g,  m4 );

        let b = new this.THREE.Mesh( g,  m );
        b.add(axe);
        //b.add(bw);
        this.scene.add( b );

        b.castShadow = true;
        b.receiveShadow = true;

        if( prev !== -1 ){
            if( extraMesh !== null ){ 
                if(type!==J_GLOBAL){
                    extraMesh.position.z = chain.bones[prev].length;
                    ar[prev].add( extraMesh );
                } else {
                    b.add( extraMesh );
                }
                
            }
        } else {
             if( extraMesh !== null ) b.add( extraMesh );
        }
       
        return b;

    }

    clearAllBoneMesh() {

        if(!this.isWithMesh) return;

        let i, j, b;

        i = this.meshChains.length;
        while(i--){
            j = this.meshChains[i].length;
            while(j--){
                b = this.meshChains[i][j];
                this.scene.remove( b );
                b.geometry.dispose();
                b.material.dispose();
            }
            this.meshChains[i] = [];
        }
        this.meshChains = [];

    }

}

class Joint2D {

    constructor( clockwise, antiClockwise, coordSystem ) {

        this.isJoint2D = true;

        this.coordinateSystem = coordSystem || J_LOCAL;

        if( clockwise < 0 ) clockwise *= -1;

        this.min = clockwise !== undefined ? -clockwise * math.toRad : -math.PI;
        this.max = antiClockwise !== undefined ? antiClockwise * math.toRad : math.PI;
        
    }

    clone() {

        let j = new this.constructor();
        j.coordinateSystem = this.coordinateSystem;
        j.max = this.max;
        j.min = this.min;
        return j;

    }

    validateAngle( a ) {

        a = a < 0 ? 0 : a;
        a = a > 180 ? 180 : a;
        return a;

    }

    // SET

    set( joint ) {

        this.max = joint.max;
        this.min = joint.min;
        this.coordinateSystem = joint.coordinateSystem;

    }

    setClockwiseConstraintDegs( angle ) {

        // 0 to -180 degrees represents clockwise rotation
        if( angle < 0 ) angle *= -1;
        this.min = - (this.validateAngle( angle ) * math.toRad);
        
    }

    setAnticlockwiseConstraintDegs( angle ) {

        // 0 to 180 degrees represents anti-clockwise rotation
        this.max = this.validateAngle( angle ) * math.toRad;
        
    }

    setConstraintCoordinateSystem( coordSystem ) {

        this.coordinateSystem = coordSystem;

    }


    // GET

    getConstraintCoordinateSystem() {

        return this.coordinateSystem;

    }

}

class Bone2D {

    constructor( Start, End, directionUV, length, clockwiseDegs, anticlockwiseDegs, color ) {

        this.isBone2D = true;

        this.start = new V2();
        this.end = new V2();
        this.length = length || 0;

        this.joint = new Joint2D( clockwiseDegs, anticlockwiseDegs );

        this.globalConstraintUV = new V2(1, 0);
        this.boneConnectionPoint = END;

        this.color = color || null;
        this.name = '';

        // init

        this.setStartLocation( Start );

        if( End ){ 

            this.setEndLocation( End );
            if( this.length === 0 ) this.length = this.getLength();

        } else if ( directionUV ) {

            this.setEndLocation( this.start.plus( directionUV.normalised().multiplyScalar( this.length ) ) );
            
        }

    }

    clone() {

        let b = new Bone2D( this.start, this.end );
        b.length = this.length;
        b.globalConstraintUV = this.globalConstraintUV;
        b.boneConnectionPoint = this.boneConnectionPoint;
        b.joint = this.joint.clone();
        b.color = this.color;
        b.name = this.name;
        return b;

    }

    // SET

    setName( name ) {

        this.name = name;

    }

    setColor( c ) {

        this.color = c;

    }

    setBoneConnectionPoint( bcp ) {

        this.boneConnectionPoint = bcp;

    }

    setStartLocation( v ) {

        this.start.copy( v );

    }

    setEndLocation( v ) {

        this.end.copy( v );

    }

    setLengt( length ) {

        if ( length > 0 ) this.length = length;

    }

    setGlobalConstraintUV( v ) {

        this.globalConstraintUV = v;

    }

    // SET JOINT

    setJoint( joint ) {

        this.joint = joint;

    }

    setClockwiseConstraintDegs( angleDegs ) {

        this.joint.setClockwiseConstraintDegs( angleDegs );

    }

    setAnticlockwiseConstraintDegs( angleDegs ) {

        this.joint.setAnticlockwiseConstraintDegs( angleDegs );

    }

    setJointConstraintCoordinateSystem ( coordSystem ) {

        this.joint.setConstraintCoordinateSystem( coordSystem );

    }


    // GET

    getGlobalConstraintUV() {

        return this.globalConstraintUV;

    }
    
    getBoneConnectionPoint() {

        return this.boneConnectionPoint;

    }

    getDirectionUV() {

        return this.end.minus( this.start ).normalize();

    }

    getLength() {

        return this.start.distanceTo( this.end );

    }
    

}

class Chain2D {

    constructor( color ) {

        this.isChain2D = true;
        this.tmpTarget = new V2();

        this.bones = [];
        this.name = '';

        this.solveDistanceThreshold = 1.0;
        this.minIterationChange = 0.01;
        this.maxIteration = 15;
        this.precision = 0.001;
        
        this.chainLength = 0;
        this.numBones = 0;

        this.baseLocation = new V2();
        this.fixedBaseMode = true;

        this.baseboneConstraintType = NONE;

        this.baseboneConstraintUV = new V2();
        this.baseboneRelativeConstraintUV = new V2();

        this.lastTargetLocation = new V2( MAX_VALUE, MAX_VALUE );
        this.lastBaseLocation =  new V2( MAX_VALUE, MAX_VALUE );

        this.boneConnectionPoint = END;
        
        this.currentSolveDistance = MAX_VALUE;
        this.connectedChainNumber = -1;
        this.connectedBoneNumber = -1;

        this.color = color || 0xFFFFFF;

        this.embeddedTarget = new V2();
        this.useEmbeddedTarget = false;

    }

    clone() {

        let c = new this.constructor();

        c.solveDistanceThreshold = this.solveDistanceThreshold;
        c.minIterationChange = this.minIterationChange;
        c.maxIteration = this.maxIteration;
        c.precision = this.precision;
        
        c.bones = this.cloneBones();
        c.baseLocation.copy( this.baseLocation );
        c.lastTargetLocation.copy( this.lastTargetLocation );
        c.lastBaseLocation.copy( this.lastBaseLocation );
                
        // Copy the basebone constraint UV if there is one to copy
        if ( !(this.baseboneConstraintType === NONE) ){
            c.baseboneConstraintUV.copy( this.baseboneConstraintUV );
            c.baseboneRelativeConstraintUV.copy( this.baseboneRelativeConstraintUV );
        }       
        
        // Native copy by value for primitive members
        c.fixedBaseMode          = this.fixedBaseMode;
        
        c.chainLength            = this.chainLength;
        c.numBones               = this.numBones;
        c.currentSolveDistance   = this.currentSolveDistance;

        c.boneConnectionPoint    = this.boneConnectionPoint;
        c.connectedChainNumber   = this.connectedChainNumber;
        c.connectedBoneNumber    = this.connectedBoneNumber;
        c.baseboneConstraintType = this.baseboneConstraintType;

        c.color = this.color;

        c.embeddedTarget = this.embeddedTarget.clone();
        c.useEmbeddedTarget = this.useEmbeddedTarget;

        return c;

    }

    clear() {

        let i = this.numBones;
        while(i--){
            this.removeBone(i);
        }

    }

    addBone( bone ) {

        if( bone.color === null ) bone.setColor( this.color );

        // Add the new bone to the end of the ArrayList of bones
        this.bones.push( bone );
        

        // If this is the basebone...
        if ( this.numBones === 0 ){
            // ...then keep a copy of the fixed start location...
            this.baseLocation.copy( bone.start );
            
            // ...and set the basebone constraint UV to be around the initial bone direction
            this.baseboneConstraintUV.copy( bone.getDirectionUV() );

        }

        // Increment the number of bones in the chain and update the chain length
        this.numBones ++;
        
        // Increment the number of bones in the chain and update the chain length
        this.updateChainLength();

    }

    removeBone( id ) {

        if ( id < this.numBones ){   
            // ...then remove the bone, decrease the bone count and update the chain length.
            this.bones.splice(id, 1);
            this.numBones --;
            this.updateChainLength();
        }

    }

    addConsecutiveBone( directionUV, length, clockwiseDegs, anticlockwiseDegs, color ) {

        if ( this.numBones === 0 ){ Tools.error('Chain is empty ! need first bone'); return }
        if( directionUV.isBone2D ) { // first argument is bone

            let bone = directionUV;

            // Validate the direction unit vector - throws an IllegalArgumentException if it has a magnitude of zero
            let dir = bone.getDirectionUV();
            math.validateDirectionUV( dir );
            
            // Validate the length of the bone - throws an IllegalArgumentException if it is not a positive value
            let len = bone.length;
            math.validateLength( len );

            let prevBoneEnd = this.bones[ this.numBones-1 ].end;

            bone.setStartLocation( prevBoneEnd );
            bone.setEndLocation( prevBoneEnd.plus( dir.multiplyScalar( len ) ) );
            
            // Add a bone to the end of this IK chain
            this.addBone( bone );

        } else if( directionUV.isVector2 ) {
            
            color = color || this.color;
             
            // Validate the direction unit vector - throws an IllegalArgumentException if it has a magnitude of zero
            math.validateDirectionUV( directionUV );
            
            // Validate the length of the bone - throws an IllegalArgumentException if it is not a positive value
            math.validateLength( length );
                    
            // Get the end location of the last bone, which will be used as the start location of the new bone
            let prevBoneEnd = this.bones[ this.numBones-1 ].end;
                    
            // Add a bone to the end of this IK chain
            this.addBone( new Bone2D( prevBoneEnd, null, directionUV.normalised(), length, clockwiseDegs, anticlockwiseDegs, color ) );
            

        }
        
    }


    // -------------------------------
    //      GET
    // -------------------------------

    getBoneConnectionPoint() {

        return this.boneConnectionPoint;

    }

    getConnectedBoneNumber() {

        return this.connectedBoneNumber;

    }

    getConnectedChainNumber(){

        return this.connectedChainNumber;

    }

    getEmbeddedTarget() {

        return this.embeddedTarget;

    }

    getBaseboneConstraintType() {

        return this.baseboneConstraintType;

    }

    getBaseboneConstraintUV() {

        if ( !(this.baseboneConstraintType === NONE) ) return this.baseboneConstraintUV;

    }

    getBaseLocation() {

        return this.bones[0].start;

    }

    getEffectorLocation() {

        return this.bones[this.numBones-1].end;

    }

    getLastTargetLocation() {

        return this.lastTargetLocation;

    }

    getLiveChainLength() {

        let lng = 0;
        let i = this.numBones;
        while( i-- ) lng += this.bones[i].getLength();
        return lng;

    }


    // -------------------------------
    //      SET
    // -------------------------------

    setColor( color ) {

        this.color = color;
        let i = this.numBones;
        while( i-- ) this.bones[i].setColor( this.color );
        
    }

    setBaseboneRelativeConstraintUV( constraintUV ) { 

        this.baseboneRelativeConstraintUV = constraintUV; 

    }

    setConnectedBoneNumber( boneNumber ) {

        this.connectedBoneNumber = boneNumber;

    }

    setConnectedChainNumber( chainNumber ) {

        this.connectedChainNumber = chainNumber;

    }

    setBoneConnectionPoint( point ) {

        this.boneConnectionPoint = point;

    }

    setBaseboneConstraintUV( constraintUV ) {

        math.validateDirectionUV( constraintUV );
        this.baseboneConstraintUV.copy( constraintUV.normalised() );

    }

    setBaseLocation( baseLocation ){

        this.baseLocation.copy( baseLocation );

    }

    setBaseboneConstraintType( value ) {

        this.baseboneConstraintType = value;

    }

    setFixedBaseMode( value ) {

        // Enforce that a chain connected to another chain stays in fixed base mode (i.e. it moves with the chain it's connected to instead of independently)
        if ( !value && this.connectedChainNumber !== -1) return;
        if ( this.baseboneConstraintType === GLOBAL_ABSOLUTE && !value ) return;
        // Above conditions met? Set the fixedBaseMode
        this.fixedBaseMode = value;

    }

    setMaxIterationAttempts( maxIteration ) {

        if ( maxIteration < 1 ) return;
        this.maxIteration = maxIteration;

    }

    setMinIterationChange( minIterationChange ) {

        if (minIterationChange < 0) return;
        this.minIterationChange = minIterationChange;

    }

    setSolveDistanceThreshold( solveDistance ) {

        if ( solveDistance < 0 ) return;
        this.solveDistanceThreshold = solveDistance;

    }

    // -------------------------------
    //
    //      UPDATE TARGET
    //
    // -------------------------------

    solveForEmbeddedTarget() {

        if ( this.useEmbeddedTarget ) return this.solveForTarget( this.embeddedTarget );

    }

    resetTarget(){

        this.lastBaseLocation = new V2( MAX_VALUE, MAX_VALUE );
        this.currentSolveDistance = MAX_VALUE;

    }


    // Solve the IK chain for this target to the best of our ability.
    // The end result of running this method is that the IK chain configuration is updated.

    // To minimuse CPU usage, this method dynamically aborts if:
    // - The solve distance (i.e. distance between the end effector and the target) is below the solveDistanceThreshold,
    // - A solution incrementally improves on the previous solution by less than the minIterationChange, or
    // - The number of attempts to solve the IK chain exceeds the maxIteration.

    solveForTarget( t ) {

        this.tmpTarget.set( t.x, t.y );
        let p = this.precision;

        let isSameBaseLocation = this.lastBaseLocation.approximatelyEquals( this.baseLocation, p );

        // If we have both the same target and base location as the last run then do not solve
        if ( this.lastTargetLocation.approximatelyEquals( this.tmpTarget, p ) && isSameBaseLocation ) return this.currentSolveDistance;
        
        // Keep starting solutions and distance
        let startingDistance;
        let startingSolution = null;

        // If the base location of a chain hasn't moved then we may opt to keep the current solution if our 
        // best new solution is worse...
        if ( isSameBaseLocation ) {
            startingDistance = this.bones[ this.numBones-1 ].end.distanceTo( this.tmpTarget );
            startingSolution = this.cloneBones();
        } else {
            // Base has changed? Then we have little choice but to recalc the solution and take that new solution.
            startingDistance = MAX_VALUE;
        }
                        
        // Not the same target? Then we must solve the chain for the new target.
		// We'll start by creating a list of bones to store our best solution
        let bestSolution = [];
        
        // We'll keep track of our best solve distance, starting it at a huge value which will be beaten on first attempt
        let bestSolveDistance = MAX_VALUE;
        let lastPassSolveDistance = MAX_VALUE;
        
        // Allow up to our iteration limit attempts at solving the chain
        let solveDistance;
        
        let i = this.maxIteration;

        while( i-- ){

            // Solve the chain for this target
            solveDistance = this.solveIK( this.tmpTarget );
            
            // Did we solve it for distance? If so, update our best distance and best solution, and also
            // update our last pass solve distance. Note: We will ALWAYS beat our last solve distance on the first run

            if ( solveDistance < bestSolveDistance ) {   

                bestSolveDistance = solveDistance;
                bestSolution = this.cloneBones();
                
                // If we are happy that this solution meets our distance requirements then we can exit the loop now
                if ( solveDistance <= this.solveDistanceThreshold ) break;
                
            } else {

                // Did not solve to our satisfaction? Okay...
                // Did we grind to a halt? If so break out of loop to set the best distance and solution that we have
                if ( Math.abs( solveDistance - lastPassSolveDistance ) < this.minIterationChange )  break;

            }
            
            // Update the last pass solve distance
            lastPassSolveDistance = solveDistance;
            
        }

        // Did we get a solution that's better than the starting solution's to the new target location?
        if ( bestSolveDistance < startingDistance ){
            // If so, set the newly found solve distance and solution as the best found.
            this.currentSolveDistance = bestSolveDistance;
            this.bones = bestSolution;
        } else {
            // Did we make things worse? Then we keep our starting distance and solution!
            this.currentSolveDistance = startingDistance;
            this.bones = startingSolution; 
        }
        
        // Update our last base and target locations so we know whether we need to solve for this start/end configuration next time
        this.lastBaseLocation.copy( this.baseLocation );
        this.lastTargetLocation.copy( this.tmpTarget );
        
        return this.currentSolveDistance;

    }

    // -------------------------------
    //
    //      SOLVE IK
    //
    // -------------------------------

    // Solve the IK chain for the given target using the FABRIK algorithm.
    // retun the best solve distance found between the end-effector of this chain and the provided target.

    solveIK( target ) {

        if ( this.numBones === 0 ) return;

        let bone, boneLength, nextBone, startPosition, endPosition, directionUV, baselineUV;
        
        // ---------- Forward pass from end effector to base -----------

        // Loop over all bones in the chain, from the end effector (numBones-1) back to the basebone (0) 
        let i = this.numBones;

        while( i-- ){

            // Get the length of the bone we're working on
            bone = this.bones[i];
            boneLength  = bone.length;
            

            // If we are NOT working on the end effector bone
            if ( i !== this.numBones - 1 ) {

                nextBone = this.bones[i+1];

                // Get the outer-to-inner unit vector of this bone
                directionUV = bone.getDirectionUV().negate();
                
                // Get the outer-to-inner unit vector of the bone further out
                baselineUV = bone.joint.coordinateSystem === J_LOCAL ? nextBone.getDirectionUV().negate() : bone.getGlobalConstraintUV().negated();
                directionUV.constrainedUV( baselineUV, nextBone.joint.min, nextBone.joint.max );

                // At this stage we have a outer-to-inner unit vector for this bone which is within our constraints,
                // so we can set the new inner joint location to be the end joint location of this bone plus the
                // outer-to-inner direction unit vector multiplied by the length of the bone.
                startPosition = bone.end.plus( directionUV.multiplyScalar( boneLength ) );

                // Set the new start joint location for this bone
                bone.setStartLocation( startPosition );

                // If we are not working on the basebone, then we also set the end joint location of
                // the previous bone in the chain (i.e. the bone closer to the base) to be the new
                // start joint location of this bone.
                if ( i > 0 ) this.bones[i-1].setEndLocation( startPosition );
                
            } else { // If we ARE working on the end effector bone...
            
                // Snap the end effector's end location to the target
                bone.setEndLocation( target );

                // update directionUV
                directionUV = bone.getDirectionUV().negate();

                if ( i > 0 ){

                    // The end-effector bone is NOT the basebone as well
                    // Get the outer-to-inner unit vector of the bone further in
                    baselineUV = bone.joint.coordinateSystem === J_LOCAL ? this.bones[i-1].getDirectionUV().negate() : bone.getGlobalConstraintUV().negated();
                    directionUV.constrainedUV( baselineUV, bone.joint.min, bone.joint.max );

                } else {

                    if(bone.joint.coordinateSystem !== J_LOCAL){

                        // Can constrain if constraining against global coordinate system
                        baselineUV = bone.getGlobalConstraintUV().negated();
                        directionUV.constrainedUV( baselineUV, bone.joint.min, bone.joint.max );

                    }

                }
      
                // Calculate the new start joint location as the end joint location plus the outer-to-inner direction UV
                // multiplied by the length of the bone.
                startPosition = bone.end.plus( directionUV.multiplyScalar( boneLength ) );
                
                // Set the new start joint location for this bone to be new start location...
                bone.setStartLocation( startPosition );

                // ...and set the end joint location of the bone further in to also be at the new start location.
                if ( i > 0 ) this.bones[i-1].setEndLocation( startPosition );
                
            }
            
        } // End of forward pass loop over all bones

        // ---------- Step 2 of 2 - Backward pass from base to end effector -----------
 
        for ( i = 0; i < this.numBones; i++ ){

            bone = this.bones[i];
            boneLength  = bone.length;

            // If we are not working on the basebone
            if ( i !== 0 ){

                // Get the inner-to-outer direction of this bone as well as the previous bone to use as a baseline
                directionUV = bone.getDirectionUV();
                // Constrain the angle between this bone and the inner bone.
                baselineUV = bone.joint.coordinateSystem === J_LOCAL ? this.bones[i-1].getDirectionUV() : bone.getGlobalConstraintUV();
                directionUV.constrainedUV( baselineUV, bone.joint.min, bone.joint.max );

                // At this stage we have an inner-to-outer unit vector for this bone which is within our constraints,
                // so we can set the new end location to be the start location of this bone plus the constrained
                // inner-to-outer direction unit vector multiplied by the length of this bone.
                endPosition = bone.start.plus( directionUV.multiplyScalar(boneLength) );

                // Set the new end joint location for this bone
                bone.setEndLocation( endPosition );

                // If we are not working on the end bone, then we set the start joint location of
                // the next bone in the chain (i.e. the bone closer to the end effector) to be the
                // new end joint location of this bone also.
                if ( i < this.numBones-1 ) this.bones[i+1].setStartLocation( endPosition );
                
            } else {// If we ARE working on the base bone...

                // If the base location is fixed then snap the start location of the base bone back to the fixed base
                if ( this.fixedBaseMode ){

                    bone.setStartLocation( this.baseLocation );

                } else {// If the base location is not fixed...
                
                    // ...then set the new base bone start location to be its the end location minus the
                    // bone direction multiplied by the length of the bone (i.e. projected backwards).
                    startPosition = bone.end.minus( bone.getDirectionUV().multiplyScalar( boneLength ) );
                    bone.setStartLocation( startPosition );

                }

                // update directionUV
                directionUV = bone.getDirectionUV();
                
                // If the base bone is unconstrained then process it as usual...
                if ( this.baseboneConstraintType === NONE ){
    
                    // Calculate the new end location as the start location plus the direction multiplyScalar by the length of the bone
                    endPosition = bone.start.plus( directionUV.multiplyScalar( boneLength ) );
    
                    // Set the new end joint location
                    bone.setEndLocation( endPosition );
    
                    // Also, set the start location of the next bone to be the end location of this bone
                    if ( this.numBones > 1 ) this.bones[1].setStartLocation( endPosition );

                } else {

                    // ...otherwise we must constrain it to the basebone constraint unit vector

                    // LOCAL_ABSOLUTE? (i.e. local-space directional constraint) - then we must constraint about the relative basebone constraint UV...
                    baselineUV = this.baseboneConstraintType === LOCAL_ABSOLUTE ? this.baseboneRelativeConstraintUV : this.baseboneConstraintUV;
                    directionUV.constrainedUV( baselineUV, bone.joint.min, bone.joint.max );

                    //directionUV = bone.getDirectionUV();
                    
                    // At this stage we have an inner-to-outer unit vector for this bone which is within our constraints,
                    // so we can set the new end location to be the start location of this bone plus the constrained
                    // inner-to-outer direction unit vector multiplied by the length of the bone.
                    endPosition = bone.start.plus( directionUV.multiplyScalar( boneLength ) );

                    // Set the new end joint location for this bone
                    bone.setEndLocation( endPosition );

                    // If we are not working on the end bone, then we set the start joint location of
                    // the next bone in the chain (i.e. the bone closer to the end effector) to be the
                    // new end joint location of this bone.
                    if ( i < (this.numBones - 1) ) { this.bones[i+1].setStartLocation( endPosition ); }
                    
                
                } // End of basebone constraint enforcement section         

            } // End of base bone handling section

        } // End of backward-pass loop over all bones

        // Update our last target location
        this.lastTargetLocation.copy( target );
                
        // ...and calculate and return the distance between the current effector location and the target.
        return this.bones[this.numBones-1].end.distanceTo( target );

    }

    updateChainLength() {

        // Loop over all the bones in the chain, adding the length of each bone to the mChainLength property
        this.chainLength = 0;
        let i = this.numBones;
        while(i--) this.chainLength += this.bones[i].length;

    }

    cloneBones() {

        // Use clone to create a new Bone with the values from the source Bone.
        let chain = [];
        for ( let i = 0, n = this.bones.length; i < n; i++ ) chain.push( this.bones[i].clone() );
        return chain;

    }

}

class Structure2D {

    constructor( scene, THREE ) {

        this.THREE = THREE;

        this.isStructure2D = true;

        this.fixedBaseMode = true;

        this.chains = [];
        this.meshChains = [];
        this.angleChains= [];
        this.targets = [];
        this.numChains = 0;

        this.scene = scene || null;

        this.isWithMesh = false;

    }

    update() {

        //console.log('up')

        let chain, mesh, bone, target; new this.THREE.Vector3();
        let hostChainNumber;
        let constraintType;
        let a, angle;

        for( let i = 0; i < this.numChains; i++ ){

            chain = this.chains[i];
            
            target = this.targets[i] || null;

            hostChainNumber = chain.getConnectedChainNumber();

            // Get the basebone constraint type of the chain we're working on
            constraintType = chain.getBaseboneConstraintType();

            // If this chain is not connected to another chain and the basebone constraint type of this chain is not global absolute
            // then we must update the basebone constraint UV for LOCAL_RELATIVE and the basebone relative constraint UV for LOCAL_ABSOLUTE connection types.
            // Note: For NONE or GLOBAL_ABSOLUTE we don't need to update anything before calling solveForTarget().
            if ( hostChainNumber !== -1 && constraintType !== GLOBAL_ABSOLUTE ) {   
                // Get the bone which this chain is connected to in the 'host' chain
                let hostBone = this.chains[ hostChainNumber ].bones[ chain.getConnectedBoneNumber() ];

                chain.setBaseLocation( chain.getBoneConnectionPoint() === START ? hostBone.start : hostBone.end );
               
                
                // If the basebone is constrained to the direction of the bone it's connected to...
                let hostBoneUV = hostBone.getDirectionUV();

                if ( constraintType === LOCAL_RELATIVE ){   

                    // ...then set the basebone constraint UV to be the direction of the bone we're connected to.
                    chain.setBaseboneConstraintUV( hostBoneUV );

                } else if ( constraintType === LOCAL_ABSOLUTE ) {   

                    // Note: LOCAL_ABSOLUTE directions are directions which are in the local coordinate system of the host bone.
                    // For example, if the baseboneConstraintUV is Vec2f(-1.0f, 0.0f) [i.e. left], then the baseboneConnectionConstraintUV
                    // will be updated to be left with regard to the host bone.
                    
                    // Get the angle between UP and the hostbone direction
                    angle = UP.getSignedAngle( hostBoneUV );

                    // ...then apply that same rotation to this chain's basebone constraint UV to get the relative constraint UV... 
                    let relativeConstraintUV = chain.getBaseboneConstraintUV().clone().rotate( angle );
                    
                    // ...which we then update.
                    chain.setBaseboneRelativeConstraintUV( relativeConstraintUV );      

                }
                
                // NOTE: If the basebone constraint type is NONE then we don't do anything with the basebone constraint of the connected chain.
                
            } // End of if chain is connected to another chain section

            // Finally, update the target and solve the chain

            if ( !chain.useEmbeddedTarget ) chain.solveForTarget( target );
            else console.log('embed', chain.solveForEmbeddedTarget());


            // update 3d mesh

            if( this.isWithMesh ){

                mesh = this.meshChains[i];
                angle = this.angleChains[i];

                for ( let j = 0; j < chain.numBones; j++ ) {

                    bone = chain.bones[j];
                    mesh[j].position.set( bone.start.x, bone.start.y, 0 );
                    a = math.unwrapRad( -Math.atan2( bone.start.x - bone.end.x, bone.start.y - bone.end.y ));
                    a = math.unwrapRad( -Math.atan2( bone.end.x - bone.start.x, bone.end.y - bone.start.y ));
                    mesh[j].rotation.z = a;
                    angle[j] =  a * math.toDeg;

                    //mesh[j].lookAt( tmp.set( bone.end.x, bone.end.y, 0 ) );
                }

            }


        }

    }

    setFixedBaseMode( value ) {

        // Update our flag and set the fixed base mode on the first (i.e. 0th) chain in this structure.
        this.fixedBaseMode = value; 
        let i = this.numChains, host;
        while(i--){
            host = this.chains[i].getConnectedChainNumber();
            if(host===-1) this.chains[i].setFixedBaseMode( this.fixedBaseMode );
        }
        //this.chains[0].setFixedBaseMode( this.fixedBaseMode );

    }

    clear() {

        this.clearAllBoneMesh();

        let i;

        i = this.numChains;
        while(i--){
            this.remove(i);
        }

        this.chains = [];
        this.meshChains = [];
        this.angleChains = [];
        this.targets = [];

    }

    add( chain, target, meshBone ) {

        this.chains.push( chain );
        this.numChains ++;

        //if( target.isVector3 ) target = new V2(target.x, target.y);
         
        if(target) this.targets.push( target ); 
        

        if( meshBone ) this.addChainMeshs( chain );

    }

    remove( id ){

        this.chains[id].clear();
        this.chains.splice(id, 1);
        this.meshChains.splice(id, 1);
        this.angleChains.splice(id, 1);
        this.targets.splice(id, 1);
        this.numChains --;

    }

    /*setFixedBaseMode:function( fixedBaseMode ){
        for ( let i = 0; i < this.numChains; i++) {
            this.chains[i].setFixedBaseMode( fixedBaseMode );
        }
    },*/

    getNumChains() {

        return this.numChains;

    }

    getChain( id ) {

        return this.chains[id];

    }

    connectChain( Chain, chainNumber, boneNumber, point, target, meshBone, color ) {

        let c = chainNumber;
        let n = boneNumber;

        point = point || 'end';

        if ( c > this.numChains ){ Tools.error('Chain not existe !'); return }        if ( n > this.chains[ c ].numBones ){ Tools.error('Bone not existe !'); return }
        // Make a copy of the provided chain so any changes made to the original do not affect this chain
        let chain = Chain.clone();

        chain.setBoneConnectionPoint( point === 'end' ? END : START );
        chain.setConnectedChainNumber( c );
        chain.setConnectedBoneNumber( n );

        // The chain as we were provided should be centred on the origin, so we must now make it
        // relative to the start or end position of the given bone in the given chain.

        let position = point === 'end' ? this.chains[ c ].bones[ n ].end : this.chains[ c ].bones[ n ].start;

        //if ( connectionPoint === 'start' ) connectionLocation = this.chains[chainNumber].getBone(boneNumber).start;
        //else connectionLocation = this.chains[chainNumber].getBone(boneNumber).end;
         

        chain.setBaseLocation( position );

        // When we have a chain connected to a another 'host' chain, the chain is which is connecting in
        // MUST have a fixed base, even though that means the base location is 'fixed' to the connection
        // point on the host chain, rather than a static location.
        chain.setFixedBaseMode( true );

        // Translate the chain we're connecting to the connection point
        for ( let i = 0; i < chain.numBones; i++ ){

            chain.bones[i].start.add( position );
            chain.bones[i].end.add( position );

        }
        
        this.add( chain, target, meshBone );

    }

    // 3D THREE

    addChainMeshs( chain, id ) {

        this.isWithMesh = true;

        let meshBone = [];
        let angle = [];

        let lng  = chain.bones.length;
        for(let i = 0; i<lng; i++ ){
            meshBone.push( this.addBoneMesh( chain.bones[i] ) );
            angle.push(0);
        }

        this.meshChains.push( meshBone );
        this.angleChains.push( angle );

    }

    addBoneMesh( bone ){

        let size = bone.length;
        let color = bone.color;
        //console.log(bone.color)
        let g = new this.THREE.CylinderBufferGeometry ( 0.5, 1, size, 4 );
        g.translate( 0, size*0.5, 0 );

        let m = new this.THREE.MeshStandardMaterial({ color:color, wireframe:false, shadowSide:this.THREE.DoubleSide });
        new this.THREE.MeshBasicMaterial({ wireframe : true });

        /*let type = bone.getJoint().type;
        switch(type){
            case J_BALL :
                m2.color.setHex(0xFF6600);
                let angle  = bone.getJoint().mRotorConstraintDegs;
                if(angle === 180) break;
                let s = size/4;
                let r = 2;//

                extraGeo = new this.THREE.CylinderBufferGeometry ( 0, r, s, 6 );
                extraGeo.applyMatrix4( new this.THREE.Matrix4().makeRotationX( -Math.PI*0.5 ) )
                extraGeo.applyMatrix4( new this.THREE.Matrix4().makeTranslation( 0, 0, s*0.5 ) );
                extraMesh = new this.THREE.Mesh( extraGeo,  m2 );
            break;
            case J_GLOBAL_HINGE :
            let a1 = bone.getJoint().mHingeClockwiseConstraintDegs * math.torad;
            let a2 = bone.getJoint().mHingeAnticlockwiseConstraintDegs * math.torad;
            let r = 2;
            m2.color.setHex(0xFFFF00);
            extraGeo = new this.THREE.CircleGeometry ( r, 12, a1, a1+a2 );
            extraGeo.applyMatrix4( new this.THREE.Matrix4().makeRotationX( -Math.PI*0.5 ) );
            extraMesh = new this.THREE.Mesh( extraGeo,  m2 );
            break;
            case J_LOCAL_HINGE :
            let r = 2;
            let a1 = bone.getJoint().mHingeClockwiseConstraintDegs * math.torad;
            let a2 = bone.getJoint().mHingeAnticlockwiseConstraintDegs * math.torad;
            m2.color.setHex(0x00FFFF);
            extraGeo = new this.THREE.CircleGeometry ( r, 12, a1, a1+a2 );
            extraGeo.applyMatrix4( new this.THREE.Matrix4().makeRotationX( -Math.PI*0.5 ) );
            extraMesh = new this.THREE.Mesh( extraGeo,  m2 );
            break;
        }*/




        let b = new this.THREE.Mesh( g,  m );

        b.castShadow = true;
        b.receiveShadow = true;
        
        this.scene.add( b );
        return b;

    }

    clearAllBoneMesh() {

        if(!this.isWithMesh) return;

        let i, j, b;

        i = this.meshChains.length;
        while(i--){
            j = this.meshChains[i].length;
            while(j--){
                b = this.meshChains[i][j];
                this.scene.remove( b );
                b.geometry.dispose();
                b.material.dispose();
            }
            this.meshChains[i] = [];
        }
        this.meshChains = [];

    }

}

//import { NONE, GLOBAL_ROTOR, GLOBAL_HINGE, LOCAL_ROTOR, LOCAL_HINGE, J_BALL, J_GLOBAL, J_LOCAL } from '../constants.js';

class IKSolver {

    constructor( o ) {

        this.isIKSolver = true;
    	this.startBones = null;
    	this.endBones = null;

        this.target = null;
        this.goal = null;
        this.swivelAngle = 0;

        this.iteration = 40;

        this.thresholds = { position:0.1, rotation:0.1 };

        this.solver = null;
        this.chain = null;

    }

}

//import { NONE, GLOBAL_ROTOR, GLOBAL_HINGE, LOCAL_ROTOR, LOCAL_HINGE, J_BALL, J_GLOBAL, J_LOCAL } from '../constants.js';


class HISolver {

    constructor( o, THREE ) {

    	this.THREE = THREE;

    	this.isHISolver = true;
		this.startBones = null;
		this.endBones = null;

		this.scene = o.scene;

	    this.target = null;
	    this.goal = null;
	    this.swivelAngle = 0;

	    this.iteration = 15;

	    this.thresholds = { position:0.1, rotation:0.1 };

	    this.solver = new Structure2D( this.scene, this.THREE );
	    //this.chain = null;

	    this.bones = [];
	    this.numBones = 0;

	    this.rotation = [];

	    this.initStructure( o );

	}


	initStructure( o ) {

		this.startBones = o.start;
		this.endBones = o.end;
		this.angles = o.angles;

		let bone = this.startBones, next = bone.children[0];

		this.bones.push(bone);

		for (let i = 0; i<100; i++) {
            
            this.bones.push(next);
			if( next === this.endBones ) { this.createChain(); break }

			bone = next;
			
			next = bone.children[0];

		}

	}

	createChain() {

		this.numBones = this.bones.length;
		let chain = new Chain2D();
		//chain.embeddedTarget = new V2();
        //chain.useEmbeddedTarget = true;
        chain.setFixedBaseMode(true);  
        chain.setBaseboneConstraintType( LOCAL_ABSOLUTE );

        this.fakeBone = new Bone2D( new V2(0, -1), new V2(0, 0) );

		this.target = new this.THREE.Vector3();

		let base = new this.THREE.Vector3();
		let p0 = new this.THREE.Vector3();
		let p1 = new this.THREE.Vector3();
		let uv = new V2();
		let lng = 0;

	    for (let i = 0; i<this.numBones; i++) {

	    	if( i > 0 ){ 
	    		this.target.add( this.bones[i].position );
	    		lng = base.distanceTo( this.bones[i].position );
	    		this.bones[i-1].getWorldPosition( p0 );
	    		this.bones[i].getWorldPosition( p1 );
	    		p1.sub( p0 ).normalize();


	    		if(p1.z === 0 ) uv.set( p1.x, p1.y );
	    		else if(p1.x === 0 ) uv.set( p1.z, p1.y );
	    		//uvs.push( uv );

	    		//console.log( uv, lng, this.angles[i-1][0], this.angles[i-1][1])

	    		if(i===1) chain.addBone( new Bone2D( new V2(0, 0), null, uv, lng, this.angles[i-1][0], this.angles[i-1][1] ) );
	    		//else chain.addConsecutiveBone( uv, lng );//, this.angles[i-1][0], this.angles[i-1][1] );
	    		else chain.addConsecutiveBone( uv, lng, this.angles[i-1][0], this.angles[i-1][1] );
	    	}

	    }

	    //if(this.target.z === 0 ) chain.embeddedTarget.set( this.target.x, this.target.y );
	    //else if(this.target.x === 0 ) chain.embeddedTarget.set( this.target.z, this.target.y );
	    this.target.set( 10, 20, 0 );

	    this.solver.add( chain, this.target, true );

	    //this.solver.chains[0].embeddedTarget.set(10, 10)


	    //console.log( lengths );
	    //console.log( this.bones, this.target, this.solver.chains[0].bones );

	}

	update() {

		this.solver.update();

		let bones2d = this.solver.chains[0].bones;
		let n = this.numBones-1;

		let a;

		for(let i = 0; i < n; i++){

			a = i===0 ? math.findAngle( this.fakeBone, bones2d[i] ) : math.findAngle( bones2d[i-1], bones2d[i] );
			this.rotation[i] = a * math.toDeg;
		    this.rotation[i] += a < 0 ? 180 : -180;
		    this.rotation[i] *= -1;

		}

		for( let i = 0; i < n; i++ ){
			this.bones[i].rotation.z = this.rotation[i] * math.toRad;
		}

		//console.log(this.rotation)
		//let r = FIK.math.findAngle(bones[0], bones[1]);

	}

}

export { Bone2D, Bone3D, Chain2D, Chain3D, DOWN, END, GLOBAL_ABSOLUTE, GLOBAL_HINGE, GLOBAL_ROTOR, HISolver, IKSolver, J_BALL, J_GLOBAL, J_LOCAL, Joint2D, Joint3D, LEFT, LOCAL_ABSOLUTE, LOCAL_HINGE, LOCAL_RELATIVE, LOCAL_ROTOR, M3, MAX_VALUE, NONE, PRECISION, PRECISION_DEG, REVISION, RIGHT, START, Structure2D, Structure3D, UP, V2, V3, X_AXE, X_NEG, Y_AXE, Y_NEG, Z_AXE, Z_NEG, math };