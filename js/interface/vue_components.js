Vue.component('search-bar', {
	props: {
		value: String,
		hide: Boolean
	},
	data() {return {
		hidden: this.hide
	}},
	methods: {
		change(text) {
			this.$emit('input', text)
		},
		clickIcon() {
			if (this.hide && !this.value) {
				this.hidden = false;
				this.$refs.input.focus();
			} else {
				this.value = '';
				this.$emit('input', '');
			}
		}
	},
	template: `
		<div class="search_bar" :class="{folded: (!value && hidden)}">
			<input type="text" ref="input" class="dark_bordered" :value="value" @focusout="hidden = hide;" @input="change($event.target.value)">
			<i class="material-icons" :class="{light_on_hover: !!value}" @click="clickIcon()">{{ value ? 'clear' : 'search' }}</i>
		</div>`
})

Vue.component('select-input', {
	props: {
		value: String,
		options: Object
	},
	data() {return {
		id: bbuid(8)
	}},
	methods: {
		set(value) {
			this.value = value;
			this.$emit('input', value);
		},
		getNameFor(key) {
			let val = this.options[key];
			if (val) {
				return tl(val.name || val);
			} else {
				return '';
			}
		},
		open(event) {
			if (Menu.closed_in_this_click == this.id) return this;
			let items = [];
			for (let key in this.options) {
				let val = this.options[key];
				if (val) {
					items.push({
						name: this.getNameFor(key),
						icon: val.icon || ((this.value == key) ? 'far.fa-dot-circle' : 'far.fa-circle'),
						condition: val.condition,
						click: (e) => {
							this.set(key);
						}
					})
				}
			}
			let menu = new Menu(this.id, items, {searchable: items.length > 16});
			menu.node.style['min-width'] = this.$el.clientWidth+'px';
			menu.open(event.target, this);
		}
	},
	template: `
		<bb-select @click="open($event)">
			{{ getNameFor(value) }}
		</bb-select>
	`
})