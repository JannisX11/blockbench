import { Property } from "../util/property";

export class SplineTubeFace extends Face {
	constructor(spline, data) {
		super(data);
		this.spline = spline;
		this.texture = false;
		if (data) {
			this.extend(data);
		}
	}
	get element() {
		return this.spline;
	}
	getNormal() {
        let v1 = this.vertices[0].slice();
        let v2 = this.vertices[1].slice();
        let v3 = this.vertices[2].slice();
        let vec1 = v2.V3_subtract(v1).V3_toThree();
        let vec2 = v3.V3_subtract(v1).V3_toThree();
        let faceNormal = new THREE.Vector3().crossVectors(vec1, vec2).normalize();

        return faceNormal;
	}
    getTexture() {
        return this.spline.getTexture();
    }
    // (almost) Straight from MeshFace, but it doesn't work
	texelToLocalMatrix(uv, truncate_factor = [1, 1], truncated_uv) {

		// Use non-truncated uv coordinates to select the correct triangle of a face.
        let is_in_tri = pointInTriangle(uv, this.uvs[0], this.uvs[1], this.uvs[2]);
		let vert_a = is_in_tri ? 0 : 0;
		let vert_b = is_in_tri ? 1 : 2;
		let vert_c = is_in_tri ? 2 : 3;

		let p0 = this.uvs[vert_a];
		let p1 = this.uvs[vert_b];
		let p2 = this.uvs[vert_c];

		let vertexa = this.vertices[vert_a];
		let vertexb = this.vertices[vert_b];
		let vertexc = this.vertices[vert_c];

		uv = truncated_uv == null || truncated_uv[0] == null || truncated_uv[1] == null ? [...uv] : [...truncated_uv];

		function UVToLocal(uv) {
			let b0 = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
			let b1 = ((p1[0] - uv[0]) * (p2[1] - uv[1]) - (p2[0] - uv[0]) * (p1[1] - uv[1])) / b0;
			let b2 = ((p2[0] - uv[0]) * (p0[1] - uv[1]) - (p0[0] - uv[0]) * (p2[1] - uv[1])) / b0;
			let b3 = ((p0[0] - uv[0]) * (p1[1] - uv[1]) - (p1[0] - uv[0]) * (p0[1] - uv[1])) / b0;

			return new THREE.Vector3(
				vertexa[0] * b1 + vertexb[0] * b2 + vertexc[0] * b3,
				vertexa[1] * b1 + vertexb[1] * b2 + vertexc[1] * b3,
				vertexa[2] * b1 + vertexb[2] * b2 + vertexc[2] * b3
			)
		}

		let texel_pos = UVToLocal(uv);
		let texel_x_axis = UVToLocal([uv[0] + truncate_factor[0], uv[1]]);
		let texel_y_axis = UVToLocal([uv[0], uv[1] + truncate_factor[1]]);

		texel_x_axis.sub(texel_pos);
		texel_y_axis.sub(texel_pos);

		let matrix = new THREE.Matrix4();
		matrix.makeBasis(texel_x_axis, texel_y_axis, new THREE.Vector3(0, 0, 1));
		matrix.setPosition(texel_pos);
		return matrix;
	}
    // (almost) Straight from MeshFace, but it doesn't work
	UVToLocal(uv) {

		// Use non-truncated uv coordinates to select the correct triangle of a face.
        let is_in_tri = pointInTriangle(uv, this.uvs[0], this.uvs[1], this.uvs[2]);
		let vert_a = is_in_tri ? 0 : 0;
		let vert_b = is_in_tri ? 1 : 2;
		let vert_c = is_in_tri ? 2 : 3;

		let p0 = this.uvs[vert_a];
		let p1 = this.uvs[vert_b];
		let p2 = this.uvs[vert_c];

		let vertexa = this.vertices[vert_a];
		let vertexb = this.vertices[vert_b];
		let vertexc = this.vertices[vert_c];

		let b0 = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])
		let b1 = ((p1[0] - uv[0]) * (p2[1] - uv[1]) - (p2[0] - uv[0]) * (p1[1] - uv[1])) / b0
		let b2 = ((p2[0] - uv[0]) * (p0[1] - uv[1]) - (p0[0] - uv[0]) * (p2[1] - uv[1])) / b0
		let b3 = ((p0[0] - uv[0]) * (p1[1] - uv[1]) - (p1[0] - uv[0]) * (p0[1] - uv[1])) / b0

		let local_space = new THREE.Vector3(
			vertexa[0] * b1 + vertexb[0] * b2 + vertexc[0] * b3,
			vertexa[1] * b1 + vertexb[1] * b2 + vertexc[1] * b3,
			vertexa[2] * b1 + vertexb[2] * b2 + vertexc[2] * b3,
		)
		return local_space;	
	}
}
new Property(SplineTubeFace, 'array', 'vertices');
new Property(SplineTubeFace, 'array', 'uvs');

export class SplineCurve {
    constructor(spline, data) {
        for (var key in this.constructor.properties) {
            this.constructor.properties[key].reset(this);
        }
        
        this.spline = spline;
        this.start_handle = '';
        this.end_handle = '';
        this.start = '';
        this.start_ctrl = '';
        this.end_ctrl = '';
        this.end = '';

        if (data) {
            this.extend(data);
        }
    }
    get element() {
        return this.spline;
    }
    extend(data) {
        for (var key in this.constructor.properties) {
            this.constructor.properties[key].merge(this, data)
        }

        // Handles
        if (data.start_handle) this.start_handle = data.start_handle;
        if (data.end_handle) this.end_handle = data.end_handle;

        // Points
        if (data.start) this.start = data.start;
        if (data.start_ctrl) this.start_ctrl = data.start_ctrl;
        if (data.end_ctrl) this.end_ctrl = data.end_ctrl;
        if (data.end) this.end = data.end;

        // Below we handle cases where some parts of the data are not present
        // re-Handles
        if (data.start && data.end) {
            if (!data.start_handle) this.start_handle = this.spline.getHandleOfPoint(data.start);
            if (!data.end_handle) this.end_handle = this.spline.getHandleOfPoint(data.end);
        }

        // re-Points
        if (data.start_handle && data.end_handle) {
            let sh = this.spline.handles[data.start_handle];
            let eh = this.spline.handles[data.end_handle];

            if (!data.start) this.start = sh.joint;
            if (!data.start_ctrl) this.start_ctrl = sh.control2;
            if (!data.end_ctrl) this.end_ctrl = eh.control1;
            if (!data.end) this.end = eh.joint;
        }
            
        return this;
    }
    getCurveKey() {
        for (let cKey in this.spline.curves) {
            if (this.spline.curves[cKey] == this) return cKey;
        }
    }
    isSelected() {
        let start_select = Project.spline_selection[this.spline.uuid].vertices.includes(this.start);
        let end_select = Project.spline_selection[this.spline.uuid].vertices.includes(this.end);
        return !!Project.spline_selection[this.spline.uuid] && start_select && end_select;
    }
    getSaveCopy() {
        let copy = {
            start_handle: this.start_handle,
            end_handle: this.end_handle,
            start: this.start,
            start_ctrl: this.start_ctrl,
            end_ctrl: this.end_ctrl,
            end: this.end
        };

        for (let key in this.constructor.properties) {
            if (this[key] != this.constructor.properties[key].default) this.constructor.properties[key].copy(this, copy);
        }

        return copy;
    }
    getUndoCopy() {
        let copy = new this.constructor(this.spline, this);
        delete copy.spline;
        return copy;
    }
}

export class SplineHandle {
    constructor(spline, data) {
        for (var key in this.constructor.properties) {
            this.constructor.properties[key].reset(this);
        }
        this.spline = spline;
        this.joint = '';
        this.control1 = '';
        this.control2 = '';
        if (data) {
            this.extend(data);
        }
    }
    get element() {
        return this.spline;
    }
    extend(data) {
        for (var key in this.constructor.properties) {
            this.constructor.properties[key].merge(this, data)
        }
        
        if (data.control1) this.control1 = data.control1;
        if (data.control2) this.control2 = data.control2;
        if (data.joint) this.joint = data.joint;

        if (data.tilt) this.tilt = data.tilt;
        if (data.size) this.size = data.size;
        return this;
    }
    getHandleKey() {
        for (let hkey in this.spline.handles) {
            if (this.spline.handles[hkey] == this) return hkey;
        }
    }
    isSelected() {
        return !!Project.spline_selection[this.spline.uuid] && Project.spline_selection[this.spline.uuid].vertices.includes(this.joint);
    }
    getSaveCopy() {
        let copy = {
            control1: this.control1,
            joint: this.joint,
            control2: this.control2,
            tilt: this.tilt,
            size: this.size
        };

        for (let key in this.constructor.properties) {
            if (this[key] != this.constructor.properties[key].default) this.constructor.properties[key].copy(this, copy);
        }

        return copy;
    }
    getUndoCopy() {
        let copy = new this.constructor(this.spline, this);
        copy.tilt = this.tilt;
        copy.size = this.size;
        delete copy.spline;
        return copy;
    }
}
new Property(SplineHandle, 'number', 'tilt', { default: 0 });
new Property(SplineHandle, 'number', 'size', { default: 1 });

export class SplineMesh extends OutlinerElement {
    constructor(data, uuid) {
        super(data, uuid)
		this.texture = false;

        this._static = {
            // Both Handles and Curves must ALWAYS be in proper rendering order, or a lot of features will break.
            properties: {
                handles: {}, // Main component of the spline
                curves: {}, // Segments of the spline
                vertices: {}, // Points of the handles
                faces: {} // Solely here so we can paint on splines (yeah, that's a bit silly). These don't even get saved, they serve a runtime purpose.
            }
        }
        Object.freeze(this._static);

        if (!data.vertices) {
            // Base points of the curve, a chain of point triplets frorming a series of curve between their origins & control points.
            // Math: https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Cubic_B%C3%A9zier_curves
            // https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Higher-order_curves
            this.addVertices(
                [8, 0, 4], [8, 0.5, 0], [8, 1, -4],
                [4, 2, -4], [4, 2.5, 0], [4, 3, 4],
                [0, 4, 4], [0, 4.5, 0], [0, 5, -4],
                [-4, 6, -4], [-4, 6.5, 0], [-4, 7, 4],
                [-8, 8, 4], [-8, 8.5, 0], [-8, 9, -4]
            );
            let vertex_keys = Object.keys(this.vertices);

            // Spline handles are made of two control points & one position point, forming patters as follows (. = point, ! = control, - = curve):
            // !.!-!.!-!.!
            this.addHandles(new SplineHandle(this, { control1: vertex_keys[0], joint: vertex_keys[1], control2: vertex_keys[2] }))
            this.addHandles(new SplineHandle(this, { control1: vertex_keys[3], joint: vertex_keys[4], control2: vertex_keys[5] }))
            this.addHandles(new SplineHandle(this, { control1: vertex_keys[6], joint: vertex_keys[7], control2: vertex_keys[8] }))
            this.addHandles(new SplineHandle(this, { control1: vertex_keys[9], joint: vertex_keys[10], control2: vertex_keys[11] }))
            this.addHandles(new SplineHandle(this, { control1: vertex_keys[12], joint: vertex_keys[13], control2: vertex_keys[14] }))
            let handle_keys = Object.keys(this.handles);

            // Objects representing Cubic bézier curves (P1, P2, P3, P4)
            this.addCurves(new SplineCurve(this, { start_handle: handle_keys[0], end_handle: handle_keys[1] })); //  )
            this.addCurves(new SplineCurve(this, { start_handle: handle_keys[1], end_handle: handle_keys[2] })); // (
            this.addCurves(new SplineCurve(this, { start_handle: handle_keys[2], end_handle: handle_keys[3] })); //  )
            this.addCurves(new SplineCurve(this, { start_handle: handle_keys[3], end_handle: handle_keys[4] })); // (

        }
        for (var key in SplineMesh.properties) {
            SplineMesh.properties[key].reset(this);
        }
        if (data && typeof data === 'object') {
            this.extend(data)
        }
    }
    get vertices() {
        return this._static.properties.vertices;
    }
    get handles() {
        return this._static.properties.handles;
    }
    get curves() {
        return this._static.properties.curves;
    }
    set vertices(v) {
        this._static.properties.vertices = v;
    }
    set handles(v) {
        this._static.properties.handles = v;
    }
    set curves(v) {
        this._static.properties.curves = v;
    }
    get position() {
        return this.origin;
    }
    get vertice_list() {
        return Object.keys(this.vertices).map(key => this.vertices[key]);
    }
    addVertices(...vectors) {
        return vectors.map(vector => {
            let key;
            while (!key || this.vertices[key]) {
                key = bbuid(4);
            }
            this.vertices[key] = [vector[0] || 0, vector[1] || 0, vector[2] || 0];
            return key;
        })
    }
    addHandles(...handles) {
        return handles.map(handle => {
            let key;
            while (!key || this.handles[key]) {
                key = bbuid(8);
            }
            this.handles[key] = handle;

            return key;
        })
    }
    addCurves(...curves) {
        return curves.map(curve => {
            let key;
            while (!key || this.curves[key]) {
                key = bbuid(4);
            }
            this.curves[key] = curve;
            
            return key;
        })
    }
    extend(data) {
        for (var key in SplineMesh.properties) {
            SplineMesh.properties[key].merge(this, data)
        }
        // Identical to mesh
        if (typeof data.vertices == 'object') {
            for (let key in this.vertices) {
                if (!data.vertices[key]) {
                    delete this.vertices[key];
                }
            }
            if (data.vertices instanceof Array) {
                this.addVertices(...data.vertices);
            } else {
                for (let key in data.vertices) {
                    if (!this.vertices[key]) this.vertices[key] = [];
                    this.vertices[key].replace(data.vertices[key]);
                }
            }
        }
        // Essentially the same as a mesh face, but holds different data
        if (typeof data.handles == 'object') {
            for (let key in this.handles) {
                if (!data.handles[key]) {
                    delete this.handles[key];
                }
            }
            for (let key in data.handles) {
                if (this.handles[key]) {
                    this.handles[key].extend(data.handles[key])
                } else {
                    this.handles[key] = new SplineHandle(this, data.handles[key]);
                }
            }
        }

        if (typeof data.curves == 'object') {
            for (let key in this.curves) {
                if (!data.curves[key]) {
                    delete this.curves[key];
                }
            }
            for (let key in data.curves) {
                if (this.curves[key]) {
                    this.curves[key].extend(data.curves[key])
                } else {
                    this.curves[key] = new SplineCurve(this, data.curves[key]);
                }
            }
        }

        // About the same as Outliner.Face, nudged to work in this context
		if (Texture.all.includes(data.texture)) this.texture = data.texture.uuid;
		else this.texture = data.texture;

        this.refreshTubeFaces();
        this.sanitizeName();
        return this;
    }
    overwrite(data) { // for Undo specifically, we can't afford having Handles or Curves mis-ordered.
        for (var key in SplineMesh.properties) {
            SplineMesh.properties[key].merge(this, data)
        }
        // Identical to mesh extend, this one can be mis-ordered
        if (typeof data.vertices == 'object') {
            for (let key in this.vertices) {
                if (!data.vertices[key]) {
                    delete this.vertices[key];
                }
            }
            if (data.vertices instanceof Array) {
                this.addVertices(...data.vertices);
            } else {
                for (let key in data.vertices) {
                    if (!this.vertices[key]) this.vertices[key] = [];
                    this.vertices[key].replace(data.vertices[key]);
                }
            }
        }
        // Both elements below need to preserve their order
        if (typeof data.handles == 'object') {
            for (let key in this.handles) {
                delete this.handles[key];
            }
            for (let key in data.handles) {
                this.handles[key] = new SplineHandle(this, data.handles[key]);
            }
        }
        if (typeof data.curves == 'object') {
            for (let key in this.curves) {
                delete this.curves[key];
            }
            for (let key in data.curves) {
                this.curves[key] = new SplineCurve(this, data.curves[key]);
            }
        }

        // This isn't an ordered object, so it's identical to extend()
        // About the same as Outliner.Face, nudged to work in this context
		if (Texture.all.includes(data.texture)) this.texture = data.texture.uuid;
		else this.texture = data.texture;

        this.refreshTubeFaces();
        this.sanitizeName();
        return this;
    }
    /**
     * Refresh the dummy face object of this spline, so we can paint on it
     * this feels super dirty, feel free to judge it :P
     */
    refreshTubeFaces() {
        if (Object.keys(this.curves).length) {
            let tube = this.getTubeGeo(false);
            let face_arr = [];
            this.faces = {};

            for (let i = 0; i < tube.indices.length / 6; i++) {
                let i1 = tube.indices[i + 0];
                let i2 = tube.indices[i + 1];
                let i3 = tube.indices[i + 2];
                let i4 = tube.indices[i + 5];

                let vertices = [];
                let uvs = [];
                [i1, i2, i3, i4].forEach(index => {
                    let v2Off = index*3;
                    let v3Off = index*3;

                    vertices.push([
                        tube.vertices[v3Off], 
                        tube.vertices[v3Off + 1],
                        tube.vertices[v3Off + 2]
                    ]);

                    uvs.push([
                        tube.uvs[v2Off], 
                        tube.uvs[v2Off + 1]
                    ]);
                })

                let face = new SplineTubeFace(this, {vertices: vertices, uvs: uvs});
                face_arr.push(face);
            }

            face_arr.map(face => {
                let key;
                while (!key || this.faces[key]) {
                    key = bbuid(4);
                }
                this.faces[key] = face;
            })
        }
    }
    getUndoCopy(aspects = {}) {
        let copy = {};
        for (var key in SplineMesh.properties) {
            SplineMesh.properties[key].copy(this, copy);
        }

        copy.vertices = {};
        for (let key in this.vertices) {
            copy.vertices[key] = this.vertices[key].slice();
        }

        copy.handles = {};
        for (let key in this.handles) {
            copy.handles[key] = this.handles[key].getUndoCopy();
        }

        copy.curves = {};
        for (let key in this.curves) {
            copy.curves[key] = this.curves[key].getUndoCopy();
        }

        // About the same as Outliner.Face, nudged to work in this context
		let tex = this.getTexture();
		if (tex === null)
			copy.texture = null;
		else if (tex instanceof Texture)
            copy.texture = tex.uuid;
		else if (typeof tex === 'string')
			copy.texture = tex;

        copy.type = 'spline';
        copy.uuid = this.uuid;
        // console.log(this, copy);
        return copy;
    }
    getSaveCopy(project) {
        var copy = {}
        for (var key in SplineMesh.properties) {
            SplineMesh.properties[key].copy(this, copy)
        }

        copy.vertices = {};
        for (let key in this.vertices) {
            copy.vertices[key] = this.vertices[key].slice();
        }

        copy.handles = {};
        for (let key in this.handles) {
            copy.handles[key] = this.handles[key].getSaveCopy();
        }

        copy.curves = {};
        for (let key in this.curves) {
            copy.curves[key] = this.curves[key].getSaveCopy();
        }

        // About the same as Outliner.Face, nudged to work in this context
		let tex = this.getTexture();
		if (tex === null)
			copy.texture = null;
		else if (tex instanceof Texture)
            copy.texture = tex.uuid;
		else if (typeof tex === 'string')
			copy.texture = tex;

        copy.type = 'spline';
        copy.uuid = this.uuid
        return copy;
    }
    setColor(index) {
        this.color = index;
        if (this.visibility) {
            this.preview_controller.updateFaces(this);
        }
    }
    getSelectedVertices(make) {
        if (make && !Project.spline_selection[this.uuid]) Project.spline_selection[this.uuid] = { vertices: [] };
        let selection = Project.spline_selection[this.uuid]?.vertices || [];
        return selection;
    }
    /**
    Readonly list of selected handles, based on selected vertices.
    @param {*} loose Tells the handle selection if it should count controls being selected without their joint.
    **/
    getSelectedHandles(loose = false) {
        let selection = this.getSelectedVertices();

        let selected_handles = [];
        if (selection.length > 0) {
            for (let hkey in this.handles) {
                let handle = this.handles[hkey];

                // if all goes normally, the joint being selected should always indicate the other points of this handle are selected.
                if (selection.includes(handle.joint)) {
                    selected_handles.push(hkey);
                }

                // "Loose" means we consider either controls being selected as the whole handle being selected.
                if (loose && !selected_handles.includes(hkey)) {
                    if (selection.includes(handle.control1) || selection.includes(handle.control2)) {
                        selected_handles.push(hkey);
                    }
                }
            }
        }

        return selected_handles;
    }
    /**
    Readonly list of selected curves, based on selected handles. See {@link getSelectedHandles()} for handle selection.
    @param {*} loose Tells the handle selection if it should count controls being selected without their joint.
    **/
    getSelectedCurves(loose = false) {
        let selection = this.getSelectedHandles(loose);

        let selected_curves = [];
        if (selection.length > 0) {
            for (let cKey in this.curves) {
                let curve = this.curves[cKey];

                for (let i = 0; i < (selection.length - 1); i++) {
                    let thisHandle = this.handles[selection[i]];
                    let nextHandle = this.handles[selection[i + 1]];

                    if (thisHandle.joint == curve.start && nextHandle.joint == curve.end) {
                        selected_curves.push(cKey);
                    }
                }
            }
        }

        return selected_curves;
    }
    getCurvesOfHandle(hKey) {
        let curves = []
        for (let cKey in this.curves) {
            let curve = this.curves[cKey];

            if (hKey == curve.start_handle || hKey == curve.end_handle) {
                curves.push(cKey);
            }
        }
        return curves;
    }
    getCurvesOfPoint(vKey) {
        let curves = []
        for (let cKey in this.curves) {
            let curve = this.curves[cKey];

            if (vKey == curve.start || vKey == curve.start_ctrl || vKey == curve.end_ctrl || vKey == curve.end) {
                curves.push(cKey);
            }
        }
        return curves;
    }
    getHandleOfPoint(vKey) {
        for (let hkey in this.handles) {
            let handle = this.handles[hkey];

            if (vKey == handle.joint || vKey == handle.control1 || vKey == handle.control2) {
                return hkey;
            }
        }
    }
    getLastSelected() {
        return SplineMesh.selected[SplineMesh.selected.length - 1];
    }
    getLastHandle() {
        let index = Object.keys(this.handles).length - 1;
        let lastKey = Object.keys(this.handles)[index];
        return {data: this.handles[lastKey], key: lastKey};
    }
    getFirstHandle() {
        let firstKey = Object.keys(this.handles)[0];
        return {data: this.handles[firstKey], key: firstKey};
    }
    // Aza assumption: Bounding box
    getSize(axis, selection_only) {
        if (selection_only) {
            let selected_vertices = Project.spline_selection[this.uuid]?.vertices || Object.keys(this.vertices);
            if (!selected_vertices.length) return 0;
            let range = [Infinity, -Infinity];
            let { vec1 } = Reusable;
            let rotation_inverted = new THREE.Euler().copy(Transformer.rotation_selection).invert();
            selected_vertices.forEach(key => {
                vec1.fromArray(this.vertices[key]).applyEuler(rotation_inverted);
                range[0] = Math.min(range[0], vec1.getComponent(axis));
                range[1] = Math.max(range[1], vec1.getComponent(axis));
            })
            return range[1] - range[0];
        } else {
            let range = [Infinity, -Infinity];
            for (let vkey in this.vertices) {
                range[0] = Math.min(range[0], this.vertices[vkey][axis]);
                range[1] = Math.max(range[1], this.vertices[vkey][axis]);
            }
            return range[1] - range[0];
        }
    }
    /** 
     * Gather control point transform data, primarily to orient the handleGizmos correctly, but also for normal transform space.
     * @param {*} hKey Key of the handle we want the transform of.
     * @param {*} euler re-orientation Euler in case we need to re-orient the result of this to match another direction.
    */
    getHandleEuler(hKey, euler = new THREE.Euler(0, 0, Math.PI / 2)) {
        let ctrl1 = this.vertices[this.handles[hKey].control1].slice();
        let joint = this.vertices[this.handles[hKey].joint].slice();
        let ctrl2 = this.vertices[this.handles[hKey].control2].slice();
        let { quat1, quat2, quat3, euler1, euler2, euler3 } = Reusable;

        // First matrix, which will give us our general control orient, and basis to properly orient the handle
        let mat41 = new THREE.Matrix4().lookAt(joint.V3_toThree(), ctrl1.V3_toThree(), new THREE.Vector3(0, 1, 0));
        let mat42 = new THREE.Matrix4().lookAt(ctrl2.V3_toThree(), joint.V3_toThree(), new THREE.Vector3(0, 1, 0));
        let mat43 = new THREE.Matrix4().lookAt(ctrl2.V3_toThree(), ctrl1.V3_toThree(), new THREE.Vector3(0, 1, 0));

        // Matrix to fix the orientation of the previous one
        let reOrient = new THREE.Matrix4().makeRotationFromEuler(euler);
        mat41.multiply(reOrient);
        mat42.multiply(reOrient);
        mat43.multiply(reOrient);

        // Rotations
        let eulerC1 = euler1.setFromQuaternion(quat1.setFromRotationMatrix(mat41));
        let eulerC2 = euler2.setFromQuaternion(quat2.setFromRotationMatrix(mat42));
        let eulerJ = euler3.setFromQuaternion(quat3.setFromRotationMatrix(mat43));

        return {
            c1: eulerC1.toArray(),
            c2: eulerC2.toArray(),
            combined: eulerJ.toArray()
        };
    }
    // Determines Gizmo locations
    getWorldCenter(ignore_mesh_selection) {
        let m = this.mesh;
        let pos = new THREE.Vector3();
        let vertex_count = 0;
        let selected_handles = this.getSelectedHandles().slice();

        // this will ensure our cursor places at the joint point of selected handles.
        let control_to_joint = {};
        let selected_joints = selected_handles.map(hKey => {
            let handle = this.handles[hKey];
            
            control_to_joint[handle.control1] = handle.joint;
            control_to_joint[handle.control2] = handle.joint;

            return handle.joint;
        })

        for (let key in this.vertices) {
            let selection = Project.spline_selection[this.uuid];
            let selection_is_empty = !selection;
            let joint_is_selected = (selection && selected_joints.includes(key));
            let control_is_selected = (!selected_joints.includes(control_to_joint[key]) && selection && selection.vertices.includes(key));
            
            if (ignore_mesh_selection || selection_is_empty || joint_is_selected || control_is_selected) {
                let vector = this.vertices[key];
                pos.x += vector[0];
                pos.y += vector[1];
                pos.z += vector[2];
                vertex_count++;
            }
        }
        if (vertex_count) {
            pos.x /= vertex_count;
            pos.y /= vertex_count;
            pos.z /= vertex_count;
        }

        if (m) {
            let r = m.getWorldQuaternion(Reusable.quat1);
            pos.applyQuaternion(r);
            pos.add(THREE.fastWorldPosition(m, Reusable.vec2));
        }
        return pos;
    }
    // Taken as-is from Mesh
	moveVector(arr, axis, update = true) {
		if (typeof arr == 'number') {
			var n = arr;
			arr = [0, 0, 0];
			arr[axis||0] = n;
		} else if (arr instanceof THREE.Vector3) {
			arr = arr.toArray();
		}
		arr.forEach((val, i) => {
			this.origin[i] += val;
		})
		if (update) {
			this.preview_controller.updateTransform(this);
		}
		TickUpdates.selection = true;
	}
    // Taken as-is from Mesh
	getCenter(global) {
		let center = [0, 0, 0];
		let len = 0;
		for (let vkey in this.vertices) {
			center.V3_add(this.vertices[vkey]);
			len++;
		}
		center.V3_divide(len);
		if (global) {
			return this.mesh.localToWorld(Reusable.vec1.set(...center)).toArray();
		} else {
			return center;
		}
	}
    // Taken as-is from Mesh
    transferOrigin(origin, update = true) {
        if (!this.mesh) return;
        var q = new THREE.Quaternion().copy(this.mesh.quaternion);
        var shift = new THREE.Vector3(
            this.origin[0] - origin[0],
            this.origin[1] - origin[1],
            this.origin[2] - origin[2],
        )
        shift.applyQuaternion(q.invert());
        shift = shift.toArray();

        for (let vkey in this.vertices) {
            this.vertices[vkey].V3_add(shift);
        }
        this.origin.V3_set(origin);

        this.preview_controller.updateTransform(this);
        this.preview_controller.updateGeometry(this);
        return this;
    }
    /**
     * Applies the effects of Handle selection mode to the sibling vertex of this vKey. (Mirrored or Aligned)
     * @param {*} vkey The Key of the reference vertex, from which the result will be copied over to its sibling (if applicable).
     */
    applyHandleModeOnVertex(vkey) {
		// Gives us the inverse of a given vector about an origin
		function getInverseOfVec(vec, origin) {
			let local = [vec[0] - origin[0], vec[1] - origin[1], vec[2] - origin[2]];
			let final = [-local[0] + origin[0], -local[1] + origin[1], -local[2] + origin[2]];
			return new THREE.Vector3().fromArray(final);
		}

		// Give us the opposite point of the current vkey for this handle
		function getOppositeCtrl(handle) {
			if (handle.control1 === vkey) return handle.control2;
			else if (handle.control2 === vkey) return handle.control1;
		}

		for (let hkey in this.handles) {
			let handle = this.handles[hkey];
			let oppositeKey = getOppositeCtrl(handle);
			if (vkey == handle.joint || !this.vertices[oppositeKey]) continue; // if OppositeKey is undefined, something went wrong.

			// "mirrored" handle behavior, both controls mirror one another about the joint
			if (BarItems.spline_handle_mode.value === "mirrored") {
				if (!this.getSelectedVertices().includes(oppositeKey)) {
					let control = this.vertices[vkey];
					let joint = this.vertices[handle.joint];
					let inverse = getInverseOfVec(control, joint);
					this.vertices[oppositeKey] = inverse.toArray();
				}
			}
			// "aligned" handle behavior, the unselected control stays aligned with the active one, but doesn't mirror it
			else if (BarItems.spline_handle_mode.value === "aligned") {
				if (!this.getSelectedVertices().includes(oppositeKey)) {
					let V1 = Reusable.vec1.fromArray(this.vertices[handle.joint]);
					let V2 = Reusable.vec2.fromArray(this.vertices[vkey]).sub(V1);
					let V3 = Reusable.vec3.fromArray(this.vertices[oppositeKey]).sub(V1);

					// Build and apply quaternion to align V3 to V2
					let from = V3.clone().normalize();
					let to = V2.clone().normalize();
					let quat = new THREE.Quaternion().setFromUnitVectors(from, to);
					let aligned = V3.applyQuaternion(quat).add(V1);

					// Invert position to opposite orientation from selected handle
					let newVert = getInverseOfVec(aligned.toArray(), V1.toArray())
					this.vertices[oppositeKey] = newVert.toArray();
				}
			}
		}
    }
    // Taken as-is from Mesh
    resize(val, axis, negative, allow_negative, bidirectional) {
        let source_vertices = typeof val == 'number' ? this.oldVertices : this.vertices;
        let selected_vertices = Project.spline_selection[this.uuid]?.vertices || Object.keys(this.vertices);
        let range = [Infinity, -Infinity];
        let { vec1, vec2 } = Reusable;
        let rotation_inverted = new THREE.Euler().copy(Transformer.rotation_selection).invert();

        selected_vertices.forEach(key => {
            vec1.fromArray(source_vertices[key]).applyEuler(rotation_inverted);
            range[0] = Math.min(range[0], vec1.getComponent(axis));
            range[1] = Math.max(range[1], vec1.getComponent(axis));
        })

        let center = bidirectional ? (range[0] + range[1]) / 2 : (negative ? range[1] : range[0]);
        let size = Math.abs(range[1] - range[0]);
        if (typeof val !== 'number') {
            val = val(size) - size;
            if (bidirectional) val /= 2;
        }
        let scale = (size + val * (negative ? -1 : 1) * (bidirectional ? 2 : 1)) / size;
        if (isNaN(scale) || Math.abs(scale) == Infinity) scale = 1;
        if (scale < 0 && !allow_negative) scale = 0;

        selected_vertices.forEach(key => {
            vec1.fromArray(source_vertices[key]).applyEuler(rotation_inverted);
            vec2.fromArray(this.vertices[key]).applyEuler(rotation_inverted);
            vec2.setComponent(axis, (vec1.getComponent(axis) - center) * scale + center);
            vec2.applyEuler(Transformer.rotation_selection); 
            this.vertices[key].replace(vec2.toArray())
            this.applyHandleModeOnVertex(key);
        })
        this.preview_controller.updateGeometry(this);
    }
    // Partly Adapted from https://github.com/mrdoob/three.js/blob/master/src/geometries/TubeGeometry.js
    getTubeGeo(shadeSmooth) {
        let { vec1, vec2, vec3 } = Reusable;
        let pathData = this.getBézierPath();

        // Buffers
        let vertexData = [];

        // Dimensions
        let radialSegments = this.resolution[0];
        let radius = 1 * this.radius_multiplier;

        // Reusables for next loop
        let matrix = new THREE.Matrix4();

        // Gather all data for each vertex and face
        // vec1, vec2, vec3 > vertex, biNormal, normal
        for (let tubePoint = 0; tubePoint < pathData.points.length; tubePoint++) {
            let pathTangent = pathData.tangents[tubePoint];
            let pathNormal = pathData.normals[tubePoint];
            let pathPoint = pathData.points[tubePoint];
            let pathRadius = pathData.sizes[tubePoint];
            vec2.crossVectors(pathTangent, pathNormal).normalize();
            matrix.makeBasis(pathTangent, pathNormal, vec2);

            for (let ringPoint = 0; ringPoint <= radialSegments; ringPoint++) {

                // Generate base rings, at scene origin, all aligned on one axis, apply matrix to orient them, and 
                // offset by the position of the corresponding spline point. Then push this vertex to relevant arrays.
                let angle = ringPoint / radialSegments * Math.PI * 2;
                let cos = -Math.cos(angle);
                let sin = Math.sin(angle);

                // Create current vertex of ongoing tube ring
                let vertex = vec1;
                vertex.x = 0.0;
                vertex.y = cos * radius * pathRadius;
                vertex.z = sin * radius * pathRadius;
                vertex.applyMatrix4(matrix).add(pathPoint);

                // Normals
                let normal = vec3;
                normal.x = cos * pathNormal.x + sin * vec2.x,
                normal.y = cos * pathNormal.y + sin * vec2.y,
                normal.z = cos * pathNormal.z + sin * vec2.z 
                normal.normalize();

                vertexData.push({
                    normal: normal.toArray(),
                    vector: vertex.toArray(),
                    angles: [ angle, cos, sin ],
                    coordinates: [tubePoint, ringPoint]
                })
            }
        }

        // Final Buffers
        let vertices = [];
        let indices = [];
        let normals = [];
        let uvs = []; 

        // Re-use vertex data gathered above to finalize base geo
        for (let tubePoint = 1; tubePoint < pathData.points.length; tubePoint++) {
            let addNextTube = pathData.connections[tubePoint];
            for (let ringPoint = 1; ringPoint <= radialSegments; ringPoint++) {
                let a = (radialSegments + 1) * (tubePoint - 1) + (ringPoint - 1);
                let b = (radialSegments + 1) * tubePoint + (ringPoint - 1);
                let c = (radialSegments + 1) * tubePoint + ringPoint;
                let d = (radialSegments + 1) * (tubePoint - 1) + ringPoint;

                if (!shadeSmooth) { // Flat shading: duplicate vertices for each face
                    let faceNormal = new THREE.Vector3().crossVectors(
                        new THREE.Vector3().fromArray(vertexData[b].vector).sub(new THREE.Vector3().fromArray(vertexData[a].vector)),
                        new THREE.Vector3().fromArray(vertexData[c].vector).sub(new THREE.Vector3().fromArray(vertexData[a].vector))
                    ).normalize();

                    // Duplicate face indices
                    if (addNextTube) {
                        let startIndex = vertices.length / 3;
                        indices.push(startIndex, startIndex + 1, startIndex + 2);
                        indices.push(startIndex + 3, startIndex + 4, startIndex + 5);
                    }

                    [a, b, c, a, c, d].forEach((index) => {
                        vertices.push(...vertexData[index].vector);
                        normals.push(...faceNormal.toArray());

                        // UVs for duplicated indices (with comments for Aza's memory)
                        // U: division tells us which ring we're at, divide by total of points to get value between 0 and 1 on U
                        // V: Remainder of division tells us which step of the ring we're at, divide by radial segments to get value between 0 and 1 on V
                        // (U, V): Both combined give us a nice little point between (0, 0) and (1, 1) we can now push to this buffer
                        let u = Math.floor(index / (radialSegments + 1)) / (pathData.points.length - 1);
                        let v = (index % (radialSegments + 1)) / radialSegments;
                        uvs.push(u, v);
                    });
                } else { // Smooth shading: reuse vertices
                    if (addNextTube) {
                        indices.push(a, b, c);
                        indices.push(a, c, d);
                    }
                }
            }
        }

        for (let tubePoint = 0; tubePoint < pathData.points.length; tubePoint++) {
            for (let ringPoint = 0; ringPoint <= radialSegments; ringPoint++) {
                if (shadeSmooth)  {
					let u = tubePoint / (pathData.points.length - 1);
					let v = ringPoint / radialSegments;
                    uvs.push(u, v);
                }
            }
        }
        
        // Smooth shading: populate vertices, normals, and uvs
        if (shadeSmooth) {
            vertexData.forEach((vertex) => {
                vertices.push(...vertex.vector);
                normals.push(...vertex.normal);
            });
        }

        return {
            vertices: vertices,
            normals: normals,
            indices: indices,
            uvs: uvs,
        };
    }
    getBézierPath() {
        let { vec1 } = Reusable;
        let tubularSegments = this.resolution[1];
        let curveTangents = [];
        let curveNormals = [];
        let tubePoints = [];
        let tubePointSizes = [];
        let connectPoints = [];
        let shouldConnect = true;

        // Gather Tangents for the entire tube, and extrapolate normals from them
        let prevCurve;
        let prevCurveTangent;
        let prevCurveNormal;
        let prevEnd;
        for (let cKey in this.curves) {
            // let handle1 = this.getHandleOfPoint(this.curves[cKey].start);
            // let handle2 = this.getHandleOfPoint(this.curves[cKey].end);
            let handle1 = this.handles[this.curves[cKey].start_handle];
            let handle2 = this.handles[this.curves[cKey].end_handle];
            let tilt1 = handle1.tilt;
            let tilt2 = handle2.tilt;
            let size1 = handle1.size;
            let size2 = handle2.size;

            // If the previous end joint, and this curve's start don't match, we can assume there's a hole in our spline.
            if (prevEnd) shouldConnect = prevEnd.joint == handle1.joint;

            for (let tubePoint = 0; tubePoint <= tubularSegments; tubePoint++) {
                let time = tubePoint / tubularSegments;
                let tilt = Math.lerp(tilt1, tilt2, time);
                let size = Math.lerp(size1, size2, time);
                let curveData = this.getBézierForCurve(time, cKey);
                let curveChange = prevCurve && prevCurve != cKey;
                let tangent = curveData.tangent;
                let normal = this.getBézierNormal(tangent, prevCurveNormal);

                // Check if we just changed curve segment, if so, we need to interpolate the 
                // previous and current tangents so that the tube mesh doesn't break. Then Pop & 
                // replace last tangent & normals if our curve has changed, & avoid duplicate points.
                if (curveChange && shouldConnect) {
                    let avgTangent = (new THREE.Vector3().addVectors(tangent, prevCurveTangent)).multiplyScalar(0.5).normalize();
                    let avgNormal = (new THREE.Vector3().addVectors(normal, prevCurveNormal)).multiplyScalar(0.5).normalize();
                    tangent = avgTangent;
                    normal = avgNormal;

                    // remove the values we just changed
                    curveTangents.pop();
                    curveNormals.pop();

                    // replace the values we just removed
                    curveTangents.push(tangent);
                    curveNormals.push(new THREE.Vector3().copy(normal).applyAxisAngle(tangent, Math.degToRad(tilt)));
                    
                    // re-assign temps
                    prevCurveTangent = tangent;
                    prevCurveNormal = normal;
                    prevCurve = cKey;
                    
                    // continue early
                    continue;
                }
    
                // Store everything
                curveTangents.push(tangent);
                curveNormals.push(new THREE.Vector3().copy(normal).applyAxisAngle(tangent, Math.degToRad(tilt)));
                tubePoints.push(curveData.point);
                tubePointSizes.push(size);
                connectPoints.push(tubePoint == 0 ? shouldConnect : true);

                // re-assign temps
                prevCurveTangent = tangent;
                prevCurveNormal = normal;
                prevCurve = cKey;
            }
            prevEnd = handle2;
        }

        // Close Cyclic paths
        if (this.cyclic && shouldConnect) {
            let firsthandle = this.getFirstHandle().data;
            let lasthandle = this.getLastHandle().data;

            let tilt1 = firsthandle.tilt;
            let tilt2 = lasthandle.tilt;
            let size1 = firsthandle.size;
            let size2 = lasthandle.size;
            let firstnormal = curveNormals[0];
            let lastnormal = curveNormals[curveNormals.length - 1];

            // avoid hard cuts in spline continuity when cyclic, not quite perfect but works well enough
            function interpolateNormals(delta) {
                vec1.set(0, 0, 0);
                return vec1.lerpVectors(lastnormal, firstnormal, delta).normalize();
            }

            for (let tubePoint = 0; tubePoint <= tubularSegments; tubePoint++) {
                let time = tubePoint / tubularSegments;
                let tilt = Math.lerp(tilt2, tilt1, time);
                let size = Math.lerp(size2, size1, time);
                let curveData = this.getBézierForPoints(time, lasthandle.joint, lasthandle.control2, firsthandle.control1, firsthandle.joint);
                let tangent = curveData.tangent;
                let normal = this.getBézierNormal(tangent, interpolateNormals(time));

                if (tubePoint == 0) { // original tip of the curve, interpolate between its normals and the added curve's normals
                    let avgTangent = (new THREE.Vector3().addVectors(tangent, prevCurveTangent)).multiplyScalar(0.5).normalize();
                    let avgNormal = (new THREE.Vector3().addVectors(normal, prevCurveNormal)).multiplyScalar(0.5).normalize();
                    tangent = avgTangent;
                    normal = avgNormal;

                    // remove the values we just changed
                    curveTangents.pop();
                    curveNormals.pop();

                    // replace the values we just removed
                    curveTangents.push(tangent);
                    curveNormals.push(new THREE.Vector3().copy(normal).applyAxisAngle(tangent, Math.degToRad(tilt)));
                } 
                else if (tubePoint == tubularSegments) { // The start and end of our tube meet, interpolate normals
                    let avgTangent = (new THREE.Vector3().addVectors(curveTangents[0], tangent)).multiplyScalar(0.5).normalize();
                    let avgNormal = (new THREE.Vector3().addVectors(firstnormal, normal)).multiplyScalar(0.5).normalize();

                    // remove the values we just changed
                    curveTangents.shift();
                    curveNormals.shift();

                    // replace the values we just removed
                    curveTangents.unshift(avgTangent);
                    curveNormals.unshift(avgNormal);

                    // perform normal addition
                    curveTangents.push(avgTangent);
                    curveNormals.push(avgNormal);
                    tubePoints.push(curveData.point);
                    tubePointSizes.push(size);
                    connectPoints.push(true);
                } 
                else {
                    curveTangents.push(tangent);
                    curveNormals.push(normal);
                    tubePoints.push(curveData.point);
                    tubePointSizes.push(size);
                    connectPoints.push(true);
                }
            }
        }

        return {
            tangents: curveTangents,
            normals: curveNormals,
            points: tubePoints,
            sizes: tubePointSizes,
            connections: connectPoints
        }
    }
    getBézierNormal(tangent, up = null) {
        let upVec = new THREE.Vector3(0, 1, 0); // Arbitrary UP vector not parallel to the tangent

        // re-orient up based on curve progress
        if (up) upVec = up;
        else if (tangent.y === 1) upVec = new THREE.Vector3(1, 0, 0);

        let binormal = new THREE.Vector3().crossVectors(tangent, upVec).normalize();
        let normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

        return normal
    }
    getBézierForCurve(time, key) {
        let points = this.curves[key];
        return this.getBézierForPoints(time, points.start, points.start_ctrl, points.end_ctrl, points.end);
    }
    getBézierForPoints(time, p1k, p2k, p3k, p4k) {
        let p1 = this.vertices[p1k].slice();
        let p2 = this.vertices[p2k].slice();
        let p3 = this.vertices[p3k].slice();
        let p4 = this.vertices[p4k].slice();
        return this.cubicBézier(time, p1, p2, p3, p4);
    }
    // Math: https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Cubic_B%C3%A9zier_curves
    // https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Higher-order_curves
    // Explanation, Thanks Freya :> https://youtu.be/jvPPXbo87ds?si=XBdiXoriL3MgeGsu
    cubicBézier(time, point1, point2, point3, point4) {
        let timeP2 = time ** 2;
        let timeP3 = time ** 3;
        let p = [1, time, timeP2, timeP3]; // Power matrix (Position)
        let d = [0, 1, 2*time, 3*timeP2]; // Derivative Power matrix (Tangent)

        // Characteristic "matrix" for the original Bézier curve ("pc" variable is backwards to respect operation order)
        let pc1 = [ 1, 0,  0, 0];
        let pc2 = [-3, 3,  0, 0];
        let pc3 = [ 3, -6, 3, 0];
        let pc4 = [-1, 3, -3, 1];
        let pc = [pc4, pc3, pc2, pc1];

        // Bernstein polynomial function
        function bernstein(powers, char) {
            let result = new THREE.Vector3();
            let points = [ point1, point2, point3, point4 ];
            for (let i = 0; i < 4; i++) {
                let point = new THREE.Vector3(points[i][0], points[i][1], points[i][2]);
                let term = point.multiplyScalar(powers[3]*char[i][0] + powers[2]*char[i][1] + powers[1]*char[i][2] + powers[0]*char[i][3]);
                result.add(term);
            }
            return result
        }

        // Gather results
        let pointPos = bernstein(p, pc);
        let tangentVec = bernstein(d, pc).normalize();

        return {
            point: pointPos, 
            tangent: tangentVec,
        };
    }
    /**
     * Splits a curve in two distinct paths using De Casteljau's algorithm.
     * The split happens at the corresponding T (time) on the initial curve.
     * 
     * @param {float} time Point at which the split occurs (in % from 0 to 1)
     * @param {array} point1 Start Point of the initial curve [x, y, z]
     * @param {array} point2 Start Control Point of the initial curve [x, y, z]
     * @param {array} point3 End Control Point of the initial curve [x, y, z]
     * @param {array} point4 End Point of the initial curve [x, y, z]
     * @returns {object} Adjusted and new points for our two new curves:
     * - adjusted curve start
     * - adjusted curve start control
     * - new handle middle control 1
     * - new handle middle
     * - new handle middle control 2
     * - adjusted curve end control
     * - adjusted curve end
     */
    // source: https://stackoverflow.com/questions/8369488/splitting-a-bezier-curve
    divideBézierCurve(time, point1, point2, point3, point4) {
        let vert1 = this.vertices[point1].slice();
        let vert2 = this.vertices[point2].slice();
        let vert3 = this.vertices[point3].slice();
        let vert4 = this.vertices[point4].slice();
        let [ x1, y1, z1 ] = vert1;
        let [ x2, y2, z2 ] = vert2;
        let [ x3, y3, z3 ] = vert3;
        let [ x4, y4, z4 ] = vert4;
    
        let x12 = ((x2 - x1) * time) + x1;
        let y12 = ((y2 - y1) * time) + y1;
        let z12 = ((z2 - z1) * time) + z1;
    
        let x23 = ((x3 - x2) * time) + x2;
        let y23 = ((y3 - y2) * time) + y2;
        let z23 = ((z3 - z2) * time) + z2;
    
        let x34 = ((x4 - x3) * time) + x3;
        let y34 = ((y4 - y3) * time) + y3;
        let z34 = ((z4 - z3) * time) + z3;
    
        let x123 = ((x23 - x12) * time) + x12;
        let y123 = ((y23 - y12) * time) + y12;
        let z123 = ((z23 - z12) * time) + z12;
    
        let x234 = ((x34 - x23) * time) + x23;
        let y234 = ((y34 - y23) * time) + y23;
        let z234 = ((z34 - z23) * time) + z23;
    
        let x1234 = ((x234 - x123) * time) + x123;
        let y1234 = ((y234 - y123) * time) + y123;
        let z1234 = ((z234 - z123) * time) + z123;

        return {
            start:          [x1,    y1,    z1   ],
            start_ctrl:     [x12,   y12,   z12  ],
            middle_ctrl1:   [x123,  y123,  z123 ],
            middle:         [x1234, y1234, z1234],
            middle_ctrl2:   [x234,  y234,  z234 ],
            end_ctrl:       [x34,   y34,   z34  ],
            end:            [x4,    y4,    z4   ]
        }

    }
	getTexture() {
		if (typeof this.texture === 'string') {
			return Texture.all.findInArray('uuid', this.texture)
		}
		return this.texture;
	}
	applyTexture(texture) {
		var value = false;
		if (texture) {
			value = texture.uuid;
		}
		
        this.texture = value;
		if (Project.selected_elements.indexOf(this) === 0) {
			UVEditor.loadData(); // useless here since this currently has no editable UV, TODO
		}

		this.preview_controller.updateFaces(this);
		// this.preview_controller.updateUV(this);
	}
	static behavior = {
		unique_name: false,
		movable: true,
		resizable: true,
		rotatable: true,
	}
    updateShading(shade_smooth) {
        this.smooth_shading = shade_smooth;
        this.preview_controller.updateGeometry(this);
    }
}
SplineMesh.prototype.title = tl('data.spline_mesh');
SplineMesh.prototype.type = 'spline';
SplineMesh.prototype.icon = 'fas.fa-bezier-curve';
SplineMesh.prototype.menu = new Menu([
    new MenuSeparator('spline_mesh_edit'),
    "apply_spline_rotation",
    "extrude_spline_selection",
    "split_spline",
    "divide_spline_curve",
    new MenuSeparator('spline_mesh_combination'),
    ...Outliner.control_menu_group,
    new MenuSeparator('settings'),
    'convert_to_mesh',
    {
        name: 'menu.cube.color', icon: 'color_lens', children() {
            return markerColors.map((color, i) => {
                return {
                    icon: 'bubble_chart',
                    color: color.standard,
                    name: color.name || 'cube.color.' + color.id,
                    click(cube) {
                        cube.forSelected(function (obj) {
                            obj.setColor(i)
                        }, 'change color')
                    }
                }
            })
        }
    },
    "randomize_marker_colors",
            {name: 'menu.cube.texture', icon: 'collections', condition: () => !Format.single_texture, children() {
                var arr = [{
                    icon: 'crop_square', 
                    name: Format.single_texture_default ? 'menu.cube.texture.default' : 'menu.cube.texture.blank', 
                    click(spline) { spline.forSelected((obj) => obj.applyTexture(false), 'texture blank') }
                }]
                let applied_texture;
                main_loop: for (let spline of SplineMesh.selected) {
                    let texture = spline.texture;
                    if (texture) {
                        if (!applied_texture) {
                            applied_texture = texture;
                        } else if (applied_texture != texture) {
                            applied_texture = null;
                            break main_loop;
                        }
                    }
                }
                // Asa assumption: Compose final menu
                Texture.all.forEach((t) => {
                    arr.push({
                        name: t.name,
                        icon: (t.mode === 'link' ? t.img : t.source),
                        marked: t == applied_texture,
                        click(spline) { spline.forSelected((obj) => obj.applyTexture(t), 'apply texture') }
                    })
                })
                return arr;
            }},
    new MenuSeparator('manage'),
    'rename',
    'toggle_visibility',
    'delete'
]);
SplineMesh.prototype.buttons = [
    Outliner.buttons.cyclic,
    Outliner.buttons.export,
    Outliner.buttons.locked,
    Outliner.buttons.visibility,
];

new Property(SplineMesh, 'string', 'name', { default: 'spline' });
new Property(SplineMesh, 'number', 'color', { default: Math.floor(Math.random() * markerColors.length) });
new Property(SplineMesh, 'vector', 'origin');
new Property(SplineMesh, 'vector', 'rotation');
new Property(SplineMesh, 'vector', 'resolution', { default: [6, 12] }); // The U (radial) and V (tubular) resolution of the spline.
new Property(SplineMesh, 'number', 'radius_multiplier', { default: 1 }); // Number to multiply each ring's radius by.
new Property(SplineMesh, 'boolean', 'smooth_shading', {
    default: false,
    inputs: {
        element_panel: {
            input: {label: 'Smooth Shading', type: 'checkbox'},
            onChange() {
                Canvas.updateView({elements: SplineMesh.selected, element_aspects: {geometry: true}});
            }
        }
    }
});
// decide if you want this spline to render the "Mesh" part of its name or not.
new Property(SplineMesh, 'boolean', 'render_mesh', {
	default: true,
	inputs: {
		element_panel: {
			input: {label: 'Render Mesh', type: 'checkbox'},
			onChange() {
				Canvas.updateView({elements: SplineMesh.selected, element_aspects: {geometry: true}});
			}
		}
	}
});
// mainly for debug, may be used for other purposes tho.
new Property(SplineMesh, 'boolean', 'display_space', {
    default: false,
    inputs: {
        element_panel: {
            input: {label: 'Display Space', type: 'checkbox'},
            onChange() {
                Canvas.updateView({elements: SplineMesh.selected, element_aspects: {geometry: true}});
            }
        }
    }
});

new Property(SplineMesh, 'boolean', 'export', { default: true });
new Property(SplineMesh, 'boolean', 'visibility', { default: true });
new Property(SplineMesh, 'boolean', 'locked');
new Property(SplineMesh, 'boolean', 'cyclic'); // If the spline should be closed or not.
new Property(SplineMesh, 'enum', 'render_order', { default: 'default', values: ['default', 'behind', 'in_front'] });

OutlinerElement.registerType(SplineMesh, 'spline');

new NodePreviewController(SplineMesh, {
    setup(element) {
        var mesh = new THREE.Mesh(new THREE.BufferGeometry(1, 1, 1), Canvas.emptyMaterials[0]);
        Project.nodes_3d[element.uuid] = mesh;
        mesh.name = element.uuid;
        mesh.type = element.type;
        mesh.isElement = true;

        mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(24), 1));

        let outline_material = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 4 })
        let dashed_outline_material = new THREE.LineDashedMaterial({ vertexColors: true, linewidth: 2, dashSize: 0.75, gapSize: 0.5 })

        // Mesh outline
        let outline = new THREE.LineSegments(new THREE.BufferGeometry(), outline_material);
        outline.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(240).fill(1), 3));
        outline.no_export = true;
        outline.name = element.uuid + '_outline';
        outline.renderOrder = 2;
        outline.visible = element.visibility;
        outline.frustumCulled = false;
        mesh.outline = outline;
        mesh.add(outline);

        // Spline Path line
        let pathLine = new THREE.LineSegments(new THREE.BufferGeometry(), [outline_material, dashed_outline_material]);
        pathLine.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(240).fill(1), 3));
        pathLine.no_export = true;
        pathLine.name = element.uuid + '_path_line';
        pathLine.renderOrder = 2;
        pathLine.frustumCulled = false;
        mesh.pathLine = pathLine;
        mesh.add(pathLine);

        let points = new THREE.Points(new THREE.BufferGeometry(), Canvas.meshVertexMaterial);
        points.element_uuid = element.uuid;
        points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(24).fill(1), 3));
        mesh.vertex_points = points;
        outline.add(points);

        // Update
        this.updateTransform(element);
        this.updateGeometry(element);
        this.updateFaces(element);
        this.updateRenderOrder(element);
        mesh.visible = element.visibility;

        this.dispatchEvent('setup', { element });
    },
    getHandleColor() {
        let color = gizmo_colors.spline_handle_aligned;

        if (BarItems.spline_handle_mode.value === "free")
            color = gizmo_colors.spline_handle_free;
        else if (BarItems.spline_handle_mode.value === "mirrored")
            color = gizmo_colors.spline_handle_mirrored;

        let colorArray = [ color.r, color.g, color.b ];
        return [ colorArray, color ];
    },
    debugDraw(element, linePoints, lineColors, renderParams = [true, true, true]) {
        let debugTangentColor = [gizmo_colors.v.r, gizmo_colors.v.g, gizmo_colors.v.b];
        let debugNormalColor = [gizmo_colors.w.r, gizmo_colors.w.g, gizmo_colors.w.b];
        let debugBiNormalColor = [gizmo_colors.u.r, gizmo_colors.u.g, gizmo_colors.u.b];
        let debugTangentPoints = [];
        let debugTangentColors = [];
        let debugNormalPoints = [];
        let debugNormalColors = [];
        let debugBiNormalPoints = [];
        let debugBiNormalColors = [];
        let pathData = element.getBézierPath();

        for (let ptIndex = 0; ptIndex < pathData.points.length; ptIndex++) {
            let tangent = pathData.tangents[ptIndex];
            let normal = pathData.normals[ptIndex];
            let biNormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
            let point = pathData.points[ptIndex];
            
            let localTangent = new THREE.Vector3().addVectors(point, tangent);
            let localNormal = new THREE.Vector3().addVectors(point, normal);
            let localBiNormal = new THREE.Vector3().addVectors(point, biNormal);

            // Compile Tangents
            debugTangentPoints.push(point, localTangent);
            debugTangentColors.push(debugTangentColor, debugTangentColor);
            
            // Compile Normals
            debugNormalPoints.push(point, localNormal);
            debugNormalColors.push(debugNormalColor, debugNormalColor);
            
            // Compile Bi-Normals
            debugBiNormalPoints.push(point, localBiNormal);
            debugBiNormalColors.push(debugBiNormalColor, debugBiNormalColor);
        }

        // Add all points to line arrays for render
        if (renderParams[0]) {
            debugTangentPoints.forEach((vector, i) => linePoints.push(...vector.toArray()))
            debugTangentColors.forEach((array, i) => lineColors.push(...array))
        }
        if (renderParams[1]) {
            debugNormalPoints.forEach((vector, i) => linePoints.push(...vector.toArray()))
            debugNormalColors.forEach((array, i) => lineColors.push(...array))
        }
        if (renderParams[2]) {
            debugBiNormalPoints.forEach((vector, i) => linePoints.push(...vector.toArray()))
            debugBiNormalColors.forEach((array, i) => lineColors.push(...array))
        }
    },
    updateGeometry(element) {
        let { mesh } = element;
        let arr_pathline = [];
        let arr_pathline_color = [];
        let arr_pathline_data = [];
        let pathline_color = new THREE.Color().set(markerColors[element.color].standard); // Color path with marker color
        let outline_color = [gizmo_colors.outline.r, gizmo_colors.outline.g, gizmo_colors.outline.b];

        // Add curve line points
        let pathData = element.getBézierPath();
        for (let ptIndex = 0; ptIndex < pathData.points.length; ptIndex++) {
            arr_pathline_data.push({point: pathData.points[ptIndex], addNext: pathData.connections[ptIndex]});
        }

        // Add all points to line geometry
        arr_pathline_data.forEach((data, i) => {
            let shouldDouble = i > 0 && i < (arr_pathline_data.length - 1); // Band-aid because I don't calculate indices for outlines.

            if (data.addNext) {
                arr_pathline.push(...data.point.toArray(), ...((shouldDouble) ? data.point.toArray() : []));
                arr_pathline_color.push(...pathline_color.toArray(), ...((shouldDouble) ? pathline_color.toArray() : []));
            }
            else { // render cuts in the spline path
                if (shouldDouble) {
                    arr_pathline.pop(); arr_pathline.pop(); arr_pathline.pop();
                    arr_pathline_color.pop(); arr_pathline_color.pop(); arr_pathline_color.pop();
                }
                
                arr_pathline.push(...data.point.toArray());
                arr_pathline_color.push(...pathline_color.toArray());
            }
        })

        // "Space" lines
        this.debugDraw(element, arr_pathline, arr_pathline_color, [element.display_space, element.display_space, element.display_space]);

        // Tube geometry
        let arr_vertices = [];
        let arr_normals = [];
        let arr_uvs = [];
        let arr_indices = [];
        let arr_outline = [];
        let arr_outline_color = [];
        if (element.render_mesh) {
            let tube = element.getTubeGeo(element.smooth_shading);
            arr_vertices = tube.vertices;
            arr_normals = tube.normals;
            arr_uvs = tube.uvs;
            arr_indices = tube.indices;
            
            // Add outlines for tube geo edges
            for (let i = 0; i < tube.indices.length / 6; i++) {
                let v_arr = [];
                [0, 1, 4, 1].forEach(add => v_arr.push(tube.indices[(i * 6) + add]))

                // close off initial ring, this the outline method Mesh uses only fills 
                // in a few of the edges for quads, and this tube can only have quads.
                if (i < element.resolution[0]) {
                    [5, 0, 1, 2].forEach(add => v_arr.push(tube.indices[(i * 6) + add]))
                }
    
                // Roughly done like mesh.js's indexing for outllines, adapted for this use-case
                v_arr.forEach((index, i) => {
                    [0, 1, 2].forEach(add => arr_outline.push(tube.vertices[(index * 3) + add]));
                    arr_outline_color.push(...outline_color);
                })
            }
        }
        
        // Outlines
		mesh.outline.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr_outline), 3));
		mesh.outline.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(arr_outline_color), 3));
        
        // Path Lines
        mesh.pathLine.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr_pathline), 3));
        mesh.pathLine.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(arr_pathline_color), 3));

        mesh.pathLine.geometry.clearGroups();
        let start1 = 0;
        let count1 = (element.resolution[1] * 2) * Object.keys(element.curves).length;
        let start2 = count1;
        let count2 = (element.resolution[1] * 2);
        let start3 = start2 + count2;
        let count3 = Math.abs(arr_pathline.length - start2 + count2);

        mesh.pathLine.geometry.addGroup(start1, count1, 0);
        mesh.pathLine.geometry.addGroup(start2, count2, 1);
        mesh.pathLine.geometry.addGroup(start3, count3, 0);

		mesh.pathLine.geometry.computeBoundingSphere();
        mesh.pathLine.computeLineDistances();

        // Populate Tube geometry
        mesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr_vertices), 3));
        mesh.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(arr_normals), 3));
        mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(arr_uvs), 2));
        mesh.geometry.attributes.uv.needsUpdate = true;
        mesh.geometry.setIndex(arr_indices);

        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();

        mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(arr_vertices.length / 3).fill(mesh.geometry.attributes.highlight.array[0]), 1));

        // Send updates
        SplineMesh.preview_controller.updateHighlight(element);

        if (Project.view_mode == 'wireframe' && this.fixWireframe) {
            this.fixWireframe(element);
        }

        this.dispatchEvent('update_geometry', { element });
    },
    // partly code smell from mesh.js
    updateFaces(element) {
        let { mesh } = element;

        if (Project.view_mode === 'solid') 
            mesh.material = Canvas.monochromaticSolidMaterial
        else if (Project.view_mode === 'colored_solid') 
            mesh.material = Canvas.coloredSolidMaterials[element.color]
        else if (Project.view_mode === 'wireframe') 
            mesh.material = Canvas.wireframeMaterial
        else if (Project.view_mode === 'normal') 
            mesh.material = Canvas.normalHelperMaterial
        else if (Project.view_mode === 'uv') 
            mesh.material = Canvas.uvHelperMaterial
        else if (Format.single_texture && Texture.all.length >= 2 && Texture.all.find(t => t.render_mode == 'layered'))
            mesh.material = Canvas.getLayeredMaterial();
        else if (Format.single_texture) {
            let tex = Texture.getDefault();
            mesh.material = tex ? tex.getMaterial() : Canvas.emptyMaterials[element.color];
        }
        else {
			var material;
            var tex = element.getTexture();
            if (tex && tex.uuid) {
                material = tex.getMaterial();
            } else {
                material = Canvas.emptyMaterials[element.color];
            }

			mesh.geometry.groups.empty();

			mesh.material = material;
			if (!mesh.material) mesh.material = Canvas.transparentMaterial;
		}

        this.dispatchEvent('update_faces', { element });
    },
    // Aza assumption: tell preview to display white overlay when hovered
    updateHighlight(element, hover_cube, force_off) {
        var mesh = element.mesh;
        let highlighted = (
            Settings.get('highlight_cubes') &&
            ((hover_cube == element && !Transformer.dragging) || element.selected) &&
            Modes.edit &&
            !force_off
        ) ? 1 : 0;

        let array = new Array(mesh.geometry.attributes.highlight.count).fill(highlighted);

        mesh.geometry.attributes.highlight.array.set(array);
        mesh.geometry.attributes.highlight.needsUpdate = true;

        this.dispatchEvent('update_highlight', { element });
    },
	fixWireframe(element) {
		let geometry_orig = element.mesh.geometry;
		if (!geometry_orig) return;
		let geometry_clone = element.mesh.geometry.clone();
		element.mesh.geometry = geometry_clone;
		geometry_orig.dispose();
	},
})

Blockbench.dispatchEvent('change_view_mode', ({view_mode}) => {
    if (view_mode == 'wireframe') {
        for (let mesh of SplineMesh.selected) {
            SplineMesh.preview_controller.fixWireframe(mesh);
        }
    }
});

Object.assign(window, {
	SplineCurve,
	SplineHandle,
	SplineMesh
});