(function() {

function buildAnimationTracks(do_quaternions = true) {
	let export_scale = Settings.get('model_export_scale');
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
							if (kf.interpolation == Keyframe.interpolation.catmullrom) {
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

var codec = new Codec('gltf', {
	name: 'GLTF Model',
	extension: 'gltf',
	async compile(options = 0) {
		let scope = this;
		let exporter = new THREE.GLTFExporter();
		let animations = [];
		let gl_scene = new THREE.Scene();
		gl_scene.name = 'blockbench_export'
		gl_scene.add(Project.model_3d);
		
		try {
			if (!Modes.edit) {
				Animator.showDefaultPose();
			}
			if (BarItems.view_mode.value !== 'textured') {
				BarItems.view_mode.set('textured');
				BarItems.view_mode.onChange();
			}
			if (options.animations !== false) {
				animations = buildAnimationTracks();
			}
			let json = await new Promise((resolve, reject) => {
				exporter.parse(gl_scene, resolve, {
					animations,
					onlyVisible: false,
					trs: true,
					truncateDrawRange: false,
					forcePowerOfTwoTextures: true,
					scale_factor: 1/Settings.get('model_export_scale'),
					exportFaceColors: false,
				});
			})
			scene.add(Project.model_3d);
			
			scope.dispatchEvent('compile', {model: json, options});
			return JSON.stringify(json);

		} catch (err) {
			scene.add(Project.model_3d);
			throw err;
		}
	},
	export() {
		var scope = codec;
		scope.compile().then(content => {
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
