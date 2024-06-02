
class TextureGroup {
	constructor(data, uuid) {
		this.uuid = uuid ?? guid();
		this.textures = [];
		this.folded = false;
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
		Prop.active_panel = 'textures'
		this.menu.open(event, this)
	}
	getTextures() {
		let all_textures = Texture.all;
		return this.textures.map(uuid => {
			return all_textures.find(t => t.uuid == uuid);
		}).filter(texture => texture instanceof Texture);
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
new Property(TextureGroup, 'array', 'textures');

TextureGroup.prototype.menu = new Menu([
	new MenuSeparator('manage'),
	{
		icon: 'fa-leaf',
		name: 'menu.texture_group.resolve',
		click() {

		}
	},
])


BARS.defineActions(function() {
	new Action('create_texture_group', {
		icon: 'perm_media',
		category: 'textures',
		click() {
			let texture_group = new TextureGroup();
			if (Texture.selected) {
				texture_group.textures.push(Texture.selected.uuid);
				texture_group.name = Texture.selected.name.replace(/\.\w+$/, '') + 'Group';
			}
			texture_group.add()
		}
	})
});