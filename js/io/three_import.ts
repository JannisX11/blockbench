import { THREE } from "../lib/libs";
import { PathModule } from "../native_apis";

const vertex_precision = 4;

export function getResourceURL(path: string) {
	if (!isApp || !path) return '';
	return 'file:///' + encodeURI(PathModule.dirname(path).replace(/\\/g, '/')).replace(/#/g, '%23') + '/';
}

export function createLoadingManager(timeout = 15000) {
	let manager = new THREE.LoadingManager();
	let started = false;
	manager.onStart = () => started = true;
	let finished = new Promise<void>(resolve => manager.onLoad = () => resolve());
	return {
		manager,
		async wait() {
			if (!started) return;
			await Promise.race([finished, new Promise(resolve => setTimeout(resolve, timeout))]);
		}
	};
}

interface DecodedTexture {
	name: string
	data_url: string
	width: number
	height: number
	flip_v: boolean
}
interface ConvertedTexture extends DecodedTexture {
	texture: Texture
}

async function decodeTexture(source): Promise<DecodedTexture | undefined> {
	let image = source.image;
	if (!image) return;
	if (image instanceof HTMLImageElement && !image.complete) {
		await new Promise(resolve => {
			image.addEventListener('load', resolve);
			image.addEventListener('error', resolve);
		});
	}
	let width = image.width;
	let height = image.height;
	if (!width || !height) return;

	let canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	try {
		canvas.getContext('2d').drawImage(image, 0, 0);
		return {
			name: source.name || 'texture',
			data_url: canvas.toDataURL(),
			width, height,
			flip_v: source.flipY !== false
		};
	} catch (error) {
		console.error(error);
	}
}

export async function decodeThreeTextures(root): Promise<Map<any, DecodedTexture>> {
	let sources = new Set();
	root.traverse(node => {
		let materials = node.material instanceof Array ? node.material : [node.material];
		for (let material of materials) {
			if (material && material.map) sources.add(material.map);
		}
	})
	let decoded = new Map();
	for (let source of sources) {
		let texture = await decodeTexture(source);
		if (texture) decoded.set(source, texture);
	}
	return decoded;
}

function buildMesh(node, textures: Map<any, ConvertedTexture>, scale: number): Mesh | undefined {
	let geometry = node.geometry;
	let position = geometry.getAttribute('position');
	if (!position) return;
	let uv_attribute = geometry.getAttribute('uv');
	let normal_attribute = geometry.getAttribute('normal');
	let index = geometry.getIndex();

	let mesh = new Mesh({name: node.name || 'mesh', vertices: {}});
	let vector = new THREE.Vector3();
	let normal_matrix = new THREE.Matrix3().getNormalMatrix(node.matrixWorld);

	let vertex_keys = {};
	let corners: string[] = [];
	for (let i = 0; i < position.count; i++) {
		vector.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld).multiplyScalar(scale);
		let hash = vector.toArray().map(value => value.toFixed(vertex_precision)).join(',');
		if (!vertex_keys[hash]) {
			vertex_keys[hash] = mesh.addVertices(vector.toArray())[0];
		}
		corners[i] = vertex_keys[hash];
	}

	let materials = node.material instanceof Array ? node.material : [node.material];
	let groups = geometry.groups && geometry.groups.length ? geometry.groups : null;
	function textureAt(offset: number) {
		let group = groups && groups.find(group => offset >= group.start && offset < group.start + group.count);
		let material = materials[group ? group.materialIndex : 0];
		return material && material.map ? textures.get(material.map) : undefined;
	}

	let face_normal = new THREE.Vector3();
	let source_normal = new THREE.Vector3();
	let total = index ? index.count : position.count;
	for (let offset = 0; offset + 2 < total; offset += 3) {
		let triangle = [0, 1, 2].map(corner => index ? index.getX(offset + corner) : offset + corner);
		let vertices = triangle.map(corner => corners[corner]);
		if (new Set(vertices).size < 3) continue;

		let converted = textureAt(offset);
		let uv_width = converted ? converted.width : Project.texture_width;
		let uv_height = converted ? converted.height : Project.texture_height;
		let flip_v = converted ? converted.flip_v : true;
		let uv = {};
		triangle.forEach((corner, i) => {
			if (!uv_attribute) {
				uv[vertices[i]] = [0, 0];
				return;
			}
			let v = uv_attribute.getY(corner);
			uv[vertices[i]] = [uv_attribute.getX(corner) * uv_width, (flip_v ? 1 - v : v) * uv_height];
		})

		let face = new MeshFace(mesh, {vertices, uv, texture: converted && converted.texture});
		mesh.addFaces(face);

		if (normal_attribute) {
			face_normal.fromArray(face.getNormal());
			source_normal.fromBufferAttribute(normal_attribute, triangle[0]).applyMatrix3(normal_matrix);
			if (face_normal.angleTo(source_normal) > Math.PI / 2) {
				face.invert();
			}
		}
	}

	if (!Object.keys(mesh.faces).length) return;
	return mesh;
}

function countGeometry(node): number {
	let count = 0;
	node.traverse(child => {
		if (child.isMesh && child.geometry) count++;
	})
	return count;
}

export function importThreeObject(root, decoded: Map<any, DecodedTexture>, options: {scale?: number} = {}) {
	let scale = options.scale ?? Settings.get('model_export_scale') as number;
	root.updateMatrixWorld(true);

	let textures = new Map<any, ConvertedTexture>();
	for (let [source, entry] of decoded) {
		let texture = new Texture({name: entry.name}).fromDataURL(entry.data_url).add(false, true);
		textures.set(source, {...entry, texture});
	}

	let elements: Mesh[] = [];
	function convertNode(node, parent) {
		let target = parent;
		if (node.isMesh && node.geometry) {
			let mesh = buildMesh(node, textures, scale);
			if (mesh) {
				mesh.addTo(parent).init();
				elements.push(mesh);
			}
		} else if (node !== root && node.children.length && countGeometry(node) > 1) {
			target = new Group({name: node.name || 'group'}).init().addTo(parent);
		}
		for (let child of node.children) {
			convertNode(child, target);
		}
	}
	convertNode(root, undefined);

	return elements;
}

export async function loadThreeModel(root, file, codec: Codec, options: {scale?: number} = {}) {
	let decoded = await decodeThreeTextures(root);

	setupProject(Formats.free);
	let name = pathToName(file.path, true);
	Project.name = pathToName(name, false);
	if (file.path && isApp && !file.no_file) {
		Project.export_path = file.path;
		Project.export_codec = codec.id;
	}

	let elements = importThreeObject(root, decoded, options);
	Project.saved = true;

	if (file.path && isApp && !file.no_file) {
		loadDataFromModelMemory();
		addRecentProject({
			name,
			path: file.path,
			icon: Format.icon
		});
		let project = Project;
		setTimeout(() => {
			if (Project == project) updateRecentProjectThumbnail();
		}, 500);
	}
	if (!elements.length) {
		Blockbench.showQuickMessage('message.invalid_model.title');
	}
	return elements;
}
