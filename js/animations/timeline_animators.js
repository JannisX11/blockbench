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
	clickSelect() {
		Undo.initSelection();
		this.select();
		Undo.finishSelection('Select animator');
	}
	addToTimeline(end_of_list = false) {
		if (!Timeline.animators.includes(this)) {
			if (end_of_list == true) {
				Timeline.animators.push(this);
			} else {
				Timeline.animators.splice(0, 0, this);
			}
		}
		for (let channel in this.channels) {
			if (!this[channel]) this[channel] = [];
		}
		if (!this.expanded) this.expanded = true;
		TickUpdates.keyframe_selection = true;
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
		if (deleted.length && Undo.current_save) {
			Undo.addKeyframeCasualties(deleted);
		}
		Animation.selected.setLength();

		if (undo) {
			Undo.finishEdit('Add keyframe')
		}
		return keyframe;
	}
	getOrMakeKeyframe(channel) {
		let before, result;
		let epsilon = Timeline.getStep()/2 || 0.01;
		let has_before = false;

		for (let kf of this[channel]) {
			if (Math.abs(kf.time - Timeline.time) <= epsilon) {
				before = kf;
			}
			if (kf.time < Timeline.time) {
				has_before = true;
			}
		}
		result = before ? before : this.createKeyframe(null, Timeline.time, channel, false, false);
		let new_keyframe;
		if (settings.auto_keyframe.value && Timeline.snapTime(Timeline.time) != 0 && !before && !has_before) {
			new_keyframe = this.createKeyframe({}, 0, channel, false, false);
		}
		return {before, result, new_keyframe};
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
			unselectAllElements();
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
			if (group.name == Group.first_selected.name && group != Group.first_selected) {
				duplicates = true;
			}
		})
		function iterate(arr) {
			arr.forEach((it) => {
				if (it.type === 'group' && !duplicates) {
					if (it.name === Group.first_selected.name && it !== Group.first_selected) {
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
		
		if (this[Toolbox.selected.animation_channel] && (Timeline.selected.length == 0 || Timeline.selected[0].animator != this) && !Blockbench.hasFlag('loading_selection_save')) {
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
			let closest;
			this[keyframe.channel].forEach(kf => {
				if (!closest || Math.abs(kf.time - keyframe.time) < Math.abs(closest.time - keyframe.time)) {
					closest = kf;
				}
			});
			let interpolation = closest?.interpolation;
			let original_time = Timeline.time;
			Timeline.time = keyframe.time;
			let ref = this.interpolate(keyframe.channel, allow_expression);
			let ref2;
			if (interpolation == 'bezier') {
				Timeline.time = keyframe.time + 0.01;
				ref2 = this.interpolate(keyframe.channel, allow_expression);
			}
			Timeline.time = original_time;
			if (ref) {
				if (round) {
					let e = keyframe.channel == 'scale' ? 1e4 : 1e2
					ref.forEach((r, a) => {
						if (!isNaN(r)) {
							ref[a] = Math.round(parseFloat(r)*e)/e
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
				if (interpolation == 'bezier' && ref2) {
					ref.forEach((val1, a) => {
						if (val1 !== ref2[a]) {
							keyframe.bezier_right_value[a] = (ref2[a] - val1) * 10;
							keyframe.bezier_left_value[a] = -keyframe.bezier_right_value[a];
						}
					})
				}
			}
			keyframe.extend({
				interpolation,
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
			let {linear, step, catmullrom, bezier} = Keyframe.interpolation;

			if (no_interpolations || (
				before.interpolation === linear &&
				(after.interpolation === linear || after.interpolation === step)
			)) {
				if (no_interpolations) {
					alpha = Math.round(alpha)
				}
				return mapAxes(axis => before.getLerp(after, axis, alpha, allow_expression));

			} else if (before.interpolation === catmullrom || after.interpolation === catmullrom) {

				let sorted = this[channel].slice().sort((kf1, kf2) => (kf1.time - kf2.time));
				let before_index = sorted.indexOf(before);
				let before_plus = sorted[before_index-1];
				let after_plus = sorted[before_index+2];
				if (this.animation.loop == 'loop' && sorted.length >= 3) {
					if (!before_plus) before_plus = sorted.at(-2);
					if (!after_plus) after_plus = sorted[1];
				}

				return mapAxes(axis => before.getCatmullromLerp(before_plus, before, after, after_plus, axis, alpha));

			} else if (before.interpolation === bezier || after.interpolation === bezier) {
				// Bezier
				return mapAxes(axis => before.getBezierLerp(before, after, axis, alpha));
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
		Animator.MolangParser.context.animation = this.animation;

		if (!this.muted.rotation) this.displayRotation(this.interpolate('rotation'), multiplier)
		if (!this.muted.position) this.displayPosition(this.interpolate('position'), multiplier)
		if (!this.muted.scale) this.displayScale(this.interpolate('scale'), multiplier)
	}
	applyAnimationPreset(preset) {
		let keyframes = [];
		Undo.initEdit({keyframes});
		let current_time = Timeline.snapTime(Timeline.time);
		for (let channel in this.channels) {
			let timeline = preset[channel];
			for (let timecode in timeline) {
				let data = {};
				let value = timeline[timecode];
				if (value instanceof Array) {
					data = {x: value[0], y: value[1], z: value[2]};
				} else if (value.pre) {
					data = {data_points: [
						{x: value.pre[0], y: value.pre[1], z: value.pre[2]},
						{x: value.post[0], y: value.post[1], z: value.post[2]},
					]}
				} else {
					data = {
						x: value.post[0], y: value.post[1], z: value.post[2],
						interpolation: value.lerp_mode
					};
				}
				let kf = this.createKeyframe(data, current_time + parseFloat(timecode), channel, false, false);
				keyframes.push(kf);
			}
		}
		if (preset.length) {
			this.animation.setLength(current_time + preset.length);
		}
		keyframes[0].select();
		Undo.finishEdit('Apply animation preset');
		Animator.preview();
		return this;
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
		new MenuSeparator('settings'),
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
		},
		new MenuSeparator('presets'),
		'apply_animation_preset'
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
			unselectAllElements();
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

		let source;
		if (null_object.ik_source) {
			source = [...Group.all].find(node => node.uuid == null_object.ik_source);
		} else {
			source = null_object.parent;
		}
		if (!source) return;
		if (!target.isChildOf(source) && source != 'root') return;
		let target_original_quaternion = null_object.lock_ik_target_rotation &&
			target instanceof Group &&
			target.mesh.getWorldQuaternion(new THREE.Quaternion());

		while (current !== source) {
			bones.push(current);
			current = current.parent;
		}
		if (null_object.ik_source) {
			bones.push(source);
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
				let diff = this.animation.time - kf.time;
				if (diff < 0) return;

				let media = Timeline.playing_sounds.find(s => s.keyframe_id == kf.uuid);
				if (diff >= 0 && diff < (1/30) * (Timeline.playback_speed/100) && !media) {
					if (kf.data_points[0].file && !kf.cooldown) {
						media = new Audio(kf.data_points[0].file);
						media.keyframe_id = kf.uuid;
						media.playbackRate = Math.clamp(Timeline.playback_speed/100, 0.1, 4.0);
						media.volume = Math.clamp(settings.volume.value/100, 0, 1);
						media.play().catch(() => {});
						Timeline.playing_sounds.push(media);
						media.onended = function() {
							Timeline.playing_sounds.remove(media);
							Timeline.paused_sounds.safePush(media);
						}

						kf.cooldown = true;
						setTimeout(() => {
							delete kf.cooldown;
						}, 400)
					} 
				} else if (diff > 0 && media) {
					if (Math.abs(media.currentTime - diff) > 0.18 && diff < media.duration) {
						console.log('Resyncing sound')
						// Resync
						media.currentTime = Math.clamp(diff + 0.08, 0, media.duration);
						media.playbackRate = Math.clamp(Timeline.playback_speed/100, 0.1, 4.0);
					}
				}
			})
		}

		if (!this.muted.particle) {
			this.particle.forEach(kf => {
				let diff = this.animation.time - kf.time;
				let i = 0;
				for (let data_point of kf.data_points) {
					let particle_effect = data_point.file && Animator.particle_effects[data_point.file]
					if (particle_effect) {
						let emitter = particle_effect.emitters[kf.uuid + i];
						if (diff >= 0) {
							if (!emitter) {
								let i_here = i;
								let anim_uuid = this.animation.uuid;
								emitter = particle_effect.emitters[kf.uuid + i] = new Wintersky.Emitter(WinterskyScene, particle_effect.config);
								
								let old_variable_handler = emitter.Molang.variableHandler;
								emitter.Molang.variableHandler = (key, params) => {
									let curve_result = old_variable_handler.call(emitter, key, params);
									if (curve_result !== undefined) return curve_result;
									return Animator.MolangParser.variableHandler(key);
								}
								emitter.on('start', ({params}) => {
									let animation = Animation.all.find(a => a.uuid === anim_uuid);
									let kf_now = animation?.animators.effects?.particle.find(kf2 => kf2.uuid == kf.uuid);
									let data_point_now = kf_now && kf_now.data_points[i_here];
									if (data_point_now) {
										emitter.Molang.parse(data_point_now.script, Animator.MolangParser.global_variables);
									}
								})
							}

							let locator = data_point.locator && Locator.all.find(l => l.name == data_point.locator)
							if (locator) {
								locator.mesh.add(emitter.local_space);
								emitter.parent_mode = 'locator';
							} else {
								emitter.parent_mode = 'entity';
							}
							scene.add(emitter.global_space);
							emitter.jumpTo(diff);

						} else if (emitter && emitter.enabled) {
							emitter.stop(true);
						}
					} 
					i++;
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
						media.keyframe_id = kf.uuid;
						media.play().catch(() => {});
						Timeline.playing_sounds.push(media);
						media.onended = function() {
							Timeline.playing_sounds.remove(media);
							Timeline.paused_sounds.safePush(media);
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

StateMemory.init('animation_presets', 'array');

BARS.defineActions(() => {
	new Action('apply_animation_preset', {
		condition: () => Modes.animate && Timeline.selected_animator && Timeline.selected_animator.applyAnimationPreset,
		icon: 'library_books',
		click: function (e) {
			new Menu('apply_animation_preset', this.children(), {searchable: true}).open(e.target);
		},
		children() {
			let animator = Timeline.selected_animator;
			let entries = [];
			for (let id in Animator.animation_presets) {
				let preset = Animator.animation_presets[id];
				let entry = {
					name: preset.name,
					icon: 'fast_forward',
					click: () => {
						animator.applyAnimationPreset(preset);
					}
				}
				entries.push(entry);
			}
			if (StateMemory.animation_presets.length) entries.push('_');
			for (let preset of StateMemory.animation_presets) {
				let entry = {
					name: preset.name,
					icon: 'fast_forward',
					click: () => {
						animator.applyAnimationPreset(preset);
					},
					children: [
						{icon: 'delete', name: 'generic.delete', click: () => {
							Blockbench.showMessageBox({
								title: 'generic.delete',
								message: 'generic.confirm_delete',
								buttons: ['dialog.confirm', 'dialog.cancel'],
							}, result => {
								if (result == 1) return;
								StateMemory.animation_presets.remove(preset);
								StateMemory.save('animation_presets');
							})
						}}
					]
				}
				entries.push(entry);
			}
			return entries;
		}
	})
	new Action('save_animation_preset', {
		icon: 'playlist_add',
		condition: () => Modes.animate && Keyframe.selected.length && Keyframe.selected.allAre(kf => kf.animator == Keyframe.selected[0].animator),
		click(event) {	
			let dialog = new Dialog({
				id: 'save_animation_preset',
				title: 'action.save_animation_preset',
				width: 540,
				form: {
					name: {label: 'generic.name'},
				},
				onConfirm: function(formResult) {
					if (!formResult.name) return;
	
					let preset = {
						uuid: guid(),
						name: formResult.name,
					}
					let keyframes = Keyframe.selected.slice().sort((a, b) => a.time - b.time);
					let start_time = keyframes[0].time;
					for (let kf of keyframes) {
						if (!kf.transform) continue;
						if (!preset[kf.channel]) preset[kf.channel] = {};
						let data = kf.compileBedrockKeyframe();
						let timecode = trimFloatNumber(Timeline.snapTime(kf.time - start_time)).toString();
						preset[kf.channel][timecode] = data;
					}

					StateMemory.animation_presets.push(preset);
					StateMemory.save('animation_presets');
				}
			})
			dialog.show()
		}
	})
})