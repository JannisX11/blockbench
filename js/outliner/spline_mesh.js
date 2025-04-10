class SplineHandle {
    constructor(spline, data) {
        for (var key in this.constructor.properties) {
            this.constructor.properties[key].reset(this);
        }
        this.spline = spline;
        this.joint = '';
        this.control1 = '';
        this.control2 = '';
        this.tilt = 0.0;
        this.size = 1.0;
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
        return !!Project.spline_selection[this.mesh.uuid] && Project.spline_selection[this.mesh.uuid].vertices.includes(this.joint);
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
        delete copy.spline;
        return copy;
    }
}
new Property(SplineHandle, 'number', 'tilt');
new Property(SplineHandle, 'number', 'size');

//TODO (in order of roadmap)

// [~] Implement primitive tube drawing, using resolution U as the number of points per slice.
//     -> in Progress, will need a lot more refinement
// /!\ This will require more R&D, THREE.js implements a kind of solution for this, but with very little control over how it renders.
//   - Needs to respect tilt & size.
//   - Would ideally generate a special version of.
//     UV islands that would correspond to slices.
//     of the resulting tube (one per U edge).

// /!\ Priority 2

// [ ] Add ability to extrude points from the curve.
// [ ] Add ability to delete points from the curve. /!\ Priority 2
// [ ] Add ability to remove segments from the curve. /!\ Priority 2
// [ ] Add ability to dissolve points from the curve. /!\ Priority 2
// [ ] Add ability to scale & tilt handles.

//DONE:
// [x] Make it so moving one control mirrors on the other, unless a key modifier is held (alt, ctrl...). 
//     -> key modifier replaced by on-ui option.
// [x] Implement proper graphics for spline handles, so that the connection between controls and origin are clear.
// [x] Add cyclic functionality, closes the spline from the first to last handle with an additional segment. 
//     -> Basic functionality for this added, but might need updating later on


class SplineMesh extends OutlinerElement {
    constructor(data, uuid) {
        super(data, uuid)

        this._static = {
            properties: {
                handles: {}, // Main component of the spline
                vertices: {}, // Control points of the handles
                curves: {}, // Segments of the spline
                curve_vertices: {}, // TODO, should store the tube's vertices
                faces: {} // TODO, should store the tube's faces
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
            this.addCurves(
                [handle_keys[0], handle_keys[1]], //  )
                [handle_keys[1], handle_keys[2]], // (
                [handle_keys[2], handle_keys[3]], //  )
                [handle_keys[3], handle_keys[4]]  // (
            );
            let curve_keys = Object.keys(this.curves);

            // Vertices to be used in the curve's tube mesh
            // this.addCurveVertices(curve_keys);
        }
        for (var key in SplineMesh.properties) {
            SplineMesh.properties[key].reset(this);
        }
        if (data && typeof data === 'object') {
            this.extend(data)
        }
        // console.log(this.curve_vertices);
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
            this.handles[key] = handle
            return key;
        })
    }
    addCurves(...handle_arrays) {
        return handle_arrays.map(array => {
            let key;
            while (!key || this.curves[key]) {
                key = bbuid(4);
            }

            // Curves are defined by their handles
            // point & control 2 of handle 1 at the start
            // point & control 1 of handle 2 at the end
            let handle1 = this.handles[array[0]];
            let handle2 = this.handles[array[1]];
            this.curves[key] = {
                start: handle1.joint,
                start_ctrl: handle1.control2,
                end_ctrl: handle2.control1,
                end: handle2.joint
            };
            return key;
        })
    }
    extend(object) {
        for (var key in SplineMesh.properties) {
            SplineMesh.properties[key].merge(this, object)
        }
        // Identical to mesh
        if (typeof object.vertices == 'object') {
            for (let key in this.vertices) {
                if (!object.vertices[key]) {
                    delete this.vertices[key];
                }
            }
            if (object.vertices instanceof Array) {
                this.addVertices(...object.vertices);
            } else {
                for (let key in object.vertices) {
                    if (!this.vertices[key]) this.vertices[key] = [];
                    this.vertices[key].replace(object.vertices[key]);
                }
            }
        }
        // Essentially the same as a mesh face, but holds different data
        if (typeof object.handles == 'object') {
            for (let key in this.handles) {
                if (!object.handles[key]) {
                    delete this.handles[key];
                }
            }
            for (let key in object.handles) {
                if (this.handles[key]) {
                    this.handles[key].extend(object.handles[key])
                } else {
                    this.handles[key] = new SplineHandle(this, object.handles[key]);
                }
            }
        }
        // Similar to mesh vertices
        if (typeof object.curves == 'object') {
            for (let key in this.curves) {
                if (!object.curves[key]) {
                    delete this.curves[key];
                }
            }
            for (let key in object.curves) {
                if (!this.curves[key]) this.curves[key] = object.curves[key];
            }
        }
        this.sanitizeName();
        return this;
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
            copy.curves[key] = this.curves[key];
        }

        copy.type = 'spline';
        copy.uuid = this.uuid
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
            copy.curves[key] = this.curves[key];
        }

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
        if (make && !Project.spline_selection[this.uuid]) Project.spline_selection[this.uuid] = { vertices: [], handles: [] };
        let selection = Project.spline_selection[this.uuid]?.vertices || []; // normal selection result, we will slightly alter this below

        // Force select control points when an handle joint is selected
        if (selection.length > 0) {
            for (let key in this.handles) {
                let handle = this.handles[key];
                // Do we have the joint selected?
                if (selection.includes(handle.joint)) {
                    // are the controls unselected? check for each, so we can select them
                    if (!selection.includes(handle.control1)) selection.push(handle.control1)
                    if (!selection.includes(handle.control2)) selection.push(handle.control2)
                }
            }
        }

        return selection;
    }
    // Might never be used, but still here just in case
    getSelectedHandles() {
        let selection = this.getSelectedVertices();

        let selected_handles = [];
        if (selection.length > 0) {
            for (let hkey in this.handles) {
                let handle = this.handles[hkey];
                if (selection.includes(handle.joint)) selected_handles.push(hkey);
            }
        }

        return selected_handles;
    }
    getLastHandle() {
        let index = Object.keys(this.handles).length - 1;
        let lastKey = Object.keys(this.handles)[index];
        return this.handles[lastKey];
    }
    getFirstHandle() {
        let firstKey = Object.keys(this.handles)[0];
        return this.handles[firstKey];
    }
    // Aza assumption: Bounding box??? idk
    getSize(axis, selection_only) {
        if (selection_only) {
            let selected_vertices = Project.spline_selection[this.uuid]?.vertices || Object.keys(this.vertices);
            if (!selected_vertices.length) return 0;
            let range = [Infinity, -Infinity];
            let { vec1, vec2 } = Reusable;
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
    // Aza assumption: Determines Gizmo locations
    getWorldCenter(ignore_mesh_selection) {
        let m = this.mesh;
        let pos = new THREE.Vector3();
        let vertex_count = 0;

        for (let key in this.vertices) {
            if (ignore_mesh_selection || !Project.spline_selection[this.uuid] || (Project.spline_selection[this.uuid] && Project.spline_selection[this.uuid].vertices.includes(key))) {
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
    // Code smell (not sure how this works), from mesh.js
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
    // Code smell (not sure how this works), from mesh.js
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
        })
        this.preview_controller.updateGeometry(this);
    }
    getTubeGeo() {
        let radialSegments = this.resolution[0];
        let tubularSegments = this.resolution[1];
        let radius = 1 * this.radius_multiplier;

        // Gather Tangents for the entire tube
        let prevCurve;
        let prevCurveTangent;
        let prevCurveNormal;
        let curveTangents = [];
        let curveNormals = [];
        let tubePoints = [];
        for (let cKey in this.curves) {
            for (let tubePoint = 0; tubePoint <= tubularSegments; tubePoint++) {
                let time = tubePoint / tubularSegments;
                let curveData = this.getBézierForCurve(time, cKey);
                let curveChange = prevCurve && prevCurve != cKey;
                prevCurve = cKey;

                // Obtain local tangent, then check if we just changed curve segment, if so, we 
                // need to interpolate the previous and current tangents so that the tube mesh doesn't break
                let tangent = curveData.tangent;
                let normal = curveData.normal;
                if (curveChange) {
                    let avgTangent = (new THREE.Vector3().addVectors(curveData.tangent, prevCurveTangent)).multiplyScalar(0.5).normalize();
                    let avgNormal = (new THREE.Vector3().addVectors(curveData.normal, prevCurveNormal)).multiplyScalar(0.5).normalize();
                    tangent = avgTangent;
                    normal = avgNormal;
                }
                prevCurveTangent = curveData.tangent;
                prevCurveNormal = curveData.normal;

                // Store tangents for later steps
                if (curveChange) { // Pop & replace last tangent & normals if our curve has changed, & avoid duplicate points
                    curveTangents.pop()
                    curveTangents.push(tangent)

                    curveNormals.pop()
                    curveNormals.push(normal)
                    continue;
                }
                curveTangents.push(tangent);
                curveNormals.push(normal);
                tubePoints.push(curveData.point)
            }
        }
        if (this.cyclic) {
            let firsthandle = this.getFirstHandle();
            let lasthandle = this.getLastHandle();

            for (let tubePoint = 0; tubePoint <= tubularSegments; tubePoint++) {
                let time = tubePoint / tubularSegments;
                let curveData = this.getBézierForPoints(time, lasthandle.joint, lasthandle.control2, firsthandle.control1, firsthandle.joint);
                let tangent = curveData.tangent;
                let normal = curveData.normal;

                curveTangents.push(tangent);
                curveNormals.push(normal);
                tubePoints.push(curveData.point)
            }
        }

        // Add Verties per ring, and create face indices
        let vertices = [];
        let indices = [];
        let uvs = [];
        let verticesPerFace;
        let vertex = new THREE.Vector3();
        let biNormal = new THREE.Vector3();
        let matrix = new THREE.Matrix4();
        for (let tubePoint = 0; tubePoint < tubePoints.length; tubePoint++) {
            let tangent = curveTangents[tubePoint];
            let normal = curveNormals[tubePoint];
            biNormal.crossVectors(tangent, normal).normalize();
            matrix.makeBasis(tangent, normal, biNormal);

            for (let ringPoint = 0; ringPoint <= radialSegments; ringPoint++) {

                // Generate base rings, at scene origin, all aligned on one axis, apply matrix to orient them, and 
                // offset by the position of the corresponding spline point. Then push this vertex to relevant arrays.
                let angle = ringPoint / radialSegments * Math.PI * 2;
                let cos = -Math.cos(angle);
                let sin = Math.sin(angle);

                vertex.x = 0.0;
                vertex.y = cos * radius;
                vertex.z = sin * radius;
                vertex.applyMatrix4(matrix).add(tubePoints[tubePoint]);
                vertices.push(...vertex.toArray());

                // Face indices
                // Code smell from: https://github.com/mrdoob/three.js/blob/master/src/geometries/TubeGeometry.js
                if (tubePoint > 0 && ringPoint > 0) {
                    let a = (radialSegments + 1) * (tubePoint - 1) + (ringPoint - 1);
                    let b = (radialSegments + 1) * tubePoint + (ringPoint - 1);
                    let c = (radialSegments + 1) * tubePoint + ringPoint;
                    let d = (radialSegments + 1) * (tubePoint - 1) + ringPoint;

                    indices.push(a, b, c);
                    indices.push(a, c, d);
                    if (verticesPerFace) verticesPerFace.push([a, b, c, d]);
                    else verticesPerFace = [[a, b, c, d]];
                }

                // Make UVs
                // Code smell from: https://github.com/mrdoob/three.js/blob/master/src/geometries/TubeGeometry.js
                let uvx = (tubePoint / tubePoints) * Project.texture_width;
                let uvy = (ringPoint / radialSegments) * Project.texture_height;
				uvs.push(uvx, uvy);
            }
        }
        
        // Vertex normals, so we can render this properly. This is isolated 
        // for now as I'm considering tweaking it with data gathered above.
        let normals = [];
        for (let tubePoint = 0; tubePoint < tubePoints.length; tubePoint++) {
            let tangent = curveTangents[tubePoint];
            let normal = curveNormals[tubePoint];
            let biNormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

            for (let ringPoint = 0; ringPoint <= radialSegments; ringPoint++) {
                let angle = ringPoint / radialSegments * Math.PI * 2;
                let cos = -Math.cos(angle);
                let sin = Math.sin(angle);
                let normalVec = new THREE.Vector3(
                    cos * normal.x + sin * biNormal.x, 
                    cos * normal.y + sin * biNormal.y, 
                    cos * normal.z + sin * biNormal.z 
                ).normalize();

				normals.push(...normalVec.toArray());
            }
        }
       
        return {
            vertices: vertices,
            normals: normals,
            indices: indices,
            uvs: uvs,
            verticesPerFace: verticesPerFace
        };
    }
    getBézierForCurve(time, key) {
        let points = this.curves[key];
        return this.getBézierForPoints(time, points.start, points.start_ctrl, points.end_ctrl, points.end);
    }
    getBézierForPoints(time, p1k, p2k, p3k, p4k) {
        let p1 = this.vertices[p1k];
        let p2 = this.vertices[p2k];
        let p3 = this.vertices[p3k];
        let p4 = this.vertices[p4k];    
        return this.cubicBézier(time, p1, p2, p3, p4);
    }
    cubicBézier(time, point1, point2, point3, point4) {
        let timeP2 = Math.pow(time, 2);
        let timeP3 = Math.pow(time, 3);
        let p = [1, time, timeP2, timeP3]; // Power matrix (Position)
        let d = [0, 1, 2*time, 3*timeP2]; // Derivative Power matrix (Tangent)

        // Characteristic Coefficients for the original Bézier curve ("pc" variable is inverted to respect operation order)
        let pc1 = [ 1, 0,  0, 0];
        let pc2 = [-3, 3,  0, 0];
        let pc3 = [ 3, -6, 3, 0];
        let pc4 = [-1, 3, -3, 1];
        let pc = [pc4, pc3, pc2, pc1]

        // Bernstein polynomial function
        let bernstein = function(powers, char) {
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

        // Calculate the binormal vector
        let upVec = new THREE.Vector3(0, 1, 0); // Arbitrary UP vector not parallel to the tangent
        if (tangentVec.y === 1) { // not ideal, breaks with some point configurations
            upVec = new THREE.Vector3(1, 0, 0); // Use a different arbitrary vector if the tangent is parallel to the y-axis
        }
        let binormalVec = new THREE.Vector3().crossVectors(tangentVec, upVec).normalize();

        // Calculate the normal vector
        let normalVec = new THREE.Vector3().crossVectors(binormalVec, tangentVec).normalize();

        return {
            point: pointPos, 
            tangent: tangentVec,
            normal: normalVec
        };
    }
}
SplineMesh.prototype.title = tl('data.spline_mesh');
SplineMesh.prototype.type = 'spline';
SplineMesh.prototype.icon = 'fas.fa-bezier-curve';
SplineMesh.prototype.movable = true;
SplineMesh.prototype.resizable = true;
SplineMesh.prototype.rotatable = true;
SplineMesh.prototype.needsUniqueName = false;
SplineMesh.prototype.menu = new Menu([
    new MenuSeparator('spline_mesh_edit'),
    new MenuSeparator('spline_mesh_combination'),
    ...Outliner.control_menu_group,
    new MenuSeparator('settings'),
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

// Unused atm, due to THREEjs being based and bundling a native cubic bézier utility.
function cubicBezierCurve(P0, P1, P2, P3, t) {
    return (1 - t) ^ (3) * P0 + 3 * (1 - t) ^ (2) * t * P1 + 3 * (1 - t) * t ^ (2) * P2 + t ^ (3) * P3;
}

new Property(SplineMesh, 'string', 'name', { default: 'spline' })
new Property(SplineMesh, 'number', 'color', { default: Math.floor(Math.random() * markerColors.length) });
new Property(SplineMesh, 'vector', 'origin');
new Property(SplineMesh, 'vector', 'rotation');
new Property(SplineMesh, 'boolean', 'export', { default: true });
new Property(SplineMesh, 'boolean', 'visibility', { default: true });
new Property(SplineMesh, 'boolean', 'locked');
new Property(SplineMesh, 'boolean', 'cyclic'); // If the spline should be closed or not
new Property(SplineMesh, 'vector', 'resolution', { default: [6, 12] }); // The U (ring) and V (length) resolution of the spline
new Property(SplineMesh, 'number', 'radius_multiplier', { default: 1 }); // Number to multiply each ring's radius by
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
        let outline = new THREE.LineSegments(new THREE.BufferGeometry(), outline_material);
        outline.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(240).fill(1), 3));
        outline.no_export = true;
        outline.name = element.uuid + '_outline';
        outline.renderOrder = 2;
        outline.visible = element.visibility;
        outline.frustumCulled = false;
        mesh.outline = outline;
        mesh.add(outline);

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
    debugDraw(element, linePoints, lineColors, renderParams = [true, true]) {
        let debugTangentPoints = [];
        let debugTangentColors = [];
        let debugNormalPoints = [];
        let debugNormalColors = [];

        let pushPoints = function(bézierFunc, cKey) {
            let prevCurve;
            let prevCurveTangent;
            let prevCurveNormal;
            let debugTangentColor = [gizmo_colors.r.r, gizmo_colors.r.g, gizmo_colors.r.b];
            let debugNormalColor = [gizmo_colors.g.r, gizmo_colors.g.g, gizmo_colors.g.b];
            let debugColorSplit = [gizmo_colors.b.r, gizmo_colors.b.g, gizmo_colors.b.b];
            
            for (let res = 0; res <= element.resolution[1]; res++) {
                let time = res / element.resolution[1];
                let curve = bézierFunc(time);
                let curveChange = prevCurve && cKey && prevCurve != cKey;

                // Check if we just changed curve segment, if so, we need to interpolate the 
                // previous and current tangents so that the tube mesh doesn't break
                let localTangent = new THREE.Vector3().addVectors(curve.point, curve.tangent);
                let localNormal = new THREE.Vector3().addVectors(curve.point, curve.normal);
                let tangentColor = debugTangentColor;
                let normalColor = debugNormalColor;
                if (curveChange) {
                    let avgTangent = (new THREE.Vector3().addVectors(curve.tangent, prevCurveTangent)).multiplyScalar(0.5).normalize();
                    localTangent = new THREE.Vector3().addVectors(curve.point, avgTangent);
                    tangentColor = debugColorSplit;

                    let avgNormal = (new THREE.Vector3().addVectors(curve.normal, prevCurveNormal)).multiplyScalar(0.5).normalize();
                    localNormal = new THREE.Vector3().addVectors(curve.point, avgNormal);
                    normalColor = debugColorSplit;
                    console.log(`curve change from ${prevCurve} to ${cKey}`);
                }

                // Push all points to their respective arrays
                if (curveChange) { // Pop & replace last tangent if our curve has changed
                    debugTangentPoints.pop()
                    debugTangentPoints.push(localTangent)

                    debugNormalPoints.pop()
                    debugNormalPoints.push(localNormal)
                }

                // Compile Tangents
                debugTangentPoints.push(curve.point);
                debugTangentPoints.push(localTangent);
                debugTangentColors.push(tangentColor);
                debugTangentColors.push(tangentColor);
                
                // Compile Normals
                debugNormalPoints.push(curve.point);
                debugNormalPoints.push(localNormal);
                debugNormalColors.push(normalColor);
                debugNormalColors.push(normalColor);

                // Assign temp for next loop
                prevCurveTangent = curve.tangent;
                prevCurveNormal = curve.normal;
                prevCurve = cKey;
            }
        }

        // Add curve line points
        for (let cKey in element.curves) {
            pushPoints((time) => element.getBézierForCurve(time, cKey));
        }

        // Add another curve to the mesh if this spline is cyclic
        if (element.cyclic) {
            let firsthandle = element.getFirstHandle();
            let lasthandle = element.getLastHandle();

            pushPoints((time) => { 
                return element.getBézierForPoints(time, lasthandle.joint, lasthandle.control2, firsthandle.control1, firsthandle.joint) 
            }, null);
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
    },
    updateGeometry(element) {
        let { mesh } = element;
        let point_positions = [];
        let linePoints = [];
        let lineColors = [];
        let { handles, vertices } = element;

        // Handle geometry
        // TODO: this can and SHOULD likely be turned into a Gizmo, something to look into
        for (let key in handles) {
            let handle = handles[key];
            let ctrl1 = handle.control1;
            let joint = handle.joint;
            let ctrl2 = handle.control2;
            point_positions.push(...vertices[ctrl1], ...vertices[joint], ...vertices[ctrl2]);

            // Add handle lines
            if (BarItems.spline_selection_mode.value == 'handles') {
                linePoints.push(...vertices[ctrl1], ...vertices[joint], ...vertices[joint], ...vertices[ctrl2]);

                // Handle color
                let color = this.getHandleColor()[0];
                lineColors.push(...color, ...color, ...color, ...color);
            }
        }

        // Bezier Curves
        let pathColor = [gizmo_colors.spline_path.r, gizmo_colors.spline_path.g, gizmo_colors.spline_path.b];
        let pointsToAdd = []
        let pushPoints = function(bézierFunc) {
            for (let res = 0; res <= element.resolution[1]; res++) {
                let time = res / element.resolution[1];
                let curve = bézierFunc(time);
                pointsToAdd.push(curve.point);
            }
        }

        // Add curve line points
        for (let cKey in element.curves) {
            pushPoints((time) => element.getBézierForCurve(time, cKey));
        }

        // Add another curve to the mesh if this spline is cyclic
        if (element.cyclic) {
            let firsthandle = element.getFirstHandle();
            let lasthandle = element.getLastHandle();

            pushPoints((time) => { 
                return element.getBézierForPoints(time, lasthandle.joint, lasthandle.control2, firsthandle.control1, firsthandle.joint) 
            });
        }

        // Add all points to line geometry
        pointsToAdd.forEach((vector, i) => {
            let shouldDouble = i > 0 && i < (pointsToAdd.length - 1); // Band-aid because I don't calculate indices for outlines.
            linePoints.push(...vector.toArray(), ...(shouldDouble ? vector.toArray() : []));
            lineColors.push(...pathColor, ...(shouldDouble ? pathColor : []))
        })
        this.debugDraw(element, linePoints, lineColors, [false, true]);

        // Tube geometry
        let tube = element.getTubeGeo();
        mesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tube.vertices), 3));
        mesh.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(tube.normals), 3));
		mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(tube.uvs), 2)), 
		mesh.geometry.attributes.uv.needsUpdate = true;
        mesh.geometry.setIndex(tube.indices);
        
        // Add outlines for tube geo edges
        let outlineColor = [gizmo_colors.outline.r, gizmo_colors.outline.g, gizmo_colors.outline.b];
        for (let i = 0; i < tube.indices.length; i+=6) {
            let v1 = tube.indices[i];
            let v2 = tube.indices[i + 1];
            let v3 = tube.indices[i + 4];
            let v4 = tube.indices[i + 1];

            // Roughly done like mesh.js's indexing for outllines, adapted for this use-case
            [v2, v3, v4, v1].forEach((index, i) => {
                let vector = [
                    tube.vertices[index * 3], 
                    tube.vertices[(index * 3) + 1], 
                    tube.vertices[(index * 3) + 2]
                ];
                linePoints.push(...vector);
                lineColors.push(...outlineColor);
            })
        }

        let tubeVertCount = mesh.geometry.attributes.position.array.length;
        let highlightArray = mesh.geometry.attributes.highlight.array
        mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(tubeVertCount).fill(highlightArray[0]), 1));

        mesh.vertex_points.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(point_positions), 3));
        mesh.outline.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePoints), 3));
        mesh.outline.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(lineColors), 3));

        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();

        // Shade flat (do we want to?)
        // mesh.geometry = mesh.geometry.toNonIndexed();
        // mesh.geometry.computeVertexNormals();

        mesh.vertex_points.geometry.computeBoundingSphere();
        mesh.outline.geometry.computeBoundingSphere();
        SplineMesh.preview_controller.updateHighlight(element);

        this.dispatchEvent('update_geometry', { element });
    },
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
        else if (Project.view_mode === 'textured') 
            mesh.material = Canvas.emptyMaterials[element.color];

        // mesh.material.flatShading = true;

        this.dispatchEvent('update_faces', { element });
    },
    // This is code smell, majorly copied from mesh.js, I'm still unsure of how it works
    updateSelection(element) {
        NodePreviewController.prototype.updateSelection.call(this, element);

        let mesh = element.mesh;
        let white = new THREE.Color(0xffffff);
        let selected_vertices = element.getSelectedVertices();

        if (BarItems.spline_selection_mode.value == 'handles') {
            let colors = [];
            for (let key in element.vertices) {
                let color;
                if (selected_vertices.includes(key)) {
                    color = white;
                } else {
                    color = this.getHandleColor()[1];
                }
                colors.push(color.r, color.g, color.b);
            }
            mesh.vertex_points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            mesh.outline.geometry.needsUpdate = true;
        }

        mesh.vertex_points.visible = (Mode.selected.id == 'edit' && BarItems.spline_selection_mode.value == 'handles');

        this.dispatchEvent('update_selection', { element });
    },
    // This is also code smell, from mesh.js, unsure too
    updateHighlight(element, hover_cube, force_off) {
        var mesh = element.mesh;
        let highlighted = (
            Settings.get('highlight_cubes') &&
            ((hover_cube == element && !Transformer.dragging) || element.selected) &&
            Modes.edit &&
            !force_off
        ) ? 1 : 0;

        let array = new Array(mesh.geometry.attributes.highlight.count).fill(highlighted);
        let selection_mode = BarItems.selection_mode.value;
        let selected_vertices = element.getSelectedVertices();
    	
        if (!force_off && element.selected && Modes.edit) {
            let vertices = element.vertices;
            for (let vkey in vertices) {
                if (selected_vertices.indexOf(vkey) != -1 && (selection_mode == 'handles')) {
                    array[selected_vertices.indexOf(vkey)] = 2;
                }
            }
        }

        mesh.geometry.attributes.highlight.array.set(array);
        mesh.geometry.attributes.highlight.needsUpdate = true;

        this.dispatchEvent('update_highlight', { element });
    },
})