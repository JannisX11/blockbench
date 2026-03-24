import { BoundingBox } from "../outliner/types/bounding_box"

let raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
function getAllParents(element: OutlinerElement): OutlinerNode[] {
	let list = [];
	let parent = element.parent;
	while (parent instanceof OutlinerNode) {
		list.push(parent);
		parent = parent.parent;
	}
	return list;
}

class VoxelMatrix<Type> {
	values: Record<number, Type>
	private fallback: Type
	constructor(fallback: Type) {
		this.values = {};
		this.fallback = fallback;
	}
	getKey(x: number, y: number, z: number): string {
		return [x, y, z].join('_');
	}
	getVectorFromKey(key: string): ArrayVector3 {
		return key.split('_').map(v => parseInt(v)) as ArrayVector3;
	}
	set(x: number, y: number, z: number, value: Type): void {
		let key = this.getKey(x, y, z);
		this.values[key] = value;
	}
	get(x: number, y: number, z: number): Type {
		let key = this.getKey(x, y, z);
		return this.values[key] ?? this.fallback;
	}
	delete(x: number, y: number, z: number): void {
		delete this.values[this.getKey(x, y, z)];
	}
}

BARS.defineActions(() => {
	new Action('generate_voxel_shapes', {
		// TODO: Localize this
		name: 'Generate Bounding Boxes',
		category: 'edit',
		icon: 'fa-cubes',
		condition: {features: ['bounding_boxes']},
		click() {

			interface GenerateOptions{
				visible_only: boolean
				approach: 'grow' | 'shrink'
				complexity: number
			}
			let default_options: GenerateOptions = {
				visible_only: false,
				approach: 'grow',
				complexity: 40
			}


			function generate(amended: boolean, options: GenerateOptions) {
				let bounding_boxes: BoundingBox[] = [];
				let cubes: Cube[] = Cube.all.slice();
				Undo.initEdit({elements: bounding_boxes}, amended);
				
				const visible_box = new THREE.Box3();
				Canvas.withoutGizmos(() => {
					for (let cube of cubes) {
						if (options.visible_only && cube.visibility == false) continue;
						if (cube.export && cube.mesh) {
							visible_box.expandByObject(cube.mesh);
						}
					}
				})
				
				let rotated_cubes: Cube[] = [];
				let aabbs: THREE.Box3[] = [];
				for (let cube of cubes) {
					if (options.visible_only && cube.visibility == false) continue;
					if (cube.size().some(v => v < 0.1)) continue;
					let no_rotation = cube.rotation.allEqual(0) &&
						getAllParents(cube).allAre(parent => {
							return !('rotation' in parent) || (parent.rotation as ArrayVector3).allEqual(0)
						});
					if (no_rotation) {
						aabbs.push(new THREE.Box3(
							new THREE.Vector3().fromArray(cube.from),
							new THREE.Vector3().fromArray(cube.to),
						));
					} else {
						rotated_cubes.push(cube);
					}
				}

				let matrix = new VoxelMatrix<boolean|null>(null);

				// Voxelize model
				let point = new THREE.Vector3();
				let start = [
					Math.round(visible_box.min.x),
					Math.round(visible_box.min.y),
					Math.round(visible_box.min.z),
				];
				let end = [
					Math.round(visible_box.max.x),
					Math.round(visible_box.max.y),
					Math.round(visible_box.max.z),
				];
				for (let x = start[0]; x < end[0]; x++) {
					for (let z = start[2]; z < end[2]; z++) {
						for (let y = start[1]; y < end[1]; y++) {
							point.set(x+0.46, y+0.46, z+0.46);
							let in_shape: any = aabbs.find(box => box.containsPoint(point));
							if (!in_shape && rotated_cubes.length) {
								raycaster.ray.origin.copy(point);
								in_shape = rotated_cubes.find(cube => {
									let intersects = raycaster.intersectObject(cube.mesh);
									let intersection_points = [];
									for (let intersect of intersects) {
										if (!intersection_points.some(p => p.equals(intersect.point))) {
											intersection_points.push(intersect.point);
										}
									}
									return intersection_points.length % 2 == 1;
								})
							}
							matrix.set(x, y, z, !!in_shape);
						}
					}
				}

				// Simplify voxels to boxes

				type MBox = [number, number, number, number, number, number];
				let boxes: MBox[] = [];
				let miss_factor = (options.complexity/100)**2; // Square curve to distribute along slider more nicely
				let match_factor = (options.complexity/100); // Square curve to distribute along slider more nicely
				let lateral_size = Math.max(end[0]-start[0], end[2]-start[2]);
				let vertical_size = end[1]-start[1];
				
				
				function expand(box: MBox, axis: 0|1|2, direction: 1 | -1, max_misses?: number): boolean {
					let axisa = (axis+1)%3;
					let axisb = (axis+2)%3;
					let cursor = box.slice(0, 3);
					if (direction == 1) {
						cursor[axis] = box[axis+3] + 1;
					} else {
						cursor[axis] -= 1;
					}
					if (cursor[axis] >= end[axis] || cursor[axis] < start[axis]) return false;
					let surface_size = (box[axisa+3]-box[axisa]+1) * (box[axisb+3]-box[axisb]+1);
					max_misses = max_misses ?? (surface_size * (1-miss_factor));
					let misses = 0;
					for (let a = box[axisa]; a <= box[axisa+3]; a++) {
						cursor[axisa] = a;
						for (let b = box[axisb]; b <= box[axisb+3]; b++) {
							cursor[axisb] = b;
							let value = matrix.get(cursor[0], cursor[1], cursor[2]);
							if (value == null) return false; // Already occupied by box
							if (!value) {
								misses++;
								if (misses > max_misses) return false;
							}
						}
					}
					if (direction == 1) {
						box[axis+3] += 1;
					} else {
						box[axis] -= 1;
					}
					return true;
				}
				function shrink(box: MBox, axis: 0|1|2, direction: 1 | -1, min_matches?: number): boolean {
					if (box[axis] == box[axis+3]) return false;
					let axisa = (axis+1)%3;
					let axisb = (axis+2)%3;
					let cursor = box.slice(0, 3);
					if (direction == 1) {
						cursor[axis] = box[axis+3];
					}
					let surface_size = (box[axisa+3]-box[axisa]+1) * (box[axisb+3]-box[axisb]+1);
					min_matches = min_matches ?? (surface_size * match_factor);
					let matches = 0;
					for (let a = box[axisa]; a <= box[axisa+3]; a++) {
						cursor[axisa] = a;
						for (let b = box[axisb]; b <= box[axisb+3]; b++) {
							cursor[axisb] = b;
							let value = matrix.get(cursor[0], cursor[1], cursor[2]);
							if (value) {
								matches++;
								if (matches >= min_matches) return false;
							}
						}
					}
					if (direction == 1) {
						box[axis+3] -= 1;
					} else {
						box[axis] += 1;
					}
					return true;
				}

				let grow_iterations = 256;
				if (options.approach == 'shrink') {
					grow_iterations = Math.pow((options.complexity/25), 2) - 2;
					let stick_index = 0;
					for (let _i = 0; _i < Math.max(1, options.complexity); _i++) {
						let box: MBox = [0, 0, 0, 15, 23, 15];
						let directions = [true, true, true, true, true, true];

						let stick = stick_index % 7;
						for (let j = 0; j < 4; j++) {
							for (let i = 0; i < 4; i++) {
								if (directions[0]) directions[0] = shrink(box, 0, 1, stick == 1 ? 1 : undefined);
								if (directions[1]) directions[1] = shrink(box, 0, -1, stick == 2 ? 1 : undefined);
								if (directions[2]) directions[2] = shrink(box, 2, 1, stick == 3 ? 1 : undefined);
								if (directions[3]) directions[3] = shrink(box, 2, -1, stick == 4 ? 1 : undefined);
							}
							for (let i = 0; i < 6; i++) {
								if (directions[4]) directions[4] = shrink(box, 1, 1, stick == 5 ? 1 : undefined);
								if (directions[5]) directions[5] = shrink(box, 1, -1, stick == 6 ? 1 : undefined);
							}
						}
						directions = [true, true, true, true, true, true];
						for (let i = 0; i < lateral_size; i++) {
							if (directions[0]) directions[0] = expand(box, 0, 1, 0);
							if (directions[1]) directions[1] = expand(box, 0, -1, 0);
							if (directions[2]) directions[2] = expand(box, 2, 1, 0);
							if (directions[3]) directions[3] = expand(box, 2, -1, 0);
							if (directions[4]) directions[4] = expand(box, 1, 1, 0);
							if (directions[5]) directions[5] = expand(box, 1, -1, 0);
						}

						if (box[0] == box[3] && box[1] == box[4] && box[2] == box[5]) {
							let value_at_box = matrix.get(box[0], box[1], box[2]);
							if (!value_at_box) {
								// At the end and no collision found
								if (stick_index > 16) {
									break;
								} else {
									stick_index++;
									continue;
								}
							}
						}
						boxes.push(box);
						for (let x = box[0]; x <= box[3]; x++) {
							for (let y = box[1]; y <= box[4]; y++) {
								for (let z = box[2]; z <= box[5]; z++) {
									matrix.delete(x, y, z);
								}
							}
						}
					}
				}

				// Grow
				for (let _i = 0; _i < grow_iterations; _i++) {
					let keys = Object.keys(matrix.values);
					let key = keys.findLast(key => matrix.values[key] == true);
					if (!key) break;
					let start_coords = matrix.getVectorFromKey(key);
					let box: MBox = [...start_coords, ...start_coords];
					let directions = [true, true, true, true, true, true];

					for (let i = 0; i < lateral_size; i++) {
						if (directions[0]) directions[0] = expand(box, 0, 1);
						if (directions[1]) directions[1] = expand(box, 0, -1);
						if (directions[2]) directions[2] = expand(box, 2, 1);
						if (directions[3]) directions[3] = expand(box, 2, -1);
					}
					for (let i = 0; i < vertical_size; i++) {
						if (directions[4]) directions[4] = expand(box, 1, 1);
						if (directions[5]) directions[5] = expand(box, 1, -1);
					}
					boxes.push(box);
					for (let x = box[0]; x <= box[3]; x++) {
						for (let y = box[1]; y <= box[4]; y++) {
							for (let z = box[2]; z <= box[5]; z++) {
								matrix.delete(x, y, z);
							}
						}
					}
				}

				let i = 0;
				for (let box of boxes) {
					i++
					let bb = new BoundingBox({
						from: [box[0], box[1], box[2]],
						to: [box[3]+1, box[4]+1, box[5]+1],
						color: 1,
						name: 'bounding_box'
					}).addTo().init();
					bounding_boxes.push(bb);
				}

				Undo.finishEdit('Generate bounding boxes');
			}
			generate(false, default_options);

			Undo.amendEdit({
				visible_only: {label: 'Visible Elements Only', type: 'checkbox', value: default_options.visible_only},
				approach: {label: 'Approach', type: 'inline_select', value: 'grow', options: {
					grow: 'Grow',
					shrink: 'Shrink',
				}},
				complexity: {label: 'Complexity', type: 'range', min: 0, max: 100, value: default_options.complexity},
			}, result => {
				generate(true, result);
			})

		}
	})
})