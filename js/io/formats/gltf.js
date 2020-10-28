(function() {

function buildAnimationTracks() {
	let anims = [];
	Animator.animations.forEach(animation => {

		let tracks = [];
		for (var uuid in animation.animators) {
			let animator = animation.animators[uuid];
			
			if (animator instanceof BoneAnimator && animator.getGroup()) {
				for (var channel of animator.channels) {
					if (animator[channel] && animator[channel].length) {
						let times = [];
						let values = [];
						let keyframes = animator[channel].slice();

						// Sampling calculated (molang) values
						let contains_script
						for (var kf of keyframes) {
							if (kf.interpolation != 'linear') {
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
							var last_values;
							for (var time = 0; time < animation.length; time += 1/24) {
								Timeline.time = time;
								let values = animator.interpolate(channel, false)
								if (!values.equals(last_values) && !keyframes.find(kf => Math.epsilon(kf.time, time, 1/24))) {
									let new_keyframe = new Keyframe({
										time, channel,
										data_points: [{
											x: values[0],
											y: values[1],
											z: values[2],
										}] 
									})
									new_keyframe.animator = animator;
									keyframes.push(new_keyframe)
								}
								last_values = values;
							}
						}

						keyframes.sort((a, b) => a.time - b.time)

						// Sampling rotation steps that exceed 180 degrees
						if (channel === 'rotation' && !contains_script) {
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
									})
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
								})
								new_keyframe.animator = animator;
								keyframes.splice(keyframes.indexOf(kf) + 1, 0, new_keyframe);
							} 
						})

						let interpolation = THREE.InterpolateLinear;
						keyframes.forEach(kf => {
							if (kf.interpolation == Keyframe.interpolation.catmullrom) {
								interpolation = THREE.InterpolateSmooth
							}
							times.push(kf.time);
							Timeline.time = kf.time;
							kf.getFixed().toArray(values, values.length);
						})
						let trackType = THREE.VectorKeyframeTrack;
						if (channel === 'rotation') {
							trackType = THREE.QuaternionKeyframeTrack;
							channel = 'quaternion';
						}
						let track = new trackType(animator.group.mesh.uuid+'.'+channel, times, values, interpolation);
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

var codec = new Codec('gltf', {
	name: 'GLTF Model',
	extension: 'gltf',
	compile(options = 0, callback) {
		let scope = this;
		let exporter = new THREE.GLTFExporter();
		let animations = [];
		let gl_scene = new THREE.Scene();
		gl_scene.name = 'blockbench_export'

		scene.children.forEachReverse(object => {
			if (object.isGroup || object.isElement) {
				gl_scene.add(object);
			}
		});
		if (!Modes.edit) {
			Animator.showDefaultPose();
		}
		if (options.animations !== false) {
			animations = buildAnimationTracks();
		}
		exporter.parse(gl_scene, (json) => {

			scope.dispatchEvent('compile', {model: json, options});
			callback(JSON.stringify(json));

			gl_scene.children.forEachReverse(object => {
				if (object.isGroup || object.isElement) {
					scene.add(object);
				}
			});
		}, {
			animations,
			onlyVisible: false,
			trs: true,
			truncateDrawRange: false,
			forcePowerOfTwoTextures: true,
			exportFaceColors: false
		});
	},
	export() {
		var scope = codec;
		scope.compile(0, content => {
			setTimeout(_ => {
				Blockbench.export({
					resource_id: 'gltf',
					type: scope.name,
					extensions: [scope.extension],
					name: scope.fileName(),
					startpath: scope.startPath(),
					content,
					custom_writer: isApp ? (a, b) => scope.write(a, b) : null,
				}, path => scope.afterDownload(path))
			}, 20)
		})
	}
})

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
