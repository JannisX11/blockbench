import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import $ from 'jquery'
import * as threejs from "three"
import * as FIK from './fik'
const THREE = Object.assign({}, threejs);

Object.assign(window, {
    GIFEnc: { GIFEncoder, quantize, applyPalette },
    THREE,
    jQuery: $,
    $,
    FIK
})