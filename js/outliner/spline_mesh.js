class SplineHandle {
    constructor(spline, data) {
		for (var key in this.constructor.properties) {
			this.constructor.properties[key].reset(this);
		}
		this.spline = spline;
        this.origin = [];
        this.control1 = { vector: [], origin: []};
        this.control2 = { vector: [], origin: []};
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
        if (data.control1 && data.control1 instanceof Array) this.control1.vector = data.control1;
        if (data.control2 && data.control2 instanceof Array) this.control2.vector = data.control2;
        if (data.origin && data.origin instanceof Array) {
            this.origin = data.origin;
            this.control1.origin = data.origin;
            this.control2.origin = data.origin;
        }
		return this;
	}
	getHandleKey() {
		for (let hkey in this.spline.handles) {
			if (this.spline.handles[hkey] == this) return hkey;
		}
	}
	getSaveCopy() {
		let copy = new this.constructor(this.spline, {
            control1: this.control1.vector,
            origin: this.origin,
            control2: this.control2.vector
        });
		delete copy.spline;
		return copy;
	}
	getUndoCopy() {
		let copy = new this.constructor(this.spline, {
            control1: this.control1.vector,
            origin: this.origin,
            control2: this.control2.vector
        });
		delete copy.spline;
		return copy;
	}
}

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
            this.addHandles( new SplineHandle( this, { control1: [8, 0, 4], origin: [8, 0.5, 0], control2: [8, 1, -4] } ) )
            this.addHandles( new SplineHandle( this, { control1: [4, 2, -4], origin: [4, 2.5, 0], control2: [4, 3, 4] } ) )
            this.addHandles( new SplineHandle( this, { control1: [0, 4, 4], origin: [0, 4.5, 0], control2: [0, 5, -4] } ) )
            this.addHandles( new SplineHandle( this, { control1: [-4, 6, -4], origin: [-4, 6.5, 0], control2: [-4, 7, 4] } ) )
            this.addHandles( new SplineHandle( this, { control1: [-8, 8, 4], origin: [-8, 8.5, 0], control2: [-8, 9, -4] } ) )

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
        console.log(this);
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
            point_list.push(handle.control1.vector);
            point_list.push(handle.origin);
            point_list.push(handle.control2.vector);
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
                start_ctrl: handle1.control2.vector,
                end_ctrl: handle2.control1.vector,
                end: handle2.origin
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

		copy.vertices = {};
		for (let key in this.vertices) {
			copy.vertices[key] = this.vertices[key].slice();
		}

        copy.handles = {};
        for (let key in this.handles) {
            copy.handles[key] = this.handles[key].getUndoCopy();
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

        let outline = new THREE.LineSegments(new THREE.BufferGeometry(), Canvas.meshOutlineMaterial);
		outline.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(240).fill(1), 3));
        outline.no_export = true;
        outline.name = element.uuid + '_outline';
        outline.renderOrder = 2;
        outline.frustumCulled = false;
        mesh.outline = outline;
        mesh.add(outline);

        let points = new THREE.Points(new THREE.BufferGeometry(), Canvas.meshVertexMaterial);
        points.element_uuid = element.uuid;
		points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(24).fill(1), 3));
        points.visible = element.visibility;
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
        let { curves, handles } = element;

        // Individual handle points
        for (let key in handles) {
            let handle = handles[key];
            point_positions.push(...handle.control1.vector);
            point_positions.push(...handle.origin);
            point_positions.push(...handle.control2.vector);
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

		mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(point_positions.length/3).fill(mesh.geometry.attributes.highlight.array[0]), 1));

		mesh.geometry.computeBoundingBox();
		mesh.geometry.computeBoundingSphere();

        mesh.vertex_points.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(point_positions), 3));
        mesh.outline.geometry.setFromPoints(line_points);

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