(function() {



var codec = new Codec('gltf', {
	name: 'GLTF Model',
	extension: 'gltf',
	compile(options = 0, cb) {
		let exporter = new THREE.GLTFExporter();
		let animations = [];
		let gl_scene = new THREE.Scene();
		gl_scene.name = 'blockbench_export'

		scene.children.forEach(object => {
			if (object.isGroup || object.isElement) {
				gl_scene.add(object);
			}
		});
		if (!Modes.edit) {
			Animator.showDefaultPose();
		}
		if (options.animations !== false) {
			Animator.animations.forEach(animation => {

				let tracks = [];
				for (var uuid in animation.animators) {
					let animator = animation.animators[uuid];
					
					if (animator instanceof BoneAnimator && animator.getGroup()) {
						for (var channel of animator.channels) {
							if (animator[channel] && animator[channel].length) {
								let times = [];
								let values = [];
								animator[channel].forEach(kf => {
									times.push(kf.time);
									Timeline.time = kf.time;
									kf.getFixed().toArray(values, values.length);
								})
								let trackType = THREE.VectorKeyframeTrack;
								if (channel === 'rotation') {
									trackType = THREE.QuaternionKeyframeTrack;
									channel = 'quaternion';
								}
								let track = new trackType(animator.group.mesh.uuid+'.'+channel, times, values, THREE.InterpolateLinear);
								tracks.push(track);
							}
						}
					} else if (animator instanceof BoneAnimator) {
						console.log(`Skip export of track ${uuid.substr(0, 7)}... - No connected bone`)
					}
				}
				if (tracks.length) {
					let clip = new THREE.AnimationClip(animation.name, animation.length, tracks)
					animations.push(clip);
				} else {
					console.log(`Skip export of animation ${animation.name} - No tracks generated`)
				}
			})
		}
		exporter.parse(gl_scene, (json) => {

			cb(JSON.stringify(json));

			gl_scene.children.forEach(object => {
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
			Blockbench.export({
				type: scope.name,
				extensions: [scope.extension],
				name: scope.fileName(),
				startpath: scope.startPath(),
				content,
				custom_writer: isApp ? (a, b) => scope.write(a, b) : null,
			}, path => scope.afterDownload(path))
		})
	}
})

BARS.defineActions(function() {
	codec.export_action = new Action({
		id: 'export_gltf',
		icon: 'fas.fa-ring',
		category: 'file',
		click: function () {
			codec.export()
		}
	})
})

})()
