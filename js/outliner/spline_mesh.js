class SplineMesh extends OutlinerElement {  
	constructor(data, uuid) {
		super(data, uuid)

		this._static = {
			properties: {
                handles: {}, // Points & controls of the spline
                curves: {}, // Segments of the spline
                vertices: {} // Dummy for raycaster to be able to grab handle points (broken atm ??)
			}
		}
		Object.freeze(this._static); 

        if (!data.handles) {
            // Spline handles are made of two control points & one position point, forming patters as follows (. = point, ! = control, - = curve):
            // !.!-!.!-!.!
            this.addHandles(
                {control1: [8, 0, 4], point: [8, 0.5, 0], control2: [8, 1, -4]},
                {control1: [4, 2, -4], point: [4, 2.5, 0], control2: [4, 3, 4]},
                {control1: [0, 4, 4], point: [0, 4.5, 0], control2: [0, 5, -4]},
                {control1: [-4, 6, -4], point: [-4, 6.5, 0], control2: [-4, 7, 4]},
                {control1: [-8, 8, 4], point: [-8, 8.5, 0], control2: [-8, 9, -4]}
            )
            
			let handle_keys = Object.keys(this.handles);
            this.addCurves(
                [handle_keys[0], handle_keys[1]], //  )
                [handle_keys[1], handle_keys[2]], // (
                [handle_keys[2], handle_keys[3]], //  )
                [handle_keys[3], handle_keys[4]]  // (
            );
            this.addVertices(handle_keys[0], handle_keys[1], handle_keys[2], handle_keys[3], handle_keys[4]);
        }
		for (var key in SplineMesh.properties) {
			SplineMesh.properties[key].reset(this);
		}
		if (data && typeof data === 'object') {
			this.extend(data)
		}

        console.log(this.vertices);
        console.log(this.handles);
        console.log(this.curves);
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
    addVertices(...data) {
        // Collect individual points from handle
        let point_list = [];
        data.forEach(key => {
            let handle = this.handles[key];

            // Push all points of each handle
            point_list.push(handle.control1);
            point_list.push(handle.point);
            point_list.push(handle.control2);
        });

        // re-inject points as vertices
        return point_list.map(point => {            
            let key;
            while (!key || this.vertices[key]) {
                key = bbuid(4);
            }

            this.vertices[key] = [point[0] || 0, point[1] || 0, point[2] || 0];
            return key;
        })
    }
    addHandles(...data) {
        return data.map(anchor => {
            let key;
            while (!key || this.handles[key]) {
                key = bbuid(4);
            }
            this.handles[key] = anchor
            return key;
        })
    }
    addCurves(...data) {
        return data.map(handles => {
            let key;
            while (!key || this.curves[key]) {
                key = bbuid(4);
            }
            
            // Curves are defined by their handles
            // point & control 2 of handle 1 at the start
            // point & control 1 of handle 2 at the end
            let handle1 = this.handles[handles[0]];
            let handle2 = this.handles[handles[1]];
            this.curves[key] = {
                start: handle1.point,
                start_ctrl: handle1.control2,
                end_ctrl: handle2.control1,
                end: handle2.point
            };
        })
    }
	extend(object) {
		for (var key in SplineMesh.properties) {
			SplineMesh.properties[key].merge(this, object)
		}
		if (typeof object.handles == 'object') {
			for (let key in this.handles) {
				if (!object.handles[key]) {
					delete this.handles[key];
				}
			}
			for (let key in object.handles) {
                this.handles[key] = object.handles[key];
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

		copy.type = 'spline';
		copy.uuid = this.uuid
		return copy;
	}
	getSaveCopy(project) {
		var copy = {}
		for (var key in SplineMesh.properties) {
			SplineMesh.properties[key].copy(this, copy)
		}

		copy.handles = {};
		for (let key in this.handles) {
			copy.handles[key] = this.handles[key];
		}

		copy.type = 'spline';
		copy.uuid = this.uuid
		return copy;
	}
	setColor(index) {
		this.color = index;
	}
	getCenter(global) {
        return 0
	}
	getSize(axis, selection_only) {
        return 0
	}
	resize(val, axis, negative, allow_negative, bidirectional) {
    }
}
    SplineMesh.prototype.title = tl('data.spline_mesh');
    SplineMesh.prototype.type = 'spline_mesh';
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
		{name: 'menu.cube.color', icon: 'color_lens', children() {
			return markerColors.map((color, i) => {return {
				icon: 'bubble_chart',
				color: color.standard,
				name: color.name || 'cube.color.'+color.id,
				click(cube) {
					cube.forSelected(function(obj){
						obj.setColor(i)
					}, 'change color')
				}
			}})
		}},
		"randomize_marker_colors",
		new MenuSeparator('manage'),
		'rename',
		'toggle_visibility',
		'delete'
	]);
	SplineMesh.prototype.buttons = [
		Outliner.buttons.export,
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];


function cubicBezierCurve(P0, P1, P2, P3, t) {
    return (1-t)^(3)*P0+3*(1-t)^(2)*t*P1+3*(1-t)*t^(2)*P2+t^(3)*P3;
}

new Property(SplineMesh, 'string', 'name', {default: 'spline'})
new Property(SplineMesh, 'number', 'color', {default: Math.floor(Math.random()*markerColors.length)});
new Property(SplineMesh, 'vector', 'origin');
new Property(SplineMesh, 'vector', 'rotation');
new Property(SplineMesh, 'boolean', 'export', {default: true});
new Property(SplineMesh, 'boolean', 'visibility', {default: true});
new Property(SplineMesh, 'boolean', 'locked');
new Property(SplineMesh, 'enum', 'render_order', {default: 'default', values: ['default', 'behind', 'in_front']});
    
OutlinerElement.registerType(SplineMesh, 'spline_mesh');

new NodePreviewController(SplineMesh, {
	setup(element) {
		var mesh = new THREE.Mesh(new THREE.BufferGeometry(1, 1, 1), Canvas.emptyMaterials[0]);
		Project.nodes_3d[element.uuid] = mesh;
		mesh.name = element.uuid;
		mesh.type = element.type;
		mesh.isElement = true;

        let line_mat = new THREE.LineBasicMaterial( { color: 0xffffff } );
		let outline = new THREE.LineSegments(new THREE.BufferGeometry(), line_mat);
		outline.no_export = true;
		outline.name = element.uuid+'_outline';
		outline.visible = element.visibility;
		outline.renderOrder = 2;
		outline.frustumCulled = false;
		mesh.outline = outline;
		mesh.add(outline);

        let point_mat = new THREE.PointsMaterial({size: 14, sizeAttenuation: false, vertexColors: false});
		let points = new THREE.Points(new THREE.BufferGeometry(), point_mat);
		points.element_uuid = element.uuid;
		mesh.vertex_points = points;
		outline.add(points);

		// Update
		this.updateTransform(element);
		this.updateGeometry(element);
		this.updateRenderOrder(element);
		mesh.visible = element.visibility;

		this.dispatchEvent('setup', {element});
	},
	updateGeometry(element) {		
		let {mesh} = element;
		let point_positions = [];
		let line_points = [];
		let {curves, handles} = element;

        // Individual handle points
		for (let key in handles) {
            let data = handles[key];
			point_positions.push(...data.control1);
			point_positions.push(...data.point);
			point_positions.push(...data.control2);
		}

        // Bezier Curves
		for (let key in curves) {
            let data = curves[key];
            let curve = new THREE.CubicBezierCurve3(
                new THREE.Vector3().fromArray(data.start),
                new THREE.Vector3().fromArray(data.start_ctrl),
                new THREE.Vector3().fromArray(data.end_ctrl), 
                new THREE.Vector3().fromArray(data.end)
            ); 

            line_points.push(...curve.getPoints(50));
		}

		mesh.vertex_points.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(point_positions), 3));
		mesh.outline.geometry.setFromPoints(line_points);
        
		mesh.vertex_points.geometry.computeBoundingSphere();
		mesh.outline.geometry.computeBoundingSphere();

		this.dispatchEvent('update_geometry', {element});
	},
})