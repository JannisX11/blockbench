import * as GIFEnc from 'gifenc'
import $ from 'jquery'
import * as threejs from "three"
import * as FIK from './fik'
import Vue from 'vue/dist/vue.js'
import JSZip from 'jszip'
import Prism from 'prismjs'
import GIF from 'gif.js'

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
    Prism
}
Object.assign(window, {
    GIFEnc,
    GIF,
    THREE,
    jQuery: $,
    $,
    FIK,
    Vue,
    JSZip,
    Prism
})