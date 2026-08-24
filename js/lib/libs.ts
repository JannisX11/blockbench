import * as GIFEnc from 'gifenc'
import $ from 'jquery'
import * as threejs from "three"
import Vue from 'vue/dist/vue.js'
import JSZip from 'jszip'
import Prism from 'prismjs'
import 'prismjs/components/prism-json'
import GIF from './gif'
import vSortable from 'vue-sortable'
import Sortable from 'sortablejs'
import {marked} from 'marked'
import { APNGencoder } from './canvas2apng'
import DOMPurify from 'dompurify'

Vue.use(vSortable)
Vue.directive('sortable', {
    inserted: function (el, binding) {
        new Sortable(el, binding.value || {})
    }
})

threejs.ColorManagement.enabled = false;
const THREE = Object.assign({}, threejs) as typeof import('three');

export {
    GIFEnc,
    GIF,
    THREE,
    $,
    $ as jQuery,
    Vue,
    JSZip,
    Prism,
    marked,
    APNGencoder,
    DOMPurify,
}
const global = {
    GIFEnc,
    THREE,
    jQuery: $,
    $,
    Vue,
    JSZip,
    Prism,
    marked,
    APNGencoder,
    DOMPurify,
}
declare global {
    const THREE: typeof threejs;
}
Object.assign(window, global);

