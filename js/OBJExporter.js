/**
 * @author mrdoob / http://mrdoob.com/
 * modified for Blockbench
 */

THREE.OBJExporter = function () {};

THREE.OBJExporter.prototype = {

	constructor: THREE.OBJExporter,
	parse: function ( object, mtlFileName ) {

	var output = '# Made in Blockbench '+appVersion+'\n';
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
			if (element.export === false) return;

			if ( geometry instanceof THREE.Geometry ) {

				output += 'o ' + element.name + '\n';

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
				for (var face in element.faces) {
					var tex = element.faces[face].getTexture()
					if (tex && tex.uuid && !materials[tex.id]) {
						materials[tex.id] = tex
					}
				}


				for ( var i = 0, j = 1, l = faces.length; i < l; i ++, j += 3 ) {

					var f_mat = getMtlFace(element, i)
					if (f_mat) {

						var face = faces[ i ];
						if (i % 2 === 0) {
							output += f_mat
						}
						output += 'f ';
						output += ( indexVertex + face.a + 1 ) + '/' + ( hasVertexUvs ? ( indexVertexUvs + j	 ) : '' ) + '/' + ( indexNormals + j	 ) + ' ';
						output += ( indexVertex + face.b + 1 ) + '/' + ( hasVertexUvs ? ( indexVertexUvs + j + 1 ) : '' ) + '/' + ( indexNormals + j + 1 ) + ' ';
						output += ( indexVertex + face.c + 1 ) + '/' + ( hasVertexUvs ? ( indexVertexUvs + j + 2 ) : '' ) + '/' + ( indexNormals + j + 2 ) + '\n';
					}
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
	  
	var mtlOutput = '# Made in Blockbench '+appVersion+'\n';;
	  
	for (var key in materials) {
		if (materials.hasOwnProperty(key) && materials[key]) {
			mtlOutput += 'newmtl ' +key+ '\n'
			mtlOutput += 'map_Kd '+ materials[key].name +'\n';
		}
	}
	mtlOutput += 'newmtl none'

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
		case 4:	 key = 'up';  break;
		case 6:   key = 'down';  break;
	}

	var tex = obj.faces[key].getTexture()

	if (tex === null) {
		return false
	} else if (!tex || typeof tex === 'string') {
		return 'usemtl none\n'
	} else {
		return 'usemtl ' + tex.id + '\n';
	}
}