(function () {
    'use strict';
    var VueTreeItem = Vue.extend({
        template: 
        '<li class="outliner_node" v-bind:class="{ parent_li: node.children && node.children.length > 0}" v-bind:id="node.uuid">' +
            '<div @contextmenu.prevent.stop="node.showContextMenu($event)" class="outliner_object" v-on:dblclick="node.rename($event)" v-on:click="node.select($event)" :title="node.title" v-bind:class="{ cube: node.title === \'Cube\', group: node.title === \'Group\', selected: node.display.isselected }">' +
                //Opener
                '<i v-if="node.children && node.children.length > 0" v-on:click="toggle(node)" class="fa icon-open-state" :class=\'{"fa-caret-right": !node.isOpen, "fa-caret-down": node.isOpen}\'></i>' +
                '<i v-else class="outliner_opener_placeholder"></i>' +
                //Main
                '<i v-if="showIcon(node)" :class="nodeClass(node)"></i>' +
                '<input type="text" class="cube_name" v-model="node.name" disabled>' +
                '<a v-for="btn in node.buttons" class="ml5" href="javascript:" :title="btn.title" v-on:click.stop="btnClick(btn, node)" v-bind:class="{advanced_option: btn.advanced_option}">' +
                    '<i v-if="node.isIconEnabled(btn.title) === true" :class="btn.icon"></i>' +
                    '<i v-else :class="btn.icon_off"></i>' +
                '</a>' +
            '</div>' +
            //Other Entries
            '<ul v-show="node.isOpen">' +
                //'<li v-show="node.showLoading && node._loading"><i class="fa fa-spinner fa-pulse"></i></li>' +
                '<vue-tree-item v-for="item in node.children" :node="item" v-key="item.uuid"></vue-tree-item>' +
            '</ul>' +
        '</li>',
        props: {
            node: {
                type: Object
            }
        },
        methods: {
            showIcon: function (node) {
                return node.icon || node.openedIcon || node.closedIcon;
            },
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