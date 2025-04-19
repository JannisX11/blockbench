/**
 * original author: arodic / https://github.com/arodic
 * modified for Blockbench by jannisx11
 */

 ( function () {

	'use strict';


	class GizmoMaterial extends THREE.MeshBasicMaterial {
		constructor(parameters) {
			super()

			this.depthTest = false;
			this.depthWrite = false;
			this.side = THREE.FrontSide;
			this.transparent = true;
	
			this.setValues( parameters );
	
			if (typeof parameters.color === "function") { // allows us to dynamically set oldColor
				this.oldColor = this.color = parameters.color();
				this.getOriginalColor = parameters.color;
			}
			else {
				this.oldColor = this.color = parameters.color;
			}
			this.oldOpacity = this.opacity;
	
			this.highlight = function( highlighted ) {
	
				if ( highlighted ) {
	
					this.color = gizmo_colors.gizmo_hover;
					//this.color.r *= 1.2;
					//this.color.g *= 1.2;
					//this.color.b *= 1.2;
					this.opacity = 1;
	
				} else {
	
					this.color = this.getOriginalColor();
					this.opacity = this.oldOpacity;
	
				}

			};
			this.select = function( selected ) {
				
				if ( selected ) {

					this.color = new THREE.Color(0xffffff);
					this.opacity = 1;

				} else {

					this.color = this.getOriginalColor();
					this.opacity = this.oldOpacity;

				}

			};
		}
		// Can be changed to determine color based on outside logic
		getOriginalColor() {
			return this.oldColor;
		}
	}
	
	class GizmoLineMaterial extends THREE.LineBasicMaterial {
		constructor(parameters) {
			super()

			this.depthTest = false;
			this.depthWrite = false;
			this.transparent = true;
			this.linewidth = 1;
	
			this.setValues( parameters );
			
			if (typeof parameters.color === "function") { // allows us to dynamically set oldColor
				this.oldColor = this.color = parameters.color();
				this.getOriginalColor = parameters.color;
			}
			else {
				this.oldColor = this.color = parameters.color;
			}
			this.oldOpacity = this.opacity;
	
			this.highlight = function( highlighted ) {
	
				if ( highlighted ) {
	
					this.color = gizmo_colors.gizmo_hover;
					this.opacity = 1;
	
				} else {
	
					this.color = this.getOriginalColor();
					this.opacity = this.oldOpacity;
	
				}
	
			};
			this.select = function( selected ) {
				
				if ( selected ) {

					this.color = new THREE.Color(0xffffff);
					this.opacity = 1;

				} else {

					this.color = this.getOriginalColor();
					this.opacity = this.oldOpacity;

				}

			};
		}
		// Can be changed to determine color based on outside logic
		getOriginalColor() {
			return this.oldColor;
		}
	}

	var pickerMaterial = new GizmoMaterial( { visible: false, transparent: false, side: THREE.DoubleSide } );

	THREE.TransformGizmo = class extends THREE.Object3D {
		constructor() {

			super();

			this.init = function () {

				this.handles = new THREE.Object3D();
				this.pickers = new THREE.Object3D();
				this.planes = new THREE.Object3D();

				this.add( this.handles );
				this.add( this.pickers );
				this.add( this.planes );

				//// PLANES

				var planeGeometry = new THREE.PlaneGeometry( 50, 50, 2, 2 );
				var planeMaterial = new THREE.MeshBasicMaterial( { visible: false, side: THREE.DoubleSide } );

				var planes = {
					"XY":   new THREE.Mesh( planeGeometry, planeMaterial ),
					"YZ":   new THREE.Mesh( planeGeometry, planeMaterial ),
					"XZ":   new THREE.Mesh( planeGeometry, planeMaterial ),
					"XYZE": new THREE.Mesh( planeGeometry, planeMaterial )
				};

				this.activePlane = planes[ "XYZE" ];

				planes[ "YZ" ].rotation.set( 0, Math.PI / 2, 0 );
				planes[ "XZ" ].rotation.set( - Math.PI / 2, 0, 0 );

				for ( var i in planes ) {

					planes[ i ].name = i;
					this.planes.add( planes[ i ] );
					this.planes[ i ] = planes[ i ];

				}

				//// HANDLES AND PICKERS

				var setupGizmos = function( gizmoMap, parent ) {

					for ( var name in gizmoMap ) {

						for ( i = gizmoMap[ name ].length; i --; ) {

							var object = gizmoMap[ name ][ i ][ 0 ];
							var position = gizmoMap[ name ][ i ][ 1 ];
							var rotation = gizmoMap[ name ][ i ][ 2 ];
							var scale = gizmoMap[ name ][ i ][ 3 ];

							if (object.name.length === 0) {
								object.name = name;
							}
							object.renderDepth = 999

							if ( position ) object.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );
							if ( rotation ) object.rotation.set( rotation[ 0 ], rotation[ 1 ], rotation[ 2 ] );
							if ( scale ) {
								object.scale.set( scale[ 0 ], scale[ 1 ], scale[ 2 ] );
							}

							parent.add( object );

						}

					}

				};

				setupGizmos( this.handleGizmos, this.handles );
				setupGizmos( this.pickerGizmos, this.pickers );

				// reset Transformations

				this.traverse( function ( child ) {

					if ( child instanceof THREE.Mesh ) {

						child.updateMatrix();

						var tempGeometry = child.geometry.clone();
						tempGeometry.applyMatrix4( child.matrix );
						child.geometry = tempGeometry;

						child.position.set( 0, 0, 0 );
						child.rotation.set( 0, 0, 0 );
						child.scale.set( 1, 1, 1 );

					}

				} );

			};

			this.highlight = function ( axis ) {

				var axis_letter = typeof axis === 'string' && axis.substr(-1).toLowerCase();

				this.traverse( function( child ) {

					if ( child.material && child.material.highlight ) {

						if ( child.name === axis && axis_letter && (child.scale[axis_letter] < 5 || axis == 'E') ) {

							child.material.highlight( true );

						} else {

							child.material.highlight( false );

						}

					}

				} );

			};
		}
	};

	THREE.TransformGizmo.prototype.update = function ( rotation, eye ) {

		var vec1 = new THREE.Vector3( 0, 0, 0 );
		var vec2 = new THREE.Vector3( 0, 1, 0 );
		var lookAtMatrix = new THREE.Matrix4();
		let inv;
		if (this instanceof THREE.TransformGizmoScale) {
			inv = this.getWorldQuaternion(new THREE.Quaternion()).invert();
		}

		this.traverse(child => {

			if ( child.name.search( "E" ) !== - 1 ) {

				child.quaternion.setFromRotationMatrix( lookAtMatrix.lookAt( eye, vec1, vec2 ) );
				if (this instanceof THREE.TransformGizmoScale) {
					child.quaternion.premultiply(inv);
				}

			} else if (
				this instanceof THREE.TransformGizmoRotate &&
				(child.name.search( "X" ) !== - 1 || child.name.search( "Y" ) !== - 1 || child.name.search( "Z" ) !== - 1)
			) {

				child.quaternion.setFromEuler( rotation );

			}

		} );
	};

	THREE.TransformGizmoTranslate = class extends THREE.TransformGizmo {
		constructor() {

			super();
			var arrowGeometry = new THREE.CylinderGeometry( 0, 0.07, 0.2, 12, 1, false );

			let pickerCylinderGeo = new THREE.CylinderGeometry( 0.2, 0, 1, 4, 1, false );

			var lineXGeometry = new THREE.BufferGeometry();
			lineXGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  1, 0, 0 ], 3 ) );
			lineXGeometry.name = 'gizmo_x'

			var lineYGeometry = new THREE.BufferGeometry();
			lineYGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  0, 1, 0 ], 3 ) );
			lineYGeometry.name = 'gizmo_y'

			var lineZGeometry = new THREE.BufferGeometry();
			lineZGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  0, 0, 1 ], 3 ) );
			lineZGeometry.name = 'gizmo_z'

			this.handleGizmos = {
				X: [
					[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.r } ) ), [ 1, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ],
					[ new THREE.Line( lineXGeometry, new GizmoLineMaterial( { color: gizmo_colors.r } ) ) ]
				],
				Y: [
					[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.g } ) ), [ 0, 1, 0 ] ],
					[	new THREE.Line( lineYGeometry, new GizmoLineMaterial( { color: gizmo_colors.g } ) ) ]
				],
				Z: [
					[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.b } ) ), [ 0, 0, 1 ], [ Math.PI / 2, 0, 0 ] ],
					[ new THREE.Line( lineZGeometry, new GizmoLineMaterial( { color: gizmo_colors.b } ) ) ]
				]
			};

			this.pickerGizmos = {
				X: [
					[ new THREE.Mesh( pickerCylinderGeo, pickerMaterial ), [ 0.6, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ]
				],
				Y: [
					[ new THREE.Mesh( pickerCylinderGeo, pickerMaterial ), [ 0, 0.6, 0 ] ]
				],
				Z: [
					[ new THREE.Mesh( pickerCylinderGeo, pickerMaterial ), [ 0, 0, 0.6 ], [ Math.PI / 2, 0, 0 ] ]
				]
			};

			this.setActivePlane = function ( axis, eye ) {

				var tempMatrix = new THREE.Matrix4();
				eye.applyMatrix4( tempMatrix.copy( tempMatrix.extractRotation( this.planes[ "XY" ].matrixWorld ) ).invert() );

				if ( axis === "X" ) {
					this.activePlane = this.planes[ "XY" ];
					if ( Math.abs( eye.y ) > Math.abs( eye.z ) ) this.activePlane = this.planes[ "XZ" ];
				}

				if ( axis === "Y" ) {
					this.activePlane = this.planes[ "XY" ];
					if ( Math.abs( eye.x ) > Math.abs( eye.z ) ) this.activePlane = this.planes[ "YZ" ];
				}

				if ( axis === "Z" ) {
					this.activePlane = this.planes[ "XZ" ];
					if ( Math.abs( eye.x ) > Math.abs( eye.y ) ) this.activePlane = this.planes[ "YZ" ];
				}
			};

			this.init();
		}
	};

	THREE.TransformGizmoScale = class extends THREE.TransformGizmo {
		constructor() {

			super();
			//var arrowGeometry = new THREE.Geometry();
			var arrowGeometry = new THREE.BoxGeometry( 0.15, 0.06, 0.15 );

			var lineXGeometry = new THREE.BufferGeometry();
			lineXGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  1, 0, 0 ], 3 ) );

			var lineYGeometry = new THREE.BufferGeometry();
			lineYGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  0, 1, 0 ], 3 ) );

			var lineZGeometry = new THREE.BufferGeometry();
			lineZGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  0, 0, 1 ], 3 ) );

			let planeGeo = new THREE.PlaneGeometry( 0.3, 0.3 );
			let planePickerGeo = new THREE.PlaneGeometry( 0.4, 0.4 );

			let plane_offset = 0.3;
			
			var CircleGeometry = function ( radius, facing, arc ) {

				var geometry = new THREE.BufferGeometry();
				var vertices = [];
				let points = 16;
				arc = arc ? arc : 1;
				
				for ( var i = 0; i <= points * arc; ++ i ) {

					if ( facing === 'x' ) vertices.push( 0, Math.cos( i / (points/2) * Math.PI ) * radius, Math.sin( i / (points/2) * Math.PI ) * radius );
					if ( facing === 'y' ) vertices.push( Math.cos( i / (points/2) * Math.PI ) * radius, 0, Math.sin( i / (points/2) * Math.PI ) * radius );
					if ( facing === 'z' ) vertices.push( Math.sin( i / (points/2) * Math.PI ) * radius, Math.cos( i / (points/2) * Math.PI ) * radius, 0 );

				}

				geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
				return geometry;

			};

			this.handleGizmos = {
				X: [
					[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.r } ) ), [ 1, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ],
					[ new THREE.Line( lineXGeometry, new GizmoLineMaterial( { color: gizmo_colors.r } ) ) ],

					[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.r } ) ), [ -1, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ],
					[ new THREE.Line( lineXGeometry, new GizmoLineMaterial( { color: gizmo_colors.r } ) ), [ -1, 0, 0 ] ]
				],
				Y: [
					[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.g } ) ), [ 0, 1, 0 ] ],
					[ new THREE.Line( lineYGeometry, new GizmoLineMaterial( { color: gizmo_colors.g} ) ) ],

					[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.g } ) ), [ 0, -1, 0 ] ],
					[ new THREE.Line(lineYGeometry, new GizmoLineMaterial( { color: gizmo_colors.g } ) ), [ 0, -1, 0 ] ]
				],
				Z: [
					[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.b } ) ), [ 0, 0, 1 ], [ Math.PI / 2, 0, 0 ] ],
					[ new THREE.Line( lineZGeometry, new GizmoLineMaterial( { color: gizmo_colors.b } ) ) ],

					[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.b } ) ), [ 0, 0, -1 ], [ Math.PI / 2, 0, 0 ] ],
					[ new THREE.Line( lineZGeometry, new GizmoLineMaterial( { color: gizmo_colors.b } ) ), [ 0, 0, -1 ] ]
				],
				YZ: [
					[ new THREE.Mesh( planeGeo, new GizmoMaterial( { color: gizmo_colors.r, side: THREE.DoubleSide, opacity: 0.5 } ) ), [ 0, plane_offset, plane_offset ], [ 0, Math.PI / 2, 0 ] ],
				],
				XZ: [
					[ new THREE.Mesh( planeGeo, new GizmoMaterial( { color: gizmo_colors.g, side: THREE.DoubleSide, opacity: 0.5 } ) ), [ plane_offset, 0, plane_offset ], [ - Math.PI / 2, 0, 0 ] ],
				],
				XY: [
					[ new THREE.Mesh( planeGeo, new GizmoMaterial( { color: gizmo_colors.b, side: THREE.DoubleSide, opacity: 0.5 } ) ), [ plane_offset, plane_offset, 0 ] ],
				],
				E: [
					[ new THREE.Line( new CircleGeometry( 0.13, 'z', 1 ), new GizmoLineMaterial( { color: gizmo_colors.outline } ) ) ]
				],
			};
			this.handleGizmos.X[2][0].name = 'NX'
			this.handleGizmos.X[3][0].name = 'NX'
			this.handleGizmos.Y[2][0].name = 'NY'
			this.handleGizmos.Y[3][0].name = 'NY'
			this.handleGizmos.Z[2][0].name = 'NZ'
			this.handleGizmos.Z[3][0].name = 'NZ'

			this.pickerGizmos = {
				X: [
					[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0.6, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ],
					[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ -0.6, 0, 0 ], [ 0, 0, Math.PI / 2 ] ]
				],
				Y: [
					[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, 0.6, 0 ] ],
					[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, -0.6, 0 ], [Math.PI / 1, 0, 0 ] ]
				],
				Z: [
					[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, 0, 0.6 ], [ Math.PI / 2, 0, 0 ] ],
					[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, 0, -0.6 ], [ - Math.PI / 2, 0, 0 ] ]
				],
				XY: [
					[ new THREE.Mesh( planePickerGeo, pickerMaterial ), [ plane_offset, plane_offset, 0 ] ]
				],
				YZ: [
					[ new THREE.Mesh( planePickerGeo, pickerMaterial ), [ 0, plane_offset, plane_offset ], [ 0, Math.PI / 2, 0 ] ]
				],
				XZ: [
					[ new THREE.Mesh( planePickerGeo, pickerMaterial ), [ plane_offset, 0, plane_offset ], [ - Math.PI / 2, 0, 0 ] ]
				],
				E: [[ new THREE.Mesh( new THREE.SphereGeometry( 0.2, 0.12, 2, 24 ), pickerMaterial ) ]],
			};
			this.pickerGizmos.X[1][0].name = 'NX'
			this.pickerGizmos.Y[1][0].name = 'NY'
			this.pickerGizmos.Z[1][0].name = 'NZ'

			this.setActivePlane = function ( axis, eye ) {

				var tempMatrix = new THREE.Matrix4();
				eye.applyMatrix4( tempMatrix.copy( tempMatrix.extractRotation( this.planes[ "XY" ].matrixWorld ) ).invert() );

				if ( axis === "X" || axis === "NX" || axis == 'XZ' ) {

					this.activePlane = this.planes[ "XY" ];
					if ( Math.abs( eye.y ) > Math.abs( eye.z ) ) this.activePlane = this.planes[ "XZ" ];
				}
				if ( axis === "Y" || axis === "NY" || axis == 'YZ' ) {

					this.activePlane = this.planes[ "XY" ];
					if ( Math.abs( eye.x ) > Math.abs( eye.z ) ) this.activePlane = this.planes[ "YZ" ];
				}
				if ( axis === "Z" || axis === "NZ" || axis == 'YZ' ) {

					this.activePlane = this.planes[ "XZ" ];
					if ( Math.abs( eye.x ) > Math.abs( eye.y ) ) this.activePlane = this.planes[ "YZ" ];
				}
				if ( axis === "E" ) {

					this.activePlane = this.planes[ "XYZE" ];
				}
			};
			this.init();
		}
	};

	THREE.TransformGizmoRotate = class extends THREE.TransformGizmo {
		constructor() {

			super();
			var CircleGeometry = function ( radius, facing, arc ) {

				var geometry = new THREE.BufferGeometry();
				var vertices = [];
				arc = arc ? arc : 1;

				for ( var i = 0; i <= 64 * arc; ++ i ) {

					if ( facing === 'x' ) vertices.push( 0, Math.cos( i / 32 * Math.PI ) * radius, Math.sin( i / 32 * Math.PI ) * radius );
					if ( facing === 'y' ) vertices.push( Math.cos( i / 32 * Math.PI ) * radius, 0, Math.sin( i / 32 * Math.PI ) * radius );
					if ( facing === 'z' ) vertices.push( Math.sin( i / 32 * Math.PI ) * radius, Math.cos( i / 32 * Math.PI ) * radius, 0 );

				}

				geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
				return geometry;

			};

			this.handleGizmos = {

				X: [
					[ new THREE.Line( new CircleGeometry( 1, 'x', 0.5 ), new GizmoLineMaterial( { color: gizmo_colors.r } ) ) ],
					[ new THREE.Mesh( new THREE.OctahedronGeometry( 0.06, 0 ), new GizmoLineMaterial( { color: gizmo_colors.r } ) ), [ 0, 0, 0.98 ], null, [ 1, 4, 1 ] ],
				],
				Y: [
					[ new THREE.Line( new CircleGeometry( 1, 'y', 0.5 ), new GizmoLineMaterial( { color: gizmo_colors.g } ) ) ],
					[ new THREE.Mesh( new THREE.OctahedronGeometry( 0.06, 0 ), new GizmoLineMaterial( { color: gizmo_colors.g } ) ), [ 0, 0, 0.98 ], null, [ 4, 1, 1 ] ],
				],
				Z: [
					[ new THREE.Line( new CircleGeometry( 1, 'z', 0.5 ), new GizmoLineMaterial( { color: gizmo_colors.b } ) ) ],
					[ new THREE.Mesh( new THREE.OctahedronGeometry( 0.06, 0 ), new GizmoLineMaterial( { color: gizmo_colors.b } ) ), [ 0.98, 0, 0 ], null, [ 1, 4, 1 ] ],
				],

				E: [
					[ new THREE.Line( new CircleGeometry( 1.2, 'z', 1 ), new GizmoLineMaterial( { color: gizmo_colors.outline } ) ) ]
				],
				XYZE: [[ new THREE.Line( new CircleGeometry( 1, 'z', 1 ), new GizmoLineMaterial( { color: gizmo_colors.grid } ) ) ]]

			};

			this.pickerGizmos = {

				X: [[ new THREE.Mesh( new THREE.TorusGeometry( 1, 0.12, 4, 12, Math.PI ), pickerMaterial ), [ 0, 0, 0 ], [ 0, - Math.PI / 2, - Math.PI / 2 ] ]],
				Y: [[ new THREE.Mesh( new THREE.TorusGeometry( 1, 0.12, 4, 12, Math.PI ), pickerMaterial ), [ 0, 0, 0 ], [ Math.PI / 2, 0, 0 ] ]],
				Z: [[ new THREE.Mesh( new THREE.TorusGeometry( 1, 0.12, 4, 12, Math.PI ), pickerMaterial ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ]],
				E: [[ new THREE.Mesh( new THREE.TorusGeometry( 1.2, 0.12, 2, 24 ), pickerMaterial ) ]],

			};

			this.setActivePlane = function ( axis ) {

				if ( axis === "E" ) this.activePlane = this.planes[ "XYZE" ];

				if ( axis === "X" ) this.activePlane = this.planes[ "YZ" ];

				if ( axis === "Y" ) this.activePlane = this.planes[ "XZ" ];

				if ( axis === "Z" ) this.activePlane = this.planes[ "XY" ];

			};

			this.update = function ( rotation, eye2 ) {

				THREE.TransformGizmo.prototype.update.apply( this, arguments );

				var tempMatrix = new THREE.Matrix4();
				var worldRotation = new THREE.Euler( 0, 0, 1 );
				var tempQuaternion = new THREE.Quaternion();
				var unitX = new THREE.Vector3( 1, 0, 0 );
				var unitY = new THREE.Vector3( 0, 1, 0 );
				var unitZ = new THREE.Vector3( 0, 0, 1 );
				var quaternionX = new THREE.Quaternion();
				var quaternionY = new THREE.Quaternion();
				var quaternionZ = new THREE.Quaternion();
				var eye = eye2.clone();

				worldRotation.copy( this.planes[ "XY" ].rotation );
				tempQuaternion.setFromEuler( worldRotation );

				tempMatrix.makeRotationFromQuaternion( tempQuaternion ).copy( tempMatrix ).invert();
				eye.applyMatrix4( tempMatrix );

				this.traverse( function( child ) {


					tempQuaternion.setFromEuler( worldRotation );


					if ( child.name === "X" ) {

						quaternionX.setFromAxisAngle( unitX, Math.atan2( - eye.y, eye.z ) );
						tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionX );
						child.quaternion.copy( tempQuaternion );

					}

					if ( child.name === "Y" ) {

						quaternionY.setFromAxisAngle( unitY, Math.atan2( eye.x, eye.z ) );
						tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionY );
						child.quaternion.copy( tempQuaternion );

					}

					if ( child.name === "Z" ) {

						quaternionZ.setFromAxisAngle( unitZ, Math.atan2( eye.y, eye.x ) );
						tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionZ );
						child.quaternion.copy( tempQuaternion );

					}

				} );

			};

			this.init();
		}
	};

	THREE.TransformGizmoSplineHandle = class extends THREE.TransformGizmo {
		constructor(spline, hKey, isTilt = false) {
			super();
			let arrowGeometry = new THREE.BoxGeometry( 0.1, 0.1, 0.1 );
			let pickerGeometry = new THREE.BoxGeometry( 0.15, 0.15, 0.15 );

			this.spline = spline;
			this.handle = this.spline.handles[hKey];
			let joint = this.spline.vertices[this.handle.joint];
			let ctrl1 = this.spline.vertices[this.handle.control1];
			let ctrl2 = this.spline.vertices[this.handle.control2];

			function getHandleColor() {
				let colors = {
					"free": gizmo_colors.spline_handle_free,
					"mirrored": gizmo_colors.spline_handle_mirrored,
					"aligned": gizmo_colors.spline_handle_aligned,
				}
		
				return colors[!BarItems.spline_handle_mode ? "aligned" : BarItems.spline_handle_mode.value];
			}

			// Gather control point transform data, primarily to orient the handleGizmos correctly
			function getHandleEuler() {
				// First matrix, which will give us your general control orient, and basis to properly orient the handle
				let jointPos = new THREE.Vector3().fromArray(joint);
				let ctrl1Pos = new THREE.Vector3().fromArray(ctrl1);
				let ctrl2Pos = new THREE.Vector3().fromArray(ctrl2);
				let mat41 = new THREE.Matrix4().lookAt(jointPos, ctrl1Pos, new THREE.Vector3(0, 1, 0));
				let mat42 = new THREE.Matrix4().lookAt(ctrl2Pos, jointPos, new THREE.Vector3(0, 1, 0));

				// Matrix to fix the orientation of the previous one
				let reOrientMat4 = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
				mat41.multiply(reOrientMat4);
				mat42.multiply(reOrientMat4);

				// Rotations
				let quaternion1 = new THREE.Quaternion().setFromRotationMatrix(mat41);
				let quaternion2 = new THREE.Quaternion().setFromRotationMatrix(mat42);
				let euler1 = new THREE.Euler().setFromQuaternion(quaternion1);
				let euler2 = new THREE.Euler().setFromQuaternion(quaternion2);
				let finalEuler = [
					(euler1.x + euler2.x) / 2, 
					(euler1.y + euler2.y) / 2, 
					(euler1.z + euler2.z) / 2
				];

				return finalEuler;

			}

			let lineCtrl1Geometry = new THREE.BufferGeometry();
			let lineCtrl2Geometry = new THREE.BufferGeometry();
			let lineTiltGeometry = new THREE.BufferGeometry();
			lineCtrl1Geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ ...joint, ...ctrl1 ], 3 ) );
			lineCtrl2Geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ ...joint, ...ctrl2 ], 3 ) );
			lineTiltGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ ...ctrl1, ...joint, ...ctrl2 ], 3 ) );
			
			let mat = () => new GizmoMaterial( { color: () => getHandleColor() } );
			let lineMat = () => new GizmoLineMaterial( { color: () => getHandleColor()} );
			let tiltMat = () => new GizmoMaterial( { color: new THREE.Color(0xffffff) } );

			if (!isTilt) { 
				this.handleGizmos = {
					C1: [
						[ new THREE.Mesh( arrowGeometry, mat() ), ctrl1 ],
						[ new THREE.Line( lineCtrl1Geometry, lineMat() ) ],
					],
					C2: [
						[ new THREE.Mesh( arrowGeometry, mat() ), ctrl2 ],
						[ new THREE.Line( lineCtrl2Geometry, lineMat() ) ],
					],
					J: [
						[ new THREE.Mesh( arrowGeometry, mat() ), joint ]
					]
				};

				this.pickerGizmos = {
					C1: [ [ new THREE.Mesh( pickerGeometry, pickerMaterial ), ctrl1  ] ],
					C2: [ [ new THREE.Mesh( pickerGeometry, pickerMaterial ), ctrl2  ] ],
					J: [ [ new THREE.Mesh( pickerGeometry, pickerMaterial ), joint ] ]
				};
			} 
			else { 
				this.handleGizmos = {
					T: [ 
						[ new THREE.Mesh( new THREE.TorusGeometry( 0.5, 0.02, 4, 32, Math.PI * 2 ), tiltMat() ), joint, getHandleEuler() ],
						[ new THREE.Line( lineTiltGeometry, tiltMat() ) ]
					]
				};

				this.pickerGizmos = {
					T: [ [ new THREE.Mesh( new THREE.TorusGeometry( 0.5, 0.12, 4, 12, Math.PI * 2 ), pickerMaterial ), joint, getHandleEuler() ] ]
				};
			}

			this.setActivePlane = function ( axis, eye ) {
				if ( axis === "C1" || axis === "C2" ) {
					this.activePlane = planes[ "XYZE" ];
				}
			};

			this.setHandleScale = function(scale) {
				// What's below might be a little dirty, need to see if it can be improved
				// I'm essentially doing a second init(), but only for scaling. Since I can't affort to scale the entire Gizmo object
				for (let name in this.handleGizmos) {
					if (name == "E") break;
					let object = this.handleGizmos[name][0][0];
					let position = this.handleGizmos[name][0][1];

					object.geometry.center();
					object.scale.set(scale, scale, scale);
					object.geometry.translate(position[0] / scale, position[1] / scale, position[2] / scale);
				}

				for (let name in this.pickerGizmos) {
					let object = this.pickerGizmos[name][0][0];
					let position = this.pickerGizmos[name][0][1];

					object.geometry.center();
					object.scale.set(scale, scale, scale);
					object.geometry.translate(position[0] / scale, position[1] / scale, position[2] / scale);
				}
			};

			this.select = function() {
				let selection = Project.spline_selection[spline.uuid]?.vertices || [];
				let ctrl1Selected = selection.includes(this.handle.control1);
				let jointSelected = selection.includes(this.handle.joint);
				let ctrl2Selected = selection.includes(this.handle.control2);

				this.traverse(function(child) {
					if (child.material && child.material.select ) {
						if (child.name == "C1") child.material.select(ctrl1Selected);
						if (child.name == "J") child.material.select(jointSelected);
						if (child.name == "C2") child.material.select(ctrl2Selected);
					}
				});
			};

			this.highlight = function(axis, matching_index) {
				this.traverse(function(child) {
					if ( child.material && child.material.highlight && matching_index ) {
						if (child.name == axis) {
							child.material.highlight(true);
						} else {
							child.material.highlight(false);
						}
					}
				});
			};

			this.init();
		}
	};

	THREE.TransformControls = class extends THREE.Object3D {
		constructor( cam, domElement ) {

			super();

			domElement = ( domElement !== undefined ) ? domElement : document;

			this.camera = cam
			this.elements = [];
			this.visible = false;
			this.space = "world";
			this.size = 1;
			this.axis = null;
			this.hoverAxis = null;
			this.direction = true;
			this.last_valid_position = new THREE.Vector3();
			this.rotation_selection = new THREE.Euler();
			this.spline_handles = [];

			this.firstLocation = [0,0,0]


			var scope = this;

			var _mode = "translate";
			var _dragging = false;
			var _has_groups = false;
			var _gizmo = {
				"translate": new THREE.TransformGizmoTranslate(),
				"scale": new THREE.TransformGizmoScale(),
				"rotate": new THREE.TransformGizmoRotate(),
				"stretch": new THREE.TransformGizmoScale(),
			};

			for ( var type in _gizmo ) {
				var gizmoObj = _gizmo[ type ];

				gizmoObj.visible = ( type === _mode );
				this.add( gizmoObj );
			}
			this.pivot_marker = new THREE.Mesh(
				new THREE.IcosahedronGeometry(0.08),
				new THREE.MeshBasicMaterial()
			)
			this.pivot_marker.material.depthTest = false;
			this.pivot_marker.material.depthWrite = false;
			this.pivot_marker.material.side = THREE.FrontSide;
			this.pivot_marker.material.transparent = true;
			this.pivot_marker.material.color = gizmo_colors.outline;
			this.children[0].add(this.pivot_marker)

			//Adjust GIzmos
			this.traverse((kid) => {
				kid.renderOrder = 999
			})
			this.children[2].children[0].children[6].renderOrder -= 9
			this.children[2].scale.set(0.8, 0.8, 0.8)

			//Vars
				var changeEvent = { type: "change" };
				var mouseDownEvent = { type: "mouseDown" };
				var mouseUpEvent = { type: "mouseUp", mode: _mode };
				var objectChangeEvent = { type: "objectChange" };

				var ray = new THREE.Raycaster();
				var pointerVector = new THREE.Vector2();

				var point = new THREE.Vector3();
				var originalPoint = new THREE.Vector3();
				var offset = new THREE.Vector3();
				var scale = 1;
				var eye = new THREE.Vector3();

				var tempMatrix = new THREE.Matrix4();
				var originalValue = null;
				var previousValue = 0;

				var worldPosition = new THREE.Vector3();
				var worldRotation = new THREE.Euler();
				var camPosition = new THREE.Vector3();

				var spline_handle_index = 0;


			this.attach = function ( object ) {
				this.elements.safePush(object);
				this.visible = true;
			};

			this.detach = function () {
				this.elements.length = 0
				this.visible = false;
				this.axis = null;
				this.hoverAxis = null;
			};
			this.setMode = function ( mode ) {
				if (mode === 'hidden') {
					return;
				}
				_mode = mode||_mode;
				if ( _mode === "scale" ) scope.space = "local";
				for ( var type in _gizmo ) {
					_gizmo[ type ].visible = (type === _mode) && (BarItems.spline_selection_mode.value == 'object' || Project.spline_selection.length);
				}
				if (mode == 'translate') {
					this.pivot_marker.visible = Toolbox.selected.visible = Toolbox.selected.id == 'pivot_tool';
				}

				this.update();
				scope.dispatchEvent( changeEvent );
			};
			this.setSize = function ( size ) {

				scope.size = size;
				this.update();
				scope.dispatchEvent( changeEvent );
			};
			this.setSpace = function ( space ) {
				scope.space = space;
				this.update();
				scope.dispatchEvent(changeEvent);
			};
			this.getScale = function() {

				Transformer.camera.updateMatrixWorld();
				camPosition.setFromMatrixPosition( Transformer.camera.matrixWorld );

				return Transformer.camera.preview.calculateControlScale(worldPosition) * settings.control_size.value * 0.74;
			}
			this.setScale = function(sc) {
				Transformer.scale.set(sc,sc,sc)
			}
			this.update = function (object) {
				var scope = Transformer;

				if (BarItems.spline_selection_mode && scope.spline_handles.length) {
					for ( var type in _gizmo ) {
						var gizmoObj = _gizmo[ type ];
						let spline = scope.spline_handles[0].spline;
						let cond = BarItems.spline_selection_mode.value == 'object';
						if (Project.spline_selection) {
							let selected = Project.spline_selection[spline.uuid];
							if (selected) cond ||= selected.vertices;
						}

						gizmoObj.visible = (type === _mode) && cond;
					}
				}

				if (!object) {
					object = this.rotation_ref;
				}
				if (scope.elements.length == 0) {
					this.detach()
				}
				this.getWorldPosition(worldPosition)
				this.setScale(this.getScale()); 
				
				// Fix transform for spline gizmos. Since they're supposed to 
				// render on the spline object, not at the origin of the selection
				this.spline_handles.forEach(gizmo => {
					// Cancel out controller scale
					let scale = this.getScale();
					gizmo.scale.set(1 / scale, 1 / scale, 1 / scale);
					gizmo.setHandleScale(scale);

					// properly position this fella in the world
					let cancelledPos = new THREE.Vector3().copy(worldPosition).multiplyScalar(-1).multiplyScalar(1 / scale);
					let splinePos = gizmo.spline.position;
					splinePos = new THREE.Vector3(splinePos[0], splinePos[1], splinePos[2]).multiplyScalar(1 / scale);
					gizmo.position.copy(cancelledPos.add(splinePos));

					// Properly orient this too, since our splines aren't always aligned to the world axis
					let splineRot = gizmo.spline.rotation;
					splineRot = new THREE.Euler(Math.degToRad(splineRot[0]), Math.degToRad(splineRot[1]), Math.degToRad(splineRot[2]));
					gizmo.rotation.copy(splineRot);

					// Update our goober
					gizmo.update( worldRotation, eye );
				})

				
				_gizmo.rotate.children[0].children[6].visible = !(Format && Format.rotation_limit && Modes.edit);

				// Origin
				let scale = scope.camera.preview.calculateControlScale(Canvas.pivot_marker.getWorldPosition(new THREE.Vector3())) * settings.origin_size.value * 0.2;
				Canvas.pivot_marker.scale.set( scale, scale, scale );
				if (Canvas.pivot_marker.base_scale) {
					Canvas.pivot_marker.scale.multiply(Canvas.pivot_marker.base_scale);
				}
				
				// Update Eye Position
				if ( scope.camera instanceof THREE.PerspectiveCamera ) {
					eye.copy( camPosition ).sub( worldPosition ).normalize();
				} else if ( scope.camera instanceof THREE.OrthographicCamera ) {
					eye.copy( camPosition ).normalize();
				}

				if (scope.elements.length == 0) return;

				if (object) {
					if (!this.dragging) worldRotation.setFromRotationMatrix( tempMatrix.extractRotation( object.matrixWorld ) );
					if (Toolbox.selected.transformerMode === 'rotate') {
						_gizmo[ _mode ].update( worldRotation, eye );
						this.rotation.set(0, 0, 0);
					} else if (Toolbox.selected.transformerMode === 'scale' || Toolbox.selected.transformerMode === 'stretch') {
						_gizmo[ _mode ].update( worldRotation, eye );
						object.getWorldQuaternion(this.rotation)
					} else {
						object.getWorldQuaternion(this.rotation)
					}
					if (this.rotation_selection.x || this.rotation_selection.y || this.rotation_selection.z) {
						let q = Reusable.quat1.setFromEuler(this.rotation_selection);
						this.quaternion.multiply(q);
						worldRotation.setFromQuaternion(this.quaternion);
					}

				} else {
					worldRotation.set(0, 0, 0);
					this.rotation.set(0, 0, 0);
					_gizmo[ _mode ].update( worldRotation, eye );
				}
				_gizmo[ _mode ].highlight( scope.axis );

				scope.spline_handles.forEach(gizmo => {
					let idMatch = (scope.spline_handle_index == scope.spline_handles.indexOf(gizmo));
					gizmo.highlight( scope.axis, idMatch );
					gizmo.select();
				})
			};
			this.fadeInControls = function(frames) {
				if (!frames || typeof frames !== 'number') frames = 10
				var scope = Transformer;
				scale = this.getScale()
				var old_scale = Transformer.scale.x
				var diff = (scale - old_scale) / frames

				var i = 0;
				var interval = setInterval(function() {
					i++;
					Transformer.setScale(old_scale + i*diff)
					if (i >= frames) {
						clearInterval(interval)
					}
				}, 16)
			}
			this.setCanvas = function(canvas) {
				if (this.canvas) {
					this.canvas.removeEventListener( "mousedown", onPointerDown );
					this.canvas.removeEventListener( "touchstart", onPointerDown );

					this.canvas.removeEventListener( "mousemove", onPointerHover );
					this.canvas.removeEventListener( "touchmove", onPointerHover );

				}
				this.canvas = canvas;
				this.canvas.addEventListener( "mousedown", onPointerDown, false );
				this.canvas.addEventListener( "touchstart", onPointerDown, {passive: true} );

				this.canvas.addEventListener( "mousemove", onPointerHover, false );
				this.canvas.addEventListener( "touchmove", onPointerHover, {passive: true} );
				

			}
			this.setCanvas(domElement)
			this.simulateMouseDown = function(e) {
				onPointerDown(e)
			}

			this.updateSelection = function() {
				this.elements.empty()
				let prevSpline;
				if (Toolbox.selected && Toolbox.selected.transformerMode !== 'hidden') {
					if (Modes.edit || Modes.pose || Toolbox.selected.id == 'pivot_tool') {
						// This might not be tyhe best place to do this, but it works for now
						if (SplineMesh.hasSelected() && (BarItems.spline_selection_mode.value == 'handles' || BarItems.spline_selection_mode.value == 'tilt')) {
							let spline = SplineMesh.selected[0];

							if (prevSpline !== spline) {
								this.remove(...this.spline_handles);
								this.spline_handles.empty();
							}

							for (let hKey of Object.keys(spline.handles)) {
								this.spline_handles.push(new THREE.TransformGizmoSplineHandle(spline, hKey, BarItems.spline_selection_mode.value == 'tilt'));
							}

							this.add(...this.spline_handles);
							scope.attach(spline);
							prevSpline = spline;
						} else if (Outliner.selected.length) {
							Outliner.selected.forEach(element => {
								if (
									(element.getTypeBehavior('movable') && Toolbox.selected.transformerMode == 'translate') ||
									((element.getTypeBehavior('resizable')) && (Toolbox.selected.transformerMode == 'scale' || Toolbox.selected.transformerMode == 'stretch')) ||
									(element.getTypeBehavior('rotatable') && Toolbox.selected.transformerMode == 'rotate')
								) {
									scope.attach(element);
								}
							})
						} else if (Group.first_selected && getRotationObjects()?.equals(Group.multi_selected)) {
							scope.attach(Group.first_selected)
						} else {
							this.update()
							return this;
						}
					}
					this.center()
				}
				if (prevSpline !== SplineMesh.selected[0]) {
					this.remove(...this.spline_handles);
					this.spline_handles.empty();
				}

				this.update()
				return this;
			}
			var display_gui_rotation = new THREE.Object3D();
			display_gui_rotation.rotation.set(0.2, 0.2, 0);
			display_gui_rotation.updateMatrixWorld();

			this.getTransformSpace = function() {
				var rotation_tool = Toolbox.selected.id === 'rotate_tool' || Toolbox.selected.id === 'pivot_tool'
				if (!selected.length && (!Group.first_selected || !Format.bone_rig)) return;

				let input_space;
				switch (Toolbox.selected.id) {
					case 'rotate_tool': input_space = BarItems.rotation_space.get(); break;
					case 'pivot_tool': input_space = BarItems.transform_pivot_space.get(); break;
					case 'move_tool': default: input_space = BarItems.transform_space.get(); break;
				}

				if (Toolbox.selected == BarItems.rotate_tool && Format.rotation_limit) return 2;

				if (input_space == 'local' && selected.length && selected[0].getTypeBehavior('rotatable') && (!Format.bone_rig || !Group.first_selected)) {
					let is_local = true;
					if (Format.bone_rig) {
						for (var el of selected) {
							if (el.parent !== selected[0].parent) {
								is_local = false;
								break;
							}
						}
					}
					if (is_local) {
						for (var el of selected) {
							if (el.rotation !== selected[0].rotation &&
							!(el.rotation instanceof Array && el.rotation.equals(selected[0].rotation))
							) {
								is_local = false;
								break;
							}
						}
					}
					if (is_local) return 2;
				}
				if (input_space === 'local' && Format.bone_rig && Group.first_selected) {
					// Group local Space
					return 2;
				}
				if (input_space === 'normal' && Mesh.selected.length) {
					// Local Space
					return 3;
				}
				if (input_space !== 'global' && Format.bone_rig) {
					// Bone Space
					if (Format.bone_rig && Group.first_selected && Group.first_selected.matchesSelection()) {
						if (Group.first_selected.parent instanceof Group) {
							return Group.first_selected.parent;
						} else {
							return 0;
						}
					}
					let bone = 0;
					if (Outliner.selected.length) {
						bone = Outliner.selected[0].parent;
					} else if (Group.first_selected && Group.first_selected.parent instanceof Group) {
						bone = Group.first_selected.parent;
					}
					for (var el of Outliner.selected) {
						if (el.parent !== bone) {
							bone = 0;
							break;
						}
					}
					return bone instanceof Group ? bone : 0;
				}
				// Global Space
				return 0;
			}

			this.center = function() {
				delete Transformer.rotation_ref;
				if (!scope.dragging) Transformer.rotation_selection.set(0, 0, 0);
				if (Modes.edit || Modes.pose || Toolbox.selected.id == 'pivot_tool') {
					if (Transformer.visible) {
						let rotation_tool = Toolbox.selected.id === 'rotate_tool' || Toolbox.selected.id === 'pivot_tool'
						let rotation_object = getRotationObjects()
						if (rotation_object instanceof Array || (!rotation_object && !rotation_tool)) {
							let arr = rotation_object instanceof Array ? rotation_object : Outliner.selected;
							rotation_object = undefined;
							for (let obj of arr) {
								if (obj.visibility !== false) {
									rotation_object = obj;
									break;
								}
							}
						}
						if (!rotation_object) {
							this.detach();
							return;
						}
						this.rotation_object = rotation_object;
						
						//Center
						if (Toolbox.selected.id === 'rotate_tool' || Toolbox.selected.id === 'pivot_tool') {
							if ((rotation_object instanceof Mesh && Toolbox.selected.id === 'rotate_tool' &&
								Project.mesh_selection[rotation_object.uuid] && (
									Project.mesh_selection[rotation_object.uuid].vertices.length > 0 ||
									Project.mesh_selection[rotation_object.uuid].edges.length > 0 ||
									Project.mesh_selection[rotation_object.uuid].faces.length > 0
								)) || 
								(rotation_object instanceof SplineMesh && Toolbox.selected.id === 'rotate_tool' &&
								Project.spline_selection[rotation_object.uuid] && 
								Project.spline_selection[rotation_object.uuid].vertices.length > 0)
							) {
								this.position.copy(rotation_object.getWorldCenter())
							} else if (rotation_object.mesh) {
								rotation_object.mesh.getWorldPosition(this.position);
							} else {
								this.position.copy(rotation_object.getWorldCenter());
							}
							Transformer.position.sub(scene.position);
						} else {
							var center = getSelectionCenter()
							Transformer.position.fromArray(center)
						}

						let space = Transformer.getTransformSpace();
						//Rotation
						if (space >= 2 || Toolbox.selected.id == 'resize_tool' || Toolbox.selected.id == 'stretch_tool') {
							Transformer.rotation_ref = (Group.first_selected && Format.bone_rig) ? Group.first_selected.mesh : (selected[0] && selected[0].mesh);
							if (space === 3 && Mesh.selected[0]) {
								let rotation = Mesh.selected[0].getSelectionRotation();
								if (rotation && !scope.dragging) Transformer.rotation_selection.copy(rotation);
							}
						
						} else if (space instanceof Group) {
							Transformer.rotation_ref = space.mesh;

						}
					} else if (Toolbox.selected.id == 'vertex_snap_tool' && (Outliner.selected.length || Group.first_selected)) {
						var center = getSelectionCenter()
						Transformer.position.fromArray(center)
					}

				} else if (Modes.display) {

					Transformer.attach(display_base)

					display_base.getWorldPosition(Transformer.position);
					Transformer.position.sub(scene.position);

					// todo: Fix positions when both rotation pivot and scale pivot are used
					if (Toolbox.selected.transformerMode === 'translate') {
						Transformer.rotation_ref = display_area;

					} else if (Toolbox.selected.transformerMode === 'scale') {
						if (DisplayMode.slot.scale_pivot) {
							let pivot_offset = new THREE.Vector3().fromArray(DisplayMode.slot.scale_pivot).multiplyScalar(-16);
							pivot_offset.x *= DisplayMode.slot.scale[0];
							pivot_offset.y *= DisplayMode.slot.scale[1];
							pivot_offset.z *= DisplayMode.slot.scale[2];
							pivot_offset.applyQuaternion(display_base.getWorldQuaternion(new THREE.Quaternion()));
							Transformer.position.sub(pivot_offset);
						}

						Transformer.rotation_ref = display_base;

					} else if (Toolbox.selected.transformerMode === 'rotate') {
						if (DisplayMode.slot.rotation_pivot) {
							let pivot_offset = new THREE.Vector3().fromArray(DisplayMode.slot.rotation_pivot).multiplyScalar(-16);
							pivot_offset.applyQuaternion(display_base.getWorldQuaternion(new THREE.Quaternion()));
							Transformer.position.sub(pivot_offset);
						}

						if (DisplayMode.display_slot == 'gui') {
							Transformer.rotation_ref = display_gui_rotation;
						}
					}
					Transformer.update()

				} else if (Modes.animate && Group.first_selected) {

					this.attach(Group.first_selected);
					Group.first_selected.mesh.getWorldPosition(this.position);

					if (Toolbox.selected.id === 'rotate_tool' && BarItems.rotation_space.value === 'global') {
						delete Transformer.rotation_ref;

					} else if (Toolbox.selected.id === 'move_tool' && BarItems.transform_space.value === 'global') {
						delete Transformer.rotation_ref;

					} else if (Toolbox.selected.id === 'move_tool' && BarItems.transform_space.value === 'local') {
						Transformer.rotation_ref = Group.first_selected.mesh;

					} else if (Toolbox.selected.id == 'resize_tool' || (Toolbox.selected.id === 'rotate_tool' && BarItems.rotation_space.value !== 'global')) {
						Transformer.rotation_ref = Group.first_selected.mesh;

					} else {
						Transformer.rotation_ref = Group.first_selected.mesh.parent;
					}
				} else if (Modes.animate && (Outliner.selected[0] && Outliner.selected[0].constructor.animator)) {

					this.attach(Outliner.selected[0]);
					this.position.copy(Outliner.selected[0].getWorldCenter(true));
					
					if (BarItems.rotation_space.value === 'global') {
						delete Transformer.rotation_ref;
					} else {
						Transformer.rotation_ref = Outliner.selected[0].mesh.parent;
					}
				}
			}
			this.cancelMovement = function(event, keep_changes = false) {
				onPointerUp(event, keep_changes);
				Undo.cancelEdit(true);
			}
			function displayDistance(number) {
				Blockbench.setCursorTooltip(trimFloatNumber(number));
			}
			function extendTransformLineOnAxis(long, axis) {
				let axisNumber = getAxisNumber(axis);
				if (typeof axisNumber !== 'number') return;
				let main_gizmo = _gizmo[_mode].children[0];

				switch (Toolbox.selected.transformerMode) {
					default:
						var line = main_gizmo.children[axisNumber*2];
						break;
					case 'scale':
					case 'stretch':
						var line = main_gizmo.children[(axisNumber*2 + (scope.direction?1:0)) * 2];
						break;
					case 'rotate':
						var line = Canvas.pivot_marker;
						break;
				}
				line.scale[axis] = long ? 20000 : 1;
				if (Toolbox.selected.transformerMode !== 'rotate') {
					line.position[axis] = long ? -10000 : ((scope.direction || (Toolbox.selected.transformerMode !== 'scale' && Toolbox.selected.transformerMode !== 'stretch'))?0:-1);
				} else {
					line.base_scale[axis] = long ? 20000 : 1;
				}
			}
			function extendTransformLine(long) {
				let axis = scope.axis.substr(-1).toLowerCase();
				let axis2 = scope.axis.length == 2 && scope.axis[0] != 'N' && scope.axis[0].toLowerCase();

				extendTransformLineOnAxis(long, axis);
				if (axis2) extendTransformLineOnAxis(long, axis2);

				_gizmo[ _mode ].highlight( scope.axis );

				scope.spline_handles.forEach(gizmo => {
					let idMatch = (scope.spline_handle_index == scope.spline_handles.indexOf(gizmo));
					gizmo.highlight( scope.axis, idMatch );
				})
			}

			function onPointerHover( event ) {

				if ( scope.elements.length === 0 || ( event.button !== undefined && event.button !== 0 ) ) return;

				var pointer = event.changedTouches ? event.changedTouches[ 0 ] : event;
				var intersect = intersectObjects( pointer, _gizmo[ _mode ].pickers.children );

				for (let spline_gizmo of scope.spline_handles) {
					intersect ||= intersectObjects( pointer, spline_gizmo.pickers.children );
				}

				if (_dragging === true) return;
				scope.hoverAxis = null;

				if ( intersect ) {
					scope.hoverAxis = intersect.object.name;

					let iopp = intersect.object.parent.parent;
					if (iopp instanceof THREE.TransformGizmoSplineHandle) {
						scope.spline_handle_index = scope.spline_handles.indexOf(iopp);
					}
					
					event.preventDefault();
				} else {
				}
				if ( scope.axis !== scope.hoverAxis ) {
					scope.axis = scope.hoverAxis;
					scope.update();
					scope.dispatchEvent( changeEvent );
				}
			}
			function onPointerDown( event ) {
				
				document.addEventListener( "mouseup", onPointerUp, false );

				if ( scope.elements.length === 0 || _dragging === true || ( event.button !== undefined && event.button !== 0  ) ) return;
				var pointer = event.changedTouches ? event.changedTouches[ 0 ] : event;
				if ( pointer.button === 0 || pointer.button === undefined ) {

					var intersect = intersectObjects( pointer, _gizmo[ _mode ].pickers.children ); 
					
					for (let spline_gizmo of scope.spline_handles) {
						intersect ||= intersectObjects( pointer, spline_gizmo.pickers.children );
					}

					if ( intersect ) {
						scope.dragging = true
						document.addEventListener( "touchend", onPointerUp, {passive: true} );
						document.addEventListener( "touchcancel", onPointerUp, {passive: true} );
						document.addEventListener( "touchleave", onPointerUp, {passive: true} );

						document.addEventListener( "mousemove", onPointerMove, false );
						document.addEventListener( "touchmove", onPointerMove, {passive: true} );

						Transformer.getWorldPosition(worldPosition)
						//if (scope.camera.axis && (scope.hoverAxis && scope.hoverAxis.toLowerCase() === scope.camera.axis) === (_mode !== 'rotate')) return;
						event.preventDefault();
						event.stopPropagation();
						scope.dispatchEvent( mouseDownEvent );

						scope.axis = intersect.object.name;
						scope.update();
						eye.copy( camPosition ).sub( worldPosition ).normalize();
						_gizmo[ _mode ].setActivePlane( scope.axis, eye );
						var planeIntersect = intersectObjects( pointer, [ _gizmo[ _mode ].activePlane ] );

						scope.last_valid_position.copy(scope.position)
						scope.hasChanged = false

						if (Toolbox.selected.id === 'resize_tool' || Toolbox.selected.id === 'stretch_tool') {
							scope.direction = scope.axis.substr(0, 1) !== 'N'
						}

						if ( planeIntersect ) {
							offset.copy( planeIntersect.point );
							previousValue = undefined
							if (Toolbox.selected.id !== 'pivot_tool') {
								Canvas.outlineObjects(Outliner.selected);
							}
							extendTransformLine(true);
						}

						// Aza: Most of this should probably not be done here, but this'll do for now
						if (scope.axis == "C1" || scope.axis == "C2" || scope.axis == "J") {
							let gizmo = scope.spline_handles[scope.spline_handle_index];
							let spline = gizmo.spline;
							let handle = gizmo.handle;
							let selection = Project.spline_selection[spline.uuid];
							if (!selection) Project.spline_selection[spline.uuid] = { vertices: [], handles: [] };

							let add = Pressing.shift;

							let vertSelection = Project.spline_selection[spline.uuid]?.vertices || [];
							if (!add) vertSelection.empty();
							if (scope.axis == "C1" && !vertSelection.includes(handle.control1)) vertSelection.push(handle.control1);
							if (scope.axis == "J"  && !vertSelection.includes(handle.joint)) vertSelection.push(handle.control1, handle.joint, handle.control2);
							if (scope.axis == "C2" && !vertSelection.includes(handle.control2)) vertSelection.push(handle.control2);

							scope.center();
							scope.update();
						} else {
							_dragging = true;
						}

						scope.spline_handles.forEach( (gizmo) => {
							gizmo.select();
						})
					}
				}
			}
			function beforeFirstChange(event, point) {
				if (scope.hasChanged) return;

				if (Modes.edit || Modes.pose || Toolbox.selected.id == 'pivot_tool') {

					if (Toolbox.selected.id === 'resize_tool' || Toolbox.selected.id === 'stretch_tool') {
						var axisnr = getAxisNumber(scope.axis.toLowerCase().replace('n', ''));
						selected.forEach(function(obj) {
							if (obj instanceof Mesh || obj instanceof SplineMesh) {
								obj.oldVertices = {};
								for (let key in obj.vertices) {
									obj.oldVertices[key] = obj.vertices[key].slice();
								}
							} else if (obj.getTypeBehavior('resizable')) {
								obj.oldScale = obj.size(axisnr);
								obj.oldStretch = obj.stretch.slice();
								obj.oldUVOffset = obj.uv_offset.slice();
								obj.oldCenter = obj.from.map((from, i) => (from + obj.to[i]) / 2);
							} 
						})
					}
					_has_groups = Format.bone_rig && Group.first_selected && Toolbox.selected.transformerMode == 'translate';
					var rotate_group = Format.bone_rig && Group.first_selected && (Toolbox.selected.transformerMode == 'rotate');

					if (Toolbox.selected.id == 'move_tool') {
						if (Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
							Cube.selected.forEach(function(obj) {
								if (Format.cube_size_limiter.test(obj)) {
									Format.cube_size_limiter.move(obj);
								}
							})
						}
						if (BarItems.proportional_editing.value) {
							Mesh.selected.forEach(mesh => {
								ProportionalEdit.calculateWeights(mesh);
							})
						}
					}

					if (rotate_group) {
						Undo.initEdit({groups: Group.multi_selected})
					} else if (_has_groups) {
						Undo.initEdit({elements: selected, outliner: true, selection: true})
					} else {
						Undo.initEdit({elements: selected})
					}

				} else if (Modes.id === 'animate') {

					if (Timeline.playing) {
						Timeline.pause()
					}
					scope.keyframes = [];
					var animator = Animation.selected.getBoneAnimator();
					if (animator) {

						var {before, result, new_keyframe} = animator.getOrMakeKeyframe(Toolbox.selected.animation_channel);

						Undo.initEdit({keyframes: before ? [before] : []})
						result.select();
						scope.keyframes.push(result);
						if (new_keyframe) scope.keyframes.push(new_keyframe)
					}

				} else if (Modes.id === 'display') {
					Undo.initEdit({display_slots: [DisplayMode.display_slot]})
				}
				scope.firstChangeMade = true
			}
			function onPointerMove( event ) {

				if ( scope.elements.length == 0 || scope.axis === null || _dragging === false || ( event.button !== undefined && event.button !== 0 ) ) return;

				scope.orbit_controls.hasMoved = true
				var pointer = event.changedTouches ? event.changedTouches[ 0 ] : event;
				var planeIntersect = intersectObjects( pointer, [ _gizmo[ _mode ].activePlane ] );
				if (!planeIntersect) return;

				event.stopPropagation();

				var axis = ((scope.direction == false && scope.axis.length == 2) ? scope.axis[1] : scope.axis[0]).toLowerCase();
				var axisNumber = getAxisNumber(axis)
				var rotate_normal;
				var axisB, axisNumberB;

				if (scope.axis.length == 2 && scope.axis[0] !== 'N') {
					axisB = scope.axis[1].toLowerCase()
					axisNumberB = getAxisNumber(axisB)
				}

				point.copy( planeIntersect.point );

				if (Toolbox.selected.transformerMode !== 'rotate') {
					point.sub( offset );
					if (!Modes.display) {
						point.removeEuler(worldRotation)
					}

				} else {

					point.sub( worldPosition );
					point.removeEuler(worldRotation);

					if (scope.axis == 'E') {
						let matrix = new THREE.Matrix4().copy(_gizmo[ _mode ].activePlane.matrix).invert();
						point.applyMatrix4(matrix)
						var angle = Math.radToDeg( Math.atan2( point.y, point.x ) )
						rotate_normal = Preview.selected.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-1);

					} else {
						var rotations = [
							Math.atan2( point.z, point.y ),
							Math.atan2( point.x, point.z ),
							Math.atan2( point.y, point.x )
						]
						var angle = Math.radToDeg( rotations[axisNumber] )
					}
				}
				let transform_space = Transformer.getTransformSpace()

				if (Modes.edit || Modes.pose || Toolbox.selected.id == 'pivot_tool') {

					if (Toolbox.selected.id === 'move_tool') {

						var snap_factor = canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl)
						point[axis] = Math.round( point[axis] / snap_factor ) * snap_factor;


						if (originalValue === null) {
							originalValue = point[axis];
						}
						if (previousValue === undefined) {
							previousValue = point[axis]

						} else if (previousValue !== point[axis]) {
							beforeFirstChange(event)

							var difference = point[axis] - previousValue

							var overlapping = false
							if (Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
								Cube.selected.forEach(function(obj) {
									let from = obj.from.slice();
									let to = obj.to.slice();
									from[axisNumber] += difference;
									to[axisNumber] += difference;
									overlapping = overlapping || Format.cube_size_limiter.test(obj, {from, to});
								})
							}
							if (!overlapping) {
								displayDistance(point[axis] - originalValue);

								moveElementsInSpace(difference, axisNumber)

								updateSelection()
							}
							previousValue = point[axis]
							scope.hasChanged = true
						}
					} else if (Toolbox.selected.id === 'resize_tool') {
						// Resize

						if (axisB) {
							if (axis == 'y') {axis = 'z';} else
							if (axisB == 'y') {axis = 'y';} else
							if (axisB == 'z') {axis = 'x';}
						}
						var snap_factor = canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl)
						let move_value = point[axis];
						if (axis == 'e') move_value = point.length() * Math.sign(point.y||point.x);
						move_value = Math.round( move_value / snap_factor ) * snap_factor;

						if (previousValue !== move_value) {
							beforeFirstChange(event)

							selected.forEach(function(obj, i) {
								if (obj.getTypeBehavior('resizable')) {
									let bidirectional = ((event.altKey || Pressing.overrides.alt) && BarItems.swap_tools.keybind.key != 18) !== selected[0] instanceof Mesh;

									if (axis == 'e') {
										let value = move_value;
										obj.resize(value, 0, false, null, true);
										obj.resize(value, 1, false, null, true);
										obj.resize(value, 2, false, null, true);

									} else if (!axisB) {
										obj.resize(move_value, axisNumber, !scope.direction, null, bidirectional);

									} else {
										let value = move_value;
										obj.resize(value, axisNumber, false, null, true);
										obj.resize(value, axisNumberB, false, null, true);
									}
								}
							})
							displayDistance(move_value * (scope.direction ? 1 : -1));
							updateSelection()
							previousValue = move_value
							scope.hasChanged = true
						}

					} else if (Toolbox.selected.id === 'stretch_tool') {
						if (axisB) {
							if (axis == 'y') {axis = 'z';} else
							if (axisB == 'y') {axis = 'y';} else
							if (axisB == 'z') {axis = 'x';}
						}
						var snap_factor = canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl)
						let move_value = point[axis];
						if (axis == 'e') move_value = point.length() * Math.sign(point.y||point.x);
						move_value = Math.round( move_value / snap_factor ) * snap_factor;
						move_value *= (scope.direction ? 1 : -1);

						if (previousValue !== move_value) {
							beforeFirstChange(event)

							selected.forEach(function(obj, i) {
								if (obj.stretch && obj.oldStretch) {
									if (axis == 'e') {
										obj.stretch[0] = obj.oldStretch[0] + move_value;
										obj.stretch[1] = obj.oldStretch[1] + move_value;
										obj.stretch[2] = obj.oldStretch[2] + move_value;
									} else if (!axisB) {
										obj.stretch[axisNumber] = obj.oldStretch[axisNumber] + move_value;
									} else {
										obj.stretch[axisNumber] = obj.oldStretch[axisNumber] + move_value;
										obj.stretch[axisNumberB] = obj.oldStretch[axisNumberB] + move_value;
									}
								}
							})
							displayDistance(move_value);
							Canvas.updatePositions()
							previousValue = move_value
							scope.hasChanged = true
						}
					} else if (Toolbox.selected.id === 'rotate_tool') {

						var snap = getRotationInterval(event)
						angle = Math.round(angle / snap) * snap
						if (Math.abs(angle) > 300) angle = angle > 0 ? -snap : snap;
						if (previousValue === undefined) previousValue = angle
						if (originalValue === null) {
							originalValue = angle;
						}
						if (previousValue !== angle) {
							beforeFirstChange(event)

							var difference = angle - previousValue
							if (axisNumber == undefined) {
								axisNumber = rotate_normal;
							}
							rotateOnAxis(n => (n + difference), axisNumber)
							Canvas.updatePositions(true)
							scope.updateSelection()
							displayDistance(angle - originalValue);
							previousValue = angle
							scope.hasChanged = true
						}
					} else if (Toolbox.selected.id === 'pivot_tool') {

						var snap_factor = canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl)
						point[axis] = Math.round( point[axis] / snap_factor ) * snap_factor;

						if (originalValue === null) {
							originalValue = point[axis];
						}
						if (previousValue === undefined) {
							previousValue = point[axis]

						} else if (previousValue !== point[axis]) {
							beforeFirstChange(event)

							var difference = point[axis] - previousValue
							var origin = Transformer.rotation_object.origin.slice()

							if (transform_space == 0) {
								let vec = new THREE.Vector3();
								var rotation = new THREE.Quaternion();
								vec[axis] = difference;
								Transformer.rotation_object.mesh.parent.getWorldQuaternion(rotation);
								vec.applyQuaternion(rotation.invert());
								origin.V3_add(vec.x, vec.y, vec.z);

							} else if (transform_space == 2) {
								let vec = new THREE.Vector3();
								var rotation = new THREE.Quaternion();
								rotation.copy(Transformer.rotation_object.mesh.quaternion);
								vec[axis] = difference;
								vec.applyQuaternion(rotation);
								origin.V3_add(vec.x, vec.y, vec.z);

							} else {
								origin[axisNumber] += difference;
							}
							
							if (Format.bone_rig && Group.first_selected) {
								for (let group of Group.multi_selected) {
									group.transferOrigin(origin);
								}
							} else {
								selected.forEach(obj => {
									if (obj.transferOrigin) {
										obj.transferOrigin(origin);
									}
								})
							}
							displayDistance(point[axis] - originalValue);
							Canvas.updateView({
								elements: Outliner.selected,
								element_aspects: {geometry: true, transform: true},
								groups: Group.all,
								group_aspects: {transform: true},
								selection: true
							})
							if (Modes.animate) {
								Animator.preview();
							}

							previousValue = point[axis]
							scope.hasChanged = true
						}

					}
				} else if (Modes.animate) {

					if (!Animation.selected) {
						Blockbench.showQuickMessage('message.no_animation_selected')
					}
					if (Toolbox.selected.id === 'rotate_tool') {
						value = Math.trimDeg(axisNumber === 2 ? angle : -angle)
						var round_num = getRotationInterval(event)
					} else {
						value = point[axis]
						if (axis == 'e') value = point.length() * Math.sign(point.y||point.x);
						var round_num = canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl)
						if (Toolbox.selected.id === 'resize_tool') {
							value *= (scope.direction) ? 0.1 : -0.1;
							round_num *= 0.1;
						}
					}
					value = Math.round(value/round_num)*round_num
					if (previousValue === undefined) previousValue = value
					if (originalValue === null) {
						originalValue = value;
					}


					if (value !== previousValue && Animation.selected && Animation.selected.getBoneAnimator()) {
						beforeFirstChange(event, planeIntersect.point)

						var difference = value - (previousValue||0)
						if (Toolbox.selected.id === 'rotate_tool' && Math.abs(difference) > 120) {
							difference = 0;
						}

						let {mesh} = Group.first_selected || ((Outliner.selected[0] && Outliner.selected[0].constructor.animator) ? Outliner.selected[0] : undefined);

						if (Toolbox.selected.id === 'rotate_tool' && (BarItems.rotation_space.value === 'global' || scope.axis == 'E' || (Timeline.selected_animator?.rotation_global && Transformer.getTransformSpace() == 2))) {

							let old_rotation = mesh.pre_rotation ?? mesh.fix_rotation;
							let normal = scope.axis == 'E'
								? rotate_normal
								: axisNumber == 0 ? THREE.NormalX : (axisNumber == 1 ? THREE.NormalY : THREE.NormalZ);
							if (axisNumber != 2) difference *= -1;
							let rotWorldMatrix = new THREE.Matrix4();
							rotWorldMatrix.makeRotationAxis(normal, Math.degToRad(difference))
							rotWorldMatrix.multiply(mesh.matrixWorld)

							if (Timeline.selected_animator?.rotation_global !== true) {
								let inverse = new THREE.Matrix4().copy(mesh.parent.matrixWorld).invert()
								rotWorldMatrix.premultiply(inverse)
							}

							mesh.matrix.copy(rotWorldMatrix)
							mesh.setRotationFromMatrix(rotWorldMatrix)
							let e = mesh.rotation;

							scope.keyframes[0].offset('x', Math.trimDeg( (-Math.radToDeg(e.x - old_rotation.x)) - scope.keyframes[0].calc('x') ));
							scope.keyframes[0].offset('y', Math.trimDeg( (-Math.radToDeg(e.y - old_rotation.y)) - scope.keyframes[0].calc('y') ));
							scope.keyframes[0].offset('z', Math.trimDeg( ( Math.radToDeg(e.z - old_rotation.z)) - scope.keyframes[0].calc('z') ));
						
						} else if (Toolbox.selected.id === 'rotate_tool' && Transformer.getTransformSpace() == 2 && [0, 1, 2].find(axis => axis !== axisNumber && scope.keyframes[0].get(getAxisLetter(axis))) !== undefined) {
							if (axisNumber != 2) difference *= -1;

							let old_rotation = mesh.pre_rotation ?? mesh.fix_rotation;
							let old_order = mesh.rotation.order;
							mesh.rotation.reorder(axisNumber == 0 ? 'ZYX' : (axisNumber == 1 ? 'ZXY' : 'XYZ'))
							var obj_val = Math.trimDeg(Math.radToDeg(mesh.rotation[axis]) + difference);
							mesh.rotation[axis] = Math.degToRad(obj_val);
							mesh.rotation.reorder(old_order);
				
							scope.keyframes[0].offset('x', Math.trimDeg( (-Math.radToDeg(mesh.rotation.x - old_rotation.x)) - scope.keyframes[0].calc('x') ));
							scope.keyframes[0].offset('y', Math.trimDeg( (-Math.radToDeg(mesh.rotation.y - old_rotation.y)) - scope.keyframes[0].calc('y') ));
							scope.keyframes[0].offset('z', Math.trimDeg( ( Math.radToDeg(mesh.rotation.z - old_rotation.z)) - scope.keyframes[0].calc('z') ));
	
						} else if (Toolbox.selected.id === 'move_tool' && BarItems.transform_space.value === 'global') {

							let offset_vec = new THREE.Vector3();
							offset_vec[axis] = difference;
				
							var rotation = new THREE.Quaternion();
							mesh.parent.getWorldQuaternion(rotation);
							offset_vec.applyQuaternion(rotation.invert());
				
							scope.keyframes[0].offset('x', -offset_vec.x);
							scope.keyframes[0].offset('y', offset_vec.y);
							scope.keyframes[0].offset('z', offset_vec.z);
	
						} else if (Toolbox.selected.id === 'move_tool' && BarItems.transform_space.value === 'local') {

							let offset_vec = new THREE.Vector3();
							offset_vec[axis] = difference;
							offset_vec.applyQuaternion(mesh.quaternion);
				
							scope.keyframes[0].offset('x', -offset_vec.x);
							scope.keyframes[0].offset('y', offset_vec.y);
							scope.keyframes[0].offset('z', offset_vec.z);

						} else if (Toolbox.selected.id === 'resize_tool' && axis == 'e') {

							scope.keyframes[0].offset('x', difference);
							if (!scope.keyframes[0].uniform) {
								scope.keyframes[0].offset('y', difference);
								scope.keyframes[0].offset('z', difference);
							}

						} else {
							if (axis == 'x' && Toolbox.selected.id === 'move_tool') {
								difference *= -1
							}
							if (Toolbox.selected.id === 'resize_tool') {
								scope.keyframes[0].uniform = false;	
							}
							scope.keyframes[0].offset(axis, difference);
						}
						scope.keyframes[0].select();
							
						displayDistance(value - originalValue);

						Animator.preview()

						previousValue = value
						scope.hasChanged = true
					}

				} else if (Modes.display) {

					let {display_slot} = DisplayMode;
					var rotation = new THREE.Quaternion()
					scope.getWorldQuaternion(rotation)
					point.applyQuaternion(rotation.invert())

					var channel = Toolbox.selected.animation_channel
					if (channel === 'position') channel = 'translation';
					var value = point[axis]
					if (axis == 'e') value = point.length() * Math.sign(point.y||point.x);
					var bf = (Project.display_settings[display_slot][channel][axisNumber] - (previousValue||0)) || 0;

					if (channel === 'rotation') {
						value = Math.trimDeg(bf + Math.round(angle*4)/4) - bf;
					} else if (channel === 'translation') {
						value = limitNumber( bf+Math.round(value*4)/4, -80, 80) - bf;
					} else /* scale */ {
						value = limitNumber( bf+Math.round(value*64)/(64*8)*(scope.direction ? 1 : -1), 0, 4) - bf;
					}

					if (display_slot.includes('lefthand')) {
						if (channel === 'rotation' && axisNumber) {
							value *= -1
						} else if (channel === 'translation' && !axisNumber) {
							value *= -1
						}
					}
					if (previousValue === undefined) previousValue = value
					if (originalValue === null) {
						originalValue = value;
					}

					if (value !== previousValue) {
						beforeFirstChange(event)

						var difference = value - (previousValue||0);

						if (channel === 'rotation') {
							let normal = Reusable.vec1.copy(scope.axis == 'E'
								? rotate_normal
								: axisNumber == 0 ? THREE.NormalX : (axisNumber == 1 ? THREE.NormalY : THREE.NormalZ));

							let quaternion = display_base.getWorldQuaternion(new THREE.Quaternion()).invert()
							normal.applyQuaternion(quaternion)
							display_base.rotateOnAxis(normal, Math.degToRad(difference))

							Project.display_settings[display_slot][channel][0] = Math.roundTo(Math.radToDeg(display_base.rotation.x), 2);
							Project.display_settings[display_slot][channel][1] = Math.roundTo(Math.radToDeg(display_base.rotation.y) * (display_slot.includes('lefthand') ? -1 : 1), 2);
							Project.display_settings[display_slot][channel][2] = Math.roundTo(Math.radToDeg(display_base.rotation.z) * (display_slot.includes('lefthand') ? -1 : 1), 2);

						} else if (axis == 'e') {
							Project.display_settings[display_slot][channel][0] += difference;
							Project.display_settings[display_slot][channel][1] += difference;
							Project.display_settings[display_slot][channel][2] += difference;

						} else {
							Project.display_settings[display_slot][channel][axisNumber] += difference;
						}

						if ((event.shiftKey || Pressing.overrides.shift) && channel === 'scale') {
							var val = Project.display_settings[display_slot][channel][(axisNumber||0)]
							Project.display_settings[display_slot][channel][((axisNumber||0)+1)%3] = val
							Project.display_settings[display_slot][channel][((axisNumber||0)+2)%3] = val
						}
						DisplayMode.slot.update()

						displayDistance(value - originalValue);

						previousValue = value
						scope.hasChanged = true
					}
				}
				
				scope.dispatchEvent( changeEvent );
				scope.dispatchEvent( objectChangeEvent );
			}
			function onPointerUp( event, keep_changes = true ) {
				//event.preventDefault(); // Prevent MouseEvent on mobile
				document.removeEventListener( "mouseup", onPointerUp );
				scope.dragging = false

				document.removeEventListener( "mousemove", onPointerMove );
				document.removeEventListener( "touchmove", onPointerMove );
				document.removeEventListener( "touchend", onPointerUp );
				document.removeEventListener( "touchcancel", onPointerUp );
				document.removeEventListener( "touchleave", onPointerUp );

				if ( event.button !== undefined && event.button !== 0 && event.button !== 2 ) return;

				if ( _dragging && scope.axis !== null ) {

					mouseUpEvent.mode = _mode;
					scope.dispatchEvent( mouseUpEvent );
					scope.orbit_controls.stopMovement();
					Canvas.outlines.children.length = 0;
					originalValue = null;

					extendTransformLine(false);

					Blockbench.setCursorTooltip();

					if (Modes.id === 'edit' || Modes.id === 'pose' || Toolbox.selected.id == 'pivot_tool') {
						if (Toolbox.selected.id === 'resize_tool' || Toolbox.selected.id === 'stretch_tool') {
							//Scale and stretch
							selected.forEach(function(obj) {
								delete obj.oldScale;
								delete obj.oldStretch;
								delete obj.oldCenter;
								delete obj.oldUVOffset;
							})
							if (scope.hasChanged && keep_changes) {
								if (Toolbox.selected.id === 'resize_tool') {
									Undo.finishEdit('Resize')
								} else if (Toolbox.selected.id === 'stretch_tool') {
									Undo.finishEdit('Stretch')
								}
							}

						} else if (scope.axis !== null && scope.hasChanged && keep_changes) {

							if (Toolbox.selected.id == 'pivot_tool') {
								Undo.finishEdit('Move pivot')
							} else if (Toolbox.selected.id == 'rotate_tool') {
								afterRotateOnAxis();
								Undo.finishEdit('Rotate selection')
							} else {
								Undo.finishEdit('Move selection')
							}
						}
						autoFixMeshEdit()
						updateSelection()

					} else if (Modes.id === 'animate' && scope.keyframes && scope.keyframes.length && keep_changes) {
						Undo.finishEdit('Change keyframe', {keyframes: scope.keyframes})

					} else if (Modes.id === 'display' && keep_changes) {
						Undo.finishEdit('Edit display slot')
					}
				}
				_dragging = false;

				if (scope.hasChanged && Blockbench.startup_count <= 1 && !Blockbench.hasFlag('size_modifier_message')) {
					Blockbench.addFlag('size_modifier_message');
					setTimeout(() => {
						Blockbench.showToastNotification({
							text: 'message.size_modifiers',
							expire: 10000
						});
					}, 5000);
				}

				if ( 'TouchEvent' in window && event instanceof TouchEvent ) {
					// Force "rollover"
					scope.axis = null;
					scope.update();
					scope.dispatchEvent( changeEvent );
				} else {
					onPointerHover( event );
				}
			}
			function intersectObjects( pointer, objects ) {

				var rect = scope.canvas.getBoundingClientRect();
				var x = ( pointer.clientX - rect.left ) / rect.width;
				var y = ( pointer.clientY - rect.top ) / rect.height;

				pointerVector.set( ( x * 2 ) - 1, - ( y * 2 ) + 1 );
				ray.setFromCamera( pointerVector, scope.camera );

				var intersections = ray.intersectObjects( objects, true );
				return intersections[ 0 ] ? intersections[ 0 ] : false;
			}
			this.dispatchPointerHover = onPointerHover;
		}
	};

}() );
