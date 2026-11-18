
export class NullObject extends OutlinerElement {
	constructor(data, uuid) {
		super(data, uuid);

		for (var key in NullObject.properties) {
			NullObject.properties[key].reset(this);
		}

		if (data) {
			this.extend(data);
		}
	}
	get origin() {
		return this.position;
	}
	extend(object) {
		if (object.from) this.position.V3_set(object.from);
		for (var key in NullObject.properties) {
			NullObject.properties[key].merge(this, object)
		}
		this.sanitizeName();
		Merge.boolean(this, object, 'export');
		return this;
	}
	select(event, isOutlinerClick) {
		super.select(event, isOutlinerClick);
		if (Animator.open && Animation.selected) {
			Animation.selected.getBoneAnimator(this)?.select(true);
		}
		return this;
	}
	unselect(...args) {
		if (Animator.open && Timeline.selected_animator && Timeline.selected_animator.element == this) {
			Timeline.selected_animator.selected = false;
		}
		return super.unselect(...args);
	}
	flip(axis, center) {
		var offset = this.position[axis] - center
		this.position[axis] = center - offset;
		// Name
		flipNameOnAxis(this, axis);
		this.createUniqueName();
		this.preview_controller.updateTransform(this);
		return this;
	}
	getWorldCenter(with_animation) {
		let pos = new THREE.Vector3();
		let q = Reusable.quat1.set(0, 0, 0, 1);
		let parent_object = this.parent.scene_object;
		if (parent_object) {
			// fastWorldPosition reads matrixWorld as-is. While animations are being applied, it is still
			// from the previous frame, so the parent's position would lag behind its own (fresh) rotation.
			parent_object.updateWorldMatrix(true, false);
			THREE.fastWorldPosition(parent_object, pos);
			parent_object.getWorldQuaternion(q);
			if (this.parent instanceof Group) {
				let offset2 = Reusable.vec2.fromArray(this.parent.origin).applyQuaternion(q);
				pos.sub(offset2);
			}
		}
		let offset;
		if (with_animation && Animation.selected) {
			offset = Reusable.vec3.copy(this.mesh.position);
			if (this.parent instanceof Group) {
				offset.x += this.parent.origin[0];
				offset.y += this.parent.origin[1];
				offset.z += this.parent.origin[2];
			}
		} else {
			offset = Reusable.vec3.fromArray(this.position);
		}
		offset.applyQuaternion(q);
		pos.add(offset);

		return pos;
	}
	static behavior = {
		movable: true,
		hide_in_screenshot: true,
	}
}
	NullObject.prototype.title = tl('data.null_object');
	NullObject.prototype.type = 'null_object';
	NullObject.prototype.icon = 'far.fa-circle';
	//NullObject.prototype.name_regex = 'a-z0-9_'
	NullObject.prototype.visibility = true;
	NullObject.prototype.buttons = [
		//Outliner.buttons.export,
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];
	/**
	 * Returns the node that an IK chain from the null object to the target starts at by default:
	 * the topmost ancestor of the target (or the target itself) that is not also an ancestor of the null object.
	 * For a target inside the null object's parent, this matches the chain used when no IK root is set.
	 */
	function getDefaultIKRoot(null_object, target) {
		let root;
		for (let node = target; node instanceof OutlinerNode; node = node.parent) {
			if (null_object.isChildOf(node)) break;
			root = node;
		}
		if (root instanceof Group || root instanceof ArmatureBone) return root;
	}
	/**
	 * Nodes that the null object can use as IK target. The target can be outside of the null object's parent,
	 * e.g. a hand reaching for a null object inside a weapon. In that case the IK root is set when picking it.
	 */
	function getIKTargetCandidates(null_object) {
		let source = null_object.ik_source && OutlinerNode.uuids[null_object.ik_source];
		let nodes = [];
		function iterate(arr) {
			for (let node of arr) {
				if (node instanceof Group || node instanceof ArmatureBone || node instanceof Locator) {
					// Ancestors of the null object would move it along with the chain
					let valid = !null_object.isChildOf(node) && (
						(source && node.isChildOf(source)) ||
						// The chain needs at least two bones
						(getDefaultIKRoot(null_object, node) ?? node) != node
					);
					if (valid) nodes.push(node);
				}
				if (node.children) iterate(node.children);
			}
		}
		iterate(Outliner.root);
		return nodes;
	}
	/**
	 * Sets the IK root if the chain to the current target would not work without it
	 */
	function updateIKRootForTarget(null_object) {
		let target = OutlinerNode.uuids[null_object.ik_target];
		if (!target) return;
		let chain = NullObject.animator.getIKChain(null_object);
		if (chain && chain.bones.length >= 2) return;
		let root = getDefaultIKRoot(null_object, target);
		if (root && root != target) {
			null_object.ik_source = root.uuid;
		}
	}
	function getIKPoleCandidates(null_object) {
		let nodes = [];
		function iterate(arr) {
			for (let node of arr) {
				if (node == null_object) continue;
				if (node instanceof Group || node instanceof Locator || node instanceof NullObject) {
					nodes.push(node);
				}
				if (node.children) iterate(node.children);
			}
		}
		iterate(Outliner.root);
		return nodes;
	}
	function ikOptionToggle(key, undo_name) {
		return {
			id: key,
			name: 'menu.null_object.' + key,
			icon: null_object => null_object[key] ? 'check_box' : 'check_box_outline_blank',
			click(clicked_null_object) {
				let value = !clicked_null_object[key];
				let affected = NullObject.selected.filter(null_object => null_object[key] != value);
				Undo.initEdit({elements: affected});
				affected.forEach(null_object => {
					null_object[key] = value;
				})
				Undo.finishEdit(undo_name);
				if (Modes.animate) Animator.preview();
				updateSelection();
			}
		}
	}
	NullObject.prototype.menu = new Menu([
			new MenuSeparator('ik'),
			'set_ik_target',
			'set_ik_source',
			'set_ik_pole',
			ikOptionToggle('lock_ik_target_rotation', 'Change null object lock ik target rotation option'),
			ikOptionToggle('ik_target_follow_parent', 'Change null object ik target follow parent option'),
			...Outliner.control_menu_group,
			new MenuSeparator('manage'),
			'rename',
			'delete'
		])
	
	new Property(NullObject, 'string', 'name', {default: 'null_object'})
	new Property(NullObject, 'vector', 'position')
	new Property(NullObject, 'string', 'ik_target', {
		condition: () => Format.animation_mode,
		inputs: {
			element_panel: {
				input: {label: 'null_object.ik_target', description: 'action.set_ik_target.desc', type: 'outliner_node', getOutlinerNodes() {
					return NullObject.hasSelected() ? getIKTargetCandidates(NullObject.selected[0]) : [];
				}},
				onChange(value, null_objects) {
					// Runs inside the undo edit of the panel
					null_objects.forEach(null_object => {
						if (null_object instanceof NullObject) updateIKRootForTarget(null_object);
					});
					if (Modes.animate) Animator.preview();
					updateSelection();
				}
			}
		}
	});
	new Property(NullObject, 'string', 'ik_source', {
		condition: () => Format.animation_mode,
		inputs: {
			element_panel: {
				input: {label: 'null_object.ik_source', description: 'action.set_ik_source.desc', type: 'outliner_node', getOutlinerNodes() {
					let nodes = [];
					iterate(Outliner.root)
					function iterate(arr) {
						arr.forEach(node => {
							if (node.children) {
								if (node.constructor.animator) {
									nodes.push(node);
								}
								iterate(node.children)
							}
						})
					}
					return nodes;
				}},
				onChange() {
					if (Modes.animate) Animator.preview();
				}
			}
		}
	});
	new Property(NullObject, 'string', 'ik_pole', {
		condition: () => Format.animation_mode,
		inputs: {
			element_panel: {
				input: {label: 'null_object.ik_pole', description: 'action.set_ik_pole.desc', type: 'outliner_node', getOutlinerNodes() {
					return NullObject.hasSelected() ? getIKPoleCandidates(NullObject.selected[0]) : [];
				}},
				onChange() {
					if (Modes.animate) Animator.preview();
				}
			}
		}
	});
	new Property(NullObject, 'boolean', 'lock_ik_target_rotation', {
		condition: () => Format.animation_mode,
		inputs: {
			element_panel: {
				input: {label: 'menu.null_object.lock_ik_target_rotation', type: 'checkbox'},
				onChange() {
					if (Modes.animate) Animator.preview();
				}
			}
		}
	})
	new Property(NullObject, 'boolean', 'ik_target_follow_parent', {
		condition: () => Format.animation_mode,
		inputs: {
			element_panel: {
				input: {
					label: 'menu.null_object.ik_target_follow_parent',
					description: 'menu.null_object.ik_target_follow_parent.desc',
					type: 'checkbox'
				},
				onChange() {
					if (Modes.animate) Animator.preview();
				}
			}
		}
	})
	new Property(NullObject, 'boolean', 'visibility', {default: true});
	new Property(NullObject, 'boolean', 'locked');
	
	OutlinerElement.registerType(NullObject, 'null_object');


	const map = new THREE.TextureLoader().load( 'assets/null_object.png' );
	map.magFilter = map.minFilter = THREE.NearestFilter;
	
new NodePreviewController(NullObject, {
	setup(element) {
		let material = new THREE.SpriteMaterial({
			map,
			alphaTest: 0.1,
			sizeAttenuation: false
		});
		var mesh = new THREE.Sprite(material);
		Project.nodes_3d[element.uuid] = mesh;
		mesh.name = element.uuid;
		mesh.type = element.type;
		mesh.isElement = true;
		mesh.visible = element.visibility;
		mesh.rotation.order = Format.euler_order;
		element.mesh.fix_position = new THREE.Vector3();
		this.updateTransform(element);

		this.dispatchEvent('setup', {element});
		this.dispatchEvent('update_selection', {element});
	},
	updateTransform(element) {
		NodePreviewController.prototype.updateTransform.call(this, element);

		element.mesh.fix_position.copy(element.mesh.position);

		this.updateWindowSize(element);

		this.dispatchEvent('update_transform', {element});
	},
	updateSelection(element) {
		let {mesh} = element;

		mesh.material.color.set(element.selected ? gizmo_colors.outline : CustomTheme.data.colors.text);
		mesh.material.depthTest = !element.selected;
		mesh.renderOrder = element.selected ? 100 : 0;
		mesh.visible = !!Canvas.show_element_markers;

		this.dispatchEvent('update_selection', {element});
	},
	updateWindowSize(element) {
		let size = 0.38 * Preview.selected.camera.fov / Preview.selected.height;
		element.mesh.scale.set(size, size, size);
	}
})


BARS.defineActions(function() {
	new Action('add_null_object', {
		icon: 'far.fa-circle',
		category: 'edit',
		condition: () => Format.animation_mode && Modes.edit,
		click: function () {
			var objs = []
			Undo.initEdit({elements: objs, outliner: true});
			var null_object = new NullObject().addTo(Group.first_selected||Outliner.selected[0]).init();
			null_object.select().createUniqueName();
			objs.push(null_object);
			Undo.finishEdit('Add null object');
			Vue.nextTick(function() {
				if (settings.create_rename.value) {
					null_object.rename();
				}
			})
		}
	})
	
	new Action('set_ik_target', {
		icon: 'fa-paperclip',
		category: 'edit',
		condition() {
			let action = BarItems.set_ik_target;
			return NullObject.selected.length && action.children(action).length
		},
		searchable: true,
		children() {
			let nodes = getIKTargetCandidates(NullObject.selected[0]);
			return nodes.map(node => {
				return {
					name: node.name + (node.uuid == NullObject.selected[0].ik_target ? ' (✔)' : ''),
					icon: node.icon,
					marked: node.uuid == NullObject.selected[0].ik_target,
					color: markerColors[node.color % markerColors.length]?.standard,
					click() {
						Undo.initEdit({elements: NullObject.selected});
						NullObject.selected.forEach(null_object => {
							null_object.ik_target = node.uuid;
							updateIKRootForTarget(null_object);
						})
						Undo.finishEdit('Set IK target');
						if (Modes.animate) Animator.preview();
						updateSelection();
					}
				}
			})
		},
		click(event) {
			new Menu('set_ik_target', this.children(this), {searchable: true}).show(event.target, this);
		}
	})

	new Action('set_ik_source', {
		icon: 'fa-link',
		category: 'edit',
		condition() {
			let action = BarItems.set_ik_source;
			return NullObject.selected.length && action.children(action).length
		},
		searchable: true,
		children() {
			let nodes = [];
			iterate(Outliner.root)

			function iterate(arr) {
				arr.forEach(node => {
					if (node.children) {
						if (node.constructor.animator) {
							nodes.push(node);
						}
						iterate(node.children)
					}
				})
			}
			return nodes.map(node => {
				return {
					name: node.name + (node.uuid == NullObject.selected[0].ik_source ? ' (✔)' : ''),
					icon: node instanceof Locator ? 'fa-anchor' : 'folder',
					marked: node.uuid == NullObject.selected[0].ik_source,
					color: markerColors[node.color % markerColors.length]?.standard,
					click() {
						Undo.initEdit({elements: NullObject.selected});
						NullObject.selected.forEach(null_object => {
							null_object.ik_source = node.uuid;
						})
						Undo.finishEdit('Set IK source');
					}
				}
			})
		},
		click(event) {
			new Menu('set_ik_source', this.children(this), {searchable: true}).show(event.target, this);
		}

	})

	new Action('set_ik_pole', {
		icon: 'chip_extraction',
		category: 'edit',
		condition() {
			let action = BarItems.set_ik_pole;
			return NullObject.selected.length && action.children(action).length
		},
		searchable: true,
		children() {
			let nodes = getIKPoleCandidates(NullObject.selected[0]);
			return nodes.map(node => {
				return {
					name: node.name + (node.uuid == NullObject.selected[0].ik_pole ? ' (✔)' : ''),
					icon: node.icon,
					color: markerColors[node.color % markerColors.length] && markerColors[node.color % markerColors.length].standard,
					click() {
						Undo.initEdit({ elements: NullObject.selected });
						NullObject.selected.forEach(null_object => {
							if (null_object.ik_pole == node.uuid) {
								null_object.ik_pole = undefined;
							} else {
								null_object.ik_pole = node.uuid;
							}
						})
						Undo.finishEdit('Set IK pole');
					}
				}
			})
		},
		click(event) {
			new Menu('set_ik_pole', this.children(this), { searchable: true }).show(event.target, this);
		}
	})
})

Object.assign(window, {
	NullObject
});
