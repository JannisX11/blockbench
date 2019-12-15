(function () {
	'use strict';
	var VueTreeItem = Vue.extend({
		template: 
		'<li class="outliner_node" v-bind:class="{ parent_li: node.children && node.children.length > 0}" v-bind:id="node.uuid">' +
			`<div v-on:contextmenu.prevent.stop="node.showContextMenu($event)"
				class="outliner_object" v-on:dblclick.stop.self="renameOutliner()"
				v-on:click="node.select($event, true)" v-on:touchstart="node.select($event)" :title="node.title"
				v-bind:class="{ cube: node.type === \'cube\', group: node.type === \'group\', selected: node.selected }"
				v-bind:style="{'padding-left': (node.getDepth ? limitNumber(node.getDepth(), 0, (Interface.Panels.outliner.width-124) / 16) * 16 : 0)+'px'}"
			>` +
				//Opener
				
				'<i v-if="node.children && node.children.length > 0 && (!Animator.open || node.children.some(o => o instanceof Group))" v-on:click.stop="toggle(node)" class="icon-open-state fa" :class=\'{"fa-caret-right": !node.isOpen, "fa-caret-down": node.isOpen}\'></i>' +
				'<i v-else class="outliner_opener_placeholder"></i>' +
				//Main
				'<i :class="node.icon + (settings.outliner_colors.value ? \' ec_\'+node.color : \'\')" v-on:dblclick.stop="if (node.children && node.children.length) {node.isOpen = !node.isOpen;}"></i>' +
				'<input type="text" class="cube_name tab_target" v-model="node.name" disabled>' +
				'<a v-for="btn in node.buttons" class="ml5" href="javascript:" :title="btn.title" v-on:click.stop="btnClick(btn, node)" v-bind:class="{advanced_option: btn.advanced_option}">' +
					'<i v-if="node.isIconEnabled(btn) === true" :class="btn.icon"></i>' +
					'<i v-else-if="node.isIconEnabled(btn) === \'alt\'" :class="btn.icon_alt"></i>' +
					'<i v-else :class="btn.icon_off"></i>' +
				'</a>' +
			'</div>' +
			//Other Entries
			'<ul v-show="node.isOpen">' +
				'<vue-tree-item v-for="item in node.children" :node="item" v-key="item.uuid"></vue-tree-item>' +
			'</ul>' +
		'</li>',
		props: {
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
			btnClick: function (btn, node) {
				if (typeof btn.click === 'function') {
					btn.click(node);
				}
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
		template: '<div class="vue-tree"><ul>' +
		'<tree-item :node.sync="option.root"></tree-item>' +
		'</ul></div>',
		props: {
			option: {
				type: Object
			}
		},
		components: {
			'tree-item': VueTreeItem
		}
	});
	Vue.component('vue-tree', VueTree);
})();