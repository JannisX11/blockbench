/// <reference path="./blockbench.d.ts"/>


export declare class SplineTubeFace extends MeshFace {
    constructor(mesh: any, spline: any, data: any);
    get element(): SplineMesh;
    getTexture(): Texture;
}
interface SplineCurveOptions {
	start_handle: any
	end_handle: any
	start: any
	end: any
	start_ctrl: any
	end_ctrl: any
}
export declare class SplineCurve {
    constructor(spline: SplineMesh, data: SplineCurveOptions);
    get element(): SplineMesh;
    extend(data: SplineCurveOptions): this;
    getCurveKey(): string | undefined;
    isSelected(): boolean;
    getSaveCopy(): {
        start_handle: any;
        end_handle: any;
        start: any;
        start_ctrl: any;
        end_ctrl: any;
        end: any;
    };
    getUndoCopy(): any;
    /**
     * Splits a curve in two distinct paths using De Casteljau's algorithm.
     * The split happens at the corresponding T (time) on the initial curve.
     *
     * @param {float} time Point at which the split occurs (in % from 0 to 1)
     * @returns {array} Adjusted and new points for our two new curves, as two Objects, one per curve.
     */
    split(time: any): {
        start: any;
        start_ctrl: any;
        middle_ctrl1: any;
        middle: any;
        middle_ctrl2: any;
        end_ctrl: any;
        end: any;
    };
}
interface SplineHandle {

}
export declare class SplineHandle {
    constructor(spline: SplineMesh, data: SplineHandle);
    get element(): SplineMesh;
    extend(data: SplineHandle): this;
    getHandleKey(): string | undefined;
    isSelected(): boolean;
    getSaveCopy(): {
        control1: any;
        joint: any;
        control2: any;
        tilt: any;
        size: any;
    };
    getUndoCopy(): any;
}
interface SplineMeshOptions {

}
export declare class SplineMesh extends OutlinerElement {
    constructor(data: any, uuid: any);
    get vertices(): Record<string, ArrayVector3>;
    get handles(): Record<string, SplineHandle>;
    get curves(): Record<string, SplineCurve>;
    set vertices(v: Record<string, ArrayVector3>);
    set handles(v: Record<string, SplineHandle>);
    set curves(v: Record<string, SplineCurve>);
    get position(): ArrayVector3;
    get vertice_list(): any[];
    cyclic: boolean
    export: boolean
    display_space: boolean
    radial_resolution: number
    radius_multiplier: number
    tubular_resolution: number
    uv_mode: 'length_accurate' |'uniform' | 'per_segment'
    render_mode: 'mesh' | 'path'
    render_order: 'default' | 'behind' | 'in_front'
    smooth_shading: boolean

    addVertices(...vectors: ArrayVector3[]): any[];
    addHandles(...handles: SplineHandle[]): any[];
    addCurves(...curves: SplineCurve[]): any[];
    extend(data: SplineMeshOptions): this;
    overwrite(data: SplineMeshOptions): this;
    getUndoCopy(aspects?: {}): {};
    getSaveCopy(): {};
    setColor(index: number): void;
    roll(axis: axisNumber, steps: number, origin_arg?: ArrayVector3): this;
    flip(axis: axisNumber, center?: number): this;
    /**
     * Refresh the dummy face object of this spline, allowing us to paint on it, or to convert it to a Mesh.
     */
    refreshTubeFaces(): void;
    getSelectedVertices(make: boolean = false): any;
    /**
     * Readonly list of selected handles, based on selected vertices.
     * @param {*} loose Tells the handle selection if it should count controls being selected without their joint.
    **/
    getSelectedHandles(loose?: boolean): string[];
    /**
     * Readonly list of selected curves, based on selected handles. See {@link getSelectedHandles()} for handle selection.
     * @param {*} loose Tells the handle selection if it should count controls being selected without their joint.
    **/
    getSelectedCurves(loose?: boolean): string[];
    getCurvesOfHandle(hKey: string): string[];
    getCurvesOfPoint(vKey: string): string[];
    getHandleOfPoint(vKey: string): string | undefined;
    getLastSelected(): SplineMesh | undefined;
    getLastHandle(): {
        data: SplineHandle;
        key: string;
    };
    getFirstHandle(): {
        data: SplineHandle;
        key: string;
    };
    getSize(axis?: axisNumber, selection_only?: any): number;
    /**
     * Gather control point transform data, primarily to orient the handleGizmos correctly, but also for normal transform space.
     * @param {*} hKey Key of the handle we want the transform of.
     * @param {*} euler re-orientation Euler in case we need to re-orient the result of this to match another direction.
    */
    getHandleEuler(hKey: string, euler?: THREE.Euler): {
        c1: any;
        c2: any;
        combined: any;
    };
    getWorldCenter(ignore_mesh_selection: any): THREE.Vector3;
    moveVector(arr: ArrayVector3, axis: axisNumber, update?: boolean): void;
    getCenter(global?: boolean): ArrayVector3;
    transferOrigin(origin: any, update?: boolean): this | undefined;
    /**
     * Applies the effects of Handle selection mode to the sibling vertex of this vKey. (Mirrored or Aligned)
     * @param {*} vkey The Key of the reference vertex, from which the result will be copied over to its sibling (if applicable).
     */
    applyHandleModeOnVertex(vkey: string): void;
    resize(val: any, axis: any, negative: any, allow_negative: any, bidirectional: any): void;
    getTubeMesh(removeDoubles?: boolean, mesh?: {
        faces: {};
        vertices: {};
    }): {
        faces: {};
        vertices: {};
    };
    getTubeGeo(shadeSmooth: any): {
        vertices: any[];
        normals: any[];
        indices: number[];
        uvs: number[];
    };
    getBézierPath(keepDoubles?: boolean): {
        tangents: any[];
        normals: any[];
        points: any[];
        sizes: any[];
        connections: boolean[];
        lengths: any[];
        accumulatedLengths: number[];
        pathLength: number;
    };
    getBézierNormal(tangent: any, up?: null): any;
    getBézierForCurve(time: any, key: string): {
        point: any;
        tangent: any;
    };
    getBézierForPoints(time: any, p1k: any, p2k: any, p3k: any, p4k: any): {
        point: any;
        tangent: any;
    };
    cubicBézier(time: any, point1: any, point2: any, point3: any, point4: any): {
        point: any;
        tangent: any;
    };
    getTexture(): Texture | undefined;
    applyTexture(texture: Texture): void;
    updateShading(shade_smooth: boolean): void;
}

