(function () {
	var VueTreeItem = Vue.extend({
		template: 
		'<li class="outliner_node" v-bind:class="{ parent_li: node.children && node.children.length > 0}" v-bind:id="node.uuid">' +
			`<div v-on:contextmenu.prevent.stop="node.showContextMenu($event)"
				class="outliner_object" v-on:dblclick.stop.self="renameOutliner()"
				v-on:click="node.select($event, true)" v-on:touchstart="node.select($event)" :title="node.title"
				v-bind:class="{ cube: node.type === 'cube', group: node.type === 'group', selected: node.selected }"
				v-bind:style="{'padding-left': getIndentation(node) + 'px'}"
			>` +
				//Opener
				
				'<i v-if="node.children && node.children.length > 0 && (!Animator.open || node.children.some(o => o instanceof Group || o instanceof Locator))" v-on:click.stop="toggle(node)" class="icon-open-state fa" :class=\'{"fa-angle-right": !node.isOpen, "fa-angle-down": node.isOpen}\'></i>' +
				'<i v-else class="outliner_opener_placeholder"></i>' +
				//Main
				'<i :class="node.icon + (settings.outliner_colors.value ? \' ec_\'+node.color : \'\')" v-on:dblclick.stop="if (node.children && node.children.length) {node.isOpen = !node.isOpen;}"></i>' +
				'<input type="text" class="cube_name tab_target" v-model="node.name" disabled>' +


				`<i v-for="btn in node.buttons"
					v-if="(!btn.advanced_option || show_advanced_toggles || (btn.id === \'locked\' && node.isIconEnabled(btn)))"
					class="outliner_toggle"
					:class="getBtnClasses(btn, node)"
					:title="btn.title"
					v-on:click.stop="btnClick(btn, node)"
				></i>` +
			'</div>' +
			//Other Entries
			'<ul v-if="node.isOpen">' +
				'<vue-tree-item v-for="item in node.children" :node="item" :show_advanced_toggles="show_advanced_toggles" v-key="item.uuid"></vue-tree-item>' +
				`<div class="outliner_line_guide" v-if="node == Group.selected" v-bind:style="{left: getIndentation(node) + 'px'}"></div>` +
			'</ul>' +
		'</li>',
		props: {
			show_advanced_toggles: Boolean,
			node: {
				type: Object
			}
		},
		methods: {
			nodeClass: function (node) {
				if (node.isOpen) {
					return node.openedIcon || node.icon;
				} else {
					return node.closedIcon || node.icon;
				}
			},
			toggle: function (node) {
				if (node.hasOwnProperty('isOpen')) {
					node.isOpen = !node.isOpen;
				} else {
					Vue.set(node, 'isOpen', true);
				}
			},
			getBtnClasses: function (btn, node) {
				let value = node.isIconEnabled(btn);
				if (value === true) {
					return [btn.icon];
				} else if (value === false) {
					return [btn.icon_off, 'icon_off'];
				} else {
					return [btn.icon_alt];
				}
			},
			btnClick: function (btn, node) {
				if (typeof btn.click === 'function') {
					btn.click(node);
				}
			},
			getIndentation(node) {
				return node.getDepth ? (limitNumber(node.getDepth(), 0, (Interface.Panels.outliner.width-124) / 16) * 16) : 0;
			}
		},
		watch: {
			'node.isOpen': function (val) {
				if (!this.node.hasOwnProperty('_loading')) {
					Vue.set(this.node, '_loading', false);
				}
				if (val) {
					if (typeof this.node.onOpened === 'function') {
						this.node.onOpened(this.node);
					}
				} else {
					if (typeof this.node.onClosed === 'function') {
						this.node.onClosed(this.node);
					}
				}
			}
		}
	});
	Vue.component('vue-tree-item', VueTreeItem);

	var VueTree = Vue.extend({
		template: `
			<div class="vue-tree">
				<ul>
					<tree-item :node.sync="root" :show_advanced_toggles="show_advanced_toggles"></tree-item>
				</ul>
			</div>`,
		props: {
			show_advanced_toggles: Boolean,
			root: {
				type: Object
			}
		},
		components: {
			'tree-item': VueTreeItem
		}
	});
	Vue.component('vue-tree', VueTree);

})();
