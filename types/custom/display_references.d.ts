declare global {
	namespace DisplayReferenceModel {
		interface Element {
			name: string
			size: ArrayVector3
			pos: ArrayVector3
			origin: ArrayVector3
			rotation?: ArrayVector3
			north: { uv: ArrayVector4 }
			east: { uv: ArrayVector4 }
			south: { uv: ArrayVector4 }
			west: { uv: ArrayVector4 }
			up: { uv: ArrayVector4 }
			down: { uv: ArrayVector4 }
			model?: string
		}

		interface Model {
			texture: string
			texture_size: [number, number]
			elements: Array<Element>
		}
	}

	const DisplayReferences: {
		display_player: DisplayReferenceModel.Model
		armor_stand: DisplayReferenceModel.Model
		armor_stand_small: DisplayReferenceModel.Model
		fox: DisplayReferenceModel.Model
		zombie: DisplayReferenceModel.Model
		baby_zombie: DisplayReferenceModel.Model
		monitor: DisplayReferenceModel.Model
		block: DisplayReferenceModel.Model
		frame_block: DisplayReferenceModel.Model
		frame: DisplayReferenceModel.Model
		frame_top_block: DisplayReferenceModel.Model
		frame_top: DisplayReferenceModel.Model
	}
}

export {}
