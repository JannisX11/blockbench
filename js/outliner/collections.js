/**
 * Collection purposes
 * 

Toggle visibility of related elements
Combine with exporting selections?
Quick way to select and do all other stuff
Create selection based on regex filter? Like element prefixes
Auto-suggest creating such collections when opening the panel



 */




class Collection {
	constructor(data, texture = Texture.selected, uuid) {
		this.uuid = (uuid && isUUID(uuid)) ? uuid : guid();
		this.selected = false;
		if (data) this.extend(data);
	}
	extend(data) {
		for (var key in Collection.properties) {
			Collection.properties[key].merge(this, data)
		}
	}
	select() {
		this.selected = true;
		Outliner.selected.empty();
		for (let uuid of this.children) {
			let node = OutlinerNode.uuids[uuid];
		}
	}
	showContextMenu(event) {
		if (!this.selected) this.select();
		this.menu.open(event, this);
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
}
Collection.prototype.menu = new Menu([
	new MenuSeparator('settings'),
	new MenuSeparator('edit'),
	new MenuSeparator('copypaste'),
	'copy',
	'duplicate',
	'delete',
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
			Collection.all.remove()
		}
		selected.empty();
		Undo.finishEdit('Remove collection');
	}
})
/*SharedActions.add('duplicate', {
	subject: 'collection',
	condition: () => Prop.active_panel == 'collections' && Texture.selected?.selected_collection,
	run() {
		let texture = Texture.selected;
		let original = texture.getActiveCollection();
		let copy = original.getUndoCopy(true);
		copy.name += '-copy';
		Undo.initEdit({collections: [texture]});
		let collection = new Collection(copy);
		Undo.finishEdit('Duplicate collection');
	}
})
SharedActions.add('copy', {
	subject: 'collection',
	condition: () => Prop.active_panel == 'collections' && Collection.selected,
	run() {
		let collection = Collection.selected;
		let copy = collection.getUndoCopy(true);
		Clipbench.collection = copy;
	}
})
SharedActions.add('paste', {
	subject: 'collection',
	condition: () => Prop.active_panel == 'collections' && Texture.selected && Clipbench.collection,
	run() {
		let texture = Texture.selected;
		Undo.initEdit({collections: [texture]});
		let collection = new Collection(Clipbench.collection);
		Undo.finishEdit('Paste collection');
	}
})*/

BARS.defineActions(() => {
	new Action('create_collection', {
		icon: 'inventory_2',
		category: 'outliner',
		click() {
			Undo.initEdit({collections: []});
			let collection = new Collection({});
			Undo.finishEdit('Create collection', {collections: [collection]});
			updateSelection();
		}
	})
})

Interface.definePanels(function() {
	Vue.component('collection-icon', {
		props: {
			collection: Collection
		},
		template: '<div class="collection_icon_wrapper"></div>',
		mounted() {
			this.$el.append(this.collection.canvas);
		}
	})
	function eventTargetToCollection(target, texture) {
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
		return [texture.collections.find(collection => collection.uuid == target_node.attributes.collection_id.value), target_node];
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
		default_position: {
			slot: 'left_bar',
			float_position: [0, 0],
			float_size: [300, 300],
			height: 300
		},
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

					let texture = Texture.selected;
					if (!texture) return;
					let [collection] = eventTargetToCollection(e1.target, texture);
					if (!collection || collection.locked) return;

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
								let icon = document.createElement('i');		icon.className = 'material-icons'; icon.innerText = 'image'; helper.append(icon);
								let span = document.createElement('span');	span.innerText = collection.name;	helper.append(span);
								document.body.append(helper);
							}
							helper.style.left = `${e2.clientX}px`;
							helper.style.top = `${e2.clientY}px`;

							// drag
							$('.drag_hover').removeClass('drag_hover');
							$('.collection[order]').attr('order', null);

							let target = document.elementFromPoint(e2.clientX, e2.clientY);
							[drop_target, drop_target_node] = eventTargetToCollection(target, texture);
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

						if (active && !open_menu) {
							convertTouchEvent(e2);
							let target = document.elementFromPoint(e2.clientX, e2.clientY);
							[target_collection] = eventTargetToCollection(target, texture);
							if (!target_collection || target_collection == collection ) return;

							let index = Collection.all.indexOf(target_collection);

							if (index == -1) return;
							if (texture.collections.indexOf(collection) < index) index--;
							if (order == -1) index++;
							if (texture.collections[index] == collection) return;
							
							Undo.initEdit({collections: [texture]});

							texture.collections.remove(collection);
							texture.collections.splice(index, 0, collection);

							texture.updateChangesAfterEdit();
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
				}
			},
			template: `
				<ul
					id="collections_list"
					class="list mobile_scrollbar"
					@contextmenu.stop.prevent="openMenu($event)"
					@mousedown="dragCollection($event)"
					@touchstart="dragCollection($event)"
				>
					<li
						v-for="collection in collections"
						:class="{ selected: collection.selected, in_limbo: collection.in_limbo }"
						:key="collection.uuid"
						:collection_id="collection.uuid"
						class="collection"
						@click.stop="collection.select()"
						@dblclick.stop="collection.propertiesDialog()"
						@contextmenu.prevent.stop="collection.showContextMenu($event)"
					>
						<i class="material-icons">inventory_2</i>

						<label>
							{{ collection.name }}
						</label>

						<div class="in_list_button" @click.stop="collection.toggleVisibility()" @dblclick.stop>
							<i v-if="collection.visible" class="material-icons icon">visibility</i>
							<i v-else class="material-icons icon toggle_disabled">visibility_off</i>
						</div>
					</li>
				</ul>
			`
		},
		menu: new Menu([
			'create_collection',
		])
	})
})
