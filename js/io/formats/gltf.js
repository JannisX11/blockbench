(function() {

function buildAnimationTracks(export_scale = Settings.get('model_export_scale'), do_quaternions = true) {
	let anims = [];
	Animator.animations.forEach(animation => {

		let ik_samples = animation.sampleIK();

		let tracks = [];
		for (var uuid in animation.animators) {
			let animator = animation.animators[uuid];
			
			if (animator.type == 'bone' && animator.getGroup()) {
				for (var channel in animator.channels) {
					if (channel == 'rotation' && ik_samples[uuid]) {

						let times = [];
						let values = [];
						let sample_rate = settings.animation_sample_rate.value;
						
						let interpolation = THREE.InterpolateLinear;
						ik_samples[uuid].forEach((sample, i) => {
							sample.euler.x += animator.group.mesh.fix_rotation.x;
							sample.euler.y += animator.group.mesh.fix_rotation.y;
							sample.euler.z += animator.group.mesh.fix_rotation.z;
							let quaternion = new THREE.Quaternion().setFromEuler(sample.euler);
							quaternion.toArray(values, values.length);
							times.push(i / sample_rate);
						})

						let track = new THREE.QuaternionKeyframeTrack(animator.group.mesh.uuid+'.quaternion', times, values, interpolation);
						track.group_uuid = animator.group.uuid;
						track.channel = 'quaternion';
						tracks.push(track);

					} else if (animator[channel] && animator[channel].length) {
						let times = [];
						let values = [];
						let keyframes = animator[channel].slice();

						// Sampling non-linear and math-based values
						let contains_script
						for (var kf of keyframes) {
							if (kf.interpolation == Keyframe.interpolation.catmullrom || kf.interpolation == Keyframe.interpolation.bezier) {
								contains_script = true; break;
							}
							for (var data_point of kf.data_points) {
								if (isNaN(data_point.x) || isNaN(data_point.y) || isNaN(data_point.z)) {
									contains_script = true; break;
								}
							}
							if (contains_script) break;
						}
						if (contains_script) {
							let interval = 1 / Math.clamp(settings.animation_sample_rate.value, 0.1, 500);
							let last_values;
							for (var time = 0; time < animation.length; time += interval) {
								Timeline.time = time;
								let values = animator.interpolate(channel, false)
								if (!values.equals(last_values) && !keyframes.find(kf => Math.epsilon(kf.time, time, interval))) {
									let new_keyframe = new Keyframe({
										time, channel,
										data_points: [{
											x: values[0],
											y: values[1],
											z: values[2],
										}] 
									}, null, animator)
									new_keyframe.animator = animator;
									keyframes.push(new_keyframe)
								}
								last_values = values;
							}
						}

						keyframes.sort((a, b) => a.time - b.time)

						// Sampling rotation steps that exceed 180 degrees
						if (channel === 'rotation' && !contains_script && do_quaternions) {
							let original_keyframes = keyframes.slice();
							original_keyframes.forEach((kf, i) => {
								let next = original_keyframes[i+1]
								if (!next) return;

								let k1 = kf.getArray(kf.data_points.length - 1);
								let k2 = next.getArray();
								let max_diff = Math.max(Math.abs(k1[0] - k2[0]), Math.abs(k1[1] - k2[1]), Math.abs(k1[2] - k2[2]));
								let steps = Math.floor(max_diff / 180 + 1);

								for (var step = 1; step < steps; step++) {

									Timeline.time = kf.time + (next.time - kf.time) * (step/steps);
									let values = animator.interpolate(channel, false)
									let new_keyframe = new Keyframe({
										time: Timeline.time, channel,
										data_points: [{
											x: values[0],
											y: values[1],
											z: values[2],
										}]
									}, null, animator)
									new_keyframe.animator = animator;
									keyframes.splice(keyframes.indexOf(kf) + step, 0, new_keyframe);
								}
							})
						}

						// Discontinuous keyframes
						keyframes.slice().forEach(kf => {
							if (kf.data_points.length > 1 && !kf.getArray(0).equals(kf.getArray(1))) {
								let new_keyframe = new Keyframe({
									time: kf.time + 0.004, channel,
									data_points: [kf.data_points[1]]
								}, null, animator)
								new_keyframe.animator = animator;
								keyframes.splice(keyframes.indexOf(kf) + 1, 0, new_keyframe);
							} 
						})

						let interpolation = THREE.InterpolateLinear;
						keyframes.forEach(kf => {
							if (kf.interpolation == Keyframe.interpolation.catmullrom) {
								interpolation = THREE.InterpolateSmooth
							}
							if (kf.interpolation == Keyframe.interpolation.step) {
								interpolation = THREE.InterpolateDiscrete
							}
							times.push(kf.time);
							Timeline.time = kf.time;
							let result = kf.getFixed(0, do_quaternions)
							if (do_quaternions) {
								result.toArray(values, values.length);
							} else {
								values.push(result.x, result.y, result.z);
							}
						})
						let trackType = THREE.VectorKeyframeTrack;
						if (channel === 'rotation' && do_quaternions) {
							trackType = THREE.QuaternionKeyframeTrack;
							channel = 'quaternion';
						} else if (channel == 'position') {
							values.forEach((val, i) => {
								values[i] = val/export_scale;
							})
						}
						let track = new trackType(animator.group.mesh.uuid+'.'+channel, times, values, interpolation);
						track.group_uuid = animator.group.uuid;
						track.channel = channel;
						tracks.push(track);
					}
				}
			} else if (animator instanceof BoneAnimator) {
				console.log(`Skip export of track ${uuid.substr(0, 7)}... - No connected bone`)
			}
		}
		if (tracks.length) {
			let clip = new THREE.AnimationClip(animation.name, animation.length, tracks)
			anims.push(clip);
		} else {
			console.log(`Skip export of animation ${animation.name} - No tracks generated`)
		}
	})
	return anims;
}

function buildSkinnedMesh(root_group, scale) {
	let skinIndices = [];
	let skinWeights = [];
	let position_array = [];
	let normal_array = [];
	let uv_array = [];
	let indices = [];
	let geometry = new THREE.BufferGeometry();
	let bones = [];
	let materials = [];
	let face_vertex_counts = [];

	let root_counter_matrix = new THREE.Matrix4().copy(root_group.mesh.matrix).invert();

	let vertex = Reusable.vec1;
	let normal = Reusable.vec2;

	function addGroup(group, parent_bone) {
		if (group.export == false) return;

		for (child of group.children) {
			if (!child.faces || child.export == false) continue;
			let {geometry} = child.mesh;
			let matrix = new THREE.Matrix4().copy(child.mesh.matrixWorld);
			matrix.premultiply(root_counter_matrix);
			
			let index_offset = position_array.length / 3;
			for (let i = 0; i < geometry.attributes.position.count; i++) {
				vertex.fromBufferAttribute(geometry.attributes.position, i);
				normal.fromBufferAttribute(geometry.attributes.normal, i);
				vertex.applyMatrix4(matrix);
				normal.transformDirection(matrix);

				position_array.push(vertex.x, vertex.y, vertex.z);
				normal_array.push(normal.x, normal.y, normal.z);

				skinIndices.push( 0, bones.length, 0, 0 );
				skinWeights.push( 0, 1, 0, 0 );
			}

			uv_array.push(...geometry.attributes.uv.array);

			indices.push(...geometry.index.array.map(v => index_offset + v));


			for (let key in child.faces) {
				let face = child.faces[key];
				if (face.vertices && face.vertices.length < 3) continue;
				if (face.texture === null) continue;
				let tex = face.getTexture();
				if (tex && tex.uuid) {
					materials.push(tex.getMaterial())
				} else {
					materials.push(Canvas.emptyMaterials[child.color])
				}
				if (face.vertices && face.vertices.length == 3) {
					face_vertex_counts.push(3);
				} else {
					face_vertex_counts.push(6);
				}
			}
		}
		// Bone
		let bone = new THREE.Bone();
		bone.name = group.name;
		bone.uuid = group.mesh.uuid;
		bone.position.copy(group.mesh.position);
		bone.rotation.copy(group.mesh.rotation)
		if (group == root_group) {
			bone.position.set(0, 0, 0);
		}
		bone.position.multiplyScalar(1 / scale);
		bones.push(bone);
		if (parent_bone) {
			parent_bone.add(bone);
		}
		// Children
		for (child of group.children) {
			if (child instanceof Group) {
				addGroup(child, bone);
			}
		}
	}
	addGroup(root_group);

	geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(position_array), 3));
	geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normal_array), 3));
	geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv_array), 2)), 
	geometry.setIndex(indices);
	
	geometry.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( skinIndices, 4 ) );
	geometry.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( skinWeights, 4 ) );


	if (materials.allEqual(materials[0])) materials = materials[0];

	// Generate material groups
	if (materials instanceof Array) {
		let current_mat;
		let i = 0;
		let index = 0;
		let switch_index = 0;
		let reduced_materials = [];

		geometry.groups.empty();

		for (let material of materials) {
			if (current_mat != material) {
				if (index) {
					geometry.addGroup(switch_index, index - switch_index, reduced_materials.length);
					reduced_materials.push(current_mat);
				}
				current_mat = material;
				switch_index = index;
			}

			index += face_vertex_counts[i];
			i++;
		}
		geometry.addGroup(switch_index, index - switch_index, reduced_materials.length);
		reduced_materials.push(current_mat);

		materials = reduced_materials;
	}


	let skinned_mesh = new THREE.SkinnedMesh(geometry, materials);
	skinned_mesh.name = root_group.name;
	let skeleton = new THREE.Skeleton(bones)
	skeleton.name = root_group.name;

	skinned_mesh.add(skeleton.bones[0]);
	skinned_mesh.bind(skeleton);

	skinned_mesh.position.copy(root_group.mesh.position);
	skinned_mesh.rotation.copy(root_group.mesh.rotation);

	bones.forEach(bone => {
		bone.position.multiplyScalar(scale);
	})

	return skinned_mesh;
}

var codec = new Codec('gltf', {
	name: 'GLTF Model',
	extension: 'gltf',
	support_partial_export: true,
	export_options: {
		encoding: {type: 'select', label: 'codec.common.encoding', options: {ascii: 'ASCII (glTF)', binary: 'Binary (glb)'}},
		scale: {label: 'settings.model_export_scale', type: 'number', value: Settings.get('model_export_scale')},
		embed_textures: {type: 'checkbox', label: 'codec.common.embed_textures', value: true},
		armature: {type: 'checkbox', label: tl('codec.common.armature') + ' (Experimental)', value: false},
		animations: {label: 'codec.common.export_animations', type: 'checkbox', value: true}
	},
	async compile(options) {
		options = Object.assign(this.getExportOptions(), options);
		let scope = this;
		let exporter = new THREE.GLTFExporter();
		let animations = [];
		let gl_scene = new THREE.Scene();
		gl_scene.name = 'blockbench_export'

		let resetMeshBorrowing;

		if (!Modes.edit) {
			Animator.showDefaultPose();
		}
		if (options.armature) {
			Outliner.root.forEach(node => {
				if (node instanceof Group) {
					let armature = buildSkinnedMesh(node, options.scale);
					gl_scene.add(armature);
				} else {
					gl_scene.add(node.mesh);
				}
			})
			resetMeshBorrowing = function() {
				Outliner.root.forEach(node => {
					if (node instanceof Group == false) {
						gl_scene.add(node.mesh);
					}
				})
			}

		} else {
			gl_scene.add(Project.model_3d);
			resetMeshBorrowing = function() {
				scene.add(Project.model_3d);
			}
		}
		
		try {
			if (BarItems.view_mode.value !== 'textured') {
				BarItems.view_mode.set('textured');
				BarItems.view_mode.onChange();
			}
			if (options.animations !== false) {
				animations = buildAnimationTracks(options.scale);
			}
			let result = await new Promise((resolve, reject) => {
				exporter.parse(gl_scene, resolve, {
					animations,
					onlyVisible: false,
					trs: true,
					binary: options.encoding == 'binary',
					truncateDrawRange: false,
					forcePowerOfTwoTextures: true,
					scale_factor: 1/options.scale,
					embedImages: options.embed_textures != false,
					exportFaceColors: false,
				});
			})
			resetMeshBorrowing();
			
			scope.dispatchEvent('compile', {model: result, options});
			if (options.encoding == 'binary') {
				return result;
			} else {
				return JSON.stringify(result);
			}

		} catch (err) {
			resetMeshBorrowing();
			throw err;
		}
	},
	async export() {
		let options = await this.promptExportOptions();
		if (options === null) return;
		let content = await this.compile();
		await new Promise(r => setTimeout(r, 20));
		Blockbench.export({
			resource_id: 'gltf',
			type: this.name,
			extensions: [this.getExportOptions().encoding == 'binary' ? 'glb' : 'gltf'],
			name: this.fileName(),
			startpath: this.startPath(),
			content,
			custom_writer: isApp ? (a, b) => this.write(a, b) : null,
		}, path => this.afterDownload(path));
	}
})

codec.buildAnimationTracks = buildAnimationTracks;

BARS.defineActions(function() {
	codec.export_action = new Action({
		id: 'export_gltf',
		icon: 'icon-gltf',
		category: 'file',
		click: function () {
			codec.export()
		}
	})
})

})()
