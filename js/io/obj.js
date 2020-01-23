(function() {
var _obj_export;
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

var codec = new Codec('obj', {
	name: 'OBJ Wavefront Model',
	extension: 'obj',
	compile(options) {
		if (!options) options = 0;

		var old_scene_position = new THREE.Vector3().copy(scene.position);
		scene.position.set(0,0,0)

		var output = '# Made in Blockbench '+appVersion+'\n';
		var materials = {};

		var indexVertex = 0;
		var indexVertexUvs = 0;
		var indexNormals = 0;

		output += 'mtllib ' + (options.mtl_name||'materials.mtl') +'\n';

		var scale = 1/16;

		var parseMesh = function ( mesh ) {

			var nbVertex = 0;
			var nbVertexUvs = 0;
			var nbNormals = 0;

			var geometry = mesh.geometry;
			var element  = elements.findInArray('uuid', mesh.name)

			if (!element) return;
			if (element.export === false) return;

			output += 'o ' + element.name + '\n';

			var vertices = geometry.vertices;

			for ( var i = 0, l = vertices.length; i < l; i ++ ) {

				var vertex = vertices[ i ].clone();
				vertex.applyMatrix4( mesh.matrixWorld );

				output += 'v ' + (vertex.x*scale) + ' ' + (vertex.y*scale) + ' ' + (vertex.z*scale) + '\n';
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

			// update index
			indexVertex += nbVertex;
			indexVertexUvs += nbVertexUvs;
			indexNormals += nbNormals;
		};

		scene.traverse( function ( child ) {

			if ( child instanceof THREE.Mesh ) parseMesh( child );
		} );
	  		
		// mtl output
		  
		var mtlOutput = '# Made in Blockbench '+appVersion+'\n';;
		
		for (var key in materials) {
			if (materials.hasOwnProperty(key) && materials[key]) {
				var tex = materials[key];
				mtlOutput += 'newmtl ' +key+ '\n'
				mtlOutput += `map_Kd ${tex.name} \n`;
			}
		}
		mtlOutput += 'newmtl none'

		scene.position.copy(old_scene_position)

		_obj_export = {
			obj: output,
			mtl: mtlOutput,
			images: materials
		}
		return options.all_files ? _obj_export : output;
	},
	write(content, path) {
		var scope = this;

		var mtl_path = path.replace(/\.obj$/, '.mtl')
		content = this.compile({mtl_name: pathToName(mtl_path, true)})
		Blockbench.writeFile(path, {content}, path => scope.afterSave(path));

		Blockbench.writeFile(mtl_path, {content: _obj_export.mtl});

		for (var key in _obj_export.images) {
			var texture = _obj_export.images[key]
			if (texture && !texture.error) {

				var name = texture.name;
				if (name.substr(-4) !== '.png') {
					name += '.png';
				}
				var image_path = path.split(osfs)
				image_path.splice(-1, 1, texture.name)
				Blockbench.writeFile(image_path.join(osfs), {
					content: texture.source,
					savetype: 'image'
				})
			}
		}
	},
	export() {
		var scope = this;
		if (isApp) {
			Blockbench.export({
				type: this.name,
				extensions: [this.extension],
				name: this.fileName(),
				startpath: this.startPath(),
				custom_writer: (a, b) => scope.write(a, b),
			})

		} else {
			var archive = new JSZip();
			var content = this.compile()

			archive.file((Project.name||'model')+'.obj', content)
			archive.file('materials.mtl', _obj_export.mtl)

			for (var key in _obj_export.images) {
				var texture = _obj_export.images[key]
				if (texture && !texture.error && texture.mode === 'bitmap') {
					archive.file(pathToName(texture.name) + '.png', texture.source.replace('data:image/png;base64,', ''), {base64: true});
				}
			}
			archive.generateAsync({type: 'blob'}).then(content => {
				Blockbench.export({
					type: 'Zip Archive',
					extensions: ['zip'],
					name: 'assets',
					content: content,
					savetype: 'zip'
				}, path => scope.afterDownload(path));
			})
		}
	}
})

BARS.defineActions(function() {
	codec.export_action = new Action({
		id: 'export_obj',
		icon: 'icon-objects',
		category: 'file',
		click: function () {
			codec.export()
		}
	})
})

})()
