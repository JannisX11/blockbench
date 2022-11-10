class GeneralAnimator {
	constructor(uuid, animation) {
		this.animation = animation;
		this.expanded = false;
		this.selected = false;
		this.uuid = uuid || guid();
		this.muted = {};
		for (let channel in this.channels) {
			this.muted[channel] = false;
		}
	}
	get keyframes() {
		let array = [];
		for (let channel in this.channels) {
			if (this[channel] && this[channel].length) array.push(...this[channel]);
		}
		return array;
	}
	select() {
		var scope = this;
		for (var key in this.animation.animators) {
			this.animation.animators[key].selected = false;
		}
		this.selected = true;
		Timeline.selected_animator = this;
		this.addToTimeline();
		Vue.nextTick(() => {
			scope.scrollTo();
		})
		return this;
	}
	addToTimeline() {
		if (!Timeline.animators.includes(this)) {
			Timeline.animators.splice(0, 0, this);
		}
		for (let channel in this.channels) {
			if (!this[channel]) this[channel] = [];
		}
		if (!this.expanded) this.expanded = true;
		return this;
	}
	addKeyframe(data, uuid) {
		var channel = data.channel;
		if (typeof channel == 'number') channel = Object.keys(this.channels)[channel];
		if (channel && this[channel]) {
			var kf = new Keyframe(data, uuid, this);
			this[channel].push(kf);
			kf.animator = this;
			return kf;
		}
	}
	createKeyframe(value, time, channel, undo, select) {
		if (!this.channels[channel]) return;
		if (typeof time !== 'number') time = Timeline.time;
		var keyframes = [];
		if (undo) {
			Undo.initEdit({keyframes})
		}
		var keyframe = new Keyframe({
			channel: channel,
			time: time
		}, null, this);
		keyframes.push(keyframe);

		if (value) {
			keyframe.extend(value);
		} else if (this.channels[channel].transform && this.fillValues) {
			this.fillValues(keyframe, value, true);
		}

		keyframe.channel = channel;
		keyframe.time = Timeline.snapTime(time);

		this[channel].push(keyframe);
		keyframe.animator = this;

		if (select !== false) {
			keyframe.select();
		}
		var deleted = [];
		delete keyframe.time_before;
		keyframe.replaceOthers(deleted);
		Undo.addKeyframeCasualties(deleted);
		Animation.selected.setLength();

		if (undo) {
			Undo.finishEdit('Add keyframe')
		}
		return keyframe;
	}
	getOrMakeKeyframe(channel) {
		let before, result;
		let epsilon = Timeline.getStep()/2 || 0.01;

		for (let kf of this[channel]) {
			if (Math.abs(kf.time - Timeline.time) <= epsilon) {
				before = kf;
			}
		}
		result = before ? before : this.createKeyframe(null, Timeline.time, channel, false, false);
		return {before, result};
	}
	showContextMenu(event) {
		Prop.active_panel = 'timeline'
		if (!this.selected) {
			this.select()
		}
		if (this.menu) {
			this.menu.open(event, this);
		}
		return this;
	}
	toggleMuted(channel) {
		this.muted[channel] = !this.muted[channel];
		if (this instanceof BoneAnimator) Animator.preview();
		return this;
	}
	scrollTo() {
		var el = $(`#timeline_body_inner > li[uuid=${this.uuid}]`).get(0)
		if (el) {
			var offset = el.offsetTop;
			var timeline = document.getElementById('timeline_body');
			var scroll_top = timeline.scrollTop;
			var height = timeline.clientHeight;
			if (offset < scroll_top) {
				$(timeline).animate({
					scrollTop: offset
				}, 200);
			}
			if (offset + el.clientHeight > scroll_top + height) {
				$(timeline).animate({
					scrollTop: offset - (height-el.clientHeight-20)
				}, 200);
			}
		}
	}
}
GeneralAnimator.addChannel = function(channel, options) {
	this.prototype.channels[channel] = {
		name: options.name || channel,
		transform: options.transform || false,
		mutable: typeof options.mutable === 'boolean' ? options.mutable : true,
		max_data_points: options.max_data_points || 0
	}
	ModelProject.all.forEach(project => {
		if (!project.animations)
		project.animations.forEach(animation => {
			animation.animators.forEach(animator => {
				if (animator instanceof this && !animator[channel]) {
					Vue.set(animator, channel, []);
					if (this.prototype.channels[channel].mutable) {
						Vue.set(animator.muted, channel, false);
					}
				}
			})
		})
	})
	Timeline.vue.$forceUpdate();
}
class BoneAnimator extends GeneralAnimator {
	constructor(uuid, animation, name) {
		super(uuid, animation);
		this.uuid = uuid;
		this._name = name;
		this.rotation_global = false;

		for (let channel in this.channels) {
			this[channel] = [];
		}
	}
	get name() {
		var group = this.getGroup();
		if (group) return group.name;
		return this._name;
	}
	set name(name) {
		this._name = name;
	}
	getGroup() {
		this.group = OutlinerNode.uuids[this.uuid];
		return this.group
	}
	select(group_is_selected) {
		if (!this.getGroup()) {
			unselectAll();
			return this;
		}
		if (this.group.locked) return;

		var duplicates;
		for (var key in this.animation.animators) {
			this.animation.animators[key].selected = false;
		}
		if (group_is_selected !== true && this.group) {
			this.group.select();
		}
		Group.all.forEach(group => {
			if (group.name == group.selected.name && group != Group.selected) {
				duplicates = true;
			}
		})
		function iterate(arr) {
			arr.forEach((it) => {
				if (it.type === 'group' && !duplicates) {
					if (it.name === Group.selected.name && it !== Group.selected) {
						duplicates = true;
					} else if (it.children && it.children.length) {
						iterate(it.children);
					}
				}
			})
		}
		iterate(Outliner.root);
		if (duplicates) {
			Blockbench.showMessageBox({
				translateKey: 'duplicate_groups',
				icon: 'folder',
			});
		}
		super.select();
		
		if (this[Toolbox.selected.animation_channel] && (Timeline.selected.length == 0 || Timeline.selected[0].animator != this)) {
			var nearest;
			this[Toolbox.selected.animation_channel].forEach(kf => {
				if (Math.abs(kf.time - Timeline.time) < 0.002) {
					nearest = kf;
				}
			})
			if (nearest) {
				nearest.select();
			}
		}

		if (this.group && this.group.parent && this.group.parent !== 'root') {
			this.group.parent.openUp();
		}
		return this;
	}
	fillValues(keyframe, values, allow_expression, round = true) {
		if (values instanceof Array) {
			keyframe.extend({
				data_points: [{
					x: values[0],
					y: values[1],
					z: values[2]
				}]
			})
		} else if (typeof values === 'number' || typeof values === 'string') {
			keyframe.extend({
				data_points: [{
					x: values,
					y: values,
					z: values
				}]
			})
		} else if (values === null) {
			let original_time = Timeline.time;
			Timeline.time = keyframe.time;
			var ref = this.interpolate(keyframe.channel, allow_expression)
			Timeline.time = original_time;
			if (ref) {
				if (round) {
					let e = keyframe.channel == 'scale' ? 1e4 : 1e2
					ref.forEach((r, i) => {
						if (!isNaN(r)) {
							ref[i] = Math.round(parseFloat(r)*e)/e
						}
					})
				}
				keyframe.extend({
					data_points: [{
						x: ref[0],
						y: ref[1],
						z: ref[2],
					}]
				})
			}
			let closest;
			this[keyframe.channel].forEach(kf => {
				if (!closest || Math.abs(kf.time - keyframe.time) < Math.abs(closest.time - keyframe.time)) {
					closest = kf;
				}
			});
			keyframe.extend({
				interpolation: closest && closest.interpolation,
				uniform: (keyframe.channel == 'scale')
					? (closest && closest.uniform && closest.data_points[0].x == closest.data_points[0].y && closest.data_points[0].x == closest.data_points[0].z)
					: undefined,
			})
		} else {
			keyframe.extend(values)
		}
	}
	pushKeyframe(keyframe) {
		this[keyframe.channel].push(keyframe)
		keyframe.animator = this;
		return this;
	}
	doRender() {
		this.getGroup()
		if (this.group && this.group.children && this.group.mesh) {
			let mesh = this.group.mesh
			return (mesh && mesh.fix_rotation)
		}
	}
	displayRotation(arr, multiplier = 1) {
		var bone = this.group.mesh

		if (arr) {
			if (arr.length === 4) {
				var added_rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(arr), 'ZYX')
				bone.rotation.x -= added_rotation.x * multiplier
				bone.rotation.y -= added_rotation.y * multiplier
				bone.rotation.z += added_rotation.z * multiplier
			} else {
				arr.forEach((n, i) => {
					bone.rotation[getAxisLetter(i)] += Math.degToRad(n) * (i == 2 ? 1 : -1) * multiplier
				})
			}
		}
		if (this.rotation_global) {
			let quat = bone.parent.getWorldQuaternion(Reusable.quat1);
			quat.invert();
			bone.quaternion.premultiply(quat);
			
		}
		return this;
	}
	displayPosition(arr, multiplier = 1) {
		var bone = this.group.mesh
		if (arr) {
			bone.position.x -= arr[0] * multiplier;
			bone.position.y += arr[1] * multiplier;
			bone.position.z += arr[2] * multiplier;
		}
		return this;
	}
	displayScale(arr, multiplier = 1) {
		if (!arr) return this;
		var bone = this.group.mesh;
		bone.scale.x *= (1 + (arr[0] - 1) * multiplier) || 0.00001;
		bone.scale.y *= (1 + (arr[1] - 1) * multiplier) || 0.00001;
		bone.scale.z *= (1 + (arr[2] - 1) * multiplier) || 0.00001;
		return this;
	}
	interpolate(channel, allow_expression, axis) {
		let time = this.animation.time;
		var before = false
		var after = false
		var result = false
		let epsilon = 1/1200;

		function mapAxes(cb) {
			if (!Animator._last_values[channel]) Animator._last_values[channel] = [0, 0, 0];
			if (axis) {
				let result = cb(axis);
				Animator._last_values[channel][axis] = result;
				return result;
			} else {
				return ['x', 'y', 'z'].map(axis => {
					let result = cb(axis);
					Animator._last_values[channel][axis] = result;
					return result;
				});
			}
		}

		for (var keyframe of this[channel]) {

			if (keyframe.time < time) {
				if (!before || keyframe.time > before.time) {
					before = keyframe
				}
			} else  {
				if (!after || keyframe.time < after.time) {
					after = keyframe
				}
			}
			i++;
		}
		if (before && Math.epsilon(before.time, time, epsilon)) {
			result = before
		} else if (after && Math.epsilon(after.time, time, epsilon)) {
			result = after
		} else if (before && before.interpolation == Keyframe.interpolation.step) {
			result = before
		} else if (before && !after) {
			result = before
		} else if (after && !before) {
			result = after
		} else if (!before && !after) {
			//
		} else {
			let no_interpolations = Blockbench.hasFlag('no_interpolations')
			let alpha = Math.getLerp(before.time, after.time, time)

			if (no_interpolations || (before.interpolation !== Keyframe.interpolation.catmullrom && after.interpolation !== Keyframe.interpolation.catmullrom)) {
				if (no_interpolations) {
					alpha = Math.round(alpha)
				}
				return mapAxes(axis => before.getLerp(after, axis, alpha, allow_expression));
			} else {

				let sorted = this[channel].slice().sort((kf1, kf2) => (kf1.time - kf2.time));
				let before_index = sorted.indexOf(before);
				let before_plus = sorted[before_index-1];
				let after_plus = sorted[before_index+2];

				return mapAxes(axis => before.getCatmullromLerp(before_plus, before, after, after_plus, axis, alpha));
			}
		}
		if (result && result instanceof Keyframe) {
			let keyframe = result
			let method = allow_expression ? 'get' : 'calc'
			let dp_index = (keyframe.time > time || Math.epsilon(keyframe.time, time, epsilon)) ? 0 : keyframe.data_points.length-1;

			return mapAxes(axis => keyframe[method](axis, dp_index));
		}
		return false;
	}
	displayFrame(multiplier = 1) {
		if (!this.doRender()) return;
		this.getGroup()

		if (!this.muted.rotation) this.displayRotation(this.interpolate('rotation'), multiplier)
		if (!this.muted.position) this.displayPosition(this.interpolate('position'), multiplier)
		if (!this.muted.scale) this.displayScale(this.interpolate('scale'), multiplier)
	}
}
	BoneAnimator.prototype.type = 'bone';
	BoneAnimator.prototype.channels = {
		rotation: {name: tl('timeline.rotation'), mutable: true, transform: true, max_data_points: 2},
		position: {name: tl('timeline.position'), mutable: true, transform: true, max_data_points: 2},
		scale: {name: tl('timeline.scale'), mutable: true, transform: true, max_data_points: 2},
	}
	Group.animator = BoneAnimator;
	BoneAnimator.prototype.menu = new Menu('bone_animator', [
		{
			id: 'rotation_global',
			name: 'menu.animator.rotation_global',
			condition: animator => animator.type == 'bone',
			icon: (animator) => animator.rotation_global,
			click(animator) {
				Undo.initEdit({animations: [Animation.selected]});
				animator.rotation_global = !animator.rotation_global;
				Undo.finishEdit('Toggle rotation in global space');
				Animator.preview();
			}
		}
	])

class NullObjectAnimator extends BoneAnimator {
	constructor(uuid, animation, name) {
		super(uuid, animation);
		this.uuid = uuid;
		this._name = name;

		this.solver = new FIK.Structure3D(scene);
		this.chain = new FIK.Chain3D();

		this.position = [];
	}
	get name() {
		var element = this.getElement();
		if (element) return element.name;
		return this._name;
	}
	set name(name) {
		this._name = name;
	}
	getElement() {
		this.element = OutlinerNode.uuids[this.uuid];
		return this.element
	}
	select(element_is_selected) {
		if (!this.getElement()) {
			unselectAll();
			return this;
		}
		if (this.getElement().locked) return;

		if (element_is_selected !== true && this.element) {
			this.element.select();
		}
		GeneralAnimator.prototype.select.call(this);
		
		if (this[Toolbox.selected.animation_channel] && (Timeline.selected.length == 0 || Timeline.selected[0].animator != this)) {
			var nearest;
			this[Toolbox.selected.animation_channel].forEach(kf => {
				if (Math.abs(kf.time - Timeline.time) < 0.002) {
					nearest = kf;
				}
			})
			if (nearest) {
				nearest.select();
			}
		}

		if (this.element && this.element.parent && this.element.parent !== 'root') {
			this.element.parent.openUp();
		}
		return this;
	}
	doRender() {
		this.getElement()
		return (this.element && this.element && this.element.mesh);
	}
	displayPosition(arr, multiplier = 1) {
		var bone = this.element.mesh
		if (arr) {
			bone.position.x -= arr[0] * multiplier;
			bone.position.y += arr[1] * multiplier;
			bone.position.z += arr[2] * multiplier;
		}
		return this;
	}
	displayIK(get_samples) {
		let null_object = this.getElement();
		let target = [...Group.all, ...Locator.all].find(node => node.uuid == null_object.ik_target);
		if (!null_object || !target) return;

		let bones = [];
		let ik_target = new THREE.Vector3().copy(null_object.getWorldCenter(true));
		let bone_references = [];
		let current = target.parent;

		let target_original_quaternion = null_object.lock_ik_target_rotation &&
			target instanceof Group &&
			target.mesh.getWorldQuaternion(new THREE.Quaternion());

		while (current !== null_object.parent) {
			bones.push(current);
			current = current.parent;
		}
		if (!bones.length) return;
		bones.reverse();
		
		bones.forEach(bone => {
			if (bone.mesh.fix_rotation) bone.mesh.rotation.copy(bone.mesh.fix_rotation);
		})

		bones.forEach((bone, i) => {
			let startPoint = new FIK.V3(0,0,0).copy(bone.mesh.getWorldPosition(new THREE.Vector3()));
			let endPoint = new FIK.V3(0,0,0).copy(bones[i+1] ? bones[i+1].mesh.getWorldPosition(new THREE.Vector3()) : null_object.getWorldCenter(false));

			let ik_bone = new FIK.Bone3D(startPoint, endPoint);
			this.chain.addBone(ik_bone);

			bone_references.push({
				bone,
				last_diff: new THREE.Vector3(
					(bones[i+1] ? bones[i+1] : target).origin[0] - bone.origin[0],
					(bones[i+1] ? bones[i+1] : target).origin[1] - bone.origin[1],
					(bones[i+1] ? bones[i+1] : target).origin[2] - bone.origin[2]
				).normalize()
			})
		})

		this.solver.add(this.chain, ik_target , true);
		this.solver.meshChains[0].forEach(mesh => {
			mesh.visible = false;
		})

		this.solver.update();
		
		let results = {};
		bone_references.forEach((bone_ref, i) => {
			let start = Reusable.vec1.copy(this.solver.chains[0].bones[i].start);
			let end = Reusable.vec2.copy(this.solver.chains[0].bones[i].end);
			bones[i].mesh.worldToLocal(start);
			bones[i].mesh.worldToLocal(end);

			Reusable.quat1.setFromUnitVectors(bone_ref.last_diff, end.sub(start).normalize());
			let rotation = get_samples ? new THREE.Euler() : Reusable.euler1;
			rotation.setFromQuaternion(Reusable.quat1, 'ZYX');

			bone_ref.bone.mesh.rotation.x += rotation.x;
			bone_ref.bone.mesh.rotation.y += rotation.y;
			bone_ref.bone.mesh.rotation.z += rotation.z;
			bone_ref.bone.mesh.updateMatrixWorld();

			if (get_samples) {
				results[bone_ref.bone.uuid] = {
					euler: rotation,
					array: [
						Math.radToDeg(-rotation.x),
						Math.radToDeg(-rotation.y),
						Math.radToDeg(rotation.z),
					]
				}
			}
		})

		if (target_original_quaternion) {
			let rotation = get_samples ? new THREE.Euler() : Reusable.euler1;
			rotation.copy(target.mesh.rotation);

			target.mesh.quaternion.copy(target_original_quaternion);
			let q1 = target.mesh.parent.getWorldQuaternion(Reusable.quat1);
			target.mesh.quaternion.premultiply(q1.invert())
			target.mesh.updateMatrixWorld();

			rotation.x = target.mesh.rotation.x - rotation.x;
			rotation.y = target.mesh.rotation.y - rotation.y;
			rotation.z = target.mesh.rotation.z - rotation.z;

			if (get_samples) {
				results[target.uuid] = {
					euler: rotation,
					array: [
						Math.radToDeg(-rotation.x),
						Math.radToDeg(-rotation.y),
						Math.radToDeg(rotation.z),
					]
				}
			}
		}

		this.solver.clear();
		this.chain.clear();
		this.chain.lastTargetLocation.set(1e9, 0, 0);

		if (get_samples) return results;
	}
	displayFrame(multiplier = 1) {
		if (!this.doRender()) return;
		this.getElement()

		if (!this.muted.position) {
			this.displayPosition(this.interpolate('position'), multiplier);
			this.displayIK();
		}
	}
}
	NullObjectAnimator.prototype.type = 'null_object';
	NullObjectAnimator.prototype.channels = {
		position: {name: tl('timeline.position'), mutable: true, transform: true, max_data_points: 2},
	}
	NullObject.animator = NullObjectAnimator;

class EffectAnimator extends GeneralAnimator {
	constructor(animation) {
		super(null, animation);
		this.last_displayed_time = 0;

		this.name = tl('timeline.effects')
		this.selected = false;

		for (let channel in this.channels) {
			this[channel] = [];
		}
	}
	pushKeyframe(keyframe) {
		this[keyframe.channel].push(keyframe)
		keyframe.animator = this;
		return this;
	}
	displayFrame(in_loop) {
		if (in_loop && !this.muted.sound) {
			this.sound.forEach(kf => {
				var diff = kf.time - this.animation.time;
				if (diff >= 0 && diff < (1/60) * (Timeline.playback_speed/100)) {
					if (kf.data_points[0].file && !kf.cooldown) {
						var media = new Audio(kf.data_points[0].file);
						media.playbackRate = Math.clamp(Timeline.playback_speed/100, 0.1, 4.0);
						media.volume = Math.clamp(settings.volume.value/100, 0, 1);
						media.play().catch(() => {});
						Timeline.playing_sounds.push(media);
						media.onended = function() {
							Timeline.playing_sounds.remove(media);
						}

						kf.cooldown = true;
						setTimeout(() => {
							delete kf.cooldown;
						}, 400)
					} 
				}
			})
		}
		
		if (!this.muted.particle) {
			this.particle.forEach(kf => {
				var diff = this.animation.time - kf.time;
				if (diff >= 0) {
					let i = 0;
					for (var data_point of kf.data_points) {
						let particle_effect = data_point.file && Animator.particle_effects[data_point.file]
						if (particle_effect) {

							let emitter = particle_effect.emitters[kf.uuid + i];
							if (!emitter) {
								let i_here = i;
								emitter = particle_effect.emitters[kf.uuid + i] = new Wintersky.Emitter(WinterskyScene, particle_effect.config);
								emitter.on('start', ({params}) => {
									let kf_now = Animation.selected.animators.effects && Animation.selected.animators.effects.particle.find(kf2 => kf2.uuid == kf.uuid);
									let data_point_now = kf_now && kf_now.data_points[i_here];
									if (data_point_now) {
										emitter.Molang.parse(data_point_now.script, Animator.MolangParser.global_variables);
									}
								})
							}

							var locator = data_point.locator && Locator.all.find(l => l.name == data_point.locator)
							if (locator) {
								locator.mesh.add(emitter.local_space);
								emitter.parent_mode = 'locator';
							} else {
								emitter.parent_mode = 'entity';
							}
							scene.add(emitter.global_space);
							emitter.jumpTo(diff);
						} 
						i++;
					}
				}
			})
		}
		
		if (!this.muted.timeline) {
			this.timeline.forEach(kf => {
				if ((kf.time > this.last_displayed_time && kf.time <= this.animation.time) || Math.epsilon(kf.time, this.animation.time, 0.01)) {
					let script = kf.data_points[0].script;
					Animator.MolangParser.parse(script);
				}
			})
		}

		this.last_displayed_time = this.animation.time;
	}
	startPreviousSounds() {
		if (!this.muted.sound) {
			this.sound.forEach(kf => {
				if (kf.data_points[0].file && !kf.cooldown) {
					var diff = kf.time - this.animation.time;
					if (diff < 0 && Timeline.waveforms[kf.data_points[0].file] && Timeline.waveforms[kf.data_points[0].file].duration > -diff) {
						var media = new Audio(kf.data_points[0].file);
						media.playbackRate = Math.clamp(Timeline.playback_speed/100, 0.1, 4.0);
						media.volume = Math.clamp(settings.volume.value/100, 0, 1);
						media.currentTime = -diff;
						media.play().catch(() => {});
						Timeline.playing_sounds.push(media);
						media.onended = function() {
							Timeline.playing_sounds.remove(media);
						}

						kf.cooldown = true;
						setTimeout(() => {
							delete kf.cooldown;
						}, 400)
					} 
				}
			})
		}
	}
}
	EffectAnimator.prototype.type = 'effect';
	EffectAnimator.prototype.channels = {
		particle: {name: tl('timeline.particle'), mutable: true, max_data_points: 1000},
		sound: {name: tl('timeline.sound'), mutable: true, max_data_points: 1000},
		timeline: {name: tl('timeline.timeline'), mutable: true, max_data_points: 1},
	}