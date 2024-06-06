
class TextureGroup {
	constructor(data, uuid) {
		this.uuid = uuid ?? guid();
		this.folded = false;
		if (data) this.extend(data);
	}
	extend(data) {
		for (let key in TextureGroup.properties) {
			TextureGroup.properties[key].merge(this, data)
		}
		return this;
	}
	add() {
		TextureGroup.all.push(this);
		return this;
	}
	select() {
		let textures = this.getTextures();
		if (textures[0]) textures[0].select();
		for (let texture of textures) {
			if (!texture.selected) texture.multi_selected = true;
		}
		return this;
	}
	remove() {
		TextureGroup.all.remove(this);
	}
	showContextMenu(event) {
		Prop.active_panel = 'textures';
		this.menu.open(event, this);
	}
	getTextures() {
		return Texture.all.filter(texture => texture.group == this.uuid);
	}
	getUndoCopy() {
		let copy = {
			uuid: this.uuid
		};
		for (let key in TextureGroup.properties) {
			TextureGroup.properties[key].copy(this, copy)
		}
		return copy;
	}
	getSaveCopy() {
		let copy = {
			uuid: this.uuid
		};
		for (let key in TextureGroup.properties) {
			TextureGroup.properties[key].copy(this, copy)
		}
		return copy;
	}
}
Object.defineProperty(TextureGroup, 'all', {
	get() {
		return Project.texture_groups || [];
	},
	set(arr) {
		Project.texture_groups.replace(arr);
	}
})
new Property(TextureGroup, 'string', 'name', {default: tl('data.texture_group')});

TextureGroup.prototype.menu = new Menu([
	new MenuSeparator('manage'),
	{
		icon: 'fa-leaf',
		name: 'menu.texture_group.resolve',
		click(texture_group) {
			let textures = texture_group.getTextures();
			Undo.initEdit({textures, texture_groups: [texture_group]});
			texture_group.remove();
			textures.forEach(texture => {
				texture.group = '';
			})
			Undo.finishEdit('Resolve texture group', {textures, texture_groups: []});
		}
	},
])
/**
ToDo:
- Drag and dropping textures into empty groups
- Auto-generate groups
- Rearranging groups
- Grid view?
 */


BARS.defineActions(function() {
	new Action('create_texture_group', {
		icon: 'perm_media',
		category: 'textures',
		click() {
			let texture_group = new TextureGroup();
			let textures_to_add = Texture.all.filter(tex => tex.selected || tex.multi_selected);
			Undo.initEdit({texture_groups: [], textures: textures_to_add});
			if (textures_to_add.length) {
				for (let texture of textures_to_add) {
					texture.group = texture_group.uuid;
				}
				let first = Texture.selected || textures_to_add[0];
				texture_group.name = first.name.replace(/\.\w+$/, '') + ' Group';
			}
			texture_group.add(false);
			Undo.finishEdit('Add texture group', {texture_groups: [texture_group], textures: textures_to_add});
		}
	})
});