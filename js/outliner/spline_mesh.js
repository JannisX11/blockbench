export class SplineHandle {
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

//TODO (in order of priority)

// [x] Implement primitive tube drawing, using resolution U as the number of points per slice.
//     -> probably done, might need more refinement
//   - Needs to respect tilt & size.
//   - Would ideally generate a special version of
//     UV islands that would correspond to slices 
//     of the resulting tube (one per U edge).
// [ ] Fix cyclic tube mesh not connecting properly.
// [ ] Add ability to extrude points from the curve.
// [ ] Add ability to delete points from the curve.
// [ ] Add ability to remove segments from the curve.
// [ ] Add ability to dissolve points from the curve.
// [ ] Add ability to scale & tilt handles.

//DONE:
// [x] Make it so moving one control mirrors on the other, unless a key modifier is held (alt, ctrl...). 
//     -> key modifier replaced by on-ui option.
// [x] Implement proper graphics for spline handles, so that the connection between controls and origin are clear.
// [x] Add cyclic functionality, closes the spline from the first to last handle with an additional segment. 
//     -> Basic functionality for this added, but might need updating later on

export class SplineMesh extends OutlinerElement {
    constructor(data, uuid) {
        super(data, uuid)

        this._static = {
            properties: {
                handles: {}, // Main component of the spline
                vertices: {}, // Control points of the handles
                curves: {}, // Segments of the spline
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
    // Code smell from mesh.js
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
    // Code smell from mesh.js
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
        let { vec1, vec2, vec3 } = Reusable;
        let pathData = this.getBézierPath();

        // Buffers
        let faceData = [];
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
            vec2.crossVectors(pathTangent, pathNormal).normalize();
            matrix.makeBasis(pathTangent, pathNormal, vec2);

            for (let ringPoint = 0; ringPoint <= radialSegments; ringPoint++) {

                // Generate base rings, at scene origin, all aligned on one axis, apply matrix to orient them, and 
                // offset by the position of the corresponding spline point. Then push this vertex to relevant arrays.
                let angle = ringPoint / radialSegments * Math.PI * 2;
                let cos = -Math.cos(angle);
                let sin = Math.sin(angle);

                // Create current vertex of ongoing tube ring
                vec1.x = 0.0;
                vec1.y = cos * radius;
                vec1.z = sin * radius;
                vec1.applyMatrix4(matrix).add(pathPoint);

                // Normals
                // Code smell from: https://github.com/mrdoob/three.js/blob/master/src/geometries/TubeGeometry.js
                vec3.x = cos * pathNormal.x + sin * vec2.x,
                vec3.y = cos * pathNormal.y + sin * vec2.y,
                vec3.z = cos * pathNormal.z + sin * vec2.z 
                vec3.normalize();

                // Doesn't even work for our use case, will be replaced
                let uvx = (tubePoint / pathData.points) * 16;
                let uvy = (ringPoint / radialSegments) * 16;

                vertexData.push({
                    normal: vec3.toArray(),
                    vector: vec1.toArray(),
                    angles: [ angle, cos, sin ],
                    uv: [ uvx, uvy ]
                })
            }
        }

        // Final Buffers
        let vertices = [];
        let indices = [];
        let normals = [];
        let uvs = [];

        // Re-use vertex data gathered above to finalize geo
        for (let tubePoint = 1; tubePoint < pathData.points.length; tubePoint++) {
            for (let ringPoint = 1; ringPoint <= radialSegments; ringPoint++) {
                let a = (radialSegments + 1) * (tubePoint - 1) + (ringPoint - 1);
                let b = (radialSegments + 1) * tubePoint + (ringPoint - 1);
                let c = (radialSegments + 1) * tubePoint + ringPoint;
                let d = (radialSegments + 1) * (tubePoint - 1) + ringPoint;

                if (!this.smooth_shading) { // Flat shading: duplicate vertices for each face
                    let faceNormal = new THREE.Vector3().crossVectors(
                        new THREE.Vector3().fromArray(vertexData[b].vector).sub(new THREE.Vector3().fromArray(vertexData[a].vector)),
                        new THREE.Vector3().fromArray(vertexData[c].vector).sub(new THREE.Vector3().fromArray(vertexData[a].vector))
                    ).normalize();

                    [a, b, c, a, c, d].forEach((index) => {
                        vertices.push(...vertexData[index].vector);
                        normals.push(...faceNormal.toArray());
                        uvs.push(...vertexData[index].uv);
                    });

                    // Duplicate face indices, this approach is flawed in some way right now, as the 
                    // very first face of the mesh is missing when smooth shading is off. Will fix later (TODO)
                    let startIndex = vertices.length / 3;
                    indices.push(startIndex, startIndex + 1, startIndex + 2);
                    indices.push(startIndex + 3, startIndex + 4, startIndex + 5);
                } else { // Smooth shading: reuse vertices
                    indices.push(a, b, c, a, c, d);
                }
            }
        }

        // Smooth shading: populate vertices, normals, and uvs
        if (this.smooth_shading) {
            vertexData.forEach((vertex) => {
                vertices.push(...vertex.vector);
                normals.push(...vertex.normal);
                uvs.push(...vertex.uv);
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
        let tubularSegments = this.resolution[1];
        let curveTangents = [];
        let curveNormals = [];
        let tubePoints = [];

        // Gather Tangents for the entire tube, and extrapolate normals from them
        let prevCurve;
        let prevCurveTangent;
        let prevCurveNormal;
        for (let cKey in this.curves) {
            for (let tubePoint = 0; tubePoint <= tubularSegments; tubePoint++) {
                let time = tubePoint / tubularSegments;
                let curveData = this.getBézierForCurve(time, cKey);
                let curveChange = prevCurve && prevCurve != cKey;
                let tangent = curveData.tangent;
                let normal = this.getBézierNormal(tangent, prevCurveNormal);

                // Check if we just changed curve segment, if so, we need to interpolate the 
                // previous and current tangents so that the tube mesh doesn't break. Then Pop & 
                // replace last tangent & normals if our curve has changed, & avoid duplicate points.
                if (curveChange) {
                    let avgTangent = (new THREE.Vector3().addVectors(tangent, prevCurveTangent)).multiplyScalar(0.5).normalize();
                    let avgNormal = (new THREE.Vector3().addVectors(normal, prevCurveNormal)).multiplyScalar(0.5).normalize();
                    tangent = avgTangent;
                    normal = avgNormal;

                    // remove the values we just changed
                    curveTangents.pop();
                    curveNormals.pop();

                    // replace the values we just removed
                    curveTangents.push(tangent);
                    curveNormals.push(normal);
                }
    
                // Store everything
                curveTangents.push(tangent);
                curveNormals.push(normal);
                tubePoints.push(curveData.point);

                // re-assign temps
                prevCurveTangent = tangent;
                prevCurveNormal = normal;
                prevCurve = cKey;
            }
        }

        // Close Cyclic paths
        if (this.cyclic) {
            let firsthandle = this.getFirstHandle();
            let lasthandle = this.getLastHandle();

            for (let tubePoint = 0; tubePoint <= tubularSegments; tubePoint++) {
                let time = tubePoint / tubularSegments;
                let curveData = this.getBézierForPoints(time, lasthandle.joint, lasthandle.control2, firsthandle.control1, firsthandle.joint);
                let tangent = curveData.tangent;
                let normal = this.getBézierNormal(tangent);

                curveTangents.push(tangent);
                curveNormals.push(normal);
                tubePoints.push(curveData.point)
            }
        }

        return {
            tangents: curveTangents,
            normals: curveNormals,
            points: tubePoints
        }
    }
    getBézierNormal(tangent, previousNormal = null) {
        let upVec = new THREE.Vector3(0, 1, 0); // Arbitrary UP vector not parallel to the tangent

        // re-orient up based on curve progress
        if (previousNormal) upVec = previousNormal;
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
	static behavior = {
		unique_name: false,
		movable: true,
		resizable: true,
		rotatable: true,
	}
}
SplineMesh.prototype.title = tl('data.spline_mesh');
SplineMesh.prototype.type = 'spline';
SplineMesh.prototype.icon = 'fas.fa-bezier-curve';
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

new Property(SplineMesh, 'string', 'name', { default: 'spline' })
new Property(SplineMesh, 'number', 'color', { default: Math.floor(Math.random() * markerColors.length) });
new Property(SplineMesh, 'vector', 'origin');
new Property(SplineMesh, 'vector', 'rotation');
new Property(SplineMesh, 'vector', 'resolution', { default: [6, 12] }); // The U (ring) and V (length) resolution of the spline.
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
new Property(SplineMesh, 'boolean', 'show_normals', {
    default: false,
    inputs: {
        element_panel: {
            input: {label: 'Show Normals', type: 'checkbox'},
            onChange() {
                Canvas.updateView({elements: SplineMesh.selected, element_aspects: {geometry: true}});
            }
        }
    }
});
new Property(SplineMesh, 'boolean', 'show_tangents', {
	default: false,
	inputs: {
		element_panel: {
			input: {label: 'Show Tangents', type: 'checkbox'},
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
        let debugTangentColor = [gizmo_colors.v.r, gizmo_colors.v.g, gizmo_colors.v.b];
        let debugNormalColor = [gizmo_colors.w.r, gizmo_colors.w.g, gizmo_colors.w.b];
        let debugTangentPoints = [];
        let debugTangentColors = [];
        let debugNormalPoints = [];
        let debugNormalColors = [];
        let pathData = element.getBézierPath();

        for (let pi = 0; pi < pathData.points.length; pi++) {
            let tangent = pathData.tangents[pi];
            let normal = pathData.normals[pi];
            let point = pathData.points[pi];
            
            let localTangent = new THREE.Vector3().addVectors(point, tangent);
            let localNormal = new THREE.Vector3().addVectors(point, normal);
            let tangentColor = debugTangentColor;
            let normalColor = debugNormalColor;

            // Compile Tangents
            debugTangentPoints.push(point);
            debugTangentPoints.push(localTangent);
            debugTangentColors.push(tangentColor);
            debugTangentColors.push(tangentColor);
            
            // Compile Normals
            debugNormalPoints.push(point);
            debugNormalPoints.push(localNormal);
            debugNormalColors.push(normalColor);
            debugNormalColors.push(normalColor);
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
        let pathColor = new THREE.Color().set(markerColors[element.color].standard); // Color path with marker color
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
            lineColors.push(...pathColor.toArray(), ...(shouldDouble ? pathColor.toArray() : []))
        })
        this.debugDraw(element, linePoints, lineColors, [element.show_tangents, element.show_normals]);

        // Tube geometry
        if (element.render_mesh) {
            let tube = element.getTubeGeo();
            mesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tube.vertices), 3));
            mesh.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(tube.normals), 3));
            mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(tube.uvs), 2));
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
        } 
        else {
            mesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([]), 3));
            mesh.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([]), 3));
            mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([]), 2));
        }

        mesh.vertex_points.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(point_positions), 3));
        mesh.outline.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePoints), 3));
        mesh.outline.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(lineColors), 3));

        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
        
        mesh.outline.geometry.computeBoundingSphere();

        mesh.vertex_points.geometry.computeBoundingSphere();

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
	SplineHandle,
	SplineMesh
});