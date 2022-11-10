
const Clipbench = {
	elements: [],
	types: {
		text: 'text',
		display_slot: 'display_slot',
		keyframe: 'keyframe',
		animation: 'animation',
		face: 'face',
		mesh_selection: 'mesh_selection',
		texture: 'texture',
		outliner: 'outliner',
		texture_selection: 'texture_selection',
		image: 'image',
	},
	type_icons: {
		face: 'aspect_ratio',
		mesh_selection: 'fa-gem',
		outliner: 'fas.fa-cube',
	},
	getCopyType(mode, check) {
		// mode: 1 = copy, 2 = paste
		let p = Prop.active_panel;
		let text;
		if (!check) {
			text = getFocusedTextInput() && window.getSelection()+'';
		}
		if (text) {
			return Clipbench.types.text;
		}
		if (Painter.selection.canvas && Toolbox.selected.id == 'copy_paste_tool') {
			return Clipbench.types.texture_selection;
		}
		if (display_mode) {
			return Clipbench.types.display_slot
		}
		if (Animator.open && Prop.active_panel == 'animations') {
			return Clipbench.types.animation
		}
		if (Animator.open && Timeline.animators.length && (Timeline.selected.length || mode === 2) && ['keyframe', 'timeline', 'preview'].includes(p)) {
			return Clipbench.types.keyframe
		}
		if (Modes.edit && p == 'preview' && Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length && (mode !== 2 || Clipbench.vertices)) {
			return Clipbench.types.mesh_selection;
		}
		if (mode == 2 && Modes.edit && Format.meshes && Clipbench.last_copied == 'mesh_selection' && (p == 'preview' || p == 'outliner')) {
			return Clipbench.types.mesh_selection;
		}
		if ((p == 'uv' || p == 'preview') && Modes.edit) {
			return Clipbench.types.face;
		}
		if (p == 'textures' && (Texture.selected || mode === 2)) {
			return Clipbench.types.texture;
		}
		if (p == 'outliner' && Modes.edit) {
			return Clipbench.types.outliner;
		}
		if (!Project) {
			return Clipbench.types.image;
		}
	},
	async getPasteType() {
		let p = Prop.active_panel;
		if (getFocusedTextInput()) {
			return Clipbench.types.text;
		}
		if (!Project) {
			return Clipbench.types.image;
		}
		if (Painter.selection.canvas && Toolbox.selected.id == 'copy_paste_tool') {
			return Clipbench.types.texture_selection;
		}
		if (display_mode) {
			return Clipbench.types.display_slot
		}
		if (Animator.open && Prop.active_panel == 'animations') {
			return Clipbench.types.animation
		}
		if (Animator.open && Timeline.animators.length && ['keyframe', 'timeline', 'preview'].includes(p)) {
			return Clipbench.types.keyframe
		}
		if (Modes.edit && p == 'preview') {
			let options = [];
			if (Clipbench.elements.length || Clipbench.group) {
				options.push(Clipbench.types.outliner);
			}
			if (Mesh.selected[0] && Mesh.selected[0].getSelectedVertices().length && Clipbench.vertices) {
				options.push(Clipbench.types.mesh_selection);
			}
			if (UVEditor.getMappableElements().length && UVEditor.clipboard.length) {
				options.push(Clipbench.types.face);
			}
			if (options.length > 1 && options.includes(settings.preview_paste_behavior.value)) {
				return settings.preview_paste_behavior.value;
			} else if (options.length > 1) {
				return await new Promise((resolve, reject) => {
					new Menu(options.map(option => {
						return {
							id: option,
							name: tl(`menu.paste.${option}`),
							icon: Clipbench.type_icons[option],
							click() {
								resolve(option);
							}
						}
					})).show('mouse');
				})
			} else {
				return options[0]
			}
		}
		if (p == 'uv' && Modes.edit && UVEditor.clipboard.length) {
			return Clipbench.types.face;
		}
		if (p == 'textures') {
			return Clipbench.types.texture;
		}
		if (p == 'outliner' && Modes.edit) {
			return Clipbench.types.outliner;
		}
	},
	copy(event, cut) {
		let copy_type = Clipbench.getCopyType(1);
		Clipbench.last_copied = copy_type;
		switch (copy_type) {
			case 'text':
				Clipbench.setText(window.getSelection()+'');
				break;
			case 'display_slot':
				DisplayMode.copy();
				break;
			case 'animation':
				Clipbench.setAnimation();
				break;
			case 'keyframe':
				if (Timeline.selected.length) {
					Clipbench.setKeyframes();
					if (cut) {
						BarItems.delete.trigger();
					}
				}
				break;
			case 'face':
				UVEditor.copy(event);
				break;
			case 'mesh_selection':
				UVEditor.copy(event);
				Clipbench.setMeshSelection(Mesh.selected[0], event);
				break;
			case 'texture':
				Clipbench.setTexture(Texture.selected);
				if (cut) {
					BarItems.delete.trigger();
				}
				break;
		}
		if (copy_type == 'outliner' || (copy_type == 'face' && Prop.active_panel == 'preview')) {
			Clipbench.setElements();
			Clipbench.setGroup();
			if (Group.selected) {
				Clipbench.setGroup(Group.selected);
			} else {
				Clipbench.setElements(selected);
			}
			if (cut) {
				BarItems.delete.trigger();
			}
		}
	},
	async paste(event) {
		switch (await Clipbench.getPasteType()) {
			case 'text':
				Clipbench.setText(window.getSelection()+'');
				break;
			case 'texture_selection':
				UVEditor.addPastingOverlay();
				break;
			case 'display_slot':
				DisplayMode.paste();
				break;
			case 'animation':
				Clipbench.pasteAnimation();
				break;
			case 'keyframe':
				Clipbench.pasteKeyframes()
				break;
			case 'face':
				UVEditor.paste(event);
				break;
			case 'mesh_selection':
				Clipbench.pasteMeshSelection();
				break;
			case 'texture':
				Clipbench.pasteTextures();
				break;
			case 'outliner':
				Clipbench.pasteOutliner(event);
				break;
			case 'image':
				Clipbench.pasteImage(event);
				break;
		}
	},
	setGroup(group) {
		if (!group) {
			Clipbench.group = undefined
			return;
		}
		Clipbench.group = group.getSaveCopy()
		if (isApp) {
			clipboard.writeHTML(JSON.stringify({type: 'group', content: Clipbench.group}))
		}
	},
	setElements(arr) {
		if (!arr) {
			Clipbench.elements = []
			return;
		}
		arr.forEach(function(element) {
			Clipbench.elements.push(element.getSaveCopy())
		})
		if (isApp) {
			clipboard.writeHTML(JSON.stringify({type: 'elements', content: Clipbench.elements}))
		}
	},
	setText(text) {
		if (isApp) {
			clipboard.writeText(text)
		} else if (navigator.clipboard) {
			navigator.clipboard.writeText(text);
		} else {
			document.execCommand('copy')
		}
	},
	setMeshSelection(mesh) {
		this.vertices = {};
		this.faces = {};
		mesh.getSelectedVertices().forEach(vkey => {
			this.vertices[vkey] = mesh.vertices[vkey].slice();
		})
		for (let fkey in mesh.faces) {
			let face = mesh.faces[fkey];
			if (face.isSelected()) {
				this.faces[fkey] = new MeshFace(null, face);
			}
		}
	},
	pasteMeshSelection() {
		let elements = Mesh.selected.slice();
		Undo.initEdit({elements});
		let new_mesh;
		if (!elements.length) {
			new_mesh = new Mesh({name: 'pasted', vertices: []});
			elements.push(new_mesh);
		}
		elements.forEach(mesh => {
			let old_vertices = Object.keys(this.vertices);
			let vertices_positions = old_vertices.map(vkey => this.vertices[vkey]);
			let new_vertices = mesh.addVertices(...vertices_positions);

			for (let old_fkey in this.faces) {
				let old_face = this.faces[old_fkey];
				let new_face = new MeshFace(mesh, old_face);
				Property.resetUniqueValues(MeshFace, new_face);
				let new_face_vertices = new_face.vertices.map(old_vkey => {
					let new_vkey = new_vertices[old_vertices.indexOf(old_vkey)];
					new_face.uv[new_vkey] = new_face.uv[old_vkey];
					delete new_face.uv[old_vkey];
					return new_vkey;
				})
				new_face.vertices.replace(new_face_vertices);
				mesh.addFaces(new_face);
			}
			mesh.getSelectedVertices(true).replace(new_vertices);
		})
		if (new_mesh) {
			new_mesh.init().select();
		}
		Undo.finishEdit('Paste mesh selection');
		Canvas.updateView({elements: Mesh.selected, selection: true})
	},
	pasteOutliner(event) {
		Undo.initEdit({outliner: true, elements: [], selection: true});
		//Group
		var target = 'root'
		if (Group.selected) {
			target = Group.selected
			Group.selected.isOpen = true
		} else if (selected[0]) {
			target = selected[0]
		}
		selected.length = 0
		if (isApp) {
			var raw = clipboard.readHTML()
			try {
				var data = JSON.parse(raw)
				if (data.type === 'elements' && data.content) {
					Clipbench.group = undefined;
					Clipbench.elements = data.content;
				} else if (data.type === 'group' && data.content) {
					Clipbench.group = data.content;
					Clipbench.elements = [];
				}
			} catch (err) {}
		}
		if (Clipbench.group) {
			function iterate(obj, parent) {
				if (obj.children) {
					var copy = new Group(obj).addTo(parent).init();
					copy._original_name = copy.name;
					copy.createUniqueName();
					Property.resetUniqueValues(Group, copy);

					if (obj.children && obj.children.length) {
						obj.children.forEach((child) => {
							iterate(child, copy)
						})
					}
				} else if (OutlinerElement.isTypePermitted(obj.type)) {
					var copy = OutlinerElement.fromSave(obj).addTo(parent).selectLow();
					copy.createUniqueName();
					Property.resetUniqueValues(copy.constructor, copy);
					copy.preview_controller.updateTransform(copy);
				}
			}
			iterate(Clipbench.group, target)
			updateSelection()

		} else if (Clipbench.elements && Clipbench.elements.length) {
			let elements = [];
			Clipbench.elements.forEach(function(obj) {
				if (!OutlinerElement.isTypePermitted(obj.type)) return;
				var copy = OutlinerElement.fromSave(obj).addTo(target).selectLow();
				copy.createUniqueName();
				Property.resetUniqueValues(copy.constructor, copy);
				elements.push(copy);
			})
			Canvas.updateView({elements});
		}

		//Rotate Cubes
		if (!Format.rotate_cubes) {
			elements.forEach(cube => {
				if (cube instanceof Cube == false) return;
				cube.rotation.V3_set(0, 0, 0)
			})
			Canvas.updateView({elements, element_aspects: {transform: true}});
		}

		//Canvas Limit
		if (Format.cube_size_limiter && !settings.deactivate_size_limit.value) {

			elements.forEach(s => {
				if (s instanceof Cube) {
					//Push elements into 3x3 block box
					Format.cube_size_limiter.move(s);
				}
			})
			Canvas.updateView({elements, element_aspects: {transform: true, geometry: true}});
		}

		//Rotation Limit
		if (Format.rotation_limit && Format.rotate_cubes) {
			elements.forEach(cube => {
				if (cube instanceof Cube == false) return;
				if (!cube.rotation.allEqual(0)) {
					var axis = getAxisNumber(cube.rotationAxis()) || 0;
					var cube_rotation = Format.rotation_snap ? Math.round(cube.rotation[axis]/22.5)*22.5 : cube.rotation[axis];
					var angle = limitNumber( cube_rotation, -45, 45 );
					cube.rotation.V3_set(0, 0, 0);
					cube.rotation[axis] = angle;
				}
			})
			Canvas.updateView({elements, element_aspects: {transform: true}});
		}

		Undo.finishEdit('Paste Elements', {outliner: true, elements: selected, selection: true});
	},
	pasteImage() {
		function loadFromDataUrl(dataUrl) {
			if (!dataUrl || dataUrl.length < 32) return;

			Codecs.image.load(dataUrl);
		}
	
		if (isApp) {
			var image = clipboard.readImage().toDataURL();
			loadFromDataUrl(image);
		} else {
			navigator.clipboard.read().then(content => {
				if (content && content[0] && content[0].types.includes('image/png')) {
					content[0].getType('image/png').then(blob => {
						let url = URL.createObjectURL(blob);
						loadFromDataUrl(url);
					})
				}
			}).catch(() => {})
		}
	}
}

BARS.defineActions(function() {

	new Action('copy', {
		icon: 'fa-copy',
		category: 'edit',
		work_in_dialog: true,
		condition: () => Clipbench.getCopyType(1, true),
		keybind: new Keybind({key: 'c', ctrl: true, shift: null}),
		click: function (event) {Clipbench.copy(event)}
	})
	new Action('cut', {
		icon: 'fa-cut',
		category: 'edit',
		work_in_dialog: true,
		condition: () => Clipbench.getCopyType(1, true),
		keybind: new Keybind({key: 'x', ctrl: true, shift: null}),
		click: function (event) {Clipbench.copy(event, true)}
	})
	new Action('paste', {
		icon: 'fa-clipboard',
		category: 'edit',
		work_in_dialog: true,
		condition: () => Clipbench.getCopyType(2, true),
		keybind: new Keybind({key: 'v', ctrl: true, shift: null}),
		click: function (event) {Clipbench.paste(event)}
	})
})