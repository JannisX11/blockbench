/**
 * original author: arodic / https://github.com/arodic
 * modified for Blockbench by jannisx11
 */

( function () {

	'use strict';

	var GizmoMaterial = function ( parameters ) {

		THREE.MeshBasicMaterial.call( this );

		this.depthTest = false;
		this.depthWrite = false;
		this.side = THREE.FrontSide;
		this.transparent = true;

		this.setValues( parameters );

		this.oldColor = this.color.clone();
		this.oldOpacity = this.opacity;

		this.highlight = function( highlighted ) {

			if ( highlighted ) {

				this.color.setHex( parseInt(CustomTheme.data.colors.accent.replace('#', ''), 16) );
				this.opacity = 1;

			} else {

				this.color.copy( this.oldColor );
				this.opacity = this.oldOpacity;

			}

		};
	};
	GizmoMaterial.prototype = Object.create( THREE.MeshBasicMaterial.prototype );
	GizmoMaterial.prototype.constructor = GizmoMaterial;


	var GizmoLineMaterial = function ( parameters ) {

		THREE.LineBasicMaterial.call( this );

		this.depthTest = false;
		this.depthWrite = false;
		this.transparent = true;
		this.linewidth = 1;

		this.setValues( parameters );

		this.oldColor = this.color.clone();
		this.oldOpacity = this.opacity;

		this.highlight = function( highlighted ) {

			if ( highlighted ) {

				this.color.setHex( parseInt(CustomTheme.data.colors.accent.replace('#', ''), 16) );
				this.opacity = 1;

			} else {

				this.color.copy( this.oldColor );
				this.opacity = this.oldOpacity;

			}

		};
	};
	GizmoLineMaterial.prototype = Object.create( THREE.LineBasicMaterial.prototype );
	GizmoLineMaterial.prototype.constructor = GizmoLineMaterial;

	var pickerMaterial = new GizmoMaterial( { visible: false, transparent: false } );

	THREE.TransformGizmo = function () {

		var scope = this;

		this.init = function () {

			THREE.Object3D.call( this );

			this.handles = new THREE.Object3D();
			this.pickers = new THREE.Object3D();
			this.planes = new THREE.Object3D();

			this.add( this.handles );
			this.add( this.pickers );
			this.add( this.planes );

			//// PLANES

			var planeGeometry = new THREE.PlaneBufferGeometry( 50, 50, 2, 2 );
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
					tempGeometry.applyMatrix( child.matrix );
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


					if ( child.name === axis && axis_letter && child.scale[axis_letter] < 5) {

						child.material.highlight( true );

					} else {

						child.material.highlight( false );

					}

				}

			} );

		};
	};

	THREE.TransformGizmo.prototype = Object.create( THREE.Object3D.prototype );
	THREE.TransformGizmo.prototype.constructor = THREE.TransformGizmo;
	THREE.TransformGizmo.prototype.update = function ( rotation, eye ) {

		var vec1 = new THREE.Vector3( 0, 0, 0 );
		var vec2 = new THREE.Vector3( 0, 1, 0 );
		var lookAtMatrix = new THREE.Matrix4();

		this.traverse( function( child ) {

			if ( child.name.search( "E" ) !== - 1 ) {

				child.quaternion.setFromRotationMatrix( lookAtMatrix.lookAt( eye, vec1, vec2 ) );

			} else if ( child.name.search( "X" ) !== - 1 || child.name.search( "Y" ) !== - 1 || child.name.search( "Z" ) !== - 1 ) {

				child.quaternion.setFromEuler( rotation );

			}

		} );
	};

	THREE.TransformGizmoTranslate = function () {

		THREE.TransformGizmo.call( this );

		var arrowGeometry = new THREE.Geometry();
		var mesh = new THREE.Mesh( new THREE.CylinderGeometry( 0, 0.07, 0.2, 12, 1, false ) );
		mesh.position.y = 0.5;
		mesh.updateMatrix();

		arrowGeometry.merge( mesh.geometry, mesh.matrix );

		var lineXGeometry = new THREE.BufferGeometry();
		lineXGeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  1, 0, 0 ], 3 ) );
		lineXGeometry.name = 'gizmo_x'

		var lineYGeometry = new THREE.BufferGeometry();
		lineYGeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  0, 1, 0 ], 3 ) );
		lineYGeometry.name = 'gizmo_y'

		var lineZGeometry = new THREE.BufferGeometry();
		lineZGeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  0, 0, 1 ], 3 ) );
		lineZGeometry.name = 'gizmo_z'

		this.handleGizmos = {
			X: [
				[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.r } ) ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ],
				[ new THREE.Line( lineXGeometry, new GizmoLineMaterial( { color: gizmo_colors.r } ) ) ]
			],
			Y: [
				[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.g } ) ), [ 0, 0.5, 0 ] ],
				[	new THREE.Line( lineYGeometry, new GizmoLineMaterial( { color: gizmo_colors.g } ) ) ]
			],
			Z: [
				[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.b } ) ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ] ],
				[ new THREE.Line( lineZGeometry, new GizmoLineMaterial( { color: gizmo_colors.b } ) ) ]
			]
		};

		this.pickerGizmos = {
			X: [
				[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0.6, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ]
			],
			Y: [
				[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, 0.6, 0 ] ]
			],
			Z: [
				[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, 0, 0.6 ], [ Math.PI / 2, 0, 0 ] ]
			]
		};

		this.setActivePlane = function ( axis, eye ) {

			var tempMatrix = new THREE.Matrix4();
			eye.applyMatrix4( tempMatrix.getInverse( tempMatrix.extractRotation( this.planes[ "XY" ].matrixWorld ) ) );

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
	};
	THREE.TransformGizmoTranslate.prototype = Object.create( THREE.TransformGizmo.prototype );
	THREE.TransformGizmoTranslate.prototype.constructor = THREE.TransformGizmoTranslate;

	THREE.TransformGizmoScale = function () {

		THREE.TransformGizmo.call( this );

		var arrowGeometry = new THREE.Geometry();
		var mesh = new THREE.Mesh( new THREE.BoxGeometry( 0.15, 0.06, 0.15 ) );
		mesh.position.y = 0.5;
		mesh.updateMatrix();

		arrowGeometry.merge( mesh.geometry, mesh.matrix );

		var lineXGeometry = new THREE.BufferGeometry();
		lineXGeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  1, 0, 0 ], 3 ) );

		var lineYGeometry = new THREE.BufferGeometry();
		lineYGeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  0, 1, 0 ], 3 ) );

		var lineZGeometry = new THREE.BufferGeometry();
		lineZGeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  0, 0, 1 ], 3 ) );

		this.handleGizmos = {
			X: [
				[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.r } ) ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ],
				[ new THREE.Line( lineXGeometry, new GizmoLineMaterial( { color: gizmo_colors.r } ) ) ],

				[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.r } ) ), [ -1.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ],
				[ new THREE.Line( lineXGeometry, new GizmoLineMaterial( { color: gizmo_colors.r } ) ), [ -1, 0, 0 ] ]
			],
			Y: [
				[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.g } ) ), [ 0, 0.5, 0 ] ],
				[ new THREE.Line( lineYGeometry, new GizmoLineMaterial( { color: gizmo_colors.g} ) ) ],

				[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.g } ) ), [ 0, -1.5, 0 ] ],
				[ new THREE.Line(lineYGeometry, new GizmoLineMaterial( { color: gizmo_colors.g } ) ), [ 0, -1, 0 ] ]
			],
			Z: [
				[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.b } ) ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ] ],
				[ new THREE.Line( lineZGeometry, new GizmoLineMaterial( { color: gizmo_colors.b } ) ) ],

				[ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: gizmo_colors.b } ) ), [ 0, 0, -1.5 ], [ Math.PI / 2, 0, 0 ] ],
				[ new THREE.Line( lineZGeometry, new GizmoLineMaterial( { color: gizmo_colors.b } ) ), [ 0, 0, -1 ] ]
			]
		};
		this.handleGizmos.X[2][0].name = 'NX'
		this.handleGizmos.X[3][0].name = 'NX'
		this.handleGizmos.Y[2][0].name = 'NY'
		this.handleGizmos.Y[3][0].name = 'NY'
		this.handleGizmos.Z[2][0].name = 'NZ'
		this.handleGizmos.Z[3][0].name = 'NZ'

		this.pickerGizmos = {
			X: [
				[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0.6, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ],
				[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ -0.6, 0, 0 ], [ 0, 0, Math.PI / 2 ] ]
			],
			Y: [
				[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, 0.6, 0 ] ],
				[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, -0.6, 0 ], [Math.PI / 1, 0, 0 ] ]
			],
			Z: [
				[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, 0, 0.6 ], [ Math.PI / 2, 0, 0 ] ],
				[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, 0, -0.6 ], [ - Math.PI / 2, 0, 0 ] ]
			]
		};
		this.pickerGizmos.X[1][0].name = 'NX'
		this.pickerGizmos.Y[1][0].name = 'NY'
		this.pickerGizmos.Z[1][0].name = 'NZ'

		this.setActivePlane = function ( axis, eye ) {

			var tempMatrix = new THREE.Matrix4();
			eye.applyMatrix4( tempMatrix.getInverse( tempMatrix.extractRotation( this.planes[ "XY" ].matrixWorld ) ) );

			if ( axis === "X" || axis === "NX" ) {

				this.activePlane = this.planes[ "XY" ];
				if ( Math.abs( eye.y ) > Math.abs( eye.z ) ) this.activePlane = this.planes[ "XZ" ];
			}
			if ( axis === "Y" || axis === "NY" ) {

				this.activePlane = this.planes[ "XY" ];
				if ( Math.abs( eye.x ) > Math.abs( eye.z ) ) this.activePlane = this.planes[ "YZ" ];
			}
			if ( axis === "Z" || axis === "NZ" ) {

				this.activePlane = this.planes[ "XZ" ];
				if ( Math.abs( eye.x ) > Math.abs( eye.y ) ) this.activePlane = this.planes[ "YZ" ];
			}
		};
		this.init();
	};
	THREE.TransformGizmoScale.prototype = Object.create( THREE.TransformGizmo.prototype );
	THREE.TransformGizmoScale.prototype.constructor = THREE.TransformGizmoScale;

	THREE.TransformGizmoRotate = function () {

		THREE.TransformGizmo.call( this );

		var CircleGeometry = function ( radius, facing, arc ) {

			var geometry = new THREE.BufferGeometry();
			var vertices = [];
			arc = arc ? arc : 1;

			for ( var i = 0; i <= 64 * arc; ++ i ) {

				if ( facing === 'x' ) vertices.push( 0, Math.cos( i / 32 * Math.PI ) * radius, Math.sin( i / 32 * Math.PI ) * radius );
				if ( facing === 'y' ) vertices.push( Math.cos( i / 32 * Math.PI ) * radius, 0, Math.sin( i / 32 * Math.PI ) * radius );
				if ( facing === 'z' ) vertices.push( Math.sin( i / 32 * Math.PI ) * radius, Math.cos( i / 32 * Math.PI ) * radius, 0 );

			}

			geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
			return geometry;

		};

		this.handleGizmos = {

			X: [
				[ new THREE.Line( new CircleGeometry( 1, 'x', 0.5 ), new GizmoLineMaterial( { color: gizmo_colors.r } ) ) ],
				[ new THREE.Mesh( new THREE.OctahedronBufferGeometry( 0.06, 0 ), new GizmoLineMaterial( { color: gizmo_colors.r } ) ), [ 0, 0, 0.98 ], null, [ 1, 4, 1 ] ],
			],
			Y: [
				[ new THREE.Line( new CircleGeometry( 1, 'y', 0.5 ), new GizmoLineMaterial( { color: gizmo_colors.g } ) ) ],
				[ new THREE.Mesh( new THREE.OctahedronBufferGeometry( 0.06, 0 ), new GizmoLineMaterial( { color: gizmo_colors.g } ) ), [ 0, 0, 0.98 ], null, [ 4, 1, 1 ] ],
			],
			Z: [
				[ new THREE.Line( new CircleGeometry( 1, 'z', 0.5 ), new GizmoLineMaterial( { color: gizmo_colors.b } ) ) ],
				[ new THREE.Mesh( new THREE.OctahedronBufferGeometry( 0.06, 0 ), new GizmoLineMaterial( { color: gizmo_colors.b } ) ), [ 0.98, 0, 0 ], null, [ 1, 4, 1 ] ],
			],
			XYZE: [[ new THREE.Line( new CircleGeometry( 1, 'z', 1 ), new GizmoLineMaterial( { color: 0x787878 } ) ) ]]

		};

		this.pickerGizmos = {

			X: [[ new THREE.Mesh( new THREE.TorusBufferGeometry( 1, 0.12, 4, 12, Math.PI ), pickerMaterial ), [ 0, 0, 0 ], [ 0, - Math.PI / 2, - Math.PI / 2 ] ]],
			Y: [[ new THREE.Mesh( new THREE.TorusBufferGeometry( 1, 0.12, 4, 12, Math.PI ), pickerMaterial ), [ 0, 0, 0 ], [ Math.PI / 2, 0, 0 ] ]],
			Z: [[ new THREE.Mesh( new THREE.TorusBufferGeometry( 1, 0.12, 4, 12, Math.PI ), pickerMaterial ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ]]

		};

		this.setActivePlane = function ( axis ) {

			if ( axis === "E" ) this.activePlane = this.planes[ "XYZE" ];

			if ( axis === "X" ) this.activePlane = this.planes[ "YZ" ];

			if ( axis === "Y" ) this.activePlane = this.planes[ "XZ" ];

			if ( axis === "Z" ) this.activePlane = this.planes[ "XY" ];

		};

		this.update = function ( rotation, eye2 ) {

			THREE.TransformGizmo.prototype.update.apply( this, arguments );

			var group = {

				handles: this[ "handles" ],
				pickers: this[ "pickers" ],

			};

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

			tempMatrix.makeRotationFromQuaternion( tempQuaternion ).getInverse( tempMatrix );
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
	};
	THREE.TransformGizmoRotate.prototype = Object.create( THREE.TransformGizmo.prototype );
	THREE.TransformGizmoRotate.prototype.constructor = THREE.TransformGizmoRotate;

	THREE.TransformControls = function ( cam, domElement ) {

		THREE.Object3D.call( this );

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

		this.firstLocation = [0,0,0]


		var scope = this;

		var _mode = "translate";
		var _dragging = false;
		var _has_groups = false;
		var _plane = "XY";
		var _gizmo = {

			"translate": new THREE.TransformGizmoTranslate(),
			"scale": new THREE.TransformGizmoScale(),
			"rotate": new THREE.TransformGizmoRotate()
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


		function updateLayers(obj) {
			if (obj.name.includes('X')) {
				obj.layers.set(4)
			}
			if (obj.name.includes('Y')) {
				obj.layers.set(5)
			}
			if (obj.name.includes('Z')) {
				obj.layers.set(6)
			}
		}
		this.children[0].children[0].children.forEach(updateLayers)
		this.children[1].children[0].children.forEach(updateLayers)

		//Vars
			var changeEvent = { type: "change" };
			var mouseDownEvent = { type: "mouseDown" };
			var mouseUpEvent = { type: "mouseUp", mode: _mode };
			var objectChangeEvent = { type: "objectChange" };

			var ray = new THREE.Raycaster();
			var pointerVector = new THREE.Vector2();

			var point = new THREE.Vector3();
			var offset = new THREE.Vector3();

			var rotation = new THREE.Vector3();
			var offsetRotation = new THREE.Vector3();
			var scale = 1;

			var lookAtMatrix = new THREE.Matrix4();
			var eye = new THREE.Vector3();

			var tempMatrix = new THREE.Matrix4();
			var tempVector = new THREE.Vector3();
			var tempQuaternion = new THREE.Quaternion();
			var unitX = new THREE.Vector3( 1, 0, 0 );
			var unitY = new THREE.Vector3( 0, 1, 0 );
			var unitZ = new THREE.Vector3( 0, 0, 1 );

			var quaternionXYZ = new THREE.Quaternion();
			var quaternionX = new THREE.Quaternion();
			var quaternionY = new THREE.Quaternion();
			var quaternionZ = new THREE.Quaternion();
			var quaternionE = new THREE.Quaternion();

			var oldRotationMatrix = new THREE.Vector4()
			var oldRotationArray = []
			var parentRotationArray = []
			var oldScale = 0;
			var oldScaleTranslation = 0;
			var positionSnapOffset = new THREE.Vector3()
			var originalValue = null;
			var previousValue = 0;
			var tempScale = 1;

			var parentRotationMatrix  = new THREE.Matrix4();

			var worldPosition = new THREE.Vector3();
			var worldRotation = new THREE.Euler();
			var worldRotationMatrix  = new THREE.Matrix4();
			var camPosition = new THREE.Vector3();
			var camRotation = new THREE.Euler();


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
			for ( var type in _gizmo ) _gizmo[ type ].visible = (type === _mode);
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

			var scope = Transformer;
			scope.camera.updateMatrixWorld();
			camPosition.setFromMatrixPosition( scope.camera.matrixWorld );
			//camRotation.setFromRotationMatrix( tempMatrix.extractRotation( scope.camera.matrixWorld ) );
			//eye.copy( camPosition ).sub( worldPosition ).normalize();
			//this.position.copy( worldPosition );
			if ( scope.camera instanceof THREE.PerspectiveCamera ) {

				scale = worldPosition.distanceTo( camPosition )/6
					  * (settings.control_size.value / 20)
					  * (1000 / scope.camera.preview.height);

			} else if ( scope.camera instanceof THREE.OrthographicCamera ) {

				eye.copy( camPosition ).normalize();
				scale = (6 / scope.camera.zoom) * (settings.control_size.value / 20);

			}
			scale *= (1000+scope.camera.preview.height)/2000
			return scale;
		}
		this.setScale = function(sc) {
			Transformer.scale.set(sc,sc,sc)
		}
		this.update = function (object) {
			var scope = Transformer;

			if (!object) {
				object = this.rotation_ref;
			}
			if (scope.elements.length == 0) {
				this.detach()
			}
			this.getWorldPosition(worldPosition)
			this.setScale(this.getScale());

			//Origin
			if ( scope.camera instanceof THREE.PerspectiveCamera ) {

				eye.copy( camPosition ).sub( worldPosition ).normalize();
				scale = rot_origin.getWorldPosition(new THREE.Vector3()).distanceTo( camPosition ) / 16 * (settings.origin_size.value / 20);

			} else if ( scope.camera instanceof THREE.OrthographicCamera ) {

				eye.copy( camPosition ).normalize();
				scale = (6 / scope.camera.zoom) * (settings.origin_size.value / 50);
			}
			rot_origin.scale.set( scale, scale, scale );
			if (rot_origin.base_scale) {
				rot_origin.scale.multiply(rot_origin.base_scale);
			}
			
			if (scope.elements.length == 0) return;

			if (object) {
				worldRotation.setFromRotationMatrix( tempMatrix.extractRotation( object.matrixWorld ) );
				if (Toolbox.selected.transformerMode === 'rotate') {
					_gizmo[ _mode ].update( worldRotation, eye );
					this.rotation.set(0, 0, 0);
				} else {
					object.getWorldQuaternion(this.rotation)
				}

			} else {
				worldRotation.set(0, 0, 0);
				this.rotation.set(0, 0, 0);
				_gizmo[ _mode ].update( worldRotation, eye );
			}
			_gizmo[ _mode ].highlight( scope.axis );
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

				this.canvas.removeEventListener( "mousemove", onPointerMove );
				this.canvas.removeEventListener( "touchmove", onPointerMove );

				this.canvas.removeEventListener( "mouseup", onPointerUp );
				this.canvas.removeEventListener( "mouseout", onPointerUp );
				this.canvas.removeEventListener( "touchend", onPointerUp );
				this.canvas.removeEventListener( "touchcancel", onPointerUp );
				this.canvas.removeEventListener( "touchleave", onPointerUp );
			}
			this.canvas = canvas;
			this.canvas.addEventListener( "mousedown", onPointerDown, false );
			this.canvas.addEventListener( "touchstart", onPointerDown, {passive: true} );

			this.canvas.addEventListener( "mousemove", onPointerHover, false );
			this.canvas.addEventListener( "touchmove", onPointerHover, {passive: true} );

			this.canvas.addEventListener( "mousemove", onPointerMove, false );
			this.canvas.addEventListener( "touchmove", onPointerMove, {passive: true} );

			this.canvas.addEventListener( "mouseup", onPointerUp, false );
			this.canvas.addEventListener( "mouseout", onPointerUp, false );
			this.canvas.addEventListener( "touchend", onPointerUp, {passive: true} );
			this.canvas.addEventListener( "touchcancel", onPointerUp, {passive: true} );
			this.canvas.addEventListener( "touchleave", onPointerUp, {passive: true} );
		}
		this.setCanvas(domElement)
		this.simulateMouseDown = function(e) {
			onPointerDown(e)
		}

		this.updateSelection = function() {
			this.elements.empty()
			if (Modes.edit || Toolbox.selected.id == 'pivot_tool') {
				if (selected.length) {
					selected.forEach(element => {
						if (
							(element.movable && Toolbox.selected.transformerMode == 'translate') ||
							(element.resizable && Toolbox.selected.transformerMode == 'scale') ||
							(element.rotatable && Toolbox.selected.transformerMode == 'rotate')
						) {
							scope.attach(element);
						}
					})
				} else if (Group.selected && getRotationObject() == Group.selected) {
					scope.attach(Group.selected)
				} else {
					return this;
				}
			}
			this.center()
			this.update()
			return this;
		}
		var display_gui_rotation = new THREE.Object3D();
		display_gui_rotation.rotation.set(0.2, 0.2, 0);
		display_gui_rotation.updateMatrixWorld();

		this.center = function() {
			delete Transformer.rotation_ref;
			if (Modes.edit || Toolbox.selected.id == 'pivot_tool') {
				if (Transformer.visible) {
					var rotation_tool = Toolbox.selected.id === 'rotate_tool' || Toolbox.selected.id === 'pivot_tool'
					var rotation_object = getRotationObject()
					if (rotation_object instanceof Array || (!rotation_object && !rotation_tool)) {
						var arr = rotation_object instanceof Array ? rotation_object : selected;
						rotation_object = undefined;
						for (var obj of arr) {
							if (obj.visibility) {
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
					if (Format.bone_rig && !Modes.animate) {
						Canvas.updateAllBones()
					}
					//Center
					if (Toolbox.selected.id === 'rotate_tool' || Toolbox.selected.id === 'pivot_tool') {
						rotation_object.mesh.getWorldPosition(this.position)
						Transformer.position.sub(scene.position);
					} else {
						var center = getSelectionCenter()
						Transformer.position.fromArray(center)
					}

					//Rotation
					if (rotation_tool) {
						Transformer.rotation_ref = rotation_object.mesh.parent;

					} else if (Group.selected && !Blockbench.globalMovement) {
						Transformer.rotation_ref = rotation_object.mesh;

					} else if (Group.selected && Blockbench.globalMovement && Group.selected.parent && Format.bone_rig) {
						Transformer.rotation_ref = Group.selected.parent.mesh;
						
					} else if (!Blockbench.globalMovement && Cube.selected[0] && Cube.selected[0].mesh) {
						Transformer.rotation_ref = Cube.selected[0].mesh;

					} else if (!Blockbench.globalMovement && Locator.selected[0]) {
						Transformer.rotation_ref = Locator.selected[0].parent.mesh;
					}
				}

			} else if (Modes.display) {

				display_scene.add(Transformer)
				Transformer.attach(display_base)

				display_base.getWorldPosition(Transformer.position)

				if (Toolbox.selected.transformerMode === 'translate') {
					Transformer.rotation_ref = display_area;

				} else if (Toolbox.selected.transformerMode === 'scale') {
					Transformer.rotation_ref = display_base;

				} else if (Toolbox.selected.transformerMode === 'rotate' && display_slot == 'gui') {
					Transformer.rotation_ref = display_gui_rotation
				}
				Transformer.update()

			} else if (Modes.animate && Group.selected) {

				this.attach(Group.selected);
				Group.selected.mesh.getWorldPosition(this.position);
				if (Toolbox.selected.id == 'resize_tool') {
					Transformer.rotation_ref = Group.selected.mesh;
				} else if (!Toolbox.selected.id == 'move_tool' || !Group.selected.ik_enabled) {
					Transformer.rotation_ref = Group.selected.mesh.parent;
				}
			}
		}
		function displayDistance(number) {
			Blockbench.setStatusBarText(trimFloatNumber(number));
		}
		function extendTransformLine(long) {

			let axis = scope.axis.substr(-1).toLowerCase();
			let axisNumber = getAxisNumber(axis);
			let main_gizmo = _gizmo[_mode].children[0];

			switch (Toolbox.selected.transformerMode) {
				default:
					var line = main_gizmo.children[axisNumber*2];
					break;
				case 'scale':
					var line = main_gizmo.children[(axisNumber*2 + (scope.direction?1:0)) * 2];
					break;
				case 'rotate':
					var line = rot_origin;
					break;
			}
			line.scale[axis] = long ? 20000 : 1;
			if (Toolbox.selected.transformerMode !== 'rotate') {
				line.position[axis] = long ? -10000 : (scope.direction?0:-1);
			} else {
				line.base_scale[axis] = long ? 20000 : 1;
			}
			_gizmo[ _mode ].highlight( scope.axis );
		}

		function onPointerHover( event ) {

			if ( scope.elements.length === 0 || ( event.button !== undefined && event.button !== 0 ) ) return;

			var pointer = event.changedTouches ? event.changedTouches[ 0 ] : event;
			var intersect = intersectObjects( pointer, _gizmo[ _mode ].pickers.children );
			if (intersect) {
				//scope.dragging = true
			}
			if (_dragging === true) return;
			scope.hoverAxis = null;

			if ( intersect ) {
				scope.hoverAxis = intersect.object.name;
				if (scope.camera.axis && (scope.hoverAxis.toLowerCase() === scope.camera.axis) === (_mode !== 'rotate')) {
					scope.hoverAxis = null;
				}
				event.preventDefault();
			}
			if ( scope.axis !== scope.hoverAxis ) {
				scope.axis = scope.hoverAxis;
				scope.update();
				scope.dispatchEvent( changeEvent );
			}
		}
		function onPointerDown( event ) {

			if ( scope.elements.length === 0 || _dragging === true || ( event.button !== undefined && event.button !== 0  ) ) return;
			var pointer = event.changedTouches ? event.changedTouches[ 0 ] : event;
			if ( pointer.button === 0 || pointer.button === undefined ) {

				var intersect = intersectObjects( pointer, _gizmo[ _mode ].pickers.children );
				if ( intersect ) {
					scope.dragging = true

					Transformer.getWorldPosition(worldPosition)
					if (scope.camera.axis && (scope.hoverAxis && scope.hoverAxis.toLowerCase() === scope.camera.axis) === (_mode !== 'rotate')) return;
					event.preventDefault();
					event.stopPropagation();
					scope.dispatchEvent( mouseDownEvent );

					scope.axis = intersect.object.name;
					scope.update();
					tempScale = 1
					oldScaleTranslation = 0;
					eye.copy( camPosition ).sub( worldPosition ).normalize();
					_gizmo[ _mode ].setActivePlane( scope.axis, eye );
					var planeIntersect = intersectObjects( pointer, [ _gizmo[ _mode ].activePlane ] );

					scope.last_valid_position.copy(scope.position)
					scope.hasChanged = false

					if (Toolbox.selected.id === 'resize_tool') {
						scope.direction = scope.axis.substr(0, 1) !== 'N'
					}

					if ( planeIntersect ) {
						offset.copy( planeIntersect.point );
						previousValue = undefined
						Canvas.outlineObjects(selected)
						extendTransformLine(true);
					}
				}
			}
			_dragging = true;
		}
		function beforeFirstChange(event) {
			if (scope.hasChanged) return;

			if (Modes.edit || Toolbox.selected.id == 'pivot_tool') {

				if (Toolbox.selected.id === 'resize_tool') {
					var axisnr = getAxisNumber(scope.axis.toLowerCase().replace('n', ''))
					selected.forEach(function(obj) {
						if (obj.resizable) {
							obj.oldScale = obj.size(axisnr)
						}
					})
				}
				_has_groups = Format.bone_rig && Group.selected && Group.selected.matchesSelection() && Toolbox.selected.transformerMode == 'translate';
				var rotate_group = Format.bone_rig && Group.selected && (Toolbox.selected.transformerMode == 'rotate' || Toolbox.selected.id == 'pivot_tool');

				if (rotate_group) {
					Undo.initEdit({elements: selected, group: Group.selected})
				} else if (_has_groups) {
					Undo.initEdit({elements: selected, outliner: true})
				} else {
					Undo.initEdit({elements: selected})
				}

			} else if (Modes.id === 'animate') {

				if (Timeline.playing) {
					Timeline.pause()
				}
				scope.keyframes = [];
				var undo_keyframes = [];
				var animator = Animator.selected.getBoneAnimator();
				if (animator && Toolbox.selected.id === 'move_tool' && Group.selected.ik_enabled && Group.selected.ik_chain_length) {
					/*
					var bone = Group.selected;
					for (var i = Group.selected.ik_chain_length; i > 0; i--) {
						bone = bone.parent;
						if (bone instanceof Group) {
							var animator = Animator.selected.getBoneAnimator(bone);
							animator.addToTimeline();
							var {before, result} = animator.getOrMakeKeyframe('rotation');
							scope.keyframes[i-1] = result;
							if (before) undo_keyframes.push(before);
						}
					}
					Undo.initEdit({keyframes: undo_keyframes})

					var solver = new FIK.Structure3D(scene);

					var chain = new FIK.Chain3D();
					var start = new FIK.V3(0, 0, 0);
					var endLoc = new FIK.V3(0, 2, 0);

					var basebone;


					var bones = [];
					var bone = Group.selected;
					for (var i = Group.selected.ik_chain_length; i >= 0; i--) {
						if (bone instanceof Group) {
							bones.push(bone);
							bone = bone.parent;
						}
					}

					bones.reverse();
					var parent_bone;
					bones.forEach((bone, i) => {

						var copy_bone = new THREE.Bone();
						var startPoint = new FIK.V3(0,0,0).copy(bone.mesh.getWorldPosition(new THREE.Vector3()))

						var bone = new FIK.Bone3D(startPoint, startPoint)
						chain.addBone(bone)
						if (!basebone) {
							basebone = bone;
						}
					})


				    //chain.addBone(new FIK.Bone3D(new FIK.V3(1, 2, 0), new FIK.V3(0, 6, 0), undefined, 1, 0x00FF00));
				    //chain.addBone(new FIK.Bone3D(new FIK.V3(0, 6, 0), new FIK.V3(0, 9, 0), undefined, 1, 0x0000FF));
				    var target = new FIK.V3()

				    solver.add(chain, target, true);
				    Transformer.solver = solver

				    /*

					var ik_solver = Transformer.ik_solver = {};


					ik_solver.ik = new THREE.IK();
					ik_solver.chain = new THREE.IKChain();
					ik_solver.target = new THREE.Object3D();
					ik_solver.copy_bones = [];
					scene.add(ik_solver.target)

					var bones = [];
					var bone = Group.selected;
					for (var i = Group.selected.ik_chain_length; i >= 0; i--) {
						if (bone instanceof Group) {
							bones.push(bone);
							bone = bone.parent;
						}
					}
					//build proxy chain
					bones.reverse();
					var parent_bone;
					bones.forEach((bone, i) => {
						var copy_bone = new THREE.Bone();
						if (!ik_solver.root_bone) {
							ik_solver.root_bone = copy_bone;
							bone.mesh.getWorldPosition(copy_bone.position)
						} else {
							parent_bone.add(copy_bone);
							copy_bone.position.z = bone.mesh.position.length();
							parent_bone.quaternion.setFromUnitVectors(new THREE.Vector3().copy(bone.mesh.position).normalize(), THREE.NormalZ);
						}
						ik_solver.chain.add(new THREE.IKJoint(copy_bone), {target: i == bones.length-1 ? ik_solver.target : null});
						copy_bone.original = bone;
						ik_solver.copy_bones.push(copy_bone)
						copy_bone.last_rotation = new THREE.Euler().copy(copy_bone.rotation);
						parent_bone = copy_bone;
					})


					ik_solver.ik.add(ik_solver.chain);
					scene.add(ik_solver.root_bone);
					
					ik_solver.helper = new THREE.IKHelper(ik_solver.ik);
					scene.add(ik_solver.helper);

					setTimeout(_ => ik_solver.ik.solve(), 80)*/



				} else if (animator) {

					var {before, result} = animator.getOrMakeKeyframe(Toolbox.selected.animation_channel);

					Undo.initEdit({keyframes: before ? [before] : []})
					result.select();
					scope.keyframes.push(result);
				}

			} else if (Modes.id === 'display') {
				Undo.initEdit({display_slots: [display_slot]})
			}
			scope.firstChangeMade = true
		}
		function onPointerMove( event ) {

			if ( scope.elements.length == 0 || scope.axis === null || _dragging === false || ( event.button !== undefined && event.button !== 0 ) ) return;

			scope.orbit_controls.hasMoved = true
			var pointer = event.changedTouches ? event.changedTouches[ 0 ] : event;
			var planeIntersect = intersectObjects( pointer, [ _gizmo[ _mode ].activePlane ] );
			if (!planeIntersect) return;

			event.preventDefault();
			event.stopPropagation();

			var axis = scope.axis.substr(-1).toLowerCase()
			var axisNumber = getAxisNumber(axis)

			point.copy( planeIntersect.point );

			if (Toolbox.selected.transformerMode !== 'rotate') {
				point.sub( offset );
				if (!display_mode) {
					point.removeEuler(worldRotation)
				}

			} else {
				point.sub( worldPosition );
				point.removeEuler(worldRotation)
				var rotations = [
					Math.atan2( point.z, point.y ),
					Math.atan2( point.x, point.z ),
					Math.atan2( point.y, point.x )
				]
				var angle = Math.radToDeg( rotations[axisNumber] )
			}

			if (Modes.edit || Toolbox.selected.id == 'pivot_tool') {

				if (Toolbox.selected.id === 'move_tool') {

					var snap_factor = canvasGridSize(event.shiftKey, event.ctrlOrCmd)
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
						if (Format.canvas_limit && !settings.deactivate_size_limit.value) {
							selected.forEach(function(obj) {
								if (obj.movable && obj.resizable) {
									overlapping = overlapping || (
										obj.to[axisNumber] + difference + obj.inflate > 32 ||
										obj.to[axisNumber] + difference + obj.inflate < -16 ||
										obj.from[axisNumber] + difference - obj.inflate > 32 ||
										obj.from[axisNumber] + difference - obj.inflate < -16
									)
								}
							})
						}
						if (!overlapping) {
							if (_has_groups && Blockbench.globalMovement) {
								Group.selected.forEachChild(g => {
									g.origin[axisNumber] += difference
								}, Group, true)
							}
							displayDistance(point[axis] - originalValue);
							selected.forEach(function(obj, i) {
								if (obj.movable) {
									obj.move(difference, axisNumber, _has_groups||!Format.bone_rig)
								}
							})
							scope.updateSelection()
						}
						previousValue = point[axis]
						scope.hasChanged = true
					}
				} else if (Toolbox.selected.id === 'resize_tool') {
					//Scale
					var snap_factor = canvasGridSize(event.shiftKey, event.ctrlOrCmd)
					point[axis] = Math.round( point[axis] / snap_factor ) * snap_factor;


					if (previousValue !== point[axis]) {
						beforeFirstChange(event)

						selected.forEach(function(obj, i) {
							if (obj.resizable) {
								obj.resize(point[axis], axisNumber, !scope.direction)
							}
						})
						displayDistance(point[axis] * (scope.direction ? 1 : -1));
						scope.updateSelection()
						previousValue = point[axis]
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
						rotateOnAxis(n => (n + difference), axisNumber)
						Canvas.updatePositions(true)
						scope.updateSelection()
						displayDistance(angle - originalValue);
						previousValue = angle
						scope.hasChanged = true
					}
				} else if (Toolbox.selected.id === 'pivot_tool') {

					var snap_factor = canvasGridSize(event.shiftKey, event.ctrlOrCmd)
					point[axis] = Math.round( point[axis] / snap_factor ) * snap_factor;

					if (originalValue === null) {
						originalValue = point[axis];
					}
					if (previousValue === undefined) {
						previousValue = point[axis]

					} else if (previousValue !== point[axis]) {
						beforeFirstChange(event)

						var difference = point[axis] - previousValue

						if (Format.bone_rig && Group.selected) {
							if (Modes.edit) {
								var origin = Group.selected.origin.slice();
								origin[axisNumber] += difference;
								Group.selected.transferOrigin(origin, true);
							} else if (Modes.animate) {
								Group.selected.origin[axisNumber] += difference;
							}
						} else {
							var origin = Transformer.rotation_object.origin.slice()
							origin[axisNumber] += difference;
							selected.forEach(obj => {
								if (obj.transferOrigin) {
									obj.transferOrigin(origin);
								}
							})
						}
						displayDistance(point[axis] - originalValue);
						Canvas.updatePositions(true);
						if (Modes.animate) {
							Animator.preview();
						}
						scope.updateSelection()

						previousValue = point[axis]
						scope.hasChanged = true
					}

				}
			} else if (Modes.animate) {

				if (!Animator.selected) {
					Blockbench.showQuickMessage('message.no_animation_selected')
				}
				if (Toolbox.selected.id === 'rotate_tool') {
					value = Math.trimDeg(axisNumber === 2 ? angle : -angle)
					var round_num = getRotationInterval(event)
				} else {
					value = point[axis]
					if (Toolbox.selected.id === 'resize_tool') {
						value *= (scope.direction) ? 0.1 : -0.1;
						round_num = 0.1;
					} else {
						var round_num = canvasGridSize(event.shiftKey, event.ctrlOrCmd)
					}
				}
				value = Math.round(value/round_num)*round_num
				if (previousValue === undefined) previousValue = value
				if (originalValue === null) {
					originalValue = value;
				}

				if (value !== previousValue && Animator.selected && Animator.selected.getBoneAnimator()) {
					beforeFirstChange(event)
					var difference = value - (previousValue||0)
					if (Toolbox.selected.id === 'rotate_tool' && Math.abs(difference) > 120) {
						difference = 0;
					}
					if (axis == 'x' && Toolbox.selected.id === 'move_tool') {
						difference *= -1
					}
					if (Group.selected.ik_enabled) {

						Transformer.position.x += 1
						Transformer.solver.update();


						//scope.keyframes[0].offset(axis, difference);
						//scope.keyframes[0].select()


						/*
						var ik_solver = Transformer.ik_solver;

						ik_solver.target.position.copy(planeIntersect.point);

						main_preview.render()

						ik_solver.ik.solve();

						ik_solver.copy_bones.forEach((copy_bone, i) => {
							var keyframe = scope.keyframes[i];
							if (keyframe) {
								var bone = copy_bone.original;
								var animator = Animator.selected.getBoneAnimator(bone);

								keyframe.offset('x', Math.radToDeg(copy_bone.last_rotation.x - copy_bone.rotation.x));
								keyframe.offset('y', Math.radToDeg(copy_bone.last_rotation.y - copy_bone.rotation.y));
								keyframe.offset('z', Math.radToDeg(copy_bone.last_rotation.z - copy_bone.rotation.z));

								copy_bone.last_rotation.copy(copy_bone.rotation);
							}
						})

						*/

					} else {
						scope.keyframes[0].offset(axis, difference);
						scope.keyframes[0].select()
					}
					displayDistance(value - originalValue);

					Animator.preview()
					previousValue = value
					scope.hasChanged = true
				}

			} else if (Modes.display) {

				var rotation = new THREE.Quaternion()
				scope.getWorldQuaternion(rotation)
				point.applyQuaternion(rotation.inverse())

				var channel = Toolbox.selected.animation_channel
				if (channel === 'position') channel = 'translation';
				var value = point[axis]
				var bf = display[display_slot][channel][axisNumber] - (previousValue||0)

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

					var difference = value - (previousValue||0)
					display[display_slot][channel][axisNumber] += difference

					if (event.shiftKey && channel === 'scale') {
						var val = display[display_slot][channel][axisNumber]
						display[display_slot][channel][(axisNumber+1)%3] = val
						display[display_slot][channel][(axisNumber+2)%3] = val
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
		function onPointerUp( event ) {
			event.preventDefault(); // Prevent MouseEvent on mobile
			scope.dragging = false

			if ( event.button !== undefined && event.button !== 0 && event.button !== 2 ) return;

			if ( _dragging && scope.axis !== null ) {

				mouseUpEvent.mode = _mode;
				scope.dispatchEvent( mouseUpEvent );
				scope.orbit_controls.stopMovement();
				outlines.children.length = 0;
				originalValue = null;

				extendTransformLine(false);

				Blockbench.setStatusBarText();

				if (Modes.id === 'edit' || Toolbox.selected.id == 'pivot_tool') {
					if (Toolbox.selected.id === 'resize_tool') {
						//Scale
						selected.forEach(function(obj) {
							delete obj.oldScale
						})
						if (scope.hasChanged) {
							Undo.finishEdit('resize')
						}

					} else if (scope.axis !== null && scope.hasChanged) {

						if (Toolbox.selected.id == 'pivot_tool') {
							Undo.finishEdit('move pivot')
						} else {
							Undo.finishEdit('move elements')
						}
					}
					updateSelection()

				} else if (Modes.id === 'animate' && scope.keyframes && scope.keyframes.length) {
					Undo.finishEdit('change keyframe', {keyframes: scope.keyframes})

				} else if (Modes.id === 'display') {
					Undo.finishEdit('edit display slot')
				}
			}
			_dragging = false;

			if (scope.hasChanged && Blockbench.startup_count <= 1 && !Blockbench.hasFlag('size_modifier_message')) {
				Blockbench.addFlag('size_modifier_message');
				setTimeout(() => {
					Blockbench.showCenterTip('message.size_modifiers', 8000);
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
	};
	THREE.TransformControls.prototype = Object.create( THREE.Object3D.prototype );
	THREE.TransformControls.prototype.constructor = THREE.TransformControls;

}() );
