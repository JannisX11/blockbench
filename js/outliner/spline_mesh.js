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
    // TODO: Implement ring orientation, based on the previous point & next point's angle with for center the current point.
    // https://en.wikipedia.org/wiki/Inverse_trigonometric_functions
    getTubeGeo() {
        let radialSegments = this.resolution[0];
        let vertices = [];
        let vertex_vectors = [];
        let normals = [];
        let indices = [];
        let vertex = new THREE.Vector3();
        let point = new THREE.Vector3();
        let radius = 2;

        // Curve components
        let curve = this.getCurvePath();
        let tubePoints = curve.getPoints(this.resolution[1]);

        let prevAngles = [];
        for (let ts = 0; ts <= tubePoints.length - 1; ts++) {
            // Grab the current point from the points array
            point = tubePoints[ts];

            // Check if we're at a sub-curve extremity
            let isCurveExtremity = ts % this.resolution[1] == 0;

            // Build a matrix between prev & next tube points
            // TODO: this currently does NOT work, the spline twists badly and many rings simply don't align propetly
            let P1 = new THREE.Vector3().copy(tubePoints[ts - 1] || point); // Copy previous point into new vector
            let P2 = new THREE.Vector3().copy(tubePoints[ts + 1] || point); // Copy next point into new vector
            let direction = P2.sub(P1).normalize();
            let angleY = -Math.atan(direction.z / direction.x);
            let angleZ = Math.atan(direction.y / direction.x);
            let matrixY = new THREE.Matrix4().makeRotationY(angleY);
            let matrixZ = new THREE.Matrix4().makeRotationZ(angleZ);
            let matrix = matrixZ.multiply(matrixY);
            prevAngles = [angleY, angleZ];

            // generate normals (TODO), Face Indices and Vertices for the current point
            for (let rs = 0; rs <= radialSegments; rs++) {
                let angle = rs / radialSegments * Math.PI * 2;
                let cos = -Math.cos(angle);
                let sin = Math.sin(angle);

                // Generate base rings, at scene origin, all aligned on one axis.
                vertex.x = 0.0;
                vertex.y = cos * radius;
                vertex.z = sin * radius;

                // Finalize vertices & push em
                vertex.applyMatrix4(matrix);
                vertex.add(point);
                vertex_vectors.push(vertex);
                vertices.push(vertex.x, vertex.y, vertex.z);
            }
        }

        // Face indices, so we can render them properly
        for (let ts = 1; ts <= tubePoints.length - 1; ts++) {
            for (let rs = 1; rs <= radialSegments; rs++) {
                let a = (radialSegments + 1) * (ts - 1) + (rs - 1);
                let b = (radialSegments + 1) * ts + (rs - 1);
                let c = (radialSegments + 1) * ts + rs;
                let d = (radialSegments + 1) * (ts - 1) + rs;
                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }

        // Normals (broken atm)
        /*
        for (let ts = 1; ts <= tubePoints.length - 1; ts++) {
            for (let rs = 1; rs <= radialSegments; rs++) {
                let a = (radialSegments + 1) * (ts - 1) + (rs - 1);
                let b = (radialSegments + 1) * ts + (rs - 1);
                let c = (radialSegments + 1) * ts + rs;
                let d = (radialSegments + 1) * (ts - 1) + rs;
                if (!(vertex_vectors[a] && vertex_vectors[b] && vertex_vectors[c] && vertex_vectors[d])) continue;
                
                let faceVertices = [vertex_vectors[a], vertex_vectors[b], vertex_vectors[c], vertex_vectors[d]];
                let P1 = [
                    faceVertices[1].x - faceVertices[0].x,
                    faceVertices[1].y - faceVertices[0].y,
                    faceVertices[1].z - faceVertices[0].z,
                ]
                let P2 = [
                    faceVertices[2].x - faceVertices[0].x,
                    faceVertices[2].y - faceVertices[0].y,
                    faceVertices[2].z - faceVertices[0].z,
                ]
                let direction = [
                    P1[1] * P2[2] - P1[2] * P2[1],
                    P1[2] * P2[0] - P1[0] * P2[2],
                    P1[0] * P2[1] - P1[1] * P2[0],
                ]
                let length = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2]);
                let faceNormal = direction.map(dir => dir / length || 0);
                normals.push(...faceNormal, ...faceNormal, ...faceNormal, ...faceNormal);
            }
        }
        */

        return {
            vertices: vertices,
            normals: normals,
            indices: indices
        };

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
    getCurvePath() {
        let curvePath = new THREE.CurvePath()
        for (let key in this.curves) {
            let curve = this.getCurveAsBezier(key);
            curvePath.curves.push(curve);
        }
        return curvePath;
    }
    getCurveAsBezier(key) {
        let points = this.curves[key];
        let curve = this.getBezierForVertices(points.start, points.start_ctrl, points.end_ctrl, points.end);
        return curve;
    }
    getBezierForVertices(start_key, start_control_key, end_control_key, end_key) {
        let curve = new THREE.CubicBezierCurve3(
            new THREE.Vector3().fromArray(this.vertices[start_key]),
            new THREE.Vector3().fromArray(this.vertices[start_control_key]),
            new THREE.Vector3().fromArray(this.vertices[end_control_key]),
            new THREE.Vector3().fromArray(this.vertices[end_key])
        );
        return curve;
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
    updateGeometry(element) {
        let { mesh } = element;
        let point_positions = [];
        let line_points = [];
        let line_colors = [];
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
                line_points.push(...vertices[ctrl1], ...vertices[joint], ...vertices[joint], ...vertices[ctrl2]);

                // Handle color
                let color = [
                    gizmo_colors.spline_handle_aligned.r, 
                    gizmo_colors.spline_handle_aligned.g, 
                    gizmo_colors.spline_handle_aligned.b
                ];
                if (BarItems.spline_handle_mode.value === "free")
                    color = [
                        gizmo_colors.spline_handle_free.r, 
                        gizmo_colors.spline_handle_free.g, 
                        gizmo_colors.spline_handle_free.b
                    ];
                else if (BarItems.spline_handle_mode.value === "mirrored")
                    color = [
                        gizmo_colors.spline_handle_mirrored.r, 
                        gizmo_colors.spline_handle_mirrored.g, 
                        gizmo_colors.spline_handle_mirrored.b
                    ];
                line_colors.push(...color, ...color, ...color, ...color);
            }
        }

        // Bezier Curves
        let curve_color = [gizmo_colors.solid.r, gizmo_colors.solid.g, gizmo_colors.solid.b];
        let addPoints = function (points) {
            points.forEach((vector, i) => {
                let shouldDouble = i > 0 && i < (points.length - 1); // Band-aid because I don't calculate indices for outlines.
                line_points.push(...vector.toArray(), ...(shouldDouble ? vector.toArray() : []));
                line_colors.push(...curve_color, ...(shouldDouble ? curve_color : []))
            })
        }
        let curvePath = element.getCurvePath();
        let curve_points = curvePath.getPoints(element.resolution[1])
        addPoints(curve_points);

        // Add another curve to the mesh if this spline is cyclic
        if (element.cyclic) {
            let firsthandle = element.getFirstHandle();
            let lasthandle = element.getLastHandle();
            let curve = element.getBezierForVertices(lasthandle.joint, lasthandle.control2, firsthandle.control1, firsthandle.joint);
            let curve_points = curve.getPoints(element.resolution[1]);
            addPoints(curve_points);
        }

        // Tube geometry
        let tube = element.getTubeGeo();
        mesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tube.vertices), 3));
        mesh.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(tube.normals), 3));
        mesh.geometry.setIndex(tube.indices);

        mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(line_points.length).fill(mesh.geometry.attributes.highlight.array[0]), 1));

        mesh.vertex_points.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(point_positions), 3));
        mesh.outline.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(line_points), 3));
        mesh.outline.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(line_colors), 3));

        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();

        mesh.vertex_points.geometry.computeBoundingSphere();
        mesh.outline.geometry.computeBoundingSphere();
        // SplineMesh.preview_controller.updateHighlight(element);

        this.dispatchEvent('update_geometry', { element });
    },
    updateFaces(element) {
        let { mesh } = element;

        if (Project.view_mode === 'solid') mesh.material = Canvas.monochromaticSolidMaterial
        else if (Project.view_mode === 'colored_solid') mesh.material = Canvas.coloredSolidMaterials[element.color]
        else if (Project.view_mode === 'wireframe') mesh.material = Canvas.wireframeMaterial
        else if (Project.view_mode === 'normal') mesh.material = Canvas.normalHelperMaterial
        else if (Project.view_mode === 'uv') mesh.material = Canvas.uvHelperMaterial

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
                    color = gizmo_colors.grid;
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