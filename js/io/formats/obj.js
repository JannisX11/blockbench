(function() {
var _obj_export;
function getMtlFace(obj, index) {
	//if (index % 2 == 1) index--;
	var key = Canvas.face_order[index];
	var tex = obj.faces[key].getTexture()

	if (tex === null) {
		return false
	} else if (!tex || typeof tex === 'string') {
		return 'usemtl none'
	} else {
		return 'usemtl m_' + tex.uuid;
	}
}
const cube_face_normals = {
	north: [0, 0, -1],
	east: [1, 0, 0],
	south: [0, 0, 1],
	west: [-1, 0, 0],
	up: [0, 1, 0],
	down: [0, -1, 0],
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
		let output = ['# Made in Blockbench '+appVersion];
		let indexVertex = 0;
		let indexVertexUvs = 0;
		let indexNormals = 0;
		const vertex = new THREE.Vector3();
		const color = new THREE.Color();
		const normal = new THREE.Vector3();
		const uv = new THREE.Vector2();
		const face = [];
		let face_export_mode = Settings.get('obj_face_export_mode');
		let export_scale = Settings.get('model_export_scale');

		output.push('mtllib ' + (options.mtl_name||'materials.mtl') +'\n');

		var parseMesh = function ( mesh ) {

			var nbVertex = 0;
			var nbVertexUvs = 0;
			var nbNormals = 0;

			var geometry = mesh.geometry;
			var element  = OutlinerNode.uuids[mesh.name];
			const normalMatrixWorld = new THREE.Matrix3();

			if (!element) return;
			if (element.export === false) return;

			normalMatrixWorld.getNormalMatrix( mesh.matrixWorld );

			if (element instanceof Cube) {

				output.push(`o ${element.name||'cube'}`)

				element.getGlobalVertexPositions().forEach((coords) => {
					vertex.set(...coords.V3_subtract(8, 8, 8)).divideScalar(export_scale);
					output.push('v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z);
					nbVertex++;
				})

				for (let key in element.faces) {
					if (element.faces[key].texture !== null) {
						let face = element.faces[key];
						let uv_outputs = [];
						uv_outputs.push(`vt ${face.uv[0] / Project.texture_width} ${1 - face.uv[1] / Project.texture_height}`);
						uv_outputs.push(`vt ${face.uv[2] / Project.texture_width} ${1 - face.uv[1] / Project.texture_height}`);
						uv_outputs.push(`vt ${face.uv[2] / Project.texture_width} ${1 - face.uv[3] / Project.texture_height}`);
						uv_outputs.push(`vt ${face.uv[0] / Project.texture_width} ${1 - face.uv[3] / Project.texture_height}`);
						var rot = face.rotation || 0;
						while (rot > 0) {
							uv_outputs.splice(0, 0, uv_outputs.pop());
							rot -= 90;
						}
						output.push(...uv_outputs);
						nbVertexUvs += 4;
					}
				}
				for (let key in element.faces) {
					if (element.faces[key].texture !== null) {
						normal.fromArray(cube_face_normals[key]);
						normal.applyMatrix3( normalMatrixWorld ).normalize();
						output.push('vn ' + normal.x + ' ' + normal.y + ' ' + normal.z );
						nbNormals += 1;
					}
				}

				let mtl;
				let i = 0;
				for (let key in element.faces) {
					if (element.faces[key].texture !== null) {
						let tex = element.faces[key].getTexture()
						if (tex && tex.uuid && !materials[tex.uuid]) {
							materials[tex.uuid] = tex;
						}
						let mtl_new = (!tex || typeof tex === 'string')
							? 'none'
							: 'm_' + tex.uuid;
						if (mtl_new != mtl) {
							mtl = mtl_new;
							output.push('usemtl '+mtl);
						}
						let vertices;
						switch (key) {
							case 'north': 	vertices = [2, 5, 7, 4]; break;
							case 'east': 	vertices = [1, 2, 4, 3]; break;
							case 'south': 	vertices = [6, 1, 3, 8]; break;
							case 'west': 	vertices = [5, 6, 8, 7]; break;
							case 'up': 		vertices = [5, 2, 1, 6]; break;
							case 'down': 	vertices = [8, 3, 4, 7]; break;
						}
						if (face_export_mode == 'tris') {
							output.push('f '+[
								`${vertices[2] + indexVertex}/${i*4 + 3 + indexVertexUvs}/${i+1+indexNormals}`,
								`${vertices[1] + indexVertex}/${i*4 + 2 + indexVertexUvs}/${i+1+indexNormals}`,
								`${vertices[0] + indexVertex}/${i*4 + 1 + indexVertexUvs}/${i+1+indexNormals}`,
							].join(' '));
							output.push('f '+[
								`${vertices[3] + indexVertex}/${i*4 + 4 + indexVertexUvs}/${i+1+indexNormals}`,
								`${vertices[2] + indexVertex}/${i*4 + 3 + indexVertexUvs}/${i+1+indexNormals}`,
								`${vertices[0] + indexVertex}/${i*4 + 1 + indexVertexUvs}/${i+1+indexNormals}`,
							].join(' '));
						} else {
							output.push('f '+[
								`${vertices[3] + indexVertex}/${i*4 + 4 + indexVertexUvs}/${i+1+indexNormals}`,
								`${vertices[2] + indexVertex}/${i*4 + 3 + indexVertexUvs}/${i+1+indexNormals}`,
								`${vertices[1] + indexVertex}/${i*4 + 2 + indexVertexUvs}/${i+1+indexNormals}`,
								`${vertices[0] + indexVertex}/${i*4 + 1 + indexVertexUvs}/${i+1+indexNormals}`,
							].join(' '));
						}
						i++;
					}
				}


			} else if (element instanceof Mesh) {

				output.push(`o ${element.name||'mesh'}`)

				let vertex_keys = [];
				function addVertex(x, y, z) {
					vertex.set(x, y, z);
					vertex.applyMatrix4( mesh.matrixWorld ).divideScalar(export_scale);
					output.push('v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z);
					nbVertex++;
				}
				for (let vkey in element.vertices) {
					addVertex(...element.vertices[vkey]);
					vertex_keys.push(vkey);
				}

				let mtl;
				let i = 0;
				let vertexnormals = [];
				let faces = [];
				for (let key in element.faces) {
					if (element.faces[key].texture !== null && element.faces[key].vertices.length >= 3) {
						let face = element.faces[key];
						let vertices = face.getSortedVertices().slice();
						let tex = element.faces[key].getTexture();

						vertices.forEach(vkey => {
							output.push(`vt ${face.uv[vkey][0] / Project.texture_width} ${1 - face.uv[vkey][1] / Project.texture_height}`);
							nbVertexUvs += 1;
						})

						normal.fromArray(face.getNormal(true));
						normal.applyMatrix3( normalMatrixWorld ).normalize();
						vertexnormals.push('vn ' + normal.x + ' ' + normal.y + ' ' + normal.z );
						nbNormals += 1;

						if (tex && tex.uuid && !materials[tex.uuid]) {
							materials[tex.uuid] = tex;
						}
						let mtl_new = (!tex || typeof tex === 'string')
							? 'none'
							: 'm_' + tex.uuid;
						if (mtl_new != mtl) {
							mtl = mtl_new;
							faces.push('usemtl '+mtl);
						}
						
						if (face_export_mode == 'quads' && vertices.length == 3) vertices.push(vertices[0]); 
						
						if (face_export_mode == 'tris' && vertices.length == 4) {
							let triplets_a = [];
							vertices.slice(0, 3).forEach((vkey, vi) => {
								let triplet = [
									vertex_keys.indexOf(vkey) + 1 + indexVertex,
									nbVertexUvs - vertices.length + vi + 1 + indexVertexUvs,
									i+1+indexNormals,
								]
								triplets_a.push(triplet.join('/'));
							})
							faces.push('f ' + triplets_a.join(' '));

							let triplets_b = [];
							[vertices[0], vertices[2], vertices[3]].forEach((vkey, vi) => {
								let triplet = [
									vertex_keys.indexOf(vkey) + 1 + indexVertex,
									nbVertexUvs - vertices.length + (vi ? 1 : 0) + vi + 1 + indexVertexUvs,
									i+1+indexNormals,
								]
								triplets_b.push(triplet.join('/'));
							})
							faces.push('f ' + triplets_b.join(' '));

						} else {
							let triplets = [];
							vertices.forEach(vkey => {
								let triplet = [
									vertex_keys.indexOf(vkey) + 1 + indexVertex,
									nbVertexUvs - vertices.length + vertices.indexOf(vkey) + 1 + indexVertexUvs,
									i+1+indexNormals,
								]
								triplets.push(triplet.join('/'));
							})
							faces.push('f ' + triplets.join(' '));
						}
						i++;
					}
				}
				output.push(...vertexnormals);
				output.push(...faces);

			} else {


				const vertices = geometry.getAttribute( 'position' );
				const normals = geometry.getAttribute( 'normal' );
				const uvs = geometry.getAttribute( 'uv' );
				const indices = geometry.getIndex();

				output.push('o ' + mesh.name); // name of the mesh material

				if ( mesh.material && mesh.material.name ) {

					output.push('usemtl ' + mesh.material.name);

				} // vertices


				if ( vertices !== undefined ) {

					for ( let i = 0, l = vertices.count; i < l; i ++, nbVertex ++ ) {

						vertex.x = vertices.getX( i );
						vertex.y = vertices.getY( i );
						vertex.z = vertices.getZ( i ); // transform the vertex to world space

						vertex.applyMatrix4( mesh.matrixWorld ).divideScalar(export_scale); // transform the vertex to export format

						output.push('v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z);

					}

				} // uvs


				if ( uvs !== undefined ) {

					for ( let i = 0, l = uvs.count; i < l; i ++, nbVertexUvs ++ ) {

						uv.x = uvs.getX( i );
						uv.y = uvs.getY( i ); // transform the uv to export format

						output.push('vt ' + uv.x + ' ' + uv.y);

					}

				} // normals


				if ( normals !== undefined ) {

					normalMatrixWorld.getNormalMatrix( mesh.matrixWorld );

					for ( let i = 0, l = normals.count; i < l; i ++, nbNormals ++ ) {

						normal.x = normals.getX( i );
						normal.y = normals.getY( i );
						normal.z = normals.getZ( i ); // transform the normal to world space

						normal.applyMatrix3( normalMatrixWorld ).normalize(); // transform the normal to export format

						output.push('vn ' + normal.x + ' ' + normal.y + ' ' + normal.z );

					}

				}

				// material
				for (let key in element.faces) {
					let tex = element.faces[key].getTexture()
					if (tex && tex.uuid && !materials[tex.uuid]) {
						materials[tex.uuid] = tex
					}
				}

				// faces
				if ( indices !== null ) {

					for ( let i = 0, l = indices.count; i < l; i += 3 ) {

						let f_mat = getMtlFace(element, geometry.groups[ Math.floor(i / 6) ].materialIndex)
						if (f_mat) {

							if (i % 2 === 0) {
								output.push(f_mat)
							}

							for ( let m = 0; m < 3; m ++ ) {

								const j = indices.getX( i + m ) + 1;
								face[ m ] = indexVertex + j + ( normals || uvs ? '/' + ( uvs ? indexVertexUvs + j : '' ) + ( normals ? '/' + ( indexNormals + j ) : '' ) : '' );

							} // transform the face to export format


							output.push('f ' + face.join( ' ' ) );
						}
					}

				} else {

					for ( let i = 0, l = vertices.count; i < l; i += 3 ) {

						for ( let m = 0; m < 3; m ++ ) {

							const j = i + m + 1;
							face[ m ] = indexVertex + j + ( normals || uvs ? '/' + ( uvs ? indexVertexUvs + j : '' ) + ( normals ? '/' + ( indexNormals + j ) : '' ) : '' );

						} // transform the face to export format


						output.push('f ' + face.join( ' ' ) );

					}

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

		output = output.join('\n');

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
