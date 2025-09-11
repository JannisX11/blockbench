import * as GIFEnc from 'gifenc';
import $ from 'jquery';
import * as threejs from 'three';
import * as FIK from './fik';
import Vue from 'vue/dist/vue.js';
import JSZip from 'jszip';
import Prism from 'prismjs';
import GIF from 'gif.js';
import vSortable from 'vue-sortable';
import Sortable from 'sortablejs';
import { marked } from 'marked';
import { APNGencoder } from './canvas2apng';
import DOMPurify from 'dompurify';

Vue.use(vSortable);
Vue.directive('sortable', {
	inserted: function (el, binding) {
		new Sortable(el, binding.value || {});
	},
});

const THREE = Object.assign({}, threejs);

export {
	GIFEnc,
	GIF,
	THREE,
	$,
	$ as jQuery,
	FIK,
	Vue,
	JSZip,
	Prism,
	marked,
	APNGencoder,
	DOMPurify,
};
Object.assign(window, {
	GIFEnc,
	GIF,
	THREE,
	jQuery: $,
	$,
	FIK,
	Vue,
	JSZip,
	Prism,
	marked,
	APNGencoder,
	DOMPurify,
});
