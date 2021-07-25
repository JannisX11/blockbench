(function() {
var _obj_export;
function getMtlFace(obj, index) {
	//if (index % 2 == 1) index--;
	var key = Canvas.face_order[index];
	var tex = obj.faces[key].getTexture()

	if (tex === null) {
		return false
	} else if (!tex || typeof tex === 'string') {
		return 'usemtl none\n'
	} else {
		return 'usemtl m_' + tex.id + '\n';
	}
}

var codec = new Codec('obj', {
	name: 'OBJ Wavefront Model',
	extension: 'obj',
	compile(options) {
		if (!options) options = 0;

		var old_scene_position = new THREE.Vector3().copy(scene.position);
		scene.position.set(0,0,0);

		/**
		Based on: three.js obj exporter, MIT license
		https://github.com/mrdoob/three.js/blob/dev/examples/js/exporters/OBJExporter.js
		*/

		let materials = {};
		let output = '# Made in Blockbench '+appVersion+'\n';
		let indexVertex = 0;
		let indexVertexUvs = 0;
		let indexNormals = 0;
		const vertex = new THREE.Vector3();
		const color = new THREE.Color();
		const normal = new THREE.Vector3();
		const uv = new THREE.Vector2();
		const face = [];

		output += 'mtllib ' + (options.mtl_name||'materials.mtl') +'\n';

		var scale = 1/16;

		var parseMesh = function ( mesh ) {

			var nbVertex = 0;
			var nbVertexUvs = 0;
			var nbNormals = 0;

			var geometry = mesh.geometry;
			var element  = OutlinerNode.uuids[mesh.name];
			const normalMatrixWorld = new THREE.Matrix3();

			if (!element) return;
			if (element.export === false) return;


			const vertices = geometry.getAttribute( 'position' );
			const normals = geometry.getAttribute( 'normal' );
			const uvs = geometry.getAttribute( 'uv' );
			const indices = geometry.getIndex(); // name of the mesh object

			output += 'o ' + mesh.name + '\n'; // name of the mesh material

			if ( mesh.material && mesh.material.name ) {

				output += 'usemtl ' + mesh.material.name + '\n';

			} // vertices


			if ( vertices !== undefined ) {

				for ( let i = 0, l = vertices.count; i < l; i ++, nbVertex ++ ) {

					vertex.x = vertices.getX( i );
					vertex.y = vertices.getY( i );
					vertex.z = vertices.getZ( i ); // transform the vertex to world space

					vertex.applyMatrix4( mesh.matrixWorld ); // transform the vertex to export format

					output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z + '\n';

				}

			} // uvs


			if ( uvs !== undefined ) {

				for ( let i = 0, l = uvs.count; i < l; i ++, nbVertexUvs ++ ) {

					uv.x = uvs.getX( i );
					uv.y = uvs.getY( i ); // transform the uv to export format

					output += 'vt ' + uv.x + ' ' + uv.y + '\n';

				}

			} // normals


			if ( normals !== undefined ) {

				normalMatrixWorld.getNormalMatrix( mesh.matrixWorld );

				for ( let i = 0, l = normals.count; i < l; i ++, nbNormals ++ ) {

					normal.x = normals.getX( i );
					normal.y = normals.getY( i );
					normal.z = normals.getZ( i ); // transform the normal to world space

					normal.applyMatrix3( normalMatrixWorld ).normalize(); // transform the normal to export format

					output += 'vn ' + normal.x + ' ' + normal.y + ' ' + normal.z + '\n';

				}

			}

			// material
			for (let key in element.faces) {
				let tex = element.faces[key].getTexture()
				if (tex && tex.uuid && !materials[tex.id]) {
					materials[tex.id] = tex
				}
			}

 			// faces
			if ( indices !== null ) {

				for ( let i = 0, l = indices.count; i < l; i += 3 ) {

					let f_mat = getMtlFace(element, geometry.groups[ Math.floor(i / 6) ].materialIndex)
					if (f_mat) {

						if (i % 2 === 0) {
							output += f_mat
						}

						for ( let m = 0; m < 3; m ++ ) {

							const j = indices.getX( i + m ) + 1;
							face[ m ] = indexVertex + j + ( normals || uvs ? '/' + ( uvs ? indexVertexUvs + j : '' ) + ( normals ? '/' + ( indexNormals + j ) : '' ) : '' );

						} // transform the face to export format


						output += 'f ' + face.join( ' ' ) + '\n';
					}
				}

			} else {

				for ( let i = 0, l = vertices.count; i < l; i += 3 ) {

					for ( let m = 0; m < 3; m ++ ) {

						const j = i + m + 1;
						face[ m ] = indexVertex + j + ( normals || uvs ? '/' + ( uvs ? indexVertexUvs + j : '' ) + ( normals ? '/' + ( indexNormals + j ) : '' ) : '' );

					} // transform the face to export format


					output += 'f ' + face.join( ' ' ) + '\n';

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
				mtlOutput += 'newmtl m_' +key+ '\n'
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
		this.dispatchEvent('compile', {model: output, mtl: mtlOutput, images: materials});
		return options.all_files ? _obj_export : output;
	},
	write(content, path) {
		var scope = this;

		var mtl_path = path.replace(/\.obj$/, '.mtl')
		content = this.compile({mtl_name: pathToName(mtl_path, true)})
		Blockbench.writeFile(path, {content}, path => scope.afterSave(path));

		Blockbench.writeFile(mtl_path, {content: _obj_export.mtl});

		//let existing_names = [];
		for (var key in _obj_export.images) {
			var texture = _obj_export.images[key]
			if (texture && !texture.error) {

				var name = texture.name;
				if (name.substr(-4) !== '.png') {
					name += '.png';
				}
				/*
				while (existing_names.includes(name)) {
					name = name.substr(0, name.length-4);
					let match = name.match(/\d+$/);
					let number = match ? parseInt(match[0])+1 : 2;
					name = name.replace(/\d+$/, '');
					name = name + number + '.png';
				}
				existing_names.push(name);
				*/
				var image_path = path.split(osfs);
				image_path.splice(-1, 1, name);
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
				resource_id: 'obj',
				type: this.name,
				extensions: [this.extension],
				name: this.fileName(),
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
