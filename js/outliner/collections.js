/**
 * Collection purposes
 * 

Export collections individually

Create selection based on regex filter? Like element prefixes
Auto-suggest creating such collections when opening the panel


TODO:
properties dialog

 */

class Collection {
	constructor(data, uuid) {
		this.uuid = (uuid && isUUID(uuid)) ? uuid : guid();
		this.selected = false;
		this.children = [];
		for (let key in Collection.properties) {
			Collection.properties[key].reset(this);
		}
		if (data) this.extend(data);
	}
	extend(data) {
		for (var key in Collection.properties) {
			Collection.properties[key].merge(this, data)
		}
		return this;
	}
	select(event) {
		this.selected = true;
		Outliner.selected.empty();
		if (!(event?.shiftKey || Pressing.overrides.shift) && !(event?.ctrlOrCmd || Pressing.overrides.ctrl)) {
			unselectAll();
			Collection.all.forEach(c => c.selected = false);
		}
		this.selected = true;
		for (let uuid of this.children) {
			let node = OutlinerNode.uuids[uuid];
			if (node instanceof Group) {
				node.multiSelect();
			} else {
				Outliner.selected.push(node);
			}
		}
		updateSelection();
		return this;
	}
	getChildren() {
		return this.children.map(uuid => OutlinerNode.uuids[uuid]).filter(node => node != undefined);
	}
	add() {
		Collection.all.safePush(this);
		return this;
	}
	addSelection() {
		if (Group.selected.length) {
			for (let group of Group.selected) {
				this.children.safePush(group.uuid);
			}
		}
		for (let element of Outliner.selected) {
			if (!element.parent.selected) {
				this.children.safePush(element.uuid);
			}
		}
		return this;
	}
	getVisibility() {
		let match = this.getChildren().find(node => {
			return node && typeof node.visibility == 'boolean';
		});
		return match ? match.visibility : true;
	}
	getAllChildren() {
		let children = this.getChildren();
		let nodes = [];
		for (let child of children) {
			nodes.safePush(child);
			if (typeof child.forEachChild == 'function') {
				child.forEachChild(subchild => nodes.safePush(subchild));
			}
		}
		return nodes;
	}
	toggleVisibility(event) {
		let children = this.getChildren();
		if (!children.length) return;
		let groups = [];
		let elements = [];
		function update(node) {
			if (typeof node.visibility != 'boolean') return;
			if (node instanceof Group) {
				groups.push(node);
			} else {
				elements.push(node);
			}
		}
		for (let child of children) {
			update(child);
			if (typeof child.forEachChild == 'function') {
				child.forEachChild(update);
			}
		}
		if (event.altKey) {
			// invert selection
			elements = Outliner.elements.filter(e => !elements.includes(e));
			groups = Group.all.filter(e => !groups.includes(e));
		}
		let all = groups.concat(elements);
		let state = all[0]?.visibility != true;
		Undo.initEdit({groups, elements});
		all.forEach(node => {
			node.visibility = state;
		})
		Canvas.updateView({elements, element_aspects: {visibility: true}});
		Undo.finishEdit('Toggle collection visibility');
	}
	showContextMenu(event) {
		if (!this.selected) this.select();
		this.menu.open(event, this);
		return this;
	}
	getUndoCopy(image_data) {
		let copy = {};
		copy.uuid = this.uuid;
		for (var key in Collection.properties) {
			Collection.properties[key].copy(this, copy);
		}
		return copy;
	}
	getSaveCopy() {
		let copy = {};
		for (var key in Collection.properties) {
			Collection.properties[key].copy(this, copy);
		}
		return copy;
	}
	propertiesDialog() {
		/**
		 * Name
		 * Content
		 * Export Path
		 * Export Format
		 * Offset
		 */
		function getContentList(collection) {
			let types = {
				group: []
			}
			for (let child of collection.getChildren()) {
				if (!types[child.type]) types[child.type] = [];
				types[child.type].push(child);
			}
			let list = [];
			for (let key in types) {
				for (let node of types[key]) {
					list.push({
						name: node.name,
						icon: key == 'group' ? Group.prototype.icon : OutlinerElement.types[key].prototype.icon
					})
				}
			}
			return list;
		}
		let dialog = new Dialog({
			id: 'collection_properties',
			title: this.name,
			resizable: 'x',
			part_order: ['form', 'component'],
			form: {
				name: {label: 'generic.name', value: this.name},
				path: {
					label: 'menu.collection.path',
					value: this.path,
					type: 'file',
					extensions: ['json'],
					filetype: 'JSON collection',
					condition: isApp
				}
			},
			component: {
				components: {VuePrismEditor},
				data: {
					content: getContentList(this)
				},
				template: 
					`<div id="collection_properties_vue">
						<ul class="list">
							<li v-for="content_stat of content">
								<dynamic-icon :icon="content_stat.icon.replace('fa ', '').replace(/ /g, '.')" />
								{{ content_stat.name }}
							</li>
						</ul>
					</div>`
			},
			onFormChange(form) {
				this.component.data.loop_mode = form.loop;
			},
			onConfirm: form_data => {
				dialog.hide().delete();
				if (
					form_data.name != this.name
				) {
					Undo.initEdit({collections: [this]});

					this.extend({
						name: form_data.name,
					})
					if (isApp) this.path = form_data.path;

					Blockbench.dispatchEvent('edit_collection_properties', {collection: this})

					Undo.finishEdit('Edit collection properties');
				}
			},
			onCancel() {
				dialog.hide().delete();
			}
		})
		dialog.show();
	}
}
Collection.prototype.menu = new Menu([
	new MenuSeparator('settings'),
	new MenuSeparator('edit'),
	'set_collection_content_to_selection',
	'add_to_collection',
	new MenuSeparator('copypaste'),
	'copy',
	'duplicate',
	'delete',
	new MenuSeparator('export'),
	{
		id: 'export',
		name: 'generic.export',
		icon: 'insert_drive_file',
		children: (collection) => {
			let actions = [];
			for (let id in Codecs) {
				let codec = Codecs[id];
				if (!codec.export_action || !codec.support_partial_export || !Condition(codec.export_action.condition)) continue;

				let export_action = codec.export_action;
				let new_action = {
					name: export_action.name,
					icon: export_action.icon,
					description: export_action.description,
					description: export_action.description,
					click() {
						codec.exportCollection(collection);
					}
				}
				actions.push(new_action);
			}
			return actions;
		}
	},
	new MenuSeparator('properties'),
	{
		icon: 'list',
		name: 'menu.texture.properties',
		click(collection) { collection.propertiesDialog()}
	}
])
new Property(Collection, 'string', 'name', {default: 'collection'});
new Property(Collection, 'array', 'children');
new Property(Collection, 'boolean', 'visibility', {default: false});

Object.defineProperty(Collection, 'all', {
	get() {
		return Project.collections
	}
})
Object.defineProperty(Collection, 'selected', {
	get() {
		return Project.collections.filter(c => c.selected);
	}
})

SharedActions.add('delete', {
	subject: 'collection',
	condition: () => Prop.active_panel == 'collections' && Collection.selected.length,
	run() {
		let selected = Collection.selected.slice();
		Undo.initEdit({collections: selected});
		for (let c of selected) {
			Collection.all.remove(c)
		}
		selected.empty();
		Undo.finishEdit('Remove collection');
	}
})
SharedActions.add('duplicate', {
	subject: 'collection',
	condition: () => Prop.active_panel == 'collections' && Collection.selected.length,
	run() {
		let new_collections = [];
		Undo.initEdit({collections: new_collections});
		for (let original of Collection.selected.slice()) {
			let copy = new Collection(original);
			copy.name += ' - copy';
			copy.add(false).select();
			new_collections.push(copy);
		}
		Undo.finishEdit('Duplicate collection');
	}
})
SharedActions.add('copy', {
	subject: 'collection',
	condition: () => Prop.active_panel == 'collections' && Collection.selected.length,
	run() {
		Clipbench.collections = Collection.selected.map(collection => collection.getUndoCopy());
	}
})
SharedActions.add('paste', {
	subject: 'collection',
	condition: () => Prop.active_panel == 'collections' && Clipbench.collections?.length,
	run() {
		let new_collections = [];
		Undo.initEdit({collections: new_collections});
		for (let data of Clipbench.collections) {
			let copy = new Collection(data);
			copy.name += ' - copy';
			copy.add(false).select();
			new_collections.push(copy);
		}
		Undo.finishEdit('Paste collection');
	}
})

BARS.defineActions(() => {
	new Action('create_collection', {
		icon: 'inventory_2',
		category: 'select',
		click() {
			Undo.initEdit({collections: []});
			let collection = new Collection({});
			collection.add().addSelection().select();
			Undo.finishEdit('Create collection', {collections: [collection]});
			updateSelection();
		}
	})
	new Action('set_collection_content_to_selection', {
		icon: 'unarchive',
		category: 'select',
		condition: () => Collection.selected.length,
		click() {
			let collections = Collection.selected;
			Undo.initEdit({collections});
			for (let collection of collections) {
				collection.children.empty();
				collection.addSelection();
			}
			Undo.finishEdit('Set collection content to selection');
		}
	})
	new Action('add_to_collection', {
		icon: 'box_add',
		category: 'select',
		condition: () => Collection.selected.length,
		click() {
			let collections = Collection.selected;
			Undo.initEdit({collections});
			for (let collection of collections) {
				collection.addSelection();
			}
			Undo.finishEdit('Add selection to collection');
		}
	})
})

Interface.definePanels(function() {

	function eventTargetToCollection(target) {
		let target_node = target;
		let i = 0;
		while (target_node && target_node.classList && !target_node.classList.contains('collection')) {
			if (i < 3 && target_node) {
				target_node = target_node.parentNode;
				i++;
			} else {
				return [];
			}
		}
		let uuid_value = target_node.attributes?.uuid.value;
		return [Collection.all.find(collection => collection.uuid == uuid_value), target_node];
	}
	function getOrder(loc, obj) {
		if (!obj) {
			return;
		} else {
			if (loc <= 20) return -1;
			return 1;
		}
	}
	new Panel('collections', {
		icon: 'inventory_2',
		growable: true,
		resizable: true,
		optional: true,
		default_position: {
			slot: 'hidden',
			float_position: [0, 0],
			float_size: [300, 300],
			height: 300
		},
		condition: {modes: ['edit', 'paint']},
		toolbars: [
			new Toolbar('collections', {
				children: [
					'create_collection',
				]
			})
		],
		component: {
			name: 'panel-collections',
			data() { return {
				collections: [],
			}},
			methods: {
				openMenu(event) {
					Interface.Panels.collections.menu.show(event)
				},
				dragCollection(e1) {
					if (getFocusedTextInput()) return;
					if (e1.button == 1 || e1.button == 2) return;
					convertTouchEvent(e1);

					let [collection] = eventTargetToCollection(e1.target);
					if (!collection) return;
					let active = false;
					let helper;
					let timeout;
					let drop_target, drop_target_node, order;
					let last_event = e1;

					function move(e2) {
						convertTouchEvent(e2);
						let offset = [
							e2.clientX - e1.clientX,
							e2.clientY - e1.clientY,
						]
						if (!active) {
							let distance = Math.sqrt(Math.pow(offset[0], 2) + Math.pow(offset[1], 2))
							if (Blockbench.isTouch) {
								if (distance > 20 && timeout) {
									clearTimeout(timeout);
									timeout = null;
								} else {
									document.getElementById('collections_list').scrollTop += last_event.clientY - e2.clientY;
								}
							} else if (distance > 6) {
								active = true;
							}
						} else {
							if (e2) e2.preventDefault();
							
							if (Menu.open) Menu.open.hide();

							if (!helper) {
								helper = document.createElement('div');
								helper.id = 'animation_drag_helper';
								let icon = Blockbench.getIconNode('inventory_2'); helper.append(icon);
								let span = document.createElement('span');	span.innerText = collection.name;	helper.append(span);
								document.body.append(helper);
								Blockbench.addFlag('dragging_collections');
							}
							helper.style.left = `${e2.clientX}px`;
							helper.style.top = `${e2.clientY}px`;

							// drag
							$('.drag_hover').removeClass('drag_hover');
							$('.collection[order]').attr('order', null);

							let target = document.elementFromPoint(e2.clientX, e2.clientY);
							[drop_target, drop_target_node] = eventTargetToCollection(target);
							if (drop_target) {
								var location = e2.clientY - $(drop_target_node).offset().top;
								order = getOrder(location, drop_target)
								drop_target_node.setAttribute('order', order)
								drop_target_node.classList.add('drag_hover');
							}
						}
						last_event = e2;
					}
					function off(e2) {
						if (helper) helper.remove();
						removeEventListeners(document, 'mousemove touchmove', move);
						removeEventListeners(document, 'mouseup touchend', off);
						$('.drag_hover').removeClass('drag_hover');
						$('.collection[order]').attr('order', null);
						if (Blockbench.isTouch) clearTimeout(timeout);
						
						setTimeout(() => {
							Blockbench.removeFlag('dragging_collections');
						}, 10);

						if (active && !open_menu) {
							convertTouchEvent(e2);
							let target = document.elementFromPoint(e2.clientX, e2.clientY);
							[target_collection] = eventTargetToCollection(target);
							if (!target_collection || target_collection == collection ) return;

							let index = Collection.all.indexOf(target_collection);
							if (index == -1) return;
							if (Collection.all.indexOf(collection) < index) index--;
							if (order == 1) index++;
							if (Collection.all[index] == collection) return;
							
							Undo.initEdit({collections: [collection]});

							Collection.all.remove(collection);
							Collection.all.splice(index, 0, collection);

							Undo.finishEdit('Reorder collections');
						}
					}

					if (Blockbench.isTouch) {
						timeout = setTimeout(() => {
							active = true;
							move(e1);
						}, 320)
					}

					addEventListeners(document, 'mousemove touchmove', move, {passive: false});
					addEventListeners(document, 'mouseup touchend', off, {passive: false});
				},
				unselect(event) {
					if (Blockbench.hasFlag('dragging_collections')) return;
					Collection.all.forEach(collection => {
						collection.selected = false;
					})
					updateSelection();
				},
				getContentList(collection) {
					let types = {
						group: []
					}
					for (let child of collection.getChildren()) {
						if (!types[child.type]) types[child.type] = [];
						types[child.type].push(child);
					}
					let list = [];
					for (let key in types) {
						if (!types[key].length) continue;
						list.push({
							count: types[key].length == 1 ? '' : types[key].length,
							name: types[key].length == 1 ? types[key][0].name : '',
							icon: key == 'group' ? Group.prototype.icon : OutlinerElement.types[key].prototype.icon
						})
					}
					return list;
				}
			},
			template: `
				<ul
					id="collections_list"
					class="list mobile_scrollbar"
					@contextmenu.stop.prevent="openMenu($event)"
					@mousedown="dragCollection($event)"
					@touchstart="dragCollection($event)"
					@click.stop="unselect($event)"
				>
					<li
						v-for="collection in collections"
						:class="{ selected: collection.selected, in_limbo: collection.in_limbo }"
						:key="collection.uuid"
						:uuid="collection.uuid"
						class="collection"
						@click.stop="collection.select()"
						@dblclick.stop="collection.propertiesDialog()"
						@contextmenu.prevent.stop="collection.showContextMenu($event)"
					>
						<i class="material-icons">inventory_2</i>

						<div class="collection_center_wrapper">
							<label>
								{{ collection.name }}
							</label>
							<ul class="collection_content_list">
								<li v-for="content_stat of getContentList(collection)">
									{{ content_stat.count }}
									<dynamic-icon :icon="content_stat.icon.replace('fa ', '').replace(/ /g, '.')" />
									{{ content_stat.name }}
								</li>
							</ul>
						</div>

						<div class="in_list_button" @click.stop="collection.toggleVisibility($event)" @dblclick.stop>
							<i v-if="collection.getVisibility()" class="material-icons icon">visibility</i>
							<i v-else class="material-icons icon toggle_disabled">visibility_off</i>
						</div>
					</li>
				</ul>
			`
		},
		menu: new Menu([
			'create_collection',
			'copy',
		])
	})
})
