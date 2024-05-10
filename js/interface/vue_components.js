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
			<input type="text" inputmode="search" ref="input" class="dark_bordered" :value="value" @focusout="hidden = hide;" @input="change($event.target.value)">
			<i class="material-icons" :class="{light_on_hover: !!value}" @click="clickIcon()">{{ value ? 'clear' : 'search' }}</i>
		</div>`
})

Vue.component('select-input', {
	props: {
		value: String,
		options: Object,
		custom_dropdown: Function
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
			if (typeof this.custom_dropdown == 'function') {
				items = this.custom_dropdown(event, (value) => this.set(value));
			} else {
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
			}
			let menu = new Menu(this.id, items, {searchable: items.length > 16, class: 'select_menu'});
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

Vue.component('numeric-input', {
	props: {
		value: Number,
		min: Number,
		max: Number,
		step: Number,
	},
	data() {return {
		string_value: (this.value||0).toString(),
		resolved_value: (this.value||0)
	}},
	watch: {
		value(v) {
			if (this.resolved_value != v) {
				this.string_value = trimFloatNumber(v, 10);
				this.resolved_value = v;
			}
		}
	},
	methods: {
		change(value) {
			this.string_value = typeof value == 'number' ? trimFloatNumber(value) : value;
			this.resolved_value = Math.clamp(NumSlider.MolangParser.parse(this.string_value), this.min, this.max);
			this.$emit('input', this.resolved_value);
		},
		slide(e1) {
			convertTouchEvent(e1);
			let last_difference = 0;
			let move = e2 => {
				convertTouchEvent(e2);
				let difference = Math.trunc((e2.clientX - e1.clientX) / 10) * (this.step || 1);
				if (difference != last_difference) {
					let value = Math.clamp((parseFloat(this.value) || 0) + (difference - last_difference), this.min, this.max);
					this.change(value);
					last_difference = difference;
				}
			}
			let stop = e2 => {
				removeEventListeners(document, 'mousemove touchmove', move);
				removeEventListeners(document, 'mouseup touchend', stop);
			}
			addEventListeners(document, 'mousemove touchmove', move);
			addEventListeners(document, 'mouseup touchend', stop);
		},
		resolve() {
			this.string_value = trimFloatNumber(this.resolved_value, 10);
		}
	},
	template: `
		<div class="numeric_input">
			<input class="dark_bordered focusable_input" :value="string_value" @input="change($event.target.value)" :inputmode="min >= 0 ? 'decimal' : ''" lang="en" @focusout="resolve($event)" @dblclick="resolve($event)">
			<div class="tool numeric_input_slider" @mousedown="slide($event)" @touchstart="slide($event)"><i class="material-icons">code</i></div>
		</div>
	`,
	mounted() {
		if (typeof this.min == 'string') console.warn('Argument "min" should be set as a numeric property via "v-bind:"')
		if (typeof this.max == 'string') console.warn('Argument "max" should be set as a numeric property via "v-bind:"')
		if (typeof this.step == 'string') console.warn('Argument "step" should be set as a numeric property via "v-bind:"')
	}
})
Vue.component('dynamic-icon', {
	props: {
		icon: String,
		color: String,
	},
	render(h) {
		let node = Blockbench.getIconNode(this.icon, this.color);
		let attrs = {
			class: node.className,
			attrs: {
				src: node.attributes.src?.value
			},
			style: {
				color: node.style.color
			},
			on: this.$listeners
		};
		return h(node.tagName, attrs, node.textContent);
	}
})
