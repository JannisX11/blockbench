import * as GIFEnc from 'gifenc'
import $ from 'jquery'
import * as threejs from "three"
import * as FIK from './fik'
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
}
const global = {
    GIFEnc,
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
}
declare global {
    const GIFEnc: typeof global.GIFEnc
    // const THREE: typeof global.THREE
    // const jQuery: typeof global.jQuery
    // const $: typeof global.jQuery
    const FIK: typeof global.FIK
    // const Vue: typeof global.Vue
    const JSZip: typeof global.JSZip
    const Prism: typeof global.Prism
    // const marked : typeof global.marked
    const APNGencoder : typeof global.APNGencoder
    const DOMPurify : typeof global.DOMPurify
}
Object.assign(window, global);
