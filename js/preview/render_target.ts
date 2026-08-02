/**
 * Utility to render the current viewport into a buffer, where each pixel contains the UV coords as well as which mesh and face was hit
 */
export class RenderTargetSnapshot {
	preview: Preview
	meshes: THREE.Mesh[]
	render_target: THREE.WebGLRenderTarget
	pixel_buffer: Float32Array

	constructor(preview: Preview) {
		this.preview = preview;
		this.render_target = new THREE.WebGLRenderTarget(
			preview.width,
			preview.height,
			{
				minFilter: THREE.NearestFilter,
				magFilter: THREE.NearestFilter,
				format: THREE.RGBAFormat,
				type: THREE.FloatType // Ensures floating-point precision for UVs
			}
		);
		this.pixel_buffer = new Float32Array(4 * preview.width * preview.height); // [R, G, B, A]
	}

	takeSnapshot(meshes: THREE.Mesh[]): this {
		const renderer = this.preview.renderer;
		const scene = Canvas.scene;
		const camera = this.preview.camera;
		// Save original materials & swap with picking material
		const original_materials = new Map();

		meshes.forEach((mesh, index) => {
			original_materials.set(mesh, mesh.material);
			
			// Assign unique normalized ID (1-based index mapped to 0..1 range)
			const normalized_id = (index + 1) / meshes.length;
			
			const mat = PICKING_MATERIAL.clone();
			mat.uniforms.uMeshId.value = normalized_id;
			mat.side = (mesh.material instanceof Array ? mesh.material[0] : mesh.material).side;
			mesh.material = mat;

			preparePickingGeometry(mesh.geometry);
		});
		this.meshes = meshes;

		// Render scene to offscreen buffer
		renderer.setRenderTarget(this.render_target);
		renderer.clear();
		renderer.render(scene, camera);
		
		renderer.readRenderTargetPixels(
			this.render_target,
			0,
			0,
			this.render_target.width,
			this.render_target.height,
			this.pixel_buffer
		);

		// Restore
		meshes.forEach((mesh) => {
			mesh.material = original_materials.get(mesh);
			mesh.geometry.deleteAttribute('faceIndex');
		});
		renderer.setRenderTarget(null);
		return this;
	}
	readPixel(coord_x: number, coord_y: number): null | {
		object: THREE.Mesh
		uv: THREE.Vector2
		face_index: number
	} {

		// Convert screen coordinates to render target pixel coordinates (Y is inverted in WebGL)
		coord_x = Math.floor(coord_x);
		coord_y = Math.floor(this.render_target.height - coord_y);

		let pixel_index = coord_x + coord_y * this.render_target.width;
		let pixel_data = this.pixel_buffer.slice(pixel_index*4, pixel_index*4 + 4);

		const mesh_id = pixel_data[0];
		if (mesh_id === 0) return null; // Hit background

		// Decode Mesh Index
		const mesh_index = Math.round(mesh_id * this.meshes.length) - 1;

		return {
			object: this.meshes[mesh_index],
			uv: new THREE.Vector2(pixel_data[1], pixel_data[2]),
			face_index: Math.round(pixel_data[3])
		};
	}
}


const PICKING_MATERIAL = new THREE.ShaderMaterial({
	uniforms: {
		uMeshId: { value: 0.0 }
	},
	vertexShader: `
		attribute float faceIndex;
		varying vec2 vUv;
		varying float vFaceIndex;

		void main() {
			vUv = uv;
			vFaceIndex = faceIndex;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`,
	fragmentShader: `
		uniform float uMeshId;
		varying vec2 vUv;
		varying float vFaceIndex;

		void main() {
			// Pack attributes into output color:
			// Red   = Mesh ID
			// Green = UV.x (u)
			// Blue  = UV.y (v)
			// Alpha = Face Index
			gl_FragColor = vec4(uMeshId, vUv.x, vUv.y, vFaceIndex);
		}
	`
});


function preparePickingGeometry(geometry: THREE.BufferGeometry) {
	const position = geometry.attributes.position;
	const faceIndices = new Float32Array(position.count);

	// For non-indexed geometries, every 3 vertices belong to 1 triangle face
	for (let i = 0; i < position.count; i++) {
		faceIndices[i] = Math.floor(i / 3);
	}

	geometry.setAttribute('faceIndex', new THREE.BufferAttribute(faceIndices, 1));
}