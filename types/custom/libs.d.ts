import three from 'three'

declare module 'three' {
	interface Object3D {
		/**The outline mesh of the mesh */
		outline?: three.Object3D | three.Mesh
		fix_rotation?: three.Euler
		fix_position?: three.Vector3
		no_export?: boolean
		isElement?: boolean
		isGroup?: boolean
	}
}
