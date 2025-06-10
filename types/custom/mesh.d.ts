/// <reference path="./blockbench.d.ts"/>
type OccupationMatrix = {
	[x: number]: {
		[y: number]: boolean
	}
}
type MeshEdge = [string, string]

type MeshSeamValue = 'auto' | 'divide' | 'join'
interface MeshOptions {
	name?: string
	color?: number
	visibility?: boolean
	rotation?: ArrayVector3
	origin?: ArrayVector3
	vertices?: {
		[vkey: string]: ArrayVector3
	}
}

interface MeshFaceOptions extends FaceOptions {
	vertices: string[]
	uv: { [vkey: string]: ArrayVector2 }
}
declare class MeshFace extends Face {
	constructor(mesh: Mesh, data: MeshFaceOptions)
	/**
	 * The vertices that make up the face, as vertex keys. The vertices go around the face counter-clockwise when looking at the front side of the face. That also means that reversing the vertex order reverses the face direction.
	 */
	vertices: string[]
	mesh: Mesh
	uv: {
		[vertex: string]: ArrayVector2
	}
	extend(data: MeshFaceOptions): void
	/**
	 * Returns the face normal in mesh space as calculated from the vertex positions
	 * @param normalize If true, the values will be normalized.
	 * @param alt_tri On quads, if true, this will return the normal of the second tri instead of the first
	 */
	getNormal(normalize: boolean, alt_tri?: boolean): ArrayVector3
	/**
	 * Calculates which pixels the UV face occupies, and returns them as a map
	 */
	getOccupationMatrix(
		texture_space?: boolean,
		start_offset?: ArrayVector2,
		matrix?: OccupationMatrix
	): OccupationMatrix
	/**
	 * Get the keys of this face and all faces that are connected with it on the UV map
	 */
	getUVIsland(): string[]
	/**
	 * Returns the angle between two faces in degrees
	 */
	getAngleTo(other_face: MeshFace): number
	/**
	 * Inverts the direction of the face
	 */
	invert(): void
	/**
	 * Returns whether the face is selected
	 */
	isSelected(): boolean
	/**
	 * Returns the vertices of a quad in an order that creates a convex quad shape if possible. If the face has less than 4 vertices, it just returns the vertices in original order.
	 */
	getSortedVertices(): string[]
	/**
	 * Get the adjacent face in the specified side
	 */
	getAdjacentFace(
		side_index: number
	): { face: MeshFace; key: string; edge: MeshEdge; index: number } | null
	/**
	 * Returns the face key
	 */
	getFaceKey(): string
	/**
	 * Takes a UV coordinate and turns it into a 3D space coordinate in local space of the mesh. On quads, the first triangle is used for calculation, so the coordinates on warped quads may be inaccurate.
	 */
	UVToLocal(uv: ArrayVector2): THREE.Vector3
	/**
	 * Takes a 3D coordinate in local space of the mesh, and turns it into a coordinate on the UV map using barycentric coordinates. On quads, the first triangle is used for calculation, so the coordinates on warped quads may be inaccurate.
	 */
	localToUV(vector: THREE.Vector3): ArrayVector2
	/**
	 * Get the face center by weight in local space
	 */
	getCenter(): ArrayVector3
}

interface MeshOptions {
	name?: string
	color?: number
	visibility?: boolean
	rotation?: ArrayVector3
	origin?: ArrayVector3
	vertices?: {
		[vkey: string]: ArrayVector3
	}
}
declare class Mesh extends OutlinerElement {
	constructor(options: Partial<MeshOptions>, uuid?: string)

	visibility: boolean
	color: number

	vertices: {
		[vkey: string]: ArrayVector3
	}
	faces: {
		[fkey: string]: MeshFace
	}
	seams: {
		[vkey: string]: MeshSeamValue
	}

	extend(options: Partial<MeshOptions>): this

	/**
	 * Get selected vertices as vertex keys
	 * @param can_write If true, the array can safely be modified to update the selection
	 */
	getSelectedVertices(can_write: boolean): string[]
	/**
	 * Get selected edges as vertex key pairs
	 * @param can_write If true, the array can safely be modified to update the selection
	 */
	getSelectedEdges(can_write: boolean): [string, string][]
	/**
	 * Get selected faces as face keys
	 * @param can_write If true, the array can safely be modified to update the selection
	 */
	getSelectedVertices(can_write: boolean): string[]

	setSeam(edge: MeshEdge, value: any): void
	getSeam(edge: MeshEdge): MeshSeamValue
	getWorldCenter(ignore_mesh_selection?: boolean): THREE.Vector3
	addVertices(...ArrayVector3: ArrayVector3[]): string[]
	addFaces(...MeshFace: MeshFace[]): string[]
	extend(data: MeshOptions): void
	getUndoCopy(aspects?: any): any
	getSelectionRotation(): THREE.Euler
	getCenter(global: boolean): THREE.Vector3
	forAllFaces(callback: (face: MeshFace, key: string) => void): void
	transferOrigin(origin: ArrayVector3, update?: boolean): void
	setColor(color: number): void
	roll(axis: number, steps: number, origin?: ArrayVector3): void
	flip(axis: number): void
	moveVector(offset: ArrayVector3, axis: number, update?: boolean): void
	resize(
		val: number,
		axis: number,
		negative: boolean,
		allow_negative: boolean,
		bidirectional?: boolean
	): void
	applyTexture(texture: Texture, faces?: true | undefined | string[]): void

	static all: Mesh[]
	static selected: Mesh[]
	/**Check if any elements of the type are in the project */
	static hasAny: () => boolean
	/**Check if any elements of the type are currently selected */
	static hasSelected: () => boolean
}

interface MeshFaceOptions extends FaceOptions {}
