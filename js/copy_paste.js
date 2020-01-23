
const Clipbench = {
	elements: [],
	getCopyType(paste) {
		var p = Prop.active_panel;
		var text = window.getSelection()+'';
		if (text) {
			return 'text';
		}
		if (open_dialog == 'uv_dialog') {
			return 'face_dialog'
		}
		if (display_mode) {
			return 'display_slot'
		}
		if (Animator.open && Timeline.animators.length && (Timeline.selected.length || paste)) {
			return 'keyframe'
		}
		if ((p == 'uv' || p == 'preview') && Modes.edit) {
			return 'face';
		}
		if (p == 'textures' && isApp && (textures.selected || paste)) {
			return 'texture';
		}
		if (p == 'outliner' && Modes.edit) {
			return 'outliner';
		}
	},
	copy(event, cut) {
		switch (Clipbench.getCopyType()) {
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
				Clipbench.setTexture(textures.selected);
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
		switch (Clipbench.getCopyType(true)) {
			case 'text':
				Clipbench.setText(window.getSelection()+'');
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
		condition: () => Clipbench.getCopyType(),
		keybind: new Keybind({key: 67, ctrl: true, shift: null}),
		click: function (event) {Clipbench.copy(event)}
	})
	new Action('cut', {
		icon: 'fa-cut',
		category: 'edit',
		work_in_dialog: true,
		condition: () => Clipbench.getCopyType(),
		keybind: new Keybind({key: 88, ctrl: true, shift: null}),
		click: function (event) {Clipbench.copy(event, true)}
	})
	new Action('paste', {
		icon: 'fa-clipboard',
		category: 'edit',
		work_in_dialog: true,
		condition: () => Clipbench.getCopyType(true),
		keybind: new Keybind({key: 86, ctrl: true, shift: null}),
		click: function (event) {Clipbench.paste(event)}
	})
})