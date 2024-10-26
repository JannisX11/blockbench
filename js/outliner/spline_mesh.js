class SplineHandle {
    constructor(spline, data) {
		for (var key in this.constructor.properties) {
			this.constructor.properties[key].reset(this);
		}
		this.spline = spline;
        this.origin = '';
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
        if (data.origin) this.origin = data.origin;
        if (data.tilt) this.tilt = data.tilt;
        if (data.size) this.size = data.size;
		return this;
	}
	getHandleKey() {
		for (let hkey in this.spline.handles) {
			if (this.spline.handles[hkey] == this) return hkey;
		}
	}
	getSaveCopy() {
		let copy = {
            control1: this.control1,
            origin: this.origin,
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
            this.addHandles( new SplineHandle( this, { control1: vertex_keys[0], origin: vertex_keys[1], control2: vertex_keys[2] } ) )
            this.addHandles( new SplineHandle( this, { control1: vertex_keys[3], origin: vertex_keys[4], control2: vertex_keys[5] } ) )
            this.addHandles( new SplineHandle( this, { control1: vertex_keys[6], origin: vertex_keys[7], control2: vertex_keys[8] } ) )
            this.addHandles( new SplineHandle( this, { control1: vertex_keys[9], origin: vertex_keys[10], control2: vertex_keys[11] } ) )
            this.addHandles( new SplineHandle( this, { control1: vertex_keys[12], origin: vertex_keys[13], control2: vertex_keys[14] } ) )
            let handle_keys = Object.keys(this.handles);

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
                start: handle1.origin,
                start_ctrl: handle1.control2,
                end_ctrl: handle2.control1,
                end: handle2.origin
            };
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
    }
	getSelectedVertices(make) {
		if (make && !Project.spline_selection[this.uuid]) Project.spline_selection[this.uuid] = {vertices: [], handles: []};
		return Project.spline_selection[this.uuid]?.vertices || [];
	}
    // Bounding box??? idk
	getSize(axis, selection_only) {
		if (selection_only) {
			let selected_vertices = Project.spline_selection[this.uuid]?.vertices || Object.keys(this.vertices);
			if (!selected_vertices.length) return 0;
			let range = [Infinity, -Infinity];
			let {vec1, vec2} = Reusable;
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
    // Determines Gizmo locations
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
	resize(val, axis, negative, allow_negative, bidirectional) {
		let source_vertices = typeof val == 'number' ? this.oldVertices : this.vertices;
		let selected_vertices = Project.spline_selection[this.uuid]?.vertices || Object.keys(this.vertices);
		let range = [Infinity, -Infinity];
		let {vec1, vec2} = Reusable;
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

        let outline_material = new THREE.LineBasicMaterial( { color: 0xffffff } )
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
        this.updateRenderOrder(element);
        mesh.visible = element.visibility;

        this.dispatchEvent('setup', { element });
    },
    updateGeometry(element) {
        let { mesh } = element;
        let point_positions = [];
        let line_points = [];
        let { curves, handles, vertices } = element;

        // Individual handle points
        for (let key in handles) {
            let handle = handles[key];
            point_positions.push(...vertices[handle.control1]);
            point_positions.push(...vertices[handle.origin]);
            point_positions.push(...vertices[handle.control2]);
        }

        // Bezier Curves
        for (let key in curves) {
            let data = curves[key];
            let curve = new THREE.CubicBezierCurve3(
                new THREE.Vector3().fromArray(vertices[data.start]),
                new THREE.Vector3().fromArray(vertices[data.start_ctrl]),
                new THREE.Vector3().fromArray(vertices[data.end_ctrl]),
                new THREE.Vector3().fromArray(vertices[data.end])
            );
            let curve_points = curve.getPoints(50)

            curve_points.forEach(vector => {
                line_points.push(...[vector.x, vector.y, vector.z]);
            })
        }

		mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(point_positions.length).fill(mesh.geometry.attributes.highlight.array[0]), 1));

		mesh.geometry.computeBoundingBox();
		mesh.geometry.computeBoundingSphere();

        mesh.vertex_points.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(point_positions), 3));
        mesh.outline.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(line_points), 3));

        mesh.vertex_points.geometry.computeBoundingSphere();
        mesh.outline.geometry.computeBoundingSphere();
		SplineMesh.preview_controller.updateHighlight(element);

        this.dispatchEvent('update_geometry', { element });
    },
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

		this.dispatchEvent('update_selection', {element});
	},
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

		this.dispatchEvent('update_highlight', {element});
	},
})