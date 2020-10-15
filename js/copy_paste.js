
const Clipbench = {
	elements: [],
	types: {
		text: 'text',
		face_dialog: 'face_dialog',
		display_slot: 'display_slot',
		keyframe: 'keyframe',
		face: 'face',
		texture: 'texture',
		outliner: 'outliner',
		texture_selection: 'texture_selection',
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
		if (open_dialog == 'uv_dialog') {
			return Clipbench.types.face_dialog
		}
		if (display_mode) {
			return Clipbench.types.display_slot
		}
		if (Animator.open && Timeline.animators.length && (Timeline.selected.length || mode === 2) && ['keyframe', 'timeline', 'preview'].includes(p)) {
			return Clipbench.types.keyframe
		}
		if ((p == 'uv' || p == 'preview') && Modes.edit) {
			return Clipbench.types.face;
		}
		if (p == 'textures' && isApp && (Texture.selected || mode === 2)) {
			return Clipbench.types.texture;
		}
		if (p == 'outliner' && Modes.edit) {
			return Clipbench.types.outliner;
		}
	},
	copy(event, cut) {
		switch (Clipbench.getCopyType(1)) {
			case 'text':
				Clipbench.setText(window.getSelection()+'');
				break;
			case 'face_dialog':
				uv_dialog.copy(event);
				break;
			case 'display_slot':
				DisplayMode.copy();
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
				main_uv.copy(event);
				break;
			case 'texture':
				Clipbench.setTexture(Texture.selected);
				if (cut) {
					BarItems.delete.trigger();
				}
				break;
			case 'outliner':
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
				break;
		}
	},
	paste(event) {
		switch (Clipbench.getCopyType(2)) {
			case 'text':
				Clipbench.setText(window.getSelection()+'');
				break;
			case 'texture_selection':
				main_uv.addPastingOverlay();
				break;
			case 'face_dialog':
				uv_dialog.paste(event)
				break;
			case 'display_slot':
				DisplayMode.paste();
				break;
			case 'keyframe':
				Clipbench.pasteKeyframes()
				break;
			case 'face':
				main_uv.paste(event);
				break;
			case 'texture':
				Clipbench.pasteTextures();
				break;
			case 'outliner':
				Clipbench.pasteOutliner(event);
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
		arr.forEach(function(obj) {
			Clipbench.elements.push(obj.getSaveCopy())
		})
		if (isApp) {
			clipboard.writeHTML(JSON.stringify({type: 'elements', content: Clipbench.elements}))
		}
	},
	setText(text) {
		if (isApp) {
			clipboard.writeText(text)
		} else {
			document.execCommand('copy')
		}
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
					var copy = new Group(obj).addTo(parent).init()
					copy.createUniqueName();

					if (obj.children && obj.children.length) {
						obj.children.forEach((child) => {
							iterate(child, copy)
						})
					}
				} else {
					var el = NonGroup.fromSave(obj).addTo(parent).selectLow();
					el.createUniqueName();
					if (el instanceof Cube) {
						Canvas.adaptObjectPosition(el);
					}
				}
			}
			iterate(Clipbench.group, target)
			updateSelection()

		} else if (Clipbench.elements && Clipbench.elements.length) {
			Clipbench.elements.forEach(function(obj) {
				var el = NonGroup.fromSave(obj).addTo(target).selectLow();
				el.createUniqueName();
			})
			Canvas.updatePositions();
		}
		Undo.finishEdit('paste', {outliner: true, elements: selected, selection: true});
	}
}

BARS.defineActions(function() {

	new Action('copy', {
		icon: 'fa-copy',
		category: 'edit',
		work_in_dialog: true,
		condition: () => Clipbench.getCopyType(1, true),
		keybind: new Keybind({key: 67, ctrl: true, shift: null}),
		click: function (event) {Clipbench.copy(event)}
	})
	new Action('cut', {
		icon: 'fa-cut',
		category: 'edit',
		work_in_dialog: true,
		condition: () => Clipbench.getCopyType(1, true),
		keybind: new Keybind({key: 88, ctrl: true, shift: null}),
		click: function (event) {Clipbench.copy(event, true)}
	})
	new Action('paste', {
		icon: 'fa-clipboard',
		category: 'edit',
		work_in_dialog: true,
		condition: () => Clipbench.getCopyType(2, true),
		keybind: new Keybind({key: 86, ctrl: true, shift: null}),
		click: function (event) {Clipbench.paste(event)}
	})
})