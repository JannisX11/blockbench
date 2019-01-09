/**
 * @author mrdoob / http://mrdoob.com/
 */

THREE.OBJExporter = function () {};

THREE.OBJExporter.prototype = {

	constructor: THREE.OBJExporter,

	parse: function ( object, mtlFileName ) {

	var output = '';
	var materials = {};

	var indexVertex = 0;
	var indexVertexUvs = 0;
	var indexNormals = 0;
      	
	output += 'mtllib ' + mtlFileName +  '.mtl\n';

		var parseMesh = function ( mesh ) {

			var nbVertex = 0;
			var nbVertexUvs = 0;
			var nbNormals = 0;

			var geometry = mesh.geometry;
			var element  = TreeElements.findRecursive('uuid', mesh.name)

			if (element === undefined) return;
			if (element.display.export === false) return;

			if ( geometry instanceof THREE.Geometry ) {

				output += 'o ' + mesh.name + '\n';

				var vertices = geometry.vertices;

				for ( var i = 0, l = vertices.length; i < l; i ++ ) {

					var vertex = vertices[ i ].clone();
					vertex.applyMatrix4( mesh.matrixWorld );

					output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z + '\n';

					nbVertex ++;

				}

				// uvs

				var faces = geometry.faces;
				var faceVertexUvs = geometry.faceVertexUvs[ 0 ];
				var hasVertexUvs = faces.length === faceVertexUvs.length;

				if ( hasVertexUvs ) {

					for ( var i = 0, l = faceVertexUvs.length; i < l; i ++ ) {

						var vertexUvs = faceVertexUvs[ i ];

						for ( var j = 0, jl = vertexUvs.length; j < jl; j ++ ) {

							var uv = vertexUvs[ j ];

							output += 'vt ' + uv.x + ' ' + uv.y + '\n';

							nbVertexUvs ++;

						}

					}

				}

				// normals

				var normalMatrixWorld = new THREE.Matrix3();
				normalMatrixWorld.getNormalMatrix( mesh.matrixWorld );

				for ( var i = 0, l = faces.length; i < l; i ++ ) {

					var face = faces[ i ];
					var vertexNormals = face.vertexNormals;

					if ( vertexNormals.length === 3 ) {

						for ( var j = 0, jl = vertexNormals.length; j < jl; j ++ ) {

							var normal = vertexNormals[ j ].clone();
							normal.applyMatrix3( normalMatrixWorld );

							output += 'vn ' + normal.x + ' ' + normal.y + ' ' + normal.z + '\n';

							nbNormals ++;

						}

					} else {

						var normal = face.normal.clone();
						normal.applyMatrix3( normalMatrixWorld );

						for ( var j = 0; j < 3; j ++ ) {

							output += 'vn ' + normal.x + ' ' + normal.y + ' ' + normal.z + '\n';

							nbNormals ++;

						}

					}

				}
              
				// material
				for (var key in element.faces) {
					if (element.faces.hasOwnProperty(key)) {
						var id = element.faces[key].texture
						if (id !== undefined && id !== '$transparent') {
							id = id.replace('#', '')
							if (materials[id] === undefined) {
								materials[id] = getTextureById(id)
							}
						}
					}
				}




				for ( var i = 0, j = 1, l = faces.length; i < l; i ++, j += 3 ) {

					var face = faces[ i ];

					if (i % 2 === 0) {
						output += getMtlFace(element, i)
					}

					output += 'f ';
					output += ( indexVertex + face.a + 1 ) + '/' + ( hasVertexUvs ? ( indexVertexUvs + j     ) : '' ) + '/' + ( indexNormals + j     ) + ' ';
					output += ( indexVertex + face.b + 1 ) + '/' + ( hasVertexUvs ? ( indexVertexUvs + j + 1 ) : '' ) + '/' + ( indexNormals + j + 1 ) + ' ';
					output += ( indexVertex + face.c + 1 ) + '/' + ( hasVertexUvs ? ( indexVertexUvs + j + 2 ) : '' ) + '/' + ( indexNormals + j + 2 ) + '\n';

				}

			} else {

				console.warn( 'THREE.OBJExporter.parseMesh(): geometry type unsupported', mesh );
				// TODO: Support only BufferGeometry and use use setFromObject()

			}

			// update index
			indexVertex += nbVertex;
			indexVertexUvs += nbVertexUvs;
			indexNormals += nbNormals;

		};

		object.traverse( function ( child ) {

			if ( child instanceof THREE.Mesh ) parseMesh( child );

		} );
      		
	// mtl output
      
	var mtlOutput = '';
      
	for (var key in materials) {
		if (materials.hasOwnProperty(key) && materials[key]) {
			mtlOutput += 'newmtl ' +key+ '\n'
			mtlOutput += 'map_Kd '+ materials[key].name +'\n';
			//mtlOutput += 'illum 2\n';
		}
        
	}

	return {
		obj: output,
		mtl: mtlOutput,
		images: materials
	}

	}

};
function getMtlFace(obj, index) {
	if (index % 2 == 1) index--;
	var key = 'north'
	switch (index) {
        case 10:  key = 'north'; break;
        case 0:   key = 'east';  break;
        case 8:  key = 'south';  break;
        case 2:   key = 'west';  break;
        case 4:     key = 'up';  break;
        case 6:   key = 'down';  break;
	}

	var id = obj.faces[key].texture

	if (id === '$transparent') {
		return 'usemtl none'
	} else if (id === undefined) {
		return 'usemtl none'
	} else {
		id = id.replace('#', '')
		return 'usemtl ' + id + '\n';
	}
}